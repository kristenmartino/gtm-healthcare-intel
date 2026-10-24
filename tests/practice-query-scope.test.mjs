import test from 'node:test';
import assert from 'node:assert/strict';
import { answerPracticeQuestion as answer } from '../lib/practice-answers.mjs';
import { parsePracticeScope } from '../lib/practice-scope.mjs';
import { PRACTICE_DATA } from '../lib/practice-scenario.mjs';

test('mismatched full provider names clarify instead of merging two provider scopes', () => {
  for (const first of PRACTICE_DATA.providers) {
    for (const last of PRACTICE_DATA.providers) {
      if (first === last) continue;
      const name = `${first.split(' ')[1]} ${last.split(' ').at(-1)}`;
      for (const prefix of ['', 'Dr. ']) {
        const result = answer(`Show collections for ${prefix}${name} in 2025.`);
        assert.match(result, /provider name|Please specify/, name);
        assert.doesNotMatch(result, /Calculated practice measures|Selected provider total|Practice total/, name);
      }
    }
  }
  for (const name of ['Anya Smith', 'Anya Lin and Priya Smith', 'Anya Lin Priya Shah']) {
    assert.doesNotMatch(answer(`Show collections for ${name} in 2025.`), /Calculated practice measures/);
  }
});

test('valid full names, unique aliases, and explicit provider lists preserve scope', () => {
  for (const provider of PRACTICE_DATA.providers) {
    const parts = provider.toLowerCase().replace('dr. ', '').split(' ');
    for (const name of [provider.toLowerCase(), parts.join(' '), ...parts]) {
      assert.deepEqual(parsePracticeScope(`collections for ${name} in 2025`).providers, [provider]);
      assert.match(answer(`Show collections for ${name} in 2025.`), /Calculated practice measures/);
    }
  }
  for (const names of ['Lin and Shah', 'Anya and Priya', 'Lin, Shah', 'Lin & Shah', 'Dr. Anya Lin and Dr. Priya Shah']) {
    const result = answer(`Show collections for ${names} in 2025.`);
    assert.match(result, /Lin: \$1,322,077/);
    assert.match(result, /Shah: \$1,282,358/);
    assert.match(result, /Selected provider total: \$2,604,435/);
    assert.doesNotMatch(result, /Singh:|Brooks:|Yamamoto:/);
  }
});

test('payer revenue remains an independent measure alongside every other supported measure', () => {
  const measures = [
    ['revenue', /Practice total: \$6,958,793/],
    ['collections', /Practice total: \$6,488,837/],
    ['collection rate', /Practice ratio: 93\.2%/],
    ['denial counts', /Practice total: 1,101/],
    ['no-show counts', /Practice total: 746/],
    ['patient counts', /Practice total: 10,231/],
    ['average reimbursement', /Practice mean: \$319\.07/],
    ['procedure counts', /Selected procedure total: 12,987/],
  ];
  for (const [measure, anchor] of measures) {
    for (const pair of [`${measure} and payer revenue`, `payer revenue and ${measure}`]) {
      const result = answer(`Show ${pair} in 2025.`);
      assert.match(result, anchor, pair);
      assert.match(result, /All-payer revenue denominator: \$6,958,793/, pair);
    }
  }
  for (const wording of ['payer revenue', 'payer revenues', 'payer income', 'insurance revenue', 'payer mix']) {
    const result = answer(`Show procedure counts and ${wording} for Lin and Shah in Q1 2025.`);
    assert.match(result, /Jan–Mar 2025/);
    assert.match(result, /Selected procedure total:/);
    assert.match(result, /Monthly payer revenue|Payer revenue and share/);
    assert.doesNotMatch(result, /cannot be calculated|Practice total/);
  }
});

test('independent-summary support never permits an unsupported shared breakdown or named filter', () => {
  for (const q of [
    'Show procedure counts and payer revenue by payer in 2025.',
    'Show procedure counts and payer revenue by procedure in 2025.',
    'Show procedure counts and payer revenue by payer and procedure in 2025.',
    'Show collections and payer revenue for Medicare in 2025.',
    'Show payer revenue for Biopsy in 2025.',
    'Show procedure revenue and payer revenue in 2025.',
    'Show payer collections and procedure counts in 2025.',
  ]) {
    const result = answer(q);
    assert.match(result, /cannot be calculated/);
    assert.doesNotMatch(result, /Calculated practice measures|Practice total|Selected procedure total/);
  }
  const scoped = answer('Show procedure counts and payer revenue by provider and month for Lin and Shah in Q1 2025.');
  assert.match(scoped, /Monthly procedure counts/);
  assert.match(scoped, /Monthly payer revenue/);
  assert.match(scoped, /Lin:/);
  assert.match(scoped, /Shah:/);
  assert.doesNotMatch(scoped, /Singh:|Brooks:|Yamamoto:/);
});
