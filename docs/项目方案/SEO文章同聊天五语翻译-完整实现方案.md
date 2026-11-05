# SEO 文章同聊天五语翻译—完整实现方案

## 0. 本轮目标、状态与权限

修订：2026-11-03，Asia/Dubai。状态：设计中；E1/E2-R实际建设已独立审查可接CHANGE，新增启动日志差额正在只读确诊，未定修复的分支保持设计阻断。授权人本轮明确批准按本方案执行法案、施工图、代码及质检，并完成CI-FULL READY；此次授权承接§4.1精确定位用途目标。只在现有main施工，子智能体只读审查；不含RELEASE、部署、服务切换或新增Provider输入。网站现有其它任务的修改保留，只叠加本次规范与直接引用，不夹带提交。本文件继续为WA-20261028-01唯一工程方案。

目标：同一篇文章的研究→中文文章→原图→zh-HK→zh-TW→en-US→ja-JP→ko-KR沿首研究已验证的同一 canonical conversation URL（下称 U）加工；正常成功路径为八个 turn，获准修订可能增加 turn。已有答案优先原身份交付。AGENT只保证当前授权的机械执行、准确定位、事实保全和结果运输；Website独占业务派单、前序接纳、取消、重做、新 attempt/revision、风险授权、公开与业务完成。AGENT不选择下一语言、不认定内容合格、不补签授权。

本轮只建设两个根因族的方案：E1 原会话执行定位；E2-R 混合来源投影遗漏。E2 原父来源解析已经落地，直接保留。Website阶段展示、旧单删除、权限扩域、N4材料、W5退役、付款、PDF、专业内容、模型、Prompt、回合数和节拍均不进入本轮施工。此前本文件的旧权限记录、清单和“可施工”不能当成本轮许可。

工程交付终点为原结果链的 Website 完整接收回执与本地 completed；八步同 U 由 Browser 私有事实核验，六语接纳及公开由 Website 分别核验。前者不代替后者，后者也不反向作为 AGENT 已交货的额外门。本方案的规范对齐不代表代码、READY、RELEASE或整案冻结已完成。

## 1. 当前事实、权威及前轮连续性

### 1.1 候选与调查深度

- AGENT：`/Users/nexgen/Documents/AGENT`，main，HEAD `23577158b9f0c5e7c4da207709034bcbf277f37f`，tracking origin/main；设计开始工作树及本方案均clean；当前授权施工差异为本方案点名的规范、实现和必要质检，不再是仅方案修改。
- Website：`/Users/nexgen/Documents/xuanxue-web`，main，HEAD `89dba744922ca2671b0d4d09e7f8ec23d0b7d56b`，tracking origin/main；原有其它任务差异已由网站任务提交，本轮不夹带其提交。当前四份栏目源头及下述两处实现与设计时快照内容相同；只在已批准用途内核规范，不触碰其它网站改动。当前 sender 工作树 SHA-256 为 `ae02699be23e13055dd6db0849031d5b5b9e385981cf3d26291dbc459473729f`，V6来源验证为 `aaf7d72656aedbf4aebd057183f4e46b02aa5f8106ac99b78f854fdbdbdb652e`；它们不是已投产事实。
- scoped事实绑定为本节HEAD及§2—5点名的当前法案/蓝图/合同/实现/消费者/质检overlay；执行者写前重读并比较相关差异，实质漂移只重开受影响部分。方案自身hash在交付工具输出另算，不写入自身。
- 深度裁决：共享 Browser/GPT 主干、异步导航、来源恢复且命中前轮修复，采用深度遍历受影响图，不把无关产品专业逻辑或全仓历史纳入施工。

### 1.2 权威与蓝图一致性裁决

两仓各自`docs/governance/法案系统建设说明书-冻结定稿版.md`的§0/4/35/46/47确定权限、层级与证据；方案不改母本。Website `docs/governance/合婚栏目冻结边界蓝图.md`、`八字栏目冻结边界蓝图.md`、`奇门遁甲栏目冻结边界蓝图.md`、`起名栏目冻结边界蓝图.md`继续为用户指定源头；本轮不改变其人物/事实、完整供材、专业判断、权益及同源交付。共享回归保持这些产品各任务fresh、原完整材料及合法结果交付。

| 当前义务 | 现役法案及蓝图入口 | 吻合与本轮处理 |
| --- | --- | --- |
| 工厂边界、静态Product、唯一业务恢复 | A Architecture-001-V19、Capability-001-V20；W AI-Acceptance-002-V45/013-V36；A WEBSITE-AGENT-V6-BLUEPRINT、W SYSTEM/AI-ACCEPTANCE-BLUEPRINT | Website裁决、AGENT执行的方向吻合，原Owner不变；不增业务恢复或全链协调Owner |
| 定位与effect分离、两项提交/两项回答判据 | A GPT-001-V68/002-V33、Browser-003-V49/004-V59/006-V48；GPT V71、Browser V58蓝图 | 现法/蓝图要求正确定位和同effect防重；E1现实现未完整承接。URL是原页面身份安全的一部分，不能新增内容考官或第三门 |
| 父完成结果的实际采用来源 | A Runtime-001-V82、Architecture-001-V19、GPT-001-V68、Browser-003/006；W AI-Acceptance-002-V45；上述三份A蓝图 | 当前规范已同步实际采用来源，旧“父current attempt/child step即来源”已退出；E2主解析保留，不能按旧工单重建 |
| 混合风险来源中settled_reusable仍可零提交复用 | A Runtime-001-V82、GPT-002-V33；W AI-Acceptance-013-V36及V6来源验证 | 规范方向吻合；E2-R投影遗漏违反已有义务，修实现而不放宽grant |
| 六语顺序与公开 | W Localization-013-V18、Public-Knowledge-002-V3及其原业务蓝图；article-localization-owner.ts | 网站已拥有最长接纳前缀→紧邻一语的sender；直接复用，不在AGENT重建 |
| 结构、存在性与唯一质检 | A Code-Purity-001-V6/002-V2/003-V3及原Manifest/registry；两仓原quality:check | 不改变预算、分母或检查阈值；方案/局部验收不生成第二PASS |

本轮先修订A Architecture-001-V20、GPT-001-V69/002-V34、Browser-003-V50/006-V49及W AI-Acceptance-002-V46/013-V37、直接蓝图/spec引用，并由原builder生成registry；四份源头及提交/回答冻结条款保持原字节。此前主Codex两遍规范自检漏掉Runtime-001-V82 forbidden[6]的排他用途句，错误地在规范尚未完全对齐时进入了代码阶段；这一步未满足授权人法案前置对齐纪律，不能追认其为完整通过。当前已停止依赖动作，按G0先原位同步该条为V83及直接版本引用；本次主Codex单独完成两遍规范核验：第一遍核新增目的的精确选择者/前置条件、parent分支指代和39条法案的唯一性/依赖；第二遍核Runtime只改forbidden[6]、其它义务原字节、Target及回答两门原字节、law/registry双向集合差为空，三份spec的contract及version未变。此前规范前置纪律缺口如实保留，不追认原自检。合同版本V6=49、task/result=23、route=4保持，定点用途不赋予Target、Runtime或Browser业务裁决。

### 1.3 已落地与仍未解决

- `8949f8350`已分离发送证明与独立URL定位。CONFIRMED不含URL，定位失败不能撤销发送。保留原WAL、locator CAS及两门验收。
- `f2dbc3d4c`已保留cache/source完成后的settledConversation及下一步恢复交接；当前`recordSettledResult`的同session URL冲突检查仍晚于后一步可能输入，不能充当前置防护。旧《SEO原会话URL连续-完整实现方案.md》仅作该已落地接缝的历史依据，本轮不执行其旧授权或“前三步/HK足够”的验收范围。
- `923d532f5`已落地`executor-source-checkpoint.ts::readContinuationSources/collectContinuationSources`→原GPT内存参数→lane `readParentConversationUrl`→原Store exact source reader。图片仅核source-binding身份描述、零父正文/原图读取；保留跨attempt grant、采用集合完整性及全部来源URL全等。原工单E2“尚未实现”的描述已过时，不在脏Website工单中抢写纠正。
- 当前`store-source-settlement.ts::replaySettlements`在exhausted非空时只返回`riskSettlements`，丢掉同一manifest的reused_checkpoint。现有“mixed”验收是两代祖先的同一call历史组合，不覆盖同一handoff中一个调用可复用、另一个调用耗尽的分支，不能据其通过关闭E2-R。
- 原质量状态及W5未闭合项不被本方案改写，不拿任何旧READY代替本轮候选。旧故障任务不救援、不重译、不清账；需要删除仍由网站原授权及入口另行处理。

### 1.4 用户追加：2026-11-03最新启动日志问题清单

源头为授权人最新附件 `/Users/nexgen/.codex/attachments/679ca5a2-1fa3-4a5f-bb12-0927369dd305/已粘贴的文本.txt`（340行、332条JSON）；用户要求纳入同轮修复，并报告“处理删除项目之前系统正常”。该前后关系触发回归核查，不直接证明代码因果。原E1/E2-R范围与保护保留；下列新差额不能借旧建设放行跳过确诊、规范、方案及审查。

| 问题/关联工单 | 已证事实、影响及原件 | 本轮处理与继续条件 |
| --- | --- | --- |
| L1 启动连接拒绝；192张历史工单状态读回 | 附件14–207行：session-open拒连及192次同类ECONNREFUSED；API实际18:04:17Z启动，拒连最后18:04:12.281Z，18:04:43.032Z起127次状态读取成功。启动根与后续claim500分开，不拆192个代码根因 | 已证连接恢复；保留现役typed故障和原有有界恢复。没有已证必要性就不为此加重试/状态机或删业务单 |
| L2 领单HTTP500；同device，非某张新领取工单的GPT失败 | 附件240/273/306/339行，4次INTERNAL_ERROR，Owner=website、HTTP500；原run后续至18:14:14仍失败，共16次。附件无服务端根异常，不能借历史ZODERROR定字段，也不能断言由删建引入。失败在launchClaimJobs之前 | Website原claim Owner内确诊；先按原request_id只读查提交回执/lease及实际构造路径，区分提交前/后失败，不发新claim、不重放、不把业务恢复转给AGENT。根因和必要消费者未闭合前不施工 |
| L3 已完成文章旧失败载荷不满足现行status合同；`aiprod_364348b2-6a3c-44aa-a56c-2a7c4a376591` | 附件257行V6_DEVICE_ATTEMPT_FAILURE_INVALID；现役API同一原pool只读事务核此produce_article已completed，当前attempt=`9bed7f11-2ed6-4f66-92f6-e1a05bea8f4e`。其latest failure为BROWSER_POSTCONDITION_FAILED/target_local/REJECTED/confirmed，缺child_proof_ref、child_proof_hash、stopped_empty_proof；Website直接输出原detail_json，而双方当前合同都required这些字段。后续其它工单状态仍成功，不能说此单卡死全部 | 由下述L3定点方案承接 |
| L3处理边界 | 该记录说明旧失败与当前完成权威在运输接缝冲突，不证明已完成成果失效 | 先核原Owner、字段语义和真实消费者，再定最短合法处理。不得吞检验、伪造旧proof、改raw first fact、为旧事故加兼容桥、删除有效成果或要求重做；必要法案/施工图先对齐，按独立根因族修复与验收 |

