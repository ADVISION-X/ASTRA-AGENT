-
# GrassEye Page State 页面状态感知能力组施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-PAGE-STATE-BLUEPRINT-FINAL
owner: page-state-capability
documentType: construction-blueprint
lawAuthority: module-page-state-capability.instructions.md
architecturePhase: Static Capability Package Architecture
status: active
replace:
  - docs/法案辅助文件/GrassEye Page State 页面状态感知能力组施工图.md
mustNotCreate:
  - new lawId
  - new ability group
  - open page-state owner
  - platform page-state owner
  - PAV page-state owner
  - browser/runtime state owner
````

本施工图是 `module-page-state-capability.instructions.md` 的建设级落地映射。
本施工图不新增 lawId，不修改冻结法案，不重新分配主权。
若本文档与 Page State 法案冲突，以 Page State 法案为最高权威。

---

## 1. 定位

Page State 是当前页面状态感知能力组。

它负责回答：

```txt
当前页面此刻处于什么状态？
```

它不回答：

```txt
刚才动作是否成功？
下一步怎么走？
这个产品是否值得研究？
是否应该点击？
证据是否最终落盘？
```

一句话：

```txt
Page State 是当前状态，不是动作结果验证。
```

---

## 2. 故事链路位置

```txt
Open / Screenshot / Visual Target / Runtime Signal / PAV observation
→ governed snapshot + observations + evidence refs
→ Page State
→ current-page state classification
→ Orchestration / PAV / Commander / Forensics consume result
```

Page State 可给 PAV 提供“现在页面状态”的观察。
PAV 再判断“动作是否达成预期”。
二者不能互相替代。

---

## 3. 标准包结构

```txt
src/capabilities/page-state/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── ports/
│   ├── page-state-clock-port.ts
│   └── page-state-profile-port.ts
├── shared/
│   ├── page-state-types.ts
│   ├── page-state-policy.ts
│   ├── page-state-result.ts
│   ├── page-state-proof.ts
│   ├── page-state-failure.ts
│   ├── page-state-observation.ts
│   └── page-state-profile.ts
├── runtime/
│   ├── page-state-executor.ts
│   ├── page-state-preflight.ts
│   ├── page-state-input-gate.ts
│   ├── page-state-payload-budget-gate.ts
│   ├── observation-source-gate.ts
│   ├── observation-proof-binding-gate.ts
│   ├── snapshot-freshness-gate.ts
│   ├── platform-profile-gate.ts
│   ├── state-classification-gate.ts
│   ├── proceed-decision-gate.ts
│   ├── page-state-output-boundary-gate.ts
│   ├── page-state-proof-builder.ts
│   ├── page-state-result-builder.ts
│   ├── page-state-success-result.ts
│   └── page-state-dispatch-failure.ts
└── children/
    ├── detect-login-state/
    ├── detect-safety-page/
    ├── detect-feed-ready/
    ├── detect-video-stable/
    ├── detect-comment-panel-state/
    ├── detect-modal-overlay-state/
    ├── detect-page-abnormality/
    └── detect-platform-page-kind/
```

---

## 4. Public Contract

Public interface 只允许：

```ts
interface PageStateAbilityGroup {
  listChildCapabilityIds(): PageStateChildCapabilityId[];
  execute(input: PageStateAbilityInput): Promise<PageStateAbilityResult>;
}
```

Public exports 允许：

```txt
createPageStateAbilityGroup
PAGE_STATE_ABILITY_GROUP_ID
PageStateAbilityInputSchema
PageStateAbilityResultSchema
PageStateRuntimeProofSchema
PageStateChildCapabilityIdSchema
PageState public types
```

禁止 public exports：

```txt
child implementation
runtime executor internals
PageStateChildCapability interface on public contract
browser/session raw implementation
foreign ability implementation
```

---

## 5. Input Model

`PageStateAbilityInput` 必须包含：

```yaml
PageStateAbilityInput:
  abilityGroupId: page-state
  childCapabilityId: required
  requestedBy: orchestration | post-action-verification | commander-read-model
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
  snapshot: required
  observations: list
  sourceEvidenceRefs: non-empty
  freshnessPolicy: required
  confidencePolicy: required
  statePolicy: required
  openHandoff: required
  previousPageStateFingerprint: optional
  inputRef: required
  idempotencyKey: required
```

缺失以下字段不得 success：

```txt
currentUrl
snapshot.sourceProofRef
openHandoff.openProofRef
stepId
capabilityCallId
activationSnapshotRef
nerveBusEnvelopeId
sourceEvidenceRefs
```

