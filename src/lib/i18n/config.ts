export const LOCALES = ["en", "fr", "es", "de", "pt-br", "ja", "zh-cn", "ar"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

type LocaleMeta = {
  /** BCP 47 pour Intl / <html lang>. */
  tag: string;
  name: string;
  dir: "ltr" | "rtl";
  currency: "USD" | "EUR";
};

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { tag: "en", name: "English", dir: "ltr", currency: "USD" },
  fr: { tag: "fr", name: "Français", dir: "ltr", currency: "EUR" },
  es: { tag: "es", name: "Español", dir: "ltr", currency: "EUR" },
  de: { tag: "de", name: "Deutsch", dir: "ltr", currency: "EUR" },
  "pt-br": { tag: "pt-BR", name: "Português (BR)", dir: "ltr", currency: "USD" },
  ja: { tag: "ja", name: "日本語", dir: "ltr", currency: "USD" },
  "zh-cn": { tag: "zh-CN", name: "简体中文", dir: "ltr", currency: "USD" },
  ar: { tag: "ar", name: "العربية", dir: "rtl", currency: "USD" },
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Segment d'URL exact d'une locale ("pt-br"). */
export function localeSegment(locale: Locale): string {
  return locale;
}

export function formatPrice(amount: number, currency: LocaleMeta["currency"], tag: string): string {
  return new Intl.NumberFormat(tag, {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
