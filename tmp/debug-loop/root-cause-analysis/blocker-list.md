# Blocker List

## BLOCKER-1：P0 - `ORCHESTRATION_START_RECEIVED` 之后，`MISSION_ACTIVATION_SNAPSHOT_FROZEN` 因嵌套对象 `runId=null` 失败

### 1. 日志证据

```txt
[GRASSEYE][RUNTIME][PASS] runtime COMMANDER_COMMAND_ENVELOPE_BUILT success taskTemplateId resolved to requestedPlatformId=facebook-web; selectedMapId=facebook.seeding-video.discovery.meta.v1; activationSnapshotRef=activation-snapshot:8eb45f5d-09d1-4fd3-b717-1f062abac7ea:1.0.0:1.0.0 ownerResponsible="Commander Console" actionableMessage="Send the governed command through CommandTransportPort and Nerve Bus." traceId=trace_7e641c3a-9ca2-4040-b710-ad0782104a78 runId=trace_7e641c3a-9ca2-4040-b710-ad0782104a78 selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=trace_7e641c3a-9ca2-4040-b710-ad0782104a78,attempt_37797f99-1285-4d94-872b-9ccff13de06d,task_start
[GRASSEYE][RUNTIME][PASS] runtime NERVE_BUS_ENVELOPE_CREATED success Nerve Bus governed envelope created for start-mission. ownerResponsible="Commander Console / Nerve Bus" actionableMessage="Dispatch through Nerve Bus governed transport." traceId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230 runId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230 selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=commander_command_badff92f-01a1-4913-bb71-f553d8de8230,commander_command_badff92f-01a1-4913-bb71-f553d8de8230,task_start
[GRASSEYE][RUNTIME][EVENT] runtime ORCHESTRATION_START_RECEIVED started Orchestration received governed start-mission command from Nerve Bus. ownerResponsible=Orchestration actionableMessage="Freeze activation snapshot and select the governed operational map." traceId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230:facebook.seeding-video.discovery.meta.v1:commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run runId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=commander_command_badff92f-01a1-4913-bb71-f553d8de8230:facebook.seeding-video.discovery.meta.v1:commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run,commander-console:commander_command_badff92f-01a1-4913-bb71-f553d8de8230:attempt:1,task_start
[GRASSEYE][RUNTIME][FAIL] runtime MISSION_ACTIVATION_SNAPSHOT_FROZEN failed Mission start completed without a frozen activation snapshot. failureReason="[\n  {\n    \"code\": \"invalid_type\",\n    \"expected\": \"string\",\n    \"received\": \"null\",\n    \"path\": [\n      \"runId\"\n    ],\n    \"message\": \"Expected string, received null\"\n  }\n]" ownerResponsible="Orchestration / Map Plugin Registry" actionableMessage="Inspect Orchestration map selection and activation snapshot proof before retrying." traceId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230:facebook.seeding-video.discovery.meta.v1:commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run runId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=commander_command_badff92f-01a1-4913-bb71-f553d8de8230:facebook.seeding-video.discovery.meta.v1:commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run,commander-console:commander_command_badff92f-01a1-4913-bb71-f553d8de8230:attempt:1,task_start
```

- traceId：`commander_command_badff92f-01a1-4913-bb71-f553d8de8230:facebook.seeding-video.discovery.meta.v1:commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run`
- runId：`commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run`
- attemptId：MISSING
- missionId：MISSING
- taskTemplateId：MISSING
- selectedMapId：`facebook.seeding-video.discovery.meta.v1`
- requestedPlatformId：`facebook-web`
- activationSnapshotRef：`activation-snapshot:8eb45f5d-09d1-4fd3-b717-1f062abac7ea:1.0.0:1.0.0`
- commandId / envelopeId：`commander_command_badff92f-01a1-4913-bb71-f553d8de8230`
- stepId：`task_start`
- abilityGroupId：MISSING
- childCapabilityId：MISSING
- owner：MISSING
- ownerResponsible：`Orchestration / Map Plugin Registry`
- status：`failed`
- failureReason：`Expected string, received null` at `path=["runId"]`
- actionableMessage：`Inspect Orchestration map selection and activation snapshot proof before retrying.`

### 2. 实际行为

