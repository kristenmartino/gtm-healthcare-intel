export const METRICS = [
  {
    name: "Qualified Pipeline",
    category: "Pipeline",
    description: "Current ACV of open opportunities in Qualified, Demo, Proposal, or Negotiation. The example assumes one row per opportunity and account. Direct stage filtering avoids multiplying amounts through a repeated stage lookup.",
    sql: `-- Qualified Pipeline: Current ACV of all open opportunities at Stage 2+
-- Example owner: Rev Ops | Proposed refresh: Daily 6:00 AM ET | Source: Salesforce Opportunity

SELECT
    o.owner_name                          AS rep,
    a.specialty_segment                   AS specialty,
    o.lead_source                         AS source_channel,
    COUNT(*)                             AS deal_count,
    SUM(o.acv)                            AS pipeline_acv,
    AVG(o.acv)                            AS avg_deal_size,
    MEDIAN(o.acv)                         AS median_deal_size
FROM salesforce.opportunity o
JOIN salesforce.account a
    ON o.account_id = a.account_id
WHERE o.stage_name IN ('Qualified', 'Demo', 'Proposal', 'Negotiation')
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
    conflicts: "Example policy choice: count opportunities from Qualified onward. Keep prospecting and unconverted leads in separate views. A real implementation needs agreement on stage names, qualification criteria, and ACV.",
  },
  {
    name: "Win Rate by Segment",
    category: "Sales Efficiency",
    description: "Won opportunities divided by won plus lost opportunities, compared across the two most recent complete calendar quarters. Open opportunities are excluded. A missing prior comparison cohort returns a null change.",
    sql: `-- Win Rate by Specialty Segment and Source Channel
-- Current and previous complete calendar quarters; excludes partial quarters
-- Example owner: Rev Ops | Proposed refresh: Daily | Source: Salesforce Opportunity

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
        AND o.is_deleted = FALSE
        AND o.close_date >= DATEADD('quarter', -2, DATE_TRUNC('quarter', CURRENT_DATE))
        AND o.close_date < DATE_TRUNC('quarter', CURRENT_DATE)
        AND o.stage_name IN ('Closed Won', 'Closed Lost')
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
    conflicts: "Example policy choice: use only terminal outcomes for win rate. Won divided by all created opportunities is a different cohort conversion metric and should have its own label.",
  },
  {
    name: "Sales Cycle Velocity",
    category: "Sales Efficiency",
    description: "Days from creation to close for won opportunities, grouped by quarter, specialty, and deal size. Mean, median, and quartiles describe the distribution. These examples do not establish why a deal took longer.",
    sql: `-- Sales Cycle Velocity by Deal Size Tier
-- Uses MEDIAN to resist outlier skew from stalled enterprise deals
-- Example owner: Rev Ops | Proposed refresh: Weekly | Source: Salesforce Opportunity

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
        AND o.is_deleted = FALSE
        -- This example excludes same-day closes; review them separately
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
        ELSE 'No mean/median skew flag'
    END                                   AS skew_flag
FROM won_deals
GROUP BY 1, 2, 3
HAVING COUNT(*) >= 3  -- Illustrative display floor, not a statistical guarantee
ORDER BY deal_tier, specialty, close_quarter;`,
    edgeCases: [
      "Filters out same-day closes (cycle_days = 0) — these are usually data entry errors or backdated deals",
      "The display floor excludes cohorts with fewer than three deals; this does not make larger cohorts statistically reliable",
      "A mean more than 30% above the median triggers a skew flag, not proof of invalid records",
      "Both mean and median reported so stakeholders can see the difference and understand why median is the standard",
    ],
    conflicts: "Example policy choice: use opportunity creation as the start date. First meeting is an alternative if that timestamp is reliably recorded. This example does not measure activity-logging compliance.",
  },
  {
    name: "Marketing Attribution — Pipeline Sourced",
    category: "Marketing Attribution",
    description: "Pipeline created from each opportunity’s earliest converted lead, with lead ID breaking timestamp ties. Closed-cohort win rate is reported separately from created pipeline. Attribution assigns credit; it does not prove marketing caused the sale.",
    sql: `-- Marketing-Sourced Pipeline (First-Touch Attribution)
-- Ties pipeline generation back to the original lead source
-- Example owner: Marketing Ops | Proposed refresh: Daily | Source: Salesforce + HubSpot

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
            ORDER BY l.created_date ASC, l.lead_id ASC
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
        AND o.is_deleted = FALSE
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
        / NULLIF(COUNT(DISTINCT CASE WHEN is_closed THEN opportunity_id END), 0),
        1
    )                                      AS source_win_rate
FROM marketing_sourced
GROUP BY 1, 2, 3, 4
ORDER BY pipeline_generated DESC;`,
    edgeCases: [
      "ROW_NUMBER orders by lead timestamp and ID; this is earliest recorded touch, not necessarily the true first interaction",
      "Assumes lead_source preserves the original value; overwritten history cannot be reconstructed by this query",
      "UTM fields preserved for campaign-level drill-down beyond just channel attribution",
      "Only counts converted leads — unconverted MQLs are excluded from pipeline attribution",
    ],
    conflicts: "Example policy choice: use earliest recorded lead touch for primary source credit. Multi-touch credit requires an explicit allocation rule. Validate converted-lead coverage and source history before using either approach.",
  },
  {
    name: "Net Revenue Retention (NRR)",
    category: "Customer Success",
    description: "Current revenue from the prior quarter’s customer cohort divided by that cohort’s prior revenue. The left join retains churned accounts at zero, and new customers are excluded. Compare only completed billing periods.",
    sql: `-- Net Revenue Retention by Specialty Cohort
-- Compares same-customer revenue across periods
-- Example owner: Finance | Proposed refresh: Monthly (5th business day) | Source: Billing + Salesforce

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
        -- Keep historical accounts, including accounts that have since churned
    GROUP BY 1, 2, 3, 4
),

retention_calc AS (
    SELECT
        prev.specialty_segment,
        DATEADD('quarter', 1, prev.revenue_quarter) AS revenue_quarter,
        -- Start with the prior cohort, retaining churned accounts at zero
        -- Current period revenue from accounts that existed in prior period
        SUM(COALESCE(curr.quarterly_revenue, 0)) AS current_period_revenue,
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
        -- Only compare periods whose billing is complete
        AND DATEADD('quarter', 1, prev.revenue_quarter) < DATE_TRUNC('quarter', CURRENT_DATE)
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
      "Uses recognized revenue from paid invoices as an example basis; reconcile invoice timing, credits, and recognition policy before use",
      "Churn is defined as revenue going to zero, not account deletion — some accounts go dormant without formally canceling",
      "Contraction is separated from churn because the interventions are different: contraction = save conversation, churn = win-back campaign",
      "Component breakdown (expansion, contraction, churn rates) is essential — a 105% NRR could mean 15% expansion and 10% churn, which is very different from 5% expansion and 0% churn",
    ],
    conflicts: "Example policy choice: include all revenue losses in NRR. Separate payment-related and voluntary churn only when reliable reason codes exist. This query does not provide a voluntary-churn variant.",
  },
];
