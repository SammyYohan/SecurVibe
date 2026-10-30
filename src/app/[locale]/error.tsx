"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { isLocale } from "@/lib/i18n/config";

/**
 * Frontière d'erreur localisée. Le dictionnaire de la locale (déduit de
 * l'URL) est chargé dynamiquement pour ne pas alourdir le bundle principal.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [state, setState] = useState<{
    homeHref: string;
    title: string;
    body: string;
    retry: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const segments = window.location.pathname.split("/");
    const candidate = segments[1] ?? "en";
    const locale = isLocale(candidate) ? candidate : "en";
    void import("@/lib/i18n").then((moduleFile) => {
      if (cancelled) return;
      const texts = moduleFile.getDictionarySnapshot(locale);
      const merged = {
        homeHref: `/${candidate}`,
        title: texts["dashboard.errorTitle"] ?? "An error occurred",
        body:
          texts["dashboard.errorBody"] ??
          "GuardVibe could not display this page. You can retry: your data stays local, nothing was sent.",
        retry: texts["dashboard.errorRetry"] ?? "Retry",
      };
      setState(merged);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  console.error("[guardvibe] Render error.", error.name, error.digest ?? "");

  const merged =
    state ?? {
      homeHref: "/en",
      title: "An error occurred",
      body: "GuardVibe could not display this page. You can retry: your data stays local, nothing was sent.",
      retry: "Retry",
    };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-crit-bg">
        <AlertTriangle className="h-7 w-7 text-crit" aria-hidden="true" />
      </span>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{merged.title}</h1>
        <p className="mt-2 max-w-md leading-relaxed text-mute">{merged.body}</p>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={reset} className={buttonVariants()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {merged.retry}
        </button>
        <Link href={merged.homeHref} className={buttonVariants({ variant: "outline" })}>
          GuardVibe
        </Link>
      </div>
    </main>
  );
}
