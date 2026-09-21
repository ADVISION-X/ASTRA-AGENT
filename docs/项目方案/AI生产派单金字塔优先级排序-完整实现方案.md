# AI 生产派单金字塔优先级排序 完整实现方案

## 0. 方案状态

**可施工。** 经三轮完全独立的 adversarial 子智能体审计（第一轮发现 1 个阻断项 + 4 处遗漏；第二轮用真实 Postgres 16.14 实例实测校正技术理由 + 发现法条数值歧义、引用行号错误、Website 仓库持续漂移未被追踪；第三轮逐条复核全部修订已准确落地，并确认 Website 仓库虽又漂移一次但与本方案目标文件无交集）迭代后放行。施工前仍须按 §11 重新核对当时的仓库 HEAD 与法条版本，不得沿用本文档任何历史绑定值。

本方案只覆盖设计与法条修改文字提案，不包含生产代码落地。用户已明确批准的法条修改范围见 §3.1；实际修改 `.github/instructions/agent-rules/功能法案.md`、`scripts/audit/domains/ai-acceptance/**` 与 `services/api/src/ai-production/job-claim-selection.ts` 属于后续独立施工阶段，由执行 Claude 重新绑定权限后进行（见 §10）。

## 1. 需求、终点与范围

**需求 Owner**：AGENT（`/Users/nexgen/Documents/AGENT`）——AGENT 是 GPT Browser 自动化产能的持有方，当前单 Browser lane（N=1）产能有限（"N3" 阶段），需要在有限产能下按业务轻重缓急决定哪个已存在的 Website AI 生产工单被优先领取执行。

**终点**：Website `ai-acceptance` 的 job-claim 领取顺序从纯 `created_at,job_id` 全局 FIFO，改为"5 层 product_id 静态优先级 → 同层内仍严格 `created_at,job_id` FIFO"，并带有界防饿死回退，使低优先级工单不会被无限期垫底。

**范围**：

- 修改 Website `services/api/src/ai-production/job-claim-selection.ts` 的 `selectV6ClaimableJobs` 领取排序 SQL；
- 修改 Website 现役法条 `LAW-AI-ACCEPTANCE-004-V26` 中禁止"越过全局最早 eligible"的一句，收窄为"仅允许有界 5 层静态映射表越序，且必须带防饿死回退"；
- 相应更新 Website `scripts/audit/domains/ai-acceptance/**` 对该法条的机械核验证据点。

**明确非目标**：

- 不新增 Browser 第二 lane 或扩大设备容量 N（已被 `LAW-AI-ACCEPTANCE-003-V10` 钉死为恰好 1，且用户已声明 AGENT 侧基础设施禁止迭代）；
- 不为尚未建设的"系统反馈升级"产品新建 Plugin 或 product_id，只在优先级映射表里预留第 5 层默认位；
- 不改变已入库工单的业务合同、结果 schema、Provider 交互流程；
- 不在 AGENT 侧新增或修改任何代码（见 §5 现役实现重建的结论）。

## 2. 输入证据

- 本轮会话内对 Website `ai_production_jobs`/`ai_production_job_runtime` 的多次直接 Postgres 查询（只读），确认当前领取行为是纯 `created_at,job_id` 顺序，且固定文案（`localization_static_catalog`）曾在单次运行中连续占满 AGENT 唯一 Browser lane 近 2 小时，同批次内先创建的 zh-HK 根工单未耗尽前，后创建的 zh-TW 后继工单从未被领取——即 FIFO 顺序下，一个"低层级"产品的存量任务可以让同一时间窗口内本应更紧急的工单完全排不上号（本会话对话记录，非本方案新增证据）。
- 用户口述确认的 5 层业务优先级（本轮消息原文）：支付截图观察 → 已购买付费产品（含报告翻译）→ 固定文案翻译 → SEO/SEO 文章翻译 → 未建设的系统反馈升级。
- 用户明确批准修改 `LAW-AI-ACCEPTANCE-004-V26` 的精确范围（本轮消息原文，见 §3.1 引用）。
- 用户明确约束：AGENT 侧基础设施（Runtime/Mediator/GPT capability/Browser）禁止任何迭代，只能迭代 AGENT 侧的 Product Plugin/SKILL.md（技能）与合同；Browser 物理 lane 恰好为 1，不可扩容。

## 3. Scoped Candidate 绑定

