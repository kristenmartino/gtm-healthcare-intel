# GTM Healthcare Intelligence

Five interactive analytics projects demonstrating go-to-market business intelligence for the specialty healthcare / EHR space.

**Built by Kristen Martino** · All data is synthetic or derived from public sources (CMS NPPES, Medicare PUF, Census Bureau, MGMA/HFMA benchmarks).

## Projects

| Project | Route | What It Demonstrates |
|---------|-------|---------------------|
| **SpectrumIQ** | `/spectrumiq` | Market opportunity scoring — ranks metros for specialty EHR adoption |
| **PracticeFlow** | `/practiceflow` | Revenue cycle benchmarking against synthetic peer cohorts |
| **ConvertPath** | `/convertpath` | SaaS sales funnel analysis with leaky bucket diagnostics |
| **SpecialtyPulse** | `/specialtypulse` | Procedure volume & reimbursement trend monitoring |
| **AskPractice** | `/askpractice` | AI-powered natural language practice performance queries |

## Deploy to Vercel

### 1. Push to GitHub
```bash
cd gtm-healthcare-intel
git init
git add .
git commit -m "GTM healthcare intelligence portfolio"
gh repo create gtm-healthcare-intel --public --push
```

### 2. Deploy on Vercel
- Go to [vercel.com/new](https://vercel.com/new)
- Import the `gtm-healthcare-intel` repo
- Add environment variable: `ANTHROPIC_API_KEY` = your key from [console.anthropic.com](https://console.anthropic.com/)
- Click Deploy

### 3. Custom domain (optional)
In Vercel dashboard → Settings → Domains, add a subdomain like `gtm.kristenmartino.com`

## Local Development
```bash
npm install
cp .env.local.example .env.local
# Add your Anthropic API key to .env.local
npm run dev
```

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Frontend:** React 18
- **AI:** Anthropic Claude API (AskPractice only)
- **Data:** Synthetic datasets modeled on CMS/MGMA/HFMA public benchmarks
- **Deployment:** Vercel

## Data Disclaimer
All data in these projects is synthetic or derived from publicly available government datasets. No proprietary, patient, or company-specific data was used. Benchmarks are modeled on published industry distributions for demonstration purposes.
