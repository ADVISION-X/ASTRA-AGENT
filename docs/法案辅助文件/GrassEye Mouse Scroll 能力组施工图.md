# GrassEye Mouse Scroll 能力组施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-MOUSE-SCROLL-BLUEPRINT-FINAL
owner: mouse-scroll-capability
documentType: construction-blueprint
lawAuthority: module-mouse-scroll-capability.instructions.md
architecturePhase: Static Capability Package Architecture
status: active
replace:
  - docs/法案辅助文件/GrassEye Mouse Scroll 能力组施工图.md
mustNotCreate:
  - new lawId
  - new ability group
  - platform-scroll owner
  - browser-scroll owner
  - geometry remap owner
  - post-action verification owner
  - final action-log owner
  - scroll-next-video child
  - scroll-until-found child
```

本施工图是 `module-mouse-scroll-capability.instructions.md` 的建设级落地映射。
本施工图不新增 lawId，不修改冻结法案，不重新分配主权。
若本文档与 Mouse Scroll 法案冲突，以 Mouse Scroll 法案为最高权威。

---

## 1. 定位

Mouse Scroll Ability Group 是鼠标滚动执行能力组。

它只负责：

```txt
接收 Geometry Guard allow 的 executable anchor/region
解析 explicit direction / magnitude / customDelta / repeat
执行 governed primitive scroll
生成 scrollExecutionRef
生成 primitiveExecutionRefs
生成 perIterationPrimitiveProofs
生成 postActionVerificationHandoffRef
返回 MouseScrollAbilityResult
返回 MouseScrollRuntimeProof
```

它不负责：

```txt
截图
找坐标
AI 推理
Visual Target 目标选择
Geometry scaleMapping
DOM/BOM 查询
页面状态判断
判断是否切换到下一条视频
动作后验证
最终 action log 持久化
地图分支
产品判断
评论采集
```

真实平台 `scroll-next-video` 的 primitive adapter 必须采用：

```txt
ACTION AND THEN observation handoff
```

也就是：

```txt
先执行受治理的滚动 primitive
AND THEN 只记录 primitive scroll settle 与滚动后观测交接 ref
禁止在 Mouse Scroll 内轮询浏览器原生可观测身份（视频 DOM identity / URL）
禁止在 Mouse Scroll 内得出“已经进入新视频”或“视频内容已经变化”的本地结论
```

是否进入新视频只能走：

```txt
Scroll
→ Screenshot
→ Page State stable
→ AI / Visual evidence
→ Orchestration next round
```

这里的 timeout 只允许作为大额度防死锁兜底：

```txt
timeout = 防止系统困死
timeout != 技术成功条件
timeout != 调试手段
timeout != 换视频证明
```

滚动后的下一视频判断不属于 Mouse Scroll，也不属于本地 DOM / URL 规则；后续只能交给 Screenshot、Page State、AI 与编排链处理。

一句话：

```txt
Mouse Scroll 是“我滚动”，不是“为什么滚动”，也不是“滚完是否成功”。
```

---

## 2. 故事链路位置

```txt
Orchestration
→ Geometry Guard
→ Mouse Scroll
→ Post-action Verification
→ Forensics
```

边界关系：

```txt
Orchestration 决定为什么滚动。
Geometry Guard 输出 guardDecision=allow 与 normalized anchor/region。
Mouse Scroll 执行 primitive scroll。
PAV 验证滚动后是否达到预期，比如是否换视频。
Forensics 保存最终动作日志和证据链。
```

---

## 3. 标准包结构

```txt
src/capabilities/mouse-scroll/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── ports/
│   ├── mouse-scroll-clock-port.ts
│   └── mouse-scroll-primitive-port.ts
├── shared/
│   ├── mouse-scroll-failure.ts
│   ├── mouse-scroll-policy.ts
│   ├── mouse-scroll-proof.ts
│   ├── mouse-scroll-result.ts
│   ├── mouse-scroll-types.ts
│   └── scroll-magnitude.ts
├── runtime/
│   ├── geometry-scroll-proof-gate.ts
│   ├── scroll-policy-gate.ts
│   ├── scroll-delta-resolver.ts
│   ├── pre-scroll-safety-gate.ts
│   ├── mouse-scroll-input-gate.ts
│   ├── mouse-scroll-idempotency-registry.ts
│   ├── primitive-scroll-runner.ts
│   ├── primitive-scroll-port-call.ts
│   ├── primitive-scroll-single-iteration.ts
│   ├── primitive-scroll-iteration-proof.ts
│   ├── primitive-scroll-success-builder.ts
│   ├── primitive-scroll-failure-builder.ts
│   ├── mouse-scroll-proof-builder.ts
│   ├── mouse-scroll-result-builder.ts
│   ├── mouse-scroll-dispatch-failure.ts
│   └── mouse-scroll-executor.ts
└── children/
    ├── scroll-browser-viewport/
    ├── scroll-desktop-screen/
    └── scroll-region/
