"use client";

import { Loader2, Play, Square } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [repoUrl, setRepoUrl] = useState("");
  const [productionUrl, setProductionUrl] = useState("");
  const [errors, setErrors] = useState<FieldErrors>(EMPTY_ERRORS);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (isRunning) return; // double soumission impossible pendant un scan

    const parsed = scanRequestSchema.safeParse({
      repoUrl: repoUrl.trim(),
      productionUrl: productionUrl.trim() === "" ? undefined : productionUrl.trim(),
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
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,7fr)_minmax(0,6fr)_auto]"
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="repo-url"
          className="text-sm font-medium text-slate-300"
        >
          URL du dépôt GitHub
        </label>
        <Input
          id="repo-url"
          name="repoUrl"
          value={repoUrl}
          onChange={(event) => setRepoUrl(event.target.value)}
          onKeyDown={() => setErrors(EMPTY_ERRORS)}
          placeholder="https://github.com/utilisateur/depot"
          autoComplete="off"
          spellCheck={false}
          disabled={isRunning}
          aria-invalid={errors.repoUrl !== null}
          aria-describedby={
            errors.repoUrl !== null ? "repo-url-error" : undefined
          }
          className={cn(errors.repoUrl !== null && "border-red-800/80")}
        />
        {errors.repoUrl !== null ? (
          <p id="repo-url-error" className="text-xs text-red-400">
            {errors.repoUrl}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="production-url"
          className="text-sm font-medium text-slate-300"
        >
          URL de production{" "}
          <span className="font-normal text-slate-500">(optionnel)</span>
        </label>
        <Input
          id="production-url"
          name="productionUrl"
          value={productionUrl}
          onChange={(event) => setProductionUrl(event.target.value)}
          onKeyDown={() => setErrors(EMPTY_ERRORS)}
          placeholder="https://mon-saas.com"
          autoComplete="off"
          spellCheck={false}
          disabled={isRunning}
          aria-invalid={errors.productionUrl !== null}
          aria-describedby={
            errors.productionUrl !== null ? "production-url-error" : undefined
          }
          className={cn(errors.productionUrl !== null && "border-red-800/80")}
        />
        {errors.productionUrl !== null ? (
          <p id="production-url-error" className="text-xs text-red-400">
            {errors.productionUrl}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 md:pt-[26px]">
        <Button type="submit" disabled={isRunning}>
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
          Lancer l&apos;Analyse
        </Button>
        {isRunning ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            <Square className="h-4 w-4" aria-hidden="true" />
            Annuler
          </Button>
        ) : null}
      </div>
    </form>
  );
}
