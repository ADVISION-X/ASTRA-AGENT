# AGENT 运行拓扑图—生产代码对照与差异待修完整实现方案

## 2026-09-23｜质量反思隐私关闭与永久撤权闭环（当前增量）

状态：**第一阶段双仓权威已对齐；主 Codex 两轮自检均闭合，允许进入本节限定的生产代码与质检施工；真实数据库删除继续受活体读回门阻断**。本节取代下文历史阶段中的 H21–H23/N26–N28 `MATCH` 和“P0/P1/P2 为 0”作为当前裁决；下文 D01–D04、RF-01–RF-06 只记录其各自施工时的证据，不对本节新发现的隐私路径出具 PASS。2026-09-23 用户已授权双仓法案、施工图、直接关联代码/质检及数据库操作，并要求主仓 main 原位施工、无分支、先权威后代码、两轮主审、后续子智能体只读审计及 CI-FULL。

### 需求、终点与候选

本次只处理 Website 质量反思任务在账户关闭、隐私 `delete/restrict_processing` 和 snapshot retention 交错时的生命周期，以及它交给 AGENT 的 exact job 清算。业务终点为：未获领域 admission 的任务在 Website 被合法撤销后不再可领取、结果不可消费；已获 admission 的领域完成闭包保持可验证且私有内容按现役隐私 Owner 的规则处理；AGENT 对获明确删除授权的 exact job 清除自身 task/Outbox/material/result、Browser 私有对象和 Forensics artifact，并分别读回缺席。其它 job、已发生的 Provider 现实效果及 Provider 自有日志不受此工单承诺覆盖。

| 仓库 | scoped source candidate | 本节相关工作树 |
|---|---|---|
| AGENT `/Users/nexgen/Documents/AGENT` | `main`=`origin/main`=`52bef71a1ce0605931983633a3b6462908e8e6d2`；本文件、拓扑 v4、Runtime/Browser/Forensics 当前代码和 Blueprint | 本文件带先前已授权的方案差异；本轮生产目标文件写前 clean，未改 localization 文件 |
| Website `/Users/nexgen/Documents/xuanxue-web` | `main`=`origin/main`=`5470ef21cdc36f55ab659972c8533ab700243dd6`；ai-acceptance、quality reflection、privacy、retention、V6 contract/manifest、现役法案/Blueprint | 写前 clean |

这些 HEAD 是本次证据快照，不是拓扑对未来代码提交的哈希锁。拓扑 §16 的**文档自身** v4 规范化 hash 声明 `fe2974…ab62`，按其两行排除规则实算 `983473…2c12`；§3.1 的“现役”法案版本也落后当前双仓 Blueprint。两项是文档记录待裁决，不用于否定下面独立从代码证明的断裂，也不得冒充新的冻结批准。下文旧 §1 的 v2 hash 和旧 HEAD 只作为历史记录。

### 四维权威与已存在能力

- **法案/施工图**：拓扑 v4 `N19/N26–N28、H21–H23、I26/I29` 要求 Website 先裁定 admission closure，再把 exact absence/revocation 交三 Owner 清算；Website `AI-ACCEPTANCE-BLUEPRINT.md:67,83–85,119` 保留合法领域完成闭包，且普通失败必须有限退避。Website `LAW-COMMERCIAL-PRIVACY-SECURITY-007-V1` 禁止隐私清除抹掉必需交付证明，也禁止保留不必要身份。当前 V6 manifest `unfinished_delivery_liveness.permanent_stop_authority=website_job_absence_after_admin_unfinished_purge`、`retry_not_before_policy=persisted_and_finite`；AGENT Runtime Blueprint `:230,249` 明确 exact Website absence 的现有三方 purge。Browser Blueprint `:25` 仍允许 `PRIVACY_SUBJECT_CLOSED` 专用 Target release 并要求此时 WAL/effect fact 保留。**manifest 的永久停止权威与 Browser Blueprint 的 revocation 路径不能被本方案默默合并**；若最终仍需非 404 永久撤权，必须先分别取得相关现役法案/Blueprint/合同修改授权。
- **现役实现**：`runtime-privacy.ts:28,57` 是账户关闭与隐私请求入口，调用 `quality-reflection-privacy.ts:14–99`。后者只选择 `snapshot_deleted_at is null` 的计划，清空 review job `result_json`、attempt/staged/lease/fence，以 `PRIVACY_SUBJECT_CLOSED + retry_not_before=9999` 阻断 claim，却保留 job 和 terminal/admission 字段。`job-claim-selection.ts:129`、`provider-cooldown-repository.ts:140–163` 把 reason code 当控制条件；`job-claim-observation.ts:186` 仍以 terminal 字段投影 `CONSUME_CURRENT_RESULT`。`job-device-status-repository.ts:48–85` 对完成任务依赖 `result_json` 的 result hash。AGENT `runtime-business-admission.ts:44–55` 已有完整 404 purge，`runtime-claim.ts:212–220`、`runtime-loops.ts:223–235` 和 `runtime-business-admission.ts:72–84` 的非 404 撤权分支却只释放 Target/attempt。
- **真实消费者与持久事实**：Website review consumer 在 `quality-reflection-finding-repository.ts:241–327` 写 plan completion/finding/receipt；`business-result-consumer.ts:90–105` 只消费 terminal 且有 valid `result_json` 的 job。`ai_quality_reflection_plans.materialized_job_id`、review challenge 的 `child_job_id` 均有 job FK，不能将“物理删除”缩写为一条 `delete ai_production_jobs`。Browser `browser-mutation-store.ts:270–277` 与 Forensics 的现有 exact purge 是可复用的 Owner 能力；Website 的 `public-knowledge/work-order-deletion-repository.ts` 仅是独占对象清单及完成闭包判定的参考，不能直接挪用其产品私有删除范围。
- **质检**：两仓唯一原生 verdict 分别是 AGENT `npm run quality:check` 和 Website `pnpm quality:check`。现有 `tests/ai-production/quality-reflection.integration.test.ts:91–235` 断言旧 `j.status='cancelled'`/input 清理，未覆盖当前 V6 terminal/admission 投影、retention 先到期、AGENT exact purge 或兄弟 job 隔离；须先核它是否仍在原生质检分母。AGENT 现有 recovery acceptance 只断言 revocation release。`quality-reflection-schedule-repository.ts` 约 400 行，施工须先核原生结构预算，不在同一大文件继续堆状态分支。方案完成和直接验收均不得当成真实 PostgreSQL、Browser、Provider 或领域 readback。

### 第一直接断裂、前轮连续性与有限分母

1. `quality-reflection-schedule-repository.ts:282–303` 用 `r.status='failed'` 判定 materialized snapshot 可过期；V6 的 `failed` 也覆盖所有尚未 admission 的执行。随后隐私选择在 `quality-reflection-privacy.ts:22` 以 `snapshot_deleted_at is null` 排除同一 plan。这是 retention→privacy 的第一遗漏，tombstone 本身不阻止 `material-asset-lifecycle.ts:68–85` 的材料解析，也不自动清除仍有 job binding 的对象。
2. 对被选中的 plan，`quality-reflection-privacy.ts:77–89` 在原 V6 生命周期 Owner 外直接清空结果/attempt 并留下 terminal/admission 事实。已 terminal 未 admission 时 Website 投影 `CONSUME_CURRENT_RESULT` 而 consumer 无结果可收；已 admission 时设备状态可能因 result hash 缺失返回 `AI_V6_BUSINESS_ADMISSION_AUTHORITY_INVALID`。9999 年哨兵还与 manifest 的有限退避政策冲突。
3. Website job 仍存在，AGENT 的 404 清算入口不发生；非 404 `PRIVACY_SUBJECT_CLOSED` 只释放 Target/attempt，H21–H23 没有 Runtime、Browser WAL、Forensics absence readback。本文件历史 §2 曾把三行判为 MATCH；前轮实际成立的不变量是“**exact Website absence** 才进入既有三方 purge”，而非“任何永久原因都已清算”。本轮保留既有 404 purge，不复制第二清算器。

有限 Git 连续性核对命中真实语义往返：隐私 helper 的 `snapshot_deleted_at` 过滤始于 2026-08-01，2026-08-20 增加 `result_json=null`，2026-08-27 扩大 `materialized + failed` retention 资格；历史 migration `0099_ai_production_v6_permanent_authorization_revocation.sql` 曾为永久撤权原因切换合同，当前 manifest 于 2026-09-13 写成“仅 Website absence”后，helper 又于 2026-09-14 加入 attempt 清空与 9999 年哨兵。AGENT 的 exact 404 purge 于 2026-09-12 已落地，2026-09-16 的 revocation 判断仍只 release。旧测试和本文件旧 `MATCH` 没有证明完整隐私清算，因此本轮保留 404 purge 的身份/兄弟 job 隔离不变量，并以具体跨仓后置验收防止再次只修 release；历史 migration 也不能单独授权保留当前第二永久停止入口。

身份主线固定为 `privacy subject → plan_id → subject_job_id/materialized_job_id → job_id + admission receipt/result hash + current attempt/fence → Website exact status/absence → AGENT same job_id → Browser WAL/Target + Forensics artifact`。有限分母只有：未物化 plan；已物化但未领取；accepted attempt 活跃；结果已 staged/terminal 但未 admission；已 admission；retention 已标记而 job 未完成；Website 删除回执明确/未知但 exact readback 可得；AGENT 清算成功/部分失败或 Browser unresolved effect。每一分支都必须区分 `delete/account closure` 与 `restrict_processing` 的授权语义，不能假定二者等价。已有合法领域完成闭包不得因删除私有材料被伪装为未完成。

### 唯一目标链与原子工单草案

| 工单 | Owner、落点与必需动作 | consumer/readback 与停止门 |
|---|---|---|
| PR-01 | Website `ai-acceptance` 生命周期 Owner；在 `quality-reflection-privacy.ts` 入口前用现有 job/runtime 与领域 admission receipt 判定 exact child 是未完成还是已完成，不再以 `status='failed'`、`snapshot_deleted_at`、诊断码或无限重试时间代替权威。复用现有事务锁序和 V6 lifecycle，不新增隐私状态、队列或第二控制 Owner。 | 对每个 plan/job 持久读回 admission closure 与当前授权；任一缺失、未知或 FK/对象清单不完整则失败关闭，零删除。明确 `restrict_processing` 与 delete 的政策前不得施工其共同分支。 |
| PR-02 | Website quality reflection/retention Owner；`quality-reflection-schedule-repository.ts:277–305` 改为以真实 admission/撤销事实判定可清 snapshot；`quality-reflection-privacy.ts:14–24` 的隐私选取不得因 snapshot 已标记而丢掉仍存在的 child job。复用现有 plan/材料 binding 与 tombstone，不建第二 retention ledger。 | 已物化未完成、retention 先到期、再收到 delete/restrict 的同一 child 必须进入 PR-01；物理对象删除由其原 Owner 按 exact inventory/readback 完成，不能把 tombstone 当硬删除。 |
| PR-03 | Website ai-acceptance/quality reflection；对**明确允许删除且未获 admission** 的 review child 复用现有精确删除能力与对象所有权，按 plan→job→独占材料/输出/attempt/event/FK 的实际引用清单制定有序删除，保留 subject 已完成闭包。不得直接重用 SEO Work Order 私有函数或留 `PRIVACY_SUBJECT_CLOSED + 9999` 兼容壳。 | Website 对 exact child 回 404、plan 进入合法取消/关闭事实；回执未知只读回同一身份，不能重发不可逆对象删除；任何共享引用、已获 admission 或无缺席读回均停止。若现有 FK 无法在不破坏完成闭包下闭合，先形成经授权的最小 schema 变更和迁移，再施工。 |
| PR-04 | AGENT Runtime/Browser/Forensics 各自现有 Owner；只消费 PR-03 的 Website exact absence，复用 `purgeDeletedJob`，按 Runtime task/Outbox/私有目录、Browser Target/WAL、Forensics artifact 分别验证 exact absence，兄弟 job 不变。梳理并物理退休仅靠诊断码触发的永久 release 分支；普通 `WAIT_NEW_ATTEMPT` 保持原义。 | 404 后物理 submit 增量零；unresolved WAL 按现役唯一 Browser lane/删除门失败关闭，不得删除后伪称 `mutation_outcome=no`；某 Owner 清理失败保留可重读原 job identity 并报告 typed failure，不建删除队列。 |
| PR-05 | Website 已获 admission 的 review/domain Owner；保持 challenge/finding、business receipt、terminal/result hash 的必要完成闭包，同时按现役隐私/安全 Owner 清理可删除私有对象。当前 `result_json=null` 会使 V6 status 500，不能继续使用。 | 完成任务的 Website status 仍可读回原 admission hash、领域对象与 privacy 后允许保留的最小事实；AGENT 本地完成任务是否及如何获得合法清理授权、`restrict_processing` 是否可保留内容，属于下面的权威阻断，不能由 PR-03 的未完成 404 类推。 |

顺序是 PR-01/PR-05 的权威裁决与同一身份库存 → PR-02/PR-03 Website 侧修复及迁移门（若确需）→ PR-04 AGENT 现有 404 consumer 与三 Owner readback → 双仓各自直接验收/唯一 `quality:check` → 独立只读审计 → 另行授权的真实 PostgreSQL、Browser、Provider/领域 Dynamic Proof。Website 尚不能保证对仍在运行的 AGENT 产生兼容的 404 前，不得切换 PR-03；若需要跨仓新字段，必须另写同一文件内的 drain、合同冻结点、迁移和回退门，禁止临时双读/双写。

### 删除反事实与设计阻断

目标不新增任何状态、队列、worker、持久 ledger、兼容协议或第二 quality verdict：PR-01 使用 Website 已有 admission/terminal authority；PR-02 使用已有 plan 与材料对象 Owner；PR-03 使用已有 exact deletion/404 语义；PR-04 使用现有 `purgeDeletedJob`。若删去 PR-02，retention 先到期分支仍漏撤权；删去 PR-03，Website 仍留一个不可领取但未终态的 child；删去 PR-04，AGENT 私有对象仍残留；删去 PR-05，已完成任务仍因清空 `result_json` 而状态 500。`recovery_pending` 只有 schema 与接受分支、未见现役 writer；本轮不以它建立第二恢复工单，真实数据库零行/历史行必须在迁移决定前只读核验。

