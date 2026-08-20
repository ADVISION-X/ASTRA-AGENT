---
description: "玄学网站 AI 生产工厂法案：整单领取、固定产品动作图、持久化生产窗口、断点恢复和整单回传。"
applyTo: "src/plugins/xuanxue-ai-production/**/*.ts,src/mediator/xuanxue-ai-production-route.ts,scripts/startup/xuanxue-ai-production-cloud-enroll.ts,scripts/acceptance/xuanxue-ai-production.acceptance.ts,scripts/audit/domains/xuanxue-ai-production/**/*.{ts,json},docs/法案辅助文件/GrassEye 玄学 AI 生产工厂施工图.md"
---

# GrassEye 玄学 AI 生产工厂法案

status: active
version: 2026-08-20.1
capabilityDomain: xuanxue-ai-production

## 1. 唯一责任

`xuanxue-ai-production` 是玄学网站 AI 资料生产的唯一 AGENT owner。网站只提交一张
完整生产订单并接收整单结果；网站不得逐步骤遥控 AGENT，也不得发送 next action、
browser command、provider URL 或并发指令。

14 个产品共用网站商业履约主链，其中 5 个确定性产品永不进入 GPT 工厂；只有下列 9 个
AI 产品进入本 owner：

```txt
bazi_chart_interpretation
bazi_ai_full_analysis
bazi_report_followup
qimen_professional_answer
qimen_report_followup
hehun_ai_analysis
hehun_report_followup
naming_bazi_analysis_and_naming
naming_from_existing_bazi_report
```

```apex-law
{
  "lawId": "GRASSEYE-XUANXUE-AI-PRODUCTION-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "xuanxue-ai-production",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+acceptance+real-provider",
  "summary": "Xuanxue production accepts revisioned whole-order intervention only from the local Workbench and resolves it at stage checkpoints.",
  "required": ["The plugin store appends intervention request and acknowledgement events before CAS state mutation.", "Local named pause, cancel, takeover and resume methods accept only orderId, expectedRevision, reason and requestId.", "Safe points exist before scheduler dequeue, before stage feed, after response checkpoint, before joins, hashes and cloud publish.", "Cloud claim, heartbeat, recovery, checkpoint, result and failure contracts contain no intervention command or stage mutation."],
  "forbidden": ["cloud human-control ingress", "stageId intervention", "generic intervention dispatcher", "duplicate stage or provider submit"],
  "clauses": [{"clauseId": "grasseye-xuanxue-ai-production-004-requirement", "statement": "Xuanxue production accepts revisioned whole-order intervention only from the local Workbench and resolves it at stage checkpoints.", "evidenceMode": "acceptance", "ownerDomain": "xuanxue-ai-production"}]
}
```

```apex-law
{
  "lawId": "GRASSEYE-XUANXUE-AI-PRODUCTION-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "xuanxue-ai-production",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance",
  "summary": "The local factory treats cloud-staging and generated-inputs as lease-bound, reconstructible transient bytes; every terminal path cleans them only after durable truth exists, and stage download consumes the cloud canonical material identity without a local legacy-key reader.",
  "required": ["Cloud staging is hash and byte verified before local use.", "generated-inputs are scoped to one order and target stage and can be rebuilt from durable checkpoints.", "success, failed, review_required, recovery_pending and restart each have an explicit cleanup or retention decision.", "Gateway attachment attempt staging remains owned by ai-input-gateway finally cleanup."],
  "forbidden": ["long-lived generated input cache", "cleanup daemon or second local lifecycle owner", "local legacy object key resolution", "deleting transient bytes before durable checkpoint and lease facts exist", "changing ai-input-gateway cleanup ownership"],
  "clauses": [{"clauseId": "grasseye-xuanxue-ai-production-005-v1-transient-lifecycle", "statement": "The plugin owns only its transient material lifecycle and never becomes a second material store, resolver, GC or provider attachment owner.", "evidenceMode": "acceptance", "ownerDomain": "xuanxue-ai-production"}]
}
```

可复用基础工作使用三种内部订单，不计入网站 14 个产品：

```txt
bazi_canonical_base_interpretation
hehun_canonical_party_a_interpretation
hehun_canonical_party_b_interpretation
```

