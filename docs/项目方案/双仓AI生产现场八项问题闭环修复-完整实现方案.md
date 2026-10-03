# 双仓 AI 生产现场八项问题闭环修复：完整实现方案

状态：**已获施工授权，处于代码与质检重构阶段。施工前双仓现役法案/施工图完整遍历及两遍主审已完成；片区扩面至61个完整文件，均已整文件删除读回，60份必要实现/验收重建，1份失效检查器永久删除。第4轮ASI finding已按整文件清场纪律重建完整AST结构投影，主AI完成两遍自检，当前第5轮整候选待三名审查者复核；原生CHANGE、READY、RELEASE尚未取得当前源码候选的通过结果。片区行数、函数数及圈复杂度均下降，圈复杂度降幅很小；四项RELEASE原生证明缺口保留。**

本文原位取代 2026-09-26 的施工指令。历史内容可在 `0838ca195` 的同路径读取；历史施工事实不倒写，历史未关闭事项见 §3。授权人于本会话随后明确授权按照既定方案执行，范围为必要的法案、施工图、代码、质检和数据库操作，并要求冻结 ci-full-governance 连续治理、只在主仓 main 施工。文档通过审计不代表代码已修复，也不代表 CHANGE、READY、RELEASE 或生产成功。

## 1. 强制施工方式与当前需求

授权人 2026-10-03 重申：片区是当前根因整条线，包括前方生产者与后方消费者；必须整文件物理删除后重构，即使只错一行也不允许补丁。删除是清场，重建必须来自现役法案与本方案，不能恢复旧链、添加转发、兼容桥或改名搬运。该指令覆盖技能中通常允许的局部修改选择。

因此撤销本轮早期的三个补丁设想：给三处 handler 增加 `allowNoMutationOutcome`；在 Target claim 前增加一行等待；在错误返回中单独补字段。施工必须先删除 §7 的完整文件并逐文件读回不存在，再按 §6 的职责和 §8 的有限分支重新写出唯一主链。不得以最终 diff 看起来相同代替删除过程证据，不得先写替代文件再删旧文件。

需求 Owner 是 AGENT `agent-production-runtime` 的跨仓生产交付入口；具体改变的决定分别属于 `gpt`、`local-browser-session`、`runtime-log-spine`。目标是消除已证实的原子事实接受断裂和物理资格发布断裂，保留失败的真实原因，最终沿原 Product、Outbox、Website Domain Consumer 取得同身份 admission。Website 现役消费和恢复职责只读绑定，不改派给 AGENT。

唯一方案路径就是本文。不新建根治方案、审计台账、恢复文件、状态表、队列、计时器总线、兼容入口或质量 verdict。主 AI 是唯一写者；子智能体只读审计。方案按闭环 SKILL 完整读两遍后建设，并使用原子职责守门 SKILL；施工授权已取得，不免除各项前置门。

授权人追加硬规则：**只能降低复杂度，使逻辑更简单，不能增加复杂度。** 本方案以删除重复裁决和无责转发闭环：两份 GPT 事实映射归为一份纯投影；三处导航完成编排归入现役唯一生命周期；删除 reply 内的 `settleInvalidTargetCleanup` 转发及其错误再解释；原终态接纳不再被动作后的 live claim 资格重新裁决。零新增 Owner、字段、协议版本、错误码、持久结构、队列、恢复通道、兼容入口和治理文件。原 CAS、slot、ACK、输入前资格与领域接纳安全分母不削弱。施工前后用现役结构扫描和本节这些实际删减项核验，片区总实现复杂度必须下降，所有文件/函数继续满足原生预算；不能靠挪文件、包装或放宽检查取得表面下降。

## 2. 当前 authority 与候选绑定

| 对象 | 本轮绑定 |
| --- | --- |
| AGENT | realpath `/Users/nexgen/Documents/AGENT`；`main`；HEAD `aa626f987bad9af4bef74fc1405b2edf1bc912d6`；tracking `origin/main`；HEAD 与 origin/main 相同；仅本文有未提交修改，授权人已于本会话明确指定继续审计并更新该版本；其他路径干净 |
| Website | realpath `/Users/nexgen/Documents/xuanxue-web`；`main`；HEAD `3f81a8c70578e9edb6558ff2379b430d783bac68`；tracking `origin/main`；只读，工作树干净 |
| 两仓根入口 | `AGENTS.md` 同字节 SHA256 `861569b40c535f2180511885df05d53ec893e4e746475c16e182a395bbd7e91e`；命中源码与验收目录未发现更具体 AGENTS.md |
| 两仓顶层说明书 | `docs/governance/法案系统建设说明书-冻结定稿版.md` 同字节 SHA256 `27a143ecd7016887d056255e106f49caa29d83d06245ff21ea5c0ffd62b98c3a`；完整读取源头，generated registry 仅定位 |
| AGENT 基础法案 | `.github/instructions/agent-rules/基础法案.md` SHA256 `f1970c2416127f8bcdf560d0fd81105895924c4ed2cdd23f6a08ae910998d2f3`；`LAW-CODE-PURITY-001-V6/-002-V2/-003-V3`；存在性冻结要求不因重构削弱 |
| AGENT 功能法案 | `.github/instructions/agent-rules/功能法案.md` SHA256 `37fa293fc9fcee920c855936fe9c3887ac5885da09aa8dfb89977f2a37aad752` |
| GPT Blueprint | `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md` SHA256 `a24b8f064532da38fbb9d6e8d7b0ce3ffcc03988b56d30321b713a364b400ba7` |
| Browser Blueprint | `docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md` SHA256 `124fec0b9be9fe1220d8b6639c2c7aca30ea05dfb2308ca633953783e2e339f7` |
| 双仓 Blueprint | AGENT `docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md` SHA256 `8c2c5e67cae3283f6b94e17c3d38e92c95034e55be31e8fc3c1e3dcc40037e90`；Website `docs/blueprints/SYSTEM-BLUEPRINT.md` 与 `docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md` |
| provider/dependency | V6 version **44**：Website `docs/specs/ai-acceptance/xuanxue-ai-production-v6.contract.spec.json` ↔ AGENT `docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json`；task/result version **15** 的同名 provider/dependency；均按 providerRepo/contractId/version 绑定，不拿旧方案 version 代替 |

直接适用法条：AGENT `LAW-GPT-001-V64/-002-V31`，`LAW-LOCAL-BROWSER-SESSION-001-V4/-002-V6/-003-V45/-004-V56/-005-V6/-006-V45`，`LAW-RUNTIME-LOG-SPINE-001-V7/-002-V4/-003-V6`，Runtime `LAW-AGENT-PRODUCTION-RUNTIME-001-V75/-003-V43/-004-V43`，Architecture/Capability 的现役唯一 Owner、不可私有跨层依赖与子能力原子性条款。Website 对照 `LAW-PROJECT-GOVERNANCE-010-V1`、`LAW-AI-ACCEPTANCE-001-V7/-002-V31/-004-V30/-012-V40/-013-V24`、`LAW-LOCALIZATION-013-V18/-019-V17/-020-V26`。法案/BP 经前置主审无需变更；施工授权不把方案升级为 authority。必要修改仍须符合母说明书和现役合同。

设计绑定使用两仓原生 HEAD、tracking commit 与附录精确读取/清场路径，源码与 authority 在这些 commit 内；方案自身为获授权 overlay，独立读回文档 bytes。执行前核对这些路径的 Git 状态和实际内容；相关漂移重开受影响设计，不创建自定义质量候选 receipt、第二联合 hash、registry 或报告。READY/RELEASE 的身份只认 clean 原生 commit（母说明书 §49）。不通过分支、stash、reset、覆盖并发改动绕过。

### 四维约束与本轮落点

| 根因 | law 精确定位（功能法案） | Blueprint/当前实现 | 工单与证据终点 |
| --- | --- | --- | --- |
| R-G | GPT-001-V64:725、GPT-002-V31:778；Capability-001-V18:547（局部语义/零或一次动作/禁止中央classifier） | GPT BP §唯一Owner/Browser边界/证据；child-handler默认confirmed、failedBrowserFact另映射，close handler合法no仍拒绝 | G-F/C/P/A/R/O/E/X；G1–G11、原Browser fact→Child proof→Product receipt→领域admission |
| R-T | Browser-004-V56:1059、Browser-006-V45:1149（当前Document/2.5秒/精确导航/不授业务权） | Browser BP:53/65、GPT BP:98–107；authority导航后frame替代Tab complete，CreatedTarget独立重新给30秒 | T；T1–T7、同Tab本次导航完成→唯一claim→现役interaction→原G消费者；unknown现场cause不冒认 |
| R-N | Log-001-V7:1183（稳定原因/原因果）、Browser-006:1149（封闭安全载荷）、Log-002/003:1233/1274（脱敏/唯一终态） | Log BP §事件合同；protocol schema revision9＋既有browser-errors；Extension包装码抹掉cause，现有formatter不接受三项nativeCause | N/L；N1/N2/L1，经既有errorCode→原span.failure.code，不扩wire/nativeCause合同 |
| 原结果接回 | Runtime-001-V75:15、003-V43:109、004-V43:153；Website AI-001/002/004/012/013与Localization现役合同 | 双仓V6 BP和AI-ACCEPTANCE BP；Runtime-business-admission / Website-business-result-consumer / localization域 | B1–B3，只在相同result hash领域admission及域对象readback完成；原恢复/Outbox保留 |

行号仅定位本轮 source；执行 Codex 必须按 lawId 与当前内容重绑定，不能用过时行号覆盖当前版本。scope中没有前端依赖施工，不引入替代 storefront-performance-system 或页面新机制。

## 3. 前轮连续性与回归裁决

| 既有事项 | 当前裁决与本轮约束 |
| --- | --- |
| 本文旧 W1 固定文案快照、W2 artifact 持锁、W3 双义缺席、W4 WAIT 时间、W6 自有关闭顺序 | 当前源码已有对应责任。保留各自消费事务、幂等 slot、精确缺席、有限检查时间、自有释放先注销后关闭等不变量；不重复增加第二实现。历史质量结论只属于历史候选 |
| 旧 W5 inert 已选中免点击 | 保持退休：`aa550261c→c439d4088`。不能为了本轮零输入事实把 `select_gpt_model_from_start_v3` 改成“已选中就免点击”，不能恢复 inert 读取资格 |
| 旧 W7 两个历史 submit job | job `aiprod_2e48943f…` 与 `aiprod_2ecfc2ce…` 的历史恢复阻断和 U-Z 未在本轮读回解除。本轮不清除、不重试、不风险授权；不把它们与 a433…的零 Provider 输入准备失败混为一谈。需要关闭历史事项时只能在原 Owner 下另行精确读回，不能声称本轮已解决 |
| 旧 W8 current_reason 冻结 | 当前 active law 已明确诊断字段不授权。本文不重开法案工单、不恢复旧代码字节钉方案 |
| 《连续运行八项问题根治》《顽固故障根治与重命名子能力退役》 | 原生 cause、DOM candidate stage、postcondition query、renew 有界恢复已有实现，作为本轮有限回归输入；既有 WAL 保有 cause 并不证明 observation 错误经过传输和日志后仍有 cause |
| 《Target系统地位与强制边界》《GPT新聊天强制聊天模式》 | Target/Document 非业务授权；fresh/continuation 由原 Product/Website 决定；Child 只作局部语义。重构不复活旧 Target locator、物理历史 registry、inert bypass 或第二恢复主链 |

## 4. 长日志与逐工单证据

输入附件为 `/Users/nexgen/.codex/attachments/ba43f368-c536-4455-98f7-7ec4668c531c/已粘贴的文本.txt`：285 行、277 个可解析事件，05:16:05.216Z–06:01:22.038Z，SHA256 `0eb7301f365bf66c8c146c95c991cbd145bfcf9de808cf24cb3637e2ed9f723b`。共同审计任务的另一份用户输入也已逐行重读：`/Users/nexgen/.codex/attachments/d276d613-8952-4d53-b993-dcd2f356ffae/已粘贴的文本.txt`，281行、273个可解析事件，05:16:05.216Z–05:59:17.518Z，SHA256 `011aa52424438ca1018dd735c31a9de75d7b7a68d2482cd93f6986acec8c2bef`。两份附件窗口重叠，独立绑定而不将273与277相加；固定分析分母仍是下文原日志2541事件。时间统一 UTC；用户“手动关闭 Tab 后系统重开才继续”的观察作为触发线索，具体先后以原日志和 WAL 验证。原日志路径：`/Users/nexgen/Documents/AGENT/.grasseye-local/runtime-logs/agent/d8bae802-0832-42a7-987c-00586c82844b-0001.jsonl`。

固定分析前缀截止 **2026-10-03T06:08:30.000Z**：2541 个事件，首事件 05:16:06.003Z，末事件 06:08:09.777Z，原始字节前缀 SHA256 `4a142c83e9bfbfbbaca6f05deaba605ac55809286dcaa790fb756570de9ac242`。`job.execute` 真实 terminal 33 次，19 failed、14 succeeded，涉及 17 个 job；14 个成功执行不能直接代替 Website admission。19 次执行失败的分母是 15 次 `BROWSER_TARGET_NOT_INTERACTIVE`、各 1 次模型 candidate missing、postcondition failed、GPT terminal fact required、submit receipt missing；独立物理丢失事件另有 4 次。回执缺失有 infrastructure 和 command 两个 BLOCKING 事件，不能因此算成两次提交。05:54 的错误 health URL 可能由本轮只读调查产生，不作为生产根因。

