import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { ExcelParseError, parseSpreadsheet, parseTrackingCell } from "@/lib/excel-parser";
import { isReturnTrackerWorkbook } from "@/lib/return-tracker-parser";

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

function xlsxBuffer(sheets: Record<string, unknown[][]>, bookType: XLSX.BookType = "xlsx"): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows, { cellDates: true }), name);
  }
  const out = XLSX.write(workbook, { type: "array", bookType }) as ArrayBuffer;
  return out;
}

function textBuffer(text: string): ArrayBuffer {
  return toArrayBuffer(new TextEncoder().encode(text));
}

describe("parseTrackingCell", () => {
  it("cleans the ways people and Excel mangle tracking numbers", () => {
    expect(parseTrackingCell(873696428611).numbers).toEqual(["873696428611"]);
    expect(parseTrackingCell("'873696428611").numbers).toEqual(["873696428611"]);
    expect(parseTrackingCell("8736 9642 8611").numbers).toEqual(["873696428611"]);
    expect(parseTrackingCell("8736-9642-8611").numbers).toEqual(["873696428611"]);
    expect(parseTrackingCell("873696428611.0").numbers).toEqual(["873696428611"]);
    expect(parseTrackingCell("\u00a0873696428611\u200b").numbers).toEqual(["873696428611"]);
    expect(parseTrackingCell("1z999aa10123456784").numbers).toEqual(["1Z999AA10123456784"]);
    expect(parseTrackingCell("N/A").numbers).toEqual([]);
    expect(parseTrackingCell("pending").numbers).toEqual([]);
  });

  it("splits cells holding several numbers", () => {
    expect(parseTrackingCell("873696428611, 873696428622").numbers).toEqual([
      "873696428611",
      "873696428622",
    ]);
    expect(parseTrackingCell("873696428611\n873696428622").numbers).toHaveLength(2);
  });

  it("rejects scientific notation and flags rounded numbers", () => {
    expect(parseTrackingCell("8.73696E+11")).toEqual({ numbers: [], issue: "SCIENTIFIC" });
    expect(parseTrackingCell(9612019123456789000000).issue).toBe("PRECISION");
  });
});

