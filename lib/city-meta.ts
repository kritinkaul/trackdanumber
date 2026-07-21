import type { LucideIcon } from "lucide-react";
import {
  Anchor,
  Building2,
  Car,
  Coffee,
  Factory,
  Flag,
  GraduationCap,
  Guitar,
  Landmark,
  Mountain,
  Music,
  Palmtree,
  Rocket,
  Snowflake,
  Sparkles,
  Sun,
  TreePine,
  Trophy,
  UtensilsCrossed,
  Waves,
  Wind,
  Wine,
} from "lucide-react";

const SWATCHES = {
  indigo: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-300",
  rose: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
  teal: "bg-teal-500/12 text-teal-600 dark:text-teal-300",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-300",
  cyan: "bg-cyan-500/12 text-cyan-600 dark:text-cyan-300",
  orange: "bg-orange-500/12 text-orange-600 dark:text-orange-300",
  fuchsia: "bg-fuchsia-500/12 text-fuchsia-600 dark:text-fuchsia-300",
  sky: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
  emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  pink: "bg-pink-500/12 text-pink-600 dark:text-pink-300",
  amber: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
} as const;

type SwatchKey = keyof typeof SWATCHES;
const SWATCH_KEYS = Object.keys(SWATCHES) as SwatchKey[];

/** Curated icon + accent per well-known city, so its tile reads at a glance. */
const CITY_ICONS: Record<string, { icon: LucideIcon; swatch: SwatchKey }> = {
  "new york": { icon: Landmark, swatch: "indigo" },
  "los angeles": { icon: Palmtree, swatch: "orange" },
  chicago: { icon: Wind, swatch: "sky" },
  houston: { icon: Rocket, swatch: "violet" },
  dallas: { icon: Building2, swatch: "teal" },
  "fort worth": { icon: Building2, swatch: "teal" },
  washington: { icon: Landmark, swatch: "rose" },
  atlanta: { icon: TreePine, swatch: "emerald" },
  "san francisco": { icon: Anchor, swatch: "cyan" },
  miami: { icon: Waves, swatch: "pink" },
  tampa: { icon: Waves, swatch: "orange" },
  boston: { icon: GraduationCap, swatch: "indigo" },
  nashville: { icon: Music, swatch: "fuchsia" },
  seattle: { icon: Coffee, swatch: "teal" },
  denver: { icon: Mountain, swatch: "sky" },
  phoenix: { icon: Sun, swatch: "orange" },
  philadelphia: { icon: Landmark, swatch: "rose" },
  "las vegas": { icon: Sparkles, swatch: "fuchsia" },
  "san diego": { icon: Sun, swatch: "cyan" },
  austin: { icon: Guitar, swatch: "violet" },
  charlotte: { icon: Building2, swatch: "teal" },
  detroit: { icon: Car, swatch: "sky" },
  minneapolis: { icon: Snowflake, swatch: "cyan" },
  portland: { icon: TreePine, swatch: "emerald" },
  "new orleans": { icon: Music, swatch: "orange" },
  orlando: { icon: Sparkles, swatch: "pink" },
  memphis: { icon: Music, swatch: "rose" },
  indianapolis: { icon: Flag, swatch: "orange" },
  columbus: { icon: Building2, swatch: "indigo" },
  baltimore: { icon: Anchor, swatch: "teal" },
  louisville: { icon: Trophy, swatch: "amber" },
  "kansas city": { icon: UtensilsCrossed, swatch: "orange" },
  pittsburgh: { icon: Factory, swatch: "sky" },
  cleveland: { icon: Guitar, swatch: "violet" },
  "saint louis": { icon: Landmark, swatch: "sky" },
  "salt lake city": { icon: Mountain, swatch: "indigo" },
  sacramento: { icon: TreePine, swatch: "emerald" },
  "san antonio": { icon: Building2, swatch: "orange" },
  jacksonville: { icon: Waves, swatch: "teal" },
  "el paso": { icon: Mountain, swatch: "orange" },
  "oklahoma city": { icon: Flag, swatch: "amber" },
  milwaukee: { icon: Wine, swatch: "amber" },
  raleigh: { icon: TreePine, swatch: "emerald" },
  richmond: { icon: Landmark, swatch: "rose" },
  cincinnati: { icon: Building2, swatch: "orange" },
  "san jose": { icon: Building2, swatch: "cyan" },
  honolulu: { icon: Palmtree, swatch: "cyan" },
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function normalizeCity(cityRaw: string): string {
  return cityRaw
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/^(st\.?|saint)\s/, "saint ")
    .replace(/^ft\.?\s/, "fort ")
    .replace(/\s+/g, " ");
}

export interface CityMeta {
  icon: LucideIcon;
  className: string;
}

/** Looks up a landmark-style icon + accent color for a city, falling back to a stable generic one. */
export function getCityMeta(cityRaw: string): CityMeta {
  const key = normalizeCity(cityRaw);
  const curated = CITY_ICONS[key];
  if (curated) {
    return { icon: curated.icon, className: SWATCHES[curated.swatch] };
  }
  const swatchKey = SWATCH_KEYS[hashString(key) % SWATCH_KEYS.length];
  return { icon: Building2, className: SWATCHES[swatchKey] };
}
