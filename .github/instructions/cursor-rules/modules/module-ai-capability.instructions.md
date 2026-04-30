---
name: "GrassEye AI Capability"
description: "Use when defining the independent AI Ability Group, AI child provider registry, AI-only thinking boundary, or AI public ownership relative to orchestration, nerve bus, and local runtime internals."
applyTo: ".github/instructions/cursor-rules/modules/module-ai-capability.instructions.md, src/capabilities/ai/**, scripts/audit/domains/ai-capability/**, docs/法案辅助文件/GrassEye AI 大脑能力组施工图.md"
---

# GrassEye AI Capability

Scope: governs the independent AI Ability Group, child provider registry, AI public contract, AI routing, and AI-only reasoning boundary.
Boundary: this module governs only the AI Ability Group and its child capabilities.
Excludes: orchestration map decisions, Nerve Bus transport, platform actions, browser control, and persistence truth.
Authority: this file is authoritative only for the ai-capability domain.

---

## Law GRASSEYE-AI-CAPABILITY-001-V1

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: manual-first
evidenceMode: law

summary: AI is an independent first-class ability group, not a runtime helper.

alias: APEX-AI-001-V1

### 主题

AI 大脑主权

### 法条

AI is an independent GrassEye Ability Group. It is the system brain, not a runtime helper.

Required direction:
- The AI Ability Group public root is src/capabilities/ai.
- Orchestration, Nerve Bus, and operator-facing runtime may call only the AI Ability Group public contract.
- All AI child capabilities belong under one internal registry owned by the AI Ability Group.
- AI ownership must stay separate from Orchestration, Nerve Bus, Open, Screenshot, Mouse, and platform-action ability groups.
- AI public contract must be defined in AI-native terms such as AiAbilityInput, AiAbilityResult, AiTaskType, providerPolicy, costPolicy, dataPolicy, qualityPolicy, and runtimeProof.
- AI requests must keep requestedBy = orchestration and transportedBy = nerve-bus.
- LocalAiTaskRequest, LocalAiTaskResult, and LocalAiTaskType may exist only inside internal runtime adapters and must not remain the public AI sovereignty surface.

### 禁止

FORBIDDEN:
- Treating AI as a helper hidden inside src/lib/local-ai.
- Public runtime callers importing local AI gateway, prompt registry, or runtime adapters directly.
- Mixing AI ownership into platform adapters, browser infrastructure, or product-signal business code.
- Exporting LocalAiTaskRequest, LocalAiTaskResult, or LocalAiTaskType as AI public contract.
- Exporting prompt-contract facades, legacy AI result adapters, or any other AI-private helper as public AI contract.

---

## Law GRASSEYE-AI-CAPABILITY-002-V1

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: manual-first
evidenceMode: law

summary: AI child capabilities represent provider and runtime channels, not business-task names.

alias: APEX-AI-002-V1

### 主题

AI 子能力按提供者和运行通道治理

### 法条

AI child capabilities must represent provider and runtime channels, while business tasks route through the AI Ability Group task router.

Required direction:
- The active child registry includes local-vision-ai, local-text-ai, local-ocr-ai, paid-vision-ai, paid-analysis-ai, and future-api-ai.
- Business task names route through the AI Ability Group task router and must not replace child capability ids.
- The AI Ability Group public taskType set is product_presence_judgment, visual_observation, visual_target_candidate_analysis, ocr_cleanup, comment_signal_summary, product_signal_summary, evidence_packet_analysis, and schema_validation_only.
- Legacy LocalAi task names may exist only inside the internal runtime bridge mapping.
- The AI Ability Group must own the routing matrix from taskType to childCapabilityId.
- Child capability readiness must be inspectable through checkReadiness only.
- Public AI callers may read prompt contracts only through the AI Ability Group facade.

### 禁止

