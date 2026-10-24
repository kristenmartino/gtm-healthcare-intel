import test from 'node:test';
import assert from 'node:assert/strict';
import { answerPracticeQuestion as answer } from '../lib/practice-answers.mjs';
import { PRACTICE_BREAKDOWN_SUPPORT, practiceBreakdowns, validatePracticeBreakdowns } from '../lib/practice-breakdowns.mjs';

const measures = {
  revenue: 'revenue', collections: 'collections', collectionRatio: 'collection rate',
  denials: 'denial counts', noShows: 'no-show counts', patients: 'patient counts',
  avgReimb: 'average reimbursement', procedures: 'procedure counts', payerMix: 'payer mix',
};
const rejectsWithoutTotals = question => {
  const result = answer(question);
  assert.match(result, /cannot be calculated|Only procedure counts|Only revenue/, question);
  assert.doesNotMatch(result, /Calculated practice measures|Practice total|Selected procedure total|All-payer revenue denominator/, question);
};

test('the capability matrix validates every measure and breakdown against the actual data grain', () => {
  for (const metric of Object.keys(measures)) {
    for (const axis of ['provider','month','quarter']) assert.equal(validatePracticeBreakdowns([metric],new Set([axis])),null);
    assert.equal(validatePracticeBreakdowns([metric],new Set(['payer']))===null,['revenue','payerMix'].includes(metric));
    assert.equal(validatePracticeBreakdowns([metric],new Set(['procedure']))===null,metric==='procedures');
    assert.match(validatePracticeBreakdowns([metric],new Set(['payer','procedure'])),/no linkage/);
  }
  assert.equal(PRACTICE_BREAKDOWN_SUPPORT.provider.size,9);
});

test('unsupported procedure breakdowns refuse generic, coordinated, named, and compound forms', () => {
  for (const [key,label] of Object.entries(measures)) {
    if (key==='procedures') continue;
    for (const suffix of ['by procedure','per procedure','for each procedure','for procedures','for a procedure','across all procedure types','by provider and procedure','by procedure and provider']) {
      rejectsWithoutTotals(`Show ${label} ${suffix} in 2025.`);
    }
    rejectsWithoutTotals(`Show procedure-specific ${label} in 2025.`);
  }
  for (const q of ['Show revenue for Biopsy.','Show procedure revenue in 2025.','Show procedure breakdown of revenue.','Show revenue broken down by procedure.']) rejectsWithoutTotals(q);
});

test('unsupported payer and joint payer/procedure breakdowns never substitute independent totals', () => {
  for (const [key,label] of Object.entries(measures)) {
    if (['revenue','payerMix'].includes(key)) continue;
    for (const suffix of ['by payer','per payer','for each payer','for payers','by provider and payer']) rejectsWithoutTotals(`Show ${label} ${suffix} in 2025.`);
    rejectsWithoutTotals(`Show payer-specific ${label} in 2025.`);
  }
  for (const q of ['Show collections for Medicare.','Show payer collections in 2025.','Show revenue by payer and procedure.','Show revenue by procedure and payer.','Show payer mix by procedure.','Show procedure counts for Aetna.','Show payer revenue for Biopsy.']) rejectsWithoutTotals(q);
});

test('unsupported patient, claim, specialty, source, and location dimensions are explicit', () => {
  for (const axis of ['patient','claim','specialty','source','location']) rejectsWithoutTotals(`Show revenue per ${axis} in 2025.`);
  assert.deepEqual([...practiceBreakdowns('show revenue by provider, payer and procedure in 2025.')],['provider','payer','procedure']);
});

test('valid independent combined summaries and supported breakdowns retain calculated results', () => {
  for (const q of ['Show revenue and procedure counts in 2025.','Show procedure counts and revenue in 2025.','Show revenue and procedure counts by provider in 2025.']) {
    const text=answer(q);assert.match(text,/Practice total: \$6,958,793/);assert.match(text,/Selected procedure total: 12,987/);
  }
  const independent=answer('Show collections and payer mix in 2025.');
  assert.match(independent,/Practice total: \$6,488,837/);assert.match(independent,/Blue Cross: \$1,473,829/);
  assert.match(answer('Show patient counts and procedure counts in 2025.'),/Practice total: 10,231/);
  assert.match(answer('Show revenue by payer in 2025.'),/Medicare: \$1,028,708/);
  assert.match(answer('Show procedure counts by procedure in 2025.'),/Biopsy: 2,892/);
  const monthly=answer('Show revenue per provider and month in 2025.');
  assert.match(monthly,/Monthly revenue/);assert.match(monthly,/Jan: .*; Lin:/);
  assert.match(answer('Show payer mix by provider and quarter in 2025.'),/Quarter payer revenue/);
});
