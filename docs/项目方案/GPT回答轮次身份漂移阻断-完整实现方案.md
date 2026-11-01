# GPT 回答轮次身份漂移阻断－完整实现方案

## 1. 当前范围与终点

状态：已获准施工（代码与定向验收后清除阻塞工单，再按原生 CI-FULL 完成 READY；未授权 RELEASE）。日期：2026-11-01，Asia/Dubai。需求与施工 Owner：AGENT localization-production；Browser 只提供既有页面事实，Website.ai-acceptance 签发任务、attempt、result_revision 和恢复授权，Website.localization 接纳译文。本文是本轮唯一方案；保留文件路径和现有 architecture-boundary Manifest 归属，不新增方案、台账或质量入口。

本轮用户要求：先理解现役法案及蓝图，完整读取闭环 Skill 至少两遍，按片区删除后重构设计；主 Codex 三轮自审后，交只读子智能体独立审查，未放行不得结束方案建设。随后明确：不要用代码强救旧故障，能按原流程删除就不建联动救援；再要求通过 Chrome 插件核对 D341、9060，简单问题可以一起处理。授权人现已明确按本方案实施，范围包括法案、施工图、代码、质检及数据库操作，并要求迭代完成后清除阻塞工单、执行 CI-FULL；本次精确实施对象仍限 W1/W2 和 W0 原入口运行操作，不把范围授权解释为相邻基础设施解冻。

本轮只建设固定文案 `localization_static_catalog/produce_locale_catalog` 的原输入标记身份，解决 B29、710 的已证修订撞标，同时保全合法跨修订的原答案读回。D341、9060 纳入旧故障单现场裁决与原入口清理；其独立历史故障未证出具体代码根因，不列为本次已修复的 Browser 缺陷。旧单的目标是退出阻塞，新增任务的目标是每个获准现实输入准确读回自己的回答。清旧单不等于证明历史故障不会再发生。

业务终点：新的固定文案任务沿 Website 已签任务 → 原 Product → 原 GPT/Browser effect → 原回答 artifact → Runtime 完整结果及原 terminal Outbox → Website 同结果 receiving receipt → Runtime local completed；再核 Website.localization 的同任务译文接纳及在用版本。AGENT 工厂完成不新增领域准入等待门；领域接纳另由 Website 原 Owner 证明。既有同 cohort 五语 direct-parent URL 关系保持，不能以新的标记生成新的聊天、父任务或 Provider 授权。

## 2. 候选及证据边界

| 参与者 | 本次绑定 | 写入边界 |
|---|---|---|
| AGENT | realpath `/Users/nexgen/Documents/AGENT`；main；HEAD 与 origin/main 均 `923d532f54c6288bf6514ae6a698d7e7b18ae867` | 代码候选限 W1/W2，运行操作限 W0。原 dirty `docs/项目方案/SEO文章同聊天五语翻译-完整实现方案.md` 是同会话此前受权 E2.7 操作记录，完整保留；为形成 READY clean commit，仅经原生 CHANGE 后单独提交该既有文档差异，不夹入本次代码提交。 |
| Website | realpath `/Users/nexgen/Documents/xuanxue-web`；main；HEAD `429751d64a3d4b5c8f8237ee5bbd01b875ea9b54`，tracking origin/main | 只读和后续获准的原管理员操作；不修改此仓。现有未跟踪《全系统工单安全删除与自动接续》方案属于另一任务，尚在设计，不作为已建能力或本轮依赖。 |

设计 source 绑定以下有序文件组。各文件计算 SHA-256，再将有序 `[repoRelativePath, sha256]` 数组用 UTF-8 JSON 紧凑编码（ensure_ascii=false，无空格）计算 SHA-256：`1da0a2900d53dc544413264be0cc9e3464da8a58a65de890ad60b8449e73b6c4`。这是方案内的来源绑定，不新增候选回执；本文不进入该组，文档 hash 在交付时另报。施工前重读原始任务及当前 HEAD/overlay；相关内容漂移则重算受影响设计，不要求无关并行工作回退。

1. `.github/instructions/agent-rules/基础法案.md`
2. `.github/instructions/agent-rules/功能法案.md`
3. `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md`
4. `docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md`
5. `docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md`
6. `scripts/audit/domains/architecture-boundary/manifest.json`
7. `src/plugins/localization-production/flow.ts`
8. `src/plugins/localization-production/static-catalog-flow.ts`
9. `src/plugins/localization-production/index.ts`
10. `src/mediator/product-plugin-contract.ts`
11. `src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts`
12. `src/capabilities/gpt/web/gpt-dom-observation.ts`
13. `scripts/acceptance/product-plugins/localization-production.acceptance.ts`
14. `src/capabilities/gpt/product-api.ts`
15. `src/capabilities/gpt/production-child-tools.ts`
16. `src/capabilities/gpt/production-child-result.ts`
17. `src/capabilities/gpt/production-execution-session.ts`
18. `src/capabilities/gpt/production-execution-source-reuse.ts`
19. `src/lib/local-runtime/production/runtime-claim-recovery.ts`
20. `scripts/acceptance/agent-production-runtime-payload-slot.acceptance-support.ts`