**当前权威裁决与施工门**：① 用户本次“不能证明不能被删除即删除”授权适用于 `account closure/delete/restrict_processing` 的未获有效领域 admission 的定时 quality reflection child：Website ai-acceptance 按 exact 身份物理删除；已获 admission 的 child 保留 result envelope/hash、领域 receipt 与必要完成事实，但无独立法律/交付依据的私有 result payload 对象必须删除并读回缺席。② Website `LAW-COMMERCIAL-PRIVACY-SECURITY-007-V2`、AI Acceptance Blueprint 与 AGENT Browser/Runtime Blueprint 将永久删除收敛为 Website exact job absence；删去 `PRIVACY_SUBJECT_CLOSED + 9999` 第二停止路径；V6 provider/consumer 合同升为 v40，不建立 v39 兼容链。③ 网站前向迁移必须在旧会话无未完成 accepted attempt 后 supersede 旧会话；旧迁移字节不改写。④ live PostgreSQL 在本机 `localhost:5432` 与 Unix socket 均不可达，活体 plan/job/admission/FK 分布未知；任何真实库删除必须先按 exact 身份、共享引用和现役约束只读盘点，不能从静态 schema 推断已安全。⑤ 第一阶段需主 Codex 两轮独立自检双仓法案/施工图/合同及当前方案，达到至少 98% 且无重大 finding 后才能进入生产代码；任何核不准项继续阻断，不用覆盖率粉饰。

### 第一阶段主 Codex 两轮自检（代码施工前）

第一轮按两仓各两份唯一 active law 全文机器解析，共 **606 条**（AGENT 38、Website 568），遍历现役施工图 **10 份**、active spec **9 份**；逐条核 active law ID、依赖、Blueprint/spec lawIds、跨仓 V6 v40 五处版本、两仓 source/registry projection。发现 AGENT Browser law 原 V47 将非 404 永久撤权与 WAL 保留并列，和 Runtime exact absence 清算冲突，已在同一法条升 V48、同步 Manifest/Blueprint 并重建唯一 registry；Website 商业隐私 law 升 V2，合同 v40、双仓 Blueprint 与依赖同步。复审后 dangling law/Blueprint/spec 引用为 **0**，两仓 `audit:projection:check` 为 `PROJECTION_CURRENT`，`git diff --check` 通过。本轮只证明权威引用结构，不证明生产行为。

第二轮由主 Codex沿 `subject → plan → child → admission → object → Website absence → AGENT Runtime/Browser/Forensics` 逐项核对 **16 个**授权与删除场景：未接纳删除、restrict 范围、已接纳闭包、完成 payload 清除、retention 先到、failed 非终态、无 9999 哨兵、Browser 只认 exact absence、诊断码不取删除权、WAL 删除读回、Runtime 现有清算、v40 唯一合同、无 v39 兼容、兄弟 job 隔离、未知结果失败关闭、无第二 Owner/状态/台账。16/16 的权威落点均有明确正负边界，按此有限分母为 **100%**，高于 98% 门；这是**法案/施工图设计自检**，不是代码、数据库、Provider 或 RELEASE PASS。现库 PostgreSQL 不可达，真实库对象分布与约束仍需在执行任何真实删除前只读核验。

### 第二阶段施工与主 Codex 代码双轮自检

双仓只在 `main` 原位修改，未建分支或 worktree。Website 沿原隐私入口锁 subject/plan/child，按领域 review receipt 与 business consumption hash 复核 admission；前向 `0147` 将 `materialized_job_id` FK 从意外 cascade 改为 SET NULL，并把 v40 旧 session、未结 accepted attempt、旧 `PRIVACY_SUBJECT_CLOSED/9999`、旧 snapshot 标删仍留 blob、已接纳 child envelope 已清空均设为失败关闭切换门。未接纳 child 在独占引用预检、cooldown cohort 精确移除及对象 Delete+HEAD 后删 exact job/级联图，读回 job/runtime/event/failure/material/artifact/write receipt 缺席与 plan 取消；已接纳 child 留 envelope/hash/receipt，删无保留依据的 payload/snapshot 私有对象并标记旧 artifact 不可再读。普通 retention 去掉 `failed` 作为完成依据并对合格 snapshot 执行物理 Delete+HEAD；review consumer 的事务锁序同步改成 subject→plan→child。商业隐私原请求先落库；含 R2 外部 Delete 的事务禁用 40001/40P01 透明重跑，每个 exact ref 先 HEAD，回执不明只回读。AGENT 保留唯一 404 purge、退休诊断码永久 release，单 job purge 失败留 durable identity 并继续兄弟恢复扫描；后台扫到执行中的 exact 404 先 abort，执行退场后再按原 Owner 清算。Forensics 在现有索引 Owner 中改为先持久 owner index、再写 bytes、原子替换共享索引，支持索引已有但 bytes 缺失的精确重试/删除，并在获授权的 exact purge 中清理旧版未入索引的独占字节。

首轮主 Codex 曾按 22 项静态场景自评 22/22；独立只读审计随后证实 Website 存在 retention 只写 tombstone、0147 旧数据门遗漏、R2 Delete 与可重试数据库事务裂缝、旧集成验收引用已删除表；AGENT 另有 Browser FIFO 唤醒、旧 Forensics byte-only orphan 与运行中 404 未 abort。**原 22/22 PASS 已撤销**，独立结论 Website 不高于 18/22、AGENT 15/16，均为 `AUDIT_FAIL`。主 Codex 已把 Website 隐私法案升 V3 并与施工图对齐，补原请求持久身份、HEAD-first 与禁透明重试、retention 物理删、旧数据迁移门及 AGENT active 404 abort，正在复核。真实数据库/R2 连接仍未配置，`pg_isready localhost:5432` 无响应；迁移和真实对象删除尚未执行，READY/RELEASE 仍未成立。未获新的独立 PASS 前不启动唯一 `quality:check ready`。

主 Codex 补审第 1 遍按 `原请求 → plan/job 锁 → 完成回执 → 独占 ref → 外部 Delete → SQL 提交 → 重入读回 → AGENT exact 404` 重查，发现只禁事务透明重试仍不足以防重启后再发 Delete，遂只在原隐私请求 `record_json` 记录被尝试对象的 ref hash，retention 复用原材料 tombstone；Delete 先 HEAD，已尝试但仍存在则 409 失败关闭。第 2 遍交叉核账户关闭、delete 与 restrict、retention 四个入口，发现不同原请求可对同一 ref 重发，以及 retention 在 serializable 主事务内另写 marker 可能造成快照冲突，遂加跨原请求与 tombstone 的同 ref 互斥，并把 retention marker 先在独立短事务写入，再开启禁透明重试的删除事务。原 22 项静态分母已逐项重新核对，**22/22 是待独立复审的主 Codex 自评**；R2 未知/仍存/缺席 3 条模拟直接验收、AGENT active 404 abort 与随后 purge 验收、双仓 typecheck/投影与 diff 检查已过。真实数据库/R2 缺席使迁移与动态结果仍待取证，独立审计结论未更新前状态保持 `AUDIT_FAIL`。

---

## 历史快照：2026-09-23 attempt failure / recovery 连坐修订

状态：**已撤销旧文中“D04 16/16 PASS”结论；本轮已按冻结拓扑第 11 节三分法完成双仓同一恢复链原位修复，两仓唯一 `quality:check` 均为 `CHANGE_PASS`，修复后跨仓子智能体审计为 PASS、P0/P1/P2 均为 0。尚未形成 READY、RELEASE 或生产证明。**

### 当前绑定与变更边界

| 仓库 | branch / HEAD | 当前工作树 | 本轮授权范围 |
|---|---|---|---|
| AGENT | `main` / `14cd463f3a7dd86c90c67000b6fb17fb12df7407` | 现有长 `source_task_id/material_id` 合同修复，以及本轮 `runtime-claim/terminal-failure` 三分法修复均为已授权 dirty；不得覆盖 | failure classifier、failure receipt/readback、同 attempt 回读领取、容量投影及直接验收 |
| Website | `main` / `44217a0121c80f5686044e6e97e67c6e9416e74a` | 本轮目标文件施工前 clean | `ai-acceptance` 内现役 lifecycle、lease expiry、claim selection 与现有 Exam；不改 wire、DB schema、active law 或 Blueprint |

冻结裁决只有三类：

1. `new_attempt_allowed`：完整当前 lease failure fact 且为 `target_local + REJECTED + (no/dispatched/confirmed)`、`provider_effect + REJECTED + no`，或现役合同已严格验证的 `RESULT_SETTLED_UNUSABLE / GPT_RESPONSE_STOPPED_EMPTY` revision rejection；
2. `same_attempt_provider_readback`：完整当前 lease provider fact，且只允许 `DISPATCHED+dispatched`、`CONFIRMED+confirmed`、`REJECTED+(dispatched|confirmed)`；保留 accepted attempt，物理 submit 增量必须为零；
3. `fail_closed`：缺失、非法、矛盾、stale lease 或其余组合；保留原 attempt/failure authority，清除失效 lease fence，禁止新 attempt、禁止同 effect regrant、禁止进入 Product。

### 已证实连坐 finding

| ID | 生产断点 | 事实与影响 | 唯一修复 |
|---|---|---|---|
| RF-01 | Website lifecycle | `!attemptFailureAllowsNewAttempt(failure)` 被直接解释为 `sameEffectReadback`，把第三类错误并入第二类 | 在现有 `job-lifecycle-core.ts` 建立唯一纯三分 classifier；release 明确 switch，fail-closed 只保留 attempt/failure 并写现役 `current_reason` |
| RF-02 | Website lease expiry | 当前布尔 `newAttemptAuthorized` 的补集全部写成 readback pending，stale/missing/contradictory fact 可被再次领取 | expiry 读取当前 attempt 的完整 failure fact 与 lease version，按同一 classifier 三分；stale/非法进入 fail-closed |
| RF-03 | Website claim selection | recoverable 只以 `attempt_id + accepted_at + lease_owner` 判断，没有证明其为第二类 | selector 读取当前 attempt append-only failure fact并复用唯一 classifier；只有第二类可 regrant |
| RF-04 | AGENT receipt/readback | release receipt 预期 reason 仍以 scope/mutation 的近似补集选择，可能把 fail-closed 当 readback receipt | receipt reason 直接由现役三分 classifier 决定；第三类只接受原 failure code，不接受 readback pending |
| RF-05 | AGENT business capacity | attestation 与 launch 只计算 active execution / pending admission，已 durable 的 readback/fail-closed attempt 在执行 promise 结束后从业务分母消失 | 复用现役 task store，将非 `WAIT_NEW_ATTEMPT` 的 pending attempt failure 计入同一 job-id 集合；同 attempt regrant 复用已有业务槽位 |
| RF-06 | AGENT claim liveness | 若 pending readback 占满 N，现役 `available > 0` 门不会再发 claim，而协议 `requested_new_limit` 又不能为 0，导致零 submit readback 永久拿不到 regrant | claim 请求仍以最小 1 保持现役 wire 合同，但 attestation 把 preserved attempt 计入 N，使 Website 新 grant capacity 为 0；AGENT 仅在存在 pending readback 且有 executor 空位时越过“新槽位为 0”门，并只接受已有 pending failure job 的 regrant |

附件提出的“Website same-effect release 清除 `lease_owner`，因此容量漏计”与当前代码不符：`sameEffectReadback` 以及过期保存分支只清 token/expiry/session/fence，保留 `lease_owner`；现役 Website `countV6DeviceBusinessInFlight` 因而仍计算该 accepted attempt。本轮禁止为这个未成立的推断新增状态或补丁，但必须以 Exam 锁定该事实。

### 修复后证据与独立审计

- AGENT：`npm run typecheck`、`npm run acceptance:agent-production-runtime`、唯一 `npm run quality:check` 均通过，最终 verdict 为 `CHANGE_PASS`；
- Website：Node `v24.20.0` 下 `pnpm quality:check` 全量通过，最终 verdict 为 `CHANGE_PASS`；AI Production V6 Exam 为 43 项，其中 42 pass、0 fail、1 项因未设置 `AI_PRODUCTION_POSTGRES_TEST=1` 跳过；
- 双仓 `git diff --check` 通过；未新增 schema、migration、wire 字段、状态、队列、worker、兼容路径或第二恢复 Owner；
- 修复后子智能体重新读取当前双仓 dirty candidate 和关键调用方，按三分类、stale fact、跨 lease provider readback、fail-closed、满 N 活性、容量去重、receipt reason、兄弟工单隔离与唯一 Owner 逐项复审，结论为 PASS，P0/P1/P2 均为 0；
- 本轮没有物理删除既有三个工单，也没有执行生产重启、真实 PostgreSQL 开关用例、真实 Browser/Provider、Dynamic Proof、READY 或 RELEASE。

### 施工顺序与验收

1. 先在 Website 将 lifecycle、expiry、selector 全部绑定同一 classifier，并补正现有 AI V6 Exam 的三类正负矩阵、stale lease、fail-closed 不可领取与容量保留；
2. 再在 AGENT 将 receipt reason、business capacity、满 N 的 readback claim 和 regrant 槽位复用绑定现有 classifier/store，并扩展现役 production runtime acceptance；
3. 运行两仓目标 typecheck/直接验收与各仓唯一 `quality:check`；静态与普通动态验收只构成 CHANGE 证据；
4. 修复完成后启动全新子智能体只读审计，按 RF-01—RF-06、冻结三分矩阵、零 submit、兄弟 job 隔离、无第二 Owner/队列/状态机逐项判定；任何 finding 回到同一文件和同一实现原位迭代。

禁止项：不新增表、列、队列、worker、恢复 ledger、wire enum、兼容读写、feature flag 或第二 classifier；不物理删除现有三个工单；不把测试、HTTP 200、READY 或 Test Mode 当生产恢复证明。

## 历史快照 §0. 当时的状态、边界与结论

状态：**PHASE 3 第六轮独立复审的 D01/D03 finding 已定点修复，D04保持16/16 PASS；修复后两轮主 Codex 自审均以10/10施工工单、204/204冻结定义与完整动态分支为分母达到100%，已进入全新第七轮只读独立复审，尚未进入 CI-FULL**。

