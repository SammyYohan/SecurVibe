"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { LiveSimulator } from "@/components/dashboard/LiveSimulator";
import { ScanForm } from "@/components/dashboard/ScanForm";
import { ScanStatus } from "@/components/dashboard/ScanStatus";
import { SecurityReport } from "@/components/dashboard/SecurityReport";
import { Badge } from "@/components/ui/badge";
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

const STREAM_INTERRUPTED_MESSAGE =
  "Connexion interrompue avant la fin de l'analyse.";

const UNLOCK_STEP_ID = 4;

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
            phase: "journey",
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

export function Dashboard() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  // Annulation au démontage : coupe la connexion en cours.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

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
            : "Échec du lancement de l'analyse.",
        });
        return;
      }

      const responseBody = response.body;
      if (responseBody === null) {
        dispatch({ type: "FAILED", message: STREAM_INTERRUPTED_MESSAGE });
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
        dispatch({ type: "FAILED", message: STREAM_INTERRUPTED_MESSAGE });
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
        "[guardvibe] Erreur réseau pendant l'analyse.",
        error instanceof Error ? error.name : typeof error,
      );
      dispatch({ type: "FAILED", message: STREAM_INTERRUPTED_MESSAGE });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, []);

  const handleStart = useCallback(
    (input: ScanRequest): void => {
      void runScan(input);
    },
    [runScan],
  );

  const handleCancel = useCallback((): void => {
    abortRef.current?.abort();
  }, []);

  const isRunning = state.status === "running";

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
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-900/50 bg-emerald-950/50">
              <ShieldCheck
                className="h-5 w-5 text-emerald-400"
                aria-hidden="true"
              />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
              GuardVibe
            </h1>
          </div>
          <Badge variant="warning">Mode démo · données simulées</Badge>
        </div>

        <ScanForm
          isRunning={isRunning}
          onStart={handleStart}
          onCancel={handleCancel}
        />
      </header>

      {state.errorMessage !== null ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
            aria-hidden="true"
          />
          <p>{state.errorMessage}</p>
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
      />

      <section
        aria-label="Résultats de l'analyse"
        className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2"
      >
        <SecurityReport findings={state.findings} />
        <LiveSimulator steps={state.steps} />
      </section>

      <footer className="mt-auto border-t border-slate-800/70 pt-6 text-center text-xs leading-relaxed text-slate-500">
        GuardVibe · démo. Ne scannez que des dépôts et des sites dont vous êtes
        propriétaire ou pour lesquels vous avez une autorisation explicite.
      </footer>
    </div>
  );
}