源头核对：主 Codex 已完整遍历 AGENT 两份 active law，完整读取相关 GPT、Browser、Website—AGENT Blueprint，并按冻结说明书 §0/4/35/36—38/41—44/46—48/51—54/79 约束方案。闭环 Skill 完整双遍核对已完成。本文不修改四栏目冻结边界蓝图、专业内容、专业 Skill、源文或语言政策；这些仍由 Website 的对应原件决定，改变标记不取得内容主权。

### 2.1 已证事故

Browser WAL 通过只读 `BrowserMutationEvidence.readAtomicStepOutcome` 核 seal 和 locator，不实例化会写库的 BrowserMutationStore；Website 使用只读数据库事务。实时日志为 `.grasseye-local/runtime-logs/agent/11dca487-634d-41d3-b4b6-43f9748732c5-0001.jsonl`，日志只诊断，不代替 WAL 或接纳记录。

| 简称、精确任务 | 已证事实及直接断裂 | 本轮裁决 |
|---|---|---|
| B29：`aiprod_b29a65f8-d2cb-42db-8913-c1353d7152f3` | Website 分别批准 r0/r1；两次各一次 CONFIRMED 输入。在同 URL `https://chatgpt.com/c/6ae0a490-82b8-83eb-a847-3e1177b2ea74`，当前两个不同 user `16862e76-e396-4fa0-99ea-fb27a7a07ef6`、`746e023f-1c83-48b0-a1a9-2e19a869fe6b` 都含 `[GRASSEYE:0d16bb748e775332f8ded1a1]`。原 reader 正确拒绝多义，不是重复误发送。 | W0 旧单退出；W1/W2 防止新修订再次撞标。 |
| 710：`aiprod_710093f2-38f8-478f-a40a-09b47fa66a5f` | r0/r1 同样均获 Website 授权并各输入一次；同 URL `https://chatgpt.com/c/6ae0a0e1-c694-83eb-b527-f90fd0423366` 中两个 user `7ad42e68-c400-4217-ac0f-93ed9d40eb97`、`de5d3328-d70e-4c14-af02-d5a180ddaf49` 共用 `[GRASSEYE:8e08f057606682f591e12cdc]`。 | 同根因合并 W1/W2；不单建一个修复链。 |
| D341：`aiprod_d341e551-bc05-4fc6-a3ed-e7de52caf1d3` | r0，attempt `8046cffc-e631-46b8-8ef9-6aba2e4f7736`；09:17:29Z 原 submit CONFIRMED、输入1，09:18:10Z 原 locator 绑定 `https://chatgpt.com/c/6ae0a1a8-fbe0-83eb-8722-749de959382c`、user `1216a113-f8f4-4561-9cac-2a2953905edb`。12:44—12:50Z Chrome 原 tab 900824241 仅前四语，原 user 与 `[GRASSEYE:037c46eafe86e968f96dc777]` 均0命中，stop=0；原日志持续 exact-user-turn-unavailable。 | 当前消息缺席已证；缺席发生在哪一步及具体原因未证，不能说是 marker 碰撞或已知 Provider 丢失。只纳入 W0，保留原 typed failure。 |
| 9060：`aiprod_9060efce-a682-415d-a38c-7841c2935793` | r0，attempt `02ec0eea-5d33-4760-b4cb-3e3aaeb262de`；12:23:01Z 模型选择器缺席、Provider输入0，随后原链恢复，12:24:33Z submit CONFIRMED、输入1。12:26:31Z `checkpoint_gpt_text_response` 的 exact-assistant-observation 报 BROWSER_DOCUMENT_INVALID。Chrome 原 tab 900824300 当前同 URL `https://chatgpt.com/c/6ae10f4d-d4dc-83ed-b7e2-a621e4d448ff` 有唯一 user `5291e321-5ac6-4852-84f2-4b2a3ac5a900` 和 `[GRASSEYE:444aeba7f1399646e9f303f4]`；紧邻唯一 assistant、单正文、合法重复同 UUID，5条 ko-KR v3 JSON，stop=0，现有结构条件均满足。 | 早期模型故障已越过；历史回答读取失败尚不能定位具体校验，当前没有重现。只纳入 W0，不增加 selector、重试或放宽 reader。 |

12:53Z Website 同身份回读：D341、9060 均无 result/staged result、无 business_consumed；9060 为 SOURCE_HANDOFF_PENDING，latest_failure_code 仍是早期 BROWSER_DOM_CANDIDATE_MISSING，不能拿这个旧投影替代最后一次 native readback failure。事故页面与原凭据独立比对，未刷新、导航、输入或重发 Chrome 工厂标签。

7B `aiprod_7b4075ac-10da-4770-91fb-837882490a3f` 和 93 `aiprod_93ab81de-5539-4bf0-b468-1cd6aeab2f45` 已在原链接纳，排除删除；择吉和共享 socket 的独立问题不进入本轮固定文案代码范围。

## 3. 法案、施工图、实现及前轮连续性

