"use client";

import { CheckCircle2, Lightbulb } from "lucide-react";

import { MATCH_CONFIDENCE_LABELS } from "@/components/common/DuplicateBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { matchContextForRow } from "@/lib/shipment-assembly";
import { compareDestination } from "@/lib/tracking-match";
import { cn } from "@/lib/utils";
import type { CarrierCandidate, CarrierDestination, CarrierFit, Shipment } from "@/types/shipment";

const SCORING_RULES: { label: string; points: string }[] = [
  { label: "FedEx ZIP matches / differs from the sheet ZIP", points: "+100 / −80" },
  { label: "Ship date within 7 days / over 30 days from the sheet's", points: "+60 / −40" },
  { label: "City matches / differs", points: "+40 / −15" },
  { label: "State matches / differs", points: "+30 / −60" },
  { label: "Most recent use of the number / an older use", points: "+5 / −30" },
  { label: "Record has no FedEx scans at all", points: "−25" },
];

const FIT_TEXT: Record<CarrierFit, string> = {
  match: "Matches",
  mismatch: "Doesn't match",
  unknown: "Can't compare",
};

const FIT_CLASSES: Record<CarrierFit, string> = {
  match: "text-emerald-700 dark:text-emerald-300",
  mismatch: "text-red-700 dark:text-red-300",
  unknown: "text-muted-foreground",
};

export function formatCarrierDestination(destination: CarrierDestination | null): string {
  if (!destination) return "";
  const place = [destination.city, destination.state].filter(Boolean).join(", ");
  return [place, destination.postalCode].filter(Boolean).join(" ");
}

function sheetDestinationText(shipment: Shipment): string {
  const context = matchContextForRow(shipment);
  const place = [context.city, context.state].filter(Boolean).join(", ");
  return [place, context.postalCode].filter(Boolean).join(" ");
}

function formatPoints(points: number): string {
  if (points > 0) return `+${points}`;
  if (points < 0) return `−${Math.abs(points)}`;
  return "0";
}

function recordLabel(candidate: CarrierCandidate | undefined, index: number): string {
  const destination = candidate ? formatCarrierDestination(candidate.tracking.destination) : "";
  return `Record ${index + 1}${destination ? ` · to ${destination}` : ""}`;
}

/**
 * Explains, step by step, why the FedEx record on screen was picked for this
 * row: what the sheet says, what FedEx says, each record's score breakdown
 * and which decision rule applied.
 */
export function SelectionLogic({ shipment, className }: { shipment: Shipment; className?: string }) {
  const { match, carrierCandidates, duplicate, tracking } = shipment;
  const evaluations = match.evaluations ?? [];
  const byId = new Map(carrierCandidates.map((c) => [c.uniqueId, c]));
  const sheetText = sheetDestinationText(shipment);
  const fedexText = formatCarrierDestination(tracking.destination);
  const fit = compareDestination(matchContextForRow(shipment), tracking.destination).fit;
  const rule =
    match.rule ||
    (match.candidateCount > 1
      ? match.reason
      : "FedEx has only one shipment on this number, so there was nothing to choose between.");

  return (
    <div
      className={cn(
        "rounded-xl border border-indigo-300 bg-indigo-50/70 px-3 py-3 text-sm text-indigo-950 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100",
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <Lightbulb className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Why this FedEx record is shown</p>
          <p className="mt-0.5 text-xs opacity-80">
            {match.candidateCount > 1
              ? `FedEx returned ${match.candidateCount} shipments for this number · ${MATCH_CONFIDENCE_LABELS[match.confidence]}`
              : "FedEx returned 1 shipment for this number"}
          </p>
        </div>
      </div>

      <ol className="mt-3 space-y-2.5 text-xs text-foreground">
        <li className="rounded-lg bg-background/80 px-2.5 py-2">
          <p className="font-medium">1. Compare destinations</p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <dt className="text-muted-foreground">Sheet (row {shipment.rowNumber})</dt>
            <dd>{sheetText || "no city, state or ZIP on the sheet"}</dd>
            <dt className="text-muted-foreground">FedEx record shown</dt>
            <dd>{fedexText || "FedEx doesn't give a destination"}</dd>
            <dt className="text-muted-foreground">Result</dt>
            <dd className={cn("font-medium", FIT_CLASSES[fit])}>{FIT_TEXT[fit]}</dd>
          </dl>
        </li>

        {evaluations.length > 1 && (
          <li className="rounded-lg bg-background/80 px-2.5 py-2">
            <p className="font-medium">2. Score every FedEx record</p>
            <ul className="mt-1.5 space-y-2">
              {evaluations.map((evaluation) => {
                const candidate = byId.get(evaluation.uniqueId);
                const index = carrierCandidates.findIndex((c) => c.uniqueId === evaluation.uniqueId);
                const isSelected = evaluation.uniqueId === match.selectedId;
                return (
                  <li
                    key={evaluation.uniqueId}
                    className={cn(
                      "rounded-md border px-2 py-1.5",
                      isSelected ? "border-primary/50 bg-primary/5" : "border-border"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      {candidate && (
                        <StatusBadge
                          status={candidate.tracking.status}
                          isReturnToShipper={candidate.tracking.isReturnToShipper}
                        />
                      )}
                      <span className="font-medium">{recordLabel(candidate, index)}</span>
                      <span className="ml-auto font-mono font-semibold tabular-nums">
                        {formatPoints(evaluation.score)} pts
                      </span>
                      {isSelected && (
                        <span className="flex items-center gap-0.5 font-medium text-primary">
                          <CheckCircle2 className="size-3.5" />
                          Shown
                        </span>
                      )}
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {evaluation.signals.length === 0 ? (
                        <li className="text-muted-foreground">No checks applied</li>
                      ) : (
                        evaluation.signals.map((signal) => (
                          <li key={signal.label} className="flex justify-between gap-3">
                            <span className="text-muted-foreground">{signal.label}</span>
                            <span
                              className={cn(
                                "shrink-0 font-mono tabular-nums",
                                signal.points > 0 && "text-emerald-700 dark:text-emerald-300",
                                signal.points < 0 && "text-red-700 dark:text-red-300"
                              )}
                            >
                              {formatPoints(signal.points)}
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </li>
        )}

        <li className="rounded-lg bg-background/80 px-2.5 py-2">
          <p className="font-medium">{evaluations.length > 1 ? "3." : "2."} Decision</p>
          <p className="mt-0.5">{rule}</p>
          {duplicate && (
            <p className="mt-1.5 text-muted-foreground">
              <span className="font-medium text-foreground">Other rows on this number: </span>
              {duplicate.note}
            </p>
          )}
        </li>
      </ol>

      <details className="mt-2.5 text-xs">
        <summary className="cursor-pointer font-medium opacity-90 hover:opacity-100">
          How the scoring works
        </summary>
        <div className="mt-1.5 space-y-1.5 rounded-lg bg-background/80 px-2.5 py-2 text-foreground">
          <ul className="space-y-0.5">
            {SCORING_RULES.map((scoringRule) => (
              <li key={scoringRule.label} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{scoringRule.label}</span>
                <span className="shrink-0 font-mono tabular-nums">{scoringRule.points}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            The highest score is shown. It&apos;s marked <b>Matched by destination</b> when only that
            record&apos;s destination fits the sheet, <b>Likely match</b> when it leads the next record by 20+
            points, and <b>Needs a pick</b> otherwise. A record you choose with “This is ours” always wins and
            is kept across refreshes.
          </p>
        </div>
      </details>
    </div>
  );
}
