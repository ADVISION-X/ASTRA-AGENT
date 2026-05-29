---
name: "GrassEye Amazon Invoice Upload Unified Chain"
description: "Governs the single Amazon invoice upload owner, including the tax invoice CSV download pre-stage and approved invoice PDF upload stage."
applyTo: "src/plugins/amazon-invoice-upload/**,src/app/workbench-amazon-routes.ts,src/app/workbench-api-boundary.ts,src/app/app-shell/**,src/lib/local-runtime/**,scripts/audit/domains/amazon-invoice-upload/**,scripts/acceptance/amazon-invoice-upload*.ts,docs/法案辅助文件/**"
---

# GrassEye Amazon Invoice Upload Unified Chain

status: active  
version: 2026-05-29  
capabilityDomain: amazon-invoice-upload  
tier: P0  
enforcementMode: machine-blocking  
constructionBlueprint: `docs/法案辅助文件/GrassEye Amazon Invoice Upload Unified Chain 施工图.md`

## 0. Identity

Amazon invoice upload is one bounded job-flow owner:

```txt
src/plugins/amazon-invoice-upload/**
```

The unified chain is:

```txt
INTAKE
  -> TAX_INVOICE_CSV_DOWNLOAD
  -> DOWNLOAD_ARTIFACT_PERSIST
  -> WEBSITE_STATUS_OR_CALLBACK
  -> APPROVED_INVOICE_UPLOAD
  -> HUMAN_FINAL_SUBMIT_OR_AUTHORIZED_AUTO_SUBMIT
  -> VERIFY_UPLOAD_RESULT
  -> COMPLETE
```

Download completion is not upload completion. Website status return is not task completion. CSV report content and Amazon download `documentId` are sensitive and must not be written into runtime logs or public responses.

## [GRASSEYE-AMAZON-INVOICE-UPLOAD-001-V1] Single Owner

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-INVOICE-UPLOAD-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Amazon tax invoice CSV download and approved invoice upload must live under the single amazon-invoice-upload plugin owner; no second skill, plugin, route bus, HTTP server, browser controller, evidence chain, or runtime log chain may be created.",
  "appliesTo": [
    "src/plugins/**/*.{ts,tsx,js,jsx,mjs}",
    "src/app/**/*.{ts,tsx,js,jsx,mjs}",
    "src/lib/local-runtime/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "forbidden": [
    "src/plugins/amazon-tax-invoice-download/**",
    "src/plugins/amazon-invoice-download/**",
    "src/capabilities/amazon-tax-invoice/**",
    "Seller Central tax invoice download flow order in src/app/**.",
    "Seller Central tax invoice download flow order in src/lib/local-runtime/**.",
    "Second Amazon invoice HTTP server, route bus, mission loop, browser controller, evidence chain, or runtime log chain."
  ]
}
```

## [GRASSEYE-AMAZON-INVOICE-UPLOAD-002-V1] Empirical Step Only

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-INVOICE-UPLOAD-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "evidence-map+ast",
  "summary": "Every Seller Central tax invoice download automation step must cite an Evidence Map stepId from the canonical blueprint.",
  "appliesTo": [
    "src/plugins/amazon-invoice-upload/**/*download*.ts",
    "docs/法案辅助文件/GrassEye Amazon Invoice Upload Unified Chain 施工图.md"
  ],
  "forbidden": [
    "Unverified Seller Central selector.",
    "Unverified Seller Central URL.",
    "Unverified button text.",
    "Unverified download completion logic.",
    "DOM automation step without evidenceStepId."
  ]
}
```

