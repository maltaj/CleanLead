"use server";

import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { getEnv } from "@/lib/env";
import { fieldErrors, formString, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  logInSchema,
  resetPasswordSchema,
  signUpSchema,
} from "@/lib/validation/auth";

const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = { fullName: formString(formData, "fullName"), email: formString(formData, "email") };
  const parsed = signUpSchema.safeParse({ ...raw, password: formString(formData, "password") });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${getEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return {
        status: "error",
        fieldErrors: { password: "Choose a stronger password." },
        values: raw,
      };
    }
    console.error("signUp failed", { code: error.code, status: error.status });
    return { status: "error", message: GENERIC_ERROR, values: raw };
  }

  // Same response whether or not the address is already registered (no account enumeration).
  return {
    status: "success",
    message: "Check your email for a confirmation link to finish creating your account.",
  };
}

export async function logIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = { email: formString(formData, "email") };
  const parsed = logInSchema.safeParse({ ...raw, password: formString(formData, "password") });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        message: "Confirm your email address first. Check your inbox.",
        values: raw,
      };
    }
    return { status: "error", message: "Incorrect email or password.", values: raw };
  }

  redirect(safeRedirectPath(formString(formData, "next")));
}

export async function logOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = { email: formString(formData, "email") };
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });
  if (error)
    console.error("resetPasswordForEmail failed", { code: error.code, status: error.status });

  // Identical response either way so the form cannot be used to discover registered emails.
  return {
    status: "success",
    message: "If an account exists for that address, a reset link is on its way.",
  };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formString(formData, "password"),
    confirm: formString(formData, "confirm"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { status: "error", message: "This reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: "Choose a stronger password." } };
    }
    if (error.code === "same_password") {
      return {
        status: "error",
        fieldErrors: { password: "Choose a password you have not used before." },
      };
    }
    console.error("updateUser failed", { code: error.code, status: error.status });
    return { status: "error", message: GENERIC_ERROR };
  }

  redirect("/app");
}
