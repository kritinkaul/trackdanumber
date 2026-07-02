"use client";

import { Controller, useForm } from "react-hook-form";
import { Search, X } from "lucide-react";

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
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search tracking number, city, state, or recipient…"
          className="bg-card pl-9"
          aria-label="Search shipments"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {selectConfigs.map((config) => (
          <Controller
            key={config.name}
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
                <SelectTrigger className="w-[130px] bg-card" aria-label={config.placeholder}>
                  <SelectValue placeholder={config.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {config.placeholder === "Status" ? "All Statuses" :
                     config.placeholder === "Office" ? "All Offices" :
                     `All ${config.placeholder}s`}
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
        ))}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X className="size-4" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
