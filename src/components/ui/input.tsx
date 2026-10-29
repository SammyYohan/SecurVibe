import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "h-10 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm text-slate-100 transition-colors placeholder:text-slate-500 focus-visible:border-emerald-500/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 disabled:cursor-not-allowed disabled:opacity-60",
        // État invalide (aria-invalid) : contour visuel rouge, en plus de
        // l'information texte portée par aria-describedby côté formulaire.
        "aria-[invalid=true]:border-red-800 aria-[invalid=true]:focus-visible:ring-red-500/70",
        className,
      )}
      {...props}
    />
  );
}
