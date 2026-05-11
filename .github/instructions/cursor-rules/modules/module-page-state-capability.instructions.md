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

