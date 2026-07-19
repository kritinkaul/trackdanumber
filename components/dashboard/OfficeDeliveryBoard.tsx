"use client";

import { useMemo, useState } from "react";
import { Building2, Download, MapPin, PackageCheck, Truck } from "lucide-react";

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
import { downloadShipmentsCsv } from "@/lib/export";
import { cn, formatDate } from "@/lib/utils";
import type { ShipmentFilters } from "@/hooks/useShipments";
import type { Shipment } from "@/types/shipment";

interface OfficeDeliveryBoardProps {
  shipments: Shipment[];
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
}

const COLLAPSED_COUNT = 12;

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

export function OfficeDeliveryBoard({ shipments }: OfficeDeliveryBoardProps) {
  const [showAll, setShowAll] = useState(false);
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
        };
        map.set(s.office, entry);
      }
      entry.shipments.push(s);
      entry.total += 1;
      switch (s.tracking.status) {
        case "OUT_FOR_DELIVERY":
          entry.outForDelivery += 1;
          break;
        case "IN_TRANSIT":
          entry.inTransit += 1;
          break;
        case "DELIVERED":
          entry.delivered += 1;
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

  const maxOfd = useMemo(
    () => offices.reduce((max, o) => Math.max(max, o.outForDelivery), 0),
    [offices]
  );
  const actionCount = offices.reduce(
    (total, office) => total + office.outForDelivery + office.exception,
    0
  );

  if (offices.length === 0) return null;

  const visible = showAll ? offices : offices.slice(0, COLLAPSED_COUNT);

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
          <span className="rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {actionCount} need action today
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((office) => {
            // Heat: proportion of this office's out-for-delivery vs the busiest office.
            const heat = maxOfd > 0 ? office.outForDelivery / maxOfd : 0;
            const tintPct = office.outForDelivery > 0 ? 8 + Math.round(heat * 26) : 0;
            return (
              <button
                key={office.office}
                type="button"
                onClick={() => setActiveOffice(office)}
                style={
                  tintPct > 0
                    ? {
                        backgroundColor: `color-mix(in oklch, var(--am-blue) ${tintPct}%, var(--card))`,
                        backgroundImage:
                          "linear-gradient(135deg, color-mix(in oklch, var(--am-blue) 10%, transparent), transparent)",
                      }
                    : undefined
                }
                className={cn(
                  "group flex min-h-28 flex-col justify-between gap-3 rounded-xl border p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  office.outForDelivery > 0
                    ? "border-primary/25"
                    : "border-border/80 bg-card/65"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold leading-tight">{office.label}</span>
                  <span className="shrink-0 text-xl font-semibold tracking-tight tabular-nums">
                    {office.total}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  {office.outForDelivery > 0 && (
                    <span className="inline-flex items-center gap-1 font-semibold text-primary">
                      <Truck className="size-3.5" />
                      {office.outForDelivery} out for delivery
                    </span>
                  )}
                  {office.inTransit > 0 && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <MapPin className="size-3" />
                      {office.inTransit} in transit
                    </span>
                  )}
                  {office.exception > 0 && (
                    <span className="font-semibold text-red-700 dark:text-red-300">
                      {office.exception} exception{office.exception === 1 ? "" : "s"}
                    </span>
                  )}
                  {office.delivered > 0 &&
                    office.outForDelivery === 0 &&
                    office.inTransit === 0 && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <PackageCheck className="size-3" />
                        {office.delivered} delivered
                      </span>
                    )}
                </div>
              </button>
            );
          })}
        </div>
        {offices.length > COLLAPSED_COUNT && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Show less" : `Show all ${offices.length} offices`}
          </Button>
        )}
      </CardContent>

      <OfficeDetailSheet office={activeOffice} onClose={() => setActiveOffice(null)} />
    </Card>
  );
}

function OfficeDetailSheet({
  office,
  onClose,
}: {
  office: OfficeDelivery | null;
  onClose: () => void;
}) {
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

  return (
    <Sheet open={office !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 bg-card p-0 sm:max-w-lg">
        {office && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                {office.label}
              </SheetTitle>
              <SheetDescription>
                {office.total} shipment{office.total === 1 ? "" : "s"}
                {office.outForDelivery > 0 && (
                  <> · {office.outForDelivery} out for delivery</>
                )}
              </SheetDescription>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    downloadShipmentsCsv(office.shipments, buildOfficeFilters(office.office, "all"))
                  }
                >
                  <Download className="size-4" />
                  Export all ({office.total})
                </Button>
                {office.outForDelivery > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadShipmentsCsv(
                        office.shipments.filter(
                          (s) => s.tracking.status === "OUT_FOR_DELIVERY"
                        ),
                        buildOfficeFilters(office.office, "OUT_FOR_DELIVERY")
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
                  <li key={s.id} className="flex items-start justify-between gap-3 px-4 py-3">
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
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={s.tracking.status} />
                      {s.tracking.estimatedDelivery && (
                        <span className="text-xs text-muted-foreground">
                          ETA {formatDate(s.tracking.estimatedDelivery)}
                        </span>
                      )}
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
