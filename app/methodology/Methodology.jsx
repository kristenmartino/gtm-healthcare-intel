"use client";
import { useState } from "react";

const METRICS = [
  {
    name: "Qualified Pipeline",
    category: "Pipeline",
    description: "Total ACV of open opportunities at Stage 2+ (Qualified or later). This is the single most contested metric in GTM analytics — Sales, Marketing, and Finance almost always define it differently. The SQL below implements the Rev Ops standard: stage-gated, excludes closed deals, and uses the current ACV field (not the original estimate).",
    sql: `-- Qualified Pipeline: Current ACV of all open opportunities at Stage 2+
-- Owner: Rev Ops | Refresh: Daily 6:00 AM ET | Source: Salesforce Opportunity

WITH stage_map AS (
    SELECT stage_name,
           CASE stage_name
               WHEN 'Prospecting'  THEN 1
               WHEN 'Qualified'    THEN 2
               WHEN 'Demo'         THEN 3
               WHEN 'Proposal'     THEN 4
               WHEN 'Negotiation'  THEN 5
               WHEN 'Closed Won'   THEN 6
               WHEN 'Closed Lost'  THEN 7
           END AS stage_order
    FROM salesforce.opportunity
)

SELECT
    o.owner_name                          AS rep,
    a.specialty_segment                   AS specialty,
    o.lead_source                         AS source_channel,
    COUNT(DISTINCT o.opportunity_id)      AS deal_count,
    SUM(o.acv)                            AS pipeline_acv,
    AVG(o.acv)                            AS avg_deal_size,
    MEDIAN(o.acv)                         AS median_deal_size
FROM salesforce.opportunity o
JOIN salesforce.account a
    ON o.account_id = a.account_id
JOIN stage_map sm
    ON o.stage_name = sm.stage_name
WHERE sm.stage_order BETWEEN 2 AND 5     -- Qualified through Negotiation
    AND o.is_closed = FALSE               -- Exclude won and lost
    AND o.acv >= 5000                     -- Floor: exclude sub-$5K trials
    AND o.is_deleted = FALSE
GROUP BY 1, 2, 3
ORDER BY pipeline_acv DESC;`,
    edgeCases: [
      "Excludes Prospecting (Stage 1) — these haven't been validated by Sales yet",
      "Excludes deals < $5K to filter out free trials and POCs that inflate pipeline count",
      "Uses current ACV, not original — captures upsells and downsells during negotiation",
      "The is_deleted check catches Salesforce soft-deletes that can silently inflate totals",
    ],
    conflicts: "Sales wants to include Stage 1 (Prospecting) to show larger pipeline. Marketing wants to include MQLs that haven't converted to Opportunity yet. Finance wants Stage 3+ only (post-demo). The resolved standard uses Stage 2+ as the compromise — validated by Sales but not yet requiring a completed demo.",
  },
  {
    name: "Win Rate by Segment",
    category: "Sales Efficiency",
    description: "Win rate is deceptively simple until you define the denominator. Do stalled deals count as losses? What about deals that age out? This implementation uses a clean closed-set denominator: Won / (Won + Lost) within the period, excluding deals still open.",
    sql: `-- Win Rate by Specialty Segment and Source Channel
-- Includes 90-day trailing window and prior period comparison
-- Owner: Rev Ops | Refresh: Daily | Source: Salesforce Opportunity

WITH closed_deals AS (
    SELECT
        o.opportunity_id,
        o.owner_name                       AS rep,
        a.specialty_segment                AS specialty,
        o.lead_source                      AS source_channel,
        o.close_date,
        o.acv,
        o.is_won,
        DATE_TRUNC('quarter', o.close_date) AS close_quarter
    FROM salesforce.opportunity o
    JOIN salesforce.account a
        ON o.account_id = a.account_id
    WHERE o.is_closed = TRUE
        AND o.acv >= 5000
        AND o.close_date >= DATEADD('month', -6, CURRENT_DATE)
),

win_rates AS (
    SELECT
        specialty,
        source_channel,
        close_quarter,
        COUNT(DISTINCT opportunity_id)                        AS total_closed,
        COUNT(DISTINCT CASE WHEN is_won THEN opportunity_id END) AS wins,
        COUNT(DISTINCT CASE WHEN NOT is_won THEN opportunity_id END) AS losses,
        ROUND(
            COUNT(DISTINCT CASE WHEN is_won THEN opportunity_id END) * 100.0
            / NULLIF(COUNT(DISTINCT opportunity_id), 0),
            1
        )                                                     AS win_rate_pct,
        SUM(CASE WHEN is_won THEN acv ELSE 0 END)           AS won_acv
    FROM closed_deals
    GROUP BY 1, 2, 3
)

SELECT
    specialty,
    source_channel,
    close_quarter,
    total_closed,
    wins,
    losses,
    win_rate_pct,
    won_acv,
    -- Quarter-over-quarter change
    win_rate_pct - LAG(win_rate_pct) OVER (
        PARTITION BY specialty, source_channel
        ORDER BY close_quarter
    ) AS win_rate_change_pp
FROM win_rates
ORDER BY specialty, source_channel, close_quarter;`,
    edgeCases: [
      "Denominator is Won + Lost only — open deals are excluded to avoid deflating the rate",
      "Same $5K floor as Pipeline to maintain metric consistency across the stack",
      "LAG window function computes quarter-over-quarter change in percentage points",
      "NULLIF guards against division by zero when a segment has no closed deals in a period",
    ],
    conflicts: "Sales leadership sometimes wants to include open deals in the denominator ('we haven't lost them yet'). This inflates win rates early in quarter and deflates them at quarter-end. The resolved standard counts only terminal outcomes.",
  },
  {
    name: "Sales Cycle Velocity",
    category: "Sales Efficiency",
    description: "Median days from opportunity creation to close, segmented by deal size tier. Median is used instead of mean because a single 300-day enterprise deal can skew the average by 20+ days. The tier segmentation reveals whether large deals are dragging down the blended number.",
    sql: `-- Sales Cycle Velocity by Deal Size Tier
-- Uses MEDIAN to resist outlier skew from stalled enterprise deals
-- Owner: Rev Ops | Refresh: Weekly | Source: Salesforce Opportunity

WITH won_deals AS (
    SELECT
        o.opportunity_id,
        o.owner_name                        AS rep,
        a.specialty_segment                 AS specialty,
        o.acv,
        CASE
            WHEN o.acv < 25000  THEN 'SMB (<$25K)'
            WHEN o.acv < 75000  THEN 'Mid-Market ($25K-$75K)'
            WHEN o.acv < 150000 THEN 'Enterprise ($75K-$150K)'
            ELSE 'Strategic ($150K+)'
        END                                 AS deal_tier,
        DATEDIFF('day', o.created_date, o.close_date) AS cycle_days,
        o.close_date,
        DATE_TRUNC('quarter', o.close_date) AS close_quarter
    FROM salesforce.opportunity o
    JOIN salesforce.account a
        ON o.account_id = a.account_id
    WHERE o.is_won = TRUE
        AND o.acv >= 5000
        AND o.close_date >= DATEADD('year', -1, CURRENT_DATE)
        -- Exclude same-day closes (data quality issue)
        AND DATEDIFF('day', o.created_date, o.close_date) > 0
)

SELECT
    deal_tier,
    specialty,
    close_quarter,
    COUNT(*)                              AS deal_count,
    MEDIAN(cycle_days)                    AS median_cycle_days,
    AVG(cycle_days)                       AS mean_cycle_days,
    PERCENTILE_CONT(0.25) WITHIN GROUP
        (ORDER BY cycle_days)             AS p25_days,
    PERCENTILE_CONT(0.75) WITHIN GROUP
        (ORDER BY cycle_days)             AS p75_days,
    -- Flag: is mean significantly higher than median? (outlier indicator)
    CASE
        WHEN AVG(cycle_days) > MEDIAN(cycle_days) * 1.3
        THEN '⚠ Outlier skew detected'
        ELSE '✓ Distribution normal'
    END                                   AS skew_flag
FROM won_deals
GROUP BY 1, 2, 3
HAVING COUNT(*) >= 3  -- Minimum sample size for meaningful median
ORDER BY deal_tier, specialty, close_quarter;`,
    edgeCases: [
      "Filters out same-day closes (cycle_days = 0) — these are usually data entry errors or backdated deals",
      "HAVING COUNT >= 3 prevents reporting median on 1-2 deals which would be misleading",
      "Skew flag alerts when mean exceeds median by 30%+ indicating outlier contamination",
      "Both mean and median reported so stakeholders can see the difference and understand why median is the standard",
    ],
    conflicts: "Sales wants cycle measured from first meeting, not opportunity creation. The gap between those dates averages 8-12 days, which isn't trivial. Current standard uses Opportunity.CreatedDate because it's system-generated and auditable. First-meeting date relies on rep activity logging which has ~60% compliance.",
  },
  {
    name: "Marketing Attribution — Pipeline Sourced",
    category: "Marketing Attribution",
    description: "The most politically sensitive metric in any GTM org. First-touch attribution is the standard here because it's deterministic and auditable — but Marketing will push for multi-touch, and they're not wrong. This query implements first-touch with a clean audit trail.",
    sql: `-- Marketing-Sourced Pipeline (First-Touch Attribution)
-- Ties pipeline generation back to the original lead source
-- Owner: Marketing Ops | Refresh: Daily | Source: Salesforce + HubSpot

WITH first_touch AS (
    -- Get the original lead source before any overwriting
    SELECT
        l.converted_opportunity_id         AS opportunity_id,
        l.lead_source                      AS original_source,
        l.created_date                     AS lead_created_date,
        l.utm_campaign__c                  AS first_campaign,
        l.utm_medium__c                    AS first_medium,
        ROW_NUMBER() OVER (
            PARTITION BY l.converted_opportunity_id
            ORDER BY l.created_date ASC
        )                                  AS touch_rank
    FROM salesforce.lead l
    WHERE l.is_converted = TRUE
        AND l.converted_opportunity_id IS NOT NULL
),

marketing_sourced AS (
    SELECT
        ft.opportunity_id,
        ft.original_source,
        ft.first_campaign,
        ft.first_medium,
        o.acv,
        o.stage_name,
        o.is_won,
        o.is_closed,
        a.specialty_segment,
        o.created_date                     AS opp_created_date,
        DATE_TRUNC('quarter', o.created_date) AS opp_quarter
    FROM first_touch ft
    JOIN salesforce.opportunity o
        ON ft.opportunity_id = o.opportunity_id
    JOIN salesforce.account a
        ON o.account_id = a.account_id
    WHERE ft.touch_rank = 1                -- First touch only
        AND ft.original_source IN (
            'Inbound', 'Content', 'Event',
            'Webinar', 'Paid Search', 'Paid Social'
        )
        AND o.acv >= 5000
)

SELECT
    original_source,
    first_medium,
    specialty_segment,
    opp_quarter,
    -- Pipeline metrics
    COUNT(DISTINCT opportunity_id)         AS opps_created,
    SUM(acv)                               AS pipeline_generated,
    -- Conversion metrics
    COUNT(DISTINCT CASE WHEN is_won
        THEN opportunity_id END)           AS opps_won,
    SUM(CASE WHEN is_won
        THEN acv ELSE 0 END)              AS revenue_generated,
    -- Efficiency
    ROUND(
        COUNT(DISTINCT CASE WHEN is_won THEN opportunity_id END) * 100.0
        / NULLIF(COUNT(DISTINCT opportunity_id), 0),
        1
    )                                      AS source_win_rate
FROM marketing_sourced
GROUP BY 1, 2, 3, 4
ORDER BY pipeline_generated DESC;`,
    edgeCases: [
      "ROW_NUMBER with ORDER BY created_date ensures true first-touch, not last-touch overwrite",
      "Lead source is locked to the original value — Salesforce allows overwriting on conversion which corrupts attribution",
      "UTM fields preserved for campaign-level drill-down beyond just channel attribution",
      "Only counts converted leads — unconverted MQLs are excluded from pipeline attribution",
    ],
    conflicts: "Marketing advocates for multi-touch attribution (any-touch inflates pipeline credit by ~40%). Sales says only SDR-confirmed marketing influence should count. Finance wants a consistent model applied to both marketing and sales-sourced pipeline. Current compromise: first-touch for primary reporting, multi-touch available as supplementary view.",
  },
  {
    name: "Net Revenue Retention (NRR)",
    category: "Customer Success",
    description: "NRR tells you whether your existing customers are growing or shrinking as a revenue base. It's the single best predictor of long-term SaaS health. An NRR above 110% means your installed base is growing even without new logos — an NRR below 100% means you're leaking faster than you're expanding.",
    sql: `-- Net Revenue Retention by Specialty Cohort
-- Compares same-customer revenue across periods
-- Owner: Finance | Refresh: Monthly (5th business day) | Source: Billing + Salesforce

WITH cohort_revenue AS (
    SELECT
        a.account_id,
        a.specialty_segment,
        a.cohort_quarter,                  -- Quarter of initial close
        DATE_TRUNC('quarter', b.invoice_date)  AS revenue_quarter,
        SUM(b.recognized_revenue)          AS quarterly_revenue
    FROM salesforce.account a
    JOIN billing.invoice b
        ON a.account_id = b.account_id
    WHERE b.invoice_status = 'Paid'
        AND a.account_type = 'Customer'
    GROUP BY 1, 2, 3, 4
),

retention_calc AS (
    SELECT
        specialty_segment,
        revenue_quarter,
        -- Current period revenue from accounts that existed in prior period
        SUM(CASE
            WHEN prev.quarterly_revenue IS NOT NULL
            THEN curr.quarterly_revenue
            ELSE 0
        END)                               AS current_period_revenue,
        -- Prior period revenue from the same accounts
        SUM(prev.quarterly_revenue)        AS prior_period_revenue,
        -- Expansion (accounts that grew)
        SUM(CASE
            WHEN curr.quarterly_revenue > prev.quarterly_revenue
            THEN curr.quarterly_revenue - prev.quarterly_revenue
            ELSE 0
        END)                               AS expansion_revenue,
        -- Contraction (accounts that shrank but didn't churn)
        SUM(CASE
            WHEN curr.quarterly_revenue < prev.quarterly_revenue
                AND curr.quarterly_revenue > 0
            THEN prev.quarterly_revenue - curr.quarterly_revenue
            ELSE 0
        END)                               AS contraction_revenue,
        -- Churn (accounts that went to $0)
        SUM(CASE
            WHEN curr.quarterly_revenue IS NULL
                OR curr.quarterly_revenue = 0
            THEN prev.quarterly_revenue
            ELSE 0
        END)                               AS churned_revenue
    FROM cohort_revenue prev
    LEFT JOIN cohort_revenue curr
        ON prev.account_id = curr.account_id
        AND curr.revenue_quarter = DATEADD('quarter', 1, prev.revenue_quarter)
    WHERE prev.quarterly_revenue > 0
    GROUP BY 1, 2
)

SELECT
    specialty_segment,
    revenue_quarter,
    prior_period_revenue,
    current_period_revenue,
    expansion_revenue,
    contraction_revenue,
    churned_revenue,
    ROUND(
        (current_period_revenue * 100.0)
        / NULLIF(prior_period_revenue, 0),
        1
    )                                      AS nrr_pct,
    -- Component breakdown
    ROUND(expansion_revenue * 100.0
        / NULLIF(prior_period_revenue, 0), 1) AS expansion_rate,
    ROUND(contraction_revenue * 100.0
        / NULLIF(prior_period_revenue, 0), 1) AS contraction_rate,
    ROUND(churned_revenue * 100.0
        / NULLIF(prior_period_revenue, 0), 1) AS churn_rate
FROM retention_calc
WHERE prior_period_revenue > 0
ORDER BY specialty_segment, revenue_quarter;`,
    edgeCases: [
      "Uses recognized revenue from billing system, not Salesforce ACV — ACV represents the contract, billing represents reality",
      "Churn is defined as revenue going to zero, not account deletion — some accounts go dormant without formally canceling",
      "Contraction is separated from churn because the interventions are different: contraction = save conversation, churn = win-back campaign",
      "Component breakdown (expansion, contraction, churn rates) is essential — a 105% NRR could mean 15% expansion and 10% churn, which is very different from 5% expansion and 0% churn",
    ],
    conflicts: "CS wants to exclude involuntary churn (payment failures) since it's not a product satisfaction issue. Finance includes all churn regardless of cause because revenue is revenue. Resolved: report both 'all-in NRR' and 'voluntary NRR' side by side.",
  },
];

