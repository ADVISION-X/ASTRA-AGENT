# SEO 文章同聊天五语翻译—完整实现方案

## 0. 本轮目标、唯一身份与准入

修订日期：2026-10-28，Asia/Dubai。状态：设计阻断，AGENT最小必要差额尚待专门任务核定及交付；Website限定范围的规范准备与续改许可保留。本版只对网站范围提供施工边界，对AGENT提供需求、事实及验收边界，不能冒称整案已可施工。

用户已确认：每篇 SEO 文章的研究 → 中文文章 → 图片 → zh-HK → zh-TW → en-US → ja-JP → ko-KR，全部在同一个 GPT canonical conversation URL 内自动接续；最终取得研究、一篇中文文章、一张真实生成图片和五份直接译自中文的译文，真实完整测试通过后冻结。正常成功路径为八个 Provider turn；合法结果修订可能增加当前步骤的 turn，不能伪称仍只有八次输入。

本轮仅更新这份既有方案及唯一基础设施需求工单的本条，不施工、不改法、不启动服务、不发Provider输入、不删建生产工单、不提交、不推送、不发布、不宣布已经冻结。本执行连续性需求沿既有唯一方案路径维护，文档位置不授予AGENT全链业务协调权；Browser、GPT、Product、Website localization、public-knowledge、ai-acceptance各保原原子责任，不设全链运行Owner、第二方案或总verdict。

唯一方案仍为本文件。旧《SEO原会话URL连续-完整实现方案.md》只作为 f2dbc3d4c 已落地恢复接缝的历史依据，不再承担本轮施工授权或验收分母；其“HK 交接即可、不要求五语完成”范围由本方案替代。旧版本本文件中同时创建五语、每语 fresh、需新建 provider_continuation 的调查与工单已过时，全部退出当前设计，不得重复施工。历史权限不能替代本轮权限。

G0按各仓Owner分别闭合。本聊天2026-10-28用户先答复“批准定点修订，AGENT任务由我安排”及“允许保留原差异并按限定范围追加、续改”，随后要求按AGENT执行工厂、接近稳定态、尽量少动的原则迭代。本次收窄优先于前版范围：前两项许可不撤回，但不再解释成Browser/GPT/Product/Runtime四层必须修改或一组法条必须升版。AGENT专门任务仍由用户安排，当前聊天没有其基础设施施工权。
1. Website只在原授权下决定业务任务、材料、逐语派单、接纳/发布、恢复授权及完成表达；相关规范只改真实不吻合的直接条款。五份栏目蓝图和冻结说明书零修改。
2. AGENT侧仅交付§6的两项已证执行差额及T1—T6验收；具体内部修改范围须由专门任务先证明最小必要性，现有能力可完整承接就直接保留。Website跨任务派单/接纳顺序、是否重做与最终业务完成不下放工厂；Product内部原三轮静态Flow及专业Skill/Prompt职责继续按AGENT现役法案归属，内容语义由模型负责。
3. Website原控制室的阶段名称与逐语交付只读投影按WO-3实施，原入库、派单、中文completed_count、清除保护与权限继续保留；该投影不成为AGENT执行前置。
基础设施交接沿Website既有 docs/项目方案/网站侧迭代AGENT侧需求工单.md 的WA-20261028-01原条目原位收窄；不新增需求编号或第二方案。本次只替换该条，条目前原40488字节保留。Website施工落点的已有overlay按已批限定范围续改，不覆盖其余用户工作；其它未列目标不取得续改许可。登记不表示AGENT已交付。
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

