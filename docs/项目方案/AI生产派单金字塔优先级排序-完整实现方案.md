# AI 生产派单金字塔优先级排序 完整实现方案

## 0. 状态与授权边界

**已获完整施工授权，代码与质检已完成定向验证（2026-10-09）。** 用户已明确目标语义：五个阶级永久固定，低层工单没有等待晋级、aging 或防饿死通道；只要全局仍存在更高阶级的未完成工单，任何较低阶级工单都不得取得**新开始授权**。用户已明确授权修改法案、施工图、代码、质检系统与数据库操作，并要求先完成双仓法案/施工图全量遍历、两遍主 AI 审计和不低于 98% 的有限清单核验，未过门前禁止进入代码施工。权威阶段两轮分别达到 55/55 与 60/60；最新稳定修复候选的主 AI 正向与反向复审分别达到 61/61 与 55/55，现重新进入最终第三方只读审计门，尚不得把定向测试称为 READY 或 RELEASE。

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
| AGENT | `/Users/nexgen/Documents/AGENT`, `main@54fad8ebefb6f87f85861589f5562751a68a0b96`，tracking `origin/main` 同 SHA | 本方案写前 clean；写前 SHA-256 `d650934df367c9fac1c08c93f4d98c67055fd3a95fc39892bd36abd455dea004`。 |
| Website | `/Users/nexgen/Documents/xuanxue-web`, `main@cf6853ba9566dbd270acbdf49fa7b8f6f470eab2`，tracking `origin/main@d3e08f311cb970d90435de50d8193b34ed882fb4`，本地 ahead 6 | 存在与本任务无关的 `docs/项目方案/全球付款-完整实现方案.md` 既有修改；本轮始终保留，不覆盖、不提交、不隐藏。施工不得把本地 ahead 提交误当作已进入远端。 |

现役权威为双仓 `AGENTS.md`；Website `.github/instructions/agent-rules/功能法案.md` 的 `LAW-AI-ACCEPTANCE-003-V10` 以及本轮续升的 `004-V31`、`012-V41`、`013-V25`、`LAW-PUBLIC-KNOWLEDGE-CONTENT-005-V41`；Website `docs/blueprints/SYSTEM-BLUEPRINT.md` 与 `docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md` V47；AGENT `docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md` V65 与 `.agents/skills/agent-flow-boundary-gatekeeper/SKILL.md` 的 Owner 边界。Website 唯一质量入口为 `npm run quality:check -- <LEVEL>`。

Website 相关 source 写前 SHA-256：法条 `a4556cebadb3416483971e90fffeacddadc6f002799eb206e0bb25bc3680c7bc`；选择器 `3b8c3d6a49d109a4cabef35d94a28f2fedeb514a90dde64cd02a45fe390ad27b`；领取调用方 `c52b261e3198072dd0fa628e3308fbce7482c3b881cab8265a61807baa3bad92`；ai-acceptance `check.ts` 为 `91498d02f169624f5fe04f5bf36158c98957859ad78cc02277a08ecb33318943`，`manifest.json` 为 `0d736d3cf409744a6ac0fe27dbe23c01337241cf6cc97124a1c48756d3abebb5`；exam 测试 `237b4b0c112c668881c578df612e146556d820a93f99c51afa23087940e5fdcf`；localization 静态测试 `125671cefdf692b107c2ce11e146a67509a1daa43451e5768c896a662ae85623`。施工前重算；任一相关事实漂移只重审受影响部分。

## 3. 现役链与第一直接断裂

`services/api/src/ai-production/job-claim-selection.ts::selectV6ClaimableJobs/readNextV6ClaimCandidate` 当前只对本次可领取集合按 `(created_at,job_id)` 遍历。它把 retry、lease、device、cooldown cohort、route capability、material、terminal 与 recovery 条件应用在候选资格上；只改成 `ORDER BY tier` 会在高层 job 暂时不合资格时继续向低层发 grant，违反固定阶级。

`job-claim-repository.ts::executeClaimTransaction` 已通过 `ai_production_control_protocol_state(singleton=true) FOR UPDATE` 串行 claim 事务；可复用该行作为新任务创建与 fresh grant 的线性化点。`website-agent-task-repository.ts::createWebsiteAgentTaskWithClient` 当前创建 job 时未取得这把锁。如果高层创建与低层 claim 并发，仅在选择 SQL 增加 tier 条件仍存在穿透窗口：低层事务可能先看不到尚未提交的高层 job。

