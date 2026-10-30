import { Dashboard } from "@/components/dashboard/Dashboard";
import { isLocale } from "@/lib/i18n/config";
import { getDictionarySnapshot } from "@/lib/i18n";
import { notFound } from "next/navigation";

export type AppPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AppPage({ params }: AppPageProps) {
  const { locale: candidate } = await params;
  if (!isLocale(candidate)) notFound();

  return (
    <Dashboard
      locale={candidate}
      dictionary={getDictionarySnapshot(candidate)}
    />
  );
}
