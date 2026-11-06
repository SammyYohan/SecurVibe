import { redirect } from "next/navigation";

import { type Locale, isLocale } from "@/lib/i18n/config";

export type PricingPageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * GuardVibe est 100 % gratuit : la page de tarification est remplacée
 * par la page de soutien / dons (/support). Redirection permanente.
 */
export default async function PricingPage({ params }: PricingPageProps) {
  const { locale: candidate } = await params;
  const locale: Locale = isLocale(candidate) ? candidate : "en";
  redirect(`/${locale}/support`);
}
