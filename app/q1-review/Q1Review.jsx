"use client";

export default function Q1Review() {
  return (
    <div style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", background: "#fafbfc", color: "#1a1a2e", minHeight: "100vh" }}>
      {/* Document container */}
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "48px 32px", background: "#fff", minHeight: "100vh", boxShadow: "0 0 40px rgba(0,0,0,0.06)" }}>

        {/* Header */}
        <div style={{ borderBottom: "3px solid #1a1a2e", paddingBottom: 16, marginBottom: 32 }}>
          <a href="/" style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12 }}
             onMouseEnter={e => e.currentTarget.style.color = "#64748b"}
             onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}>
            ← Portfolio
          </a>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: 8 }}>GTM Analytics · Quarterly Business Review</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.01em", lineHeight: 1.2 }}>Q1 2025 GTM Performance Review</h1>
          <div style={{ fontSize: 13, color: "#64748b" }}>Prepared by Kristen Martino, GTM Analytics · April 7, 2025 · Confidential</div>
        </div>

        {/* Executive Summary */}
        <Section title="Executive Summary">
          <P>Q1 closed at $2.14M in new bookings against a $2.40M target (89% attainment). While topline bookings fell short, the underlying signals are more nuanced than the headline suggests. Win rate improved 3pp quarter-over-quarter to 24.1%, and average deal size increased 11% to $68K — both indicators that deal quality is strengthening even as volume is soft. The miss was driven primarily by three factors: a 12pp drop in Orthopedics win rate tied to legal review bottlenecks, lower-than-expected marketing-sourced pipeline conversion, and two enterprise deals ($185K combined) that slipped to Q2 due to budget approval delays.</P>
          <P>The recommendations in this review focus on the highest-leverage interventions: implementing a legal escalation protocol for proposals aging beyond 10 days, tightening ICP scoring on paid marketing leads, and reallocating territory coverage toward Dermatology where win rates and ACV significantly outperform the portfolio average.</P>
        </Section>

        {/* Pipeline Summary */}
        <Section title="1. Pipeline & Bookings Summary">
          <DataTable
            headers={["Metric", "Q4 2024", "Q1 2025", "QoQ Change"]}
            rows={[
              ["Total Bookings", "$1.98M", "$2.14M", "+8.1%"],
              ["Target", "$2.20M", "$2.40M", ""],
              ["Attainment", "90%", "89%", "-1pp"],
              ["Deals Closed Won", "34", "31", "-8.8%"],
              ["Avg Deal Size (ACV)", "$58.2K", "$68.1K", "+17.0%"],
              ["Win Rate (Qual → Won)", "21.3%", "24.1%", "+3pp"],
              ["Avg Sales Cycle (days)", "52", "48", "-7.7%"],
              ["Qualified Pipeline (EoQ)", "$6.8M", "$7.2M", "+5.9%"],
              ["Pipeline Coverage Ratio", "2.8x", "3.0x", "+0.2x"],
            ]}
          />
          <P><strong>Key takeaway:</strong> The bookings miss obscures improving fundamentals. Deal quality metrics (ACV, win rate, cycle time) are all trending positively. The volume gap is a sourcing issue, not an execution issue — we're converting pipeline at a higher rate but don't have enough of it at the top of the funnel.</P>
        </Section>

        {/* Segment Performance */}
        <Section title="2. Performance by Specialty Segment">
          <DataTable
            headers={["Specialty", "Deals Won", "Won ACV", "Win Rate", "Avg Cycle", "vs. Q4"]}
            rows={[
              ["Dermatology", "12", "$892K", "34.2%", "38d", "▲ +6pp"],
              ["Gastroenterology", "8", "$498K", "26.1%", "44d", "▲ +2pp"],
              ["Ophthalmology", "7", "$421K", "22.8%", "51d", "→ flat"],
              ["Orthopedics", "4", "$329K", "14.3%", "62d", "▼ -12pp"],
            ]}
          />
          <P><strong>Dermatology is the standout.</strong> At a 34.2% win rate with a 38-day average cycle, Derm practices are closing faster and at higher rates than any other segment. They also represent the highest ACV concentration ($892K on just 12 deals, averaging $74K per deal). Currently, only 2 of our 6 reps have significant Derm territory coverage — this represents a clear reallocation opportunity.</P>
          <P><strong>Orthopedics requires immediate attention.</strong> Win rate dropped from 26.3% in Q4 to 14.3% in Q1. Root cause analysis shows this is not a product-market fit issue — it's a process bottleneck. Three of five lost Ortho deals had proposals stuck in legal review for 20+ days (median for Won deals is 6 days). When we exclude the legal-delayed losses, the adjusted Ortho win rate is 22.1% — in line with historical performance.</P>
          <CalloutBox color="#dc2626" title="Action Required">
            Implement escalation protocol for proposals in legal review &gt;10 days. Based on Q1 data, this intervention alone could recover an estimated $180K in quarterly pipeline that is being lost to process friction, not competitive loss.
          </CalloutBox>
        </Section>

        {/* Source Analysis */}
        <Section title="3. Pipeline Source & Marketing Attribution">
          <DataTable
            headers={["Source", "Leads", "Opps Created", "Pipeline $", "Won $", "Source Win Rate"]}
            rows={[
              ["Referral", "42", "28", "$1.9M", "$680K", "35.7%"],
              ["Inbound Organic", "156", "34", "$2.1M", "$520K", "22.4%"],
              ["Trade Show (HIMSS, AAD)", "68", "18", "$1.4M", "$410K", "27.8%"],
              ["Outbound SDR", "234", "22", "$1.2M", "$340K", "18.2%"],
              ["Paid (Search + Social)", "312", "14", "$0.6M", "$190K", "14.3%"],
            ]}
          />
          <P><strong>Referrals continue to outperform every other channel</strong> with a 35.7% win rate and the highest ACV per deal. This is not surprising — referred prospects arrive with pre-existing trust and shorter evaluation cycles. What is notable is that we have no structured referral program in place. Even a modest program that increases referral volume by 20% would project to an additional $136K in quarterly bookings at current conversion rates.</P>
          <P><strong>Paid channels are underperforming on conversion.</strong> Paid search and social generated the highest lead volume (312 leads) but the lowest win rate (14.3%) and smallest pipeline contribution ($600K). The issue is upstream: paid leads are converting to opportunity at 4.5% vs. 21.8% for inbound organic. ICP fit scoring on paid leads shows 62% of paid leads fall below our ideal customer profile threshold, compared to 28% for organic. We're generating volume, not quality.</P>
          <CalloutBox color="#d97706" title="Recommendation">
            Tighten paid campaign targeting criteria to match ICP scoring thresholds used for organic leads. Consider adding an SDR pre-qualification call before demo scheduling for all paid-sourced leads. Expected impact: 20-30% reduction in paid lead volume but 2x improvement in conversion rate, net positive on pipeline quality.
          </CalloutBox>
        </Section>

        {/* Rep Performance */}
        <Section title="4. Rep Performance & Productivity">
          <DataTable
            headers={["Rep", "Quota", "Attainment", "Deals Won", "Avg ACV", "Avg Cycle", "Pipeline"]}
            rows={[
              ["Chen", "$450K", "112%", "8", "$63K", "41d", "$1.4M"],
              ["Rivera", "$450K", "84%", "6", "$63K", "52d", "$980K"],
              ["Okafor", "$400K", "95%", "6", "$63K", "44d", "$1.1M"],
              ["Patel", "$350K", "78%", "4", "$68K", "58d", "$720K"],
              ["Wong", "$400K", "89%", "5", "$71K", "46d", "$1.0M"],
              ["Kim", "$350K", "81%", "2", "$142K", "$68d", "$1.2M"],
            ]}
          />
          <P><strong>Chen</strong> is the top performer at 112% attainment, driven by volume (8 deals) and the shortest average cycle (41 days). Her approach of front-loading demos early in the evaluation process is working — she averages 2.3 demos per closed deal vs. 3.1 for the team.</P>
          <P><strong>Kim</strong> presents an interesting case: lowest deal count (2) but highest ACV ($142K) and the most open pipeline ($1.2M). He's working larger enterprise deals with longer cycles. His 81% attainment is misleading — one of his two slipped Q2 deals ($110K) would have put him at 112%. His pipeline suggests a strong Q2.</P>
          <P><strong>Patel</strong> is below target at 78% with the longest average cycle (58 days). Diagnostic: 60% of his pipeline is Orthopedics, which is the segment hit hardest by the legal bottleneck. Adjusting for legal-delayed losses, his projected attainment would be ~92%. The issue is segment concentration, not rep performance.</P>
        </Section>

        {/* Churn */}
        <Section title="5. Retention & Net Revenue Retention">
          <DataTable
            headers={["Specialty", "Customers (Start)", "Churned", "Expanded", "Churn Rate", "NRR"]}
            rows={[
              ["Dermatology", "248", "8", "32", "3.2%", "112.4%"],
              ["Orthopedics", "186", "14", "18", "7.5%", "103.8%"],
              ["Gastroenterology", "142", "6", "22", "4.2%", "110.1%"],
              ["Ophthalmology", "210", "11", "28", "5.2%", "108.6%"],
            ]}
          />
          <P><strong>Blended NRR is 108.7%</strong> — our installed base is growing. However, the spread between specialties is significant. Dermatology NRR at 112.4% with only 3.2% churn is exceptional and reinforces the segment's attractiveness. Orthopedics churn at 7.5% is the outlier and warrants investigation. Exit survey data indicates "switched to competitor" as the primary reason (64% of churned Ortho accounts), suggesting product-competitive gaps in the orthopedic workflow specifically.</P>
          <CalloutBox color="#6366f1" title="Strategic Note">
            Dermatology is now the clear priority segment across every metric: highest win rate, highest NRR, lowest churn, fastest cycle, and strongest ACV. The Q2 GTM plan should reflect this by reallocating territory coverage, directing marketing spend, and prioritizing product roadmap investment toward Derm practices.
          </CalloutBox>
        </Section>

        {/* Recommendations */}
        <Section title="6. Q2 Recommendations">
          <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
            {[
              { priority: "P0", title: "Legal escalation protocol", detail: "Implement 10-day SLA for proposal legal review with automatic escalation to VP Legal. Expected recovery: $180K/quarter in Orthopedics pipeline alone.", impact: "$180K/q", timeline: "2 weeks" },
              { priority: "P0", title: "Territory reallocation toward Dermatology", detail: "Move 1-2 reps from general territory to Dermatology-focused. Model shows +$420K quarterly bookings at current conversion rates. Chen should mentor the transitioning reps given her Derm track record.", impact: "$420K/q", timeline: "Start of Q2" },
              { priority: "P1", title: "Paid campaign ICP tightening", detail: "Raise ICP score threshold for paid leads from 45 to 60. Add SDR pre-qualification for all paid-sourced demos. Accept lower lead volume in exchange for higher conversion.", impact: "+2x conversion", timeline: "2 weeks" },
              { priority: "P1", title: "Structured referral program", detail: "Launch formal referral program with incentive structure. Referrals convert at 35.7% vs. 14.3% for paid. Even 20% volume increase = $136K incremental quarterly bookings.", impact: "$136K/q", timeline: "4 weeks" },
              { priority: "P2", title: "Ortho competitive analysis", detail: "7.5% churn rate with 'switched to competitor' as primary driver. Conduct win/loss interviews on 5 most recent Ortho churns. Feed findings to Product for roadmap prioritization.", impact: "Reduce churn 2-3pp", timeline: "6 weeks" },
              { priority: "P2", title: "Forecast methodology upgrade", detail: "Current weighted pipeline forecast relies on static stage probabilities. Implement deal-level scoring incorporating days-in-stage, engagement recency, and segment-specific conversion rates. Target: forecast accuracy within ±10%.", impact: "Better planning", timeline: "Q2" },
            ].map((rec, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "50px 1fr 80px 80px", gap: 12, padding: "12px 16px", borderRadius: 8, background: rec.priority === "P0" ? "#fef2f2" : rec.priority === "P1" ? "#fffbeb" : "#f0f9ff", border: `1px solid ${rec.priority === "P0" ? "#fecaca" : rec.priority === "P1" ? "#fde68a" : "#bae6fd"}`, alignItems: "start" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: rec.priority === "P0" ? "#dc2626" : rec.priority === "P1" ? "#d97706" : "#2563eb", background: rec.priority === "P0" ? "#fee2e2" : rec.priority === "P1" ? "#fef3c7" : "#e0f2fe", padding: "2px 8px", borderRadius: 4, textAlign: "center" }}>{rec.priority}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{rec.title}</div>
                  <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.55 }}>{rec.detail}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textAlign: "right" }}>{rec.impact}</div>
                <div style={{ fontSize: 11, color: "#64748b", textAlign: "right" }}>{rec.timeline}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <div style={{ borderTop: "2px solid #e2e8f0", paddingTop: 16, marginTop: 40, fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
          <strong>Data Sources:</strong> Synthetic Salesforce Opportunity, Lead, and Account data. Marketing metrics from synthetic HubSpot + Salesforce integration. Churn data from synthetic billing system. All figures are illustrative and modeled on realistic SaaS GTM benchmarks — not derived from any company's actual data.
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
          <strong>Methodology:</strong> Win rate calculated as Closed Won / (Closed Won + Closed Lost) for opportunities reaching Stage 2+ with ACV ≥ $5K. NRR calculated as (Current Period Revenue from Existing Customers) / (Prior Period Revenue from Same Cohort). Pipeline coverage = Qualified Pipeline / Remaining Quota. Full SQL definitions available at <span style={{ color: "#2563eb" }}>/methodology</span>.
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1a1a2e", margin: "0 0 12px", paddingBottom: 6, borderBottom: "1px solid #e2e8f0" }}>{title}</h2>
      {children}
    </div>
  );
}

function P({ children }) {
  return <p style={{ fontSize: 13.5, lineHeight: 1.75, color: "#334155", margin: "0 0 12px" }}>{children}</p>;
}

function CalloutBox({ color, title, children }) {
  return (
    <div style={{ borderLeft: `4px solid ${color}`, background: color + "08", padding: "12px 16px", borderRadius: "0 8px 8px 0", margin: "16px 0" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function DataTable({ headers, rows }) {
  return (
    <div style={{ overflowX: "auto", margin: "12px 0 16px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b", borderBottom: "2px solid #1a1a2e", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: "8px 10px", textAlign: "right", borderBottom: "1px solid #e2e8f0",
                  fontWeight: j === 0 ? 600 : 400,
                  color: typeof cell === "string" && cell.startsWith("▼") ? "#dc2626" : typeof cell === "string" && cell.startsWith("▲") ? "#10b981" : "#334155",
                  whiteSpace: "nowrap",
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