最新真实终端链已经证明：`runId` 并没有在 Commander 或 Nerve Bus 入口前丢失，因为 `ORCHESTRATION_START_RECEIVED` 这一条结构化运行事件本身携带的是非空 `runId`。真正失败的是 Orchestration 在“冻结 activation snapshot”这一跳里处理的某个嵌套对象，那个对象被 Zod 判定为 `runId=null`。因此，这个阻塞点不是“命令根本没有进入 Orchestration”，而是“命令已进入 Orchestration，但 activation snapshot / result / proof 链上的某个嵌套对象仍然带着 null runId”。

### 3. 法案原本要求

- 法案文件：`.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md`
- lawId：`GRASSEYE-ORCHESTRATION-CAPABILITY-008-V3`
- 主题：总调度结果与运行证明完整性
- 要求：Orchestration result/proof must preserve the real upstream chain, including `runId`, activation snapshot chain, state/proof/result parity, and no nullable activation/map chain fields in valid running execution.
- 禁止项：`runtimeProof:null`、fabricated runId、success without activationSnapshotRef、missing chain parity。
- 当前违反点：最新真实日志已经到达 Orchestration start boundary，但 activation snapshot freeze 处理中的嵌套对象仍然触发 `runId=null` 的 schema failure。

### 4. 施工图原本要求

- 施工图文件：`docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md`
- 章节：`### 21.1 runtime proof runId 链路补充`
- 要求：正确链路必须是 `Nerve Bus human_command.runId -> MissionCommand.runId -> MissionState.activeTaskRunId -> RuntimeProofSchema.runId -> buildOrchestrationRuntimeProof(input.runId)`；禁止 `preflight passed 后才发现 runId null`。
- 当前违反点：最新真实日志恰好就是在 `ORCHESTRATION_START_RECEIVED` 之后才暴露 `runId=null`，说明 live failing object 仍然破坏了 blueprint 规定的 runId 链路。

### 5. 根因定位

生产代码：

- 文件路径：`src/lib/local-runtime/workbench-human-command.ts`
- 函数 / class / route：`handleStartMission`
- 关键判断：当前工作区源码把 `runId: envelope.runId` 直传给 `runtime.orchestrationAbilityGroup.startMission(...)`，并且在调用前先记 `ORCHESTRATION_START_RECEIVED`。
- 为什么导致当前错误：这段代码说明当前源码层面的 start boundary 本身会传递非空 `runId`，所以最新真实失败不能再被归因到“Commander 根本没把 runId 送进 Orchestration”。

- 文件路径：`src/capabilities/orchestration/runtime/orchestration-executor-command-support.ts`
- 函数 / class / route：`createInitialMissionState`
- 关键判断：`activeTaskRunId: command.runId`。
- 为什么导致当前错误：当前源码层面的 MissionState 初始化也保留非空 `runId`，因此 live failing object 不是这条顶层 state 初始化链直接写出来的 null。

- 文件路径：`src/capabilities/orchestration/runtime/orchestration-proof-builder.ts`
- 函数 / class / route：`buildOrchestrationProofIdentityFields`
- 关键判断：`runId: input.runId`。
- 为什么导致当前错误：当前源码层面的 runtime proof builder 也明确从输入发出非空 `runId`，所以 latest live failure 已经被收窄到更深的 activation snapshot / result / proof 嵌套对象，而不是 proof builder 的显式顶层字段。

- 文件路径：`src/capabilities/orchestration/schema.ts`
- 函数 / class / route：`MissionCommandSchema`、`RuntimeProofSchema`、`MissionStateSchema`
- 关键判断：`MissionCommandSchema.runId` 和 `RuntimeProofSchema.runId` 当前都要求非空字符串；`MissionState.activeTaskRunId` 在 running 初始化路径由 `command.runId` 赋值。
- 为什么导致当前错误：当前源码与最新真实日志之间出现了明显分叉。可以确定的是，live failing process 暴露的 `runId=null` 发生在一个没有被当前日志直接展开的嵌套对象上，或者发生在早于当前工作区硬化的代码状态上。

执法代码：

- inspector 文件：`scripts/audit/domains/orchestration-capability/start-mission-boundary-checks.ts`、`scripts/audit/domains/orchestration-capability/run-governed-runtime-checks.ts`
- negative proof 文件：`scripts/audit/domains/orchestration-capability/negative-proof-harness.ts`
- manifest / owner mapping：`scripts/audit/domains/orchestration-capability/manifest.json`、`scripts/audit/domains/orchestration-capability/run-inspector.ts`
- 当前是否覆盖：当前工作区已经覆盖 `envelope.runId -> startMission`、`ORCHESTRATION_START_RECEIVED` / `MISSION_ACTIVATION_SNAPSHOT_FROZEN` 事件存在性、`MissionCommandSchema.safeParse`、以及 `runId:null` 的边界突变。
- 为什么没有拦住：这些是当前工作区里的在途加固，但没有经过本阶段 fresh real rerun 验证；并且现有 negative proof 主要覆盖“边界 runId 被置空”，还没有直接证明“activation snapshot / result / proof 嵌套对象 runId 被置空”这一更深层缺陷会被 machine-blocking 拦下。

