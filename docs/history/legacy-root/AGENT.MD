# AGENT Operating Notes

## Hard Rules

- Before operating across repositories or consuming files from another repository, first search for and read that repository's `AGENT.md`, `AGENT.MD`, or `AGENTS.md`.
- If no agent file exists in the target repository, record that fact before proceeding.
- Do not use mock, fabricated, placeholder, or guessed data for production analysis, Amazon operations, evidence, uploads, or listing optimization.
- Generated audit artifacts are read-only truth snapshots. Do not hand-edit generated files as source truth.
- Keep Amazon work single-chain. Do not introduce second route buses, second browser controllers, fallback flows, shadow implementations, or compatibility bridges.
- External callers must not provide Seller Central selectors, browser commands, cookies, credentials, action plans, flow steps, tab ids, or expected output overrides.
- Seller Central write actions are forbidden unless the specific task explicitly authorizes a write and the governing module allows that write.

## Repository Scan Baseline

- `/Users/nexgen/Documents/AGENT/` contains `AGENTS.md`; it has been read for this task.
- `/Users/nexgen/Documents/ON-THE-WAY/` had no `AGENT.md`, `AGENT.MD`, or `AGENTS.md` found during the scan for this task.

## Amazon Skills In AGENT

### Amazon Product Mining

- Owner: `src/plugins/amazon-product-mining/**`.
- Purpose: keyword-driven Amazon search extraction, product detail extraction, review pagination, evidence persistence, package/PDF generation, and handoff for deeper AI analysis.
- Fixed flow: intake -> keyword AI send/capture/parse/dedup -> Amazon search -> product detail -> reviews -> keyword package -> opportunity review -> task package/master report -> complete.
- Important boundary: Agent produces evidence packages and keyword-level opportunity review only. It must not make final product investment, purchasing, ad budget, profit, or listing decisions as production truth.
- Implementation shape: uses existing DOM automation, AI input gateway, forensic persistence, runtime logging, local browser session, SQLite/file storage. No new Amazon mining ability group or second mission loop.

### Amazon Invoice Upload

- Owner: `src/plugins/amazon-invoice-upload/**`.
- Purpose: single unified chain for tax invoice CSV download pre-stage and approved invoice PDF upload.
- Fixed flow: intake -> tax invoice CSV download -> artifact persist -> website status/callback -> approved invoice upload -> human final submit or authorized auto submit -> verify -> complete.
- Boundary: no second invoice download/upload owner, no external selectors/browser commands/cookies/flow steps, no raw CSV/documentId/local path leakage.

## ON-THE-WAY Amazon Parasite Modules

### Amazon Ads

- Boundary: `src/features/amazon-ads/`, `src/app/apex/amazon-ads/`, `src/app/api/apex/amazon-ads/`, `prisma-amzads/`.
- Data source: operator-uploaded reports only. No direct Amazon API, SP-API, Ads API SDK, or automatic Amazon data sync.
- Useful for listing optimization: uploaded search term reports, ROAS classification, ROAS_PLAN terms, FISHING terms, negative lifecycle, bid/transfer audit history.
- Operational rule: recommendations are pending until operator confirmation; execution writes must be audited.

### Amazon Manage Products

- Boundary: `src/features/amazon-manage/amazon-products/`, `/apex/amazon-manage/products`, `/api/apex/amazon-manage/products`, `prisma-amzmgr/`.
- Product source truth: imported Amazon order summary rows by ASIN or SKU, with ASIN preferred and SKU fallback.
- Allowed manual fields: ASIN, current inventory, backend operational main image attachment.
## Current Listing Optimization Work

Goal: build evidence-backed title, bullet, description, and variation recommendations for each variant on Amazon AE, including the 2026 new variant called "第二款".

Required evidence before recommendations:

- Current Seller Central edit fields and their exact filled values for every variant, including parent and the 2026 "第二款" variant.
- Current live Amazon AE listing page values: title, variation labels, bullets, description/A+ if present, images, price, coupon/deal, rating/review count, delivery promise, stock state.
- Amazon Ads ROAS > 3 keywords/search terms from uploaded report data, with date range and spend/sales/orders context.
- Last-year versus current sales trend evidence, especially sessions, unit session percentage, conversion, Buy Box, price, ads spend, organic rank, review/rating, stock, and competitor changes.
- Core keyword competitor evidence: title, bullets, main image, rating, reviews, price, coupon, delivery, variants, review themes, negative review complaints, and positioning.

No final listing rewrite should be treated as ready until the above evidence is complete or missing items are explicitly marked as unavailable.
