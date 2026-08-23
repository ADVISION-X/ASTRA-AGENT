---
description: "玄学网站 AI 生产工厂 V6：唯一 Cloud Pull Worker、worker session/attestation、durable outbox 与 Browser readiness 边界。"
applyTo: "src/plugins/xuanxue-ai-production/**/*.ts,src/mediator/xuanxue-ai-production-route.ts,scripts/acceptance/xuanxue-ai-production.acceptance.ts,scripts/audit/domains/xuanxue-ai-production/**/*.{ts,json},docs/法案辅助文件/GrassEye 玄学 AI 生产工厂施工图.md,docs/法案辅助文件/GrassEye 玄学 AI 本地化生产对接终态施工图.md"
---

# GrassEye 玄学 AI 生产工厂法案

status: active
version: 2026-08-23.v6-session-attestation-cutover
capabilityDomain: xuanxue-ai-production

## 1. 唯一责任与主链

`xuanxue-ai-production` 是 AGENT 内玄学 AI 整单执行的唯一业务 owner。它拥有唯一 Cloud
Worker、Plugin 固定产品图、本地业务状态、checkpoint、durable outbox、`review_required`
与业务结果。它不是网站 Cloud 账本、Browser Authority、Provider transport 或通用 planner owner。

唯一主链固定为：

```txt
xuanxue-web xuanxue-ai-production-v6
  -> AGENT outbound HTTPS Cloud Pull Worker
  -> xuanxue-ai-production mediator route
  -> xuanxue-ai-production Plugin
  -> public capability facade / Browser Authority
  -> durable checkpoint / outbox / first-terminal CAS
```

网站不得逐 stage 遥控 AGENT，不得传入 `nextAction`、action plan、selector、coordinate、
Target、Document、Browser command、provider URL、tab/window 或并发值。Worker 不得直连 Browser
private runtime 或 Plugin private file；Plugin 不得 import 另一 Plugin。网站不得直连 Extension，
Extension 不得访问 Cloud；唯一间接边界是 AGENT 现役 `local-browser-session` public facade。

## 2. V6 canonical 合同与 Owner

唯一活动控制协议是 `xuanxue-ai-production-v6`。V6 manifest/schema/JCS/hash vector/fixture/
error code 的唯一 canonical owner 是 `xuanxue-web/packages/ai-contracts`；AGENT 只由冻结 artifact
生成 strict validator 并核验 manifest hash，不手写第二 Cloud schema、默认值、alias、normalization
或兼容 reader。

跨仓合同只消费：

```txt
device/session/attestation/claim batch
lease/fence/release/renew
checkpoint/control intent/terminal/handover
material metadata/receipt/error envelope
```

Browser Workspace、Authority、Target、Document、selector、command、mutation journal、
Browser command TTL 和墙钟 Workspace TTL 属于 `local-browser-session` 唯一私有 Owner，
不得进入 V6 manifest、Cloud fence、日志或 Cloud receipt。

`control_protocol_version` 与业务 `request_hash` 分离。V5 未完成任务一次性迁移到 V6 时，
原 `job_id/source_task_id/request_hash`、product contract 和 material identity 必须不变；
session/lease/fence 只取得当前控制授权，不得改写业务身份。

## 3. Device credential 与 worker session

持久 device credential 必须是当前 UID owner、regular file、权限 `0600`、非 symlink，并精确绑定
environment、origin、device 与 device epoch。它只可打开 worker session，不可直接 claim、renew、
checkpoint、terminal 或访问材料。

每个 AGENT 进程打开唯一 `worker_session_id + worker_session_epoch + agent_instance_id`。
session epoch 由网站单调分配；同一 device 同一时刻最多一个 `claim_eligible` session。
旧 session 活动未超过 90 秒时新进程必须收到 conflict；超过阈值才可由网站原子 supersede 并签发
更高 epoch。

worker session credential 只驻进程内存，固定 180 秒有效。每次成功 heartbeat 签发下一
generation；上一 generation 只在同 session/epoch 内允许最多 60 秒的已发在途请求。过期、更旧、
superseded、revoked、跨 environment/origin 的 credential 全部失败关闭。session token 不得落盘、
写日志、进入 UI/错误/证据或交给 Extension。

