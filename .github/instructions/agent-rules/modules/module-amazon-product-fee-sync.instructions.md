---
description: "GrassEye Amazon Product Fee Sync law: read-only Seller Central fee evidence sync for ON-THE-WAY Amazon Manage product profitability."
applyTo: "src/plugins/amazon-product-fee-sync/**/*.ts,src/app/workbench-amazon-product-fee-sync-routes.ts,scripts/acceptance/amazon-product-fee-sync.acceptance.ts,scripts/audit/domains/amazon-product-fee-sync/**/*.ts"
---

# GrassEye Amazon Product Fee Sync Law

Scope: `amazon-product-fee-sync` is the only GrassEye owner for read-only Seller Central product fee evidence requested by ON-THE-WAY Amazon Manage Product Profitability. It is independent from `amazon-product-sync`; it must not add fee fields to the product information sync `requiredFields`.

Canonical chain:

```text
Workbench API Boundary
-> amazon-product-fee-sync route
-> amazon-product-fee-sync task service
-> amazon-product-fee-sync explicit flow
-> BrowserController open/evaluateActiveTab/click
-> Seller Central inventory Katal SKU search
-> exact SKU row structured label/value extraction
-> bounded fee evidence/result contract
```

## Required

- The job id is `amazon-product-fee-sync`.
- The user-facing label is `Amazon 费用更新`.
- The plugin root is `src/plugins/amazon-product-fee-sync/`.
- The external route namespace is `/api/plugins/amazon-product-fee-sync/**`.
- The website-side request must contain the site identifier, requestId, marketplace, and exactly one SKU item with explicit `requiredFields`.
- Fee update fixed-scope fields are `totalAmazonFee` and `fbaFulfillmentFee`; both must be requested together.
- AGENT task input must reject multi-SKU `items`.
- The job input may contain site, marketplace, requestId, scope, and SKU/source-key items only. The website must not send selector/action/browser data, tab ids, cookies, credentials, action plans, flow steps, or expected output overrides.
- The flow must use the Seller Central inventory filter Katal search path already proven for `amazon-product-sync`: exclude top global search, write the open shadow input, install host `value` getter, dispatch composed input/change events, wait 1000-2000 ms, dispatch DOM MouseEvents on the inventory search button, then verify the exact target SKU row from result DOM.
- Target row selection must use structured label/value extraction. The row must contain a `SKU` pair exactly equal to the requested SKU.
- Fee extraction must read the exact labels from the same target row:
  - `总费用` -> `totalAmazonFee`
  - `亚马逊物流费用` -> `fbaFulfillmentFee`
- Money extraction must preserve amount and currency as separate fields. AED values such as `AED22.25`, `AED 22.25`, and `AED1,234.56` must parse to decimal amount text and currency `AED`.
- `amazonNonFulfillmentFeeResidual` must be derived only as `totalAmazonFee - fbaFulfillmentFee` when both values are visible. Its semantic status must be `derived_total_minus_fba_not_referral`.
- `referralFeeAmount` must be `null` and `referralFeeStatus` must be `not_visible_in_current_dom` unless Seller Central exposes a direct referral fee label in the same row.
- The job output must contain seller SKU, marketplace, requested fields, missing requested fields, total fee evidence, FBA fee evidence, residual evidence, referral fee status, row evidence ref, fee evidence ref, snapshot timestamp, page diagnostics for non-success outcomes, and terminal task status.
- Evidence refs must be opaque local refs, not public URLs, not raw HTML, and not cookies/credentials.
- Login, captcha, 2FA, missing inventory search control, failed search submission, ambiguous rows, and missing rows must be represented as structured statuses.
- Status reads must fail stale queued/running tasks that have not advanced recently; a restarted AGENT must not leave the website blocked by an old running fee task.

## Forbidden

- No Seller Central write action in this module.
- No Listing title, media, price, SKU, offer, fulfillment, or inventory update.
- No save, submit, edit, price, or inventory write click. Read-only inventory search submission and read-only variation expansion are the only allowed click-like DOM actions.
- No top Seller Central global search for SKU lookup.
- No success result based only on an input value, URL search state, result count, or whole-row text contains.
- No row matching by fuzzy score or expected output override.
- No cookies, storage, credentials, full HTML, or password fields in logs/results.
- No imports from ON-THE-WAY.
- No importing or mutating `amazon-product-sync` schema, requiredFields, storage, route handlers, or task service as the fee sync owner.
- No fee fields inside `amazon-product-sync` requiredFields.
- No external caller may provide selectors, browser commands, tab ids, cookies, credentials, action plans, flow steps, or expected output overrides.
- No arbitrary website callbackUrl. Website fee updates are via the existing Workbench task status chain.
- No claim that `amazonNonFulfillmentFeeResidual` is referral fee / Amazon referral commission.

## Law IDs

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-FEE-SYNC-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-fee-sync",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+fs+acceptance",
  "summary": "Amazon product fee sync must be an independent read-only job flow with bounded Seller Central fee evidence.",
  "forbidden": [
    "Seller Central write-back",
    "DOM selector control by external callers",
    "fee fields in amazon-product-sync requiredFields",
    "residual mislabeled as referral fee",
    "raw HTML/cookie/credential evidence leakage"
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-product-fee-sync-001-requirement",
      "statement": "Amazon product fee sync must be an independent read-only job flow with bounded Seller Central fee evidence.",
      "evidenceMode": "acceptance",
      "ownerDomain": "amazon-product-fee-sync"
    }
  ]
}
```

## Real DOM Baseline

2026-06-04 Chrome extension verification on `sellercentral.amazon.ae/myinventory/inventory`, SKU `DL-UG6I-2OWL`:

- Target row contains exact `SKU = DL-UG6I-2OWL`.
- Visible status is `在售`.
- Product title snapshot is `AD-VISION SGS Filtered High Pressure Shower Head | Removes Chlorine, For Hard Water & Hair Loss | 3 Modes with Adj. Flow Pause | Double Sided (2+VC fragrance)`.
- ASIN snapshot is `B0FTVDCZ3K`.
- `总费用` is `AED22.25`.
- `亚马逊物流费用` is `AED9.50`.
- `amazonNonFulfillmentFeeResidual` is `AED12.75`, derived from total minus FBA fulfillment fee and not referral fee.
- `referralFeeAmount` is `null`.
- `referralFeeStatus` is `not_visible_in_current_dom`.

## Acceptance

- `npm run audit:amazon-product-fee-sync` must fail if fee fields are added to `amazon-product-sync` requiredFields.
- `npm run acceptance:amazon-product-fee-sync` must prove exact SKU matching, money parsing, residual semantics, and `referralFeeStatus = not_visible_in_current_dom` for a DOM fixture with `总费用` and `亚马逊物流费用`.
- Audit must block Seller Central write actions, top global search usage, whole-row contains as primary matching, external selector/action/browser controls, raw HTML evidence, and hidden imports from `amazon-product-sync`.
