# Blocker List

## BLOCKER-1: Commander start-mission returns a timeout review after the command has already been accepted

Priority: P0

### 1. 日志证据

```txt
[GRASSEYE][RUNTIME][PASS] runtime COMMAND_ACCEPTED success Governed start-mission command was accepted before mission execution began. ownerResponsible="Commander Console / Nerve Bus / Orchestration" actionableMessage="Track subsequent Orchestration runtime events for execution outcome instead of using command acceptance as final mission truth." traceId=commander_command_2c9f274b-a06c-4f52-836d-b24504bf4ba4:facebook.seeding-video.discovery.meta.v1:commander_command_2c9f274b-a06c-4f52-836d-b24504bf4ba4:run runId=commander_command_2c9f274b-a06c-4f52-836d-b24504bf4ba4:run selectedMapId=facebook.seeding-video.discovery.meta.v1 ...
[GRASSEYE][SERVICE][EVENT] internal:app-server:dev stdout stream [grasseye:review] {"timestamp":"2026-05-05T12:22:37.195Z","level":"DEBUG","phase":"mission-command","component":"commander-console","owner":"Commander Console","eventType":"COMMAND_REJECTED","status":"review_required","failureReason":"issue-human-command timed out after 5000ms.","reviewRequiredReason":"issue-human-command timed out after 5000ms.","actionableMessage":"Open the review queue and inspect the guarded command result before retrying.","ownerResponsible":"Commander Console / Nerve Bus / Orchestration","refs":["runId=commander_command_2c9f274b-a06c-4f52-836d-b24504bf4ba4:run","runtimeProofRef=commander_proof_38a58dd1-07d9-4400-b412-a3b88419336c","inputRef=commander_command_input_9777db6a-ff0d-40dd-8135-0d551c58af6a","outputRef=commander_receipt:commander_command_2c9f274b-a06c-4f52-836d-b24504bf4ba4"]}
```

- traceId: `trace_fbd2190c-c6fa-4e75-8805-0eacd76d774d` for command UI; `commander_command_2c9f274b-a06c-4f52-836d-b24504bf4ba4:...:run` for accepted orchestration path
- runId: `commander_command_2c9f274b-a06c-4f52-836d-b24504bf4ba4:run`
- attemptId: `attempt_54af5c24-4d30-4532-9f2e-bc2fbbaec5a7`
- missionId: `commander_command_2c9f274b-a06c-4f52-836d-b24504bf4ba4`
- taskTemplateId: `facebook-seeding-video-discovery`
- selectedMapId: `facebook.seeding-video.discovery.meta.v1`
- requestedPlatformId: `facebook-web`
- activationSnapshotRef: `activation-snapshot:5cbea339-0034-40f6-906b-c256e889377b:1.0.0:1.0.0`
- commandId / envelopeId: `commander_command_2c9f274b-a06c-4f52-836d-b24504bf4ba4` / `commander-console:commander_command_2c9f274b-a06c-4f52-836d-b24504bf4ba4`
- stepId: `task_start`
- abilityGroupId: `commander-console`
- childCapabilityId: `issue-human-command`
- owner: `Commander Console`
- ownerResponsible: `Commander Console / Nerve Bus / Orchestration`
- status: `review_required`
- failureReason: `issue-human-command timed out after 5000ms.`
- actionableMessage: `Open the review queue and inspect the guarded command result before retrying.`

TikTok repeats the same blocker:

```txt
[GRASSEYE][SERVICE][EVENT] internal:app-server:dev stdout stream [grasseye:review] {"timestamp":"2026-05-05T12:23:26.533Z",...,"mapId":"tiktok.seeding-video.discovery.meta.v1","eventType":"COMMAND_REJECTED","status":"review_required","failureReason":"issue-human-command timed out after 5000ms.","reviewRequiredReason":"issue-human-command timed out after 5000ms.",...}
```

### 2. 实际行为

