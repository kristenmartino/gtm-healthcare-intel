import test from 'node:test';
import assert from 'node:assert/strict';
import {GTM_DATA} from '../lib/gtm-scenario.mjs';
import {executeQueryTool,renderQueryResult} from '../lib/query-engine.mjs';
import {questionConstraints,validateQuestionConstraints,answerWithQueryTools} from '../lib/query-service.mjs';
import {normalizeQueryLanguage} from '../lib/query-language.mjs';
import {parseWrittenQuantity} from '../lib/query-numbers.mjs';

const query=(extra={})=>({report:'quota',quarters:['Q1 2025'],reps:[],specialties:[],sources:[],groupBy:[],predicate:{metric:'quota',operator:'none',value:null},ranking:{metric:'quota',direction:'none',limit:1,within:[]},...extra});
const run=q=>executeQueryTool('query_gtm',{queries:[q],explain:false});
const mock=queries=>({messages:{create:async()=>({stop_reason:'tool_use',content:[{type:'tool_use',id:'quota-test',name:'query_gtm',input:{queries,explain:false}}]})}});

test('quota totals reconcile every amount and weighted ratio for all 63 nonempty rep subsets',()=>{
  for(let mask=1;mask<64;mask++){
    const reps=GTM_DATA.reps.filter((_,i)=>mask&(1<<i));
    const raw=GTM_DATA.deals.filter(d=>d.quarter==='Q1 2025'&&reps.includes(d.rep));
    const won=raw.filter(d=>d.won),lost=raw.filter(d=>d.lost),open=raw.filter(d=>!d.won&&!d.lost);
    const bookings=won.reduce((n,d)=>n+d.acv,0),pipeline=open.reduce((n,d)=>n+d.acv,0);
    const quota=reps.reduce((n,rep)=>n+GTM_DATA.quotas[GTM_DATA.reps.indexOf(rep)],0);
    const result=run(query({reps})).results[0];assert.equal(result.rows.length,1);
    const row=result.rows[0];
    assert.equal(row.quota,quota);assert.equal(row.bookings,bookings);assert.equal(row.pipeline,pipeline);
    assert.equal(row.attainment,bookings/quota*100);assert.equal(row.coverage,pipeline/quota);
    assert.equal(row.wins,won.length);assert.equal(row.closed,won.length+lost.length);
    assert.equal(row.winRate,won.length/(won.length+lost.length)*100);
    assert.equal(row.avgACV,bookings/won.length);assert.equal(row.avgCycle,won.reduce((n,d)=>n+d.daysInPipeline,0)/won.length);
    const perRep=reps.map(rep=>({quota:GTM_DATA.quotas[GTM_DATA.reps.indexOf(rep)],bookings:won.filter(d=>d.rep===rep).reduce((n,d)=>n+d.acv,0)}));
    assert.equal(row.grossShortfall,perRep.reduce((n,r)=>n+Math.max(0,r.quota-r.bookings),0));
    assert.equal(row.overperformance,perRep.reduce((n,r)=>n+Math.max(0,r.bookings-r.quota),0));
    assert.equal(row.gap,quota-bookings);assert.equal(row.shortfall,Math.max(0,quota-bookings));
    assert.equal(row.grossShortfall-row.overperformance,row.gap);
    assert.equal(run(query({reps,groupBy:['rep']})).results[0].rows.length,reps.length);
    const labelled=run(query({reps,groupBy:['quarter']})).results[0].rows[0];
    assert.equal(labelled.quota,quota);assert.equal(labelled.attainment,row.attainment);assert.equal(labelled.name,'Q1 2025');
  }
  assert.equal(run(query()).results[0].rows[0].quota,2400000);
});

test('Chen and Kim combined totals preserve gross and net shortfalls instead of averaging percentages',()=>{
  const result=run(query({reps:['Sarah Chen','David Kim']})),row=result.results[0].rows[0];
  assert.equal(row.quota,800000);assert.equal(row.bookings,754000);assert.equal(row.attainment,94.25);assert.equal(row.coverage,3);
  assert.equal(row.grossShortfall,100000);assert.equal(row.overperformance,54000);assert.equal(row.gap,46000);assert.equal(row.shortfall,46000);
  assert.notEqual(row.attainment,(112+250000/350000*100)/2);
  const all=run(query()).results[0].rows[0];assert.equal(all.grossShortfall,314000);assert.equal(all.shortfall,260000);
  const chen=run(query({reps:['Sarah Chen']}));assert.equal(chen.results[0].rows[0].shortfall,0);assert.equal(chen.results[0].rows[0].gap,-54000);assert.match(renderQueryResult(chen).text,/-\$54,000/);
});