本文件是冻结拓扑的唯一可变代码对照产物，不是第二份拓扑。PHASE 1 已按授权更新必要的 Website active law、Website/AGENT Blueprint 与质检投影；未修改 wire/DB schema，未运行 Browser、Provider、生产数据恢复或发布。

唯一结论：204 个冻结 ID 已全部得到且只得到一个静态代码裁决；其中 **185 MATCH、19 MISMATCH、0 NO_EVIDENCE**。19 个 MISMATCH 收敛为四个第一直接差异，不是 19 份补丁：

1. `D01`：限流弹窗 detector 仍以整块 `textContent` 拼接判断，且 mismatch 只抛通用错误，没有形成拓扑要求的可回读机械事实；
2. `D02`：冻结拓扑 v1 曾把 Forensics 写成“每个 Child proof/evidence 的持久账本”；已在唯一拓扑文件原位发布 v2 并修正 S23/N12/H09/H18/I18，v1 由 Git 历史保留，不扩张 Forensics；
3. `D03`：Website authority 曾允许 cooldown 到期且 cohort 闭合后在 `not_cleared` 下恢复无关新 grant；现已由 `LAW-AI-ACCEPTANCE-004-V27`、依赖升版、Website/AGENT Blueprint 和生成 registry 对齐为冻结拓扑规则，剩余是生产代码漏改；
4. `D04`：Website device-status 已返回原始 `attempt_failure` 和 write receipts，但 AGENT 丢弃 failure，且在 failure release 的 200、回复不明、409 三条分支都未完成同请求/原事实 readback。

PHASE 1 已闭合 `D02` 与 `D03` authority，且两轮主 Codex 审计通过。代码 safe cutover 固定为 **AGENT clearance-pending consumer → Website grant/heartbeat/control-room gate `D03` → 旧failure shape停claim排空门 → GPT exact-effect readback proof生产者 + Runtime failure readback `D04`同一AGENT原子提交 → Browser三态 + GPT内存proof + Runtime非attempt-failure consumer `D01`原子提交**；禁止新增表、队列、worker、恢复状态机、Forensics per-Child ledger或兼容链。

---

## 1. 冻结锚点与代码 candidate

### 1.1 唯一锚点

- 冻结拓扑：`docs/项目方案/AGENT运行拓扑图-完整实现方案.md`
- 版本：`agent-runtime-topology-form.v2`
- 冻结规范化 SHA-256：`74d8b9d3ef88f7290bb7309447064f9da1568b3e9f5dba4bff64d46b23ff6283`
- 授权时间：`2026-09-21T17:08:16+04:00`
- 本次裁决字母表：`MATCH | MISMATCH | NO_EVIDENCE`

### 1.2 当前代码绑定

| 仓库 | branch / HEAD | tracking | 只读状态 |
|---|---|---|---|
| AGENT | `main` / `69b00115f1be6478db26116969a1c5169255760b` | `origin/main` / `12c1c6578927c12d891e2f88db0c5470cd759ca6` | 仅本文件 untracked；`69e58c004..69b00115f` 只提交三份方案文档，生产代码、active law 与 Blueprint 未变 |
| Website | `main` / `8a71d36402cd6b797be1eed80308e1f0fc967e6b` | `origin/main` 同 HEAD | 另有并行任务的未跟踪 `docs/项目方案/奇门遁甲栏目-AGENT技能与合同深度迭代-完整实现方案.md`；其自声明范围只含 qimen Product Skill/合同，并明确排除 `ai-acceptance`、V6 运输、Provider Runtime 与 Browser Authority，与本方案 authority/生产路径无交集 |

第一轮独立审计期间 AGENT HEAD 从 `69e58c004...` 漂移到 `69b00115f...`；已只读核验该提交仅保存三份方案文档，没有生产代码变化。第二轮独立审计期间 Website 新增上述 qimen 方案文档；已只读核验其明确排除本方案涉及的共享基础设施与 authority，故记录为已解释、无交集的并行 dirty overlay，不纳入本方案 candidate。未来每轮审计和施工前都必须重新绑定双仓 HEAD、tracking、完整 dirty set 与冻结拓扑 hash；任一未解释漂移即停止。

### 1.3 证据层级

裁决顺序固定为：现役法案/Blueprint/canonical contract > 当前 producer/consumer 实现 > 当前持久结构 > 历史日志/方案。代码与上位 authority 冲突时判 `MISMATCH`，不得反向修改冻结事实来迎合代码。`MATCH` 只表示静态生产拓扑一致，不表示 CHANGE、READY、RELEASE 或真实工单闭环已经通过。

---

## 2. 204-ID 完整裁决分母

以下区间均为闭区间；每个 ID 只出现一次。区间行只是压缩展示，不复制第二份拓扑，语义仍逐 ID 生效。

### 2.1 MATCH（185）

| ID 分区 | 裁决 | 主要代码证据 |
|---|---|---|
| S01–S09 | MATCH | Website job/session/claim/attempt authority；AGENT Runtime/Product/GPT contracts |
| S11–S18 | MATCH | Browser WAL terminal；Runtime Outbox；Website staging/admission/completion；S18 的确定语义 `incident` 在 wire 上投影为 `pending_unknown` |
| S19–S21 | MATCH | quality 分级；Runtime local completion；Domain Consumer projection |
| N01–N11、N13–N14 | MATCH | Domain sender、V6 control、Runtime durable accept、Mediator、Product、Browser、result Outbox |
| N17–N23 | MATCH | Domain admission、public/local completion、Website failure authority、staging、cooldown Outbox |
| N25–N28 | MATCH | lease/fence 与三 Owner 精确删除/readback |
| R01–R40 | MATCH | 双仓 `website-agent-route-policies.v1.json` 字节相同、SHA-256 均为 `a27b261d000dd5b5983d1d78eb69f26e34be81f17544fcecd022626ecf1ec469`，route 数均为 40 |
| G02–G14 | MATCH | `GPT_CHILD_CAPABILITY_CONTRACTS`、handler registry、Child handler 与 Browser intent/WAL |
| T01–T18 | MATCH | 1.5/3/2.5 秒、30/20 秒、40 秒、70–90 秒、20 分钟、附件节拍、48×400ms、5 秒、heartbeat/lease/claim 常量 |
| H01–H08、H10–H14 | MATCH | task→claim→Product→Child→Browser→result→staging→admission 连续身份 |
| H16–H17 | MATCH | cooldown incident/ack transport、session receipt |
| H20–H24 | MATCH | lease renew、删除/revocation 与 fresh attestation receipt |
| O01–O17 | MATCH | Child/Browser/Outbox/admission 与 Website recovery matrix |
| O20 | MATCH | ack 失败只交付 `not_cleared`，追加点击为零 |
| I01–I13 | MATCH | 已知问题族均有现役门或单一拓扑落点 |
| I16–I17、I19–I20 | MATCH | effect identity、零重放、staging/admission 分层 |
| I22–I36 | MATCH | transport、容量、Product Owner、切换、删除、质量、lineage、media 与 deadline 边界 |

### 2.2 MISMATCH（19）

| ID | 裁决 | 第一直接差异 |
|---|---|---|
| S10 | MISMATCH | `mismatch` 没有成为可返回/可持久的 Browser observation fact；实现返回内部 `unknown_present` 后直接抛错 |
| S22 | MISMATCH | 冻结拓扑要求最新 incident/clearance 参与授权门且 `not_cleared` 永不开门；现役 Website 法案/Blueprint 与代码只要求 cooldown 到期且 cohort 闭合 |
| S23 | MISMATCH | 冻结拓扑把Forensics定义为Child proof/artifact持久Owner；现役P0法案与实现只允许已完成GPT回答原件，禁止per-Child ledger/failure record |
| N12 | MISMATCH | 冻结拓扑要求每个Child terminal append/readback/hash；现役法案禁止逐Child evidence持久，失败Child也没有Forensics artifact |
| N15 | MISMATCH | failure 409 后 Runtime 没有读回 Website 原始 attempt failure，只记录 release error 后返回 |
| N16 | MISMATCH | 弹窗 mismatch 未保留 candidate/text/button/actionability 的机械事实，不能形成完整 negative observation proof |
| N24 | MISMATCH | 冻结拓扑与 Website 现役 authority 对 clearance 是否为开门必要条件存在 canonical 冲突；代码服从后者 |
| G01 | MISMATCH | exact 弹窗资格仍由 `dialog.textContent` 与 button `textContent` 拼接决定，不符合 visible text/actionability 拓扑 |
| O18 | MISMATCH | `exact_present` 的 detector 输入面不精确，可能把视觉正确弹窗误判为不识别 |
| O19 | MISMATCH | mismatch 只剩错误码，拓扑要求的“已观察机械事实”没有进入 typed evidence/readback |
| O21 | MISMATCH | Website 稳定 409 已实现，但 Runtime 没有消费 device-status 中的原 fact 完成停止重写闭环 |
| H15 | MISMATCH | Website→Runtime 的原 failure fact 已生产，AGENT `RemoteProductionDeviceJobStatus` 未声明、解析或消费 `attempt_failure` |
| H09 | MISMATCH | 冻结拓扑声明GPT Child→Forensics逐Childproof handoff；生产只在完成答案checkpoint写raw answer artifact |
| H18 | MISMATCH | 冻结拓扑声明Forensics→Product逐Childproof回读；生产只把完成答案artifact ref/hash交回调用链 |
| H19 | MISMATCH | 冻结拓扑要求 receipt/readback 绑定 clearance；现役 authority 仅在升级为下一独立 incident 时要求前一 clearance confirmed absent |
| I14 | MISMATCH | 限流子图同时存在 detector 实现断裂与 cooldown gate canonical authority 冲突 |
| I15 | MISMATCH | 已证明的 `textContent` detector 问题仍存在于当前 HEAD |
| I18 | MISMATCH | 冻结拓扑把G01–G14所有proof/artifact统一归Forensics；现役P0边界要求Child proof留在执行链，Forensics只拥有完成答案raw artifact |
| I21 | MISMATCH | Website failure 单写门存在，但 409 后的 Runtime 原事实 readback/停止重写闭环未实现 |

### 2.3 NO_EVIDENCE（0）

本次 204 个 ID 均找到现役 authority 或生产实现锚点，因此没有以 `NO_EVIDENCE` 掩盖未知。这里的 0 不等于动态证明通过；本轮没有运行测试和生产验证。

---

## 3. 四个第一直接差异

### D01｜限流弹窗资格与 mismatch 证据断裂

**第一归属 ID**：S10、N16、G01、O18、O19、I15。

**现役期望**：Browser 在每次 ChatGPT 逻辑访问的同一 coherent preflight observation 中只依据可见、规范化后的冻结标题/正文与唯一 visible/enabled/actionable“明白了”按钮，产出封闭的 `absent | exact_present | mismatch` typed fact。三态都必须绑定候选数量、冻结文案 hash、authenticated exact-call、Target/Document、observation identity 与 detector 原始时间；不得把 DOM 正文跨边界。`mismatch` 必须零动作、阻止当前 Provider submit，但不得建立 cooldown incident、点击或写 attempt failure。

**当前实现证据**：

- `src/lib/browser/chrome-extension/gpt-rate-limit-dialog.ts:48-70` 的 `DETECTOR` 使用 `dialog.textContent` 和 `buttons[0].textContent`；隐藏/辅助节点文本会参与整块拼接。
- 同文件 `:95-124` 只接受 `absent` 或 `exact_present`；其它状态直接抛 `BROWSER_GPT_DIALOG_UNRECOGNIZED`。
- `KnownGptRateLimitDialogFact` 只有 `state: "exact_present"`，没有 mismatch typed fact；因此 O19 要求的机械负向证据无法 readback。
- `absent` 当前返回 `null`；`readKnownGptRateLimitClearance` 又在 detector 返回之后重新生成时间/hash，不能证明 absence 与 detector 是同一 observation。
- `extension-target-authority.ts:283-290` 在每个普通页面周期调用该 preflight；当前 mismatch 在 extension 内直接 throw，未形成可由 `browser-mutation-receipt.ts` 验证的零动作 reply。
- `browser-special-mutation-receipt.ts` 只校验 `exact_present` blocker；`browser-command-actor.ts:212-227` 也只把 exact blocker 转成带 evidence ref/hash 的 typed failure。故只改 detector 返回名仍不能闭合 O19。
- 普通 `BROWSER_GPT_DIALOG_UNRECOGNIZED` 会穿过 GPT failure 链，最终在 `runtime-claim.ts` 被持久为 attempt failure；这与冻结 N16 的“不写 attempt failure”直接冲突。

**影响**：视觉上正确的限流弹窗可能误判为普通 Browser failure；incident 没被建立，Runtime 不能及时关闭 claim/submit，后续工单仍可能进入 Provider 路径。该错误本身不直接产生 failure 409，但会扩大并发故障窗口。

**精确待修**：沿现有 Browser→GPT→Runtime 消费链原位修复，不新增状态机：

