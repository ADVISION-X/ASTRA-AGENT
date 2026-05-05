# Blocker List

## BLOCKER-1: Screenshot dispatch builder drops required chain fields before Screenshot Ability entry

Priority: P0

### 1. 日志证据

Facebook:

```txt
[GRASSEYE][RUNTIME][PASS] runtime HUMAN_COMMAND_VALIDATED success requestedPlatformId=facebook-web; selectedMapId=facebook.seeding-video.discovery.meta.v1 ownerResponsible="Commander Console" actionableMessage="Run mission preflight before dispatching the governed human command." traceId=trace_6928e0b9-d4d5-4de9-abcf-5a722549110d runId=trace_6928e0b9-d4d5-4de9-abcf-5a722549110d selectedMapId=facebook.seeding-video.discovery.meta.v1 ...
[GRASSEYE][RUNTIME][PASS] runtime COMMANDER_COMMAND_ENVELOPE_BUILT success taskTemplateId resolved to requestedPlatformId=facebook-web; selectedMapId=facebook.seeding-video.discovery.meta.v1; activationSnapshotRef=activation-snapshot:1aed09b9-262d-415c-982d-f415e5910c05:1.0.0:1.0.0 ownerResponsible="Commander Console" actionableMessage="Send the governed command through CommandTransportPort and Nerve Bus." ...
[GRASSEYE][RUNTIME][PASS] runtime MAP_STEP_SELECTED success Orchestration selected governed step "capture-video-viewport" from the frozen operational map. ownerResponsible=Orchestration actionableMessage="Evaluate governed dispatch gates before sending the step through Nerve Bus." traceId=commander_command_d224faec-7fd1-4db5-8f03-1edef9f0bb3c:run runId=commander_command_d224faec-7fd1-4db5-8f03-1edef9f0bb3c:run selectedMapId=facebook.seeding-video.discovery.meta.v1 activationSnapshotRef=activation-snapshot:1aed09b9-262d-415c-982d-f415e5910c05:1.0.0:1.0.0 ...
[GRASSEYE][RUNTIME][EVENT] runtime STEP_DISPATCH_STARTED started Dispatching step "capture-video-viewport" to ability group "screenshot". ownerResponsible="Orchestration / Nerve Bus" actionableMessage="Wait for the governed step result before evaluating transitions." traceId=commander_command_d224faec-7fd1-4db5-8f03-1edef9f0bb3c:run runId=commander_command_d224faec-7fd1-4db5-8f03-1edef9f0bb3c:run selectedMapId=facebook.seeding-video.discovery.meta.v1 activationSnapshotRef=activation-snapshot:1aed09b9-262d-415c-982d-f415e5910c05:1.0.0:1.0.0 ...
[GRASSEYE][RUNTIME][FAIL] runtime CAPABILITY_CALL_FAILED failed Governed step "capture-video-viewport" returned status "failed". failureReason="[ ... \"path\": [\"stepId\"] ... [\"mapPackageId\"] ... [\"mapPackageVersion\"] ... [\"selectedMapId\"] ... [\"selectedMapVersion\"] ... [\"activationSnapshotRef\"] ... [\"capabilityCallId\"] ... [\"nerveBusEnvelopeId\"] ... [\"inputRef\"] ... ]" ownerResponsible="Orchestration / screenshot" actionableMessage="Inspect the blocking step result and runtime proof before retrying." traceId=commander_command_d224faec-7fd1-4db5-8f03-1edef9f0bb3c:run runId=commander_command_d224faec-7fd1-4db5-8f03-1edef9f0bb3c:run selectedMapId=facebook.seeding-video.discovery.meta.v1 activationSnapshotRef=activation-snapshot:1aed09b9-262d-415c-982d-f415e5910c05:1.0.0:1.0.0 ...
[GRASSEYE][RUNTIME][FAIL] runtime MISSION_FAILED failed Mission reached terminal status "failed" after step "capture-video-viewport". failureReason="[same missing required fields]" ownerResponsible=Orchestration actionableMessage="Inspect the mission runtime proof and blocking step outcome before retrying." traceId=commander_command_d224faec-7fd1-4db5-8f03-1edef9f0bb3c:run runId=commander_command_d224faec-7fd1-4db5-8f03-1edef9f0bb3c:run selectedMapId=facebook.seeding-video.discovery.meta.v1 activationSnapshotRef=activation-snapshot:1aed09b9-262d-415c-982d-f415e5910c05:1.0.0:1.0.0 ...
```

