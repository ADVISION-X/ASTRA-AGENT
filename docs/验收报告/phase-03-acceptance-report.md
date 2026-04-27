# GrassEye 第三阶段验收报告

## 当前结论

PASS（按最小可交付标准）

## 已完成

- Visual-Only Runtime law added.
- DOM/BOM content reading banned.
- DOM semantic fallback removed as production path.
- Browser infrastructure boundary preserved.
- Visual target and coordinate action remain primary.
- phase-03 法案、路由、施工图、目标、TODO、Codex 提示词已落到 canonical path。
- 已建立 Vision-first Coordinate Mode 骨架：visual target、geometry guard、coordinate action policy、screen capture、OS input、vision-coordinate adapter base。
- 已将 `tiktok-web` real-platform adapter 调整为视觉唯一动作路径，不再把 DOM / Playwright semantic fallback 当生产验收路径。
- Workbench 已显示 Real Platform Mode、execution mode、fallback mode、geometry guard、viewport、calibration 状态。
- browse flow blueprint 已强化为单条视频生命周期状态机，并补齐原子动作表、第一问 AI contract、like/save marker policy、comment sampling policy、candidate creation policy、round completion contract。
- 已新增 Evidence Packet 取证施工图、module-evidence-packet 法案、packet type contract、advanced-AI handoff boundary、dataQualityFlags 与 actionPurpose contract。
- 已修正 Browse Ledger vs Evidence Packet 主线冲突：product_no 默认进入 Browse Ledger，只有产品相关、人工标记、review-required 或审计必要失败 round 进入 full Evidence Packet。
- 新增 `verify:coordinate`、`verify:delivery`，并将 `verify:phase3` 更新为串联 `verify:delivery`。
- 新增 `verify:evidence-packet`，并将 `verify:phase3` 更新为串联 evidence-packet 校验。
- 新增 `verify:browse-flow`，并将 `verify:phase3` 更新为串联 browse-flow 校验。
- 新增 `verify:multi-frame-evidence`，并将 `verify:phase3` 与 `ci:full` 更新为串联 multi-frame-evidence 校验。
- Structured Logging law added.
- Structured Logging blueprint added.
- StructuredRuntimeEvent schema added.
- StructuredActionLog schema added.
- audit owner added.
- Visual Action Capability law added.
- Visual target catalog added.
- Visual action type contract added.
- DOM primary path forbidden.
- browse flow actions must use visual target capability.
- Local Persistence Schema law added.
- Local persistence blueprint added.
- local-persistence types added.
- storage root clarified.
- SQLite structured store clarified.
- evidence file store clarified.
- export store clarified.
- browser profile separation clarified.
- Local real Chrome persistent profile law added.
- Browser session blueprint added.
- Cookie/session boundary clarified: GrassEye reuses local Chrome profile metadata and does not read or export cookies.
- Real-platform mode must not use temporary context, incognito, storageState, cookie injection, or cookie export.
- Local browser session type contract, verify, and audit owner added.
- 新增 `verify:structured-logging`，并将 `verify:phase3` 与 `ci:full` 更新为串联 structured-logging 校验。
- 新增 `verify:local-browser-session`，并将 `verify:phase3` 与 `ci:full` 更新为串联 local-browser-session 校验。
- 新增 `verify:visual-action-capability`，并将 `verify:phase3` 与 `ci:full` 更新为串联 visual-action-capability 校验。
- 新增 `verify:local-persistence-schema`，并将 `verify:phase3` 与 `ci:full` 更新为串联 local-persistence-schema 校验。
- `verify:delivery` 已验证：local AI config 可读、health/snapshot 可读、screenshot evidence 可真实落盘回读、delivery 字段齐全、仓库无 `tests` / `__tests__` / `*.test.*` 文件、Playwright real coordinate click smoke PASS。
- `verify:evidence-packet` 已验证：取证施工图、module-evidence-packet 法案、Evidence Packet schema/type、round outcome 扩展、actionPurpose、dataQualityFlags、pending_analysis guard、advanced-AI handoff boundary 与无 tests 边界通过。
- `verify:evidence-packet` 已额外验证：Browse Ledger、Browse Session Summary、Advanced AI export set、product_no 默认 lightweight record、Evidence Packets only export set 边界通过。
- `verify:browse-flow` 已验证：browse-flow blueprint、原子动作表、第一问 product-presence prompt、schema contract、like/save marker policy、comment sampling policy、round completion contract 与“测试不作为质量门”边界通过。
- `verify:browse-flow` 已额外验证：product_yes 默认 finalize 为 Evidence Packet，product_no 默认 finalize 为 Browse Ledger，而不是每轮 full packet。
- `verify:multi-frame-evidence` 已验证：第一问从单帧治理升级为 multi-frame default，默认采样 3s / 6s / 10s，contact sheet 优先，一次 AI 任务默认、validFrameCount 规则、single_frame_fallback 标记、多帧 Evidence Packet 字段与无 tests 边界通过。
- real-platform live run 已验证：TikTok 页面可打开、page-ready 识别通过、geometry guard 自动校准成功、真实 screenshot/AI/action log 可持续落盘。

## 本轮实测事实