现役 `business-result-domain-dispatch.ts::finalizeConsumptionWithClient` 在领域消费成功后原子写 `status='completed'`、`business_consumed_at`、消费 hash 与领域事实，是解除阶级门的权威事实。terminal completed 但尚未领域消费的 job 仍必须阻断低层。

写前现役 V30 forbidden 第 4 项和全局 FIFO 测试保护旧语义。第一遍依赖审计证明，修改 004 的语义会使直接依赖它的 `012-V40`、`013-V24`、`LAW-PUBLIC-KNOWLEDGE-CONTENT-005-V40` 发生 dependency obligation 变化；按冻结母本不能只升 004，必须将四条原子续升为 `004-V31`、`012-V41`、`013-V25`、`PUBLIC-KNOWLEDGE-CONTENT-005-V41`，后三条只更新依赖引用和 supersedes，不扩张正文语义。现役 AGENT 只消费 Website 签发的 grant，不需要理解产品阶级；Browser FIFO、Product Plugin 与 Runtime 不取得 priority Owner。

## 4. 唯一目标链与有限分母

1. 所有创建 V6 job 的现役入口在插入新 job/runtime 前取得现役 control protocol singleton 行锁；claim 已取得同一锁。锁的先后次序定义事实：高层创建先提交则低层不能 grant；低层 grant 先提交则其发生在高层 job 存在之前，后到高层只阻断后续低层 fresh grant。
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
- V31 对现役 forbidden 第 4 项的精确替换为：“不得先发 lease 再用 Browser 缺失回滚；不得在全局仍存在更高固定阶级未完成 V6 job 时，为低阶 job 签发 fresh attempt/grant。固定阶级只能由 Website ai-acceptance 的唯一静态 product_id→1..5 映射决定，未命中固定为第 5 阶；只有领域接纳闭包已持久完成或现役永久终止 authority 已物理删除的 job 才离开未完成分母。等待时长、aging、registration order、retry、device、capability、material、cooldown、动态权重或低层保底容量均不得改变阶级或允许跨阶补位；同一开放阶级内 fresh grant 仍按最早 eligible created_at + job_id。已 durable accept 的原 attempt 恢复、同 effect 读回、staged result 交付与领域接纳不是 fresh grant，不得被后到高阶 job 阻断。”
- V31 必须明确：静态 1..5 阶级；全局未完成最小 tier 是 fresh grant 唯一开放 tier；任一高层未完成时低层 fresh grant 为零；禁止 aging、晋级、动态权重、低层保底与容量补位；已 durable accept 的原 attempt 仍可恢复和接纳；完成只认 admission 闭包或现役永久 authority 的物理删除。
- 同步 Website `AI-ACCEPTANCE-BLUEPRINT.md` V47、`SYSTEM-BLUEPRINT.md` 与 AGENT Runtime Blueprint V65 的 claim/order 导航，保持 Website `ai-acceptance` 为唯一 Owner；不修改 AGENT Browser FIFO、Product Owner 或跨仓 wire。

### 工单 2｜创建与领取的单锁线性化

- 在 `website-agent-task-repository.ts::createWebsiteAgentTaskWithClient` 新 job 分支复用 `ai_production_control_protocol_state` singleton 行锁；所有现役 task 创建调用继续复用该唯一函数。幂等读回已有 job 不制造新需求，不需要改变返回合同；不得借本次锁改动新增现役创建合同没有要求的 admission 判定。
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
- 数据库 Exam 覆盖：每层单独、跨层、开放层暂不可领、terminal 待 admission、完成后逐层开放、同层 FIFO、N>1 不跨层补位、低层旧 attempt 在高层出现后继续收尾、冷却 cohort、source evidence、并发创建/claim 两种锁顺序、未知 product 默认 Tier 5。
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
- `website-agent-task-repository.ts` 的新建分支与 claim 复用同一 control singleton 行锁；未新增表、列、迁移、队列、服务、跨仓字段、兼容桥或第二链。
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