1. 以原子替换方式把现有 v1 exact-only/null 结果改成唯一三态 fact schema；三态共享 `exactCallIdentityHash/targetRefHash/documentRefHash/observationHash/observedAt/dialogHash`，以及 dialog/ack button 各自的 `raw/eligible/actionable` 候选计数和冻结文案 hash，不含 DOM 正文，也不新增自由 actionability/text-match 布尔；v1 decoder、null absence 与 union fallback 同次物理删除；
2. authenticated command permit 已持有 exact-call identity；由现有 extension command path把该 hash绑定进 detector，不接受调用方自报 identity。detector 在一次 `Runtime.callFunctionOn` 中完成可见性、规范化 visible text、按钮资格、三态、时间与 observation hash，禁止跨 observation 拼接；
3. `absent` 必须以 detector 原包 typed fact返回并随同本次 Browser command transcript；clearance 直接消费该 absent fact，不得在 detector 外另造 observedAt/hash。`exact_present` 仍要求恰好一个可见 dialog和一个 exact enabled/actionable button；
4. `exact_present` 返回现役 cooldown blocker receipt；`mismatch` 返回专用零动作 rejection receipt，固定 code `BROWSER_GPT_DIALOG_UNRECOGNIZED`；两者都由 special/mutation/observation decoder严格验证 exact keys、identity、dialog/button各自的raw/eligible/actionable三类计数、冻结hash和物理输入 0，并由计数关系而非新增布尔证明唯一资格。普通 command 的成功 reply也必须绑定同包 absent preflight fact，reply/WAL authority hash覆盖该 fact；
5. Browser actor把 mismatch 转为携带完整三态fact与稳定Browser authority ref/hash的typed blocker。唯一转换点固定在GPT `ProductionGptChildTools.executeOne`覆盖Browser acquisition与atomic phase的结果归一化边界：只对`BROWSER_GPT_DIALOG_UNRECOGNIZED`把typed blocker交给从现有`ability-group.failedExecution`抽取的唯一failure-result factory，生成`proof.browserFact`同源的失败`ProductionGptAtomicCallResult`，再由现役`throwGptChildFailure`抛出stable child failure。该Child proof只在当前执行/错误传播内存中消费；不得进入`persistGptEvidenceArtifacts`，不得新增Forensics writer、failure artifact或per-Child ledger。持久事实只保留Browser WAL authority ref/hash与Runtime现役current reason/runtime log。该code不得调用`closeKnownProviderRateLimit`。Runtime 对该唯一 code走现有 accepted-boundary 分支：只更新本地 task current reason/runtime log，保留 Browser terminal/evidence，不调用 `recordAttemptFailure`、`lease-release ATTEMPT_FAILED`或 Website recovery decision；
6. submit-closed Owner仍是 Browser Authority中央 preflight：当前命令物理输入为0，随后任何逻辑访问必须重新读取同一 current Target/Document；只有 fresh typed `absent` 才允许该访问继续。身份漂移或再次 mismatch继续零输入失败关闭；不新增 cooldown状态、timer、store或后台 watcher；
7. 删除 `unknown_present`、exact-only v1、null absence、detector外 clearance hash以及仍依赖整块 `textContent` 的旧路径。

**删除反事实**：新建第二 detector、持久 mismatch gate、第二 timer/store、per-Child Forensics artifact或保留旧 `textContent` fallback 都无必要消费者；现有中央 preflight、Browser transcript/WAL、内存Child failure与 Runtime accepted-boundary 足以完成记录和阻断，因此禁止新增或保留双路径。

### 已撤销误报｜S18 的 `incident` 与 wire `pending_unknown`

第一轮自审确认：S18 是拓扑语义状态，不是 wire schema。现役 `pending_unknown` 的唯一含义是“同一 incident 已 durable、clearance observation 尚未产生”，它完整投影到 S18 的确定状态 `incident`；它不是审批占位、事实未知或另一条状态机。故 S18 判 `MATCH`，不得为此修改冻结拓扑、重命名跨仓枚举或建立兼容映射层。

### D02｜冻结拓扑的Forensics职责与现役P0边界冲突

**第一归属 ID**：S23、N12、H09、H18、I18。

**已确认冲突**：冻结拓扑v1把`forensics-persistence-capability`定义成每个Child terminal proof/evidence的append/readback/hash Owner；AGENT现役`LAW-FORENSICS-PERSISTENCE-CAPABILITY-001-V6/002-V6/003-V5`明确禁止逐Child evidence、failure record、调用生命周期和恢复分支，只允许持久已完成GPT回答的task-owned raw answer artifact。`evidence-artifacts.ts:127-134`也只为成功的text/image checkpoint生成artifact，failure返回空集。故这五行不是生产漏实现，而是冻结基线与已确认authority/实现相冲突；把mismatch写入Forensics会建立被P0法案禁止的第二证据账本。

**唯一修正方向**：v1字节与hash由Git历史保留；当前唯一拓扑文件原位发布`agent-runtime-topology-form.v2`，不得创建带v2/new后缀的并行同职文件。v2精确supersede五行：

1. S23收窄为“已完成GPT回答raw artifact持久化”，状态仍为`append_pending | persisted | readback_failed`；
2. N12改为只有完成答案checkpoint才把raw answer artifact按exact task/attempt/call identity append、readback、hash；普通Child terminal和failure不得写Forensics；
3. H09改为“成功的GPT答案checkpoint→Forensics raw artifact”；H18改为“Forensics→当前Product调用链返回该raw artifact ref/hash”；
4. I18只约束完成答案raw artifact的唯一Forensics authority；普通Child proof仍是当前执行内存事实，Browser机械终态由Browser WAL持久，Runtime故障报告由现役runtime log/current reason持久，三者不得合并成第二ledger；
5. v2必须重新跑204-ID逐行审计、生成新的规范化hash并由授权人明确冻结；完成主Codex两轮法案/施工图自审且达到98%前，生产代码继续`NO-GO`。不得通过改active law或扩张Forensics来保住v1错误表述。

**删除反事实**：为每个Child新建artifact、failure record、proof table、NDJSON ledger或另一个Forensics writer都没有合法消费者且违反现役P0法案，必须保持物理缺席。

### D03｜Website cooldown grant 代码未对齐现役冻结 authority

**第一归属 ID**：S22、N24、H19、I14。

**冻结拓扑要求**：本地门先于 ack 关闭；Website 只有在最新同 incident clearance 已 durable `confirmed_absent`、server time 已越过 cooldown、cohort 已闭合，并由新的 Website receipt/claim readback 证明无 active cooldown 时，才可重新开放新 claim/submit。`not_cleared` 永不自行开门。

**现役 authority 已对齐**：Website `LAW-AI-ACCEPTANCE-004-V27` 已把 latest durable `confirmed_absent` 、cooldown 到期与 `closure_pending=0` 同时固定为非 pristine device 恢复新 grant 的必要条件；`pending_unknown|not_cleared` 不得自开。Website AI Acceptance Blueprint、SYSTEM Blueprint、AGENT 跨仓 Blueprint、spec、manifest、Exam 声明和生成 registry 已一致引用现役版本。

**authority 完成证据**：Website 以唯一 superseding law record 发布 `LAW-AI-ACCEPTANCE-004-V27`，并因规范性 `dependsOnLawIds` 变化必要升版 `012-V35`、`013-V18` 与 `PUBLIC-KNOWLEDGE-CONTENT-005-V35`；双仓 Blueprint 已同步。两仓原生 registry build/projection check 均返回 current。现役 `ProviderCooldownNoticeV6/ReceiptV6` 已包含 `clearance` 与 `claim_gate_open`，不改 wire 字段、schema version 或数据库结构；不得建立 v7、dual-read 或兼容层。

**当前实现证据**：

- Website `provider-cooldown-claim-policy.ts:32-98` 只读取 device 的 level、until、baseline、stable_since 与 cohort；没有读取最新 cooldown receipt clearance。
- Website `provider-cooldown-repository.ts` 的 receipt `claim_gate_open` 只判断 `cooldown_until <= server_now && closure.pending === 0`，没有要求当前 notice 或最新 durable clearance 为 `confirmed_absent`。
- Website `job-claim-repository.ts:424-450` 以该 policy 的 `active/pending/capacity` 决定 grant；时间到且 cohort 为 0 时可以选择新 job。
- Website `review-query-repository.ts:141-174` 的控制室投影也独立以 time + cohort 计算 `claim_gate_open`；若只修 claim transaction，控制室仍会显示错误的开放状态。
- AGENT `provider-rate-limit-control.ts:32-50` 的 submit gate 倒是要求本地 latest clearance 为 `confirmed_absent`。因此出现跨 Owner 不一致：Website 可签发，AGENT 不可 submit。

**影响**：页面仍 `not_cleared` 时，Website 可能把新工单签给同一设备；工单进入 Runtime 后在 Provider submit 门失败或长期保留 accepted attempt，放大容量占用和后续恢复噪声。这是操作频繁弹窗后的并发故障放大点，但不是弹窗直接 409。

**精确代码待修**：

1. Website 在现有 `provider-cooldown-repository.ts` 提取唯一 verified `readLatestProviderCooldownClearance(client, deviceId)`，只读 `ai_production_cloud_write_receipts` 中该设备最新已持久 `provider_cooldown` receipt；必须重算 receipt hash并严格验证 schema、device、incident/request/payload identity、clearance枚举、server time及持久顺序，不能只读一个枚举。该 reader只供已持久事实消费者使用，不得在当前 notice 尚未 `persistWrite` 时反读上一条 receipt；
2. 开门真值表固定为：从未有 cooldown receipt 且 `level=0` 的 pristine device 开；latest=`confirmed_absent` 时仍须 cooldown 到期且 cohort pending=0才开；latest=`pending_unknown|not_cleared` 一律关；有历史 receipt但 current level已被旧实现清零时仍按 latest clearance裁决；`level>0` 却无合法 receipt或任一 identity/hash/time 异常时失败关闭；
3. 提取唯一纯函数 `decideProviderCooldownGate(effectiveClearance, device, closure, serverNow)`：当前 cooldown transaction 以已鉴权、已绑定本请求的 `notice.clearance` 作为 effective clearance构造当前 response；claim policy、heartbeat、runtime-attestation 与控制室只以 verified latest-receipt reader 的输出作为 effective clearance。两类调用进入同一真值表和同一 verdict，禁止各算近似规则；
4. cooldown 已过、cohort=0但 clearance未确认时，claim返回 `DRAINING`、jobs=0与唯一诊断 `PROVIDER_RATE_LIMIT_CLEARANCE_PENDING`；heartbeat 同样报告该 reason，控制室显示 gate closed；不得谎报为时间仍 active或 cohort仍 pending；
5. AGENT `ProviderRateLimitControl.observeWebsiteAuthority` 必须把 `PROVIDER_RATE_LIMIT_CLEARANCE_PENDING` 与 active cooldown同等用于关闭 submit gate；producer尚未发布时该新 consumer分支无副作用，因此先部署 AGENT consumer，再部署 Website producer/gate；
6. 当前 cooldown transaction 必须先用当前 notice 的裁决生成 receipt，再 `persistWrite`，随后在同一事务内按当前 `request_id + request payload identity` 回读刚写入行、重算并验证 receipt/hash/response 全等后才返回；不得用上一条 latest receipt替代当前 notice。活动 cooldown仍只恢复 frozen cohort的既有 accepted jobs；不得给无关新 job grant。AGENT继续只消费 Website receipt/reason，不复制 Website N/cohort，也不按本地墙钟开门。

**唯一开门真值表**：

| 是否有历史 receipt | device level | latest clearance | time / cohort | Website 新 grant 与 control-room |
|---|---:|---|---|---|
| 否 | 0 | 不适用 | 不适用 | open（pristine） |
| 否 | >0 | 缺失 | 任意 | fail closed：state invalid |
| 是 | 任意 | `pending_unknown` / `not_cleared` | 任意 | `clearance_pending`；新 grant=0 |
| 是 | 任意 | `confirmed_absent` | 未到期或 pending>0 | blocked/draining；新 grant=0 |
| 是 | 任意 | `confirmed_absent` | 已到期且 pending=0 | open；仍受当前 N 与普通 admission 门约束 |
| 是 | 0 | 历史 `not_cleared` | 旧实现已清惩罚 | 仍 closed，禁止把旧错误状态当 pristine |

**唯一进入门**：已通过。冻结 topology hash、现役 law/Blueprint/spec/registry 投影一致，`D03` 不再是 canonical conflict；生产代码必须直接对齐该单一规则。

**删除反事实**：第二 cooldown table、第二 scheduler 或 AGENT 当前 N 副本均无必要消费者；现有 device row + cloud write receipts 已足够，故禁止新增。

### D04｜failure first fact、运输 readback 与同 attempt regrant 断链

**第一归属 ID**：N15、O21、H15、I21。

**现役期望**：同一 `(job_id, attempt_id)` 只允许一份完整 failure fact。Runtime先持久化包含Provider/result身份的本地first fact，再以确定性request/payload identity运输；无论200、回复不明或稳定409，都必须从device-status读取同一`lease_release` receipt或Website原始`attempt_failure + next_action_code`。没有权威readback就保持失败关闭，同attempt regrant不得先清本地fact或重新执行Provider。

**当前实现证据**：

- Website `job-failure-history.ts:48-67` 已实现原fact比较和`AI_PRODUCTION_ATTEMPT_FAILURE_IDEMPOTENCY_CONFLICT` 409；`job-device-status-repository.ts:86-104,120-144` 已投影带`attempt_id/lease_version`的原`attempt_failure`。
- AGENT `cloud-reconciliation-client.ts:46-58,231-263`没有声明/解析`attempt_failure`；`cloud-client.ts:184-220`又只在POST成功后返回确定性requestId，异常路径拿不到同请求身份。
- `runtime-claim.ts:81-117`失败时只写last error，成功时也只消费next action；200、回复不明、409都未核对receipt/original fact。
- `runtime-claim.ts:87-93`在持久化前剥离`provider_effect_identity_hash/settled_result_payload_hash`，所以`attempt_failure_json`不是完整transport first fact。
- `store-task-state.ts:61-69`在同attempt regrant时先清`attempt_failure_json`；`runtime-loops.ts:167-170`没有pending failure-release reconciliation。响应不明后重启/重授可能丢失first fact并重新进入执行。

**影响**：问题不只是409诊断缺口。回复不明或进程重启时，本地缺完整transport fact和恢复入口，同attempt regrant还会删除仅存failure，可能在未证明原release是否提交时重新进入Product/Provider执行。

**精确待修**：

