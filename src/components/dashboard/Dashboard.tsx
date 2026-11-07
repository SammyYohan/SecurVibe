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
  /** Pre-merged texts (locale → EN fallback) computed on the server. */
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
/* Local score history (strictly in the browser).                      */
/* No signup, no server: the trend compares two runs on the same       */
/* target (repo + production URL).                                     */
/* ------------------------------------------------------------------ */

const SCORE_HISTORY_KEY = "securvibe.scoreHistory.v1";
const MAX_HISTORY_ENTRIES = 50;

type ScoreEntry = {
  /** Final 0–100 audit score. */
  score: number;
  /** Timestamp (milliseconds) of the run. */
  at: number;
  /** Audited target — never the GitHub token. */
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
          // Deduplication: same id, replace.
          return { ...state, findings: upsertById(state.findings, event.finding) };
        case "test_step":
          // UPSERT by step number: the same row moves from PENDING to its final status.
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

  /** Last started audit: enables "Re-audit after fixes". */
  const [lastInput, setLastInput] = useState<ScanRequest | null>(null);
  /** Target of the current audit (repoUrl → productionUrl), without the token. */
  const [currentTarget, setCurrentTarget] = useState("");
  /** Mirror of the history (read once on mount, written on each completion). */
  const historyRef = useRef<ScoreEntry[]>([]);

  // Cancel on unmount: cuts the in-flight connection.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Load the local history once, browser only.
  useEffect(() => {
    historyRef.current = loadScoreHistory();
  }, []);

  // A final score enters the history; the trend compares the same target.
  useEffect(() => {
    if (state.status !== "done" || state.finalScore === null) return;
    const score = state.finalScore;
    const now = Date.now();
    const history = historyRef.current;
    const last = history[history.length - 1];
    // Duplicate guard: double-invoked effects (StrictMode) in development.
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
      // Storage unavailable (private browsing): no trend, audit unaffected.
    }
  }, [state.status, state.finalScore, currentTarget]);

  const runScan = useCallback(async (input: ScanRequest): Promise<void> => {
    // New scan: cancel any in-flight scan.
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
        return; // non-JSON line: ignored without crashing
      }
      if (!isScanEvent(parsedJson)) return; // invalid line: ignored

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

      // Read loop: one JSON per line, the last incomplete line stays in the buffer.
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

      // Stream end: flush the buffer (last line without a trailing newline).
      buffer += decoder.decode();
      if (buffer.trim() !== "") {
        handleLine(buffer);
      }

      if (!sawTerminator && !controller.signal.aborted) {
        dispatch({ type: "FAILED", message: t("dashboard.streamInterrupted") });
      }
    } catch (error) {
      if (isAbortError(error)) {
        // Cancellation: never shown as an error.
        if (abortRef.current === controller) {
          dispatch({ type: "CANCELLED" });
        }
        return;
      }
      console.error(
        "[securvibe] Network error during audit.",
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

  /** Re-runs the last audit with exactly the same parameters. */
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

  // Displayed score: server-final as soon as the "done" event arrives, otherwise provisional.
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
