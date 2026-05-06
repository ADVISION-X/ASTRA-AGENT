# Phase AI runtime execution failed root cause

## BLOCKER-1: AI runtime failure was opaque

### 现象

真实日志在 `judge-seeding-video` 出现：

```txt
CAPABILITY_CALL_FAILED failureReason=runtime_execution_failed
MISSION_FAILED failureReason=runtime_execution_failed
```

### WHY HAPPEN

法案是否缺失：不缺。AI 法案已要求 runtime pipeline、proof、schema/quality/output boundary。

施工图是否缺细节：缺。旧施工图没有明确 `runtime_execution_failed` 不得作为唯一 terminal 诊断。

质检脚本是否覆盖：不足。AI inspector 未锁住 debug emitter 注入、implementationStatus 透传、unexpected throw diagnostic ref。

是否存在豁免/绕过：未发现显式豁免；缺口来自默认 runtime context 和 terminal summary 没有强约束。

生产代码为什么能合入：`executeResolvedAiEntry` catch 路径可生成 generic failure，审计未要求附带 `implementationStatus/errorKind/diagnosticPayloadRef`。

runtime 为什么暴露不出来：local adapter 已有 `implementationStatus` 与 `AI_ERROR_DEBUG`，但 terminal-visible AI result / response envelope 未完整携带摘要字段。

### 鉴权结论

问题属于 AI Capability，Orchestration 负责透传，不需要申请改法案，需要立即修施工图和 AI owner inspector。

### 修复

生产文件：

```txt
src/capabilities/ai/runtime/ai-runtime-result.ts
src/capabilities/ai/ability-group.ts
src/capabilities/ai/schema-runtime.schema.ts
src/lib/local-runtime/workbench-nerve-bus-ai-request.ts
src/capabilities/nerve-bus/schema-envelope.schema.ts
src/capabilities/orchestration/runtime/orchestration-nerve-bus-adapter.ts
src/capabilities/orchestration/runtime/orchestration-loop-iteration-event-shared.ts
```

施工图文件：

```txt
docs/法案辅助文件/GrassEye AI 大脑能力组施工图.md
docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md
```

inspector 文件：

```txt
scripts/audit/domains/ai-capability/run-ai-runtime-contract-checks.ts
```

negative proof 文件：

```txt
scripts/audit/domains/ai-capability/negative-proof-definitions.ts
```

### 防复发

AST 检查：确认 runtime failure status literal 集合存在。

symbol 检查：确认 `createProviderAwareAiRuntimePort({ emitDebugEvent })` 调用链存在。

import graph 检查：保持 AI 不 import Forensics internals。

anti-escape 检查：AI negative proof 继续覆盖 adapter import/type escape。

生产突变验证：新增 debug event wiring、implementation status collapse、diagnostic ref 删除突变。

## BLOCKER-2: AI_ERROR_DEBUG was not terminal-visible by contract

### 现象

日志没有 `AI_REQUEST_DEBUG` / `AI_RESPONSE_DEBUG` / `AI_ERROR_DEBUG`。

### WHY HAPPEN

法案是否缺失：不缺。

施工图是否缺细节：缺少 `emitDebugEvent` 必须进入 structured runtime log sink 的明确施工要求。

质检脚本是否覆盖：Forensics 有粗粒度检查，AI inspector 没有 owner-local 接线检查。

是否存在豁免/绕过：无显式豁免。

生产代码为什么能合入：默认 `createAiExecutionContext()` 原先不能注入 debug emitter，terminal relay info level 也不镜像 AI debug event。

runtime 为什么暴露不出来：debug event 没有稳定终端字段 `implementationStatus/errorKind/runtimeCallId/diagnosticPayloadRef`。

### 鉴权结论

问题属于 AI Capability + Forensics Persistence public boundary，不需要改法案。

### 修复

生产文件：

