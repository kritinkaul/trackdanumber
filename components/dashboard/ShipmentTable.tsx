"use client";

import { useEffect, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

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
import { shipmentColumns } from "@/components/dashboard/columns";
import type { Shipment } from "@/types/shipment";

interface ShipmentTableProps {
  shipments: Shipment[];
  onRowClick: (shipment: Shipment) => void;
}

const PAGE_SIZES = [10, 25, 50, 100];

export function ShipmentTable({ shipments, onRowClick }: ShipmentTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: shipments,
    columns: shipmentColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    initialState: { pagination: { pageSize: 25 } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalRows = shipments.length;
  const firstRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min((pageIndex + 1) * pageSize, totalRows);
  const sortKey = sorting.map((s) => `${s.id}:${s.desc}`).join(",");

  // Pagination is otherwise uncontrolled, so filtering/searching down to fewer
  // results while on page 2+ would leave `pageIndex` pointing past the end —
  // rendering an empty "no shipments match" page even though matches exist.
  useEffect(() => {
    const maxIndex = Math.max(table.getPageCount() - 1, 0);
    if (pageIndex > maxIndex) table.setPageIndex(maxIndex);
  }, [shipments, pageSize, pageIndex, table]);

  return (
    <Card className="surface-panel overflow-hidden rounded-none border-0 py-0 shadow-none ring-0">
      <Table>
        <TableCaption className="sr-only">
          Shipment tracking results. Select a row to inspect its full tracking history and asset
          details.
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
                  colSpan={shipmentColumns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No shipments match the current filters.
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
                  aria-label={`Open shipment ${row.original.trackingNumber}`}
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
          <span className="tabular-nums">{totalRows}</span> shipments
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
