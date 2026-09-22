"use client";

import { AlertTriangle, CheckCircle2, Copy, Laptop, Layers, Repeat, Undo2 } from "lucide-react";

import { CopyButton } from "@/components/common/CopyButton";
import {
  DUPLICATE_KIND_LABELS,
  MATCH_CONFIDENCE_LABELS,
} from "@/components/common/DuplicateBadge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/common/StatusBadge";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import type {
  CarrierCandidate,
  CarrierDestination,
  CarrierFit,
  DuplicateKind,
  Shipment,
} from "@/types/shipment";

interface ShipmentDetailDrawerProps {
  shipment: Shipment | null;
  /** Every loaded row, used to show the other rows sharing this tracking number. */
  allShipments: Shipment[];
  onClose: () => void;
  onSelectShipment: (shipment: Shipment) => void;
  /** Pins the FedEx record that belongs to this row (null returns to automatic matching). */
  onSelectCarrierRecord: (shipmentId: string, uniqueId: string | null) => void;
}

const DUPLICATE_PANEL_CLASSES: Record<DuplicateKind, string> = {
  EXACT: "border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200",
  SAME_DESTINATION:
    "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
  CONFLICT:
    "border-red-300 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
};

const DUPLICATE_ICONS: Record<DuplicateKind, typeof Copy> = {
  EXACT: Copy,
  SAME_DESTINATION: Layers,
  CONFLICT: AlertTriangle,
};

const FIT_LABELS: Record<CarrierFit, string> = {
  match: "matches FedEx destination",
  mismatch: "doesn't match FedEx destination",
  unknown: "FedEx destination unknown",
};

function formatCarrierDestination(destination: CarrierDestination | null): string {
  if (!destination) return "";
  const place = [destination.city, destination.state].filter(Boolean).join(", ");
  return [place, destination.postalCode].filter(Boolean).join(" ");
}

function sheetDestination(shipment: Shipment): string {
  return (
    [shipment.city, shipment.state].filter(Boolean).join(", ") ||
    shipment.office?.replace(/^A&M\s*-\s*/i, "") ||
    "no destination on sheet"
  );
}

