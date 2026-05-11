---
name: "GrassEye AI Capability"
description: "Use when governing the AI Ability Group, Prompt Contract Registry, AI runtime pipeline, provider routing, local-ai adapter boundary, schema/quality/output gates, disabled provider policy, AI proof chain, and AI execution-authority boundary."
applyTo: ".github/instructions/cursor-rules/modules/module-ai-capability.instructions.md, .github/instructions/cursor-rules/modules/module-local-ai-runtime.instructions.md, src/capabilities/ai/**/*.{ts,tsx,js,jsx,mjs,json,jsonc}, src/lib/local-ai/**/*.{ts,tsx,js,jsx,mjs,json,jsonc}, scripts/audit/domains/ai-capability/**/*.{ts,tsx,js,jsx,mjs,json,jsonc}, docs/法案辅助文件/*AI*, docs/法案辅助文件/*Prompt*"
---

# GrassEye AI Capability

## Module Identity

Scope: governs the independent AI Ability Group, AI child provider registry, Prompt Contract Registry, AI runtime pipeline, AI-local-runtime adapter boundary, AI result/proof contract, and AI-only reasoning boundary.

Boundary: this module governs AI ownership only. It does not own legacy navigation selection, Orchestration branch control, Nerve Bus transport, browser actions, physical actions, or Forensics persistence.

Authority: this file is the single authoritative AI Capability Phase 3.5 baseline. Any older blueprint, generated artifact, inspector, implementation path, or working-tree rule that conflicts with this file is invalid until updated to match this file.

Current architecture: Static Capability Registry Architecture.

Future architecture: Pluggable Capability Registry Architecture. Future plugin capability architecture must not be implemented by this module unless a later explicit phase gate authorizes it.

Core doctrine:
- AI is the brain, not the emperor.
- MuscleMemoryCatalog is the governed capability registry that AI reads as its ability manual.
- AI composes registered atomic capabilities; it does not depend on business-flow packages or semantic-shortcut catalogs.
- AI reasons; it does not act.
- AI is the only owner of visual, page, blocker, readiness, target-identity, comment-understanding, product/business, and governed action-plan interpretation.
- Prompt Contract Registry is the single prompt truth.
- Startup must not create a separate mandatory AI court; when startup truly needs semantic page judgment, it may reuse the same governed AI prompt-contract discipline as ordinary mission judgment.
- Prompt Contracts drive AI reasoning inputs and governed output schemas; retired package chains and retired deterministic flows do not own prompt truth.
- Orchestration controls flow; AI does not advance steps.
- Nerve Bus transports requests; AI does not dispatch Nerve Bus envelopes.
- Forensics stores evidence; AI does not persist evidence.
- Runtime adapters execute model calls; adapters do not own final AI result truth.
- Disabled, paid, and future providers fail closed.
- Every AI P0 law must be enforced by the ai-capability inspector under CI-FULL, generated artifacts, and real-code-inspection.

---

## Global AI Capability Phase 3.5 Baseline

### Public AI Surface

Allowed public exports from `src/capabilities/ai/index.ts`:
- AI ability-group factory / instance.
- AI public input/result schemas and types.
- AI task type schemas and public policy types.
- governed Prompt Contract facade.
- governed model roster facade.
- governed public validators required by callers.

Forbidden public exports:
- child implementations.
- runtime adapters.
- local-ai gateway.
- raw prompt registry helpers.
- LocalAiTaskRequest / LocalAiTaskResult / LocalAiTaskType.
- legacy LocalAi result translators.
- runtime-task-execution.
- capability-check or verify acceptance helpers.
- prompt-contract shortcut files that bypass the registry.
- AI-private shared helpers.

### Required AI Runtime Pipeline

Every AI execution must follow this chain:

```txt
input schema gate
→ chain proof field gate
→ prompt contract registry gate
→ prompt contract integrity/hash gate
→ task/provider routing gate
→ provider policy gate
→ data policy gate
→ safety policy gate
→ cost policy gate
→ payload budget gate
→ timeout/cancellation gate
→ runtime health gate
→ idempotency/concurrency gate
→ runtime adapter call
→ raw output capture
→ JSON extraction gate
→ output schema gate
→ quality gate
→ output boundary gate
→ proof builder
→ result builder
```

No child implementation may bypass this pipeline.

Startup doctrine:
- Startup must not create a separate mandatory page-preparation judgment chain.
- When startup truly needs semantic page meaning, it may call governed AI using one governed evidence bundle and the same prompt-contract discipline used by ordinary mission rounds.
- Pure shell/bootstrap/readiness mechanics stay in startup, open, or page-state owners and must not be inflated into AI business-package truth.
- Non-AI code must not substitute login, safety, captcha, or feed-ready heuristics when a governed semantic startup judgment is actually required.

AI-only interpretation boundary:
- AI-only judgments include current page correctness, login/captcha/safety/abnormal blockers, feed/video/comment-surface meaning, page readiness, semantic stability, product-seeding judgment, visible UI target identity, comment content/intent, and the governed next-action decision after visual/page/business interpretation.
- Non-AI capability groups may only open targets, capture screenshots, package raw observations, transport envelopes, validate schemas, validate coordinates, execute click/scroll/type/open primitives, verify mechanical post-action effects, and persist evidence refs/proofs.
- Forbidden outside AI: `feedReady`, `pageReady`, `pageCorrect`, `safetyWallPresent/Absent`, `captchaPresent/Absent`, `loginSurfacePresent`, `pageStateType = platform_feed`, semantic `decision = allow`, heuristic visual target candidate generation, and confidence scores for page/video/target meaning.
- AI may return structured `decision`, `reason`, `confidence`, `riskFlags`, and `actions[].actionCode` plus governed action inputs such as grid-cell ids when allowed by the output schema. AI still must not click, scroll, type, open, dispatch Nerve Bus, write Forensics, or advance the mission.

AI action-plan token boundary:
- AI action-plan tokens are registry references, not execution authority.
- The current serialized field `actions[].actionCode` is a transport token that must reference a registry-exposed atomic capability id or a law-declared stop/review handoff; it is not a workflow/package truth source.
- Business-flow, package, workflow, and semantic-shortcut names are not valid final AI-manual truth.
- AI may output governed action-plan tokens declared by the active Visual Mission output schema:
  - `actions[].actionCode` as the serialized id of a registered atomic capability
  - `actions[].required`
  - `actions[].reason`
  - `actions[].input.gridCell` only when the selected actionCode requires a grid cell
  - `actions[].input.key` only when the selected actionCode is a governed key action declared in MuscleMemoryCatalog
