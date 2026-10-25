import test from 'node:test';
import assert from 'node:assert/strict';
import { answerWithQueryTools, validateQuestionConstraints } from '../lib/query-service.mjs';
import { normalizeQueryLanguage, practicePeriods } from '../lib/query-language.mjs';
import { validateResultCoverage } from '../lib/query-coverage.mjs';
import { executeQueryTool, renderQueryResult } from '../lib/query-engine.mjs';

const predicate=(metric,operator='none',value=null)=>({metric,operator,value});
const ranking=(metric,direction='none',within=[])=>({metric,direction,within,limit:1});
const practice=(metric,months,extra={})=>({metric,months,providers:[],payers:[],procedures:[],groupBy:['provider'],predicate:predicate(metric),ranking:ranking(metric),...extra});
const gtm=(report='performance',extra={})=>({report,quarters:['Q1 2025'],reps:[],specialties:[],sources:[],groupBy:['rep'],predicate:predicate('bookings'),ranking:ranking('bookings'),...extra});
const client=(domain,queries)=>({messages:{create:async()=>({stop_reason:'tool_use',content:[{type:'tool_use',id:'coverage-test',name:`query_${domain}`,input:{queries,explain:false}}]})}});
const answer=(domain,question,queries)=>answerWithQueryTools({domain,question,client:client(domain,queries)});

test('unsupported operations and mixed-cohort measures cannot become partial numeric answers',async()=>{
  const questions=[
    ['gtm','Show marketing spend and created-lead win rate by quarter.'],
    ['gtm','What was the percentage growth in bookings from Q4 2024 to Q1 2025?'],
    ['gtm','Show bookings and ARR in Q1 2025.'],
    ['gtm','Show bookings and revenue in Q1 2025.'],
    ['gtm','Show spend and conversion rate in Q1 2025.'],
    ['practice','Show revenue and percentage growth in 2025.'],
    ['practice','Show no-show counts and cancellation counts in 2025.'],
  ];
  for(const [domain,question] of questions){
    const response=await answerWithQueryTools({domain,question,client:{messages:{create:async()=>{throw Error('Unsupported operation must fail before the model');}}}});
    assert.equal(response.source,'query-clarification');assert.equal(response.toolCalls.length,0);assert.doesNotMatch(response.content[0].text,/\$|Scope total/);
  }
});

test('each supported GTM measure is required in the actual calculated result',()=>{
  const cases=[
    ['Show bookings','performance'],['Show pipeline','performance'],['Show win rate','performance'],['Show wins','performance'],['Show losses','performance'],
    ['Show closed opportunities','performance'],['Show mean won ACV','performance'],['Show sales cycle','performance'],
    ['Show target','quota'],['Show quota','quota'],['Show attainment','quota'],['Show shortfall','quota'],['Show pipeline coverage','quota'],
    ['Show net revenue retention','retention'],['Show customer churn','retention'],['Show starting customers','retention'],
    ['Show MQLs','marketing'],['Show SQLs','marketing'],['Show demos booked','marketing'],['Show marketing spend','marketing'],
  ];
  for(const [question,report] of cases){
    const query=gtm(report,{groupBy:report==='marketing'?['quarter']:report==='retention'?[]:['rep']});
    const result=executeQueryTool('query_gtm',{queries:[query],explain:false});
    assert.doesNotThrow(()=>validateResultCoverage('gtm',question.toLowerCase(),result),question);
    assert.throws(()=>validateResultCoverage('gtm',question.toLowerCase(),{...result,results:result.results.map(r=>({...r,metrics:[]}))}),/not calculated/,question);
  }
});

test('a valid report cannot hide a dropped measure; explicitly independent cohorts remain supported',async()=>{
  const marketing=gtm('marketing',{groupBy:['quarter']});
  const partial=await answer('gtm','Show marketing spend and closed-cohort win rate in Q1 2025.',[marketing]);
  assert.equal(partial.source,'query-clarification');assert.match(partial.content[0].text,/win rate.*not calculated/);
  const complete=await answer('gtm','Show marketing spend and closed-cohort win rate in Q1 2025.',[marketing,gtm('performance',{groupBy:['quarter']})]);
  assert.equal(complete.source,'validated-query');assert.match(complete.content[0].text,/Marketing spend \$240,000/);assert.match(complete.content[0].text,/win rate 24.8%/);
  assert.doesNotMatch(complete.content[0].text,/MQLs|Mean won ACV/);
  const independent=await answer('gtm','Show created-lead pipeline and closed-cohort win rate in Q1 2025.',[marketing,gtm('performance',{groupBy:['quarter']})]);
  assert.equal(independent.source,'validated-query');assert.match(independent.content[0].text,/Created-lead pipeline \$2,200,000/);assert.match(independent.content[0].text,/win rate 24.8%/);assert.doesNotMatch(independent.content[0].text,/Open qualified pipeline/);
  const wrongCohort=await answer('gtm','Show created-lead pipeline in Q1 2025.',[gtm('performance',{groupBy:['quarter']})]);assert.equal(wrongCohort.source,'query-clarification');
});

test('written thresholds preserve value, direction and strictness without inventing a ranking',async()=>{
  for(const [words,operator,value] of [['at most twelve','lte',12],['no more than twenty-five','lte',25],['at least one hundred and five','gte',105],['under zero','lt',0],['exactly twelve','eq',12]]){
    const query=practice('noShows',[0],{predicate:predicate('noShows',operator,value)});
    const response=await answer('practice',`Which providers had ${words} no-shows in January 2025?`,[query]);
    assert.equal(response.source,'validated-query',response.content[0].text);
    const wrong={...query,predicate:predicate('noShows',operator,value+1)};
    assert.throws(()=>validateQuestionConstraints('practice',`Which providers had ${words} no-shows in January 2025?`,{queries:[wrong]}),/threshold/);
  }
  assert.match(normalizeQueryLanguage('at least four hundred thousand'),/at least 400000/);
  assert.match(normalizeQueryLanguage('top two'),/top 2/);
});

