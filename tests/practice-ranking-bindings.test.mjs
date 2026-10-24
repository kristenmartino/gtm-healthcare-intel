import test from 'node:test';
import assert from 'node:assert/strict';
import { answerPracticeQuestion as answer } from '../lib/practice-answers.mjs';
import { aggregatePractice } from '../lib/practice-aggregates.mjs';
import { PRACTICE_DATA } from '../lib/practice-scenario.mjs';
import { practiceRankingLines } from '../lib/practice-rankings.mjs';
import { formatMetricValue } from '../lib/metric-value-format.mjs';

test('categorical rankings honor minimum and maximum rather than always selecting the largest',()=>{
  for (const [q,expected,unwanted] of [
    ['Which payer has the lowest revenue in 2025?','Lowest payer revenue: Cigna ($400,878).','Highest payer revenue:'],
    ['Which payer has the highest revenue in 2025?','Highest payer revenue: Self-Pay ($2,712,330).','Lowest payer revenue:'],
    ['Which procedure had the lowest count in 2025?','Lowest procedure count: Cosmetic Consult (671).','Highest procedure count:'],
    ['Which procedure had the fewest counts in 2025?','Lowest procedure count: Cosmetic Consult (671).','Highest procedure count:'],
    ['Which procedure had the most counts in 2025?','Highest procedure count: E&M Visit (6,554).','Lowest procedure count:'],
  ]) {
    const text=answer(q);assert.ok(text.includes(expected),text);assert.ok(!text.includes(unwanted),text);
  }
});

