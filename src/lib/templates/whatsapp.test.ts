import { describe, expect, it } from "vitest";
import { toWhatsappNumber, whatsappLink } from "./whatsapp";

describe("toWhatsappNumber", () => {
  it.each([
    ["082 123 4567", "27821234567"],
    ["0821234567", "27821234567"],
    ["+27 82 123 4567", "27821234567"],
    ["0027821234567", "27821234567"],
    ["(021) 555-0000", "27215550000"],
    ["+44 20 7946 0958", "442079460958"],
  ])("normalises %s", (input, expected) => {
    expect(toWhatsappNumber(input)).toBe(expected);
  });

  it.each([null, undefined, "", "abc", "123"])("returns null for %j", (input) => {
    expect(toWhatsappNumber(input)).toBeNull();
  });
});

describe("whatsappLink", () => {
  it("encodes the message", () => {
    expect(whatsappLink("0821234567", "Hi & bye?")).toBe(
      "https://wa.me/27821234567?text=Hi%20%26%20bye%3F",
    );
  });

  it("returns null without a usable number", () => {
    expect(whatsappLink(null, "x")).toBeNull();
  });
});
