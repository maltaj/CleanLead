import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fieldErrors, formString } from "./forms";

describe("fieldErrors", () => {
  it("keeps the first message per field", () => {
    const result = z.object({ a: z.string().min(3), b: z.string() }).safeParse({ a: "x", b: "y" });
    expect(result.success).toBe(false);
    if (!result.success) expect(Object.keys(fieldErrors(result.error))).toEqual(["a"]);
  });
});

describe("formString", () => {
  it("returns empty string for missing or file values", () => {
    const data = new FormData();
    data.set("file", new Blob(["x"]), "x.txt");
    expect(formString(data, "missing")).toBe("");
    expect(formString(data, "file")).toBe("");
  });
});
