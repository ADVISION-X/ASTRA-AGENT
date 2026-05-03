# GrassEye Geometry Guard 几何安全守卫能力组施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-GEOMETRY-GUARD-BLUEPRINT-FINAL
owner: geometry-guard-capability
documentType: construction-blueprint
lawAuthority: module-geometry-guard-capability.instructions.md
architecturePhase: Static Capability Package Architecture
status: active
replace:
  - docs/法案辅助文件/GrassEye Geometry Guard 几何安全守卫能力组施工图.md
mustNotCreate:
  - new lawId
  - new ability group
  - visual-action owner
  - browser geometry owner
  - action planner owner
  - platform action geometry owner
```

本施工图是 `module-geometry-guard-capability.instructions.md` 的建设级落地映射。
本施工图不新增 lawId，不修改冻结法案，不重新分配主权。
若本文档与 Geometry Guard 法案冲突，以 Geometry Guard 法案为最高权威。

---

## 1. 定位

Geometry Guard 是几何安全守卫能力组。

它只回答：

```txt
这个 bbox / clickPoint / scaleMapping / coordinateSpace 是否能安全归一化到执行空间？
```

它负责：

```txt
坐标空间合法性
bbox 完整性
clickPoint 合法性
scaleMapping 合法性
aiInput → viewport 映射
regionCrop → source 映射
browserViewport bounds 校验
desktopScreen bounds 校验
输出 guardDecision
输出 normalizedClickPoint / normalizedBbox
输出 geometryGuardRef
输出 runtimeProof
```

它不负责：

```txt
截图
找目标
AI 推理
点击
滚动
文本输入
打开页面
动作计划
业务动作语义
动作后验证
证据最终落盘
地图分支
```

一句话：

```txt
Geometry Guard 是“这个坐标能不能安全执行”的门禁，不是动作计划器，也不是点击执行器。
```

---

## 2. 故事链路位置

```txt
Screenshot / AI / Page State
→ Visual Target
→ Geometry Guard
→ Mouse Click / Mouse Scroll
→ Post-action Verification
→ Forensics
```

边界关系：

```txt
Visual Target 标准化候选目标，但不决定 safeToClick。
Geometry Guard 判断坐标是否能进入 browserViewport / desktopScreen。
Mouse Click / Mouse Scroll 只能消费 Geometry Guard allow 后的 normalized geometry。
PAV 验证动作后的结果。
Forensics 保存整条链路。
```

---

## 3. 标准包结构

```txt
src/capabilities/geometry-guard/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── schema-foundation.ts
├── schema-input.ts
├── schema-output.ts
├── schema-result.ts
├── schema-runtime-proof.ts
├── registry.ts
├── index.ts
├── ports/
│   └── geometry-clock-port.ts
├── shared/
│   ├── geometry-failure.ts
│   ├── geometry-policy.ts
│   ├── geometry-proof.ts
│   ├── geometry-result.ts
│   ├── geometry-transform.ts
│   └── geometry-types.ts
├── runtime/
│   ├── geometry-guard-executor.ts
│   ├── geometry-input-gate.ts
│   ├── geometry-input-stages.ts
│   ├── coordinate-space-gate.ts
│   ├── bounds-gate.ts
│   ├── click-safety-gate.ts
│   ├── scale-mapping-gate.ts
│   ├── geometry-transformer.ts
│   ├── geometry-transform-stage.ts
│   ├── geometry-result-builder.ts
│   ├── geometry-proof-builder.ts
│   └── geometry-dispatch-failure.ts
└── children/
    ├── validate-coordinate-space/
    ├── validate-bbox-integrity/
    ├── validate-click-point/
    ├── validate-scale-mapping/
    ├── map-ai-input-to-viewport/
    ├── map-region-to-source/
    ├── validate-browser-viewport-bounds/
    └── validate-desktop-screen-bounds/
