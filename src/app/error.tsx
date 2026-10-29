"use client";

import { RefreshCcw, ShieldOff } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** Boundary d'erreur de la page : l'interface ne plante jamais silencieusement. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[guardvibe] Erreur de rendu de la page.", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-900/60 bg-red-950/40">
        <ShieldOff className="h-7 w-7 text-red-400" aria-hidden="true" />
      </span>

      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-xl font-semibold text-slate-100">
          Une erreur est survenue
        </h1>
        <p className="text-sm leading-relaxed text-slate-400">
          GuardVibe n&apos;a pas pu afficher cette page. Vous pouvez réessayer :
          vos données restent locales, rien n&apos;a été envoyé.
        </p>
      </div>

      <Button onClick={reset}>
        <RefreshCcw className="h-4 w-4" aria-hidden="true" />
        Réessayer
      </Button>
    </div>
  );
}