- These fields are planning tokens only.
- They must be decoded by Orchestration / ActionPlan Decoder / Scheduler before any capability is called.
- AI must not output raw browser commands, raw DOM/BOM operations, raw x/y coordinates, free-form click/scroll/type/open instructions, arbitrary URLs to open, Nerve Bus envelopes, Forensics write requests, direct capability invocation payloads, or final execution authority.

### Required AI Result Status

AI public result status must be one of:

```txt
success
failed
review_required
```

Review semantics:
- `review_required` is a governed AI or capability result status.
- `review_required` means the current round cannot continue automatically.
- `review_required` is not an automatic continue path.
- AI may propose `STOP_REVIEW_REQUIRED` as a governed actionCode when the active output schema and MuscleMemoryCatalog allow a hard stop for human intervention.

Forbidden result shapes:
- boolean result.
- null success.
- undefined success.
- raw provider result.
- raw LocalAiTaskResult.
- string output as success when schema expects object.
- runtimeProof: null.
- success without schema valid.
- success without quality pass.
- success with output boundary blocked.
- failure without reason.
- review_required without reason.

### Required Chain Fields

AI input or AI owner evidence must include:

```txt
missionId
runId
sessionId
roundId
videoVisitId
platformId
stepId
capabilityCallId
nerveBusEnvelopeId
userRequirementRef
platformProfileRef
visualMissionInputRef
originalScreenshotRef
coordinateGridScreenshotRef
gridSpecRef
promptContractId
promptContractVersion
promptCatalogVersion
systemManualRef
muscleMemoryCatalogVersion
outputSchemaRef
inputRefs
expectedOutputSchema
requestedBy = orchestration or scheduler
transportedBy = nerve-bus
```

If a field is not available at an early stage, the result must be `failed` or `review_required`; it must not be `success`.

### Provider State Baseline

Allowed active local providers:
- local-vision-ai
- local-text-ai
- local-ocr-ai
- internal-schema-validator

Policy-disabled providers:
- paid-vision-ai
- future-api-ai

Policy-guarded external provider:
- paid-analysis-ai

Disabled providers must remain visible in registry and audit surfaces, but must fail closed by default.
Policy-guarded external provider must remain visible in registry and audit surfaces, fail closed by default, and may execute only when paid-provider allowlist, operator approval, provider config, secret, and external-transmission policy are all explicit.

### Forbidden AI Authority

AI must not:
- click.
- scroll.
- type.
- open pages.
- call browser primitives.
- dispatch Nerve Bus envelopes.
- advance Orchestration steps.
- evaluate branch decisions as final control.
- bypass review.
- write Forensics records.
- create final browse outcomes.
- set candidate dispositions.
- mutate RuntimeDeliveryState.
- import platform adapters or action ability implementations.

---

## Law GRASSEYE-AI-CAPABILITY-001-V1

status: active  
tier: P0  
capabilityDomain: ai-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: AI is an independent first-class ability group and must remain the only public AI owner.

alias: APEX-AI-001-V1

### 主题

AI 大脑主权

### 法条

AI is an independent GrassEye Ability Group. It is the system brain, not a runtime helper.

Required direction:
- The AI Ability Group public root is `src/capabilities/ai`.
- Orchestration, Nerve Bus, Commander, and runtime composition roots may call only the AI Ability Group public contract.
- All AI child capabilities belong under one internal registry owned by the AI Ability Group.
- AI public contract must be defined in AI-native terms:
  - `AiAbilityInput`
  - `AiAbilityResult`
  - `AiTaskType`
  - `AiProviderPolicy`
  - `AiCostPolicy`
  - `AiDataPolicy`
  - `AiQualityPolicy`
  - `AiRuntimeProof`
- AI requests must preserve governed requester truth from Orchestration or Scheduler and `transportedBy = nerve-bus`.
- `src/lib/local-ai` may remain an internal local runtime boundary, but must not reclaim AI public ownership.
- LocalAi task contracts may exist only inside `src/capabilities/ai/runtime-adapters/**` or governed `src/lib/local-ai/**` internals.

### 机器可读不变量

```yaml
governanceInvariant:
  id: AI-PUBLIC-OWNER
  owner: ai-capability
  publicRoot: src/capabilities/ai
  internalRuntimeRoot: src/lib/local-ai
  allowedPublicCallers:
    - orchestration-capability
    - nerve-bus-capability
    - commander-console-capability
    - local-runtime-composition-root
  forbiddenPublicContracts:
    - LocalAiTaskRequest
    - LocalAiTaskResult
    - LocalAiTaskType
    - LocalAiGateway
    - rawPromptRegistry
    - runtimeAdapter
  failureMode: P0_BLOCKING
```

### 禁止

FORBIDDEN:
- Treating AI as a helper hidden inside `src/lib/local-ai`.
- Public runtime callers importing `LocalAiGateway` directly.
- Public runtime callers importing prompt registry internals directly.
- Public runtime callers importing runtime adapters directly.
- Mixing AI ownership into browser infrastructure, product-signal business code, platform adapters, action ability groups, or Forensics.
- Exporting LocalAi contracts as public AI sovereignty surface.
- Exporting prompt-contract shortcuts, legacy AI result adapters, or any AI-private helper as public AI contract.

---

## Law GRASSEYE-AI-CAPABILITY-002-V1

status: active  
tier: P0  
capabilityDomain: ai-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: AI child capabilities represent provider/runtime channels; business task routing is AI-owned and must not replace child ids.

alias: APEX-AI-002-V1

### 主题

AI 子能力按提供者与运行通道治理

### 法条

AI child capabilities represent provider and runtime channels. Business tasks route through the AI Ability Group task router and must not replace child capability ids.

Required direction:
- Active local child registry includes:
  - `local-vision-ai`
  - `local-text-ai`
  - `local-ocr-ai`
  - `internal-schema-validator`
- Policy-guarded child registry includes:
  - `paid-analysis-ai`
- Disabled/future child registry includes:
  - `paid-vision-ai`
  - `future-api-ai`
- Public task type set:
  - `visual_mission_judgment`
  - `visual_mission_action_plan`
  - `schema_validation_only`
