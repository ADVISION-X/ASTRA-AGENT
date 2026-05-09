---
name: "GrassEye Nerve Bus Capability"
description: "Use when governing governed command/result transport, envelope contracts, envelope chain fields, Nerve Bus routing, transport proof, dispatch timeout, idempotency, sequence, queue, return boundaries, and the boundary that prevents Commander, Orchestration, AI, Ability Groups, platform adapters, or startup/runtime helpers from bypassing governed transport."
applyTo: ".github/instructions/cursor-rules/modules/module-nerve-bus-capability.instructions.md, src/capabilities/nerve-bus/**, scripts/audit/domains/nerve-bus-capability/**, docs/法案辅助文件/GrassEye Nerve Bus 神经网络传输能力组施工图.md"
---

# GrassEye Nerve Bus Capability FINAL

Scope: governs the independent Nerve Bus Ability Group, governed envelope transport, channel validation, handler dispatch, result envelope return, transfer proof, idempotency, sequence, queue, timeout, and transport boundary enforcement.

Boundary: this module governs only command/result transport. It does not own mission decisions, map selection, step transitions, AI model policy, prompt content, platform execution, primitive actions, browser/session control, product judgment, evidence persistence internals, or final mission state.

Authority: this file is authoritative only for the `nerve-bus-capability` domain.

Architecture phase: `Static Capability Package Architecture`.

Core doctrine:
- Nerve Bus is the nerve, not the brain.
- Nerve Bus transports governed envelopes; it does not decide what the system should do next.
- Commander, Orchestration, AI, and Ability Groups must communicate through governed Nerve Bus envelopes.
- Nerve Bus must preserve upstream chain truth and must not invent missing command fields.
- Nerve Bus transports typed result envelopes and result refs only; it must not define, interpret, modify, or verify owner-local handoff contracts.
- Nerve Bus success means transport success only; it is not business success, action success, AI truth, page-state truth, or persistence truth.
- No envelopeId, no transport.
- No activationSnapshotRef, no mission transport.
- No capabilityCallId for step dispatch, no ability transport.
- No promptContractId/outputSchemaRef for AI request, no AI transport.
- No typed result envelope, no transport success.
- No transfer proof, no transport success.
- No active Nerve Bus law without inspector + runner + real-code-inspection.

---

## Global Nerve Bus Baseline

All active Nerve Bus laws in this file are:

```yaml
status: active
tier: P0
capabilityDomain: nerve-bus-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection
```

Required package:

```txt
src/capabilities/nerve-bus/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── ports/
├── shared/
├── runtime/
└── children/
```

Required logical channels:

```txt
commander-to-orchestration
orchestration-to-commander
orchestration-to-ability
ability-to-orchestration
orchestration-to-ai
ai-to-orchestration
```

Required enforcement:

```txt
scripts/audit/domains/nerve-bus-capability/
├── manifest.json
├── inspector.ts
├── run-inspector.ts
└── owner-inspection-harness.ts
```

Forbidden:
- `manual-first` as active enforcement.
- `evidenceMode: law` as sufficient evidence.
- verify scripts as release truth.
- capability-check.ts under Nerve Bus root.
- detached inspector.
- warning-only P0.
- generated fake PASS.
- empty/missing real-code-inspection.
- direct Orchestration-to-child calls.
- direct Ability-to-Ability command chains.
- Commander bypassing Nerve Bus.
- AI bypassing Nerve Bus to call abilities.
- Nerve Bus inventing platform/map/review defaults.

## Law GRASSEYE-NERVE-BUS-CAPABILITY-RESULT-CONTRACT-BOUNDARY-V1

status: active
tier: P0
capabilityDomain: nerve-bus-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Nerve Bus transports ResultEnvelope only and must not define or inspect Muscle Joint Result Contracts.

### 主题

Muscle Joint Result Contract 运输边界

### 法条

