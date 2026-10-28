import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <Card className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Reset your password</h1>
        <p className="text-muted text-sm">We will email you a link to choose a new one.</p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm">
        <Link href="/login" className="text-brand underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
