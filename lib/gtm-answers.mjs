import { GTM_DATA, CURRENT_QUARTER, summarize, money } from './gtm-scenario.mjs';

const specialtyTerms = [
  ['Dermatology', /\b(?:dermatology|derm)\b/gi],
  ['Orthopedics', /\b(?:orthopedics|orthopaedics|ortho)\b/gi],
  ['Gastroenterology', /\b(?:gastroenterology|gastro)\b/gi],
  ['Ophthalmology', /\b(?:ophthalmology|ophtho)\b/gi],
];
const sourceTerms = GTM_DATA.sources.map(source => [source, new RegExp(`\\b${source === 'Referral' ? 'referrals?' : source.replace(' ', '\\s*')}\\b`, 'gi')]);
const scopeHelp = 'Please specify one reporting quarter and, optionally, one specialty, source, and rep. This calculator compares mean sales cycles for won opportunities; it does not support other filters or metrics.';

export function answerKnownGTMQuestion(question) {
  // Recognize the comparison regardless of word order, so equivalent wording
  // reaches the same filtered calculation instead of the model's summaries.
  if (!/\b(longest|slowest)\b/i.test(question) || !/\bcycles?\b/i.test(question)) return null;
  let remaining = question.toLowerCase();
  if (/\bwhich\s+(specialty|source|channel)\b|\b(?:by|per)\s+(specialty|source|channel)\b/.test(remaining)) return scopeHelp;
  const periods = [...remaining.matchAll(/\bq([1-4])(?:\s+(?:of\s+)?)?(20\d{2})?\b/g)].map(m => m[2] ? `Q${m[1]} ${m[2]}` : [...GTM_DATA.quarters].reverse().find(q => q.startsWith(`Q${m[1]} `)) || `Q${m[1]}`);
  remaining = remaining.replace(/\bq([1-4])(?:\s+(?:of\s+)?)?(20\d{2})?\b/g, ' ');
  if (new Set(periods).size > 1) return scopeHelp;
  const years = remaining.match(/\b20\d{2}\b/g) || [];
  if (years.length) return `Please specify a quarter. Available periods: ${GTM_DATA.quarters.join(', ')}; full-year cycle comparisons are not supplied.`;
  let quarter = periods[0] || CURRENT_QUARTER;
  if (/\blast quarter\b/.test(remaining)) {
    if (periods.length) return scopeHelp;
    quarter = GTM_DATA.quarters[GTM_DATA.quarters.indexOf(CURRENT_QUARTER) - 1];
    remaining = remaining.replace(/\blast quarter\b/g, ' ');
  }
  if (!GTM_DATA.quarters.includes(quarter)) return `No data is available for ${quarter}. Available periods: ${GTM_DATA.quarters.join(', ')}.`;

  const selected = {};
  for (const [key, terms] of [['specialty', specialtyTerms], ['source', sourceTerms], ['rep', GTM_DATA.reps.map(rep => [rep, new RegExp(`\\b(?:${rep.toLowerCase()}|${rep.split(' ').at(-1).toLowerCase()})\\b`, 'gi')])]]) {
    const values = [];
    for (const [value, pattern] of terms) {
      if (remaining.match(pattern)) values.push(value);
      remaining = remaining.replace(pattern, ' ');
    }
    if (values.length > 1) return scopeHelp;
    if (values.length) selected[key] = values[0];
  }
  // Do not silently drop an unknown filter, negation, amount threshold, or
  // different metric such as median. Unsupported wording asks for clarification.
  const allowed = new Set('who whose which rep reps salesperson salespeople has have had was were the longest slowest average mean sales cycle cycles and why for in among from on of this quarter our team overall company wide versus vs compare please tell me what show is are a an to with within across deals deal opportunities opportunity won closed source sources channel channels specialty'.split(' '));
  if ((remaining.match(/[a-z0-9]+/g) || []).some(word => !allowed.has(word))) return scopeHelp;

  const cohort = GTM_DATA.deals.filter(d => d.quarter === quarter && Object.entries(selected).every(([key,value]) => d[key] === value));
  const rows = GTM_DATA.reps.map(rep => ({name: rep, ...summarize(cohort.filter(d => d.rep === rep))})).filter(r => r.wins > 0).sort((a,b) => b.avgCycle - a.avgCycle);
  const scope = [quarter, ...Object.entries(selected).map(([key,value]) => `${key}: ${value}`)].join(' · ');
  if (!rows.length) return `No won opportunities match ${scope}. A won sales cycle cannot be calculated for that scope.`;
  const [slowest, next] = rows;
  const total = summarize(cohort);
  const leaders = rows.filter(row => row.avgCycle === slowest.avgCycle);
  const label = leaders.map(r => r.name.split(' ').at(-1)).join(' and ');
  const compare = next && leaders.length === 1 ? ` ${next.name.split(' ').at(-1)} is next at ${next.avgCycle.toFixed(1)} days, a gap of ${(slowest.avgCycle - next.avgCycle).toFixed(1)} days.` : '';
  return `Observed — ${scope}: ${label} ${leaders.length > 1 ? 'tie for' : 'has'} the longest mean sales cycle: ${slowest.avgCycle.toFixed(0)} days${leaders.length === 1 ? ` across ${slowest.wins} won ${slowest.wins === 1 ? "opportunity" : "opportunities"}` : ''}.${compare} The selected cohort mean is ${total.avgCycle.toFixed(1)} days across ${total.wins} wins. ${leaders.length === 1 ? `${label}'s mean won ACV is ${money(slowest.avgACV)} versus ${money(total.avgACV)} for the selected cohort.` : ''}\n\nPossible explanations: Deal size or buyer complexity could contribute, but this aggregate comparison does not establish a cause. Small win counts limit comparison.\n\nNext check: Compare cycle lengths within similar ACV bands, then inspect stage history and buyer-review steps. No activity history or legal-review dates are supplied, so the data cannot establish poor qualification or justify an automatic disqualification rule.`;
}
