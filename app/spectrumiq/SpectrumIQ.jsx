import { useState, useMemo } from "react";

const SPECIALTIES = ["Dermatology", "Orthopedics", "Gastroenterology", "Ophthalmology", "Urology"];

const METROS = [
  { metro: "Miami-Fort Lauderdale, FL", pop: 6138000, providers: { Dermatology: 812, Orthopedics: 945, Gastroenterology: 534, Ophthalmology: 678, Urology: 389 }, medianIncome: 62000, medicare: 22.1, growthRate: 2.8 },
  { metro: "Houston, TX", pop: 7122000, providers: { Dermatology: 634, Orthopedics: 878, Gastroenterology: 498, Ophthalmology: 556, Urology: 412 }, medianIncome: 58400, medicare: 14.2, growthRate: 3.1 },
  { metro: "Phoenix, AZ", pop: 4946000, providers: { Dermatology: 389, Orthopedics: 612, Gastroenterology: 287, Ophthalmology: 401, Urology: 234 }, medianIncome: 56200, medicare: 18.7, growthRate: 4.2 },
  { metro: "Atlanta, GA", pop: 6144000, providers: { Dermatology: 498, Orthopedics: 723, Gastroenterology: 389, Ophthalmology: 478, Urology: 298 }, medianIncome: 61800, medicare: 13.8, growthRate: 2.9 },
  { metro: "Dallas-Fort Worth, TX", pop: 7637000, providers: { Dermatology: 712, Orthopedics: 934, Gastroenterology: 501, Ophthalmology: 623, Urology: 378 }, medianIncome: 63100, medicare: 12.9, growthRate: 3.4 },
  { metro: "Nashville, TN", pop: 1989000, providers: { Dermatology: 178, Orthopedics: 312, Gastroenterology: 134, Ophthalmology: 198, Urology: 112 }, medianIncome: 57600, medicare: 15.1, growthRate: 3.8 },
  { metro: "Tampa-St. Petersburg, FL", pop: 3218000, providers: { Dermatology: 378, Orthopedics: 489, Gastroenterology: 267, Ophthalmology: 356, Urology: 198 }, medianIncome: 53800, medicare: 24.3, growthRate: 3.1 },
  { metro: "Charlotte, NC", pop: 2660000, providers: { Dermatology: 198, Orthopedics: 334, Gastroenterology: 156, Ophthalmology: 212, Urology: 134 }, medianIncome: 59200, medicare: 13.2, growthRate: 4.1 },
  { metro: "San Antonio, TX", pop: 2558000, providers: { Dermatology: 167, Orthopedics: 298, Gastroenterology: 134, Ophthalmology: 189, Urology: 112 }, medianIncome: 52100, medicare: 14.8, growthRate: 3.2 },
  { metro: "Orlando, FL", pop: 2673000, providers: { Dermatology: 234, Orthopedics: 356, Gastroenterology: 178, Ophthalmology: 245, Urology: 145 }, medianIncome: 54600, medicare: 17.6, growthRate: 3.9 },
  { metro: "Denver, CO", pop: 2963000, providers: { Dermatology: 312, Orthopedics: 478, Gastroenterology: 234, Ophthalmology: 298, Urology: 178 }, medianIncome: 68400, medicare: 11.8, growthRate: 2.7 },
  { metro: "Las Vegas, NV", pop: 2265000, providers: { Dermatology: 145, Orthopedics: 234, Gastroenterology: 112, Ophthalmology: 167, Urology: 89 }, medianIncome: 55200, medicare: 16.4, growthRate: 4.5 },
  { metro: "Austin, TX", pop: 2283000, providers: { Dermatology: 198, Orthopedics: 312, Gastroenterology: 145, Ophthalmology: 201, Urology: 123 }, medianIncome: 67800, medicare: 9.8, growthRate: 5.1 },
  { metro: "Jacksonville, FL", pop: 1605000, providers: { Dermatology: 134, Orthopedics: 212, Gastroenterology: 98, Ophthalmology: 145, Urology: 78 }, medianIncome: 56800, medicare: 16.2, growthRate: 3.3 },
  { metro: "Raleigh-Durham, NC", pop: 1413000, providers: { Dermatology: 134, Orthopedics: 198, Gastroenterology: 89, Ophthalmology: 134, Urology: 78 }, medianIncome: 64200, medicare: 11.4, growthRate: 4.3 },
  { metro: "Salt Lake City, UT", pop: 1243000, providers: { Dermatology: 89, Orthopedics: 178, Gastroenterology: 67, Ophthalmology: 98, Urology: 56 }, medianIncome: 62400, medicare: 10.2, growthRate: 3.6 },
  { metro: "Indianapolis, IN", pop: 2111000, providers: { Dermatology: 178, Orthopedics: 298, Gastroenterology: 145, Ophthalmology: 198, Urology: 123 }, medianIncome: 55600, medicare: 14.6, growthRate: 2.1 },
  { metro: "Columbus, OH", pop: 2138000, providers: { Dermatology: 189, Orthopedics: 312, Gastroenterology: 156, Ophthalmology: 201, Urology: 112 }, medianIncome: 57400, medicare: 13.8, growthRate: 2.4 },
];

