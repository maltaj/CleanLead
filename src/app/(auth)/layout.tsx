import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <Link href="/" className="text-brand mb-8 text-center text-2xl font-semibold tracking-tight">
        CleanLead
      </Link>
      {children}
    </main>
  );
}