## [GRASSEYE-AMAZON-INVOICE-UPLOAD-003-V1] DOM Boundary

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-INVOICE-UPLOAD-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast",
  "summary": "DOM Automation may provide only neutral snapshot, locate, click, upload, wait, and verify primitives; Seller Central report semantics and step order must stay inside amazon-invoice-upload.",
  "appliesTo": [
    "src/capabilities/dom-automation/**/*.{ts,tsx,js,jsx,mjs}",
    "src/plugins/amazon-invoice-upload/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "forbidden": [
    "Seller Central report name or date range business order inside DOM Automation.",
    "DOM Automation choosing Amazon tax invoice workflow next step.",
    "API Boundary or App Shell owning Seller Central DOM sequence."
  ]
}
```

## [GRASSEYE-AMAZON-INVOICE-UPLOAD-004-V1] Download Before Upload

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-INVOICE-UPLOAD-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "schema+storage+acceptance",
  "summary": "Tax invoice CSV download is the pre-stage of the upload chain and must persist a safe artifact ref; upload may consume only caller-approved PDF or already approved artifacts, never the CSV as invoice PDF.",
  "appliesTo": [
    "src/plugins/amazon-invoice-upload/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "forbidden": [
    "Treating CSV report as invoice PDF.",
    "Marking download completion as upload completion.",
    "Uploading a downloaded CSV to the invoice upload dialog."
  ]
}
```

## [GRASSEYE-AMAZON-INVOICE-UPLOAD-005-V1] API Boundary Compatibility

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-INVOICE-UPLOAD-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+acceptance",
  "summary": "External websites may request known Amazon invoice tasks only through explicit API Boundary rules and must not pass browser commands, selectors, flow steps, cookies, or browser profiles.",
  "appliesTo": [
    "src/app/workbench-api-boundary.ts",
    "src/app/workbench-amazon-routes.ts",
    "scripts/acceptance/workbench-api-boundary.acceptance.ts"
  ],
  "forbidden": [
    "External download route without externalApiAllowed true.",
    "External download route without requiresApiKey true.",
    "External download route without jobOwner amazon-invoice-upload.",
    "External input selector, actionPlan, browserCommand, flowStep, abilityGroupId, cookie, sellerCentralCookie, or browserProfileDirectory."
  ]
}
```

## [GRASSEYE-AMAZON-INVOICE-UPLOAD-006-V1] UI Boundary

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-INVOICE-UPLOAD-006-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "app-shell+acceptance",
  "summary": "Amazon invoice App Shell workspace must expose Download, Upload, Latest, and Evidence surfaces while keeping UI out of Seller Central flow logic.",
  "appliesTo": [
    "src/app/app-shell/app-shell-layout.ts",
    "src/app/app-shell/skill-registry.ts",
    "scripts/acceptance/app-shell-ui.acceptance.ts"
  ],
  "forbidden": [
    "Amazon invoice workspace missing Download surface.",
    "Upload surface removed.",
    "UI input for selector, flowStep, actionPlan, browserCommand, documentId, cookie, or browserProfileDirectory.",
    "UI implementing Seller Central download sequence."
  ]
}
```

## [GRASSEYE-AMAZON-INVOICE-UPLOAD-007-V1] Artifact Safety

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-INVOICE-UPLOAD-007-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "storage+acceptance+ast",
  "summary": "Download artifact responses may expose only safe metadata and artifact refs; raw CSV content, full local paths, cookies, and Amazon download documentId must not be logged or returned.",
  "appliesTo": [
    "src/plugins/amazon-invoice-upload/**/*.{ts,tsx,js,jsx,mjs}",
    "src/app/workbench-amazon-routes.ts",
    "scripts/acceptance/amazon-invoice-upload-download.acceptance.ts"
  ],
  "forbidden": [
    "Runtime log contains raw CSV content.",
    "Runtime log contains download URL documentId.",
    "External artifact endpoint reads arbitrary local path.",
    "External artifact response returns local absolute path.",
    "External artifact response returns raw CSV content."
  ]
}
```

## [GRASSEYE-AMAZON-INVOICE-UPLOAD-008-V1] Audit And Acceptance Coverage

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-INVOICE-UPLOAD-008-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "audit+acceptance+ci-full",
  "summary": "Amazon invoice unified chain changes must be covered by an amazon-invoice-upload audit domain, scoped acceptance, and ci:full.",
  "appliesTo": [
    "scripts/audit/domains/amazon-invoice-upload/**",
    "scripts/acceptance/amazon-invoice-upload-download.acceptance.ts",
    "package.json"
  ],
  "forbidden": [
    "Amazon invoice production readiness without audit:amazon-invoice-upload.",
    "Amazon invoice production readiness without acceptance:amazon-invoice-upload-download.",
    "Warning-only or partial PASS for P0 findings.",
    "Manual generated artifact truth."
  ]
}
```

