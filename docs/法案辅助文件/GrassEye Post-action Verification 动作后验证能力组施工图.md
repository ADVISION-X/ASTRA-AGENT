# GrassEye Post-action Verification 动作后验证能力组施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-POST-ACTION-VERIFICATION-BLUEPRINT-FINAL
owner: post-action-verification-capability
documentType: construction-blueprint
lawAuthority: module-post-action-verification-capability.instructions.md
architecturePhase: Static Capability Package Architecture
status: active
replace:
  - docs/法案辅助文件/GrassEye Post-action Verification 动作后验证能力组施工图.md
mustNotCreate:
  - new lawId
  - new ability group
  - post-action verification as semantic judgment owner
  - confidencePolicy on PAV input or output
  - verificationDecision on PAV public surfaces
```

本施工图是 module-post-action-verification-capability.instructions.md 的建设级落地映射。
本施工图不新增 lawId，不修改冻结法案，不重新分配主权。
若本文档与 PAV 法案冲突，以 PAV 法案为最高权威。

---

## 1. 定位

Post-action Verification 不是动作结果语义裁决能力组。

它负责回答：

```txt
动作执行以后，围绕这个动作的观察包有没有被可靠地绑定、整理、输出？
```

它不负责回答：

```txt
动作是否应该执行？
页面现在业务上意味着什么？
产品是否存在？
动作最终语义上算成功还是失败？
下一步怎么走？
证据如何落盘？
```

一句话：

```txt
动作能力只证明“我动了”，PAV 只证明“动作后观察包被可靠构建了”，最终语义判断仍归 AI。
```

---

## 2. 故事链路位置

```txt
Open / Click / Scroll
→ action proof / action log ref
→ Page State / Screenshot / Visual Target / AI observations
→ Post-action Verification
→ action-observation bundle
→ AI judgement / Orchestration branch / Forensics persistence consumers
```

说明：
- AI 既可以是观察来源之一，也可以在需要语义 yes/no 时作为最终判断来源。
- PAV 不替代 AI judgment。
- PAV 也不替代 Forensics 持久化。

---

## 3. 标准包结构

```txt
src/capabilities/post-action-verification/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── ports/
│   ├── post-action-evidence-read-port.ts
│   └── post-action-verification-clock-port.ts
├── shared/
│   ├── post-action-evidence.ts
│   ├── post-action-observation.ts
│   ├── post-action-policy.ts
│   ├── post-action-proof.ts
│   ├── post-action-result.ts
│   ├── post-action-types.ts
│   └── post-action-url.ts
├── runtime/
│   ├── post-action-decision-gate.ts
│   ├── post-action-result-builders.ts
│   ├── post-action-runtime-proof-builder.ts
│   ├── post-action-verification-executor.ts
│   └── post-action-verification-runtime-context.ts
└── children/
    └── post-action-observation-child.ts
```

当前实现不是每个 child 一个独立目录，而是通过统一 child 实现加 childCapabilityId 分发。

---

## 4. Public Contract

Public group surface：

```txt
listChildCapabilityIds()
execute(input)
```

Public contract concepts：

```txt
PostActionVerificationAbilityInput
PostActionVerificationAbilityResult
PostActionExpectedOutcome
PostActionActionProof
PostActionObservation
PostActionEvidenceRef
PostActionVerificationPolicy
PostActionVerificationOutput
PostActionRuntimeProof
```

禁止 public contract 暴露：

```txt
PostActionVerificationDecision
PostActionConfidencePolicy
minimumConfidence
verificationDecision
confidence
actionResultVerifiedRef
verifiedByEvidenceKinds
runtime context internals
child private execute surface
browser controller
Forensics writer
```

---

## 5. Input Model

PostActionVerificationAbilityInput 必须包含：

```yaml
PostActionVerificationAbilityInput:
  abilityGroupId: post-action-verification
  childCapabilityId: required
  requestedBy: orchestration
  missionId: required
  runId: required
  sessionId: required
  roundId: required-or-null
  videoVisitId: required-or-null
  stepId: required
  mapPackageId: required
  mapPackageVersion: required
  selectedMapId: required
  selectedMapVersion: required
  activationSnapshotRef: required
  capabilityCallId: required
  nerveBusEnvelopeId: required
  sourceAbilityGroupId: required
  sourceChildCapabilityId: required
  sourceActionType: required
  expectedOutcome: required
  actionProof: required
  beforeAfterEvidence: required
  observationSet: required
  verificationPolicy: required
  inputRef: required
  idempotencyKey: required
