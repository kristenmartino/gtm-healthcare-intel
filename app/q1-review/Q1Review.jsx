import Link from "next/link";
import { qbr, nrr, money, shortMoney, pct, CURRENT_QUARTER, PRIOR_QUARTER } from "../../lib/gtm-scenario.mjs";

const { current, prior, reps, specialties, sources, churn } = qbr;
const change = (now, before) => pct(now / before - 1);
const pp = (now, before) => `${((now - before) * 100).toFixed(1)}pp`;
const lastName = name => name.split(" ").at(-1);
const slowest = [...reps].sort((a, b) => b.avgCycle - a.avgCycle)[0];
const fastest = [...reps].sort((a, b) => a.avgCycle - b.avgCycle)[0];
const derm = specialties.find(s => s.name === "Dermatology");
const ortho = specialties.find(s => s.name === "Orthopedics");
const referral = sources.find(s => s.name === "Referral");
const paid = sources.find(s => s.name === "Paid");
const metrics = [
  ["Won ACV (bookings)", shortMoney(prior.bookings), shortMoney(current.bookings), change(current.bookings, prior.bookings)],
  ["Bookings target", shortMoney(prior.target), shortMoney(current.target), change(current.target, prior.target)],
  ["Attainment", pct(prior.bookings / prior.target), pct(current.bookings / current.target), pp(current.bookings / current.target, prior.bookings / prior.target)],
  ["Won / closed opportunities", `${prior.wins} / ${prior.closed}`, `${current.wins} / ${current.closed}`, ""],
  ["Mean won ACV", money(prior.avgACV), money(current.avgACV), change(current.avgACV, prior.avgACV)],
  ["Closed-cohort win rate", pct(prior.winRate), pct(current.winRate), pp(current.winRate, prior.winRate)],
  ["Mean won cycle (days)", prior.avgCycle.toFixed(1), current.avgCycle.toFixed(1), change(current.avgCycle, prior.avgCycle)],
  ["Qualified pipeline at quarter end", shortMoney(prior.pipeline), shortMoney(current.pipeline), change(current.pipeline, prior.pipeline)],
  ["Pipeline / full-quarter target", `${(prior.pipeline / prior.target).toFixed(2)}x`, `${(current.pipeline / current.target).toFixed(2)}x`, "Snapshot ratio; not a forecast"],
];

