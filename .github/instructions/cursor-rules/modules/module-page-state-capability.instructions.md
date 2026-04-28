---
name: "GrassEye Page State Capability"
description: "Use when defining the independent Page State Ability Group, current-page state classification, page readiness, login wall, safety page, modal overlay, comment panel state, platform page kind, or removing page-state truth from platform-action, agent runtime, and open flows."
applyTo: ".github/instructions/cursor-rules/modules/module-page-state-capability.instructions.md, src/capabilities/page-state/**, docs/法案辅助文件/GrassEye Page State 页面状态感知能力组施工图.md, scripts/audit/domains/page-state-capability/**"
---

# GrassEye Page State Capability

Scope: governs the independent Page State Ability Group, its contracts, current-page state classification, and runtime proof ownership.
Boundary: this module governs only the question "what state is the current page in right now".
Excludes: action execution, action-result verification, AI execution, screenshot capture, visual target detection, comment extraction, product classification, evidence finalization, and round branching.
Authority: this file is authoritative only for the page-state-capability domain.

---

## Law GRASSEYE-PAGE-STATE-CAPABILITY-001-V1

status: active
tier: P0
capabilityDomain: page-state-capability
enforcementMode: manual-first
evidenceMode: law
legacyAlias: APEX-PAGE-STATE-001-V1

summary: Page State Ability Group is the only owner of governed current-page state classification.

### 主题

页面状态主权唯一归属

### 法条

Page State Ability Group is the only owner of governed current-page state classification.

MUST:
- all governed current-page state classification flows through Page State Ability Group interface.
- platform adapters, agent runtime, and open flows may consume page-state result, but must not own final page-state truth.
- page-state output must classify the current page as it exists now, not judge whether an action succeeded.

FORBIDDEN:
- open capability deciding feed ready or login wall truth by itself.
- platform adapter owning login or safety or feed-ready summary helpers.
- agent runtime owning current-page classification truth.
- duplicate page-state helpers outside Page State Ability Group.

---

## Law GRASSEYE-PAGE-STATE-CAPABILITY-002-V1

status: active
tier: P0
capabilityDomain: page-state-capability
enforcementMode: manual-first
evidenceMode: law
legacyAlias: APEX-PAGE-STATE-002-V1

summary: Page State boundary is pure.

### 主题

页面状态边界纯度

### 法条

Page State only classifies, summarizes, records proof, and returns current-page state.

MUST:
- Page State only classifies current-page state and returns a structured state result.

FORBIDDEN:
- screenshot capture.
- AI runtime call.
- visual target detection.
- click execution.
- scroll execution.
- post-action verification.
- DOM/BOM lookup.
- comment extraction.
- product classification.
- final evidence persistence.
- round branch decision.

---

## Law GRASSEYE-PAGE-STATE-CAPABILITY-003-V1

status: active
tier: P0
capabilityDomain: page-state-capability
enforcementMode: manual-first
evidenceMode: law
legacyAlias: APEX-PAGE-STATE-003-V1

summary: Page State output must be evidence-backed.

### 主题

页面状态输出必须有证据支撑

### 法条

Page State output must be evidence-backed.

MUST:
- input must include currentUrl.
- input must include statePolicy and confidencePolicy.
- page-state result must include pageStateType.
- page-state result must include stateSummary.
- page-state result may include observation refs and evidence refs when available.

FORBIDDEN:
- silent page-state success.
- page-state classification without currentUrl.
- declaring feed ready or safety page without any supporting state signal.
- using action completion as page-state proof.

---

## Law GRASSEYE-PAGE-STATE-CAPABILITY-004-V1

status: active
tier: P0
capabilityDomain: page-state-capability
enforcementMode: manual-first
evidenceMode: law
legacyAlias: APEX-PAGE-STATE-004-V1

summary: Page State must write runtime proof.

### 主题

页面状态必须写运行证明

### 法条

Page State must write runtime proof.

MUST:
- abilityGroupId
- childCapabilityId
- sessionId
- roundId if available
- videoVisitId if available
- pageStateType
- stateSummary
- confidence
- evidenceRefs
- observationRefs
- startedAt
- endedAt
- durationMs
- status
- failureReason
- debugLogRef

FORBIDDEN:
- silent classification.
- failed classification without failureReason.
- state result without proof trail.

---

## Law GRASSEYE-PAGE-STATE-CAPABILITY-005-V1

status: active
tier: P0
capabilityDomain: page-state-capability
enforcementMode: manual-first
evidenceMode: law
legacyAlias: APEX-PAGE-STATE-005-V1

summary: Page State must not add dedicated verify script and is enforced by owner inspector only.

### 主题

页面状态禁止独立 verify 脚本

### 法条

Page State is enforced by owner inspector and audit build. It must not add dedicated verify script.

MUST:
- page-state-capability enforcement must route through owner inspector.
- verify-ban must be checked inside page-state owner inspector.

FORBIDDEN:
- scripts/verify/verify-page-state-capabilities.ts
- capability-check files inside src/capabilities/page-state
- any page-state verify-like enforcement entry outside owner inspector.

---

## 模块边界声明

This law file does not govern:
- How screenshots are captured.
- How AI is executed.
- How clicks or scrolls are executed.
- How action-result verification is decided.
- How evidence packets are finalized.
- How orchestration decides the next branch.