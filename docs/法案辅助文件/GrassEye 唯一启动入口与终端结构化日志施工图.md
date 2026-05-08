# 《GrassEye 唯一启动入口与终端结构化日志施工图》

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 14 个 active ability groups、5 个 foundation laws、1 个 support governance domain；若与 Kernel / Index / 法案冻结基线冲突，以 Kernel / Index / 冻结基线为准。
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
2. 执行 update_preflight_check。
3. 执行 map_package_readiness_check，验证内置 map package 可解析、可导入、可通过 development bootstrap 激活门禁。
4. 检查本地 AI runtime presence。
5. 检查 required local AI model roster。
6. 启动或连接 governed local AI runtime。
7. 执行 local AI health probe 与 ai_capability_readiness_gate。
8. 检查并清理 canonical localhost 端口。
9. 启动本地应用服务进程。
10. 等待 Commander Console shell probe PASS。
11. 打开 Commander Console 本地 URL。
12. 标记 mission runtime available。
13. 启动终端结构化日志转播并进入等待人工命令状态。

## Map Package Startup Readiness Gate

### 目标

启动链必须在 app server 子进程启动前证明内置 map package 能通过同一套 schema 与 registry bootstrap 门禁。坏包不得等到 app shell health 阶段才以 Zod stack 形式暴露。

### 正确链路

```txt
grasseye:start
→ dependency_check
→ update_preflight_check
→ map_package_readiness_check
→ local_ai_runtime_presence_check
→ ai_capability_readiness_gate
→ app_server start
→ Commander Console shell probe
```

### 禁止链路

```txt
update_preflight_check passed
→ app_server start
→ readBuiltin throws raw ZodError
→ Commander Console shell probe之前才暴露 map package readiness 失败
```

### readiness 输出必备字段

```txt
ownerResponsible=map-plugin-package
failureReason
actionableMessage
refs:
  packageFile
  expectedPackageKind
  receivedPackageKind
  packageId when available
durationMs
```

### inspector 覆盖

Commander startup gate inspector 必须证明：

```txt
launch-grasseye.mjs imports ensureMapPackageReadiness
performLaunch calls ensureStartupMapPackageReadiness after update_preflight_check and before local_ai_runtime / app_server start
map-package-readiness.mjs delegates to map-package-readiness-probe.ts
map-package-readiness-probe.ts loads builtin packages and exercises registry bootstrap through governed source modules
failure logs preserve ownerResponsible and actionableMessage
```

### negative proof 覆盖

必须 fail → rollback → pass：

```txt
remove ensureStartupMapPackageReadiness from performLaunch
point map-package-readiness.mjs at an inline/bypassing probe
remove ownerResponsible/actionableMessage from startup map package readiness path
```

### READY 标准

Startup READY 只有在 map package readiness gate、local AI gate、Commander Console shell probe 都通过后才能输出 mission_runtime_available。

### hard failure bundle

任何 bootstrap hard failure 必须写入当前 runId 关联的最小 failure bundle：

```txt
tmp/debug-loop/startup-failures/<runId>/startup-failure.json
```

必备字段：

```txt
runId
baseUrl
ownerResponsible
failureReason
actionableMessage
writtenAt
```

该 bundle 只记录 startup failure 证据，不得执行 mission action，不得成为第二套 runtime。

## Local AI Startup Readiness Gate

### 目标

GrassEye 启动链必须先确认本地 AI 运行环境和模型角色可用，再开放 mission runtime。

### 标准启动链

```txt
grasseye:start
→ dependency_check
→ update_preflight_check
→ local_ai_runtime_presence_check
→ local_ai_model_roster_check
→ local_ai_start_or_connect
→ local_ai_health_probe
→ ai_capability_readiness_gate
→ local_app_service_start
→ commander_console_open
→ mission_runtime_available
```

### 允许

```txt
启动程序检查更新与依赖。
启动程序通过 governed helper + probe 调用本地 AI startup readiness contract。
启动程序启动或连接本地 AI runtime，但不做业务推理。
启动程序把 readiness 结果写入结构化启动日志。
Commander 展示 AI readiness 状态，但不绕过门禁。
```

### 禁止

```txt
业务能力组自己启动本地 AI。
Debug Loop 自己启动本地 AI 来代替生产启动链。
Commander 在 AI 未就绪时开放可运行 mission surface。
AI 不可用时 fallback 到 fake success。
启动程序直接做 AI 判断或 prompt inference。
```

### readiness 输出

