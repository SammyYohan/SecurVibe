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
    return NextResponse.json({ error: "AI analysis is unavailable." }, { status: 503 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid audit results." }, { status: 400 });
  }

  const { findings, score } = parsed.data;
  const issues = findings.filter((finding) => finding.severity !== "OK");
  const report = issues.length === 0
    ? "No critical or warning finding was detected."
    : issues.map((finding) =>
      `[${finding.severity}] ${finding.file}\nIssue: ${finding.issue}\nContext: ${finding.explanation}\nProposed fix: ${finding.fix}`,
    ).join("\n\n");

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://securvibe.app",
      "X-Title": "SecurVibe",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You are a senior application security analyst. Answer in clear English, never invent a vulnerability. Explain priorities and produce one autonomous instruction to copy-paste into an AI coding agent. Never ask for a secret.",
        },
        {
          role: "user",
          content: `SecurVibe score: ${score ?? "unavailable"}/100\n\nFindings:\n${report}\n\nReturn exactly two Markdown sections: ## Analysis, then ## Copy-paste instruction. The instruction must tell the agent to inspect the repository, fix only the confirmed findings, preserve existing behavior, add or update relevant tests, and summarize the changed files.`,
        },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: "OpenRouter could not analyze this report." }, { status: 502 });
  }

  const payload = await upstream.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null;
  const analysis = payload?.choices?.[0]?.message?.content?.trim();
  if (!analysis) {
    return NextResponse.json({ error: "The AI response is empty." }, { status: 502 });
  }

  const generatedPrompt = `You are an AI development agent tasked with fixing the confirmed security findings in this repository.\n\n${analysis}`;
  const result = responseSchema.parse({ analysis, prompt: generatedPrompt });
  return NextResponse.json(result);
}
