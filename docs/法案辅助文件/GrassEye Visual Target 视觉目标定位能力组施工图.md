# GrassEye Visual Target 视觉目标定位能力组施工图

## 1. 定位

Visual Target Ability Group 是视觉目标定位与目标结果标准化能力组。
它只负责目标定位结果，不负责 AI 推理和点击。

## 2. 能力组接口

总调度只能调用 VisualTargetAbilityGroup.execute(input)。
总调度不得直接调用子能力。

## 3. 子能力

- detect-comments-button
- detect-not-interested-button
- detect-next-video-region
- detect-like-button
- detect-save-button
- detect-comments-panel
- detect-close-comments-button
- detect-metric-like-count
- detect-metric-comment-count

## 4. 统一 contract

- VisualTargetAbilityInput
- VisualTargetAbilityResult
- VisualTargetType
- VisualTargetCandidate
- VisualTargetBbox
- VisualTargetClickPoint
- VisualTargetCoordinateSpace
- VisualTargetFailureReason

## 5. 输入字段

- targetType
- sourceScreenshotEvidenceRef
- coordinateSpace
- sourceAiResultRef
- candidates
- requestedBy
- sessionId
- roundId
- videoVisitId
- confidencePolicy
- selectionPolicy
- dataQualityPolicy

## 6. 输出字段

- status
- targetType
- bbox
- clickPoint
- confidence
- coordinateSpace
- sourceScreenshotEvidenceRef
- sourceAiResultRef
- sourceCandidateRef
- requiresGeometryGuard
- failureReason
- debugLogRef

## 7. 禁止职责

- 不截图
- 不调用 AI
- 不点击
- 不滚动
- 不读 DOM 或 BOM
- 不采集评论
- 不判断产品视频
- 不做动作后验证
- 不决定下一步

## 8. 调用边界

- Screenshot 提供 sourceScreenshotEvidenceRef。
- AI 提供 target candidates 或 sourceAiResultRef。
- Page State 负责当前页面此刻的状态归纳，不负责目标定位。
- Visual Target 标准化目标。
- Geometry Guard 校验坐标能否执行。
- Mouse Click 执行点击。
- Post-action Verification 验证点击结果。
- PlatformAction 只能作为消费者，不拥有 target truth。

## 9. 文件路径

Visual Target Ability Group canonical root 固定为 src/capabilities/visual-target/。
不得落到 src/features/platform-action/。
不得落到 src/lib/mission-runtime/。
不得落到 src/lib/local-ai/。
不得落到 src/lib/browser/。

## 10. 施工图主权

本文件是 Visual Target 能力组唯一主施工图。
其他文档只能引用本文件，不得重复定义 Visual Target 规则。
