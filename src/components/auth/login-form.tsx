"use client";

import Link from "next/link";
import { useActionState } from "react";
import { logIn } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/forms";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(logIn, initialFormState);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message ? <Alert>{state.message}</Alert> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <SubmitButton block pendingText="Signing in…">
        Sign in
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-brand underline-offset-4 hover:underline">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
