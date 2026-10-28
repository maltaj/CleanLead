import { describe, expect, it } from "vitest";
import { sanitizeSearchTerm } from "./search";

describe("sanitizeSearchTerm", () => {
  it("removes filter and wildcard characters", () => {
    expect(sanitizeSearchTerm("a,b)(c%d_e*f\\g")).toBe("a b c d e f g");
  });

  it("neutralises attempts to inject extra filters", () => {
    const out = sanitizeSearchTerm(
      "x),org_id.neq.00000000-0000-0000-0000-000000000000,name.ilike.(y",
    );
    expect(out).not.toMatch(/[,()]/);
  });

  it("trims, collapses whitespace and bounds length", () => {
    expect(sanitizeSearchTerm("   Sea   Point  ")).toBe("Sea Point");
    expect(sanitizeSearchTerm("x".repeat(200))).toHaveLength(60);
    expect(sanitizeSearchTerm(undefined)).toBe("");
  });
});
