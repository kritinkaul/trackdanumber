"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem("shipment-dashboard-theme", theme);
}

export function ThemeToggle() {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => {
        const theme: Theme = document.documentElement.classList.contains("dark")
          ? "dark"
          : "light";
        const nextTheme: Theme = theme === "dark" ? "light" : "dark";
        applyTheme(nextTheme);
      }}
      aria-label="Toggle color theme"
      title="Toggle color theme"
      className="rounded-full bg-card/80"
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </Button>
  );
}
