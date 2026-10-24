import { PRACTICE_DATA } from './practice-scenario.mjs';
import { aggregatePractice, PRACTICE_PROCEDURES } from './practice-aggregates.mjs';
import { parsePracticeScope, PRACTICE_HELP } from './practice-scope.mjs';
import { practiceBreakdowns, validatePracticeBreakdowns } from './practice-breakdowns.mjs';

const measures = [
  ['collectionRatio', /\b(?:collection(?:s)?(?:[- ]to[- ]revenue)?[- ](?:rate|ratio|rates|ratios)|collections?\s*(?:divided\s+by|over|\/)\s*revenue|ratio\s+of\s+collections?\s+to\s+revenue)\b/g],
  ['avgReimb', /\b(?:(?:average|avg|mean)\s+)?reimbursements?\b/g],
  ['noShows', /\b(?:no[- ]?shows?|missed appointments?)\b/g],
  ['denials', /\b(?:denials?|denied claims?)\b/g],
  ['revenue', /\b(?:revenues?|income)\b/g],
  ['collections', /\b(?:collections?|collected)\b/g],
  ['patients', /\b(?:patients?|patient volumes?)\b/g],
  ['procedures', /\b(?:procedures?|procedure volumes?)\b/g],
];
const procedurePatterns = [
  ['Mohs Surgery', /\bmohs(?: surgery)?\b/g], ['Biopsy', /\b(?:biopsy|biopsies)\b/g],
  ['Lesion Destruction', /\blesion destruction\b/g], ['E&M Visit', /\be\s*&\s*m(?: visits?)?\b/g],
  ['Cosmetic Consult', /\bcosmetic consults?\b/g],
];
const number = n => n.toLocaleString('en-US');
const money = n => n === null ? 'Unavailable' : `$${n.toLocaleString('en-US',{maximumFractionDigits:2})}`;
const percent = n => n === null ? 'Unavailable (zero denominator)' : `${n.toFixed(1)}%`;
const labels = {revenue:'Revenue',collections:'Collections',patients:'Patient counts',denials:'Denial counts',noShows:'No-show counts',collectionRatio:'Collections / revenue',avgReimb:'Average reimbursement'};
const format = (key,value) => key==='collectionRatio'?percent(value):['revenue','collections','avgReimb'].includes(key)?money(value):number(value);

