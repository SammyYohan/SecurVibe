"use client";

import { AlertTriangle, Heart, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { z } from "zod";

import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { ScanForm } from "@/components/dashboard/ScanForm";
import { ScanStatus } from "@/components/dashboard/ScanStatus";
import { SecurityReport } from "@/components/dashboard/SecurityReport";
import { SiteAuditPanel } from "@/components/dashboard/SiteAuditPanel";
import { Badge } from "@/components/ui/badge";
import { I18nProvider, useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import { isAbortError } from "@/lib/sleep";
import { computeScore } from "@/lib/score";
import type { ScanRequest } from "@/lib/validation";
import type {
  DashboardStatus,
  Finding,
  ScanEvent,
  ScanPhase,
  TestStep,
} from "@/types";
import { apiErrorSchema, isScanEvent } from "@/types";

export type DashboardProps = {
  locale: Locale;
  /** Textes pré-mergés (locale → repli EN) calculés côté serveur. */
  dictionary: Record<string, string>;
};

type DashboardState = {
  status: DashboardStatus;
  phase: ScanPhase;
  progress: number;
  findings: Finding[];
  steps: TestStep[];
  finalScore: number | null;
  errorMessage: string | null;
};

type ScanAction =
  | { type: "START" }
  | { type: "EVENT"; event: ScanEvent }
  | { type: "CANCELLED" }
  | { type: "FAILED"; message: string };

const INITIAL_STATE: DashboardState = {
  status: "idle",
  phase: "scan",
  progress: 0,
  findings: [],
  steps: [],
  finalScore: null,
  errorMessage: null,
};

const RUNNING_STATE: DashboardState = {
  ...INITIAL_STATE,
  status: "running",
};

const UNLOCK_STEP_ID = 4;

/* ------------------------------------------------------------------ */
/* Historique local des scores (strictement dans le navigateur).       */
/* Pas d'inscription, pas de serveur : la tendance est une comparaison */
/* entre deux passages sur la même cible (repo + URL de production).   */
/* ------------------------------------------------------------------ */

const SCORE_HISTORY_KEY = "guardvibe.scoreHistory.v1";
const MAX_HISTORY_ENTRIES = 50;

type ScoreEntry = {
  /** Score final 0–100 de l'audit. */
  score: number;
  /** Horodatage (millisecondes) du passage. */
  at: number;
  /** Cible auditée — jamais le jeton GitHub. */
  target: string;
};

const scoreEntrySchema = z.object({
  score: z.number().int().min(0).max(100),
  at: z.number().int().nonnegative(),
  target: z.string(),
});

const scoreHistorySchema = z.array(scoreEntrySchema).max(200);

function loadScoreHistory(): ScoreEntry[] {
  try {
    const raw = window.localStorage.getItem(SCORE_HISTORY_KEY);
    if (raw === null) return [];
    const parsed = scoreHistorySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function reducer(state: DashboardState, action: ScanAction): DashboardState {
  switch (action.type) {
    case "START":
      return RUNNING_STATE;
    case "CANCELLED":
      return state.status === "running" ? { ...state, status: "cancelled" } : state;
    case "FAILED":
      return state.status === "running"
        ? { ...state, status: "error", errorMessage: action.message }
        : state;
    case "EVENT": {
      const event = action.event;
      switch (event.type) {
        case "scan_started":
          return state;
        case "progress":
          return { ...state, progress: event.value };
        case "finding":
          // Déduplication : même identifiant, on remplace.
          return { ...state, findings: upsertById(state.findings, event.finding) };
        case "test_step":
          // UPSERT par numéro d'étape : la même ligne évolue de PENDING au statut final.
          return {
            ...state,
            phase: "site",
            steps: upsertById(state.steps, event.step),
          };
        case "done":
          return {
            ...state,
            status: "done",
            finalScore: event.score,
            progress: 100,
          };
        case "error":
          return { ...state, status: "error", errorMessage: event.message };
      }
      return state;
    }
  }
}

function upsertById<T extends { id: string | number }>(
  items: readonly T[],
  item: T,
): T[] {
  if (items.some((existing) => existing.id === item.id)) {
    return items.map((existing) =>
      existing.id === item.id ? item : existing,
    );
  }
  return [...items, item];
}

export function Dashboard({ locale, dictionary }: DashboardProps) {
  return (
    <I18nProvider locale={locale} snapshot={dictionary}>
      <DashboardInner />
    </I18nProvider>
  );
}

function DashboardInner() {
  const { t, locale } = useI18n();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const [previousScore, setPreviousScore] = useState<number | null>(null);

  /** Dernier audit lancé : permet « Ré-auditer après corrections ». */
  const [lastInput, setLastInput] = useState<ScanRequest | null>(null);
  /** Cible de l'audit en cours (repoUrl → productionUrl), sans le jeton. */
  const [currentTarget, setCurrentTarget] = useState("");
  /** Miroir de l'historique (lecture unique au montage, écriture à chaque fin). */
  const historyRef = useRef<ScoreEntry[]>([]);

  // Annulation au démontage : coupe la connexion en cours.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Chargement de l'historique local, une seule fois, navigateur uniquement.
  useEffect(() => {
    historyRef.current = loadScoreHistory();
  }, []);

  // Un score final entre dans l'historique ; la tendance compare la même cible.
  useEffect(() => {
    if (state.status !== "done" || state.finalScore === null) return;
    const score = state.finalScore;
    const now = Date.now();
    const history = historyRef.current;
    const last = history[history.length - 1];
    // Anti-doublon : double-invoke des effets (StrictMode) en développement.
    if (last !== undefined && last.score === score && now - last.at < 2000) return;

    const previous =
      [...history].reverse().find((entry) => entry.target === currentTarget) ??
      null;

    historyRef.current = [
      ...history.slice(-(MAX_HISTORY_ENTRIES - 1)),
      { score, at: now, target: currentTarget },
    ];
    setPreviousScore(previous?.score ?? null);
    try {
      window.localStorage.setItem(
        SCORE_HISTORY_KEY,
        JSON.stringify(historyRef.current),
      );
    } catch {
      // Stockage indisponible (navigation privée) : tendance absente, audit intact.
    }
  }, [state.status, state.finalScore, currentTarget]);

  const runScan = useCallback(async (input: ScanRequest): Promise<void> => {
    // Nouveau scan : annule l'éventuel scan en cours.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "START" });

    let sawTerminator = false;

    const handleLine = (line: string): void => {
      const trimmed = line.trim();
      if (trimmed === "") return;

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(trimmed);
      } catch {
        return; // ligne non-JSON : ignorée sans planter
      }
      if (!isScanEvent(parsedJson)) return; // ligne invalide : ignorée

      if (parsedJson.type === "done" || parsedJson.type === "error") {
        sawTerminator = true;
      }
      dispatch({ type: "EVENT", event: parsedJson });
    };

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!response.ok) {
        let payload: unknown = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }
        const parsed = apiErrorSchema.safeParse(payload);
        dispatch({
          type: "FAILED",
          message: parsed.success
            ? parsed.data.error.message
            : "The audit could not be started.",
        });
        return;
      }

      const responseBody = response.body;
      if (responseBody === null) {
        dispatch({ type: "FAILED", message: t("dashboard.streamInterrupted") });
        return;
      }

      const reader = responseBody.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Boucle de lecture : un JSON par ligne, la dernière ligne incomplète reste dans le buffer.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          handleLine(line);
        }
      }

      // Fin du flux : purge du buffer (dernière ligne sans \n final).
      buffer += decoder.decode();
      if (buffer.trim() !== "") {
        handleLine(buffer);
      }

      if (!sawTerminator && !controller.signal.aborted) {
        dispatch({ type: "FAILED", message: t("dashboard.streamInterrupted") });
      }
    } catch (error) {
      if (isAbortError(error)) {
        // Annulation : jamais affichée comme une erreur.
        if (abortRef.current === controller) {
          dispatch({ type: "CANCELLED" });
        }
        return;
      }
      console.error(
        "[guardvibe] Network error during audit.",
        error instanceof Error ? error.name : typeof error,
      );
      dispatch({ type: "FAILED", message: t("dashboard.streamInterrupted") });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [t]);

  const handleStart = useCallback(
    (input: ScanRequest): void => {
      setLastInput(input);
      setCurrentTarget(`${input.repoUrl} → ${input.productionUrl}`);
      void runScan(input);
    },
    [runScan],
  );

  /** Re-lance le dernier audit avec exactement les mêmes paramètres. */
  const handleRescan = useCallback((): void => {
    if (lastInput === null) return;
    void runScan(lastInput);
  }, [runScan, lastInput]);

  const handleCancel = useCallback((): void => {
    abortRef.current?.abort();
  }, []);

  const isRunning = state.status === "running";

  const rescanVisible =
    !isRunning &&
    lastInput !== null &&
    (state.status === "done" ||
      state.status === "error" ||
      state.status === "cancelled");

  const journeyFailed = useMemo(
    () =>
      state.steps.some(
        (step) => step.id === UNLOCK_STEP_ID && step.status === "FAILED",
      ),
    [state.steps],
  );

  // Score affiché : final du serveur dès l'événement "done", sinon provisoire.
  const partialScore = useMemo(() => {
    if (state.finalScore !== null) return null;
    if (state.findings.length === 0 && state.steps.length === 0) return null;
    return computeScore(state.findings, journeyFailed);
  }, [state.finalScore, state.findings, state.steps, journeyFailed]);

  const displayedScore =
    state.finalScore !== null ? state.finalScore : partialScore;

  const partial = state.finalScore === null && (
    state.status === "error" || state.status === "cancelled"
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8">
      <header className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Logo href={`/${locale}`} label={t("meta.siteName")} />
          <Badge variant="success">{t("dashboard.bannerDemo")}</Badge>
        </div>

        <ScanForm
          isRunning={isRunning}
          onStart={handleStart}
          onCancel={handleCancel}
        />
      </header>

      {state.status === "done" ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl bg-tint px-5 py-4 text-sm text-ink"
        >
          <Heart className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <p>
            {t("dashboard.supportText")}{" "}
            <Link
              href={`/${locale}/support`}
              className="font-semibold text-accent transition-colors hover:text-ink"
            >
              {t("dashboard.supportCta")}
            </Link>
          </p>
        </div>
      ) : null}

      {state.errorMessage !== null ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl bg-crit-bg px-5 py-4 text-sm text-crit"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <p className="font-medium">{state.errorMessage}</p>
        </div>
      ) : null}

      <ScanStatus
        status={state.status}
        phase={state.phase}
        progress={state.progress}
        score={displayedScore}
        finalScore={state.finalScore !== null}
        partial={partial}
        errorMessage={state.errorMessage}
        previousScore={previousScore}
      />

      {rescanVisible ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={handleRescan}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t("dashboard.rescan")}
          </Button>
        </div>
      ) : null}

      <section
        aria-label={t("dashboard.findTitle")}
        className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
      >
        <SecurityReport findings={state.findings} score={displayedScore} />
        <SiteAuditPanel steps={state.steps} />
      </section>

      <footer className="mt-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-line pt-6 text-center text-xs leading-relaxed text-mute">
        <span className="w-full">{t("dashboard.footer")}</span>
        <Link href={`/${locale}/legal`} className="font-medium transition-colors hover:text-ink">
          {t("footer.linksLegal")}
        </Link>
        <Link href={`/${locale}/support`} className="font-medium transition-colors hover:text-ink">
          {t("footer.linksSupport")}
        </Link>
      </footer>
    </div>
  );
}
