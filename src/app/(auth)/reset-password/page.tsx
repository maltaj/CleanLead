import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card } from "@/components/ui/card";
import { getUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // Reached through /auth/callback, which signs the user in with the recovery link.
  if (!(await getUser())) redirect("/login?error=link");

  return (
    <Card className="space-y-5">
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <ResetPasswordForm />
    </Card>
  );
}
