# 浏览器未决命令与恢复状态完整实现方案

更新：2026-10-10（Asia/Dubai）。需求 Owner：AGENT / local-browser-session；Runtime 与 Shell 各自保留原 Manifest 主权。唯一方案仍为本文件。

**状态：可施工。** 授权人已明确批准按本方案施工，并授权法案、施工图、代码、质检与数据库操作；实际建设仅为 WO-H1/H2 的既有状态投影修复及其直接验收。原事故终态缺口 D2 保留为生产事实阻断，不能承诺三张任务自动解锁，不扩大为伪造终态或新恢复链。CI-FULL 按冻结 Skill 连续执行 CHANGE → READY → RELEASE；各级结论及生产完成分别依据实际证据。

## 1. 目标、收益与边界

完善现役恢复系统，让未入库且未被 Website 正式终止的同一 job 始终留在恢复分母，并准确表达当前可以对账、可以交付、可以执行页面动作的不同条件。最终业务终点是 Website 领域 admission receipt 与同一身份持久化读回；三张现场任务还须核对应固定 catalog 的合格结果消费。Browser 原 WAL 终态、HTTP 200、lease、Shell healthy 或 Outbox delivered 均不是这个终点。

本轮采用“成熟链 + 已证实增量”的1+1：保留原worker单槽补交、唯一WAL结算和Website唯一恢复裁决；删除并重构Runtime与Shell错误的执行就绪投影，增加实际阻断状态的原生正反验收。收益是Browser已明确lane blocked时不再给操作员执行绿灯，事实恢复后同一状态自动读回正常；不降低安全门，不删除工单换取绿灯。普通在途command也可能短暂DISPATCHED并处于busy，本轮不把所有过程态机械变成执行故障，不扩大原回执补交的存活范围。

本次已授权建设 WO-H1/H2，直接写面为三个生产函数、两个原生验收入口及现有 Runtime Blueprint。现役法案已可承载目标行为，无需改法、母本、spec、Manifest、registry或数据库结构。三个函数已在独立工作区完成删除、缺席确认和重构；授权人随后明确要求合并到主仓库再执行 CHANGE 和 READY。本轮七文件差异已应用到 main，其余 Codex 的六文件成果原样保留；不操作其他任务进程，不 reload，不删除或重派三张工单。生产发布资格仍须核原未决事实及全部 RELEASE 输入。本方案没有新增法案、结构、表、队列、状态机、API、定时器、持久日志、恢复 Owner、兼容桥或第二质检。

前序施工工作区为 `/Users/nexgen/.codex/worktrees/recovery-plan-design/AGENT`，分支 `codex/recovery-plan-design`，事实基线为 `b30758f8379465f9bb0d536c79da4d294b0e6b7b`。最新授权覆盖前序分支限制：本轮合并及原生质量工作区改为 `/Users/nexgen/Documents/AGENT` 的 main，合并基线为 `fba36cf6390ea9d5f98018f3d593eb99a44b3451`。主仓库修改前 clean，与前序基线相差的六个文件和本轮七文件写面无交集；主仓库现役法案、母本、Blueprint、spec、Manifest、registry及质量入口与前序基线一致。原分支 CHANGE 在本次授权改变后由本执行者定向停止，未取得 PASS；合并后的候选重新从 CHANGE 开始，不继承分支或另一 Codex 的质量结论。READY 的候选只用其当时 clean 原生 Git commit。

按片区删除后重构：本次原方案文件修改前为 clean，已物理删除并确认原路径缺席，随后在同一路径重建。代码工单仅在准入开放后执行各自精确函数片区的“物理删除 → AST/引用缺席确认 → 原路径唯一重建”，不覆盖整个共享文件，不移动、改名、包装或留下旧实现。无法证明新增收益的成熟 Browser 链不动。

## 2. 源头、候选与文件保护

两仓分别按自己的母本 §§0、4、35 判级，随后读取 §§22、24、35—38、41、46—47 及本次涉及的合同、证据和审查条款；母本不授予业务权限。母本 SHA-256 均为 `27a143ecd7016887d056255e106f49caa29d83d06245ff21ea5c0ffd62b98c3a`。基础法案、功能法案、registry、Owner Manifest、跨仓 provider/dependency 和真实消费链逐级核对，历史方案不覆盖当前源头。

| 仓库 | realpath / branch | HEAD / tracking HEAD | scoped source SHA-256 |
|---|---|---|---|
| AGENT事实源 | /Users/nexgen/Documents/AGENT / main | b30758f8379465f9bb0d536c79da4d294b0e6b7b / 5ae4bb4cf6939bab2a70d16f69509fd4582bbfe1 | 1af59b0ac240734a861feaf5012b30c86f431abf5ced0d2bc1a0683993cad860 |
| Website事实源 | /Users/nexgen/Documents/xuanxue-web / main | 2a22a286345d8082c72291d82a200399096de576 / 2a22a286345d8082c72291d82a200399096de576 | 0463310a5d5ee9c0d6cc7ca511685e5ffa6383f58539ba71684622c007e366e3 |

事实源快照为UTC2026-10-09 22:46:59，tracking均为`origin/main`；AGENT本地领先两提交且工作树clean，Website与tracking相同并有下述overlay。本轮不fetch，也不把未知远端实时状态当已核验。下面是有限受影响图的精确文件分母；每仓按相对路径字典序，对每个文件当前bytes算SHA-256，再将`path + TAB + file_sha256 + LF`拼接计算表中scoped hash。方案自身不进入source分母；最终文档hash单独在工具结果记录，不能自包含hash或生成第二candidate文件。该表绑定实际分析事实源，不能以隔离分支起点的旧clean源码替代新提交或overlay；运行日志各自producer/时间另见§3，不据HEAD推断运行进程已换代。准入前重新绑定实施候选。

AGENT（54 个）：

