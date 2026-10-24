import { NextResponse } from 'next/server';
import { checkRateLimit } from '../../../lib/rate-limit';
import { answerPracticeQuestion } from '../../../lib/practice-answers.mjs';

export async function POST(request) {
  const rate = checkRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (!rate.ok) return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } });
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const question = body?.question;
  if (typeof question !== 'string' || !question.trim()) return NextResponse.json({ error: "Missing or invalid 'question' field" }, { status: 400 });
  if (question.length > 2000) return NextResponse.json({ error: 'Question exceeds 2000-character limit' }, { status: 400 });
  return NextResponse.json({ content: [{ type: 'text', text: answerPracticeQuestion(question) }], source: 'scenario-calculation' });
}
