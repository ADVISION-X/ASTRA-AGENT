# 《GrassEye 本地模型选型施工图》

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 13 个 active ability groups 与 4 个 active support laws，不重新分配主权。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 基本身份

- 从属权威：
  - .github/instructions/cursor-rules/modules/module-ai-capability.instructions.md
  - .github/instructions/cursor-rules/modules/module-local-ai-runtime.instructions.md
- 角色：本地模型角色、推荐配置与失败策略的建造级映射，不是第二法案

## 一句话原则

第三阶段使用受治理的本地模型角色配置：visual-observation、ocr-extraction、comment-analysis、evidence-summary 各有明确本地执行角色；模型不可用时进入 retry、skip 或 review，不自动转云端。

付费与未来 API provider 默认 disabled_by_policy，没有显式政策门不得执行。

## 角色矩阵

| 角色 | 配置 key | 作用 | 失败策略 |
| --- | --- | --- | --- |
| visual-observation | visual-observation | 视觉观察与结构化判断 | retry / operatorReview |
| ocr-extraction | ocr-extraction | 文字提取与 OCR 清洗 | retry / operatorReview |
| comment-analysis | comment-analysis | 评论理解与结构化总结 | skip / operatorReview |
| evidence-summary | evidence-summary | 多源证据归纳与输出 | candidateReview / operatorReview |

## 配置原则

- provider 必须 local-only
- executionMode 必须 local-only
- promptVersion 和 schemaVersion 必须显式绑定
- allowCloudFallback 必须 false
- allowMock 不得作为 phase-three acceptance
- paid provider 默认 disabled_by_policy
- 即使 allowPaidProvider = true，没有 allowExternalTransmission、maxEstimatedCost、operatorApprovalRef、provider allowlist 也不得执行

## 主权边界

- AI public owner：src/capabilities/ai
- local runtime internals：src/lib/local-ai
- internal runtime adapter：src/capabilities/ai/runtime-adapters/local-ai-runtime-adapter.ts
- config source：config/local-ai.models.json
- public prompt metadata entrance：AI ability-group getPromptContract(taskType)

## 禁止边界

- 不保留 cloud / paid-api fallback
- 不把 local-ai-runtime 写成独立主权
- 不把模型名散落在业务代码里
- 不允许 verify 脚本作为模型治理主链
- 不允许 paid provider 通过隐式 fallback 偷跑
- 不允许 bridge/compat/legacy 多套映射并存
- 不允许 prompt-contract shortcut 或 LocalAi legacy adapter 继续留在 AI root

## 验收信号

建对表现：

- 四个角色完整
- provider 为 local-only
- gateway 从配置读角色
- paid / future provider 可见但默认不可执行

漂移信号：

- 缺角色
- 业务代码硬编码模型名
- 文档把模型选型写成第二主权文件
- 付费策略缺 operator approval 和成本上限