```text
.github/instructions/agent-rules/功能法案.md
.github/instructions/agent-rules/基础法案.md
AGENTS.md
docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md
docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md
docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md
docs/governance/法案系统建设说明书-冻结定稿版.md
docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json
docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json
docs/项目方案/AGENT停止接单与在途工单完整收尾-完整实现方案.md
docs/项目方案/AGENT原attempt无失败事实恢复-完整实现方案.md
docs/项目方案/GPT附件入口OR精确迭代-完整实现方案.md
docs/项目方案/浏览器退出恢复与未决命令解锁-完整实现方案.md
package.json
scripts/acceptance/agent-production-runtime-business-admission.acceptance-support.ts
scripts/acceptance/agent-production-runtime-recovery-contract.acceptance.ts
scripts/acceptance/agent-production-runtime.acceptance.ts
scripts/acceptance/local-app-shell.acceptance.ts
scripts/acceptance/local-browser-mutation-receipt-support.ts
scripts/acceptance/local-browser-provider-effect-recovery.acceptance.ts
scripts/acceptance/local-browser-rule-mutants.acceptance.ts
scripts/acceptance/local-runtime-browser-authority.acceptance.ts
scripts/audit/domains/agent-production-runtime/manifest.json
scripts/audit/domains/app-shell-ui/manifest.json
scripts/audit/domains/local-app-shell/manifest.json
scripts/audit/domains/local-browser-session/manifest.json
scripts/audit/generated/law-registry.generated.json
scripts/audit/governance.ts
scripts/startup/lib/service-readiness.mjs
src/app/app-shell/production-runtime-workspace.ts
src/app/workbench-production-runtime-client.ts
src/app/workbench-production-runtime-routes.ts
src/lib/browser/chrome-extension/extension-command-runtime.ts
src/lib/browser/chrome-extension/websocket-actor.ts
src/lib/browser/exact-target/browser-mutation-evidence.ts
src/lib/browser/exact-target/browser-mutation-receipt.ts
src/lib/browser/exact-target/browser-mutation-store.ts
src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts
src/lib/browser/infrastructure/browser-lane-coordinator.ts
src/lib/browser/protocol/browser-protocol.schema.json
src/lib/browser/transport/browser-authority-websocket.ts
src/lib/local-runtime/production/operations-snapshot.ts
src/lib/local-runtime/production/runtime-business-admission.ts
src/lib/local-runtime/production/runtime-claim-recovery.ts
src/lib/local-runtime/production/runtime-claim.ts
src/lib/local-runtime/production/runtime-contract.ts
src/lib/local-runtime/production/runtime-loops.ts
src/lib/local-runtime/production/runtime-source-handoff.ts
src/lib/local-runtime/production/runtime-startup.ts
src/lib/local-runtime/production/terminal-failure.ts
src/lib/local-runtime/workbench-production-runtime-handle.ts
src/lib/local-runtime/workbench-status-types.ts
src/lib/local-runtime/workbench-status.ts
src/lib/local-runtime/workbench.ts
```

Website（24 个）：

```text
.github/instructions/agent-rules/功能法案.md
.github/instructions/agent-rules/基础法案.md
AGENTS.md
data/migrations/commercial/0134_public_knowledge_unfinished_purge_gate.sql
docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md
docs/governance/法案系统建设说明书-冻结定稿版.md
docs/specs/ai-acceptance/website-agent-task-result.provider.spec.json
docs/specs/ai-acceptance/xuanxue-ai-production-v6.contract.spec.json
package.json
packages/ai-contracts/src/agent-task/website-agent-task-result.ts
packages/ai-contracts/src/production-control/xuanxue-ai-production-v6.manifest.json
scripts/audit/domains/ai-acceptance/manifest.json
scripts/audit/domains/localization/manifest.json
scripts/audit/generated/law-registry.generated.json
scripts/audit/governance.ts
services/api/src/ai-production/business-result-consumer.ts
services/api/src/ai-production/business-result-domain-dispatch.ts
services/api/src/ai-production/job-claim-observation.ts
services/api/src/ai-production/job-claim-selection.ts
services/api/src/ai-production/job-claim-source-lineage.ts
services/api/src/ai-production/job-lifecycle-core.ts
services/api/src/ai-production/job-lifecycle-repository.ts
services/api/src/localization/localization-control-room-handler.ts
services/api/src/localization/localization-static-catalog-consumer.ts
```

前轮AGENT的GPT/Browser/V6 Blueprint、附件OR、Browser验收/Supervisor/transport、runtime-loops及停止收尾方案overlay已由另一任务提交。本轮重新核验时代码施工面clean，不能继续称其dirty；停止收尾方案/registry在审查期间曾再更新，按末次scoped bytes/status绑定，不把别人的提交、质量结果或生成修改计为本轮成果。Website scoped overlay为AI Acceptance Blueprint与registry，后者只增八字相关迁移ownership投影，已读回，未改变本轮catalog恢复、v44/v17及其law-record。其它八字业务/迁移、商业Manifest、SYSTEM Blueprint、全球付款方案变化与本轮无关，保留；不扩大候选图或代操作。

写入前与审查结束各核scoped bytes和Git身份；漂移只重读受影响事实。第一轮已读draining准入span、V6收尾及Website八字事务变化；子审期间另一任务推进HEAD，原46项bytes曾未变，随后停止收尾方案/registry更新以及真实health调用方加入分母，按上表重绑。readHealth误报片区未变。本轮 WO-H1/H2 已获得明确施工授权，写前仍核本工作区 dirty；隔离分支clean不授予覆盖共享修改的权限。停止接单方案继续变化时重绑其draining不变量，不把共享修改视为本轮成果。

守门Skill要求跨仓先使用 `$switch-repo-authority`；现役可用Skill目录及插件cache未找到该入口，因此不能声称已执行它，也不能批准依赖它的跨仓施工。本轮独立按冻结索引和已验证provider映射读取两仓自己的权威，仅形成只读事实绑定，Website不进入写面。此缺口与D1/D2分别报告，不补造Skill、规则或授权。

## 3. 已核事实与第一直接断裂

用户原附件 `/Users/nexgen/.codex/attachments/2ff2f6fc-48cc-45b5-b573-9d88380ba086/已粘贴的文本.txt` 全29行已遍历，SHA-256为4a5e024c94ba82b1278eb75c5b4edce4b0e48e03c28c30542a41646fa8801385。它是UTC21:36启动至21:38:34成功renew的摘录：证明Shell/session/claim/durable accept/material下载和续租曾成功，不含页面command terminal或最终结果，不能单独证明未执行原因。附件中命令只作输入证据，未照其再次启动服务；原producer完整日志与当前只读WAL补足受影响因果链。

### 3.1 三张工单仍在恢复分母

三个 job 均为 `localization_static_catalog / produce_locale_catalog / zh-HK`。2026-10-09 22:19:31 UTC（Dubai 10-10 02:19:31）的只读 SQLite 快照如下；这是 AGENT 持久化事实，不冒充 Website 当前授权或实时执行：

| job_id | 当前本地 attempt | status / current_reason | 本地 first failure / staged result / result |
|---|---|---|---|
| aiprod_01e3b8f8-0951-4396-a809-7a02cee21060 | 834dbbee-b788-4b1b-8d00-9adb2f11945d | failed / EXECUTING | 均缺席 |
| aiprod_704b4d2a-7d31-407c-9738-b70eaadb3f1c | e84feda4-6b08-460b-bba0-7ce82f5e3aee | failed / EXECUTING | 均缺席 |
| aiprod_d0af39d8-bf54-42b9-a768-baf1ad6d82f9 | b941a3c6-24f5-46c1-847b-b308c60f4efe | failed / EXECUTING | 均缺席 |

