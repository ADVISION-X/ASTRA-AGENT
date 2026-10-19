# 网站侧—AGENT侧对接完整实现方案

方案状态：**可施工**。W-A0/W-W0已取得2026-10-19对应规范授权，规范层已先行对齐；主Codex两轮自检核源头/法案/施工图、完整消费者和既有冻结边界，当前规范差异已闭合。生产实现与原生质量尚未完成，不能以本状态宣称READY或运行交付。需求与方案维护 Owner：ADVISION-X/AGENT。日期：2026-10-19，Asia/Dubai。

授权人已于2026-10-19明确批准按本方案施工，范围包括本方案列明的法案、施工图、代码、质检和数据库对象，并要求local main、规范先行及CI-FULL至READY。四份已建栏目冻结蓝图为业务源头，均不修改；择日仍排除。W-A0/W-W0的具体规范修订取得本轮授权，须先完成规范对齐和主Codex两遍自检才进入生产源码。方案、代码、两仓质量、运行切换和客户交付分别成立；未授权生产部署或真实Provider研究，不因数据库范围授权而增加本方案原本不需要的数据库操作。

## 1. 目标、源头和停止边界

目标是使网站当前正式业务经原唯一主链交给 AGENT，AI 实际取得完整获准材料，原始回答无损接收，原领域接受并完成对应交付。9 个专业 AI 产品以客户可读、可下载的同身份 PDF 为业务终点；报告翻译交付该版本的译本 PDF；文章及其翻译以对应语言正式可见为终点；固定文案以当前来源资格下逐字段接纳及实际页面读取为终点；付款截图仅完成观察与原付款 Owner 的处置，不把观察当到账。

用户本轮明确：良辰吉日尚未建设，**排除其建设、注册、合同升版与原方案更新**，不加入择日路由。其蓝图已经阅读，用于核清与八字事实、BZ05、完整资料及交付的边界，不把待建择日作为现有业务的准入条件。

业务唯一来源是 Website `docs/governance/` 下五份冻结边界蓝图的正文与全部附录：

| 原件 | 当前版本 | 本轮适用条款与裁决 |
|---|---|---|
| 八字栏目冻结边界蓝图.md | 1.2 | 第8—11、19—29、31—36条：基础事实独立；命盘 PDF 可选；完整事实和真实条件直接可读；BZ05 全盘不要求专项；专项/追问绑定精确来源；研究报告及译本仅 PDF 对外。 |
| 合婚栏目冻结边界蓝图.md | 1.3 | 第6—23、24—40、42—47条及附录一/三：同账号两不同人物、先独立交付两份 BZ05；HH02 默认完整二十议题，非伪造用户问题；HH03 原根至直接父直系链；隐私与合法摘引分别处理。 |
| 奇门遁甲栏目冻结边界蓝图.md | 1.2 | 第5—13、21—36、37—42条及附录：一事原问题和冻结时刻、完整同源盘；AI 不重起局、不用旧矩阵/数量冒充实际事实和研究；原题与指定父、原典上下文、同源报告 PDF。其23点日界不得移入八字。 |
| 起名栏目冻结边界蓝图.md | 1.8 | 第4、9—19、21—29、30—33条及附录：人物命名先本人合格正式 BZ05，商业独立非八字；按需求选合格典籍；完整需求和上游；标准至少20个有效候选、全量排序、前5深入比较、首选和两个不同重点备选；特殊承诺只能来自购买前明确确认；原名字节保持。 |
| 良辰吉日栏目冻结边界蓝图.md | 1.1 | 已完整阅读；依本轮用户答复排除建设，不借它新增第41—43条路由、事实引擎、书籍或交付要求。 |

蓝图决定业务目标，冻结《法案系统建设说明书》决定治理方式和分别授权。源头冻结本身不等于下游改法或施工许可；发现冲突时列出下游修订对象，不反改蓝图、不用测试通过解释源头。五份蓝图、两仓母本均不修改。

2026-10-19施工中源头刷新：四份已建蓝图仅定点增订压缩包与配套 Skill、数量不固定及同合同版本的读取义务。主Codex已先暂停依赖施工，逐条回读新增正文并两次核对：第一遍源头→Runtime003-V47/现V6图/公开21版资料合同；第二遍反向核四部分事实、精确父、人物/商业分权及原典、PDF权益没有减损。当前每route的包数仍由其公开材料合同确定，不将本轮一包/两包提升为永久业务前置；本轮无新增材料角色、Reader或运行机制。该源头由其他授权任务维护，本任务不提交其dirty。格式合法与资料送达仍不等于AI实际完整阅读，V2/V3证据边界不变。

### 1.1 有限业务分母

以 Website 当前唯一 route provider、AGENT 实际 Catalog、网站 dispatcher/consumer 三个不同发现来源交叉核验，纳入 **12 Plugins、14 primary、26 review，共40路由**。不是按预定改动文件倒推分母。

9 个专业 primary：BZ05、BZ03、BZ04、QM03、QM04、HH02、HH03、人物命名、商业命名。另5个 primary：报告翻译、文章翻译、固定文案、公开知识文章、付款观察。除固定文案外13个 primary 各有 accuracy_challenge 与 quality_reflection；其中包含商业命名新归属的两条复核，不能漏掉付款复核。

不重建历法、命盘、商业购买、权益、PDF 引擎、书籍准入、V6、Browser/WAL、GPT Child、Outbox、恢复、日志、启动或权限系统。调查仍沿其真实交接抵达业务终点；排除新增设计的依据是这些边界的输入身份、权限、状态和副作用语义保持原合同，不能只以“不修改”停止核查。

## 2. 候选、事实等级与连续性

### 2.1 当前来源绑定

| 仓库 | realpath、分支、HEAD、tracking |
|---|---|
| AGENT | `/Users/nexgen/Documents/AGENT`，main，`9421b415416331fd1be7c9c9b23bace025a4b79d`，origin/main同HEAD；写方案前 clean。 |
| Website | `/Users/nexgen/Documents/xuanxue-web`，main，`de845421e0fa2ec03ec7d2775d2193554a1a8001`，origin/main同HEAD；有他人工作树改动。 |

source candidate 使用上述原生 commit、本文精确路径及实际 dirty overlay 绑定，不创建联合 candidate、台账或第二证明包。方案自身不进入 source 绑定；文档 hash 在完成读取时另行回报，不把自身 hash 写入本文形成循环。

本轮读到的 Website 他人修改包括：messages.json及其zh-CN runtime投影、全系统本地化方案、法案执法系统方案、package.json、target-language-review-contract.ts、project-check-runner.ts、run-governance-tests.ts、execute-command.ts、run-exam.ts、Hehun PDF renderer、Qimen professional-chart-html、协纪原书加工记录，以及 bazi-product-boundary-enforcement、governance-ordinary、hehun-full-static、quality-contract 测试；另有 resource-pool.ts、run-material-tests.ts、shard-registration.ts 未跟踪。均不覆盖、提交、恢复、暂存、移动或删除。本轮只写本文。

关键来源 SHA-256（仅本方案事实定位，非第二质量候选）：

| 仓库/原件 | SHA-256 |
|---|---|
| Website/八字冻结蓝图 | 018dfcde7ac22382b6569f03fb9de8c04b4ad7efea457427f34921233607c716 |
| Website/合婚冻结蓝图 | d020e7c51942585a85a963e15b2debecc1b61b9f1ed92172b4c4211a55ac4956 |
| Website/奇门冻结蓝图 | cc4e73b718a3967be53163867b8c120d0dc5b7c9edd45d8d14dde3ca9cca2488 |
| Website/起名冻结蓝图 | dab44e587eca166a5db740df8414438f6fe02ce1fd565f4bff6353b2729ac7f0 |
| Website/良辰吉日冻结蓝图 | e21104d0ee5ef4147b2607dea35418edd511f76a2deb65a1d4ac49b865a123f3 |
| Website/功能法案.md | 7aad0e0c89e6d036ebc4db571ab58acc996afc4de7d557ccc62448479e16da3d |
| Website/agent-task/website-agent-route-policies.v1.json | 0610dd646d881a18d71e933cb7d9b152fffec34cae13d9616773a9400714d688 |
| AGENT/功能法案.md | 47e5e7e1280a87d3c81ee4771d80ea8da800d9f19cc8b9f46019ecf0ea7d52b2 |
| AGENT/WEBSITE-AGENT-V6-BLUEPRINT.md | 597f36833031f0e53ce26f72f84188a03e13841f11bcda1784f782190778b807 |
| AGENT/production/website-agent-route-policies.v1.json | ec7183932b900e68c49de3e6994b7073f286b073731accece96554063aecd71c |

上表 agent-task 全路径为 Website `packages/ai-contracts/src/agent-task/`，production 为 AGENT `src/lib/local-runtime/production/`；法案均在 `.github/instructions/agent-rules/`，AGENT施工图在 `docs/blueprints/xuanxue-ai-production/`。

同本轮读取相关的 Website dirty 原件：target-language-review-contract.ts=`4344376ce343d5e8b5e3e5632413b5934af07eb8429e4ccdae5c4b2eec92d915`；Hehun renderer=`06e086225a48782aeed5ca2ac7ac328dc5bbaaed35bcedcbfbb19e3bec85572a`；Qimen professional-chart-html=`d577283a8cec56b6bf39a09cd20b848c548634d098547bbbc645baef811701c2`；全系统本地化方案=`f7fcd2b8126080652f2ce10a7ce0b857397790c376f8c63f4a171044613a8d7d`。执行时漂移只重开受影响调查，不清理他人工作。

### 2.2 已证事实与未证边界

已静态逐项比较两份 route JSON：Website task-result **21/40 routes/43 parameter types/40 result contracts**；AGENT **18/40/48/40**。37个同名路由中31行完整相同，6个 primary 有差异；另有旧联合起名3路由退出、新商业起名3路由进入。相同路由数不是兼容证明。task/result envelope仍1，V6 control45，Route Capability provider/dependency4，均无本轮改变依据。

已执行一次无服务、无数据库、无Provider的纯模块核对：把AGENT实际agentRouteCapabilityManifest交Website实际assertAgentRouteCapabilityManifestV1，返回 **AGENT_CAPABILITY_ROUTE_INVALID**。该调用证实当前源码清单不兼容；它不是治理PASS，也不证明当前线上版本或生产事故比例。Website v6-contract.ts#assertWorkerRuntimeAttestationV6及v6-http-routes.ts的heartbeat入口真实消费该校验器，故旧起名身份可使完整能力证明被拒，不能仅描述为一张起名工单失效。

