# GrassEye 玄学 AI 生产工厂施工图 V3

status: construction-blueprint
version: 2026-08-08
authority: `.github/instructions/agent-rules/modules/module-xuanxue-ai-production.instructions.md`

## Boundary

```txt
玄学网站：冻结资料包 + 一张整单 ─────────────┐
                                             ↓
AGENT outbound worker → lease → 本地 SQLite 工厂账本
                                             ↓
                             固定产品 profile 动作图
                                             ↓
                              AI Input Gateway 公共合同
                                             ↓
                              GPT Web 原始回答与证据
                                             ↓
AGENT：整单结果 + checkpoint/failure ───────→ 玄学网站
```

网站不发送“下一步”；AGENT 不计算命盘、不创作领域 prompt、不判断商业履约。

## Product Profiles

| 产品 | 固定图 | 最终阶段 |
| --- | --- | --- |
| 八字 canonical base（内部） | `base_interpretation` 独立私有会话 | `base_interpretation` |
| 八字命盘解读 | base checkpoint → 独立无问题 child `chart_interpretation` | `chart_interpretation` |
| 八字完整分析 | base checkpoint → 独立问题 child `question_analysis` | `question_analysis` |
| 八字追问 | 父 `bazi_chart_interpretation/chart_interpretation` 或 `bazi_ai_full_analysis/question_analysis` 精确会话 → `question_analysis` | `question_analysis` |
| 奇门专业解答 | `analysis` | `analysis` |
| 奇门追问 | 父 `qimen_professional_answer/analysis` 会话 → `followup` | `followup` |
| 合婚 canonical A（内部） | `party_a_interpretation` 独立私有会话 | `party_a_interpretation` |
| 合婚 canonical B（内部） | `party_b_interpretation` 独立私有会话 | `party_b_interpretation` |
| 合婚分析 | 两份 canonical 私解 + 双完整命盘 + 全部 READY → 新关系会话 `final_compatibility` | `final_compatibility` |
| 合婚追问 | 父 `hehun_ai_analysis/final_compatibility` 会话 → `followup` | `followup` |
| 新命盘起名 | 目标 base checkpoint → 项目 child `question_analysis → naming_author`；辅助人物独立 base 经 typed join 加入 author | `naming_author` |
| 已有报告起名 | 与源报告不同的 fresh `naming_author` | `naming_author` |
| 人工准确度追问 | 父 job/stage/hash → 原会话 continuation | `manual_accuracy_challenge` |
| 定时质量复盘 | 冻结快照 → 独立私有新会话 | `scheduled_quality_reflection` |
| 付款截图观察 | `payment_screenshot_observation` | 同名阶段 |
| 公开知识文章 | `corpus_research → article_synthesis → article_image_generation` 同会话 | `article_image_generation` |

Profile 对材料阶段实行精确集合和精确顺序校验。多一个、少一个或顺序错误都在 GPT 前失败。
每个阶段进入 Gateway 时都先携带整单 `inputBundleRef` 作为非文件逻辑身份，再附加真实文件
和前序回答文件。零附件阶段因此仍有非空输入证明；上传计数只看带 `filePath` 的真实文件。
同一订单依法同会话的后继节点，其 `continuationFrom` 必须指向紧邻的上一节点；跨订单的
BZ05、BZ03、NM01 必须携带 immutable base checkpoint 并由 Gateway 执行真实 provider fork。
所有解析到同一个 `webChatUrl` 的订单和 stage
共用同一 FIFO 车道。合婚 A、B canonical 私解和关系综合是三个明确定义的独立上下文，
profile 不得把它们串成旧的单聊天三调用图。

三类 canonical base 按云端 stable source task/idempotency 唯一化，AGENT 不做语义相似
判断。相同身份只执行同一 durable order；用户问题、伴侣、订单、付款和命名要求不得进入
该身份，每个用户结果仍单独执行。

三类付费追问必须在本地打开 GPT 前完成父订单、固定最终阶段、raw output hash 与原设备
核验。原 `webChatUrl` 可用时直接续接；原会话或本地父账本丢失时，使用子 lease 绑定的
`continuation_parent_replay` 下载原父材料，从第一阶段按原冻结主体与原拓扑重放父 profile，形成并持久记录
重建父聊天，然后才发送追问。没有“空白新建追问聊天后把父报告当附件”的兼容路径。

## Production Window