| 维度 | 当前约束与裁决 |
|---|---|
| 法案 | `LAW-ARCHITECTURE-BOUNDARY-001-V19/002-V2`、`LAW-CAPABILITY-GOVERNANCE-001-V20/002-V5`：Product 拥有自身静态策略；不新增语义质量门。`LAW-GPT-001-V68/002-V33`、`LAW-LOCAL-BROWSER-SESSION-003-V49/004-V59/006-V48`：原 marker 唯一定位、effect 与 locator 分离、当前 Document 原子读取、两门结算。`LAW-AGENT-PRODUCTION-RUNTIME-004-V48`：同完整结果 receiving receipt 后 local completed，领域业务由 Website 原 Owner完成。斜线后为同前缀的精确lawId尾部，不产生新法条。均保留，无本轮法案修订对象。 |
| 施工图 | GPT Blueprint V71、Browser Blueprint V58、Website—AGENT Blueprint V69 与上述现役法案对本断点一致：都要求原 Product marker 唯一，不要求 marker 必须只含 job/step，也未授权把旧 UUID 恢复成永久主键。新标记仍是既有 string，原 two-gates、无 Prompt rehash、URL与effect分离冻结不变。无 Blueprint/spec/wire 变更。 |
| 实现 | `flow.ts:78 markerFor` 仅 hash job_id+product_step_id；`:209 executeIsolatedLocalizationJsonTurn` 对不同获准输入仍取同一标记，虽然 Prompt 已携带 resultRevision。`static-catalog-flow.ts:productionStep` 有意表达稳定生产调用身份。第一断裂是固定文案 Product 没区分不同原输入；同时原 helper 预先固定marker，不能在恢复时按实际原submit来源确定marker。不得改 step/call/effect 身份来绕过它。 |
| 质检 | 现有 `localization-production.acceptance.ts:274` 恰好钉死缺少修订的公式，但没有比较同任务两个修订；要替换这一断言，增强原夹具，而不是删掉 Browser 多义保护。唯一质量入口仍 `npm run quality:check -- CHANGE/READY/RELEASE`，各等级不可互代。 |

前轮连续性：2026-09-28 事故 `859179a0…`、`8f097f0a…` 的提交 UUID 在后续 DOM 变更，原 marker 保留。这一事实及已落地保护由本文前轮版本、当前 marker reader 和现役法案共同支持；本轮保留“提交 UUID 只用于 WAL lineage；原 URL+原 marker 定位当前 user/紧邻 assistant”。此前讨论过的“用原 UUID 替换 marker”不进入目标方案。`GPT文本回答扫描门禁根治`、`GPT文本回答挂载竞态` 的成熟原子采样及 null 物化保护保留，历史80步与永久UUID做法不得恢复。旧版本本文的 UUID 迁移施工项已由当前代码/法案承接，本文更新为当前根因；旧 en-US profile 取证不作为本轮施工项。`SEO文章同聊天五语翻译` 的父会话/墓碑来源工作保留，不与本次标记混修。

采用深度调查、窄施工：命中同片区历史回归，需要核前轮不变量；不据此扩大代码改造面。用三种不同来源交叉查漏：①Catalog/Plugin accepts 与 routePolicy枚举，定位全部合法路由；②导出符号及输入反向引用，定位真实调用方；③Browser WAL、Chrome DOM、Website receiving/领域状态，核执行结果。`executeIsolatedLocalizationJsonTurn` 唯一生产消费者是 static-catalog-flow，另一消费者是本 Product acceptance；`executeOwnedFlow` 的六条 report/article primary/review 路由均不调用它。因此固定专用标记变更到此闭合；GPT/Browser 继续消费同型 string，Task/result/Child schema、URL关系、授权、副作用基数、artifact/Outbox语义均不变。其他 Product不新增此标记公式，既有跨修订策略未由本轮事故证成，不顺手扩改。

## 4. 唯一目标链与删除裁决

固定文案新消息标记定义为：

```text
[GRASSEYE:<现有 hashCanonical({job_id, product_step_id}).slice(7,31)>:a<原Provider输入所属的accepted attempt UUID>]
```

新提交前，原输入来源取当前 `context.gpt.attemptId`；取得已确认submit后，读回只取现有必填 `submit.sourceAttemptId`，不能取当前恢复attempt或当前revision。两者使用同一局部纯生成表达式，不解析历史Prompt或查第二存储。新输入的原来源就是当前accepted attempt；跨attempt/跨revision恢复拿到的是原来源，故重建原消息标记。Website `job-claim-authority.ts::createLeaseGrant` 对新accepted attempt使用randomUUID、对continuing accepted attempt保留原ID；固定Product每attempt只有一个production submit。当前revision变化本身不授权新输入；真正获准的新输入属于新的accepted attempt，所以同job/step的不同获准现实输入具有不同显式UUID后缀，而同effect恢复保持原后缀。不是将当前attempt加入Provider授权或effect key；原effect/WAL身份算法、原inputHash恢复规则完全保留，不能凭一个新UUID发送。

