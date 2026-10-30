import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n";

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = createTranslator(locale);
  const base = `/${locale}`;

  return (
    <footer className="mt-auto border-t border-slate-800/60 py-8 text-sm text-slate-500">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-900/50 bg-emerald-950/50">
            <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          </span>
          <div>
            <p className="font-medium text-slate-300">
              {t("meta.siteName")} — {t("footer.tagline")}
            </p>
            <p className="mt-1 text-xs">{t("footer.demo")}</p>
          </div>
        </div>
        <nav aria-label={t("footer.linksLegal")} className="flex flex-wrap gap-4">
          <Link className="transition-colors hover:text-emerald-300" href={`${base}/pricing`}>
            {t("footer.linksPricing")}
          </Link>
          <Link className="transition-colors hover:text-emerald-300" href={`${base}/app`}>
            {t("footer.linksApp")}
          </Link>
          <Link className="transition-colors hover:text-emerald-300" href={`${base}/legal`}>
            {t("footer.linksLegal")}
          </Link>
        </nav>
      </div>
      <p className="mt-4 text-xs">{t("footer.rights", { year: String(new Date().getFullYear()) })}</p>
    </footer>
  );
}
