import { NextResponse } from "next/server";

import { ExcelParseError, parseSpreadsheetWorkbook, readWorkbook } from "@/lib/excel-parser";
import { isReturnTrackerWorkbook, parseReturnTracker } from "@/lib/return-tracker-parser";
import {
  assembleReturnAssets,
  assembleShipments,
  summarizeDuplicates,
} from "@/lib/shipment-assembly";
import {
  MAX_TRACKING_NUMBERS,
  sanitizeReturnRows,
  sanitizeShipmentRows,
  sanitizeWarnings,
} from "@/lib/upload-payload";
import { FedExAuthError } from "@/services/fedex/auth";
import { unavailableCandidates } from "@/services/fedex/normalize";
import { trackShipments } from "@/services/fedex/tracking";
import type { ReturnAssetRow, ReturnsUploadResponse } from "@/types/return-tracker";
import type { CarrierCandidate, ExcelShipmentRow, UploadResponse } from "@/types/shipment";

export const runtime = "nodejs";
export const maxDuration = 300;

type ParsedInput =
  | { kind: "shipments"; rows: ExcelShipmentRow[]; warnings: string[] }
  | { kind: "returns"; rows: ReturnAssetRow[]; warnings: string[] };

function parseError(message: string): NextResponse {
  return NextResponse.json({ error: "PARSE_ERROR", message }, { status: 400 });
}

function fedExErrorResponse(err: unknown): NextResponse {
  if (err instanceof FedExAuthError) {
    return NextResponse.json({ error: "FEDEX_AUTH_ERROR", message: err.message }, { status: 502 });
  }
  return NextResponse.json(
    { error: "FEDEX_ERROR", message: "Failed to retrieve tracking data from FedEx." },
    { status: 502 }
  );
}

/** Legacy path: the raw file posted as multipart form data (kept for scripts / API clients). */
async function parseMultipart(request: Request): Promise<ParsedInput | NextResponse> {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "No file was uploaded." },
      { status: 400 }
    );
  }
  try {
    const workbook = readWorkbook(await file.arrayBuffer(), file.name);
    if (isReturnTrackerWorkbook(workbook)) {
      const parsed = parseReturnTracker(workbook);
      return { kind: "returns", rows: parsed.rows, warnings: parsed.warnings };
    }
    const parsed = parseSpreadsheetWorkbook(workbook);
    return { kind: "shipments", rows: parsed.rows, warnings: parsed.warnings };
  } catch (err) {
    return parseError(
      err instanceof ExcelParseError ? err.message : "Failed to parse the uploaded file."
    );
  }
}

/** Default path: the browser already parsed the sheet and posts the rows as JSON. */
async function parseJson(request: Request): Promise<ParsedInput | NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return parseError("The upload payload was not valid JSON.");
  }
  const payload = (body ?? {}) as { kind?: unknown; rows?: unknown; warnings?: unknown };
  const warnings = sanitizeWarnings(payload.warnings);
  if (payload.kind === "returns") {
    return { kind: "returns", rows: sanitizeReturnRows(payload.rows), warnings };
  }
  return { kind: "shipments", rows: sanitizeShipmentRows(payload.rows), warnings };
}

export async function POST(request: Request): Promise<NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";
  const input = contentType.includes("multipart/form-data")
    ? await parseMultipart(request)
    : await parseJson(request);
  if (input instanceof NextResponse) return input;

  if (input.rows.length === 0) {
    return parseError(
      input.kind === "returns"
        ? "No assets with a return tracking number were found."
        : "No rows with a tracking number were found in the file."
    );
  }

  const numbers =
    input.kind === "returns"
      ? input.rows.flatMap((row) =>
          row.previousReturnTrackingNumber
            ? [row.returnTrackingNumber, row.previousReturnTrackingNumber]
            : [row.returnTrackingNumber]
        )
      : input.rows.map((row) => row.trackingNumber);

  const uniqueCount = new Set(numbers).size;
  if (uniqueCount > MAX_TRACKING_NUMBERS) {
    return NextResponse.json(
      {
        error: "TOO_MANY_ROWS",
        message: `The file has ${uniqueCount.toLocaleString()} tracking numbers; the limit per upload is ${MAX_TRACKING_NUMBERS.toLocaleString()}. Split the file and upload the parts separately.`,
      },
      { status: 413 }
    );
  }

  let trackingMap: Map<string, CarrierCandidate[]>;
  try {
    trackingMap = await trackShipments(numbers);
  } catch (err) {
    return fedExErrorResponse(err);
  }
  const lookup = (trackingNumber: string) =>
    trackingMap.get(trackingNumber) ??
    unavailableCandidates(trackingNumber, "No tracking data returned for this number.");

  if (input.kind === "returns") {
    const assets = assembleReturnAssets(
      input.rows.map((row, index) => ({ ...row, id: `${row.serialNumber}-${index}` })),
      lookup
    );
    const body: ReturnsUploadResponse = { kind: "returns", assets, warnings: input.warnings };
    return NextResponse.json(body);
  }

  const shipments = assembleShipments(
    input.rows.map((row, index) => ({ ...row, id: `${row.trackingNumber}-${index}` })),
    lookup
  );
  const body: UploadResponse & { kind: "shipments" } = {
    kind: "shipments",
    shipments,
    warnings: [...input.warnings, ...summarizeDuplicates(shipments)],
  };
  return NextResponse.json(body);
}