| 仓库 | realpath | branch | HEAD | 说明 |
|---|---|---|---|---|
| AGENT | `/Users/nexgen/Documents/AGENT` | `main` | 初始绑定 `af9883f66`，独立审计期间已漂移至 `42c047fbb`（新增提交"fix localization context bundle identity"，改动 `static-catalog-flow.ts`/`localization-production.acceptance.ts`，已核实只修复 `context_bundle_hash` 回传，与本方案无关，见 §5.2） | 存在 3 个与本方案无关的 dirty 文件（GPT 频率限制排空冷却文档、localization-production 验收脚本、static-catalog-flow.ts），均属本会话早前"100% 提示词正确性"审计涉及的既有改动，不在本方案候选范围内，只记录不处理。施工前须按 §11 再次核对 HEAD 是否进一步漂移。 |
| Website | `/Users/nexgen/Documents/xuanxue-web` | `main` | **持续漂移中**，初始绑定 `15cd2e289`，两轮独立审计期间已连续观测到 4 次新提交：`68c88790f`（重构固定文案生产收尾）、`c5ea6d9ea`（移除无关首页设计草稿）、`47c38bc68`/`780c49490`（geo 坐标法条证据范围修复），当前实测 HEAD 为 `780c4949090a32f9ef1b116beb6e937e2900b234`。**已逐次 `git diff` 核实：全部 4 次漂移均不涉及 `LAW-AI-ACCEPTANCE-004`、`job-claim-selection.ts`、`job-claim-repository.ts`、`dynamic-n-tab-capacity-inspection.ts`**，与本方案改动区域无交集，判定为无害漂移。Website 仓库在本方案设计周期内明显有其它并行工作在持续提交（`geo-location-core`、固定文案生产触发重构等），**这是一个活跃变化中的仓库，不是一次性快照**——按 §11 要求，施工前必须重新核对 HEAD 与目标文件的 `git diff`，不得沿用本表任何历史 HEAD 值做施工依据；本表只作候选漂移的记录留痕，不作为施工时点的权威状态。 |

**相关现役权威绑定**：

- `LAW-AI-ACCEPTANCE-004-V26`（Website `功能法案.md` 第 375 行区块，`appliesTo` 含 `services/api/src/ai-production/**`，`tier: P0`，`status: active`，`dependsOnLawIds: []`）——本方案唯一需要修改文字的法条。
- `LAW-AI-ACCEPTANCE-003-V10`（同文件，紧邻上一条法条）——"Browser 物理 lane 始终恰好最多为 1，不得以业务容量 N 扩张"，本方案不修改，只作为"第二 lane 方案不可行"的排除证据引用。
- AGENT `docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md`（281 行）——通读全文，"FIFO"字样出现 2 处（第 69、212 行，第二轮独立审计校正原计数误差），均描述 Browser 物理 lane/observation 轮询节奏，不描述 job-claim SQL 领取顺序；本方案改动内容未被该蓝图记述，属于"不存在且当前项目不需要"，不需要修改蓝图。
- Website `docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md`——同上，"FIFO"仅描述 Browser 侧；此文件当前处于 dirty 状态（4 行改动），已核实与本方案无关。
- AGENT `agent-flow-boundary-gatekeeper` skill 基线表（Website 侧）——"V6 控制面与未完成公开状态"一行明确把"claim eligibility 与顺序"列为 `ai-acceptance` 已拥有的职责；本方案改动落在这条既有 Owner 边界内部，不新增 Owner、不产生跨 Owner 越权。
- 同一 skill 的"完成后删除式反查"红旗列表明确点名"中央 Scheduler、Traffic Arbiter、**Product priority/weight**、recovery queue/bypass 或第二 Browser lane"为可疑模式，以及"Browser FIFO 取得 Product priority"为违规模式——本方案的存在性审判（§8）与设计选型（§6）均针对这条红旗逐一给出证据，且明确不在 Browser FIFO 层引入 priority。

## 4. 用户授权的法条修改范围（precise text proposal）

用户本轮批准的精确修改范围，原文引用如下（不在本方案阶段落地，只作为后续施工的文字提案）：

> 原文（`LAW-AI-ACCEPTANCE-004-V26` forbidden 数组第 4 条）：
> "不得先发 lease 再用 Browser 缺失回滚，不得以 service class、recovery partition、fairness、aging、registration order 或内存顺序越过全局最早 eligible created_at + job_id。"
>
> 拟改为：
> "不得先发 lease 再用 Browser 缺失回滚；除按 Website 唯一现役静态 dispatch tier 映射表（有限、预先声明、逐 product_id 赋值到 1–5 档，数值越小业务优先级越高，未命中默认赋值为数值最大的第 5 档即最低优先级）与该映射表内置的有界等待时长防饿死回退计算出的 effective tier 外，不得以 service class、recovery partition、fairness、aging、registration order 或内存顺序越过同 effective tier 内最早 eligible created_at + job_id；等待超过阈值的工单，其 effective tier 视为映射表内数值最小、即业务优先级最高的第 1 档，仍与该档内其余候选一并按 created_at + job_id 排序，不取得脱离 tier 机制、单独越过同档更早候选的资格；dispatch tier 映射表只能声明式列出已存在的 product_id 到 1–5 档的赋值，不得携带业务判断、外部调用或运行时状态。"

**（第二轮独立审计问题 2 修复）** 法条正文本身现已明确"数值越小优先级越高，第 1 档为最高优先级"，不再依赖本方案设计文档（§7）做外部消歧——未来只读法条原文的人（不参照本方案）也能得到唯一、无歧义的理解。

修改要点：

