import { getAccessToken, getFedExBaseUrl } from "@/services/fedex/auth";
import { toCarrierCandidates, unavailableCandidates } from "@/services/fedex/normalize";
import type { FedExTrackResponse } from "@/services/fedex/types";
import type { CarrierCandidate } from "@/types/shipment";

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

async function trackOne(trackingNumber: string, token: string): Promise<CarrierCandidate[]> {
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
    return unavailableCandidates(
      trackingNumber,
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
    return unavailableCandidates(trackingNumber, message);
  }

  let body: FedExTrackResponse;
  try {
    body = await response.json();
  } catch {
    return unavailableCandidates(trackingNumber, "Invalid response from FedEx.");
  }

  // A recycled tracking number comes back as several trackResults — one per
  // shipment that has ever used it. Keep all of them so the caller can pick
  // the one that belongs to the spreadsheet row.
  const trackResults = (body.output?.completeTrackResults ?? []).flatMap(
    (complete) => complete.trackResults ?? []
  );

  if (trackResults.length === 0) {
    return unavailableCandidates(trackingNumber, "No tracking data returned for this number.");
  }

  return toCarrierCandidates(trackingNumber, trackResults);
}

/**
 * Fetches live tracking for every unique tracking number using one request
 * each, processed MAX_CONCURRENT at a time. Individual failures are recorded
 * as UNAVAILABLE and never abort the rest.
 */
export async function trackShipments(
  trackingNumbers: string[]
): Promise<Map<string, CarrierCandidate[]>> {
  const unique = Array.from(new Set(trackingNumbers.filter(Boolean)));
  const token = await getAccessToken();
  const results = new Map<string, CarrierCandidate[]>();

  for (const batch of chunk(unique, MAX_CONCURRENT)) {
    const settled = await Promise.allSettled(batch.map((num) => trackOne(num, token)));
    settled.forEach((outcome, i) => {
      results.set(
        batch[i],
        outcome.status === "fulfilled"
          ? outcome.value
          : unavailableCandidates(
              batch[i],
              outcome.reason instanceof Error
                ? outcome.reason.message
                : "FedEx tracking request failed."
            )
      );
    });
  }

  return results;
}
