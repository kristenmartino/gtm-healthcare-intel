import { QueryError } from './query-contract.mjs';

// Requirements are checked against fields actually returned by the calculator,
// not merely against the report name chosen by the model.
const gtmMeasures = [
  {name:'bookings',pattern:/\b(?:bookings?|won acv)\b/,fields:['bookings']},
  {name:'pipeline',pattern:/\bpipeline\b/,fields:['pipeline','pipelineGenerated']},
  {name:'created-lead pipeline',pattern:/\b(?:created[- ]leads?|marketing[- ]sourced|marketing)\s+pipeline\b/,fields:['pipelineGenerated']},
  {name:'win rate',pattern:/\bwin[- ]rates?\b/,fields:['winRate']},
  {name:'wins',pattern:/\b(?:wins|won (?:deals|opportunities))\b/,fields:['wins']},
  {name:'losses',pattern:/\b(?:losses|lost (?:deals|opportunities))\b/,fields:['losses']},
  {name:'closed opportunities',pattern:/\bclosed (?:counts?|opportunities|deals)\b/,fields:['closed']},
  {name:'mean ACV',pattern:/\b(?:average|mean|avg) (?:won )?(?:acv|deal size)\b/,fields:['avgACV']},
  {name:'sales cycle',pattern:/\b(?:sales cycle|won cycle|cycle length|average cycle)\b/,fields:['avgCycle']},
  {name:'target',pattern:/\btargets?\b/,fields:['target','quota']},
  {name:'quota',pattern:/\bquotas?\b/,fields:['quota','target']},
  {name:'attainment',pattern:/\battainment\b/,fields:['attainment']},
  {name:'shortfall',pattern:/\bshortfalls?\b/,fields:['shortfall','gap']},
  {name:'gross rep shortfalls',pattern:/\bgross\s+(?:rep\s+)?shortfalls?\b/,fields:['grossShortfall']},
  {name:'net gap',pattern:/\b(?:(?:net|target|quota)\s+)?gap\b/,fields:['gap']},
  {name:'overperformance',pattern:/\b(?:overperformance|over[- ]performance|surplus)\b/,fields:['overperformance']},
  {name:'pipeline coverage',pattern:/\bcoverage\b/,fields:['coverage']},
  {name:'net revenue retention',pattern:/\b(?:nrr|net revenue retention)\b/,fields:['nrr']},
  {name:'customer churn',pattern:/\bchurn(?:ed)?\b/,fields:['customerChurn','churned']},
  {name:'starting customers',pattern:/\b(?:starting customers|start customers|customers at (?:the )?start)\b/,fields:['customersStart']},
  {name:'MQLs',pattern:/\b(?:mqls?|marketing[- ]qualified leads?)\b/,fields:['mqls']},
  {name:'SQLs',pattern:/\b(?:sqls?|sales[- ]qualified leads?)\b/,fields:['sqls']},
  {name:'demos booked',pattern:/\bdemos?(?: booked)?\b/,fields:['demosBooked']},
  {name:'marketing spend',pattern:/\b(?:spend|spending|marketing costs?)\b/,fields:['spend']},
];

export function quotaTotalRequested(text){
  const quotaMeasure=/\b(?:quotas?|attainment|coverage|shortfalls?)\b/.test(text);
  const total=/\b(?:combined|aggregate|aggregated|total|overall|together|sum|company)\b/.test(text);
  const breakdown=/\b(?:by|per|each|every|which)\s+(?:sales\s+)?reps?\b/.test(text);
  return quotaMeasure&&total&&(!breakdown||/\b(?:company|overall|grand)\s+(?:total|quota|attainment|coverage)\b|\band\s+(?:the\s+)?(?:combined\s+)?total\b/.test(text));
}

export function unsupportedRequest(domain, text) {
  if(/\b(?:growth|grew|grown|cagr)\b|\bpercent(?:age)?\b[^?.;]{0,80}\b(?:change|increase|decrease|grow|higher|lower)\b|\b(?:change|increase|decrease)\b[^?.;]{0,80}\bpercent(?:age)?\b/.test(text))
    return 'Growth and percentage-change calculations are not supported by these query tools. Ask for the values in each period instead; no partial calculation was returned.';
  if(domain==='gtm'){
    if(quotaTotalRequested(text)&&/\breps?\s+(?:who|with|that|did|have|has|had|were|are|below|above|under|over)\b/.test(text))
      return 'For a combined quota total, name the reps explicitly. Filtering reps by a measure before totalling is not supported by this query tool.';
    if(/\b(?:arr|annual recurring revenue|cac|customer acquisition cost|ltv|lifetime value|gross revenue retention|grr|roi|return on investment|conversion)\b/.test(text)||/\brevenues?\b/.test(text.replace(/\bnet revenue retention\b/g,'')))
      return 'A requested measure is not supplied by the GTM query tools. No partial answer was returned.';
    if(text.split(/\band\b|[;,]/).some(clause=>/\b(?:created[- ]leads?|lead[- ]to[- ]win|marketing[- ]cohort|marketing[- ]sourced)\b/.test(clause)&&/\b(?:win[- ]rates?|conversion[- ]rates?)\b/.test(clause)))
      return 'Created-lead win rates cannot be calculated: marketing leads are not linked to closed outcomes. Marketing spend and closed-opportunity win rates are separate cohorts; no partial answer was returned.';
  }else{
    if(/\b(?:cancellations?|cancelled appointments?|canceled appointments?)\b/.test(text))
      return 'Cancellation counts are not supplied. No partial answer was returned; no-show counts are a separate measure.';
    if(/\b(?:no[- ]?show|denial|denied claim)[- ]rates?\b/.test(text))
      return 'That rate cannot be calculated because its required denominator is not supplied. Ask for counts instead.';
  }
  return null;
}

export function validateResultCoverage(domain, question, result) {
  const unsupported=unsupportedRequest(domain,question);
  if(unsupported)throw new QueryError(unsupported);
  if(domain!=='gtm')return result;
  const available=new Set(result.results.flatMap(r=>r.metrics));
  // These fields are calculated and displayed by the QBR facts renderer.
  if(result.results.some(r=>r.facts))for(const field of ['target','gap','attainment','quota','shortfall','grossShortfall','overperformance'])available.add(field);
  const matches=gtmMeasures.filter(m=>m.pattern.test(question));
  const requested=matches.filter(m=>(m.name!=='pipeline'||!matches.some(other=>other.name==='created-lead pipeline')||/\b(?:open|qualified)\s+pipeline\b/.test(question))&&(m.name!=='shortfall'||!matches.some(other=>other.name==='gross rep shortfalls')||/\bnet\s+shortfall\b/.test(question)));
  for(const measure of requested)if(!measure.fields.some(field=>available.has(field)))
    throw new QueryError(`The requested ${measure.name} was not calculated for this scope. Please clarify the measures or request separate supported cohorts; no partial answer was returned.`);
  const displayMetrics=[...new Set(requested.map(m=>m.fields.find(field=>available.has(field))).filter(Boolean))];
  if(displayMetrics.includes('quota'))for(const field of ['bookings','attainment'])if(available.has(field)&&!displayMetrics.includes(field))displayMetrics.push(field);
  return {...result,displayMetrics};
}
