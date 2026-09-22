import * as XLSX from "xlsx";

import {
  ExcelField,
  FIELD_LABELS,
  HEADER_ALIASES,
  REQUIRED_FIELD,
  SILENT_OPTIONAL_FIELDS,
} from "@/lib/header-aliases";
import type { ExcelShipmentRow } from "@/types/shipment";

export class ExcelParseError extends Error {}

export interface ParsedSpreadsheet {
  rows: ExcelShipmentRow[];
  warnings: string[];
  sheetName: string;
}

/** Spreadsheet extensions SheetJS can read and the uploader accepts. */
export const ACCEPTED_EXTENSIONS = [".xlsx", ".xlsm", ".xlsb", ".xls", ".ods", ".csv", ".tsv", ".txt"];

const TEXT_EXTENSIONS = /\.(csv|tsv|txt)$/i;

/** Title / legend rows above the real header are common in exported reports. */
const HEADER_SCAN_ROWS = 25;

/** How many row numbers to list in a warning before summarising the rest. */
const MAX_LISTED_ROWS = 8;

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Aliases shorter than this are exact-match only. A short token like "st" is a
// legitimate abbreviation for "state", but as a *prefix* it also matches
// unrelated headers such as "Status" or "Street" — so it can't be trusted to
// mean "starts with" without risking a wrong column getting claimed first.
const MIN_PREFIX_ALIAS_LENGTH = 4;

/**
 * Maps fields to column indexes. Exact matches are resolved for every field
 * before any prefix matching, so a loose prefix (e.g. "ship to" for Deliver
 * To) can't steal a column that another field names exactly ("Ship To Zip").
 */
function matchHeaders(headers: string[]): Partial<Record<ExcelField, number>> {
  const normalized = headers.map(normalizeHeader);
  const mapping: Partial<Record<ExcelField, number>> = {};
  const claimed = new Set<number>();
  const fields = Object.keys(HEADER_ALIASES) as ExcelField[];

  const claim = (field: ExcelField, predicate: (header: string) => boolean) => {
    if (mapping[field] !== undefined) return;
    const index = normalized.findIndex((h, i) => h !== "" && !claimed.has(i) && predicate(h));
    if (index >= 0) {
      mapping[field] = index;
      claimed.add(index);
    }
  };

  for (const field of fields) {
    claim(field, (h) => HEADER_ALIASES[field].includes(h));
  }
  for (const field of fields) {
    claim(field, (h) =>
      HEADER_ALIASES[field].some((a) => a.length >= MIN_PREFIX_ALIAS_LENGTH && h.startsWith(a))
    );
  }
  return mapping;
}

/**
 * Extracts an office label from the deliver-to field when it matches the
 * "A&M | US-{Location}" pattern used for company office shipments.
 * Returns null for direct personal deliveries.
 *
 * Examples:
 *   "A&M | US-New York, NY"  → "A&M - New York, NY"
 *   "A&M | US-Tampa, FL"     → "A&M - Tampa, FL"
 *   "Jacob Hooton"           → null
 */
export function parseOffice(deliverTo: string): string | null {
  const match = deliverTo.match(/A\s*[&+]\s*M\s*\|\s*US-(.+)/i);
  if (!match) return null;
  const location = match[1].trim();
  return `A&M - ${location}`;
}

// Non-breaking / zero-width spaces and BOMs sneak in from copy-paste and web exports.
const INVISIBLE_CHARS = /[\u00a0\u200b-\u200d\u2060\ufeff]/g;

export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    // Long tracking numbers can arrive as numbers; avoid scientific notation.
    return Number.isInteger(value) ? BigInt(value).toString() : String(value);
  }
  return String(value).replace(INVISIBLE_CHARS, " ").trim();
}

/**
 * Reads an uploaded buffer into a workbook, normalizing read failures.
 * Text formats are read with `raw` so values such as tracking numbers and
 * ZIP codes stay exactly as typed instead of being coerced to numbers
 * (which drops leading zeros and rounds anything over 15 digits).
 */
export function readWorkbook(buffer: ArrayBuffer, fileName = ""): XLSX.WorkBook {
  if (buffer.byteLength === 0) {
    throw new ExcelParseError("The uploaded file is empty.");
  }
  try {
    return XLSX.read(new Uint8Array(buffer), {
      type: "array",
      cellDates: true,
      raw: TEXT_EXTENSIONS.test(fileName),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : "";
    if (message.includes("password") || message.includes("encrypt")) {
      throw new ExcelParseError(
        "This workbook is password-protected. Remove the password in Excel (File → Info → Protect Workbook), save, and upload again."
      );
    }
    throw new ExcelParseError(
      "Could not read the file. Please upload a valid Excel (.xlsx, .xls) or CSV file."
    );
  }
}

interface SheetRows {
  sheetName: string;
  rows: unknown[][];
  /** 0-based sheet row index of rows[0]. */
  firstRow: number;
}

/** Rows read per sheet while looking for the header (enough to confirm data sits under it). */
const HEADER_PROBE_ROWS = 200;

function readSheetRows(
  workbook: XLSX.WorkBook,
  sheetName: string,
  maxRows?: number
): SheetRows | null {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet || !sheet["!ref"]) return null;
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  if (maxRows !== undefined) range.e.r = Math.min(range.e.r, range.s.r + maxRows - 1);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: true,
    range,
  });
  return { sheetName, rows, firstRow: range.s.r };
}

