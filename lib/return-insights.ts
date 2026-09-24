import type { TrackingInfo } from "@/types/shipment";
import type { ReturnAsset } from "@/types/return-tracker";

/**
 * Live-state buckets for a return label. Unlike outbound shipments, a
 * DELIVERED return label is the *success* case — the old asset made it back
 * to the return destination (Insight/ITAM/etc.), so the buckets speak the
 * coordinators' language instead of reusing outbound status labels.
 */
export type ReturnLiveStatus =
  | "AWAITING_DROPOFF"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "EXCEPTION"
  | "NO_DATA";

export const RETURN_LIVE_LABELS: Record<ReturnLiveStatus, string> = {
  AWAITING_DROPOFF: "Awaiting Drop-off",
  IN_TRANSIT: "Return In Transit",
  DELIVERED: "Return Delivered",
  EXCEPTION: "Exception",
  NO_DATA: "No Carrier Data",
};

/**
 * A named category of sheet-vs-carrier mismatch. Grouping every row into one
 * of these (instead of showing free-form text per row) is what lets the KPI
 * strip say "42 ready to mark complete" instead of a wall of one-off notes.
 */
export type AttentionType =
  | "READY_TO_COMPLETE"
  | "ON_ITS_WAY"
  | "SHEET_SAYS_DONE"
  | "FAILED_RETURN"
  | "UNLOGGED_EXCEPTION"
  | "PREVIOUS_LABEL";

export const ATTENTION_TYPES: AttentionType[] = [
  "READY_TO_COMPLETE",
  "ON_ITS_WAY",
  "SHEET_SAYS_DONE",
  "FAILED_RETURN",
  "UNLOGGED_EXCEPTION",
  "PREVIOUS_LABEL",
];

/** Short label for KPI chips and table badges — the long sentence lives in `attention`. */
export const ATTENTION_LABELS: Record<AttentionType, string> = {
  READY_TO_COMPLETE: "Ready to mark complete",
  ON_ITS_WAY: "On its way — sheet is stale",
  SHEET_SAYS_DONE: "Sheet says done, carrier disagrees",
  FAILED_RETURN: "Return failed — coming back",
  UNLOGGED_EXCEPTION: "Exception not yet logged",
  PREVIOUS_LABEL: "Shipped on previous label",
};

export interface ReturnInsight {
  /** Which label actually shows carrier movement. */
  activeLabel: "current" | "previous";
  /** Tracking info for the active label. */
  activeTracking: TrackingInfo;
  live: ReturnLiveStatus;
  /** True when the user shipped on the older label instead of the current one. */
  shippedOnPreviousLabel: boolean;
  /** Which category of sheet-vs-carrier mismatch this row falls into, if any. */
  attentionType: AttentionType | null;
  /**
   * Sheet-vs-carrier mismatch that a coordinator should act on
   * (e.g. carrier says delivered but the sheet still says awaiting).
   */
  attention: string | null;
}

/** A label with any real scan activity (beyond just being created). */
function hasMovement(tracking: TrackingInfo | null): boolean {
  if (!tracking) return false;
  switch (tracking.status) {
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
    case "DELIVERED":
    case "EXCEPTION":
      return true;
    case "LABEL_CREATED":
    case "UNAVAILABLE":
    case "UNKNOWN":
      return (tracking.transitHistory?.length ?? 0) > 0;
    default: {
      const exhaustive: never = tracking.status;
      void exhaustive;
      return false;
    }
  }
}

function toLiveStatus(tracking: TrackingInfo): ReturnLiveStatus {
  switch (tracking.status) {
    case "DELIVERED":
      return "DELIVERED";
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
      return "IN_TRANSIT";
    case "EXCEPTION":
      return "EXCEPTION";
    case "LABEL_CREATED":
      return "AWAITING_DROPOFF";
    case "UNAVAILABLE":
    case "UNKNOWN": {
      // FedEx occasionally returns a status code this app doesn't recognize
      // (return labels see less common codes than outbound shipments), even
      // though the label has real scan history. Falling back to "no carrier
      // data" in that case buries genuine movement — only a label with zero
      // scans is actually unknown.
      const events = tracking.transitHistory ?? [];
      if (events.length === 0) return "NO_DATA";
      return events[0]?.isException ? "EXCEPTION" : "IN_TRANSIT";
    }
    default: {
      const exhaustive: never = tracking.status;
      void exhaustive;
      return "NO_DATA";
    }
  }
}

/**
 * Buckets the sheet's free-text Status column into the same shape as the
 * carrier's live status, so the two can be compared directly instead of only
 * checking for the word "awaiting" (which missed statuses like "Return In
 * Transit" — a real sheet value that isn't "awaiting" but also isn't done).
 */
export type SheetBucket =
  | "AWAITING"
  | "IN_TRANSIT"
  | "CLOSEOUT"
  | "COMPLETE"
  | "FLAGGED"
  | "UNKNOWN";

function classifySheetStatus(sheetStatus: string): SheetBucket {
  const text = sheetStatus.trim();
  if (!text) return "UNKNOWN";
  if (/complete/i.test(text)) return "COMPLETE";
  // v4's "Delivered – Closeout Pending": the asset is back, paperwork isn't done.
  if (/delivered|closeout/i.test(text)) return "CLOSEOUT";
  // The sheet's own "Needs Verification" / "Exception" / "Action Required" /
  // "Add Actual Return Destination" statuses mean a coordinator is already
  // on it — don't re-flag those as a new problem.
  if (/verification|exception|action required|^add /i.test(text)) return "FLAGGED";
  if (/transit/i.test(text)) return "IN_TRANSIT";
  if (/awaiting/i.test(text)) return "AWAITING";
  return "UNKNOWN";
}

