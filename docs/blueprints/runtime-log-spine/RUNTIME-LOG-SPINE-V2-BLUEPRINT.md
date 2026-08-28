# Runtime Log Spine V2 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "runtime-log-spine-v2",
  "status": "active",
  "owner": "runtime-log-spine",
  "lawIds": [
    "LAW-RUNTIME-LOG-SPINE-001-V4",
    "LAW-RUNTIME-LOG-SPINE-002-V4",
    "LAW-RUNTIME-LOG-SPINE-003-V5"
  ],
  "contractRefs": [
    "docs/specs/runtime-log-spine/runtime-log-event-v2.provider.spec.json",
    "docs/specs/runtime-log-spine/runtime-log-event-v2.spec.json"
  ],
  "dependencyEdges": [
    {"contractRef":"docs/specs/runtime-log-spine/runtime-log-event-v2.spec.json","from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"runtime-log-spine","repo":"local"}},
    {"contractRef":"docs/specs/runtime-log-spine/runtime-log-event-v2.spec.json","from":{"domain":"app-shell-ui","repo":"local"},"to":{"domain":"runtime-log-spine","repo":"local"}},
    {"contractRef":"docs/specs/runtime-log-spine/runtime-log-event-v2.spec.json","from":{"domain":"gpt","repo":"local"},"to":{"domain":"runtime-log-spine","repo":"local"}},
    {"contractRef":"docs/specs/runtime-log-spine/runtime-log-event-v2.spec.json","from":{"domain":"local-app-shell","repo":"local"},"to":{"domain":"runtime-log-spine","repo":"local"}},
    {"contractRef":"docs/specs/runtime-log-spine/runtime-log-event-v2.spec.json","from":{"domain":"local-browser-session","repo":"local"},"to":{"domain":"runtime-log-spine","repo":"local"}},
    {"contractRef":"docs/specs/runtime-log-spine/runtime-log-event-v2.spec.json","from":{"domain":"startup-entrypoint","repo":"local"},"to":{"domain":"runtime-log-spine","repo":"local"}}
  ],
  "prohibitedDependencyEdges": [
    {"from":{"domain":"runtime-log-spine","repo":"local"},"to":{"domain":"agent-production-runtime","repo":"local"},"lawId":"LAW-RUNTIME-LOG-SPINE-001-V4"},
    {"from":{"domain":"runtime-log-spine","repo":"local"},"to":{"domain":"gpt","repo":"local"},"lawId":"LAW-RUNTIME-LOG-SPINE-001-V4"},
    {"from":{"domain":"runtime-log-spine","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"},"lawId":"LAW-RUNTIME-LOG-SPINE-001-V4"}
  ]
}
```

## 1. 唯一终态

全系统只保留一个逻辑 Runtime Log Spine 和一个 `RuntimeLogEventV2` 机器合同。AGENT 是合同唯一 Owner；每个进程只有一个 `RuntimeLogger` 和一个机器 Sink。AGENT 写单写者 JSONL segment；Website 把同一脱敏 JSON 事件写 stdout，由 journald 接管。终端人读输出只能是同一事件的投影，不能形成第二 logger、第二 schema、第二日志总线、第二诊断台账或第二事实来源。

```text
production Owner
  -> startSpan / terminalSpan / emitState
  -> RuntimeLogger
  -> RuntimeLogEventV2 严格判别联合
  -> 写前统一脱敏
  -> producer sequence + hash chain
  -> AGENT JSONL 或 Website stdout/journald
  -> logs:inspect（只读流式诊断）
