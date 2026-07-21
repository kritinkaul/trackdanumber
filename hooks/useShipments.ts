"use client";

import { useCallback, useMemo, useState } from "react";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type {
  ApiError,
  RefreshResponse,
  Shipment,
  ShipmentStatus,
  UploadResponse,
} from "@/types/shipment";

export type LoadStatus = "idle" | "uploading" | "refreshing" | "ready" | "error";

/** "NO_STATUS" groups UNAVAILABLE + UNKNOWN (lookup failed / unrecognized code). */
export type StatusFilter = ShipmentStatus | "all" | "NO_STATUS" | "RETURN_TO_SHIPPER";

export interface ShipmentFilters {
  status: StatusFilter;
  city: string | "all";
  state: string | "all";
  carrier: string | "all";
  office: string | "all";
}

const DEFAULT_FILTERS: ShipmentFilters = {
  status: "all",
  city: "all",
  state: "all",
  carrier: "all",
  office: "all",
};

export interface KpiCounts {
  total: number;
  delivered: number;
  inTransit: number;
  outForDelivery: number;
  exception: number;
  labelCreated: number;
  noStatus: number;
  /** Anywhere in the return flow — heading back or already returned to the shipper. */
  returning: number;
}

export interface DestinationCount {
  city: string;
  count: number;
}

export interface OfficeCount {
  office: string;
  count: number;
}

export type ActionResult =
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

