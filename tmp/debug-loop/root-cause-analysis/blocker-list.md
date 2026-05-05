# Blocker List

## BLOCKER-1: Preflight passed, Nerve Bus dispatched, then command rejected with `invalid_input`

### 1. 日志证据

```txt
[GRASSEYE][RUNTIME][PASS] runtime MISSION_PREFLIGHT_PASSED success Mission preflight passed. Commander Console can dispatch the governed human command. ownerResponsible="Commander Console / Nerve Bus" actionableMessage="Dispatch the governed human command through Commander Console and Nerve Bus." traceId=trace_754fb9d8-03f7-4e98-8487-e27f10a52490 runId=trace_754fb9d8-03f7-4e98-8487-e27f10a52490 selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=trace_754fb9d8-03f7-4e98-8487-e27f10a52490,attempt_087b64af-d4f7-49bd-8021-f22b1fe8550b,task_start
[GRASSEYE][RUNTIME][PASS] runtime NERVE_BUS_DISPATCH_STARTED started Dispatching start-mission via CommandTransportPort. ownerResponsible="Nerve Bus" actionableMessage="Wait for governed result envelope and semantic gate validation." traceId=commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018 runId=commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018 selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018,commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018,task_start
[GRASSEYE][RUNTIME][FAIL] runtime COMMAND_REJECTED failed COMMAND_REJECTED failureReason=invalid_input ownerResponsible="Commander Console / Nerve Bus / Orchestration" actionableMessage="Inspect the latest debug bundle and fix the blocking dependency before retrying." traceId=trace_754fb9d8-03f7-4e98-8487-e27f10a52490 runId=commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018:run selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=trace_754fb9d8-03f7-4e98-8487-e27f10a52490,attempt_087b64af-d4f7-49bd-8021-f22b1fe8550b,task_start
```

- traceId: `trace_754fb9d8-03f7-4e98-8487-e27f10a52490` and `commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018`
- runId: `commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018:run`
- attemptId: `attempt_087b64af-d4f7-49bd-8021-f22b1fe8550b`
- missionId: MISSING in terminal line; inferable only from command id in run line, not a dedicated field
- taskTemplateId: MISSING in final rejection line
- selectedMapId: `facebook.seeding-video.discovery.meta.v1`
- requestedPlatformId: MISSING in final rejection line
- activationSnapshotRef: MISSING in final rejection line
- commandId / envelopeId: `commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018`
- stepId: `task_start`
- abilityGroupId: MISSING
- childCapabilityId: MISSING
- owner: `runtime`
- ownerResponsible: `Commander Console / Nerve Bus / Orchestration`
- status: `failed`
- failureReason: `invalid_input`
- actionableMessage: `Inspect the latest debug bundle and fix the blocking dependency before retrying.`

### 2. 实际行为

MissionReadiness and preflight passed, Commander built an envelope, and Nerve Bus dispatched `start-mission`. Orchestration then returned a failed mission state, and Commander emitted `COMMAND_REJECTED`. Because rejection happened after preflight and transport dispatch, this is a P0 command boundary failure, not a startup failure.

### 3. 法案原本要求

- 法案文件: `.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md`
- lawId: `GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1` and boundary supplement `GRASSEYE-ORCHESTRATION-CAPABILITY-008-V3`
- 主题: Orchestration final readiness and command boundary
- 要求: final readiness requires `activationSnapshotRef frozen and non-null in valid execution`, `dispatch only through Nerve Bus envelope`, and `step payload/proof carries full chain fields`.
- 禁止项: `preflight passed 后才发现 runId null`; command shape failures after preflight are forbidden by the blueprint.
- 当前违反点: runtime reached `MISSION_PREFLIGHT_PASSED` and `NERVE_BUS_DISPATCH_STARTED`, then `COMMAND_REJECTED`.

### 4. 施工图原本要求

- 施工图文件: `docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md`
- 章节: `start-mission preflight 补充`
- 要求: Local App Shell must dry-run final `MissionCommandSchema` before Nerve Bus dispatch; dry-run must include requestedPlatform, selectedMapId/preferredMapId, taskTemplateId, activationId, targetProfileRef, and non-null generated runId. Failure must return `MISSION_PREFLIGHT_FAILED / COMMAND_REJECTED` before Nerve Bus envelope creation.
- 当前违反点: preflight passed and Nerve Bus envelope was created before final command rejection.

### 5. 根因定位

生产代码:

