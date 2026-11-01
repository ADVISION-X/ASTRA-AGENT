# SEO 文章同聊天五语翻译—完整实现方案

## 0. 本轮目标、唯一身份与准入

修订日期：2026-11-01，Asia/Dubai。全案状态：设计阻断；WO-E2状态：可施工。授权人已明确批准按既定WO-E2执行，范围包括法案、施工图、代码、质检与数据库操作；随后明确调整顺序为“优先完成代码建设和实测，无误后，再执行ready之前再改法案”，撤销规范对齐对本单本地代码建设的先行阻断。当前先在AGENT主仓完成WO-E2删除重建、隔离实测和独立只读建设审查；正式CHANGE/提交首推/READY前完成G0-E2双仓精确规范替换及主Codex两遍规范审计。授权人随后明确允许迭代Website侧法案；只叠加父来源定位片段，保留现有任务的全部其余改动且不夹带提交。此执行授权不扩及E1的未决设计、WO-3、服务替换、生产任务重发或RELEASE。

本节执行安排为本次最新授权，覆盖下文方案阶段历史记录中的“只写方案”“未获施工授权”及“G0先于代码”的时点表述；E2.2—E2.4的来源算法、删除前保留裁决、零父回答读取、失败关闭和有限验收保持。代码先行只形成待规范对齐的本地候选，不宣称符合尚未修订的条款；规范对齐未完成不得进入正式质量链。四份用户再次指定的合婚、八字、奇门遁甲、起名冻结边界蓝图保持源头与最终解释权，本单不改源头。

用户已确认：每篇 SEO 文章的研究 → 中文文章 → 图片 → zh-HK → zh-TW → en-US → ja-JP → ko-KR，全部在同一个 GPT canonical conversation URL 内自动接续；最终取得研究、一篇中文文章、一张真实生成图片和五份直接译自中文的译文，真实完整测试通过后冻结。正常成功路径为八个 Provider turn；合法结果修订可能增加当前步骤的 turn，不能伪称仍只有八次输入。

本轮仅更新这份既有方案；Website唯一需求文件只读取，不修改。2026-10-28的方案/工单联改是前轮历史权限，不作为本轮写Website的依据。不施工代码、不改法、不启动服务、不发Provider输入、不删建生产工单、不提交、不推送、不发布、不宣布已经冻结。本执行连续性需求沿既有唯一方案路径维护，文档位置不授予AGENT全链业务协调权；Browser、GPT、Product、Website localization、public-knowledge、ai-acceptance各保原原子责任，不设全链运行Owner、第二方案或总verdict。

唯一方案仍为本文件。旧《SEO原会话URL连续-完整实现方案.md》只作为 f2dbc3d4c 已落地恢复接缝的历史依据，不再承担本轮施工授权或验收分母；其“HK 交接即可、不要求五语完成”范围由本方案替代。旧版本本文件中同时创建五语、每语 fresh、需新建 provider_continuation 的调查与工单已过时，全部退出当前设计，不得重复施工。历史权限不能替代本轮权限。

G0按各仓Owner分别闭合。以下2026-10-28权限为前轮网站任务的历史记录：用户先答复“批准定点修订，AGENT任务由我安排”及“允许保留原差异并按限定范围追加、续改”，随后要求按AGENT执行工厂、接近稳定态、尽量少动的原则迭代。前两项许可不再解释成Browser/GPT/Product/Runtime四层必须修改或一组法条必须升版。11月1日当前AGENT聊天已获方案建设权，代码、法案和运行许可仍未取得；前轮网站权限不转移给当前聊天。
1. Website只在原授权下决定业务任务、材料、逐语派单、接纳/发布、恢复授权及完成表达；相关规范只改真实不吻合的直接条款。五份栏目蓝图和冻结说明书零修改。
2. AGENT侧仅交付§6的两项已证执行差额及T1—T6验收；本轮专门任务只建设方案，E2按WO-E2列出最小退休片区、保留裁决及原子工单。Website跨任务派单/接纳顺序、是否重做与最终业务完成不下放工厂；Product内部原三轮静态Flow及专业Skill/Prompt职责继续按AGENT现役法案归属，内容语义由模型负责。
3. Website原控制室的阶段名称与逐语交付只读投影按WO-3实施，原入库、派单、中文completed_count、清除保护与权限继续保留；该投影不成为AGENT执行前置。
前轮基础设施交接沿Website既有 docs/项目方案/网站侧迭代AGENT侧需求工单.md 的WA-20261028-01原条目收窄，11月1日新实测位于同文件WA-20261027-01第6节。它们均引用本唯一方案；本轮不改工单、不新增编号，不取得Website overlay续改许可，登记也不表示AGENT已交付。
真实运行、安装、外部发布与不可逆动作分别按执行时明确授权和项目原生规则办理。G0 未闭合时状态不得改为“可施工”；独立审计可以确认设计无遗漏，但不能代签权限。

### 0.1 AGENT稳定态保护与必要性裁决

AGENT是执行工厂。Website给出已授权的精确任务和父关系，Product按现役静态Flow加工，GPT执行当前turn，Browser准确操作并取回原成果，Runtime运输与交付执行事实。Website决定业务恢复/新revision/接纳，专业Skill、Prompt与模型负责自然语言；AGENT确定性代码不得建立语义、质量或专业内容考官，也不得新增八步总流程裁决。

AGENT默认保留现役代码、合同、协议和测试。每一处拟改动都必须先证明：当前哪个合法输入在现役链上失败、属于哪个执行Owner、已有公开能力为何不能接住、最小差额在哪里、什么反例和真实consumer能验证修复，以及成熟不变量如何保全。不能仅凭本文件列到某层，就取得修改该层的必要性或权限。删去一处拟改仍能完成同一合同，就撤回该拟改；“方案审计通过”“更统一”“以后复用”均不能替代举证。

前版WO-1/WO-2P/WO-2G/WO-2R作为四张强制重建单的地位撤回，保留其已证调用事实，不沿旧编号施工。TARGET_ACQUIRE换字段、协议13→14、新通用resolver、Runtime候选集合新API及固定内部carrier字段集合都退出当前施工要求。对专门任务最终证明不可避免的最小退休片区，仍执行删除→即时缺席核验→按合同重建；没有必要退休对象则写“无”，不能为满足重构形式删除成熟模块。只修改方案/工单不代表已经做了任何代码重构。

## 1. 源头裁决与四维约束

五份栏目冻结蓝图是用户指定的唯一产品源头和最终解释依据，已完整通读，包含正文及附录。其源头语义与各仓执行法案的实际写入权限分别核对；发现下游不符时修正下游设计，不反写源头。SEO 八步与同 URL 的新增具体要求来自本轮用户确认，不伪称五份蓝图已经规定 SEO 回合数。

| 源头当前版本 | 本轮直接适用义务 | 保护与排除 |
| --- | --- | --- |
| Website docs/governance/八字栏目冻结边界蓝图.md，1.5，第19—24、28—36条及附录三 | 唯一事实；完整材料与真实取得；解释自主；身份/条件/出处保留；运输不等于交付 | 不改 BZ05/BZ03/BZ04 fresh、算法、双读者研究、权益、PDF与网页交付 |
| 合婚栏目冻结边界蓝图.md，1.4，第12—22、31—47条及三份附录 | 两人及 BZ05 来源独立；原身份读回；事实与专业意见分开；同源交付 | 不改两阶段、同账号、上游独立权益或 HH02/HH03 |
| 奇门遁甲栏目冻结边界蓝图.md，1.3，第9—30、32—42条及两份附录 | 时间、盘、问题不漂移；完整材料；AI不改事实；真实结果 | 不改民用时、子初、拆补、起局、盘局、个人解答或报告 fresh |
| 起名栏目冻结边界蓝图.md，1.9，第9—24、25—33条及两份附录 | 文化/语言/原名身份分开；中文源与翻译不换名；上游和交付分别完成 | 不改人物 BZ05、商业非八字、20候选/全量排序、价格或权益 |
| 良辰吉日栏目冻结边界蓝图.md，1.3，第4、12—30、34—46条及附录 | 完整 READY 供给、真实取得、全范围条件、原任务恢复、独立权益 | 不改30日范围、日课、上游、全部用事或择日研究 |

五份源头的个人报告 PDF/订单规则不移植成公开 SEO 文章的产品前置。现役 SEO domain 仍只有 bazi、qimen；不因通读五份源头新增三个 SEO domain。不读取或改写 READY 正文、索引、准入记录；本轮不触发古籍再加工。

| 维度 | 2026-10-28全案依据基线；11月1日E2以WO-E2的当前原文核定为准 |
| --- | --- |
| Website 法案 | 基础 LAW-PROJECT-GOVERNANCE-010-V1；功能 LAW-PUBLIC-KNOWLEDGE-CONTENT-001-V2 至 012-V1 的现役十二条，特别 004-V2、005-V48、007-V2、008-V4；LAW-LOCALIZATION-013-V18、014-V7、015-V10、017-V2、019-V21；LAW-AI-ACCEPTANCE-002-V40中的TOMBSTONE、013-V33。完整语料、自主研究、真实原图、逐语公开、严格 parent 与唯一恢复均保留；ACCEPTANCE-004-V38不含该父locator约定，本单不修改其独立恢复规则 |
| AGENT 法案 | LAW-GPT-001-V67、002-V33；LAW-LOCAL-BROWSER-SESSION-003-V48、004-V59、006-V47；LAW-ARCHITECTURE-BOUNDARY-001-V18、LAW-AGENT-PRODUCTION-RUNTIME-001-V80、LAW-CAPABILITY-GOVERNANCE-001-V19及002-V5；LAW-CODE-PURITY-001-V6、002-V2、003-V3。工厂只作机械核验，不作内容/业务裁决；每项新增或保留结构须有真实消费者及删除反事实。URL只定位，effect只证明输入，当前Target/Document只证明动作位置 |
| 施工图/合同 | Website SYSTEM-BLUEPRINT §5—7、AI-ACCEPTANCE-BLUEPRINT 与 xuanxue-ai-production-v6.contract.spec.json；AGENT GPT-CAPABILITY-GROUP-V2、LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2、WEBSITE-AGENT-V6 三份现役施工图；canonical route policy仍归 Website |
| 质检 | Website、AGENT 各自唯一 quality:check；Static、Exam、真实 Provider/Browser、Website 接纳与公开 readback 分开。普通测试和旧报告不证明八步完成。未来正式 Dynamic Proof 必须归入现役声明与原生 RELEASE；本轮不运行 |

