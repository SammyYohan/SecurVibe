export const LOCALES = ["en", "fr", "es", "de", "pt-br", "ja", "zh-cn", "ar"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

type LocaleMeta = {
  /** BCP 47 for Intl / <html lang>. */
  tag: string;
  name: string;
  dir: "ltr" | "rtl";
};

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { tag: "en", name: "English", dir: "ltr" },
  fr: { tag: "fr", name: "Français", dir: "ltr" },
  es: { tag: "es", name: "Español", dir: "ltr" },
  de: { tag: "de", name: "Deutsch", dir: "ltr" },
  "pt-br": { tag: "pt-BR", name: "Português (BR)", dir: "ltr" },
  ja: { tag: "ja", name: "日本語", dir: "ltr" },
  "zh-cn": { tag: "zh-CN", name: "简体中文", dir: "ltr" },
  ar: { tag: "ar", name: "العربية", dir: "rtl" },
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Exact URL segment of a locale ("pt-br"). */
export function localeSegment(locale: Locale): string {
  return locale;
}