未取得：当前部署commit、真实在途/付款/未决WAL数量、新9产品实际模型完整读取、最终PDF下载及本轮质量结果。它们进入施工/运行切换验收，不写成既有成功。决定旧业务能否排空的运行事实只能由原Owner受权读回；本文不默认旧账为零。

### 2.3 前轮连续性裁决

有限筛查命中：用户报告多轮恢复事故；Git近期 `9421b4154`、`bd04fb6a9`、`2a8e08d47`、`555429963`、`3b7312556` 及原WAL/事故方案。当前代码保留一次提交、先原effect读回、job-bound Target、唯一FIFO/lane、结果先落原Outbox再清理、领域回执完成；这些不变量进入§8回归，不重做基础设施。

`bd04fb6a9`的阅读组织实际落在9个Skill/Prompt，但BZ05仍要求旧PDF、v4、七书和@S展开；源头及Website新四部分资料已经继任。只退休这些已不适用要求，保留完整事实/候选/原典、双层解释及同轮自检。其它产品仍使用generic阅读表达，不能因BZ05已改为直接阅读就宣布全部@S机器路径已消失。

同仓《八字三产品结果契约校验对齐-完整实现方案.md》为旧合同加exact/commonReport的方案；现代码已落地相应strict parser。它不能继续指导当前合同接收；身份防串仍保留，重复领域结构考官退出。《八字栏目技能方案.md》仍自称当前对齐，却含“旧attempt绝不读回”“Outbox未达以后新建attempt”“BZ04不能作父”等旧口径，与当前Runtime及Website BZ04父合同冲突。两份文档的具体退休/修订在W-D处理，不复活其旧骨架，也不据历史方案重写现役恢复。

Website《起名栏目终态减法重构-完整实现方案.md》《合婚栏目-完整实现方案.md》对应业务已进入当前producer/consumer/provider；本案只承接AGENT接缝，不重复设计购买或领域模型。《良辰吉日栏目-完整实现方案.md》仍有设计阻断，依用户答复排除；旧八月FLOW执行方案仅历史线索，不据其中“网站拥有执行FLOW”恢复Website Prompt/Stage。其他浏览器事故方案的当前实现仍现役，不能以旧文档数字取代当前合同。

## 3. 四维核对与精确GAP

以下法案均取本仓当前正文、registry定位及Owner Manifest，不把registry当规范。两仓母本§0/4/35/46—47界定本轮文档CHANGE，§22—25/40/43/49/56/64及B.6/B.7界定拓扑、最小dependency、分别质量和无桥切换。

| GAP | 源头与法案/施工图 | 当前第一断裂、影响 | 工单/验收 |
|---|---|---|---|
| G1 合同与能力 | AGENT Runtime003-V46、架构001-V18；Website AA012-V48；双方V6图 | AGENT law/generator/consumer硬锁18/48；Catalog旧联合起名导致整份attestation不合法。网站规范已发布21/43。 | W-A0/A1/A2、V1 |
| G2 BZ05语义 | 八字9/10/24—29；Website BAZI002-V8/003-V7/008-V16/010-V10、ANALYSIS-INPUT002-V10 | Product identity、Skill、promptFor及parser仍PDF/v4/candidate_scope；应完整事实v5/condition_scope，不以BZ02成立。 | W-P1、V2/V3 |
| G3 BZ03/04接续 | 八字11/22/28；同上及BAZI007-V6 | outer policy相同，但Skill仍旧压缩还原说明；必须核完整新事实和同源父正文。现ZIP父伴随JSON路径未退出，不误删成熟parentArchiveReport。 | W-P2/P3、V2/V3 |
| G4 QM03/04 | 奇门9/21—36；QIMEN-ANALYSIS001-V8/003-V5/004-V3/005-V8及REPORT-DELIVERABLE002-V7/003-V6/004-V8 | 旧v8/v2 parser与Skill要求退休rule matrix/index receipt/candidate覆盖；现输入v3、盘v9、输出v9/v3及原问题码点引用。 | W-P4/P5、V2/V3 |
| G5 HH02/03 | 合婚17—22/24—40；HEHUN001-V7/004-V8/005-V8/007-V8/008-V6/010-V7/011-V6/012-V8 | 旧v4/v2 parser要求covered_question_unit_refs；新v5/v3区分产品研究范围与真实用户问题，coverage_units和block双向引用。 | W-P6/P7、V2/V3 |
| G6 人物/商业起名 | 起名4/9—19/21/25—28；NAMING001-V5、CHART-CONTEXT003-V2/004-V3、OUTPUT008-V4/009-V3、DELIVERY010-V6/011-V3 | 人物Skill仍V2且禁止数量/排名/典籍；旧联合Product把BZ05和命名同轮生成。应人物本人BZ05先交付、商业零八字、两者命名v3。 | W-P8/P9、V2/V3 |
| G7 接收职责 | Website AA012-V48、AI-BOUNDARY005-V5/011-V1；AGENT CAPABILITY-GOVERNANCE002-V5 | exact/commonReport/parseReview重复接管领域字段、非空与覆盖，未知字段被丢或拒；正常围栏已由现唯一object提取器支持，勿再造DOM/JSON parser。 | W-P1—P9/R/S、V4 |
| G8 翻译/本地化 | 各蓝图PDF/原名/引用不变；Website LOCALIZATION001/003/006/009-V9/012-V16/013-V18/014-V7/015-V7/019-V17/020-V31 | 外层三route相同，仍需新canonical的内部结构/受保护原名字节到译本PDF或页面实际读回。017-V1仍要求实际Plugin/version，与AA012零跨仓Plugin身份有规范冲突。 | W-W0、V5；原Localization实现直接复用 |

规范裁决：产品蓝图和Website现行领域法案在上述业务要求上同向；不能据此宣称全部法案系统零冲突。明确待修的是AGENT Runtime003的旧版本/分母及旧AGENT指导文档、Website Localization017的跨系统Plugin/version要求。后者只应改为公开route/contract、payload、实际execution evidence与领域validation/admission绑定，不新增Plugin字段、类型或第二验证器。法案修改先批准、先正文/图/spec/Manifest对齐、再原生成器投影；未批准即停止依赖施工。

### 3.1 先审质检必要性

1. `scripts/acceptance/agent-route-contract.acceptance.ts`及原Runtime合同inspector必保留：否则错参数键、材料role/trust/ordinal、父三元组、复核subject hash可取得运行资格。旧18/48断言必须退休，由21/43现源投影替换，不能删除保护或假accept当前所有值。
2. `scripts/acceptance/product-plugins/<plugin>.acceptance.ts`按原目录发现各Product，保留实际Prompt/Skill消费、一次submit/零submit原读回、材料身份、结果封存和未知字段保真；旧schema/目录/联合结果固件及“额外内容字段必拒”“多加领域考官才安全”断言删除，改为可区分错误实现的反例。新商业Plugin有真实新消费者，须独立自有验收，不复制旧联合固件。
3. 原architecture/capability/code-purity检查保留：防跨Plugin调用、第二workflow/恢复、越权导入、源头投影和僵尸。无需新增审计器、独立注册表、常驻Agent或第二质量入口。
4. Website现有领域输入/输出、资料逆向、血缘/隐私、PDF/Manifest、localization protected fields与各sender/recovery测试保留；机械字段数量/引用闭合不能冒充专业阅读。没有本轮已证运行故障时不重写Website consumer。

各项删除反事实：route检查删掉会放行错wire；Product验收删掉会漏错调用/错材料/丢raw；领域检查删掉会错人、错父或伪交付；结构检查删掉会出现第二Owner。它们验证不同责任，其余检查不能替代。只增强现有用例；9个primary/26个review、原名字节/父关系/单effect边界来自真实合同，不人为扩大样本充数。

## 4. 现役实现图、完整消费者与保留裁决

### 4.1 入口到终点

Website领域冻结需求/资料来源与合法权益 → 原 createWebsiteAgentTaskWithClient → 唯一task-result21/route policy → 原V6 session/claim/grant → AGENT原route-policy和Catalog → 命中Product静态Flow/同根Skill → GPT公共Child及Browser唯一lane/WAL → 同task完成回答artifact(raw HTML+semantic text及双hash) → Product基础接收和一次无损归一 → Runtime原SQLite stage+terminal Outbox → Website staging → 原Domain Consumer/Commercial/PDF → admission receipt → Runtime completed。

所有箭头只使用原Owner；材料下载按冻结recipe重建exact bytes，不读current书/盘/报告替代。API输入object routes、material-source-contract与lifecycle只有原鉴权和字节主权，不取得专业研究权。普通启动不读取Website工作树、不补schema。

### 4.2 40路由的具体处理

| primary完整身份；所属Plugin；其两个review同归该Plugin | 决定及目标 |
|---|---|
| bazi_chart_interpretation/produce；bazi-chart-interpretation | 重建P1的Skill/指令与接收片区；目标output.v5、fact_semantic_manifest；ready ZIP0+formal ZIP1。 |
| bazi_ai_full_analysis/produce；bazi-ai-full-analysis | P2重建阅读指令与接收；output.v1、两ZIP；原完整父JSON reader及执行骨架保留。 |
| bazi_report_followup/followup；bazi-report-followup | P3同上；output.v1，ready ZIP0+input ZIP1；明确BZ03/BZ04直接父。 |
| qimen_professional_answer/produce；qimen-professional-answer | P4重建专业指令/接收；output.v9；ready ZIP0+business ZIP1。 |
| qimen_report_followup/followup；qimen-report-followup | P5重建专业指令/接收；output.v3；ready ZIP0+followup ZIP1。 |
| hehun_ai_analysis/produce；hehun-ai-analysis | P6重建变更的阅读/输出提示及接收；output.v5；ready ZIP0+bundle ZIP1。 |
| hehun_report_followup/followup；hehun-report-followup | P7仅重建接收到output.v3；现Skill/Prompt专业职责和目录已匹配，直接复用；ready ZIP0+followup ZIP1。 |
| naming_from_existing_bazi_report/produce；naming-from-existing-bazi-report | P8重建完整Skill、instruction/Prompt与接收；naming.v3、ManifestV3、一Context ZIP0含所选书和已交付BZ05。 |
| naming_commercial/produce；新naming-commercial | P9从商业非八字合同独立建设；同naming.v3/一Context ZIP；删除旧联合3routes/4源码文件和专属验收，不作改名恢复。 |
| localization_report_translation/report_translation；localization-production | 直接复用；v2、四JSON；primary及review fresh，不送原研究ZIP，不二次研究。 |
| localization_article_translation/article_translation；localization-production | 直接复用；v2、四JSON；primary五语严格direct-parent原URL续聊，review fresh；不复用父回答/父Tab。 |
| localization_static_catalog/produce_locale_catalog；localization-production | 直接复用；ContextBundle v3单JSON、candidate/result v3；首任务fresh，后继同cohort已接纳父，失败字段原链补译；无review。 |
| public_knowledge_article_pipeline/produce_article；public-knowledge-article-pipeline | 直接复用文章包v1、ready ZIP与原研究/正文/图片职责；两个review不重答；保留format-only冻结例外，Skill不额外注入Prompt。 |
| payment_screenshot_observation/observe；payment-screenshot-observation | primary原六字段观察和图+合同JSON保留；仅R重建review接收，两个review仍只finding，付款决定仍归Website。 |

