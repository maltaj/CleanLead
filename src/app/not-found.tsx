import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted text-sm">It may have moved, or you may not have access to it.</p>
      <Button asChild>
        <Link href="/app">Go to dashboard</Link>
      </Button>
    </main>
  );
}
