import { NextResponse } from "next/server";

import { FedExAuthError } from "@/services/fedex/auth";
import { trackShipments } from "@/services/fedex/tracking";
import type { RefreshResponse, TrackingInfo } from "@/types/shipment";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request): Promise<NextResponse> {
  let trackingNumbers: string[];
  try {
    const body = await request.json();
    trackingNumbers = Array.isArray(body?.trackingNumbers) ? body.trackingNumbers : [];
  } catch {
    trackingNumbers = [];
  }

  if (trackingNumbers.length === 0) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "No tracking numbers provided." },
      { status: 400 }
    );
  }

  try {
    const trackingMap = await trackShipments(trackingNumbers);
    const tracking: Record<string, TrackingInfo> = {};
    trackingMap.forEach((info, num) => {
      tracking[num] = info;
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