interface HeaderMatch {
  sheet: SheetRows;
  headerIndex: number;
  headers: string[];
  mapping: Partial<Record<ExcelField, number>>;
}

function isHiddenSheet(workbook: XLSX.WorkBook, index: number): boolean {
  return Boolean(workbook.Workbook?.Sheets?.[index]?.Hidden);
}

/**
 * Finds the header row: the scanned row (on any sheet) that maps a Tracking
 * Number column plus the most other known columns. Scoring by column count
 * keeps a title such as "Tracking report – July" from being mistaken for
 * the header.
 */
function findHeader(workbook: XLSX.WorkBook): HeaderMatch | null {
  let best: (HeaderMatch & { score: number }) | null = null;
  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    const sheet = readSheetRows(workbook, sheetName, HEADER_PROBE_ROWS);
    if (!sheet) return;
    const visibilityBonus = isHiddenSheet(workbook, sheetIndex) ? 0 : 0.5;
    const limit = Math.min(sheet.rows.length, HEADER_SCAN_ROWS);
    for (let i = 0; i < limit; i++) {
      const headers = sheet.rows[i].map((cell) => cellToString(cell));
      const mapping = matchHeaders(headers);
      if (mapping[REQUIRED_FIELD] === undefined) continue;
      const hasDataBelow = sheet.rows
        .slice(i + 1)
        .some((row) => cellToString(row[mapping[REQUIRED_FIELD] as number]) !== "");
      const score = Object.keys(mapping).length + visibilityBonus + (hasDataBelow ? 1 : 0);
      if (!best || score > best.score) {
        best = { sheet, headerIndex: i, headers, mapping, score };
      }
    }
  });
  return best;
}

function listRows(rows: number[]): string {
  const shown = rows.slice(0, MAX_LISTED_ROWS).join(", ");
  const extra = rows.length - MAX_LISTED_ROWS;
  return extra > 0 ? `${shown} and ${extra} more` : shown;
}

type TrackingIssue = "SCIENTIFIC" | "PRECISION";

interface TrackingCell {
  numbers: string[];
  issue: TrackingIssue | null;
}

/**
 * Cleans a tracking cell. Handles the ways Excel and people mangle them:
 * numeric cells, "8.73696E+11" text, a leading apostrophe, spaces/dashes
 * ("8736 9642 8611"), a trailing ".0" from CSV round-trips, placeholder text
 * ("N/A", "pending"), and several numbers in one cell.
 */
export function parseTrackingCell(value: unknown): TrackingCell {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { numbers: [], issue: null };
    const text = cellToString(value);
    // Excel keeps 15 significant digits; longer numeric tracking numbers are already rounded.
    const issue = Math.abs(value) > Number.MAX_SAFE_INTEGER ? "PRECISION" : null;
    return { numbers: [text], issue };
  }

  const text = cellToString(value).replace(/^'+/, "");
  if (!text) return { numbers: [], issue: null };
  if (/^\d+(\.\d+)?e\+?\d+$/i.test(text.replace(/\s/g, ""))) {
    return { numbers: [], issue: "SCIENTIFIC" };
  }

  const numbers = text
    .split(/[,;|\n\r/]+/)
    .map((part) =>
      part
        .replace(/\.0+$/, "")
        .replace(/[^A-Za-z0-9]/g, "")
        .toUpperCase()
    )
    .filter((part) => /\d/.test(part) && part.length >= 6);

  return { numbers: Array.from(new Set(numbers)), issue: null };
}

/** ZIPs typed into numeric cells lose their leading zero (02134 → 2134). */
function toPostalCode(value: unknown): string {
  if (typeof value === "number" && Number.isInteger(value) && value > 0 && value < 100000) {
    return String(value).padStart(5, "0");
  }
  return cellToString(value);
}

/** Accepts real date cells, Excel serial numbers and date-like text. */
export function toIsoDate(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  if (typeof value === "number") {
    if (value > 20000 && value < 80000) {
      return new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000).toISOString();
    }
    return "";
  }
  const text = cellToString(value);
  if (!text) return "";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

/**
 * Parses an uploaded .xlsx/.csv buffer into shipment rows using
 * header-name detection (no manual column mapping).
 */
