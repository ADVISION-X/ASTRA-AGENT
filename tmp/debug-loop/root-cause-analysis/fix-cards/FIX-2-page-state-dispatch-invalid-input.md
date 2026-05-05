blockerId: BLOCKER-PAGE-STATE-DISPATCH-INVALID-INPUT

日志证据:
- 本阶段 direct `executeMission(...)` 本地复现曾在 `detect-login-state` / `detect-safety-page` 路径持续返回 `failureReason=invalid_input`，根因收敛到 Page State local-runtime builder 与 non-success result/proof 组装漂移。
- 修复后，本地 `executeMission(...)` 已不再返回 `invalid_input` 或 `execution_failed`，而是进入受控 `review_required` 结果。
- fresh live run `commander_command_89c7638d-522d-4453-b673-6937fcddf424:run` 的过滤日志现已显示 `ORCHESTRATION_START_RECEIVED` started、`MISSION_ACTIVATION_SNAPSHOT_FROZEN` success、`COMMAND_ACCEPTED` success；同一 run 中未再出现 `COMMAND_REJECTED failureReason=invalid_input`。

法案要求:
- Page State 输入必须带完整 mission/run/step/map chain、snapshot proof、open handoff、sourceEvidenceRefs 与受控 observations，不能由 local-runtime 拼出脱离 `PageStateAbilityInputSchema` 的伪输入。
- Page State runtime proof 与 result 必须保持链路字段、`pageStateFingerprint`、`observationRefs`、`diagnosticPayloadRef` 的一致性，非 success 结果也不能丢 proof parity。
- 没有 owner-local inspector + negative proof 的 Page State law 不能算 active enforcement。

施工图要求:
- `PageStateAbilityInput` 必须包含 `abilityGroupId`、`childCapabilityId`、`runId`、`missionId`、`sessionId`、`stepId`、`mapPackageId`、`selectedMapId`、`activationSnapshotRef`、`capabilityCallId`、`nerveBusEnvelopeId`、`sourceEvidenceRefs`、`openHandoff`、`inputRef`、`idempotencyKey`。
- Page State 只能从 governed snapshot + observations + evidence refs 做当前页面状态判定；不能把 local-runtime 旧默认值或硬编码 child 当成真实页面状态输入。
- failed / review_required 路径也必须保留 runtime proof 所需的 `pageStateFingerprint`、`observationRefs`、`diagnosticPayloadRef`，不能只在 success 时成立。

生产根因文件:
- src/lib/local-runtime/workbench-page-state-dispatch-input.ts
- src/lib/local-runtime/workbench-ability-command-executor.ts
- src/capabilities/page-state/runtime/page-state-result-builder.ts
- src/capabilities/page-state/runtime/page-state-success-result.ts

执法缺口文件:
- scripts/audit/domains/page-state-capability/required-shape.ts
- scripts/audit/domains/page-state-capability/negative-proof-mutations.ts
- scripts/audit/domains/page-state-capability/inspector.ts
- tmp/debug-loop/regression-proofs/BLOCKER-PAGE-STATE-DISPATCH-INVALID-INPUT/inspector-fail-output.txt

为什么没拦住:
- 既有 page-state owner inspector 主要覆盖能力组 canonical package 内部形状，没有把真正出故障的 `src/lib/local-runtime/workbench-page-state-dispatch-input.ts` 与 `src/lib/local-runtime/workbench-ability-command-executor.ts` 纳入 owner-local required-shape。
- negative proof 之前没有覆盖这次真实故障形态：hardcoded `childCapabilityId`、丢失 governed observations、executor 不再传 `inputPayload`、以及 non-success result/proof parity 漂移。
- 因为 local-runtime builder drift 没被 machine-blocking 提前拦住，Page State child 自身健康时，错误被伪装成更外层 `invalid_input` / `execution_failed`。

修复策略:
- 在 `workbench-page-state-dispatch-input.ts` 物理重建 Page State dispatch builder：从真实 envelope + payload 解析 child capability、chain fields、snapshot、sourceEvidenceRefs、openHandoff 与 governed observations。
- 在 `workbench-ability-command-executor.ts` 把真实 `inputPayload` 传入 `buildPageStateDispatchInput(...)`，避免 builder 继续使用过期默认值。
- 在 `page-state-result-builder.ts` 恢复 failed / review_required 结果对 `runtimeProof.pageStateFingerprint` 与 `runtimeProof.observationRefs` 的保留。
- 在 `page-state-success-result.ts` 为非 success outcome 恢复 `diagnosticPayloadRef`，满足 proof builder 的严格校验。

防复发策略:
- 在 page-state owner inspector 的 `required-shape` 中新增 AST 级检查，直接约束 local-runtime Page State builder 必须传播 envelope chain fields、从 `envelope.commandName` 解析 child capability、发出 governed observations，并要求 executor 传入真实 `inputPayload`。
- 在同一 `required-shape` 中新增 non-success parity 检查，禁止 `page-state-result-builder.ts` 与 `page-state-success-result.ts` 再次丢失 `pageStateFingerprint`、`observationRefs`、`diagnosticPayloadRef`。
- 在 `negative-proof-mutations.ts` 中加入上述真实回归形态的生产突变，确保 inspector 不只是“会检查”，而是对这些漂移真实 FAIL。
- 保存真实生产突变证据到 `tmp/debug-loop/regression-proofs/BLOCKER-PAGE-STATE-DISPATCH-INVALID-INPUT/`。

生产突变验证策略:
- 突变 1：把 `src/lib/local-runtime/workbench-page-state-dispatch-input.ts` 改回 hardcoded `childCapabilityId = "detect-platform-page-kind"`，预期 page-state inspector FAIL。
- 突变 2：把 builder 的 `observations` 改回空数组，预期 page-state inspector FAIL。
- 突变 3：让 `src/lib/local-runtime/workbench-ability-command-executor.ts` 不再向 `buildPageStateDispatchInput(...)` 传 `inputPayload`，预期 page-state inspector FAIL。
- 突变 4：让 `page-state-success-result.ts` / `page-state-result-builder.ts` 再次丢失 non-success parity 字段，预期 page-state inspector FAIL。
- 回滚上述任一突变后，page-state inspector 必须恢复 PASS。

修复后真实重启验证点:
- 真实 `npm run grasseye:start` 重启后，`/api/runtime/health` 返回 ready。
- fresh `POST /api/tasks/start` 对 Facebook seeding-video discovery 返回 200，且 Commander 侧结果为 `transportStatus=accepted`。
- fresh live log 对 run `commander_command_89c7638d-522d-4453-b673-6937fcddf424:run` 现已显示 `MISSION_ACTIVATION_SNAPSHOT_FROZEN` success 与 `COMMAND_ACCEPTED` success，证明旧的 page-state `invalid_input` 阻塞链已消失。

修复后最新日志应不再出现的同类问题:
- `COMMAND_REJECTED failureReason=invalid_input`，而根因其实来自 Page State local-runtime builder drift。
- `MISSION_ACTIVATION_SNAPSHOT_FROZEN failed ... failureReason=invalid_input` 这类由 Page State 输入装配错误伪装出的上层拒绝。
- Page State non-success 路径因 `pageStateFingerprint` / `observationRefs` / `diagnosticPayloadRef` 缺失而触发的 `execution_failed` 或 proof/result parity 崩溃。