1. 保留原句"不得先发 lease 再用 Browser 缺失回滚"不变；
2. 把"越过全局最早 eligible"改为"除 tier+防饿死 外，越过同 tier 内最早 eligible"——即把 FIFO 的适用范围从"全局"收窄到"同一优先级档位内"，不是取消 FIFO；
3. 明确防饿死回退是映射表的强制内置部分，不是可选项；
4. 明确映射表是"声明式静态表"，杜绝以后被扩展成动态权重、业务判断或第二调度器（呼应 agent-flow-boundary-gatekeeper 的红旗）；
5. **（独立审计问题 6 修复）** 明确防饿死回退的效果是"effective tier 提升为最高档，仍按同档内 created_at+job_id 排序"，不是"直接强制领取/跳过 tier 机制"——原措辞"强制并入领取"容易被脱离 §7 设计表单独理解为第二种越序机制，现已改为与 §7"忽略原 tier，effective_tier 强制为 1"的实现语义逐字一致，避免法条正文与实际实现出现两套互相矛盾的解释。

`supersedesLawId` 应在实际施工时指向 `LAW-AI-ACCEPTANCE-004-V26`，新版本号为 `LAW-AI-ACCEPTANCE-004-V27`。

## 5. 现役实现重建（深度）

选择**深度**：本次改动更改现役 P0 法条的 forbidden 文字（canonical authority 变更），且该法条约束的是全部 AI 生产工单共用的领取主干（`ai-acceptance` claim selection），影响面覆盖 Website 全部 14 个 product_id、AGENT 全部 12 个 Product Plugin，满足深度触发条件。

### 5.1 Website 侧真实调用链

- 唯一 SQL 入口：`services/api/src/ai-production/job-claim-selection.ts:79` `selectV6ClaimableJobs`。全仓唯一调用方：`services/api/src/ai-production/job-claim-repository.ts:394` 的 `selectAndGrantClaimJobs`（已 grep 确认无第二调用方）。
- 排序键：SQL `order by j.created_at,j.job_id`；分页游标：`(j.created_at,j.job_id)>($2::timestamptz,$3::text)`，与排序键严格同构，这是 keyset pagination 的正确性前提——**本方案改排序键后，游标比较元组必须同步改成三元组 `(effective_tier,created_at,job_id)`，否则会产生跳过或重复领取，这是施工阶段的强制验收项，不是可选优化**。
- **（独立审计问题 1 修复；行号引用已在第二轮独立审计中校正）** `selectV6ClaimableJobs` 的调用点文本本身同时是另一条无关法条的机械核验对象：`scripts/audit/domains/ai-acceptance/dynamic-n-tab-capacity-inspection.ts:106-109` 对调用点做字面文本匹配 `claim.includes('selectV6ClaimableJobs({ client: input.client,')`（该断言函数名为 `oneExecutionTopologyValid`），实际绑定 `lawId: 'LAW-AI-ACCEPTANCE-003-V10'` 的引用点在 **`dynamic-n-tab-capacity-inspection.ts:175-176`**，与本方案要改的 `LAW-AI-ACCEPTANCE-004` 完全无关业务语义，纯粹是巧合的文本耦合。施工时若改写调用点的对象字面量格式（哪怕只是重排/换行、逻辑不变），会导致一条与本次改动毫无业务关系的 003 号法条审计误报失败。**因此工单2 的完成门槛必须新增一条：调用点字面文本 `selectV6ClaimableJobs({ client: input.client,` 保持逐字不变；若因实现需要必须改动该行格式，须同步核实并按需调整 `dynamic-n-tab-capacity-inspection.ts` 对 003 号法条的静态核验，不得误判为"003 号法条被违反"后反向去改动与本次需求无关的 003 号法条内容。**
- **（第二轮独立审计问题 3 修复：锁死前提，防止两条新约束互相矛盾）** "调用点字面文本不变"与"tier 表达式三处逐字内联"这两条约束分别作用于两个不同文件（调用点在 `job-claim-repository.ts:394`；tier 表达式内联在 `job-claim-selection.ts` 的 SQL 字符串内部），只要 dispatch tier 映射表与防饿死阈值都做成 `job-claim-selection.ts` 同文件内的硬编码常量、**不改变 `selectV6ClaimableJobs` 的函数签名**（不得为了可测试性把阈值/映射表改成函数入参），两条约束天然不冲突。**本方案明确要求：映射表与阈值必须是 `job-claim-selection.ts` 文件内的硬编码常量，不得成为 `selectV6ClaimableJobs` 或 `selectAndGrantClaimJobs` 的函数参数**，这一前提是工单2 完成门槛的强制组成部分，不是可选的实现偏好。
- 调用方 `selectAndGrantClaimJobs`（`job-claim-repository.ts:378-405`）只是按 `selected` 数组顺序逐行调用 `grantJob`，不对顺序做任何语义解释、不缓存、不重排——确认调用方零耦合，只需要"给我下一批可领取的行"，不关心其排序依据。
- `newLimit` 来自 `v6NewGrantCapacity`（受设备容量 N 约束，稳态下 N=1，即每次事务通常只授予 1 个新工单），`recoverableLimit` 固定为 `XUANXUE_AI_PRODUCTION_V6_MAX_BUSINESS_IN_FLIGHT + 1`——确认稳态下"下一个被领取的工单"就是全局排序第一名，priority 改动直接决定"AGENT 下一步做什么"，不是无关紧要的次要优化。
- 表结构：`ai_production_jobs`（`data/migrations/commercial/0032_ai_production_factory.sql`）与 `ai_production_job_runtime`（`0054_database_recovery_runtime_control.sql`）均无 priority/tier/weight/rank 字段，历史 migration 中也未曾添加又废弃过同类字段（已对全部相关 `alter table` 语句复核）；`commercial_price_rules.fallback_priority` 与 `ai_production_scheduler_state`（用于 quality-reflection 调度计数器）均是不同领域的正交字段，与本方案无关，不得复用或混淆。

