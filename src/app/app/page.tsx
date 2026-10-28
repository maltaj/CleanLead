import { redirect } from "next/navigation";
import { listMyOrganisations } from "@/lib/auth/dal";

export default async function AppIndexPage() {
  const orgs = await listMyOrganisations();
  redirect(orgs.length > 0 ? `/app/${orgs[0].slug}` : "/onboarding");
}