TikTok repeats the same blocker with the same missing fields:

```txt
[GRASSEYE][RUNTIME][PASS] runtime HUMAN_COMMAND_VALIDATED success requestedPlatformId=tiktok-web; selectedMapId=tiktok.seeding-video.discovery.meta.v1 ...
[GRASSEYE][RUNTIME][PASS] runtime COMMANDER_COMMAND_ENVELOPE_BUILT success taskTemplateId resolved to requestedPlatformId=tiktok-web; selectedMapId=tiktok.seeding-video.discovery.meta.v1; activationSnapshotRef=activation-snapshot:cdc353c6-9686-4d5c-aae0-d5f8572ab58f:1.0.0:1.0.0 ...
[GRASSEYE][RUNTIME][EVENT] runtime STEP_DISPATCH_STARTED started Dispatching step "capture-video-viewport" to ability group "screenshot". ... traceId=commander_command_ba940d01-60fe-46b5-9362-8414fbae3171:run runId=commander_command_ba940d01-60fe-46b5-9362-8414fbae3171:run selectedMapId=tiktok.seeding-video.discovery.meta.v1 activationSnapshotRef=activation-snapshot:cdc353c6-9686-4d5c-aae0-d5f8572ab58f:1.0.0:1.0.0 ...
[GRASSEYE][RUNTIME][FAIL] runtime CAPABILITY_CALL_FAILED failed Governed step "capture-video-viewport" returned status "failed". failureReason="[same missing required fields]" ownerResponsible="Orchestration / screenshot" actionableMessage="Inspect the blocking step result and runtime proof before retrying." traceId=commander_command_ba940d01-60fe-46b5-9362-8414fbae3171:run runId=commander_command_ba940d01-60fe-46b5-9362-8414fbae3171:run selectedMapId=tiktok.seeding-video.discovery.meta.v1 activationSnapshotRef=activation-snapshot:cdc353c6-9686-4d5c-aae0-d5f8572ab58f:1.0.0:1.0.0 ...
```

字段逐项填写：

- traceId：`commander_command_d224faec-7fd1-4db5-8f03-1edef9f0bb3c:run`；`commander_command_ba940d01-60fe-46b5-9362-8414fbae3171:run`
- runId：`commander_command_d224faec-7fd1-4db5-8f03-1edef9f0bb3c:run`；`commander_command_ba940d01-60fe-46b5-9362-8414fbae3171:run`
- attemptId：MISSING
- missionId：MISSING
- taskTemplateId：`facebook-seeding-video-discovery`；`tiktok-seeding-video-discovery`
- selectedMapId：`facebook.seeding-video.discovery.meta.v1`；`tiktok.seeding-video.discovery.meta.v1`
- requestedPlatformId：`facebook-web`；`tiktok-web`
- activationSnapshotRef：`activation-snapshot:1aed09b9-262d-415c-982d-f415e5910c05:1.0.0:1.0.0`；`activation-snapshot:cdc353c6-9686-4d5c-aae0-d5f8572ab58f:1.0.0:1.0.0`
- commandId / envelopeId：MISSING
- stepId：`capture-video-viewport`
- abilityGroupId：MISSING
- childCapabilityId：MISSING
- owner：MISSING
- ownerResponsible：`Orchestration / screenshot`
- status：`failed`
- failureReason：missing required string fields `stepId` / `mapPackageId` / `mapPackageVersion` / `selectedMapId` / `selectedMapVersion` / `activationSnapshotRef` / `capabilityCallId` / `nerveBusEnvelopeId` / `inputRef`
- actionableMessage：`Inspect the blocking step result and runtime proof before retrying.`

### 2. 实际行为

