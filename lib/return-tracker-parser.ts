import * as XLSX from "xlsx";

import { cellToString, parseTrackingCell } from "@/lib/excel-parser";
import type { ReturnAssetRow } from "@/types/return-tracker";

export interface ParsedReturnTracker {
  rows: ReturnAssetRow[];
  warnings: string[];
  sheetName: string;
}

/**
 * Headers that identify a sheet as the Zero Touch Return Tracker's daily
 * view. All three must appear in the same row for a positive match, so the
 * regular shipment manifest (which has "Tracking Number", not "Return
 * Tracking Number") can never be misdetected. Status matches either the
 * original "Status" column or v4's "Status (auto)" / "Status Override".
 */
const SIGNATURE_HEADERS = ["serial number", "return tracking number", "status"] as const;
const STATUS_HEADERS = ["status", "status override"];

/** How many leading rows of each sheet to scan for the header row (the tracker has a title/legend row above it). */
const HEADER_SCAN_ROWS = 10;

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * v4 of the tracker renamed columns without changing their meaning:
 * "Status" became "Status (auto)", and columns that are no longer maintained
 * daily moved to the end with a "Parked:" prefix ("Parked: Legal Hold?").
 * Both spellings resolve to the same key.
 */
function canonicalHeader(normalized: string): string {
  return normalized.replace(/^parked /, "").replace(/ auto$/, "");
}

function buildHeaderIndex(normalized: string[]): Map<string, number> {
  const headerIndex = new Map<string, number>();
  normalized.forEach((header, col) => {
    if (header && !headerIndex.has(header)) headerIndex.set(header, col);
  });
  normalized.forEach((header, col) => {
    const canonical = canonicalHeader(header);
    if (canonical && !headerIndex.has(canonical)) headerIndex.set(canonical, col);
  });
  return headerIndex;
}

function isSignatureRow(headerIndex: Map<string, number>): boolean {
  return SIGNATURE_HEADERS.every((h) =>
    h === "status" ? STATUS_HEADERS.some((s) => headerIndex.has(s)) : headerIndex.has(h)
  );
}

interface SheetMatch {
  sheetName: string;
  headerRowIndex: number;
  headerIndex: Map<string, number>;
}

function findReturnTrackerSheet(workbook: XLSX.WorkBook): SheetMatch | null {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: true,
      range: 0,
    });
    for (let i = 0; i < Math.min(rows.length, HEADER_SCAN_ROWS); i++) {
      const headerIndex = buildHeaderIndex(rows[i].map(normalizeHeader));
      if (isSignatureRow(headerIndex)) {
        return { sheetName, headerRowIndex: i, headerIndex };
      }
    }
  }
  return null;
}

/** True when the uploaded workbook is a Zero Touch Return Tracker export. */
export function isReturnTrackerWorkbook(workbook: XLSX.WorkBook): boolean {
  return findReturnTrackerSheet(workbook) !== null;
}

/** Excel serial date (days since 1899-12-30) → ISO date string. */
function excelDateToIso(value: unknown): string | null {
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const ms = Date.UTC(1899, 11, 30) + Math.round(value) * 86400000;
    return new Date(ms).toISOString();
  }
  const text = cellToString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toYes(value: unknown): boolean {
  const text = cellToString(value).toLowerCase();
  return text === "yes" || text === "true" || value === true;
}

/** Drops decoration the sheet puts before a status, e.g. the warning emoji in "⚠ Add Actual Return Destination". */
function cleanStatus(value: string): string {
  return value.replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

/** Tracking cells occasionally hold notes; only accept digit sequences that look like carrier numbers. */
function toTrackingNumber(value: unknown): string {
  const [first] = parseTrackingCell(value).numbers;
  return first && /^\d{8,34}$/.test(first) ? first : "";
}

export function parseReturnTracker(workbook: XLSX.WorkBook): ParsedReturnTracker {
  const match = findReturnTrackerSheet(workbook);
  if (!match) {
    // Callers should gate on isReturnTrackerWorkbook first.
    throw new Error("Workbook is not a Zero Touch Return Tracker export.");
  }

  const sheet = workbook.Sheets[match.sheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  const col = (header: string) => match.headerIndex.get(header) ?? -1;
  const cell = (row: unknown[], header: string): unknown => {
    const index = col(header);
    return index >= 0 ? row[index] : "";
  };
  const text = (row: unknown[], header: string): string => cellToString(cell(row, header));

  const warnings: string[] = [];
  for (const optional of ["previous return tracking number", "assigned to", "routing destination"]) {
    if (col(optional) < 0) {
      warnings.push(`Return tracker column "${optional}" was not found; those values will be blank.`);
    }
  }

  const rows: ReturnAssetRow[] = [];
  let skippedNoTracking = 0;

  for (const raw of rawRows.slice(match.headerRowIndex + 1)) {
    const serialNumber = text(raw, "serial number");
    if (!serialNumber) {
      continue; // trailing blank/format rows aren't data
    }
    const returnTrackingNumber = toTrackingNumber(cell(raw, "return tracking number"));
    const previousReturnTrackingNumber = toTrackingNumber(
      cell(raw, "previous return tracking number")
    );
    if (!returnTrackingNumber && !previousReturnTrackingNumber) {
      skippedNoTracking += 1;
      continue;
    }

    rows.push({
      serialNumber,
      assignedTo: text(raw, "assigned to"),
      refreshNumber: text(raw, "refresh number"),
      sctask: text(raw, "insight sctask") || text(raw, "sctask"),
      // If only the previous label parses as a tracking number, promote it so
      // every asset has a primary label to follow.
      returnTrackingNumber: returnTrackingNumber || previousReturnTrackingNumber,
      previousReturnTrackingNumber:
        returnTrackingNumber && previousReturnTrackingNumber
          ? previousReturnTrackingNumber
          : null,
      sheetStatus: cleanStatus(text(raw, "status") || text(raw, "status override")),
      sheetDeliveredDate: excelDateToIso(cell(raw, "return delivered date")),
      routingDestination: text(raw, "routing destination"),
      actualReturnDestination: text(raw, "actual return destination"),
      legalHold: toYes(cell(raw, "legal hold")),
      lenovoDefect: toYes(cell(raw, "lenovo defect")),
      exception: text(raw, "exception"),
      notes: text(raw, "notes"),
      nextAction: text(raw, "next action"),
      batch: text(raw, "batch"),
    });
  }

  if (skippedNoTracking > 0) {
    warnings.push(
      `${skippedNoTracking} asset${skippedNoTracking === 1 ? "" : "s"} skipped (no readable return tracking number).`
    );
  }

  return { rows, warnings, sheetName: match.sheetName };
}
