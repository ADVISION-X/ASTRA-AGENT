---
description: "玄学网站 AI 生产工厂 V5：Cloud Pull、唯一 Plugin、V5 grant/fence 与终态 CAS。"
applyTo: "src/plugins/xuanxue-ai-production/**/*.ts,src/mediator/xuanxue-ai-production-route.ts,scripts/acceptance/xuanxue-ai-production.acceptance.ts,scripts/audit/domains/xuanxue-ai-production/**/*.{ts,json},docs/法案辅助文件/GrassEye 玄学 AI 生产工厂施工图.md,docs/法案辅助文件/GrassEye 玄学 AI 本地化生产对接终态施工图.md"
---

# GrassEye 玄学 AI 生产工厂法案

status: active
version: 2026-08-22.ten-job-continuous-oldest-first-recovery
capabilityDomain: xuanxue-ai-production

## 1. 唯一责任与主链

`xuanxue-ai-production` 是 AGENT 内玄学 AI 整单执行的唯一业务 owner。它只接收网站已经
冻结的完整订单，按固定产品图执行，并拥有本地业务状态、checkpoint、`review_required` 与
业务结果。它不是浏览器、Cloud 账本、Provider transport 或通用 planner owner。

唯一主链固定为：

```txt
xuanxue-web V5 Cloud Pull
  -> Cloud Worker（只运输、验 grant、转发）
  -> xuanxue-ai-production mediator route
  -> xuanxue-ai-production Plugin
  -> public capability facades / Browser authority
  -> checkpoint / first-terminal CAS
```

网站不得逐阶段遥控 AGENT，不得传入 `nextAction`、`actionPlan`、selector、坐标、tab、
window、browser command、provider URL 或并发值。Worker 不得直接调用 Browser、capability
private runtime 或 Plugin private file；Plugin 也不得 import 另一 Plugin。

## 2. V5 Cloud Pull 与订单身份

活动协议唯一为 `xuanxue-ai-production-v5`。Cloud Worker 主动拉取、逐 job 验证 canonical
`contractManifestHash`、`CloudExecutionGrantV5`、required device、attempt、lease version、
fence、serverNow 与相对 deadline budget 后，才经唯一 mediator 交给 Plugin。

V5 schema、manifest、JCS/hash vectors 与正负 fixtures 的唯一 canonical owner 是
`xuanxue-web/packages/ai-contracts`。AGENT 只消费其冻结 artifact 生成 validator 并验证
manifest hash，不手写重复 Cloud schema。非 V5 version、缺失字段、多余字段、别名、
默认值、归一化、fallback 或兼容 reader 均在入口失败关闭，不得生成当前 grant、
validator proof 或 terminal 身份。

Plugin 必须先持久化并 fsync 不可变 `localOrderIdentity`，之后才承认订单或触发 Browser
side effect。每个订单同一时刻最多一个执行；每台生产设备固定 `max_in_flight=10` 个独立业务
任务，等待 Provider 结果不占用浏览器 mutation lock，而真实页面动作仍固定
`max_browser_in_flight=1` 并在同一物理标签页串行。十个任务各自保留业务席位，但只有 durable
submission ticket 全局最早的任务能进入物理页面窗口；它必须连续完成空白页确认、profile、附件稳定、
prompt 填写和 submission checkpoint 后才释放窗口。重启必须恢复同一 durable identity / execution
checkpoint 和最早 ticket，禁止重复创建订单、重复提交 prompt 或重放 `UNKNOWN` mutation。

Cloud 只提供 lease、grant、checkpoint、terminal、cancel 与人工 handover API。所有 mutation
精确绑定当前 job、attempt、device、lease version、fence 与 idempotency payload hash。第一个
terminal CAS 是唯一终态写入：同 status 与同 payload hash 可幂等重读；冲突、过期 lease、旧
fence、迟到 terminal 或 foreign device 必须失败关闭且不得覆盖既有终态。foreign device 只能
由显式人工 handover 关闭旧 fence、建立新 attempt 后继续。

## 3. Browser 与结果边界

Browser side effect 前必须拥有当前 connection generation 上由“人工配对 + HTTPS 标签认领”原子
建立的 Session Workspace、当前 Authority/Target/Document、匹配 actionId 与相对 TTL。Workspace
绑定固定 profile、extension identity、release build、directory hash 与 site policy，不设置 8 小时
或任何墙钟过期，也不进入 Cloud fence。真实 socket disconnect、Workbench/Extension/Chrome
重启或 Reload、identity drift、operator revoke 才使其失效；重新配对并认领后，生产 owner 必须先
恢复 `created_at + job_id` 最早的未完成任务，再进入普通调度。

