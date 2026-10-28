import type { Metadata } from "next";
import Link from "next/link";
import { FollowUpItem } from "@/components/follow-ups/follow-up-item";
import { Card } from "@/components/ui/card";
import { getUser, listTeam, requireOrganisation } from "@/lib/auth/dal";
import { listOpenFollowUps, listRecentlyClosedFollowUps } from "@/lib/follow-ups/queries";
import { formatDate } from "@/lib/format";
import type { FollowUpWithLead } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Follow-ups" };

function Section({
  title,
  items,
  orgSlug,
  now,
  nameOf,
  empty,
}: {
  title: string;
  items: FollowUpWithLead[];
  orgSlug: string;
  now: Date;
  nameOf: (id: string | null) => string;
  empty: string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">
        {title} <span className="text-muted text-sm font-normal">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="text-muted text-sm">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((f) => (
            <FollowUpItem
              key={f.id}
              followUp={f}
              orgSlug={orgSlug}
              now={now}
              nameOf={nameOf}
              showLead
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function FollowUpsPage({
  params,
  searchParams,
}: PageProps<"/app/[orgSlug]/follow-ups">) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  const org = await requireOrganisation(orgSlug);
  const user = await getUser();

  const mine = sp.scope === "mine" && user;
  const [open, closed, team] = await Promise.all([
    listOpenFollowUps(org.id, { assignedTo: mine && user ? user.id : undefined }),
    listRecentlyClosedFollowUps(org.id),
    listTeam(org.id),
  ]);
  const names = new Map(
    team.map((m) => [m.user_id, m.profiles?.full_name || m.profiles?.email || "A team member"]),
  );
  const nameOf = (id: string | null) =>
    id ? (names.get(id) ?? "A former team member") : "Unassigned";
  const now = new Date();
  const base = `/app/${org.slug}/follow-ups`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Follow-ups</h1>
        <div
          className="border-border bg-card flex gap-1 rounded-lg border p-1 text-sm"
          role="group"
          aria-label="Show"
        >
          {[
            { href: base, label: "Everyone", active: !mine },
            { href: `${base}?scope=mine`, label: "Mine", active: Boolean(mine) },
          ].map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5",
                tab.active ? "bg-brand text-brand-foreground" : "hover:bg-brand-soft",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      <Section
        title="Overdue"
        items={open.overdue}
        orgSlug={org.slug}
        now={now}
        nameOf={nameOf}
        empty="Nothing overdue. Nice."
      />
      <Section
        title="Due today"
        items={open.today}
        orgSlug={org.slug}
        now={now}
        nameOf={nameOf}
        empty="Nothing else due today."
      />
      <Section
        title="Upcoming"
        items={open.upcoming}
        orgSlug={org.slug}
        now={now}
        nameOf={nameOf}
        empty="Nothing scheduled ahead."
      />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Recently closed</h2>
        {closed.length === 0 ? (
          <p className="text-muted text-sm">Completed and skipped follow-ups appear here.</p>
        ) : (
          <Card className="p-0">
            <ul className="divide-border divide-y">
              {closed.map((f) => (
                <li key={f.id} className="space-y-0.5 px-4 py-3 text-sm">
                  <p>
                    <Link
                      href={`/app/${org.slug}/leads/${f.lead_id}`}
                      className="font-medium hover:underline"
                    >
                      {f.leads?.name ?? "Lead"}
                    </Link>
                    <span className="text-muted">
                      {" "}
                      · {f.status === "done" ? "Completed" : "Skipped"}
                      {f.completed_at ? ` ${formatDate(f.completed_at)}` : ""}
                    </span>
                  </p>
                  {f.outcome ? <p className="text-muted text-xs">{f.outcome}</p> : null}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
