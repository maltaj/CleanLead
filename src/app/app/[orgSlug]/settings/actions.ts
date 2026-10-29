"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export async function setPublicForm(
  orgSlug: string,
  enabled: boolean,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const org = await requireOrganisation(orgSlug);
  if (org.role === "member") {
    return { status: "error", message: "Only owners and admins can change this." };
  }
  const supabase = await createClient();
  // RLS (has_role admin) is the real gate; the role check above is for a clear message.
  const { data, error } = await supabase
    .from("organisations")
    .update({ public_form_enabled: enabled })
    .eq("id", org.id)
    .select("id");
  if (error || !data?.length) {
    console.error("setPublicForm failed", { code: error?.code });
    return { status: "error", message: "Could not update the setting. Please try again." };
  }
  revalidatePath(`/app/${org.slug}/settings`);
  return {
    status: "success",
    message: enabled ? "Your enquiry form is live." : "Your enquiry form is switched off.",
  };
}
