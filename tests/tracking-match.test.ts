import { describe, expect, it } from "vitest";

import { assembleShipments } from "@/lib/shipment-assembly";
import {
  compareDestination,
  normalizePostalCode,
  normalizeState,
  selectCandidate,
} from "@/lib/tracking-match";
import { toCarrierCandidates } from "@/services/fedex/normalize";
import { deliveredResult, emptyResult, labelCreatedResult, row } from "./fixtures";

const TN = "873696428611";

describe("normalizers", () => {
  it("restores leading zeros and strips ZIP+4", () => {
    expect(normalizePostalCode("2134")).toBe("02134");
    expect(normalizePostalCode("02134-1234")).toBe("02134");
    expect(normalizePostalCode("021341234")).toBe("02134");
  });

  it("maps full state names to codes", () => {
    expect(normalizeState("New York")).toBe("NY");
    expect(normalizeState("tx")).toBe("TX");
  });
});

describe("selectCandidate for a recycled tracking number", () => {
  it("prefers the delivered record over FedEx's empty 'no update' record", () => {
    const candidates = toCarrierCandidates(TN, [
      emptyResult("A~873696428611~FX"),
      deliveredResult({
        uniqueId: "B~873696428611~FX",
        city: "Houston",
        state: "TX",
        shipDate: "2026-09-15T10:00:00Z",
        deliveredAt: "2026-09-17T15:00:00Z",
      }),
    ]);

    const { candidate, match } = selectCandidate(candidates);
    expect(candidate.uniqueId).toBe("B~873696428611~FX");
    expect(candidate.tracking.status).toBe("DELIVERED");
    expect(match.confidence).toBe("likely");
    expect(match.candidateCount).toBe(2);
  });

  it("uses the sheet destination to prove which record is ours", () => {
    const candidates = toCarrierCandidates(TN, [
      deliveredResult({
        uniqueId: "old",
        city: "Chicago",
        state: "IL",
        postalCode: "60601",
        shipDate: "2026-09-10T10:00:00Z",
        deliveredAt: "2026-09-12T15:00:00Z",
      }),
      deliveredResult({
        uniqueId: "ours",
        city: "Houston",
        state: "TX",
        postalCode: "77002",
        shipDate: "2026-09-09T10:00:00Z",
        deliveredAt: "2026-09-11T15:00:00Z",
      }),
    ]);

    const { candidate, match } = selectCandidate(candidates, {
      city: "Houston",
      state: "Texas",
      postalCode: "77002",
      shipDate: "",
    });
    expect(candidate.uniqueId).toBe("ours");
    expect(match.confidence).toBe("matched");
    expect(match.reason).toContain("ZIP matches");
  });

  it("treats a years-old delivery as a previous use of the number", () => {
    const candidates = toCarrierCandidates(TN, [
      deliveredResult({
        uniqueId: "2023",
        city: "Tampa",
        state: "FL",
        shipDate: "2023-03-01T10:00:00Z",
        deliveredAt: "2023-03-03T15:00:00Z",
      }),
      labelCreatedResult({
        uniqueId: "2026",
        city: "Tampa",
        state: "FL",
        shipDate: "2026-09-21T10:00:00Z",
      }),
    ]);

    // Both went to Tampa, so destination can't decide — recency must.
    const { candidate, match } = selectCandidate(candidates, {
      city: "Tampa",
      state: "FL",
      postalCode: "",
      shipDate: "",
    });
    expect(candidate.uniqueId).toBe("2026");
    expect(match.confidence).toBe("likely");
    expect(match.reason).toContain("older use of this number");
  });

  it("uses the sheet ship date when present", () => {
    const candidates = toCarrierCandidates(TN, [
      labelCreatedResult({ uniqueId: "new", city: "Dallas", state: "TX", shipDate: "2026-09-20T10:00:00Z" }),
      deliveredResult({
        uniqueId: "ours",
        city: "Dallas",
        state: "TX",
        shipDate: "2026-09-02T10:00:00Z",
        deliveredAt: "2026-09-04T10:00:00Z",
      }),
    ]);
    const { candidate } = selectCandidate(candidates, {
      city: "Dallas",
      state: "TX",
      postalCode: "",
      shipDate: "2026-09-01T00:00:00Z",
    });
    expect(candidate.uniqueId).toBe("ours");
  });

  it("flags records it cannot tell apart", () => {
    const candidates = toCarrierCandidates(TN, [
      deliveredResult({
        uniqueId: "a",
        city: "Boston",
        state: "MA",
        shipDate: "2026-09-10T10:00:00Z",
        deliveredAt: "2026-09-12T15:00:00Z",
      }),
      deliveredResult({
        uniqueId: "b",
        city: "Boston",
        state: "MA",
        shipDate: "2026-09-10T11:00:00Z",
        deliveredAt: "2026-09-12T16:00:00Z",
      }),
    ]);
    const { match } = selectCandidate(candidates, {
      city: "Boston",
      state: "MA",
      postalCode: "",
      shipDate: "",
    });
    expect(match.confidence).toBe("ambiguous");
  });

  it("honours a manual pick", () => {
    const candidates = toCarrierCandidates(TN, [
      emptyResult("empty"),
      deliveredResult({
        uniqueId: "delivered",
        city: "Houston",
        state: "TX",
        shipDate: "2026-09-15T10:00:00Z",
        deliveredAt: "2026-09-17T15:00:00Z",
      }),
    ]);
    const { candidate, match } = selectCandidate(candidates, undefined, "empty");
    expect(candidate.uniqueId).toBe("empty");
    expect(match.confidence).toBe("manual");
  });
});

describe("compareDestination", () => {
  it("reports a mismatch when the state differs", () => {
    const result = compareDestination(
      { city: "Portland", state: "OR", postalCode: "", shipDate: "" },
      { city: "Portland", state: "ME", postalCode: null }
    );
    expect(result.fit).toBe("mismatch");
  });

  it("is unknown without carrier destination data", () => {
    expect(
      compareDestination({ city: "Austin", state: "TX", postalCode: "", shipDate: "" }, null).fit
    ).toBe("unknown");
  });
});

describe("assembleShipments", () => {
  it("uses the office location when the sheet has no city", () => {
    const candidates = toCarrierCandidates(TN, [
      deliveredResult({
        uniqueId: "nyc",
        city: "New York",
        state: "NY",
        shipDate: "2026-09-15T10:00:00Z",
        deliveredAt: "2026-09-17T15:00:00Z",
      }),
      deliveredResult({
        uniqueId: "la",
        city: "Los Angeles",
        state: "CA",
        shipDate: "2026-09-14T10:00:00Z",
        deliveredAt: "2026-09-16T15:00:00Z",
      }),
    ]);
    const [shipment] = assembleShipments(
      [row({ deliverTo: "A&M | US-New York, NY", office: "A&M - New York, NY" })],
      () => candidates
    );
    expect(shipment.match.selectedId).toBe("nyc");
    expect(shipment.match.confidence).toBe("matched");
    expect(shipment.carrierCandidates).toHaveLength(2);
  });

  it("falls back to an unavailable record when FedEx returned nothing", () => {
    const [shipment] = assembleShipments([row({})], () => []);
    expect(shipment.tracking.status).toBe("UNAVAILABLE");
    expect(shipment.match.confidence).toBe("single");
  });
});
