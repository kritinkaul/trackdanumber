import { AlertTriangle, CheckCircle2, Copy, Layers, Repeat } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DuplicateKind, MatchConfidence, Shipment } from "@/types/shipment";

export const DUPLICATE_KIND_LABELS: Record<DuplicateKind, string> = {
  EXACT: "Identical rows",
  SAME_DESTINATION: "Same destination",
  CONFLICT: "Conflict",
};

export const MATCH_CONFIDENCE_LABELS: Record<MatchConfidence, string> = {
  single: "Single record",
  matched: "Matched by destination",
  likely: "Likely match",
  ambiguous: "Needs a pick",
  manual: "Picked manually",
};

const DUPLICATE_KIND_CLASSES: Record<DuplicateKind, string> = {
  EXACT: "bg-slate-500/10 text-slate-700 border-slate-500/25 dark:text-slate-300",
  SAME_DESTINATION: "bg-sky-500/10 text-sky-700 border-sky-500/25 dark:text-sky-300",
  CONFLICT: "bg-red-500/10 text-red-700 border-red-500/25 dark:text-red-300",
};

const DUPLICATE_KIND_ICONS: Record<DuplicateKind, typeof Copy> = {
  EXACT: Copy,
  SAME_DESTINATION: Layers,
  CONFLICT: AlertTriangle,
};

const MATCH_CLASSES: Record<Exclude<MatchConfidence, "single">, string> = {
  matched: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
  manual: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
  likely: "bg-amber-500/12 text-amber-800 border-amber-500/25 dark:text-amber-300",
  ambiguous: "bg-red-500/10 text-red-700 border-red-500/25 dark:text-red-300",
};

/** Summarises a row's duplicate situation for the registry's "Duplicate check" column. */
export function DuplicateBadges({ shipment }: { shipment: Shipment }) {
  const { duplicate, match } = shipment;
  if (!duplicate && match.candidateCount <= 1) {
    return <span className="text-muted-foreground">—</span>;
  }

  const DuplicateIcon = duplicate ? DUPLICATE_KIND_ICONS[duplicate.kind] : null;
  const fitHint =
    duplicate?.kind === "CONFLICT"
      ? duplicate.carrierFit === "match"
        ? " · FedEx matches"
        : duplicate.carrierFit === "mismatch"
          ? " · FedEx doesn't match"
          : ""
      : "";

  return (
    <span className="inline-flex max-w-[220px] flex-wrap items-center gap-1">
      {duplicate && DuplicateIcon ? (
        <Badge
          variant="outline"
          title={duplicate.note}
          className={cn("gap-1 font-medium", DUPLICATE_KIND_CLASSES[duplicate.kind])}
        >
          <DuplicateIcon className="size-3" />
          {DUPLICATE_KIND_LABELS[duplicate.kind]} ×{duplicate.groupSize}
          {fitHint}
        </Badge>
      ) : null}
      {match.candidateCount > 1 && match.confidence !== "single" ? (
        <Badge
          variant="outline"
          title={match.reason}
          className={cn("gap-1 font-medium", MATCH_CLASSES[match.confidence])}
        >
          {match.confidence === "matched" || match.confidence === "manual" ? (
            <CheckCircle2 className="size-3" />
          ) : (
            <Repeat className="size-3" />
          )}
          FedEx ×{match.candidateCount} · {MATCH_CONFIDENCE_LABELS[match.confidence]}
        </Badge>
      ) : null}
    </span>
  );
}