### 5.2 AGENT 侧真实调用链

- AGENT 侧无任何代码依赖或假设 Website 领取顺序：`grep` AGENT 全部 `local-runtime/production/*.ts` 中的 `created_at` 使用，命中的全部是 AGENT 自己的本地 `production_tasks`/`production_outbox` SQLite 表排序（`store-ledger.ts:113`、`store-outbox.ts` 多处），这是 AGENT 自己的本地 Outbox 投递 FIFO，与 Website 决定"先把哪个工单交给 AGENT"是两件完全正交的事，互不影响、互不依赖。
- AGENT 的 claim 消费路径（`agent-production-runtime` Owner）只是"请求并验证 Website session/claim/grant/lease/fence，消费 Website 已签发的 attempt identity"（引自 agent-flow-boundary-gatekeeper 基线表），对拿到的工单内容一视同仁地执行，不解释、不依赖其抵达顺序。
- **（独立审计问题 4 修复：证据归属更正）** Product Plugin（如 `localization-production`）的 `provider_continuation` 续接链靠的是 `parent_task_ref` + `required_device_id` 精确绑定，不靠也不能靠 claim 到达顺序维持正确性——这条证据来自 **Website 侧** `services/api/src/localization/localization-static-catalog-command.ts:229` 的 `ensureStaticCatalogSuccessorWithClient`（该函数不在 AGENT 仓库，此处更正此前版本的归属错误），它显式用 `parent.job_id`/`owner.lease_owner` 传递续接身份，与 created_at 无关。作为 Website 侧证据，它同样支撑"续接正确性不依赖领取顺序"这一结论，且比 AGENT 侧证据更直接——续接链的锚点本来就由 Website 单方面签发，AGENT 只是被动读取。
- **（独立审计问题 4 修复：candidate 漂移重新核实）** 本节撰写后 AGENT 仓库 HEAD 已从 §3 绑定的 `af9883f66` 漂移到 `42c047fbb`（新增提交"fix localization context bundle identity"），且该提交改动了 `static-catalog-flow.ts` 与 `localization-production.acceptance.ts`——与本节引用同一产品线。已重新 `git diff` 核实：该提交只修复 `context_bundle_hash` 回传，不引入或依赖任何 claim 顺序假设，"AGENT 侧零改动"结论不受影响。按 agent-flow-boundary-gatekeeper 关于 candidate 漂移必须重新绑定的要求，此次漂移已记录并核实完毕；施工阶段（§11）仍须在动手前再次核对 HEAD 是否进一步漂移。

**结论：本方案在 AGENT 侧没有任何需要修改的代码、Product Plugin、SKILL.md 或合同。** 用户"AGENT 侧只能迭代技能和合同"的约束因此被自动满足（因为压根不需要 AGENT 侧改动），不是勉强绕过；这也符合用户"防止过度设计"的全局要求——不为了显得完整而在 AGENT 侧顺手加东西。

### 5.3 同类既有方案检查

检索 `docs/项目方案/` 下现役方案文件，未发现任何已存在、未完成、同 GAP 的派单优先级方案；本会话早前产生的三份方案（GPT 父会话多 attempt 消歧、多 attempt 存量数据清退、GPT 频率限制排空冷却）分别处理"结果回执/清理"与"限流冷却"，与"领取顺序"是不同的 GAP，不构成竞争方案，无需合并。

## 6. 四维闭环映射

| 维度 | 现状 | 目标 | GAP |
|---|---|---|---|
| 法案系统 | `LAW-AI-ACCEPTANCE-004-V26` 禁止一切基于 service class 的越序 | 允许有界、声明式、带防饿死的 5 档越序 | 见 §4 精确文字提案（设计阻断已解除：用户已批准，见 §3.1） |
| 施工图 | 两仓相关蓝图均未描述 job-claim SQL 排序（只描述 Browser lane FIFO） | 维持不变；本方案改动的是法条与代码，不是蓝图描述的架构图 | 不存在且当前项目不需要——蓝图无需修改 |
| 现役实现 | `selectV6ClaimableJobs` 纯二元排序键 `(created_at,job_id)` | 三元排序键 `(effective_tier,created_at,job_id)`，`effective_tier` 由静态 product_id 映射 + 有界等待防饿死回退计算 | 见 §7 唯一目标链 |
| 质检系统 | `scripts/audit/domains/ai-acceptance/check.ts` 对 `LAW-AI-ACCEPTANCE-004-V26` 的机械核验证据点绑定的是旧版 `lawId`/旧禁止文字 | 证据点同步指向新版 `LAW-AI-ACCEPTANCE-004-V27` 与新增的"防饿死回退存在性"静态核验 | 见 §7 工单 4 |