9组专业的review均保留原subject_result+review_context JSON、subject/result/hash、review_policy和freeze，不套primary ZIP、不得宣称观察了未附二进制。其合同仍website-agent-review-output.v1，decision/issues八字段公开请求及1—50和evidence约束来自provider；Product不另存第二schema，领域唯一consumer作最终机械验收。

### 4.3 下游具体停止点及不误伤证明

| 真实consumer/位置 | 保留理由、边界与验收 |
|---|---|
| Website `bazi-agent-dispatch.ts`、`bazi-agent-denominator.ts`、`bazi-provider-archives.ts` → `bazi-agent-result-consumer.ts`及商业Bazi完成readback | 唯一L0/L1和fact manifest；保留四部分资料、BZ01独立与可选PDF、root/direct parent；V2/V3读领域receipt及Delivery。 |
| `qimen/qimen-agent-task-dispatcher.ts`、`qimen-agent-material-source.ts`及`qimen-provider-archives.ts` → qimen领域/商业首次与追问consumer | 盘v9和原题时间不变，完整源/父与真实引用；内层接纳→原PDF→商业Manifest→admission，PDF失败不重跑AI。V2/V3。 |
| `hehun/hehun-agent-task-dispatcher.ts`、`hehun-agent-material-source.ts` → hehun领域consumer及`commercial/hehun-followup-agent-result-consumer.ts` | 两独立BZ05先交付、同账号双人、原根直系和授权；prepare不取得终态；原coordinator同client消费，V2/V3。 |
| `naming/naming-task-creation.ts`、`naming-provider-archive.ts`、`naming-agent-result-consumer.ts` → 原Naming商业履约 | 人物/商业互斥；A真实提交正式资源，B核同原task/payload/Manifest/PDF再商业及admission；A已提交B失败原结果续B。V3。 |
| `ai-production/business-result-domain-dispatch.ts`、`business-result-consumer.ts`、`job-device-status-repository.ts` | 原9产品domain map和其它5handler/26review真实发现；只三种跨仓receipt：base/Bazi/review。Naming/localization内部business_object_ref不加到跨仓receipt。V1/V6。 |
| `localization/localization-composition-root.ts`、`localization-completion-worker.ts`、`canonical-report-source-resolver.ts`、`naming-canonical-report-source-reader.ts` | 原6元durable身份、真实canonical/Manifest/PDF/raw；原protected-field投影与同源译本。W-W0只纠正规范，现数据/译文不改。V5。 |
| Website `scripts/localization/prepare-static-review.ts`、`packages/i18n/src/target-language-review-contract.ts`与原catalog sender/consumer | 当前policy在迭代，不硬编码某次版本；source/policy/locale/cohort/pending IDs按原冻结。V5，变化不等于AGENT外层失配。 |
| AGENT `src/lib/local-runtime/production/cloud-reconciliation-client.ts`、`runtime-business-admission.ts#reconcileBusinessAdmission`及其`runtime-loops.ts/runtime-claim.ts`真实调用、Runtime三表、原Outbox、GPT/Browser/Forensics | 输入/状态/receipt/副作用语义不变，直接复用；旧历史事实不删、不自签恢复、不把日志失败撤销结果。V6。 |

独立发现来源差异已解释：Catalog有旧联合3路由，Website sender/consumer为新商业3路由；相同其余37并不代表内部资料/输出一致。注册枚举发现合法分母；合同反向引用发现所有parseReview消费者（额外发现付款复核）；dispatcher与领域存储读写发现最终接纳/交付。未发现绕过原V6及Catalog的合法新入口；Website旧FLOW/Stage不是允许保留的旁路。

### 4.4 删除反事实：生产结构

- **保留GPT/Browser/WAL/FIFO/Target/Forensics/原Outbox与三表**：真实消费者为所有40路由，删掉即失去原副作用/回答/交付证明；业务格式修订不能替代它们。零新增同职结构，零DB迁移。
- **保留BZ03/BZ04原parentArchiveReport**：Website仍输出`八字命盘资料/06_父报告/来源身份.json`、`正文/身份.json`及连续集合页，引用中的完整父body含新v5的内部字段可原样承载；删掉会失去本轮父材料字节和父hash绑定。不得另建共享父reader或跨Plugin导入。V2用实际源样包证明，失败只回源/本Product，不放宽成摘要。
- **保留现parsePluginJsonObject/pluginObjectAt及object/locked等必要机械原件**：它已支持围栏/周边文字中的唯一完整object并拒绝多object歧义；删掉会导致不能接收截图所示JSON代码块或错选多个对象。无需新DOM适配或JSON parser。保留resultExact/stringArray/hash：文章image receipt和公开contract仍有真实机械消费者；不能连坐删除。
- **退休commonReport、resultDual、parseReview的共享领域考官及其公开出口**：专业primary内层验收由Website唯一领域consumer承担；review业务字段由原reviewconsumer承担。移除各Product旧调用后，commonReport/dual零生产消费者，parseReview最后消费者为付款review，必须R先转成Product基础接收。S删除专属函数/出口，不能移成新helper恢复。
- **退休旧联合起名全部实现与注册**：蓝图已禁止该同轮联合业务，无合法新生产消费者；新商业Product从非八字合同独立推导。旧报告/权益由Website历史读取保留，不保留旧生产parser/alias。
- **保留唯一projection generator、Catalog和Product自有验收目录**：分别承载provider原字节、精确route dispatch、自有测试活性；更短方案就是改现Owner的原件，不新增支持名单、编译器或注册器。

## 5. 唯一目标合同与有限分支

### 5.1 逐handoff约束

| handoff | identity/type/顺序/unknown-field/状态及读回 |
|---|---|
| Website→AGENT task | provider21、wire1、公开product/action、request_hash、owner/授权、material id/ref/hash/bytes/media/ordinal/trust/scope、原parent/review三元组。参数键集exact；值由Website判定，Runtime不复制业务枚举。无Prompt/Profile/Plugin/Provider URL。 |
| 材料→Product→Provider | role按§4.2 exact，私有owner required、共享书包owner forbidden；命名一本Context包可含多本所选书，不增空古籍附件；来源/书版本冻结，实际bytes核真。先目录后完整事实和原文阅读；BZ05使用直接可读四部分，不再要求AI还原@S。其它generic编码依本次真实目录和明示映射阅读，不发明新编码或误删必要映射。 |
| Product→GPT/Browser | Product独占静态Flow/Prompt/模型；现有Product重建仅改专业指令/接收片区，保留当前step/call/actionOrdinal与effect身份。新商业Product只按P9新冻结需求产生唯一调用，不能接手旧联合effect。每个原合同准许的Provider effect只首次submit一次；文章原研究→正文→图片各turn按自身原step独立执行，不误缩为整job一turn。九专业/报告翻译/固定catalog各自原单turn义务不变。同confirmed effect先原readConfirmedSubmit、零再次submit；未知只交原恢复授权，Prompt变更不证明旧effect为零。 |
| 回答artifact→Product | raw HTML及semantic text先同task artifact封存；现唯一object提取。primary只核公开schema、产品/route与必要身份，不复制嵌套章节、引用、数量、非空或语义考官。所有未知内容字段原样保留，不以extra fields拒收。 |
| Product一次无损归一→Runtime | 原正文/码点不改；只在本轮重建的Product内对公开要求为数组的`uncertainties/limitations/safety_notes`字符串表示包为单元素数组、review单个issue object包为issues数组；现数组原序、对象未知字段保留。其余错误交原领域拒收，不把旧candidate_scope翻成condition_scope，不补引用/覆盖/结论、不纠正原名、不再叫模型修格式。原artifact/evidence refs、最终payload及本Product对应函数共同复放转换事实；不加cross-wire sidecar、持久台账或归一Owner。Localization与SEO保留各自现役接收例外，不套该primary归一。 |
| Runtime→Website | 原result wire1/sha256/bytes/media/evidence/execution receipt；同job+attempt+hash幂等stage/terminal Outbox。新lease fence只是发送权，不改payload identity；未知先exact staging/terminal/admission读回。 |
| Website领域→客户与Runtime | 领域required结构/引用/数量/不可变身份和权限唯一核验；原事务/独立A-B提交边界保持。raw有效但PDF未成仍非交付；只有原business admission验证后Runtime completed。三receipt互斥且完整hash，不新增Naming扩展或Plugin字段。 |

这些转换是有限已命名表示归一，不是通用schema解释器；未声明字段/形态没有转换权限。可选字段依唯一provider/领域合同，不补null/default。无需本轮新增幂等键、transaction、lease、fence、表或receipt，原相邻Owner的已有合同直接使用。

### 5.2 分支分母及恢复回接

