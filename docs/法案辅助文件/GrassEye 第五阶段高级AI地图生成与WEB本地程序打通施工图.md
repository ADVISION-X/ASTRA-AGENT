# GrassEye 第五阶段高级AI地图生成与WEB本地程序打通施工图

status: active / current delivery authority under phase-five final-delivery debugging.

## 1. 施工边界

本施工图只补第五阶段建设细节，不新增 lawId，不修改冻结法案。若本文与 `.github/instructions/cursor-rules/**` 冲突，以冻结法案为准。

第五阶段复用既有治理域：

- AI：map authoring request、structured draft output、runtime debug truth。
- map-plugin-package：draft package import、quarantine、validation、compatibility、approval lifecycle。
- Commander Console：operator entry、Map Lab UI/API、command acceptance truth。
- Orchestration：activation snapshot freeze、step selection、transition truth。
- Nerve Bus：dispatch/result envelope transport proof。
- Open / Page State / Screenshot / Visual Target / Geometry Guard / Mouse Click / Mouse Scroll / Text Input / PAV：WEB 与本地程序执行链。
- Forensics：structured runtime event、write boundary、idempotency proof。

## 2. Map Lab 生成地图链路

生产入口必须保持：

```txt
generateMapLabDraft
→ MapAuthoringRequestSchema.parse
→ buildProviderStateSnapshot
→ buildMapAuthoringAiRequest
→ aiAbilityGroup.execute
→ normalizeMapLabDraft
→ registry.importPackage
```

约束：

- `aiResult.status !== "success"` 不得 import。
- dry run captured 不得 import。
- validation issues 必须返回 `review_required` 或 `failed`。
- generated package 不得包含 executable marker、function、handler、script、exec、shell、import、require、browser action implementation。
- 不得调用 active registry regression，例如 `activatePackage`、`setActive`、`writeActive`。

## 3. AI runtime debug truth

AI runtime composition root 必须注入 `emitDebugEvent`：

```txt
createWorkbenchAiAbilityGroup
→ createConfiguredAiAbilityGroup({ emitDebugEvent })
→ createAiExecutionContext / createProviderAwareAiRuntimePort
→ createLocalAiRuntimePort / external runtime
→ local-ai-runtime-debug
→ Forensics writeStructuredRuntimeEvent
→ terminal structured relay
```

`AI_REQUEST_DEBUG`、`AI_RESPONSE_DEBUG`、`AI_ERROR_DEBUG` 必须进入 structured runtime event sink。AI 不得 import Forensics runtime internals，只能通过 public ability-group boundary 写结构化事件。

AI error terminal proof 至少包含：

- `stepId`
- `taskType`
- `promptContractId`
- `outputSchemaRef`
- `childCapabilityId`
- `runtimeCallId`
- `implementationStatus`
- `errorKind`
- `failureReason`
- `diagnosticPayloadRef` 或 `rawResponseRef/rawResponseHash`
- `ownerResponsible`
- `actionableMessage`
- `durationMs`

不得在 info terminal summary 中泄露 cookie、token、secret、credential、base64 image 或完整 raw prompt。

## 4. Page State dispatch envelope

`buildPageStateDispatchPayload()` 是 local-runtime Page State dispatch canonical builder。它必须从 `input.envelope` 传播：

```txt
runId
sessionId
stepId
mapPackageId
mapPackageVersion
selectedMapId
selectedMapVersion
activationSnapshotRef
capabilityCallId
nerveBusEnvelopeId
inputRef
idempotencyKey
```

`openHandoff.browserSessionRef` 必须来自 active browser session ref，例如 `input.session.browserProfileRef`。inspector 必须用 AST/symbol 识别字段来源，不能以 stale generated summary 作为最终事实。

## 5. Commander accepted 后事件语义

`COMMAND_REJECTED` 只表示 command 未进入 mission runtime。一旦同一 command/run 已有 command envelope、result envelope、owner evidence 或 `COMMAND_ACCEPTED`，后续 observer timeout 不得再写 `COMMAND_REJECTED`。

accepted 后 timeout 必须写：

```txt
COMMAND_RECEIPT_TIMEOUT_AFTER_ACCEPTED
```

并携带 command/result/proof refs，actionableMessage 指向继续追踪 Orchestration runtime events。

## 6. Forensics 去重证明

Forensics structured write boundary 必须发：

```txt
FORENSICS_RECORD_WRITE_REQUESTED
FORENSICS_RECORD_WRITTEN
FORENSICS_RECORD_WRITE_REVIEW_REQUIRED
```

`WRITE_REQUESTED` refs 至少包含：

```txt
sourceEventId
sourceEventType
sourceOwner
recordKind
pendingRecordId
idempotencyKey
dedupeDecision=pending
```

`WRITTEN` refs 至少包含：

