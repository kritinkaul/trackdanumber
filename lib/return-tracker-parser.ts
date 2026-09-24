import * as XLSX from "xlsx";

import { ExcelParseError, cellToString, parseTrackingCell } from "@/lib/excel-parser";
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

/** How many leading rows of each sheet to scan for the header row (the tracker has title/legend rows above it). */
const HEADER_SCAN_ROWS = 30;

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
  rows: unknown[][];
  assetCount: number;
}

function readRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: true,
  });
}

/**
 * Finds the tracker sheet. Copies of the workbook often carry extra sheets
 * with the same headers (an archive tab, an emptied template), so when several
 * sheets match, the one with the most asset rows wins rather than the first.
 */
function findReturnTrackerSheet(workbook: XLSX.WorkBook): SheetMatch | null {
  let best: SheetMatch | null = null;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = readRows(sheet);
    for (let i = 0; i < Math.min(rows.length, HEADER_SCAN_ROWS); i++) {
      const headerIndex = buildHeaderIndex(rows[i].map(normalizeHeader));
      if (!isSignatureRow(headerIndex)) continue;
      const serialCol = headerIndex.get("serial number") ?? -1;
      const assetCount = rows
        .slice(i + 1)
        .filter((row) => cellToString(row[serialCol])).length;
      if (!best || assetCount > best.assetCount) {
        best = { sheetName, headerRowIndex: i, headerIndex, rows, assetCount };
      }
      break;
    }
  }
  return best;
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

interface TrackingRead {
  number: string;
  /** Excel re-saved the number as "8.70613E+11"; the real digits are gone. */
  scientific: boolean;
}

/** Tracking cells occasionally hold notes; only accept digit sequences that look like carrier numbers. */
function readTrackingNumber(value: unknown): TrackingRead {
  const parsed = parseTrackingCell(value);
  const [first] = parsed.numbers;
  return {
    number: first && /^\d{8,34}$/.test(first) ? first : "",
    scientific: parsed.issue === "SCIENTIFIC",
  };
}

function plural(count: number, word: string): string {
  return `${count.toLocaleString()} ${word}${count === 1 ? "" : "s"}`;
}

const SCIENTIFIC_FIX =
  "This happens when the CSV is opened in Excel and saved again. Upload the original file (the .xlsx, or the CSV exactly as it was exported) without re-saving it. If it must be edited in Excel, first select the tracking number columns and choose Format Cells → Number with 0 decimal places, then save.";

export function parseReturnTracker(workbook: XLSX.WorkBook): ParsedReturnTracker {
  const match = findReturnTrackerSheet(workbook);
  if (!match) {
    // Callers should gate on isReturnTrackerWorkbook first.
    throw new Error("Workbook is not a Zero Touch Return Tracker export.");
  }

  const rawRows = match.rows;
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
  let assetCount = 0;
  let skippedNoTracking = 0;
  let skippedScientific = 0;

  for (const raw of rawRows.slice(match.headerRowIndex + 1)) {
    const serialNumber = text(raw, "serial number");
    if (!serialNumber) {
      continue; // trailing blank/format rows aren't data
    }
    assetCount += 1;
    const current = readTrackingNumber(cell(raw, "return tracking number"));
    const previous = readTrackingNumber(cell(raw, "previous return tracking number"));
    const returnTrackingNumber = current.number;
    const previousReturnTrackingNumber = previous.number;
    if (!returnTrackingNumber && !previousReturnTrackingNumber) {
      if (current.scientific || previous.scientific) skippedScientific += 1;
      else skippedNoTracking += 1;
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

  const trackingColumn = col("return tracking number");
  const columnName = `"Return Tracking Number" (column ${XLSX.utils.encode_col(trackingColumn)})`;

  if (rows.length === 0) {
    if (skippedScientific > 0) {
      throw new ExcelParseError(
        `The return tracking numbers in this file were saved as rounded numbers like "8.70613E+11", so their real digits are lost and they can't be tracked. ${SCIENTIFIC_FIX}`
      );
    }
    if (assetCount === 0) {
      throw new ExcelParseError(
        `Found the return tracker's headers on sheet "${match.sheetName}" (row ${match.headerRowIndex + 1}), but no asset rows with a serial number below them.`
      );
    }
    throw new ExcelParseError(
      `None of the ${plural(assetCount, "asset")} on sheet "${match.sheetName}" has a readable tracking number in ${columnName}. Check that the column holds the FedEx tracking numbers.`
    );
  }

  if (skippedScientific > 0) {
    warnings.push(
      `${plural(skippedScientific, "asset")} skipped: the return tracking number was saved in scientific notation (e.g. 8.70613E+11), so its digits are lost. ${SCIENTIFIC_FIX}`
    );
  }
  if (skippedNoTracking > 0) {
    warnings.push(
      `${plural(skippedNoTracking, "asset")} skipped (no readable return tracking number).`
    );
  }

  return { rows, warnings, sheetName: match.sheetName };
}
