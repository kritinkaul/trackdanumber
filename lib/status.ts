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
  DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  OUT_FOR_DELIVERY: "bg-blue-50 text-blue-700 border-blue-200",
  IN_TRANSIT: "bg-amber-50 text-amber-700 border-amber-200",
  EXCEPTION: "bg-red-50 text-red-700 border-red-200",
  LABEL_CREATED: "bg-slate-100 text-slate-600 border-slate-200",
  UNAVAILABLE: "bg-slate-100 text-slate-500 border-slate-200",
  UNKNOWN: "bg-slate-100 text-slate-500 border-slate-200",
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