- AI owns the routing matrix from taskType to childCapabilityId.
- Child readiness is inspectable only through governed readiness contract.
- Public AI callers may read Prompt Contracts only through the AI facade.

### 机器可读不变量

```yaml
governanceInvariant:
  id: AI-CHILD-REGISTRY
  owner: ai-capability
  activeChildren:
    - local-vision-ai
    - local-text-ai
    - local-ocr-ai
    - internal-schema-validator
  policyGuardedChildren:
    - paid-analysis-ai
  disabledChildren:
    - paid-vision-ai
    - future-api-ai
  taskRoutingOwner: ai-capability
  forbiddenChildIdSources:
    - promptContractId
    - businessTaskName
  failureMode: P0_BLOCKING
```

### 禁止

FORBIDDEN:
- Using prompt ids or business tasks as child capability ids.
- Allowing feature domains to decide provider selection ad hoc.
- Hiding paid or future API children outside the AI registry.
- External modules importing `src/capabilities/ai/children/**` directly.
- `capability-check.ts` or `verify*` functions acting as child readiness or enforcement truth.
- External modules importing `src/capabilities/ai/shared/**` or other AI-private files directly.

---

## Law GRASSEYE-AI-NO-MEMORY-V1

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Visual Mission AI must stay stateless across rounds and consume only explicit task-needed continuity plus current evidence.

### 主题

AI 无记忆，系统有记忆

### 法条

Visual Mission AI must not rely on prior chat memory, prior AI memory, or implicit human continuation between rounds.

Required:
- Visual Mission prompt must explicitly state that the model is stateless across rounds.
- Visual Mission prompt must explicitly instruct the model not to assume memory from previous AI calls.
- System continuity must arrive only through explicit governed refs such as current screenshot refs, grid refs, platform context refs, prior-step refs, Round Mission Packet refs, or an equivalent task-scoped continuity bundle.
- Independent feed-mining rounds should be judged from current evidence plus stable mission constraints and must not require a universal full continuity packet.
- Multi-step tasks such as login recovery, open verification, or guarded recovery may carry minimal previous-step context when the current round truly depends on it.
- Prompt sections for Visual Mission action planning must include Current Visual Evidence, Platform Registry, System Manual, Output Format, and only the explicit continuity bundle actually required by the task.

Forbidden:
- relying on prior chat memory as mission continuity truth.
- inventing continuity from previous AI calls when the current round input does not carry it.
- replacing explicit governed continuity with free-form prompt prose only.
- treating full Round Mission Packet injection as a universal mandatory default for every AI round regardless of task shape.
- asking the human to replay ordinary round history because the system failed to inject governed continuity.

---

## Law GRASSEYE-AI-CAPABILITY-003-V1

status: active  
tier: P0  
capabilityDomain: ai-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: AI may reason and return structured results only; it may not execute actions or side effects.

alias: APEX-AI-003-V1

### 主题

AI 只思考不动手

### 法条

The AI Ability Group may reason, classify, extract, summarize, and return governed structured results. It may not execute platform actions, browser actions, map actions, or persistence side effects.

Required direction:
- AI returns governed structured results with:
  - taskType
  - childCapabilityId
  - modelProvider
  - modelName
  - output
  - decision
  - reason
  - actions[].actionCode when the prompt contract expects action planning
  - schemaValidationStatus
  - confidence / uncertainty
  - inputRefs
  - outputRefs
  - evidenceRefs
  - rawOutputRef or rawOutputHash
  - runtimeProof
- Action decisions remain with Orchestration.
- Command transport remains with Nerve Bus.
- Physical execution remains with the relevant action ability groups.
- Forensics Persistence writes AI records, not AI itself.
- AI may produce review recommendations, but cannot skip review gates.

### 机器可读不变量

```yaml
governanceInvariant:
  id: AI-NO-ACTION-AUTHORITY
  owner: ai-capability
  allowedCapabilities:
    - reason
    - classify
    - extract
    - summarize
    - schema-validate
    - propose
  forbiddenActions:
    - click
    - scroll
    - type
    - openPage
    - browserAction
    - dispatchNerveBus
    - writeForensics
    - setCandidateDisposition
  failureMode: P0_BLOCKING
```

### 禁止

FORBIDDEN:
- AI directly clicking, scrolling, opening pages, typing, or dispatching Nerve Bus envelopes.
- AI directly writing final evidence packets, final browse outcomes, candidate dispositions, AI result records, browse ledgers, or failed records.
- AI importing Forensics writers, platform adapters, BrowserController, action ability children, or Orchestration runtime internals.
- AI mutating RuntimeDeliveryState.
- AI using `agent-runtime` as requestedBy.
- Free-text AI output driving platform actions without governed structured interpretation.

---

## Law GRASSEYE-AI-CAPABILITY-004-V1

status: active  
tier: P0  
capabilityDomain: ai-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: local-ai-runtime is an internal execution boundary under AI ownership and must not become a second public AI system.

alias: APEX-AI-004-V1

### 主题

local-ai-runtime 是内部执行边界，不是第二套 AI 主权

### 法条

`src/lib/local-ai` may remain the internal local runtime boundary, while `src/capabilities/ai` remains the public AI owner.

Required direction:
- Prompt registry, local model config loading, runtime execution helpers, and local model adapters may stay under `src/lib/local-ai` only as governed internals.
- The only AI-owned bridge to local-ai internals is under `src/capabilities/ai/runtime-adapters/**`.
- AI root files outside runtime adapters must not import `src/lib/local-ai/**` directly.
- Legacy LocalAi task-name mapping may happen only inside the internal bridge.
- LocalAiGateway may execute model calls but must not construct final AI ability results.
- LocalAi result mapping must not become second prompt truth, second schema truth, or second output authority.

### 机器可读不变量

```yaml
governanceInvariant:
  id: AI-LOCAL-RUNTIME-BOUNDARY
  owner: ai-capability
  allowedBridgeRoot: src/capabilities/ai/runtime-adapters
  internalRuntimeRoot: src/lib/local-ai
  allowedBridgeImports:
    - src/lib/local-ai
  forbiddenAIPrimaryImports:
    - src/lib/local-ai
    - types/local-ai
  bridgeMay:
    - translate request
    - call runtime
    - map provider failure
    - return raw runtime output
  bridgeMustNot:
    - build final AiAbilityResult
    - choose promptContractId
    - hardcode promptVersion
    - bypass schema gate
  failureMode: P0_BLOCKING
```