```txt
云端待领取
→ 本机 availableCapacity = min(生产窗口-active, 设备容量-active)
→ FIFO waiting
→ active（默认最多 10 张整单）
→ completed / recovery_pending
```

同一订单在一个进程只有一份 tracked promise；所有指向相同 GPT URL 的工作串行，不同 URL
继续并发。Gateway 自己执行单标签页 N=1 短操作锁和最多 10 个 provider feed。
整单首轮只生成一次系统聊天名，后续所有 stage 继承该父聊天名称并各自使用新 marker；
禁止每个 stage 用自己的 execution id 反复改名。上一 stage 的回答 checkpoint 发布后，
下一 stage 的父聊天续问优先于旧 stage 的改名、附件装饰和页面清理。旧 stage 未完成的
改名必须作为 `chatTitleRename=pending` 持久尾工留在 Gateway 账本中；AGENT 重启只补做
canonical URL＋父名称＋marker 核验，不得重放 GPT 回答，也不得占用整单 AI 生产容量。
某张订单遇到浏览器瞬断或临时无货时，在当前有效 lease 持续 heartbeat 的前提下，按阶段
timeout 内的有界退避继续同一 execution id；其他订单继续生产，不互相取消。只有阶段
timeout 用尽，整单才向云端回传 `recovery_pending`。
Gateway 返回 `failed/review_required` 时先检查持久化提交证明。已有正式 URL / submitted
turn 的执行保留原 execution id、marker 与父聊天恢复；监控插件临时形成第二物理 GPT 标签
只暂停页面动作，绝不能换编号重发。只有被证明污染/无效的完整回答，或从未形成提交证明的
真正终态身份故障，才清空旧 feed result、生成新 execution id，并继续绑定原父 GPT 聊天。
附件 child 已持久化 `attachmentUploadProof.status=failed/review_required` 时，本次附件 execution
已经终态：同 lease 退避循环、进程重启、重新领取 lease 都只读并保留原 proof，不得再次进入
Gateway 上传。页面或运输故障修复后，必须取得显式人工授权才能创建新的附件 execution；普通
后台恢复不得每 1–10 秒重复复制粘贴，也不得重复打开原生文件选择器。

调度器以已验证 `webChatUrl` 作为最终车道；URL 尚未取得时才以 `父 job + 父 stage` 临时
占位。同一 GPT 聊天上的问题、命名、复盘和追问严格按 `createdAt + orderId` FIFO，每次
只允许一张投喂；不同聊天仍可并发占用十张整单窗口。
前序追问处于 `recovery_pending` 时，后序追问只记录同车道等待并回传恢复态，绝不越过它
向同一聊天发送消息。

普通 provider 故障、登录/验证码、坏回答、父会话丢失一律是内部 `recovery_pending`，
用户侧继续显示处理中。只有外来设备账本、不可变身份冲突和安全攻击才可进入狭窄的
`review_required/failed`，不得用终态掩盖用户体验故障。

## Durable Ledger

```txt
<dataDir>/plugin-tasks/xuanxue-ai-production/xuanxue_ai_production.sqlite
  production_orders
  production_stages
  production_events
  production_parent_conversation_rebuilds
```

每阶段永久使用：

```txt
xuanxue-ai-production:<orderId>:<stageId>
```

可恢复运输故障不得换 execution id，也不得换 logical-turn marker。只有已完成回答被证明
污染/无效，或提交前发生真正终态的身份故障时，才创建新 execution id 和新 marker。页面
全局 user turn 数量会在 ChatGPT 延迟加载历史时变化，只能记录，不能触发重发。精确 marker
一旦形成 user turn，必须先保存 submission、父 URL 和附件 proof；后续检查失败或进程中断
只能恢复该 turn，绝不能再分析一遍。因此进程中断后恢复的是原会话，不是“再分析一遍”。
前序回答写入内部 generated-inputs 前
必须重算 `sha256:<64位小写十六进制>`，与上一阶段 canonical rawOutputHash 完全一致。
若旧 SQLite 记录的字节完全一致但 hash 只缺 `sha256:` 前缀，启动迁移必须原子补正、
把尚未真正投喂的下游节点退回 queued，并恢复整单；任何真实字节不一致仍 fail-closed。

