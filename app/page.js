"use client";
import Link from "next/link";

const MATURITY_LEVELS = [
  { level: "Governance", color: "#fbbf24", label: "The foundation — metric standardization, data trust, adoption" },
  { level: "Descriptive", color: "#64748b", label: "What happened?" },
  { level: "Diagnostic", color: "#f59e0b", label: "Why did it happen?" },
  { level: "Predictive", color: "#38bdf8", label: "What will happen?" },
  { level: "Prescriptive", color: "#10b981", label: "What should we do?" },
];

const PROJECTS = [
  {
    name: "NorthStar",
    slug: "northstar",
    pitch: "GTM analytics governance platform — metric registry with conflict resolution, reporting adoption tracker, shadow spreadsheet monitor, and the descriptive-to-prescriptive maturity roadmap.",
    skills: ["Metric Standardization", "Data Governance", "Adoption Tracking", "Maturity Modeling"],
    color: "#fbbf24",
    gradient: "linear-gradient(135deg, #f59e0b, #10b981)",
    icon: "N",
    maturity: "Governance",
    gtmProblem: "How do we get Sales, Marketing, and Finance to agree on what 'pipeline' means — and then get them to actually use the standardized reports?",
    featured: true,
    isNew: true,
  },
  {
    name: "AskGTM",
    slug: "askgtm",
    pitch: "AI-powered conversational analytics for GTM teams. Ask plain-English questions about pipeline, rep performance, win rates, and churn — get instant answers with actionable recommendations.",
    skills: ["AI/LLM Integration", "NL Querying", "Prescriptive Analytics", "GTM Intelligence"],
    color: "#6366f1",
    gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    icon: "A",
    maturity: "Prescriptive",
    gtmProblem: "What if a sales leader could ask 'Why are we losing Ortho deals?' and get a data-backed answer with a recommended action — without filing a Jira ticket?",
    featured: true,
    isNew: true,
  },
  {
    name: "ConvertPath",
    slug: "convertpath",
    pitch: "Sales funnel analyzer with stage-by-stage conversion rates, source attribution, velocity analysis by deal size, weighted pipeline forecast, and leaky bucket diagnostics.",
    skills: ["Funnel Analysis", "Pipeline Forecasting", "Win/Loss Analysis", "Sales Velocity"],
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    icon: "C",
    maturity: "Diagnostic → Predictive",
    gtmProblem: "Where are we losing deals in the funnel, and what's the revenue impact of fixing the biggest drop-off stage?",
  },
  {
    name: "SpectrumIQ",
    slug: "spectrumiq",
    pitch: "Market opportunity scoring that ranks metro areas by specialty EHR adoption potential using CMS provider density, Census demographics, and Medicare utilization.",
    skills: ["Market Sizing", "Segmentation", "Opportunity Scoring", "TAM/SAM Analysis"],
    color: "#38bdf8",
    gradient: "linear-gradient(135deg, #38bdf8, #0d9488)",
    icon: "S",
    maturity: "Diagnostic",
    gtmProblem: "Which metro markets should the sales team prioritize next quarter — and what data backs that decision?",
  },
  {
    name: "PracticeFlow",
    slug: "practiceflow",
    pitch: "Revenue cycle benchmarking dashboard comparing practice KPIs against synthetic peer cohorts — the kind of analytics that drives EHR platform stickiness and reduces churn.",
    skills: ["KPI Design", "Benchmarking", "Cohort Analysis", "Revenue Cycle Analytics"],
    color: "#0d9488",
    gradient: "linear-gradient(135deg, #0d9488, #14b8a6)",
    icon: "P",
    maturity: "Descriptive",
    gtmProblem: "How do we give practices a reason to stay on the platform through data they can't get elsewhere?",
  },
  {
    name: "SpecialtyPulse",
    slug: "specialtypulse",
    pitch: "Procedure volume and reimbursement trend monitor with auto-flagging of accelerating CPT codes — early market signals for GTM planning.",
    skills: ["Trend Analysis", "Market Intelligence", "Signal Detection", "Strategic Planning"],
    color: "#f59e0b",
    gradient: "linear-gradient(135deg, #f59e0b, #ef4444)",
    icon: "S",
    maturity: "Descriptive",
    gtmProblem: "Which specialties are seeing procedure volume growth that signals expanding EHR demand?",
  },
  {
    name: "AskPractice",
    slug: "askpractice",
    pitch: "AI-powered practice performance tool — a practice manager asks plain-English questions about their revenue, denials, and provider productivity and gets instant answers.",
    skills: ["AI/LLM Integration", "NL Querying", "Product Innovation", "Data Storytelling"],
    color: "#10b981",
    gradient: "linear-gradient(135deg, #10b981, #059669)",
    icon: "A",
    maturity: "Prescriptive",
    gtmProblem: "How do we make practice data accessible to non-technical users?",
  },
];

