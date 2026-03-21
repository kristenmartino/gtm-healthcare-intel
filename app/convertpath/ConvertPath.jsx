import { useState, useMemo, useEffect } from "react";

function seededRandom(seed) { let s = seed; return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; }; }

const STAGES = ["Lead", "Qualified", "Demo", "Proposal", "Negotiation", "Closed Won"];
const SOURCES = ["Trade Show", "Inbound", "Outbound", "Referral", "Partner"];
const SPECIALTIES = ["Dermatology", "Orthopedics", "Gastroenterology", "Ophthalmology", "All"];
const SIZES = ["Solo", "Small (2-5)", "Medium (6-15)", "Large (16+)", "All"];
const QUARTERS = ["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025"];

function generatePipeline() {
  const r = seededRandom(42);
  const deals = [];
  const stageProbs = { "Trade Show": [1, 0.52, 0.68, 0.55, 0.72, 0.78], Inbound: [1, 0.48, 0.62, 0.50, 0.68, 0.74], Outbound: [1, 0.32, 0.55, 0.48, 0.60, 0.65], Referral: [1, 0.62, 0.75, 0.65, 0.80, 0.85], Partner: [1, 0.55, 0.70, 0.58, 0.74, 0.80] };
  const avgDays = [0, 8, 14, 12, 18, 10];
  const specs = SPECIALTIES.slice(0, 4);
  const sizes = SIZES.slice(0, 4);

  for (let i = 0; i < 600; i++) {
    const source = SOURCES[Math.floor(r() * SOURCES.length)];
    const spec = specs[Math.floor(r() * specs.length)];
    const sz = sizes[Math.floor(r() * sizes.length)];
    const qIdx = Math.floor(r() * 4);
    const probs = stageProbs[source];
    let reached = 0;
    for (let s = 1; s < STAGES.length; s++) {
      if (r() < probs[s]) reached = s; else break;
    }
    const won = reached === 5;
    const lost = !won && reached > 0;
    const lostAt = lost ? STAGES[reached + 1 < 6 ? reached + 1 : reached] : null;
    const days = [];
    for (let s = 0; s <= reached; s++) days.push(Math.round(avgDays[s] * (0.6 + r() * 0.8)));
    const totalDays = days.reduce((a, b) => a + b, 0);
    const acv = Math.round((sz === "Solo" ? 12000 : sz === "Small (2-5)" ? 28000 : sz === "Medium (6-15)" ? 65000 : 145000) * (0.7 + r() * 0.6));

    deals.push({ id: i, source, specialty: spec, size: sz, quarter: QUARTERS[qIdx], stageReached: reached, won, lost, lostAtStage: lostAt, daysInPipeline: totalDays, stageDays: days, acv });
  }
  return deals;
}

const ALL_DEALS = generatePipeline();

