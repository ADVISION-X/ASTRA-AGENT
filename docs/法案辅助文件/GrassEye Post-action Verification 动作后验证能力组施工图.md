# GrassEye Post-action Verification 动作后验证能力组施工图

## 定位

Post-action Verification Ability Group 是动作执行后的结果裁决能力组。
它判断动作是否达成预期，不执行动作。

## 能力组接口

总调度只能调用 PostActionVerificationAbilityGroup.execute(input)。
总调度不得直接调用子能力。

## 子能力

- verify-page-opened
- verify-comments-panel-opened
- verify-comments-panel-closed
- verify-video-changed-after-scroll
- verify-not-interested-result
- verify-target-state-changed

## 统一 contract

- PostActionVerificationAbilityInput
- PostActionVerificationAbilityResult
- PostActionExpectedOutcome
- PostActionVerificationDecision
- PostActionObservationRef
- PostActionFailureReason

## 输入字段

- actionExecutionRef
- actionLogRef
- sourceAbilityGroupId
- sourceActionType
- expectedOutcome
- beforeEvidenceRef
- afterEvidenceRef
- pageStateRef
- aiObservationRef
- visualTargetRef
- screenshotDiffRef
- requestedBy
- sessionId
- roundId
- videoVisitId
- confidencePolicy
- verificationPolicy

## 输出字段

- status
- verificationDecision: verified | failed | review_required
- expectedOutcome
- observedOutcome
- confidence
- evidenceRefs
- observationRefs
- failureReason
- reviewRequiredReason
- dataQualityFlags
- debugLogRef

## 禁止职责

- 不截图
- 不调用 AI
- 不找坐标
- 不点击
- 不滚动
- 不读 DOM/BOM
- 不采集评论
- 不判断产品
- 不保存最终 evidence packet
- 不决定下一步

## 调用边界

- Open / Mouse Click / Mouse Scroll 只执行动作。
- Screenshot 提供 before / after 图像证据。
- AI / PageState / VisualTarget 提供观察结果。
- Page State 只回答“当前页面此刻是什么状态”，不回答动作是否成功。
- Post-action Verification 只验证动作结果。
- Orchestration 根据验证结果决定下一步。
- Forensics Persistence 负责落盘，不负责验证逻辑。
- Mouse Click primitive success 不是 verified；verified 只能由 Post-action Verification 产出。
- Mouse Scroll primitive success 不是 verified；滚动是否真的换视频只能由 Post-action Verification 产出。

## 文件路径

canonical root 必须是：

- src/capabilities/post-action-verification/

不得落到：

- src/features/platform-action/
- src/lib/mission-runtime/
- src/lib/browser/
- src/lib/local-ai/
- src/capabilities/mouse-click/
- src/capabilities/mouse-scroll/
- src/capabilities/open/