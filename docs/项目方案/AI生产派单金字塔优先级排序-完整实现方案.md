# AI 生产派单金字塔优先级排序 完整实现方案

## 0. 状态与决策门

**设计阻断（2026-09-22 复审）。** 旧版“可施工”绑定 AGENT `42c047fbb`、Website `780c49490` 与 `LAW-AI-ACCEPTANCE-004-V26`，已失效。现役 Website 法条是 `LAW-AI-ACCEPTANCE-004-V27`，仍禁止越过全局最早 eligible `created_at + job_id`。用户本轮已明确授权**在本方案提出 V28 修订**；这不等于批准实际修改 active law。本轮仅审计和修改方案，不修改法案或生产代码。

施工前须确定三个当前问题：授权人是否批准**实际修改**现役 V27→V28；防饿死等待阈值；目标是 Website **grant 顺序** 还是 AGENT **Browser 实际执行顺序**。现役 N 可为 1..4，AGENT 会并发启动已领取任务，Browser 有自己的 FIFO；单仓 SQL 只能保证前者。未确定时，本文件不能标记“可施工”。

## 1. 需求、Owner、业务终点

- 需求来源为 AGENT 产品运营的五档业务优先级；领取决定的生产 Owner 是 Website `ai-acceptance`。tier 1 支付截图；tier 2 已购买付费产品和报告翻译；tier 3 固定文案；tier 4 SEO/文章翻译；tier 5 其它未映射产品及未来尚不存在的“系统反馈升级”。同 effective tier 内按 `created_at,job_id` 排序；低档等待达到明确阈值后提升为 tier 1。
- 可证领取终点：Website 同一 claim 事务在预期顺序为 job 签发 grant，`ai_production_claim_batch_receipts` 与 `ai_production_job_runtime` 中的 job/attempt/lease 身份一致。任务完成仍须沿现役 result Outbox → Website 领域 admission receipt → 领域对象 readback 闭合。SQL 排序、HTTP 200 或 AGENT 收到 batch 均不足以证明业务完成。
- 不新建 scheduler、队列、priority 列、状态、第二 Owner、Browser lane、兼容桥或跨仓恢复路径。现役设备业务容量 N=1..4 与 Browser 物理 lane=1 是不同约束，不能混写成“N 恰好为 1”。

## 2. 当前候选、权威与证据等级

| 仓库 | 本轮绑定 | 工作树归属 |
|---|---|---|
| AGENT | `/Users/nexgen/Documents/AGENT` `main@a21c9b966a8c19f99e1154453d4f1bf690365d74`，tracking `origin/main` 同 SHA | 方案写前 clean；另有 `docs/项目方案/合婚栏目技能方案.md` 未知改动，不触碰。 |
| Website | `/Users/nexgen/Documents/xuanxue-web` `main@e88cd89e656a6aefe9818303fa4243f069956d96`，tracking `origin/main` 同 SHA | `功能法案.md` 有合婚片区未知改动，目标 004 段未改；`tests/exam/ai-production-v6-contract.test.ts` 有无关 device-status 断言改动；generated registry、hehun 审计和 device-status 源码也脏。施工须逐块保留。 |

权威入口为双仓 AGENTS.md；Website `.github/instructions/agent-rules/功能法案.md` 的 `LAW-AI-ACCEPTANCE-003-V10` 和 `004-V27`；Website `docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md`；AGENT `docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md` 与 `.agents/skills/agent-flow-boundary-gatekeeper/SKILL.md` 的 Owner 表。Website 施工只用 Website 原生 `quality:check` 给质量 verdict。

本轮做了 Git、法案、蓝图、代码和测试的只读复审；没有查询当前生产数据库。旧版的“两小时 Browser 占用”和 Postgres 16.14 实测是历史线索，不当作本轮实测。方案写前 SHA-256 为 `2aa32d43b07e2db3883102c7ae4dbe1d99ec49945ae8ff7ebc4d025297afba70`；方案文档 hash 与 source candidate 分开。

