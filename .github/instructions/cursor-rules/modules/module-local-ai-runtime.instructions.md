---
name: "GrassEye Local AI Runtime"
description: "Use when defining the thin local model call used by the AI Ability Group."
applyTo: ".github/instructions/cursor-rules/modules/module-local-ai-runtime.instructions.md, src/lib/local-ai/**, src/capabilities/ai/**, docs/法案辅助文件/GrassEye 本地AI分工与提示词施工图.md, docs/法案辅助文件/GrassEye 本地模型选型施工图.md"
---

# GrassEye Local AI Runtime

Scope: governs the local model call path used by the AI Ability Group.

Boundary: local-ai is an internal implementation detail. It is not a public AI owner, not an external provider router, and not a second prompt system. External provider transport belongs to AI Input Gateway when that governed path is used.

Authority: this file is authoritative only for the local model call boundary inside the AI domain.

Core doctrine:
- local-ai is implementation detail under AI.
- one active local model path is enough for the current phase.
- prompt truth belongs to AI prompt contract code, not to scattered runtime helpers.
- model selection comes from governed local config.

## Active Baseline

Current allowed local runtime behavior:
- call the governed local model for visual-mission-judge-once.
- use timeoutMs and AbortSignal.
- return raw text, runtime metadata, or a typed failure.
- report startup readiness through the existing local startup readiness contract.

Forbidden local runtime behavior:
- provider routing universe.
- Gemini API, Gemini Web Chat, GPT Web Chat, or other external provider adapter ownership.
- paid or future provider fallback.
- cloud fallback.
- role controls as runtime truth.
- second prompt registry source.
- action execution, Nerve Bus dispatch, or Forensics write.

## Law GRASSEYE-LOCAL-AI-RUNTIME-001-V2

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: machine-blocking
evidenceMode: law+real-code-inspection

summary: local-ai remains an internal call boundary only.

### 法条

Required direction:
- public callers enter through src/capabilities/ai only.
- local-ai may expose helpers for model config, startup readiness, and low-level adapters.
- external provider transport must enter through src/capabilities/ai-input-gateway rather than src/lib/local-ai.
- AI root files must not recreate a runtime-adapter universe.

FORBIDDEN:
- business domains calling local-ai directly.
- prompt truth duplicated inside local-ai.
- provider-specific public contracts.

## Law GRASSEYE-LOCAL-AI-RUNTIME-002-V2

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: machine-blocking
evidenceMode: law+real-code-inspection

summary: current phase keeps one governed local model path with no fallback universe.

### 法条

Required direction:
- model name and runtime resolve from config/local-ai.models.json.
- unavailable model returns failed or review_required.
- one call path is preferred over routing logic.

FORBIDDEN:
- paid provider enablement.
- future provider placeholders.
- allowCloudFallback = true.
- hidden retry-to-other-provider behavior.

## Law GRASSEYE-LOCAL-AI-RUNTIME-003-V2

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: machine-blocking
evidenceMode: law+real-code-inspection

summary: local prompt usage must be sourced from the AI prompt contract, not a second registry universe.

### 法条

Required direction:
- local runtime may read prompt text from AI prompt helpers.
- one active prompt contract is enough for the current phase.

FORBIDDEN:
- local-ai-owned prompt registry as separate truth.
- task-type to provider matrix as public truth.
- role controls, roster summaries, or prompt shortcut exports.

## Law GRASSEYE-LOCAL-AI-RUNTIME-006-V2

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: machine-blocking
evidenceMode: law+real-code-inspection

summary: local startup readiness stays governed and separate from AI business judgment.

### 法条

Required direction:
- startup readiness may check runtime presence, configured model, and health.
- startup readiness must not execute business judgment.

FORBIDDEN:
- ad-hoc runtime startup from consumers.
- business inference used as readiness proof.
