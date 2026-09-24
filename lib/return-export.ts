import { ATTENTION_LABELS, ATTENTION_TYPES, RETURN_LIVE_LABELS, type AttentionType } from "@/lib/return-insights";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ReturnAssetWithInsight, ReturnLiveFilter } from "@/hooks/useReturnTracker";

/** Escapes a value for CSV (quotes, commas, newlines) and guards against formula injection. */
function csvCell(value: string): string {
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

const EXPORT_COLUMNS: { header: string; value: (a: ReturnAssetWithInsight) => string }[] = [
  { header: "Serial Number", value: (a) => a.serialNumber },
  { header: "Assigned To", value: (a) => a.assignedTo },
  { header: "Refresh Ticket", value: (a) => a.refreshNumber },
  { header: "Insight SCTASK", value: (a) => a.sctask },
  { header: "Return Tracking Number", value: (a) => a.returnTrackingNumber },
  { header: "Previous Return Tracking Number", value: (a) => a.previousReturnTrackingNumber ?? "" },
  {
    header: "Active Label",
    value: (a) => (a.insight.activeLabel === "previous" ? "Previous" : "Current"),
  },
  { header: "Live Status", value: (a) => RETURN_LIVE_LABELS[a.insight.live] },
  { header: "Live Status Detail", value: (a) => a.insight.activeTracking.statusDescription },
  { header: "Sheet Status", value: (a) => a.sheetStatus },
  {
    header: "Attention Type",
    value: (a) => (a.insight.attentionType ? ATTENTION_LABELS[a.insight.attentionType] : ""),
  },
  { header: "Attention", value: (a) => a.insight.attention ?? "" },
  {
    header: "Last Scan",
    value: (a) =>
      a.insight.activeTracking.lastScanTime
        ? formatDateTime(a.insight.activeTracking.lastScanTime)
        : "",
  },
  { header: "Current Location", value: (a) => a.insight.activeTracking.currentLocation ?? "" },
  { header: "Routing Destination", value: (a) => a.routingDestination },
  { header: "Actual Return Destination", value: (a) => a.actualReturnDestination },
  {
    header: "Sheet Delivered Date",
    value: (a) => (a.sheetDeliveredDate ? formatDate(a.sheetDeliveredDate) : ""),
  },
  { header: "Legal Hold", value: (a) => (a.legalHold ? "Yes" : "No") },
  { header: "Lenovo Defect", value: (a) => (a.lenovoDefect ? "Yes" : "No") },
  { header: "Sheet Exception", value: (a) => a.exception },
  { header: "Batch", value: (a) => a.batch },
  { header: "Next Action", value: (a) => a.nextAction },
  { header: "Notes", value: (a) => a.notes },
];

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isAttentionType(filter: ReturnLiveFilter): filter is AttentionType {
  return (ATTENTION_TYPES as string[]).includes(filter);
}

export function buildReturnsExportFilename(filter: ReturnLiveFilter): string {
  const parts = ["zero-touch-returns"];
  if (filter === "ATTENTION") parts.push("needs-attention");
  else if (isAttentionType(filter)) parts.push(slug(ATTENTION_LABELS[filter]));
  else if (filter !== "all") parts.push(slug(RETURN_LIVE_LABELS[filter]));
  parts.push(new Date().toISOString().slice(0, 10));
  return `${parts.join("-")}.csv`;
}

/** Triggers a browser download of the given (already filtered) assets as CSV. */
export function downloadReturnsCsv(
  assets: ReturnAssetWithInsight[],
  filter: ReturnLiveFilter
): void {
  const header = EXPORT_COLUMNS.map((c) => csvCell(c.header)).join(",");
  const rows = assets.map((a) => EXPORT_COLUMNS.map((c) => csvCell(c.value(a))).join(","));
  const csv = [header, ...rows].join("\r\n");
  // BOM so Excel opens the file as UTF-8.
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildReturnsExportFilename(filter);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
