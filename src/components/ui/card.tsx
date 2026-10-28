import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("border-border bg-card rounded-2xl border p-6 shadow-sm", className)}
      {...props}
    />
  );
}
