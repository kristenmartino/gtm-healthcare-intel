import { PRACTICE_DATA } from './practice-scenario.mjs';

export const PRACTICE_FIELDS = ['patients', 'revenue', 'collections', 'denials', 'noShows'];
export const PRACTICE_PROCEDURES = Object.keys(PRACTICE_DATA.months[0].providers[PRACTICE_DATA.providers[0]].procedures);
const empty = () => ({ ...Object.fromEntries(PRACTICE_FIELDS.map(k => [k, 0])),
  procedures: Object.fromEntries(PRACTICE_PROCEDURES.map(k => [k, 0])),
  payerRevenue: Object.fromEntries(PRACTICE_DATA.payers.map(k => [k, 0])), reimbursementSum: 0, observations: 0 });

// Sum additive measures first. Ratios use the summed numerator/denominator;
// reimbursement is explicitly an unweighted mean of the supplied averages.
export function aggregatePractice({ monthIndexes = Array.from({length:12},(_,i)=>i), providers = PRACTICE_DATA.providers } = {}) {
  if (!monthIndexes.length || new Set(monthIndexes).size !== monthIndexes.length || monthIndexes.some(i => !Number.isInteger(i) || i < 0 || i > 11)) throw new Error('Invalid scenario months');
  if (!providers.length || new Set(providers).size !== providers.length || providers.some(p => !PRACTICE_DATA.providers.includes(p))) throw new Error('Invalid scenario providers');
  const finish = row => ({ ...row, collectionRatio: row.revenue ? row.collections / row.revenue * 100 : null,
    avgReimb: row.observations ? row.reimbursementSum / row.observations : null });
  const add = (target, source) => {
    for (const key of PRACTICE_FIELDS) target[key] += source[key];
    for (const key of PRACTICE_PROCEDURES) target.procedures[key] += source.procedures[key];
    for (const key of PRACTICE_DATA.payers) target.payerRevenue[key] += source.payerRevenue[key];
    target.reimbursementSum += source.reimbursementSum; target.observations += source.observations;
  };
  const total = empty();
  const rows = providers.map(provider => {
    const row = empty();
    for (const i of monthIndexes) {
      const data = PRACTICE_DATA.months[i].providers[provider];
      add(row, { ...data, payerRevenue: data.payerMix, reimbursementSum: data.avgReimb, observations: 1 });
    }
    add(total, row);
    return { provider, ...finish(row) };
  });
  return { providers: rows, total: finish(total) };
}
