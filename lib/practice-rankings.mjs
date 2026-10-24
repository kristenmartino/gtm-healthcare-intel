// Ranking intent is independent of the measure and its reporting grain.
export function parsePracticeRanking(question) {
  const targets = new Set();
  const targetNames = {provider:'provider',payer:'payer',procedure:'procedure',month:'month',quarter:'quarter'};
  for (const [,name] of question.matchAll(/\b(?:which|what)\s+(provider|payer|procedure|month|quarter)s?\b/g)) targets.add(targetNames[name]);
  if (/\bwho\b/.test(question)) targets.add('provider');
  const minimum = /\b(?:lowest|least|fewest|minimum|min)\b/.test(question);
  const maximum = /\b(?:highest|most|maximum|max|top|leads)\b/.test(question);
  const best = /\bbest\b/.test(question), worst = /\bworst\b/.test(question);
  return {active:targets.size>0||minimum||maximum||best||worst,targets,minimum,maximum,best,worst};
}

export function practiceRankingLines(rows, {intent, metric, label, value, format}) {
  const valid = rows.filter(row=>Number.isFinite(value(row)));
  if (!valid.length) return [];
  const lowerIsBetter = ['denials','noShows'].includes(metric);
  let minimum = intent.minimum || (intent.best && lowerIsBetter) || (intent.worst && !lowerIsBetter);
  let maximum = intent.maximum || (intent.best && !lowerIsBetter) || (intent.worst && lowerIsBetter);
  if (!minimum && !maximum) minimum = maximum = true;
  const result = [];
  for (const [enabled,word,extreme] of [[maximum,'Highest',Math.max],[minimum,'Lowest',Math.min]]) {
    if (!enabled) continue;
    const edge = extreme(...valid.map(value));
    // Select ties before formatting, including values that only look tied
    // after rounding percentages or reimbursement amounts.
    const names = valid.filter(row=>value(row)===edge).map(row=>row.name).join(' and ');
    result.push(`${word} ${label}: ${names} (${format(edge)}).`);
  }
  return result;
}
