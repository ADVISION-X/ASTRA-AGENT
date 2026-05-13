# GrassEye 纯视觉单轮闭环总纲施工图

status: active
version: 2026-05-13

## 最高定义

用户目标 = 我要找什么。

每轮系统 = 截图 + 坐标图。

每轮 AI = goalMatched + save + nextAction。

系统 = save 后执行 nextAction。

每轮只执行一个 action。

下一轮重新截图重新判断。

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

- AI output 不得包含产品专用裁判字段。
- AI output 不得包含多动作序列。
- AI 不得调用 Forensics 能力。
- PlatformProfile 不得携带下一条、点赞、评论、恢复等语义动作提示。
- Orchestration 不得按产品 yes/no 或页面状态分支。

## 保存职责

AI 只输出 save 与 saveReason。系统检测 save=true 后保存当前 round 的 originalScreenshotRef、coordinateGridScreenshotRef、gridSpecRef、aiResultRef、saveReason、confidence、visualEvidence。

## 历史文件

旧 Page State、Post-action Verification、Visual Target、高级 AI 地图生成、视觉裁判故事情节文件已经移入 docs/archive/**。这些文件 historical only, must not route current runtime。
