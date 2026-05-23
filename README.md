# Company Intelligence Brief Generator

AI-powered Next.js application that generates a structured, sales-oriented company intelligence brief from a single company name input.

## What it does

Given a company name, the app:

1. Enriches profile data from public/data providers
2. Gathers growth, business, and employee-experience intelligence
3. Produces a concise executive summary
4. Returns a clean, structured JSON brief with confidence and source attribution

## Output structure

- **Company Snapshot**
- **Growth & Business Signals**
- **Benefits & Employee Experience Signals**
- **Recent News (3–5 items with “why it matters”)**
- **Buying Committee Suggestions**
- **Sales Recommendation**
- **Confidence Layer** (per inferred/estimated field)

The UI also renders:

- Search input
- Generate Brief button
- Executive summary card
- Expandable sections for each intelligence category
- Raw JSON panel for downstream integrations

## Tech stack

- Next.js (App Router)
- TypeScript
- Server-side API routes
- Modular provider + intelligence pipeline
- Prepared CRM integration interface for future Pipedrive sync

## Environment variables

Copy `.env.example` to `.env.local` and add keys as available:

```bash
cp .env.example .env.local
```

Supported keys:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: `gpt-4.1-mini`)
- `NEWS_API_KEY`
- `CRUNCHBASE_API_KEY`
- `CLEARBIT_API_KEY`
- `APOLLO_API_KEY`
- `PIPEDRIVE_API_TOKEN` (reserved for future integration)

The app gracefully degrades if some keys are missing and reports warnings in the response.
It also works without any premium API keys using public-source fallback mode (Wikipedia, DuckDuckGo, Google News RSS, and company website scanning).

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

Note: this project is configured to run Next.js with **Webpack** (not Turbopack) by default for better cross-platform compatibility in environments where Turbopack native bindings are unavailable.

### Troubleshooting

If you encounter a Next.js invariant error like:

`Invariant: Expected workStore to be initialized`

run:

```bash
rm -rf .next
npm install
npm run dev
```

The app is also configured with a dynamic root segment and explicit error/not-found routes to avoid this class of environment-specific App Router issues.
## API

### `POST /api/brief`

Request body:

```json
{
  "companyName": "Stripe",
  "userProvided": {
    "industrySegment": "Fintech"
  }
}
```

`userProvided` fields are preserved and never overwritten by inferred values.

Response:

```json
{
  "executiveSummary": "...",
  "brief": {
    "companySnapshot": {},
    "growthBusinessSignals": [],
    "benefitsEmployeeExperienceSignals": [],
    "recentNews": [],
    "buyingCommitteeSuggestions": [],
    "salesRecommendation": {},
    "confirmedFacts": [],
    "inferredInsights": [],
    "estimatedValues": []
  },
  "generatedAt": "2026-01-01T00:00:00.000Z",
  "warnings": []
}
```

## Architecture overview

- `src/app/api/brief/route.ts` - server-side endpoint and validation
- `src/lib/intelligence/brief-generator.ts` - orchestration + deterministic fallback
- `src/lib/providers/*` - provider-specific API adapters
- `src/lib/integrations/crm/*` - CRM integration contracts (Pipedrive-ready)
- `src/components/*` - modular UI and expandable brief rendering
