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
// PRESCRIPTIVE ALERTS DATA
// ═══════════════════════════════════════════════════════════════
const ALERTS = [
  {
    severity: "critical",
    title: "Orthopedics win rate dropped 12pp this month",
    insight: "3 of 5 lost deals had proposals sitting in legal review for 20+ days. Median legal review for Won deals is 6 days.",
    recommendation: "Implement escalation protocol for proposals in legal review > 10 days. Estimated recovery: $180K pipeline.",
    metric: "Win Rate",
    timestamp: "2 hours ago",
  },
  {
    severity: "warning",
    title: "Marketing-sourced pipeline up 28% but demo conversion flat",
    insight: "Lead volume increased from paid channels, but demo-to-opportunity conversion stayed at 18% (vs. 26% for inbound organic). Paid leads showing lower ICP fit scores.",
    recommendation: "Review paid campaign targeting criteria and tighten ICP scoring threshold. Consider SDR pre-qualification call before demo scheduling for paid leads.",
    metric: "Demo-to-Close Conversion",
    timestamp: "6 hours ago",
  },
  {
    severity: "opportunity",
    title: "Dermatology segment over-performing — 34% win rate vs. 22% average",
    insight: "Derm practices close 40% faster and have 15% higher ACV than portfolio average. Current territory allocation only assigns 2 of 12 reps to Derm.",
    recommendation: "Reallocate 1-2 reps from General to Derm territory. Model suggests +$420K quarterly bookings at current conversion rates.",
    metric: "Pipeline (Qualified)",
    timestamp: "1 day ago",
  },
  {
    severity: "warning",
    title: "Sales team spreadsheet usage spiked this week",
    insight: "4 of 6 tracked shadow spreadsheets were edited in the last 48 hours. Sales East pipeline tracker now diverges from Salesforce by $340K.",
    recommendation: "Schedule 15-min data trust check-in with Sales East manager. Investigate whether CRM data freshness or field usability is driving offline tracking.",
    metric: "Adoption Score",
    timestamp: "4 hours ago",
  },
  {
    severity: "opportunity",
    title: "Referral channel producing 2.1x higher LTV than average",
    insight: "Referral-sourced customers have 94% 12-month retention vs. 81% overall. NRR for referral cohort is 118% vs. 104% blended.",
    recommendation: "Invest in structured referral program. Even 20% increase in referral volume projects to +$290K incremental ARR with lower CAC.",
    metric: "Net Revenue Retention (NRR)",
    timestamp: "1 day ago",
  },
];

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
              <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, margin: 0 }}>
                These alerts demonstrate what prescriptive analytics looks like in practice. Each combines a metric anomaly, root cause analysis, and an actionable recommendation with estimated impact. In production, these would be generated automatically from real-time GTM data.
              </p>
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
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 24, padding: 16, background: "#111b2e", borderRadius: 10, border: "1px solid #1e293b" }}>
          <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.6, margin: 0 }}>
            <strong>About NorthStar:</strong> This project demonstrates the operational infrastructure required to make a GTM analytics function effective — not just the dashboards, but the governance, adoption, and maturity frameworks underneath them. All data is synthetic. Metric definitions are modeled on common Salesforce + HubSpot GTM data architectures. The prescriptive alerts represent the kind of AI-driven recommendations that become possible once metric standardization and data trust are established.
          </p>
        </div>
      </div>
    </div>
  );
}
