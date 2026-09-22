import { describe, expect, it } from "vitest";

import { matchesDuplicateFilter } from "@/lib/duplicates";
import { assembleShipments, summarizeDuplicates } from "@/lib/shipment-assembly";
import { toCarrierCandidates } from "@/services/fedex/normalize";
import { deliveredResult, row } from "./fixtures";

const houstonDelivery = toCarrierCandidates("873696428611", [
  deliveredResult({
    uniqueId: "hou",
    city: "Houston",
    state: "TX",
    postalCode: "77002",
    shipDate: "2026-09-15T10:00:00Z",
    deliveredAt: "2026-09-17T15:00:00Z",
  }),
]);

describe("duplicate tracking numbers in the sheet", () => {
  it("identifies which of two different recipients FedEx actually delivered to", () => {
    const shipments = assembleShipments(
      [
        row({ id: "a", rowNumber: 5, recipient: "Jane Doe", city: "Houston", state: "TX", postalCode: "77002" }),
        row({ id: "b", rowNumber: 9, recipient: "John Roe", city: "Seattle", state: "WA", postalCode: "98101" }),
      ],
      () => houstonDelivery
    );
    const [jane, john] = shipments;

    expect(jane.duplicate?.kind).toBe("CONFLICT");
    expect(jane.duplicate?.carrierFit).toBe("match");
    expect(jane.duplicate?.otherRows).toEqual([9]);
    expect(jane.duplicate?.note).toContain("most likely the real one");

    expect(john.duplicate?.carrierFit).toBe("mismatch");
    expect(john.duplicate?.note).toContain("wrong order");

    expect(matchesDuplicateFilter(jane, "REVIEW")).toBe(true);
    expect(summarizeDuplicates(shipments)[0]).toContain("different recipients");
  });

  it("marks copy-pasted rows as identical", () => {
    const shipments = assembleShipments(
      [
        row({ id: "a", rowNumber: 3, recipient: "Jane Doe", city: "Houston", state: "TX" }),
        row({ id: "b", rowNumber: 4, recipient: "Jane Doe", city: "Houston", state: "TX" }),
      ],
      () => houstonDelivery
    );
    expect(shipments.map((s) => s.duplicate?.kind)).toEqual(["EXACT", "EXACT"]);
    expect(matchesDuplicateFilter(shipments[0], "REVIEW")).toBe(false);
  });

  it("treats several employees' laptops to one office as one consolidated package", () => {
    const office = {
      deliverTo: "A&M | US-Houston, TX",
      office: "A&M - Houston, TX",
      address: "700 Louisiana St",
      city: "Houston",
      state: "TX",
    };
    const shipments = assembleShipments(
      [
        row({ id: "a", rowNumber: 3, recipient: "Jane Doe", serialNumber: "SN1", ...office }),
        row({ id: "b", rowNumber: 4, recipient: "John Roe", serialNumber: "SN2", ...office }),
      ],
      () => houstonDelivery
    );
    expect(shipments.map((s) => s.duplicate?.kind)).toEqual(["SAME_DESTINATION", "SAME_DESTINATION"]);
  });

  it("flags different people with no destination data as a conflict", () => {
    const shipments = assembleShipments(
      [
        row({ id: "a", rowNumber: 3, deliverTo: "Jane Doe" }),
        row({ id: "b", rowNumber: 4, deliverTo: "John Roe" }),
      ],
      () => houstonDelivery
    );
    expect(shipments[0].duplicate?.kind).toBe("CONFLICT");
    expect(shipments[0].duplicate?.carrierFit).toBe("unknown");
  });

  it("leaves unique rows alone", () => {
    const [shipment] = assembleShipments([row({ city: "Houston", state: "TX" })], () => houstonDelivery);
    expect(shipment.duplicate).toBeNull();
    expect(matchesDuplicateFilter(shipment, "ANY")).toBe(false);
  });
});
