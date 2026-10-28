"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_SERVICE_TYPES, LEAD_SOURCES, SOURCE_LABELS } from "@/lib/leads/constants";
import { initialFormState, type FormState } from "@/lib/forms";

export type LeadFormDefaults = {
  name?: string;
  phone?: string;
  email?: string;
  suburb?: string;
  serviceType?: string;
  estValue?: string;
  source?: string;
  assignedTo?: string;
  notes?: string;
};

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function LeadForm({
  action,
  defaults = {},
  team,
  submitLabel,
}: {
  action: Action;
  defaults?: LeadFormDefaults;
  team: { id: string; label: string }[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = { ...defaults, ...state.values };
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message ? (
        <Alert tone={state.status === "success" ? "success" : "danger"}>{state.message}</Alert>
      ) : null}

      <Field
        label="Customer name"
        name="name"
        required
        maxLength={120}
        autoComplete="off"
        defaultValue={v.name}
        error={errors.name}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          defaultValue={v.phone}
          error={errors.phone}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          defaultValue={v.email}
          error={errors.email}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Suburb"
          name="suburb"
          maxLength={80}
          defaultValue={v.suburb}
          error={errors.suburb}
        />
        <Field
          label="Estimated value (R)"
          name="estValue"
          inputMode="decimal"
          placeholder="e.g. 1500"
          defaultValue={v.estValue}
          error={errors.estValue}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Field
            label="Service"
            name="serviceType"
            list="service-types"
            maxLength={80}
            defaultValue={v.serviceType ?? DEFAULT_SERVICE_TYPES[0]}
            error={errors.serviceType}
          />
          <datalist id="service-types">
            {DEFAULT_SERVICE_TYPES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <SelectField
          label="Source"
          name="source"
          defaultValue={v.source ?? ""}
          error={errors.source}
          required
        >
          <option value="" disabled>
            Where did it come from?
          </option>
          {LEAD_SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </SelectField>
      </div>
      <SelectField
        label="Assigned to"
        name="assignedTo"
        defaultValue={v.assignedTo ?? ""}
        error={errors.assignedTo}
      >
        <option value="">Unassigned</option>
        {team.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </SelectField>
      <div className="space-y-1.5">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes
        </label>
        <Textarea
          id="notes"
          name="notes"
          maxLength={2000}
          defaultValue={v.notes}
          aria-invalid={errors.notes ? true : undefined}
        />
        {errors.notes ? <p className="text-danger text-xs">{errors.notes}</p> : null}
      </div>
      <SubmitButton block pendingText="Saving…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