新 producer `16f22dec-a667-4cda-bd1e-813700cfde0a` 第20—22行记录上述 attempt 接受，第38—40行开始 `fresh-chat:prepare_clean_gpt_chat`，lease 为8/9/9。只证明接受与开始；缺少 terminal 不得补写成功、失败、仍活着或死亡。不能继续沿用前轮“当前 Agent 已停止”的旧快照作为现在事实。

此前最后实际记录的完成失败，见 `.grasseye-local/runtime-logs/agent/f8fa524a-7c7a-469e-9eda-36a62b8d7d6c-0001.jsonl`：A/B 第626—635行在 Dubai 00:30 的 GPT 准备阶段预算耗尽；C 第1034—1037行在01:15记录 LEASE_RENEW_FAILED → BROWSER_WAIT_ABORTED → JOB_RUNTIME_BOUNDARY_FAILED。C 未日志化精确 Website renew 拒绝原因，根因不另行猜测。后续已发生新的 grant，旧 attempt/fence 不是当前权限。

### 3.2 当前阻断事实与未证实根因

原 Browser DB `.grasseye-local/browser/browser-mutations.sqlite` 当前全局仍只有一个 DISPATCHED：command `044eab8b-c456-4fdb-8750-a1dafc8f0052`，属于 B 的旧 attempt `8eeb2f4b-261f-4341-aced-211aab4feabb`、lease5、`target_local / open_gpt_execution_profile / profile-open`；更新于 UTC 10-09 19:47:11.261，terminal 缺席，mutation_outcome=dispatched。存储默认 physical_input_count=0 不证明零物理输入。

旧 producer `751ce92e` 对应日志第757—760行表现为命令开始、PREPARED、DISPATCHED，随后 shutdown 开始，未取得命令终态。这只能证明中断与缺回执；不能证明原 worker/槽已永久丢失、动作是否发生、认证错误是该命令失联原因，或新的 Target 能清算旧命令。原槽可用性是 EVIDENCE_GAP。

BrowserLaneCoordinator.nextWaiter 对全局未决 WAL 阻断所有 acquisition，Store.prepare 同事务再守全局门。它解释新任务为何不能进入页面输入，但没有证实“原可信终态为什么未交付”的更深根因。本轮不虚构 Browser 核心缺陷或重写成熟补交链。

### 3.3 已证实且可修的第一处错误转换

Runtime `runtime-loops.ts:readHealth` 已读取 browserLane，但 executionState 仅由 Cloud/ledger/draining 决定：Cloud ready、ledger reconciled、authority present、lane blocked 时仍输出 ready。实际执行 lane 被 Browser 阻断，健康投影却丢失此条件。真实 consumer 为 ProductionRuntimeHandle.readHealth、operations-snapshot.localRows → readProductionOperationsSnapshot 与 Workbench health。

Shell `workbench-status.ts:readAiProductionComponents` 的 productionRuntimeBrowser.ok 只比较 browserState；该字段是 Authority presence 投影，因此 lane blocked 仍绿。productionRuntimeExecution 又照抄错误 executionState。两处是独立 Owner 的连续投影缺陷，拆成 WO-H1 / WO-H2。localRows.execution 的 reason_code 还直接复制历史 lastErrorCode：当前 lane blocked 时可能为空或显示无关旧错误，因此状态和当前阻断原因的连续投影一起纳入 WO-H1，不把诊断改写为 first failure。

claim eligibility 与执行动作资格不同。本轮不把 lane blocked、Target absent 或 executionState 反向用于改造 Website claim、终止 worker、撤销 lease、阻断 Outbox 或永久停止需求。总 health 的 healthy/degraded 仍是现役 Shell/Cloud 诊断定义，不能冒充端到端成功。

### 3.4 删除请求不能冒充恢复出口

前轮 exact 三张 job 删除事务因 `AI_PRODUCTION_EVENTS_ARE_APPEND_ONLY` 回滚；没有三张已删除的证据。现役删除 gate 迁移是 SEO Work Order 管理员链，不是固定 catalog 通用权限。LAW-LOCALIZATION-020-V27 控制室是只读观察及限定 ensure，不提供 retry/delete/pause；不得设置 `xuanshu.unfinished_purge_work_order`、关 trigger、绕角色或以 replacement job 代替恢复。原方案2026-10-02旧事故的用户删除排除范围不适用于这三张 job。

## 4. 四维权威映射与唯一职责

| GAP / 不变量 | 法案系统 | 施工图 / 合同 | 当前实现 / Owner | 原生验收 / readback |
|---|---|---|---|---|
| 三张 failed 不是业务终态 | Website LAW-AI-ACCEPTANCE-004-V31 forbidden 9/10/17、LAW-AI-ACCEPTANCE-013-V28 forbidden 0—4；AGENT LAW-AGENT-PRODUCTION-RUNTIME-001-V75 forbidden 2/7/8 | AGENT V6 Blueprint §5；Website AI Acceptance 的恢复及固定 catalog 段；V6 provider/dependency v44 | Website claim/lifecycle/source-lineage；Runtime worker/source handoff/原三表 | 两仓各自 recovery Exam；同 job 的 Website admission 与领域持久化 |
| 未决 WAL 只能取得原真实终态 | LAW-LOCAL-BROWSER-SESSION-004-V56 全局门及terminal-only；LAW-LOCAL-BROWSER-SESSION-006-V45 原worker补交；LAW-ARCHITECTURE-BOUNDARY-002-V2 Target边界 | Browser Blueprint“原 worker 终态交付与唯一 WAL 结算”；协议 revision9 | 原 Extension 槽 → Supervisor → Store → lane；Browser Owner | 原 Browser authority/receipt/rule-mutants；原 WAL CAS/readback，ACK 与输入增量 |
| 执行就绪及原因误报 | LAW-AGENT-PRODUCTION-RUNTIME-001-V75；LAW-LOCAL-APP-SHELL-003-V4；LAW-APP-SHELL-UI-001-V3 forbidden 6/8 | V6 Blueprint §§1/5；ProductionRuntimeHealth与operations-snapshot.v1原字段 | readHealth/localRows / agent-production-runtime，readAiProductionComponents / local-app-shell | WO-H1/H2；实际函数 + 原 Store fixture，health与矩阵状态、reason、完整性逐行读回 |
| 有效结果优先交付 | LAW-AGENT-PRODUCTION-RUNTIME-004-V44、LAW-AGENT-PRODUCTION-RUNTIME-005-V42；Website LAW-AI-ACCEPTANCE-004-V31 forbidden13、LAW-AI-ACCEPTANCE-012-V44、LAW-LOCALIZATION-020-V27 | task-result provider/dependency v17；V6 v44 | 原 Outbox；business-result-consumer.staticCatalog；localization-static-catalog-consumer | admission 的完整身份/hash；consumer 与固定 catalog 当前合格条目读回 |
| exact absence 清理 | LAW-AGENT-PRODUCTION-RUNTIME-006-V46；LAW-LOCAL-BROWSER-SESSION-006-V45；Website LAW-AI-ACCEPTANCE-004-V31 SEO限定条款 | Browser Blueprint 管理员释放段；不扩 Website 删除合同 | Website唯一终止 authority → Runtime absence → Browser原释放/purge | exact job 缺席、handler drain、同 job slot/Target/WAL 清理；非成功入库 |