1. `attempt_failure_json`原位升级为唯一 `AttemptFailureFirstFact`：不可变 `failure_core` 保存完整`SerializedTerminalFailure/FailureFactsV6`（含provider effect identity与settled result hash），单一 `release_descriptor` 保存当前已提交运输的 `attempt_id/lease_version/request_id/body_payload_hash/write_request_payload_hash`；同步现有store type、exact-key validator、authority reader、snapshot和acceptance。descriptor只能在已证明旧请求不存在且Website签发同attempt新lease时原子重绑，failure core字节不得改变；仍是一列一份fact，不建第二表/Outbox/ledger；
2. 把现有lease-release构造提取为同文件内唯一builder，并严格区分：`body_payload_hash`=当前 request body 内 `payload_hash`，也是 `request_id`派生输入；`write_request_payload_hash`=完整`LeaseReleaseV6` canonical hash，对应Website device-status write receipt行的`payload_hash`。builder一次产出完整request、两种hash与request_id，发送、同调用期重投和readback共用，禁止混名或第二hash算法；
3. 首次运输的唯一顺序冻结为：完整serialize `failure_core` → 唯一builder产出完整request/双hash/request_id → 对同job/attempt空槽执行CAS，单事务写入完整`failure_core + release_descriptor` → authority reader精确回读并验证与待发request逐字节相同 → 才允许POST。CAS冲突只接受全字节相同first fact，否则失败关闭；禁止网络请求先于durable readback；
4. 在现有device-status parser中机械接收并严格校验`attempt_failure`；按Website detail projection精确验证`FailureFactsV6 + from_status + to_status + attempt_id + lease_version`，再投影为与本地完整first fact比较的单一形状，禁止宽松解析；
5. 首次failure release的200或回复不明都立即读device-status：receipt行必须精确匹配`write_kind=lease_release + request_id + write_request_payload_hash`，其response必须同job/failure且回显`body_payload_hash`；五项身份（两种hash、request_id、response body hash、receipt full-request hash）全部闭合才证明该请求提交。`409 + AI_PRODUCTION_ATTEMPT_FAILURE_IDEMPOTENCY_CONFLICT`不重投，只接受exact job/attempt/lease的Website原fact并记录本地/远端矛盾；
6. 原lease/session在当前调用期仍有效且status没有receipt/original fact时，只允许按既有运输退避重查并重投同descriptor；调用期结束或重启后没有旧fence/session事实，只能用本地完整first fact查询Website并失败关闭，禁止声称可重建旧request或自行重投；
7. 在现有worker iteration增加`reconcilePendingAttemptFailureReleases`，只扫描当前task表中有first fact的任务，GET device-status并收敛已提交receipt/original fact；无receipt、无原fact且无Website新grant时只报告，不产生Cloud/Provider mutation；
8. 为`ACTIVE_ATTEMPT`建立唯一进程内`ProviderEffectReadbackProofV1` carrier，字段封闭为`schema_version/job_id/attempt_id/result_revision/provider_effect_identity_hash/exact_call_identity_hash/browser_authority_ref/browser_authority_hash/readback_provider_input_delta/proof_hash`。生产起点固定在`readPriorAtomicOutcome`的confirmed-provider-effect分支：它引用原始已确认effect的Browser authority ref/hash（原始WAL的`physical_input_count`允许为1），并为本轮只读恢复生成语义独立的`readback_provider_input_delta=0`；不得把原始输入数冒充本轮增量。GPT execution只在同effect confirmed readback成功后生成carrier，`proof_hash=hashCanonical(除proof_hash外全部字段)`；不要求、不持久Child proof ref/hash。carrier由同一`GptProductionExecution`临时保留，Executor在Product完成后原样取出并放入内部`ProductionExecutionResult`，不修改`ProductPluginOutput`，不进入Website wire、Outbox、DB、Forensics或新store；
9. 同attempt regrant进入`acceptTask`前必须先执行failure reconciliation，禁止先清`attempt_failure_json`；`acceptTask`原位保留first fact。若Website已持久原fact，则按其`next_action_code`收敛：`WAIT_NEW_ATTEMPT`按现役释放；`CONSUME_CURRENT_RESULT`只进入现役result Outbox/staging/admission链；`ACTIVE_ATTEMPT`由Product继续按现役早期exact effect查询进入Browser零submit readback，Runtime不得读取Browser私有WAL、不得替Product决定Child/recovery，也不得新增recovery mode/state。Runtime只接受exact-key carrier，重算`proof_hash`，并要求job/attempt/result revision与当前执行相同、provider effect identity与`failure_core`相同、Browser authority ref/hash成对有效且`readback_provider_input_delta=0`；只有全部成立，才在`stageResult`前以同job/attempt/failure identity CAS原子清理first fact并立即stage同次结果。carrier缺失/异effect/非法则first fact不动并失败关闭。若Website未持久原fact而签发同attempt新lease，只可先以新lease原子重绑单一release descriptor并运输字节等价failure core，仍不得先运行Product/Provider；
10. 任一receipt/failure缺字段、request/payload/attempt/lease不等、same-attempt授权与本地fact矛盾或schema非法均fail closed；不得创建replacement job、重跑Provider或把409当5xx。复用现有task authority、device-status、write receipts、claim loop与runtime log；不新增failure ledger、Outbox kind、第二worker或恢复Owner。

**旧shape切换硬门**：新代码不得兼容读取现役11-key或历史8-key failure。施工前先停止新claim，用当前旧版本只读统计本机唯一production task store内所有非空`attempt_failure_json`，分母必须精确为0并保存count/query/store identity证据后，才允许部署删除旧validator、只接受`AttemptFailureFirstFact`的新clean commit；非0时优先由旧版本沿现役Website decision自然收敛/排空，不能转换、重写或由新版本双读。若已持久Browser terminal与现役旧consumer构成可重复证明的不可自然收敛环，且授权人已对该exact job明确授权删除，则只允许执行一次N19精确物理清算：Website写入前必须只读证明该job没有result、staged result、Domain admission、business object、领域子对象或后继引用；在同一serializable transaction内、重验全部门后，只把现役transaction-local `xuanshu.unfinished_purge_work_order=on`用于放行该exact job的append-only私有子行删除，不改持久配置也不赋予其它job资格；仅物理删除exact `ai_production_jobs` 未完成私有子图，共享material blob不动；任一非目标计数漂移整个事务回滚。Website exact absence读回后，AGENT再用现役唯一purge责任依次清除同job的Target/WAL、Forensics、task-owned目录、Outbox/task，并逐项读回缺席。该切换处置不得生成通用删除API、恢复状态、删除台账或替代job。无法自然排空且无法同时满足上述精确删除门，即保持`CONSTRUCTION_NO_GO`。回滚前同样先停新claim，并要求新shape非空数=0；否则不得把旧binary覆盖到含新shape的store。

**删除反事实**：Website已有唯一failure row；AGENT只需把现有`attempt_failure_json`保存完整并让现有worker iteration消费。新增第三本账、第二Outbox或独立recovery worker均不能提供新的必要消费者，必须禁止。

---

## 4. 施工工单与依赖顺序

| 工单 | 类型 | 唯一 Owner | 精确范围 | 前置门 | 完成定义 |
|---|---|---|---|---|---|
| WT-TOPOLOGY-001 | 冻结基线修正 | 授权人 + topology form Owner | 同一唯一文件原位发布v2，只修正S23/N12/H09/H18/I18的Forensics职责；v1由Git历史保存；重跑204-ID审计/规范化hash/冻结 | 已明确授权 | **PASS**；v2唯一锚点；Forensics只含完成答案raw artifact；204/204 定义分母两轮审计通过 |
| WT-AUTH-001 | authority 对齐 | 授权人 + Website active law/Blueprint Owner | supersede `LAW-AI-ACCEPTANCE-004-V26`的新grant门，完成必要依赖升版，同步Website/AGENT Blueprint、spec/manifest/Exam 引用并刷新唯一law registry；wire/DB不动 | WT-TOPOLOGY-001 | **PASS**；active law/Blueprint/registry 对 clearance 单义一致，双仓 projection current，无双规则 |
| WT-AGT-GATE-001 | 先行消费者 | AGENT Runtime provider gate Owner | `provider-rate-limit-control.ts`消费`PROVIDER_RATE_LIMIT_CLEARANCE_PENDING`；直接runtime验收 | WT-AUTH-001 | 新reason出现时submit gate关闭；旧Website尚未生产该reason时行为不变 |
| WT-WEB-001 | 原位修复 | Website ai-acceptance device authority | cooldown repository唯一verified persisted reader + 唯一纯gate decision；当前transaction以notice为effective fact并persist后精确回读；claim policy；receipt；heartbeat；review projection；直接Exam | WT-AGT-GATE-001 | pristine/三态/历史异常真值表唯一；当前receipt不反读上一条；未confirmed absent时新grant=0且receipt/heartbeat/control-room一致 |
| WT-CUTOVER-FAILURE-001 | 切换硬门 | AGENT Runtime store Owner + 授权人/Website DB cutover operator（仅明确授权的存量清算） | 停止新claim；旧版本只读统计并优先收敛非空`attempt_failure_json`；已证明不可自然收敛者须通过零result/admission/business-object/领域引用门，在同一serializable transaction内以现役transaction-local append-only delete gate执行exact Website物理删除，然后执行AGENT现役purge；保存store identity/count/absence证据；禁止shape转换 | WT-WEB-001 | 旧11-key/8-key非空总数=0；每个被删job的Website/Runtime/Browser/Forensics/task-owned对象精确缺席且其它job不变；共享material blob保留；否则保持NO-GO |
| WT-GPT-RBK-001 | 内部proof生产者 | GPT execution Owner | `readPriorAtomicOutcome` confirmed分支以原Browser authority生成`readback_provider_input_delta=0`的唯一`ProviderEffectReadbackProofV1`；由同execution临时保留并供Executor读取；直接GPT验收 | WT-CUTOVER-FAILURE-001；与WT-RUN同一AGENT原子cutover | carrier exact keys/hash成立；原effect input count不被改写；不改ProductPluginOutput/Website wire；无Forensics/store/outbox |
| WT-RUN-001 | 原位修复 | AGENT Runtime failure transport Owner | `terminal-failure/store-foundation/store-task-state/store-authority-validation`完整first fact与CAS；`cloud-client/cloud-reconciliation-client`双hash builder/parser；Executor内部carrier；`runtime-claim/runtime-loops`readback/regrant/结果前原子清理门；直接验收 | WT-GPT-RBK-001；与WT-GPT-RBK同一AGENT原子cutover | durable回读先于POST；200/回复不明/409/重启/同attempt重授均先收敛原fact；Runtime只验carrier并清理；未证明前Provider增量=0 |
| WT-BRW-001 | 原位修复 | Browser Authority | 三态detector；authenticated permit identity；outer reply/transcript；special/observation/mutation decoder；command actor evidence；直接验收 | WT-RUN-001 | absent/exact/mismatch同包typed fact；mismatch物理输入0；旧v1/null/textContent路径零残留 |
| WT-GPT-001 | 原位修复 | GPT capability Owner | mismatch typed blocker在`executeOne`唯一归一化点转为内存failure result，不写Forensics，且不调用cooldown closure；直接验收 | WT-BRW-001；与WT-BRW/WT-RTB同一AGENT原子cutover | Browser authority fact/hash进入Child failure与Runtime current error；Forensics增量0；exact仍走closure |
| WT-RTB-001 | 原位修复 | AGENT Runtime boundary Owner | `runtime-claim.ts`精确消费mismatch code，只写current reason/runtime log，不写attempt failure；直接验收 | WT-GPT-001；与WT-BRW/WT-GPT同一AGENT原子cutover | mismatch attempt_failure/lease-release增量0；fresh same-Document absent后才允许下一访问 |
| WT-E2E-001 | 双仓验收 | 各Owner + 唯一quality verdict | 七个代码工单合并后的原生CHANGE/READY；RELEASE仍需另行授权 | 七个代码工单与切换硬门各自通过 | 204-ID归零；路由40/40、14 Child、Outbox/DB表数不增；业务完成仍以Website domain readback为准 |

工单不得并行修改同一authority边界。部署/cutover固定为：拓扑v2先独立授权、审计、冻结 → Website authority对齐 → AGENT先认识clearance-pending reason → Website再收紧grant/heartbeat/control-room → 停新claim并用旧版本优先把旧failure shape排空，已证明不可自然收敛且通过精确删除门的存量job则执行Website物理删除→Website absence readback→AGENT现役exact purge，直至旧shape=0 → GPT exact-effect readback carrier生产者与Runtime D04 consumer同一AGENT clean commit原子cutover → Browser三态、GPT内存mismatch proof与Runtime mismatch非attempt-failure consumer同一AGENT原子cutover。禁止发布半个内部carrier，也禁止先发布Browser三态而保留旧GPT/Runtime consumer。合并验收覆盖：Browser exact fact→Runtime durable incident→ack/clearance→Website gate/heartbeat/claim readback；mismatch→零输入Browser authority fact→内存Child failure→Runtime current reason→Forensics/attempt failure增量0→fresh absent；以及failure durable first fact→200/unknown/409→receipt/original fact→Website next action→same-effect零submit carrier→结果前CAS清理。

跨仓失败停止：任一阶段未通过自己的原生质量入口，不部署下一阶段。cutover后若Browser/GPT原子提交回归，先停止worker新claim，再整体回退该clean commit，禁止只回退一半schema/consumer；Runtime readback与Website更严格的gate可保留。若必须回退Runtime或Website，必须先停止worker并证明无活动cooldown incident、无accepted attempt、旧/新shape pending failure均为0且无未交付Outbox，再按Runtime后、Website最后的逆序回退；不设feature flag、dual-read/write或兼容桥。

---

## 5. 验收分母与停止线

### 5.1 静态/合同验收

1. 204 个 ID 重新对照，MISMATCH=0、NO_EVIDENCE=0；S18 仍以拓扑语义 `incident` 唯一投影 wire `pending_unknown`，不得新增状态或兼容层；
2. 双仓 route policy 仍为 40/40、字节一致、route hash 一致；
3. GPT Child 仍为 14 个，G01 仍是 Product 不可见内部 Child；
4. 没有新增 DB table、queue、worker、scheduler、failure ledger、cooldown store、attempt state 或恢复 Owner；
5. `textContent`限流exact判断、`unknown_present`、exact-only v1/null absence、detector外clearance hash、旧11-key/8-key failure validator与不完整`attempt_failure`、same-attempt先清failure、clearance-free claim open七类旧结构零残留；
6. v1字节/hash必须可由Git历史追溯，当前唯一文件只保留已冻结v2；不得建立并行v2/new拓扑。Website active law、Blueprint、现役双仓合同与v2一致后，才允许生产CHANGE/READY裁决；wire schema仍不需要新版本。

### 5.2 必须新增/收紧的直接验收场景