规范核对范围：现役同URL定位、effect去重与Website唯一恢复裁决首先直接复用，不把执行缺陷自动改称法案缺陷。对“completed父任务current attempt必有当前step唯一CONFIRMED行”不能承接合法旧effect复用，以及SEO获准新revision仍受原U约束的差额，只修实际阻止该最小交付的精确语句，不重写其它产品恢复。FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001、FROZEN-GPT-CONVERSATION-LOCATOR-EFFECT-SEPARATION-001、TOMBSTONE-RECOVERY-AUTHORITY-001继续有效；确需改变其冻结语义才按原精确权限办理，普通代码缺陷不授解冻权。现有parentConversationUrl和selectExactGptConversation已各自具备其既有模式的可信URL运输能力，应优先复用；confirmed-readback新Target接缝尚待核定，不能据此宣布全部恢复合同已足够，也不预设新增私密载荷或协议升版。

真正发送仍只有原两项确认：Prompt/附件一致，以及当前物理授权/Target/Document/fence有效且effect未输入。原 URL 相等属于后者的页面身份有效性，不设第三个业务内容门；首次研究尚未生成 /c/ 地址时不要求预先存在 canonical URL。回答完成仍保持原两门，不加语义或质量拒收。

## 2. 当前候选与前轮连续性

| 仓库 | 当前根、分支、HEAD、tracking | 已有差异 |
| --- | --- | --- |
| Website | /Users/nexgen/Documents/xuanxue-web；main；c6392be04；origin/main | 本轮初查47条dirty/untracked路径，全部只读保全；本轮没有Website续改权。前轮WO-3权限属于原网站任务 |
| AGENT | /Users/nexgen/Documents/AGENT；main；2da4aec64949178507a06954c1ade188ad4af11a；origin/main | 本轮写方案前工作树clean，方案本身也clean；此后唯一预期差异为本文件 |

scoped candidate 只用于设计事实重绑定，不作为冻结清单或运行状态。五份源头逐字节 SHA-256，按八字/合婚/奇门/良辰/起名顺序：
- fc9c8194616cb2e87fcf6715f9f7757f4dcc8e37f538ea8699cb371fca05c6fa
- fa74fbe16c863b687e9957de99e90658ee87b1840381aaf9f0a3eb044a35f48d
- e936ea5f0907d9a5fa622006235953bf33b494849c7a15ee1636187e81f570b3
- 16db9fd1836167fff7ef348f19ba7243db23fce29cd9b50344a4c2b90e5dd579
- e1c2bc2780824e288502f6e763aad7a1bf2a1941c5f67a4e7a3f21f7c773892e

执行者还须重核 §3、§6 所列实际权威、合同、生产与验收落点的当前字节和 overlay；只重开有实质影响的漂移。方案文档自身 hash在实际交付工具输出计算，不写入本文件形成自哈希。原生 READY/RELEASE 必须分别使用 clean commit。

有限回归筛查已命中：
- Website 0cae90882 已落地严格顺序 sender；现役 resolveNextArticleLocalization 已核 completed、business_consumed、publication及 declared parent，不能重复改造为总 orchestrator。
- AGENT 8949f8350 已分离发送确认与 URL 取得；继续保留 CONFIRMED 不含URL、定位失败不撤销已发送。
- f2dbc3d4c 已落地 settledConversation、cache/source 零页面恢复后下一步精确选原 URL。当前 ProductionGptBrowserLifecycle.recordSettledResult 同 session locator 不等会拒绝，但该核验晚于后一步发送，不能代替发送前保护。
- 旧同聊天方案的 provider_continuation、父 WAL 窄读、独占 Target 已存在。只保留其身份、顺序、逐语接纳不变量，不复活旧绝对 fresh 禁令、全量派单或旧四材料运输；现役动态翻译已为两 ZIP。
- 旧 URL 专项 D1 仅要求前三步及 HK 交接。该验收不足的原因通过本轮两领域完整八步、异常注入与六语实际读回修复；不复制旧三步成功冒充八步证据。
- Website专业Skill的references/article-output-and-image-contract.md仍有1200×630/contain旧叙述；本轮重核SKILL.md正文没有这组固定尺寸词，不能一起误列为必改。另references/production-graph-and-agent-boundary.md把Provider恢复归Product，与当前Website唯一业务恢复权失配；只修这些已证下级文字，保留Product内部静态步骤/Prompt归属，不借文档校正改AGENT机制或恢复图片门禁。当前相关Skill与reference均未修改。

## 3. 现役实现、交叉查漏和停止边界

发现来源一：AGENT src/mediator/product-plugin-catalog.ts 穷举13个 Plugin/43条公开路由；Website canonical route policy交叉核对 product/action/relation。来源二：反向追踪 context.gpt.execute/readConfirmedSubmit、createExecution、acquireJobBoundChatGptTarget、readSubmittedConversationUrl、insert/bind publication 与 sender worker 调用，核对实际执行与存储消费。两者在13 Plugin/43 route无未解释差异；内部 known-rate-limit ack 是 GPT/Browser 内部动作，单独列入保护，不能伪算第44条业务路由。

| 路径/精确符号 | 当前行为、决定及验收 |
| --- | --- |
| W services/api/src/public-knowledge/execution-service.ts/createWebsiteAgentTaskWithClient；agent-result-consumer.ts/parseArticlePackage、consume；admission-repository.ts | 一张中文job、原资料快照、三轮包、原图/引用机械接纳。直接复用；删除会失去业务授权与原子中文入库。T1/T7 |
| W services/api/src/localization/article-localization-owner.ts/readSourceParent、resolveNextArticleLocalization、enqueueArticleLocale | 严格最长接纳前缀，一次至多一语，parent三元组。直接复用；不把现有3+/1行用户差异恢复。T1/T5 |
| W localization-material-source.ts/buildArticleLocalizationSource；localization-completion-worker.ts/completeReadyLocalizationJob；public-knowledge/public-edition-repository.ts | 每语同一中文 source/version/hash；artifact/binding/payload/projection/released同事务。直接复用；否则串译或部分发布。T5/T7 |
| A src/plugins/public-knowledge-article-pipeline/index.ts、seo-gpt-calls.ts/createSeoExecutor、prepareAttachedTurnPrefix | 正常首轮fresh、同session三轮直接保留；新revision首入口仍可能fresh，属差额E1的静态事实。是否必须局部调整准备选择由专门任务证明，不能据此重建整个Flow或赋予Product恢复决定权。T1/T4 |
| A src/plugins/localization-production/flow.ts/runAuthorizedTurn、executeOwnedFlow | 文章 primary续父URL，报告/review fresh；一次submit，两个ZIP。直接复用；revision也必须继承原父/本job已锚定URL。T1/T4/T6 |
| A src/lib/local-runtime/production/executor.ts/readContinuationParent、dispatchPlugin；executor-source-checkpoint.ts；store-source-readback.ts/readSourceReadbackObservations | completed父结果ref/hash的合同及source observation保留；旧来源组装按WO-E2退休并重建。current attempt/child step不能代替原effect来源，不改业务parent或新建来源API/台账。T4/T5/T6及E2.4 |
| A src/capabilities/gpt/production-browser-lifecycle.ts/browserFor、recordSettledResult、selectSettledConversation；production-call-preparation.ts/acquireProductionBrowserCall | 恢复后原URL接回、缓存/来源、分类、ack跳过选择及finally均保留；E1只核现有精确选择是否在live lease下一turn前真实执行，不预定重建GPT生命周期。T2/T3/T4 |
| A src/lib/browser/infrastructure/browser-lane-coordinator.ts/serveAcquire；exact-target/browser-mutation-evidence.ts/readUniqueConfirmedConversationUrl；browser-mutation-store.ts/readSourceConfirmedProviderEffect；browser-command-actor.ts/readSubmittedConversationUrl；browser-submitted-conversation-locator.ts/bindSubmittedConversationLocator | 原Store exact source reader与一次locator绑定保留；旧readUniqueConfirmedConversationUrl按WO-E2退休。E2核父结果实际采用effect，E1另核locator不把B当U；不加URL表、不复制WAL或改terminal。T2/T3/T4/T5及E2.4 |
| A chrome-extension/extension-target-authority.ts/qualifyCandidateNavigation、publishMainFrameNavigation、executeConversationSelection；extension-interaction-readiness.ts/ensureInteractionReady、assertInteractionReady；exact-target-runtime.ts/advanceDocument | 初次续聊比URL、原精确选择均已存在，优先复用；后续合法A→B仍可被发布是E1断裂。只补原物理身份保护缺口，tab/claim/activation/FIFO及独立职责保持；精确文件集合不是强制改动分母。T2/T3/T6 |
| W public-knowledge/control-room-projection.ts/workOrderCompletionCountsSql；packages/public-knowledge-content/src/control-contracts.ts；apps/web/app/admin/seo-control-room/SeoControlRoomOperationsPanels.tsx、SeoControlRoomDashboard.tsx | completed_count依据中文admission，且用于清除保护。保留数据库语义、过滤、删除授权；仅重建页面阶段表达及当前25条run的五语接纳只读投影。T7/T8 |