## 7. Identity Spine 与有限分母

**Identity spine**：`product_id`（Website `ai_production_jobs.product_id`，AGENT `ProductionProductId` 类型，两仓共享同一枚举值集合，已在 §5.1/5.2 确认无第二定义）。

**有限分母**（领取查询的每一行候选，在新排序逻辑下的分支）：

| 分支 | Owner | 权威输入 | 决定 | 权威输出 | consumer | 终态 |
|---|---|---|---|---|---|---|
| product_id 命中映射表 1–5 档任一档 | `ai-acceptance`（`job-claim-selection.ts`） | `ai_production_jobs.product_id` | 赋值对应 tier | `effective_tier` 整数 | 同一查询的 `ORDER BY`/游标比较 | 参与排序 |
| product_id 未命中映射表（含未来"系统反馈升级"上线前） | 同上 | 同上 | 默认赋值 tier 5（最低档，不新建默认值以外的行为） | `effective_tier=5` | 同上 | 参与排序，不阻断领取 |
| 任一候选等待时长超过防饿死阈值 | 同上 | `now() - j.created_at` | 忽略原 tier，`effective_tier` 强制为 1 | `effective_tier=1` | 同上 | 参与排序，防止永久垫底 |
| 全部候选排序完成后 | 同上 | 已计算的 `effective_tier` | `ORDER BY effective_tier,created_at,job_id LIMIT 1` | 单行 `V6ClaimableJobRow` | `selectAndGrantClaimJobs` → `grantJob` | 沿用现役 grant/lease 流程，不变 |

分母内每一分支的下游（grant、lease、attempt、Browser 领取）**完全复用现役流程，不产生新状态、新终态、新恢复路径**——本方案的改动半径严格限制在"选出哪一行"这一个决定内，不触碰选出之后的任何环节。

**（独立审计问题 5 修复）`exactJobIds` / provider 限流冷却分支分析**：`selectV6ClaimableJobs` 的 `exactJobIds` 参数（`job-claim-selection.ts:84,116`，SQL 条件 `$6::text[] is null or j.job_id=any($6::text[])`）由 `job-claim-repository.ts` 的 `cooldown.constrainedJobIds` 传入，是 `LAW-AI-ACCEPTANCE-004-V26` forbidden 数组最后一条（provider 限流冷却期间"冻结去重 cohort"）的实现载体——冷却期间只允许 Website 已冻结的那个 job_id 集合参与领取，与其它候选行完全隔离。这是一条**成员过滤（WHERE 层）**分支，逻辑上先于排序发生：tier 排序只决定"同一批已经通过 `exactJobIds` 成员过滤的候选行之间，谁先被这次事务选中"，不会让 cohort 外的工单因为 tier 更高而混入，也不会让 cohort 内工单因为 tier 更低而被跳过（该分支下候选集合本就只有 `exactJobIds` 指定的那几行，`effective_tier` 只影响这几行内部的相对顺序）。**结论：本方案与限流冷却机制正交，无需修改 `exactJobIds` 相关代码，无需修改冷却机制对应的法条条款。**

## 8. 删除反事实（存在性审判）

对本方案唯一新增的结构单元——**`effective_tier` 计算逻辑（product_id 静态映射 + 防饿死回退）**——执行审判：

1. **当前需求为什么必需它？** 用户明确要求按业务轻重缓急排序；本会话已用真实运行数据证明纯 FIFO 会让固定文案翻译连续占满唯一 Browser lane 近 2 小时，期间任何更紧急的工单（哪怕是支付截图）都要排在后面，这是已观测到的真实后果，不是假设。
2. **当前真实 GAP 是什么？** `selectV6ClaimableJobs` 排序键不携带业务重要性信息。
3. **哪个现役真实消费者直接使用它？** `selectAndGrantClaimJobs`（唯一调用方）→ 决定 AGENT 下一步执行哪个工单，直接影响全部 14 个 product_id 的用户可感知延迟。
4. **唯一 Owner 与权威输出？** `ai-acceptance`（Website），权威输出是查询结果行的排列顺序；不新增 Owner，落在 §3 已确认的"claim eligibility 与顺序"既有职责内。
5. **现在把它删除，会在哪条分支具体坏掉？** 退回纯 FIFO；已实测证明的后果是：单一低优先级产品的存量任务可以让同一时间窗口内所有更高优先级产品排不上号，与用户本次明确提出的业务要求直接冲突。
6. **是否存在复用现有 Owner/合同即可完成的更短方案？** 已在 §7 系统必要性论证中排除"第二 Browser lane/容量扩容"路径（被 `LAW-AI-ACCEPTANCE-003-V10` 与用户"基础设施禁止迭代"共同排除）；除了修改现有排序表达式，没有更短路径。
7. **是否替代了什么旧路径？** 替代原 `(created_at,job_id)` 二元排序表达式，旧表达式在同一行代码原位修改，不产生并行旧路径、不需要额外删除步骤。

**是否落在 agent-flow-boundary-gatekeeper 的红旗模式？** 逐条核对：

