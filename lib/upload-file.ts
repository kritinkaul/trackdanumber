import {
  ACCEPTED_EXTENSIONS,
  ExcelParseError,
  parseSpreadsheetWorkbook,
  readWorkbook,
} from "@/lib/excel-parser";
import { isReturnTrackerWorkbook, parseReturnTracker } from "@/lib/return-tracker-parser";
import type { ReturnAssetRow } from "@/types/return-tracker";
import type { ExcelShipmentRow } from "@/types/shipment";

/** Browser memory, not the network, is the constraint once parsing happens client-side. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

export type ParsedUpload =
  | { kind: "shipments"; rows: ExcelShipmentRow[]; warnings: string[] }
  | { kind: "returns"; rows: ReturnAssetRow[]; warnings: string[] };

export function isAcceptedFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

async function readFileBytes(file: File): Promise<ArrayBuffer> {
  try {
    return await file.arrayBuffer();
  } catch {
    // Windows locks workbooks that are open in Excel, and OneDrive/SharePoint
    // placeholders aren't readable until they finish downloading.
    throw new ExcelParseError(
      `"${file.name}" couldn't be read. If it's open in Excel or still syncing from OneDrive/SharePoint, close it or wait for the sync to finish, then try again.`
    );
  }
}

/**
 * Reads and parses an uploaded spreadsheet in the browser. Parsing here
 * (instead of posting the raw file) avoids server request-size limits —
 * Vercel functions cap bodies at 4.5 MB and the auth proxy buffers only
 * 10 MB — which otherwise truncate larger workbooks into "unreadable" files.
 */
export async function parseUploadFile(file: File): Promise<ParsedUpload> {
  if (!isAcceptedFileName(file.name)) {
    throw new ExcelParseError(
      `"${file.name}" is not a supported file. Upload an Excel (.xlsx, .xls) or CSV file.`
    );
  }
  if (file.size === 0) {
    throw new ExcelParseError(`"${file.name}" is empty.`);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ExcelParseError(
      `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(0)} MB — too large to process. Remove unused sheets or save only the shipment sheet, then upload again.`
    );
  }
  if (file.name.startsWith("~$")) {
    throw new ExcelParseError(
      `"${file.name}" is Excel's temporary lock file, not the workbook. Upload the file without the "~$" prefix.`
    );
  }

  const workbook = readWorkbook(await readFileBytes(file), file.name);

  if (isReturnTrackerWorkbook(workbook)) {
    const parsed = parseReturnTracker(workbook);
    if (parsed.rows.length === 0) {
      throw new ExcelParseError("No assets with a return tracking number were found.");
    }
    return { kind: "returns", rows: parsed.rows, warnings: parsed.warnings };
  }

  const parsed = parseSpreadsheetWorkbook(workbook);
  return { kind: "shipments", rows: parsed.rows, warnings: parsed.warnings };
}
