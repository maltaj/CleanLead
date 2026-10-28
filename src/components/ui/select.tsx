import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "border-border bg-card text-foreground h-11 w-full rounded-lg border px-3 text-base sm:text-sm",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}
