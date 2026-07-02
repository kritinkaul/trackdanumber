"use client";

import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Package,
  Tag,
  Truck,
  Warehouse,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { KpiCounts, StatusFilter } from "@/hooks/useShipments";

interface KpiCardsProps {
  kpis: KpiCounts;
  activeStatus: StatusFilter;
  onSelectStatus: (status: StatusFilter) => void;
}

interface KpiDefinition {
  label: string;
  value: (k: KpiCounts) => number;
  status: StatusFilter;
  icon: typeof Package;
  iconClass: string;
}

const KPI_DEFINITIONS: KpiDefinition[] = [
  { label: "Total Shipments", value: (k) => k.total, status: "all", icon: Package, iconClass: "text-slate-500 bg-slate-100" },
  { label: "Delivered", value: (k) => k.delivered, status: "DELIVERED", icon: CheckCircle2, iconClass: "text-emerald-600 bg-emerald-50" },
  { label: "In Transit", value: (k) => k.inTransit, status: "IN_TRANSIT", icon: Truck, iconClass: "text-amber-600 bg-amber-50" },
  { label: "Out for Delivery", value: (k) => k.outForDelivery, status: "OUT_FOR_DELIVERY", icon: Warehouse, iconClass: "text-blue-600 bg-blue-50" },
  { label: "Exception", value: (k) => k.exception, status: "EXCEPTION", icon: AlertTriangle, iconClass: "text-red-600 bg-red-50" },
  { label: "Label Created", value: (k) => k.labelCreated, status: "LABEL_CREATED", icon: Tag, iconClass: "text-slate-500 bg-slate-100" },
  { label: "No Status", value: (k) => k.noStatus, status: "NO_STATUS", icon: HelpCircle, iconClass: "text-slate-500 bg-slate-100" },
];

export function KpiCards({ kpis, activeStatus, onSelectStatus }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-7">
      {KPI_DEFINITIONS.map((def) => {
        const Icon = def.icon;
        const isActive = activeStatus === def.status;
        return (
          <Card
            key={def.label}
            role="button"
            tabIndex={0}
            onClick={() => onSelectStatus(isActive && def.status !== "all" ? "all" : def.status)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectStatus(isActive && def.status !== "all" ? "all" : def.status);
              }
            }}
            className={cn(
              "cursor-pointer rounded-xl py-0 transition-shadow hover:shadow-sm",
              isActive && def.status !== "all" && "ring-2 ring-primary/40"
            )}
          >
            <CardContent className="flex items-start justify-between gap-2 p-4">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground">{def.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{def.value(kpis)}</p>
              </div>
              <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", def.iconClass)}>
                <Icon className="size-4" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
