import * as XLSX from "xlsx";

import {
  ExcelField,
  FIELD_LABELS,
  HEADER_ALIASES,
  REQUIRED_FIELD,
} from "@/lib/header-aliases";
import type { ExcelShipmentRow } from "@/types/shipment";

export class ExcelParseError extends Error {}

export interface ParsedSpreadsheet {
  rows: ExcelShipmentRow[];
  warnings: string[];
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchHeaders(headers: string[]): Partial<Record<ExcelField, string>> {
  const mapping: Partial<Record<ExcelField, string>> = {};
  const claimed = new Set<string>();

  for (const field of Object.keys(HEADER_ALIASES) as ExcelField[]) {
    const aliases = HEADER_ALIASES[field];
    // Exact alias match first, then prefix match (e.g. "Tracking Number (FedEx)").
    const exact = headers.find(
      (h) => !claimed.has(h) && aliases.includes(normalizeHeader(h))
    );
    const prefix = headers.find(
      (h) =>
        !claimed.has(h) &&
        aliases.some((a) => normalizeHeader(h).startsWith(a))
    );
    const match = exact ?? prefix;
    if (match) {
      mapping[field] = match;
      claimed.add(match);
    }
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

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    // Long tracking numbers can arrive as numbers; avoid scientific notation.
    return Number.isInteger(value) ? BigInt(Math.round(value)).toString() : String(value);
  }
  return String(value).trim();
}

/**
 * Parses an uploaded .xlsx/.csv buffer into shipment rows using
 * header-name detection (no manual column mapping).
 */
export function parseSpreadsheet(buffer: ArrayBuffer): ParsedSpreadsheet {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array" });
  } catch {
    throw new ExcelParseError("Could not read the file. Please upload a valid .xlsx or .csv file.");
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new ExcelParseError("The uploaded file contains no sheets.");
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[sheetName],
    { defval: "", raw: true }
  );
  if (rawRows.length === 0) {
    throw new ExcelParseError("The uploaded file contains no data rows.");
  }

  const headers = Object.keys(rawRows[0]);
  const mapping = matchHeaders(headers);

  if (!mapping[REQUIRED_FIELD]) {
    throw new ExcelParseError(
      `Could not find a "${FIELD_LABELS[REQUIRED_FIELD]}" column. Found headers: ${headers.join(", ")}`
    );
  }

  const warnings: string[] = [];
  for (const field of Object.keys(HEADER_ALIASES) as ExcelField[]) {
    if (field !== REQUIRED_FIELD && !mapping[field]) {
      warnings.push(`Column "${FIELD_LABELS[field]}" was not found; those values will be blank.`);
    }
  }

  const rows: ExcelShipmentRow[] = [];
  let skipped = 0;

  rawRows.forEach((raw) => {
    const get = (field: ExcelField) => {
      const header = mapping[field];
      return header ? cellToString(raw[header]) : "";
    };

    const trackingNumber = get("trackingNumber").replace(/\s+/g, "");
    if (!trackingNumber) {
      skipped += 1;
      return;
    }

    const deliverTo = get("deliverTo");
    rows.push({
      trackingNumber,
      deliverTo,
      office: parseOffice(deliverTo),
      city: get("city"),
      state: get("state"),
      address: get("address"),
      carrier: get("carrier"),
    });
  });

  if (rows.length === 0) {
    throw new ExcelParseError("No rows with a tracking number were found in the file.");
  }
  if (skipped > 0) {
    warnings.push(`${skipped} row${skipped === 1 ? "" : "s"} skipped (missing tracking number).`);
  }

  return { rows, warnings };
}
