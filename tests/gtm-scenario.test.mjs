import test from 'node:test';
import assert from 'node:assert/strict';
import { answerKnownGTMQuestion } from '../lib/gtm-answers.mjs';
import { GTM_DATA, qbr, nrr, sum, summarize } from '../lib/gtm-scenario.mjs';

test('quarter totals reconcile to independent scenario anchors', () => {
  assert.equal(qbr.current.bookings, 2140000);
  assert.equal(qbr.prior.bookings, 1980000);
  assert.equal(qbr.current.wins, 31);
  assert.equal(qbr.prior.wins, 34);
  assert.equal(qbr.current.pipeline, 7200000);
  assert.equal(qbr.current.closed, 125);
  assert.equal(qbr.current.winRate, 31 / 125);
  assert.equal(qbr.current.avgACV, 2140000 / 31);
  assert.equal(qbr.current.avgCycle, 1502 / 31);
  assert.equal(new Set(GTM_DATA.deals.map(d => d.id)).size, GTM_DATA.deals.length);
});

test('every dimension reconciles to the same company totals', () => {
  for (const rows of [qbr.reps, qbr.specialties, qbr.sources]) {
    for (const key of ['bookings', 'wins', 'losses', 'closed', 'pipeline']) assert.equal(sum(rows, key), qbr.current[key]);
    assert.ok(Math.abs(rows.reduce((t, r) => t + r.avgCycle * r.wins, 0) - 1502) < 1e-8);
  }
  assert.equal(sum(qbr.reps, 'quota'), qbr.current.target);
});

test('longest won cycle and weighted NRR agree with the underlying inputs', () => {
  const slowest = [...qbr.reps].sort((a,b) => b.avgCycle - a.avgCycle)[0];
  assert.equal(slowest.name, 'David Kim');
  assert.equal(slowest.avgCycle, 68);
  assert.equal(slowest.wins, 2);
  assert.equal(nrr, 3266600 / 3000000);
});

test('open opportunities contribute pipeline, not wins or win-rate denominators', () => {
  const result = summarize([{won: false, lost: false, acv: 12000, daysInPipeline: 90}]);
  assert.equal(result.pipeline, 12000);
  assert.equal(result.bookings, 0);
  assert.equal(result.winRate, null);
  assert.equal(result.avgACV, null);
  assert.equal(result.avgCycle, null);
});

test('the cycle explanation reports calculated gaps and respects reporting periods', () => {
  const answer = answerKnownGTMQuestion('Who has the longest average sales cycle in Q1 2025, and why?');
  assert.match(answer, /Kim has the longest mean sales cycle: 68 days across 2 won/);
  assert.match(answer, /Patel is next at 58.0 days, a gap of 10.0 days/);
  assert.match(answer, /selected cohort mean is 48.5 days across 31 wins/);
  assert.match(answerKnownGTMQuestion('Who has the longest sales cycle in Q4 2024?'), /72 days across 3 won/);
  assert.match(answerKnownGTMQuestion('Who has the longest cycle in Q2 2025?'), /No data is available/);
  assert.match(answerKnownGTMQuestion('Who had the longest sales cycle last quarter?'), /Q4 2024/);
  assert.equal(answerKnownGTMQuestion('What is our ARR?'), null);
});

test('cycle answers apply specialty, source, rep, and quarter filters before ranking', () => {
  const dermatology = answerKnownGTMQuestion('Who has the longest average sales cycle for Dermatology in Q1 2025?');
  assert.match(dermatology, /specialty: Dermatology: Patel.*58 days across 1 won opportunity/);
  assert.match(dermatology, /selected cohort mean is 46.3 days across 11 wins/);
  assert.doesNotMatch(dermatology, /Kim/);
  assert.match(answerKnownGTMQuestion('Who has the longest sales cycle for Referral in Q1 2025?'), /Rivera.*52 days across 2 won/);
  assert.match(answerKnownGTMQuestion('Who has the longest sales cycle for Dermatology and Kim in Q1 2025?'), /No won opportunities match/);
  assert.match(answerKnownGTMQuestion('Who has the longest cycle for Dermatology in Q4 2024?'), /Kim.*72 days/);
});

test('cycle answers clarify unsupported scope rather than answering for the company', () => {
  for (const question of [
    'Who has the longest sales cycle for Cardiology in Q1 2025?',
    'Who has the longest median cycle in Q1 2025?',
    'Who has the longest cycle excluding Dermatology in Q1 2025?',
    'Who has the longest cycle for deals over $100000 in Q1 2025?',
    'Which specialty has the longest sales cycle in Q1 2025?',
    'Who has the longest cycle in Q1 2025 compared to Q4 2024?',
  ]) assert.match(answerKnownGTMQuestion(question), /Please specify/);
});

test('equivalent cycle questions use the same filtered calculation in either word order', () => {
  const expected = answerKnownGTMQuestion('Who has the longest average sales cycle for Dermatology in Q1 2025?');
  for (const question of [
    'For Dermatology in Q1 2025, whose average sales cycle is longest?',
    'Whose mean sales cycle was longest in Dermatology in Q1 2025?',
    'Which rep has the slowest average sales cycle for Dermatology in Q1 2025?',
    'For Dermatology in Q1 2025, whose average sales cycles are longest?',
  ]) assert.equal(answerKnownGTMQuestion(question), expected, question);
  assert.match(answerKnownGTMQuestion('For Referral in Q1 2025, whose mean sales cycle is longest?'), /Rivera.*52 days across 2 won/);
  assert.match(answerKnownGTMQuestion('For Dermatology and Kim in Q1 2025, whose cycle is longest?'), /No won opportunities match/);
  for (const question of [
    'For Cardiology in Q1 2025, whose average sales cycle is longest?',
    'Whose median sales cycle is longest in Q1 2025?',
    'Whose cycle is longest excluding Dermatology in Q1 2025?',
    'Whose cycle is longest for deals over $100000 in Q1 2025?',
    'Which specialty has a sales cycle that is longest in Q1 2025?',
  ]) assert.match(answerKnownGTMQuestion(question), /Please specify/, question);
  assert.equal(answerKnownGTMQuestion('What is the average sales cycle for Dermatology?'), null);
  assert.equal(answerKnownGTMQuestion('Who has the longest customer tenure?'), null);
});
