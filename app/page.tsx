"use client";

import { useState } from "react";
import { Package, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { DashboardSkeleton } from "@/components/common/TableSkeleton";
import { DestinationSummary } from "@/components/dashboard/DestinationSummary";
import { OfficeSummary } from "@/components/dashboard/OfficeSummary";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { RefreshButton } from "@/components/dashboard/RefreshButton";
import { ShipmentDetailDrawer } from "@/components/dashboard/ShipmentDetailDrawer";
import { ShipmentTable } from "@/components/dashboard/ShipmentTable";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { useShipments } from "@/hooks/useShipments";
import type { Shipment } from "@/types/shipment";

export default function DashboardPage() {
  const {
    shipments,
    filteredShipments,
    status,
    error,
    warnings,
    kpis,
    destinations,
    offices,
    filterOptions,
    search,
    setSearch,
    filters,
    setFilter,
    upload,
    refresh,
    reset,
  } = useShipments();

  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  const hasData = shipments.length > 0;
  const showUpload = !hasData && status !== "uploading";

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Package className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Shipment Dashboard</h1>
              <p className="text-xs text-muted-foreground">Daily FedEx tracking overview</p>
            </div>
          </div>
          {hasData && (
            <div className="flex items-center gap-2">
              <RefreshButton onRefresh={refresh} isRefreshing={status === "refreshing"} />
              <Button variant="ghost" onClick={reset}>
                <Upload className="size-4" />
                New upload
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {error && (
          <ErrorBanner
            message={error}
            onRetry={status === "error" && !hasData ? undefined : refresh}
          />
        )}

        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <ul className="list-inside list-disc space-y-0.5">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {showUpload && (
          <div className="mx-auto max-w-2xl pt-10">
            <UploadDropzone onFileSelected={upload} isUploading={false} />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Upload the daily shipment spreadsheet. Tracking numbers are matched by
              header name — no column mapping needed.
            </p>
          </div>
        )}

        {status === "uploading" && (
          <div className="space-y-6">
            <div className="mx-auto max-w-2xl">
              <UploadDropzone onFileSelected={upload} isUploading />
            </div>
            <DashboardSkeleton />
          </div>
        )}

        {hasData && (
          <>
            <KpiCards
              kpis={kpis}
              activeStatus={filters.status}
              onSelectStatus={(s) => setFilter("status", s)}
            />
            <OfficeSummary
              offices={offices}
              activeOffice={filters.office}
              onSelectOffice={(office) => setFilter("office", office)}
            />
            <DestinationSummary
              destinations={destinations}
              activeCity={filters.city}
              onSelectCity={(city) => setFilter("city", city)}
            />
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={setFilter}
              options={filterOptions}
            />
            <ShipmentTable shipments={filteredShipments} onRowClick={setSelectedShipment} />
          </>
        )}
      </main>

      <ShipmentDetailDrawer
        shipment={selectedShipment}
        onClose={() => setSelectedShipment(null)}
      />
    </div>
  );
}
