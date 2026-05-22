# GrassEye 唯一启动入口与终端结构化日志施工图

版本：2026-05-22
状态：active

## 启动身份

启动是 GrassEye 的山门。

山门负责开门、点灯、确认道观能进。山门不替小道士走法门，不判断业务步骤，
不操作浏览器动作，不证明账本真相，也不敲完整质检钟。

## 唯一入口

用户启动命令：

```txt
npm run grasseye:start
```

唯一入口脚本：

```txt
scripts/startup/launch-grasseye.mjs
```

## 启动顺序

```txt
dependency check
-> optional update preflight
-> port clear
-> app server start
-> GET /api/health readiness probe
-> open local workbench page
-> structured terminal report
```

## 启动职责

- 检查 Node / npm / dependency 状态。
- 可选执行受控 update preflight。
- 清理本地 app server 端口。
- 启动本地 HTTP workbench。
- 用 `/api/health` 证明 app shell readiness。
- 在 readiness 通过后打开本地 workbench URL。
- 输出结构化终端日志和明确 failureReason。

## 启动禁止

- 不运行 Amazon / Facebook / 任何 job flow。
- 不调用 DOM、browser、upload、click、fill、wait、verify 子能力。
- 不调用 AI judgment，不声明 provider mission-ready。
- 不运行 `ci:full`、acceptance、typecheck、audit owner。
- 不要求旧 registry readiness。
- 不把首页 HTML 当作 primary readiness。
- 不把日志当作 evidence 或 task status truth。

## 终端结构化日志字段

- `phase`
- `component`
- `eventType`
- `status`
- `message`
- `refs`
- `durationMs`
- `failureReason`

## 失败报告

启动失败必须说明：

- 失败阶段。
- 失败组件。
- 失败原因。
- 用户下一步可执行动作。

失败报告只能帮助人修启动问题，不能把业务流程失败伪装成启动失败。

## 质检对口

startup-entrypoint owner inspector 检查：

- `package.json` 是否暴露 `grasseye:start`。
- `grasseye:start` 是否指向 `scripts/startup/launch-grasseye.mjs`。
- 启动脚本是否探测 `/api/health`。
- 启动脚本是否启动 local app server 并打开 workbench。
- 启动脚本是否仍包含 registry readiness hard gate、AI readiness hard gate、CI/audit/acceptance/typecheck 调用、job flow 或能力调用。
- 启动日志是否保留结构化字段和 failureReason。
