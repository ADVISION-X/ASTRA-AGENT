# GrassEye 结构化日志与运行证明施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 13 个 active ability groups 与 4 个 active support laws，不重新分配主权。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 定位

本图只描述 Forensics Persistence 之下的结构化日志字段纪律、runtime proof 和写账关系。

Structured Logging 子边界负责日志 schema 与可追溯性。
Forensics Persistence 负责把这些 payload 持久化成 record envelope。

## 日志类型

- structured_runtime_event
- structured_action_log
- runtime_snapshot
- AI_REQUEST_DEBUG
- AI_RESPONSE_DEBUG
- AI_ERROR_DEBUG
- HUMAN_COMMAND_DRAFTED 到 COMMAND_REJECTED 事件链
- APP_SHELL_HEALTH_CHECK_STARTED 到 LOCAL_AI_READINESS_DEGRADED 事件链
- SERVICE_SHUTDOWN_REQUESTED 到 SERVICE_EXIT_CLASSIFICATION 事件链

## 最低字段

- level: DEBUG / INFO / WARN / ERROR
- traceId
- spanId
- eventId
- eventType
- owner
- ownerResponsible
- abilityGroupId
- childAbilityId
- missionId
- sessionId
- roundId
- videoVisitId
- mapId
- stepId
- taskTemplateId
- status
- reason
- createdAt
- durationMs
- inputRefs
- outputRefs
- evidenceRefs
- artifactRefs
- debugBundleRefs
- dataQualityFlags

## 运行证明

runtimeProof 至少应包含：
- proofId
- emittedAt
- sourceAbilityGroupId
- sourceChildCapabilityId
- actionExecutionRef
- primitiveExecutionRef
- primitiveExecutionRefs
- inputRecordRefs
- outputRecordRefs
- artifactRefs
- promptDebugRef
- rawResponseRef
- integrityStatus
- debugLogRef

## 持久化关系

- structured_runtime_event 和 structured_action_log 由上游生成 payload。
- AI_REQUEST_DEBUG、AI_RESPONSE_DEBUG、AI_ERROR_DEBUG、命令预检事件、健康事件、服务退出事件都属于结构化 payload，不能只留在终端文本里。
- Forensics 把 payload 包装成 ForensicsRecordEnvelope 后写入。
- runtime_snapshot 是独立 recordType，不得用 structured_runtime_event 假装替代。
- browse ledger、evidence packet、failed record 必须能回连到结构化日志记录。
- ability group 不得把 browserActionId 假装成 actionLogRef；真正的 actionLogRef 由 Forensics 写入后回填。
- Mouse Scroll 只能先返回 scrollExecutionRef、primitiveExecutionRefs 和 runtimeProof，不能伪造持久化 actionLogRef。
- 合法的 Forensics internal helper 可以存在，但不得变成隐藏的 round finalizer 或隐藏的 logging closure truth。

## DEBUG Level Transparency

- DEBUG 不是多打几行 console，而是 root cause analysis 的结构化运行证明。
- DEBUG 必须知道发出了什么、收到了什么、依赖了哪些 refs、失败为什么发生、谁负责、下一步怎么办。
- DEBUG payload 不得依赖 hidden in-memory state 才能解释。
- failure 类事件必须给出 ownerResponsible、actionableMessage、failureReason、inspect refs 或 debug refs。

## AI Request / Response / Error Debug Events

- AI_REQUEST_DEBUG 必须在 model call 前写出 provider、model、modelRole、runtime、taskType、promptContractId、promptVersion、outputSchemaRef、systemPromptHash、userPromptHash、promptDebugRef、image refs、image hashes、image bytes、image dimensions、aiInputArtifactRef、traceId、spanId。
- summary mode 至少显示 prompt hash、prompt preview、prompt length、image refs、尺寸和模型元数据。
- full mode 必须能通过终端或 debug bundle 查看完整 prompt；但 base64 image content 不得打印到终端。
- AI_RESPONSE_DEBUG 必须保留 rawResponseHash、rawResponseRef、rawResponsePreview 或 rawResponseText、parsedJson、parsedDecision、parserErrors、confidence、dataQualityFlags、modelDurationMs。
- parsed output 不能成为模型响应的唯一记录；raw response 必须能通过 rawResponseRef 或 debug bundle 回看。
- AI_ERROR_DEBUG 必须给出 errorKind、rejectedBy、actualValue、maxAllowedValue、missingPrecondition、upstreamRequiredAction、ownerResponsible、actionableMessage。
- oversized image、missing prepare-ai-input、local AI readiness failure 都必须明确指出责任 owner 和上游动作。

