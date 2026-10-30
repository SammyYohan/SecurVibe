"use client";

import { ChevronDown, Globe } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/config";

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (next: string): void => {
    if (next === locale) return;
    const rest = pathname.startsWith(`/${locale}`) ? pathname.slice(`/${locale}`.length) : pathname;
    router.push(`/${next}${rest === "" ? "" : rest}`);
  };

  return (
    <label className="relative inline-flex items-center">
      <Globe className="pointer-events-none absolute start-3 h-4 w-4 text-mute" aria-hidden="true" />
      <span className="sr-only">{LOCALE_META[locale].name}</span>
      <select
        value={locale}
        onChange={(event) => handleChange(event.target.value)}
        className="h-10 appearance-none rounded-xl border border-line-strong bg-card ps-9 pe-9 text-sm font-medium text-ink transition-colors hover:bg-paper-2"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_META[code].name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 h-4 w-4 text-mute" aria-hidden="true" />
    </label>
  );
}