export default function Home() {
  return (
    <div style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", background: "#0b1120", color: "#e2e8f0", minHeight: "100vh" }}>
      {/* Hero */}
      <div style={{ padding: "48px 32px 40px", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b", marginBottom: 12 }}>Portfolio — GTM Business Intelligence</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 800, lineHeight: 1.1, marginBottom: 12, letterSpacing: "-0.02em" }}>
          Specialty Healthcare<br />
          <span style={{ background: "linear-gradient(135deg, #fbbf24, #10b981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>GTM Intelligence</span>
        </h1>
        <p style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.65, maxWidth: 680, marginBottom: 8 }}>
          Seven projects spanning the full analytics maturity curve — from metric governance and standardized reporting through diagnostic analysis to AI-powered prescriptive recommendations. Built for GTM teams in the specialty EHR space.
        </p>
        <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
          Built by Kristen Martino · All projects use synthetic or publicly available data (CMS NPPES, Medicare PUF, Census, Salesforce-modeled) · No proprietary data
        </p>
      </div>

      {/* Maturity model strip */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 32px 24px" }}>
        <div style={{ background: "#111b2e", borderRadius: 12, padding: "16px 20px", border: "1px solid #1e293b" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", marginBottom: 12 }}>Analytics Maturity Model — Project Mapping</div>
          <div style={{ display: "flex", gap: 6 }}>
            {MATURITY_LEVELS.map(l => (
              <div key={l.level} style={{ flex: 1, padding: "10px 12px", borderRadius: 8, background: l.color + "10", border: `1px solid ${l.color}25` }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: l.color, marginBottom: 2 }}>{l.level}</div>
                <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.4 }}>{l.label}</div>
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                  {PROJECTS.filter(p => p.maturity.includes(l.level)).map(p => (
                    <div key={p.slug} style={{ fontSize: 10, fontWeight: 700, color: p.color }}>{p.name}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Project cards */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 32px 64px" }}>
        <div style={{ display: "grid", gap: 14 }}>
          {PROJECTS.map((p) => (
            <Link href={`/${p.slug}`} key={p.slug} style={{ textDecoration: "none", color: "inherit" }}>
              <div
                style={{
                  background: "#111b2e",
                  borderRadius: 14,
                  border: p.featured ? `1.5px solid ${p.color}40` : "1px solid #1e293b",
                  padding: 24,
                  cursor: "pointer",
                  transition: "transform 0.2s, border-color 0.2s",
                  position: "relative",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = p.color + "60"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = p.featured ? p.color + "40" : "#1e293b"; }}
              >
                <div style={{ position: "absolute", top: 14, right: 16, display: "flex", gap: 6 }}>
                  {p.isNew && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#10b98118", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.06em" }}>New</span>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#1e293b", color: "#94a3b8" }}>{p.maturity}</span>
                </div>

                <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: p.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{p.icon}</div>

                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em", marginBottom: 6 }}>{p.name}</h2>
                    <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, marginBottom: 12 }}>{p.pitch}</p>

                    <div style={{ background: "#0b1120", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: p.color }}>GTM Question: </span>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>{p.gtmProblem}</span>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {p.skills.map((s) => (
                        <span key={s} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "#1e293b", color: "#94a3b8" }}>{s}</span>
                      ))}
                    </div>
                  </div>

                  <div style={{ fontSize: 20, color: "#475569", alignSelf: "center", flexShrink: 0 }}>→</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Supporting resources */}
        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Link href="/methodology" style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ background: "#111b2e", borderRadius: 10, padding: "16px 18px", border: "1px solid #1e293b", cursor: "pointer", transition: "border-color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#38bdf860"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#1e293b"}
            >
              <div style={{ fontSize: 16, marginBottom: 6 }}>{`</>`}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>SQL Methodology</div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>Production-ready SQL for every GTM metric — with edge case handling and cross-team conflict resolution notes.</div>
            </div>
          </Link>
          <Link href="/q1-review" style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ background: "#111b2e", borderRadius: 10, padding: "16px 18px", border: "1px solid #1e293b", cursor: "pointer", transition: "border-color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#f59e0b60"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#1e293b"}
            >
              <div style={{ fontSize: 16, marginBottom: 6 }}>📊</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Q1 Performance Review</div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>Analytical memo with segment breakdowns, root cause analysis, and prioritized recommendations — the actual deliverable.</div>
            </div>
          </Link>
          <a href="https://github.com/kristenmartino/gtm-healthcare-intel/tree/main/data/pipeline" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ background: "#111b2e", borderRadius: 10, padding: "16px 18px", border: "1px solid #1e293b", cursor: "pointer", transition: "border-color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#10b98160"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#1e293b"}
            >
              <div style={{ fontSize: 16, marginBottom: 6 }}>🔧</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Data Pipeline (GitHub)</div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>Python ETL pipeline processing real CMS NPPES + Census data into SpectrumIQ opportunity scores. DuckDB + pandas.</div>
            </div>
          </a>
        </div>

        {/* About section */}
        <div style={{ marginTop: 32, padding: 20, background: "#111b2e", borderRadius: 10, border: "1px solid #1e293b" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>About This Portfolio</div>
          <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, marginBottom: 10 }}>
            These projects are organized around a core belief: the hardest part of GTM analytics isn't building dashboards — it's building the operating model underneath them. Metric standardization, data trust, reporting adoption, and organizational readiness are prerequisites for the kind of predictive and prescriptive analytics that actually change business outcomes. That's why NorthStar (governance) and AskGTM (prescriptive AI) sit at the top — they represent the foundation and the destination.
          </p>
          <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, marginBottom: 10 }}>
            All data is synthetic or derived from publicly available sources (CMS NPPES provider registry, Medicare Physician PUF, Census Bureau, MGMA/HFMA published benchmarks, Salesforce-modeled GTM data). No proprietary or patient data was used.
          </p>
          <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
            <strong style={{ color: "#e2e8f0" }}>Tech stack:</strong> React, Next.js, DuckDB-modeled data pipelines, Claude API (Anthropic) for natural language analytics. Each project is designed to be extensible with real data sources (Salesforce, HubSpot, billing systems, data warehouses).
          </p>
        </div>
      </div>
    </div>
  );
}
