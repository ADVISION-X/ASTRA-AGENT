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
  - page-state verification owner
  - action ability verification owner
  - evidence persistence owner
```

本施工图是 `module-post-action-verification-capability.instructions.md` 的建设级落地映射。  
本施工图不新增 lawId，不修改冻结法案，不重新分配主权。  
若本文档与 PAV 法案冲突，以 PAV 法案为最高权威。

---

## 1. 定位

Post-action Verification 是动作执行后的结果裁决能力组。

它负责回答：

```txt
动作执行以后，预期结果是否真的发生？
```

它不回答：

```txt
动作是否应该执行？
下一步怎么走？
页面现在是什么？
产品是否存在？
AI 判断是否正确？
证据如何落盘？
```

一句话：

```txt
动作能力只证明“我动了”，PAV 才证明“事情是否发生了”。
```

---

## 2. 故事链路位置

```txt
Open / Click / Scroll / Text Input
→ action proof / action log ref
→ Screenshot / Page State / Visual Target / AI observations
→ Post-action Verification
→ verificationDecision
→ Orchestration branch
→ Forensics Persistence record
```

PAV 只能在动作完成后运行。  
PAV 不主动采集证据，只消费已经被治理的证据和观察。

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
│   ├── post-action-types.ts
│   ├── post-action-policy.ts
│   ├── post-action-result.ts
│   ├── post-action-proof.ts
│   ├── post-action-failure.ts
│   ├── post-action-evidence.ts
│   ├── post-action-observation.ts
│   └── post-action-url.ts
├── runtime/
│   ├── post-action-verification-executor.ts
│   ├── verification-input-gate.ts
│   ├── action-proof-gate.ts
│   ├── evidence-source-gate.ts
│   ├── observation-proof-binding-gate.ts
│   ├── before-after-consistency-gate.ts
│   ├── verification-policy-gate.ts
│   ├── verification-decision-gate.ts
│   ├── post-action-output-boundary-gate.ts
│   ├── verification-proof-builder.ts
│   ├── verification-result-builder.ts
│   └── verification-dispatch-failure.ts
└── children/
    ├── verify-page-opened/
    ├── verify-comments-panel-opened/
    ├── verify-comments-panel-closed/
    ├── verify-video-changed-after-scroll/
    ├── verify-not-interested-result/
    └── verify-target-state-changed/
```

`runtime/` 在 PAV 中允许存在，因为它是验证运行门禁，不是 Forensics finalizer。  
`runtime/` 禁止包含动作执行、截图、AI 调用、Forensics 写入、Orchestration 决策。

---

## 4. Public Contract

Public group surface：

```txt
listChildCapabilityIds()
execute(input)
```

允许 thin wrapper 仅当：

```txt
wrapper → execute(input)
不绕过 schema / registry / gate / proof
```

Public contract concepts：

```txt
PostActionVerificationAbilityInput
PostActionVerificationAbilityResult
PostActionExpectedOutcome
PostActionVerificationDecision
PostActionObservationRef
PostActionEvidenceRef
PostActionFailureReason
PostActionRuntimeProof
PostActionVerificationPolicy
PostActionConfidencePolicy
```

禁止 public contract 暴露：

```txt
child execute interface
runtime context
screenshot implementation
page-state implementation
AI implementation
Forensics writer
browser controller
DOM/BOM object
```

---

## 5. Input Model

`PostActionVerificationAbilityInput` 必须包含：

```yaml
PostActionVerificationAbilityInput:
  abilityGroupId: post-action-verification
  childCapabilityId: required
  requestedBy: orchestration
  missionId: required
  runId: required
  sessionId: required
  roundId: required-or-null
  videoVisitId: optional
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
  actionProof: required
  expectedOutcome: required
  beforeAfterEvidence: required
  observationSet: required
  verificationPolicy: required
  confidencePolicy: required
  inputRef: required
  idempotencyKey: required
```

缺失以下字段不得 success：

