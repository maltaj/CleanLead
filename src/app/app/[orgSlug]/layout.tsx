import Link from "next/link";
import { logOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { listMyOrganisations, requireOrganisation } from "@/lib/auth/dal";

export default async function OrgLayout({ children, params }: LayoutProps<"/app/[orgSlug]">) {
  const { orgSlug } = await params;
  const [org, orgs] = await Promise.all([requireOrganisation(orgSlug), listMyOrganisations()]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-border bg-card border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/app" className="text-brand font-semibold tracking-tight">
              CleanLead
            </Link>
            <span className="text-muted truncate text-sm">{org.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {orgs.length > 1 ? (
              <nav aria-label="Switch business" className="hidden gap-1 sm:flex">
                {orgs
                  .filter((o) => o.id !== org.id)
                  .map((o) => (
                    <Button key={o.id} asChild variant="ghost" className="h-9">
                      <Link href={`/app/${o.slug}`}>{o.name}</Link>
                    </Button>
                  ))}
              </nav>
            ) : null}
            <form action={logOut}>
              <Button type="submit" variant="secondary" className="h-9">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <nav aria-label="Main" className="border-border bg-card border-b">
        <div className="mx-auto flex w-full max-w-5xl gap-1 px-4">
          {[
            { href: `/app/${org.slug}`, label: "Dashboard" },
            { href: `/app/${org.slug}/leads`, label: "Leads" },
            { href: `/app/${org.slug}/settings`, label: "Settings" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted hover:text-foreground px-3 py-3 text-sm font-medium"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