## [GRASSEYE-AMAZON-INVOICE-UPLOAD-009-V1] Upload Ledger Status Truth

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-INVOICE-UPLOAD-009-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "storage+api-boundary+audit+acceptance",
  "summary": "Amazon invoice upload status truth for external websites must come from the Agent-side upload ledger written by the existing amazon-invoice-upload task record path, not from website inference or export actions.",
  "appliesTo": [
    "src/plugins/amazon-invoice-upload/**/*.{ts,tsx,js,jsx,mjs}",
    "src/app/workbench-amazon-routes.ts",
    "src/app/workbench-api-boundary.ts",
    "src/lib/local-runtime/**/*.{ts,tsx,js,jsx,mjs}",
    "scripts/audit/domains/amazon-invoice-upload/**",
    "scripts/acceptance/workbench-api-boundary.acceptance.ts"
  ],
  "required": [
    "Agent upload ledger persists under dataDir/plugin-tasks/amazon-invoice-upload.",
    "saveTaskRecord writes the upload ledger using the existing task record path.",
    "GET /api/plugins/amazon-invoice-upload/ledger returns safe ledger records for website status sync.",
    "Ledger external route is exact, externalApiAllowed true, requiresApiKey true, and jobOwner amazon-invoice-upload.",
    "Ledger response excludes raw invoice PDF bytes, local invoicePdfPath, cookies, Seller Central profile paths, selectors, browser commands, documentId, and downloadUrl."
  ],
  "forbidden": [
    "Website marks upload status from PDF export.",
    "Website infers upload success without reading Agent ledger.",
    "Second upload ledger outside amazon-invoice-upload owner.",
    "Ledger route outside /api/plugins/amazon-invoice-upload/ledger.",
    "Ledger response leaking invoicePdfPath or raw PDF/local file paths."
  ]
}
```

## [GRASSEYE-AMAZON-INVOICE-UPLOAD-010-V1] Batch Order Tab Lifecycle

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-INVOICE-UPLOAD-010-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "flow+ast+acceptance+chrome",
  "summary": "Amazon invoice batch upload must reuse the active Seller Central order worker tab across items and must not make per-item tab close a success condition.",
  "appliesTo": [
    "src/plugins/amazon-invoice-upload/**/*.{ts,tsx,js,jsx,mjs}",
    "scripts/audit/domains/amazon-invoice-upload/**",
    "scripts/acceptance/amazon-invoice-upload*.ts",
    "docs/法案辅助文件/GrassEye Amazon Invoice Upload Unified Chain 施工图.md"
  ],
  "required": [
    "Before deciding Seller Central tab reuse, the implementation refreshes current Chrome navigation state from the real browser.",
    "When any retained browser tab is already on the same Seller Central host, the next order detail navigation uses reuse-host-tab to focus that tab and replace its URL.",
    "When the active browser tab is already on the same non-HTTP test host, the next order detail navigation uses reuse-active-tab.",
    "Successful upload verification records upload_success without calling closeActiveTab.",
    "Already-uploaded verification records already_uploaded without calling closeActiveTab.",
    "upload_success and already_uploaded must remain distinct in task records, ledger projection, latest lookup, and APP batch rendering.",
    "Tab cleanup, if needed, is a batch/session cleanup concern and must not change per-item upload_success into review_required.",
    "Each reused-tab item must still verify the target order id and invoice action state before upload or already-uploaded judgment."
  ],
  "forbidden": [
    "Per-item closeActiveTab inside upload success verification.",
    "Per-item closeActiveTab inside already-uploaded verification.",
    "Opening a new Seller Central tab for every batch item when any retained tab is already on the same Seller Central host.",
    "Deciding Seller Central tab lifecycle from stale controller state without reading real Chrome state.",
    "Treating tab close failure as invoice upload failure after Amazon success or already-uploaded state is verified."
  ]
}
```