```txt
missionId
runId
stepId
activationSnapshotRef
capabilityCallId
nerveBusEnvelopeId
actionProof
expectedOutcome
inputRef
idempotencyKey
```

---

## 6. Action Proof

`PostActionActionProof`：

```yaml
actionProof:
  actionProofRef: required
  actionLogRef: required-or-actionRecordRef
  actionRecordRef: required-or-actionLogRef
  sourceRuntimeProofRef: required
  sourceActionResultRef: optional
  sourceActionOutputRef: optional
  sourceAbilityGroupId: open | mouse-click | mouse-scroll | text-input
  sourceChildCapabilityId: required
  actionType: required
  actionStatus: dispatched | completed | failed | review_required
  primitiveExecutionRef: optional
  navigationAttemptRef: optional
  scrollExecutionRef: optional
  startedAt: required
  endedAt: required
  selfReportedOnly: boolean
```

Rules:

```txt
selfReportedOnly = true → cannot verified
missing actionLogRef/actionRecordRef → cannot verified
missing sourceRuntimeProofRef → cannot verified
forbidden source ability → failed
action failed → failed or review_required
```

---

## 7. Expected Outcome

`PostActionExpectedOutcome`：

```yaml
expectedOutcome:
  outcomeType:
    - page_opened
    - comments_panel_opened
    - comments_panel_closed
    - video_changed_after_scroll
    - not_interested_applied
    - target_state_changed
  description: required
  expectedUrlHost: optional
  expectedUrlPrefix: optional
  expectedState: optional
  expectedTargetType: optional
  requiresBeforeAfterComparison: boolean
  requiresVisualEvidence: boolean
```

Expected outcome 是地图 step 声明的验证目标。  
PAV 不可临时发明新目标。

---

## 8. Evidence / Observation

Evidence refs：

```txt
beforeEvidenceRef
afterEvidenceRef
screenshotDiffRef
pageStateRef
aiObservationRef
visualTargetRef
runtimeSignalRef
```

Observation 必须有：

```yaml
PostActionObservation:
  kind: page_state | ai_observation | visual_target | screenshot_diff | video_identity | action_completion | runtime_signal
  ref: required
  source:
    sourceAbilityGroupId: required
    sourceChildCapabilityId: required
    sourceProofRef: required
  capturedAt: required
  payload: strict-by-kind
```

Verified result 必须至少有：

```txt
supportingEvidenceRefs OR supportingObservationRefs
supportingSourceProofRefs
```

如果 policy 要求 afterEvidence，缺失不得 verified。  
如果 expectedOutcome requiresBeforeAfterComparison，缺 before/after 不得 verified。  
如果 requiresVisualEvidence，缺 visual/screenshot evidence 不得 verified。

---

## 9. Verification Policy

```yaml
PostActionVerificationPolicy:
  verificationMode:
    - strict
    - evidence-weighted
    - review-on-ambiguous
  requireAfterEvidence: boolean
  requireBeforeAfterComparison: boolean
  allowSelfReportedSuccess: false-by-default
```

```yaml
PostActionConfidencePolicy:
  minimumConfidence: number
  allowReviewRequired: boolean
```

Rules:

```txt
confidence < minimumConfidence → review_required or failed
critical data quality flag → not success
ambiguous/contradictory evidence → review_required or failed
```

---

## 10. Runtime Pipeline

PAV executor 必须固定：

```txt
input schema gate
→ child registry gate
→ action proof gate
→ evidence source gate
→ observation proof binding gate
→ before/after consistency gate
→ verification policy gate
→ child assessment
→ verification decision gate
→ output boundary gate
→ proof builder
→ result builder
```

禁止：

```txt
child direct final result
child direct proof
executor skipping action proof gate
executor skipping output boundary
success without proof
```

---

## 11. Child Capabilities

