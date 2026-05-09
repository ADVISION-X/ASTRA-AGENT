# GrassEye Visual Target 视觉目标定位能力组施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-VISUAL-TARGET-BLUEPRINT-FINAL
owner: visual-target-capability
documentType: construction-blueprint
lawAuthority: module-visual-target-capability.instructions.md
architecturePhase: Static Capability Package Architecture
status: active
replace:
  - docs/法案辅助文件/GrassEye Visual Target 视觉目标定位能力组施工图.md
mustNotCreate:
  - new lawId
  - new ability group
  - visual-action owner
  - platform target owner
  - AI target owner
  - geometry target owner
  - click target owner
```

本施工图是 `module-visual-target-capability.instructions.md` 的建设级落地映射。
本施工图不新增 lawId，不修改冻结法案，不重新分配主权。
若本文档与 Visual Target 法案冲突，以 Visual Target 法案为最高权威。

---

## 1. 定位

Visual Target Ability Group 是视觉目标定位与目标结果标准化能力组。

它负责：

```txt
接收 screenshot evidence refs
接收 AI / observation target candidates
校验 source proof
校验 candidate source
校验 coordinate space
选择最合适候选
处理歧义
标准化 bbox / clickPoint / metric / region
生成 non-executable Geometry Guard handoff
返回 VisualTargetResult + runtimeProof
```

它不负责：

```txt
截图
AI 推理
视觉模型执行
点击
滚动
文本输入
打开页面
DOM/BOM 查询
Geometry Guard 可执行校验
动作后验证
证据最终落盘
地图分支
产品视频判断
评论采集
```

一句话：

```txt
Visual Target 负责“我看见的目标在哪里”，不负责“能不能点”和“点了是否成功”。
```

---

## 2. 故事链路位置

```txt
Screenshot / AI / Page State
→ governed candidates + source proof
→ Visual Target
→ normalized target + Geometry Guard handoff
→ Geometry Guard
→ Mouse Click
→ Post-action Verification
→ Forensics
```

边界关系：

```txt
Screenshot 是“图像证据来源”
AI 是“候选建议来源”
Visual Target 是“候选标准化与目标选择”
Geometry Guard 是“坐标可执行安全校验”
Mouse Click 是“执行点击”
PAV 是“验证点击结果”
```

这些不能混。

## 2.1 Joint Result Contract

VisualTargetResult.output.geometryGuardHandoff 是 Visual Target 面向 Geometry Guard 的唯一标准非执行交接面。

它必须包含：

```txt
sourceVisualTargetResultRef
sourceTargetRef
sourceScreenshotEvidenceRef
sourceAiResultRef
sourcePageStateProofRef
bbox
clickPoint
coordinateSpace
targetType
targetNature
confidence
dataQualityFlags
```

Visual Target 只负责产出这个 non-executable handoff，不负责宣称 safeToClick、canClick、clickAllowed、executionAllowed 或 geometryVerified。

---

## 3. 标准包结构

```txt
src/capabilities/visual-target/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── ports/
│   ├── visual-target-clock-port.ts
│   └── visual-target-profile-port.ts
├── shared/
│   ├── visual-target-candidate.ts
│   ├── visual-target-failure.ts
│   ├── visual-target-geometry-handoff.ts
│   ├── visual-target-policy.ts
│   ├── visual-target-profile.ts
│   ├── visual-target-proof.ts
│   ├── visual-target-result.ts
│   └── visual-target-types.ts
├── runtime/
│   ├── ai-result-proof-gate.ts
│   ├── ai-result-proof-gate-binding.ts
│   ├── ai-result-proof-gate-support.ts
│   ├── ambiguity-gate.ts
│   ├── candidate-source-gate.ts
│   ├── coordinate-space-gate.ts
│   ├── page-state-consistency-gate.ts
│   ├── screenshot-proof-gate.ts
│   ├── target-selection-gate.ts
│   ├── target-type-policy-gate.ts
│   ├── visual-target-executor.ts
│   ├── visual-target-execution-gates.ts
│   ├── visual-target-execution-stage-runners.ts
│   ├── visual-target-input-gate.ts
│   ├── visual-target-output-boundary-gate.ts
│   ├── visual-target-payload-budget-gate.ts
│   ├── visual-target-proof-builder.ts
│   └── visual-target-result-builder.ts
└── children/
    ├── detect-comments-button/
    ├── detect-not-interested-button/
    ├── detect-next-video-region/
    ├── detect-like-button/
    ├── detect-save-button/
    ├── detect-comments-panel/
    ├── detect-close-comments-button/
    ├── detect-metric-like-count/
    └── detect-metric-comment-count/