Nerve Bus must not define, inspect, interpret, transform, or validate Muscle Joint Result Contracts.
Nerve Bus only transports ResultEnvelope.
Nerve Bus may transport AI Candidate Result, Visual Target Result, Geometry Guard Result, Mouse Click Result, and Post Action Verification Result only as governed result envelopes and result refs.
Nerve Bus must not own handoff truth, must not parse handoff payloads, and must not branch on Target/Coordinate/Click/PAV internal result fields.

Required:
- Nerve Bus transport layers may preserve outputRef, resultId, status, failureReason, and other generic envelope metadata only.
- Muscle Joint Result Contracts must remain owned by their ability groups and consumed downstream through owner-local public contracts.

### 禁止

FORBIDDEN:
- Nerve Bus introducing any new handoff-specific owner layer, registry layer, or runtime layer.
- Nerve Bus parsing `geometryGuardHandoff`, `normalizedClickPoint`, `postActionVerificationHandoffRef`, or other owner-local handoff fields.
- Nerve Bus transforming result payloads to add or validate muscle-joint contract fields.

Required inspector:
- Forbidden-shape check for muscle-joint handoff field parsing inside Nerve Bus runtime and audit transport code.
- Boundary check for branching on Target/Coordinate/Click/PAV result fields.
- Transport-result check ensuring Nerve Bus stays on ResultEnvelope and outputRef only.

Required real-code-inspection:
- Add Nerve Bus code that reads geometryGuardHandoff -> FAIL.
- Add Nerve Bus branch on normalizedClickPoint or postActionVerificationHandoffRef -> FAIL.
- Add Nerve Bus-local result-contract side system -> FAIL.

---

## Law GRASSEYE-NERVE-BUS-CAPABILITY-001-V2

status: active  
tier: P0  
capabilityDomain: nerve-bus-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Nerve Bus is the only owner of governed command/result transport between Commander Console, Orchestration, AI, and Ability Groups.

### 主题

传输主权唯一

### 法条

Nerve Bus Ability Group is the only owner of governed transport.

Required:
- Commander Console human commands must be wrapped as `HumanCommandEnvelope` and routed through Nerve Bus.
- Orchestration must send ability commands through Nerve Bus.
- Orchestration must send AI requests through Nerve Bus.
- Ability results must return through governed Nerve Bus result envelopes or through the Nerve Bus transport result generated from the original command.
- AI responses must return through governed Nerve Bus result envelopes or through the Nerve Bus transport result generated from the original request.
- Orchestration-to-Commander review/status responses must use governed Nerve Bus transport.
- Envelope refs must remain traceable for mission commands, ability commands, AI requests, review commands, and result envelopes.
- Nerve Bus may provide a unified `transportEnvelope` API or explicit channel methods, but every channel must be represented in registry, schema, runtime, proof, inspector, and real-code-inspection.

### 禁止

FORBIDDEN:
- Commander Console directly invoking Orchestration methods as command transport.
- startup-entrypoint becoming a second envelope router or transport owner.
- Orchestration directly importing child ability implementations.
- Orchestration directly calling primitive ports.
- Ability Group directly calling another Ability Group.
- AI directly calling abilities.
- platform adapter bypassing Nerve Bus for mission commands.
- local runtime helper advancing mission/step state by direct call.
- Nerve Bus injecting requestedPlatformId, selectedMapId, targetRecordRef, review disposition, or map defaults that were not present in the governed envelope.

Required inspector:
- External direct-call scan.
- Commander-to-Orchestration bypass scan.
- Orchestration-to-child implementation import ban.
- AI-to-ability direct call ban.
- Startup second router ban.
- Default injection scan.

Required real-code-inspection:
- Commander imports Orchestration execute directly → FAIL.
- Orchestration imports an ability child implementation → FAIL.
- AI imports mouse-click implementation → FAIL.
- Startup sends start mission without Nerve Bus → FAIL.
- Nerve Bus injects requestedPlatformId default → FAIL.

---

## Law GRASSEYE-NERVE-BUS-CAPABILITY-002-V2