function FunnelBar({ label, count, total, prevCount, value, color, maxWidth }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const convRate = prevCount > 0 ? ((count / prevCount) * 100).toFixed(1) : "—";
  const w = total > 0 ? (count / total) * maxWidth : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 6 }}>
      <div style={{ width: 100, fontSize: 12, fontWeight: 600, textAlign: "right", color: "#94a3b8" }}>{label}</div>
      <div style={{ flex: 1, position: "relative", height: 36 }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: `${(w / maxWidth) * 100}%`, height: "100%", background: color, borderRadius: 6, transition: "width 0.5s cubic-bezier(0.22,1,0.36,1)", minWidth: count > 0 ? 4 : 0 }} />
        <div style={{ position: "absolute", left: `${(w / maxWidth) * 100 + 1}%`, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", color: "#e2e8f0" }}>
          {count} <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>({pct.toFixed(1)}%)</span>
        </div>
      </div>
      <div style={{ width: 70, textAlign: "right", fontSize: 12, fontWeight: 600, color: convRate === "—" ? "#475569" : "#38bdf8" }}>
        {convRate === "—" ? "—" : `${convRate}%`}
      </div>
      <div style={{ width: 80, textAlign: "right", fontSize: 12, fontWeight: 600, color: "#10b981" }}>
        ${(value / 1000).toFixed(0)}K
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{ background: "#111b2e", borderRadius: 10, padding: "16px 18px", border: "1px solid #1e293b" }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || "#e2e8f0", marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function ConvertPath() {
  const [specialty, setSpecialty] = useState("All");
  const [source, setSource] = useState("All");
  const [quarter, setQuarter] = useState("All");
  const [tab, setTab] = useState("funnel");
  const [dealScores, setDealScores] = useState([]);

  useEffect(() => {
    fetch("/deal_scores.json")
      .then(r => r.json())
      .then(data => setDealScores(data))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return ALL_DEALS.filter(d =>
      (specialty === "All" || d.specialty === specialty) &&
      (source === "All" || d.source === source) &&
      (quarter === "All" || d.quarter === quarter)
    );
  }, [specialty, source, quarter]);

  const funnelData = useMemo(() => {
    return STAGES.map((s, i) => {
      const count = filtered.filter(d => d.stageReached >= i).length;
      const value = filtered.filter(d => d.stageReached >= i).reduce((a, d) => a + d.acv, 0);
      return { stage: s, count, value };
    });
  }, [filtered]);

  const totalLeads = funnelData[0].count;
  const wonDeals = filtered.filter(d => d.won);
  const winRate = totalLeads > 0 ? ((wonDeals.length / totalLeads) * 100).toFixed(1) : "0";
  const avgCycle = wonDeals.length > 0 ? Math.round(wonDeals.reduce((a, d) => a + d.daysInPipeline, 0) / wonDeals.length) : 0;
  const totalACV = wonDeals.reduce((a, d) => a + d.acv, 0);
  const avgACV = wonDeals.length > 0 ? Math.round(totalACV / wonDeals.length) : 0;

  const leakyStage = useMemo(() => {
    let worst = { stage: "", drop: 0 };
    for (let i = 1; i < funnelData.length; i++) {
      const drop = funnelData[i - 1].count - funnelData[i].count;
      if (drop > worst.drop) worst = { stage: `${STAGES[i - 1]} → ${STAGES[i]}`, drop, rate: funnelData[i - 1].count > 0 ? ((drop / funnelData[i - 1].count) * 100).toFixed(1) : 0 };
    }
    return worst;
  }, [funnelData]);

  const sourceBreakdown = useMemo(() => {
    return SOURCES.map(src => {
      const deals = filtered.filter(d => d.source === src);
      const won = deals.filter(d => d.won);
      return { source: src, total: deals.length, won: won.length, winRate: deals.length > 0 ? ((won.length / deals.length) * 100).toFixed(1) : "0", avgDays: won.length > 0 ? Math.round(won.reduce((a, d) => a + d.daysInPipeline, 0) / won.length) : 0, acv: won.reduce((a, d) => a + d.acv, 0) };
    }).sort((a, b) => b.won - a.won);
  }, [filtered]);

  const colors = ["#38bdf8", "#22d3ee", "#2dd4bf", "#34d399", "#a3e635", "#fbbf24"];

  return (
    <div style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", background: "#0b1120", color: "#e2e8f0", minHeight: "100vh" }}>
      <div style={{ padding: "28px 32px 0", maxWidth: 1100, margin: "0 auto" }}>
        <a href="/" style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12 }}
           onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"}
           onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
          ← Portfolio
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff" }}>C</div>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a78bfa" }}>ConvertPath</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "8px 0 4px", letterSpacing: "-0.01em" }}>GTM Sales Funnel & Cohort Analyzer</h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px" }}>Synthetic healthcare SaaS pipeline · {ALL_DEALS.length} deals · Stage conversion, velocity, and leaky bucket diagnostics</p>

        {/* Filters */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          {[
            { label: "Specialty", opts: ["All", ...SPECIALTIES.slice(0, 4)], val: specialty, set: setSpecialty },
            { label: "Source", opts: ["All", ...SOURCES], val: source, set: setSource },
            { label: "Quarter", opts: ["All", ...QUARTERS], val: quarter, set: setQuarter },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#475569", marginBottom: 4 }}>{f.label}</div>
              <select value={f.val} onChange={e => f.set(e.target.value)} style={{ background: "#111b2e", color: "#e2e8f0", border: "1px solid #1e293b", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 600 }}>
                {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {[["funnel", "Funnel"], ["source", "By Source"], ["velocity", "Velocity"], ["health", "Deal Health"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: tab === k ? "#6366f120" : "transparent", color: tab === k ? "#a78bfa" : "#64748b", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px 48px" }}>
        {/* KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
          <MetricCard label="Total Leads" value={totalLeads} />
          <MetricCard label="Win Rate" value={`${winRate}%`} color={Number(winRate) >= 15 ? "#10b981" : "#f59e0b"} />
          <MetricCard label="Avg Cycle" value={`${avgCycle}d`} sub="lead to close" />
          <MetricCard label="Avg ACV" value={`$${(avgACV / 1000).toFixed(0)}K`} color="#38bdf8" />
          <MetricCard label="Leaky Stage" value={leakyStage.stage.split(" → ")[1] || "—"} sub={`${leakyStage.rate}% drop-off`} color="#ef4444" />
        </div>

        {tab === "funnel" && (
          <div style={{ background: "#111b2e", borderRadius: 12, border: "1px solid #1e293b", padding: 24 }}>
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div style={{ width: 100 }} />
              <div style={{ flex: 1, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#475569" }}>Volume & Conversion</div>
              <div style={{ width: 70, textAlign: "right", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#475569" }}>Conv %</div>
              <div style={{ width: 80, textAlign: "right", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#475569" }}>Pipeline $</div>
            </div>
            {funnelData.map((d, i) => (
              <FunnelBar key={d.stage} label={d.stage} count={d.count} total={funnelData[0].count} prevCount={i > 0 ? funnelData[i - 1].count : d.count} value={d.value} color={colors[i]} maxWidth={500} />
            ))}
            <div style={{ marginTop: 20, padding: 16, background: "#0b1120", borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", marginBottom: 6 }}>Leaky Bucket Diagnostic</div>
              <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.6 }}>
                Biggest drop-off: <strong style={{ color: "#e2e8f0" }}>{leakyStage.stage}</strong> — losing {leakyStage.drop} deals ({leakyStage.rate}% attrition). This stage represents the highest-leverage improvement opportunity. Reducing attrition here by even 10% would yield an estimated ${Math.round(leakyStage.drop * 0.1 * avgACV / 1000)}K in additional pipeline.
              </p>
            </div>
          </div>
        )}

        {tab === "source" && (
          <div style={{ background: "#111b2e", borderRadius: 12, border: "1px solid #1e293b", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e293b" }}>
                  {["Source","Leads","Won","Win Rate","Avg Cycle","Won ACV"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "right", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#475569" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sourceBreakdown.map(s => (
                  <tr key={s.source} style={{ borderBottom: "1px solid #1e293b" }}>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>{s.source}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>{s.total}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "#10b981" }}>{s.won}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: Number(s.winRate) >= 20 ? "#10b981" : "#f59e0b" }}>{s.winRate}%</td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>{s.avgDays}d</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "#38bdf8" }}>${(s.acv / 1000).toFixed(0)}K</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "velocity" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {SIZES.slice(0, 4).map(sz => {
                const d = filtered.filter(x => x.size === sz && x.won);
                const avg = d.length > 0 ? Math.round(d.reduce((a, x) => a + x.daysInPipeline, 0) / d.length) : 0;
                const avgAcv = d.length > 0 ? Math.round(d.reduce((a, x) => a + x.acv, 0) / d.length) : 0;
                return (
                  <div key={sz} style={{ background: "#111b2e", borderRadius: 10, padding: 18, border: "1px solid #1e293b" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>{sz} Practice</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8 }}>
                      <div><div style={{ fontSize: 28, fontWeight: 800, color: "#e2e8f0" }}>{avg}d</div><div style={{ fontSize: 11, color: "#64748b" }}>avg cycle</div></div>
                      <div style={{ textAlign: "right" }}><div style={{ fontSize: 18, fontWeight: 700, color: "#38bdf8" }}>${(avgAcv / 1000).toFixed(0)}K</div><div style={{ fontSize: 11, color: "#64748b" }}>avg ACV</div></div>
                    </div>
                    <div style={{ width: "100%", height: 6, background: "#1e293b", borderRadius: 3, marginTop: 10 }}>
                      <div style={{ width: `${Math.min(100, (avg / 80) * 100)}%`, height: "100%", background: avg > 55 ? "#ef4444" : avg > 40 ? "#f59e0b" : "#10b981", borderRadius: 3, transition: "width 0.4s" }} />
                    </div>
                  </div>
                );
              })}
              {/* Weighted pipeline forecast */}
              {(() => {
                const stageWeights = [0.05, 0.15, 0.30, 0.50, 0.75, 1.0];
                const openDeals = filtered.filter(d => !d.won && !d.lost);
                const weighted = openDeals.reduce((a, d) => a + d.acv * stageWeights[d.stageReached], 0);
                return (
                  <div style={{ background: "#111b2e", borderRadius: 10, padding: 18, border: "1px solid #6366f140" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#a78bfa" }}>Weighted Pipeline Forecast</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#a78bfa", marginTop: 8 }}>${(weighted / 1000).toFixed(0)}K</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>based on stage-weighted probability</div>
                  </div>
                );
              })()}
              <MetricCard label="Total Won Revenue" value={`$${(totalACV / 1000000).toFixed(1)}M`} color="#10b981" sub={`${wonDeals.length} closed deals`} />
            </div>
          </div>
        )}

        {tab === "health" && (
          <div>
            {dealScores.length === 0 ? (
              <div style={{ background: "#111b2e", borderRadius: 12, padding: 24, border: "1px solid #1e293b", textAlign: "center" }}>
                <div style={{ fontSize: 14, color: "#64748b" }}>Loading deal scores from ML pipeline...</div>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                  {[
                    { tier: "Strong", color: "#10b981", icon: "●" },
                    { tier: "On Track", color: "#38bdf8", icon: "●" },
                    { tier: "Needs Attention", color: "#f59e0b", icon: "▲" },
                    { tier: "At Risk", color: "#ef4444", icon: "▼" },
                  ].map(t => {
                    const deals = dealScores.filter(d => d.risk_tier === t.tier);
                    const acv = deals.reduce((a, d) => a + d.acv, 0);
                    return (
                      <div key={t.tier} style={{ background: "#111b2e", borderRadius: 10, padding: 16, border: `1px solid ${t.color}30` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: t.color }}>{t.icon} {t.tier}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: "#e2e8f0", marginTop: 4 }}>{deals.length}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>${(acv / 1000).toFixed(0)}K pipeline</div>
                      </div>
                    );
                  })}
                </div>

                {/* Model info bar */}
                <div style={{ fontSize: 11, color: "#475569", padding: "8px 12px", background: "#111b2e", borderRadius: 6, border: "1px solid #1e293b", marginBottom: 16, display: "flex", gap: 16 }}>
                  <span><span style={{ color: "#a78bfa" }}>●</span> Model: Logistic Regression (L2)</span>
                  <span>Features: engagement recency, stage stall, source, rep skill, ACV</span>
                  <span>Scored: {dealScores.length} open deals</span>
                </div>

                {/* Deal table */}
                <div style={{ background: "#111b2e", borderRadius: 12, border: "1px solid #1e293b", overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 0.7fr 0.6fr 0.5fr 0.6fr 0.4fr 1.2fr", padding: "12px 16px", borderBottom: "1px solid #1e293b", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#475569" }}>
                    <span>Account</span><span>Rep</span><span>Specialty</span><span style={{ textAlign: "right" }}>ACV</span><span style={{ textAlign: "right" }}>Stage</span><span style={{ textAlign: "center" }}>Score</span><span>Recommendation</span>
                  </div>
                  {[...dealScores].sort((a, b) => a.deal_health_score - b.deal_health_score).map((d, i) => {
                    const tc = d.risk_tier === "At Risk" ? "#ef4444" : d.risk_tier === "Needs Attention" ? "#f59e0b" : d.risk_tier === "On Track" ? "#38bdf8" : "#10b981";
                    return (
                      <div key={d.deal_id} style={{
                        display: "grid", gridTemplateColumns: "1fr 0.7fr 0.6fr 0.5fr 0.6fr 0.4fr 1.2fr", padding: "10px 16px", borderBottom: "1px solid #1e293b",
                        background: d.risk_tier === "At Risk" ? "#ef444408" : "transparent", alignItems: "center",
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{d.account_name.length > 28 ? d.account_name.slice(0, 28) + "..." : d.account_name}</div>
                          <div style={{ fontSize: 10, color: "#475569" }}>{d.deal_id}</div>
                        </div>
                        <span style={{ fontSize: 12 }}>{d.rep.split(" ")[1]}</span>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>{d.specialty}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, textAlign: "right" }}>${(d.acv / 1000).toFixed(0)}K</span>
                        <span style={{ fontSize: 11, textAlign: "right", color: "#94a3b8" }}>{d.stage}</span>
                        <div style={{ textAlign: "center" }}>
                          <span style={{ display: "inline-block", width: 32, height: 22, lineHeight: "22px", borderRadius: 4, fontSize: 12, fontWeight: 800, textAlign: "center", background: tc + "20", color: tc }}>{d.deal_health_score}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
                          {d.recommendations[0]}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Model methodology note */}
                <div style={{ marginTop: 16, padding: 14, background: "#111b2e", borderRadius: 8, border: "1px solid #1e293b" }}>
                  <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.6, margin: 0 }}>
                    <strong style={{ color: "#a78bfa" }}>Model:</strong> L2-regularized logistic regression trained on 800 historical deals (640 train / 160 test). Features: engagement recency, stage stall duration, source channel, rep performance index, deal size, champion status, competitor presence, legal review duration, plus derived velocity and flag features. Scored pipeline loaded from <code style={{ color: "#10b981", background: "#0b1120", padding: "1px 4px", borderRadius: 3 }}>deal_scoring_model.py</code> output. In production, model would retrain weekly on fresh Salesforce data.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