Website 相关 source overlay 的写前 SHA-256：法条 `75935d176f4a5d2fce2ff99c4d28813cf485363f4513ae10b56913e1c0109131`；选择器 `a07cc8c1a13e36783469a4885089e0621ffbdc65493641158e085eb4c82a7693`；领取调用方 `70de3eec34c9af387fb9e0c56de6c2f65a310ea73de979b49e4646f5a2f9fc4f`；ai-acceptance `check.ts` 为 `d217c7d69133efdb4a38378ca881d23b0abd91f65fc80b54c4799bf70485cff0`，`manifest.json` 为 `f9218d74802d28d1174599a9e8f78d54f7ba8454afd8a54872498537b8318dc5`；exam 测试 `e7d07fef3840bf0e4a0d8150ef71896428253b95a00a100af20e702fb11000e1`；localization 静态测试 `1918349ac1c91d3a6006191b51d41e6c2c372bfdb7e0ec1c94277b2c0517f571`。法条与 exam 测试包含前述他人脏改，hash 只标识观察到的叠加，不授予覆盖权限。

## 3. 现役实现与第一直接断裂

Website `services/api/src/ai-production/job-claim-selection.ts:79-137` 的 `selectV6ClaimableJobs` 在单层 `SELECT ... FOR UPDATE OF j,r SKIP LOCKED LIMIT 1` 中，以 `(j.created_at,j.job_id)` 为 keyset cursor 和排序键；每行再经过 route capability 与 material binding 排除。唯一生产调用方 `job-claim-repository.ts:378-456` 根据设备 N、provider 冷却 cohort、session/protocol 决定资格，按返回顺序 `grantJob` 并持久化 claim batch receipt。它由同文件 `:459-475` 的 `withCommercialTransaction` 包住；Postgres `now()` 在该事务内固定。冷却的 `exactJobIds` 是 WHERE 成员边界，排序不能改变成员资格。

AGENT `src/lib/local-runtime/production/runtime-loops.ts:75-139` 会对一次 batch 的 jobs 依数组顺序调用 `executeClaim`，但不等待前一个完成才启动下一个；`worker-session.ts:165-175` 可提出多 job 的 `requested_new_limit`。各 job 在 `runtime-claim.ts:433-474` 还要分别远端状态读回、failure reconciliation、durable accept 与材料下载，之后才进入 Product/Browser；Browser lane 对**实际到达 lane 的请求**保持自己的 FIFO。例如 N=2 时 Website 可按高→低顺序在同批 grant 两个 job；高档 job 材料下载较慢，低档 job 可先到 Browser。故 Website SQL 能控制尚未发放工单的 grant 先后和集合，不控制已发放工单在 AGENT 内的异步耗时，也不能抢回先前已 grant 的低档 job。它不能单独保证 Provider 首次动作、完成或入库顺序。旧版“AGENT 下一步做什么”需要收窄为“下一批优先发给 AGENT 什么”。

**第一直接断裂**：现役 `LAW-AI-ACCEPTANCE-004-V27` forbidden 第 4 项仍禁止优先级越过全局 FIFO；现役查询正符合它。要实现五档越序，须先取得对现役 V27 的单独授权，再精准升 V28；旧版提议的 V26→V27 已被现役版本超越。现役 `scripts/audit/domains/ai-acceptance/check.ts:425`、`manifest.json:9` 和生成 registry 已引用 V27。

有限回归信号：`tests/exam/ai-production-v6-contract.test.ts:1050`、`tests/localization/localization-production-contract.static.test.ts:218-230,402` 均保护全局 FIFO/二元 cursor，原方案遗漏了这两个直接消费者。不能只改 SQL 后删除测试。`dynamic-n-tab-capacity-inspection.ts:106-109` 对 `selectV6ClaimableJobs({ client: input.client,` 有 003 号法条的字面匹配；保留调用点格式可避免无关误报。相关 Git 历史与方案搜索未显示本 GAP 已完成；旧审计结论不能代替现役裁决。

反向搜索还命中 `job-claim-observation.ts:75` 的诊断投影排序和 `job-expired-attempts.ts:30` 的到期处理排序；它们不调用 `selectV6ClaimableJobs`、不签发本次 grant，按本次领取目标保留原职责。若授权目标改为全流程实际动作排序，需重新审计这些消费者及 AGENT Browser FIFO。

## 4. 四维闭环与有限分母

