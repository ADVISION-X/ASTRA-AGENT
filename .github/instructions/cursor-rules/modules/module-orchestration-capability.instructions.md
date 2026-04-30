---
name: "GrassEye Orchestration Capability"
description: "Use when defining mission command, operational maps, mission state, step transitions, or Orchestration-to-Nerve-Bus dispatch boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md, src/capabilities/orchestration/**, scripts/audit/domains/orchestration-capability/**, docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md"
---

# GrassEye Orchestration Capability

Scope: governs mission command, operational maps, mission state ownership, branch evaluation, and map-level proof.
Boundary: this module governs only the Orchestration Ability Group and its consumption of governed operational-map packages.
Excludes: human command entry, transport execution internals, platform action primitives, AI runtime internals, and storage internals.
Authority: this file is authoritative only for the orchestration-capability domain.

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1

status: active
tier: P0
capabilityDomain: orchestration-capability
enforcementMode: manual-first
evidenceMode: law
alias: APEX-ORCH-001-V1

summary: Orchestration Ability Group is the only owner of mission command and operational maps.

### 主题

总调度主权

### 法条

Orchestration Ability Group is the only owner of mission command, mission state, step state, branch decisions, and operational-map selection.

Required direction:
- human command enters Commander Console first, then reaches Orchestration as a governed mission command.
- governed human mission commands must arrive through Nerve Bus transport rather than raw Commander-to-Orchestration object calls.
- Orchestration must receive requestedPlatform or selectedMap truth from the governed human command envelope and must not inherit a silent Commander fallback such as a hard-coded tiktok-web default.
- Orchestration selects exactly one operational map for one mission.
- Orchestration owns mission state, currentStepId, previousStepId, branchTaken, and final round status.
- review-runtime decisions may enter Orchestration only through governed review commands, not through Commander-owned state mutation.

### 禁止

FORBIDDEN:
- PlatformAdapter, open, page-state, or deleted agent-runtime chains owning mission flow.
- human command bypassing Commander Console and landing directly in runtime helpers.
- startup-entrypoint directly issuing mission start, pause, resume, stop, or emergency-stop.
- Commander Console directly holding OrchestrationAbilityGroup as public contract truth.
- Orchestration startMission recovering missing platform truth through a Commander-side defaultRequestedPlatformId or requestedPlatform ?? "tiktok-web" fallback.

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-002-V1

status: active
tier: P0
capabilityDomain: orchestration-capability
enforcementMode: manual-first
evidenceMode: law
alias: APEX-ORCH-002-V1

summary: operational maps are declarative map packages consumed by Orchestration, not child capabilities.

### 主题

作战地图属于总调度内部

### 法条

Operational maps are governed declarative map packages consumed by Orchestration. Orchestration remains the only owner of operational-map selection, mission state, step state, branch evaluation, and execution. Map packages define route shape only and do not execute abilities.

Required direction:
- operational maps are not child capabilities and do not expand the fixed ability-group catalog.
- Orchestration-owned child capabilities remain the fixed mission lifecycle and transition actions only.
- map package must pass schema validation.
- map package must pass dependency validation.
- map package must pass transition closure validation.
- map package must pass capability registry validation.
- map package must pass prompt contract validation.
- map package must pass platform profile validation.
- map package must pass compatibility validation.
- map package must enter quarantine before activation.
- map package must be human approved before active registry.
- Orchestration active truth must come only from the active approved map registry rather than legacy static TypeScript map modules.
- Orchestration may select only active approved maps.

### 禁止

FORBIDDEN:
- maps being modeled as Orchestration child capabilities.
- map package containing executable code.
- map package importing TypeScript modules.
- maps calling private ability implementations.
- map package dispatching Nerve Bus directly.
- map package mutating mission state.
- map package writing Forensics records directly.
- map package bypassing Orchestration validation.
- unvalidated map package becoming active.
- active map selected from unapproved package.
- AI generated draft map executing without validation and human approval.
- maps becoming platform-specific browse-flow narratives.
- legacy static TypeScript maps acting as active runtime selection truth.

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-003-V1

status: active
tier: P0
capabilityDomain: orchestration-capability
enforcementMode: manual-first
evidenceMode: law
alias: APEX-ORCH-003-V1

summary: Orchestration dispatches only through Nerve Bus and public ability-group interfaces.

### 主题

调度出口唯一

### 法条

Orchestration must dispatch governed work through Nerve Bus envelopes and consume governed ability results only.

### 禁止

FORBIDDEN:
- direct cross-group imports.
- hidden skill catalogs, browse chains, or adapter-owned next-step logic.

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-004-V1

status: active
tier: P0
capabilityDomain: orchestration-capability
enforcementMode: manual-first
evidenceMode: law
alias: APEX-ORCH-004-V1

summary: Orchestration is enforced by owner inspector and audit runner only.

### 主题

执法链唯一

### 法条

Orchestration enforcement closes through the owner inspector and audit runner only.

### 禁止

FORBIDDEN:
- scripts/verify, verify-* scripts, or ad-hoc quality scripts as orchestration acceptance.

---

## Law GRASSEYE-ORCHESTRATION-CAPABILITY-005-V2

status: active
tier: P0
capabilityDomain: orchestration-capability
enforcementMode: manual-first
evidenceMode: law
alias: APEX-ORCH-005-V2

summary: Orchestration may request persistence but may not hide round-finalization logic under Forensics.

### 主题

总调度可以请求写账，但不得把 round finalizer 藏到 Forensics 目录里。

### 法条

Orchestration may send cleaned payloads to Forensics for persistence, but it remains the owner of branch decisions, mission flow, and review escalation.

### 禁止

FORBIDDEN:
- Importing src/capabilities/forensics-persistence/runtime/**.
- Treating Forensics as the owner of AgentRound mutation, RuntimeDeliveryState mutation, product candidate construction, or round-outcome judgment.