```

禁止：

```txt
capability-check.ts
verify-*.ts
plan-coordinate-action
calibrate-browser-geometry
verify-browser-geometry
compat/legacy/bridge geometry runtime
```

---

## 4. Public Contract

Public interface 只允许：

```ts
interface GeometryGuardAbilityGroup {
  listChildCapabilityIds(): GeometryGuardChildCapabilityId[];
  execute(input: GeometryGuardAbilityInput): Promise<GeometryGuardAbilityResult>;
}
```

允许 public exports：

```txt
createGeometryGuardAbilityGroup
GEOMETRY_GUARD_ABILITY_GROUP_ID
GeometryGuardAbilityInput
GeometryGuardAbilityResult
GeometryGuardRuntimeProof
GeometryGuardCoordinateSpace
GeometryGuardExecutionSpace
GeometryGuardScaleMapping
GeometryGuardBoundingBox
GeometryGuardClickPoint
GeometryGuardDecision
GeometryGuardFailureReason
GeometryGuardSafetyPolicy
GeometryGuard schemas
```

禁止 public exports / imports：

```txt
BrowserController
PlatformActionType
old VisualAction types
Mouse Click execution types
Mouse Scroll execution types
raw browser session types
actionPlan
fallbackMode
requestedActionType
target-action allowlists
```

---

## 5. Input Model

`GeometryGuardAbilityInput` 必须包含：

```yaml
GeometryGuardAbilityInput:
  abilityGroupId: geometry-guard
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
  inputRef: required
  sourceRef: required
  sourceScreenshotEvidenceRef: required-if-image-derived
  sourceTargetRef: required-if-target-derived
  sourceAiResultRef: required-if-ai-derived
  sourcePageStateProofRef: optional
  sourceVisualTargetResultRef: required-if-visual-target-derived
  sourceGeometryHandoffRef: optional
  sourceCoordinateSpace: required
  requestedExecutionSpace: required
  bbox: optional
  clickPoint: optional
  imageSize: optional
  viewportSize: optional
  screenSize: optional
  deviceScaleFactor: required-if-desktop-screen
  scaleMapping: required-if-derived-coordinate
  safetyPolicy: required
  dataQualityFlags: list
  idempotencyKey: required