#### L3 唯一修复单：Website完成状态与历史失败解耦

三名固定法官对同一当前对象均裁：三proof字段及严格运输检查保留；Website completed投影把非法旧failure放入当前失败字段的具体单元违规，裁修。主Codex工程分档为中度（跨仓输出/消费语义、共享三个真实生产调用方），复用已完成的独立只读合同/数据调查；只修第一直接断裂，不修改AGENT校验或重新调查历史BROWSER_POSTCONDITION_FAILED。两种hash已按现役语义区分：terminal绑定完整envelope，result_payload绑定内部payload原字节，不能要求二者互等。

- 做什么/Owner：Website.ai-acceptance原`services/api/src/ai-production/job-device-status-repository.ts::projectAiProductionDeviceJobStatusV6`拥有当前状态输出。复用原completed/consumer/hash验证得出的`admission`，其非空时当前`attempt_failure`输出null；没有合法完成接纳时仍原样运输当前失败，交原严格合同处理。Website决定完成，AGENT只消费，不移动业务裁决。
- 不做/保留：原历史failure及firstfact不改、不补三字段，不改领域成果、原receipts/哈希、身份/鉴权、Runtime对账、未完成失败/停空/revision安全字段；不新表/API/decoder/兼容桥/状态或恢复链。旧格式本身不获得新生产资格。SQL原历史选择、写入及归档保持；它仍可供原历史消费者使用，不增重复状态判断。
- 精确退休/重建：只物理删除该函数返回对象中无条件`attempt_failure: row.attempt_failure`投影片段；即时以独立AST/文本回读确认旧片段缺席，再以原`admission`这一已验证权威重建同一nullable字段。函数其余职责直接保留，不删除后复制整函数或从Git恢复骨架。该项是字段片区重建，不能称整模块重构。
- 全部真实消费者：原device-status V6→AGENT `readProductionDeviceJobStatus`→`reconcileOneAuthority`结果接收对账；Website `hehun/postgres-hehun-analysis-repository.ts`和`hehun/bazi-report-hehun-interpretation-reader.ts`只取同一投影的`business_admission_receipt`，其精确归属/完整hash保护不变。三个调用方由导出符号反向引用和当前API路由发现；不扩到其它专业内容。当前forbidden/公开nullable合同已覆盖“旧失败不撤结果”，不改法案或4/49/23版本；Website原蓝图原位明确当前完成投影与历史事实的分离，原registry builder更新投影。
- 质检及承载：原函数约65行，单字段条件复用已有`admission`，不添helper或层级；原3proof/failed校验不用改。复用原`tests/exam/ai-production-v6-contract.test.ts`的localization admission readback场景，增强“已完成＋14键历史failure仍可读原接纳”及“未完成同失败仍原样输出并被原strict validator拒绝”的分支；不新建测试文件或入口。该文件现有别任务2256行改动原样保留，本次只在当前完成回读case独立追加断言，不覆盖或提交他人hunk；沿本聊天已允许保留差异、限定追加/续改的边界处理，若真实hunk重叠则停该文件，不造干净候选。
- 验收/失败：先用真实事故字段构成原测试反例并见旧实现拒/不合法输出，再重建；现有完成接纳/ref/hash伪造保护与未完成Proof严格性必须保留，原合婚两个调用方回归。只读以原事故行验证新投影不再运输旧failure、原接纳hash/identity保持；不调用真实claim、不写结果、不重做Provider。普通验证不代原生quality或本地已completed；若还有下游未知另行核原件，不追着旧事故建兼容链。运行态API尚未切换时，只说明源码修复，不能报当前服务已恢复。

规范先行：原法案义务正确保留，先同步Website原蓝图，再由主Codex两遍核Owner/nullable合同与真实consumer、旧事实保全/失败保护/版本和无旁路；未闭合不修改该字段代码。 本单已完成两遍主审：规范第一遍核原admission校验、三个真实生产消费者和四源头原字节，第二遍核法案/严格proof/49合同不变与蓝图仅补充；实际代码两遍核仅一个返回字段重建、原SQL/鉴权/hash原字节、未完成原失败保全及两个consumer接纳语义。事故14键反例先红（chunk339299）后绿（197af5）；57项合婚原消费者回归通过（a6543f，约42.1秒）。同API原pool只读事故行重投影（53598f）得到completed、原公开知识consumer、current_failure=null，原14键历史及消费hash保持，事务ROLLBACK；这是当前源码投影验证，不是运行服务已切换。独立建设复核只审本单差异及受影响项，原E1/E2-R已审未漂移部分保留。L2仍单独设计阻断，不以本单修复冒充claim500恢复；READY中单次一个根因族。

L2新增证据（不重复施工）：网站原任务 `01a19ba5-ef29-7d52-8f8d-935aa23347dd` 正在原Owner修复领取与旧材料退役。已核其原工具 `call_f069bd4db1e34b75b46b7e955b715d12` 输出（原JSONL17988）：15张2026-10-09旧文章翻译单中，候选0249322e的纯读材料解析抛ZodError/AI_PRODUCTION_MATERIAL_SOURCE_OWNER_ROLE_CONFLICT，栈落readMaterialSourceRecipe→aiProductionJobMaterialBindingsAreResolvable；这是当前候选可复现的领单故障机制，尚无本附件请求栈的逐请求因果证明。该任务已在修改job-claim-selection/material-source-contract，本任务保留其差异，不抢写第二套处理、不把其自述通过当本轮READY；后续读回其原生提交/报告与当前接口。四个首轮claim请求：`aipclaim_dfa565e1-9a4b-450d-822e-f4928be0262f`、`aipclaim_200fa770-56ed-444a-95d3-8c32ddce04e6`、`aipclaim_e5b841d5-8018-44cc-94fd-d3ebbb468816`、`aipclaim_e6287eeb-1462-4e70-ba6e-d58ef3b0aa8b`，原run为 `.grasseye-local/runtime-logs/agent/ede19bbd-53ba-4afe-b006-3f382ebdcb73-0001.jsonl`。当前Website stdout只在原Terminal，经工具读取被安全拒绝，不绕过；优先用既存同身份数据库回执/纯读回路径补证。旧空api.log不作为本次原件。此处只登记已证清单与设计断点，不预填未知修复或发布通过。

### 1.5 本轮原生 READY 的独立问题清单（不冒充业务事故）

原候选 `9ed47e370043a362278ca008573ac5ff83441a88` 的CHANGE及首推已完成，随后READY失败；Q1已在`635e83dae`修复。2026-11-04，独立的WA-20261104-02接缝在`02a2d5d1846096a53179a1fb0ddc8129a8ea10bc`完成CHANGE及首推，本次完整原生READY退出1，唯一报告仍为`scripts/audit/reports/law-quality.report.json`，39法分母完整，Q2—Q5原故障继续存在。该接缝的唯一方案在Website《全系统本地化-完整实现方案.md》§19.11，本节只接续原CI质量故障，不将其并入article v4产品建设。

| 根因族/待决对象 | 原始事实与处理边界 |
| --- | --- |
| Q1 本次法案后继的消费者交付遗漏 | `tests/governance/quality-contract.test.ts`仍有七处Runtime001-V82、GPT001-V68、Browser006-V48现役查找/producer引用；当前分别为V83/V69/V49，部分反例因此取不到对象。本次升版的直接引用遗漏须保留断言原位更正，不换动态“任取最新”、不减反例。 已只更正这七个现役字符串，并把原Browser媒体反例的执行闭包锚点同步为现役新增permit参数，恶意替换及拒绝断言不变；两遍主审确认只含八处直接消费者更新、test/assert数量与规范/validator原字节不变。原Dynamic绑定回归通过；原GPT001反例完整执行约164秒通过，其它未变分支复用本次原件；Browser旧锚点更新后原反例通过（b26cd8）。 |
| Q2 Runtime Exam回执数组顺序 | 原脚本115–118的八项clauses按数值直觉排序，原回执合同要求UTF-8字节顺序，导致QUALITY_EXAM_RECEIPT_INVALID；HEAD^已存在同序列，不归因为本次lawId改动。固定J1/J2/J3均裁生产者具体序列违规、裁修，严格validator保留。只能纠正序列，八项成员、两个Exam模式与真实traces均保留；不得吞错、补造receipt或改变validator。 |
| Q3 新增定位用途条款的证明分母 | Architecture001-V20、GPT002-V34、Browser003-V50及Browser006-V49各新增了完全相同的用途条款，当前原生覆盖集合未覆盖其新增索引，报告LAW_CLAUSE_DENOMINATOR_MISMATCH。先审这些具体条款在各Owner中的必要性、现有真实检查/验收与合法证据落点，不直接追加clauses声称已证，不降低分母或绕过冻结。 |
| Q4 Runtime结构预算 | 报告列10项STATIC_CODE_PURITY_FUNCTION_BUDGET，落在9个现役文件：failure-transport/store-schema验收support、Runtime authority-inspection、runtime-claim/loops/source-handoff/source-readback-proofs、store-source-readback、worker-session；source-handoff有两项。尚须核原始metrics及保留反事实，不把全部判为本轮URL迭代引入，不为过门直接拆小函数或压行。 |
| Q5 Outbox保守未知计数与catch判定 | store-outbox.ts的两处`catch { return true; }`同时被Code-Purity及System-Security指为假成功/失败开放；真实位置在原历史候选filter，true会增加未决候选计数。先核其消费者及实际放行/阻断方向，再裁质量还是生产；不凭布尔字面量定成功语义，不改历史/Outbox或扩大恢复权。 |

Runtime001/002/003/004/005/006/007的多条缺证据是同一Runtime验收在首个非法receipt处中断的连带项，不能按law行数复制故障。Q1/Q2/Q3/Q4/Q5暂分开，不无证合并为一个根因；READY中严格单族修复，完成后重走change→推送→ready。新对象先按原庭与闭环准入裁定必要性；未闭合的规范/方案不进入依赖代码。L2网站原Owner聊天已因模型容量错误终止，原工作树修复保留，但不承诺网站提交、READY或运行500恢复；本聊天不夹带其其它改动提交。

#### Q2 单族施工设计：原Exam序列（可施工）

Q2这一次差异只处理排序，其余族保持未实施。原J1/J2/J3身份及三份旧票已恢复：均对`9ed47e370`的同一对象裁生产者具体序列违规、裁修，严格validator保留。当前02a2d5d的同一数组、两个模式及validator与该旧对象原字节相同，READY再次在115→emit461→createExamReceipt390、写receipt前报`QUALITY_EXAM_RECEIPT_INVALID`；不是新判题，不用旧票代替当前质量结果。主Codex工程分档轻度：单一现有producer的封闭排列合同，根因、消费者及正误区分已直接闭合，无生产行为、身份、持久化或跨仓语义变化。

唯一Owner为AGENT.agent-production-runtime；施工仅原`scripts/acceptance/agent-production-runtime.acceptance.ts`的Runtime001两个Exam共用`clauses`声明及本节执行记录。原`emitQualityProofObservation`→`createExamReceipt/validateExamReceiptPayload`→`quality-runner`→逐法报告为全部消费者；注册由package原acceptance组和quality-routes唯一登记，运行栈与反向符号引用闭合，无新入口。Runtime001-V83、质量证据施工图、原Manifest及共享validator直接复用，规范无须修改。八项成员及其真实断言/traces是必要证据，删除会漏法；其它原验收、后续006/004/007证明、调用顺序、两个模式、candidate/run/producer/case/hash、非空/去重/字节序及失败传播全部直接保留，不能为纠正排列删成员或放宽校验。

