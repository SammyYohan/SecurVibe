"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import {
  LOCALE_META,
  type Locale,
} from "@/lib/i18n/config";

export type TranslatorClient = (
  path: string,
  vars?: Record<string, string | number>,
) => string;

type I18nValue = {
  t: TranslatorClient;
  locale: Locale;
  dir: "ltr" | "rtl";
};

const I18nContext = createContext<I18nValue | null>(null);

export type I18nProviderProps = {
  locale: Locale;
  /** Flattened record "path.key" -> text, pre-merged server-side (EN included). */
  snapshot: Record<string, string>;
  children: ReactNode;
};

export function I18nProvider({ locale, snapshot, children }: I18nProviderProps) {
  const value = useMemo<I18nValue>(() => {
    const flat = new Map<string, string>(Object.entries(snapshot));
    const t: TranslatorClient = (path, vars) => {
      let text = flat.get(path) ?? path;
      if (vars !== undefined) {
        for (const [key, replacement] of Object.entries(vars)) {
          text = text.replaceAll(`{${key}}`, String(replacement));
        }
      }
      return text;
    };
    return { t, locale, dir: LOCALE_META[locale].dir };
  }, [locale, snapshot]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (value === null) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  return value;
}