- 文件路径: `src/lib/local-app-shell/task-start-flow.ts`
- 函数: `getApprovedTaskStartPreflight`, `executeApprovedTaskStart`, `buildStartMissionInput`
- 关键判断: `getApprovedTaskStartPreflight` passes binding fields to `activeWorkbench.getMissionStartPreflight`, then `executeApprovedTaskStart` dispatches `activeWorkbench.commanderConsole.execute(...)` after recording passed preflight.
- 为什么导致当前错误: preflight checks the binding, but the runtime failure proves it did not fully prove the final mission loop input/first-step dispatch path. The final envelope can still reach Orchestration and fail as `invalid_input`.

生产代码:

- 文件路径: `src/lib/local-runtime/workbench-human-command.ts`
- 函数: `handleStartMission`
- 关键判断: calls `runtime.orchestrationAbilityGroup.startMission(...)`, then records `MISSION_ACTIVATION_SNAPSHOT_FROZEN` using returned `missionState.status`.
- 为什么导致当前错误: a failed mission loop is collapsed into `MISSION_ACTIVATION_SNAPSHOT_FROZEN failed`, so the command rejection is visible but the failing step is not visible.

执法代码:

- inspector 文件: `scripts/audit/domains/orchestration-capability/start-mission-boundary-checks.ts`; `scripts/audit/domains/commander-console-capability/run-startup-readiness-gate-checks.ts`
- negative proof 文件: `scripts/audit/domains/orchestration-capability/negative-proof-harness.ts`; `scripts/audit/domains/commander-console-capability/negative-proof-harness.ts`
- manifest / owner mapping: Orchestration capability inspector and Commander Console capability inspector
- 当前是否覆盖: partially covered
- 为什么没有拦住: inspectors verify the presence of `MissionCommandSchema.safeParse`, binding fields, runId propagation, and boundary logs, but do not replay the actual final `start-mission -> first map step -> open input` path or assert that post-preflight command rejection is impossible for `invalid_input`.

### 6. 为什么执法脚本没有拦住？

Classification: C, D, E, F, H.

The law and blueprint exist, but the inspectors are mostly AST/symbol presence checks. They cover happy-path structure and specific runId mutations, not an end-to-end negative proof that mutates the final dispatched command or first step payload to reproduce `invalid_input` after `MISSION_PREFLIGHT_PASSED`. Runtime logs also hide the failing step, so the inspector cannot compare expected phase logs against actual loop progression.

### 7. 应修复层级，但本阶段不修

- 修生产代码: yes, preflight/final command dry-run and loop failure surfacing.
- 修施工图: no immediate law change; blueprint may need more precise first-step payload proof wording.
- 修 inspector: yes, add end-to-end post-preflight rejection guard.
- 修 negative proof: yes, mutate final start payload/first open payload to ensure preflight blocks it.
- 修结构化日志: yes, emit step-level structured events and include result/proof refs on rejection.
- 是否需要申请修改法案: NO

## BLOCKER-2: `MISSION_ACTIVATION_SNAPSHOT_FROZEN` is marked failed even though the log contains an activationSnapshotRef

### 1. 日志证据

```txt
[GRASSEYE][RUNTIME][FAIL] runtime MISSION_ACTIVATION_SNAPSHOT_FROZEN failed activationSnapshotRef=activation-snapshot:890e5f4e-fb8e-40de-847b-498aee7f8fcb:1.0.0:1.0.0; selectedMapId=facebook.seeding-video.discovery.meta.v1 failureReason=invalid_input ownerResponsible="Orchestration / Map Plugin Registry" actionableMessage="Continue the governed mission loop with the frozen activation snapshot." traceId=commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018:facebook.seeding-video.discovery.meta.v1:commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018:run runId=commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018:run selectedMapId=facebook.seeding-video.discovery.meta.v1 refs=commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018:facebook.seeding-video.discovery.meta.v1:commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018:run,commander-console:commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018:attempt:1,task_start
```

- traceId: `commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018:facebook.seeding-video.discovery.meta.v1:commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018:run`
- runId: `commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018:run`
- attemptId: `commander-console:commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018:attempt:1`
- missionId: MISSING as standalone field
- taskTemplateId: MISSING in terminal line
- selectedMapId: `facebook.seeding-video.discovery.meta.v1`
- requestedPlatformId: MISSING
- activationSnapshotRef: `activation-snapshot:890e5f4e-fb8e-40de-847b-498aee7f8fcb:1.0.0:1.0.0`
- commandId / envelopeId: `commander_command_9d6d1c09-eb8b-4a22-9908-beebcd32c018`
- stepId: `task_start`
- abilityGroupId: MISSING
- childCapabilityId: MISSING
- owner: `runtime`
- ownerResponsible: `Orchestration / Map Plugin Registry`
- status: `failed`
- failureReason: `invalid_input`
- actionableMessage: `Continue the governed mission loop with the frozen activation snapshot.`