export function parseSpreadsheet(buffer: ArrayBuffer, fileName = ""): ParsedSpreadsheet {
  return parseSpreadsheetWorkbook(readWorkbook(buffer, fileName));
}

/** Same as parseSpreadsheet, for callers that already read the workbook. */
export function parseSpreadsheetWorkbook(workbook: XLSX.WorkBook): ParsedSpreadsheet {
  if (workbook.SheetNames.length === 0) {
    throw new ExcelParseError("The uploaded file contains no sheets.");
  }

  const header = findHeader(workbook);
  if (!header) {
    const first = readSheetRows(workbook, workbook.SheetNames[0], 1);
    const found = first?.rows[0]?.map((c) => cellToString(c)).filter(Boolean) ?? [];
    throw new ExcelParseError(
      found.length > 0
        ? `Could not find a "${FIELD_LABELS[REQUIRED_FIELD]}" column. Found headers: ${found.join(", ")}`
        : `Could not find a "${FIELD_LABELS[REQUIRED_FIELD]}" column in any sheet.`
    );
  }

  const { headerIndex, mapping } = header;
  const sheet = readSheetRows(workbook, header.sheet.sheetName) ?? header.sheet;
  const warnings: string[] = [];
  if (workbook.SheetNames.length > 1) {
    warnings.push(`Read shipments from sheet "${sheet.sheetName}".`);
  }
  for (const field of Object.keys(HEADER_ALIASES) as ExcelField[]) {
    if (field !== REQUIRED_FIELD && !SILENT_OPTIONAL_FIELDS.has(field) && mapping[field] === undefined) {
      warnings.push(`Column "${FIELD_LABELS[field]}" was not found; those values will be blank.`);
    }
  }

  const rows: ExcelShipmentRow[] = [];
  const missingRows: number[] = [];
  const scientificRows: number[] = [];
  const precisionRows: number[] = [];
  const multiRows: number[] = [];

  sheet.rows.slice(headerIndex + 1).forEach((raw, offset) => {
    const rowNumber = sheet.firstRow + headerIndex + offset + 2;
    if (raw.every((cell) => cellToString(cell) === "")) return;

    const cell = (field: ExcelField): unknown => {
      const index = mapping[field];
      return index === undefined ? "" : raw[index];
    };
    const get = (field: ExcelField) => cellToString(cell(field));

    const tracking = parseTrackingCell(cell("trackingNumber"));
    if (tracking.issue === "SCIENTIFIC") {
      scientificRows.push(rowNumber);
      return;
    }
    if (tracking.issue === "PRECISION") precisionRows.push(rowNumber);
    if (tracking.numbers.length === 0) {
      missingRows.push(rowNumber);
      return;
    }
    if (tracking.numbers.length > 1) multiRows.push(rowNumber);

    const deliverTo = get("deliverTo");
    for (const trackingNumber of tracking.numbers) {
      rows.push({
        rowNumber,
        trackingNumber,
        deliverTo,
        office: parseOffice(deliverTo),
        city: get("city"),
        state: get("state"),
        address: get("address"),
        carrier: get("carrier"),
        serialNumber: get("serialNumber"),
        assetName: get("assetName"),
        recipient: get("recipient"),
        postalCode: toPostalCode(cell("postalCode")),
        shipDate: toIsoDate(cell("shipDate")),
      });
    }
  });

  const scientificWarning = `Row${scientificRows.length === 1 ? "" : "s"} ${listRows(scientificRows)} skipped: the tracking number is shown in scientific notation (e.g. 8.73696E+11), so the real digits are lost. Format the column as Text in Excel, re-enter the numbers, and upload again.`;
  if (scientificRows.length > 0) warnings.push(scientificWarning);
  if (precisionRows.length > 0) {
    warnings.push(
      `Row${precisionRows.length === 1 ? "" : "s"} ${listRows(precisionRows)}: the tracking number is longer than Excel can store as a number and may have been rounded. Format the column as Text and re-enter it if tracking fails.`
    );
  }
  if (multiRows.length > 0) {
    warnings.push(
      `Row${multiRows.length === 1 ? "" : "s"} ${listRows(multiRows)} list${multiRows.length === 1 ? "s" : ""} more than one tracking number; each number is tracked as its own shipment.`
    );
  }
  if (rows.length === 0) {
    throw new ExcelParseError(
      scientificRows.length > 0
        ? scientificWarning
        : "No rows with a tracking number were found in the file."
    );
  }
  if (missingRows.length > 0) {
    warnings.push(
      `${missingRows.length} row${missingRows.length === 1 ? "" : "s"} skipped (missing tracking number): row${missingRows.length === 1 ? "" : "s"} ${listRows(missingRows)}.`
    );
  }

  return { rows, warnings, sheetName: sheet.sheetName };
}
