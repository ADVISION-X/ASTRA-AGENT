# AI 生产派单金字塔优先级排序 完整实现方案

## 0. 状态与授权边界

**已获完整施工授权，现因生产日志揭示的数据库权限断点回到源头重审（2026-10-09）。** 用户已明确目标语义：五个阶级永久固定，低层工单没有等待晋级、aging 或防饿死通道；只要全局仍存在更高阶级的未完成工单，任何较低阶级工单都不得取得**新开始授权**。用户已明确授权修改法案、施工图、代码、质检系统与数据库操作，并要求先完成双仓法案/施工图全量遍历、两遍主 Codex 审计和不低于 98% 的有限清单核验，未过门前禁止进入代码施工。此前静态与数据库夹具验证不能替代真实 worker 角色建单；本轮先补齐该源头权限合同，重新通过两轮门禁后再进入代码。

“新开始”以 Website 为 job 签发 fresh attempt/grant 为唯一边界。已经 durable accept 的 attempt、已经取得或可能取得的 Provider effect、staged result、Outbox 与领域接纳必须继续沿原链收尾；它们不是新的低层开始。否则新出现的高层工单会冻结既有低层结果，破坏现役恢复和 admission 闭环。未来尚未创建的工单不能追溯撤销已经签发的 grant；新高层工单一旦持久创建，就阻断此后的所有低层 fresh grant。

## 1. 固定阶级与完成定义

### 1.1 永久映射

| 阶级 | 固定业务范围 | `product_id` |
|---|---|---|
| Tier 1（最高） | 支付截图观察 | `payment_screenshot_observation` |
| Tier 2 | 已购买的付费产品、报告翻译 | `bazi_ai_full_analysis`, `bazi_chart_interpretation`, `bazi_report_followup`, `hehun_ai_analysis`, `hehun_report_followup`, `naming_bazi_analysis_and_naming`, `naming_from_existing_bazi_report`, `qimen_professional_answer`, `qimen_report_followup`, `localization_report_translation` |
| Tier 3 | 固定文案翻译 | `localization_static_catalog` |
| Tier 4 | SEO、公开知识文章及文章翻译 | `localization_article_translation`, `public_knowledge_article_pipeline` |
| Tier 5（最低） | 当前或未来未显式映射的产品，包括尚未建设的系统反馈升级 | `ELSE 5` |

同一 `product_id` 的 primary、`accuracy_challenge` 与 `quality_reflection` action 均继承该产品固定阶级。阶级只由 Website 现役 `product_id` 决定，不读取价格、用户、创建时间、重试次数、设备、Provider 状态或运行时权重。

### 1.2 严格门与完成

每次 fresh grant 前，Website 在同一 commercial 数据库事务中计算全部 durable V6 job 的最小未完成阶级 `open_tier`。只有 `tier(job)=open_tier` 的**未开始 job**可取得 fresh grant。若 Tier 1 尚有任一未完成 job，Tier 2–5 的 fresh grant 数恒为零；Tier 1 全部完成后才开放 Tier 2，依次类推。当前开放阶级暂时不可领取时返回零 fresh grant，绝不向下一阶级回退。

“完成”只认现役 Website 领域接纳闭包：runtime `status='completed'`、`terminal_status='completed'`、`business_consumed_at` 与 `business_consumption_hash` 均非空，并能按产品读回其领域 receipt/对象事实。Provider 回答完成、terminal 写入、HTTP 200、claim receipt、lease、AGENT 本地完成、Outbox delivered 或等待过久均不是完成。依现役永久终止 authority 物理删除的未完成 job 不再进入分母；不得用 tombstone、超长 `retry_not_before` 或隐藏状态假装完成。

同一开放阶级内，对当前可 fresh grant 的 job 保持 `created_at,job_id` FIFO。不存在 effective tier、临时提升、阈值、动态权重、配额轮转或低层保底容量。

## 2. 当前候选、权威与漂移

| 仓库 | 2026-10-09 绑定 | 工作树 |
|---|---|---|
| AGENT | `/Users/nexgen/Documents/AGENT`, `main@5ae4bb4cf6939bab2a70d16f69509fd4582bbfe1`，tracking `origin/main` 同 SHA | 当前只保留本方案差异。 |
| Website | `/Users/nexgen/Documents/xuanxue-web`, `main@24c9739f0a918c754819d7581ebee96d37ffd5c6`，tracking `origin/main` 同 SHA | 存在与本任务无关的 `docs/项目方案/全球付款-完整实现方案.md` 既有修改；本轮始终保留，不覆盖、不提交、不隐藏。 |

现役权威为双仓 `AGENTS.md`；Website `.github/instructions/agent-rules/功能法案.md` 的 `LAW-AI-ACCEPTANCE-002-V35`、`003-V10`、`004-V31`、`012-V44`、`013-V28` 与 `LAW-PUBLIC-KNOWLEDGE-CONTENT-005-V44`；Website `docs/blueprints/SYSTEM-BLUEPRINT.md`、`docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md` V50 与 System Security Blueprint；AGENT `docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md` V65 与 `.agents/skills/agent-flow-boundary-gatekeeper/SKILL.md` 的 Owner 边界。Website 唯一质量入口为 `npm run quality:check -- <LEVEL>`。

候选身份只绑定双仓原生 Git `HEAD → 工作树` 实际差异。施工和审计前现场重读受影响文件；任一相关事实漂移只重审受影响部分，不建立自定义候选散列或第二份文件 hash 清单。

## 3. 现役链与第一直接断裂