云端以 owner、角色/解释模式、命盘 ref/version/hash、候选集合、合同、模型上下文和 READY
正文/索引 hash 生成稳定 source task/idempotency。相同身份并发只下发同一订单；订单、付款、
问题、经历、伴侣、命名要求、时间和重启次数不得进入基础身份。AGENT 不判断是否相似，
只执行云端已经唯一化的固定订单。

## 2. 固定动作图

动作图只能由版本化产品 profile 决定，不使用通用 planner，不根据 AI 回答生成下一动作：

```txt
八字 canonical base：基础解读（独立私有会话）
八字命盘解读：从 canonical base checkpoint 建立无问题、无经历的独立 child
八字完整：从 canonical base checkpoint 建立独立问题 child
八字追问：读取父任务 seeded base（零 GPT）→ 从父正式回答会话续接一次新问题分析
奇门专业解答：单阶段分析
奇门追问：从父专业解答最终会话续接单阶段追问
合婚 canonical A/B：甲方、乙方各自在隔离会话完成一次私解；两张基础订单可并发
合婚分析：读取两份已校验私解、双完整命盘和全部 READY 语料，在关系专属新会话形成合婚总论
合婚追问：从父合婚总论最终会话续接单阶段追问
新命盘起名：从目标人物 base checkpoint 建立项目 child 完成问题分析 → 同一 child 起名；辅助人物各自在隔离 base 中分析，只通过 typed participant manifest 合流
已有报告起名：在与源报告不同的 fresh 会话单阶段起名
人工准确度追问：继续父订单原 GPT 会话
定时质量复盘：冻结快照 → 独立私有新会话单阶段复盘
付款截图观察：单阶段观察
公开知识文章：完整语料研究 → 同会话文章写作 → 同会话生成一张文章图片
```

网站必须一次提供每张 cloud job 的全部静态阶段材料。AGENT 只按固定 profile 决定依赖、
续聊和下一阶段；前序 AI 原始回答由 AGENT 校验 hash 后生成内部附件，网站不得伪造。
同一 job 中依法 `same_conversation` 的后继 stage 必须继续上一 stage 的精确 URL；BZ05、
BZ03 与 NM01 的首个正式阶段必须执行 `forked_from_checkpoint`，子会话不得等于 base 或兄弟
child。所有最终指向同一个已验证 `webChatUrl` 的订单共用一条
FIFO 串行车道，即使直接父 job/stage 不同也不得并发写入同一聊天；不同 child 允许并发。合婚 A、B canonical
私解与关系综合是三个明确独立上下文，不能套用“每张商业履行只能一个聊天”的旧规则。

## 3. 持久工厂

- 整单、阶段、状态、输入 hash、原始回答、provider proof 和事件必须写入本地 SQLite。
- 原始回答 hash 必须统一保存为 `sha256:<64位小写十六进制>`。v4 账本出现缺前缀、错误格式
  或字节不一致都按不可变身份损坏失败关闭；运行时不得改写、补齐或迁移这类记录。
- 活动订单、凭据、cloud claim、本地读取、恢复和新写入只接受 `xuanxue-ai-production-v4`。
  v1/v2/v3 的一次性清算与设备迁移已经完成，旧 decoder、排空工具、归档表消费者和启动兼容
  代码必须从活动仓库物理删除；不得保留离线桥、回退入口或第二读取链。历史证据只存在于既有
  备份和 Git 历史，不得重新接回运行时。
- `orderId` 与 `sourceTaskId` 都幂等；相同 hash 重放复用，冲突在 GPT 提交前失败。
- 每个阶段的 Gateway `inputRefs` 必须包含整单 `inputBundleRef` 这一非文件身份锚点。
  即使阶段没有附件，模型运行证明也不得出现空输入；附件数量、上传动作与文件证明只统计
  带 `filePath` 的真实文件，禁止把逻辑输入包伪装成附件。
- 网站、工厂与 Gateway 均不得声明、传递或执行 `maxInputChars`、prompt 字符/字节/token 预算、
  阈值放宽或文本切片。系统只核对提示词精确身份与原始字节，是否能接收由真实 GPT 页面决定；
  失败只能来自真实 provider 结果，禁止本地字符门禁制造执行重启。