- "中央 Scheduler/Traffic Arbiter"——否，改动仍在 `ai-acceptance` 唯一既有 claim 函数内部，不新建独立调度服务；
- "Product priority/weight"——是字面意义上的"product priority"，但红旗本身允许"根据其真实决策权、状态和调用方向判断，不得仅凭名称判违"；本方案的 `effective_tier` 是无状态纯函数（不读写任何新持久化状态，防饿死判断只读现有 `created_at` 列），不构成独立决策 Owner，不违反"claim eligibility 与顺序仍由 `ai-acceptance` 唯一拥有"这一边界；
- "Browser FIFO 取得 Product priority"——否，本方案明确不在 AGENT Browser FIFO 层做任何改动（§5.2 已证明零 AGENT 改动），priority 完全落在 Website `ai-acceptance` 层，与 Browser FIFO（负责"已具备资格请求"内部排序）职责边界不冲突、不越权。

**不新增数据库迁移、不新增表、不新增列、不新增持久化状态**——`effective_tier` 全部由 `product_id`（既有列）与 `created_at`（既有列）在查询时计算得出，符合"最简单完整方案"。

## 9. 唯一目标链与原子工单

### 工单 1（Website / `ai-acceptance`）：法条文字修改

- **目标**：把 `LAW-AI-ACCEPTANCE-004-V26` 升版为 `LAW-AI-ACCEPTANCE-004-V27`，按 §4 精确文字落地；`summary`/`supersedesLawId` 同步更新。
- **唯一 Owner**：Website `ai-acceptance` 法条维护流程。
- **仓库/路径**：`xuanxue-web/.github/instructions/agent-rules/功能法案.md`。
- **前置门槛**：本方案已获用户批准（§3.1 已闭合）。
- **完成门槛**：新法条文本通过仓库法案 schema 校验（`schemaVersion`/`lawId`/`tier` 字段完整）；`scripts/audit/generated/law-registry.generated.json` 按仓库现役生成流程同步重新生成（不得手工编辑该生成文件）。
- **失败停止**：法案 schema 校验失败则停止，不得放宽 schema 约束迁就新文本。

### 工单 2（Website / `ai-acceptance`）：静态优先级映射表 + 排序 SQL

- **目标**：在 `job-claim-selection.ts` 内新增一个不导出、与 `selectV6ClaimableJobs` 同文件的只读常量（`product_id → 1..5`，未命中默认 5），并把 SQL 排序键改为三元组，游标比较同步改为三元组。
- **唯一 Owner**：同上。
- **精确赋值**（本轮用户已确认，含本轮追加确认的 `localization_report_translation`）：
  - tier 1：`payment_screenshot_observation`
  - tier 2：`bazi_ai_full_analysis`、`bazi_chart_interpretation`、`bazi_report_followup`、`hehun_ai_analysis`、`hehun_report_followup`、`naming_bazi_analysis_and_naming`、`naming_from_existing_bazi_report`、`qimen_professional_answer`、`qimen_report_followup`、`localization_report_translation`
  - tier 3：`localization_static_catalog`
  - tier 4：`localization_article_translation`、`public_knowledge_article_pipeline`
  - tier 5（默认，含未来"系统反馈升级"上线前的任何未命中 product_id）：无需显式列出条目
- **防饿死阈值**：施工时需由执行 Claude 与用户确认一个具体数值（例如等待超过 30/60 分钟强制并入 tier 1）；本方案不预设具体分钟数，因为这是可独立验收的业务参数，不是架构决定，不应在设计阶段替用户拍板一个未经确认的数字。该阈值同时须满足一条粗粒度机械上限校验（**独立审计问题 7 修复**）：必须是正有限值，且不得超过一个显式声明的量级上限（例如不超过 4 小时），由工单3 的静态核验断言检查该值落在 `(0, 上限]` 区间内——避免出现"技术上存在防饿死回退、但阈值大到事实上永不触发"这种字面合规而实质失效的配置。
- **实现约束（独立审计问题 2 修复，阻断级；理由段落已在第二轮独立审计中用真实 Postgres 16.14 实例实测校正）**：`effective_tier` 的计算表达式**必须**在同一层 `SELECT`（如需要读出该值供排查用）、`WHERE` 游标比较、`ORDER BY` 三处逐字内联（同一段 `CASE` 表达式文本复制三份，不得抽成 CTE、子查询或视图后再引用）；查询结构必须保持现役的单层 `SELECT ... FROM ai_production_jobs j JOIN ai_production_job_runtime r ... JOIN ai_production_control_protocol_state p ... WHERE ... ORDER BY ... FOR UPDATE OF j,r SKIP LOCKED LIMIT 1` 形态，**禁止**引入 `WITH ... AS (...)` 包裹上述 JOIN 后再在外层或内层对其加锁。真实机制（已实测校正，不是推测）：若把 `j`/`r` 的 JOIN 写进 CTE、锁定子句留在**外层** `FOR UPDATE OF j,r`，Postgres 会直接报错拒绝执行（`ERROR: relation "j" in FOR UPDATE clause not found in FROM clause`）——这种写法会在任何一次测试运行中立刻暴露，不是真正的风险点。**真正的隐患是把 `FOR UPDATE ... SKIP LOCKED` 挪进 CTE 内部**：这种写法不报错、能正常返回单行结果，但会对 CTE 内 `WHERE` 条件匹配到的**全部候选行**加锁（而不是只锁最终经 `ORDER BY ... LIMIT 1` 选中的那一行），静默把"零副作用跳过被锁行、只锁定即将授予的那一行"的现役并发正确性前提，改成"锁住这一批全部候选行"，造成不必要的锁竞争与潜在死锁风险，且仅凭"这次查询返回了 1 行、没报错"完全看不出来。因此本约束禁止的不是"CTE 会报错"这件事本身，而是禁止任何把 `FOR UPDATE`/JOIN 拆到子查询层级的写法，无论该写法报错与否；LATERAL 子查询计算 tier（不涉及对 `j`/`r` 加锁下放）与本约束不冲突，可以作为可选实现细节，但不是必需。
- **前置门槛**：工单 1 完成（法条文本先行，代码引用新 lawId 注释/证据锚点）。
- **完成门槛**：
  1. keyset 游标三元组与 `ORDER BY` 三元组逐字段一致（施工验收项，见 §5.1）；
  2. 查询保持单层 `SELECT` 结构、未引入 CTE/子查询，`FOR UPDATE OF j,r SKIP LOCKED` 逐字保留在同一层查询（对照上述实现约束逐条代码审查确认，不得仅凭"测试通过"代替代码结构核查）；
  3. 调用点字面文本 `selectV6ClaimableJobs({ client: input.client,` 保持不变，或已按 §5.1 独立审计问题 1 的处理方式同步核实 `dynamic-n-tab-capacity-inspection.ts` 对 003 号法条的静态断言；
  4. 并发领取测试覆盖：构造多个候选行在同一事务窗口内竞争领取，断言不出现重复授予、不出现被跳过的可领取行；
  5. 唯一调用方 `selectAndGrantClaimJobs` 无需修改（§5.1 已证明零耦合）。
