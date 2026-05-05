# GrassEye Phase 1 Blocker List

## BLOCKER-1: Mission preflight passes, then governed command is rejected because `runId` is null

### 1. 日志证据

- 原始日志片段：

```txt
[GRASSEYE][RUNTIME][PASS] runtime HUMAN_COMMAND_VALIDATED success requestedPlatformId=facebook-web; selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5,attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be,task_start
[GRASSEYE][RUNTIME][EVENT] runtime MISSION_READINESS_CHECK_STARTED started MissionReadiness is scoped to the selected task binding, not the app shell. refs=trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5,attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be,task_start
[GRASSEYE][RUNTIME][EVENT] runtime MISSION_PREFLIGHT_STARTED started Mission preflight is checking readiness before command dispatch. refs=trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5,attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be,task_start
[GRASSEYE][RUNTIME][PASS] runtime MISSION_PREFLIGHT_PASSED success Mission preflight passed. Commander Console can dispatch the governed human command. refs=trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5,attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be,task_start
[GRASSEYE][RUNTIME][PASS] runtime COMMANDER_COMMAND_ENVELOPE_BUILT success taskTemplateId resolved to requestedPlatformId=facebook-web; selectedMapId=facebook.seeding-video.discovery.meta.v1; activationSnapshotRef=activation-snapshot:e090cb41-1d0e-4c06-99f9-5d1f6693cfa1:1.0.0:1.0.0 refs=trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5,attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be,task_start
[GRASSEYE][RUNTIME][PASS] runtime NERVE_BUS_ENVELOPE_CREATED success Nerve Bus governed envelope created for start-mission. refs=commander_command_9cb93859-3d30-47af-9d89-baed35b0ced8,commander_command_9cb93859-3d30-47af-9d89-baed35b0ced8,task_start
[GRASSEYE][RUNTIME][EVENT] runtime NERVE_BUS_DISPATCH_STARTED started Dispatching start-mission via CommandTransportPort. refs=commander_command_9cb93859-3d30-47af-9d89-baed35b0ced8,commander_command_9cb93859-3d30-47af-9d89-baed35b0ced8,task_start
[GRASSEYE][RUNTIME][FAIL] runtime COMMAND_REJECTED failed COMMAND_REJECTED failureReason="[\n  {\n    \"code\": \"invalid_type\",\n    \"expected\": \"string\",\n    \"received\": \"null\",\n    \"path\": [\n      \"runId\"\n    ],\n    \"message\": \"Expected string, received null\"\n  }\n]" refs=trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5,attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be,task_start
```

```txt
[GRASSEYE][RUNTIME][PASS] runtime HUMAN_COMMAND_VALIDATED success requestedPlatformId=tiktok-web; selectedMapId=tiktok.seeding-video.discovery.meta.v1 refs=trace_c650cbbe-4aa1-41aa-8fcf-bcd8741837e3,attempt_529b8306-c9cf-4010-85bc-4fa91d5b1ecc,task_start
[GRASSEYE][RUNTIME][EVENT] runtime MISSION_READINESS_CHECK_STARTED started MissionReadiness is scoped to the selected task binding, not the app shell. refs=trace_c650cbbe-4aa1-41aa-8fcf-bcd8741837e3,attempt_529b8306-c9cf-4010-85bc-4fa91d5b1ecc,task_start
[GRASSEYE][RUNTIME][EVENT] runtime MISSION_PREFLIGHT_STARTED started Mission preflight is checking readiness before command dispatch. refs=trace_c650cbbe-4aa1-41aa-8fcf-bcd8741837e3,attempt_529b8306-c9cf-4010-85bc-4fa91d5b1ecc,task_start
[GRASSEYE][RUNTIME][PASS] runtime MISSION_PREFLIGHT_PASSED success Mission preflight passed. Commander Console can dispatch the governed human command. refs=trace_c650cbbe-4aa1-41aa-8fcf-bcd8741837e3,attempt_529b8306-c9cf-4010-85bc-4fa91d5b1ecc,task_start
[GRASSEYE][RUNTIME][PASS] runtime COMMANDER_COMMAND_ENVELOPE_BUILT success taskTemplateId resolved to requestedPlatformId=tiktok-web; selectedMapId=tiktok.seeding-video.discovery.meta.v1; activationSnapshotRef=activation-snapshot:01ed033f-f4b9-4128-9b54-f2cb3d87fa10:1.0.0:1.0.0 refs=trace_c650cbbe-4aa1-41aa-8fcf-bcd8741837e3,attempt_529b8306-c9cf-4010-85bc-4fa91d5b1ecc,task_start
[GRASSEYE][RUNTIME][PASS] runtime NERVE_BUS_ENVELOPE_CREATED success Nerve Bus governed envelope created for start-mission. refs=commander_command_36628d81-0fbc-4baa-a692-392e6dadf4ec,commander_command_36628d81-0fbc-4baa-a692-392e6dadf4ec,task_start
[GRASSEYE][RUNTIME][EVENT] runtime NERVE_BUS_DISPATCH_STARTED started Dispatching start-mission via CommandTransportPort. refs=commander_command_36628d81-0fbc-4baa-a692-392e6dadf4ec,commander_command_36628d81-0fbc-4baa-a692-392e6dadf4ec,task_start
[GRASSEYE][RUNTIME][FAIL] runtime COMMAND_REJECTED failed COMMAND_REJECTED failureReason="[\n  {\n    \"code\": \"invalid_type\",\n    \"expected\": \"string\",\n    \"received\": \"null\",\n    \"path\": [\n      \"runId\"\n    ],\n    \"message\": \"Expected string, received null\"\n  }\n]" refs=trace_c650cbbe-4aa1-41aa-8fcf-bcd8741837e3,attempt_529b8306-c9cf-4010-85bc-4fa91d5b1ecc,task_start
```