| job（统一前缀 aiprod_） | 流程与本窗口结果 | 证据含义 |
| --- | --- | --- |
| `7efc1982-fc3b-4c36-a45a-2f9621afa2c3` | 文章 en-US，原回答读回→结果→Website consumed 05:19:12 | accepted count=1，leaseVersion=5 不代表五次 attempt |
| `47632206-19c3-4399-a93f-cef41db91145` | 文章 ja-JP，profile open 失败→Website 新 attempt→consumed 05:28:33 | 当前 accepted count=2；不靠日志猜新 attempt |
| `a4330b41-9044-41ca-8f98-45fcac20285e` | 文章 ja-JP，准备失败→source handoff→Website 有限退避 | 05:17 的 attempt `20ddbb65-1839-42bb-8074-d4cc80ef2b95`，target-local 输入零，无 Provider submit；retry 06:17:27。随后只读 PG 已前进为 count=7、retry 07:17:40.943；**不是永久卡死** |
| `1cc2e382-3b80-4615-bd61-a9390ae75c30` | 文章 ja-JP，首轮准备失败→第二 attempt→consumed 05:25:48 | admission＋publication 定位，是终点证据 |
| `ae3fbce9-0b57-40d5-8d91-d61935a8fb86` | 文章 ko-KR，首轮准备失败→第二 attempt→consumed 05:34:12 | 同上 |
| `b514ce83-3f7e-4a7d-8dce-ca2eb15fd9d7` | 文章 ko-KR，首轮准备失败→第二 attempt→consumed 05:39:04 | 同上 |
| `546e4fe4-1cc1-432a-b557-48b10f06372d` | 固定文案 zh-HK，consumed 05:37:28，count=1 | current consumer v2，hash-bound receipt |
| `5471f1c3-6d98-4a01-bf62-1823248f684d` | 固定文案，consumed 05:40:44，count=1 | 同上 |
| `8308f586-8269-418e-9996-d2f3e55b4cfc` | 固定文案，consumed 05:42:22，count=1 | 同上 |
| `2d30453a-dbcb-4754-8e40-6525f3ef79f4` | 固定文案，consumed 05:44:04，count=1 | 同上 |
| `f5fac486-775e-4f70-9049-cb7ad485b61c` | 固定文案，consumed 05:45:43，count=1 | 同上 |
| `2a4f73a9-8d43-4075-afdd-8ca77eab86d2` | 固定文案，consumed 05:47:06，count=1 | 同上 |
| `c0db7167-4927-4b90-88f5-067af26c0701` | 固定文案，consumed 05:49:44，count=1 | 同上 |
| `5fa76d40-150d-4885-81aa-772a3b83b11a` | model menu candidate missing→3 次 fresh observation 不可交互→第五 attempt consumed 05:56:15 | 首动作 WAL REJECTED/no/0，native=`BROWSER_DOM_SELECTOR_ABSENT`；不能与点击后失败合并 |
| `2f37c641-a639-4d58-8106-152f3e8f59cc` | 固定文案，consumed 05:58:26，count=1 | current consumer v2，hash-bound receipt |
| `f0a1d6ce-a978-4fde-99bc-34d7952e2e6b` | close profile Browser 零输入确认→GPT 拒绝→后续准备失败 | 05:50:24 的闭环断裂完全可证；05:58 时 count=5、15m 退避，后续 PG count=6、retry 07:13:49.613 |
| `523d3c82-7e4d-4f46-a315-f02f4baffd4f` | 首轮 model 点击后 postcondition failed→准备失败→第五 attempt submit 回复缺失→原 worker 补交确认 | 06:08:08 收到确认；06:08 前缀尚未完成。06:25:41 同 attempt 重授 leaseVersion=6，06:27:15.449 local completed；零新 submit，不把旧快照写成当前仍失败 |

补充读回：原日志 2760/2761 是 06:27:15–18 的 production-admission-readback；当前 `production_tasks` 的 523d 为 completed，attempt=`ff234987-81a2-49ae-bf0f-5abd28bc2cad`。`runtime-business-admission.ts::reconcileBusinessAdmission` 只有同 job 的 domain admission receipt 与 staged result hash 精确匹配才执行 completeTask。terminal Outbox receipt 自身只证明 terminal 接收，不能替代该 domain 门。a433/f0 当前分别绑定 c31a…/fa1f…，仍 failed/source handoff pending。本窗口 17 jobs 的本地结果为 15 completed、2 failed；这些数据不证明当前网页使用旧译文或系统已发布。原日志seq2436/2437的cloud.claim分别于06:06:31.962开始、06:06:32.014成功；seq2438于06:06:32.117开始的是job.execute，不是claim。seq2440于06:06:32.518记录debugger target_closed；该通知只能定位Browser观测时间，不能证明人工操作发生时间或关闭责任方。用户关于手动关闭后继续的陈述保留为独立观察，不能从CDP通知倒推其精确操作时间，也不能冒认它触发Website授权。

真实存储只读源：SQLite `production_tasks/production_outbox/production_attempt_handoffs`；Browser `browser_mutations`；Website 本机 PostgreSQL `ai_production_jobs/ai_production_job_runtime/ai_production_job_events/ai_production_job_failures`、领域结果与 `localization_static_current`。PG 数值是前版本的只读快照记录，本轮不把该记录冒称新增实时 PG 查询；当前补充以 SQLite/原 JSONL/现役 admission 代码绑定。读取失败不记零。

前版本 PG 快照中九个固定文案 completed 行的 consumer 是 `localization-static-current-consumer.v2`，消费 hash 非空；`business_object_ref=null` 是该域现役合同，不是缺消费。该历史快照未在 current entries 中找到这九个消费 hash 的在用字段，因此只证明历史接纳，**不证明目前页面仍使用这九个结果**。源/策略前进后旧结果记账而不激活是 LAW-LOCALIZATION-020-V26 的明确要求；不会增造业务对象或回滚旧译文。当前是否被后继覆盖需按 source/policy/message membership 同身份核验；不以 completed job 数计算页面完成率。

前版 IAB 页面摘要没有在本轮复验，不用它证明生产 Chrome 的菜单 DOM；本轮未接管/导航/点击 Chrome。新 selector、退避缩短、关闭 Tab 的具体外部责任均没有当前证据，不进入施工。

## 5. 根因与第一断裂

### R-G：GPT 同时维护两套 Browser 事实解释

确证工单 `f0a1…`，attempt `56386f05-a6d7-4c74-9054-c514af89baf9`，command `5f73dde9-16dc-48d2-a976-72a9cc665408`，Child `close_gpt_execution_profile`，actionOrdinal=7。WAL 05:50:24.336 是 **CONFIRMED / no / physical_input_count=0 / direct-postcondition-passed**；Browser span 05:50:24.373 success；GPT 05:50:24.397 抛 `GPT_BROWSER_TERMINAL_FACT_REQUIRED`。

Browser 对 coherent postcondition 已成立返回零输入成功合法；GPT 的 `web/child-handler.ts::requireConfirmedBrowserFact` 默认只接受 mutation confirmed，而 `ability-group.ts::failedBrowserFact` 能接受 confirmed/no。共享 helper 的调用布尔选项再形成第三份局部接受政策；close/open profile/attachment control 又硬编码 ACT/confirmed。第一断裂在 **Browser 事实→GPT Child 接受**，不是 Browser 没完成，也不是 Website 退避不够。

重构从公开 Browser atomic outcome 开始，消灭成功/失败两份事实映射和调用方 boolean 策略。整文件删除共享接受器、所有实际消费者及下游 proof/result 适配文件；只用现役 Child contract 的动作语义和同一个 Browser 原子事实投影。零输入和一次输入是两个合法事实，不能互相冒充。

### R-G 的验收生产者断裂：真实计数与事实所属身份

现役`gpt-exact-target-browser-fixture.ts::markConfirmedMutation`将一次实际输入记作confirmed/count0；`readAtomicStepOutcome`比对请求与当前runAtomicStep，而未绑定事实产生时的完整identity，所以后续call可读前一call事实。artifact-recovery夹具同一原submit在atomic outcome记0、provider effect fact记1，且读回只比childId；browser-mismatch夹具分别只比inputHash或无条件返回历史submit。三份均是G消费者上游的真实验收生产者，不能留在片区外或只改常量。这些缺陷会掩盖原子合同断裂，但不据此反推生产WAL也有跨call污染。必须整文件删除后按原合同重建，纳入G-F/G-R和G10–G11验收。

### R-T：Tab 导航与 Target 发布资格分离

`extension-target-authority.ts` 的 continuation、parked fresh reset、conversation selection 在 `Page.navigate` 后只读取 main frame/URL/loader，未证明该次导航后的 Tab 已 complete 就 claim/advanceDocument。随后 `extension-interaction-readiness.ts` 才检查 `status=complete/discarded=false/active`，导致“已经授出 Target，再拒绝其交互”。既有 `ExtensionCreatedTarget` 只等待首次新建 home Tab；其等待完成不能覆盖第二次导航。

内存模拟运行真实 ExtensionTargetAuthority：让 navigate 返回正确 URL/new loader 但 tabs.get 仍 loading，当前实现仍发送 TARGET_CLAIM；紧接 observation 得到 `BROWSER_TARGET_NOT_INTERACTIVE`/native target invalid。现有 auto-pairing 夹具把 tabs.get 永远设 complete、navigate 立即改变 frame，遮蔽了此分支。**结构缺口已复现；15 次现场错误的逐次 native cause 已被丢弃，不能说全部由 loading 引起。**

本轮补充的可复放反例只使用真实 Authority 类与内存 Chrome API 替身；Node24 环境在AGENT根执行下列命令，无文件/DB/Chrome写入。2026-10-03运行exit=0，输出 `navigationCount=1, claimWhileTabLoading=true, observationFailure=BROWSER_TARGET_NOT_INTERACTIVE, nativeCode=BROWSER_TARGET_INVALID`。它证明结构反例，不证明现场15次均由loading引发，也不算Dynamic Proof。

```sh
node --import tsx --input-type=module <<'JS'
import assert from 'node:assert/strict';
import {ExtensionTargetAuthority} from './src/lib/browser/chrome-extension/extension-target-authority.ts';
let currentUrl='https://chatgpt.com/', loader='home-loader', loading=false;
let attached=false, navigations=0;
const frames=[], noListener={addListener(){}};
const tab=()=>({id:42,windowId:1,active:true,discarded:false,
  status:loading?'loading':'complete',url:currentUrl,title:'fixture'});
const chrome={
  runtime:{id:'fixture',getManifest:()=>({version:'fixture'}),
    getPlatformInfo:async()=>({}),reload(){},onMessage:noListener,onStartup:noListener},
  debugger:{
    attach:async()=>{attached=true;},detach:async()=>{attached=false;},
    getTargets:async()=>[{id:'fixture-target',tabId:42,type:'page',attached,
      title:'fixture',url:currentUrl}],
    sendCommand:async(_target,method,params)=>{
      if(method==='Page.getFrameTree')return {frameTree:{frame:{
        id:'main-frame',loaderId:loader,url:currentUrl}}};
      if(method==='Page.navigate'){
        navigations++;currentUrl=params.url;loader='new-loader';loading=true;
      }
      return {};
    },onDetach:noListener,onEvent:noListener},
  tabs:{create:async()=>({id:42}),get:async()=>tab(),remove:async()=>{},
    update:async()=>tab(),onActivated:noListener,onRemoved:noListener,onUpdated:noListener},
  alarms:{create:async()=>{},onAlarm:noListener}
};
const authority=new ExtensionTargetAuthority(chrome,async(kind,body)=>{
  frames.push({kind,body,loadingAtPublish:loading});
},()=>{},async()=>{});
authority.start();
await authority.acquireJobBoundChatGptTarget('authorized-continuation',
  'sha256:'+'a'.repeat(64),'https://chatgpt.com/c/fixture-conversation',()=>{});
const claim=frames.find(f=>f.kind==='TARGET_CLAIM');
assert.ok(claim);assert.equal(claim.loadingAtPublish,true);assert.equal(navigations,1);
const target=authority.resolve(claim.body.targetRef,claim.body.documentRef);
let error;
try {await authority.executeRegisteredCommand({kind:'observe'},target,
  'observation','sha256:'+'b'.repeat(64),()=>{});} catch(e){error=e;}
assert.equal(error?.message,'BROWSER_TARGET_NOT_INTERACTIVE');
assert.equal(error?.cause?.message,'BROWSER_TARGET_INVALID');
console.log(JSON.stringify({navigationCount:navigations,
  claimWhileTabLoading:claim.loadingAtPublish,
  observationFailure:error.message,nativeCode:error.cause.message}));
JS
```

重构从 TARGET_ACQUIRE/COMMAND 的既有绝对 deadline、session/fence 开始，直到物理资格完成后唯一 claim 和 downstream interaction guard。禁止第二导航、第二 scheduler、固定 sleep 当 readiness、GPT 补救资格或新持久 Target 状态。

### R-T 的失效资格处置断裂

`executeExtensionCommandReply::settleInvalidTargetCleanup`在回包前把原包装Error交给`retireInvalidCommandTarget`，后者只读error.message三项裸码，忽略`BROWSER_TARGET_NOT_INTERACTIVE.cause`，所以现役原生target/document/origin异常可能没有撤销active claim。仅将N回包改成第一原生码仍无法修复前方处置。该源码可达断裂纳入现有T/N完整文件，无新增清场文件；不能将其直接归因为每次现场失败。按§6同一Browser物理原因处理失效资格，T7独立正反验证。

### R-N：执行端原生原因在 Owner handoff 消失