- **失败停止**：任一验收项不满足则停止，不得先合并再补测试；尤其是实现约束（CTE 禁令）不得以"测试暂时没跑出问题"为由放行，必须先做代码结构审查。

### 工单 3（Website / `ai-acceptance`）：审计证据点同步

- **目标**：`scripts/audit/domains/ai-acceptance/check.ts`/`manifest.json` 里绑定 `LAW-AI-ACCEPTANCE-004-V26` 的机械核验断言，改为绑定 `LAW-AI-ACCEPTANCE-004-V27`，并新增以下静态核验：
  1. 映射表必须是有限枚举（无外部调用、无运行时状态读取）；
  2. 防饿死回退必须引用既有 `created_at` 列（不得引入新列）；
  3. **（独立审计问题 7 修复）** 防饿死阈值必须落在 `(0, 显式声明上限]` 区间（拒绝零、负值或超过上限的配置）；
  4. **（独立审计问题 8 修复）** 映射表覆盖的 product_id 集合必须是当前 `packages/ai-contracts/src/agent-task/website-agent-task-result.ts` 活跃 product_id 枚举的子集（防止映射表里出现已下线的 product_id 残留），但不要求穷尽列出全部枚举——未命中默认最低档是本方案接受的 fail-safe 权衡（新产品上线若忘记同步映射表，只会静默降到最低优先级，不会报错、不会越权、不会崩溃），本方案不为此新增强制穷尽性校验，避免为一个可接受风险新增机械门槛。
- **（独立审计问题 1 修复）** 需额外核实：本工单改动是否波及 `dynamic-n-tab-capacity-inspection.ts` 对 `selectV6ClaimableJobs` 调用点的字面文本匹配（该断言绑定 `LAW-AI-ACCEPTANCE-003-V10`，与本方案改动的 004 号法条无关）；若工单2 的实现导致调用点文本变化，须在本工单一并核实并按需调整该断言，不得误判为 003 号法条被违反。
- **唯一 Owner**：同上。
- **前置门槛**：工单 1、工单 2 完成。
- **完成门槛**：仓库原生质检入口（`scripts/audit`）对新证据点跑通，不新建第二质检入口。
- **注意**：`scripts/audit/domains/ai-acceptance/check.ts`/`manifest.json` 当前处于 dirty 状态（§3 已记录，内容与本方案无关，仅为 lawId 版本号引用的顺带改动）。施工前必须重新核对该文件当时的最新状态，确认本工单改动与该 dirty 内容不冲突；若冲突无法安全区分，本工单必须停止并重新绑定。

### 工单 4（AGENT）：无

**本方案在 AGENT 侧不产生任何工单**（§5.2 已证明零耦合、零改动必要性）。用户"AGENT 侧只能迭代技能和合同"的约束因此天然满足，不需要为了"看起来完整"而杜撰一个 AGENT 侧任务。

### 跨仓顺序

工单 1 → 工单 2 → 工单 3，全部在 Website 仓库内完成，无需跨仓 cutover、无需 drain 窗口、无需迁移桥（不存在新旧两条排序逻辑并存的过渡期——排序表达式是原子替换，同一次部署内生效，不存在"部分 AGENT 用新逻辑、部分用旧逻辑"的窗口，因为排序逻辑完全在 Website 侧单点决定）。

