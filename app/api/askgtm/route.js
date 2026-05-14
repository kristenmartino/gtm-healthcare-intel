import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "../../../lib/rate-limit";

const anthropic = new Anthropic();

// ═══════════════════════════════════════════════════════════════
// GTM DATA — Server-side only. Never sent to the client.
// In production, this would be generated dynamically from a
// Salesforce/warehouse query based on the user's permissions
// and the reporting period they're querying.
// ═══════════════════════════════════════════════════════════════

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 11) % 2147483647; return s / 2147483647; };
}

function generateGTMData() {
  const r = seededRandom(42);
  const rand = (min, max) => Math.round((r() * (max - min) + min) * 100) / 100;

  const reps = ["Sarah Chen", "Marcus Rivera", "Emily Okafor", "James Patel", "Lisa Wong", "David Kim"];
  const specialties = ["Dermatology", "Orthopedics", "Gastroenterology", "Ophthalmology"];
  const sources = ["Inbound", "Outbound", "Referral", "Trade Show", "Partner"];
  const stages = ["Prospecting", "Qualified", "Demo Scheduled", "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost"];
  const quarters = ["Q3 2024", "Q4 2024", "Q1 2025"];

  const deals = [];
  for (let i = 0; i < 280; i++) {
    const rep = reps[Math.floor(r() * reps.length)];
    const spec = specialties[Math.floor(r() * specialties.length)];
    const src = sources[Math.floor(r() * sources.length)];
    const q = quarters[Math.floor(r() * quarters.length)];
    const stageIdx = Math.floor(r() * stages.length);
    const won = stages[stageIdx] === "Closed Won";
    const lost = stages[stageIdx] === "Closed Lost";
    const acv = Math.round(rand(8000, 185000));
    const daysInPipeline = Math.round(rand(12, 95));
    deals.push({ rep, specialty: spec, source: src, quarter: q, stage: stages[stageIdx], won, lost, acv, daysInPipeline, practiceSize: ["Solo", "Small", "Medium", "Large"][Math.floor(r() * 4)] });
  }

  const marketing = quarters.map(q => ({
    quarter: q,
    mqls: Math.round(rand(320, 580)),
    sqls: Math.round(rand(140, 260)),
    demosBooked: Math.round(rand(80, 160)),
    pipelineGenerated: Math.round(rand(1200000, 2800000)),
    spend: Math.round(rand(180000, 350000)),
  }));

  const churn = specialties.map(s => ({
    specialty: s,
    customersStart: Math.round(rand(120, 280)),
    churned: Math.round(rand(5, 22)),
    expanded: Math.round(rand(8, 35)),
    nrr: rand(101, 119),
    topReasons: ["Switched to competitor", "Budget cuts", "Practice closed", "Feature gaps"].slice(0, Math.floor(rand(2, 4))),
  }));

  return { reps, specialties, sources, quarters, deals, marketing, churn };
}

function buildDataSummary(d) {
  const lines = [
    `GTM Analytics Dataset — Specialty EHR SaaS Company`,
    `Sales Reps: ${d.reps.join(", ")}`,
    `Specialties: ${d.specialties.join(", ")}`,
    `Lead Sources: ${d.sources.join(", ")}`,
    `Reporting Period: Q3 2024 – Q1 2025`,
    `Total Deals in Pipeline: ${d.deals.length}`,
    ``, `=== DEAL-LEVEL DATA ===`,
  ];

  d.reps.forEach(rep => {
    const repDeals = d.deals.filter(x => x.rep === rep);
    const won = repDeals.filter(x => x.won);
    const lost = repDeals.filter(x => x.lost);
    const open = repDeals.filter(x => !x.won && !x.lost);
    const wonAcv = won.reduce((a, x) => a + x.acv, 0);
    const openAcv = open.reduce((a, x) => a + x.acv, 0);
    const avgCycle = won.length > 0 ? Math.round(won.reduce((a, x) => a + x.daysInPipeline, 0) / won.length) : 0;
    lines.push(`\n${rep}: ${repDeals.length} deals total | ${won.length} won ($${wonAcv.toLocaleString()} ACV) | ${lost.length} lost | ${open.length} open ($${openAcv.toLocaleString()} pipeline) | Avg cycle: ${avgCycle} days`);
    d.specialties.forEach(spec => {
      const specDeals = repDeals.filter(x => x.specialty === spec);
      const specWon = specDeals.filter(x => x.won);
      if (specDeals.length > 0) {
        lines.push(`  ${spec}: ${specDeals.length} deals, ${specWon.length} won, win rate ${specDeals.length > 0 ? Math.round(specWon.length / (specWon.length + specDeals.filter(x => x.lost).length || 1) * 100) : 0}%`);
      }
    });
    d.sources.forEach(src => {
      const srcDeals = repDeals.filter(x => x.source === src);
      if (srcDeals.length > 0) {
        lines.push(`  Source ${src}: ${srcDeals.length} deals, ${srcDeals.filter(x => x.won).length} won`);
      }
    });
  });

  lines.push(`\n=== QUARTERLY PIPELINE SUMMARY ===`);
  d.quarters.forEach(q => {
    const qDeals = d.deals.filter(x => x.quarter === q);
    const won = qDeals.filter(x => x.won);
    const lost = qDeals.filter(x => x.lost);
    lines.push(`${q}: ${qDeals.length} deals | ${won.length} won ($${won.reduce((a, x) => a + x.acv, 0).toLocaleString()}) | ${lost.length} lost | Win rate: ${Math.round(won.length / (won.length + lost.length || 1) * 100)}%`);
  });

  lines.push(`\n=== MARKETING FUNNEL ===`);
  d.marketing.forEach(m => {
    lines.push(`${m.quarter}: ${m.mqls} MQLs → ${m.sqls} SQLs → ${m.demosBooked} demos | Pipeline: $${m.pipelineGenerated.toLocaleString()} | Spend: $${m.spend.toLocaleString()} | CPL: $${Math.round(m.spend / m.mqls)}`);
  });

  lines.push(`\n=== CHURN & RETENTION BY SPECIALTY ===`);
  d.churn.forEach(c => {
    lines.push(`${c.specialty}: ${c.customersStart} customers, ${c.churned} churned (${(c.churned / c.customersStart * 100).toFixed(1)}%), ${c.expanded} expanded, NRR: ${c.nrr.toFixed(1)}% | Top reasons: ${c.topReasons.join(", ")}`);
  });

  return lines.join("\n");
}

// Generate data once at module load (server-side only)
const GTM_DATA = generateGTMData();
const DATA_SUMMARY = buildDataSummary(GTM_DATA);

const SYSTEM_PROMPT = `You are a GTM analytics assistant for a specialty EHR SaaS company. You answer questions about pipeline, bookings, sales performance, marketing attribution, and customer retention using the data provided. Be concise and specific — use exact numbers, percentages, and dollar amounts. When comparing reps, use last names only. Frame answers in terms of actionable insights. Always end with one specific recommendation the GTM team should act on.

GTM DATA:
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
    console.error("AskGTM route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
