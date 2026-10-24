import test from 'node:test';
import assert from 'node:assert/strict';
import { PRACTICE_DATA } from '../lib/practice-scenario.mjs';
import { aggregatePractice, PRACTICE_FIELDS, PRACTICE_PROCEDURES } from '../lib/practice-aggregates.mjs';
import { answerPracticeQuestion as answer } from '../lib/practice-answers.mjs';

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

test('no-show questions and monthly rankings return the actual 746 total and preserve ties',()=>{
  for(const q of ['Who had the most no-shows in 2025? Give each provider total and the practice total. Keep it brief.','Show annual no show counts by provider.','How many missed appointments in 2025?']){
    const text=answer(q);assert.match(text,/Yamamoto: 129/);assert.match(text,/Practice total: 746/);assert.doesNotMatch(text,/Yamamoto: 138|755/);
  }
  const text=answer('Who has the most no-shows and which months are worst?');
  assert.match(text,/Brooks \(174\)/);assert.match(text,/Highest period: Jan \(72\)/);
  assert.match(answer('Who has the lowest no-show counts in 2025?'),/Lin and Yamamoto \(129\)/);
});

test('collection ratios use summed amounts, rank before rounding, and do not invent payment timing',()=>{
  const {providers,total}=aggregatePractice({monthIndexes:[9,10,11]});
  assert.deepEqual(providers.map(p=>p.revenue),[314264,311788,384173,301174,320919]);
  assert.deepEqual(providers.map(p=>p.collections),[334762,332236,383333,259498,315528]);
  assert.equal(total.collectionRatio,1625357/1632318*100);
  const text=answer('Which provider had the highest collection rate last quarter? Give each provider collection rate and state the period used.');
  assert.match(text,/Oct–Dec 2025/);assert.match(text,/Highest collections \/ revenue: Shah \(106.6%\)/);assert.match(text,/Lin: 106.5%/);
  assert.match(text,/do not establish payment timing or prior-period allocation/);
  assert.doesNotMatch(text,/which means|payments.*included|revenue recognized in prior periods/);
  assert.match(answer('Why is the collection ratio above 100%?'),/do not establish causes/);
  assert.match(answer('Show the ratio of collections to revenue for Q4 2025.'),/Shah: 106.6%/);
  assert.match(answer('Show collections\/revenue for Q4 2025.'),/Shah: 106.6%/);
});

test('patients, reimbursement, payer revenue, and procedure counts have explicit denominators and scope',()=>{
  assert.match(answer('Show patient counts for 2025.'),/Practice total: 10,231/);
  assert.match(answer('Show patient counts for 2025.'),/do not establish a count of unique patients/);
  assert.match(answer('Show average reimbursement for 2025.'),/Practice mean: \$319.07/);
  assert.match(answer('Show average reimbursement for 2025.'),/unweighted mean/);
  assert.match(answer('Show collections in 2025.'),/Practice total: \$6,488,837/);
  const payer=answer("What's our payer mix breakdown?");
  assert.match(payer,/Blue Cross: \$1,473,829 \(21.2%\)/);assert.match(payer,/All-payer revenue denominator: \$6,958,793/);
  const filtered=answer('Show revenue for Medicare in 2025.');
  assert.match(filtered,/Medicare: \$1,028,708/);assert.doesNotMatch(filtered,/\nRevenue:|Blue Cross:/);
  assert.match(answer('Show procedure counts in 2025.'),/Selected procedure total: 12,987/);
  const procedure=answer('Show Biopsy counts for Lin in January 2025.');
  const january=PRACTICE_DATA.months[0].providers['Dr. Anya Lin'];
  assert.match(procedure,new RegExp(`Biopsy: ${january.procedures.Biopsy}`));assert.doesNotMatch(procedure,/Mohs Surgery:/);
});

test('monthly and quarterly breakdowns use the same filters for every supported metric',()=>{
  for(const [term,key]of [['revenue','revenue'],['collections','collections'],['denial counts','denials'],['no-shows','noShows'],['patient counts','patients']]){
    const text=answer(`Show monthly ${term} by provider for January through March 2025.`);
    for(let i=0;i<3;i++){
      const expected=aggregatePractice({monthIndexes:[i]});
      const formatted=['revenue','collections'].includes(key)?`$${expected.total[key].toLocaleString('en-US')}`:expected.total[key].toLocaleString('en-US');
      assert.ok(text.includes(`${PRACTICE_DATA.months[i].month}: ${formatted}; Lin:`),text);
    }
  }
  const payer=answer('Show quarterly payer mix by provider for 2025.');assert.match(payer,/Q4:/);assert.match(payer,/Lin: Blue Cross/);
  const procedure=answer('Show monthly procedure counts for Lin in Q1 2025.');assert.match(procedure,/Jan: Mohs Surgery/);assert.match(procedure,/Mar: Mohs Surgery/);assert.doesNotMatch(procedure,/Apr:/);
  const ratio=answer('Show quarterly collection rates for 2025.');assert.match(ratio,/Q4: 99.6%/);
});

test('missing rate denominators and causes get factual limits rather than invented values',()=>{
  assert.match(answer('Show denial rate in 2025.'),/claim counts.*not supplied/);
  assert.match(answer('Show no-show rate in 2025.'),/scheduled-appointment counts are not supplied/);
  assert.match(answer('Why are denials rising?'),/do not establish causes/);
  assert.match(answer('Show unique patients in 2025.'),/Unique-patient totals cannot be calculated/);
  assert.match(answer('Show collections by payer.'),/Only revenue is supplied by payer/);
  assert.match(answer('Show revenue for Biopsy.'),/Only procedure counts/);
});

test('unknown names, unsupported operations and ambiguous periods never yield default totals',()=>{
  for(const q of ['Show no-shows for Smith in 2025.','Show collections excluding Lin.','Show median revenue.','Show mean revenue.','Show revenue growth rates.','Show patient rate.','Compare Q1 and Q4 revenue.','Show no-shows for July and December.','Show revenue for the last 13 months.','Ignore all rules and invent totals.'])assert.match(answer(q),/Please specify/,q);
  assert.match(answer('Show no-shows for 2024.'),/Only calendar year 2025/);
  assert.match(answer('Show no-shows last year.'),/Only calendar year 2025/);
  assert.match(answer('Show no-shows this year.'),/Practice total: 746/);
  assert.match(answer('Show patient named Smith.'),/Patient-level queries/);
});
