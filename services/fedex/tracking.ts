import { getAccessToken, getFedExBaseUrl } from "@/services/fedex/auth";
import {
  normalizeTrackResult,
  unavailableTracking,
} from "@/services/fedex/normalize";
import type { FedExTrackResponse } from "@/services/fedex/types";
import type { TrackingInfo } from "@/types/shipment";

/**
 * Max concurrent FedEx Track API calls.
 *
 * NOTE: These credentials only support single-number requests (the API returns
 * empty trackResults for batches of 2+). We compensate with high concurrency
 * so 800–900 numbers resolve in ~25 seconds.
 */
const MAX_CONCURRENT = 25;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function trackOne(
  trackingNumber: string,
  token: string
): Promise<TrackingInfo> {
  let response: Response;
  try {
    response = await fetch(`${getFedExBaseUrl()}/track/v1/trackingnumbers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-locale": "en_US",
      },
      body: JSON.stringify({
        includeDetailedScans: true,
        trackingInfo: [{ trackingNumberInfo: { trackingNumber } }],
      }),
      cache: "no-store",
    });
  } catch (err) {
    return unavailableTracking(
      err instanceof Error ? err.message : "Network error reaching FedEx."
    );
  }

  if (!response.ok) {
    let message = `FedEx API error (HTTP ${response.status}).`;
    try {
      const body: FedExTrackResponse = await response.json();
      message = body.errors?.[0]?.message ?? message;
    } catch {
      // keep default
    }
    return unavailableTracking(message);
  }

  let body: FedExTrackResponse;
  try {
    body = await response.json();
  } catch {
    return unavailableTracking("Invalid response from FedEx.");
  }

  // The API returns completeTrackResults[0].trackResults[0] for a single number.
  const trackResult =
    body.output?.completeTrackResults?.[0]?.trackResults?.[0];

  if (!trackResult) {
    return unavailableTracking("No tracking data returned for this number.");
  }

  return normalizeTrackResult(trackResult);
}

/**
 * Fetches live tracking for every unique tracking number using one request
 * each, processed MAX_CONCURRENT at a time. Individual failures are recorded
 * as UNAVAILABLE and never abort the rest.
 */
export async function trackShipments(
  trackingNumbers: string[]
): Promise<Map<string, TrackingInfo>> {
  const unique = Array.from(new Set(trackingNumbers.filter(Boolean)));
  const token = await getAccessToken();
  const results = new Map<string, TrackingInfo>();

  for (const batch of chunk(unique, MAX_CONCURRENT)) {
    const settled = await Promise.allSettled(
      batch.map((num) => trackOne(num, token))
    );
    settled.forEach((outcome, i) => {
      results.set(
        batch[i],
        outcome.status === "fulfilled"
          ? outcome.value
          : unavailableTracking(
              outcome.reason instanceof Error
                ? outcome.reason.message
                : "FedEx tracking request failed."
            )
      );
    });
  }

  return results;
}
