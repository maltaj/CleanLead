"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { fieldErrors, formString, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { createOrganisationSchema } from "@/lib/validation/auth";

export async function createOrganisation(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();

  const raw = { name: formString(formData, "name") };
  const parsed = createOrganisationSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { data: orgId, error } = await supabase.rpc("create_organisation", {
    p_name: parsed.data.name,
  });

  if (error || typeof orgId !== "string") {
    if (error?.code === "54000") {
      return {
        status: "error",
        message: "You have reached the limit for organisations.",
        values: raw,
      };
    }
    console.error("create_organisation failed", { code: error?.code });
    return {
      status: "error",
      message: "We couldn't create your business. Please try again.",
      values: raw,
    };
  }

  const { data: org } = await supabase
    .from("organisations")
    .select("slug")
    .eq("id", orgId)
    .single();
  redirect(org ? `/app/${org.slug}` : "/app");
}
