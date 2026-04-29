# GrassEye Orchestration 总指挥能力组施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 13 个 active ability groups 与 4 个 active support laws，不重新分配主权。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 定位

Orchestration 是总调度能力组。

它负责：

- 接收来自 Commander Console 的受治理 mission command
- 选择作战地图
- 推进 mission state 与 step state
- 通过 Nerve Bus 调度能力组

它不是人工命令入口，也不是浏览器动作 owner。

## 主职责

- select-operational-map
- dispatch-step-through-nerve-bus
- advance-mission-state
- evaluate-branch
- finalize-round

## 调用边界

- 人类命令先进入 Commander Console
- Commander Console 再把 governed mission command 交给 Orchestration
- Orchestration 只通过 Nerve Bus 下发命令和接收结果
- 作战地图只描述 route，不直接执行能力

## 禁止职责

- 不直接接住人类命令
- 不绕过 Nerve Bus 直连子能力实现
- 不复活 browse-flow 长流程
- 不复活 agent-runtime 旧主权
- 不使用 verify 脚本作为验收链

## canonical root

- src/capabilities/orchestration
- scripts/audit/domains/orchestration-capability
- .github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md

## 验收信号

建对表现：

- task command 先到 Commander Console
- Orchestration 只持有 mission truth 和 map truth
- 所有执行流都通过 Nerve Bus

漂移信号：

- workbench 或 runtime helper 直接推进 step
- 文档重新把浏览决策树写成主权文件
- verify 脚本重新充当能力验收
