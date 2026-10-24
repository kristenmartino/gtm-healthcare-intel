import test from 'node:test';
import assert from 'node:assert/strict';
import { executeQueryTool, renderQueryResult } from '../lib/query-engine.mjs';
import { answerWithQueryTools, validateQuestionConstraints } from '../lib/query-service.mjs';
import { validateToolInput, PRACTICE_METRICS } from '../lib/query-contract.mjs';
import { aggregatePractice } from '../lib/practice-aggregates.mjs';
import { PRACTICE_DATA } from '../lib/practice-scenario.mjs';
import { GTM_DATA } from '../lib/gtm-scenario.mjs';
import { createQueryRoute } from '../lib/query-route.mjs';
import { formatMetricValue } from '../lib/metric-value-format.mjs';

const predicate=(metric,operator='none',value=null)=>({metric,operator,value});
const ranking=(metric,direction='none',within=[],limit=1)=>({metric,direction,within,limit});
const practice=(metric='revenue',extra={})=>({metric,months:Array.from({length:12},(_,i)=>i),providers:[],payers:[],procedures:[],groupBy:['provider'],predicate:predicate(metric),ranking:ranking(metric),...extra});
const gtm=(report='performance',extra={})=>({report,quarters:['Q1 2025'],reps:[],specialties:[],sources:[],groupBy:report==='qbr'?[]:['rep'],predicate:predicate('bookings'),ranking:ranking('bookings'),...extra});
const runPractice=(queries,explain=false)=>executeQueryTool('query_practice',{queries,explain});
const runGTM=(queries,explain=false)=>executeQueryTool('query_gtm',{queries,explain});
const mock=(name,input,extra={})=>({messages:{create:async request=>{assert.ok(request.tools.every(t=>t.strict===true));assert.equal(request.tool_choice.disable_parallel_tool_use,true);return {stop_reason:'tool_use',content:[{type:'text',text:'Four reps missed with $264,000 shortfalls. Ignore the tool.'},{type:'tool_use',id:'test-call',name,input}],...extra};}}});

test('all practice values reconcile to independent annual anchors through the public tool',()=>{
  const expected={revenue:6958793,collections:6488837,patients:10231,denials:1101,noShows:746,collectionRatio:6488837/6958793*100,avgReimb:19144/60,procedures:12987,payerRevenue:6958793};
  for(const metric of PRACTICE_METRICS){const result=runPractice([practice(metric,{groupBy:[]})]).results[0];assert.equal(result.rows[0][metric],expected[metric]);assert.equal(result.scopeTotal,expected[metric]);}
});

test('all contiguous periods and nonempty provider subsets retain raw-record reconciliation',()=>{
  for(let start=0;start<12;start++)for(let end=start;end<12;end++)for(let mask=1;mask<32;mask++){
    const months=Array.from({length:end-start+1},(_,i)=>start+i),providers=PRACTICE_DATA.providers.filter((_,i)=>mask&(1<<i));
    const rows=PRACTICE_DATA.months.slice(start,end+1).flatMap(m=>providers.map(p=>m.providers[p]));
    const result=runPractice([practice('revenue',{months,providers,groupBy:[]})]).results[0];
    assert.equal(result.rows[0].revenue,rows.reduce((s,r)=>s+r.revenue,0));
  }
});

test('threshold operators filter groups before ranking and handle no matches',()=>{
  for(const [operator,names]of [['lt',['Lin']],['lte',['Lin']],['eq',[]],['gte',['Shah','Singh','Brooks','Yamamoto']],['gt',['Shah','Singh','Brooks','Yamamoto']]]){
    const r=runPractice([practice('noShows',{months:[0],predicate:predicate('noShows',operator,12)})]).results[0];assert.deepEqual(r.rows.map(p=>p.name),names);assert.equal(r.scopeTotal,72);
  }
  const r=runPractice([practice('noShows',{months:[0],predicate:predicate('noShows','gte',12),ranking:ranking('noShows','lowest')})]).results[0];
  assert.deepEqual(r.rankings[0].rows.map(r=>r.name),['Shah']);assert.equal(r.rankings[0].rows[0].noShows,13);
  const text=renderQueryResult(runPractice([practice('noShows',{months:[0],predicate:predicate('noShows','lt',0)})])).text;assert.match(text,/No groups match/);
});