共享消费者全部覆盖：八字三个Plugin、奇门两个、合婚两个、命名两个、择日、付款观察、SEO、localization共13个。前11个保持现役独立fresh及同effect恢复；SEO primary为本轮八步源；SEO两个review仍fresh；localization七route中文章primary及固定catalog获准后继保direct-parent，固定catalog首项、报告primary及全部review保持原fresh/subject规则。沿Catalog直接列举运行验收，不能用一个SEO正例代替全部共享回归；成员的具体专业内容、商品和权利在不变合同边界停止扩查。

停止边界依据：W task/result外部字段、parent三元组、材料/结果schema与接纳事务不改，故不重建付款、PDF、命盘、古籍或搜索连接器；对这些边界只验注册/共享能力调用及既有不变量。AGENT既有加密URL运输及精确选择直接复用，Extension实际消费者仍在E1验证范围内；不能因为要验共享消费者就修改其专业Flow。W控制室读合同版本若从v6升为v7，所有同仓producer/parser/hook/test需同候选切换；不保留v6/v7双读。

## 4. 唯一目标链与合同

原八步链保持六张业务任务：一张中文生产job，五张逐语localization job。一个业务任务只保存自身事实；“一气呵成”不要求合并job、复用父Tab、跨事务等待或抢占高优先级任务。正常等待原调度、Provider完成、接纳后自动继续。

U 是首个真实研究提交的Browser WAL locator中已经独立验真的 canonical URL；从U成立起本流程所有新输入和结果定位必须等于U。首次首页到/c/的合法建聊仅发生在U尚未成立的首研究；此时不把首页当最终U。URL只按现役https/origin/path清洗规则比较，丢query/fragment，不按标题、时间、UUID形状或侧栏猜测。

H1 Website原快照/资料 → SEO Product：现有task/result版本、材料有序identity与单ZIP不变；research/article分别取canonical子合同，article/image零重新上传研究包。固定专业源和程序/AI边界保留，不把本次五份个人产品蓝图加入末端动态翻译材料。

H2 Browser原URL事实 → 当前物理执行：优先复用现役两种路径。获准跨任务续聊由原TARGET_ACQUIRE的parentConversationUrl携父WAL唯一URL；同effect读回及同job后续turn由原selectExactGptConversation携原WAL已验U。Browser核来源合法后，Extension在原acquisition/精确选择的同包读回中把U约束在该当前活绑定；Document推进不能清掉约束，进程/Tab丢失只能从原WAL重取。首研究无U时合法建聊，原locator验真后，下一合法turn在原Child atomic闭包内精确选择并绑定U，live lease不能使这次选择被跳过；命中U零导航，否则只沿原精确导航一次。其它Product现役fresh、known-rate-limit ack与原恢复不变量保留。优先保留现有private payload和COMMAND三键，撤回预定换字段、新set-url命令及协议升版。已证边界是websocket-target-operation.ts/parseAcquire与browser-authority-websocket.ts:171仅允许authorized-continuation在acquisition携parentConversationUrl，confirmed-readback当前不接该字段；extension-created-target.ts/createProductionCandidate:27固定先创建GPT_WEB_START_URL页面，再由原选择动作回U。该组合尚不能证明新Target恢复满足现法“不执行start URL/首页导航”。此接缝明确纳入E1设计阻断；专门任务须据实际模式核定最小差额，不能预先宣布现役全部合同足够，也不能借此自动采用换字段或13→14预案。URL不能来自操作者页面或任意caller，不进入Website、日志、普通proof或第二持久存储。此为E1交付约束，不授工厂任何业务判断。

H3 原子物理动作与locator：原身份安全条件必须覆盖发送前及准备中导航，包含同loader的SPA变化；仅在早期采一次URL或回答结束后才比较均不能接住E1。检查与物理输入之间的导航须使旧资格失效，原native动作在当前coherent URL/Document/activation事实下执行；不新增第三项业务submit门或轮询/timer。输入前已不等或无法确认则危险输入为零；输入已经开始或不能排除时保留真实DISPATCHED/CONFIRMED及计数，停止后续输入并走原effect读回，不能伪称零输入。locator只能与已验U一致，不能用新B替代U，首次正常首页→/c/仍成立。当前同步guard和导航发布是已证检查入口，专门任务只裁决其不可替代的最小差额，不据此重建整套Browser/GPT。

H4 同job恢复与新revision：全部直接沿Website当前精确授权及原effect/Forensics零输入优先链。新revision是否签发、哪些调用可复用/可风险输入均由Website决定；AGENT不得以本地revision数字、URL或错误码重新决定。已存在可信U的本篇流程仍在U执行当前获准turn；从Product第一入口执行不等于另开聊天。当前SEO首研究prepareAttachedTurnPrefix无条件包含prepare_clean，是E1必须核对的具体接缝；正常revision0、原专业Prompt/模型/单ZIP/三轮和其它产品fresh均直接保留。专门任务应先证明现有准备/精确选择能否承接；若必须修改该接缝，只改变此次获准原会话执行所需的局部准备选择，不改调用回合、业务恢复或整个静态Flow。无可信U仅关闭当前危险动作并回传原typed事实，Website原需求继续有界再检查；不得因便利而fresh、重建替代job或判业务永久停止。原U无法核验的流程不能计成功。

H5 中文入库 → 五语：原Website中文包原子admit/release，逐语自动sender及业务exact parent unchanged。AGENT先核该父job/result ref/hash与本地completed结果精确一致，再按WO-E2核该完成结果实际采用的checkpoint、原effect和完整来源身份；Browser只使用来源的原step/attempt/revision/call/Child，不再借当前child step或completed attempt代替来源。sourceAttemptId可能不同于完成attempt；父step也可能不同于child step。不能复制WAL、重写effect身份或改Website parent。正常live/cache/source已有recordSettledCheckpoint→recordSourceCheckpoint→production_attempt_handoffs来源链，原持久化结构保持。

原完成结果的evidence_refs、source_checkpoint observation、原effect proof/hash及Browser的readSourceConfirmedProviderEffect作为唯一来源直接复用。自身live/cache不另要求source grant；跨attempt只核本完成attempt已经实际采用的合法来源。Runtime不接触URL或父回答，不排步骤；多轮父结果按WO-E2核全部采用来源并由Browser证明唯一原会话，不任取一条effect。只有内存中的既有参数交接发生必要类型调整，无新来源API、WAL副本、ledger或缺失证据回填。固定catalog是共享定位的真实消费者，其11月1日反例纳入同一E2，不另建catalog方案。翻译仍消费同一中文定稿、两ZIP及完整政策，逐语接纳和公开归Website。
H6 最终业务与证明：Website负责六语按同article/version/hash入库和公开读回；Browser负责八个实际effect定位全等U及输入事实。Website不保存也不裁决Provider URL，不能仅凭“六语齐备”声明同URL已证明。全流程完成只在两侧原生证据共同成立时报告，不增加跨仓运行状态或总verdict。搜索收录、排名和连接器不作为完成前置。

数据合同适用性：跨仓task/result字段、required/null、unknown-field policy、canonical hash、幂等键、事务/lease/fence、COMMAND三键及原effect身份保留；Browser协议revision13优先保留，confirmed-readback新Target接缝的必要合同差额尚未核定，不把“优先保留”冒充已证明无需变更。现有parentConversationUrl与selectExactGptConversation负责其既有方向的request-only加密定位，不扩大URL载荷许可；调用期活绑定不形成第二locator真相。只有专门任务用明确反证证明这些合同不能承接必要交付，才回本唯一方案与具体授权核定该差额，不自动升版。W五语交付投影只读派生，不落聚合状态。新增表、列、依赖、服务、timer、队列、migration均为无，不为验收清单制造结构。
## 5. 有限分母

| 状态/事件 | Owner、权威输入 → 输出/consumer | 拒绝、未知与恢复回接 |
| --- | --- | --- |
| 首研究全历史零输入、尚无U | Product准备；Browser当前grant/WAL → 首输入及独立locator，原checkpoint消费 | 定位失败保留CONFIRMED，只读恢复；不以无URL判未发送 |
| 原U已成立，文章/图片/翻译待发 | Browser原effect/parent+当前lease → 在U执行合法当前turn | A→B或约束缺失零危险输入；精确回U后原授权重入；不签业务恢复 |
| 原结果已完成，cache或source命中 | GPT/Forensics原ref/hash → 同原答案；下turn消费原U | cache/source本身零acquire/navigation/prepare/submit；缺组/损坏原typed失败 |
| Tab关闭、刷新、进程/扩展重启 | Browser同effect或parent → 当前job新Target+一次精确导航到U | 不复用旧tabId，不回首页；失配不发送；同effect恢复输入增量零 |
| 准备中、发送前、发送后导航A→B | Browser当前authority/revision → 原typed失败和真实输入事实 | 前两者错误会话发送为零；后者保留原effect、不重发、不绑定B为U |
| Website拒绝结果/风险revision | Website原rejection或精确grant → Product第一入口、Browser同U、合法新effect | 没U不fresh；旧effect不重发；需求仍由原Owner有界再检查 |
| 中文未admit或某语未接纳/失败/未知 | W原领域receipt/中文source/parent → 当前job恢复或下一语 | 不跳语，不重复job，不将HTTP/Outbox当接纳；合法decline不是成功完整文章 |
| 中文及五语均admit/released | W原六语事实 → 六语交付齐备；Browser八步事实 → 同U证明 | 任一欠缺均不声明全流程完成；历史withdrawn/superseded不作为新成功样本 |
| 操作员暂停、撤权、删除 | W原control/revocation/purge → 原终态及既有已入库闭包 | 不新增取消协议；暂停期间不强迫新输入，既有已发送与合法结果保全 |
| 限流/后台高优先级任务 | 原Browser ack/cooldown/FIFO与W容量 → 原合法等待/恢复 | ack不被URL导航递归前置；不抢占、不改N/1.5s/2.5s/40s/70s |