Orchestration 已经成功冻结 activation snapshot，并把 mission 推进到 `capture-video-viewport`。截图步骤在真正执行浏览器截图之前就被 Screenshot 输入 schema 拦截，因为进入 Screenshot Ability Group 的请求对象缺了整组链路字段。

这不是 activation snapshot 没生成，也不是 map step 没选中，更不是 screenshot executor 内部捕获失败。问题发生在 Orchestration 生成好 Nerve Bus envelope 之后，到本地 runtime 把 envelope 转成 `ScreenshotAbilityInput` 之前的适配边界。

### 3. 法案原本要求

主法案：

- 法案文件：`.github/instructions/cursor-rules/modules/module-screenshot-capability.instructions.md`
- lawId：`GRASSEYE-SCREENSHOT-CAPABILITY-003-V2`
- 主题：截图输入链路完整性
- 要求：Every `ScreenshotAbilityInput` must carry full mission/map/step/capability chain fields, `inputRef`, `idempotencyKey`, and timeout policy.
- 禁止项：Missing `stepId`, `capabilityCallId`, `activationSnapshotRef`, `nerveBusEnvelopeId`, `mapPackageVersion`, `selectedMapVersion`, or `inputRef` must fail/review_required; never success.
- 当前违反点：最新真实日志显示 Screenshot Ability 输入在入口处缺失上述字段并立即失败。

支撑法案：

- 法案文件：`.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md`
- lawId：`GRASSEYE-ORCHESTRATION-CAPABILITY-004-V3`
- 主题：Nerve Bus 调度出口唯一
- 要求：Every ability input generated from Orchestration must include `missionId/runId/stepId/mapPackageId/mapPackageVersion/selectedMapId/selectedMapVersion/activationSnapshotRef/capabilityCallId/nerveBusEnvelopeId/sourceRef/inputRef/idempotencyKey`.
- 当前违反点：Orchestration envelope 具备完整链路，但传入 Screenshot Ability 的最终输入对象没有保持这些字段。

### 4. 施工图原本要求

主施工图：

- 施工图文件：`docs/法案辅助文件/GrassEye Screenshot 能力组施工图.md`
- 章节：`5. Input Boundary` / `6. Source Proof`
- 要求：`ScreenshotAbilityInput` 必须包含 `stepId`、`mapPackageId`、`mapPackageVersion`、`selectedMapId`、`selectedMapVersion`、`activationSnapshotRef`、`capabilityCallId`、`nerveBusEnvelopeId`、`inputRef`、`idempotencyKey`；缺失这些字段不得 success。
- 当前违反点：最新运行在 Screenshot 输入边界就缺少这些必填字段。

支撑施工图：

- 施工图文件：`docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md`
- 章节：`9. Dispatch Through Nerve Bus`
- 要求：Dispatch payload 必须包含 full chain fields，包括 `stepId`、`mapPackageId`、`selectedMapVersion`、`activationSnapshotRef`、`capabilityCallId`、`inputRef`。
- 当前违反点：dispatch payload 链路字段没有完整投射到 Screenshot Ability 输入适配层。

### 5. 根因定位

生产代码：

- 文件路径：`src/capabilities/orchestration/runtime/orchestration-nerve-bus-envelope-builders.ts`
- 函数 / class / route：`buildOrchestrationSharedEnvelope`、`buildAbilityDispatchEnvelope`
- 关键判断：这里已经把 `missionId`、`runId`、`stepId`、`mapPackageId`、`mapPackageVersion`、`selectedMapId`、`selectedMapVersion`、`activationSnapshotRef`、`capabilityCallId`、`nerveBusEnvelopeId`、`inputRef`、`idempotencyKey` 全部写进 envelope。
- 为什么导致当前错误：这段代码本身不是故障点，但它证明上游链路字段是存在的，问题发生在后续 adapter mapping。

- 文件路径：`src/lib/local-runtime/workbench-ability-command-executor.ts`
- 函数 / class / route：`executeVisualAbilityCommand`
- 关键判断：Screenshot 目标统一走 `runtime.screenshotAbilityGroup.execute(buildScreenshotCommand(envelope, inputPayload))`。
- 为什么导致当前错误：该调用点把真实控制路径锁定在 `buildScreenshotCommand`。