traceId: `trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5`, `trace_c650cbbe-4aa1-41aa-8fcf-bcd8741837e3`  
attemptId: `attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be`, `attempt_529b8306-c9cf-4010-85bc-4fa91d5b1ecc`  
missionId: MISSING  
taskTemplateId: MISSING in terminal line; selected task start source appears as `task_start` in refs  
selectedMapId: `facebook.seeding-video.discovery.meta.v1`, `tiktok.seeding-video.discovery.meta.v1`  
requestedPlatformId: `facebook-web`, `tiktok-web`  
activationSnapshotRef: `activation-snapshot:e090cb41-1d0e-4c06-99f9-5d1f6693cfa1:1.0.0:1.0.0`, `activation-snapshot:01ed033f-f4b9-4128-9b54-f2cb3d87fa10:1.0.0:1.0.0`  
commandId / envelopeId: `commander_command_9cb93859-3d30-47af-9d89-baed35b0ced8`, `commander_command_36628d81-0fbc-4baa-a692-392e6dadf4ec`  
stepId: MISSING  
abilityGroupId: MISSING  
childCapabilityId: MISSING  
owner: MISSING  
ownerResponsible: MISSING in terminal rejection line  
status: failed  
failureReason: Zod invalid_type, expected string, received null at path `runId`  
actionableMessage: MISSING in terminal rejection line

### 2. 实际行为

The selected task binding validates for both Facebook and TikTok, mission readiness starts, mission preflight passes, Commander builds a governed command envelope with an activationSnapshotRef, Nerve Bus creates and dispatches an envelope, and only then the command is rejected because a schema parsed `runId: null`. This places the blocker between `MISSION_PREFLIGHT_PASSED` and the command result semantic/transport proof path, before an accepted orchestration lifecycle is visible.

### 3. 法案原本要求

法案文件：`.github/instructions/cursor-rules/modules/module-nerve-bus-capability.instructions.md`  
lawId：`GRASSEYE-NERVE-BUS-CAPABILITY-002-V2`, `GRASSEYE-NERVE-BUS-CAPABILITY-007-V2`  
主题：Envelope chain completeness and transfer proof integrity  
要求：Nerve Bus envelopes and result envelopes must preserve complete mission/map/run chain fields, including `runId`; transfer proof chain equals envelope chain.  
禁止项：mission transport without `runId`; result envelope mismatching or fabricating `runId`; typed transport success without proof.  
当前违反点：runtime path reaches Nerve Bus dispatch and then fails with `runId` null, proving at least one governed command/result/proof segment can emit or validate a null `runId` after preflight.

法案文件：`.github/instructions/cursor-rules/modules/module-commander-console-capability.instructions.md`  
lawId：`GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2`  
主题：Commander command envelope and transport result semantic gate  
要求：Commander must build explicit governed envelopes and semantically validate transport results before user-visible accepted/rejected state.  
禁止项：dispatch after unresolved command contract or invalid transport result chain.  
当前违反点：preflight passes and envelope dispatch begins before the `runId` contract violation is surfaced.