## Human Command / Mission Preflight Events

- 点击 Start 不能静默。
- 受治理事件链至少包含：HUMAN_COMMAND_DRAFTED、HUMAN_COMMAND_RECEIVED、HUMAN_COMMAND_VALIDATED、MISSION_PREFLIGHT_STARTED、MISSION_PREFLIGHT_PASSED、MISSION_PREFLIGHT_FAILED、COMMAND_ACCEPTED、COMMAND_REJECTED。
- 命令被拒绝时，必须能看到 failureReason、ownerResponsible、actionableMessage、inspect refs。
- Commander Console 负责显示，不负责 persisted truth。

## AppShellHealth vs MissionReadiness

- AppShellHealth 只回答本地壳是否活着、是否可达。
- MissionReadiness 只回答当前选定任务是否可启动。
- Local AI unavailable 可以阻塞 mission start，但不能被归类成 app shell bootstrap failure。
- 终端和 UI 都必须把 degraded readiness 单独显示，而不是把 app shell 直接杀掉。

## Service Exit Classification

- 服务退出必须区分 SERVICE_SHUTDOWN_REQUESTED、SERVICE_SHUTDOWN_COMPLETED、SERVICE_UNEXPECTED_EXIT、SERVICE_EXIT_CLASSIFICATION。
- 退出事件至少包含 exitCode、signal、pid、startedAt、endedAt、lastRuntimeEventId、lastCommandEventId、lastAiEventId、likelyCauseRef。
- SIGTERM 或 unexpected exit 不能只剩终端文本，必须能回连到上一个结构化事件。

## Terminal Relay Modes

- terminal relay 是 display channel，不是 persisted truth。
- summary mode 用于快速巡检，至少包含 level、eventType、status、reason、核心 refs、owner 和 durationMs。
- full mode 用于深度排障，必须能查看完整 prompt 和 raw response 的受治理路径。
- 即使 full mode 打开，也必须先做 redaction，且不得打印 base64 image body、cookie、token、credential。

## Debug Bundle / Forensics Ref Strategy

- promptFullText、rawResponseText、crash context 等大体量内容可以通过 debug bundle refs 暴露，而不是强制全部塞进终端单行。
- 关键 refs 至少包括 promptDebugRef、rawResponseRef、aiInputArtifactRef、sourceScreenshotEvidenceId、debugLogRef、crashBundleRef。
- browse ledger、evidence packet、failed record、runtime snapshot 都必须能回连到这些 refs。

## Redaction Policy

- 任何 terminal display 或 persisted debug payload 都必须先过 redaction。
- secrets、cookies、tokens、credentials、授权头、会话标识符不得明文出现在终端。
- 允许输出 hash、preview、ref、dimensions、bytes、schema refs，但不允许把敏感原文直接暴露。

## Negative Proof Requirements

- 只打 promptLength 没有 promptHash 和 promptDebugRef，判定不合格。
- 只有 parsedJson 没有 rawResponseHash 或 rawResponseRef，判定不合格。
- 只有终端文本没有 Forensics record refs，判定不合格。
- local AI unavailable 导致 app shell 退出，判定不合格。
- Start 点击没有进入 HUMAN_COMMAND_RECEIVED 或 MISSION_PREFLIGHT_STARTED，判定不合格。

## 禁止边界

- 不把 console output 当 runtime truth。
- 不把 structured-logging 写成独立 owner 或第二 persistence owner。
- 不把 hidden round finalizer 或 hidden runtime closure path 藏成 Forensics truth。
- 不允许 verify 脚本成为日志执法主链。
- 不允许 promptLength-only visibility。
- 不允许 parser 吞掉 raw response。
- 不允许 base64 image content 输出到终端。
- 不允许 local AI unavailable 触发 app shell 退出。

## 验收信号

建对表现：
- 任一终结记录都能回连到结构化日志 record refs
- debug proof 与 persisted record ref 对齐
- 日志纪律与写账主权清晰分离
- DEBUG 能看到 AI 吃了什么、吐了什么、为什么失败、谁负责、下一步怎么办
- terminal summary 和 full mode 边界清晰，且都能回连到 Forensics refs

漂移信号：
- console 文本充当运行真相
- hidden round finalizer 或 hidden closure 继续充当真相闭合
- runtime snapshot 不是独立 record
- 只有 promptLength、没有 promptHash 或 promptDebugRef
- raw response 被 parser 吞掉后不可回看