```txt
sourceEventId
sourceEventType
recordId
recordRef
idempotencyKey
dedupeDecision=written 或 deduped
storageRef
durabilityMode=durable 或 memory_only
```

当 Forensics child result 为 `review_required` 时，不得输出 `FORENSICS_RECORD_WRITTEN status=success`。必须输出 `FORENSICS_RECORD_WRITE_REVIEW_REQUIRED status=review_required`，并保留 `sourceEventId/sourceEventType/recordId/recordRef/idempotencyKey/storageRef/durabilityMode`。如果 `storageRef=MISSING`，终端摘要必须明确 `durabilityMode=memory_only` 或进入 review-required durability 事件，不能把该记录描述成 durable persisted proof。

大 payload 只能给 ref/hash，不得把完整 runtime payload 打进终端摘要。

## 7. 执法要求

第五阶段执法必须证明生产代码吻合法案和施工图：

- AST/symbol/import graph 检查生产路径。
- real-code-inspection 覆盖生产突变和 inspector wiring 突变。
- generated artifacts 必须可重建，不得手写 `scripts/audit/generated/**`。
- ci-full-summary stale 时必须记录 stale root cause，并以重跑 owner inspector 为准。
## Phase-05 owner evidence Hardening Addendum

- AI debug events must never infer `selectedMapId`, `runId`, `mapPackageId`, or `activationSnapshotRef` from `traceId`. `traceId` is observability only; governed chain truth must come from the upstream command envelope, mission context, and active map chain fields.
- Every `AI_REQUEST_DEBUG` must terminate under the same `runtimeCallId` with exactly one `AI_RESPONSE_DEBUG` or `AI_ERROR_DEBUG` path, and that terminal event must enter the structured runtime event sink.
- `capabilityCallId` is the step invocation id across selected/precondition/dispatch/started/completed/transition lifecycle events. Result envelope ids must be emitted as `resultEnvelopeRef` or equivalent refs, not substituted into `capabilityCallId`.
- `durabilityMode=durable` plus `status=review_required` is not a ready state. If storage, record ref, owner evidence, idempotency, and chain fields are complete, Forensics should emit `FORENSICS_RECORD_WRITTEN status=success`.
- Business maps must stay business-shaped. Full phase-05 coverage belongs in a dedicated draft/local diagnostic map, with social-platform text input and destructive actions forbidden.

## Phase-05 Runtime Closure Addendum

- Forensics structured writes must close for every owner that uses the public `writeStructuredRuntimeEvent` / `writeStructuredActionLog` boundary. `FORENSICS_RECORD_WRITE_REQUESTED` is only an acceptance signal; each request must terminate as `FORENSICS_RECORD_WRITTEN` or `FORENSICS_RECORD_WRITE_REVIEW_REQUIRED`, including Commander, Nerve Bus, Orchestration, Page State, Screenshot, PAV, and AI-originated events.
- AI `quality_gate_blocked` is not an acceptable sole diagnostic reason. Rejected or review-required AI results must expose the concrete gate reason, including schema decision/status, quality decision reason, output-boundary decision, confidence/minimum confidence, data-quality flags, parsed decision, runtime call id, and diagnostic payload ref.
- AI `runtimeCallId` is an AI runtime-internal call identifier. It must never replace the governed `capabilityCallId`, which remains the Orchestration step invocation id. `traceId` remains observability-only and must not become governance chain truth.
- Terminal visible AI debug logs should de-duplicate repeated human-readable lines by bounded keys such as `runtimeCallId`, `eventType`, `implementationStatus`, and `diagnosticPayloadRef`; the Forensics ledger must still retain the underlying proof events.
- Business Facebook/TikTok maps may stop at governed review gates. The `builtin.phase-05-full-surface-diagnostic` map is the acceptance surface for all 14 ability-group evidence paths, with text input and click actions constrained to local sandbox, dry-run, no-op, or explicit review gates.

## Phase-05 Forensics Durability Gate Addendum

- Forensics storage health is a mission preflight hard gate. A preflight cannot emit `MISSION_PREFLIGHT_PASSED` or `COMMAND_DISPATCH_READY` when the evidence store reports `storage_write_failed`, `integrity_violation`, `storageRef=MISSING`, or an unavailable durable write probe.
- The local evidence store must create its state directory before any `state.json` write and must recover a missing `state.json` by initializing governed state, not by returning `memory_only`.
- Mission readiness and start preflight must surface Forensics health as blocked/degraded with an actionable storage reason. Local AI readiness alone is not sufficient for phase-05 mission readiness.
- The phase-05 diagnostic map must be runnable as the governed diagnostic acceptance surface and must use deterministic internal schema validation for its AI coverage. It must not reuse business product-presence uncertainty as a branch that can stop visual-target, geometry-guard, click, text-input, scroll, PAV, or evidence-record coverage.
