"use client";

import { useActionState } from "react";
import { resetPassword } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/forms";

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPassword, initialFormState);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message ? <Alert>{state.message}</Alert> : null}
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 10 characters with upper and lower case letters and a number."
        error={state.fieldErrors?.password}
      />
      <Field
        label="Confirm new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirm}
      />
      <SubmitButton block pendingText="Saving…">
        Update password
      </SubmitButton>
    </form>
  );
}
