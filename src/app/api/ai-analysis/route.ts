import { NextResponse } from "next/server";
import { z } from "zod";

import { findingSchema } from "@/types";

const requestSchema = z.object({
  findings: z.array(findingSchema).max(200),
  score: z.number().int().min(0).max(100).nullable(),
});

const responseSchema = z.object({
  analysis: z.string().min(1).max(12000),
  prompt: z.string().min(1).max(16000),
});

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Analyse IA indisponible." }, { status: 503 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Résultats d'audit invalides." }, { status: 400 });
  }

  const { findings, score } = parsed.data;
  const issues = findings.filter((finding) => finding.severity !== "OK");
  const report = issues.length === 0
    ? "Aucun constat critique ou avertissement n'a été détecté."
    : issues.map((finding) =>
      `[${finding.severity}] ${finding.file}\nProblème: ${finding.issue}\nContexte: ${finding.explanation}\nCorrectif proposé: ${finding.fix}`,
    ).join("\n\n");

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://guardvibe.app",
      "X-Title": "GuardVibe",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "Tu es un analyste senior en sécurité applicative. Réponds en français clair, sans inventer de vulnérabilité. Explique les priorités et génère une instruction autonome à copier-coller dans un agent IA de code. Ne demande jamais de secret.",
        },
        {
          role: "user",
          content: `Score GuardVibe: ${score ?? "non disponible"}/100\n\nConstats:\n${report}\n\nRetourne exactement deux sections Markdown: ## Analyse, puis ## Instruction à copier-coller. L'instruction doit demander à l'agent d'inspecter le dépôt, corriger uniquement les constats confirmés, préserver les comportements existants, ajouter ou mettre à jour les tests pertinents, et résumer les fichiers modifiés.`,
        },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: "OpenRouter n'a pas pu analyser ce rapport." }, { status: 502 });
  }

  const payload = await upstream.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null;
  const analysis = payload?.choices?.[0]?.message?.content?.trim();
  if (!analysis) {
    return NextResponse.json({ error: "La réponse de l'IA est vide." }, { status: 502 });
  }

  const generatedPrompt = `Tu es un agent IA de développement chargé de corriger les constats de sécurité confirmés dans ce dépôt.\n\n${analysis}`;
  const result = responseSchema.parse({ analysis, prompt: generatedPrompt });
  return NextResponse.json(result);
}
