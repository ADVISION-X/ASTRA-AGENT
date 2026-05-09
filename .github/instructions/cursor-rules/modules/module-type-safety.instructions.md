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
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: all external uncertainty must become validated domain types before it can drive actions or records.

### 主题

严格类型与输入验证红线

### 法条

Phase-one TypeScript must run in strict mode, reject untyped uncertainty, and validate external inputs before actions or writes.

Required direction:
- External inputs must enter as unknown until validated.
- AI outputs must pass schema validation before any action, Forensics record, Orchestration owner evidence, Page State result, or Post-action Verification result.
- Local AI outputs must be validated against task-specific schemas before downstream use.
- OCR outputs must be cleaned into explicit structured data before they can become AI input, AI result context, or Forensics record payload.
- Prompt version and schema version must be carried with AI result records.
- Platform action results and adapter outputs must use explicit contracts before they can drive Orchestration proof or Forensics record writes.
- Platform action payloads and persistence writes must use explicit contracts.
- DOM-derived raw page payloads must not become Page State truth, Post-action Verification truth, or Forensics records without validation.

### 禁止

FORBIDDEN:
- any, as any, or hidden any escapes.
- Using unvalidated JSON to drive actions.
- Untyped local AI outputs entering action, Forensics records, Orchestration proof, Page State result, or Post-action Verification result.
- Prompt outputs without schema version or task type.
- Untyped adapter outputs driving runtime decisions.
- Platform action payloads represented as loose strings or unvalidated raw objects.
- Letting unvalidated OCR text flow directly into AI result context, action decisions, or record writes.
- Using loose typing to hide AI-output uncertainty.

---

## 模块边界声明

This law file does not govern:
- Which product signals are good or bad.
- Where files belong in the repository.