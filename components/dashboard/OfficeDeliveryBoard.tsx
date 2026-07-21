"use client";

import { useMemo, useState } from "react";
import { Building2, ChevronRight, Download, MapPin, PackageCheck, Truck, Undo2 } from "lucide-react";

import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CopyButton } from "@/components/common/CopyButton";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useToast } from "@/components/common/Toast";
import { getCityMeta } from "@/lib/city-meta";
import { downloadShipmentsCsv } from "@/lib/export";
import { cn, formatDate } from "@/lib/utils";
import type { ShipmentFilters } from "@/hooks/useShipments";
import type { Shipment } from "@/types/shipment";

interface OfficeDeliveryBoardProps {
  shipments: Shipment[];
  /** Opens the full shipment detail drawer, drilling in from this office's list. */
  onSelectShipment: (shipment: Shipment) => void;
}

interface OfficeDelivery {
  office: string;
  label: string;
  shipments: Shipment[];
  total: number;
  outForDelivery: number;
  inTransit: number;
  delivered: number;
  exception: number;
  /** Anywhere in the return flow — heading back or already returned to the shipper. */
  returning: number;
}

/** Ordering that surfaces the most action-worthy offices first. */
function byUrgency(a: OfficeDelivery, b: OfficeDelivery): number {
  return (
    b.outForDelivery - a.outForDelivery ||
    b.inTransit - a.inTransit ||
    b.total - a.total ||
    a.label.localeCompare(b.label)
  );
}

function buildOfficeFilters(office: string, status: ShipmentFilters["status"]): ShipmentFilters {
  return { status, city: "all", state: "all", carrier: "all", office };
}

