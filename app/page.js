"use client";
import Link from "next/link";

const PROJECTS = [
  {
    name: "SpectrumIQ",
    slug: "spectrumiq",
    pitch: "Identifies underpenetrated metro areas for specialty EHR adoption using CMS provider density, Census demographics, and Medicare utilization signals.",
    skills: ["Market Sizing", "Segmentation", "Opportunity Scoring", "TAM/SAM Analysis"],
    color: "#38bdf8",
    gradient: "linear-gradient(135deg, #38bdf8, #0d9488)",
    icon: "S",
    gtmProblem: "Where should the sales team focus next quarter? Which metros have the biggest gap between specialty provider demand and EHR penetration?",
  },
  {
    name: "PracticeFlow",
    slug: "practiceflow",
    pitch: "Benchmarking dashboard comparing practice revenue cycle KPIs against synthetic peer cohorts — the kind of analytics that drives EHR product stickiness.",
    skills: ["KPI Design", "Benchmarking", "Cohort Analysis", "Revenue Cycle Analytics"],
    color: "#0d9488",
    gradient: "linear-gradient(135deg, #0d9488, #14b8a6)",
    icon: "P",
    gtmProblem: "How do we help practices see the value of staying on our platform? What data-driven features reduce churn?",
  },
  {
    name: "ConvertPath",
    slug: "convertpath",
    pitch: "GTM funnel analytics tool modeling the specialty EHR sales cycle with stage conversion, velocity analysis, and pipeline forecasting.",
    skills: ["Funnel Analysis", "Pipeline Forecasting", "Win/Loss Analysis", "Sales Velocity"],
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    icon: "C",
    gtmProblem: "Where are we losing deals? Which channels convert best by specialty? How accurate is our weighted pipeline forecast?",
  },
  {
    name: "SpecialtyPulse",
    slug: "specialtypulse",
    pitch: "Trend intelligence tracking specialty procedure volumes and reimbursement shifts — early signals for GTM teams about where to invest.",
    skills: ["Trend Analysis", "Market Intelligence", "Signal Detection", "Strategic Planning"],
    color: "#f59e0b",
    gradient: "linear-gradient(135deg, #f59e0b, #ef4444)",
    icon: "S",
    gtmProblem: "Which specialties are growing fastest? What procedure volume trends signal expanding EHR demand?",
  },
  {
    name: "AskPractice",
    slug: "askpractice",
    pitch: "AI-powered conversational analytics — practice managers ask plain-English questions about performance and get instant, contextualized answers.",
    skills: ["AI/LLM Integration", "NL Querying", "Product Innovation", "Data Storytelling"],
    color: "#10b981",
    gradient: "linear-gradient(135deg, #10b981, #059669)",
    icon: "A",
    gtmProblem: "How do we make practice data accessible to non-technical users? What does the future of healthcare BI look like?",
    featured: true,
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
          <span style={{ background: "linear-gradient(135deg, #38bdf8, #0d9488)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>GTM Intelligence</span>
        </h1>
        <p style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.65, maxWidth: 620, marginBottom: 8 }}>
          Five interactive projects demonstrating how I think about go-to-market analytics, revenue cycle intelligence, and AI-powered insights for the specialty EHR space.
        </p>
        <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
          Built by Kristen Martino · All projects use synthetic or publicly available data (CMS NPPES, Medicare PUF, Census) · No proprietary data
        </p>
      </div>

      {/* Project cards */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 32px 64px" }}>
        <div style={{ display: "grid", gap: 16 }}>
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
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = p.color + "60"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = p.featured ? p.color + "40" : "#1e293b"; }}
              >
                {p.featured && (
                  <div style={{ position: "absolute", top: 14, right: 16, fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: p.color + "18", color: p.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    AI-Powered Differentiator
                  </div>
                )}

                <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                  {/* Icon */}
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: p.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{p.icon}</div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}>{p.name}</h2>
                    </div>
                    <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, marginBottom: 12 }}>{p.pitch}</p>

                    {/* GTM problem */}
                    <div style={{ background: "#0b1120", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: p.color }}>GTM Question It Answers: </span>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>{p.gtmProblem}</span>
                    </div>

                    {/* Skill tags */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {p.skills.map((s) => (
                        <span key={s} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "#1e293b", color: "#94a3b8" }}>{s}</span>
                      ))}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div style={{ fontSize: 20, color: "#475569", alignSelf: "center", flexShrink: 0 }}>→</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer context */}
        <div style={{ marginTop: 32, padding: 20, background: "#111b2e", borderRadius: 10, border: "1px solid #1e293b" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>About This Portfolio</div>
          <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, marginBottom: 10 }}>
            These projects were built to demonstrate how I approach GTM business intelligence in the specialty healthcare EHR space. Each one addresses a specific analytical challenge that a GTM BI team faces: market sizing, sales funnel diagnostics, revenue cycle benchmarking, procedure trend monitoring, and AI-augmented analytics.
          </p>
          <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, marginBottom: 10 }}>
            All data is synthetic or derived from publicly available sources (CMS NPPES provider registry, Medicare Physician PUF, Census Bureau, MGMA/HFMA published benchmarks). No proprietary or patient data was used.
          </p>
          <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
            <strong style={{ color: "#e2e8f0" }}>Tech stack:</strong> React, Next.js, DuckDB-modeled data pipelines, Claude API (Anthropic) for natural language analytics. Each project is designed to be extensible with real data sources.
          </p>
        </div>
      </div>
    </div>
  );
}