根因片区仅错误排列声明：先物理删除该旧`clauses`属性→当场核Runtime001原call中无该属性且旧序列缺席→按现役UTF-8字节序在原call重建唯一声明`0,1,10,11,2,3,5,summary`。不保存/加工旧数组、不删整文件或原验收骨架，不新增排序helper、schema、状态、测试文件、兼容链或第二回执。共处文件的其它职责先裁直接保留；其当前134行，序列替换不增函数/分支/导出或结构预算。业务、Provider、网站、数据库、WAL/Outbox和运行启停修改均无，Q3—Q5不在该次修复差异中。

验收分两部分：过程用真实删除/即时缺席/重建工具记录核，不靠最终diff冒称；功能先核八成员集合与原序列相等且新序列符合原validator，完整原Runtime验收在原生CHANGE运行、退出0后提交首推，再完整READY真实产生两个模式的本候选receipt及traces，核Q2执行故障和其连带缺证据消失。普通无proof context的验收退出0不能单独关闭receipt问题；其余族仍失败如实保留，不增加同义考题或手工预跑全READY。失败保留原故障及结果，停本单写入分析；无回退/改账/吞错授权，新事实影响原判才回原庭。

主Codex已完整重读闭环Skill两遍并完成三轮设计核对：①有效法案/原字节排序合同与两模式未变；②报告缺证据反查到同一首receipt、真实调用及下游消费者，非多个业务故障；③删除反事实和混合文件保留、零新结构、有限拒绝/失败与原生证据时点。两遍规范自检分别核源头向下与receipt向上：规范/蓝图无需改动，没有未结规范冲突，禁止改validator换绿。实施后仍须两轮主审与只读实际建设审查，再回原生链。此设计不是READY或业务完成。

Q2施工事实：主Codex删除原错误`clauses`属性后，423639即时读取原call，确认该属性及旧错误序列缺席、原producer与两模式仍在；随后从原合同重建上述唯一八项字节序声明。两轮主审实际比较完整文件：除一个属性排列外原字节相等，八成员/模式/全部await/后续proof及validator、法案/蓝图、生产文件均未变；候选差异仅本方案与原验收两路径。原J2已只读审这两路径实际代码及设计，未发现本单源码finding；他未亲眼观察中间删除，过程证据仍明确归主Codex原工具，不以最终diff伪称子审亲验。真实receipt及连带缺证据是否消除留待本轮原生READY。

#### Q3 单族施工设计：原定位义务的证据接缝（可施工）

进入事实：244c1321dc2efb27583be6453c96f0fc86a844fd的完整READY退出1，Runtime八法全PASS，Q2执行/缺证据已消失；剩Q3四条分母、Q4十项结构与Q5两处误判。本次只修Q3，不改Q4/Q5。四条义务、Owner、required modes与原庭裁修边界均保持；主Codex定中度，原J1已独立核代码、既有场景及native发出时序，主Codex核原件后完成下列收敛。J1先前称多U/坏密文等未覆盖，补查486行原验收后已明确更正：289—330现有真实Store/Acquirer正反场景已覆盖，不新增同义题。

| 原子工单/原Owner与允许路径 | 真实承接、第一断裂与最窄处理 |
| --- | --- |
| Q3-A，architecture-boundary；`scripts/acceptance/architecture-boundary.acceptance.ts`原golden | 中央先发现并完成全部原Product验收；原文章题实际验证revision0 fresh、当前授权revision1文章不fresh、两个review仍fresh、附件/三轮/完整结果；恢复Owner/import反例保留。原observation未登记Architecture001:11。在该原golden补11及对应实际观察描述，不新增Product名单、AST业务检查或第二receipt，不声称证明Browser私有WAL。 |
| Q3-G，gpt；`src/capabilities/gpt/acceptance/gpt-production-browser-lifecycle.acceptance.ts`原state-machine | 原入口先await artifact/source/live交接、选择失败、资格不提前消费、ack不消费选择等真实场景，再发唯一state-machine observation；未登记GPT002:9。只在此原observation补9和相符描述，保留原property/state-machine成员及全部support。不借GPT001 PASS、不复制G1检查或新增validator；原Probe检查继续保留。 |
| Q3-B3，local-browser-session；原`inspector.ts`、`local-browser-proof-support.ts`及`local-browser-provider-effect-recovery.acceptance.ts` | 原inspectTargetClaimGuards已检查当前job完整历史、指定effect、exact reader、唯一U、located模式与导航；为003原static.ast登记18。原003 golden在auto-pairing后、provider-recovery前发出，尚不能包含后者289—330断言。删除proof-support中这一早发单元→即时核原位置及同law/mode发出点缺席→在原provider-recovery全部断言完成后重建唯一同locator golden，保留原2/3/summary并按字节序加入18。原collector按同run/candidate/script收集全部已执行assertion文件，后发才能同时保全前序auto-pairing与当前effect证据；不重跑场景、不保留双发。 |
| Q3-B6，同原Browser Owner；仅原`inspector.ts`的006 static.ast覆盖 | 原Navigation已核两个located用途及fresh/bound禁U/canonical policy；原Node sendControlFrame→encryptedFrame→Worker onMessage的四模式真实正例在auto-pairing前完成。原Opaque检查核唯一加密WAL、exact reader、UPDATE只改原密文及诊断无URL，原CLAIM严格字段不含U。只为这些既有真实检查登记Browser006:5，不加同义运输validator；006未声明Exam，禁止为凑数加Exam或把真实测试冒充其dynamic。 |

跨Owner边界由各自原输入/typed输出及本域证据承接；不是令Architecture/GPT重查Browser私有数据库。原case与检查删除会失去fresh/revision/选择失败、错来源/多U/损坏、未知保全或URL隐私的独立保护，故全部直接复用。原gpt-inspector及G1布尔函数均保留，不新增二次执行/循环导入/共享检查平台；原Browser目标/加密/诊断等所有检查和122个mutant不删、不放宽。Runtime、Product、GPT/Browser生产代码、Provider、控制合同、Task Result24、Capability4、数据库、日志、WAL/Outbox及运行启停的修改均无。法案/施工图/Manifest/registry/required modes/quality核心、package及quality-routes修改均无，无规范冲突；本单只修现役义务的证据交付。

施工分类：仅003原早发receipt单元真正删除后同Owner重建；四处覆盖/观察描述明确局部修改，其余检查/场景为事先裁定保留。不得把整个质检系统称重构。删除时不保存旧单元加工回填、不从Git恢复旧载体，不复制第二producer。原recovery486行，新增唯一003 emission预计不超过8行、无新函数/分支/import，须实测保持≤500；其余为原数组/描述局部变更，无新文件、抽象、存储、Owner或兼容。若出现不能承接的真实新分支或预算超限，停依赖修改回本节，不先堆后拆。

验收：先核原四义务→本表实际检查/断言→receipt发出时点→逐法覆盖；规范不变、Clauses只增原遗漏索引，0003 golden仅一个且在两组真实断言完成后，0006仍只有原Static及deferred dynamic。再沿原入口运行受影响普通验收，保留缺effect/异job/多U/坏密文与payload、未知不挡指定effect、选择失败阻输入、cache/source零页面、fresh/review及完整Flow反例。原生CHANGE→提交首推→完整READY后，读实际003 receipt必须同时含auto-pairing/acquisition与provider-recovery的真实trace，GPT002含artifact-recovery真实trace；核四个LAW_CLAUSE_DENOMINATOR_MISMATCH消失，Q4/Q5未修如实保留。无新增Provider输入或生产动态验收，本轮不装服务。

主Codex三轮设计核对已完成：①源头/四条现文/各Owner及required mode与实际原件正查，未借质量故障改法；②由完整报告与receipt反查原注册、support、collector及跨进程trace，确认真实已有覆盖与003早发首断；③删除反事实、原件保留、唯一发出点/字节序、486→≤500预算、零新执行与失败回接反查。两轮规范自检分别按源头向下和实际接收证据向上核，无需改法/施工图或冻结语义。原J1已沿相同身份独立复核本设计及五路径、四条现文、collector/runner和本候选报告，未发现施工前阻断；其未运行测试，也未据文字宣称代码或质量已完成；实施后主Codex两轮审实际差额，再由原只读审查者审建设遗漏后回原生链。失败不补造trace/receipt、不吞错/减分母/改超时，相关新事实才回原庭；无回退或清账。

Q3施工事实：56a757即时核原support的003 emission与全acceptance同locator缺席，002/005仍在；随后原recovery末尾重建唯一003，最终492行。主Codex两遍实际核六路径差异、原检查/断言/await、clauses顺序及生产/规范零变更；原J1实际复核五个源码及原件无可操作finding，没有把其未亲验的即时删除当独立过程证据。实际receipt/traces及分母错误消除仍交当前候选的原生READY，不以源码审查冒充通过。

#### Q4 单族施工设计：删除重复决定并恢复结构预算（可施工）

授权及候选：2026-11-04，用户在上一轮精确列明Q4九个原Runtime/验收文件及Q5两个原checker/原验收范围后，明确续行“那就激活C-FULL技能，完成READY”；本节据此只施工Q4，Q5另族处理。AGENT主仓main@b0227bd0df7a9ccf5dfa317e57e3096a1869d463、origin/main同值、工作树clean；唯一报告同候选READY FAIL，Q2/Q3已清，37/39法PASS。旧J1/J2/J3三份Q4票均恢复，绑定9ed47e370的十处具体对象，裁职责与预算检查留、具体预算违规修；当前九文件与原审对象字节相同，不重票、不拿旧判充新质量。主Codex定中度，复用原J2独立逐对象/消费者分析和本次first-terminal技术补证；闭环Skill现役全文双遍已取得并持续适用，设计采用受影响结构的深度核验，不扩成业务或外部穿透。

现役约束为母本§21/35—38/48—54、Code-Purity001-V6 forbidden[0/1/4]、Runtime001-V83及004-V49、原Runtime V70/质量证据蓝图、原Manifest及registry。预算仍文件500行，函数75行/7参/8返回/10await/5嵌套/16复杂度。四栏目源头、Website业务授权/完成主权、原完整结果接收即工厂完成、control49/task-result24及43route全不改变；无须改法、施工图、Manifest、spec或registry。两遍规范主审先核预算/Runtime原义务向下，再由接收、封口、grant/发送向上反查，没有未结规范冲突；进入本节实际代码前须再核规范差异为零，子审不替主审。

发现分母：原报告十项→原结构计算器当前复算，另由符号反向引用/package原注册及状态/Store读写交叉核对。入口仍原Runtime验收与worker/claim；终点仍同job/attempt完整result及原接收、原seal/claim运输，不增加业务结果。相关W5既定封口、unknown保全、完整输出和排空保护继续承接；历史预算违规不当成最新URL回归。源头/上位没有规范冲突，运行与Provider无本单新动作。下面九路径以AGENT根为准，原Owner均agent-production-runtime，结构扫描Owner仍code-purity。

