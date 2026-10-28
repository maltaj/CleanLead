import { describe, expect, it } from "vitest";
import { leadSchema, stageChangeSchema, uuidSchema } from "./leads";

const valid = {
  name: " Thandi Mokoena ",
  phone: "082 123 4567",
  email: "",
  suburb: "Sea Point",
  serviceType: "Deep cleaning",
  estValue: "R1 500",
  source: "whatsapp",
  assignedTo: "",
  notes: "",
};

describe("leadSchema", () => {
  it("normalises a valid lead", () => {
    const lead = leadSchema.parse(valid);
    expect(lead).toMatchObject({
      name: "Thandi Mokoena",
      phone: "082 123 4567",
      email: null,
      estValue: 150000,
      assignedTo: null,
      notes: null,
    });
  });

  it("requires a phone or an email", () => {
    const result = leadSchema.safeParse({ ...valid, phone: "", email: "" });
    expect(result.success).toBe(false);
  });

  it("accepts email only", () => {
    expect(leadSchema.safeParse({ ...valid, phone: "", email: "T@Example.com" }).success).toBe(
      true,
    );
  });

  it.each(["abc", "123", "0821234567890123456789012345"])("rejects phone %j", (phone) => {
    expect(leadSchema.safeParse({ ...valid, phone }).success).toBe(false);
  });

  it("rejects unknown sources and bad values", () => {
    expect(leadSchema.safeParse({ ...valid, source: "carrier-pigeon" }).success).toBe(false);
    expect(leadSchema.safeParse({ ...valid, estValue: "lots" }).success).toBe(false);
  });

  it("rejects a malformed assignee id", () => {
    expect(leadSchema.safeParse({ ...valid, assignedTo: "not-a-uuid" }).success).toBe(false);
  });
});

describe("stageChangeSchema", () => {
  it("accepts known stages only", () => {
    expect(stageChangeSchema.safeParse({ stage: "won", lostReason: "" }).success).toBe(true);
    expect(stageChangeSchema.safeParse({ stage: "follow_up_due", lostReason: "" }).success).toBe(
      false,
    );
  });
});

describe("uuidSchema", () => {
  it("rejects non-uuids", () => {
    expect(uuidSchema.safeParse("123").success).toBe(false);
  });
});
