---
name: "GrassEye Mouse Scroll Capability"
description: "Use when defining the independent Mouse Scroll Ability Group, scroll contracts, scroll magnitude policy, scroll proof, or governed browser/screen scroll execution ownership."
applyTo: ".github/instructions/cursor-rules/modules/module-mouse-scroll-capability.instructions.md, src/capabilities/mouse-scroll/**, docs/法案辅助文件/GrassEye Mouse Scroll 能力组施工图.md, scripts/audit/domains/mouse-scroll-capability/**"
---

# GrassEye Mouse Scroll Capability

Scope: governs the independent Mouse Scroll Ability Group, scroll contracts, primitive-port ownership, runtime proof, and governed scroll execution boundaries.
Boundary: this module governs only scroll input validation, geometry-approved execution input, scroll magnitude normalization, primitive scroll execution, and result ownership.
Excludes: screenshot capture, visual target detection, coordinate mapping, scale mapping, AI execution, click execution, comment capture, product classification, post-action visual verification, and round branch decisions.
Authority: this file is authoritative only for the mouse-scroll-capability domain.

---

## Law GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1

status: active
tier: P0
capabilityDomain: mouse-scroll-capability
enforcementMode: manual-first
evidenceMode: law
legacyAlias: APEX-MOUSE-SCROLL-001-V1

summary: Mouse Scroll Ability Group is the only owner of governed mouse scroll capability.

### 主题

Mouse Scroll 能力主权唯一归属

### 法条

Mouse Scroll Ability Group is the only owner of governed mouse scroll capability.

MUST:
- all governed mouse scroll operations flow through Mouse Scroll Ability Group interface.
- scroll operation accepts explicit scroll direction, magnitude, coordinateSpace, repeat, and safety policy.
- Mouse Scroll public contract must depend on MouseScrollPrimitivePort rather than BrowserController.
- BrowserController may execute a low-level scroll primitive only through composition-root injection of MouseScrollPrimitivePort.
- Geometry Guard must validate executable geometry before Mouse Scroll executes.
- Mouse Scroll executes only when geometryGuardRef exists and guardDecision equals allow.
- Mouse Scroll consumes only browserViewport or desktopScreen executable space.

FORBIDDEN:
- platform adapter owning scroll strategy.
- agent runtime directly calling browser scroll primitive.
- visual target detector executing scroll.
- screenshot ability executing scroll.
- local AI executing scroll.
- duplicate scroll helpers outside Mouse Scroll Ability Group.
- Geometry Guard owning scroll business verbs.
- BrowserController or BrowserActionResult appearing in Mouse Scroll public contract.

---

## Law GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V1

status: active
tier: P0
capabilityDomain: mouse-scroll-capability
enforcementMode: manual-first
evidenceMode: law
legacyAlias: APEX-MOUSE-SCROLL-002-V1

summary: Mouse Scroll boundary is pure.

### 主题

Mouse Scroll 能力边界纯度

### 法条

Mouse Scroll only validates scroll input, executes mouse scroll primitive, records structured proof, and returns MouseScrollResult.

MUST:
- Mouse Scroll only validates scroll input, executes mouse scroll primitive, records runtime proof, and returns MouseScrollResult.
- Mouse Scroll result must expose scrollExecutionRef, primitiveExecutionRefs, geometryGuardRef, debugLogRef, and runtimeProof.
- Mouse Scroll status may be only success, failed, or review_required.

FORBIDDEN:
- screenshot capture.
- visual target detection.
- AI call.
- click execution.
- geometry policy ownership.
- comment capture.
- product classification.
- post-action visual verification.
- round branch decision.
- DOM selector scroll.
- imageEvidence as executable scroll coordinate space.
- scaleMapping inside Mouse Scroll.
- fallbackUsed or raw browserAction on Mouse Scroll result.
- treating BrowserActionId as actionLogRef.
- writing final Forensics action log inside Mouse Scroll.

---

## Law GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V1

status: active
tier: P0
capabilityDomain: mouse-scroll-capability
enforcementMode: manual-first
evidenceMode: law
legacyAlias: APEX-MOUSE-SCROLL-003-V1

summary: Scroll amount and direction are input, not child capability.

### 主题

滚动幅度必须是输入参数而不是子能力

### 法条

Scroll amount is input, not child capability.

MUST:
- scroll magnitude must be represented as input:
  - small
  - halfPage
  - onePage
  - twoPages
  - customDelta
- direction must be represented as input:
  - up
  - down
  - left
  - right
- repeat count must be explicit and bounded.
- child capabilities must be only:
  - scroll-browser-viewport
  - scroll-desktop-screen
  - scroll-region
- customDelta must carry deltaX / deltaY.
- scrolling to next video is an orchestration or preset intent, not a Mouse Scroll child capability.
- region-based executable coordinates must be evidence-backed and geometry-approved.

FORBIDDEN:
- child capabilities named scroll-one-page / scroll-two-pages / scroll-next-video.
- child capabilities named vertical-wheel-scroll / horizontal-wheel-scroll.
- child capabilities named browser-viewport-scroll / desktop-screen-scroll / region-wheel-scroll after topology cutover.
- hiding repeated scroll loops inside Mouse Scroll without explicit repeat.
- unbounded scroll until condition.
- guessing scroll amount without requested magnitude.
- direct execution of contactSheet or aiInput coordinates as scroll anchors.

---

## Law GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V1

status: active
tier: P0
capabilityDomain: mouse-scroll-capability
enforcementMode: manual-first
evidenceMode: law
legacyAlias: APEX-MOUSE-SCROLL-004-V1

summary: Mouse Scroll must emit runtime proof and primitive execution proof.

### 主题

Mouse Scroll 必须写运行证明

### 法条

Mouse Scroll must write runtime proof.

MUST:
- abilityGroupId
- childCapabilityId
- sessionId
- roundId if available
- videoVisitId if available
- requestedBy
- purpose
- geometryGuardRef
- direction
- magnitude
- deltaX
- deltaY
- coordinateSpace
- anchorPoint
- regionRef if region-based
- scrollExecutionRef
- primitiveExecutionRefs
- startedAt
- endedAt
- durationMs
- status
- failureReason
- runtimeProof

FORBIDDEN:
- silent scroll.
- scroll success without runtimeProof.
- scroll failure without failureReason.
- actionLogRef forged from browserActionId.

---

## 模块边界声明

This law file does not govern:
- How screenshots are captured.
- How visual targets are detected.
- How AI makes decisions.
- How comments are collected.
- How product decisions are made.
- How post-action visual verification works.