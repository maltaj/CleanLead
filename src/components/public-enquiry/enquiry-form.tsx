"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { Turnstile } from "@/components/public-enquiry/turnstile";
import { initialFormState, type FormState } from "@/lib/forms";
import { DEFAULT_SERVICE_TYPES } from "@/lib/leads/constants";

export function EnquiryForm({
  action,
  businessName,
  turnstileSiteKey,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  businessName: string;
  turnstileSiteKey?: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};

  if (state.status === "success") {
    return (
      <Alert tone="success">
        Thank you! {businessName} has received your enquiry and will be in touch soon.
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message ? <Alert>{state.message}</Alert> : null}
      <Field
        label="Your name"
        name="name"
        autoComplete="name"
        required
        defaultValue={v.name}
        error={e.name}
      />
      <Field
        label="Phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        defaultValue={v.phone}
        error={e.phone}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={v.email}
        error={e.email}
        hint="Phone or email — at least one."
      />
      <Field label="Suburb" name="suburb" defaultValue={v.suburb} error={e.suburb} />
      <SelectField
        label="Service"
        name="serviceType"
        defaultValue={v.serviceType || DEFAULT_SERVICE_TYPES[0]}
        error={e.serviceType}
      >
        {DEFAULT_SERVICE_TYPES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </SelectField>
      <div className="space-y-1.5">
        <label htmlFor="message" className="text-sm font-medium">
          Anything we should know?
        </label>
        <Textarea id="message" name="message" maxLength={1000} defaultValue={v.message} />
        {e.message ? <p className="text-danger text-xs">{e.message}</p> : null}
      </div>
      {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" className="mt-1" />
        <span>
          I agree that {businessName} may use these details to contact me about my enquiry. They are
          stored securely and used for nothing else.
        </span>
      </label>
      {e.consent ? <p className="text-danger text-xs">{e.consent}</p> : null}
      {turnstileSiteKey ? <Turnstile siteKey={turnstileSiteKey} /> : null}
      <SubmitButton pendingText="Sending…" className="w-full">
        Send enquiry
      </SubmitButton>
    </form>
  );
}
