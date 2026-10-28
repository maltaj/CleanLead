"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { LEAD_STAGES, STAGE_LABELS, type LeadStage } from "@/lib/leads/constants";
import { initialFormState, type FormState } from "@/lib/forms";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function StageForm({ action, current }: { action: Action; current: LeadStage }) {
  const [state, formAction] = useActionState(action, initialFormState);
  const isClosed = current === "won" || current === "lost";

  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.message ? (
        <Alert tone={state.status === "success" ? "success" : "danger"}>{state.message}</Alert>
      ) : null}
      <div className="space-y-1.5">
        <label htmlFor="stage" className="text-sm font-medium">
          {isClosed ? "Reopen or change outcome" : "Move to stage"}
        </label>
        <Select id="stage" name="stage" defaultValue={current}>
          {LEAD_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </Select>
        {state.fieldErrors?.stage ? (
          <p className="text-danger text-xs">{state.fieldErrors.stage}</p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="lostReason" className="text-sm font-medium">
          Reason if lost <span className="text-muted font-normal">(optional)</span>
        </label>
        <Input
          id="lostReason"
          name="lostReason"
          maxLength={300}
          placeholder="e.g. Went with another company"
        />
        {state.fieldErrors?.lostReason ? (
          <p className="text-danger text-xs">{state.fieldErrors.lostReason}</p>
        ) : null}
      </div>
      <SubmitButton block pendingText="Updating…">
        Update stage
      </SubmitButton>
    </form>
  );
}
