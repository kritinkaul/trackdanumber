import { parseOffice } from "@/lib/excel-parser";
import type { ReturnAssetRow } from "@/types/return-tracker";
import type { ExcelShipmentRow } from "@/types/shipment";

/** One FedEx call per unique number at 25-way concurrency must fit the 300 s function window. */
export const MAX_TRACKING_NUMBERS = 5000;

const MAX_FIELD_LENGTH = 500;

function str(value: unknown): string {
  if (typeof value === "string") return value.slice(0, MAX_FIELD_LENGTH).trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function nullableStr(value: unknown): string | null {
  return str(value) || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validates client-parsed manifest rows; the browser is not trusted to send well-formed data. */
export function sanitizeShipmentRows(input: unknown): ExcelShipmentRow[] {
  if (!Array.isArray(input)) return [];
  return input.filter(isRecord).flatMap((row, index) => {
    const trackingNumber = str(row.trackingNumber).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (!trackingNumber) return [];
    const deliverTo = str(row.deliverTo);
    const rowNumber = Number(row.rowNumber);
    return [
      {
        rowNumber: Number.isInteger(rowNumber) && rowNumber > 0 ? rowNumber : index + 2,
        trackingNumber,
        deliverTo,
        office: parseOffice(deliverTo),
        city: str(row.city),
        state: str(row.state),
        address: str(row.address),
        carrier: str(row.carrier),
        serialNumber: str(row.serialNumber),
        assetName: str(row.assetName),
        recipient: str(row.recipient),
        postalCode: str(row.postalCode),
        shipDate: str(row.shipDate),
      },
    ];
  });
}

export function sanitizeReturnRows(input: unknown): ReturnAssetRow[] {
  if (!Array.isArray(input)) return [];
  return input.filter(isRecord).flatMap((row) => {
    const returnTrackingNumber = str(row.returnTrackingNumber).replace(/\D/g, "");
    const serialNumber = str(row.serialNumber);
    if (!returnTrackingNumber || !serialNumber) return [];
    const previous = str(row.previousReturnTrackingNumber).replace(/\D/g, "");
    return [
      {
        serialNumber,
        assignedTo: str(row.assignedTo),
        refreshNumber: str(row.refreshNumber),
        sctask: str(row.sctask),
        returnTrackingNumber,
        previousReturnTrackingNumber: previous || null,
        sheetStatus: str(row.sheetStatus),
        sheetDeliveredDate: nullableStr(row.sheetDeliveredDate),
        routingDestination: str(row.routingDestination),
        actualReturnDestination: str(row.actualReturnDestination),
        legalHold: row.legalHold === true,
        lenovoDefect: row.lenovoDefect === true,
        exception: str(row.exception),
        notes: str(row.notes),
        batch: str(row.batch),
      },
    ];
  });
}

export function sanitizeWarnings(input: unknown): string[] {
  return Array.isArray(input) ? input.map(str).filter(Boolean).slice(0, 50) : [];
}
