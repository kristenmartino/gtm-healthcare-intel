import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "../../../lib/rate-limit";

const anthropic = new Anthropic();

// ═══════════════════════════════════════════════════════════════
// PRACTICE DATA — Server-side only. Never accepted from the client.
// In production this would be a warehouse query scoped to the
// authenticated practice and reporting period.
// ═══════════════════════════════════════════════════════════════

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 11) % 2147483647; return s / 2147483647; };
}

function generatePracticeData() {
  const r = seededRandom(42);
  const rand = (min, max) => Math.round((r() * (max - min) + min) * 100) / 100;

  // Providers intentionally use different surnames than the GTM sales reps so
  // a careful reader doesn't conflate the two personas.
  const providers = ["Dr. Anya Lin", "Dr. Priya Shah", "Dr. Maya Singh", "Dr. Devon Brooks", "Dr. Hana Yamamoto"];
  const payers = ["Blue Cross", "Aetna", "UnitedHealth", "Medicare", "Cigna", "Self-Pay"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const months = [];

  for (let m = 0; m < 12; m++) {
    const monthData = { month: monthNames[m], year: 2025, providers: {} };
    providers.forEach((p) => {
      const base = p.includes("Lin") ? 1.1 : p.includes("Shah") ? 0.95 : p.includes("Singh") ? 1.05 : p.includes("Brooks") ? 0.88 : 1.0;
      const seasonal = 1 + 0.08 * Math.sin((m - 3) * Math.PI / 6);
      monthData.providers[p] = {
        patients: Math.round(rand(140, 210) * base * seasonal),
        revenue: Math.round(rand(85000, 145000) * base * seasonal),
        collections: Math.round(rand(78000, 135000) * base * seasonal),
        denials: Math.round(rand(8, 28) * (2 - base)),
        noShows: Math.round(rand(6, 18) / base),
        avgReimb: Math.round(rand(245, 380) * base),
        procedures: {
          "Mohs Surgery": Math.round(rand(8, 22) * base),
          "Biopsy": Math.round(rand(35, 65) * base * seasonal),
          "Lesion Destruction": Math.round(rand(20, 45) * base),
          "E&M Visit": Math.round(rand(80, 140) * base * seasonal),
          "Cosmetic Consult": Math.round(rand(5, 18) * base),
        },
        payerMix: {},
      };
      let remaining = monthData.providers[p].revenue;
      payers.forEach((pay, i) => {
        const share = pay === "Medicare" ? rand(0.2, 0.3) : pay === "Blue Cross" ? rand(0.18, 0.25) : pay === "Self-Pay" ? rand(0.05, 0.1) : rand(0.08, 0.18);
        const amt = i === payers.length - 1 ? remaining : Math.round(remaining * share);
        monthData.providers[p].payerMix[pay] = Math.min(amt, remaining);
        remaining -= monthData.providers[p].payerMix[pay];
      });
    });
    months.push(monthData);
  }

  return { practiceName: "Advanced Dermatology Associates", providers, payers, months };
}

function buildDataSummary(d) {
  const lines = [
    `Practice: ${d.practiceName}`,
    `Providers: ${d.providers.join(", ")}`,
    `Payers: ${d.payers.join(", ")}`,
    `Period: Jan 2025 - Dec 2025`,
    ``,
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

const PRACTICE_DATA = generatePracticeData();
const DATA_SUMMARY = buildDataSummary(PRACTICE_DATA);

const SYSTEM_PROMPT = `You are a healthcare practice analytics assistant for "${PRACTICE_DATA.practiceName}", a multi-provider dermatology practice. You answer questions about practice performance using the data provided. Be concise, specific, and use exact numbers. Format currency with $ and commas. When comparing providers, use their last names only. If asked to "show" data, describe the key numbers clearly. Always end with one actionable insight or recommendation.

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
