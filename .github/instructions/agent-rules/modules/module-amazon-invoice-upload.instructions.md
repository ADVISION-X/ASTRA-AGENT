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
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-001-requirement",
      "statement": "Amazon tax invoice CSV download and approved invoice upload must live under the single amazon-invoice-upload plugin owner; no second skill, plugin, route bus, HTTP server, browser controller, evidence chain, or runtime log chain may be created.",
      "evidenceMode": "static",
      "ownerDomain": "amazon-invoice-upload"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-002-requirement",
      "statement": "Every Seller Central tax invoice download automation step must cite an Evidence Map stepId from the canonical blueprint.",
      "evidenceMode": "static",
      "ownerDomain": "amazon-invoice-upload"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-003-requirement",
      "statement": "DOM Automation may provide only neutral snapshot, locate, click, upload, wait, and verify primitives; Seller Central report semantics and step order must stay inside amazon-invoice-upload.",
      "evidenceMode": "static",
      "ownerDomain": "amazon-invoice-upload"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-004-requirement",
      "statement": "Tax invoice CSV download is the pre-stage of the upload chain and must persist a safe artifact ref; upload may consume only caller-approved PDF or already approved artifacts, never the CSV as invoice PDF.",
      "evidenceMode": "acceptance",
      "ownerDomain": "amazon-invoice-upload"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-005-requirement",
      "statement": "External websites may request known Amazon invoice tasks only through explicit API Boundary rules and must not pass browser commands, selectors, flow steps, cookies, or browser profiles.",
      "evidenceMode": "acceptance",
      "ownerDomain": "amazon-invoice-upload"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-006-requirement",
      "statement": "Amazon invoice App Shell workspace must expose Download, Upload, Latest, and Evidence surfaces while keeping UI out of Seller Central flow logic.",
      "evidenceMode": "acceptance",
      "ownerDomain": "amazon-invoice-upload"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-007-requirement",
      "statement": "Download artifact responses may expose only safe metadata and artifact refs; raw CSV content, full local paths, cookies, and Amazon download documentId must not be logged or returned.",
      "evidenceMode": "acceptance",
      "ownerDomain": "amazon-invoice-upload"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-008-requirement",
      "statement": "Amazon invoice unified chain changes must be covered by an amazon-invoice-upload audit domain, scoped acceptance, and ci:full.",
      "evidenceMode": "acceptance",
      "ownerDomain": "amazon-invoice-upload"
    }
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
    "Upload task record responses from start, status, resume, and latest routes must redact mission.invoicePdfPath before returning to external callers.",
    "Ledger external route is exact, externalApiAllowed true, requiresApiKey true, and jobOwner amazon-invoice-upload.",
    "Ledger response excludes raw invoice PDF bytes, local invoicePdfPath, cookies, Seller Central profile paths, selectors, browser commands, documentId, and downloadUrl."
  ],
  "forbidden": [
    "Website marks upload status from PDF export.",
    "Website infers upload success without reading Agent ledger.",
    "Second upload ledger outside amazon-invoice-upload owner.",
    "Ledger route outside /api/plugins/amazon-invoice-upload/ledger.",
    "Upload start/status/resume/latest route response leaking local invoicePdfPath.",
    "Ledger response leaking invoicePdfPath or raw PDF/local file paths."
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-009-requirement",
      "statement": "Amazon invoice upload status truth for external websites must come from the Agent-side upload ledger written by the existing amazon-invoice-upload task record path, not from website inference or export actions.",
      "evidenceMode": "acceptance",
      "ownerDomain": "amazon-invoice-upload"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-010-requirement",
      "statement": "Amazon invoice batch upload must reuse the active Seller Central order worker tab across items and must not make per-item tab close a success condition.",
      "evidenceMode": "real-chrome",
      "ownerDomain": "amazon-invoice-upload"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-011-requirement",
      "statement": "Amazon invoice upload must not mechanically refresh every order detail page; it may execute only one recovery refresh after a bounded DOM readiness window proves the target order id and invoice action state are missing and auth gates are not present.",
      "evidenceMode": "real-chrome",
      "ownerDomain": "amazon-invoice-upload"
    }
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
    "After opening Manage invoice / 管理发票 for existing-invoice verification, the flow must wait a bounded production window of at least 45 seconds for strong invoice-list evidence before returning review_required.",
    "If the Manage invoice list remains unconfirmed after the first evidence window, the flow may perform exactly one same-tab order-detail recovery refresh, reopen Manage invoice, and wait one more bounded strong-evidence window before returning review_required.",
    "A still-loading or slow Seller Central invoice list must not be collapsed into already_uploaded, upload_success, or a short-timeout review_required result.",
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
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-012-requirement",
      "statement": "Local APP batch upload must read the existing Agent upload ledger before per-file upload and skip only orders already proven upload_success or already_uploaded for the same order id and invoice number.",
      "evidenceMode": "acceptance",
      "ownerDomain": "amazon-invoice-upload"
    }
  ]
}
```

## [GRASSEYE-AMAZON-INVOICE-UPLOAD-013-V1] API Upload Website Tab Return

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-INVOICE-UPLOAD-013-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "runtime-log+acceptance+audit",
  "summary": "API-triggered Amazon invoice upload must switch Chrome focus back to the existing website-side Amazon Manage tab after the Amazon upload reaches a terminal result, without opening, refreshing, or navigating the website page.",
  "appliesTo": [
    "src/app/workbench-amazon-routes.ts",
    "src/lib/browser/browser-controller.ts",
    "src/lib/browser/current-chrome-window-control.ts",
    "src/lib/browser/current-chrome-browser-controller-runtime.ts",
    "src/plugins/amazon-invoice-upload/**/*.{ts,tsx,js,jsx,mjs}",
    "scripts/audit/domains/amazon-invoice-upload/**",
    "scripts/acceptance/amazon-invoice-upload-batch.acceptance.ts",
    "scripts/acceptance/workbench-api-boundary.acceptance.ts",
    "docs/法案辅助文件/GrassEye Amazon Invoice Upload Unified Chain 施工图.md"
  ],
  "required": [
    "The external upload route may preserve sourceSystem and requestId only as API source metadata from X-GrassEye-Source-System / X-GrassEye-Request-Id or the legacy mission payload.",
    "sourceSystem and requestId must not become DOM selectors, browser commands, Seller Central workflow inputs, or upload success evidence.",
    "For API-sourced upload missions with adminOrderUrl, the task service must first persist the original Amazon upload terminal result, then attempt website tab return.",
    "Website return must use a focus-only existing-tab browser policy that first activates an exact matching adminOrderUrl tab, then may activate an existing same-origin same-path admin tab when the only mismatch is query/hash state.",
    "Focus-only tab switching must be an explicit API-return mode and must not become the default behavior of normal Amazon Manage admin page opening.",
    "The focus-only policy must not create a new Chrome window, create a new tab, set URL of an existing tab, refresh the website, or navigate by host fallback when the exact/same-path website tab is missing.",
    "If the existing website tab is missing or cannot be focused, the focus failure must be recorded in runtime trace without overwriting the Amazon upload terminal status.",
    "adminOrderUrl must still pass the allowed Amazon admin host validation before any tab focus attempt.",
    "A post-change production-readiness claim for website tab return must cite fresh runtime evidence from the changed path; historical Seller Central upload success evidence is not proof that the website return IF was tested."
  ],
  "forbidden": [
    "Opening adminOrderUrl as a new tab after upload completion.",
    "Refreshing or navigating the website-side Amazon Manage page after upload completion.",
    "Applying focus-only behavior to ordinary admin page open commands.",
    "Using reuse-active-tab, reuse-host-tab, open-new-tab, or fallback URL navigation for website return.",
    "Running website return before the Amazon upload reaches and persists a terminal result.",
    "Inferring upload_success, already_uploaded, or review_required from website focus state.",
    "Declaring the changed API website return path production verified from logs, acceptance strings, or pre-change upload evidence alone.",
    "Adding a second browser controller, second upload task chain, second route, or compatibility wrapper for tab return."
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-013-requirement",
      "statement": "API-triggered Amazon invoice upload must switch Chrome focus back to the existing website-side Amazon Manage tab after the Amazon upload reaches a terminal result, without opening, refreshing, or navigating the website page.",
      "evidenceMode": "acceptance",
      "ownerDomain": "amazon-invoice-upload"
    }
  ]
}
```