## 4. Heartbeat、attestation 与 claim

Worker 只有在本地非终态账本完成对账后才能 heartbeat。Heartbeat 必须提交单调
`attestation_seq`、AGENT build、V6 manifest hash、产品合同能力、业务总容量 10、Browser action
总容量 1、Browser Authority `present|absent`、Target `claimed|absent`、in-flight、drain 与
ledger-reconciled 状态。

网站返回 45 秒有效、server-signed 的 `RuntimeAttestationReceiptV6`。Claim 只引用该 receipt；
不得在 ClaimRequest 临时自报能力。倒退 sequence 失败关闭。同 request id + sequence + payload hash
的 heartbeat 必须返回同一 receipt/token generation；不同 payload 是 idempotency conflict。

Worker 仅在 server 返回 `worker_session_state=claim_eligible` 且
`claim_admission_state=eligible` 时 claim。ClaimRequest request id 是批次幂等键；响应未知时必须
重试同一 request id，取得同一 `claim_batch_id`、outcome 和 grants 后才能创建下一请求。

HTTP 200 的 typed outcome 只可为：

```txt
LEASE_GRANTED
NO_ELIGIBLE_JOB
CLAIM_BLOCKED
CAPACITY_ZERO
DRAINING
```

Browser-required 队列存在而 Authority/Target/attestation 缺失时必须是 `CLAIM_BLOCKED`，
不得伪装空队列或先取得 lease 再回滚。Claim 慢请求不得阻断独立 heartbeat；轮询遵守服务器
`next_claim_after_ms` 1–30 秒、jitter 与状态变化降噪。

## 5. 身份、容量、顺序与接受

每个 grant/fence 精确绑定 environment、device/device epoch、worker session/session epoch、
job、attempt、lease version、manifest hash 与随机 nonce。旧 session、旧 attempt、旧 lease、旧
fence、late terminal 或 foreign device 不得产生 Browser side effect、checkpoint 或 terminal。

每台设备固定 `max_in_flight=10` 个独立业务/provider execution，Browser mutation 固定
`max_browser_in_flight=1`。Provider 等待不占 Browser lock；Browser lane busy 不把业务容量降成零。
十个任务由 durable priority queue 按不可变 `created_at + job_id + stage ordinal` 全局最早顺序
竞争唯一页面窗口，不得按 service class、recovery partition、registration 或内存顺序插队。

Grant 固定 lease 90 秒、accept-by 30 秒、renew 指引 20 秒。AGENT 用 monotonic clock 扣除 claim
RTT 与安全余量，不把 server timestamp 变成本地墙钟授权。收到时 accept 剩余不足 5 秒或 lease
剩余不足 30 秒，必须在零副作用时 `LeaseReleaseV6`。

Plugin 先持久化并 fsync immutable `localOrderIdentity`，再承认订单。第一个 durable checkpoint
同时是接受证明，不建立第二 ACK 状态机。接受前能力/预算变化，只能在 `accepted_at` 为空、
无 checkpoint/staging/Browser/Provider side effect 时用固定 reason 原子释放；接受后能力丢失进入
同一任务 `recovery_pending`。

## 6. Browser Authority 边界

Browser side effect 前必须通过 `local-browser-session` public facade 取得当前 connection
generation 的 Workspace、Authority、Target、Document、actionId 与相对 TTL。Workspace 只由人工
配对 + HTTPS Target 认领建立，绑定固定 profile/extension/release/directory/site policy，不设置
8 小时或任何墙钟过期。

真实 disconnect、Workbench/Extension/Chrome restart、Reload、identity drift 或 operator revoke
才使 Browser capability 失效。能力缺失时停止新 browser-required claim；已接受任务保持同一
job/attempt/checkpoint lineage 为 `recovery_pending`。重新配对和认领后，先对账本地 ledger，
再恢复全局最早未完成任务。