法案文件：`.github/instructions/cursor-rules/modules/module-capability-group-governance.instructions.md`  
lawId：capability group runtime proof minimum fields  
主题：Runtime proof identity chain  
要求：runtime proof must carry `runId`, `missionId`, capability identity, status, evidence, and timestamp.  
禁止项：runtime proof with missing/null chain identity.  
当前违反点：current production schemas allow Commander proof outcome `runId: null`, while Orchestration runtime proof omits `runId`.

### 4. 施工图原本要求

施工图文件：`docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md`  
章节：Runtime proof minimum fields / capability group standard package  
要求：runtime proof minimum fields include `runId` and chain identity.  
当前违反点：Commander outcome/proof permits nullable `runId`; Orchestration proof schema/builder has no `runId`.

施工图文件：`docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md`  
章节：Orchestration command input, Nerve Bus dispatch, runtime proof, READY criteria  
要求：mission command/dispatch/proof chain must preserve `runId`, activation snapshot, selected map and dispatch proof; mission start cannot silently default or pass with missing required chain.  
当前违反点：mission start command is dispatched after preflight, then fails on `runId:null` before mission start proof is produced.

施工图文件：`docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md`  
章节：command envelope / command dispatch / transport semantic gate  
要求：Commander start command must resolve selected platform/map and dispatch through governed transport with a complete chain.  
当前违反点：Commander transport outcome path currently allows `runId:null` after the governed transport returns.

### 5. 根因定位

生产代码：

- 文件路径：`src/capabilities/commander-console/runtime/commander-command-outcomes.ts`
- 函数 / class / route：`createTransportOutcome`, `createCommandTimeoutOutcome`, `createBlockedCommandOutcome`
- 关键判断：transport outcome currently materializes `runId: null` instead of deriving it from the governed request/result envelope chain.
- 为什么导致当前错误：Commander runtime proof is built from `CommanderExecutionOutcome`; this production path can carry `runId:null` even after Nerve Bus has a command envelope id, producing the exact schema failure shape observed by the terminal log.

生产代码：

- 文件路径：`src/capabilities/commander-console/shared/commander-result.ts`
- 函数 / class / route：`CommanderExecutionOutcome`
- 关键判断：type permits `runId: string | null`.
- 为什么导致当前错误：the public outcome contract makes nullable runId legal for command outcomes that are later used to build runtime proof.

生产代码：

- 文件路径：`src/capabilities/commander-console/shared/commander-runtime-proof-schema.ts`
- 函数 / class / route：`RuntimeProofSchemaBase`
- 关键判断：`runId` is nullable.
- 为什么导致当前错误：Commander proof validation does not fail closed before the transport result is surfaced.

生产代码：

- 文件路径：`src/capabilities/orchestration/schema.ts`
- 函数 / class / route：`RuntimeProofSchema`, `MissionStateSchema`
- 关键判断：`RuntimeProofSchema` omits `runId`; mission state uses `activeTaskRunId` but does not expose proof `runId`.
- 为什么导致当前错误：Orchestration's proof contract is narrower than Nerve Bus and capability governance law, so the chain can lose `runId` at orchestration/result boundaries.

生产代码：

- 文件路径：`src/capabilities/orchestration/runtime/orchestration-proof-builder.ts`
- 函数 / class / route：`BuildProofInput`, `buildOrchestrationProofIdentityFields`, `buildOrchestrationRuntimeProof`
- 关键判断：proof builder input has no `runId` and cannot emit proof `runId`.
- 为什么导致当前错误：even if the incoming command envelope has a runId, the orchestration proof builder cannot preserve it.

执法代码：

- inspector 文件：`scripts/audit/domains/nerve-bus-capability/required-shape.ts`
- negative proof 文件：`scripts/audit/domains/nerve-bus-capability/negative-proof-harness.ts`
- manifest / owner mapping：`scripts/audit/domain-manifest.ts`, owner domain `nerve-bus-capability`
- 当前是否覆盖：partially. It checks schema/source shape for `runId` in Nerve Bus envelope/proof builders, but not the real Commander outcome -> Nerve Bus transport result -> Orchestration proof path.
- 为什么没有拦住：the checked Nerve Bus source still contains `runId`, so static includes/property checks pass while another owner creates nullable/missing `runId`.

执法代码：

- inspector 文件：`scripts/audit/domains/commander-console-capability/required-shape.ts`, `scripts/audit/domains/commander-console-capability/run-startup-readiness-gate-checks.ts`
- negative proof 文件：`scripts/audit/domains/commander-console-capability/negative-proof-harness.ts`
- manifest / owner mapping：`scripts/audit/domain-manifest.ts`, owner domain `commander-console-capability`
- 当前是否覆盖：does not cover transport outcome runId derivation or Commander proof nullability.
- 为什么没有拦住：current checks focus on startup readiness/map package and command semantic shape, not symbol-level propagation from command envelope/result to `createTransportOutcome`.