// Every response is constructed from validated scope and calculated records.
// There is no model fallback that can invent another aggregate or cause.
export function answerPracticeQuestion(question) {
  let text=question.toLowerCase().replace(/[–—]/g,'-').replace(/\bwhat['’]s\b/g,'what is').replace(/['’]s\b/g,'');
  if(/\b(?:mrn|diagnosis|diagnoses|treatment|patient[- ]level|patient id|patient named|patient records?|chart history)\b/.test(text))return 'Patient-level queries are outside this synthetic aggregate dataset. No patient records are present. Ask about counts and amounts by provider and period instead.';
  if(/\bunique patients?\b/.test(text))return 'Unique-patient totals cannot be calculated across months. The scenario supplies monthly aggregate patient counts, with no patient identifiers or deduplication records.';
  if(/\b(?:excluding|except|without|not)\b/.test(text))return PRACTICE_HELP;
  const breakdowns=practiceBreakdowns(text);
  const metrics=[];
  const procedures=[];
  for(const [name,pattern] of procedurePatterns){if(pattern.test(text)){procedures.push(name);text=text.replace(pattern,' ');}}
  if(procedures.length)metrics.push('procedures');
  const payers=[];
  for(const payer of PRACTICE_DATA.payers){const pattern=new RegExp(`\\b${payer.toLowerCase().replace('-','[- ]')}\\b`,'g');if(pattern.test(text)){payers.push(payer);text=text.replace(pattern,' ');}}
  const payerMix=/\bpayer(?:s)?\b|\b(?:payer|insurance)\s+mix\b/.test(text);
  text=text.replace(/\b(?:payer(?:s)?|insurance)\s*(?:mix)?\b/g,' ');
  for(const [key,pattern]of measures){if(pattern.test(text)){metrics.push(key);text=text.replace(pattern,' ');}}
  if(procedures.length)breakdowns.add('procedure');
  if(payers.length)breakdowns.add('payer');
  if(payerMix||payers.length)metrics.push('payerMix');
  const breakdownError=validatePracticeBreakdowns(metrics,breakdowns);
  if(breakdownError)return breakdownError;
  // Payer revenue is the requested amount; do not substitute the all-payer
  // revenue table when a payer filter/breakdown is requested.
  if(breakdowns.has('payer')){
    metrics.splice(0,metrics.length,'payerMix');
  }
  const uniqueMetrics=[...new Set(metrics)];
  const scope=parsePracticeScope(text);
  if(scope.error)return scope.error;
  let remaining=scope.remaining;
  const monthly=breakdowns.has('month')||/\b(?:monthly|months|trend|trends|increasing|rising)\b|by month|over time/.test(remaining);
  const quarterly=breakdowns.has('quarter')||/\bquarterly\b|by quarter/.test(remaining);
  const ranking=/\b(?:who|which|highest|lowest|most|least|top|best|worst|leads)\b/.test(remaining);
  const causal=/\b(?:why|explain|cause|causes|reason|reasons|because|prove|proves|timing|increasing|rising)\b/.test(remaining);
  const rates=/\b(?:rate|rates|ratio|ratios|percentage|percentages|percent)\b/.test(remaining);
  if(/\b(?:mean|average|averages|median|weighted)\b/.test(remaining)&&!(uniqueMetrics.length===1&&uniqueMetrics[0]==='avgReimb'))return PRACTICE_HELP;
  if((rates||/\bshares?\b/.test(remaining))&&uniqueMetrics.some(k=>['revenue','collections','patients','avgReimb'].includes(k)))return PRACTICE_HELP;
  if(causal&&uniqueMetrics.includes('collectionRatio'))remaining=remaining.replace(/\b(?:above|over|exceed(?:s|ing)?|greater than)\s*100\s*%?/g,' ');
  const allowed=new Set('give show me the full year annual count counts for each provider providers practice total totals use only supplied data keep it brief what is are our a an of by do we have to calculate rate rates ratio ratios why explain cause causes reason reasons because prove proves timing prior period periods payments increasing increase rising up over time month monthly months trend trends quarter quarterly compare comparison breakdown number many how much please tell summing all no more than summary overview performance answer from available in across entire dr whole date percentage percentages percent compute per at can you 12 did has had there these those also result results exact sum sums breakdowns claim claims submitted who which highest lowest most least top best worst leads and was were for generated made earn earned chart graph through until between inclusive half used state mix share shares volume volumes seen unweighted mean averages'.split(' '));
  if((remaining.match(/[a-z0-9]+/g)||[]).some(word=>!allowed.has(word)))return PRACTICE_HELP;
  if(!uniqueMetrics.length){
    if(!/\b(?:summary|overview|performance)\b/.test(remaining))return PRACTICE_HELP;
    uniqueMetrics.push('revenue','collections','patients','denials','noShows','collectionRatio','avgReimb','procedures','payerMix');
    const summaryError=validatePracticeBreakdowns(uniqueMetrics,breakdowns);
    if(summaryError)return summaryError;
  }
  if(quarterly&&scope.monthIndexes.length!==12)return PRACTICE_HELP;
  const result=aggregatePractice(scope);
  const allProviders=scope.providers.length===PRACTICE_DATA.providers.length;
  const byProvider=/\bproviders?\b/.test(remaining);
  const groups=quarterly?[0,1,2,3].map(q=>({label:`Q${q+1}`,indexes:[q*3,q*3+1,q*3+2]})):monthly?scope.monthIndexes.map(i=>({label:PRACTICE_DATA.months[i].month,indexes:[i]})):[];
  const groupResults=groups.map(g=>({...g,result:aggregatePractice({monthIndexes:g.indexes,providers:scope.providers})}));
  const notes=[];
  const lines=[`Calculated practice measures — ${scope.period}:`];
  for(const key of uniqueMetrics){
    if(key==='payerMix'){
      notes.push('Displayed shares are rounded and may not sum to exactly 100%. Calculations use unrounded amounts.');
      const selected=payers.length?payers:PRACTICE_DATA.payers;
      const payerValues=row=>selected.map(payer=>`${payer} ${money(row.payerRevenue[payer])} (${percent(row.revenue?row.payerRevenue[payer]/row.revenue*100:null)})`).join('; ');
      lines.push('\nPayer revenue and share of all-payer revenue for the selected providers:');
      for(const payer of selected)lines.push(`${payer}: ${money(result.total.payerRevenue[payer])} (${percent(result.total.revenue?result.total.payerRevenue[payer]/result.total.revenue*100:null)})`);
      lines.push(`Selected payer revenue: ${money(selected.reduce((sum,p)=>sum+result.total.payerRevenue[p],0))}. All-payer revenue denominator: ${money(result.total.revenue)}.`);
      if(ranking){const max=Math.max(...selected.map(p=>result.total.payerRevenue[p]));lines.push(`Highest payer revenue: ${selected.filter(p=>result.total.payerRevenue[p]===max).join(' and ')} (${money(max)}).`);}
      if(byProvider)lines.push('Payer revenue by provider:',...result.providers.map(p=>`${p.provider.split(' ').at(-1)}: ${payerValues(p)}. All-payer revenue: ${money(p.revenue)}.`));
      if(groups.length)lines.push(`${quarterly?'Quarter':'Monthly'} payer revenue:`,...groupResults.flatMap(g=>[`${g.label}: ${payerValues(g.result.total)}. All-payer revenue: ${money(g.result.total.revenue)}.`,...(byProvider?g.result.providers.map(p=>`  ${p.provider.split(' ').at(-1)}: ${payerValues(p)}. All-payer revenue: ${money(p.revenue)}.`):[])]));
      continue;
    }
    if(key==='procedures'){
      notes.push('Displayed shares are rounded and may not sum to exactly 100%. Calculations use unrounded amounts.');
      const selected=procedures.length?procedures:PRACTICE_PROCEDURES;
      const denominator=PRACTICE_PROCEDURES.reduce((sum,p)=>sum+result.total.procedures[p],0);
      lines.push('\nProcedure counts and share of all recorded procedures:',...selected.map(p=>`${p}: ${number(result.total.procedures[p])} (${percent(denominator?result.total.procedures[p]/denominator*100:null)})`),`Selected procedure total: ${number(selected.reduce((sum,p)=>sum+result.total.procedures[p],0))}. All-procedure denominator: ${number(denominator)}.`);
      if(ranking){const max=Math.max(...selected.map(p=>result.total.procedures[p]));lines.push(`Highest procedure count: ${selected.filter(p=>result.total.procedures[p]===max).join(' and ')} (${number(max)}).`);}
      if(byProvider)lines.push('Procedure counts by provider:',...result.providers.map(p=>`${p.provider.split(' ').at(-1)}: ${selected.map(name=>`${name} ${number(p.procedures[name])}`).join('; ')}.`));
      if(groups.length)lines.push(`${quarterly?'Quarter':'Monthly'} procedure counts:`,...groupResults.flatMap(g=>[`${g.label}: ${selected.map(name=>`${name} ${number(g.result.total.procedures[name])}`).join('; ')}.`,...(byProvider?g.result.providers.map(p=>`  ${p.provider.split(' ').at(-1)}: ${selected.map(name=>`${name} ${number(p.procedures[name])}`).join('; ')}.`):[])]));
      continue;
    }
    const totalLabel=key==='collectionRatio'?`${allProviders?'Practice':'Selected provider'} ratio`:key==='avgReimb'?`${allProviders?'Practice':'Selected provider'} mean`:`${allProviders?'Practice total':'Selected provider total'}`;
    lines.push(`\n${labels[key]}:`,...result.providers.map(p=>`${p.provider.split(' ').at(-1)}: ${format(key,p[key])}`),`${totalLabel}: ${format(key,result.total[key])}.`);
    if(ranking){
      const rows=result.providers.filter(p=>p[key]!==null);
      const max=Math.max(...rows.map(p=>p[key])),min=Math.min(...rows.map(p=>p[key]));
      const names=value=>rows.filter(p=>p[key]===value).map(p=>p.provider.split(' ').at(-1)).join(' and ');
      lines.push(`Highest ${labels[key].toLowerCase()}: ${names(max)} (${format(key,max)}). Lowest: ${names(min)} (${format(key,min)}).`);
    }
    if(monthly||quarterly){
      const breakdown=groupResults.map(g=>({...g,value:g.result.total[key]}));
      lines.push(`${quarterly?'Quarter':'Monthly'} ${labels[key].toLowerCase()} for the same selected providers:`,...breakdown.map(g=>`${g.label}: ${format(key,g.value)}${byProvider?`; ${g.result.providers.map(p=>`${p.provider.split(' ').at(-1)}: ${format(key,p[key])}`).join('; ')}`:''}`));
      if(ranking){const max=Math.max(...breakdown.map(g=>g.value));lines.push(`Highest period: ${breakdown.filter(g=>g.value===max).map(g=>g.label).join(' and ')} (${format(key,max)}).`);}
    }
    if(key==='collectionRatio')notes.push('Collections / revenue uses summed collections divided by summed revenue, not an average of monthly rates. The synthetic amounts are generated independently. Ratios above 100% do not establish payment timing or prior-period allocation; payment dates and claim linkage are absent.');
    if(key==='avgReimb')notes.push('Average reimbursement is the unweighted mean of the supplied provider-month averages. Claim-level volumes and weights are not supplied; a claim-weighted average cannot be calculated.');
    if(key==='patients')notes.push('Patient counts sum the monthly aggregate records. They do not establish a count of unique patients across months.');
  }
  if(rates&&uniqueMetrics.includes('denials'))notes.push('A denial rate cannot be calculated: claim counts and payer-specific denial counts are not supplied. Denials are counts, not a rate.');
  if(rates&&uniqueMetrics.includes('noShows'))notes.push('A no-show rate cannot be calculated: scheduled-appointment counts are not supplied. Patient counts are not an appointment denominator.');
  if(causal)notes.push('These aggregate records do not establish causes. No denial reasons, payment allocation, operational history, or causal experiment is supplied; investigate those records before attributing a change to a process or timing effect.');
  return [...lines,'',...new Set(notes)].join('\n').trim();
}
