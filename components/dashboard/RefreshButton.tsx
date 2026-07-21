"use client";

import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface RefreshButtonProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function RefreshButton({ onRefresh, isRefreshing }: RefreshButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={onRefresh}
      disabled={isRefreshing}
      aria-label={isRefreshing ? "Refreshing shipment status" : "Refresh shipment status"}
      className="bg-card"
    >
      {isRefreshing ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RefreshCw className="size-4" />
      )}
      <span className="hidden sm:inline">{isRefreshing ? "Refreshing…" : "Refresh Status"}</span>
    </Button>
  );
}
