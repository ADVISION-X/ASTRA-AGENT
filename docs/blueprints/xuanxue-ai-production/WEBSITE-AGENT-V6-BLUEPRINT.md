# GrassEye 玄学 AI 生产工厂施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "website-agent-v6-worker",
  "status": "active",
  "owner": "xuanxue-ai-production",
  "lawIds": [
    "LAW-XUANXUE-AI-PRODUCTION-001-V6"
  ],
  "contractRefs": [
    "docs/specs/xuanxue-ai-production/xuanxue-ai-production-v6.pin.spec.json"
  ],
  "dependencyEdges": [
    {
      "from": {"repo": "local", "domain": "xuanxue-ai-production"},
      "to": {"repo": "ADVISION-X/xuanxue-web", "domain": "ai-acceptance"},
      "contractRef": "docs/specs/xuanxue-ai-production/xuanxue-ai-production-v6.pin.spec.json"
    },
    {
      "from": {"repo": "local", "domain": "xuanxue-ai-production"},
      "to": {"repo": "local", "domain": "app-shell-ui"},
      "contractRef": null
    },
    {
      "from": {"repo": "local", "domain": "xuanxue-ai-production"},
      "to": {"repo": "local", "domain": "local-app-shell"},
      "contractRef": null
    },
    {
      "from": {"repo": "local", "domain": "xuanxue-ai-production"},
      "to": {"repo": "local", "domain": "local-browser-session"},
      "contractRef": null
    },
    {
      "from": {"repo": "local", "domain": "xuanxue-ai-production"},
      "to": {"repo": "local", "domain": "startup-entrypoint"},
      "contractRef": null
    }
  ],
  "prohibitedDependencyEdges": []
}
```

状态：active V6 terminal
法案：`LAW-XUANXUE-AI-PRODUCTION-001-V6`
唯一业务 owner：`xuanxue-ai-production`
Browser 私有 owner：`local-browser-session`
方案 SHA-256：`85e2b60e0649dac79ba24f055895d6752548456a2c50919baa7ed5097644c48a`

## 接入

```txt
xuanxue-web canonical V6 control artifact
  -> one outbound HTTPS Cloud Worker
  -> src/mediator/xuanxue-ai-production-route.ts
  -> src/plugins/xuanxue-ai-production/
  -> Browser Authority public facade
  -> checkpoint / outbox / first-terminal CAS
```

网站 artifact 是 V6 Cloud schema/manifest/vector/fixture 的唯一 owner；AGENT builder 生成 strict
validator。Cloud contract 不含 Workspace、Target、Document、command、mutation journal 或 Browser
TTL。Plugin 仍独占固定产品图、本地订单和业务 outcome；Browser 私有合同仍独占于
`local-browser-session`，唯一 WebSocket 不改名、不复制。
网站不得直连 Extension，Extension 不得访问 Cloud；二者只经 AGENT 现役 public facade 间接协作。

## Session 与 readiness

运行依赖次序固定；其中只有第一段由 `grasseye:start` 自动执行：

```txt
Shell ready
-> keep diagnostic HTTP/status surface available even when execution dependencies fail
-> validate hardened device credential and exact environment/origin
-> load V6 manifest/product contract
-> reconcile local nonterminal ledger and durable outbox
-> open one worker session with higher server epoch and report `worker_instance_id`
```

Browser Authority 配对、正确 HTTPS Target 认领、Browser-required 测试任务创建与可领取任务的 claim
均不属于启动器动作。它们只在 Shell 已建立后，由各自现役 Owner 的显式人工或正常运行流程执行；未完成时
必须保持 Browser/Target/claim 为 absent 或 blocked，而不能通过自动化动作把启动器写成第二业务链。

本地双仓联调固定使用 `isolated-test`：网站 origin 为 `http://127.0.0.1:4322`，本 Shell origin 为
`http://127.0.0.1:4173`。enrollment 只允许首次 isolated-test 设备、凭据撤销、合法环境切换或
origin/device epoch/合同身份变化时显式执行；普通启动与失败恢复不得重建设备，也不得使用 production
device、credential、queue、状态或对象存储身份。

跨仓 session、heartbeat、claim、renew、release 与 terminal 只可在同一现役 provider descriptor 完整证明
endpoint、认证、request/response schema 与 manifest hash 后运行。descriptor 缺失、candidate 漂移或任一项不兼容
时 Shell 继续诊断而 claim/e2e 保持 blocked；不得为此新增 route mapping、compatibility route、alias、fallback、
bridge、dual-read 或 dual-write。

```txt
explicit Browser Authority + Target state
-> heartbeat normalized capacity/state
-> receive 45s RuntimeAttestationReceiptV6 + next 180s memory token
-> server returns claim_eligible
-> normal typed claim loop
```

上一 session token generation 只允许同 session/epoch 60 秒在途重叠。Browser/Target/attestation
任一缺失都令 browser-required claim blocked；不得先 claim 再以 Browser 错误释放。Heartbeat 独立于
claim，并只在状态变化时完整记录。

Cloud credential、Provider、worker session、Browser Authority 或 Target 失败时，Shell 仍须提供
health/status 诊断面，同时将 execution/claim 精确标为 blocked。该降级状态不得创建第二
Shell、第二 worker 或临时 fallback，恢复时也不得重复建立 Browser/session Owner。

## Claim、容量和 durable 接受