`services/api/src/ai-production/job-claim-selection.ts::selectV6ClaimableJobs/readNextV6ClaimCandidate` 当前只对本次可领取集合按 `(created_at,job_id)` 遍历。它把 retry、lease、device、cooldown cohort、route capability、material、terminal 与 recovery 条件应用在候选资格上；只改成 `ORDER BY tier` 会在高层 job 暂时不合资格时继续向低层发 grant，违反固定阶级。

`job-claim-repository.ts::executeClaimTransaction` 已通过 `ai_production_control_protocol_state(singleton=true) FOR UPDATE` 串行 claim 事务；可复用该行作为新任务创建与 fresh grant 的线性化点。`website-agent-task-repository.ts::createWebsiteAgentTaskWithClient` 当前创建 job 时未取得这把锁。如果高层创建与低层 claim 并发，仅在选择 SQL 增加 tier 条件仍存在穿透窗口：低层事务可能先看不到尚未提交的高层 job。

现役 `business-result-domain-dispatch.ts::finalizeConsumptionWithClient` 在领域消费成功后原子写 `status='completed'`、`business_consumed_at`、消费 hash 与领域事实，是解除阶级门的权威事实。terminal completed 但尚未领域消费的 job 仍必须阻断低层。

写前现役 V30 forbidden 第 4 项和全局 FIFO 测试保护旧语义。第一遍依赖审计证明，修改 004 的语义会使直接依赖它的 `012-V40`、`013-V24`、`LAW-PUBLIC-KNOWLEDGE-CONTENT-005-V40` 发生 dependency obligation 变化；按冻结母本不能只升 004，必须将四条原子续升为 `004-V31`、`012-V41`、`013-V25`、`PUBLIC-KNOWLEDGE-CONTENT-005-V41`，后三条只更新依赖引用和 supersedes，不扩张正文语义。现役 AGENT 只消费 Website 签发的 grant，不需要理解产品阶级；Browser FIFO、Product Plugin 与 Runtime 不取得 priority Owner。

## 4. 唯一目标链与有限分母

1. 所有创建 V6 job 的现役入口在插入新 job/runtime 前，通过唯一 `ai_production_lock_task_ordering()` 数据库函数取得现役 control protocol singleton 行锁；claim 继续直接取得同一行锁。该函数只执行并验证 `singleton=true FOR UPDATE`，不返回控制行数据、不写控制状态；只向当前真实建单消费者 `xuanshu_api_runtime`、`xuanshu_bazi_worker`、`xuanshu_hehun_worker`、`xuanshu_public_knowledge_worker`、`xuanshu_commercial_outbox_worker` 授予 `EXECUTE`。`xuanshu_api_runtime` 为现役 claim Owner，保留原控制表直接权限；其余四个受限 worker 对控制表的直接权限保持为零。锁的先后次序定义事实：高层创建先提交则低层不能 grant；低层 grant 先提交则其发生在高层 job 存在之前，后到高层只阻断后续低层 fresh grant。
2. claim 在 singleton 锁内，从全部未完成 durable job 计算唯一 `open_tier=min(staticTier(product_id))`。分母不受 retry、lease、device、capability、material、control intent、cooldown cohort、terminal pending admission 或当前请求设备过滤。
3. selector 保留已经 durable accept/staged/delivery 的现役恢复分支；这些分支可跨 tier 收尾。fresh branch 额外要求 `staticTier(candidate.product_id)=open_tier`。同一 claim batch 的 fresh jobs 只能来自一个 tier；容量有剩余也不得用低层补满。
4. 若开放 tier 有可领取 job，按原 `(created_at,job_id)` FIFO grant。若开放 tier 全部暂不可领取，返回零 fresh grant，并由现役 observation 只以开放 tier cohort 计算精确 exclusion reasons；不新增 reason code 或第二诊断 Owner，不把低层本来可领取误报为并发选择。
5. job 达成领域 admission 闭包或由现役永久 authority 物理删除后离开未完成分母；下一次 claim 重新计算 `open_tier`。不持久化 current tier，不建立 tier 状态机或推进事件。

有限分支：

| 分支 | 结果 |
|---|---|
| 存在未完成 Tier 1 | Tier 2–5 fresh grant=0；Tier 1 按 FIFO；已开始低层只准原 attempt 恢复/交付/接纳。 |
| Tier 1 已清空，Tier 2 未清空 | Tier 3–5 fresh grant=0；Tier 2 按 FIFO。 |
| 开放 tier job 全部 retry/device/capability/material/cooldown 阻断 | 返回现役精确 reason；低层不补位。 |
| 开放 tier job terminal completed、等待领域 admission | 它仍未完成并阻断低层；Domain Consumer 可继续，不要求 AGENT 重做。 |
| 新高层 job 在低层已 grant 后创建 | 已开始低层不撤销；新高层提交后阻断后续低层 fresh grant。 |
| 没有未完成 job | 保持现役 `NO_UNFINISHED_V6_DEMAND`。 |

## 5. 原子工单

### 工单 1｜Website 法条与施工图

