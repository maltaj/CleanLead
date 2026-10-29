import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EnquiryForm } from "@/components/public-enquiry/enquiry-form";
import { Card } from "@/components/ui/card";
import { createServiceClient } from "@/lib/supabase/service";
import { submitEnquiry } from "./actions";

export const metadata: Metadata = { title: "Request a quote", robots: { index: false } };
export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

export default async function PublicEnquiryPage({ params }: PageProps<"/enquire/[slug]">) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();

  const { data, error } = await createServiceClient().rpc("public_form_info", { p_slug: slug });
  if (error) throw new Error(`Could not load form (${error.code})`);
  const businessName = data?.[0]?.org_name;
  if (!businessName) notFound();

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8">
      <Card className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold">{businessName}</h1>
          <p className="text-muted text-sm">
            Tell us what you need and we&apos;ll get back to you.
          </p>
        </div>
        <EnquiryForm
          action={submitEnquiry.bind(null, slug)}
          businessName={businessName}
          turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined}
        />
      </Card>
    </main>
  );
}
