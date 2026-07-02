"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { Shipment } from "@/types/shipment";

function SortableHeader({
  label,
  column,
}: {
  label: string;
  column: {
    getIsSorted: () => false | "asc" | "desc";
    toggleSorting: (desc?: boolean) => void;
  };
}) {
  const sorted = column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-8 px-2 font-medium"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {label}
      <Icon className="size-3.5 text-muted-foreground" />
    </Button>
  );
}

function muted(value: string | null): React.ReactNode {
  return value ? value : <span className="text-muted-foreground">—</span>;
}

export const shipmentColumns: ColumnDef<Shipment>[] = [
  {
    accessorKey: "trackingNumber",
    header: ({ column }) => <SortableHeader label="Tracking Number" column={column} />,
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.trackingNumber}</span>
    ),
  },
  {
    accessorKey: "deliverTo",
    header: ({ column }) => <SortableHeader label="Deliver To" column={column} />,
    cell: ({ row }) => muted(row.original.deliverTo),
  },
  {
    accessorKey: "city",
    header: ({ column }) => <SortableHeader label="City" column={column} />,
    cell: ({ row }) => muted(row.original.city),
  },
  {
    accessorKey: "state",
    header: ({ column }) => <SortableHeader label="State" column={column} />,
    cell: ({ row }) => muted(row.original.state),
  },
  {
    id: "status",
    accessorFn: (row) => row.tracking.status,
    header: ({ column }) => <SortableHeader label="Live Status" column={column} />,
    cell: ({ row }) => <StatusBadge status={row.original.tracking.status} />,
  },
  {
    id: "currentLocation",
    accessorFn: (row) => row.tracking.currentLocation ?? "",
    header: ({ column }) => <SortableHeader label="Current Location" column={column} />,
    cell: ({ row }) => muted(row.original.tracking.currentLocation),
  },
  {
    id: "origin",
    accessorFn: (row) => row.tracking.origin ?? "",
    header: ({ column }) => <SortableHeader label="Origin" column={column} />,
    cell: ({ row }) => muted(row.original.tracking.origin),
  },
  {
    id: "eta",
    accessorFn: (row) => row.tracking.estimatedDelivery ?? "",
    header: ({ column }) => <SortableHeader label="ETA" column={column} />,
    cell: ({ row }) => {
      const eta = row.original.tracking.estimatedDelivery;
      return eta ? formatDate(eta) : <span className="text-muted-foreground">—</span>;
    },
  },
  {
    id: "lastScan",
    accessorFn: (row) => row.tracking.lastScanTime ?? "",
    header: ({ column }) => <SortableHeader label="Last Scan" column={column} />,
    cell: ({ row }) => {
      const scan = row.original.tracking.lastScanTime;
      return scan ? formatDateTime(scan) : <span className="text-muted-foreground">—</span>;
    },
  },
  {
    id: "serviceType",
    accessorFn: (row) => row.tracking.serviceType ?? "",
    header: ({ column }) => <SortableHeader label="Service Type" column={column} />,
    cell: ({ row }) => muted(row.original.tracking.serviceType),
  },
];