| 单元/精确施工片区 | 合同推导的唯一承接与保留决定 |
| --- | --- |
| `scripts/acceptance/agent-production-runtime-failure-transport.acceptance-support.ts`：原exerciseFirstTerminalBeforeProducerCleanup和verifyFirstTerminalReadback | 退休两函数旧职责分布后重建同入口：七模式/VM源码只编译一次、原stage与发送前断言、timer作用域及finally还原留在原harness；原readback helper统一负责先结算controlled renew、再核execution成功/拒绝及结算后最新result/terminalId，避免两处解读mode。实际输出由只读getter在await后取得，不提前捕获旧result。删除每模式重复的fixture:envelope hash计算，复用现有fixtures.HASH_A；三处只需不透明有效hash，foreign-result仍须与真实complete-output execution hash不同。原settleControlReceipt直接复用，七模式及所有独立断言不删；不加wrapper/文件/通用时钟。当前79行，消除重复协调与hash计算后按正常排版须≤75。 |
| `scripts/acceptance/agent-production-runtime-store-schema.acceptance-support.ts`：sourceTransportFetch唯一返回callback | 退休旧else-if/data聚合片区，沿原七个有序匹配分支提前return原生Response.json({ok:true,data})；未知路径仍抛原错误，generation/sequence、故障注入与真实session往返不变。原公共Response尾部及data变量退出，无新格式helper。Node24原生JSON响应须与旧status/headers/UTF-8 JSON相等；七返回≤8，平级分支消除嵌套7。当前495物理行，正常新写须≤500，不压行。其余完整输出/65状态/7来源及错误排空场景直接保留。 |
| `scripts/audit/domains/agent-production-runtime/authority-inspection.ts`：inspectFactoryRetirement及其唯一注册调用 | 退休聚合壳，按“完整输出/封口互斥”和“有界发现/排空运输”两项真实证明责任重建原文件局部检查，原inspectAgentAuthorityAst直接调用。后两项共用loops/iteration事实，不拆三套重复读取。原三个checkId、law、完整真假条件、immediate/pending完整输出/物理claim检查保持；其它检查函数保留。492行落点须≤500，不新增checker/入口或固定成功。 |
| `src/lib/local-runtime/production/runtime-claim.ts`：executeClaim内两处受control接纳的重复决定 | 退休executeClaim原片区后按原授权链重建；用同文件局部acceptControlledClaim统一“current attempt尚未接纳才调用原acceptClaim(null,null)”这一重复责任。两个真实消费者为已知control及renew后abort；budget getter仅在原if成立时求值，保持各自预算/epoch取得时点、durability赋值、结果优先、异常与当前取消行为。原acceptClaim及其源seal/防重逻辑直接复用，不能合并不同时点的生产接纳。 |
| `src/lib/local-runtime/production/runtime-loops.ts`：nextStatusJobIds与workerIteration两处环形page计算 | 只删除这两处重复page表达式后，用同文件唯一无状态circularJobPage承接已排序集合、原cursor与caller限额。status仍32/空页置null，运输仍6/空页保持原cursor；两种游标更新保持各自原位。首次原结构复算发现过滤callback不计入主函数own复杂度，分页去重本身不降低workerIteration的17，故在下一编辑前重核首断：本文件recordJobReadbackFailure及provider-loop catch还重复同一401/403运输分类。删除两处重复分类片段，合并为一个本地纯isSharedTransportAuthorizationFailure，两个真实消费者保持各自typed/BROWSER gate、throw及诊断写入；不用迁移pending循环或增加消费者/VM闭包。原workerIteration其它职责直接保留，finally唯一一次reconcileCompletedBrowserTargets不动。原admission VM只验证日志不可写而提前返回，实际路径在新page helper之前，故无须扩大VM闭包或改该文件；其它真实worker验收覆盖分页helper。 |
| `src/lib/local-runtime/production/runtime-source-handoff.ts`：preflightSourceHandoff与prepareSourceHandoffs | 退休两函数后重建：共同Outbox/完整输出/输入与WAL读回之后，retirement直接返回其原事实分支，普通来源再核继承冲突、精确拒收及历史资格，删掉retirement假继承对象和重复目的判断；首次复算预检仍17，下一编辑前核实拒收分类和exact reader只有这一消费者：局部合并其判定，原readExactRejectedProviderCall先用原isRejectedProviderResult，返回false=非拒收、null=拒收身份不合法、原call=合法拒收。预检从这一原三值产生rejectedResult，不再独立布尔授权后又判call。原classification/identity条件保留，null仍拒绝，无新type/状态/对象。最终异步artifact后历史/输入复核保留。原批处理只负责有限job集合、逐项typed隔离及诊断；局部sourceHandoffForJob承担原seal优先、active排除、精确control/待交结果优先和单job封存。raw/shared错误仍外抛，旧seal不重新观察，不改SourceEvidence字段或业务资格。其它validators/prepareOneSourceHandoff/seal函数直接复用。 |
| `src/lib/local-runtime/production/runtime-source-readback-proofs.ts`：sourceReadbackProofs | 退休旧混合遍历/逐effect决定后重建：原公开入口保留完整calls/effects分母和disposition汇总，原文件局部effectReadbackProof承接一个effect的既有accepted→checkpoint→exhausted→仅精确retirement unresolved顺序。accepted/checkpoint的null是拒绝，undefined才继续；整批observedAt仍只取一次。identity和原三种validator不改，调用方handoff/claim-recovery及原混合来源/祖先反例全保留，无新增proof或恢复来源。 |
| `src/lib/local-runtime/production/store-source-readback.ts`：sealSourceHandoff | 退休原method后在同一同步immediate事务重建；全部可变current/firstRaw/Outbox/receiving/complete-output/CAS读取留锁内。按当前task写者资格、manifest稳定身份/hash两职责做同class私有验证，原outbox非零/当前staged/pending完整输出/普通unresolved gate归同一私有写者资格方法，仍同步在事务内调用；原inspector沿seal中的唯一资格调用核该方法的hasPendingCompleteOutput，同时保留immediate核验。重建前按原复杂度计算口径推演：把这组gate全留在事务回调会仍超16，因此采用既定两职责拆分并同步同一原inspector的直接接缝，不增加新检查。复用一次existing行判断seal_hash/sealed_at的非null，删除第二次同键sourceAttemptClosed查询；json(manifest)仅生成一次供幂等及原insert/update。半seal仍拒绝，原精确更新/完成退役结果及receiving不变，无await、第二事务、UPSERT或SQL结构变化；class当前21成员可承载两私有职责且≤30。其它写者与sourceAttemptClosed原方法保留，仍供原消费者使用。 |
| `src/lib/local-runtime/production/worker-session.ts`：assertDrainingSourceClaim | 退休旧method后重建：同文件有限同步parser只核原JSON、exact keys、POST、schema/protocol、非空request_id及原limit形状；原method仍在真正fetch前核当前session/epoch、attestation、draining/ledger、delivery空、source非空且≤6、原validSourceHandoff/hash、零候选及job去重。parser不导出、不新增schema/公共合同，原请求构造与非DRAINING/非零grant拒绝保留。原AST guard中的source/validSourceHandoff/hash与物理注册保持，无须放宽审计。 |

保留反事实：删除上述原保护会分别允许cleanup撤销原结果、跨attempt/result混用、未决输入被丢弃、坏首job阻断兄弟、封口竞态、错误draining grant或未接收就完成。因此不删场景、不动判题阈值；只退休本表定位的重复/混合责任。无新文件、公共端口、库依赖、持久化、队列、Owner、恢复链或兼容桥。其它Product/GPT/Browser/Website/Outbox生产不触碰，Runtime原Store/公开typed输入及Website授权语义不变；在这些边界停止修改有合同及实际相同输入输出依据，不以Owner不同排除验收。

施工顺序及纪律：主Codex在每路径先核Git状态；按本表精确符号/片段物理删除→立即独立AST/引用缺席回读→从本表责任及原输入输出在原位置重建。共文件其它职责提前裁直接保留，不能缓存旧骨架加工回填、从Git/临时副本恢复、改名搬家或保留转发壳。两处page只属片段重建；其它未列变更无。重要节点和全代码完工由原J2只读审实际差额；主Codex先完成≥2轮实际自检，子审不写文件，不用本节设计审查抵建设审查。

有限验收：①原七种首次terminal模式、controlled renewal先结算且零物理send、异身份及unknown保全、全出口timer还原；②原65混合状态/重启、坏首行/单项503公平继续，401/403/raw共享退出、日志坏仍已发结果readback及finally；③原七sources跨包、≤6/结果优先/游标公平/Browser absent/N满/cooldown/draining零grant；④普通/退役unknown隔离、accepted/checkpoint null拒绝、错artifact/hash/WAL、重复与冲突祖先、混合reusable/exhausted完整；⑤stage/完整输出先成立阻seal、seal先成立挡迟写/regrant/first-failure/release、半seal拒绝、completed退役保留result/receiving，artifact异步前后历史漂移拒绝；⑥原排队后draining、session/attestation/limit/字段/来源/哈希/去重门及假DRAINING带jobs拒绝；⑦原Runtime AST/checkId/证据分母、六项结构预算与≤500/30成员。复用package原Runtime两组及原结构计算器、原inspector/反例，必要用例沿原入口，不建第二验收/报告、不跑Provider。不以实现镜像新增测试；真实新增行为无，既有反例与原谓词完整性核对承接。

先确认局部预算/类型及原Runtime/其反例，代码两轮主审和只读建设审查无未解finding即回原生CHANGE→提交首推→完整READY；Q4十finding必须消失，Q5未修如实保留，然后再独立处理Q5。当前报告已存在，不无变化重跑同一失败READY。阶段耗时复用125.856s治理/46.531sCode-Purity/352.837sBrowser基线，原7200s dynamic、600s Browser Exam、300s其它Exam期限及1.5/2.5秒等保护不改；工具等待≤60秒、原生进展与真实子进程观察，耗时变化仅有可比原件才归因，不额外benchmark。失败停依赖修改回本节重核根因/方法，不减分母；新实质事实影响原判才回原庭，无回退/清账/服务或Provider操作。

主Codex三轮设计反查：源头/预算与原Runtime义务、十处现役metrics/真实consumer及原封口/接收终点、删除反事实/独立保护/不新增公共结构与证据时点均已核。规范无需修改的两轮主审结论为无未结authority冲突；此为施工前设计，尚非代码、原生质量或运行成果。原J2已只读实际复核本节及十处原对象/直接消费者，findings为空；其未运行测试或证明未来预算，设计已可施工，接下来独立审实际代码。

Q4施工及建设审查事实：原九路径按表逐项真实删除并即时回读缺席，工具8b39e1/d24568/1b04cc/f4dd0e/7c5977/75d4ea/3b25ad/fb6caf/feea28及两项后续dc0a19/ebf4e7保留在当前任务，不造台账。首次原指标复算余worker/preflight两项后先回本节重核方法，再按新增实际删除单元合并；当前全部六项函数预算、文件/类预算实算0超限。原Runtime验收64766退出0（route24、Runtime35482ms、recovery908ms）；随后只为私有reader明确false/call/null类型修正boolean推断，typecheck37128退出0，运行JS未变。主Codex两遍建设主审核实际10路径、全部public export集、原断言方法多重集、三个finding、所有SQL规范化语句集合及事务/最终清理/未知保全；未改法案或其它生产片区。原J2实际审完整diff/上下文/直接消费者并核阅上述原件，finding为空；其核阅删除工具记录不冒充亲自现场执行，未运行测试。当前代码可接原生CHANGE，未来原生报告不提前宣称。



