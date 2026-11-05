# GPT 文本回答空结束重试（原回合至多5次）－完整实现方案

## 1. 目标、授权与状态

状态：**施工中**（max5规范经主审及原独立审查者复核放行，尚未完成代码或READY）。2026-11-04用户明确授权本文对应法案、施工图、代码、质检及数据库范围，要求AGENT主仓完整CI-FULL READY；随后明确“网站侧你只迭代，不管change和ready”。因此网站仅施工本轮直接关联对象及必要普通验证，不执行网站CHANGE/READY、不提交其既有其他任务修改；AGENT按CHANGE→提交首推→完整READY→第二推收口。需求Owner为AGENT `gpt`；Browser只执行现实输入和保存原WAL，Website.ai-acceptance保有业务授权、attempt/revision、恢复及接收权。不包含RELEASE、服务切换或新增真实Provider测试的暗授权。

用户目标：精确当前回答的停止按钮存在时继续等待；停止按钮消失且正文为空时，在同一conversation、原user turn、当前授权和预算内，最多重新生成5次；一旦得到非空完成回答即结束。用户明确要求冻结条款迭代后重新冻结。定点替换第3节条款和不可分割直接引用，替换后恢复冻结；不解除其它基础设施冻结，不自行扩大预算或业务权限。

本方案只解决已空结束后的机械动作。用户追加原则：这是工厂生产内部异常，在当前授权/预算内由工厂自行消化；首空及前四次retry空不作为工单failure/release上报，不向网站申请新revision。成功直接延续原工单；处理耗尽或已不能安全继续才交原typed事实。此原则只落实本单已证故障，不扩成通用自动修复器。AGENT 不判断文章质量、语义正确性或业务可用性，不改 Prompt/附件/专业 Skill/模型策略/Product 静态回合，不新建任务，不自行签新 attempt、result revision 或风险授权。旧 CI-FULL 的 Q4/Q5/Q6 及其未提交施工不混入本文。

## 2. 事故与当前来源

现场为用户给出的 ChatGPT conversation（完整 URL 只在本聊天受控工具原件和 Browser 私有定位中使用，不复制进方案、日志或 Website）。本聊天 Chrome 原始 DOM/截图及菜单操作回执已证明：原 marker 唯一命中当前 user，真实紧邻 assistant 唯一，正文节点1个、semantic text trim长度0，当前非home Composer 的停止按钮0；思考摘要有文字，但不是正文。页面显示回答结束。可以确证“已空结束”，不能据此宣称模型内部崩溃，也未证明该现场已经连续空20分钟。尚未把该页面绑定成某个 Website job，禁止猜测工单编号。

仅打开再关闭过重试菜单，没有点击生成：

1. 在原 marker 定位的当前 turn 内，唯一 `button[aria-label="重新生成回复"]` 是菜单触发器。
2. 触发器当前 `aria-controls` 指向唯一 `role=menu`；该 menu 的 `aria-labelledby` 必须反向指回同一触发器。
3. 现场实际生成入口为该 menu 内唯一、可用的 `role=menuitem`，可见名称为“重试 • 6 Thinking”。同菜单的 Pro、搜索网页和修改要求不是本动作。

动态 radix ID、当前 UUID 和“6 Thinking”只是现场值，不写死为生产定位；只选择原turn菜单的默认“重试”操作，不切模型，不添加模型badge比较/alias表。保持原Product模型/推理目标是目标合同，必须由V8实证；菜单名称本身不是已经保持的证明。点击触发器不等于重试成功。重试后的 URL/user、生成启动和完成尚未动态验证，列入 V8。

设计来源：AGENT realpath `/Users/nexgen/Documents/AGENT`，`main`/`origin/main` 均为 `b0227bd0df7a9ccf5dfa317e57e3096a1869d463`；Website realpath `/Users/nexgen/Documents/xuanxue-web`，`main`/`origin/main` 均为 `a30c23ac4e0c02a99a28d9025642aa7149aae71f`。AGENT 已有10项旧任务修改（SEO五语方案、Runtime两份acceptance、一份inspector及六份Runtime源文件）；本文为新路径，写前该路径无改动。Website 已有其他任务对功能法案、AI施工图、provider spec及其它本地化/删除建设的修改；保留原值，不暂存、不提交、不覆盖。相关 dirty 权威也是本设计的当前输入，未来施工必须重新核其实际差异归属。

母本两仓各自§0/4/35适用，本次AGENT目标READY，网站目标CHANGE且用户排除其原生CHANGE/READY流程。前轮已经逐条读取AGENT39条active law；本轮继续按实际HEAD/工作树核对。两门、Provider effect、轮询与停空规则在GPT/Browser图及Website AI013中一致：**当前实现遵守旧规则，真正要替换的是旧规则本身，不是把正确实现冒称代码漏洞。** 人工核对不构成原生质量通过。

## 3. 四维依据与定点规范替换

| 维度 | 当前依据及本次裁决 |
| --- | --- |
| 法案 | GPT001-V69/GPT002-V34、Browser004-V59/006-V49、Capability001-V20、Architecture001-V20、Runtime001-V83/004-V49、Forensics001/002-V7/003-V6；Website AI013-V37及其依赖AI004/012。现行两门第二门含连续20分钟，已确认 effect 默认零输入，故自动重试不是现行只读操作。只替换下面四项直接关联语义；其它已输入/unknown防重与业务 Owner 不变。 |
| 施工图 | `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md`、`docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md`、`docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md`；Website `docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md`。统一改“旧停空确认→原授权原回合至多5次原位生成→原回答采集”，不是另一恢复主链。 |
| 现役实现 | `checkpoint_gpt_text_response/handler.ts#advanceStoppedEmptyWindow` 是第一直接阻断：在 stop0/body空时只累计窗口，满20分钟才抛错，没有动作。`production-child-tools.ts` 只把 submit 算 Provider turn；Browser locator/terminal reader也只认识原 submit。必须承接真正的新生成副作用，不能仅删计时或在只读 handler 内点击。 |
| 质检 | 先退休 `gpt-stopped-empty.acceptance-support.ts` 及 Website write assertions 中强制20分钟的旧断言，保留错身份、stop存在、WAL防重等保护；在原 GPT/Browser/Runtime/Website Exam 内替换，不建 checker、运行器或第二 verdict。AGENT使用唯一原生quality:check；按用户追加边界不运行网站CHANGE/READY。 |

本轮先行施工的规范目标：