---

## 6. Snapshot

`PageStateSnapshot`：

```yaml
snapshot:
  snapshotId: required
  currentUrl: required-url
  currentTitle: string
  browserLoginState: required
  viewport: required
  scrollOffset: required
  capturedAt: required
  sourceAbilityGroupId: open | screenshot | runtime-signal
  sourceChildCapabilityId: required
  sourceProofRef: required
```

Snapshot 只是一份当前页面快照。
Snapshot 不等于动作成功证明。

---

## 7. Observation

Allowed sourceAbilityGroupId：

```txt
open
screenshot
visual-target
post-action-verification
runtime-signal
```

Observation 必须有：

```yaml
observation:
  observationId: required
  kind: runtime_signal | page_marker | visual_target | platform_capture | post_action_verification
  capturedAt: required
  sourceAbilityGroupId: required
  sourceChildCapabilityId: required
  sourceProofRef: required
  payload: strict-by-kind
```

禁止：

```txt
AI observation unless law explicitly adds it
action completion observation as truth
observation without proof
stale observation success
```

---

## 8. Runtime Pipeline

Page State executor 必须固定：

```txt
input schema gate
→ child registry gate
→ payload budget gate
→ observation source gate
→ observation proof binding gate
→ snapshot freshness gate
→ platform profile gate
→ child classification
→ proceed decision gate
→ output boundary gate
→ proof builder
→ result builder
```

禁止：

```txt
child direct final result
child direct proof
executor skipping observation proof binding
executor skipping output boundary
success without proof
```

---

## 9. Child Capabilities

| child                      | 职责               | 必须根据                                          | 禁止                   |
| -------------------------- | ---------------- | --------------------------------------------- | -------------------- |
| detect-login-state         | 判断当前登录状态         | snapshot.browserLoginState / page markers     | 执行登录                 |
| detect-safety-page         | 判断安全页/captcha    | page_marker / platform_capture                | 绕过安全页                |
| detect-feed-ready          | 判断 feed 是否 ready | feed markers / platform profile / URL profile | hardcode TikTok path |
| detect-video-stable        | 判断视频是否稳定         | runtime_signal / visual_target                | 滚动/截图                |
| detect-comment-panel-state | 判断评论面板开闭         | runtime_signal / visual_target                | 点击评论                 |
| detect-modal-overlay-state | 判断 modal overlay | runtime_signal / page_marker                  | 关闭 modal             |
| detect-page-abnormality    | 判断异常页            | page_marker / runtime_signal                  | 决定修复                 |
| detect-platform-page-kind  | 判断平台页面类型         | platform profile / URL profile                | URL includes hack    |

Child 只能返回：

```txt
PageStateChildDetection
```

不能返回 final `PageStateAbilityResult`。
不能 build `PageStateRuntimeProof`。

---

## 10. Output Model

`PageStateAbilityResult` 必须包含：

```yaml
status: success | failed | review_required
decision: proceed | block | review_required | fail
abilityGroupId: page-state
childCapabilityId: required
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
output: required-if-success
pageStateType: required-if-success
stateSummary: required-if-success
confidence: required-if-success
evidenceRefs: list
observationRefs: list
sourceEvidenceRefs: list
pageStateFingerprint: required-if-success
previousPageStateFingerprint: optional
failureReason: required-if-failed
reviewRequiredReason: required-if-review_required
diagnosticPayloadRef: required-if-not-success
runtimeProof: required
dataQualityFlags: list
```

禁止字段：

```txt
verificationDecision
verified
actionResultVerifiedRef
postActionVerificationRef as final action proof
```

---

## 11. Runtime Proof

`PageStateRuntimeProof` 必须包含：

```yaml
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
abilityGroupId: page-state
childCapabilityId: required
inputRef: required
outputRef: required-if-success
diagnosticPayloadRef: required-if-not-success
debugLogRef: required
snapshotId: required
snapshotProofRef: required
openHandoffProofRef: required
browserSessionRef: required
platformProfileId: required
resolvedPlatformProfileId: optional
matchedHost: optional
sourceAbilityGroupId: required
sourceChildCapabilityId: required
observationRefs: list
sourceEvidenceRefs: list
inputPayloadHash: required
snapshotHash: required
observationHash: required
pageStateFingerprint: required-if-success
previousPageStateFingerprint: optional
currentUrl: required
currentTitle: optional
classificationSource: child_capability | invalid_input_failure
inputDecision: allow | fail
payloadBudgetDecision: allow | review_required | fail
sourceBindingDecision: allow | review_required | fail
observationBindingDecision: bound | review_required | fail
freshnessDecision: fresh | review_required | fail
platformDecision: match | review_required | block | fail
classificationDecision: proceed | review_required | block | fail
outputBoundaryDecision: allow | review_required | fail
criticalDataQualityDecision: allow | review_required | fail
proceedDecision: proceed | block | review_required | fail
startedAt: required
endedAt: required
durationMs: required
status: required
decision: required
failureReason: optional
reviewRequiredReason: optional
dataQualityFlags: list
receivedShapeHash: required-if-invalid-input
```