执法代码：

- inspector 文件：`scripts/audit/domains/orchestration-capability/required-shape.ts`
- negative proof 文件：`scripts/audit/domains/orchestration-capability/negative-proof-harness.ts`
- manifest / owner mapping：`scripts/audit/domain-manifest.ts`, owner domain `orchestration-capability`
- 当前是否覆盖：does not assert that `RuntimeProofSchema` and `buildOrchestrationRuntimeProof` preserve `runId`.
- 为什么没有拦住：orchestration proof chain is not checked at symbol/schema level against capability governance minimum fields.

### 6. 为什么执法脚本没有拦住？

C. 法案存在，但 inspector 未覆盖。  
D. inspector 只做 grep/regex/includes，没有 AST / symbol / import graph / anti-escape。  
E. inspector 覆盖了 happy path，没有 negative proof。  
F. negative proof 没有生产代码突变验证。

### 7. 应修复层级，但本阶段不修

修生产代码：make Commander transport outcome derive non-null runId from the governed command/result/proof chain; make Commander result/proof schema fail closed on null runId for dispatched commands; add Orchestration proof `runId` preservation from mission command/state.  
修施工图：clarify cross-owner runId propagation across Commander outcome, Nerve Bus proof, and Orchestration runtime proof.  
修 inspector：add AST/symbol/import-graph checks that tie `createTransportOutcome`, `buildCommanderRuntimeProof`, Orchestration proof builder, and Nerve Bus result proof chain together.  
修 negative proof：mutate production code to set `runId:null` in Commander outcome or remove Orchestration proof runId and require audit failure.  
修结构化日志：include throwing schema owner and exact chain segment where `runId` became null.  
是否需要申请修改法案：NO

## BLOCKER-2: Mission preflight is too shallow for command/result contract readiness

### 1. 日志证据

- 原始日志片段：

```txt
[GRASSEYE][RUNTIME][EVENT] runtime MISSION_PREFLIGHT_STARTED started Mission preflight is checking readiness before command dispatch. refs=trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5,attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be,task_start
[GRASSEYE][RUNTIME][PASS] runtime MISSION_PREFLIGHT_PASSED success Mission preflight passed. Commander Console can dispatch the governed human command. refs=trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5,attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be,task_start
[GRASSEYE][RUNTIME][PASS] runtime NERVE_BUS_ENVELOPE_CREATED success Nerve Bus governed envelope created for start-mission. refs=commander_command_9cb93859-3d30-47af-9d89-baed35b0ced8,commander_command_9cb93859-3d30-47af-9d89-baed35b0ced8,task_start
[GRASSEYE][RUNTIME][EVENT] runtime NERVE_BUS_DISPATCH_STARTED started Dispatching start-mission via CommandTransportPort. refs=commander_command_9cb93859-3d30-47af-9d89-baed35b0ced8,commander_command_9cb93859-3d30-47af-9d89-baed35b0ced8,task_start
[GRASSEYE][RUNTIME][FAIL] runtime COMMAND_REJECTED failed COMMAND_REJECTED failureReason="[\n  {\n    \"code\": \"invalid_type\",\n    \"expected\": \"string\",\n    \"received\": \"null\",\n    \"path\": [\n      \"runId\"\n    ],\n    \"message\": \"Expected string, received null\"\n  }\n]" refs=trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5,attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be,task_start
```

traceId：`trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5`  
attemptId：`attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be`  
missionId：MISSING  
taskTemplateId：MISSING  
selectedMapId：`facebook.seeding-video.discovery.meta.v1`  
requestedPlatformId：`facebook-web`  
activationSnapshotRef：`activation-snapshot:e090cb41-1d0e-4c06-99f9-5d1f6693cfa1:1.0.0:1.0.0`  
commandId / envelopeId：`commander_command_9cb93859-3d30-47af-9d89-baed35b0ced8`  
stepId：MISSING  
abilityGroupId：MISSING  
childCapabilityId：MISSING  
owner：MISSING  
ownerResponsible：MISSING in terminal rejection line  
status：failed  
failureReason：Zod invalid_type, expected string, received null at path `runId`  
actionableMessage：MISSING in terminal rejection line

### 2. 实际行为

Mission readiness/preflight reports success and authorizes command dispatch, but the first governed command still fails on a required chain field. This means preflight verifies environment and task binding but does not validate the command/result/proof contract that will be parsed immediately after dispatch.