- 将 `LAW-AI-ACCEPTANCE-004-V30` 原子升为 V31，`supersedesLawId=V30`；只修订领取顺序主题及不可分割 summary。同步把直接依赖闭包 `012-V40→V41`、`013-V24→V25`、`LAW-PUBLIC-KNOWLEDGE-CONTENT-005-V40→V41`，后三条仅更新 `dependsOnLawIds`、`lawId` 与 `supersedesLawId`。
- 最新生产日志触发最小权限补充修订：`LAW-AI-ACCEPTANCE-002-V32→V33` 明确共享 Material Blob 只能由一份最窄安全定义函数原子 ensure+row-lock；依赖闭包 `012-V41→V42`、`013-V25→V26`、`LAW-PUBLIC-KNOWLEDGE-CONTENT-005-V41→V42` 只续升引用。`004-V31` 的固定五阶语义不变。同步 Website AI Acceptance Blueprint V48 与 System Security Blueprint；AGENT V65 不改 wire、Runtime 或调度。
- 真实建单继续执行后，再将 `002-V33→V34` 精确扩展为同一函数内核 exact 付款退休 tombstone；依赖闭包续升 `012-V42→V43`、`013-V26→V27`、`PUBLIC-KNOWLEDGE-CONTENT-005-V42→V43`，AI Acceptance Blueprint 升 V49。不得把这次续升解释为新 Owner、第二函数或跨仓 wire 变更。
- V31 对现役 forbidden 第 4 项的精确替换为：“不得先发 lease 再用 Browser 缺失回滚；不得在全局仍存在更高固定阶级未完成 V6 job 时，为低阶 job 签发 fresh attempt/grant。固定阶级只能由 Website ai-acceptance 的唯一静态 product_id→1..5 映射决定，未命中固定为第 5 阶；只有领域接纳闭包已持久完成或现役永久终止 authority 已物理删除的 job 才离开未完成分母。等待时长、aging、registration order、retry、device、capability、material、cooldown、动态权重或低层保底容量均不得改变阶级或允许跨阶补位；同一开放阶级内 fresh grant 仍按最早 eligible created_at + job_id。已 durable accept 的原 attempt 恢复、同 effect 读回、staged result 交付与领域接纳不是 fresh grant，不得被后到高阶 job 阻断。”
- V31 必须明确：静态 1..5 阶级；全局未完成最小 tier 是 fresh grant 唯一开放 tier；任一高层未完成时低层 fresh grant 为零；禁止 aging、晋级、动态权重、低层保底与容量补位；已 durable accept 的原 attempt 仍可恢复和接纳；完成只认 admission 闭包或现役永久 authority 的物理删除。
- 同步 Website `AI-ACCEPTANCE-BLUEPRINT.md` V47、`SYSTEM-BLUEPRINT.md` 与 AGENT Runtime Blueprint V65 的 claim/order 导航，保持 Website `ai-acceptance` 为唯一 Owner；不修改 AGENT Browser FIFO、Product Owner 或跨仓 wire。

### 工单 2｜创建与领取的单锁线性化及最小权限

- 新增唯一前向迁移 `0161_ai_production_task_ordering_lock.sql`：创建 `public.ai_production_lock_task_ordering()` 零参数、返回 `void` 的 `SECURITY DEFINER` 函数，固定 `search_path=pg_catalog,public`，函数体只锁定并验证 `public.ai_production_control_protocol_state(singleton=true)`；缺行必须失败关闭。撤销 `PUBLIC` 默认执行权，只给 `xuanshu_api_runtime`、`xuanshu_bazi_worker`、`xuanshu_hehun_worker`、`xuanshu_public_knowledge_worker`、`xuanshu_commercial_outbox_worker` 精确 `EXECUTE`。迁移后逐角色读回函数权限为真；`xuanshu_api_runtime` 保留现役 claim 所需的控制表权限，另外四个 worker 的控制表 `SELECT/UPDATE` 均为假。不修改历史 migration。编号 0160 已由共享主仓中另一项获授权的 Bazi task 权限迁移占用，本任务不得覆盖或混入该迁移。
- 在 `website-agent-task-repository.ts::createWebsiteAgentTaskWithClient` 新 job 分支删除原直接控制表查询，改为调用该唯一窄函数；所有现役 task 创建调用继续复用该唯一 repository 函数。幂等读回已有 job 不制造新需求，不需要改变返回合同；不得借本次锁改动新增现役创建合同没有要求的 admission 判定。
- 新增后继前向迁移 `0162_ai_production_material_blob_ensure_lock.sql`：创建唯一 `public.ai_production_ensure_material_blob(text,text,text,text,integer,text,text)` 安全定义函数，固定 `search_path=pg_catalog,public`，在调用者现有事务内执行原 `INSERT ... ON CONFLICT DO NOTHING` 后按 canonical ref `FOR UPDATE` 并返回全部身份字段；撤销 PUBLIC，只向同五个真实建单角色授予 EXECUTE。`ensureAiProductionMaterialBlob` 删除应用层直接 INSERT 与冲突后直接 `FOR UPDATE`，只调用该函数并保留既有身份冲突与付款材料退休校验。不得授予受限 worker 材料表 UPDATE/DELETE，不复制角色专用函数，不改变删除 Owner。
- `0162` 已应用后，真实函数调用暴露 `ON CONFLICT(canonical_object_ref)` 与 RETURNS TABLE 输出变量同名歧义；不可改写历史 migration，`0163` 已按删除→缺席验证→同名重建修正为 `ON CONFLICT ON CONSTRAINT`。随后公共知识真实建单继续暴露应用层 tombstone 直读 `42501`。最终前向 `0164_ai_production_material_blob_ensure_lock_retirement_rebuild.sql` 必须再次删除同一函数、验证缺席并按 V34/V49 重建：在持有 Blob 行锁时检查 exact `payment_screenshot_retention_delete_attempt`，命中即失败关闭；应用 `ensureAiProductionMaterialBlob` 删除外部 `assertPaymentMaterialNotRetired` 调用。不得改 0162/0163 字节，不新增第二函数或授 tombstone 表权限。
- 保留 `job-claim-repository.ts::lockClaimAdmission` 现役 singleton 锁；不得新增表、列、队列、advisory lock、scheduler 或 tier 状态。
- 并发验收：高层创建先取得锁时低层 claim 等待并在提交后被挡；低层 claim 先取得锁时其 grant 先于高层 job 存在，高层提交后所有后续低层 fresh grant 被挡；无死锁、无重复 job/grant。

