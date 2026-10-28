import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { listTeam, requireOrganisation } from "@/lib/auth/dal";
import { LEAD_STAGES, STAGE_LABELS } from "@/lib/leads/constants";
import { countLeadsByStage } from "@/lib/leads/queries";

export const metadata: Metadata = { title: "Dashboard" };

export default async function OrgDashboardPage({ params }: PageProps<"/app/[orgSlug]">) {
  const { orgSlug } = await params;
  const org = await requireOrganisation(orgSlug);
  const [team, counts] = await Promise.all([listTeam(org.id), countLeadsByStage(org.id)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
        <p className="text-muted text-sm">Your role: {org.role}</p>
      </div>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-muted text-sm font-medium">Pipeline</h2>
          <Link href={`/app/${org.slug}/leads`} className="text-brand text-sm hover:underline">
            View leads
          </Link>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {LEAD_STAGES.map((stage) => (
            <Link
              key={stage}
              href={`/app/${org.slug}/leads?stage=${stage}`}
              className="bg-brand-soft rounded-lg p-3 hover:opacity-90"
            >
              <dt className="text-muted text-xs">{STAGE_LABELS[stage]}</dt>
              <dd className="text-2xl font-semibold">{counts[stage]}</dd>
            </Link>
          ))}
        </dl>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="text-muted text-sm font-medium">Follow-ups due today</h2>
          <p className="mt-2 text-sm">Follow-up reminders arrive in the next milestone.</p>
        </Card>
        <Card>
          <h2 className="text-muted text-sm font-medium">Team</h2>
          <ul className="divide-border mt-2 divide-y">
            {team.map((member) => (
              <li
                key={member.user_id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="truncate">
                  {member.profiles?.full_name || member.profiles?.email || "Member"}
                </span>
                <span className="bg-brand-soft rounded-full px-2 py-0.5 text-xs">
                  {member.role}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