### 禁止

FORBIDDEN:
- External callers importing `LocalAiGateway` directly once the AI Ability Group exists.
- External callers importing prompt-registry or runtime-adapters directly when an AI facade export exists.
- Treating `src/lib/local-ai` as the canonical AI root.
- `ability-group.ts` directly constructing LocalAiGateway.
- AI root files outside `runtime-adapters/**` importing local-ai internals.
- Runtime adapters hardcoding prompt truth, output schema truth, or final result truth.

---

## Law GRASSEYE-AI-CAPABILITY-005-V1

status: active  
tier: P0  
capabilityDomain: ai-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: paid and future API AI children are visible but disabled by policy and must fail closed.

alias: APEX-AI-005-V1

### 主题

付费与未来 API 子能力默认关闭且失败封闭

### 法条

Paid and future API AI providers may exist only as named child capabilities under the AI Ability Group and must default to fail-closed policy state.

Required direction:
- `paid-vision-ai`, `paid-analysis-ai`, and `future-api-ai` may exist only as explicit children under `src/capabilities/ai/children`.
- `paid-vision-ai` and `future-api-ai` default policy is `disabled_by_policy`.
- `paid-analysis-ai` may be `policy_guarded` only for explicitly operator-approved external analysis tasks that are separately governed and cannot be satisfied by the local AI path.
- Paid providers require:
  - `allowPaidProvider = true`
  - explicit provider allowlist
  - `dataPolicy.allowExternalTransmission = true`
  - `costPolicy.maxEstimatedCost`
  - `operatorApprovalRef`
  - dedicated review path
- `paid-analysis-ai` additionally requires `providerConfigRef` and `secretRef` before runtime execution may proceed.
- No automatic fallback from local AI to paid or future API children is allowed.
- No automatic fallback from paid/future providers to local success is allowed.
- Policy-disabled and policy-guarded children must be visible in registry and audit surfaces.
- Disabled provider execution must return `failed` with `failureKind = provider_disabled` and proof.
- Policy-guarded provider execution with missing approval, config, or secret must return `failed` or `review_required` with explicit reason and proof; it must not return `success`.

### 机器可读不变量

```yaml
governanceInvariant:
  id: AI-DISABLED-PROVIDER-FAIL-CLOSED
  owner: ai-capability
  disabledChildren:
    - paid-vision-ai
    - future-api-ai
  policyGuardedChildren:
    - paid-analysis-ai
  requiredFailClosedReasons:
    - provider_disabled
    - operator_approval_missing
    - provider_config_missing
    - provider_secret_missing
  forbiddenFallbacks:
    - paid-to-local-success
    - future-to-local-success
    - disabled-to-review-required-success-path
    - hidden-cloud-fallback
  failureMode: P0_BLOCKING
```

### 禁止

FORBIDDEN:
- Hidden cloud or paid fallback.
- Paid child capabilities without reviewable policy state.
- Treating future API placeholders as runnable production paths.
- Executing a paid child when policy is incomplete or implied.
- Disabled provider returning success.
- Policy-guarded provider returning success while approval, config, or secret is missing.
- Disabled provider returning fake review_required to avoid failure.

---

## Law GRASSEYE-AI-CAPABILITY-005B-V2

status: active  
tier: P0  
capabilityDomain: ai-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: AI outputs must be cleaned before persistence and must not leak AI runtime contracts into Forensics public ownership.

alias: APEX-AI-005B-V2

### 主题

AI 输出进入 Forensics 前必须清洗

### 法条

AI may return governed structured results, but any persistence request must translate those results into a cleaned payload or a Forensics-native envelope input before reaching Forensics.

Required direction:
- AI result may contain AI-native proof, prompt contract metadata, raw output refs, and quality metadata.
- Forensics persistence input must be Forensics-native and must not import AI public contracts as Forensics truth.
- Downstream callers must translate AI result to Forensics-native envelope before persistence.
- AI task names must not become Forensics owner terms.
- AI raw output must be referenced by ref/hash, not blindly persisted as public truth.

### 机器可读不变量

```yaml
governanceInvariant:
  id: AI-FORENSICS-CLEANING
  owner: ai-capability
  downstreamOwner: forensics-persistence
  requiresTranslation: true
  forbiddenForensicsTerms:
    - LocalAiTaskResult
    - promptContract
    - vision.productPresence
    - comments.intent_analysis
  failureMode: P0_BLOCKING
```

### 禁止

FORBIDDEN:
- Forensics importing AI index, prompt contracts, or LocalAiTaskResult as public contract truth.
- AI or downstream callers relying on task names such as `vision.productPresence` or `comments.intent_analysis` as Forensics ownership terms.
- AI directly writing Forensics records.
- Persisting raw AI output without governed ref/hash and cleaning boundary.

---

## Law GRASSEYE-AI-CAPABILITY-006-V1

status: active  
tier: P0  
capabilityDomain: ai-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: AI keeps a single public contract and does not leak child, adapter, prompt, or legacy internals.

alias: APEX-AI-006-V1

### 主题

AI 公开合同与私有实现硬隔离

### 法条

The AI Ability Group must keep one stable public contract and must not leak child implementations, runtime adapters, raw prompt registry, or legacy LocalAi internals.

Required direction:
- `index.ts` may export only governed public AI contract.
- Child implementations stay private under `src/capabilities/ai/children`.
- Runtime adapters stay private under `src/capabilities/ai/runtime-adapters`.
- Raw prompt registry helpers stay private under `src/capabilities/ai/prompt-contracts` and AI runtime internals.
- `runtime-task-execution.ts` is not part of the AI public owner.
- `prompt-contract.ts` must not survive as a public-facing shortcut under the AI root.
- `export *` is forbidden.

### 机器可读不变量

```yaml
governanceInvariant:
  id: AI-PUBLIC-PRIVATE-SEAL
  owner: ai-capability
  publicIndex: src/capabilities/ai/index.ts
  forbiddenPublicExports:
    - children
    - runtime-adapters
    - LocalAiGateway
    - prompt-registry raw helpers
    - runtime-task-execution
    - capability-check
    - verify
    - prompt-contract shortcut
  forbiddenExportShape:
    - export *
  failureMode: P0_BLOCKING
```

### 禁止