上表使用现役完整lawId，精确源文件在§2；需读取完整law-record，不以表格摘要降法。基础 LAW-CODE-PURITY-001-V6、LAW-CODE-PURITY-002-V2、LAW-CODE-PURITY-003-V3 仍约束唯一 Owner、冻结存在性和结构预算；无明确解冻，本方案不动 Target authority、Provider effect、固定 catalog 输入语义等冻结边界。

## 5. 现役实现与前轮连续性裁决

选择深度：恢复、跨 Owner、前轮共享 dirty 及同片区反复修订已命中回归信号。正向追完“Website grant → Runtime durable accept → Product → Browser → 原 WAL → result/Outbox → Website staging → 领域 Consumer → admission”，反向核状态字段、Store/actor、唯一 Owner、原 native 验收及相关方案；到已核实且不改的领域边界停止。有限历史核本文件相关八个提交与 c7b557575，未扫描无关全仓。

| 现役单元 / 精确符号 | 当前消费者和事实 | 本轮裁决 |
|---|---|---|
| websocket-actor 的 mutationSlot / executeCommand / flushMutationReceipt / acceptMutationAck / disconnectedDrain | 一份原内存槽；handler 固定 fact，重连认证后补交；ACK 精确一致才清槽；无持久槽 | 原样复用，不新增保活或恢复器 |
| extension-command-runtime 的原 terminal 构造；Store.settleTerminalReceipt / verifyBrowserMutationTerminalFact | REPLY 与 MUTATION_RECEIPT 汇流、原 identity 验真、原行 CAS、重复只 ACK | 原样复用，不从 default 0、新 fence 或超时推断 |
| Supervisor.settleMutationTerminal 与 lane/Store 全局门 | commit/readback → 尝试原日志 → ACK；日志不健康不 notify；新 mutation 双层拒绝 | 原样复用，保留原故障注入验收 |
| runtime-loops.readHealth | 当前 lane 已读却未参与 execution readiness | WO-H1 删除该函数片区后原位唯一重构 |
| operations-snapshot.localRows.execution | 当前reason抄历史lastError，阻断时可能为空/无关，原nullable/完整性合同可承载 | WO-H1删除localRows后同名重建，当前原因与完整性一次投影，其它行原样保留 |
| workbench-status.readAiProductionComponents | Authority 与 lane 混为 Browser 执行绿灯 | WO-H2 删除该函数片区后原位唯一重构 |
| runtime-claim/source-handoff/三表/Outbox；Website三个 next_action | 原唯一有界对账、来源封口、同结果交付与恢复裁决 | 不新建或复制；相关尚未完成 GAP 按下段原方案处理 |
| 静态 catalog 领域 Consumer | prepare、finalizeConsumptionWithClient 与 writeStaticCatalogAdmission 在原事务闭合 | 不改实现；作最终终点核验，不用业务 completed 代替条目合格 |

前轮真实 GAP 是断线后原事实不可交付及多处分散 terminal writer。4029f00 之后的当前实现已具单槽、汇流 verifier/CAS/readback/ACK；旧方案所记 READY 是历史证据，本轮不继承该质量结果。成熟不变量见§6和§10，全部保留。当前发现的是健康投影偏离，位于上述三个精确函数，不能宣称已证明原补交回归。

`浏览器退出恢复与未决命令解锁-完整实现方案.md` 的“新 fence 清算旧 target_local”只作被否决历史线索；c7b557575 实际删除该路径。现役生产源码无 settleRetiredTargetLocal/resolveDispatchedMutation/resolvePendingMutation 调用或声明；有限 native 验收搜索仍有一条 markRejected 历史断言文字，不等于旧 writer 存活，不宣称全文字符串零残留。不得改名复活旧路。

`AGENT原attempt无失败事实恢复-完整实现方案.md` 的 WO-SH1/SH2 是 Website next-action classifier 与 source-handoff silent-null 同一 GAP 的未完成方案，当前 selection/observation 仍只核 accepted 身份，source-handoff 仍可能返回 null。本轮不复制这些工单、不另立 blocker union、不开第二恢复链；其任何施工需先回该唯一 GAP 方案按当前 law/candidate 重开准入。本文件的健康修复不得宣称已解决它们，也不能把原失败分类断裂归因于 DOM。

`AGENT停止接单与在途工单完整收尾-完整实现方案.md` 及另一任务已提交实现涉及shutdown/draining，本轮不接管。其最新差异仅补primary_owner与READY交付边界，registry新增该方案到startup-entrypoint ownership，不改变本轮恢复law/代码。draining不abort已接受Product、lease/Outbox/原receipt收尾不丢、shutdown未决不可假成功作为不变量保留。附件OR的旧三布局加primary已完成独立迭代；本轮不改selector、Child或Browser批准字符串。

## 6. 唯一恢复主链与合同 handoff

唯一主链仍为：

```text
原 Extension worker 存活且原槽能形成真实 terminal
→ 当前同一认证 WebSocket（原 mutation fact；零新页面权）
→ 现役 Supervisor.onMutationReceipt
→ 唯一 verify / BrowserMutationStore.settleTerminalReceipt
→ 原 WAL 同行 CAS commit + readback
→ 尝试原 terminal log
→ 原认证 ACK（即使已 commit 后日志失败）
→ 仅 logger 健康时原 lane notify/pump
→ Runtime 原 worker 有界重新核 Website 当前授权
→ 原 result/Outbox 或获准 Product 原入口
→ Website 原 Domain Consumer / admission / 持久化读回
```

相邻 handoff 逐项冻结如下，不修改 wire、schema 或版本：

