"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Flag,
  History,
  Package,
  Truck,
  XCircle,
} from "lucide-react";

import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { ATTENTION_LABELS, ATTENTION_TYPES, type AttentionType } from "@/lib/return-insights";
import { cn } from "@/lib/utils";
import type { ReturnKpis, ReturnLiveFilter } from "@/hooks/useReturnTracker";

interface ReturnKpiCardsProps {
  kpis: ReturnKpis;
  activeFilter: ReturnLiveFilter;
  onSelectFilter: (filter: ReturnLiveFilter) => void;
}

interface KpiDefinition {
  label: string;
  helper: string;
  value: (k: ReturnKpis) => number;
  filter: ReturnLiveFilter;
  icon: typeof Package;
  accent: string;
}

const KPI_DEFINITIONS: KpiDefinition[] = [
  {
    label: "Assets",
    helper: "All tracked returns",
    value: (k) => k.total,
    filter: "all",
    icon: Package,
    accent: "text-primary bg-primary/10",
  },
  {
    label: "Awaiting drop-off",
    helper: "Label created, not shipped",
    value: (k) => k.awaitingDropoff,
    filter: "AWAITING_DROPOFF",
    icon: CircleDashed,
    accent: "text-amber-700 bg-amber-500/12 dark:text-amber-300",
  },
  {
    label: "In transit",
    helper: "On the way back",
    value: (k) => k.inTransit,
    filter: "IN_TRANSIT",
    icon: Truck,
    accent: "text-blue-700 bg-blue-500/10 dark:text-blue-300",
  },
  {
    label: "Delivered",
    helper: "Return completed",
    value: (k) => k.delivered,
    filter: "DELIVERED",
    icon: CheckCircle2,
    accent: "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300",
  },
  {
    label: "Exceptions",
    helper: "Needs intervention",
    value: (k) => k.exceptions,
    filter: "EXCEPTION",
    icon: AlertTriangle,
    accent: "text-red-700 bg-red-500/10 dark:text-red-300",
  },
  {
    label: "Needs attention",
    helper: "Sheet vs. carrier mismatch",
    value: (k) => k.needsAttention,
    filter: "ATTENTION",
    icon: Flag,
    accent: "text-violet-700 bg-violet-500/10 dark:text-violet-300",
  },
];

interface AttentionChipDefinition {
  icon: typeof Package;
  classes: string;
}

const ATTENTION_CHIP_STYLES: Record<AttentionType, AttentionChipDefinition> = {
  READY_TO_COMPLETE: {
    icon: CheckCircle2,
    classes: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  ON_ITS_WAY: {
    icon: Truck,
    classes: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  SHEET_SAYS_DONE: {
    icon: AlertTriangle,
    classes: "border-amber-500/25 bg-amber-500/12 text-amber-800 dark:text-amber-300",
  },
  FAILED_RETURN: {
    icon: XCircle,
    classes: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
  },
  UNLOGGED_EXCEPTION: {
    icon: AlertTriangle,
    classes: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
  },
  PREVIOUS_LABEL: {
    icon: History,
    classes: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
};

export function ReturnKpiCards({ kpis, activeFilter, onSelectFilter }: ReturnKpiCardsProps) {
  const known = Math.max(kpis.total - kpis.noData, 0);
  const completion = known > 0 ? Math.round((kpis.delivered / known) * 100) : 0;

  return (
    <section aria-labelledby="returns-overview-title" className="surface-panel overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Return pipeline</p>
          <h2 id="returns-overview-title" className="mt-1 text-lg font-semibold tracking-tight">
            Zero Touch return flow
          </h2>
        </div>
        <div className="w-full max-w-56 sm:w-56">
          <p className="text-sm text-muted-foreground">
            <AnimatedNumber value={completion} suffix="%" className="font-semibold text-foreground" />{" "}
            returned
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-700 ease-out"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0 xl:grid-cols-6">
        {KPI_DEFINITIONS.map((definition) => {
          const Icon = definition.icon;
          const isActive = activeFilter === definition.filter;
          const value = definition.value(kpis);

          return (
            <button
              key={definition.label}
              type="button"
              aria-pressed={isActive}
              onClick={() =>
                onSelectFilter(isActive && definition.filter !== "all" ? "all" : definition.filter)
              }
              className={cn(
                "group relative flex min-h-32 items-start justify-between gap-3 p-5 text-left transition-all duration-200 hover:z-10 hover:-translate-y-0.5 hover:rounded-xl hover:bg-muted/55 hover:shadow-lg focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive && "bg-accent/70"
              )}
            >
              <div>
                <p className="text-sm font-medium text-muted-foreground">{definition.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                  <AnimatedNumber value={value} />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{definition.helper}</p>
              </div>
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110",
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

      {kpis.needsAttention > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t bg-violet-500/[0.04] px-5 py-3">
          <span className="mr-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Flag className="size-3.5" />
            Needs attention, grouped:
          </span>
          {ATTENTION_TYPES.map((type) => {
            const count = kpis.attentionBreakdown[type];
            if (count === 0) return null;
            const { icon: Icon, classes } = ATTENTION_CHIP_STYLES[type];
            const isActive = activeFilter === type;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelectFilter(isActive ? "all" : type)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all hover:-translate-y-0.5 hover:shadow-sm",
                  classes,
                  isActive && "ring-2 ring-offset-1 ring-offset-background"
                )}
              >
                <Icon className="size-3" />
                <AnimatedNumber value={count} /> {ATTENTION_LABELS[type].toLowerCase()}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t bg-muted/25 px-5 py-3 text-xs text-muted-foreground">
        <span>
          No carrier data:{" "}
          <button
            type="button"
            onClick={() => onSelectFilter("NO_DATA")}
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            <AnimatedNumber value={kpis.noData} />
          </button>
        </span>
      </div>
    </section>
  );
}