```

---

## 4. Public Contract

Public interface 只允许：

```ts
interface VisualTargetAbilityGroup {
  listChildCapabilityIds(): VisualTargetChildCapabilityId[];
  execute(input: VisualTargetAbilityInput): Promise<VisualTargetAbilityResult>;
}
```

允许 public exports：

```txt
createVisualTargetAbilityGroup
VISUAL_TARGET_ABILITY_GROUP_ID
VisualTargetAbilityInput
VisualTargetAbilityResult
VisualTargetRuntimeProof
VisualTargetType
VisualTargetCandidate
VisualTargetBbox
VisualTargetClickPoint
VisualTargetCoordinateSpace
VisualTargetFailureReason
VisualTarget schemas
```

禁止 public exports：

```txt
child implementation
runtime executor internals
Geometry Guard implementation
Mouse Click implementation
Screenshot implementation
AI implementation
BrowserController
DOM/BOM helper
```

---

## 5. Input Model

`VisualTargetAbilityInput` 必须包含：

```yaml
VisualTargetAbilityInput:
  abilityGroupId: visual-target
  childCapabilityId: required
  requestedBy: orchestration | post-action-verification | commander-read-model
  sourceAbilityGroupId: required
  sourceChildCapabilityId: optional
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
  inputRef: required
  idempotencyKey: required
  targetType: required
  targetNature: action | region | metric
  sourceProof: required
  candidates: list
  confidencePolicy: required
  selectionPolicy: required
  ambiguityPolicy: required
  coordinatePolicy: required
  dataQualityPolicy: required
```

缺失以下字段不得 success：

```txt
stepId
capabilityCallId
activationSnapshotRef
nerveBusEnvelopeId
mapPackageVersion
selectedMapVersion
sourceProof
sourceProof.screenshot.screenshotProofRef
sourceProof.screenshot.screenshotEvidenceId
inputRef
idempotencyKey
```

---

## 6. Source Proof

`VisualTargetSourceProof` 必须包含：

```yaml
sourceProof:
  sourceProofRef: required
  screenshot:
    screenshotEvidenceId: required
    artifactRef: required
    screenshotProofRef: required
    artifactHash: required
    imageHash: required
    imageWidth: required
    imageHeight: required
    coordinateSpace: required
  ai:
    aiResultRef: required-if-ai-source
    aiProofRef: required-if-ai-source
    promptContractId: required-if-ai-source
    promptCatalogVersion: required-if-ai-source
    aiInputArtifactRef: required-if-ai-source
    aiInputHash: required-if-ai-source
  pageState:
    pageStateProofRef: required
    pageStateFingerprint: required
    currentUrl: optional
    observedAt: required
  operatorApproval:
    operatorApprovalRef: optional
```

---

## 7. Candidate Model

`VisualTargetCandidate` 必须包含：

```yaml
candidate:
  candidateRef: required
  candidateKind: required
  targetType: required
  boundingBox: required
  clickPoint: nullable
  confidence: 0..1
  coordinateSpace: required
  sourceProofRef: required
  capturedAt: required
  sourceFrameRef: optional
  detectionMethod: required
  visibleText: optional
  uncertainty: list
  blockedReason: optional
  isVisible: boolean
  scaleMapping: required-if-coordinate-derived
  dataQualityFlags: list
