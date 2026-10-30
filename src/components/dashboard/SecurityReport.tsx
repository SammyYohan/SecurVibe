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
import { useI18n } from "@/lib/i18n/client";
import type { Finding, Severity } from "@/types";

export type SecurityReportProps = {
  findings: Finding[];
};

const SEVERITY_BADGE_VARIANT: Record<Severity, BadgeVariant> = {
  CRITICAL: "critical",
  WARNING: "warning",
  OK: "success",
};

export function SecurityReport({ findings }: SecurityReportProps) {
  const { t } = useI18n();
  const critical = findings.filter((f) => f.severity === "CRITICAL");
  const warning = findings.filter((f) => f.severity === "WARNING");
  const ok = findings.filter((f) => f.severity === "OK");

  const severityLabel: Record<Severity, string> = {
    CRITICAL: t("severities.critical"),
    WARNING: t("severities.warning"),
    OK: t("severities.ok"),
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{t("dashboard.reportTitle")}</CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="critical">
              {t("dashboard.criticalCount", { count: critical.length })}
            </Badge>
            <Badge variant="warning">
              {t("dashboard.warningCount", { count: warning.length })}
            </Badge>
            <Badge variant="success">
              {t("dashboard.okCount", { count: ok.length })}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {findings.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {t("dashboard.emptyReport")}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-800/70">
            {[...critical, ...warning].map((finding) => (
              <FindingItem
                key={finding.id}
                finding={finding}
                label={severityLabel[finding.severity]}
              />
            ))}
          </ul>
        )}

        {ok.length > 0 ? (
          <div className="mt-6 border-t border-slate-800/70 pt-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
              {t("dashboard.okSection")}
            </p>
            <ul className="flex flex-col divide-y divide-slate-800/50 opacity-80">
              {ok.map((finding) => (
                <FindingItem
                  key={finding.id}
                  finding={finding}
                  label={severityLabel[finding.severity]}
                />
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FindingItem({ finding, label }: { finding: Finding; label: string }) {
  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={SEVERITY_BADGE_VARIANT[finding.severity]}>
          {label}
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