- `FROZEN-GPT-TEXT-RESPONSE-TWO-GATES-001`：保留精确身份门及 stop/body结算门；取消20分钟窗口，空结束交给 GPT 当前调用的至多5次机械生成闭包，不加入标题、思考时长、UUID格式、Prompt rehash或内容质量第三门。
- `FROZEN-EXACT-TARGET-POLL-RESULT-REVISION-001`：普通 observation 仍零输入、原FIFO及至少70秒资格不变；明确定义“空结束至多5次生成”是独立 Provider mutation，随后回原 observation。只有5次生成均仍确证空结束的原事实可走既有 Website rejection，不用首个空样本直接重跑整个 Product。
- `FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001`：Website 的新合同授权在当前普通执行、当前预算内，对同一已确认根submit附属、序号1..5的stopped-empty regeneration；每个 effect仍至多一次现实输入，原 submit immutable，新动作独立 WAL。普通零输入读回、source reuse、delivery-only及逐调用风险grant不因此取得额外输入权。
- `FROZEN-GPT-CONVERSATION-LOCATOR-EFFECT-SEPARATION-001`：URL仍只定位；额外输入权来自上述当前合同和grant，不能从URL、空页面、Target丢失或重启推导。Browser“不得决定retry”保持：决定局限于 GPT 的已授权固定机械规则，Browser核资格并执行。

语义变更涉及的现役 law major 各递增一次，直接 dependsOnLawIds、Manifest、Blueprint、spec和原 registry 由各 Owner 同候选同步；只改实际承载上述语义的条款，不批量升无关法案、不改冻结母本。重新冻结时继续禁止普通修复/CI隐式放宽。执行前主 Codex 至少两遍对齐法案/图，任何冲突或缺口未闭合，不进入代码。

Website 唯一 production-control provider 改前版本49；本变更改授权及 failure proof语义，规范已提升为50，AGENT dependency只跟随其 identity/version，不复制合同、不绑定provider commit/hash。task-result24、43 routes及专业结果schema无变化，停止在其输入/输出语义不变边界。

## 4. 现役链、消费者与前轮连续性

唯一当前链：13个文本 Product调用 → `ProductionGptExecutionSession` → `ProductionGptChildTools.executeOne` → `checkpoint_gpt_text_response` → Browser原exact reader → DOM同包身份/stop/body → 完成raw artifact → Product原结果 → Runtime原stage/terminal Outbox → Website完整结果接收/对象回读 → 本地completed。Website领域采用另按其Owner原规则；工厂不能把领域质量改成自己的完成门。

影响范围的独立发现来源为：①Child合同与15项handler穷举注册、Product architecture注册；②checkpoint/STOPPED_EMPTY/Provider-effect/locator/预算符号及类型反向引用；③Browser WAL读写和Runtime source/Website failure与rejection消费者；④Chrome受控现场。前两类发现正常调用，第三类额外发现恢复、continuation和防重旁路，第四类证明按钮不能被当成单击重试。不能按原 handler 一个文件倒推分母。

全部共享文本消费者为 `hehun-ai-analysis`、`hehun-report-followup`、`qimen-professional-answer`、`qimen-report-followup`、`public-knowledge-article-pipeline`、`localization-production`、`zeji-personal-selection`、`naming-commercial`、`naming-from-existing-bazi-report`、`payment-screenshot-observation`、`bazi-ai-full-analysis`、`bazi-chart-interpretation`、`bazi-report-followup`。前九项及payment使用各自 `flow.ts`，SEO入口 `seo-gpt-calls.ts`，三项八字为各自 `product-turn.ts`。它们调用同一文本checkpoint，静态Flow和输入输出字段直接复用，不各加重试分支。图片checkpoint不消费文本空结束规则，保留图片身份与媒体读取。

有限历史筛查命中 `13c45fbc9`（两门冻结落在原轮询循环）、`6676540bd`（等待原因）、`8e0113529`（原marker读回）及《GPT文本回答两门禁冻结》《GPT当前回答停止状态误识别》《GPT回答轮次身份漂移阻断》原方案。当前空窗口是已有规则的落地，不是删除工单导致该if回归。上述历史方案不承载本次新一次生成 GAP；本文为此 GAP 唯一方案，不覆盖旧方案已完成的临时assistant ID修正。必须保留：marker/current user/真实紧邻assistant，非UUID合法assistant ID，非末位/隐藏外壳不拦截，非home stop选择，stop存在即使已有partial也不完成，完整raw artifact与source/cache零输入。只废止停空必须20分钟及无一次生成动作这部分旧设计；旧方案不再是这部分未来施工指令。

## 5. 唯一目标合同

### 5.1 身份、准入与两次物理动作

原身份脊柱为 job/request → accepted attempt/result revision → Product step/原submit call → 原WAL effect → 私有canonical URL/原marker → 当前唯一user/邻接assistant → 完成artifact/hash → 原result/接收receipt。重试沿同脊柱附属，不改原submit proof、原user消息或原结果hash。

新建两个**内部** Child（不开放给 Product Flow 排程）：

- `open_exact_gpt_retry_menu`：target-local，每调用至多一次物理输入；原位菜单已正确展开时可零输入DONE。
- `retry_exact_gpt_response_once`：provider-effect-once，真正点击菜单中的原模型“重试”，至多一次物理输入。不能把菜单打开与生成点击放进同一Child/command/receipt。

private固定闭包落在 GPT production facade，消费checkpoint的局部“精确空结束”事实，不由Runtime/Browser或专业Product决定。纯观察handler仍mutationBudget=zero；局部事实不是失败账本、任务状态或新恢复入口。首个空结束只在该闭包内消费，不先运输成 Website rejection。

一次资格：当前普通执行grant、原submit CONFIRMED、无已完成可复用结果、当前预算尚有一次真实Provider输入、非delivery-only/纯readback/source-reuse/风险调用，且原retry调用完整WAL无可能输入历史。原风险grant总输入至多一次保持，不能暗加一次；不提高 `max_provider_turns`。预算不足立即按原 `PROVIDER_TURN_BUDGET_EXHAUSTED` 事实退出，不等20分钟、不绕预算。

批准profile来源落实在原Session：同sessionKey/productStepId的成功 `select_gpt_model_from_start_v3` 输入profile/选择receipt只在原Session进程内保留；`captureSubmit` 将当时已验证值快照进已有SubmittedStep，之后其它step的选择不得覆盖它，settle时随原turn事实清理。不能从checkpoint或菜单suffix猜模型。两个内部Child只消费该原profileHash/批准模型及原marker；缺该live事实（包括重启未恢复profile）时只作原零输入读回，不读取旧准备来强行重试，不新增profile Store。Product自身Flow和profile值不改。UI动作唯一资格是原turn owned menu的默认“重试”，禁止模型选择/Pro/搜索/修改；原批准“最新”的现役别名由原模型选择Child负责，不为retry新增“6 Thinking”映射。若菜单无法唯一分辨默认retry，typed失败；V8若发现原生默认retry实际换模型或推理目标，保全已经发生的effect、停止后续危险输入并回设计，不临时选另模型补救。

