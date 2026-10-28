import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { Card } from "@/components/ui/card";
import { listMyOrganisations } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const orgs = await listMyOrganisations();
  if (orgs.length > 0) redirect(`/app/${orgs[0].slug}`);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <Card className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Set up your business</h1>
          <p className="text-muted text-sm">
            This creates your workspace. You can invite your team after this step.
          </p>
        </div>
        <OnboardingForm />
      </Card>
    </main>
  );
}
