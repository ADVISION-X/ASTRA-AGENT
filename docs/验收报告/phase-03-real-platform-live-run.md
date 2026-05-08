# GrassEye 第三阶段真实平台实测记录

## 文档状态

- status: archived / historical acceptance only
- 该文档记录的是 phase-03 实测事实，不是当前 phase-four enforcement truth。
- 文中涉及的 `verify:delivery` 为历史阶段命名；当前对应链路见 [phase-03-acceptance-report.md](docs/验收报告/phase-03-acceptance-report.md) 的 legacy verify 映射表。

## 记录时间

2026-04-27

## 实测配置

- 平台目标：`tiktok-web`
- 启动端口：`4273`
- 服务启动命令：`GRASSEYE_PLATFORM_TARGET=tiktok-web GRASSEYE_PORT=4273 npm run grasseye:start -- --no-open`
- 任务启动接口：`POST http://127.0.0.1:4273/api/tasks/start`

## 已确认结果

- real-platform workbench 启动成功。
- health check 通过，5 个 runtime components 全部健康。
- real browser controller 最终可见状态为：`real browser open on https://www.tiktok.com/foryou`。
- mode snapshot 显示：
  - `dataMode = Real Platform`
  - `executionMode = Vision-first Coordinate Mode`
  - `fallbackMode = Playwright / DOM Semantic Fallback`
  - `pageReadyStatus = page_ready`
  - `geometryGuardStatus = Calibrated`
  - `viewport = 1440 x 960 @ 1.00`

## 历史安全停机记录

同一 real-platform 数据目录中已存在两次历史任务：

- `task_70a6b1ca-42ca-4b40-887a-6bee9b103dae` -> `review_required`
- `task_c6dbb290-0aa4-4df1-a9a7-ff0c34c24765` -> `review_required`

共同备注：`uncertain platform access: login wall detected and requires operator review`

这说明当前边界遵守了“遇登录墙即停机/复核”，没有伪造 non-product 或 candidate 结果。

## 本轮任务记录

- 任务 ID：`task_919040f7-636b-4a58-a16f-847b9809f842`
- 最终状态：`completed`
- 最终备注：`runtime loop completed`
- 完成轮数：5 / 5
- 最终 delivery snapshot：
  - `currentRoundStep = completed`
  - `currentUrl = https://www.tiktok.com/foryou`
  - `pageReadyStatus = page_ready`
  - `geometryGuardStatus = Calibrated`
  - `calibration = Baseline captured 2026-04-27T18:33:34.717Z`
  - `latestScreenshotEvidenceId = video_66288f24-146f-49d1-813a-84a8e05ec7c1`
  - `latestAiResultSummary = vision.product_classification:NON_PRODUCT_VIDEO`
  - `latestActionResult = continue_next:success:scrolled forward`
  - `noCandidateReason = vision_non_product_video`

## 已确认的真实落盘

- 最新 live run 期间，真实 video screenshot 已持续写入 local evidence store。
- 最新 live run 期间，真实 local AI result 已持续写入 local evidence store。
- 最新 live run 期间，真实 action log 已持续写入 local evidence store。
- 当前 snapshot 累计可见：`evidenceCount = 11`、`actionLogCount = 16`、`candidateCount = 0`。

## 当前限制

- 本轮 TikTok 样本为非产品视频，因此未进入 candidate/comment 分支。
- 本轮已证明真实平台的 page-ready、校准、截图、AI、动作日志和 review gate，但未在 TikTok 页面上实测到点击类动作分支。
- 坐标点击能力已由 `verify:delivery` 的本地 fixture + Playwright real click smoke 补充验证。

## 结论

本轮真实平台实测证明了：

- 真实平台模式可以在本机成功启动。
- 安全停机边界在登录墙场景下有效。
- 真正的 TikTok 页面识别与 geometry guard 校准已经跑通。
- 真实 screenshot / AI / action log / no-candidate-reason 已进入 snapshot 与本地 store。

本轮尚未证明：

- TikTok 页面上的点击类动作分支已在 live run 中触发。
- 评论捕获与 candidate 生成在当前样本上触发。