#### Q5 检查器的保守计数语义（设计中，Q4原生链之后顺序施工）

原J1/J2/J3三份旧票已各自恢复，绑定9ed47e370同两处Outbox catch及两checker；9ed→b022这些对象原字节不变，三票均认定生产未知增加candidateCount的“假成功/失败开放”指控不成立，保留Outbox，裁修两checker的无条件true判据。本单已获用户结合明确Q4/Q5范围的CI-FULL续行授权；不借此放开其它基础设施。主Codex定中度，J3已独立核现役TypeChecker的具体引用事实并回传有限AST方向；未批准或实施未来算法。第一直接断裂是检查器把filter谓词的true当成工厂成功；两个真实消费者分别为CodePurity001 static.ast与Security001 static.ast，仍由原quality统一逐法裁决。

精确片区：`scripts/audit/domains/code-purity/components/scan-structural-runtime-escapes.ts#scanCatchClause`的fakeSuccess选择及`scripts/audit/domains/system-security/inspector.ts#inspectUnsafeFallbacks`的unsafe选择，连同原两个acceptance文件。两checker其余规则、CodePurity Promise.catch、直接catch true/成功对象/成功字符串、空catch和原反例均直接保留；删除会放过真实伪成功或鉴权失败开放。生产`store-outbox.ts#readResultOutboxHistoryEvidence`两catch、原raw历史/hash/三字段冻结返回值及所有消费者保持原样：preflight零门→facts→同源Preflight封口元数据，claim零门才release，Store事务内assertSourceSealTask重读后非零抛错；preproduct只读rowCount。原TypeChecker已验证implementation与abstract两侧返回属性引用并集准确指向这四处count读取，ReturnType、浅spread与解构保留原属性声明身份，不建立第二数据流图。

目标只补一个可同时被两checker消费的共享纯AST事实函数，落`scripts/audit/shared/conservative-filter-count.ts`；这是当前两真实消费者必须使用同一资格证明、既有ast-node-identity只处理身份且无现成语义证明时的最短独立职责，不放进身份工具污染职责，不新增模块注册、Owner、机器合同或质量入口。只有最近callable为同步内联predicate、TypeChecker证明原生Array.filter（自定义同名方法不算）、filter.length直接形成原生Object.freeze返回属性时才进入该证明。沿原method引用连接implementation/abstract返回属性声明，核当前生产引用及直接方法调用；不是按文件/函数名登记四个消费者，不凭Readonly/number/ReturnType就放行。没有完整上下文时返回未证，不扩大quality按§52算出的输入分母或复用旧候选；原检查在对象进入当前分母但证明未闭合时失败关闭，诊断明确“未能证明失败关闭”，不谎称生产违规已证。

有限形态：`count!==0`必须沿顶层OR构成拒绝的充分条件（return null或throw），`count===0`只能沿顶层AND成为受控分支的必要条件；反向运算、未知算术或调用不推断。真实原绑定及facts常量的全部引用必须无替换/写入/delete/未知逃逸，facts只经现有两个浅spread到同一返回形态且没有后置覆盖；所有非null结果受原零门支配。元数据读取仅在TypeChecker定位的NonNullable原返回来源和实际直接consumer均成立时承接，不把原零快照当封口事务重读。Store私有guard只沿真实调用声明和参数位置核本次实参、非零必抛与正常返回后的writer顺序，不能在吞异常后继续；不推广任意函数摘要、容器传播、循环调用图或通用解释器。陌生形态停止证明并保留原生失败，必须回本节重新核当前必要性，禁止逐报错堆特例。

施工前主Codex两遍规范核：CodePurity001-V6及Security001-V15义务、现役QUALITY-EVIDENCE Blueprint/两个Manifest/registry/分母保持，§48/51—54/59—62/78的证据边界与唯一verdict不变，不改母本/法案或规范阈值。本次只增加原checker的有限正确性，没有治理主链/registry/runner/mode更改，不因普通checker改动自动触发§79；若实际范围改变须按母本重新匹配。原文件103/185行、原测试190/38行，新共享文件按≤350行、函数≤75及原全预算设计，两个测试各自复用原入口，无新测试框架/夹具目录或生产validator。

先在两checker物理删除上述错误判定片区→即时核原判据缺席、保留规则/原Promise分支仍在→从当前AST合同重建唯一判据并调用共享事实；不保存旧骨架加工回填、不Git恢复、白名单或全filter豁免。其余独立函数事前裁保留；共享模块新增有本节必要性及两个实际import，不建兼容路。原acceptance局部增加有明确区分能力的成对输入：真实两处计数不再报Q5；直接true/原Promise/正数grant仍报；反转或移走零门、carrier覆盖/替换/未知escape不能豁免；同名filter/async predicate/只有类型别名不能豁免；改文件/函数/变量名仍同判。使用原in-memory Project及既有scanner/collector，生产Outbox真正原文件另经当前原生Static验证，不以离线fixture当真实支持。保留原完整正反矩阵，不为增加题数重复等价用例。

代码完成后主Codex≥2轮审真实差额、无生产Outbox变动、四真实count reader/其它rowCount消费者及原反例，再由原J3只读核实际建设；已知finding及必要回归闭合即原生CHANGE→clean main提交首推→完整READY→实际第二推。Q5对应四finding须在本候选原报告消失，其余39法/全部required模式及原Runtime/Browser等保护不能减分母。未证上下文/新失败保留原件，只停依赖片区；没有清账/改历史/重发Provider/服务或安装授权，不为旧故障建设兼容桥。实际按新增共享事实、两判据片区重建、原测试局部增强、其余保留分别汇报，过程工具记录与功能验收分开。

#### Q6 材料验收等待与收尾接缝（设计阻断：新增单文件施工范围待确认）

Q4的首次原生CHANGE会话93642退出1：材料租约验收在`exercisePreparationAbort`等待真实download入口时，`until`第100次调度后断言失败；没有mode、work结算状态或原错误，不能宣称本次一定卡在mkdir、Q4生产回归或环境故障。原普通Runtime64766曾通过，仅为相反观察。原J1/J2/J3绑定`b0227bd0…+Q4工作树`独立核同题，三份有效意见均保留真实等待/原租约反例，裁修100轮终结性失败判据及直接工作清理接缝；不处分生产下载或clock。该文件不在此前明确的Q4九文件/Q5两checker范围内，已向用户请求只扩入本单文件；确认前只设计、不改其源码，不用一般CI-FULL授权代替冻结范围批准。

Owner仍AGENT.agent-production-runtime；精确修改落点仅`scripts/acceptance/agent-production-runtime-material-lease.acceptance-support.ts`的until、withFixture、三个异步边界场景及对应原入口反例。注册/package反查与符号反向引用一致：until四个callsite分布long-download两处、preparation-abort一处、headers一处，唯一公共consumer为原lease-renew-retry-support的exerciseRenewalCompletionJoin→原Runtime验收→原quality。真实下载的mkdir/headers/fetch/body/WAL与Store路径已核；当前100轮只排微任务/事件循环、不推进受控时间且不观察work，不能证明合法预算耗尽。其余fixture、材料身份/日志读回、失败归属/幂等/已有stage恢复函数、原宿主clock、生产cloud-client/runtime-state和父runner均直接保留；删除会失去A2—A7独立反例或改变生产合同，没有本单必要性。

新链由原Runtime001-V83/003-V53、Runtime/质量证据施工图及既有《长材料下载租约边界》§4.1、A2—A7推导：原callback真正到达→局部Promise完成信号；每次等待同时观察原work，拒绝传播同一错误，提前fulfilled但未到边界明确失败。long-download/headers信号运输原release，preparation信号运输实际AbortSignal；续租信号按原真实renew序号对应，首次5xx及后继成功不混淆。删除计数predicate与忙轮询，不新增事件框架、状态机、文件、持久化、Provider请求或第二入口。work由fixture记录其原Promise和结算事实，cleanup先abort、再释放夹具自己持有的两个gate、再join，禁止未join关库删目录；成功路径仍由原断言之后主动release，cleanup释放不得成为成功资格。

有限退出由同一fixture起点的原grant和leaseBudget导出：动作预算=leaseBudget当前可用时长，最终join/资源退出预算=grant的lease_expires_at-server_now，当前80/90秒；使用node原生timer和真实单调时钟，不受宿主Date/performance/global timer替换影响，不逐boundary重置或随elapsed延长。这是本单夹具监管预算，不冒称生产wall deadline，不改原10秒余量、20秒renew/5秒retry、120秒材料timeout或300秒原Exam上限；虚拟跨100/105秒正例保留。动作失败保留原异常，cleanup另失败保留两者。join期限届满保留Store/目录及未完成状态，退出当前验收、不继续下个fixture；join后才能close/rm，rm也受最终剩余期限约束，超时如实报清理未完、不重复删除、不强退。日志仅在原stderr输出case/等待boundary、work结算与cleanup事实，不建报告。

真实施工先核当前Git状态和主Codex两遍规范审计；法案/Blueprint/Manifest/registry、生产输入输出及Owner均无须修改，无未结规范冲突后才施工。先物理删除until及四次调用、withFixture旧无join清理片区，立即核缺席且保留函数/原clock/原反例仍原位，再按本节重建唯一等待/收尾链；不缓存旧骨架加工回填、不Git恢复，不用整文件删除冒充重构。对三个场景只局部接入完成信号与原work登记，原独立断言直接保留。339行原文件有充分落点，预计≤460行、函数≤75/7参数/8返回/10await/5嵌套/16复杂度，施工后用原结构计算器验证，不压行绕预算。

有限验收只增强原入口：超过旧100轮调度、边界前拒绝保留错误身份、边界前提前完成明确失败；原长下载正常/首次5xx、七种abort与headers/最后body竞态、失败归属/身份/幂等/原stage全保持；动作超时能abort并释放原fixture gate且join后清理，未join时不close/rm且报清理未完；边界已到但work不结算不能无限等待，watchdog取消及原timer/listener零残留。超时反例通过注入已过/当前单调deadline触发，不真实等待80/90秒或降低生产保护。原assert/租约/错误/counterexample分母不减，无需真实Provider或运行数据库；隔离SQLite仍原临时fixture。主Codex三轮设计反查已覆盖要求/真实消费者、原错误和虚拟/真实时间分离、失败join与保留资源，原J2独立技术分析已核80/90秒来源及两个不听abort的gate，源码未写。代码完成后≥2轮主审和原J2只读实际建设审查，再从原生CHANGE接续Q4候选→提交首推→完整READY；Q5仍单独处理，不能将本单局部通过冒充READY。新增原生失败先保全并查根因，无授权回退、清账或服务操作。

## 2. 受影响图、交叉查漏及保留裁决

发现来源A：`src/mediator/product-plugin-catalog.ts`的13个Plugin/43条route与Website canonical route policy穷举注册。来源B：反向追踪`prepare_clean_gpt_chat`、`context.gpt.execute/readConfirmedSubmit`、`browserFor`、Target acquisition、精确选择、WAL/来源读写及结果consumer。来源C：当前状态类型、SQLite读者、现有验收与inspector调用。A/B一致：跨任务续聊仅文章翻译和固定catalog；内部限流ack独立保留。B/C暴露下列接缝，不由拟改文件倒推分母。