Observation 的 `BROWSER_TARGET_NOT_INTERACTIVE` 在执行端有 cause=`BROWSER_TARGET_INVALID|BROWSER_DOCUMENT_INVALID|BROWSER_ORIGIN_REJECTED`；非 mutation 的 reply 当前只有 `errorCode`，`mutationReceipt=null`。strict parser/error class 无原生 cause 槽，最终 Runtime Log 的 `knownNativeCause` 又只保留网络/两种 Chrome code。即使执行端事实存在，调查端也无法区分 loading、Document 漂移或 origin 拒绝。

第一断裂在 **Extension 执行失败→认证 REPLY 解析**；之后 formatter 的 nativeCause 闭集也不能接受这三项。删除审判裁决：无需新增字段或扩大 nativeCause 合同；最早已有三项稳定 cause 应作为这次 observation 失败的权威 primary code，通过现有 errorCode 和 failure.code 贯通。重建现有 producer/strict parser/error consumer/formatter，禁止保留外层聚合码再从历史 DIAGNOSTIC 拼原因。mutation 则沿原 terminalReceipt 保留外层 failureCode 与 nativeCauseCode，不偷换 receipt。

### U：保留证据缺口，禁止猜修

523d… 的 command `b6d693bb-53a9-42d6-a85c-169efd78a9f1`：seq2517 06:07:07.473 DISPATCHED；seq2527 06:07:35.277 receipt missing；seq2539 06:08:08.165 原 worker 补交 CONFIRMED。WAL terminal_at=06:07:14.601 是执行端完成时间，**不是 AGENT 接纳时间**。现役 `websocket-actor::flushMutationReceipt→WebSocket::settleMutationReceipt→Supervisor::settleMutationTerminal→Store terminal CAS→ACK` 已补回原事实。首次 REPLY 未到的具体原因未证，不能为了它增加通道、重试提交或提前取消安全门。

实际 Chrome model candidate/postcondition DOM、四次 Chrome debugger target_closed 的最早外部触发责任同样未证。对于这些分支，本方案给出精确失败关闭和未来取证门，不承诺修复未查明的 DOM 或操作系统行为。

## 6. 原子工单与唯一新链

所有生产文件先按 §7 的联合片区清场；然后主 AI 串行完成下面各项 Owner 责任及其现役质检消费者责任。工单之间传真实 typed facts，不转移 Flow；不得按文件多少创造新 Owner。

| 工单 | 唯一 Owner / 权威输入 | 单个决定与输出 | 当前消费者 / 失败位置 / 验收 | 相邻 Owner 禁止 |
| --- | --- | --- | --- | --- |
| G | `gpt`；现役 Child contract＋Browser公开 atomic outcome＋coherent Child postcondition | 接纳本 Child 的唯一 Browser 事实并形成语义 proof。一个公共投影支持 success/failure，Child 判断本地后置语义 | 11 个 handler、ability group、production child result/support/tools、atomic readback；typed GPT failed/proof，原 Runtime Log。fixture 和领域 delivery 验收 | 不选 Target、不写 WAL、不签 attempt、不决定 Product 下一步 |
| T | `local-browser-session`；当前 TARGET_ACQUIRE/COMMAND deadline＋session/permit＋exact Chrome Target＋live registry | 同一次物理生命周期证明后发布唯一 current Target/Document；不是任务状态 | created target、target authority、interaction guard、target claim consumer。typed Browser failure；live claim 与0 Provider input 检查 | GPT/Runtime 不持有 readiness 计时或导航决策 |
| N | `local-browser-session`；原执行端失败的已知 typed code/cause＋认证 request identity | 现有 REPLY errorCode 交付 observation 第一原生 code，mutation 仍交同一 terminal fact | extension command/worker producer、strict payload parser、WebSocket、command actor/failure；闭集验证与 cause readback | 不传任意 Error、DOM、路径、URL；日志不能恢复或调度 |
| Q-G | `gpt`；现役法条/Child contract/真实新映射图 | 唯一GPT inspector验证事实接受、身份、frozen行为 | gpt-contract/provider/frozen-attempt三份现役inspectors；原quality消费；行为/变异验收 | 不通过删除旧token降低法条执法强度，不产生新verdict |
| Q-B | `local-browser-session`；现役Target/WAL/认证合同与新绝对deadline | 唯一Browser inspector验证真实物理资格及receipt闭环 | target-claim、mutation-settlement现役inspectors和原生mutants；原quality消费 | 不增第二quality入口，不把改名字符串当行为证明 |
| L | `runtime-log-spine`；N/G/T 已认证错误因果链 | 现有 failure.code 接纳 observation 第一原生 code；nativeCause 闭集/HTTP/causal event 沿原合同 | 原 formatter/logger/schema；one started/one terminal、causedByEventId、闭集 golden/unsafe rejection | 不写任务状态、WAL、recovery next action或独立 verdict |

### G 重建约束

公共投影替代 `requireConfirmedBrowserFact` 和 `failedBrowserFact` 中两份映射：从同一 `browserAtomicIdentity` 调公开 `readAtomicStepOutcome`，携原 exact-call/effect identity、terminalAt、authorityRef/hash，返回实际 `CONFIRMED/no`、`CONFIRMED/confirmed`、`REJECTED`、`DISPATCHED` 或缺事实。它不自己决定 Child 成功；没有新 policy enum、白名单、context latch 或存储。

投影保持 identity 命名空间：GPT proof 的 exactCallIdentityHash 仍由 gptExactCallIdentityHash(intent)产生；Browser/WAL exact-call 由原 lease/fence/atomic identity绑定，provider effect hash沿原WAL；不得把两个不同合同hash硬比较、抄成一个hash或改变算法。仅从当前 Browser facade按完整 atomic identity读事实，不在GPT直接查WAL。CONFIRMED的terminalAt必须非空、count/outcome合法；DISPATCHED terminalAt为空、无terminalPayload授权；no要求physicalInputCount=0。authorityRef/hash必须原公开事实可重读。对于字段不合法组合typed失败，不以null/default造成功。

所有 Child 的成功必须同时有本 Child 合法的后置证明；动作路径必须有合法 Browser terminal，不能把 missing/rejected/dispatched 当 success。open/close profile、model selector、attachment control 在同包后置已经满足且原事实 confirmed/no 时输出 DONE/no；confirmed/confirmed 时 ACT/confirmed。提前观察已经满足的路径保持 DONE/no/browserFact=null、零 Browser mutation。write prompt、prepare 的 stale draft 清理按其 exact draft 后置和真实 input 决定实际 outcome；不能继续硬编码 confirmed。attachment file 消费只允许其现役完整批准集合 receipt 和后置语义，不因公共投影接受 no 就放宽 file-input。

select model、select reasoning、submit 的现役 exactly-one input 路径仍要求 physical confirmation 和自己的动作后置；选中模型也必须点击并证明选中/菜单关闭，inert 分支保持退休。known-rate-limit ack 保留现役 ACT 语义与批准的原 WAL/同 epoch clearance 特例：只读取已确认 ack 或批准的 clearance，零输入 readback 不冒充新点击；不能机械把所有 no 都转换为 DONE。现役 provider submit confirmed readback 保持零新输入，携原 effect 与 terminal payload，不另造 submit proof。

ability group 从公共投影形成成功或失败 proof；移除二份映射、boolean options、硬编码冒认 outcome 及其仅为旧链存在的导出。production atomic/result/support/tools 整文件重写只承担其已证明的 identity、Child执行、receipt适配与异常传播责任。职责分母明确：atomic-call 绑定 context/atomic identity 与一次执行，atomic-readback 只消费原 provider terminal 或现役批准 clearance；child-result 保留 confirmedSubmitIdentity 的原字段匹配与 effect hash、recordConfirmedSubmission 的原 locator绑定、完整 artifact持久化与 Product receipt适配；child-support 保留原 Browser fact/Child proof/confirmedReadbackMismatch 的因果异常与 span封口；child-tools保留真实 Product单次Child调用、原提交事实枚举与 Runtime限流port，不拥有Product Flow或 Website恢复授权。`submitEffect` 只校验原 provider effect 与 hash绑定，不能变成第三份 target-local 状态映射：不在 adapter 中重新判 Browser terminal，不把历史 failure 作为授权，不新增转发 helper。所有既有公开入口保留真实消费者所需签名，不保留无人消费的壳。基础法案预算逐文件/函数校验：500物理行、75函数行、7参数、8返回、5嵌套、16复杂度、10await、28import declaration、24source/命名export；不能为过预算新建转发文件。现役target-authority已494行、WebSocket481行，重构必须通过删除重复流程/内联无责桥取得余量。

三份命中夹具的完整责任重建：shared browser fixture用真实当次输入计数生成合法outcome/count；保存每份fact产生时的完整七字段BrowserAtomicStepIdentity与原lease绑定，不能拿当前执行identity替代origin，也不能用exposeInitialRecoveryOutsideAtomic绕过匹配。原initialRecovery只在同时提供并绑定原identity时可读。artifact-recovery同一原submit的公开atomic outcome与provider effect fact必须都为confirmed/confirmed/count1；恢复本次新增submit计数另为0，两者不能互换。browser-mismatch的历史submit读回同样精确绑定，只比childId/inputHash或无参返回均禁止。以上都在附录原文件内重建，不新增fake truth服务/持久存储或修改生产identity/hash算法。shared fixture同源调用者（profile/exact-target/attachment/proof/proof-submit）属于本轮清场，model/reasoning/name等未改变决策的既有消费者必须跑原回归；wait-support只服务原lifecycle节拍、未通过G事实投影，不据无参stub任意扩片区，回归若证实相同根因则按§7重开。

### G 的可独立验收施工单元

上表 G 是片区概览，不能作为一张合并工单执行。下面每行是一张原子工单；统一输入为 §2 当前 candidate 与其现役 `GPT_CHILD_CAPABILITY_CONTRACTS` 记录、当前调用 identity 和已验证 public Browser fact；唯一 Owner 均为 `gpt`，禁止取得 Website/Browser/Product 决定权。路径均为附录已有完整文件，不额外建工单文件。

| 原子工单 | 精确文件/唯一输出责任 | 直接消费者与独立完成门 |
| --- | --- | --- |
| G-F | web/child-handler：一份纯 Browser fact 投影，去除 requireConfirmedBrowserFact/allowNo 布尔策略 | 11 handlers 与 ability-group；合法 pair/terminal/identity 全枚举，shared fixture真实count与origin identity，G10/G11 foreign negative，观察/transaction不造WAL fact，无第二映射 |
| G-C1 | children/prepare_clean_gpt_chat/handler：当前空白 Chat 模式与隔离草稿的局部 proof | handler-registry/ability-group；G1–G5＋精确 draft/mode、零或一次输入 |
| G-C2 | children/open_gpt_execution_profile/handler：当前 profile 弹窗已开 proof | 同上；G1/G2/G3 与 popup 单包后置 |
| G-C3 | children/open_gpt_model_selector_v3/handler：模型菜单已开 proof | 同上；G1/G2/G3，候选缺席/多义不得成功 |
| G-C4 | children/select_gpt_model_from_start_v3/handler：现役模型点击、选中/菜单关闭 proof | 同上；G3/G6，保留强制点击与 inert 退休 |
| G-C5 | children/select_gpt_reasoning_from_start_v3/handler：现役 reasoning 解析及动作后置 proof | 同上；G3/G6、原 requested/resolved scale；本轮不改变推理映射 |
| G-C6 | children/close_gpt_execution_profile/handler：profile 已关 proof | 同上；G2 重演 f0 的真实 race，原 WAL no 不改 confirmed |
| G-C7 | children/open_gpt_attachment_control/handler：当前附件控制已开 proof | 同上；G1–G3、approved selector/唯一候选 |
| G-C8 | children/write_exact_gpt_prompt/handler：当前 exact editable hash proof | 同上；G7、当前同包 hash、零/一次 fill；不读原文日志 |
| G-C9 | children/attach_approved_gpt_files_once/handler：现役已批准 batch 的动作 proof | 同上；G7、完整 grant/hash/set/file-input、重复/foreign拒绝 |
| G-C10 | children/submit_exact_gpt_turn_once/handler：同一 effect submit 及直接 user-turn proof | 同上；G3/G5/G9、未知零重发、原确认零输入 readback |
| G-C11 | children/acknowledge_known_gpt_rate_limit/handler：批准 ack/clearance proof | 同上；G8、同 epoch/当前 Document、CONFIRMED ack只读，无新点击 |
| G-P | ability-group：按 Child 返回的局部判定形成唯一成功/失败 proof | atomic-call/child-tools；proof hash、WAL事实保留与 cause-event 因果，不中央裁决 Child 成功 |
| G-A | production-atomic-call：一次入场与原 atomic identity 转换 | child-tools/call-preparation；prior-outcome 守门、runAtomicStep 最多一次，无 prior 时才首执行 |
| G-R | production-atomic-readback：三类已批准 prior-outcome 读回 context | atomic-call；submit、ack、clearance分别正反验收，artifact-recovery/browser-mismatch完整历史identity正反矩阵，原submit count1且本次submit/点击增量0 |
| G-O | production-child-result：artifact/submit locator/Product receipt 转换 | child-tools；原 artifact 双 hash、submit effect/locator 相符；不新存 URL |
| G-E | production-child-support：typed failure/cause-event 与 Child span 终结 | child-tools；失败原因/Browser fact/identity不丢、consequential 与 one terminal一致 |
| G-X | production-child-tools：当前执行入口/session 组装 | production-execution-session/生产入口；已批准 lifecycle调用一次，单次 executeOne，完整 child receipt回到原Product |

各行通用施工次序：联合片区全部清场已读回 → G-F → 各 G-C 主 AI 串行重写 → G-P → G-A/G-R → G-O/G-E/G-X → 原 fixture 独立验收及原 Product consumer 回归。每张工单必须读回自己的输出；失败立即停止该单及依赖，不拼装可运行的半链。恢复只回到原 Child/WAL/Website 已批准主链；不自行补步骤、签 attempt 或重放外部动作。以同一文档规定的整体候选回退，WAL/产物历史不倒写；通用门不免除每行列出的正向与旧不变量验收。

