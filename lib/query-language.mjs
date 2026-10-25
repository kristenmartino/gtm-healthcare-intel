import { QueryError } from './query-contract.mjs';

import { normalizeThresholdNumbers, parseWrittenQuantity } from './query-numbers.mjs';

export function normalizeQueryLanguage(question) {
  return normalizeThresholdNumbers(question.toLowerCase().replace(/[–—]/g,'-')
    .replace(/\b(did|do|does|is|are|was|were|has|have|had)n['’]t\b/g,'$1 not'));
}

export const missedQuotaPattern = /\b(?:did\s+|do\s+|does\s+|have\s+|has\s+|had\s+)?not\s+(?:hit|meet|met|reach(?:ed)?|achiev(?:e|ed)|attain(?:ed)?|make|made)\s+(?:(?:their|the|his|her)\s+)?(?:quota|target)\b/g;
export function unsupportedNegation(text) {
  return /\bnot\b/.test(text.replace(missedQuotaPattern,'below quota').replace(/\bnot\s+at\s+(?:the\s+)?target\b/g,'against target'));
}

const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const monthPattern = new RegExp(`\\b(${monthNames.flatMap(m=>[m,m.slice(0,3)]).join('|')}|sept)\\b`,'g');
const allMonths = () => Array.from({length:12},(_,i)=>i);
const unique = values => [...new Set(values)].sort((a,b)=>a-b);

// Parse every range independently, rather than treating all endpoints as a
// single pair. Character spans also protect "between July and December" when
// independent measure clauses are split below.
export function practicePeriods(text, defaultYear = true) {
  const periods = [], ranges = [];
  const matches = [...text.matchAll(monthPattern)];
  const index = match => monthNames.findIndex(m=>m.slice(0,3)===match[1].slice(0,3));
  for (let i=0;i<matches.length;i++) {
    const first=matches[i], next=matches[i+1], start=index(first);
    const connector=next?text.slice(first.index+first[0].length,next.index).trim():'';
    const range=next&&(/^(?:to|through|until|-)$/.test(connector)||(connector==='and'&&/\bbetween\s*$/.test(text.slice(0,first.index))));
    if (range) {
      const end=index(next);
      if(start>end)throw new QueryError('Please clarify the month range.');
      periods.push(Array.from({length:end-start+1},(_,n)=>start+n));
      ranges.push({start:first.index,end:next.index+next[0].length}); i++;
    } else periods.push([start]);
  }
  const quarters=[...text.matchAll(/\bq([1-4])\b/g)];
  for(let i=0;i<quarters.length;i++){
    const first=quarters[i],next=quarters[i+1],start=(Number(first[1])-1)*3;
    const connector=next?text.slice(first.index+first[0].length,next.index).trim():'';
    if(next&&(/^(?:to|through|until|-)$/.test(connector)||(connector==='and'&&/\bbetween\s*$/.test(text.slice(0,first.index))))){
      const end=Number(next[1])*3-1;
      if(start>end)throw new QueryError('Please clarify the quarter range.');
      periods.push(Array.from({length:end-start+1},(_,n)=>start+n));
      ranges.push({start:first.index,end:next.index+next[0].length});i++;
    }else periods.push([start,start+1,start+2]);
  }
  if(/\b(?:last|this|current|latest) quarter\b/.test(text))periods.push([9,10,11]);
  if(/\b(?:this|last|latest) month\b/.test(text))periods.push([11]);
  const trailing=text.match(/\b(?:last|past|trailing)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+months\b/);
  if(trailing){
    const n=/^\d+$/.test(trailing[1])?Number(trailing[1]):parseWrittenQuantity(trailing[1]);
    if(n<1||n>12)throw new QueryError('Only the supplied 2025 months are available.');
    periods.push(Array.from({length:n},(_,i)=>12-n+i));
  }
  if(/\b(?:h1|first half)\b/.test(text))periods.push([0,1,2,3,4,5]);
  if(/\b(?:h2|second half)\b/.test(text))periods.push([6,7,8,9,10,11]);
  const annual=/\b(?:annual|full[- ]year|whole year|entire year|calendar year)\b/.test(text);
  if(annual&&periods.length&&unique(periods.flat()).length!==12)throw new QueryError('Please clarify the conflicting annual and partial-year periods.');
  return {months:annual||(!periods.length&&defaultYear)?allMonths():unique(periods.flat()),periods,ranges};
}

export function practiceMeasures(text) {
  const normalized=text.replace(/\b(?:collection(?:s)?(?:[- ]to[- ]revenue)?[- ](?:rate|ratio|rates|ratios)|collections?\s*(?:divided\s+by|over|\/)\s*revenue|ratio\s+of\s+collections?\s+to\s+revenue)\b/g,' collectionRatio ');
  return [
    ['collectionRatio',/collectionRatio/],['collections',/\b(?:collections?|collected)\b/],
    ['revenue',/\b(?:revenues?|income)\b/],['denials',/\b(?:denials?|denied claims?)\b/],
    ['noShows',/\b(?:no[- ]?shows?|missed appointments?)\b/],['patients',/\bpatients?\b/],
    ['avgReimb',/\breimbursements?\b/],['procedures',/\bprocedures?\b/],
  ].filter(([,pattern])=>pattern.test(normalized)).map(([metric])=>metric);
}

export function validateIndependentPracticePeriods(text, queries) {
  const {ranges}=practicePeriods(text,false);
  const protectedText=text.replace(/\band\b/g,(word,offset)=>ranges.some(r=>offset>=r.start&&offset<r.end)?'___':word);
  const clauses=protectedText.split(/\band\b|\bversus\b|\bvs\.?\b|[;,]/).map(c=>c.replaceAll('___','and'));
  const bindings=clauses.map(clause=>({metrics:practiceMeasures(clause),months:practicePeriods(clause,false).months})).filter(b=>b.metrics.length&&b.months.length);
  if(bindings.length<2)return;
  const expected=new Map();
  for(const binding of bindings)for(const metric of binding.metrics)expected.set(metric,unique([...(expected.get(metric)||[]),...binding.months]));
  for(const [metric,months] of expected){
    const selected=queries.filter(q=>q.metric===metric||(metric==='revenue'&&q.metric==='payerRevenue'));
    const planned=unique(selected.flatMap(q=>q.months));
    if(planned.length!==months.length||planned.some(m=>!months.includes(m)))throw new QueryError('The period for each independent measure must be preserved. Please clarify the measure and its date range.');
  }
}