FORBIDDEN:
- Barrel-exporting child implementations.
- Public exports of LocalAiGateway, prompt-registry raw helpers, runtime-task-execution, capability-check, or verify functions.
- Public exports of prompt-contract shortcuts, LocalAi result translators, or any AI-private shared helper that reintroduces LocalAi public ownership.
- Keeping runtime-task-execution.ts as part of the active AI root.
- Any `export *` in AI public root.

---

## Law GRASSEYE-AI-CAPABILITY-007-V1

status: active  
tier: P0  
capabilityDomain: ai-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: ai-capability inspector is the only enforcement owner for AI topology, runtime pipeline, prompt truth, and anti-escape checks.

alias: APEX-AI-007-V1

### 主题

AI 执法入口唯一

### 法条

AI topology, owner-cutover, prompt truth, runtime pipeline, provider policy, result proof, and anti-escape enforcement must close through the ai-capability inspector under CI-FULL.

Required direction:
- `scripts/audit/domains/ai-capability/inspector.ts` is the AI enforcement entry.
- `scripts/audit/domains/ai-capability/run-inspector.ts` is an internal CI-FULL owner step, not a public package script.
- `scripts/audit/domains/ai-capability/owner-inspection-harness.ts` must execute real-code inspection under CI-FULL.
- Decisive checks must use AST, symbol resolution, import graph analysis, JSON schema validation, generated artifact validation, or type-aware checks.
- Regex/grep/includes may be used only as pre-filtering, never as final judgment.
- AI enforcement must participate in:
  - law-registry
  - enforcement-matrix
  - audit-plan
  - ci-full-summary
  - CI-FULL

### 机器可读不变量

```yaml
governanceInvariant:
  id: AI-ENFORCEMENT-OWNER
  owner: ai-capability
  inspector: scripts/audit/domains/ai-capability/inspector.ts
  runInspector: scripts/audit/domains/ai-capability/run-inspector.ts
  realCodeInspection: scripts/audit/domains/ai-capability/owner-inspection-harness.ts
  requiredAuditSurfaces:
    - law-registry
    - enforcement-matrix
    - audit-plan
    - ci-full-summary
    - ci-full
  forbiddenEnforcement:
    - regex-final-judgment
    - grep-final-judgment
    - manual-only-proof
    - warning-only-P0
    - detached-inspector
    - generated-fake-PASS
  failureMode: P0_BLOCKING
```

### 禁止

FORBIDDEN:
- capability-check.ts acting as enforcement truth.
- verify* functions acting as enforcement truth.
- regex-only, grep-only, or includes-only AI verdicts.
- AI public-index leakage or AI-private path imports escaping inspector coverage.
- Active AI law without inspector.
- AI inspector not connected to runner.
- P0/P1 AI law without real-code-inspection.
- Warning-only P0 findings.

---

## Law GRASSEYE-AI-CAPABILITY-008-V1

status: active  
tier: P0  
capabilityDomain: ai-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: AI owns the Prompt Contract Registry; prompt execution must resolve by promptContractId/version/catalog, never by hardcoded prompt text.

alias: APEX-AI-008-V1

### 主题

Prompt Contract 主权与唯一真相

### 法条

AI owns the Prompt Contract Registry and the governed contracts used to execute prompts by `promptContractId`.

Required direction:
- Prompt Contract Registry is the only prompt body source.
- Prompt contract configurations may reference only:
  - `promptContractId`
  - `promptContractVersion`
  - `outputSchemaRef`
  - `requiredInputRefs`
- AI runtime must resolve prompt execution by `promptContractId`.
- `promptContractId`, `promptContractVersion`, and `promptCatalogVersion` must enter AI input/proof.
- Prompt contract registry must fail on duplicate ids.
- Prompt contract registry must fail on duplicate task mapping unless explicitly configured.
- Unknown prompt contract must return typed failure, not throw through public boundary.
- Prompt contract hash must be computed and recorded.
- Prompt contract schema must be strict.

### 机器可读不变量

```yaml
governanceInvariant:
  id: AI-PROMPT-CONTRACT-SINGLE-TRUTH
  owner: ai-capability
  promptSource: src/capabilities/ai/prompt-contracts
  requiredKeys:
    - promptContractId
    - promptContractVersion
    - promptCatalogVersion
    - taskType
    - modelRole
    - inputContract
    - outputSchema
    - confidencePolicy
    - reviewPolicy
    - forbiddenOutputs
    - promptHash
  forbiddenPromptLocations:
    - src/capabilities/ai/runtime
    - src/capabilities/ai/runtime-adapters
    - src/capabilities/orchestration
    - src/capabilities/nerve-bus
    - src/map-plugins
  failureMode: P0_BLOCKING
```

### 禁止

FORBIDDEN:
- Hardcoded prompt body outside Prompt Contract files.
- `systemPrompt`, `userPrompt`, `messages`, `template`, or `instruction` fields outside governed Prompt Contract files.
- Runtime fallback by taskType without promptContractId.
- Unknown prompt contract throwing through public execute.
- Map-specific hardcoded prompts.
- Provider adapter-specific prompt bodies.
- Second prompt registry outside AI.

---

## Law GRASSEYE-AI-CAPABILITY-009-V1

status: active  
tier: P0  
capabilityDomain: ai-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Prompt contracts must declare full governed metadata and must be hashable, strict, and audit-proof.

alias: APEX-AI-009-V1

### 主题

Prompt Contract 完整合同

### 法条

AI prompt contracts must declare full governed metadata and must support strict validation, hashing, owner evidence, and real-code-inspection.

Required direction:
- Every Prompt Contract must include:
  - id
  - version
  - taskType
  - modelRole
  - purpose
  - prompt body
  - inputContract
  - requiredInputRefs
  - outputSchemaRef
  - outputSchema
  - confidencePolicy
  - reviewPolicy
  - failurePolicy
  - forbiddenOutputs
  - dataPolicy
  - safetyPolicy
  - debugPolicy
  - promptHash
- Prompt contracts must be strict schema parsed.
- Prompt hash must change if prompt body changes.
- Prompt contract must declare whether low confidence returns failed or review_required.
- Prompt contract must declare whether raw output capture is required.
- Prompt contract must declare prohibited execution authority.

### 机器可读不变量

