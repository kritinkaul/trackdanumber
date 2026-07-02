import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { ShipmentStatus } from "@/types/shipment";

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_BADGE_CLASSES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
