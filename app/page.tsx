"use client";

import { useState } from "react";
import Image from "next/image";
import { Activity, FileSpreadsheet, ShieldCheck, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { DashboardSkeleton } from "@/components/common/TableSkeleton";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useToast } from "@/components/common/Toast";
import { DestinationSummary } from "@/components/dashboard/DestinationSummary";
import { OfficeDeliveryBoard } from "@/components/dashboard/OfficeDeliveryBoard";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { RefreshButton } from "@/components/dashboard/RefreshButton";
import { ShipmentDetailDrawer } from "@/components/dashboard/ShipmentDetailDrawer";
import { ShipmentTable } from "@/components/dashboard/ShipmentTable";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { downloadShipmentsCsv } from "@/lib/export";
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
  const { toast } = useToast();

  const hasData = shipments.length > 0;
  const showUpload = !hasData && status !== "uploading";

  const handleUpload = async (file: File) => {
    const result = await upload(file);
    if (result.ok) {
      toast({
        title: `Loaded ${result.count.toLocaleString()} shipment${result.count === 1 ? "" : "s"}`,
        description: "Manifest imported and live status is now tracking.",
        variant: "success",
      });
    }
  };

  const handleRefresh = async () => {
    const result = await refresh();
    if (result.ok) {
      toast({
        title: "Status refreshed",
        description: `Latest carrier status pulled for ${result.count.toLocaleString()} shipment${result.count === 1 ? "" : "s"}.`,
        variant: "success",
      });
    }
  };

  const handleExport = (targetShipments: Shipment[], exportFilters = filters) => {
    downloadShipmentsCsv(targetShipments, exportFilters);
    toast({
      title: `Exported ${targetShipments.length.toLocaleString()} shipment${targetShipments.length === 1 ? "" : "s"}`,
      description: "Your CSV download has started.",
      variant: "success",
    });
  };

  return (
    <div className="relative min-h-screen">
      <div aria-hidden className="dashboard-grid pointer-events-none absolute inset-x-0 top-0 h-[620px]" />

      <header className="command-header sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/am-logo.png"
              alt="Alvarez & Marsal"
              width={600}
              height={338}
              priority
              className="h-11 w-auto dark:brightness-0 dark:invert"
            />
            <span aria-hidden className="hidden h-7 w-px bg-border sm:block" />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-semibold leading-tight">Shipment Control Center</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Global Services · Asset logistics</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasData ? (
              <>
              <RefreshButton onRefresh={handleRefresh} isRefreshing={status === "refreshing"} />
              <Button variant="ghost" onClick={reset} className="hidden sm:inline-flex">
                <Upload className="size-4" />
                New upload
              </Button>
              </>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1500px] space-y-6 px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        {error && (
          <ErrorBanner
            message={error}
            onRetry={status === "error" && !hasData ? undefined : refresh}
          />
        )}

        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <ul className="list-inside list-disc space-y-0.5">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {showUpload && (
          <section className="grid min-h-[calc(100vh-11rem)] items-center gap-10 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-12">
            <div className="max-w-xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                Carrier services online
              </div>
              <p className="eyebrow">Daily operations workspace</p>
              <h1 className="mt-3 max-w-lg text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-5xl">
                Track every shipment in one place.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
                Upload the daily shipment report to surface exceptions, coordinate office
                deliveries, and give every recipient a reliable status.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="flex gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Activity className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Live carrier status</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Track movement, ETAs, and exceptions.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Coordinator-ready exports</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Share filtered recipient lists in seconds.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="surface-panel rounded-3xl p-3 sm:p-5">
              <div className="mb-4 flex items-center justify-between px-1">
                <div>
                  <p className="eyebrow">Start a new view</p>
                  <h2 className="mt-1 text-lg font-semibold">Import shipment manifest</h2>
                </div>
                <FileSpreadsheet className="size-5 text-muted-foreground" />
              </div>
              <UploadDropzone onFileSelected={handleUpload} isUploading={false} />
              <p className="mt-3 px-1 text-xs leading-5 text-muted-foreground">
                Tracking numbers are matched by header name. No manual column mapping is
                required.
              </p>
            </div>
          </section>
        )}

        {status === "uploading" && (
          <div className="space-y-7 py-6">
            <div className="mx-auto max-w-3xl">
              <UploadDropzone onFileSelected={handleUpload} isUploading />
            </div>
            <DashboardSkeleton />
          </div>
        )}

        {hasData && (
          <>
            <section className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Live manifest
                </div>
                <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                  Operations overview
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Prioritize exceptions and today&apos;s office handoffs, then drill into the
                  full shipment registry.
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="eyebrow">Current scope</p>
                <p className="mt-1 text-sm">
                  <AnimatedNumber value={filteredShipments.length} className="font-semibold" />
                  <span className="text-muted-foreground">
                    {" "}
                    of <AnimatedNumber value={shipments.length} /> shipments
                  </span>
                </p>
              </div>
            </section>

            <KpiCards
              kpis={kpis}
              activeStatus={filters.status}
              onSelectStatus={(shipmentStatus) => setFilter("status", shipmentStatus)}
            />

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
              <OfficeDeliveryBoard shipments={shipments} onSelectShipment={setSelectedShipment} />
              <DestinationSummary
                destinations={destinations}
                activeCity={filters.city}
                onSelectCity={(city) => setFilter("city", city)}
              />
            </div>

            <section aria-labelledby="shipment-registry-title" className="surface-panel overflow-hidden rounded-2xl">
              <div className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eyebrow">Investigate &amp; act</p>
                  <h2 id="shipment-registry-title" className="mt-1 text-lg font-semibold tracking-tight">
                    Shipment registry
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select any row for full movement history and asset details
                </p>
              </div>
              <FilterBar
                search={search}
                onSearchChange={setSearch}
                filters={filters}
                onFilterChange={setFilter}
                options={filterOptions}
                onExport={() => handleExport(filteredShipments)}
                exportCount={filteredShipments.length}
              />
              <ShipmentTable shipments={filteredShipments} onRowClick={setSelectedShipment} />
            </section>
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
