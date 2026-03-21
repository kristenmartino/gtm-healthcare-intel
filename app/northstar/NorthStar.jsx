import { useState, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// METRIC REGISTRY DATA
// ═══════════════════════════════════════════════════════════════
const METRIC_REGISTRY = [
  {
    name: "Pipeline (Qualified)",
    category: "Pipeline",
    definition: "Total ACV of all open opportunities at Stage 2 (Qualified) or later, excluding deals marked Closed Lost or Closed Won.",
    formula: "SUM(Opportunity.ACV) WHERE Stage >= 'Qualified' AND IsClosed = FALSE",
    source: "Salesforce Opportunity",
    owner: "Rev Ops",
    refresh: "Daily (6:00 AM ET)",
    qualityScore: 94,
    lastValidated: "2025-03-12",
    validatedBy: "Sarah Chen, Rev Ops",
    status: "resolved",
    conflicts: [
      { team: "Sales", altDef: "All open opportunities regardless of stage", resolved: true },
      { team: "Marketing", altDef: "Includes MQLs not yet converted to opportunity", resolved: true },
      { team: "Finance", altDef: "Only Stage 3+ with signed NDA", resolved: true },
    ],
  },
  {
    name: "Win Rate",
    category: "Sales Efficiency",
    definition: "Percentage of opportunities reaching Stage 2+ that close as Won within the reporting period. Excludes deals with ACV < $5,000.",
    formula: "COUNT(Closed Won) / COUNT(Closed Won + Closed Lost) WHERE Stage >= 'Qualified' AND ACV >= 5000",
    source: "Salesforce Opportunity",
    owner: "Rev Ops",
    refresh: "Daily (6:00 AM ET)",
    qualityScore: 91,
    lastValidated: "2025-03-10",
    validatedBy: "Sarah Chen, Rev Ops",
    status: "resolved",
    conflicts: [
      { team: "Sales", altDef: "Won / all leads (inflates denominator)", resolved: true },
      { team: "Finance", altDef: "Won / Won+Lost+Stalled (includes stalled as lost)", resolved: true },
    ],
  },
  {
    name: "Sales Cycle (Days)",
    category: "Sales Efficiency",
    definition: "Median calendar days from opportunity creation date to Close Date for Closed Won deals in the period.",
    formula: "MEDIAN(CloseDate - CreatedDate) WHERE IsWon = TRUE",
    source: "Salesforce Opportunity",
    owner: "Rev Ops",
    refresh: "Weekly (Monday AM)",
    qualityScore: 88,
    lastValidated: "2025-03-08",
    validatedBy: "Marcus Rivera, Sales Ops",
    status: "resolved",
    conflicts: [
      { team: "Sales", altDef: "From first meeting, not opp creation", resolved: true },
    ],
  },
  {
    name: "Marketing-Sourced Pipeline",
    category: "Marketing Attribution",
    definition: "Pipeline ACV where the original lead source is a marketing channel (Inbound, Content, Event, Webinar, Paid). Attribution = first-touch.",
    formula: "SUM(ACV) WHERE LeadSource IN ('Inbound','Content','Event','Webinar','Paid') AND Stage >= 'Qualified'",
    source: "Salesforce + HubSpot",
    owner: "Marketing Ops",
    refresh: "Daily (7:00 AM ET)",
    qualityScore: 79,
    lastValidated: "2025-03-05",
    validatedBy: "Emily Okafor, Marketing Ops",
    status: "disputed",
    conflicts: [
      { team: "Marketing", altDef: "Any-touch attribution (inflates by 40%)", resolved: false },
      { team: "Sales", altDef: "Only counts if SDR confirms marketing influence", resolved: false },
    ],
  },
  {
    name: "Net Revenue Retention (NRR)",
    category: "Customer Success",
    definition: "Revenue from existing customers in current period (including expansion, contraction, churn) divided by revenue from same cohort in prior period.",
    formula: "(Revenue_Current_Cohort + Expansion - Contraction - Churn) / Revenue_Prior_Cohort × 100",
    source: "Billing System + Salesforce",
    owner: "Finance",
    refresh: "Monthly (5th business day)",
    qualityScore: 86,
    lastValidated: "2025-03-01",
    validatedBy: "James Patel, FP&A",
    status: "resolved",
    conflicts: [
      { team: "CS", altDef: "Excludes involuntary churn (payment failures)", resolved: true },
    ],
  },
  {
    name: "Churn Rate",
    category: "Customer Success",
    definition: "Percentage of customers who cancel or do not renew within the reporting period, measured by logo count (not revenue).",
    formula: "COUNT(Churned_Customers) / COUNT(Active_Customers_Start_of_Period) × 100",
    source: "Salesforce + Billing",
    owner: "CS Ops",
    refresh: "Monthly",
    qualityScore: 82,
    lastValidated: "2025-02-28",
    validatedBy: "Lisa Wong, CS Ops",
    status: "resolved",
    conflicts: [
      { team: "Finance", altDef: "Revenue-weighted churn (different number)", resolved: true },
      { team: "Sales", altDef: "Excludes first-year churn from win rate calc", resolved: true },
    ],
  },
  {
    name: "Demo-to-Close Conversion",
    category: "Sales Efficiency",
    definition: "Percentage of completed demos that result in a Closed Won deal within 120 days of demo date.",
    formula: "COUNT(Won within 120d of Demo) / COUNT(Completed Demos) × 100",
    source: "Salesforce Activity + Opportunity",
    owner: "Rev Ops",
    refresh: "Weekly",
    qualityScore: 73,
    lastValidated: "2025-02-25",
    validatedBy: "Sarah Chen, Rev Ops",
    status: "disputed",
    conflicts: [
      { team: "Sales", altDef: "No time window — any demo that eventually closes", resolved: false },
      { team: "Marketing", altDef: "Includes virtual product tours as demos", resolved: false },
    ],
  },
  {
    name: "CAC (Customer Acquisition Cost)",
    category: "Unit Economics",
    definition: "Total Sales + Marketing spend in period divided by number of new customers acquired in that period.",
    formula: "(Sales_Spend + Marketing_Spend) / COUNT(New_Customers)",
    source: "ERP + Salesforce",
    owner: "Finance",
    refresh: "Monthly",
    qualityScore: 68,
    lastValidated: "2025-02-20",
    validatedBy: "James Patel, FP&A",
    status: "disputed",
    conflicts: [
      { team: "Marketing", altDef: "Only marketing spend / marketing-sourced customers", resolved: false },
      { team: "Sales", altDef: "Fully loaded (includes onboarding cost)", resolved: false },
      { team: "Finance", altDef: "Blended across all channels", resolved: false },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// ADOPTION TRACKER DATA
// ═══════════════════════════════════════════════════════════════
const TEAMS = ["Sales", "Marketing", "CS", "Finance", "Rev Ops", "Exec"];
const REPORTS = [
  { name: "Pipeline Health Dashboard", type: "Core", owner: "Rev Ops" },
  { name: "Win/Loss Analysis", type: "Core", owner: "Rev Ops" },
  { name: "Marketing Attribution Report", type: "Core", owner: "Marketing Ops" },
  { name: "Churn & Retention Dashboard", type: "Core", owner: "CS Ops" },
  { name: "Sales Productivity Scorecard", type: "Core", owner: "Rev Ops" },
  { name: "Executive GTM Summary", type: "Exec", owner: "Rev Ops" },
  { name: "Territory Performance", type: "Sales", owner: "Sales Ops" },
  { name: "Campaign ROI Tracker", type: "Marketing", owner: "Marketing Ops" },
];

function seededRandom(s) { let h = s; return () => { h = (h * 16807) % 2147483647; return h / 2147483647; }; }

function generateAdoption() {
  const r = seededRandom(42);
  const weeks = [];
  for (let w = 0; w < 12; w++) {
    const weekData = {};
    TEAMS.forEach(t => {
      const base = t === "Rev Ops" ? 0.92 : t === "Exec" ? 0.78 : t === "Finance" ? 0.7 : t === "Sales" ? 0.45 : t === "Marketing" ? 0.55 : 0.5;
      const growth = w * 0.015;
      weekData[t] = Math.min(1, base + growth + (r() - 0.5) * 0.08);
    });
    weeks.push(weekData);
  }
  return weeks;
}

const ADOPTION_DATA = generateAdoption();

const SPREADSHEET_RISKS = [
  { team: "Sales — East", file: "Q1_pipeline_tracker.xlsx", lastEdited: "2 days ago", risk: "high", conflict: "Pipeline numbers diverge from Salesforce by $340K" },
  { team: "Sales — West", file: "My_deals_2025.xlsx", lastEdited: "today", risk: "high", conflict: "Includes verbal commits not in CRM" },
  { team: "Marketing", file: "campaign_leads_backup.csv", lastEdited: "5 days ago", risk: "medium", conflict: "Lead counts differ from HubSpot by 12%" },
  { team: "CS", file: "renewal_tracker_v3_FINAL2.xlsx", lastEdited: "1 day ago", risk: "high", conflict: "Churn dates don't match billing system" },
  { team: "Finance", file: "monthly_bookings_reconcile.xlsx", lastEdited: "3 days ago", risk: "medium", conflict: "Uses different ACV calc than standard" },
];

// ═══════════════════════════════════════════════════════════════
// MATURITY MODEL DATA
// ═══════════════════════════════════════════════════════════════
const MATURITY_LEVELS = [
  {
    level: 1, name: "Descriptive", label: "What happened?", color: "#64748b",
    description: "Backward-looking reports and dashboards showing historical GTM performance.",
    examples: ["Monthly pipeline summary", "Quarterly bookings report", "Win/loss count by rep"],
    infra: ["Salesforce reports", "Basic BI dashboards", "Manual Excel exports"],
    org: ["Ad-hoc report requests", "No metric governance", "Multiple sources of truth"],
    current: true,
  },
  {
    level: 2, name: "Diagnostic", label: "Why did it happen?", color: "#f59e0b",
    description: "Root cause analysis connecting outcomes to drivers. Segmentation and cohort analysis.",
    examples: ["Win rate by source + specialty", "Funnel drop-off analysis", "Churn driver segmentation"],
    infra: ["Centralized data warehouse", "Standardized metric definitions", "Self-serve BI access"],
    org: ["Metric governance council", "Single source of truth", "Regular data reviews"],
    current: true, partial: true,
  },
  {
    level: 3, name: "Predictive", label: "What will happen?", color: "#38bdf8",
    description: "Forward-looking models that forecast outcomes based on current signals.",
    examples: ["Weighted pipeline forecast", "Churn propensity scoring", "Deal velocity prediction"],
    infra: ["ML pipeline infrastructure", "Feature store", "Model monitoring"],
    org: ["Data science partnership", "Forecast accuracy tracking", "Scenario planning culture"],
    current: false,
  },
  {
    level: 4, name: "Prescriptive", label: "What should we do?", color: "#10b981",
    description: "Automated recommendations and actions based on data patterns and anomalies.",
    examples: ["AI-generated deal coaching", "Auto-prioritized lead routing", "Dynamic territory rebalancing"],
    infra: ["Real-time data streams", "Recommendation engine", "Action triggers / workflows"],
    org: ["Trust in automated insights", "Feedback loops", "Continuous optimization culture"],
    current: false,
  },
];

// ═══════════════════════════════════════════════════════════════
// ANOMALY DETECTION ENGINE
// Generates prescriptive alerts from metric time-series data
// using rolling mean ± 1.5σ deviation detection
// ═══════════════════════════════════════════════════════════════

function seededRand(seed) { let s = seed; return () => { s = (s * 16807 + 3) % 2147483647; return s / 2147483647; }; }

function generateMetricTimeSeries() {
  const r = seededRand(77);
  const weeks = 12;
  const specialties = ["Dermatology", "Orthopedics", "Gastroenterology", "Ophthalmology"];
  const sources = ["Inbound", "Outbound", "Referral", "Paid", "Trade Show"];
  const series = {};

  // Win Rate by specialty (weekly)
  specialties.forEach(s => {
    const base = s === "Dermatology" ? 32 : s === "Orthopedics" ? 24 : s === "Gastro" ? 26 : 22;
    series[`win_rate_${s}`] = {
      metric: "Win Rate", segment: s, unit: "%",
      values: Array.from({ length: weeks }, (_, i) => {
        let v = base + (r() - 0.5) * 8;
        // Inject anomaly: Ortho drops in last 2 weeks
        if (s === "Orthopedics" && i >= 10) v -= 12;
        // Inject trend: Derm rising
        if (s === "Dermatology") v += i * 0.4;
        return Math.round(v * 10) / 10;
      })
    };
  });

  // Pipeline by source (weekly ACV in $K)
  sources.forEach(s => {
    const base = s === "Inbound" ? 280 : s === "Referral" ? 180 : s === "Paid" ? 150 : s === "Outbound" ? 120 : 90;
    series[`pipeline_${s}`] = {
      metric: "Pipeline", segment: s, unit: "$K",
      values: Array.from({ length: weeks }, (_, i) => {
        let v = base + (r() - 0.5) * 60;
        // Inject: Paid volume spike but quality drop
        if (s === "Paid" && i >= 9) v += 70;
        return Math.round(v);
      })
    };
  });

  // Demo conversion (weekly %)
  series["demo_conversion_overall"] = {
    metric: "Demo-to-Close", segment: "All", unit: "%",
    values: Array.from({ length: weeks }, (_, i) => {
      let v = 24 + (r() - 0.5) * 6;
      // Flat despite pipeline increase (divergence alert)
      return Math.round(v * 10) / 10;
    })
  };

  // Adoption score (weekly %)
  series["adoption_sales"] = {
    metric: "Adoption", segment: "Sales", unit: "%",
    values: Array.from({ length: weeks }, (_, i) => {
      let v = 55 + i * 1.2 + (r() - 0.5) * 5;
      // Inject: sudden drop last week
      if (i === 11) v -= 15;
      return Math.round(v);
    })
  };

  // NRR by specialty (monthly → last 4 months)
  specialties.forEach(s => {
    const base = s === "Dermatology" ? 112 : s === "Orthopedics" ? 104 : 108;
    series[`nrr_${s}`] = {
      metric: "NRR", segment: s, unit: "%",
      values: Array.from({ length: 4 }, (_, i) => {
        let v = base + (r() - 0.5) * 4;
        // Referral cohort outperformance
        if (s === "Dermatology") v += i * 0.8;
        return Math.round(v * 10) / 10;
      })
    };
  });

  // Spreadsheet edits (weekly count)
  series["spreadsheet_edits"] = {
    metric: "Shadow Spreadsheets", segment: "Sales", unit: "edits",
    values: Array.from({ length: weeks }, (_, i) => {
      let v = 8 - i * 0.3 + (r() - 0.5) * 3;
      // Spike last week
      if (i === 11) v += 10;
      return Math.max(0, Math.round(v));
    })
  };

  return series;
}

function detectAnomalies(series) {
  const alerts = [];
  const now = ["2 hours ago", "4 hours ago", "6 hours ago", "1 day ago", "1 day ago", "2 days ago"];
  let timeIdx = 0;

  Object.entries(series).forEach(([key, s]) => {
    const vals = s.values;
    const n = vals.length;
    if (n < 4) return;

    // Rolling window: use all but last value for baseline
    const baseline = vals.slice(0, -1);
    const current = vals[n - 1];
    const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
    const std = Math.sqrt(baseline.reduce((a, v) => a + (v - mean) ** 2, 0) / baseline.length) || 1;
    const zScore = (current - mean) / std;
    const deviation = current - mean;
    const deviationPct = ((current - mean) / mean * 100);

    // Alert if |z| > 1.5
    if (Math.abs(zScore) < 1.5) return;

    const isNegative = zScore < 0;
    const metricName = s.metric;
    const segment = s.segment;

    // Determine if negative deviation is bad (depends on metric)
    const lowerIsBad = ["Win Rate", "NRR", "Adoption", "Demo-to-Close"].includes(metricName);
    const higherIsBad = ["Shadow Spreadsheets"].includes(metricName);
    const isBad = (lowerIsBad && isNegative) || (higherIsBad && !isNegative);
    const isGood = (lowerIsBad && !isNegative) || (higherIsBad && isNegative);

    // Build alert
    const severity = Math.abs(zScore) > 2.5 ? "critical" : isBad ? "warning" : "opportunity";

    // Template-generate insight and recommendation
    let title, insight, recommendation;

    if (metricName === "Win Rate" && isBad) {
      title = `${segment} win rate dropped ${Math.abs(deviation).toFixed(1)}pp below rolling average`;
      insight = `Current: ${current}${s.unit} vs. ${mean.toFixed(1)}${s.unit} trailing avg (z-score: ${zScore.toFixed(2)}). This ${Math.abs(zScore) > 2 ? "significant" : "notable"} deviation suggests a systemic issue beyond normal variance.`;
      recommendation = segment === "Orthopedics"
        ? `Investigate deal-level loss reasons for ${segment}. Prior analysis suggests legal review bottlenecks — check if proposals in legal review > 10 days correlate with recent losses.`
        : `Review recent ${segment} losses for pattern: competitor displacement, pricing objection, or process friction. Schedule win/loss interviews on the 3 most recent losses.`;
    } else if (metricName === "Win Rate" && isGood) {
      title = `${segment} win rate up ${deviation.toFixed(1)}pp — outperforming portfolio`;
      insight = `Current: ${current}${s.unit} vs. ${mean.toFixed(1)}${s.unit} trailing avg. ${segment} is converting at ${((current / mean - 1) * 100).toFixed(0)}% above historical baseline.`;
      recommendation = `${segment} territory may be under-resourced relative to opportunity. Model current rep allocation and evaluate if shifting coverage could capture incremental bookings.`;
    } else if (metricName === "Pipeline" && !isNegative) {
      title = `${segment} pipeline volume up ${deviationPct.toFixed(0)}% above baseline`;
      insight = `Current week: ${current}${s.unit} vs. ${mean.toFixed(0)}${s.unit} rolling avg. Volume increase of ${deviationPct.toFixed(0)}% may indicate channel momentum or quality dilution.`;
      recommendation = `Cross-reference with conversion rate for ${segment}-sourced deals. If conversion is flat or declining despite volume increase, tighten qualification criteria.`;
    } else if (metricName === "Shadow Spreadsheets" && !isNegative) {
      title = `Shadow spreadsheet activity spiked to ${current} edits (${deviationPct.toFixed(0)}% above avg)`;
      insight = `${current} edits this week vs. ${mean.toFixed(0)} weekly average. This reversal in the downward adoption trend suggests a trust or usability issue with standardized reports.`;
      recommendation = `Schedule data trust check-in with Sales team leads. Identify which specific reports are being bypassed and why. Common causes: stale data, missing fields, or reports that don't answer daily workflow questions.`;
    } else if (metricName === "Adoption" && isBad) {
      title = `${segment} reporting adoption dropped ${Math.abs(deviation).toFixed(0)}pp`;
      insight = `Adoption fell to ${current}${s.unit} from ${mean.toFixed(0)}${s.unit} trailing average. This coincides with increased shadow spreadsheet activity.`;
      recommendation = `Investigate root cause: data freshness issue, broken report, or organizational change? Run report-level engagement analysis to identify which specific dashboards lost usage.`;
    } else if (metricName === "NRR" && isGood) {
      title = `${segment} NRR trending up to ${current}${s.unit}`;
      insight = `NRR at ${current}${s.unit} vs. ${mean.toFixed(1)}${s.unit} baseline. Expansion revenue in ${segment} is outpacing contraction and churn.`;
      recommendation = `Analyze expansion drivers: is this upsell, cross-sell, or seat expansion? If repeatable, document the playbook and test it in lower-NRR segments.`;
    } else {
      title = `${metricName} ${segment}: ${isNegative ? "below" : "above"} expected range`;
      insight = `Current: ${current}${s.unit} vs. ${mean.toFixed(1)}${s.unit} avg (${deviationPct > 0 ? "+" : ""}${deviationPct.toFixed(1)}%, z=${zScore.toFixed(2)}).`;
      recommendation = `Investigate deviation cause. Check for data quality issues before actioning.`;
    }

    alerts.push({
      severity,
      title,
      insight,
      recommendation,
      metric: metricName,
      segment,
      current,
      mean: Math.round(mean * 10) / 10,
      zScore: Math.round(zScore * 100) / 100,
      timestamp: now[timeIdx % now.length],
    });
    timeIdx++;
  });

  // Sort: critical first, then warning, then opportunity
  const order = { critical: 0, warning: 1, opportunity: 2 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);

  return alerts;
}

const METRIC_SERIES = generateMetricTimeSeries();
const ALERTS = detectAnomalies(METRIC_SERIES);

// ═══════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════

function QualityBadge({ score }) {
  const color = score >= 90 ? "#10b981" : score >= 80 ? "#f59e0b" : score >= 70 ? "#f97316" : "#ef4444";
  const label = score >= 90 ? "High" : score >= 80 ? "Good" : score >= 70 ? "Fair" : "Low";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: color + "18", color }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: color }} />{score} — {label}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = status === "resolved" ? { bg: "#10b98118", color: "#10b981", label: "Resolved" } : { bg: "#f59e0b18", color: "#f59e0b", label: "Disputed" };
  return <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>;
}

function SeverityIcon({ severity }) {
  const s = { critical: { color: "#ef4444", icon: "●" }, warning: { color: "#f59e0b", icon: "▲" }, opportunity: { color: "#10b981", icon: "◆" } }[severity];
  return <span style={{ color: s.color, fontSize: 14 }}>{s.icon}</span>;
}

function MiniSparkline({ data, color, w = 100, h = 28 }) {
  const min = Math.min(...data); const max = Math.max(...data); const range = max - min || 0.01;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 6) - 3}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, height: h }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function NorthStar() {
  const [tab, setTab] = useState("registry");
  const [expandedMetric, setExpandedMetric] = useState(null);
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

  const categories = useMemo(() => ["All", ...new Set(METRIC_REGISTRY.map(m => m.category))], []);

  const filteredMetrics = useMemo(() => {
    return METRIC_REGISTRY.filter(m =>
      (filterCategory === "All" || m.category === filterCategory) &&
      (filterStatus === "All" || m.status === filterStatus)
    );
  }, [filterCategory, filterStatus]);

  const overallAdoption = ADOPTION_DATA[ADOPTION_DATA.length - 1];
  const avgAdoption = Object.values(overallAdoption).reduce((a, b) => a + b, 0) / TEAMS.length;
  const resolvedCount = METRIC_REGISTRY.filter(m => m.status === "resolved").length;
  const disputedCount = METRIC_REGISTRY.filter(m => m.status === "disputed").length;

  const TABS = [
    { key: "registry", label: "Metric Registry", icon: "◎" },
    { key: "adoption", label: "Adoption Tracker", icon: "◈" },
    { key: "maturity", label: "Maturity Model", icon: "◇" },
    { key: "prescriptive", label: "Prescriptive Alerts", icon: "◆" },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", background: "#0b1120", color: "#e2e8f0", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ padding: "28px 32px 0", maxWidth: 1140, margin: "0 auto" }}>
        <a href="/" style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12 }}
           onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"}
           onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
          ← Portfolio
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #f59e0b, #10b981)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: "#0b1120" }}>N</div>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fbbf24" }}>NorthStar</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "8px 0 4px", letterSpacing: "-0.01em" }}>GTM Analytics Governance & Maturity</h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px" }}>Metric standardization · Reporting adoption · Descriptive → Prescriptive maturity roadmap</p>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Metrics Defined", value: METRIC_REGISTRY.length, sub: `${resolvedCount} resolved, ${disputedCount} disputed`, color: "#38bdf8" },
            { label: "Avg Data Quality", value: `${Math.round(METRIC_REGISTRY.reduce((a, m) => a + m.qualityScore, 0) / METRIC_REGISTRY.length)}%`, color: "#10b981" },
            { label: "Report Adoption", value: `${Math.round(avgAdoption * 100)}%`, sub: "across GTM teams", color: "#f59e0b" },
            { label: "Shadow Spreadsheets", value: SPREADSHEET_RISKS.length, sub: `${SPREADSHEET_RISKS.filter(s => s.risk === "high").length} high risk`, color: "#ef4444" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111b2e", borderRadius: 10, padding: "14px 16px", border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: k.color, marginTop: 4 }}>{k.value}</div>
              {k.sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #1e293b", paddingBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "10px 18px", border: "none", borderBottom: tab === t.key ? "2px solid #fbbf24" : "2px solid transparent",
              background: "transparent", color: tab === t.key ? "#fbbf24" : "#64748b", fontSize: 13, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s"
            }}><span>{t.icon}</span>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 32px 48px" }}>

        {/* ═══ METRIC REGISTRY TAB ═══ */}
        {tab === "registry" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>Filter:</span>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ background: "#111b2e", color: "#e2e8f0", border: "1px solid #1e293b", borderRadius: 6, padding: "5px 10px", fontSize: 12 }}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ background: "#111b2e", color: "#e2e8f0", border: "1px solid #1e293b", borderRadius: 6, padding: "5px 10px", fontSize: 12 }}>
                <option>All</option><option>resolved</option><option>disputed</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {filteredMetrics.map((m, i) => (
                <div key={m.name}>
                  <div onClick={() => setExpandedMetric(expandedMetric === i ? null : i)} style={{
                    background: "#111b2e", borderRadius: expandedMetric === i ? "10px 10px 0 0" : 10, padding: "16px 20px",
                    border: m.status === "disputed" ? "1px solid #f59e0b30" : "1px solid #1e293b",
                    cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 140px 100px 100px 30px", alignItems: "center", gap: 12,
                    transition: "background 0.15s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "#151f35"}
                    onMouseLeave={e => e.currentTarget.style.background = "#111b2e"}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{m.category} · {m.source} · {m.refresh}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>Owner: <strong style={{ color: "#e2e8f0" }}>{m.owner}</strong></div>
                    <QualityBadge score={m.qualityScore} />
                    <StatusBadge status={m.status} />
                    <span style={{ color: "#475569", fontSize: 16, transition: "transform 0.2s", transform: expandedMetric === i ? "rotate(90deg)" : "none" }}>›</span>
                  </div>

                  {expandedMetric === i && (
                    <div style={{ background: "#0d1526", borderRadius: "0 0 10px 10px", padding: "16px 20px 20px", border: "1px solid #1e293b", borderTop: "none" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Definition</div>
                          <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>{m.definition}</p>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Calculation</div>
                          <code style={{ fontSize: 12, color: "#10b981", background: "#111b2e", padding: "8px 12px", borderRadius: 6, display: "block", fontFamily: "monospace", lineHeight: 1.5 }}>{m.formula}</code>
                        </div>
                      </div>

                      {m.conflicts.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: m.status === "disputed" ? "#f59e0b" : "#10b981", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                            {m.status === "disputed" ? "⚠ Active Definition Conflicts" : "✓ Resolved Definition Conflicts"}
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            {m.conflicts.map((c, ci) => (
                              <div key={ci} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 6, background: "#111b2e", border: `1px solid ${c.resolved ? "#1e293b" : "#f59e0b30"}` }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: c.resolved ? "#64748b" : "#f59e0b", minWidth: 80 }}>{c.team}</span>
                                <span style={{ fontSize: 12, color: "#94a3b8", flex: 1 }}>{c.altDef}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: c.resolved ? "#10b981" : "#f59e0b" }}>{c.resolved ? "✓ Resolved" : "⚠ Open"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: 12, fontSize: 11, color: "#475569" }}>
                        Last validated: {m.lastValidated} by {m.validatedBy}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ ADOPTION TRACKER TAB ═══ */}
        {tab === "adoption" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              {/* Adoption by team */}
              <div style={{ background: "#111b2e", borderRadius: 10, padding: 20, border: "1px solid #1e293b" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>Standardized Report Usage by Team</div>
                {TEAMS.map(t => {
                  const current = overallAdoption[t];
                  const trend = ADOPTION_DATA.map(w => w[t]);
                  return (
                    <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <div style={{ width: 70, fontSize: 12, fontWeight: 600, textAlign: "right", color: "#94a3b8" }}>{t}</div>
                      <div style={{ flex: 1, height: 8, background: "#1e293b", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${current * 100}%`, height: "100%", borderRadius: 4, background: current > 0.8 ? "#10b981" : current > 0.6 ? "#f59e0b" : "#ef4444", transition: "width 0.5s" }} />
                      </div>
                      <div style={{ width: 40, fontSize: 13, fontWeight: 700, textAlign: "right", color: current > 0.8 ? "#10b981" : current > 0.6 ? "#f59e0b" : "#ef4444" }}>{Math.round(current * 100)}%</div>
                      <MiniSparkline data={trend} color={current > 0.8 ? "#10b981" : "#f59e0b"} />
                    </div>
                  );
                })}
              </div>

              {/* Report engagement */}
              <div style={{ background: "#111b2e", borderRadius: 10, padding: 20, border: "1px solid #1e293b" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>Report Engagement (Last 30 Days)</div>
                {REPORTS.map(r => {
                  const views = Math.round(30 + Math.random() * 170);
                  const trend = views > 120 ? "up" : views > 60 ? "flat" : "down";
                  return (
                    <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "6px 0" }}>
                      <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{r.owner}</div>
                      <div style={{ width: 50, textAlign: "right", fontSize: 13, fontWeight: 700, color: trend === "up" ? "#10b981" : trend === "flat" ? "#f59e0b" : "#ef4444" }}>{views}</div>
                      <span style={{ fontSize: 12, color: trend === "up" ? "#10b981" : trend === "flat" ? "#f59e0b" : "#ef4444" }}>
                        {trend === "up" ? "↑" : trend === "flat" ? "→" : "↓"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Spreadsheet risk monitor */}
            <div style={{ background: "#111b2e", borderRadius: 10, padding: 20, border: "1px solid #ef444430" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Shadow Spreadsheet Risk Monitor</div>
              <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14, lineHeight: 1.5 }}>
                Tracking known ad-hoc files maintained outside the standardized reporting stack. These represent data integrity risks and adoption gaps.
              </p>
              <div style={{ display: "grid", gap: 8 }}>
                {SPREADSHEET_RISKS.map((s, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr 100px 1fr", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: "#0b1120", border: `1px solid ${s.risk === "high" ? "#ef444430" : "#f59e0b20"}` }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>{s.team}</span>
                    <span style={{ fontSize: 12, color: "#e2e8f0", fontFamily: "monospace" }}>{s.file}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.risk === "high" ? "#ef4444" : "#f59e0b" }}>
                      {s.risk === "high" ? "● HIGH" : "▲ MEDIUM"} · {s.lastEdited}
                    </span>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{s.conflict}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ MATURITY MODEL TAB ═══ */}
        {tab === "maturity" && (
          <div>
            <div style={{ display: "grid", gap: 16 }}>
              {MATURITY_LEVELS.map(level => (
                <div key={level.level} style={{
                  background: "#111b2e", borderRadius: 12, padding: 24,
                  border: `1px solid ${level.current ? level.color + "40" : "#1e293b"}`,
                  opacity: level.current ? 1 : 0.7,
                  position: "relative",
                }}>
                  {level.current && !level.partial && (
                    <div style={{ position: "absolute", top: 14, right: 16, fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: level.color + "18", color: level.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Current State
                    </div>
                  )}
                  {level.partial && (
                    <div style={{ position: "absolute", top: 14, right: 16, fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: level.color + "18", color: level.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      In Progress
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: level.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: level.color }}>
                      {level.level}
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: level.color }}>{level.name}</div>
                      <div style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>{level.label}</div>
                    </div>
                  </div>

                  <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 16 }}>{level.description}</p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    {[
                      { label: "Example Outputs", items: level.examples, color: level.color },
                      { label: "Required Infrastructure", items: level.infra, color: "#38bdf8" },
                      { label: "Organizational Prerequisites", items: level.org, color: "#f59e0b" },
                    ].map(col => (
                      <div key={col.label} style={{ background: "#0b1120", borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: col.color, marginBottom: 8 }}>{col.label}</div>
                        {col.items.map((item, j) => (
                          <div key={j} style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4, display: "flex", gap: 6 }}>
                            <span style={{ color: col.color }}>·</span>{item}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Maturity roadmap note */}
            <div style={{ marginTop: 16, padding: 16, background: "#111b2e", borderRadius: 10, border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", marginBottom: 6 }}>The Path Forward</div>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, margin: 0 }}>
                Most GTM analytics teams operate primarily at Level 1 (Descriptive) with pockets of Level 2 (Diagnostic). The roadmap to prescriptive analytics isn't just a technology challenge — it requires metric governance (so people trust the data), adoption infrastructure (so people actually use the reports), and organizational readiness (so people act on recommendations). Each maturity level builds on the one before it. Skipping straight to prescriptive without solving standardization and adoption first creates AI recommendations that nobody trusts.
              </p>
            </div>
          </div>
        )}

        {/* ═══ PRESCRIPTIVE ALERTS TAB ═══ */}
        {tab === "prescriptive" && (
          <div>
            <div style={{ marginBottom: 16, padding: 14, background: "#111b2e", borderRadius: 10, border: "1px solid #1e293b" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, margin: 0, flex: 1 }}>
                  These alerts are <strong style={{ color: "#10b981" }}>dynamically generated</strong> by an anomaly detection engine that computes rolling mean ± 1.5σ across metric time-series data. Each alert includes the z-score that triggered it, a templated root cause insight, and a prescriptive recommendation.
                </p>
                <div style={{ textAlign: "right", marginLeft: 20, flexShrink: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#fbbf24" }}>{ALERTS.length}</div>
                  <div style={{ fontSize: 10, color: "#475569" }}>active alerts</div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {ALERTS.map((a, i) => (
                <div key={i} style={{
                  background: "#111b2e", borderRadius: 12, padding: 20,
                  border: `1px solid ${a.severity === "critical" ? "#ef444430" : a.severity === "warning" ? "#f59e0b20" : "#10b98120"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <SeverityIcon severity={a.severity} />
                    <span style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{a.title}</span>
                    <span style={{ fontSize: 11, color: "#475569" }}>{a.timestamp}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "#1e293b", color: "#94a3b8" }}>{a.metric}</span>
                  </div>

                  {/* Detection metadata */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: Math.abs(a.zScore) > 2 ? "#ef444418" : "#f59e0b18", color: Math.abs(a.zScore) > 2 ? "#ef4444" : "#f59e0b" }}>
                      z = {a.zScore > 0 ? "+" : ""}{a.zScore}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: "#1e293b", color: "#64748b" }}>
                      {a.segment} · current: {a.current}{a.metric === "Pipeline" ? "K" : "%"} · avg: {a.mean}{a.metric === "Pipeline" ? "K" : "%"}
                    </span>
                    <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, background: "#6366f118", color: "#a78bfa" }}>
                      rolling window detection
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", marginBottom: 4 }}>Insight</div>
                      <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>{a.insight}</p>
                    </div>
                    <div style={{ background: "#0b1120", borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#10b981", marginBottom: 4 }}>Recommendation</div>
                      <p style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.6, margin: 0 }}>{a.recommendation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Detection methodology */}
            <div style={{ marginTop: 16, padding: 14, background: "#111b2e", borderRadius: 8, border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", marginBottom: 4 }}>Detection Methodology</div>
              <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.6, margin: 0 }}>
                Anomalies detected via rolling-window z-score analysis: for each metric × segment, the baseline is computed from all prior-period values (mean and σ). The current period value is compared against baseline — any deviation exceeding ±1.5σ triggers an alert. Severity is assigned by z-score magnitude: |z| &gt; 2.5 = critical, negative deviations on health metrics = warning, positive deviations = opportunity. Insight text and recommendations are template-generated based on the metric type, segment, and deviation direction. In production, this engine would run on a scheduled cadence against the data warehouse with alert routing to Slack channels by team.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 24, padding: 16, background: "#111b2e", borderRadius: 10, border: "1px solid #1e293b" }}>
          <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.6, margin: 0 }}>
            <strong>About NorthStar:</strong> This project demonstrates the operational infrastructure required to make a GTM analytics function effective — not just the dashboards, but the governance, adoption, and maturity frameworks underneath them. All data is synthetic. Metric definitions are modeled on common Salesforce + HubSpot GTM data architectures. Prescriptive alerts are dynamically generated by an anomaly detection engine using rolling-window z-score analysis on metric time-series data — not hardcoded.
          </p>
        </div>
      </div>
    </div>
  );
}
