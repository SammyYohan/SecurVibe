"use client";

import { ShieldAlert } from "lucide-react";

import {
  Badge,
  type BadgeVariant,
} from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Finding, Severity } from "@/types";

export type SecurityReportProps = {
  findings: Finding[];
};

const EMPTY_MESSAGE = "Lancez une analyse pour voir les résultats.";

const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: "Critique",
  WARNING: "Avertissement",
  OK: "OK",
};

const SEVERITY_BADGE_VARIANT: Record<Severity, BadgeVariant> = {
  CRITICAL: "critical",
  WARNING: "warning",
  OK: "success",
};

export function SecurityReport({ findings }: SecurityReportProps) {
  const critical = findings.filter((f) => f.severity === "CRITICAL");
  const warning = findings.filter((f) => f.severity === "WARNING");
  const ok = findings.filter((f) => f.severity === "OK");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Failles de sécurité</CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="critical">
              {critical.length} critique{critical.length > 1 ? "s" : ""}
            </Badge>
            <Badge variant="warning">
              {warning.length} avertissement{warning.length > 1 ? "s" : ""}
            </Badge>
            <Badge variant="success">{ok.length} contrôles</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {findings.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {EMPTY_MESSAGE}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-800/70">
            {[...critical, ...warning].map((finding) => (
              <FindingItem key={finding.id} finding={finding} />
            ))}
          </ul>
        )}

        {ok.length > 0 ? (
          <div className="mt-6 border-t border-slate-800/70 pt-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
              Contrôles réussis
            </p>
            <ul className="flex flex-col divide-y divide-slate-800/50 opacity-80">
              {ok.map((finding) => (
                <FindingItem key={finding.id} finding={finding} />
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FindingItem({ finding }: { finding: Finding }) {
  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={SEVERITY_BADGE_VARIANT[finding.severity]}>
          {SEVERITY_LABEL[finding.severity]}
        </Badge>
        <code className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-xs text-slate-400">
          {finding.file}
        </code>
      </div>

      <div className="flex items-start gap-2">
        <ShieldAlert
          className={
            finding.severity === "OK"
              ? "mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
              : "mt-0.5 h-4 w-4 shrink-0 text-red-400"
          }
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="font-semibold text-slate-100">{finding.issue}</p>
          <p className="text-sm leading-relaxed text-slate-400">
            {finding.explanation}
          </p>
          <code className="mt-1 block overflow-x-auto whitespace-pre rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-300">
            {finding.fix}
          </code>
        </div>
      </div>
    </li>
  );
}
