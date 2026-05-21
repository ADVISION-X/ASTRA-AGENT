---
name: "GrassEye Nerve Bus Capability"
description: "Use when governing governed command/result transport, envelope contracts, envelope chain fields, Nerve Bus routing, transport proof, dispatch timeout, idempotency, sequence, queue, return boundaries, and the boundary that prevents Commander, Orchestration, AI, Ability Groups, platform adapters, or startup/runtime helpers from bypassing governed transport."
applyTo: ".github/instructions/cursor-rules/modules/module-nerve-bus-capability.instructions.md, src/capabilities/nerve-bus/**, scripts/audit/domains/nerve-bus-capability/**, docs/法案辅助文件/GrassEye Nerve Bus 神经网络传输能力组施工图.md"
---

# GrassEye Nerve Bus Capability FINAL

Scope: governs governed command/result transport, envelope contracts, transfer proof, idempotency, timeout, queue, and return boundaries.
Boundary: this module governs transport only. It does not own mission flow, prompt text, page meaning, action planning, browser execution, or evidence persistence.
Authority: this file is authoritative only for the nerve-bus-capability domain.

Core doctrine:
- Nerve Bus is the governed transport layer.
- Nerve Bus moves envelopes; it does not create mission truth.
- Nerve Bus may transport promptContractId and outputSchemaRef; it must not build prompt bodies.
- Nerve Bus must preserve chain fields without reviving retired selection choices, retired package chains, retired binding states, or retired branch tokens.

## Law GRASSEYE-NERVE-BUS-CAPABILITY-001-V2

status: active
tier: P0
capabilityDomain: nerve-bus-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: every governed command envelope must carry short-chain mission truth only.

### 主题

短链 transport 真相

### 法条

Every governed command envelope must carry traceable mission chain fields.

Required envelope fields:
- envelopeId
- envelopeSchemaVersion
- missionId
- runId
- sessionId when applicable
- roundId when applicable
- stepId
- capabilityCallId
- requestedBy
- targetAbilityGroupId
- targetChildCapabilityId when applicable
- promptContractId when applicable
- outputSchemaRef when applicable
- inputRef
- idempotencyKey
- timeoutMs when applicable

Required:
- missing stepId, capabilityCallId, nerve-bus envelope identity, envelopeSchemaVersion, or inputRef must fail closed.
- AI transport must carry promptContractId.
- result transport must preserve envelopeId, envelopeSchemaVersion, status, failureReason, reviewRequiredReason, outputRef, and timing.
- Nerve Bus may generate transport-owned metadata such as envelopeId or emittedAt only; it must not inject business defaults or semantic payload fields.
- idempotencyKey defines replay-safe transport identity; retries or replays must preserve the original governed payload instead of rebuilding it.

Forbidden:
- retired selection field, retired selection version field, retired package field, retired package version field, retired binding field, legacy route-plan field, retired branch-token field, or legacy template field in active envelopes.
- Nerve Bus injecting defaults that were not present in the governed command, other than transport-owned metadata such as envelopeId or emittedAt.
- Nerve Bus building prompt text or action plans.

## Law GRASSEYE-NERVE-BUS-CAPABILITY-002-V2

status: active
tier: P0
capabilityDomain: nerve-bus-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: transfer proof must preserve the same short-chain fields as the governed envelope.

### 主题

传输证明不恢复旧地图字段

### 法条

Transfer proof must preserve the chain fields carried by the governed envelope and nothing more.

Required proof fields:
- envelopeId
- envelopeSchemaVersion
- missionId
- runId
- sessionId when applicable
- roundId when applicable
- stepId
- capabilityCallId
- promptContractId when applicable
- outputSchemaRef when applicable
- status
- failureReason or reviewRequiredReason when applicable
- outputRef when applicable
- latency refs

Forbidden:
- retired binding field in transfer proof.
- retired selection field or retired selection version field in transfer proof.
- retired package field or retired package version field in transfer proof.
- retired deterministic flow planning or retired branch-token field as transport truth.
- rewriting governed payload meaning during replay or proof reconstruction.

## Law GRASSEYE-NERVE-BUS-CAPABILITY-003-V1

status: active
tier: P0
capabilityDomain: nerve-bus-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Nerve Bus active child surface must be generic envelope transport, not directional channel taxonomy.

### 主题

禁止方向 Channel 子能力

### 法条

Nerve Bus must not create source-to-target directional child capabilities.

Forbidden child capability IDs:
- orchestration-to-ai
- ai-to-orchestration
- commander-to-orchestration
- orchestration-to-commander
- orchestration-to-ability
- ability-to-orchestration

Allowed child capability IDs (current phase):
- dispatch-governed-envelope
- return-governed-result
- or a single merged: transport-governed-envelope

Reason: direction belongs to envelope fields (requestedBy / targetAbilityGroupId / targetChildCapabilityId), not to child capability taxonomy.

## Law GRASSEYE-NERVE-BUS-CAPABILITY-004-V1

status: active
tier: P0
capabilityDomain: nerve-bus-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Queue, sequence, retry, and fallback infrastructure are not active Nerve Bus truth in the current simple-machine phase.

### 主题

禁止 Queue/Sequence/Retry/Fallback 系统

### 法条

A simple synchronous transport path is the only authorized Nerve Bus transport in the current phase.

Forbidden active infrastructure:
- queue store or queue port
- sequence store or sequence port
- retry policy or retry loop
- fallback path or fallback handler
- transport dispatch log system
- return boundary policy system
- event stream or transport history database

Any future queue or sequence system requires a separate law and blueprint before activation.

## Final Readiness Gate

The Nerve Bus law is ready only when:
1. Active envelopes and proofs use mission/run/round/step/prompt truth without retired map fields.
2. Active child surface contains only generic transport children, not directional channel taxonomy.
3. No queue, sequence, retry, or fallback infrastructure is active.
