import { Label } from "@radix-ui/react-label";
import type { ComponentProps } from "react";
import { Input } from "./input";

export function Field({
  label,
  name,
  error,
  hint,
  ...props
}: ComponentProps<"input"> & { label: string; name: string; error?: string; hint?: string }) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined
        }
        {...props}
      />
      {hint && !error ? (
        <p id={hintId} className="text-muted text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-danger text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