| child | 作用 | 必须观察 | 禁止 |
|---|---|---|---|
| verify-page-opened | 验证页面打开 | page_state / url evidence | open page |
| verify-comments-panel-opened | 验证评论面板打开 | page_state / visual_target / ai_observation | click |
| verify-comments-panel-closed | 验证评论面板关闭 | page_state / visual_target / ai_observation | click |
| verify-video-changed-after-scroll | 验证滚动后视频变化 | video_identity / screenshot_diff / page_state | scroll |
| verify-not-interested-result | 验证 not interested 生效 | page_state / screenshot_diff / runtime_signal | click |
| verify-target-state-changed | 验证目标状态变化 | visual_target / screenshot_diff / page_state | action |

Child 只能返回 assessment：

```yaml
PostActionChildAssessment:
  observedOutcome: string
  verificationDecision: verified | failed | review_required
  confidence: number
  failureReason: optional
  reviewRequiredReason: optional
  statusMessage: string
  dataQualityFlags: string[]
  supportingEvidenceRefs: string[]
  supportingObservationRefs: string[]
  supportingSourceProofRefs: string[]
  verifiedByEvidenceKinds: string[]
  confidenceSource: string
```

Child 禁止返回 final ability result。

---

## 12. Result Model

`PostActionVerificationAbilityResult`：

```yaml
status: success | failed | review_required
abilityGroupId: post-action-verification
childCapabilityId: required
missionId: required
runId: required
sessionId: required
roundId: optional
videoVisitId: optional
stepId: required
activationSnapshotRef: required
capabilityCallId: required
actionProofRef: required
expectedOutcome: required
output: required-if-success
verificationDecision: verified | failed | review_required
failureReason: required-if-failed
reviewRequiredReason: required-if-review_required
diagnosticPayloadRef: required-if-not-success
runtimeProof: required
dataQualityFlags: string[]
```

Success output：

```yaml
output:
  observedOutcome: required
  verificationDecision: verified
  confidence: required
  evidenceRefs: list
  observationRefs: list
  supportingSourceProofRefs: list
  actionResultVerifiedRef: required
  confidenceSource: required
  verifiedByEvidenceKinds: list
```

---

## 13. Runtime Proof

`PostActionRuntimeProof` 必须保存真实上游链路：

```yaml
PostActionRuntimeProof:
  proofId: required
  missionId: required
  runId: required
  sessionId: required
  roundId: optional
  videoVisitId: optional
  stepId: required
  mapPackageId: required
  mapPackageVersion: required
  selectedMapId: required
  selectedMapVersion: required
  activationSnapshotRef: required
  capabilityCallId: required
  nerveBusEnvelopeId: required
  abilityGroupId: post-action-verification
  childCapabilityId: required
  actionProofRef: required
  actionLogRef: optional
  actionRecordRef: optional
  sourceActionRuntimeProofRef: required
  sourceActionResultRef: optional
  sourceActionOutputRef: optional
  sourceActionAbilityGroupId: required
  sourceActionChildCapabilityId: required
  actionType: required
  actionStatus: required
  expectedOutcomeType: required
  beforeEvidenceRefs: list
  afterEvidenceRefs: list
  observationRefs: list
  evidenceSourceRefs: list
  inputRef: required
  outputRef: required-if-success
  diagnosticPayloadRef: required-if-not-success
  inputPayloadHash: required
  actionProofHash: required
  expectedOutcomeHash: required
  observationSetHash: required
  startedAt: required
  endedAt: required
  durationMs: required
  status: required
  verificationDecision: required
  confidence: required
  failureReason: optional
  reviewRequiredReason: optional
  gateDecisions: required
  verificationDecisionTrace: list
  dataQualityFlags: list
```

禁止：

```txt
runId from proofFingerprint only
missionId from sessionId
missing activationSnapshotRef
missing capabilityCallId
runtimeProof:null
```

---

## 14. Output Boundary

Success 不允许：

```txt
critical data quality flags
missing supporting source proof
missing evidence when required
missing observation when required
self-reported-only support
low confidence
contradictory before/after
```

