import { useState, useRef, useEffect, useMemo } from "react";

// ═══ SYNTHETIC GTM DATASET ═══
// Seeded so the client-side insights match what the server sends to Claude.
function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 11) % 2147483647; return s / 2147483647; };
}

function generateGTMData() {
  const reps = ["Sarah Chen", "Marcus Rivera", "Emily Okafor", "James Patel", "Lisa Wong", "David Kim"];
  const specialties = ["Dermatology", "Orthopedics", "Gastroenterology", "Ophthalmology"];
  const sources = ["Inbound", "Outbound", "Referral", "Trade Show", "Partner"];
  const quarters = ["Q3 2024", "Q4 2024", "Q1 2025"];
  // Specialty-biased outcome probabilities calibrated to Q1 Review's win rates:
  // Derm 34%, Gastro 26%, Ophtho 23%, Ortho 26% baseline / 14% in Q1 2025 due
  // to the legal-review bottleneck. Each cell holds {P(won), P(lost)}; remainder
  // is "open at some stage." Closure rate is ~50% per deal so the win rate of
  // closed deals matches Q1 Review's numbers.
  const OUTCOME = {
    Dermatology:      { won: 0.17, lost: 0.33 }, // 34% win rate of closed
    Gastroenterology: { won: 0.13, lost: 0.37 }, // 26%
    Ophthalmology:    { won: 0.11, lost: 0.39 }, // 23%
    Orthopedics:      { won: 0.13, lost: 0.37 }, // 26% baseline
  };
  const ORTHO_Q1_OUTCOME = { won: 0.07, lost: 0.43 }; // 14% — Q1 2025 legal-review collapse
  const OPEN_STAGES = ["Prospecting", "Qualified", "Demo Scheduled", "Proposal Sent", "Negotiation"];

  const r = seededRandom(42);
  const rand = (min, max) => Math.round((r() * (max - min) + min) * 100) / 100;

  const deals = [];
  for (let i = 0; i < 280; i++) {
    const rep = reps[Math.floor(r() * reps.length)];
    const spec = specialties[Math.floor(r() * specialties.length)];
    const src = sources[Math.floor(r() * sources.length)];
    const q = quarters[Math.floor(r() * quarters.length)];
    const outcomeRoll = r();
    const o = (spec === "Orthopedics" && q === "Q1 2025") ? ORTHO_Q1_OUTCOME : OUTCOME[spec];
    let stage, won, lost;
    if (outcomeRoll < o.won) { stage = "Closed Won"; won = true; lost = false; }
    else if (outcomeRoll < o.won + o.lost) { stage = "Closed Lost"; won = false; lost = true; }
    else {
      const openRoll = (outcomeRoll - o.won - o.lost) / (1 - o.won - o.lost);
      stage = OPEN_STAGES[Math.min(OPEN_STAGES.length - 1, Math.floor(openRoll * OPEN_STAGES.length))];
      won = false; lost = false;
    }
    const acv = Math.round(rand(8000, 185000));
    const daysInPipeline = Math.round(rand(12, 95));
    deals.push({ id: i, rep, specialty: spec, source: src, quarter: q, stage, won, lost, acv, daysInPipeline, practiceSize: ["Solo", "Small", "Medium", "Large"][Math.floor(r() * 4)] });
  }
  const stages = [...OPEN_STAGES, "Closed Won", "Closed Lost"];

  const marketing = quarters.map(q => ({
    quarter: q,
    mqls: Math.round(rand(320, 580)),
    sqls: Math.round(rand(140, 260)),
    demosBooked: Math.round(rand(80, 160)),
    pipelineGenerated: Math.round(rand(1200000, 2800000)),
    spend: Math.round(rand(180000, 350000)),
  }));

  const churn = specialties.map(s => ({
    specialty: s,
    customersStart: Math.round(rand(120, 280)),
    churned: Math.round(rand(5, 22)),
    expanded: Math.round(rand(8, 35)),
    nrr: rand(101, 119),
    topReasons: ["Switched to competitor", "Budget cuts", "Practice closed", "Feature gaps"].slice(0, Math.floor(rand(2, 4))),
  }));

  return { reps, specialties, sources, stages, quarters, deals, marketing, churn };
}

const GTM_DATA = generateGTMData();

// Note: buildDataSummary and system prompt moved to /api/askgtm/route.js (server-side)
// Client only has generateGTMData for the smart insights display