const NATIONAL_BENCHMARKS = {
  Dermatology: 12.8, Orthopedics: 16.2, Gastroenterology: 8.9, Ophthalmology: 11.4, Urology: 6.8
};

function computeScores(data, specialty) {
  return data.map(m => {
    const provCount = m.providers[specialty];
    const per100k = (provCount / m.pop) * 100000;
    const benchmark = NATIONAL_BENCHMARKS[specialty];
    const gapScore = Math.max(0, Math.min(100, ((benchmark - per100k) / benchmark) * 100));
    const growthScore = Math.min(100, (m.growthRate / 5.5) * 100);
    const medicareScore = Math.min(100, (m.medicare / 25) * 100);
    const incomeScore = Math.min(100, (m.medianIncome / 70000) * 100);
    const composite = gapScore * 0.35 + growthScore * 0.25 + medicareScore * 0.2 + incomeScore * 0.2;
    return { ...m, provCount, per100k: per100k.toFixed(1), gapScore, growthScore, medicareScore, incomeScore, composite: Math.round(composite) };
  }).sort((a, b) => b.composite - a.composite);
}

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
  const [sortBy, setSortBy] = useState("composite");

  const scored = useMemo(() => {
    const s = computeScores(METROS, specialty);
    if (sortBy === "composite") return s;
    return [...s].sort((a, b) => b[sortBy] - a[sortBy]);
  }, [specialty, sortBy]);

  const tierColor = (score) => score >= 70 ? "#0d9488" : score >= 45 ? "#d97706" : "#94a3b8";
  const tierLabel = (score) => score >= 70 ? "High Opportunity" : score >= 45 ? "Moderate" : "Low Priority";

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
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "12px 0 6px", letterSpacing: "-0.02em", lineHeight: 1.15 }}>Specialty Practice Market Opportunity Scorer</h1>
        <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 24px", maxWidth: 620, lineHeight: 1.55 }}>
          Identifies underpenetrated metro areas for specialty EHR adoption using CMS NPPES provider density, Census demographics, Medicare utilization, and population growth signals.
        </p>

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
          {[["composite", "Overall Score"], ["gapScore", "Provider Gap"], ["growthScore", "Pop. Growth"], ["medicareScore", "Medicare %"]].map(([key, label]) => (
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

          {scored.map((m, i) => (
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
                <span style={{ textAlign: "right", fontSize: 14, fontWeight: 500 }}>{m.provCount.toLocaleString()}</span>
                <span style={{ textAlign: "right", fontSize: 14, fontWeight: 500 }}>{m.per100k}</span>
                <span style={{ textAlign: "right", fontSize: 18, fontWeight: 800, color: tierColor(m.composite) }}>{m.composite}</span>
                <div style={{ padding: "0 12px" }}><ScoreBar value={m.composite} color={tierColor(m.composite)} /></div>
                <div style={{ textAlign: "center" }}><Badge color={tierColor(m.composite)}>{tierLabel(m.composite)}</Badge></div>
              </div>

              {/* Expanded detail */}
              {expanded === i && (
                <div style={{ padding: "20px 24px 24px 60px", background: "var(--accent)" + "05", borderBottom: "1px solid var(--card-border)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                    {[
                      { label: "Provider Gap", value: m.gapScore, desc: `${m.per100k} per 100K vs ${NATIONAL_BENCHMARKS[specialty]} national avg` },
                      { label: "Population Growth", value: m.growthScore, desc: `${m.growthRate}% annual metro growth rate` },
                      { label: "Medicare Density", value: m.medicareScore, desc: `${m.medicare}% Medicare population` },
                      { label: "Income Index", value: m.incomeScore, desc: `$${(m.medianIncome / 1000).toFixed(0)}K median household income` },
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
                      {m.composite >= 70
                        ? `${m.metro} shows strong opportunity for ${specialty} EHR penetration. With only ${m.per100k} providers per 100K residents (vs. ${NATIONAL_BENCHMARKS[specialty]} national average), the market is underserved. Combined with ${m.growthRate}% population growth and ${m.medicare}% Medicare density, this metro represents a high-value target for GTM investment.`
                        : m.composite >= 45
                        ? `${m.metro} presents moderate opportunity. Provider density at ${m.per100k} per 100K is approaching the national benchmark of ${NATIONAL_BENCHMARKS[specialty]}, but ${m.growthRate}% population growth creates expanding demand. Consider targeted outreach to new practices forming in growth corridors.`
                        : `${m.metro} has relatively strong provider coverage at ${m.per100k} per 100K. Market opportunity here is primarily through competitive displacement and upsell to existing practices rather than greenfield expansion.`
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
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 8 }}>Methodology</div>
          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>
            Composite score weights: Provider Gap (35%) — ratio of specialty providers per 100K vs. national average from CMS NPPES taxonomy data; Population Growth (25%) — Census Bureau metro growth rate as demand signal; Medicare Density (20%) — CMS enrollment data indicating payer mix favorability for specialty practices; Income Index (20%) — median household income as commercial payer strength proxy. All data sources are publicly available.
          </p>
        </div>
      </div>
    </div>
  );
}