Claim request id 是批次幂等键；未知响应重试原 ID，必须读回同一 `claim_batch_id` 与 grants。
合法 outcome 只有 `LEASE_GRANTED|NO_ELIGIBLE_JOB|CLAIM_BLOCKED|CAPACITY_ZERO|DRAINING`。
裁决优先级固定为 `DRAINING -> CLAIM_BLOCKED -> CAPACITY_ZERO -> LEASE_GRANTED ->
NO_ELIGIBLE_JOB`；blocked、superseded 或 contract mismatch 不得伪装成空队列。

Plugin 固定十个业务席位，Browser mutation 固定一个。所有 `queued + recovery_pending` 按
`created_at + job_id` 全局最早，AGENT 本地按 `created_at + job_id + stage ordinal` 串行进入
唯一页面窗口。Browser busy 不等于业务 capacity zero。

Grant 固定 lease 90 秒、accept-by 30 秒、renew 20 秒指引。Plugin 用 monotonic clock 扣除 RTT；
accept 剩余不足 5 秒或 lease 剩余不足 30 秒时，在无副作用条件调用 `LeaseReleaseV6`。本地
`localOrderIdentity` 先 fsync；首个 durable checkpoint 即接受，不另建 ACK。

Cloud job 的唯一状态固定为 `queued -> leased -> inputs_downloading -> factory_running`，随后只可进入
`completed|recovery_pending|review_required|failed`；安全取消进入 `cancelled`，恢复任务仍以原 job
从 `recovery_pending -> leased`。AGENT 本地订单的内部状态不得压缩或改写 Cloud job 状态机。

## Browser 与恢复

Browser side effect 只通过现役 public facade 取得当前 Workspace/Authority/Target/Document/action。
Workspace 不设墙钟过期。断线、重启、Reload、identity drift 或 revoke 后停止新 claim；已接受任务
保持同一 job/attempt/checkpoint 为 `recovery_pending`。重新配对/认领后先对账，再恢复最早任务。

Browser 私有 Owner 必须先取得唯一排他 Owner lock，再打开、完整验证并绑定唯一 append-only proof
journal 的当前尾部；构造阶段、等待锁阶段和锁外不得缓存 sequence 或 previous-entry hash。Authority、
Target、Document、command 与 lifecycle 事件只允许在该锁持有期间 durable 追加。shutdown 固定先撤销
Workspace/Authority、写入并 fsync revoke 事件，再释放 Owner lock；新进程取得锁后必须重新读取最新尾部，
不得沿用取得锁前的内存快照。

proof journal 任一 schema、sequence、previous hash、entry hash 或尾行完整性失败时，Shell 与只读诊断面
保持可用，但 Browser Authority、Target、execution 与 claim 必须失败关闭。恢复不得截断、重排、重算、
覆盖或分叉续写原 journal，不得建立第二活动 journal/epoch；任何恢复都必须由 `local-browser-session`
Owner 保留原文件 hash 和明确 recovery receipt，且不能把旧候选历史冒充当前 Browser proof。

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

同一 change-set 完成 V6 builder、validator、session client、worker、outbox、tests 和 evidence。
切换依次冻结候选、双仓实现、由网站 artifact 生成 validator、取得七层证据、网站停建 V5 job、
AGENT drain 并停 claim V5、排空活动 lease、保持终态 V5 历史不变、在原 identity 上迁移安全未完成
任务并写 event、以一个 release 激活网站/AGENT/Extension 且删除 V5 active surface、打开 V6 session、
配对并认领 Target、普通 claim 保持 blocked 只跑一条 canary、PASS 后开放、最后审计 runtime 仅 V6。
旧方案和 V5 证据只保留为历史，不再取得运行主权。

V5 route/reader/writer/generated validator/config/package entry/process、外部 HMAC/LNA/localhost、
Cloud callback、第二 worker/mediator/scheduler/store/transport、compatibility/fallback/shadow/
bridge/alias/default/normalization/dual read/write 必须物理为零。激活后无 runtime V5 fallback。

## 验收边界

任务内单项验证依次覆盖 strict contract、session conflict/supersede/token rotation、attestation
stale/replay、typed/idempotent claim、Browser absent no-claim、oldest eligible、十席位一 mutation、
accept/release/renew/checkpoint/CAS、outbox restart、UNKNOWN、handover、drain 和 V5-zero。

Static、Contract Exam、Integration、Fault、Real Chrome、Real Provider、72h Soak 互不替代。真实
receipt 必须绑定双仓 SHA、V6 manifest、AGENT build 与 Extension release。未取得真实层时固定
`NOT_PRODUCTION_VERIFIED`。

正确性零容忍项固定包括：双 terminal、stale/foreign fence 写入、未 eligible session 获 lease、
Browser absent 仍发 browser-required lease、production localhost/LNA、Extension Cloud access、
unknown-field default、UNKNOWN replay、重启丢任务、双 eligible session、无 durable event 的状态变化、
V5/V6 双写、控制协议改写 request hash、stale attestation 获 lease、Browser busy 把业务容量降零。
时效固定为 heartbeat 30 秒、45 秒 stale 停新 claim、90 秒 offline、claim 1–30 秒、合格任务到 lease
P95 不超过 15 秒、lease 90 秒、per-job renew 20 秒，并在一个 heartbeat/claim 周期内公开 block reason。