```yaml
governanceInvariant:
  id: AI-PROMPT-CONTRACT-COMPLETE-METADATA
  owner: ai-capability
  requiredMetadata:
    - id
    - version
    - taskType
    - modelRole
    - inputContract
    - outputSchemaRef
    - confidencePolicy
    - reviewPolicy
    - failurePolicy
    - forbiddenOutputs
    - dataPolicy
    - safetyPolicy
    - debugPolicy
    - promptHash
  strictSchema: true
  hashRequired: true
  failureMode: P0_BLOCKING
```

### 禁止

FORBIDDEN:
- Prompt contract without output schema.
- Prompt contract without review policy.
- Prompt contract without confidence policy.
- Prompt contract without forbidden outputs.
- Prompt contract without hash.
- Prompt hash not matching prompt body.
- Prompt contract allowing action execution.
- Prompt contract permitting privacy bypass or credential/cookie access.

---

## Law GRASSEYE-AI-CAPABILITY-010-V1

status: active  
tier: P0  
capabilityDomain: ai-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Prompt contracts may guide reasoning and governed action-plan tokens only; they must not command execution, bypass security, or make final mission decisions.

alias: APEX-AI-010-V1

### 主题

Prompt 只能提问和产出计划令牌，不能下执行命令

### 法条

AI prompt contracts may guide reasoning and governed action-plan token output only. They must not command physical actions, platform actions, browser actions, privacy bypass, credential access, or final mission decisions.

Required direction:
- Prompt may ask the model to observe, classify, extract, summarize, compare, and produce structured JSON.
- Prompt may instruct the model to return uncertainty and evidence references.
- Prompt may ask the model to produce governed action-plan tokens declared by the active output schema, including `actions[].actionCode`, `actions[].required`, `actions[].reason`, `actions[].input.gridCell`, and `actions[].input.key` when the selected actionCode contract allows them.
- Prompt must not instruct the model to click, scroll, type, open pages, bypass security, read cookies, read credentials, or make final mission decisions.
- Prompt must not ask the model to produce executable commands.
- Prompt output schema must not include execution authority fields.
- Governed action-plan tokens are planning tokens only and do not grant execution authority.

### 机器可读不变量

```yaml
governanceInvariant:
  id: AI-PROMPT-NO-ACTION-INSTRUCTION
  owner: ai-capability
  forbiddenPromptIntent:
    - click
    - scroll
    - type
    - open page
    - bypass security
    - read cookies
    - read credentials
    - execute command
    - dispatch action
    - final mission decision
  allowedPlanningTokens:
    - actions[].actionCode
    - actions[].required
    - actions[].reason
    - actions[].input.gridCell
    - actions[].input.key
  forbiddenExecutionAuthority:
    - actionCommand
    - browserAction
    - platformAction
    - nerveBusEnvelope
    - forensicsWrite
  failureMode: P0_BLOCKING
```

### 禁止

FORBIDDEN:
- Prompt instructing click/scroll/type/open.
- Prompt instructing cookie or credential access.
- Prompt instructing bypass of login/security.
- Prompt instructing model to decide final mission branch.
- Prompt output schema containing action execution fields or direct capability invocation payloads.
- Prompt asking model to generate Nerve Bus envelopes.

---

## Law GRASSEYE-AI-CAPABILITY-011-V1

status: active  
tier: P0  
capabilityDomain: ai-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: AI runtime must resolve prompt execution by promptContractId and execute a governed runtime pipeline with typed failures.

alias: APEX-AI-011-V1

### 主题

Prompt 执行按合同路由，运行链必须 typed failure

### 法条

AI runtime must execute Prompt Contracts by `promptContractId` and must not hardcode map-specific prompts or task-specific prompt bodies.

Required direction:
- Runtime execution must follow the Required AI Runtime Pipeline.
- Unknown prompt contract must produce typed failure.
- Prompt/task mismatch must produce typed failure.
- Provider unavailable must produce typed failure.
- Runtime health unavailable must produce typed failure.
- Bad JSON must produce typed failure or review_required per Prompt Contract policy.
- Schema mismatch must produce typed failure or review_required.
- Low confidence must produce review_required or failed per Prompt Contract policy.
- Output boundary violation must produce failed.
- All failures must include runtimeProof.

### 机器可读不变量

```yaml
governanceInvariant:
  id: AI-RUNTIME-CONTRACT-PIPELINE
  owner: ai-capability
  requiredPipeline:
    - input-schema-gate
    - chain-proof-field-gate
    - prompt-registry-gate
    - prompt-integrity-gate
    - provider-policy-gate
    - data-policy-gate
    - safety-policy-gate
    - cost-policy-gate
    - payload-budget-gate
    - timeout-gate
    - runtime-health-gate
    - runtime-adapter-call
    - raw-output-capture
    - json-extraction-gate
    - schema-gate
    - quality-gate
    - output-boundary-gate
    - proof-builder
    - result-builder
  forbiddenFailureHandling:
    - throw-through-public-boundary
    - catch-and-fake-success
    - fallback-success
    - generic-runtime-execution-failed-without-stage
  failureMode: P0_BLOCKING
```

### 禁止

FORBIDDEN:
- Runtime executing prompt by map-specific hardcoding.
- Runtime executing prompt by taskType fallback without promptContractId.
- Runtime catching unknown prompt and returning success.
- Runtime catching bad JSON and returning success.
- Runtime catching schema mismatch and returning success.
- Runtime bypassing schema/quality/output-boundary gates.
- Runtime returning final result directly from adapter.

---

## Law GRASSEYE-AI-CAPABILITY-012-V1

status: active  
tier: P0  
capabilityDomain: ai-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: AI timeout, cancellation, idempotency, concurrency, and circuit breaker state must be governed and real-code-inspection-backed.

alias: APEX-AI-012-V1

### 主题

AI 超时、取消、并发与熔断必须治理

### 法条

AI runtime must propagate cancellation and govern timeout, idempotency, concurrency, and circuit breaker state.

Required direction:
- `AiRuntimePort.execute` must receive an `AbortSignal` or governed runtime context containing signal.
- Timeout policy must create and abort an AbortController.
- Runtime adapter must receive cancellation signal.
- Timeout must return typed failure with proof.
- Timeout success race is forbidden.
- Idempotency key must include:
  - promptContractId
  - promptContractVersion
  - inputRefs
  - stepId
  - capabilityCallId
  - taskType
