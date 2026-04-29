# GrassEye Mouse Scroll 能力组施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 13 个 active ability groups 与 4 个 active support laws，不重新分配主权。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 1. 定位

Mouse Scroll Ability Group 是鼠标滚动执行能力组。
它只执行滚动，不判断滚动结果，不做几何映射。

## 2. 能力组接口

总调度只能调用 MouseScrollAbilityGroup.execute(input)。
总调度不得直接调用子能力。

## 3. 子能力

- scroll-browser-viewport
- scroll-desktop-screen
- scroll-region

以下内容不是子能力：

- scroll-one-page
- scroll-two-pages
- scroll-next-video
- scroll-until-found

它们全部属于 input 参数、preset 或 orchestration intent。

## 4. 统一 contract

- MouseScrollAbilityInput
- MouseScrollAbilityResult
- MouseScrollDirection
- MouseScrollMagnitude
- MouseScrollCoordinateSpace
- MouseScrollFailureReason

## 5. 滚动参数

- direction: up | down | left | right
- magnitude: small | halfPage | onePage | twoPages | customDelta
- deltaX
- deltaY
- repeat
- coordinateSpace: browserViewport | desktopScreen
- geometryGuardRef
- guardDecision: allow
- anchorPoint
- regionRef / sourceEvidenceRef if region-based
- requestedBy
- purpose
- safetyPolicy

## 6. 禁止职责

- 不截图
- 不找坐标
- 不点击
- 不调用 AI
- 不读 DOM/BOM
- 不进入评论
- 不判断是否到下一条视频
- 不决定下一步
- 不做滚动后视觉验证
- 不处理 imageEvidence 坐标执行
- 不处理 scaleMapping
- 不输出 fallbackUsed
- 不输出 raw browserAction

## 7. 调用边界

- Orchestration Ability Group 决定为什么滚动。
- Geometry Guard Ability Group 负责验证并归一化 anchorPoint / region。
- Mouse Scroll Ability Group 只执行滚动。
- Post-action Verification Ability Group 判断滚动后是否成功换视频。
- Screenshot Ability Group 提供滚动前后截图。
- PlatformAction 只能作为调用者，不拥有滚动策略。
- BrowserController 只做底层 scroll primitive，并通过 MouseScrollPrimitivePort 注入。

## 8. 文件路径

canonical root：

- src/capabilities/mouse-scroll/

不得落到：

- src/features/platform-action/
- src/lib/mission-runtime/
- src/lib/browser/
- src/lib/local-ai/

## 9. 统一输入安全边界

- direction 必须明确。
- magnitude 必须明确。
- customDelta 必须包含有限数字 deltaX / deltaY。
- repeat 必须是有限正整数，并有上限。
- coordinateSpace 必须明确。
- region-based scroll 必须有 sourceEvidenceRef / sourceTargetRef。
- geometryGuardRef 必须存在。
- guardDecision 必须等于 allow。
- anchorPoint 必须是有限数字并在 bounds 内。
- bounds.width / bounds.height 必须是有限正数。
- region 模式必须有 region 和 regionRef。
- operator manual 缺审批时只能 review_required。
- 必须有 requestedBy。
- 必须有 purpose。
- 必须有 safetyPolicy。
- 禁止无界滚动。
- 禁止隐藏循环直到某物出现。
- 禁止 scroll-until-found。
- 禁止 fallback。

## 10. Magnitude 默认值

- small = 300px
- halfPage = 0.5 viewport height
- onePage = 0.85 viewport height
- twoPages = 1.7 viewport height
- repeat max = 3

这些数值只允许定义在 shared/scroll-magnitude.ts。

## 11. Mouse Scroll 运行证明

每次滚动结果必须保留：

- abilityGroupId
- childCapabilityId
- sessionId
- roundId
- videoVisitId
- scrollExecutionRef
- primitiveExecutionRefs
- geometryGuardRef
- requestedBy
- purpose
- direction
- magnitude
- deltaX
- deltaY
- coordinateSpace
- anchorPoint
- sourceEvidenceRef
- sourceTargetRef
- startedAt
- endedAt
- durationMs
- status
- failureReason
- runtimeProof

## 12. 迁移裁决

- 平台适配层不得直接调用 browser scroll primitive。
- agent runtime 不得直接调用 browser scroll primitive。
- BrowserController 保留低层 primitive，但不持有 scroll strategy。
- 所有受治理滚动统一走 Mouse Scroll Ability Group。
- vertical / horizontal 不是子能力，而是 direction。
- onePage / twoPages 不是子能力，而是 magnitude。
- scroll-next-video 不是子能力，而是 Orchestration intent。