| 当前实际分支 | 唯一Owner、输出、consumer/readback、失败/恢复 |
|---|---|
| capability、参数键、材料身份/权限、父关系不匹配 | 原session/route机械Owner拒绝；零新lease或零Provider输入，以原code可见；来源修正后原Website需求再调度。不得补默认或桥接旧route。 |
| 资料中真实局部未知 | Website事实Owner保留状态/原因，Product有条件解释；资料漏失不能冒充真实未知。引用/权限/来源错按原typed失败回Website，不私算补值。 |
| 合法首次研究/复核 | 精确fresh或现契约允许的continuation、一次submit、raw封存；Product结果→Outbox→领域consumer。复核只有finding，不交第二报告。 |
| 已confirmed或可能输入但回复未知 | Browser保留原WAL，Product/Runtime按当前精确授权只读回原effect；原答案有界不可得由Website原seal/newrevision/risk grant决定，旧事实不删，兄弟合法job不因其旧DISPATCHED受阻。 |
| JSON无法解析/多个object、错schema或必要锁定身份 | Product typed失败、raw仍保留；确定性同字节解析不新调用Provider，无法同身份交付只走原Website恢复。无本轮新repair机制。 |
| 表示差异及未知内容字段 | §5.1一次本Product归一/保留后交付；领域合法则接纳，非法出原hash-bound rejection。禁止AGENT依据写得充分与否拒收。 |
| 原结果已stage/Outbox，发送或确认丢失 | Runtime原Outbox同job/attempt/hash+当前合法fence续送或读回；不再次研究、不因Browser/日志清理失败撤结果。 |
| 领域transient、rejection、PDF/A-B提交未知 | 原领域/Commercial与ai-acceptance按当前合同：transient原结果有限退避；rejection绑定payload签新revision；A已成仅续B；PDF失败只补原PDF。实际领域receipt+Manifest/对象读回闭合后才完成。 |
| 取消、撤权、删除及历史读取 | 原Website业务/权限Owner按冻结任务和原权益决定；尚未获准动作零输入，已发送未知原身份读回；旧历史报告/付款/WAL不伪造删除。AGENT没有业务取消/清除或复活权。本轮无取消/删除操作。 |
| 不可排空或无法确认旧副作用 | 运行切换停止，原Owner继续处理原义务或明确售后；不强制删除工单/清库，不把无法读回认作零。不新增恢复动作。 |

没有持久化/恢复新增项；纯Prompt/表示调整不另设运行状态。所有复用恢复分支由原Website.ai-acceptance决定，Runtime/GPT/Browser只执行其合同。

## 6. 原子施工工单

本节的路径均为对应仓库相对路径；W-A/ P/R/S属于AGENT，W-W0属于Website。每单功能验收与删除重构纪律分开。执行前重新读双仓权威、本文和目标Git状态；只在local main，无分支/worktree。非Skill基础设施及改法均须本单精确授权。

共同纪律D：先按本单列出保留职责，原独立模块直接使用；从合同推导目标I/O；物理删除指定旧实现→当场读取文件/符号/反向引用确认缺席→独立新建。禁止把旧内容存于内存/临时文件/副本后改字符串写回，禁止Git取回、改名、搬家、wrapper或兼容壳恢复旧骨架。同行文件中的保留职责留在原位，不为“整文件删除”临时搬走。只能删除本单已裁决的符号片区；新发现必要职责先回本文，不能顺手复制保留。

共同失败F：本单事实/合同/权限/用户改动漂移即停止受影响单，保留原数据、raw、WAL和Outbox；无自动恢复旧实现或生产回退授权。修改方案后按原授权接续；回退只在另获精确批准时执行并报告为回退。功能未完成、纪律未满足或过程证据缺失分别如实报告，不能用READY遮盖。

### W-A0：AGENT Runtime权威对齐

1. 做什么：先消除G1旧规范与G2—G7旧指导冲突，输出唯一现役规范，不改业务源头。
2. 不做什么：不改两仓母本、五蓝图、TOMBSTONE-RECOVERY-AUTHORITY-001、FROZEN-EXISTENCE-PROOF-001、Browser/GPT/Forensics冻结语义、Runtime008独立证明边界；不扩产品分母。
3. Owner/路径：agent-production-runtime；`功能法案.md#LAW-AGENT-PRODUCTION-RUNTIME-003-V46`及同文件引用它的law-record；`docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md`的18/48、旧NM01、旧接收段；`docs/specs/agent-production-runtime/{website-agent-task-result.dependency,xuanxue-ai-production-v6.dependency,agent-route-capability-manifest.provider}.spec.json`、`scripts/audit/domains/agent-production-runtime/{manifest.json,contract-inspection.ts}`、`scripts/acceptance/agent-route-contract.acceptance.ts`中的该lawId引用；`tests/governance/quality-contract.test.ts`真实Provider正向子例的同一lawDomains引用只作机械同步，保留全部正反例，不从被测spec生成合法法条表。规范版本依母本递增，不能同lawId改正文。这里只更新law引用，合同内容及执行断言由A1施工。
4. 保留：Runtime003的唯一provider、最小dependency、exact投影、图片机械身份、参数值不复判；全体恢复和receipt不变量。Manifest保留原路径归属及Product运行决策不归治理Owner。
5. 删除：图中已退休的18/48/联合起名/strict接收现役口径及旧lawId活动引用；指导文档由独立W-D处理，本单不跨Owner执行。
6. 建设：原法条原位版本化修订为21/40/43/40；原图指向完整事实与新商业命名；无新法案主题、registry、Blueprint、spec类别。registry只能原生成器生成。
7. 顺序：获得具体改法/文档许可→读取全部lawId引用者→删除退休规范片区及旧方案→缺席核验→重写原规范→原registry/Manifest闭合→主Codex两遍规范对齐；未闭合禁止P/A1/A2源码迭代。
8. 验收：功能核定规范/source/provider21与40成员一致、唯一Owner、旧schema不被宣称可用；纪律核实际删除记录、无旧指导入口或第二方案；原native CHANGE/源头检查不替代运行。
9. 失败：F；无恢复旧规范的授权，停止依赖工单。

### W-D：AGENT旧指导退出与方案归属

1. 做什么：消除§2.3两份旧八字指导与当前事实的冲突，并登记本唯一对接方案的文件治理归属。
2. 不做什么：不改生产恢复、Product源代码或Runtime法案，不把文档描述当实际交付；不修改其它浏览器事故方案。
3. Owner/路径：architecture-boundary；`docs/项目方案/八字三产品结果契约校验对齐-完整实现方案.md`、`docs/项目方案/八字栏目技能方案.md`、`scripts/audit/domains/architecture-boundary/manifest.json`。新Product源码与自有验收已由原`src/plugins/**`及`scripts/acceptance/product-plugins/**`覆盖，不新增冗余登记。 直接关联现役指导的机械登记同时同步：`AGENT运行拓扑图-完整实现方案.md`仅R08/R29/R30，`AI生产派单金字塔优先级排序-完整实现方案.md`仅Tier2产品名，`系统自完善-完整实现方案.md`仅商业Product检查面与两条文件路径；旧事故快照仍为历史，不改其事实。此为原文局部登记同步，不冒称重建或新增方案。
4. 保留：八字技能方案中三个独立Product、Website来源/授权、事实与解释分权、单一恢复/业务完成的正确职责，原位保留；其声明与现实现逐项核对后更新，不能保留相反旧例子。
5. 删除：旧三产品strict校验方案整文件及唯一Manifest登记；旧技能方案整文件删除后在原路径独立建设。施工复读确认旧文除三个独立Product及交付Owner边界外，各主要章节仍含attempt进入effect identity、未知禁止原读回、Outbox未达换attempt、BZ04父错误、两表和固定旧Child分母等相互关联旧规则；逐段保留该旧骨架会继续制造相反指导。正确业务职责按第4项保留，不复制旧执行结构。正文引用在同一文档范围改指本文或现役V6图，禁止旧文继续标现役。
6. 建设：不新增方案文件；旧技能方案实际delete→缺席读取→从四份源头、本仓现役法案及V6图独立写明三产品职责、完整资料、精确父、一次effect与已授权零输入读回、三表/原Outbox及领域PDF完成边界，补本文唯一Manifest path；不重建生产代码。
7. 施工：A0规范已获批并闭合→核当前文档与引用→D删除/缺席/新建→原Manifest生成消费；完成后才进入Product源码迭代。
8. 验收：技能指导与BZ04实际direct predecessor、confirmed effect读回、原Outbox重交付完全一致；旧strict方案零活动引用；纪律核原文退休片区与保留片区分别可查，未新增第二规范。
9. 失败：F；文档冲突未消除阻断依赖施工，不借注释“历史”继续让旧规范指导运行。

### W-W0：Website本地化旧身份规范裁决

1. 做什么：解决G8 `LAW-LOCALIZATION-017-V1`与AA012零跨仓Plugin身份的冲突，输出公开合同/实际执行/领域receipt唯一绑定。
2. 不做什么：不新增Plugin/version字段，不改本地化policy/source/译文、sender/consumer/DB或他人dirty，不修改五蓝图。
3. Owner/路径：localization；Website `功能法案.md#LAW-LOCALIZATION-017-V1`、`scripts/audit/domains/localization/{check.ts,manifest.json}`的精确lawId/该义务断言及唯一原生成registry。当前反向引用未发现该lawId对应的独立Blueprint/spec，不创建空配件；AA图中零跨仓Plugin身份要求不改。必须取得该仓明确规范批准。
4. 保留：source/locale/payload identity、真实execution evidence、validation/admission完整及原独立质量入口，代码现役公开路由不变。
5. 删除：只退休把AGENT内部Plugin/version作为网站接纳身份的规范要求；删除后检查规范consumer是否仍要求它。无生产文件/数据删除。
6. 建设：同一法条原位升版，以product/action+task/result contract+真实执行证据+领域validation/admission约束；不得用request metadata替实际事实。无新字段/接口/机制。
7. 顺序：明确规范批准→查精确引用→删除旧规范片区/核缺席→重写并生成原registry→独立Website原native验证；不借AGENT通过证明Website。
8. 验收：原source/locale/hash/receipt错误反例仍拒；跨仓Plugin字段仍零；纪律核只该规范片区与必要引用变化，他人dirty不变。
9. 失败：F；该冲突未裁定时保留为设计/施工阻断，不通过给wire补字段解决。

### W-A1：Runtime唯一合同投影继任

