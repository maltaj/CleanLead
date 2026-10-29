import "server-only";
import { z } from "zod";
import { getEnv } from "@/lib/env";

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  ENQUIRY_IP_HASH_SECRET: z.string().min(32, "must be at least 32 characters"),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

/** Secrets that must never reach the browser. Import only from server code. */
export function getServerEnv(): ServerEnv {
  if (!cached) {
    const result = schema.safeParse({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      ENQUIRY_IP_HASH_SECRET: process.env.ENQUIRY_IP_HASH_SECRET,
      TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || undefined,
    });
    if (!result.success) {
      const details = result.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new Error(`Invalid server environment configuration:\n${details}`);
    }
    if (getEnv().APP_ENV === "production" && !result.data.TURNSTILE_SECRET_KEY) {
      throw new Error("TURNSTILE_SECRET_KEY is required in production");
    }
    cached = result.data;
  }
  return cached;
}
