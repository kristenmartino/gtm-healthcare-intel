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

        <div style={{ marginTop: 24, padding: 16, background: "var(--card)", borderRadius: 10, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
            <strong>Data Note:</strong> Benchmarks generated from synthetic practice data modeled on published MGMA, HFMA, and CMS cost report distributions for {specialty} practices of size {size}. Not sourced from real practice data. Adjust "Your Practice Metrics" sliders to see where a practice would rank against the peer cohort.
          </p>
        </div>
      </div>
    </div>
  );
}