### 6. 为什么执法脚本没有拦住？

归类：`C + E + F`

- `C`：法案已存在，但 authoritative live failure 发生时并没有被对应 inspector 在真实运行前拦住。
- `E`：当前 negative proof 主要覆盖 happy-path 边界和显式字段，不是更深的 activation snapshot 嵌套对象。
- `F`：缺少针对“更深层 nested object runId=null”这类生产代码突变的直接验证。

### 7. 应修复层级，但本阶段不修

- 修生产代码：把 `MISSION_ACTIVATION_SNAPSHOT_FROZEN` 对应的真实 failing object 直接固化为可追踪的 schema ref / payload ref，避免只留下 raw ZodError。
- 修施工图：把 activation snapshot freeze 失败路径也纳入明确的 runId non-null proof contract，而不是只写 accepted proof 链。
- 修 inspector：新增对 activation snapshot / failed result / runtime proof 深层 `runId=null` 突变的 owner-local 检查。
- 修 negative proof：新增“嵌套 activation snapshot / result / proof object 的 runId 改成 null”必须 FAIL 的生产突变。
- 修结构化日志：`MISSION_ACTIVATION_SNAPSHOT_FROZEN` 和 `COMMAND_REJECTED` 都要附带 schemaRef / commandEnvelopeRef / resultEnvelopeRef / runtimeProofRef / failingPayloadRef。
- 是否需要申请修改法案：`NO`

## BLOCKER-2：P0 - `MISSION_PREFLIGHT_PASSED` 之后仍然出现 `COMMAND_REJECTED(runId/null)`，说明 preflight 合同在最新失败路径上不够深

### 1. 日志证据

```txt
[GRASSEYE][RUNTIME][PASS] runtime MISSION_PREFLIGHT_PASSED success Mission preflight passed. Commander Console can dispatch the governed human command. ownerResponsible="Commander Console / Nerve Bus" actionableMessage="Dispatch the governed human command through Commander Console and Nerve Bus." traceId=trace_7e641c3a-9ca2-4040-b710-ad0782104a78 runId=trace_7e641c3a-9ca2-4040-b710-ad0782104a78 selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=trace_7e641c3a-9ca2-4040-b710-ad0782104a78,attempt_37797f99-1285-4d94-872b-9ccff13de06d,task_start
[GRASSEYE][RUNTIME][PASS] runtime COMMANDER_COMMAND_ENVELOPE_BUILT success taskTemplateId resolved to requestedPlatformId=facebook-web; selectedMapId=facebook.seeding-video.discovery.meta.v1; activationSnapshotRef=activation-snapshot:8eb45f5d-09d1-4fd3-b717-1f062abac7ea:1.0.0:1.0.0 ownerResponsible="Commander Console" actionableMessage="Send the governed command through CommandTransportPort and Nerve Bus." traceId=trace_7e641c3a-9ca2-4040-b710-ad0782104a78 runId=trace_7e641c3a-9ca2-4040-b710-ad0782104a78 selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=trace_7e641c3a-9ca2-4040-b710-ad0782104a78,attempt_37797f99-1285-4d94-872b-9ccff13de06d,task_start
[GRASSEYE][RUNTIME][EVENT] runtime NERVE_BUS_DISPATCH_STARTED started Dispatching start-mission via CommandTransportPort. ownerResponsible="Nerve Bus" actionableMessage="Wait for governed result envelope and semantic gate validation." traceId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230 runId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230 selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=commander_command_badff92f-01a1-4913-bb71-f553d8de8230,commander_command_badff92f-01a1-4913-bb71-f553d8de8230,task_start
[GRASSEYE][RUNTIME][FAIL] runtime COMMAND_REJECTED failed COMMAND_REJECTED failureReason="[\n  {\n    \"code\": \"invalid_type\",\n    \"expected\": \"string\",\n    \"received\": \"null\",\n    \"path\": [\n      \"runId\"\n    ],\n    \"message\": \"Expected string, received null\"\n  }\n]" ownerResponsible="Commander Console / Nerve Bus / Orchestration" actionableMessage="Inspect the latest debug bundle and fix the blocking dependency before retrying." traceId=trace_7e641c3a-9ca2-4040-b710-ad0782104a78 runId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=trace_7e641c3a-9ca2-4040-b710-ad0782104a78,attempt_37797f99-1285-4d94-872b-9ccff13de06d,task_start
```