```

规则：

```txt
AI-sourced candidate 必须有 aiProofRef。
contact_sheet candidate 不能产生 action success。
ai_input candidate 不能直接成为 executable coordinate。
invisible candidate 不能 success。
blocked candidate 不能 success。
stale candidate 不能 success。
sourceProofRef mismatch 不能 success。
```

---

## 8. Runtime Pipeline

Visual Target executor 必须固定：

```txt
input schema gate
→ child registry gate
→ payload budget gate
→ screenshot proof gate
→ AI result proof gate
→ page-state consistency gate
→ candidate source gate
→ candidate source binding gate
→ target type policy gate
→ coordinate space gate
→ target selection gate
→ ambiguity gate
→ output boundary gate
→ proof builder
→ result builder
```

禁止：

```txt
child direct final result
child direct proof
executor skipping screenshot proof
executor skipping AI proof for AI candidates
executor skipping coordinate-space gate
executor skipping ambiguity gate
success without proof
```

---

## 9. Coordinate Space

Allowed coordinate spaces：

```txt
screenshot_original
region_crop
ai_input
contact_sheet
optimized_equivalent
viewport_projected
```

规则：

```txt
contact_sheet 永不可执行。
ai_input 永不可直接执行。
action success 不得使用 ai_input/contact_sheet 作为 coordinateSpace。
ai_input → screenshot_original 必须有 scaleMapping。
region_crop → screenshot_original 必须保留 crop offset / scale mapping。
Visual Target 不决定 safeToClick。
Visual Target 只生成 Geometry Guard handoff。
```

Action target success 必须：

```txt
notExecutableUntilGeometryGuard = true
geometryGuardHandoffRequired = true
geometryGuardHandoffRef exists
geometryGuardHandoff exists
executionBoundary = visual-target-to-geometry-guard
```

禁止字段：

```txt
safeToClick
canClick
clickAllowed
executionAllowed
geometryVerified
```

---

## 10. Result Model

`VisualTargetAbilityResult` 必须包含：

```yaml
status: success | failed | review_required
abilityGroupId: visual-target
childCapabilityId: required
targetNature: action | region | metric
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
targetType: required
output: required-if-success
failureReason: required-if-failed
reviewRequiredReason: required-if-review_required
diagnosticPayloadRef: required-if-not-success
debugLogRef: required
dataQualityFlags: list
runtimeProof: required
```

Success：

```txt
output exists
outputRef exists
runtimeProof exists
critical data quality flags absent
selectionDecision = selected
ambiguityDecision = clear
```

Failure / review_required：

```txt
output = null
diagnosticPayloadRef exists
reason exists
runtimeProof exists
```

---

## 11. Output Model

Action output：

```yaml
output:
  targetNature: action
  targetId: required
  sourceCandidateRef: required
  sourceScreenshotEvidenceId: required
  sourceScreenshotProofRef: required
  sourceAiResultRef: required-if-ai-source
  sourceAiProofRef: required-if-ai-source
  sourcePageStateProofRef: required
  coordinateSpace: not ai_input/contact_sheet
  originalCandidateCoordinateSpace: required
  boundingBox: required
  candidateClickPoint: required
  clickPoint: required
  confidence: required
  notExecutableUntilGeometryGuard: true
  geometryGuardHandoffRequired: true
  geometryGuardHandoffRef: required
  geometryGuardHandoff: required
```

Region output：

```txt
targetNature = region
bbox required
geometry handoff may be required by policy
not action executable truth
```

Metric output：

```txt
targetNature = metric
parsedValue or metricValue required
clickPoint optional only if source candidate supplied it
not action executable truth
```

---

## 12. owner evidence

`VisualTargetRuntimeProof` 必须包含：

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
abilityGroupId: visual-target
childCapabilityId: required
sourceAbilityGroupId: required
sourceChildCapabilityId: optional
inputRef: required
outputRef: required-if-success
diagnosticPayloadRef: required-if-not-success
debugLogRef: required
structuredRuntimeEventRef: required
inputPayloadHash: required
screenshotEvidenceId: required
screenshotProofRef: required
screenshotHash: required
aiResultRef: optional
aiProofRef: optional
aiInputHash: optional
aiOutputPayloadHash: optional
pageStateProofRef: required
pageStateHash: required
selectedTargetType: required
candidateCount: number
candidateSetHash: required
rejectedCandidateRefs: list
candidateScoreTrace: list
selectionTrace: list
ambiguityTrace: list
coordinateTransformTrace: list
selectedCandidateRef: required-if-success
selectedCandidateHash: required-if-success
coordinateSpace: required-if-success
boundingBox: required-if-success
clickPoint: optional
geometryGuardHandoffRef: required-if-action-success
notExecutableUntilGeometryGuard: boolean
geometryGuardHandoffRequired: boolean
startedAt: required
endedAt: required
durationMs: required
status: required
failureReason: optional
reviewRequiredReason: optional
payloadBudgetDecision: required
screenshotDecision: required
aiDecision: required
pageStateDecision: required
candidateSourceDecision: required
candidateSourceBindingDecision: required
coordinateSpaceDecision: required
targetTypeDecision: required
selectionDecision: required
ambiguityDecision: required
outputBoundaryDecision: required
criticalDataQualityDecision: required
dataQualityFlags: list
geometryGuardHandoffPolicy: geometry-guard-public-contract-only
nonExecutableCoordinatePolicy: not-executable-until-geometry-guard
clock: required
receivedShapeHash: required-if-invalid-input
```

禁止：

```txt
runtimeProof:null
runId from sessionId/child
missionId=sessionId
missing activationSnapshotRef
success proof without outputRef
failed proof with outputRef
```

---

## 13. Child Capabilities