### T 重建约束

由 `BrowserTargetAcquirer::awaitTargetOperation` 在 dispatch 前从 waiter.remainingMs/commandTtl/native 上限计算同一绝对 deadline，将该值交 `requestPreauthorizedTargetAcquisition` 生成 TARGET_ACQUIRE frame，不能让 transport 再给完整预算。现役 Lane 继续唯一 FIFO、全局 observation 节拍与 release Owner；它只提供预算，不获导航恢复责任。重写既有 `ExtensionCreatedTarget` 生命周期等待职责，处理当前 exact Tab 的本次创建或导航完成；复用 `pendingTarget` 单一等待及 tabs.onUpdated 事件。不能新建第二导航 waiter、queue 或 timer registry；现有 orphan cleanup 的精确身份、有限重试、失败关闭必须保留独立证明，导航等待不能复用“超时删除候选 Tab”的破坏性动作。

从已认证 frame 的绝对 deadline 贯穿 websocket-actor→target acquisition→authority→created target。创建和导航复用同一个 lifecycle waiter；其调用期输入精确为现有 system Tab/Chrome identity、绝对 deadline、assertCurrentAuthority，以及本次是否尚未发布候选的 cleanup 权限。它不保存旧 locator、不生成业务状态。等待时只由 onUpdated 标记当前 waiter 可重新核验，不从 changeInfo/tab.url 授予 Origin；真实 main frame、debugger identity和Tab元数据仍从原 Browser primitives读取。onUpdated事件允许直接唤醒当前 promise，不占用持有它的 logical queue。authority取消/release/Tab移除使 waiter typed reject 并清定时器；待关闭的已绑定 Tab 不因等导航超时删除。所有操作结束后 pending/timer 清零，重复 complete/remove/revoke 不能发布二次 claim。已有等待 timeout 使用该剩余预算；2500ms read barrier、首次 home 完成、continuation 第二导航、parked reset均消耗同一预算，不在各段重新给完整 timeout。等待 Tab complete 使用 tabs.onUpdated 直接唤醒 lifecycle；该唤醒不能排队到仍被等待者持有的 logical-page-access queue，从而形成自锁。Page.frameNavigated 不得先于合格 lifecycle 偷跑 claim；`navigationPublication` 只协调原发布，不能作为第二恢复状态机。

lifecycle waiter 的 timeout 从绝对 deadline剩余预算建立一次，不能在 barrier后重新给30秒；0预算立即typed timeout，cleanup也不得转授新输入。authority已有 resetParkedTabToStart/初次continuation/conversation-selection 三处导航编排去重到既有 created-target 的物理完成职责，不能新增第二navigation服务或恢复loop。每次醒来先等既有读取许可，再重验 session/deadline、Tab身份/complete/discarded、debugger target identity/attachment、URL policy 和当前 main-frame loader；最后发送 claim/advance 前再断言当前 authority。初始候选按已有 attach 顺序建立；active 必要性在 interaction guard 保留，claim 不冒认用户窗口焦点。导航前仍执行现役输入门；continuation/current URL相同零导航，不同最多一次 Page.navigate，禁止改成 tabs.create(parent URL) 绕过冻结 Blueprint。

候选未发布时失败只清理当前 system 候选并确认 exact identity；parked/已经绑定的 Target 超时只使这次 acquisition/command typed fail，保留既有 resource release Owner，不能为了重试擅自删原 Provider 页面。浏览器物理 claim 不等于业务恢复资格，pending DISPATCHED/原 worker槽仍沿既有 recovery隔离处理。

施工读回发现同一释放链的直接生产者 `extension-target-release.ts` 与原严格接收合同不一致，纳入 T/Q-B 同片区整文件删除重构。当前 registry 无绑定，以及 registry 绑定的 exact Chrome Target 经 fresh readTargets 证明已物理消失，两种结果统一生产现役 `targetRef:null + releaseOutcome:absent`；确实关闭当前 exact system Target、fresh Tab/Chrome 读回物理缺席后才生产非空原 ref + released。发送前保留原 handler 排空、当前 job 验证及原读取门；关闭失败必须恢复原 registry，不清 slot/WAL，不改 strict parser，不新增协议字段或兼容形状。原 Supervisor 同 job pending release 是真实消费者。验收以真实 producer→strict parser→pending release 覆盖这四种结果，并验证跨 job 保留、普通 DISPATCHED 释放拒绝及管理员独立授权。

T失效资格处置与N传输必须同源。删除 reply 内的 `settleInvalidTargetCleanup` 转发；现役 command-runtime 只构成原不可变五字段回包，不在返回前撤 claim。Observation 用既有 Browser-owned primitive 取得第一稳定码；mutation 包括抛异常和返回 qualificationRejected DTO 两条真实路径，均由原机械 terminal receipt 保存原 failureCode/nativeCauseCode/count。DTO 路径的 failure=null 不代表物理资格成功；不得把它改成异常、重写 result/hash 或生成另一份失败 DTO。

现役 worker 的唯一顺序：命令执行形成原回包 → mutation fact 通过现役形状检查固定到原 mutationSlot → 沿原 sendTail 发送 REPLY → 用该回包中的权威失败事实处置同身份 claim。没有新返回字段、队列或延后清理状态。发送失败沿原断线 drain/补交链收束，已固定 slot 不清除；处置失败也不能改写原 terminal 或重发动作。非 mutation 不造 slot。Target 处置只消费既有 errorCode 或已固定 terminalReceipt.nativeCauseCode 的三项闭集，已有 selectExactGptConversation 后置失败的原 park 分支保留，不从 arbitrary message/日志再猜原因。

重写现役 retire 方法只撤失败命令的 active claim，保留原 park/registry/revoke 职责。输入复用该命令已认证 permit 的 targetRef/documentRef 和原 jobRefHash 绑定，原 Target registry 保持 Target/Chrome identity 的唯一对应；没有早期真实 resolve 身份的错误不得猜 active 对象。最后一次 await 读取许可后，同步比较失败身份与当前 active，再 clear 并发送原 revoke；不能比较后再调用内部 await 并重新读取 active 的无参 park。无 active 是已处置；新 job/Target/Document 则零 park/revoke/detach。未知原因不猜物理失效。处置不关闭 Provider Tab、不删 WAL/slot、不签 attempt 或授新输入；deadline/断线不授新动作，也不能阻断已发事实的原只读 drain。

Node 接收端仍必须先认证同一 REPLY/permit、验证原 fact/binding/hash，并由唯一 CAS 接纳、读回后 ACK。command-actor 对这个已验证的 mutation terminal 只终结一次，REJECTED DTO 和异常回包均保留其真实原因；删除其动作后 live claim 再裁决终态的路径，不能先因 claim 已撤抛 TARGET_INVALID、再遗留已 settled span。普通 observation 成功仍核当前资格；输入前所有 grant/fence/permit/current authority 检查保持。未认证回包、错误身份、未知 fact 或无 receipt 绝不借一条历史 settled 行冒认成功。原 terminal 事实可留存不等于可以继续输入。

### N/L 重建约束

重建 N 时严格复用现役协议 revision=9 和既有五字段 REPLY：`requestSequence,permitSequence,replyChannelToken,mutationReceipt,result|errorCode`，最后两种键互斥；非 mutation 的 mutationReceipt=null。成功体、mutation 异常体、fact/ACK、receipt binding/hash 和 normal verifier 均沿当前合同；没有新失败字段、新协议 revision、新错误码或兼容形状。

对于 non-mutation observation 的交互资格异常，原执行端调用既有 `browserInteractionNativeCauseCode` 取得 `BROWSER_TARGET_INVALID|BROWSER_DOCUMENT_INVALID|BROWSER_ORIGIN_REJECTED` 时，将该精确值作为 `errorCode`；三项已在现役 browser-errors/generated 闭集。删除旧“只把包装后的 TARGET_NOT_INTERACTIVE 传过去”的解释链。没有已知内层码时保留原已允许的 errorCode，不能猜具体原因；不能把任意 message 当稳定码。Node strict parser 保持五键、序列/permit/token/receipt 验证，terminal error 携这个真实 primary code，经原 Actor/failure/Child cause-event 传下去。不再保留无独立消费者的 observation 外层聚合码作为另一项失败真相。反向搜索实际 GPT/Product/Runtime 生产分支未发现依赖 TARGET_NOT_INTERACTIVE 精确字符串作恢复授权的消费者；Website 外层故障仍按当前事实/fence/source handoff 决定，version44不变。

mutation 的 errorCode 必须仍等于原 terminalReceipt.failureCode，nativeCauseCode 只从该原 receipt 取得；不能用观察路径的 primary-code 选择改变 mutation 的 resultHash、proof 或 WAL terminal。DISPATCHED/结果未知不从 cause 推断 no，观察错误不造 mutation/WAL 行。现役 `browserInteractionNativeCauseCode` 是 Browser-owned 事实闭集，不由 GPT 或日志导入为第二 schema。

L 整文件重写后维持既有 formatter 合同：`failure.code` 由当前 Owner 明确提交第一稳定码，允许三项本来合法的 machine code；不为本次 observation 增加 nativeCause 枚举/字段或 typed-contract 版本。原网络/Chrome 原生 cause、httpStatus、unsafe/cycle 脱敏、cause-event symbol、impact 仍保留。原 Browser span 的 failure.code 已是第一原生码；上层沿同一 cause-event 记 consequential，不制造新的 BLOCKING。本方案不声称解决所有历史 mutation nativeCause 的日志显示，只保护已在原 terminalReceipt/WAL 保存的原因并验收不退化。

该路线取代前版本六字段失败回包和 formatter 新 allowlist 的设想。删除它们后现有五字段/闭集就能闭合已知 observation 三项原因，故新 wire/版本/diagnostic缓存没有存在性证据，不进入施工。成对新 build 身份仍按现役 frozen release 规则重建、鉴权；旧 worker 槽必须先补交/ACK 或按另行授权的 exact absence 释放，不能为切换删槽或 WAL。

## 7. 片区清场：完整文件删除清单与责任重建

清单不是修改几行的许可。以下 **所有 production files 和命中验收文件** 在构建新主链前整文件删除；按既有路径重写有事实依据的责任，禁止 git checkout/restore、旧文件整体复制、改名复活或先覆盖再说已删除。合法的 domain public contract 和持久事实是边界输入，不为清场删除数据或修改 law。

全清场61个完整文件：33生产、8现役inspector重建、1失效inspector永久删除、19验收。生产文件按完整路径列在附录。G清场共享事实映射→11个实际调用者→ability proof→atomic执行/readback→production result/support/tools；T清场现役lane预算→target request签发→preflight→created target→target authority→interaction guard及同 job release 回执直接生产者；N清场extension reply/worker→strict transport→actor/failure；L清场现役 failure formatter；Q清场八个现役inspector整文件重建、一份失效inspector整文件永久删除及相关mutants。前后方不是只删三个报错 handler。

| 重建单元 | 当前必要性与真实消费者 | 删除后具体坏处 / 验证 | 重建与削减裁决 |
| --- | --- | --- | --- |
| G 事实投影 | 当前 confirmed/no 被合法 Browser 生产却拒绝；11 handlers 与 failed proof 真实消费 | 若无唯一投影，字段/identity在各 Child 分叉；重演 f0a 命令应被接纳；Q-G原生检查不能仍强制旧双投影 | 删除两套旧投影与 allowNo boolean，重建一个事实映射；它只映射，不替 Child 判后置 |
| G Child handlers | 现役 Product 明确调用这些原子能力，菜单/附件/提交有各自语义 | 删除且不重建会断开真实调用，零/一次输入夹具和整个Product回归证伪 | 从Child contract重写各自局部判定；无 generic done-handler、重试wrapper或Flow |
| G 验收生产者 | 三份fixture向真实Child/atomic-readback提供事实，已证count/identity缺陷 | 删除不重建会失去有效验收；count1/origin七字段与逐字段foreign negative必须证伪旧夹具 | 全文件重建同源原事实，历史输入count与恢复新增输入计数分开；无跨call借用、无新测试真相服务 |
| G proof/atomic/result adapters | 真实 executeOne、Product receipt与失败cause消费者要求identity贯通 | 缺失则原确认submit无法零输入回读，proof/receipt会断或冒认完成 | 重新证明每个函数消费者；逐文件按§6已裁决责任重建，删除无独立转换/验证的函数；不新增forwarding层 |
| T 物理生命周期与发布 | Home complete不能证明后续navigation complete；Browser目标消费者真实存在 | 未重建会继续claim loading Document；模拟/事件顺序/超时验收 | 复用唯一现役lifecycle等待，不额外抽出导航服务；原orphan清理需独立保留理由 |
| T interaction guard | 已发布后仍可能被丢弃、换页或焦点变化；真实observation/mutation消费 | 删除会让失效Target发输入；同页loader/activation drift fixture | 与发布门不同：发布证明时点、guard证明每次动作时点；完整重写保留，两者不复制业务恢复 |
| N 认证失败handoff | 当前cause在reply先丢失；WebSocket/Actor真实消费 | 只改日志也无法从null找回原cause；producer→parser闭集验收 | 重写同一加密通道现有严格五字段的稳定码接受，不新增诊断桥；已确认receipt及补交不改语义 |
| L failure formatter | 原cause即使穿过reply仍被formatter过滤；现役logger真实消费 | 日志若丢明确primary code则无法定位；golden/unsafe/cause cycle | 完整重写原formatter、保持既有合同，已有network/Chrome、httpStatus、causedByEventId行为逐项证明；零新allowlist/第二日志Owner |


