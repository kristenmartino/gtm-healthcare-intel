import { useState, useMemo } from "react";

const SPECIALTIES = {
  Dermatology: {
    procedures: [
      { code: "17311", name: "Mohs Surgery (1st stage)", volumes: [142000, 148000, 155000, 163000, 172000], reimb: [726, 738, 752, 761, 778] },
      { code: "11102", name: "Tangential Biopsy (skin)", volumes: [890000, 912000, 945000, 978000, 1015000], reimb: [112, 114, 116, 118, 120] },
      { code: "17000", name: "Destruction Benign Lesion", volumes: [520000, 498000, 485000, 472000, 458000], reimb: [89, 87, 85, 83, 81] },
      { code: "96920", name: "Laser Tx (Psoriasis)", volumes: [78000, 84000, 92000, 101000, 112000], reimb: [156, 162, 168, 174, 181] },
      { code: "11305", name: "Shave Removal (0.6-1.0cm)", volumes: [345000, 352000, 358000, 362000, 368000], reimb: [134, 136, 138, 139, 141] },
      { code: "96910", name: "Photochemotherapy", volumes: [56000, 52000, 48000, 44000, 41000], reimb: [98, 96, 94, 91, 89] },
    ],
  },
  Orthopedics: {
    procedures: [
      { code: "27447", name: "Total Knee Arthroplasty", volumes: [680000, 712000, 748000, 789000, 834000], reimb: [1456, 1478, 1512, 1534, 1568] },
      { code: "27130", name: "Total Hip Arthroplasty", volumes: [450000, 478000, 508000, 542000, 578000], reimb: [1389, 1412, 1438, 1462, 1489] },
      { code: "29881", name: "Knee Arthroscopy", volumes: [520000, 498000, 478000, 456000, 438000], reimb: [689, 678, 665, 652, 641] },
      { code: "20610", name: "Joint Injection (Major)", volumes: [890000, 924000, 962000, 998000, 1038000], reimb: [118, 121, 124, 127, 130] },
      { code: "63030", name: "Lumbar Discectomy", volumes: [234000, 228000, 222000, 218000, 212000], reimb: [1234, 1245, 1258, 1268, 1278] },
      { code: "20680", name: "Hardware Removal (Deep)", volumes: [145000, 148000, 152000, 156000, 161000], reimb: [512, 518, 525, 532, 540] },
    ],
  },
  Gastroenterology: {
    procedures: [
      { code: "45380", name: "Colonoscopy w/ Biopsy", volumes: [1250000, 1298000, 1348000, 1402000, 1458000], reimb: [398, 405, 412, 420, 428] },
      { code: "43239", name: "Upper GI Endoscopy w/ Bx", volumes: [780000, 812000, 845000, 882000, 920000], reimb: [356, 362, 368, 375, 382] },
      { code: "45385", name: "Colonoscopy w/ Polypectomy", volumes: [620000, 645000, 672000, 701000, 732000], reimb: [489, 498, 508, 518, 528] },
      { code: "91110", name: "GI Tract Capsule Endoscopy", volumes: [89000, 98000, 108000, 119000, 132000], reimb: [512, 525, 538, 552, 567] },
      { code: "43248", name: "EGD w/ Guide Wire", volumes: [234000, 228000, 221000, 215000, 208000], reimb: [445, 440, 434, 428, 422] },
      { code: "43264", name: "ERCP w/ Stent", volumes: [112000, 118000, 125000, 132000, 140000], reimb: [892, 912, 934, 956, 978] },
    ],
  },
  Ophthalmology: {
    procedures: [
      { code: "66984", name: "Cataract Surgery (Complex)", volumes: [1890000, 1945000, 2012000, 2078000, 2148000], reimb: [589, 596, 604, 612, 621] },
      { code: "67028", name: "Intravitreal Injection", volumes: [1120000, 1198000, 1285000, 1378000, 1480000], reimb: [145, 148, 152, 156, 160] },
      { code: "65855", name: "Laser Trabeculoplasty", volumes: [245000, 262000, 280000, 301000, 324000], reimb: [312, 318, 325, 332, 340] },
      { code: "0191T", name: "MIGS (iStent/Hydrus)", volumes: [56000, 78000, 105000, 138000, 178000], reimb: [478, 492, 508, 524, 542] },
      { code: "92134", name: "OCT Retinal Imaging", volumes: [2450000, 2580000, 2720000, 2870000, 3028000], reimb: [42, 43, 44, 45, 46] },
      { code: "66170", name: "Trabeculectomy", volumes: [45000, 42000, 38000, 35000, 32000], reimb: [856, 848, 838, 828, 818] },
    ],
  },
};