1. 做什么：G1把原最小dependency与唯一generator/consumer切到现provider21/43，输出exact同源projection。
2. 不做什么：不写第二支持表，不改Runtime调度/容量/恢复/上传/Outbox/DB/安全，不提升V6或capability版本，不让启动读Website工作树。
3. Owner/路径：agent-production-runtime；`docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json`、`scripts/generate/sync-website-agent-route-policy-projection.ts`、`src/lib/local-runtime/production/route-policy.ts`的版本/分母片区、其唯一JSON产物；`scripts/acceptance/agent-route-contract.acceptance.ts`与Runtime `contract-inspection.ts`直接版本/lawId引用。
4. 保留：generator结构验证、原字节/顺序投影，consumer参数键/材料/关系机械核验、Website参数值主权、全部40路由反例和opaque values；其余函数原位直接复用。
5. 删除：旧projection产物先物理删除、缺席核验再由原generator写回同一目标；旧绑定随着下一项的局部修改退出，不保留18 reader或老文件副本。无生产源码整文件删除。
6. 建设：无新增或重新建设的生产机制。generator/consumer/inspector/dependency的版本、集合及对应断言是不可分割的机械局部修改，明确不冒称真正重建；JSON为唯一生成器重新生成，dependency contract仍三字段，无新生产文件。
7. 顺序：A0已闭合、provider commit/dirty重新绑定→机械局部修改原版本/集合约束→删除旧projection并即时核缺席→原generator生成→原consumer→A2能力对照；中间产物不运行/上线。D适用于真正重建片区，本单不表演“删数字再写数字”的伪重构。
8. 验收：V1逐40路由的参数、材料trust/owner/ordinal/cardinality、relation和全部result_contract语义/原bytes一致；故意错/缺/多/重/顺序错误拒，31个不变route保持；纪律核唯一generator与旧18/48生产残留零，history明确排除。原观察code测试不删。
9. 失败：F；不同provider版本不可自动接受；不把新JSON喂旧线上进程。

### W-A2：Catalog单一商业Product替换

1. 做什么：G1把旧联合3route注册替为新商业3route，actual capability通过现Website validator。
2. 不做什么：不在Mediator承载Prompt、步骤、业务恢复或命名选择，不新增Plugin身份到wire，不扩大12 Plugins/14 primary/40 routes。
3. Owner/路径：architecture-boundary；`src/mediator/product-plugin-catalog.ts`旧import/数组注册片区；`src/lib/local-runtime/production/catalog.ts`只读验证原派生；原architecture中央验收目录发现无手写名单。
4. 保留：routeCatalog、skillBytes、productionCatalogHash、snapshot、dispatch原件；其余11Plugin无修改，Catalog派生Manifest机制不改。
5. 删除：旧联合import/注册，再检查唯一map与snapshot无旧route；没有第二Catalog文件删除。
6. 建设：在P9独立Product存在后直接注册它；局部注册修改如实列为局部修改，不冒称整个Catalog重建。
7. 顺序：A0/A1、P9源码及自有验收就绪→删除旧登记→核缺席→唯一新登记→实际capability对照；无线上中途重载。
8. 验收：12Plugin/14primary/26review/40唯一route、旧联合unsupported、新商业3route有唯一消费；将实际Manifest交Website实际validator接受，篡改/丢/重复拒绝；纪律核零alias、零第二map、零业务步骤。
9. 失败：F；不默认宣称新route支持。

### W-Q1：删除自有验收的额外字符串存在门

1. 做什么：原生READY候选`36d7efe04dfbc7dd1fe8b6a66ecbed075f778db8`报告商业验收identity drift；实际正确导入/执行本Product，却仅因缺少独立自身Plugin名字面量被拒。原三法官复核后均裁删该额外存在要求，不立案清退，不新建正向身份体系。
2. 不做什么：不改正确商业Product或其验收来迎合检查器，不添加占位字符串，不改法案、施工图、Catalog、跨仓身份或质量入口。
3. Owner/路径：architecture-boundary；`scripts/audit/domains/architecture-boundary/components/scan-product-acceptance-boundaries.ts#inspectProductAcceptanceIdentity`仅退休“未出现自身精确字面量也须失败”的条件；`tests/governance/code-purity-governance.test.ts`增加对真实检查器的对应回归。
4. 保留：已有外来Plugin身份识别、resolved import跨Plugin/跨Product helper检查、中央身份表禁止项、原Catalog与独立验收目录一一对应。原生中央入口仍实际执行每个Product自有行为验收，字符串不能替代它。
5. 删除：上述无依据的自身字符串存在条件，先物理删除该条件并即时核缺席；保留该函数其他职责和消费者，不整文件删除，不复制旧谓词重建替代门。
6. 建设：无新生产机制；原函数只对已发现的其它Plugin身份保留原有拒绝。回归以真实自有导入且无独立自身字符串为正例，错误跨Plugin导入及已有外来身份为反例；不把空字符串或固定PASS当证明。
7. 顺序：本工单规范/边界由主Codex两遍核对→删除条件/核缺席→有限原位收口→普通治理测试和原架构入口→原庭核销→CI-FULL重走。
8. 验收：正确直接导入不再误报；原错误导入/helper/中央一对一保护仍成立；旧额外存在条件零残留。纪律按本单有限删除、局部修改分别报告，不冒称整个检查器重建。
9. 失败：F；新事实影响必要性或范围回原庭，不修改正确业务对象安抚检查器。

### W-Q2：属性活性接回原消费者范围

1. 做什么：同一READY报告的两条object-bag dynamic finding归并一个根因：导出层已选择生产/全合法可达范围，属性层丢失该事实并重新扫全项目。真实商业Plugin三字段均被生产Catalog消费；附加verification spread/传参既不应反向否决它，也不能给生产死字段补活性。原庭三票裁修、中度；原J1只读取证，J2/J3独立核原件后同意下列有限边界。
2. 不做什么：不改正确Product/验收/Catalog，不修改冻结存在证明、法案或施工图；不建第二scope、路径豁免、allowlist、注册表、Owner、兼容机制或通用数据流层，不删除真实生产动态访问及死属性保护。
3. Owner/路径：code-purity；`scripts/audit/domains/code-purity/components/scan-zombie-surfaces.ts#scanZombieSurfaces`只传原两份reachability；`scan-zombie-reference-surfaces.ts#requiresProductionConsumer`原语义原位直接复用、仅导出供属性层使用；`scan-zombie-object-bags.ts#scanZombieObjectBags`选择同一范围；`zombie-registry-bag-usage.ts`整体退休后独立建设范围内属性消费收集；`tests/governance/code-purity-governance.test.ts`补真实范围行为回归。
4. 保留：原entrypoint用途分类、module/symbol图、两种reachability、liveExportSymbolIds、bag discovery、逐字段/handler未用检查、原dynamic发报及唯一quality路由；生产字段只认生产消费者，验证工具本身仍按全合法图检查。原固定数组、typed Catalog/Map、total typed registry例外按实际属性读取与lookup保留，不靠类型或测试单独证明生产活性。
5. 删除：旧`zombie-registry-bag-usage.ts`整文件物理删除并即时读回缺席，再独立建设；不保存旧体换字符串写回。其它三处仅为原事实传递/唯一判定的机械接缝修改，不冒称重建整个活性系统。
6. 建设：唯一链仍是`scanZombieSurfaces→scanZombieObjectBags→collectZombieObjectBagUsage`。原`requiresProductionConsumer`决定用原生产集合还是全合法集合；该同一集合约束外层引用，以及contextual type、数组成员、map/for-of、total typed registry内部全部引用查询。import binding/re-export/纯类型不得冒充属性读取；静态属性与合法既有结构形成usedPropertyNames，剩余真实dynamic仍产生原finding。原输出类型/消费者保持，不新增状态或持久化。
7. 顺序：主Codex先对本工单两遍规范自检→核目标Git与真实消费者→机械接缝→旧collector删除/当场缺席核验→按合同独立重建→局部真实行为与原矩阵→原庭核销→原生CHANGE/提交首推/完整READY。
8. 验收：保留原`code-purity-zombie-deep.acceptance.ts`的动态key、Object.keys、伪lawful声明、死属性/handler反例，以及fixed-array、typed-catalog、typed-spread正例。新增回归在现有普通治理文件中使用内存Project，repoPath必须真实为根`src/**`与`scripts/acceptance/**`/审计工具；由原entrypoint和原可达算法形成不同集合，不能沿旧`tmp/.../src`夹具假称生产分支。逐项核：生产全字段+额外verification spread/传参接受；生产缺字段、verification或不可达读取不能补证；生产对象仅验证消费仍拒；验证工具自身没有豁免，合法和非法属性消费仍按原检查执行。必须覆盖内部contextual type/array/typed lookup的同一集合，不只过滤最终发报。
9. 失败：F；同一范围的正负证明或原保护承接不完整即回本单和原庭，不以忽略finding、改路径/alias或降冻结义务解决。

### Product工单共用的保留与结构预算

P1—P8保留原`index.ts`合法route、prepare/profile/attachments/submit/checkpoint/readConfirmedSubmit、marker/sessionKey/effect调用坐标与完成端口，Profile策略由Product原件保持，不因专业schema升级更换模型。只重建下列明确专业/接收片区。每份结果公开格式从route.result_contract读，不复制到Skill或第二schema；Product只作§5基础接收/有限归一。

当前拟触碰主要文件余量：BZ05 product-turn311行/7imports、identity13/1、parser46/2；BZ03 product-turn301/7、flow108/6、parser22/2；BZ04 product-turn276/6、flow112/6、parser20/2；QM03 flow279/6、parser15/2；QM04 flow286/6、parser16/2；HH02 flow262/6、parser14/2；HH03 flow269/6、parser14/2；人物命名flow86/5、parser22/1；旧联合flow93/5、parser32/1。原位置足以删除旧要求后容纳目标，不需拆公共层。AGENT原生红线：文件500行、函数75行/7参数/8返回/10await/5嵌套/16复杂度、28import declaration/24sources/24命名导出。新商业Product落四文件：index/flow/result-contract/SKILL，flow只本产品静态执行，不抽兄弟Flow、不造通用框架；按同红线组织不超过现役单产品职责。函数预算在写前以当前AST逐一核真，漂移先回本单，不堆到失败再切。

P1—P8各自按D执行，测试只改自身`scripts/acceptance/product-plugins/<plugin>.acceptance.ts`；有共同规则引用不意味着可以跨Plugin读私有代码。保留职责在删除前裁决，非删除分母。AST读取已核：主要Product最大函数31—60行、最多6个await；两父reader各60行，Catalog102行/14imports、最大函数11行，共享contract328行/2imports/最大函数29行，Runtime合同inspector369行/6imports/最大函数32行。目标以删除为主，不需额外层级。