### 2. 实际行为

The line says activation snapshot was frozen and even includes the snapshot ref, but its status is `failed` and failureReason is `invalid_input`. The actionable message says continue the governed loop, while the command is rejected immediately after. This makes the event semantically overloaded: it is both a snapshot proof log and a mission-loop outcome log.

### 3. 法案原本要求

- 法案文件: `.github/instructions/cursor-rules/modules/module-structured-logging.instructions.md`
- lawId: structured logging human command / mission preflight event law
- 主题: structured logs must expose the command path and rejection cause
- 要求: rejected commands must include failureReason, ownerResponsible, actionableMessage, and inspect/debug refs.
- 禁止项: misleading or insufficient structured logs that prevent locating the failing stage.
- 当前违反点: snapshot event status is tied to mission failure, not snapshot freeze success/failure; refs do not identify the actual failing ability result.

### 4. 施工图原本要求

- 施工图文件: `docs/法案辅助文件/GrassEye 结构化日志与运行证明施工图.md`
- 章节: `Human Command / Mission Preflight Events`
- 要求: governed event chain must include command/preflight events, rejection must show failureReason, ownerResponsible, actionableMessage, inspect refs.
- 当前违反点: `MISSION_ACTIVATION_SNAPSHOT_FROZEN failed` contains a snapshot ref and a "continue" action, while the real blocker is an `invalid_input` mission-loop failure with missing step/result refs.

### 5. 根因定位

生产代码:

- 文件路径: `src/lib/local-runtime/workbench-human-command-debug-events.ts`
- 函数: `recordMissionActivationSnapshotFrozen`
- 关键判断: line 47 chooses `input.missionState.activationSnapshotRef ?? input.activationSnapshotRef`; line 51 sets event status from `input.missionState.status`; line 63 chooses "continue" if any activationSnapshotRef exists.
- 为什么导致当前错误: the event status follows the later mission state, while reason/actionableMessage follow snapshot availability. That mixes two different facts and produces a contradictory failure log.

执法代码:

- inspector 文件: `scripts/audit/domains/orchestration-capability/start-mission-boundary-checks.ts`
- negative proof 文件: `scripts/audit/domains/orchestration-capability/negative-proof-harness.ts`
- manifest / owner mapping: Orchestration capability inspector
- 当前是否覆盖: covers presence of `MISSION_ACTIVATION_SNAPSHOT_FROZEN` literal only
- 为什么没有拦住: inspector checks that the event exists, not that status/reason/actionableMessage are semantically coherent or that failed loop result is logged separately.

### 6. 为什么执法脚本没有拦住？

Classification: C, D, E, H.

The inspector has a string-literal presence check for `MISSION_ACTIVATION_SNAPSHOT_FROZEN`. It does not validate event semantics, refs, or contradictory status/actionable combinations. There is no negative proof that forces `missionState.status=failed` with non-null activationSnapshotRef and asserts the log remains interpretable.

### 7. 应修复层级，但本阶段不修

- 修生产代码: yes, split snapshot-freeze proof from mission-loop failure outcome.
- 修施工图: yes, clarify event semantics if needed.
- 修 inspector: yes, add semantic log-shape check.
- 修 negative proof: yes, mutation for contradictory status/actionableMessage.
- 修结构化日志: yes, include failing step/result/proof refs.
- 是否需要申请修改法案: NO

## BLOCKER-3: First map step / capability / PAV / Forensics structured events are missing

### 1. 日志证据

```txt
[GRASSEYE][RUNTIME][EVENT] runtime ORCHESTRATION_START_RECEIVED started Orchestration received governed start-mission command from Nerve Bus. ...
[GRASSEYE][RUNTIME][FAIL] runtime MISSION_ACTIVATION_SNAPSHOT_FROZEN failed ... failureReason=invalid_input ...
[GRASSEYE][RUNTIME][FAIL] runtime COMMAND_REJECTED failed COMMAND_REJECTED failureReason=invalid_input ...
```

Required but missing in the latest terminal log:

```txt
MAP_STEP_SELECTED
STEP_PRECONDITION_CHECKED
CAPABILITY_CALL_STARTED
CAPABILITY_CALL_COMPLETED / CAPABILITY_CALL_FAILED / CAPABILITY_CALL_REVIEW_REQUIRED
POST_ACTION_VERIFICATION_STARTED / PASSED / FAILED / REVIEW_REQUIRED
FORENSICS_RECORD_WRITE_REQUESTED
FORENSICS_RECORD_WRITTEN
STEP_TRANSITION_EVALUATED
MISSION_FINALIZED / STOPPED / FAILED / REVIEW_REQUIRED
```

