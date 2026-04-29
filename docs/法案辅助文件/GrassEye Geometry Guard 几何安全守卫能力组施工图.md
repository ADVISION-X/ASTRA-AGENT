# GrassEye Geometry Guard 几何安全守卫能力组施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 13 个 active ability groups 与 4 个 active support laws，不重新分配主权。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 定位
Geometry Guard 是几何安全守卫能力组。

它不是动作计划器，不是 BrowserController 包装层，不是 Visual Target 薄检查器。
它只回答：

- 坐标空间是否合法
- bbox 是否完整且可执行
- clickPoint 是否合法
- scaleMapping 是否存在且可用
- 坐标是否能从 source space 映射到 execution space
- 坐标是否在 viewport 或 screen bounds 内
- 最终 guardDecision 是 allow、block 还是 review_required
## 主职责

- validate-coordinate-space
- validate-bbox-integrity
- validate-click-point
- validate-scale-mapping
- map-ai-input-to-viewport
- map-region-to-source
- validate-browser-viewport-bounds
- validate-desktop-screen-bounds
## 调用边界

- Screenshot 提供 source screenshot、region crop、ai_input、contact sheet 与 scaleMapping 证据
- Visual Target 提供标准化 bbox 与 clickPoint
- Geometry Guard 校验并标准化 geometry
- Mouse Click / Mouse Scroll 只消费 Geometry Guard 已批准的 executable geometry
- Mouse Scroll 只消费 Geometry Guard 已批准的 executable anchorPoint / regionRef，不得重做 imageEvidence 或 scaleMapping 映射
- Post-action Verification 只验证动作结果，不拥有几何真相
## public contract

Geometry Guard public contract 至少包含：

- GeometryGuardAbilityInput
- GeometryGuardAbilityResult
- GeometryCoordinateSpace
- GeometryScaleMapping
- GeometryBbox
- GeometryClickPoint
- GeometryGuardFailureReason
- GeometryGuardSafetyPolicy
- Geometry runtime proof
输入必须支持：

- sourceCoordinateSpace
- requestedExecutionSpace
- bbox
- clickPoint
- imageSize
- viewportSize
- screenSize
- deviceScaleFactor
- scaleMapping
- sourceScreenshotEvidenceRef
- sourceTargetRef
- sourceAiResultRef
结果必须支持：

- guardDecision: allow | block | review_required
- normalizedCoordinateSpace
- normalizedClickPoint
- normalizedBbox
- appliedScaleMapping
- failureReason
- dataQualityFlags
- runtimeProof
## 硬规则

- coordinateSpace 必须明确
- bbox 的 x、y、width、height 必须是有限数字
- bbox.width 和 bbox.height 必须大于 0
- clickPoint 必须是有限数字且位于 bbox 内
- aiInput 坐标没有 scaleMapping 时不得 allow
- contactSheet 坐标不得直接执行到 browserViewport 或 desktopScreen
- regionCrop 坐标没有回源映射时不得 allow
- requestedExecutionSpace 是 browserViewport 或 desktopScreen 时必须输出 normalizedClickPoint
- 不允许 silent clamp
- 不允许 fallbackMode
- 不允许 action allowlist
## 禁止职责

- 不截图
- 不找目标
- 不点击
- 不滚动
- 不做动作后验证
- 不知道 open_comments、continue_next、click_not_interested、capture_video_region、like_or_save_candidate
- 不 import BrowserController
- 不 import PlatformActionType
- 不 import old VisualTarget type
- 不保留 plan-coordinate-action
- 不保留 capability-check 或 verify 作为验收链
## canonical root

- src/capabilities/geometry-guard
- scripts/audit/domains/geometry-guard-capability
- .github/instructions/cursor-rules/modules/module-geometry-guard-capability.instructions.md
## 目标结构

- contract.ts
- ability-group.ts
- registry.ts
- index.ts
- shared/coordinate-space.ts
- shared/scale-mapping.ts
- shared/bounds-utils.ts
- shared/guard-result.ts
- shared/failure.ts
- shared/runtime-proof.ts
- children/validate-coordinate-space/implementation.ts
- children/validate-bbox-integrity/implementation.ts
- children/validate-click-point/implementation.ts
- children/validate-scale-mapping/implementation.ts
- children/map-ai-input-to-viewport/implementation.ts
- children/map-region-to-source/implementation.ts
- children/validate-browser-viewport-bounds/implementation.ts
- children/validate-desktop-screen-bounds/implementation.ts
## 验收信号

建对表现：

- Geometry Guard 只输出 guardDecision 和 normalized geometry
- BrowserController、PlatformActionType、old VisualTarget 退出 Geometry Guard public contract
- contactSheet 和 aiInput 坐标不能绕过 scaleMapping 直接执行
- audit inspector 是唯一执法入口

漂移信号：

- 重新出现 plan-coordinate-action
- 重新出现 actionPlan、fallbackMode、TARGET_ACTION_ALLOWLIST
- Geometry Guard 直接读 BrowserController
- verify 或 capability-check 被写成能力验收
