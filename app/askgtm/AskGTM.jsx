import QueryEvidence from "../QueryEvidence";
import { useState, useRef, useEffect, useMemo } from "react";

import { GTM_DATA, qbr, pct, CURRENT_QUARTER } from "../../lib/gtm-scenario.mjs";

function SmartInsights() {
  const rep = [...qbr.reps].sort((a, b) => b.bookings - a.bookings)[0];
  const spec = [...qbr.specialties].sort((a, b) => b.winRate - a.winRate)[0];
  const churn = [...qbr.churn].sort((a, b) => b.churned / b.customersStart - a.churned / a.customersStart)[0];
  const change = (qbr.current.bookings / qbr.prior.bookings - 1) * 100;
  const insights = [
    { title: "Bookings vs Q4", text: `Won ACV ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)}% in ${CURRENT_QUARTER}.` },
    { title: "Highest booked ACV", text: `${rep.name.split(" ").at(-1)}: $${(rep.bookings / 1000).toFixed(0)}K across ${rep.wins} wins in Q1.` },
    { title: "Highest specialty win rate", text: `${spec.name}: ${pct(spec.winRate)}, ${spec.wins} wins from ${spec.closed} closed opportunities in Q1.` },
    { title: "Highest customer churn", text: `${churn.specialty}: ${pct(churn.churned / churn.customersStart)}, ${churn.churned} of ${churn.customersStart} starting customers. Reasons are not included.` },
  ];
  return insights;
}

function MiniBar({ data, labels, color, height = 50, width = 200 }) {
  const max = Math.max(...data);
  const barW = width / data.length - 3;
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", maxWidth: width, height }}>
        {data.map((v, i) => (
          <rect key={i} x={i * (barW + 3)} y={height - (v / max) * (height - 8)} width={barW} height={(v / max) * (height - 8)} rx={2} fill={color} opacity={0.6 + (i / data.length) * 0.4} />
        ))}
      </svg>
      {labels && <div style={{ display: "grid", gridTemplateColumns: `repeat(${labels.length}, 1fr)`, fontSize: 11, color: "#aab5c5", maxWidth: width, textAlign: "center", marginTop: 4 }}>{labels.map(l => <span key={l}>{l}</span>)}</div>}
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
  // The synthetic scenario is public. Only the system prompt and credentials stay server-side.

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const SAMPLE_QUESTIONS = [
    "What's our win rate by specialty this quarter?",
    "Which reps are below target and what's their pipeline coverage?",
    "Compare closed-cohort win rates by source in Q1",
    "Show me our churn breakdown by specialty",
    "Who has the longest average sales cycle and why?",
    "What should we prioritize to improve Q2 bookings?",
  ];

  async function handleSend(text) {
    const q = text || input;
    if (!q.trim() || loading) return;
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
        setMessages(prev => [...prev, { role: "assistant", text: reply, source: data.source, scope: data.appliedScope, calls: data.toolCalls, details: data.calculationDetails }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", text: "The model service could not be reached. Please try again. The summary and QBR remain available." }]);
    }
    setLoading(false);
  }

  const wonByQ = GTM_DATA.quarters.map(q => GTM_DATA.deals.filter(x => x.quarter === q && x.won).reduce((a, x) => a + x.acv, 0));

  return (
    <div className="demo-page" style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", background: "#0b1120", color: "#e2e8f0", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px 16px", borderBottom: "1px solid #1e293b" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <a href="/" style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12 }}
             onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"}
             onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
            ← Portfolio
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>

            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a78bfa" }}>AskGTM</span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#6366f118", color: "#a78bfa", fontWeight: 600, marginLeft: 4 }}>Synthetic data demo</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "6px 0 4px" }}>Questions about the GTM scenario</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Ask about pipeline, bookings, rep comparisons, and retention in the same synthetic scenario as the QBR.</p>
        </div>
      </div>

      <div style={{ flex: 1, maxWidth: 900, margin: "0 auto", width: "100%", padding: "0 32px", display: "flex", flexDirection: "column" }}>
        {showInsights && (
          <div style={{ padding: "20px 0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Scenario summary — Q1 2025</div>
            <div className="demo-summary" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {insights.map((ins, i) => (
                <div key={i} style={{ background: "#111b2e", borderRadius: 10, padding: 14, border: "1px solid #1e293b" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{ins.title}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{ins.text}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#111b2e", borderRadius: 10, padding: 14, border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#475569", marginBottom: 6 }}>Quarterly won ACV</div>
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
                {m.role === "assistant" && <div style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.source === "validated-query" ? "Calculated result" : m.source === "query-clarification" ? "Clarification needed" : "Service message"}</div>}
                {m.text}
                {m.role === "assistant" && <QueryEvidence scope={m.scope} calls={m.calls} details={m.details} />}
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
                <button key={q} disabled={loading} onClick={() => handleSend(q)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #1e293b", background: "#111b2e", color: "#94a3b8", fontSize: 12, cursor: "pointer", textAlign: "left", lineHeight: 1.4, transition: "border-color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#a78bfa"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#1e293b"}
                >{q}</button>
              ))}
            </div>
          </div>
        )}

        <div style={{ padding: "12px 0 24px", borderTop: "1px solid #1e293b" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input aria-label="Question about the GTM scenario" disabled={loading} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="Ask about the synthetic GTM scenario…"
              style={{ flex: 1, minWidth: 0, padding: "12px 16px", borderRadius: 10, border: "1px solid #1e293b", background: "#111b2e", color: "#e2e8f0", fontSize: 14, outline: "none" }}
            />
            <button onClick={() => handleSend()} disabled={loading || !input.trim()}
              style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: loading ? "#1e293b" : "#6366f1", color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}
            >{loading ? "..." : "Ask"}</button>
          </div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 6 }}>
            Claude query tools · Synthetic scenario shared with the QBR ({GTM_DATA.deals.length} deals, {GTM_DATA.reps.length} reps, {GTM_DATA.specialties.length} specialties)
          </div>
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 11, color: "#64748b", cursor: "pointer", userSelect: "none" }}>
              How this works — architecture & limits
            </summary>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, lineHeight: 1.7, padding: "12px 14px", background: "#0b1120", borderRadius: 8, border: "1px solid #1e293b" }}>
              <p style={{ margin: "0 0 8px" }}>
                <strong style={{ color: "#e2e8f0" }}>Grounding:</strong> Claude translates each question into a structured tool call. The server validates its period, filters, grouping, threshold and ranking, then calculates and formats the answer from the same synthetic records as the QBR. No model-written numerical answer is displayed. There is no live CRM or warehouse connection.
              </p>
              <p style={{ margin: "0 0 8px" }}>
                <strong style={{ color: "#e2e8f0" }}>Evidence:</strong> Each answer shows its applied query and executed server tool. Questions are independent of earlier chat turns. QBR rollups, rep shortfalls, retention ratios and cohort denominators are calculated in code. Interpretation can still be ambiguous; inspect the applied filters and compare figures with the <a href="/q1-review">QBR</a>.
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: "#e2e8f0" }}>Limits:</strong> No legal-review dates, activity history, loss reasons or causal experiments are supplied. Unsupported measures and invalid tool inputs request clarification. Incomplete model responses are never shown as numerical answers. Requests are rate limited; API connectivity is required.
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
