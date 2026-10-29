import { describe, expect, it } from "vitest";
import { publicEnquirySchema } from "./validation";

const valid = {
  name: "Lerato",
  phone: "082 123 4567",
  email: "",
  suburb: "",
  serviceType: "",
  message: "",
  consent: "on",
  website: "",
};

describe("publicEnquirySchema", () => {
  it("accepts a minimal valid enquiry and defaults the service", () => {
    const r = publicEnquirySchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.serviceType).toBe("General cleaning");
  });
  it("requires a phone or email", () => {
    expect(publicEnquirySchema.safeParse({ ...valid, phone: "" }).success).toBe(false);
    expect(publicEnquirySchema.safeParse({ ...valid, phone: "", email: "a@b.co" }).success).toBe(
      true,
    );
  });
  it("requires consent", () => {
    expect(publicEnquirySchema.safeParse({ ...valid, consent: "" }).success).toBe(false);
  });
  it("rejects a filled honeypot", () => {
    expect(publicEnquirySchema.safeParse({ ...valid, website: "http://spam" }).success).toBe(false);
  });
  it("rejects unknown services and oversize messages", () => {
    expect(publicEnquirySchema.safeParse({ ...valid, serviceType: "Hacking" }).success).toBe(false);
    expect(publicEnquirySchema.safeParse({ ...valid, message: "x".repeat(1001) }).success).toBe(
      false,
    );
  });
});
