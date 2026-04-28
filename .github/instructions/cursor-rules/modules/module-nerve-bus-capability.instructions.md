---
name: "GrassEye Nerve Bus Capability"
description: "Use when defining governed command transport, envelopes, transfer proof, or Orchestration/Ability/AI routing boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-nerve-bus-capability.instructions.md, src/capabilities/nerve-bus/**, scripts/audit/domains/nerve-bus-capability/**, docs/法案辅助文件/GrassEye Nerve Bus 神经网络传输能力组施工图.md"
---

# GrassEye Nerve Bus Capability

Scope: governs governed command transport, envelope validation, channel routing, transfer proof, and return boundaries.
Boundary: this module governs only the Nerve Bus Ability Group and its transport chains.
Excludes: mission decisions, platform execution, AI model logic, and storage internals.
Authority: this file is authoritative only for the nerve-bus-capability domain.

## Law GRASSEYE-NERVE-BUS-CAPABILITY-001-V1

status: active
tier: P0
capabilityDomain: nerve-bus-capability
enforcementMode: manual-first
evidenceMode: law
alias: APEX-NERVE-001-V1

summary: Nerve Bus is the only owner of governed command transport.

### 主题

传输主权

### 法条

Nerve Bus Ability Group is the only owner of governed command transport between Commander Console, Orchestration, Ability Groups, and AI.

Required direction:
- Commander Console human commands must be wrapped as HumanCommandEnvelope and routed through Nerve Bus transport.
- Nerve Bus may expose a dedicated human-command channel or equivalent governed transport entry for Commander Console.
- envelope refs must remain traceable for mission commands and review commands.
- Nerve Bus transport must preserve requestedPlatformId, selectedMapId, and targetRecordRef as envelope-carried command truth and must not invent fallback command fields.

### 禁止

FORBIDDEN:
- direct Orchestration-to-child calls.
- direct Ability-to-Ability command chains.
- AI directly calling abilities.
- startup-entrypoint becoming a second envelope router or transport owner.
- Commander Console bypassing Nerve Bus and directly invoking Orchestration methods as its command transport.
- Nerve Bus injecting requestedPlatformId, selectedMapId, or review disposition defaults that were not present in the governed command envelope.

## Law GRASSEYE-NERVE-BUS-CAPABILITY-002-V1

status: active
tier: P0
capabilityDomain: nerve-bus-capability
enforcementMode: manual-first
evidenceMode: law
alias: APEX-NERVE-002-V1

summary: Nerve Bus must not make business decisions.

### 主题

传输不做决策

### 法条

Nerve Bus validates, routes, records transfer proof, and returns envelopes. It does not choose the next step or own business truth.

### 禁止

FORBIDDEN:
- next-step decisions.
- platform profile ownership.
- AI policy ownership.

## Law GRASSEYE-NERVE-BUS-CAPABILITY-003-V1

status: active
tier: P0
capabilityDomain: nerve-bus-capability
enforcementMode: manual-first
evidenceMode: law
alias: APEX-NERVE-003-V1

summary: Nerve Bus is enforced by owner inspector and audit runner only.

### 主题

执法链唯一

### 法条

Nerve Bus enforcement closes through the owner inspector and audit runner only.

### 禁止

FORBIDDEN:
- scripts/verify, verify-* scripts, or ad-hoc quality scripts as nerve-bus acceptance.