describe("parseSpreadsheet (.xlsx)", () => {
  it("finds the header below a title row and reports real sheet row numbers", () => {
    const buffer = xlsxBuffer({
      Shipments: [
        ["Tracking report – September"],
        [],
        ["Tracking Number", "Deliver To", "City", "State", "Zip", "Ship Date", "Carrier", "Address"],
        [873696428611, "Jane Doe", "Boston", "MA", 2134, new Date("2026-09-15T00:00:00Z"), "FedEx", "1 Main St"],
        [],
        ["'873696428622", "John Roe", "Houston", "TX", "77002", "2026-09-16", "FedEx", "2 Main St"],
        ["", "No tracking", "Austin", "TX", "", "", "", ""],
      ],
    });

    const parsed = parseSpreadsheet(buffer, "manifest.xlsx");
    expect(parsed.rows).toHaveLength(2);
    const [jane, john] = parsed.rows;
    expect(jane.rowNumber).toBe(4);
    expect(jane.trackingNumber).toBe("873696428611");
    expect(jane.postalCode).toBe("02134");
    expect(jane.shipDate.slice(0, 10)).toBe("2026-09-15");
    expect(john.rowNumber).toBe(6);
    expect(john.trackingNumber).toBe("873696428622");
    expect(parsed.warnings.some((w) => w.includes("row 7"))).toBe(true);
  });

  it("reads the shipment sheet even when it isn't the first sheet", () => {
    const buffer = xlsxBuffer({
      Summary: [["Total shipments", 2]],
      Data: [
        ["Tracking #", "Recipient", "City"],
        ["873696428611", "Jane", "Boston"],
      ],
    });
    const parsed = parseSpreadsheet(buffer, "book.xlsx");
    expect(parsed.sheetName).toBe("Data");
    expect(parsed.rows[0].recipient).toBe("Jane");
  });

  it("doesn't let 'Ship To' steal the ZIP column", () => {
    const buffer = xlsxBuffer({
      Sheet1: [
        ["Ship To Zip", "Tracking Number", "Ship To City"],
        ["10001", "873696428611", "New York"],
      ],
    });
    const [only] = parseSpreadsheet(buffer, "a.xlsx").rows;
    expect(only.postalCode).toBe("10001");
    expect(only.city).toBe("New York");
  });

  it("warns about scientific-notation tracking numbers instead of tracking garbage", () => {
    const buffer = xlsxBuffer({
      Sheet1: [
        ["Tracking Number", "Deliver To"],
        ["8.73696E+11", "Jane"],
        ["873696428611", "John"],
      ],
    });
    const parsed = parseSpreadsheet(buffer, "a.xlsx");
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.warnings.join(" ")).toContain("scientific notation");
  });

  it("splits a cell with two tracking numbers into two shipments", () => {
    const buffer = xlsxBuffer({
      Sheet1: [
        ["Tracking Number", "Deliver To"],
        ["873696428611; 873696428622", "Jane"],
      ],
    });
    const parsed = parseSpreadsheet(buffer, "a.xlsx");
    expect(parsed.rows.map((r) => r.trackingNumber)).toEqual(["873696428611", "873696428622"]);
    expect(parsed.rows.every((r) => r.rowNumber === 2)).toBe(true);
  });

  it("keeps duplicate rows so they can be flagged", () => {
    const buffer = xlsxBuffer({
      Sheet1: [
        ["Tracking Number", "Deliver To"],
        ["873696428611", "Jane"],
        ["873696428611", "John"],
      ],
    });
    expect(parseSpreadsheet(buffer, "a.xlsx").rows).toHaveLength(2);
  });

  it("reads legacy .xls files", () => {
    const buffer = xlsxBuffer(
      { Sheet1: [["Tracking Number"], ["873696428611"]] },
      "biff8"
    );
    expect(parseSpreadsheet(buffer, "old.xls").rows[0].trackingNumber).toBe("873696428611");
  });

  it("gives clear errors for empty, corrupt and header-less files", () => {
    expect(() => parseSpreadsheet(new ArrayBuffer(0), "a.xlsx")).toThrow(ExcelParseError);
    // A truncated zip (what a size-limited proxy used to deliver).
    const truncated = xlsxBuffer({ Sheet1: [["Tracking Number"], ["873696428611"]] }).slice(0, 200);
    expect(() => parseSpreadsheet(truncated, "a.xlsx")).toThrow(/Could not read the file/);
    const noHeader = xlsxBuffer({ Sheet1: [["Name", "City"], ["Jane", "Boston"]] });
    expect(() => parseSpreadsheet(noHeader, "a.xlsx")).toThrow(/Tracking Number/);
  });
});

describe("parseSpreadsheet (.csv)", () => {
  it("keeps long numeric tracking numbers and ZIP leading zeros intact", () => {
    const csv = "\ufeffTracking Number,Deliver To,Zip\r\n9612019123456789012345,Jane,02134\r\n";
    const [only] = parseSpreadsheet(textBuffer(csv), "manifest.csv").rows;
    expect(only.trackingNumber).toBe("9612019123456789012345");
    expect(only.postalCode).toBe("02134");
    expect(only.deliverTo).toBe("Jane");
  });
});

describe("return tracker detection", () => {
  it("still routes the Zero Touch tracker to its own parser", () => {
    const workbook = XLSX.read(
      new Uint8Array(
        xlsxBuffer({
          "Daily View Updated": [
            ["Legend"],
            ["Serial Number", "Return Tracking Number", "Status"],
            ["SN1", "873696428611", "Awaiting Return"],
          ],
        })
      ),
      { type: "array" }
    );
    expect(isReturnTrackerWorkbook(workbook)).toBe(true);
  });
});