Q-G 施工发现现役验收消费者 `gpt-exact-target-source-support.ts::assertGptExactTargetSourceShape` 将 normalization 钉在原 `production-child-tools` catch 内的局部结构，无法读取重构后的同 Owner `production-child-support` 实现。其消费者是 `gpt-exact-target.acceptance.ts`，不允许移除调用或放松反例绕开它；将该完整文件纳入同片区。删除后按真实 executeOne→handleGptChildExecutionError→唯一 incident closure/failed proof 链重建原 source-shape 反例，保留 rate-limit 紧急动作、冻结 submit 专属准备、退休 Flow 的物理缺席与 providerAttachmentName 合同；不恢复旧变量/转发、不增加检查入口或质量裁决。此扩面仅补齐已授权 Q-G 的直接验收消费者，法案和施工图不变。

Q-G 完整消费遍历进一步定位两份现役检查器仍执行退休源形状：`inspector.ts` 强制旧 model postcondition helper/局部 chosen 比较及滑块字面量计数；`gpt-attachment-contract-inspection.ts` 强制旧 mutationRecord 局部名。两者均由唯一 GPT native inspector 实际调用，必须全文件删除重建，不能只删旧断言或恢复旧代码形状。模型/推理强度及 coherent proof 的实质责任统一由既有 contract-inspection 读取真实 Child/私有 observation 调用与数据流，主 inspector 保留原两法五种/两种 Static mode、原 clause/receipt/type/dependency/filesystem 分母和唯一调用路由，附件 inspector 保留现役精确 selector、完整approved batch、same-packet后置、上传等待终态/NFC后缀/无物理路径职责。另 `gpt-page-proof-inspection.ts` 仍只选择已退休的 `web/children` handlers，实际Child分母恒为空；该失效文件整份永久删除，原 coherent decoder/URL/revision/完整assistant回包/禁止legacy reader约束并入既有 contract-inspection，并按真实14个Child目录核验，不增加文件、checker入口、Owner或verdict。仅减少重复/失效责任承载，不减少法条证据分母。

片区之外的边界必须有删除反事实：Browser public atomic API/WAL store 是唯一 durable 物理事实及 CAS，实测原 worker迟到确认已正确入同一行；Forensics只存完整回答artifact，Runtime只运输/完成，Website消费在同一事务finalize＋static current接纳并签receipt。删掉这些边界将直接丢身份或领域权威，并且当前G/T/N/L没有证实其另持一份同责任，因此保持原Owner/合同，不凭“还有import”盲留，也不为清场把不变职责全仓重写。施工若发现这些边界内仍存在本根因的第二解释/转发，立即扩大同一片区的**完整文件**删除清单、更新本文、重跑三轮与独立审计，不允许在原清单外加行绕过重构。

删除阶段只读确认目标Git状态无未授权dirty→停止使用旧代码的生产执行→整文件删除清单→读回所有路径不存在及D差异→同Owner重建。每步由主AI执行并在本方案既有施工记录说明结果；不新增删除台账/清理服务。新版本通过原生完整CHANGE、clean commit READY及全部声明Dynamic Proof之后才可RELEASE。业务数据、原日志、历史migration字节、WAL/Outbox/worker槽不属于文件清场删除对象。

N 的真实下游消费扩面：离线原 Actor→Supervisor CAS→WAL→readExactCallMutationFact 验收证明，`browser-mutation-authority.ts::terminalFailureFields` 以 BROWSER_ 前缀二次判定已鉴权 native cause，误拒绝原 receipt 合法的 ARIA_HIDDEN/NO_LAYOUT_BOX 等原生事实。将此完整文件纳入片区第60项，原 CAS 与 verifyBrowserMutationTerminalFact 仍为唯一闭集验证 Owner；读回仅保持原状态和原字段，不建立第二原因码集合、不改变 receipt/WAL/hash、不能把未知输入改成 no。保留该模块被 Store/evidence 真正消费的 requireMutationOutcome、ProviderEffectHistoryRow 和原 WAL authority hash resolver，整文件删除后从这些必要合同重写。法案/BP没有新增字段或职责；主审第1遍已沿 Browser-004 原生原因/唯一事实条款及 Browser BP 的唯一 CAS 接收链核对，第2遍反向核对 Node normal/late/error 均先闭集鉴权和 WAL CAS，再由本模块只读投影，移除重复前缀判定降低复杂度，不能删除原接收验证。未知 native cause 仍必须在原 CAS 前拒绝，验收应同时覆盖合法非前缀 cause 的落库读回、未知 cause 拒绝和原计数/终态不变。

### 结构承载裁决（本轮真实 AST）

以原生 `structural-metrics.ts` 和 ts-morph 对当前源码只读计算：

| 当前落点 | 文件行/类成员数 | 单函数最大 行/参数/await/圈复杂度 | 重建承载决定 |
| --- | --- | --- | --- |
| extension-target-authority | 494/30 | 54/6/10/15 | 禁止新增类方法堆功能；删除三处重复navigation生命周期编排，将实际完成等待归现役created-target；本类仅资源/发布/动作资格 |
| websocket-actor | 499/30 | 51/4/5/16 | 不加cause缓存/字段/新helper方法；现役acquisition参数传绝对deadline、现役五字段reply，重写接线与既有slot序列 |
| browser-authority-websocket | 481/24 | 51/5/0/10 | 无新wire字段、额外状态或解析链；现役parser/同一settlement汇流 |
| ability-group | 452/无类 | 60/5/3/16 | 删除第二failed fact映射，投影只用G-F；不新增中央判定或复杂分支 |
| production-child-tools | 423/14 | 66/7/6/16 | 保持现役七参数以内，重写已裁决session/一次执行责任；不加constructor参数或恢复wrapper |
| browser-lane-coordinator | 346/29 | 38/4/3/13 | 不新增方法、queue/timer/状态；deadline接线在已有入场路径，唯一FIFO/节拍保持 |
| extension-created-target | 215/21 | 33/2/6/14 | 复用唯一pendingTarget及本次物理生命周期完成责任；移除旧重新发完整30秒的计时路径，清理权限区分候选/已绑定 |
| extension-command-runtime | 166/无类 | 56/4/7/13 | 当前原错误码选取/机械fact职责重建，mutations沿原投影不变；不引入通用Error extractor |

其余整文件清场不授权越过原生budget。全部重建继续受500行、75行函数、7参数、8return、10await、5层、16圈复杂度、class30成员与import/exports约束；不可通过添加例外、移动复杂度到wrapper或弱化检查完成。没有承载余量时只在已裁决Owner文件间删除重复责任、复用现役职责，不在施工中临时发明服务/接口。

## 8. 有限分支与验收分母

验收由现役能力/合同的实际分支组成，不预造未来分支。下列各项均必须有有效证明；设计文档中的预期不等于已跑测试。

| 编号 | 真实分支 | 必须验证的结果 |
| --- | --- | --- |
| G1 | 初始coherent观察已满足 | DONE/no，Browser mutation增量0，不伪造terminal fact |
| G2 | GPT观察未满足，Browser准备时已满足 | 同exact-call后置包＋CONFIRMED/no/0→state Child DONE/no；f0a重演无terminal-fact-required |
| G3 | 执行一次后后置满足 | ACT/confirmed，原证据hash/identity一致 |
| G4 | CONFIRMED但Child后置不满足 | typed fail，仍保存真实effect与cause，不能改成no |
| G5 | missing/rejected/dispatched | 不能产出success，不再执行同call；Provider未知禁止提交 |
| G6 | select model/reasoning强制一次动作 | 已选中仍按现役contract操作；零输入事实不能骗过动作后置；inert资格仍拒绝 |
| G7 | prompt、attachment exact hash/set | 字节/集合/后置一致才成功；不能借零输入宽免上传或覆盖草稿 |
| G8 | ack点击/同epoch clearance/原确认readback | 保留ACT及原限流门，只有现役批准readback零输入，无新ack点击；ack仍ACT而非一般DONE，原限流clearance不得从普通no事实推断 |
| G9 | 原submit确认/原回答checkpoint/失败传播 | 原effect readback新增submit0；Child→Product proof/cause→Runtime同身份，完整observed artifact不丢 |
| G10 | 三份夹具的原计数/恢复增量 | no/count0及confirmed/count1真实生成；同一原submit两API都count1而恢复新增submit0；旧confirmed/count0变异必须失败 |
| G11 | 原事实完整identity/跨call/跨lease读回 | 七字段逐一漂移resultRevision/productStepId/callId/childCapabilityId/inputHash/actionOrdinal/replayPolicy均null或typed拒绝；A输入后B读A不能成功；target-local的wrong job/attempt/fence按原lease拒绝；provider-effect-once只沿原effect identity与现役授权读取，合法跨attempt原effect恢复必须保留，错误grant拒绝，不把attempt/fence塞进effect hash；合法同identity原readback保留，不改hash算法 |
| T1 | 新home已经complete或先loading后complete | 只发布合格当前Target一次，2500ms许可不算完成证明 |
| T2 | continuation navigation/loading/frameNavigated先到 | 未complete不claim；事件完成后鲜读URL/loader/Tab，最多一次navigate，Provider输入0 |
| T3 | parked fresh reset | old loader不可复用；新complete后发布，无重新分配预算 |
| T4 | 原effect conversation selection | sameURL零导航；differentURL一次导航＋资格闭合，新增submit0 |
| T5 | deadline/abort/session drift/Tab remove/Document drift | 无迟到claim/input；exact新候选才可清理；原Provider页面不得为等候超时擅删 |
| T6 | tabs.onUpdated与logical queue竞态 | 完成唤醒不自锁，Page.frameNavigated不能提前发布，release先注销后关闭不误报真实target loss |
| T7 | Observation 包装异常、mutation rejected DTO/异常、迟到及断线 | 原事实固定 slot 后先 REPLY 再 exact claim 处置；三项原因、repeat/无active、新 job/Target/Document逐项验证；slot 固定前后断线不造 no、不清未知；真实 terminal 不因 revoke 被 TARGET_INVALID 替换，span 只封口一次；wrong reply/receipt 拒绝；Provider Tab/WAL保留、输入增量0；原 conversation park 不退化 |
| N1 | observation三种native cause | 执行端原生稳定码→现役strict5字段errorCode→actor→failure.code→原JSONL一致，mutation的外层code/receipt不受影响 |
| N2 | 无已知cause/未知code/额外字段/身份不匹配 | 无内层码保留原合法errorCode，未知/六字段/错误身份拒绝；non-mutation receipt必须null，不能借观察异常入WAL |
| N3 | mutation正常/失败/迟到补交/重复receipt | 同一immutable identity、原terminal CAS、commit/readback后ACK；无需旧页面权限，输入增量0 |
| L1 | nativecause允许/深层unsafe/cycle/HTTP/network/Chrome | primary code三项原样保留，nativeCause闭集不扩张；任意Error/URL/正文拒绝或脱敏，原合法cause/httpStatus不丢 |
| B1 | article领域接纳/回读 | exact job+result hash+admission+publication locator一致；不能拿Browser或Outbox成功替代 |
| B2 | static当前source一致/已前进/字段机械失败 | 同client事务receipt；当前合格字段逐message读回origin/consumer hash，旧源只记账，不倒退current、不把failures算在用译文 |
| B3 | Website新attempt/ACTIVE_ATTEMPT/当前result消费 | 仅Website签发，retry_not_before前无claim；无Provider输入的新attempt从零开始，已有确认effect只回读，unknown不清WAL |

拟重建现役fixture路径在附录；不新增仅镜像实现的测试。G2要安排GPT先观察、Browser机械准备时状态改变，不能仅fake一个success DTO；同时反向变异恢复旧默认strict映射应失败。T2让 tabs.get 真正loading、frame已有新URL/loader，记录events/claim/order；替回旧先claim顺序应失败。N1跨actual reply producer/parser及formatter验证，不能只测试regex。

原生quality只使用AGENT `npm run quality:check -- CHANGE`；READY/RELEASE使用同入口原生要求，不手工制造PASS、跳过其他active law验收或建立跨仓总verdict。Website没有源码改动时不制造Website CHANGE结果；领域只读取证不是Website发布。精确命令环境先读 `node --version`，Website需>=24；已观察不同workdir shell可解析不同版本，显式选择本机 `/Users/nexgen/.nvm/versions/node/v24.20.0/bin` 的PATH后再执行。验收调用不得从日志读取真相或为测试新增生产入口。现役Dynamic Proof映射读取 `scripts/audit/shared/quality-routes.ts`：GPT、Browser、Runtime Log及相关Runtime依其active law modes分别进入原生proof脚本；本轮不直接调用这些脚本，不以单个proof结果替代最终quality verdict。实际施工触发high-impact或生产物理删除门时，仅使用已获授权的现役 `GRASSEYE_HIGH_IMPACT_AUTHORIZED` / `GRASSEYE_PRODUCTION_DELETE_AUTHORIZED`，不改gate、不新增授权文件；当前施工授权满足实际删除与本方案直接 high-impact 范围，届时仅按现役门设置对应开关。



各Owner Dynamic Proof必须独立：按 `LAW-AGENT-PRODUCTION-RUNTIME-008-V46` 分别启动，仅声明自己的lawId，不共享assertion、Website job、Chrome journey、时间线、coordinator、proof bus、scenario或adapter。B1/B2是本需求的端到端业务readback要求，不能拿同一业务样本填充四个Owner的独立proof。独立Owner证据只能通过现役typed receipt消费必要相邻事实；Runtime proof不运行Product Flow/GPT/Browser动作。四个producer未归位时只能保持RELEASE阻断，不能靠一场全链演示绕过。

