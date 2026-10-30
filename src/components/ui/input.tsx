import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "h-12 w-full rounded-xl border border-line-strong bg-white px-3.5 text-sm text-ink transition-colors placeholder:text-faint focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-60",
        // État invalide (aria-invalid) : contour visuel brique, en plus de
        // l'information texte portée par aria-describedby côté formulaire.
        "aria-[invalid=true]:border-crit aria-[invalid=true]:focus-visible:outline-crit",
        className,
      )}
      {...props}
    />
  );
}