### 3. 法案原本要求

法案文件：`.github/instructions/cursor-rules/modules/module-commander-console-capability.instructions.md`  
lawId：`GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2`  
主题：pre-dispatch command envelope safety  
要求：Commander command envelope must be explicit, map/platform-safe, idempotent, timeout-governed, and semantically validated before dispatch.  
禁止项：letting an invalid governed command proceed to dispatch and only discovering a required field failure afterward.  
当前违反点：preflight passes and dispatch starts despite the downstream runId contract being invalid.

法案文件：`.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md`  
lawId：Orchestration mission command and runtime proof laws  
主题：mission command consumption and runtime proof chain  
要求：Orchestration must consume governed mission commands with complete activation/mission/run identity and fail closed before execution when the chain is invalid.  
禁止项：activation/dispatch chain accepted without complete proof identity.  
当前违反点：invalid `runId` appears after dispatch, not at preflight/readiness.

### 4. 施工图原本要求

施工图文件：`docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md`  
章节：Mission readiness / preflight / READY criteria  
要求：preflight must check selected task binding, map activation, dispatch boundary, runtime proof readiness, and explicit target/run context before mission start.  
当前违反点：selected task/environment passed, but the immediate command/result proof schema was not checked.

施工图文件：`docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md`  
章节：Commander command envelope and transport semantic gate  
要求：the command should not be dispatchable until the governed envelope and transport semantic result contract can be validated.  
当前违反点：the command becomes dispatchable before result/proof `runId` validity is guaranteed.

### 5. 根因定位

生产代码：

- 文件路径：`src/lib/local-app-shell/task-start-flow.ts`
- 函数 / class / route：task start flow, especially `MISSION_PREFLIGHT_PASSED` recording before dispatch
- 关键判断：preflight pass is recorded after `getMissionStartPreflight`, before any dry-run parse of Commander/Nerve Bus/Orchestration result-proof chain.
- 为什么导致当前错误：the flow logs dispatch readiness while a downstream required chain field can still be null.

生产代码：

- 文件路径：`src/lib/local-runtime/workbench-status.ts`
- 函数 / class / route：mission readiness/preflight status builder
- 关键判断：readiness checks selected map, browser/session, AI, data store style components but does not validate command/result/proof schema chain for the selected task.
- 为什么导致当前错误：contract invalidity is not represented as a preflight blocker.

生产代码：

- 文件路径：`src/lib/local-runtime/workbench-human-command-dispatch.ts`
- 函数 / class / route：`buildHumanCommandDispatchInput`
- 关键判断：request envelope has `runId`, but there is no preflight assertion that all downstream result/proof builders preserve it.
- 为什么导致当前错误：the request side looks valid while result/proof side can still fail.

执法代码：

- inspector 文件：`scripts/audit/domains/commander-console-capability/run-startup-readiness-gate-checks.ts`
- negative proof 文件：`scripts/audit/domains/commander-console-capability/negative-proof-harness.ts`
- manifest / owner mapping：`scripts/audit/domain-manifest.ts`
- 当前是否覆盖：startup readiness and map package readiness are covered; selected task command/result contract preflight is not.
- 为什么没有拦住：readiness inspector validates startup gates, not the runtime start-mission path after a human command is validated.

### 6. 为什么执法脚本没有拦住？

C. 法案存在，但 inspector 未覆盖。  
E. inspector 覆盖了 happy path，没有 negative proof。  
F. negative proof 没有生产代码突变验证。

### 7. 应修复层级，但本阶段不修

修生产代码：preflight must validate selected command dispatch contract, including non-null runId propagation into expected transport result/proof schemas, before logging `MISSION_PREFLIGHT_PASSED`.  
修施工图：add a small explicit preflight contract-readiness subsection.  
修 inspector：extend Commander/Orchestration readiness audit to inspect runtime task-start flow and proof chain validators.  
修 negative proof：production mutation that nulls/removes runId in outcome/proof must fail before dispatch readiness.  
修结构化日志：add preflight component for command/proof contract readiness.  
是否需要申请修改法案：NO

## BLOCKER-3: `COMMAND_REJECTED` terminal log lacks required owner/actionable/schema-owner fields

### 1. 日志证据

- 原始日志片段：

```txt
[GRASSEYE][RUNTIME][FAIL] runtime COMMAND_REJECTED failed COMMAND_REJECTED failureReason="[\n  {\n    \"code\": \"invalid_type\",\n    \"expected\": \"string\",\n    \"received\": \"null\",\n    \"path\": [\n      \"runId\"\n    ],\n    \"message\": \"Expected string, received null\"\n  }\n]" refs=trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5,attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be,task_start
```