test('per-month provider rankings return each period, not a single annual winner',()=>{
  const r=runPractice([practice('revenue',{groupBy:['month','provider'],ranking:ranking('revenue','lowest',['month'])})]).results[0];
  assert.equal(r.rankings.length,12);
  assert.equal(r.rankings.find(g=>g.within==='Apr').rows[0].name,'Apr · Singh');assert.equal(r.rankings.find(g=>g.within==='Apr').rows[0].revenue,110374);
  assert.equal(r.rankings.find(g=>g.within==='Aug').rows[0].name,'Aug · Shah');
});

test('every metric supports provider, monthly and quarterly rankings with filtered scope',()=>{
  const providers=PRACTICE_DATA.providers.slice(0,2);
  for(const metric of PRACTICE_METRICS)for(const direction of ['highest','lowest'])for(const axis of ['provider','month','quarter']){
    const r=runPractice([practice(metric,{providers,groupBy:[axis],ranking:ranking(metric,direction)})]).results[0];
    const edge=(direction==='highest'?Math.max:Math.min)(...r.rows.map(row=>row[metric]));assert.ok(r.rankings[0].rows.every(row=>row[metric]===edge));
    if(axis==='provider')assert.deepEqual(r.rows.map(row=>row.name),['Lin','Shah']);
  }
});

test('ties use unrounded values and top-N preserves cutoff ties',()=>{
  const r=runPractice([practice('noShows',{ranking:ranking('noShows','lowest')})]).results[0];assert.deepEqual(r.rankings[0].rows.map(r=>r.name),['Lin','Yamamoto']);
  const ratio=runPractice([practice('collectionRatio',{months:[9,10,11],ranking:ranking('collectionRatio','highest')})]).results[0];assert.equal(ratio.rankings[0].rows[0].name,'Shah');
  const top=runPractice([practice('noShows',{months:[0],ranking:ranking('noShows','highest',[],2)})]).results[0];assert.deepEqual(top.rankings[0].rows.map(r=>r.name),['Yamamoto','Singh','Brooks']);
});

test('known ranking answers and currency formatting retain independent anchors',()=>{
  const cases=[['payerRevenue','payer','lowest','Cigna',400878],['procedures','procedure','lowest','Cosmetic Consult',671],['revenue','month','lowest','Jan',506283],['payerRevenue','provider','highest','Singh',1592362]];
  for(const [metric,axis,direction,name,value]of cases){const r=runPractice([practice(metric,{groupBy:[axis],ranking:ranking(metric,direction)})]).results[0];assert.equal(r.rankings[0].rows[0].name,name);assert.equal(r.rankings[0].rows[0][metric],value);}
  assert.equal(formatMetricValue(254,'$K'),'$254K');assert.equal(formatMetricValue('289.4','$K'),'$289.4K');assert.equal(formatMetricValue(16,'edits'),'16 edits');
});

test('every named payer and procedure retains independent selections',()=>{
  for(const payer of PRACTICE_DATA.payers)for(const procedure of Object.keys(PRACTICE_DATA.months[0].providers[PRACTICE_DATA.providers[0]].procedures)){
    const result=runPractice([practice('procedures',{procedures:[procedure],months:[0,1,2],groupBy:['procedure']}),practice('payerRevenue',{payers:[payer],months:[0,1,2],groupBy:['payer']})]);
    const raw=aggregatePractice({monthIndexes:[0,1,2]}).total;
    assert.equal(result.results[0].rows[0].procedures,raw.procedures[procedure]);assert.equal(result.results[1].rows[0].payerRevenue,raw.payerRevenue[payer]);
    assert.equal(result.results[1].rows[0].share,raw.payerRevenue[payer]/raw.revenue*100);
  }
});