The command path records `COMMAND_ACCEPTED` before mission execution begins, then the `issue-human-command` child waits for `handleStartMission`, which awaits `runtime.orchestrationAbilityGroup.startMission(...)` until the mission loop reaches terminal `review_required`. The child timeout is fixed at `5000ms`, so the command receipt reports `COMMAND_REJECTED` even though Orchestration already accepted and is executing the governed map. This creates contradictory command truth: accepted transport plus rejected Commander child.

### 3. 法案原本要求

- 法案文件: `.github/instructions/cursor-rules/modules/module-commander-console-capability.instructions.md`
- lawId: `GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2`
- 主题: explicit, timeout-governed command envelope
- 要求: Commander command envelope must be explicit, idempotent, timeout-governed, and semantically validated.
- 禁止项: command acceptance/rejection ambiguity after dispatch.
- 当前违反点: `COMMAND_ACCEPTED` and `COMMAND_REJECTED` both represent the same start command path, because timeout guards the whole mission execution rather than the command acceptance boundary.

### 4. 施工图原本要求

- 施工图文件: `docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md`
- 章节: timeout gate; terminal/local app shell `COMMAND_ACCEPTED / COMMAND_REJECTED` refs
- 要求: timeout starts before command execution; timeout produces typed failed/review result; rejected path must include owner/actionable refs.
- 当前违反点: the timeout result is typed, but its scope is too broad: it times out the long-running mission instead of the short command-acceptance semantic boundary.

### 5. 根因定位

生产代码:

- 文件路径: `src/capabilities/commander-console/children/issue-human-command/contract.ts`
- 函数 / class / route: `ISSUE_HUMAN_COMMAND_CONTRACT`
- 关键判断: `maxDurationMs: 5000`
- 为什么导致当前错误: `issue-human-command` is bounded to 5 seconds.

- 文件路径: `src/capabilities/commander-console/runtime/commander-command-child-executor.ts`
- 函数 / class / route: `runTransportExecution`, `executeCommanderCommandChild`
- 关键判断: `runCommanderTimeoutGate({ maxDurationMs: input.contract.maxDurationMs, run: () => ... emitHumanCommand(...) })`
- 为什么导致当前错误: the timeout wraps `emitHumanCommand`, not just envelope validation/dispatch acceptance.

- 文件路径: `src/lib/local-runtime/workbench-human-command.ts`
- 函数 / class / route: `handleStartMission`
- 关键判断: records `COMMAND_ACCEPTED`, then awaits `runtime.orchestrationAbilityGroup.startMission(...)`
- 为什么导致当前错误: `startMission` is a long-running loop; the command receipt is delayed until mission terminal state.

执法代码:

- inspector 文件: `scripts/audit/domains/commander-console-capability/run-commander-runtime-checks.ts`
- negative proof 文件: `scripts/audit/domains/commander-console-capability/negative-proof-harness.ts`
- manifest / owner mapping: `scripts/audit/domains/commander-console-capability/manifest.json`
- 当前是否覆盖: partially
- 为什么没有拦住: it checks that a timeout gate exists, that timeout outcomes are typed, and that rejected refs are preserved. It does not check that start-mission acknowledgement is separated from long-running mission execution or that `COMMAND_ACCEPTED` and `COMMAND_REJECTED` cannot both be emitted for the same command after acceptance.

### 6. 为什么执法脚本没有拦住？

D. inspector checks call/existence fragments but not async semantic scope.  
E. inspector covers timeout happy/guard path but no negative proof for "accepted then child timeout while mission continues".  
H. structured logs expose the contradiction only at runtime; static inspector does not model the temporal sequence.

### 7. 应修复层级，但本阶段不修

