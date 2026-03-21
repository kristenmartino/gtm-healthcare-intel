import { useState, useMemo, useEffect } from "react";

const SPECIALTIES = ["Dermatology", "Orthopedics", "Gastroenterology", "Ophthalmology", "Urology"];

function ScoreBar({ value, color }) {
  return (
    <div style={{ width: "100%", height: 8, background: "var(--bar-bg)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)" }} />
    </div>
  );
}

function Badge({ children, color }) {
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", background: color + "18", color, textTransform: "uppercase" }}>
      {children}
    </span>
  );
}

export default function SpectrumIQ() {
  const [specialty, setSpecialty] = useState("Dermatology");
  const [expanded, setExpanded] = useState(null);
  const [sortBy, setSortBy] = useState("composite_score");
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState("");

  // Load pipeline output
  useEffect(() => {
    fetch("/metro_scores.json")
      .then(res => res.json())
      .then(data => {
        setAllData(data);
        setDataSource(`Pipeline output: ${data.length} metro × specialty scores from spectrumiq_pipeline.py`);
        setLoading(false);
      })
      .catch(() => {
        setDataSource("Error loading pipeline data");
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const rows = allData.filter(d => d.specialty === specialty);
    return [...rows].sort((a, b) => b[sortBy] - a[sortBy]);
  }, [allData, specialty, sortBy]);

  const tierColor = (score) => score >= 70 ? "#0d9488" : score >= 45 ? "#d97706" : "#94a3b8";
  const tierLabel = (score) => score >= 70 ? "High Opportunity" : score >= 45 ? "Moderate" : "Low Priority";

  if (loading) {
    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#0b1120", color: "#e2e8f0", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "#64748b", animation: "pulse 1.5s infinite" }}>Loading pipeline data...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", background: "var(--bg)", color: "var(--fg)", minHeight: "100vh", padding: 0, ["--bg"]: "#0b1120", ["--fg"]: "#e2e8f0", ["--card"]: "#111b2e", ["--card-border"]: "#1e293b", ["--accent"]: "#38bdf8", ["--accent2"]: "#0d9488", ["--bar-bg"]: "#1e293b", ["--muted"]: "#64748b" }}>

      {/* Header */}
      <div style={{ padding: "32px 32px 0", maxWidth: 1100, margin: "0 auto" }}>
        <a href="/" style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12 }}
           onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"}
           onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
          ← Portfolio
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #38bdf8, #0d9488)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#0b1120" }}>S</div>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent)" }}>SpectrumIQ</span>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#10b98118", color: "#10b981", fontWeight: 600 }}>Pipeline-Fed</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "12px 0 6px", letterSpacing: "-0.02em", lineHeight: 1.15 }}>Specialty Practice Market Opportunity Scorer</h1>
        <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 8px", maxWidth: 620, lineHeight: 1.55 }}>
          Identifies underpenetrated metro areas for specialty EHR adoption using CMS NPPES provider density, Census demographics, and Medicare utilization signals.
        </p>

        {/* Data source indicator */}
        <div style={{ fontSize: 11, color: "#475569", padding: "6px 12px", background: "#111b2e", borderRadius: 6, border: "1px solid #1e293b", display: "inline-block", marginBottom: 16 }}>
          <span style={{ color: "#10b981", marginRight: 6 }}>●</span>
          {dataSource} · {filtered.length} metros for {specialty}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          {SPECIALTIES.map(s => (
            <button key={s} onClick={() => { setSpecialty(s); setExpanded(null); }} style={{
              padding: "8px 18px", borderRadius: 8, border: specialty === s ? "1.5px solid var(--accent)" : "1.5px solid var(--card-border)", background: specialty === s ? "var(--accent)" + "15" : "var(--card)", color: specialty === s ? "var(--accent)" : "var(--muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
            }}>{s}</button>
          ))}
        </div>

        {/* Sort controls */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, fontSize: 12, color: "var(--muted)" }}>
          <span style={{ fontWeight: 600 }}>Sort by:</span>
          {[["composite_score", "Overall Score"], ["gap_score", "Provider Gap"], ["growth_score", "Pop. Growth"], ["medicare_score", "Medicare %"]].map(([key, label]) => (
            <button key={key} onClick={() => setSortBy(key)} style={{
              padding: "4px 10px", borderRadius: 6, border: "none", background: sortBy === key ? "var(--accent)" + "20" : "transparent", color: sortBy === key ? "var(--accent)" : "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer"
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px 48px" }}>
        <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--card-border)", overflow: "hidden" }}>
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "40px 1.4fr 0.7fr 0.7fr 0.6fr 1.2fr 0.8fr", padding: "14px 20px", borderBottom: "1px solid var(--card-border)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)" }}>
            <span>#</span><span>Metro Area</span><span style={{ textAlign: "right" }}>Providers</span><span style={{ textAlign: "right" }}>Per 100K</span><span style={{ textAlign: "right" }}>Score</span><span style={{ textAlign: "center" }}>Opportunity</span><span style={{ textAlign: "center" }}>Tier</span>
          </div>

          {filtered.map((m, i) => (
            <div key={m.metro}>
              <div onClick={() => setExpanded(expanded === i ? null : i)} style={{
                display: "grid", gridTemplateColumns: "40px 1.4fr 0.7fr 0.7fr 0.6fr 1.2fr 0.8fr", padding: "14px 20px", borderBottom: "1px solid var(--card-border)", cursor: "pointer", transition: "background 0.15s", alignItems: "center",
                background: expanded === i ? "var(--accent)" + "08" : "transparent"
              }}
                onMouseEnter={e => { if (expanded !== i) e.currentTarget.style.background = "#ffffff06"; }}
                onMouseLeave={e => { if (expanded !== i) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: i < 3 ? "var(--accent)" : "var(--muted)" }}>{i + 1}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{m.metro}</span>
                <span style={{ textAlign: "right", fontSize: 14, fontWeight: 500 }}>{m.provider_count.toLocaleString()}</span>
                <span style={{ textAlign: "right", fontSize: 14, fontWeight: 500 }}>{m.per_100k}</span>
                <span style={{ textAlign: "right", fontSize: 18, fontWeight: 800, color: tierColor(m.composite_score) }}>{m.composite_score}</span>
                <div style={{ padding: "0 12px" }}><ScoreBar value={m.composite_score} color={tierColor(m.composite_score)} /></div>
                <div style={{ textAlign: "center" }}><Badge color={tierColor(m.composite_score)}>{m.tier}</Badge></div>
              </div>

              {/* Expanded detail */}
              {expanded === i && (
                <div style={{ padding: "20px 24px 24px 60px", background: "var(--accent)" + "05", borderBottom: "1px solid var(--card-border)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                    {[
                      { label: "Provider Gap", value: m.gap_score, desc: `${m.per_100k} per 100K vs ${m.national_benchmark} national avg` },
                      { label: "Population Growth", value: m.growth_score, desc: `${m.growth_rate}% annual metro growth rate` },
                      { label: "Medicare Density", value: m.medicare_score, desc: `${m.medicare_pct}% Medicare population` },
                      { label: "Income Index", value: m.income_score, desc: `$${(m.median_income / 1000).toFixed(0)}K median household income` },
                    ].map(s => (
                      <div key={s.label} style={{ background: "var(--card)", borderRadius: 8, padding: 14, border: "1px solid var(--card-border)" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: 6 }}>{s.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: tierColor(s.value), marginBottom: 4 }}>{Math.round(s.value)}</div>
                        <ScoreBar value={s.value} color={tierColor(s.value)} />
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{s.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "var(--card)", borderRadius: 8, padding: 14, border: "1px solid var(--card-border)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>Why This Market</div>
                    <p style={{ fontSize: 13, color: "var(--fg)", lineHeight: 1.6, margin: 0 }}>
                      {m.composite_score >= 70
                        ? `${m.metro} shows strong opportunity for ${specialty} EHR penetration. With only ${m.per_100k} providers per 100K residents (vs. ${m.national_benchmark} national average), the market is underserved. Combined with ${m.growth_rate}% population growth and ${m.medicare_pct}% Medicare density, this metro represents a high-value target for GTM investment.`
                        : m.composite_score >= 45
                        ? `${m.metro} presents moderate opportunity. Provider density at ${m.per_100k} per 100K is approaching the national benchmark of ${m.national_benchmark}, but ${m.growth_rate}% population growth creates expanding demand. Consider targeted outreach to new practices forming in growth corridors.`
                        : `${m.metro} has relatively strong provider coverage at ${m.per_100k} per 100K. Market opportunity here is primarily through competitive displacement and upsell to existing practices rather than greenfield expansion.`
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Methodology note */}
        <div style={{ marginTop: 24, padding: 20, background: "var(--card)", borderRadius: 10, border: "1px solid var(--card-border)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 8 }}>Methodology & Data Pipeline</div>
          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>
            Data produced by <code style={{ color: "#10b981", background: "#1e293b", padding: "1px 4px", borderRadius: 3, fontSize: 11 }}>spectrumiq_pipeline.py</code> — a Python ETL pipeline that processes CMS NPPES provider data filtered by specialty taxonomy codes, joins to Census metro populations via ZIP-code mapping, and computes weighted composite scores. Weights: Provider Gap (35%), Population Growth (25%), Medicare Density (20%), Income Index (20%). Pipeline output validated with automated data quality checks (see <code style={{ color: "#10b981", background: "#1e293b", padding: "1px 4px", borderRadius: 3, fontSize: 11 }}>test_pipeline.py</code>). Full source in <code style={{ color: "#10b981", background: "#1e293b", padding: "1px 4px", borderRadius: 3, fontSize: 11 }}>data/pipeline/</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
