import { afterEach, describe, expect, it, vi } from "vitest";

import { trackShipments } from "@/services/fedex/tracking";
import { deliveredResult, emptyResult } from "./fixtures";

vi.mock("@/services/fedex/auth", () => ({
  getAccessToken: async () => "test-token",
  getFedExBaseUrl: () => "https://fedex.test",
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("trackShipments", () => {
  it("returns every FedEx record for a recycled tracking number, not just the first", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          output: {
            completeTrackResults: [
              {
                trackingNumber: "873696428611",
                trackResults: [
                  emptyResult("A~873696428611~FX"),
                  deliveredResult({
                    uniqueId: "B~873696428611~FX",
                    city: "Houston",
                    state: "TX",
                    postalCode: "77002",
                    shipDate: "2026-09-15T10:00:00Z",
                    deliveredAt: "2026-09-17T15:00:00Z",
                  }),
                ],
              },
            ],
          },
        })
      )
    );

    const result = await trackShipments(["873696428611", "873696428611"]);
    const candidates = result.get("873696428611");
    expect(candidates).toHaveLength(2);
    expect(candidates?.map((c) => c.tracking.status)).toEqual(["UNKNOWN", "DELIVERED"]);
    expect(candidates?.[1].tracking.destination).toEqual({
      city: "Houston",
      state: "TX",
      postalCode: "77002",
    });
    expect(candidates?.[1].tracking.shipDate).toBe("2026-09-15T10:00:00Z");
  });

  it("records HTTP failures as unavailable instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ errors: [{ message: "Not found" }] }, { status: 404 }))
    );
    const result = await trackShipments(["123456789012"]);
    expect(result.get("123456789012")?.[0].tracking).toMatchObject({
      status: "UNAVAILABLE",
      errorMessage: "Not found",
    });
  });
});
