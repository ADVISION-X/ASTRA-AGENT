# 《GrassEye 本地化施工图》

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 14 个 active ability groups、5 个 foundation laws、1 个 support governance domain；若与 Kernel / Index / 法案冻结基线冲突，以 Kernel / Index / 冻结基线为准。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 基本身份

- 从属法案：GrassEye 法案冻结基线、Commander Console 子边界、Local App Shell 子边界
- 角色：已退役主题的冻结告警说明
- 原则：只记录 localization 不得回流，不为 localization 重建治理入口

## 当前状态

本施工图在本轮治理迁移后不再对应 active owner、active law 或 active inspector。

当前结论：

- localization 不进入当前 capability group 主链。
- localization 不进入 phase-gate。
- localization 不进入 generated audit plan。
- localization 不保留独立 owner manifest 与 inspector。

## 当前归位

- Commander Console 与 Local App Shell 可以继续消费本地字典或 UI copy helper。
- 这类实现细节不得反向生成 `localization` 独立治理宇宙。
- 若未来重开多语言治理，必须以新的批准轮次显式重建，而不是恢复 GRASSEYE-LOCALIZATION-001-V1 或 GRASSEYE-LOCALIZATION-002-V1。

## 禁止回流

- 恢复 localization owner manifest。
- 恢复 localization inspector。
- 把 localization 写回 active support law 表、phase-gate 或 generated plan。
- 让 UI copy 议题绕过 Commander Console / Local App Shell 边界，重新形成独立 owner。

## 审计与验收

- 审计结论：只要 active support law、phase-gate、generated audit plan 或 runner 再次出现 localization，即判定失败
- 负向证明：仓库内不应再存在 localization owner manifest、独立 inspector、独立 runner 或回流后的 lawId