- traceId: MISSING for all missing loop events
- runId: MISSING for all missing loop events
- attemptId: MISSING for all missing loop events
- missionId: MISSING for all missing loop events
- taskTemplateId: MISSING for all missing loop events
- selectedMapId: MISSING for all missing loop events
- requestedPlatformId: MISSING for all missing loop events
- activationSnapshotRef: MISSING for all missing loop events
- commandId / envelopeId: MISSING for all missing loop events
- stepId: MISSING for all missing loop events
- abilityGroupId: MISSING for all missing loop events
- childCapabilityId: MISSING for all missing loop events
- owner: MISSING
- ownerResponsible: MISSING
- status: MISSING
- failureReason: MISSING
- actionableMessage: MISSING

### 2. 实际行为

The system enters Orchestration and immediately reports command rejection, but does not expose the selected map step, capability call, capability result, PAV, Forensics write, or transition evaluation in structured terminal logs. Therefore root cause cannot be proven from logs alone and must be traced through code.

### 3. 法案原本要求

- 法案文件: `.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md`
- lawId: `GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1`
- 主题: Orchestration proof chain and Nerve Bus dispatch
- 要求: step payload/proof carries full chain fields; PAV-after-action and Forensics routing enforced.
- 禁止项: action step without PAV; evidence output bypasses Forensics; ambiguous transition success.
- 当前违反点: runtime logs do not prove any of those phases occurred or failed.

### 4. 施工图原本要求

- 施工图文件: `docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md`
- 章节: final readiness and start-mission loop governance
- 要求: dispatch only through Nerve Bus envelope, step payload/proof carries full chain fields, PAV-after-action and Forensics routing enforced, transition evaluation uses declared output schema fields.
- 当前违反点: logs omit the phase proof chain after `ORCHESTRATION_START_RECEIVED`.

### 5. 根因定位

生产代码:

- 文件路径: `src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration.ts`
- 函数: `runMissionLoopIteration`
- 关键判断: checks dispatch gate, loop guard, dispatches operational step, evaluates transition, and persists outcome, but there is no structured log emission for `MAP_STEP_SELECTED`, `STEP_PRECONDITION_CHECKED`, `CAPABILITY_CALL_STARTED`, `CAPABILITY_CALL_*`, `STEP_TRANSITION_EVALUATED`.
- 为什么导致当前错误: command failure collapses into final Commander logs without intermediate runtime proof events.

生产代码:

- 文件路径: `src/lib/local-runtime/structured-log-terminal.ts`
- 函数 / class / route: terminal relay event allowlist
- 关键判断: includes names for these events, but the Orchestration loop does not emit them.
- 为什么导致当前错误: terminal relay is prepared to display events that production loop does not create.

执法代码:

- inspector 文件: `scripts/audit/domains/orchestration-capability/run-governed-runtime-checks.ts`
- negative proof 文件: `scripts/audit/domains/orchestration-capability/negative-proof-harness.ts`
- manifest / owner mapping: Orchestration capability inspector
- 当前是否覆盖: partial
- 为什么没有拦住: checks proof fields and PAV gate in code, not live structured log emission coverage for every runtime phase.

### 6. 为什么执法脚本没有拦住？

Classification: C, D, E, H.

Inspector enforces static proof structures and some gate calls. It does not require the loop to emit structured runtime events for each phase, nor does it compare live runtime logs against the expected phase sequence.

### 7. 应修复层级，但本阶段不修

- 修生产代码: yes, emit loop phase logs.
- 修施工图: no, requirement already exists at a high level.
- 修 inspector: yes, assert loop emits required event names with refs.
- 修 negative proof: yes, remove one event emission and require audit failure.
- 修结构化日志: yes.
- 是否需要申请修改法案: NO

## BLOCKER-4: Adjacent runtime proof shows open target profile propagation can be lost after preflight

### 1. 日志证据

Live `/api/runtime/logs` older attempts:

```txt
eventType=COMMAND_REJECTED
status=failed
mapId=tiktok.seeding-video.discovery.meta.v1
taskTemplateId=tiktok-seeding-video-discovery
failureReason="open requires targetUrl or explicit targetProfileRef open-target-profile:open-tiktok; silent profile defaulting is forbidden"
ownerResponsible="Commander Console / Nerve Bus / Orchestration"
actionableMessage="Inspect the latest debug bundle and fix the blocking dependency before retrying."
```

