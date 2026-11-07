import { DEFAULT_LOCALE, LOCALES, type Locale, isLocale } from "@/lib/i18n/config";
import { en, type FlatKey } from "@/lib/i18n/dictionaries/en";
import { fr } from "@/lib/i18n/dictionaries/fr";
import { es } from "@/lib/i18n/dictionaries/es";
import { de } from "@/lib/i18n/dictionaries/de";
import { ptBr } from "@/lib/i18n/dictionaries/pt-br";
import { ja } from "@/lib/i18n/dictionaries/ja";
import { zhCn } from "@/lib/i18n/dictionaries/zh-cn";
import { ar } from "@/lib/i18n/dictionaries/ar";

type PartialPack = Partial<Record<FlatKey, string>>;

const PACKS: Record<Locale, PartialPack> = {
  en: {}, // base: English already contains every value
  fr, es, de, "pt-br": ptBr, ja, "zh-cn": zhCn, ar,
};

/** Flattens the nested dictionary into "a.b.c" -> text pairs. */
function flatten(node: unknown, prefix: string, output: Map<string, string>): void {
  if (typeof node !== "object" || node === null) return;
  const entries = Object.entries(node) as Array<[string, unknown]>;
  for (const [key, value] of entries) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    if (typeof value === "string") output.set(path, value);
    else flatten(value, path, output);
  }
}

const EN_FLAT: Map<string, string> = (() => {
  const map = new Map<string, string>();
  flatten(en, "", map);
  return map;
})();

const PACK_FLATS: Record<Locale, Map<string, string>> = Object.fromEntries(
  LOCALES.map((locale) => {
    const map = new Map<string, string>();
    flatten(PACKS[locale], "", map);
    return [locale, map];
  }),
) as Record<Locale, Map<string, string>>;

export type Translator = (path: FlatKey, vars?: Record<string, string | number>) => string;

/** Merged translator: locale key first, then EN fallback, then the raw key. */
export function createTranslator(locale: Locale): Translator {
  const flat = PACK_FLATS[locale];
  return (path, vars) => {
    let value = flat.get(path) ?? EN_FLAT.get(path) ?? path;
    if (vars !== undefined) {
      for (const [key, replacement] of Object.entries(vars)) {
        value = value.replaceAll(`{${key}}`, String(replacement));
      }
    }
    return value;
  };
}

/** Flattened texts of the locale, available client-side via props. */
export function getDictionarySnapshot(locale: Locale): Record<string, string> {
  const flat = PACK_FLATS[locale];
  const merged = new Map<string, string>();
  for (const [key, value] of EN_FLAT) merged.set(key, value);
  for (const [key, value] of flat) merged.set(key, value);
  return Object.fromEntries(merged);
}

export function resolveLocaleCandidate(candidate: string | undefined): Locale {
  if (candidate !== undefined && isLocale(candidate)) return candidate;
  return DEFAULT_LOCALE;
}
