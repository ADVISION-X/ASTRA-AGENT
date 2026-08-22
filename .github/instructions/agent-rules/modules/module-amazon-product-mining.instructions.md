---
name: "GrassEye Amazon Product Mining Terminal Authority"
description: "Governs the single terminal Amazon product-mining owner; no mining Browser action is authorized by the active site policy."
applyTo: "src/plugins/amazon-product-mining/**,src/mediator/amazon-product-mining-route.ts,src/lib/local-runtime/workbench-marketplace-handles.ts,scripts/audit/domains/amazon-product-mining/**,scripts/acceptance/amazon-product-mining-terminal.acceptance.ts,docs/法案辅助文件/GrassEye Amazon 产品挖掘施工图.md"
---

# GrassEye Amazon Product Mining Terminal Authority

status: active
version: 2026-08-21
capabilityDomain: amazon-product-mining
tier: P0
enforcementMode: machine-blocking
constructionBlueprint: `docs/法案辅助文件/GrassEye Amazon 产品挖掘施工图.md`

## [APEX-AMAZON-PRODUCT-MINING-001-V3] Terminal Authority Gate

```apex-law
{
  "lawId": "APEX-AMAZON-PRODUCT-MINING-001-V3",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+acceptance+real-chrome",
  "summary": "Amazon product mining remains a single terminal evidence-package owner and persists review_required with zero browser work because the active site policy authorizes no mining action.",
  "appliesTo": [
    "src/plugins/amazon-product-mining/**/*.{ts,tsx,js,jsx,mjs}",
    "src/mediator/amazon-product-mining-route.ts",
    "src/lib/local-runtime/workbench-marketplace-handles.ts",
    "scripts/audit/domains/amazon-product-mining/**",
    "scripts/acceptance/amazon-product-mining-terminal.acceptance.ts",
    "docs/法案辅助文件/GrassEye Amazon 产品挖掘施工图.md"
  ],
  "required": [
    "The plugin remains the unique owner of validated mining input, task state and intervention state; the current terminal contract produces no evidence package.",
    "The active terminal path persists review_required with BROWSER_AUTHORITY_NOT_PRODUCTION_VERIFIED and zero keywords, search results, product details, reviews or package artifacts.",
    "No terminal mining action may navigate, inspect, evaluate, fill, click, upload, download, call AI or claim a target.",
    "The current terminal owner has no Browser action admission. It may consume neither a per-job/operator-claimed target nor any page-control capability; Session Workspace and dynamic Authority/Target/Document issuance remain Browser-owner concepts and do not authorize an absent mining site action."
  ],
  "forbidden": [
    "BrowserController, CWS, old open/evaluate API, DOM compatibility adapter, generic planner, fallback, shadow execution path or second product-mining owner",
    "calling Amazon, an AI provider or returning an evidence package before terminal browser admission exists",
    "reporting the terminal record as a product conclusion, completed package or browser proof",
    "future or conditional product-mining Browser capability text inside active authority"
  ],
  "clauses": [
    {
      "clauseId": "apex-amazon-product-mining-001-v3-terminal-authority",
      "statement": "Amazon product mining must fail closed in its single owner until real Browser Authority admission is verified, without retaining the deleted browser execution chain.",
      "evidenceMode": "acceptance",
      "ownerDomain": "amazon-product-mining"
    }
  ]
}
```
