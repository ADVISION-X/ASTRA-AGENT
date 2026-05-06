# Phase 05 Runtime And MapLab Root Cause

## BLOCKER-1

### 真实日志证据

```txt
STEP_DISPATCH_STARTED Dispatching step "judge-seeding-video" to ability group "ai"
CAPABILITY_CALL_STARTED Governed ability step "judge-seeding-video" entered "ai" execution
CAPABILITY_CALL_FAILED failureReason=runtime_execution_failed
MISSION_FAILED failureReason=runtime_execution_failed
```

终端缺 `AI_REQUEST_DEBUG / AI_RESPONSE_DEBUG / AI_ERROR_DEBUG / implementationStatus / errorKind / runtimeCallId / diagnosticPayloadRef`。

### WHY HAPPEN

法案是否缺失：NO。
施工图是否缺细节：YES，已补第五阶段施工图的 AI runtime debug truth。
质检脚本是否覆盖：已有 `audit:ai` runtime diagnostic transparency 检查。
是否存在豁免：NO。
生产代码为什么能合入：历史路径允许 outer catch 把 child throw 合并为 `runtime_execution_failed`。
runner 为什么没拦住：旧 inspector 未覆盖 composition root debug event 到 structured runtime sink 的完整链。
runtime 为什么没暴露：`emitDebugEvent` 未作为强制 wiring 进入终端和 Forensics 证明。

### 鉴权结论

归属 owner：AI Capability，Forensics 仅承接 public structured runtime event。
是否需要申请改法案：NO。
是否立即修施工图：YES。
需要补哪个 inspector：AI runtime contract / Forensics structured log runtime。
需要补哪个 negative proof：删除 `emitDebugEvent` wiring、删除 diagnostic fields、断开 AI debug recorder。

### 修复文件

生产代码：`src/lib/local-runtime/workbench-ai-ability-group.ts`、`src/lib/local-runtime/workbench-ai-debug-recorder.ts`、`src/capabilities/ai/runtime/ai-execution-context.ts`、`src/capabilities/ai/runtime-adapters/provider-aware-ai-runtime-adapter.ts`、`src/capabilities/ai/runtime/ai-dispatch-failure.ts`。
施工图：`docs/法案辅助文件/GrassEye 第五阶段高级AI地图生成与WEB本地程序打通施工图.md`。
项目方案：`docs/项目方案/GrassEye_第五阶段建设目标方案.md`。
inspector：`scripts/audit/domains/ai-capability/run-ai-runtime-contract-checks.ts`。
negative proof：AI capability negative proof harness。

### 防复发证明

AST 检查：`createProviderAwareAiRuntimePort({ emitDebugEvent })`、`emitAiErrorDebug`、diagnostic fields。
symbol 检查：AI configured factory 到 runtime adapter。
import graph 检查：AI 不 import Forensics internals。
anti-escape 检查：禁止 raw prompt/image/secret 泄露为终端事实。
生产突变验证路径：`npm run audit:ai`。

## BLOCKER-2

### 真实日志证据

```txt
runner-summary:
owner = page-state-capability
file = src/lib/local-runtime/workbench-page-state-dispatch-input.ts
13 fatal: Local runtime page-state dispatch must propagate envelope.*
```

当前源码 `buildPageStateDispatchPayload()` 已传播 `runId / sessionId / stepId / mapPackageId / mapPackageVersion / selectedMapId / selectedMapVersion / activationSnapshotRef / capabilityCallId / nerveBusEnvelopeId / inputRef / idempotencyKey / openHandoff.browserSessionRef`。

### WHY HAPPEN

法案是否缺失：NO。
施工图是否缺细节：YES，已补 canonical builder 与字段来源。
质检脚本是否覆盖：YES，重跑后 `audit:page-state` PASS。
是否存在豁免：NO。
生产代码为什么能合入：生产代码当前已符合字段传播。
runner 为什么没拦住：`scripts/audit/generated/runner-summary.json` 为 stale generated artifact 或旧 inspector 输出。
runtime 为什么没暴露：不是 runtime 问题，是 generated summary 与当前代码事实漂移。

### 鉴权结论

归属 owner：Page State Capability。
是否需要申请改法案：NO。
是否立即修施工图：YES。
需要补哪个 inspector：Page State local-runtime dispatch builder AST/source check。
需要补哪个 negative proof：删除 envelope field、删除 inspector wiring、hardcode browserSessionRef。

### 修复文件

生产代码：`src/lib/local-runtime/workbench-page-state-dispatch-input.ts`。
施工图：`docs/法案辅助文件/GrassEye 第五阶段高级AI地图生成与WEB本地程序打通施工图.md`。
项目方案：`docs/项目方案/GrassEye_第五阶段建设目标方案.md`。
inspector：`scripts/audit/domains/page-state-capability/required-shape-builder-findings.ts`。
negative proof：Page State capability negative proof mutations。

### 防复发证明

AST 检查：required property assignments。
symbol 检查：`input.envelope.*` 与 `input.session.browserProfileRef` 来源。
import graph 检查：local runtime builder 不绕过 Page State public contract。
anti-escape 检查：无 regex-only verdict。
生产突变验证路径：`npm run audit:page-state`。

## BLOCKER-3

### 真实日志证据

```txt
MISSION_ACTIVATION_SNAPSHOT_FROZEN
COMMAND_ACCEPTED
...
COMMAND_REJECTED failureReason=issue-human-command timed out after 5000ms
```

### WHY HAPPEN