```json
{
  "component": "local-ai-runtime",
  "status": "ready | failed | degraded",
  "runtimeBaseUrl": "http://127.0.0.1:11434",
  "detail": "LOCAL_AI_MODEL_MISSING; vision=missing:qwen2.5vl:3b",
  "modelRoles": [
    {
      "modelRole": "vision",
      "modelName": "qwen2.5vl:3b",
      "provider": "local",
      "runtime": "ollama",
      "health": "ready | missing | unhealthy",
      "failureReason": null
    }
  ],
  "missionRuntimeAvailable": false,
  "failureReason": "LOCAL_AI_MODEL_MISSING",
  "developmentOnly": false,
  "checkedAt": "2026-05-04T00:00:00.000Z"
}
```

### fail-closed

```txt
只要 required model role 不 ready：
missionRuntimeAvailable=false
Commander 不得打开 runnable mission surface
startup 必须输出 failureReason 并退出非 0
Debug Loop 只能记录 blocked，不能代替生产启动链
不得继续 mission runtime
```

## Startup Platform Target Governance

### 目标

启动链必须保持 shell-neutral，只负责 bootstrap 与 readiness；Facebook/TikTok 平台绑定属于 mission start、task template binding 和 orchestration，不属于 startup。

### 允许

```txt
grasseye:start 在未提供任何平台参数时直接完成 shell bootstrap。
app server 可以把缺失的 GRASSEYE_PLATFORM_TARGET 解析为 agent-shell，仅代表启动壳层，不代表 mission 平台绑定。
startup 把 startup readiness JSON 交给 app server，供 Commander 直接显示 missionRuntimeAvailable 与 failureReason。
mission requestedPlatformId 只能来自 start-mission payload、已批准 task template binding，或 orchestration 冻结后的 mission state。
```

### 禁止

```txt
grasseye:start 在 bootstrap 期间要求操作者做 Facebook/TikTok 二选一。
startup 用 --platform、GRASSEYE_PLATFORM_TARGET、readline prompt、结构化日志事件等形式重建启动期平台门禁。
package.json 的 internal:app-server:dev 写死 GRASSEYE_PLATFORM_TARGET=tiktok-web。
launch-grasseye.mjs 在 startService env 中透传或写死某个平台。
src/app/server.ts 因缺失 GRASSEYE_PLATFORM_TARGET 而 hard fail。
page-state 或其它 runtime slice 直接把 startup shell platform 当成 mission requestedPlatform 使用。
Commander 通过重新探测或临时推断来替代 mission/requestedPlatform 与 startup readiness 的受控来源。
```

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

### Runtime command rejection 字段补充

正确链路：

```txt
StructuredRuntimeEvent.ownerResponsible/actionableMessage/runId
-> StructuredRuntimeEvent.refs/proofRefs include commandEnvelopeRef/resultEnvelopeRef/runtimeProofRef when available
-> structured-log-payload
-> grasseye:event stdout payload
-> terminal-structured-log runtime relay
-> [GRASSEYE][RUNTIME][FAIL] COMMAND_REJECTED line
```

禁止链路：

```txt
COMMAND_REJECTED 只显示 failureReason/raw ZodError
runtime debug API COMMAND_REJECTED refs 为空，无法定位 command/result/proof 链
terminal relay 丢弃 ownerResponsible/actionableMessage
terminal relay 无 traceId/runId/selectedMapId/activationSnapshotRef
```

inspector 必须覆盖：

```txt
StructuredRuntimeEventSchema 包含 runId
structured-log-payload 输出 runId/ownerResponsible/actionableMessage
Commander debug event builder 必须允许 refs/proofRefs/inputRefs/outputRefs/artifactRefs 从 dispatch result 进入 StructuredRuntimeEvent
Task start dispatch result 必须从 runtimeProof 派生 commandEnvelopeRef/resultEnvelopeRef/runtimeProofRef
terminal runtime relay 输出 runId/ownerResponsible/actionableMessage/traceId/selectedMapId/activationSnapshotRef
```

negative proof 必须覆盖：

```txt
删除 terminal relay ownerResponsible/actionableMessage/runId 任一字段必须 FAIL
删除 structured-log-payload runId 必须 FAIL
删除 Commander debug refs/proofRefs 透传必须 FAIL
删除 task-start COMMAND_REJECTED runtimeProof refs 派生必须 FAIL
```

TerminalStructuredLogEvent 字段：
- timestamp
- level: PASS | FAIL | EVENT
- phase
- component
- eventType
- status
- message
- failureReason
- ownerResponsible
- actionableMessage
- traceId
- runId
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
