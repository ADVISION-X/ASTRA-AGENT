# GrassEye Screenshot 能力组施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-SCREENSHOT-BLUEPRINT-FINAL
owner: screenshot-capability
documentType: construction-blueprint
lawAuthority: module-screenshot-capability.instructions.md
architecturePhase: Static Capability Package Architecture
status: active
replace:
  - docs/法案辅助文件/GrassEye Screenshot 能力组施工图.md
mustNotCreate:
  - new lawId
  - new ability group
  - screenshot-drawer owner
  - browser-helper screenshot owner
  - local-ai resize/crop owner
  - visual-target screenshot owner
  - geometry executable coordinate owner
```

本施工图是 `module-screenshot-capability.instructions.md` 的建设级落地映射。
本施工图不新增 lawId，不修改冻结法案，不重新分配主权。
若本文档与 Screenshot 法案冲突，以 Screenshot 法案为最高权威。

---

## 1. 定位

Screenshot Ability Group 是视觉输入与图像产物能力组。

它负责：

```txt
浏览器视口截图
桌面截图
区域截图
lossless 优化
AI 输入图准备
截图 artifact ref
图片 hash
coordinateSpace
scaleMapping
sourceScreenshotEvidenceId
截图 runtimeProof
```

它不负责：

```txt
AI 判断
OCR 语义
按钮坐标识别
Geometry Guard 可执行判断
点击/滚动/输入
Page State 当前状态分类
动作后验证
产品判断
评论采集
地图分支
Forensics 最终 evidence packet 构造
```

一句话：

```txt
Screenshot 是“我看见的图”，不是“图里是什么”和“能不能点”。
```

---

## 2. 故事链路位置

```txt
Open / Page State / Orchestration / PAV
→ Screenshot
→ screenshot artifact + coordinate proof
→ Visual Target / AI / Page State / PAV
→ Geometry Guard / Forensics
```

Screenshot 的结果是：

```txt
图像证据 + 坐标映射证明
```

不是：

```txt
目标坐标真相
动作成功真相
页面状态真相
产品判断真相
```

---

## 3. 标准包结构

```txt
src/capabilities/screenshot/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── ports/
│   ├── screenshot-artifact-port.ts
│   ├── screenshot-capture-port.ts
│   ├── screenshot-clock-port.ts
│   └── screenshot-image-processing-port.ts
├── adapters/
│   ├── browser-controller-screenshot-capture-port.ts
│   ├── filesystem-screenshot-artifact-port.ts
│   ├── sharp-screenshot-image-processing-port.ts
│   └── index.ts
├── shared/
│   ├── screenshot-artifact.ts
│   ├── screenshot-artifact-lifecycle-schema.ts
│   ├── screenshot-failure.ts
│   ├── screenshot-policy.ts
│   ├── screenshot-proof.ts
│   ├── screenshot-result.ts
│   ├── screenshot-scale-mapping.ts
│   └── screenshot-types.ts
├── runtime/
│   ├── screenshot-executor.ts
│   ├── screenshot-execution-flow.ts
│   ├── screenshot-input-gate.ts
│   ├── privacy-policy-gate.ts
│   ├── screenshot-source-gate.ts
│   ├── browser-session-gate.ts
│   ├── page-state-handoff-gate.ts
│   ├── region-proof-gate.ts
│   ├── screenshot-payload-budget-gate.ts
│   ├── open-timeout-policy or screenshot-timeout-policy.ts
│   ├── capture-runner.ts
│   ├── image-processing-runner.ts
│   ├── screenshot-artifact-lifecycle.ts
│   ├── artifact-storage-gate.ts
│   ├── screenshot-output-boundary-gate.ts
│   ├── screenshot-proof-builder.ts
│   ├── screenshot-result-builder.ts
│   └── screenshot-dispatch-failure.ts
└── children/
    ├── capture-browser-viewport/
    ├── capture-desktop-screen/
    ├── capture-region/
    ├── optimize-lossless/
    └── prepare-ai-input/