所有分支的持久化/readback都来自现有Owner；无恢复动作的纯只读阶段表达没有新lease、receipt或存储。

## 6. 原子工单与删除前裁决

所有施工单共同纪律：先按当前authority、输入输出合同推导新函数；逐项完成删除前保留裁决；删除点名旧片区 → 立即AST/符号与调用零残留核验 → 从合同新建 → consumer验证。禁止读旧片区改字符串后删写、缓存旧骨架、Git复制恢复、改名搬家/转发、兼容壳。共文件独立职责不删除，不临时搬走。收益是“成熟顺序/恢复/去重/交付继续成立 + 发送前及恢复后强制同U + 全八步实证”，不是行数下降。任何保留若无法说明消费者和删除后失败，先删目标设计中的该单元。

### WO-0：直接规范差额核对（各现役law Owner分别处理，不是跨仓施工单）

做：按§0已批范围逐项比较真实交付与现役规范，先直接复用已满足的条款。Website负责本仓义务准备；AGENT规范只能由用户安排的专门任务处理。保留：五源、母本、基础法案、工厂定位、两项submit/两项回答判据、其它产品fresh及Website唯一业务恢复Owner。删除/重建：目前无生产对象；不因写本方案退休任何法条。只有最小交付与精确旧句真实冲突时，才在相应Owner原条款定点替换，语义不变的法条无修改。
边界：E2父locator约定涉及W ACCEPTANCE-002-V40中的TOMBSTONE（原第320行）及SYSTEM/AI-ACCEPTANCE、A GPT-001、Browser-003/006、ARCHITECTURE-BOUNDARY-001、CAPABILITY-GOVERNANCE-001.summary。E1新revision原U约束需与原GPT-002及Website授权语义核对。这里只给实际相关位置，不要求全部升版；ACCEPTANCE-004、原风险授权和非SEO恢复不改。既有URL传输和协议revision13优先保留；E1新Target接缝未闭合前不作“绝无合同差额”的裁决，也不自动扩大改法或升版范围。改动依赖引用或生成投影确有差额时才用原生成器同步，不新建规范副本。
顺序：权限及最小差额→精确原条款→必要原生成投影→冲突核验。验收：§4能合法表达且无业务判断下放、无第三门禁、无第二状态或URL存储。失败：只停止依赖该冲突的动作，不以代码降低义务；无自动回退或生产数据迁移。

### AGENT交付边界：E1、E2（待用户安排，只交需求与取证，不是四层重建指令）

| 差额 | 已证事实与最小交付 | 保留、验证与停止边界 |
| --- | --- | --- |
| E1 原URL连续执行 | 原publishMainFrameNavigation/交互资格可接受另一合法GPT地址；live lease后下一turn精确选择、新revision首研究prepare_clean，以及confirmed-readback当前acquisition不接URL而新Target先创建首页的接缝均需覆盖。交付：网站已授权的本篇当前turn仍在首研究已验U执行，输入与locator不能默许A→B；恢复不授新输入。Browser只核当前物理身份，Product/GPT仍只执行已定当前动作 | 原parentConversationUrl、selectExactGptConversation、WAL locator、同effect读回、静态三轮、Prompt/模型/材料、lease/fence/FIFO/节拍/ack全部保留。T1—T4、T6击穿错址、跳过选择、风险revision另开聊天及伪零输入；首研究合法建聊通过。既有能力能接住则零改动；确有缺口仅在原执行Owner的最小接缝修复，不改业务规则 |
| E2 合法父结果实际来源定位 | current_attempt_id和child productStepId均被误作父effect来源；11月1日catalog反例已真实失败。交付：Website父三元组不变，按父完成结果实际采用的原effect集合及原step/attempt精确定位唯一会话。具体片区、必要参数差额、删建纪律与验收见WO-E2 | 原source_checkpoint/evidence_refs、公开Browser历史/来源reader及已采用授权直接复用。live/cache不额外要source grant。无新来源API、ledger、镜像WAL、业务恢复或Website URL字段；不借E2扩建E1 |

专门任务接单顺序固定：重绑当前法案/代码/用户差异→复用现役公开链验证E1/E2→对确实不能承接的每处最小差额，先在本唯一方案E项内闭合精确符号、Owner、保留/删除、承载余量、原子handoff及验收→独立只读审查后在用户安排范围内施工。不得另建竞争方案、先改代码再补必要性，或因曾列到四层就逐层重构。本版不预批具体生产文件diff；尚未核定处明确保持设计阻断，不冒称AGENT已可施工。

### WO-E2：已采用父成果的原来源定位片区（2026-11-01方案迭代）

#### E2.1 现场、源头一致性与第一断裂

需求来源是Website唯一工单WA-20261027-01第6节；本轮用户明确要求AGENT作为工厂只负责执行，并要求法案/蓝图深遍、闭环Skill全文至少两遍、片区删除后重构、主审三轮及独立只读审计。本轮不执行前轮WO-3，不把方案授权解释为生产施工或改法授权。

独立回读原`production-runtime.sqlite`与`browser/browser-mutations.sqlite`：child `aiprod_fcb754a2-e276-49f0-af5e-136328e788c7`的Website父三元组与本地completed父`aiprod_f1146dba-4ec6-47f8-b4e9-b90600c688e1`完全匹配。父current attempt为`31a9662a-bf2a-4c5c-b064-d1be4842cbdf`，其CONFIRMED turn-submit/provider_effect恰好1条、真实step为`static-catalog:65041cfa5183b018a4e3e6278a166be259b8f8e9668d53f6fb651ab70dd8864f`；用child step `static-catalog:c6950362bbdaee4ba3185cd9093de815dc035bd37868e8e83895b5b51c47d610`查询为0。父完成结果有1个evidence ref，完成attempt有1条settled_checkpoint，artifact确属该结果；effect为`sha256:be8acb06eacb41c56406a2d20d70e038784abcdce57373740082cdf969a56a90`。child Provider-effect行数为0；原日志`7d7d81bd-1f37-4cb9-9dde-c0fa492a8e6a-0001.jsonl:176`在profile-open以`BROWSER_PARENT_PROVIDER_EFFECT_MISSING`失败。此为旧候选真实阻断证据，不是修复后成功。

父子cohort同为`batch-5128934dfd6c`、policy同为`target-language-review-v257-20261027`，source_sha256分别以`e15c4696`、`63935f83`开头。`static-catalog-flow.ts::productionStep`本来就包含source_identity、policy、cohort/membership和authorization；父子step不保证恒等。此次只证明错误来源条件，不据此给Website全部版本演进作合规背书，也不重写Product step来迁就查询。

四维结论：①功能法案RUNTIME-001-V80（同job来源证明限制须加入本单已鉴权父来源元数据的窄例外）、ARCHITECTURE-BOUNDARY-001-V18（含TOMBSTONE-RECOVERY-AUTHORITY-001）、CAPABILITY-GOVERNANCE-001-V19.summary、GPT-001-V67（含FROZEN-GPT-CONVERSATION-LOCATOR-EFFECT-SEPARATION-001）、Browser-003-V48及006-V47明确使用completed父current attempt/当前step；②GPT蓝图第21—34、92、102、112行与Browser蓝图第69、81、83行同样规定，文字相互吻合，却共同遗漏“已采用原来源与完成位置不同”的合法执行分支；③实际断裂为executor取current attempt→GPT无损传递→lane把child binding.productStepId传给父WAL精确查询；SQL拒绝缺失/多义本身保留；④现有GPT及Browser inspector还硬绑定该错误传参字面量，必须在原检查中替换错误检查对象，不能删掉检查求绿。母本、基础法案、Website唯一业务裁决、机械安全和语义主权没有因此失效。

**施工前置G0-E2：** 此处确实需要定点替换上述“父完成attempt/当前step必为实际来源”的规范语义，不把它伪称零改法的普通bug。用户本轮只授权方案。施工须先明确批准涉及的active law修订，并按原文明确解冻TOMBSTONE-RECOVERY-AUTHORITY-001与FROZEN-GPT-CONVERSATION-LOCATOR-EFFECT-SEPARATION-001的这一个父来源定位片段；所有恢复权、effect去重、URL私密与禁止第二链语义原样保留。Website当前LAW-AI-ACCEPTANCE-002-V42同一Tombstone也规定当前step，须由Website原Owner单独完成同一精确规范替换；不修改Website业务代码或要求其发送父attempt/step/URL。源头未对齐前不施工依赖片区。无需修改母本或解冻其它固定条款。

RUNTIME-001-V80原同job证明消费限制与本单跨parent元数据定位不可分割；仅增本单已鉴权、父结果精确绑定及零父正文读取的例外，不开放Browser私有WAL或改变其它恢复消费。

