import Link from "next/link";
import { Compass } from "lucide-react";

/**
 * 404. Le middleware redirige tous les chemins sans locale vers
 * /{locale}/… ; ce 404 sert les chemins locaux inconnus (ex. /fr/inconnu).
 */
export default function LocaleNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60">
        <Compass className="h-7 w-7 text-emerald-400" aria-hidden="true" />
      </span>
      <h1 className="text-xl font-semibold">404 — Page not found</h1>
      <Link
        href="/"
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
      >
        GuardVibe
      </Link>
    </main>
  );
}
