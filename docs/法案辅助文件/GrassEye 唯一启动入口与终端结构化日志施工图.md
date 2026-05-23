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
-> hot-mount GET /api/health probe
-> port clear when no healthy workbench is mounted
-> app server start when no healthy workbench is mounted
-> GET /api/health readiness probe for started service
-> open local workbench page
-> structured terminal report
```

## 启动职责

- 检查 Node / npm / dependency 状态。
- 可选执行受控 update preflight。
- 启动前先探测现有 `/api/health`，健康则热挂载现有 workbench。
- 现有端口不健康时，真实清理本地 app server 端口。
- 未热挂载时启动本地 HTTP workbench。
- 用 `/api/health` 证明 app shell readiness。
- 在 readiness 通过后打开本地 workbench URL。
- 输出结构化终端日志和明确 failureReason。

## 端口清理

端口清理必须是真实运行路径，不是日志占位：

- 读取配置端口上的 TCP LISTEN 进程。
- 先发 `SIGTERM`。
- 再复查剩余监听进程。
- 仍未释放时发 `SIGKILL`。
- 最后再次复查端口。
- 端口仍被占用时启动失败，并输出 remaining PID 作为 `failureReason`。

健康的热挂载 workbench 不得被端口清理误杀。

## 热挂载

热挂载用于代码迭代期间复用已经健康的本地 workbench：

- 在清理端口前，先探测 `${baseUrl}/api/health`。
- `/api/health` 返回 HTTP OK 且 source fingerprint 匹配当前源码时，不启动第二个 app server。
- `/api/health` 健康但 source fingerprint 缺失或不匹配时，视为旧内存代码，不得 hot-mount，必须进入端口清理和单一启动链。
- 热挂载只打开 workbench 页面并输出 structured ready report。
- 热挂载不证明 job readiness、AI readiness、evidence truth 或 CI truth。
- `/api/health` 不可达或返回非 OK 时，进入端口清理和单一启动链。

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
- 启动脚本是否在清理端口前支持 hot-mount health probe。
- 启动脚本是否通过真实 listener discovery / terminate / post-check 完成端口清理。
- 启动脚本是否避免健康 workbench 被重复重启。
- 启动脚本是否启动 local app server 并打开 workbench。
- 启动脚本是否仍包含 registry readiness hard gate、AI readiness hard gate、CI/audit/acceptance/typecheck 调用、job flow 或能力调用。
- 启动日志是否保留结构化字段和 failureReason。
