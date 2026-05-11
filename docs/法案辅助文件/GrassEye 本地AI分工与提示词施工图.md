# GrassEye 本地AI分工与提示词施工图 FINAL

## 文件身份

- owner: ai-capability
- authority: .github/instructions/cursor-rules/modules/module-ai-capability.instructions.md
- subAuthority: .github/instructions/cursor-rules/modules/module-local-ai-runtime.instructions.md
- status: active
- purpose: 说明当前阶段 AI 如何以一次受治理推理动作调用本地模型

## 最终定位

AI = 受治理的一次推理能力。

当前阶段只保留一条主线：

```txt
visual-mission-judge-once
-> visual-mission-judge-v1
-> local model call
-> JSON extract
-> output schema validate
-> runtime proof
```

本文件不再承认以下旧形态为当前真相：
- provider child registry
- runtime-adapter universe
- paid/future provider system
- role controls
- second prompt registry

## 当前唯一 prompt contract

- promptContractId: visual-mission-judge-v1
- taskType: visual_mission_judgment
- childCapabilityId: visual-mission-judge-once
- outputSchemaRef: ai.visual_mission_judgment.v1

Prompt 必须只包含：
- User Requirement
- Current Visual Evidence
- Platform Profile
- Capability Manual
- Output Schema
- optional continuity bundle

Prompt 禁止包含：
- full previous-round history by default
- workflow/package text
- provider policy text
- cost policy text
- fallback text
- human approval continuation text

## 本地模型调用边界

当前阶段只允许一条 active model path：
- local model call

允许：
- timeoutMs
- AbortSignal
- rawOutputHash 或 rawOutputRef 进入 runtime proof
- model unavailable -> failed 或 review_required

禁止：
- paid provider fallback
- future provider fallback
- cloud fallback
- provider allowlist universe
- role-control matrix as AI truth

## 输入与输出口径

AI 输入必须围绕以下事实组织：
- userRequirementRef 或 userRequirementText
- platformId / platformProfileRef
- originalScreenshotRef
- coordinateGridScreenshotRef
- gridSpecRef
- systemManualRef
- muscleMemoryCatalogVersion
- outputSchemaRef
- optional continuityBundleRef

AI 输出必须围绕以下结构组织：
- decision
- reason
- confidence?
- riskFlags[]
- actions[]
- nonExecutableSummary?

actions[].input 只允许 MuscleMemoryCatalog 规定字段，例如：
- gridCell
- key
- text
- regionGridCell

禁止输出：
- raw x/y
- domSelector
- browserCommand
- Nerve Bus envelope
- Forensics payload

## Feed mining 原则

Feed mining / seeding rounds 默认独立判断：
- 不强制注入 N-1 历史
- 不把历史轮次当成 prompt 默认前提
- 以当前截图、当前坐标格、稳定用户目标、能力手册为主

只有任务明确需要时，才允许 continuityBundleRef：
- local app open
- login recovery
- blocked recovery
- multi-page setup

## 审计信号

建对表现：
- 只有一个 active child
- 只有一个 prompt contract
- 只有一个 local model path
- prompt 只读当前任务必需上下文
- 输出不携带原始执行字段

漂移信号：
- 新增 provider child
- 新增 runtime-adapters 系统目录
- 新增 paid/future provider 生产链路
- prompt 出现 package/workflow/provider policy 大段文本
- 输出重新出现 raw coordinate 或 browser command
