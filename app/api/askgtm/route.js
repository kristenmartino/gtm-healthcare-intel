import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "../../../lib/rate-limit";

import { answerKnownGTMQuestion } from "../../../lib/gtm-answers.mjs";

import { GTM_SYSTEM_PROMPT } from "../../../lib/assistant-grounding.mjs";

const anthropic = new Anthropic();

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

    const calculated = answerKnownGTMQuestion(question);
    if (calculated) return NextResponse.json({ content: [{ type: "text", text: calculated }], source: "scenario-calculation" });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: [{ type: "text", text: GTM_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: question }],
    });
    return NextResponse.json(message);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error("Anthropic API error:", error.status, error.message);
      return NextResponse.json({ error: "Upstream model request failed" }, { status: 502 });
    }
    if (error?.message?.includes("Could not resolve authentication")) {
      console.error("AskGTM route error: ANTHROPIC_API_KEY not set in this environment");
      return NextResponse.json({ error: "AI service not configured for this environment" }, { status: 503 });
    }
    console.error("AskGTM route error:", error?.constructor?.name, "-", error?.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