### 工单 3｜固定阶级门

- 在 `job-claim-selection.ts` 内维护一份静态 `product_id→1..5` SQL 表达式生成函数；未命中固定为 5。选择器用它计算全局未完成 `open_tier` 并约束 fresh branch，`job-claim-observation.ts` 只导入同一函数形成诊断 SQL，禁止第二份映射或第二调度裁决。
- 未完成谓词对不完整完成事实失败关闭：只有 `status='completed' AND terminal_status='completed' AND business_consumed_at IS NOT NULL AND business_consumption_hash IS NOT NULL` 才离开通用门；产品特有领域 receipt/object 继续由现役 Domain Consumer/readback 验真。
- recoverable、staged delivery、同 effect readback、source handoff、provider cooldown cohort 收尾保持现役语义；fresh candidate 才应用 `open_tier`。保留二元 cursor 与同阶 FIFO，不引入三元 cursor、effective tier 或时间计算。
- `job-claim-observation.ts` 复用同一 tier 计算，只以 `open_tier` cohort 形成本次零 grant 的 exclusion reasons；可见 job 投影不取得调度权。

### 工单 4｜合同、测试与唯一质检

- 不新增跨仓 reason code，V6 wire 不因阶级门升版；AGENT 无代码工单。若施工发现现役 reason 集合无法如实表达开放阶级阻断，停止回到设计，不能静默扩张跨仓合同。
- 更新 `scripts/audit/domains/ai-acceptance/check.ts`、`manifest.json` 与 generated registry 的 V31 引用；审计静态映射唯一性、默认 Tier 5、无 aging/阈值/动态状态、singleton 双入口锁和 fresh-only gate。修订 exam/localization 中旧全局 FIFO 断言，不删除其它恢复保护。
- 数据库 Exam 覆盖：每层单独、跨层、开放层暂不可领、terminal 待 admission、完成后逐层开放、同层 FIFO、N>1 不跨层补位、低层旧 attempt 在高层出现后继续收尾、冷却 cohort、source evidence、并发创建/claim 两种锁顺序、未知 product 默认 Tier 5；逐角色 ACL 读回证明五个真实建单角色均可执行窄函数、四个受限 worker 不能直接读取或更新控制表、API 仍保留现役 claim 直锁权限，并以 API 及本次生产日志实际失败的 public-knowledge、commercial-outbox 三份现役 profile 完成真实函数调用。Bazi/Hehun profile 若被常驻 worker 占满连接，只以 ACL 与共用 repository 的结构证明验收，不中断生产 worker 制造测试连接。
- CHANGE 只运行与实际差异相交的普通测试和 `npm run quality:check -- CHANGE`；READY/RELEASE 另按现役冻结说明书和 active law 执行，不把 CHANGE 冒充发布。

施工顺序：工单 1 → 工单 2 → 工单 3 → 工单 4，同一 Website 候选闭合。禁止出现代码已执行固定阶级而 active law 仍要求全局 FIFO 的候选。AGENT 没有代码部署依赖；跨仓只需在 RELEASE 核对现役 V6 wire 未变化及 Website grant 仍符合 AGENT 当前合同。

## 6. 删除反事实与放行门

- 删除静态映射：无法知道固定阶级，需求失败。
- 只保留 `ORDER BY tier`、删除全局未完成门：高层暂不可领时低层仍开始，需求失败。
- 删除 task-create/claim 共用 singleton 锁：并发提交可让低层穿透，需求失败。
- 把 terminal 或 grant 当完成：低层会在高层尚未领域入库时开始，需求失败。
- 阻断已 durable accept 的低层收尾：高层后到会冻结现实 Provider effect/结果，破坏现役恢复闭环。
- 增加 aging、阈值、轮转、低层配额或持久 tier 状态：直接违反用户的阶级固化要求，必须删除。

当前门禁是法案/施工图第二遍反向审计与有限检查清单达到至少 98%；通过后才进入代码和质检系统。施工前重新绑定双仓 HEAD、tracking、现役 major/current successor、相关源码与测试；若候选漂移则只重审受影响部分。只有候选、法条、蓝图、实现、测试和唯一质量入口一致，方案才可放行；本文件本身不产生 CHANGE、READY、RELEASE 或生产 PASS。

## 7. 2026-10-09 执行证据

### 7.1 权威门

- 主 Codex 已逐份读取 AGENT 39 条、Website 510 条 active law record，并遍历 AGENT 7 份、Website 3 份现役施工图；两仓 active law 均无 JSON 解析错误和未解析依赖。
- 第一轮正向清单最终为 55/55，第二轮反向/对抗清单为 60/60，均为 100%。第一轮发现并纠正了只升 004 的错误：实际 dependency closure 是 004、012、013、PUBLIC-KNOWLEDGE-CONTENT-005 四条原子续升。
- 现役四条法案、Website V47、System Blueprint 与 AGENT V65 已对齐；三份跨仓 spec 仅更新 law reference，V6 v44、task-result v17、route dependency v4 和跨仓 wire 均未升版。

### 7.2 实现与删除边界

