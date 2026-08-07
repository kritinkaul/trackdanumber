import { AlertTriangle, CheckCircle2, CircleDashed, HelpCircle, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  RETURN_LIVE_BADGE_CLASSES,
  RETURN_LIVE_LABELS,
  type ReturnLiveStatus,
} from "@/lib/return-insights";
import { cn } from "@/lib/utils";

const LIVE_ICONS: Record<ReturnLiveStatus, typeof Truck> = {
  AWAITING_DROPOFF: CircleDashed,
  IN_TRANSIT: Truck,
  DELIVERED: CheckCircle2,
  EXCEPTION: AlertTriangle,
  NO_DATA: HelpCircle,
};

/** Live carrier state of a return label, in returns-flow language. */
export function ReturnLiveBadge({ live }: { live: ReturnLiveStatus }) {
  const Icon = LIVE_ICONS[live];
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", RETURN_LIVE_BADGE_CLASSES[live])}>
      <Icon className="size-3" />
      {RETURN_LIVE_LABELS[live]}
    </Badge>
  );
}
