# GrassEye 本地取证存储结构施工图

## 1. 定位

本地取证存储结构定义 GrassEye Agent 所有运行记录、动作日志、证据、AI 结果、Browse Ledger、Evidence Packet、Candidate 和 Export Set 的本地落点。

它回答两个问题：
- 取证后记录在哪里？
- 每类记录有哪些字段？

## 2. 本地目录结构

固定：

```text
.grasseye-local/
  data/
    grasseye.sqlite
  evidence/

Canonical paths:
- .grasseye-local/data/grasseye.sqlite
- .grasseye-local/evidence/video-frames
- .grasseye-local/evidence/contact-sheets
- .grasseye-local/evidence/comment-screenshots
- .grasseye-local/evidence/ocr-text
- .grasseye-local/exports/advanced-ai
- .grasseye-local/browser-profiles
- .grasseye-local/logs/runtime
    video-frames/
    contact-sheets/
    comment-screenshots/
    ocr-text/
  exports/
    advanced-ai/
  browser-profiles/
    <platform>/
  logs/
    runtime/
```

说明：
- .grasseye-local 必须 gitignored。
- .grasseye-local/data/grasseye.sqlite 存结构化记录。
- .grasseye-local/evidence/video-frames 存视频帧截图。
- .grasseye-local/evidence/contact-sheets 存 product presence contact sheet。
- .grasseye-local/evidence/comment-screenshots 存评论区截图。
- .grasseye-local/evidence/ocr-text 存 OCR 文本产物。
- .grasseye-local/exports/advanced-ai 存高级 AI 导出包。
- .grasseye-local/browser-profiles 存真实 Chrome profile。
- evidence 存截图、contact sheet、OCR 文本等大文件。
- exports 存导出给高级 AI 的 JSON、JSONL 或 ZIP。
- browser-profiles 存 Chrome Profile，但不得读取 cookies。
- logs/runtime 只可存结构化日志快照或调试导出，不替代 SQLite truth。

## 3. 存储分层

必须区分：

### 3.1 SQLite Structured Store

保存：
- browse_sessions
- video_rounds
- structured_runtime_events
- structured_action_logs
- evidence_records
- multi_frame_evidence_sets
- ai_results
- browse_ledger_entries
- evidence_packets
- product_candidates
- export_sets

### 3.2 Evidence File Store

保存：
- video frame screenshots
- contact sheets
- comment screenshots
- OCR text files if large
- AI input/output artifacts if needed

### 3.3 Export Store

保存：
- advanced AI export set
- browse summary
- packet JSON / JSONL

### 3.4 Browser Profile Store

保存：
- Chrome Profile only
- GrassEye 不读取 cookies / session / token

## 4. 表结构字段

### browse_sessions

- sessionId
- platform
- targetUrl
- startedAt
- endedAt
- status
- totalSeenCount
- productYesCount
- productNoCount
- uncertainCount
- duplicateCount
- blockedCount
- evidencePacketCount
- browseLedgerCount
- exportPacketCount
- stopReason
- createdAt
- updatedAt

### video_rounds

- roundId
- sessionId
- videoVisitId
- sourcePlatform
- sourceUrl
- startedAt
- endedAt
- roundOutcome
- productPresenceDecision
- confidence
- nextStep
- finalizationType: evidence_packet | browse_ledger | failed_record
- createdAt
- updatedAt

### structured_runtime_events

- eventId
- sessionId
- roundId
- videoVisitId
- eventType
- step
- previousStep
- nextStep
- status
- reason
- failureReason
- reviewRequiredReason
- inputRefs
- outputRefs
- evidenceRefs
- actionLogRefs
- createdAt
- durationMs

### structured_action_logs

- actionLogId
- sessionId
- roundId
- videoVisitId
- step
- actionType
- actionPurpose
- triggerSource
- targetType
- visualTargetId
- beforeEvidenceId
- afterEvidenceId
- result
- failureReason
- createdAt
- durationMs

### evidence_records

- evidenceId
- sessionId
- roundId
- videoVisitId
- evidenceType
- regionType
- storageRef
- screenshotHash
- width
- height
- capturedAt
- sourceUrl
- dataQualityFlags
- createdAt

evidenceType 可以是：
- video_frame
- contact_sheet
- comment_screenshot
- ocr_text
- ai_result

### multi_frame_evidence_sets

- multiFrameEvidenceSetId
- sessionId
- roundId
- videoVisitId
- samplingStrategy
- frameEvidenceIds
- contactSheetEvidenceId
- validFrameCount
- dataQualityFlags
- createdAt

### ai_results

- aiResultId
- sessionId
- roundId
- videoVisitId
- taskType
- promptId
- promptVersion
- schemaVersion
- modelRole
- modelNameOrToolName
- inputEvidenceRefs
- outputJson
- confidence
- uncertainty
- mustReview
- createdAt

### browse_ledger_entries

- ledgerEntryId
- sessionId
- roundId
- videoVisitId
- observedAt
- browseOutcome
- productPresenceDecision
- confidence
- skipReason
- actionLogRefs
- lightweightOnly
- createdAt

### evidence_packets

- packetId
- sessionId
- roundId
- videoVisitId
- sourcePlatform
- sourceUrl
- capturedAt
- roundOutcome
- nextStep
- pageStateJson
- videoEvidenceJson
- productPresenceAIJson
- preActionMetricsJson
- actionsJson
- commentEvidenceJson
- commentSignalsJson
- candidateJson
- dataQualityFlagsJson
- exportForAdvancedAIJson
- createdAt
- updatedAt

### product_candidates

- candidateId
- packetId
- sessionId
- roundId
- videoVisitId
- status: pending_analysis
- candidateType: video_only | richer_candidate
- evidenceRefs
- createdAt
- updatedAt

### export_sets

- exportId
- sessionId
- exportVersion
- packetIds
- packetCount
- browseSummaryJson
- excludedBrowseLedgerByDefault
- createdAt
- storageRef

## 5. 关系规则

必须明确：
- one session -> many video_rounds
- one video_round -> many runtime_events
- one video_round -> many action_logs
- one video_round -> many evidence_records
- one product_yes round -> one evidence_packet
- one product_no round -> one browse_ledger_entry by default
- one evidence_packet -> zero or one product_candidate
- one export_set -> many evidence_packets
- browser profile 不与 packet 直接绑定，只通过 browserProfileRef 记录运行环境

## 6. 禁止

禁止：
- 把 cookies / session / token 存入任何表。
- 把 Chrome Profile 当 evidence。
- 把 screenshots 直接塞成数据库 blob 默认方案。
- 把临时内存当持久化真相。
- 把散乱 JSON 文件当主数据库。
- product_no 默认创建 evidence_packet。
- product_no 默认保存完整截图证据。
- Evidence Packet 缺 packetId / roundId / videoVisitId。
- Browse Ledger 缺 sessionId / roundId / videoVisitId。
- action log 缺 actionPurpose。
- failed record 缺 failureReason。
- review_required 缺 reviewRequiredReason。