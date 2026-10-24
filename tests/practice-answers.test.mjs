import test from 'node:test';
import assert from 'node:assert/strict';
import { PRACTICE_DATA, summarizePractice, practiceDenialSummary } from '../lib/practice-scenario.mjs';
import { answerPracticeDenials } from '../lib/practice-answers.mjs';

const questions = [
  'Give the full-year 2025 denial count for each provider and the practice total. Use only the supplied data. Keep it brief.',
  'What is the denial rate by payer? Do we have the data to calculate it?',
  'Show annual denial counts by provider and total for 2025.',
];
test('all denial-count paraphrases use the same computed totals', () => {
  assert.deepEqual(summarizePractice().providers.map(r=>r.denials), [200,194,231,258,218]);
  assert.equal(summarizePractice().total,1101);
  for (const question of questions) {
    const answer=answerPracticeDenials(question);
    assert.match(answer,/Yamamoto: 218/);
    assert.match(answer,/Practice total: 1,101/);
    assert.doesNotMatch(answer,/1,099|Yamamoto: 216/);
  }
  assert.match(answerPracticeDenials(questions[1]),/payer-specific denial counts/);
});
test('quarter and month/provider scopes reconcile to raw inputs without expanding scope', () => {
  const summary=practiceDenialSummary();
  assert.equal(summary.quarters.reduce((sum,q)=>sum+q.total,0),1101);
  assert.equal(summary.months.reduce((sum,m)=>sum+m.total,0),1101);
  const q1=summarizePractice([0,1,2],['Dr. Hana Yamamoto']);
  assert.equal(q1.total,47);
  assert.match(answerPracticeDenials('How many denials did Yamamoto have in Q1 2025?'),/Yamamoto: 47/);
  assert.match(answerPracticeDenials('Show denial counts for Dr. Hana Yamamoto in January 2025.'),/Yamamoto: 13/);
  assert.equal(PRACTICE_DATA.months.length,12);
});
test('denial rates, missing periods, unknown scopes, and patient questions do not invent data', () => {
  assert.match(answerPracticeDenials('What is the denial rate by payer?'),/cannot be calculated/);
  assert.match(answerPracticeDenials('Show denial counts for Smith in 2025.'),/Please specify/);
  assert.match(answerPracticeDenials('Show denial counts for 2024.'),/Only calendar year 2025/);
  assert.match(answerPracticeDenials('Show denials for last quarter.'),/Please specify/);
  assert.match(answerPracticeDenials('Show patient Smith denial counts.'),/Patient-level queries/);
  assert.equal(answerPracticeDenials('What was revenue in Q1?'),null);
});