这不是任意引入新身份：`ProductGptChildResult.sourceAttemptId` 是既有必填字段；正常submit的 `productChildResult` 返回当前attempt，`readSourceSubmit`及 `ProductionGptSourceReuse.readConfirmedSubmit` 返回原source attempt，三者已有真实消费者和校验。保持原hash前缀区分job/step，显式UUID后缀不再次截断；正常生产长度73，处于原128字符上限。Browser仍拒绝实际多义，Website结果仍只含原v3字段。

该字段不是任意历史Browser行的通用原attempt保证：普通 `productChildResult` 只写current execution attempt，Browser普通lookup也未按attempt过滤；本方案依赖现役合法授权链把两者约束到同一已输入accepted attempt。Website `job-claim-repository.ts::grantJob` 的continuingAcceptedAttempt保留原ID；Runtime `runtime-source-handoff.ts::ordinaryZeroSource` 只允许全zero或已经合法结算的来源走普通新attempt，未结算已输入来源不能借此进入普通读回；域拒收后的新输入升revision，普通lookup精确限定该revision；风险旧来源走readbackOnlyCalls.source/readSourceSubmit，settled旧来源走sourceReusableCalls。zeroRiskRecovery回到r0仍受 `inheritedReplayAlreadySettled/ordinaryZeroSource` 的历史结算约束，不能凭新grant字段回落推导再次输入。施工验收保留这些原运输/授权用例；若查出合法可达的current B普通读回原输入A，立即停止本方案，不假定字段名能补足来源，也不修改该公共字段语义。

独立审查F1已证的反例必须保留：`runtime-claim-recovery.ts::changedRiskSourceReadbacks` 可在当前r6、旧effect r0…r5的合法风险恢复中，把迟到CONFIRMED旧effect转readback-only，且原checkpoint尚不存在。原验收 `agent-production-runtime-payload-slot.acceptance-support.ts:129—202` 已覆盖其签发与运输。只按当前revision生成marker会找错消息，故退休这一候选做法。新目标沿原submit.sourceAttemptId重建旧输入标记；已settled sourceReusableCalls仍按原checkpoint hash直接读artifact，两条现役分支均保留，不建设救援或兼容机制。

唯一固定链：Website原授权 → static-catalog-flow 验原两ZIP/ContextBundle → 固定专用函数准备当前新输入marker/Prompt → 原createFlow.read先读confirmed submit → 未输入才原fresh/profile/attach/write/一次submit → 以该submit.sourceAttemptId确定唯一原输入marker → 原readSubmittedTurn沿原URL和同一原输入marker读回 → 原stop/正文结算 → 原Product JSON结果 → 原artifact/Outbox/receiving receipt/local completed → Website.localization领域读回。固定分支不再调用预先固定marker的runAuthorizedTurn，后者只保留给六条动态路由；没有旧/新fallback或同任务第二执行链。

先审质检，再审生产的保留/删除决定：

| 单元、真实消费者 | 删除反事实及处置 |
|---|---|
| Product 原 acceptance/夹具，由 architecture-boundary 原 Exam消费 | 缺少新输入区分与旧来源恢复用例会放过当前错误公式或F1。增强原用例覆盖新accepted输入不同、同effect恢复来源相同、跨revision旧来源、Prompt/checkpoint一致；保留附件、fresh/direct parent、confirmed零输入用例。不新增独立测试框架、质检包装器或重复报告。 |
| `executeIsolatedLocalizationJsonTurn`，static-catalog-flow唯一生产消费 | 固定文案必须有一次JSON生产和同marker交接。退休旧函数完整实现，再按§4合同重建同一导出；删掉固定分支对无修订 markerFor 的调用。公共 helper 对六条动态路由仍必要，原位保留。 |
| `productionStep`、原callId、createFlow/readConfirmedSubmit、selectProfile、approvedAttachments/attachMaterials、`readSubmittedTurn` | 原effect/WAL查找、准备动作、零新增输入与原URL回读的真实消费者；删除或换身份可能再次输入。全部原位直接复用，不重建、不搬家、不复制。`runAuthorizedTurn`原实现只由六条动态路由继续复用；固定入口需在submit之后消费原来源，不能用其原先固定marker的委托替代。 |
| Browser marker reader、固定 Document采样、GPT decoder、两门结算、WAL/原 locator | 防串回答、页面变化、重复现实输入的现役保护；Product测试不能替代。原位保留；不加旧UUID优先、marker数组、修订正文解析、第二selector或fallback。 |
| 两ZIP/context/候选解析、Product Skill、结果v3、artifact/Outbox及Website接纳 | 批准源与唯一结果的真实链路；标记不改变任何内容/结果字段。原位直接复用，不新增缓存、状态、表、端口或通用恢复器。 |
| 旧故障的兼容/救援机制 | 当前用户已选择删除旧故障，无保留消费者。目标方案不建设旧 marker转换、r0兼容、历史Prompt扫描、双版本读取或新风险授权器。 |
| 本文及历史方案 | 本文承载当前施工，不另建固定文案竞争方案。相关历史只作为不变量来源，不再复制旧施工过程；现有成熟代码保持其现役职责。 |

