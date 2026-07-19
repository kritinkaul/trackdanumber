import { mapFedExStatusCode, STATUS_LABELS } from "@/lib/status";
import type { ScanEvent, TrackingInfo } from "@/types/shipment";
import type {
  FedExScanLocation,
  FedExTrackResult,
} from "@/services/fedex/types";

function formatLocation(location: FedExScanLocation | undefined): string | null {
  if (!location) return null;
  const parts = [location.city, location.stateOrProvinceCode].filter(Boolean);
  // Require at least a city or state — bare country codes ("US") aren't meaningful.
  if (parts.length === 0) return null;
  const base = parts.join(", ");
  return location.countryCode && location.countryCode !== "US"
    ? `${base}, ${location.countryCode}`
    : base;
}

function pickEstimatedDelivery(result: FedExTrackResult): string | null {
  const windowEnd =
    result.estimatedDeliveryTimeWindow?.window?.ends ??
    result.standardTransitTimeWindow?.window?.ends;
  if (windowEnd) return windowEnd;

  const dateEntry = result.dateAndTimes?.find(
    (d) => d.type === "ESTIMATED_DELIVERY" || d.type === "ACTUAL_DELIVERY"
  );
  return dateEntry?.dateTime ?? null;
}

function toScanEvents(result: FedExTrackResult): ScanEvent[] {
  const events = (result.scanEvents ?? [])
    .filter((e) => e.date)
    .map((e) => ({
      timestamp: e.date as string,
      description: e.eventDescription ?? e.derivedStatus ?? "Scan event",
      location: formatLocation(e.scanLocation) ?? "—",
      eventType: e.eventType ?? "",
      isException: Boolean(e.exceptionCode || e.exceptionDescription),
    }));
  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/** Pulls a return tracking number out of free-text carrier messages, if present. */
function extractReturnTracking(candidates: (string | null | undefined)[]): string | null {
  const re = /return\s+tracking\s+(?:number|no\.?|#)?\s*:?\s*([0-9](?:[0-9\s]{7,}[0-9]))/i;
  for (const text of candidates) {
    if (!text) continue;
    const match = text.match(re);
    if (match) return match[1].replace(/\s+/g, "");
  }
  return null;
}

/** Detects language indicating the package is heading back to the shipper. */
function detectReturnToShipper(candidates: (string | null | undefined)[]): boolean {
  return candidates.some(
    (text) => !!text && /return(?:ing|ed)?\s+to\s+(?:shipper|sender|origin)/i.test(text)
  );
}

/** Removes a "Return tracking number ####" sentence so it isn't shown twice. */
function stripReturnTrackingSentence(text: string): string {
  return text
    .replace(/return\s+tracking\s+(?:number|no\.?|#)?\s*:?\s*[0-9][0-9\s]{7,}[0-9]/i, "")
    // Collapse punctuation/space left behind (e.g. "exception. . Being" → "exception. Being").
    .replace(/([.,;:])\s*(?=[.,;:])/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s.,;:]+|[\s,;:]+$/g, "")
    .trim();
}

export function unavailableTracking(errorMessage: string): TrackingInfo {
  return {
    status: "UNAVAILABLE",
    statusDescription: STATUS_LABELS.UNAVAILABLE,
    currentLocation: null,
    origin: null,
    estimatedDelivery: null,
    lastScanTime: null,
    serviceType: null,
    deliveryException: null,
    isReturnToShipper: false,
    returnTrackingNumber: null,
    errorMessage,
  };
}

/** Converts one raw FedEx trackResult into the app's TrackingInfo shape. */
export function normalizeTrackResult(result: FedExTrackResult): TrackingInfo {
  if (result.error) {
    return unavailableTracking(result.error.message ?? "Tracking information unavailable.");
  }

  const latest = result.latestStatusDetail;
  const status = mapFedExStatusCode(latest?.derivedCode ?? latest?.code);
  const transitHistory = toScanEvents(result);

  const origin =
    formatLocation(result.originLocation?.locationContactAndAddress?.address) ??
    formatLocation(result.shipperInformation?.address) ??
    (transitHistory.length > 0 ? transitHistory[transitHistory.length - 1].location : null);

  const exceptionDetail = latest?.ancillaryDetails?.find(
    (d) => d.reasonDescription || d.actionDescription
  );
  const exceptionScan = transitHistory.find((e) => e.isException);
  const rawException =
    status === "EXCEPTION"
      ? exceptionDetail?.reasonDescription ??
        exceptionScan?.description ??
        latest?.description ??
        "Delivery exception reported."
      : null;

  // Return info can live in the exception text, ancillary details, or scan events.
  const returnCandidates = [
    rawException,
    exceptionDetail?.actionDescription,
    exceptionDetail?.reasonDescription,
    latest?.description,
    ...transitHistory.map((e) => e.description),
  ];
  const returnTrackingNumber = extractReturnTracking(returnCandidates);
  const isReturnToShipper =
    returnTrackingNumber !== null || detectReturnToShipper(returnCandidates);

  // Avoid repeating the return tracking number inside the exception message.
  let deliveryException = rawException;
  if (deliveryException && returnTrackingNumber) {
    const stripped = stripReturnTrackingSentence(deliveryException);
    deliveryException = stripped.length > 0 ? stripped : null;
  }

  return {
    status,
    statusDescription: latest?.statusByLocale ?? latest?.description ?? STATUS_LABELS[status],
    currentLocation: formatLocation(latest?.scanLocation),
    origin,
    estimatedDelivery: pickEstimatedDelivery(result),
    lastScanTime: transitHistory[0]?.timestamp ?? null,
    serviceType: result.serviceDetail?.description ?? result.serviceDetail?.type ?? null,
    deliveryException,
    isReturnToShipper,
    returnTrackingNumber,
    ...(transitHistory.length > 0 ? { transitHistory } : {}),
  };
}
