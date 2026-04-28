# GrassEye 能力组与子能力总纲施工图

## 定位

GrassEye 现在只允许能力组模式。

GrassEye = 13 个能力组 + 子能力 + Commander Console + Orchestration + Nerve Bus + Debug 运行证明 + Forensics Persistence。

## 总原则

- 子能力只归属一个父能力组
- 能力组只暴露公开 contract，不暴露子实现
- Nerve Bus 只运输受治理 envelope
- Orchestration 只编排，不执行具体动作
- Commander Console 只发令、看证据、控制模式，不抢 runtime
- 能力组之间只能通过公开 contract 和结构化证明协作
- 禁止 compat、legacy、bridge、双真相文本
- 禁止旧 Agent 长流程和 visual action 复合链

## 固定架构链

Capability Group -> Child Capability -> Nerve Bus -> Orchestration -> Commander Console -> Forensics Evidence

## 当前激活能力组

| abilityGroupId | 作用 | lawOwner |
| --- | --- | --- |
| commander-console | 人工命令入口与控制台真相 | commander-console-capability |
| orchestration | mission state、地图和 branch 决策 | orchestration-capability |
| nerve-bus | 受治理 envelope 运输 | nerve-bus-capability |
| ai | AI public contract 与子能力分发 | ai-capability |
| open | 打开目标 | open-capability |
| screenshot | 统一截图与 AI 输入准备 | screenshot-capability |
| visual-target | 视觉目标结果归一化 | visual-target-capability |
| geometry-guard | 几何校准与坐标 readiness | geometry-guard-capability |
| mouse-click | 点击 primitive | mouse-click-capability |
| mouse-scroll | 滚动 primitive | mouse-scroll-capability |
| post-action-verification | 判断动作结果 | post-action-verification-capability |
| forensics-persistence | 公共写账 | forensics-persistence-capability |
| page-state | 当前页面状态判断 | page-state-capability |

## 支持边界

- platform-action：平台 profile / hints，不拥有动作执行权
- local-ai-runtime：AI Capability 子能力内部运行时
- local-persistence-schema：Forensics Persistence 内部 schema 子契约
- local-app-shell：Commander Console 子能力壳层
- local-browser-session：Open Capability 子能力前置边界
- structured-logging：runtime proof minimum contract，与 Forensics evidence 回连

当前不进入 active owner 链：

- localization：保留为后续可重开议题，不参与当前 phase-gate 与 audit owner 链
- 旧 local-data：职责已并入 Forensics Persistence 与 Local Persistence Schema，不再保留独立 owner

## 禁止边界

- 不保留 coordinate-action 独立能力组
- 不保留 agent-runtime、browse-flow、mechanical-skills、visual-action、visual-only-runtime、evidence-packet、operator-control、product-signal、comment-intelligence、vision-boundary 主权
- 不允许 verify 脚本充当能力验收

## 验收信号

建对表现：

- 只有 13 个 active ability groups
- support 边界不再抢占能力主权
- 目录拓扑与 owner 边界一致
- 每次能力执行都有 input、output、status、error、evidenceRef、timestamp
- 所有旧链只剩禁止项，不再是 active route

漂移信号：

- 再次出现旧 owner 表格
- support 边界升级成 public owner
- 文档重新写出 visual action 或 agent long flow
- topology contract 不再由 capability-group-governance 统一执法