## 5. 原子工单

### W0：旧执行退出及切换门（运行操作，不建设代码）

- **做什么**：在代码建设及定向验收完成后的切换窗口，让旧固定文案执行在旧候选收束，清除§2.1列明四张无结果故障单，消除旧 marker未完成状态跨入新公式的需要。
- **不做什么**：不启用另一任务尚未建设的统一删除/自动接续；不改Website、Runtime、数据库表或权限；不直接删SQL/文件/WAL；不代签revision、Provider重发或改源hash；不动已接纳父任务/译文。择吉不在本单。
- **谁负责、哪里**：运行收束由 AGENT Runtime 原 `runtime-startup.ts::close/shutdownRuntime`、`worker-session.ts::request` 负责；固定单删除由 Website.localization 原 `localization-control-room-handler.ts::deleteLocalizationStaticCatalogJob` → `static-catalog-cleanup.ts::readStaticCatalogClearPreview/clearStaticCatalogJobs` 负责。使用原管理员页和原请求，不绕过 step-up/origin/RLS。
- **保留什么**：原源文/政策、合格current译文、已完成父结果及它们仍需的locator/evidence；原删除图的保护约束与原审计回执；删除前只读确认同身份无result/staged/业务接纳。
- **删除什么**：仅原预览声明可删的四张故障执行及其专属副本/专属状态，精确ID见§2.1。Browser/Runtime专属清理由原Owner执行，不手工扩大清除范围。
- **重建或修改什么**：无代码重建或修改。后继任务只由 Website现役producer在原批准需求内创建；现役规则不允许自动接续时停在无旧执行状态，不借另一方案推定能力已存在。
- **怎样施工**：先请求原Runtime drain，确认新claim关闭，原active执行已结束，shutdown完成且旧writer/worker不再运行，再做删除。删除前枚举该设备全部未完成固定任务及其provider/source effect；已存在旧标记的合法在途先在旧候选完成，四张故障通过原预览退出。出现清单外不能正常收束的旧effect，停止cutover并回到本文补证，不默默删正常任务。逐单读取原preview及closure，保护项不得在可删闭包内；永久删除到执行时依工具确认要求确认，执行后回读原job缺席和原删除收据。整个运行切换窗口不启用新代码、新claim或重发。代码文件与隔离验收可以先完成，但不得被现役进程热加载；施工前核实际进程与启动方式，未停止的 watcher 必须先经原 Owner 收束。
- **怎样验收**：代码切换前四张旧job分别有原删除成功/幂等收据及缺席读回；已完成父任务和current译文仍可读；设备上无仍获准消费旧固定marker的未完成输入/source grant；旧执行进程已收束。本地旧专属记录的清理安排在新候选获准启用后，由原 `runtime-loops.ts::reconcileUnfinishedExecutionsWithoutReceipt`、`runtime-claim.ts` 的原失败回读及 `runtime-claim-preproduct.ts::readClaimAuthority` 发现精确Website缺席，调用原 `purgeDeletedJob`，不得进入已删任务的Product或Provider。它是W2后的运行收尾，不要求已停止的Runtime先执行清理；也不启动一套带旧marker兼容的清理worker。逐单回读本地task/专属证据/占位消失与共享父保全；不以Website 404代替本地清理。cleanup失败停止后续运行并回到原Owner读事实，不手工清账。旧Provider聊天记录不删除，不作为已交付译文。
- **失败怎么办**：preview拒绝、受保护引用、删除后状态未知或旧writer未结束均停止切换；新候选启用后的原cleanup未收束则停止后续运行，不倒置为“停止的旧Runtime先清理”。先读同身份原回执/后置条件，不盲目重复删除或submit。旧任务在删除前已完成则保全其结果，该项按完成退出旧队列，不删除成果；这不是新增恢复路径。不可逆删除不声称可回滚，后继资格仍归Website。

### W1：固定专用标记片区删除后重建

