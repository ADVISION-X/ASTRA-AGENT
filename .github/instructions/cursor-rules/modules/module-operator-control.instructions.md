---
name: "GrassEye Operator Control"
description: "Use when defining operator pause or stop authority, manual override, review gates, or candidate-pool approval boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-operator-control.instructions.md, src/features/operator-control/**, src/app/operator/**"
---

# GrassEye Operator Control

Scope: governs human operator authority over runtime, review, and final business decisions.
Boundary: this module governs control rights and review gates only.
Excludes: platform-side automation design, AI classification logic, procurement systems, and ad systems.
Authority: this file is authoritative only for the operator-control capability domain.

---

## Law GRASSEYE-OPERATOR-CONTROL-001-V1

status: active
tier: P0
capabilityDomain: operator-control
enforcementMode: manual-first
evidenceMode: law

summary: the human operator remains the final authority over runtime, risky actions, and product opportunity disposition.

### 主题

人工最终控制权

### 法条

Phase one keeps human operators in control of runtime continuation, high-risk actions, and the final disposition of product opportunity candidates.

Required direction:
- Agent runtime must expose pause and stop authority to the operator.
- The primary operator experience must expose local runtime status, pause, stop, review, and candidate disposition from the local workbench.
- High-risk actions must require review.
- Low-confidence judgments must route to review or skip.
- All product opportunities remain candidates until a human decides otherwise.

### 禁止

FORBIDDEN:
- Agent-driven goal expansion beyond the current task.
- Autonomous procurement, advertising, or sensitive bulk export decisions.
- CLI-only execution that hides runtime status, review gates, or candidate disposition from the operator.
- Hidden runtime state or silent failure modes.
- Treating AI output as a substitute for human approval.

---

## 模块边界声明

This law file does not govern:
- How screenshots, OCR, or scoring are implemented.
- How platform actions are technically executed.