status: active  
tier: P0  
capabilityDomain: nerve-bus-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: All Nerve Bus envelopes must preserve complete mission/map/step/capability/prompt chain fields and must fail closed when chain truth is missing.

### 主题

Envelope 链路字段完整性

### 法条

Every valid Nerve Bus envelope must preserve full upstream chain truth.

Required base envelope fields:

```txt
abilityGroupId = nerve-bus
channelId
envelopeKind
envelopeId
nerveBusEnvelopeId
transportId
traceId
spanId
attemptId
missionId
runId
sessionId
roundId or visitId when available
videoVisitId when available
stepId
mapPackageId
mapPackageVersion
selectedMapId
selectedMapVersion
activationId
activationSnapshotRef
capabilityCallId
sourceRef
inputRef
payloadRef
idempotencyKey
sequenceNo
createdAt
expiresAt
```

Required human command fields:
```txt
commanderCommandRef
commanderEnvelopeRef
requestedPlatformId when start mission
selectedMapId or taskTemplateId or activationId according to command
targetRecordRef when review/target command
```

Required ability command fields:
```txt
targetAbilityGroupId
targetChildCapabilityId
capabilityInputRef
expectedOutputSchemaRef
postActionVerificationRequired when target is action ability
```

Required AI request fields:
```txt
promptContractId
promptContractVersion
outputSchemaRef
aiInputRefs
modelPolicyRef or providerPolicyRef
```

Required result envelope fields:
```txt
correlationEnvelopeId
correlationCapabilityCallId
correlationInputRef
status = success | failed | review_required
outputRef or diagnosticPayloadRef according to status
proofRef
```

Required:
- `envelopeId` and `nerveBusEnvelopeId` must be identical or explicitly aliased.
- `resultEnvelope` must preserve chain parity with the request envelope.
- Result envelope must reverse `from/to` relative to request envelope where applicable.
- Missing chain fields must return typed failed/review_required transport result with proof.
- No valid transport may contain nullable activation/map chain fields.

### 禁止

FORBIDDEN:
- Mission transport without runId/sessionId.
- Mission transport without activationSnapshotRef.
- Step dispatch without capabilityCallId.
- Ability command without targetAbilityGroupId/targetChildCapabilityId.
- AI request with raw prompt but without promptContractId.
- AI request without outputSchemaRef.
- Result envelope with mismatched missionId/runId/stepId/activationSnapshotRef.
- Success result without outputRef.
- Failed result without failureReason.
- Review result without reviewRequiredReason.
- Silent default for missing chain fields.

Required inspector:
- Base envelope schema field check.
- AI request promptContract/outputSchema check.
- Result/request parity check.
- No nullable activation chain in valid transport.
- Default injection ban.

Required real-code-inspection:
- Remove activationSnapshotRef from envelope → FAIL.
- Remove capabilityCallId from ability command → FAIL.
- AI request uses promptRef/rawPrompt but no promptContractId → FAIL.
- Result envelope mismatches runId → FAIL.
- Success result without outputRef → FAIL.

---

## Law GRASSEYE-NERVE-BUS-CAPABILITY-003-V2

status: active  
tier: P0  
capabilityDomain: nerve-bus-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Nerve Bus has exactly six governed logical channels and must not create business-specific or platform-specific transport channels.

### 主题

六条传输通道与通道纯洁度

### 法条

Nerve Bus channels are transport routes, not business routes.

Required logical channels:
```txt
commander-to-orchestration
orchestration-to-commander
orchestration-to-ability
ability-to-orchestration
orchestration-to-ai
ai-to-orchestration
```

Required:
- Every channel must have schema, registry entry, child definition, runtime route, proof support, and inspector coverage.
- Channel registry must enforce allowedFrom/allowedTo.
- Channel registry must enforce expiry, payloadRef, idempotencyKey, sequence, retryPolicy=none, timeoutPolicy=fail_closed.
- Channel names must remain generic transport routes.