1. Extension → Browser：protocol9 COMMAND 的 receiptBindingHash 是原 immutable WAL identity 的唯一 canonical projection；非 mutation 为 null。fact exact keys 为 type/commandId/receiptBindingHash/terminalReceipt/receiptHash，ACK exact keys 为 type/commandId/receiptBindingHash/receiptHash；receiptHash 绑定完整 terminal，completedAt 固定一次；terminal 类型、闭集枚举、nullable cause/submitRecoveryPayload、计数范围和 unknown-field 拒收均直接依当前唯一 decoder/schema，不能用局部 payload/hash 冒充完整终态。Target/Document 仅本地原 binding 验真，不能授跨时输入权限；Provider URL 只在原 CONFIRMED effect 加密载荷存在。
2. verifier → Store → ACK：原 command 必须已 DISPATCHED，immutable binding 一致；一次 CAS 原子写 state、真实 mutation outcome/count/cause/proof/terminal/允许的 locator。矛盾、不存在或未 commit 不 ACK；完全相同重复 fact 只 ACK，不改 terminal。normal REPLY 的 raw body 与 fact 投影冲突在 commit 前拒绝。transport 不写 SQL、不做第二成功算法。
3. Browser → Runtime：仅原公开 typed state/evidence reader，Runtime 不读 Browser 私有 SQLite，不把 Provider-history zero 误作 target_local 未决为零。全局 lane 与某 job provider input 是正交事实。读取结果不授恢复动作，零输入读回仍须满足当前 Browser gate 与可信 locator。
4. Runtime → Website：V6 v44 strict canonical task/grant/source 身份、hash 和 receipt；job/request/冻结 task 是永久 spine，attempt/lease/fence/session epoch 是当前授权，result revision 仅由 Website 签；targetless 稳定 source 投影不得携 Target/Document 或 Provider URL。source seal 与 stage/terminal 原事务互斥，迟到旧请求拒绝；三个 next_action 枚举不扩张，current_reason 不参与资格、CAS、删除或完成。
5. 原Outbox → Website →领域：task-result v17原result payload identity/hash；回复未知只查/重投相同bytes，不重做Provider。固定catalog的staticCatalog在原事务finalize consumption + write admission；最终readFinalBusinessAdmissionWithClient还核同job/product/action/result/consumer消费hash、envelope及当次artifact admitted且未删除。Consumer接受不等于当前source/policy/cohort的条目全部成功。当前条目读回区分本次新写、原有合格保留、字段失败和source/policy/cohort漂移未激活，按原领域合同解释，不能强迫覆盖旧合格条目或为恢复新增“全部翻译成功”接纳门。

原 worker/槽丢失或事实不能认证时：Browser 保留 DISPATCHED，保持全局新输入阻断；Runtime 继续同 job 有限 Website 对账、原结果交付及现役可以合法完成的零输入收敛。对旧未决 command 无可信 locator 时不新 acquisition；不得用“confirmed-readback”模式名绕现役门。不是伪造 terminal，也不是业务永久失败。

## 7. 有限分母、终态与回接

每行保持§6 identity spine，终态是该次决定的结果，不新增 job 状态；业务恢复分母直到 Website admission 或合法永久终止才关闭。health投影统一按H1优先级：Cloud/ledger不ready→blocked；否则draining→draining；否则Authority present、logger可写且lane非blocked→ready；其余blocked。表中ready均限该前提，draining不冒充可发新输入，具体原因按H1当前事实投影。

| 入口状态 / 事件 | 唯一决定 Owner 与权威输出 | consumer / readback 与终态 | 恢复输入和回接 / 工单验收 |
|---|---|---|---|
| Cloud/ledger ready、非draining、logger可写、Authority present、Target absent、lane idle | Runtime 可执行投影 ready；Website 独立决定 claim | H1/H2 health 正常；不懒建 Target 读状态 | durable accept 后原 Browser acquisition；H1-1/H2-1 |
| Cloud/ledger ready、非draining、logger可写、Authority present、lane busy | Browser 串行；Runtime readiness 不误报永久阻断 | busy 行独立显示，执行可就绪不等于空闲 | 原 FIFO 释放后自动推进；H1-2/H2-2 |
| 原WAL DISPATCHED、Cloud/ledger ready、非draining、logger可写、Authority present、lane blocked | Browser新输入拒绝；Runtime execution投影blocked；若同时draining按上方优先级显示draining | 原 WAL 不变，H1/H2 执行行阻断；其他 job 也不输入 | 原 fact →§6；缺事实进入下行；H1-3/H2-3 |
| 原 worker/槽未知或丢失、无可信 terminal | Browser 管理结果未知；Website 仍管理 demand | 原未决 WAL/readback + 诊断，禁止伪结算；本行 EVIDENCE_GAP | 原补交可用才回§6；exact合法absence走删除行；无输入出口时持续有界检查，完整自动解锁设计阻断 |
| 原 fact 补交成功 / ACK 丢失 | Browser commit/readback，未ACK槽保留；重复只 ACK | 原行唯一 terminal、计数/时间不变；输入不重放 | 下一原认证 READY 同 fact；成熟回归 T1—T6 |
| 原 fact 错 hash、raw 冲突、foreign command | Browser 拒绝、无commit、无ACK | 不改历史、不清槽；未知未决保持 | 原正确 fact/当前认证，回§6；T7/T8 |
| commit 前 Store 失败 / commit 后 logger 失败 | Browser 前者不ACK；后者ACK已commit但不notify | 原行分别未决/terminal；新claim/input停止，已发确认不扣押 | 原 Store/logger恢复，当前原 receipt幂等交付；T5/T6/H1-4 |
| stale lease、renew typed拒绝、坏first fact | Website 唯一下一授权；Runtime停危险动作保全事实 | 同 job failed、有限下一动作；4xx/schema拒绝不续租重试 | 当前 V6 grant/source seal，不自签；原 Runtime recovery Exam |
| 有本地/Website有效结果或Outbox回复未知 | Runtime原Outbox优先同身份交付；Website原Consumer | staging/receipt全hash验证，未admission继续failed | 原result→admission，不重跑GPT；T9/H1-5 |
| Browser输入阻断或cooldown同时有可交付结果 | Website/Runtime/Outbox各自继续收尾 | renew/heartbeat/交付/consumer/readback不被health阻断 | 不把health值接入worker资格；H1-5/T10 |
| 合法旧结果拒收 / 全历史terminal且unresolved为空 | Website签同job新attempt/revision窄授权 | rejection/source/风险grant原identity读回，Browser重验门 | Product原入口，指定effect至多一次；原provider recovery Exam |
| 用户取消/永久撤权/合法exact job absence | Website原终止Owner；Runtime依exactabsence资源清理 | 不是成功入库；同job原slot/Target/WAL/三表/artifact absence | 原管理员释放链排handler→slot→Store purge；T11/T12；无本轮localization删除权限 |
| draining / Authority absent / Cloud或log不可用 | 原Runtime按上方优先级分别投影draining或blocked，停止新工作、保留必要收尾与诊断 | 既有维度分开、无执行绿灯；不新建worker | 原恢复授权/可写logger/新认证，非新Target猜测；H1-4/H2-4/T10 |

