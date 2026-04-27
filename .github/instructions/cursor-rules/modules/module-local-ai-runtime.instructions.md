---
name: "GrassEye Local AI Runtime"
description: "Use when defining local AI execution authority, local model routing, prompt registry boundaries, or AI output contract governance."
applyTo: ".github/instructions/cursor-rules/modules/module-local-ai-runtime.instructions.md, src/lib/local-ai/**, src/features/vision/**, src/features/comments/**, src/features/product-signal/**"
---

# GrassEye Local AI Runtime

Scope: governs local AI execution authority, model-role routing, prompt registry boundaries, and AI output contracts.
Boundary: this module governs only how GrassEye may invoke and trust local AI results.
Excludes: browser actions, OCR implementation details, product scoring rules, model installation, and UI presentation.
Authority: this file is authoritative only for the local-ai-runtime capability domain.

---

## Law GRASSEYE-LOCAL-AI-RUNTIME-001-V1

status: active
tier: P0
capabilityDomain: local-ai-runtime
enforcementMode: manual-first
evidenceMode: law

summary: GrassEye phase-one AI execution must stay local-first and must not automatically fall back to paid or cloud AI APIs.

### 主题

本地 AI 主权与外部 API 禁止边界

### 法条

GrassEye phase-one AI execution must use local AI as the governed execution path for visual classification, OCR-supported understanding, comment intelligence, and product-signal reasoning.

Required direction:
- Local AI is the default governed AI execution path for phase one.
- Paid API, cloud AI API, or remote model fallback must not be called automatically.
- Any non-local AI use must require explicit operator approval and a separate governed decision path.
- Local AI failures must route to skip, retry, or operator review rather than silent cloud fallback.

### 禁止

FORBIDDEN:
- Automatic fallback from local AI to paid API or cloud AI API.
- Hidden external AI calls inside vision, comment, product-signal, or helper layers.
- Uploading screenshots, OCR text, comments, or product evidence to unauthorized external AI services.
- Treating remote AI as an invisible substitute for local model failure.

---

## Law GRASSEYE-LOCAL-AI-RUNTIME-002-V1

status: active
tier: P0
capabilityDomain: local-ai-runtime
enforcementMode: manual-first
evidenceMode: law

summary: local AI calls must go through explicit model-role routing and may not be scattered across business code.

### 主题

本地模型分工与调用入口

### 法条

Local AI calls must be routed through a governed local-AI boundary that separates model roles and keeps business domains from calling models ad hoc.

Required direction:
- Vision classification, OCR text extraction or OCR-supported cleanup, comment understanding, and product-signal reasoning must have explicit model-role boundaries.
- Business domains must request AI work through the governed local-AI boundary rather than direct scattered calls.
- Each AI result must identify task type, model role, prompt version, schema version, confidence or uncertainty, and evidence reference.
- Product-presence vision input must support multi_frame_contact_sheet or governed multi-image input, and contact sheet is preferred when multi-image support is uncertain.
- Multi-frame product-presence must default to one governed AI task rather than three independent AI calls.
- Product-presence AI results must record inputMode, sampledFrameCount, validFrameCount, and aggregateReason.
- Model-role routing must remain reviewable and replaceable without changing the GrassEye core chain.
- Local AI receives screenshot/OCR evidence, not DOM dumps.

### 禁止

FORBIDDEN:
- Direct ad hoc local model calls scattered inside agent-runtime, platform-action, comments, or product-signal code.
- Mixing vision classification, comment reasoning, and product scoring into one unbounded AI call.
- AI outputs without task type, prompt version, schema version, or evidence reference.
- Business logic depending on a specific local model name as if it were permanent truth.

---

## Law GRASSEYE-LOCAL-AI-RUNTIME-003-V1

status: active
tier: P0
capabilityDomain: local-ai-runtime
enforcementMode: manual-first
evidenceMode: law

summary: prompts must be governed task contracts, not loose hidden strings inside business code.

### 主题

提示词注册与结构化输出契约

### 法条

Prompts that drive GrassEye AI behavior must be governed task contracts with versioned purpose, input scope, output schema, and forbidden output boundaries.

Required direction:
- Prompts must be stored or exposed through a governed prompt registry or equivalent local-AI contract surface.
- Each prompt must bind to one task type and one expected output schema.
- Prompts must instruct models to return structured results only.
- Product-presence prompts must ask whether the sampled frames as a whole show a concrete product, not whether one frame alone is commercially interesting.
- Prompt changes must be reviewable because they can change runtime behavior and downstream records.

### 禁止

FORBIDDEN:
- Hidden prompt strings scattered inside unrelated business code.
- Prompts that ask the model to invent unseen facts, fabricate comments, or produce final business decisions.
- Free-text AI responses directly driving platform actions, product signals, or persistence writes.
- One prompt serving unrelated vision, comment, and product-decision tasks.

---

## Law GRASSEYE-LOCAL-AI-RUNTIME-004-V1

status: active
tier: P0
capabilityDomain: local-ai-runtime
enforcementMode: manual-first
evidenceMode: law

summary: GrassEye local AI model roles must be declared in a governed local model configuration before they can be used by runtime, audit, or phase acceptance.

### 主题

本地模型角色配置主权

### 法条

GrassEye AI execution must resolve model roles from a governed local model configuration so vision, OCR, comment understanding, and product-signal reasoning cannot silently fall back to mock, heuristic, paid, or cloud providers.

Required direction:
- Local AI model roles must be declared in config/local-ai.models.json or an equivalent governed local model config.
- Required phase-three roles are vision, ocr, commentUnderstanding, and productSignal.
- Each configured role must declare provider type, runtime, model or tool name, execution mode, prompt/schema binding, and failure behavior.
- Local AI Gateway must consume the governed model config instead of hardcoding model choices inside unrelated business code.
- Model unavailability must route to retry, skip, candidate review, or operator review rather than silent mock success or cloud fallback.

### 禁止

FORBIDDEN:
- Hidden mock or heuristic classification as the phase-three acceptance path.
- Cloud provider, paid API, or remote model fallback in local model role config.
- Scattered model names inside agent-runtime, platform-action, product-signal, comment-intelligence, or UI files.
- Treating a missing local model config as PASS.
- Treating unavailable local models as successful real AI execution.

---

## 模块边界声明

This law file does not govern:
- How browser clicks are executed.
- How OCR engines are installed.
- Which specific local model must be used.
- How to install local models.
- Which model brand is permanently required.
- Model benchmark scoring.
- Whether a product candidate is finally approved by the operator.