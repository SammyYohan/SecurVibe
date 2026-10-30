import Link from "next/link";
import { BadgeCheck, Check, Rocket, ShieldCheck } from "lucide-react";

import { LocaleSwitcher } from "@/components/site/LocaleSwitcher";
import { SiteFooter } from "@/components/site/SiteFooter";
import { type Locale, LOCALE_META, isLocale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n";
import { PLAN_PRICES, checkoutHref } from "@/lib/pricing";
import { formatPrice } from "@/lib/i18n/config";
import type { FlatKey } from "@/lib/i18n/dictionaries/en";

export type PricingPageProps = {
  params: Promise<{ locale: string }>;
};

type PlanCardId = "free" | "essential" | "pro" | "team";

type CardDef = {
  id: PlanCardId;
  nameKey: FlatKey;
  audienceKey: FlatKey;
  featureKeys: [FlatKey, FlatKey, FlatKey, FlatKey];
};

const CARDS: Array<CardDef> = [
  {
    id: "free",
    nameKey: "pricing.plans.free.name",
    audienceKey: "pricing.plans.free.for",
    featureKeys: [
      "pricing.plans.free.f1",
      "pricing.plans.free.f2",
      "pricing.plans.free.f3",
      "pricing.plans.free.f4",
    ],
  },
  {
    id: "essential",
    nameKey: "pricing.plans.essential.name",
    audienceKey: "pricing.plans.essential.for",
    featureKeys: [
      "pricing.plans.essential.f1",
      "pricing.plans.essential.f2",
      "pricing.plans.essential.f3",
      "pricing.plans.essential.f4",
    ],
  },
  {
    id: "pro",
    nameKey: "pricing.plans.pro.name",
    audienceKey: "pricing.plans.pro.for",
    featureKeys: [
      "pricing.plans.pro.f1",
      "pricing.plans.pro.f2",
      "pricing.plans.pro.f3",
      "pricing.plans.pro.f4",
    ],
  },
  {
    id: "team",
    nameKey: "pricing.plans.team.name",
    audienceKey: "pricing.plans.team.for",
    featureKeys: [
      "pricing.plans.team.f1",
      "pricing.plans.team.f2",
      "pricing.plans.team.f3",
      "pricing.plans.team.f4",
    ],
  },
];

const PACK_FEATURE_KEYS: [FlatKey, FlatKey, FlatKey] = [
  "pricing.plans.pack.f1",
  "pricing.plans.pack.f2",
  "pricing.plans.pack.f3",
];

export default async function PricingPage({ params }: PricingPageProps) {
  const { locale: candidate } = await params;
  const locale: Locale = isLocale(candidate) ? candidate : "en";
  const t = createTranslator(locale);
  const base = `/${locale}`;
  const meta = LOCALE_META[locale];

  const cards = CARDS.map((def) => {
    const price = PLAN_PRICES[def.id];
    return {
      id: def.id,
      name: t(def.nameKey),
      audience: t(def.audienceKey),
      features: def.featureKeys.map((key) => t(key)),
      monthly: price.monthly,
      yearlyTotal: price.yearlyTotal,
      checkout: checkoutHref(def.id),
    };
  });

  const packFeatures: Array<string> = PACK_FEATURE_KEYS.map((key) => t(key));

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4 py-5">
        <Link href={base} className="flex items-center gap-2.5" aria-label={t("meta.siteName")}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-900/50 bg-emerald-950/50">
            <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight">{t("meta.siteName")}</span>
        </Link>
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

      <main className="flex-1 py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
          {t("pricing.kicker")}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{t("pricing.title")}</h1>
        <p className="mt-3 max-w-3xl text-base text-slate-300">{t("pricing.subtitle")}</p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <article
              key={card.id}
              className={
                card.id === "pro" || card.id === "essential"
                  ? "relative flex flex-col rounded-2xl border border-emerald-800/60 bg-slate-900/70 p-6 shadow-lg"
                  : "flex flex-col rounded-2xl border border-slate-800 bg-slate-900/50 p-6"
              }
            >
              {card.id === "pro" ? (
                <span className="absolute -top-3 start-4 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-semibold text-slate-950">
                  {t("pricing.yearlyNote")}
                </span>
              ) : null}
              <h2 className="text-lg font-semibold">{card.name}</h2>
              <p className="mt-1 text-xs text-slate-500">{card.audience}</p>
              <p className="mt-4 flex items-baseline gap-1 text-3xl font-bold tabular-nums">
                {formatPrice(card.monthly, meta.currency, meta.tag)}
                <span className="text-sm font-normal text-slate-500">
                  {t("pricing.perMonth")}
                </span>
              </p>
              {card.id !== "free" ? (
                <p className="mt-1 text-xs text-slate-500">
                  {t("pricing.yearly")} : {formatPrice(card.yearlyTotal, meta.currency, meta.tag)}
                  {t("pricing.perYear")} · {t("pricing.yearlyNote")}
                </p>
              ) : null}

              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                {card.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-slate-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>

              {card.checkout === null ? (
                <Link
                  href={`${base}/app`}
                  className={
                    card.id === "free"
                      ? "mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
                      : "mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-800/60 px-4 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-950/40"
                  }
                >
                  <Rocket className="h-4 w-4" aria-hidden="true" />
                  {card.id === "free" ? t("pricing.ctaFree") : t("pricing.ctaBeta")}
                </Link>
              ) : (
                <a
                  href={card.checkout}
                  className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
                >
                  {t("pricing.ctaCheckout")}
                </a>
              )}
            </article>
          ))}
        </div>

        {/* Pack à l'unité */}
        <aside className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">{t("pricing.plans.pack.name")}</h2>
            <p className="text-xs text-emerald-300">{t("pricing.plans.pack.label")}</p>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
              {packFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <div className="text-end">
            <p className="text-3xl font-bold tabular-nums">
              {formatPrice(PLAN_PRICES.pack.monthly, meta.currency, meta.tag)}
            </p>
          </div>
        </aside>

        <div className="mt-8 space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
          <p className="flex items-start gap-2">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
            {t("pricing.guarantee")}
          </p>
          <p>{t("pricing.betaNote")}</p>
          <p>{t("pricing.currencyNote")}</p>
        </div>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