export function OfficeDeliveryBoard({ shipments, onSelectShipment }: OfficeDeliveryBoardProps) {
  const [activeOffice, setActiveOffice] = useState<OfficeDelivery | null>(null);

  const offices = useMemo(() => {
    const map = new Map<string, OfficeDelivery>();
    for (const s of shipments) {
      if (!s.office) continue;
      let entry = map.get(s.office);
      if (!entry) {
        entry = {
          office: s.office,
          label: s.office.replace(/^A&M\s*-\s*/i, ""),
          shipments: [],
          total: 0,
          outForDelivery: 0,
          inTransit: 0,
          delivered: 0,
          exception: 0,
          returning: 0,
        };
        map.set(s.office, entry);
      }
      entry.shipments.push(s);
      entry.total += 1;
      if (s.tracking.isReturnToShipper) entry.returning += 1;
      switch (s.tracking.status) {
        case "OUT_FOR_DELIVERY":
          entry.outForDelivery += 1;
          break;
        case "IN_TRANSIT":
          entry.inTransit += 1;
          break;
        case "DELIVERED":
          // A completed return also reports DELIVERED — keep it out of the
          // genuine-delivery count since it never reached this office.
          if (!s.tracking.isReturnToShipper) entry.delivered += 1;
          break;
        case "EXCEPTION":
          entry.exception += 1;
          break;
        case "LABEL_CREATED":
        case "UNAVAILABLE":
        case "UNKNOWN":
          break;
        default: {
          const exhaustive: never = s.tracking.status;
          void exhaustive;
        }
      }
    }
    return Array.from(map.values()).sort(byUrgency);
  }, [shipments]);

  const actionCount = offices.reduce(
    (total, office) => total + office.outForDelivery + office.exception,
    0
  );

  if (offices.length === 0) return null;

  return (
    <Card className="surface-panel rounded-2xl py-0 ring-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="flex items-start justify-between gap-4">
          <span>
            <span className="eyebrow flex items-center gap-2">
              <Building2 className="size-3.5" />
              Office coordination
            </span>
            <span className="mt-1.5 block text-lg font-semibold tracking-tight text-foreground">
              Delivery pulse
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <AnimatedNumber value={actionCount} /> need action today
            </span>
            <span className="hidden rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline-block">
              {offices.length} offices
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-4">
        <div className="scroll-panel grid max-h-[440px] grid-cols-2 gap-2.5 overflow-y-auto pr-1 -mr-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3 2xl:grid-cols-4">
          {offices.map((office) => {
            const meta = getCityMeta(office.label);
            const Icon = meta.icon;
            return (
              <button
                key={office.office}
                type="button"
                onClick={() => setActiveOffice(office)}
                title={office.label}
                className={cn(
                  "group flex min-h-28 flex-col justify-between gap-3 rounded-xl border bg-card p-3.5 text-left transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  office.outForDelivery > 0 ? "border-primary/25" : "border-border/80"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110",
                        meta.className
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="truncate text-sm font-semibold leading-tight">
                      {office.label}
                    </span>
                  </span>
                  <span className="shrink-0 text-xl font-semibold tracking-tight tabular-nums">
                    <AnimatedNumber value={office.total} />
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  {office.outForDelivery > 0 && (
                    <span className="inline-flex items-center gap-1 font-semibold text-primary">
                      <Truck className="size-3.5" />
                      <AnimatedNumber value={office.outForDelivery} /> out for delivery
                    </span>
                  )}
                  {office.inTransit > 0 && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <MapPin className="size-3" />
                      <AnimatedNumber value={office.inTransit} /> in transit
                    </span>
                  )}
                  {office.exception > 0 && (
                    <span className="font-semibold text-red-700 dark:text-red-300">
                      <AnimatedNumber value={office.exception} /> exception{office.exception === 1 ? "" : "s"}
                    </span>
                  )}
                  {office.returning > 0 && (
                    <span className="inline-flex items-center gap-1 font-semibold text-violet-700 dark:text-violet-300">
                      <Undo2 className="size-3" />
                      <AnimatedNumber value={office.returning} /> returning
                    </span>
                  )}
                  {office.delivered > 0 &&
                    office.outForDelivery === 0 &&
                    office.inTransit === 0 && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <PackageCheck className="size-3" />
                        <AnimatedNumber value={office.delivered} /> delivered
                      </span>
                    )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>

      <OfficeDetailSheet
        office={activeOffice}
        onClose={() => setActiveOffice(null)}
        onSelectShipment={onSelectShipment}
      />
    </Card>
  );
}

function OfficeDetailSheet({
  office,
  onClose,
  onSelectShipment,
}: {
  office: OfficeDelivery | null;
  onClose: () => void;
  onSelectShipment: (shipment: Shipment) => void;
}) {
  const { toast } = useToast();
  const exportOffice = (targetShipments: Shipment[], status: ShipmentFilters["status"]) => {
    if (!office) return;
    downloadShipmentsCsv(targetShipments, buildOfficeFilters(office.office, status));
    toast({
      title: `Exported ${targetShipments.length.toLocaleString()} shipment${targetShipments.length === 1 ? "" : "s"}`,
      description: `${office.label} · CSV download has started.`,
      variant: "success",
    });
  };

  // Within a single office, surface out-for-delivery and in-transit first.
  const STATUS_ORDER: Record<Shipment["tracking"]["status"], number> = {
    OUT_FOR_DELIVERY: 0,
    IN_TRANSIT: 1,
    EXCEPTION: 2,
    LABEL_CREATED: 3,
    DELIVERED: 4,
    UNAVAILABLE: 5,
    UNKNOWN: 6,
  };
  const sorted = office
    ? [...office.shipments].sort(
        (a, b) =>
          STATUS_ORDER[a.tracking.status] - STATUS_ORDER[b.tracking.status] ||
          a.recipient.localeCompare(b.recipient)
      )
    : [];
  const meta = office ? getCityMeta(office.label) : null;
  const HeaderIcon = meta?.icon ?? Building2;

  return (
    <Sheet open={office !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 bg-card p-0 sm:max-w-lg">
        {office && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg",
                    meta?.className
                  )}
                >
                  <HeaderIcon className="size-3.5" />
                </span>
                {office.label}
              </SheetTitle>
              <SheetDescription>
                {office.total} shipment{office.total === 1 ? "" : "s"}
                {office.outForDelivery > 0 && (
                  <> · {office.outForDelivery} out for delivery</>
                )}
              </SheetDescription>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => exportOffice(office.shipments, "all")}>
                  <Download className="size-4" />
                  Export all ({office.total})
                </Button>
                {office.outForDelivery > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      exportOffice(
                        office.shipments.filter((s) => s.tracking.status === "OUT_FOR_DELIVERY"),
                        "OUT_FOR_DELIVERY"
                      )
                    }
                  >
                    <Truck className="size-4" />
                    Out for delivery ({office.outForDelivery})
                  </Button>
                )}
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
              <ul className="divide-y">
                {sorted.map((s) => (
                  <li key={s.id}>
                    {/* A `div` here, not a `button` — it contains the CopyButton,
                        and buttons can't nest inside buttons. */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectShipment(s)}
                      onKeyDown={(event) => {
                        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          onSelectShipment(s);
                        }
                      }}
                      aria-label={`Open shipment ${s.trackingNumber}`}
                      className="group flex w-full cursor-pointer items-start justify-between gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {s.recipient || s.deliverTo || "—"}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 font-mono text-xs text-muted-foreground">
                          {s.trackingNumber}
                          <CopyButton value={s.trackingNumber} label="Copy tracking number" />
                        </p>
                        {s.assetName && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {s.assetName}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="flex flex-col items-end gap-1">
                          <StatusBadge
                            status={s.tracking.status}
                            isReturnToShipper={s.tracking.isReturnToShipper}
                          />
                          {s.tracking.estimatedDelivery && (
                            <span className="text-xs text-muted-foreground">
                              ETA {formatDate(s.tracking.estimatedDelivery)}
                            </span>
                          )}
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
