import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { listTeam, requireOrganisation } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Dashboard" };

export default async function OrgDashboardPage({ params }: PageProps<"/app/[orgSlug]">) {
  const { orgSlug } = await params;
  const org = await requireOrganisation(orgSlug);
  const team = await listTeam(org.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
        <p className="text-muted text-sm">Your role: {org.role}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="text-muted text-sm font-medium">Follow-ups due today</h2>
          <p className="mt-2 text-sm">
            Nothing yet. Leads and follow-ups arrive in the next milestone.
          </p>
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