---

## 12. Output Boundary

Success 不允许：

```txt
critical data quality flags
missing evidenceRefs/sourceEvidenceRefs
missing observationRefs when child requires observation
missing source proof
low confidence
stale snapshot
stale observation
source mismatch
platform mismatch
outputBoundaryViolation
```

Failed / review_required 必须：

```txt
output = null
diagnosticPayloadRef exists
reason exists
runtimeProof exists
```

---

## 13. 与其它能力组边界

### Open

Open 提供 open proof / browser session / snapshot source。
Open 不拥有 feed_ready/login_wall/safety_wall truth。

### Screenshot / Visual Target

只提供观察。
不得直接宣告 Page State 最终结论。

### PAV

PAV 判断动作结果。
Page State 判断当前页面状态。
PAV 可消费 Page State；Page State 不替 PAV 判断动作是否成功。

### AI

AI 不拥有当前页面状态真相。
AI observation 若未来加入，必须单独法案扩展。

### Orchestration

Orchestration 只调用 Page State 并消费结果。
不得在 runtime/adapter 内复写 page-state truth。

---

## 14. 执法系统

必须存在：

```txt
scripts/audit/domains/page-state-capability/manifest.json
scripts/audit/domains/page-state-capability/inspector.ts
scripts/audit/domains/page-state-capability/run-inspector.ts
scripts/audit/domains/page-state-capability/negative-proof-harness.ts
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
verify script as release truth
```

---

## 15. Inspector 必查

```txt
1. Law file is machine-blocking.
2. Public contract current-state only.
3. Input schema includes full chain fields.
4. Snapshot has sourceProofRef.
5. Open handoff has openProofRef.
6. Observations have sourceProofRef.
7. Observation source allowlist enforced.
8. Freshness gate invoked.
9. Payload budget gate invoked.
10. Observation proof binding gate invoked.
11. Platform profile gate invoked.
12. Output boundary gate invoked.
13. Result/proof/input chain parity.
14. Runtime proof has gate decisions and no fabricated ids.
15. No verificationDecision/action-result fields.
16. Child registry/folder/schema parity.
17. Child cannot build final result/proof.
18. No forbidden imports.
19. No verify scripts/capability-check.
20. ALL active laws in registry/matrix/audit-plan/runner.
21. negative proof executed.
```

---

## 16. Negative Proof 最低清单

必须 fail → rollback → pass：

```txt
manual-first enforcement reintroduced
remove capabilityCallId from input
remove activationSnapshotRef from input
remove nerveBusEnvelopeId from input
remove snapshot.sourceProofRef
observation without sourceProofRef
forbidden observation owner returns success
stale snapshot returns success
success without evidenceRefs
success with low_confidence flag
result adds verificationDecision
failed result with output
proof runId from fingerprint
proof missing activationSnapshotRef
child imports screenshot implementation
child returns boolean
child hardcodes TikTok feed path
external import of child implementation
add verify-page-state-capabilities.ts
turn P0 into warning-only
remove negative proof invocation
```

---

## 17. READY 标准

Page State READY 仅当：

```txt
Page State 法案 / 施工图 / inspector / generated / runner 口径一致
ALL active law enforcement PASS
CI-FULL PASS
input chain fields complete
snapshot/open handoff proof complete
observation source-bound and fresh
result evidence-backed
runtimeProof chain/gate decisions complete
no action-result verification truth
children narrow classifiers only
negative proof PASS
```

---

## 18. 漂移信号

```txt
Open helper declares login/feed/safety truth
Page State child calls screenshot/AI/action implementation
Page State proof lacks activationSnapshotRef
Page State result exposes verificationDecision
success has no evidenceRefs
child hardcodes TikTok path
verify script becomes release gate
```

---

## 19. 最终原则

```txt
Page State 是“现在是什么”。
PAV 是“动作是否成了”。
Open 是“我打开了”。
Screenshot/Visual Target 是“我看见了”。
Orchestration 是“下一步怎么走”。
这些不能混。
```

```
```
