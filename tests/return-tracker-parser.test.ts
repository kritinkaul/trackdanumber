import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { ExcelParseError, readWorkbook } from "@/lib/excel-parser";
import { deriveReturnInsight } from "@/lib/return-insights";
import { isReturnTrackerWorkbook, parseReturnTracker } from "@/lib/return-tracker-parser";
import { unavailableTracking } from "@/services/fedex/normalize";
import type { ReturnAsset } from "@/types/return-tracker";

const V4_HEADERS = [
  "Status (auto)",
  "Serial Number",
  "Assigned To",
  "Return Tracking Number",
  "Previous Return Tracking Number",
  "Routing Destination",
  "Actual Return Destination",
  "Return Delivered Date",
  "In Transit?",
  "Status Override",
  "Exception",
  "Notes",
  "Next Action",
  "Lenovo Defect?",
  "Batch",
  "Parked: Legal Hold?",
  "Parked: Refresh Number",
  "Parked: Insight SCTASK",
  "Parked: Status before Sept 2026 rebuild",
];

const V4_ROWS = [
  ["Complete", "PF4R5J33", "Andrew Schembri", "870613441212", "", "Lessor Return", "Lessor Return", "6/15/2026", "", "", "", "", "", "No", "Lenovo 86 (NY)", "No", "RITM0542774", "SCTASK0219495", "Awaiting Return"],
  ["Delivered – Closeout Pending", "PF4R62MB", "Kelly Gargiulo", "874056882384", "889877348594", "eDiscovery (Dallas)", "", "", "", "", "", "User is now on Legal Hold", "Email Insight", "No", "July 6 Batch", "Yes", "RITM0542800", "", "Awaiting Return"],
  ["⚠ Add Actual Return Destination", "C2L40706MV", "Hunter Rizzuto", "889877341854", "", "Lessor Return", "", "", "", "", "", "", "", "Yes", "July 6 Batch", "No", "", "", ""],
  ["", "JT41WH3", "Jake Sutter", "", "", "Lessor Return", "", "", "", "Action Required", "Awaiting New Laptop", "", "", "No", "", "No", "", "", ""],
];

function toCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(","))
    .join("\r\n");
}

/** Excel's "CSV" save: Windows-1252 bytes, so "–" is 0x96. */
function windows1252(text: string): ArrayBuffer {
  const bytes = [...text].map((char) => {
    if (char === "–") return 0x96;
    if (char === "⚠") return 0x3f; // Excel writes "?" for characters outside the code page
    return char.charCodeAt(0);
  });
  return new Uint8Array(bytes).buffer;
}

function asset(overrides: Partial<ReturnAsset>): ReturnAsset {
  const tracking = unavailableTracking("");
  return {
    id: "a",
    serialNumber: "S",
    assignedTo: "",
    refreshNumber: "",
    sctask: "",
    returnTrackingNumber: "1",
    previousReturnTrackingNumber: null,
    sheetStatus: "",
    sheetDeliveredDate: null,
    routingDestination: "",
    actualReturnDestination: "",
    legalHold: false,
    lenovoDefect: false,
    exception: "",
    notes: "",
    nextAction: "",
    batch: "",
    tracking: { ...tracking, errorMessage: undefined },
    previousTracking: null,
    trackingMatch: {
      selectedId: "",
      confidence: "single",
      reason: "",
      rule: "",
      candidateCount: 1,
      evaluations: [],
    },
    previousTrackingMatch: null,
    carrierCandidates: [],
    ...overrides,
  };
}