```

---

## 4. Public Contract

Public interface 只允许：

```ts
interface ScreenshotAbilityGroup {
  listChildCapabilityIds(): ScreenshotChildCapabilityId[];
  execute(input: ScreenshotAbilityInput): Promise<ScreenshotAbilityResult>;
}
```

允许 public exports：

```txt
createScreenshotAbilityGroup
SCREENSHOT_ABILITY_GROUP_ID
ScreenshotAbilityInput
ScreenshotAbilityResult
ScreenshotRuntimeProof
ScreenshotChildCapabilityId
ScreenshotArtifactRef
ScreenshotArtifactLifecycleManifest
ScreenshotRetentionClass
ScreenshotPromotionStatus
ScreenshotArtifactBudgetPolicy
ScreenshotArtifactBudgetSnapshot
ScreenshotScaleMapping
ScreenshotCoordinateSpace
ScreenshotImageKind
Screenshot schemas
Screenshot port types
```

禁止 public exports：

```txt
child implementation
runtime executor internals
BrowserController
AI implementation
Visual Target implementation
Geometry Guard implementation
Mouse Click implementation
Page State implementation
PAV implementation
Forensics writer
legacy screenshot drawer
```

---

## 5. Input Model

`ScreenshotAbilityInput` 必须包含：

```yaml
ScreenshotAbilityInput:
  abilityGroupId: screenshot
  childCapabilityId: required
  requestedBy: required
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
  purpose: required
  source: required
  sourceProof: required-if-transform-or-stored-image
  pageStateProof: required-when-browser-page-source-after-startup-bootstrap
  privacyPolicy: required
  capturePolicy: required
  inputRef: required
  idempotencyKey: required
  timeoutMs: required-or-capturePolicy.maxDurationMs
```

缺失以下字段不得 success：

```txt
stepId
capabilityCallId
activationSnapshotRef
nerveBusEnvelopeId
mapPackageVersion
selectedMapVersion
inputRef
idempotencyKey
timeout policy
```

### 5.1 Local Runtime Dispatch Adapter

正确链路：

```txt
Orchestration AbilityCommandEnvelope
-> src/lib/local-runtime/workbench-screenshot-dispatch-input.ts buildScreenshotCommonFields
-> ScreenshotAbilityInput
-> screenshot-input-gate
-> browser-session/page-state/source gates
```

`capture-browser-viewport` 的 local-runtime adapter 额外必须做到：

```txt
payload.targetUrl -> source.pageUrl
payload.targetTitle -> source.pageTitle
payload.pageStateRef -> pageStateProof.proofRef when startup bootstrap has already completed
payload.sourceEvidenceRef + allowFirstCaptureWithoutPageStateProof=true -> governed startup bootstrap capture support
envelope.sessionId/roundId/videoVisitId -> pageStateProof session chain when pageStateProof exists
envelope.createdAt -> pageStateProof.observedAt when pageStateProof exists
envelope.createdAt/expiresAt -> timeoutMs
```

错误链路：

```txt
envelope.missionId -> sessionId
envelope.stepId -> roundId
envelope.mapId -> runId
drop mapPackageVersion / selectedMapVersion / activationSnapshotRef / capabilityCallId / nerveBusEnvelopeId / inputRef / idempotencyKey / timeoutMs
startup bootstrap fabricates fake pageStateProof instead of using governed open support
capture-browser-viewport enters Screenshot without pageStateProof when payload.pageStateRef exists after startup bootstrap
```

---

## 6. Source Proof

Stored image / region / optimize / prepare-ai-input 必须有：

```yaml
ScreenshotSourceProof:
  proofRef: required
  sourceKind: required
  sourceStorageRef: required-or-sourceArtifactRef
  sourceArtifactRef: optional
  sourceScreenshotEvidenceId: required
  sourceHash: required
  coordinateSpace: required
  sourceWidth: required
  sourceHeight: required
  sessionId: required
  roundId: optional
  videoVisitId: optional
  stepId: required
  capabilityCallId: required
  activationSnapshotRef: required
  pageStateProofRef: optional
  browserSessionRef: optional
