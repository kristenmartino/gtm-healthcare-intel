// Deterministic, invented portfolio scenario. No company records or live CRM.
// The QBR and AskGTM consume this same module; figures are calculated from rows.
export const CURRENT_QUARTER = "Q1 2025";
export const PRIOR_QUARTER = "Q4 2024";
export const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
export const ratio = (numerator, denominator) => denominator > 0 ? numerator / denominator : null;
export const pct = (value, digits = 1) => value == null ? "—" : `${(value * 100).toFixed(digits)}%`;
export const money = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
export const shortMoney = value => `$${(value / 1000000).toFixed(2)}M`;

const reps = ["Sarah Chen", "Marcus Rivera", "Emily Okafor", "James Patel", "Lisa Wong", "David Kim"];
const specialties = ["Dermatology", "Orthopedics", "Gastroenterology", "Ophthalmology"];
const sources = ["Referral", "Inbound", "Trade Show", "Outbound", "Paid"];
const quotas = [450000, 450000, 400000, 350000, 400000, 350000];
const q1Wins = [8, 6, 6, 4, 5, 2];
const q1Amounts = [504000, 378000, 380000, 273000, 355000, 250000];
const cycles = [41, 52, 44, 58, 46, 68];
const quarters = ["Q3 2024", PRIOR_QUARTER, CURRENT_QUARTER];
const targets = { "Q3 2024": 2100000, [PRIOR_QUARTER]: 2200000, [CURRENT_QUARTER]: 2400000 };
const specAssignments = [0, 0, 2, 3, 0, 1, 2, 3, 0, 2, 3, 0, 1, 2, 0, 3, 0, 2, 3, 0, 1, 2, 0, 3, 0, 2, 3, 0, 1, 2, 3];
const sourceAssignments = [...Array(10).fill(0), ...Array(8).fill(1), ...Array(6).fill(2), ...Array(5).fill(3), ...Array(2).fill(4)];
const deals = [];
function appendDeal(quarter, repIndex, specialtyIndex, sourceIndex, stage, acv, daysInPipeline) {
  deals.push({ id: deals.length, rep: reps[repIndex], specialty: specialties[specialtyIndex], source: sources[sourceIndex], quarter, stage, won: stage === "Closed Won", lost: stage === "Closed Lost", acv, daysInPipeline, practiceSize: ["Solo", "Small", "Medium", "Large"][deals.length % 4] });
}
for (const [quarterIndex, quarter] of quarters.entries()) {
  let wonIndex = 0;
  const wins = quarter === CURRENT_QUARTER ? q1Wins : quarter === PRIOR_QUARTER ? [8, 7, 6, 5, 5, 3] : [7, 6, 6, 4, 4, 3];
  const amounts = quarter === CURRENT_QUARTER ? q1Amounts : quarter === PRIOR_QUARTER ? [460000, 380000, 350000, 270000, 300000, 220000] : [390000, 310000, 320000, 240000, 260000, 180000];
  reps.forEach((_, repIndex) => {
    for (let i = 0; i < wins[repIndex]; i++) {
      const base = Math.floor(amounts[repIndex] / wins[repIndex]);
      const acv = base + (i < amounts[repIndex] % wins[repIndex] ? 1 : 0);
      appendDeal(quarter, repIndex, quarter === CURRENT_QUARTER ? specAssignments[wonIndex] : wonIndex % 4, sourceAssignments[wonIndex % sourceAssignments.length], "Closed Won", acv, cycles[repIndex] + (quarter === CURRENT_QUARTER ? 0 : 4));
      wonIndex++;
    }
  });
  const losses = quarter === CURRENT_QUARTER ? [23, 24, 23, 24] : quarter === PRIOR_QUARTER ? [32, 14, 40, 40] : [25, 20, 25, 25];
  losses.forEach((count, specialtyIndex) => {
    for (let i = 0; i < count; i++) appendDeal(quarter, i % 6, specialtyIndex, (i + specialtyIndex) % 5, "Closed Lost", 20000 + i * 1000, 20 + i);
  });
  // 60 qualified open opportunities per snapshot; totals 6.4M / 6.8M / 7.2M.
  const openTotal = [6400000, 6800000, 7200000][quarterIndex];
  for (let i = 0; i < 60; i++) appendDeal(quarter, i % 6, i % 4, i % 5, ["Qualified", "Demo Scheduled", "Proposal Sent", "Negotiation"][i % 4], Math.floor(openTotal / 60) + (i < openTotal % 60 ? 1 : 0), 12 + i);
}
const churn = specialties.map((specialty, i) => ({
  specialty, customersStart: [248, 186, 142, 210][i], churned: [8, 14, 6, 11][i], expanded: [32, 18, 22, 28][i],
  priorRevenue: [1000000, 800000, 600000, 600000][i], currentRevenue: [1124000, 830400, 660600, 651600][i],

}));
const marketing = quarters.map((quarter, i) => ({ quarter, mqls: [400, 460, 520][i], sqls: [180, 200, 220][i], demosBooked: [100, 110, 120][i], pipelineGenerated: [1800000, 2000000, 2200000][i], spend: [200000, 220000, 240000][i] }));
export const GTM_DATA = { reps, specialties, sources, quarters, deals, marketing, churn, targets, quotas, stages: ["Qualified", "Demo Scheduled", "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost"] };
export function summarize(rows) {
  const won = rows.filter(d => d.won), lost = rows.filter(d => d.lost), open = rows.filter(d => !d.won && !d.lost);
  const bookings = sum(won, "acv");
  return { wins: won.length, losses: lost.length, closed: won.length + lost.length, bookings, pipeline: sum(open, "acv"), winRate: ratio(won.length, won.length + lost.length), avgACV: ratio(bookings, won.length), avgCycle: ratio(sum(won, "daysInPipeline"), won.length) };
}
export const quarterSummary = quarter => ({ ...summarize(deals.filter(d => d.quarter === quarter)), target: targets[quarter] });
export function breakdown(key, values, quarter = CURRENT_QUARTER) {
  return values.map((value, i) => ({ name: value, ...summarize(deals.filter(d => d.quarter === quarter && d[key] === value)), ...(key === "rep" ? { quota: quotas[i] } : {}) }));
}
export const qbr = { current: quarterSummary(CURRENT_QUARTER), prior: quarterSummary(PRIOR_QUARTER), reps: breakdown("rep", reps), specialties: breakdown("specialty", specialties), sources: breakdown("source", sources), churn };
export const nrr = ratio(sum(churn, "currentRevenue"), sum(churn, "priorRevenue"));
