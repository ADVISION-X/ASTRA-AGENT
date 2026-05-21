# GrassEye 纯视觉单轮闭环总纲施工图

status: active
version: 2026-05-20

## 最高定义

用户目标 = 我要找什么。

每轮系统 = 截图 + 坐标图。

每轮 AI = goalMatched + save + nextAction。

系统 = save 后执行 nextAction。

每轮只执行一个 action。

下一轮重新截图重新判断。

## 适用边界

本施工图只约束当前“纯视觉单轮闭环模式”。

它不等于 GrassEye 所有产品视频挖掘模式的唯一架构，也不排斥新增 DOM-first 种草视频模式。

允许并行存在：

- 纯视觉模式：以截图、坐标网格、单轮 AI 判断为主。
- DOM 种草视频模式：以 DOM 页面事实采集为主，视觉只做视频画面语义补充。

纯视觉模式当前不改、不删、不强行接入 DOM。

DOM 种草视频模式不得塞进纯视觉 round 内部，必须作为平级模式/插件链路独立建设。

## 运行闭环

1. loop guard
2. capture-browser-viewport
3. render-coordinate-grid
4. call AI pure-visual-round judge
5. parse pureVisualRound.v1
6. if save=true, systemSaveCurrentRoundEvidence
7. if decision=done, complete mission
8. if decision=review_required, stop for review
9. if decision=blocked, stop for review
10. if decision=act, dispatch exactly one nextAction
11. next round

## 禁止复活

以下禁止项仅适用于当前纯视觉单轮闭环模式，不能被解释为禁止 DOM 种草视频模式建设。

- AI output 不得包含产品专用裁判字段。
- AI output 不得包含多动作序列。
- AI 不得调用 Forensics 能力。
- PlatformProfile 不得携带下一条、点赞、评论、恢复等语义动作提示。
- Orchestration 不得按产品 yes/no 或页面状态分支。

## 保存职责

AI 只输出 save 与 saveReason。系统检测 save=true 后保存当前 round 的 originalScreenshotRef、coordinateGridScreenshotRef、gridSpecRef、aiResultRef、saveReason、confidence、visualEvidence。

## 与 DOM 种草视频模式的关系

DOM 种草视频模式可以读取页面结构、视频文案、作者、商品入口、评论入口、评论文本和互动数据。

DOM 种草视频模式可以在需要画面语义判断时调用视觉能力。

纯视觉模式不得反向阻塞 DOM 种草视频模式；DOM 种草视频模式也不得破坏纯视觉模式的单轮闭环规则。