| 维度 | 当前权威与裁决 |
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
| Website | /Users/nexgen/Documents/xuanxue-web；main；1ac2a13b6ab1a99298ffc180db34d41ecea7f55d；origin/main | 五份源头、功能法案、SYSTEM/AI-ACCEPTANCE、article-localization-owner.ts、翻译供材/消费和其它任务有用户overlay；按已批WO-3及本条工单范围保留原差异续改，其余只读，不取得覆盖许可 |
| AGENT | /Users/nexgen/Documents/AGENT；main；234aedc79254bb61f6401ac4b73c768da48172b3；origin/main | 原有 src/plugins/zeji-personal-selection/SKILL.md 用户差异保留；本方案改写前 clean |

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
| A src/lib/local-runtime/production/executor.ts/readContinuationParent、dispatchPlugin；executor-source-checkpoint.ts；store-source-readback.ts/readSourceReadbackObservations | 核completed父结果ref/hash及source observation已存在，直接保留；current_attempt_id等同原effect来源的选择会漏合法source复用，属E2。仅需修该只读选择接缝，不改业务parent或新建来源API/台账。T4/T5/T6 |
| A src/capabilities/gpt/production-browser-lifecycle.ts/browserFor、recordSettledResult、selectSettledConversation；production-call-preparation.ts/acquireProductionBrowserCall | 恢复后原URL接回、缓存/来源、分类、ack跳过选择及finally均保留；E1只核现有精确选择是否在live lease下一turn前真实执行，不预定重建GPT生命周期。T2/T3/T4 |
| A src/lib/browser/infrastructure/browser-lane-coordinator.ts/serveAcquire；exact-target/browser-mutation-evidence.ts/readUniqueConfirmedConversationUrl、readSourceConfirmedProviderEffect；browser-command-actor.ts/readSubmittedConversationUrl；browser-submitted-conversation-locator.ts/bindSubmittedConversationLocator | 原精确WAL reader、一次locator绑定直接保留；E2核完成结果采用的真实effect，E1核locator不把B当U。仅对不可替代接缝修复，不加URL表、不复制WAL，不改原terminal。T2/T3/T4/T5 |
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

H5 中文入库 → 五语：原Website中文包原子admit/release，逐语自动sender及业务exact parent unchanged。AGENT先核该父job/result ref/hash与本地completed结果精确一致，再从该完成attempt既有source_checkpoint observations中，选其artifact_ref确实属于该结果evidence_refs的effect来源；Browser按当前product step、call/Child核原effect，取得该来源行唯一locator。sourceAttemptId是实际产生effect的attempt，可能不同于完成结果的attempt；不能复制WAL到后者或改写Website parent。正常live/cache/source都已由recordSettledCheckpoint→recordSourceCheckpoint→现有production_attempt_handoffs记录来源，无需新表。

原完成结果的evidence_refs、source_checkpoint observation、原effect proof/hash及Browser的readSourceConfirmedProviderEffect均已存在，作为唯一来源直接复用。自身live/cache不另要求source grant；只有跨attempt复用才核Website已签并被本完成attempt采用的精确来源。Runtime不接触URL或父回答，不排步骤；Browser只从经核实的结果采用关系中确定当前step的唯一原effect/locator。旧current-attempt假设对应的最小只读选择接缝是E2，不预设readAcceptedResultEffectCandidates新API或固定候选carrier集合，不复制WAL、不新建来源ledger、不回填缺失证据；来源不等/多义/缺失沿原typed失败及有限再查。固定catalog是同一共享选择的真实消费者，必须验证不回归，但不新增catalog改造目标。翻译仍直接消费同一中文定稿、原两ZIP及完整政策，前语未接纳则下一语任务增量零，各语按原事务独立公开。
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
| E2 合法父结果实际来源定位 | executor.ts/readContinuationParent及dispatchPlugin把完成父结果的current_attempt_id直接当本步WAL来源，会漏合法source复用。交付：精确Website父结果ref/hash不变，按该完成结果实际采用的原effect找唯一原会话，不要求本完成attempt复制一条CONFIRMED | 原source_checkpoint/evidence_refs、readSourceReadbackObservations、readSourceConfirmedProviderEffect及已签来源证明直接复用。自身live/cache不另需source grant，跨attempt复用才核已签合法来源。T4/T5/T6覆盖旧article/单语/整包复用后后继，以及共享固定catalog后继；不是catalog改造目标。无新来源API、ledger、镜像WAL、业务恢复或Website URL字段 |

专门任务接单顺序固定：重绑当前法案/代码/用户差异→复用现役公开链验证E1/E2→对确实不能承接的每处最小差额，先在本唯一方案E项内闭合精确符号、Owner、保留/删除、承载余量、原子handoff及验收→独立只读审查后在用户安排范围内施工。不得另建竞争方案、先改代码再补必要性，或因曾列到四层就逐层重构。本版不预批具体生产文件diff；尚未核定处明确保持设计阻断，不冒称AGENT已可施工。

每处最终获准退休的片区须有删除前独立保留裁决、删除即时缺席证据及按合同新建后的consumer读回；无必要退休对象就直接保留，不能删除成熟模块凑过程。失败只保原typed事实、已有结果和WAL/Outbox，由Website裁决下一授权；无清账、重建任务、越权fresh或自动回退。AGENT交付须区分零修改复用、最小局部修改、确实重建、删除及未完成，不把四层全写“已重构”。

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