规范目标句：在Website已签provider_continuation且父结果ref/hash与本地completed结果精确相等后，只能使用该完成结果实际采用且已有持久采用证据的原Provider effect。原effect的job、来源attempt、revision、step、call、Child及authority/hash整体验真；完成attempt和child当前step不代替这些来源字段。Browser只读这些既有effect的可信locator，全部采用来源指向唯一canonical URL时才向当前job的独占Target交付原精确导航；缺失、未决、篡改或地址冲突零输入失败关闭。Website仍唯一决定业务关系/恢复，AGENT不选择父任务、不取得重做资格。

上述定点规范替换还须明确：允许GPT原Owner仅为核图片采用关系，按已完成父结果精确绑定的job/source-attempt/checkpoint identity读取既有`gpt-image-source-binding.v1`身份描述，核其原ref/hash后只回传originalArtifactRef；这是封闭执行身份元数据，不是父回答/原图。父文本和父原图bytes读取保持禁止，描述不含URL，不能进入Product或成为下一步骤/新输入授权。该语义与私有只读参数调整一并在G0-E2审定，不能用普通artifact verifier越权；不修改Forensics存储合同或增加端口。

#### E2.2 唯一目标链与必要参数差额

1. Runtime保留原`readContinuationParent`的completed/ref/hash机械合同。在已durable accept且route relation验真之后、Product第一次页面动作之前，原executor-source-checkpoint片区读取该完成attempt的`readSourceReadbackObservations`及既有`readAcceptedSourceSettlements`，只核父结果`evidence_refs`对应的已完成checkpoint；来源不能从latest、时间、当前child参数或任意WAL行猜出。跨attempt逐项匹配`reused_checkpoint`中原settled_reusable来源及同effect/ref/hash，不把risk_authorized或rejection_settled当成采用事实；正常live/cache不要求handoff。递次复用直接消费原acceptedSourceSettlements从当前完成attempt沿byIssued链验真并去环的结果，不另写遍历器或新读接口；闭包只取该父job已有行，每条最多一次，环、缺失采用证明或矛盾拒绝，不新增恢复状态。异步artifact核验在dispatchPlugin调用Mediator工厂前完成，再把已验证的原值交原同步context工厂，不能将工厂改为异步业务编排。
2. 现有`readJobBrowserHistoryEvidence(parentJob)`为源effect提供原step/call/Child、source attempt/revision、effect/hash及真实物理状态。与observation的proof、source_effect_set_hash、wal_authority_hash、artifact、conversation/user hash整体精确相交；仅`CONFIRMED/confirmed/physicalInputCount=1/anchorState=trusted`可用。相同原effect的同值重复证据可去重，矛盾不可合并。缺失的checkpoint、WAL或locator不回填、不复制、不改旧字节。
3. 父来源定位禁止调用`verifySourceCheckpointArtifact`、`readPersistedGptTextResponse`或`readPersistedGptImageEvidence`：前者会经后两者读完整父文本或原图，不能因Runtime只收ref就称没有读取父回答。文本只核原已持久化checkpoint proof/hash与父结果evidence_refs的直接采用关系，不重新打开父回答。图片observation的artifact_ref指向身份descriptor，结果evidence_refs指向original；现有完整图片reader一定还会读取原图，不能复用这条完整reader。
4. 图片仅在该ref差额存在时，经一个必要的窄内部方法`readAdoptedImageReference`核已有身份descriptor。输入只有已核parent job、source attempt、checkpoint exact-call hash、descriptor ref/integrity hash及原conversation/user hash；它在`evidence-artifacts.ts`沿现有`artifactKey(exactCallIdentityHash,"source-binding")`和Forensics原`readArtifact`读取一次定型JSON，复用`assertImageBinding`核其封闭结构，并核descriptor ref/hash、conversation/user hash精确相等，只返回已有`originalArtifactRef`供Runtime与父结果refs比较。绝不读取`observed-response`或`original`键、父文本、原图bytes、Prompt、URL或跨任务旧页面。缺描述、坏hash、未知字段或ref不等均拒绝；不从文件名/路径猜ref，不退回完整reader。当前`verifySourceCheckpointArtifact`及其同job原恢复消费者零修改，原完整内容校验不削弱。Runtime核采用集合完整性，不能因图片ref不同直接跳过；此处只证明原采用身份，不重新证明父回答当前可读性，也不读取父回答内容来定位。
5. 在既有`providerContinuationParent`与`BrowserTargetLeaseWait`的authorized-continuation分支，以只读内存值整体运输父job及上述实际采用effect的精确查询参数。直接复用`readSourceConfirmedProviderEffect`的输入类型字段，不建立新父来源判定API、新候选类型体系或持久carrier；第4项明确列出的内部身份描述读取是唯一必要新增方法，不冒称零接口差额。无父的fresh分支没有来源字段；缺字段、空集合、非法/未知字段拒绝，不能兼容旧“父attempt+child step”分支。当前child BrowserExecutionBinding、provider_effect_identity及step原样保留；父来源只供定位，不进入child effect identity或Website载荷。
6. Browser lane只消费这些已经机械绑定的来源，逐项调用原Store的`readSourceConfirmedProviderEffect`，以原结果的完整采用集合为边界，检查每项实际locator非空且URL全等。单轮父通常一项；SEO三轮父允许多个不同effect，但只能共同证明一个会话，不能把多条合法采用effect误判成“多义父任务”，也不能任取其中一项。未采用历史effect不得入选；两个不同来源URL必须拒绝，即使其中一个等于child预期step也不能优先选它。未决/损坏的选定来源拒绝，兄弟job历史未决不连坐。
7. 得到唯一URL后仍走原`parentConversationUrl`→TARGET_ACQUIRE→原Extension精确导航和readback。无新Browser wire字段、protocol升版、URL表或第二resolver；Extension、acquisition导航、FIFO、节拍、模型/附件/Prompt均直接保留。无法定位只回原typed failure及原worker；不得fresh、重翻父成果、改父关系或把本地失败判成业务永久停止。

“1+1”具体为：成熟的原exact effect/source/once/交付安全完整保留，同时新增合法父子step不同及来源attempt不同的可执行定位；旧失败反例恢复通过，错误父/坏来源/多URL仍零输入拒绝。只让浏览器能打开、放宽SQL、改成一个永久常量step、增加超时、复制父WAL或牺牲旧安全来消除报错都不算提升。若验收无法同时证明两部分，不替换成熟实现。

#### E2.3 片区、删除前保留及原子工单

| 原子责任/唯一Owner | 退休与合同重建；不可分割局部修改 | 保留对象、真实消费者与删除反事实 |
| --- | --- | --- |
| R：完成结果→已采用原effect来源，agent-production-runtime | 退休`executor.ts::readContinuationParent`仅返回父row并在`dispatchPlugin`拼`acceptedAttemptId=current_attempt_id`的旧来源组装片区；保留父三元组校验的合同，按E2.2在既有`executor-source-checkpoint.ts`重建精确采用核验并由`dispatchPlugin`调用。`executor.ts`当前494行，删除旧来源函数/组装后只保留窄调用，禁止再堆通用resolver。新核验函数每项≤75行/7参数/10 await，放在当前54行的原来源文件承载，必要只拆同文件原子核验，不新增服务或文件 | 原`recordSourceCheckpoint`、Store读写/accepted seal、父结果及Outbox、route relation、durable accept、执行finally、website completed边界均保留。它们分别保证采用事实、合法来源、正确任务及同结果交付，删除会丢现役消费者/授权，不能重建整个executor或Store |
| G：已验证来源机械运输与图片身份描述核验，gpt | 退休`production-ports.ts::providerContinuationParent`和`production-browser-lifecycle.ts::acquireBrowserLease`中把acceptedAttemptId当来源attempt的参数片区，重建只读输入类型及原传递语句。只在现有302行`evidence-artifacts.ts`增加E2.2第4项的closed descriptor reader；`ProductionGptChildTools`增加同名窄内部方法供现有Executor转交已核输入，Runtime只收到originalArtifactRef。其真实消费者是parent source核验，旧完整reader会读父原图故不可复用；删掉窄方法会丢图片采用绑定或迫使越权，metadata-only反例验证其必要性。不新增文件、公共Product facade或Forensics接口 | 原`verifySourceCheckpointArtifact`及现有完整artifact readers和同job恢复调用全部保留、零修改。保留原binding parser、Forensics append/read、source/cache、`recordSettledResult`、profile/附件/Child顺序、park/ack/settle。新方法不调完整reader、不读父文本/原图、不返回身份描述或回答给Runtime；描述中Target/Document hash不取得恢复或定位权 |
| B：原effect→唯一原会话，local-browser-session | 物理退休`browser-mutation-evidence.ts::readUniqueConfirmedConversationUrl(parentJobId,parentAttemptId,parentProductStepId)`旧函数及`browser-lane-coordinator.ts::serveAcquire`用child step构造父选择的片区；同路径按E2.2用既有`BrowserMutationStore::readSourceConfirmedProviderEffect`重建lane读取/全等比较。`browser-target-lease.ts`与lane的acquire waiter只调整该分支内存参数；不新建store方法。旧reader的测试/inspector专属调用同时退出 | 保留`readSourceConfirmedProviderEffect`及原严格SQL、密文/locator/原atomic outcome核验，当前Store493行无需加新resolver；保留lane唯一pump/wakeTimer/释放、TargetAcquirer和Extension原URL导航。删除这些原件会丢精确WAL来源和物理串行性；不得把它们纳入整文件删除 |
| Q：验证错误选择已被消除，各原质量Owner | 在`agent-production-runtime-startup.acceptance.ts`、`local-browser-provider-effect-recovery.acceptance.ts`、`local-browser-mutation-store-support.ts`、`product-plugins/localization-production.acceptance.ts`及GPT原恢复fixture中只替换已依赖退休reader的调用、增强E2.4确缺反例。Runtime `authority-inspection.ts::inspectContinuation`及其`agent-production-runtime-recovery-boundary.acceptance-support.ts`反例、Browser `target-claim-inspection.ts`、`opaque-proof-inspection.ts::inspectEncryptedRecoveryLocator`及GPT `gpt-provider-contract-inspection.ts`退出“必须出现child step传参字面量”的错误检查，改验真实typed来源消费者与exact reader调用；不能删质量门、增加宽正则/常量PASS | 原父ref/hash、错job/attempt/step/call/Child、缺失/多义/未决、零重发、其它产品fresh的保护保留，只替换失真的生产身份来源。先证明旧实现被新反例击穿，再施工；无需新runner、测试目录、报告或总质量入口 |