页面 mutation 由 Browser exact-target owner 先 fsync `PREPARED`，再 `SEND`，最终仅可
`CONFIRMED|FAILED|UNKNOWN`。`UNKNOWN` 永不自动 replay；只有 Plugin 能根据同一真实页面的
正向确认、反向排除、唯一性和有界停止形成业务 outcome，否则固化 `review_required`。

所有页面原子动作统一 `IF + AND -> THEN`。每个 mutation 只由自己的后置读回 proof 解析；
未解析前不得发送下一 mutation。固定 sleep/重试次数不得推进业务状态。日志不是 evidence，
Browser receipt 不是业务终态。

## 7. Checkpoint、outbox、恢复与控制

每个 job 独立 renew。Attestation 过期只阻断新 claim；当前 session 未 supersede/revoke 且 fence
仍有效时，已有任务可 renew、checkpoint 或安全收尾。

Checkpoint、artifact、terminal、cancel、handover 五类 Cloud 写入全部进入本地 durable outbox。
网站 receipt 未确认时只重试同一 request id/payload hash；同 payload 必须幂等读回同一 receipt，
不生成新语义。第一个 terminal CAS
胜出；同 status + payload hash 幂等读回，冲突终态不可覆盖。

材料与结果只消费 canonical `object_ref + sha256 + byte_length + media_type`，下载、暂存、上传与
复用都绑定当前 lease-scoped authority，并在消费前后重算 hash；临时 URL、本地路径与 Browser
私有身份不得进入跨仓合同或扩大对象授权。

`ControlIntentV6` 只消费 monotonic `control_epoch` 的 pause/cancel/takeover/drain，不复制
Job 状态机。Handover 只由网站授权，原子关闭旧 fence、建立新 attempt/session-bound fence；
任一时刻只有一个有效 fence。

常驻 Worker 每轮 poll 先对账本地非终态账本。对账版本至少绑定
`job_id + attempt_id + local status + updated_at + checkpoint`；任一变化必须再次对账，
不得用进程级永久集合屏蔽到重启。进程重启只是重入同一循环，不是恢复触发器。

## 8. 状态、日志与安全

Workbench 必须分开显示：

```txt
Shell Ready
AI Control Plane
AGENT Link / Contract / Worker Session
Browser Authority / Browser Target
Claim Admission
Queue / Outbox
End-to-End Proof
```

heartbeat accepted、claim 200、Browser paired、Target claimed、CI PASS 均不得冒充端到端 ready。
日志完整记录状态变化、block、lease、checkpoint、terminal、stale 与安全拒绝；同状态 heartbeat/
empty claim 聚合。session token、device secret、raw prompt 和 Browser private identity 不得记录。

production 与 isolated-test 必须使用不同 origin、device/session、数据库和对象存储。Extension 不得
持有 Cloud credential。材料访问绑定当前 environment/session/job/attempt/lease/fence/object ref，
按 hash 验证，禁止大对象塞入 claim JSON。

## 9. 一次性切换与物理退休

V6 只能作为一个不可分割跨仓 change-set 激活。切换前冻结双仓候选、manifest/build/Extension
identity 和生产 V5 只读分母，完成静态、Exam、Integration、Fault、Real Chrome、Real Provider
与 soak。之后 drain V5、排空或安全迁移未完成 lease、保留原业务 identity，并在一个 release 同时
激活网站 V6、AGENT V6 与匹配 Extension。

原子激活时必须物理删除/断开 V5 route、reader、writer、generated validator、config、package
entry 与运行进程。先打开 V6 session/Browser pairing/Target，再在普通 claim blocked 状态跑一条
canary；canary PASS 后才开放普通 claim。激活后不存在 runtime fallback 到 V5。

以下生产面必须为零：V4/V5 Cloud reader/writer、玄学 external HMAC/LNA/localhost ingress、
Cloud callback、per-job Browser approval、第二 worker/mediator/scheduler/store/provider/browser
transport、手写 Cloud schema、第二 validator owner、alias/default/normalization/compatibility/
fallback/shadow/bridge/dual reader/dual writer。

## 10. 证据与完成边界