所有重建`parseProductResult`必须先核task/route归属，再按relation区分：review只收decision/issues，不要求primary的schema_version或chart/parent/Manifest字段；primary才使用各单声明的schema/身份门。review有限归一与未知字段保留在本Product内实现，完整issue业务规则仍由Website原reviewconsumer判断。否则会把全部18个专业复核错误套入正式报告合同。

### W-P1：BZ05完整事实解读

1. 做什么：G2/G7，完整事实取代PDF伴读前置，输出v5。
2. 不做什么：不增加专项/经历前置，不改排盘、候选生成、四部分冻结、事实语义锚点或用户PDF选择；不自算L2前置。
3. Owner/路径：bazi-chart-interpretation；`src/plugins/bazi-chart-interpretation/SKILL.md`的材料/输出/定位章节；`product-identity.ts#PRODUCT_INSTRUCTION`；`product-turn.ts#promptFor`的旧资料路线文本；`result-contract.ts`整文件；同名专属acceptance。
4. 保留：本Product原Flow/Child/模型/effect/材料两ZIP、原artifact和v1 envelope；通俗与专业同义、原典支持反证、真实候选/联合条件。公共函数依§4.4保留。
5. 删除：Skill中PDF作为研究分母、固定七书、v4十三字段副本、candidate_scope和AI展开@S/模板/∅的要求；对应旧Prompt片区和旧parser全部；旧v4专属fixture/strict拒extra断言。先查缺席再重建。
6. 建设：新Skill由八字蓝图9/10/24—31推导，读取直接可用四逻辑部分与冻结实际READY集合；只以fact manifest产生专业解释，provided PDF验真、none不伪造。结果基础object/schema/route，锁chart三元及fact_semantic_manifest_ref，manifest_hash绑定其task hash，unknown内容保留；不在AGENT做anchor/condition/引用闭包复审。
7. 施工：A0/A1后D；Prompt原样投影v5公开合同，并指向新真实目录与research.pages，不要求已退出04_PDF语义清单；现record_pages.research仍存在。无新增回合。
8. 验收：V2真实四部分ZIP、无PDF与provided两合法分支，错来源/漏事实失败；V3同root完整解读及PDF读回；V4围栏/unknown/有限归一可交，错身份/schema拒；纪律证明旧片区缺席后独立建设、保留原Flow未复制。
9. 失败：F；原effect/结果按§5.2回接，不以Prompt改变重发。

### W-P2：BZ03精确父专项

1. 做什么：G3/G7，当前完整事实和本人BZ05父报告专项接收，output.v1不升版。
2. 不做什么：不改root/parent资格，不新增共享parent reader，不把业务父变Provider continuation，不改原完整ZIP伴随JSON编码。
3. Owner/路径：bazi-ai-full-analysis；本目录`SKILL.md`中旧恢复式阅读/机械schema段、`product-turn.ts#promptFor`对应材料文本、`result-contract.ts`整文件；原acceptance。
4. 保留：`flow.ts#parentArchiveReport/#requireParentReport/#isExpectedParentReport`和角色/bytes/hash/页序/总量/unused-entry防串检查；原执行骨架直接复用，父reader删除损失见§4.4。
5. 删除：旧资料恢复任务及重复exact/commonReport/覆盖考官、旧strict断言；无整个flow.ts删除。
6. 建设：Skill/Prompt完整原事实、root、完整已交付父和真实当前问题，直接可读；parser只基础/schema及question_snapshot.question_ref绑定task.question_snapshot_ref，其他内层交Website。公开合同原样投影。
7. 施工：A0/A1后D；先实际Website父样包与原reader闭合；原reader若不兼容即停本单回本文裁决，禁止先删成熟能力。
8. 验收：V2新BZ05 v5正文在现伴随页完整读回，错父/hash/缺页/重复页拒；V3原root专项，V4基础保真；纪律核仅指定片区删除重建。
9. 失败：F与§5.2，不猜父、不重买。

### W-P3：BZ04直接父追问

1. 做什么：G3/G7，从明确BZ03/BZ04直接父及同root材料回答当前问题。
2. 不做什么：不自行允许BZ05替代direct predecessor，不猜latest，不加Provider父记忆，不重建父reader。
3. Owner/路径：bazi-report-followup目录`SKILL.md`对应材料/定位段、`product-turn.ts#promptFor`对应文本、`result-contract.ts`整文件、原acceptance。
4. 保留：`flow.ts#hasFollowupIdentity/#parentArchiveReport/#readParentReport/#isExpectedParentReport/#validate`完整机械读取；原fresh/confirmed、模型与Outbox完成端口。
5. 删除：旧恢复式阅读任务、exact/commonReport/覆盖复审及旧固件；无parent reader/flow删除。
6. 建设：唯一原问题/完整父/获准祖先和事实解释；基础object/schema与parent_report_ref/parent_raw_output_hash绑定、新question_ref绑定；其余未知内容不裁。
7. 施工：A0/A1后D；BZ03与BZ04两种合法父都沿Website实际冻结，公开output.v1不变。
8. 验收：V2两父类别完整正文与错root/父/哈希拒；V3新问题PDF不覆盖旧；V4；纪律核老考官消失、原父读取保留。
9. 失败：F，沿原需求与权益恢复。

### W-P4：QM03原问题和盘v9

1. 做什么：G4/G7，专业阅读/输出对齐input.v3、盘v9、output.v9。
2. 不做什么：不修改起局瞬间、时区、日界、候选或机械算法，不新增原典全书遍历/全索引回执数量前置。
3. Owner/路径：qimen-professional-answer目录`SKILL.md`材料/依据/定位片区、`flow.ts#PRODUCT_INSTRUCTION/#promptFor`旧矩阵与候选读取文本、`result-contract.ts`整文件及原acceptance。
4. 保留：原profile/Child/readConfirmedSubmit/checkpoint/complete与两ZIP；专业自主、原典上下文、反证和双层一致。
5. 删除：旧rule matrix/receipt denominator/covered_candidate_refs硬要求、v8 parser和exclusive-top-level gate；Skill中@S/模板/∅还原任务与旧04_规则矩阵/05_语义清单目录要求也退休。当前Qimen provider使用literal reading_pages，不能把不存在的编码恢复任务交AI。不删除现事实及真实条件。
6. 建设：从本轮完整chart_source及原题/现实条件研究；输出请求为原合同v9、原问题Unicode码点范围与chart/classical/user/prior引用、reading_records支持/冲突/条件/上下文。Product只核schema/route和chart_ref/version，chart_content_hash与task.chart_hash等值；领域引用与问题范围由Website核验，不另加工程断事门。
7. 施工：A0/W-D/A1后执行D；当前`奇门问事资料/阅读/01_原题_*.md、02_完整原盘_*.md、03_来源身份_*.md、04_原始回执_*.md、05_任务_*.md`由00目录的record_pages.research连续定位；交付格式定位为`交付合同.json`，不是旧07文件，仍以route.result_contract为输出权威。机械图名称不作为吉凶结论。
8. 验收：V2原盘/问题码点/原文条件实际可读；V3一次完整答题和PDF；V4 wrong chart拒、extra内容保留；纪律与保留执行分开。
9. 失败：F；缺事实回原Owner，禁止AI私补。

### W-P5：QM04原盘指定父追问

1. 做什么：G4/G7，以完整指定父、原盘和当前原问题返回output.v3。
2. 不做什么：不换原起局时间，不跨任务续聊，不从当前时间或最新报告推父；不引新领域转换器。
3. Owner/路径：qimen-report-followup目录`SKILL.md`对应片区、`flow.ts#PRODUCT_INSTRUCTION/#promptFor`材料指令、`result-contract.ts`整文件、原acceptance。
4. 保留：两ZIP、原flow/effect/readback及同task raw封存。
5. 删除：旧output.v2/index_receipts/candidate覆盖parser、@S/模板/∅还原与旧06_父报告目录指令；其他原执行函数无删除。
6. 建设：公开v3含原盘/原题/实际指定父hash与reading_records，parser仅schema/route、parent_report_ref及parent_raw_output_hash与task精确绑定；盘身份/parent_report_hash若没有对应task参数，不在AGENT虚造source解析，交唯一领域consumer核真。
7. 施工：A0/W-D/A1后D；阅读目录前3节同P4，后2节为`04_指定父报告_*.md、05_追问原始输入_*.md`；当前task.parameters.question_snapshot只作原问题数据，不当指令；原父scope由本轮材料提供。
8. 验收：V2完整原盘/父/当前Unicode原文，错父拒，补充条件不换盘；V3/V4；纪律核旧parser/指令缺席。
9. 失败：F；纯格式恢复不再调用模型。

### W-P6：HH02默认完整关系研究

1. 做什么：G5/G7，默认完整二十适用议题，output.v5。
2. 不做什么：不重写同账号/双人许可/BZ05补齐商业链，不把二十项变二十轮/章节，不伪造用户问题，不以私人整篇文字禁止合法摘引。
3. Owner/路径：hehun-ai-analysis目录`SKILL.md#材料阅读`的强制男/女措辞、`关系研究`第7项的范围/自愿问题区分及`资料定位与结果提交`首段（当前47行）的“男女角色”措辞，`result-contract.ts`整文件、原acceptance。现`flow.ts#promptFor`已经读全部正确目录、投影唯一route合同，不修改。
4. 保留：成熟Skill专业条目和全部执行函数、两独立BZ05及双方完整资料，原scope/权限/隐私Owner。
5. 删除：Skill上述三个章节中的冲突片区：材料阅读中强制男女两处、关系研究第7项及资料定位首段的相反角色/问题口径；旧v4/covered_question_unit_refs接收及其strict固件；无整个Skill/Flow物理删除。
6. 建设：上述片区独立依蓝图第11/24—25/30条重建为人物甲乙、传统角色仅条件适用、二十产品议题与可缺席user_question分源；coverage_units与真实blocks回应关系由公开合同投影。parser只schema/route及case_manifest_ref/hash绑定，内容和coverage/privacy投影由Website唯一consumer。相关合法观点可以摘引，不能整篇附入PDF。全文语义回读确保不再要求把人物甲乙推定成男/女，不能只检关键词命中。
7. 施工：A0/A1后D；source map、全两份BZ05/合法候选/READY正文完整本轮可读；模型不补关系机械表项。
8. 验收：V2无自愿问题/有自愿原话、两人身份和两BZ05；V3完整PDF、私身份不泄及合法摘引不误拒；V4；纪律核只旧片区缺席。
9. 失败：F；已完成上游权益保留，资料准备失败与accepted AI job恢复按原阶段区分。