- 修生产代码: YES, split command-acceptance receipt from mission terminal execution or increase/re-scope timeout.
- 修施工图: YES, clarify issue-human-command must acknowledge governed dispatch, not await mission terminal truth.
- 修 inspector: YES, add semantic/static check for `handleStartMission` awaiting mission loop inside command transport.
- 修 negative proof: YES, mutation where start-mission handler awaits terminal mission under 5s child timeout must fail.
- 修结构化日志: YES, prevent late `COMMAND_REJECTED` for an already accepted command; if mission later reviews, emit mission-level review only.
- 是否需要申请修改法案: NO

## BLOCKER-2: `detect-safety-page` cannot prove normal page state from governed negative observations

Priority: P0

### 1. 日志证据

```txt
[GRASSEYE][RUNTIME][PASS] runtime MAP_STEP_SELECTED success Orchestration selected governed step "detect-safety-page" from the frozen operational map. ownerResponsible=Orchestration ...
[GRASSEYE][RUNTIME][EVENT] runtime STEP_DISPATCH_STARTED started Dispatching step "detect-safety-page" to ability group "page-state". ownerResponsible="Orchestration / Nerve Bus" ...
[GRASSEYE][SERVICE][EVENT] internal:app-server:dev stdout stream [grasseye:review] {"timestamp":"2026-05-05T12:22:38.677Z","level":"INFO","phase":"mission-loop","component":"orchestration","owner":"Orchestration","eventType":"CAPABILITY_CALL_REVIEW_REQUIRED","status":"review_required","reason":"Governed step \"detect-safety-page\" returned status \"review_required\".","failureReason":"Child detect-safety-page requires governed observation refs before success.","reviewRequiredReason":"Child detect-safety-page requires governed observation refs before success.","actionableMessage":"Inspect the blocking step result and runtime proof before retrying.","ownerResponsible":"Orchestration / page-state","durationMs":197}
```

- traceId: `commander_command_2c9f274b-a06c-4f52-836d-b24504bf4ba4:run`
- runId: `commander_command_2c9f274b-a06c-4f52-836d-b24504bf4ba4:run`
- attemptId: `commander_command_2c9f274b-a06c-4f52-836d-b24504bf4ba4:detect-safety-page:3`
- missionId: `commander_command_2c9f274b-a06c-4f52-836d-b24504bf4ba4`
- taskTemplateId: `facebook-seeding-video-discovery`
- selectedMapId: `facebook.seeding-video.discovery.meta.v1`
- requestedPlatformId: `facebook-web`
- activationSnapshotRef: `activation-snapshot:5cbea339-0034-40f6-906b-c256e889377b:1.0.0:1.0.0`
- commandId / envelopeId: `MISSING in this event`
- stepId: `detect-safety-page`
- abilityGroupId: `orchestration` in review JSON; terminal dispatch says target ability group `page-state`
- childCapabilityId: `detect-safety-page`
- owner: `Orchestration`
- ownerResponsible: `Orchestration / page-state`
- status: `review_required`
- failureReason: `Child detect-safety-page requires governed observation refs before success.`
- actionableMessage: `Inspect the blocking step result and runtime proof before retrying.`

TikTok repeats the same blocker:

```txt
[GRASSEYE][SERVICE][EVENT] internal:app-server:dev stdout stream [grasseye:review] {"timestamp":"2026-05-05T12:23:28.657Z",...,"mapId":"tiktok.seeding-video.discovery.meta.v1","stepId":"detect-safety-page","eventType":"CAPABILITY_CALL_REVIEW_REQUIRED","status":"review_required","failureReason":"Child detect-safety-page requires governed observation refs before success."}
```

### 2. 实际行为

`buildPageStateDispatchInput` emits governed runtime observations including `captcha-marker` and `safety-wall-marker`. For a normal page they are negative observations: `present=false`. `detect-safety-page` then filters those markers with `.filter(... present)` and builds `matchedObservationIds` only from positive blockers. A normal page therefore produces `matchedObservationIds=[]`, `confidence=0.74`, and `dataQualityFlags=["insufficient_signal"]`. Page State validation correctly refuses a success for an observation-required child with no observation refs and a critical data-quality flag, so the mission transitions to `request-human-review`.