```txt
src/capabilities/ai/runtime/ai-execution-context.ts
src/capabilities/ai/runtime-factory.ts
src/capabilities/ai/runtime-adapters/local-ai-runtime-debug-contract.ts
src/capabilities/ai/runtime-adapters/local-ai-runtime-debug-state.ts
src/capabilities/ai/runtime-adapters/local-ai-runtime-debug.ts
src/capabilities/ai/runtime-adapters/local-ai-runtime-adapter.ts
src/lib/local-runtime/workbench-ai-debug-support.ts
src/lib/local-runtime/structured-log-terminal.ts
src/lib/local-runtime/structured-log-payload.ts
src/types/structured-log.ts
```

### 防复发

AI inspector now checks emitter injection and debug event diagnostic fields. Forensics write path remains the persistence boundary.

## BLOCKER-3: COMMAND_REJECTED after accepted polluted mission truth

### 现象

真实日志先出现 accepted/frozen/selected step，后出现 `COMMAND_REJECTED issue-human-command timed out after 5000ms`。

### WHY HAPPEN

法案是否缺失：不缺。

施工图是否缺细节：已补 accepted 后 observer timeout 的事件名和 status。

质检脚本是否覆盖：Commander inspector 之前未明确检查 accepted timeout path。

是否存在豁免/绕过：无。

生产代码为什么能合入：late dispatch result path 可被误读为 command rejected。

runtime 为什么暴露不出来：command receipt timeout 与 mission truth 使用了相同 rejected event vocabulary。

### 鉴权结论

问题属于 Commander Console，不需要改法案。

### 修复

生产文件：

```txt
src/lib/local-app-shell/task-start-dispatch-result.ts
```

本轮确认该文件已有 `COMMAND_RECEIPT_TIMEOUT_AFTER_ACCEPTED` 路径，并补 Commander inspector/negative proof 锁定。

### 防复发

Inspector 检查 accepted proof gate 和 accepted observer timeout event；negative proof 将该 event 改回 `COMMAND_REJECTED` 必须失败。

## BLOCKER-4: Forensics write proof fields insufficient

### 现象

日志中 `FORENSICS_RECORD_WRITE_REQUESTED=68`、`FORENSICS_RECORD_WRITTEN=66`，外部只凭摘要难以判断重复写账还是正常每事件落账。

### WHY HAPPEN

法案是否缺失：不缺。

施工图是否缺细节：缺少 terminal refs 最小字段表。

质检脚本是否覆盖：Forensics inspector 检查 write events，但未要求 `recordKind/idempotencyKey/dedupeDecision/sourceEventId` 全量证明字段。

是否存在豁免/绕过：无。

生产代码为什么能合入：write boundary event refs 字段不完整仍可通过。

runtime 为什么暴露不出来：terminal refs 缺少 recordKind/idempotency proof。

### 鉴权结论

问题属于 Forensics Persistence，不需要改法案。

### 修复

生产文件：

```txt
src/capabilities/forensics-persistence/shared/forensics-write-boundary-events.ts
```

施工图文件：

```txt
docs/法案辅助文件/GrassEye Forensics Persistence 取证记账能力组施工图_FINAL.md
```

inspector 文件：

```txt
scripts/audit/domains/forensics-persistence-capability/run-forensics-structured-log-runtime-checks.ts
```

negative proof 文件：

```txt
scripts/audit/domains/forensics-persistence-capability/negative-proof-harness.ts
```

### 防复发

Forensics inspector now requires sourceEventId/sourceEventType/sourceOwner/recordKind/recordId/recordRef/idempotencyKey/dedupeDecision refs on write boundary events.

## BLOCKER-5: docs/debug topology blocker

### 现象

runner-summary showed `docs/debug` as non-canonical documentation bucket.

### WHY HAPPEN

法案是否缺失：不缺。

施工图是否缺细节：不缺。

质检脚本是否覆盖：已覆盖。

是否存在豁免/绕过：无。

生产代码为什么能合入：runtime debug artifacts had been placed under docs.

runtime 为什么暴露不出来：静态 topology audit already exposed it.

### 鉴权结论

问题属于 capability-group-governance/static topology，不需要改法案。

### 修复

本轮检查 `docs/debug` 当前不存在。

### 防复发

capability-group-governance inspector remains active; recreating `docs/debug/foo.md` must fail.
