---
description: "GrassEye Amazon Product Sync law: read-only Seller Central product evidence sync for Amazon Manage."
applyTo: "src/plugins/amazon-product-sync/**/*.ts,src/app/workbench-amazon-product-sync-routes.ts,scripts/acceptance/amazon-product-sync.acceptance.ts,scripts/audit/domains/amazon-product-sync/**/*.ts"
---

# GrassEye Amazon Product Sync Law

Scope: `amazon-product-sync` is the only GrassEye owner for read-only Seller Central product evidence synchronization requested by ON-THE-WAY Amazon Manage.

Canonical chain:

```text
Workbench API Boundary
-> amazon-product-sync route
-> amazon-product-sync task service
-> amazon-product-sync explicit flow
-> BrowserController evaluateActiveTab/open
-> bounded evidence/result contract
```

## Required

- The job id is `amazon-product-sync`.
- The user-facing label is `Amazon 产品更新`.
- The plugin root is `src/plugins/amazon-product-sync/`.
- The external route namespace is `/api/plugins/amazon-product-sync/**`.
- The job input may contain marketplace, requestId, scope, and SKU/source-key items only.
- The job output may contain bounded Seller Central row evidence: seller SKU, ASIN snapshot, title snapshot, image evidence ref, listing status, available FBA units, inbound units, unfulfillable units, reserved units, 30-day sales snapshot, row evidence ref, and snapshot timestamp.
- Login, captcha, 2FA, ambiguous rows, and missing rows must be represented as structured statuses.
- The flow must persist task status so the caller can poll.
- Evidence refs must be opaque local refs, not public URLs and not raw HTML.
- The flow must use the existing BrowserController and Workbench runtime.
- The flow may perform read-only page reveal actions, such as expanding Seller Central parent/variation rows, before evidence extraction.

## Forbidden

- No Seller Central write action in this module.
- No Listing title, media, price, SKU, offer, fulfillment, or inventory update.
- No save, submit, edit, price, or inventory write click. Read-only variation expansion is the only allowed click-like DOM action.
- No cookies, storage, credentials, full HTML, or password fields in logs/results.
- No second HTTP server, second browser controller, second route bus, or generic shared `amazon` owner.
- No reuse of `amazon-invoice-upload` or `amazon-product-mining` as hidden owner.
- No external caller may provide selectors, browser commands, tab ids, cookies, credentials, action plans, flow steps, or expected output overrides.
- No imports from ON-THE-WAY.

## Law IDs

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-SYNC-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-sync",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+fs+acceptance",
  "summary": "Amazon product sync must be a single read-only job flow with bounded Seller Central evidence.",
  "forbidden": [
    "Seller Central write-back",
    "DOM selector control by external callers",
    "second Amazon product sync owner",
    "raw HTML/cookie/credential evidence leakage"
  ]
}
```
