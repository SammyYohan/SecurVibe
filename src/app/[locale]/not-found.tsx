import Link from "next/link";
import { Compass } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

/**
 * 404. The proxy redirects every path without a locale to
 * /{locale}/…; this 404 serves unknown localized paths (e.g. /fr/unknown).
 */
export default function LocaleNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tint">
        <Compass className="h-7 w-7 text-accent" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-extrabold tracking-tight">404 — Page not found</h1>
      <Link href="/" className={buttonVariants()}>
        SecurVibe
      </Link>
    </main>
  );
}
