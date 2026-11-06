import Link from "next/link";
import { Coffee, ExternalLink, Heart, Layers, Play, Shield, Timer } from "lucide-react";

import { LocaleSwitcher } from "@/components/site/LocaleSwitcher";
import { Logo } from "@/components/site/Logo";
import { SiteFooter } from "@/components/site/SiteFooter";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createTranslator } from "@/lib/i18n";
import { type Locale, isLocale } from "@/lib/i18n/config";
import {
  AUDITS_PER_DAY,
  AUDITS_PER_MINUTE,
  GLOBAL_DAILY_AUDITS,
  MAX_AUDIT_FILES,
} from "@/lib/plans";

export type SupportPageProps = {
  params: Promise<{ locale: string }>;
};

const KOFI_URL = process.env.NEXT_PUBLIC_KOFI_URL?.trim() || "https://ko-fi.com";
const PAYPAL_URL = process.env.NEXT_PUBLIC_PAYPAL_URL?.trim() || "https://paypal.me";

export default async function SupportPage({ params }: SupportPageProps) {
  const { locale: candidate } = await params;
  const locale: Locale = isLocale(candidate) ? candidate : "en";
  const t = createTranslator(locale);
  const base = `/${locale}`;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between gap-4 py-5">
        <Logo href={base} label={t("meta.siteName")} />
        <div className="flex items-center gap-3">
          <LocaleSwitcher locale={locale} />
          <Link
            href={`${base}/app`}
            className={buttonVariants({ size: "sm" })}
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            {t("nav.app")}
          </Link>
        </div>
      </header>

      <main className="flex-1 py-10 sm:py-14">
        {/* En-tête de la page */}
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-tint px-3 py-1 text-xs font-semibold text-accent">
            <Heart className="h-3.5 w-3.5 fill-accent" aria-hidden="true" />
            <span>{t("dashboard.bannerDemo")}</span>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">
            {t("support.title")}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-mute">
            {t("support.intro")}
          </p>
        </div>

        {/* Options de soutien (Ko-fi / PayPal) */}
        <section className="mt-10 grid gap-6 sm:grid-cols-2" aria-label={t("nav.support")}>
          <Card className="flex flex-col justify-between transition-shadow hover:shadow-card-lg">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tint text-accent">
                <Coffee className="h-5 w-5" aria-hidden="true" />
              </div>
              <CardTitle className="mt-2 text-xl font-extrabold">
                {t("support.kofiTitle")}
              </CardTitle>
              <CardDescription className="text-base text-mute">
                {t("support.kofiText")}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <a
                href={KOFI_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ size: "lg", className: "w-full justify-center gap-2" })}
              >
                <span>{t("support.kofiCta")}</span>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between transition-shadow hover:shadow-card-lg">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tint text-accent">
                <Heart className="h-5 w-5" aria-hidden="true" />
              </div>
              <CardTitle className="mt-2 text-xl font-extrabold">
                {t("support.paypalTitle")}
              </CardTitle>
              <CardDescription className="text-base text-mute">
                {t("support.paypalText")}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <a
                href={PAYPAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "w-full justify-center gap-2",
                })}
              >
                <span>{t("support.paypalCta")}</span>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </CardContent>
          </Card>
        </section>

        {/* Section Quotas d'usage raisonnable */}
        <section className="mt-14" aria-labelledby="usage-title">
          <h2 id="usage-title" className="text-2xl font-extrabold tracking-tight">
            {t("support.usageTitle")}
          </h2>
          <p className="mt-2 max-w-2xl leading-relaxed text-mute">
            {t("support.usageNote", {
              perMinute: AUDITS_PER_MINUTE,
              perDay: AUDITS_PER_DAY,
            })}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-line bg-card p-4">
              <div className="flex items-center gap-2 text-mute">
                <Timer className="h-4 w-4 text-accent" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wider">Minute</span>
              </div>
              <p className="mt-3 text-2xl font-extrabold text-ink">{AUDITS_PER_MINUTE}</p>
              <p className="text-xs text-mute">audits / IP</p>
            </div>

            <div className="rounded-2xl border border-line bg-card p-4">
              <div className="flex items-center gap-2 text-mute">
                <Shield className="h-4 w-4 text-accent" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wider">Jour</span>
              </div>
              <p className="mt-3 text-2xl font-extrabold text-ink">{AUDITS_PER_DAY}</p>
              <p className="text-xs text-mute">audits / IP</p>
            </div>

            <div className="rounded-2xl border border-line bg-card p-4">
              <div className="flex items-center gap-2 text-mute">
                <Heart className="h-4 w-4 text-accent" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wider">Global</span>
              </div>
              <p className="mt-3 text-2xl font-extrabold text-ink">{GLOBAL_DAILY_AUDITS}</p>
              <p className="text-xs text-mute">audits / jour</p>
            </div>

            <div className="rounded-2xl border border-line bg-card p-4">
              <div className="flex items-center gap-2 text-mute">
                <Layers className="h-4 w-4 text-accent" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wider">Scan</span>
              </div>
              <p className="mt-3 text-2xl font-extrabold text-ink">{MAX_AUDIT_FILES}</p>
              <p className="text-xs text-mute">fichiers max</p>
            </div>
          </div>
        </section>

        {/* Mot de clôture et CTA */}
        <div className="mt-12 flex flex-col items-start justify-between gap-4 rounded-2xl bg-tint p-6 sm:flex-row sm:items-center">
          <p className="text-sm font-semibold text-ink sm:text-base">
            {t("support.closing")}
          </p>
          <Link
            href={`${base}/app`}
            className={buttonVariants({ size: "default", className: "shrink-0 gap-2" })}
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            <span>{t("nav.start")}</span>
          </Link>
        </div>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