| 维度 | 当前事实 | 目标及直接动作 |
|---|---|---|
| 法案 | 004-V27 禁止全局越序 | 获精准授权后，仅对该句建立 Website 五档静态映射与有界等待例外；其余 forbidden 不变，升 V28、`supersedesLawId=V27`。 |
| 施工图 | Website 拥有 claim eligibility/order/grant；AGENT Browser 拥有自身 FIFO | 若目标仅为 grant 顺序，保持 Owner；若要求 Browser 实际动作顺序，本单仓方案不闭合。 |
| 实现 | 二元 keyset，全局 FIFO | 在现有选择器原位形成一个静态 tier 表达式，并把 cursor 与 ORDER BY 同步变三元组。 |
| 质检 | V27 审计、两处旧 FIFO 测试 | 同步法条引用，修订保护性测试，新增行为验收；保持唯一质量 verdict。 |

Identity spine 是 `job_id + product_id`，grant 后再绑定 `worker_session_id,request_id,claim_batch_id,attempt_id,lease_version`。目标链：权威 eligible 集合和 cohort 过滤 → effective tier → 三元 keyset → route/material 排除 → grant/lease → claim batch receipt → AGENT 消费 → 原领域 admission/readback。`product_id` 只决定选择顺序，不改变 job/attempt 身份。

| 有限分支 | 唯一 Owner 与决定 | 终态、恢复与读回 |
|---|---|---|
| 命中映射；未命中映射 | Website 静态赋档；未命中为 5，不拒绝 job | 同档 FIFO 后进入 grant 候选；收据与 runtime 读回。 |
| 创建时间年龄达到阈值 | 同一 Owner 将 effective tier 提升为 1，仍按 tier 1 内 FIFO | 后续 grant/readback；年龄语义明确为 job 创建时间，不是假称首次 eligible 时间。 |
| 冷却 cohort、device、retry/lease、route、material 排除 | 复用现役 WHERE 与排除判断，排序只在准入集合内 | 现役 blocked、DRAINING、NO_ELIGIBLE_JOB 或后续原链恢复；不建新状态。 |
| recoverable/new 容量、并发行锁与游标结束 | 复用两个限额、`grantJob`、`SKIP LOCKED`；三元 cursor 不遗漏候选 | 同 attempt regrant 或合法新 attempt；receipt/runtime 同身份读回；被锁行留给后续 claim。 |

## 5. 原子工单：解除阻断后施工

### 工单 1：现役法案精准升版

- Owner/路径：Website `ai-acceptance`；`.github/instructions/agent-rules/功能法案.md` 004-V27 区块、原生 generated registry。前置为用户对 **实际修改 V27→V28** 的精准授权以及唯一阈值；重读目标段并保留同文件合婚脏改。
- 本轮已授权的 **V28 提案** 只替换现役 V27 forbidden 第 4 项。原文为：“不得先发 lease 再用 Browser 缺失回滚，不得以 service class、recovery partition、fairness、aging、registration order 或内存顺序越过全局最早 eligible created_at + job_id。”拟替换为：“不得先发 lease 再用 Browser 缺失回滚。只有 Website ai-acceptance 在现役唯一 claim 选择器内，按预先声明的静态 product_id→1..5 档映射与创建后等待满 **[授权的阈值分钟数]** 时升为第 1 档的规则，才可越过全局最早 eligible created_at + job_id；第 1 档优先级最高、未命中映射为第 5 档，同 effective tier 内必须按 created_at + job_id 最早优先。不得以其它 service class、recovery partition、fairness、aging、registration order 或内存顺序越过该顺序；映射不得携带外部调用、额外持久状态或独立调度 Owner。”方括号必须在法条落地前替换为唯一批准的数值，不可带占位符施工。
- 保留“不得先发 lease 再以 Browser 缺失回滚”。仅允许 Website 按有界、预声明的 product_id 1..5 档和唯一正有限等待阈值算 effective tier；1 最高、未命中 5、达到阈值升 1，同档仍按 `created_at,job_id`。其它 service class、recovery、fairness、内存顺序不得越序。映射无外部调用、额外状态或运行时业务判定。
- 修改 `lawId`、`supersedesLawId`、summary、引用和 registry；不改 003 号法条。新法条与实际授权逐项吻合并通过原生法案 schema/registry 校验才完成。现役版本再漂移就停止重绑定。

### 工单 2：原位排序与直接测试

