"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState, type FormState } from "@/lib/forms";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function FollowUpActions({
  complete,
  skip,
  minDate,
  defaultNextDate,
}: {
  complete: Action;
  skip: Action;
  minDate: string;
  defaultNextDate: string;
}) {
  const [doneState, doneAction] = useActionState(complete, initialFormState);
  const [skipState, skipAction] = useActionState(skip, initialFormState);
  const errors = doneState.fieldErrors ?? {};

  return (
    <div className="space-y-2">
      {doneState.status === "success" || skipState.status === "success" ? (
        <Alert tone="success">{doneState.message ?? skipState.message}</Alert>
      ) : null}

      <details className="border-border rounded-lg border">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Complete</summary>
        <form action={doneAction} className="border-border space-y-3 border-t p-3" noValidate>
          {doneState.status === "error" && doneState.message ? (
            <Alert>{doneState.message}</Alert>
          ) : null}
          <div className="space-y-1.5">
            <label htmlFor="outcome" className="text-sm font-medium">
              What happened?
            </label>
            <Textarea
              id="outcome"
              name="outcome"
              maxLength={500}
              placeholder="e.g. Spoke to her, she needs to check with her husband"
              defaultValue={doneState.values?.outcome}
              aria-invalid={errors.outcome ? true : undefined}
              required
            />
            {errors.outcome ? <p className="text-danger text-xs">{errors.outcome}</p> : null}
          </div>
          <fieldset className="bg-brand-soft space-y-2 rounded-lg p-3">
            <legend className="px-1 text-sm font-medium">Next follow-up (optional)</legend>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Date"
                name="nextDate"
                type="date"
                min={minDate}
                defaultValue={doneState.values?.nextDate ?? defaultNextDate}
                error={errors.nextDate}
              />
              <Field
                label="Time"
                name="nextTime"
                type="time"
                defaultValue={doneState.values?.nextTime ?? "09:00"}
              />
            </div>
            <Field
              label="What to do"
              name="nextNote"
              maxLength={300}
              defaultValue={doneState.values?.nextNote}
            />
            <p className="text-muted text-xs">Clear the date if no further follow-up is needed.</p>
          </fieldset>
          <SubmitButton block pendingText="Saving…">
            Complete follow-up
          </SubmitButton>
        </form>
      </details>

      <details className="border-border rounded-lg border">
        <summary className="text-muted cursor-pointer px-3 py-2 text-sm">Skip</summary>
        <form action={skipAction} className="border-border space-y-3 border-t p-3" noValidate>
          {skipState.status === "error" && skipState.message ? (
            <Alert>{skipState.message}</Alert>
          ) : null}
          <Input
            name="reason"
            maxLength={300}
            placeholder="Reason (optional)"
            aria-label="Reason for skipping"
          />
          <Button type="submit" variant="secondary" block>
            Skip this follow-up
          </Button>
        </form>
      </details>
    </div>
  );
}
