# GrassEye Map Prompt Contract Governance 施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射，不新增能力组，不修改 14 个 active ability groups。
- 本文件服从现行 kernel、map-plugin-package、ai-capability、orchestration-capability、audit-system 与 security-privacy 法案。
- Prompt Contract Governance 是跨边界治理契约，不是新 owner，不是新执行链。

## 架构定位

当前正式架构：

Static Capability Package Architecture
+ Pluginized Map Package Architecture
+ Map-Driven Prompt Contract Architecture
+ Nerve Bus Governed Transport
+ Forensics-backed Runtime Proof

中文定义：

- 静态能力组包架构
- 插件化地图包架构
- 地图驱动提示词契约架构
- Nerve Bus 受治理运输架构
- Forensics 运行证明架构

## 核心原则

1. 地图决定流程。
2. Prompt Contract 决定每一步如何向 AI 提问。
3. 能力组决定如何执行。
4. Orchestration 决定如何分支。
5. Nerve Bus 只运输。
6. Forensics 负责运行证明。
7. 地图和 Prompt Contract 都可以新增，但都必须先经过 schema、validator、review gate 和 inspector。
8. 禁止把地图硬编码进 Orchestration。
9. 禁止把 prompt 硬编码进 Orchestration、AI runtime、task router 或 map adapter。
10. 禁止 AI-generated map 直接 active。

## Owner 边界

### Map Plugin Package

负责：

- map package schema
- prompt binding 声明
- import、quarantine、validation、approval、activation、rollback 生命周期
- AI-generated map draft/quarantine 管理

不负责：

- 不拥有 prompt 内容
- 不执行 prompt
- 不直接调用 AI
- 不直接调用能力组

### AI Capability

负责：

- Prompt Contract Catalog
- Prompt Contract Registry
- promptContractId 解析
- output schema 约束
- confidence、review、failure、debug policy

不负责：

- 不选择地图
- 不推进 mission step
- 不执行点击、输入、滚动、打开页面

### Orchestration

负责：

- 从 active approved map 消费 promptContractId
- 把 promptContractId 与 inputRefs 通过 Nerve Bus 发送给 AI
- 只按 outputSchemaRef 声明字段做分支

不负责：

- 不保存 raw prompt 文本
- 不拼 raw prompt
- 不选择模型内部 prompt 内容

### Nerve Bus

负责：

- 运输 promptContractId
- 运输 inputRefs
- 运输 AI result 与 proof

不负责：

- 不解释 prompt 业务语义
- 不判断 prompt 是否合理

### Forensics Persistence

负责：

- 记录 mapId、packageId、activationId、stepId
- 记录 promptContractId、promptHash、outputSchemaRef
- 记录 AI request debug 和 AI response debug 引用
- 记录 validation、approval、activation proof

不负责：

- 不生成 prompt
- 不决定流程
- 不生成 AI 结论

### Commander Console

负责：

- 展示验证结果
- 展示 prompt contract 摘要
- 发起人工审核与批准

不负责：

- 不私自激活地图
- 不私自修改 prompt
- 不绕过 validator

### Audit System

负责：

- 通过 AST、schema、reference、negative proof 执法
- 阻断 prompt contract drift 和 map binding drift

## Prompt Binding Schema

地图中的每个 AI step 至少声明：

- stepId
- promptContractId
- requiredInputRefs
- expectedOutputSchema
- confidencePolicy
- reviewPolicy
- failureBranch

禁止字段：

- rawPrompt
- systemPrompt
- userPrompt
- executablePromptLogic
- handler
- functionBody

## Prompt Contract Schema

每个 Prompt Contract 至少声明：

- promptContractId
- taskType
- modelRole
- inputContract
- requiredInputRefs
- outputSchemaRef
- forbiddenOutputs
- confidencePolicy
- reviewPolicy
- failurePolicy
- debugPolicy
- promptHash

## Capability Catalog Schema

Capability Catalog 是 generated read model，至少包含：

- abilityGroupId
- childCapabilityId
- displayName
- description
- inputSchemaRef
- outputSchemaRef
- routableByMap
- requiresGeometryProof
- requiresPostActionVerification
- requiresReviewGate
- sensitiveOperation
- supportedTargets
- forbiddenResponsibilities

## Map Authoring Prompt Builder

输入：

- userRequirement
- capabilityCatalog
- promptContractCatalog
- mapPackageSchema
- securityPolicy
- outputFormat

输出：

- 给高级 AI 的候选地图生成提示词

强制要求：

- 只能引用 catalog 中存在的 abilityGroupId 与 childCapabilityId
- 只能引用 catalog 中存在的 promptContractId
- 超出能力范围时输出 needsCapabilityExpansion
- 范围不清时输出 requiredClarifications
- 只输出候选 map package JSON，不执行、不激活

## AI-generated Map 生命周期

流程固定为：

draft -> quarantine -> schema validation -> capability validation -> prompt contract validation -> safety validation -> human approval -> activation

强制要求：

- aiGenerated=true 默认 draft
- approvalStatus 未通过前不得 active
- availabilityPolicy 未批准前不得 active
- activation 必须留下 activationId 和 humanApprovalRef

## Validator Gates

- AI step 必须声明 promptContractId
- promptBinding 必须匹配 AI step
- promptContractId 必须存在于 Prompt Contract Catalog
- requiredInputRefs 必须可由前序 step 产生
- outputSchemaRef 必须存在
- branch condition 只能引用 outputSchema 中声明字段
- sensitive task 必须有 review gate
- map package 不得携带 raw prompt 或 executable logic

## Review Gates

以下场景必须 review_required：

- 低置信度
- schema validation 失败
- prompt policy 违规
- 敏感任务涉及发送、删除、购买、提交或修改用户数据

## Forensics Proof

至少记录：

- mapId
- packageId
- activationId
- stepId
- promptContractId
- promptHash
- outputSchemaRef
- authoringPromptRef
- authoringModelRef
- capabilityCatalogVersion
- promptCatalogVersion
- validationReportRef
- humanApprovalRef

## Negative Proof

至少覆盖：

- 删除 promptContractId
- 删除 prompt binding
- 使用不存在的 promptContractId
- 删除 outputSchemaRef
- 注入 forbidden action
- 在 map package 注入 rawPrompt
- 在 Orchestration 或 AI runtime 注入硬编码 prompt
- 伪造 aiGenerated=false 或 approvalStatus=approved

## READY Gate

只有同时满足以下条件才算 ready：

- 法案边界完成
- Prompt Contract Catalog 完成
- Capability Catalog 完成
- Map Authoring Prompt Builder 完成
- Validator 完成
- Audit domain 完成
- Negative proof 完成
- generated map 仍然 draft/quarantine

## 红线

- 禁止新增 map-prompt-contract 能力组
- 禁止修改 14 个 active ability groups
- 禁止硬编码地图
- 禁止硬编码 prompt
- 禁止 AI 直接执行动作
- 禁止 AI-generated map 直接 active