function SqlBlock({ sql }) {
  return (
    <pre style={{
      background: "#0d1117", borderRadius: 8, padding: "16px 20px", fontSize: 12.5,
      lineHeight: 1.65, overflowX: "auto", fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
      color: "#c9d1d9", border: "1px solid #21262d", margin: 0,
    }}>
      {sql.split("\n").map((line, i) => {
        const trimmed = line.trimStart();
        const isComment = trimmed.startsWith("--");
        const indent = line.length - trimmed.length;
        // Simple keyword highlighting
        let formatted = trimmed;
        if (!isComment) {
          formatted = trimmed
            .replace(/\b(SELECT|FROM|JOIN|LEFT JOIN|WHERE|AND|OR|GROUP BY|ORDER BY|HAVING|WITH|AS|ON|CASE|WHEN|THEN|ELSE|END|IN|NOT|NULL|IS|BETWEEN|OVER|PARTITION BY|NULLIF|DISTINCT|TRUE|FALSE|DESC|ASC|SUM|COUNT|AVG|ROUND|MEDIAN|PERCENTILE_CONT|WITHIN GROUP|LAG|ROW_NUMBER|DATEADD|DATEDIFF|DATE_TRUNC|CURRENT_DATE)\b/g,
              match => `<kw>${match}</kw>`);
        }
        return (
          <div key={i} style={{
            color: isComment ? "#8b949e" : "#c9d1d9",
            fontStyle: isComment ? "italic" : "normal",
            paddingLeft: indent * 7.5,
            minHeight: trimmed === "" ? 12 : "auto",
          }}
            dangerouslySetInnerHTML={{
              __html: formatted.replace(/<kw>(.*?)<\/kw>/g,
                '<span style="color:#ff7b72;font-weight:600">$1</span>')
            }}
          />
        );
      })}
    </pre>
  );
}

