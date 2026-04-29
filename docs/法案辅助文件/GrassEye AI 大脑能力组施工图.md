# GrassEye AI 大脑能力组施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 13 个 active ability groups 与 4 个 active support laws，不重新分配主权。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 1. 定位

AI 是 GrassEye 的大脑能力组。

它负责思考、判断、提取、理解、归纳与结构化输出。

它不负责动作执行，不负责神经传输，不负责最终调度。

## 2. 人体比喻映射

- 人：最高任务来源
- Orchestration Ability Group：总指挥 / 小脑
- Nerve Bus Ability Group：神经网络
- AI Ability Group：大脑
- Open / Screenshot / Mouse / Platform Action 等能力组：身体器官与肢体

## 3. AI 能力组职责

- 接收受治理 AI 请求
- 根据 taskType 路由到合适 child capability
- 读取受治理 prompt contract
- 读取受治理 model roster
- 返回结构化 AI 结果与 runtime proof
- 暴露 AI health、child readiness、policy status

## 4. AI 能力组禁止职责

- 不点击
- 不滚动
- 不打开页面
- 不自己发送 Nerve Bus envelope
- 不决定整个 mission 下一步
- 不直接终结 round
- 不直接写最终 Evidence Packet 或 Candidate disposition
- 不直接写 AI result record、browse ledger、failed record
- 不拥有当前页面状态真相
- 不 import Forensics Persistence、features/local-data、types/evidence-packet
- 不出现 agent-runtime 作为 allowed caller 或 requestedBy

## 5. 子能力注册表

| childCapabilityId | 类型 | 作用 | 默认状态 |
| --- | --- | --- | --- |
| local-vision-ai | local | 本地视觉判断 | active |
| local-text-ai | local | 本地文本理解与归纳 | active |
| local-ocr-ai | local | 本地 OCR 清洗 | active |
| paid-vision-ai | paid | 未来付费视觉通道 | disabled_by_policy |
| paid-analysis-ai | paid | 未来付费分析通道 | disabled_by_policy |
| future-api-ai | future | 未来显式 API 预留通道 | disabled_by_policy |

## 6. 任务路由原则

- taskType 不等于 childCapabilityId。
- taskType 由 AI Ability Group 内部 task-router 决定归属。
- AI public taskType 固定为：
  - product_presence_judgment
  - visual_observation
  - visual_target_candidate_analysis
  - ocr_cleanup
  - comment_signal_summary
  - product_signal_summary
  - evidence_packet_analysis
  - schema_validation_only
- 当前路由：
  - product_presence_judgment -> local-vision-ai
  - visual_observation -> local-vision-ai
  - visual_target_candidate_analysis -> local-vision-ai
  - ocr_cleanup -> local-ocr-ai
  - comment_signal_summary -> local-text-ai
  - product_signal_summary -> local-text-ai
  - evidence_packet_analysis -> paid-analysis-ai（默认 disabled_by_policy）
  - schema_validation_only -> local-text-ai 或 AI 内部 schema validator
- 旧 LocalAi taskType 只允许在 runtime bridge 内部映射，不得作为 public contract。

## 7. public contract

AI Ability Group 对外至少暴露：

- listChildCapabilityIds()
- routeTask(taskType)
- execute(request)
- getHealth()
- getRuntimeHealth()
- getPromptContract(taskType)
- getModelRoster()

AI public index 只允许导出：

- createAiAbilityGroup
- AI_ABILITY_GROUP_ID
- AiAbilityInput / AiAbilityResult / AiTaskType / policy 类型
- getAiTaskRoutingTable
- loadAiModelRoster
- schema validators

AI public contract 最低字段：

- AiAbilityInput
  - abilityGroupId = ai
  - taskType
  - inputModality
  - inputRefs
  - promptContractId
  - expectedOutputSchema
  - requestedBy = orchestration
  - transportedBy = nerve-bus
  - sessionId
  - roundId
  - videoVisitId
  - qualityPolicy
  - providerPolicy
  - costPolicy
  - dataPolicy
  - safetyPolicy
- AiAbilityResult
  - status
  - abilityGroupId = ai
  - childCapabilityId
  - taskType
  - modelProvider
  - modelName
  - output
  - rawOutputRef
  - schemaValidationStatus
  - confidence
  - failureReason
  - durationMs
  - costEstimate
  - evidenceRefs
  - debugLogRef
  - runtimeProof

## 8. 与 local-ai-runtime 的关系

- src/capabilities/ai 是公开主权入口
- src/lib/local-ai 是内部执行边界
- src/capabilities/ai/runtime-adapters/local-ai-runtime-adapter.ts 是唯一 AI-owned runtime adapter
- prompt registry、model config、runtime adapters 可以继续留在 src/lib/local-ai
- workbench、runtime、finalizer 等外部模块必须走 AI Ability Group facade
- LocalAiTaskRequest / Result / Type 只允许留在 bridge 内部映射
- 旧 LocalAi taskType 字面量只允许留在 bridge 内部映射
- AI root 不允许保留 prompt-contract 快捷文件或 legacy result translator

## 9. 与总指挥和神经网络的边界

- Orchestration 只决定何时向 AI 发起请求
- Nerve Bus 只负责 Orchestration <-> AI 的传输
- AI 只返回结构化结果
- 动作能力组根据 Orchestration 决策执行物理动作

## 10. 结构化结果最低字段

- taskType
- modelProvider
- modelName
- promptVersion
- schemaVersion
- confidence
- evidenceRefs
- createdAt
- schemaValidationStatus
- runtimeProof

## 11. Debug 运行证明

AI 执行至少应可追到：

- abilityGroupId = ai
- childCapabilityId
- sessionId
- roundId
- videoVisitId
- startedAt
- endedAt
- durationMs
- status
- reason
- failureReason
- reviewRequiredReason
- inputRefs
- outputRefs
- evidenceRefs
- nextAbilityGroup
- nextChildAbility

## 12. canonical root

- src/capabilities/ai/contract.ts
- src/capabilities/ai/ability-group.ts
- src/capabilities/ai/registry.ts
- src/capabilities/ai/task-router.ts
- src/capabilities/ai/model-roster.ts
- src/capabilities/ai/schema-validation.ts
- src/capabilities/ai/runtime-adapters/local-ai-runtime-adapter.ts
- src/capabilities/ai/shared/*
- src/capabilities/ai/children/*

必须删除：

- src/capabilities/ai/runtime-task-execution.ts
- src/capabilities/ai/**/capability-check.ts
- AI root 下所有 verify* 函数
- src/capabilities/ai/prompt-contract.ts
- AI root 下所有 LocalAi legacy result mapping

## 13. 验收信号

建对表现：

- workbench、agent runtime、finalizer 从 AI facade 进入，而不是直连 LocalAiGateway 或 prompt-registry
- AI child registry 可见且可验证
- paid / future child 默认可见但关闭
- 文案与法案明确写出 AI 只思考不动手
- AI public index 不再导出 prompt-contract shortcut 或 LocalAi legacy adapter

漂移信号：

- 重新把 AI 写回 runtime helper
- feature 直接挑模型或直连 prompt registry
- paid API 作为隐形 fallback 出现
- child capability 被 task 名称替代
- AI public contract 继续复用 LocalAiTaskRequest / Result
- capability-check 或 verify 被当成验收链
- inspector 不是唯一执法入口