云端 `seeded_stages` 只允许固定图的连续前缀。本地把原始回答和 provider proof 写成
completed 前必须执行与现场回答完全相同的输出完整性检查。私用字符、provider 引用残留、
“消息流中的错误”“输入完整性校验失败”“输入缺失无法解读”或明确无法读取附件的 seed
保留原 execution 身份作为退休证据，但阶段进入 `recovery_pending`，换新 execution 重做；
不得把坏 seed 写成 completed。通过检查后才从首个未完成节点继续。人工 challenge 不是普通根节点：它必须能在本地
读到父订单、父阶段、相同 raw hash 和精确 `webChatUrl`，否则进入人工处理而不是新开聊天。
三类付费追问先严格核验不可变父身份。历史无父身份追问在启动迁移中保留证据并转为
`recovery_pending`，等待网站从商业记录重发正确父身份，不得猜测或新建空白聊天。
重发到达后，只有原 order/source/product/input bundle 与阶段材料语义全部一致，且旧记录
仅缺 continuation parent 时，SQLite 才能原位补入父身份和新 request hash；旧阶段快照写入
`followup_parent_binding_repaired` 事件后，必须用全新 execution id 重建执行节点。旧空白
聊天的 submission、附件 proof、marker 与 URL 只留在旧执行证据中，新执行从正确父聊天
重新上传当前冻结附件；禁止把旧空白聊天 proof 当成可恢复断点。PostgreSQL JSONB、云端 JSON 与本地
SQLite JSON 的对象字段必须先 canonicalize 再比较，字段排列顺序不属于 identity；固定旧版
空白聊天 prompt 与 manifest/输出合同内部运输 metadata 可在同一次原子修复中升级。父报告、
冻结案卷和用户追问等业务输入的 hash、字节数、文件身份或语义出现任何变化仍拒绝。
若上一版本已经追加父身份修复事件、但子阶段仍是
`xuanxue-ai-production:<order>:<stage>` 默认 execution id，冷启动执行精确的一次性迁移：
记录 `followup_parent_wrong_chat_execution_retired`，保留旧执行证据，换新 execution id，
清空子阶段旧 proof 后回到正确父聊天。其他 execution 形态不得被该迁移触碰。

阶段材料的 `maxFileCount` 是网站冻结输入的上限，不包含 AGENT 在工厂内部生成的可信
前置回答附件。工厂组装最终 Gateway 输入时，只能按实际生成的前置阶段/父报告文件数量
一份一份增加上限。例如网站冻结 5 份材料并生成 1 份父报告，最终上限必须精确为 6；
不得仍按 5 误杀追问，也不得改成任意常数或无限制。

父身份有效但 provider 父聊天不可恢复时执行灾难重放：

```txt
子订单 claim 携带 continuation_parent_replay
→ 本地重建父订单
→ 父 profile 从第一阶段完整执行
→ 记录 original hash → rebuilt hash + rebuilt GPT URL
→ 子追问只续接 rebuilt GPT URL
```

同一订单内部若后续节点打开上一节点的固定 URL 后回到首页、漂移到其他正式聊天或无法证明
精确父会话，不在后续节点上继续十秒一次的空转。当前后续 execution 立即退休，SQLite
原子清空整张订单各节点的 response/proof，为每个节点生成带 `supersededExecutionId`
的新 execution，记录 `conversation_graph_rebuild_started`，然后从第一阶段在一个新聊天
完整重放。重放完成后后续节点只续接这个新聊天；用户侧仍是处理中，禁止空白追问兜底。

GPT 回答含私用区字符、`filecite` 等内部引用残留、乱码替代符、必需 JSON 无效、原始回答
缺失，或明确返回“消息流中的错误”“输入完整性校验失败”“输入缺失无法解读”“无法读取
附件”等 provider 失败回答时，当前回答立即丢弃，事件记录
`stage_fresh_execution_restarted`，清空旧 proof/response
并使用新 execution id 重新执行。新执行必须携带被替换的旧 execution id，防重复闸门只在
它与当前轮次账本完全一致时原子换主；不得把合法新执行误判成重复任务后每十秒空转，也不得
依靠重启进程清空旧账。污染回答不允许进入任何整单结果。

新根阶段若点击发送后回弹到另一 execution 已登记的正式聊天，或最后一条用户消息携带
其他 execution 的 marker，Gateway 不能记录发送成功。该次 execution 保留证据后立即退休，
工厂换新 execution 重跑；网站仍只看到处理中。只有 continuation 阶段可复用正式 URL，
并且实际 URL 必须等于固定父 URL。

