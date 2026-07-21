import { AlertTriangle, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { ShipmentStatus } from "@/types/shipment";

interface StatusBadgeProps {
  status: ShipmentStatus;
  /** When true, the badge reflects the return leg instead of the forward delivery. */
  isReturnToShipper?: boolean;
}

const RETURN_COMPLETE_CLASSES =
  "bg-violet-500/10 text-violet-700 border-violet-500/25 dark:text-violet-300";
const RETURN_IN_PROGRESS_CLASSES =
  "bg-amber-500/12 text-amber-800 border-amber-500/25 dark:text-amber-300";
const RETURN_EXCEPTION_CLASSES =
  "bg-red-500/10 text-red-700 border-red-500/25 dark:text-red-300";
const RETURN_DETECTED_CLASSES =
  "bg-violet-500/10 text-violet-700 border-violet-500/25 dark:text-violet-300";

/**
 * A carrier status of DELIVERED on a return-flagged shipment means it was
 * delivered back to the shipper, not to the original recipient — that's a
 * meaningfully different outcome, so it gets its own label and color instead
 * of blending into the normal green "Delivered" badge.
 *
 * Likewise, a return-flagged shipment can independently be stuck in an
 * EXCEPTION state on its way back. That must not collapse into the same
 * calm "Returning to Shipper" badge as a normal in-progress return, or the
 * exception is invisible next to non-exception returns.
 */
export function StatusBadge({ status, isReturnToShipper }: StatusBadgeProps) {
  // `isReturnToShipper` is detected from carrier scan text and is independent
  // of `status` (a mapped status code). When status is UNKNOWN/UNAVAILABLE we
  // have no reliable live state, so claiming a confident "Returning to
  // Shipper" label would overstate certainty — and would silently disagree
  // with a status filter that matched on UNKNOWN. Keep the real status as the
  // primary badge and surface the return signal as a secondary indicator.
  const hasConfidentStatus = status !== "UNKNOWN" && status !== "UNAVAILABLE";

  if (isReturnToShipper && hasConfidentStatus) {
    if (status === "EXCEPTION") {
      return (
        <Badge variant="outline" className={cn("gap-1 font-medium", RETURN_EXCEPTION_CLASSES)}>
          <AlertTriangle className="size-3" />
          Return Exception
        </Badge>
      );
    }
    const isComplete = status === "DELIVERED";
    return (
      <Badge
        variant="outline"
        className={cn(
          "gap-1 font-medium",
          isComplete ? RETURN_COMPLETE_CLASSES : RETURN_IN_PROGRESS_CLASSES
        )}
      >
        <Undo2 className="size-3" />
        {isComplete ? "Returned to Shipper" : "Returning to Shipper"}
      </Badge>
    );
  }

  const baseBadge = (
    <Badge variant="outline" className={cn("font-medium", STATUS_BADGE_CLASSES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );

  if (!isReturnToShipper) return baseBadge;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {baseBadge}
      <Badge variant="outline" className={cn("gap-1 font-medium", RETURN_DETECTED_CLASSES)}>
        <Undo2 className="size-3" />
        Return detected
      </Badge>
    </span>
  );
}
