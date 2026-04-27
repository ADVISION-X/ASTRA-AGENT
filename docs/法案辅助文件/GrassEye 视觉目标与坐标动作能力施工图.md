# GrassEye 视觉目标与坐标动作能力施工图

## 1. 定位

视觉动手能力是 GrassEye real-platform mode 的主动作能力。
真实平台动作必须优先依赖截图、视觉目标、坐标动作、动作后验证。
DOM selector 不得作为真实平台主路径。

当前阶段为 Visual-Only Runtime。
所有网页理解来自截图/OCR/视觉 AI，collect metrics、comment extraction、button locating、next video 判断都不得走 DOM。

## 2. 视觉动作主链

每个视觉动作必须遵循：

1. capture before screenshot
2. detect visual target
3. validate target confidence
4. validate geometry guard
5. compute safe click point / action region
6. execute coordinate action
7. capture after screenshot
8. verify action result
9. write StructuredActionLog
10. update runtime snapshot

如果视觉失败，进入 skip/review，不 DOM fallback。

## 3. Visual Target Catalog

必须定义施工图中所有需要识别的 targetType：

- video_area
- current_video_content
- like_button
- save_button
- comments_button
- comments_panel
- close_comments_button
- not_interested_button
- next_video_region
- scroll_area
- login_wall
- captcha_challenge
- safety_page
- unknown_ui
- metric_like_count
- metric_comment_count
- metric_share_count
- metric_save_count

每个 targetType 必须定义：
- purpose
- allowed action
- required confidence
- required evidence
- failure behavior

## 4. Visual Target Result Contract

每次视觉目标识别必须返回：

- targetId
- targetType
- sourceScreenshotEvidenceId
- boundingBox
  - x
  - y
  - width
  - height
- clickPoint
  - x
  - y
- confidence
- detectionMethod
- visibleText if any
- uncertainty
- blockedReason
- createdAt

## 5. Coordinate Action Guard

动作前必须检查：

- target exists
- target confidence >= threshold
- target boundingBox inside screenshot
- clickPoint inside boundingBox
- browser geometry calibrated
- deviceScaleFactor accounted
- viewport size matches screenshot size
- no login wall
- no captcha
- no safety page
- no unknown UI
- action allowed by policy
- rate limit allowed
- structured log context exists

如果任一失败：
- 不允许点击
- 不允许 DOM fallback
- 进入 review_required / skip
- 写 structured failed log

## 6. Post-action Verification

每个坐标动作后必须验证：

- after screenshot captured
- expected UI change exists
- or explicit failure reason recorded

示例：
- open_comments 后必须看到 comments_panel
- close_comments 后 comments_panel 消失
- like/save marker 后状态变化或记录 unable_to_verify
- click_not_interested 后视频变化或 panel response
- scroll_next_video 后 videoVisitId / screenshotHash 必须变化
- screenshot action 后必须有 evidence record

## 7. 动作失败策略

如果视觉目标识别失败：

- product_yes 路径：
  - like/save 找不到：记录 failure，不阻断 open_comments，除非 UI 异常
  - comments_button 找不到：create_video_only_pending_candidate 或 review
- product_no 路径：
  - not_interested 找不到：默认 scroll_next
  - scroll_next 失败：review_required
- uncertain 路径：
  - 不允许 not_interested
  - 默认 scroll_next 或 review
- login/captcha/safety：
  - review_required
  - 不允许绕过

## 8. 禁止

禁止：
- Runtime 直接调用 raw coordinate
- Runtime 直接写 selector
- DOM selector 作为真实平台主路径
- 视觉目标低置信度仍然点击
- 没有 boundingBox 点击
- 没有 geometry guard 点击
- 没有 post-action verification 宣称成功
- 点击失败写 success
- 视觉失败后悄悄 DOM fallback
- stealth / anti-detection / fingerprint spoofing / captcha bypass / proxy pool / account pool
- 自动评论 / 私信 / 关注 / 批量点赞 / 账号切换