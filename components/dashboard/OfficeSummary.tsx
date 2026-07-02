"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OfficeCount } from "@/hooks/useShipments";

interface OfficeSummaryProps {
  offices: OfficeCount[];
  activeOffice: string | "all";
  onSelectOffice: (office: string | "all") => void;
}

const COLLAPSED_COUNT = 10;

export function OfficeSummary({ offices, activeOffice, onSelectOffice }: OfficeSummaryProps) {
  const [showAll, setShowAll] = useState(false);

  if (offices.length === 0) return null;
  const visible = showAll ? offices : offices.slice(0, COLLAPSED_COUNT);

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Building2 className="size-4" />
          A&amp;M Offices
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        {visible.map(({ office, count }) => {
          const isActive = activeOffice === office;
          // Strip the "A&M - " prefix for the chip label to keep chips compact
          const label = office.replace(/^A&M\s*-\s*/i, "");
          return (
            <button
              key={office}
              type="button"
              onClick={() => onSelectOffice(isActive ? "all" : office)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-muted"
              )}
            >
              {label}
              <span
                className={cn(
                  "text-xs tabular-nums",
                  isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                )}
              >
                ({count})
              </span>
            </button>
          );
        })}
        {offices.length > COLLAPSED_COUNT && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show less" : `Show all ${offices.length}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
