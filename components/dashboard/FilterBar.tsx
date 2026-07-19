"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ChevronDown, Download, Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_LABELS } from "@/lib/status";
import type { ShipmentFilters } from "@/hooks/useShipments";
import type { ShipmentStatus } from "@/types/shipment";

interface FilterOptions {
  cities: string[];
  states: string[];
  carriers: string[];
  offices: string[];
  statuses: ShipmentStatus[];
}

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: ShipmentFilters;
  onFilterChange: <K extends keyof ShipmentFilters>(key: K, value: ShipmentFilters[K]) => void;
  options: FilterOptions;
  /** Exports the currently filtered rows as a CSV download. */
  onExport: () => void;
  /** Number of rows the export would contain (0 disables the button). */
  exportCount: number;
}

interface FilterFormValues {
  status: string;
  city: string;
  state: string;
  carrier: string;
  office: string;
}

export function FilterBar({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  options,
  onExport,
  exportCount,
}: FilterBarProps) {
  // `values` keeps the form in sync when filters change externally
  // (KPI card clicks, destination chips, reset after upload).
  const { control, reset } = useForm<FilterFormValues>({
    values: { ...filters, office: filters.office },
  });

  const hasActiveFilters =
    search !== "" ||
    filters.status !== "all" ||
    filters.city !== "all" ||
    filters.state !== "all" ||
    filters.carrier !== "all" ||
    filters.office !== "all";

  const activeFilterCount = [
    filters.status !== "all",
    filters.city !== "all",
    filters.state !== "all",
    filters.carrier !== "all",
    filters.office !== "all",
  ].filter(Boolean).length;
  const [showFilters, setShowFilters] = useState(false);

  const clearAll = () => {
    onSearchChange("");
    onFilterChange("status", "all");
    onFilterChange("city", "all");
    onFilterChange("state", "all");
    onFilterChange("carrier", "all");
    onFilterChange("office", "all");
    reset({ status: "all", city: "all", state: "all", carrier: "all", office: "all" });
  };

  const selectConfigs = [
    {
      name: "status" as const,
      placeholder: "Status",
      items: options.statuses.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
      onChange: (value: string) => onFilterChange("status", value as ShipmentStatus | "all"),
    },
    {
      name: "city" as const,
      placeholder: "City",
      items: options.cities.map((c) => ({ value: c, label: c })),
      onChange: (value: string) => onFilterChange("city", value),
    },
    {
      name: "state" as const,
      placeholder: "State",
      items: options.states.map((s) => ({ value: s, label: s })),
      onChange: (value: string) => onFilterChange("state", value),
    },
    {
      name: "carrier" as const,
      placeholder: "Carrier",
      items: options.carriers.map((c) => ({ value: c, label: c })),
      onChange: (value: string) => onFilterChange("carrier", value),
    },
    {
      name: "office" as const,
      placeholder: "Office",
      items: options.offices.map((o) => ({
        value: o,
        label: o.replace(/^A&M\s*-\s*/i, "A&M - "),
      })),
      onChange: (value: string) => onFilterChange("office", value),
    },
  ];

  return (
    <div className="border-b">
      <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search tracking, recipient, office, city, or state"
            className="h-10 bg-background pl-9"
            aria-label="Search shipments"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={showFilters || activeFilterCount > 0 ? "secondary" : "outline"}
            size="lg"
            onClick={() => setShowFilters((visible) => !visible)}
            aria-expanded={showFilters}
            aria-controls="shipment-advanced-filters"
            className="flex-1 sm:flex-none"
          >
            <SlidersHorizontal className="size-4" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : null}
            <ChevronDown
              className={`size-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`}
            />
          </Button>
          <Button
            size="lg"
            onClick={onExport}
            disabled={exportCount === 0}
            title={
              exportCount === 0
                ? "No shipments to export"
                : `Export ${exportCount} shipment${exportCount === 1 ? "" : "s"} as CSV`
            }
            className="flex-1 sm:flex-none"
          >
            <Download className="size-4" />
            Export CSV
            <span className="rounded-full bg-primary-foreground/15 px-1.5 text-xs tabular-nums">
              {exportCount}
            </span>
          </Button>
        </div>
      </div>

      {showFilters ? (
        <div
          id="shipment-advanced-filters"
          className="flex flex-wrap items-end gap-3 border-t bg-muted/25 px-4 py-3"
        >
          {selectConfigs.map((config) => (
            <div key={config.name} className="min-w-[140px] flex-1 sm:flex-none">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {config.placeholder}
              </label>
              <Controller
                control={control}
                name={config.name}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      config.onChange(value);
                    }}
                  >
                    <SelectTrigger className="w-full bg-background sm:w-[156px]">
                      <SelectValue placeholder={config.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {config.placeholder === "Status"
                          ? "All Statuses"
                          : config.placeholder === "Office"
                            ? "All Offices"
                            : `All ${config.placeholder}s`}
                      </SelectItem>
                      {config.items.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          ))}
          {hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={clearAll} className="mb-0.5">
              <X className="size-4" />
              Clear all
            </Button>
          ) : null}
        </div>
      ) : null}

      {!showFilters && hasActiveFilters ? (
        <div className="flex items-center gap-2 border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
          <span>{activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}</span>
          <span aria-hidden>·</span>
          <button type="button" onClick={clearAll} className="font-medium text-foreground hover:underline">
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}
