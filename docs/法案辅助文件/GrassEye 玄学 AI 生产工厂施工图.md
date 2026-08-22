# GrassEye 玄学 AI 生产工厂施工图

状态：active V5.3 ten-job-automatic-oldest-first-resume
法案：`APEX-XUANXUE-AI-PRODUCTION-001-V5`
唯一 owner：`xuanxue-ai-production`

## 接入

```txt
xuanxue-web canonical V5 manifest
  -> AGENT outbound Cloud Pull Worker
  -> src/mediator/xuanxue-ai-production-route.ts
  -> src/plugins/xuanxue-ai-production/
  -> public capability facade / Browser exact-target
  -> checkpoint or first-terminal CAS
```

Cloud Worker 只拉取、验 V5 grant、持久化传递并回传；它不拥有业务步骤，也不直连 Browser 或
Plugin private implementation。Plugin 固定 `max_in_flight=10` 个独立业务任务；Gateway 固定
`max_browser_in_flight=1`，所有页面动作复用一个物理标签页和 mutation lock，Provider 思考等待释放
该锁。十个任务都可占据独立业务席位，但唯一页面窗口只接纳 SQLite durable submission ticket
全局最早的任务；该任务从 clean-page proof 到 submission checkpoint 连续占有窗口，不能在附件完成前
或 prompt 提交确认前让后来的任务插队。Plugin 先 fsync local identity，再以
serverNow、lease expiry、完整 RTT 与 10 秒安全边际计算相对 deadline budget。每项 checkpoint 和
terminal 都携带 job/attempt/device/leaseVersion/fence/payload hash。
Plugin 在同一次当前 grant 与相对 deadline 核验后生成 opaque `submissionAdmission`：hash 绑定
job、attempt、device、lease version、fence、contract、stage execution 与不可变
`created_at + job_id + stage ordinal` priority key。Gateway 只持久化 opaque hash 和 priority key，
不复制 Cloud schema；SQLite 按 priority key 全局最早优先，ticket 只在完全同优先级时 tie-break。
活 waiter 禁止原地换 admission；死进程清理后，同一 execution 只有凭新 grant 取得新 admission 和
新 waiter，才能继续原 checkpoint。

## 删除式迁移

只保留 `xuanxue-ai-production-v5`。V4 decoder/encoder、旧 HMAC/LNA/localhost 外部入口、Cloud
callback、per-job approval、第二 worker/mediator/store/provider/browser transport 物理删除。V4
非终态订单只可在 Cloud 侧先 terminal 或 `review_required`，不得被 V5 reader 消费。local-ui
status/pause/cancel/takeover/resume 继续走唯一 Workbench API，不能变成外部业务入口。

## 执行和恢复

从 Cloud grant 到 Browser command 的每一步都重新验证 canonical manifest hash、required device、
lease version、fence、Workspace、Authority、Target、Document、actionId 与相对 TTL。任何缺失、
漂移、过期、零/多目标、foreign device 或 payload 冲突，Browser action count 必须为零。

Workspace 只由当前连接上的人工配对与 HTTPS 标签认领原子建立，不设 8 小时或其他墙钟过期，
也没有独立 approval API/UI。真实断线或 Workbench/Extension/Chrome 重启后，任务保持同一
`recovery_pending`、job、attempt、checkpoint 与 fence；操作者重新配对认领后，Cloud claim 必须
先恢复 `created_at + job_id` 最早的未完成任务。`BROWSER_EXTENSION_CHANNEL_UNAVAILABLE`、
`BROWSER_LIVENESS_EXPIRED`、`BROWSER_SESSION_WORKSPACE_REQUIRED`、`BROWSER_SESSION_WORKSPACE_REVOKED`、同一 target navigation 后
mutation 前由 hydration/document replacement 引起的短暂 `BROWSER_TARGET_INVALID` 和网络故障
不得写业务 `failed`，不得清理恢复现场，也不得改走第二队列。页面瞬态只能由 AI Input Gateway
在同一 target、同一 registry action、同一 exact selector 的既有有界窗口内重新观察；到界后保留
同一任务为 `recovery_pending`。

常驻 Worker 每轮 poll 都先对账本地非终态账本，再领取 Cloud 任务。对账去重键必须包含当前
`job_id + attempt_id + local status + updated_at`；任何状态、attempt 或 checkpoint 变化都会在下一轮
重新对账，不能用进程生命周期 Set 把同一订单屏蔽到下一次重启。Cloud 每轮 claim 仍在唯一队列
按 `created_at + job_id` 选择全局最早可领取任务。