- 公开知识文章只允许正式 `corpus_research` 执行上传一次附件。网站先创建一张持久 production
  job，AGENT 领取后下载并重验冻结字节；随后同一 execution 在唯一真实 Chrome 插件标签页
  把全部附件一次性放入最终 composer，持久化逐附件顺序、原文件名、显示文件名、SHA-256、
  字节数、expected/detected count 与稳定窗口 proof，且只有 proof 全等后才点击发送。job 创建、
  对象下载或本地暂存都不是 provider submission。独立 provider-input-preflight route、base64
  文件副本、临时预检会话、预检容量队列、上传后清空再重传、HTTP 请求体/文件字节上限和
  第二附件动作图必须物理不存在。真实窗口拒绝、附件漂移、缺件、乱序或 proof 缺失时，同一
  job 必须以 `XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION` 失败关闭，并证明
  submission、turn marker 与 canonical conversation 均未形成；不得进入恢复循环或换 execution
  重传。
- 附件 child 形成终态 `AttachmentUploadProof` 时，必须在原执行和原 cloud lease 内立即通过既有
  job checkpoint 回传最小结构化摘要：`stage_id / upload_attempt_id / status / expected_count /
  detected_count / current_file_name / staging_manifest_hash / observed_at`。这个摘要只是本地持久 proof 的
  可观测投影，不是第二 proof、第二遥测通道或提交授权；不得传入本地路径、提示词、provider
  URL、marker 或秘密。回调必须挂在唯一 coordinator 中同一 order 的实际执行上，不得为了进度重跑阶段、
  重读一次上传动作或新建 polling owner。
- 网站下发的 `maxFileCount` 只约束网站冻结的阶段材料。AGENT 为同一动作图生成的、已经
  重算 hash 的前置阶段原始回答或父报告附件，必须按实际生成数量一份一份精确增加最终
  Gateway 附件上限；禁止沿用网站材料上限误杀合法补件，也禁止用任意常数或无限上限放宽。
- 默认生产窗口为 10 张在制整单，1..64 可由本机运维配置；调用方不能控制。
- 等待订单按本地 FIFO 进入窗口；领取云端任务时必须扣除本机 active 数量，禁止越领越多。
- 同一 orderId 在同一进程只能有一个执行 promise；不得 fire-and-forget 或吞掉后台异常。
- 阶段 execution id 永久稳定。重启后 `queued/running/recovery_pending` 重新进入唯一调度器，
  但只能先由 outbound worker 将本地 durable order 与原 cloud job 对账、撤销旧租约并重新
  领取；禁止启动一个脱离云端 worker 的本地后台执行。AI Input Gateway 依据同一
  execution id 恢复已提交会话，禁止重发提示词。
- 本地 `completed` 但尚未收到云端确认的整单也属于待对账订单。重启后必须先以
  `orderId + sourceTaskId + requestHash + 原设备身份` 请求云端恢复，再领取新 lease 幂等
  回传已有结果；不得丢弃、重新分析或永远停在本地。
- 云端明确返回 `AI_PRODUCTION_LOCAL_RECOVERY_DEVICE_MISMATCH` 时，该本地订单不是
  瞬时网络失败。必须保留订单、阶段、结果、失败原因和事件账，并一次性持久化为
  `review_required`；后续冷启动从自动恢复集合排除，禁止每次重启重复查询同一外来账本。
- 对账时若云端原 job 已明确为 `cancelled`，本地不得继续调用 recovery 接口或重新进入
  GPT 动作图。必须把本地整单和所有未完成阶段一次性固化为 `cancelled`，保留已经完成的
  阶段、execution、checkpoint 与全部事件证据，并从以后冷启动的自动恢复集合排除。云端
  取消是有证据的终止，不是临时无货、网络失败或可重试故障。
- 云端允许携带已经证明的 `seeded_stages` 连续前缀；本地必须重验回答 hash、GPT proof、
  固定图顺序和与现场回答完全相同的输出完整性闸门。私用字符、provider 引用残留、
  “消息流中的错误”“输入完整性校验失败”“输入缺失无法解读”或明确无法读取附件的
  provider 失败回答都不是可复用分析：该 seed 必须保留旧 execution 身份作为退休证据，
  但不得进入 completed，必须换新 execution 从该阶段重做。只有合法前缀才允许跳过，
  禁止一边浪费合法旧分析，一边复用坏回答。
- 人工准确度追问必须携带父 job/stage/raw hash；只允许父订单原设备领取，并在父
  `webChatUrl` 继续会话。父回答同时作为校验后的内部附件，不得覆盖或修改。
