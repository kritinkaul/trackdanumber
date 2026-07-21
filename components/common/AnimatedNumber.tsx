"use client";

import { useCountUp } from "@/hooks/useCountUp";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}

export function AnimatedNumber({ value, suffix = "", duration, className }: AnimatedNumberProps) {
  const display = useCountUp(value, duration);

  return (
    <span className={cn("tabular-nums", className)}>
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
