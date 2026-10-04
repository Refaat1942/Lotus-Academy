import { describe, expect, it } from "vitest";
import { parseRange, toCsv } from "./reports";

describe("csv export", () => {
  it("quotes, escapes and neutralises formulas", () => {
    const csv = toCsv([["a", 'he said "hi"', "=cmd|' /C calc'!A0", "x,y", "+1", null]]);
    expect(csv).toContain('"he said ""hi"""');
    expect(csv).toContain("'=cmd");
    expect(csv).toContain("'+1");
    expect(csv).toContain('"x,y"');
  });
});

describe("date range", () => {
  it("defaults to 30 days and rejects inverted custom ranges", () => {
    const d = parseRange({});
    expect(d.key).toBe("30d");
    expect(parseRange({ range: "custom", from: "2026-02-01", to: "2026-01-01" }).key).toBe("30d");
    expect(parseRange({ range: "custom", from: "2026-01-01", to: "2026-01-31" }).key).toBe("custom");
  });
});
