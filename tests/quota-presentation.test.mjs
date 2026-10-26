import test from 'node:test';
import assert from 'node:assert/strict';
import { executeQueryTool, renderQueryResult } from '../lib/query-engine.mjs';
import { validateResultCoverage } from '../lib/query-coverage.mjs';
import { answerWithQueryTools } from '../lib/query-service.mjs';

const reps = ['Sarah Chen', 'David Kim'];
const query = (report, extra = {}) => ({
  report, quarters: ['Q1 2025'], reps, specialties: [], sources: [], groupBy: ['rep'],
  predicate: { metric: report === 'quota' ? 'quota' : 'bookings', operator: 'none', value: null },
  ranking: { metric: report === 'quota' ? 'quota' : 'bookings', direction: 'none', limit: 1, within: [] },
  ...extra,
});
const question = 'Show bookings, quota and attainment by rep for Sarah Chen and David Kim in Q1 2025.';
const render = (queries, text = question) => {
  const result = validateResultCoverage('gtm', text.toLowerCase(), executeQueryTool('query_gtm', { queries, explain: false }));
  return { result, ...renderQueryResult(result) };
};
const chen = 'Chen: Bookings (won ACV) $504,000; Full-quarter quota $450,000; Attainment 112.0%.';
const kim = 'Kim: Bookings (won ACV) $250,000; Full-quarter quota $350,000; Attainment 71.4%.';
const total = 'Total: Bookings (won ACV) $754,000; Full-quarter quota $800,000; Attainment 94.3%.';
const scope = 'Period: Q1 2025. Reps: Sarah Chen, David Kim.';

test('captured overlapping performance and quota plans display each rep once and retain calculation records', async () => {
  // This is the two-query plan captured in the October 26 assessment packet.
  const queries = [query('performance'), query('quota')];
  const client = { messages: { create: async () => ({
    stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'captured-plan', name: 'query_gtm', input: { queries, explain: false } }],
  }) } };
  const response = await answerWithQueryTools({ domain: 'gtm', question, client });
  assert.equal(response.source, 'validated-query');
  assert.equal(response.content[0].text, [scope, chen, kim].join('\n'));
  assert.equal(response.toolCalls[0].result.results.length, 2);
  assert.equal(response.calculationDetails.length, 2);
  assert.ok(response.calculationDetails.every(detail => detail.rows.length === 2));
  assert.ok(response.appliedScope.some(line => line === 'Query 1: performance.'));
  assert.ok(response.appliedScope.some(line => line === 'Query 2: quota.'));
});

test('combined and individual answers keep their distinct rows regardless of overlapping-query order', () => {
  for (const queries of [
    [query('quota', { groupBy: [] }), query('performance'), query('quota')],
    [query('quota', { groupBy: [] }), query('quota'), query('performance')],
  ]) {
    const response = render(queries);
    assert.equal(response.text, [scope, total, '', scope, chen, kim].join('\n'));
    const row = response.result.results[0].rows[0];
    assert.equal(row.bookings, 754000);
    assert.equal(row.quota, 800000);
    assert.equal(row.attainment, 94.25);
  }
  assert.equal(render([query('quota', { groupBy: [] })]).text, [scope, total].join('\n'));
  assert.equal(render([query('quota')]).text, [scope, chen, kim].join('\n'));
});

test('different cohorts, periods, groupings, filters and rankings remain separate answers', () => {
  const cases = [
    query('performance', { reps: ['Sarah Chen'] }),
    query('performance', { quarters: ['Q4 2024'] }),
    query('performance', { groupBy: [] }),
    query('performance', { specialties: ['Dermatology'] }),
    query('performance', { sources: ['Referral'] }),
    query('performance', { predicate: { metric: 'bookings', operator: 'gte', value: 0 } }),
    query('performance', { ranking: { metric: 'bookings', direction: 'highest', limit: 1, within: [] } }),
  ];
  for (const performance of cases) {
    const response = render([performance, query('quota')]);
    assert.equal((response.text.match(/Period:/g) || []).length, 2, JSON.stringify(performance));
    assert.ok(response.text.includes(chen));
    assert.ok(response.text.includes(kim));
  }
});

test('a performance result with requested fields absent from quota is not hidden', () => {
  const response = render([
    query('performance', { reps: [], groupBy: ['quarter'] }),
    query('quota', { reps: [], groupBy: ['quarter'] }),
  ], 'Show bookings, target, quota and attainment in Q1 2025.');
  assert.equal((response.text.match(/Period:/g) || []).length, 2);
  assert.match(response.text, /Full-quarter target \$2,400,000/);
  assert.match(response.text, /Full-quarter quota \$2,400,000/);
});

test('differing calculated values are never treated as duplicate display output', () => {
  const response = render([query('performance'), query('quota')]);
  response.result.results[0].rows[0].bookings += 1;
  const text = renderQueryResult(response.result).text;
  assert.equal((text.match(/Period:/g) || []).length, 2);
  assert.match(text, /Chen: Bookings \(won ACV\) \$504,001/);
  assert.ok(text.includes(chen));
});
