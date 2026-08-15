---
name: "GrassEye Amazon Invoice Upload Unified Chain"
description: "Governs the single Amazon invoice upload owner, including the tax invoice CSV download pre-stage and approved invoice PDF upload stage."
applyTo: "src/plugins/amazon-invoice-upload/**,src/app/workbench-amazon-routes.ts,src/app/workbench-api-boundary.ts,src/app/app-shell/**,src/lib/local-runtime/**,scripts/audit/domains/amazon-invoice-upload/**,scripts/acceptance/amazon-invoice-upload*.ts,docs/法案辅助文件/**"
---

# GrassEye Amazon Invoice Upload Unified Chain

status: active  
version: 2026-08-16
capabilityDomain: amazon-invoice-upload  
tier: P0  
enforcementMode: machine-blocking  
constructionBlueprint: `docs/法案辅助文件/GrassEye Amazon Invoice Upload Unified Chain 施工图.md`

## 0. Identity

Amazon invoice upload is one bounded job-flow owner:

```txt
src/plugins/amazon-invoice-upload/**
```

## [GRASSEYE-AMAZON-INVOICE-UPLOAD-016-V1] Exact-Target Technical Failure Integrity

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-INVOICE-UPLOAD-016-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+acceptance+runtime-log+real-chrome",
  "summary": "The existing invoice upload flow must keep its business sequence unchanged while exact-target Browser or DOM execution failures remain technical failures and never masquerade as order_not_found.",
  "appliesTo": [
    "src/plugins/amazon-invoice-upload/**/*.{ts,tsx,js,jsx,mjs}",
    "scripts/audit/domains/amazon-invoice-upload/**",
    "scripts/acceptance/amazon-invoice-upload*.ts",
    "docs/法案辅助文件/GrassEye Amazon Invoice Upload Unified Chain 施工图.md"
  ],
  "required": [
    "The approved input, single order-detail navigation, eight bounded same-page readiness windows, already-uploaded check, amount hard gate, approved PDF attachment, final submit and success verification remain the only upload sequence.",
    "A Browser or DOM execution exception is recorded as a structured technical execution failure and returns review_required before any later upload action.",
    "order_not_found is permitted only when all eight observation windows executed successfully and observed that the requested order identity or invoice action state never became ready.",
    "Amazon smoke acceptance uses the same production evaluation-expression contract as the unique Browser owner and must not implement a private evaluator.",
    "Real Seller Central verification resolves the actual enabled input[type=file] inside the unique open kat-file-upload author shadow root when the light-DOM input is only a hidden proxy, dispatches the approved PDF once, then admits attachment only when that component exposes exactly one same-name kat-file-item with file-status ready and zero duplicate, foreign or terminal-failure items; the component may synchronously clear the native receiver.",
    "Invoice-number fill is admitted only after the Amazon owner has observed that exact ready file item; whole-page order-id text, input.files and the visible pending copy 文件未上传 are never attachment verdicts.",
    "Invoice-number text uses one fill_dom_target Chrome command that revalidates the captured kat-input identity, resolves one editable receiver, applies only the approved value, dispatches component events and verifies the exact retained value before final submit.",
    "Final success is proved within forty bounded observations by exactly one visible current-order manage-invoice dialog containing exactly one descendant row with the exact approved invoiceNo and an explicit Amazon successful state such as 由卖家生成 / Seller generated; whole-page rows, hidden dialogs, order-id-only rows, partial numbers, duplicate rows, foreign numbers and governed failure states are excluded.",
    "When a delayed current-order upload dialog becomes visible after the first click deadline, the retry path recognizes that exact visible dialog and its enabled file input as ready before locating or clicking the now-covered page entry again."
  ],
  "forbidden": [
    "classifying Illegal return statement, transport failure, document-stale failure or DOM snapshot exception as order_not_found",
    "new Function, eval or a caller-local evaluation wrapper in Amazon code or smoke support",
    "changing mission input, business order, amount gate, final submit authorization or upload_success evidence to repair Browser transport",
    "refresh, repeat navigation, compatibility bridge, fallback evaluator or second upload flow",
    "retry-clicking the page upload entry after the current-order upload dialog is already open"
    ,"treating a hidden light-DOM proxy, dialog visibility, order id, invoice number, input.files or generic page text as proof that Amazon accepted the PDF"
    ,"using split coordinate click plus text_target, a visible inner-input value, or a second verification chain as proof that kat-input committed the invoice number"
    ,"using the current order id as a substitute for invoiceNo, or using a row outside the unique visible dialog as final upload proof"
    ,"continuing to fill, submit, reopen, scroll or retry after duplicate, foreign, failure or bounded-exhaustion attachment/result evidence"
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-016-requirement",
      "statement": "Amazon invoice upload must preserve its existing business sequence and report exact-target execution failures as technical review-required results rather than false order_not_found results.",
      "evidenceMode": "real-chrome",
      "ownerDomain": "amazon-invoice-upload"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-INVOICE-UPLOAD-015-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+acceptance+real-chrome",
  "summary": "Amazon invoice upload alone owns revisioned whole-task intervention at item and submission checkpoints.",
  "required": [
    "The plugin store persists intervention revision, state, reason, request identity and owning checkpoint before acknowledgement.",
    "Pause, cancel, takeover and resume use expectedRevision CAS and stop new Browser commands at the next item or submission-safe checkpoint.",
    "A submitted upload waits only for its existing result checkpoint; uncertain submission becomes review_required and is never replayed.",
    "App, route, mediator and local runtime only forward named plugin-facade methods."
  ],
  "forbidden": ["route-owned intervention state", "generic intervention dispatcher", "automatic replay of an uncertain upload", "persisted raw Chrome target ids"],
  "clauses": [{
    "clauseId": "grasseye-amazon-invoice-upload-015-requirement",
    "statement": "Amazon invoice upload alone owns revisioned whole-task intervention at item and submission checkpoints.",
    "evidenceMode": "acceptance",
    "ownerDomain": "amazon-invoice-upload"
  }]
}
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
  "summary": "DOM Automation may provide only six neutral primitives: snapshot, locate, fill, click, upload, and one-shot verify; Seller Central report semantics, repeated observation, finite stopping, and step order must stay inside amazon-invoice-upload.",
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
      "statement": "DOM Automation may provide only six neutral primitives: snapshot, locate, fill, click, upload, and one-shot verify; Seller Central report semantics, repeated observation, finite stopping, and step order must stay inside amazon-invoice-upload.",
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
    "Ledger records may expose only the persisted runtimeLogRef and navigationEvidenceRef produced by the current task; a fabricated domTraceRef or unresolved runtime-evidence path is forbidden.",
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
    "Ledger response leaking invoicePdfPath or raw PDF/local file paths.",
    "A ledger domTraceRef or runtime-evidence path that has no active writer and cannot be resolved."
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
  "summary": "Amazon invoice batch upload must retain one owner-bound exact Seller Central target across items and must not make target cleanup a per-item success condition.",
  "appliesTo": [
    "src/plugins/amazon-invoice-upload/**/*.{ts,tsx,js,jsx,mjs}",
    "scripts/audit/domains/amazon-invoice-upload/**",
    "scripts/acceptance/amazon-invoice-upload*.ts",
    "docs/法案辅助文件/GrassEye Amazon Invoice Upload Unified Chain 施工图.md"
  ],
  "required": [
    "The amazon-invoice-upload owner retains one BrowserTargetSession whose exact target identity is refreshed from real Chrome before each item.",
    "The next order detail navigation uses reuse-exact-url inside that owner session and never selects a same-host, active, current, first, or front tab fallback.",
    "Successful upload verification records upload_success without closing the owner target.",
    "Already-uploaded verification records already_uploaded without closing the owner target.",
    "upload_success and already_uploaded must remain distinct in task records, ledger projection, latest lookup, and APP batch rendering.",
    "Tab cleanup, if needed, is a batch/session cleanup concern and must not change per-item upload_success into review_required.",
    "Each reused-tab item must still verify the target order id and invoice action state before upload or already-uploaded judgment."
  ],
  "forbidden": [
    "Per-item closeTarget inside upload success verification.",
    "Per-item closeTarget inside already-uploaded verification.",
    "Opening a new Seller Central target for every batch item instead of retaining the plugin-owned exact session.",
    "Selecting a Seller Central target from active/current/front/first tab or same-host fallback.",
    "Treating tab close failure as invoice upload failure after Amazon success or already-uploaded state is verified."
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-010-requirement",
      "statement": "Amazon invoice batch upload must retain one owner-bound exact Seller Central target across items and must not make per-item target cleanup a success condition.",
      "evidenceMode": "real-chrome",
      "ownerDomain": "amazon-invoice-upload"
    }
  ]
}
```

## [GRASSEYE-AMAZON-INVOICE-UPLOAD-011-V1] Single Order Navigation and Governed Step Waiting

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-INVOICE-UPLOAD-011-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "flow+ast+acceptance+chrome",
  "summary": "Amazon invoice upload must enter each order through one explicit order-detail navigation, must never refresh that page as recovery, and must advance only after an order-bound explicit DOM terminal signal; elapsed time alone cannot decide the business branch or start the next invoice.",
  "appliesTo": [
    "src/plugins/amazon-invoice-upload/amazon-invoice-upload-order-detail.ts",
    "src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts",
    "src/plugins/amazon-invoice-upload/amazon-invoice-upload-existing.ts",
    "src/plugins/amazon-invoice-upload/amazon-existing-invoice-evidence.ts",
    "src/app/workbench-home-amazon-invoice-client.ts",
    "src/capabilities/dom-automation/runtime/dom-snapshot.ts",
    "src/lib/browser/exact-target/browser-command-runtime.ts",
    "scripts/audit/domains/amazon-invoice-upload/**",
    "scripts/acceptance/amazon-invoice-upload*.ts",
    "docs/法案辅助文件/GrassEye Amazon Invoice Upload Unified Chain 施工图.md"
  ],
  "required": [
    "The upload flow must call the order-detail owner directly; it must not first open the same sellerCentralEntryUrl through a generic Seller Central entry phase.",
    "Each invoice item performs exactly one BrowserController.open for the order detail and never navigates that item again.",
    "The one order-detail open must use one caller-created browserActionId, consume the structured open result, fail closed on an unsuccessful or mismatched observed URL, and persist one integrity-hashed forensics navigation proof linked to taskId or executionId.",
    "Order-detail navigation logs must contain one truthful started/terminal pair for that browserActionId; readiness observations must use distinct observe-window identities and must never be labelled as open or navigation.",
    "Browser state reads and wait operations are pure observations: they must not create a Chrome window, set or restore a URL, refresh a page, or emit another navigation command.",
    "Start, resume, and direct Amazon invoice missions share one plugin-owned single-flight execution lease for the shared BrowserController; a concurrent second execution fails closed before BrowserController.open.",
    "The terminal timeout aborts the active browser and DOM execution and awaits flow settlement before terminal persistence, lease release, or the next invoice execution.",
    "Order-detail readiness is observed in at most eight consecutive windows for a 16-second maximum; each window is no longer than 2 seconds and must record a structured failure before the next same-page observation begins.",
    "Each order-detail snapshot timeout and poll wait is clamped to the current window's remaining time so eight nominal 2-second windows cannot silently become eight overlong waits.",
    "Every Amazon invoice DOM snapshot has an explicit execution deadline no greater than 1800ms so a low-level Chrome evaluation cannot silently exceed the 2-second business window.",
    "A DOM evaluation exception inside an order-detail observation is converted into that window's structured failure and the next finite same-page observation; it must not bypass the governed window sequence.",
    "Evidence screenshot capture binds the exact targetRef/documentRef and runs through the background CDP target without activating Chrome or changing the operator's foreground tab.",
    "After a failed order-detail observation window, the only allowed next action is another bounded DOM observation on the unchanged page; exhausting eight windows returns review-required failure without refresh or repeat navigation.",
    "After Manage invoice is clicked, existing-invoice discovery uses an AND THEN wait: the unique visible invoice dialog must bind to the current amazonOrderId and expose either a matching uploaded invoice row, a fully rendered upload-ready table and upload action, or the exact no-actions blocker before the flow may branch.",
    "A short elapsed-time deadline must not turn a still-loading Manage invoice dialog into review_required and must not permit the local batch to start the next invoice.",
    "The task-level terminal timeout is an operational abort watchdog only: it aborts and awaits the active flow, returns review_required, and the local batch must stop with the current order retained rather than continue automatically.",
    "A governed local-batch inter-item pacing delay may begin only after the prior single-upload task has returned a formal terminal result and released its browser execution lease; it is outside DOM readiness, navigation, retry, timeout, and business-state judgment.",
    "Upload dialog readiness, file-input readiness, and post-submit success evidence each use an observation timeout no greater than 2 seconds.",
    "Login, captcha, 2FA, amount mismatch, ambiguous DOM, exhausted retry, and final verification failure must fail closed without PDF upload or fake success."
  ],
  "forbidden": [
    "Opening sellerCentralEntryUrl and then opening the derived order-detail URL as two normal entry steps for the same item.",
    "Any same-tab order-page refresh helper, recovery refresh, random readiness delay, fallback, compatibility bridge, or shadow branch.",
    "Placing local-batch inter-item pacing inside BrowserController, DOM observation, the single-upload plugin flow, task watchdog, or execution lease.",
    "Using a short elapsed-time deadline as the existing-invoice business verdict after Manage invoice was clicked.",
    "Using the BrowserController 10-second default evaluation timeout for an Amazon invoice DOM snapshot.",
    "Allowing a transient order-detail DOM evaluation exception to escape directly as an unclassified upload-flow runtime failure.",
    "Starting the next same-page observation before the preceding 2-second window has returned and logged its failure.",
    "Discarding BrowserController.open result, fabricating a navigation ref without a forensics writer, or using orderId plus invoiceNo as the only repeated-execution identity.",
    "A state-read, geometry-read, snapshot, or wait path that creates a Chrome window or writes any URL.",
    "A detached Promise.race timeout that can leave the prior upload flow running after a terminal task result.",
    "Two Amazon invoice executions concurrently controlling the shared BrowserController.",
    "Starting the next batch invoice because the current order's Manage invoice dialog has not reached an explicit DOM terminal state yet.",
    "Proceeding to upload before target order id, invoice action state, and amount equality are proven."
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-011-requirement",
      "statement": "Amazon invoice upload uses one order-detail navigation per item, never refreshes or reopens the order page, and advances from Manage invoice only after an order-bound explicit DOM terminal signal; elapsed time alone never selects the business branch or starts the next invoice.",
      "evidenceMode": "real-chrome",
      "ownerDomain": "amazon-invoice-upload"
    }
  ]
}
```

