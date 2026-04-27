---
name: "GrassEye Type Safety"
description: "Use when defining strict TypeScript boundaries, schema validation for AI or OCR outputs, or explicit payload and contract typing."
applyTo: ".github/instructions/cursor-rules/modules/module-type-safety.instructions.md, src/types/**"
---

# GrassEye Type Safety

Scope: governs TypeScript red lines for external input, AI output, OCR output, and action payload typing.
Boundary: this module governs type trust boundaries only.
Excludes: runtime loop policy, storage retention policy, and business scoring rules.
Authority: this file is authoritative only for the type-safety capability domain.

---

## Law GRASSEYE-TYPE-SAFETY-001-V1

status: active
tier: P0
capabilityDomain: type-safety
enforcementMode: manual-first
evidenceMode: law

summary: all external uncertainty must become validated domain types before it can drive actions or records.

### 主题

严格类型与输入验证红线

### 法条

Phase-one TypeScript must run in strict mode, reject untyped uncertainty, and validate external inputs before actions or writes.

Required direction:
- External inputs must enter as unknown until validated.
- AI outputs must pass schema validation before any action or product-signal use.
- Local AI outputs must be validated against task-specific schemas before downstream use.
- OCR outputs must be cleaned into explicit structured data before downstream use.
- Prompt version and schema version must be carried with AI output records.
- Platform action results and adapter outputs must use explicit contracts before they can drive agent-runtime records.
- Platform action payloads and persistence writes must use explicit contracts.
- DOM-derived raw page payloads must not enter product signal, comments, or action decisions.

### 禁止

FORBIDDEN:
- any, as any, or hidden any escapes.
- Using unvalidated JSON to drive actions.
- Untyped local AI outputs entering action, comment, product-signal, or persistence records.
- Prompt outputs without schema version or task type.
- Untyped adapter outputs driving runtime decisions.
- Platform action payloads represented as loose strings or unvalidated raw objects.
- Letting unvalidated OCR text flow directly into product signal.
- Using loose typing to hide AI-output uncertainty.

---

## 模块边界声明

This law file does not govern:
- Which product signals are good or bad.
- Where files belong in the repository.