全部生产删建只在G0-E2及代码施工授权齐备后由主Codex执行，子智能体仅审计。工单顺序：原检查反例证实不足→规范精确对齐→逐片区删除→当场AST/符号/调用缺席核验→按本节输入输出合同新建→真实consumer验证。不得先把旧函数读进变量/副本、加工后删写；不得Git复制恢复、改名搬家、转发壳、兼容分支或只改SQL参数冒充重构。共文件独立职责已在上表预裁决保留，禁止临时搬走。删除过程证据保留在实际操作记录，不造第二台账。规范调整是对应Owner的独立工单，不与运行源代码跨仓打包施工。

无变化的对象明确为：Website业务/三元组/两ZIP、Product `productionStep`及专业SKILL/Prompt、Browser wire与Extension、原WAL/Runtime/Forensics schema、N与claim/lease/fence、恢复裁决、Outbox和成功接收边界。无需新建抽象、服务、持久字段、队列、依赖或迁移。原source_checkpoint写者保留不增字段；只读内存参数为真实lane消费者必需，删掉便重新落回child step错误，exact来源读回为验证方法。仅允许上表已证明必要的图片身份描述内部读取方法；其固定元数据读取在G0-E2规范目标中明示，不能借名称取得父回答读取权。禁止凭E2顺带处理E1、网站claim慢或历史清理。

#### E2.4 有限分母、readback与停止

| 场景 | 权威事实→工厂行为/验收；失败与恢复Owner |
| --- | --- |
| 本次catalog父子step不同 | 固定上述原身份的只读证据作为隔离fixture输入，改进必须定位原父URL，child当前step/effect不变；旧实现必须失败。真实环境原父WAL字节保持；后续仅在用户明确运行许可下通过原Website grant验证同job新合法attempt，不能手签grant、清账或造替代job |
| step相同、全新live及同attempt cache | 原采用ref/observation/exact WAL一致；来源解析与导航均通过，cache读取本身不新增页面动作；不额外索要source grant |
| 完成attempt与来源attempt不同、重复source复用 | 完成结果绑定原采用checkpoint、既有accepted handoff及精确旧effect；读原attempt，不复制CONFIRMED；缺grant/错误seal/环/断链拒绝。一次拒绝只保原typed事实，是否重领由Website当前授权决定 |
| 多轮SEO父、图片descriptor/original | 全部采用身份按E2.2核验；文本不读正文，图片只读descriptor。给Forensics测试端口设精确读取断言：父文本observed-response读取=0、父original读取=0，仅批准source-binding键可读；旧完整verifier/图片reader会使反例失败。合法多effect同URL通过、不同URL拒绝；坏/缺descriptor、错original ref、错conversation/user hash均拒绝。单语或catalog文本父不触发Forensics读取；丢图片源或当前step优先的错误实现必须失败 |
| 缺/坏采用证据、错父/attempt/revision/step/call/Child/hash | 在任何目标取得和Provider输入前拒绝；artifact正文/URL不交Runtime。既有结果优先原Outbox交付；不伪造缺失证据，不以fallback猜来源 |
| 重复/多义/未决effect | 同值同effect证据可去重；矛盾证据、选定来源非CONFIRMED、多个不同URL、缺locator拒绝；未采用历史或兄弟job未决不形成全局门，不得用原SQL缺失门宽松化取得通过 |
| 取消、父job清除、Store/WAL/Forensics读失败、重启 | 每次调用前后保持当前lease/fence/abort与原精确授权；原Owner删除已完成则缺失拒绝，读取错误不折叠成missing。进程内来源不恢复成新表，重启只重读原事实；查询失败零新输入，不自动恢复旧实现或重发旧effect |
| 最终交付 | AGENT终点为原完整结果成功接收回执→local completed；Website另核相应locale/current或文章admission与实际显示。Website独立验收不是AGENT完成门。E2成功不冒称E1全部同URL、八步或整案RELEASE已证明 |

隔离验证先沿原acceptance复现本反例及上表每个非等价边界，再运行原architecture/Runtime/GPT/Browser普通验收；唯一正式质量入口仍是`npm run quality:check`。全部43 route由现有Catalog+route projection与反向createExecution/acquire调用交叉发现；仅article translation和static catalog的provider_continuation有父来源，另外41条路由的fresh/review/其它关系不增加来源要求，13个Plugin不新增可执行业务路径。不能抽一个SEO正例替代共享回归。

实际准备/发送、安装和Dynamic Proof另按届时明确授权执行；本轮文档审查不运行它们。功能验收必须同时证明原安全边界保持与上述真实失败被消除；施工纪律另核删除前裁决、即时缺席及非复制新建。任一项缺失分别报告未满足重构要求/无法核实重构纪律或未取得功能证据，不用最终diff、局部测试或READY替代。失败保原任务/WAL/artifact/Outbox，由原Owner回接，未授权回退为“无”。

本轮技术设计经三轮主审后交只读子智能体独立核对法案/蓝图及闭环Skill；审查只能放行方案内容，不能替用户批准G0-E2或生产施工。E1原独立未决不纳入本轮“已闭合”声明；全案状态继续设计阻断。最终分别回报：方案实际修订、规范与代码零修改、审计发现及处理、待批准前置和未运行证据。

每处最终获准退休的片区须有删除前独立保留裁决、删除即时缺席证据及按合同新建后的consumer读回；无必要退休对象就直接保留，不能删除成熟模块凑过程。失败只保原typed事实、已有结果和WAL/Outbox，由Website裁决下一授权；无清账、重建任务、越权fresh或自动回退。AGENT交付须区分零修改复用、最小局部修改、确实重建、删除及未完成，不把四层全写“已重构”。

#### E2.5 本次本地建设与实测

依授权人11月1日最新顺序，WO-E2先完成本地代码建设。R/G/B退休片区已物理删除、紧随核验六处旧符号/参数缺席，再按E2.2建设；Runtime旧`inspectContinuation`也单独删除、核验缺席后重建。其它质检消费者属于原位局部修订。原`recordSourceCheckpoint`、完整文本/图片reader、完整`verifySourceCheckpointArtifact`及lane的pump/nextWaiter/scheduleWake/expireQueuedWaiters/withLifecycle九项职责与HEAD正文逐字节相同；Product、Extension、exact Store reader、source settlement、Outbox无差异。未新增生产文件、持久结构或wire版本。

施工核对纠正了两处实现假设：Forensics `integrityHash`是StoredArtifact envelope身份，不能与descriptor原始字节hash互代；来源call ID必须使用已采用的原值，不能硬编码`turn-submit`。真实Forensics反例保留envelope hash与raw digest不等，并限制新方法只能读取批准的source-binding键；完整父文本与原图读取为零。

已完成两遍主代码自检及只读建设审查。当前本地原生普通验证：typecheck、agent-production-runtime、gpt、architecture-boundary、capability-governance，以及Browser effect recovery、lane FIFO、rule mutants均通过；受影响Runtime、GPT、Browser inspector均验证正常链及破坏反例，变更源码原生结构规则23文件无finding。新增验收覆盖三种采用来源（两文本与图片descriptor/original）、跨attempt重复采用、错误seal与缺grant、字段错配/缺证据/URL冲突、取消和父清除期间的失败关闭，另保留全部43路由注册与原消费者回归。独立审查者亲自复跑typecheck、Runtime recovery-contract、GPT metadata、Browser recovery/FIFO/mutants并放行本地建设；过程证据按本聊天真实工具记录核阅，不由最终diff冒充时序。

原事故另以两个SQLite只读连接及query_only实测新Runtime来源解析→原Browser exact reader→lane原会话比较：父结果绑定成立、实际采用来源1项、source step不同于child step、旧selector命中0、新链取得可信canonical locator、父内容读取0、Provider输入增量0，生产数据零修改。未输出URL或私有密钥，未取得Target或发送Provider输入。此证据证明该事故的来源定位，不证明E1、真实新发送、整条八步或生产发布。

2026-11-01授权人明确放开Website法案迭代后，已定点对齐Website待提交V42的父来源片段及SYSTEM/AI-ACCEPTANCE施工图；AGENT对应Runtime-001-V81、Architecture-001-V19、Capability-001-V20、GPT-001-V68、Browser-003-V49/006-V48及三份施工图同步，机器合同仅更新lawId引用，不改wire/版本。主Codex规范第一遍按条款差分核唯一Owner/证据分母/冻结保护，第二遍逆向核真实代码/采用证明/图片metadata-only/原exact reader/全来源同URL及跨仓无载荷差额；发现并修正Runtime同job例外与Architecture.summary歧义，均限于本单元数据定位。两遍规范审计结束，不以自评比例或局部测试代替原生裁决。正式CHANGE、commit/两次push与READY尚未完成。网站已有重叠改动的保护及G0-E2双仓规范一致仍须在正式质量链前闭合；局部实测和独立建设审查均不替代原生质量裁决。

