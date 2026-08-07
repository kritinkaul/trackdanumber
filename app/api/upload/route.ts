import { NextResponse } from "next/server";

import { ExcelParseError, parseSpreadsheetWorkbook, readWorkbook } from "@/lib/excel-parser";
import { isReturnTrackerWorkbook, parseReturnTracker } from "@/lib/return-tracker-parser";
import { FedExAuthError } from "@/services/fedex/auth";
import { unavailableTracking } from "@/services/fedex/normalize";
import { trackShipments } from "@/services/fedex/tracking";
import type { ReturnAsset, ReturnsUploadResponse } from "@/types/return-tracker";
import type { Shipment, UploadResponse } from "@/types/shipment";

export const runtime = "nodejs";
export const maxDuration = 300;

function fedExErrorResponse(err: unknown): NextResponse {
  if (err instanceof FedExAuthError) {
    return NextResponse.json({ error: "FEDEX_AUTH_ERROR", message: err.message }, { status: 502 });
  }
  return NextResponse.json(
    { error: "FEDEX_ERROR", message: "Failed to retrieve tracking data from FedEx." },
    { status: 502 }
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "No file was uploaded." },
      { status: 400 }
    );
  }

  let workbook;
  try {
    workbook = readWorkbook(await file.arrayBuffer());
  } catch (err) {
    const message =
      err instanceof ExcelParseError ? err.message : "Failed to parse the uploaded file.";
    return NextResponse.json({ error: "PARSE_ERROR", message }, { status: 400 });
  }

  // The Zero Touch Return Tracker workbook is detected by its sheet headers
  // and gets its own flow; everything else follows the shipment manifest path.
  if (isReturnTrackerWorkbook(workbook)) {
    let parsed;
    try {
      parsed = parseReturnTracker(workbook);
    } catch {
      return NextResponse.json(
        { error: "PARSE_ERROR", message: "Failed to parse the return tracker sheet." },
        { status: 400 }
      );
    }
    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { error: "PARSE_ERROR", message: "No assets with a return tracking number were found." },
        { status: 400 }
      );
    }

    // Track current and previous labels together — assets where the user
    // shipped on the older label only show movement there.
    const numbers = parsed.rows.flatMap((row) =>
      row.previousReturnTrackingNumber
        ? [row.returnTrackingNumber, row.previousReturnTrackingNumber]
        : [row.returnTrackingNumber]
    );

    let trackingMap;
    try {
      trackingMap = await trackShipments(numbers);
    } catch (err) {
      return fedExErrorResponse(err);
    }

    const assets: ReturnAsset[] = parsed.rows.map((row, index) => ({
      ...row,
      id: `${row.serialNumber}-${index}`,
      tracking:
        trackingMap.get(row.returnTrackingNumber) ??
        unavailableTracking("No tracking data returned for this number."),
      previousTracking: row.previousReturnTrackingNumber
        ? trackingMap.get(row.previousReturnTrackingNumber) ??
          unavailableTracking("No tracking data returned for this number.")
        : null,
    }));

    const body: ReturnsUploadResponse = { kind: "returns", assets, warnings: parsed.warnings };
    return NextResponse.json(body);
  }

  let parsed;
  try {
    parsed = parseSpreadsheetWorkbook(workbook);
  } catch (err) {
    const message =
      err instanceof ExcelParseError ? err.message : "Failed to parse the uploaded file.";
    return NextResponse.json({ error: "PARSE_ERROR", message }, { status: 400 });
  }

  let trackingMap;
  try {
    trackingMap = await trackShipments(parsed.rows.map((r) => r.trackingNumber));
  } catch (err) {
    return fedExErrorResponse(err);
  }

  const shipments: Shipment[] = parsed.rows.map((row, index) => ({
    ...row,
    id: `${row.trackingNumber}-${index}`,
    tracking:
      trackingMap.get(row.trackingNumber) ??
      unavailableTracking("No tracking data returned for this number."),
  }));

  const body: UploadResponse & { kind: "shipments" } = {
    kind: "shipments",
    shipments,
    warnings: parsed.warnings,
  };
  return NextResponse.json(body);
}
