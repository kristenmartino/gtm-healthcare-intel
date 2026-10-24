import { PRACTICE_DATA } from './practice-scenario.mjs';

export const PRACTICE_HELP = 'Please specify a supported practice measure: revenue, collections, collection-to-revenue ratio, denial counts, no-show counts, patient counts, procedure counts, payer revenue/mix, or average reimbursement. Use one 2025 month, quarter, half-year, inclusive month range, or the full year; optionally name providers and ask for monthly or quarterly totals. Relative periods end in Dec 2025. Unknown filters and comparisons between different periods need clarification.';
const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const monthPattern = new RegExp(`\\b(${months.flatMap(m=>[m,m.slice(0,3)]).join('|')}|sept)\\b`, 'g');
const range = (start,end) => Array.from({length:end-start+1},(_,i)=>start+i);

export function parsePracticeScope(text) {
  let remaining = text;
  if ((remaining.match(/\b20\d{2}\b/g)||[]).some(y=>y!=='2025')) return { error: 'Only calendar year 2025 is supplied. No counts or amounts are available for the requested year.' };
  remaining = remaining.replace(/\b2025\b/g, ' ');
  const providers = PRACTICE_DATA.providers.filter(p => p.toLowerCase().replace('dr. ', '').split(' ').some(name => new RegExp(`\\b${name}\\b`).test(remaining)));
  for (const p of providers) for (const name of p.toLowerCase().replace('dr. ', '').split(' ')) remaining = remaining.replace(new RegExp(`\\b${name}\\b`,'g'),' ');
  const scopes = [];
  if(/\b(?:last|previous|next)\s+year\b/.test(remaining))return {error:'Only calendar year 2025 is supplied. Please specify a period within 2025.'};
  remaining=remaining.replace(/\b(?:this|current)\s+year\b/g,()=>{scopes.push(range(0,11));return ' ';});
  remaining = remaining.replace(/\b(?:last|past|trailing)\s+(\d+|six|twelve|three)\s+months\b/g,(_,count)=>{
    const n = ({six:6,twelve:12,three:3})[count] || Number(count); scopes.push(n>=1&&n<=12?range(12-n,11):null); return ' ';
  });
  remaining = remaining.replace(/\b(?:last|this|latest)\s+(month|quarter)\b/g,(_,unit)=>{scopes.push(unit==='month'?[11]:[9,10,11]);return ' ';});
  remaining = remaining.replace(/\b(?:h([12])|(first|second)\s+half(?:\s+of\s+(?:the\s+)?year)?)\b/g,(_,half,word)=>{
    const start=half==='2'||word==='second'?6:0; scopes.push(range(start,start+5));return ' ';
  });
  const quarters=[...remaining.matchAll(/\bq([1-4])\b/g)];
  if(quarters.length>1) return {error:PRACTICE_HELP};
  if(quarters.length){const start=(Number(quarters[0][1])-1)*3;scopes.push(range(start,start+2));remaining=remaining.replace(/\bq[1-4]\b/g,' ');}
  const matches=[...remaining.matchAll(monthPattern)];
  const indexes=matches.map(m=>months.findIndex(name=>name===m[1]||name.slice(0,3)===m[1].slice(0,3)));
  if(matches.length===1)scopes.push(indexes);
  else if(matches.length===2){
    const between=remaining.slice(matches[0].index+matches[0][0].length,matches[1].index).trim();
    if(!/^(?:through|to|until|-)$/.test(between)&&!(/\bbetween\s*$/.test(remaining.slice(0,matches[0].index))&&between==='and'))return {error:PRACTICE_HELP};
    if(indexes[1]<indexes[0])return {error:PRACTICE_HELP};scopes.push(range(indexes[0],indexes[1]));
  }else if(matches.length>2)return {error:PRACTICE_HELP};
  remaining=remaining.replace(monthPattern,' ');
  const annual=/\b(?:annual|full.year|whole.year|entire.year|calendar.year|ytd|year.to.date)\b/.test(remaining);
  if(scopes.length>1||scopes.some(s=>!s)||(annual&&scopes.length))return {error:PRACTICE_HELP};
  const monthIndexes=scopes[0]||range(0,11);
  const first=PRACTICE_DATA.months[monthIndexes[0]].month,last=PRACTICE_DATA.months[monthIndexes.at(-1)].month;
  return {remaining,monthIndexes,providers:providers.length?providers:PRACTICE_DATA.providers,period:`${first}${first===last?'':`–${last}`} 2025`};
}