- real-platform 服务已在独立端口成功启动：`GRASSEYE_PLATFORM_TARGET=tiktok-web GRASSEYE_PORT=4273 npm run launch -- --no-open`。
- 本机 real browser controller 已成功打开 `https://www.tiktok.com/foryou`。
- 历史同数据目录中的登录墙场景仍然会进入 `review_required`，备注为 `uncertain platform access: login wall detected and requires operator review`。
- 启动失败路径现在会真实写入 screenshot evidence、local AI result、failed action log，并在 snapshot / workbench 中暴露失败原因。
- 最新真实任务 `task_919040f7-636b-4a58-a16f-847b9809f842` 已完成 5 轮运行，最终状态为 `completed`。
- 最新 settled delivery snapshot 显示：
	- `currentRoundStep = completed`
	- `pageReadyStatus = page_ready`
	- `geometryGuardStatus = Calibrated`
	- `viewport = 1440 x 960 @ 1.00`
	- `latestScreenshotEvidenceId` / `latestAiResultId` / `latestActionLogId` 全部有值
	- `latestActionResult = continue_next:success:scrolled forward`
	- `noCandidateReason = vision_non_product_video`
- 当前 real-platform 数据目录累计 snapshot 已显示 `evidenceCount = 11`、`actionLogCount = 16`、`candidateCount = 0`。

## 已满足的最小交付项

- 本地 workbench 可启动。
- 本地 AI 可调用且配置受治理。
- 浏览器当前页可截图，真实证据落盘。
- 受治理的视觉坐标点击能力已通过 `verify:delivery` 中的 Playwright real click smoke 验证。
- Workbench / snapshot 可反馈状态、失败原因、AI 结果、截图证据、动作记录、无候选原因。
- Workbench / snapshot 已显示 browserMode、browserExecutable、browserProfileRef、browserProfileStatus、loginState、lastLoginCheckAt、loginRequiredReason、reviewRequiredReason。
- evidence / action log / local AI result 已真实落盘。
- Evidence Packet 已作为一等类型与本地存储对象进入代码面，advanced-AI handoff boundary 已被文档、法案、verify 与 audit owner 共同固化。
- Product presence first question 已在治理合同上从 single frame 升级为 multi-frame，并明确 contact sheet 优先以避免 3x 本地 AI 调用。
- Evidence Packet 已支持 MultiFrameVideoEvidenceSet、contactSheetEvidenceId、samplingStrategy、validFrameCount 与 productPresenceAI multi-frame 字段。
- Browse Ledger、Browse Session Summary 与 Advanced AI export set 已作为一等类型进入代码面，支持“看 10000 条，只导出 1000 条产品 packet”的体系边界。
- login wall / CAPTCHA / 未知 UI / 低置信度 等不确定场景可进入 `review_required`。

## 剩余限制

- Remaining code implementation gaps:
- 当前 runtime 仍以 single_frame_fallback 维持可运行主链，真实 3s / 6s / 10s 抽帧与 contact sheet 生成仍待后续实现。
- product_no 默认不长期保存完整三帧的治理边界已固化，但对应的 runtime 存储裁剪仍待继续落实。
- comment evidence 已切到截图路径，但 OCR / local AI comment extraction 的真实 visual-only runtime 闭环仍待继续补强。
- visual target detection 目前仍含 heuristic viewport box，model-backed visual target detection 仍待继续实装。
- 最新 TikTok live run 样本命中的是 `NON_PRODUCT_VIDEO`，因此本轮真实平台动作主证据是 `continue_next:success:scrolled forward`，不是 TikTok 页面上的点击分支。
- comment evidence、comment signal、evidence-backed candidate 在本轮真实 TikTok 样本中仍未触发。
- Agent runtime 还未把每轮 finalize packet 真正写入 live browse loop；本轮已固化 schema、store、law、verify、audit，但未把主循环完全迁到 packet-first persistence。
- Agent runtime 还未把 Browse Ledger entry、Browse Session Summary 与 Advanced AI export set 真正写入 live persistence；本轮先固化了 schema、law、verify 与 audit 边界。
- runtime 还需要在后续代码建设中真实写入 structured logs，而不是只停留在 law、schema、verify 与 audit owner。
- evidence-store-service.ts 还需要真实实现 SQLite + evidence file store 写入，而不是继续把 state.json 当长期持久化真相。
- runtime 还需要逐个把 open_comments / click_not_interested / like_or_save / scroll_next / comment screenshot 接入生产级视觉动作能力。
- login state 目前主要由本地 URL / title 启发式识别，平台专属登录态判定还需要后续继续收紧。
- `maxRuntimeMinutes` 和更明确的 calibration / unattended controls 仍待补齐。

## 自动化验证记录

- `npm run verify:visual-only-runtime`: PENDING THIS ROUND
- `npm run verify:coordinate`: PASS
- `npm run verify:delivery`: PASS
- `npm run verify:evidence-packet`: PASS
- `npm run verify:browse-flow`: PASS
- `npm run verify:multi-frame-evidence`: PASS
- `npm run verify:structured-logging`: PASS
- `npm run verify:local-browser-session`: PASS
- `npm run verify:local-persistence-schema`: PASS
- `npm run verify:visual-action-capability`: PASS
- `npm run verify:phase3`: PASS
- `npm run launch -- --no-open`: PASS
- `GRASSEYE_PLATFORM_TARGET=tiktok-web GRASSEYE_PORT=4273 npm run launch -- --no-open`: PASS