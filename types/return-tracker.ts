import type { CarrierCandidate, CarrierMatch, TrackingInfo } from "@/types/shipment";

/**
 * One asset row parsed from the "Daily View Updated" sheet of the
 * Zero Touch Return Tracker workbook. Sheet-sourced fields are kept
 * verbatim so coordinators can reconcile against what they maintain.
 */
export interface ReturnAssetRow {
  serialNumber: string;
  assignedTo: string;
  /** RITM refresh ticket, when present. */
  refreshNumber: string;
  /** Insight SCTASK ticket, when present. */
  sctask: string;
  /** Column F — the label the user is expected to ship the old asset on. */
  returnTrackingNumber: string;
  /** Column G — an earlier label that may have been used instead. */
  previousReturnTrackingNumber: string | null;
  /** Column O, verbatim (e.g. "Awaiting Return", "Complete"). */
  sheetStatus: string;
  /** ISO date from "Return Delivered Date", when the sheet has one. */
  sheetDeliveredDate: string | null;
  routingDestination: string;
  actualReturnDestination: string;
  legalHold: boolean;
  lenovoDefect: boolean;
  exception: string;
  notes: string;
  /** Coordinator's follow-up from the "Next Action" column (tracker v4+). */
  nextAction: string;
  batch: string;
}

export interface ReturnAsset extends ReturnAssetRow {
  /** Stable row id (serial + row index). */
  id: string;
  /** Live carrier data for the current label (column F). */
  tracking: TrackingInfo;
  /** Live carrier data for the previous label (column G), when one exists. */
  previousTracking: TrackingInfo | null;
  /** How `tracking` was chosen when FedEx has several shipments on the label. */
  trackingMatch: CarrierMatch;
  previousTrackingMatch: CarrierMatch | null;
  /** All FedEx records for the current label; only populated when there is more than one. */
  carrierCandidates: CarrierCandidate[];
}

export interface ReturnsUploadResponse {
  kind: "returns";
  assets: ReturnAsset[];
  warnings: string[];
}
