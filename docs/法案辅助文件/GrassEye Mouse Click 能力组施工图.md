# GrassEye Mouse Click 能力组施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 13 个 active ability groups 与 4 个 active support laws，不重新分配主权。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 1. 定位

Mouse Click Ability Group 是鼠标点击执行能力组。
它只执行已经被 Geometry Guard 批准的点击，不生成坐标，不映射坐标。

## 2. 能力组接口

总调度只能调用 MouseClickAbilityGroup.execute(input)。
总调度不得直接调用子能力。

## 3. 子能力

- click-browser-coordinate
- click-desktop-coordinate

## 4. 统一 contract

- MouseClickAbilityInput
- MouseClickAbilityResult
- MouseClickCoordinate
- MouseClickPrimitivePort
- MouseClickFailureReason
- MouseClickRuntimeProof

## 5. 禁止职责

- 不截图
- 不找坐标
- 不调用 AI
- 不读 DOM/BOM
- 不进入评论
- 不判断产品
- 不决定下一步
- 不做点击后视觉验证

## 6. 调用边界

- Visual Target Ability Group 负责产生 bbox / clickPoint。
- Geometry Guard Ability Group 负责验证并归一化执行坐标。
- Mouse Click Ability Group 只消费 Geometry Guard allow 的 browserViewport / desktopScreen 坐标。
- Post-action Verification Ability Group 负责点击后的结果验证。
- PlatformAction 只能作为调用者，不拥有点击策略。
- BrowserController 只做底层 click primitive，并通过 MouseClickPrimitivePort 注入。

## 7. 文件路径

canonical root：

- src/capabilities/mouse-click/

不得落到：

- src/features/platform-action/
- src/lib/mission-runtime/
- src/lib/browser/
- src/lib/local-ai/

## 8. 统一输入安全边界

- x/y 必须是有限数字。
- coordinateSpace 只能是 browserViewport 或 desktopScreen。
- 坐标不得越界。
- 必须有 requestedBy。
- 必须有 purpose。
- 必须有 safetyPolicy。
- 必须有 geometryGuardRef。
- guardDecision 必须等于 allow。
- 无 sourceEvidenceRef 或 sourceTargetRef 时，只有 operatorManualApprovalRef 存在且政策允许时才能进入 review_required 或执行。
- right click 默认禁止，除非 allowRightClick = true。
- double click 默认禁止，除非 allowDoubleClick = true。
- Mouse Click 内部不允许 retry，不允许 fallback。

## 9. Mouse Click 运行证明

每次点击结果必须保留：

- abilityGroupId
- childCapabilityId
- sessionId
- roundId
- videoVisitId
- actionExecutionRef
- primitiveExecutionRef
- geometryGuardRef
- x
- y
- coordinateSpace
- button
- clickCount
- sourceEvidenceRef
- sourceTargetRef
- startedAt
- endedAt
- durationMs
- status
- failureReason
- debugLogRef
- runtimeProof

## 10. 迁移裁决

- 平台适配层不得直接调用 browser click primitive。
- agent runtime 不得直接调用 browser click primitive。
- BrowserController 保留低层 primitive，但不得出现在 Mouse Click public contract。
- 所有受治理点击统一走 Mouse Click Ability Group。
- button / clickCount 是输入参数，不是子能力。
- imageEvidence、scaleMapping、fallbackUsed、raw browserAction、capability-check 全部退出 Mouse Click 正向代码。