- traceId：`trace_7e641c3a-9ca2-4040-b710-ad0782104a78`
- runId：`commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run`
- attemptId：MISSING
- missionId：MISSING
- taskTemplateId：MISSING
- selectedMapId：`facebook.seeding-video.discovery.meta.v1`
- requestedPlatformId：`facebook-web`
- activationSnapshotRef：`activation-snapshot:8eb45f5d-09d1-4fd3-b717-1f062abac7ea:1.0.0:1.0.0`
- commandId / envelopeId：`commander_command_badff92f-01a1-4913-bb71-f553d8de8230`
- stepId：`task_start`
- abilityGroupId：MISSING
- childCapabilityId：MISSING
- owner：MISSING
- ownerResponsible：`Commander Console / Nerve Bus / Orchestration`
- status：`failed`
- failureReason：`Expected string, received null` at `path=["runId"]`
- actionableMessage：`Inspect the latest debug bundle and fix the blocking dependency before retrying.`

### 2. 实际行为

系统先发出 `MISSION_PREFLIGHT_PASSED`，然后才创建 envelope、开始 Nerve Bus dispatch，最后在 Orchestration start boundary 之后失败。也就是说，preflight 并没有把这次真实失败路径上的关键 contract 证明完。当前工作区虽然已经新增 `MissionCommandSchema.safeParse` 预检，但最新真实日志仍然表明：只验证顶层 `MissionCommandSchema` 还不等于已经证明 activation snapshot freeze 期间使用的更深层对象不会出现 `runId=null`。

### 3. 法案原本要求

- 法案文件：`.github/instructions/cursor-rules/modules/module-commander-console-capability.instructions.md`
- lawId：`GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2`
- 主题：HumanCommandEnvelope 机器门禁
- 要求：Commander command path 必须在 transport 之前完成 schema gate、policy gate、map/platform gate、semantic gate，不能把“schema-valid but semantically mismatched result”放进 dispatch。
- 禁止项：silent default、invalid transport success、semantic mismatch after dispatch。
- 当前违反点：`MISSION_PREFLIGHT_PASSED` 之后仍然出现 `runId/null` 型 `COMMAND_REJECTED`，说明 preflight 并没有把这次真实失败链上的 contract 全部机器证明掉。

### 4. 施工图原本要求

- 施工图文件：`docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md`
- 章节：`start-mission preflight 补充`
- 要求：`Local App Shell` 在 Nerve Bus dispatch 前必须用 `MissionCommandSchema` 对最终 `start-mission` command 做 dry-run validation；`READY` 标准明确写着 `preflight passed 后不允许出现仅因 MissionCommandSchema path=runId/null 导致的 COMMAND_REJECTED`。
- 当前违反点：最新真实日志仍然给出了 `MISSION_PREFLIGHT_PASSED -> COMMAND_REJECTED(path=runId/null)`，说明 live failing path 至少在 authoritative runtime 上没有被 preflight 合同完全挡住。

### 5. 根因定位

生产代码：

- 文件路径：`src/lib/local-runtime/workbench-status.ts`
- 函数 / class / route：`getMissionStartPreflight`
- 关键判断：当前工作区预检组件已经包含 `commandTransportContract` 和 `missionCommandSchema` 相关检查。
- 为什么导致当前错误：它证明了当前工作区已经开始修这类问题，但最新真实日志依然说明 authoritative failing run 发生时，这层 contract 还没有在运行前真正把问题挡掉。

- 文件路径：`src/lib/local-runtime/workbench-mission-command-preflight.ts`
- 函数 / class / route：`checkMissionCommandSchemaPreflight`
- 关键判断：当前实现用合成输入执行 `MissionCommandSchema.safeParse(...)`。
- 为什么导致当前错误：这个 dry-run 只覆盖顶层 `MissionCommandSchema`。而最新真实失败链已经进入 `ORCHESTRATION_START_RECEIVED` 之后，说明 live failing object 很可能更深于这层顶层 command shape。