所有retry归属于同一根submit。内部retry的productStepId与原step相同；callId精确为 `stopped-empty-retry:<根submit effect hash正文>:<i>`，i只允许1..5；每个Child调用的actionOrdinal固定1，重试序号是稳定输入中的retryOrdinal。输入还含根effect、前驱effect（i=1为根submit，否则为retry i-1）、原profileHash/批准模型及原marker。不得包含attempt/process/fence/Target/Document/当前assistant UUID/动态menu ID或URL。每序号独立effect且至多一次可能输入；完整根WAL历史必须连续，无缺号、分叉或第6号，才能许可下一个序号。打开菜单按同序号单独target-local身份。代码/Prompt、attempt、进程、Target变化不能刷新整个根的5次额度。序号来自原WAL事实，不新增计数Store或执行进度。

现役 `browser-command-actor.ts#mutationIdentity` 的payloadHash取整个command；故新retry不能直接沿用含临时定位字段的全command hash。仅对此新Child，payloadHash取由 `browser-gpt-retry-contract.ts` 唯一声明的稳定动作投影（操作、原effect、原marker、原批准模型），与request稳定身份一起入原effect公式；完整command仍由原frame MAC/permit/receipt绑定，绝不弱化完整传输验真。点击precondition中的私有canonical URL由原WAL精确reader供给，在当前Document逐次比对，既不跨仓/入普通proof也不参与effect hash。DOM节点/动态menu ID仅在扩展本次同步资格内解析，不作为command输入。其它Child的payload hash算法完全不变，旧WAL不重算、不增第二hash台账。V4/V5须分别验证：定位变化不能刷新次数，篡改完整定位command仍被MAC/原WAL比对拒绝。

每次native点击前在同一current Document重核：原WAL locator的URL、原marker唯一user、真实邻接唯一assistant、stop0且正文空；按该turn内触发器及相互关联menu确定唯一可用的默认retry候选。选择器只是被点击对象的资格，不是回答完成第三门。首样本之后出现stop或非空时，丢弃旧空事实并回原采集，不点击；菜单、URL、Document或身份矛盾时零危险输入typed失败，不猜nth/last、搜索、刷新、首页或别的模型。

Browser `click` 原意图内增加窄的 exact-stopped-empty precondition/候选作用域，在native前重新解析原marker及owned menu；不把样本中动态DOM id塞入稳定effect输入，不新建通用selector引擎或wire命令。原permit、WAL PREPARED→DISPATCHED-before-input、当前guard、1.5秒动作间距、2.5秒动作后fresh read、40秒Provider静默及70秒观察资格全部保留，无新timer/全局锁。

### 5.2 动作结果、结算和持久防重

一次是“至多一次可能的Provider输入”，不是内存布尔值：Browser原WAL为唯一持久依据。DISPATCHED/CONFIRMED或结果unknown均耗用本次额度，恢复时只读回，不再点击；仅原WAL可信零输入的PREPARED失败/REJECTED-no可沿原同身份规则处理，不能借新hash绕开。撤权/取消发生于两点击之间时停止第二点击，菜单状态不授权。

retry terminal不能仅证明菜单关闭；须与原user/URL绑定，并从同一动作后置包证明生成确实启动（stop出现）或当前原user下新的assistant generation出现。完成很快可直接非空结算。旧空DOM仍原样而无新generation证据时按动作未知/未证启动处理，不能立刻伪造“重试后也为空”。不要求所有平台生成都必须换UUID，也不把临时ID重新改成UUID门；只将已观察的新generation差异作为一种可证启动路径。未能确认启动走现役typed unknown及有界readback，不能以unknown推进下一个序号。

随后回原checkpoint：stop存在继续等待；stop消失且非空立即DONE；stop消失且空，只有已证本序号生成启动/结束、授权和预算仍成立且序号<5，才进入下一序号。i=5也确证空结束才报 `GPT_RESPONSE_STOPPED_EMPTY`。预算/撤权/限流/身份失败或unknown按各自原typed出口，不能冒充5次耗尽。删除20分钟窗口，不保留旧timer fallback，不把同一旧空DOM当成多个generation的结算。

WAL仍为原表/原加密envelope，不加列、retry计数表或日志权威。retry terminal使用专用typed payload，绑定原submit effect、retry effect/exact call、原批准prompt hash（仅原事实引用）、原user及当次generation后置证明；locator仍只在原加密envelope内。原 `confirmed-submit-proof.v2` 不变，不伪造retry为一次新submit。Browser同一reader按**明确Child身份**解析各自payload，不启用旧/新版本双reader或alias。

`stopped_empty_proof` 在provider50替换为唯一合同：`schema_version="gpt-stopped-empty-after-five-retries.v1"`、`original_effect_identity_hash`、`original_wal_authority_ref`、`original_wal_authority_hash`、`retries`、`terminal_observation_revision_hash`、`terminal_observed_at`，七顶层。retries恰好5项、依ordinal=1..5严格排序且effect互异；每项精确含 `ordinal/effect_identity_hash/wal_authority_ref/wal_authority_hash/pre_empty_observation_revision_hash`。每项原terminal还须证明根/前驱/原user和本次启动；retry i+1的pre-empty事实结算retry i，最后一项由顶层terminal空观察结算。所有hash为sha256、ref为真实browser-mutation、时间为规范ISO，缺/额外字段拒绝，无默认。failure顶层child/effect/evidence必须等于retry5真实CONFIRMED/confirmed事实，不能伪用原submit。完整链事实由现役5条retry WAL的不可变terminal保存，第5次的最后空观察沿原first fact保存；**无需新增WAL列、envelope位置、失败Store或恢复计数**。零输入拒绝、DISPATCHED未决、缺启动/结束或只发生1..4次均不得出五次耗尽proof。Website原rejection的fact hash仍取顶层terminal_observation_revision_hash，一份receipt绑定整链。

无重试授权的readback/source/risk分支，或retry结果无法证启动时，不能将局部空事实直接送为新停空rejection，也不能永久吞成pending。复用原 `ExactReadbackNegativeObservation`/原有界readback路径，仅扩一项真实机械cause `response-stopped-empty`；原相同位点至少两次、不同observedAt、原probe/当前授权预算及零输入证明保持，满足后仍报原 `GPT_EXACT_READBACK_UNAVAILABLE`，由Website原风险授权判断接续。一次空样本不伪造耗尽；stop重新出现/正文出现/身份漂移清旧negative。此项不是新的retry入口、计时窗口或Store。

### 5.3 完整结果与历史恢复接回

原Forensics文本artifact仅写一次当前实际完成的raw DOM/semantic text，schema与结果字段不变；多次retry的最终选中回答只保存一份artifact，各effect仅引用原同user的真实最终读回，不伪造各generation都曾有正文。Production session保留原submit事实，附属retry事实从原WAL重建；不把旧empty当settled artifact、不替换原immutable receipt。

