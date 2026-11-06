import Link from "next/link";

import { Logo } from "@/components/site/Logo";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n";

const LINK = "font-medium text-mute transition-colors hover:text-ink";

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = createTranslator(locale);
  const base = `/${locale}`;

  return (
    <footer className="mt-auto border-t border-line py-10 text-sm text-mute">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="flex flex-col gap-2">
          <Logo href={base} label={t("meta.siteName")} />
          <p>{t("footer.tagline")}</p>
        </div>
        <nav aria-label={t("footer.linksLegal")} className="flex flex-wrap gap-x-6 gap-y-2">
          <Link className={LINK} href={`${base}/support`}>{t("footer.linksSupport")}</Link>
          <Link className={LINK} href={`${base}/app`}>{t("footer.linksApp")}</Link>
          <Link className={LINK} href={`${base}/legal`}>{t("footer.linksLegal")}</Link>
        </nav>
      </div>
      <p className="mt-6 text-xs">{t("footer.demo")}</p>
      <p className="mt-1 text-xs">{t("footer.rights", { year: String(new Date().getFullYear()) })}</p>
    </footer>
  );
}
