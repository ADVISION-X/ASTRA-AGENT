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

### Amazon Product Sync

- Owner: `src/plugins/amazon-product-sync/**`.
- Purpose: read-only Seller Central product evidence sync for ON-THE-WAY Amazon Manage.
- Data returned: SKU row evidence including ASIN snapshot, title snapshot, listing status, available FBA units, actual inventory units, inbound, unfulfillable, reserved, 30-day sales snapshot, main image evidence/ref transfer result, snapshot timestamp.
- Search implementation: uses Seller Central inventory filter Katal search input, excludes top global Seller Central search, writes open shadow input, installs host value getter for React state, dispatches composed input/change, waits 1000-2000 ms, dispatches DOM mouse events on the inventory search button, then verifies exact SKU row from result DOM.
- Boundary: read-only. No title, media, price, SKU, offer, fulfillment, inventory, save, submit, or edit write actions. Main image may only be transferred as real image bytes to the fixed ON-THE-WAY upload endpoint when requested.

### Amazon Product Fee Sync

- Owner: `src/plugins/amazon-product-fee-sync/**`.
- Purpose: read-only Seller Central fee evidence sync for Amazon Manage product profitability.
- Data returned: total Amazon fee, FBA fulfillment fee, derived non-fulfillment residual, referral fee status, evidence refs, terminal status.
- Fee semantics: `amazonNonFulfillmentFeeResidual = totalAmazonFee - fbaFulfillmentFee` only when both are visible; it must not be called referral fee. If direct referral fee is not visible, `referralFeeAmount = null` and `referralFeeStatus = not_visible_in_current_dom`.
- Boundary: independent from product sync. Fee fields must not be added to `amazon-product-sync` required fields.

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
- External evidence exceptions: may request AGENT `amazon-product-sync` and `amazon-product-fee-sync` for read-only Seller Central evidence, saved as external snapshot/fee snapshot. This evidence is for backend operations and cannot become Amazon Listing, SCC product, storefront, price, title, or media truth.
- Product sync is backend-sovereign: website creates/reads backend batches; backend owns SKU queue, AGENT task id, status, terminal ingestion, counters, and failure reason.

## Current Listing Optimization Work

Goal: build evidence-backed title, bullet, description, and variation recommendations for each variant on Amazon AE, including the 2026 new variant called "第二款".

Required evidence before recommendations:

- Current Seller Central edit fields and their exact filled values for every variant, including parent and the 2026 "第二款" variant.
- Current live Amazon AE listing page values: title, variation labels, bullets, description/A+ if present, images, price, coupon/deal, rating/review count, delivery promise, stock state.
- Amazon Ads ROAS > 3 keywords/search terms from uploaded report data, with date range and spend/sales/orders context.
- Last-year versus current sales trend evidence, especially sessions, unit session percentage, conversion, Buy Box, price, ads spend, organic rank, review/rating, stock, and competitor changes.
- Core keyword competitor evidence: title, bullets, main image, rating, reviews, price, coupon, delivery, variants, review themes, negative review complaints, and positioning.

No final listing rewrite should be treated as ready until the above evidence is complete or missing items are explicitly marked as unavailable.
