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
    "u customer name",
    // Generic forms
    "deliver to",
    "deliverto",
    "consignee",
    "consignee name",
    "customer",
    "customer name",
    "ship to",
    "ship to name",
  ],
  recipient: [
    // ServiceNow: care-of / attention name (the person at an office shipment)
    "u deliver name co",
    // Generic forms
    "recipient",
    "recipient name",
    "care of",
    "c o",
    "attention",
    "attn",
    "end user",
    "end user name",
    "employee",
    "employee name",
    "contact",
    "contact name",
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
  serialNumber: [
    // ServiceNow
    "u serial number",
    "u asset serial number",
    // Generic forms
    "serial number",
    "serial no",
    "serial num",
    "serial",
    "serialnumber",
    "sn",
    "s n",
    "asset serial",
    "asset serial number",
    "device serial",
    "device serial number",
    "service tag",
  ],
  assetName: [
    // ServiceNow
    "u asset name",
    "u asset",
    "u model",
    "u asset model",
    // Generic forms
    "asset name",
    "asset",
    "asset description",
    "asset model",
    "device name",
    "device",
    "device model",
    "model",
    "model name",
    "item",
    "item name",
    "item description",
    "product",
    "product name",
    "description",
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
  serialNumber: "Serial Number",
  assetName: "Asset Name",
  recipient: "Recipient",
};

/**
 * Optional columns that shouldn't produce a "column not found" warning —
 * many daily sheets won't include asset details or a separate recipient.
 */
export const SILENT_OPTIONAL_FIELDS: ReadonlySet<ExcelField> = new Set([
  "serialNumber",
  "assetName",
  "recipient",
]);
