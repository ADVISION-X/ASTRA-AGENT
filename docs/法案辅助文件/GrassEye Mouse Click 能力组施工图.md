# GrassEye Mouse Click 能力组施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-MOUSE-CLICK-BLUEPRINT-FINAL
owner: mouse-click-capability
documentType: construction-blueprint
lawAuthority: module-mouse-click-capability.instructions.md
architecturePhase: Static Capability Package Architecture
status: active
replace:
  - docs/法案辅助文件/GrassEye Mouse Click 能力组施工图.md
mustNotCreate:
  - new lawId
  - new ability group
  - platform-click owner
  - browser-click owner
  - geometry remap owner
  - post-action verification owner
  - final action-log owner
```

本施工图是 `module-mouse-click-capability.instructions.md` 的建设级落地映射。
本施工图不新增 lawId，不修改冻结法案，不重新分配主权。
若本文档与 Mouse Click 法案冲突，以 Mouse Click 法案为最高权威。

---

## 1. 定位

Mouse Click Ability Group 是鼠标点击执行能力组。

它只负责：

```txt
接收 Geometry Guard allow 的 executable coordinate
执行 governed primitive click
生成 actionExecutionRef
生成 primitiveExecutionRef
生成 postActionVerificationHandoffRef
返回 MouseClickAbilityResult
返回 MouseClickRuntimeProof
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
动作后验证
最终 action log 持久化
地图分支
产品判断
评论采集
```

一句话：

```txt
Mouse Click 是“我去点”，不是“我找哪里点”，也不是“点完是否成功”。
```

---

## 2. 故事链路位置

```txt
Visual Target
→ Geometry Guard
→ Mouse Click
→ Post-action Verification
→ Forensics
```

边界关系：

```txt
Visual Target 产生候选目标。
Geometry Guard 输出 guardDecision=allow 与 normalizedClickPoint。
Mouse Click 执行 primitive click。
PAV 验证点击后是否达到预期。
Forensics 保存最终动作日志和证据链。
```

---

## 3. 标准包结构

```txt
src/capabilities/mouse-click/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── ports/
│   ├── mouse-click-clock-port.ts
│   └── mouse-click-primitive-port.ts
├── shared/
│   ├── mouse-click-failure.ts
│   ├── mouse-click-policy.ts
│   ├── mouse-click-proof.ts
│   ├── mouse-click-result.ts
│   └── mouse-click-types.ts
├── runtime/
│   ├── click-policy-gate.ts
│   ├── geometry-proof-gate.ts
│   ├── pre-click-safety-gate.ts
│   ├── mouse-click-boundary-gate.ts
│   ├── mouse-click-input-gate.ts
│   ├── mouse-click-preflight-stages.ts
│   ├── mouse-click-idempotency.ts
│   ├── mouse-click-idempotency-support.ts
│   ├── primitive-click-runner.ts
│   ├── primitive-click-runner-frame.ts
│   ├── primitive-click-runner-guard.ts
│   ├── primitive-click-runner-outcome.ts
│   ├── primitive-click-runner-result.ts
│   ├── primitive-click-runner-state.ts
│   ├── mouse-click-primitive-stage.ts
│   ├── mouse-click-proof-builder.ts
│   ├── mouse-click-result-builder.ts
│   ├── mouse-click-rejection-result.ts
│   ├── mouse-click-dispatch-failure.ts
│   └── mouse-click-executor.ts
└── children/
    ├── click-browser-coordinate/
    └── click-desktop-coordinate/
```

禁止：

```txt
click-left-point
click-right-point
double-click-left-point
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
interface MouseClickAbilityGroup {
  listChildCapabilityIds(): MouseClickChildCapabilityId[];
  execute(input: MouseClickAbilityInput): Promise<MouseClickAbilityResult>;
}
```

允许 public exports：

```txt
createMouseClickAbilityGroup
MOUSE_CLICK_ABILITY_GROUP_ID
MouseClickAbilityInput
MouseClickAbilityResult
MouseClickRuntimeProof
MouseClickPrimitivePort type
MouseClickCoordinate
MouseClickButton
MouseClickCount
MouseClickSafetyPolicy
MouseClickFailureReason
MouseClick schemas
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

`MouseClickAbilityInput` 必须包含：

```yaml
MouseClickAbilityInput:
  abilityGroupId: mouse-click
  childCapabilityId: click-browser-coordinate | click-desktop-coordinate
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
  geometryGuardProof: required
  geometryGuardRef: required
  guardDecision: allow
  geometryGuardOutputRef: required
  geometryGuardRuntimeProofRef: required
  geometryGuardNormalizedCoordinateSpace: required
  geometryGuardNormalizedClickPoint: required
  button: left | right | middle
  clickCount: 1 | 2
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
geometryGuardProof
idempotencyKey
```

---

## 6. Geometry Guard Proof

`geometryGuardProof` 必须满足：

