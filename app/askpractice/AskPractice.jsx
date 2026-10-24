import QueryEvidence from "../QueryEvidence";
import { useState, useRef, useEffect, useMemo } from "react";

import { PRACTICE_DATA } from "../../lib/practice-scenario.mjs";
import { aggregatePractice } from "../../lib/practice-aggregates.mjs";

function SmartInsights() {
  const insights = [];
  
  // Find top performer
  const provTotals = Object.fromEntries(aggregatePractice().providers.map(p => [p.provider, { ...p, rev: p.revenue }]));
  
  const topRev = Object.entries(provTotals).sort((a, b) => b[1].rev - a[1].rev)[0];
  const topCollect = Object.entries(provTotals).sort((a, b) => (b[1].collections / b[1].rev) - (a[1].collections / a[1].rev))[0];
  const mostDenials = Object.entries(provTotals).sort((a, b) => b[1].denials - a[1].denials)[0];
  
  // Recent trend
  const recentRev = aggregatePractice({ monthIndexes: [9,10,11] }).total.revenue;
  const prevRev = aggregatePractice({ monthIndexes: [6,7,8] }).total.revenue;
  const trend = ((recentRev - prevRev) / prevRev * 100).toFixed(1);
  
  insights.push({ icon: "📈", title: "Revenue Trend · Q4 vs Q3 2025", text: `Practice revenue ${Number(trend) > 0 ? "up" : "down"} ${Math.abs(trend)}% in Oct–Dec compared with Jul–Sep 2025.` });
  insights.push({ icon: "🏆", title: "Top Producer · Jan–Dec 2025", text: `${topRev[0].split(" ").pop()} leads in total revenue at $${topRev[1].rev.toLocaleString('en-US')} for 2025.` });
  insights.push({ icon: "💰", title: "Collection / Revenue · Jan–Dec 2025", text: `${topCollect[0].split(" ").pop()} has the highest collections-to-revenue ratio at ${(topCollect[1].collections / topCollect[1].rev * 100).toFixed(1)}%.` });
  insights.push({ icon: "⚠️", title: "Denial Counts · Jan–Dec 2025", text: `${mostDenials[0].split(" ").pop()} has the most denials in 2025 (${mostDenials[1].denials}). Payer-level denial counts and reasons are not included.` });
  
  return insights;
}

