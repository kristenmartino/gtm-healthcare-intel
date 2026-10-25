import { PRACTICE_DATA } from './practice-scenario.mjs';
import { aggregatePractice, PRACTICE_PROCEDURES } from './practice-aggregates.mjs';
import { GTM_DATA, CURRENT_QUARTER, PRIOR_QUARTER, summarize } from './gtm-scenario.mjs';
import { QueryError, validateToolInput } from './query-contract.mjs';

const sum=(rows,fn)=>rows.reduce((s,r)=>s+fn(r),0);
const number=n=>n==null?'Unavailable':n.toLocaleString('en-US',{maximumFractionDigits:2});
const money=n=>n==null?'Unavailable':n<0?`-$${number(-n)}`:`$${number(n)}`;
const rate=n=>n==null?'Unavailable (zero denominator)':`${n.toFixed(1)}%`;
const ratio=(a,b)=>b?a/b*100:null;
const format=(key,value)=>['revenue','collections','avgReimb','payerRevenue','bookings','pipeline','avgACV','target','gap','quota','shortfall','grossShortfall','overperformance','pipelineGenerated','spend'].includes(key)?money(value):['collectionRatio','winRate','attainment','nrr','customerChurn'].includes(key)?rate(value):key==='avgCycle'?`${number(value)} days`:key==='coverage'?`${number(value)}x`:number(value);
const shortName=name=>name.replace(/^Dr\. /,'').split(' ').at(-1);
const labels={revenue:'Revenue',collections:'Collections',patients:'Patient counts',denials:'Denial counts',noShows:'No-show counts',collectionRatio:'Collections / revenue',avgReimb:'Average reimbursement',procedures:'Procedure counts',payerRevenue:'Payer revenue',bookings:'Bookings (won ACV)',pipeline:'Open qualified pipeline',wins:'Wins',losses:'Losses',closed:'Closed opportunities',winRate:'Closed-cohort win rate',avgACV:'Mean won ACV',avgCycle:'Mean won cycle',target:'Full-quarter target',gap:'Target gap',quota:'Full-quarter quota',attainment:'Attainment',coverage:'Pipeline / full-quarter quota',shortfall:'Net quota shortfall',grossShortfall:'Gross rep shortfalls',overperformance:'Rep overperformance',nrr:'NRR',customerChurn:'Customer churn',customersStart:'Starting customers',churned:'Churned customers',mqls:'MQLs',sqls:'SQLs',demosBooked:'Demos booked',pipelineGenerated:'Created-lead pipeline',spend:'Marketing spend'};
const fail=message=>{throw new QueryError(message);};
function validateOperations(q,metrics){
  if(q.predicate.operator==='none'&&q.predicate.value!==null)fail('A numeric filter needs an explicit comparison operator.');
  if(q.predicate.operator!=='none'&&(!Number.isFinite(q.predicate.value)||!metrics.includes(q.predicate.metric)))fail('The threshold must name a supported measure and a finite value.');
  if(q.ranking.direction!=='none'&&!metrics.includes(q.ranking.metric))fail('The requested ranking measure is unavailable for this report.');
  if(q.ranking.direction==='none'&&(q.ranking.limit!==1||q.ranking.within.length))fail('An inactive ranking must use limit 1 and no within-group dimensions.');
  if(q.ranking.within.some(axis=>!q.groupBy.includes(axis))||(q.ranking.direction!=='none'&&q.ranking.within.length&&q.ranking.within.length===q.groupBy.length))fail('Rank within a subset of the displayed grouping dimensions.');
}
function matches(row,p){
  if(p.operator==='none')return true;
  const n=row[p.metric];if(!Number.isFinite(n))return false;
  return {lt:()=>n<p.value,lte:()=>n<=p.value,eq:()=>n===p.value,gte:()=>n>=p.value,gt:()=>n>p.value}[p.operator]();
}
function ranked(rows,ranking){
  if(ranking.direction==='none')return [];
  if(ranking.within.length){
    const buckets=new Map();
    for(const row of rows){const key=ranking.within.map(axis=>row.dimensions[axis]).join(' · ');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(row);}
    return [...buckets].flatMap(([within,rs])=>ranked(rs,{...ranking,within:[]}).map(r=>({...r,within})));
  }
  const valid=rows.filter(r=>Number.isFinite(r[ranking.metric]));
  const select=direction=>{
    const sorted=[...valid].sort((a,b)=>direction==='highest'?b[ranking.metric]-a[ranking.metric]:a[ranking.metric]-b[ranking.metric]);
    const edge=sorted[Math.min(ranking.limit,sorted.length)-1]?.[ranking.metric];
    return {direction,rows:edge===undefined?[]:sorted.filter(r=>direction==='highest'?r[ranking.metric]>=edge:r[ranking.metric]<=edge)};
  };
  return ranking.direction==='both'?[select('highest'),select('lowest')]:[select(ranking.direction)];
}
const operationScope=q=>[
  `Grouping: ${q.groupBy.length?q.groupBy.join(' × '):'total'}.`,
  ...(q.predicate.operator==='none'?[]:[`Filter after aggregation: ${labels[q.predicate.metric]} ${{lt:'<',lte:'≤',eq:'=',gte:'≥',gt:'>'}[q.predicate.operator]} ${format(q.predicate.metric,q.predicate.value)}.`]),
  ...(q.ranking.direction==='none'?[]:[`Ranking: ${q.ranking.direction}, ${labels[q.ranking.metric]}, limit ${q.ranking.limit} with ties${q.ranking.within.length?` within each ${q.ranking.within.join(' × ')}`:''}.`]),
];
function monthLabel(months){
  const sorted=[...months].sort((a,b)=>a-b);
  return sorted.every((n,i)=>i===0||n===sorted[i-1]+1)?`${PRACTICE_DATA.months[sorted[0]].month}${sorted.length>1?`–${PRACTICE_DATA.months[sorted.at(-1)].month}`:''} 2025`:`${sorted.map(i=>PRACTICE_DATA.months[i].month).join(', ')} 2025`;
}
function partitions(keys,values,scope){
  let groups=[{name:[],dimensions:{},scope}];
  for(const key of keys)groups=groups.flatMap(group=>values(key,group.scope).map(({label,scope:next})=>({name:[...group.name,label],dimensions:{...group.dimensions,[key]:label},scope:next})));
  return groups.map(g=>({...g,name:g.name.join(' · ')||'Total'}));
}
function practiceValue(row,q){
  if(q.metric==='payerRevenue')return sum(q.payers.length?q.payers:PRACTICE_DATA.payers,p=>row.payerRevenue[p]);
  if(q.metric==='procedures')return sum(q.procedures.length?q.procedures:PRACTICE_PROCEDURES,p=>row.procedures[p]);
  return row[q.metric];
}
function practiceQuery(input){
  const q=structuredClone(input);
  if(q.metric==='revenue'&&(q.payers.length||q.groupBy.includes('payer')))q.metric='payerRevenue';
  if(q.predicate.metric==='revenue'&&q.metric==='payerRevenue')q.predicate.metric='payerRevenue';
  if(q.ranking.metric==='revenue'&&q.metric==='payerRevenue')q.ranking.metric='payerRevenue';
  validateOperations(q,[q.metric]);
  if(q.groupBy.includes('month')&&q.groupBy.includes('quarter'))fail('Choose monthly or quarterly grouping, not both.');
  if(q.groupBy.includes('payer')&&q.groupBy.includes('procedure'))fail('A payer-by-procedure breakdown cannot be calculated: no linkage is supplied.');
  if((q.payers.length||q.groupBy.includes('payer'))&&q.metric!=='payerRevenue')fail('Only revenue is supplied by payer. Payer collections, denial counts, rates and procedure counts cannot be calculated.');
  if((q.procedures.length||q.groupBy.includes('procedure'))&&q.metric!=='procedures')fail('Only counts are supplied by procedure type. Procedure revenue and other procedure-level amounts cannot be calculated.');
  const providers=q.providers.length?q.providers:PRACTICE_DATA.providers;
  const base={months:q.months,providers,payers:q.payers.length?q.payers:PRACTICE_DATA.payers,procedures:q.procedures.length?q.procedures:PRACTICE_PROCEDURES};
  const groups=partitions(q.groupBy,(axis,s)=>{
    if(axis==='provider')return s.providers.map(p=>({label:shortName(p),scope:{...s,providers:[p]}}));
    if(axis==='month')return s.months.map(i=>({label:PRACTICE_DATA.months[i].month,scope:{...s,months:[i]}}));
    if(axis==='quarter')return [0,1,2,3].map(i=>({label:`Q${i+1}`,scope:{...s,months:s.months.filter(m=>Math.floor(m/3)===i)}})).filter(g=>g.scope.months.length);
    return s[axis==='payer'?'payers':'procedures'].map(name=>({label:name,scope:{...s,[axis==='payer'?'payers':'procedures']:[name]}}));
  },base);
  const scopeTotal=aggregatePractice({monthIndexes:q.months,providers}).total;
  const before=groups.map(g=>{
    const aggregate=aggregatePractice({monthIndexes:g.scope.months,providers:g.scope.providers}).total;
    const local={...q,payers:g.scope.payers,procedures:g.scope.procedures};
    const value=practiceValue(aggregate,local);
    const denominator=q.metric==='payerRevenue'?aggregate.revenue:q.metric==='procedures'?sum(Object.values(aggregate.procedures),n=>n):null;
    return {name:g.name,dimensions:g.dimensions,[q.metric]:value,...(denominator===null?{}:{share:ratio(value,denominator),denominator})};
  });
  const rows=before.filter(row=>matches(row,q.predicate));
  const notes=[];
  if(q.metric==='patients')notes.push('Monthly patient counts are summed; they are not unique patients across months.');
  if(q.metric==='avgReimb')notes.push('Unweighted mean of the supplied provider-month reimbursement averages. Claim-level weights are unavailable.');
  if(q.metric==='collectionRatio')notes.push('Summed collections divided by summed revenue. Synthetic amounts are generated independently; a ratio above 100% does not establish payment timing.');
  if(q.metric==='denials')notes.push('Denial counts only. Claim denominators and denial reasons are not supplied; denial rates cannot be calculated.');
  if(q.metric==='noShows')notes.push('No-show counts only. Scheduled-appointment counts are not supplied; no-show rates cannot be calculated.');
  if(q.metric==='payerRevenue')notes.push(`All-payer revenue for the selected provider/period scope: ${money(scopeTotal.revenue)}. Each displayed share uses all-payer revenue in its own provider/period group, not patient or claim counts.`);
  if(q.metric==='procedures')notes.push(`All-procedure count for the selected provider/period scope: ${number(sum(Object.values(scopeTotal.procedures),n=>n))}. Each share uses all procedures in its own provider/period group. Procedure counts do not supply procedure-level revenue.`);
  return {metric:q.metric,scope:[`Period: ${monthLabel(q.months)}.`,`Providers: ${providers.map(shortName).join(', ')}.`,...(q.payers.length?[`Payers for this measure: ${q.payers.join(', ')}.`]:[]),...(q.procedures.length?[`Procedures for this measure: ${q.procedures.join(', ')}.`]:[]),...operationScope(q)],rows,rankings:ranked(rows,q.ranking),scopeTotal:practiceValue(scopeTotal,q),filtered:q.predicate.operator!=='none',notes,query:q};
}
function performance(rows){const r=summarize(rows);return {...r,winRate:r.winRate==null?null:r.winRate*100};}
function quotaRows(reps){return reps.map(rep=>{const i=GTM_DATA.reps.indexOf(rep),r=performance(GTM_DATA.deals.filter(d=>d.quarter===CURRENT_QUARTER&&d.rep===rep)),quota=GTM_DATA.quotas[i];return {name:shortName(rep),...r,quota,attainment:ratio(r.bookings,quota),coverage:quota?r.pipeline/quota:null,shortfall:Math.max(0,quota-r.bookings),overperformance:Math.max(0,r.bookings-quota)};});}
function quotaResult(q){
  const reps=q.reps.length?q.reps:GTM_DATA.reps;
  const individual=quotaRows(reps);
  if(q.groupBy.includes('rep'))return individual.map(r=>({...r,gap:r.quota-r.bookings,grossShortfall:r.shortfall,...(q.groupBy.includes('quarter')?{name:q.groupBy.map(axis=>axis==='quarter'?CURRENT_QUARTER:r.name).join(' · '),dimensions:{quarter:CURRENT_QUARTER,rep:r.name}}:{})}));
  const totals=performance(GTM_DATA.deals.filter(d=>d.quarter===CURRENT_QUARTER&&reps.includes(d.rep)));
  const quota=sum(individual,r=>r.quota),gap=quota-totals.bookings;
  return [{name:q.groupBy.includes('quarter')?CURRENT_QUARTER:'Total',dimensions:q.groupBy.includes('quarter')?{quarter:CURRENT_QUARTER}:{},...totals,quota,attainment:ratio(totals.bookings,quota),coverage:quota?totals.pipeline/quota:null,gap,shortfall:Math.max(0,gap),grossShortfall:sum(individual,r=>r.shortfall),overperformance:sum(individual,r=>r.overperformance)}];
}
function qbrFacts(){
  const current=performance(GTM_DATA.deals.filter(d=>d.quarter===CURRENT_QUARTER));
  const prior=performance(GTM_DATA.deals.filter(d=>d.quarter===PRIOR_QUARTER));
  const reps=quotaRows(GTM_DATA.reps),target=GTM_DATA.targets[CURRENT_QUARTER];
  return {current,prior,target,gap:target-current.bookings,attainment:ratio(current.bookings,target),missedReps:reps.filter(r=>r.shortfall>0).length,grossShortfall:sum(reps,r=>r.shortfall),overperformance:sum(reps,r=>r.overperformance),reps};
}
function gtmQuery(q){
  const hasFilters=q.reps.length||q.specialties.length||q.sources.length;
  let metrics,rows,facts=null;
  if(q.report==='performance'){
    metrics=['bookings','pipeline','wins','losses','closed','winRate','avgACV','avgCycle'];
    const selected=GTM_DATA.deals.filter(d=>q.quarters.includes(d.quarter)&&(!q.reps.length||q.reps.includes(d.rep))&&(!q.specialties.length||q.specialties.includes(d.specialty))&&(!q.sources.length||q.sources.includes(d.source)));
    const axes=q.groupBy.length?q.groupBy:['quarter'];
    const values={quarter:q.quarters,rep:q.reps.length?q.reps:GTM_DATA.reps,specialty:q.specialties.length?q.specialties:GTM_DATA.specialties,source:q.sources.length?q.sources:GTM_DATA.sources};
    rows=partitions(axes,(axis,s)=>values[axis].map(label=>({label:axis==='rep'?shortName(label):label,scope:{rows:s.rows.filter(d=>d[axis]===label)}})),{rows:selected}).map(g=>({name:g.name,dimensions:g.dimensions,...performance(g.scope.rows)}));
    if(!hasFilters&&axes.length===1&&axes[0]==='quarter'){
      metrics.push('target','gap','attainment');
      rows=rows.map(r=>({...r,target:GTM_DATA.targets[r.name],gap:GTM_DATA.targets[r.name]-r.bookings,attainment:ratio(r.bookings,GTM_DATA.targets[r.name])}));
    }
  }else if(q.report==='quota'){
    if(q.quarters.length!==1||q.quarters[0]!==CURRENT_QUARTER||q.specialties.length||q.sources.length||q.groupBy.some(k=>!['rep','quarter'].includes(k)))fail('Rep quotas are supplied only for the full Q1 2025 rep cohort, without specialty/source allocation.');
    metrics=['bookings','pipeline','wins','losses','closed','winRate','avgACV','avgCycle','quota','attainment','coverage','shortfall','grossShortfall','overperformance','gap'];rows=quotaResult(q);
  }else if(q.report==='retention'){
    if(q.quarters.length!==1||q.quarters[0]!==CURRENT_QUARTER||q.reps.length||q.sources.length||q.groupBy.some(k=>!['specialty','quarter'].includes(k)))fail('Retention is supplied only for the Q1 2025 starting-customer cohort, by specialty.');
    metrics=['nrr','customerChurn','customersStart','churned'];
    const selected=GTM_DATA.churn.filter(r=>!q.specialties.length||q.specialties.includes(r.specialty));
    const convert=(name,rs)=>({name,customersStart:sum(rs,r=>r.customersStart),churned:sum(rs,r=>r.churned),priorRevenue:sum(rs,r=>r.priorRevenue),currentRevenue:sum(rs,r=>r.currentRevenue),nrr:ratio(sum(rs,r=>r.currentRevenue),sum(rs,r=>r.priorRevenue)),customerChurn:ratio(sum(rs,r=>r.churned),sum(rs,r=>r.customersStart))});
    rows=q.groupBy.includes('specialty')?selected.map(r=>convert(r.specialty,[r])):[convert('Starting cohort',selected)];
    if(q.groupBy.includes('quarter'))rows=rows.map(row=>({...row,name:q.groupBy.map(axis=>axis==='quarter'?CURRENT_QUARTER:row.name).join(' · '),dimensions:{quarter:CURRENT_QUARTER,...(q.groupBy.includes('specialty')?{specialty:row.name}:{})}}));
  }else if(q.report==='marketing'){
    if(hasFilters||q.groupBy.some(k=>k!=='quarter'))fail('Marketing uses a separate created-lead cohort. Rep, specialty and source attribution are not supplied.');
    metrics=['mqls','sqls','demosBooked','pipelineGenerated','spend'];rows=GTM_DATA.marketing.filter(r=>q.quarters.includes(r.quarter)).map(r=>({name:r.quarter,...r}));
  }else{
    if(q.quarters.length!==1||q.quarters[0]!==CURRENT_QUARTER||hasFilters||q.groupBy.length||q.predicate.operator!=='none'||q.ranking.direction!=='none')fail('The QBR is a full-company Q1 2025 review. Request a performance query for filtered comparisons.');
    metrics=['bookings','pipeline','wins','losses','closed','winRate','avgACV','avgCycle'];facts=qbrFacts();rows=[{name:CURRENT_QUARTER,...facts.current}];
  }
  validateOperations(q,metrics);
  rows=rows.filter(row=>matches(row,q.predicate));
  return {metrics,rows,rankings:ranked(rows,q.ranking),query:q,facts,scope:[`Period: ${q.quarters.join(', ')}.`,`Report: ${q.report}.`,...['reps','specialties','sources'].filter(k=>q[k].length).map(k=>`${k}: ${q[k].join(', ')}.`),...operationScope(q)],notes:q.report==='retention'?['NRR uses summed current revenue / prior revenue for the same starting cohort. Churned customers remain in the denominator; new customers are excluded.']:q.report==='marketing'?['This created-lead cohort is separate from closed-opportunity win rates.']:['Win rate = won / (won + lost). Cycle and mean ACV use won opportunities only. Open pipeline is a separate snapshot, not bookings or a forecast.',...(q.report==='quota'?['Attainment and coverage use summed amounts and full-quarter quotas. Gross rep shortfalls minus rep overperformance equals the signed net quota gap; net shortfall is the positive part of that gap.']:[])]};
}
export function executeQueryTool(name,input){
  validateToolInput(name,input);
  if(name==='request_clarification')return {clarification:input.reason};
  const results=input.queries.map(name==='query_practice'?practiceQuery:gtmQuery);
  if(results.reduce((n,r)=>n+r.rows.length,0)>150)fail('This breakdown is too large. Narrow the period or entity filters.');
  return {domain:name==='query_practice'?'practice':'gtm',results,explain:input.explain};
}
const clarificationText={ambiguous_scope:'Please clarify the measure, period, grouping or filter. No calculation was run.',unsupported_measure:'That measure is not supplied. Please choose a supported count, amount or calculated ratio.',unsupported_breakdown:'That breakdown cannot be calculated from the supplied records. Independent measures can be requested separately.',unavailable_period:'That reporting period is not supplied. Please choose a scenario period.',unknown_entity:'Please clarify the name. No matching provider, rep, payer or procedure was selected.',missing_denominator:'That rate cannot be calculated because its required denominator is not supplied.',missing_evidence:'The records do not establish that cause, forecast or business outcome.',patient_data:'No patient-level records are present. Ask about synthetic aggregate counts and amounts.',unsupported_operation:'That operation is not supported. Please specify a supported comparison or calculation.'};
function supportingRows(r) {
  if(r.metric)return r.rows.map(row=>`${row.name}: ${format(r.metric,row[r.metric])}${row.share===undefined?'':` (${rate(row.share)})`}`);
  const rows=r.rows.map(row=>`${row.name}: ${r.metrics.map(key=>`${labels[key]} ${format(key,row[key])}`).join('; ')}.`);
  if(r.facts)rows.push(...r.facts.reps.map(rep=>`${rep.name}: bookings ${money(rep.bookings)}; quota ${money(rep.quota)}; shortfall ${money(rep.shortfall)}; overperformance ${money(rep.overperformance)}.`));
  return rows;
}
function visibleScope(r) {
  const q=r.query, parts=[r.scope[0]];
  if(q.providers?.length)parts.push(`Providers: ${q.providers.map(shortName).join(', ')}.`);
  for(const [key,label] of [['payers','Payers'],['procedures','Procedures'],['reps','Reps'],['specialties','Specialties'],['sources','Sources']])if(q[key]?.length)parts.push(`${label}: ${q[key].join(', ')}.`);
  return parts.join(' ');
}
export function renderQueryResult(result){
  if(result.clarification)return {text:clarificationText[result.clarification],scope:[],details:[]};
  const lines=[],scope=[],details=[];
  for(const [index,r] of result.results.entries()){
    if(lines.length)lines.push('');
    lines.push(visibleScope(r));
    scope.push(`Query ${index+1}: ${r.metric?labels[r.metric]:r.query.report}.`,...r.scope);
    const notes=[...r.notes,'Displayed values are rounded; calculations, filters and ties use unrounded values.'];
    if(r.metric)notes.push(`${r.filtered?'Scope total before group filter':'Scope total'}: ${format(r.metric,r.scopeTotal)}.`);
    details.push({title:r.metric?labels[r.metric]:r.query.report,notes,rows:supportingRows(r)});
    if(r.facts){
      const f=r.facts;
      lines.push(`Bookings ${money(f.current.bookings)} against target ${money(f.target)} (${rate(f.attainment)} attainment).`,
        `${f.missedReps} of ${f.reps.length} reps missed quota. Gross rep shortfalls ${money(f.grossShortfall)} minus overperformance ${money(f.overperformance)} = net company shortfall ${money(f.gap)}.`,
        `Closed-cohort win rate: ${rate(f.prior.winRate)} in ${PRIOR_QUARTER} → ${rate(f.current.winRate)} in ${CURRENT_QUARTER}. Wins: ${f.prior.wins} → ${f.current.wins}; mean won ACV: ${money(f.prior.avgACV)} → ${money(f.current.avgACV)}.`);
      const extra=(result.displayMetrics||[]).filter(key=>['pipeline','losses','closed','avgCycle'].includes(key));
      if(extra.length)lines.push(extra.map(key=>`${labels[key]}: ${format(key,f.current[key])}`).join('; ')+'.');
    }else if(r.rankings.length){
      for(const ranking of r.rankings){
        const metric=r.query.ranking.metric;
        const name=row=>ranking.within?r.query.groupBy.filter(axis=>!r.query.ranking.within.includes(axis)).map(axis=>row.dimensions[axis]).join(' · '):row.name;
        const context=row=>{
          const count=['avgCycle','avgACV'].includes(metric)?`; ${number(row.wins)} wins`:metric==='winRate'?`; ${row.wins} / ${row.closed} closed opportunities`:'';
          const shown=new Set([metric,...(['avgCycle','avgACV','winRate'].includes(metric)?['wins']:[]),...(metric==='winRate'?['closed']:[])]);
          const extra=(result.displayMetrics||[]).filter(key=>r.metrics?.includes(key)&&!shown.has(key));
          return count+extra.map(key=>`; ${labels[key]} ${format(key,row[key])}`).join('');
        };
        lines.push(`${ranking.direction==='highest'?'Highest':'Lowest'} ${labels[metric]}${ranking.within?` for ${ranking.within}`:''}: ${ranking.rows.length?ranking.rows.map(row=>`${name(row)} (${format(metric,row[metric])}${context(row)})`).join('; '):'No matching groups'}.`);
      }
    }else if(!r.rows.length){
      lines.push('No groups match the selected scope and numeric filter.');
    }else if(r.metric){
      lines.push(`${labels[r.metric]}:`,...supportingRows(r));
    }else{
      const selected=r.metrics.filter(key=>!result.displayMetrics?.length||result.displayMetrics.includes(key));
      const metrics=selected.length?selected:r.metrics;
      lines.push(...r.rows.map(row=>`${row.name}: ${metrics.map(key=>`${labels[key]} ${format(key,row[key])}`).join('; ')}.`));
    }
    if(r.metric==='patients')lines.push('Monthly counts are summed; these are not unique patients across months.');
    if(r.metric==='avgReimb')lines.push('Unweighted mean of provider-month reimbursement averages.');
    if(r.metric==='collectionRatio')lines.push('Summed collections ÷ summed revenue; independently generated synthetic amounts can produce ratios above 100%.');
    if(!r.rankings.length&&['payerRevenue','procedures'].includes(r.metric)&&r.rows.some(row=>row.share!==undefined))lines.push(r.metric==='payerRevenue'?'Shares use all-payer revenue within each displayed provider/period group.':'Shares use all procedure counts within each displayed provider/period group.');
    if(r.filtered)lines.push(r.scope.find(line=>line.startsWith('Filter after aggregation:')));
  }
  if(result.explain||result.results.some(r=>r.facts)){
    lines.push('','These records do not establish causes.');
    if(result.results.some(r=>r.facts))lines.push('Next check: compare loss reasons, deal sizes and sales stages for the missed-quota cohorts.');
    for(const detail of details)detail.notes.push('Loss reasons, activity history, legal-review dates, payment allocation and causal experiments are not supplied. Proposed investigations are not proven improvements.');
  }
  return {text:lines.filter(line=>line!==undefined).join('\n'),scope,details};
}
