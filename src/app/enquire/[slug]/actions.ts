"use server";

import { headers } from "next/headers";
import { fieldErrors, formString, type FormState } from "@/lib/forms";
import { clientIp, hashIp } from "@/lib/public-enquiry/ip";
import { verifyTurnstile } from "@/lib/public-enquiry/turnstile";
import { publicEnquirySchema } from "@/lib/public-enquiry/validation";
import { createServiceClient } from "@/lib/supabase/service";

const SLUG = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
const FIELDS = ["name", "phone", "email", "suburb", "serviceType", "message"] as const;

export async function submitEnquiry(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw: Record<string, string> = {};
  for (const key of FIELDS) raw[key] = formString(formData, key);

  // Honeypot: pretend success so bots learn nothing, and store nothing.
  if (formString(formData, "website") !== "") return { status: "success" };

  if (!SLUG.test(slug))
    return { status: "error", message: "This form is not available.", values: raw };

  const parsed = publicEnquirySchema.safeParse({
    ...raw,
    consent: formString(formData, "consent"),
    website: "",
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const ip = clientIp(await headers());
  const human = await verifyTurnstile(formString(formData, "cf-turnstile-response"), ip);
  if (!human) {
    return {
      status: "error",
      message: "We couldn't verify you're human. Please refresh and try again.",
      values: raw,
    };
  }

  const d = parsed.data;
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("submit_public_enquiry", {
    p_slug: slug,
    p_name: d.name,
    p_phone: d.phone ?? "",
    p_email: d.email ?? "",
    p_suburb: d.suburb ?? "",
    p_service_type: d.serviceType,
    p_message: d.message ?? "",
    p_ip_hash: hashIp(ip),
    p_consent: true,
  });

  if (error) {
    console.error("submit_public_enquiry failed", { code: error.code });
    return { status: "error", message: "Something went wrong. Please try again.", values: raw };
  }
  if (data === "rate_limited") {
    return {
      status: "error",
      message: "Too many enquiries from your connection. Please try again later.",
      values: raw,
    };
  }
  if (data !== "ok")
    return { status: "error", message: "This form is not available.", values: raw };
  return { status: "success" };
}
