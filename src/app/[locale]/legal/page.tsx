import Link from "next/link";

import { Logo } from "@/components/site/Logo";
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
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between gap-4 py-5">
        <Logo href={base} label={t("meta.siteName")} />
        <Link href={base} className="text-sm font-medium text-mute transition-colors hover:text-ink">
          {t("nav.app")}
        </Link>
      </header>

      <main className="flex-1 py-12">
        <h1 className="text-4xl font-extrabold tracking-[-0.03em]">{t("legal.title")}</h1>
        <p className="mt-3 text-sm text-mute">
          {t("legal.updated", {
            date: new Date().toLocaleDateString(LOCALE_META[locale].tag),
          })}
        </p>

        <section className="mt-10" aria-labelledby="terms-title">
          <h2 id="terms-title" className="text-xl font-extrabold tracking-tight">
            {t("legal.termsTitle")}
          </h2>
          <ol className="mt-4 list-decimal space-y-3 ps-5 leading-relaxed text-mute marker:font-semibold marker:text-accent">
            {terms.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

        <section className="mt-10" aria-labelledby="privacy-title">
          <h2 id="privacy-title" className="text-xl font-extrabold tracking-tight">
            {t("legal.privacyTitle")}
          </h2>
          <ul className="mt-4 list-disc space-y-3 ps-5 leading-relaxed text-mute marker:font-semibold marker:text-accent">
            {privacy.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {CONTACT_EMAIL !== undefined ? (
          <p className="mt-6 font-semibold">
            {t("legal.contact", { email: CONTACT_EMAIL })}
          </p>
        ) : null}

        <p className="mt-10 rounded-2xl bg-warn-bg p-5 text-sm leading-relaxed text-warn">
          {t("legal.note")}
        </p>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