- `job-claim-selection.ts` 的 fresh 领取片区已重构为唯一静态 product tier 映射、全局未完成最小 tier 门和原同阶二元 FIFO；旧“所有 eligible job 共用全局 FIFO”语义已退出该片区。默认未命中固定为 Tier 5，无时间晋级、动态权重、低层配额或持久 tier 状态。
- `job-claim-observation.ts` 复用同一映射和未完成谓词，只观察当前开放阶级；缺失 runtime 的高阶 durable job 仍进入未完成分母，全局 exclusion 精确只报 `CURRENT_NEXT_ACTION_NOT_CLAIM`，exact job 查询命中后以 `AI_PRODUCTION_RUNTIME_MISSING` 失败关闭，不伪装成不存在，也不虚报 control intent；没有第二份映射或第二调度 Owner。
- `website-agent-task-repository.ts` 的新建分支与 claim 复用同一 control singleton 行锁；原实现直接查询控制表，真实受限 worker 因 `POSTGRES_SQLSTATE_42501` 无法建单。该断点必须由一份前向最小权限迁移与唯一窄锁函数修复，不能通过直接扩大控制表权限、删除创建锁或增加第二锁链绕过。
- 领域完成门要求 `status`、`terminal_status`、`business_consumed_at`、`business_consumption_hash` 四项同时闭合。已 durable accept 的恢复、同 effect 读回、staged delivery 和 admission 收尾保留原链。

### 7.3 当前验证事实

- `npm run audit:build`：`REGISTRY_BUILT 03b87add16529903e12a31609a569dc39903f285ac000e41d888fa048c6f87a7`；`npm run audit:projection:check`：同 hash `PROJECTION_CURRENT`。
- `npm run ai:production:v6:exam`：71 pass、0 fail、5 个需显式 PostgreSQL 门的测试按合同 skip；定向 localization：12 pass、0 fail。
- 加载本机受控数据库 profile 后，`AI_PRODUCTION_POSTGRES_TEST=1`：56 pass、0 fail、0 skip。真实 SQL 已证明 N=4 仍不跨阶补位、terminal 未 admission 继续阻断且不误报并发选择、Tier 2 全部 admission 后才依次开放 Tier 3 与 Tier 4、未知产品 SQL 固定落 Tier 5、低阶 accepted attempt 在高阶出现后仍可恢复；高阶 durable job 缺失 runtime 时仍失败关闭并阻断低阶，诊断既不报空队列也不误报并发选择；真实 task-create 函数和 claim 使用的同一 singleton 锁语句已按 create-first、claim-first 两种顺序验证排他。
- `npm run typecheck`：production、audit、audit-tests 全部通过。
- 初次代码主审后，两个只读审计者共同发现 observation 对异常完成行误报并发选择及数据库验收分母不足；两项已修复。随后对抗审计又发现高阶 durable job 缺失 runtime 时，内连接会把它排除在全局未完成分母之外并误放低阶；selector 与 observation 的全局分母均改为失败关闭的左连接，并增加真实 PostgreSQL 孤立 job 验收。
- 上一稳定候选的一名只读审计者以完成度 100%、准确度 99% 放行；对抗审计者继续发现两个同根诊断缺口：exact job 的 visible 内连接会把缺 runtime 伪装成不存在，且 null control intent 会虚报 `CONTROL_INTENT_NOT_CLAIMABLE`。visible 已改为左连接以激活现役 exact runtime guard；control reason 现只在非 null 且非 `none` 时产生，数据库验收把孤立 runtime 的 reason 集锁定为唯一 `CURRENT_NEXT_ACTION_NOT_CLAIM`。
- 再次复审时，对抗审计者证明上述“唯一 reason”只在全能力、无材料、无设备绑定夹具下成立：孤立 runtime 仍可能继续派生 capability、material 或 device 原因，且 exact guard 只有源码字符串断言。最终实现把 `status=null` 设为 exclusion 的唯一立即返回分支；真实 PostgreSQL 先执行 exact observation reader 并核 `AI_PRODUCTION_RUNTIME_MISSING`，再同时加入 foreign device、空 capability routes 与 unresolved material，仍精确得到唯一 `CURRENT_NEXT_ACTION_NOT_CLAIM`。为执行同一真实 SQL/投影路径，只提取一个带 client 的窄 reader，现役 public reader 直接委托它；未新增状态或第二查询链。
- 最终修复候选已再次执行两遍主 Codex 自检：法案→施工图→实现→动态证据正向清单 48/48（100%）；代码/数据库并发点→唯一 Owner→禁止项反向清单 51/51（100%）。反向审计确认无新增表、迁移、依赖、tier 持久字段、AGENT wire/调度字段、兼容桥、第二队列或第二 Owner。
- 随后的只读对抗审计发现质检虽固定了 canonical claim 声明，却未限制受保护声明之外新增 `selectAndGrantClaimJobs` 调用者；旧 V6 调度又先执行 status handler，因此可以新增同 URL 的提前截获分支而保持原受保护声明不变。最终修复删除 `job-repository.ts` 的 claim barrel 导出，路由直接绑定唯一 claim repository，并把 `handleV6JobRoute` 提到 V6 调度首位；AST 质检现在同时要求 `selectAndGrantClaimJobs → executeClaimTransaction → claimAiProductionJobsV6 → handleV6JobRoute → handleV6Route` 各敏感调用点唯一且位于其固定 Owner 内。新增 caller、barrel 重定向、别名重绑、handler 抢跑和声明内容漂移的 mutation 均失败关闭。
- 该最终候选重新完成两遍主 Codex 自检：正向法案→施工图→映射→未完成分母→单锁→恢复→路由→质检为 61/61（100%）；反向唯一调用链、禁止晋级/aging/补位、无迁移/依赖/Skill/wire 扩张及 AGENT 仅两份文档差异为 55/55（100%）。`npm run typecheck`、`npm run project:code-purity`、非数据库 V6 Exam 71/71（另 5 项按门跳过）以及受控 PostgreSQL V6 Exam 56/56 均通过。
- 首次 `npm run exam:check -- ci` 因验证进行期间测试夹具发生本任务候选漂移，最终按设计报 `EXAM_CANDIDATE_DRIFT`；该结果不是实现失败，稳定候选必须从头重跑，不能复用漂移前结果。
- 尚待门禁：只读子智能体对稳定修复候选复审、CI-FULL CHANGE→READY→RELEASE。Website 的无关付款方案修改可能阻断 clean-commit READY，本任务不得擅自处理该文件。

