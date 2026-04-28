---
name: "GrassEye Open Capability"
description: "Use when defining governed open capability, Open Ability Group contract, child open abilities, open runtime proof, or removing platform-open ownership from adapters, startup, and agent runtime."
applyTo: "src/capabilities/open/**, .github/instructions/cursor-rules/modules/module-open-capability.instructions.md, docs/法案辅助文件/GrassEye Open 能力组施工图.md"
---

# GrassEye Open Capability

Scope: governs only the Open Ability Group domain and its child abilities.
Boundary: this module governs governed target opening, open-result structure, open-proof fields, and open ownership boundaries only.
Excludes: page-state truth, screenshot capture, action-result verification, AI execution, visual target detection, coordinate action, and mission branching.
Authority: this file is authoritative only for the open-capability domain.

## Law GRASSEYE-OPEN-CAPABILITY-001-V1

status: active
tier: P0
capabilityDomain: open-capability
enforcementMode: manual-first
evidenceMode: law

summary: Open Ability Group is the only owner of governed open capability.

### 主题

唯一打开主权

### 法条

Open Ability Group is the only owner of governed open capability.

Required direction:
- all governed open operations flow through the canonical Open Ability Group contract.
- open-tiktok, open-facebook, and open-local-workbench exist as child abilities.
- open capability lives under one canonical root and returns structured Open results.

### 禁止

FORBIDDEN:
- PlatformAdapter, startup, or local shell owning platform-open truth.
- agent-runtime or deleted historical owners owning open behavior.

## Law GRASSEYE-OPEN-CAPABILITY-002-V1

status: active
tier: P0
capabilityDomain: open-capability
enforcementMode: manual-first
evidenceMode: law

summary: Open boundary stays pure.

### 主题

纯边界

### 法条

Open capability only opens the target, records open proof, and returns the open result.

Required direction:
- open may recommend the next owner but does not execute it.
- page-state and post-action verification own state truth and outcome truth after open completes.

### 禁止

FORBIDDEN:
- screenshot capture, AI calls, visual target detection, or coordinate action inside open.
- open claiming that the page is ready, safe, or successful beyond its structured open result.

## Law GRASSEYE-OPEN-CAPABILITY-003-V1

status: active
tier: P0
capabilityDomain: open-capability
enforcementMode: manual-first
evidenceMode: law

summary: Open contracts must stay replaceable and adapter-neutral.

### 主题

合同可替换

### 法条

Open contracts must remain replaceable without changing platform adapters or shell layers.

Required direction:
- platform adapters consume Open results through the public contract only.
- startup may open the local workbench child ability only through the Open public surface.

### 禁止

FORBIDDEN:
- adapter-specific shadow open contracts.
- shell-owned duplicate open helpers.

## Law GRASSEYE-OPEN-CAPABILITY-004-V1

status: active
tier: P0
capabilityDomain: open-capability
enforcementMode: manual-first
evidenceMode: law

summary: Open capability is enforced by owner inspector and audit runner only.

### 主题

执法链唯一

### 法条

Open capability enforcement closes through the owner inspector and audit runner only.

Required direction:
- the canonical root is src/capabilities/open.
- the owner manifest and audit runner remain the only enforcement path.

### 禁止

FORBIDDEN:
- scripts/verify, verify-* scripts, or ad-hoc quality scripts as open-capability acceptance.