```

当前 phase-four sourceAbilityGroupId 代码面只允许：

```txt
open
mouse-click
mouse-scroll
```

PAV input 不再接受 confidencePolicy 或 minimumConfidence。

---

## 6. Action Proof

PostActionActionProof：

```yaml
actionProof:
  actionProofRef: required
  actionLogRef: required-or-actionRecordRef
  actionRecordRef: required-or-actionLogRef
  sourceRuntimeProofRef: required
  sourceActionResultRef: optional
  sourceActionOutputRef: optional
  sourceAbilityGroupId: open | mouse-click | mouse-scroll
  sourceChildCapabilityId: required
  actionType: required
  actionStatus: required
  primitiveExecutionRef: optional
  navigationAttemptRef: optional
  scrollExecutionRef: optional
  sessionId: required
  roundId: required-or-null
  videoVisitId: required-or-null
  startedAt: required
  endedAt: required
  selfReportedOnly: boolean
```

Rules：

```txt
selfReportedOnly = true 且 allowSelfReportedSuccess = false -> 不得 success
missing actionLogRef/actionRecordRef -> 不得 success
missing sourceRuntimeProofRef -> 不得 success
缺链路字段 -> 不得 success
动作 primitive success 不等于最终语义成功
```

---

## 7. Expected Outcome 与 Verification Policy

Expected outcome types：

```txt
page_opened
comments_panel_opened
comments_panel_closed
not_interested_applied
target_state_changed
```

PostActionExpectedOutcome：

```yaml
expectedOutcome:
  outcomeType: required
  description: required
  expectedUrlHost: optional-or-null
  expectedUrlPrefix: optional-or-null
  expectedState: optional-or-null
  expectedTargetType: optional-or-null
  requiresBeforeAfterComparison: boolean
  requiresVisualEvidence: boolean
```

VerificationPolicy：

```yaml
verificationPolicy:
  verificationMode:
    - visual_evidence
    - observation_only
    - before_after_comparison
  requireAfterEvidence: boolean
  requireBeforeAfterComparison: boolean
  allowSelfReportedSuccess: boolean
```

当前机械 gate 重点约束的是：

```txt
allowSelfReportedSuccess
requireAfterEvidence
requireBeforeAfterComparison
expectedOutcome.requiresBeforeAfterComparison
expectedOutcome.requiresVisualEvidence
```

---

## 8. Evidence 与 Observation

Allowed evidence kinds：

```txt
page_state
screenshot
visual_target
ai_observation
runtime_signal
screenshot_diff
video_identity
```

Allowed observation kinds：

```txt
page_state
ai_observation
visual_target
screenshot_diff
video_identity
action_completion
runtime_signal
```

Allowed observation source ability groups：

```txt
page-state
screenshot
visual-target
ai
post-action-verification
```

Observation shape：

```yaml
PostActionObservation:
  kind: required
  ref: required
  source:
    sourceAbilityGroupId: required
    sourceChildCapabilityId: required
    sourceProofRef: required
  capturedAt: required
  sessionId: required
  roundId: required-or-null
  videoVisitId: required-or-null
  payload: strict-by-kind
```

Package success 至少要求：

```txt
supportingObservationRefs 非空
supportingSourceProofRefs 非空
supportingEvidenceRefs 如存在则必须通过 evidence binding
```

---

## 9. Output Model

PostActionVerificationAbilityResult 的 status 只表示“观察包构建状态”：

```txt
success
failed
review_required
```

Success output：

```yaml
output:
  packageLabel: required
  observationSummary: required
  evidenceRefs: list
  observationRefs: required-non-empty
  postActionObservationRef: required
  actionObservationBundleRef: required
  observationFingerprint: required
  supportingSourceProofRefs: required-non-empty
