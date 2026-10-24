# GTM Healthcare Intelligence

Interactive GTM analytics exercises for specialty healthcare software. All scenarios are synthetic; source references do not imply a live connection.

**Live:** [gtm.kristenmartino.ai](https://gtm.kristenmartino.ai)
**Built by** [Kristen Martino](https://github.com/kristenmartino)

---

## Projects

### Interactive Apps

| App | Route | What It Demonstrates |
|-----|-------|---------------------|
| **SpectrumIQ** | `/spectrumiq` | Illustrative metro prioritization using synthetic provider counts and embedded demographic reference values |
| **PracticeFlow** | `/practiceflow` | Revenue cycle benchmarking against synthetic peer cohorts |
| **ConvertPath** | `/convertpath` | Completed lead-cohort conversion simulation plus a separately labeled synthetic deal-scoring sample |
| **SpecialtyPulse** | `/specialtypulse` | Procedure volume and reimbursement trend monitoring |
| **NorthStar** | `/northstar` | Synthetic metric registry, adoption snapshots, and statistical alerts with templated investigation steps |
| **AskPractice** | `/askpractice` | Calculated practice aggregates with provider and period filters |
| **AskGTM** | `/askgtm` | Claude questions over the same deterministic scenario used by the QBR |

### Supporting Resources

| Resource | Route | Description |
|----------|-------|-------------|
| **Methodology** | `/methodology` | Five SQL examples with assumptions and local regression fixtures; not warehouse-validated |
| **Q1 Review** | `/q1-review` | Quarterly business review analytical memo |

## Project Structure

```
gtm-healthcare-intel/
├── app/
│   ├── layout.js              # Root layout (metadata, fonts)
│   ├── page.js                # Home — two case studies and supporting exercises
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
│   └── api/
│       ├── ask/               # API route for AskPractice
│       └── askgtm/            # API route for AskGTM
├── lib/
│   ├── query-contract.mjs     # Shared schemas and strict input validation
│   ├── query-engine.mjs       # Record calculations and answer formatting
│   ├── query-service.mjs      # Model tool planning and constraint checks
│   ├── query-route.mjs        # Shared HTTP validation and failure handling
│   └── rate-limit.mjs         # Shared per-IP rate limiter for AI routes
├── data/
│   ├── pipeline/
│   │   ├── spectrumiq_pipeline.py   # CMS NPPES + Census ETL → metro scores
│   │   ├── deal_scoring_model.py    # L2 logistic regression deal scorer
│   │   ├── test_pipeline.py         # SpectrumIQ pipeline tests (30 tests)
│   │   └── test_deal_scoring.py     # Deal scoring model tests (36 tests)
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
# Add your Anthropic API key to .env.local (required for AskGTM; AskPractice needs no key)
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
```

### Tests

66 pytest tests across both pipelines covering data generation, feature engineering, model training, scoring, risk tier thresholds, recommendation logic, and output file validation.

```bash
cd data/pipeline
pytest test_pipeline.py -v       # 30 tests — SpectrumIQ pipeline
pytest test_deal_scoring.py -v   # 36 tests — deal scoring model
```

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Frontend:** React 18 (inline styles, no component library)
- **AI:** Anthropic Claude API for structured query interpretation in AskGTM and AskPractice; validated server tools calculate and format every numerical result
- **Data Pipelines:** Python (pandas, NumPy), L2 logistic regression
- **Testing:** pytest (66 tests across both pipelines)
- **Deployment:** Vercel with GitHub auto-deploys
- **Domain:** Custom subdomain via Vercel DNS

## Data Disclaimer

The QBR and AskGTM share `lib/gtm-scenario.mjs`; bookings, closed-cohort win rates, mean ACV, mean won cycle, quota attainment, and weighted NRR derive from those same invented records. The exercise preserves the $2.14M Q1 bookings / 31 wins and $1.98M Q4 bookings / 34 wins anchors; other views were reconciled to those totals. Scenario effects are explicitly assumed and are not forecasts.

Other tools are independent exercises: ConvertPath uses simulated completed lead cohorts plus a separate synthetic scoring sample; PracticeFlow uses hand-set cohort and payment-cycle assumptions; SpecialtyPulse uses hand-set procedure series; NorthStar uses simulated governance and time-series data; AskPractice uses fictional aggregate practice data. SpectrumIQ defaults to generated provider records and embedded metro references; an optional local NPPES/Census path is available. CMS, Census, MGMA, and HFMA mentions do not certify that displayed values were extracted from or validated against those sources. No patient or company records are used.

Mean won-cycle comparisons are calculated from the requested quarter, specialty, source, and rep filters; unsupported scopes request clarification instead of returning unfiltered results. Practice denial questions use calculated counts from one shared client/API scenario module, with provider and period filters. Other AI responses use supplied text summaries with precomputed denial counts, not SQL execution or warehouse tools. Instructions require observations to be separated from hypotheses and missing evidence to be acknowledged. These are model instructions, not guaranteed enforcement or a compliance certification.

## License

[MIT](LICENSE)

## Validated query tools

Both assistant routes use `query-service.mjs`: one schema-constrained Claude tool request is validated locally with Ajv and checked against explicit user constraints. `query_practice` and `query_gtm` run only on the checked-in synthetic records. The server renders the returned figures directly; model text, incomplete generations, invalid inputs and unknown tool calls never become numerical answers. There is no second model pass to rewrite calculated numbers.

Queries carry explicit periods, entity selections, grouping, aggregate predicates and rankings. Rankings can run within each period and preserve ties before display rounding. Independent measures carry independent filters; the engine rejects unsupported payer/procedure joins and absent denominators. Applied filters and the executed tool are inspectable beneath each answer. Interpretation is still a model decision, so ambiguous requests ask for clarification and the applied scope should be inspected.

QBR arithmetic includes gross rep shortfalls and overperformance separately. Retention uses the starting cohort; marketing uses a separate created-lead cohort. Causal explanations are bounded server templates, not generated claims. Both assistants require API connectivity for question interpretation; the static summaries and QBR remain available if it fails.

Run the API-key-free unit suite with `npm run test:scenario` and pipeline fixtures with `python -m pytest -q` from `data/pipeline`. Run real-model end-to-end checks against an explicitly selected local, preview or production server with `npm run eval:queries -- --base URL --suite full --out /absolute/path/results.json`. The `smoke` suite selects deployment checks. These opt-in checks call the model-backed service, preserve executed tool inputs/results, compare calculated fields to known anchors, and respect the public request limit.
