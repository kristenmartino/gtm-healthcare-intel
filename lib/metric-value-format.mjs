export function formatMetricValue(value, unit) {
  if (unit === '$K') return `$${value}K`;
  if (unit === 'edits') return `${value} edits`;
  return `${value}${unit}`;
}