完成checkpoint对原submit与已发生retry逐effect登记既有 `recordSettledCheckpoint`：同一个真实完成artifact可被同一原user及根submit的全部真实effect事实引用，但必须保留各自effect、call/Child、authority及parent关系。不能把输入数投影成1，不能隐去retry effect，也不能把旧empty原件说成最终正文。Browser history继续完整枚举根submit及实际1..5条retry调用；source hash和unknown分母都含retry。

GPT `ProductionGptSourceReuse` / `ProductionGptExecutionSession` 在原逻辑step核精确附属关系后，消费根submit和其至多5个有序内部retry的既有settled/source事实，再归还同一个checkpoint。内部retry不是需要Product新增Flow步骤的遗留pending call；同step不相干/超5条/错序或错parent的retry不能被顺便consume。原纯readback/source复用仍零输入。Runtime仅运输整链原始调用事实，不能合并为假submit或自己规划retry。恢复集合不完整时沿原Owner报告unknown、原source对账，不签额外输入。

source/continuation必须一起承接retry Child：`browser-submitted-conversation-locator`、`browser-mutation-replay-evidence`、Browser原exact source reader、`browser-lane-coordinator#parentSourceIsExact`及Runtime `executor-source-checkpoint.ts#checkpointEffect` 只能接受已机械验证的submit/retry两种来源。所有实际采纳来源URL仍须非空全等；不把retry caller当新业务父任务，不取latest/第一条。图片source和parent材料规则不变。Website原source proof shape已有非空Child字符串，不新增来源表或恢复状态，只核新Child的精确绑定与完整effect集合。

### 5.4 五次耗尽拒收必须结算完整六effect

原单effect封口不能直接复用到根submit加五次retry。R精确为新proof及Browser原exact reader共同验真的六effect：同job/revision/step、根Child=submit、retry1..5 Child=retry、稳定callId及根/前驱链连续；全部CONFIRMED/confirmed、各physicalInputCount=1、各authority独立验真。primary为retry5；不能用同step或自报数组拼出R，额外/缺失/分叉/unknown一律不结算。

原 `SourceAttemptHandoff.rejected_call` 为primary retry5，仅新五次耗尽情形附加 `original_submit` 单对象和 `prior_retries` 恰好4项（ordinal1..4严格排序），各对象是现役五项call/effect身份，prior每项另带ordinal。不得扩成任意effect列表。普通RESULT_SETTLED_UNUSABLE仍单effect且这两字段均禁止；零输入/风险source也禁止。provider50唯一声明该形状，缺/额外/错序/多根拒绝；原历史单effect已签source继续按原不变字节读取。

原 `runtime-source-handoff#prepareOneSourceHandoff` 及 `handoffProofEligible` 只从待readback分母排除精确R，其他effect仍逐项原proof；Website `v6-source-readback-proof#assertSourceReadbackFactsV6` 按同一R核分母，不能全局放宽replay_exhausted/unknown。`store-source-settlement#rejectionSettlement` 在同一已接受source seal下产生六条既有rejection_settled，各用真实call/Child/authority，来自原first fact整链及各WAL原件；不补空artifact、不把六次输入合成一次。

Website `job-claim-authority#verifyOriginalRejectionReceipt/verifyHistoricalRejectedSettlements` 对R任一成员都重建**同一份以primary retry为provider_effect_identity_hash、包含整份新proof的原rejection body/receipt hash**；绝不拿parent字段另签第二receipt。`job-claim-source-lineage#assertSourceLineagePreserved` 的遗漏effect核验、原signed source/claim/grant祖先回读一起核R，未被该原receipt结算的历史照旧不得遗漏。Website依原rejection签下一授权，AGENT不决定新revision。

旧已accepted source/first_fact_raw是不可变历史，不迁移成新proof。`store-source-settlement#settledRejectionFirstFact` 须先核该原accepted source row、seal与原first raw绑定，再回读原未改字节和原字段事实；不再无条件把已签历史raw送入新current transport schema。其历史读取只消费原effect/evidence与原source/rejection绑定，不重新解释旧20分钟计数、不补默认、不改hash/重签seal，也不能接收新current写入。`store-foundation` 的current first-fact写入/重授/hydration仍只接受新当前合同；Website历史receipt验真只重建原事件body原字节hash。V7必须同时证明旧accepted来源继续回读、旧proof对新current入口仍被拒绝；这是一条原历史证据回读，不另建v49活跃producer/fallback或双版本请求reader。

### 5.5 同attempt读回与风险来源的内部call

`runtime-claim-recovery#changedRiskSourceReadbacks` 当前只投影submit，必须在原Owner内机械承接真实retry身份。`ProductionExecutionLease.readback_only_calls`、`runtime-claim-operations#acceptClaim`、`GptProductionExecutionInput.readbackOnlyCalls` 同步显式允许submit/retry两种已证来源；普通Product公开Child不增加retry。GPT原Session以Browser typed parent关系将这两份来源接回原submit/checkpoint入口，原pendingReadbacks仅在实际原回答已读回/完成后逐effect闭合，不能因Product不排程内部call而忽略它。纯readback的Provider输入仍为0。

原source根submit及实际retry链均耗尽时，Website原完整逐call风险grant/来源集合保留，不裁掉retry项。现役 `risk_authorized` 只证明Website对**旧effect**已签source授权，不证明新输入执行；一次许可可以不用。GPT原 `assertExecutionCall/readConfirmedSubmit/historicalCallsPending` 必须识别Browser已证的连续根/前驱链；**只有原Product submit在本次精确授权下取得真实完成checkpoint（含合法source返回）后**，才可将其附属retry risk key按“本轮未使用输入许可、旧source已消化”退出进程内pending。不给该旧retry出新receipt、不登记新checkpoint、不虚报已执行，内部retry风险输入始终0。原外层失败/未完成、错parent、超5/错序retry或不相关call不能关闭；旧retry只沿原signed event成为既有risk_authorized历史。此规则写入provider50语义，不新增closed-group字段、业务恢复器或持久进度。

## 6. 删除审判与有限分支

先裁质检：旧“20分钟前必须继续空等/满窗才可失败”的测试及字节冻结必然拒绝新目标，随规范替换退休；stop/identity/WAL/unknown/预算/source覆盖有具体错误实现反例，保留并在原用例增强。不要删掉防重测试来方便点击。新动作没有现役等价能力：submit点击发送会新增user消息，限流ack不生成，附件/模型菜单语义及后置不同，不能改名复用成熟Child。两个新Child是两次不同现实输入的最低分割；第三个重试协调器/持久计数/新队列无必要，禁止新增。

