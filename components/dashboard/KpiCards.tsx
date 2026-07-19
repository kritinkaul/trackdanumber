"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Package,
  Truck,
  Warehouse,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { KpiCounts, StatusFilter } from "@/hooks/useShipments";

interface KpiCardsProps {
  kpis: KpiCounts;
  activeStatus: StatusFilter;
  onSelectStatus: (status: StatusFilter) => void;
}

interface KpiDefinition {
  label: string;
  helper: string;
  value: (k: KpiCounts) => number;
  status: StatusFilter;
  icon: typeof Package;
  accent: string;
}

const KPI_DEFINITIONS: KpiDefinition[] = [
  {
    label: "Manifest",
    helper: "All shipments",
    value: (k) => k.total,
    status: "all",
    icon: Package,
    accent: "text-primary bg-primary/10",
  },
  {
    label: "Out today",
    helper: "Coordinate handoff",
    value: (k) => k.outForDelivery,
    status: "OUT_FOR_DELIVERY",
    icon: Warehouse,
    accent: "text-blue-700 bg-blue-500/10 dark:text-blue-300",
  },
  {
    label: "Exceptions",
    helper: "Needs attention",
    value: (k) => k.exception,
    status: "EXCEPTION",
    icon: AlertTriangle,
    accent: "text-red-700 bg-red-500/10 dark:text-red-300",
  },
  {
    label: "In motion",
    helper: "Across the network",
    value: (k) => k.inTransit,
    status: "IN_TRANSIT",
    icon: Truck,
    accent: "text-amber-700 bg-amber-500/12 dark:text-amber-300",
  },
  {
    label: "Delivered",
    helper: "Completed",
    value: (k) => k.delivered,
    status: "DELIVERED",
    icon: CheckCircle2,
    accent: "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300",
  },
];

export function KpiCards({ kpis, activeStatus, onSelectStatus }: KpiCardsProps) {
  const known = Math.max(kpis.total - kpis.noStatus, 0);
  const completion = known > 0 ? Math.round((kpis.delivered / known) * 100) : 0;

  return (
    <section aria-labelledby="network-overview-title" className="surface-panel overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Network snapshot</p>
          <h2 id="network-overview-title" className="mt-1 text-lg font-semibold tracking-tight">
            Today&apos;s shipment flow
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{completion}%</span>{" "}
          delivered across shipments with live status
        </p>
      </div>

      <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
        {KPI_DEFINITIONS.map((definition) => {
          const Icon = definition.icon;
          const isActive = activeStatus === definition.status;
          const value = definition.value(kpis);

          return (
            <button
              key={definition.label}
              type="button"
              aria-pressed={isActive}
              onClick={() =>
                onSelectStatus(isActive && definition.status !== "all" ? "all" : definition.status)
              }
              className={cn(
                "group relative flex min-h-32 items-start justify-between gap-3 p-5 text-left transition-colors hover:bg-muted/55 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive && "bg-accent/70"
              )}
            >
              <div>
                <p className="text-sm font-medium text-muted-foreground">{definition.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{definition.helper}</p>
              </div>
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl",
                  definition.accent
                )}
              >
                <Icon className="size-4" />
              </div>
              {isActive ? (
                <span className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-primary" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t bg-muted/25 px-5 py-3 text-xs text-muted-foreground">
        <CircleDashed className="size-3.5" />
        <span>
          Awaiting carrier scan:{" "}
          <button
            type="button"
            onClick={() => onSelectStatus("LABEL_CREATED")}
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            {kpis.labelCreated}
          </button>
        </span>
        <span aria-hidden className="size-1 rounded-full bg-border" />
        <span>
          Status unavailable:{" "}
          <button
            type="button"
            onClick={() => onSelectStatus("NO_STATUS")}
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            {kpis.noStatus}
          </button>
        </span>
      </div>
    </section>
  );
}