没有 receipt 的原命令不能由新 lease 或时间从本表跳到新输入分支。三张 job 的最后完成失败、当前 local EXECUTING 和全局旧 WAL 分属不同 identity，不能合并成一条新的 authoritative failure。

## 8. 施工准入与两张原子工单

### 8.1 先决门与未解除 GAP

D1：授权缺口已解除。按既定方案的具体函数和验收路径施工，先由主 Codex 对当前全部法案和施工图完成全文核对及两遍对齐审计；不修改冻结母本或 Skill，不覆盖另一任务修改。法案已定义分层诊断、未知事实保留和原 Owner 边界；本轮只补现有 Blueprint 的实现落点。无依据的百分比不能代替具体 finding 清零。

D2：这三张工单的完整自动解锁尚需原可信终态；原 worker/槽事实不可得时，现役法没有自动合成终态出口。本轮不新增新目标结构来填补这个未知，不承诺 WO-H1/H2 会恢复三张任务。如业务要求原事实已丢失也必定自动放行，须另行明确批准改变受影响冻结规范并先设计新的可信事实来源；没有该批准，该事故自动解锁目标保持事实阻断，不能把重试次数、超时、新fence或删除gate作为替代证据。不是将人工阻断伪装为恢复成功。

原 fact 后来自行到达时，仅按现役成熟链结算；仍需 Website 当前准确授权和最终业务 readback。D2 是当前事故完整恢复的事实/范围缺口，不妨碍说明现役合法结果未知分支；不能因静态检查成功把它抹掉。

### 8.2 WO-H1：Runtime 执行就绪真实投影

- Owner / 仓库：agent-production-runtime / AGENT。精确生产施工面 `src/lib/local-runtime/production/runtime-loops.ts:readHealth` 和 `src/lib/local-runtime/production/operations-snapshot.ts:localRows`；直接原生验收链为 `scripts/acceptance/agent-production-runtime.acceptance.ts` 已有的静态 import → `scripts/acceptance/agent-production-runtime-proof-boundary.acceptance.ts`；新增行为用例仅写后者，不新增 support、导入桥或入口。一个原子责任是现有执行状态及其当前原因的连续投影，消除lane/log执行绿灯和当前执行原因缺失/抄旧错误；不改claimAdmissionEligible、workerIteration、grant、Source Handoff、store或Outbox。
- 当前必要性：§3.3已证实错误，consumer为原RuntimeHandle/operations matrix/Workbench。当前AST读回runtime-loops文件351行、readHealth函数26行/参数1/return1/import14；operations-snapshot为210物理行（末尾LF拆分计211）、import8，localRows函数57行/参数1/return1/await0/复杂度12/嵌套2；验收主入口115行/import21且来源21，加入完整真实WAL用例会超过24来源红线；因此复用已被主入口执行的proof-boundary原文件37行/import6承载新增用例，原断言全部保留，新增后仍核文件≤500、函数≤75、来源≤24。现役上限文件500/函数75/参数7/return8/嵌套5/复杂度16/await10/import28等由LAW-CODE-PURITY-001-V6 forbidden 0/2原生规则核验。localRows只余4个复杂度分支，因此一次局部表达式依次判定execution非blocked、Authority缺席、log不可写、lane blocked，原子产生现有reason_code和completeness二字段，再铺入execution行；不得重复判定完整性、新增helper、wrapper、接口或诊断码。预计增加不超过12行，最终仍必须函数≤75/复杂度≤16；原行其余内容逐项保留。原位替换函数和原测试入口，不向490行Browser Store或484行startup-health堆逻辑。
- 保留：Shell ready 与 Cloud、Authority、Target、lane、claim 分维；Target absent 不挡 claim；busy 是串行执行能力并非全局 unknown；draining 不 abort Product；健康字段不成为恢复 authority。
- 顺序：重新绑定D1 → 物理删除readHealth原声明片区及旧执行资格表达式 → AST确认声明缺席且无新别名/副本，保留imports和调用引用 → 同路径重建唯一readHealth，使用原logger、Browser和ledger公开reader → 物理删除localRows原声明片区 → AST确认缺席且无替代别名/副本 → 同路径重建唯一localRows，保留所有非execution行、identity/freshness/ref和现役公开reader，不读取私有WAL。函数重建不是覆盖整个共享文件。
- 输出规则：Cloud或ledger不ready则execution blocked；ready且draining则draining；其余只有 authority present、lane不blocked、logger可写才execution ready，否则blocked。browserState继续表达Authority；claimAdmissionState保持现役语义；lastErrorCode保留原生事实，不从WAL/字符串编造第一失败；字段、类型、枚举、checkedAt格式不变。
- execution行原因：execution非blocked时reason_code=null、completeness=COMPLETE，旧lastError不随行冒充当前原因；blocked时按当前Authority缺席→logSink非ready→lane blocked选一条真实可证阻断，分别复用BROWSER_AUTHORITY_ABSENT、RUNTIME_LOG_SINK_UNAVAILABLE、BROWSER_LANE_BLOCKED，完整性为COMPLETE。没有这些可证原因时reason_code=null、completeness=DIAGNOSIS_INCOMPLETE，不从旧lastError猜Cloud/ledger当前首因。前述COMPLETE仅表示该投影源可读，不表示唯一根因或业务完成；所有独立轴继续展示。ProductionRuntimeHealth不增加字段，operations-snapshot.v1原nullable reason及完整性枚举不变，不写first failure、任务或任何恢复事实。
- 正向验收：H1-1 Cloud/ledger ready、非draining、logger可写、Authority present+Target absent+idle可执行；H1-2相同前提busy可执行且lane仍busy；H1-3真实原Store DISPATCHED导致lane blocked，readHealth不得ready，读状态前后WAL/物理输入增量零；H1-4 logger不可写/Cloud阻断/draining及同时draining+lane blocked均按输出优先级正确；H1-5有效staged/Outbox在lane blocked时原交付路径仍运行。用实际readHealth和原Store/Runtime fixtures，不只手写公式；经实际readProductionOperationsSnapshot核execution行、Authority/log/lane/WAL独立行。H1-6分别用lastError=null及无关旧lastError核lane阻断原因BROWSER_LANE_BLOCKED；Authority/log当前阻断对应原码；ready/draining不带旧错误；Cloud或ledger blocked且无公开可证原因时行必须DIAGNOSIS_INCOMPLETE，既测null也测残留旧错误，不能伪称COMPLETE。施工隔离验收中逐次暂删lane/log条件或恢复旧execution reason抄lastError，运行同一原native验收必须失败，再恢复本次函数通过；不新建AST checker或另一质量入口。
- consumer readback：createRuntimeHandle.readHealth/operations-snapshot → buildProductionRuntimeHandle → GET /api/production-runtime/operations-snapshot → 原client矩阵，execution状态/当前reason/完整性与独立lane/WAL源一致；Workbench两处readHealth → GET /api/health继续消费原接口。startup service-readiness只验健康report身份/结构/fingerprint并回传status，不把execution值接入worker/恢复门。本轮不改这些调用方，Website next_action与job/demand不因health改变，不增UI重试。
- 完成门：当前误报反例被消除且上述不变量守住，原入口普通检查合格；按本轮 CI-FULL 授权连续运行 CHANGE、clean commit、READY，再核 RELEASE 资格。失败停止、不写任何job/WAL；在排空和保留已提交事实后，只撤本工单diff，接回原worker，不reset共享文件。
- 依赖：D1开放后先H1，H2消费H1原合同；D2不被H1解除。删除范围仅两个函数片区，旧声明、执行绿灯错误式与execution行旧lastError直抄式结构零残留；不删除调用方制造无人消费，不改变其它行的正交诊断字段。