```

Failure 或 review_required：

```txt
output = null
diagnosticPayloadRef 必须存在
runtimeProof 必须存在
```

关键语义：

```txt
success = 观察包成功构建
success != 动作语义上被最终判定为成功
```

---

## 10. Runtime Proof

PostActionRuntimeProof 必须保留真实链路字段：

```txt
proofId
missionId
runId
sessionId
roundId
videoVisitId
stepId
mapPackageId
mapPackageVersion
selectedMapId
selectedMapVersion
activationSnapshotRef
capabilityCallId
nerveBusEnvelopeId
abilityGroupId
childCapabilityId
inputRef
actionProofRef
actionLogRef
sourceActionRuntimeProofRef
sourceActionResultRef
sourceActionOutputRef
sourceActionAbilityGroupId
sourceActionChildCapabilityId
actionType
actionStatus
expectedOutcomeType
beforeEvidenceRefs
afterEvidenceRefs
observationRefs
evidenceSourceRefs
outputRef or diagnosticPayloadRef
debugLogRef
structuredRuntimeEventRef optional
inputPayloadHash
actionProofHash
expectedOutcomeHash
beforeEvidenceHash
afterEvidenceHash
observationSetHash
observationFingerprint
receivedShapeHash
startedAt
endedAt
durationMs
status
failureReason
reviewRequiredReason
processingMode
dataQualityFlags
clock
```

processingMode 当前只允许：

```txt
observation_packaging
invalid_input_failure
```

RuntimeProof 禁止再出现：

```txt
verificationDecision
confidence
confidencePolicy
minimumConfidence
verificationDecisionTrace
outputBoundaryDecision
policyDecision
```

---

## 11. Runtime Pipeline

当前执行链：

```txt
input schema parse
→ child registry resolve
→ shared child execute
→ evaluatePostActionObservationBundleGate
→ createSuccessfulPostActionResult / createPostActionFailureResult
→ buildPostActionRuntimeProof
```

无效输入走：

```txt
schema parse fail
→ createInvalidPostActionInputResult
→ buildPostActionRuntimeProof(processingMode = invalid_input_failure)
```

旧的 confidence policy / verification decision gate 流程已经不是当前实现。

---

## 12. Active Child Capabilities

当前 childCapabilityId：

```txt
observe-page-open-attempt
observe-comments-panel-open-attempt
observe-comments-panel-close-attempt
observe-not-interested-attempt
observe-target-state-transition
verify-action-result
```

当前 registry 行为：

```txt
所有 active childCapabilityId -> children/post-action-observation-child.ts
```

Child 只允许输出 child observation，不允许：

```txt
构造最终 PostActionVerificationAbilityResult
构造 runtimeProof
直接调用 AI / Screenshot / Page State / Visual Target / Open / Mouse / Text Input 实现
直接读 DOM/BOM
```

---

## 13. 硬边界

必须坚持：

```txt
PAV 不是 semantic judgment owner
AI 是最终语义判断来源
PAV 不调用 AI runtime
PAV 不做页面采集
PAV 不做动作执行
PAV 不做 Forensics 最终写入
PAV 不决定 Orchestration 下一步
视频内容变化的语义判断归 AI，不归 PAV / DOM / hash 规则
```

---

## 14. 执法与验收

执法入口：

```txt
scripts/audit/domains/post-action-verification-capability/inspector.ts
scripts/audit/domains/post-action-verification-capability/run-inspector.ts
scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts
```

交付前至少满足：

```txt
audit:post-action-verification PASS
负例 fail -> rollback -> pass
law 与 blueprint 术语一致
无 verificationDecision / confidencePolicy 漂移回 PAV
CI-FULL PASS
```