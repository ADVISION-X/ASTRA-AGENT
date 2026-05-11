---
name: "GrassEye Orchestration Capability"
description: "Use when governing the independent Orchestration Ability Group, governed mission command consumption, mission state, round/step execution, AI action-plan scheduling, Nerve Bus dispatch, and mission finalization."
applyTo: ".github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md, src/capabilities/orchestration/**, docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md, scripts/audit/domains/orchestration-capability/**, src/capabilities/commander-console/**, src/capabilities/nerve-bus/**, src/features/platform-action/**, src/lib/local-runtime/**"
---

# GrassEye Orchestration Capability FINAL

Scope: governs the independent Orchestration Ability Group, governed mission command consumption, mission state ownership, round/step sequencing, Nerve Bus dispatch, action-plan decoding handoff, policy-bound observation loops, and mission finalization.

Boundary: this module governs only mission flow. It does not own retired package chains, retired deterministic flows, retired branch tokens, prompt text bodies, browser primitives, screenshot processing, AI runtime internals, Forensics storage internals, or final business judgment.

Authority: this file is authoritative only for the orchestration-capability domain.

Architecture phase: Static Capability Registry Architecture.

Core doctrine:
- Orchestration is the commander of mission flow, not the human console.
- Commander receives human command; Orchestration receives governed mission command.
- Orchestration owns mission state, round state, step sequencing, loop guards, stop/finalize semantics, and governed dispatch order.
- Orchestration consumes AI decisions and registry-backed governed action plans; it does not revive retired deterministic flows, retired branch tokens, retired selection choices, retired binding states, or business-process packages.
- Current transport may serialize registry references as `actions[].actionCode`, but Orchestration must treat those values as registry entries, not workflow/package truth.
- Orchestration dispatches only through Nerve Bus or the owning ability-group public contract.
- Round continuity is explicit and task-scoped; it must not default to a universal heavy packet or a second semantic court.
- Orchestration must never build raw prompts.
- Orchestration must never infer page meaning, product meaning, or target meaning outside AI-owned contracts.
- Orchestration must never silently default platform or mission truth.
- Orchestration must never hide finalization under Forensics.
- No governed mission command, no mission run.
- No Nerve Bus envelope, no governed step dispatch.
- No active Orchestration law without inspector + runner + real-code-inspection.

Current governed mission loop:

```txt
userRequirementText + selectedPlatforms
→ PlatformRegistry + MuscleMemoryCatalog + Visual Mission Prompt Contract
→ screenshot original + coordinate grid
→ AI Visual Mission Judge
→ governed decision + registered atomic capability sequence (current transport may serialize as actions[].actionCode tokens)
→ ActionPlan Decoder / Scheduler
→ owning ability-group public contracts
→ Forensics record
→ next round
```

Review stop semantics:
- `review_required` means the current round cannot continue automatically.
- `STOP_REVIEW_REQUIRED` is a legal governed actionCode when MuscleMemoryCatalog declares a hard-stop handoff to Commander Console.
- Human review belongs only to Commander Console / human restart; Orchestration must not pause inside runtime and auto-resume after implicit review.

---

## Global Orchestration Baseline

All active Orchestration laws in this file are:

```yaml
status: active
tier: P0
capabilityDomain: orchestration-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection
```

Required implementation:

```txt
Orchestration must remain a small mission-flow dispatcher.
It must contain schema, contract, registry, ability-group, minimal runtime helpers, and small child command handlers.
It must NOT require ports/shared/runtime/children directory universe when a smaller structure is enough.
Target file count: <= 25 files. Exceeding 30 files is FAIL.
Recommended: <= 20 files.
```

Required active children (exactly 7):

```txt
start-mission
pause-mission
resume-mission
stop-mission
emergency-stop
dispatch-registered-ability-sequence
finalize-mission
```

Forbidden children:

```txt
execute-runtime-step
evaluate-step-transition
execute-map-step
resolve-runtime-plan
validate-runtime-plan
request-human-review
post-action-verification
```

Child-capability classification:

```txt
Mission control commands (Orchestration/Commander control boundary):
  start-mission, pause-mission, resume-mission, stop-mission, emergency-stop, finalize-mission
  - These are control-flow commands, not business-semantic packages.

Governed ability sequence dispatch:
  dispatch-registered-ability-sequence
  - Validates AI output against MuscleMemoryCatalog.
  - Injects system refs.
  - Calls Geometry Guard for grid-based targets.
  - Delegates execution to owning ability-group public contract.
  - Records result via Forensics.

Internal functions only (NOT child capabilities):
  run-round, evaluate-decision, inject-refs, loop-guard
```

Required enforcement:

```txt
scripts/audit/domains/orchestration-capability/
├── config.ts
├── inspector.ts
└── run-inspector.ts
(max 3 files; exceeding 5 files is FAIL)
```

Forbidden:
- manual-first as active enforcement for this domain.
- verify scripts as release truth.
- detached inspector.
- warning-only P0.
- generated fake PASS.
- empty or missing real-code-inspection.
- legacy browse-flow as runtime owner.
- agent-runtime as mission owner.
- retired package chain, retired deterministic flow, or compatibility bridge as mission owner.

---

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-001-V4

status: active
tier: P0
capabilityDomain: orchestration-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Orchestration is the only owner of governed mission flow, mission state, round/step sequencing, and mission finalization.

### 主题

总调度主权唯一

### 法条

Orchestration Ability Group is the only owner of governed mission flow.

Required:
- Human command enters Commander Console first.
- Commander Console emits governed mission command through Nerve Bus transport.
- Orchestration receives governed mission command only after Commander gate.
- Orchestration owns:
  - mission command consumption
  - mission state
  - round state
  - roundIndex
  - loop guard state
  - review-required stop semantics
  - mission finalization
  - terminal status
- Commander must not mutate Orchestration state directly.
- Startup may bootstrap runtime but must not issue mission control commands directly.

### 禁止

FORBIDDEN:
- PlatformAdapter owning mission flow.
- open/page-state/action ability owning mission flow.
- deleted agent-runtime chains owning mission state.
- workbench/runtime helper directly advancing step.
- Commander directly holding raw OrchestrationAbilityGroup as public contract truth.
- human command bypassing Commander Console.
- startup-entrypoint directly issuing mission control commands.
- Orchestration reviving retired selection field, retired selection version field, retired package field, retired package version field, retired binding field, legacy route-plan field, retired branch-token field, or legacy template field as runtime truth.
- Orchestration recovering missing mission truth through hardcoded defaults.

---

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-002-V4

status: active
tier: P0
capabilityDomain: orchestration-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Mission flow must be driven by governed visual-mission context and AI action plans, not by maps, retired deterministic flows, or retired branch tokens.

### 主题

视觉任务合同驱动执行

### 法条

Production mission flow must be driven by governed mission context plus AI action-plan output.

Required:
- Mission start must carry userRequirementText and selectedPlatforms.
- Mission start may carry governed maxRounds, maxMinutes, allowedActionPolicyRef, and stopPolicyRef.
- Prompt contract truth must come from governed prompt-contract resolution, not from retired packaged steps.
- Orchestration may store promptContractId, promptContractVersion, and outputSchemaRef when the active visual-mission contract resolves them.
- AI output consumed by Orchestration must use governed decision fields and registry-backed action references.
- When current transport uses `actions[].actionCode`, Orchestration must treat that field as a registry reference to an atomic capability entry.
- Unknown or unregistered capability reference must fail closed.
- `review_required` must stop the current automated round.
- `STOP_REVIEW_REQUIRED` must be treated as a legal stop actionCode when declared by MuscleMemoryCatalog and must finalize the round into Forensics plus Commander-visible review reasons.
- Transitional composite or semantic transport aliases may be expanded only by governed decoders/schedulers and must not define final registry truth.
- Mission flow must remain data-driven, auditable, and bounded.

### 禁止

FORBIDDEN:
- retired chain script as production runtime truth.
- retired branch-token field as production branch truth.
- retired declarative flow package as production branch truth.
- retired package chain retired binding state as production branch truth.
- mechanical branching over free text or undeclared fields.
- any compatibility bridge that keeps both retired branch-token field and actionCode alive.
- Orchestration owning business-process packages or semantic shortcut flows as final mission authority.

---

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-003-V4

status: active
tier: P0
capabilityDomain: orchestration-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Orchestration step execution must consume governed evidence bundles, AI decisions, and declared action plans only.

### 主题

一轮一判一解码

