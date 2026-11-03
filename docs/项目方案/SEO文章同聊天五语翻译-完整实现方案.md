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
