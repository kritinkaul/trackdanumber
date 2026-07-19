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
  transitHistory?: ScanEvent[];
  errorMessage?: string;
}

/** Row data parsed from the uploaded spreadsheet — the source of truth for destination info. */
export interface ExcelShipmentRow {
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
}

export interface Shipment extends ExcelShipmentRow {
  /** Stable row id (tracking number + row index, since duplicates can exist). */
  id: string;
  tracking: TrackingInfo;
}

export interface UploadResponse {
  shipments: Shipment[];
  warnings: string[];
}

export interface RefreshResponse {
  tracking: Record<string, TrackingInfo>;
}

export interface ApiError {
  error: string;
  message: string;
}
