import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { SiteFooter } from "@/components/site/SiteFooter";
import { type Locale, LOCALE_META, isLocale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n";

export type LegalPageProps = {
  params: Promise<{ locale: string }>;
};

const CONTACT_EMAIL = process.env.CONTACT_EMAIL?.trim() || undefined;

export default async function LegalPage({ params }: LegalPageProps) {
  const { locale: candidate } = await params;
  const locale: Locale = isLocale(candidate) ? candidate : "en";
  const t = createTranslator(locale);
  const base = `/${locale}`;

  const terms: Array<string> = [t("legal.t1"), t("legal.t2"), t("legal.t3"), t("legal.t4")];
  const privacy: Array<string> = [t("legal.p1"), t("legal.p2"), t("legal.p3"), t("legal.p4")];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4 py-5">
        <Link href={base} className="flex items-center gap-2.5" aria-label={t("meta.siteName")}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-900/50 bg-emerald-950/50">
            <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight">{t("meta.siteName")}</span>
        </Link>
        <Link href={base} className="text-sm text-slate-400 transition-colors hover:text-emerald-300">
          {t("nav.app")}
        </Link>
      </header>

      <main className="flex-1 py-10">
        <h1 className="text-3xl font-bold tracking-tight">{t("legal.title")}</h1>
        <p className="mt-2 text-xs text-slate-500">
          {t("legal.updated", {
            date: new Date().toLocaleDateString(LOCALE_META[locale].tag),
          })}
        </p>

        <section className="mt-8" aria-labelledby="terms-title">
          <h2 id="terms-title" className="text-xl font-semibold text-emerald-300">
            {t("legal.termsTitle")}
          </h2>
          <ol className="mt-4 list-decimal space-y-3 ps-5 text-sm leading-relaxed text-slate-300">
            {terms.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

        <section className="mt-10" aria-labelledby="privacy-title">
          <h2 id="privacy-title" className="text-xl font-semibold text-emerald-300">
            {t("legal.privacyTitle")}
          </h2>
          <ul className="mt-4 list-disc space-y-3 ps-5 text-sm leading-relaxed text-slate-300">
            {privacy.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {CONTACT_EMAIL !== undefined ? (
          <p className="mt-4 text-sm font-medium text-slate-200">
            {t("legal.contact", { email: CONTACT_EMAIL })}
          </p>
        ) : null}

        <p className="mt-8 rounded-lg border border-amber-900/40 bg-amber-950/20 p-4 text-xs text-amber-200">
          {t("legal.note")}
        </p>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