### 禁止

FORBIDDEN:
- `facebook-to-orchestration`
- `tiktok-to-orchestration`
- `click-next-video-arrow`
- `product-video-detection`
- `map-authoring-direct-runtime`
- `ability-to-ability`
- `commander-to-ability`
- `ai-to-ability`
- platform-specific Nerve Bus channels.
- business-task-specific Nerve Bus channels.
- channels that bypass Orchestration state ownership.

Required inspector:
- Channel registry exact set check.
- Forbidden channel names scan.
- allowedFrom/allowedTo matrix check.
- Child/registry/schema parity.

Required real-code-inspection:
- Add `facebook-to-orchestration` channel → FAIL.
- Add `ability-to-ability` channel → FAIL.
- Remove `orchestration-to-commander` channel → FAIL.
- Mismatch child registry and schema → FAIL.

---

## Law GRASSEYE-NERVE-BUS-CAPABILITY-004-V2

status: active  
tier: P0  
capabilityDomain: nerve-bus-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Nerve Bus validates, routes, times out, records proof, and returns typed envelopes; it must not make mission, map, AI, action, or storage decisions.

### 主题

传输不做决策

### 法条

Nerve Bus owns transport mechanics only.

Allowed:
- envelope schema validation.
- channel policy validation.
- envelope integrity validation.
- idempotency gate.
- sequence gate.
- queue gate.
- timeout gate.
- handler dispatch through port.
- result semantic gate.
- transfer proof building.
- typed transport result building.

Forbidden:
- choosing operational map.
- choosing next step.
- evaluating branch transitions.
- owning platform profile.
- deciding AI provider.
- building raw AI prompt.
- judging AI output truth.
- executing platform actions.
- executing primitive click/scroll/input.
- writing Forensics storage directly.
- finalizing mission/round state.
- deciding product candidate status.
- modifying mission state.

Required inspector:
- Forbidden import/symbol scan.
- No map selection imports.
- No prompt builder in Nerve Bus.
- No platform primitive imports.
- No Forensics runtime writes.
- No transition evaluator in Nerve Bus.

Required real-code-inspection:
- Nerve Bus imports map selection gate → FAIL.
- Nerve Bus builds raw prompt string → FAIL.
- Nerve Bus imports BrowserController → FAIL.
- Nerve Bus writes Forensics storage directly → FAIL.
- Nerve Bus sets nextStepId → FAIL.

---

## Law GRASSEYE-NERVE-BUS-CAPABILITY-005-V2

status: active  
tier: P0  
capabilityDomain: nerve-bus-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Nerve Bus must run a fixed fail-closed transport pipeline.

### 主题

固定传输流水线

### 法条

Every transport execution must follow one fixed pipeline:

```txt
input schema gate
→ channel registry gate
→ channel policy gate
→ envelope integrity gate
→ idempotency reservation gate
→ sequence gate
→ queue gate
→ timeout/cancellation gate
→ handler port dispatch
→ result envelope schema gate
→ result semantic gate
→ payload binding/output write
→ transfer proof builder
→ transport result builder
→ idempotency commit or release
```

Required:
- Handler dispatch happens only after all pre-dispatch gates pass.
- Handler dispatch must carry AbortSignal.
- Timeout must abort the signal.
- Late handler success after timeout must not overwrite timeout failure.
- Duplicate in-flight command must fail/review; duplicate completed command may return cached transport result only if proof matches.
- Sequence violation must fail/review; it must not dispatch handler.
- Queue rejection must fail/review; it must not dispatch handler.
- Every gate failure must produce typed failure/review result with proof.
- No naked throw may escape public API boundary.

### 禁止

FORBIDDEN:
- handler dispatch before envelope integrity gate.
- handler dispatch before idempotency reservation.
- handler dispatch after sequence failure.
- handler dispatch after timeout gate failure.
- retry loop.
- fallback transport path.
- catch-and-swallow error handling.
- no-op success.
- null success.
- boolean transport result.
- raw handler result passthrough.

