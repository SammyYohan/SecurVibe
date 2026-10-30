import Link from "next/link";
import { BadgeCheck, Check } from "lucide-react";

import { LocaleSwitcher } from "@/components/site/LocaleSwitcher";
import { Logo } from "@/components/site/Logo";
import { SiteFooter } from "@/components/site/SiteFooter";
import { buttonVariants } from "@/components/ui/button";
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
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between gap-4 py-5">
        <Logo href={base} label={t("meta.siteName")} />
        <div className="flex items-center gap-3">
          <LocaleSwitcher locale={locale} />
          <Link href={`${base}/app`} className={buttonVariants({ size: "sm" })}>
            {t("nav.start")}
          </Link>
        </div>
      </header>

      <main className="flex-1 py-12">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-accent">
          {t("pricing.kicker")}
        </p>
        <h1 className="mt-3.5 max-w-3xl text-3xl font-extrabold tracking-[-0.03em] sm:text-5xl sm:leading-[1.1]">
          {t("pricing.title")}
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-mute">{t("pricing.subtitle")}</p>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const featured = card.id === "pro" || card.id === "essential";
            return (
              <article
                key={card.id}
                className={
                  featured
                    ? "relative flex flex-col rounded-2xl border-2 border-accent bg-card p-6 shadow-card"
                    : "flex flex-col rounded-2xl border border-line bg-card p-6 shadow-card"
                }
              >
                {card.id === "pro" ? (
                  <span className="absolute -top-3 start-5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">
                    {t("pricing.yearlyNote")}
                  </span>
                ) : null}
                <h2 className="text-lg font-extrabold">{card.name}</h2>
                <p className="mt-1 text-sm text-mute">{card.audience}</p>
                <p className="mt-5 flex items-baseline gap-1 text-4xl font-extrabold tracking-tight tabular-nums">
                  {formatPrice(card.monthly, meta.currency, meta.tag)}
                  <span className="text-sm font-medium text-mute">{t("pricing.perMonth")}</span>
                </p>
                {card.id !== "free" ? (
                  <p className="mt-1 text-xs text-mute">
                    {t("pricing.yearly")} : {formatPrice(card.yearlyTotal, meta.currency, meta.tag)}
                    {t("pricing.perYear")} · {t("pricing.yearlyNote")}
                  </p>
                ) : null}

                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {card.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {card.checkout === null ? (
                  <Link
                    href={`${base}/app`}
                    className={`${buttonVariants({ variant: card.id === "free" ? "default" : "outline" })} mt-7`}
                  >
                    {card.id === "free" ? t("pricing.ctaFree") : t("pricing.ctaBeta")}
                  </Link>
                ) : (
                  <a href={card.checkout} className={`${buttonVariants()} mt-7`}>
                    {t("pricing.ctaCheckout")}
                  </a>
                )}
              </article>
            );
          })}
        </div>

        {/* Pack à l'unité */}
        <aside className="mt-6 flex flex-col gap-4 rounded-2xl bg-tint p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold">{t("pricing.plans.pack.name")}</h2>
            <p className="text-sm font-semibold text-accent">{t("pricing.plans.pack.label")}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {packFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-4xl font-extrabold tracking-tight tabular-nums sm:text-end">
            {formatPrice(PLAN_PRICES.pack.monthly, meta.currency, meta.tag)}
          </p>
        </aside>

        <div className="mt-8 space-y-2 rounded-2xl border border-line bg-card p-5 text-sm text-mute">
          <p className="flex items-start gap-2.5 font-medium text-ink">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
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