- **做什么**：重建唯一固定JSON turn入口，用已确认submit的原输入来源闭合消息标记；区分不同获准输入并保全F1的合法跨修订读回，不用Browser选择器强救旧故障。
- **不做什么**：不改变六条动态report/article/review路径、Child数量/回合、模型、两ZIP、Prompt专业正文、step/call/session/effect身份、父选择、URL导航、result schema、Browser/GPT/Runtime或Website代码；不恢复旧UUID主键、旧marker兼容或第二链路。
- **谁负责、哪里**：AGENT localization-production，`src/plugins/localization-production/flow.ts::executeIsolatedLocalizationJsonTurn` 的完整函数片区；生产调用方 `static-catalog-flow.ts::executeStaticCatalogFlow` 接口不变。
- **保留什么**：§4保留裁决全部成立；flow.ts同文件其他函数/类型/常量，尤其createFlow、selectProfile、approvedAttachments/attachMaterials、readSubmittedTurn及动态分支的runAuthorizedTurn/markerFor原位保留。这些是独立现役职责，不因共文件而删除重建；不保存旧固定函数副本再加工。
- **删除什么**：完整旧 `executeIsolatedLocalizationJsonTurn` 实现及其对无修订markerFor的固定分支调用。先物理删除该完整导出片区，即时以符号/AST/引用核对确认导出实现缺席、其他独立职责仍原位，之后才建设；保留调用方在此短暂窗口编译不可用是预期，不运行生产。不得以最终diff或覆盖写冒充中间缺席证明。
- **重建或修改什么**：依据§4合同建设同名固定函数：在本函数内用同一局部纯表达式从job/step/原输入attempt生成marker；先以当前accepted attempt准备拟发送Prompt及原submit call，再调用原createFlow.read。仅read返回null时，按原fresh/profile/attach/write/submit顺序直接调用§4保留模块；confirmed/未知沿原结果/错误，不运行准备和新输入。取得submit后，以其必填sourceAttemptId生成原输入marker，再把原TurnRequest所需字段和该marker交readSubmittedTurn，最后沿原parseJsonObject及返回合同。新submit的Prompt marker与readback marker一致；已确认来源读回不要求拟发送Prompt hash等于原submit hash，原promptHash必须来自回执。删除固定入口对runAuthorizedTurn的委托，不给公共helper加产品flag、callback或兼容参数。当前flow230行、旧目标函数11行，新固定函数预计30—45行；保持源文件≤500行、函数≤75行及现役复杂度/参数/依赖约束，不新增文件/公共抽象。
- **怎样施工**：施工授权、方案审查放行、当前候选复核和无现役热加载先成立；W0 删除在代码与定向验收后、新候选启用前完成；先复核法案/Blueprint无需改变，出现冲突先回到方案，禁止带冲突写代码。按上一项删除→即时缺席→按新合同建设，保留过程工具记录；无旧公式分支并存。旧固定标记不能在原工单上热更。
- **怎样验收**：W2全部分支，含F1旧来源和六条非固定路由原行为；固定入口只有一条执行链，只生成/消费原输入来源标记，通用markerFor和runAuthorizedTurn只服务既有动态入口；Browser/GPT/Runtime/Website未出现实际差异；结构预算满足；无新文件/状态/兼容。功能与施工纪律分别核验。
- **失败怎么办**：必要职责漏列或相关候选漂移先停受影响片区，回补本文；无授权不恢复旧骨架，不用分支/worktree/stash。未通过不能启动新生产；不自动回滚任何现实输入或已交付结果。

### W2：现有 Product 验收原位增强及交付

- **做什么**：替换原固定无修订公式断言，增强原共享夹具以区分错误实现，并完成原生质量及以后获准的真实consumer读回。
- **不做什么**：不新增checker/测试框架/独立PASS文件；不修改或弱化Browser重复marker、UUID漂移、URL/Document、stop/正文冻结用例；不借测试结果声称旧D341/9060代码根因已修复。
- **谁负责、哪里**：AGENT architecture-boundary现有验收 Owner，`scripts/acceptance/product-plugins/localization-production.acceptance.ts` 的固定文案用例；复用 `product-plugin-test-runtime.ts::exerciseProductFlow/exerciseConfirmedSubmitRecovery` 已有 resultRevision输入，不改公共夹具。
- **保留什么**：原root fresh一次、direct parent零fresh、两ZIP原样、一次submit、confirmed恢复零submit与原promptHash回执、所有七route结果合同。删除任何一项都会失去当前真实错误路径保护；不拿新标记测试代替它们。
- **删除什么**：删除固定marker等于旧job/step-only公式的断言；同段原位替换，不删除动态公式断言或其他独立测试。无文件退役。
- **重建或修改什么**：局部修改原测试，不统称测试文件重建。当前418行，合并原static loop和重复用例，新增实际逻辑前按500行承载预算去重，不删除独立保护，不复制static fixture。公共夹具attemptId/sourceAttemptId均固定attempt-1；仅在本验收文件的局部plugin执行包装中给当前context.gpt.attemptId和submit/readConfirmedSubmit结果的sourceAttemptId分别提供该用例真实身份，不改公共夹具、生产端口或其他产品。有限三组：①两个合法新输入（r0/A、r1/B），写入marker不同且各自write/checkpoint一致；②current attempt B、confirmed source A，同revision或跨revision均读A的marker，物理submit增量0，仅URL/checkpoint；③当前r6/历史r0来源A且无checkpoint的F1输入，交出的Browser读取marker仍对应A，不得为r6/B。现有Runtime风险source运输验收原样复用，不复制其整套场景。本Product用例必须区分job/step-only、总取当前attempt或revision、错误拒绝原promptHash、Prompt/checkpoint不一致四种错误实现。wrapper只在本地测试里返回原合同已有字段，无新增运行机制。
- **怎样施工**：W1后修改上述原断言；先跑相交普通验收，主Codex至少两遍检查实际建设与方案差异，再交独立只读审查代码/建设，不循环只审方案。审查放行后按冻结 `$ci-full-governance` 执行 `npm run quality:check -- CHANGE` → main精确提交首推 → clean同commit完整 `npm run quality:check -- READY` → 再次推送。RELEASE需单独明确要求。每次命令在同环境先确认Node≥24，不夹带其他任务dirty文件。
- **怎样验收**：见§6；记录实际质量退出码、commit、原生报告与本轮实际覆盖。READY耗时以现有原生分步时间为依据识别慢项，优先消除已证无价值重复工作；本单不预建缓存/并发调度器或硬编码超时。READY出现阻断时一次只处理一个已证根因族，回到方案/授权边界，完成后重新 CHANGE→推送→READY，不混修未知根因。
- **失败怎么办**：任一不变量失败不减少分母，不改冻结Skill或放宽现役门；新根因超范围先停止，不让质检失败解冻基础设施。真实运行未取得Website领域读回时只报告对应证据缺口，不宣称全链完成。

