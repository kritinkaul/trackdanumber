import { NextResponse } from "next/server";

import { ExcelParseError, parseSpreadsheet } from "@/lib/excel-parser";
import { FedExAuthError } from "@/services/fedex/auth";
import { unavailableTracking } from "@/services/fedex/normalize";
import { trackShipments } from "@/services/fedex/tracking";
import type { Shipment, UploadResponse } from "@/types/shipment";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request): Promise<NextResponse> {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "No file was uploaded." },
      { status: 400 }
    );
  }

  let parsed;
  try {
    parsed = parseSpreadsheet(await file.arrayBuffer());
  } catch (err) {
    const message =
      err instanceof ExcelParseError ? err.message : "Failed to parse the uploaded file.";
    return NextResponse.json({ error: "PARSE_ERROR", message }, { status: 400 });
  }

  let trackingMap;
  try {
    trackingMap = await trackShipments(parsed.rows.map((r) => r.trackingNumber));
  } catch (err) {
    if (err instanceof FedExAuthError) {
      return NextResponse.json(
        { error: "FEDEX_AUTH_ERROR", message: err.message },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "FEDEX_ERROR", message: "Failed to retrieve tracking data from FedEx." },
      { status: 502 }
    );
  }

  const shipments: Shipment[] = parsed.rows.map((row, index) => ({
    ...row,
    id: `${row.trackingNumber}-${index}`,
    tracking:
      trackingMap.get(row.trackingNumber) ??
      unavailableTracking("No tracking data returned for this number."),
  }));

  const body: UploadResponse = { shipments, warnings: parsed.warnings };
  return NextResponse.json(body);
}
