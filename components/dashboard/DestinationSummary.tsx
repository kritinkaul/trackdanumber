"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DestinationCount } from "@/hooks/useShipments";

interface DestinationSummaryProps {
  destinations: DestinationCount[];
  activeCity: string | "all";
  onSelectCity: (city: string | "all") => void;
}

const COLLAPSED_COUNT = 12;

export function DestinationSummary({
  destinations,
  activeCity,
  onSelectCity,
}: DestinationSummaryProps) {
  const [showAll, setShowAll] = useState(false);

  if (destinations.length === 0) return null;
  const visible = showAll ? destinations : destinations.slice(0, COLLAPSED_COUNT);

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <MapPin className="size-4" />
          Shipments by Destination
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        {visible.map((dest) => {
          const isActive = activeCity === dest.city;
          return (
            <button
              key={dest.city}
              type="button"
              onClick={() => onSelectCity(isActive ? "all" : dest.city)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-muted"
              )}
            >
              {dest.city}
              <span
                className={cn(
                  "text-xs tabular-nums",
                  isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                )}
              >
                ({dest.count})
              </span>
            </button>
          );
        })}
        {destinations.length > COLLAPSED_COUNT && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show less" : `Show all ${destinations.length}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
