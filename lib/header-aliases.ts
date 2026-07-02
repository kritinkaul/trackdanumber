import type { ExcelShipmentRow } from "@/types/shipment";

// Columns read from the spreadsheet; `office` is derived from deliverTo, not mapped.
export type ExcelField = Exclude<keyof ExcelShipmentRow, "office">;

/**
 * Known header name synonyms, compared after normalization
 * (lowercased, punctuation stripped, whitespace collapsed).
 */
export const HEADER_ALIASES: Record<ExcelField, string[]> = {
  trackingNumber: [
    // ServiceNow / u_ prefix exports (underscores normalize to spaces)
    "u tracking number",
    // Generic forms
    "tracking number",
    "tracking",
    "tracking no",
    "tracking num",
    "trackingnumber",
    "track number",
    "trk number",
    "trk",
    "airbill",
    "airbill number",
    "waybill",
    "waybill number",
  ],
  deliverTo: [
    // ServiceNow
    "u deliver to name",
    "u deliver name co",
    "u customer name",
    // Generic forms
    "deliver to",
    "deliverto",
    "recipient",
    "recipient name",
    "consignee",
    "consignee name",
    "customer",
    "customer name",
    "ship to",
    "ship to name",
    "attention",
    "attn",
  ],
  city: [
    // ServiceNow
    "u ship to city",
    // Generic forms
    "city",
    "destination city",
    "ship to city",
    "dest city",
  ],
  state: [
    // ServiceNow
    "u ship to state",
    // Generic forms
    "state",
    "st",
    "destination state",
    "ship to state",
    "dest state",
    "province",
  ],
  address: [
    // ServiceNow
    "u ship to address 1",
    "u ship to address",
    // Generic forms
    "address",
    "street address",
    "address 1",
    "address line 1",
    "ship to address",
    "destination address",
    "street",
  ],
  carrier: [
    // ServiceNow
    "u shipping carrier",
    // Generic forms
    "carrier",
    "shipper",
    "carrier name",
    "shipping carrier",
    "ship via",
    "shipped via",
  ],
};

export const REQUIRED_FIELD: ExcelField = "trackingNumber";

export const FIELD_LABELS: Record<ExcelField, string> = {
  trackingNumber: "Tracking Number",
  deliverTo: "Deliver To",
  city: "City",
  state: "State",
  address: "Address",
  carrier: "Carrier",
};
