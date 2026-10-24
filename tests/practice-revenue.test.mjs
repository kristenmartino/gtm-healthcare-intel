import test from 'node:test';
import assert from 'node:assert/strict';
import { PRACTICE_DATA, summarizePracticeRevenue } from '../lib/practice-scenario.mjs';
import { answerPracticeQuestion } from '../lib/practice-answers.mjs';

test('second-half revenue reconciles to independent provider anchors for equivalent questions', () => {
  const result = summarizePracticeRevenue([6,7,8,9,10,11]);
  assert.deepEqual(result.providers.map(p=>p.revenue), [679305,632163,817379,605917,676366]);
  assert.equal(result.total,3411130);
  const expected = answerPracticeQuestion('Compare revenue across all providers for July through December 2025. Give each provider total and the practice total. Keep it brief.');
  assert.match(expected,/Jul–Dec 2025/);
  assert.match(expected,/Lin: \$679,305/);
  assert.match(expected,/Shah: \$632,163/);
  assert.match(expected,/Brooks: \$605,917/);
  assert.match(expected,/Practice total: \$3,411,130/);
  for (const q of [
    'Show revenue totals by provider for Jul-Dec 2025.',
    'Compare revenue across all providers for the last 6 months',
    'Give each provider revenue and the practice total for H2 2025.',
    'Show revenue for the second half of 2025.',
    'Show revenue between July and December 2025.',
  ]) assert.equal(answerPracticeQuestion(q),expected,q);
});

test('all contiguous month ranges and provider selections reconcile to the raw monthly records', () => {
  for (let start=0;start<12;start++) for (let end=start;end<12;end++) {
    const indexes=Array.from({length:end-start+1},(_,i)=>start+i);
    const selected=PRACTICE_DATA.providers.slice(start%5);
    const expected=PRACTICE_DATA.months.slice(start,end+1).flatMap(m=>selected.map(p=>m.providers[p].revenue)).reduce((a,b)=>a+b,0);
    assert.equal(summarizePracticeRevenue(indexes,selected).total,expected);
  }
  const answer=answerPracticeQuestion('Show revenue for Lin and Yamamoto in December 2025.');
  assert.match(answer,/Lin: \$87,750/);
  assert.match(answer,/Yamamoto: \$126,042/);
  assert.match(answer,/Selected provider total: \$213,792/);
  assert.doesNotMatch(answer,/Shah|Singh|Brooks/);
});

test('monthly, quarterly, annual, and scenario-relative revenue totals reconcile', () => {
  const annual=summarizePracticeRevenue();
  assert.equal(annual.total,6958793);
  assert.equal(Array.from({length:12},(_,i)=>summarizePracticeRevenue([i]).total).reduce((a,b)=>a+b,0),annual.total);
  assert.match(answerPracticeQuestion('What is our annual revenue in 2025?'),/Practice total: \$6,958,793/);
  assert.match(answerPracticeQuestion('Show monthly revenue for H2 2025.'),/Monthly revenue/);
  assert.match(answerPracticeQuestion('Show quarterly revenue in 2025.'),/Q4: \$/);
  assert.equal(answerPracticeQuestion('Show revenue last quarter.'),answerPracticeQuestion('Show revenue Q4 2025.'));
  assert.equal(answerPracticeQuestion('Show revenue this month.'),answerPracticeQuestion('Show revenue December 2025.'));
  assert.equal(answerPracticeQuestion('Show revenue for the last 12 months.'),answerPracticeQuestion('Show annual revenue.'));
});

test('unsupported revenue scopes clarify instead of producing unfiltered or model-generated totals', () => {
  for (const question of [
    'Show revenue for Smith in 2025.',
    'Show revenue excluding Lin in 2025.',
    'Show revenue for July and December 2025.',
    'Show revenue from December to July 2025.',
    'Compare revenue for Q3 and Q4 2025.',
    'Show revenue for Q4 and July 2025.',
    'Show annual revenue for Q4 2025.',
    'Show revenue for last 13 months.',
    'Show revenue growth rates in 2025.',
    'Show revenue over $100000 in 2025.',
    'Show revenue for July 2025 through December 2026.',
  ]) assert.match(answerPracticeQuestion(question),/Please specify|Only calendar year 2025/,question);
  assert.match(answerPracticeQuestion('Show patient named Smith revenue.'),/Patient-level queries/);
  assert.match(answerPracticeQuestion('Show denial counts for 2025.'),/Practice total: 1,101/);
});