function CarrierRecordCard({
  candidate,
  isSelected,
  onPick,
}: {
  candidate: CarrierCandidate;
  isSelected: boolean;
  onPick: () => void;
}) {
  const { tracking } = candidate;
  const destination = formatCarrierDestination(tracking.destination);
  return (
    <li
      className={cn(
        "rounded-lg border px-3 py-2.5",
        isSelected ? "border-primary/50 bg-primary/5" : "bg-background"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <StatusBadge status={tracking.status} isReturnToShipper={tracking.isReturnToShipper} />
          <p className="text-xs text-muted-foreground">
            {destination ? `To ${destination}` : "Destination not provided by FedEx"}
            {tracking.shipDate ? ` · shipped ${formatDate(tracking.shipDate)}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {tracking.lastScanTime
              ? `Last scan ${formatDateTime(tracking.lastScanTime)}${
                  tracking.currentLocation ? ` · ${tracking.currentLocation}` : ""
                }`
              : tracking.errorMessage ?? "No scans on this record"}
          </p>
        </div>
        {isSelected ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
            <CheckCircle2 className="size-3.5" />
            Showing
          </span>
        ) : (
          <Button size="sm" variant="outline" className="shrink-0" onClick={onPick}>
            This is ours
          </Button>
        )}
      </div>
    </li>
  );
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value || "—"}</dd>
    </div>
  );
}

export function ShipmentDetailDrawer({
  shipment,
  allShipments,
  onClose,
  onSelectShipment,
  onSelectCarrierRecord,
}: ShipmentDetailDrawerProps) {
  const tracking = shipment?.tracking;
  const duplicate = shipment?.duplicate ?? null;
  const groupRows = shipment
    ? allShipments.filter(
        (other) => other.trackingNumber === shipment.trackingNumber && other.id !== shipment.id
      )
    : [];
  const DuplicateIcon = duplicate ? DUPLICATE_ICONS[duplicate.kind] : null;
  const destination = shipment
    ? [shipment.address, shipment.city, shipment.state].filter(Boolean).join(", ")
    : "";

  return (
    <Sheet open={shipment !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-lg">
        {shipment && tracking && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-1.5 font-mono text-base">
                {shipment.trackingNumber}
                <CopyButton
                  value={shipment.trackingNumber}
                  label="Copy tracking number"
                />
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <StatusBadge status={tracking.status} isReturnToShipper={tracking.isReturnToShipper} />
                <span>{tracking.statusDescription}</span>
                <span className="ml-auto text-xs">Sheet row {shipment.rowNumber}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              {duplicate && DuplicateIcon && (
                <div
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm",
                    DUPLICATE_PANEL_CLASSES[duplicate.kind]
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <DuplicateIcon className="mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        Duplicate tracking number · {DUPLICATE_KIND_LABELS[duplicate.kind]} (
                        {duplicate.groupSize} rows)
                      </p>
                      <p className="mt-0.5 opacity-90">{duplicate.note}</p>
                    </div>
                  </div>
                  {groupRows.length > 0 && (
                    <ul className="mt-2.5 space-y-1.5">
                      {[shipment, ...groupRows].map((row) => (
                        <li key={row.id}>
                          <button
                            type="button"
                            disabled={row.id === shipment.id}
                            onClick={() => onSelectShipment(row)}
                            className="w-full rounded-lg border border-current/15 bg-background/70 px-2.5 py-1.5 text-left text-xs text-foreground transition-colors enabled:hover:bg-background disabled:cursor-default"
                          >
                            <span className="font-medium">
                              Row {row.rowNumber}
                              {row.id === shipment.id ? " (this row)" : ""}
                            </span>
                            {" · "}
                            {row.recipient || row.deliverTo || "no recipient"}
                            {" · "}
                            {sheetDestination(row)}
                            {row.duplicate ? (
                              <span
                                className={cn(
                                  "ml-1",
                                  row.duplicate.carrierFit === "match" && "text-emerald-700 dark:text-emerald-300",
                                  row.duplicate.carrierFit === "mismatch" && "text-red-700 dark:text-red-300",
                                  row.duplicate.carrierFit === "unknown" && "text-muted-foreground"
                                )}
                              >
                                — {FIT_LABELS[row.duplicate.carrierFit]}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {shipment.carrierCandidates.length > 1 && (
                <div
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm",
                    shipment.match.confidence === "ambiguous"
                      ? "border-red-300 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/10"
                      : "border-amber-300 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <Repeat className="mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        FedEx reused this number · {MATCH_CONFIDENCE_LABELS[shipment.match.confidence]}
                      </p>
                      <p className="mt-0.5 text-muted-foreground">{shipment.match.reason}</p>
                    </div>
                  </div>
                  <ul className="mt-2.5 space-y-2">
                    {shipment.carrierCandidates.map((candidate) => (
                      <CarrierRecordCard
                        key={candidate.uniqueId}
                        candidate={candidate}
                        isSelected={candidate.uniqueId === shipment.match.selectedId}
                        onPick={() => onSelectCarrierRecord(shipment.id, candidate.uniqueId)}
                      />
                    ))}
                  </ul>
                  {shipment.match.confidence === "manual" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2"
                      onClick={() => onSelectCarrierRecord(shipment.id, null)}
                    >
                      Go back to automatic matching
                    </Button>
                  )}
                </div>
              )}
              {tracking.isReturnToShipper && (
                <div
                  className={cn(
                    "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm",
                    tracking.status === "DELIVERED"
                      ? "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200"
                      : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                  )}
                >
                  <Undo2 className="mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {tracking.status === "DELIVERED" ? "Returned to shipper" : "Returning to shipper"}
                    </p>
                    {tracking.returnTrackingNumber ? (
                      <div className="mt-1">
                        <p className="text-xs opacity-80">Return tracking number</p>
                        <span className="flex items-center gap-1 font-mono text-sm">
                          {tracking.returnTrackingNumber}
                          <CopyButton
                            value={tracking.returnTrackingNumber}
                            label="Copy return tracking number"
                            className="opacity-90 hover:opacity-100"
                          />
                        </span>
                      </div>
                    ) : (
                      <p className="mt-0.5 opacity-90">
                        {tracking.status === "DELIVERED"
                          ? "This package was delivered back to the sender."
                          : "This package is being routed back to the sender."}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {tracking.deliveryException && (
                <div className="flex items-start gap-2 rounded-xl border border-red-300/70 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-medium">Delivery Exception</p>
                    <p className="mt-0.5">{tracking.deliveryException}</p>
                  </div>
                </div>
              )}

              {tracking.errorMessage && (
                <div className="rounded-xl border bg-muted px-3 py-2.5 text-sm text-muted-foreground">
                  {tracking.errorMessage}
                </div>
              )}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                <DetailField label="Deliver To" value={shipment.deliverTo} />
                {shipment.recipient && (
                  <DetailField label="Recipient" value={shipment.recipient} />
                )}
                <DetailField label="Carrier" value={shipment.carrier} />
                <DetailField label="Origin" value={tracking.origin} />
                <DetailField label="Destination" value={destination} />
                {shipment.postalCode && <DetailField label="ZIP" value={shipment.postalCode} />}
                {tracking.destination && (
                  <DetailField
                    label="FedEx Destination"
                    value={formatCarrierDestination(tracking.destination)}
                  />
                )}
                {(shipment.shipDate || tracking.shipDate) && (
                  <DetailField
                    label="Ship Date"
                    value={formatDate(tracking.shipDate ?? shipment.shipDate)}
                  />
                )}
                <DetailField label="Current Scan" value={tracking.currentLocation} />
                <DetailField
                  label="Estimated Delivery"
                  value={tracking.estimatedDelivery ? formatDate(tracking.estimatedDelivery) : null}
                />
                <DetailField label="Service" value={tracking.serviceType} />
                <DetailField
                  label="Last Scan"
                  value={tracking.lastScanTime ? formatDateTime(tracking.lastScanTime) : null}
                />
              </dl>

              {(shipment.assetName || shipment.serialNumber) && (
                <div className="rounded-xl border bg-muted/40 px-3 py-3">
                  <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Laptop className="size-3.5" />
                    Asset Details
                  </h3>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
                    <DetailField label="Asset Name" value={shipment.assetName} />
                    <DetailField
                      label="Serial Number"
                      value={
                        shipment.serialNumber ? (
                          <span className="flex items-center gap-1 font-mono text-xs">
                            {shipment.serialNumber}
                            <CopyButton
                              value={shipment.serialNumber}
                              label="Copy serial number"
                            />
                          </span>
                        ) : null
                      }
                    />
                  </dl>
                </div>
              )}

              {tracking.transitHistory && tracking.transitHistory.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-medium">Transit History</h3>
                    <ol className="mt-3 space-y-0">
                      {tracking.transitHistory.map((event, index) => (
                        <li key={`${event.timestamp}-${index}`} className="relative flex gap-3 pb-5 last:pb-0">
                          {index < tracking.transitHistory!.length - 1 && (
                            <span
                              aria-hidden
                              className="absolute top-3 left-[5px] h-full w-px bg-border"
                            />
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
                            <p className={cn("text-sm", event.isException && "text-red-700")}>
                              {event.description}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {event.location} · {formatDateTime(event.timestamp)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
