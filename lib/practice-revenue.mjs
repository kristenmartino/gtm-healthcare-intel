import { PRACTICE_DATA, summarizePracticeRevenue } from './practice-scenario.mjs';

const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const monthPattern = new RegExp(`\\b(${months.flatMap(m => [m, m.slice(0,3)]).join('|')}|sept)\\b`, 'g');
const scopeHelp = 'Please specify revenue totals for one 2025 month, quarter, half-year, inclusive month range, or the full year, and optionally named providers. Relative periods end in Dec 2025, the final scenario month. Other filters, rates, and comparisons between periods are not supported by this calculator.';
const range = (start, end) => Array.from({length: end-start+1}, (_,i) => start+i);

export function answerPracticeRevenue(question) {
  if (!/\brevenues?\b/i.test(question)) return null;
  let remaining = question.toLowerCase().replace(/[–—]/g, '-').replace(/\bwhat['’]s\b/g, 'what is');
  if (/\b(patient|mrn|chart|diagnosis|treatment)\b/.test(remaining)) return 'Patient-level queries are outside this synthetic aggregate dataset. No patient records are present. Ask about revenue totals by provider and period instead.';
  if ((remaining.match(/\b20\d{2}\b/g) || []).some(y => y !== '2025')) return 'Only calendar year 2025 is supplied. No revenue totals are available for the requested year.';
  remaining = remaining.replace(/\b2025\b/g, ' ');
  const selected = PRACTICE_DATA.providers.filter(p => new RegExp(`\\b${p.split(' ').at(-1)}\\b`, 'i').test(remaining));
  for (const provider of selected) {
    for (const name of provider.toLowerCase().replace('dr. ', '').split(' ')) remaining = remaining.replace(new RegExp(`\\b${name}\\b`, 'g'), ' ');
  }
  const providers = selected.length ? selected : PRACTICE_DATA.providers;

  // Resolve one period before summing. Ambiguous ranges and unknown qualifiers
  // return clarification rather than silently expanding to the annual cohort.
  const scopes = [];
  remaining = remaining.replace(/\b(?:last|past|trailing)\s+(\d+|six|twelve|three)\s+months\b/g, (_, count) => {
    const n = ({six:6,twelve:12,three:3})[count] || Number(count);
    scopes.push(n >= 1 && n <= 12 ? range(12-n,11) : null); return ' ';
  });
  remaining = remaining.replace(/\b(?:last|this)\s+(month|quarter)\b/g, (_, unit) => { scopes.push(unit === 'month' ? [11] : [9,10,11]); return ' '; });
  remaining = remaining.replace(/\b(?:h([12])|(first|second)\s+half(?:\s+of\s+(?:the\s+)?year)?)\b/g, (_, half, word) => {
    const start = half === '2' || word === 'second' ? 6 : 0; scopes.push(range(start,start+5)); return ' ';
  });
  const quarters = [...remaining.matchAll(/\bq([1-4])\b/g)];
  if (quarters.length > 1) return scopeHelp;
  if (quarters.length) { const start = (Number(quarters[0][1])-1)*3; scopes.push(range(start,start+2)); remaining = remaining.replace(/\bq[1-4]\b/g,' '); }
  const matches = [...remaining.matchAll(monthPattern)];
  const indexes = matches.map(m => months.findIndex(name => name === m[1] || name.slice(0,3) === m[1].slice(0,3)));
  if (matches.length === 1) scopes.push(indexes);
  else if (matches.length === 2) {
    const between = remaining.slice(matches[0].index + matches[0][0].length, matches[1].index).trim();
    if (!/^(?:through|to|until|-)$/.test(between) && !(/\bbetween\s*$/.test(remaining.slice(0,matches[0].index)) && between === 'and')) return scopeHelp;
    if (indexes[1] < indexes[0]) return scopeHelp;
    scopes.push(range(indexes[0], indexes[1]));
  } else if (matches.length > 2) return scopeHelp;
  remaining = remaining.replace(monthPattern, ' ');
  const annual = /\b(?:annual|full.year|whole.year|entire.year|calendar.year|ytd|year.to.date)\b/.test(remaining);
  if (scopes.length > 1 || scopes.some(s => !s) || (annual && scopes.length)) return scopeHelp;
  const monthIndexes = scopes[0] || range(0,11);
  const monthly = /\bmonthly\b|by month|month by month/.test(remaining);
  const quarterly = /\bquarterly\b|by quarter/.test(remaining);
  const allowed = new Set('compare revenue revenues across all providers provider for give each total totals and the practice keep it brief show me what is are our a an of by month months quarter quarterly monthly annual full whole entire calendar year ytd date to from through until between inclusive half in per dr please tell sum sums calculate compute report breakdown use only supplied data exact dollars how much did have has had made generate generated earn earned over period periods'.split(' '));
  if ((remaining.match(/[a-z0-9]+/g) || []).some(word => !allowed.has(word))) return scopeHelp;
  if (quarterly && scopes.length) return scopeHelp;

  const result = summarizePracticeRevenue(monthIndexes, providers);
  const first = PRACTICE_DATA.months[monthIndexes[0]].month;
  const last = PRACTICE_DATA.months[monthIndexes.at(-1)].month;
  const period = `${first}${first === last ? '' : `–${last}`} 2025`;
  const money = n => `$${n.toLocaleString('en-US')}`;
  const lines = [`Calculated revenue totals — ${period}:`, ...result.providers.map(p => `${p.provider.split(' ').at(-1)}: ${money(p.revenue)}`), `${providers.length === PRACTICE_DATA.providers.length ? 'Practice total' : 'Selected provider total'}: ${money(result.total)}.`];
  if (monthly) lines.push('\nMonthly totals for the same selected providers:', ...monthIndexes.map(i => `${PRACTICE_DATA.months[i].month}: ${money(summarizePracticeRevenue([i],providers).total)}`));
  if (quarterly) lines.push('\nQuarter totals for the same selected providers:', ...[0,1,2,3].map(q => `Q${q+1}: ${money(summarizePracticeRevenue(range(q*3,q*3+2),providers).total)}`));
  return lines.join('\n');
}
