# GrassEye Agent 取证表单与高级AI投喂契约施工图

## 1. 核心定位

关键词：取证。

GrassEye Agent 的最终交付物不是产品结论，而是 Product Discovery Evidence Packet。

Evidence Packet 是后期高级 AI 的唯一标准投喂材料，但当前阶段的主角仍然是 Agent 取证系统，而不是高级 AI 分析系统。

## 2. Agent-Centered Forensics Model

GrassEye 当前阶段主角是 Agent，不是高级 AI。

当前系统目标不是分析产品，而是让 Agent 产生高质量产品视频取证包。

当前阶段为 Visual-Only Runtime。
所有网页理解、评论抽取、指标采集与按钮定位都必须来自截图、OCR、本地视觉 AI 或视觉目标识别，不得走 DOM。

标准主线如下：

- Agent browses 10000 videos.
- Local AI only judges whether the current sampled video frames are product-related.
- Only 1000 product-related videos become full Evidence Packets.
- Those 1000 packets can later be exported to GPT for advanced analysis.
- GPT may select 5 high-value products from the 1000 packets.
- Agent does not select the 5 products.

## 3. 三层分工

### Agent / 手臂

Agent 只负责：

- 打开页面
- 截图
- 调用本地 AI
- 通过视觉目标识别定位动作目标
- 校验结构化输出
- 执行受治理动作
- 采集评论
- 写 evidence
- 写 action log
- 生成 Evidence Packet

Agent 不负责：

- 自行判断商业价值
- 自行改写 AI 结论
- 自行决定采购、利润、广告、供应链
- 跳过证据要求

### 本地 AI / 窄任务大脑

本地 AI 只负责：

- product presence 判断
- visual target detection
- OCR cleanup
- comment signal summarization
- 结构化输出

本地 AI 只接收 screenshot / OCR evidence，不接收 DOM dump。

product presence 默认接收多帧视频证据：

- 3s / 6s / 10s 三帧
- 一个 MultiFrameVideoEvidenceSet
- 优先一张 3-panel contact sheet
- 一次本地 AI 调用，而不是 3 次独立 AI 调用

本地 AI 不负责：

- 最终产品价值判断
- 利润判断
- 供应链判断
- 采购判断
- 广告判断

### 高级 AI / 后期分析大脑

高级 AI 只接收 Evidence Packet。

高级 AI 可以：

- 分析产品是否值得进一步研究
- 分析需求、评论、风险、改良机会
- 给出研究建议

高级 AI 不得：

- 直接控制平台动作
- 直接修改原始证据
- 把单个 packet 当成最终商业结论

## 4. Browse Ledger vs Evidence Packet

GrassEye 必须区分两层记录：

### Browse Ledger

Browse Ledger 是轻量浏览流水，不是高级 AI 默认投喂材料。

Browse Ledger 默认用于：

- product_no_high_confidence
- skipped_uncertain by default
- duplicate
- skipped_unstable_video
- ordinary scroll next

### Evidence Packet

Evidence Packet 是完整产品视频取证包。

Evidence Packet 默认只用于：

- product_yes_high_confidence
- product_yes with comments unavailable but video evidence exists
- operator-marked uncertain
- review_required with evidence
- important failed rounds requiring audit

## 5. Evidence Packet Schema

ProductDiscoveryEvidencePacket 只用于产品相关、人工标记、需要复核或需要保留审计证据的 round，至少包含：

- packetId
- roundId
- videoVisitId
- sourcePlatform
- sourceUrl
- capturedAt
- roundOutcome
- nextStep

### pageState

- currentUrl
- loginState
- safetyState
- feedReadyStatus
- videoStableStatus
- geometryStatus
- reviewRequiredReason

### videoEvidence

- multiFrameEvidenceSetId
- frames
- contactSheetEvidenceId
- samplingStrategy
- validFrameCount

### productPresenceAI

- promptId
- promptVersion
- schemaVersion
- inputMode
- sampledFrameCount
- validFrameCount
- modelRole
- modelNameOrToolName
- isProductVideo
- confidence
- visibleProductTypes
- evidenceObservations
- frameLevelObservations
- aggregateReason
- reason
- uncertainty
- mustReview

### preActionMetrics

- likeCount
- commentCount
- shareCount
- saveCount
- metricCaptureStage
- unavailableReasons

### actions

每个 action 必须包含：

- actionLogId
- actionType
- actionPurpose
- triggerSource
- beforeEvidenceId
- afterEvidenceId
- result
- failureReason
- createdAt