### 7.4 第一轮生产日志后的修复事实

- 第一轮日志暴露 task-create 直接锁控制表的 `42501`；`0161_ai_production_task_ordering_lock.sql` 已通过唯一 `ai_production_lock_task_ordering()` 修复。生产 registry 中该迁移 hash 为 `sha256:2e0279694bcce2b84646be6434795d9f0363671ecea7c2a1cd7f9c5cc73f2055`、Owner 为 `ai-acceptance`。
- 生产读回证明函数 `SECURITY DEFINER=true`、`search_path=pg_catalog,public`，ACL 除 Owner 外精确为五个建单角色；受控 PostgreSQL V6 Exam 57/57 通过。该事实只证明创建与 claim 共用排序锁的权限缺口已经关闭。

### 7.5 最新生产日志后的第二次源头重审

- 最新日志时段 `2026-10-09T18:45:54.274Z` 至 `18:48:07.277Z` 共解析 823 条 JSON：362 succeeded、29 failed；其中 14 个底层 `POSTGRES_SQLSTATE_42501`。migration verify 已读到 164 个迁移且 head 为 `0161_ai_production_task_ordering_lock.sql`，证明第一轮排序锁迁移已加载。
- `xuanshu_public_knowledge_worker` 至少 10 次 task-create 在 `ensureAiProductionMaterialBlob` 失败；用其现役数据库 profile 复现得到 `permission denied for table ai_production_material_blobs`。根因是共享 Blob 已存在时应用层执行 `SELECT ... FOR UPDATE`，PostgreSQL 要求 UPDATE 权限，而该角色只有 SELECT+INSERT。八字 worker 的日志同样出现 42501；权限矩阵又证明 Bazi 与 Hehun 两个真实建单角色对材料表均无权限，因此 Hehun 也处于同一结构风险。
- 日志中的一次 claim 确实只发出 3 个 `localization_static_catalog` Tier 3 job，证明 durable job selector 的固定阶级门在工作；但 Tier 2 八字与 Tier 4 公共知识需求先在材料 ensure 阶段回滚，未成为 durable job，selector 无法看到它们。当前只能裁决“已入库工单排序成功”，不能裁决“网站源头全部工单稳定严格排序”。
- 删除性裁决：直接给受限 worker 材料表 UPDATE 会连带获得非本任务写能力；删除 `FOR UPDATE` 会削弱与 tombstone/隐私删除/付款删除的并发门；按角色复制函数、增加新表、fallback 或第二建单链都没有真实必要。唯一保留对象是一个完成现有 ensure+row-lock 的窄安全定义函数，真实消费者仍是五个建单角色。
- 现回到法案/施工图阶段：`002-V33` 与依赖闭包 `012-V42→013-V26→PUBLIC-KNOWLEDGE-CONTENT-005-V42`、AI Acceptance Blueprint V48、System Security Blueprint 和本方案必须先通过主 Codex 两遍有限审计且各自不低于 98%，之后才允许施工 `0162`、应用代码与质检。此前代码自检、子审计、CHANGE/READY 均因本次新事实失效，不可复用。
- 日志另有两个与本派单链分离的事实：commercial outbox 的 `SET ROLE qimen_app` 权限失败继续保持 retryable；一次 task-create 在 claim 持有 singleton 时触发 `55P03`。前者不并入本方案 Owner；后者按锁先后次序未证明越序，但仍需在后续真实建单验证中确认有限重试能够收敛。

### 7.6 第二次源头门结果

- 主 Codex 第一遍正向审计完整解析 Website 510 条、AGENT 39 条 active law record，逐字节读取 Website 3 份、AGENT 7 份 Blueprint，并核 dependency closure、V33/V42/V26/V42 successor、spec/manifest 投影、V48 Blueprint 与阶段差异边界。初跑 65/67（97.01%）失败关闭：法条缺少唯一函数名，Git 中文路径被审计脚本误判。补齐函数名并改用 NUL 路径读取后复跑 67/67（100%）；registry/projection hash 同为 `55e8f14fdd7c7d89576d9d81dae73f25b944e08cb0558048979a4b52163c89e4`。
- 主 Codex 第二遍反向审计从最新日志故障回查现役代码、删除竞态、五角色 ACL、法案正文差异和 AGENT wire。初跑 58/62（93.55%）失败关闭：四项把后续数据库复现事实误当日志原文或把删除 Owner 错限在单文件。纠正证据归属后复跑 65/65（100%）：`004-V31` 字节语义未变；三个依赖 successor 只改身份/依赖；`002-V33` 只改一项最小权限条款；公共知识 profile 的真实 `FOR UPDATE` 为 `42501`；Bazi/Hehun 材料表四项权限均为零；无表、列、wire、AGENT Blueprint 或第二链扩张。
- 两遍均达到代码门要求，允许进入 `0162`、应用代码与质检施工；这些百分比只证明有限源头设计分母，不是 CHANGE、READY 或 RELEASE。

### 7.7 数据库施工的两次失败关闭与第三次源头回退

