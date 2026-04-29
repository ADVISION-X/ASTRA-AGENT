# GrassEye Page State 页面状态感知能力组施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 13 个 active ability groups 与 4 个 active support laws，不重新分配主权。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 定位

Page State Ability Group 是当前页面状态感知能力组。
它只回答一个问题：当前页面此刻是什么状态。

## 能力组接口

总调度只能调用 PageStateAbilityGroup.execute(input)。
总调度不得直接调用子能力。

## 子能力

- detect-login-state
- detect-safety-page
- detect-feed-ready
- detect-video-stable
- detect-comment-panel-state
- detect-modal-overlay-state
- detect-page-abnormality
- detect-platform-page-kind

## 统一 contract

- PageStateAbilityInput
- PageStateAbilityResult
- PageStateType
- PageStateFailureReason
- PageStateObservationRef
- PageStateConfidencePolicy
- PageStatePolicy

## 输入字段

- currentUrl
- currentTitle
- browserLoginState
- observationRefs
- sourceEvidenceRefs
- requestedBy
- sessionId
- roundId
- videoVisitId
- confidencePolicy
- statePolicy

## 输出字段

- status
- pageStateType
- stateSummary
- confidence
- evidenceRefs
- observationRefs
- failureReason
- reviewRequiredReason
- dataQualityFlags
- debugLogRef

## PageStateType 枚举

- unknown
- logged_in
- login_required
- review_required
- safety_page
- feed_ready
- feed_not_ready
- video_stable
- video_unstable
- comments_panel_open
- comments_panel_closed
- modal_overlay_present
- modal_overlay_absent
- page_abnormal
- page_normal
- platform_feed
- platform_video_page
- platform_unknown

## 禁止职责

- 不打开页面
- 不点击
- 不滚动
- 不截图
- 不调用 AI
- 不找视觉目标
- 不做动作后验证
- 不读 DOM/BOM
- 不采集评论
- 不判断产品
- 不决定下一步

## 调用边界

- Browser Session 提供当前 real Chrome 会话快照。
- Screenshot 只提供图像证据，不裁决页面状态。
- AI 只能提供外部观察结果，不拥有页面状态真相。
- Post-action Verification 只回答动作是否达成预期，不回答页面此刻是什么状态。
- Platform Action / Open / Agent Runtime 只能请求 Page State，不得内联拥有页面状态真相。
- Orchestration 根据 Page State 结果决定是否继续、停止或人工接管。

## Verify 禁令

- 不得新增 scripts/verify/verify-page-state-capabilities.ts
- 不得新增 capability-check.ts
- Page State 的执法只能通过 owner inspector 和 audit build 完成

## 文件路径

canonical root 必须是：

- src/capabilities/page-state/

不得落到：

- src/features/platform-action/
- src/lib/mission-runtime/
- src/lib/browser/
- src/lib/local-ai/
- src/capabilities/open/
- src/capabilities/post-action-verification/