- `scheduled_quality_reflection` 必须带服务器冻结的 snapshot/plan/lineage 身份，在全新私有
  GPT 会话运行，禁止 continuation parent、禁止打开父 `webChatUrl`、禁止把复盘轮次写进
  用户聊天。它只回传严格结构化线索或 `no_issue`，不修改父回答或生产对象。
- 公开知识文章固定恰好三个阶段且共享同一个 canonical `webChatUrl`。第三阶段必须精确绑定
  自己的精确 clean prompt identity 和紧随其后的目标 assistant turn；internal marker 只留在
  本地 execution proof，不得进入 provider 可见正文；页面
  其他图片、多个 preview/thumbnail、截图或文本 URL 不得进入结果。原图由 Gateway 下载，
  工厂只能通过 `media-processing` 公共 facade 执行 contain 固定画布、WebP、元数据清除、
  解码复验和 hash 证明，不得私写 sharp 第二实现。网站交付的第三阶段提示词是唯一创意
  指令，AGENT 必须原样运输，不得追加人物、文字、地图、图表、Logo、命盘、风格或候选数量
  等语义限制，也不得建立图像内容红线观察或第二创意裁决。
- 三类付费报告追问也必须携带 immediate 固定父身份：八字只接受
  `bazi_chart_interpretation/chart_interpretation`、
  `bazi_ai_full_analysis/question_analysis` 或
  `bazi_report_followup/question_analysis`；奇门只接受
  `qimen_professional_answer/analysis` 或 `qimen_report_followup/followup`；合婚只接受
  `hehun_ai_analysis/final_compatibility` 或 `hehun_report_followup/followup`。每一代
  followup 都只可精确续接其直接父会话；父身份必须绑定 `job_id + stage_id + raw_output_hash + exact webChatUrl`，
  不可猜测，也不等于本机当前一定还保存着父 GPT 会话。
- 父身份正确但父本地账本、父 `webChatUrl` 或 provider 会话已经丢失时，不得把用户订单
  变成失败或人工阻断。网站必须随子订单下发 lease-bound
  `continuation_parent_replay`；AGENT 从父产品第一阶段按原冻结主体和原拓扑重放完整父动作图，记录原父
  raw hash 到重建父 raw hash / GPT URL 的持久映射，然后只在这个重建父聊天里发送追问。
  这是高成本灾难恢复，只在原父会话无法恢复时启用，绝不允许直接新建空白追问聊天。
- 一张多阶段订单内部的后续节点若证明上一节点 GPT 会话已丢失、打开后回到首页或漂移到
  其他正式聊天，不得在后续节点上原地高频重试，也不得为后续节点新建空白聊天。AGENT
  必须立即退休本次后续 execution，把整张订单的全部节点从第一阶段开始重放到一个新的
  GPT 会话，事件记录 `conversation_graph_rebuild_started`，每个新节点保存被替换的
  `supersededExecutionId`。这是保证用户报告完整性的高成本兜底，用户侧始终只显示处理中。
- 同一已验证 `webChatUrl` 是一条持久串行车道：该聊天上的 N 个用户问题、命名步骤、
  人工复盘与追问严格按本地 `createdAt + orderId` FIFO，前一项未完成时下一项不得投喂。
  URL 尚未取得前用不可变父 job/stage 作为临时车道键；不同物理聊天继续共享总生产窗口并发。
- 同一张整单的第二、第三或第 N 个 stage 只通过父 canonical URL、父 turn marker、父回答
  hash 与本轮 turn marker 续接。供应商自动标题不进入生产身份，AGENT 禁止读取或修改标题。
  回答 checkpoint 一旦完成，下一 stage 立即取得提交优先级；AGENT 重启先按唯一 provider
  exact canonical conversation URL 非创建式恢复精确 provider target，再按该 URL 恢复 stage；
  同源但 URL 不同的标签不得阻断或被选中，物理标签当前 URL 不是 stage 身份，禁止猜测、重放模型、重新收费或让整单退回 AI 轮询。
