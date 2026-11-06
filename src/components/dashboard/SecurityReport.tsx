"use client";

import { Check, Copy, Loader2, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { Finding, Severity } from "@/types";

export type SecurityReportProps = {
  findings: Finding[];
  score: number | null;
};

const SEVERITY_PANEL: Record<Severity, string> = {
  CRITICAL: "bg-crit-bg",
  WARNING: "bg-warn-bg",
  OK: "border border-line",
};

const SEVERITY_ICON_COLOR: Record<Severity, string> = {
  CRITICAL: "text-crit",
  WARNING: "text-warn",
  OK: "text-accent",
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

export function SecurityReport({ findings, score }: SecurityReportProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [aiResult, setAiResult] = useState<{ analysis: string; prompt: string } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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

  const handleAiAnalysis = useCallback(async (): Promise<void> => {
    setIsAnalyzing(true);
    setAiError(null);
    try {
      const response = await fetch("/api/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findings, score }),
      });
      const payload = await response.json() as { analysis?: string; prompt?: string; error?: string };
      if (!response.ok || payload.analysis === undefined || payload.prompt === undefined) {
        throw new Error(payload.error ?? t("dashboard.aiError"));
      }
      setAiResult({ analysis: payload.analysis, prompt: payload.prompt });
    } catch (error) {
      setAiError(error instanceof Error ? error.message : t("dashboard.aiError"));
    } finally {
      setIsAnalyzing(false);
    }
  }, [findings, score, t]);

  const handleCopyPrompt = useCallback(async (): Promise<void> => {
    if (aiResult === null) return;
    await copyTextToClipboard(aiResult.prompt);
  }, [aiResult]);

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
          <div className="mb-5 flex">
            <Button
              type="button"
              variant="outline"
              onClick={(): void => {
                void handleCopyList();
              }}
            >
              {copied ? (
                <Check className="h-4 w-4 text-accent" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copied ? t("dashboard.copied") : t("dashboard.copyList")}
            </Button>
          </div>
        ) : null}

        {findings.length > 0 ? (
          <div className="mb-5 rounded-2xl border border-line bg-tint p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-ink">{t("dashboard.aiTitle")}</p>
                <p className="mt-1 text-sm leading-relaxed text-mute">{t("dashboard.aiDescription")}</p>
              </div>
              <Button type="button" variant="outline" onClick={() => void handleAiAnalysis()} disabled={isAnalyzing}>
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                {isAnalyzing ? t("dashboard.aiRunning") : t("dashboard.aiAction")}
              </Button>
            </div>
            {aiError !== null ? <p role="alert" className="mt-3 text-sm font-medium text-crit">{aiError}</p> : null}
            {aiResult !== null ? (
              <div className="mt-4 grid gap-4 border-t border-line pt-4">
                <div>
                  <p className="mb-2 text-sm font-semibold text-ink">{t("dashboard.aiAnalysis")}</p>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-card p-4 text-sm leading-relaxed text-ink">{aiResult.analysis}</pre>
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{t("dashboard.aiPrompt")}</p>
                    <Button type="button" variant="ghost" onClick={() => void handleCopyPrompt()}>{t("dashboard.aiCopy")}</Button>
                  </div>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-card p-4 text-sm leading-relaxed text-ink">{aiResult.prompt}</pre>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {findings.length === 0 ? (
          <p className="py-10 text-center text-sm text-mute">
            {t("dashboard.emptyReport")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
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
          <div className="mt-7 border-t border-line pt-5">
            <p className="mb-3 text-sm font-semibold text-mute">
              {t("dashboard.okSection")}
            </p>
            <ul className="flex flex-col gap-2">
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
  const Icon = finding.severity === "OK" ? ShieldCheck : ShieldAlert;
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-2xl p-5",
        SEVERITY_PANEL[finding.severity],
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge
          variant={SEVERITY_BADGE_VARIANT[finding.severity]}
          className={finding.severity === "OK" ? undefined : "bg-white"}
        >
          {label}
        </Badge>
        <code className="font-mono text-[13px] font-semibold text-ink">
          {finding.file}
        </code>
      </div>

      <div className="flex items-start gap-2.5">
        <Icon
          className={cn("mt-0.5 h-4 w-4 shrink-0", SEVERITY_ICON_COLOR[finding.severity])}
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-col gap-2">
          <p className="font-bold">{finding.issue}</p>
          <p className="text-sm leading-relaxed text-mute">
            {finding.explanation}
          </p>
          <code className="mt-1 block overflow-x-auto whitespace-pre rounded-xl border border-line bg-white p-3.5 font-mono text-xs leading-relaxed text-ink">
            {finding.fix}
          </code>
        </div>
      </div>
    </li>
  );
}