```

禁止：

```txt
scroll-one-page
scroll-two-pages
scroll-next-video
scroll-until-found
vertical-wheel-scroll
horizontal-wheel-scroll
compat/
bridge/
legacy/
v2/
capability-check.ts
verify-*.ts
```

---

## 4. Public Contract

Public interface 只允许：

```ts
interface MouseScrollAbilityGroup {
  listChildCapabilityIds(): MouseScrollChildCapabilityId[];
  execute(input: MouseScrollAbilityInput): Promise<MouseScrollAbilityResult>;
}
```

允许 public exports：

```txt
createMouseScrollAbilityGroup
MOUSE_SCROLL_ABILITY_GROUP_ID
MouseScrollAbilityInput
MouseScrollAbilityResult
MouseScrollRuntimeProof
MouseScrollPrimitivePort type
MouseScrollDirection
MouseScrollMagnitude
MouseScrollCoordinateSpace
MouseScrollSafetyPolicy
MouseScrollFailureReason
MouseScroll schemas
```

禁止 public exports/imports：

```txt
BrowserController
BrowserActionResult
BrowserActionId
PlatformActionType
Geometry Guard internals
Visual Target internals
PAV internals
Forensics writer
raw browser primitive implementation
child implementation
runtime executor internals as public API
```

---

## 5. Input Model

`MouseScrollAbilityInput` 必须包含：

```yaml
MouseScrollAbilityInput:
  abilityGroupId: mouse-scroll
  childCapabilityId: scroll-browser-viewport | scroll-desktop-screen | scroll-region
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
  inputRef: required
  sourceRef: required
  sourceCoordinateProofRef: required
  sourceEvidenceRef: optional
  sourceTargetRef: required
  sourceVisualTargetResultRef: optional
  geometryScrollProof: required
  geometryGuardRef: required
  guardDecision: allow
  geometryGuardOutputRef: required
  geometryGuardRuntimeProofRef: required
  geometryGuardNormalizedCoordinateSpace: required
  geometryGuardNormalizedAnchorPoint: required
  geometryGuardNormalizedRegion: required-if-region
  direction: up | down | left | right
  magnitude: small | halfPage | onePage | twoPages | customDelta
  customDelta: required-if-customDelta
  repeat: finite-positive-int
  coordinateSpace: browserViewport | desktopScreen
  anchorPoint: required
  region: required-if-region
  regionRef: required-if-region
  bounds: required
  safetyPolicy: required
  idempotencyKey: required
  timeoutMs: required
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
sourceRef
sourceCoordinateProofRef
sourceTargetRef
geometryGuardRef
geometryScrollProof
idempotencyKey
```

---

## 6. Geometry Guard Proof

`geometryScrollProof` 必须满足：

```yaml
geometryScrollProof:
  abilityGroupId: geometry-guard
  proofId: required
  geometryGuardRef: required
  status: success
  guardDecision: allow
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
  normalizedCoordinateSpace: browserViewport | desktopScreen
  normalizedAnchorPoint:
    x: finite
    y: finite
  normalizedRegion: required-if-region
  sourceScreenshotEvidenceRef: optional
  sourceTargetRef: required
  sourceVisualTargetResultRef: optional
  inputRef: required
  outputRef: required
  runtimeProofRef: required