### W-P7：HH03原根直系当前问题

1. 做什么：G5/G7，output.v3仅本次关系追问，完整原根和直接祖先。
2. 不做什么：不混兄弟/其他人物/较新BZ05，不再次全盘、不增继承Store。
3. Owner/路径：hehun-report-followup目录`result-contract.ts`整文件、原acceptance；无Skill或flow.ts修改。
4. 保留：现役Skill全文、`flow.ts#promptFor`全文已支持明确HH02/HH03直接父、完整根/历史QA/10当前问题目录、动态唯一输出合同；原Flow/两ZIP/零submit恢复和Website直系链builder。删除它们不会增加本轮能力，反会破坏已明确的专业研究。
5. 删除：旧v2/covered列表strict接收和旧fixture；Skill/Flow无删除，原位直接复用。
6. 建设：new_question_snapshot真实当前原话，scope和coverage_units只对当前问，parent_report_ref/raw_hash精确锁；新canonical和privacy内层在Website核。原先资料中缺少信息保留未知，不补家庭事实。
7. 施工：A0/A1后D；原链完整正文逐项取，不从聊天缓存复原。
8. 验收：V2直系完整、兄弟拒、当前问题不漏；V3独立PDF、旧关系报告不覆盖；V4；纪律核保留与删除真实范围。
9. 失败：F，原需求恢复而非重买。

### W-P8：人物命名独立研究

1. 做什么：G6/G7，正式本人BZ05之后一次命名，Manifest/ContextV3、naming-output.v3。
2. 不做什么：不重做BZ05、不按相同四柱/最新报告选父，不提供商业无八字旁路来规避人物前置，不复制website book selector/价格/权限。
3. Owner/路径：naming-from-existing-bazi-report目录`SKILL.md`整文件、`flow.ts#instruction`及Prompt资料段、`result-contract.ts`整文件、原acceptance。
4. 保留：flow的`fresh/#executeOwnedFlow`中附件identity/一次submit/confirmed读回/observed artifact/complete骨架及index；Product模型原策略、命名原名逐码点保真。
5. 删除：旧Skill“ManifestV2/禁止数量和排名/无古籍”及重建位置，旧parser/旧输出fixtures；不删除原public能力、不删除合法已有BZ05。
6. 建设：全新Skill按起名蓝图推导：文化/语言与界面分离、按本次所选合格书阅读、完整本人BZ05和事实、标准20/全量连续顺序/前5/首选两备选，承诺取冻结manifest.delivery_commitment，特殊承诺只消费已明确确认。原名任何Unicode/空格/重音/大小写不转换。parser只基础schema/route、requirement_manifest_ref/hash，完整未知字段保留，不在Product写第二候选数量/排名裁判。
7. 施工：A0/A1后D；一ZIP含08_所选典籍正文/索引、07_交付约束与commitment；没有书籍的非法需求不能靠空包假合格，合法原创的材料边界由已冻结Context说明。全程fresh、一次正式命名。
8. 验收：V2真实精确本人BZ05/所选书/Brief/反馈和承诺；V3两独立权益/PDF、原名不变、约定候选与推荐齐；V4未知字段/表示差异不误拒、错Manifest拒；纪律核整Skill与parser删除后从源头独立建设，其余函数保留。
9. 失败：F；已交付BZ05永不因命名失败撤销。

### W-P9：商业命名替换旧联合产品

1. 做什么：G6以唯一非八字商业命名Product接3route，关闭旧联合业务。
2. 不做什么：不复制/改名旧联合或人物Flow，不借经营者命盘、出生资料、隐形BZ05或共同研究；不引共享命名executor或第二候选库。
3. Owner/路径：新Product naming-commercial，文件治理architecture-boundary；退休`src/plugins/naming-bazi-analysis-and-naming/{index.ts,flow.ts,result-contract.ts,SKILL.md}`与`scripts/acceptance/product-plugins/naming-bazi-analysis-and-naming.acceptance.ts`；建设`src/plugins/naming-commercial/{index.ts,flow.ts,result-contract.ts,SKILL.md}`及同名专属acceptance。A2单独负责Catalog注册，A1负责projection。
4. 保留：原公开ProductPlugin接口、GPT facade/附件集合/一次effect及Forensics/Outbox职责、商业Naming领域现原Owner；无旧联合模块保留。
5. 删除：上述旧Product4文件和专属验收实际删除→检查文件/exports/import/注册/route/Schema/测试专属附属对象无活动旧消费者；历史paid记录和原report读取不是删除分母。不得先把旧源码保存后换名写回。
6. 建设：从商业对象/真实用途、文化语言、完整ManifestV3/Context/所选书和交付承诺推导四文件；只产naming-output.v3、不含bazi_analysis。三route各只当前静态业务；模型沿现Product能力画像约束，由本Product选定现用“最新/推理4”，无新Profile体系；新Flow调用原公共Child，未决effect沿原授权读回。基础parser同P8，review只finding。
7. 施工：A0/A1后D→独立源头设计→删旧目录/验收→即时缺席读取→独立新建→A2唯一登记；整个候选完成前不对生产重启/注册宣称支持。
8. 验收：V1三新route/三旧拒；V2零出生/盘/BZ05的真实商业一ZIP及所选书；V3命名v3完整比较/推荐与PDF；V4/V6；纪律另证无旧骨架复制、无alias/bridge、旧专属测试不换名复活。
9. 失败：F；原旧历史由Website合法读回，不恢复旧生产者。

### W-R：付款review最后一个旧接收消费者

1. 做什么：G7只替换付款两个review对共享parseReview的调用，让原S删除可闭合。
2. 不做什么：不改observe primary、六字段观察合同、图附件/模型、付款处置/金额/权益或执行顺序。
3. Owner/路径：payment-screenshot-observation；`src/plugins/payment-screenshot-observation/flow.ts#receive`的review分支及原自有acceptance。
4. 保留：primary接收与全Flow、一次提交、原观察语义和Website付款唯一consumer。
5. 删除：`productResultValidation.parseReview`调用片区，缺席核验；无整个flow.ts删除。
6. 建设：本Product内使用现唯一JSON/object基础接收，公开decision枚举机械核验、单issue object有限归一，保留未知字段；issues内层由Website原reviewconsumer核验，不自建新review helper。
7. 施工：D，仅这一分支；P1—P9完毕后S反向检索确认最后消费者消失。
8. 验收：V4合法额外字段/单issue可交、错误decision拒、primary payload/调用完全不变；纪律核只review片区重建。
9. 失败：F，保留原raw和Outbox，不重新观察付款。

### W-S：共享重复领域考官物理退休

1. 做什么：G7删除已无生产消费者的commonReport/resultDual/parseReview，消除Product外第二领域结构Owner。
2. 不做什么：不重建为公共normalize/parser/adapter，不删JSON extraction/object/exact/stringArray/hash/locked等有真实消费者的机械原件，不动公共Product接口形态。
3. Owner/路径：architecture-boundary；`src/mediator/product-plugin-contract.ts`三函数及`productResultValidation`对应三个出口；其直接旧专属验收引用；原architecture/capability检查仅直接关联断言。
4. 保留：§4.4机械原件与公开类型、文章contract/image strict机械核验；Localization原parser和SEO format-only例外不改。
5. 删除：上述3函数/出口及仅支持它们的dead私有声明；用全部src/scripts反向引用证明无活动消费者，类型编译确认；不以测试引用维持僵尸。
6. 建设：无新生产实现；公共object bag局部删除为实际动作，不称整个contract重建。
7. 施工：P1—P9及R调用退出→证零消费者→物理删除→无复建；发现剩余消费者必须先纳入相应Product工单，不偷留helper。
8. 验收：V4各实际Product接收、V1全部route；原image/JSON身份反例仍有效；纪律核旧symbol/出口/独占附属对象零活动残留，原mechanical结构不误伤。
9. 失败：F；必要来源不可读就停，不能将“未查清”当“可删”。

## 7. 跨仓施工与无桥运行切换

### 7.1 文档/代码阶段

先W-A0、W-D、W-W0明确规范批准与正文/图/spec对齐，由主Codex完成至少两遍规范自检，不委派子Agent代替；设计3轮自审和独立审查另见§9。W-W0是独立Website规范事务，AGENT许可不代替它。若Website Owner未批准，依赖部分停止，不能输出“全规范已吻合”。P工单中的A0前置均包含W-D完成。

之后A1→P1—P9/R→S→A2，均由主Codex写，关键接缝由只读子审核；每个Product只承担一个研究责任。A2可在S之前完成静态登记，但最终检查必须覆盖S后的完整同一候选。各仓独立原native CHANGE；候选完整形成clean commit后才按独立授权及冻结CI-FULL执行READY与推送。Website本轮原provider已是21，不为“同步”重复升22，不修改其生产代码或其他在途任务。新合同实际漂移则回方案，不自动追最新版。

### 7.2 唯一运行切换门

执行Owner沿原V6/领域运维职责，在另获生产操作授权后：

1. 记录实际已部署双方commit、provider/dependency/control/capability及会话事实；不拿本地HEAD当线上。**先确定旧生产仍用哪套已匹配合同，未匹配则不得新生产；不安装旧代码“修复”身份。**
2. 在原Owner下停止40路由全部新claim及会新增AI需求的sender；保留原结果交付、同effect零输入读回与原领域/PDF收尾。drain不能用粗暴停机中断尚可交付结果。
3. 由Website原DB和AGENT原三表/Outbox、Browser WAL、领域/Commercial各自读回：无在途job、accepted attempt/live lease、staged待消费、未达Outbox、未决Provider effect、未完领域/商业交付。历史已终结WAL/已完成报告允许存在，不以行数非零误判未排空。各Owner说明同job/attempt/hash及分页穷尽，不凭空目录/HTTP200/单侧零值。
4. 若旧账无法合法归零，**切换停止**；原Owner继续原需求恢复或售后，不删工单、不伪造terminal、不改hash、不重收费。现方案没有旧版本生产parser、兼容窗口或清库通道；无法排空不是可绕过的验收项。
5. 排空后停旧durable writers，确认零在途事务与在途写请求；取得原Owner exact backup。此备份为受权运行恢复基线，不作为施工时保存旧片区再加工的通道。
6. 合同冻结于Website21/40/43/40、wire1/control45/capability4。先确认Website实际候选及来源迁移已成立，再安装已匹配AGENT完整候选；两侧仍停止新工作，最后核actualcapability与provider逐项一致，开原新session epoch，不重enrollment。无DB迁移、旧任务内容转换或新队列。
7. 受权开启原sender/claim，逐项取得§8当前身份实证；失败立即关闭受影响新生产，已结果优先交付。恢复合格业务须先准确读回，不能以新配置版本宣布成功。

