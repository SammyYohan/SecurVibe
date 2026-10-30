import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LOCALES, LOCALE_META, type Locale, isLocale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n";

import "../globals.css";

export function generateStaticParams(): Array<{ locale: string }> {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: candidate } = await params;
  const locale: Locale = isLocale(candidate) ? candidate : "en";
  const t = createTranslator(locale);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  return {
    title: t("meta.title"),
    description: t("meta.description"),
    ...(siteUrl !== undefined && siteUrl.startsWith("https://")
      ? {
          metadataBase: new URL(siteUrl),
          alternates: {
            canonical: `${siteUrl}/${locale}`,
            languages: Object.fromEntries(
              (Object.keys(LOCALE_META) as Locale[]).map((code) => [
                LOCALE_META[code].tag,
                `${siteUrl}/${code}`,
              ]),
            ),
          },
        }
      : {}),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: candidate } = await params;
  if (!isLocale(candidate)) notFound();
  const meta = LOCALE_META[candidate];

  return (
    <html lang={meta.tag} dir={meta.dir} className="h-full">
      <body className="min-h-full bg-slate-950 font-sans text-slate-100">{children}</body>
    </html>
  );
}
