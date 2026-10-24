"use client";
import { useState } from "react";

import { METRICS } from "../../lib/metric-definitions.mjs";

const SQL_KEYWORDS_SOURCE = "\\b(SELECT|FROM|JOIN|LEFT JOIN|WHERE|AND|OR|GROUP BY|ORDER BY|HAVING|WITH|AS|ON|CASE|WHEN|THEN|ELSE|END|IN|NOT|NULL|IS|BETWEEN|OVER|PARTITION BY|NULLIF|DISTINCT|TRUE|FALSE|DESC|ASC|SUM|COUNT|AVG|ROUND|MEDIAN|PERCENTILE_CONT|WITHIN GROUP|LAG|ROW_NUMBER|DATEADD|DATEDIFF|DATE_TRUNC|CURRENT_DATE)\\b";

function highlightSqlLine(text) {
  const re = new RegExp(SQL_KEYWORDS_SOURCE, "g");
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <span key={parts.length} style={{ color: "#ff7b72", fontWeight: 600 }}>{match[0]}</span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function SqlBlock({ sql }) {
  return (
    <pre style={{
      background: "#0d1117", borderRadius: 8, padding: "16px 20px", fontSize: 12.5,
      lineHeight: 1.65, overflowX: "auto", fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
      color: "#c9d1d9", border: "1px solid #21262d", margin: 0,
    }}>
      {sql.split("\n").map((line, i) => {
        const trimmed = line.trimStart();
        const isComment = trimmed.startsWith("--");
        const indent = line.length - trimmed.length;
        return (
          <div key={i} style={{
            color: isComment ? "#8b949e" : "#c9d1d9",
            fontStyle: isComment ? "italic" : "normal",
            paddingLeft: indent * 7.5,
            minHeight: trimmed === "" ? 12 : "auto",
          }}>
            {isComment ? trimmed : highlightSqlLine(trimmed)}
          </div>
        );
      })}
    </pre>
  );
}

export default function Methodology() {
  const [expanded, setExpanded] = useState(0);

  return (
    <div className="demo-page" style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", background: "#0b1120", color: "#e2e8f0", minHeight: "100vh" }}>
      <div style={{ padding: "28px 32px 0", maxWidth: 1000, margin: "0 auto" }}>
        <a href="/" style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12 }}
           onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"}
           onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
          ← Portfolio
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>

          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#38bdf8" }}>SQL Methodology</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "8px 0 4px" }}>GTM Metric Calculations</h1>
        <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 8px", lineHeight: 1.6, maxWidth: 720 }}>
          Five example metric queries, with calculation rules, assumptions, and policy choices. The tables describe a proposed Salesforce and billing schema.
        </p>
        <p style={{ fontSize: 12, color: "#475569", margin: "0 0 24px" }}>
          Snowflake SQL examples · Tested with small local fixtures · Not connected to a warehouse
        </p>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 32px 48px" }}>
        {METRICS.map((m, i) => (
          <div key={m.name} style={{ marginBottom: 12 }}>
            <div
              role="button" tabIndex={0} aria-expanded={expanded === i}
              onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setExpanded(expanded === i ? null : i); } }}
              onClick={() => setExpanded(expanded === i ? null : i)}
              style={{
                background: "#111b2e", borderRadius: expanded === i ? "10px 10px 0 0" : 10,
                padding: "16px 20px", border: "1px solid #1e293b", cursor: "pointer",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#151f35"}
              onMouseLeave={e => e.currentTarget.style.background = "#111b2e"}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>{m.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "#1e293b", color: "#64748b" }}>{m.category}</span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, maxWidth: 700 }}>{m.description.split(". ")[0] + "."}</div>
              </div>
              <span style={{ color: "#475569", fontSize: 18, transition: "transform 0.2s", transform: expanded === i ? "rotate(90deg)" : "none" }}>›</span>
            </div>

            {expanded === i && (
              <div style={{ background: "#0d1526", borderRadius: "0 0 10px 10px", padding: "20px 24px 24px", border: "1px solid #1e293b", borderTop: "none" }}>
                <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, marginBottom: 16 }}>{m.description}</p>

                <SqlBlock sql={m.sql} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                  <div style={{ background: "#111b2e", borderRadius: 8, padding: 14, border: "1px solid #1e293b" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#f59e0b", marginBottom: 8 }}>Edge Cases & Guards</div>
                    {m.edgeCases.map((e, j) => (
                      <div key={j} style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, marginBottom: 6, display: "flex", gap: 6 }}>
                        <span style={{ color: "#f59e0b", flexShrink: 0 }}>·</span>{e}
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "#111b2e", borderRadius: 8, padding: 14, border: "1px solid #ef444420" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#ef4444", marginBottom: 8 }}>Example policy choices</div>
                    <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>{m.conflicts}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        <div style={{ marginTop: 24, padding: 16, background: "#111b2e", borderRadius: 10, border: "1px solid #1e293b" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8", marginBottom: 6 }}>Implementation Notes</div>
          <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.7, margin: 0 }}>
            Local regression fixtures check repeated stages, excluded opportunities, closed-cohort denominators, and retained churn. Snowflake execution and dbt integration have not been validated. Before use, map the schema, enforce unique opportunity/account keys, confirm complete billing periods, and reconcile results to source totals.
          </p>
        </div>
      </div>
    </div>
  );
}