**当前 RELEASE 原生阻断，不能省略：** 原质量路由指向的四份现役 proof producer 末尾无条件拒绝：`scripts/acceptance/gpt.real-proof.ts` → `GPT_OWNER_ISOLATED_RELEASE_PROOF_NOT_ADMITTED`；`scripts/acceptance/local-browser.real-proof.ts` → `LOCAL_BROWSER_OWNER_ISOLATED_RELEASE_PROOF_NOT_ADMITTED`；`scripts/acceptance/runtime-log-spine.real-proof.ts` → `RUNTIME_LOG_OWNER_ISOLATED_RELEASE_PROOF_NOT_ADMITTED`；`scripts/acceptance/agent-production-runtime.real-proof.ts` → `AGENT_RUNTIME_OWNER_ISOLATED_RELEASE_PROOF_NOT_ADMITTED`。本轮不宣称这些 producer 已能采集/签发合格生产证据，不删除 throw、不跳过 quality、不把受控模拟填成 Dynamic Proof。它们是当前可验证的原生发布边界，不能冒充现场失败根因。后续施工授权已取得；既定正文可施工范围是 G/T/N/L/Q 根因重构及其 CHANGE/READY要求，CI-FULL 继续执行原生 RELEASE 门，**四项缺口未关闭前 RELEASE 保持阻断**。消除该发布缺口属于单独 proof Owner 的结构建设，必须先针对现役各 proof Owner 读透其law claim分母、真实producer/consumer、同身份生产证据与原质量接纳合同，再在唯一方案明确其整文件重构片区并重审；不允许直接删拒绝或设置PASS。该独立缺口不自动扩大既定生产片区，也不能作为部署许可；原生失败后的必要修复依冻结 CI-FULL 三层鉴权并重新明确整文件片区。

## 9. 唯一端到端闭环

同一identity链：Website `job_id/request_hash/route contract`→accepted attempt/result_revision/lease/fence→Runtime durable bind→原Product的product_step_id/call_id/child_id/input_hash→Browser exact-call与provider_effect identity及WAL→GPT Child语义proof→完整回答artifact＋Product结果→Runtime Outbox→Website completion staging→Domain Consumer admission→Website public completed→Runtime机械readback local completed。Target/Document仅是当前物理动作绑定，不顶替任何业务identity，未进入新存储。

| handoff | producer权威输出 / consumer真实接受 | 拒绝、未知与恢复回接 |
| --- | --- | --- |
| Website→Runtime | version44 grant/lease/fence；`production_tasks` durable binding、原accept receipt | Website唯一attempt/retry授权；Runtime只读该事实，不从current_reason/Target推断 |
| Runtime→Product→GPT | 原route解析一次；静态catalog/文章translation现役Product顺序给exact Child intent | Product决定业务恢复，G只做本Childproof，Runtime不能补步骤 |
| Browser→GPT | 原WAL atomic outcome＋coherent当前Document后置包；G一份映射与Child语义接受 | G2零输入合法；T资格失败和N cause真实传播；DISPATCHED hold，原terminal补交后回原effect |
| GPT→Product→Runtime | `production-child-result/support/tools`绑定proof/effect/完整artifact；现役Product normalize一次组装package | 不从helper重复判物理terminal；失败保留Browser事实，不写新attempt授权 |
| Outbox→Website staging | 同task/request/result hash、artifact receipt、idempotency key；原V6write receipt | staged仍failed；transport unknown读回，不盲重放，不把delivered算business完成 |
| staging→领域→completed | article `localization-result-consumer.v1` admission＋publication定位；static `localization-static-current-consumer.v2` hash-bound admission＋current entry资格 | 同事务finalize/writeStaticCatalogAdmission。static的selected_catalog_hash只在assertStaticCatalogCandidateAgainstSource校验selected_messages；prepareStaticCatalogCandidate在接纳前将admission.resultHash绑定为row.result_payload_hash。因此持久entry origin.result_payload_hash必须等于该被接纳外层result_payload_hash，同时绑定business_consumption_hash与job/admission |
| Website→Runtime local complete | exact job+result hash+消费hash的canonical domain receipt，经原机械validator | 无receipt不complete；原result可消费不重新submit；旧源completed不宣称当前页面/RELEASE |

业务终点是领域接纳与按该域规则的实际对象readback；本轮仅有历史成功样本及同候选受控模拟，重构后的真实生产终点仍需授权施工后由Dynamic Proof证明。未知DOM/首次reply丢失本轮不开代码修复分支，失败沿原Owner封闭。没有额外恢复链用于“兜底”；Owner/输出/消费者见§6和本节。

### Handoff 冻结字段与分支归属

- Browser atomic input 严格沿现有 `BrowserAtomicStepIdentity` 七字段：resultRevision/productStepId/callId/childCapabilityId/inputHash/actionOrdinal/replayPolicy；传入原 facade 当前job/attempt/fence，不能用nullable身份取默认。输出state/mutationOutcome/count/terminalAt/authorityRef/hash沿当前typed API；G只投影必要已核字段，不重建物理identity或private WAL row。合法no必须零输入，confirmed动作按当前Child次数门；不合法组合typed失败，缺事实不能成功。
- Browser wire 仍由现有AEAD、strict sequence、session/permit/token和五键parser接纳；errorCode来自现役闭集，未知字段/未知code/身份漂移拒绝。mutation原fact的九字段/proof hash、18项binding投影/CAS/ACK完全保留；日志与Promise既不结算WAL也不签输入权。non-mutation无WAL terminal；原Browser command span记录真实拒绝，consumer用failure.code及原cause-event读回。
- GPT Child proof仍为v2，success/failure两个结果不各造一份事实：证据hash按既有canonical算法，typed factRef/hash跟原Owner可重读；artifact只存完整observed回答，Child异常不落第二failure artifact。上层自己的span只能携原cause-event记consequential，不重复terminal或冒充domain completed。
- Website task/result version15与V6 version44的key、null/禁止字段、grant/lease/fence、幂等key、artifact slot `attempt_id:role`、result hash均不变；staging与domain acceptance保留唯一事务和receipt。本轮不新增字段或DTO副本。正常技术失败由Website保留同demand并决定新attempt；有限退避5/15/60/300/900/3600秒不缩短、不转为永久关闭。原可信结果优先消费，possible input只沿原effect零submit读回。
- 成功由G/T输出到原Product→Outbox→Website Domain Consumer并读回；资格拒绝/Child后置不满足/授权失效由当前Owner typed终结，沿原source handoff回Website；取消停止未来输入但保留已发事实；原worker/receipt事实丢失保持DISPATCHED并阻断新mutation。每条均对应§8，未知分支不另造统一恢复状态或人工操作默认成功。不同Owner正交的WAL/Outbox/artifact/admission不能压成一个全局表。

## 10. 施工顺序、切换与停止门

先获得生产重构授权；重绑候选与全scope dirty；将当前执行和原worker pending handlers/slots按现役Owner收束，不删未决事实。未决DISPATCHED或仍有已提交待接纳业务时不能借“清场”重启扩展清槽；先原identity补交/接纳，没有合法事实就停止切换。不能通过删除job、改retry或风险授权制造验收数据。

完成§7联合清场后主AI串行重建：T物理生命周期→N现役strict reply→L原formatter→G公共事实与全部消费→Q-G/Q-B现役inspector重建→命中native fixtures。跨Owner接口的生产者和消费者必须在同一候选一起完成，不运行半套版本。删除中间态只用于本地构建，不能作为可运行版本或clean READY commit。

本轮按已获授权使用唯一原生入口连续执行 CHANGE、clean main commit 的 READY 和 RELEASE；不承诺已有任何质量通过结果。当前§8四项NOT_ADMITTED使RELEASE原生阻断。只有各Owner真实proof producer按law/quality合同闭合并经唯一原生RELEASE接纳，才能完成同一bundle运行切换及发布；绝不能先部署再补发布证据。用户已授权的必要运行收束与治理动作不重复申请许可；未通过原生 RELEASE 不切换新 bundle。不得创建或切换分支。回退须重新部署已鉴权完整旧release，业务/WAL/receipt历史不倒写；不能通过运行旧parser接新reply、保留双读或删已提交输入来回退。

立即停止条件：authority/候选漂移；未授权dirty碰片区；未整文件删除就开始添加代码；旧helper/boolean/双映射/forwarding复活；子审未放行；必须增加新Owner/state/store/兼容链而存在性无法证明；页面资格未闭合却claim；日志失败继续新输入；旧worker槽未闭合就切换；same identity receipt/hash不一致；任意native验收失败或用部分证据冒认PASS。

## 11. 主审与独立审计记录

主审必须三轮依次完成：第一轮顶层法案/Owner/存在性/整文件片区；第二轮真实图/身份/有限分支/回归；第三轮领域反向读回/候选/原生quality与未知边界。每轮发现项由主AI修订本文件，重审无未解决方案错误后才启动子智能体。子审只读本文件及相关authority/code/evidence；至少分别审法律与片区、物理/事实合同、业务闭环/验收。出现任何未放行，主AI修订再提交对应审计，不能结束方案。

主审第1轮（源头法案/Owner/整文件片区）：读取active source、母说明书、Blueprint和闭环SKILL两遍，校核唯一Owner/原子边界/当前必要性。撤销三处handler开关、单等候、单加字段补丁设想；明确整文件先删后重写、31个生产文件及直接质检消费者。五字段与原code闭集已可承担N，删除六字段/协议升版/allowlist扩展/新缓存设想；保护WAL/Outbox/产物/领域权威边界。

主审第2轮（真实图/identity/有限分支/回归）：逆查11个事实helper消费者，分解G原子工单；冻结两个exact-call hash不同命名空间、Child局部语义、ACK ACT与model/reasoning强制动作。核查created/continuation/parked/confirmed readback的真实导航路径，统一剩余deadline、直接onUpdated唤醒、候选与已绑定Tab清理权限，保护原slot/ACK/CAS/节拍/不重放。只读原生AST查清494/499行及30成员边界，重建时删除重复导航编排，不等施工失败后切割。

主审第3轮（业务终点/候选/证据）：反查Website同client finalize/static-current事务及Runtime admission hash门；纠正selected_catalog_hash中间投影与最终entry origin.result_payload_hash：prepareStaticCatalogCandidate最终覆写为row.result_payload_hash。保留旧源只记账/当前在用/发布的区别。重算2541事件分母，更新523d同attempt零submit恢复，前版PG/IAB只作历史。补五份现役inspector及mutants的整文件Q范围，保护原生断言。四份real-proof的NOT_ADMITTED只阻断RELEASE，不当现场根因，不越权删除。两仓HEAD/tracking及相关源码未漂移；仅授权本文修改。

共同审计已否决旧版准入：三份真实上游夹具遗漏、原输入计数与恢复增量混用、跨 call 借用事实、claim 时间错标及人工操作归属无据；T/N 又分别漏了包装异常、返回 rejected DTO 和异步新 claim 隔离。旧任务对51文件版本的审计不覆盖54文件版本。授权人随后停止另一 Codex，指定本任务唯一主 AI 完成；不再等待已停止任务或沿用其放行。

当前修订已逐行核三份完整fixture、worker slot/REPLY/drain、authority retire/park、Node parser/CAS/actor与原日志。真实内存夹具反例 exit=0：实际输入1、原事实count0、另一个完整identity查询读到前call事实；§5 Target反例也已由本主AI独立复放 exit=0。这两者只是现役缺陷证据，不是重构验收或Dynamic Proof。三份夹具纳入54文件，G10/G11/T7分别覆盖计数、完整身份和终态/claim顺序。

接管后的主审第1轮（authority/必要性/复杂度）：重核原生基础法案、Browser law/BP的原终态交付例外、公开输入边界及直接inspector消费者；54路径存在且无重复、源码无dirty。删除两份事实解释、三处导航编排重复责任和reply内cleanup转发；零新增结构/字段，不以弱化预算或质检执法换简化。未发现剩余方案阻断，进入第二轮。

接管后的主审第2轮（真实合同/异步顺序/分支）：从交互资格的异常和返回DTO分别反查到原slot、REPLY、唯一CAS、actor终态和精确claim撤回。否决“直接移进动作cycle”，因为mutation fact当时尚未固定；现有worker重建为slot固定→REPLY→同身份处置，删除动作后live claim再次裁决原terminal。最后await后精确身份比较，原输入前门、断线drain/ACK与one terminal均保留；G原计数/恢复增量和完整origin identity不混用。T7覆盖上述真实分支，未发现剩余方案阻断，进入第三轮。

接管后的主审第3轮（领域终点/证据/候选/原生quality）：复核外层result hash覆写和Runtime同身份admission门，两个附件独立绑定、2541事件前缀及33终态分母一致。2026-10-03T07:20:23Z只读SQLite回读该17jobs仍为15completed/2failed，523d原attempt已completed；PG与页面仅引用明确历史等级。54源码干净、两仓main HEAD与authority不变、仅唯一方案有差异、git diff --check无格式错误。四项原生NOT_ADMITTED保留；未执行quality，不输出PASS/READY/RELEASE。三轮后交本任务law_scope_audit、physical_contract_audit、business_proof_audit只读独立审同一设计字节。

本任务三名独立审计均已明确放行设计 SHA256 `c86e97dac1db4b3d87ce31900806b232f3934bce082413ca0e96501a9285dc88`：law_scope_audit核准现役法案、原终态交付例外、54整文件片区及复杂度只减门；physical_contract_audit核准slot固定→原REPLY→精确claim处置、同认证事实单终态及G10/G11原计数/完整身份；business_proof_audit核准同hash领域终点、日志分母、523d原attempt零新submit恢复，并于07:22:53Z独立只读回读17jobs仍15completed/2failed。未发现剩余实质设计缺陷。本次状态和审计记录落盘后只复核最终字节及这两处结论性文字；施工正文不改动。放行不代表原生quality PASS、源码已重构、READY或RELEASE。