临时无 GPT、真实浏览器断线、`BROWSER_EXTENSION_CHANNEL_UNAVAILABLE`、
`BROWSER_LIVENESS_EXPIRED`、`BROWSER_SESSION_WORKSPACE_REQUIRED`、同一 target 导航后 mutation 前
由页面 hydration/document replacement 引起的短暂 `BROWSER_TARGET_INVALID` 与网络中断只能写
`recovery_pending`，保留同一 job、attempt、checkpoint 和 fence，绝不能写业务 `failed` 或清理
可恢复现场。只有不可变输入/合同错误、真实页面明确终态失败或人工复核边界才允许 terminal。
每个命令由固定 registry 解析，单 tab、单 mutation lock，且 Target/Document 零或多候选都失败关闭。

所有用户已发布任务在 `completed`、明确 `cancelled` 或有真实业务终态证据以前都属于未完成任务，
必须由同一 job、同一 source task、同一 request hash 和同一本地 order 持久续跑。常驻 Worker 的每轮
poll 都必须先对账本地非终态账本；对账去重只能绑定当前 `job_id + attempt_id + local status + updated_at`
版本，任务状态、attempt 或 checkpoint 一旦变化，下一轮必须自动再次对账，绝不能用进程级永久集合
把同一订单屏蔽到下次重启。重启只是重新进入同一循环，不是恢复触发器。

旧候选把 mutation 前、无 submission/attachment/checkpoint/output/`UNKNOWN` proof 的已查明技术故障误写为
`failed`，或旧 GPT execution-profile 占位实现将未提交任务误写为 `review_required`，只能由精确的一次性
Cloud migration 与本地 SQLite `user_version` migration 在原 job/order/stage 上纠正为 `recovery_pending`。常驻 Worker、
`/recover`、operator 都不得扫描 terminal，不得人工逐单复活或新建任务。迁移必须反向排除任何 side effect、
`UNKNOWN`、不可变身份/合同错误、明确业务失败、completed 或 cancelled；纠正后的 grant 仍须业务订单身份、
contract manifest 完全一致，attempt 变化、lease version 单调增加且 fence 变化，原 execution id、failure ledger 和
stage event 全部保留。本地 `user_version=3` 只纠正已经带有 v2 profile-readback 纠偏事件、但随后被旧
Gateway 持久状态再次误写为“missing durable submission proof”的同一 proof-empty execution；不得扩展为
通用 failed reader。

Cloud claim 必须在唯一 `ai_production_jobs` 队列内，把所有当前可领取的 `queued` 与
`recovery_pending` 合并后严格按不可变 `created_at + job_id` 选择全局最早任务。service class、背景份额、
aging、注册顺序、失败/恢复类别和本地内存队列顺序都不得越过更早任务；不满足 retry、device、contract、
lease、material 或安全准入的记录不属于当前可领取集合，也不得阻塞其后的最早可领取记录。AGENT
取得 grant 后，本地 runnable selection 仍按同一 `created_at + job_id`，禁止建立恢复优先分区、普通任务
优先分区、影子队列或新 job。

对页面 mutation，Browser exact-target owner 先 fsync `PREPARED`，再 `SEND`，最终仅可为
`CONFIRMED`、`FAILED` 或 `UNKNOWN`。`UNKNOWN` 禁止自动 replay；Plugin 只能根据同一真实页面
的正向确认、反向排除、唯一性和有界停止形成 outcome resolution，否则固化
`review_required`。submission checkpoint 以前的 `UNKNOWN` 必须让原 execution/ticket 继续占据
队首，所有新 submission 和普通 patrol 都不得进入同一物理页面；不得把未确认现场当作空闲窗口释放。
附件阶段发生在 prompt 写入以前，因此 exact 文件名、数量、无额外项和无上传中状态成立即为稳定，
此时发送按钮禁用是正常前置状态，不能据此超时或让下一个任务进入。日志不是 evidence，Browser receipt 不是业务结果；二者都不替代 Plugin
state 或 Cloud terminal CAS。

## 4. 物理退休与保留面

以下活动生产面必须物理不存在：玄学 external HMAC/LNA/localhost business ingress、V4
reader/writer、V4 decoder、per-job operator approval、Cloud callback、第二 worker、第二
mediator、第二 order store、第二 Browser/provider transport、compatibility bridge、fallback、
dual reader、dual writer、alias、default、normalization、本地重复 Cloud schema 或手写第二
validator owner。历史证据仅留在 Git/既有不可变备份，不得重新接回运行时。

`/api/xuanxue-ai-production/*` 只可保留 Workbench local-ui 的 status、pause、cancel、takeover
与 resume；它不是外部业务 ingress。Amazon 等其余已授权 external API owner 不受本法案影响。

