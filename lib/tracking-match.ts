import { STATUS_LABELS } from "@/lib/status";
import type {
  CarrierCandidate,
  CarrierDestination,
  CarrierFit,
  CarrierMatch,
  TrackingInfo,
} from "@/types/shipment";

/** What the spreadsheet says about where / when a row's package went. */
export interface MatchContext {
  city: string;
  state: string;
  postalCode: string;
  /** ISO date, or "" when the sheet has no ship date. */
  shipDate: string;
}

const EMPTY_CONTEXT: MatchContext = { city: "", state: "", postalCode: "", shipDate: "" };

const US_STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN",
  iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "puerto rico": "PR",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN",
  texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

const DAY_MS = 86_400_000;
/** Records whose last activity is this much older than the newest record are treated as a previous use of the number. */
const STALE_GAP_DAYS = 90;

export function normalizeState(value: string | null | undefined): string {
  const text = (value ?? "").trim().toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ");
  if (!text) return "";
  if (text.length === 2) return text.toUpperCase();
  return US_STATES[text] ?? text.toUpperCase();
}

export function normalizeCity(value: string | null | undefined): string {
  return (value ?? "")
    .split(",")[0]
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(st|saint)\s/, "saint ")
    .replace(/^ft\s/, "fort ")
    .replace(/^mt\s/, "mount ");
}

/** US ZIPs → first 5 digits (restoring leading zeros Excel drops); other postcodes compared as-is. */
export function normalizePostalCode(value: string | null | undefined): string {
  const text = (value ?? "").trim().toUpperCase();
  if (!text) return "";
  const digits = text.replace(/[^0-9]/g, "");
  if (/^\d{3,5}(-?\d{4})?$/.test(text.replace(/\s/g, ""))) {
    const zip = digits.length > 5 ? digits.slice(0, digits.length - 4) : digits;
    return zip.padStart(5, "0").slice(0, 5);
  }
  return text.replace(/\s+/g, "");
}

/** Parses the location out of an office label such as "A&M - New York, NY". */
export function parseOfficeLocation(office: string | null): { city: string; state: string } | null {
  if (!office) return null;
  const location = office.replace(/^A&M\s*-\s*/i, "");
  const [city, state] = location.split(",").map((part) => part.trim());
  if (!city) return null;
  return { city, state: state ?? "" };
}

/** Pulls a trailing US ZIP out of a free-text address ("… Boston, MA 02110"). */
export function extractPostalCode(address: string): string {
  const match = address.match(/\b(\d{5})(?:-\d{4})?\s*$/);
  return match ? match[1] : "";
}

export interface DestinationComparison {
  fit: CarrierFit;
  score: number;
  /** Evidence for this record. */
  notes: string[];
  /** Evidence against this record. */
  concerns: string[];
}

function formatDestination(destination: CarrierDestination): string {
  const place = [destination.city, destination.state].filter(Boolean).join(", ");
  return [place, destination.postalCode].filter(Boolean).join(" ");
}

/**
 * Compares the sheet's destination with the carrier's. ZIP is the strongest
 * signal; city names vary (suburbs, "NYC" vs "New York") so a city mismatch
 * alone is only weak evidence against.
 */
export function compareDestination(
  context: MatchContext,
  destination: CarrierDestination | null
): DestinationComparison {
  if (!destination) return { fit: "unknown", score: 0, notes: [], concerns: [] };

  const notes: string[] = [];
  const concerns: string[] = [];
  let score = 0;

  const sheetZip = normalizePostalCode(context.postalCode);
  const carrierZip = normalizePostalCode(destination.postalCode);
  const zip = sheetZip && carrierZip ? (sheetZip === carrierZip ? "match" : "mismatch") : null;

  const sheetState = normalizeState(context.state);
  const carrierState = normalizeState(destination.state);
  const state =
    sheetState && carrierState ? (sheetState === carrierState ? "match" : "mismatch") : null;

  const sheetCity = normalizeCity(context.city);
  const carrierCity = normalizeCity(destination.city);
  const city = sheetCity && carrierCity ? (sheetCity === carrierCity ? "match" : "mismatch") : null;

  if (zip === "match") {
    score += 100;
    notes.push("ZIP matches the sheet");
  } else if (zip === "mismatch") {
    score -= 80;
    concerns.push(`has ZIP ${destination.postalCode}, not the sheet's ${context.postalCode}`);
  }
  if (state === "match") {
    score += 30;
  } else if (state === "mismatch") {
    score -= 60;
    concerns.push(`is going to ${formatDestination(destination)}, not ${context.state}`);
  }
  if (city === "match") {
    score += 40;
    if (zip !== "match") notes.push(`destination ${formatDestination(destination)} matches the sheet`);
  } else if (city === "mismatch") {
    score -= 15;
  }

  let fit: CarrierFit = "unknown";
  if (zip === "mismatch" || state === "mismatch") fit = "mismatch";
  else if (zip === "match" || city === "match") fit = "match";

  return { fit, score, notes, concerns };
}

function toTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? null : time;
}

/** Most recent moment this record shows activity — used to spot a previous use of the number. */
function activityTime(tracking: TrackingInfo): number | null {
  return (
    toTime(tracking.lastScanTime) ?? toTime(tracking.shipDate) ?? toTime(tracking.estimatedDelivery)
  );
}

