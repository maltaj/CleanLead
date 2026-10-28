import type { Metadata } from "next";
import Link from "next/link";
import { StageBadge } from "@/components/leads/stage-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requireOrganisation } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format";
import {
  LEAD_STAGES,
  PAGE_SIZE,
  SOURCE_LABELS,
  STAGE_LABELS,
  isLeadStage,
} from "@/lib/leads/constants";
import { formatZar } from "@/lib/leads/money";
import { listLeads } from "@/lib/leads/queries";

export const metadata: Metadata = { title: "Leads" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LeadsPage({
  params,
  searchParams,
}: PageProps<"/app/[orgSlug]/leads">) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  const org = await requireOrganisation(orgSlug);

  const q = first(sp.q)?.slice(0, 100) ?? "";
  const stageParam = first(sp.stage);
  const stage = isLeadStage(stageParam) ? stageParam : undefined;
  const pageNumber = Number.parseInt(first(sp.page) ?? "1", 10);

  const { leads, total, page } = await listLeads(org.id, {
    q,
    stage,
    page: Number.isFinite(pageNumber) ? pageNumber : 1,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = `/app/${org.slug}/leads`;

  const pageHref = (target: number) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (stage) qs.set("stage", stage);
    if (target > 1) qs.set("page", String(target));
    const s = qs.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <Button asChild>
          <Link href={`${base}/new`}>Add lead</Link>
        </Button>
      </div>

      <form method="get" className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]" role="search">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search name, phone, email or suburb"
          aria-label="Search leads"
        />
        <Select name="stage" defaultValue={stage ?? ""} aria-label="Filter by stage">
          <option value="">All stages</option>
          {LEAD_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {leads.length === 0 ? (
        <Card className="text-center">
          <p className="font-medium">
            {q || stage ? "No leads match your search." : "No leads yet."}
          </p>
          <p className="text-muted mt-1 text-sm">
            {q || stage
              ? "Try a different search or clear the filter."
              : "Add your first enquiry so nothing slips through."}
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {leads.map((lead) => (
            <li key={lead.id}>
              <Link
                href={`${base}/${lead.id}`}
                className="border-border bg-card hover:bg-brand-soft block rounded-xl border p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{lead.name}</p>
                    <p className="text-muted truncate text-sm">
                      {[lead.suburb, lead.service_type].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <StageBadge stage={lead.stage} />
                </div>
                <div className="text-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span>{formatZar(lead.est_value_cents)}</span>
                  <span>{SOURCE_LABELS[lead.source]}</span>
                  <span>Added {formatDate(lead.created_at)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="text-brand hover:underline">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {page} of {pages} · {total} leads
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="text-brand hover:underline">
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
