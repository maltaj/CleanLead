"use client";

import { useActionState } from "react";
import { signUp } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/forms";

export function SignupForm() {
  const [state, action] = useActionState(signUp, initialFormState);

  if (state.status === "success") {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message ? <Alert>{state.message}</Alert> : null}
      <Field
        label="Your name"
        name="fullName"
        autoComplete="name"
        required
        defaultValue={state.values?.fullName}
        error={state.fieldErrors?.fullName}
      />
      <Field
        label="Work email"
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
        autoComplete="new-password"
        required
        hint="At least 10 characters with upper and lower case letters and a number."
        error={state.fieldErrors?.password}
      />
      <SubmitButton block pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
