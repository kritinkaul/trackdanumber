import { analyzeDuplicates } from "@/lib/duplicates";
import {
  extractPostalCode,
  parseOfficeLocation,
  selectCandidate,
  type MatchContext,
} from "@/lib/tracking-match";
import { unavailableCandidates } from "@/services/fedex/normalize";
import type { ReturnAsset, ReturnAssetRow } from "@/types/return-tracker";
import type { CarrierCandidate, ExcelShipmentRow, Shipment } from "@/types/shipment";

/** Sheet destination for matching; office shipments fall back to the office's city. */
export function matchContextForRow(row: ExcelShipmentRow): MatchContext {
  const office = parseOfficeLocation(row.office);
  return {
    city: row.city || office?.city || "",
    state: row.state || office?.state || "",
    postalCode: row.postalCode || extractPostalCode(row.address),
    shipDate: row.shipDate,
  };
}

type ShipmentBase = ExcelShipmentRow & { id: string };

type CandidateLookup = (trackingNumber: string) => CarrierCandidate[];

function withFallback(lookup: CandidateLookup): CandidateLookup {
  return (trackingNumber) => {
    const candidates = lookup(trackingNumber);
    return candidates.length > 0
      ? candidates
      : unavailableCandidates(trackingNumber, "No tracking data returned for this number.");
  };
}

/**
 * Builds dashboard shipments from sheet rows plus carrier candidates:
 * picks each row's carrier record, then flags rows sharing a tracking
 * number. Used both on upload (server) and on refresh / manual pick
 * (browser), so the logic stays in one place.
 */
export function assembleShipments(
  rows: ShipmentBase[],
  candidatesByNumber: CandidateLookup,
  pinnedIds: ReadonlyMap<string, string> = new Map()
): Shipment[] {
  const lookup = withFallback(candidatesByNumber);
  const withTracking = rows.map((row) => {
    const candidates = lookup(row.trackingNumber);
    const context = matchContextForRow(row);
    const { candidate, match } = selectCandidate(candidates, context, pinnedIds.get(row.id));
    return {
      row,
      context,
      tracking: candidate.tracking,
      match,
      carrierCandidates: candidates.length > 1 ? candidates : [],
    };
  });

  const duplicates = analyzeDuplicates(
    withTracking.map(({ row, context, tracking }) => ({
      id: row.id,
      rowNumber: row.rowNumber,
      trackingNumber: row.trackingNumber,
      deliverTo: row.deliverTo,
      recipient: row.recipient,
      address: row.address,
      serialNumber: row.serialNumber,
      assetName: row.assetName,
      context,
      tracking,
    }))
  );

  return withTracking.map(({ row, tracking, match, carrierCandidates }) => ({
    ...row,
    tracking,
    match,
    carrierCandidates,
    duplicate: duplicates.get(row.id) ?? null,
  }));
}

/**
 * Same idea for return labels. There is no destination on the sheet, but the
 * sheet's "Return Delivered Date" sits within days of the real shipment, so
 * it works as a ship-date hint; otherwise recency and data quality decide.
 */
export function assembleReturnAssets(
  rows: (ReturnAssetRow & { id: string })[],
  candidatesByNumber: CandidateLookup
): ReturnAsset[] {
  const lookup = withFallback(candidatesByNumber);
  return rows.map((row) => {
    const context: MatchContext = {
      city: "",
      state: "",
      postalCode: "",
      shipDate: row.sheetDeliveredDate ?? "",
    };
    const candidates = lookup(row.returnTrackingNumber);
    const current = selectCandidate(candidates, context);
    const previous = row.previousReturnTrackingNumber
      ? selectCandidate(lookup(row.previousReturnTrackingNumber), context)
      : null;
    return {
      ...row,
      tracking: current.candidate.tracking,
      trackingMatch: current.match,
      previousTracking: previous?.candidate.tracking ?? null,
      previousTrackingMatch: previous?.match ?? null,
      carrierCandidates: candidates.length > 1 ? candidates : [],
    };
  });
}

/** Upload-time summary so the banner explains what was found. */
export function summarizeDuplicates(shipments: Shipment[]): string[] {
  const numbers = (predicate: (s: Shipment) => boolean) =>
    new Set(shipments.filter(predicate).map((s) => s.trackingNumber)).size;

  const messages: string[] = [];
  const conflicts = numbers((s) => s.duplicate?.kind === "CONFLICT");
  const exact = numbers((s) => s.duplicate?.kind === "EXACT");
  const shared = numbers((s) => s.duplicate?.kind === "SAME_DESTINATION");
  const reused = numbers((s) => s.match.candidateCount > 1);
  const unresolved = numbers((s) => s.match.confidence === "ambiguous");

  if (conflicts > 0) {
    messages.push(
      `${conflicts} tracking number${conflicts === 1 ? " is" : "s are"} listed for different recipients or destinations. Filter by "Duplicate check → Conflicts" to see which row FedEx's destination matches.`
    );
  }
  if (exact > 0) {
    messages.push(
      `${exact} shipment${exact === 1 ? " is" : "s are"} listed more than once with identical details.`
    );
  }
  if (shared > 0) {
    messages.push(
      `${shared} tracking number${shared === 1 ? " covers" : "s cover"} several rows to the same destination (multiple items in one package).`
    );
  }
  if (reused > 0) {
    messages.push(
      `FedEx returned more than one shipment for ${reused} tracking number${reused === 1 ? "" : "s"} (FedEx reuses numbers). The matching record was picked by destination, ship date and recency${
        unresolved > 0 ? `; ${unresolved} couldn't be decided and need a manual pick` : ""
      }.`
    );
  }
  return messages;
}
