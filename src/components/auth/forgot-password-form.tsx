"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/forms";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initialFormState);

  if (state.status === "success") {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message ? <Alert>{state.message}</Alert> : null}
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
      <SubmitButton block pendingText="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
