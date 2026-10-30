import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n/config";

/** Redirige vers la locale préférée de l'utilisateur (Accept-Language). */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const hasLocale = LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return NextResponse.next();

  const preferred = pickPreferredLocale(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${preferred}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

function pickPreferredLocale(header: string | null): string {
  if (header !== null) {
    const parts = header
      .split(",")
      .map((part) => {
        const segments = part.trim().split(";");
        const tag = (segments[0] ?? "").trim().toLowerCase();
        const qParam = segments[1] ?? "";
        const weight = Number(/q=([0-9.]+)/.exec(qParam)?.[1] ?? "1") || 0;
        return { tag, weight };
      })
      .sort((a, b) => b.weight - a.weight);

    for (const part of parts) {
      const exact = LOCALES.find((locale) => locale === part.tag);
      if (exact !== undefined) return exact;
      const baseTag = part.tag.split("-")[0] ?? part.tag;
      const base = LOCALES.find((locale) => locale !== "en" && locale.split("-")[0] === baseTag);
      if (base !== undefined) return base;
    }
  }
  return DEFAULT_LOCALE;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
