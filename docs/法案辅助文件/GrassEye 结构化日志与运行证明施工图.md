# GrassEye 结构化日志与运行证明施工图

## 1. 定位

结构化日志是 GrassEye Agent 的运行事实账本。
它用于证明 Agent 是否真实执行了每个原子动作。
它不是普通 debug log。
它不是 console.log。
它不是验收报告。
它不是 Evidence Packet 的替代品。

## 2. 核心目标

结构化日志必须证明：

- Agent 打开了页面
- Agent 检测了登录/安全状态
- Agent 等待了 feed ready
- Agent 等待了 video stable
- Agent 识别了 videoVisitId
- Agent 完成了 geometry calibration
- Agent 截图并生成 evidence
- Agent 调用了本地 AI 或记录 local_ai_unavailable
- Agent 校验了 AI 输出
- Agent 执行了分支决策
- Agent finalize 成 Browse Ledger / Evidence Packet / Failed Record
- Agent 执行了 scroll_next_video
- Agent 进入下一条视频的 wait_video_stable

## 3. 五类记录边界

必须区分：

1. StructuredRuntimeEvent
用于记录 Agent 状态机步骤。

2. StructuredActionLog
用于记录具体动作：
- open target page
- screenshot
- ask AI
- click
- scroll
- open comments
- finalize packet / ledger

3. EvidenceRecord
用于保存截图、OCR、AI output 等证据引用。
不是普通日志。

4. BrowseLedgerEntry
用于非产品视频、duplicate、普通 skip 的轻量浏览流水。

5. ProductDiscoveryEvidencePacket
用于产品相关视频的完整取证包。

结构化日志不是替代 Evidence Packet，而是连接：

Agent Step -> Action Log -> Evidence -> Ledger / Packet -> Runtime Snapshot -> Live Proof

## 4. StructuredRuntimeEvent Schema

必须定义字段：

- eventId
- eventType
- sessionId
- roundId
- videoVisitId
- step
- previousStep
- nextStep
- status: started | success | failed | skipped | review_required
- reason
- failureReason
- reviewRequiredReason
- createdAt
- durationMs
- inputRefs
- outputRefs
- evidenceRefs
- actionLogRefs
- dataQualityFlags

## 5. StructuredActionLog Schema

必须定义字段：

- actionLogId
- sessionId
- roundId
- videoVisitId
- step
- actionType
- actionPurpose
- triggerSource
- inputRefs
- outputRefs
- beforeEvidenceId
- afterEvidenceId
- targetDescriptor
- result: success | failed | skipped | review_required
- failureReason
- reviewRequiredReason
- createdAt
- durationMs

## 6. 必须记录的事件类型

必须包含：

- task_started
- open_target_page_started
- open_target_page_completed
- detect_login_or_safety_started
- detect_login_or_safety_completed
- wait_feed_ready_started
- wait_feed_ready_completed
- single_video_round_started
- wait_video_stable_started
- wait_video_stable_completed
- identify_current_video_started
- identify_current_video_completed
- calibrate_geometry_started
- calibrate_geometry_completed
- screenshot_video_area_started
- screenshot_video_area_completed
- record_video_evidence_completed
- ask_ai_product_presence_started
- ask_ai_product_presence_completed
- local_ai_unavailable
- validate_ai_output_completed
- branch_decision_completed
- collect_pre_action_metrics_completed
- like_or_save_marker_completed
- open_comments_completed
- screenshot_comments_completed
- extract_visible_comments_completed
- summarize_comment_signals_completed
- finalize_browse_ledger_completed
- finalize_evidence_packet_completed
- finalize_failed_or_review_record_completed
- scroll_next_video_started
- scroll_next_video_completed
- next_video_wait_started
- review_required
- task_stopped

## 7. 运行证明规则

一条 live run 只有出现以下日志序列，才允许证明“打开页面到切换下一个视频”成功：

- open_target_page_completed
- detect_login_or_safety_completed
- wait_feed_ready_completed
- single_video_round_started
- wait_video_stable_completed
- identify_current_video_completed
- calibrate_geometry_completed 或 review_required
- screenshot_video_area_completed
- ask_ai_product_presence_completed 或 local_ai_unavailable
- validate_ai_output_completed 或 local_ai_unavailable
- branch_decision_completed
- finalize_browse_ledger_completed 或 finalize_evidence_packet_completed 或 finalize_failed_or_review_record_completed
- scroll_next_video_completed
- next_video_wait_started

## 8. runtime snapshot 与日志关系

Runtime snapshot 只能总结结构化日志的当前状态。
Runtime snapshot 不是运行真相。
Runtime snapshot 不得替代 StructuredRuntimeEvent 或 StructuredActionLog。
Live proof 必须由结构化日志序列证明。

## 9. 持久化边界

Structured logs 必须由 Local Data 持久化或委托给受治理的结构化日志存储层。
Structured logs 必须可按 sessionId / roundId / videoVisitId 查询。
Structured logs 必须支持 retention、export、delete。
Evidence Packet、Browse Ledger、runtime snapshot 都只能引用结构化日志，不得伪造结构化日志。

## 10. 禁止

禁止：

- console.log 作为运行真相
- plain text log 作为验收依据
- fake structured log
- 先写 success log 再执行动作
- 动作失败但写 success
- 没有 roundId 的 action log
- 没有 videoVisitId 的 video round log
- 没有 actionPurpose 的 action log
- 没有 evidenceRefs 的 evidence-related log
- 没有 failureReason 的 failed log
- 没有 reviewRequiredReason 的 review_required log
- 用 audit report 替代 runtime log
- 用 verify 结果替代 live run proof
- fake PASS