function SmartInsights() {
  const d = GTM_DATA;
  const insights = [];

  const repWins = d.reps.map(r => ({ rep: r, won: d.deals.filter(x => x.rep === r && x.won).length, acv: d.deals.filter(x => x.rep === r && x.won).reduce((a, x) => a + x.acv, 0) })).sort((a, b) => b.acv - a.acv);
  const topRep = repWins[0];

  const q1 = d.deals.filter(x => x.quarter === "Q1 2025");
  const q1Won = q1.filter(x => x.won);
  const q4 = d.deals.filter(x => x.quarter === "Q4 2024");
  const q4Won = q4.filter(x => x.won);
  const revChange = q4Won.length > 0 ? ((q1Won.reduce((a, x) => a + x.acv, 0) - q4Won.reduce((a, x) => a + x.acv, 0)) / q4Won.reduce((a, x) => a + x.acv, 0) * 100).toFixed(1) : 0;

  const bestSpec = d.specialties.map(s => {
    const deals = d.deals.filter(x => x.specialty === s);
    const won = deals.filter(x => x.won);
    const lost = deals.filter(x => x.lost);
    return { spec: s, winRate: won.length / (won.length + lost.length || 1) * 100, count: deals.length };
  }).sort((a, b) => b.winRate - a.winRate)[0];

  const worstChurn = d.churn.sort((a, b) => (b.churned / b.customersStart) - (a.churned / a.customersStart))[0];

  insights.push({ icon: "📈", title: "Q1 vs Q4 Bookings", text: `Won revenue ${Number(revChange) > 0 ? "up" : "down"} ${Math.abs(revChange)}% quarter-over-quarter.` });
  insights.push({ icon: "🏆", title: "Top Producer", text: `${topRep.rep.split(" ")[1]} leads with $${(topRep.acv / 1000).toFixed(0)}K in closed-won ACV (${topRep.won} deals).` });
  insights.push({ icon: "🎯", title: "Best Specialty", text: `${bestSpec.spec} has the highest win rate at ${bestSpec.winRate.toFixed(0)}% across ${bestSpec.count} deals.` });
  insights.push({ icon: "⚠️", title: "Churn Watch", text: `${worstChurn.specialty} has the highest churn at ${(worstChurn.churned / worstChurn.customersStart * 100).toFixed(1)}%. Top reasons: ${worstChurn.topReasons.slice(0, 2).join(", ")}.` });

  return insights;
}

function MiniBar({ data, labels, color, height = 50, width = 200 }) {
  const max = Math.max(...data);
  const barW = width / data.length - 3;
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
        {data.map((v, i) => (
          <rect key={i} x={i * (barW + 3)} y={height - (v / max) * (height - 8)} width={barW} height={(v / max) * (height - 8)} rx={2} fill={color} opacity={0.6 + (i / data.length) * 0.4} />
        ))}
      </svg>
      {labels && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#475569", marginTop: 2 }}>{labels.map(l => <span key={l}>{l}</span>)}</div>}
    </div>
  );
}

