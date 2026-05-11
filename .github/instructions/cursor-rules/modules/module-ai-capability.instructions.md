---
name: "GrassEye AI Capability"
description: "Use when governing the AI Ability Group, prompt contract, single-step reasoning flow, local model call boundary, output schema, and AI proof boundary."
applyTo: ".github/instructions/cursor-rules/modules/module-ai-capability.instructions.md, .github/instructions/cursor-rules/modules/module-local-ai-runtime.instructions.md, src/capabilities/ai/**/*.{ts,tsx,js,jsx,mjs,json,jsonc}, src/lib/local-ai/**/*.{ts,tsx,js,jsx,mjs,json,jsonc}, scripts/audit/domains/ai-capability/**/*.{ts,tsx,js,jsx,mjs,json,jsonc}, docs/法案辅助文件/*AI*, docs/法案辅助文件/*Prompt*"
---

# GrassEye AI Capability

## Module Identity

Scope: governs the independent AI Ability Group as one governed reasoning owner.

Boundary: AI reads governed inputs, performs one structured judgment, and returns a structured plan. AI does not own transport, browser action, evidence persistence, or mission advancement.

Authority: this file is the single authoritative AI Capability baseline. Older blueprints, registries, adapters, inspectors, or generated artifacts that preserve a provider universe or a second runtime are invalid once they conflict with this file.

Core doctrine:
- AI is the brain, not the emperor.
- AI is one governed reasoning ability group, not a provider system.
- AI reads user requirement, current evidence, platform profile, and MuscleMemoryCatalog.
- AI returns structured judgment and ability-call planning only.
- Orchestration controls flow.
- Nerve Bus transports requests.
- Forensics persists records.
- Browser and action abilities execute primitives.

---

## Global Thin-Machine Baseline

### Public AI Surface

Allowed public exports from src/capabilities/ai/index.ts:
- AI ability-group factory / instance.
- governed input/result schemas and types.
- governed prompt contract facade.
- buildVisualMissionJudgePrompt.
- resolveAiDispatchTimeoutMs.

Forbidden public exports:
- provider roster.
- provider registry.
- runtime-adapters.
- local-ai gateway.
- raw prompt registry helpers.
- role controls.
- output summary store or alias helpers.
- child implementation paths.
- AI-private shared helpers.

### Active Child Capability

AI child capabilities are governed reasoning actions, not provider channels.

Current active child capability:
- visual-mission-judge-once

Current active public task type:
- visual_mission_judgment

Provider names such as local, paid, future, external, OCR, or schema-validator are implementation detail only. They are not AI child capability truth.

### Required AI Runtime Pipeline

Every AI execution must follow this chain:

```txt
input schema gate
-> prompt contract resolution
-> model call
-> JSON extraction
-> output schema gate
-> result proof
```

Other concerns such as timeout, abort, model unavailability, or local runtime health may exist only as simple model-call parameters or failure reasons. They must not become a gate universe.

### Required AI Input

Governed AI input must include:

```txt
missionId
runId
sessionId
capabilityCallId
nerveBusEnvelopeId
requestedBy = orchestration
transportedBy = nerve-bus
userRequirementRef or userRequirementText
platformId
platformProfileRef?
originalScreenshotRef
coordinateGridScreenshotRef
gridSpecRef
visualMissionInputRef?
systemManualRef
muscleMemoryCatalogVersion
outputSchemaRef
roundId?
videoVisitId?
continuityBundleRef?
```

Forbidden AI input:
- raw browser commands.
- raw DOM or selector payloads.
- raw x/y or client coordinates.
- direct ability invocation payloads.
- Nerve Bus envelope construction.
- Forensics write payloads.
- caller-chosen provider flags.
- paid/future provider flags.
- map/runtime/binding package planning fields as AI truth.

### Required AI Output

AI result status must be one of:

```txt
success
failed
review_required
```

AI output payload must be structured JSON and must include:

```txt
taskType = visual_mission_judgment
decision
reason
confidence?
riskFlags[]
actions[]
nonExecutableSummary?
```

Allowed action fields:

```txt
abilityId or actionCode
required
reason
input
```

Allowed input fields are only MuscleMemoryCatalog-governed fields such as:

```txt
gridCell
key
text
regionGridCell
```

Forbidden output fields:
- x
- y
- clientX
- clientY
- browserCommand
- domSelector
- raw URL opening command
- nerveBusEnvelope
- forensicsPayload
- abilityGroupId override
- childCapabilityId override

### Prompt Contract Baseline

Current single prompt contract:
- visual-mission-judge-v1

The prompt contract must contain only:
- User Requirement
- Current Visual Evidence
- Platform Profile
- Capability Manual
- Output Schema
- optional continuity bundle for task-specific recovery only

Prompt contract forbidden content:
- full universal round history by default
- mandatory previous-round replay
- route/package/workflow instructions
- provider policy text
- cost policy text
- fallback text
- human approval continuation logic