- absent/exact/mismatch三态都在同一detector包携authenticated exact-call、Target/Document、raw/eligible/actionable候选计数、冻结hash和detector原时间；不含自由actionability布尔；visible text精确、隐藏文本污染、重复dialog、重复/disabled/aria-disabled按钮、正文mismatch均有负向样例；
- absent普通访问继续且同包fact进入transcript hash；只有exact单例建立incident并允许一次ack；mismatch零输入、无ack、无cooldown incident，Browser WAL authority hash与内存Child failure同源，Forensics artifact增量0；Runtime attempt failure写入增量0，fresh同Document absent后才允许下一访问；
- incident 在 ack 前 durable；崩溃恢复沿同 incident/WAL；`not_cleared` 后新 grant=0；
- cooldown current notice在receipt构造时直接使用本次已鉴权clearance，persist后按本次request identity回读；新incident不得误读上一条`confirmed_absent`，新clearance不得误读上一条`pending_unknown`；
- cooldown 时间已过且 cohort=0，但 clearance 为 `pending_unknown` 或 `not_cleared` 时 `claim_gate_open=false`；
- 同场景 claim 必须 `DRAINING + jobs=0 + PROVIDER_RATE_LIMIT_CLEARANCE_PENDING`，控制室也必须显示 gate closed；不得误报 cooldown active 或 cohort drain；
- `confirmed_absent` 但 Website server-time 仍在 cooldown 内时仍关闭；全部门闭合后才开；
- failure release 200 后按同 `request_id + write_request_payload_hash` 读到唯一 `lease_release` receipt，response同时回显`body_payload_hash`；响应丢失但 Website 已提交时以五项身份闭合的同 receipt 收敛；未提交时 receipt/failure 均缺失并保持本地 first fact；
- first fact三处kill-point必须分别证明：CAS持久前崩溃时POST=0；CAS后/POST前崩溃时完整fact已精确回读且POST=0，重启仅GET；POST后/response前崩溃时可用已持久descriptor精确读回receipt/original fact；
- 同 attempt 同 failure 重放幂等；不同 failure 稳定 409；AGENT 随后读回 exact attempt/lease 原 fact，failure 写入增量=0、Provider submit 增量=0；
- 完整first fact跨进程保留`body_payload_hash`与`write_request_payload_hash`并禁止混用；旧lease调用期内只重投同descriptor，重启后无旧fence只查询；同attempt新lease先readback，远端无fact才原子重绑descriptor并运输同failure core；ACTIVE_ATTEMPT保留first fact执行Product早期exact-effect零submit readback；原effect的Browser WAL input count允许为1，本轮carrier必须是`readback_provider_input_delta=0`；同effect时结果前CAS清理成功，异effect/缺失/非法时first fact不变且stage增量0；carrier不得出现在Product output、Website wire、Forensics、Outbox或持久store；
- cutover前旧11-key与8-key非空failure总数必须为0；若经授权物理删除排空，还必须证明删除前result/admission/business-object/领域引用全为0、删除后Website与AGENT各层exact absence、其它job计数不变；新代码旧shape接受数=0、旧validator零残留；回滚前新shape非空数也必须为0；
- device-status 原 failure 的 attempt/lease/evidence 任一不等时 fail closed；
- staged result、admission receipt 与 domain-object readback 仍是业务完成唯一链，任何 Browser/Outbox/HTTP 成功不得冒充完成。

### 5.3 唯一质量入口与直接验收

- AGENT 完整质量入口仅为 `npm run quality:check`；与本方案直接相关的聚焦验收为 `npm run acceptance:agent-production-runtime`、`npm run acceptance:local-browser-terminal`、`npm run acceptance:gpt`。聚焦验收不能替代完整质量结论。
- Website 完整质量入口仅为 `pnpm quality:check`；直接聚焦验收为 `pnpm ai:production:v6:exam`。聚焦 Exam 不能替代完整质量结论。
- CHANGE 阶段先运行受影响的直接验收，再运行各仓唯一完整质量入口；READY 必须绑定各仓 clean commit。RELEASE 仍须另行授权并执行现役 Dynamic Proof。

### 5.4 动态证明边界

本轮已执行且只执行`WT-CUTOVER-FAILURE-001`所需的exact Website数据库物理清算与AGENT本地缺席读回，该证据只放行旧failure shape切换硬门，不是Browser弹窗、Provider效果、领域完成或RELEASE证明。真实 Browser DOM、Provider 弹窗与业务领域 readback 仍未在本轮执行。未来即使静态测试通过，也只能到 READY 候选；RELEASE 必须按现役 active law 另行取得真实 Dynamic Proof。任何真实弹窗文案/结构已漂移，必须先形成新的拓扑变更提案，禁止在 detector 中加入猜测 fallback。

**WT-CUTOVER-FAILURE-001 现场证据（2026-09-21）**：

- 精确 job：`aiprod_ae196681-7b37-480f-b545-a1ff38131fb6`；删除前 Website `result/staged_result/completed/admission/business_object` 全空，`localization_jobs/artifacts/production_attempts`、后继 job、review、quality与 public-knowledge receipt 引用均为 0；
- Browser WAL 删除前有 9 行且 unresolved `DISPATCHED=0`；其中 submit terminal 为`REJECTED + confirmed + physical_input_count=1`，现役旧consumer与Website `ACTIVE_ATTEMPT`可重复构成无法自然排空环；
- 首次物理删除因`AI_PRODUCTION_EVENTS_ARE_APPEND_ONLY`全事务回滚，数据增量为 0；复核现役 migration 后，正式事务仅在事务内设置`xuanshu.unfinished_purge_work_order=on`，重验全部门后精确删除 1 job、1 runtime、2 failures、86 events、6 write receipts、1 material binding；其它行计数无漂移，shared static material blob保留，新会话读回transaction-local gate已关闭；
- Website 同 job 的 job/runtime/failure/event/receipt/material 读回均为 0；AGENT Browser authority/Target 读回均为 absent，Browser WAL、Forensics mission、task-owned 目录、Outbox、Runtime task 读回均为 0/缺席；两个 SQLite `quick_check=ok`、`foreign_key_check=[]`；
- 本机唯一production task store余 442 tasks，非空`attempt_failure_json=0`。因此旧11-key/8-key切换硬门从`NO-GO`转为`PASS`，不代表后续代码工单、READY或RELEASE已通过。

### 5.5 施工停止线

出现以下任一项立即停止：

- 冻结 topology hash 或双仓 HEAD/tracking/dirty set 出现未解释漂移；已登记且与本方案authority/生产路径无交集的并行文档不冒充clean，也不自动阻断；
- v2未在唯一拓扑文件内完成204-ID主Codex双轮审计，或出现并行v2/new同职文件；
- active law、Blueprint、Manifest/registry 又出现投影漂移却继续修改 D03 生产代码；
- 停新claim后旧11-key/8-key非空`attempt_failure_json`统计不为0，且既无法由旧版本排空，又未获exact job删除授权或未通过零result/admission/business-object/领域引用门；
- 完整first fact尚未CAS持久并精确回读就尝试POST，或GPT proof producer与Runtime carrier consumer不在同一clean commit；
- Browser三态producer与GPT/Runtime mismatch consumer未处于同一clean commit；
- 需要新增表/队列/worker/第二恢复路径才能让方案成立；
- 修复把 Product Flow、恢复决策或当前 N/cohort 移到错误 Owner；
- 409 后无法读回精确原 fact；
- failure release 200/回复不明后无法按同 `request_id + write_request_payload_hash` 读回唯一 receipt，或response未回显同`body_payload_hash`；
- ACTIVE_ATTEMPT同effect carrier缺失/不等却清除first fact或进入stageResult；
- 把原effect的`physical_input_count`当成本轮readback增量，或把Child failure/proof写入Forensics；
- 测试只能证明 HTTP/Provider/Outbox 成功，不能证明 Website domain-object readback。

---

## 6. 自审闭环记录

本节只记录本文件自身的三轮前置审计，不建立第二审计台账：

