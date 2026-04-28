---
name: "GrassEye Local AI Runtime"
description: "Use when defining local AI runtime adapters, model-role routing, prompt registry internals, or AI output contract governance inside the AI Ability Group."
applyTo: ".github/instructions/cursor-rules/modules/module-local-ai-runtime.instructions.md, src/lib/local-ai/**, src/capabilities/ai/**, docs/法案辅助文件/GrassEye 本地AI分工与提示词施工图.md, docs/法案辅助文件/GrassEye 本地模型选型施工图.md"
---

# GrassEye Local AI Runtime

Scope: governs local AI runtime adapters, model-role routing, prompt registry internals, and AI output contracts.
Boundary: this module governs only how the AI Ability Group may invoke and trust local AI results as a child sub-contract, not as an independent owner.
Excludes: browser actions, OCR engine installation, product approval, and UI presentation.
Authority: this file is authoritative only for the ai-capability domain as the local-model-runtime child sub-contract.

## Law GRASSEYE-LOCAL-AI-RUNTIME-001-V1

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: manual-first
evidenceMode: law

summary: local-ai-runtime is an AI child sub-contract and internal runtime adapter, not an active owner.

### 主题

AI 内部运行时边界

### 法条

Local AI runtime is an internal adapter boundary owned by the AI Ability Group; it does not own AI public sovereignty.

Required direction:
- Public callers must enter through the AI Ability Group public contract before local runtime internals execute.
- src/lib/local-ai remains the internal runtime surface.
- Local AI execution stays local-first.
- src/capabilities/ai/runtime-adapters/local-ai-runtime-adapter.ts is the only AI-owned runtime adapter allowed to translate public AI contracts into LocalAi runtime contracts.
- Only the internal bridge may import LocalAiGateway, prompt-registry, LocalAiTaskRequest, LocalAiTaskResult, LocalAiTaskType, or legacy LocalAi task-name literals on behalf of the AI root.

### 禁止

FORBIDDEN:
- local-ai-runtime being treated as a public ability owner.
- business domains calling local models directly.
- hidden cloud or paid fallback.
- exporting LocalAiTaskRequest, LocalAiTaskResult, or LocalAiTaskType as public AI sovereignty.
- prompt-contract facades or legacy LocalAi result translators surviving under src/capabilities/ai.

## Law GRASSEYE-LOCAL-AI-RUNTIME-002-V1

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: manual-first
evidenceMode: law

summary: model-role routing must stay explicit and traceable.

### 主题

模型分工与追踪

### 法条

Local AI calls must be routed through explicit model-role mapping under the AI Ability Group.

Required direction:
- visual-observation, ocr-extraction, comment-analysis, and evidence-summary roles must remain explicit.
- AI requests must carry origin abilityGroupId, childAbilityId when applicable, taskType, promptVersion, schemaVersion, and evidence refs.
- Results must return structured outputs only.
- Public AiTaskType values may map to legacy LocalAiTaskType values only inside the internal bridge.
- LocalAi task-name strings must not escape the bridge back into the wider AI root.

### 禁止

FORBIDDEN:
- ad-hoc local model calls scattered in app, capability consumers, adapters, or workbench files.
- free-text AI outputs driving platform actions directly.
- leaking legacy LocalAi task names back out through AI public contract.
- AI callers importing AI-private prompt helpers instead of the AI public facade.

## Law GRASSEYE-LOCAL-AI-RUNTIME-003-V1

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: manual-first
evidenceMode: law

summary: prompts are governed task contracts, not hidden strings.

### 主题

提示词注册边界

### 法条

Prompts that drive GrassEye AI behavior must live behind a governed prompt registry or equivalent local-AI contract surface.

Required direction:
- one prompt serves one narrow task.
- outputs bind to one expected schema.
- prompt changes remain reviewable.
- prompt selection remains behind the bridge or local-ai runtime internals; business callers must not import prompt-registry directly.
- AI public callers must obtain prompt metadata through getPromptContract on the AI ability group, not through prompt-contract shortcut files.

### 禁止

FORBIDDEN:
- hidden prompt strings scattered across business code.
- one prompt serving unrelated tasks.
- raw prompt-registry helpers exported through AI public index.

## Law GRASSEYE-LOCAL-AI-RUNTIME-004-V1

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: manual-first
evidenceMode: law

summary: model configuration is local, role-based, and no-fallback.

### 主题

本地模型配置主权

### 法条

Model roles must resolve from governed local configuration so runtime cannot silently drift to mocks, heuristics, or cloud providers.

Required direction:
- config/local-ai.models.json or equivalent local config remains the model-role source.
- unavailable local models must route to retry, skip, candidate review, or operator review.
- paid and future providers remain disabled_by_policy unless a separate AI policy law explicitly opens them.

### 禁止

FORBIDDEN:
- provider = cloud or paid-api in current phase.
- allowCloudFallback = true.
- allowMock = true for phase-three acceptance.
- hidden paid fallback or implicit provider substitution.

## Law GRASSEYE-LOCAL-AI-RUNTIME-005-V1

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: manual-first
evidenceMode: law

summary: legacy LocalAi contracts are bridge-only and must not escape back into AI public ownership.

### 主题

旧 LocalAi 合同只允许留在桥接层

### 法条

Legacy LocalAiTaskRequest, LocalAiTaskResult, and LocalAiTaskType may survive only as runtime-internal compatibility contracts.

Required direction:
- The internal bridge may map AiTaskType to LocalAiTaskType.
- The internal bridge may map AiAbilityInput to LocalAiTaskRequest and LocalAiTaskResult back to AiAbilityResult.

### 禁止

FORBIDDEN:
- External modules importing LocalAi contracts through the AI ability group.
- More than one bridge, compat, or legacy path for LocalAi mapping.