- Owner/路径：Website `ai-acceptance`；`services/api/src/ai-production/job-claim-selection.ts`、`tests/exam/ai-production-v6-contract.test.ts`、`tests/localization/localization-production-contract.static.test.ts`。exam 文件已有未知无关脏改，只能改本任务的旧 FIFO 片区。
- 精确映射：tier 1 `payment_screenshot_observation`；tier 2 `bazi_ai_full_analysis`, `bazi_chart_interpretation`, `bazi_report_followup`, `hehun_ai_analysis`, `hehun_report_followup`, `naming_bazi_analysis_and_naming`, `naming_from_existing_bazi_report`, `qimen_professional_answer`, `qimen_report_followup`, `localization_report_translation`；tier 3 `localization_static_catalog`；tier 4 `localization_article_translation`, `public_knowledge_article_pipeline`；其它为 tier 5。施工前核对 `websiteAgentProductActions` 活跃集合，不为未来产品造 ID。
- 同文件建立一份静态 SQL `CASE j.product_id ... ELSE 5 END` 源表达式，再结合 `j.created_at` 和事务固定 `now()` 计算 effective tier，供 WHERE 三元 cursor 和 ORDER BY 两处使用；避免在源码手写两套不同映射。增加 `cursorTier`，比较 `(effective_tier,j.created_at,j.job_id)` 与排序完全同构。保持函数签名和唯一调用点格式，不为阈值新增运行时配置或持久化列。
- 保持单层 SELECT 的 `FOR UPDATE OF j,r SKIP LOCKED LIMIT 1`；不得把锁下放至先扫描全量候选的 CTE。保留全部资格条件、`exactJobIds`、route/material 跳过、recoverable/new 限额及事务边界。
- 验收覆盖五档、默认档、阈值前/等于/后、同档平局、三元游标跨页及 capability/material 跳过、混合 tier 的冷却 cohort、recoverable/new 限额、并发实际行锁、grant/receipt 同身份读回。把两处旧 FIFO 静态测试替换成新合同的正反断言，保留其它保护。在可比数据量下对照新旧 SQL 计划与延迟；显著退化则回设计，不臆断现役索引。

### 工单 3：唯一质量证据同步

- Owner/路径：Website `scripts/audit/domains/ai-acceptance/check.ts`、`manifest.json`、本域实际消费 V27 的辅助检查；generated registry 只经原生生成流程。核对 003 号 `dynamic-n-tab-capacity-inspection.ts` 的调用点字面绑定，保留其业务语义。
- 审计对 tier 范围、活跃 product_id 子集、默认档、**与法条批准的唯一数值相等**且为正有限值的阈值、同档 FIFO、三元 cursor/ORDER BY、唯一 Owner 给出可失败证据。阈值是硬编码常量，不新增第二个可配置“上限”。旧 V27 引用和旧全局 FIFO 期待零残留。使用 Website 唯一 `quality:check` 的适用 CHANGE/READY 入口；READY 还需原生 clean Git commit，不能由直接运行 `scripts/audit` 代替。

工单 1→2→3 在同一 Website 候选中闭合，然后按现役质量和部署流程验证。不得出现代码已经越序而 active law 仍禁止的可交付候选。失败回退须把代码、法条、审计视为同一版本组；已有 grant/attempt/receipt 是现实持久事实，不可称回退“零副作用”或重放未知 Provider 效果。

## 6. 删除反事实、分层验收与放行门

删除 tier 会退回全局 FIFO，违背本次优先级需求；删除等待回退会使持续到达的高档工单造成无界等待；删除三元 cursor 会遗漏或重复候选；保留旧 FIFO 测试期待会让新合同无法通过现役质量。三者均可在现有 Owner 的选择器内完成，不需要额外 scheduler、存储、Agent 代码或第二质检入口。

设计阶段只证明断裂、合同、工单和未来验收位置。施工后静态检查与行为测试证明实现；CHANGE/READY 由 Website 原生 `quality:check` 裁决；RELEASE 还须 active law 的 Dynamic Proof；真实 claim receipt 与 runtime/领域对象 readback 才证明目标业务事实。任何下层证据不能提升为上层 PASS。

放行前同时满足：授权人确认目标层、实际修改 V27 的精准授权和唯一阈值；重新绑定双仓 HEAD、tracking、法条/代码/测试脏叠加；核对活跃 product_id 与 law registry；工单能抵达相同身份的 receipt/readback；旧 FIFO/V27 引用零残留；无未决 Owner、测试或部署矛盾。未满足时保持“设计阻断”，不能继承旧版三轮独立审计的放行。
