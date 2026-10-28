import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const base = {
  APP_ENV: "local",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_0123456789abcdef",
};

describe("parseEnv", () => {
  it("accepts a local configuration", () => {
    expect(parseEnv(base).APP_ENV).toBe("local");
  });

  it("rejects missing values", () => {
    expect(() => parseEnv({ ...base, NEXT_PUBLIC_SUPABASE_URL: undefined })).toThrow(
      /SUPABASE_URL/,
    );
  });

  it("rejects localhost URLs outside local", () => {
    expect(() => parseEnv({ ...base, APP_ENV: "production" })).toThrow(/must not be localhost/);
  });

  it("rejects non-https URLs in staging", () => {
    expect(() =>
      parseEnv({
        ...base,
        APP_ENV: "staging",
        NEXT_PUBLIC_SITE_URL: "http://staging.example.com",
        NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      }),
    ).toThrow(/must use https/);
  });

  it("accepts a valid production configuration", () => {
    const env = parseEnv({
      ...base,
      APP_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://app.example.com",
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
    });
    expect(env.APP_ENV).toBe("production");
  });

  it("rejects a trailing slash on the site URL", () => {
    expect(() => parseEnv({ ...base, NEXT_PUBLIC_SITE_URL: "http://localhost:3000/" })).toThrow(
      /slash/,
    );
  });
});
