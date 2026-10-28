import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-foreground hover:opacity-90",
        secondary: "border border-border bg-card text-foreground hover:bg-brand-soft",
        ghost: "text-foreground hover:bg-brand-soft",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", block: false },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, block, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, block }), className)} {...props} />;
}