```txt
[GRASSEYE][RUNTIME][FAIL] runtime COMMAND_REJECTED failed COMMAND_REJECTED failureReason="[\n  {\n    \"code\": \"invalid_type\",\n    \"expected\": \"string\",\n    \"received\": \"null\",\n    \"path\": [\n      \"runId\"\n    ],\n    \"message\": \"Expected string, received null\"\n  }\n]" refs=trace_c650cbbe-4aa1-41aa-8fcf-bcd8741837e3,attempt_529b8306-c9cf-4010-85bc-4fa91d5b1ecc,task_start
```

traceId：`trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5`, `trace_c650cbbe-4aa1-41aa-8fcf-bcd8741837e3`  
attemptId：`attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be`, `attempt_529b8306-c9cf-4010-85bc-4fa91d5b1ecc`  
missionId：MISSING  
taskTemplateId：MISSING  
selectedMapId：only present earlier in chain, MISSING on rejection line  
requestedPlatformId：only present earlier in chain, MISSING on rejection line  
activationSnapshotRef：only present earlier in chain, MISSING on rejection line  
commandId / envelopeId：MISSING on rejection line  
stepId：MISSING  
abilityGroupId：MISSING  
childCapabilityId：MISSING  
owner：MISSING  
ownerResponsible：MISSING  
status：failed  
failureReason：Zod invalid_type, expected string, received null at path `runId`  
actionableMessage：MISSING

### 2. 实际行为

The terminal tells the operator that `runId` is null, but it does not show the responsible owner, actionable message, throwing schema, or exact command/proof segment. Earlier code paths add `ownerResponsible` and `actionableMessage` for task start rejected events, so the runtime mirror/terminal log contract is not preserving enough diagnostic fields in this surfaced failure.

### 3. 法案原本要求

法案文件：`.github/instructions/cursor-rules/modules/module-structured-logging.instructions.md`  
lawId：structured logging command rejection and debug bundle laws  
主题：operator-actionable structured logs  
要求：rejected commands must carry failureReason, ownerResponsible, actionableMessage, trace/span/debug refs, and enough context to locate the owner.  
禁止项：opaque failureReason without owner/actionable/debug owner linkage.  
当前违反点：terminal `COMMAND_REJECTED` lacks ownerResponsible and actionableMessage and only exposes a raw Zod issue.

法案文件：`.github/instructions/cursor-rules/modules/module-commander-console-capability.instructions.md`  
lawId：Commander command result and semantic gate clauses  
主题：human command rejection semantics  
要求：rejection must be typed and actionable to the operator.  
禁止项：unowned raw schema errors as final user-visible rejection.  
当前违反点：terminal rejection is a raw schema error with missing owner/action.

### 4. 施工图原本要求

施工图文件：`docs/法案辅助文件/GrassEye 唯一启动入口与终端结构化日志施工图.md`  
章节：terminal structured log relay / failure formatting  
要求：startup and runtime terminal relay must include runId, ownerResponsible, actionableMessage, refs, and failure reason for blocking events.  
当前违反点：terminal relay line for `COMMAND_REJECTED` does not show owner/actionable and cannot identify the throwing owner.

施工图文件：`docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md`  
章节：command rejection UX/log contract  
要求：rejected command must surface actionable next action and responsible boundary.  
当前违反点：operator receives raw Zod failure only.

### 5. 根因定位

生产代码：

- 文件路径：`src/lib/local-runtime/structured-log-terminal.ts`
- 函数 / class / route：`createStructuredTerminalLogListener`
- 关键判断：terminal listener serializes `buildEventPayload(logEntry.entry, level)` for mirrored runtime events.
- 为什么导致当前错误：terminal output proves the emitted payload does not retain or render owner/actionable fields for this rejection path; this relay is the boundary where missing diagnostics become operator-visible.

生产代码：

- 文件路径：`src/lib/local-app-shell/task-start-support.ts`
- 函数 / class / route：`writeTaskStartDispatchResult`
- 关键判断：task-start rejected event does set `actionableMessage` and `ownerResponsible`.
- 为什么导致当前错误：because the terminal line still lacks them, either this event path is not the one being mirrored for the supplied log or the relay/payload builder loses those fields before the startup wrapper prints `[GRASSEYE][RUNTIME]`.

生产代码：