- 文件路径：`src/lib/local-app-shell/task-start-flow.ts`
- 函数 / class / route：task start flow
- 关键判断：当前工作区会把 `taskTemplateId`、`activationId`、`activationSnapshotRef`、`targetProfileRef` 等合同字段送入 preflight。
- 为什么导致当前错误：这说明工作区已经在修 preflight 深度，但 latest real runtime failure 不能被 retroactively 当作“已经被挡住”。

执法代码：

- inspector 文件：`scripts/audit/domains/commander-console-capability/run-startup-readiness-gate-checks.ts`
- negative proof 文件：`scripts/audit/domains/orchestration-capability/negative-proof-harness.ts`
- manifest / owner mapping：`scripts/audit/domains/commander-console-capability/manifest.json`
- 当前是否覆盖：当前工作区已经要求 preflight contract fields、`MissionCommandSchema.safeParse`、以及 terminal relay 关键字段。
- 为什么没有拦住：这些 current-worktree checks 证明的是“现在的工作区正在硬化这个路径”，并不等于“latest authoritative real run 已经被这套脚本机器拦下”；同时它们也还没有直接验证 activation snapshot freeze 使用的深层 nested object。

### 6. 为什么执法脚本没有拦住？

归类：`C + E + F`

- `C`：法案和施工图都已经存在，但 failing run 仍然在 preflight pass 之后穿过去了。
- `E`：current checks 更偏顶层 command/preflight happy path，没有直接证明更深层 activation snapshot nested object。
- `F`：缺少“preflight 已通过，但 activation snapshot / result / proof 深层对象 runId 仍被置空”的生产突变验证。

### 7. 应修复层级，但本阶段不修

- 修生产代码：把 preflight 从“顶层 MissionCommandSchema dry-run”扩展为“最终 start boundary contract + activation snapshot freeze input/result/proof contract”证明链。
- 修施工图：明确 preflight READY 不仅要求顶层 command shape 正确，还要求 activation snapshot freeze 的关键输入对象不存在 `runId=null`。
- 修 inspector：新增从 `task-start-flow` 到 `MISSION_ACTIVATION_SNAPSHOT_FROZEN` 失败对象的 contract 追踪。
- 修 negative proof：新增“preflight 仍然 passed，但 activation snapshot deeper object 被置成 runId=null”必须 FAIL 的突变。
- 修结构化日志：preflight pass 后如果后续 still reject，必须给出更深层失败对象 ref，而不是只给 raw ZodError。
- 是否需要申请修改法案：`NO`

## BLOCKER-3：P1 - 持久化 runtime/debug 证据与最新真实终端链不一致，而且 refs/proofRefs 不足，导致仅靠日志无法定位 `runId=null` 的嵌套来源

### 1. 日志证据

最新真实终端链：

```txt
[GRASSEYE][RUNTIME][EVENT] runtime ORCHESTRATION_START_RECEIVED started ... runId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run ...
[GRASSEYE][RUNTIME][FAIL] runtime MISSION_ACTIVATION_SNAPSHOT_FROZEN failed ... path=["runId"] ... runId=commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run ...
```

对比用的旧快照：

```json
{
  "eventType": "MISSION_PREFLIGHT_PASSED",
  "createdAt": "2026-05-05T03:04:50.936Z",
  "traceId": "trace_78089910-c8b7-4b62-bd52-913bdaa77d97",
  "runId": null,
  "attemptId": "attempt_a84a2ff6-6922-4702-8364-9a1542c82d7c",
  "missionId": null,
  "taskTemplateId": "tiktok-seeding-video-discovery",
  "mapId": "tiktok.seeding-video.discovery.meta.v1",
  "activationSnapshotRef": null,
  "abilityGroupId": "commander-console",
  "childCapabilityId": "issue-human-command",
  "owner": "Commander Console",
  "ownerResponsible": "Commander Console / Nerve Bus",
  "status": "success",
  "refs": [],
  "proofRefs": []
}
```

