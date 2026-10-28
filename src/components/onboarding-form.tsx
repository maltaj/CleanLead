"use client";

import { useActionState } from "react";
import { createOrganisation } from "@/app/onboarding/actions";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/forms";

export function OnboardingForm() {
  const [state, action] = useActionState(createOrganisation, initialFormState);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message ? <Alert>{state.message}</Alert> : null}
      <Field
        label="Business name"
        name="name"
        autoComplete="organization"
        required
        maxLength={100}
        placeholder="e.g. Sparkle Home Cleaning"
        defaultValue={state.values?.name}
        error={state.fieldErrors?.name}
      />
      <SubmitButton block pendingText="Creating…">
        Create my workspace
      </SubmitButton>
    </form>
  );
}
