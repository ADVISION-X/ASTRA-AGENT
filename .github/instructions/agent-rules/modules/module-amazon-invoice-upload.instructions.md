---
name: "GrassEye Amazon Invoice Upload Terminal Authority"
description: "Governs the single terminal Amazon invoice owner; no Invoice Browser action is authorized by the active site policy."
applyTo: "src/plugins/amazon-invoice-upload/**,src/mediator/amazon-invoice-upload-route.ts,src/lib/local-runtime/workbench-amazon-invoice-handle.ts,scripts/audit/domains/amazon-invoice-upload/**,scripts/acceptance/amazon-invoice-upload-terminal.acceptance.ts,docs/法案辅助文件/GrassEye Amazon Invoice Upload Unified Chain 施工图.md"
---

# GrassEye Amazon Invoice Upload Terminal Authority

status: active
version: 2026-08-21
capabilityDomain: amazon-invoice-upload
tier: P0
enforcementMode: machine-blocking
constructionBlueprint: `docs/法案辅助文件/GrassEye Amazon Invoice Upload Unified Chain 施工图.md`

## [APEX-AMAZON-INVOICE-UPLOAD-001-V2] Terminal Authority Gate

```apex-law
{
  "lawId": "APEX-AMAZON-INVOICE-UPLOAD-001-V2",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-invoice-upload",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+acceptance+real-chrome",
  "summary": "Amazon invoice upload remains one plugin owner and always fails closed at the terminal Browser Authority gate because the active site policy authorizes no Invoice write action.",
  "appliesTo": [
    "src/plugins/amazon-invoice-upload/**/*.{ts,tsx,js,jsx,mjs}",
    "src/mediator/amazon-invoice-upload-route.ts",
    "src/lib/local-runtime/workbench-amazon-invoice-handle.ts",
    "scripts/audit/domains/amazon-invoice-upload/**",
    "scripts/acceptance/amazon-invoice-upload-terminal.acceptance.ts",
    "docs/法案辅助文件/GrassEye Amazon Invoice Upload Unified Chain 施工图.md"
  ],
  "required": [
    "The single amazon-invoice-upload plugin owns its upload/download task records and exposes only its public facade through its unique mediator route.",
    "Before a governed Amazon Invoice site action exists, upload and CSV-download starts persist a terminal record with BROWSER_AUTHORITY_NOT_PRODUCTION_VERIFIED and respectively return review_required or manual_required.",
    "The terminal record must not read, upload, download, navigate, fill, click, evaluate, attach a file, or claim a browser target.",
    "The current terminal owner has no Browser action admission. It may consume neither a per-job/operator-claimed target nor any page-control capability; Session Workspace and dynamic Authority/Target/Document issuance remain Browser-owner concepts and do not authorize an absent Invoice site action.",
    "Approved PDFs and CSV content remain untouched while the terminal gate is closed."
  ],
  "forbidden": [
    "BrowserController, CWS, page relay, external debugging port, native messaging, legacy open/evaluate/getLeaseState API, BrowserTargetSession or DOM-automation compatibility bridge",
    "fallback upload/download browser path, shadow queue, second invoice plugin, second mediator, second evidence store or second runtime-log chain",
    "calling Amazon Seller Central or recording upload/download success while terminal Browser Authority admission is absent",
    "mapping browser authority absence to order_not_found, upload_success or download completion",
    "future or conditional Invoice Browser capability text inside active authority"
  ],
  "clauses": [
    {
      "clauseId": "apex-amazon-invoice-upload-001-v2-terminal-authority",
      "statement": "The single Amazon invoice owner must persist a fail-closed terminal record until governed Browser Authority admission is actually available, without reviving an old browser or DOM execution chain.",
      "evidenceMode": "acceptance",
      "ownerDomain": "amazon-invoice-upload"
    }
  ]
}
```
