---
name: "GrassEye Page State — Retired"
description: "Page State independent ability group is retired. Raw browser observation, if needed, belongs to Browser Session / Local Runtime helper as non-owner support evidence. Use when reviewing retired-surface regression or raw browser observation helper boundaries."
applyTo: "src/lib/browser/**, src/lib/local-runtime/**, scripts/audit/domains/retired-surface-guard/**"
---

# GrassEye Page State — RETIRED

Status: **RETIRED as independent ability group** in the current simple-machine phase.

## Retirement Decision

Page State independent ability group is retired.

```txt
Page State independent ability group should exit the main stage.
```

No active `src/capabilities/page-state` implementation is allowed.
No active `scripts/audit/domains/page-state-capability` is allowed.

## Raw Browser Observation Helper (Replacement)

If raw URL/title/login/runtime signals are needed, they must be provided by:

```txt
src/lib/browser/browser-observation.ts
```

via `readRawBrowserObservation()`.

Allowed output fields:
- `observationRef`
- `currentUrl?`
- `currentTitle?`
- `browserLoginState?`
- `rawRuntimeSignals?`
- `snapshotProofRef?`
- `observedAt`
- `status`
- `failureReason?`

## Core Doctrine

Raw page observation is optional support evidence only.

AI Visual Mission Judge remains the only owner of:
- page readiness
- blocker decisions
- login/captcha/safety/feed/video/comment interpretation
- action semantic success

## Forbidden

```txt
feedReady
pageReady
pageCorrect
pageStateType = platform_feed
loginSemantic, captchaSemantic, safetySemantic
feedSemantic, videoSemantic, commentSemantic
blockerDecision
actionSemanticSuccess
semanticDecision
businessTruth
```

## Helper Boundary

Raw Browser Observation helper must NOT:
1. Register as an ability group.
2. Register as a MuscleMemory action.
3. Become an AI-visible actionCode.
4. Become an Orchestration decision source.
5. Become a PAV input truth.
6. Become a Commander dashboard source.
7. Become a Forensics business record source.

It is optional support evidence ref only.

## Retired Capability Regression Guard

`scripts/audit/domains/retired-surface-guard/inspector.ts` must block any re-emergence of:
- `src/capabilities/page-state`
- `scripts/audit/domains/page-state-capability`
- `page-state` as active CI owner
- Page State MuscleMemory action
- Semantic fields in raw observation helper

---

> **HISTORICAL-RETIRED CLAUSES**
> All `GRASSEYE-PAGE-STATE-CAPABILITY-*` law entries below are historical-retired clauses.
> They must NOT be counted as active laws, active lawIds, or active enforcement targets.
> They exist for historical reference only and must not be revived.

## Law GRASSEYE-PAGE-STATE-CAPABILITY-001-V2

status: retired
tier: reference
capabilityDomain: page-state-capability
enforcementMode: historical-retired
evidenceMode: historical-reference

summary: Page State must have a complete and bounded source structure with required files and no forbidden artifacts.

## Law GRASSEYE-PAGE-STATE-CAPABILITY-002-V2

status: retired
tier: reference
capabilityDomain: page-state-capability
enforcementMode: historical-retired
evidenceMode: historical-reference

summary: Page State must not import forbidden capability implementations or use forbidden runtime patterns.

## Law GRASSEYE-PAGE-STATE-CAPABILITY-003-V2

status: retired
tier: reference
capabilityDomain: page-state-capability
enforcementMode: historical-retired
evidenceMode: historical-reference

summary: Page State must maintain strict capability boundary and not leak into orchestration or AI decision layers.

## Law GRASSEYE-PAGE-STATE-CAPABILITY-004-V2

status: retired
tier: reference
capabilityDomain: page-state-capability
enforcementMode: historical-retired
evidenceMode: historical-reference

summary: Page State truth ownership must be restricted to designated observation sources only.

## Law GRASSEYE-PAGE-STATE-CAPABILITY-005-V2

status: retired
tier: reference
capabilityDomain: page-state-capability
enforcementMode: historical-retired
evidenceMode: historical-reference

summary: Page State anti-escape: no dynamic import, eval, or escape-hatch patterns allowed.

## Law GRASSEYE-PAGE-STATE-CAPABILITY-006-V2

status: retired
tier: reference
capabilityDomain: page-state-capability
enforcementMode: historical-retired
evidenceMode: historical-reference

summary: Page State required shape: all required capability files must be present and correctly structured.

## Law GRASSEYE-PAGE-STATE-CAPABILITY-007-V2

status: retired
tier: reference
capabilityDomain: page-state-capability
enforcementMode: historical-retired
evidenceMode: historical-reference

summary: Page State source boundaries must not be crossed by any other capability.

## Law GRASSEYE-PAGE-STATE-CAPABILITY-008-V2

status: retired
tier: reference
capabilityDomain: page-state-capability
enforcementMode: historical-retired
evidenceMode: historical-reference

summary: Page State index must not use export-star barrels and must not use escape hatches or dynamic import patterns.