| 轮次 | 攻击面 | 发现与本轮迭代结果 | 结论 |
|---|---|---|---|
| 自审 R1 | authority / candidate / semantic mapping | 撤销 S18 误报：拓扑 `incident` 唯一投影 wire `pending_unknown`；把 D03 从普通代码漏改升级为冻结拓扑与 Website active law/Blueprint 的 canonical conflict | 已迭代，同文件复核通过 |
| 自审 R2 | producer→transport→consumer→readback | D01 扩展为 detector→typed rejection receipt→decoder/WAL hash→evidence；D04 从“只处理 409”扩展为 200/回复不明/409 的统一 request/failure readback | 已迭代，同文件复核通过 |
| 自审 R3 | 工单可施工性 / 控制室一致性 / 质量入口 / candidate drift | 补入控制室`claim_gate_open`、精确clearance-pending诊断、唯一质量命令；该轮曾暂判无需topology新版本，后由独立R4以P0法案/实现反证撤销；该轮时点双仓HEAD与冻结hash未漂移，随后R1捕获新的docs-only HEAD | 历史结论已由R4纠正；不代表允许生产施工 |
| 独立审计 R1 | 全链对抗审计 | `PLAN_AUDIT_FAIL`：发现candidate漂移、D04 first fact/regrant/restart缺口、D01 mismatch误写attempt failure与三态fact不完整、D03 pristine/历史异常真值表和reason consumer漏面；本轮已全部原位迭代 | 待全新独立审计复核 |
| 独立审计 R2 | 冻结拓扑/生产实践/可施工性复审 | `PLAN_AUDIT_FAIL`：发现Website并行文档dirty漂移、D03 receipt落库前latest-reader时序悖论、D04双hash混名与ACTIVE_ATTEMPT清理Owner断点、D01自由布尔越过封闭wire；已逐项复核生产证据并在同文件原位迭代 | 待全新独立审计复核 |
| 独立审计 R3 | 崩溃点/内部proof/cutover/evidence可达性复审 | `PLAN_AUDIT_FAIL`：发现first fact未冻结durable-before-POST、ACTIVE_ATTEMPT缺单一proof carrier、旧failure shape无排空门、mismatch异常可能绕过Forensics；已核验并补齐CAS时序、内存carrier、零存量硬门与唯一failure-result归一化点 | 待全新独立审计复核 |
| 独立审计 R4 | Forensics authority / readback delta复审 | `PLAN_AUDIT_FAIL`：发现冻结v1五行错误要求per-Child Forensics ledger，及carrier混淆原effect输入数与本轮readback增量；已把五行改判MISMATCH并新增受控v2门，D01恢复法案边界，carrier改为`readback_provider_input_delta=0`且删除持久Child proof依赖 | 待全新独立审计复核 |
| 主 Codex 切换自审 R1 | 存量failure的自然收敛可达性 | Browser WAL证明exact job已是`provider_effect + REJECTED + confirmed + physical_input_count=1`，旧consumer稳定产生`GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH`，Website保持`ACTIVE_ATTEMPT`；已证明旧版本无法自然排空，且禁止把REJECTED改写为CONFIRMED | PASS；命中N19精确删除门，不得新建恢复链 |
| 主 Codex 切换自审 R2 | 删除资格 / 冻结拓扑 / 防膨胀 | exact job的result、staged result、completed/admission/business object、localization领域子对象、后继job、review/quality/public-knowledge引用均为0；共享material blob明确排除。冻结拓扑hash仍为`74d8b9d3ef88f7290bb7309447064f9da1568b3e9f5dba4bff64d46b23ff6283`，仅对照施工图增补一次存量清算，未增API/表/队列/worker/台账/替代job | PASS；允许执行exact Website物理删除与现役AGENT purge |
| 主 Codex 实现自审 R1 | 冻结锚点 / 204定义 / 双仓authority / 结构分母 / producer→consumer | 按锚定行删除规则重算规范化hash=`74d8b9d3...`；S/N/R/G/T/H/O/I精确计数为23/28/40/14/18/24/21/36，总计204；双仓route均40且字节hash=`a27b261d...`，GPT Child=14；逐链复核D03 verified latest receipt纯gate及claim/heartbeat/control-room消费者、D04 durable-first fact/readback/carrier、D01三态fact/GPT/Runtime零副作用；无新增DB表、queue、worker、scheduler、ledger或第二Owner；Website Exam 40 pass/0 fail/1既有PostgreSQL skip，production typecheck与AGENT全套聚焦验收通过 | PASS；10/10施工工单静态与聚焦动态分母闭合，CI-FULL仍未执行 |
| 主 Codex 实现自审 R2 | 200/回复不明/409/重启 / tamper / 零重放 / 原子清理 | 对抗审计发现现有质检未动态覆盖failure release四分支，补入现有Runtime acceptance；新用例进一步发现`releaseError + readbackError`经`AggregateError`丢失原始authority mismatch码，已原位改为保留`PRODUCTION_ATTEMPT_FAILURE_READBACK_MISMATCH`并以AggregateError作cause。复跑证明first fact在POST前已可读；200与回复不明按同request/双hash receipt闭合；不同原fact的409记录精确矛盾；重启 reconciliation仅GET且POST总数不增；Browser篡改hash拒绝、mismatch无Forensics/cooldown/attempt-failure、exact仍走cooldown、provider readback delta=0、result前CAS清理均通过 | PASS；finding已修复并回归，204/204与冻结hash再次一致 |
| 独立实现审计 R1 | D03/D04/D01 对照冻结拓扑、生产实现与直接验收 | 三名只读审计者分别发现：cooldown clearance仍有第二raw receipt读取且non-pristine device未与latest receipt逐字段绑定；failure transport在200/unknown缺精确receipt时可误收敛、CONSUME_CURRENT_RESULT未原子清first fact、409矛盾证据不耐久；ack/clearance mismatch未统一返回typed receipt、机械fact在GPT链被压扁、confirmed-readback acquisition mismatch绕过归一化、Runtime terminal未绑定Browser authority。主Codex拒绝了与冻结拓扑冲突的“改写active/drain/clearance优先级”建议，其余finding已逐项原位修复并补动态验收 | `AUDIT_FAIL`已完成迭代；不得以本轮替代全新复审 |
| 主 Codex 实现自审 R3 | 独立finding逐项回读 / 唯一Owner / 证据耐久性 | 删除cooldown第二raw reader并统一到verified persisted receipt；non-pristine device的level/current N/baseline/cooldown逐项绑定latest receipt。failure 200/unknown仅认同请求receipt，409保存local/remote hash矛盾证据，聚合错误继承原authority metadata；CONSUME_CURRENT_RESULT以同first fact CAS清理且completed禁止残留failure。Browser控制意图mismatch统一typed零输入receipt，完整17字段fact贯穿acquisition/atomic/confirmed-readback，Runtime terminal绑定Browser authority ref/hash | PASS；全部已知可采纳finding有生产实现与动态断言 |
| 主 Codex 实现自审 R4 | 防膨胀 / 旧路径物理缺席 / frozen denominator / 回归 | 规范化hash=`74d8b9d3...`，S/N/R/G/T/H/O/I=`23/28/40/14/18/24/21/36`；双仓route=40且hash=`a27b261d...`，GPT Child=14。搜索确认无新增table/queue/worker/scheduler/failure ledger/second Outbox/dual-read/shadow；旧failure shape仍只作为拒绝用例，不存在生产兼容入口。AGENT typecheck、Runtime、Browser terminal、GPT、extension build/verify与Website Exam 41 pass/0 fail/1既有DB skip、production typecheck、双仓diff-check均通过 | PASS；实现完成度与准确度自评100%，允许启动全新只读独立复审 |
| 独立实现复审 R2 | D03/D04/D01 对照冻结拓扑、现役实现与动态证据 | 三名全新只读审计者分别以18/18、16/16、27/27分母完成复核并给出`AUDIT_FAIL`：D03发现clearance-pending仍可先过selector及latest receipt可被伪device JSON绕过；D04发现claim时同attempt/lease异fact可重绑覆盖、重复receipt可被`some()`掩盖及新lease/carrier动态分支不足；D01发现扁平文本可误判exact、WAL与机械fact合并不足、仅错误码可进入非attempt-failure分支及缺少真实Browser→GPT→Runtime→fresh absent整链。全部finding均由主Codex原位修复并补动态验收，本轮不得作为放行 | `AUDIT_FAIL`已完成迭代；必须再做两轮主审和全新独立复审 |
| 主 Codex 实现自审 R5 | 冻结锚点 / 唯一Owner / 防膨胀 / 双仓投影 | 重新按唯一规则计算拓扑规范化hash=`74d8b9d3ef88f7290bb7309447064f9da1568b3e9f5dba4bff64d46b23ff6283`；唯一ID分母S/N/R/G/T/H/O/I=`23/28/40/14/18/24/21/36`、总计204；双仓route projection均为40/46/33且字节hash=`a27b261d...`，GPT Child=14。D03只保留worker-session绑定的verified latest receipt reader且clearance在expired-attempt/selector前返回空jobs；D04只保留单一task first fact、单一Website receipt/failure readback与单一进程内carrier；D01只保留Browser三态机械fact→GPT封闭proof→Runtime消费链。目标diff未新增table、queue、worker、scheduler、ledger、兼容桥、dual-read/write、shadow或第二Owner | PASS；结构分母、authority与防膨胀均为100% |
| 主 Codex 实现自审 R6 | 事件全矩阵 / 真实跨层证据 / 失败关闭 | D04动态覆盖durable-before-POST、200、响应不明未提交/已提交、稳定409、重复receipt、重启仅GET、同attempt新lease只重绑descriptor、CONSUME_CURRENT_RESULT清fact、ACTIVE carrier缺失/篡改保持first fact及exact carrier原子清理。D01 detector要求title/双段body/ack逐行同序，扁平/缺段/换序/title spoof均为mismatch；真实detector fact经GPT真实WAL归一化进入Runtime并证明release=0、Outbox=0、attempt_failure=null，再以新观测得到absent。该整链首次发现Runtime只认canonical DOM authority、误拒真实WAL authority的根因；已收紧为必须同时是`GptExecutionFailure`封闭proof、proof内完整fact与metadata fact全字节相同，并只接受canonical DOM authority或该proof绑定的WAL authority。AGENT typecheck、GPT、Runtime、Browser聚焦验收和extension build/verify通过；Website AI v6 Exam为41 pass/0 fail/1 PostgreSQL skip，production typecheck通过 | PASS；已知事件分支、真实authority与负向突变均闭合100% |
| 独立实现复审 R3 | D03/D04/D01 最新实现、动态证据真实性与旧事实对抗 | 三名全新只读审计者分别以18/18、16/16、27/27分母复核并给出`AUDIT_FAIL`：D03发现clearance按notice request读取历史receipt，可能让旧clearance覆盖设备更新的pending incident；D04发现同attempt/lease矛盾remote failure可被同response内matching receipt掩盖；D01发现所谓整链仍模拟`readAtomicStepOutcome`与GPT错误，未证明真实Actor/WAL→GPT→Runtime→同权威fresh absent。三个finding均由主Codex按原Owner原位修复并补入现有验收，本轮不得作为放行 | `AUDIT_FAIL`已完成迭代；必须再做两轮主审和全新独立复审 |
| 主 Codex 实现自审 R7 | 冻结锚点 / 最新incident / 矛盾事实优先级 / 真实authority链 | 重新按锚定删除规则得到拓扑hash=`74d8b9d3ef88f7290bb7309447064f9da1568b3e9f5dba4bff64d46b23ff6283`，S/N/R/G/T/H/O/I=`23/28/40/14/18/24/21/36`、总计204；双仓route字节hash均为`a27b261d...`。D03 clearance只读设备最新receipt，并要求`request_id`与`incident_request_id`都等于notice incident且clearance仍为`pending_unknown`；D04在200、响应不明、409、重启reconciliation与claim重绑入口均先检查同attempt/lease异core冲突，冲突不得被receipt掩盖；D01现有验收实例化真实`BrowserCommandActor`和`BrowserMutationStore`，由真实cooldown reconciliation触发GPT acknowledgement、写REJECTED WAL、生成真实`GptExecutionFailure`并交Runtime，随后同Actor/Target/Document执行fresh absent且旧WAL hash不变 | PASS；三个R3 finding均有生产顺序和直接动态断言 |
| 主 Codex 实现自审 R8 | 负向矩阵 / 零副作用 / 防膨胀 / 聚焦回归 | 对抗复核旧incident、request漂移、incident漂移、已clearance receipt均失败关闭；matching receipt与同attempt/lease异core并存仍报authority conflict；真实mismatch链断言Browser WAL=`REJECTED`、完整机械fact与WAL authority进入GPT proof，Runtime release=0、Outbox=0、attempt_failure=null，fresh absent不新增mutation row。目标diff未新增table、queue、worker、scheduler、ledger、兼容桥、dual-read/write、shadow或第二Owner；双仓`git diff --check`通过。AGENT typecheck、GPT、Runtime、Browser terminal、extension build/verify通过；Website production typecheck通过，AI v6 Exam为41 pass/0 fail/1既有PostgreSQL skip | PASS；完成度与准确度按10/10工单、204/204定义及列明动态分支均为100% |
| 独立实现复审 R4 | D03/D04/D01 最新持久顺序、claim冲突与回归分母 | 三名全新只读审计者分别以27/27、17/18、15/16分母复核：D01 `PASS`；D03发现latest receipt仍以事务开始`created_at + random receipt_id`排序，无法证明exact device锁后持久单调；D04发现本地旧lease first fact与当前grant新lease之间的远端异core failure可绕过receipt/rebind/POST前冲突门。D03已在原receipt表上以migration 0143新增设备锁后分配的唯一`write_order`，reader只取同device最大序；D04已把当前grant精确身份的远端异core事实置于receipt、rebind与POST前失败关闭 | `AUDIT_FAIL`已完成定点迭代；不得以本轮代替全新复审 |
| 主 Codex 实现自审 R9 | 冻结锚点 / receipt单调性 / 远端failure允许集 / 防膨胀 | 拓扑规范化hash重算仍为`74d8b9d3ef88f7290bb7309447064f9da1568b3e9f5dba4bff64d46b23ff6283`，S/N/R/G/T/H/O/I=`23/28/40/14/18/24/21/36`、总计204；双仓route均为40且字节hash=`a27b261d000dd5b5983d1d78eb69f26e34be81f17544fcecd022626ecf1ec469`，Website registry projection为当前态。对抗审计进一步发现远端failure处于旧descriptor与当前grant之间的第三lease时可被忽略；已收紧为任何非精确匹配“旧first fact或当前grant”的非空远端failure均在receipt/rebind/POST/Product前冲突失败关闭，冲突证据同时携带本地/远端attempt+lease。未新增表、Owner、reader、queue、worker、scheduler、ledger、兼容桥或第二链路 | PASS；本轮finding已原位修复并纳入现役Runtime acceptance |
| 主 Codex 实现自审 R10 | 全链回归 / 负向分支 / 投影与候选稳定性 | D03验收直接断言exact device row `FOR UPDATE`早于receipt insert，latest query只以`write_order DESC`取同device一行，禁止`created_at/receipt_id`；0143在无provider_cooldown存量硬门后仅增identity列与唯一索引，不改wire/hash/幂等身份。D04动态覆盖有/无旧receipt下的当前lease异core与中间lease同core冲突，均证明Product=0、release POST=0、first fact/descriptor不变、current_reason耐久记录。AGENT typecheck、GPT、Browser terminal/属性/突变/authority/auto-pairing/recovery/FIFO、Runtime、extension build/verify全通过；Website production typecheck、AI v6 Exam 41 pass/0 fail/1既有DB skip、registry projection与双仓diff-check通过；防膨胀检查无新建表/队列/worker/scheduler/ledger/兼容桥/第二链 | PASS；10/10工单、204/204定义及列明动态分支均100%，超过98%主审门 |
| 独立实现复审 R5 | D01/D03/D04 最新单调状态、证据链与失败关闭 | D04以16/16、100%分母`PASS`，未发现finding。D03以18/18分母覆盖、17/18通过、94.4%完成度、98%准确度给出`FAIL`：`not_cleared`后同incident的`confirmed_absent`被稳定409拒绝，形成永久cooldown死锁；已对齐Blueprint为唯一单调转移`pending_unknown→not_cleared|confirmed_absent`、`not_cleared→confirmed_absent`，并在原校验函数绑定同incident全部identity，禁止回退/跨incident/重写；全顺序验收证明N、level、cooldown、cohort不二次修改。D01以27/27分母覆盖、26/27通过、96.3%完成度、98%准确度给出`FAIL`：原子阶段已确认provider effect后，`selectExactGptConversation`发现exact限流窗会绕过`closeKnownProviderRateLimit`，被Runtime降级为普通attempt failure。已把acquisition、atomic result、confirmed-effect记录与selection的exact blocker统一到同一内存proof与现役incident/ack/cooldown关闭链；仅在完整Browser authority且本地cooldown gate已关时，Runtime保留confirmed effect并禁止`attempt_failure/lease-release/409`链；普通exact result与确认effect后selection两条动态验收均证明单incident、单Browser lease、Forensics增量0及provider input不重放 | `AUDIT_FAIL`已完成两个finding的定点迭代；不得以本轮代替全新复审 |
| 主 Codex 实现自审 R11 | 冻结锚点 / 唯一关闭Owner / 防膨胀 / 负向authority | 重算拓扑规范化hash=`74d8b9d3ef88f7290bb7309447064f9da1568b3e9f5dba4bff64d46b23ff6283`，S/N/R/G/T/H/O/I=`23/28/40/14/18/24/21/36`、总计204，双仓route hash同为`a27b261d...`。对抗回读发现exact的普通result、acquisition异常与confirmed-effect selection异常虽已均可关闭，但曾复制三份closure/gate逻辑；已收敛为原`ProductionGptChildTools`内唯一`closeKnownRateLimitAndReadGate`方法，三个入口只调用该Owner。补入code-only exact负向用例，证明无完整Browser/GPT proof时即使错误码相同也必须走普通durable attempt-failure readback，不得借冷却例外逃逸。未新增表、queue、worker、scheduler、ledger、兼容桥、dual-read/write、shadow或第二Owner | PASS；10/10工单、204/204定义、authority与防膨胀分母均为100% |
| 主 Codex 实现自审 R12 | D01/D03/D04全矩阵 / 真实时序 / 双仓投影 / 失败关闭 | D01动态验收覆盖普通exact result、confirmed-effect后selection exact、ack失败、完整fact与effect保留、单incident/单Browser lease、Forensics=0、Runtime release=0/Outbox=0/attempt_failure=null及code-only exact不得逃逸。D03覆盖`pending_unknown→not_cleared→confirmed_absent`同incident顺序、全identity绑定、`write_order`持久单调与N/cooldown/cohort不二次更新。D04原16/16结论与所有200/回复不明/409/重启/第三lease冲突分支继续通过。AGENT typecheck、GPT、Runtime、Browser terminal/property/mutant/authority/auto-pairing/recovery/FIFO、extension build/verify、projection全通过；Website production typecheck、AI v6 Exam=`41 pass/0 fail/1 PostgreSQL skip`、projection current通过；双仓`diff --check`通过 | PASS；10/10工单、204/204冻结定义与列明动态分支完成度/准确度均自评100%，超过98%门 |
| 独立实现复审 R6 | D01/D03/D04 关闭耐久性、并发incident与failure readback | D04以16/16分母、100%完成度、98%准确度`PASS`，finding=0。D01以27项分母通过26项、96.3%完成度、98%准确度`FAIL`：confirmed effect已记录后，首个incident的Outbox enqueue若在gate关闭前失败，裸closure error丢失provider effect identity，可让Website当作未发送failure。D03以18项分母通过17项、94.4%完成度、98%准确度`FAIL`：活动cooldown中第二个不同incident会写入更大`write_order`抢占latest，使原incident的合法clearance被稳定409拒绝。已在唯一Blueprint冻结两道同根门：AGENT关闭Owner先读submit gate，门已关时并发exact不新建incident/ack/Website write；Website在device锁后、receipt insert前防御性拒绝活动窗口新incident，不分配`write_order`。closure持久失败现以typed failure保留confirmed effect与Browser authority，后续只能同attempt零submit恢复 | `AUDIT_FAIL`已完成定点迭代；不得以本轮代替全新复审 |
| 主 Codex 实现自审 R13 | 冻结锚点 / 单closure Owner / 并发顺序 / 防膨胀 | 拓扑规范化hash仍为`74d8b9d3ef88f7290bb7309447064f9da1568b3e9f5dba4bff64d46b23ff6283`，S/N/R/G/T/H/O/I=`23/28/40/14/18/24/21/36`、总计204，双仓route hash同为`a27b261d...`。生产代码仅一处`closeKnownProviderRateLimit`调用；该Owner在`beginIncident`前先读submit gate，已关则本地吸收并发exact。Website活动窗口冲突门位于device `FOR UPDATE`后、`persistWrite`前，负向验收直接证明第二incident的write_order、N、cooldown、latest增量均为0。未新增表、queue、worker、scheduler、ledger、兼容桥、dual-read/write、shadow或第二Owner；双仓`diff --check`通过 | PASS；10/10工单、204/204定义、authority与防膨胀分母均为100% |
| 主 Codex 实现自审 R14 | closure失败 / 并发exact / Website latest / 全链回归 | 新动态用例证明：门已关时第二exact不触发`beginIncident`、ack或Website write；confirmed-effect selection后Outbox持久失败时gate如实保持open，但typed failure仍为`mutationOutcome=confirmed`且保留原provider effect identity；Website第二incident在insert前返回专用冲突码，首个receipt仍是latest且writeOrder=1，后续`not_cleared→confirmed_absent`仍合法闭合。AGENT typecheck/GPT/Runtime、Browser terminal/property/mutant/authority/auto-pairing/recovery/FIFO、extension build/verify、projection全通过；Website production typecheck、AI v6 Exam=`41 pass/0 fail/1 PostgreSQL skip`、projection current通过 | PASS；10/10工单、204/204冻结定义与列明动态分支完成度/准确度均自评100%，超过98%门 |
| 独立实现复审 R7 | D01/D03/D04 最新关闭Owner、receipt单调性与新attempt接回 | D01以27/27、D03以18/18分母均`PASS`；D04覆盖16/16但通过15/16、93.75%，发现Website已持久裁决`WAIT_NEW_ATTEMPT`后，本地仍保留旧attempt/first fact，而claim reconciliation在调用既有跨attempt CAS接收器前即以attempt不等失败，令合法新attempt永久不可达。已先把唯一合法迁移冻结到双仓施工图：远端旧failure为空、`ACTIVE_ATTEMPT`、本地`WAIT_NEW_ATTEMPT`、旧first fact允许新attempt且accepted count精确时，才把旧fact交给现役`acceptTaskAfterFailureReconciled`原子切换；旧failure禁止重绑或POST到新attempt | `AUDIT_FAIL`；先完成定点代码与整链验收，再做两轮主审和全新独立复审 |
| 主 Codex 实现自审 R15 | 新attempt迁移 / 失败关闭 / 冻结锚点 / 防膨胀 | 现役`reconcileClaimAttemptFailure`只在本地reason=`WAIT_NEW_ATTEMPT`、旧first fact允许新attempt、远端failure为空、远端action=`ACTIVE_ATTEMPT`且新grant attempt不同时，才把原fact交给既有`acceptTaskAfterFailureReconciled`；该CAS原子核对task/fact、切换attempt、清fact并废止旧attempt未发送写。同attempt、残留remote failure、非法core或身份不等以`PRODUCTION_WAIT_NEW_ATTEMPT_AUTHORITY_CONFLICT`在Product/POST前失败。拓扑规范化hash仍为`74d8b9d3ef88f7290bb7309447064f9da1568b3e9f5dba4bff64d46b23ff6283`，S/N/R/G/T/H/O/I=`23/28/40/14/18/24/21/36`；未新增表、队列、worker、状态、Owner、兼容桥或第二恢复链，双仓`diff --check`通过 | PASS；静态结构、正负迁移及防膨胀分母100% |
| 主 Codex 实现自审 R16 | executeClaim真实接回 / 旧fact零重投 / 双仓聚焦回归 | 新验收从旧attempt持久first fact和Website `WAIT_NEW_ATTEMPT`本地释放开始，注入远端failure为空且accepted count递增的新grant，证明真实`executeClaim`到达既有跨attempt CAS、Product执行数=1、旧failure release POST=0、新attempt成为current且旧fact原子清除；同attempt负例证明accept=0、POST=0、旧fact不动。AGENT typecheck、Runtime、GPT、Browser terminal/property/mutant/authority/auto-pairing/effect-recovery/FIFO、extension build/verify与projection均通过；Website production typecheck、AI v6 Exam=`41 pass/0 fail/1 PostgreSQL skip`、projection current通过 | PASS；10/10工单、204/204定义及本finding正负动态分支完成度与准确度均自评100%，超过98%门 |
| 独立实现复审 R8 | D01限流三态 / D03 cooldown一致性 / D04真实Website投影 | D01以27/27、100%分母`PASS`。D03以18项通过16项、88.89%给出`FAIL`：相同cooldown request并发时锁前未命中、锁后未重查，会被活动窗口错判409；其heartbeat finding经主Codex按P0法案反证后不采纳——`claim_eligible`是session请求claim资格，不是无关新grant gate，若直接合取gate会阻断cohort accepted attempt regrant、同effect零submit读回和时间门后未发送恢复；正确边界是heartbeat签入gate reason，claim transaction以同一gate限制cohort。D04以16项通过15项、93.75%给出`FAIL`：Website device-status无条件投影job历史latest failure，而append-only历史不可删除，导致新attempt永远不能满足远端failure为空；R16夹具手造null形成假阳性。两项可采纳finding已先统一施工图为锁内二次幂等回读、device-status按当前attempt过滤且无当前attempt时保留历史latest | `AUDIT_FAIL`；必须定点修复、两轮主审并交全新R9复核 |
| 主 Codex 实现自审 R17 | R8 finding裁决 / 冻结锚点 / 唯一Owner / 防膨胀 | D03可采纳finding以同一`readVerifiedReplay`在device锁前后各读一次，锁后命中直接返回同一verified receipt，不进入active-incident冲突、不分配新write_order。D04以device-status唯一query按`runtime.attempt_id`过滤failure；无当前attempt仍返回历史latest，有新attempt只返回该attempt failure，append-only历史与trigger不变。D03 heartbeat finding按P0法案精确驳回：cooldown必须允许cohort accepted attempt regrant/零submit readback及时间门后未发送恢复，故claim-request资格不得与无关新grant gate合并；现役claim selector以`constrainedJobIds`守住边界。拓扑hash仍为`74d8b9d3...`，204项分母不变；无新表、状态、队列、worker、Owner、兼容桥或第二reader；双仓diff-check通过 | PASS；可采纳finding闭合，驳回finding有法案与真实consumer反证，结构分母100% |
| 主 Codex 实现自审 R18 | 并发同request / 新attempt真实投影 / 全链聚焦回归 | Website Exam新增锁前miss→锁后命中同request场景，证明返回原receipt、write_order保持1、cooldown状态不二次更新；新增device-status查询与0087 immutable trigger联合断言，证明历史不删且新attempt不会继承旧failure。AGENT真实`executeClaim`新attempt CAS/Product正负分支继续通过。AGENT GPT/Runtime、Browser terminal/property/mutant/authority/auto-pairing/effect-recovery/FIFO、extension build/verify与projection全通过；Website production typecheck、AI v6 Exam=`42 pass/0 fail/1 PostgreSQL skip`、projection current通过 | PASS；10/10工单、204/204定义及两项可采纳finding正负分支完成度/准确度均自评100%，超过98%门 |