| 当前状态/唯一Owner | 动作、输出、终态与回接（全部纳入V1—V8） |
| --- | --- |
| GPT 精确身份不成立 | 原typed失败，零retry；Browser原guard/readback核原位置，不凭正文0放行。 |
| GPT stop存在，正文空或partial | 原pending释放lane/按原资格观察，不retry，不因普通probe budget提前判空结束。 |
| GPT stop缺席、正文非空 | 原DONE/artifact/result，不开菜单，不retry；已有效cache/source直接返回，零Browser acquire。 |
| GPT 第一次空结束、当前授权满足 | 两个原子Child一次生成，再接原观察；不运输首样本为整Product拒收。 |
| GPT 首样本后恢复生成/正文、菜单漂移 | 丢旧资格，前两种回原观察/完成；真矛盾typed失败且零危险输入。 |
| Browser retry已DISPATCHED/CONFIRMED或unknown、重启/同attempt重授 | 同身份原WAL读回，新增Provider输入0；不以新进程、Target、hash再给一次。 |
| Browser 两点击之间取消/撤权/额度耗尽/限流 | 不继续Provider输入；保留原事实，取消/续权/冷却仍由各原Owner及Website决定；菜单开启不是恢复权。 |
| GPT retry确证生成后仍空结束 | 仅第5次完成后的一份新停空proof→原failure release→Website原rejection及下一授权。AGENT不自行再次生成或开新revision。 |
| 动作结果无法证启动/终态丢失 | 原typed unknown、有限读回及Website原恢复判断；不伪no、空结束、20分钟或重试成功。 |
| GPT 完成、运输失败、清理失败 | 原artifact/完整output优先，Runtime原Outbox继续同结果交付，Browser清理不撤回结果；不重跑Provider。 |

保留原FIFO/WAL/lease/fence/静默/观察节拍，因为它们分别防并发物理输入、重复输入、撤权动作和未开始即误结算；空计时不能替代这些权威。保留Forensics/Outbox/Website receipt各自正交事实，删去会丢原答案或假完成，不能收敛成新全局重试账。

## 7. 原子工单与施工纪律

共同纪律：每项重建只删除明确退休片区；**物理删除→下一次独立工具调用即时核缺席→按本节新合同建设**。独立职责按事前保留裁决原位保留。不得读旧块改字符串后删写，不保存旧骨架于内存/临时文件/Git恢复，不移名/包装/双路。过程只用当前工具原件，不增台账。漏列职责/相关用户改动/新消费者即停对应施工，回本文补齐后续行。所有施工由主Codex执行；子智能体只审查。

### W0：规范对齐（两仓各自Owner，先于代码）

按第3节修订定点条款、三份AGENT图与Website AI图、provider49→50/dependency、原版本引用/注册。删除旧20分钟规范片区并即时核缺席，再按新合同重建并重新冻结；其它冻结条款/母本直接保留。法案有现役用户修改时先核精确叠加授权，不能覆盖或一起提交别的任务。输出唯一相符active corpus，不建spec副本/审批账。主Codex不少于两遍自检和必要独立只读审查无未决，才准W1。

### W1：GPT 当前空结束与至多5次机械闭包（Owner gpt）

`src/capabilities/gpt/children/checkpoint_gpt_text_response/handler.ts` 仅物理退休 `GPT_STOPPED_EMPTY_CONFIRMATION_MS`、`StoppedEmptyWindow`、advance/window/reset及对应20分钟proof构造，重建精确空结束局部事实。局部失败码定为 `GPT_TEXT_RESPONSE_EMPTY_ENDED`，携原observation revision/ref及observedAt，由facade在原结果持久/运输前消费；它不属于Website rejection码，不能外泄成伪STOPPED_EMPTY。身份reader、stop优先、完整非空成功直接复用，不能把handler改成mutation。`contract.ts`、`child-types.ts`、`handler-registry.ts`局部登记两个内部Child，`ProductGptChildCapabilityId`公开union排除它们；新建上述两项各自 `children/<child>/handler.ts`，复用原Child success/failed和Browser端口，不复制通用Child框架。

删除窗口常量时同步退休handler中 `observationDeadline=now+该常量` 的借用。精确回答已观察且仍生成时，原wait接口用 `number|null`：null只表示不受初始probe预算截断，继续受现役execution单调截止/abort约束；未定位时仍用原probe deadline。`production-browser-lifecycle.ts#waitForProviderObservation` 对null直接复用现有 `acquireBrowserLease(..., probeDeadlineAt=null)` 和实时remainingMs，不造20分钟替代常量，不忙等短deadline，不改变Browser的70秒资格/唯一wake timer；图片的原number调用不变。退役仅为旧空确认存在的wait reason `stopped-empty-confirming` 及其原日志映射；生成中的stop-present原样保留。V1必须保留“probe预算已过而stop仍在”的回归。

在 `production-child-tools.ts#executeOne/settleChildOutcome` 内部采集结算边界承接该局部事实；必要实现落点为一个私有 `production-stopped-empty-retry.ts`，只编排两个精确Child并返回原checkpoint采集，不带存储、timer、通用重试/策略注册。完成 artifact/cache首先检查；不是每个Product改Flow。`production-call-preparation.ts#runProductionAtomicPhase` 将原provider输入gate同时用于真实retry Child，且两内部调用只在普通执行授权分支进入；不得把readback-only flag改true来绕门。修改 `production-atomic-readback.ts`、`production-execution-session.ts`、`production-execution-source-reuse.ts`、`production-child-result.ts`、`production-browser-lifecycle.ts` 的明确submit-only结算/读回分支，以真实retry身份闭合第5.3节，不重写整个Session。首空事实不先persist为跨仓STOPPED_EMPTY；只有retry序号5也确证启动并结束为空才沿原终端失败装饰与新proof出口，序号1..4确证空且当前授权/预算有效则顺序推进。`production-child-support.ts`及session原failure decorator必须保留真实retry effect，不把它重新盖成原submit；没有retry时继续保留原submit。错误/取消保留原effect；V1/V3/V5/V6。

### W2：Browser 精确动作、WAL与来源（Owner local-browser-session）