export function deriveReturnInsight(asset: ReturnAsset): ReturnInsight {
  // If the current label shows no movement but the previous label does, the
  // user almost certainly shipped the asset on the older label — follow that
  // one instead of reporting the fresh label as "not shipped".
  const shippedOnPreviousLabel =
    !hasMovement(asset.tracking) && hasMovement(asset.previousTracking);
  const activeLabel = shippedOnPreviousLabel ? "previous" : "current";
  const activeTracking = shippedOnPreviousLabel
    ? (asset.previousTracking as TrackingInfo)
    : asset.tracking;

  // A carrier "return to shipper" event on a return label means the package
  // is coming back to the *user*, which is a failed return — treat as exception.
  let live: ReturnLiveStatus =
    activeTracking.isReturnToShipper && toLiveStatus(activeTracking) !== "NO_DATA"
      ? "EXCEPTION"
      : toLiveStatus(activeTracking);

  const sheetBucket = classifySheetStatus(asset.sheetStatus);

  // FedEx purges scan history on older labels, and ITAM/FS hand-offs never
  // use the label at all — so a sheet-completed return with a silent label is
  // a finished return, not one still awaiting drop-off.
  const sheetSaysReturned = sheetBucket === "COMPLETE" || sheetBucket === "CLOSEOUT";
  if (sheetSaysReturned && (live === "AWAITING_DROPOFF" || live === "NO_DATA")) {
    live = "DELIVERED";
  }

  let attentionType: AttentionType | null = null;
  let attention: string | null = null;

  if (sheetSaysReturned) {
    // Only an active contradiction flags a completed row — coordinators may
    // have closed it out via a manual channel (email confirmation, in-person
    // hand-off) the label never reflects, so anything short of a real
    // conflict (e.g. a silent "label created" label) is left alone.
    if (live === "EXCEPTION") {
      attentionType = "SHEET_SAYS_DONE";
      attention = `Sheet says "${asset.sheetStatus}", but the carrier reports an exception. Worth verifying.`;
    } else if (live === "IN_TRANSIT") {
      attentionType = "SHEET_SAYS_DONE";
      attention = `Sheet says "${asset.sheetStatus}", but the carrier still shows this label in transit. Worth verifying.`;
    } else if (sheetBucket === "CLOSEOUT") {
      attentionType = "READY_TO_COMPLETE";
      attention = `Return delivered — sheet says "${asset.sheetStatus}". Finish the closeout to mark it complete.`;
    }
  } else if (live === "DELIVERED") {
    // Covers every not-yet-complete sheet bucket — awaiting, in transit,
    // flagged, or blank — since a delivered carrier scan is new information
    // in all of those cases.
    attentionType = "READY_TO_COMPLETE";
    attention = `Carrier shows the return delivered, but the sheet still says "${asset.sheetStatus || "no status"}". Ready to mark complete.`;
  } else if (live === "IN_TRANSIT" && sheetBucket === "AWAITING") {
    attentionType = "ON_ITS_WAY";
    attention = `Package is on its way back — sheet still says "${asset.sheetStatus}".`;
  } else if (live === "EXCEPTION" && activeTracking.isReturnToShipper) {
    attentionType = "FAILED_RETURN";
    attention = "Carrier is routing the package back to the user — this return failed.";
  } else if (live === "EXCEPTION" && sheetBucket !== "FLAGGED") {
    attentionType = "UNLOGGED_EXCEPTION";
    attention = activeTracking.deliveryException
      ? `Carrier reports an exception ("${activeTracking.deliveryException}"), and the sheet doesn't reflect it yet.`
      : "Carrier reports an exception on this return label, and the sheet doesn't reflect it yet.";
  }

  if (!attentionType && shippedOnPreviousLabel) {
    attentionType = "PREVIOUS_LABEL";
    attention = "Shipped on the previous label — the current label was never used.";
  }

  return { activeLabel, activeTracking, live, shippedOnPreviousLabel, attentionType, attention };
}

const SHEET_BUCKET_CLASSES: Record<SheetBucket, string> = {
  CLOSEOUT: "bg-teal-500/10 text-teal-700 border-teal-500/25 dark:text-teal-300",
  COMPLETE: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
  IN_TRANSIT: "bg-blue-500/10 text-blue-700 border-blue-500/25 dark:text-blue-300",
  FLAGGED: "bg-red-500/10 text-red-700 border-red-500/25 dark:text-red-300",
  AWAITING: "bg-amber-500/12 text-amber-800 border-amber-500/25 dark:text-amber-300",
  UNKNOWN: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400",
};

/** Tailwind classes for the sheet-status chip, keyed by what the text implies. */
export function sheetStatusClasses(sheetStatus: string): string {
  return SHEET_BUCKET_CLASSES[classifySheetStatus(sheetStatus)];
}

export const RETURN_LIVE_BADGE_CLASSES: Record<ReturnLiveStatus, string> = {
  AWAITING_DROPOFF: "bg-amber-500/12 text-amber-800 border-amber-500/25 dark:text-amber-300",
  IN_TRANSIT: "bg-blue-500/10 text-blue-700 border-blue-500/25 dark:text-blue-300",
  DELIVERED: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
  EXCEPTION: "bg-red-500/10 text-red-700 border-red-500/25 dark:text-red-300",
  NO_DATA: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400",
};
