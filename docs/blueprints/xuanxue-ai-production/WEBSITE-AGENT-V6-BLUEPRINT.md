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
      "to": {"repo": "nexgen/xuanxue-web", "domain": "ai-acceptance"},
      "contractRef": "docs/specs/xuanxue-ai-production/xuanxue-ai-production-v6.pin.spec.json"
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

启动顺序固定：

```txt
Shell ready
-> validate hardened device credential and exact environment/origin
-> load V6 manifest/product contract
-> reconcile local nonterminal ledger and durable outbox
-> open one worker session with higher server epoch
-> pair Browser Authority and claim HTTPS Target
-> heartbeat normalized capacity/state
-> receive 45s RuntimeAttestationReceiptV6 + next 180s memory token
-> server returns claim_eligible
-> begin typed claim loop
```

上一 session token generation 只允许同 session/epoch 60 秒在途重叠。Browser/Target/attestation
任一缺失都令 browser-required claim blocked；不得先 claim 再以 Browser 错误释放。Heartbeat 独立于
claim，并只在状态变化时完整记录。

## Claim、容量和 durable 接受

Claim request id 是批次幂等键；未知响应重试原 ID，必须读回同一 `claim_batch_id` 与 grants。
合法 outcome 只有 `LEASE_GRANTED|NO_ELIGIBLE_JOB|CLAIM_BLOCKED|CAPACITY_ZERO|DRAINING`。

Plugin 固定十个业务席位，Browser mutation 固定一个。所有 `queued + recovery_pending` 按
`created_at + job_id` 全局最早，AGENT 本地按 `created_at + job_id + stage ordinal` 串行进入
唯一页面窗口。Browser busy 不等于业务 capacity zero。

Grant 固定 lease 90 秒、accept-by 30 秒、renew 20 秒指引。Plugin 用 monotonic clock 扣除 RTT；
accept 剩余不足 5 秒或 lease 剩余不足 30 秒时，在无副作用条件调用 `LeaseReleaseV6`。本地
`localOrderIdentity` 先 fsync；首个 durable checkpoint 即接受，不另建 ACK。

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

## 删除式迁移

同一 change-set 完成 V6 builder、validator、session client、worker、outbox、tests 和 evidence，
drain V5 后以一个 release 激活网站 V6、AGENT V6 与匹配 Extension。普通 claim 保持 blocked，
先跑一条 canary；PASS 后才开放。

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
