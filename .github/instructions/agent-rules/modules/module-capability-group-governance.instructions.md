---
name: "GrassEye Capability Group Governance"
description: "Governs when an ability group may exist, how child abilities are admitted, and how job flows, mediators, evidence, logs, browser primitives, and AI stay out of ability-group ownership."
applyTo: "src/capabilities/**,src/plugins/**,src/mediator/**,src/lib/**,scripts/audit/**,.github/instructions/agent-rules/modules/**"
---

# GrassEye Capability Group Governance

status: active
version: 2026-05-21
capabilityDomain: capability-group-governance

## 0. Identity

GrassEye is a job-flow automation system.

Ability groups are stable same-kind action families. They are not business flows, dispatchers, planners, local app shells, or universal agents.

Allowed architecture position:

```txt
Job Flow
  -> Ability Group public facade
      -> Child Ability
          -> structured result / evidence ref / failure reason
```

## 1. Current Approved Ability Groups

Approved active ability groups:

```txt
src/capabilities/dom-automation/**
src/capabilities/ai-input-gateway/**
src/capabilities/forensics-persistence/**
src/capabilities/video-download/**
```

Approved infrastructure roots that are not ability groups:

```txt
src/lib/browser/**
src/lib/storage/**
src/lib/runtime-logs/**
src/lib/local-runtime/**
src/lib/online-ai/**
```

Browser and Runtime Logs are infrastructure owners, not ability groups. Active blueprints and audit reports must not declare them as capability roots.

Currently approved validated job flow root:

```txt
src/plugins/amazon-invoice-upload/**
```

Future job flow roots under `src/plugins/<job-id>/**` are allowed only after architecture law, mediator route, evidence contract, acceptance proof, and audit ownership are in place.

Any new ability group family requires an active law update before code is accepted.

## 2. Law APEX-CAPABILITY-GROUP-001-V1 — Ability Group Admission

```apex-law
{
  "lawId": "APEX-CAPABILITY-GROUP-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "capability-group-governance",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "An ability group may exist only when it owns one same-kind reusable action family and has an active governing law.",
  "appliesTo": [
    "src/capabilities/**/*.{ts,tsx,js,jsx,mjs}",
    ".github/instructions/agent-rules/modules/**/*.md"
  ],
  "forbidden": [
    "Ability group without active law.",
    "Ability group created for one business job only.",
    "Ability group owning multiple unrelated action kinds.",
    "Business flow disguised as ability group.",
    "Universal agent runtime disguised as ability group."
  ]
}
```

Required:

- One ability group owns one same-kind action family.
- It has an active law file or active law section.
- It has a public facade.
- It has typed schemas or contracts.
- It returns structured results.

Forbidden:

- Creating an ability group merely to serve one job-specific step.
- Mixing unrelated action families in one group.
- Naming an orchestration layer as an ability group.

## 3. Law APEX-CAPABILITY-GROUP-002-V1 — Child Ability Atomicity

```apex-law
{
  "lawId": "APEX-CAPABILITY-GROUP-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "capability-group-governance",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Each child ability must perform one atomic action and must not hide workflow logic.",
  "appliesTo": [
    "src/capabilities/**/runtime/**/*.{ts,tsx,js,jsx,mjs}",
    "src/capabilities/**/children/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "forbidden": [
    "Child ability performing a full business flow.",
    "Child ability deciding next business step.",
    "Child ability calling unrelated ability groups.",
    "Child ability importing job plugins.",
    "Child ability hiding planner behavior."
  ]
}
```

Required:

- One child ability has one verb.
- Inputs are caller-approved.
- Outputs are structured.
- Failure and review-required states are explicit.

Forbidden:

- Multi-step job flow inside a child ability.
- Hidden orchestration.
- Business final success decision.

## 4. Law APEX-CAPABILITY-GROUP-003-V1 — Public Facade Boundary

```apex-law
{
  "lawId": "APEX-CAPABILITY-GROUP-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "capability-group-governance",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast",
  "summary": "Job flows may use ability groups only through public facades and must not import non-facade or private runtime internals.",
  "appliesTo": [
    "src/plugins/**/*.{ts,tsx,js,jsx,mjs}",
    "src/capabilities/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "forbidden": [
    "Plugin importing non-facade ability files.",
    "Plugin importing ability runtime internals.",
    "Plugin importing ability private child files.",
    "Ability group importing unrelated capability owner files.",
    "Ability group importing plugin files.",
    "Facade re-exporting unrelated owners.",
    "Barrel laundering of private imports."
  ]
}
```

Required:

- Job flows import ability public APIs only from `src/capabilities/<group-id>/index.ts`.
- Private runtime files are internal to their ability group.
- Public facade exports must be explicit.
- `src/capabilities/dom-automation/index.ts` may export only its law-approved public child ability functions.
- Capability facades other than DOM Automation stay factory-and-contract oriented: public types, schemas, port interfaces, and the ability-group factory only.

Forbidden:

- `export *`.
- Consumer imports from `runtime/**`.
- Consumer imports from any non-facade ability file.
- Ability group imports from unrelated `src/capabilities/<other-group-id>/**` owners.
- Ability group imports from `src/plugins/**`.
- Facades laundering `runtime/**`, `children/**`, `registry.ts`, concrete storage adapters, or platform probe scripts as public runtime values.

## 5. Law APEX-CAPABILITY-GROUP-004-V1 — Business Neutrality