```

缺失以下字段不得 allow：

```txt
stepId
capabilityCallId
activationSnapshotRef
nerveBusEnvelopeId
mapPackageVersion
selectedMapVersion
inputRef
sourceRef
idempotencyKey
```

Invalid input failure 必须有：

```txt
receivedShapeHash
diagnosticPayloadRef
runtimeProof
```

---

## 6. Coordinate Space

允许 coordinate spaces：

```txt
browserViewport
desktopScreen
imageEvidence
aiInput
regionCrop
contactSheet
```

允许 execution spaces：

```txt
browserViewport
desktopScreen
```

规则：

```txt
browserViewport → browserViewport 可直接校验 bounds
desktopScreen → desktopScreen 必须有 deviceScaleFactor
imageEvidence → executionSpace 必须经 scaleMapping
aiInput → executionSpace 必须经 scaleMapping
regionCrop → source/executionSpace 必须经 scaleMapping
contactSheet 永不可直接执行
```

禁止：

```txt
contactSheet → browserViewport allow
contactSheet → desktopScreen allow
aiInput → browserViewport without scaleMapping
regionCrop → executionSpace without source mapping
desktopScreen without deviceScaleFactor
```

---

## 7. Geometry Validation Rules

bbox：

```txt
x finite
y finite
width finite positive
height finite positive
inside source bounds when source bounds available
```

clickPoint：

```txt
x finite
y finite
inside bbox when clickPoint is required
inside target bounds after normalization
outside safety margin failure if policy says so
```

scaleMapping：

```txt
sourceCoordinateSpace matches source
targetCoordinateSpace matches requested execution
sourceWidth/sourceHeight finite positive
targetWidth/targetHeight finite positive
scaleX/scaleY finite positive
cropOffsetX/cropOffsetY finite and non-negative
scaleMappingRef required when transformed from evidence
```

禁止：

```txt
silent clamp
guessing missing deviceScaleFactor
using action type to decide geometry verdict
```

---

## 8. Runtime Pipeline

Geometry Guard executor 必须固定：

```txt
input schema gate
→ child registry gate
→ source evidence gate
→ coordinate space gate
→ bbox integrity gate
→ click point gate
→ scale mapping gate
→ bounds gate
→ transform gate
→ execution-space gate
→ output boundary gate
→ proof builder
→ result builder
```

当前源码已有 coordinate / bounds / scale / transform 等基础门禁，后续必须补齐 source evidence / output boundary / chain parity。

禁止：

```txt
child direct final result
child direct proof
child raw boolean
executor skipping scale mapping gate
executor skipping bounds gate
success without proof
```

---

## 9. Child Capabilities

| child | 作用 |
|---|---|
| validate-coordinate-space | 校验 source/execution coordinate space 是否允许 |
| validate-bbox-integrity | 校验 bbox 有限、正尺寸、边界 |
| validate-click-point | 校验 clickPoint 有限、在 bbox 内、安全边距 |
| validate-scale-mapping | 校验 scaleMapping |
| map-ai-input-to-viewport | aiInput 映射到 browserViewport |
| map-region-to-source | regionCrop 映射回 source/execution space |
| validate-browser-viewport-bounds | 校验 browserViewport 可执行边界 |
| validate-desktop-screen-bounds | 校验 desktopScreen 可执行边界 |

每个 child 必须：

```txt
有 contract/schema/implementation
走 unified Geometry Guard runtime
不得 import sibling implementation
不得 import BrowserController / Screenshot / AI / VisualTarget / Mouse / PAV / Forensics
不得 build final result/proof
不得返回 boolean
```

---

## 10. Result Model

`GeometryGuardAbilityResult` 必须包含：

```yaml
status: success | failed | review_required
abilityGroupId: geometry-guard
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
geometryGuardRef: required
guardDecision: allow | block | review_required
output: required-if-allow
normalizedCoordinateSpace: optional
normalizedClickPoint: optional
normalizedBbox: optional
appliedScaleMapping: optional
sourceScreenshotEvidenceRef: optional
sourceTargetRef: optional
sourceAiResultRef: optional
sourcePageStateProofRef: optional
sourceVisualTargetResultRef: optional
failureReason: required-if-failed
reviewRequiredReason: required-if-review_required
diagnosticPayloadRef: required-if-not-allow
debugLogRef: required
runtimeProof: required
policyDecision: required
sourceEvidenceDecision: required
coordinateSpaceDecision: required
boundsDecision: required
scaleDecision: required
transformDecision: required
executionSpaceDecision: required
outputBoundaryDecision: required
dataQualityFlags: list
statusMessage: required
startedAt: required
endedAt: required
durationMs: required
```

Allow success：

```txt
output exists
outputRef exists
normalizedCoordinateSpace exists
normalizedClickPoint exists when requested execution needs click
guardDecision = allow
runtimeProof exists
critical data quality flags absent
```

Block/review/failure：

```txt
output = null
diagnosticPayloadRef exists
reason exists
runtimeProof exists
```

---

## 11. Runtime Proof

`GeometryGuardRuntimeProof` 必须包含：

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
abilityGroupId: geometry-guard
childCapabilityId: required
sourceAbilityGroupId: required
sourceChildCapabilityId: optional
inputRef: required
sourceRef: required
outputRef: required-if-allow
diagnosticPayloadRef: required-if-not-allow
sourceScreenshotEvidenceRef: optional
sourceTargetRef: optional
sourceAiResultRef: optional
sourcePageStateProofRef: optional
sourceVisualTargetResultRef: optional
sourceCoordinateSpace: required
requestedExecutionSpace: required
normalizedCoordinateSpace: optional
sourceBounds: optional
targetBounds: optional
bboxBefore: optional
bboxAfter: optional
clickPointBefore: optional
clickPointAfter: optional
scaleMappingRef: optional
appliedScaleMappingHash: optional
deviceScaleFactor: optional
idempotencyKey: required
sourceEvidenceDecision: required
coordinateSpaceDecision: required
policyDecision: required
boundsDecision: required
scaleDecision: required
transformDecision: required
executionSpaceDecision: required
outputBoundaryDecision: required
startedAt: required
endedAt: required
durationMs: required
status: required
guardDecision: required
failureReason: optional
reviewRequiredReason: optional
dataQualityFlags: list
receivedShapeHash: required-if-invalid-input
```

禁止：

```txt
runtimeProof:null
runId from sessionId/child
missionId=sessionId
missing activationSnapshotRef
missing capabilityCallId
allow proof without outputRef
failed proof with outputRef
```

---