```

不建设 ELK、Kafka、OpenTelemetry 平台、日志数据库、中心日志服务或额外 retention ledger。Production Store 仍拥有 Job/Lease/Checkpoint 真相，Browser WAL 拥有页面 mutation 真相，Forensics 拥有正式 evidence，Website 拥有业务任务与业务结果；日志只拥有脱敏运行诊断，不决定下一步、不重放动作、不裁决业务成功。

## 2. 唯一事件合同

生产事件只有两种：`SPAN` 与 `STATE`。`SPAN` 只有 `started`、`terminal` 两相；`STATE` 只记录初始值、真实变化和现有 heartbeat。禁止通用 payload、动态 refs/hashes/metrics bag、自由 recovery 文本和另一套 snapshot 事件。

公共头精确为：

```text
schemaVersion,eventId,occurredAt,producer,producerRunId,producerSeq,
previousEventHash,eventHash,type,traceId,owner,component,visibility
```

`SPAN started` 精确增加 `phase,spanId,parentSpanId?,boundaryId?,operation,typedIdentity`；`SPAN terminal` 精确增加 `phase,spanId,operation,outcome,durationMs,authorityRef?,authorityHash?,failure?`；成功 terminal 禁止 failure，非成功 terminal 强制 failure。`STATE` 精确增加 `stateKey,previous,current,freshForMs?,authorityRef?,authorityHash?,reconciledFromAuthority?`；初始 STATE 的 previous 必须为 null，后续 previous 必须等于该轴上一 current。`level`、自由 message、payload、refs、hashes、metrics、retryable 与 terminal 布尔值不得进入合同。

`typedIdentity` 是封闭判别联合，只允许 producer、request、job、job-attempt、lease、plugin-step、gpt-call、browser-command、browser-mutation、checkpoint 与 outbox identity。每一分支只携带自身必需的 `requestId/jobId/attemptId/leaseVersion/fenceHash/pluginId/stepId/capabilityCallId/commandId/checkpointId/outboxId`；不得使用任意键对象。operation 也是封闭枚举，纯计算函数不记 Span。

失败只允许：

```text
kind = transport | authentication | contract | admission | dependency |
       storage | browser | provider | internal
impact = BLOCKING | CONSEQUENTIAL | CLEANUP
recovery = retry | backoff | drain | review | stop | none
failure = kind,code,nativeCause?,responsibleOwner,impact,recovery,
          causedByEventId?,httpStatus?