重启恢复禁止由 coordinator 脱离 cloud worker 自行启动。outbound worker 先扫描本地
`queued/running/recovery_pending/completed` 整单，以
`orderId + sourceTaskId + requestHash + 原设备身份` 与原 cloud job 对账；云端撤销旧租约、
把非人工终态恢复为 `recovery_pending` 并锁回原设备，然后 AGENT 重新领取新 lease。这样
未完成节点继续原 execution，已完成但尚未回传的整单直接幂等回传，均不会再次调用 GPT。

若云端明确返回 `AI_PRODUCTION_LOCAL_RECOVERY_DEVICE_MISMATCH`，说明该 SQLite 订单不属于
当前设备的可恢复云账本。AGENT 原地保留订单、阶段、已有结果和事件证据，把整单及当前阻断
阶段一次性写为 `review_required`，并从以后冷启动的自动对账集合排除；不得每次启动重复查询，
也不得物理删除证据或降级为普通网络重试。

设备恢复接口返回云端 job 终态。返回 `cancelled` 时，本地整单及全部未完成阶段原子进入
`cancelled`，已完成阶段和 GPT checkpoint 原样保留，事件写入
`cloud_cancelled_order_settled / cloud_cancelled_stage_settled`。该订单随后离开
`listCloudRecoveryOrders`，不得再调用 `/recover`、不得继续轮询、不得再次提交 GPT。

## Outbound Cloud Protocol

```txt
device heartbeat
→ durable local/cloud reconciliation
→ claim(limit = remaining local capacity)
→ lease-bound child + continuation_parent_replay material download
→ missing parent local ledger rehydration
→ local order create/reuse
→ factory_running checkpoint
→ stage graph execution
→ one whole-order result or bounded failure
```

协议固定 `xuanxue-ai-production-v4`。活动创建、领取和恢复不接受 v1/v2/v3。SQLite 切换只处理
已终态 v1/v2/v3：先逐阶段重算原始回答 hash，再对数据库和 `cloud-staging/generated-inputs`
建立可恢复快照，在系统临时目录实际恢复数据库并核对 schema、行数、逐表行 hash、材料相对
路径、byte size 与 sha256。全部一致后，只把旧订单登记到
`production_legacy_protocol_archives`；订单、result、stage 与 event 原字节不改，v3 读取和
恢复 SQL 必须排除档案。任何活动旧单、错误 hash 或恢复对账差异都使启动失败，不建双轨，
也不得编造 legacy owner/person/chart。一次性 `xuanxue-ai-production:legacy-cutover` 只离线读取 v1/v2/v3，
优先以当前设备凭证查询绑定 job 的 `job_id/status`；只有云端明确返回设备身份不匹配时，
本次离线命令才可使用网站既有 service credential 只读复核同一 `job_id/status`。两种查询都只接受云端终态，随后把终态追加为本地
`legacy_cloud_terminal_reconciled` 后唯一写入 v4 设备凭证。该工具不进入启动、领取、恢复或执行运行时；已有 `v1_cloud_terminal_reconciled` 只作为
精确历史事件读取。conversation graph 冷启动仅扫描未归档 v4 活动状态，禁止再次执行或
重新提交 GPT。
领取后的所有 job mutation 携带 lease token/version
和幂等键；唯一例外是重启恢复请求，它没有可信旧 token，必须绑定原设备与四段稳定身份，
并在恢复后重新领取新 lease。
父重放材料只允许通过
`/jobs/:child/continuation-parent/materials/:stage/inputs/:input` 下载，并严格复用子订单
当前 lease。claim 中父产品、固定最终阶段、原 raw hash、原设备任一不一致都拒绝发包。

## File Plan

```txt
src/plugins/xuanxue-ai-production/
  xuanxue-ai-production.schema.ts
  xuanxue-ai-production.profile.ts
  xuanxue-ai-production.store.ts
  xuanxue-ai-production-store-event.ts
  xuanxue-ai-production-store-recovery.ts
  xuanxue-ai-production-output-integrity.ts
  xuanxue-ai-production.flow.ts
  xuanxue-ai-production.scheduler.ts
  xuanxue-ai-production-cloud-contract.ts
  xuanxue-ai-production-cloud-client.ts
  xuanxue-ai-production-cloud-credential.ts
  xuanxue-ai-production-cloud-enrollment.ts
  xuanxue-ai-production-cloud-staging.ts
  xuanxue-ai-production-cloud-worker.ts
  xuanxue-ai-production.workbench-owner.ts
src/mediator/
  xuanxue-ai-production-route.ts
```