### 8.3 WO-H2：Shell 分开展示认证与页面执行阻断

- Owner / 仓库：local-app-shell / AGENT（Manifest明确拥有workbench-status）。精确生产施工面 `src/lib/local-runtime/workbench-status.ts:readAiProductionComponents`；验收面 `scripts/acceptance/local-app-shell.acceptance.ts`。不改 src/app、总health、API、页面自动行为或Website控制室。
- 当前必要性与承载：当前AST读回workbench-status文件143行、目标函数40行/参数1/return2/import2，验收83行/import5，符合相同原生预算；现有公开health已含Authority/Target/lane，无新增字段或第二快照必要性。
- 顺序：H1原字段可用 → 删除原readAiProductionComponents声明片区并AST确认缺席 → 同路径重建唯一函数。productionRuntimeBrowser.ok需browserState ready且lane不blocked；detail继续分别展示Authority/Target/lane，Target absent不作为block；productionRuntimeExecution仅消费H1。
- actionableMessage：认证缺席指向现役配对/认证事实；认证在但lane blocked指向原Browser未决事实与补交/合法exactabsence门，明确保全工单和禁止盲重放；不得指示操作员通过新Target、reload、重启、删WAL或删除这三张localization任务解锁。Cloud、log、draining沿原所属Owner表达，不把所有阻断归因为缺回执。
- 正向验收：H2-1 idle/Target absent不假红；H2-2 busy不假红；H2-3与真实H1 blocked快照组合，Browser/Execution两行不得绿；H2-4Cloud/Authority/log/draining分别显示，Shell诊断仍可读取，读取没有配对、claim、retry、Browser输入或存储写入。原local-app-shell native验收调用实际getHealthReport；施工隔离验收中暂删lane判据应使同一native验收失败，恢复后通过，防止回到旧单维绿灯；原Owner/接口AST反例全部保留。
- consumer readback：GET /api/health的分层components与原生产矩阵执行行读回；总status依原Shell/Cloud定义，任何healthy仅为该定义。最终业务完成仍按§10检查。
- 完成/失败/回退：H1/H2组合反例通过且原Shell边界不降；失败停在本片区，只撤本工单diff、保留所有其他修改和事实，消费者接回原接口。H2不得借失败扩成API/UI重构或新定时刷新。旧函数与单一browserState绿灯判据结构零残留。

## 9. 删除反事实与施工切换

每行回答当前必要性、真实GAP、直接consumer、Owner/输出、删除会失败处、更短复用和旧路径删除时点；没有通过的单元不进入目标链。

| 单元 | 必要性 / GAP、consumer与输出 | 删除的具体损失 / 最短裁决 / 旧路径退休 |
|---|---|---|
| 原Extension单槽/认证fact+ACK | 原终态跨断线仍需交付；Supervisor消费；Browser原fact | T1/T5丢事实、重复输入风险；复用原链，不加持久槽；无本轮替代删除 |
| 原verifier/Store/CAS/全局lane | 唯一不可重放事实；Runtime与lane消费原行 | T7及H1-3无法验真/阻断；已有最短链，不加第二writer；旧resolver当前无生产入口，禁止复活 |
| Runtime原worker/三表/Source/Outbox | 同job需求与同结果交付；Website消费source/result | T9/T10丢交付或制造replacement；原样复用，WO-SH在其原方案单独准入 |
| Website原claim/lifecycle/Domain Consumer | 唯一恢复与业务入库；Runtime及catalog消费grant/admission | 无Website裁决或终点；保留原v44/v17与原事务，不加恢复API |
| H1原readHealth/localRows片区重构 | 已证实状态及当前reason错误投影；Handle/matrix/Shell消费 | H1-3/H1-4仍绿、H1-6丢当前reason或假COMPLETE；复用公开health、原reason码及完整性，不增结构；两函数各删→缺席→同名重建 |
| H2原函数重构 | 第二Owner误报；/api/health消费components | H2-3仍绿；复用公开health，不新增UI层；删除原函数再同名重建 |
| 原exactabsence释放/purge | 合法永久终止后的资源收尾；原Runtime/Store消费 | T11/T12残留槽/WAL或跨job删除；原样保留，当前三张不得调用 |
| 原各仓nativequality/现役Exam | 当前红线及防回归真实consumer | 无可信验证或产生第二裁决；只用原入口，无新checker/report |
| 原同路径方案 | 旧状态与绑定过时；执行Codex消费 | 无精确片区/验收会误施工；已删→缺席→同路径重建，无副本 |

新 recovery manager、timer、持久worker槽、Target registry、replacement job、第二store/queue、第四next_action、兼容flag、单凭时间结算和跨仓总PASS均不能通过反事实，已从方案排除。

本轮未来代码只在AGENT修改，不改跨仓合同、不改DB、无迁移。无双仓不兼容切换窗口：Website当前v44/v17与AGENT消费保持逐字canonical合同，只有AGENT当前字段的语义投影修正；Website作为只读业务终点核验方，不安排代码部署。

生产部署资格成立后，沿原停止接单与收尾链先停新claim/input、排空已接受执行/待确认fact/原Outbox；不能用abort截断。仍有DISPATCHED或未ACK槽则不得reload扩展；本轮根本不改变扩展artifact/protocol，无需为health改动reload。合同冻结点为当前v44/v17/protocol9；H1后H2，同一AGENT候选原生检查，再按请求等级发布。失败停止、保全已commit事实和原结果；在 main 仅撤回本轮函数diff，禁止覆盖其他任务成果、单端协议回退、旧artifact fallback或用分支掩盖dirty。