13个Plugin全部保留：bazi-chart-interpretation、bazi-ai-full-analysis、bazi-report-followup、qimen-professional-answer、qimen-report-followup、hehun-ai-analysis、hehun-report-followup、naming-commercial、naming-from-existing-bazi-report、public-knowledge-article-pipeline、localization-production、payment-screenshot-observation、zeji-personal-selection。43条route按现役Catalog和原Product验收穷举，不手写第二路由表。

| 对象及真实消费者 | 处理决定与删除反事实 | 工单/验收 |
| --- | --- | --- |
| A `executor-source-checkpoint.ts`、`executor.ts::dispatchPlugin`；GPT ports、`evidence-artifacts.ts`窄图片reader；lane `readParentConversationUrl`、Store `readSourceConfirmedProviderEffect` | E2已落地链直接保留。删除会失去父结果绑定、合法旧attempt/异step定位及图片采用证明；不恢复旧selector、复制WAL或新增来源API | S1、T4/T5 |
| A `store-source-settlement.ts`；Store `readAcceptedSourceSettlements`；`runtime-source-readback-proofs.ts`、`runtime-source-handoff.ts`、`runtime-claim-recovery.ts`、`executor-source-checkpoint.ts` | 仅replaySettlements投影片区删建；其余签名验真、byIssued祖先/去环、ordinary recovery/retirement隔离、各调用source/hash校验直接保留。删除这些会误授风险或漏历史 | S1、T4 |
| A `production-browser-lifecycle.ts`、`production-atomic-call.ts`及session/child-result两个settled登记消费者 | E1只重建定位交接；原session未结算门、cache/source零页面、confirmed事实、原facade/park/settle/ack保留。删它们会重复发送或丢引用 | G1、T1/T3/T4/T6 |
| A lane→`browser-target-acquirer.ts`→原transport/actor→Extension acquisition/created-target/authority/readiness/registry | 仅原URL取得、运输、绑定及当前动作资格片区删建；原FIFO、deadline、取消、认证、孤儿收尾、release/slot/WAL保留。它们不能被URL保护替代 | B1/B2、T2/T3/T4/T6 |
| A `public-knowledge-article-pipeline/index.ts::produceResearchTurn/executeReview`及`seo-gpt-calls.ts::prepareAttachedTurnPrefix`两个消费者 | 只改生产文章获准revision的准备选择；首轮research及全部review原fresh、原profile/附件/Prompt/顺序保持。不能把共享prefix直接改成一律续聊 | P1、T1/T4/T6 |
| A localization-production文章翻译/catalog、其余12Plugin与全部review | 非目标代码直接保留；初始fresh或合法parent续聊、原模型/材料与effect身份不变。共享Browser/GPT变更仍按全部43route回归，不能因不改而不验 | T5/T6 |
| W `article-localization-owner.ts`、原material-source、terminal consumer及public-knowledge admission/publication | 只读核对并独立验收。输入task/result、父三元组、材料字节与结果schema不变，故不重建sender/事务/UI/支付/PDF；六语结果仍追到原存储与公开readback | T7 |

质检先判必要性：保留现有gpt lifecycle/artifact recovery、Browser target lifecycle/auto-pairing/provider recovery/FIFO/rule-mutants、Runtime recovery-contract、Catalog/Product验收及Owner inspector；它们分别防重复输入、错误父、竞态、私密越界或证据缺席。原位增强缺少的反例，不新建平行测试框架或质量入口。旧错误实现专属的文字/AST期待在同单退休，仍有效的行为断言全部承接；不得按新函数名称写固定PASS。旧proof入口的现状见§6，不虚构已可用的动态能力。

精确落点约定：上述Browser infrastructure文件均在`src/lib/browser/infrastructure/`；Extension文件在`src/lib/browser/chrome-extension/`；`BrowserTargetLeaseWait`在`src/lib/browser/exact-target/browser-target-lease.ts`；Node transport为`src/lib/browser/transport/browser-authority-websocket.ts`；协议源/生成器/投影为`src/lib/browser/protocol/browser-protocol.schema.json`、`generate-browser-protocol.mjs`、`generated/browser-protocol.generated.ts`。G1文件均在`src/capabilities/gpt/`，S1文件在`src/lib/local-runtime/production/`，P1两文件在`src/plugins/public-knowledge-article-pipeline/`。原生成器只执行、不改造；新生产文件、表、列及依赖均为无。

反向引用确定的质检局部消费者为`scripts/audit/domains/gpt/gpt-provider-contract-inspection.ts`、`scripts/audit/domains/local-browser-session/interaction-readiness-inspection.ts`、`target-claim-inspection.ts`及`scripts/acceptance/local-browser-rule-mutants.acceptance.ts`；原位承接新定位/字段/顺序和能击穿旧错误实现的反例，不删除其它合同检查。原GPT三个recovery/wait support、Browser target-lifecycle/auto-pairing/provider-effect recovery/FIFO与Runtime recovery-contract各在所属单直接增强，未涉及的保护零修改。发现新的真实反向消费者时先补方案，不凭此句开放任意质检施工。

## 3. 唯一目标链及身份

Website当前精确grant/task与父结果三元组→Runtime原durable accept/既有来源验证→Product原静态当前turn→GPT原Child原子闭包→Browser唯一lane取得原可信U并绑定当前Target/Document→原动作及WAL→独立locator/原checkpoint→原完整结果保全/Outbox→Website完整接收回执→local completed。网站自己的sender随后决定下一语言；AGENT无下一单裁决。

身份spine保持job/request_hash、accepted attempt/revision、原step/call/Child、effect identity、WAL authority、artifact/result ref/hash及receiving receipt。U只作私有定位，不进入effect identity、Website、Runtime持久化、日志、错误或普通proof；不以locatorHash相等代替URL相等。前序结果身份、URL定位与新输入资格分别取各自原Owner，不互相赋权。

有限分支及回接：

| 入口状态/事件 | 唯一决定及输出/readback | 失败/未知与恢复 |
| --- | --- | --- |
| 首次research，全历史可信零输入、未有U | Product显式fresh；Browser原根页准备→一次submit→独立URL绑定 | URL未就绪不撤CONFIRMED；原URL Child/readback回接，无预先存在/c/门 |
| 已结算live/cache/source后下一turn | GPT原settled事实→原atomic闭包选择U；Browser资格覆盖准备及native dispatch | 失配零后续危险输入；沿原typed失败/当前授权回接，不自行重发 |
| 同effect回答读回、Tab/进程丢失 | Browser exact effect→U→直接创建当前独占Target并收敛；Provider输入增量0 | 缺来源/坏密文/多义保持失败或原unaddressable，不能fresh |
| 已签provider_continuation | 原父结果采用集合→Browser全部可信locator全等→当前job独占Target | 错父/错hash/异step猜测/不同U/未决选定来源零输入拒绝；不读取父正文 |
| 获准新revision | Website原授权决定是否新输入；P1只选择继续原U的机械准备 | U无法证明即只停危险动作、保原历史/需求，原worker再查网站授权；不自签风险 |
| A→B导航（包括同loader SPA）、Document/activation/fence变化 | Browser同步使原资格失效，原物理guard拒绝；同U刷新须新Document重验 | 未dispatch可证零；已开始/未知保真实count/WAL，不伪no、不重发 |
| 混合来源、calls=[]、历史settled/风险祖先 | 原签名范围内逐类投影，可复用不丢，风险只属指定调用 | 无授权/篡改/环/错hash/退役unresolved仍拒绝；不新增来源或读回行为 |
| 暂停、取消、限流、结果已staged | 原控制/ack/交付Owner分别处理；原结果优先 | 不增协议或清理目标，不让URL保护递归阻塞紧急ack或撤销既成结果 |

这些分支没有新增持久状态、timer、重试器、恢复Owner或队列；纯定位失败没有新业务终态。旧历史已出现多个U的job不归为成功样本，不选择“最新”U修旧单。

## 4. 原子工单与施工纪律

所有单在获得相应施工授权后，由主Codex单独写代码；子智能体只审计。每单按下列保留裁决先推导合同实现，物理删除点名退休函数/片段→立即独立AST/符号/引用缺席检查→按合同建设唯一链→核真实consumer及反例。共文件独立职责保持原位。禁止缓存旧骨架再改写、从Git/临时副本复制恢复、改名搬家、转发壳、兼容桥或双路。删除即时证据来自本任务真实工具记录；最终diff/READY不能代替过程。局部调整必须明确标为局部调整，不统称整文件重构。

### 4.1 G0：规范与合同裁决（各原Owner；施工前置）

既有同effect定位、防重、父采用来源、混合settled复用义务直接保留，不为普通bug升法案版本。唯一待定规范目标是：**Website已授权的同一SEO文章新revision当前turn，可继续使用本job已有可信原locator定位U；只约束执行位置，不复用旧正文、旧准备、旧输入授权或恢复位置。普通其它产品fresh、未决输入防重及Website唯一裁决保持。**

设计时GPT-001/002与Browser-003/006对跨attempt URL用途限定同effect读回或已鉴权parent；Runtime-001-V82 forbidden[6]也排他限定原始WAL authority/完整recovery payload的使用目的，不能漏过其限制。Runtime-001为同一已批新用途不可分割的直接关联对象：仅把Website已授权的同一SEO文章新result revision当前turn的原会话执行定位加入原排他句，并把原“后者”明确回指provider_continuation分支；不授Runtime私有读取权、不复用旧内容、不变更grant/业务恢复/退役裁决。该条V82→V83，原其余forbidden、evidenceModes、Owner和appliesTo保留；直接law依赖、三份spec元数据、原Runtime蓝图、Manifest及原builder投影同步，不变更任何contract.version。依用户批准的精确范围，先由相应Owner定点同步这些条款及GPT/Browser/Website—AGENT蓝图；Website AI-Acceptance-002/013和SYSTEM/AI-ACCEPTANCE蓝图由网站Owner独立承接同一用途，业务task/result不增加URL或策略字段。涉及的冻结片段为FROZEN-GPT-CONVERSATION-LOCATOR-EFFECT-SEPARATION-001、FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001、TOMBSTONE-RECOVERY-AUTHORITY-001的定位用途；未取得对应规范授权时，G0及其依赖设计阻断，不删除或修改现法。母本和四份栏目源头不修改，提交/回答两门及其冻结条款不解冻。

法案/蓝图对齐后主Codex至少两遍核差分、Owner、引用与全部冻结保护，再进入代码；registry只由原generator投影。该条款不授权网站写AGENT，不授工厂业务决策。本轮执行授权已覆盖该精确目标，实施事实及两遍主审见§1.2。

### 4.2 S1：原来源投影完整性（agent-production-runtime，E2-R）

做：从已验签的同一delivery_priority_replay manifest输出其真实风险授权及可复用checkpoint，恢复原消费者所需的完整事实。唯一退休对象为`src/lib/local-runtime/production/store-source-settlement.ts::replaySettlements`当前互斥投影片区；重建仍落同符号，无新文件/导出/API。先验原readback_exhaustion_hash；exhausted为空仍走原reusableSettlements及payload-slot/calls=[]限制；非空时由原checkpointSettlements和riskSettlements分别投影后合并，不能因出现风险调用丢掉其它settled调用。