| child | targetNature | 目标 |
|---|---|---|
| detect-comments-button | action | 评论按钮 |
| detect-not-interested-button | action | 不感兴趣按钮 |
| detect-next-video-region | region | 下一条视频区域 |
| detect-like-button | action | 点赞按钮 |
| detect-save-button | action | 收藏按钮 |
| detect-comments-panel | region | 评论面板 |
| detect-close-comments-button | action | 关闭评论按钮 |
| detect-metric-like-count | metric | 点赞数 |
| detect-metric-comment-count | metric | 评论数 |

每个 child 必须：

```txt
have contract/schema/implementation
call unified Visual Target executor
bind target type/profile
not import sibling implementation
not import screenshot/AI/Geometry/Mouse/PAV/Forensics
not query DOM/BOM
not return boolean
not hardcode platform coordinates as final truth
```

---

## 14. 与其它能力组边界

### Screenshot

提供 screenshot evidence。
不决定 target truth。

### AI

提供 candidate / sourceAiResultRef。
不决定 governed VisualTargetResult。

### Page State

提供 current state proof。
不决定 target coordinates。

### Geometry Guard

校验 Visual Target handoff 是否可执行。
Visual Target 不决定 safeToClick。

### Mouse Click

执行 Geometry Guard 允许后的坐标。
不得直接消费 raw AI bbox。

### PAV

验证点击后结果。
不得替 Visual Target 选目标。

---

## 15. 执法系统

必须存在：

```txt
scripts/audit/domains/visual-target-capability/manifest.json
scripts/audit/domains/visual-target-capability/inspector.ts
scripts/audit/domains/visual-target-capability/run-inspector.ts
scripts/audit/domains/visual-target-capability/owner-inspection-harness.ts
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
real-code-inspection-backed
```

禁止：

```txt
regex final judgment
grep final judgment
includes final judgment
manual-only proof
warning-only P0
detached inspector
empty/missing real-code-inspection
verify script as release truth
```

---

## 16. Inspector 必查

```txt
1. Law file is machine-blocking.
2. Public contract is target-normalization only.
3. Input schema includes full chain fields.
4. Source proof includes screenshot/AI/page-state proof refs.
5. Candidate source proof binding gate invoked.
6. Screenshot proof gate invoked.
7. AI proof gate invoked when AI candidates exist.
8. Page-state consistency gate invoked.
9. Coordinate-space gate invoked.
10. Target selection and ambiguity gates invoked.
11. Output boundary blocks executable/geometry/PAV truth.
12. Action success requires Geometry Guard handoff.
13. Result/proof/input chain parity.
14. Children use unified runtime.
15. No forbidden imports/symbols/DOM/BOM.
16. No second visual target owner in platform/runtime/AI/click/scroll.
17. ALL active laws in registry/matrix/audit-plan/runner.
18. owner-inspection-harness executed.
```

---

## 17. real-code-inspection 最低清单

必须 fail → re-inspect → pass：

```txt
manual-first enforcement reintroduced
remove capabilityCallId from input
remove activationSnapshotRef from input
remove nerveBusEnvelopeId from input
AI candidate without aiProofRef returns success
candidate without sourceProofRef returns success
coordinateSpace ai_input action success
coordinateSpace contact_sheet action success
geometryGuardHandoffRequired false on action success
result adds safeToClick
critical data quality returns success
ambiguous candidates return success
proof runId from sessionId/child
proof missing activationSnapshotRef
child imports screenshot implementation
child imports Geometry Guard implementation
child returns boolean
external import of child implementation
platform adapter computes target coordinates
mouse-click computes target bbox directly
remove real-code-inspection invocation
turn P0 into warning-only
```

---

## 18. READY 标准

Visual Target READY 仅当：

```txt
Visual Target 法案 / 施工图 / inspector / generated / runner 口径一致
ALL active law enforcement PASS
CI-FULL PASS
input chain fields complete
source proof/candidate proof binding complete
coordinate-space policy blocks ai_input/contact_sheet executable truth
action success always requires Geometry Guard handoff
target selection and ambiguity gates fail closed
result/proof/input chain parity passes
children are narrow target bindings
real-code-inspection PASS
```

---

## 19. 漂移信号

```txt
AI output is treated as final clickable target
Mouse Click consumes raw bbox/clickPoint
Visual Target result exposes safeToClick
Visual Target proof lacks activationSnapshotRef
candidate has no sourceProofRef
action success lacks Geometry Guard handoff
child hardcodes platform coordinates
platform adapter computes target coordinates
verify script becomes release gate
```

---

## 20. 最终原则

```txt
Screenshot 是“我看见的图”。
AI 是“我猜哪里可能是目标”。
Visual Target 是“我把候选标准化成目标”。
Geometry Guard 是“这个坐标能不能安全执行”。
Mouse Click 是“我去点”。
PAV 是“点完是否成功”。
这些不能混。
```