```

禁止：

```txt
transform success without sourceProof
sourceProof without sourceScreenshotEvidenceId
sourceProof without sourceHash
sourceProof without coordinateSpace
```

---

## 7. Image Kinds

Allowed image kinds：

```txt
evidence_original
evidence_optimized
ai_input
region_crop
contact_sheet
```

Rules：

```txt
evidence_original 保留原始 coordinateSpace。
evidence_optimized 必须保持与 source 等价的像素尺寸和 coordinateSpace。
ai_input 可以 crop/resize，但必须保留 scaleMapping。
region_crop 必须保留 sourceScreenshotEvidenceId + crop offsets。
contact_sheet 永远是非可执行 evidence representation。
```

---

## 8. Coordinate Space

Allowed coordinate spaces：

```txt
browser_viewport_pixels
desktop_screen_pixels
source_image_pixels
region_crop_pixels
ai_input_pixels
optimized_equivalent_pixels
contact_sheet_pixels
```

禁止：

```txt
ai_input_pixels 被当成可执行坐标
contact_sheet_pixels 被当成可执行坐标
lossless optimize 改变尺寸
crop/resize 不保留 scaleMapping
```

---

## 9. Scale Mapping

任何 crop / resize / AI input preparation 必须有：

```yaml
ScreenshotScaleMapping:
  sourceScreenshotEvidenceId: required
  sourceStorageRef: required
  sourceCoordinateSpace: required
  targetCoordinateSpace: required
  sourceWidth: required
  sourceHeight: required
  targetWidth: required
  targetHeight: required
  cropOffsetX: required
  cropOffsetY: required
  scaleX: required
  scaleY: required
```

`prepare-ai-input` success 必须有 `scaleMapping`。
`capture-region` success 必须有 `sourceScreenshotEvidenceId`。
`optimize-lossless` success 必须证明 source/output 尺寸一致。

---

## 10. Runtime Pipeline

Screenshot executor 必须固定：

```txt
input schema gate
→ child registry gate
→ privacy policy gate
→ source proof gate
→ browser session gate where capture-browser-viewport
→ page-state handoff/support gate where required
→ region proof gate where region/crop
→ payload budget gate
→ timeout/cancellation gate
→ capture runner or image-processing runner
→ scale-mapping gate
→ artifact storage gate
→ output boundary gate
→ proof builder
→ result builder
```

禁止：

```txt
child direct final result
child direct proof
capture without privacy gate
browser capture without browser session gate
image processing without source proof
success without artifact storage
success without proof
```

---

## 11. Timeout / Cancellation

Screenshot capture/processing 必须支持：

```txt
hard timeout
AbortSignal where port supports it
timeoutDecision
abortDecision
late success suppression
typed failed/review result
```

禁止：

```txt
Promise.race without proof
timeout later overwritten by success
timeout without runtimeProof
```

---

## 12. Artifact Storage

Success 必须有：

```txt
artifactRef
screenshotEvidenceId
storageRef
artifactLifecycleManifestRef
retentionClass
expiresAt
deleteAfter
artifactHash
byteSize
promotionStatus
cleanupEligible
outputHash
output width/height
imageKind
coordinateSpace
```

Artifact 生命周期治理：

```txt
截图文件默认不是永久证据，而是临时运行材料。
只有被 Forensics 正式提升为 evidence 的 artifact，才允许长期保留。
只有将来会作为选品证据图片交给 Forensics/evidence-store 的图片，才允许进入长期保留路径。
非证据链图片必须用完即物理删除；不得依赖“以后再清理”的人工习惯或调试约定。
```

默认 retention classes：

```txt
capture-browser-viewport / capture-desktop-screen / optimize-lossless -> transient-capture
capture-region -> transient-region
prepare-ai-input -> transient-ai-input
diagnostic-only outputs -> diagnostic-debug
```

默认 TTL / quota：

```txt
transient TTL = 24h
diagnostic-debug TTL = 7d
maxArtifactsPerVideoVisit = 30
maxArtifactsPerRound = 80
maxArtifactsPerMission = 500
maxBytesPerVideoVisit = 150 MB
maxBytesPerRound = 500 MB
maxBytesPerMission = 2 GB
maxPendingTransientArtifacts = 80
maxPendingTransientBytes = 500 MB
```

Screenshot 必须：

```txt
写 ScreenshotArtifactLifecycleManifest
默认 promotionStatus = not_promoted
不得输出 promoted-evidence / legal-hold-evidence
在 quota/backpressure 超限时 fail closed
artifact handoff 完成后立即 burn ephemeral work file
artifact handoff 失败时也必须 burn ephemeral work file
ephemeral work file 清理失败必须 fail closed
只有 retained artifact storageRef 本身可以跳过本次 burn
```

物理保留裁决：

```txt
必须保留：
- Forensics/evidence-store 已正式接收的选品证据图片
- 该证据图片的 record/proof/hash/manifest