- 文件路径：`src/lib/local-runtime/workbench-human-command.ts`
- 函数 / class / route：`handleHumanCommandEnvelope`
- 关键判断：catch-all converts downstream errors to failed human command result with `failureReason: error.message`.
- 为什么导致当前错误：raw Zod message is propagated without ownerResponsible/actionable/schema owner metadata from the throwing boundary.

执法代码：

- inspector 文件：`scripts/audit/domains/structured-logging/required-shape.ts`
- negative proof 文件：`scripts/audit/domains/structured-logging/negative-proof-harness.ts`
- manifest / owner mapping：`scripts/audit/domain-manifest.ts`, owner domain `structured-logging`
- 当前是否覆盖：does not validate live terminal rendered blocking events against required owner/actionable/trace fields.
- 为什么没有拦住：source-level event-name presence is insufficient; the rendered terminal output contract is not checked with a production rejection mutation.

### 6. 为什么执法脚本没有拦住？

C. 法案存在，但 inspector 未覆盖。  
D. inspector 只做 grep/regex/includes，没有 AST / symbol / import graph / anti-escape。  
H. runtime 日志字段不足，无法让 inspector 或人定位。

### 7. 应修复层级，但本阶段不修

修生产代码：preserve ownerResponsible/actionableMessage/schema owner through catch, task result, runtime event payload, and terminal relay.  
修施工图：add required terminal fields for command rejection from runtime mirror, not only startup wrapper.  
修 inspector：validate payload builder and terminal relay output for blocking command rejection fields.  
修 negative proof：production mutation or simulated production rejection that drops owner/actionable must fail audit.  
修结构化日志：include throwing schema id, ownerResponsible, actionableMessage, commandId/envelopeId, selectedMapId, requestedPlatformId, activationSnapshotRef on rejection.  
是否需要申请修改法案：NO

## BLOCKER-4: Downstream mission lifecycle, PAV, Forensics, and final state events are absent after dispatch

### 1. 日志证据

- 原始日志片段：

```txt
[GRASSEYE][RUNTIME][EVENT] runtime NERVE_BUS_DISPATCH_STARTED started Dispatching start-mission via CommandTransportPort. refs=commander_command_9cb93859-3d30-47af-9d89-baed35b0ced8,commander_command_9cb93859-3d30-47af-9d89-baed35b0ced8,task_start
[GRASSEYE][RUNTIME][FAIL] runtime COMMAND_REJECTED failed COMMAND_REJECTED failureReason="[\n  {\n    \"code\": \"invalid_type\",\n    \"expected\": \"string\",\n    \"received\": \"null\",\n    \"path\": [\n      \"runId\"\n    ],\n    \"message\": \"Expected string, received null\"\n  }\n]" refs=trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5,attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be,task_start
```

traceId：`trace_ba03ebd9-6c7c-4e3e-b012-0e8b9919e2c5`  
attemptId：`attempt_7916201c-bc3a-4df0-8fc1-c1fe54fca0be`  
missionId：MISSING  
taskTemplateId：MISSING  
selectedMapId：earlier `facebook.seeding-video.discovery.meta.v1`; MISSING after rejection  
requestedPlatformId：earlier `facebook-web`; MISSING after rejection  
activationSnapshotRef：earlier `activation-snapshot:e090cb41-1d0e-4c06-99f9-5d1f6693cfa1:1.0.0:1.0.0`; MISSING after rejection  
commandId / envelopeId：`commander_command_9cb93859-3d30-47af-9d89-baed35b0ced8` before rejection; MISSING on rejection line  
stepId：MISSING  
abilityGroupId：MISSING  
childCapabilityId：MISSING  
owner：MISSING  
ownerResponsible：MISSING  
status：failed  
failureReason：Zod invalid_type, expected string, received null at path `runId`  
actionableMessage：MISSING

LOG_EVENT_MISSING:

- `COMMAND_ACCEPTED`
- `ORCHESTRATION_START_RECEIVED`
- `MISSION_ACTIVATION_SNAPSHOT_FROZEN`
- `MAP_STEP_SELECTED`
- `CAPABILITY_CALL_STARTED`
- `CAPABILITY_CALL_COMPLETED / FAILED / REVIEW_REQUIRED`
- `POST_ACTION_VERIFICATION_STARTED / PASSED / FAILED`
- `FORENSICS_RECORD_WRITE_REQUESTED / WRITTEN`
- `STEP_TRANSITION_EVALUATED`
- `MISSION_FINALIZED / FAILED / REVIEW_REQUIRED / STOPPED`

### 2. 实际行为

