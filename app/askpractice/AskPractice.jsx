import { useState, useRef, useEffect, useMemo } from "react";

// Synthetic practice data for a multi-provider dermatology group
function generatePracticeData() {
  const providers = ["Dr. Sarah Chen", "Dr. Marcus Rivera", "Dr. Emily Okafor", "Dr. James Patel", "Dr. Lisa Wong"];
  const payers = ["Blue Cross", "Aetna", "UnitedHealth", "Medicare", "Cigna", "Self-Pay"];
  const months = [];
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  
  const rand = (min, max) => Math.round((Math.random() * (max - min) + min) * 100) / 100;
  
  for (let m = 0; m < 12; m++) {
    const monthData = { month: monthNames[m], year: 2025, providers: {} };
    providers.forEach(p => {
      const base = p.includes("Chen") ? 1.1 : p.includes("Rivera") ? 0.95 : p.includes("Okafor") ? 1.05 : p.includes("Patel") ? 0.88 : 1.0;
      const seasonal = 1 + 0.08 * Math.sin((m - 3) * Math.PI / 6);
      monthData.providers[p] = {
        patients: Math.round(rand(140, 210) * base * seasonal),
        revenue: Math.round(rand(85000, 145000) * base * seasonal),
        collections: Math.round(rand(78000, 135000) * base * seasonal),
        denials: Math.round(rand(8, 28) * (2 - base)),
        noShows: Math.round(rand(6, 18) / base),
        avgReimb: Math.round(rand(245, 380) * base),
        procedures: {
          "Mohs Surgery": Math.round(rand(8, 22) * base),
          "Biopsy": Math.round(rand(35, 65) * base * seasonal),
          "Lesion Destruction": Math.round(rand(20, 45) * base),
          "E&M Visit": Math.round(rand(80, 140) * base * seasonal),
          "Cosmetic Consult": Math.round(rand(5, 18) * base),
        },
        payerMix: {}
      };
      let remaining = monthData.providers[p].revenue;
      payers.forEach((pay, i) => {
        const share = pay === "Medicare" ? rand(0.2, 0.3) : pay === "Blue Cross" ? rand(0.18, 0.25) : pay === "Self-Pay" ? rand(0.05, 0.1) : rand(0.08, 0.18);
        const amt = i === payers.length - 1 ? remaining : Math.round(remaining * share);
        monthData.providers[p].payerMix[pay] = Math.min(amt, remaining);
        remaining -= monthData.providers[p].payerMix[pay];
      });
    });
    months.push(monthData);
  }
  return { practiceName: "Advanced Dermatology Associates", providers, payers, months };
}

const PRACTICE_DATA = generatePracticeData();

function buildDataSummary() {
  const d = PRACTICE_DATA;
  const lines = [`Practice: ${d.practiceName}`, `Providers: ${d.providers.join(", ")}`, `Payers: ${d.payers.join(", ")}`, `Period: Jan 2025 - Dec 2025`, ``, `Monthly Performance Data:`];
  
  d.months.forEach(m => {
    lines.push(`\n--- ${m.month} ${m.year} ---`);
    Object.entries(m.providers).forEach(([prov, data]) => {
      lines.push(`${prov}: ${data.patients} patients, $${data.revenue.toLocaleString()} revenue, $${data.collections.toLocaleString()} collected, ${data.denials} denials, ${data.noShows} no-shows, $${data.avgReimb} avg reimb`);
      lines.push(`  Procedures: ${Object.entries(data.procedures).map(([k,v]) => `${k}: ${v}`).join(", ")}`);
      lines.push(`  Payer Mix: ${Object.entries(data.payerMix).map(([k,v]) => `${k}: $${v.toLocaleString()}`).join(", ")}`);
    });
  });
  return lines.join("\n");
}

function SmartInsights() {
  const d = PRACTICE_DATA;
  const insights = [];
  
  // Find top performer
  const provTotals = {};
  d.providers.forEach(p => { provTotals[p] = { rev: 0, patients: 0, collections: 0, denials: 0 }; });
  d.months.forEach(m => {
    Object.entries(m.providers).forEach(([p, data]) => {
      provTotals[p].rev += data.revenue;
      provTotals[p].patients += data.patients;
      provTotals[p].collections += data.collections;
      provTotals[p].denials += data.denials;
    });
  });
  
  const topRev = Object.entries(provTotals).sort((a, b) => b[1].rev - a[1].rev)[0];
  const topCollect = Object.entries(provTotals).sort((a, b) => (b[1].collections / b[1].rev) - (a[1].collections / a[1].rev))[0];
  const mostDenials = Object.entries(provTotals).sort((a, b) => b[1].denials - a[1].denials)[0];
  
  // Recent trend
  const last3 = d.months.slice(-3);
  const prev3 = d.months.slice(-6, -3);
  const recentRev = last3.reduce((a, m) => a + Object.values(m.providers).reduce((b, p) => b + p.revenue, 0), 0);
  const prevRev = prev3.reduce((a, m) => a + Object.values(m.providers).reduce((b, p) => b + p.revenue, 0), 0);
  const trend = ((recentRev - prevRev) / prevRev * 100).toFixed(1);
  
  insights.push({ icon: "📈", title: "Revenue Trend", text: `Practice revenue ${Number(trend) > 0 ? "up" : "down"} ${Math.abs(trend)}% over the last quarter vs. prior quarter.` });
  insights.push({ icon: "🏆", title: "Top Producer", text: `${topRev[0].split(" ").pop()} leads in total revenue at $${(topRev[1].rev / 1000).toFixed(0)}K YTD.` });
  insights.push({ icon: "💰", title: "Best Collection Rate", text: `${topCollect[0].split(" ").pop()} has the highest collection rate at ${(topCollect[1].collections / topCollect[1].rev * 100).toFixed(1)}%.` });
  insights.push({ icon: "⚠️", title: "Denial Alert", text: `${mostDenials[0].split(" ").pop()} has the most denials YTD (${mostDenials[1].denials}). Review payer-specific rejection patterns.` });
  
  return insights;
}

