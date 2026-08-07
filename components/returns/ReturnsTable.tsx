"use client";

import { useEffect, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  History,
  Truck,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyButton } from "@/components/common/CopyButton";
import { ReturnLiveBadge } from "@/components/returns/ReturnLiveBadge";
import { ATTENTION_LABELS, sheetStatusClasses, type AttentionType } from "@/lib/return-insights";
import { cn, formatDateTime } from "@/lib/utils";
import type { ReturnAssetWithInsight } from "@/hooks/useReturnTracker";

const ATTENTION_CHIP_ICONS: Record<AttentionType, typeof Truck> = {
  READY_TO_COMPLETE: CheckCircle2,
  ON_ITS_WAY: Truck,
  SHEET_SAYS_DONE: AlertTriangle,
  FAILED_RETURN: XCircle,
  UNLOGGED_EXCEPTION: AlertTriangle,
  PREVIOUS_LABEL: History,
};

const ATTENTION_CHIP_CLASSES: Record<AttentionType, string> = {
  READY_TO_COMPLETE: "text-emerald-700 dark:text-emerald-300",
  ON_ITS_WAY: "text-blue-700 dark:text-blue-300",
  SHEET_SAYS_DONE: "text-amber-700 dark:text-amber-300",
  FAILED_RETURN: "text-red-700 dark:text-red-300",
  UNLOGGED_EXCEPTION: "text-red-700 dark:text-red-300",
  PREVIOUS_LABEL: "text-violet-700 dark:text-violet-300",
};

interface ReturnsTableProps {
  assets: ReturnAssetWithInsight[];
  onRowClick: (asset: ReturnAssetWithInsight) => void;
}

const PAGE_SIZES = [10, 25, 50, 100];

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

const returnColumns: ColumnDef<ReturnAssetWithInsight>[] = [
  {
    accessorKey: "serialNumber",
    header: ({ column }) => <SortableHeader label="Serial" column={column} />,
    cell: ({ row }) => (
      <span className="flex items-center gap-1">
        <span className="font-mono text-xs">{row.original.serialNumber}</span>
        <CopyButton
          value={row.original.serialNumber}
          label="Copy serial number"
          className="opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
        />
      </span>
    ),
  },
  {
    accessorKey: "assignedTo",
    header: ({ column }) => <SortableHeader label="Assigned To" column={column} />,
    cell: ({ row }) => (
      <div className="max-w-[200px]">
        <p className="truncate font-medium">{row.original.assignedTo || "—"}</p>
        {row.original.refreshNumber && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.original.refreshNumber}
          </p>
        )}
      </div>
    ),
  },
  {
    id: "trackingNumber",
    accessorFn: (row) => row.returnTrackingNumber,
    header: ({ column }) => <SortableHeader label="Return Tracking" column={column} />,
    cell: ({ row }) => {
      const asset = row.original;
      const activeNumber =
        asset.insight.activeLabel === "previous" && asset.previousReturnTrackingNumber
          ? asset.previousReturnTrackingNumber
          : asset.returnTrackingNumber;
      return (
        <div>
          <span className="flex items-center gap-1">
            <span className="font-mono text-xs">{activeNumber}</span>
            <CopyButton
              value={activeNumber}
              label="Copy tracking number"
              className="opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
            />
          </span>
          {asset.insight.shippedOnPreviousLabel && (
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-violet-700 dark:text-violet-300">
              <History className="size-3" />
              Previous label
            </span>
          )}
        </div>
      );
    },
  },
  {
    id: "live",
    accessorFn: (row) => row.insight.live,
    header: ({ column }) => <SortableHeader label="Live Status" column={column} />,
    cell: ({ row }) => {
      const { attentionType, attention } = row.original.insight;
      const Icon = attentionType ? ATTENTION_CHIP_ICONS[attentionType] : null;
      return (
        <div className="flex flex-col items-start gap-1">
          <ReturnLiveBadge live={row.original.insight.live} />
          {attentionType && Icon && (
            <span
              title={attention ?? undefined}
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                ATTENTION_CHIP_CLASSES[attentionType]
              )}
            >
              <Icon className="size-3 shrink-0" />
              {ATTENTION_LABELS[attentionType]}
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "sheetStatus",
    header: ({ column }) => <SortableHeader label="Sheet Status" column={column} />,
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={cn("font-medium", sheetStatusClasses(row.original.sheetStatus))}
      >
        {row.original.sheetStatus || "—"}
      </Badge>
    ),
  },
  {
    accessorKey: "routingDestination",
    header: ({ column }) => <SortableHeader label="Routing" column={column} />,
    cell: ({ row }) => (
      <span className="text-sm">{row.original.routingDestination || "—"}</span>
    ),
  },
  {
    id: "lastScan",
    accessorFn: (row) => row.insight.activeTracking.lastScanTime ?? "",
    header: ({ column }) => <SortableHeader label="Last Scan" column={column} />,
    cell: ({ row }) => {
      const scan = row.original.insight.activeTracking.lastScanTime;
      return scan ? (
        <span className="text-sm">{formatDateTime(scan)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
];

export function ReturnsTable({ assets, onRowClick }: ReturnsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: assets,
    columns: returnColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    initialState: { pagination: { pageSize: 25 } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalRows = assets.length;
  const firstRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min((pageIndex + 1) * pageSize, totalRows);
  const sortKey = sorting.map((s) => `${s.id}:${s.desc}`).join(",");

  // Keep the page index in range when filters shrink the data set.
  useEffect(() => {
    const maxIndex = Math.max(table.getPageCount() - 1, 0);
    if (pageIndex > maxIndex) table.setPageIndex(maxIndex);
  }, [assets, pageSize, pageIndex, table]);

  return (
    <Card className="surface-panel overflow-hidden rounded-none border-0 py-0 shadow-none ring-0">
      <Table>
        <TableCaption className="sr-only">
          Zero Touch return assets. Select a row to inspect both labels and full scan history.
        </TableCaption>
        <TableHeader className="bg-muted/55">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  aria-sort={
                    header.column.getIsSorted() === "asc"
                      ? "ascending"
                      : header.column.getIsSorted() === "desc"
                        ? "descending"
                        : "none"
                  }
                  className="sticky top-0 z-10 h-11 bg-muted px-4 text-xs uppercase tracking-wide text-muted-foreground"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={returnColumns.length}
                className="h-24 text-center text-muted-foreground"
              >
                No assets match the current filters.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row, index) => (
              <TableRow
                key={`${row.id}-${sortKey}`}
                onClick={() => onRowClick(row.original)}
                onKeyDown={(event) => {
                  if (
                    event.target === event.currentTarget &&
                    (event.key === "Enter" || event.key === " ")
                  ) {
                    event.preventDefault();
                    onRowClick(row.original);
                  }
                }}
                tabIndex={0}
                aria-label={`Open asset ${row.original.serialNumber}`}
                style={{ animationDelay: `${Math.min(index * 15, 300)}ms` }}
                className="group/row relative cursor-pointer border-border/70 outline-none animate-in fade-in-0 slide-in-from-top-1 fill-mode-both duration-300 ease-out transition-shadow hover:z-10 hover:bg-accent/35 hover:shadow-[0_1px_10px_oklch(0.12_0.02_250_/_8%)] focus-visible:bg-accent/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="h-16 px-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Showing <span className="tabular-nums">{firstRow}–{lastRow}</span> of{" "}
          <span className="tabular-nums">{totalRows}</span> assets
        </p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label="First page"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-2 text-sm tabular-nums">
              {pageIndex + 1} / {Math.max(table.getPageCount(), 1)}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              aria-label="Last page"
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