test('combined intent cannot silently become separate rows, split subsets or a wider company total',async()=>{
  const question='What is the combined quota and attainment for Sarah Chen and David Kim in Q1 2025?';
  for(const queries of [[query({reps:['Sarah Chen','David Kim'],groupBy:['rep']})],[query()],[query({reps:['Sarah Chen']}),query({reps:['David Kim']})]]){
    const response=await answerWithQueryTools({domain:'gtm',question,client:mock(queries)});assert.equal(response.source,'query-clarification');
  }
  const response=await answerWithQueryTools({domain:'gtm',question,client:mock([query({reps:['Sarah Chen','David Kim']})])});
  assert.equal(response.source,'validated-query');assert.match(response.content[0].text,/\$800,000/);assert.match(response.content[0].text,/94\.3%/);
  assert.doesNotThrow(()=>validateQuestionConstraints('gtm','Show total quota by rep in Q1 2025.',{queries:[query({groupBy:['rep']})]}));
  assert.doesNotThrow(()=>validateQuestionConstraints('gtm',question,{queries:[query({reps:['Sarah Chen','David Kim'],groupBy:['quarter']})]}));
});

test('quota total predicates apply after grouping and unsupported cohort allocations still reject',()=>{
  const reps=['Sarah Chen','David Kim'];
  const filtered=run(query({reps,predicate:{metric:'attainment',operator:'lt',value:100}})).results[0];assert.equal(filtered.rows.length,1);assert.equal(filtered.rows[0].attainment,94.25);
  assert.equal(run(query({reps,predicate:{metric:'grossShortfall',operator:'gte',value:100000}})).results[0].rows.length,1);
  for(const extra of [{quarters:['Q4 2024']},{specialties:['Dermatology']},{sources:['Referral']},{groupBy:['specialty']}])assert.throws(()=>run(query(extra)));
});

const quantities=[
  ['one point five million',1500000],['one point two five million',1250000],['one point twenty five million',1250000],
  ['zero point zero five million',50000],['one point zero zero five million',1005000],['one point five thousand',1500],['one point five hundred',150],
  ['one and a half million',1500000],['half a million',500000],['three quarters of a million',750000],['one and three quarters million',1750000],
  ['one million two hundred and fifty thousand',1250000],['one hundred and five',105],['twenty-five',25],
  ['1.5M',1500000],['1.5million',1500000],['1.5hundred',150],['1.005 million',1005000],['1,500,000',1500000],['.5 million',500000],
  ['minus one point five',-1.5],['zero point zero zero zero zero zero zero one',0.0000001],
];
test('written decimals, fractions, scales and numeric equivalents preserve complete threshold values',()=>{
  for(const [phrase,value] of quantities){
    assert.equal(parseWrittenQuantity(phrase),value,phrase);
    for(const [operator,code] of [['at least','gte'],['at most','lte'],['not more than','lte'],['under','lt'],['over','gt'],['exactly','eq'],['>=','gte']]){
      const text=`Show revenue ${operator} ${phrase} in 2025.`;
      assert.deepEqual(questionConstraints(text).comparisons,[{operator:code,value}],text);
    }
  }
  assert.match(normalizeQueryLanguage('at least one point five million and collections'),/at least 1500000 and collections/);
});

test('malformed or ambiguous numeric phrases never degrade to a leading integer',async()=>{
  for(const phrase of ['one point','one point five point six million','one point zero twenty five million','one thousand million','one point five and a half million','1,5 million','one point one hundred million']){
    assert.throws(()=>normalizeQueryLanguage(`at least ${phrase}`),/complete numeric quantity/,phrase);
    const response=await answerWithQueryTools({domain:'practice',question:`Show revenue at least ${phrase}`,client:{messages:{create:async()=>{throw Error('Malformed threshold must fail before model');}}}});
    assert.equal(response.source,'query-clarification');assert.equal(response.toolCalls.length,0);
  }
});

test('written decimal constraints reject a valid model plan with a truncated value',()=>{
  const q={metric:'revenue',months:Array.from({length:12},(_,i)=>i),providers:[],payers:[],procedures:[],groupBy:['provider'],predicate:{metric:'revenue',operator:'gte',value:1},ranking:{metric:'revenue',direction:'none',limit:1,within:[]}};
  const question='Which providers had at least one point five million in revenue in 2025?';
  assert.throws(()=>validateQuestionConstraints('practice',question,{queries:[q]}),/threshold/);
  assert.doesNotThrow(()=>validateQuestionConstraints('practice',question,{queries:[{...q,predicate:{...q.predicate,value:1500000}}]}));
});