### 3. 法案原本要求

- 法案文件: `.github/instructions/cursor-rules/modules/module-page-state-capability.instructions.md`
- lawId: `GRASSEYE-PAGE-STATE-CAPABILITY-004-V2`
- 主题: observation source and evidence binding gate
- 要求: missing observation support for observation-required children must review/fail; every observation must include proof refs.
- 禁止项: page-state success without observation/evidence support.
- 当前违反点: runtime has governed negative observations, but the child does not bind them as support for the normal classification.

- lawId: `GRASSEYE-PAGE-STATE-CAPABILITY-005-V2`
- 主题: output evidence support
- 要求: success requires evidence/source refs; observation refs exist when child requires observation support; no critical data quality flags.
- 当前违反点: `page_normal` output path leaves observation refs empty and adds `insufficient_signal`.

### 4. 施工图原本要求

- 施工图文件: `docs/法案辅助文件/GrassEye Page State 页面状态感知能力组施工图.md`
- 章节: 7 Observation; 9 Child Capabilities; 12 Output Boundary
- 要求: `detect-safety-page` judges safety/captcha from `page_marker / platform_capture`; success cannot have missing observationRefs or critical data quality flags.
- 当前违反点: `detect-safety-page` considers only positive blocker observations and does not treat governed negative marker observations as support for `page_normal`.

### 5. 根因定位

生产代码:

- 文件路径: `src/lib/local-runtime/workbench-page-state-dispatch-input.ts`
- 函数 / class / route: `buildPageStateObservations`
- 关键判断: emits `captcha-marker` with `present: input.loginState === "review_required"` and `safety-wall-marker` with `present: false`.
- 为什么导致当前错误: input evidence exists, including negative safety evidence.

- 文件路径: `src/capabilities/page-state/children/detect-safety-page/implementation.ts`
- 函数 / class / route: `resolveDetectSafetyPageOutput`, `buildSafetyPageNormalOutput`
- 关键判断: `findPageMarker(...).filter((observation) => observation.payload.present)` and `dataQualityFlags: matchedObservationIds.length > 0 ? [] : ["insufficient_signal"]`
- 为什么导致当前错误: normal page negative observations are excluded from `matchedObservationIds`, so success support refs are empty.

- 文件路径: `src/capabilities/page-state/page-state-result-validation.ts`
- 函数 / class / route: `validateSuccessResultEvidence`, `validateSuccessResultFlags`
- 关键判断: `OBSERVATION_REQUIRED_CHILDREN` includes `detect-safety-page`; `insufficient_signal` is critical.
- 为什么导致当前错误: validator correctly downgrades/blocks the unsafe success; root is child support selection, not validator strictness.

执法代码:

- inspector 文件: `scripts/audit/domains/page-state-capability/required-shape.ts`, `scripts/audit/domains/page-state-capability/anti-escape.ts`
- negative proof 文件: `scripts/audit/domains/page-state-capability/negative-proof-mutations.ts`
- manifest / owner mapping: `scripts/audit/domains/page-state-capability/manifest.json`
- 当前是否覆盖: partially
- 为什么没有拦住: inspector checks that local runtime emits observations and that output boundary blocks missing observations. It does not inspect child-specific normal-page evidence semantics: negative safety observations must be allowed as supporting refs for `page_normal`.

### 6. 为什么执法脚本没有拦住？

C.法案存在，但 inspector 未覆盖 child-specific negative observation support.  
D. inspector verifies shape/calls/fragments, not the dataflow from `present=false` observations into `matchedObservationIds`.  
E. negative proof has `local-runtime-page-state-drops-governed-observations`, but not "normal negative observations exist and child ignores them".

### 7. 应修复层级，但本阶段不修