## 6. 有限分母、handoff 与验收

identity spine：原 `job_id → accepted attempt / signed revision → productStepId/callId → 同一已确认submit原sourceAttemptId对应的输入marker → same provider effect/WAL → canonical URL → current Document单一user/assistant observation → artifact → 完整result hash/terminal Outbox → receiving receipt → local completed`；领域edition/current由Website原记录继续证明。当前attempt/revision授权当前执行；submit.sourceAttemptId只说明原消息属于哪次已确认输入，不签发新的Provider授权。

| 原分支、Owner | 权威输入→输出/终态与恢复回接 | 验收及readback |
|---|---|---|
| 固定首轮/后继；Product及原父URL Owner | r0或后续已签revision；根任务原fresh，后继原direct-parent，不改变step/call。 | 现有root/parent用例保留；同job/step两个获准新输入的accepted attempt不同，marker不同；恢复原输入即使当前attempt/revision改变也取原source marker；新输入Prompt与checkpoint逐字一致；标记≤128。 |
| confirmed/未知effect；Browser/GPT及Website恢复Owner | 原WAL先读，CONFIRMED只原URL读回；DISPATCHED/未知不派新input；失败回原typed handoff，由Website独占恢复资格。 | 原confirmed恢复用例仍仅URL+checkpoint两Child、物理输入增量0、原promptHash不重写；原Browser负例不弱化。不新建恢复输入或持久化。 |
| F1跨revision迟到确认；原Runtime/GPT source Owner与Product | 原readbackOnlyCalls运输旧source；readSourceSubmit返回必填原sourceAttemptId；未settled artifact时原Browser读回；已settled sourceReusableCalls按原hash直接返回artifact。 | 原Runtime r6/历史r0…r5验收复用，加本Product旧来源marker交接用例；恢复只读source marker、submit增量0。无新source字段、第三身份或恢复接口。 |
| marker缺失/多义、邻接缺失、错URL/Document；Browser | 原typed pending/invalid；唯一身份不成立不写结果，不凭错误自授submit。 | 复用原Browser/GPT验收；故意仍产生重复marker的反例必须继续拒绝，不能为了让旧单成功而改成选最后一个。 |
| stop存在/停止非空/停止为空；GPT | 原两门：pending / DONE / 原连续20分钟空答窗口；身份变化按现役重置规则。 | 复用原冻结验收，不在Product增第三门或timer。 |
| JSON合法/失败或无效；Product、Website.localization | 原v3成功/translation_failed合同，机械无效沿原typed failure；Website原同字段拒收可签新revision，不能靠Product自己加号。 | 原候选解析及结果合同用例；真实接纳核同job/result/receipt/译文存储；新revision从同源重新生产，不救旧多义回答。 |
| 结果已在途/完成；Runtime与Website | 先交付原完整result， receiving receipt后local completed；领域拒收按原Owner，不重跑Provider。 | 原Outbox/接纳验收复用；动态核原result hash/receipt与local completed，再核localization领域对象，不能拿staging或HTTP200替代。 |
| 旧故障退出/删除未知；W0两Owner | 原preview保护闭包→显式删除→收据/精确absence；失败或未知停切换，原Owner读回。 | 四张逐单核对，不以一个成功代全部；已完成父、合格译文继续存在；不新增恢复、表或跨仓事务。 |
| 六条非固定路由；localization-production | 既有executeOwnedFlow策略和结果不变。 | 原全route循环及材料/模型/submit/结果断言；改动不得传播至通用markerFor或dynamicPrompt。 |

相邻合同逐项裁决：Website→Product仍沿既有task/route/resultRevision，required/optional/null、字段白名单和未知字段策略不变；GPT→Product复用必填sourceAttemptId，正常submit为当前accepted attempt，source readback/reuse为原source attempt；Product→GPT仍为原Child输入对象、单marker string、单submit和原canonical URL；GPT→Browser仍为readExactAssistantTurn及v4原子reply，marker当不透明字符串精确使用；artifact→Runtime→Website仍沿原完整result/receipt身份与hash。没有新增字段、默认值、编码、事务、lease/fence或幂等键；不适用新合同版本/迁移/持久化。新公式改变新Prompt/checkpoint input hash，故W0排空切换前旧公式的未完成输入/source grant，不用新公式读取旧格式。切换后的合法跨revision来源则由同一sourceAttempt公式自然还原，不能一并排除。已完成父的URL关系不消费子任务marker，原父证据继续保全。

