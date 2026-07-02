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
