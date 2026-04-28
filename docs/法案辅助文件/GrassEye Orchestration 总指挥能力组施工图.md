# GrassEye Orchestration 总指挥能力组施工图

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
