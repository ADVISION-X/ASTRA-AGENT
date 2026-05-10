# GrassEye 文件路径与阶段目录施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 14 个 active ability groups、5 个 foundation laws、0 个 support governance domains；若与 Kernel / Index / 法案冻结基线冲突，以 Kernel / Index / 冻结基线为准。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 定位

本图是 Capability Group Governance 的 topology 子契约。

本图只回答两件事：

- 哪些路径是 active 主权路径
- 哪些路径只是壳、adapter、consumer 或支持边界

## 代码路径主权

- 路由入口：src/app
- 能力组根目录：src/capabilities/<ability-group>
- 适配与消费层：src/features/**
- 共用基础设施：src/lib
- 跨域类型：src/types
- 审计：scripts/audit

## 当前 14 个能力组路径

| 能力组 | canonical path |
| --- | --- |
| commander-console | src/capabilities/commander-console |
| orchestration | src/capabilities/orchestration |
| nerve-bus | src/capabilities/nerve-bus |
| ai | src/capabilities/ai |
| open | src/capabilities/open |
| screenshot | src/capabilities/screenshot |
| visual-target | src/capabilities/visual-target |
| geometry-guard | src/capabilities/geometry-guard |
| mouse-click | src/capabilities/mouse-click |
| text-input | src/capabilities/text-input |
| mouse-scroll | src/capabilities/mouse-scroll |
| post-action-verification | src/capabilities/post-action-verification |
| forensics-persistence | src/capabilities/forensics-persistence |
| page-state | src/capabilities/page-state |

## 支持路径

- platform-action adapter：src/features/platform-action
- forensics storage port internals：src/capabilities/forensics-persistence
- local persistence schema internals：src/lib/storage 与 src/types
- local AI runtime internals：src/lib/local-ai
- browser session primitives：src/lib/browser
- laws：.github/instructions/cursor-rules
- blueprints：docs/法案辅助文件

## 禁止路径

- feature 目录充当能力组 public root
- lib 目录私藏第二套 ability contract
- deleted owner 继续作为 canonical path
- 兼容旧链、legacy 路径、bridge 路径
- 子能力跑到父能力组根目录之外
- cross-owner implementation import

## 验收信号

建对表现：

- 每个能力组只有一个 canonical root
- support paths 只承担支持职责
- 文档引用的是同一组 active 路径
- inspector 由 capability-group-governance owner 统一执行 topology checker
- CI 通过 `npm run ci:full` 和 `npm run ci:full` 复核 topology contract

漂移信号：

- 同一能力组同时出现在两个根目录
- deleted owner 名称继续出现在主权路径表
- platform-action 被写成能力主权
- code-topology 重新作为独立 owner 进入 phase-gate
