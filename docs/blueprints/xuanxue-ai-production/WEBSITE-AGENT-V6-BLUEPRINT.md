# GrassEye 玄学 AI Local Order Execution Runtime 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "website-agent-v6-worker",
  "status": "active",
  "owner": "xuanxue-ai-production",
  "lawIds": [
    "LAW-XUANXUE-AI-PRODUCTION-001-V12"
  ],
  "contractRefs": [
    "docs/specs/xuanxue-ai-production/product-execution-contract.dependency.spec.json",
    "docs/specs/xuanxue-ai-production/xuanxue-ai-production-v6.dependency.spec.json"
  ],
  "dependencyEdges": [
    {
      "from": {"repo": "local", "domain": "xuanxue-ai-production"},
      "to": {"repo": "ADVISION-X/xuanxue-web", "domain": "ai-acceptance"},
      "contractRef": "docs/specs/xuanxue-ai-production/product-execution-contract.dependency.spec.json"
    },
    {
      "from": {"repo": "local", "domain": "xuanxue-ai-production"},
      "to": {"repo": "ADVISION-X/xuanxue-web", "domain": "ai-acceptance"},
      "contractRef": "docs/specs/xuanxue-ai-production/xuanxue-ai-production-v6.dependency.spec.json"
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
法案：`LAW-XUANXUE-AI-PRODUCTION-001-V12`
唯一 Local Order Execution Runtime Owner：`xuanxue-ai-production`
Browser 私有 owner：`local-browser-session`
## 接入

```txt
xuanxue-web canonical V6 control artifact
  + authenticated immutable Cloud order
  -> one outbound HTTPS Cloud Worker
  -> src/mediator/xuanxue-ai-production-route.ts
  -> src/plugins/xuanxue-ai-production/ immutable Local Order
  -> generic generated Stage executor / checkpoint / recovery
  -> Browser Authority public facade
  -> checkpoint / outbox / first-terminal CAS
```

网站 artifact 是 V6 Cloud schema/manifest/vector/fixture 的唯一 owner；AGENT 只维护消费端最小严格
wire parser，不复制网站合同 artifact。Cloud contract 不含 Workspace、Target、Document、command、mutation journal 或 Browser
TTL。Plugin 只拥有 immutable local order、local Stage state、execution/recovery、
Provider/Browser capability sequencing、checkpoint 和 result；Product Execution Contract canonical、
跨 Job Product Graph、product-specific Stage topology、parent/join 与业务完成裁决均归网站。
Browser 私有合同仍独占于
`local-browser-session`，唯一 WebSocket 不改名、不复制。
网站不得直连 Extension，Extension 不得访问 Cloud；二者只经 AGENT 现役 public facade 间接协作。

## Product Execution 与本地边界

网站是玄学产品完整 FLOW 的唯一 source。AGENT 只通过两份最小 dependency spec 声明
`contractId + version + providerRepo`，本仓不得保存 provider commit、provider contract bytes、
provider artifact hash 或产品 bundle 副本。跨仓合同存在性与版本只在 RELEASE 从必要 participant
的原生 Git commit 扫描；CHANGE 与 READY 不读取或固定 provider 工作树。

每张 Cloud grant 必须在 claim、local immutable order、Stage 开始、checkpoint、terminal 与结果
readback 逐点匹配同一非空 `product_contract_hash`。网站把已裁决的本 Job Stage 按顺序装入经过
鉴权的 immutable Cloud order；本地 generic executor 只按该不可变顺序建立 Stage 链，不读取产品
映射、不推导后继 Job、不裁决跨 Job graph。parent、typed join 与 conversation 只验证 Cloud order
携带的具名身份、hash 和 checkpoint，不另查本地产品表。completed Stage 默认不重跑，已有 checkpoint 不重复 submit，UNKNOWN mutation
永不自动 replay；恢复只回到原 job、attempt、order、Stage 与 checkpoint。

AGENT 不得创建网站后继 Cloud Job，不得根据 Provider 回答、Browser 页面、token 长度或 operator
偏好增删、重排、替换或追加业务 Stage。活动 runtime 中不得保留手写 product→Stage profile、
followup/reusable-base parent map、join count、conversation mode 或 productId 特例分支；本地 profile
只能从已鉴权 immutable Cloud order 的 materials 顺序生成。

Cloud order 和 V6 均不得包含 selector、css、xpath、坐标、JavaScript、tab/window、
任意 Browser action list、provider URL、browser command、next action、sleep 或 retry click。
这些物理动作只能由 Browser Authority public facade 根据当前页面与 action registry 裁决。

## Session 与 readiness

运行依赖次序固定；其中只有第一段由 `grasseye:start` 自动执行：

```txt
Shell ready
-> keep diagnostic HTTP/status surface available even when execution dependencies fail
-> validate hardened device credential and exact environment/origin
-> validate local consumer parser and dependency declarations
-> reconcile local nonterminal ledger and durable outbox
-> open one worker session with higher server epoch, atomically supersede the same device's prior session without a wall-clock wait, and report `worker_instance_id`
```

Browser Authority 配对、Browser-required 生产任务创建与可领取任务的 claim 均不属于启动器动作。扩展只在
Shell 建立后自动配对 Authority；空闲 Target 必须保持 absent。exact job durable 接受后，第一个 Browser 原子
动作才通过唯一 public facade 创建或认领正确 HTTPS Target，不能把启动器写成第二业务链。

双仓运行只有 `production`：网站与 PostgreSQL 当前共同安装在本地 Mac，未来共同迁移到正式服务器；
AGENT 始终留在用户本地 Mac，作为独立执行端主动连接网站，不进入服务器部署单元。当前网站 origin 为
`http://127.0.0.1:4322`，本 Shell origin 为 `http://127.0.0.1:4173`；迁移服务器后 AGENT 使用网站正式
HTTPS origin。enrollment 只允许首次 production 设备、凭据撤销或 origin/device epoch/合同身份变化时
显式执行；普通启动与失败恢复不得重建设备，也不得产生第二 device、credential、queue、状态或对象存储身份。

跨仓 session、heartbeat、claim、renew、release 与 terminal 只可在同一现役 provider descriptor 完整证明
endpoint、认证、request/response schema 与 manifest hash 后运行。descriptor 缺失、candidate 漂移或任一项不兼容
时 Shell 继续诊断而 claim/e2e 保持 blocked；不得为此新增 route mapping、compatibility route、alias、fallback、
bridge、dual-read 或 dual-write。

```txt
explicit Browser Authority state；Target 可为 absent
-> heartbeat normalized capacity/state
-> receive 45s RuntimeAttestationReceiptV6 + next 180s memory token
-> server returns claim_eligible
-> normal typed claim loop
-> exact job durable accept
-> one job-bound Target acquisition
```

上一 session token generation 只允许同 session/epoch 60 秒在途重叠。Browser Authority 或 attestation
缺失令 browser-required claim blocked；空闲 Target absent 是合法事实，不阻断 exact job claim。job durable
接受后 Target acquisition 失败必须保持同一 job/attempt/checkpoint 恢复，不能回滚 claim、重放物理动作或
创建第二任务。Heartbeat 独立于 claim，并只在状态变化时完整记录。

Cloud credential、Provider、worker session 或 Browser Authority 失败时，Shell 仍须提供 health/status 诊断面，
同时将 execution/claim 精确标为 blocked；空闲 Target absent 只保持独立状态维，不降低 Shell/claim。该降级状态不得创建第二
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
grant 与 `localOrderIdentity` 在同一 SQLite transaction 持久化；不得另写 `production_cloud_claim_ledger`。
原 job recovery 的新 attempt/lease/fence 只替换 `cloudExecutionIdentity`；其余业务 Order 必须按结构语义等价
鉴权，JSON 对象键顺序不属于身份，禁止用 `JSON.stringify` 字节序比较。durable accept 前拒绝时，本地结构化
日志保留真实因果码，网站 `LeaseReleaseV6` 的标准 reason 只表示释放分类，不得被解释成根因裁决。
进程中断留下 `Order=running` 且至少一个非终态 Stage=`recovery_pending`、其余 Stage 仅为 queued/completed
时，是原 job 的精确恢复形态；新 recovery lease 接受事务先把 Order 收敛为 `recovery_pending` 并替换 fence，
再由原 Stage 检查点继续。completed/failed/review_required Order 或 Stage 不得从该路径重开。
首个 durable checkpoint 即接受，不另建 ACK。每 job 由同一个结构化 lifetime 同时拥有执行与 renew：
瞬时 renew 网络错误只在 lease safety budget 内重试；确认 lease/fence 丢失后立即禁止新 Browser、Provider
和 Cloud mutation，abort 并等待原执行 settle，settle 前不得从 active 移除或启动同 job 第二执行。

每次 renew 只严格消费网站唯一完整 `LeaseRenewV6` receipt。顶层精确字段为
`schema_version=xuanxue-ai-lease-renew-receipt.v6`、`job_id`、`server_now`、`lease_expires_at`、
`renew_after_ms`、`control_intent`；内层 `ControlIntentV6` 精确字段为
`schema_version=xuanxue-ai-control-intent.v6`、同一 `job_id`、`intent`、`control_epoch`、
`reason_code`。AGENT 不得另建删减字段的本地 response schema，不得 strip 网站字段，也不得以 adapter、
fallback 或兼容 parser 吞掉合同漂移。

Cloud job 的唯一状态固定为 `queued -> leased -> inputs_downloading -> factory_running`，随后只可进入
`completed|recovery_pending|review_required|failed`；安全取消进入 `cancelled`，恢复任务仍以原 job
从 `recovery_pending -> leased`。AGENT 本地订单的内部状态不得压缩或改写 Cloud job 状态机。

## Browser 与恢复

Browser side effect 只通过现役 public facade 取得当前 Workspace/Authority/Target/Document/action。exact job
durable 接受后才可取得 Target，这是唯一 Target 创建/认领入口；Authority READY 不得预取。
Workspace 不设墙钟过期。断线、重启、Reload、identity drift 或 revoke 后停止新 claim；已接受任务
保持同一 job/attempt/checkpoint 为 `recovery_pending`。重新配对/认领后先对账，再恢复最早任务。

Browser 私有 Owner 只在现有 SQLite/WAL 内持久化当前 mutation。每行精确绑定 `command_id`、job/fence、
Target/Document/action、`PREPARED|SENT|CONFIRMED|FAILED|UNKNOWN`、request/payload/proof hash；发送前事务写
PREPARED，发送边界写 SENT，后置只读 proof 原子解析 terminal。启动只查询未解析 row 并恢复只读对账；
不得全量扫描 `proof-events.ndjson`、维护 lifecycle hash-chain、archive/recovery receipt 或 recovery genesis。
当前 Dynamic Proof 直接绑定当前 Browser command receipt 与发布候选，不从历史生命周期账本推导。

Mutation 只有 `PREPARED -> SEND -> CONFIRMED|FAILED|UNKNOWN`。UNKNOWN 永不自动 replay。
Browser 执行不使用 IF/AND/THEN 文字 DSL，而使用一条受保护状态迁移：

```txt
OBSERVE_CURRENT_SURFACE
-> WAITING | READY_NOOP | READY_ACTION | AMBIGUOUS | DOCUMENT_CHANGED
-> 最多一次物理动作
-> VERIFY_DIRECT_POSTCONDITION
-> PERSIST_CHECKPOINT
```

`OBSERVE_CURRENT_SURFACE` 在同一 Target/Document 上一次读取当前步骤决策不可分割的最小完整可见事实；
不得用多个顺序 DOM find 拼接可能来自不同页面帧的状态，也不得用旧快照授权后续动作。0 个候选为
`WAITING`，只能有界退避后取得新快照且不点击；1 个精确候选才可 `READY_ACTION`；大于 1 个为
`AMBIGUOUS` 并失败关闭。Target/Document 失效必须是 `DOCUMENT_CHANGED` 或恢复错误，不能被吞成页面
未挂载；禁止固定 100ms 高频轮询、catch-all 重试、selector fallback 和任务级倒计时推进状态。

执行档位步骤只观察当前可见的能力菜单表面，按快照派生
`NEED_OPEN_MENU|NEED_EXPAND_ADVANCED|NEED_OPEN_MODEL|NEED_SELECT_MODEL|NEED_OPEN_REASONING|
NEED_SELECT_REASONING|PROFILE_READY`。每次只执行派生出的一个动作，然后重新读取当前表面；最终必须在
同一份终态快照中同时精确证明模型与推理档位。现役 trigger 的可见 `Pro` 只表示菜单入口，不携带
模型与推理终态；菜单关闭只证明点击结束，不证明选择正确；不得用 `高` 命中 `极高` 或部分模型名。
所有 Browser-required 生产 Stage 都必须在 immutable Order 中携带完整 `provider_execution_profile`，
AGENT 不得因产品不是本地化而跳过执行档位及其 proof。

fresh 非 continuation 对话在进入附件步骤前，只用一份当前 turn 表面快照确认历史 user/assistant turn 均为 0；
此否定性检查的 `count=0` 本身就是终态证据，不要求不存在节点的 `matches` 字段，非 0 才校验精确 turn
身份并失败关闭；不得调用回答稳定器等待不存在的历史回答。已经在同一 Target/Document 持久化的执行档位
终态 proof 是本次执行的 checkpoint，后续零 mutation 的提交前恢复必须从该 checkpoint 继续，不得重新打开或
点击模型菜单；Target/Document 改变时该 checkpoint 失效并重新观察。附件步骤只保留一份当前可见
composer/附件表面决策、至多一次 exact-target batch mutation 和一份包含可见精确文件名的直接后置条件。
附件展示名由输入 ordinal、输入文件名与内容 hash 唯一确定，不得使用 attempt 随机后缀。可见前置条件只证明
当前 Document、唯一空 composer 与空附件表面；不得把 document-global form、上传前可能不存在的 send button、
删除按钮文案、删除按钮数量或隐藏 `#upload-files` 纳入许可。`#upload-files` 是 Browser Authority 在该次原子
`attachFile` mutation 内部解析的唯一私有 target，上层不得重复鉴权。mutation 返回后只取得一份直接精确
文件名快照；重复 upload preflight、固定 stable poll 或仅以等待时长证明上传成功都不构成证据。
附件表面若明确为空，才许可一次 mutation；若进程中断后的新 lease 在同一可见表面已观察到全部确定性精确
文件名，则必须以零 mutation 补齐附件 proof，不得再次上传；部分、额外或无法解释的附件集合立即失败关闭。
精确表面合同不匹配为
`ATTACHMENT_SURFACE_CONTRACT_MISMATCH` 并失败关闭，不得压缩成通用 `BROWSER_TARGET_INVALID` 后重跑整个
Stage。只有明确的 Target/Document/channel 失效才进入 recovery。
附件 precondition 在 mutation 之前失败且 `uploadedFiles=[]` 时，Cloud 为原 job 续发 recovery lease 后必须让
同一 Local Stage 在新 fence 下重新进入；不得只 rebound Local Order 后把旧 `recovery_pending` 原样回传。
重进时清空 Stage 当前物化层里的旧 `aiFeedResult/attachmentUploadProof/raw output`，由新 attempt 重新写入；
旧 attempt 的事实留在唯一 web-chat execution ledger，不把旧失败 proof 当作新 attempt 的漂移基线。
一旦 attachment mutation 已发送、存在 uploadedFiles 或返回 `BROWSER_OUTCOME_UNKNOWN`，则不得自动重放；
只能由同一直接精确文件名后置条件结算，或保留旧 UNKNOWN 并在后续 lease 以零 mutation 识别同一确定性文件
集合后补齐业务 proof；无法识别时失败关闭。

每个 Browser mutation 是不可拆交易：当前快照许可 -> 精确一次物理动作 -> 同一动作的只读直接后置
观察 -> 一份 page-action proof -> 解析 pending mutation。物理动作发出后，无论 transport 返回正常
summary 还是 `BROWSER_OUTCOME_UNKNOWN` 都不得重放；未能精确结算时停在原 checkpoint 并保留 UNKNOWN，
不得执行第二 mutation。相对 deadline 只可界定当前未解析 transition 并安全停止，不得充当状态证据。
日志不是 evidence，Browser receipt 不是业务结果。

## Outbox、控制和接管

Checkpoint、artifact、terminal、cancel、handover 全部写本地 durable outbox；未收到 Cloud receipt
只重试同 request id/payload；同 payload 必须幂等读回同一 receipt。材料与结果只使用 canonical
`object_ref + sha256 + byte_length + media_type`，并绑定 lease-scoped authority、前后重算 hash。
同一 pending outbox row 任一时刻只有一个发送/确认 owner：active job 直接发送时后台 flush 不运行；active job
结束后或启动恢复时才由后台 flush 接管遗留 row，禁止双消费者同时发送后互相删除确认行。
Control intent 只在 Local Order 记录 `last_control_epoch` 并于安全 checkpoint 消费；不得建立
`production_interventions` 或 Workbench pause/cancel/takeover/resume 状态机。Handover 由网站原子关闭旧
fence 并建立新 attempt/session-bound fence。

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

同一 change-set 完成 V6 consumer parser、session client、worker、outbox、tests 和 evidence。
切换依次冻结候选、双仓实现、验证 consumer parser、取得七层证据、网站停建 V5 job、
AGENT drain 并停 claim V5、排空活动 lease、保持终态 V5 历史不变、在原 identity 上迁移安全未完成
任务并写 event、以一个 release 激活网站/AGENT/Extension 且删除 V5 active surface、打开 V6 session、
配对 Authority、普通 claim 保持 blocked 只跑一条 canary、job 接受后才取得 Target、PASS 后开放、最后审计 runtime 仅 V6。
旧方案和 V5 证据只保留为历史，不再取得运行主权。

V5 route/reader/writer/generated validator/config/package entry/process、外部 HMAC/LNA/localhost、
Cloud callback、第二 worker/mediator/scheduler/store/transport、compatibility/fallback/shadow/
bridge/alias/default/normalization/dual read/write 必须物理为零。激活后无 runtime V5 fallback。

同时物理退休 AGENT 手写 product→Stage topology、product-specific conversation/reusable-parent map、
typed join count 与任何完成当前 Job 后自行选择下一网站 Job 的分支。切换后 active runtime 只消费
经过鉴权的 immutable Cloud order；不得保留 provider projection、compatibility reader 或第二链。

## 验收边界

任务内单项验证依次覆盖 dependency 最小声明、无 provider bytes/commit/hash、Cloud grant 与 local order
身份一致、Stage 顺序/dependency、
conversation/parent/join 正反例、零手写 topology，以及 strict V6 contract、session conflict/supersede/token rotation、attestation
stale/replay、typed/idempotent claim、Browser absent no-claim、oldest eligible、十席位一 mutation、
accept/release/renew/checkpoint/CAS、outbox restart、UNKNOWN、handover、drain 和 V5-zero。

Static、Contract Exam、Integration、Fault、Real Chrome、Real Provider 与风险相称的 bounded observation
互不替代。不得用历史固定场景数或固定 72 小时等待作为日常 claim 门。真实 receipt 必须绑定双仓 commit、
V6 manifest、AGENT build 与 Extension release。未取得真实层时固定
`NOT_PRODUCTION_VERIFIED`。

正确性零容忍项固定包括：双 terminal、stale/foreign fence 写入、未 eligible session 获 lease、
Browser absent 仍发 browser-required lease、production localhost/LNA、Extension Cloud access、
unknown-field default、UNKNOWN replay、重启丢任务、双 eligible session、无 durable event 的状态变化、
V5/V6 双写、控制协议改写 request hash、stale attestation 获 lease、Browser busy 把业务容量降零。
时效固定为 heartbeat 30 秒、45 秒 stale 停新 claim、90 秒 offline、claim 1–30 秒、合格任务到 lease
P95 不超过 15 秒、lease 90 秒、per-job renew 20 秒，并在一个 heartbeat/claim 周期内公开 block reason。