## [GRASSEYE-AMAZON-INVOICE-UPLOAD-014-V1] Invoice Amount Pre-Upload Hard Gate

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-INVOICE-UPLOAD-014-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "flow+pdf+dom+acceptance+audit+chrome",
  "summary": "Before any approved invoice PDF is attached or submitted, Amazon invoice upload must compare the PDF gross payable amount with the live Seller Central order DOM total and skip the item on mismatch or unreadable evidence.",
  "appliesTo": [
    "src/plugins/amazon-invoice-upload/**/*.{ts,tsx,js,jsx,mjs}",
    "scripts/audit/domains/amazon-invoice-upload/**",
    "scripts/acceptance/amazon-invoice-upload*.ts",
    "docs/法案辅助文件/GrassEye Amazon Invoice Upload Unified Chain 施工图.md"
  ],
  "required": [
    "The amount gate runs inside the existing amazon-invoice-upload flow after the target order detail and already-uploaded state are proven, and before opening the upload invoice entry.",
    "The PDF amount source is the task-approved invoice PDF only; filename, website export amount, APP row amount, or caller-provided amount must not be upload truth.",
    "The Seller Central amount source is the live order detail DOM total, such as Sales proceeds Total or 销售收益 总和, read from the existing browser session at upload time.",
    "PDF and DOM amounts must be normalized to currency plus minor units before comparison.",
    "On mismatch, unreadable PDF amount, or unreadable DOM order total, the flow returns amount_mismatch_skipped with reviewRequired true and must not attach the file, click upload, or submit.",
    "The task record and ledger reason must include a concise safe skip reason without logging raw PDF text, raw DOM HTML, cookies, browser storage, or local absolute PDF paths.",
    "API-triggered uploads and App Shell batch uploads must both pass through the same single-upload amount gate."
  ],
  "forbidden": [
    "Opening the upload dialog before the amount gate passes.",
    "Calling uploadApprovedInvoice before the amount gate passes.",
    "Treating filename, APP amount, website export amount, or caller-provided amount as order total truth.",
    "Running a separate APP-only or API-only amount checker that can disagree with the flow result.",
    "Uploading when PDF total or Seller Central DOM total is unreadable.",
    "Logging raw PDF text, full DOM HTML, cookies, browser storage, or local absolute invoicePdfPath as amount evidence."
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-014-requirement",
      "statement": "Before any approved invoice PDF is attached or submitted, Amazon invoice upload must compare the PDF gross payable amount with the live Seller Central order DOM total and skip the item on mismatch or unreadable evidence.",
      "evidenceMode": "real-chrome",
      "ownerDomain": "amazon-invoice-upload"
    }
  ]
}
```