## 5. 证据与施工边界

静态 audit、acceptance、typecheck 与 `ci:full` 只能证明各自覆盖的候选合同；不得冒充真实
Chrome、Provider、Cloud 终态或 release。凡修改 Browser/DOM 生产行为，施工前后都必须在另行
授权的真实 Chrome 路径按同一候选取证；未取得时固定为 `CHROME_VERIFIED=false` 与
`NOT_PRODUCTION_VERIFIED`。

```apex-law
{"lawId":"APEX-XUANXUE-AI-PRODUCTION-001-V5","status":"active","tier":"P0","capabilityDomain":"xuanxue-ai-production","enforcementMode":"machine-blocking","evidenceMode":"law+blueprint+ast+acceptance+real-chrome+real-provider","summary":"Only V5 outbound Cloud Pull may deliver a complete xuanxue production order through the unique Worker-to-Mediator-to-Plugin chain; every user-issued unfinished task is durable, every changed recovery version is reconciled by the continuously running worker, exactly ten independent business tasks may wait concurrently behind one serialized Browser action lane, and the globally oldest claimable created_at plus job_id always runs first.","required":["xuanxue-web packages/ai-contracts is the sole V5 schema manifest vector and fixture owner","AGENT consumes only the frozen canonical artifact to generate its validator and verify manifest hash","xuanxue-ai-production-v5 canonical manifest validation","Cloud Worker to one mediator to one Plugin","fsync local order identity before execution","max_in_flight=10 and max_browser_in_flight=1","manual pair plus target claim establishes one no-wall-clock-expiry Workspace plus dynamic Authority Target Document","browser and network discontinuity including BROWSER_SESSION_WORKSPACE_REVOKED remains recovery_pending","an already exact empty ChatGPT root is a proved no-op and is never navigated or reloaded","every poll reconciles each changed job attempt status and checkpoint version","proof-empty historical pre-submission misclassifications are corrected only by exact one-time Cloud and local migrations on the same job","all claimable queued and recovery_pending jobs share one global created_at plus job_id order","first-terminal CAS and explicit foreign-device handover","UNKNOWN never auto-replayed","real Chrome and real Provider receipts bind an independently recomputed current source candidate, one immutable Browser runtime receipt, the canonical production Workbench data directory, an authenticated Cloud device heartbeat, the exact completed Cloud job set, and a bounded fresh run"],"forbidden":["xuanxue external HMAC/LNA/localhost business ingress","V4 reader or writer","separate or per-job Browser approval","8h or any wall-clock Workspace expiry","browser disconnect written as business failed","reloading or navigating an already proved exact empty ChatGPT root","collapsing ten business/provider waits into one job because Browser mutation is serialized","process-lifetime reconciliation suppression for a changed order","operator recovery button or unproved failed-task resurrection path","new job or new prompt used to replace a recoverable original task","service class recovery partition registration order or in-memory order bypassing the globally oldest claimable job","automatic replay of UNKNOWN or any task with side-effect proof","stale or foreign-candidate Chrome or Provider receipt","caller-selected proof root or caller-supplied candidate identity","offline caller-minted Provider bundle without authenticated Cloud terminal readback","Cloud callback","second worker mediator queue ledger Browser or Provider chain","local handwritten duplicate Cloud schema or second validator owner","alias default normalization compatibility fallback dual reader or dual writer"],"clauses":[{"clauseId":"apex-xuanxue-001-v5-cloud-pull-v5","statement":"A browser side effect or terminal result is possible only after one V5 Cloud Pull order passes canonical grant, durable identity, connection-bound Workspace, current fence and exact-target checks in the unique owner chain; up to ten independent jobs may hold durable provider waits while one Browser action is serialized, an already exact empty provider root is a no-op, technical discontinuity including BROWSER_SESSION_WORKSPACE_REVOKED stays recovery_pending, proof-empty historical pre-submission misclassifications are corrected only by exact one-time Cloud and local migrations on the same job, every changed local recovery version is reconciled by the continuous poll loop, UNKNOWN is never replayed, the single Cloud plus local scheduler resumes the globally oldest claimable created_at plus job_id, and each deferred Chrome or Provider proof independently recomputes the current candidate, consumes the canonical production run root, binds one immutable runtime receipt, and for Provider proof requires a fresh authenticated Cloud readback proving the exact job set is terminal completed.","evidenceMode":"model+acceptance+real-chrome+real-provider","ownerDomain":"xuanxue-ai-production"}]}
```

本文件只保存 current active law；历史版本或旧链不得在活动源码、法案、施工图、fixture 或
验收中留下可达 reader/writer。