- Concurrency state must be context-owned or port-owned.
- Circuit breaker state must be context-owned or port-owned.
- Module-level mutable runtime state is forbidden unless explicitly governed by a dedicated injected singleton with reset/inspection hooks.

### 机器可读不变量

```yaml
governanceInvariant:
  id: AI-TIMEOUT-CANCELLATION-RUNTIME-STATE
  owner: ai-capability
  runtimePortMustAcceptSignal: true
  timeoutFailureKind: timed_out
  requiredProofFields:
    - timeoutDecision
    - retryCount
    - attemptIndex
    - circuitBreakerState
  forbiddenState:
    - module-level activeRuns
    - module-level circuitBreaker
    - timeout Promise.race without AbortSignal propagation
  failureMode: P0_BLOCKING
```

### 禁止

FORBIDDEN:
- Promise.race timeout without abort signal propagation.
- Runtime adapter ignoring signal.
- Timeout result later overwritten by runtime success.
- Module-level mutable `activeRuns`.
- Module-level mutable circuit breaker without governed context/port ownership.
- Duplicate in-flight execution continuing without governed idempotency decision.
- Concurrency-limited path returning fake success.

---

## Law GRASSEYE-AI-CAPABILITY-013-V1

status: active  
tier: P0  
capabilityDomain: ai-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: AI result proof must be complete, chain-linked, raw-output-backed, and impossible to fake as success.

alias: APEX-AI-013-V1

### 主题

AI 结果与证明必须完整可复盘

### 法条

AI result proof must allow replay, audit, and Forensics linking.

Success must include:
- status = success.
- outputAuthority = authoritative.
- runtimeProof.
- promptContractId.
- promptContractVersion.
- promptCatalogVersion.
- expectedOutputSchema.
- modelProvider.
- modelName.
- modelRole.
- runtime.
- confidence.
- schemaValidationStatus = valid.
- qualityDecision = pass.
- outputBoundaryDecision = allow.
- rawOutputRef or rawOutputHash.
- inputRefs.
- outputRefs.
- evidenceRefs.
- durationMs.
- chain fields from Global Baseline.

Failure/review_required must include:
- failureReason or reviewRequiredReason.
- runtimeProof.
- failureStage.
- schemaIssueCount when relevant.
- qualityDecisionReason when relevant.
- dataQualityFlags when relevant.
- outputAuthority = non_authoritative.
- output = null unless policy explicitly permits partial output.

### 机器可读不变量

```yaml
governanceInvariant:
  id: AI-RESULT-PROOF-COMPLETE
  owner: ai-capability
  successRequired:
    - runtimeProof
    - promptContractId
    - promptContractVersion
    - promptCatalogVersion
    - modelProvider
    - modelName
    - confidence
    - schemaValidationStatus
    - qualityDecision
    - outputBoundaryDecision
    - rawOutputRefOrHash
  failureRequired:
    - runtimeProof
    - failureStage
    - failureReason
  reviewRequired:
    - runtimeProof
    - reviewRequiredReason
  forbidden:
    - runtimeProof:null
    - success-without-raw-output-ref
    - success-with-schema-invalid
    - success-with-output-boundary-blocked
  failureMode: P0_BLOCKING
```

### 禁止

FORBIDDEN:
- `runtimeProof: null`.
- Success without raw output ref/hash.
- Success without schema valid.
- Success with outputBoundary blocked.
- Success with low confidence.
- Failure without reason.
- Review_required without reason.
- Fake proof.
- Fallback proof used as real proof.
- Raw provider output returned as final AI result.

---

## Law GRASSEYE-AI-CAPABILITY-014-V1

status: active  
tier: P0  
capabilityDomain: ai-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: AI output boundary must recursively block execution authority, browser authority, Forensics authority, and command authority while allowing declared governed action-plan tokens.

alias: APEX-AI-014-V1

### 主题

AI 输出边界禁止执行权，不禁止受治理计划令牌

### 法条

AI output boundary must recursively inspect model output and block execution authority.

Allowed governed planning tokens when declared by the active output schema:
- `actions[].actionCode` when it references a registry-exposed atomic capability or a law-declared stop/review handoff
- `actions[].required`
- `actions[].reason`
- `actions[].input.gridCell`
- `actions[].input.key`

These fields are planning tokens only. They do not grant execution authority.

Forbidden output keys, aliases, or semantic intents:
- click
- scroll
- type
- open_page
- openPage
- dispatch_action
- dispatchAction
- platform_action
- platformAction
- browser_action
- browserAction
- forensics_write
- forensicsWrite
- coordinate_to_click
- coordinateToClick
- mouse_click
- mouseClick
- command_to_execute
- commandToExecute
- action_intent
- actionIntent
- nerve_bus_envelope
- nerveBusEnvelope
- set_candidate_disposition
- setCandidateDisposition
- advance_step
- advanceStep
- choose_map
- chooseMap

Required direction:
- Output boundary gate must recursively inspect objects and arrays.
- Forbidden keys must fail even when nested.
- Prompt contract `forbiddenOutputs` must be merged with global forbidden outputs.
- Output boundary failure must return `failed`, not `review_required`, unless a law explicitly allows review.
- Allowed observation coordinates and declared action-plan tokens are not execution commands; any field suggesting execution must be blocked.

### 机器可读不变量

```yaml
governanceInvariant:
  id: AI-OUTPUT-NO-ACTION-AUTHORITY
  owner: ai-capability
  recursiveInspect: true
  forbiddenAliases:
    - click
    - scroll
    - type
    - open_page
    - browserAction
    - platformAction
    - forensicsWrite
    - nerveBusEnvelope
    - actionIntent
    - commandToExecute
  failureMode: P0_BLOCKING
```

### 禁止

FORBIDDEN:
- AI output containing raw action commands.
- AI output containing Nerve Bus envelopes.
- AI output containing Forensics write commands.
- AI output containing platform action commands.
- AI output containing browser action commands.
- AI output containing final mission control commands.
- Treating nested forbidden output as harmless.

---

## Law GRASSEYE-AI-CAPABILITY-015-V1

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: AI must use the capability registry as its only ability manual and must compose registered atomic capabilities instead of business-flow packages.

alias: APEX-AI-015-V1

### 主题

AI 只能组合登记能力

### 法条

AI receives the capability registry as an ability manual. AI may compose multiple registered atomic capabilities according to user requirement and current visual evidence. AI must not invent capabilities, must not assume prebuilt business flows are the main path, and must not output raw coordinates.