Failure / review 必须：

```txt
output=null
diagnosticPayloadRef exists
reason exists
runtimeProof exists
```

---

## 15. 与其它能力组边界

### Open / Mouse Click / Mouse Scroll / Text Input

只执行动作。  
不得产出 verified。  
必须产出 action proof / action log ref 给 PAV。

### Page State

只回答当前状态。  
不得回答“动作是否成功”。

### Screenshot / Visual Target / AI

只提供观察。  
不得替 PAV 产出 final verificationDecision。

### Orchestration

只调用 PAV 并消费结果。  
不得伪造 PAV result。

### Forensics

只持久化 PAV result/ref。  
不得做 verification logic。

---

## 16. 执法系统

必须存在：

```txt
scripts/audit/domains/post-action-verification-capability/manifest.json
scripts/audit/domains/post-action-verification-capability/inspector.ts
scripts/audit/domains/post-action-verification-capability/run-inspector.ts
scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts
```

Inspector 必须：

```txt
ts-morph
AST-level
symbol-level
import graph-level
schema-level
anti-escape
generated artifact aware
runner-connected
negative-proof-backed
```

禁止：

```txt
regex final judgment
grep final judgment
includes final judgment
manual-only proof
warning-only P0
detached inspector
empty negative proof
```

---

## 17. Inspector 必查

```txt
1. Law file is machine-blocking.
2. Ability group is thin.
3. Contract does not expose runtime context.
4. Child registry/schema/folder parity.
5. PAV root has no forbidden owner imports.
6. External code cannot import runtime/** or children/**.
7. Input schema includes missionId/runId/stepId/capabilityCallId/activationSnapshotRef/nerveBusEnvelopeId.
8. Action proof requires actionLogRef or actionRecordRef.
9. selfReportedOnly cannot verify.
10. verified output requires supportingSourceProofRefs.
11. required before/after evidence is enforced.
12. runtimeProof contains chain fields.
13. no fabricated runId/missionId.
14. result/proof/input chain parity.
15. child cannot build final result/proof.
16. action abilities cannot return verificationDecision.
17. page-state cannot claim verification truth.
18. negative proof executed.
19. ALL active laws in registry/matrix/audit-plan/runner.
```

---

## 18. Negative Proof 最低清单

必须 fail → rollback → pass：

```txt
manual-first enforcement reintroduced
remove capabilityCallId from input
remove activationSnapshotRef from input
remove nerveBusEnvelopeId from input
selfReportedOnly returns verified
missing actionLogRef returns verified
verified with no supportingSourceProofRefs
verified with missing afterEvidence when required
success with review_required decision
success with critical data quality flags
runtimeProof:null
runId built from proofFingerprint
missionId built from sessionId
child imports screenshot implementation
child builds final result
external imports runtime private path
page-state returns verificationDecision
mouse-click returns verified
remove negative proof invocation
turn P0 into warning-only
```

---

## 19. READY 标准

PAV READY 仅当：

```txt
PAV 法案 / 施工图 / inspector / generated / runner 口径一致
ALL active law enforcement PASS
CI-FULL PASS
PAV public contract 原生化
input/action/evidence/proof 链路字段完整
verified result 有证据和 source proof 支撑
动作成功不等于 verified
page-state 不等于 verification
runtimeProof 不伪造 runId/missionId
children 只返回 assessment
negative proof PASS
```

---

## 20. 漂移信号

```txt
Open/Click/Scroll/TextInput 直接返回 verified
PageState 被当作动作结果验证
PAV child 直接调用截图/AI/动作实现
PAV proof 缺 activationSnapshotRef
PAV proof 用 proofFingerprint 伪造 runId
verified result 无 sourceProofRefs
failed result 仍有 output
verify 脚本成为验收链
```

---

## 21. 最终原则

```txt
动作不是结果。
状态不是验证。
观察不是裁决。
PAV 只做动作后验证。
没有链路证明，不算 verified。
```
