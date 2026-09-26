# 双仓 AI 生产现场八项问题闭环修复：完整实现方案

状态：**设计阻断**（2026-09-26）。本文是本次八项现场发现的一份集成施工方案；既有 GPT DOM、固定文案同 cohort、`current_reason` 与拓扑方案仍分别持有其原有 GAP，本文只规定本次相邻 handoff 与验收，不复制其已施工工单。本状态不是 CHANGE、READY、RELEASE 或生产证明。

## 1. 需求、Owner、终点与边界

需求 Owner 为 AGENT `agent-production-runtime` 的跨仓结果交付链；固定文案的领域接受与当前表由 Website `localization` 独占，V6 attempt/公开完成与 exact 删除由 Website `ai-acceptance` 独占，GPT/Browser 物理事实仍由各自现役 Owner 独占。终点是同一 `job_id + request_hash + accepted attempt + result_payload_hash` 取得 Website 领域 admission receipt，固定文案逐字段在 `localization_static_current` 对当前 source/policy 可读回；未完成 job 保持可领取或有界再检查，已发生的 Provider 输入不得因本方案重放。

范围为用户列出的八项。Website 启动、数据库、迁移、lease、容量背压和两张新 JOB 的 AGENT 侧结果上传不是本次故障工单。不得新建任务状态、队列、结果存储、兼容桥、第二恢复器或第二质量 verdict；不得把控制室、日志、HTTP 成功或 AGENT terminal 当作领域终点。

## 2. 输入证据与 scoped candidate

| 仓库 | 当前读取 | 本轮直接相关事实 |
| --- | --- | --- |
| AGENT `/Users/nexgen/Documents/AGENT` | 本地 `main@00345e66b3dc9e9d493248e21b4794c0df5e8dff`，远端 `origin/main@4b2e863f717264522be98b00bf47bbd1397580fb`，工作树 clean；本地 ahead 5 / behind 2 | 本方案涉及的 Runtime/GPT selector 目标文件本地与远端 blob 相同；Browser `dom-coherent-observation.ts` 和功能法案在两端不同，本地含短 Prompt 修复，远端仍带短节点“无元素子节点”过滤。远端 law 与 Browser 改动必须逐项重绑，不得把本地修复说成云仓已生效。 |
| Website `/Users/nexgen/Documents/xuanxue-web` | 本地 `main@d03dfd91de9db0c3c3de8481baef43ccd91cf7e5`，远端 `origin/main@642f631dcfa406d0e1d577e36cdd4c1c3a8f20d8`，工作树 clean；本地 behind 1 | 本次涉及的固定文案 consumer、command、V6 observation contract 在两端 blob 相同；远端新增内容不改变这些目标代码。 |

本轮静态证据：Website `business-result-consumer.ts:295-296`、`localization-static-catalog-consumer.ts:232-268`、`localization-static-catalog-command.ts:260-266,293-303`；AGENT `runtime-source-handoff.ts:96-126,225-281`、`runtime-business-admission.ts:38-72`、`worker-observation-client.ts:38-47`、`submit_exact_gpt_turn_once/selectors.ts:4`；Website `v6-worker-observation.ts:76-86`、`job-device-status-repository.ts:174`。用户提供的现场日志属于观察证据；两张旧 JOB 的逐 predicate、固定文案实际 source/policy guard、cleanup 事件的原 span/WAL 尚未本轮读回，不能写为已知根因。

施工前重绑两仓远端 HEAD、以上目标文件及其直接 caller/consumer、AGENT `功能法案.md` 与 V6/GPT/Browser Blueprints、Website `功能法案.md` 与 AI Acceptance/System Blueprints、V6 provider/consumer manifest、既有方案和原生 quality 入口。AGENT remote law 与本地 diverged，且本地 GPT 修复尚未进入远端，属于本方案的实际候选门；不得在未合并的两个树之间拼出虚构的“最新 main”。本方案文件自身另记 Git blob，不计入 source candidate。

## 3. 四维权威与前轮连续性

