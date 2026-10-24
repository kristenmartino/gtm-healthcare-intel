import { GTM_DATA, CURRENT_QUARTER, breakdown, quarterSummary, money } from './gtm-scenario.mjs';

// Compute the common cycle comparison directly; the model is not needed for
// arithmetic or a causal explanation the dataset cannot support.
export function answerKnownGTMQuestion(question) {
  if (!/\b(longest|slowest)\b.*\bcycle\b/i.test(question)) return null;
  const periods = [...question.matchAll(/\bQ([1-4])\s*(20\d{2})\b/gi)].map(m => `Q${m[1]} ${m[2]}`);
  if (new Set(periods).size > 1) return null;
  if (!periods.length && /\b20\d{2}\b/.test(question) && !question.includes('2025')) return 'The synthetic dataset covers Q3 2024, Q4 2024, and Q1 2025. It cannot answer that reporting period.';
  // Unsupported relative dates are not silently interpreted as the default.
  if (!periods.length && /\b(last quarter|last year|Q[1-4])\b/i.test(question)) return null;
  const quarter = periods[0] || CURRENT_QUARTER;
  if (!GTM_DATA.quarters.includes(quarter)) return `No data is available for ${quarter}. The synthetic dataset covers Q3 2024, Q4 2024, and Q1 2025.`;
  const rows = breakdown('rep', GTM_DATA.reps, quarter).filter(r => r.wins > 0).sort((a,b) => b.avgCycle - a.avgCycle);
  const [slowest, next] = rows;
  const total = quarterSummary(quarter);
  return `Observed — ${quarter}: ${slowest.name.split(' ').at(-1)} has the longest mean sales cycle: ${slowest.avgCycle.toFixed(0)} days across ${slowest.wins} won opportunities. ${next.name.split(' ').at(-1)} is next at ${next.avgCycle.toFixed(0)} days, a gap of ${(slowest.avgCycle - next.avgCycle).toFixed(0)} days. The team mean is ${total.avgCycle.toFixed(1)} days across ${total.wins} wins. ${slowest.name.split(' ').at(-1)}'s mean won ACV is ${money(slowest.avgACV)} versus ${money(total.avgACV)} for the team.\n\nPossible explanations: Deal size or buyer complexity could contribute, but this aggregate comparison does not establish a cause. The small win count limits comparison.\n\nNext check: Compare cycle lengths within similar ACV bands, then inspect stage history and buyer-review steps. No activity history or legal-review dates are supplied, so the data cannot establish poor qualification or justify an automatic disqualification rule.`;
}
