"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/common/CopyButton";
import { DuplicateBadges } from "@/components/common/DuplicateBadge";
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
      aria-label={`Sort by ${label}${sorted ? `, currently ${sorted === "asc" ? "ascending" : "descending"}` : ""}`}
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
      <div>
        <span className="flex items-center gap-1">
          <span className="font-mono text-xs">{row.original.trackingNumber}</span>
          <CopyButton
            value={row.original.trackingNumber}
            label="Copy tracking number"
            className="opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
          />
        </span>
        <span className="text-[11px] text-muted-foreground">Sheet row {row.original.rowNumber}</span>
      </div>
    ),
  },
  {
    id: "recipient",
    accessorFn: (row) => row.recipient || row.deliverTo,
    header: ({ column }) => <SortableHeader label="Recipient & destination" column={column} />,
    cell: ({ row }) => {
      const shipment = row.original;
      const recipient = shipment.recipient || shipment.deliverTo;
      const destination = [shipment.city, shipment.state].filter(Boolean).join(", ");

      return (
        <div className="max-w-[260px]">
          <p className="truncate font-medium">{muted(recipient)}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            {shipment.office?.replace(/^A&M\s*-\s*/i, "") || destination || "Destination unavailable"}
          </p>
        </div>
      );
    },
  },
  {
    id: "status",
    accessorFn: (row) => row.tracking.status,
    header: ({ column }) => <SortableHeader label="Live Status" column={column} />,
    cell: ({ row }) => (
      <StatusBadge
        status={row.original.tracking.status}
        isReturnToShipper={row.original.tracking.isReturnToShipper}
      />
    ),
  },
  {
    id: "duplicate",
    // Sort order: conflicts and undecided FedEx records first, then other duplicates.
    accessorFn: (row) =>
      (row.duplicate?.kind === "CONFLICT" ? 4 : 0) +
      (row.match.confidence === "ambiguous" ? 3 : 0) +
      (row.duplicate ? 1 : 0) +
      (row.match.candidateCount > 1 ? 1 : 0),
    header: ({ column }) => <SortableHeader label="Duplicate check" column={column} />,
    cell: ({ row }) => <DuplicateBadges shipment={row.original} />,
  },
  {
    id: "currentLocation",
    accessorFn: (row) => row.tracking.currentLocation ?? "",
    header: ({ column }) => <SortableHeader label="Current Location" column={column} />,
    cell: ({ row }) => muted(row.original.tracking.currentLocation),
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
    header: ({ column }) => <SortableHeader label="Service" column={column} />,
    cell: ({ row }) => muted(row.original.tracking.serviceType),
  },
];
