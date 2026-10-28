"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState, type FormState } from "@/lib/forms";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function TemplateForm({
  action,
  defaults,
  submitLabel,
  idPrefix,
}: {
  action: Action;
  defaults?: { name: string; body: string };
  submitLabel: string;
  idPrefix: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const errors = state.fieldErrors ?? {};
  const bodyId = `${idPrefix}-body`;

  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.message ? (
        <Alert tone={state.status === "success" ? "success" : "danger"}>{state.message}</Alert>
      ) : null}
      <Field
        label="Template name"
        name="name"
        maxLength={80}
        defaultValue={state.values?.name ?? defaults?.name}
        error={errors.name}
        required
      />
      <div className="space-y-1.5">
        <label htmlFor={bodyId} className="text-sm font-medium">
          Message
        </label>
        <Textarea
          id={bodyId}
          name="body"
          maxLength={2000}
          className="min-h-32"
          defaultValue={state.values?.body ?? defaults?.body}
          aria-invalid={errors.body ? true : undefined}
          required
        />
        {errors.body ? <p className="text-danger text-xs">{errors.body}</p> : null}
      </div>
      <SubmitButton block pendingText="Saving…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
