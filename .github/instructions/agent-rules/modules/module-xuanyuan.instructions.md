---
description: "GrassEye Xuanyuan API simulation law: unified AI-side endpoint for external websites, using governed prompt packages through AI Input Gateway before future real API-key provider switching."
applyTo: "src/plugins/xuanyuan/**/*.ts,src/app/workbench-xuanyuan-routes.ts,src/app/workbench-api-boundary.ts,scripts/audit/domains/xuanyuan/**/*.ts,scripts/acceptance/xuanyuan.acceptance.ts,docs/法案辅助文件/GrassEye Xuanyuan API 临时实现施工图.md"
---

# GrassEye Xuanyuan API Simulation Law

status: active
version: 2026-07-03
capabilityDomain: xuanyuan

Scope: `xuanyuan` is the only GrassEye owner for the temporary AI API simulation endpoint used by external websites before real API-key provider switching.

`xuanyuan` is not a universal agent and not a second AI provider transport. It receives governed prompt packages from external systems, persists task and prompt-package evidence, calls AI Input Gateway through its public contract, and returns a stable task/result contract.

## Required

- The job id is `xuanyuan`.
- The plugin root is `src/plugins/xuanyuan/`.
- External website access must enter through Workbench API Boundary.
- External website calls must use `X-GrassEye-Agent-Key`; websites must not call ChatGPT, OpenAI, Gemini, Claude, provider SDKs, or provider web chat directly.
- The first implementation must use `providerKind: "gpt-web-chat"` as the temporary simulation provider.
- A xuanyuan request must carry `requestId`, `sourceProject`, `scenario`, `promptPackageId`, `promptContractId`, `inputRefs`, `textPrompt`, `timeoutMs`, `maxInputChars`, `maxFileCount`, and `maxFileBytes`.
- The task must persist request snapshot, prompt package snapshot, input hash proof as returned by AI Input Gateway, raw output refs, parse status, schema validation status, provider proof, failure reason, and review-required reason.
- The route surface must expose only known xuanyuan routes: `POST /api/xuanyuan/simulate`, `GET /api/xuanyuan/status`, `GET /api/xuanyuan/latest`, and `GET /api/xuanyuan/history`.
- Switching to a future real API-key provider must happen behind AI Input Gateway without changing the website-side request/result contract.
- `parse_failed_raw_available` or failed AI Input Gateway results must not be returned as `succeeded`.

## Forbidden

- No second HTTP server, API gateway, route bus, or external dispatcher.
- No website direct provider calls.
- No website-held provider API key.
- No provider SDK or provider web-chat DOM operation inside `src/plugins/xuanyuan/**`.
- No `src/plugins/xuanyuan/**` import from provider adapter files.
- No browser command, selector, coordinate, next action, or action plan accepted from external websites.
- No cookies, localStorage, sessionStorage, passwords, provider tokens, or browser profile paths in xuanyuan requests.
- No fake success, fallback success, mock production result, or swallowed provider failure.
- No AI output controlling browser actions, workflow order, payment, submission, deletion, or other sensitive final actions.

## Law IDs

```apex-law
{
  "lawId": "GRASSEYE-XUANYUAN-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "xuanyuan",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+acceptance+audit",
  "summary": "Xuanyuan must be the single governed AI API simulation owner for external websites, entering through Workbench API Boundary and calling AI Input Gateway without provider direct calls or website-held provider keys.",
  "required": [
    "Known xuanyuan routes exist and are admitted by Workbench API Boundary.",
    "Xuanyuan persists request, prompt package, AI Input Gateway result, provider proof, and parse status.",
    "External website contract stays provider-agnostic for later real API-key switching."
  ],
  "forbidden": [
    "second HTTP server or API gateway",
    "website direct provider call or website-held provider key",
    "xuanyuan direct provider SDK or web-chat DOM operation",
    "fake success when provider or parsing fails"
  ]
}
```