- 修生产代码: YES, make `detect-safety-page` bind governed negative `captcha`/`safety_wall` observations and/or platform capture as normal-page support.
- 修施工图: YES, clarify `page_normal` for safety detection may be proven by source-bound negative observations.
- 修 inspector: YES, add AST/dataflow check for `detect-safety-page` normal branch using non-present marker observations.
- 修 negative proof: YES, add mutation removing negative-observation support from normal branch.
- 修结构化日志: YES, include `observationRefs` / diagnostic proof ref in review log for faster triage.
- 是否需要申请修改法案: NO

## BLOCKER-3: Runtime event taxonomy misses distinct capability start/finalization events

Priority: P1

### 1. 日志证据

```txt
[GRASSEYE][RUNTIME][EVENT] runtime STEP_DISPATCH_STARTED started Dispatching step "detect-safety-page" to ability group "page-state".
[GRASSEYE][SERVICE][EVENT] internal:app-server:dev stdout stream [grasseye:review] ... "eventType":"CAPABILITY_CALL_REVIEW_REQUIRED" ...
```

- traceId: varies per mission
- runId: present on orchestration events
- attemptId: present in JSON review events
- missionId: present in JSON review events
- taskTemplateId: MISSING on many orchestration terminal events
- selectedMapId: present
- requestedPlatformId: MISSING on many orchestration terminal events
- activationSnapshotRef: present
- commandId / envelopeId: MISSING on capability review events
- stepId: present
- abilityGroupId: target ability group only in prose for `STEP_DISPATCH_STARTED`; JSON review event uses `orchestration`
- childCapabilityId: present
- owner: `Orchestration`
- ownerResponsible: present
- status: present
- failureReason: present when review/fail
- actionableMessage: present

### 2. 实际行为

The log stream uses `STEP_DISPATCH_STARTED` and later `CAPABILITY_CALL_COMPLETED` or `CAPABILITY_CALL_REVIEW_REQUIRED`. The required explicit `CAPABILITY_CALL_STARTED` event is missing. Terminal review uses `MISSION_REVIEW_REQUIRED`; there is no separate `MISSION_FINALIZED` record for the terminal review path.

### 3. 法案原本要求

- 法案文件: `.github/instructions/cursor-rules/modules/module-structured-logging.instructions.md`
- lawId: structured logging law set; exact child law not narrowed in this phase
- 主题: runtime structured event traceability
- 要求: runtime events must expose traceable lifecycle, refs, owner, actionable message, status.
- 禁止项: uncorrelatable lifecycle gaps.
- 当前违反点: capability start and mission terminal finalization taxonomy is incomplete.

### 4. 施工图原本要求

- 施工图文件: `docs/法案辅助文件/GrassEye 结构化日志与运行证明施工图.md`
- 章节: runtime event lifecycle
- 要求: step/capability/mission lifecycle must be reconstructable from structured logs.
- 当前违反点: timeline reconstruction needs inference from `STEP_DISPATCH_STARTED` to `CAPABILITY_CALL_*`.

### 5. 根因定位

生产代码:

- 文件路径: `src/capabilities/orchestration/runtime/*`
- 函数 / class / route: step dispatch event writers and mission terminal event writers
- 关键判断: emits `STEP_DISPATCH_STARTED` but no distinct `CAPABILITY_CALL_STARTED`.
- 为什么导致当前错误: lifecycle is inferable but not explicit.

执法代码:

- inspector 文件: `scripts/audit/domains/*structured*` / `scripts/audit/domains/commander-console-capability/run-startup-readiness-gate-checks.ts`
- negative proof 文件: not identified for this exact taxonomy gap
- manifest / owner mapping: structured logging owner
- 当前是否覆盖: not enough for exact event name coverage
- 为什么没有拦住: no lifecycle negative proof requiring `CAPABILITY_CALL_STARTED` and `MISSION_FINALIZED` on review terminal path.

