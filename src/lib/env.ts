import { z } from "zod";

const schema = z
  .object({
    APP_ENV: z.enum(["local", "staging", "production"]),
    NEXT_PUBLIC_SITE_URL: z.url().refine((v) => !v.endsWith("/"), "must not end with a slash"),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  })
  .superRefine((env, ctx) => {
    const isLocalHost = (value: string) =>
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(value);
    if (env.APP_ENV !== "local") {
      for (const key of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SUPABASE_URL"] as const) {
        if (isLocalHost(env[key])) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${key} must not be localhost in ${env.APP_ENV}`,
          });
        }
        if (!env[key].startsWith("https://")) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${key} must use https in ${env.APP_ENV}`,
          });
        }
      }
    }
  });

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Validated environment. NEXT_PUBLIC_* must be referenced literally so Next can inline them. */
export function getEnv(): Env {
  cached ??= parseEnv({
    APP_ENV: process.env.APP_ENV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return cached;
}
