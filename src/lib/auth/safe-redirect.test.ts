import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("allows relative paths", () => {
    expect(safeRedirectPath("/app/acme?tab=1")).toBe("/app/acme?tab=1");
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "evil",
    "/a\nb",
  ])("rejects %j", (value) => {
    expect(safeRedirectPath(value)).toBe("/app");
  });

  it("falls back when empty", () => {
    expect(safeRedirectPath(null)).toBe("/app");
    expect(safeRedirectPath("", "/x")).toBe("/x");
  });
});