- `0162` 经原生 runner 应用后首次真实执行失败为 `42702 column reference "canonical_object_ref" is ambiguous`。历史迁移保持不可变；`0163` 在同一事务执行函数 DROP、`to_regprocedure` 缺席验证和同名 CREATE，改用唯一约束名，五角色函数调用测试随后越过 Blob ensure。
- 公共知识现役 profile 用一份已存在公开知识任务材料在事务内真实克隆建单，下一条失败变为 `42501 permission denied for table ai_production_material_tombstones`。这证明旧应用层 `assertPaymentMaterialNotRetired` 仍要求受限 producer 直接读取 tombstone 表，源头链仍未闭合。
- 最简单完整方案继续只有一份函数：把 exact 付款退休 reason 的 EXISTS 检查并入同一 Blob 行锁事务，函数命中退休即抛 `AI_PRODUCTION_MATERIAL_BINDING_UNRESOLVED`；应用层删除该次外部查询。直接授 tombstone SELECT、跳过退休门、按角色建函数、增加 fallback 或第二材料链全部删除。
- 现役法案续升为 `002-V34`，依赖闭包为 `012-V43→013-V27→PUBLIC-KNOWLEDGE-CONTENT-005-V43`，AI Acceptance Blueprint 为 V49；`004-V31` 固定阶级语义与 AGENT V65 wire 仍不变。必须重新完成两遍主 Codex 源头审计后才可施工 `0164`。

### 7.8 V34/V49 施工与定向验证

- 第三次源头门第一遍初跑 75/76（98.68%），发现 System Security Blueprint 未锁定 exact retirement reason；补入 `payment_screenshot_retention_delete_attempt` 后复跑 76/76（100%）。第二遍从生产 DB 与失败点反查 48/48（100%），确认 0162/0163 ledger hash 与本地不可变字节一致、单函数仍是唯一对象、公共知识 tombstone 直读精确 `42501`，代码门重新打开。
- `0164_ai_production_material_blob_ensure_lock_retirement_rebuild.sql` 已由原生 runner 应用，migration 总数 167。它在同一事务 DROP 旧函数、核 `to_regprocedure` 缺席、CREATE 同名函数；insert-on-conflict 后锁 canonical Blob，检查 exact 付款退休 tombstone，命中抛 `AI_PRODUCTION_MATERIAL_BINDING_UNRESOLVED`，最后才返回身份。ACL 仍精确为五角色 EXECUTE，未授材料或 tombstone 表权限。
- 应用 `ensureAiProductionMaterialBlob` 只调用该函数并核返回身份，已删除该建单路径的外部 `assertPaymentMaterialNotRetired`；resolver 等非建单路径仍保留原退休门，没有扩大删除 Owner。
- 五角色 PostgreSQL 函数验收通过；Bazi/Hehun 常驻连接饱和时按既定方案使用精确 ACL 与共用 repository 结构证明。公共知识现役 profile 用已存在公开知识材料在事务内完整克隆建单成功：`public_knowledge_article_pipeline`、1 份材料、status=failed（现役未接纳初态），随后 rollback。额外查询 `ai_production_job_materials` 曾因该角色按合同只有 INSERT 而返回 42501，已从审计脚本删除，不把审计器越权误判为生产失败。
- `npm run typecheck` 通过；受控 PostgreSQL `npm run ai:production:v6:exam` 为 80/80；`npm run project:code-purity` 初跑发现本次 import 增行导致 500 行预算超限，压回原 499 行后复跑 `status=PASS`，未提高预算。

### 7.9 代码主审结果

- 主 Codex 第一遍正向代码审计初跑 59/60（98.33%），唯一失败是对 `pg_get_functiondef` 大小写格式的错误假设；改为规范化读回后复跑 60/60（100%）。链路已覆盖 V34/V49 → 0164 delete/rebuild → 单函数调用 → exact tombstone → 五角色 EXECUTE → 三份迁移 ledger hash → 原生 registry projection。
- 主 Codex 第二遍反向代码审计 44/44（100%）：0162–0164 无表、列、角色、advisory lock、兼容/fallback、第二状态或表权限 grant；现役 DB 只有一个函数 overload；Bazi/Hehun/Public Knowledge 均可 EXECUTE，且对 Blob 无 UPDATE/DELETE、对 tombstone 无 SELECT/UPDATE/DELETE；建单 ensure 无直接 Blob/tombstone SQL，resolver 原退休门保留；`004-V31` 与跨仓 V6 wire 未变。
- 两遍代码自检均已达到门槛，下一步只允许独立子智能体对**当前建设差异与方案要求**做只读审计；不得让子智能体改代码或重复审计空方案。

### 7.10 独立审计退回与 V35/V50 源头回退

