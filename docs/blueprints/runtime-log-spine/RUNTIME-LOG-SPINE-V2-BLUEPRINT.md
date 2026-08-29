# Runtime Log Spine V2 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "runtime-log-spine-v2",
  "status": "active",
  "owner": "runtime-log-spine",
  "lawIds": [
    "LAW-RUNTIME-LOG-SPINE-001-V5",
    "LAW-RUNTIME-LOG-SPINE-002-V4",
    "LAW-RUNTIME-LOG-SPINE-003-V6"
  ],
  "contractRefs": [
    "docs/specs/runtime-log-spine/runtime-log-event-v2.provider.spec.json",
    "docs/specs/runtime-log-spine/runtime-log-event-v2.spec.json"
  ],
  "dependencyEdges": [
    {"contractRef":"docs/specs/runtime-log-spine/runtime-log-event-v2.spec.json","from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"runtime-log-spine","repo":"local"}},
    {"contractRef":"docs/specs/runtime-log-spine/runtime-log-event-v2.spec.json","from":{"domain":"app-shell-ui","repo":"local"},"to":{"domain":"runtime-log-spine","repo":"local"}},
    {"contractRef":"docs/specs/runtime-log-spine/runtime-log-event-v2.spec.json","from":{"domain":"gpt","repo":"local"},"to":{"domain":"runtime-log-spine","repo":"local"}},
    {"contractRef":"docs/specs/runtime-log-spine/runtime-log-event-v2.spec.json","from":{"domain":"local-browser-session","repo":"local"},"to":{"domain":"runtime-log-spine","repo":"local"}}
  ],
  "prohibitedDependencyEdges": [
    {"from":{"domain":"runtime-log-spine","repo":"local"},"to":{"domain":"agent-production-runtime","repo":"local"},"lawId":"LAW-RUNTIME-LOG-SPINE-001-V5"},
    {"from":{"domain":"runtime-log-spine","repo":"local"},"to":{"domain":"gpt","repo":"local"},"lawId":"LAW-RUNTIME-LOG-SPINE-001-V5"},
    {"from":{"domain":"runtime-log-spine","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"},"lawId":"LAW-RUNTIME-LOG-SPINE-001-V5"}
  ]
}
```

## 1. 唯一职责

Runtime Log Spine 是一个普通结构化日志系统，只记录受控 `event`、`span.started`、`span.terminal` 和 `error`。它回答“什么时间、哪个 Owner、哪个调用、发生了什么、直接影响是什么”，不回答任务现在处于哪个流程状态。

```text
production code
  -> RuntimeLogger
  -> redact-before-write
  -> event | span | error
  -> single writer + sequence/hash integrity
  -> JSONL / stdout
```

禁止 `STATE` 事件、状态轴、历史事件重放、全局状态 projection、recovery decision、flow position 和第二日志总线。Website 任务表是 `failed/completed` 的唯一状态真相；Browser WAL 是 mutation 真相；Outbox 是发送真相；Forensics 是 proof 真相。

## 2. 事件合同

所有事件具有：

```text
schemaVersion
eventId
producerRunId
producerSeq
emittedAt
kind = event | span.started | span.terminal | error
owner
operation
traceId
spanId?
parentSpanId?
jobId?
attemptId?
productStepId?
callId?
childId?
code?
impact?
authorityRef?
evidenceRef?
causedByEventId?
```

`span.terminal` 只允许 `succeeded|failed|interrupted`；同一 span 至多一个 terminal。failure 必须保存稳定 code、responsible owner、impact、存在时的原生 cause 和可读 authority/evidence ref。不得保存 `retryable` 布尔、任意 recovery 字符串、task state 或通用 payload bag。

## 3. 隐私与完整性

写入前统一脱敏。凭证、cookie、token、authorization、浏览器 storage、原始 URL/HTML/selector、Prompt、用户输入、附件正文、本地私有路径和 artifact body 不得进入日志。无法证明安全的内容写为 `REDACTED_UNSAFE`。

每个 producer 只有一个 writer，`producerSeq` 单调，segment hash chain 连续。进程崩溃不补造历史失败；未闭合 span 只在读时报告 interrupted/stale，不能改变任务状态。

Browser mutation 事件必须在 WAL durable write 之后产生，并绑定 `productStepId + callId + childId + commandId + authorityHash`。日志中的 dispatched 不许可重放。

## 4. 诊断读取

启动摘要只做当前权威的只读快照：

- Website job: `failed + current_reason` 或 `completed + admission receipt`；
- accepted attempt count 与当前 attempt_failure；
- lease/fence；
- Browser Target/WAL 未决 effect；
- Outbox receipt/last_error/next_delivery_at；
- sink 可写性。

摘要不持久化为第二状态，不从历史日志推演 stepIndex/resumePoint，不把 HTTP 200、进程存活、空队列、Browser paired 或 sink healthy 冒充任务完成。

## 5. 片区删除与验收

必须物理删除 Runtime Log 中的 `STATE` schema、state reducer、state replay、state projection、startup history reconstruction、`recovery_pending`、`review_required`、`parked`、`delivery_pending`、`flowVersion`、`stepIndex`、`resumePoint` 和 `reconcileOnly` 消费。

保留并聚焦验证：唯一 logger、写前脱敏、单写者顺序、hash integrity、span 原子性、cause chain、WAL-before-log、sink failure 行为和普通人读投影。日志测试不得构造或断言第三任务状态。
