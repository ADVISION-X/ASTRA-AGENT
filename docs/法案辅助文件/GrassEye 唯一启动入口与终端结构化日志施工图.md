# 《GrassEye 唯一启动入口与终端结构化日志施工图》

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 active ability groups 与 foundation laws；若与现行法案冲突，以现行法案为准。
- Startup 只负责把系统拉起、打开 Commander Console、显示终端结构化日志，不得借此恢复旧流程包、retired deterministic flow、retired binding state 等旧主权。

## 基本身份

- 从属权威：
  - .github/instructions/cursor-rules/modules/module-startup-entrypoint.instructions.md
  - .github/instructions/cursor-rules/modules/module-local-app-shell.instructions.md
  - .github/instructions/cursor-rules/modules/module-commander-console-capability.instructions.md
  - .github/instructions/cursor-rules/modules/module-structured-logging.instructions.md
  - .github/instructions/cursor-rules/modules/module-forensics-persistence-capability.instructions.md
- 角色：Commander Console 子边界下的唯一启动来源与终端结构化日志显示通道施工图
- 原则：启动脚本只负责 bootstrap、registry readiness、local AI readiness、打开 Commander Console

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
| Registry Truth | 检查 single AI prompt contract / MuscleMemoryCatalog / PlatformRegistry 可读 | 选图、选 route、造 prompt body |
| Capability Groups | 不直接接触 | 直接调用 open、screenshot、click、scroll 等子能力 |
| Forensics Persistence | 只读消费 runtime logs API | 写 evidence packet、browse ledger、failed record |
| Structured Logging | 显示结构化摘要 | 夺取 schema 或持久化主权 |

## 启动顺序

1. 检查 Node / npm / package 依赖状态。
2. 执行 update_preflight_check。
3. 执行 ai_prompt_contract_check。
4. 执行 muscle_memory_catalog_check。
5. 执行 platform_registry_check。
6. 检查本地 AI runtime presence。
7. 检查 required local AI model roster。
8. 启动或连接 governed local AI runtime。
9. 执行 local AI health probe 与 ai_capability_readiness_gate。
10. 检查并清理 canonical localhost 端口。
11. 启动本地应用服务进程。
12. 等待 Commander Console shell probe PASS。
13. 打开 Commander Console 本地 URL。
14. 标记 mission runtime available。
15. 启动终端结构化日志转播并进入等待人工命令状态。

## Registry Startup Readiness Gate

### 目标

启动链必须在 app server 子进程启动前证明单一 AI prompt contract、MuscleMemoryCatalog、PlatformRegistry 三个现役治理真相可读。坏治理真相不得等到运行期才以隐式错误形式暴露。

### 正确链路

```txt
grasseye:start
→ dependency_check
→ update_preflight_check
→ ai_prompt_contract_check
→ muscle_memory_catalog_check
→ platform_registry_check
→ local_ai_runtime_presence_check
→ ai_capability_readiness_gate
→ app_server start
→ Commander Console shell probe
```

### 禁止链路

```txt
update_preflight_check passed
→ app_server start
→ runtime first mission access throws missing prompt/action/platform truth
```

### readiness 输出必备字段

```txt
ownerResponsible
failureReason
actionableMessage
refs:
  registryPath
  expectedContract
  missingKey when applicable
durationMs
```

### READY 标准

Startup READY 只有在 registry gate、local AI gate、Commander Console shell probe 都通过后才能输出 mission_runtime_available。

## Local AI Startup Readiness Gate

### 目标

GrassEye 启动链必须先确认本地 AI 运行环境和模型角色可用，再开放 mission runtime。

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
本地开发工具不得绕过生产启动链。
Commander 在 AI 未就绪时开放可运行 mission surface。
AI 不可用时 fallback 到 fake success。
启动程序直接做 AI 判断或 prompt inference。
```

## Startup Platform Governance

### 目标

启动链必须保持 shell-neutral，只负责 bootstrap 与 readiness；平台绑定属于 mission start，不属于 startup。

### 允许

```txt
grasseye:start 在未提供任何平台参数时直接完成 shell bootstrap。
startup 把 startup readiness JSON 交给 app server，供 Commander 直接显示 missionRuntimeAvailable 与 failureReason。
mission requestedPlatform 只能来自 governed mission command。
```

### 禁止

```txt
grasseye:start 在 bootstrap 期间要求操作者做 Facebook/TikTok 二选一。
startup 用 --platform、env、readline prompt、结构化日志事件等形式重建启动期平台门禁。
startup 写死某个平台。
startup 恢复 retired selection field、legacy route-plan field、retired binding field、retired branch-token field 等字段。
Commander 通过重新探测或临时推断来替代 mission truth。
```

## 终端结构化日志

终端只显示：

```txt
startup phase
component
eventType
status
message
refs
durationMs
failureReason
```

终端不得成为：

```txt
第二套 evidence store
第二套 mission truth
第二套 readiness truth
```
