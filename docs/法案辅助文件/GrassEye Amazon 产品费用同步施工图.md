# GrassEye Amazon 产品费用同步施工图

Authority:

- `.github/instructions/agent-rules/modules/module-amazon-product-fee-sync.instructions.md`
- `.github/instructions/agent-rules/modules/module-amazon-product-sync.instructions.md` only for shared Seller Central inventory search facts, not for ownership.

Status: Active construction blueprint. This file is subordinate to active law and cannot authorize bridge, fallback, or product-sync pollution.

## Goal

`amazon-product-fee-sync` must read real Seller Central inventory row DOM for one exact SKU and return bounded Amazon fee evidence to ON-THE-WAY Amazon Manage.

## Required Result Contract

For one SKU item:

```text
sellerSku
marketplace
snapshotAt
requestedFields = [totalAmazonFee, fbaFulfillmentFee]
missingRequestedFields
totalAmazonFeeAmount
totalAmazonFeeCurrency
totalFeeStatus
fbaFulfillmentFeeAmount
fbaFulfillmentFeeCurrency
fbaFeeStatus
amazonNonFulfillmentFeeResidualAmount
amazonNonFulfillmentFeeResidualCurrency
amazonNonFulfillmentFeeResidualStatus = derived_total_minus_fba_not_referral
referralFeeAmount = null when direct DOM label is absent
referralFeeCurrency
referralFeeStatus = not_visible_in_current_dom when direct DOM label is absent
feeEvidenceRef
rowEvidenceRef
```

## DOM Plan

Use the same proven inventory search mechanics as the product information sync:

1. Open Seller Central inventory page.
2. Locate the inventory filter Katal search input, excluding the top global search.
3. Write the SKU into the open shadow input and install host `value` getter.
4. Dispatch composed input/change events on host and shadow input.
5. Wait 1000-2000 ms.
6. Dispatch DOM MouseEvents on the inventory search button.
7. Poll result DOM until a row exposes exact `SKU = requestedSku`.
8. Extract label/value pairs from the matched row, not whole-row text.
9. Read `总费用` and `亚马逊物流费用`.

## Real DOM Baseline

Chrome-verified SKU `DL-UG6I-2OWL`:

- total fee label `总费用`: `AED22.25`
- FBA fulfillment fee label `亚马逊物流费用`: `AED9.50`
- residual: `AED12.75`
- referral fee: not directly visible in current DOM

Returned semantics:

```text
totalAmazonFee = AED22.25
fbaFulfillmentFee = AED9.50
amazonNonFulfillmentFeeResidual = AED12.75
referralFeeAmount = null
referralFeeStatus = not_visible_in_current_dom
```

## Isolation Rules

- Do not modify `amazon-product-sync` requiredFields.
- Do not import `amazon-product-sync` schema, storage, route handler, or task service as the fee owner.
- Do not accept selectors, browser commands, cookies, credentials, tab ids, action plans, flow steps, callback URLs, or expected output overrides from ON.
- Do not return raw HTML, cookies, storage, password fields, or public URLs as evidence.
- Do not perform Seller Central write actions.

## QA Plan

Add:

- `scripts/acceptance/amazon-product-fee-sync.acceptance.ts`
- `scripts/audit/domains/amazon-product-fee-sync/manifest.json`
- `scripts/audit/domains/amazon-product-fee-sync/inspector.ts`
- package scripts:
  - `audit:amazon-product-fee-sync`
  - `acceptance:amazon-product-fee-sync`

Acceptance must prove:

- exact SKU matching;
- top global search exclusion tokens remain present;
- money parser handles AED with and without spaces and commas;
- residual is derived and not labeled referral;
- referral fee remains `null` / `not_visible_in_current_dom` when no direct DOM label exists;
- multi-SKU input is rejected.

Verification:

```bash
npm run typecheck
npm run lint
npm run audit:amazon-product-fee-sync
npm run acceptance:amazon-product-fee-sync
```