旧候选的 proof-empty pre-submission 故障误写为 `failed`，或旧 GPT execution-profile 占位实现将未提交任务
误写为 `review_required`，只能由精确、一次性、受治理的 Cloud migration 与本地 SQLite `user_version` migration
各自在原记录上改回 `recovery_pending`。两侧都必须核对精确旧 reason，并反向排除 submission、attachment、
page-action、UNKNOWN、checkpoint、raw output 和业务终态 proof；原 job、order、execution、failure ledger 与 stage event
全部保留。常驻 Worker、`/recover` 和 operator 不得扫描 terminal，也不得逐单复活。纠正后的新 grant 仍须业务订单、
device、manifest 一致，attempt 更换、lease version 递增、fence 更换；新 job、新 prompt、第二队列和无 Cloud grant 的
本地自启动都禁止。

本地一次性版本含义固定：`user_version=1` 纠正旧浏览器技术终态，`user_version=2` 纠正旧 profile
readback 占位终态，`user_version=3` 只纠正已存在 v2 纠偏事件但又被旧 Gateway execution state 误写为
`submitted web-chat execution is missing its durable submission proof` 的同一 proof-empty order/stage/execution。
`user_version=4` 只纠正本次旧 failure classifier 将 `BROWSER_SESSION_WORKSPACE_REVOKED` 误写为 failed 的
proof-empty pre-submission 原 order/stage/execution。v3/v4 必须保留旧 failure ledger，且各只运行一次，绝不能成为常驻 failed scanner。

Cloud candidate query 把当前可领取的 `queued` 与 `recovery_pending` 放在同一集合，严格按不可变
`created_at + job_id` 取全局最早记录；service class、aging、背景份额和恢复类别都不能改写顺序。
AGENT 收到 grant 后，本地 runnable order 同样按 order 的持久创建时间与 order id 选择，禁止用注册
顺序或内存队列顺序越过更早任务。

Browser mutation 使用 `PREPARED -> SEND -> CONFIRMED | FAILED | UNKNOWN`。`UNKNOWN` 不自动
重放；只有 owning Plugin 基于同一页面的正向确认、反向排除、唯一候选和有界停止可作 outcome
resolution，否则 `review_required`。submission checkpoint 前的 UNKNOWN 保留同一最早 ticket 并封锁
当前存活进程的新 submission 与普通 patrol。进程死亡后旧 waiter 必须删除；同一 execution/checkpoint 只有
取得新 Cloud grant 后才按全局最早可领取顺序取得新 ticket，并在任何新任务 mutation 前通过 exact clean-page /
same-execution 核验失败关闭污染现场，绝不 replay UNKNOWN。附件稳定发生在 prompt 写入前，只要求
exact 文件名/数量、无额外项、无上传中状态和唯一 composer；此时 send disabled 是正常状态，不得等待
到超时后释放窗口。结果使用 first-terminal CAS；同 payload 的同 terminal 可重读，
其它竞争或迟到写入不得覆盖。

每个页面原子动作按 `IF + AND -> THEN` 串接：同一 current Document 的精确状态与候选唯一性成立，
并排除相邻标签、错误态、加载态和重复态后，才发送一个 mutation；该 mutation 的专属后置 proof
解析完成后，下一个动作才可进入。禁止一张 proof 批量确认此前 mutation，禁止用 substring 充当精确
语义，禁止用固定 sleep 或“已经等了多久”推进生产步骤。相对 deadline 只作兜底停止。

## 验收边界

静态 acceptance 必须覆盖 V5 schema/hash、fsync identity、lease/fence/deadline、无墙钟过期的
connection-bound Workspace、浏览器断线及 mutation 前 hydration node invalidation 的 `recovery_pending`、
`queued + recovery_pending` 全局 `created_at + job_id` 最早优先、十个业务/provider in-flight 与一个
Browser mutation in-flight、持续 poll 对 changed
recovery version 的再次对账、一次性历史误分类纠正的 Cloud migration 与本地 `user_version` migration
精确 reason/无提交双证据门、terminal CAS、cancel/handover、UNKNOWN 禁重放、旧路径为零与 secret redaction。静态
PASS 不代表真实 Provider 或 Chrome；动态 Provider/Chrome verifier 必须从仓库源码独立重算当前
source candidate，只消费项目唯一生产 Workbench data directory，并绑定同一 canonical contract manifest、
同一 real-run identity、同一不可变 `AgentRuntimeReceiptV5` hash 与固定新鲜度上限。Provider binding 还必须按
`executionId -> sha256(exact persisted record bytes)` 封存当次 run 的完整且排他 record set，并从 executionId
得出唯一 Cloud job set；随后复用现役 Cloud Pull credential 向服务器完成新鲜 authenticated heartbeat，逐 job
readback `completed` 终态。任一 record 缺失、多出、复制替换、hash 不一致、调用方选择 proof root、离线自铸
bundle、Cloud 身份/候选/合同不符或 job 未完成都必须失败关闭。没有另行授权的真实 Chrome 前固定
`CHROME_VERIFIED=false / NOT_PRODUCTION_VERIFIED`。