### 7.3 停止与回退

本轮未授权运行切换或回退。未来授权必须精确包含双方目标commit、原Owner备份及恢复范围。

切换前失败：保持原已匹配运行组合和原数据；如果原组合已不匹配，则保持新生产关闭，不能继续投喂以排空为由制造副作用。代码施工失败无权恢复退休骨架。

切换后失败：先停新输入、保留结果/原effect读回，核是否已产生新21业务/副作用。只有无新运行事实、双方原数据可精确回到同一冻结点且另获授权，才可按原发布Owner回退双方匹配运行基线。已有新effect、A提交、raw/结果/交付时，禁止单仓倒回或DB回滚抹事实；沿原链前向收尾，再由授权人裁定新的恢复范围。报告必须写“失败回退”，不得将回退称为本轮重建完成。

## 8. 功能质量、真实业务和纪律验收

### 8.1 共同identity spine

`owner/人物或对象/用途 → 原订单与权益 → 冻结资料ref/version/hash → product/action + request_hash → job/attempt/result revision + 当前lease/fence → 原Provider effect及raw双hash → result payload hash/bytes/receipt → 领域resource/receipt → 原PDF/Manifest或公开edition/译文字段 → admission receipt → local completed`。

不同域没有的身份写“无”：文章/固定文案无私人报告订单/PDF；付款观察无命盘/PDF和作者命名；review无正式报告/PDF；报告翻译无新研究/新权益。不能为填齐spine新增列、receipt或store。

| 验收 | 动作与证据，功能成功及反例 |
|---|---|
| V1 双仓合同与全部消费者 | exact provider21与唯一generator产物按40完整成员对比，实际Catalog产生能力给Website真实validator；角色/参数/父/review/wire/未知运输字段错例拒、未知内容字段不作运输错；新商业3可达、旧3无活动消费者。证据在原native测试/命令输出，不新增verdict。 |
| V2 真实资料与读取承载 | 使用Website原材料Owner从实际冻结来源构建的9产品样包，记录原job/source/material/hash/bytes/书版本及全部目录页；逐项对照原冻结源值/条件/归属/原问题/完整父，证明完整逆向与直接可读，不能用AGENT自制fixture当Website真实包。BZ03/BZ04原reader实际读新父；BZ05分别验证none/provided PDF。受权Provider实际按目录读取，观察读取工具/页续接及结论/引用可核原文；AI自述“读完”、上传卡片、hash/覆盖计数单独不证明完整读取。不满足承载时停受影响Product，补查原材料/原能力合同后更新本文，禁止裁剪或额外隐形回合。 |
| V3 九产品正常业务 | 每个primary至少一个真实受权需求沿原派单执行，分别取得原raw、canonical、领域receipt、PDF实际type/bytes/hash/版本、本人读取下载及原Commercial Manifest。HH无自愿问题仍完整、0/1/2缺BZ05分别核独立权益；人物命名本人BZ05先交付、商业无八字；命名按冻结承诺的数量/全量序/前5/首选两备选、原名字节；专业内容完整性由独立实际阅读，不能用关键词/长度/数量证明质量。合法未知/有条件结果仍可交付；错人/父/权限/不足交付不得假完成。 |
| V4 接收保真与结构 | 各变更Product原自有acceptance采用当前公开合同；JSON围栏、中文、组合字符、原空格/重音、未知字段/嵌套extra、有限数组表示归一保持原内容；两个完整object、坏schema/错锁定身份拒。26review检查其实际原入口：可交finding不重答、subject/result/hash/review_policy错拒；原shared考官退出、付款primary不变。Website唯一领域validator仍核覆盖/引用/数量，不为通过删保护。 |
| V5 翻译/本地化真实闭环 | BZ05/BZ03/BZ04、QM03/QM04、HH02/HH03、人物/商业命名9种新canonical各核source resolver/保护字段/完整结构到非中文译本PDF同身份；不复用译本作事实。名字原文/顺序/关系、引文/来源、条件/不确定性不变。公开文章五语严格zh-HK→zh-TW→en-US→ja-JP→ko-KR、首接中文生成job、后接直接前驱，逐语发布读回。固定catalog同cohort首fresh后续direct-parent，合格字段立即在原页面读回、失败ID原ensure补译；重复ensure/源policy前进仍按原身份，不硬编码旧policy。运行分母分别报告，不相加成全局完成率。 |
| V6 前轮不变量 | 原回归用例和受权故障验证：confirmed/possible恢复不再普通submit，旧DISPATCHED不连坐兄弟；唯一FIFO/lane和job-bound Target；lease/重连/确认丢失按原exact身份；完整stage+Outbox在Browser清理或日志失败时仍先交付；领域A已成B失败/未知只续B，PDF失败不重研究；结果/terminal/HTTP200不冒充admission。现有Runtime/GPT/Browser证明各自独立，不把完整付费旅程塞进Runtime law proof。 |

未来真实操作均需相应授权；V1/V4普通验证不能冒充V2/V3/V5/V6生产证据。每仓唯一`quality:check`分别给结果；AGENT入口`npm run quality:check`，Website入口按其package现役命令，任何Website pnpm/tsx/audit/Exam/quality命令前在同一环境显式选择Node≥24并打印`node -v`。CI-FULL只在用户要求实际CHANGE→READY/推送时激活其冻结正文，不修改Skill、不并发两仓重型READY，观察机器资源但不编造固定超时/降分母。

### 8.2 独立的施工纪律核验

每个D工单在实际工具操作中保留：删除前明确保留决定→实际delete对象→即时文件/符号缺席读取→新合同推导后的新实现→最终引用与原功能验证。沿当前任务操作记录和原项目证据位置，不新建台账/报告。

检查旧联合Product/三route、旧18/48运行绑定、旧PDF/v4/Matrix/coverage考官、共享commonReport/dual/parseReview及其专属附件是否退出；历史原订单/报告/WAL不是删除分母。同时核经裁决保留的独立Flow/父reader/机械原件仍为唯一来源，未复制/换名/包装复活旧骨架、未留下桥或双读。

只有最终diff或READY不足以证明中间纪律。证据缺失报告“无法核实重构纪律”；已证违规报告“未满足重构要求”。最终按对象分别报告：真正重建、经论证保留、局部修改、删除退役、失败回退、尚未完成；不能将Catalog局部登记或公共出口删除统称整片重建。

## 9. 方案审查与交接

主Codex完成正文后依次执行三轮：①五源头→法案/图→逐Product语义；②producer/全部consumer/原子工单→接纳和业务终点；③反向攻击删除/恢复/跨仓切换/他人dirty/证据等级。各轮发现必须在本文修正，不能用百分比自评代替事实。

主审无法再提出具体问题后，按现役subagent-review新上下文分派只读审查。审查者实际读取该Skill、源头、各仓治理和本唯一方案，独立核方案与当前实物的差异；不得写代码或本文、跑服务/Browser/Provider/数据库、创建第二方案。主Codex核事实、唯一写入修订；有依据的问题未消除不得宣布方案完成；原审查者复核受影响部分并明确放行。不以审方案冒称代码已经建设，也不要求未授权施工先完成。

本轮实际审查已完成：主Codex三轮自审分别关闭源头/目录口径、全部消费者与原子Owner、恢复与切换边界问题；两名全新上下文只读审查者`integration_source_law_review`与`integration_contract_closure_review`均已明确放行方案文本。子审发现的HH02资料定位首段角色漏项、Runtime完成模块不存在引用，均已核原件修正并经相应原审查者读回关闭。审查过程与原始意见保留在本任务消息，不另建报告或质量裁决。本段只登记审查事实，不解除下述规范批准与真实验收门；无实质漂移不机械重跑整套设计审查。

执行Codex开工前重新绑定总授权、双仓各自入口/HEAD/tracking、相关dirty、五蓝图和当前provider；只修相关漂移，不重置并行工作。W-A0/W-W0规范批准、原读回材料承载和运行切换条件不得用本方案审查替代。

当前内部施工门：本轮精确对象已获授权；W-A0继任为Runtime003-V47，W-W0继任为Localization017-V2，旧引用与各自原registry已生成对齐。W-D退休旧strict方案，八字指导从现役职责独立重建；必要最小dependency已升21，A1原生成器已生成精确投影；A2、P1—P9、R、S源码及自有验收已形成建设候选，原生CHANGE/READY尚未执行。主Codex已先核源头至规范的语义，再反查规范至全部Product/运输/恢复/完成边界，两轮均未发现未闭合规范差异；这不替代源码建设或原生检查。V2实际材料/模型消费及§7.2运行排空读回尚未取得，分别在其原验收入口接续，不能提前报完成。


2026-10-19建设审查事实：主Codex两轮建设自检后，`integration_build_source_review`及`integration_build_execution_review`已实际审查当前源码与方案，允许进入原生质检；P9提交附件缺少providerDisplayName、P3验收父类别以及P1无消费者_phase均已修正并由相应原审查者读回。W-A1分段审查已核原delete/缺席/生成记录并放行该阶段。原指令、模型与调用坐标保留范围、局部修改、真正重建及S纯删除依各工单分别成立，不统称整片重建。

一项过程偏离仍未闭合：W-P2第7项要求先实际Website父样包与原reader闭合；实际parser在18:08:25Z删除、18:09:20Z新建，18:36:45Z才执行自行构造parent→Website原formatter→保留reader的格式验证。该记录是3接受/9在Child前拒绝的native格式fixture，并非实际冻结来源业务V2。原parent reader未删除或修改，未发现其不兼容；后补验证不能追认前置已执行。两名建设审查者均未放行“全部施工纪律满足/整体施工完成”声明。原生质量可继续，结果不得消除此偏离或替代真实V2、V3、V5、V6及运行切换证明；不为补造顺序再删写成熟reader。
