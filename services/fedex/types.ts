/** Minimal raw shapes of the FedEx Track API v1 response (only fields we consume). */

export interface FedExLocation {
  city?: string;
  stateOrProvinceCode?: string;
  countryCode?: string;
}

export interface FedExScanLocation extends FedExLocation {
  postalCode?: string;
}

export interface FedExAncillaryDetail {
  reason?: string;
  reasonDescription?: string;
  action?: string;
  actionDescription?: string;
}

export interface FedExLatestStatusDetail {
  code?: string;
  derivedCode?: string;
  statusByLocale?: string;
  description?: string;
  scanLocation?: FedExScanLocation;
  ancillaryDetails?: FedExAncillaryDetail[];
}

export interface FedExScanEvent {
  date?: string;
  eventType?: string;
  eventDescription?: string;
  exceptionCode?: string;
  exceptionDescription?: string;
  scanLocation?: FedExScanLocation;
  derivedStatusCode?: string;
  derivedStatus?: string;
}

export interface FedExDateAndTime {
  type?: string;
  dateTime?: string;
}

export interface FedExTimeWindow {
  window?: { begins?: string; ends?: string };
}

export interface FedExTrackResult {
  trackingNumberInfo?: { trackingNumber?: string };
  error?: { code?: string; message?: string };
  latestStatusDetail?: FedExLatestStatusDetail;
  dateAndTimes?: FedExDateAndTime[];
  scanEvents?: FedExScanEvent[];
  serviceDetail?: { type?: string; description?: string };
  originLocation?: { locationContactAndAddress?: { address?: FedExScanLocation } };
  shipperInformation?: { address?: FedExScanLocation };
  estimatedDeliveryTimeWindow?: FedExTimeWindow;
  standardTransitTimeWindow?: FedExTimeWindow;
}

export interface FedExCompleteTrackResult {
  trackingNumber?: string;
  trackResults?: FedExTrackResult[];
}

export interface FedExTrackResponse {
  output?: {
    completeTrackResults?: FedExCompleteTrackResult[];
  };
  errors?: { code?: string; message?: string }[];
}
