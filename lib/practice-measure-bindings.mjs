// A name adjacent to its supported measure belongs to that measure. Names
// in a trailing shared filter remain unbound and use the global grain guard.
export function bindPracticeNamedMeasures(question, procedurePatterns, payers) {
  let text = question;
  const procedures = new Set(), selectedPayers = new Set();
  const payerPatterns = payers.map(name=>[name,new RegExp(`\\b${name.toLowerCase().replace('-','[- ]')}\\b`)]);
  const bind = (patterns, measure, replacement, selected) => {
    const name = `(?:${patterns.map(([,pattern])=>pattern.source).join('|')})`;
    const list = `${name}(?:\\s*(?:,\\s*(?:and\\s+)?|and\\s+|&\\s*)${name})*`;
    const capture = match => {
      for (const [label,pattern] of patterns) if (new RegExp(pattern.source).test(match)) selected.add(label);
      return ` ${replacement} `;
    };
    text = text.replace(new RegExp(`${list}\\s+${measure}\\b`,'g'),capture);
    // "Counts for Mohs and payer revenue" has two measure clauses. By
    // contrast, "collections and payer revenue for Medicare" has a shared
    // trailing filter and must not silently unfilter collections.
    text = text.replace(new RegExp(`\\b${measure}\\s+(?:for|of)\\s+${list}(?=\\s*(?:,|;|and\\b))`,'g'),capture);
  };
  bind(procedurePatterns,'(?:procedures?\\s+)?(?:counts?|volumes?)','procedures',procedures);
  bind(payerPatterns,'(?:(?:payer|insurance)\\s+)?(?:revenues?|income|mix)','payer mix',selectedPayers);
  return {text,procedures:[...procedures],payers:[...selectedPayers]};
}