- 启动时发现历史付费追问没有 `conversationParent`，必须保留其订单、阶段和事件证据，
  进入 `recovery_pending` 并请求网站按原业务记录重新发出带父身份与父重放包的订单；
  用户侧只显示处理中。新 claim 到达时只允许在原 order/source/product/input bundle 与
  阶段材料语义完全一致、旧记录仅缺父身份且处于恢复态时，原位补入父身份和新 request hash，
  将旧阶段快照写入事件账，并为子追问阶段生成全新 execution id 后继续；历史空白聊天的
  submission、附件上传证明、marker 和页面 URL 只能留作事件证据，绝不能被新父链请求恢复。
  任何其他 identity 差异仍失败关闭。AGENT 禁止猜父聊天，
  也禁止为兼容旧坏实践而新开聊天。网站 PostgreSQL JSONB 与本地 SQLite/JSON 的身份比较
  必须使用对象字段顺序无关的 canonical comparison，禁止把同值字段重排误判为篡改；
  允许同时升级已验证的固定同会话 prompt 旧句和 manifest/输出合同的内部运输 hash、摘要、
  字节数与文件路径，但父报告、冻结案卷、用户追问等业务输入的 hash、字节数和语义必须逐项不变。
  旧版本若已写入 `followup_parent_binding_repaired`，却仍让阶段使用
  `xuanxue-ai-production:<order>:<stage>` 旧默认 execution id，启动迁移必须精确识别这个
  半升级状态，追加 `followup_parent_wrong_chat_execution_retired`，换新 execution id 并清空
  子阶段旧 proof；不得再次恢复旧空白聊天。
- GPT 回答含私用区字符、`filecite` / `oaicite` / `contentReference` 等 provider 内部
  引用残留、乱码替代符、要求 JSON 却无法解析、缺少原始回答，或明确返回“消息流中的错误”
  “输入完整性校验失败”“输入缺失无法解读”“无法读取附件”等 provider 失败回答时，
  该次回答立即作废，清空 response/proof，生成新 execution id，从当前阶段重新投喂；
  坏回答不得进入 seed、阶段结果或整单结果。
- 新根任务只有在唯一新用户轮次与本次 clean prompt 精确匹配、正式 URL 尚未被其他根
  execution 占用后才算投喂成功。按钮点击、空白首页、相似旧提示词或重复 prompt 都必须
  立即废弃本次 execution 并内部重跑；不得把内部 marker 拼进 provider 可见正文。
- Gateway 已把一次 execution 持久化为 `failed/review_required` 时，工厂先看持久化提交
  证明。已有正式 provider URL 或 submitted turn 的执行必须保留原 execution id、marker 和
  父聊天等待恢复，哪怕故障来自监控产生的第二标签、登录或安全屏障，也不得再次投喂。只有
  已证明污染/无效的完整回答，或从未形成提交证明的真正终态身份故障，才清空旧 feed result、
  生成新 execution id，并把被替换编号交给防重复闸门原子换主。
- “真正终态身份故障”必须有排除普通等待态的正面证据，只限新根提交已经回弹到外国
  marker、正式 canonical 会话已被另一 fresh execution 占用，或同一 marker 出现多份等不可继续
  使用本 execution 的身份冲突。首页仍在 hydration、clean-root 检查为 `pending`、composer 尚未
  就绪、新聊天控件暂时为 0 个或多个且尚未点击、命令超时、页面尚未回到 `/` 都确定不是终态
  身份故障；无提交证明时也必须保留同一 execution id 有界恢复。通用 Gateway 分类为
  `failed/review_required`、错误字符串或重试次数本身均不得作为 fresh execution 许可。
- 同一阶段的提交前身份冲突最多允许一次 fresh execution 换主。替换后的 execution 再遇身份
  冲突时保留该编号进入 `recovery_pending`，等待真实页面条件恢复或显式人工处置；不得形成
  `restart:2`、`restart:3` 等无限编号风暴。回答完整落盘后被证明污染/无效的重新投喂继续受
  阶段 timeout 约束，不与这条提交前身份替换额度混用。
- 临时无货、登录、验证码、安全屏障、provider 故障、父会话恢复和输出污染全部进入
  `recovery_pending`，用户侧继续显示处理中。`review_required/failed` 只保留给已证明的
  外来设备账本、不可变身份冲突或安全攻击，不得用来处理普通用户体验问题。