### 法条

Orchestration must execute the governed mission loop as one bounded round at a time.

Required:
- AI vision step must consume governed screenshot evidence or visual-mission bundle produced before the AI call.
- Round output evaluation must consume only declared output schema fields.
- Orchestration may branch on governed decision, status, riskFlags, and actions[].required only when declared by the output schema.
- Independent feed-mining rounds may move directly from the current AI decision and declared action refs to governed dispatch; they must not create a second transition-meaning layer.
- Loop guard must enforce maxRounds, maxMinutes, and maxStepCount.
- Emergency-stop must short-circuit loop and latch state.
- Evidence output must route to Forensics Persistence through governed request.

### 禁止

FORBIDDEN:
- branch decision reading undeclared payload fields.
- branch decision over raw natural-language reasoning.
- retired branch-token field-driven branch restoration.
- hidden next-step logic outside declared round output evaluation.
- while true mission loop without loop guard.
- loop continues after emergency stop.
- runtime silently continuing after `review_required`.
- static browse-flow hardcoded decision tree.

---

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-004-V4

status: active
tier: P0
capabilityDomain: orchestration-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Real external actions must be dispatched through governed action plans and owning ability-group contracts.

### 主题

动作码调度唯一

### 法条

Orchestration must dispatch real external actions only through governed action-plan decoding.

Required:
- actions[].actionCode must resolve through MuscleMemoryCatalog or the owning ability-group catalog.
- AI-provided grid cell ids must be decoded only through gridSpecRef or an equivalent governed decoder contract.
- mouse-click must require governed executable geometry before primitive execution.
- mouse-scroll must require governed executable geometry before primitive execution.
- text-input must require approved text and verified input target before primitive execution.
- Open, Screenshot, Visual Target, Geometry Guard, Mouse Click, Mouse Scroll, Text Input, and Forensics must be called only through their public contracts.
- Post-action observation packaging may run when the action policy requires it, but it must remain optional, task-scoped, and subordinate to the next AI round as semantic truth.
- `STOP_REVIEW_REQUIRED` is a valid actionCode stop path, not a forbidden action command.

### 禁止

FORBIDDEN:
- direct primitive dispatch from Orchestration.
- action scheduling through retired deterministic flows, retired branch tokens, or retired selection choices.
- treating PAV as a universal mandatory gate for every real external action.
- turning PAV into a global second semantic judgment chain for otherwise independent rounds.
- PAV package status replacing the next AI semantic judgment.
- free-text action instructions bypassing actionCode decoding.
- implicitly auto-resuming the mission after a review stop without a new Commander command.

---

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-005-V4

status: active
tier: P0
capabilityDomain: orchestration-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Prompt dispatch must use governed prompt contracts resolved from active visual-mission context, never from maps or raw strings.

### 主题

Prompt 合同从视觉任务上下文解析

### 法条

Prompt selection must come only from governed visual-mission context plus the AI prompt-contract registry.

Required:
- AI dispatch must carry promptContractId.
- AI dispatch must carry outputSchemaRef when the prompt contract requires a strict output schema.
- Orchestration may pass promptContractId and outputSchemaRef to Nerve Bus.
- Orchestration may not build prompt text.
- Orchestration may not concatenate prompt strings.
- Orchestration may not choose prompts by hardcoded model or task fallback.

### 禁止

FORBIDDEN:
- raw prompt string building inside Orchestration.
- promptContractId sourced from retired packaged steps.
- promptContractVersion sourced from retired binding states.
- prompt selection from latest map or route-plan lookup.
- hardcoded prompt selection.

---

## Law GRASSEYE-ROUND-MISSION-PACKET-V1

status: active
tier: P0
capabilityDomain: orchestration-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Orchestration must inject explicit task-needed continuity and may use Round Mission Packet when the next AI round truly depends on prior-step context.

### 主题

Round Mission Packet 连续性主权

### 法条

Before a Visual Mission AI request that depends on prior-step context, Orchestration must inject explicit governed continuity for the next round.

Required:
- Orchestration must inject explicit continuity before dispatch when the next AI round depends on prior-step state, carried constraints, or recovery context.
- Independent feed-mining rounds may proceed from current evidence plus stable mission constraints without a universal full continuity packet.
- When Orchestration uses Round Mission Packet, it must record a governed `roundMissionPacketRef` before dispatch.
- AI dispatch input may include `roundMissionPacketJson` or an equivalent governed continuity payload plus the relevant continuity ref.
- Any continuity payload must preserve no-human-in-loop, no-raw-coordinates, and coordinate-grid-required truth.

