"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState, type FormState } from "@/lib/forms";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function AddFollowUpForm({
  action,
  team,
  minDate,
  defaultDate,
}: {
  action: Action;
  team: { id: string; label: string }[];
  minDate: string;
  defaultDate: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3" noValidate>
      {state.message ? (
        <Alert tone={state.status === "success" ? "success" : "danger"}>{state.message}</Alert>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Due date"
          name="dueDate"
          type="date"
          min={minDate}
          defaultValue={state.values?.dueDate ?? defaultDate}
          error={errors.dueDate}
          required
        />
        <Field
          label="Time"
          name="dueTime"
          type="time"
          defaultValue={state.values?.dueTime ?? "09:00"}
          error={errors.dueTime}
        />
      </div>
      <Field
        label="What to do"
        name="note"
        maxLength={300}
        placeholder="e.g. Ask if they're happy with the quote"
        defaultValue={state.values?.note}
        error={errors.note}
      />
      <SelectField
        label="Assigned to"
        name="assignedTo"
        defaultValue={state.values?.assignedTo ?? ""}
        error={errors.assignedTo}
      >
        <option value="">Unassigned</option>
        {team.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </SelectField>
      <SubmitButton block pendingText="Scheduling…">
        Schedule follow-up
      </SubmitButton>
    </form>
  );
}
