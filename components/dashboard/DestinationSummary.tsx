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
  const maxCount = destinations[0]?.count ?? 1;

  return (
    <Card className="surface-panel rounded-2xl py-0 ring-0">
      <CardHeader className="border-b py-4">
        <CardTitle>
          <span className="eyebrow flex items-center gap-2">
            <MapPin className="size-3.5" />
            Geographic scope
          </span>
          <span className="mt-1.5 block text-lg font-semibold tracking-tight text-foreground">
            Top destinations
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 py-4">
        {visible.map((dest) => {
          const isActive = activeCity === dest.city;
          const width = Math.max((dest.count / maxCount) * 100, 5);
          return (
            <button
              key={dest.city}
              type="button"
              onClick={() => onSelectCity(isActive ? "all" : dest.city)}
              className={cn(
                "group relative flex w-full items-center justify-between overflow-hidden rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              {!isActive ? (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-primary/[0.06] transition-colors group-hover:bg-primary/[0.09]"
                  style={{ width: `${width}%` }}
                />
              ) : null}
              <span className="relative truncate font-medium">{dest.city}</span>
              <span
                className={cn(
                  "relative text-xs tabular-nums",
                  isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                )}
              >
                {dest.count}
              </span>
            </button>
          );
        })}
        {destinations.length > COLLAPSED_COUNT && (
          <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show less" : `Show all ${destinations.length}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
