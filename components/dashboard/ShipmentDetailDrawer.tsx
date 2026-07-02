"use client";

import { AlertTriangle } from "lucide-react";

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
import type { Shipment } from "@/types/shipment";

interface ShipmentDetailDrawerProps {
  shipment: Shipment | null;
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

export function ShipmentDetailDrawer({ shipment, onClose }: ShipmentDetailDrawerProps) {
  const tracking = shipment?.tracking;
  const destination = shipment
    ? [shipment.address, shipment.city, shipment.state].filter(Boolean).join(", ")
    : "";

  return (
    <Sheet open={shipment !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {shipment && tracking && (
          <>
            <SheetHeader>
              <SheetTitle className="font-mono text-base">
                {shipment.trackingNumber}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <StatusBadge status={tracking.status} />
                <span>{tracking.statusDescription}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              {tracking.deliveryException && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-medium">Delivery Exception</p>
                    <p className="mt-0.5">{tracking.deliveryException}</p>
                  </div>
                </div>
              )}

              {tracking.errorMessage && (
                <div className="rounded-lg border bg-muted px-3 py-2.5 text-sm text-muted-foreground">
                  {tracking.errorMessage}
                </div>
              )}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                <DetailField label="Deliver To" value={shipment.deliverTo} />
                <DetailField label="Carrier" value={shipment.carrier} />
                <DetailField label="Origin" value={tracking.origin} />
                <DetailField label="Destination" value={destination} />
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