必须用完即焚：
- screencapture 产生的 full-screen source 临时图
- browser viewport capture 的工作图，在复制为 governed artifact 后删除
- capture-region / optimize-lossless / prepare-ai-input 生成的 /tmp 工作图，在复制为 governed artifact 后删除
- artifact 写入失败、boundary 失败、运行失败产生的非证据工作图

禁止：
- 把 browser-captures 当长期证据目录
- 把 /tmp/grasseye-screenshot-* 当长期缓存
- 让 AI / Visual Target / Geometry Guard 私自保留截图副本
- 用日志、调试习惯、人工清理替代生产代码物理删除
```

Failure / review_required：

```txt
output = null
diagnosticPayloadRef exists
reason exists
runtimeProof exists
```

---

## 13. Result Model

`ScreenshotAbilityResult` 必须包含：

```yaml
ScreenshotAbilityResult:
  abilityGroupId: screenshot
  childCapabilityId: required
  status: success | failed | review_required
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
  failureReason: required-if-failed
  reviewRequiredReason: required-if-review_required
  diagnosticPayloadRef: required-if-not-success
  runtimeProof: required
  dataQualityFlags: list
```

---

## 14. Output Model

`ScreenshotExecutionOutput` 必须包含：

```yaml
output:
  artifactRef: required
  evidenceId: required
  pageUrl: optional
  pageTitle: optional
  width: required
  height: required
  originalWidth: required
  originalHeight: required
  imageKind: required
  coordinateSpace: required
  scaleMapping: required-if-transformed
  sourceScreenshotEvidenceId: required-if-transformed
  screenId: optional
  sourceHash: required
  outputHash: required
  artifactLifecycleManifestRef: required
  retentionClass: required
  expiresAt: required-if-transient-or-diagnostic
  deleteAfter: required-if-transient-or-diagnostic
  artifactHash: required
  byteSize: required
  promotionStatus: required
  cleanupEligible: required
  regionLabel: required
  regionType: required
  contentLines: list
```

禁止输出：

```txt
targetCoordinates
visualTarget
safeToClick
verificationDecision
pageStateType
productClassification
```

---

## 15. Runtime Proof

`ScreenshotRuntimeProof` 必须包含：

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
abilityGroupId: screenshot
childCapabilityId: required
sourceAbilityGroupId: required
sourceChildCapabilityId: optional
inputRef: required
outputRef: required-if-success
diagnosticPayloadRef: required-if-not-success
sourceProofRef: optional
pageStateProofRef: optional
browserSessionRef: optional
screenshotEvidenceId: required-if-success
artifactRef: required-if-success
sourceArtifactRef: optional
sourceScreenshotEvidenceId: required-if-transformed
sourceHash: required-if-success
outputHash: required-if-success
sourceWidth: required-if-transform
sourceHeight: required-if-transform
outputWidth: required-if-success
outputHeight: required-if-success
coordinateSpace: required-if-success
sourceCoordinateSpace: optional
scaleMapping: required-if-transform
region: optional
idempotencyKey: required
timeoutDecision: required
abortDecision: required
privacyDecision: required
sourceDecision: required
browserSessionDecision: required
pageStateDecision: required
regionDecision: required
captureDecision: required
imageProcessingDecision: required
scaleMappingDecision: required
artifactDecision: required
outputBoundaryDecision: required
startedAt: required
endedAt: required
durationMs: required
status: required
failureReason: optional
reviewRequiredReason: optional
dataQualityFlags: list
clock: required
receivedShapeHash: required-if-invalid-input
```