## 12. 本轮施工记录

施工前主审第1遍：主 AI 完整读取两仓同字节1771行母说明书、AGENT基础3条/功能36条、Website基础1条/功能509条，以及AGENT全部7份、Website全部3份现役Blueprint；校核 source、唯一Owner、物理与业务身份、native quality 和授权边界。GPT合法零输入事实不改变强制model/reasoning/submit动作；Browser原可信终态交付不要求旧claim仍可发动作；Website领域接纳仍是业务完成门。本片区法案/BP没有必须修改的冲突，零法案/BP变更。

施工前主审第2遍：逐项反向核对§6原子工单、§8真实分支、54精确清场文件及附录保留反事实；核验五字段revision9、原CAS/slot/ACK、当前绝对deadline、七字段atomic identity和跨attempt provider effect分离。不存在未闭合authority/方案冲突；以上为前置设计审查，不计算虚假的百分比、不输出原生质量结论。

前置原生入口：Node v24.20.0，`npm run quality:check -- CHANGE` exit=0、`CHANGE_PASS`；该结果仅绑定当时唯一方案差异，尚无源码重构，不能覆盖后续候选。

离线清场前只读收束证据：本机4173无AGENT监听，lsof无production-runtime/browser-mutations SQLite打开者；production_tasks仅840 completed/3 failed，没有执行中或staged未完成任务；Browser WAL为9424 CONFIRMED/448 REJECTED、DISPATCHED=0。23份历史未发送artifact均在2026-09-17创建，terminal未发送数=0；保留三份failed任务、未接纳handoff和历史artifact，不将其删成“干净”。这些读回只证明本地施工可离线开展，不证明Chrome worker槽已ACK或允许运行切换；切换前仍必须原Owner逐项核验。

清场实际动作：主AI按附录逐项核验54个路径为本仓main、原HEAD对应clean普通文件后，逐个unlink；在写第一份新源码前确认54/54路径不存在且Git全部为D。随后才开始G/T/N/L重建，没有保存或恢复旧完整文件、没有运行切换、没有删除DB/WAL/Outbox。新草稿的纠错同样先整文件unlink并确认不存在，再重新构建。

生产首版读回：31份生产文件已重新建立；5份inspector与18份验收文件仍在清场状态，不构成可交付候选。使用现役code-purity AST primitive只读计算发现8份文件仍有函数圈复杂度超过16；普通npm run typecheck发现model-selector使用了不存在的minimumPostconditionBudgetMs（现役字段为postClickMinimumDelayMs）、model postcondition fields类型不相符、submit query的true字面量未固定，以及两处未使用import。其余missing-module/隐式any是尚未重建的既定验收/inspector依赖；不绕过这些消费者、不计算PASS。

上述构建finding三层鉴权：第一层，code-purity manifest→LAW-CODE-PURITY-001-V6/QUALITY-EVIDENCE-OWNERSHIP现役BP与scan-structural-function-budgets原16圈/75行等预算，GPT manifest→LAW-GPT-001-V64/002-V31与现役GPT BP；第二层，当前BrowserDomIntent的postClickMinimumDelayMs=2500和BrowserDomPostconditionQuery的稀疏field合同、原provider atomic哈希与公开lease/Store origin绑定、Child自己的动作后置与Product实际恢复消费者；第三层，冻结母说明书的最少充分合同、唯一Owner/事实源/quality、基础法案禁止类型逃逸与重新包装、双仓Website唯一新attempt/revision授权不变。裁决只能在原31文件内去重/重构和修正真实合同使用，不改法案/BP/预算、不添通用机制、不把模拟或typecheck当原生质量。

phase2只读身份协审：business_proof_audit核验原HEAD生产链及现役Browser公共读回，确认同revision已批准CONFIRMED恢复允许existing.inputHash不同当前intent派生hash，只返回原receipt/promptHash、当前新增submit=0；原七字段和effect依公开原事实绑定，DISPATCHED/缺失/歧义禁止fresh重发。该审查仅针对身份规则，不是整候选放行。

当前重建读回：清场总数60，实际存续59、永久删除1；所有扩面均先核验main原HEAD目标路径状态、原位更新本文和主审authority后逐文件unlink，确认ABSENT才重写。额外Browser WAL failure投影不再重新用BROWSER_前缀筛掉已经被原receipt verifier验证的NO_LAYOUT_BOX/ARIA_HIDDEN等合法机械原因；原Store仍是唯一terminal verifier/CAS。没有修改law、Blueprint、schema、protocol、DB、worker或服务，没有引入第二Owner/存储/治理报告。纠正本轮新草稿也采用整文件删除读回再重新构建，没有恢复HEAD整份旧源码。

实现自检第1遍（正向生产链）：主AI逐链读取当前GPT Child→统一atomic fact→proof/result→Product恢复，以及Node入队/deadline→认证worker→物理Target→输入前guard→原terminal/slot→唯一CAS/ACK。发现并关闭：新页与parked续接误共用导航、导航loader未变仍接纳、mutation cause合法码被读取投影误拒、旧onRemoved在physical读回前伤及新候选。parked续接错文章必须零导航失败，新导航必须fresh完整物理frame及新loader。以上均按既定整文件重建，原输入前资格和旧confirmed事实读回分离。

实现自检第2遍（逆向失败/消费者/验收）：主AI从原terminal WAL/ACK、GPT失败proof与cause-event、Website同result payload hash领域admission反查原job/attempt/revision/七字段call identity；核对同revision原submit读回新增输入0、ACK原count1与fresh clearance0分离、强制model/reasoning/submit/nonempty batch count1、semantic DONE零输入、DISPATCHED禁止新输入、source/Outbox/业务终点不混用。检查原生static消费者和验收分母，关闭deadline复合赋值与合法throw block误报；现行结构预算未放宽。当前60文件AST量为15156→7021物理行、1228→1180函数、3222→3210圈复杂度，全部重建函数满足原75行/7参/8返回/10await/5嵌套/16圈预算；上述为片区诊断数据，不是原生质量裁决。

普通局部验证：npm run typecheck exit0；GPT exact-target/attachment/proof/production-lifecycle/artifact-recovery/browser-mismatch、Browser terminal-contract/property-model/rule-mutants/FIFO/完整auto-pairing生命周期，以及runtime-log failure-matrix均已取得exit0。其中auto-pairing真实执行原逻辑周期/续接错页/轮转/配对撤销等替身分支，rule-mutants增加deadline +=/++/--负例及sole-throw block正例。只有临时验收目录SQLite发生写入，生产DB/WAL/Outbox未写。独立physical_contract_audit的重要步骤审查确认上述边界，没有给出整体候选放行；下一门是三名只读审计完整候选，其后唯一原生CHANGE→clean main commit READY→第79节适用审查→RELEASE。四份现役real-proof仍以原NOT_ADMITTED失败关闭，不把普通局部验证冒认Dynamic或生产成功。

实现候选独立审计第1轮未放行：三名只读审计者确认导航前Chrome identity与已认证Document漂移两项生产缺陷、confirmed-exact夹具漏验完整七字段身份，以及GPT检查器漏审可达response helper和attachment结构helper两项执法缺陷。主AI收齐完整finding后修订，9个现有片区文件先同时unlink并逐项确认ABSENT，再完整重建；类型及重复约束清理也逐份先删除确认ABSENT，未使用行补丁、覆盖旧文件、恢复旧HEAD或新增兼容链。

修订后主审第1遍：沿原输入链确认导航调用前fresh complete/active/non-discarded Tab、fresh主frame、exact attached Chrome identity，以及已认证selection loader均需合格；在Page.navigate之前同步复核原registry/session与同一deadline。新candidate无旧Document permit；同URL零导航仍可更新Document。前后资格使用CreatedTarget唯一现役物理资格职责，其他primitive/普通input guard不变。历史provider恢复夹具的真实readAtomicStepOutcome仅接受原完整七字段，逐字段漂移及A读回后B读取均返回null；原合法跨attempt恢复和零新增submit仍保留。

修订后主审第2遍：反查原检查器调用及真实helper分母，response根和现役可达helper的call/branch均被约束，helper隐藏第三门反例被拒；附件结构helper只允许现役composer/计数异常，ready与timeout仍各守自己的终裁时机，零卡片提前终裁反例被拒。删除重复检查和单次使用的顺序扫描算法，不新增Owner、协议字段、存储、法案或Blueprint，不弱化原断言。60文件当前AST量15156→7158行、1228→1187函数、3222→3220圈复杂度；圈复杂度降幅有限，不外推为显著下降，所有函数原生预算保持。两遍主审没有遗留已知实质阻断，但不能替代独立审查或原生verdict。

修订后局部验证：typecheck、GPT exact-target（包含两类helper反例）、Browser rule-mutants（包含导航前资格/loader/permit反例）、confirmed browser-mismatch（原七字段与跨attempt）及完整auto-pairing实际生命周期替身均exit0，git diff --check无错误。未操作生产DB、Chrome、服务、worker、部署或发布。当前进入第2轮三名只读整候选审查；其放行前禁止原生CHANGE。四项RELEASE NOT_ADMITTED缺口仍原样保留。

实现候选独立审计第2轮未放行：在目标读取期间真实触发 tabs.onActivated 的切走/切回事件，导航前旧 active 快照不能保证当前世代；GPT response helper 的 call/branch 扫描不能证明确认窗口起点与完整 raw 回答投影；附件超时分支仅核 callee 不能证明两种失败码仍各守原终裁条件。主AI将9份已清场文件再次同时删除、确认ABSENT后重建：CreatedTarget复用唯一InteractionReadiness窗口世代守卫，在Page.navigate前同步复核；selection保留已认证loader许可，新候选没有旧Document许可；response直接核原完整数据投影，附件直接核原超时条件及完整调用参数。普通回归已证切走及切走再切回均拒绝、navigation增量0，原合法同URL零导航和原七字段历史读回继续成立。

Q-T反向消费主审第1遍读取LAW-LOCAL-BROWSER-SESSION-003-V45/004-V56与现役Browser Blueprint，确认所有输入/observation同window activation世代同步复核、单次激活及2500ms动作门、唯一逻辑1.5秒门与exact ACK例外、禁止window focus均不可削弱。第2遍沿原native inspector实际调用，发现 interaction-readiness-inspection.ts 仍强制旧局部变量与旧世代比较位置，无法消费当前唯一同步守卫。该直接质检消费者纳入第61份完整文件清场；重建检查实际Owner调用与守卫数据流，原完整要求及反例保留，不恢复退休变量、增加检查入口或改法案/Blueprint。此记录写入时第61份尚未删除，完成后再记实际结果。新增生产协议字段、持久化、Owner、法案及Blueprint均为0；现役readiness依赖与调用期守卫闭包只复用原窗口状态，不形成第二激活真相。

第61份及修订实际清场完成：interaction-readiness-inspection与原rule-mutants同时unlink并分别确认ABSENT后整份重建。进一步移除普通输入lease上重复复制的window/generation，导航与普通mutation/observation都消费原InteractionReadiness同一个守卫闭包；没有覆盖已有onActivated事件真相。readiness、target-claim、interaction inspector、rule-mutants四份再次同时unlink、读回ABSENT后重建，未使用行补丁。唯一原native入口仍消费相同检查器，激活、frame Origin、loader、guard-before-input、1.5秒普通逻辑门、exact ACK例外、无window focus完整保留。

本轮实现主审第1遍从CreatedTarget资格→唯一window世代→同步Page.navigate→旧生命周期事件等待→fresh attached frame→Document发布，核旧selection loader/permit与新candidate无旧loader两种责任；读回callback而非两份持久快照守同一事件真相。第2遍从原Child与atomic七字段→response完整raw数据与20分钟连续窗口→附件两类deadline终态→native全部实际Consumer逆查，确认真实隐蔽第三门、起点提前、raw boolean截断、timeout code交换及移除激活守卫反例均被拒，原provider提交0/1与ACK计数不混淆。八份现役inspector、1份永久删除及19份验收路径与§7一致，未改变law/Blueprint/registry/dependency，Website仍clean。61文件按原生结构原语汇总：15367→7368行、1246→1206函数、3257→3256圈复杂度，原结构预算无越线；不将单一圈复杂度降幅夸大为显著简化或质量PASS。

本轮typecheck与Browser原rule-mutants（包括导航前激活世代、普通输入同守卫、紧急节拍旁路、runtime guard删除反例）exit0；前述GPT response数据/helper与附件终态实参反例exit0，完整auto-pairing已在当前修订重跑，审计开始时仍运行中，未冒认通过。第3轮三名只读整候选审查前候选冻结；任何实际finding由主AI依整文件清场纪律修复，未放行不得进入原生CHANGE。只有原唯一quality入口可产生质量结论。

实现候选第3轮未全体放行：物理执行与业务接纳审查均无阻断；法案/执法审查证实GPT九函数链仍漏完整调用实参、identity、计时、归零、返回及终态投影，新增Q-T又将原Authority mutation恰一次检查退为存在性。主AI正向重读GPT现役冻结两门与Browser004唯一调用/输入义务，逆向复核当前原生Owner/消费者、Blueprint与合法现役表达式，两遍确认法案/BP无需修改。修订严格限于已清场的frozen inspector、source-support、interaction inspector、rule-mutants四份现有文件，不扩surface/字段/法案。