Workbench 只创建 plugin-owned lifecycle owner，并把整单创建交给唯一 mediator route；
worker/store/coordinator 状态留在 plugin owner 内，mediator 不保存状态也不吞掉 schema/task 错误。

## Acceptance

- 证明九个网站 AI 产品与三个 private base 内部动作的精确 stage graph。
- 证明 BZ05、BZ03、NM01 从同一 base checkpoint 得到彼此不同的真实 child URL，兄弟 child 可并发且问题不互漏。
- 证明 `fresh | same_conversation | forked_from_checkpoint` 三态均有 provider 动作回执、marker、URL、hash 和 execution/scope 对账；不支持精确 fork 时失败关闭。
- 证明合婚甲方、乙方私解可独立并发、各自完整上传语料，关系总论使用第三个新会话并带两份原始回答。
- 证明新命盘起名的 `question_analysis` 与 `naming_author` 共享 NM01 项目 child，而不是 base URL；一个 target 加至少四个辅助人物各有独立 base，author 只收到 typed participant manifest。
- 证明 NM02 使用与源报告不同的 fresh 会话；BZ04 使用所选 BZ05/BZ03 父分支的同一会话。
- 证明同一 stable canonical identity 的重复订单只执行一次，用户问题与关系综合绝不复用。
- 证明 10 张在制整单时第 11 张等待，释放后才进入。
- 证明 order/source task 幂等冲突在投喂前失败。
- 关闭并重开 SQLite 后，queued/running/recovery_pending 按相同 execution id 恢复。
- 证明重启恢复先对账原 cloud job，禁止 detached local execution；本地已完成但未回传的
  结果在新 lease 下直接补交，GPT 零重复调用。
- 证明外来设备账本只对账一次，持久化为 `review_required` 后跨重启不再查询且证据仍可读。
- 证明云端 cancelled job 在本地只结算一次，保留已完成阶段和事件证据，跨重启不再查询且
  不再进入 GPT。
- 证明合法 seeded 前缀不再提交，非法前缀/hash/proof 在 GPT 前失败。
- 证明人工 challenge 继续父订单同一 GPT URL，并由父设备独占领取。
- 证明三类付费追问缺父身份时在 GPT 前拒绝，固定父产品或父阶段不符也拒绝。
- 证明同一父 GPT URL 的多个追问最大并发为 1 且 FIFO，不同父 URL 继续并发。
- 证明本地父账本整片丢失时，可由 claim 的父重放包重建父订单，完整执行父图后只在重建
  父 URL 追问；父材料下载必须使用子 lease。
- 证明历史无父身份追问重启后保持 `recovery_pending` 等待正确血缘，不会新建聊天。
- 证明网站重发正确父身份后，同一历史订单原位修复并在精确父聊天继续；语义材料变化仍拒绝。
- 证明带 `filecite` / 私用区字符的回答立即作废、换新 execution id 重跑且不进入结果。
- 证明污染或 provider 失败 seed 不进入 completed，并从该阶段重新执行。
- 证明附件 child 给出终态 `failed/review_required` proof 后，同 lease、再次执行与重启恢复的
  Gateway 上传调用总数仍为 1，原 attempt id/proof 不变，10 秒观察窗内没有复制粘贴或
  原生文件选择器再进入。
- 证明同一订单父聊天失效只触发一次下游失败，随后记录整图重建，从第一阶段到最后阶段
  重新落在同一个新 GPT URL，禁止紧循环与空白追问。
- 证明定时质量复盘总在独立新聊天执行，无 continuation parent；人工 challenge 仍继续父会话。
- 证明 SEO 三轮只有一张整单、一个 canonical URL，第三轮只捕获目标 assistant turn 的一个
  原图；下载/转换/上传中断从同 execution/checkpoint 恢复，不重发第三轮。
- 证明媒体 facade 使用 contain 固定中性画布输出无元数据的 1200×630 WebP，红线不确定即阻断；
  插件内不存在第二套 sharp/Vision 处理器，任务期间不联网安装依赖。
- 证明终态 v1/v2 账本在数据库与本地材料实际恢复、全量 hash 对账后原字节归档；活动旧单、
  错误 hash、恢复差异和 v3 读取旧档案均阻断。
- 审计云端领取只使用剩余容量，生产工厂不存在第二云端执行片区。