| 项 | 法案与施工图 | 现役实现与第一断裂 | 原生质检与业务 readback |
| --- | --- | --- | --- |
| 1 固定文案 | Website `LAW-LOCALIZATION-020-V25` 允许旧冻结结果记账，仅当前 source/policy 对齐才激活；`LAW-AI-ACCEPTANCE-001/012` 约束领域 receipt/公开完成；AI Acceptance Blueprint 与 SYSTEM Blueprint 定义二元状态 | `writeStaticCatalogAdmission` 两类 guard 静默 `return`；调用方已先 `finalizeConsumptionWithClient`。同身份再次 ensure 见 completed/pending 即抛错。要先精确查明 guard 命中、root、task identity 与 transaction 时序 | Website 唯一 `quality:check`；同 JOB 消费 hash、当前表 entries/failures、逐字段 source/policy hash 与页面读回。旧冻结结果不能被伪装成当前译文 |
| 2–3 source handoff | AGENT `LAW-AGENT-PRODUCTION-RUNTIME-001-V73`、V6 Blueprint V44；Website `LAW-AI-ACCEPTANCE-002/004/012`；原结果优先、未知外部效果零 submit 读回、typed seal 封旧完成端口 | `preflightSourceHandoff` 和 `prepareOneSourceHandoff` 多处分支返回 null，`requireSourceGrantSeal` 与 failure reconcile 最后复用总码。两旧 JOB 的哪条 predicate 失败仍未知 | AGENT 唯一 `quality:check`；同 job 的 Outbox、Browser WAL、Forensics、local typed seal、Website claim receipt / next action 与最终 admission 同身份读回 |
| 4 device 404 | Website V6 provider 对 device/session 可见性负责；AGENT Runtime Blueprint 只允许 exact Website absence 后 purge | Website `AI_V6_DEVICE_JOB_NOT_FOUND` = 缺席或该 device/session 不可见；AGENT `websiteJobAbsent()` 把它当 exact absence，直接连到三 Owner 清理 | 双仓各自 `quality:check`；不可见但存在时 Browser WAL、Forensics、task/Outbox 零删除；真删除时按原 purge 顺序逐项 absence readback |
| 5 observation null | Website V6 worker observation contract `next_action_at: string|null`，`WAIT_NEW_ATTEMPT` 可立即 eligible | Website canonical validator 与 AGENT Zod consumer 额外拒绝 null；Website `job-claim-observation.ts:171` 从可为 null 的 `retry_not_before` 投影 | 双仓合同测试/Exam；实际 observation 可解析、claim 仍由 Website 原资格/容量决定 |
| 6 GPT fresh submit | AGENT GPT/Browser Blueprints、`FROZEN-GPT-SUBMIT-TWO-PRECONDITIONS-001`；既有唯一《GPT新聊天强制聊天模式》方案 §10.3–10.4 | 远端 Browser 短 Prompt 叶子过滤仍在；本地修复移除了该过滤；`GPT_SEND_SELECTOR` 未变。12/12 旧 WAL 不能证明新代码已生产成功，也不能仅凭 selector 文本判当前 DOM 错误 | AGENT `quality:check`、Extension 生效版本、同 effect WAL input/terminal、exact user turn 与 answer readback；不可重放旧 DISPATCHED |
| 7 cleanup | AGENT V6 Blueprint 明确 admission 后 Browser cleanup 独立；`runtime-business-admission.ts:102-119` 已用 `CLEANUP` 记账 | 用户日志的 `BLOCKING` 来源尚未连到原 span。已知 admission cleanup catch 代码是 `CLEANUP`，不能未经归因就改全局 Browser 错误严重度 | 原 span 与同 job admission receipt 对齐；若确属成功后 cleanup，只修该调用点事件影响，不弱化执行中 Target 缺失的 BLOCKING |
| 8 current_reason | AGENT Runtime law V73 与 V6 Blueprint `:114` 已声明仅诊断；现有 Runtime AST inspector 与 mutant 保护控制路径 | 仍缺与 Target 同级的 byte pin；不是本批 JOB 阻断原因。既有《current_reason诊断投影与状态权威分离》方案保留已验收不变量，历史“设计阻断”状态不能代替当前代码复核 | AGENT 原生 architecture-boundary / Runtime 检查；法条原文字节 pin 与控制分支 mutant，不以文档自评作 verdict |

有限回归筛查命中：固定文案消费近轮被简化且现有静态测试只断言“先 finalize 后 write”；AGENT 旧 404 误等价已有 acceptance `true` 断言；Website/AGENT null 拒绝双侧存在；GPT 本地修复与远端未同步；`current_reason` 有前轮去权威方案。保留原结果优先、唯一 WAL、source handoff typed seal、`current_reason` 仅诊断、固定文案旧冻结结果记账这五项不变量；反转错误测试而不把历史测试绿灯当生产证明。

## 4. 唯一身份主线与有限闭环分母

主线：Website 冻结任务/source_task_id → `job_id + request_hash` → Website accepted attempt/lease/fence → AGENT Runtime 本地 task/Outbox → GPT exact call / Browser effect 与 WAL → AGENT result hash → Website staging → localization/domain consumer admission receipt → Website completed → AGENT local completed → 当前固定文案字段 readback。`current_reason`、Target、Document、观察日志和 selector 不进入长期身份。

