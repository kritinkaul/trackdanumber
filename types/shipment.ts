export type ShipmentStatus =
  | "DELIVERED"
  | "OUT_FOR_DELIVERY"
  | "IN_TRANSIT"
  | "EXCEPTION"
  | "LABEL_CREATED"
  | "UNAVAILABLE"
  | "UNKNOWN";

export interface ScanEvent {
  timestamp: string;
  description: string;
  location: string;
  eventType: string;
  isException: boolean;
}

export interface TrackingInfo {
  status: ShipmentStatus;
  statusDescription: string;
  currentLocation: string | null;
  origin: string | null;
  estimatedDelivery: string | null;
  lastScanTime: string | null;
  serviceType: string | null;
  deliveryException: string | null;
  /** True when the package is being routed back to the shipper. */
  isReturnToShipper: boolean;
  /** The return leg's tracking number, when the carrier provides one. */
  returnTrackingNumber: string | null;
  /** Where the carrier says the package is going / was delivered. */
  destination: CarrierDestination | null;
  /** When the carrier says the package shipped. */
  shipDate: string | null;
  transitHistory?: ScanEvent[];
  errorMessage?: string;
}

export interface CarrierDestination {
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

/**
 * One carrier record for a tracking number. FedEx recycles tracking numbers,
 * so a single number can return several unrelated shipments (e.g. one
 * delivered years ago and one that was just created).
 */
export interface CarrierCandidate {
  /** FedEx `trackingNumberUniqueId`, or a positional fallback when absent. */
  uniqueId: string;
  tracking: TrackingInfo;
}

/**
 * How the displayed carrier record was chosen among the candidates.
 * - single: FedEx returned exactly one record
 * - matched: the sheet's destination / ship date clearly identifies one record
 * - likely: no destination proof, but recency / data quality favour one record
 * - ambiguous: the records can't be told apart — a person should confirm
 * - manual: a person picked the record in the UI
 */
export type MatchConfidence = "single" | "matched" | "likely" | "ambiguous" | "manual";

export interface CarrierMatch {
  selectedId: string;
  confidence: MatchConfidence;
  /** Human-readable explanation of why this record was chosen. */
  reason: string;
  candidateCount: number;
}

/**
 * How a row relates to other rows sharing its tracking number.
 * - EXACT: an identical row appears more than once (copy/paste duplicate)
 * - SAME_DESTINATION: same destination, different person or asset (e.g. two laptops in one box)
 * - CONFLICT: different destinations or people — at most one of them can be right
 */
export type DuplicateKind = "EXACT" | "SAME_DESTINATION" | "CONFLICT";

/** Whether a row's destination agrees with the carrier record chosen for it. */
export type CarrierFit = "match" | "mismatch" | "unknown";

export interface DuplicateInfo {
  kind: DuplicateKind;
  /** Number of rows (including this one) that share the tracking number. */
  groupSize: number;
  /** Spreadsheet row numbers of the other rows in the group. */
  otherRows: number[];
  carrierFit: CarrierFit;
  note: string;
}

/** Row data parsed from the uploaded spreadsheet — the source of truth for destination info. */
export interface ExcelShipmentRow {
  /** 1-based row number in the source sheet, so people can find the row in Excel. */
  rowNumber: number;
  trackingNumber: string;
  deliverTo: string;
  /**
   * Extracted A&M office label when deliverTo matches the "A&M | US-{Location}" pattern,
   * e.g. "A&M - New York, NY". Null for direct personal deliveries.
   */
  office: string | null;
  city: string;
  state: string;
  address: string;
  carrier: string;
  /** Serial number of the shipped asset (e.g. laptop), when the sheet has one. */
  serialNumber: string;
  /** Human-readable asset name/model, when the sheet has one. */
  assetName: string;
  /**
   * The person the shipment is ultimately for (care-of name). For office
   * shipments this is the employee the office coordinator should hand it to;
   * `deliverTo` holds the office itself in that case.
   */
  recipient: string;
  postalCode: string;
  /** ISO date the sheet says the package shipped, or "" when unknown. */
  shipDate: string;
}

export interface Shipment extends ExcelShipmentRow {
  /** Stable row id (tracking number + row index, since duplicates can exist). */
  id: string;
  tracking: TrackingInfo;
  match: CarrierMatch;
  /** Every carrier record for this number; only populated when there is more than one. */
  carrierCandidates: CarrierCandidate[];
  duplicate: DuplicateInfo | null;
}

export interface UploadResponse {
  shipments: Shipment[];
  warnings: string[];
}

export interface RefreshResponse {
  tracking: Record<string, CarrierCandidate[]>;
}

export interface ApiError {
  error: string;
  message: string;
}
