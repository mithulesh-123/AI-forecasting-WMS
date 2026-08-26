import { describe, expect, it } from "vitest";
import { toCsv, escapeCsvCell } from "@/lib/reports/csv";

describe("CSV serialization (RFC-4180)", () => {
  it("escapes commas, quotes and newlines", () => {
    expect(escapeCsvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(42)).toBe("42");
  });

  it("builds header + rows with CRLF line endings and a BOM", () => {
    const csv = toCsv(["SKU", "Qty"], [
      ["ELC-1001", 5],
      ['Weird "SKU", x', -1],
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toEqual([
      "SKU,Qty",
      "ELC-1001,5",
      '"Weird ""SKU"", x",-1',
    ]);
  });
});
