import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";

/**
 * Service-role client. It bypasses RLS, so it is used ONLY for the narrow public-enquiry
 * functions (EXECUTE is granted to service_role alone). Never use it for signed-in user data.
 */
export function createServiceClient() {
  return createClient(getEnv().NEXT_PUBLIC_SUPABASE_URL, getServerEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