function isEmptyRecord(tracking: TrackingInfo): boolean {
  return (
    (tracking.status === "UNAVAILABLE" || tracking.status === "UNKNOWN") &&
    !tracking.transitHistory?.length
  );
}

function formatMonthYear(time: number): string {
  return new Date(time).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

interface ScoredCandidate {
  candidate: CarrierCandidate;
  score: number;
  destination: DestinationComparison;
  notes: string[];
  concerns: string[];
}

function scoreCandidates(
  candidates: CarrierCandidate[],
  context: MatchContext
): ScoredCandidate[] {
  const times = candidates.map((c) => activityTime(c.tracking));
  const newest = Math.max(...times.map((t) => t ?? Number.NEGATIVE_INFINITY));
  const sheetShipTime = toTime(context.shipDate);

  return candidates.map((candidate, index) => {
    const destination = compareDestination(context, candidate.tracking.destination);
    const notes = [...destination.notes];
    const concerns = [...destination.concerns];
    let score = destination.score;

    const carrierShipTime = toTime(candidate.tracking.shipDate);
    if (sheetShipTime !== null && carrierShipTime !== null) {
      const days = Math.abs(sheetShipTime - carrierShipTime) / DAY_MS;
      if (days <= 7) {
        score += 60;
        notes.push("ship date matches the sheet");
      } else if (days > 30) {
        score -= 40;
        concerns.push(`shipped ${formatMonthYear(carrierShipTime)}, not around the sheet's ship date`);
      }
    }

    const time = times[index];
    if (time !== null && Number.isFinite(newest) && (newest - time) / DAY_MS > STALE_GAP_DAYS) {
      score -= 30;
      concerns.push(`is an older use of this number (last activity ${formatMonthYear(time)})`);
    } else if (time !== null && time === newest) {
      score += 5;
    }

    if (isEmptyRecord(candidate.tracking)) {
      score -= 25;
      concerns.push("has no FedEx scans");
    }

    return { candidate, score, destination, notes, concerns };
  });
}

function describe(candidate: CarrierCandidate): string {
  const { tracking } = candidate;
  const place = tracking.destination ? formatDestination(tracking.destination) : "";
  const status =
    tracking.status === "UNKNOWN" || tracking.status === "UNAVAILABLE"
      ? "no-status"
      : STATUS_LABELS[tracking.status].toLowerCase();
  return place ? `${status} record for ${place}` : `${status} record`;
}

export interface SelectionResult {
  candidate: CarrierCandidate;
  match: CarrierMatch;
}

/**
 * Picks the carrier record that belongs to a spreadsheet row. With one
 * record there is nothing to decide. With several (a recycled tracking
 * number), each is scored on destination, ship date, recency and whether it
 * has any data; the confidence tells the UI whether a person should confirm.
 * A `pinnedId` (a person's explicit choice) always wins while that record
 * still exists.
 */
export function selectCandidate(
  candidates: CarrierCandidate[],
  context: MatchContext = EMPTY_CONTEXT,
  pinnedId?: string | null
): SelectionResult {
  if (candidates.length === 0) {
    throw new Error("selectCandidate requires at least one candidate.");
  }
  if (candidates.length === 1) {
    const [only] = candidates;
    return {
      candidate: only,
      match: { selectedId: only.uniqueId, confidence: "single", reason: "", candidateCount: 1 },
    };
  }

  const count = candidates.length;
  const pinned = pinnedId ? candidates.find((c) => c.uniqueId === pinnedId) : undefined;
  if (pinned) {
    return {
      candidate: pinned,
      match: {
        selectedId: pinned.uniqueId,
        confidence: "manual",
        reason: `FedEx has ${count} shipments on this number. You chose the ${describe(pinned)}.`,
        candidateCount: count,
      },
    };
  }

  const scored = scoreCandidates(candidates, context).sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  const margin = best.score - second.score;
  const prefix = `FedEx has ${count} shipments on this number.`;
  const rejected = scored
    .slice(1)
    .filter((s) => s.concerns.length > 0)
    .map((s) => `the other ${describe(s.candidate)} ${s.concerns.join(", ")}`);
  const why =
    best.notes.length > 0 || rejected.length > 0
      ? ` (${[...best.notes, ...rejected].join("; ")})`
      : "";

  // "matched" means the destination itself tells the records apart — not recency.
  if (best.destination.fit === "match" && second.destination.fit !== "match") {
    return {
      candidate: best.candidate,
      match: {
        selectedId: best.candidate.uniqueId,
        confidence: "matched",
        reason: `${prefix} Showing the ${describe(best.candidate)}${why}.`,
        candidateCount: count,
      },
    };
  }

  if (margin >= 20) {
    return {
      candidate: best.candidate,
      match: {
        selectedId: best.candidate.uniqueId,
        confidence: "likely",
        reason: `${prefix} Showing the ${describe(best.candidate)}${why}. Picked on recency and data quality rather than destination, so confirm if it matters.`,
        candidateCount: count,
      },
    };
  }

  return {
    candidate: best.candidate,
    match: {
      selectedId: best.candidate.uniqueId,
      confidence: "ambiguous",
      reason: `${prefix} They can't be told apart from the sheet's data — review them and pick the one that is ours.`,
      candidateCount: count,
    },
  };
}