- 文件路径：`src/lib/local-runtime/workbench-action-dispatch-inputs.ts`
- 函数 / class / route：`buildScreenshotCommand`
- 关键判断：函数只返回 `abilityGroupId`、`childCapabilityId`、`sessionId`、`roundId`、`videoVisitId`、`missionId`、`runId`、`requestedBy`、`purpose`、`sourceAbilityGroupId`、`sourceChildCapabilityId`、`idempotencyKey`，没有把 `stepId`、`mapPackageId`、`mapPackageVersion`、`selectedMapId`、`selectedMapVersion`、`activationSnapshotRef`、`capabilityCallId`、`nerveBusEnvelopeId`、`inputRef` 带进去。
- 为什么导致当前错误：本地 runtime 在这里把 governed envelope 缩成了一个不完整的 Screenshot 输入对象，直接触发 Screenshot 输入 gate 失败。

- 文件路径：`src/capabilities/screenshot/runtime/screenshot-input-gate.ts`
- 函数 / class / route：`resolveMissingRequiredFieldFailure`、`runScreenshotInputGate`
- 关键判断：遍历 `SCREENSHOT_REQUIRED_INPUT_FIELDS`，缺失必填链路字段就 fail closed。
- 为什么导致当前错误：这就是最新终端日志里那组 `invalid_type` 缺字段错误的直接来源。

执法代码：

- inspector 文件：`scripts/audit/domains/screenshot-capability/config.ts`、`scripts/audit/domains/screenshot-capability/project-access.ts`、`scripts/audit/domains/screenshot-capability/required-shape.ts`
- negative proof 文件：`scripts/audit/domains/screenshot-capability/negative-proof-harness.ts`
- manifest / owner mapping：Screenshot audit canonical scope 只覆盖 `src/capabilities/screenshot/**`
- 当前是否覆盖：NO，未覆盖跨边界 local-runtime screenshot adapter
- 为什么没有拦住：`config.ts` 的 `PATHS.ROOT` 和 `CANONICAL_FILES` 只看 Screenshot owner 内部文件；`project-access.ts` 只收集 `src/capabilities/screenshot/**`；`negative-proof-harness.ts` 没有对 `src/lib/local-runtime/workbench-action-dispatch-inputs.ts` 做突变验证。

### 6. 为什么执法脚本没有拦住？

C. 法案存在，但 inspector 未覆盖跨边界 adapter。
D. inspector 主要检查 screenshot 域内 schema/gate/builder 片段，没有做 envelope-to-input 数据流覆盖。
E. negative proof 没有“删除 buildScreenshotCommand 链路字段应失败”的突变。

### 7. 应修复层级，但本阶段不修

- 修生产代码：YES
- 修施工图：YES，明确 local-runtime screenshot adapter 必须原样投射 governed chain fields
- 修 inspector：YES，把 `src/lib/local-runtime/workbench-action-dispatch-inputs.ts` 或统一 envelope-to-input adapter 纳入 owner enforcement
- 修 negative proof：YES，增加删除 `stepId` / `activationSnapshotRef` / `capabilityCallId` / `inputRef` 的 adapter mutation
- 修结构化日志：YES，增加 adapter 输入链路完整性 debug 证据，便于第一眼定位边界丢字段
- 是否需要申请修改法案：NO

## BLOCKER-2: Runtime lifecycle lacks explicit CAPABILITY_CALL_STARTED event

Priority: P1

### 1. 日志证据

Facebook open step:

```txt
[GRASSEYE][RUNTIME][EVENT] runtime STEP_DISPATCH_STARTED started Dispatching step "open-facebook-reels" to ability group "open". ownerResponsible="Orchestration / Nerve Bus" actionableMessage="Wait for the governed step result before evaluating transitions." traceId=commander_command_d224faec-7fd1-4db5-8f03-1edef9f0bb3c:run runId=commander_command_d224faec-7fd1-4db5-8f03-1edef9f0bb3c:run selectedMapId=facebook.seeding-video.discovery.meta.v1 activationSnapshotRef=activation-snapshot:1aed09b9-262d-415c-982d-f415e5910c05:1.0.0:1.0.0 ...
[GRASSEYE][RUNTIME][PASS] runtime CAPABILITY_CALL_COMPLETED success Governed step "open-facebook-reels" returned status "success". ownerResponsible="Orchestration / open" actionableMessage="Evaluate the declared transition for this step result." traceId=commander_command_d224faec-7fd1-4db5-8f03-1edef9f0bb3c:run runId=commander_command_d224faec-7fd1-4db5-8f03-1edef9f0bb3c:run selectedMapId=facebook.seeding-video.discovery.meta.v1 activationSnapshotRef=activation-snapshot:1aed09b9-262d-415c-982d-f415e5910c05:1.0.0:1.0.0 ...
```

Facebook screenshot step:

```txt
[GRASSEYE][RUNTIME][EVENT] runtime STEP_DISPATCH_STARTED started Dispatching step "capture-video-viewport" to ability group "screenshot". ownerResponsible="Orchestration / Nerve Bus" ...
[GRASSEYE][RUNTIME][FAIL] runtime CAPABILITY_CALL_FAILED failed Governed step "capture-video-viewport" returned status "failed". ownerResponsible="Orchestration / screenshot" ...
```

TikTok shows the same shape: `STEP_DISPATCH_STARTED` then terminal `CAPABILITY_CALL_COMPLETED` or `CAPABILITY_CALL_FAILED`, but no explicit `CAPABILITY_CALL_STARTED` event in the latest real log.

字段逐项填写：

- traceId：`commander_command_d224faec-7fd1-4db5-8f03-1edef9f0bb3c:run`；`commander_command_ba940d01-60fe-46b5-9362-8414fbae3171:run`
- runId：`commander_command_d224faec-7fd1-4db5-8f03-1edef9f0bb3c:run`；`commander_command_ba940d01-60fe-46b5-9362-8414fbae3171:run`
- attemptId：MISSING
- missionId：MISSING
- taskTemplateId：MISSING
- selectedMapId：`facebook.seeding-video.discovery.meta.v1`；`tiktok.seeding-video.discovery.meta.v1`
- requestedPlatformId：MISSING
- activationSnapshotRef：`activation-snapshot:1aed09b9-262d-415c-982d-f415e5910c05:1.0.0:1.0.0`；`activation-snapshot:cdc353c6-9686-4d5c-aae0-d5f8572ab58f:1.0.0:1.0.0`
- commandId / envelopeId：MISSING
- stepId：`open-facebook-reels` / `capture-video-viewport` / `open-tiktok-feed` / `capture-video-viewport`
- abilityGroupId：MISSING
- childCapabilityId：MISSING
- owner：MISSING
- ownerResponsible：`Orchestration / Nerve Bus`；随后终态为 `Orchestration / open` 或 `Orchestration / screenshot`
- status：`started` then `success` / `failed`
- failureReason：仅终态出现
- actionableMessage：存在，但起始事件只能看到 dispatch 语义，无法看到 explicit capability start 语义

### 2. 实际行为

当前真实 runtime 时间线只有 `STEP_DISPATCH_STARTED`，随后直接进入 `CAPABILITY_CALL_COMPLETED` / `CAPABILITY_CALL_FAILED` / `CAPABILITY_CALL_REVIEW_REQUIRED`。也就是说，能力调用真正开始的时点只能靠操作员推断，不能靠明确事件名回放。

这不会阻断 mission 主功能，但会降低排障确定性，尤其在 step dispatch 已经发出、能力入口还没真正开始执行、或中间 transport/adapter 出现阻塞时，日志链无法提供独立的 capability-start 断点。

### 3. 法案原本要求

- 法案文件：`.github/instructions/cursor-rules/modules/module-structured-logging.instructions.md`
- lawId：`GRASSEYE-STRUCTURED-LOGGING-003-V1`
- 主题：DEBUG 级实战透明化
- 要求：Structured DEBUG events must expose what happened, with `traceId` / `spanId` / `eventType` / owner / refs, and provide enough context for root-cause analysis without hidden in-memory inference.
- 禁止项：free-text terminal logs acting as proof; lifecycle understanding that depends on hidden in-memory state.
- 当前违反点：能力调用开始时点不是显式事件，只能从 `STEP_DISPATCH_STARTED` 与终态事件之间推断。