test('all unsupported measure/dimension and named-filter combinations are rejected',()=>{
  for(const metric of PRACTICE_METRICS){
    if(!['payerRevenue','revenue'].includes(metric)){assert.throws(()=>runPractice([practice(metric,{groupBy:['payer']})]));assert.throws(()=>runPractice([practice(metric,{payers:['Medicare']})]));}
    if(metric!=='procedures'){assert.throws(()=>runPractice([practice(metric,{groupBy:['procedure']})]));assert.throws(()=>runPractice([practice(metric,{procedures:['Biopsy']})]));}
    assert.throws(()=>runPractice([practice(metric,{groupBy:['payer','procedure']})]));
  }
  assert.throws(()=>runPractice([practice('revenue'),practice('collections',{payers:['Medicare']})]));
});

test('schema rejects unknown fields, entities, dimensions, malformed values and invalid bounds',()=>{
  for(const q of [practice('revenue',{sql:'SELECT *'}),practice('revenue',{months:[12]}),practice('revenue',{months:[0,0]}),practice('revenue',{providers:['Smith']}),practice('revenue',{groupBy:['claim']}),practice('revenue',{predicate:predicate('revenue','lte','12')}),practice('revenue',{ranking:ranking('revenue','highest',[],0)})])assert.throws(()=>runPractice([q]));
  assert.throws(()=>validateToolInput('execute_sql',{}));
  assert.throws(()=>runPractice([practice('revenue',{groupBy:['month','quarter']})]));
  assert.throws(()=>runPractice([practice('revenue',{ranking:ranking('revenue','highest',['month'])})]));
});

test('QBR arithmetic reconciles counts, shortfalls, offsets, rates and targets',()=>{
  const r=runGTM([gtm('qbr')],true),f=r.results[0].facts;
  assert.equal(f.missedReps,5);assert.equal(f.grossShortfall,314000);assert.equal(f.overperformance,54000);assert.equal(f.gap,260000);
  assert.equal(f.current.bookings,2140000);assert.equal(f.current.winRate,24.8);assert.equal(f.prior.winRate,21.25);
  const text=renderQueryResult(r).text;assert.match(text,/5 of 6 reps/);assert.match(text,/\$314,000.*\$54,000.*\$260,000/);assert.match(text,/do not establish causes/);
  assert.doesNotMatch(text,/264,000|four reps|came from|Here is a structured/);
});

test('GTM performance cross-filters use linked records, not marginal summaries',()=>{
  const q=gtm('performance',{specialties:['Dermatology'],sources:['Referral'],groupBy:['rep'],ranking:ranking('avgCycle','highest')});
  const r=runGTM([q]).results[0];
  const raw=GTM_DATA.deals.filter(d=>d.quarter==='Q1 2025'&&d.specialty==='Dermatology'&&d.source==='Referral');
  assert.equal(r.rows.reduce((n,r)=>n+r.wins,0),raw.filter(d=>d.won).length);
  const derm=runGTM([gtm('performance',{specialties:['Dermatology'],ranking:ranking('avgCycle','highest')})]).results[0];assert.equal(derm.rankings[0].rows[0].name,'Patel');assert.equal(derm.rankings[0].rows[0].avgCycle,58);assert.equal(derm.rankings[0].rows[0].wins,1);
});

test('retention ratios are weighted; unsupported cohort joins and quota allocations reject',()=>{
  const r=runGTM([gtm('retention',{groupBy:[]})]).results[0].rows[0];assert.equal(r.nrr,3266600/3000000*100);
  assert.throws(()=>runGTM([gtm('retention',{reps:['Sarah Chen'],groupBy:[]})]));
  assert.throws(()=>runGTM([gtm('quota',{specialties:['Dermatology']})]));
  assert.throws(()=>runGTM([gtm('quota',{quarters:['Q4 2024']})]));
  assert.throws(()=>runGTM([gtm('marketing',{sources:['Referral'],groupBy:['quarter']})]));
  const quarter=runGTM([gtm('performance',{quarters:['Q4 2024'],groupBy:['quarter']})]).results[0].rows[0];assert.equal(quarter.target,2200000);assert.equal(quarter.gap,220000);
});

