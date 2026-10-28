import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { Card } from "@/components/ui/card";
import { getUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await getUser()) redirect("/app");

  return (
    <Card className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="text-muted text-sm">Start your free trial. No card needed.</p>
      </div>
      <SignupForm />
      <p className="text-muted text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-brand underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
