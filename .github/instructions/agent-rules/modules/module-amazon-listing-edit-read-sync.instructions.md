---
description: Amazon Seller Central listing edit read sync governance.
applyTo: "src/plugins/amazon-listing-edit-read-sync/**/*.ts,src/app/workbench-amazon-listing-edit-read-sync-routes.ts,scripts/acceptance/amazon-listing-edit-read-sync.acceptance.ts,scripts/audit/domains/amazon-listing-edit-read-sync/**/*.ts"
---

# Amazon Listing Edit Read Sync Law

Status: active
Scope: `amazon-listing-edit-read-sync` is the only GrassEye owner for read-only Seller Central inventory-to-listing-edit DOM export.

## Single Owner Chain

```apex-law
{
  "lawId": "APEX-AMAZON-LISTING-EDIT-READ-SYNC-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-listing-edit-read-sync",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+fs+acceptance",
  "summary": "Listing edit read sync must run as an independent plugin owner, not through amazon-product-sync or amazon-product-fee-sync."
}
```

Required chain:

`/api/plugins/amazon-listing-edit-read-sync/start`
-> `workbench-amazon-listing-edit-read-sync-routes.ts`
-> `src/plugins/amazon-listing-edit-read-sync/**`
-> existing `BrowserController`
-> Seller Central DOM read
-> persisted task artifact.

Forbidden:

- importing private implementation files from `amazon-product-sync` or `amazon-product-fee-sync`
- adding a second browser controller
- exposing selectors, coordinates, browser commands, cookies, storage, or raw HTML through task input
- treating this owner as a write/update/listing-save capability

## Read-Only Seller Central Boundary

```apex-law
{
  "lawId": "APEX-AMAZON-LISTING-EDIT-READ-SYNC-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-listing-edit-read-sync",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+chrome+acceptance",
  "summary": "Seller Central interactions are limited to navigation, read-only variation expansion, and DOM value extraction."
}
```

Allowed:

- open Seller Central inventory pages
- reveal inventory variation children by clicking already-visible variation expanders
- open SKU Central and listing edit tab pages
- read bounded text, label/value pairs, form control values, tab labels, image URLs, and page diagnostics

Forbidden:

- Save, submit, publish, upload, delete, price update, inventory update, send/replenish inventory, file input mutation, or any Seller Central write action
- reading or persisting cookies, localStorage, sessionStorage, passwords, or full HTML snapshots

## Inventory ASIN/SKU Evidence

```apex-law
{
  "lawId": "APEX-AMAZON-LISTING-EDIT-READ-SYNC-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-listing-edit-read-sync",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "chrome-dom+acceptance",
  "summary": "Inventory export evidence must come from Seller Central DOM label/value rows after parent variation expansion."
}
```

The task must collect ASIN and SKU from DOM label/value structures such as Seller Central inventory row fields. Parent rows with visible variation expanders must be expanded before final inventory collection. Input value presence alone is not search success proof.

## Listing Edit Tab DOM Contract

```apex-law
{
  "lawId": "APEX-AMAZON-LISTING-EDIT-READ-SYNC-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-listing-edit-read-sync",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "chrome-dom+acceptance",
  "summary": "Each listing edit tab read must record bounded DOM controls and diagnostics, never fabricated values."
}
```

The governed edit tabs are:

- `product_details`
- `images`
- `variations`
- `offer`
- `safety_and_compliance`

For each tab the task must record page URL path, title, detected tab labels, bounded controls, bounded image references, and missing/blocker reason. A tab may be marked `blocked` or `not_available`, but it must not be reported as read unless DOM controls or explicit empty-state diagnostics were observed on that tab page.

## Evidence and Privacy

```apex-law
{
  "lawId": "APEX-AMAZON-LISTING-EDIT-READ-SYNC-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-listing-edit-read-sync",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+fs",
  "summary": "Task artifacts must use bounded business evidence and redacted evidence refs."
}
```

Artifacts may persist ASIN, SKU, FNSKU, bounded listing field values, image source URLs, page titles, and URL paths. Artifacts must not persist full HTML, cookies, storage, passwords, or user-provided browser control instructions.

## Acceptance and Audit

```apex-law
{
  "lawId": "APEX-AMAZON-LISTING-EDIT-READ-SYNC-006-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-listing-edit-read-sync",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "generated-plan+acceptance",
  "summary": "The capability must have owner audit, acceptance, generated plan registration, and ci:full integration."
}
```

Required:

- active law metadata in this module
- construction blueprint `docs/法案辅助文件/GrassEye Amazon Listing Edit Read Sync 施工图.md`
- owner manifest and inspector under `scripts/audit/domains/amazon-listing-edit-read-sync/`
- task acceptance `scripts/acceptance/amazon-listing-edit-read-sync.acceptance.ts`
- package scripts `acceptance:amazon-listing-edit-read-sync` and `audit:amazon-listing-edit-read-sync`
- `ci:full` acceptance phase entry

## Live Seller Central Safety Gate