- 在一张有效云端 lease 持续 heartbeat 期间，阶段级 `recovery_pending` 必须按该阶段
  timeout 内的有界退避继续同一 execution id；其他整单不能因为某张订单仍在生成就
  放弃本应完成的首次发布。超出阶段 timeout 后才允许整单回传 `recovery_pending`，
  下一次 lease 仍从同一 execution id 恢复。唯一例外是附件 child 已经持久化
  `attachmentUploadProof.status=failed/review_required`：该 proof 是本次附件运输的终态，
  工厂必须立即停止同租约循环和重启恢复中的 Gateway 再进入，原 proof、attempt id 与
  execution id 保持不变；修复页面或运输故障后，只能由显式人工授权启动新的附件 execution，
  禁止后台每 1–10 秒再次复制粘贴或再次打开原生文件选择器。
## 4. 云端激活

本机主动向网站服务器轮询，不开放入站端口。设备凭据只存 0600 文件或 secret env。
领取后的输入下载、heartbeat、checkpoint、结果和失败回传都必须绑定当前 lease
token/version。只有重启前已落盘订单的云端恢复请求不携带旧 lease；它必须绑定原设备、
原 job/local order/source task/request hash，并只把非人工终态恢复到
`recovery_pending` 后重新领取新 lease。
含父会话关系的 claim 必须同时携带固定父订单的完整 `continuation_parent_replay` 元数据；父材料下载
使用子订单当前 lease 和子订单路径授权，禁止把父对象地址变成无租约公共下载。即使本机
SQLite 整片丢失，AGENT 也能先重建父订单、再恢复追问。
服务器只返回整单，AGENT 只回传整单结果。

## 5. 禁止

- 禁止网站逐阶段遥控生产工厂。
- 禁止通用 planner、AI 决定 workflow、兼容执行器、影子队列或第二结果真相。
- 禁止插件 import provider adapter、DOM/browser 私有实现或另一个插件。
- 禁止把 5 个确定性产品送入 GPT。
- 禁止重复提示词、失败吞没、假结果、无 lease 输入下载或无 hash 的跨阶段回答。
- 禁止人工复盘新开无父身份聊天，禁止把 seeded 回答当成无需 proof 的普通文本。
- 禁止定时质量复盘继续父会话；人工 challenge 与 scheduled reflection 的会话规则不得互换。
- 禁止公开知识图片缺失、多张、错误目标 turn、插件私有图像处理或运行时联网安装依赖。
- 禁止任何付费报告追问新开空白聊天；禁止同一父聊天的两个追问同时投喂。
- 禁止同一 URL 上的多个订单或阶段并发投喂。
- 禁止为每张八字、合婚或起名商业订单重复创建相同 canonical base。
- 禁止把用户问题、伴侣或命名要求放进 canonical base 身份。
- 禁止复用任何用户问题、关系综合或命名回答。
- 禁止 `question_analysis → naming_author` 后继节点新开聊天。
- 禁止把可恢复的父会话丢失、provider 故障或坏回答包装为用户侧失败/阻断。
- 禁止同一订单后续节点因父聊天丢失而紧循环；必须整图从第一步重建。
- 禁止附件 child 已给出 `failed/review_required` 终态 proof 后，由工厂循环、重启恢复或
  新 lease 自动再次调用 Gateway 上传；不得形成第二附件恢复 owner。

