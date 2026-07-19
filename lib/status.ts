import type { ShipmentStatus } from "@/types/shipment";

/** Maps FedEx latestStatusDetail codes to app-level statuses. */
const FEDEX_CODE_TO_STATUS: Record<string, ShipmentStatus> = {
  DL: "DELIVERED",
  OD: "OUT_FOR_DELIVERY",
  IT: "IN_TRANSIT",
  DP: "IN_TRANSIT",
  AR: "IN_TRANSIT",
  PU: "IN_TRANSIT",
  AF: "IN_TRANSIT",
  CD: "IN_TRANSIT",
  EO: "IN_TRANSIT",
  AP: "IN_TRANSIT",
  HL: "IN_TRANSIT",
  DE: "EXCEPTION",
  DY: "EXCEPTION",
  SE: "EXCEPTION",
  CA: "EXCEPTION",
  RS: "EXCEPTION",
  OC: "LABEL_CREATED",
  IN: "LABEL_CREATED",
};

export function mapFedExStatusCode(code: string | undefined): ShipmentStatus {
  if (!code) return "UNKNOWN";
  return FEDEX_CODE_TO_STATUS[code.toUpperCase()] ?? "UNKNOWN";
}

export const STATUS_LABELS: Record<ShipmentStatus, string> = {
  DELIVERED: "Delivered",
  OUT_FOR_DELIVERY: "Out for Delivery",
  IN_TRANSIT: "In Transit",
  EXCEPTION: "Exception",
  LABEL_CREATED: "Label Created",
  UNAVAILABLE: "Unavailable",
  UNKNOWN: "Unknown",
};

/** Tailwind classes for the status badge in tables/cards. */
export const STATUS_BADGE_CLASSES: Record<ShipmentStatus, string> = {
  DELIVERED:
    "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
  OUT_FOR_DELIVERY: "bg-blue-500/10 text-blue-700 border-blue-500/25 dark:text-blue-300",
  IN_TRANSIT: "bg-amber-500/12 text-amber-800 border-amber-500/25 dark:text-amber-300",
  EXCEPTION: "bg-red-500/10 text-red-700 border-red-500/25 dark:text-red-300",
  LABEL_CREATED: "bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-300",
  UNAVAILABLE: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400",
  UNKNOWN: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400",
};

export const ALL_STATUSES: ShipmentStatus[] = [
  "DELIVERED",
  "OUT_FOR_DELIVERY",
  "IN_TRANSIT",
  "EXCEPTION",
  "LABEL_CREATED",
  "UNAVAILABLE",
  "UNKNOWN",
];