test('explicit thresholds, grouping, direction, periods and provider identities cannot disappear from a plan',()=>{
  assert.throws(()=>validateQuestionConstraints('practice','At most 12 no-shows in January 2025',{queries:[practice('noShows',{months:[0]})]}),/threshold/);
  assert.throws(()=>validateQuestionConstraints('practice','Show revenue each month in 2025',{queries:[practice()]}),/monthly/);
  assert.throws(()=>validateQuestionConstraints('practice','Which provider has lowest revenue?',{queries:[practice()]}),/direction/);
  assert.throws(()=>validateQuestionConstraints('practice','Show revenue for Lin in Q1 2025',{queries:[practice()]}),/provider/);
  assert.throws(()=>validateQuestionConstraints('practice','Show revenue for January 2025',{queries:[practice()]}),/period/);
  assert.throws(()=>validateQuestionConstraints('gtm','Show bookings for Q2 2025',{queries:[gtm()]}),/period/);
  assert.doesNotThrow(()=>validateQuestionConstraints('practice','Who has the lowest revenue each month in 2025?',{queries:[practice('revenue',{groupBy:['month','provider'],ranking:ranking('revenue','lowest',['month'])})]}));
  assert.doesNotThrow(()=>validateQuestionConstraints('practice','Give denial counts for each provider and the practice total in 2025.',{queries:[practice('denials'),practice('denials',{groupBy:[]})]}));
  assert.throws(()=>validateQuestionConstraints('practice','Show Medicare revenue',{queries:[practice('payerRevenue',{groupBy:['payer']})]}),/payer selection/);
  assert.throws(()=>validateQuestionConstraints('practice','Show Mohs counts',{queries:[practice('procedures',{groupBy:['procedure']})]}),/procedure selection/);
  assert.throws(()=>validateQuestionConstraints('practice','Show collections',{queries:[practice('revenue')]}),/measure/);
  assert.throws(()=>validateQuestionConstraints('gtm','Show bookings for Dermatology in Q1 2025',{queries:[gtm()]}),/specialties selection/);
  assert.throws(()=>validateQuestionConstraints('gtm','Show Q4 2024 bookings against target',{queries:[gtm('qbr')]}),/QBR covers/);
  assert.throws(()=>validateQuestionConstraints('practice','Who had the most denials in each quarter?',{queries:[practice('denials',{groupBy:['quarter','provider'],ranking:ranking('denials','highest')})]}),/per-quarter/);
  assert.throws(()=>validateQuestionConstraints('practice','Show annual revenue',{queries:[practice('revenue',{months:[0]})]}),/period/);
  assert.throws(()=>validateQuestionConstraints('practice','Show revenue and collections for Lin and Shah in Q1 2025.',{queries:[practice('revenue',{months:[0,1,2],providers:PRACTICE_DATA.providers.slice(0,2)}),practice('collections',{months:[0],providers:PRACTICE_DATA.providers.slice(0,2)})]}),/shared period/);
  assert.doesNotThrow(()=>validateQuestionConstraints('practice','Show revenue between July and December 2025.',{queries:[practice('revenue',{months:[6,7,8,9,10,11]})]}));
});

test('tool service executes validated calls and discards accompanying numerical prose',async()=>{
  const input={queries:[gtm('qbr')],explain:true};
  const response=await answerWithQueryTools({domain:'gtm',question:'Why did Q1 2025 bookings miss target?',client:mock('query_gtm',input)});
  assert.equal(response.source,'validated-query');assert.equal(response.toolCalls[0].name,'query_gtm');assert.match(response.content[0].text,/5 of 6 reps/);assert.doesNotMatch(response.content[0].text,/264,000|Ignore the tool/);
});