Forbidden:
- reconstructing round continuity from raw prompt text without governed continuity refs.
- omitting required governed continuity when the next round truly depends on prior-step state.
- treating full Round Mission Packet injection as a universal mandatory default when the current round is independent.
- letting AI infer continuity from previous rounds when the packet was not injected.

---

## Law GRASSEYE-HUMAN-REVIEW-FAIL-CLOSED-V1

status: active
tier: P0
capabilityDomain: orchestration-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: review_required and STOP_REVIEW_REQUIRED must fail closed, stop the automated round, and hand control back to Commander without hidden runtime continuation.

### 主题

人工复核必须 fail-closed

### 法条

Human review is a stop boundary, not an in-loop runtime continuation primitive.

Required:
- `review_required` stops the current automated round.
- `STOP_REVIEW_REQUIRED` is treated as a legal governed stop actionCode when declared by MuscleMemoryCatalog.
- review reasons remain visible to Commander-facing read models and Forensics.
- runtime must preserve `reviewRequiredReason` instead of collapsing review into silent failure or success.

Forbidden:
- any active `request-human-review` child in the Orchestration command surface.
- implicitly resuming the mission after review without a new governed Commander command.
- downgrading `review_required` into a hidden retry, fallback success, or silent continue path.

---

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-006-V4

status: active
tier: P0
capabilityDomain: orchestration-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Mission proof must preserve governed chain fields without reviving retired map truth.

### 主题

运行证明保持短链且可追踪

### 法条

Orchestration proof must preserve governed mission chain fields only.

Required proof fields:
- missionId
- runId
- sessionId when applicable
- roundId when applicable
- stepId
- capabilityCallId
- nerveBusEnvelopeId
- promptContractId when applicable
- outputSchemaRef when applicable
- userRequirementText summary
- selectedPlatforms
- actionPlanRef or actionCodes when applicable
- evidence refs
- status
- failureReason or reviewRequiredReason when applicable

### 禁止

FORBIDDEN:
- retired binding field in mission proof.
- retired selection field or retired selection version field in mission proof.
- retired package field or retired package version field in mission proof.
- legacy route-plan field or retired branch-token field in mission proof.
- terminal success without action or failure evidence refs.

---

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-007-V1

status: active
tier: P0
capabilityDomain: orchestration-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Orchestration validates, injects, dispatches, and records registry-backed capability sequences without composing business packages.

### 主题

系统只做校验调度留证

### 法条

Orchestration executes AI-proposed registered capability sequences. It validates registry membership and input schema, injects system-owned refs, resolves executable geometry through Geometry Guard when grid cells are involved, dispatches owning capability groups, records evidence, and stops or escalates on failure.

Required direction:
- Orchestration may decode, validate, inject refs, dispatch, record result, and stop/review on failure.
- Orchestration must not decide whether a video is product-worthy, seeding-worthy, comment-worthy, or otherwise business-valuable.
- Orchestration must not own business-process packages or semantic shortcut flows.

### 禁止

FORBIDDEN:
- business-package composition inside Orchestration.
- semantic action catalogs becoming Orchestration-owned runtime truth.
- using raw coordinates or bypassing Geometry Guard for grid-based visual actions.

---

## Final Readiness Gate

The Orchestration law is ready only when all of the following are true:

1. No active rule revives retired deterministic flows, retired branch tokens, retired selection choices, retired package chains, retired templates, or retired binding states as runtime truth.
2. Mission start truth is userRequirementText plus selectedPlatforms, not map identity.
3. AI dispatch truth is promptContractId/outputSchemaRef from governed visual-mission context, not from maps.
4. Action scheduling truth is registry-backed capability decoding; current `actions[].actionCode` transport must resolve to registry entries, not business-flow packages.
5. Real external actions are not universally gated by mandatory PAV, and PAV does not become a second semantic judgment chain.
6. Proof and state keep mission/run/round/step/action refs without retired map fields.
7. Round continuity is explicit and task-dependent; there is no universal full Round Mission Packet default.
