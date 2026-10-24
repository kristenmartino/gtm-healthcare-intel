import Link from "next/link";

const CASE_STUDIES = [
  {
    number: "01", title: "Where does the sales pipeline lose momentum?",
    name: "Pipeline conversion", project: "ConvertPath", href: "/convertpath",
    description: "Compare stage conversion and sales cycle by specialty, source, and quarter. Use the deal review to see which accounts need a closer look.",
    method: "Stage conversion · Source comparison · Deal scoring",
    limitation: "Synthetic deals. Improvement scenarios are assumptions, not recovered revenue.",
    action: "Explore the funnel",
  },
  {
    number: "02", title: "Can the team agree on what the numbers mean?",
    name: "Metric definitions & reporting adoption", project: "NorthStar", href: "/northstar",
    description: "Review competing metric definitions, named owners, and reporting adoption. Inspect statistical alerts and the checks suggested for each deviation.",
    method: "Metric registry · Adoption tracking · Statistical alerts",
    limitation: "A simulated reporting environment. Alerts suggest investigations; they do not establish causes.",
    action: "Review the metrics",
  },
];

const TOOLS = [
  { title: "Market prioritization", name: "SpectrumIQ", href: "/spectrumiq", description: "Rank metros using provider density and demographic assumptions. Inspect the components behind each score." },
  { title: "Practice benchmarking", name: "PracticeFlow", href: "/practiceflow", description: "Compare revenue cycle measures with a synthetic peer cohort and explore a sample denial breakdown." },
  { title: "Procedure trends", name: "SpecialtyPulse", href: "/specialtypulse", description: "Compare illustrative procedure volumes and reimbursement trends across specialties." },
  { title: "GTM questions", name: "AskGTM", href: "/askgtm", description: "Ask Claude about a synthetic sales dataset. Review the data summary and limits behind its answers." },
  { title: "Practice questions", name: "AskPractice", href: "/askpractice", description: "Ask about aggregate practice performance using a fictional practice dataset." },
];

export default function Home() {
  return (
    <div className="portfolio-home">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="portfolio-nav">
        <span className="portfolio-author">Kristen Martino<span>Analytics portfolio</span></span>
        <a href="https://github.com/kristenmartino/gtm-healthcare-intel" target="_blank" rel="noopener noreferrer">View source <span aria-hidden="true">↗</span></a>
      </header>
      <main id="main" className="portfolio-main">
        <section className="portfolio-intro" aria-labelledby="portfolio-title">
          <div>
            <p className="portfolio-eyebrow">Specialty healthcare · Synthetic demos</p>
            <h1 id="portfolio-title">GTM analytics for specialty healthcare software.</h1>
            <p className="portfolio-lede">Interactive demos exploring pipeline conversion, market prioritization, and metric governance. Each example explains its data, calculations, and limitations.</p>
          </div>
          <aside className="portfolio-data-note" aria-label="Data scope">
            <span className="portfolio-note-label">About the data</span>
            <p>These are demonstrations using synthetic data and reference assumptions. They contain no patient or company data.</p>
            <p>Public source references describe the intended inputs. They do not establish a live data connection.</p>
          </aside>
        </section>
        <section className="portfolio-section" aria-labelledby="case-studies-title">
          <div className="portfolio-section-heading"><h2 id="case-studies-title">Two questions to start with</h2><span>Interactive case studies</span></div>
          <div className="portfolio-cases">
            {CASE_STUDIES.map(study => (
              <article key={study.href} className="portfolio-case">
                <span className="portfolio-case-number" aria-hidden="true">{study.number}</span>
                <div className="portfolio-case-main">
                  <p className="portfolio-case-label">{study.name} <span>/ {study.project}</span></p>
                  <h3><Link href={study.href}>{study.title}</Link></h3>
                  <p className="portfolio-case-description">{study.description}</p>
                  <Link className="portfolio-action" href={study.href}>{study.action} <span aria-hidden="true">→</span></Link>
                </div>
                <dl className="portfolio-case-notes">
                  <div><dt>What to inspect</dt><dd>{study.method}</dd></div>
                  <div><dt>Keep in mind</dt><dd>{study.limitation}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>
        <section className="portfolio-section" aria-labelledby="tools-title">
          <div className="portfolio-section-heading"><h2 id="tools-title">More ways to explore</h2><span>Five supporting demos</span></div>
          <div className="portfolio-tools">
            {TOOLS.map(tool => (
              <Link href={tool.href} key={tool.href} className="portfolio-tool">
                <div className="portfolio-tool-title"><h3>{tool.title}</h3><span>{tool.name}</span></div>
                <p>{tool.description}</p><span className="portfolio-tool-arrow" aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="portfolio-section portfolio-resources" aria-labelledby="resources-title">
          <div className="portfolio-section-heading"><h2 id="resources-title">Behind the analysis</h2></div>
          <div className="portfolio-resource-list">
            <Link href="/q1-review"><span>01 / Analytical memo</span><h3>Illustrative Q1 review <span aria-hidden="true">↗</span></h3><p>Reconciled scenario figures, observations, and proposed follow-up work.</p></Link>
            <Link href="/methodology"><span>02 / Metric definitions</span><h3>Example SQL <span aria-hidden="true">↗</span></h3><p>Calculation logic, denominator choices, and implementation assumptions.</p></Link>
            <a href="https://github.com/kristenmartino/gtm-healthcare-intel/tree/main/data/pipeline" target="_blank" rel="noopener noreferrer"><span>03 / Source code</span><h3>Python pipelines <span aria-hidden="true">↗</span></h3><p>Data generation, score calculations, and automated checks.</p></a>
          </div>
        </section>
        <footer className="portfolio-footer">
          <p>Built by Kristen Martino.</p>
          <p>React and Next.js for the interactive views; Python for data pipelines and deal scoring; the Claude API for GTM questions; calculated scenario records for practice questions. Data and model limitations are documented in each demo.</p>
        </footer>
      </main>
    </div>
  );
}