`src/lib/browser/exact-target/browser-dom-intent.ts`、扩展 `chrome-extension/{dom-intent-runtime.ts,dom-pointer-intent-runtime.ts,dom-coherent-candidate.ts,dom-mutation-postcondition.ts}` 的原click候选/直接后置落点局部承接第5.1节窄precondition与owned-menu候选，不加wire第二命令。新增 `exact-target/browser-gpt-retry-contract.ts` 只放本动作的窄precondition与terminal类型/严格校验（真实消费者为Node intent、两个Child、Extension和WAL reader）；新增 `chrome-extension/dom-gpt-retry-action.ts` 只做该动作的coherent pointer资格和直接后置。仍由原pointer执行链发native输入及现役guard，禁止page脚本直接click。`dom-exact-assistant-turn.ts` 只导出现有固定采样函数字面量供新动作组合使用，原reader、marker物化和内容算法不搬走、不重抄；同Document同步采样后用其刚证明的current user定位动作节点，不能将该临时node/UUID带入effect identity。原 `browser-protocol.schema.json` 仅拥有frame/通道/时间配置而不拥有DOM intent字段，本次不为此变更无关协议revision；类型化intent与Node/Extension构建必须同步，旧Extension必须被原artifact/source admission拒绝，不能忽略新precondition执行旧click。

`browser-command-actor.ts#mutationIdentity` 只对新retry Child消费第5.1节稳定payload投影；原command完整认证及其它effect算法保留。`browser-command-postcondition.ts`、`browser-mutation-receipt.ts`、`chrome-extension/extension-command-runtime.ts` 中submit-only terminal构造/校验局部加入精确retry payload变体；新变体不是旧submit alias。`browser-submit-recovery-payload.ts` 保留原submit构造/校验；retry校验按原WAL行的确切Child分派，不仅按可伪造的payload tag猜类型。`browser-mutation-evidence.ts#countProviderTurnDispatches` 将retry真实dispatch计入原预算，语义不扩大到target-local菜单；该原evidence类新增窄的“原submit+连续retry1..5”只读资格方法，供原Store同连接/事务内消费。`browser-mutation-store.ts` 只在原provider资格点调用它、在 `readSourceConfirmedProviderEffect` 维持确切Child读取，其原事务/去重/immutable/CAS直接复用，禁止新计数Store。

`browser-submitted-conversation-locator.ts`、`browser-mutation-replay-evidence.ts`、原exact source reader和 `infrastructure/browser-lane-coordinator.ts#parentSourceIsExact` 按第5.2—5.3节局部承接精确Child来源。原URL密文、原submit proof及旧WAL字节直接保留，不迁移/重写历史，不恢复旧Target。V2/V4/V5/V6；失败保留unknown，不能清账补发。

### W3：原授权链交接分组（以下为分别验收的原子工单）

| 工单/唯一Owner | 一项决定或转换及输出；依赖、保留、修改与验收 |
| --- | --- |
| W3-a Website.ai-acceptance | provider50授权/失败接收按下段新合同产生原唯一rejection；依赖W0及W1/W2事实，不取得Browser操作权；原事务/receipt保留，V3/V7。 |
| W3-b AGENT agent-production-runtime | 新first fact从序列化到原Store CAS/readback一项持久转换；依赖W3-a规范，按下段替换旧current validator，原Store事务保留，V7落库/重启/rebind。 |
| W3-c AGENT agent-production-runtime | 原source Owner在已核rejection下封住完整R及其它历史，输出唯一source seal；依赖W3-b/W2真实事实，按§5.4退休单effect分母，不改Outbox或业务决定；V7五次耗尽无artifact封口。 |
| W3-d Website.ai-acceptance | 按原行锁核W3-c原source/receipt/R后签精确下一授权；原signed事件/容量/attempt/revision Owner保持，按§5.4改原历史/分母验证，V7祖先回读。 |
| W3-e AGENT agent-production-runtime | 将已接受source转换为原整链六条rejection_settled或原risk_authorized历史；依赖W3-d真实grant，按原Store接受事务/历史reader收束，不创造输入事实；V6/V7历史和当前隔离。 |
| W3-f AGENT agent-production-runtime | 同attempt精确readback-only事实投影到GPT；依赖原grant及W2 typed身份，仅扩下列真实Child union/投影，不签输入；GPT内部消费按W1/§5.5，V6零输入与后续step可达。 |

所有W3子单均不得造新队列/状态/Store/回执。删除片区、禁止事项、保留理由、失败停止及施工过程证据分别沿下述精确对象及共同纪律执行；非重建的类型/投影明确局部修改，不称全文件重建。

Website `packages/ai-contracts/src/production-control/{v6-contract.ts,v6-write-assertions.ts,v6-grant-assertion.ts,xuanxue-ai-production-v6.manifest.json}` 的旧20分钟proof类型/校验和policy片区先删除核缺席，按provider50重建；根回合limit5与每ordinal输入limit1是合同常量及当前grant语义，不加per-job flag、浏览器指令或运行配置。预算仍当前 `max_provider_turns`；旧版本失配不得签新grant。原签发/lease/fence/严格unknown-field、source集合及receipt机制直接复用。

`services/api/src/ai-production/job-lifecycle-core.ts` 的停空分类、`job-lifecycle-repository.ts#rejectCurrentProviderResult`、`job-claim-authority.ts` 的精确rejection消费按新proof及retry Child关联；继续使用原job行锁、事件和一份rejection，不另建失败队列或本地业务判定。AGENT `execution-fault.ts`、`execution-failure.ts`、Runtime `transport-protocol.ts`/`terminal-failure.ts`/`runtime-attempt-failure-readback.ts` 承接provider类型和原样运输。**同步重建** `store-foundation.ts#serializedStoppedEmptyProofValid/stoppedEmptyTransportValid` 的旧六字段/20分钟/submit-only片区，使新七顶层及5项retry字段+retry first fact能由原 `store-task-state.ts` 写入、原值readTask/hydration/rebind；store-task-state原持久事务/重授流程直接复用，不另写parser。第5.2节单一negative cause同步落在原 `source-readback-contract.ts`、`store-source-settlement.ts#validNegativeObservation` 与Website `v6-source-readback-proof.ts` 的类型/严格枚举，原Store及hash规则直接消费。

原封口片区按§5.4重建：AGENT `runtime-source-handoff.ts#prepareOneSourceHandoff/handoffProofEligible/sealSourceHandoff` 的单一rejected effect分母处理、`source-readback-contract.ts` 的 `rejected_call.original_submit/prior_retries`类型、`store-source-settlement.ts` 的该对象严格shape、历史first读取和六effect `rejectionSettlement`；Website `v6-source-readback-proof.ts` 的同一对象/分母验证、`job-claim-source-lineage.ts#assertSourceLineagePreserved`、`job-claim-authority.ts#verifyOriginalRejectionReceipt/verifyHistoricalRejectedSettlements` 的同receipt整链成员验真。逐项先物理退休原“单个被拒effect就是全部拒收集合”的片区并即时核缺席，再按R闭集建设；其它effect证明、原source seal事务、全部Outbox路径直接保留。不靠放大分母差值阈值放宽，不能跳过任何未被R结算的事实。

