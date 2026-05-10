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
- missing stepId, capabilityCallId, nerve-bus envelope identity, or inputRef must fail closed.
- AI transport must carry promptContractId.
- result transport must preserve status, failureReason, reviewRequiredReason, outputRef, and timing.

Forbidden:
- retired selection field, retired selection version field, retired package field, retired package version field, retired binding field, legacy route-plan field, retired branch-token field, or legacy template field in active envelopes.
- Nerve Bus injecting defaults that were not present in the governed command.
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

## Final Readiness Gate

The Nerve Bus law is ready only when active envelopes and proofs use mission/run/round/step/prompt truth without retired map fields.