分母只含本次已知分支：当前 source/policy 合格且至少一字段通过；旧冻结结果合格但当前源/政策漂移；字段拒收/零合格；完整结果可交付；旧结果候选未知/未结算；旧结果确证不可恢复且 Website 授权新 attempt；device 可见、不可见但存在、exact 缺席；`WAIT_NEW_ATTEMPT` 时间为 null/非 null；submit 未发送、DISPATCHED 未决、CONFIRMED、REJECTED；admission 后 cleanup 成功/失败。每个未知或不一致分支由原 Owner 保持失败关闭并以原身份再检查，不创建 replacement job 或第二状态。

## 5. 原子工单与顺序

| 顺序 | 唯一 Owner、路径与动作 | 进入门、权威输出、consumer/readback、停止与接回 |
| --- | --- | --- |
| W0 现场只读取证 | Website `localization` + AGENT Runtime 各读本仓原记录；无生产写入 | 取得报错 JOB 的完整 id、冻结 source/policy/input hash、运行 root、`business_consumption_hash`、当前表 cohort/locale/字段、guard 对比值；两张旧 JOB 各核 task/attempt、Outbox candidate、Browser 全历史、source observations、settlements、artifact verify、quiescence、typed seal、Website claim/event。每个值带同一时间/身份。缺一项则该 JOB 修复施工阻断；只允许原 Owner 原链补证，禁止盲重放或手工改库 |
| W1 Website 固定文案原位闭环 | `services/api/src/localization/localization-static-catalog-consumer.ts`、`business-result-consumer.ts`、`localization-static-catalog-command.ts`；现有事务/当前表 | 保留旧结果按冻结材料机械消费的法案语义。把两类静默 guard 变成消费调用方可区分的 typed outcome；当前匹配时同事务写 current 并逐字段 readback 后才完成。当前已漂移时消费旧结果但显式记为不激活，ensure 按**新 source/policy task identity**推进；若同一个 `source_task_id` 已 completed 却仍 pending，只对原已消费 payload/hash 做幂等领域重投影并精确读回，绝不重跑 GPT，仍不匹配则 typed 阻断并保留原事实。施工前 W0 必须证明当前同身份重复的实际分支，不能凭推测修改母稿或允许旧内容激活。旧结果、旧 current row、后继父链不得被覆盖或伪完成 |
| W2 AGENT source predicate 显露 | `runtime-source-handoff.ts` 及现有 Runtime logger / 直接 caller；不改 V44 wire | 对现有每个 `return null` 在原 Owner 内形成最早失败 predicate 的安全 typed 诊断（仅 job/attempt、predicate code 和证据 hash，不含 DOM/URL/Prompt）；保持返回语义、total error 与 claim 次序。W0 读回后按两 JOB **各自**真实 predicate 原位修复或由已有 Owner 的原身份 readback/reconcile 接回；不允许把全部 null 改成继续、跳过 artifact/WAL/quiescence 或放宽 seal。验收分别取得 exact seal/claim receipt 或安全失败和有界再检查，再到原结果 delivery/admission |
| W3 AGENT 防误 purge | `runtime-business-admission.ts::websiteJobAbsent`、同文件 caller 与现有清理 acceptance；Website provider status 只作合同核对 | 立即移除 ambiguous `AI_V6_DEVICE_JOB_NOT_FOUND` 的 purge 资格；此码保持本地结果/Outbox/WAL/Forensics 并进入原 reconciliation。仅 Website 当前合同能证明 exact job absence 的证据允许调用现有 `purgeDeletedJob`；逐项读回缺席，兄弟 JOB 不动。若当前其他 404 码也不能证明 exact absence，同样从资格中移除；不得靠 error string 另造证明。真删除路径沿旧 Owner，不新增第二 purge API |
| W4a AGENT observation consumer | `worker-observation-client.ts` 与直接 acceptance | 按 Website 已声明的 nullable contract 删除相同额外拒绝；合法 null 被读入但不改变 Website 原 claim 决定，非法日期/状态仍拒绝。先部署这个只扩大合法接收范围的 consumer，并读回版本生效 |
| W4b Website observation provider | `packages/ai-contracts/src/production-control/v6-worker-observation.ts` 与直接合同测试 | 在 W4a 已生效后，删除只针对 `WAIT_NEW_ATTEMPT + next_action_at=null` 的额外拒绝；保留字段类型和其余结构验证。null 表示无延迟，不能由 observer 签 attempt 或改变 capacity。若不能证明旧 consumer 已退场，停止 provider 部署，避免合法 null 进入旧 consumer |
| W5 GPT 已有方案接续 | 只在《GPT新聊天强制聊天模式》唯一方案原位更新候选/施工记录，复用其 WO-P2-2；本方案不新开 selector 工单 | 核本地短 Prompt 修复及法条授权与远端差异，按既有方案完成远端合入、Extension 重载/版本证明和 fresh exact submit；WAL 证明实际物理输入/用户轮次，随后 Website admission。若当前真实 DOM 与已验收 D2 不同，先更新该唯一 GPT 方案，禁止猜 selector、fallback 或额外 submit |
| W6 Browser cleanup 事件归因 | AGENT Runtime Log / Browser 原事件调用点；先 W0 对齐 span | 若 `BLOCKING` 是业务完成**之后**的 cleanup 事件，原调用点改用现役 `CLEANUP` impact 并保留清理失败的真实诊断、重试/settlement Owner；若来自执行中 Target 失联，则保持 BLOCKING，不施工严重度。前后均以同 job admission receipt 和 Browser cleanup readback 验收，不抹去未决 WAL |
| W7 `current_reason` 冻结 | AGENT `architecture-boundary` 现有 law + acceptance，不建新治理文件 | 先获得授权人对 active law **单独明确批准**；在现有 Runtime law 原句精确冻结“仅诊断、不可授权/恢复/完成”，沿用 Target 的现有 byte-pin 机制，补一个变异样本证明改字节必失败，并保留现有 AST 控制分支 mutant。若未批准，W7 保持设计阻断，但 W1–W6 不以此伪称全部八项闭合 |

