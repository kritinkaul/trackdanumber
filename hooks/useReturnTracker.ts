"use client";

import { useCallback, useMemo, useState } from "react";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  ATTENTION_TYPES,
  deriveReturnInsight,
  type AttentionType,
  type ReturnInsight,
  type ReturnLiveStatus,
} from "@/lib/return-insights";
import { assembleReturnAssets } from "@/lib/shipment-assembly";
import type { ReturnAsset, ReturnsUploadResponse } from "@/types/return-tracker";
import type { ApiError, RefreshResponse } from "@/types/shipment";

/**
 * "ATTENTION" filters to every flagged row; the individual AttentionType
 * values narrow to one specific kind of mismatch (what the breakdown chips
 * in the KPI strip link to).
 */
export type ReturnLiveFilter = ReturnLiveStatus | "all" | "ATTENTION" | AttentionType;

export interface ReturnAssetWithInsight extends ReturnAsset {
  insight: ReturnInsight;
}

export interface ReturnKpis {
  total: number;
  awaitingDropoff: number;
  inTransit: number;
  delivered: number;
  exceptions: number;
  noData: number;
  /** Sheet-vs-carrier mismatches worth acting on. */
  needsAttention: number;
  /** Same total as `needsAttention`, split into named categories for the KPI breakdown. */
  attentionBreakdown: Record<AttentionType, number>;
  /** Assets whose movement is on the previous label. */
  shippedOnPreviousLabel: number;
}

export type ReturnActionResult =
  | { ok: true; count: number }
  | { ok: false; message: string };

async function readError(response: Response): Promise<string> {
  try {
    const body: ApiError = await response.json();
    return body.message ?? "Request failed.";
  } catch {
    return `Request failed (HTTP ${response.status}).`;
  }
}

export function useReturnTracker() {
  const [assets, setAssets] = useState<ReturnAsset[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [liveFilter, setLiveFilter] = useState<ReturnLiveFilter>("all");
  const [sheetStatusFilter, setSheetStatusFilter] = useState<string>("all");

  const debouncedSearch = useDebouncedValue(search);

  /** Hydrates state from an upload that the server identified as a return tracker. */
  const load = useCallback((data: ReturnsUploadResponse) => {
    setAssets(data.assets);
    setWarnings(data.warnings);
    setError(null);
    setSearch("");
    setLiveFilter("all");
    setSheetStatusFilter("all");
  }, []);

  const reset = useCallback(() => {
    setAssets([]);
    setWarnings([]);
    setError(null);
    setSearch("");
    setLiveFilter("all");
    setSheetStatusFilter("all");
  }, []);

  const refresh = useCallback(async (): Promise<ReturnActionResult> => {
    if (assets.length === 0) return { ok: false, message: "No assets to refresh." };
    setIsRefreshing(true);
    setError(null);
    try {
      const trackingNumbers = Array.from(
        new Set(
          assets.flatMap((a) =>
            a.previousReturnTrackingNumber
              ? [a.returnTrackingNumber, a.previousReturnTrackingNumber]
              : [a.returnTrackingNumber]
          )
        )
      );
      const response = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumbers }),
      });
      if (!response.ok) {
        const message = await readError(response);
        setError(message);
        return { ok: false, message };
      }
      const body: RefreshResponse = await response.json();
      setAssets((prev) => {
        const previous = new Map<string, ReturnAsset["carrierCandidates"]>();
        for (const a of prev) {
          previous.set(
            a.returnTrackingNumber,
            a.carrierCandidates.length > 0
              ? a.carrierCandidates
              : [{ uniqueId: a.trackingMatch.selectedId, tracking: a.tracking }]
          );
          if (a.previousReturnTrackingNumber && a.previousTracking && a.previousTrackingMatch) {
            previous.set(a.previousReturnTrackingNumber, [
              { uniqueId: a.previousTrackingMatch.selectedId, tracking: a.previousTracking },
            ]);
          }
        }
        return assembleReturnAssets(
          prev,
          (n) => body.tracking[n] ?? previous.get(n) ?? []
        );
      });
      return { ok: true, count: trackingNumbers.length };
    } catch {
      const message = "Refresh failed. Check your connection and try again.";
      setError(message);
      return { ok: false, message };
    } finally {
      setIsRefreshing(false);
    }
  }, [assets]);

  const assetsWithInsight: ReturnAssetWithInsight[] = useMemo(
    () => assets.map((asset) => ({ ...asset, insight: deriveReturnInsight(asset) })),
    [assets]
  );

  const kpis: ReturnKpis = useMemo(() => {
    const attentionBreakdown = Object.fromEntries(
      ATTENTION_TYPES.map((type) => [type, 0])
    ) as Record<AttentionType, number>;
    const counts: ReturnKpis = {
      total: assetsWithInsight.length,
      awaitingDropoff: 0,
      inTransit: 0,
      delivered: 0,
      exceptions: 0,
      noData: 0,
      needsAttention: 0,
      attentionBreakdown,
      shippedOnPreviousLabel: 0,
    };
    for (const asset of assetsWithInsight) {
      switch (asset.insight.live) {
        case "AWAITING_DROPOFF":
          counts.awaitingDropoff += 1;
          break;
        case "IN_TRANSIT":
          counts.inTransit += 1;
          break;
        case "DELIVERED":
          counts.delivered += 1;
          break;
        case "EXCEPTION":
          counts.exceptions += 1;
          break;
        case "NO_DATA":
          counts.noData += 1;
          break;
        default: {
          const exhaustive: never = asset.insight.live;
          void exhaustive;
        }
      }
      if (asset.insight.attentionType) {
        counts.needsAttention += 1;
        attentionBreakdown[asset.insight.attentionType] += 1;
      }
      if (asset.insight.shippedOnPreviousLabel) counts.shippedOnPreviousLabel += 1;
    }
    return counts;
  }, [assetsWithInsight]);

  const sheetStatuses = useMemo(() => {
    const set = new Set<string>();
    for (const asset of assets) {
      if (asset.sheetStatus) set.add(asset.sheetStatus);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return assetsWithInsight.filter((asset) => {
      if (liveFilter === "ATTENTION") {
        if (!asset.insight.attentionType) return false;
      } else if ((ATTENTION_TYPES as string[]).includes(liveFilter)) {
        if (asset.insight.attentionType !== liveFilter) return false;
      } else if (liveFilter !== "all" && asset.insight.live !== liveFilter) {
        return false;
      }
      if (sheetStatusFilter !== "all" && asset.sheetStatus !== sheetStatusFilter) return false;
      if (!query) return true;
      return (
        asset.serialNumber.toLowerCase().includes(query) ||
        asset.assignedTo.toLowerCase().includes(query) ||
        asset.returnTrackingNumber.includes(query) ||
        (asset.previousReturnTrackingNumber?.includes(query) ?? false) ||
        asset.refreshNumber.toLowerCase().includes(query) ||
        asset.sctask.toLowerCase().includes(query)
      );
    });
  }, [assetsWithInsight, liveFilter, sheetStatusFilter, debouncedSearch]);

  return {
    assets: assetsWithInsight,
    filteredAssets,
    warnings,
    error,
    isRefreshing,
    kpis,
    sheetStatuses,
    search,
    setSearch,
    liveFilter,
    setLiveFilter,
    sheetStatusFilter,
    setSheetStatusFilter,
    load,
    refresh,
    reset,
  };
}