- traceId: present in JSON as `trace_d7621cdd-998f-40ef-bb6b-1b6dc695effb`
- runId: `null` in that older JSON `COMMAND_REJECTED`
- attemptId: `attempt_14f04fe2-983f-431d-bb54-5dbb8b22fdf7`
- missionId: `null`
- taskTemplateId: `tiktok-seeding-video-discovery`
- selectedMapId: `tiktok.seeding-video.discovery.meta.v1`
- requestedPlatformId: MISSING as standalone field; present only in reason text on earlier envelope log
- activationSnapshotRef: `null` in structured field; present only in earlier reason text
- commandId / envelopeId: MISSING in final JSON fields
- stepId: `task_start`
- abilityGroupId: `commander-console`
- childCapabilityId: `issue-human-command`
- owner: `Commander Console`
- ownerResponsible: `Commander Console / Nerve Bus / Orchestration`
- status: `failed`
- failureReason: `open requires targetUrl or explicit targetProfileRef open-target-profile:open-tiktok; silent profile defaulting is forbidden`
- actionableMessage: `Inspect the latest debug bundle and fix the blocking dependency before retrying.`

### 2. 实际行为

Preflight and envelope build can pass even while the first open ability receives neither `targetUrl` nor explicit `targetProfileRef`. The open capability correctly blocks silent profile defaulting; the blocker is upstream payload/profile propagation and preflight coverage.

### 3. 法案原本要求

- 法案文件: `.github/instructions/cursor-rules/modules/module-open-capability.instructions.md`
- lawId: `GRASSEYE-OPEN-CAPABILITY-003-V2`
- 主题: open input governance
- 要求: input must include `targetUrl or targetProfileRef`; targetUrl may be resolved only through target profile and explicit request policy.
- 禁止项: silent default platform, silent default URL, fabricated profile.
- 当前违反点: upstream dispatch reaches open without explicit target URL/profile and fails after preflight.

### 4. 施工图原本要求

- 施工图文件: `docs/法案辅助文件/GrassEye Open 能力组施工图.md`
- 章节: target profile governance and result fields
- 要求: target profile is governed profile, not silent fallback; open result/proof must carry targetProfileRef, targetUrl, targetUrlSource.
- 当前违反点: first open input can be missing the target binding after command dispatch.

### 5. 根因定位

生产代码:

- 文件路径: `src/lib/local-runtime/workbench-open-dispatch-input.ts`
- 函数: `buildOpenAbilityInput`
- 关键判断: resolves requested platform from payload and reads `targetUrl`, `targetTitle`, `targetProfileRef` from the ability dispatch payload.
- 为什么导致当前错误: if Orchestration payloadRefs do not include `targetProfileRef`, open receives null and target-policy blocks.

生产代码:

- 文件路径: `src/capabilities/open/runtime/target-policy-gate.ts`
- 函数: `resolveOpenTargetPolicyBlockReason`
- 关键判断: if no `targetUrl` and `targetProfileRef !== open-target-profile:<child>`, returns the observed failure message.
- 为什么导致当前错误: this is the correct blocking gate; upstream should have supplied the explicit profile or blocked earlier.

执法代码:

- inspector 文件: `scripts/audit/domains/open-capability/run-open-runtime-checks.ts`
- negative proof 文件: `scripts/audit/domains/open-capability/negative-proof-harness.ts`
- manifest / owner mapping: Open capability inspector
- 当前是否覆盖: open local guard covered; upstream end-to-end propagation not covered
- 为什么没有拦住: open inspector validates its own gate and fake allow prevention, not the Commander/Orchestration payloadRefs path into open.

### 6. 为什么执法脚本没有拦住？

Classification: C, D, E, F, I.

Open inspector catches default/fake profile behavior inside Open, but it does not own the Commander/Orchestration propagation path. Commander/Orchestration inspectors check binding field presence, not that the first `open-*` step receives the profile through `payloadRefs` in a live or mutated dispatch path.

### 7. 应修复层级，但本阶段不修

- 修生产代码: yes, ensure first open dispatch receives targetProfileRef/targetUrl from frozen task binding.
- 修施工图: no; likely already specified.
- 修 inspector: yes, cross-domain inspector for task binding -> payloadRefs -> open input.
- 修 negative proof: yes, remove targetProfileRef from payloadRefs propagation and require failure before dispatch.
- 修结构化日志: yes, expose first open input refs and failure proof.
- 是否需要申请修改法案: NO
