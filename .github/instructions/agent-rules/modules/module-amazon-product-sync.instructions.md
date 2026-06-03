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
-> BrowserController open/evaluateActiveTab/click/screenshotRegion
-> bounded evidence/result contract
```

## Required

- The job id is `amazon-product-sync`.
- The user-facing label is `Amazon 产品更新`.
- The plugin root is `src/plugins/amazon-product-sync/`.
- The external route namespace is `/api/plugins/amazon-product-sync/**`.
- The website-side request must contain the site identifier, requestId, marketplace, and exactly one SKU item with explicit requiredFields. Product update is fixed-scope: the item must request `mainImage`, `asin`, and `availableInventory` together.
- AGENT task input must reject multi-SKU `items`. The website side owns the SKU queue and may call the existing start/status chain repeatedly, one SKU at a time.
- The job input may contain site, marketplace, requestId, scope, and SKU/source-key items only. The website must not send selector/action/browser data, and neither side may narrow the field set from website missing-field state.
- The job output may contain bounded Seller Central row evidence: site, seller SKU, requested fields, missing requested fields, ASIN snapshot, title snapshot, image evidence ref, listing status, available FBA units, inbound units, unfulfillable units, reserved units, 30-day sales snapshot, row evidence ref, and snapshot timestamp.
- Login, captcha, 2FA, missing inventory search control, failed search submission, ambiguous rows, and missing rows must be represented as structured statuses.
- The flow must persist observable task progress for key Seller Central actions, and a started background flow must reach a terminal persisted status instead of staying forever at `running` / `flow_started`.
- Status reads must fail stale queued/running tasks that have not advanced recently; a restarted AGENT must not leave the website blocked by an old `running` task.
- Evidence refs must be opaque local refs, not public URLs and not raw HTML.
- Main image evidence refs must be backed by a real BrowserController screenshot capture for that task. A public image URL or string fabricated from `img[src]` is not valid evidence.
- The flow must use the existing BrowserController and Workbench runtime.
- The flow may perform read-only page reveal actions, such as expanding Seller Central parent/variation rows, before evidence extraction.
- The SKU search entry must be the inventory filter search control above the inventory table. It must identify the Katal search input whose placeholder is `搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN` and must support its open shadow DOM input.
- The flow must explicitly exclude Seller Central top global search: `form#sc-global-search-form`, `input#sc-search-field`, and `button.sc-search-button`.
- SKU search submission must write the requested SKU into the inventory Katal host's open shadow input `input[type='text'], input`, dispatch composed `input` and `change` events, and click only the inventory filter search button. Coordinate focus plus OS text input is not valid for this search because it can focus the Katal host without updating the inner input.
- Search success must be verified from Seller Central result DOM, URL search state, result count, or exact target SKU row. A focused input value or typed text alone is not success evidence.
- Target row selection must use structured label/value extraction. The row must contain a `SKU` pair exactly equal to the requested SKU and must expose `ASIN` and inventory labels from the same Seller Central row.

## Forbidden

- No Seller Central write action in this module.
- No Listing title, media, price, SKU, offer, fulfillment, or inventory update.
- No save, submit, edit, price, or inventory write click. Read-only inventory search submission and read-only variation expansion are the only allowed click-like DOM actions.
- No top Seller Central global search for SKU lookup.
- No success result based only on an input value.
- No row matching by whole-row text contains, fuzzy score, or expected output override.
- No cookies, storage, credentials, full HTML, or password fields in logs/results.
- No second HTTP server, second browser controller, second route bus, or generic shared `amazon` owner.
- No reuse of `amazon-invoice-upload` or `amazon-product-mining` as hidden owner.
- No external caller may provide selectors, browser commands, tab ids, cookies, credentials, action plans, flow steps, or expected output overrides.
- No imports from ON-THE-WAY.
- No plugin direct fetch to website callbackUrl. Website update is via the existing Workbench task status chain unless Workbench API Boundary later owns an allowlisted callback dispatcher.

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

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-SYNC-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-sync",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "schema+flow+acceptance",
  "summary": "Amazon product sync must honor the website request contract: site + SKU + required fields, and must return only evidence-backed requested product update data.",
  "required": [
    "Input contains site.",
    "Input contains exactly one SKU item.",
    "The item contains requiredFields.",
    "Every product update item requests mainImage, asin, and availableInventory together.",
    "Partial requiredFields are rejected.",
    "Multi-SKU AGENT tasks are rejected; website side owns the SKU queue.",
    "Main image evidence uses BrowserController screenshotRegion.",
    "Task status JSON contains requestedFields and missingRequestedFields."
  ],
  "forbidden": [
    "Agent or website narrows the product update field set based on local missing-field inference.",
    "Agent accepts multiple SKU items in one product sync task.",
    "Browser flow remains running indefinitely without observable progress or a terminal task status.",
    "Main image evidence fabricated from public img src.",
    "Plugin directly fetches website callbackUrl.",
    "External caller controls selectors, browser commands, or output overrides."
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-SYNC-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-sync",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "chrome+ast+acceptance",
  "summary": "Amazon product sync SKU lookup must use the inventory filter search box, explicitly exclude the top global search box, and verify search by result DOM.",
  "required": [
    "Flow probes the inventory filter Katal search input placeholder.",
    "Flow recursively handles open shadow DOM for the Katal input.",
    "Flow excludes form#sc-global-search-form and input#sc-search-field.",
    "Flow submits SKU search by writing the inventory Katal open shadow input and dispatching composed input/change events.",
    "Flow verifies search success from URL/result DOM/exact SKU row.",
    "Acceptance asserts the top global search is excluded."
  ],
  "forbidden": [
    "Top global Seller Central search for SKU lookup.",
    "Coordinate focus or OS text input as the SKU search submission path.",
    "Input value only success evidence.",
    "Whole-row contains matching as the primary SKU match.",
    "Search selector provided by external caller."
  ]
}
```