- traceId：`trace_7e641c3a-9ca2-4040-b710-ad0782104a78`（最新真实终端链） / `trace_78089910-c8b7-4b62-bd52-913bdaa77d97`（旧快照）
- runId：`commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run`（最新真实终端链） / `null`（旧快照）
- attemptId：MISSING（最新真实终端链） / `attempt_a84a2ff6-6922-4702-8364-9a1542c82d7c`（旧快照）
- missionId：MISSING（最新真实终端链） / `null`（旧快照）
- taskTemplateId：MISSING（最新真实终端链） / `tiktok-seeding-video-discovery`（旧快照）
- selectedMapId：`facebook.seeding-video.discovery.meta.v1`（最新真实终端链） / `tiktok.seeding-video.discovery.meta.v1`（旧快照）
- requestedPlatformId：`facebook-web`（最新真实终端链） / MISSING（旧快照）
- activationSnapshotRef：`activation-snapshot:8eb45f5d-09d1-4fd3-b717-1f062abac7ea:1.0.0:1.0.0`（最新真实终端链） / `null`（旧快照）
- commandId / envelopeId：`commander_command_badff92f-01a1-4913-bb71-f553d8de8230`（最新真实终端链） / MISSING（旧快照）
- stepId：`task_start`
- abilityGroupId：MISSING（最新真实终端链） / `commander-console`（旧快照）
- childCapabilityId：MISSING（最新真实终端链） / `issue-human-command`（旧快照）
- owner：MISSING（最新真实终端链） / `Commander Console`（旧快照）
- ownerResponsible：`Commander Console / Nerve Bus / Orchestration`（最新真实终端链拒绝行） / `Commander Console / Nerve Bus`（旧快照）
- status：`failed`（最新真实终端链） / `success`（旧快照这条行本身）
- failureReason：`Expected string, received null` at `path=["runId"]`
- actionableMessage：最新真实终端链有；旧快照有，但 `refs/proofRefs` 为空

### 2. 实际行为

如果只看仓库里已有的 `current-runtime-log-snapshot.json` 和旧的 root-cause-analysis，会得到一个错误结论：仿佛 `runId` 在 Commander 侧就已经丢了。可最新真实终端链明确证明，最新失败已经推进到 `ORCHESTRATION_START_RECEIVED`。这说明当前系统至少还有一个 P1 observability blocker：持久化 snapshot 与真实终端链不一致，而且旧 snapshot 缺少 `commandEnvelopeRef/resultEnvelopeRef/runtimeProofRef`，无法仅靠日志把 nested `runId=null` 反向追到具体对象。

### 3. 法案原本要求

- 法案文件：`.github/instructions/cursor-rules/modules/module-commander-console-capability.instructions.md`
- lawId：`GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2`
- 主题：控制台 proof 与结果完整性
- 要求：Commander runtime result / proof 必须保留 command/read chain，public execute 不能 fake success，`runtimeProof` 不能为 null。
- 禁止项：`runtimeProof: null`、naked throw、no-op success。
- 当前违反点：旧持久化 snapshot 没给出足够的 refs/proofRefs 去定位 command/result/proof 链，而且现有 repo 内历史快照与最新真实终端链彼此冲突。

### 4. 施工图原本要求

- 施工图文件：`docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md`
- 章节：`### 18.1 start-mission runId 传输契约补充`
- 要求：`COMMAND_REJECTED` 必须暴露 `ownerResponsible/actionableMessage`，并把 `commandEnvelopeRef/resultEnvelopeRef/runtimeProofRef` 放入 `refs/proofRefs`。
- 当前违反点：旧持久化 snapshot 的 `refs` / `proofRefs` 为空，无法仅靠 snapshot 定位失败对象；旧分析也因此把根因错误前移到了 Commander 侧。

### 5. 根因定位

生产代码：

- 文件路径：`src/lib/local-app-shell/task-start-dispatch-result.ts`
- 函数 / class / route：`collectDispatchResultRefs`、`writeTaskStartDispatchResult`
- 关键判断：当前工作区已经从 `runtimeProof` 收集 `runId`、`commandEnvelopeRef`、`resultEnvelopeRef`、`runtimeProofRef`，并在 `COMMAND_REJECTED` 中写入 `refs/proofRefs`。
- 为什么导致当前错误：这证明 observability 加固正在工作区里成型，但旧 snapshot 显示 authoritative failing run 并没有留下这条链，因此不能把旧 snapshot 当成最新事实。

- 文件路径：`src/lib/local-runtime/workbench-commander-debug.ts`
- 函数 / class / route：`recordCommanderDebugEvent`
- 关键判断：当前工作区会把 `refs/inputRefs/outputRefs/proofRefs/artifactRefs` 透传到 `StructuredRuntimeEvent` 和 Forensics write。
- 为什么导致当前错误：当前源码说明 refs/proofRefs 透传已经被补强，但旧 snapshot 和旧分析文件说明这条能力没有通过 latest authoritative runtime evidence 被验证。

执法代码：