## 9.1 性能路径评估（独立审计问题 3 修复；索引前提已在第二轮独立审计中软化校正）

`effective_tier` 是运行时 `CASE` 表达式、不在任何现有列或索引上；改为以它为排序键最高位后，无论现役 `order by j.created_at,j.job_id` 今天是否由某个复合索引以区间扫描方式服务（**第二轮独立审计核实：`data/migrations/commercial/` 内唯一疑似匹配的 `ai_production_jobs_old_product_contract_drain_idx` 已在 `0084_agent_plugin_factory.sql` 被 drop，`ai_production_job_runtime_claim_idx` 覆盖的谓词 `status in ('queued','recovery_pending')` 在当前二元状态模型下很可能已经打不中本查询——即今天大概率本来就是顺序扫描+排序，本方案不对现役是否有索引支撑做任何未经证实的断言**），改动后都需要对满足 `WHERE` 条件的候选行求值表达式后排序取 `LIMIT 1`（§8 已明确不新增迁移/列，因此不通过表达式索引或生成列规避这一点）。

**结论与验收要求**：不依赖"现役有无索引"这一前提——`ai_production_jobs`/`ai_production_job_runtime` 的未完成工单规模属于业务量级（历史观测值是几十到几百行级别，不是海量表），在此规模下无论今天是索引扫描还是顺序扫描，改动后的性能影响预期都可忽略。工单2 完成门槛需新增一条：在测试环境用当前生产可比量级（例如 500–1000 行未完成工单）实测新旧两版查询的延迟对比并留痕（可用 `EXPLAIN (ANALYZE, BUFFERS)` 建立现役基线，不要求验证一个未经证实的索引假设），若发现显著劣化需回到设计阶段重新评估（不设具体数字指标——本项目不为无结构预算的路径发明数字指标）。

## 10. 分层验收

- **工单 1**：读取 `功能法案.md` 对应区块，确认新文本、`lawId`、`supersedesLawId`、`summary` 字段一致；法案 schema 校验通过。
- **工单 2**：
  - 单元/契约测试：构造 5 个不同 tier 的 job 混合 created_at，断言领取顺序符合 tier 优先、同 tier FIFO；
  - 防饿死测试：构造一个低 tier 但 created_at 远早于阈值的 job，断言其 effective tier 提升为最高档后按 §4 修正后的法条语义与同档候选一并排序（不是脱离 tier 机制单独跳过其它候选）；
  - 阈值边界测试：构造阈值为 0、负值、超过声明上限的配置，断言 §9 工单3 的静态核验拒绝这些配置；
  - **（第二轮独立审计问题 4 修复）** cohort 混合 tier 测试：构造一个 `exactJobIds` 限定的冷却 cohort，内部包含不同 tier 的 product_id，断言排序只影响该 cohort 内部相对顺序，不影响 cohort 外任何工单的成员资格，且不违反现役冷却退避的既有合同（现役合同不要求 cohort 内部必须严格按原 FIFO 顺序处理，只要求冷却后按降低的 N 为合规成员签发新 attempt）；
  - 并发测试：复用现役 claim 并发测试套件，并新增覆盖场景专门验证 `FOR UPDATE OF j,r` 在改写后查询结构下仍对 `ai_production_jobs`/`ai_production_job_runtime` 生效（不是仅测试"无重复/无跳过"这一间接结果，需在测试中显式验证行锁持有状态），确认新排序结构下无重复领取、无跳过；
  - 性能基线：按 §9.1 的评估要求，在可比量级下实测并留痕。
- **工单 3**：`scripts/audit` 原生入口对 `ai-acceptance` domain 跑通，新证据点被覆盖。
- **端到端业务 readback**：在真实（或测试）环境制造一批混合 tier 的待领取工单，观察 AGENT 实际领取顺序与预期 tier 顺序一致；此为最终业务 Owner（`ai-acceptance`）的权威验收，不由 AGENT 侧或本方案自行宣告完成。

## 11. 停止、回退与执行 Claude 重绑定要求

- **停止条件**：任一工单的前置门槛或完成门槛不满足；施工时发现 §3 记录的 dirty 文件已提交且与本方案改动区域产生实际冲突；施工时用户对具体防饿死阈值分钟数未给出确认。
- **回退**：三个工单均为同一文件内的原子文本/代码替换，回退即 revert 对应 commit，不涉及数据迁移、不涉及已持久化状态，回退零副作用。
- **执行 Claude 重绑定要求**：进入施工阶段前，必须重新读取 Website 当前 `功能法案.md`、`scripts/audit/domains/ai-acceptance/**` 的最新 git 状态（尤其是 §3 记录的 dirty 区域是否已提交或 further 漂移），重新确认 `LAW-AI-ACCEPTANCE-004-V26` 仍是当前版本号（未被其它并行工作抢先升版），重新核对 AGENT 仓库 HEAD 是否已从本方案记录的 `42c047fbb`（§3/§5.2 已核实的一次漂移，内容与本方案无关）进一步漂移，并向用户确认防饿死阈值的具体分钟数与其声明上限后，方可开始工单 1。