支撑法案：

- 法案文件：`.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md`
- lawId：`GRASSEYE-ORCHESTRATION-CAPABILITY-004-V3`
- 主题：Nerve Bus 调度出口唯一
- 要求：dispatch payload/proof must preserve chain fields and dispatch semantics across governed work.
- 当前违反点：dispatch 已记录，但 capability-call lifecycle 的 start stage 没有单独事件。

### 4. 施工图原本要求

- 施工图文件：`docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md`
- 章节：`9. Dispatch Through Nerve Bus`
- 要求：dispatch payload/proof 要完整保留链路字段和 dispatch 结果语义。
- 当前违反点：当前日志只表达“dispatch started”和“capability finished”，缺少独立的 capability-start 阶段语义。

补充：

- 施工图文件：`docs/法案辅助文件/GrassEye 结构化日志与运行证明施工图.md`
- 章节：`Human Command / Mission Preflight Events`
- 要求：结构化事件链不能靠静默跳步推进。
- 当前违反点：`CAPABILITY_CALL_STARTED` 的显式事件命名在最新真实 log 中缺位。

### 5. 根因定位

生产代码：

- 文件路径：`src/capabilities/orchestration/runtime/orchestration-loop-iteration-events.ts`
- 函数 / class / route：`recordDispatchStarted`
- 关键判断：该函数只写 `eventType: "STEP_DISPATCH_STARTED"`，然后根据目标能力组可选写 `POST_ACTION_VERIFICATION_STARTED`；没有任何 `CAPABILITY_CALL_STARTED` 事件发射。
- 为什么导致当前错误：mission loop 的 ability-call start 只能从 dispatch 事件被动推断，无法以显式 eventType 呈现。

- 文件路径：`src/lib/local-runtime/structured-log-terminal.ts`
- 函数 / class / route：`INFO_RUNTIME_EVENT_TYPES`
- 关键判断：终端 relay 已经白名单了 `CAPABILITY_CALL_STARTED`。
- 为什么导致当前错误：display channel 允许展示该事件，但 runtime 从未发出，说明缺口在生产 event emitter，而不是 terminal relay。

执法代码：

- inspector 文件：`scripts/audit/domains/orchestration-capability/mission-loop-event-semantics-checks.ts`
- negative proof 文件：`scripts/audit/domains/orchestration-capability/negative-proof-harness.ts`
- manifest / owner mapping：Orchestration mission-loop semantics audit
- 当前是否覆盖：PARTIAL
- 为什么没有拦住：`mission-loop-event-semantics-checks.ts` 只强制 `MAP_STEP_SELECTED`、`STEP_PRECONDITION_CHECKED`、`STEP_DISPATCH_STARTED`、`STEP_TRANSITION_EVALUATED` 等事件；`negative-proof-harness.ts` 仅覆盖 `POST_ACTION_VERIFICATION_STARTED` 相关突变，没有 `CAPABILITY_CALL_STARTED` 删除突变。

### 6. 为什么执法脚本没有拦住？

C. 法案/治理目标存在，但 inspector 未细化到 capability-start taxonomy。
D. inspector 只验证当前硬编码事件集合，没有把 dispatch-start 与 capability-start 拆成两个强制节点。
E. negative proof 没有“删除 CAPABILITY_CALL_STARTED 仍应失败”的突变。

### 7. 应修复层级，但本阶段不修

- 修生产代码：YES
- 修施工图：YES，补清楚 `STEP_DISPATCH_STARTED` 与 `CAPABILITY_CALL_STARTED` 的语义边界
- 修 inspector：YES，把 `CAPABILITY_CALL_STARTED` 纳入 required lifecycle event matrix
- 修 negative proof：YES，增加删除 `CAPABILITY_CALL_STARTED` 的 mission-loop mutation
- 修结构化日志：YES，显式记录 capability start 的 `capabilityCallId` / `inputRef` / `nerveBusEnvelopeId`
- 是否需要申请修改法案：NO