保留：原signedRowManifest、matchingCall、checkpoint/risk/rejection validators、byIssued及去环、不可变seal、祖先关系和retirement unresolved拒绝；不扩大grant、不刷新签名、不修改Browser WAL、SQL结构或旧行。原Store reader及§2四个实际生产消费者零改动承接输出。

验收：原`agent-production-runtime-recovery-contract.acceptance.ts`已有来源组只增加短调用；在已有`agent-production-runtime-recovery-contract.acceptance-support.ts`增加本组专用`verifyMixedReplaySourceProjection`，复用原临时Store/任务/源seal夹具，构造“同manifest两个不同call，一settled_reusable、一replay_exhausted”，经真实Store reader读回两类；不新增测试文件或第二fixture机制。再核其余四消费者的原行为（source投影、封口、普通恢复、父采用来源）。保持原纯risk、纯calls=[]、两代mixed、拒绝/篡改/祖先环/退役unresolved反例。现有祖先mixed用例继续保留，不能拿它替代新反例。失败沿原typed source错误，不伪补settlement或回填旧单。

### 4.3 B1：可信U取得、私密运输与新Target（local-browser-session，E1）

退休片区：`browser-target-acquirer.ts::ensureAvailableTarget`的无U读回交接、Extension `extension-target-acquisition.ts::preflightTargetAcquisition`/`extension-target-authority.ts::qualifyCandidateNavigation`/`extension-created-target.ts::createProductionCandidate`中恢复先开首页的组合；只删除各自定位部分，不删除原deadline、取消、认证、orphan cleanup或release职责。

目标：fresh显式请求仍原样复位首页；bound-observation仍只取当前已绑定页、缺失拒绝。authorized-continuation继续原lane `readParentConversationUrl`，零改E2已落地解析。confirmed-readback取得U时，在原`BrowserTargetLeaseWait`该分支增加一个仅调用期可选的`providerEffectIdentityHash`，复用lifecycle已有expectedProviderEffectIdentityHash/settled原effect参数；原lane acquire只原位校验并无损运输该字段，hash须合法、仅此mode允许，其它mode出现、显式null或未知字段不能被默默忽略。Browser以当前binding.jobId在原jobHistoryEvidence定位该唯一effect，再调用原readSourceConfirmedProviderEffect取得可信U。known effect缺失不得降为任取历史；不把调用者给的hash直接当已授权或已确认。

对没有指定effect、没有fresh请求但需要继续当前job的下一turn，仅按G0已准用途在同一Acquirer内核本job原完整effect历史：从全部可信CONFIRMED locator候选证明唯一U，不取latest/第一条，不读取回答/Prompt，不跨job。无候选、候选损坏或已知locator冲突均不能定位。未决/无锚点effect保留原事实，不被当作零输入或可复用来源，也不能仅因其存在否决其它精确effect的读回、兄弟job或已由当前授权允许的新effect；真正输入仍由原WAL完整历史/当前grant判定。无法证明旧未知动作位于U时不得声称该历史已满足全程同URL。全历史可信零输入而Product未显式fresh时拒绝当前动作，不偷变fresh；正常首次入口由Product原fresh负责。只需局部私有来源核验，不新增Store方法或公共resolver。

复用原TARGET_ACQUIRE、既有加密request-only `parentConversationUrl`键及四模式，不增加命令或URL持久化。该既有键在confirmed-readback同样携Browser已验的目标U（它不是业务父关系）；fresh/bound-observation仍禁止该键。同步Node transport、Extension parser/actor/acquisition唯一读写，保持exact keys/方向/签名/deadline/epoch及claim不含URL。因该模式载荷语义真实改变，Browser原schema revision 13→14，经原generator生成；不沿用同版本悄改、不接受13/14双读。仅Browser内部版本，Website V6=49、task/result=23、route manifest=4保持。

新Target直接以目标U创建并fresh读回，不先建首页；存活Target命中U时Page.navigate=0，原精确选择需要收敛时仍至多一次导航。已绑定authorized-continuation的B页仍保留原错址拒绝，不借本单放宽成自动修旧页。原createProductionCandidate只增加原Acquisition已验目的地参数，不增加创建者。bound目标缺失仍原重新核真实缺席，不能凭旧tabId复用操作者页。初次或恢复claim都在真正放行后携B2当前活绑定，未证明U正确不交互；原claimedJob快捷返回退休；同job现役live claim走原TARGET_ACQUIRE，Extension在原logical cycle内先沿原park撤当前同job的active资格及Node claim，再核本次assertCurrent并沿原acquisition完整重验。park只撤当前物理资格，不删原Tab/registry/WAL；取消即使发生于原logical门等待期间，入cycle后也先收束该原资源再拒新建/导航。异job及当前active的parent模式仍拒绝。Node不得预先单边清claim，以免导航publication误作本次acquisition并造成两端断裂。此处不使用历史Target或tabId恢复，不新增URL真源、恢复身份或输入权限。失败保原effect，零新Provider授权；取消/建页失败按原候选身份收尾并读回。

验收：原Browser lifecycle/auto-pairing/provider-effect recovery及FIFO组，覆盖四mode字段拒绝/无URL/错effect/异job/多U/unknown/坏密文、同U活Tab、新Target、已绑定Target和drain取消；旧协议拒绝、新双方一致。`local-browser-target-lifecycle-support.ts::exerciseAuthorizedContinuation`中“新Tab先首页再恰好一次Page.navigate”的旧正例期待退休，改为核tabs.create实际目的地U、零首页、至多一次必要精确导航；保留其错址parked页拒绝、claim无URL、零父Tab复用等独立断言。不能只mock返回U。原SQL exact reader、lane调度、40s/70s资格、1.5/2.5秒保护、release与所有非SEO fresh不变。

### 4.4 B2：当前物理执行位置（local-browser-session，E1）

退休片区：`extension-target-authority.ts::publishMainFrameNavigation`中仅Origin合格、同loader直接返回的导航资格；`extension-interaction-readiness.ts::ensureInteractionReady/assertInteractionReady`中不能约束原U的资格片区。重建同Owner原位置，不增URL服务、DOM轮询或第二资格对象。

原Extension job-bound Target执行绑定只有一个调用期预期URL：fresh绑定原固定根页，续聊/恢复绑定B1或现役`selectExactGptConversation`批准的U；没有活绑定不允许交互，不用null表示可接受任意GPT地址。首研究虽尚无U，clean之后的profile、附件、Composer及提交前的原native guard始终要求仍为该根页；外来跳到/c/B，即使新Document已经发布，下一Child也不能重新取得写资格。不能从当前B页、标题或caller自由值取得新U。Target退休时预期URL随原执行关系销毁，重启只从原WAL/父来源重取，不持久化第二份。

首提交引发根页→正式/c/迁移，只允许消费原已开始动作的直接收据读回，不能为新的准备/输入解锁。实现接缝为已有`extension-command-runtime.ts::executeExtensionCommandReply`向原authority调用无损传递已经验MAC的permit，原readiness复用其中submit Child/replayPolicy/command身份及本命令既有ProviderInputState.started：dispatch前仍须根页，started之后仅本次submit的只读直接后置可观察迁移；其余或后续native仍不得用该例外。原独立`get_submitted_gpt_conversation_url`只在Node已核同effect CONFIRMED的现役路径上，以同包currentUrl+exact userTurnId取得并CAS绑定WAL locator，零页面输入；其read-only permit允许此待定位窗口，不能因此把任意页面认作U。随后原精确选择消费WAL已验证U，替换根页预期URL；U一旦成立不得被B覆盖。定位失败/错误位点保留已发送或未知事实，不回根页、不再submit。本例外不加入submit完成条件、临时URL表、pending状态库或新命令。

为防“submit已started但URL尚停根页，下一条命令又写”的旁路，活Target绑定仅借用该首submit的原commandId及同一ProviderInputState引用，不能另建sent/pending布尔真相。该引用仅决定本次位置的普通准备/Provider输入资格：started后其它command的普通准备/Provider输入关闭；原command余下native仍须原根页/Document/permit及同一输入身份有效，跨到/c/后只可直接只读后置。原同effect独立locator及Browser已经验真U的原精确选择可继续；既有内部known-rate-limit ack仍是唯一窄例外，独立按原精确dialog、当前Target/Document/permit、Runtime持久control、1秒窗口及2.5秒后置执行一次，不以此引用、根页预期URL或locator已绑定作为新增前置，不递归先选U；不扩大到其它点击，不能清本引用、授普通输入或改原Provider事实。完成U绑定或原Target退休时清引用。引用不进入WAL、恢复身份或新attempt授权；删掉它会重新开放上述旁路，验收须在“仍为根页”和“已跳/c/”两种页面事实下分别击穿该错误实现。

原`start`的debugger事件回调处理主frame导航和Page.navigatedWithinDocument，**先同步使旧写资格失效，再沿原logical-access链异步发布新Document**；同loader SPA也不能保留旧写资格。事件只撤销资格，不作为新的可信locator/currentUrl事实。首提交已发生后的上述直接只读后置及独立locator不被降级成“未输入”；它们不重新授予写资格。原精确选择拥有的导航，只可按其批准目的地及原deadline/物理job/tab/chromeTarget身份收敛，不能被外来导航冒用；正常同U刷新可重新认领current Document。重建`executeConversationSelection`对应导航/绑定片段，保证受权导航自身不会被旧Document快照误杀，外来A→B不能穿透。

具体承载沿原`exact-target-runtime.ts`的live Target记录加入唯一expected URL和原submit command/InputState引用，`extension-target-observation.ts`主frame事实只补原CDP frame id供导航事件归属，不新增wire字段；Readiness只用一个进程内导航世代使现役lease同步失效，不持久化或形成恢复真相。上述均为B2当前物理绑定的直接生产消费者，删除会放开已发布错Document或首提交未定位后新输入的已证旁路。原interaction lease只复用当前Target/Document/activation与URL约束，输入前及每个native dispatch原同步guard重新核同一资格；导航事件必须在该guard可见，不能排在2.5秒/逻辑访问barrier之后才撤权。恢复精确导航属于原生命周期动作，不绕过deadline/session/permit。物理frame URL仅用于私有目标资格，不冒充DOM coherent packet的currentUrl；语义URL事实仍只来自原同包清洗。读取、fill、附件、click、keypress、原图读取共享这条物理边界，不逐Child添加业务门。保持两项提交确认和两项回答判据。

验收：原target-lifecycle/auto-pairing及rule-mutants中，在acquire后、prepare中、async读回后/真正native发送前注入A→B；包含同loader SPA、完整导航、首页、异Origin、同U刷新。必须另含“首研究clean已DONE、外来/c/B的新Document已经发布、下一Child才开始”的反例，以及首次真实submit正常根页→/c/、submit后外来跳B但原userTurn不在B、URL定位未完成又请求准备/输入的分支。另核首submit已确认但locator未绑定、独立URL Child中央preflight命中known-rate-limit：原control落账后ack依原窗口一次执行，引用与locator约束不被解除，普通输入仍关闭，ack后原URL定位继续；错dialog/旧Document/过窗仍按原合同拒绝。输入前错误时危险输入=0；已经发出或无法排除时保真实started/count/WAL，后续普通输入=0，不覆盖成no、不重发、不绑定B。变异为仅检查合法Origin、首轮空约束、仅结束后比URL、忽略SPA或推迟事件失效必须被击穿。原native primitive、单lane、known-rate-limit ack及原终态补交机制直接保留。