禁止：

```txt
runtimeProof:null
runId from sessionId/child
missionId from source owner
missing activationSnapshotRef
success proof without artifactRef
failed proof with outputRef
```

### 15.1 当前 blocker 链字段口径

正确链路：

```txt
SCREENSHOT_PROOF_REQUIRED_CHAIN_FIELD_NAMES 只允许包含 missionId/runId/sessionId/stepId/mapPackageId/mapPackageVersion/selectedMapId/selectedMapVersion/activationSnapshotRef/capabilityCallId/nerveBusEnvelopeId
SCREENSHOT_PROOF_OPTIONAL_CHAIN_FIELD_NAMES 必须包含且只包含 roundId/videoVisitId
SCREENSHOT_RESULT_REQUIRED_CHAIN_FIELD_NAMES 必须与 runtimeProof required chain 完全一致
SCREENSHOT_RESULT_OPTIONAL_CHAIN_FIELD_NAMES 必须包含 roundId/videoVisitId/diagnosticPayloadRef
first capture-video-viewport path 在 allowMissingVideoVisitId=true 时允许 runtimeProof/result 持久化 videoVisitId=null
nullable chain fields 只能做 proof/result parity 校验，不能被升级为 blanket required
```

禁止链路：

```txt
videoVisitId 出现在任何 required chain field list
validateScreenshotRuntimeProofChain 对 SCREENSHOT_PROOF_CHAIN_FIELD_NAMES 做 blanket required
validateResultChainFields 对 SCREENSHOT_RESULT_CHAIN_FIELD_NAMES 做 blanket required
success result 被强制要求 non-null diagnosticPayloadRef
schema/policy 允许 null，但 runtimeProof/result refine 拒绝 null
```

### 15.2 当前 blocker 结构化日志必填字段

```txt
CAPABILITY_CALL_STARTED / CAPABILITY_CALL_FAILED / MISSION_FAILED 必须同时带 stepId childCapabilityId status missionId runId sessionId roundId videoVisitId capabilityCallId activationSnapshotRef nerveBusEnvelopeId selectedMapId
若由 nullable parity 阻断，failureReason 必须给出精确字段名与主体，例如 runtimeProof.videoVisitId 或 result.videoVisitId
真实重启后的 fresh runtime log 必须能证明旧错误串已消失，而不是只证明换了一条错误串
```

---

## 16. Child Capabilities

| child | 职责 | 必须 | 禁止 |
|---|---|---|---|
| capture-browser-viewport | 浏览器视口截图 | browser session gate | 直接 BrowserController |
| capture-desktop-screen | 桌面截图 | privacy gate | 无审批全屏抓取 |
| capture-region | 从 source 截区域 | sourceProof + region proof | 缺 sourceScreenshotEvidenceId |
| optimize-lossless | 无损优化 | 尺寸/坐标等价 | 改变 coordinateSpace |
| prepare-ai-input | 准备 AI 输入图 | scaleMapping | 直接变可执行坐标 |

每个 child 必须：

```txt
have contract/schema/implementation
use unified Screenshot runtime
not import sibling implementation
not import AI/VisualTarget/Geometry/PAV/Forensics
not query DOM/BOM
not return boolean
```

---

## 17. 与其它能力组边界

### AI

AI 消费 `ai_input`。
AI 不自己 resize/crop governed screenshot artifact。

### Visual Target

