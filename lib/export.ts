import { STATUS_LABELS } from "@/lib/status";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ShipmentFilters } from "@/hooks/useShipments";
import type { Shipment } from "@/types/shipment";

/** Escapes a value for CSV (quotes, commas, newlines) and guards against formula injection. */
function csvCell(value: string): string {
  // Prefix values starting with =, +, -, @ so Excel doesn't execute them as formulas.
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

const EXPORT_COLUMNS: { header: string; value: (s: Shipment) => string }[] = [
  { header: "Tracking Number", value: (s) => s.trackingNumber },
  { header: "Deliver To", value: (s) => s.deliverTo },
  { header: "Recipient", value: (s) => s.recipient },
  { header: "Status", value: (s) => STATUS_LABELS[s.tracking.status] },
  { header: "Status Detail", value: (s) => s.tracking.statusDescription },
  { header: "City", value: (s) => s.city },
  { header: "State", value: (s) => s.state },
  { header: "Address", value: (s) => s.address },
  { header: "Office", value: (s) => s.office ?? "" },
  { header: "Carrier", value: (s) => s.carrier },
  { header: "Service", value: (s) => s.tracking.serviceType ?? "" },
  { header: "Current Location", value: (s) => s.tracking.currentLocation ?? "" },
  {
    header: "Estimated Delivery",
    value: (s) => (s.tracking.estimatedDelivery ? formatDate(s.tracking.estimatedDelivery) : ""),
  },
  {
    header: "Last Scan",
    value: (s) => (s.tracking.lastScanTime ? formatDateTime(s.tracking.lastScanTime) : ""),
  },
  { header: "Asset Name", value: (s) => s.assetName },
  { header: "Serial Number", value: (s) => s.serialNumber },
  {
    header: "Returning to Shipper",
    value: (s) => (s.tracking.isReturnToShipper ? "Yes" : ""),
  },
  { header: "Return Tracking Number", value: (s) => s.tracking.returnTrackingNumber ?? "" },
];

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** e.g. "shipments-out-for-delivery-am-houston-tx-2026-07-09.csv" */
export function buildExportFilename(filters: ShipmentFilters): string {
  const parts = ["shipments"];
  if (filters.status === "NO_STATUS") {
    parts.push(slug("no-status"));
  } else if (filters.status === "RETURN_TO_SHIPPER") {
    parts.push(slug("returning"));
  } else if (filters.status !== "all") {
    parts.push(slug(STATUS_LABELS[filters.status]));
  }
  if (filters.office !== "all") parts.push(slug(filters.office));
  if (filters.city !== "all") parts.push(slug(filters.city));
  if (filters.state !== "all") parts.push(slug(filters.state));
  if (filters.carrier !== "all") parts.push(slug(filters.carrier));
  parts.push(new Date().toISOString().slice(0, 10));
  return `${parts.join("-")}.csv`;
}

/** Builds the CSV text for the given (already filtered) shipments. */
export function buildShipmentsCsv(shipments: Shipment[]): string {
  const header = EXPORT_COLUMNS.map((c) => csvCell(c.header)).join(",");
  const rows = shipments.map((s) =>
    EXPORT_COLUMNS.map((c) => csvCell(c.value(s))).join(",")
  );
  return [header, ...rows].join("\r\n");
}

/** Triggers a browser download of the given shipments as a CSV file. */
export function downloadShipmentsCsv(shipments: Shipment[], filters: ShipmentFilters): void {
  // BOM so Excel opens the file as UTF-8 (names can contain accents).
  const blob = new Blob(["\ufeff" + buildShipmentsCsv(shipments)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildExportFilename(filters);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
