import { describe, expect, it } from "vitest";
import { renderTemplate, STARTER_TEMPLATES, unknownFields } from "./render";

describe("renderTemplate", () => {
  it("fills known fields, tolerating spaces", () => {
    expect(
      renderTemplate("Hi {{ customer_name }}, from {{business_name}}", {
        customer_name: "Thandi",
        business_name: "Sparkle",
      }),
    ).toBe("Hi Thandi, from Sparkle");
  });

  it("blanks known fields without a value", () => {
    expect(renderTemplate("Suburb:{{suburb}}.", { suburb: null })).toBe("Suburb:.");
  });

  it("leaves unknown fields visible", () => {
    expect(renderTemplate("Hi {{custmer_name}}", { customer_name: "Thandi" })).toBe(
      "Hi {{custmer_name}}",
    );
  });

  it("does not interpret replacement patterns in values", () => {
    expect(renderTemplate("{{customer_name}}", { customer_name: "$& $1 $$" })).toBe("$& $1 $$");
  });

  it("reports unknown fields once", () => {
    expect(unknownFields("{{a}} {{customer_name}} {{a}} {{b}}")).toEqual(["a", "b"]);
  });

  it("starter templates only use known fields", () => {
    for (const t of STARTER_TEMPLATES) expect(unknownFields(t.body)).toEqual([]);
  });
});