```yaml
geometryGuardProof:
  abilityGroupId: geometry-guard
  proofId: required
  geometryGuardRef: required
  status: success
  guardDecision: allow
  normalizedCoordinateSpace: browserViewport | desktopScreen
  normalizedClickPoint:
    x: finite
    y: finite
  sourceScreenshotEvidenceRef: optional
  sourceTargetRef: required
  sourceVisualTargetResultRef: optional
  inputRef: required
  outputRef: required
  runtimeProofRef: required
```

规则：

```txt
click-browser-coordinate 只能接受 browserViewport。
click-desktop-coordinate 只能接受 desktopScreen。
Mouse Click 不接受 aiInput / contactSheet / imageEvidence / regionCrop。
Mouse Click 不做 scaleMapping。
Mouse Click 不重算 bbox / clickPoint。
```

---

## 7. Runtime Pipeline

Mouse Click executor 必须固定：

```txt
input schema gate
→ child registry gate
→ Geometry Guard proof gate
→ click policy gate
→ boundary gate
→ pre-click safety gate
→ idempotency gate
→ timeout/cancellation gate
→ primitive click through MouseClickPrimitivePort
→ primitive result semantic gate
→ PAV handoff builder
→ output boundary gate
→ proof builder
→ result builder
```

禁止：

```txt
child direct final result
child direct proof
child direct primitive click
primitive click before Geometry Guard gate
primitive click after gate failure
retry loop
fallback click path
success without proof
```

---

## 8. Click Policy

Right click：

```txt
button=right requires safetyPolicy.allowRightClick=true
```

Double click：

```txt
clickCount=2 requires safetyPolicy.allowDoubleClick=true
```

Desktop screen click：

```txt
childCapabilityId=click-desktop-coordinate requires:
  safetyPolicy.allowDesktopScreenClick=true
  currentPhaseAllowsDesktopClick=true
  platformProfileAllowsDesktopClick=true
  desktopScreenOperatorApprovalRef when policy requires it
```

Manual approval：

```txt
sourceEvidenceRef/sourceTargetRef missing can only downgrade to review_required or proceed when allowOperatorManual=true and operatorManualApprovalRef valid by policy.
```

Mouse Click 内部禁止：

```txt
retry
fallback
business action allowlist
click strategy selection
```

---

## 9. Primitive Port

BrowserController 只能藏在 composition adapter 后面：

```txt
MouseClickPrimitivePort.click(input)
```

Primitive input 必须包含：

```yaml
attemptRef: required
actionExecutionRef: required
idempotencyKey: required
sessionId: required
roundId: optional
videoVisitId: optional
geometryGuardProofRef: required
sourceCoordinateProofRef: required
sourceTargetRef: required
coordinateSpace: browserViewport | desktopScreen
executableCoordinate: required
button: required
clickCount: required
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
```

---

## 10. Timeout / Cancellation

Mouse Click primitive execution must enforce:

```txt
AbortController created
AbortSignal passed to primitive port
hard timeout race exists
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

Mouse Click idempotency must enforce:

```txt
duplicate command/click key cannot execute primitive twice
cooldown produces block/review
idempotencyDecision enters proof
reservation failure cannot success
```

Rules：

```txt
idempotencyKey scope must include mission/run/session/round/videoVisit/geometryGuardRef/click coordinate/button/clickCount.
duplicate_review_required must not call primitive port.
```

---

## 12. Result Model

`MouseClickAbilityResult` 必须包含：

```yaml
status: success | failed | review_required
abilityGroupId: mouse-click
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
actionExecutionRef: required-if-success
primitiveExecutionRef: required-if-success
geometryGuardRef: required
geometryGuardProofRef: required
sourceCoordinateProofRef: required
sourceEvidenceRef: optional
sourceTargetRef: required
sourceVisualTargetResultRef: optional
coordinateSpace: browserViewport | desktopScreen
button: required
clickCount: required
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
actionExecutionRef exists
primitiveExecutionRef exists
normalizedClickPoint exists
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
executableCoordinate absent in proof
```

---

## 13. Runtime Proof

`MouseClickRuntimeProof` 必须包含：

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
abilityGroupId: mouse-click
childCapabilityId: required
sourceAbilityGroupId: required
sourceChildCapabilityId: optional
inputRef: required
sourceRef: required
outputRef: required-if-success
diagnosticPayloadRef: required-if-not-success
attemptRef: required
actionExecutionRef: required-if-success
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
coordinateSpace: browserViewport | desktopScreen
sourceCoordinateSpace: browserViewport | desktopScreen
requestedExecutionSpace: browserViewport | desktopScreen
normalizedCoordinateSpace: browserViewport | desktopScreen
requestedCoordinate: required-if-success
executableCoordinate: required-if-success
bounds: required
sourceBounds: optional
targetBounds: required
button: required
clickCount: required
idempotencyKey: required
idempotencyDecision: required
runLockId: optional
cancellationTokenRef: optional
resumeCheckpointRef: optional
primitiveCallId: optional
primitiveExecutionRef: required-if-success
primitivePortKind: required
primitiveStartedAt: optional
primitiveEndedAt: optional
timeoutMs: required
primitiveTimeoutMs: required
maxDurationMs: required
timeoutDecision: required
abortDecision: required
circuitBreakerState: required
clickSuppressedReason: optional
postActionVerificationRequired: true-if-success
postActionVerificationHandoffRef: required-if-success
verificationRefPolicy: pav-handoff-required
preActionDecision: required
policyDecision: required
policyDecisionReason: optional
geometryDecision: required
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
success proof without primitiveExecutionRef
success proof without PAV handoff
failed/review proof with executableCoordinate
```