export default function Q1Review() {
  return (
    <main className="qbr-page" style={{ background: "#f5f6f7", color: "#17232e", minHeight: "100vh" }}>
      <article style={{ maxWidth: 960, margin: "0 auto", padding: "40px clamp(20px, 5vw, 48px) 64px", background: "#fff" }}>
        <Link href="/" style={{ color: "#35635e", fontSize: 14 }}>← Portfolio</Link>
        <header style={{ borderBottom: "2px solid #17232e", padding: "28px 0 24px", marginBottom: 28 }}>
          <p style={{ color: "#35635e", fontWeight: 700, fontSize: 13 }}>Illustrative QBR · Synthetic data</p>
          <h1 style={{ fontSize: "clamp(26px, 4vw, 38px)", lineHeight: 1.2, margin: "10px 0" }}>Q1 2025 GTM performance review</h1>
          <P>Kristen Martino · Analysis exercise for a fictional specialty healthcare software company.</P>
          <P>Tables and narrative use the same scenario records as <Link href="/askgtm">AskGTM</Link>. Values have been reconciled within this exercise; they are not company results or published industry benchmarks. Other portfolio tools use separate, labeled datasets.</P>
        </header>
        <Section title="What changed">
          <P>Bookings were {shortMoney(current.bookings)} against a {shortMoney(current.target)} target ({pct(current.bookings / current.target)} attainment), a shortfall of {money(current.target - current.bookings)}. Bookings increased {change(current.bookings, prior.bookings)} from Q4, despite fewer wins: {current.wins} compared with {prior.wins}.</P>
          <P>Mean won ACV rose {change(current.avgACV, prior.avgACV)}, from {money(prior.avgACV)} to {money(current.avgACV)}. Closed-cohort win rate increased {pp(current.winRate, prior.winRate)} to {pct(current.winRate)}. These changes describe the scenario; they do not establish why bookings missed target.</P>
        </Section>
        <Section title="1. Pipeline and bookings">
          <DataTable headers={["Metric", PRIOR_QUARTER, CURRENT_QUARTER, "Change / note"]} rows={metrics} />
          <P>Win rate uses closed won ÷ (closed won + closed lost). Mean ACV uses won ACV ÷ wins; cycle length is averaged across won deals. Pipeline is the open, qualified snapshot, separate from bookings. Coverage uses the full-quarter target shown here; it does not divide by remaining quota at quarter end.</P>
        </Section>
        <Section title="2. Specialty performance">
          <DataTable headers={["Specialty", "Won / closed", "Won ACV", "Win rate", "Mean ACV", "Mean cycle"]} rows={specialties.map(s => [s.name, `${s.wins} / ${s.closed}`, money(s.bookings), pct(s.winRate), money(s.avgACV), `${s.avgCycle.toFixed(1)}d`])} />
          <P>Dermatology has a {pct(derm.winRate)} win rate in this sample, compared with {pct(ortho.winRate)} for Orthopedics. This makes Orthopedics a useful starting point for reviewing loss reasons, segment mix, and time in stage. The dataset has no legal-review timestamps or interview evidence, so it cannot identify legal delay as the cause.</P>
          <Note title="Suggested check">Inspect comparable won and lost opportunities before changing territory coverage. A segment with a higher win rate may also have a different deal-size mix or qualification threshold.</Note>
        </Section>
        <Section title="3. Source performance">
          <DataTable headers={["Source", "Won / closed", "Won ACV", "Win rate", "Mean won ACV", "Open pipeline"]} rows={sources.map(s => [s.name, `${s.wins} / ${s.closed}`, money(s.bookings), pct(s.winRate), money(s.avgACV), money(s.pipeline)])} />
          <P>Referrals closed {referral.wins} of {referral.closed} decided opportunities ({pct(referral.winRate)}); paid closed {paid.wins} of {paid.closed} ({pct(paid.winRate)}). These are closed cohorts, including opportunities created in earlier periods. They do not measure lead-to-opportunity conversion or prove channel quality caused the difference.</P>
          <P>A referral pilot is worth testing. Keep the initial budget limited and measure incremental qualified opportunities, acquisition cost, and subsequent wins before increasing spend.</P>
        </Section>
        <Section title="4. Rep performance">
          <DataTable headers={["Rep", "Quota", "Won ACV", "Attainment", "Wins", "Mean ACV", "Mean cycle"]} rows={reps.map(r => [lastName(r.name), money(r.quota), money(r.bookings), pct(r.bookings / r.quota), r.wins, money(r.avgACV), `${r.avgCycle.toFixed(1)}d`])} />
          <P>{lastName(slowest.name)} has the longest mean won cycle at {slowest.avgCycle.toFixed(0)} days across {slowest.wins} wins, and the largest mean won ACV at {money(slowest.avgACV)}. {lastName(fastest.name)} has the shortest cycle at {fastest.avgCycle.toFixed(0)} days across {fastest.wins} wins. The small samples and different deal sizes limit comparisons; neither proves rep effectiveness or poor qualification.</P>
        </Section>
        <Section title="5. Retention">
          <DataTable headers={["Specialty", "Start customers", "Churned", "Customer churn", "Prior cohort revenue", "Current cohort revenue", "NRR"]} rows={churn.map(c => [c.specialty, c.customersStart, c.churned, pct(c.churned / c.customersStart), money(c.priorRevenue), money(c.currentRevenue), pct(c.currentRevenue / c.priorRevenue)])} />
          <P>Revenue-weighted NRR is {pct(nrr)}: {money(churn.reduce((s, c) => s + c.currentRevenue, 0))} divided by {money(churn.reduce((s, c) => s + c.priorRevenue, 0))} for the same starting cohort. New customers are excluded and churned accounts remain in the denominator. Customer churn and revenue retention use different denominators.</P>
          <P>Orthopedics has the highest customer churn rate in this scenario. Review cancellation reasons and account size before attributing that churn to competitive or product gaps; no exit-survey evidence is included.</P>
        </Section>
        <Section title="6. Q2 investigation plan">
          <DataTable headers={["Sequence", "Action", "Evidence needed before expansion"]} rows={[
            ["Weeks 1–2", "Review Orthopedics losses and proposal aging", "Loss interviews and legal-review timestamps; test a review SLA if delays recur"],
            ["Weeks 2–4", "Pilot a referral program with a capped budget", "Incremental qualified opportunities, acquisition cost, and wins"],
            ["Weeks 2–4", "Compare paid and referral cohorts", "Comparable deal sizes, qualification rules, and cohort maturity"],
            ["Week 6", "Review pilot results before territory changes", "Observed conversion and capacity; retain a comparison cohort"],
          ]} />
          <P>These are proposed investigations. There is no validated incremental bookings forecast, staffing recommendation, or guaranteed churn reduction.</P>
        </Section>
        <Section title="7. Scenario arithmetic">
          <P>The following calculations illustrate sensitivity to explicit assumptions. They are not predictions, and they should not be added together because the opportunities could overlap.</P>
          <DataTable headers={["Scenario", "Calculation", "Illustrative result"]} rows={[
            ["20% more referral wins at the same average ACV", `${referral.wins} wins × 20% × ${money(referral.avgACV)}`, money(referral.bookings * 0.2)],
            ["Recover part of an assumed delayed pipeline", "$180,000 assumed delayed ACV × 30% assumed close rate", money(180000 * 0.3)],
            ["Raise pipeline / full-quarter target from 3.0x to 3.5x", `${shortMoney(current.target)} × 3.5; compared with ${shortMoney(current.pipeline)} today`, `${shortMoney(current.target * 3.5)} pipeline needed`],
          ]} />
          <P>The delayed-pipeline amount and close rate are scenario inputs, not measured fields. The coverage scenario needs {money(current.target * 3.5 - current.pipeline)} more qualified pipeline ({pct(current.target * 3.5 / current.pipeline - 1)} growth). Higher conversion may increase bookings, but does not itself increase this pipeline-to-target ratio.</P>
        </Section>
        <footer style={{ borderTop: "1px solid #ccd5dc", paddingTop: 20, color: "#4b5d69", fontSize: 13, lineHeight: 1.7 }}>
          Source: deterministic synthetic opportunity and retention records shared with AskGTM. Rounded displays may not sum exactly; calculations use unrounded values. <Link href="/methodology">View example SQL and metric assumptions</Link>.
        </footer>
      </article>
    </main>
  );
}
function Section({ title, children }) { return <section style={{ marginBottom: 32 }}><h2 style={{ fontSize: 21, marginBottom: 12, fontWeight: 650 }}>{title}</h2>{children}</section>; }
function P({ children }) { return <p style={{ fontSize: 15, lineHeight: 1.75, marginBottom: 12 }}>{children}</p>; }
function Note({ title, children }) { return <aside style={{ borderLeft: "3px solid #35635e", background: "#f1f6f5", padding: 16, lineHeight: 1.7, marginTop: 16 }}><strong>{title}. </strong>{children}</aside>; }
function DataTable({ headers, rows }) {
  return <div role="region" aria-label={headers.join(", ")} tabIndex={0} style={{ overflowX: "auto", margin: "14px 0 18px" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr>{headers.map((h, i) => <th key={h} scope="col" style={{ padding: "10px 12px", textAlign: i ? "right" : "left", borderBottom: "2px solid #526570", color: "#3d535e" }}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} style={{ background: i % 2 ? "#fff" : "#f5f7f8" }}>{row.map((cell, j) => <td key={j} style={{ padding: "10px 12px", textAlign: j ? "right" : "left", borderBottom: "1px solid #dde4e8", fontVariantNumeric: "tabular-nums", whiteSpace: j ? "nowrap" : "normal" }}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