### commentEvidence

- commentPanelOpened
- commentScreenshotEvidenceIds
- ocrTextRecordIds
- visibleCommentCount
- commentCaptureLimit
- failureReason

### commentSignals

- whereToBuyQuestions
- priceQuestions
- purchaseIntent
- qualityConcerns
- problemComplaints
- repeatedDemandTerms
- confidence
- uncertainty

### candidate

- candidateId
- status: pending_analysis only
- candidateType: video_only | richer_candidate | none
- evidenceRefs

### dataQualityFlags

- string[]

### exportForAdvancedAI

- included
- exportVersion
- allowedUse
- forbiddenUse

## 6. Browse Ledger Contract

BrowseLedgerEntry 是轻量浏览统计，不是高级 AI 默认投喂材料。

BrowseLedgerEntry 至少包含：

- sessionId
- roundId
- videoVisitId
- observedAt
- browseOutcome
- productPresenceDecision
- confidence
- skipReason
- actionLogRefs
- lightweightOnly: true

BrowseSessionSummary 至少包含：

- sessionId
- totalSeenCount
- productYesCount
- productNoCount
- uncertainCount
- duplicateCount
- unstableCount
- blockedCount
- evidencePacketCount
- exportPacketCount
- startedAt
- endedAt

product_no_high_confidence 默认只进入 Browse Ledger，不生成 Evidence Packet。

product_no 默认不长期保存完整三帧，只保留 lightweight ledger / hash / summary / availability 记录。

## 7. Candidate 与 Evidence Packet 的关系

必须明确：

- Candidate 不是最终结论。
- Candidate 是 Evidence Packet 中的索引对象。
- 高级 AI 的主要输入是 Evidence Packet，不是孤立 candidate。
- product_no 不创建 candidate，但仍可生成 lightweight Browse Ledger 记录用于浏览统计。
- uncertain 默认不创建 candidate，但必须有 round outcome 和 reason。

## 8. Data Quality Flags

必须定义至少以下 flag：

- video_screenshot_ok
- video_screenshot_missing
- comment_screenshot_ok
- comment_screenshot_missing
- metrics_complete
- metrics_partially_unavailable
- local_ai_ok
- local_ai_unavailable
- local_ai_low_confidence
- ocr_ok
- ocr_low_quality
- comment_panel_failed
- geometry_calibrated
- geometry_mismatch
- duplicate_video
- review_required
- video_only_candidate
- richer_candidate

## 9. Round Outcome 扩展

必须扩展 round outcome：

- candidate_created
- video_only_candidate_created
- comments_unavailable_candidate_created
- metrics_unavailable_candidate_created
- skipped_non_product
- skipped_uncertain
- skipped_duplicate
- skipped_unstable_video
- blocked_login
- blocked_captcha
- blocked_safety_page
- local_ai_unavailable
- invalid_ai_output
- geometry_mismatch
- review_required
- failed_with_reason

## 10. Action Purpose Contract

必须定义 actionPurpose：

- open_target_page -> initialize_discovery
- screenshot_video_area -> collect_video_evidence
- like_or_save_marker -> recommendation_tuning_marker
- open_comments -> collect_comment_evidence
- screenshot_comments -> collect_comment_evidence
- click_not_interested -> reduce_non_product_recommendations
- scroll_next_video -> continue_discovery
- record_round_complete -> finalize_evidence_packet

所有 action log 必须带 actionPurpose。

## 11. Export Set

Advanced AI export set = Evidence Packets only by default.

Browse Ledger only appears as summary statistics:

- totalSeenCount
- productPacketCount
- skippedNonProductCount
- uncertainCount
- duplicateCount
- blockedCount
- exportPacketCount

Browse Ledger 不进入高级 AI 默认导出集。

## 12. 高级 AI 投喂边界

必须明确：

- 高级 AI 只能基于 Evidence Packet 分析。
- 高级 AI 默认不接收所有 browse rounds，只接收 Evidence Packet export set。
- 高级 AI 不得把单一视频视为市场趋势。
- 高级 AI 不得把 like/save marker 当成购买意图。
- 高级 AI 不得把 views/likes 直接当销售。
- 高级 AI 必须阅读 dataQualityFlags。
- 高级 AI 必须区分 comment evidence、AI inference、operator action、platform metric。
- 高级 AI 输出仍必须是建议，不是自动采购或广告决策。