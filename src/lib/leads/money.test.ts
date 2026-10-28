import { describe, expect, it } from "vitest";
import { centsToRandsInput, formatZar, parseRandsToCents } from "./money";

describe("parseRandsToCents", () => {
  it.each([
    ["1500", 150000],
    ["R1 500", 150000],
    ["r 1500,50", 150050],
    ["1,500.00", 150000],
    ["1 234 567", null],
    ["0", 0],
    ["99.5", 9950],
    ["1000000", 100000000],
  ])("parses %j", (input, expected) => {
    const result = parseRandsToCents(input);
    if (expected === null) {
      expect(result.ok).toBe(false);
    } else {
      expect(result).toEqual({ ok: true, cents: expected });
    }
  });

  it("treats blank as no value", () => {
    expect(parseRandsToCents("  ")).toEqual({ ok: true, cents: null });
  });

  it.each(["abc", "-5", "1.234", "12,5,5", "1000000.01", "1e6"])("rejects %j", (input) => {
    expect(parseRandsToCents(input).ok).toBe(false);
  });
});

describe("formatting", () => {
  it("formats rand amounts", () => {
    expect(formatZar(150000)).toMatch(/1\s500/);
    expect(formatZar(null)).toBe("–");
  });

  it("round-trips through the input helper", () => {
    expect(centsToRandsInput(150050)).toBe("1500.50");
    expect(centsToRandsInput(150000)).toBe("1500");
    expect(centsToRandsInput(null)).toBe("");
  });
});