Required inspector:
- Pipeline call order.
- AbortSignal usage.
- Retry/fallback ban.
- Gate failure proof invariant.
- No naked throw public boundary.

Required real-code-inspection:
- Move handler dispatch before integrity gate → FAIL.
- Remove AbortSignal → FAIL.
- Add retry loop → FAIL.
- Return boolean success → FAIL.
- Swallow handler error and success → FAIL.

---

## Law GRASSEYE-NERVE-BUS-CAPABILITY-006-V2

status: active  
tier: P0  
capabilityDomain: nerve-bus-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Nerve Bus result semantics must be typed, correlated, payload-ref first, and real-code-inspection-backed.

### 主题

传输结果语义

### 法条

Nerve Bus success means transport success only.

Required result semantics:
- `status = success | failed | review_required`.
- Success requires:
  - resultEnvelope exists.
  - outputRef exists.
  - outputPayload exists or governed outputRef already bound to payloadRef.
  - proof exists.
  - proofRef exists.
  - request/result chain parity.
  - handlerDecision=executed.
  - timeoutDecision=within_timeout.
- Failure requires:
  - failureReason exists.
  - diagnosticPayloadRef or failure proof exists.
  - proof exists.
- Review requires:
  - reviewRequiredReason exists.
  - diagnosticPayloadRef or review proof exists.
  - proof exists.
- Nerve Bus may not claim target business success.
- Nerve Bus may not rewrite target output schema.

### 禁止

FORBIDDEN:
- status: ok.
- status: persisted.
- success without outputRef.
- success without proof.
- failed without failureReason.
- review_required without reviewRequiredReason.
- raw provider result as result envelope.
- raw ability result without envelope validation.
- outputPayload whose documentRef mismatches outputRef.
- result payload not present in payloadRef.
- Nerve Bus adding business decision fields such as productDecision, nextStepId, actionVerified.

Required inspector:
- Result schema check.
- Status/result invariant check.
- Request/result parity check.
- No business fields in transport result.
- Raw provider passthrough ban.

Required real-code-inspection:
- Success without outputPayload → FAIL.
- Failure without failureReason → FAIL.
- AI provider raw JSON bypasses AiResponseEnvelope → FAIL.
- Add nextStepId to transport result → FAIL.
- Mismatched outputRef/documentRef → FAIL.

---

## Law GRASSEYE-NERVE-BUS-CAPABILITY-007-V2

status: active  
tier: P0  
capabilityDomain: nerve-bus-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Nerve Bus transfer proof must preserve full chain, timing, gate decisions, handler decision, payload refs, and correlation refs.

### 主题

Transfer Proof 完整性

### 法条

Every Nerve Bus transport result must include transfer proof.

Required proof fields:

```txt
proofId
abilityGroupId = nerve-bus
channelId
envelopeKind
envelopeId
nerveBusEnvelopeId
correlationEnvelopeId
transportId
traceId
spanId
attemptId
missionId
runId
sessionId
roundId or visitId
videoVisitId
stepId
mapPackageId
mapPackageVersion
selectedMapId
selectedMapVersion
activationId
activationSnapshotRef
capabilityCallId
sourceRef
inputRef
payloadRef
outputRef
diagnosticPayloadRef
from
to
targetAbilityGroupId
targetChildCapabilityId
promptContractId
promptContractVersion
outputSchemaRef
idempotencyKey
sequenceNo
policyDecision
integrityDecision
idempotencyDecision
sequenceDecision
queueDecision
timeoutDecision
handlerDecision
semanticDecision
handlerCallId
handlerStartedAt
handlerEndedAt
handlerDurationMs
circuitBreakerState
startedAt
endedAt
durationMs
status
failureReason
reviewRequiredReason
dataQualityFlags
```

