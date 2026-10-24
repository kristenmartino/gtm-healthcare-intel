// Question-side dimension evidence checked against the validated tool plan.
const dimensionTerms = [
  ['provider', /\bproviders?\b/], ['month', /\bmonths?\b/], ['quarter', /\bquarters?\b/],
  ['payer', /\b(?:payers?|insurance)\b/], ['procedure', /\b(?:procedures?|procedure types?)\b/],
  ['patient', /\bpatients?\b/], ['claim', /\bclaims?\b/], ['specialty', /\bspecialt(?:y|ies)\b/],
  ['source', /\b(?:sources?|channels?)\b/], ['location', /\b(?:locations?|metros?)\b/],
];

export function practiceBreakdowns(question) {
  const dimensions = new Set();
  // Keep coordinated dimensions together: "by provider and procedure" has
  // two axes. Stop at a new scope, sentence, or separate-summary clause.
  const clauses = question.matchAll(/\b(?:by|per|across|for\s+(?:each|every|all))\s+([^.;?]+?)(?=\s+\b(?:in|for|during|with|show|give)\b|[.;?]|$)/g);
  for (const [,clause] of clauses) {
    for (const [dimension,pattern] of dimensionTerms) if (pattern.test(clause)) dimensions.add(dimension);
  }
  for (const dimension of ['payer','procedure','patient','claim']) {
    if (new RegExp(`\\b${dimension}[- ](?:level|specific)\\b`).test(question)) dimensions.add(dimension);
  }
  // Unsupported compound attribution requests have the same restrictions
  // as an explicit "by" clause. Payer revenue is a supported standalone
  // measure; it does not apply a payer axis to other independent measures.
  for (const dimension of ['payer','procedure']) {
    if (new RegExp(`\\bfor\\s+(?:(?:a|the|each|every|all)\\s+)?${dimension}(?:s)?\\b`).test(question)) dimensions.add(dimension);
    const attributedMeasures = `${dimension==='procedure'?'revenues?|income|':''}collections?|reimbursement|denials?|no[- ]shows?|patients?`;
    if (new RegExp(`\\b${dimension}\\s+(?:${attributedMeasures})\\b`).test(question)) dimensions.add(dimension);
    if (new RegExp(`\\b${dimension}(?:s)?\\s+breakdown\\b`).test(question)) dimensions.add(dimension);
  }
  return dimensions;
}
