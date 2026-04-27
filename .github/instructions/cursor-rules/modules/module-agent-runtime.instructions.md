---
name: "GrassEye Agent Runtime"
description: "Use when defining the GrassEye observe, classify, act, record loop, runtime stop conditions, or agent execution boundary."
applyTo: ".github/instructions/cursor-rules/modules/module-agent-runtime.instructions.md, src/app/**, src/features/agent/**"
---

# GrassEye Agent Runtime

Scope: governs the single-round agent runtime loop and execution state transitions.
Boundary: this module governs observe -> classify -> act -> record only.
Excludes: visual classification logic, OCR semantics, product scoring, storage schema design, and operator UI implementation.
Authority: this file is authoritative only for the agent-runtime capability domain.

---

## Law GRASSEYE-AGENT-RUNTIME-001-V1

status: active
tier: P0
capabilityDomain: agent-runtime
enforcementMode: manual-first
evidenceMode: law

summary: the agent may run only as a bounded, traceable, single-chain loop.

### 主题

单轮闭环与停机边界

### 法条

Agent execution must stay inside one bounded round: observe -> classify -> act -> record.

Required direction:
- Every round must be pausable, stoppable, and traceable by step.
- Classification must exist before any platform action leaves the observe state.
- Key actions must write evidence and action records before the round is treated as complete.
- Runtime must expose an explicit stop condition, review gate, or operator handoff.
- Real-platform unattended loops must treat geometry mismatch, unknown UI, login challenge, CAPTCHA, and low-confidence target as stop or review gates.
- Agent runtime must request abstract actions and must not own coordinate or selector details.
- One task window must have one active runtime authority.

### 禁止

FORBIDDEN:
- Autonomous loops without a stop condition or review window.
- Action execution that skips classification or skips record.
- Runtime loops that continue clicking after a safety-gate failure.
- Runtime-owned raw coordinate or selector recipes.
- Expanding to extra platforms, accounts, pages, or missions from inside the loop.
- Multi-agent fan-out or silent background spread.

---

## 模块边界声明

This law file does not govern:
- How vision classifies screenshots.
- How comments are read, scored, or stored.