- inspector 文件：`scripts/audit/domains/commander-console-capability/run-commander-runtime-runid-checks.ts`、`scripts/audit/domains/commander-console-capability/run-startup-readiness-gate-checks.ts`
- negative proof 文件：`scripts/audit/domains/commander-console-capability/negative-proof-harness.ts`
- manifest / owner mapping：`scripts/audit/domains/commander-console-capability/manifest.json`
- 当前是否覆盖：当前工作区 inspector 已经检查 debug refs 透传、dispatch result refs、terminal relay 字段。
- 为什么没有拦住：旧 snapshot 与旧分析形成于这些 hardening 之前，或者至少没有被 fresh real rerun 重新证明；因此 latest authoritative blocker 仍然存在“仅靠持久化日志不够定位”的现实问题。

### 6. 为什么执法脚本没有拦住？

归类：`H + C + E`

- `H`：runtime 日志字段和持久化 refs 不足，无法单凭日志定位 nested null source。
- `C`：法案和施工图要求已存在，但旧持久化 evidence 并不满足它们。
- `E`：当前硬化尚未通过 latest real rerun 形成新的 authoritative evidence。

### 7. 应修复层级，但本阶段不修

- 修生产代码：所有 `COMMAND_REJECTED` / `MISSION_ACTIVATION_SNAPSHOT_FROZEN` 都要把 `commandEnvelopeRef/resultEnvelopeRef/runtimeProofRef/schemaRef` 持久化。
- 修施工图：补充“旧 snapshot 不能替代最新 raw terminal evidence”的 evidence priority 规则。
- 修 inspector：要求 per-run snapshot 文件名带 startup runId，防止 03:04/03:28/04:09 混写。
- 修 negative proof：删除 refs/proofRefs 透传必须 FAIL，而且必须验证 persisted API snapshot 不为空。
- 修结构化日志：terminal、runtime debug API、Forensics 三处 refs/proofRefs 必须同链。
- 是否需要申请修改法案：`NO`

## BLOCKER-4：P1 - owner-local 审计对这条 `runId/null` 链路已有在途加固，但 authoritative live failure 发生时并没有被 machine-blocking 执法提前拦住

### 1. 日志证据

真实运行失败：

```txt
[GRASSEYE][RUNTIME][FAIL] runtime MISSION_ACTIVATION_SNAPSHOT_FROZEN failed ... path=["runId"] ... ownerResponsible="Orchestration / Map Plugin Registry" ...
[GRASSEYE][RUNTIME][FAIL] runtime COMMAND_REJECTED failed COMMAND_REJECTED ... path=["runId"] ... ownerResponsible="Commander Console / Nerve Bus / Orchestration" ...
```

当前工作区审计输出：

```txt
> grasseye-local-workbench@0.1.0 audit:orchestration
> node --import tsx scripts/audit/domains/orchestration-capability/run-inspector.ts

[FAKE ENFORCEMENT] orchestration-capability: Human command start or preflight can still lose runId, omit start-boundary logs, or discover MissionCommandSchema failures after dispatch.
- FATAL src/lib/local-runtime/workbench-human-command.ts:1 Human command start boundary must emit ORCHESTRATION_START_RECEIVED and MISSION_ACTIVATION_SNAPSHOT_FROZEN structured runtime events.
- FATAL scripts/audit/domains/orchestration-capability/inspector.ts:1 Orchestration inspector baseline must pass before negative-proof mutation checks.
```

- traceId：`trace_7e641c3a-9ca2-4040-b710-ad0782104a78`
- runId：`commander_command_badff92f-01a1-4913-bb71-f553d8de8230:run`
- attemptId：MISSING
- missionId：MISSING
- taskTemplateId：MISSING
- selectedMapId：`facebook.seeding-video.discovery.meta.v1`
- requestedPlatformId：`facebook-web`
- activationSnapshotRef：`activation-snapshot:8eb45f5d-09d1-4fd3-b717-1f062abac7ea:1.0.0:1.0.0`
- commandId / envelopeId：`commander_command_badff92f-01a1-4913-bb71-f553d8de8230`
- stepId：`task_start`
- abilityGroupId：MISSING
- childCapabilityId：MISSING
- owner：MISSING
- ownerResponsible：`Commander Console / Nerve Bus / Orchestration` / `Orchestration / Map Plugin Registry`
- status：`failed`
- failureReason：`Expected string, received null` at `path=["runId"]`
- actionableMessage：`Inspect the latest debug bundle and fix the blocking dependency before retrying.`

### 2. 实际行为