Required direction:
- Prompt contracts must describe the AI-visible registry/manual, not a package-flow library.
- When current runtime transport uses `actions[].actionCode`, that field must serialize registry-backed atomic capability ids rather than semantic package names.
- AI may output multiple registered capabilities in sequence when the active schema allows composition.
- AI must not call capability groups or child capabilities by owner internals unless those entries are explicitly exposed by the registry.

### 禁止

FORBIDDEN:
- AI inventing ability names outside the registry.
- AI treating semantic packages, business flows, or workflow shortcuts as the primary ability surface.
- AI outputting raw x/y, direct browser commands, or owner-internal payloads.

---

## Required Enforcement

The ai-capability audit domain must enforce this module using AST, symbol, import graph, JSON schema, generated artifact, and real-code-inspection-backed inspection.

Required inspector dimensions:
- AI public export boundary.
- Child registry completeness.
- Disabled provider fail-closed policy.
- No direct child import outside AI registry.
- No browser/action/Forensics/Orchestration implementation import.
- Prompt Contract Registry uniqueness.
- Prompt contract metadata completeness.
- Prompt contract hash validation.
- Unknown prompt contract typed failure.
- Prompt body only inside governed Prompt Contract files.
- No prompt body in runtime/adapter/orchestration/nerve-bus/retired package chain.
- Runtime pipeline calls required gates in order.
- Timeout AbortSignal reaches runtime adapter.
- Bad JSON/schema mismatch/low confidence cannot success.
- Recursive output boundary blocks action-like fields.
- Result/proof required fields.
- Chain proof fields.
- Disabled/paid/future providers cannot success or fallback.
- Local runtime adapter cannot be second prompt/result truth.
- No module-level unmanaged circuitBreaker/activeRuns.
- No `as any`, `as unknown as`, `as never`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`.
- No `export *`.
- No fake success, fallback success, no-op success.
- AI inspector enters runner.
- AI real-code-inspection executes.
- Generated artifacts include AI law coverage.

Forbidden enforcement shortcuts:
- grep as final judgment.
- regex as final judgment.
- includes as final judgment.
- warning-only P0.
- manual-only proof.
- detached inspector.
- empty real-code-inspection harness.
- generated fake PASS.

---

## Required real-code-inspection

The ai-capability real-code-inspection must prove fail → re-inspect → pass for at least:

- Add browser/action implementation import in AI runtime → FAIL.
- Add Forensics writer import in AI → FAIL.
- Add Orchestration runtime import in AI → FAIL.
- Export child implementation from AI public index → FAIL.
- Add `export *` in AI public index → FAIL.
- Add LocalAiGateway public export → FAIL.
- Add hardcoded prompt body in AI runtime → FAIL.
- Add hardcoded prompt body in runtime adapter → FAIL.
- Add prompt body to retired package chain fixture → FAIL.
- Add unknown promptContractId success path → FAIL.
- Add duplicate promptContractId → FAIL.
- Remove prompt hash → FAIL.
- Make prompt hash mismatch body → FAIL.
- Add disabled provider success → FAIL.
- Add paid/future fallback to local success → FAIL.
- Remove AbortSignal from AiRuntimePort → FAIL.
- Implement timeout with Promise.race only → FAIL.
- Return bad JSON as success → FAIL.
- Return schema mismatch as success → FAIL.
- Return low confidence as success → FAIL.
- Return action-like output as success → FAIL.
- Remove rawOutputRef/rawOutputHash from success → FAIL.
- Set runtimeProof:null → FAIL.
- Remove mission/round/prompt core chain fields from proof → FAIL.
- Add module-level unmanaged `activeRuns` → FAIL.
- Add module-level unmanaged `circuitBreaker` → FAIL.
- Convert ai inspector to warning-only → FAIL.
- Remove ai real-code-inspection invocation → FAIL.
- Detach ai inspector from CI-FULL → FAIL.
- Gate full raw AI IO behind `GRASSEYE_DEBUG_AI_IO` or emit only rawResponsePreview → FAIL.
- Collapse raw model output and parser-normalized output into one AI_RESPONSE_DEBUG event → FAIL.
- Let product_presence_judgment hardcode fixed 3s/6s production truth or reject the default single screenshot + coordinate grid round → FAIL.
- Reintroduce production low-confidence product judgment outside the AI response contract → FAIL.

No AI audit result is valid unless real-code-inspection executes and reports.

---

## Final Readiness Gate

AI Capability Phase 3.5 is READY only when all conditions are true:

- This law file, AI blueprint, inspector, generated artifacts, and runner agree.
- All AI laws are machine-blocking.
- All AI laws use evidenceMode `law+inspector+real-code-inspection`.
- AI inspector is connected to runner.
- AI real-code-inspection executes.
- Prompt Contract Registry is the only prompt truth.
- Unknown/mismatched prompt contract produces typed failure.
- Prompt contract metadata and hash are enforced.
- AI input/proof includes chain fields.
- Runtime pipeline executes required gates.
- Timeout cancellation reaches runtime adapter.
- Disabled/paid/future providers fail closed.
- Local runtime adapter does not become second prompt/result truth.
- Bad JSON/schema mismatch/low confidence cannot success.
- Product-presence routing is AI-owned only: production code may mechanically transport product_yes/product_no from AI output, but must not invent product truth from confidence thresholds.
- Local debug emits AI_RAW_RESPONSE_DEBUG, AI_NORMALIZED_RESPONSE_DEBUG, then terminal AI_RESPONSE_DEBUG/AI_ERROR_DEBUG with full rawResponseText by default.
- Output boundary recursively blocks execution authority while allowing declared governed action-plan tokens.
- Success has rawOutputRef/rawOutputHash and complete proof.
- Failure/review_required have reasons and proof.
- AI public surface does not leak private internals.
- AI does not import action/browser/Forensics/Orchestration implementations.
- Code Purity and AI owner-local audit both pass.
- CI-FULL passes.

Final doctrine:

```txt
AI is the brain, not the emperor.
Prompt Contract is the language contract, not scattered strings.
Runtime adapter is an executor, not a second AI system.
A model answer without schema, proof, and boundary gates is not an AI result.
A disabled provider that succeeds is a governance breach.
An AI output that issues raw execution commands is a failed output.
```
