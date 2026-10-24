import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "../../../lib/rate-limit";
import { EVIDENCE_RULES } from "../../../lib/assistant-grounding.mjs";

import { PRACTICE_DATA, practiceDenialSummary } from "../../../lib/practice-scenario.mjs";
import { answerPracticeDenials } from "../../../lib/practice-answers.mjs";
import { answerPracticeRevenue } from "../../../lib/practice-revenue.mjs";

const anthropic = new Anthropic();

// The public synthetic scenario is shared with the page. Only credentials and
// model instructions are server-side; the client supplies the question alone.

function buildDataSummary(d) {
  const lines = [
    `Practice: ${d.practiceName}`,
    `Providers: ${d.providers.join(", ")}`,
    `Payers: ${d.payers.join(", ")}`,
    `Period: Jan 2025 - Dec 2025`,
    ``,
    `PRECOMPUTED DENIAL COUNTS (use these values instead of mental arithmetic):`,
    JSON.stringify(practiceDenialSummary()),
    `Monthly Performance Data:`,
  ];

  d.months.forEach((m) => {
    lines.push(`\n--- ${m.month} ${m.year} ---`);
    Object.entries(m.providers).forEach(([prov, data]) => {
      lines.push(`${prov}: ${data.patients} patients, $${data.revenue.toLocaleString()} revenue, $${data.collections.toLocaleString()} collected, ${data.denials} denials, ${data.noShows} no-shows, $${data.avgReimb} avg reimb`);
      lines.push(`  Procedures: ${Object.entries(data.procedures).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
      lines.push(`  Payer Mix: ${Object.entries(data.payerMix).map(([k, v]) => `${k}: $${v.toLocaleString()}`).join(", ")}`);
    });
  });
  return lines.join("\n");
}

const DATA_SUMMARY = buildDataSummary(PRACTICE_DATA);

const SYSTEM_PROMPT = `You are a healthcare practice analytics assistant for "${PRACTICE_DATA.practiceName}", a multi-provider dermatology practice. You answer questions about practice performance using the data provided. Be concise, specific, and use exact numbers. Format currency with $ and commas. When comparing providers, use their last names only. If asked to "show" data, describe the key numbers clearly. ${EVIDENCE_RULES}
This is a synthetic practice dataset for calendar year 2025. No denial-reason, claim-count, stage-history, clinical, or causal evidence is included. Denials are counts; do not invent a denial rate without a claim denominator.

SCOPE & REFUSAL POLICY:
You are scoped to aggregate practice performance only. If asked about a specific patient (by name, MRN, patient ID, or any other identifier), about patient-level clinical details (appointments, diagnoses, treatment plans, chart contents), or anything else that would require patient-identifiable access, you must decline. Briefly explain that patient-level queries require authenticated EHR access with role-based permissions and audit logging — none of which are part of this analytics layer — and then offer to answer an aggregate-level version of the question instead.

PRACTICE DATA:
${DATA_SUMMARY}`;

// ═══════════════════════════════════════════════════════════════
// API HANDLER
// ═══════════════════════════════════════════════════════════════

export async function POST(request) {
  const rate = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  try {
    const { question } = await request.json();

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "Missing or invalid 'question' field" }, { status: 400 });
    }
    if (question.length > 2000) {
      return NextResponse.json({ error: "Question exceeds 2000-character limit" }, { status: 400 });
    }

    const calculated = answerPracticeRevenue(question) || answerPracticeDenials(question);
    if (calculated) return NextResponse.json({ content: [{ type: "text", text: calculated }], source: "scenario-calculation" });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: question }],
    });
    return NextResponse.json(message);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error("Anthropic API error:", error.status, error.message);
      return NextResponse.json({ error: "Upstream model request failed" }, { status: 502 });
    }
    if (error?.message?.includes("Could not resolve authentication")) {
      console.error("AskPractice route error: ANTHROPIC_API_KEY not set in this environment");
      return NextResponse.json({ error: "AI service not configured for this environment" }, { status: 503 });
    }
    console.error("AskPractice route error:", error?.constructor?.name, "-", error?.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
