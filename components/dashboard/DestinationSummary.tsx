"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";

import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCityMeta } from "@/lib/city-meta";
import { cn } from "@/lib/utils";
import type { DestinationCount } from "@/hooks/useShipments";

interface DestinationSummaryProps {
  destinations: DestinationCount[];
  activeCity: string | "all";
  onSelectCity: (city: string | "all") => void;
}

export function DestinationSummary({
  destinations,
  activeCity,
  onSelectCity,
}: DestinationSummaryProps) {
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    let fillRaf = 0;
    const resetRaf = requestAnimationFrame(() => {
      setFilled(false);
      fillRaf = requestAnimationFrame(() => setFilled(true));
    });
    return () => {
      cancelAnimationFrame(resetRaf);
      cancelAnimationFrame(fillRaf);
    };
  }, [destinations]);

  if (destinations.length === 0) return null;
  const maxCount = destinations[0]?.count ?? 1;

  return (
    <Card className="surface-panel rounded-2xl py-0 ring-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="flex items-start justify-between gap-4">
          <span>
            <span className="eyebrow flex items-center gap-2">
              <MapPin className="size-3.5" />
              Geographic scope
            </span>
            <span className="mt-1.5 block text-lg font-semibold tracking-tight text-foreground">
              Top destinations
            </span>
          </span>
          <span className="hidden shrink-0 rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline-block">
            {destinations.length} cities
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-4">
        <div className="scroll-panel max-h-[440px] space-y-1 overflow-y-auto pr-1 -mr-1">
          {destinations.map((dest) => {
            const isActive = activeCity === dest.city;
            const width = Math.max((dest.count / maxCount) * 100, 5);
            const meta = getCityMeta(dest.city);
            const Icon = meta.icon;
            return (
              <button
                key={dest.city}
                type="button"
                onClick={() => onSelectCity(isActive ? "all" : dest.city)}
                title={dest.city}
                className={cn(
                  "hover-lift group relative flex w-full items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {!isActive ? (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 bg-primary/[0.06] transition-[width,background-color] duration-700 ease-out group-hover:bg-primary/[0.09]"
                    style={{ width: `${filled ? width : 0}%` }}
                  />
                ) : null}
                <span
                  className={cn(
                    "relative flex size-6 shrink-0 items-center justify-center rounded-md transition-transform duration-200 group-hover:scale-110",
                    isActive ? "bg-white/15 text-primary-foreground" : meta.className
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="relative min-w-0 flex-1 truncate font-medium">{dest.city}</span>
                <span
                  className={cn(
                    "relative shrink-0 text-xs",
                    isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}
                >
                  <AnimatedNumber value={dest.count} />
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
