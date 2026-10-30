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
      <Globe className="pointer-events-none absolute left-2.5 h-4 w-4 text-slate-500" aria-hidden="true" />
      <span className="sr-only">{LOCALE_META[locale].name}</span>
      <select
        value={locale}
        onChange={(event) => handleChange(event.target.value)}
        className="h-9 appearance-none rounded-lg border border-slate-800 bg-slate-900 pl-8 pr-8 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} className="bg-slate-900">
            {LOCALE_META[code].name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-slate-500" aria-hidden="true" />
    </label>
  );
}