Static Audit、Contract Exam、Integration、Fault、Real Chrome、Real Provider、72h Soak 是七个
不可替代证据层。所有 receipt 必须绑定网站 SHA、AGENT SHA、V6 manifest hash、AGENT build、
Extension release 和当前候选。真实 Provider 证明必须有 authenticated Cloud terminal readback；
caller-supplied candidate 或离线自铸 proof 不合法。

未取得全量真实证据时固定 `NOT_PRODUCTION_VERIFIED`。CI-FULL 只证明当前源码通过唯一完整
法案/类型/验收链，不证明生产账号、Chrome、Provider、部署或发布。

```apex-law
{"lawId":"APEX-XUANXUE-AI-PRODUCTION-001-V6","status":"active","tier":"P0","capabilityDomain":"xuanxue-ai-production","enforcementMode":"machine-blocking","evidenceMode":"law+blueprint+ast+acceptance+real-chrome+real-provider","summary":"Only outbound xuanxue-ai-production-v6 may deliver a complete website order through one session-bound Cloud Worker-to-Mediator-to-Plugin chain; one claim-eligible worker session per device uses server-signed runtime attestation, typed idempotent claim batches, ten durable business lanes, one AGENT-owned Browser mutation lane, durable outbox and first-terminal CAS while preserving the original business identity.","required":["xuanxue-web packages/ai-contracts is the sole V6 control schema manifest vector fixture and error-code owner","AGENT consumes only the frozen canonical artifact to generate its strict validator and verify manifest hash","device epoch plus one worker session epoch and memory-only 180-second session credential with at most 60-second same-session generation overlap","45-second server-signed RuntimeAttestationReceiptV6","typed idempotent ClaimBatchReceiptV6 outcomes and globally oldest eligible created_at plus job_id","browser-required work is never leased before authority-present and target-claimed attestation","fsync immutable local order identity before acceptance","first durable checkpoint is acceptance and no-side-effect LeaseReleaseV6 is the only pre-accept release","max_in_flight=10 and max_browser_in_flight=1","manual pair plus target claim establishes one no-wall-clock-expiry Workspace through the local-browser-session public facade","checkpoint artifact terminal cancel and handover use one durable outbox","first-terminal CAS and explicit foreign-device handover","UNKNOWN never auto-replayed","one atomic V6 cutover physically retires all active V5 routes readers writers validators configs entries and processes","real Chrome and real Provider receipts bind one independently recomputed dual-repo candidate manifest AGENT build Extension release and authenticated Cloud terminal readback"],"forbidden":["V5 active reader writer validator route config package entry or process","Browser Workspace Authority Target Document selector command mutation journal Browser command TTL or wall-clock Workspace TTL in the Cloud contract","device credential used for claim renew checkpoint terminal or material access","session credential persisted logged displayed or given to Extension","two claim-eligible sessions for one device","stale attestation or absent Browser capability receiving browser-required lease","HTTP 200 empty jobs or partial ready presented as end-to-end readiness","xuanxue external HMAC LNA localhost business ingress or Cloud callback","second worker mediator scheduler queue ledger Browser Provider contract owner or transport","service class recovery partition registration order or in-memory ordering bypassing globally oldest eligible work","automatic replay of UNKNOWN or replacement job prompt for a recoverable original","alias default normalization compatibility fallback shadow bridge dual reader or dual writer","stale foreign or caller-minted Chrome Provider candidate receipt"],"clauses":[{"clauseId":"apex-xuanxue-001-v6-session-bound-cloud-pull","statement":"A browser side effect or terminal result is possible only after one V6 worker session passes current device and session epochs, strict canonical contract, 45-second server-signed runtime attestation, typed idempotent claim batch, durable local identity, current session-bound fence and AGENT-owned exact-target checks; ten independent business jobs share one serialized Browser mutation lane, all Cloud writes use the durable outbox, technical discontinuity stays on the same recovery lineage, UNKNOWN is never replayed, globally oldest eligible work runs first, and one atomic cutover leaves no active V5 or second path.","evidenceMode":"model+acceptance+real-chrome+real-provider","ownerDomain":"xuanxue-ai-production"}]}
```

本文件只保存 current active law；历史 V5 只能留在 Git 历史或不可变审计材料，不得进入 active
source、法案、施工图、fixture、validator、验收或运行时。
