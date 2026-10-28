import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "border-border bg-card text-foreground placeholder:text-muted h-11 w-full rounded-lg border px-3 text-base sm:text-sm",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}