```apex-law
{
  "lawId": "APEX-AMAZON-LISTING-EDIT-READ-SYNC-007-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-listing-edit-read-sync",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "chrome-dom+acceptance",
  "summary": "Live Seller Central runs must advance one proven step at a time: inventory-only by default, single SKU search-only before any edit tab mode."
}
```

Until Chrome proof for every step is stable, production code must enforce:

- default `safetyMode` is `inventory-only`
- SKU search proof must use explicit `safetyMode: "single-sku-search-only"` before any edit tab run
- SKU Central DOM proof must use explicit `safetyMode: "single-sku-sku-central-only"` before any edit tab run
- edit tab reads require explicit `safetyMode: "single-sku-edit-tabs"`
- single SKU modes may read at most one SKU per run
- full inventory batch reads require explicit `safetyMode: "all-inventory-edit-tabs"` and must remain sequential
- ASIN/SKU parsing must reject concatenated or cross-label values

## Full Inventory Batch Read Gate

```apex-law
{
  "lawId": "APEX-AMAZON-LISTING-EDIT-READ-SYNC-008-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-listing-edit-read-sync",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "chrome-dom+acceptance",
  "summary": "Full inventory listing edit reads may run only as an explicit read-only sequential batch with pagination, per-item progress persistence, and stop-on-first-issue semantics."
}
```

Required for `safetyMode: "all-inventory-edit-tabs"`:

- inventory scope must be `all-inventory-pages`
- inventory pages must be opened through the existing Seller Central inventory URL and aggregated by unique ASIN/SKU
- each SKU must restart from the inventory page before executing the proven inventory filter search
- items must run sequentially; no parallel SKU tabs and no parallel edit tab fanout
- progress must persist after each inventory page and after each completed item
- default `stopOnFirstIssue` must be true; a blocked, not_found, parse_failed, login, captcha, review, or unread tab result must stop the batch as `review_required`
- edit TAB export must include blank field values as observed DOM values, bounded visible text, controls, headings, tab labels, image URLs, and save-action labels as risk evidence only

Forbidden for full inventory batch:

- continuing past the first non-production issue when `stopOnFirstIssue` is true
- using a guessed SKU Central link when the inventory search result DOM did not expose exactly one `/skucentral` href
- using a second browser controller, second route, second evidence store, or hidden fallback flow
- clicking save, submit, publish, upload, delete, image movement, price update, inventory update, send inventory, or any write action

## App Shell Skill Workspace Gate

```apex-law
{
  "lawId": "APEX-AMAZON-LISTING-EDIT-READ-SYNC-009-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-listing-edit-read-sync",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+acceptance+visual",
  "summary": "The capability must expose a bounded App Shell skill workspace for target selection, task start, status, and evidence inspection without browser-control or write-action UI."
}
```

Required:

- App Shell Skill Registry must register `amazon-listing-edit-read-sync` as an active skill.
- The skill workspace must expose structured controls for marketplace, safety mode, target mode, ASIN/SKU parent-child target fields, product type, tabs, max items, and stop-on-first-issue.
- The workspace must call the existing `/api/plugins/amazon-listing-edit-read-sync/start`, `/status/:taskId`, and `/latest` routes only.
- The workspace must display task status, reached step, reason, target resolution, inventory count, item count, tab status, and evidence refs.
- Detail inspection must use the existing App Shell Inspector or bounded workspace tables.

Forbidden:

- selector, coordinate, browser command, raw HTML, cookie, storage, or full page dump inputs
- save, submit, publish, upload, delete, price, inventory, or image-mutation buttons
- browser-controller buttons, DOM-controller buttons, or app-shell-owned workflow order
- a second app shell, second route tree, or second listing-edit UI chain

## Controlled Target Execution Gate

```apex-law
{
  "lawId": "APEX-AMAZON-LISTING-EDIT-READ-SYNC-010-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-listing-edit-read-sync",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "chrome-dom+acceptance",
  "summary": "Specified ASIN, SKU, parent, and child targets must be resolved from Seller Central DOM evidence before any SKU Central or edit-tab read."
}
```

Allowed target modes:

- `inventory`
- `asin`
- `sku`
- `parent`
- `child`
- `all-inventory`

Required:

- Target input must be structured as bounded ASIN/SKU fields, not selectors or browser commands.
- `asin` target mode must resolve exactly one inventory item by DOM ASIN evidence.
- `sku` target mode must resolve exactly one inventory item by DOM SKU evidence.
- `parent` target mode must match a parent row or parent hint, expand its variation group, and record child item evidence.
- `child` target mode must match a child row and, when parent fields are supplied, prove the child belongs to the supplied parent group.
- Ambiguous, missing, cross-label, or unproven target resolution must stop as `review_required` before SKU Central or edit tabs.
- The task artifact must persist bounded target resolution evidence: mode, requested fields, status, reason, matched parent, matched child, candidate count, and evidence refs.

Forbidden:

- trusting user-provided parent/child claims without Seller Central DOM proof
- opening SKU Central for a guessed child when target resolution is ambiguous
- treating parent rows as child listing results
- claiming a complete variation matrix from the `variations` edit tab unless child table DOM proof exists
