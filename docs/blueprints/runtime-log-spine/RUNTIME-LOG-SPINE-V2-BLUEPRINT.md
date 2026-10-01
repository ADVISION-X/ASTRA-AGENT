# Runtime Log Spine V3 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "runtime-log-spine-v3",
  "status": "active",
  "owner": "runtime-log-spine",
  "lawIds": [
    "LAW-RUNTIME-LOG-SPINE-001-V7",
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
    {"from":{"domain":"runtime-log-spine","repo":"local"},"to":{"domain":"agent-production-runtime","repo":"local"},"lawId":"LAW-RUNTIME-LOG-SPINE-001-V7"},
    {"from":{"domain":"runtime-log-spine","repo":"local"},"to":{"domain":"gpt","repo":"local"},"lawId":"LAW-RUNTIME-LOG-SPINE-001-V7"},
    {"from":{"domain":"runtime-log-spine","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"},"lawId":"LAW-RUNTIME-LOG-SPINE-001-V7"}
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
  -> 完整 JSONL
  -> 状态变化 / 新独立故障 / 启停边界的低噪声 stdout 投影
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

`span.terminal` 只允许 `succeeded|failed|interrupted`；同一 span 至多一个 terminal。failure 必须保存稳定 code、responsible owner、impact、存在时的 allowlisted 原生 cause 和可读 authority/evidence ref。Browser、GPT 与跨仓 HTTP 外层不得把原生原因统一覆盖成 `BROWSER_INFRASTRUCTURE_FAILED` 或其它通用码。不得保存 `retryable` 布尔、任意 recovery 字符串、task state 或通用 payload bag。

failure `impact` 的唯一判定来源固定为：同一失败终结时，进程内是否已携带上游 runtime log cause event 唯一决定结果——携带则必须写 `CONSEQUENTIAL` 且同时写该 `causedByEventId`，未携带才写 `BLOCKING` 且不得写 `causedByEventId`；`CLEANUP` 仍由现役非阻断清理路径独立持有。同一 Owner 的全部失败终结路径必须共用这一判定：失败以 typed result 返回还是以异常抛出，属于实现形态，不得产生不同 `impact`，也不得在跨层转换中丢弃 cause。任一层把已有上游 cause 的失败记为独立 `BLOCKING`，即构成 `LAW-RUNTIME-LOG-SPINE-001-V7` 禁止的“冒充全部独立阻断根”，必须由唯一原生质检失败关闭。本段只记录 `impact` 与 `causedByEventId` 的一致性结构，不新增字段、第二因果链、诊断表或恢复语义，也不自行创设禁令或解冻程序；其效力来自上述 active law。

`cloud.claim` terminal 必须使用 `RuntimeLogEventV2` 合同 V3 唯一新增的封闭 `claimDiagnostics` 记录 Website 已返回的 `outcome + claimed_count + reason_codes`。该对象只允许三个字段：outcome 取 `LEASE_GRANTED|NO_ELIGIBLE_JOB|CAPACITY_ZERO|CLAIM_BLOCKED|DRAINING`，claimed_count 为 0..10 整数且 `LEASE_GRANTED` 当且仅当大于零，reason_codes 为最多 32 个 machine code；只有 `operation=cloud.claim` 且已经取得有效 Website receipt 时才允许并必须存在。零任务仍是成功终态，但不得丢失 Website 给出的安全原因；请求在取得 receipt 前失败时不得伪造该对象。它只解释本次 claim，不得成为任务状态、恢复裁决或通用 payload bag。

V6 control contract version 20 下，`NO_ELIGIBLE_JOB.reason_codes` 只允许 Website 发布的精确闭集。Runtime 原样记录和展示，不翻译为本地状态，也不从日志推断下一动作。

## 3. 隐私与完整性

写入前统一脱敏。凭证、cookie、token、authorization、浏览器 storage、原始 URL/HTML/selector、Prompt、用户输入、附件正文、本地私有路径和 artifact body 不得进入日志。无法证明安全的内容写为 `REDACTED_UNSAFE`。

每个 producer 只有一个 writer，`producerSeq` 单调，segment hash chain 连续。进程崩溃不补造历史失败；未闭合 span 只在读时报告 interrupted/stale，不能改变任务状态。

Browser mutation 事件必须在 WAL durable write 之后产生，并绑定 `productStepId + callId + childId + commandId + authorityHash`。日志中的 dispatched 不许可重放。

原终态交付由现役 Supervisor 装配：WAL commit/readback 后尝试日志并 ACK；日志失败仍 ACK 已提交事实，但不 notify lane，随后撤权/关闭，原 isWritable/getSinkState 禁止新 claim/input。重复 fact 只确认原行，不补造旧 span terminal。ACK 只确认持久化，不能推翻日志故障或授后续工作。

跨 producer run 的同 command Browser WAL terminal 是不可倒退事实，现役 authority resolver 仍须只读核真；不得按随机 producerRunId 或墙钟选出旧 DISPATCHED。终态冲突或权威不可核真继续 DIAGNOSIS_INCOMPLETE，原开放 span 保持 Interrupted/Stale，不补造 span terminal。

## 4. 诊断读取

启动摘要只做当前权威的只读快照：

- Website job: `failed + current_reason` 或 `completed + admission receipt`；
- accepted attempt count 与当前 attempt_failure；
- lease/fence；
- Browser Target/WAL 未决 effect；
- Outbox receipt/last_error/next_delivery_at；
- sink 可写性。

摘要不持久化为第二状态，不从历史日志推演 stepIndex/resumePoint，不把 HTTP 200、进程存活、空队列、Browser paired 或 sink healthy 冒充任务完成。

诊断入口未给 jobId 时，必须从现有 JSONL 有界扫描最近 producer run 并只做 scope discovery：零个活动候选返回 `NO_ACTIVE_SCOPE`，唯一候选才自动选择，多个候选返回 `AMBIGUOUS_SCOPE + candidates[]`，不得按 latest 或时间静默猜选。相同 `responsibleOwner + code + operation + authorityRef/evidenceRef` 的重复根因只形成一条投影，并保留 `count + firstSeenAt + lastSeenAt`。给定 jobId 时继续精确限定该 job。两种入口都直接引用原事件，完整 JSONL 不改写、不删减。

## 5. 终端投影

持久化与终端显示严格分离：事件先完整写入唯一 JSONL，之后才决定是否镜像 stdout。默认终端只显示启动/停止边界、状态事实变化和新独立故障；相同 claim outcome/reason、heartbeat 成功及其它无状态变化的重复成功请求不再次输出。任一失败 code、Owner、authority/evidence identity 变化都必须立即可见。该去重只存在于当前进程内的显示投影，不落库、不影响 event sequence/hash，也不改变 TRACE 显式诊断模式。

## 6. 片区删除与验收

必须物理删除 Runtime Log 中的 `STATE` schema、state reducer、state replay、state projection、startup history reconstruction、`recovery_pending`、`review_required`、`parked`、`delivery_pending`、`flowVersion`、`stepIndex`、`resumePoint` 和 `reconcileOnly` 消费。

保留并聚焦验证：唯一 logger、写前脱敏、单写者顺序、hash integrity、span 原子性、cause chain、WAL-before-log、sink failure 行为和普通人读投影。必须增加 Browser 原生 code 不被外层覆盖、跨仓 HTTP Owner/code 保留、`cloud.claim` 的精确零任务 outcome/count/reason、重复 heartbeat/空 claim 不刷屏、不同故障立即显示、无 jobId 自动发现与根因归并验收；日志测试不得构造或断言第三任务状态。
