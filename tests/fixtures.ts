import type { FedExTrackResult } from "@/services/fedex/types";
import type { ExcelShipmentRow } from "@/types/shipment";

/** A delivered FedEx record, shaped like the Track API v1 response. */
export function deliveredResult(options: {
  uniqueId: string;
  city: string;
  state: string;
  postalCode?: string;
  shipDate: string;
  deliveredAt: string;
}): FedExTrackResult {
  const address = {
    city: options.city,
    stateOrProvinceCode: options.state,
    postalCode: options.postalCode,
    countryCode: "US",
  };
  return {
    trackingNumberInfo: { trackingNumber: "873696428611", trackingNumberUniqueId: options.uniqueId },
    latestStatusDetail: {
      code: "DL",
      derivedCode: "DL",
      statusByLocale: "Delivered",
      description: "Delivered",
      scanLocation: address,
    },
    recipientInformation: { address },
    dateAndTimes: [
      { type: "SHIP", dateTime: options.shipDate },
      { type: "ACTUAL_DELIVERY", dateTime: options.deliveredAt },
    ],
    scanEvents: [
      {
        date: options.deliveredAt,
        eventType: "DL",
        eventDescription: "Delivered",
        derivedStatusCode: "DL",
        scanLocation: address,
      },
      {
        date: options.shipDate,
        eventType: "PU",
        eventDescription: "Picked up",
        derivedStatusCode: "PU",
        scanLocation: { city: "Memphis", stateOrProvinceCode: "TN" },
      },
    ],
  };
}

/** The "no update" record FedEx returns next to the real one for a recycled number. */
export function emptyResult(uniqueId: string): FedExTrackResult {
  return {
    trackingNumberInfo: { trackingNumber: "873696428611", trackingNumberUniqueId: uniqueId },
    latestStatusDetail: {},
  };
}

export function labelCreatedResult(options: {
  uniqueId: string;
  city: string;
  state: string;
  shipDate: string;
}): FedExTrackResult {
  return {
    trackingNumberInfo: { trackingNumber: "873696428611", trackingNumberUniqueId: options.uniqueId },
    latestStatusDetail: { code: "OC", derivedCode: "IN", statusByLocale: "Label created" },
    recipientInformation: {
      address: { city: options.city, stateOrProvinceCode: options.state, countryCode: "US" },
    },
    dateAndTimes: [{ type: "SHIP", dateTime: options.shipDate }],
    scanEvents: [
      {
        date: options.shipDate,
        eventType: "OC",
        eventDescription: "Shipment information sent to FedEx",
        derivedStatusCode: "IN",
      },
    ],
  };
}

export function row(overrides: Partial<ExcelShipmentRow> & { id?: string }) {
  const base: ExcelShipmentRow & { id: string } = {
    id: overrides.id ?? `row-${overrides.rowNumber ?? 2}`,
    rowNumber: 2,
    trackingNumber: "873696428611",
    deliverTo: "",
    office: null,
    city: "",
    state: "",
    address: "",
    carrier: "FedEx",
    serialNumber: "",
    assetName: "",
    recipient: "",
    postalCode: "",
    shipDate: "",
  };
  return { ...base, ...overrides };
}