Required:
- Proof chain must equal envelope chain.
- Proof must include every gate decision.
- Proof must include handler timing when handler was invoked.
- Proof must include rejection reason when handler was not invoked.
- Proof must never include raw API keys, raw image payloads, or raw large provider responses.
- Proof stores refs/hashes, not raw payload bodies.

### 禁止

FORBIDDEN:
- runtimeProof:null.
- transfer proof without activationSnapshotRef.
- transfer proof without capabilityCallId for step dispatch.
- transfer proof without envelopeId.
- proof fabricated runId from missionId/stepId.
- proof missing timeoutDecision.
- proof missing idempotencyDecision.
- proof missing handlerDecision.
- proof contains API key.
- proof contains raw image base64.
- proof contains raw prompt body.

Required inspector:
- Proof schema field checks.
- Envelope/proof parity.
- No secret/raw payload leakage.
- Gate-decision completeness.

Required real-code-inspection:
- Remove activationSnapshotRef from proof → FAIL.
- Remove handlerDecision from proof → FAIL.
- Add raw prompt body to proof → FAIL.
- Add API key-like value to proof → FAIL.
- Fabricate runId from stepId → FAIL.

---

## Law GRASSEYE-NERVE-BUS-CAPABILITY-008-V2

status: active  
tier: P0  
capabilityDomain: nerve-bus-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Nerve Bus AI transport must carry Prompt Contract references only and must not carry raw prompt truth.

### 主题

AI 传输只传 Prompt Contract 引用

### 法条

Nerve Bus transports AI requests but does not own prompt content.

Required AI request fields:
```txt
promptContractId
promptContractVersion
outputSchemaRef
aiInputRefs
modelPolicyRef or providerPolicyRef
```

Required:
- AI request must reference prompt contract from Orchestration frozen map step.
- AI request must carry outputSchemaRef.
- AI response must carry outputRef and proofRef.
- Nerve Bus may transport promptContractId but must not build or store prompt text.
- Nerve Bus must not select model/provider.
- Nerve Bus must not read provider API key.

### 禁止

FORBIDDEN:
- `promptRef` as final active AI prompt truth when promptContractId is missing.
- rawPrompt.
- systemPrompt.
- userPrompt.
- promptText.
- template literal prompt construction in Nerve Bus.
- provider API key in envelope/proof/log.
- Nerve Bus selecting external AI provider.
- Nerve Bus fallback from local AI to cloud AI.

Required inspector:
- AI envelope schema check.
- Raw prompt key/symbol ban.
- Provider secret import ban.
- outputSchemaRef required.
- promptContractId required.

Required real-code-inspection:
- AI request without promptContractId → FAIL.
- AI request without outputSchemaRef → FAIL.
- Add rawPrompt field to envelope → FAIL.
- Import secret resolver into Nerve Bus → FAIL.
- Nerve Bus chooses providerId → FAIL.

---

## Law GRASSEYE-NERVE-BUS-CAPABILITY-009-V2

status: active  
tier: P0  
capabilityDomain: nerve-bus-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Nerve Bus children are narrow channel bindings and must use unified runtime.

### 主题

子能力窄通道绑定

### 法条

Active child capabilities:

```txt
commander-to-orchestration
orchestration-to-commander
orchestration-to-ability
ability-to-orchestration
orchestration-to-ai
ai-to-orchestration
```

Required:
- Each child has `contract.ts`, `schema.ts`, `implementation.ts`.
- Each child binds exactly one channel.
- Each child uses unified Nerve Bus runtime pipeline.
- Child implementation must not build final transport proof directly.
- Child implementation must not bypass channel registry.
- Child implementation must not call foreign owner implementation directly.
- Child implementation may call only `NerveBusHandlerPort` through the unified transport runner where a target handler is required.
- Passive return channels must still produce proof through unified result/proof builders.

### 禁止

FORBIDDEN:
- business-specific child channel.
- platform-specific child channel.
- child direct Orchestration execution.
- child direct ability execution.
- child direct AI provider execution.
- child returning raw boolean/null.
- child importing foreign owner runtime.
- duplicate channel implementations.