export function useShipments() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ShipmentFilters>(DEFAULT_FILTERS);

  const debouncedSearch = useDebouncedValue(search);

  const upload = useCallback(async (file: File): Promise<ActionResult> => {
    setStatus("uploading");
    setError(null);
    setWarnings([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      if (!response.ok) {
        const message = await readError(response);
        setError(message);
        setStatus("error");
        return { ok: false, message };
      }
      const body: UploadResponse = await response.json();
      setShipments(body.shipments);
      setWarnings(body.warnings);
      setFilters(DEFAULT_FILTERS);
      setSearch("");
      setStatus("ready");
      return { ok: true, count: body.shipments.length };
    } catch {
      const message = "Upload failed. Check your connection and try again.";
      setError(message);
      setStatus("error");
      return { ok: false, message };
    }
  }, []);

  const refresh = useCallback(async (): Promise<ActionResult> => {
    if (shipments.length === 0) return { ok: false, message: "No shipments to refresh." };
    setStatus("refreshing");
    setError(null);
    try {
      const trackingNumbers = Array.from(new Set(shipments.map((s) => s.trackingNumber)));
      const response = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumbers }),
      });
      if (!response.ok) {
        const message = await readError(response);
        setError(message);
        setStatus("ready");
        return { ok: false, message };
      }
      const body: RefreshResponse = await response.json();
      setShipments((prev) =>
        prev.map((s) =>
          body.tracking[s.trackingNumber]
            ? { ...s, tracking: body.tracking[s.trackingNumber] }
            : s
        )
      );
      setStatus("ready");
      return { ok: true, count: trackingNumbers.length };
    } catch {
      const message = "Refresh failed. Check your connection and try again.";
      setError(message);
      setStatus("ready");
      return { ok: false, message };
    }
  }, [shipments]);

  const reset = useCallback(() => {
    setShipments([]);
    setStatus("idle");
    setError(null);
    setWarnings([]);
    setSearch("");
    setFilters(DEFAULT_FILTERS);
  }, []);

  const setFilter = useCallback(
    <K extends keyof ShipmentFilters>(key: K, value: ShipmentFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const kpis: KpiCounts = useMemo(() => {
    const counts: KpiCounts = {
      total: shipments.length,
      delivered: 0,
      inTransit: 0,
      outForDelivery: 0,
      exception: 0,
      labelCreated: 0,
      noStatus: 0,
      returning: 0,
    };
    for (const s of shipments) {
      if (s.tracking.isReturnToShipper) counts.returning += 1;
      switch (s.tracking.status) {
        case "DELIVERED":
          // A return that has completed still reports status DELIVERED — keep it
          // out of the "genuine delivery" bucket so the count isn't misleading.
          if (!s.tracking.isReturnToShipper) counts.delivered += 1;
          break;
        case "IN_TRANSIT":
          counts.inTransit += 1;
          break;
        case "OUT_FOR_DELIVERY":
          counts.outForDelivery += 1;
          break;
        case "EXCEPTION":
          counts.exception += 1;
          break;
        case "LABEL_CREATED":
          counts.labelCreated += 1;
          break;
        case "UNAVAILABLE":
        case "UNKNOWN":
          counts.noStatus += 1;
          break;
        default: {
          const exhaustive: never = s.tracking.status;
          void exhaustive;
        }
      }
    }
    return counts;
  }, [shipments]);

  const destinations: DestinationCount[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of shipments) {
      const city = s.city.trim();
      if (!city) continue;
      counts.set(city, (counts.get(city) ?? 0) + 1);
    }
    return Array.from(counts, ([city, count]) => ({ city, count })).sort(
      (a, b) => b.count - a.count || a.city.localeCompare(b.city)
    );
  }, [shipments]);

  const offices: OfficeCount[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of shipments) {
      if (!s.office) continue;
      counts.set(s.office, (counts.get(s.office) ?? 0) + 1);
    }
    return Array.from(counts, ([office, count]) => ({ office, count })).sort(
      (a, b) => b.count - a.count || a.office.localeCompare(b.office)
    );
  }, [shipments]);

  const filterOptions = useMemo(() => {
    const cities = new Set<string>();
    const states = new Set<string>();
    const carriers = new Set<string>();
    const statuses = new Set<ShipmentStatus>();
    const officeSet = new Set<string>();
    for (const s of shipments) {
      if (s.city.trim()) cities.add(s.city.trim());
      if (s.state.trim()) states.add(s.state.trim());
      if (s.carrier.trim()) carriers.add(s.carrier.trim());
      if (s.office) officeSet.add(s.office);
      statuses.add(s.tracking.status);
    }
    const sorted = (set: Set<string>) => Array.from(set).sort((a, b) => a.localeCompare(b));
    return {
      cities: sorted(cities),
      states: sorted(states),
      carriers: sorted(carriers),
      offices: sorted(officeSet),
      statuses: Array.from(statuses),
    };
  }, [shipments]);

  const filteredShipments = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return shipments.filter((s) => {
      if (filters.status === "NO_STATUS") {
        if (s.tracking.status !== "UNAVAILABLE" && s.tracking.status !== "UNKNOWN") return false;
      } else if (filters.status === "RETURN_TO_SHIPPER") {
        if (!s.tracking.isReturnToShipper) return false;
      } else if (filters.status === "DELIVERED") {
        // Keep in sync with the `kpis.delivered` count: a completed return also
        // reports DELIVERED, but it never reached the original recipient, so it
        // shouldn't appear when filtering for genuine deliveries.
        if (s.tracking.status !== "DELIVERED" || s.tracking.isReturnToShipper) return false;
      } else if (filters.status !== "all" && s.tracking.status !== filters.status) {
        return false;
      }
      if (filters.city !== "all" && s.city.trim() !== filters.city) return false;
      if (filters.state !== "all" && s.state.trim() !== filters.state) return false;
      if (filters.carrier !== "all" && s.carrier.trim() !== filters.carrier) return false;
      if (filters.office !== "all" && s.office !== filters.office) return false;
      if (!query) return true;
      return (
        s.trackingNumber.toLowerCase().includes(query) ||
        s.city.toLowerCase().includes(query) ||
        s.state.toLowerCase().includes(query) ||
        s.deliverTo.toLowerCase().includes(query) ||
        s.recipient.toLowerCase().includes(query) ||
        (s.office?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [shipments, filters, debouncedSearch]);

  return {
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
  };
}
