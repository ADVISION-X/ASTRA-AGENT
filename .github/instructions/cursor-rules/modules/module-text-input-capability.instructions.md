---
name: "GrassEye Text Input Capability"
description: "Use when defining the independent Text Input Ability Group, approved text writing, verified input targets, governed key press, paste, clear, replace, or commit input ownership."
applyTo: ".github/instructions/cursor-rules/modules/module-text-input-capability.instructions.md, src/capabilities/text-input/**, docs/法案辅助文件/GrassEye Text Input 输入能力组施工图.md, scripts/audit/domains/text-input-capability/**"
---

# GrassEye Text Input Capability

Scope: governs the independent Text Input Ability Group, approved text writing, input-target validation dependencies, governed keypress and clipboard execution, and text-input proof ownership.
Boundary: this module governs only approved text payload validation, verified input-target handoff requirements, governed writing primitives, proof emission, and result ownership.
Excludes: target detection, geometry truth, prompt generation, text authoring, policy judgment, action-result verification, and browser-session ownership.
Authority: this file is authoritative only for the text-input-capability domain.

## Law GRASSEYE-TEXT-INPUT-CAPABILITY-001-V1

status: active
tier: P0
capabilityDomain: text-input-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Text Input Ability Group is the only owner of governed text writing capability.

### 主题

写字主权唯一

### 法条

Text Input Ability Group is the only owner of governed text writing capability.

### 禁止

FORBIDDEN:
- orchestration, platform adapters, visual-target, geometry-guard, mouse-click, page-state, AI, or BrowserController owning text-input truth.
- keyboard helper files, DOM helpers, or legacy runtime paths owning text writing.
- BrowserController or browser primitive result types appearing in the Text Input public contract.

## Law GRASSEYE-TEXT-INPUT-CAPABILITY-002-V1

status: active
tier: P0
capabilityDomain: text-input-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Text Input is write-only capability, not cognition, targeting, gesture, or verification truth.

### 主题

纯写字边界

### 法条

Text Input is writing ability only. It is not the brain, not the eyes, not the fingers, and not the judge. It only writes approved text into a verified input target through governed ports.

Required direction:
- Text Input accepts already-approved text only.
- Text Input requires an upstream verified input target ref before type, paste, clear, replace, or commit execution.
- Text Input public entry remains the only public execution surface.
- Text Input result returns actionExecutionRef, primitiveExecutionRef, debugLogRef, and runtimeProof.

### 禁止

FORBIDDEN:
- generating text.
- locating targets.
- deciding whether a target is safe, visible, or correct.
- claiming post-action success beyond write execution.
- hiding fallback execution inside helper layers.

## Law GRASSEYE-TEXT-INPUT-CAPABILITY-003-V1

status: active
tier: P0
capabilityDomain: text-input-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Text Input accepts only approved text payloads and verified target handoff.

### 主题

受批准输入合同

### 法条

Text Input accepts only approved text payloads and verified target handoff material from upstream governed owners.

Required direction:
- inputTargetRef is mandatory on every governed text-input request.
- approvedTextRef is mandatory whenever the child writes non-empty text.
- clear-input may omit approvedTextRef only when the child contract explicitly declares clear-only behavior.
- replace-input must execute clear then write under one governed result.
- commit-input and press-key must use governed key enums rather than raw arbitrary key strings.

### 禁止

FORBIDDEN:
- freeform raw browser script execution.
- selector strings, DOM locators, or CSS queries in the public contract.
- raw unknown payloads, Record<string, unknown>, or unbounded key names.
- direct clipboard persistence of sensitive text outside the governed request scope.

## Law GRASSEYE-TEXT-INPUT-CAPABILITY-004-V1

status: active
tier: P0
capabilityDomain: text-input-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Text Input executes only through governed input, clipboard, and clock ports.

### 主题

端口边界唯一

### 法条

Text Input primitive execution must happen only through TextInputExecutionPort, ClipboardPort when required, and TextInputClockPort.

Required direction:
- type-text, press-key, clear-input, replace-input, and commit-input execute through TextInputExecutionPort.
- paste-text may consume ClipboardPort only as a subordinate port within the Text Input runtime.
- all timestamps and duration measurements come from TextInputClockPort.

### 禁止

FORBIDDEN:
- child implementations constructing browser controllers directly.
- direct Date.now, performance.now, or new Date scatter inside child implementations.
- clipboard values being written into logs, proofs, or persistent records.

## Law GRASSEYE-TEXT-INPUT-CAPABILITY-005-V1

status: active
tier: P0
capabilityDomain: text-input-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Text Input success is primitive write success only and never verification truth.

### 主题

结果真相分离

### 法条

Text Input success means the governed write primitive completed without local execution failure. It never means the field content is already verified as the final accepted page state.

Required direction:
- Text Input must expose explicit success, failed, and review_required branches.
- runtime proof must preserve sourceAbilityGroupId, sourceChildCapabilityId, inputTargetRef, approvedTextRef, and targetEvidenceRefs.
- downstream outcome verification belongs to Post-action Verification or Page State when required by policy.

### 禁止

FORBIDDEN:
- Text Input claiming page-state truth.
- Text Input claiming submission or publish success.
- silent no-op success when no primitive executed.

## Law GRASSEYE-TEXT-INPUT-CAPABILITY-006-V1

status: active
tier: P0
capabilityDomain: text-input-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Text Input enforcement closes through owner inspector and audit runner only.

### 主题

执法链唯一

### 法条

Text Input enforcement closes through the owner inspector and audit runner only.

### 禁止

FORBIDDEN:
- scripts/verify, verify-* scripts, or ad-hoc quality scripts as text-input acceptance.
- capability-check.ts under src/capabilities/text-input.

## Law GRASSEYE-TEXT-INPUT-CAPABILITY-007-V1

status: active
tier: P0
capabilityDomain: text-input-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof

summary: Text Input canonical topology is one standard package with six governed execution children.

### 主题

固定拓扑

### 法条

Text Input canonical topology is ability-group.ts, contract.ts, schema.ts, registry.ts, index.ts, runtime/*, ports/*, shared/*, and children/*/implementation.ts.

Required direction:
- ports must include text-input-execution-port.ts, clipboard-port.ts, and text-input-clock-port.ts.
- children must contain only type-text, paste-text, clear-input, replace-input, press-key, and commit-input.
- shared must contain the canonical text-input proof, failure, result, policy, and type declarations.

### 禁止

FORBIDDEN:
- child-specific public entrypoints.
- export-star of private runtime or child implementation files.
- compat, legacy, bridge, or v2 roots.