## [GRASSEYE-AMAZON-INVOICE-UPLOAD-012-V1] Batch Ledger Preflight Skip and Inter-Item Pacing

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-INVOICE-UPLOAD-012-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ledger+app-shell+acceptance+audit",
  "summary": "Local APP batch upload must read the existing Agent upload ledger before per-file upload, pace consecutive real single-upload requests by a governed random 2-to-15-second interval, and recover the exact Seller Central no-actions invoice dialog without refreshing the order page.",
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
    "After opening Manage invoice / 管理发票, the flow waits until one unique visible dialog is bound to the current amazonOrderId and exposes exactly one explicit terminal branch: a matching uploaded invoice row, a fully rendered upload-ready table plus upload action, or an exact governed read-failure blocker such as 很抱歉，目前没有可用的操作。 or 读取失败.",
    "The real-Chrome Chinese already-uploaded branch is the conjunction of one visible dialog heading 订单<amazonOrderId>的发票, exactly one descendant row containing the exact complete invoiceNo, and the explicit status 由卖家生成 / Seller generated, 成功：已上传 or an equivalent strong uploaded state; the heading, order id or a whole-page row alone is not success evidence.",
    "Only when the unique visible invoice dialog whose title contains the current complete amazonOrderId exposes an exact governed read-failure blocker may the same upload flow execute one recovery: derive a safe point outside that dialog from the live dialog rectangle and viewport, click the blank area, verify within 2 seconds that the blocked dialog disappeared, reopen Manage invoice once, and resume the same AND THEN terminal-state wait; read-failure text from any unrelated dialog must be ignored.",
    "If the dialog is ambiguous, no safe outside point exists, dismissal is not verified, reopening fails, or the exact blocker appears again, the order must stop as review_required before any PDF upload.",
    "APP batch upload and external API upload must use this same plugin-owned recovery through the existing /api/plugins/amazon-invoice-upload/start route.",
    "A still-loading or unchanged Seller Central invoice list remains on the current order; it must never be collapsed into already_uploaded, upload_success, review_required, or permission to start the next order solely because time elapsed.",
    "Failed, blocked, manual-required, invalid, or unknown ledger records must not be skipped.",
    "If the ledger preflight cannot be read, the local queue must fail closed before uploading more files.",
    "Each non-skipped file must still call the existing single-upload route /api/plugins/amazon-invoice-upload/start with one invoicePdf.",
    "The local batch start action is latched and disabled while a batch is running; repeated submit is rejected without creating another request loop.",
    "Duplicate complete amazonOrderId values in the same selected batch are marked invalid before any upload request is sent.",
    "An explicit status equal to review_required, including the task-level operational watchdog result, stops the local batch before the next queued order starts; the reviewRequired metadata boolean alone is never a batch-control command.",
    "An amount_mismatch_skipped item retains that exact status and review metadata in the local queue, increments the visible failed/review count, and continues to the next queued order without attaching the current PDF.",
    "Between two consecutive non-ledger-skipped single-upload requests, the local queue selects exactly one cryptographically generated integer delay from 2000ms through 15000ms after the prior formal terminal result and before the next POST /api/plugins/amazon-invoice-upload/start.",
    "The pacing delay is not consumed by ledger-preflight skips, invalid files, or duplicate files; it does not run before the first real request, after the final real request, or after any result that stops the batch.",
    "upload_success, live already_uploaded, amount_mismatch_skipped, and an ordinary failed result that is allowed to continue all require pacing before the next real request; explicit review_required, blocked_auth, execution busy, task watchdog timeout, and unknown transport outcome stop without pacing or another request.",
    "While pacing, the running latch and disabled Start action remain held and the App Shell exposes the selected delay and next start timestamp without writing a second batch ledger or changing the prior item terminal result."
  ],
  "forbidden": [
    "Skipping based on website export state.",
    "Skipping based on filename alone.",
    "Skipping failed, review_required, blocked_auth, manual_required, or invalid records.",
    "Branching business logic from reason.includes(\"already uploaded\") instead of the formal already_uploaded status.",
    "Adding a second batch ledger, second batch route, or second upload service to support resume.",
    "Uploading all selected PDFs in one multipart request.",
    "Refreshing or reopening the order-detail URL as recovery for the no-actions Manage invoice dialog.",
    "Using hard-coded, caller-provided, API-provided, or APP-provided coordinates to dismiss the dialog.",
    "Retrying the outside-dialog dismissal or Manage invoice reopen more than once.",
    "Keeping the retired order-refresh recovery as a fallback, compatibility bridge, or shadow branch.",
    "Allowing double-submit to create two local batch loops.",
    "Sending an upload request for a duplicate complete order id in the same local batch.",
    "Continuing the local batch after an explicit review_required status or treating a still-loading invoice dialog as a completed item.",
    "Converting amount_mismatch_skipped into review_required, breaking the local queue from reviewRequired metadata, or preventing the next queued order from starting after an amount mismatch has been recorded.",
    "Using caller input, API input, environment overrides, Math.random, a fixed-delay fallback, or a second scheduler to choose the inter-item pacing delay.",
    "Delaying ledger-only skips, delaying before the first real request or after the last real request, consuming the pending delay before a ledger skip, or starting the next real request earlier than the selected delay.",
    "Continuing after task watchdog timeout, execution busy, explicit review_required, blocked_auth, or an unknown single-upload transport outcome."
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-012-requirement",
      "statement": "Local APP batch upload must read the existing Agent upload ledger before per-file upload, skip only orders already proven upload_success or already_uploaded for the same order id and invoice number, and pace consecutive real single-upload requests by one governed random 2-to-15-second interval.",
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
  "summary": "API-triggered Amazon invoice upload must preserve the operator's foreground Chrome focus and must not perform a website-tab return action after the Amazon terminal result.",
  "appliesTo": [
    "src/app/workbench-amazon-routes.ts",
    "src/lib/browser/browser-controller.ts",
    "src/lib/browser/exact-target/browser-command-runtime.ts",
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
    "For API-sourced upload missions with adminOrderUrl, the task service persists the original Amazon upload terminal result and performs no browser action against adminOrderUrl.",
    "The operator's active window and active tab remain unchanged after the background exact-target upload finishes.",
    "Normal Amazon Manage admin page opening remains an explicit user-started local action in its own owner-bound exact target session.",
    "adminOrderUrl must still pass the allowed Amazon admin host validation before any tab focus attempt.",
    "A post-change production-readiness claim for website tab return must cite fresh runtime evidence from the changed path; historical Seller Central upload success evidence is not proof that the website return IF was tested."
  ],
  "forbidden": [
    "Opening, activating, focusing, refreshing, or navigating adminOrderUrl after upload completion.",
    "Any website-return browser policy or foreground-focus restoration helper.",
    "Inferring upload_success, already_uploaded, or review_required from website focus state.",
    "Declaring the changed API website return path production verified from logs, acceptance strings, or pre-change upload evidence alone.",
    "Adding a second browser controller, second upload task chain, second route, or compatibility wrapper for tab return."
  ],
  "clauses": [
    {
      "clauseId": "grasseye-amazon-invoice-upload-013-requirement",
      "statement": "API-triggered Amazon invoice upload must preserve the operator's foreground Chrome focus and perform no website-return browser action after terminal persistence.",
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
    "For App Shell batch upload, amount_mismatch_skipped is an item-local terminal result: the task and ledger record the mismatch, the current PDF remains untouched, and the local queue continues with the next queued order; reviewRequired is display metadata and must not be promoted to an explicit review_required batch stop.",
    "The task record and ledger reason must include a concise safe skip reason without logging raw PDF text, raw DOM HTML, cookies, browser storage, or local absolute PDF paths.",
    "API-triggered uploads and App Shell batch uploads must both pass through the same single-upload amount gate."
  ],
  "forbidden": [
    "Opening the upload dialog before the amount gate passes.",
    "Calling uploadApprovedInvoice before the amount gate passes.",
    "Treating filename, APP amount, website export amount, or caller-provided amount as order total truth.",
    "Running a separate APP-only or API-only amount checker that can disagree with the flow result.",
    "Stopping the remaining App Shell batch solely because an amount_mismatch_skipped item carries reviewRequired true.",
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
