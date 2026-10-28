import type { Metadata } from "next";
import Link from "next/link";
import { LeadForm } from "@/components/leads/lead-form";
import { Card } from "@/components/ui/card";
import { listTeam, requireOrganisation } from "@/lib/auth/dal";
import { createLead } from "../actions";

export const metadata: Metadata = { title: "Add lead" };

export default async function NewLeadPage({ params }: PageProps<"/app/[orgSlug]/leads/new">) {
  const { orgSlug } = await params;
  const org = await requireOrganisation(orgSlug);
  const team = await listTeam(org.id);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href={`/app/${org.slug}/leads`} className="text-brand text-sm hover:underline">
        ← Back to leads
      </Link>
      <Card className="space-y-5">
        <h1 className="text-xl font-semibold">Add a lead</h1>
        <LeadForm
          action={createLead.bind(null, org.slug)}
          submitLabel="Save lead"
          team={team.map((m) => ({
            id: m.user_id,
            label: m.profiles?.full_name || m.profiles?.email || "Member",
          }))}
        />
      </Card>
    </div>
  );
}