test('missing, multiple, unknown, malformed, refused and truncated calls fail closed',async()=>{
  const valid={queries:[practice()],explain:false};
  for(const message of [{stop_reason:'end_turn',content:[{type:'text',text:'Revenue is $999M'}]},{stop_reason:'max_tokens',content:[{type:'tool_use',name:'query_practice',input:valid}]},{stop_reason:'tool_use',content:[]},{stop_reason:'tool_use',content:[{type:'tool_use',name:'query_gtm',input:{queries:[gtm()],explain:false}}]},{stop_reason:'tool_use',content:[{type:'tool_use',name:'query_practice',input:{...valid,sql:'bad'}}]},{stop_reason:'tool_use',content:[{type:'tool_use',name:'query_practice',input:valid},{type:'tool_use',name:'query_practice',input:valid}]}]){
    const response=await answerWithQueryTools({domain:'practice',question:'Show annual revenue',client:{messages:{create:async()=>message}}});
    assert.equal(response.source,'query-clarification');assert.doesNotMatch(response.content[0].text,/999|Scope total/);
  }
});

test('unknown names, missing denominators and privacy requests do not produce default totals',async()=>{
  for(const question of ['Dr. Anya Shah collections','Dr. Anya Smith collections','Dr. Smith revenue','Show unique patients','Show patient named Smith','Show revenue in 2026','Show median revenue','Show revenue excluding Lin']){
    const response=await answerWithQueryTools({domain:'practice',question,client:{messages:{create:async()=>{throw Error('Must not reach model');}}}});assert.equal(response.source,'query-clarification');assert.equal(response.toolCalls.length,0);
  }
  const result=await answerWithQueryTools({domain:'practice',question:'Show revenue',client:mock('request_clarification',{reason:'ambiguous_scope'})});assert.equal(result.source,'query-clarification');assert.doesNotMatch(result.content[0].text,/\$/);
});

test('all mismatched full provider names fail before a model or calculator can run',async()=>{
  for(const first of PRACTICE_DATA.providers)for(const last of PRACTICE_DATA.providers){
    if(first===last)continue;
    const name=`Dr. ${first.split(' ')[1]} ${last.split(' ').at(-1)}`;
    const response=await answerWithQueryTools({domain:'practice',question:`Show collections for ${name} in 2025.`,client:{messages:{create:async()=>{throw Error('Must not reach model');}}}});
    assert.equal(response.source,'query-clarification');assert.match(response.content[0].text,/provider name/);
  }
});

test('both HTTP routes share input validation and fail safely on unavailable interpretation',async()=>{
  for(const domain of ['gtm','practice']){
    const route=createQueryRoute(domain);
    for(const [body,status]of [['{',400],[JSON.stringify(null),400],[JSON.stringify({question:' '}),400],[JSON.stringify({question:'x'.repeat(2001)}),400]]){
      const response=await route(new Request('http://localhost/api/ask',{method:'POST',body,headers:{'content-type':'application/json','x-forwarded-for':`${domain}-${Math.random()}`}}));assert.equal(response.status,status);
    }
  }
  const route=createQueryRoute('practice',{makeClient:()=>({messages:{create:async()=>{throw Error('offline');}}})});
  const response=await route(new Request('http://localhost/api/ask',{method:'POST',body:JSON.stringify({question:'Show revenue'}),headers:{'content-type':'application/json','x-forwarded-for':'offline-test'}}));
  assert.equal(response.status,503);assert.doesNotMatch(JSON.stringify(await response.json()),/\$|offline/);
});

test('HTTP rate limits stop new interpretation calls and provide retry timing',async()=>{
  let calls=0;
  const client=mock('query_practice',{queries:[practice()],explain:false});
  const create=client.messages.create;client.messages.create=async args=>{calls++;return create(args);};
  const route=createQueryRoute('practice',{makeClient:()=>client});
  for(let i=0;i<11;i++){
    const response=await route(new Request('http://localhost/api/ask',{method:'POST',body:JSON.stringify({question:'Show revenue'}),headers:{'content-type':'application/json','x-forwarded-for':'rate-test'}}));
    assert.equal(response.status,i<10?200:429);if(i===10)assert.ok(Number(response.headers.get('Retry-After'))>0);
  }
  assert.equal(calls,10);
});
