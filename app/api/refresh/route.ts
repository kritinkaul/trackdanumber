import { NextResponse } from "next/server";

import { FedExAuthError } from "@/services/fedex/auth";
import { trackShipments } from "@/services/fedex/tracking";
import { MAX_TRACKING_NUMBERS } from "@/lib/upload-payload";
import type { CarrierCandidate, RefreshResponse } from "@/types/shipment";

export const runtime = "nodejs";
// Return-tracker refreshes can carry ~1,000+ labels at single-number
// concurrency, so allow the full Fluid Compute window.
export const maxDuration = 300;

export async function POST(request: Request): Promise<NextResponse> {
  let trackingNumbers: string[];
  try {
    const body = await request.json();
    trackingNumbers = Array.isArray(body?.trackingNumbers)
      ? body.trackingNumbers.filter((n: unknown): n is string => typeof n === "string" && n !== "")
      : [];
  } catch {
    trackingNumbers = [];
  }

  if (trackingNumbers.length === 0) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "No tracking numbers provided." },
      { status: 400 }
    );
  }
  if (new Set(trackingNumbers).size > MAX_TRACKING_NUMBERS) {
    return NextResponse.json(
      {
        error: "TOO_MANY_ROWS",
        message: `Refresh is limited to ${MAX_TRACKING_NUMBERS.toLocaleString()} tracking numbers at a time.`,
      },
      { status: 413 }
    );
  }

  try {
    const trackingMap = await trackShipments(trackingNumbers);
    const tracking: Record<string, CarrierCandidate[]> = {};
    trackingMap.forEach((candidates, num) => {
      tracking[num] = candidates;
    });
    const body: RefreshResponse = { tracking };
    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof FedExAuthError) {
      return NextResponse.json(
        { error: "FEDEX_AUTH_ERROR", message: err.message },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "FEDEX_ERROR", message: "Failed to refresh tracking data from FedEx." },
      { status: 502 }
    );
  }
}