- 独立一致性审查先发现付款截图留存夹具仍识别已删除的直接 Blob INSERT；夹具已改为唯一 `ai_production_ensure_material_blob(...)` 调用，相关三文件整组回归 33/33 通过。该变更只修正质检消费者，没有恢复旧生产路径。
- 两名只读审查者继续证明三项阻断：0162/0163 可藏入永久表权限而静态检查不失败；0164 可追加额外函数授权或第二 routine 而静态检查仍通过；生产 `public` schema 预存 PUBLIC CREATE，五个运行角色可在部署后创建同名前缀 shadow routine，导致“唯一函数持续成立”不可证明。审查者同时指出 AI Acceptance Blueprint 曾把 public-knowledge 既有 Blob SELECT 错写为绝对不存在，已改为“本轮不新增或扩大”，并锁定 Blob UPDATE/DELETE 与 tombstone SELECT/UPDATE/DELETE 为零。
- 因第三项是现役权限事实而非 0162–0164 新增权限，代码阶段再次关闭。现役源头续升为 `LAW-AI-ACCEPTANCE-002-V35`，依赖闭包为 `LAW-AI-ACCEPTANCE-012-V44 → LAW-AI-ACCEPTANCE-013-V28 → LAW-PUBLIC-KNOWLEDGE-CONTENT-005-V44`，AI Acceptance Blueprint 为 V50；固定阶级法 `LAW-AI-ACCEPTANCE-004-V31` 与跨仓 V6 wire 仍不变。
- 最简单完整方案新增唯一前向权限迁移 `0165_ai_production_public_schema_create_revoke.sql`：只执行 `REVOKE CREATE ON SCHEMA public FROM PUBLIC`，读回 PUBLIC 与五个运行角色 CREATE 均为假、USAGE 保持真、schema Owner/migration Owner 不转移；不新建 schema、角色、表、函数、状态或第二链。质检必须同时读取 0162–0165，要求每份函数迁移只有一份 routine 与唯一五角色函数 GRANT、禁止其它 GRANT 和表权限；数据库 Exam 必须精确读回函数族唯一、Owner=`xuanshu_migrate`、函数 ACL=Owner+五角色，以及五角色 Blob/tombstone 完整权限矩阵。
- 在 0165、静态质检、动态 ACL Exam 施工前，主 Codex 必须重新完成两遍有限源头审计且各自不低于 98%；此前子智能体 FAIL 不可冒充放行，修复后必须让只读审查者重审最终工作树。
- V35/V50 源头门已由主 Codex重新执行：正向初跑因只解析功能法案而漏掉基础法案依赖，36/37（97.30%）失败关闭；纳入双法案 corpus 后复跑 37/37（100%）。反向初跑因审计器误用 spec 字段名且未剔除 `lawIds`，20/26（76.92%）失败关闭；按三份真实 spec 结构重算后 26/26（100%），确认只变 law reference，route v4、task-result v17、V6 v44 均未升版。
- `0165_ai_production_public_schema_create_revoke.sql` 首次由原生 runner 执行时因错误限定 `pg_catalog.coalesce` 失败并完整回滚；删除该无效限定后同一迁移成功应用，商业迁移总数 168。迁移只撤销 `public` schema 的 PUBLIC CREATE，并在同一事务读回 PUBLIC 无 CREATE、五角色 CREATE 为假且 USAGE 为真、schema Owner 仍为 `xuanshu_migrate`。
- 独立 Material Blob inspector 现同时读取 0162–0165：0162–0164 各只允许一份 routine 与唯一精确五角色函数 GRANT，任何第二 GRANT、`GRANT ALL`、schema-wide function GRANT、表权限或第二 routine mutation 均失败；0165 禁止 GRANT、CREATE/ALTER routine/table/schema/role。LAW-002-V35 的 `summary` 与 `forbidden:10` 分别获得 lifecycle AST、migration runner 与四份 SQL 的精确 evidence refs，不再用通用 token refs 冒充新义务。
- 受控 PostgreSQL V6 Exam 初跑 79/80：数据库实际 ACL 已精确，但驱动把 `text[]` 返回为字符串导致测试断言类型错误；查询改为显式 JSON 文本并按真实排序解析后完整复跑 80/80。最终动态读回证明函数族只有 exact signature 一项、Owner=`xuanshu_migrate`、SECURITY DEFINER=true、EXECUTE ACL=Owner+五角色；五角色 schema USAGE 全真、CREATE 全假，并精确锁定 Blob/tombstone 八项权限矩阵。
- 第二次独立终审又以 mutation 证明静态检查会漏过 0162/0165 追加 `DROP TABLE`，以及 0163/0164 追加第二个 `DROP FUNCTION`。最终检查把 0162/0165 固定为零 DROP，把 0163/0164 固定为只允许精确一次目标签名 DROP FUNCTION；任何其它 DROP FUNCTION/PROCEDURE/TABLE/SCHEMA/ROLE 均失败。对应表删除、第二函数删除反例已加入 Exam，定向测试、typecheck、code-purity 与 diff check 重新通过。
- 同一轮终审随后证明 0162–0165 仍可能追加表级写入复活或清空退休材料而保持静态 PASS。函数迁移 shape 现只允许唯一一次、唯一目标 `INSERT INTO public.ai_production_material_blobs`，并统一拒绝 `DELETE FROM`、表级 `UPDATE ... SET`、`MERGE INTO`、`TRUNCATE` 与 `COPY ... FROM`；0165 权限迁移连 `INSERT INTO` 也全部拒绝。四份迁移对应 mutation 已加入 Exam，定向测试、typecheck、code-purity 与 diff check 再次通过。该收口只加强现役迁移审计，不改变生产 SQL、角色权限、函数合同或阶级派单主链。
- 终审继续证明 quoted identifier、SQL 注释分隔、`CREATE RULE` 与 `CALL` 等合法语法仍可绕过多词正则。冻结母本 §49 禁止建立第二份文件 hash 清单，因此最终门复用现役 SQL statement splitter 固定每份 migration 的顶层语句序列，再剔除注释与单引号数据后核内部控制词的精确次数；函数迁移只允许既有一份 Blob INSERT 与一处 `FOR UPDATE`，0165 只允许既有 schema REVOKE/读回。quoted、comment-separated、RULE、CALL、MERGE、COPY 等反例均进入 Exam；历史不可变性继续只由原生 migration runner 对生产 ledger name/hash 的 drift 拒绝和 PostgreSQL Exam 的本地字节精确读回证明，不复制 ledger 或文件 hash 清单。
