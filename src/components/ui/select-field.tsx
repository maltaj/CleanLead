import { Label } from "@radix-ui/react-label";
import type { ComponentProps, ReactNode } from "react";
import { Select } from "./select";

export function SelectField({
  label,
  name,
  error,
  children,
  ...props
}: ComponentProps<"select"> & {
  label: string;
  name: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-sm font-medium">
        {label}
      </Label>
      <Select
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      >
        {children}
      </Select>
      {error ? (
        <p id={`${name}-error`} className="text-danger text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
