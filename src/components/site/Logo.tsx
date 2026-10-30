import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function Logo({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 text-ink" aria-label={label}>
      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent">
        <ShieldCheck className="h-5 w-5 text-white" aria-hidden="true" />
      </span>
      <span className="text-lg font-extrabold tracking-tight">{label}</span>
    </Link>
  );
}
