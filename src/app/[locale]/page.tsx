import Link from "next/link";
import {
  BadgeCheck,
  CircleDot,
  FlaskConical,
  Gauge,
  Globe2,
  KeyRound,
  Package,
  Rocket,
  ScanSearch,
  Server,
  ShieldCheck,
  Timer,
} from "lucide-react";

import { LocaleSwitcher } from "@/components/site/LocaleSwitcher";
import { SiteFooter } from "@/components/site/SiteFooter";
import { type Locale, isLocale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n";

export type LandingPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LandingPage({ params }: LandingPageProps) {
  const { locale: candidate } = await params;
  const locale: Locale = isLocale(candidate) ? candidate : "en";
  const t = createTranslator(locale);
  const base = `/${locale}`;

  const features: Array<{ title: string; text: string; tone: "alert" | "live" | "scan" }> = [
    { title: t("features.f1"), text: t("features.f1d"), tone: "alert" },
    { title: t("features.f2"), text: t("features.f2d"), tone: "scan" },
    { title: t("features.f3"), text: t("features.f3d"), tone: "alert" },
    { title: t("features.f4"), text: t("features.f4d"), tone: "live" },
    { title: t("features.f5"), text: t("features.f5d"), tone: "live" },
    { title: t("features.f6"), text: t("features.f6d"), tone: "scan" },
    { title: t("features.f7"), text: t("features.f7d"), tone: "scan" },
    { title: t("features.f8"), text: t("features.f8d"), tone: "live" },
  ];

  const compareRows: Array<{ label: string; guard: string; others: string }> = [
    { label: t("compare.r1"), guard: t("compare.v1g"), others: t("compare.v1o") },
    { label: t("compare.r2"), guard: t("compare.v2g"), others: t("compare.v2o") },
    { label: t("compare.r3"), guard: t("compare.v3g"), others: t("compare.v3o") },
    { label: t("compare.r4"), guard: t("compare.v4g"), others: t("compare.v4o") },
    { label: t("compare.r5"), guard: t("compare.v5g"), others: t("compare.v5o") },
    { label: t("compare.r6"), guard: t("compare.v6g"), others: t("compare.v6o") },
    { label: t("compare.r7"), guard: t("compare.v7g"), others: t("compare.v7o") },
  ];

  const faqItems: Array<{ question: string; answer: string }> = [
    { question: t("faq.q1"), answer: t("faq.a1") },
    { question: t("faq.q2"), answer: t("faq.a2") },
    { question: t("faq.q3"), answer: t("faq.a3") },
    { question: t("faq.q4"), answer: t("faq.a4") },
    { question: t("faq.q5"), answer: t("faq.a5") },
  ];

  const howItems: Array<{ title: string; text: string }> = [
    { title: t("how.s1title"), text: t("how.s1text") },
    { title: t("how.s2title"), text: t("how.s2text") },
    { title: t("how.s3title"), text: t("how.s3text") },
  ];

  const benefitItems: Array<{ title: string; text: string }> = [
    { title: t("benefits.b1title"), text: t("benefits.b1text") },
    { title: t("benefits.b2title"), text: t("benefits.b2text") },
    { title: t("benefits.b3title"), text: t("benefits.b3text") },
  ];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4 py-5">
        <Link href={base} className="flex items-center gap-2.5" aria-label={t("meta.siteName")}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-900/50 bg-emerald-950/50">
            <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight">{t("meta.siteName")}</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex" aria-label={t("nav.app")}>
          <a className="transition-colors hover:text-emerald-300" href="#features">{t("nav.features")}</a>
          <Link className="transition-colors hover:text-emerald-300" href={`${base}/pricing`}>{t("nav.pricing")}</Link>
          <a className="transition-colors hover:text-emerald-300" href="#faq">{t("nav.faq")}</a>
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher locale={locale} />
          <Link
            href={`${base}/app`}
            className="inline-flex h-9 items-center rounded-lg bg-emerald-500 px-4 text-sm font-medium text-slate-950 transition-colors hover:bg-emerald-400"
          >
            {t("nav.start")}
          </Link>
        </div>
      </header>

      {/* ------------------------------- HERO ------------------------------- */}
      <section className="grid grid-cols-1 items-center gap-10 py-12 md:grid-cols-2 md:py-16">
        <div className="flex flex-col gap-5">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-900/60 bg-emerald-950/50 px-3 py-1 text-xs font-medium text-emerald-300">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
            {t("hero.badge")}
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            {t("hero.title1")}{" "}
            <span className="text-emerald-300">{t("hero.title2")}</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-slate-300">{t("hero.subtitle")}</p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href={`${base}/app`}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Rocket className="h-4 w-4" aria-hidden="true" />
              {t("hero.ctaPrimary")}
            </Link>
            <Link
              href={`${base}/pricing`}
              className="inline-flex h-11 items-center rounded-xl border border-slate-700 px-5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
            >
              {t("hero.ctaSecondary")}
            </Link>
          </div>

          <ul className="flex flex-wrap gap-4 pt-1 text-xs text-slate-400">
            <li className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />{t("hero.note1")}</li>
            <li className="flex items-center gap-1.5"><Server className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />{t("hero.note2")}</li>
            <li className="flex items-center gap-1.5"><Timer className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />{t("hero.note3")}</li>
          </ul>
        </div>

        {/* Aperçu illustratif du rapport (maquette statique honnête). */}
        <aside
          aria-label={t("hero.previewLabel")}
          className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-56 bg-[radial-gradient(closest-side,rgba(16,185,129,0.16),transparent)]"
          />
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {t("hero.previewLabel")}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-6xl font-bold tabular-nums text-emerald-400">{t("hero.previewScore")}</span>
            <span className="text-sm text-slate-500">/ 100</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{t("hero.previewCaption")}</p>

          <ul className="mt-5 space-y-2.5 text-sm">
            <li className="flex items-center justify-between gap-2 rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2">
              <span className="flex items-center gap-2 text-slate-200">
                <KeyRound className="h-4 w-4 text-red-400" aria-hidden="true" />
                seed.js
              </span>
              <span className="text-xs text-red-300">API key</span>
            </li>
            <li className="flex items-center justify-between gap-2 rounded-lg border border-amber-900/40 bg-amber-950/30 px-3 py-2">
              <span className="flex items-center gap-2 text-slate-200">
                <Package className="h-4 w-4 text-amber-400" aria-hidden="true" />
                package.json
              </span>
              <span className="text-xs text-amber-300">2 advisories</span>
            </li>
            <li className="flex items-center justify-between gap-2 rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-3 py-2">
              <span className="flex items-center gap-2 text-slate-200">
                <Gauge className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                TLS
              </span>
              <span className="text-xs text-emerald-300">+178d</span>
            </li>
          </ul>
        </aside>
      </section>

      {/* ---------------------------- BÉNÉFICES ----------------------------- */}
      <section className="border-t border-slate-800/60 py-14" aria-labelledby="benefits-title">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">{t("benefits.kicker")}</p>
        <h2 id="benefits-title" className="mt-2 text-2xl font-bold sm:text-3xl">{t("benefits.title")}</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {benefitItems.map((item) => (
            <figure key={item.title} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <CircleDot className="h-5 w-5 text-emerald-400" aria-hidden="true" />
              <figcaption className="mt-3 text-sm font-semibold">{item.title}</figcaption>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.text}</p>
            </figure>
          ))}
        </div>
      </section>

      {/* ------------------------------ ÉTAPES ------------------------------ */}
      <section className="py-10" aria-labelledby="how-title">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">{t("how.kicker")}</p>
        <h2 id="how-title" className="mt-2 text-2xl font-bold sm:text-3xl">{t("how.title")}</h2>
        <ol className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {howItems.map((item, index) => (
            <li
              key={item.title}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-950 font-mono text-sm text-emerald-300">
                {index + 1}
              </span>
              <p className="mt-3 text-sm font-semibold">{item.title}</p>
              <p className="mt-2 text-sm text-slate-400">{item.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* --------------------------- FONCTIONNALITÉS ------------------------- */}
      <section id="features" className="border-t border-slate-800/60 py-14" aria-labelledby="features-title">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">{t("features.kicker")}</p>
        <h2 id="features-title" className="mt-2 text-2xl font-bold sm:text-3xl">{t("features.title")}</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <div className="flex items-center gap-2">
                {feature.tone === "alert" ? (
                  <KeyRound className="h-4 w-4 text-red-400" aria-hidden="true" />
                ) : feature.tone === "live" ? (
                  <Globe2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                ) : (
                  <ScanSearch className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                )}
                <h3 className="text-sm font-semibold">{feature.title}</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------------------- COMPARAISON ---------------------------- */}
      <section className="py-14" aria-labelledby="compare-title">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">{t("compare.kicker")}</p>
        <h2 id="compare-title" className="mt-2 text-2xl font-bold sm:text-3xl">{t("compare.title")}</h2>
        <div className="mt-8 overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-900/70 text-left">
                <th className="px-4 py-3 font-medium text-slate-400" scope="col" aria-label="criteria" />
                <th className="px-4 py-3 font-semibold text-emerald-300" scope="col">{t("compare.colGuard")}</th>
                <th className="px-4 py-3 font-medium text-slate-400" scope="col">{t("compare.colOthers")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {compareRows.map((row) => (
                <tr key={row.label} className="odd:bg-slate-900/30">
                  <th scope="row" className="px-4 py-3 text-left font-medium text-slate-300">
                    {row.label}
                  </th>
                  <td className="px-4 py-3 text-emerald-200">{row.guard}</td>
                  <td className="px-4 py-3 text-slate-400">{row.others}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">{t("compare.note")}</p>
      </section>

      {/* -------------------------------- FAQ ------------------------------- */}
      <section id="faq" className="border-t border-slate-800/60 py-14" aria-labelledby="faq-title">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">{t("faq.kicker")}</p>
        <h2 id="faq-title" className="mt-2 text-2xl font-bold sm:text-3xl">{t("faq.title")}</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {faqItems.map((item) => (
            <details
              key={item.question}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 open:bg-slate-900/80"
            >
              <summary className="marker:text-emerald-400 cursor-pointer text-sm font-semibold">
                {item.question}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ------------------------------- CTA -------------------------------- */}
      <section className="py-10">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-900/50 bg-emerald-950/30 p-8 text-center">
          <h2 className="text-xl font-bold sm:text-2xl">{t("hero.title2")}</h2>
          <Link
            href={`${base}/app`}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-6 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
          >
            <Rocket className="h-4 w-4" aria-hidden="true" />
            {t("hero.ctaPrimary")}
          </Link>
        </div>
      </section>

      {/* -------------------------------- CTA -------------------------------- */}
      <section className="py-10">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-900/50 bg-emerald-950/30 p-8 text-center">
          <h2 className="text-xl font-bold sm:text-2xl">{t("hero.title2")}</h2>
          <Link
            href={`${base}/app`}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-6 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
          >
            <Rocket className="h-4 w-4" aria-hidden="true" />
            {t("hero.ctaPrimary")}
          </Link>
        </div>
      </section>

      <SiteFooter locale={locale} />
    </div>
  );
}