W1 的旧冻结结果仍完成、当前表只接纳当前逐字段事实，跨仓 wire 不变。W2–W3 不增加 Website 状态或消息；W4 是唯一可能影响跨仓 consumer 的合同对齐，必须按 AGENT consumer → Website provider 顺序并核对部署窗口。每项修改都要遵守原生结构预算：Website `business-result-consumer.ts` 已 459 行，不能往其中叠大分支；优先在现有 localization Owner 内承载 typed outcome 与重投影。AGENT 目标文件当前均低于 500 行，但函数仍须满足现役 75 行/分支等红线。

## 6. 删除反事实与禁止路径

保留现有 `localization_static_current`：页面和控制室直接消费，删除则无法证明当前译文。保留旧结果机械消费与 admission receipt：法案要求保全已完成结果，删除会丢失精确历史与后继父链。保留 V44 typed seal、Browser WAL、Outbox：删除任一即无法区分已输入/未知和可交付旧结果。保留 `current_reason` 字段供诊断，但删除它对控制决策的任何残余输入。保留唯一 `purgeDeletedJob` 仅供 exact absence；不新建清理器。W2 的 predicate 只进已有日志/失败事实，不建新表、枚举状态或跨仓字段；W7 使用已有 byte-pin 检查位置，不新建 law corpus/registry/质量入口。删掉这些新增替代构件后，上述分母仍可由原 Owner 接回；因此均不得增加。

## 7. 分层验收、停止与回退

静态：两仓各自唯一 `quality:check`，Website 执行前在**该命令的同一环境**验证 Node >=24；只运行任务相关原生 contract/Exam/acceptance，不用单个测试冒充 READY。反例必须覆盖：completed/pending 同身份、source/policy 漂移、partial pass、重复消费；两旧 JOB 各 predicate；不可见但存在 404 零删除、exact 删除且兄弟隔离；null observation；fresh submit 已发出但后置未知不重放；成功后 cleanup 不污染业务结果；`current_reason` 改值不改变控制。

动态：冻结新候选与 clean commit 后按各仓现役法案执行 READY/RELEASE 所需 Dynamic Proof。先读旧结果/Outbox/WAL/Website admission 再允许新动作；结果未知时停止发送，按原身份 readback。固定文案同 JOB 的 `business_consumption_hash + result_payload_hash` 与 current entry `origin` 精确关联，当前 source/policy 下 pending ID 减少或显示精确失败；两张旧 JOB 最终分别有原结果领域 receipt 或 Website 持久的新 attempt 决定与后续领域 receipt。AGENT `job.execute succeeded`、200、lease renew、静态 PASS 均不能替代这一终点。

立即停止：W0 查不出 guard/predicate 真值；AGENT/Website remote 或 source candidate 漂移；旧 WAL 有未决输入而方案试图重发；跨仓 contract 出现不兼容窗口；同身份 result hash/receipt 不一致；active law/Blueprint 与目标动作冲突；W7 未获独立法案授权。回退只使用各 Owner 原有可读回的旧结果、typed failure 和 admission 事实；已经发生的 Provider 输入与已消费结果不得倒写、盲重试或删除。失败后在原 `job_id`、原 effect、原 Outbox/Website claim 处接回。施工 Codex 必须重读本节 candidate 与当时法案，逐 W0→W7 核对，不得引用本方案状态作为质量 verdict。
