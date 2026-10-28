import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "border-border bg-card text-foreground placeholder:text-muted min-h-24 w-full rounded-lg border px-3 py-2 text-base sm:text-sm",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}