Feed mining doctrine:
- feed mining and seeding rounds are independent by default.
- AI judges from the current screenshot, current coordinate grid, stable user goal, and current capability manual.
- continuityBundleRef is optional and must not be forced into every visual task.

### Model Call Baseline

Current phase allows one active model path only:
- local model call

Required direction:
- local model path resolves from governed local config.
- model unavailability returns failed or review_required.
- timeoutMs and AbortSignal are allowed.
- raw output may be retained only as a hash or a ref in runtime proof.

Forbidden model-call universe:
- provider roster.
- provider registry.
- paid provider system.
- future provider system.
- cloud fallback.
- role controls as AI public truth.

### Result Proof Baseline

AI runtime proof must include:

```txt
proofId
missionId
runId
sessionId
roundId?
videoVisitId?
capabilityCallId
nerveBusEnvelopeId
childCapabilityId = visual-mission-judge-once
promptContractId
promptContractVersion
systemManualRef
muscleMemoryCatalogVersion
inputRefs
outputSchemaRef
rawOutputHash
status
failureReason?
reviewRequiredReason?
startedAt
endedAt
durationMs
```

Forbidden proof claims:
- browser execution proof.
- Nerve Bus dispatch proof.
- Forensics write proof.
- business success truth.
- candidate disposition truth.

### Required Boundaries

AI must not:
- click.
- scroll.
- type.
- open pages.
- import browser controller.
- import mouse-click, mouse-scroll, text-input, open, or screenshot runtime implementations.
- dispatch Nerve Bus.
- advance Orchestration steps.
- write Forensics records.
- mutate runtime mission state.

AI may:
- read governed payload refs.
- build one prompt.
- call one local model path.
- extract JSON.
- validate output schema.
- return structured plan plus runtime proof.

---

## Laws

## Law GRASSEYE-AI-CAPABILITY-001-V2

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: AI is a governed single-step reasoning owner and must not preserve provider-channel architecture.

### 法条

The AI Ability Group must remain thin.

Required direction:
- src/capabilities/ai stays the only AI public root.
- AI child truth is visual-mission-judge-once.
- AI public task truth is visual_mission_judgment.
- provider/runtime names stay implementation detail only.

FORBIDDEN:
- provider-channel child capability ids.
- paid/future child placeholders in production truth.
- registry-disabled-children, provider policy gates, or roster universes.

## Law GRASSEYE-AI-CAPABILITY-002-V2

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: AI execution must follow the six-step thin runtime pipeline and no larger gate universe.

### 法条

Every AI execution must use the thin runtime pipeline defined above.

FORBIDDEN:
- chain proof field gate as a separate universe.
- provider policy gate universe.
- cost/data/safety payload gate universes.
- runtime health/idempotency/concurrency gate universes.
- quality/output summary stores.

## Law GRASSEYE-AI-CAPABILITY-003-V2

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: the AI prompt contract is single-source, minimal, and task-bound.

### 法条

The current phase allows exactly one governed prompt contract: visual-mission-judge-v1.

Required direction:
- one prompt contract serves one reasoning action.
- prompt text remains reviewable.
- output binds to one output schema.

FORBIDDEN:
- prompt registry universe.
- duplicated prompt truth across AI and local-ai.
- prompt shortcuts imported directly by business code.

## Law GRASSEYE-AI-CAPABILITY-004-V2

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: AI output must stay non-executable and free of raw coordinate or browser authority.

### 法条

AI output is a governed plan token set, never execution authority.

FORBIDDEN:
- raw coordinates.
- raw selectors.
- browser commands.
- forensics payloads.
- Nerve Bus envelopes.

## Law GRASSEYE-AI-CAPABILITY-005-V2

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: AI does not execute actions, does not dispatch transport, and does not persist evidence.

### 法条

Orchestration consumes AI results. Action abilities execute. Forensics persists.

FORBIDDEN:
- AI-owned execution helpers.
- AI-owned transport helpers.
- AI-owned evidence writers.

## Law GRASSEYE-AI-CAPABILITY-006-V2

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: ai-capability audit must stay small, blocking, and owner-local.

### 法条

The AI inspector must answer exactly these blocking questions:
- AI source file count is <= 15.
- only visual-mission-judge-once exists as active child.
- no provider/future/paid child registry exists.
- no runtime-adapters/shared/public-contracts/role-controls system directories exist.
- prompt depends only on user requirement, evidence, platform profile, capability manual, output schema, and optional continuity.
- output schema forbids raw coordinate, DOM, browser command, Nerve Bus, and Forensics payload fields.
- AI imports no browser/action/private runtime executors.
- AI executes no actions, dispatches no Nerve Bus, and writes no evidence.

FORBIDDEN:
- giant owner-inspection harness.
- pipeline inspector universe.
- provider policy inspector universe.
- PASS reports that preserve retired architecture.