### 6. 为什么执法脚本没有拦住？

H. runtime logs fields/taxonomy are insufficient for exact lifecycle correlation.  
E. negative proof covers field presence but not event taxonomy completeness.

### 7. 应修复层级，但本阶段不修

- 修生产代码: YES
- 修施工图: YES
- 修 inspector: YES
- 修 negative proof: YES
- 修结构化日志: YES
- 是否需要申请修改法案: NO

## BLOCKER-4: Review logs hide Page State diagnostic refs needed for immediate root cause triage

Priority: P1

### 1. 日志证据

```txt
"eventType":"CAPABILITY_CALL_REVIEW_REQUIRED","status":"review_required","failureReason":"Child detect-safety-page requires governed observation refs before success.","refs":["commander_command_f1e36de5-86a5-4704-adcb-f37abe51d980",0,"detect_login_or_safety"]
```

- traceId: present
- runId: present
- attemptId: present
- missionId: present
- taskTemplateId: MISSING
- selectedMapId: present
- requestedPlatformId: MISSING
- activationSnapshotRef: present
- commandId / envelopeId: MISSING
- stepId: present
- abilityGroupId: `orchestration` rather than target `page-state`
- childCapabilityId: present
- owner: `Orchestration`
- ownerResponsible: `Orchestration / page-state`
- status: `review_required`
- failureReason: present
- actionableMessage: present

### 2. 实际行为

The review line tells us observation refs are missing but does not include `diagnosticPayloadRef`, `runtimeProofRef`, `observationRefs`, or child result data-quality flags. Root cause required code inspection rather than direct proof ref inspection.

### 3. 法案原本要求

- 法案文件: `.github/instructions/cursor-rules/modules/module-page-state-capability.instructions.md`
- lawId: `GRASSEYE-PAGE-STATE-CAPABILITY-005-V2`, `GRASSEYE-PAGE-STATE-CAPABILITY-006-V2`
- 主题: result evidence support and runtime proof completeness
- 要求: failed/review_required must retain diagnostic payload and runtime proof.
- 禁止项: review path without proof refs.
- 当前违反点: result/proof may exist internally, but terminal review log does not surface enough refs.

### 4. 施工图原本要求

- 施工图文件: `docs/法案辅助文件/GrassEye Page State 页面状态感知能力组施工图.md`
- 章节: 10 Output Model; 11 Runtime Proof
- 要求: review result keeps diagnosticPayloadRef and runtimeProof.
- 当前违反点: review event does not surface diagnostic refs in terminal-friendly fields.

### 5. 根因定位

生产代码:

- 文件路径: `src/capabilities/orchestration/runtime/*` and Page State result mapping path
- 函数 / class / route: capability result to orchestration review event mapper
- 关键判断: terminal event `refs` uses mission/round/trace labels, not Page State diagnostic/proof refs.
- 为什么导致当前错误: root cause triage requires opening code/result builders instead of following refs.

执法代码:

- inspector 文件: Page State and structured logging inspectors
- negative proof 文件: no exact negative proof found for surfacing Page State diagnostic refs in orchestration review logs
- manifest / owner mapping: Page State / Orchestration / structured logging
- 当前是否覆盖: partial
- 为什么没有拦住: proof existence is checked more than proof surfacing.

### 6. 为什么执法脚本没有拦住？

H. runtime log fields are insufficient.  
C. law exists for proof/result completeness but inspector does not cover terminal log surfacing for this review path.

### 7. 应修复层级，但本阶段不修

- 修生产代码: YES
- 修施工图: optional clarification
- 修 inspector: YES
- 修 negative proof: YES
- 修结构化日志: YES
- 是否需要申请修改法案: NO

## P2 Backlog

- BLOCKER-5: Some terminal prose labels say `abilityGroupId="orchestration"` for the JSON event while the actual target ability group is `page-state`. This is not blocking execution but slows operator triage.