Visual Target 消费 screenshot evidence + scaleMapping。
Visual Target 不生成 screenshot artifact。

### Geometry Guard

Geometry Guard 使用 scaleMapping 做坐标安全判断。
Screenshot 不决定 safeToClick。

### Page State

Page State 可消费截图作为外部证据。
Screenshot 不拥有页面状态真相。

### PAV

PAV 可消费截图作为动作后观察证据。
Screenshot 不判断动作是否成功。

### Forensics

Forensics 保存 Screenshot artifact refs。
Screenshot 不构造最终 evidence packet。

---

## 18. 执法系统

必须存在：

```txt
scripts/audit/domains/screenshot-capability/manifest.json
scripts/audit/domains/screenshot-capability/inspector.ts
scripts/audit/domains/screenshot-capability/run-inspector.ts
scripts/audit/domains/screenshot-capability/negative-proof-harness.ts
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
empty/missing negative proof
verify script as release truth
```

---

## 19. Inspector 必查

```txt
1. Law file is machine-blocking.
2. Public contract is screenshot-only.
3. Input schema includes full chain fields.
4. Source proof required for transform.
5. Privacy gate invoked.
6. Browser session gate invoked.
7. Source proof gate invoked.
8. Region proof gate invoked.
9. Payload budget gate invoked.
10. Timeout/AbortSignal/hard timeout invoked.
11. Artifact storage gate invoked.
12. Scale mapping enforced.
13. Output boundary blocks AI/VisualTarget/PAV/PageState truth.
14. Result/proof/input chain parity.
15. Children use unified runtime.
16. No forbidden imports/symbols/DOM/BOM/cookie reads.
17. No second screenshot owner.
18. ALL active laws in registry/matrix/audit-plan/runner.
19. negative-proof-harness executed.
```

### 19.1 当前 blocker 补充

Screenshot owner inspector 必须额外覆盖：

```txt
cross-boundary local-runtime dispatch adapter uses a dedicated screenshot builder
builder preserves mission/run/session/round/step/map/activation/capability/envelope/input/idempotency/timeout truth from AbilityCommandEnvelope
capture-browser-viewport builder derives browser_viewport source and pageStateProof from governed payload refs
该条检查必须以 AST / symbol 方式完成，不能把 grep/includes 当最终结论
AST 校验 SCREENSHOT_PROOF_REQUIRED_CHAIN_FIELD_NAMES 不得包含 videoVisitId
AST 校验 SCREENSHOT_PROOF_OPTIONAL_CHAIN_FIELD_NAMES 必须保留 roundId/videoVisitId
AST 校验 SCREENSHOT_RESULT_REQUIRED_CHAIN_FIELD_NAMES 与 proof required chain 一致
AST 校验 SCREENSHOT_RESULT_OPTIONAL_CHAIN_FIELD_NAMES 必须保留 roundId/videoVisitId/diagnosticPayloadRef
AST 校验 ScreenshotRuntimeProofIdentitySchema.videoVisitId 与 ScreenshotCapturePolicySchema.allowMissingVideoVisitId 同时存在
AST 校验 validateScreenshotRuntimeProofChain 只消费 SCREENSHOT_PROOF_REQUIRED_CHAIN_FIELD_NAMES
AST 校验 validateResultChainFields 必须拆分 requiredness 与 parity，不能把 nullable field 升级为 required
```

---

## 20. Negative Proof 最低清单

必须 fail → rollback → pass：

```txt
manual-first enforcement reintroduced
remove capabilityCallId from input
remove activationSnapshotRef from input
remove nerveBusEnvelopeId from input
prepare-ai-input success without scaleMapping
region crop success without sourceScreenshotEvidenceId
optimize-lossless changes dimensions
success without artifactRef
success without outputHash
failed result with output
Screenshot imports AI runtime
Screenshot imports Visual Target implementation
Screenshot imports BrowserController directly
Screenshot reads document.cookie
platform-action screenshot drawer active path
local-ai resize/crop helper produces artifact truth
child returns boolean
child imports sibling implementation
remove negative proof invocation
turn P0 into warning-only
```

