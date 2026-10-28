import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address.").max(254));

// Must match supabase/config.toml: minimum length 10 with lower, upper and digit.
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Use 72 characters or fewer.")
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/[0-9]/, "Include a number.");

export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(120),
  email: emailSchema,
  password: passwordSchema,
});

export const logInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(72),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });

export const createOrganisationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters.")
    .max(100, "Use 100 characters or fewer."),
});
