import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        critical: "bg-crit-bg text-crit",
        warning: "bg-warn-bg text-warn",
        success: "bg-tint text-accent",
        neutral: "bg-paper-2 text-mute",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export type BadgeVariant = NonNullable<
  VariantProps<typeof badgeVariants>["variant"]
>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