## 12. Downstream Boundary

Mouse Click / Mouse Scroll 只能消费：

```txt
geometryGuardRef
guardDecision=allow
normalizedCoordinateSpace
normalizedClickPoint or normalized region
runtimeProof
```

禁止下游：

```txt
重新做 scaleMapping
重新做 imageEvidence remapping
从 raw AI bbox 执行
从 Visual Target raw clickPoint 执行
从 contactSheet 执行
绕过 Geometry Guard
```

---

## 13. 与其它能力组边界

### Screenshot

提供 source image / region / ai_input / contactSheet 与 scaleMapping。
不决定 executable geometry。

### Visual Target

提供 non-executable target handoff。
不决定 safeToClick。

### Mouse Click / Mouse Scroll

执行 Geometry Guard allow 后的 normalized geometry。
不得自己重算映射。

### PAV

验证动作结果。
不拥有 geometry truth。

### BrowserController

不是 Geometry Guard 依赖。
Geometry Guard 不直接操作浏览器。

---

## 14. 执法系统

必须存在：

```txt
scripts/audit/domains/geometry-guard-capability/manifest.json
scripts/audit/domains/geometry-guard-capability/inspector.ts
scripts/audit/domains/geometry-guard-capability/run-inspector.ts
scripts/audit/domains/geometry-guard-capability/negative-proof-harness.ts
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

## 15. Inspector 必查

```txt
1. Law file is machine-blocking.
2. Public contract is geometry-only and native.
3. Input schema includes full chain fields.
4. Result/proof/input chain parity.
5. Coordinate spaces stay distinct.
6. aiInput requires scaleMapping before allow.
7. contactSheet cannot allow executable geometry.
8. regionCrop requires source mapping.
9. desktopScreen requires deviceScaleFactor.
10. no silent clamp.
11. output includes guardDecision and normalized geometry.
12. children use unified runtime.
13. no BrowserController / PlatformActionType / old VisualAction.
14. no business verbs / action plans / fallbackMode / allowlists.
15. Mouse Click / Mouse Scroll cannot bypass Geometry Guard.
16. ALL active laws in registry/matrix/audit-plan/runner.
17. negative proof executed.
```

---

## 16. Negative Proof 最低清单

必须 fail → rollback → pass：

```txt
manual-first enforcement reintroduced
remove capabilityCallId from input
remove activationSnapshotRef from input
remove nerveBusEnvelopeId from input
aiInput without scaleMapping returns allow
contactSheet returns allow into browserViewport
missing deviceScaleFactor returns allow for desktopScreen
silent clamp introduced
clickPoint outside bbox returns allow
result adds fallbackMode
result adds requestedActionType
proof runId from sessionId/child
proof missing activationSnapshotRef
allow without outputRef
failed with output
child imports BrowserController
child returns boolean
Mouse Click remaps Visual Target raw clickPoint
Mouse Scroll remaps aiInput
capability-check.ts added
remove negative proof invocation
turn P0 into warning-only
```

---

## 17. READY 标准

Geometry Guard READY 仅当：

```txt
Geometry Guard 法案 / 施工图 / inspector / generated / runner 口径一致
ALL active law enforcement PASS
CI-FULL PASS
input chain fields complete
source refs / idempotency complete
aiInput / contactSheet / regionCrop rules enforced
desktopScreen deviceScaleFactor enforced
no silent clamp
allow result has normalized geometry and outputRef
result/proof/input chain parity
Mouse Click / Mouse Scroll cannot bypass Geometry Guard
children narrow geometry gates
negative proof PASS
```

---

## 18. 漂移信号

```txt
Geometry Guard 出现 actionPlan / fallbackMode
Geometry Guard 出现 open_comments / continue_next
Geometry Guard imports BrowserController
Geometry Guard proof lacks activationSnapshotRef
Geometry Guard runId from sessionId/child
contactSheet returns allow
aiInput without scaleMapping returns allow
Mouse Click recalculates bbox/clickPoint
verify script becomes release gate
```

---

## 19. 最终原则

```txt
Visual Target 说：目标在哪里。
Geometry Guard 说：坐标能不能安全执行。
Mouse Click 说：我去点。
PAV 说：点完是否成功。
这四者不能混。
```
