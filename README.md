# GTM Healthcare Intelligence

Interactive analytics portfolio demonstrating go-to-market business intelligence for the specialty healthcare EHR space.

**Live:** [gtm.kristenmartino.ai](https://gtm.kristenmartino.ai)
**Built by** [Kristen Martino](https://github.com/kristenmartino)

---

## Projects

### Interactive Apps

| App | Route | What It Demonstrates |
|-----|-------|---------------------|
| **SpectrumIQ** | `/spectrumiq` | Market opportunity scoring — ranks metros for specialty EHR adoption using pipeline-fed CMS/Census data |
| **PracticeFlow** | `/practiceflow` | Revenue cycle benchmarking against synthetic peer cohorts |
| **ConvertPath** | `/convertpath` | SaaS funnel analysis with leaky-bucket diagnostics and ML-scored deal health |
| **SpecialtyPulse** | `/specialtypulse` | Procedure volume and reimbursement trend monitoring |
| **NorthStar** | `/northstar` | Executive KPI dashboard with anomaly detection engine (rolling z-score, prescriptive alerts) |
| **AskPractice** | `/askpractice` | AI-powered natural language practice performance queries (Claude API) |
| **AskGTM** | `/askgtm` | AI-powered GTM pipeline intelligence (Claude API) |

### Supporting Resources

| Resource | Route | Description |
|----------|-------|-------------|
| **Methodology** | `/methodology` | SQL methodology reference for every NorthStar GTM metric |
| **Q1 Review** | `/q1-review` | Quarterly business review analytical memo |

## Project Structure

```
gtm-healthcare-intel/
├── app/
│   ├── layout.js              # Root layout (metadata, fonts)
│   ├── page.js                # Home — project grid + maturity model
│   ├── globals.css
│   ├── spectrumiq/            # Market opportunity scoring
│   ├── practiceflow/          # Revenue cycle benchmarking
│   ├── convertpath/           # Funnel analysis + deal health
│   ├── specialtypulse/        # Procedure trend monitoring
│   ├── northstar/             # KPI dashboard + anomaly detection
│   ├── askpractice/           # AI practice queries
│   ├── askgtm/                # AI GTM intelligence
│   ├── methodology/           # SQL methodology reference
│   ├── q1-review/             # QBR analytical memo
│   └── api/askgtm/            # API route for AskGTM
├── data/
│   ├── pipeline/
│   │   ├── spectrumiq_pipeline.py   # CMS NPPES + Census ETL → metro scores
│   │   ├── deal_scoring_model.py    # L2 logistic regression deal scorer
│   │   └── test_pipeline.py         # pytest suite (28 tests)
│   └── output/
│       ├── pipeline_metadata.json
│       └── model_metrics.json
├── public/
│   ├── metro_scores.json      # Pipeline output → SpectrumIQ
│   └── deal_scores.json       # Model output → ConvertPath Deal Health
└── package.json
```

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.10+ (for data pipelines only)

### Frontend

```bash
npm install
cp .env.local.example .env.local
# Add your Anthropic API key to .env.local (required for AskPractice and AskGTM)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Data Pipelines (optional)

The Python pipelines regenerate the JSON data files consumed by the frontend. You don't need to run them to use the app — the output files are checked in.

```bash
cd data/pipeline
pip install -r ../../requirements.txt
python spectrumiq_pipeline.py    # → public/metro_scores.json
python deal_scoring_model.py     # → public/deal_scores.json
pytest test_pipeline.py          # 28 tests
```

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Frontend:** React 18 (inline styles, no component library)
- **AI:** Anthropic Claude API (AskPractice, AskGTM)
- **Data Pipelines:** Python (pandas, NumPy), L2 logistic regression
- **Deployment:** Vercel with GitHub auto-deploys
- **Domain:** Custom subdomain via Vercel DNS

## Data Disclaimer

All data in these projects is synthetic or derived from publicly available government datasets (CMS NPPES, Medicare PUF, Census Bureau, MGMA/HFMA benchmarks). No proprietary, patient, or company-specific data was used. Benchmarks are modeled on published industry distributions for demonstration purposes.

## License

[MIT](LICENSE)
