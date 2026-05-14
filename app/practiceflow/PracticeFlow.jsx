import { useState, useMemo } from "react";

const SPECIALTIES = ["Dermatology", "Orthopedics", "Gastroenterology", "Ophthalmology"];
const PRACTICE_SIZES = ["Solo (1)", "Small (2-5)", "Medium (6-15)", "Large (16+)"];

function seed(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = Math.imul(31, h) + s.charCodeAt(i) | 0; } return () => { h = h ^ (h << 13); h = h ^ (h >> 17); h = h ^ (h << 5); return (h >>> 0) / 4294967296; }; }

function generateBenchmarks(specialty, size) {
  const r = seed(specialty + size);
  const base = { Dermatology: { dar: 32, denial: 5.2, collect: 96, cpt: 285, noShow: 8 }, Orthopedics: { dar: 38, denial: 6.8, collect: 94, cpt: 412, noShow: 6 }, Gastroenterology: { dar: 35, denial: 5.8, collect: 95, cpt: 356, noShow: 7 }, Ophthalmology: { dar: 30, denial: 4.9, collect: 97, cpt: 298, noShow: 9 } }[specialty];
  const sizeAdj = { "Solo (1)": 1.15, "Small (2-5)": 1.05, "Medium (6-15)": 0.95, "Large (16+)": 0.88 }[size];

  const practices = [];
  for (let i = 0; i < 80; i++) {
    practices.push({
      daysInAR: Math.round((base.dar * sizeAdj + (r() - 0.5) * 20) * 10) / 10,
      denialRate: Math.round((base.denial * sizeAdj + (r() - 0.5) * 4) * 10) / 10,
      collectRate: Math.round((base.collect / sizeAdj + (r() - 0.5) * 6) * 10) / 10,
      avgReimb: Math.round(base.cpt * (0.85 + r() * 0.3)),
      noShowRate: Math.round((base.noShow + (r() - 0.5) * 6) * 10) / 10,
    });
  }
  return practices;
}

function percentile(arr, p) { const s = [...arr].sort((a, b) => a - b); const i = (p / 100) * (s.length - 1); const f = Math.floor(i); return s[f] + (s[f + 1] - s[f]) * (i - f); }