### WO-3：Website阶段表达与交付只读投影（W public-knowledge-content）

做：控制室明确“中文已入库”与“目标语交付n/5”，不把中文completed_count或六语齐备单独称作同URL全流程完成。保留：workOrderCompletionCountsSql、completed/unfinished分栏SQL、精确清除计数/闭包及全部write/read权限；删除会导致清除已入库成果，禁止变更这些语义。
删除/重建：只删旧模糊“已完成”的页面表达片区，以及只显示中文结果而省略目标语状态的结果投影片区；不是删除既有计数函数。落点control-room-projection.ts、row-mappers.ts、control-contracts.ts、SeoControlRoomOperationsPanels.tsx、SeoControlRoomDashboard.tsx、apps/web/app/admin/seo-control-room/seo-control-room-api.ts、page.tsx及原hook消费点、content/zh-CN/locales/admin-runtime.messages.json直接文案。
输入：当前run页至多25个精确article/version/hash，加latest_result的一篇，去重后每次至多26篇；覆盖中文admitted后已退出在途页、仍在翻译的最近结果。用原同一个PostgreSQL client的一次有界批量查询，最多5个目标语/文，无正文批量读取、无N+1。只有completed job、canonical/policy绑定、runtime business consumption、artifact/binding、released publication及exact parent同时成立才计入交付前缀；单有published行不足。缺事实显示unknown/真实原因，不伪报0或完成。
输出：现有snapshot中每run的ordered locale delivery只读投影，v6→v7同仓单次切换；不新增聚合“全流程完成”持久状态、表、计时器、第二sender或Browser URL字段。每日target及completed_count继续中文口径，不等待五语影响中文admission/publication。
施工：取得重叠用户文件许可→合同→旧表达/局部投影删除缺席核验→新投影/页面→producer/API/hook同候选验证。当前seo-control-room-api.ts与SSR page.tsx使用type cast，没有现成的snapshot运行时parser；只在这两个实际入口核schema_version和本次必需的locale delivery字段，非法/缺失按现有read_failure关闭manage并显示unknown；未知附加字段只投影本页已声明消费字段，不自建通用parser框架。同步docs/specs/public-knowledge/PUBLIC-KNOWLEDGE-CONTROL-ROOM-TARGET-CONTRACT.md原production-reference的v6说明，不能把它升为第二机器真相。未投产、真实待接纳、读回失败unknown明确区分，不能混成0/5。T7/T8及删除保护回归。失败不动已发布正文，不造新状态，不自动回退。

### WO-4：复用原有验收与证据闭合（各Owner，已有保护足够就不改）

先审检查对象必要性，再改生产。保留AGENT原Product、Browser、GPT和Runtime验收及Website原串行/原子接纳测试；退出旧“只有三步/HK即足够”的终验解释，增强只由mock常量返回URL的不足保护。Website专业Skill仅在§2两份已证失配reference内定点对齐原图几何与业务恢复归属，不修改AGENT专业Skill或机制。无法证明冗余的有效保护不删。
先核A现有public-knowledge-article-pipeline.acceptance.ts、localization-production.acceptance.ts及fixtures、gpt-production-artifact-recovery.acceptance-support.ts、local-browser-provider-effect-recovery.acceptance.ts、local-browser-rule-mutants.acceptance.ts已保护什么；只对E1/E2确认缺少的反例原位增强，不把这些测试路径全部列成必改。W复用tests/public-knowledge-content/public-knowledge-content.test.ts、tests/localization/localization-terminal.test.ts和原Owner检查。每个新例须击穿T表明确错误实现；等价保护直接保留，不新增入口/样本体系。
真实证明复用A原gpt.real-proof/local-browser.real-proof与W原Dynamic Proof声明、profile、collectors、原逐法报告。当前W public-knowledge声明偏重公开阅读/搜索，不能冒称已覆盖八步；在原Owner声明与现役active evidenceModes补足所需Browser/Provider/存储、service/database分母，不加第二dynamic runner或总报告。先核原proof budgets是否容纳现役八步及两领域实际资格；足够就原样保留，确有不足才在原Owner配置定点调整，不能用搜索预算假冒八步覆盖，也不发明无界超时。
删除反事实：既有mock测试不能证明导航竞态/真实八步；增加这些断言必要。第二CI、URL表、截图替原图、图片固定尺寸检查、八步总状态库、强制重译历史、常设审稿模型、人为固定文章模板均无必要，目标中删除。
输出/验收：T1—T8各原Owner原件；失败回相应Owner且重新核候选，不能调阈值、弱化检查或拿旧成功补当前。真正测试、安装和运行须另有相应授权，本轮仅完成设计。

#### E2.6 本轮原生质检慢项与生命周期（可施工）

本轮原生CHANGE已退出0。Browser组的真实子进程序列证明主要等待由原自动配对验收的真实1.5/2.5秒页面保护及有限导航用例组成，保留全部生产期限、反例、字段与证据分母，不缩短窗口、不增杀进程超时。另已证rule-mutants的111条固定变异在全通过路径执行224次inspect；opaque-proof-inspection.ts的authenticatedMediaDispatchIsExact每次新建Project解析同一固定media.ts并计算参考侧AST。该固定参考不消费candidate、TypeChecker或context；重复223次参考解析可由同次模块初始化直接承接，当前candidate树与判定不能缓存。原进程快照已见该文件执行70秒且CPU72.67秒，精确全程未知；改后实测与该下界比较，只报告可证收益，不外推整个READY提速。

Q-PERF-A（local-browser-session）：固定media.ts参考字面数据是原冻结保护的必要唯一fixture，逐字节保留，不能删除或复制第二份；删除并立即核验原authenticatedMediaDispatchIsExact逐调用初始化/比较执行片区缺席，再在原文件构造一次固定参考dispatch及三个method的(name,AST字符串)。新现役比较函数每次从当前runtime/authority原符号重取节点、重算actual AST并与固定参考比较，仍拒绝全部原mutants和通过原正例；不缓存candidate、law、findings、Project或verdict，不建通用缓存。原其它inspector与AST encoder保留，删除会丢原错误保护；只在原rule-mutants完成批次后记录真实计数/elapsed，并在原auto-pairing各实际验收组完成后输出阶段进度，不用心跳。

Q-PERF-B（code-purity）：governance.ts::run的spawnSync整组缓冲与quality-process-execution.ts的完整捕获使真实子进展不可见。删除旧run执行片区及executeCaptured实现并立即核缺席；在原Owner按原execFile完成回调重建单次完整捕获，保留64MiB上限、可选原timeout、status/signal/stdout/stderr、异常分类及实际退出后才完成的语义。仅增加可选streamOutput，默认关闭，inspector worker的JSON stdout保持原捕获消费；CHANGE/projectChecks、原acceptance文件组及quality-runner的原Exam命令开启，透传工作输出并记开始、实际callback终结及单调elapsed，不重放已流出的副本、不建runner/日志表/第二报告。取消、buffer失败、signal与非零继续失败，不写成功假终态。原runAcceptanceFiles、候选检查、proof绑定/报告与并发均保留；原quality-execution测试增强实际子进程输出在结束前可见且完整捕获一致、非零及signal保持，不新增测试文件。

原生CHANGE之后补齐quality-contract.test.ts中8处读取真实registry/producer/worker的旧law版本引用；code-purity-governance中的独立synthetic finding标签没有active lookup，保留。原quality-execution两处clone-HEAD后叠加当前检查器的隔离fixture须同时带入其现役法案/规格：Product authority反例复制当前功能法案，missing-governance-tests反例复制当前docs/specs，与原已复制的法案/蓝图/registry组成同候选；不弱化原失败原因及输出断言。上述为本单规范引用同步遗漏，不改变测试义务。quality-contract同一既有DISPATCHED链用例还直接要求serveAcquire调用已退休readUniqueConfirmedConversationUrl；原生CHANGE已证该断言失真，零改生产，替换为现役readParentConversationUrl→逐parentSources原readSourceConfirmedProviderEffect(source)的AST交接证明，保留原单Target调用及全部其它断言。该同根消费者在首轮完整治理读取前未列入，按本单Q片区补齐；已知失败候选的剩余本地CHANGE安全取消并核进程树全部退出，取消不作PASS，新候选从CHANGE重走。Runtime蓝图泛称错误step只澄清为篡改已采纳来源step。

主Codex按真实消费者、错误/取消保护及候选/证据反向三轮核对本段；CI专项只读技术审查提供固定参考独立性与消费者证据，由主Codex施工，结束后两遍自检并由原审查者只复核受影响项。先确认旧检查自然结束再编辑；局部验证通过后立即返回CHANGE→提交首推→READY→二推。新增实际独立违规再沿原CI司法合同，不把性能工程变成全仓改造或减少检查。吞吐只优化已证固定参考重复计算；其余真实保护等待尚无安全压缩证据，不宣称已优化。

#### E2.7 READY前的受权阻塞工单清除（可施工）

授权人要求N=6的阻塞旧工单先清除再READY，已确认五张指定固定文案工单的不可逆删除；随后明确择吉也须清除，并专项批准仅给现有production系统管理员的commercial_order_read、commercial_order_recovery追加zeji域。第一断裂是原订单入口按产品域精确验权，而原scripts/platform-admin.ts两项及实际grant均只有bazi/qimen/naming/hehun；原接口403不是清图或AGENT故障。Website现役Commercial-008-V10与Localization-020-V42已允许各自原窄清除，账户能力隔离及择吉真实付款义务不变，无须修改法案/施工图。主Codex先按原权限→清图→付款保护正向核对，再从全部管理消费者及system购买拒绝逆向核对两遍，方可施工。

