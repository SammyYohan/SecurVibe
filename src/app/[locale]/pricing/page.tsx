import { redirect } from "next/navigation";

import { type Locale, isLocale } from "@/lib/i18n/config";

export type PricingPageProps = {
  params: Promise<{ locale: string }>;
};

/*
 * SecurVibe is 100% free: the pricing page redirects to the free
 * dashboard (/app). Permanent redirect.
 */
export default async function PricingPage({ params }: PricingPageProps) {
  const { locale: candidate } = await params;
  const locale: Locale = isLocale(candidate) ? candidate : "en";
  redirect(`/${locale}/app`);
}