describe("Zero Touch Return Tracker v4", () => {
  it("reads the v4 CSV export (Windows-1252, renamed and parked columns)", () => {
    const workbook = readWorkbook(windows1252(toCsv([V4_HEADERS, ...V4_ROWS])), "tracker.csv");
    expect(isReturnTrackerWorkbook(workbook)).toBe(true);

    const { rows, warnings } = parseReturnTracker(workbook);
    expect(rows).toHaveLength(3);
    expect(warnings).toEqual(["1 asset skipped (no readable return tracking number)."]);

    const [complete, closeout, flagged] = rows;
    expect(complete).toMatchObject({
      sheetStatus: "Complete",
      refreshNumber: "RITM0542774",
      sctask: "SCTASK0219495",
      legalHold: false,
      batch: "Lenovo 86 (NY)",
    });
    expect(complete.sheetDeliveredDate?.slice(0, 10)).toBe("2026-06-15");
    expect(closeout).toMatchObject({
      sheetStatus: "Delivered – Closeout Pending",
      previousReturnTrackingNumber: "889877348594",
      legalHold: true,
      nextAction: "Email Insight",
    });
    expect(flagged).toMatchObject({ sheetStatus: "Add Actual Return Destination", lenovoDefect: true });
  });

  it("reads the same tracker saved as .xlsx with numeric tracking numbers and real dates", () => {
    const sheetRows: unknown[][] = [
      ["Zero Touch Return Tracker"],
      V4_HEADERS,
      ...V4_ROWS.map((row) =>
        row.map((value, col) => {
          if (col === 3 && value) return Number(value);
          if (col === 7 && value) return new Date(Date.UTC(2026, 5, 15));
          return value;
        })
      ),
    ];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(sheetRows, { cellDates: true }), "Tracker");
    const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const workbook = readWorkbook(buffer, "tracker.xlsx");
    const { rows } = parseReturnTracker(workbook);
    expect(rows.map((r) => r.returnTrackingNumber)).toEqual([
      "870613441212",
      "874056882384",
      "889877341854",
    ]);
    expect(rows[0].sheetDeliveredDate?.slice(0, 10)).toBe("2026-06-15");
    expect(rows[1].sheetStatus).toBe("Delivered – Closeout Pending");
  });

  it("uses Status Override when the auto status is blank", () => {
    const headers = ["Serial Number", "Return Tracking Number", "Status Override"];
    const workbook = readWorkbook(
      new TextEncoder().encode(toCsv([headers, ["PF1", "870613441212", "Complete"]])).buffer,
      "t.csv"
    );
    expect(parseReturnTracker(workbook).rows[0].sheetStatus).toBe("Complete");
  });

  it("still reads the original tracker layout", () => {
    const headers = ["Serial Number", "Assigned To", "Return Tracking Number", "Status", "Legal Hold", "Refresh Number"];
    const workbook = readWorkbook(
      new TextEncoder().encode(
        toCsv([headers, ["PF1", "Ann", "870613441212", "Awaiting Return", "Yes", "RITM1"]])
      ).buffer,
      "t.csv"
    );
    expect(parseReturnTracker(workbook).rows[0]).toMatchObject({
      sheetStatus: "Awaiting Return",
      legalHold: true,
      refreshNumber: "RITM1",
    });
  });
});

describe("files changed on a coworker's machine", () => {
  const scientific = (row: string[]) =>
    row.map((value, col) =>
      (col === 3 || col === 4) && /^\d{12}$/.test(value) ? Number(value).toExponential(5).toUpperCase() : value
    );

  it("explains that an Excel re-save destroyed the tracking numbers", () => {
    const csv = toCsv([V4_HEADERS, ...V4_ROWS.map(scientific)]);
    const workbook = readWorkbook(windows1252(csv), "tracker.csv");
    expect(isReturnTrackerWorkbook(workbook)).toBe(true);
    expect(() => parseReturnTracker(workbook)).toThrow(ExcelParseError);
    expect(() => parseReturnTracker(workbook)).toThrow(/8\.70613E\+11.*opened in Excel and saved again/);
  });

  it("keeps readable rows and warns about the rounded ones", () => {
    const csv = toCsv([V4_HEADERS, V4_ROWS[0], scientific(V4_ROWS[1]), V4_ROWS[2]]);
    const { rows, warnings } = parseReturnTracker(readWorkbook(windows1252(csv), "tracker.csv"));
    expect(rows.map((r) => r.serialNumber)).toEqual(["PF4R5J33", "C2L40706MV"]);
    expect(warnings[0]).toMatch(/^1 asset skipped: .*scientific notation/);
  });

  it("uses the sheet with the data when an emptied copy of the tracker comes first", () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([V4_HEADERS]), "Template");
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([["Title"], [], ["Legend"], V4_HEADERS, ...V4_ROWS]),
      "Daily View"
    );
    const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const parsed = parseReturnTracker(readWorkbook(buffer, "tracker.xlsx"));
    expect(parsed.sheetName).toBe("Daily View");
    expect(parsed.rows).toHaveLength(3);
  });

  it("names the sheet and column when no row has a tracking number", () => {
    const csv = toCsv([V4_HEADERS, ...V4_ROWS.map((row) => row.map((v, c) => (c === 3 || c === 4 ? "" : v)))]);
    expect(() => parseReturnTracker(readWorkbook(windows1252(csv), "t.csv"))).toThrow(
      /None of the 4 assets .*"Return Tracking Number" \(column D\)/
    );
  });
});

describe("v4 sheet statuses", () => {
  it("treats 'Delivered – Closeout Pending' as returned and asks for closeout", () => {
    const insight = deriveReturnInsight(asset({ sheetStatus: "Delivered – Closeout Pending" }));
    expect(insight.live).toBe("DELIVERED");
    expect(insight.attentionType).toBe("READY_TO_COMPLETE");
  });

  it("doesn't re-flag rows a coordinator already marked 'Action Required'", () => {
    const insight = deriveReturnInsight(asset({ sheetStatus: "Action Required" }));
    expect(insight.attentionType).toBeNull();
  });
});
