---
name: "GrassEye Local App Shell"
description: "Governs the local HTTP workbench and its first-page job entry surface."
applyTo: "src/app/**, src/lib/local-runtime/**"
---

# GrassEye Local App Shell

status: active
version: 2026-05-22
capabilityDomain: local-app-shell

## Boundary

The local app shell is the workbench surface opened by startup. It shows lawful
job flow entry points, health, mode, task status, evidence references, and local
settings when needed. It does not own workflow order, browser actions, AI
judgment, evidence truth, or CI truth.

## [APEX-LOCAL-APP-SHELL-001-V1] Local Workbench Surface

```apex-law
{
  "lawId": "APEX-LOCAL-APP-SHELL-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "local-app-shell",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs",
  "summary": "The root page must be a local workbench surface with health, mode, and lawful job flow entry points.",
  "appliesTo": [
    "src/app/**"
  ],
  "forbidden": [
    "Root page as endpoint documentation only.",
    "Root page as marketing page.",
    "Root page without health or mode visibility.",
    "Root page without lawful job flow entry points."
  ]
}
```

Required:

- The root page exposes `/api/health` and `/api/mode` status.
- The root page exposes lawful job flow entry points.
- Amazon invoice upload is the first active job entry point.
- Facebook product video mining may be shown only as its own explicit job flow.

## [APEX-LOCAL-APP-SHELL-002-V1] Job Card Input Discipline

```apex-law
{
  "lawId": "APEX-LOCAL-APP-SHELL-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "local-app-shell",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs",
  "summary": "Workbench input surfaces must collect structured inputs for explicit job flows and must not become a natural-language task planner.",
  "appliesTo": [
    "src/app/**"
  ],
  "forbidden": [
    "Natural-language universal task box.",
    "AI generated action plan input.",
    "Generic mission dashboard entry.",
    "Single form mixing unrelated job flows."
  ]
}
```

Required:

- Each visible job flow has its own bounded input surface.
- Amazon invoice upload collects order id, seller URL, invoice number, approved PDF, marketplace, and human final-submit choice.
- Job inputs submit to the app-shell HTTP API; workflow order remains inside the owning job flow.

## [APEX-LOCAL-APP-SHELL-003-V1] Status And Evidence Window

```apex-law
{
  "lawId": "APEX-LOCAL-APP-SHELL-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "local-app-shell",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs",
  "summary": "The workbench must expose task status, failure reasons, and evidence references without replacing the evidence store.",
  "appliesTo": [
    "src/app/**",
    "src/lib/local-runtime/**"
  ],
  "forbidden": [
    "UI fabricating task success.",
    "UI replacing evidence records.",
    "UI hiding failureReason or review-required state.",
    "Status panel pretending to be runtime logs or CI."
  ]
}
```

Required:

- The workbench shows task or run status.
- The workbench shows `failureReason`, `reason`, or review state when present.
- Evidence references may be displayed as references only.

## [APEX-LOCAL-APP-SHELL-004-V1] No Second Runtime Dashboard

```apex-law
{
  "lawId": "APEX-LOCAL-APP-SHELL-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "local-app-shell",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "The local app shell must not resurrect universal dashboards, command consoles, visual runtime control panels, planners, or second orchestration.",
  "appliesTo": [
    "src/app/**",
    "src/lib/local-runtime/**"
  ],
  "forbidden": [
    "Universal mission dashboard.",
    "Old commander console as active architecture.",
    "Visual-runtime control panel.",
    "AI next-action planner.",
    "Browser or DOM action controller in the app shell.",
    "App shell deciding business flow steps."
  ]
}
```

Forbidden:

- Universal mission dashboard.
- Old command console as active architecture.
- Product-video dashboard as an ungoverned runtime.
- Visual runtime control panel.
- App-shell next-action planner.
- Browser/DOM control buttons owned by the app shell.