The runtime never reaches a visible accepted mission lifecycle. Because `COMMAND_REJECTED` happens immediately after Nerve Bus dispatch, map execution, capability calls, PAV, Forensics, and mission finalization are not executed or not logged. The current log cannot prove a frozen mission activation snapshot beyond the Commander envelope-built message.

### 3. 法案原本要求

法案文件：`.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md`  
lawId：Orchestration activation snapshot / map step / runtime proof clauses  
主题：mission lifecycle proof chain  
要求：accepted mission start must freeze activation snapshot, select map steps, dispatch capabilities, write proof/forensics, and finalize/review/fail with typed evidence.  
禁止项：active mission path without activation proof, PAV, Forensics proof, or final state.  
当前违反点：the current command is not accepted, so the required lifecycle is absent; the blocker is upstream and prevents these law-required events from beginning.

法案文件：`.github/instructions/cursor-rules/modules/module-structured-logging.instructions.md`  
lawId：runtime event and forensics traceability clauses  
主题：traceable runtime event chain  
要求：runtime logs must provide trace/span/run/mission/step/capability refs sufficient to join events.  
禁止项：failure events that break correlation to mission/map/step/proof chain.  
当前违反点：after rejection, terminal lacks missionId/runId/step/proof refs, and no forensics write is visible.

### 4. 施工图原本要求

施工图文件：`docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md`  
章节：orchestration loop / PAV / Forensics / READY criteria  
要求：accepted mission start freezes activation snapshot, selects map step, runs capability calls, performs PAV for action steps, writes Forensics proof, then evaluates transition/final state.  
当前违反点：not reached because command rejection occurs immediately after dispatch.

施工图文件：`docs/法案辅助文件/GrassEye Forensics Persistence 取证记账能力组施工图_FINAL.md`  
章节：runtime proof and evidence record write  
要求：mission runtime should write structured evidence/proof refs for executed steps and failures.  
当前违反点：no Forensics write event appears in current failed command chain.

### 5. 根因定位

生产代码：

- 文件路径：`src/lib/local-runtime/workbench-commander-command-transport.ts`
- 函数 / class / route：`createCommandTransport`, `emitHumanCommand`
- 关键判断：records Nerve Bus envelope creation/dispatch, then delegates to `runtime.nerveBusAbilityGroup.dispatchHumanCommand`.
- 为什么导致当前错误：once downstream dispatch returns a schema failure, the app records command rejection and does not emit accepted orchestration lifecycle events.

生产代码：

- 文件路径：`src/lib/local-runtime/workbench-human-command.ts`
- 函数 / class / route：`handleStartMission`, `handleHumanCommandEnvelope`
- 关键判断：`handleStartMission` would call `runtime.orchestrationAbilityGroup.startMission`, but catch-all rejection returns failed command result when downstream schema parse fails.
- 为什么导致当前错误：the failure prevents visible `ORCHESTRATION_START_RECEIVED`, activation freeze, map step, PAV, Forensics and final mission events.

执法代码：

- inspector 文件：`scripts/audit/domains/orchestration-capability/required-shape.ts`, `scripts/audit/domains/forensics-capability/required-shape.ts`, `scripts/audit/domains/structured-logging/required-shape.ts`
- negative proof 文件：corresponding `negative-proof-harness.ts` files
- manifest / owner mapping：`scripts/audit/domain-manifest.ts`
- 当前是否覆盖：static/law shape checks exist for many lifecycle concepts, but no end-to-end production mutation verifies that a start-mission dispatch either reaches accepted lifecycle events or fails before `MISSION_PREFLIGHT_PASSED`.
- 为什么没有拦住：audits do not replay the real runtime chain and assert required event progression from `NERVE_BUS_DISPATCH_STARTED` to accepted/rejected final state with owner/proof refs.

### 6. 为什么执法脚本没有拦住？

C. 法案存在，但 inspector 未覆盖。  
E. inspector 覆盖了 happy path，没有 negative proof。  
F. negative proof 没有生产代码突变验证。  
H. runtime 日志字段不足，无法让 inspector 或人定位.

### 7. 应修复层级，但本阶段不修

修生产代码：after command contract is fixed, ensure accepted mission emits orchestration start, activation freeze, map step, capability/PAV/forensics/final state events; ensure rejected commands fail before dispatch readiness.  
修施工图：state event progression expectations for rejected-before-dispatch versus accepted-after-dispatch.  
修 inspector：add event-chain verification for production start-mission scenarios.  
修 negative proof：mutate production path to suppress activation/PAV/Forensics event and require failure.  
修结构化日志：add run/mission/map/owner refs to rejection and lifecycle transition logs.  
是否需要申请修改法案：NO
