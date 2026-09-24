"use client";

import { AlertTriangle, Flag, History, Laptop, Repeat } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/common/CopyButton";
import { ReturnLiveBadge } from "@/components/returns/ReturnLiveBadge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ATTENTION_LABELS, sheetStatusClasses } from "@/lib/return-insights";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import type { ReturnAssetWithInsight } from "@/hooks/useReturnTracker";
import type { TrackingInfo } from "@/types/shipment";

interface ReturnDetailDrawerProps {
  asset: ReturnAssetWithInsight | null;
  onClose: () => void;
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value || "—"}</dd>
    </div>
  );
}

function LabelSection({
  title,
  trackingNumber,
  tracking,
  isActive,
}: {
  title: string;
  trackingNumber: string;
  tracking: TrackingInfo;
  isActive: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-3",
        isActive ? "border-primary/30 bg-primary/[0.03]" : "bg-muted/30"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {title}
          {isActive && (
            <Badge variant="outline" className="border-primary/30 text-primary">
              Active
            </Badge>
          )}
        </h3>
        <span className="flex items-center gap-1 font-mono text-xs">
          {trackingNumber}
          <CopyButton value={trackingNumber} label="Copy tracking number" />
        </span>
      </div>
      <p className="mt-2 text-sm">
        {tracking.statusDescription}
        {tracking.currentLocation ? (
          <span className="text-muted-foreground"> · {tracking.currentLocation}</span>
        ) : null}
      </p>
      {tracking.lastScanTime && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          Last scan {formatDateTime(tracking.lastScanTime)}
        </p>
      )}
      {tracking.errorMessage && (
        <p className="mt-1 text-xs text-muted-foreground">{tracking.errorMessage}</p>
      )}

      {tracking.transitHistory && tracking.transitHistory.length > 0 && (
        <ol className="mt-3 space-y-0">
          {tracking.transitHistory.map((event, index) => (
            <li key={`${event.timestamp}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
              {index < tracking.transitHistory!.length - 1 && (
                <span aria-hidden className="absolute top-3 left-[5px] h-full w-px bg-border" />
              )}
              <span
                className={cn(
                  "relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-background",
                  event.isException
                    ? "bg-red-500"
                    : index === 0
                      ? "bg-primary"
                      : "bg-muted-foreground/40"
                )}
              />
              <div className="min-w-0">
                <p className={cn("text-sm", event.isException && "text-red-700 dark:text-red-300")}>
                  {event.description}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {event.location} · {formatDateTime(event.timestamp)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function ReturnDetailDrawer({ asset, onClose }: ReturnDetailDrawerProps) {
  return (
    <Sheet open={asset !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-lg">
        {asset && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-1.5 font-mono text-base">
                <Laptop className="size-4 text-muted-foreground" />
                {asset.serialNumber}
                <CopyButton value={asset.serialNumber} label="Copy serial number" />
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <ReturnLiveBadge live={asset.insight.live} />
                <Badge
                  variant="outline"
                  className={cn("font-medium", sheetStatusClasses(asset.sheetStatus))}
                >
                  Sheet: {asset.sheetStatus || "—"}
                </Badge>
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              {asset.insight.attention && (
                <div className="flex items-start gap-2.5 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2.5 text-sm text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
                  <Flag className="mt-0.5 size-4 shrink-0" />
                  <div>
                    {asset.insight.attentionType && (
                      <p className="font-medium">{ATTENTION_LABELS[asset.insight.attentionType]}</p>
                    )}
                    <p className="mt-0.5">{asset.insight.attention}</p>
                  </div>
                </div>
              )}

              {asset.insight.activeTracking.deliveryException && (
                <div className="flex items-start gap-2 rounded-xl border border-red-300/70 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-medium">Delivery Exception</p>
                    <p className="mt-0.5">{asset.insight.activeTracking.deliveryException}</p>
                  </div>
                </div>
              )}

              {[asset.trackingMatch, asset.previousTrackingMatch].map((match, index) =>
                match && match.candidateCount > 1 ? (
                  <div
                    key={index}
                    className={cn(
                      "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm",
                      match.confidence === "ambiguous"
                        ? "border-red-300/70 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
                        : "border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                    )}
                  >
                    <Repeat className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-medium">
                        {index === 0 ? "Current" : "Previous"} label was reused by FedEx
                      </p>
                      <p className="mt-0.5 opacity-90">{match.reason}</p>
                    </div>
                  </div>
                ) : null
              )}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                <DetailField label="Assigned To" value={asset.assignedTo} />
                <DetailField label="Refresh Ticket" value={asset.refreshNumber} />
                <DetailField label="Insight SCTASK" value={asset.sctask} />
                <DetailField label="Routing" value={asset.routingDestination} />
                <DetailField label="Return Destination" value={asset.actualReturnDestination} />
                <DetailField
                  label="Sheet Delivered Date"
                  value={asset.sheetDeliveredDate ? formatDate(asset.sheetDeliveredDate) : null}
                />
                <DetailField label="Legal Hold" value={asset.legalHold ? "Yes" : "No"} />
                <DetailField label="Lenovo Defect" value={asset.lenovoDefect ? "Yes" : "No"} />
                {asset.batch && <DetailField label="Batch" value={asset.batch} />}
                {asset.exception && <DetailField label="Sheet Exception" value={asset.exception} />}
              </dl>

              {asset.nextAction && (
                <div className="rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <h3 className="text-xs font-medium text-amber-900 dark:text-amber-200">Next Action</h3>
                  <p className="mt-1 whitespace-pre-line text-sm">{asset.nextAction}</p>
                </div>
              )}

              {asset.notes && (
                <div className="rounded-xl border bg-muted/40 px-3 py-3">
                  <h3 className="text-xs font-medium text-muted-foreground">Notes</h3>
                  <p className="mt-1 text-sm">{asset.notes}</p>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <h3 className="flex items-center gap-1.5 text-sm font-medium">
                  <History className="size-3.5" />
                  Label activity
                </h3>
                <LabelSection
                  title="Current label"
                  trackingNumber={asset.returnTrackingNumber}
                  tracking={asset.tracking}
                  isActive={asset.insight.activeLabel === "current"}
                />
                {asset.previousReturnTrackingNumber && asset.previousTracking && (
                  <LabelSection
                    title="Previous label"
                    trackingNumber={asset.previousReturnTrackingNumber}
                    tracking={asset.previousTracking}
                    isActive={asset.insight.activeLabel === "previous"}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
