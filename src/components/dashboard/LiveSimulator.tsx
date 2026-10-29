"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
} from "lucide-react";
import { useMemo } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { StepStatus, TestStep } from "@/types";

export type LiveSimulatorProps = {
  steps: TestStep[];
};

const EMPTY_MESSAGE = "En attente du lancement de l'analyse.";

export function LiveSimulator({ steps }: LiveSimulatorProps) {
  const failedUnlock = useMemo(() => {
    const unlockStep = steps.find((step) => step.id === 4);
    return unlockStep?.status === "FAILED" ? unlockStep : null;
  }, [steps]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parcours d&apos;achat (simulation)</CardTitle>
      </CardHeader>

      <CardContent>
        {steps.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {EMPTY_MESSAGE}
          </p>
        ) : (
          <ol className="flex flex-col gap-1" aria-live="polite">
            {steps.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </ol>
        )}

        {failedUnlock !== null ? (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200"
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
              aria-hidden="true"
            />
            <span>
              <span className="font-semibold">Échec du déblocage. </span>
              {failedUnlock.detail}
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StepRow({ step }: { step: TestStep }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <StepIcon status={step.status} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p
          className={
            step.status === "FAILED"
              ? "text-sm font-medium text-red-200"
              : "text-sm text-slate-200"
          }
        >
          {step.label}
        </p>
        {step.detail !== undefined ? (
          <p className="text-xs text-red-300">{step.detail}</p>
        ) : null}
      </div>
      <time
        dateTime={step.timestamp}
        className="shrink-0 pt-0.5 font-mono text-xs text-slate-500"
      >
        {formatTime(step.timestamp)}
      </time>
    </li>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "PENDING":
      return <Circle className="mt-0.5 h-4 w-4 text-slate-600" aria-hidden="true" />;
    case "RUNNING":
      return (
        <Loader2
          className="mt-0.5 h-4 w-4 animate-spin text-emerald-400"
          aria-hidden="true"
        />
      );
    case "SUCCESS":
      return (
        <CheckCircle2
          className="mt-0.5 h-4 w-4 text-emerald-500"
          aria-hidden="true"
        />
      );
    case "FAILED":
      return <XCircle className="mt-0.5 h-4 w-4 text-red-500" aria-hidden="true" />;
  }
}

function formatTime(isoTimestamp: string): string {
  try {
    return new Date(isoTimestamp).toLocaleTimeString("fr-FR");
  } catch {
    return isoTimestamp;
  }
}
