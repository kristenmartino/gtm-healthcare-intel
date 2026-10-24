import { PRACTICE_DATA, summarizePractice } from './practice-scenario.mjs';
const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const scopeHelp = 'Please specify one 2025 quarter, month, or the full year, and optionally a named provider. Denial counts are available by provider and period; payer-level denial counts, claim denominators, and denial reasons are not supplied.';

export function answerPracticeDenials(question) {
  if (!/\bdenia(?:l|ls)\b/i.test(question)) return null;
  let remaining = question.toLowerCase();
  if (/\b(patient|mrn|chart|diagnosis|treatment)\b/.test(remaining)) return 'Patient-level queries are outside this synthetic aggregate dataset. No patient records are present. Ask about counts by provider and period instead.';
  const years = remaining.match(/\b20\d{2}\b/g) || [];
  if (years.some(y => y !== '2025')) return 'Only calendar year 2025 is supplied. No denial counts are available for the requested year.';
  const quarters = [...remaining.matchAll(/\bq([1-4])\b/g)].map(m => Number(m[1]));
  const monthIndexes = monthNames.flatMap((month,i) => new RegExp(`\\b(?:${month}|${month.slice(0,3)})\\b`).test(remaining) ? [i] : []);
  if (new Set(quarters).size > 1 || monthIndexes.length > 1 || (quarters.length && monthIndexes.length) || /\b(last|previous|next|this)\s+(month|quarter|year)\b/.test(remaining)) return scopeHelp;
  const providers = PRACTICE_DATA.providers.filter(p => new RegExp(`\\b${p.split(' ').at(-1)}\\b`, 'i').test(remaining));
  const selected = providers.length ? providers : PRACTICE_DATA.providers;
  const indexes = quarters.length ? [0,1,2].map(i => (quarters[0]-1)*3+i) : monthIndexes.length ? monthIndexes : PRACTICE_DATA.months.map((_,i) => i);
  const period = quarters.length ? `Q${quarters[0]} 2025` : monthIndexes.length ? `${PRACTICE_DATA.months[monthIndexes[0]].month} 2025` : 'Jan–Dec 2025';
  // Reject unknown scope qualifiers rather than attaching an unfiltered total
  // to, for example, another specialty or an ACV/age threshold.
  remaining = remaining.replace(/\bq[1-4]\b|\b2025\b/g,' ');
  for (const p of PRACTICE_DATA.providers) {
    for (const name of p.toLowerCase().replace('dr. ', '').split(' ')) remaining = remaining.replace(new RegExp(`\\b${name}\\b`,'g'),' ');
  }
  for (const month of monthNames) remaining = remaining.replace(new RegExp(`\\b(?:${month}|${month.slice(0,3)})\\b`,'g'),' ');
  const payerQuestion = /\b(payer|payers|medicare|aetna|cigna|blue cross|unitedhealth|self.pay)\b/.test(remaining);
  const causal = /\b(why|cause|causes|reason|reasons|increasing|increase|rising|up)\b/.test(remaining);
  const monthly = /\b(monthly|months|trend|trends|increasing|increase|rising)\b|over time|by month/.test(remaining);
  const byQuarter = /by quarter|quarterly/.test(remaining);
  // Simple denial requests are answered from records. More elaborate filters
  // get an explicit clarification instead of asking the model to sum records.
  const allowed = new Set('give show me the full year annual count counts for each provider providers and practice total totals use only supplied data keep it brief what is are our a an of by payer payers do we have to calculate rate rates denial denials why cause causes reason reasons increasing increase rising up over time monthly months trend trends quarter quarterly compare compare breakdown number many how please tell summing all no more than summary answer from available in across entire dr whole rate percentage percentages calculate compute per at can you 12 did has had have there these those also show result results exact sum sums breakdowns claim claims submitted denied'.split(' '));
  remaining = remaining.replace(/\b(?:medicare|aetna|cigna|blue cross|unitedhealth|self.pay)\b/g,' ');
  if ((remaining.match(/[a-z0-9]+/g)||[]).some(word => !allowed.has(word))) return scopeHelp;
  const result = summarizePractice(indexes, selected);
  const lines = [`Calculated denial counts — ${period}:`, ...result.providers.map(r => `${r.provider.split(' ').at(-1)}: ${r.denials.toLocaleString('en-US')}`), `${selected.length === PRACTICE_DATA.providers.length ? 'Practice total' : 'Selected provider total'}: ${result.total.toLocaleString('en-US')}.`];
  if (monthly) lines.push('\nMonthly counts for the same selected providers:', ...indexes.map(i => `${PRACTICE_DATA.months[i].month}: ${summarizePractice([i],selected).total}`));
  if (byQuarter && !quarters.length && !monthIndexes.length) lines.push('\nQuarter counts:', ...[0,1,2,3].map(q => `Q${q+1}: ${summarizePractice([q*3,q*3+1,q*3+2],selected).total}`));
  if (/\brate|percentage|percent\b/.test(question.toLowerCase())) lines.unshift(`A denial rate${payerQuestion ? ' by payer' : ''} cannot be calculated: claim counts${payerQuestion ? ' and payer-specific denial counts' : ''} are not supplied.\n`);
  if (payerQuestion) lines.push('\nThe counts above are provider-level, not payer-level. The dataset cannot attribute denials to a payer.');
  if (causal) lines.push('\nThese counts do not establish a cause or show a denial-rate change. Denial reasons and claim denominators are absent; inspect claim-level records before recommending a process change.');
  return lines.join('\n');
}
