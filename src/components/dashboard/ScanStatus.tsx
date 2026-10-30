"use client";

import {
  Ban,
  CheckCircle2,
  CircleDashed,
  Loader2,
  XCircle,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { useI18n } from "@/lib/i18n/client";
import { getScoreTier, type ScoreTier } from "@/lib/score";
import { cn } from "@/lib/utils";
import type { DashboardStatus, ScanPhase } from "@/types";
import { Progress } from "@/components/ui/progress";

export type ScanStatusProps = {
  status: DashboardStatus;
  phase: ScanPhase;
  progress: number;
  /** Score affiché : final du serveur, provisoire, ou null ("--"). */
  score: number | null;
  finalScore: boolean;
  partial: boolean;
  errorMessage: string | null;
};

const TIER_TEXT_COLOR: Record<ScoreTier, string> = {
  good: "text-emerald-400",
  medium: "text-amber-400",
  bad: "text-red-400",
};

export function ScanStatus({
  status,
  phase,
  progress,
  score,
  finalScore,
  partial,
  errorMessage,
}: ScanStatusProps) {
  const { t } = useI18n();
  const tier: ScoreTier | null = score === null ? null : getScoreTier(score);
  const animatedScore = useAnimatedNumber(score ?? 0);

  const statusLabel = useMemo(() => {
    switch (status) {
      case "idle":
        return t("dashboard.statusIdle");
      case "running":
        return phase === "scan" ? t("dashboard.statusScan") : t("dashboard.statusSite");
      case "done":
        return t("dashboard.statusDone");
      case "error":
        return t("dashboard.statusError");
      case "cancelled":
        return t("dashboard.statusCancelled");
    }
  }, [status, phase, t]);

  const statusIcon = useMemo((): ReactNode => {
    switch (status) {
      case "idle":
        return (
          <CircleDashed
            className="h-4 w-4 text-slate-500"
            aria-hidden="true"
          />
        );
      case "running":
        return (
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" aria-hidden="true" />
        );
      case "done":
        return (
          <CheckCircle2
            className="h-4 w-4 text-emerald-400"
            aria-hidden="true"
          />
        );
      case "error":
        return (
          <XCircle className="h-4 w-4 text-red-400" aria-hidden="true" />
        );
      case "cancelled":
        return <Ban className="h-4 w-4 text-slate-500" aria-hidden="true" />;
    }
  }, [status]);

  // Région sr-only : annonce le début, la fin et les erreurs,
  // sans répéter chaque événement du flux.
  const liveAnnouncement = useMemo(() => {
    if (status === "running" && phase === "scan") {
      return t("dashboard.liveRegionStart");
    }
    if (status === "running" && phase === "site") {
      return t("dashboard.liveRegionSite");
    }
    if (status === "done") {
      return t("dashboard.liveRegionDone", { score: String(score ?? 0) });
    }
    if (status === "error") {
      return t("dashboard.liveRegionError", { message: errorMessage ?? "" }).trim();
    }
    if (status === "cancelled") {
      return t("dashboard.liveRegionCancel");
    }
    return "";
  }, [status, phase, score, errorMessage, t]);

  return (
    <Card className="relative overflow-hidden">
      {/* Halo discret derrière le score (dégradé radial léger). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(40%_70%_at_80%_50%,rgba(16,185,129,0.14),transparent_75%)]"
      />

      <CardContent className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center gap-2">
            {statusIcon}
            <p className="text-sm font-medium text-slate-300">
              {statusLabel}
            </p>
            <Badge variant="neutral" className="ml-auto md:ml-4">
              {phase === "site" ? t("dashboard.phaseSite") : t("dashboard.phaseScan")}
            </Badge>
          </div>

          <Progress value={progress} ariaLabel={t("dashboard.progressLabel")} />

          <p className="text-xs tabular-nums text-slate-500">
            {Math.round(progress)}&nbsp;%&nbsp;/&nbsp;100&nbsp;%
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {t("dashboard.scoreLabel")}
          </span>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "text-7xl font-bold tabular-nums tracking-tight sm:text-8xl",
                tier === null ? "text-slate-100" : TIER_TEXT_COLOR[tier],
              )}
            >
              {score === null ? "--" : animatedScore}
            </span>
            {partial && score !== null ? (
              <span className="text-base text-slate-400">{t("dashboard.partial")}</span>
            ) : null}
            {finalScore && score !== null ? (
              <span className="text-base text-slate-500">/ 100</span>
            ) : null}
          </div>
        </div>
      </CardContent>

      <p role="status" aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </p>
    </Card>
  );
}
