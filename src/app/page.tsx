import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth/dal";

export default async function HomePage() {
  const user = await getUser();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-balance">
        Never lose a cleaning enquiry again
      </h1>
      <p className="text-muted text-lg text-balance">
        CleanLead helps cleaning businesses capture every enquiry, follow up on outstanding quotes,
        and see which enquiries turn into bookings.
      </p>
      <div className="flex justify-center gap-3">
        {user ? (
          <Button asChild>
            <Link href="/app">Open dashboard</Link>
          </Button>
        ) : (
          <>
            <Button asChild>
              <Link href="/signup">Start free trial</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/login">Sign in</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
