// A measure may only be grouped on dimensions represented in its source data.
// Recognized words are not sufficient evidence that two measures can be joined.
const measures = ['revenue', 'collections', 'collectionRatio', 'denials', 'noShows', 'patients', 'avgReimb', 'procedures', 'payerMix'];
export const PRACTICE_BREAKDOWN_SUPPORT = {
  provider: new Set(measures),
  month: new Set(measures),
  quarter: new Set(measures),
  payer: new Set(['revenue', 'payerMix']),
  procedure: new Set(['procedures']),
};
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
  // Compound attribution requests, e.g. "procedure revenue" and "payer
  // collections", have the same restrictions as an explicit "by" clause.
  for (const dimension of ['payer','procedure']) {
    if (new RegExp(`\\b${dimension}\\s+(?:revenue|income|collections?|reimbursement|denials?|no[- ]shows?|patients?)\\b`).test(question)) dimensions.add(dimension);
    if (new RegExp(`\\b${dimension}(?:s)?\\s+breakdown\\b`).test(question)) dimensions.add(dimension);
  }
  return dimensions;
}

export function validatePracticeBreakdowns(metrics, dimensions) {
  if (dimensions.has('payer') && dimensions.has('procedure')) return 'Payer-by-procedure breakdowns cannot be calculated: no linkage between payer revenue and procedure counts is supplied. Ask for payer revenue or procedure counts separately.';
  for (const dimension of dimensions) {
    const supported = PRACTICE_BREAKDOWN_SUPPORT[dimension];
    if (!supported) return `A ${dimension}-level breakdown cannot be calculated from these aggregate records. Supported breakdowns are by provider and period, with payer revenue and procedure counts available separately.`;
    if (metrics.every(metric => supported.has(metric))) continue;
    if (dimension === 'procedure') return 'Only procedure counts are supplied by procedure type. Procedure-level revenue, collections, reimbursement, patient counts, denial counts, and no-show counts cannot be calculated. Ask for procedure counts, or request independent practice measures separately.';
    if (dimension === 'payer') return 'Only revenue is supplied by payer. Payer-specific denial counts, collections, patient counts, no-show counts, reimbursement, procedures, and rates cannot be calculated. Please specify payer revenue or payer mix.';
  }
  return null;
}
