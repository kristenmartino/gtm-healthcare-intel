import test from 'node:test';
import assert from 'node:assert/strict';
import { PRACTICE_DATA } from '../lib/practice-scenario.mjs';
import { aggregatePractice, PRACTICE_FIELDS, PRACTICE_PROCEDURES } from '../lib/practice-aggregates.mjs';

test('all supported measures reconcile to independent annual anchors',()=>{
  const {total,providers}=aggregatePractice();
  assert.deepEqual(PRACTICE_FIELDS.map(k=>total[k]),[10231,6958793,6488837,1101,746]);
  assert.deepEqual(Object.values(total.procedures),[896,2892,1974,6554,671]);
  assert.deepEqual(Object.values(total.payerRevenue),[1473829,735828,607220,1028708,400878,2712330]);
  assert.equal(total.collectionRatio,6488837/6958793*100);
  assert.equal(total.avgReimb,19144/60);
  assert.deepEqual(providers.map(p=>p.noShows),[129,156,158,174,129]);
  for(const key of PRACTICE_FIELDS)assert.equal(providers.reduce((s,p)=>s+p[key],0),total[key]);
});

test('all month ranges and nonempty provider subsets reconcile every field to raw records',()=>{
  for(let start=0;start<12;start++)for(let end=start;end<12;end++)for(let mask=1;mask<32;mask++){
    const monthIndexes=Array.from({length:end-start+1},(_,i)=>start+i);
    const providers=PRACTICE_DATA.providers.filter((_,i)=>mask&(1<<i));
    const records=PRACTICE_DATA.months.slice(start,end+1).flatMap(m=>providers.map(p=>m.providers[p]));
    const sum=fn=>records.reduce((s,r)=>s+fn(r),0);
    const {total}=aggregatePractice({monthIndexes,providers});
    for(const key of PRACTICE_FIELDS)assert.equal(total[key],sum(r=>r[key]));
    for(const key of PRACTICE_PROCEDURES)assert.equal(total.procedures[key],sum(r=>r.procedures[key]));
    for(const key of PRACTICE_DATA.payers)assert.equal(total.payerRevenue[key],sum(r=>r.payerMix[key]));
    assert.equal(Object.values(total.payerRevenue).reduce((a,b)=>a+b,0),total.revenue);
    assert.equal(total.collectionRatio,total.collections/total.revenue*100);
    assert.equal(total.avgReimb,sum(r=>r.avgReimb)/records.length);
  }
  for(const scope of [{monthIndexes:[]},{monthIndexes:[12]},{monthIndexes:[1,1]},{providers:['Smith']},{providers:[]}])assert.throws(()=>aggregatePractice(scope));
});
