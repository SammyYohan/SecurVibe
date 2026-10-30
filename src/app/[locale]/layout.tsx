import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import { notFound } from "next/navigation";

import { LOCALES, LOCALE_META, type Locale, isLocale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n";

import "../globals.css";

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-manrope",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jetbrains",
  display: "swap",
});

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
    <html
      lang={meta.tag}
      dir={meta.dir}
      className={`h-full ${manrope.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-full bg-paper font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
