"use client";

import { useState } from "react";
import { Download, Search, Undo2, X } from "lucide-react";

import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { useToast } from "@/components/common/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReturnDetailDrawer } from "@/components/returns/ReturnDetailDrawer";
import { ReturnKpiCards } from "@/components/returns/ReturnKpiCards";
import { ReturnsTable } from "@/components/returns/ReturnsTable";
import { downloadReturnsCsv } from "@/lib/return-export";
import type { useReturnTracker, ReturnAssetWithInsight } from "@/hooks/useReturnTracker";

interface ReturnsDashboardProps {
  tracker: ReturnType<typeof useReturnTracker>;
}

export function ReturnsDashboard({ tracker }: ReturnsDashboardProps) {
  const {
    assets,
    filteredAssets,
    kpis,
    sheetStatuses,
    search,
    setSearch,
    liveFilter,
    setLiveFilter,
    sheetStatusFilter,
    setSheetStatusFilter,
  } = tracker;

  const [selectedAsset, setSelectedAsset] = useState<ReturnAssetWithInsight | null>(null);
  const { toast } = useToast();

  const hasActiveFilters = search !== "" || liveFilter !== "all" || sheetStatusFilter !== "all";

  const handleExport = () => {
    downloadReturnsCsv(filteredAssets, liveFilter);
    toast({
      title: `Exported ${filteredAssets.length.toLocaleString()} asset${filteredAssets.length === 1 ? "" : "s"}`,
      description: "Your CSV download has started.",
      variant: "success",
    });
  };

  return (
    <>
      <section className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
            <Undo2 className="size-3" />
            Zero Touch Return Tracker
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Return operations
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Live carrier status for every return label — including assets shipped on a
            previous label — with sheet-vs-carrier mismatches flagged for follow-up.
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="eyebrow">Current scope</p>
          <p className="mt-1 text-sm">
            <AnimatedNumber value={filteredAssets.length} className="font-semibold" />
            <span className="text-muted-foreground">
              {" "}
              of <AnimatedNumber value={assets.length} /> assets
            </span>
          </p>
        </div>
      </section>

      <ReturnKpiCards kpis={kpis} activeFilter={liveFilter} onSelectFilter={setLiveFilter} />

      <section aria-labelledby="returns-registry-title" className="surface-panel overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Investigate &amp; act</p>
            <h2 id="returns-registry-title" className="mt-1 text-lg font-semibold tracking-tight">
              Asset return registry
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Select any row to see both labels and full scan history
          </p>
        </div>

        <div className="border-b">
          <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search serial, name, tracking number, RITM, or SCTASK"
                className="h-10 bg-background pl-9"
                aria-label="Search return assets"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={sheetStatusFilter}
                onValueChange={(value) => setSheetStatusFilter(value)}
              >
                <SelectTrigger className="h-10 w-[200px] bg-background" aria-label="Sheet status filter">
                  <SelectValue placeholder="Sheet status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sheet Statuses</SelectItem>
                  {sheetStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setLiveFilter("all");
                    setSheetStatusFilter("all");
                  }}
                >
                  <X className="size-4" />
                  Clear all
                </Button>
              ) : null}
              <Button
                size="lg"
                onClick={handleExport}
                disabled={filteredAssets.length === 0}
                title={
                  filteredAssets.length === 0
                    ? "No assets to export"
                    : `Export ${filteredAssets.length} asset${filteredAssets.length === 1 ? "" : "s"} as CSV`
                }
              >
                <Download className="size-4" />
                Export CSV
                <span className="rounded-full bg-primary-foreground/15 px-1.5 text-xs tabular-nums">
                  {filteredAssets.length}
                </span>
              </Button>
            </div>
          </div>
        </div>

        <ReturnsTable assets={filteredAssets} onRowClick={setSelectedAsset} />
      </section>

      <ReturnDetailDrawer asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
    </>
  );
}