### 20.1 当前 blocker 补充

必须 fail → rollback → pass：

```txt
local-runtime screenshot dispatch adapter maps capabilityCallId to missionId
local-runtime screenshot dispatch adapter drops timeoutMs derivation
capture-browser-viewport builder removes pageStateProof handoff while payload.pageStateRef still exists
move videoVisitId into SCREENSHOT_PROOF_REQUIRED_CHAIN_FIELD_NAMES
force validateResultChainFields to require SCREENSHOT_RESULT_CHAIN_FIELD_NAMES instead of SCREENSHOT_RESULT_REQUIRED_CHAIN_FIELD_NAMES
```

---

## 21. READY 标准

Screenshot READY 仅当：

```txt
Screenshot 法案 / 施工图 / inspector / generated / runner 口径一致
ALL active law enforcement PASS
CI-FULL PASS
input chain fields complete
source proof/page-state/browser proof gates enforced where required
privacy/session/source/region/timeout/artifact pipeline complete
coordinate-space and scaleMapping policy complete
prepare-ai-input always preserves scaleMapping
result/proof/input chain parity passes
children narrow capture/transform bindings
negative proof PASS
```

### 21.1 当前 blocker 补充

```txt
local-runtime screenshot dispatch adapter emits full governed chain into ScreenshotAbilityInput
browser viewport capture receives source + pageStateProof handoff before owner-side gates
runtimeProof/result 不再把 nullable videoVisitId 升级为 required failure
fresh runtime log 不再出现 `videoVisitId is required in runtimeProof`
fresh runtime log 不再出现 `videoVisitId is required in result`
必须完成真实 restart + 真实任务触发 + fresh phase-1 根因分析重写
当前 blocker 的生产突变证据必须落到 tmp/debug-loop/regression-proofs/BLOCKER-POSTFIX-1/
真实重启后的 fresh runtime log 不再出现 screenshot invalid-input missing activationSnapshotRef/capabilityCallId/nerveBusEnvelopeId/inputRef 类 P0 阻断
只有真实 restart + fresh log re-analysis 证实旧 blocker 消失后，才能把这一条标 READY
```

---

## 22. 漂移信号

```txt
local-ai 自己 resize/crop governed screenshot artifact
Visual Target 生成 screenshot artifact
Screenshot result exposes targetCoordinates
Screenshot result exposes verificationDecision
prepare-ai-input lacks scaleMapping
region lacks sourceScreenshotEvidenceId
Screenshot proof lacks activationSnapshotRef
platform-action screenshot drawer reappears
verify script becomes release gate
```

---

## 23. 最终原则

```txt
Screenshot 是“我看见的图”。
AI 是“我根据图推理”。
Visual Target 是“我把候选标准化成目标”。
Geometry Guard 是“这个坐标能不能安全执行”。
PAV 是“动作后是否成功”。
这些不能混。
```

---

## 24. 实战运行日志透明化修复补充：prepare-ai-input handoff

本节只补当前 blocker 的执行细节，不新增 lawId，不修改冻结法案。

正确链路：

```txt
Screenshot capture success
-> ability result envelope records stored_image source handoff by outputRef/evidenceId
-> prepare-ai-input dispatch adapter resolves source from screenshotEvidenceRef / abilityResultRef / inputRef
-> Screenshot owner performs resize/compress/scaleMapping
-> AI step consumes promptInputRef / aiInputArtifactRef, not original screenshot directly
```

禁止链路：

```txt
prepare-ai-input enters Screenshot without source
Orchestration builds stored_image source itself
AI adapter resizes/compresses governed screenshot artifact
map hardcodes image compression or artifact paths
AI step consumes original screenshot when prepare-ai-input is required
```

inspector 应覆盖：

