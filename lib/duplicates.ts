import {
  compareDestination,
  normalizeCity,
  normalizePostalCode,
  normalizeState,
  type MatchContext,
} from "@/lib/tracking-match";
import type {
  CarrierFit,
  DuplicateInfo,
  DuplicateKind,
  Shipment,
  TrackingInfo,
} from "@/types/shipment";

/**
 * - REVIEW: anything a person has to decide (sheet conflicts, undecidable carrier records)
 * - REUSED: FedEx returned more than one shipment for the number
 */
export type DuplicateFilter = "all" | "ANY" | "REVIEW" | DuplicateKind | "REUSED";

export const DUPLICATE_FILTER_LABELS: Record<Exclude<DuplicateFilter, "all">, string> = {
  ANY: "Any duplicate",
  REVIEW: "Needs review",
  CONFLICT: "Conflicts (different recipients)",
  EXACT: "Identical rows",
  SAME_DESTINATION: "Same destination",
  REUSED: "FedEx reused number",
};

export function needsReview(shipment: Shipment): boolean {
  return shipment.match.confidence === "ambiguous" || shipment.duplicate?.kind === "CONFLICT";
}

export function matchesDuplicateFilter(shipment: Shipment, filter: DuplicateFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "ANY":
      return shipment.duplicate !== null || shipment.match.candidateCount > 1;
    case "REVIEW":
      return needsReview(shipment);
    case "REUSED":
      return shipment.match.candidateCount > 1;
    case "CONFLICT":
    case "EXACT":
    case "SAME_DESTINATION":
      return shipment.duplicate?.kind === filter;
    default: {
      const exhaustive: never = filter;
      return exhaustive;
    }
  }
}

/** The subset of a shipment row the duplicate check needs. */
export interface DuplicateCheckRow {
  id: string;
  rowNumber: number;
  trackingNumber: string;
  deliverTo: string;
  recipient: string;
  address: string;
  serialNumber: string;
  assetName: string;
  context: MatchContext;
  tracking: TrackingInfo;
}

function clean(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function personKey(row: DuplicateCheckRow): string {
  return clean(row.recipient || row.deliverTo);
}

function fullKey(row: DuplicateCheckRow): string {
  return [
    personKey(row),
    clean(row.deliverTo),
    clean(row.address),
    normalizePostalCode(row.context.postalCode),
    normalizeCity(row.context.city),
    normalizeState(row.context.state),
    clean(row.serialNumber),
    clean(row.assetName),
  ].join("|");
}

/**
 * Compares two rows' destinations using the most specific detail both rows
 * have. Returns null when they share no comparable detail.
 */
function sameDestination(a: DuplicateCheckRow, b: DuplicateCheckRow): boolean | null {
  const addressA = clean(a.address);
  const addressB = clean(b.address);
  if (addressA && addressB) return addressA === addressB;

  const zipA = normalizePostalCode(a.context.postalCode);
  const zipB = normalizePostalCode(b.context.postalCode);
  if (zipA && zipB) return zipA === zipB;

  const cityA = normalizeCity(a.context.city);
  const cityB = normalizeCity(b.context.city);
  const stateA = normalizeState(a.context.state);
  const stateB = normalizeState(b.context.state);
  if (stateA && stateB && stateA !== stateB) return false;
  if (cityA && cityB) return cityA === cityB;
  return null;
}

function classify(group: DuplicateCheckRow[]): DuplicateKind {
  if (new Set(group.map(fullKey)).size === 1) return "EXACT";

  const comparisons: (boolean | null)[] = [];
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      comparisons.push(sameDestination(group[i], group[j]));
    }
  }
  if (comparisons.includes(false)) return "CONFLICT";

  const people = new Set(group.map(personKey).filter(Boolean));
  if (people.size <= 1) return "SAME_DESTINATION";
  // Different people are fine only when they're provably at one address
  // (e.g. several employees' laptops in one box to an office).
  return comparisons.every((same) => same === true) ? "SAME_DESTINATION" : "CONFLICT";
}

function rowList(rows: number[]): string {
  return rows.length === 1 ? `row ${rows[0]}` : `rows ${rows.join(", ")}`;
}

function describe(
  kind: DuplicateKind,
  fit: CarrierFit,
  otherRows: number[],
  groupFits: CarrierFit[]
): string {
  const others = rowList(otherRows);
  switch (kind) {
    case "EXACT":
      return `Identical to ${others} — the same shipment is listed more than once.`;
    case "SAME_DESTINATION":
      return `Shares its tracking number with ${others}, going to the same destination (likely several items in one package).`;
    case "CONFLICT": {
      const matches = groupFits.filter((f) => f === "match").length;
      if (fit === "match" && matches === 1) {
        return `Shares its tracking number with ${others} for a different recipient. FedEx's destination matches this row, so this is most likely the real one.`;
      }
      if (fit === "match") {
        return `Shares its tracking number with ${others} for a different recipient. FedEx's destination matches this row, but also another row in the group — confirm which is ours.`;
      }
      if (fit === "mismatch") {
        return `Shares its tracking number with ${others} for a different recipient. FedEx's destination does not match this row — the tracking number was probably entered against the wrong order.`;
      }
      return `Shares its tracking number with ${others} for a different recipient or destination. FedEx doesn't expose enough destination detail to tell which row is correct — check with the shipper.`;
    }
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

/**
 * Finds rows that share a tracking number and explains how they relate.
 * Rows are never dropped: an identical copy, a multi-item box and a genuine
 * conflict all look the same to the carrier, so the sheet's own data plus
 * the carrier's destination decide which one is which.
 */
export function analyzeDuplicates(rows: DuplicateCheckRow[]): Map<string, DuplicateInfo> {
  const groups = new Map<string, DuplicateCheckRow[]>();
  for (const row of rows) {
    const group = groups.get(row.trackingNumber);
    if (group) group.push(row);
    else groups.set(row.trackingNumber, [row]);
  }

  const result = new Map<string, DuplicateInfo>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const kind = classify(group);
    const fits = group.map((row) => compareDestination(row.context, row.tracking.destination).fit);
    group.forEach((row, index) => {
      const otherRows = group.filter((other) => other !== row).map((other) => other.rowNumber);
      result.set(row.id, {
        kind,
        groupSize: group.length,
        otherRows,
        carrierFit: fits[index],
        note: describe(kind, fits[index], otherRows, fits),
      });
    });
  }
  return result;
}
