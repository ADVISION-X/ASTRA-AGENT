# 《GrassEye 唯一启动入口与终端结构化日志施工图》

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 13 个 active ability groups 与 4 个 active support laws，不重新分配主权。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 基本身份

- 从属权威：
  - .github/instructions/cursor-rules/modules/module-startup-entrypoint.instructions.md
  - .github/instructions/cursor-rules/modules/module-local-app-shell.instructions.md
  - .github/instructions/cursor-rules/modules/module-commander-console-capability.instructions.md
  - .github/instructions/cursor-rules/modules/module-structured-logging.instructions.md
  - .github/instructions/cursor-rules/modules/module-forensics-persistence-capability.instructions.md
  - .github/instructions/cursor-rules/modules/module-audit-system.instructions.md
- 角色：Commander Console 子边界下的唯一启动来源与终端结构化日志显示通道施工图
- 原则：启动脚本只负责把系统拉起、打开 Commander Console、显示终端结构化日志
- 版本：1.0

## 唯一定位

唯一 canonical entrypoint：scripts/startup/launch-grasseye.mjs

唯一用户启动命令：package.json -> grasseye:start

Startup Entrypoint 不是：
- Commander Console
- Orchestration
- Nerve Bus
- Capability Group
- Forensics Persistence

## 边界矩阵

| 边界对象 | Startup 可以做 | Startup 不可以做 |
| --- | --- | --- |
| Commander Console | 打开本地 Commander Console URL | 替人下命令、拥有控制台 read model |
| Orchestration | 不直接接触 | start mission、pause、resume、stop、改 mission state |
| Nerve Bus | 不直接接触 | 发送 command envelope、处理 result envelope |
| AI Runtime | 检查本地 runtime readiness | 执行业务推理任务 |
| Capability Groups | 不直接接触 | 直接调用 open、screenshot、click、scroll 等子能力 |
| Forensics Persistence | 只读消费 runtime logs API | 写 evidence packet、browse ledger、failed record |
| Structured Logging | 显示结构化摘要 | 夺取 schema 或持久化主权 |

## 启动顺序

1. 检查 Node / npm / package 依赖状态。
2. 检查并清理 canonical localhost 端口。
3. 启动本地应用服务进程。
4. 等待健康接口 PASS。
5. 打开 Commander Console 本地 URL。
6. 检查本地 AI runtime 可达性，但不跑任务。
7. 启动终端结构化日志转播。
8. 在终端输出最终启动摘要和等待人工命令状态。

## 启动禁止项

- 不直接 start mission。
- 不直接 pause / stop / resume mission。
- 不直接调用能力组或能力组子能力。
- 不直接调用 BrowserController。
- 不直接写 final evidence packet。
- 不直接写 browse ledger。
- 不直接运行 scripts/verify。
- 不把 smoke / acceptance 当作启动治理替代品。

## Commander Console 页面边界

- 启动脚本打开的页面必须是 Commander Console 本地页面。
- 启动脚本不得把旧 workbench、旧 operator-control 页面当成新的 owner truth。
- Local App Shell 负责渲染壳层；Commander Console 负责人的驾驶舱和命令入口。

## 终端结构化日志格式

TerminalStructuredLogEvent 字段：
- timestamp
- level: PASS | FAIL | EVENT
- phase
- component
- eventType
- status
- message
- failureReason
- refs
- durationMs

建议输出样式：

```text
[GRASSEYE][STARTUP][EVENT] dependency_check started
[GRASSEYE][STARTUP][PASS] dependency_check passed durationMs=...
[GRASSEYE][SERVICE][EVENT] app_server starting port=...
[GRASSEYE][SERVICE][PASS] app_server ready url=...
[GRASSEYE][COMMANDER][PASS] console reachable url=...
[GRASSEYE][AI][EVENT] local_ai_readiness checking
[GRASSEYE][AI][PASS] local_ai_readiness reachable
[GRASSEYE][RUNTIME][EVENT] waiting_for_human_command ready
```

## 日志主权划分

- Terminal logs = 显示通道
- Structured Logging = 日志纪律与字段规范
- Forensics Persistence = 真实记账主权
- Commander Console = 人看的页面

## 失败处理

- 任何 bootstrap hard failure 都必须输出 failureReason。
- 任何 hard failure 都不得伪装成 warning。
- 健康检查失败必须退出非 0。
- 页面自动打开失败可以提示手动 URL，但不得掩盖服务失败。

## 子进程生命周期

- startup 只能管理本轮自己拉起的子进程。
- 接收 SIGINT / SIGTERM 时必须停止本轮服务子进程。
- 如果端口清理失败，必须直接失败并输出剩余 PID。
- 不允许留下隐藏的 compat 启动器或第二启动入口。

## 执法与验收

- startup 子边界由 commander-console-capability inspector 以 startup child-contract checker 身份统筹执法。
- 启动治理的最终判定必须通过 audit runner。
- verify 脚本、smoke 脚本、acceptance 脚本都不是 startup owner proof。