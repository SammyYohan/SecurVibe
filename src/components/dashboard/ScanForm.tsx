"use client";

import { KeyRound, Loader2, Play, Square, Ticket } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";
import { scanRequestSchema, type ScanRequest } from "@/lib/validation";
import { cn } from "@/lib/utils";

export type ScanFormProps = {
  isRunning: boolean;
  onStart: (input: ScanRequest) => void;
  onCancel: () => void;
};

type FieldErrors = {
  repoUrl: string | null;
  productionUrl: string | null;
};

const EMPTY_ERRORS: FieldErrors = { repoUrl: null, productionUrl: null };

export function ScanForm({ isRunning, onStart, onCancel }: ScanFormProps) {
  const { t } = useI18n();
  const [repoUrl, setRepoUrl] = useState("");
  const [productionUrl, setProductionUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [errors, setErrors] = useState<FieldErrors>(EMPTY_ERRORS);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (isRunning) return; // double soumission impossible pendant un audit

    const parsed = scanRequestSchema.safeParse({
      repoUrl: repoUrl.trim(),
      productionUrl: productionUrl.trim(),
      githubToken: githubToken.trim() === "" ? undefined : githubToken.trim(),
      licenseKey: licenseKey.trim() === "" ? undefined : licenseKey.trim(),
    });

    if (!parsed.success) {
      const nextErrors: FieldErrors = { ...EMPTY_ERRORS };
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "repoUrl" && nextErrors.repoUrl === null) {
          nextErrors.repoUrl = issue.message;
        } else if (field === "productionUrl" && nextErrors.productionUrl === null) {
          nextErrors.productionUrl = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }

    setErrors(EMPTY_ERRORS);
    onStart({
      repoUrl: parsed.data.repoUrl,
      productionUrl: parsed.data.productionUrl,
      githubToken: parsed.data.githubToken,
      licenseKey: parsed.data.licenseKey,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid grid-cols-1 items-start gap-5 rounded-2xl border border-line bg-card p-6 shadow-card sm:p-7 md:grid-cols-2"
    >
      <div className="flex flex-col gap-2">
        <label
          htmlFor="repo-url"
          className="text-sm font-semibold"
        >
          {t("dashboard.repoUrlLabel")}
        </label>
        <Input
          id="repo-url"
          name="repoUrl"
          value={repoUrl}
          onChange={(event) => setRepoUrl(event.target.value)}
          onKeyDown={() => setErrors(EMPTY_ERRORS)}
          placeholder="https://github.com/owner/repository"
          autoComplete="off"
          spellCheck={false}
          disabled={isRunning}
          aria-invalid={errors.repoUrl !== null}
          aria-describedby={
            errors.repoUrl !== null ? "repo-url-error" : undefined
          }
          className={cn("font-mono text-[13px]", errors.repoUrl !== null && "border-crit")}
        />
        {errors.repoUrl !== null ? (
          <p id="repo-url-error" className="text-sm font-medium text-crit">
            {errors.repoUrl}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="production-url"
          className="text-sm font-semibold"
        >
          {t("dashboard.productionUrlLabel")}
        </label>
        <Input
          id="production-url"
          name="productionUrl"
          value={productionUrl}
          onChange={(event) => setProductionUrl(event.target.value)}
          onKeyDown={() => setErrors(EMPTY_ERRORS)}
          placeholder="https://your-saas.com"
          autoComplete="off"
          spellCheck={false}
          disabled={isRunning}
          aria-invalid={errors.productionUrl !== null}
          aria-describedby={
            errors.productionUrl !== null ? "production-url-error" : undefined
          }
          className={cn("font-mono text-[13px]", errors.productionUrl !== null && "border-crit")}
        />
        {errors.productionUrl !== null ? (
          <p id="production-url-error" className="text-sm font-medium text-crit">
            {errors.productionUrl}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="github-token"
          className="flex items-center gap-1.5 text-sm font-semibold"
        >
          <KeyRound className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
          {t("dashboard.tokenLabel")}
        </label>
        <Input
          id="github-token"
          name="githubToken"
          type="password"
          value={githubToken}
          onChange={(event) => setGithubToken(event.target.value)}
          placeholder={t("dashboard.tokenPlaceholder")}
          autoComplete="off"
          spellCheck={false}
          disabled={isRunning}
          aria-describedby="github-token-hint"
          className="font-mono text-[13px]"
        />
        <p id="github-token-hint" className="text-sm leading-relaxed text-mute">
          {t("dashboard.tokenHint")}
        </p>
      </div>

      <div className="flex flex-col gap-2 md:col-span-2">
        <label
          htmlFor="license-key"
          className="flex items-center gap-1.5 text-sm font-semibold"
        >
          <Ticket className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
          {t("dashboard.licenseLabel")}
        </label>
        <Input
          id="license-key"
          name="licenseKey"
          value={licenseKey}
          onChange={(event) => setLicenseKey(event.target.value)}
          placeholder={t("dashboard.licensePlaceholder")}
          autoComplete="off"
          spellCheck={false}
          disabled={isRunning}
          aria-describedby="license-key-hint"
          className="font-mono text-[13px]"
        />
        <p id="license-key-hint" className="text-sm leading-relaxed text-mute">
          {t("dashboard.licenseHint")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 md:pt-7">
        <Button type="submit" disabled={isRunning}>
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
          {isRunning ? t("dashboard.running") : t("dashboard.start")}
        </Button>
        {isRunning ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            <Square className="h-4 w-4" aria-hidden="true" />
            {t("dashboard.cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