最新真实运行已经失败了，但当前工作区里同时又已经出现了针对这条链路的 owner-local 硬化：`start-mission-boundary-checks.ts` 检查 `envelope.runId -> startMission`、检查 `ORCHESTRATION_START_RECEIVED` / `MISSION_ACTIVATION_SNAPSHOT_FROZEN`、检查 `MissionCommandSchema.safeParse`；`negative-proof-harness.ts` 还加入了 `runId:null`、删除 start-boundary log、删除 safeParse 的生产突变。换句话说，系统当前处于“live failure 已发生，但 owner-local enforcement 仍在补强且未通过 fresh real rerun 验证”的状态。

### 3. 法案原本要求

- 法案文件：`.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md`
- lawId：`GRASSEYE-ORCHESTRATION-CAPABILITY-008-V3`
- 主题：总调度结果与运行证明完整性
- 要求：该 law 是 `machine-blocking`，并明确要求 schema field checks、state/proof/result parity、activation chain non-null、dispatch proof invariant，以及 negative proof 覆盖删除关键字段必须 FAIL。
- 禁止项：fabricated runId、runtimeProof:null、activation chain nullable、没有 negative proof 的假通过。
- 当前违反点：authoritative live failure 已经发生，但 current-worktree audit 还在补强和校正 baseline，本阶段也没有 fresh rerun 证明它已经真正 machine-blocking 地挡住了这条 failure。

### 4. 施工图原本要求

- 施工图文件：`docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md`
- 章节：`### 21.1 runtime proof runId 链路补充`
- 要求：inspector 必须覆盖 `MissionCommandSchema.runId`、`RuntimeProofSchema.runId`、`BuildProofInput.runId`、`buildOrchestrationRuntimeProof(input.runId)`；negative proof 必须覆盖删除这些字段必须 FAIL。
- 当前违反点：当前工作区已经开始实现这些检查，但 latest authoritative live failure 说明在真实运行前它并没有形成可验证的闭环。

### 5. 根因定位

生产代码：

- 文件路径：`src/lib/local-runtime/workbench-human-command.ts`
- 函数 / class / route：`handleStartMission`
- 关键判断：当前工作区实现 start-boundary logs 和 `runId` 透传。
- 为什么导致当前错误：这说明生产代码正在补强，但也意味着旧的 live failure 不能被直接当作“当前源码已被验证修复”。

执法代码：

- inspector 文件：`scripts/audit/domains/orchestration-capability/start-mission-boundary-checks.ts`、`scripts/audit/domains/orchestration-capability/run-governed-runtime-checks.ts`、`scripts/audit/domains/commander-console-capability/run-commander-runtime-runid-checks.ts`
- negative proof 文件：`scripts/audit/domains/orchestration-capability/negative-proof-harness.ts`
- manifest / owner mapping：`scripts/audit/domains/orchestration-capability/manifest.json`、`scripts/audit/domains/orchestration-capability/run-inspector.ts`
- 当前是否覆盖：当前工作区已经覆盖边界 runId 透传、event 名称存在性、`MissionCommandSchema.safeParse`、`RuntimeProofSchema.runId` 和 proof builder runId 发出。
- 为什么没有拦住：当前 audit 输出本身提示 baseline 仍需要先过，negative proof 才能证明 fail -> rollback -> pass；同时它还没有直接覆盖更深层 nested activation snapshot object 的 runId null mutation。

### 6. 为什么执法脚本没有拦住？

归类：`C + E + F + G`

- `C`：法案已经存在，owner-local audit 也在补上，但 live failure 依然发生了。
- `E`：当前 mutation coverage 以边界和显式 schema 字段为主，不是更深层 nested object。
- `F`：缺少“更深层 activation snapshot nested runId null”生产突变。
- `G`：当前审计输出已经明确显示 baseline 不通过时 negative-proof harness 无法完成完整的 fail -> rollback -> pass 证明闭环。

### 7. 应修复层级，但本阶段不修

- 修生产代码：在 activation snapshot freeze fail path 上增加可追踪 proof/schema refs。
- 修施工图：把“authoritative live rerun through hardened inspector”写成 closeout 前置条件。
- 修 inspector：baseline 必须先 PASS，再允许 negative proof 和 real rerun closeout。
- 修 negative proof：新增更深层 nested activation snapshot / result / proof object 的 runId null mutation。
- 修结构化日志：让审计输出、terminal relay、persisted debug API 可以共享同一条失败链 refs。
- 是否需要申请修改法案：`NO`