```txt
workbench-screenshot-dispatch-input buildPrepareAiInputCommand 必须调用 resolveScreenshotSourceHandoff
source candidates 必须包括 screenshotEvidenceRef、abilityResultRef、inputRef
prepare-ai-input command 必须只在 resolved source 存在时携带 source
ability result envelope 必须记录 screenshot source handoff
handoff helper 必须保留 sourceArtifactRef、sourceProof、sha256、storageRef
screenshot-execution-phases 必须调用 burnEphemeralScreenshotFile
screenshot-ephemeral-file-cleanup 必须物理 rm outputFilePath
ephemeral cleanup bypass negative proof 必须 FAIL
```

negative proof 应覆盖：

```txt
删除 screenshotEvidenceRef source candidate 必须 FAIL
删除 ability result source handoff recording 必须 FAIL
删除 artifact hash handoff 字段必须 FAIL
rollback 后 inspector 必须 PASS
```

结构化日志必备字段：

```txt
CAPABILITY_CALL_STARTED.stepId=prepare-ai-input
CAPABILITY_CALL_STARTED.inputRefs
CAPABILITY_CALL_COMPLETED.outputRefs
sourceScreenshotEvidenceId
originalArtifactRef
aiInputArtifactRef
artifactHash
scaleMapping
prepareAiInputExecuted
```

READY 标准补充：

```txt
fresh runtime log 不再出现 prepare-ai-input invalid_type source Required
AI step inputRefs 指向 Screenshot 生成的 ai input artifact
真实 restart + 真实任务触发 + fresh phase-1 日志分析确认旧 blocker 消失
```

## 24.1 实战运行日志透明化修复补充：prepare-ai-input failed-path scaleMapping 语义

本节只补当前 blocker 的执行细节，不新增 lawId，不修改冻结法案。

正确链路：

```txt
prepare-ai-input success
-> Screenshot proof/result 必须保留 scaleMapping
-> scaleMappingDecision=passed

prepare-ai-input failed/review_required
-> Screenshot proof/result 必须保留 diagnosticPayloadRef
-> 不得为了满足 success-only 规则而伪造 scaleMapping
-> 更深层 image-processing/output 失败要通过真实 failureReason 暴露出来
```

禁止链路：

```txt
把 prepare-ai-input 的 scaleMapping 作为所有 status 的 blanket required
failed/review_required proof 因缺少 scaleMapping 被 schema 先行拦截
为了绕过 refine 而在 failed/review_required proof 中伪造 scaleMapping
fresh runtime log 只是不再报 scaleMapping，但继续吞掉真实底层失败原因
```

inspector 应覆盖：

```txt
AST 校验 validatePrepareAiInputScaleMapping 必须显式包含 status=success 门禁
AST 校验 validateScreenshotRuntimeProofPrepareAiInput 必须调用 success-only helper
AST 校验 non-success diagnosticPayloadRef 暴露规则仍然存在
不得用 grep/includes 作为最终结论
```

negative proof 应覆盖：

```txt
移除 prepare-ai-input success 状态门禁必须 FAIL
把 prepare-ai-input 的 scaleMapping 检查恢复成 blanket required 必须 FAIL
rollback 后 inspector 必须 PASS
```

结构化日志必备字段：

```txt
CAPABILITY_CALL_FAILED 必须带 stepId=prepare-ai-input childCapabilityId status missionId runId capabilityCallId activationSnapshotRef nerveBusEnvelopeId selectedMapId
若阻断点来自 schema refine，failureReason 必须精确指向 scaleMapping 或 diagnosticPayloadRef
若旧 blocker 消失后暴露更深层失败，fresh runtime log 必须显示真实 child failure，而不是新的 blanket refine 错误串
```

READY 标准补充：

```txt
fresh runtime log 不再出现 `prepare-ai-input proof requires scaleMapping` 作为 failed/review_required 结果的首个阻断
prepare-ai-input success 仍保持 scaleMapping 强约束
真实 restart + 真实任务触发 + fresh phase-1 日志分析确认旧 blocker 消失
若旧 blocker 消失后出现更深层 child failure，必须进入 fresh RCA，不得假装 READY
```