### 4.5 G1：live与恢复后下一turn的原URL交接（gpt，E1）

退休对象：`production-browser-lifecycle.ts::browserFor/recordSettledResult/selectSettledConversation`中的定位交接片区与`browserForMode/acquireBrowserLease`对应参数片区；`recordConfirmedProviderEffect`的定位触发片段同步原位改为登记待选择，首次locator取得后亦由原Child atomic闭包绑定U；不在Child原子闭包外导航。`production-atomic-call.ts`只作原位条件衔接，不重建Child解释器。仍以原session/current call/settledConversation/recoverySelectionRequired承载，不新增会话控制器或持久状态。

目标：只有Product显式prepare_clean请求选择fresh；无显式fresh时有parent沿原authorized-continuation，否则继续原job可信U，不能因active lease存在、进程缓存缺席或旧回答已结算而退回fresh。当前call未结算仍原样拒绝切换。结算登记先核同session U一致，再登记原result hash及原effect来源；现役child-result与session两个登记入口都须覆盖，不能删掉其中一个消费者来降复杂度。

已结算后下一次真正页面调用，无论原lease仍live还是重新acquire，均在原Child同一runAtomicStep内完成现役精确选择及B2绑定，然后才准备/输入。使原recoverySelectionRequired表达这一未完成交接；选择成功后才消耗，不因早return跳过；不得以“active.confirmedProviderEffect仍是前轮”永久跳过选择。cache/source返回本身仍零acquire/navigation/prepare/submit，只有下一个获准页面动作消费原U。known-rate-limit ack仍走原紧急路径，不增加递归选择；旧CONFIRMED/未知事实、park失败finally退休引用、原子identity跨lease及结果交付优先全部保留。

验收：原gpt artifact recovery/lifecycle及Product组：研究恢复→文章、文章恢复→图片、live lease下一turn、source/calls=[]包恢复→下一父链、当前lease/进程恢复、URL冲突、取消、损坏artifact、ack与重复settle。对“仍返回active但不选U”“选择晚于页面准备”“先登记hash再拒绝U”等错误实现失败；恢复只归还原答案，无额外Provider输入。只给B1传原effect identity，URL不进入Runtime/Website。

### 4.6 P1：SEO获准revision的准备选择（public-knowledge-article-pipeline，E1）

退休对象为`seo-gpt-calls.ts::prepareAttachedTurnPrefix`无条件fresh的准备选择片区；共函数的profile/附件打开/上传/对账完整保留，正常三轮及Prompt/模型零修改。通过一个本Plugin内部显式fresh布尔参数分开其两个真实消费者：`index.ts::produceResearchTurn`仅在Website当前resultRevision.revision=0请求首次fresh，已签新revision不请求clean，由G1/B1按原可信U定位；`executeReview`始终保留原fresh。不是按本地错误决定重做、跳过研究或签revision，Product仍从第一入口执行原静态Flow。

缺U不导航首页，不用空附件/跳过profile凑通过；由原typed失败回当前worker及Website。首次零输入重试仍可按原readConfirmedSubmit/WAL规则准备，源复用按原source执行，不因revision数字绕过防重。原文章翻译/catalog的已鉴权parent路径无需改。

验收复用Product原13Plugin/43route入口，增加produce_article新revision仍U及两个review保持fresh；保留普通首次produce_article、研究decline、完整三轮、中文材料/真实原图/原结果交付。首研究已有U但新revision仍调用clean的变异须被击穿；不能把review或八字也改成续聊。

## 5. 结构承载、施工顺序与停止

已按原结构计算器只读核现状，预算为文件500行；函数75行/7参数/8返回/10await/5嵌套/16复杂度。lifecycle462行，browserForMode69行、recordSettledResult复杂度16、acquireBrowserLease63行；authority301行/acquisition38行7await；readiness121行/ensure复杂度11；acquirer111行；Store源码493行不改；settlement316行/replay9行。不能在recordSettledResult继续叠判断，必须按G1先删除错误交接，再用现有数据单向登记/消费简化；无需新生产文件或抽象层。B1来源定位留原Acquirer，原lane父定位直接复用；不往493行Store加方法。S1主验收480行不堆新场景，专用fixture落已有436行support，新增同一职责fixture连同imports须不超过剩余64行且单函数符合六项指标；原419行GPT artifact support、325行Browser target support及459行provider recovery也逐项按剩余空间承接，不删独立有效用例让路。承载不足先回本单设计，不推给下一轮切割、不靠压行或转发搬家。施工前按全部六项函数指标再核实际目标。

顺序：完成G0精确授权与规范对齐→B1定位/协议→B2物理位置→G1交接→P1准备选择，作为E1一个闭合根因族完成普通验证与实际建设审查；S1为独立E2-R根因族，另行完成其消费者验证。不得把W5结构/旧Exam/其它原生失败混为本方案修复。只有后续明确授权CI-FULL时才沿冻结Skill逐根因族CHANGE→提交首推→完整READY→二推；READ_ONLY/方案阶段不运行这些命令。

主Codex完成两遍代码自检，再由只读子智能体审实际代码与本方案的差异；前轮方案审查不抵扣本轮实际建设审查。各单旧片区即时缺席检查、重建新链和保留对象原位核验分别保留真实操作记录，不建过程台账。

运行切换仅在另获授权后：原Runtime停止新claim并真实join在途executor、原Outbox写及Browser命令handler/native；原worker槽须已按原ACK/dispose规则收束，或旧worker已确证物理退出且原未决WAL完整保留。Promise结束不等于native退出，历史DISPATCHED也不等于仍有活writer；不能伪结算、强清槽或无限等待历史unknown。不能证明旧writer退出时停止切换。Node与Extension按同一Browser revision14/build一次切换，原认证/原发布身份验真后恢复；旧版本拒绝，不设置兼容期/feature flag。网站V6/task/result未变，独立部署；网站若当前实际serving不是AGENT dependency49则维持原session拒绝，先由网站Owner完成其真实切换，不强开混用。本轮不替W5或网站未完成施工宣称运行可用。

没有自动回退/清账授权。候选失败先停相应危险输入、保全事实；不得Git reset/stash/clean、覆盖用户改动、恢复旧骨架、清WAL/Outbox、造替代job、重译历史或降级协议。需要回退由授权人另行指定基线、实际effects与兼容性，必须如实报告回退而非重构。发现必要漏列consumer、结构超限、authority冲突或实质漂移，先回本唯一方案闭合受影响部分；不能删验收分母保“可施工”。

## 6. 功能验收、真实证据与交付

| 验收 | 必须证明的行为及原入口 |
| --- | --- |
| T1 正常链 | 原Product验收保正常研究/文章/原图及现役五语严格序列，首次fresh；真实运行另取bazi/qimen各一篇合法proceed样本沿原任务到韩语，不以decline或旧文章代成功 |
| T2 错址与实时资格 | B2所有时点/SPA/完整导航/同U刷新；URL仅检查Origin、仅事后比较、事件延迟生效等错误实现均失败；原Terminal/WAL计数和未知保持 |
| T3 首次locator与已发送 | 首次首页→/c/正常，定位迟到/失败不撤CONFIRMED；发送后B页不被采用为U、不重发；原query/fragment清洗与错误URL拒绝不变 |
| T4 来源与恢复 | S1同manifest异call混合、纯风险/calls=[]/祖先/退役unresolved；G1所有live/cache/source/Tab/进程/revision交接；父采用来源、图片metadata-only与旧effect防重均保持 |
| T5 父关系 | 已落地E2父子step不同/来源attempt不同、完整采用集合全等；错父/ref/hash/采用证明/多个U拒绝。Website仍以已接纳直接前序签任务，AGENT不得补父或跳语 |
| T6 全部共享消费者 | 从原Catalog和route policy发现全部43route，与原Product自有验收一一对应。非SEO/全部review fresh、catalog顺序父链、单job独占、FIFO/节拍、ack、Outbox/receiving及原source消费者无回归；不抽样称全覆盖 |
| T7 网站终点 | 网站原Owner按同article/version/hash/locale核中文及五语原artifact/result/接纳receipt/binding/payload/released及公开readback；只读关联本次合法task/result，不改中文计数、清除保护、UI或业务状态 |

功能质量与施工纪律分开验收。功能上“1+1”是原去重/授权/交付全部成立，同时原错址反例零危险输入、合法恢复/来源分支正确继续U；不能牺牲成熟成功路径换少报错。没有新常驻对象、持久结构、服务、队列、timer或恢复链；协议版本是既有运输语义切换，不是新业务能力。删掉宽松定位和互斥来源选择，保留必要验证；仅减少行数不构成收益。

本轮原Browser综合验收已暴露DOM场景连续静默：仅在原exerciseLocalBrowserDomIntent串行场景循环输出实际场景开始/结束与单调耗时，保留原顺序、全部断言及等待边界，不添定时器、运行器或性能报告。该观测不得当作业务或质量通过事实。

实际测试复用现有npm脚本：typecheck、acceptance:gpt、acceptance:agent-production-runtime、acceptance:architecture-boundary、acceptance:capability-governance、acceptance:local-browser-terminal及两处Product原验收。按影响先定向、后原生；局部命令不替代quality:check，文档方案阶段不运行。READY只对同一clean commit由唯一原生入口裁决。不给READY加硬编码总超时，不缩1.5/2.5/40/70秒及停止空回答窗口；只报告可比原件证明的耗时收益，不为提速扩大到另一基础设施片区。

真实URL证据只由Browser Owner在授权后按原WAL/effect/locator reader读取，内存比较全部相关canonical URL，输出原job/attempt/revision/step/effect/结果引用与比较结果，不输出U或另造URL hash身份。静态隔离竞态必须与合法真实运行分开，不在生产故意串聊。源/旧revision、图片重做与翻译复用的实际effects一并关联，不挑成功行凑全等。无法自然观察的异常如实标仅隔离验收；缺任何真实步骤不得称八步已实证。

现役`scripts/acceptance/gpt.real-proof.ts`与`local-browser.real-proof.ts`目前明确抛出OWNER_ISOLATED_RELEASE_PROOF_NOT_ADMITTED；Website public-knowledge dynamic declaration只含published-article-search-sitemap，均不能冒充八步证明。本轮不重建整套RELEASE治理或增加第二runner。若后续要求正式RELEASE/整案冻结，必须在原唯一质量链和对应Owner合同中先闭合这些真实证据入口；入口未闭合即不声明RELEASE/冻结。工厂修复的代码、原生READY、真实URL观察与Website六语完成分别报告，不相互替代。

本轮方案先经主Codex三轮核源头/四维、逆向分支/消费者、删除反事实/施工可执行性，再由全新只读子智能体核现役源头、法案和闭环Skill。主审不以百分比自评分；独立审查未放行不得结束方案建设。没有审查结论替代用户规范授权。最终按精确对象说明真正重建、经论证保留、局部修改、删除退役、失败回退及尚未完成；过程缺证写“无法核实重构纪律”，已违背纪律写“未满足重构要求”，不能以功能通过掩盖。
