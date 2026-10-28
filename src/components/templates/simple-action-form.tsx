"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState, type FormState } from "@/lib/forms";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/** A single button that runs a server action and shows its result (delete, add starter set, ...). */
export function SimpleActionForm({
  action,
  label,
  pendingText,
  variant = "secondary",
}: {
  action: Action;
  label: string;
  pendingText: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="space-y-2">
      {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}
      <SubmitButton variant={variant} pendingText={pendingText}>
        {label}
      </SubmitButton>
    </form>
  );
}
