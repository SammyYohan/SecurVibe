import Link from "next/link";
import { BadgeCheck, Check, FlaskConical, Plus, Server, Timer } from "lucide-react";

import { LocaleSwitcher } from "@/components/site/LocaleSwitcher";
import { Logo } from "@/components/site/Logo";
import { SectionHeading } from "@/components/site/SectionHeading";
import { SiteFooter } from "@/components/site/SiteFooter";
import { buttonVariants } from "@/components/ui/button";
import { type Locale, isLocale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n";

export type LandingPageProps = {
  params: Promise<{ locale: string }>;
};

type Tone = "alert" | "warn" | "ok";

const TAG_TONE: Record<Tone, string> = {
  alert: "bg-crit-bg text-crit",
  warn: "bg-warn-bg text-warn",
  ok: "bg-tint text-accent",
};

const NAV_LINK = "text-sm font-medium text-mute transition-colors hover:text-ink";
const CARD = "rounded-2xl border border-line bg-card p-6 shadow-card";

export default async function LandingPage({ params }: LandingPageProps) {
  const { locale: candidate } = await params;
  const locale: Locale = isLocale(candidate) ? candidate : "en";
  const t = createTranslator(locale);
  const base = `/${locale}`;

  // Technical labels (secrets, .env, TLS…) are developer vocabulary:
  // intentionally kept identical in every language.
  const features: Array<{ tag: string; tone: Tone; title: string; text: string }> = [
    { tag: "secrets", tone: "alert", title: t("features.f1"), text: t("features.f1d") },
    { tag: "OSV.dev", tone: "warn", title: t("features.f2"), text: t("features.f2d") },
    { tag: ".env", tone: "alert", title: t("features.f3"), text: t("features.f3d") },
    { tag: "headers", tone: "ok", title: t("features.f4"), text: t("features.f4d") },
    { tag: "TLS", tone: "ok", title: t("features.f5"), text: t("features.f5d") },
    { tag: "git", tone: "ok", title: t("features.f6"), text: t("features.f6d") },
    { tag: "score", tone: "ok", title: t("features.f7"), text: t("features.f7d") },
    { tag: "i18n", tone: "ok", title: t("features.f8"), text: t("features.f8d") },
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
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between gap-4 py-5">
        <Logo href={base} label={t("meta.siteName")} />

        <nav className="hidden items-center gap-8 md:flex" aria-label={t("nav.app")}>
          <a className={NAV_LINK} href="#features">{t("nav.features")}</a>
          <a className={NAV_LINK} href="#faq">{t("nav.faq")}</a>
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher locale={locale} />
          <Link href={`${base}/app`} className={buttonVariants({ size: "sm" })}>
            {t("nav.start")}
          </Link>
        </div>
      </header>

      {/* ------------------------------- HERO ------------------------------- */}
      <section className="grid grid-cols-1 items-center gap-14 py-16 md:grid-cols-[1.1fr_1fr] md:py-24">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-tint px-3.5 py-1.5 text-xs font-semibold text-accent">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
            {t("hero.badge")}
          </span>
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-[3.4rem]">
            {t("hero.title1")}
            <span className="mt-1 block text-accent">{t("hero.title2")}</span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-mute">{t("hero.subtitle")}</p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link href={`${base}/app`} className={buttonVariants({ size: "lg" })}>
              {t("hero.ctaPrimary")}
            </Link>
          </div>

          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-mute">
            <li className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-accent" aria-hidden="true" />{t("hero.note1")}</li>
            <li className="flex items-center gap-2"><Server className="h-4 w-4 text-accent" aria-hidden="true" />{t("hero.note2")}</li>
            <li className="flex items-center gap-2"><Timer className="h-4 w-4 text-accent" aria-hidden="true" />{t("hero.note3")}</li>
          </ul>
        </div>

        {/* Illustrative report preview (honest static mock-up). */}
        <aside
          aria-label={t("hero.previewLabel")}
          className="rounded-2xl border border-line bg-card p-7 shadow-card"
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-mute">{t("hero.previewLabel")}</p>
              <p className="mt-3 flex items-baseline gap-2">
                <span className="text-7xl font-extrabold leading-none tracking-[-0.04em] tabular-nums text-accent">
                  {t("hero.previewScore")}
                </span>
                <span className="text-base text-mute">/ 100</span>
              </p>
            </div>
            <span className="rounded-full bg-tint px-3 py-1 text-xs font-semibold text-accent">
              {t("hero.previewCaption")}
            </span>
          </div>

          <ul className="mt-6 space-y-2.5 text-sm">
            <li className="flex items-center justify-between gap-2 rounded-xl bg-crit-bg px-3.5 py-3">
              <span className="font-mono text-[13px] text-ink">seed.js</span>
              <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-crit">API key</span>
            </li>
            <li className="flex items-center justify-between gap-2 rounded-xl bg-warn-bg px-3.5 py-3">
              <span className="font-mono text-[13px] text-ink">package.json</span>
              <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-warn">2 advisories</span>
            </li>
            <li className="flex items-center justify-between gap-2 rounded-xl bg-tint px-3.5 py-3">
              <span className="font-mono text-[13px] text-ink">TLS</span>
              <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-accent">+178d</span>
            </li>
          </ul>

          <div className="mt-5 rounded-xl bg-night p-4 text-night-fg">
            <p className="font-mono text-[11px] font-medium text-night-mute">{t("dashboard.copyList")}</p>
            <p className="mt-2.5 font-mono text-[13px] leading-relaxed">
              - [ ] `seed.js` — API key
              <br />
              &nbsp;&nbsp;Fix: move it to .env and rotate it
            </p>
          </div>
        </aside>
      </section>

      {/* ---------------------------- BENEFITS ----------------------------- */}
      <section className="border-t border-line py-20" aria-labelledby="benefits-title">
        <SectionHeading id="benefits-title" kicker={t("benefits.kicker")} title={t("benefits.title")} />
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {benefitItems.map((item) => (
            <figure key={item.title} className={CARD}>
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-tint">
                <Check className="h-5 w-5 text-accent" aria-hidden="true" />
              </span>
              <figcaption className="mt-4 text-lg font-bold">{item.title}</figcaption>
              <p className="mt-2 leading-relaxed text-mute">{item.text}</p>
            </figure>
          ))}
        </div>
      </section>

      {/* ------------------------------ STEPS ------------------------------ */}
      <section className="border-t border-line py-20" aria-labelledby="how-title">
        <SectionHeading id="how-title" kicker={t("how.kicker")} title={t("how.title")} />
        <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {howItems.map((item, index) => (
            <li key={item.title} className={CARD}>
              <span className="font-mono text-sm font-semibold text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-3.5 text-lg font-bold">{item.title}</p>
              <p className="mt-2 leading-relaxed text-mute">{item.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* --------------------------- FEATURES ------------------------- */}
      <section id="features" className="scroll-mt-6 border-t border-line py-20" aria-labelledby="features-title">
        <SectionHeading id="features-title" kicker={t("features.kicker")} title={t("features.title")} />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className={CARD}>
              <span className={`inline-flex h-6 items-center rounded-full px-2.5 font-mono text-xs font-semibold ${TAG_TONE[feature.tone]}`}>
                {feature.tag}
              </span>
              <h3 className="mt-4 text-base font-bold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------------------- COMPARAISON ---------------------------- */}
      <section className="border-t border-line py-20" aria-labelledby="compare-title">
        <SectionHeading id="compare-title" kicker={t("compare.kicker")} title={t("compare.title")} />
        <div className="mt-10 overflow-x-auto rounded-2xl border border-line bg-card shadow-card">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="bg-tint/60 text-start">
                <th className="px-5 py-3.5 font-medium text-mute" scope="col" aria-label="criteria" />
                <th className="px-5 py-3.5 text-start font-extrabold text-accent" scope="col">{t("compare.colGuard")}</th>
                <th className="px-5 py-3.5 text-start font-semibold text-mute" scope="col">{t("compare.colOthers")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {compareRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="px-5 py-3.5 text-start font-semibold">{row.label}</th>
                  <td className="px-5 py-3.5 font-semibold text-accent">{row.guard}</td>
                  <td className="px-5 py-3.5 text-mute">{row.others}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-mute">{t("compare.note")}</p>
      </section>

      {/* -------------------------------- FAQ ------------------------------- */}
      <section id="faq" className="scroll-mt-6 border-t border-line py-20" aria-labelledby="faq-title">
        <SectionHeading id="faq-title" kicker={t("faq.kicker")} title={t("faq.title")} />
        <div className="mt-10 grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          {faqItems.map((item) => (
            <details
              key={item.question}
              className="group rounded-2xl border border-line bg-card px-6 py-5 open:shadow-card"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">
                {item.question}
                <Plus className="h-5 w-5 shrink-0 text-accent transition-transform group-open:rotate-45" aria-hidden="true" />
              </summary>
              <p className="mt-3 leading-relaxed text-mute">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ----------------------------- CTA FINAL ---------------------------- */}
      <section className="pb-20 pt-4">
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-tint px-6 py-14 text-center">
          <h2 className="text-3xl font-extrabold tracking-[-0.025em]">{t("cta.finalTitle")}</h2>
          <p className="max-w-xl leading-relaxed text-mute">{t("cta.finalText")}</p>
          <Link href={`${base}/app`} className={`${buttonVariants({ size: "lg" })} mt-2`}>
            {t("hero.ctaPrimary")}
          </Link>
        </div>
      </section>

      <SiteFooter locale={locale} />
    </div>
  );
}