export default function Methodology() {
  const [expanded, setExpanded] = useState(0);

  return (
    <div style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", background: "#0b1120", color: "#e2e8f0", minHeight: "100vh" }}>
      <div style={{ padding: "28px 32px 0", maxWidth: 1000, margin: "0 auto" }}>
        <a href="/" style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12 }}
           onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"}
           onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
          ← Portfolio
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #38bdf8, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#fff" }}>{`</>`}</div>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#38bdf8" }}>SQL Methodology</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "8px 0 4px" }}>GTM Metric Calculations</h1>
        <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 8px", lineHeight: 1.6, maxWidth: 720 }}>
          The SQL behind every metric in the NorthStar governance framework. Each query includes the calculation logic, edge case handling, and documentation of how cross-team definition conflicts were resolved.
        </p>
        <p style={{ fontSize: 12, color: "#475569", margin: "0 0 24px" }}>
          Written for Snowflake SQL dialect · Assumes Salesforce + billing system as source · All queries are dbt-model-ready
        </p>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 32px 48px" }}>
        {METRICS.map((m, i) => (
          <div key={m.name} style={{ marginBottom: 12 }}>
            <div
              onClick={() => setExpanded(expanded === i ? null : i)}
              style={{
                background: "#111b2e", borderRadius: expanded === i ? "10px 10px 0 0" : 10,
                padding: "16px 20px", border: "1px solid #1e293b", cursor: "pointer",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#151f35"}
              onMouseLeave={e => e.currentTarget.style.background = "#111b2e"}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>{m.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "#1e293b", color: "#64748b" }}>{m.category}</span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, maxWidth: 700 }}>{m.description.slice(0, 120)}...</div>
              </div>
              <span style={{ color: "#475569", fontSize: 18, transition: "transform 0.2s", transform: expanded === i ? "rotate(90deg)" : "none" }}>›</span>
            </div>

            {expanded === i && (
              <div style={{ background: "#0d1526", borderRadius: "0 0 10px 10px", padding: "20px 24px 24px", border: "1px solid #1e293b", borderTop: "none" }}>
                <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, marginBottom: 16 }}>{m.description}</p>

                <SqlBlock sql={m.sql} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                  <div style={{ background: "#111b2e", borderRadius: 8, padding: 14, border: "1px solid #1e293b" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#f59e0b", marginBottom: 8 }}>Edge Cases & Guards</div>
                    {m.edgeCases.map((e, j) => (
                      <div key={j} style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, marginBottom: 6, display: "flex", gap: 6 }}>
                        <span style={{ color: "#f59e0b", flexShrink: 0 }}>·</span>{e}
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "#111b2e", borderRadius: 8, padding: 14, border: "1px solid #ef444420" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#ef4444", marginBottom: 8 }}>Definition Conflicts & Resolution</div>
                    <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>{m.conflicts}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        <div style={{ marginTop: 24, padding: 16, background: "#111b2e", borderRadius: 10, border: "1px solid #1e293b" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8", marginBottom: 6 }}>Implementation Notes</div>
          <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.7, margin: 0 }}>
            These queries are written for Snowflake SQL and designed to be implemented as dbt models with schema tests (not_null, unique, accepted_values) and freshness checks. In production, each metric would be a dbt model in a <code style={{ color: "#10b981", background: "#111b2e", padding: "1px 4px", borderRadius: 3 }}>marts/gtm_analytics/</code> directory with a corresponding YAML schema file documenting the column definitions, tests, and metadata. The conflict resolution notes map directly to the NorthStar Metric Registry — each resolved conflict becomes a documented decision in the governance layer.
          </p>
        </div>
      </div>
    </div>
  );
}