GPT执法重建统一九函数同一语义分母：真实完整call实参、branch条件、合法ObjectLiteral数据、BinaryExpression谓词/赋值、return表达式、关键initializer、throw终态、break/continue序列及表达式箭头body；移除两函数旁挂数据检查与重复global-token匹配。20分钟由真实AST常量约束，现役production handler不改。不是运行期源hash、第二业务验证器或新Owner。原模型/附件/身份/proof静态路由不变。Q-T恢复Authority mutation恰一次及observation恰一次，从真实CallExpression计数，不靠callee文本存在；实际duplicate-call反例必须拒绝。原20分钟起点/raw返回/附件终态反例全保留，并加入本轮计时、marker、窗口归零、跨user拼接、窗口返回、终态码、rawhash身份、gate换源、控制转移及重复动作反例；计数谓词反例仅声明执法，不虚构单条负观察真实终裁。

第3轮finding实际修订完成：前述四份源码同时unlink并确认ABSENT后整份重建；进一步自检证实分组表达式不能保证父子控制位置（DONE return移出原if仍误收），frozen inspector/source-support再次整份删除读回后重建。最终只保留现役回答模块的一个可执行AST token投影，完整绑定原九个const ArrowFunction声明、参数、默认值、实际import引用、全部父子控制/数据表达式及20分钟常量；忽略TypeAlias纯类型节点与JSDoc/普通trivia，literal/regex/template token字符、逗号及实际operator原样保留，不用全局去空白或去注释正则，也不把array elision/逗号运算符作trivia。原生产handler不变。该静态合同只由原inspector消费，不是运行期代码hash/gate、第二业务Owner或新增schema。分组call/branch、局部对象、并列operators/return等重复扫描全部删除。

本轮修订主审第1遍按母本38/52/53、现役GPT两门/20分钟与Browser004唯一动作，核完整声明/参数/import/控制结构不可被后赋值或布尔/identity包装绕过，原14Child、coherent reader、atomic、proof、Blueprint模式及native路由完整保留。第2遍逆向核真实完整callback与原唯一guard/CAS/ACK/业务admission并逐项重演上述9类表达式、unconditional DONE、尾空格失败码、const改let、注释合法正例及Authority重复mutation/observation反例；全部正确拒绝或接受，原实参不被normalizer改写。两遍无遗留已知finding，不替代独立审查或原生verdict。

实际普通验证：当前typecheck、GPT exact-target（全部新反例及原正负夹具）exit0；本轮Browser rule-mutants（实际duplicate mutation/observation）exit0。前轮完整auto-pairing在当前不变production文件取得exit0，不为仅checker改变重复启动生产或冒认Dynamic。全61文件原生结构原语为15367→7531行、1246→1204函数、3257→3245圈复杂度，原预算无越线；三类量均下降，不夸大圈复杂度降幅。实际62个差异路径=61TS+唯一方案；Website仍clean，原law/Blueprint/registry/mother/contract不变。当前冻结第4轮整候选待三名审查者重新放行，随后唯一CHANGE→原生clean main commit READY→第79节→RELEASE资格核对；四项real-proof原NOT_ADMITTED不改。

第4轮未全体放行：物理与业务审查无新增阻断，法/执法审查证实叶token序列丢失ASI换行后的真实父子结构，return与其表达式分行仍被误收。主AI确认问题并只在既有frozen inspector/source-support整文件清场重建，同一投影记录每statement根与全部后代的kind、排除JSDoc后的有效子节点数，仅叶子保存原文本，preorder+arity保留完整AST树；注释正例保持，新增DONE/窗口两种ASI反例。这个事实修正此前“叶token保留完整控制结构”的说法，旧候选放行全部失效。完整decl/import/九函数/20分钟与其它原法条分母不变，零新增文件/Owner/schema/runtime gate/hash；ASI反例只声明静态误收，不冒认可通过全project typecheck或原生质量。

第4轮ASI修订实际完成：frozen inspector及source-support分别unlink并读回ABSENT后整份Add；没有行补丁、覆盖写回或HEAD恢复。当前唯一可执行AST投影按preorder记录根及后代kind/有效child count/叶子原文本，保留真实return表达式归属，排除JSDoc节点和祖先；纯TypeAlias不作为运行语义。两种return换行反例均被拒，合法JSDoc正例通过；所有旧控制、实参、identity、时间窗口、raw数据、失败码及附件反例仍有效。

本次主审第1遍正向核该唯一静态投影与现役GPT冻结两门、九函数、20分钟、完整原literal/import/声明绑定；无新增运行期gate/hash、第二质量Owner或新文件。第2遍逆向沿原native静态调用及exact-target验收实际执行、Browser原Authority恰一次mutation/observation反例和完整原法条分母读回，确认没有以ASI修订缩减其它检查。两遍未发现新的已知finding；不宣称百分比准确度或原生PASS。当前typecheck与GPT exact-target全部正负反例exit0，61文件原生结构原语为15367→7537行、1246→1205函数、3257→3246圈复杂度，原预算无越线；62个实际差异路径仍为61TS+唯一方案，Website clean，authority/contract/dependency不变。当前第5轮候选重新冻结，前三轮及第4轮旧候选放行均不覆盖它，三名只读审查者未全体放行前不进入原生CHANGE。

## 附录：精确清场路径与候选

下列路径属于AGENT根；每条都是完整文件，实际清场不使用目录通配符，以免删除未证明职责。计划文件自身不在清场集合。

生产文件（33 个）：

- `src/capabilities/gpt/web/child-handler.ts`
- `src/capabilities/gpt/ability-group.ts`
- `src/capabilities/gpt/children/acknowledge_known_gpt_rate_limit/handler.ts`
- `src/capabilities/gpt/children/prepare_clean_gpt_chat/handler.ts`
- `src/capabilities/gpt/children/open_gpt_execution_profile/handler.ts`
- `src/capabilities/gpt/children/open_gpt_model_selector_v3/handler.ts`
- `src/capabilities/gpt/children/select_gpt_model_from_start_v3/handler.ts`
- `src/capabilities/gpt/children/select_gpt_reasoning_from_start_v3/handler.ts`
- `src/capabilities/gpt/children/close_gpt_execution_profile/handler.ts`
- `src/capabilities/gpt/children/open_gpt_attachment_control/handler.ts`
- `src/capabilities/gpt/children/write_exact_gpt_prompt/handler.ts`
- `src/capabilities/gpt/children/attach_approved_gpt_files_once/handler.ts`
- `src/capabilities/gpt/children/submit_exact_gpt_turn_once/handler.ts`
- `src/capabilities/gpt/production-atomic-call.ts`
- `src/capabilities/gpt/production-atomic-readback.ts`
- `src/capabilities/gpt/production-child-result.ts`
- `src/capabilities/gpt/production-child-support.ts`
- `src/capabilities/gpt/production-child-tools.ts`
- `src/lib/browser/infrastructure/browser-target-acquirer.ts`
- `src/lib/browser/infrastructure/browser-lane-coordinator.ts`
- `src/lib/browser/chrome-extension/extension-created-target.ts`
- `src/lib/browser/chrome-extension/extension-target-acquisition.ts`
- `src/lib/browser/chrome-extension/extension-target-authority.ts`
- `src/lib/browser/chrome-extension/extension-target-release.ts`
- `src/lib/browser/chrome-extension/extension-interaction-readiness.ts`
- `src/lib/browser/chrome-extension/extension-command-runtime.ts`
- `src/lib/browser/chrome-extension/websocket-actor.ts`
- `src/lib/browser/transport/browser-authority-websocket.ts`
- `src/lib/browser/transport/browser-authority-frame-payload.ts`
- `src/lib/browser/exact-target/browser-command-actor.ts`
- `src/lib/browser/exact-target/browser-command-failure.ts`
- `src/lib/browser/exact-target/browser-mutation-authority.ts`
- `src/lib/runtime-logs/failure.ts`

现役质检实现（8 个，整文件删除重构）：

- `scripts/audit/domains/gpt/gpt-contract-inspection.ts`
- `scripts/audit/domains/gpt/gpt-provider-contract-inspection.ts`
- `scripts/audit/domains/gpt/gpt-frozen-attempt-inspection.ts`
- `scripts/audit/domains/gpt/inspector.ts`
- `scripts/audit/domains/gpt/gpt-attachment-contract-inspection.ts`
- `scripts/audit/domains/local-browser-session/target-claim-inspection.ts`
- `scripts/audit/domains/local-browser-session/interaction-readiness-inspection.ts`
- `scripts/audit/domains/local-browser-session/browser-mutation-settlement-inspection.ts`

永久删除的失效质检实现（1 个，不另建替代文件）：

- `scripts/audit/domains/gpt/gpt-page-proof-inspection.ts`

命中验收文件（19 个，同样先整文件删除再重写有效验收）：

- `src/capabilities/gpt/acceptance/gpt-exact-target-browser-fixture.ts`
- `src/capabilities/gpt/acceptance/gpt-exact-target-source-support.ts`
- `src/capabilities/gpt/acceptance/gpt-production-artifact-recovery.acceptance-support.ts`
- `src/capabilities/gpt/acceptance/gpt-production-browser-mismatch.acceptance-support.ts`
- `src/capabilities/gpt/acceptance/gpt-exact-target-profile-fixture.ts`
- `src/capabilities/gpt/acceptance/gpt-exact-target.acceptance.ts`
- `src/capabilities/gpt/acceptance/gpt-attachment.acceptance.ts`
- `src/capabilities/gpt/acceptance/gpt-proof.acceptance.ts`
- `src/capabilities/gpt/acceptance/gpt-proof-submit.acceptance-support.ts`
- `scripts/acceptance/local-browser-auto-pairing.acceptance.ts`
- `scripts/acceptance/local-browser-auto-pairing-support.ts`
- `scripts/acceptance/local-browser-mutation-receipt-support.ts`
- `scripts/acceptance/local-browser-rule-mutants.acceptance.ts`
- `scripts/acceptance/local-browser-terminal-contract.acceptance.ts`
- `scripts/acceptance/local-browser-terminal-fixture.ts`
- `scripts/acceptance/local-browser-property-model.acceptance.ts`
- `scripts/acceptance/browser-lane-fifo-support.ts`
- `scripts/acceptance/browser-lane-fifo.acceptance.ts`
- `scripts/acceptance/runtime-log-spine-failure-matrix.acceptance.ts`

以上精确清场路径绑定§2两仓原生HEAD；没有第二候选hash/receipt。这不是全仓穷尽审查或原生质量结果。


只读稳定边界（不在代码清场范围；均绑定§2同一仓HEAD及clean source）：

- AGENT `AGENTS.md`、两份active law、母说明书、`scripts/audit/generated/law-registry.generated.json`、§2/四维表四份Blueprint、两个V6/task-result dependency、`package.json`、相关domain manifests和code-purity结构扫描器；定义authority和唯一quality，不因本轮代码重构修改。附录八份直接inspector及一份失效inspector分别按Q工单整文件重建或永久删除，其余原生quality边界不变。
- Browser `src/lib/browser/browser-authority-api.ts`、`exact-target/browser-target-lease.ts`、`browser-mutation-{store,receipt,types}.ts`、`browser-observation-receipt.ts`、`browser-command-postcondition.ts`、`browser-interaction-native-cause.ts`、`browser-site-policy-registry.ts`、`chrome-extension/{debugger-runtime,extension-target-observation,extension-target-loss,chatgpt-page-access-gate,exact-target-runtime,websocket-actor-crypto,service-worker}.ts`、`transport/browser-authority-frame-codec.ts`、现役protocol/schema/errors/generated：原物理事实与安全primitive、原槽hash/序列、当前registry；已定位没有本次G的第二语义判定，N只复用允许code，T不改变低层节拍/primitive或持久化。删除它们会丢公开原事实、现实identity或唯一加密通道，真实consumer与§8正反验收证明必要；不是保留旧业务包装层。`extension-target-release.ts` 已因施工发现的同链生产合同断裂移入59文件清场，不再属于本保留集合。
- GPT `src/capabilities/gpt/{contract,handler-registry,product-api,production-ports,production-browser-lifecycle,production-call-preparation,production-execution-session,production-execution-source-reuse,evidence-artifacts}.ts` 与命中Child的 observation/selectors、`src/plugins/localization-production/{index,flow,static-catalog-flow}.ts`：当前任务/语义输入、真实调用注册、实时Document getter、原一次Product Flow及完整回答读回；不改变它们合同/选择策略，无第二Browser成功解释或本轮根因决定。单独删除会断真实入口或原结果，保持原Owner边界。执行若发现实际责任重复与本裁决相反，按§7扩整文件片区并重新审计，不能边写边猜。
- Runtime `src/lib/local-runtime/production/{runtime-claim,runtime-claim-recovery,runtime-source-handoff,runtime-business-admission,store,cloud-reconciliation-client}.ts` 与唯一Outbox消费者：真实durable accept、fence、immutable first fact、源证明与domain receipt机械读回；不因日志code变化改恢复授权。
- Website两份active law/registry、`docs/blueprints/{SYSTEM-BLUEPRINT.md,domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md}`、provider specs与`packages/ai-contracts/src/{agent-task,production-control}/`实际schema、`services/api/src/ai-production/{job-lifecycle-core,job-lifecycle-repository,job-claim-authority,job-claim-repository,business-result-consumer}.ts`、`services/api/src/localization/{localization-completion-worker,localization-static-catalog-consumer,localization-static-current}.ts`、对应现役合同exam：独立domain完成Owner及attempt/retry权威；不接Target/URL，不修改这些边界。删它们会失去领域admission、当前源资格或唯一授权，B1–B3精确readback是保留证据。

边界条目用于有界读取，不授权通配符删除、全目录重写或新增治理结构。执行时将目录内实际合同artifact按provider spec精确展开，相关候选仍以原生Git commit和实际dirty绑定，不另生成清单文件。