§5.5对应 `runtime-claim-recovery.ts#changedRiskSourceReadbacks`、`contracts.ts#ProductionExecutionLease`、`runtime-claim-operations.ts#acceptClaim`、GPT `production-ports.ts#GptProductionExecutionInput` 的submit-only类型/投影局部承接真实retry；`executor-source-checkpoint.ts#checkpointEffect`承接实际采纳来源。原Session补精确关系消费和未用风险许可的关闭，不开放Product内部Child。其余claim选择/容量/租约/业务决定不改，当前Q4已有修改仅作为受保护overlay；未获允许在该overlay上施工时不改这些文件。V3/V6/V7；不完整proof按原strict拒绝，不能fallback旧六字段。

### W4：原生质检替换与交付（各仓原质量Owner）

GPT原 `acceptance/gpt-stopped-empty.acceptance-support.ts` 删除旧20分钟场景及只为窗口存在的辅助；按V1/V3在原运行器中重建短时、受控时钟的当前分支。`scripts/audit/domains/gpt/gpt-frozen-attempt-inspection.ts` 按W0新法案替换旧字节/分支义务，不加第三检查器。Browser复用原 `scripts/acceptance/local-browser-{dom-mutation-support,provider-effect-recovery.acceptance,terminal-contract.acceptance}.ts` 的DOM/Actor/WAL环境；GPT复用 `gpt-proof.acceptance.ts`、`gpt-production-browser-lifecycle.acceptance.ts` 及其现有artifact/source支持；Runtime复用原 `agent-production-runtime-{store-schema,failure-transport,failure-readback,browser-failure-store}.acceptance-support.ts`；Website复用 `tests/exam/ai-production-v6-contract.test.ts` 和原 `tests/commercial/ai-work-order-replacement-postgres.test.ts` 中source/rejection真实数据库环境，加入V2/V4—V7所列不同保护，绝不运行真实管理员删单。质检先证明会拒绝明确错误实现，不能以字符串/字段存在冒充动作闭环。W4纯新增测试必须证明原用例不能表达；不做13×所有分支笛卡尔积。

当前主要生产文件：checkpoint197行、child-tools362、session401、mutation-evidence362、command-postcondition143、extension-command-runtime145；registry15个handler，新增后17项，在普通import预算内。额外核出 `browser-dom-intent.ts` 497行、`dom-coherent-candidate.ts` 487行、`dom-pointer-intent-runtime.ts` 474行、`browser-mutation-store.ts` 493行，不能往这些文件塞完整重试实现。因此前述新窄合同和页内动作各承一项必要责任；dom-intent只加类型引用/一个可选precondition/一个校验调用，candidate及pointer只加原click分派，Store只加原evidence资格调用，目标分别≤500/495/485/500，不搬迁成熟通用职责来造空位。新增核验的source handoff325行、settlement316、claim-recovery171、claim-operations343、store-foundation432及Website source-proof318均有原责任承载空间；Website claim-authority490行，R集合投影/成员核验复用其已经依赖的 `job-claim-source-lineage.ts` 内同一source责任，authority只替换原单effect比较和同receipt重建，保持≤500，不另建grant服务。选择GPT私有闭包是让child-tools继续承担结算，不堆两点击/恢复流程进去；session只扩同step逐effect结算/profile事实和内部source消费，不另建会话类。所有新增/修改函数≤75行、参数≤7、返回≤8、深度≤5、复杂度≤16、await≤10，文件≤500、原import预算不放宽。提交前实际AST逐项核；未能在已定责任内承载即停止回设计，不等READY补刀、不拆纯转发层。V1—V7通过后仅AGENT按本轮已授权CI-FULL执行原生CHANGE→提交首推→完整READY→再次推送，单次一个根因族；网站不运行CHANGE/READY、不提交其其他任务修改。

## 8. 验收、切换与完成边界

| 编号 | 可区分正确/错误实现的必要证据 |
| --- | --- |
| V1 两门与第一次空 | 原handler真实运行：stop1/body0、stop1/partial都不retry；stop0/非空直接DONE；精确stop0/空交给至多5次的当前调用闭包，20分钟状态/常量/旧断言无残留。保留非UUID、非末位、hidden及错身份反例，不加真20分钟等待。 |
| V2 两个现实动作 | 原生产页内脚本在隔离DOM运行，原marker/邻接/owned menu中恰好两次各一click：开菜单+原模型retry；wrong turn、多个候选、错owner/模型、sample后stop/正文变化、loader撤销均不误点。只mock Child返回success不能代替脚本。 |
| V3 retry结算 | 原facade+Browser后置+handler组合：已证启动后回原poll完成；快速非空完成；序号1..4确证新generation停止仍空才允许下个序号，序号5确证空才形成唯一耗尽proof；任一序号非空立停，第6次禁止。旧空DOM未变化/未证启动不推进、不再生成；普通pending不增加重试判断门或采样timer。 |
| V4 防重复与预算 | 原SQLite WAL/Actor完整执行：并发两调用、dispatch前后崩溃、terminal/ACK丢失、同attempt重授及重启，每ordinal可能Provider输入合计≤1、整个根retry合计≤5；旧submit计数/receipt不变，新retry计入预算；unknown不重放，可信零输入按原规则；纯readback/source/risk/delivery-only/cancel/cooldown均无额外输入。 |
| V5 身份与资料 | retry后canonical URL相同、原marker/user消息不新增，原模型不替换、Prompt write/文件上传增量0；一次重试的新assistant允许临时ID。原Target仅动作坐标，hash篡改/错Document拒绝；action间距、静默、FIFO/70秒原Exam保留。 |
| V6 来源/恢复 | 成功后原artifact一次持久读回；原submit及实际retry链全部effect均进入history与settled checkpoint，原内部retry无遗留pending；跨attempt精确source只返同artifact零输入，continuation全部实际来源URL一致。补原“根submit及实际retry链耗尽→Website完整逐call risk grant→外层原submit一次输入+真实checkpoint→后续step可达/结果交付”，内部retry dispatch=0且不造新retry checkpoint；外层失败/未完成、错parent、超5/重复/错序retry不能关闭其risk key。同attempt真正retry readback-only事实可经原类型/投影到GPT并零输入读回。错parent/超5或重复错序retry/漏effect/坏artifact/unknown均不能复用或刷新额度。保留图片原回归。 |
| V7 Website接收 | provider50真实parser/原job事务核新七顶层及5项retry字段proof和原release/rejection/claim，缺/额外/错hash/旧20分钟proof/首空样本被拒；同idempotency返回同receipt；新first fact原Store写入→原值readTask→重启hydration→同attempt rebind均合法，旧proof不能作为新current写入。无artifact的“五次耗尽”必须完成原submit+retry同receipt整链结算、原source seal/Website签新revision、原整链六条rejection_settled及下一轮祖先history回读；额外parent/retry/未决事实不得被R吞掉。旧accepted source/原first raw/原receipt字节继续可回读且不升级重写。AGENT原failure回读与Website原对象一致。13个Product原architecture发现分母验收不变，result24字节/领域schema不变，原完整接收和local completed链继续。 |
| V8 实际受控回读 | 施工与必要READY后，另具运行/Provider授权才用同一已绑定工单、加载构建和WAL在真实空结束现场执行；仅确证仍空才推进下一序号、最多5次，每序号回读开菜单及重试两条动作receipt、原URL/user、retry启动/最终正文artifact、原result/Website接收对象、local completed，并单独核领域Owner接纳。不人为制造五次空结束；现场已消失则报告专项动态证据未取得，不假称旧现场已成功。 |