FORBIDDEN:
- Using prompt ids or business tasks as child capability ids.
- Allowing feature domains to decide provider selection ad hoc.
- Hiding paid or future API children outside the AI registry.
- External modules importing src/capabilities/ai/children/** directly.
- capability-check.ts or verify* functions acting as child readiness or enforcement truth.
- External modules importing src/capabilities/ai/shared/** or other AI-private files directly.

---

## Law GRASSEYE-AI-CAPABILITY-003-V1

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: manual-first
evidenceMode: law

summary: AI only thinks and returns structured results; it does not execute actions.

alias: APEX-AI-003-V1

### 主题

AI 只思考不动手

### 法条

The AI Ability Group may reason, classify, extract, summarize, and return governed structured results. It may not execute platform actions or runtime side effects.

Required direction:
- AI returns structured governed results with taskType, modelProvider, modelName, output, schemaValidationStatus, confidence or uncertainty, evidence refs, debugLogRef, and runtimeProof.
- Action decisions remain with Orchestration.
- Command transport remains with Nerve Bus.
- Physical execution remains with the relevant action ability groups.
- Forensics Persistence writes AI records, not AI itself.
- AI may summarize governed results for logs, but legacy LocalAi result translation must stay outside the AI root.

### 禁止

FORBIDDEN:
- AI directly clicking, scrolling, opening pages, or dispatching Nerve Bus envelopes.
- AI directly writing final evidence packets, final browse outcomes, candidate dispositions, AI result records, browse ledgers, or failed records.
- AI importing forensics-persistence, features/local-data, types/evidence-packet, platform-action, BrowserController, or action ability children.
- AI mutating RuntimeDeliveryState or using agent-runtime as requestedBy or allowed caller.
- Free-text AI output driving platform actions without governed structured interpretation.

---

## Law GRASSEYE-AI-CAPABILITY-004-V1

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: manual-first
evidenceMode: law

summary: local-ai-runtime is an internal execution boundary under the AI Ability Group.

alias: APEX-AI-004-V1

### 主题

local-ai-runtime 从公开主权降为内部执行边界

### 法条

src/lib/local-ai remains the internal local runtime boundary, while src/capabilities/ai becomes the public owner.

Required direction:
- Prompt registry, governed local model config loading, runtime adapters, and runtime execution helpers may stay under src/lib/local-ai.
- The only AI-owned runtime adapter to local-ai internals is src/capabilities/ai/runtime-adapters/local-ai-runtime-adapter.ts.
- Public runtime callers must enter AI through src/capabilities/ai.
- AI-facing helper imports from outside the AI Ability Group must use the public AI facade.
- local-ai-runtime law governs internals only and must not reclaim AI public ownership.
- Legacy LocalAiTaskRequest, LocalAiTaskResult, and LocalAiTaskType mapping may happen only inside the internal bridge.
- Legacy LocalAi task-name literals may appear only inside the internal bridge.

### 禁止

FORBIDDEN:
- External callers importing LocalAiGateway directly once the AI Ability Group exists.
- External callers importing prompt-registry or runtime-adapters directly when an AI facade export exists.
- Treating src/lib/local-ai as the canonical AI root.
- ability-group.ts directly constructing LocalAiGateway outside the owned runtime bridge.
- AI root files outside runtime-adapters/local-ai-runtime-adapter.ts importing types/local-ai or lib/local-ai internals.

---

## Law GRASSEYE-AI-CAPABILITY-005-V1

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: manual-first
evidenceMode: law

summary: paid and future API AI children may exist only as explicit governed children and default disabled by policy.

alias: APEX-AI-005-V1

### 主题

付费与未来 API 子能力只能显式存在且默认关闭

### 法条

Paid and future API AI providers may exist only as named child capabilities under the AI Ability Group and must default to disabled-by-policy status.

Required direction:
- paid-vision-ai, paid-analysis-ai, and future-api-ai may exist only as explicit children under src/capabilities/ai/children.
- Default policy is disabled_by_policy until a separate law, review path, and operator approval exist.
- Paid providers require allowPaidProvider, explicit provider allowlist, dataPolicy.allowExternalTransmission = true, costPolicy.maxEstimatedCost, and operatorApprovalRef before any execution is legal.
- No automatic fallback from local AI to paid or future API children is allowed.
- Policy-disabled children must still be visible in registry and audit surfaces.

### 禁止

FORBIDDEN:
- Hidden cloud or paid fallback.
- Paid child capabilities without reviewable policy state.
- Treating future API placeholders as runnable production paths.
- Executing a paid child when policy is incomplete or implied.

---

## Law GRASSEYE-AI-CAPABILITY-005B-V2

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: manual-first
evidenceMode: law
alias: APEX-AI-005B-V2

summary: AI outputs must be cleaned before persistence and may not leak AI runtime contract into Forensics public ownership.

### 主题

AI 输出进入 Forensics 前必须清洗，不能把 AI 运行时契约泄漏成 Forensics 主权。

### 法条

AI may return governed structured results, but any persistence request must translate those results into cleaned payload or a Forensics-native envelope input before reaching Forensics.

### 禁止

FORBIDDEN:
- Forensics importing AI index, prompt contracts, or LocalAiTaskResult as public contract truth.
- AI or downstream callers relying on task names such as vision.productPresence or comments.intent_analysis as Forensics ownership terms.

---

## Law GRASSEYE-AI-CAPABILITY-006-V1

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: manual-first
evidenceMode: law

summary: AI keeps a single public contract and does not leak child or legacy internals.

alias: APEX-AI-006-V1

### 主题

AI 公开合同与私有实现硬隔离

### 法条

The AI Ability Group must keep one stable public contract and must not leak child implementations or legacy LocalAi internals.

Required direction:
- index.ts may export only the AI ability-group entry, AI public types, routing table access, roster access, and governed validators.
- Child implementations stay private under src/capabilities/ai/children.
- runtime-task-execution.ts is not part of the AI public owner and must not survive under src/capabilities/ai.
- prompt-contract.ts must not survive as a public-facing shortcut under src/capabilities/ai.

### 禁止

FORBIDDEN:
- Barrel-exporting child implementations.
- Public exports of LocalAiGateway, prompt-registry raw helpers, runtime-task-execution, capability-check, or verify functions.
- Public exports of prompt-contract shortcuts, LocalAi result translators, or any AI-private shared helper that reintroduces LocalAi public ownership.
- Keeping runtime-task-execution.ts as part of the active AI root.

---

## Law GRASSEYE-AI-CAPABILITY-007-V1

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: manual-first
evidenceMode: law

summary: ai-capability inspector is the only enforcement owner for AI topology and anti-escape checks.

alias: APEX-AI-007-V1

### 主题

AI 执法入口唯一

### 法条

AI topology, owner-cutover, anti-escape, and forbidden-import enforcement must close through the ai-capability inspector and audit runner only.

Required direction:
- scripts/audit/domains/ai-capability/inspector.ts is the only AI enforcement entry.
- Decisive checks must use AST, symbol resolution, or import-graph analysis.
- capability-check and verify naming may exist only as forbidden audit targets, not as runtime acceptance paths.
- Decisive checks must fail when prompt-contract shortcuts, legacy LocalAi result adapters, or direct-transport callers survive under the AI root.

### 禁止

FORBIDDEN:
- capability-check.ts acting as enforcement truth.
- verify* functions acting as enforcement truth.
- regex-only, grep-only, or includes-only AI owner-cutover verdicts.
- AI public-index leakage or AI-private path imports escaping inspector coverage.

## Law GRASSEYE-AI-CAPABILITY-008-V1

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: manual-first
evidenceMode: law

summary: AI owns the Prompt Contract Registry and prompt execution contracts.

### 主题

Prompt Contract 主权

### 法条

AI owns the Prompt Contract Registry and the governed contracts used to execute prompts by promptContractId.

## Law GRASSEYE-AI-CAPABILITY-009-V1

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: manual-first
evidenceMode: law

summary: Prompt contracts must declare full governed metadata.

### 主题

Prompt Contract 完整合同

### 法条

AI prompt contracts must declare taskType, modelRole, input contract, output schema, forbidden outputs, review policy, confidence policy, debug policy, and prompt hash.

## Law GRASSEYE-AI-CAPABILITY-010-V1

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: manual-first
evidenceMode: law

summary: Prompt contracts may guide reasoning only and must not command actions or privacy bypass.

### 主题

Prompt 只能提问不能指挥动作

### 法条

AI prompt contracts must not instruct the model to click, scroll, type, open pages, bypass security, read cookies, read credentials, or make final mission decisions.

## Law GRASSEYE-AI-CAPABILITY-011-V1

status: active
tier: P0
capabilityDomain: ai-capability
enforcementMode: manual-first
evidenceMode: law

summary: AI runtime must resolve prompt execution by promptContractId rather than map-specific hardcoding.

### 主题

Prompt 执行按合同路由

### 法条

AI runtime must execute prompt contracts by promptContractId and must not hardcode map-specific prompts.