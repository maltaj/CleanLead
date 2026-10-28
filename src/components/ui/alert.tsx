import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Alert({
  tone = "danger",
  className,
  ...props
}: ComponentProps<"div"> & { tone?: "danger" | "success" }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        tone === "danger" ? "bg-danger-soft text-danger" : "bg-success-soft text-success",
        className,
      )}
      {...props}
    />
  );
}
