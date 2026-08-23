# GrassEye 玄学 AI 生产工厂施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "website-agent-production-control-worker",
  "status": "active",
  "owner": "xuanxue-ai-production",
  "lawIds": [
    "LAW-XUANXUE-AI-PRODUCTION-001-V6"
  ],
  "contractRefs": [
    "docs/specs/xuanxue-ai-production/xuanxue-ai-production-control.pin.spec.json"
  ],
  "dependencyEdges": [
    {
      "from": {"repo": "local", "domain": "xuanxue-ai-production"},
      "to": {"repo": "ADVISION-X/xuanxue-web", "domain": "ai-acceptance"},
      "contractRef": "docs/specs/xuanxue-ai-production/xuanxue-ai-production-control.pin.spec.json"
    }
  ],
  "prohibitedDependencyEdges": []
}
```

状态：active permanent control design
法案：`LAW-XUANXUE-AI-PRODUCTION-001-V6`
唯一业务 owner：`xuanxue-ai-production`
Browser 私有 owner：`local-browser-session`
方案 SHA-256：`85e2b60e0649dac79ba24f055895d6752548456a2c50919baa7ed5097644c48a`

## 永久语义命名与接入

现役生产标识固定使用业务语义：协议为 `xuanxue-ai-production-control`，网站路由根为
`/internal/ai-production/control`，结构使用 `DeviceEnrollment`、`WorkerSessionOpen`、
`CloudExecutionGrant`、`ExecutionFence` 等无代际后缀名称。生产代码、数据库对象、配置、错误码、
package entry 与进程名不得使用 `V+数字`、`v+数字`、纯数字代际、`phase/stage/MVP/preview/next/final`
或 `candidate/canary/migration-required` 表示发布阶段。时间、容量、epoch 和真正的产品业务 stage 是数据，
不属于发布阶段命名；历史迁移文件序号、审计候选身份与退休协议文字只可留在迁移/审计历史，不得被运行时读取或取得主权。

```txt
xuanxue-web canonical production control artifact
  -> one outbound HTTPS Cloud Worker
  -> src/mediator/xuanxue-ai-production-route.ts
  -> src/plugins/xuanxue-ai-production/
  -> Browser Authority public facade
  -> checkpoint / outbox / first-terminal CAS