未来真实验证仅用Website原入口明确批准的新固定任务：记录同cohort原父ref/hash、原URL；r0写入新标记；由Website原机械拒收/合法修订授权产生r1新输入后，核新accepted输入标记不同、仍按同一合法父URL关系读回正确答案；同effect恢复及F1来源只读原输入marker、submit增量0。真实输入均正确、没有合法新revision或迟到来源时，不为测试伪造拒收/改库/重发，以定向验收证明相应分支，并明确动态场景未取得。真实五语URL证据按原direct-parent链逐项核canonical URL相等，不能以marker测试通过代替五语生产完成。

## 7. 审计、停止与交接

方案阶段主Codex三轮分别核：①源头/现役法案与蓝图、权限及Owner；②输入到领域终点、全部调用方和失败分支，尤其旧marker切换；③删除反事实、UUID回归、作用域/施工纪律与证据冒充。完成三轮、修正发现后，完整激活subagent-review，才委派全新只读审查者对照本方案、用户原始要求和现役原件独立取证；审查者不得写文件、运行生产、删除或派发任务。发现必须在本文修正并复审，未放行不得标可施工。审计不是第二质量verdict。

初版主审三轮完成后交独立审查，审查者提出F1，未放行；初版仅加当前revision后缀的方案及其r0/r1推演已退休，不作为最终目标或验收证据。主Codex核原Runtime风险来源、GPT两种source分支及既有ProductGptChildResult合同后，在同一固定函数内改为消费必填原sourceAttemptId，不扩公共接口。F1修订补审按三项分别复核：①源头/法案及原输入身份、Website新授权attempt关系；②新submit、同effect恢复、跨revision late-CONFIRMED、已settled artifact四条真实消费者分支；③片区删除纪律、原准备helper保留、单固定链及有限测试预算。待原独立审查者复核受影响部分放行，不用主审自评覆盖F1。

独立复核结果：原只读审查者 `/root/fixed_copy_plan_review` 对正文版本SHA-256 `376601d4f6b234b17e72a5740f35ea7d2ed8f35c6efd9d7706f4662f11fb3a8d` 及同一20文件source组复核，确认F1解除、未发现新的阻断项，放行设计准入。核到普通包装仅current attempt的限制、合法grant可达性、显式source/reuse、单固定链、约7个await及测试分支；没有将sourceAttemptId解释成任意历史行的通用保证。本段与状态更新仅记录审查结果，不改变审查通过的实现目标，不冒充代码/质量/生产放行。

停止门：相关authority冲突、需要改冻结two-gates、目标已有用户改动、W0旧执行/source grant不能排空、原删除拒绝/未知、出现清单外必要consumer、相关候选漂移、代码范围需要扩张均关闭受影响施工门。不得借99%自评、审查意见、旧READY或另一Website方案绕过。无法证成D341/9060具体根因只阻断其代码改造，不阻断已证独立的固定marker方案。

回退：本轮没有自动代码/数据库回滚授权。新公式投入生产后不能简单退回旧公式来读新标记；先用原WAL/Outbox/Website同身份读回并停新claim，再重新裁决候选，不能回滚现实输入、删除收据或已接纳译文。施工只在本地main，禁止分支/worktree/reset/clean/stash及覆盖无关工作。

最终分别汇报：真正重建的固定函数、经论证保留的公共链、局部修改的原验收、删除退出的旧工单、是否失败回退、尚未完成的动态场景；同时分开报告施工纪律与功能质量。代码后自审及子审必须核实际建设相对方案的差异。缺删除→缺席→新建过程证据时报告无法核实重构纪律，不能靠最终diff或READY冒充；旧单清理完成也不能写成D341/9060根因已修复。

施工前主 Codex 已完成两轮独立自检：第一轮从四栏目源头与双仓现役 law/Blueprint/provider/dependency 核唯一 Owner、URL关系、原结果/权益保全及无新增 wire；第二轮从新输入、同 effect 读回、F1 跨修订迟到来源和旧标记切换反推相邻合同与失败关闭。20文件来源组未漂移，法案与施工图对本次 marker string 替换一致，无需修订，不以代码反写规范。有限施工分母无未闭合规范问题，达到进入代码阶段的98%门槛；该门槛不是系统质量 PASS。执行结果在原生报告及本轮交付中按实际证据分别汇报。

建设阶段核验：W1 已按完整固定函数删除、即时 AST 缺席及独立 helper 保全读回后重建；生产差异只在该26行函数，文件246行、7个await，六条动态路径逐statement与原HEAD一致。W2仅局部增强原验收至464行，公共夹具未改。主Codex两遍核实际diff、来源交接和回归后，Product acceptance、typecheck及原Runtime recovery-contract acceptance均退出0。只读建设审查者 /root/fixed_copy_construction_review 亲自复核实际代码、消费者和Product acceptance，W1/W2无阻断；其意外读取旧设计审查记录的独立性限制已披露，未参与施工，也不以该设计结论背书。上述是代码准入，W0清理、原生CI与真实领域结果分别取后续原件，不冒认完成。
