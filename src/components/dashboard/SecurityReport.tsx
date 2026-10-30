"use client";

import { Check, Copy, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Badge,
  type BadgeVariant,
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

/**
 * Génère la liste de correctifs à coller dans l'assistant de code de
 * l'utilisateur (Cursor, Claude Code, Copilot…). Les contrôles réussis
 * (OK) sont volontairement exclus : rien à corriger.
 */
export function buildFixListMarkdown(
  critical: readonly Finding[],
  warning: readonly Finding[],
): string {
  const lines: string[] = [
    "# Security fix checklist (GuardVibe audit)",
    "",
    "Generated from a real scan. Fix each item with your AI coding assistant (Cursor, Claude Code, Copilot…), then re-run the audit to verify.",
  ];
  const section = (title: string, items: readonly Finding[]): void => {
    if (items.length === 0) return;
    lines.push("", `## ${title}`, "");
    for (const finding of items) {
      lines.push(
        `- [ ] \`${finding.file}\` — ${finding.issue}`,
        `  Fix: ${finding.fix.trim().replace(/\n/g, "\n  ")}`,
      );
    }
  };
  section("Critical", critical);
  section("Warnings", warning);
  lines.push("");
  return lines.join("\n");
}

/** Clipboard API quand disponible (contexte sécurisé), repli executCommand. */
async function copyTextToClipboard(text: string): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard !== undefined
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // On tente le repli ci-dessous.
    }
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "true");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

export function SecurityReport({ findings }: SecurityReportProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  const critical = findings.filter((f) => f.severity === "CRITICAL");
  const warning = findings.filter((f) => f.severity === "WARNING");
  const ok = findings.filter((f) => f.severity === "OK");

  useEffect(
    () => () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    },
    [],
  );

  const handleCopyList = useCallback(async (): Promise<void> => {
    const succeeded = await copyTextToClipboard(
      buildFixListMarkdown(critical, warning),
    );
    if (!succeeded) return;
    setCopied(true);
    copiedTimerRef.current = window.setTimeout(() => {
      setCopied(false);
    }, 2000);
  }, [critical, warning]);

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
        {critical.length > 0 || warning.length > 0 ? (
          <div className="mb-3 flex">
            <Button
              type="button"
              variant="outline"
              onClick={(): void => {
                void handleCopyList();
              }}
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copied ? t("dashboard.copied") : t("dashboard.copyList")}
            </Button>
          </div>
        ) : null}

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
