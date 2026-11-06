import { z } from "zod";

// ---------------------------------------------------------------------------
// Schémas de base
// ---------------------------------------------------------------------------

export const severitySchema = z.enum(["CRITICAL", "WARNING", "OK"]);
export type Severity = z.infer<typeof severitySchema>;

export const findingSchema = z.object({
  id: z.string().min(1),
  file: z.string().min(1),
  severity: severitySchema,
  issue: z.string().min(1),
  explanation: z.string().min(1),
  fix: z.string().min(1),
});
export type Finding = z.infer<typeof findingSchema>;

export const stepStatusSchema = z.enum(["PENDING", "RUNNING", "SUCCESS", "FAILED"]);
export type StepStatus = z.infer<typeof stepStatusSchema>;

const isoTimestampSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
    "ISO 8601 timestamp expected.",
  );

export const testStepSchema = z.object({
  id: z.number().int().min(1),
  label: z.string().min(1),
  status: stepStatusSchema,
  timestamp: isoTimestampSchema,
  detail: z.string().min(1).optional(),
});
export type TestStep = z.infer<typeof testStepSchema>;

export const scanErrorCodeSchema = z.enum([
  "INVALID_URL",
  "REPO_NOT_FOUND",
  "INTERNAL_ERROR",
]);
export type ScanErrorCode = z.infer<typeof scanErrorCodeSchema>;

// ---------------------------------------------------------------------------
// Flux d'événements (NDJSON) — contrat stable entre la route API et le client
// ---------------------------------------------------------------------------

export const scanEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("scan_started"),
    totalFiles: z.number().int().min(0),
  }),
  z.object({
    type: z.literal("progress"),
    value: z.number().min(0).max(100),
  }),
  z.object({
    type: z.literal("finding"),
    finding: findingSchema,
  }),
  z.object({
    type: z.literal("test_step"),
    step: testStepSchema,
  }),
  z.object({
    type: z.literal("done"),
    score: z.number().int().min(0).max(100),
    mode: z.enum(["demo", "real"]),
  }),
  z.object({
    type: z.literal("error"),
    code: scanErrorCodeSchema,
    message: z.string().min(1),
  }),
]);
export type ScanEvent = z.infer<typeof scanEventSchema>;

export type ScanErrorEvent = Extract<ScanEvent, { type: "error" }>;

/** Garde de type pour valider une ligne du flux avant toute utilisation. */
export function isScanEvent(value: unknown): value is ScanEvent {
  return scanEventSchema.safeParse(value).success;
}

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

// ---------------------------------------------------------------------------
// État du tableau de bord (client) — source unique partagée par les composants
// ---------------------------------------------------------------------------

export const dashboardStatusSchema = z.enum([
  "idle",
  "running",
  "done",
  "error",
  "cancelled",
]);
export type DashboardStatus = z.infer<typeof dashboardStatusSchema>;

export const scanPhaseSchema = z.enum(["scan", "site"]);
export type ScanPhase = z.infer<typeof scanPhaseSchema>;

/** Plage de progression allouée à un service dans le flux global (0-100). */
export type ProgressRange = { from: number; to: number };

