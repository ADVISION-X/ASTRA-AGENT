# GrassEye 本地AI分工与提示词施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 13 个 active ability groups 与 4 个 active support laws，不重新分配主权。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 基本身份

- 从属法案：module-ai-capability.instructions.md
- 角色：AI Ability Group 内部 local-ai-runtime、模型角色与 prompt contract 的施工图
- 原则：只描述 AI 内部子边界，不生成第二个 AI 主权文件，不把 prompt、model roster、runtime adapter 升格为独立 owner

## 定位

本图只描述 AI Ability Group 内部的本地运行时分工、模型角色和提示词注册边界。

它不是第二个 AI 主权文件。

## AI 角色

- visual-observation：视觉观察与结构化判断
- ocr-extraction：文字提取与 OCR 清洗
- comment-analysis：评论理解与结构化总结
- evidence-summary：多源证据归纳与结构化输出

## 请求元数据

每次 AI 请求至少携带：

- abilityGroupId
- childAbilityId
- taskType
- promptContractId
- promptVersion
- schemaVersion
- evidenceRefs
- sessionId
- roundId
- videoVisitId
- providerPolicy
- costPolicy
- dataPolicy

## 主权边界

- AI public owner：src/capabilities/ai
- local runtime internals：src/lib/local-ai
- internal runtime adapter：src/capabilities/ai/runtime-adapters/local-ai-runtime-adapter.ts
- Screenshot 与多帧证据只提供输入，不拥有 AI 判断主权
- app、adapter、workbench 只能走 AI public contract
- 旧 LocalAiTaskRequest / Result / Type 只能在 internal bridge 内部映射
- 旧 LocalAi taskType 字面量也只能在 internal bridge 内部映射
- 只有 internal bridge 可以 import LocalAiGateway 与 prompt-registry

## 提示词原则

- 一个提示词只服务一个窄任务
- 输出必须结构化
- 多帧证据优先于单帧 opening 图
- 本地模型失败进入 retry、skip 或 review，不转云端

## 禁止边界

- 不保留 local-ai-runtime 独立主权叙事
- 不允许业务代码私藏 prompt
- 不允许 free-text AI 输出直接驱动平台动作
- 不允许 verify 脚本作为 AI 验收链
- 不允许 capability-check 作为 readiness 或验收主链
- 不允许把旧 LocalAi taskType 泄漏回 AI public contract
- 不允许 AI root 保留 prompt-contract shortcut
- 不允许 AI root 保留 legacy LocalAi result translator

## 审计与验收

- 当前 owner：ai-capability
- 施工边界：src/capabilities/ai/** 与 src/lib/local-ai/**
- 负向证明：若出现 app 直连模型、外部代码直连 prompt-registry、或 local-ai-runtime 被写成独立主权，则本施工图失效并判定漂移

验收信号：

建对表现：

- AI 请求可回溯到能力组与子能力
- 模型角色明确且可替换
- 提示词和 schema 版本可审计
- taskType 到旧 LocalAiTaskType 的映射只出现在 internal bridge

漂移信号：

- app 或 adapter 直连模型
- 一个 prompt 服务多个无关任务
- 文档把 local runtime 写成 AI 主权
- 外部代码直接 import src/capabilities/ai/children/**
