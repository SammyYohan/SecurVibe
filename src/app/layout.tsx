import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "GuardVibe — Santé & sécurité de votre SaaS",
  description:
    "Analyse simulée de sécurité et parcours d'achat pour les applications SaaS générées par IA. Mode démo, aucune donnée ne quitte le serveur.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full bg-slate-950 font-sans text-slate-100">
        {children}
      </body>
    </html>
  );
}