function MiniBar({ data, labels, color, height = 60, width = 200 }) {
  const max = Math.max(...data);
  const barW = width / data.length - 3;
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
        {data.map((v, i) => (
          <rect key={i} x={i * (barW + 3)} y={height - (v / max) * (height - 8)} width={barW} height={(v / max) * (height - 8)} rx={2} fill={color} opacity={0.6 + (i / data.length) * 0.4} />
        ))}
      </svg>
      {labels && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#475569", marginTop: 2 }}>
          {labels.map(l => <span key={l}>{l}</span>)}
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

  const dataSummary = useMemo(() => buildDataSummary(), []);

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
    if (!q.trim()) return;
    setInput("");
    setShowInsights(false);
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setLoading(true);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `You are a healthcare practice analytics assistant for "${PRACTICE_DATA.practiceName}", a multi-provider dermatology practice. You answer questions about practice performance using the data provided. Be concise, specific, and use exact numbers. Format currency with $ and commas. When comparing providers, use their last names only. If asked to "show" data, describe the key numbers clearly. Always end with one actionable insight or recommendation.\n\nPRACTICE DATA:\n${dataSummary}`,
          messages: [{ role: "user", content: q }],
        }),
      });
      const data = await response.json();
      const reply = data.content?.map(c => c.text || "").join("\n") || "I wasn't able to process that query. Please try rephrasing.";
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", text: "Connection error. In a production deployment, this would query your practice database in real-time. The demo requires API connectivity." }]);
    }
    setLoading(false);
  }

  // Compute some quick chart data
  const monthlyRev = PRACTICE_DATA.months.map(m => Object.values(m.providers).reduce((a, p) => a + p.revenue, 0));
  const monthLabels = PRACTICE_DATA.months.map(m => m.month);

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
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: "#fff" }}>A</div>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#34d399" }}>AskPractice</span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#10b98118", color: "#34d399", fontWeight: 600, marginLeft: 4 }}>AI-Powered</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "6px 0 4px" }}>Practice Performance Intelligence</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Ask plain-English questions about {PRACTICE_DATA.practiceName} · Powered by Claude</p>
        </div>
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, maxWidth: 900, margin: "0 auto", width: "100%", padding: "0 32px", display: "flex", flexDirection: "column" }}>
        
        {/* Smart Insights (shown initially) */}
        {showInsights && (
          <div style={{ padding: "20px 0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Smart Summary — Current Month</div>
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
              <MiniBar data={monthlyRev} labels={["Jan","","","Apr","","","Jul","","","Oct","","Dec"]} color="#10b981" height={50} width={400} />
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
                {m.role === "assistant" && <div style={{ fontSize: 10, fontWeight: 700, color: "#34d399", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>AskPractice AI</div>}
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
              <div style={{ padding: "12px 16px", borderRadius: "14px 14px 14px 4px", background: "#111b2e", border: "1px solid #1e293b", fontSize: 13, color: "#64748b" }}>
                <span style={{ animation: "pulse 1.5s infinite" }}>Analyzing practice data...</span>
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
                <button key={q} onClick={() => handleSend(q)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #1e293b", background: "#111b2e", color: "#94a3b8", fontSize: 12, cursor: "pointer", textAlign: "left", lineHeight: 1.4, transition: "border-color 0.15s" }}
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
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="Ask about revenue, denials, provider performance, payer mix..."
              style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: "1px solid #1e293b", background: "#111b2e", color: "#e2e8f0", fontSize: 14, outline: "none" }}
            />
            <button onClick={() => handleSend()} disabled={loading || !input.trim()}
              style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: loading ? "#1e293b" : "#10b981", color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", transition: "background 0.15s" }}
            >{loading ? "..." : "Ask"}</button>
          </div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 6 }}>
            Powered by Claude API · Queries synthetic data for {PRACTICE_DATA.practiceName} ({PRACTICE_DATA.providers.length} providers, {PRACTICE_DATA.payers.length} payers, 12 months)
          </div>
        </div>
      </div>
    </div>
  );
}
