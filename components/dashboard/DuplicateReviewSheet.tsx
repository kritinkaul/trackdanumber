"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Search } from "lucide-react";

import { CopyButton } from "@/components/common/CopyButton";
import { DuplicateBadges } from "@/components/common/DuplicateBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SelectionLogic, formatCarrierDestination } from "@/components/dashboard/SelectionLogic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DUPLICATE_FILTER_LABELS,
  matchesDuplicateFilter,
  needsReview,
  type DuplicateFilter,
} from "@/lib/duplicates";
import { cn } from "@/lib/utils";
import type { CarrierFit, Shipment } from "@/types/shipment";

type ReviewFilter = Exclude<DuplicateFilter, "all">;

const FILTERS: ReviewFilter[] = ["ANY", "REVIEW", "CONFLICT", "SAME_DESTINATION", "EXACT", "REUSED"];

const FIT_LABELS: Record<CarrierFit, string> = {
  match: "Matches FedEx",
  mismatch: "Doesn't match FedEx",
  unknown: "FedEx destination unknown",
};

const FIT_CLASSES: Record<CarrierFit, string> = {
  match: "text-emerald-700 dark:text-emerald-300",
  mismatch: "text-red-700 dark:text-red-300",
  unknown: "text-muted-foreground",
};

interface DuplicateGroup {
  trackingNumber: string;
  rows: Shipment[];
  needsReview: boolean;
}

function groupDuplicates(shipments: Shipment[]): DuplicateGroup[] {
  const groups = new Map<string, Shipment[]>();
  for (const shipment of shipments) {
    if (!matchesDuplicateFilter(shipment, "ANY")) continue;
    const group = groups.get(shipment.trackingNumber);
    if (group) group.push(shipment);
    else groups.set(shipment.trackingNumber, [shipment]);
  }
  return [...groups.entries()]
    .map(([trackingNumber, rows]) => ({
      trackingNumber,
      rows: rows.sort((a, b) => a.rowNumber - b.rowNumber),
      needsReview: rows.some(needsReview),
    }))
    .sort(
      (a, b) =>
        Number(b.needsReview) - Number(a.needsReview) || a.rows[0].rowNumber - b.rows[0].rowNumber
    );
}

function sheetDestination(shipment: Shipment): string {
  return (
    [shipment.city, shipment.state].filter(Boolean).join(", ") ||
    shipment.office?.replace(/^A&M\s*-\s*/i, "") ||
    "no destination on sheet"
  );
}

function groupSummary(group: DuplicateGroup): string {
  const [first] = group.rows;
  const parts: string[] = [];
  if (first.duplicate) {
    parts.push(`${group.rows.length} rows in the sheet share this tracking number.`);
  }
  if (first.match.candidateCount > 1) {
    parts.push(`FedEx has ${first.match.candidateCount} different shipments on this number (it recycles numbers).`);
  }
  return parts.join(" ");
}

interface DuplicateReviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipments: Shipment[];
  onOpenShipment: (shipment: Shipment) => void;
}

export function DuplicateReviewSheet({
  open,
  onOpenChange,
  shipments,
  onOpenShipment,
}: DuplicateReviewSheetProps) {
  const [filter, setFilter] = useState<ReviewFilter>("ANY");
  const [query, setQuery] = useState("");
  const allGroups = useMemo(() => groupDuplicates(shipments), [shipments]);

  const counts = useMemo(() => {
    const result = {} as Record<ReviewFilter, number>;
    for (const key of FILTERS) {
      result[key] = allGroups.filter((g) => g.rows.some((row) => matchesDuplicateFilter(row, key))).length;
    }
    return result;
  }, [allGroups]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allGroups.filter((group) => {
      if (!group.rows.some((row) => matchesDuplicateFilter(row, filter))) return false;
      if (!needle) return true;
      return group.rows.some((row) =>
        [row.trackingNumber, row.recipient, row.deliverTo, row.city, row.state, String(row.rowNumber)]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      );
    });
  }, [allGroups, filter, query]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto bg-card data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="text-base">Duplicate review</SheetTitle>
          <SheetDescription>
            Every tracking number that appears on more than one sheet row, or that FedEx has used for
            more than one shipment — with the reasoning behind the record shown for each row.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                )}
              >
                {DUPLICATE_FILTER_LABELS[key]} · {counts[key]}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tracking number, recipient, city or row"
              className="pl-8"
            />
          </div>

          {groups.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              {allGroups.length === 0
                ? "No duplicate tracking numbers in this upload."
                : "No duplicates match this filter."}
            </p>
          ) : (
            <ul className="space-y-3">
              {groups.map((group) => (
                <li
                  key={group.trackingNumber}
                  className={cn(
                    "rounded-xl border bg-background",
                    group.needsReview && "border-red-300 dark:border-red-500/40"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
                    <span className="flex items-center gap-1 font-mono text-sm font-semibold">
                      {group.trackingNumber}
                      <CopyButton value={group.trackingNumber} label="Copy tracking number" />
                    </span>
                    <DuplicateBadges shipment={group.rows[0]} />
                    {group.needsReview && (
                      <span className="ml-auto flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-300">
                        <AlertTriangle className="size-3.5" />
                        Needs review
                      </span>
                    )}
                  </div>
                  <p className="px-3 pt-2 text-xs text-muted-foreground">{groupSummary(group)}</p>

                  <ul className="space-y-2 p-3">
                    {group.rows.map((row, index) => {
                      const fit = row.duplicate?.carrierFit ?? null;
                      const fedexDestination = formatCarrierDestination(row.tracking.destination);
                      return (
                        <li key={row.id} className="rounded-lg border">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-2 text-xs">
                            <span className="font-semibold">Row {row.rowNumber}</span>
                            <span>{row.recipient || row.deliverTo || "no recipient"}</span>
                            <span className="text-muted-foreground">· {sheetDestination(row)}</span>
                            {fit && <span className={cn("font-medium", FIT_CLASSES[fit])}>· {FIT_LABELS[fit]}</span>}
                            <span className="ml-auto flex items-center gap-2">
                              <StatusBadge
                                status={row.tracking.status}
                                isReturnToShipper={row.tracking.isReturnToShipper}
                              />
                              <Button size="xs" variant="outline" onClick={() => onOpenShipment(row)}>
                                Open
                                <ArrowRight className="size-3" />
                              </Button>
                            </span>
                          </div>
                          {fedexDestination && (
                            <p className="px-2.5 pb-1.5 text-xs text-muted-foreground">
                              FedEx record shown goes to {fedexDestination}
                            </p>
                          )}
                          <details open={index === 0} className="group border-t">
                            <summary className="cursor-pointer px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:underline dark:text-indigo-300">
                              Why this record is shown for row {row.rowNumber}
                            </summary>
                            <div className="px-2.5 pb-2.5">
                              <SelectionLogic shipment={row} />
                            </div>
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