施工纪律独立核：实际delete原件→独立即时缺席结果→新建，保留模块从未删除再恢复，旧20分钟生产/校验路径零残留，无桥/副本/第二reader。仅final diff或质量通过不能证明过程；缺原件报“无法核实重构纪律”，已证违规报“未满足重构要求”。1+1为去除20分钟无动作等待、同原回合可在原预算内至多5次机械生成且全部原身份/预算/防重/source/交付保护仍成立，不以净行数或通过率代替。

无兼容切换：先暂停新签发与新claim，保留健康交付能力；原输入可能发生、待结果/Outbox/first fact/回执的旧attempt由原版本及原身份收束，真实join旧writer，原effect/unknown/完整结果不清账、不改hash、不重enrollment。仍有不能合法收束的旧消费者时停止替换，不为安装临时保留双reader。完成各仓原生检查后，Website provider50与AGENT dependency/实际构建及Extension artifact全部匹配才能重开；匹配失败零新grant/输入，旧版本不能消费新proof。切换失败保持停止新签发/新输入及原数据，不能单端自动回滚；完整新副作用已发生时不回退旧reader。只有另获明确授权且证明无新版本事实、全部writer已join才可双仓回到指定原基线，不冒充重建。

最终汇报分别列：真正重建的空结束结算/两个动作、经论证保留的独立模块、局部修改的source/授权/运输接口、删除退役的计时与测试、实际回退（无则写无）、尚未完成的动态证据。无论子审或局部测试结果，都不宣称未知基础设施100%可靠。执行者须重新绑定当前授权、两仓HEAD/相关overlay、现役AGENTS/Skill/法案/图/合同与本文实际hash；相关漂移重开受影响设计，无关修改保留。

## 9. 前轮单次方案审计与本轮准入

主Codex三轮方案自审已经完成：第一轮核规范/蓝图/角色/授权，将20分钟识别为须定点修法的现役义务；第二轮核WAL/两动作/source/continuation/Website handoff，补齐真实retry effect不得被原submit decorator覆盖、首空与重试后空不混证；第三轮执行删除反事实/结构/过程/切换反查，删除重复identity/count proof字段，补齐旧20分钟常量的观察预算借用、近500行文件的明确承载及无授权空读回的原negative出口。这些是方案自审，不是代码已验证或原生质量结论。

已按subagent-review由干净只读审查者 `/root/empty_retry_plan_review` 独立审本方案与真实接口；审查者避开本节主审自评，不写代码/报告、不启服务/Provider、不投新任务。原件和完整意见保留在本聊天。其F1“两effect拒收封口”、F2“Store仍按旧proof验证”、F3“真实retry读回及未用风险许可的可达性”及profile来源接缝，经本文§5.1/5.4/5.5、W3-a至f、V6/V7修订后由原审查者复核关闭，无剩余可操作finding，设计放行。审查输入正文SHA-256为 `021780c43f19d5f937fc0b26cabbeaf19ed9539d429b80d38629f29567c11aed`；此前单次方案放行后仅更新其状态记录；本轮5次设计已重新打开，旧放行不覆盖增量。

引用的 `switch-repo-authority` Skill入口未找到，两仓已各自从真实根AGENTS及自身母本绑定权威；未声称该缺失Skill已激活。闭环Skill本轮已完整双遍取得，原生质量和未来V8均未执行；方案放行不能替代未来施工审查或运行证据。

本轮上限5次是用户明确变更，前轮021780c4审查仅供连续性，不能放行新分母。当前先由主Codex独立对齐双仓规范并完成两遍规范自审，此阶段不派子智能体；之后复核5次有序WAL、五次耗尽六effect封口、部分次数预算/unknown、source/risk成组关闭和V1—V7，交只读子审增量放行后再进代码。禁止将数字1全局替换成5；每个Child/command仍至多一次输入。READY旧Q4/Q5/Q6只按原独立根因族与原方案接续，不把本轮业务改造当作修旧质检的许可。

### 本轮W0主审记录

主审1（正向）：四份栏目冻结源头逐份完整取得；AGENT39条现役法案及其原图/合同沿原入口复核。本轮7条AGENT与3条Website法案major各加一，前代谱系及全体lawIds引用合法；两仓provider/consumer均50，原预算8、result24和43route保持。先物理退休旧规范片区，独立工具核缺席后施工；registry由原audit:build重新生成。

主审2（反向）：从真实消费者逐项回核两门、两native动作、原WAL连续1..5、预算/unknown出口、六effect同receipt封口、source/readback与风险未用许可、历史原字节读取。普通观察不输入，重试不签业务恢复，不改四份源头/专业Skill/Product Flow；网站原20分钟图文已物理退出。新旧合同切换必须原writer收束并用同版本构建，不做双reader；规范/设计覆盖闭合，仍需独立审增量及未来建设/原生质检，未声称代码完成。Website仅迭代，原31项及AGENT新出现的localization Skill/Flow他任务改动继续保留，不夹带。

W0独立审查增量：采纳旧排他权限及submit-only来源身份遗漏，同位退休旧句→独立核缺席→闭合首次/rejection/risk/ordinary附属retry四种不互相赋权的输入权限；Browser003与WebsiteAI012因真实来源/权限规范变更同步major。采纳max1施工/验收残留，全部区分每ordinal≤1与同根≤5，V3/V4覆盖1..4继续、5空耗尽、6禁止和中途非空立停。旧主审记录说明当时取得事实，子审反证已消除前不得将其视为最终准入。

本轮增量子审：原审查者empty_retry_plan_review于方案正文SHA256 8c1cc6259db1943c6e6fe6d7ddd1f889a228b28a9f6d7011fa53c80524a4233f放行；D1/D2及同根排他规范均关闭。其意见原件在当前聊天，仅支持施工准入，不是建设或READY。修正后主Codex两次规范审查复核active谱系/39及511法案引用、provider/consumer50、原预算及内部处理边界，原audit:build/projection均成功；第三次从施工/有限验收反查，1..4继续/5空耗尽/6禁止与unknown不可推进、同源全链回读无未决设计项。
