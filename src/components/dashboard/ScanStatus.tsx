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
  /** Displayed score: server-final, provisional, or null ("--"). */
  score: number | null;
  finalScore: boolean;
  partial: boolean;
  errorMessage: string | null;
  /** Score of the previous audit on the same target (local history), or null. */
  previousScore: number | null;
};

const TIER_TEXT_COLOR: Record<ScoreTier, string> = {
  good: "text-accent",
  medium: "text-warn",
  bad: "text-crit",
};

/** Score ring: radius and circumference of the SVG circle (viewBox 168). */
const RING_RADIUS = 72;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ScanStatus({
  status,
  phase,
  progress,
  score,
  finalScore,
  partial,
  errorMessage,
  previousScore,
}: ScanStatusProps) {
  const { t } = useI18n();
  const tier: ScoreTier | null = score === null ? null : getScoreTier(score);
  const animatedScore = useAnimatedNumber(score ?? 0);

  // Trend only across final scores of the same target.
  const delta =
    finalScore && score !== null && previousScore !== null
      ? score - previousScore
      : null;
  const trend: "up" | "down" | "flat" | null =
    delta === null
      ? null
      : delta > 0
        ? "up"
        : delta < 0
          ? "down"
          : "flat";
  const trendText =
    delta === null
      ? null
      : delta > 0
        ? t("dashboard.trendUp", { delta })
        : delta < 0
          ? t("dashboard.trendDown", { delta: Math.abs(delta) })
          : t("dashboard.trendFlat");

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
            className="h-4 w-4 text-faint"
            aria-hidden="true"
          />
        );
      case "running":
        return (
          <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
        );
      case "done":
        return (
          <CheckCircle2
            className="h-4 w-4 text-accent"
            aria-hidden="true"
          />
        );
      case "error":
        return (
          <XCircle className="h-4 w-4 text-crit" aria-hidden="true" />
        );
      case "cancelled":
        return <Ban className="h-4 w-4 text-faint" aria-hidden="true" />;
    }
  }, [status]);

  // Screen-reader-only live region: announces start, end and errors,
  // without repeating every stream event.
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

  const ringLength =
    score === null ? 0 : (RING_CIRCUMFERENCE * Math.min(100, animatedScore)) / 100;

  return (
    <Card>
      <CardContent className="flex flex-col gap-8 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {statusIcon}
            <p className="text-base font-bold">{statusLabel}</p>
            <Badge variant="neutral">
              {phase === "site" ? t("dashboard.phaseSite") : t("dashboard.phaseScan")}
            </Badge>
          </div>

          <Progress value={progress} ariaLabel={t("dashboard.progressLabel")} />

          <p className="text-sm tabular-nums text-mute">
            {Math.round(progress)}&nbsp;%&nbsp;/&nbsp;100&nbsp;%
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <span className="text-sm font-semibold text-mute">
            {t("dashboard.scoreLabel")}
          </span>
          <div className="relative h-44 w-44">
            <svg viewBox="0 0 168 168" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="84" cy="84" r={RING_RADIUS} fill="none" strokeWidth="12" className="stroke-line" />
              <circle
                cx="84"
                cy="84"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${ringLength} ${RING_CIRCUMFERENCE}`}
                className={cn("stroke-current", tier === null ? "text-line" : TIER_TEXT_COLOR[tier])}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={cn(
                  "text-6xl font-extrabold tabular-nums tracking-[-0.04em]",
                  tier === null ? "text-faint" : TIER_TEXT_COLOR[tier],
                )}
              >
                {score === null ? "--" : animatedScore}
              </span>
              {partial && score !== null ? (
                <span className="text-sm text-mute">{t("dashboard.partial")}</span>
              ) : null}
              {finalScore && score !== null ? (
                <span className="text-sm text-mute">/ 100</span>
              ) : null}
            </div>
          </div>
          {trendText !== null ? (
            <Badge
              variant={trend === "down" ? "critical" : trend === "up" ? "success" : "neutral"}
              className="h-7 px-3"
            >
              {trendText}
            </Badge>
          ) : null}
        </div>
      </CardContent>

      <p role="status" aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </p>
    </Card>
  );
}
