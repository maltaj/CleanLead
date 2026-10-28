import { describe, expect, it } from "vitest";
import {
  createOrganisationSchema,
  logInSchema,
  passwordSchema,
  resetPasswordSchema,
  signUpSchema,
} from "./auth";

describe("passwordSchema", () => {
  it.each(["short1A", "alllowercase123", "ALLUPPERCASE123", "NoDigitsHereAtAll"])(
    "rejects %s",
    (p) => {
      expect(passwordSchema.safeParse(p).success).toBe(false);
    },
  );

  it("accepts a strong password", () => {
    expect(passwordSchema.safeParse("Sparkling-Clean-42").success).toBe(true);
  });
});

describe("signUpSchema", () => {
  it("normalises email", () => {
    const parsed = signUpSchema.parse({
      fullName: " Thandi ",
      email: "  Thandi@Example.COM ",
      password: "Sparkling-Clean-42",
    });
    expect(parsed.email).toBe("thandi@example.com");
    expect(parsed.fullName).toBe("Thandi");
  });
});

describe("logInSchema", () => {
  it("does not apply password strength rules to existing accounts", () => {
    expect(logInSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  it("requires matching passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "Sparkling-Clean-42",
      confirm: "nope",
    });
    expect(result.success).toBe(false);
  });
});

describe("createOrganisationSchema", () => {
  it("bounds the name", () => {
    expect(createOrganisationSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(createOrganisationSchema.safeParse({ name: "x".repeat(101) }).success).toBe(false);
    expect(createOrganisationSchema.safeParse({ name: "Sparkle Cleaners" }).success).toBe(true);
  });
});
