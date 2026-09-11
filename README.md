# Modafied Site (modafied.org)

The official public website, scorecards, and published artifact contracts for **Modafied: Independent Data Benchmarks for Apps and Agents**.

Modafied snapshots public feeds on a schedule, preserves every snapshot forever, diffs them, and publishes a six-dimension scorecard per source with the exact method and version.

## What is Inside This Repository

- **Astro Static Site:** Fast, accessible, mobile-first static website built with Astro 5.
- **Public Scorecards:** Objective evaluations of public feeds (NWS, USGS, Open-Meteo, BLS, FRED) across six dimensions plus anchored accuracy (Rule H1).
- **Public Artifact Contracts (v1):**
  - `v1/manifest.json`: Publication manifest with SHA-256 digests, byte counts, and record counts.
  - `v1/catalog.json`: Validated source definitions with explicit license citations and usage terms.
  - `v1/scorecards/<id>.json`: Individual source scorecards.
  - `v1/changes/<id>.jsonl`: Append-only stream of detected mutations and revisions.
- **Scoring Methodology:** Definitions of freshness lag, revision behavior, correction latency, completeness by segment, schema stability, and internal consistency.
- **Community Contributions:** 4-step onboarding flow for community members and providers to add feeds via declarative YAML adapters.

## Local Development

Prerequisites: Node.js 20+ or 22+.

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev
```

Visit `http://localhost:4321` in your browser.

## Building for Production

```bash
npm run build
```

Compiled static output is in `./dist/` and deployed automatically to GitHub Pages via GitHub Actions.

## Custom Domain

Configured for **`https://modafied.org`** (and alias `https://modafied.ai`).

## License

Apache-2.0. See [LICENSE](LICENSE).