test('ranking targets select providers and periods for every supported measure',()=>{
  const terms={revenue:'revenue',collections:'collections',patients:'patient counts',denials:'denial counts',noShows:'no-show counts',collectionRatio:'collection rate',avgReimb:'average reimbursement',payerMix:'payer revenue',procedures:'procedure counts'};
  const value=(row,key)=>key==='payerMix'?Object.values(row.payerRevenue).reduce((a,b)=>a+b,0):key==='procedures'?Object.values(row.procedures).reduce((a,b)=>a+b,0):row[key];
  for (const [key,term] of Object.entries(terms)) for (const [word,extreme] of [['highest',Math.max],['lowest',Math.min]]) {
    const providerRows=aggregatePractice().providers;
    const edge=extreme(...providerRows.map(row=>value(row,key)));
    const names=providerRows.filter(row=>value(row,key)===edge).map(row=>row.provider.split(' ').at(-1)).join(' and ');
    const text=answer(`Which provider has the ${word} ${term} in 2025?`);
    assert.ok(text.includes(`: ${names} (`),text);
    for (const [axis,groups] of [['month',PRACTICE_DATA.months.map((m,i)=>({name:m.month,indexes:[i]}))],['quarter',[0,1,2,3].map(i=>({name:`Q${i+1}`,indexes:[i*3,i*3+1,i*3+2]}))]]) {
      const rows=groups.map(g=>({name:g.name,value:value(aggregatePractice({monthIndexes:g.indexes}).total,key)}));
      const periodEdge=extreme(...rows.map(r=>r.value));
      const periods=rows.filter(r=>r.value===periodEdge).map(r=>r.name).join(' and ');
      const result=answer(`Which ${axis} had the ${word} ${term} in 2025?`);
      assert.ok(result.includes(`${word==='highest'?'Highest':'Lowest'} period: ${periods} (`),result);
      assert.doesNotMatch(result,/Highest .*: (?:Lin|Shah|Singh|Brooks|Yamamoto) \(/);
    }
  }
  assert.match(answer('Which month had the lowest revenue in 2025?'),/Lowest period: Jan \(\$506,283\)/);
  assert.match(answer('Which provider has the highest payer revenue in 2025?'),/Highest payer revenue by provider: Singh \(\$1,592,362\)/);
});

test('rankings preserve named/provider/period filters and true ties before rounding',()=>{
  assert.match(answer('Which provider had the highest collection rate last quarter?'),/Highest collections \/ revenue: Shah \(106.6%\)/);
  assert.match(answer('Which provider has the lowest no-show counts in 2025?'),/Lowest no-show counts: Lin and Yamamoto \(129\)/);
  const scoped=answer('Which month had the lowest revenue for Lin and Shah in Q1 2025?');
  assert.match(scoped,/Jan–Mar 2025/);assert.doesNotMatch(scoped,/Apr:|Singh:/);
  const lines=practiceRankingLines([{name:'A',value:1.04},{name:'B',value:1.03},{name:'C',value:1.03}],{intent:{minimum:true},metric:'revenue',label:'value',value:r=>r.value,format:n=>n.toFixed(1)});
  assert.deepEqual(lines,['Lowest value: B and C (1.0).']);
  assert.match(answer('Which payer has the highest collections?'),/cannot be calculated/);
  assert.match(answer('Which procedure has the highest revenue?'),/cannot be calculated/);
  assert.match(answer('Which provider has the highest Medicare revenue in 2025?'),/Highest payer revenue by provider: Singh \(\$230,119\)/);
  assert.match(answer('Which month has the lowest Medicare revenue in 2025?'),/Lowest period: Jan \(\$73,391\)/);
});

test('provider and month rankings use the selected Q1 records for every measure',()=>{
  const providers=['Dr. Anya Lin','Dr. Priya Shah'];
  const terms={revenue:'revenue',collections:'collections',patients:'patient counts',denials:'denial counts',noShows:'no-show counts',collectionRatio:'collection rate',avgReimb:'average reimbursement',payerMix:'payer revenue',procedures:'procedure counts'};
  const value=(row,key)=>key==='payerMix'?Object.values(row.payerRevenue).reduce((a,b)=>a+b,0):key==='procedures'?Object.values(row.procedures).reduce((a,b)=>a+b,0):row[key];
  for(const [key,term] of Object.entries(terms))for(const [word,extreme] of [['highest',Math.max],['lowest',Math.min]]){
    const providerRows=aggregatePractice({providers,monthIndexes:[0,1,2]}).providers.map(r=>({name:r.provider.split(' ').at(-1),value:value(r,key)}));
    const monthRows=[0,1,2].map(i=>({name:PRACTICE_DATA.months[i].month,value:value(aggregatePractice({providers,monthIndexes:[i]}).total,key)}));
    for(const [axis,rows] of [['provider',providerRows],['month',monthRows]]){
      const edge=extreme(...rows.map(r=>r.value));
      const names=rows.filter(r=>r.value===edge).map(r=>r.name).join(' and ');
      const text=answer(`Which ${axis} had the ${word} ${term} for Lin and Shah in Q1 2025?`);
      assert.ok(text.includes(`: ${names} (`),text);assert.match(text,/Jan–Mar 2025/);
      assert.doesNotMatch(text,/Singh:|Brooks:|Yamamoto:|Apr:/);
    }
  }
});

test('named independent measures retain their own selections, in either order and with shared time/provider scope',()=>{
  for (const pair of ['Mohs Surgery procedure counts and payer revenue','payer revenue and Mohs Surgery procedure counts','procedure counts for Mohs Surgery and payer revenue']) {
    const text=answer(`Show ${pair} in 2025.`);
    assert.match(text,/Mohs Surgery: 896/);assert.match(text,/Selected procedure total: 896/);
    assert.match(text,/All-payer revenue denominator: \$6,958,793/);assert.doesNotMatch(text,/Biopsy:/);
  }
  for (const pair of ['Medicare revenue and practice collections','practice collections and Medicare revenue','revenue for Medicare and practice collections']) {
    const text=answer(`Show ${pair} in 2025.`);
    assert.match(text,/Medicare: \$1,028,708/);assert.match(text,/Practice total: \$6,488,837/);
    assert.doesNotMatch(text,/Blue Cross:/);
  }
  const both=answer('Show Mohs Surgery counts and Medicare revenue for Lin and Shah in Q1 2025.');
  assert.match(both,/Jan–Mar 2025/);assert.match(both,/Mohs Surgery: 80/);assert.match(both,/Medicare: \$103,034/);
  assert.doesNotMatch(both,/Blue Cross:|Biopsy:|Yamamoto:/);
  const list=answer('Show Medicare and Aetna revenue and Mohs Surgery and Biopsy counts in 2025.');
  assert.match(list,/Aetna: \$735,828/);assert.match(list,/Mohs Surgery: 896/);assert.match(list,/Biopsy: 2,892/);
});

test('explicit cross-breakdowns and shared trailing names remain guarded after local name binding',()=>{
  for (const q of ['Show Mohs counts and payer revenue by procedure.','Show Mohs counts and payer revenue by payer.','Show Medicare revenue and collections by payer.','Show Medicare collections and revenue.','Show Mohs revenue and payer revenue.','Show collections and payer revenue for Medicare.','Show payer revenue for Biopsy.','Show Mohs counts and Medicare revenue by payer and procedure.']) {
    const result=answer(q);assert.match(result,/cannot be calculated/,q);assert.doesNotMatch(result,/Calculated practice measures/);
  }
});

test('every named procedure and payer can appear in independent summaries without a joint breakdown',()=>{
  for(const procedure of Object.keys(PRACTICE_DATA.months[0].providers[PRACTICE_DATA.providers[0]].procedures))for(const payer of PRACTICE_DATA.payers){
    const rows=PRACTICE_DATA.months.slice(0,3).flatMap(m=>['Dr. Anya Lin','Dr. Priya Shah'].map(p=>m.providers[p]));
    const count=rows.reduce((sum,r)=>sum+r.procedures[procedure],0).toLocaleString('en-US');
    const revenue=rows.reduce((sum,r)=>sum+r.payerMix[payer],0).toLocaleString('en-US');
    for(const pair of [`${procedure} counts and ${payer} revenue`,`${payer} revenue and ${procedure} counts`]){
      const text=answer(`Show ${pair} for Lin and Shah in Q1 2025.`);
      assert.ok(text.includes(`${procedure}: ${count}`),text);assert.ok(text.includes(`${payer}: $${revenue}`),text);
      assert.ok(text.includes(`Selected procedure total: ${count}`),text);assert.ok(text.includes(`Selected payer revenue: $${revenue}`),text);
      const joint=answer(`Show ${pair} by payer and procedure for Lin and Shah in Q1 2025.`);
      assert.match(joint,/no linkage/);assert.doesNotMatch(joint,/Calculated practice measures/);
    }
  }
});

test('metric units consistently place currency before the amount',()=>{
  assert.equal(formatMetricValue(254,'$K'),'$254K');
  assert.equal(formatMetricValue('289.4','$K'),'$289.4K');
  assert.equal(formatMetricValue(106.8,'%'),'106.8%');
  assert.equal(formatMetricValue(16,'edits'),'16 edits');
});