法案是否缺失：NO。
施工图是否缺细节：YES，accepted 后 observer timeout 语义已补。
质检脚本是否覆盖：YES，Commander inspector 检查 `COMMAND_RECEIPT_TIMEOUT_AFTER_ACCEPTED`。
是否存在豁免：NO。
生产代码为什么能合入：旧 HTTP/task-start wrapper 把 observer timeout 当成 command rejection。
runner 为什么没拦住：旧 inspector 未禁止 accepted 后 late reject。
runtime 为什么没暴露：同一 run 的 command truth 与 mission truth 没有分层。

### 鉴权结论

归属 owner：Commander Console。
是否需要申请改法案：NO。
是否立即修施工图：YES。
需要补哪个 inspector：Commander runtime runId / start mission acceptance checks。
需要补哪个 negative proof：accepted 后把 timeout event 改回 `COMMAND_REJECTED`。

### 修复文件

生产代码：`src/lib/local-app-shell/task-start-dispatch-result.ts`。
施工图：`docs/法案辅助文件/GrassEye 第五阶段高级AI地图生成与WEB本地程序打通施工图.md`。
项目方案：`docs/项目方案/GrassEye_第五阶段建设目标方案.md`。
inspector：`scripts/audit/domains/commander-console-capability/run-commander-runtime-runid-checks.ts`。
negative proof：Commander Console negative proof harness。

### 防复发证明

AST 检查：late timeout emits `COMMAND_RECEIPT_TIMEOUT_AFTER_ACCEPTED`。
symbol 检查：runtimeProof refs gate accepted-before-result。
import graph 检查：local app shell only emits Commander public debug events.
anti-escape 检查：no review queue rejection for accepted observer timeout.
生产突变验证路径：`npm run audit:commander-console`。

## BLOCKER-4

### 真实日志证据

```txt
FORENSICS_RECORD_WRITE_REQUESTED = 68
FORENSICS_RECORD_WRITTEN = 66
```

终端摘要此前缺 `sourceEventId / sourceEventType / recordId / recordRef / idempotencyKey / dedupeDecision`，无法判断正常写账还是重复污染。

### WHY HAPPEN

法案是否缺失：NO。
施工图是否缺细节：YES，已补最小 terminal proof refs。
质检脚本是否覆盖：YES，Forensics inspector 检查 write boundary refs。
是否存在豁免：NO。
生产代码为什么能合入：旧 terminal summary 对 write boundary 只暴露计数。
runner 为什么没拦住：旧 inspector 未强制 source event 与 idempotency proof 字段。
runtime 为什么没暴露：Forensics 写账 boundary event 没把去重判断字段作为 refs 输出。

### 鉴权结论

归属 owner：Forensics Persistence。
是否需要申请改法案：NO。
是否立即修施工图：YES。
需要补哪个 inspector：Forensics structured log runtime checks。
需要补哪个 negative proof：删除 `idempotencyKey`、`sourceEventId`、`dedupeDecision` refs。

### 修复文件

生产代码：`src/capabilities/forensics-persistence/shared/forensics-write-boundary-events.ts`。
施工图：`docs/法案辅助文件/GrassEye 第五阶段高级AI地图生成与WEB本地程序打通施工图.md`。
项目方案：`docs/项目方案/GrassEye_第五阶段建设目标方案.md`。
inspector：`scripts/audit/domains/forensics-persistence-capability/run-forensics-structured-log-runtime-checks.ts`。
negative proof：Forensics persistence negative proof harness。

### 防复发证明

AST 检查：write requested/written builders include proof refs。
symbol 检查：Forensics ability wrapper calls boundary emitters。
import graph 检查：structured log bus wiring persists boundary events。
anti-escape 检查：large payload remains ref/hash only。
生产突变验证路径：`npm run audit:forensics-persistence`。

## BLOCKER-5

### 真实日志证据

```txt
phase = phase-04-full-enforcement
```

第五阶段目标已由 operator 定义，但项目方案 / 施工图 / phase gate 仍未形成统一权威。

### WHY HAPPEN

法案是否缺失：NO。
施工图是否缺细节：YES。
质检脚本是否覆盖：PARTIAL，map-plugin-package 已覆盖 Map Lab 关键路径。
是否存在豁免：NO。
生产代码为什么能合入：Map Lab 生产入口已存在，但第五阶段建设叙事未补齐。
runner 为什么没拦住：phase gate 仍标注 phase-04。
runtime 为什么没暴露：不是 runtime 问题，是建设文档缺位。

### 鉴权结论

归属 owner：map-plugin-package support domain + AI + Commander Console。
是否需要申请改法案：NO。
是否立即修施工图：YES。
需要补哪个 inspector：map-plugin-package Map Lab authoring flow checks。
需要补哪个 negative proof：直接 active、non-success import、删除 validation issues handling。

### 修复文件

生产代码：`src/lib/local-runtime/map-lab/map-lab-draft-generator.ts`。
施工图：`docs/法案辅助文件/GrassEye 第五阶段高级AI地图生成与WEB本地程序打通施工图.md`。
项目方案：`docs/项目方案/GrassEye_第五阶段建设目标方案.md`。
inspector：`scripts/audit/domains/map-plugin-package/**`。
negative proof：Map plugin package negative proof harness。

### 防复发证明

AST 检查：`generateMapLabDraft()` uses `registry.importPackage()` and does not call active mutation。
symbol 检查：AI success/dry-run/validation branch ownership。
import graph 检查：generated maps stay declarative。
anti-escape 检查：no executable markers/functions in generated package。
生产突变验证路径：`npm run audit:map-plugin-package`。