```

规则：

```txt
scroll-browser-viewport 只能接受 browserViewport。
scroll-desktop-screen 只能接受 desktopScreen。
scroll-region 必须有 normalizedRegion / regionRef。
Mouse Scroll 不接受 aiInput / contactSheet / imageEvidence / regionCrop。
Mouse Scroll 不做 scaleMapping。
Mouse Scroll 不重算 anchorPoint / region。
```

---

## 7. Direction / Magnitude / Repeat

方向：

```txt
up
down
left
right
```

幅度：

```txt
small
halfPage
onePage
twoPages
customDelta
```

默认像素规则只允许定义在：

```txt
src/capabilities/mouse-scroll/shared/scroll-magnitude.ts
```

推荐默认：

```txt
small = 300px
halfPage = 0.5 viewport height
onePage = 0.85 viewport height
twoPages = 1.7 viewport height
repeat max = 3
```

customDelta：

```txt
magnitude=customDelta 时必须有 finite deltaX / deltaY
deltaX/deltaY 必须受 maxDeltaAbs 限制
```

repeat：

```txt
repeat 必须是有限正整数
repeat 必须 <= safetyPolicy.maxRepeat
repeat 每次 primitive 都必须有 perIterationPrimitiveProof
```

禁止：

```txt
隐藏循环直到找到某物
scroll-until-found
scroll-next-video 子能力
repeat 无上限
默认猜 direction/magnitude
fallback magnitude
```

---

## 8. Runtime Pipeline

Mouse Scroll executor 必须固定：

```txt
input schema gate
→ child registry gate
→ Geometry Guard proof gate
→ scroll policy gate
→ delta/magnitude resolver
→ boundary gate
→ pre-scroll safety gate
→ idempotency gate
→ timeout/cancellation gate
→ primitive scroll through MouseScrollPrimitivePort
→ per-iteration primitive result semantic gate
→ PAV handoff builder
→ output boundary gate
→ proof builder
→ result builder
```

禁止：

```txt
child direct final result
child direct proof
child direct primitive scroll
primitive scroll before Geometry Guard gate
primitive scroll after gate failure
retry loop
fallback scroll path
scroll-until-found loop
success without proof
```

---

## 9. Primitive Port

BrowserController 只能藏在 composition adapter 后面：

```txt
MouseScrollPrimitivePort.scroll(input)
```

Primitive input 必须包含：

```yaml
attemptRef: required
scrollExecutionRef: required
idempotencyKey: required
sessionId: required
roundId: optional
videoVisitId: optional
geometryGuardProofRef: required
sourceCoordinateProofRef: required
sourceTargetRef: required
coordinateSpace: browserViewport | desktopScreen
anchorPoint: required
deltaX: finite
deltaY: finite
repeatIndex: required
repeatTotal: required
targetLabel: required
timeoutMs: required
postActionVerificationRequired: true
operatorApprovalRef: optional
abortSignal: required
```

Primitive result 必须语义校验：

```txt
ok=true requires primitiveExecutionRef
ok=false requires message/failure reason
timeout/thrown/aborted must not become success
partial iteration failure must fail/review
```

---

## 10. Timeout / Cancellation

Mouse Scroll primitive execution must enforce:

```txt
AbortController created
AbortSignal passed to primitive port
hard timeout exists per primitive call
timeout aborts signal
timeout returns typed failed/review
late primitive success cannot overwrite timeout
timeoutDecision recorded in proof
abortDecision recorded in proof
```

禁止：

```txt
Promise.race without AbortSignal
AbortSignal without hard timeout
timeout later overwritten by success
timeout without proof
```

---

## 11. Idempotency

Mouse Scroll idempotency must enforce:

```txt
duplicate key cannot execute primitive twice
cooldown produces block/review
idempotencyDecision enters proof
reservation failure cannot success
```

Rules：

```txt
idempotencyKey scope must include mission/run/session/round/videoVisit/geometryGuardRef/anchor/delta/repeat/direction/magnitude.
duplicate_review_required must not call primitive port.
```

---

## 12. Result Model

`MouseScrollAbilityResult` 必须包含：

```yaml
status: success | failed | review_required
abilityGroupId: mouse-scroll
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
attemptRef: required
scrollExecutionRef: required-if-success
primitiveExecutionRefs: required-if-success
geometryGuardRef: required
geometryGuardProofRef: required
geometryGuardRuntimeProofRef: required
geometryGuardOutputRef: required
sourceCoordinateProofRef: required
sourceEvidenceRef: optional
sourceTargetRef: required
sourceVisualTargetResultRef: optional
regionRef: optional
coordinateSpace: browserViewport | desktopScreen
direction: required
magnitude: required
repeat: required
requestedDelta: optional
executableDelta: required-if-success
output: required-if-success
failureReason: required-if-failed
reviewRequiredReason: required-if-review_required
diagnosticPayloadRef: required-if-not-success
debugLogRef: required
policyDecision: required
geometryDecision: required
safetyDecision: required
primitiveDecision: required
timeoutDecision: required
abortDecision: required
idempotencyDecision: required
postActionVerificationRequired: boolean
postActionVerificationHandoffRef: required-if-success
dataQualityFlags: list
statusMessage: required
startedAt: required
endedAt: required
durationMs: required
runtimeProof: required
```

Success：

```txt
output exists
outputRef exists
scrollExecutionRef exists
primitiveExecutionRefs non-empty
perIterationPrimitiveProofs length equals repeat
executableDelta exists
postActionVerificationRequired=true
postActionVerificationHandoffRef exists
runtimeProof exists
```

Failed / review_required：

```txt
output = null
diagnosticPayloadRef exists
reason exists
runtimeProof exists
executableDelta absent in proof
```

---

## 13. Runtime Proof

`MouseScrollRuntimeProof` 必须包含：

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
abilityGroupId: mouse-scroll
childCapabilityId: required
sourceAbilityGroupId: required
sourceChildCapabilityId: optional
inputRef: required
sourceRef: required
outputRef: required-if-success
diagnosticPayloadRef: required-if-not-success
attemptRef: required
scrollExecutionRef: required-if-success
rejectionRef: optional
parseErrorRef: optional
receivedShapeHash: required-if-invalid-input
geometryGuardRef: required
geometryGuardProofRef: required
geometryGuardRuntimeProofRef: required
geometryGuardOutputRef: required
sourceCoordinateProofRef: required
sourceEvidenceRef: optional
sourceTargetRef: required
sourceVisualTargetResultRef: optional
regionRef: optional
coordinateSpace: browserViewport | desktopScreen
sourceCoordinateSpace: browserViewport | desktopScreen
requestedExecutionSpace: browserViewport | desktopScreen
normalizedCoordinateSpace: browserViewport | desktopScreen
anchorPoint: required-if-success
region: optional
bounds: required
direction: required
magnitude: required
requestedDelta: required
executableDelta: required-if-success
deltaResolutionDecision: required
deltaCapDecision: required
repeat: required
idempotencyKey: required
idempotencyDecision: required
runLockId: optional
cancellationTokenRef: optional
resumeCheckpointRef: optional
primitiveCallId: optional
primitiveExecutionRefs: list
perIterationPrimitiveProofs: list
primitivePortKind: required
primitiveStartedAt: optional
primitiveEndedAt: optional
timeoutMs: required
primitiveTimeoutMs: required
maxDurationMs: required
timeoutDecision: required
abortDecision: required
circuitBreakerState: required
scrollSuppressedReason: optional
postActionVerificationRequired: true-if-success
postActionVerificationHandoffRef: required-if-success
verificationRefPolicy: pav-handoff-required
preActionDecision: required
policyDecision: required
policyDecisionReason: optional
geometryDecision: required
geometryDecisionReason: optional
safetyDecision: required
safetyDecisionReason: optional
primitiveDecision: required
startedAt: required
endedAt: required
durationMs: required
status: required
failureReason: optional
reviewRequiredReason: optional
dataQualityFlags: list
clock: required
```