```

网站 artifact 是现役 Cloud schema/manifest/vector/fixture 的唯一 owner；AGENT builder 生成 strict
validator。Cloud contract 不含 Workspace、Target、Document、command、mutation journal 或 Browser
TTL。Plugin 仍独占固定产品图、本地订单和业务 outcome；Browser 私有合同仍独占于
`local-browser-session`，唯一 WebSocket 不改名、不复制。
网站不得直连 Extension，Extension 不得访问 Cloud；二者只经 AGENT 现役 public facade 间接协作。

## Session 与 readiness

启动顺序固定：

```txt
Shell ready
-> validate hardened device credential and exact environment/origin
-> load permanent control manifest/product contract
-> reconcile local nonterminal ledger and durable outbox
-> open one worker session with higher server epoch and report `worker_instance_id`
-> pair Browser Authority and claim HTTPS Target
-> heartbeat normalized capacity/state
-> receive 45s RuntimeAttestationReceipt + rotated 180s memory token
-> server returns claim_eligible
-> begin typed claim loop
```

上一 session token generation 只允许同 session/epoch 60 秒在途重叠。Browser/Target/attestation
任一缺失都令 browser-required claim blocked；不得先 claim 再以 Browser 错误释放。Heartbeat 独立于
claim，并只在状态变化时完整记录。

## Claim、容量和 durable 接受

Claim request id 是批次幂等键；未知响应重试原 ID，必须读回同一 `claim_batch_id` 与 grants。
合法 outcome 只有 `LEASE_GRANTED|NO_ELIGIBLE_JOB|CLAIM_BLOCKED|CAPACITY_ZERO|DRAINING`。
裁决优先级固定为 `DRAINING -> CLAIM_BLOCKED -> CAPACITY_ZERO -> LEASE_GRANTED ->
NO_ELIGIBLE_JOB`；blocked、superseded 或 contract mismatch 不得伪装成空队列。

Plugin 固定十个业务席位，Browser mutation 固定一个。所有 `queued + recovery_pending` 按
`created_at + job_id` 全局最早，AGENT 本地按 `created_at + job_id + stage ordinal` 串行进入
唯一页面窗口。Browser busy 不等于业务 capacity zero。

Grant 固定 lease 90 秒、accept-by 30 秒、renew 20 秒指引。Plugin 用 monotonic clock 扣除 RTT；
accept 剩余不足 5 秒或 lease 剩余不足 30 秒时，在无副作用条件调用 `LeaseRelease`。本地
`localOrderIdentity` 先 fsync；首个 durable checkpoint 即接受，不另建 ACK。

Cloud job 的唯一状态固定为 `queued -> leased -> inputs_downloading -> factory_running`，随后只可进入
`completed|recovery_pending|review_required|failed`；安全取消进入 `cancelled`，恢复任务仍以原 job
从 `recovery_pending -> leased`。AGENT 本地订单的内部状态不得压缩或改写 Cloud job 状态机。

## Browser 与恢复

Browser side effect 只通过现役 public facade 取得当前 Workspace/Authority/Target/Document/action。
Workspace 不设墙钟过期。断线、重启、Reload、identity drift 或 revoke 后停止新 claim；已接受任务
保持同一 job/attempt/checkpoint 为 `recovery_pending`。重新配对/认领后先对账，再恢复最早任务。

Mutation 只有 `PREPARED -> SEND -> CONFIRMED|FAILED|UNKNOWN`。UNKNOWN 永不自动 replay；
`IF + AND -> THEN` 的每个动作只由自身后置 proof 解析。日志不是 evidence，Browser receipt 不是
业务结果。

## Outbox、控制和接管

Checkpoint、artifact、terminal、cancel、handover 全部写本地 durable outbox；未收到 Cloud receipt
只重试同 request id/payload；同 payload 必须幂等读回同一 receipt。材料与结果只使用 canonical
`object_ref + sha256 + byte_length + media_type`，并绑定 lease-scoped authority、前后重算 hash。
每 job 独立 renew。Control intent 只消费 monotonic control epoch，不复制 job
状态。Handover 由网站原子关闭旧 fence 并建立新 attempt/session-bound fence。

Workbench 分开显示 Shell、Cloud control plane、link/contract/session、Browser Authority/Target、
claim admission、queue/outbox 和 e2e proof。任一局部 ready 不代表端到端 ready。

消费的 canonical 错误码至少包括 `AI_CONTROL_PLANE_NOT_READY`、`AI_SESSION_CONFLICT`、
`AI_SESSION_SUPERSEDED`、`AI_SESSION_TOKEN_STALE`、`AI_RUNTIME_ATTESTATION_STALE`、
`AI_RUNTIME_ATTESTATION_REPLAYED`、`AI_CLAIM_IDEMPOTENCY_CONFLICT`、
`AI_CLAIM_BROWSER_AUTHORITY_ABSENT`、`AI_CLAIM_BROWSER_TARGET_ABSENT`、
`AI_LEASE_ACCEPT_DEADLINE_EXPIRED`、`AI_LEASE_FENCE_STALE`、`AI_TERMINAL_CAS_CONFLICT`、
`CONTRACT_CONTROL_MANIFEST_MISMATCH`、`CONTRACT_PRODUCT_UNSUPPORTED`、
`AGENT_RUNTIME_LEDGER_NOT_RECONCILED` 与 `BROWSER_UNPACKED_RELEASE_IDENTITY_INVALID`；不得改名或补 alias。

## 删除式迁移

同一 change-set 完成永久语义 builder、validator、session client、worker、outbox、tests 和 evidence。
切换依次冻结审计候选、完成双仓实现、由网站 artifact 生成 validator、取得七层证据、网站停止以退休
协议创建 job、AGENT drain 并停止以退休协议 claim、排空活动 lease、保持退休协议终态历史不变、在原
identity 上迁移安全未完成任务并写 event、以一个 release 激活网站/AGENT/Extension 且删除退休协议
active surface、打开现役 session、配对并认领 Target、普通 claim 保持 blocked 只运行一条受限准入
实证、PASS 后把准入从 `restricted` 改为 `open`，最后审计 runtime 仅有永久语义控制协议。
审计候选身份不进入生产标识；旧方案和退休协议证据只保留为历史，不再取得运行主权。

生产准入状态只允许 `blocked|restricted|open|draining`，不得以数字代际、候选、金丝雀、阶段或迁移要求
作为生产状态名。退休协议 route/reader/writer/generated validator/config/package entry/process、外部 HMAC/LNA/localhost、
Cloud callback、第二 worker/mediator/scheduler/store/transport、compatibility/fallback/shadow/
bridge/alias/default/normalization/dual read/write 必须物理为零。激活后无 runtime 退休协议 fallback。

## 验收边界

任务内单项验证依次覆盖 strict contract、session conflict/supersede/token rotation、attestation
stale/replay、typed/idempotent claim、Browser absent no-claim、oldest eligible、十席位一 mutation、
accept/release/renew/checkpoint/CAS、outbox restart、UNKNOWN、handover、drain 和退休协议归零。

Static、Contract Exam、Integration、Fault、Real Chrome、Real Provider、72h Soak 互不替代。真实
receipt 必须绑定双仓 SHA、永久语义 manifest、AGENT build 与 Extension release。未取得真实层时固定
`NOT_PRODUCTION_VERIFIED`。

正确性零容忍项固定包括：双 terminal、stale/foreign fence 写入、未 eligible session 获 lease、
Browser absent 仍发 browser-required lease、production localhost/LNA、Extension Cloud access、
unknown-field default、UNKNOWN replay、重启丢任务、双 eligible session、无 durable event 的状态变化、
退休/现役协议双写、控制协议改写 request hash、stale attestation 获 lease、Browser busy 把业务容量降零。
时效固定为 heartbeat 30 秒、45 秒 stale 停新 claim、90 秒 offline、claim 1–30 秒、合格任务到 lease
P95 不超过 15 秒、lease 90 秒、per-job renew 20 秒，并在一个 heartbeat/claim 周期内公开 block reason。