export default function AskGTM() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInsights, setShowInsights] = useState(true);
  const chatRef = useRef(null);
  const insights = useMemo(() => SmartInsights(), []);
  // Data and system prompt are server-side only (see /api/askgtm/route.js)
  // Client sends only the question — no data or prompt exposed in browser

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const SAMPLE_QUESTIONS = [
    "What's our win rate by specialty this quarter?",
    "Which reps are below target and what's their pipeline coverage?",
    "Compare marketing-sourced vs outbound pipeline conversion",
    "Show me our churn breakdown by specialty",
    "Who has the longest average sales cycle and why?",
    "What should we prioritize to improve Q2 bookings?",
  ];

  async function handleSend(text) {
    const q = text || input;
    if (!q.trim()) return;
    setInput("");
    setShowInsights(false);
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setLoading(true);

    try {
      const response = await fetch("/api/askgtm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await response.json();
      if (!response.ok) {
        const errMsg = response.status === 429
          ? "Rate limit reached — please wait a moment before asking again."
          : data?.error || "Something went wrong. Please try again.";
        setMessages(prev => [...prev, { role: "assistant", text: errMsg }]);
      } else {
        const reply = data.content?.map(c => c.text || "").join("\n") || "I wasn't able to process that query. Please try rephrasing.";
        setMessages(prev => [...prev, { role: "assistant", text: reply }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", text: "Connection error. In a production deployment, this would query your Salesforce / data warehouse in real-time via SQL generation. The demo requires API connectivity." }]);
    }
    setLoading(false);
  }

  const wonByQ = GTM_DATA.quarters.map(q => GTM_DATA.deals.filter(x => x.quarter === q && x.won).reduce((a, x) => a + x.acv, 0));

  return (
    <div style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", background: "#0b1120", color: "#e2e8f0", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px 16px", borderBottom: "1px solid #1e293b" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <a href="/" style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12 }}
             onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"}
             onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
            ← Portfolio
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: "#fff" }}>A</div>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a78bfa" }}>AskGTM</span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#6366f118", color: "#a78bfa", fontWeight: 600, marginLeft: 4 }}>AI-Powered</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "6px 0 4px" }}>GTM Performance Intelligence</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Ask plain-English questions about pipeline, bookings, rep performance, and churn · Powered by Claude</p>
        </div>
      </div>

      <div style={{ flex: 1, maxWidth: 900, margin: "0 auto", width: "100%", padding: "0 32px", display: "flex", flexDirection: "column" }}>
        {showInsights && (
          <div style={{ padding: "20px 0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Smart Summary — Q1 2025</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {insights.map((ins, i) => (
                <div key={i} style={{ background: "#111b2e", borderRadius: 10, padding: 14, border: "1px solid #1e293b" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{ins.icon} {ins.title}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{ins.text}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#111b2e", borderRadius: 10, padding: 14, border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#475569", marginBottom: 6 }}>Quarterly Won Revenue</div>
              <MiniBar data={wonByQ} labels={GTM_DATA.quarters} color="#6366f1" height={45} width={300} />
            </div>
          </div>
        )}

        <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
              <div style={{
                maxWidth: "75%", padding: "12px 16px", borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: m.role === "user" ? "#6366f1" : "#111b2e",
                color: m.role === "user" ? "#fff" : "#e2e8f0",
                border: m.role === "user" ? "none" : "1px solid #1e293b",
                fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap"
              }}>
                {m.role === "assistant" && <div style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>AskGTM AI</div>}
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
              <div style={{ padding: "12px 16px", borderRadius: "14px 14px 14px 4px", background: "#111b2e", border: "1px solid #1e293b", fontSize: 13, color: "#64748b" }}>
                <span style={{ animation: "pulse 1.5s infinite" }}>Analyzing GTM data...</span>
              </div>
            </div>
          )}
        </div>

        {messages.length === 0 && (
          <div style={{ padding: "0 0 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Try asking</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {SAMPLE_QUESTIONS.map(q => (
                <button key={q} onClick={() => handleSend(q)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #1e293b", background: "#111b2e", color: "#94a3b8", fontSize: 12, cursor: "pointer", textAlign: "left", lineHeight: 1.4, transition: "border-color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#a78bfa"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#1e293b"}
                >{q}</button>
              ))}
            </div>
          </div>
        )}

        <div style={{ padding: "12px 0 24px", borderTop: "1px solid #1e293b" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="Ask about pipeline, win rates, rep performance, churn, marketing ROI..."
              style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: "1px solid #1e293b", background: "#111b2e", color: "#e2e8f0", fontSize: 14, outline: "none" }}
            />
            <button onClick={() => handleSend()} disabled={loading || !input.trim()}
              style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: loading ? "#1e293b" : "#6366f1", color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}
            >{loading ? "..." : "Ask"}</button>
          </div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 6 }}>
            Powered by Claude API · Queries synthetic Salesforce-style GTM data ({GTM_DATA.deals.length} deals, {GTM_DATA.reps.length} reps, {GTM_DATA.specialties.length} specialties)
          </div>
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 11, color: "#64748b", cursor: "pointer", userSelect: "none" }}>
              How this works — architecture & limits
            </summary>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, lineHeight: 1.7, padding: "12px 14px", background: "#0b1120", borderRadius: 8, border: "1px solid #1e293b" }}>
              <p style={{ margin: "0 0 8px" }}>
                <strong style={{ color: "#e2e8f0" }}>Grounding:</strong> The server-side system prompt contains a flattened text summary of the synthetic GTM dataset (deals by rep × specialty × source × quarter, the marketing funnel, churn cohorts). Claude reasons over the summary directly — no tool use, no SQL generation, no vector retrieval. The Smart Insights tiles above use the same seeded dataset client-side so the panel and the assistant stay aligned.
              </p>
              <p style={{ margin: "0 0 8px" }}>
                <strong style={{ color: "#e2e8f0" }}>In production:</strong> this would be a tool-using agent over a governed metric registry (the kind documented in <a href="/northstar" style={{ color: "#6366f1" }}>NorthStar</a>). The assistant would issue queries against live warehouse tables; the metric definitions in the registry would constrain what aggregations and joins it can perform, so two analysts asking the same question always get the same answer. Text prompt-stuffing is a demo simplification, not the recommended pattern.
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: "#e2e8f0" }}>Limits:</strong> Synthetic data only — questions outside the dataset (e.g. "what's our YoY ARR?") will get a polite "I don't have that data" response. Rate-limited to 10 requests per IP per minute. The system prompt lives server-side and never accepts client-supplied overrides.
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