禁止：

```txt
runtimeProof:null
runId from attemptRef/child
missionId=sessionId
missing activationSnapshotRef
missing capabilityCallId
success proof without primitiveExecutionRefs
success proof without PAV handoff
failed/review proof with executableDelta
```

---

## 14. Child Capabilities

| child | coordinateSpace | 作用 |
|---|---|---|
| scroll-browser-viewport | browserViewport | 执行浏览器视口滚动 |
| scroll-desktop-screen | desktopScreen | 执行桌面屏幕滚动 |
| scroll-region | browserViewport / desktopScreen by policy | 在受治理 region 内滚动 |

每个 child 必须：

```txt
have contract/schema/implementation
走 unified Mouse Scroll runtime
不得直接调用 primitive port
不得 build final proof/result
不得 import sibling implementation
不得 import BrowserController
不得 return boolean
```

禁止新增：

```txt
scroll-one-page
scroll-two-pages
scroll-next-video
scroll-until-found
vertical-wheel-scroll
horizontal-wheel-scroll
```

direction / magnitude / repeat 是输入参数，不是子能力。

---

## 15. 与其它能力组边界

### Orchestration

决定为什么滚动。
Mouse Scroll 不决定下一步，不判断是否进入下一条视频。

### Geometry Guard

提供 guardDecision=allow 和 normalized anchor/region。
Mouse Scroll 只能消费 Geometry Guard allow。