## [GRASSEYE-AMAZON-INVOICE-UPLOAD-011-V1] Conditional Order Detail Recovery Refresh

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-INVOICE-UPLOAD-011-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "flow+ast+acceptance+chrome",
  "summary": "Amazon invoice upload must not mechanically refresh every order detail page; it may execute only one recovery refresh after a bounded DOM readiness window proves the target order id and invoice action state are missing and auth gates are not present.",
  "appliesTo": [
    "src/plugins/amazon-invoice-upload/amazon-invoice-upload-order-detail.ts",
    "scripts/audit/domains/amazon-invoice-upload/**",
    "scripts/acceptance/amazon-invoice-upload*.ts",
    "docs/法案辅助文件/GrassEye Amazon Invoice Upload Unified Chain 施工图.md"
  ],
  "required": [
    "Order detail navigation first waits a random 10-15 second readiness window for target order id, upload/manage/already-uploaded invoice state, and loading completion.",
    "If the readiness window succeeds, upload proceeds without a recovery refresh.",
    "If the readiness window fails and login/captcha/2FA gates are not present, the flow executes at most one same-tab recovery refresh.",
    "After the recovery refresh, the flow waits a random short window before final readiness verification.",
    "The recovery refresh trace records why it happened without logging PDF bytes, cookies, documentId, or local absolute invoice paths.",
    "The final readiness check still fails closed if target order id and invoice action state are not proven."
  ],
  "forbidden": [
    "Unconditional order-detail refresh immediately after every order-detail navigation.",
    "More than one recovery refresh for the same order detail attempt.",
    "Refresh loops that can continue indefinitely.",
    "Refreshing login, captcha, or 2FA gates into a fake upload attempt.",
    "Proceeding to upload before target order id and invoice action state are proven."
  ]
}
```

## [GRASSEYE-AMAZON-INVOICE-UPLOAD-012-V1] Batch Ledger Preflight Skip

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-INVOICE-UPLOAD-012-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ledger+app-shell+acceptance+audit",
  "summary": "Local APP batch upload must read the existing Agent upload ledger before per-file upload and skip only orders already proven upload_success or already_uploaded for the same order id and invoice number.",
  "appliesTo": [
    "src/app/workbench-home-amazon-invoice-client.ts",
    "src/plugins/amazon-invoice-upload/**/*.{ts,tsx,js,jsx,mjs}",
    "scripts/audit/domains/amazon-invoice-upload/**",
    "scripts/acceptance/amazon-invoice-upload-batch.acceptance.ts",
    "docs/法案辅助文件/GrassEye Amazon Invoice Upload Unified Chain 施工图.md"
  ],
  "required": [
    "Before local batch queue uploads queued PDFs, it reads GET /api/plugins/amazon-invoice-upload/ledger through the existing ledger route.",
    "The local queue builds a lookup by amazonOrderId plus invoiceNo.",
    "Only ledger records with status upload_success or already_uploaded may be skipped before opening Seller Central.",
    "Skipped items must be visible in the queue as already_uploaded with reason skipped_by_upload_ledger and reachedStep upload ledger preflight.",
    "Manage invoice, Manage invoices, Pending, 管理发票, or 待处理 text may locate invoice actions, but must not be sufficient evidence for upload_success or already_uploaded.",
    "Failed, blocked, manual-required, invalid, or unknown ledger records must not be skipped.",
    "If the ledger preflight cannot be read, the local queue must fail closed before uploading more files.",
    "Each non-skipped file must still call the existing single-upload route /api/plugins/amazon-invoice-upload/start with one invoicePdf."
  ],
  "forbidden": [
    "Skipping based on website export state.",
    "Skipping based on filename alone.",
    "Skipping failed, review_required, blocked_auth, manual_required, or invalid records.",
    "Branching business logic from reason.includes(\"already uploaded\") instead of the formal already_uploaded status.",
    "Adding a second batch ledger, second batch route, or second upload service to support resume.",
    "Uploading all selected PDFs in one multipart request."
  ]
}
```