function MiniBar({ data, labels, color, height = 60, width = 200 }) {
  const max = Math.max(...data);
  const slot = width / data.length;
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block", width: "100%", height }}>
        {data.map((v, i) => (
          <rect key={i} x={(i + 0.1) * slot} y={height - (v / max) * (height - 8)} width={slot * 0.8} height={(v / max) * (height - 8)} rx={2} fill={color} opacity={0.6 + (i / data.length) * 0.4} />
        ))}
      </svg>
      {labels && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`, fontSize: 9, color: "#475569", marginTop: 2 }}>
          {labels.map((l,i) => <span key={i} style={{ textAlign: "center" }}>{l}</span>)}
        </div>
      )}
    </div>
  );
}

export default function AskPractice() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInsights, setShowInsights] = useState(true);
  const chatRef = useRef(null);
  const insights = useMemo(() => SmartInsights(), []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const SAMPLE_QUESTIONS = [
    "Which provider had the highest collection rate last quarter?",
    "Show me our denial trend by month",
    "Compare revenue across all providers for the last 6 months",
    "What's our payer mix breakdown?",
    "Who has the most no-shows and which months are worst?",
  ];

  async function handleSend(text) {
    const q = text || input;
    if (!q.trim() || loading) return;
    setInput("");
    setShowInsights(false);
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setLoading(true);

    try {
      const response = await fetch("/api/ask", {
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
        setMessages(prev => [...prev, { role: "assistant", text: reply, source: data.source, scope: data.appliedScope, calls: data.toolCalls }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", text: "The practice calculation service could not be reached. Please try again. The synthetic practice summary remains available." }]);
    }
    setLoading(false);
  }

  // Compute some quick chart data
  const monthlyRev = PRACTICE_DATA.months.map((_,i) => aggregatePractice({ monthIndexes: [i] }).total.revenue);
  const monthLabels = PRACTICE_DATA.months.map(m => m.month);

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

            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#34d399" }}>AskPractice</span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#10b98118", color: "#34d399", fontWeight: 600, marginLeft: 4 }}>Synthetic data demo</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "6px 0 4px" }}>Questions about the practice scenario</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Ask about counts, revenue, collections, and ratios for {PRACTICE_DATA.practiceName} · Calculated from the 2025 scenario</p>
        </div>
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, maxWidth: 900, margin: "0 auto", width: "100%", padding: "0 32px", display: "flex", flexDirection: "column" }}>
        
        {/* Smart Insights (shown initially) */}
        {showInsights && (
          <div style={{ padding: "20px 0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Practice Summary — Jan–Dec 2025</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {insights.map((ins, i) => (
                <div key={i} style={{ background: "#111b2e", borderRadius: 10, padding: 14, border: "1px solid #1e293b" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{ins.icon} {ins.title}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{ins.text}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#111b2e", borderRadius: 10, padding: 14, border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#475569", marginBottom: 6 }}>Practice Revenue — 12 Month Trend</div>
              <MiniBar data={monthlyRev} labels={monthLabels} color="#10b981" height={50} width={400} />
            </div>
          </div>
        )}

        {/* Chat messages */}
        <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
              <div style={{
                maxWidth: "75%", padding: "12px 16px", borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: m.role === "user" ? "#10b981" : "#111b2e",
                color: m.role === "user" ? "#fff" : "#e2e8f0",
                border: m.role === "user" ? "none" : "1px solid #1e293b",
                fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap"
              }}>
                {m.role === "assistant" && <div style={{ fontSize: 10, fontWeight: 700, color: "#34d399", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.source === "validated-query" ? "Calculated result" : m.source === "query-clarification" ? "Clarification needed" : "Service message"}</div>}
                {m.text}
                {m.role === "assistant" && <QueryEvidence scope={m.scope} calls={m.calls} />}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
              <div style={{ padding: "12px 16px", borderRadius: "14px 14px 14px 4px", background: "#111b2e", border: "1px solid #1e293b", fontSize: 13, color: "#64748b" }}>
                <span style={{ animation: "pulse 1.5s infinite" }}>Interpreting and calculating...</span>
              </div>
            </div>
          )}
        </div>

        {/* Sample questions */}
        {messages.length === 0 && (
          <div style={{ padding: "0 0 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Try asking</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {SAMPLE_QUESTIONS.map(q => (
                <button key={q} disabled={loading} onClick={() => handleSend(q)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #1e293b", background: "#111b2e", color: "#94a3b8", fontSize: 12, cursor: "pointer", textAlign: "left", lineHeight: 1.4, transition: "border-color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#34d399"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#1e293b"}
                >{q}</button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: "12px 0 24px", borderTop: "1px solid #1e293b" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input aria-label="Question about the practice scenario" disabled={loading} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="Ask about revenue, denials, provider performance, payer mix..."
              style={{ flex: 1, minWidth: 0, padding: "12px 16px", borderRadius: 10, border: "1px solid #1e293b", background: "#111b2e", color: "#e2e8f0", fontSize: 14, outline: "none" }}
            />
            <button onClick={() => handleSend()} disabled={loading || !input.trim()}
              style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: loading ? "#1e293b" : "#10b981", color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", transition: "background 0.15s" }}
            >{loading ? "..." : "Ask"}</button>
          </div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 6 }}>
            Synthetic 2025 scenario · {PRACTICE_DATA.providers.length} providers · {PRACTICE_DATA.payers.length} payers · 12 months
          </div>
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 11, color: "#64748b", cursor: "pointer", userSelect: "none" }}>
              How this works: data and limits
            </summary>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, lineHeight: 1.7, padding: "12px 14px", background: "#0b1120", borderRadius: 8, border: "1px solid #1e293b" }}>
              <p style={{ margin: "0 0 8px" }}>
                <strong style={{ color: "#e2e8f0" }}>Calculations:</strong> Claude translates the question into a structured query tool call; the server validates and calculates it from the same synthetic records as the summary cards and revenue chart. Measures include revenue, collections, denial and no-show counts, patient counts, procedure counts, payer revenue/mix, average reimbursement, and the collections-to-revenue ratio. Provider filters and 2025 month, quarter, half-year, or inclusive month ranges are supported. Relative periods end in Dec 2025. Numeric thresholds filter the calculated groups before ranking. Monthly and quarterly groupings are explicit, including rankings within each period. Unknown scopes ask for clarification; no model-written arithmetic is displayed. Inspect the applied query beneath each answer.
              </p>
              <p style={{ margin: "0 0 8px" }}>
                <strong style={{ color: "#e2e8f0" }}>Definitions:</strong> Collections / revenue divides the summed amounts for the selected period; it is not an average of monthly rates. Average reimbursement is an unweighted mean of the supplied provider-month averages. Patient totals sum monthly counts and do not identify unique patients across months. Measures can be compared by provider and period. Payer data contains revenue only; procedure data contains counts only. Revenue by procedure and joint payer/procedure breakdowns are unavailable. Independent totals can be requested together without implying a link between them.
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: "#e2e8f0" }}>Limits:</strong> No patient records, claim denominators, scheduled-appointment counts, denial reasons, or payment allocation are supplied. Denial and no-show rates cannot be calculated. Revenue and collection amounts are generated independently, so their ratio does not establish payment timing or a cause. Do not enter patient information. Each question is independent of earlier chat turns.
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