```apex-law
{
  "lawId": "APEX-CAPABILITY-GROUP-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "capability-group-governance",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Ability groups must stay business-neutral and must not contain platform-specific workflow logic.",
  "appliesTo": [
    "src/capabilities/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "forbidden": [
    "Amazon-specific workflow inside an ability group.",
    "Facebook-specific workflow inside an ability group.",
    "Order upload process order inside an ability group.",
    "Product-video mining workflow inside an ability group.",
    "Business final status inside an ability group."
  ]
}
```

Required:

- Business hints may be passed in by a job flow.
- Business decisions remain in `src/plugins/<job-id>/**`.
- Ability results describe action facts, not job completion.

Forbidden:

- Ability group deciding `upload_success`.
- Ability group deciding product value.
- Ability group owning platform navigation flow.

## 6. Law APEX-CAPABILITY-GROUP-005-V1 — AI Boundary

```apex-law
{
  "lawId": "APEX-CAPABILITY-GROUP-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "capability-group-governance",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast",
  "summary": "Ability groups must not use AI as planner, next-action chooser, selector generator, or browser-command generator.",
  "appliesTo": [
    "src/capabilities/**/*.{ts,tsx,js,jsx,mjs}",
    "src/plugins/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "forbidden": [
    "AI returning nextAction.",
    "AI returning actionPlan.",
    "AI returning browserCommand.",
    "AI returning selector or coordinate.",
    "AI generating runtime workflow steps."
  ]
}
```

Allowed:

- AI may answer bounded choice questions through the approved AI boundary.

Forbidden:

- Planner resurrection.
- AI-visible DOM selectors.
- AI-visible coordinates.
- AI-generated workflow.

## 7. Law APEX-CAPABILITY-GROUP-006-V1 — Evidence and Log Separation

```apex-law
{
  "lawId": "APEX-CAPABILITY-GROUP-006-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "capability-group-governance",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Ability groups may create action evidence refs but must not own separate evidence stores or private log systems.",
  "appliesTo": [
    "src/capabilities/**/*.{ts,tsx,js,jsx,mjs}",
    "src/lib/runtime-logs/**/*.{ts,tsx,js,jsx,mjs}",
    "src/capabilities/forensics-persistence/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "forbidden": [
    "Private evidence database inside an ability group.",
    "Private JSONL log system inside an ability group.",
    "Forged evidence ref.",
    "Stale evidence reused as fresh proof.",
    "Sensitive data logged by an ability group."
  ]
}
```

Required:

- Evidence store owns persistence truth.
- Runtime logs own log transport and redaction.
- Ability groups may return evidence refs from real observations or actions.

Forbidden:

- Ability-owned second logging chain.
- Ability-owned second evidence chain.

## 8. Law APEX-CAPABILITY-GROUP-007-V1 — Retired Ability Ban

```apex-law
{
  "lawId": "APEX-CAPABILITY-GROUP-007-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "capability-group-governance",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Retired standalone ability owners must not return as active capability groups.",
  "appliesTo": [
    "src/capabilities/**/*",
    "src/**/*.{ts,tsx,js,jsx,mjs}",
    "scripts/**/*.{ts,js,mjs}",
    "package.json"
  ],
  "forbidden": [
    "nerve-bus active owner.",
    "orchestration active owner.",
    "geometry-guard active owner.",
    "mouse-click active owner.",
    "mouse-scroll active owner.",
    "text-input active owner.",
    "open active owner.",
    "screenshot active owner.",
    "video-download as a standalone top-level execution owner.",
    "universal-agent active owner.",
    "planner active owner."
  ]
}
```

Retired names may appear only in:

- active law forbidden sections
- migration notes
- archive notes
- deletion reports
- forbidden regression tests

## 9. Law APEX-CAPABILITY-GROUP-008-V1 — Audit Coverage

```apex-law
{
  "lawId": "APEX-CAPABILITY-GROUP-008-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "capability-group-governance",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "hybrid",
  "summary": "Capability group governance must be enforceable by audit before production readiness is claimed.",
  "appliesTo": [
    "scripts/audit/**/*.{ts,js,mjs,json}",
    "package.json"
  ],
  "forbidden": [
    "Production readiness without capability-group audit.",
    "Warning-only P0 capability-group finding.",
    "Generated fake PASS.",
    "Runner detached from active capability laws.",
    "Manual generated artifact truth."
  ]
}
```

Minimum inspector checks:

- Approved ability roots only.
- Each ability group has public facade.
- Plugins do not import non-facade ability files.
- Plugins do not import ability runtime internals.
- Ability groups do not import unrelated capability owners.
- Ability groups do not import plugins.
- Retired ability owner roots absent.
- `export *` absent from public facades.

## 10. Production Readiness Gate

An ability group may be called production-stable only when:

- It has an active law.
- It has a corresponding construction blueprint or implementation map.
- It has a public facade.
- It has typed schemas/contracts.
- Its child abilities are atomic.
- Its failures are structured.
- Its evidence refs are truthful.
- Its business neutrality is auditable.
- Its consumer imports are facade-only.
- Its P0 audit checks are runner-visible.

If any item is missing, the correct status is:

```txt
Ability group is active but not production-stable.
```

## 11. Final Principle

```txt
A job flow decides what should happen.
An ability group performs one kind of action.
A child ability performs one atomic operation.
Evidence and logs prove what happened.

If an ability group starts deciding the mission, it has become a second flow and must fail.
```