### PAV

验证滚动后结果。
Mouse Scroll 只生成 handoff。

### Screenshot

提供滚动前后截图。
Mouse Scroll 不截图。

### Forensics

持久化最终 action log。
Mouse Scroll 不写 finalActionLogRef。

### BrowserController

只能在 primitive adapter 内部。
不得出现在 public contract。

---

## 16. 执法系统

必须存在：

```txt
scripts/audit/domains/mouse-scroll-capability/manifest.json
scripts/audit/domains/mouse-scroll-capability/inspector.ts
scripts/audit/domains/mouse-scroll-capability/run-inspector.ts
scripts/audit/domains/mouse-scroll-capability/negative-proof-harness.ts
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
capability-check.ts as acceptance
verify script as release truth
```

---

## 17. Inspector 必查

```txt
1. Law file is machine-blocking.
2. Public contract is scroll-only and primitive-port based.
3. Input schema includes full chain fields.
4. Geometry Guard proof requires guardDecision=allow.
5. Source coordinate/source target/source evidence policy enforced.
6. Direction/magnitude/customDelta/repeat policy enforced.
7. No coordinate generation/remapping/scaleMapping inside Mouse Scroll.
8. Primitive scroll only through MouseScrollPrimitivePort.
9. AbortSignal/timeout gate enforced.
10. Idempotency gate enforced.
11. No retry/fallback/until-found path.
12. Success requires PAV handoff.
13. Result/proof/input chain parity.
14. Children use unified runtime.
15. No forbidden imports/symbols/business verbs.
16. External platform/runtime cannot bypass Mouse Scroll.
17. ALL active laws in registry/matrix/audit-plan/runner.
18. negative proof executed.
```

---

## 18. Negative Proof 最低清单

必须 fail → rollback → pass：

```txt
manual-first enforcement reintroduced
remove capabilityCallId from input
remove activationSnapshotRef from input
remove nerveBusEnvelopeId from input
guardDecision=review_required returns success
missing geometryGuardRef returns success
repeat above max returns success
customDelta without finite delta returns success
desktop scroll without desktop approval returns success
remove AbortSignal
add retry loop
add scroll-until-found loop
add scaleMapping to Mouse Scroll runtime
add browserActionId to result
success without postActionVerificationHandoffRef
proof runId from attemptRef/child
proof missing activationSnapshotRef
child calls primitive port directly
child returns boolean
platform adapter directly calls primitive scroll
capability-check.ts added
remove negative proof invocation
turn P0 into warning-only
```

---

## 19. READY 标准

Mouse Scroll READY 仅当：

```txt
Mouse Scroll 法案 / 施工图 / inspector / generated / runner 口径一致
ALL active law enforcement PASS
CI-FULL PASS
input chain fields complete
Geometry Guard allow proof required
no coordinate remapping/generation/scaleMapping inside Mouse Scroll
direction/magnitude/customDelta/repeat policies enforced
primitive scroll only through MouseScrollPrimitivePort
AbortSignal/timeout/idempotency enforced
no hidden scroll-until-found/retry/fallback
success requires scrollExecutionRef + primitiveExecutionRefs + PAV handoff
result/proof/input chain parity
children narrow primitive bindings
external platform/runtime cannot bypass Mouse Scroll
negative proof PASS
```

---

## 20. 漂移信号

```txt
Mouse Scroll proof lacks activationSnapshotRef
Mouse Scroll runId from attemptRef/child
Mouse Scroll accepts raw Visual Target region/anchor
Mouse Scroll contains scaleMapping
Mouse Scroll result exposes browserActionId
Mouse Scroll success lacks postActionVerificationHandoffRef
Mouse Scroll writes finalActionLogRef
Mouse Scroll imports BrowserController
platform adapter directly scrolls browser
retry/fallback appears
scroll-until-found appears
scroll-next-video appears as child
verify script becomes release gate
```

---

## 21. 最终原则

```txt
Orchestration 说：为什么滚动。
Geometry Guard 说：锚点/区域能不能安全执行。
Mouse Scroll 说：我滚动。
PAV 说：滚完是否成功。
Forensics 说：我把证据链存下来。
这五者不能混。
```