Required inspector:
- Child folder/registry/schema parity.
- Unified runtime usage.
- Foreign implementation import ban.
- Raw boolean/null result ban.

Required real-code-inspection:
- Add `product-video-discovery` child → FAIL.
- Child imports AI provider adapter → FAIL.
- Child directly calls Orchestration execute → FAIL.
- Child returns boolean → FAIL.
- Remove one required child → FAIL.

---

## Law GRASSEYE-NERVE-BUS-CAPABILITY-010-V2

status: active  
tier: P0  
capabilityDomain: nerve-bus-capability  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: Nerve Bus enforcement must close through owner-local AST/symbol/import-graph inspector, runner, and real-code-inspection.

### 主题

Nerve Bus 执法唯一入口

### 法条

Nerve Bus enforcement must close through:

```txt
scripts/audit/domains/nerve-bus-capability/manifest.json
scripts/audit/domains/nerve-bus-capability/inspector.ts
scripts/audit/domains/nerve-bus-capability/run-inspector.ts
scripts/audit/domains/nerve-bus-capability/owner-inspection-harness.ts
```

Required:
- Inspector must use ts-morph AST-level checks.
- Inspector must use symbol and import-graph checks.
- Inspector must use schema-level checks.
- Inspector must include anti-escape checks.
- Inspector must verify active law coverage in registry/matrix/audit-plan/runner.
- real-code-inspection must run and report fail → re-inspect → pass.
- CI-FULL must be green for delivery.
- No grep/regex/includes as final judgment.
- No warning-only P0.
- No detached inspector.
- No empty/missing real-code-inspection.
- No generated fake PASS.
- No capability-check.ts.
- No verify script as release truth.

Required inspector checks:
```txt
1. Law file is machine-blocking.
2. Six channel exact set.
3. Envelope base chain fields complete.
4. AI request requires promptContractId/outputSchemaRef.
5. Ability command requires targetAbilityGroupId/targetChildCapabilityId/capabilityCallId.
6. No transport default injection.
7. No direct cross-owner calls.
8. No business decision fields.
9. Fixed pipeline gates exist in order.
10. AbortSignal/timeout enforced.
11. No retry/fallback path.
12. Result semantic gate enforced.
13. Result/proof/envelope parity.
14. Children use unified runtime.
15. No raw prompt/API key/raw image leakage.
16. ALL active Nerve Bus laws in registry/matrix/audit-plan/runner.
17. owner-inspection-harness executed.
```

Required real-code-inspection:
```txt
manual-first enforcement reintroduced
remove activationSnapshotRef from envelope
remove runId from envelope
remove capabilityCallId from ability command
AI request without promptContractId
AI request without outputSchemaRef
add rawPrompt to envelope
result mismatches request runId
success without outputRef
failure without failureReason
child returns boolean
child imports Orchestration runtime
Orchestration directly imports ability child implementation
Commander directly calls Orchestration execute
add platform-specific channel
remove required channel
remove AbortSignal
add retry loop
add nextStepId to transport result
add API key-like value to proof
capability-check.ts added
remove real-code-inspection invocation
turn P0 into warning-only
```

---

## Final Readiness Gate

Nerve Bus is READY only when:

```txt
law/blueprint/inspector/generated/runner agree
all active Nerve Bus laws are machine-blocking
six channels are exact and complete
full envelope chain fields are required
Nerve Bus does not invent platform/map/review defaults
Nerve Bus dispatches only through handler port
Nerve Bus makes no business/map/prompt/provider/storage decisions
fixed fail-closed transport pipeline is enforced
AbortSignal/timeout/idempotency/sequence/queue gates are enforced
result semantic gate blocks raw/null/boolean/mismatched results
transfer proof is full-chain and secret-safe
AI request carries promptContractId/outputSchemaRef only
children are narrow channel bindings
owner-local inspector PASS
real-code-inspection PASS
ALL active law enforcement PASS
CI-FULL PASS
```