test('supported missed-quota negation executes the same filtered cohort; unrelated exclusions still decline',async()=>{
  const query=gtm('quota',{predicate:predicate('attainment','lt',100)});
  for(const wording of ['did not hit','did not meet',"didn't reach",'have not achieved']){
    const result=await answer('gtm',`Which reps ${wording} quota in Q1 2025?`,[query]);
    assert.equal(result.source,'validated-query',result.content[0].text);assert.equal(result.toolCalls[0].result.results[0].rows.length,5);
  }
  assert.throws(()=>validateQuestionConstraints('gtm','Which reps did not hit quota in Q1 2025?',{queries:[gtm('quota')]}),/missed-quota filter/);
  const qbr=await answer('gtm','Why was Q1 2025 not at target?',[gtm('qbr',{groupBy:[]})]);assert.equal(qbr.source,'validated-query');assert.match(qbr.content[0].text,/\$260,000/);
  const exclusion=await answer('gtm','Show bookings not from Referral in Q1 2025.',[gtm()]);assert.equal(exclusion.source,'query-clarification');
});

test('all pairs of independent inclusive month ranges stay bound to their own measures',()=>{
  const names=['January','February','March','April','May','June','July','August','September','October','November','December'];
  for(let a=0;a<12;a++)for(let b=a;b<12;b++)for(const [c,d] of [[0,2],[3,5],[6,8],[9,11]]){
    const first=Array.from({length:b-a+1},(_,i)=>a+i),second=Array.from({length:d-c+1},(_,i)=>c+i);
    const question=`Show revenue for ${names[a]} through ${names[b]} and collections for ${names[c]} through ${names[d]} 2025.`;
    const queries=[practice('revenue',first),practice('collections',second)];
    assert.doesNotThrow(()=>validateQuestionConstraints('practice',question,{queries}),question);
    if(first.join(',')!==second.join(','))assert.throws(()=>validateQuestionConstraints('practice',question,{queries:[practice('revenue',second),practice('collections',first)]}),/independent measure/);
  }
  assert.deepEqual(practicePeriods('between july and december').months,[6,7,8,9,10,11]);
  assert.deepEqual(practicePeriods('q1 through q3').months,[0,1,2,3,4,5,6,7,8]);
  const named=validateQuestionConstraints('practice','Show January revenue for Lin and February collections for Shah in 2025.',{queries:[practice('revenue',[0],{providers:['Dr. Anya Lin']}),practice('collections',[1],{providers:['Dr. Priya Shah']})]});
  assert.equal(named,undefined);
});

test('ranked responses lead with winners while keeping every supporting value inspectable',()=>{
  const result=executeQueryTool('query_practice',{queries:[practice('revenue',Array.from({length:12},(_,i)=>i),{groupBy:['month','provider'],ranking:ranking('revenue','lowest',['month'])})],explain:false});
  const rendered=renderQueryResult(result);
  assert.equal((rendered.text.match(/Lowest Revenue for/g)||[]).length,12);
  assert.match(rendered.text,/Lowest Revenue for Apr: Singh \(\$110,374\)/);
  assert.doesNotMatch(rendered.text,/Jan · Lin|Grouping:|Ranking:|Scope total/);
  assert.equal(rendered.details[0].rows.length,60);assert.match(rendered.details[0].rows[0],/Jan · Lin: \$117,878/);
  assert.ok(rendered.text.length<1200);
  const qbr=renderQueryResult(executeQueryTool('query_gtm',{queries:[gtm('qbr',{groupBy:[]})],explain:true}));
  assert.equal((qbr.text.match(/\$2,140,000/g)||[]).length,1);assert.match(qbr.text,/5 of 6 reps/);assert.match(qbr.text,/\$314,000.*\$54,000.*\$260,000/);
  assert.doesNotMatch(qbr.text,/Report: qbr|overperformance \$0|Review comparable underlying records/);
  assert.ok(qbr.details[0].rows.some(row=>row.startsWith('Chen:')));
});

test('compact answers retain explicitly requested extra metrics and avoid irrelevant share notes',()=>{
  const qbr=validateResultCoverage('gtm','show bookings, pipeline and mean won cycle against target',executeQueryTool('query_gtm',{queries:[gtm('qbr',{groupBy:[]})],explain:false}));
  const text=renderQueryResult(qbr).text;
  assert.match(text,/Open qualified pipeline: \$7,200,000/);assert.match(text,/Mean won cycle: 48.45 days/);
  const ranked=validateResultCoverage('gtm','show bookings for the rep with the longest sales cycle',executeQueryTool('query_gtm',{queries:[gtm('performance',{ranking:ranking('avgCycle','highest')})],explain:false}));
  assert.match(renderQueryResult(ranked).text,/Kim.*68 days; 2 wins; Bookings \(won ACV\) \$250,000/);
  const payer=executeQueryTool('query_practice',{queries:[practice('payerRevenue',Array.from({length:12},(_,i)=>i),{groupBy:['payer'],ranking:ranking('payerRevenue','lowest')})],explain:false});
  assert.doesNotMatch(renderQueryResult(payer).text,/Shares use/);
});
