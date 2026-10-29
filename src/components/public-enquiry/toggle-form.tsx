"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState, type FormState } from "@/lib/forms";

export function ToggleForm({
  action,
  enabled,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  enabled: boolean;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="space-y-2">
      {state.message ? (
        <Alert tone={state.status === "success" ? "success" : "danger"}>{state.message}</Alert>
      ) : null}
      <SubmitButton variant={enabled ? "secondary" : "primary"} pendingText="Saving…">
        {enabled ? "Switch off the form" : "Switch on the form"}
      </SubmitButton>
    </form>
  );
}