```

`nativeCause` 只在真实底层 cause 存在时出现；网络错误必须保留 `ECONNREFUSED/ECONNRESET/ETIMEDOUT` 等稳定 cause。`CONSEQUENTIAL` 与 `CLEANUP` 必须有 `causedByEventId`，`BLOCKING` 只有确有上游根时才携带该字段。

失败投影必须保留当前边界收到的最内层现役 typed machine code；`cloud.session-open` 之类操作包装码只能用于上层 consequential Span，不得覆盖根 Span 中的 `CLOUD_TRANSPORT_UNAVAILABLE`、HTTP/authentication 或业务拒绝码。底层 cause 只递归提取安全白名单中的稳定网络码；已收到 HTTP response 时同时记录 `httpStatus`。未知 `Error.message` 不得成为 code 或自由文本。

## 3. 原子生命周期

每个真实边界动作只允许一次 `started`，至多一次由真实结果产生的 `terminal`。第一次 terminal 后 handle 物理关闭；第二次 terminal 同步返回 `DUPLICATE_SPAN_TERMINAL`。重试必须创建新 Span 并用 `parentSpanId` 指向原动作，禁止复用 Span 或用 retryable 布尔覆盖生命周期。

进程崩溃、日志截断或来源丢失时不得补造 terminal。诊断必须同时报告 `OPEN_SPAN`、`PRODUCER_STALE`、`INTERRUPTED` 和 `DIAGNOSIS_INCOMPLETE`。Browser 外部动作只按 WAL 报告 `PREPARED`、`DISPATCHED`、`CONFIRMED`、`REJECTED` 或 `FAILED`，不得生成 UNKNOWN outcome。

只记录真实边界：进程 lifecycle；网络、数据库、对象存储和跨进程请求；Cloud contract/session、claim、lease/fence；GPT 与 Browser 物理动作；Browser WAL 状态；checkpoint、upload、first-terminal、Outbox 和 Website consume。纯计算、字段映射和内部 helper 不建立 Span。

生产 operation 的封闭集合包含 `job.checkpoint`、`job.lease-renew`、`job.lease-release` 与 `startup.step`；前三者分别包住真实 checkpoint 写、租约续期与释放边界，`startup.step` 只接受施工图固定的启动步骤 identity，不得由自由 phase/eventType 或 `runtime.start` 文本代替。

## 4. 因果与跨仓边界

Website 创建或继承 `traceId`。每个 Website/AGENT 跨进程请求必须携带一个 opaque `boundaryId`；优先直接复用现有 `request_id` 或 `idempotency_key`，禁止为同一边界再造第二 ID。发送、接收、响应和消费双方同时绑定现有 Job/Attempt/Lease/Fence identity。

`cloud.session-open` 也属于该跨仓合同：AGENT 发送 Span 与 Website session-open 接收/响应 Span 必须复用同一 `request_id` 作为 `boundaryId`。任一侧缺失、换 ID 或不可读时，跨仓诊断必须输出 `BOUNDARY_SOURCE_INCOMPLETE + DIAGNOSIS_INCOMPLETE`，不得把 AGENT 一侧的包装码猜成网站拒绝原因。

同一 producer run 由 `producerSeq` 排序；同一动作由 `spanId/parentSpanId` 连接；跨进程由 `boundaryId` 连接；错误因果由 `causedByEventId` 连接。`occurredAt` 只供人读，不参与跨进程业务排序。诊断器必须返回全部 `blockingRoots[]`：每条 root 都是没有可达上游 BLOCKING ancestor 的独立阻断失败；不得用固定 operation 顺序、最后一条 ERROR 或单一 first failure 代替因果计算。

## 5. 分层运行态

每个状态轴只有一个语义 Owner 和一套允许值，进程启动记录全部初始值，真实变化立即记录：

| 状态轴 | Owner | 允许值 |
|---|---|---|
| `producer.lifecycle` | 本 producer | `starting/ready/stopping/stopped/exit_detected` |
| `producer.alive` | 本 producer heartbeat | `alive` |
| `log.sink` | RuntimeLogger | `ready/failed/capacity_blocked` |
| `website.core` | Website Core | `starting/ready/failed/stopped` |
| `website.worker` | Website Worker | `starting/ready/blocked/failed/stopped` |
| `website.consume` | Website consumer | `idle/pending/running/delivered/failed/review_required` |
| `agent.shell` | AGENT Shell | `starting/ready/failed/stopped` |
| `cloud.contract` | Production Runtime | `ready/blocked` |
| `cloud.session` | Production Runtime | `disconnected/connected/stale` |
| `claim.admission` | Production Runtime | `eligible/blocked/draining` |
| `browser.authority` | Browser Authority | `absent/present/stale` |
| `browser.target` | Browser Target Owner | `absent/claimed/drifted` |
| `job.lifecycle` | Production Store adapter | `accepted/running/recovery_pending/review_required/completed/failed` |
| `job.lease` | Lease Owner | `absent/active/stale/lost` |
| `job.checkpoint` | Checkpoint Owner | `none/persisted/failed` |
| `gpt.execution` | GPT Child | `idle/running/failed/review_required` |
| `browser.execution` | Browser command Owner | `idle/busy/failed/review_required` |
| `browser.mutation` | Browser WAL adapter | `PREPARED/DISPATCHED/CONFIRMED/REJECTED/FAILED` |
| `outbox.delivery` | Outbox Owner | `pending/delivered/failed` |

`producer.alive` 只复用现有 heartbeat，不新增 timer；它的 `freshForMs` 必须等于 `3 * 真实 heartbeat interval + grace`。该 producer heartbeat 过期后，它拥有的各轴统一派生为 `UNKNOWN_STALE`，但其他 producer 的轴保持独立。端到端 ready 只从这些原始轴派生，不再持久化一个总绿灯。

`producer.alive` 证明的是本 producer 进程与现有工作循环仍在运行，不以 Cloud heartbeat 成功为前提。AGENT 必须在现有 session heartbeat 循环的同一 cadence 内投影该轴，Cloud 请求失败时仍分别记录 `producer.alive=alive`、`cloud.session=stale`与 `claim.admission=blocked`；不得新增 timer、把 Cloud 失败写成 Shell 死亡，或用 Shell 存活冒充 Cloud 已连接。

## 6. 完整性、文件与容量

每个 producer run 单写者，`producerSeq` 从 1 严格递增；首事件 `previousEventHash=null`，其后等于上一事件 `eventHash`。hash 使用排除 `eventHash` 后的 UTF-8 canonical JSON；同一 run 跨 segment 继续前一 hash。正常停止必须先写最终 `producer.lifecycle=stopped`、fsync，再关闭文件，该事件 hash 即正常封口。hash 链只证明丢失/篡改/乱序，不替代业务 evidence 或签名。

AGENT 路径固定为 `runtime-logs/<producer>/<producerRunId>-<segment>.jsonl`。唯一可配置容量是 producer 的 `maxTotalBytes`；segment 滚动阈值只能由该值内部派生，不能成为第二配置。达到上限时只删除最旧且同时满足以下条件的 segment：关联 Job 全部终态、没有 OPEN_SPAN、没有未收束 DISPATCHED mutation、没有 pending Outbox、重启权威对账已完成。不得建立 retention ledger；资格直接从日志与现有公共只读 authority 计算。若所有 segment 均受保护，`log.sink=capacity_blocked` 并阻止新 Claim 和新外部 mutation。

当 `--source` 指向目录时，只发现其直接 producer 子目录内符合 `<producerRunId>-<segment>.jsonl` 的 V2 segment；根目录 `workbench.jsonl` 之类布局外退役文件不属于 active source，不读取、不迁移、不增加兼容解析。已进入合法 producer 子目录的任意坏行、坏 segment 或链路缺口仍必须失败关闭。当 `--source` 显式指向普通文件时，它作为声明的 Website journal export 或单一 segment 被严格解析。

中间坏行、sequence 缺口、hash 断裂、跨 segment 断裂或正常封口缺失必须失败关闭。只有文件最后一条截断行可标记为 `TRUNCATED_FINAL_LINE`，仍导致诊断不完整。

## 7. 权威提交与恢复

Production Store、Browser WAL、Checkpoint、Outbox 与 Website 业务事务必须先提交，再记录 `authorityRef + authorityHash`。authority 只允许指向诊断器能够只读重读的持久事实；临时网络回执、内存对象、heartbeat、attestation、一次性 session 或 claim response 不得伪装 authority。Lease 与 Checkpoint 按 `jobId` 持久化当前权威投影，Outbox 按 `idempotencyKey + jobId` 逐项持久化 `pending/delivered/failed`，禁止一个聚合 Outbox 状态代替各项真实状态。若进程在权威提交后、日志写入前崩溃，新 producer run 必须通过现有公共只读接口对账，并记录 `reconciledFromAuthority=true` 的当前 STATE；在该 STATE 出现前输出 `AUTHORITY_RECONCILIATION_PENDING` 与 `DIAGNOSIS_INCOMPLETE`。引用不可读输出 `AUTHORITY_REF_UNVERIFIED`，引用 hash 或状态冲突输出 `AUTHORITY_STATE_MISMATCH`。

Browser mutation 唯一顺序：WAL 提交 PREPARED 后记录 STATE PREPARED；物理发送前冻结正向/负向 postcondition hash，发送后 WAL 提交并记录 STATE DISPATCHED；后置证明完成后，WAL 先提交 CONFIRMED、REJECTED 或 FAILED，再记录同一 `commandId + authorityHash` 的 STATE，最后关闭 browser command Span。DISPATCHED 永不再次发送，只能在原 Target/Document 上只读补核；日志 Sink 故障也不得改变这一事实。

## 8. Sink 失败

`startSpan`、`terminal` 与 `emitState` 都返回显式 `LogWriteResult`，不得 `void`、吞错或 `.catch(() => undefined)`。文件写失败时，同一个 RuntimeLogger 只把同一结构化、已脱敏事件写入 emergency terminal projection，并把内存准入态改为 log sink failed；该投影不冒充完整 hash 链，诊断缺少对应来源时仍是不完整。恢复后必须先完成 Store/WAL/Outbox 对账并落下当前 STATE，才能重新开放新 Claim 或新外部 mutation。

## 9. 唯一诊断器

唯一入口固定为：

```text
logs:inspect --job <jobId> \
  --source <agent-jsonl-root> \
  --source <website-journal-export>