function DistributionChart({ data, value, unit, label, lowerIsBetter }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const buckets = 20;
  const hist = Array(buckets).fill(0);
  data.forEach(v => { const b = Math.min(buckets - 1, Math.floor(((v - min) / range) * buckets)); hist[b]++; });
  const maxH = Math.max(...hist);
  const pct = data.filter(d => lowerIsBetter ? d >= value : d <= value).length / data.length * 100;
  const valueBucket = Math.min(buckets - 1, Math.floor(((value - min) / range) * buckets));

  return (
    <div style={{ background: "var(--card)", borderRadius: 10, padding: 20, border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--fg)", marginTop: 4 }}>{value}{unit}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Your Percentile</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444" }}>
            {lowerIsBetter ? Math.round(100 - pct) : Math.round(pct)}th
          </div>
        </div>
      </div>
      <svg viewBox={`0 0 ${buckets * 18} 60`} style={{ width: "100%", height: 60 }}>
        {hist.map((h, i) => (
          <rect key={i} x={i * 18 + 1} y={60 - (h / maxH) * 55} width={15} height={(h / maxH) * 55} rx={2}
            fill={i === valueBucket ? "#38bdf8" : "#1e293b"} opacity={i === valueBucket ? 1 : 0.7} />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
        <span>{min.toFixed(1)}{unit}</span>
        <span style={{ fontSize: 10, color: "#38bdf8", fontWeight: 700 }}>▲ You: {value}{unit}</span>
        <span>{max.toFixed(1)}{unit}</span>
      </div>
    </div>
  );
}

function Sparkline({ data, color, height = 32, width = 120 }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PracticeFlow() {
  const [specialty, setSpecialty] = useState("Dermatology");
  const [size, setSize] = useState("Small (2-5)");
  const [myDar, setMyDar] = useState(36);
  const [myDenial, setMyDenial] = useState(5.8);
  const [myCollect, setMyCollect] = useState(94.2);
  const [myReimb, setMyReimb] = useState(295);
  const [myNoShow, setMyNoShow] = useState(9.1);
  // Diagnostic drill inputs — payer mix and denial-cycle assumptions
  const [payerCommercial, setPayerCommercial] = useState(55);
  const [payerGov, setPayerGov] = useState(30);
  const [resubCycle, setResubCycle] = useState(14);

  const benchmarks = useMemo(() => generateBenchmarks(specialty, size), [specialty, size]);
  const darData = benchmarks.map(b => b.daysInAR);
  const denialData = benchmarks.map(b => b.denialRate);
  const collectData = benchmarks.map(b => b.collectRate);
  const reimbData = benchmarks.map(b => b.avgReimb);
  const noShowData = benchmarks.map(b => b.noShowRate);

  const p25dar = percentile(darData, 25).toFixed(1);
  const p50dar = percentile(darData, 50).toFixed(1);
  const p75dar = percentile(darData, 75).toFixed(1);

  const trendMonths = ["Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun"];
  const trendDar = [38,37,36.5,37,36,35,36,35.5,36,35,34.5,myDar];
  const trendDenial = [6.8,6.5,6.2,6.0,5.9,5.8,5.7,5.9,5.8,5.6,5.9,myDenial];

  // ─── Days-in-A/R Diagnostic Decomposition ────────────────────────────────
  // Industry-standard days-to-payment by payer type (MGMA + HFMA published medians).
  // These are anchors, not absolutes — calibrate to internal billing data in production.
  const COMMERCIAL_DAYS = 25;
  const GOV_DAYS = 32;       // Medicare + Medicaid clean claims
  const PATIENT_DAYS = 65;   // self-pay / patient responsibility aging
  const payerPatient = Math.max(0, 100 - payerCommercial - payerGov);
  const commercialContrib = (payerCommercial / 100) * COMMERCIAL_DAYS;
  const govContrib = (payerGov / 100) * GOV_DAYS;
  const patientContrib = (payerPatient / 100) * PATIENT_DAYS;
  // Denial drag: not every denial waits the full resubmission cycle (some pay before resubmission lands)
  const denialDrag = (myDenial / 100) * resubCycle * 0.8;
  const predictedDar = commercialContrib + govContrib + patientContrib + denialDrag;
  // Anything above predicted is process drag — eligibility, posting, follow-up cadence
  const processDrag = Math.max(0, myDar - predictedDar);

  // Lever analysis — rank interventions by days-of-A/R recovered
  const levers = [
    {
      name: "Cut denial-resubmission cycle",
      impact: (myDenial / 100) * Math.max(0, resubCycle - 7) * 0.8,
      action: `${resubCycle}d → 7d resubmission (best-practice clean-claim turnaround)`,
    },
    {
      name: "Reduce first-pass denial rate",
      impact: Math.max(0, myDenial - 4) / 100 * resubCycle * 0.8,
      action: `${myDenial.toFixed(1)}% → 4% (50th-percentile target via front-end eligibility + payer-rules check)`,
    },
    {
      name: "Patient-pay collection program",
      impact: payerPatient > 10 ? ((payerPatient - 8) / 100) * (PATIENT_DAYS - COMMERCIAL_DAYS) : 0,
      action: `${payerPatient.toFixed(0)}% → 8% patient AR via point-of-service collection + financing options`,
    },
    {
      name: "Tighten back-office process drag",
      impact: processDrag * 0.6,
      action: `${processDrag.toFixed(1)}d unexplained → same-day posting, automated eligibility, weekly aged-AR review`,
    },
  ].filter(l => l.impact >= 0.5).sort((a, b) => b.impact - a.impact);
  const topLever = levers[0];

  const segments = [
    { label: "Commercial payer mix", days: commercialContrib, color: "#0d9488", desc: `${payerCommercial}% of revenue at ~${COMMERCIAL_DAYS}-day clean-claim cycle` },
    { label: "Gov (Medicare/Medicaid)", days: govContrib, color: "#2563eb", desc: `${payerGov}% at ~${GOV_DAYS}-day FFS cycle` },
    { label: "Patient-pay aging", days: patientContrib, color: "#d97706", desc: `${payerPatient.toFixed(0)}% at ~${PATIENT_DAYS}-day self-pay aging` },
    { label: "Denial cycle drag", days: denialDrag, color: "#dc2626", desc: `${myDenial.toFixed(1)}% denial × ${resubCycle}d resubmission` },
    ...(processDrag >= 0.5 ? [{ label: "Unexplained process drag", days: processDrag, color: "#94a3b8", desc: "Eligibility, posting, follow-up cadence" }] : []),
  ];
  const totalSegDays = segments.reduce((a, s) => a + s.days, 0);

  return (
    <div style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", ["--bg"]: "#f8fafc", ["--fg"]: "#0f172a", ["--card"]: "#ffffff", ["--border"]: "#e2e8f0", ["--muted"]: "#64748b", ["--accent"]: "#0d9488", background: "var(--bg)", color: "var(--fg)", minHeight: "100vh", padding: 0 }}>
      
      {/* Header */}
      <div style={{ background: "#0f172a", padding: "32px 32px 28px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <a href="/" style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12 }}
             onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"}
             onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
            ← Portfolio
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #0d9488, #14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff" }}>P</div>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5eead4" }}>PracticeFlow</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f1f5f9", margin: "8px 0 4px", letterSpacing: "-0.01em" }}>Revenue Cycle Benchmarking</h1>
          <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>Compare your practice KPIs against {benchmarks.length} synthetic peer cohort practices · Modeled on MGMA & HFMA published benchmarks</p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 32px 48px" }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", display: "block", marginBottom: 6 }}>Specialty</label>
            <div style={{ display: "flex", gap: 6 }}>
              {SPECIALTIES.map(s => (
                <button key={s} onClick={() => setSpecialty(s)} style={{ padding: "6px 14px", borderRadius: 6, border: specialty === s ? "1.5px solid var(--accent)" : "1px solid var(--border)", background: specialty === s ? "#0d948812" : "var(--card)", color: specialty === s ? "var(--accent)" : "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", display: "block", marginBottom: 6 }}>Practice Size</label>
            <div style={{ display: "flex", gap: 6 }}>
              {PRACTICE_SIZES.map(s => (
                <button key={s} onClick={() => setSize(s)} style={{ padding: "6px 14px", borderRadius: 6, border: size === s ? "1.5px solid var(--accent)" : "1px solid var(--border)", background: size === s ? "#0d948812" : "var(--card)", color: size === s ? "var(--accent)" : "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Your inputs */}
        <div style={{ background: "var(--card)", borderRadius: 10, border: "1px solid var(--border)", padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Your Practice Metrics</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
            {[
              { label: "Days in A/R", val: myDar, set: setMyDar, min: 15, max: 60, step: 0.5 },
              { label: "Denial Rate %", val: myDenial, set: setMyDenial, min: 1, max: 15, step: 0.1 },
              { label: "Collection Rate %", val: myCollect, set: setMyCollect, min: 80, max: 100, step: 0.1 },
              { label: "Avg Reimb. ($)", val: myReimb, set: setMyReimb, min: 150, max: 600, step: 5 },
              { label: "No-Show Rate %", val: myNoShow, set: setMyNoShow, min: 2, max: 20, step: 0.1 },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>{f.label}</div>
                <input type="range" min={f.min} max={f.max} step={f.step} value={f.val} onChange={e => f.set(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#0d9488" }} />
                <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{f.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Distribution charts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
          <DistributionChart data={darData} value={myDar} unit=" days" label="Days in A/R" lowerIsBetter={true} />
          <DistributionChart data={denialData} value={myDenial} unit="%" label="Denial Rate" lowerIsBetter={true} />
          <DistributionChart data={collectData} value={myCollect} unit="%" label="Collection Rate" lowerIsBetter={false} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <DistributionChart data={reimbData} value={myReimb} unit="" label="Avg Reimbursement ($)" lowerIsBetter={false} />
          <DistributionChart data={noShowData} value={myNoShow} unit="%" label="No-Show Rate" lowerIsBetter={true} />
        </div>

        {/* Peer Benchmarks Table */}
        <div style={{ background: "var(--card)", borderRadius: 10, border: "1px solid var(--border)", padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Peer Cohort Percentiles — {specialty} · {size}</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Metric","25th","50th (Median)","75th","Your Value","vs Median"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Days in A/R", data: darData, val: myDar, unit: "", lower: true },
                { label: "Denial Rate", data: denialData, val: myDenial, unit: "%", lower: true },
                { label: "Collection Rate", data: collectData, val: myCollect, unit: "%", lower: false },
                { label: "Avg Reimbursement", data: reimbData, val: myReimb, unit: "", lower: false },
                { label: "No-Show Rate", data: noShowData, val: myNoShow, unit: "%", lower: true },
              ].map(row => {
                const p25 = percentile(row.data, 25).toFixed(1);
                const p50 = percentile(row.data, 50).toFixed(1);
                const p75 = percentile(row.data, 75).toFixed(1);
                const diff = row.val - p50;
                const good = row.lower ? diff < 0 : diff > 0;
                return (
                  <tr key={row.label} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, textAlign: "right" }}>{row.label}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>{p25}{row.unit}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700 }}>{p50}{row.unit}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>{p75}{row.unit}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#38bdf8" }}>{row.val}{row.unit}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: good ? "#10b981" : "#ef4444" }}>
                      {good ? "✓" : "▼"} {Math.abs(diff).toFixed(1)} {row.lower ? (good ? "better" : "worse") : (good ? "above" : "below")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Trend section */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "var(--card)", borderRadius: 10, border: "1px solid var(--border)", padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: 8 }}>Days in A/R — 12-Month Trend</div>
            <Sparkline data={trendDar} color="#0d9488" height={48} width={320} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{trendMonths.map(m => <span key={m}>{m}</span>)}</div>
          </div>
          <div style={{ background: "var(--card)", borderRadius: 10, border: "1px solid var(--border)", padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: 8 }}>Denial Rate — 12-Month Trend</div>
            <Sparkline data={trendDenial} color="#f59e0b" height={48} width={320} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{trendMonths.map(m => <span key={m}>{m}</span>)}</div>
          </div>
        </div>

        {/* Diagnostic Drill — decomposes Days in A/R into the four upstream drivers
            and ranks which intervention recovers the most days. Turns the page from
            "you're at the Xth percentile" into "and here's specifically why and what
            to do about it." */}
        <div style={{ marginTop: 24, background: "var(--card)", borderRadius: 10, border: "1px solid var(--border)", padding: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Diagnostic Drill — What's Driving Your Days in A/R
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              Your A/R: <strong style={{ color: "var(--fg)" }}>{myDar} days</strong> · Predicted from drivers: <strong style={{ color: "var(--fg)" }}>{predictedDar.toFixed(1)} days</strong>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65, margin: "6px 0 18px" }}>
            Days in A/R is a downstream metric — the sum of four upstream drivers. Knowing you're at the {Math.round(100 - (darData.filter(d => d <= myDar).length / darData.length * 100))}th percentile is the easy diagnosis; identifying which lever to pull is the consultative one. Adjust your payer mix and denial-resubmission cycle below to see how the components decompose.
          </p>

          {/* Driver inputs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Commercial Payer Mix</div>
              <input type="range" min={0} max={100} step={1} value={payerCommercial}
                onChange={e => { const v = Number(e.target.value); setPayerCommercial(v); if (v + payerGov > 100) setPayerGov(100 - v); }}
                style={{ width: "100%", accentColor: "#0d9488" }} />
              <div style={{ fontSize: 15, fontWeight: 800 }}>{payerCommercial}%</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>~{COMMERCIAL_DAYS}-day cycle (clean)</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Gov Payer Mix (Medicare + Medicaid)</div>
              <input type="range" min={0} max={100} step={1} value={payerGov}
                onChange={e => { const v = Number(e.target.value); setPayerGov(v); if (payerCommercial + v > 100) setPayerCommercial(100 - v); }}
                style={{ width: "100%", accentColor: "#0d9488" }} />
              <div style={{ fontSize: 15, fontWeight: 800 }}>{payerGov}%</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>~{GOV_DAYS}-day FFS cycle · patient-pay auto = {payerPatient.toFixed(0)}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Denial Resubmission Cycle (days)</div>
              <input type="range" min={5} max={30} step={1} value={resubCycle}
                onChange={e => setResubCycle(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#0d9488" }} />
              <div style={{ fontSize: 15, fontWeight: 800 }}>{resubCycle}d</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>Industry best-practice: 7d</div>
            </div>
          </div>

          {/* Stacked decomposition bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Where Your A/R Days Come From</div>
            <div style={{ display: "flex", height: 36, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
              {segments.map((s, i) => (
                <div key={i} title={`${s.label}: ${s.days.toFixed(1)} days — ${s.desc}`}
                  style={{ flex: Math.max(s.days, 0.01), background: s.color, color: "#fff", padding: "0 10px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", overflow: "hidden", borderRight: i < segments.length - 1 ? "1px solid rgba(255,255,255,0.2)" : "none" }}>
                  {s.days >= totalSegDays * 0.08 ? `${s.days.toFixed(1)}d` : ""}
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginTop: 10 }}>
              {segments.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11 }}>
                  <span style={{ width: 10, height: 10, background: s.color, borderRadius: 2, flexShrink: 0, marginTop: 4 }} />
                  <span style={{ color: "var(--muted)", lineHeight: 1.4 }}>
                    <strong style={{ color: "var(--fg)" }}>{s.label}</strong> · {s.days.toFixed(1)}d · {s.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Lever recommendation */}
          {topLever && (
            <div style={{ background: "#f0fdfa", borderLeft: "4px solid #0d9488", padding: "14px 18px", borderRadius: "0 8px 8px 0" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Highest-Leverage Intervention
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg)", marginBottom: 4 }}>
                {topLever.name} <span style={{ color: "#0d9488" }}>(~{topLever.impact.toFixed(1)}d recovery)</span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 8px", lineHeight: 1.6 }}>
                {topLever.action}.
              </p>
              {levers.length > 1 && (
                <div style={{ fontSize: 11, color: "var(--muted)", borderTop: "1px solid #ccfbf1", paddingTop: 8, marginTop: 6 }}>
                  <strong style={{ color: "var(--fg)" }}>Other levers in order:</strong>{" "}
                  {levers.slice(1).map((l, i) => (
                    <span key={i}>{i > 0 && " · "}{l.name} (~{l.impact.toFixed(1)}d)</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: 24, padding: 16, background: "var(--card)", borderRadius: 10, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
            <strong>Data Note:</strong> Benchmarks generated from synthetic practice data modeled on published MGMA, HFMA, and CMS cost report distributions for {specialty} practices of size {size}. Not sourced from real practice data. Adjust "Your Practice Metrics" sliders to see where a practice would rank against the peer cohort. Diagnostic Drill anchors (commercial 25d / gov 32d / patient 65d / resubmission 7d best-practice) are published industry medians; production deployments would calibrate these against the practice's own billing system.
          </p>
        </div>
      </div>
    </div>
  );
}