唯一代码片区为Website scripts/platform-admin.ts中的两个capability tuple：删除原两条scope声明并即时核缺席，再按现役管理合同重建为各自[...domainScope,"zeji"]。共用domainScope、其余能力、账户/凭据、原grantCapability、sync-capabilities、session/step-up/CSRF、清图/对象I/O、付款及研究准入均直接复用；删除这些独立职责会损失原精确鉴权、幂等及资产保护，故保留且不复制。仅分别执行原sync-capabilities的两个精确--capability选择，绑定原production数据库和principal；禁止无选择全量同步、bootstrap、rotate、扩其它系统能力、直接改job或本地WAL/Outbox。先验证两条原entitlement/grant身份、生产环境、scope与hash一致，其它能力不变，并证明这两项管理权限不构成择吉system/zero资金或研究资格。

操作只用用户指定右侧浏览器及原登录/管理员入口。每张固定单重新取得完整preview集合/hash；等待期间已完成并被消费的三张7d500/8d3c/fcb754产生后继，不再属于阻塞清除分母，保留原成果及后继，不扩大此前只有自身的删除集合。仍阻塞的74f9、710093及择吉按各原Owner资格清除；择吉仅终止旧需求，不授权resume_after_clear、retry或新generation。若现有UI只能清后重派、原preview受保护或任何权限/来源门拒绝，停止该动作，不编造session、改账、绕过门或替换任务。未知请求先同幂等身份及原audit读回，不重放。

验收分别核Website精确任务缺席、原clear_request_ref/graph_hash/对象inventory对应的对象缺席确认audit、付款/权益/冻结来源保护，以及AGENT在役worker从精确job-not-found触发的原Browser释放、WAL/Forensics/目录/Store/Outbox逐项缺席；单个200或object_cleanup_status不代替完整清除。仅代码声明和已证明管理边界作必要定向验证，不修无关旧断言；重要步骤由既有只读审查者复核本节及实际差异，未放行不收口。本段不替代原质量入口；AGENT候选因方案变化从CHANGE重新提交首推，所有仍阻塞目标清除前不调用READY，随后完整READY、适用§79及二推。缺登录、域权限、纯清除入口或确定读回时保留具体阻断；不借清理变更N、生产节拍或扩成网站重构。

## 7. 分层验证与正式冻结

| 验收 | 必须区分的正确/错误实现及原件 |
| --- | --- |
| T1 正常链 | bazi、qimen各一篇新的合法研究proceed样本，研究/中文/原图/五语八步顺序；三轮单session，五语逐项admission后自动继续；初始研究只fresh一次，正常每步各一个submit；每语直接同中文源 |
| T2 导航与原子输入 | acquisition后、准备期间、最终发送前分别A→B；含同loader SPA、同站点其它/c/、首页、异Origin、过期Document/fence、缺约束；输入前注入错误会话发送增量0；更改guard为仅合法Origin必须使反例失败。真实生产不做破坏性注入，使用现有隔离Extension/Browser验收 |
| T3 locator与已发生事实 | 发送已CONFIRMED但定位B，不能以B建新原U、不能清掉原CONFIRMED或重发；发送后导航/断线未知要保真实物理计数；正常首次首页→/c/及query/fragment清洗仍通过 |
| T4 恢复/revision | 当前Tab/进程丢失回U，缓存/source零页面归还；研究恢复后文章、文章恢复后图片；research/article复用而图片重做后HK接续、calls=[]包复用后HK、单语复用后下一语，以及固定catalog同cohort后继共用定位，都按结果实际采用effect读原WAL；首研究/文章/图片/每语拒绝后的合法revision仍U；无U拒绝fresh但保原需求有界再检查；有grant无URL不等于输入许可 |
| T5 身份与顺序 | parent缺失/错hash/未接纳/跨article/version/跳语或多义WAL零新task或零输入；并发sender不重建；五语protected/source/引用不漂移；existing tests复用 |
| T6 共享回归 | 从13 Plugin/43 route现役注册发现全部成员，保持非SEO fresh、报告/全部review边界、catalog同cohort链、每job独占Target、FIFO/节拍、ack紧急路径、真实effect去重及原结果优先交付；不抽样证明全部 |
| T7 Website终点 | 同一文章六种语言各自artifact/result/domain receipt/binding/payload/released/readback；实际公开正文、引用、同源hero原始字节及六语切换/hreflang/sitemap；中文不等待五语；连接器故障不改变公开 |
| T8 表达/保护 | 中文已入库但0—4语、5语齐备、读取unknown、withdrawn/version/policy错配；绝不误报同URL全流程完成；completed_count及删除已入库闭包语义不变，后台权限/刷新/直接GET沿原入口回归 |

真实同URL证据只能由Browser Owner通过原WAL locator受权读回逐个比较；返回原effect/command/locator receipt引用与all_equal结果供原动态断言，不导出原URL或另造URL hash身份，不用locatorHash相等代替URL相等（它含轮次字段）。八个当前成功结果的effect及其先前风险输入均须追溯，旧revision地址不等也不能略掉。Website分别以原article/version/hash/locale读取六语事实；两侧用task/result身份关联，不让Runtime/Website直接读Browser私有SQLite。

隔离Exam覆盖全部有限异常；真实运行只执行合法操作，至少实证正常两领域完整八步及原授权的非破坏性恢复。无法自然取得的恢复分支应在报告中明确仅Exam已证，不冒称真实故障已观察。研究decline、无法交付或原U无法核验的样本不计成功，保留原事实；不得手工编辑选题/正文、重建替代job或擦掉失败凑成功。

质量/冻结顺序：
1. Website仅在已批独立范围施工；AGENT先完成E1/E2最小差额设计与用户专门任务安排，未完成不施工。子智能体只能只读审查；实际有退休片区才按单取得删除即时证据，全部成熟不变量保持。
2. 每仓分别跑与差异相交的普通测试及原quality:check CHANGE；若用户另行发起CI-FULL，完整遵守其现役Skill。未发起不自行把本轮改名CI-FULL。
3. 最终实现、Prompt/Skill、原合同、法案及回归保护形成同一待验版本，各仓clean commit完成原生READY。冻结保护文字可以在待验候选中声明目标义务，但未通过完整验收前不得报告“已冻结”。
4. 在明确授权的RELEASE下，对这些相同commit执行所需真实Dynamic Proof与参与仓核验，完成T1—T8及最终公开readback；证据缺失不得冻结。原生报告是唯一质量裁决，没有另一SEO PASS。
5. 原候选全部验收闭合后，依用户“测试无误后冻结”授权确认冻结；使用原法条/合同/Git和原生报告，不新增冻结服务/清单/数据库/自哈希。冻结确认不得再改变被测字节；若变更，重新绑定并取得新候选所需证据。
6. 最终回报：原生质量、真实八步、六语交付、尚未实证分支、施工纪律分别说明；以后改变该已验收冻结语义需用户明确批准对应范围，不因普通优化自动解除。

## 8. 施工/切换、失败与回报

Website snapshot v7生产/消费在同一站点版本一次切换，只读界面不接管AGENT状态。AGENT先按E1/E2取得专门任务的实际交付；没有生产差异时不安装、不改协议、不重建认证会话。确有最小代码变更时，由原Owner依据实际差异构建/隔离验收/clean commit及READY，在另获运行许可后按原发布主链替换实际受影响产物，原WAL/Forensics/Outbox保全。不预设全域停claim、扩展重装或协议切换；真正涉及native handler替换时才收束该在途handler并按原规则恢复。任一不兼容差额必须先在本方案精确闭合双方顺序与停止点，无兼容桥，不能为保持进度临时双读。

两仓task/result外部合同保持，AGENT内部协议以保留现版为优先目标；E1新Target接缝的最小合同差额仍设计阻断。若专门任务证明必须改变合同，先停止该依赖并回本唯一方案核授权、drain、版本、双方消费者及失败边界，未闭合不能启用。正常派单与历史五语欠账不作为无关部署门，历史unknown不能阻断其它合法任务；不得清WAL或重译历史凑切换。每仓状态与版本独立回报，没有跨仓cutover控制器或总verdict。
未知旧任务不转换、不删除、不重译；已接纳文章及译本原样保留。旧流程若已存在多个URL，不能归入本轮成功；既有权限/结果仍按原Owner保全。本轮不为修复历史URL造迁移或强制重跑。首次新候选输入后只按原Owner同身份向前收敛；无自动降级旧协议、旧实现覆盖或Git回退授权。需要具体回退时先列指定基线、真实effect与双方兼容性，由用户另行裁决，不把失败回退算重构成果。

施工发现新consumer/旁路、必要遗漏、unknown-field变化、共享约束语义变化或candidate实质漂移时，停止受影响动作，回补本方案及验收分母；超出授权或重叠用户改动不能安全区分则关闭对应准入。不得为了保存“可施工”删掉分母。

最终按精确对象分别汇报“真正重建、经论证保留、局部修改、删除退役、失败回退、尚未完成”。删除前保留裁决、删除即时缺席检查和新建后consumer证据缺一不可；已违规报告“未满足重构要求”，缺过程证据报告“无法核实重构纪律”。最终diff、普通测试、READY或RELEASE都不能补造中间过程。

本轮方案交付前必须依次完成三轮主审与独立只读子智能体审计；实际轮次、候选及发现处理在当前对话回传，不创建评分、台账或第二报告。关闭具体发现后才可结束方案建设；G0及相关overlay施工许可未齐不能宣布“可施工”。