| 主 Codex 拓扑连坐审计 R19 | N15/N20、H03/H24、I16/I17/I21/I23/I25/I29/I36 与 Blueprint attempt/cooldown 全链 | 撤销此前放行：发现四个真实漏点。其一，AGENT 满 N 时恢复性claim可复用旧attestation，Website可能同时授予恢复job与新job，违反同一时刻业务分母；其二，Website已有当前attempt first fact而AGENT本地载体缺失时，Runtime把该grant当fresh并可能再次进入Product；其三，exact cooldown cohort成员按设计可无`attempt_failure`，现有selector却把所有无failure accepted attempt永久排除；其四，selector已排除fail-closed attempt，但claim observation仍把它计为完全eligible并误报并发选择 | `AUDIT_FAIL`；原先PASS失效，四项必须在原Owner内闭合后重新独立复审 |
| 主 Codex 定点迭代 R20 | fresh attestation、远端first fact、cooldown cohort、claim diagnosis | recovery-only claim在同一session authority turn强制heartbeat并使用新attestation；远端当前attempt first fact而本地无载体时在Product前失败关闭并禁止按unaccepted release；Website恢复选择只额外允许当前设备精确`job_id + attempt_id` cooldown cohort中的无failure accepted attempt；selector与diagnosis复用同一允许函数。未新增表、队列、worker、持久状态、兼容桥或第二恢复Owner | 已完成代码与聚焦验收；等待双仓完整CHANGE及全新独立复审 |
| 独立实现复审 R9 + 主 Codex 迭代 R21 | cooldown 时间门、并行在途、expiry、跨设备诊断、行为证据 | 独立复审先后发现：active cooldown过早重授无failure任务；设备B的accepted attempt被设备A误报并发；A关闭共享gate时在途未submit的B把暂停固化为failure；expiry先把合法cooldown resume记为fail_closed；满N修复仅有源码断言。已收紧为无failure resume只在`provider_rate_limit_until<=serverNow`后开放，accepted attempt按lease owner诊断；Runtime仅在现役submit gate再次确认关闭后把直接cooldown error保留为暂停reason且不写first fact；expiry对精确resume identity不写fail_closed/event；真实WorkerSession验收证明强制heartbeat携满N=4并让claim绑定新receipt/hash/token | finding均已原位迭代并通过双仓聚焦验收；等待两名独立审计者最终复核与最新完整CHANGE |
| 独立实现复审 R10 + 主 Codex 迭代 R22 | cooldown preserve/resume 分离、expiry设备隔离、AGENT席位闭合 | 复审继续发现：全局expiry会由设备A误判设备B冻结attempt，active窗口的空resume集合也不足以保护同设备冻结attempt；Runtime暂停分支退出active后会从attestation席位消失，且后续同attempt regrant会被批次门拒绝。Website现把`preserveAttempts`固定为active/drain全cohort、`resumeAttempts`固定为时间门到期后的精确cohort，expiry SQL强制`lease_owner=当前claim设备`并只以preserve集合跳过无failure分类；AGENT业务分母改为所有durable accepted且非WAIT_NEW任务，同slot复用仅允许same-effect readback或同job+attempt的exact cooldown pause | 双仓聚焦验收通过；等待最终独立复核与原生CHANGE |
| 独立实现复审 R11 + 主 Codex 迭代 R23 | 满席恢复触发、暂停reason单义、撤权/删除读回、closure分类 | 最终复审继续发现：满席若全为无failure的cooldown暂停任务，worker只识别Provider readback而永不再claim；原触发任务的暂停reason绑定Browser authority后带后缀，exact字符串判断拒绝同attempt复用；暂停任务不在Website status reconciliation集合，后续撤权或物理删除会永久占本地席位；Website closure SQL把合法无failure暂停任务误归`unclassified`而selector仍允许恢复。AGENT现统一识别`PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE`及其authority-bound形式，满席existing-attempt恢复强制当前attestation，同attempt复用同时覆盖触发任务与sibling，四个暂停任务仍签入N；所有已接受且无result/failure的任务继续读Website status，首次WAIT_NEW/永久撤权只释放一次，WAIT_NEW后仍保留只读对账并在后续404执行现役purge。Website closure将精确cohort中完全无failure row的暂停任务归入`unsent_resume`，并补真实SQL矩阵case | 已完成代码与聚焦验收；等待两名独立审计者重新复核与最新双仓CHANGE |
| 独立实现复审 R12 + 主 Codex 迭代 R24 | 无failure旧attempt的fresh/regrant身份、readback slot attempt绑定、两阶段删除 | 复审证明：Website允许exact cooldown cohort中无failure的accepted attempt在时间门后重授，但AGENT本地authority丢失时无法区分fresh grant与旧attempt regrant，空WAL会把未知旧Provider effect当fresh并可能重复submit；provider-readback席位复用还只校验job而未校验attempt；WAIT_NEW后再物理删除的两阶段顺序仍需持续读到404。Website唯一grant合同新增由claim transaction直接派生的`same_accepted_attempt`，AGENT仅允许该标志为true且本地存在同attempt durable authority时进入Product；本地缺失时保留远端accepted authority并在任何Website写入前失败关闭。provider-readback和cooldown两类席位复用均要求同job+attempt；WAIT_NEW只释放一次但继续同一status reader直至regrant或404 purge。该字段只证明本次grant是fresh或既有accepted attempt，不新增恢复状态、DB、Owner、队列或兼容路径，双仓必须同一READY批次发布 | 已完成代码与聚焦验收；等待最终独立复核与最新双仓CHANGE |
| 独立实现复审 R13 + 主 Codex 迭代 R25 | 必填grant字段的版本隔离与旧receipt回放门 | 红队发现若必填`same_accepted_attempt`仍隐藏在v38，新Website会接纳旧AGENT session后返回旧consumer无法解析的grant，反向混版也会拒绝缺字段；同request旧claim receipt还可能原样回放旧shape。canonical provider与AGENT dependency现同步升为v39，strict producer/validator/consumer只认同一shape；Website迁移在锁内按完整durable accepted business分母拒绝任何未完成attempt，不依赖可为空的worker_session_id或session状态，通过后supersede全部旧活跃会话并立即失效current/previous token。跨session reconciliation在读取或写入旧claim receipt前还要求predecessor与当前session合同版本精确相等，因此v39凭据不能回放v38 jobs_json；旧receipt保持不可改。真实commercial migrator对0146写入canonical `ai-acceptance` Owner，并由READY数据库合同校验同一身份。不增加兼容解码、dual read/write或第二合同 | PASS；两名独立审计者P0/P1/P2均为0，双仓最新CHANGE_PASS |

当前 `WT-TOPOLOGY-001`、`WT-AUTH-001`、10 个施工工单与旧shape排空门的既有结论不替代本轮R19/R9 finding。授权人本轮明确要求在修复后启动子智能体审计，并在通过后执行双仓READY与推送；因此先前“取消后续独立审计”的时点指令已被本轮最新指令取代。双仓必须先通过唯一CHANGE入口和两名审计者最终复核，随后以各自clean commit执行READY；RELEASE与Dynamic Proof仍不在本轮授权范围。

---

## 7. 历史授权结论

冻结拓扑到生产代码的差异清单继续保持唯一施工记录。本轮R19至R25的finding均已在原Owner内闭合，双仓最新原生CHANGE均通过，两名独立审计者最终结论均为`AUDIT_PASS`且P0/P1/P2为0。下一门仅为各仓形成clean commit后执行READY并推送；READY通过也不等于RELEASE。真实PostgreSQL迁移、Browser/Provider与业务领域Dynamic Proof未在本轮执行，当前不得宣称生产完成或RELEASE。