```

它只读流式解析显式来源，不建设常驻服务或复制日志。缺少声明来源输出 `SOURCE_UNAVAILABLE + DIAGNOSIS_INCOMPLETE`。输出必须包含：来源与完整性、各状态轴及新鲜度、最后成功动作、OPEN_SPAN、全部 `blockingRoots[]`、consequential/cleanup 因果链、Browser 副作用/WAL 状态、authority reconciliation、责任 Owner 与 recovery。只有来源、schema、完整性、因果、新鲜度和权威对账全部完整时才可输出 `DIAGNOSIS_COMPLETE`；任何缺口都必须精确说明，禁止 AI 猜根因。

目录来源发现只消费第 6 节的 active V2 segment 布局；布局外旧文件不得把整个新运行误判为 schema 损坏，布局内坏文件也不得被忽略。诊断器不提供旧格式兼容、dual-read 或自动迁移。

## 10. Website 消费合同

AGENT 通过 `runtime-log-spine.runtime-log-event-v2@2` 发布唯一机器合同；Website 只保存 `contractId`、`version` 与 `providerRepo` dependency，并从 RELEASE participant 中解析的唯一匹配 provider contract 生成本仓 validator/type。Website 不复制或手写第二 schema，只拥有 Website producer adapter：创建/继承 trace、复用 boundary、记录 Website 三个状态轴和业务边界、把同一 JSON 事件写 stdout/journald。

AGENT 法案不跨仓支配 Website；跨仓 RELEASE 由各自法案、cross-repo dependency 与母本规定的 participant contract lookup 共同失败关闭。

## 11. 片区删除

同一迁移片区必须物理删除：

- `src/lib/local-runtime/structured-log-bus.ts` 与 `structured-log-terminal.ts`；
- `src/lib/runtime-logs/structured-log-contract.ts`、`evidence-contract.ts` 与旧 trace context；
- 未使用的 stage logger 兼容入口；
- Debug Bundle writer/index 及其自我维持的六文件义务；
- startup 自由字符串事件、生产代码 direct console/process.write、`redact:false`；
- silent log catch、任意 identity/payload bag、第二 snapshot timer、双 retention 阈值；
- 任何 alias、wrapper、dual-read/write、fallback、shadow path 或第二诊断 verdict。

历史文档可以留在 `docs/history`，但不得再被 active manifest、quality route 或生产代码消费。

## 12. 聚焦验收矩阵

Static 必须证明唯一 Logger、严格 SPAN/STATE 联合、封闭 identity/operation/failure/state、统一写前脱敏、Website contract digest、状态唯一 Owner、单写者完整性、WAL 后提交、显式写结果以及退休路径物理为零。Property/state-machine Exam 至少覆盖：

1. `ECONNREFUSED/ECONNRESET/ETIMEDOUT`；
2. HTTP、authentication 与业务拒绝；
3. stale session、lease 与 fence；
4. 空 claim 与 claim refused 的区分；
5. Target/Document 漂移；
6. Browser mutation DISPATCHED 且 postcondition 尚未收束；
7. Provider rejection；
8. checkpoint/renew 失败；
9. upload/outbox 失败；
10. first-terminal race；
11. Website 未消费；
12. authority commit 后、日志前崩溃；
13. Sink 不可写；
14. segment 丢失/坏行/hash 断裂；
15. 跨 boundary 重试错配。

上述矩阵必须另外固定以下回归：根失败保留 typed code 而上层包装仅为 consequential；`nativeCause` 递归提取仅允许安全白名单；目录中退役根文件不进入 active source 而合法 producer 子目录坏文件必须失败；Cloud 不可用时仍沿现有 cadence 证明 Shell 存活且保持 Cloud/Claim 失败关闭；Website/AGENT session-open 同 boundary 完整且任一缺源都不得输出完整跨仓诊断。

每个用例必须同时断言 `blockingRoots[]`、责任 Owner、状态轴、最后成功点、副作用、recovery 与完整/不完整裁决。真实 Dynamic Proof 再覆盖同候选的 Website、AGENT、Cloud、Browser、Storage、Outbox 与恢复；HTTP 200、进程存活、截图、日志文本或历史回执都不能代替真实证据。

## 13. 完成定义

当且仅当所有声明来源可读、事件合同合法、producer/hash/segment 连续、span/boundary/causedBy 因果闭合、状态新鲜、authority reconciliation 完成时，日志可以确定全部独立阻断根、原生 cause、责任 Owner、最后成功点、分层运行态与外部副作用。任一条件不成立时，系统必须准确回答“诊断不完整”及缺口，绝不伪造 READY、首因或业务成功。

正文闭环：Owner 是 `runtime-log-spine`；输入是生产 Owner 提交的严格 SPAN/STATE；输出是脱敏机器日志与确定性诊断；持久化只有 AGENT JSONL 或 Website journald；调用只从生产 Owner 指向 Runtime Log Spine；恢复只核对现有 authority 并补写当前状态；安全边界不接收业务正文和秘密；验收由聚焦 Static/Exam 与适用 Dynamic Proof 分层证明。