```apex-law
{
  "lawId": "GRASSEYE-XUANXUE-AI-PRODUCTION-001-V5",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "xuanxue-ai-production",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance",
  "summary": "The factory executes the user-result products, private-base actions and four explicit single-stage localization products through fixed graphs and provider-verified checkpoint topology.",
  "required": [
    "The protocol includes four single-stage localization products: localization_report_translation, localization_article_translation, localization_static_review_candidate and localization_static_review_selector.",
    "Localization static-review candidate roles candidate_a and candidate_b are independent single-stage jobs; selector_first, selector_swap and consistency are single-stage selector jobs, with selector_swap continuing the exact selector conversation through conversation_parent.",
    "Localization products have no person subject or synthetic participant; they bind only the immutable localization review context ref/hash, conversation scope and lease. User and chart products continue to require real frozen participants.",
    "A localization stage may complete only with persisted provider transcript JSONL plus hash and live model identity evidence (family, display name, reasoning effort and evidence hash); request metadata alone is never model proof.",
    "GPT Web localization execution must use the visible composer capability control to open the model menu, visibly select GPT-5.6 Sol, then select and read back the reasoning label from the live slider mapping: 0=极速, 1=中, 2=高, 3=极高, 4=Pro; the requested stage profile is not proof until the provider UI read-back matches.",
    "All nine commercial metaphysics products use one hash-bound GPT Web profile: model display GPT-5.6 Sol, family gpt-5.6 and semantic reasoning tier pro_standard. The live provider label Pro is the sole accepted read-back for that tier; account-plan text, GPT-PRO literals, pro_extended literals, slider coordinates and request metadata are not production model proof.",
    "Provider UI observation must be limited to visible semantic roles/labels (model menu item, reasoning slider and live page URL); missing, ambiguous or mismatched controls fail closed as review_required before prompt submission, and no request field or hardcoded profile may substitute for the observation.",
    "Only versioned product profiles control dependencies, typed joins, conversation topology and final stage.",
    "BZ05, BZ03 and NM01 begin in distinct provider-verified children forked from one immutable Bazi base checkpoint; no child reuses the base or a sibling conversation.",
    "NM01 naming_author continues its own question_analysis child, NM02 uses a fresh conversation distinct from its source report, and BZ04 continues the selected immediate BZ05, BZ03 or BZ04 formal parent conversation.",
    "Hehun party A and party B private bases are isolated and final compatibility uses a third fresh context receiving only the typed participant manifest and verified private-base artifacts.",
    "One target plus any auxiliaries keep one isolated base per person; the author receives only exact participant slots, roles, person/profile/chart identities, hashes and authorization proof.",
    "Business plugins call AI Input Gateway only through its public contract.",
    "Every stage binds the immutable input bundle as a non-file input ref, including zero-attachment stages.",
    "Every provider result records one explicit fresh, same_conversation or forked_from_checkpoint proof; an unsupported or unproved exact fork fails closed.",
    "Bazi, Qimen and Hehun paid follow-ups bind their immediate parent product, final stage, execution, scope, raw output hash and exact webChatUrl: BZ04 accepts BZ05/BZ03/BZ04, QM04 accepts QM03/QM04, and HH03 accepts HH02/HH03. Each recursive positive case must pass, and a blank-chat continuation must fail. If the exact GPT Web URL is unavailable, the Agent replays the minimum necessary parent graph and continues only when the rebuilt raw hash is identical."
  ],
  "forbidden": [
    "website-controlled next action, browser command or per-stage cloud job",
    "generic planner, AI-generated workflow or second execution owner",
    "deterministic products entering GPT transport",
    "duplicate canonical-base production for one stable identity",
    "user question, partner or naming requirement included in a canonical-base identity",
    "reuse of a user answer",
    "a checkpoint child simulated with a blank chat, base summary, uploaded base transcript, second-model retelling or mutable base tail",
    "a downstream same-conversation stage opening a blank or different GPT conversation",
    "paid follow-up execution outside its exact or fully rebuilt parent conversation",
    "blank new GPT conversation used as a follow-up fallback",
    "GPT-PRO or pro_extended as an active metaphysics production profile"
  ],
  "clauses": [
    {
      "clauseId": "grasseye-xuanxue-ai-production-001-v5-requirement",
      "statement": "Private bases execute once per stable identity; every formal child has one explicit provider topology proof and typed joins never merge conversations or invent a synthetic subject.",
      "evidenceMode": "acceptance",
      "ownerDomain": "xuanxue-ai-production"
    },
    {
      "clauseId": "grasseye-xuanxue-ai-production-001-v5-real-chrome-proof",
      "statement": "A real signed-in Chrome run and its persisted provider records must prove the production conversation topology, attachment counts, unique response markers and exact continuation or fork relationships.",
      "evidenceMode": "real-chrome",
      "ownerDomain": "xuanxue-ai-production"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-XUANXUE-AI-PRODUCTION-002-V5",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "xuanxue-ai-production",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance",
  "summary": "Every production order and stage is idempotent, SQLite-durable and restart-recoverable; all work sharing one exact GPT URL uses one durable FIFO lane while different URLs remain concurrent.",
  "required": [
    "Order, stage, raw response, provider proof and event truth persist in SQLite.",
    "Every raw response hash uses canonical sha256-prefixed identity and byte-verified metadata repair preserves already completed analysis.",
    "The default production window is ten and cloud claims subtract active local work.",
    "A recoverable stage retries with bounded backoff under the live heartbeating lease so independent graph branches complete their required submissions before order-level deferral.",
    "Restart resumes a durable submitted turn without duplicate prompt submission. Recoverable transport faults retain the same execution id and logical-turn marker, whether they happen before or after submission. Only a proven polluted or invalid completed answer, or a genuinely terminal pre-submit identity fault, creates a fresh execution id and fresh marker; a captured submission always resumes instead of sending again."
    ,"Restart reconciliation reclaims the original cloud job before local execution and republishes any already completed local result under a fresh lease.",
    "A cloud-confirmed foreign-device recovery ledger is durably quarantined as review_required once and is excluded from later automatic restart reconciliation.",
    "Only one order or stage for the same exact webChatUrl may submit at a time, in createdAt and orderId FIFO order.",
    "Fork siblings use different conversation scopes and provider URLs, may execute in parallel within bounded capacity, and never share a same-conversation FIFO lane.",
    "Restart, disconnect, lease takeover and disaster rebuild preserve frozen subject, participant manifest, parent checkpoint, child scope and provider proof; downstream stays blocked when a rebuilt parent raw hash differs.",
    "Historical paid follow-ups without a continuation parent remain recovery_pending until the website reissues their immutable parent identity; an exact one-way local repair preserves old stage evidence and users never receive an ordinary runtime failure.",
    "Provider citation residue, private-use characters, invalid required JSON and missing raw output are discarded and restarted with a fresh execution id and fresh marker, while a transport retry never duplicates one already submitted logical turn merely because page-global turn counts changed during provider hydration.",
    "A failed or review_required gateway execution with durable submission proof always resumes the same execution id, marker and provider conversation. A fresh execution is allowed only for a proven polluted or invalid completed answer, or a genuinely terminal pre-submit identity fault.",
    "A failed or review_required attachment upload proof is terminal for that attachment execution: same-lease loops, restart recovery and new leases preserve its proof and never call the Gateway upload again without explicit operator authorization.",
    "A missing local or provider parent conversation is reconstructed from the lease-bound parent replay package and persisted in production_parent_conversation_rebuilds."
  ],
  "forbidden": [
    "in-memory-only order truth, untracked background promise or swallowed failure",
    "unbounded cloud claiming, duplicate local execution or duplicate prompt submission",
    "user-visible terminal loss for provider absence, output contamination or recoverable parent-conversation loss",
    "detached local restart execution without an attached cloud publisher",
    "re-querying the same cloud-confirmed foreign-device ledger on every restart",
    "parallel submissions into one parent GPT conversation",
    "using page-global user-turn count deltas as authority to resend a stage that already has an exact logical-turn marker",
    "resuming a known detached downstream stage in its blank or wrong conversation",
    "reviving an invalid parentless follow-up through a blank conversation",
    "any second upload attempt after a terminal attachment upload proof",
    "publishing provider-internal citation residue as a production answer"
  ],
  "clauses": [
    {
      "clauseId": "grasseye-xuanxue-ai-production-002-v5-requirement",
      "statement": "All work sharing one exact or reconstructed GPT URL executes through one durable FIFO lane; captured work survives restart, invalid outputs restart only their execution, and ordinary recovery never becomes a user-visible terminal failure.",
      "evidenceMode": "acceptance",
      "ownerDomain": "xuanxue-ai-production"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-XUANXUE-AI-PRODUCTION-003-V2",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "xuanxue-ai-production",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance",
  "summary": "The local factory activates through authenticated outbound lease polling and returns exact whole-order checkpoints, results and failures.",
  "required": [
    "Device credentials remain local and permission-restricted.",
    "Input download and every mutation bind the exact lease token and lease version.",
    "The worker claims only available local production capacity."
    ,"Durable local orders are reconciled to the original cloud job before execution resumes; completed local results are republished under a fresh lease.",
    "Every claimed conversation child includes a lease-bound continuation_parent_replay package plus exact frozen subject, conversation scope and typed join identities so a lost local parent can be reconstructed from its first stage."
  ],
  "forbidden": [
    "inbound home port or server callback",
    "unleased input download or result mutation",
    "secret output in logs, routes or evidence"
  ],
  "clauses": [
    {
      "clauseId": "grasseye-xuanxue-ai-production-003-v2-requirement",
      "statement": "The local factory activates through authenticated outbound lease polling and returns exact whole-order checkpoints, results and failures.",
      "evidenceMode": "acceptance",
      "ownerDomain": "xuanxue-ai-production"
    }
  ]
}
```