---

## 14. Child Capabilities

| child | coordinateSpace | 作用 |
|---|---|---|
| click-browser-coordinate | browserViewport | 执行浏览器视口坐标点击 |
| click-desktop-coordinate | desktopScreen | 执行桌面屏幕坐标点击 |

每个 child 必须：

```txt
have contract/schema/implementation
走 unified Mouse Click runtime
不得直接调用 primitive port
不得 build final proof/result
不得 import sibling implementation
不得 import BrowserController
不得 return boolean
```

禁止新增：

```txt
click-left-point
click-right-point
double-click-left-point
```

button / clickCount 是输入参数，不是子能力。

---

## 15. 与其它能力组边界

### Visual Target

提供目标候选，不提供 executable truth。
Mouse Click 不直接消费 raw Visual Target clickPoint。

### Geometry Guard

提供 guardDecision=allow 和 normalizedClickPoint。
Mouse Click 只能消费 Geometry Guard allow。

### PAV

验证点击后结果。
Mouse Click 只生成 handoff。

### Forensics

持久化最终 action log。
Mouse Click 不写 final actionLogRef。

### BrowserController

只能在 primitive adapter 内部。
不得出现在 public contract。

---

## 16. 执法系统

必须存在：

```txt
scripts/audit/domains/mouse-click-capability/manifest.json
scripts/audit/domains/mouse-click-capability/inspector.ts
scripts/audit/domains/mouse-click-capability/run-inspector.ts
scripts/audit/domains/mouse-click-capability/negative-proof-harness.ts
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
2. Public contract is click-only and primitive-port based.
3. Input schema includes full chain fields.
4. Geometry Guard proof requires guardDecision=allow.
5. Source coordinate/source target/source evidence policy enforced.
6. Right/double/desktop click policy enforced.
7. No coordinate generation/remapping/scaleMapping inside Mouse Click.
8. Primitive click only through MouseClickPrimitivePort.
9. AbortSignal/timeout gate enforced.
10. Idempotency gate enforced.
11. No retry/fallback path.
12. Success requires PAV handoff.
13. Result/proof/input chain parity.
14. Children use unified runtime.
15. No forbidden imports/symbols/business verbs.
16. External platform/runtime cannot bypass Mouse Click.
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
double click without allowDoubleClick returns success
right click without allowRightClick returns success
desktop click without desktop approval returns success
remove AbortSignal
add retry loop
add scaleMapping to Mouse Click runtime
add browserActionId to result
success without postActionVerificationHandoffRef
proof runId from attemptRef/child
proof missing activationSnapshotRef
child calls primitive port directly
child returns boolean
platform adapter directly calls primitive click
capability-check.ts added
remove negative proof invocation
turn P0 into warning-only
```

---

## 19. READY 标准

Mouse Click READY 仅当：

```txt
Mouse Click 法案 / 施工图 / inspector / generated / runner 口径一致
ALL active law enforcement PASS
CI-FULL PASS
input chain fields complete
Geometry Guard allow proof required
no coordinate remapping/generation inside Mouse Click
right/double/desktop policies enforced
primitive click only through MouseClickPrimitivePort
AbortSignal/timeout/idempotency enforced
success requires actionExecutionRef + primitiveExecutionRef + PAV handoff
result/proof/input chain parity
children narrow primitive bindings
external platform/runtime cannot bypass Mouse Click
negative proof PASS
```

---

## 20. 漂移信号

```txt
Mouse Click proof lacks activationSnapshotRef
Mouse Click runId from attemptRef/child
Mouse Click accepts raw Visual Target clickPoint
Mouse Click contains scaleMapping
Mouse Click result exposes browserActionId
Mouse Click success lacks postActionVerificationHandoffRef
Mouse Click writes finalActionLogRef
Mouse Click imports BrowserController
platform adapter directly clicks browser
retry/fallback appears
verify script becomes release gate
```

---

## 21. 最终原则

```txt
Visual Target 说：目标在哪里。
Geometry Guard 说：坐标能不能安全执行。
Mouse Click 说：我去点。
PAV 说：点完是否成功。
Forensics 说：我把证据链存下来。
这五者不能混。
```
