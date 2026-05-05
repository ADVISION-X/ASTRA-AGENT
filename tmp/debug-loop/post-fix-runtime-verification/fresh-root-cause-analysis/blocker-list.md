# Fresh Blocker List

## BLOCKER-POSTFIX-1: Local AI readiness timeout blocks real restart

Priority: P0 startup blocker.

### 1. 日志证据

```txt
[GRASSEYE][AI][FAIL] local_ai_runtime local_ai_runtime_presence_check failed LOCAL_AI_READINESS_TIMEOUT; vision=unhealthy:qwen2.5vl:3b; ocr=ready:apple-vision-or-paddleocr; commentUnderstanding=unhealthy:qwen2.5:3b; productSignal=unhealthy:qwen2.5:3b failureReason=LOCAL_AI_READINESS_TIMEOUT runId=2026-05-05T13:01:47.292Z refs=vision=unhealthy:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=unhealthy:qwen2.5:3b,productSignal=unhealthy:qwen2.5:3b durationMs=48406
[GRASSEYE][AI][FAIL] local_ai_runtime ai_capability_readiness_gate failed LOCAL_AI_READINESS_TIMEOUT; vision=unhealthy:qwen2.5vl:3b; ocr=ready:apple-vision-or-paddleocr; commentUnderstanding=unhealthy:qwen2.5:3b; productSignal=unhealthy:qwen2.5:3b failureReason=LOCAL_AI_READINESS_TIMEOUT runId=2026-05-05T13:01:47.292Z refs=vision=unhealthy:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=unhealthy:qwen2.5:3b,productSignal=unhealthy:qwen2.5:3b durationMs=48406
[GRASSEYE][STARTUP][FAIL] startup_entrypoint bootstrap_failed failed startup bootstrap failed failureReason="LOCAL_AI_READINESS_TIMEOUT: LOCAL_AI_READINESS_TIMEOUT; vision=unhealthy:qwen2.5vl:3b; ocr=ready:apple-vision-or-paddleocr; commentUnderstanding=unhealthy:qwen2.5:3b; productSignal=unhealthy:qwen2.5:3b" ownerResponsible=startup-entrypoint actionableMessage="Inspect startup structured logs and rerun npm run grasseye:start." runId=2026-05-05T13:01:47.292Z refs="startupFailureBundle=/Users/nexgen/Documents/GrassEye -AI-AGENT/tmp/debug-loop/startup-failures/2026-05-05T13-01-47-292Z"
```

- traceId: MISSING
- runId: `2026-05-05T13:01:47.292Z`
- attemptId: MISSING
- missionId: MISSING
- taskTemplateId: MISSING
- selectedMapId: MISSING
- requestedPlatformId: MISSING
- activationSnapshotRef: MISSING
- commandId / envelopeId: MISSING
- stepId: MISSING
- abilityGroupId: MISSING
- childCapabilityId: MISSING
- owner: `local_ai_runtime`, `startup_entrypoint`
- ownerResponsible: `startup-entrypoint`
- status: `failed`
- failureReason: `LOCAL_AI_READINESS_TIMEOUT`
- actionableMessage: `Inspect startup structured logs and rerun npm run grasseye:start.`

### 2. 实际行为

The real restart did not reach app shell startup. Startup correctly fail-closed before `port_clear`, `app_server`, Commander Console, mission runtime, or task dispatch. The concrete readiness result reports `vision`, `commentUnderstanding`, and `productSignal` unhealthy while OCR is ready.

### 3. 法案原本要求

- 法案文件: `.github/instructions/cursor-rules/modules/module-startup-entrypoint.instructions.md`
- lawId: `GRASSEYE-STARTUP-ENTRYPOINT-005-V1`
- 主题: 启动前更新检查与本地 AI 就绪门禁
- 要求: startup must complete local AI readiness gate before mission runtime becomes available; typed failures include `LOCAL_AI_READINESS_TIMEOUT`.
- 禁止项: marking mission runtime available while local AI readiness failed; silently degrading local AI startup into fake success.
- 当前违反点: No governance violation observed. This is a real environmental/runtime readiness P0 blocker, and the system obeyed fail-closed behavior.

### 4. 施工图原本要求

- 施工图文件: `docs/法案辅助文件/GrassEye 唯一启动入口与终端结构化日志施工图.md`
- 章节: `Local AI Startup Readiness Gate`
- 要求: `grasseye:start` must run `local_ai_runtime_presence_check`, `local_ai_model_roster_check`, `local_ai_start_or_connect`, `local_ai_health_probe`, and `ai_capability_readiness_gate` before service start.
- 当前违反点: No startup ordering violation. Runtime did not satisfy local AI health.

### 5. 根因定位

生产代码:
- 文件路径: `scripts/startup/launch-grasseye.mjs`
- 函数 / class / route: `ensureLocalAiReadiness`
- 关键判断: throws when `readiness.missionRuntimeAvailable` is false.
- 为什么导致当前错误: `ensureLocalAiRuntimeReady` returned `missionRuntimeAvailable=false` and `failureReason=LOCAL_AI_READINESS_TIMEOUT`; startup propagated the governed failure and stopped.

生产代码:
- 文件路径: `src/lib/local-ai/startup-readiness.ts`
- 函数 / class / route: `classifyProbeFailure`, `buildReadinessDetail`
- 关键判断: timed-out local AI probe maps to `LOCAL_AI_READINESS_TIMEOUT`.
- 为什么导致当前错误: runtime health probe timed out before required Ollama-backed roles became ready.

执法代码:
- inspector 文件: `scripts/audit/domains/commander-console-capability/run-startup-readiness-gate-checks.ts`
- negative proof 文件: `scripts/audit/domains/commander-console-capability/negative-proof-harness.ts`
- manifest / owner mapping: Commander Console capability owns startup entrypoint readiness enforcement.
- 当前是否覆盖: Covers fail-closed startup ordering and readiness gate presence.
- 为什么没有拦住: There is no production-code defect to catch here; the runtime dependency was unhealthy at verification time.

### 6. 为什么执法脚本没有拦住？

J. Runtime dependency unavailable during real verification. The inspector can enforce fail-closed startup shape, but cannot guarantee that the local AI runtime and required models are healthy at the moment of restart.

### 7. 应修复层级，但本阶段不修

- 修生产代码: NO, unless repeated logs prove timeout classification is wrong.
- 修施工图: NO.
- 修 inspector: NO.
- 修 negative proof: NO.
- 修结构化日志: P1 candidate only: startup AI logs could include `traceId` and more explicit runtime endpoint/probe count.
- 是否需要申请修改法案: NO.
