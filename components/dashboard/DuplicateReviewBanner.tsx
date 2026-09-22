"use client";

import { ArrowRight, Copy } from "lucide-react";

import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { matchesDuplicateFilter, needsReview } from "@/lib/duplicates";
import type { Shipment } from "@/types/shipment";

export function DuplicateReviewBanner({
  shipments,
  onOpen,
}: {
  shipments: Shipment[];
  onOpen: () => void;
}) {
  const duplicates = shipments.filter((s) => matchesDuplicateFilter(s, "ANY"));
  if (duplicates.length === 0) return null;
  const trackingNumbers = new Set(duplicates.map((s) => s.trackingNumber)).size;
  const review = duplicates.filter(needsReview).length;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center dark:border-amber-500/30 dark:bg-amber-500/10"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-300">
        <Copy className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-amber-950 dark:text-amber-100">
          <AnimatedNumber value={trackingNumbers} /> duplicate tracking number
          {trackingNumbers === 1 ? "" : "s"} across <AnimatedNumber value={duplicates.length} /> row
          {duplicates.length === 1 ? "" : "s"}
          {review > 0 ? (
            <span className="text-red-700 dark:text-red-300">
              {" "}
              · <AnimatedNumber value={review} /> need{review === 1 ? "s" : ""} review
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-sm text-amber-900/80 dark:text-amber-200/80">
          See every duplicate in one place and why each FedEx record was chosen.
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-2 text-sm font-medium text-amber-50 transition-transform group-hover:translate-x-0.5 dark:bg-amber-300 dark:text-amber-950">
        Review duplicates
        <ArrowRight className="size-4" />
      </span>
    </button>
  );
}