const YEARS = ["2021", "2022", "2023", "2024", "2025"];

function cagr(start, end, years) { return ((Math.pow(end / start, 1 / years) - 1) * 100).toFixed(1); }
function yoyChange(curr, prev) { return ((curr - prev) / prev * 100).toFixed(1); }

function MiniChart({ data, color, height = 44, width = 140 }) {
  const min = Math.min(...data) * 0.95;
  const max = Math.max(...data) * 1.05;
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(" ");
  const areaPath = `M0,${height} L${pts.split(" ").map((p, i) => i === 0 ? p : ` L${p}`).join("")} L${width},${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
      <defs>
        <linearGradient id={`g-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`M0,${height} ${data.map((v, i) => `L${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 8) - 4}`).join(" ")} L${width},${height} Z`} fill={`url(#g-${color.replace("#","")})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => (
        <circle key={i} cx={(i / (data.length - 1)) * width} cy={height - ((v - min) / range) * (height - 8) - 4} r={i === data.length - 1 ? 4 : 2.5} fill={i === data.length - 1 ? color : "#0b1120"} stroke={color} strokeWidth={1.5} />
      ))}
    </svg>
  );
}

function AlertBadge({ type, children }) {
  const styles = {
    rising: { bg: "#10b98118", color: "#10b981", icon: "▲" },
    declining: { bg: "#ef444418", color: "#ef4444", icon: "▼" },
    accelerating: { bg: "#6366f118", color: "#a78bfa", icon: "⚡" },
    stable: { bg: "#64748b18", color: "#94a3b8", icon: "—" },
  };
  const s = styles[type] || styles.stable;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
      {s.icon} {children}
    </span>
  );
}

export default function SpecialtyPulse() {
  const [specialty, setSpecialty] = useState("Dermatology");
  const [sortBy, setSortBy] = useState("growth");
  const [showAlerts, setShowAlerts] = useState(true);

  const procedures = useMemo(() => {
    const procs = SPECIALTIES[specialty].procedures.map(p => {
      const growth = Number(cagr(p.volumes[0], p.volumes[4], 4));
      const reimbGrowth = Number(cagr(p.reimb[0], p.reimb[4], 4));
      const yoy = Number(yoyChange(p.volumes[4], p.volumes[3]));
      const prevYoy = Number(yoyChange(p.volumes[3], p.volumes[2]));
      const accelerating = yoy > prevYoy && yoy > 3;
      const type = growth > 5 ? "rising" : growth > 1 ? "stable" : "declining";
      const reimbImpact = p.volumes[4] * p.reimb[4] - p.volumes[0] * p.reimb[0];
      return { ...p, growth, reimbGrowth, yoy, accelerating, type, reimbImpact };
    });
    if (sortBy === "growth") return procs.sort((a, b) => b.growth - a.growth);
    if (sortBy === "volume") return procs.sort((a, b) => b.volumes[4] - a.volumes[4]);
    if (sortBy === "reimb") return procs.sort((a, b) => b.reimbGrowth - a.reimbGrowth);
    return procs;
  }, [specialty, sortBy]);

  const alerts = procedures.filter(p => p.accelerating || p.growth > 6 || p.growth < -2);

  return (
    <div style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", background: "#0b1120", color: "#e2e8f0", minHeight: "100vh" }}>
      <div style={{ padding: "28px 32px 0", maxWidth: 1100, margin: "0 auto" }}>
        <a href="/" style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12 }}
           onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"}
           onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
          ← Portfolio
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #f59e0b, #ef4444)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff" }}>S</div>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fbbf24" }}>SpecialtyPulse</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "8px 0 4px" }}>Procedure Volume & Reimbursement Trend Monitor</h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px" }}>CMS Medicare Physician PUF data · 2021–2025 · Specialty procedure trends, reimbursement shifts, and growth signals</p>

        {/* Specialty tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {Object.keys(SPECIALTIES).map(s => (
            <button key={s} onClick={() => setSpecialty(s)} style={{ padding: "8px 18px", borderRadius: 8, border: specialty === s ? "1.5px solid #fbbf24" : "1.5px solid #1e293b", background: specialty === s ? "#fbbf2412" : "#111b2e", color: specialty === s ? "#fbbf24" : "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{s}</button>
          ))}
        </div>

        {/* Sort */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20, fontSize: 12, color: "#64748b" }}>
          <span style={{ fontWeight: 600 }}>Sort:</span>
          {[["growth", "Volume Growth"], ["volume", "Total Volume"], ["reimb", "Reimb. Growth"]].map(([k, l]) => (
            <button key={k} onClick={() => setSortBy(k)} style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: sortBy === k ? "#fbbf2418" : "transparent", color: sortBy === k ? "#fbbf24" : "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px 48px" }}>
        {/* Alerts */}
        {showAlerts && alerts.length > 0 && (
          <div style={{ background: "#111b2e", borderRadius: 10, border: "1px solid #fbbf2430", padding: 18, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.05em" }}>Rising Procedure Alerts</div>
              <button onClick={() => setShowAlerts(false)} style={{ background: "none", border: "none", color: "#475569", fontSize: 11, cursor: "pointer" }}>Dismiss</button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {alerts.map(a => (
                <AlertBadge key={a.code} type={a.accelerating ? "accelerating" : a.growth > 6 ? "rising" : "declining"}>
                  {a.code} {a.name.split(" ")[0]} — {a.growth > 0 ? "+" : ""}{a.growth}% CAGR
                </AlertBadge>
              ))}
            </div>
          </div>
        )}

        {/* Procedure cards */}
        <div style={{ display: "grid", gap: 12 }}>
          {procedures.map(p => (
            <div key={p.code} style={{ background: "#111b2e", borderRadius: 10, border: "1px solid #1e293b", padding: 20, display: "grid", gridTemplateColumns: "1fr 160px 160px 120px 120px", alignItems: "center", gap: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "#1e293b", color: "#94a3b8" }}>CPT {p.code}</span>
                  <AlertBadge type={p.type}>{p.type}</AlertBadge>
                  {p.accelerating && <AlertBadge type="accelerating">Accelerating</AlertBadge>}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{p.name}</div>
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#475569", marginBottom: 4 }}>Volume Trend (4yr)</div>
                <MiniChart data={p.volumes} color={p.growth > 0 ? "#10b981" : "#ef4444"} />
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#475569", marginBottom: 4 }}>Reimb. Trend (4yr)</div>
                <MiniChart data={p.reimb} color={p.reimbGrowth > 0 ? "#38bdf8" : "#f59e0b"} />
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>Volume CAGR</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: p.growth > 0 ? "#10b981" : "#ef4444" }}>{p.growth > 0 ? "+" : ""}{p.growth}%</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>YoY: {p.yoy > 0 ? "+" : ""}{p.yoy}%</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>Reimb CAGR</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: p.reimbGrowth > 0 ? "#38bdf8" : "#f59e0b" }}>{p.reimbGrowth > 0 ? "+" : ""}{p.reimbGrowth}%</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>2025: ${p.reimb[4]}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary insight */}
        <div style={{ marginTop: 24, background: "#111b2e", borderRadius: 10, border: "1px solid #1e293b", padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Market Signal Summary — {specialty}</div>
          <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, margin: 0 }}>
            {(() => {
              const rising = procedures.filter(p => p.growth > 3);
              const declining = procedures.filter(p => p.growth < 0);
              return `${rising.length} of ${procedures.length} tracked procedures show positive volume growth (${rising.map(p => p.name.split(" ")[0]).join(", ")}). ${declining.length > 0 ? `${declining.length} procedures are declining: ${declining.map(p => p.name.split(" ")[0]).join(", ")}. ` : ""}The fastest-growing procedure is ${procedures[0].name} at ${procedures[0].growth}% CAGR. This suggests growing EHR demand for ${specialty.toLowerCase()} practices focused on ${rising.slice(0, 2).map(p => p.name.split("(")[0].trim().toLowerCase()).join(" and ")}.`;
            })()}
          </p>
        </div>

        <div style={{ marginTop: 16, padding: 14, background: "#111b2e", borderRadius: 8, border: "1px solid #1e293b" }}>
          <p style={{ fontSize: 11, color: "#475569", margin: 0, lineHeight: 1.5 }}>
            <strong>Data Note:</strong> Volume and reimbursement figures modeled on CMS Medicare Physician & Other Practitioners Public Use Files and CMS Physician Fee Schedule. Trends represent Medicare FFS utilization — actual commercial volumes may differ. Data is illustrative for portfolio purposes.
          </p>
        </div>
      </div>
    </div>
  );
}