现场未决无法排空时，生产部署关闭；离线方案/隔离native验收不受它假冒生产证明。现役source-handoff额外施工、跨仓合同改动或新的lost-receipt结构都不在本轮切换范围，必须重新设计并绑定各仓主权。

## 10. 分层验收与不可降级的不变量

代码阶段只沿AGENT `package.json → npm run quality:check → scripts/audit/governance.ts quality` 作唯一质量裁决；Website若未来发生实际修改，单独走其 `npm run quality:check`。不得写第二总报告或把审计意见作为native PASS。方案及建设审查不作原生质量 verdict，建设与各级质量结果分别按当前候选核验。

成熟回归分母全部保留在原Browser authority/receipt/provider-effect/rule-mutants 与Runtime recovery验收，不删原断言以适配新设计：

- T1：原handler断线后有界收尾、单槽固定一次terminal，重连同fact可补交；原worker/槽丢失保持未知。
- T2：normal REPLY与reconnect fact物理汇流同一verifier/Store；一个fact只能结算一个command。
- T3：receiptBindingHash、完整receiptHash、raw投影、计数、时间、locator严格验真；旧Target不是恢复资格。
- T4：一次原行CAS、commit/readback后ACK；完全重复只ACK，历史terminal/输入数不改。
- T5：commit失败无ACK，ACK失败保槽；下次认证只幂等重交，不补发原mutation。
- T6：commit后日志失败仍ACK、不notify/pump，停止新动作；确认已发事实不依赖再写日志。
- T7：身份/hash/字段/raw-body冲突、foreign、乱序、重复server sequence拒绝，零新输入。
- T8：任一全局DISPATCHED阻断所有job新mutation，Provider-history zero不覆盖target_local未知；default count=0不是终态证明。
- T9：同一有效result stage+terminal原事务成立后优先原Outbox交付；cleanup/历史failure不能撤销；未知回复只查/重投同bytes。
- T10：lane block/cooldown/draining不偷停renew、heartbeat、已发确认、原result交付和Website Consumer；Target absent不挡授权claim；scope/outcome/Provider输入正交。
- T11：仅Website exact job absence可管理员释放，先排原handler再验证同job物理Target释放/缺席、清原槽、Store exactpurge；释放失败不清槽/WAL。
- T12：其它job槽/Target/WAL保持，普通release不跨DISPATCHED；管理员delete不伪造terminal/ACK，不报告业务入库。
- T13：附件旧三种入口与primary OR、exact批准字符串/文件集合、零/一次上传/submit门保留，不把本轮阻断当附件DOM问题。

H1/H2新增行为验收见工单，只在已点名的原验收执行链调用实际函数和原fixture，不新增或改inspector、Manifest、registry或package，不建第二检查器。原Static/Exam的既有断言和反例保留；暂改条件的反事实只在施工隔离候选内执行，恢复精确本轮函数后才进行最终候选检查，不碰共享运行源码或生产数据。

动态验收必须另有权限，按同一现场job永久身份读当前Website授权、实际原WAL结算或合法阻断、Product/结果identity、Outbox及artifact receipt、staging、Domain Consumer和完整admission hash。固定catalog任务还核对应冻结batch/source/policy：本次新写entry的origin.result_payload_hash/business_consumption_hash须匹配本次结果和消费；原有source/policy正确的合格entry按原代码保留并核其原origin，不要求改为本次job；字段失败与当前source/policy/cohort漂移未激活分别读回和报告。它们不能被health绿灯覆盖，也不另造失败门迫使已合法接纳的job重做。job admission不等于整站所有翻译已生效。

未取得原terminal：如实记录未决阻断，输入增量必须零，继续有界对账；这证明安全分支，不证明三张job已恢复完成。未取得admission/readback：仍未交付。三张job当前没有这些证据，不能提前写达成。

## 11. 建设审计与执行者重绑定

此前主 AI 三轮及两名只读审查者放行的是方案文档内部一致性，不是建设代码或质量结果。当前授权解除 D1；D2 和缺失跨仓 Skill 不因此消失，Website 不进入写面。前序施工基线为独立分支 b30758f8；最新授权合并后的工作区与基线见§1，方案自身不作为源码质量 candidate。

施工前由主 Codex 全文读当前两份法案和七份施工图，双遍回读闭环 Skill；先审 authority/Owner/合同与法案零漂移，再审本轮 Blueprint 对齐、删除分母、结构预算、实际 consumer 和可取得验收。两遍未有剩余内部 finding 后退出设计 Skill，开始独立施工。

建设先按各精确函数删除 → AST 缺席 → 同路径唯一重建，再在 Runtime 原入口已导入的 proof-boundary 和 Shell 原入口补实际函数/原 Store 的行为反例。主 Codex 完成至少两遍实际代码与方案差异自检后，才启动只读子智能体审建设：逐 WO 验实现、验收和 consumer，逐闭环 Skill 核删除与有限分母，逐现役法案核 Owner/未知事实/质量边界。子审不得写文件或并发施工；未放行不得结束建设。审查意见不作第二质量 verdict。

当前三个生产函数已实际完成删除、缺席读回及同路径重建。主 Codex 两遍建设自检核源码与方案、Owner、原行保留、消费方向及删除分母；类型检查合格，函数行数/复杂度分别为26/15、66/16、44/13，均在现役红线内。原 Runtime proof-boundary 和 Shell Exam 的新行为用例已运行；四个故意恢复旧错误的候选均被原生验收拒绝后精确恢复。原 Runtime 全套 Exam 的一次本地诊断调用在55秒外层期限结束，不能当作全套通过；随后原分支 CHANGE 因最新合并请求定向停止，也未取得最终 PASS。最终全套质量由 main 合并候选重新调用下述唯一原生入口裁决。子审只核实际建设，不沿用此前文档放行；合并带来的候选变化须重新核对实际代码及其依赖。

冻结 ci-full-governance 连续执行原生 CHANGE → clean Git commit → READY → RELEASE。任何原生失败先完成一公里、五公里、十公里临时鉴权，修复后回 CHANGE，不持久化第二报告。普通状态投影及 Exam 增量不修改治理主链、不构成大规模迁移，因此不自动触发母本 §79；若实际范围变化触发，按当前原生报告与全新独立审查者执行。

实际质量与原事故恢复分开：原命令缺可信 terminal 保持未决，未有 Website admission 和 catalog 领域读回不得声称恢复完成；main 合并候选各级质量均重新执行，不继承另一 Codex 的报告，也不得借共享运行身份替代本次候选的 RELEASE 证据。