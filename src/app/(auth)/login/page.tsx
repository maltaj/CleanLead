import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { getUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeRedirectPath(params.next, "") : "";
  if (await getUser()) redirect(next || "/app");

  return (
    <Card className="space-y-5">
      <h1 className="text-xl font-semibold">Sign in</h1>
      {params.error === "link" ? (
        <Alert>That link is invalid or has expired. Please try again.</Alert>
      ) : null}
      <LoginForm next={next || undefined} />
      <p className="text-muted text-center text-sm">
        New to CleanLead?{" "}
        <Link href="/signup" className="text-brand underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </Card>
  );
}
