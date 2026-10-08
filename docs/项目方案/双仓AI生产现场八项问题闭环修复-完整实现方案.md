# 双仓AI生产现场八项问题闭环修复-完整实现方案

状态：**可施工（仅设计放行；生产施工须按精确授权及当时来源重新绑定）**。2026-10-08 重绑；三轮主审、两名独立只读审计已放行修正内容。唯一方案沿用本路径，原文件已物理删除并读回 ABSENT 后重新建立，旧内容只留 Git 历史，不搬回旧正文。

## 1. 本轮目标、授权和终点

用户要求回读恢复法案、对比36小时前云仓与现在、闭环 Skill 完整遍历不少于两遍、按片区删除后重构、保住成熟能力并获得1+1提升，主AI三轮审计后才交 audit-only 子智能体，未放行不结束方案建设。随后提出“起名仅留技能、基础设施退回之前”，再明确起名正常使用，并要求评估**在当前基础上重新打通**的难度。本方案采用最新方向：保住起名及当前网站，先修已复现断点，不执行整仓回退。

本轮 CHANGE 只授权重建此方案，不执行生产代码、法案、Blueprint/spec、数据库、服务重启、Browser、工单、提交、push 或 CI-FULL。下述生产工单是供授权后施工的精确范围；旧方案的历史施工授权不能迁入本轮。两仓只使用本地 main；Website已有“全球付款-完整实现方案.md”、SYSTEM-BLUEPRINT.md及审计期间出现的Naming/Hehun upstream用户差异全部保留，不归入起名历史提交或本轮施工。

业务终点不是 claim 200 或 active>0：三张原 job 沿原 demand、原材料及合法 effect 路径取得当前可接纳结果，Website 原 Domain Consumer 完成业务处置并签同 job/result 的 admission receipt，AGENT 核完整回执后 completed，持久业务席位才释放。技术失败、旧代码已修、重新启动或重新授 lease 都不能替代此终点。

## 2. 当前来源、36小时对比和证据界限

固定观察锚：2026-10-08 00:33:53 UTC；36小时界限为2026-10-06 12:33:53 UTC。两仓通过 git ls-remote origin refs/heads/main 核验远端当前 main，并与本地 main/origin/main 一致。历史基线从该远端 main 已有本地对象的 first-parent ancestry 按 before 界限取得；这是云仓源码历史，不冒充36小时前生产部署快照。

| 仓 | 36小时前基线 | 当前 main | 起名提交与直接前驱 |
|---|---|---|---|
| /Users/nexgen/Documents/AGENT | ea38ce6076dc095010e51b10ea56b304d04be5a5，10-06 04:38:02+04 | 6a68904f29e1a630525b241d90648a441904db44 | 68212cc255a557c93ecb78a28c587ad052d5ab4e；前驱0f3c11a480081af5f9be8732eda24cbcf04377d1 |
| /Users/nexgen/Documents/xuanxue-web | 95c57f9dc02b77daf4ab3086c139560eb2c73e7c，10-06 16:25:54+04 | 606e2fc809608e9e7255453d7d6c3f879871b99a | cd9edda427f641af2f986c216798dba7d58345db；前驱d30eb7ab9c5513074700c8f06e58613d11939088 |

两仓母本 SHA256 均为27a143ecd7016887d056255e106f49caa29d83d06245ff21ea5c0ffd62b98c3a。本轮实际完整读取闭环 Skill 两遍，并回读 frozen-spec-index、原子职责守门 Skill、两仓母本/AGENTS、命中恢复法案及施工图。阶段新增决定回读母本§21–24、36–38、40、42–44、74、78，质量及独立审查另依§46、47、79。

输入证据：
- Website粘贴日志：/Users/nexgen/.codex/attachments/8ab5c520-31b3-4e81-ac52-bcacfc9e9607/已粘贴的文本.txt，SHA256 30f2f54fbaf42f582e68d7b2be8ad0d6fb908e814031caae47ef9a050ec16592。
- AGENT粘贴日志：/Users/nexgen/.codex/attachments/17239d15-f877-4b7a-96b1-30ad896f6aa0/已粘贴的文本.txt，SHA256 acc4a7ddb5e134edb2a1d191f9ea2bd6caae834e79e535dcf6db5bb52454193c。
- 原生Runtime日志：AGENT/.grasseye-local/runtime-logs/agent/1ff69177-b6e0-400e-9a6f-8b8308f6e6fd-0001.jsonl。截至00:49:26.781 UTC，cloud.claim失败129次，job.execute事件0；这是这个运行实例的事实，不能说全历史从未执行工单。
- 本机SQLite：AGENT/.grasseye-local/production-runtime.sqlite；Browser真源：AGENT/.grasseye-local/browser/browser-mutations.sqlite。仅以 mode=ro 读取原三表和原 WAL；空旧文件不是现役Browser证据。
- Website原PostgreSQL profile：/Users/nexgen/Library/Application Support/Xuanshu/PostgreSQL/profiles/xuanshu-api.json，使用其socket/role/database及 BEGIN READ ONLY 读回，未写库、签 grant 或修改回执。
- 00:50:07.901 UTC的Website快照仍为下述三单 failed、accepted、未 terminal/staged/admitted；N=3、device active、限流level0。运行事实会变化，施工时必须刷新。
- Runtime运行实例与当前checkout分别绑定：该producer启动于10-07 23:42 UTC，AGENT最新6a68904提交时间为10-08 00:07 UTC。未取得运行制品/原session的agent_build_hash与原startup sourceHash精确等值证明，不宣称该活实例已加载最新HEAD；后续测试先用原入口和现役preflight绑定实际加载源码，不能只读git log判断线上代码。

### Scoped candidate

方案文件不进入源码候选摘要；它自身的文件hash单独审计。以下源码列表按路径UTF-8排序形成 [path,SHA256(bytes)] 数组，以无空白、ensure_ascii=false 的 JSON UTF-8 再取 SHA256；不能用整个 dirty tree 或 plan bytes 冒充来源。

AGENT摘要（27项）：18e4ea60e49a2f83fa4accc2e57c9c07b2e5d795ef01818964186d9af20fc874。路径：
- src/lib/local-runtime/production/ 下 runtime-loops.ts、runtime-source-handoff.ts、runtime-source-readback-proofs.ts、runtime-claim-recovery.ts、runtime-startup.ts、store-task-state.ts、store-source-settlement.ts、store-source-readback.ts、store-outbox.ts、executor-source-checkpoint.ts、route-policy.ts、website-agent-route-policies.v1.json、runtime-business-admission.ts、cloud-reconciliation-client.ts；
- src/capabilities/gpt/ 下 production-execution-session.ts、production-execution-source-reuse.ts；
- src/plugins/naming-bazi-analysis-and-naming/ 和 src/plugins/naming-from-existing-bazi-report/ 各自 SKILL.md、flow.ts、result-contract.ts；
- .github/instructions/agent-rules/功能法案.md、docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json、docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md、scripts/audit/domains/agent-production-runtime/manifest.json、scripts/audit/generated/law-registry.generated.json。

Website摘要（28项）：5de257d7f421f38f370b6e989f01e8082f11fc0049461192259138748173697f。路径：
- services/api/src/ai-production/ 下 job-claim-authority.ts、job-claim-source-lineage.ts、job-claim-repository.ts、job-claim-selection.ts、job-claim-observation.ts、business-result-consumer.ts、business-result-domain-dispatch.ts、output-artifact-routes.ts、website-agent-result-reader.ts、website-agent-result-payload-contract.ts；
- services/api/src/commercial/ 下 payment-evidence-result-consumer.ts、postgres.ts、product-fulfillment-kernel.ts；
- packages/ai-contracts/src/agent-task/ 下 website-agent-route-policies.v1.json、website-agent-task-result.ts；packages/ai-contracts/src/production-control/localization-field-policy.ts；
- docs/specs/ai-acceptance/ 下 website-agent-task-result.provider.spec.json、xuanxue-ai-production-v6.contract.spec.json；docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md；
- .github/instructions/agent-rules/功能法案.md、scripts/audit/domains/ai-acceptance/manifest.json、scripts/audit/generated/law-registry.generated.json、scripts/project-checks/code-purity/limits.ts、tests/exam/ai-production-v6-contract.test.ts；
- docs/blueprints/domains/system-security/SYSTEM-SECURITY-STARTUP-BLUEPRINT.md、scripts/database/database-write-epoch.ts、start.sh、scripts/audit/domains/system-security/manifest.json。

额外工作区观察（只读登记，不授予修改权）：SYSTEM-BLUEPRINT.md的Bazi/Commercial说明增量与claim根因无关；Naming/Hehun upstream改为消费现役mutation-request机械浏览器准入，会影响后续真实网站旅程，不能以历史main比较证明这些未提交字节。观察hash分别为：
- docs/blueprints/SYSTEM-BLUEPRINT.md：3bae7e078d3800197e3f9dd0ab247ccd164c8ecbdfd8275280eb666f20ea9d90；
- apps/web/app/api/naming/upstream.ts：000bdac30aaae514ee837df54bedfd4cb66526083aac12f40805bf85ad106d23；
- apps/web/app/api/hehun/_shared/upstream.ts：12c026179fc977e08116e34de5f8097a82cc71b9c7ff5d0f75f6e0ba4d2e1e40；
- 其现役消费者依赖 apps/web/app/api/_security/mutation-request.ts：bf9dba52a6ca8c1229a509be8a8dae2765c837055c02a31072961d70fc2bdd3d。
未来Q1/原生CHANGE/READY必须按当时完整工作区重新绑定这些相关字节、权限与真实消费者；无关全球付款方案仅保护，不充当本修复源头。该观察不审判并行任务，也不把用户工作复制进本轮候选或提交。

HEAD/tracking或以上相关字节漂移，重绑受影响结论与审计；不清理无关用户差异。此摘要只绑定已读受影响主链，不声称全仓无回归。

## 3. 起名改了什么、哪些已经修复、能否回退

AGENT起名提交共30个路径：6个为两产品的SKILL/flow/result-contract；共享生产变化只在 route-policy.ts 和 provider route JSON 投影；另涉及 generator、法案/spec/Blueprint、Manifest/registry、审计和验收。它没有改动 runtime-loops、source-handoff、claim-recovery、store/Outbox等现役生产恢复文件；这些本轮已与起名直接前驱逐字节核对相同。不能把之后其它提交的Browser、GPT标签修复混记为起名破坏。

Website起名提交确实改了共享通信：task/result合同、route校验、output-artifact上传、结果读取/校验、business-result consumer/dispatch，以及商业kernel。不能仅查Product目录后声称网站通信未动。

发布合同provider16→17，精确route集合仍40，parameter类型仍48，AGENT公开格式投影仍34份。网站route JSON比直接前驱：39条逐项相同，唯一变化为 NM02/naming_from_existing_bazi_report 的 primary route 删除 naming_prior_feedback material；完整反馈改由Naming自己的Brief/Context冻结，不应由Runtime保存。V6运行控制仍v44，task/result wire envelope仍v1，Route Capability Manifest自身语义版本仍v4。provider描述版本不能混说成控制协议版本，版本变化不要求重新enrollment。

专项内存比较已执行：Node v24.20.0，将起名前AGENT通用route校验算法仅绑定到当前v17投影，与当前算法比较40 routes×16个正负样本=640例，接纳决定差异0。它只证明这些机械route分支，既不是原生quality verdict，也不是真实通信/业务交付证明。

当前网站上传的付款分支仍只要求JSON对象和公开schema_version；付款字段/枚举及业务决定属于原payment Domain Consumer。结果reader增加了原对象receipt、attempt slot、hash、bytes、UTF-8与删除事实读回。Naming独立A领域事务、B商业/admission事务只进入 isPrimaryNamingResult 分支；付款、本地化、文章等沿原各自事务。保留这些已知机械安全和产品能力，未证明其制造当前claim409。

前轮真实落地：AGENT f220fa465e8aca9e1b93eb527921620e762de191、Website 0a80fef9c274bcdfc399531c2231cf0e0f8e58c4 已补公开付款格式、去隐藏parser并修接收链，随后AGENT 32493d/0f3c11修真实Browser意图enum断言。旧四份付款回答被拒是历史事实，不能再列“公开格式缺失”为当前未施工项，也不能因代码修好就追认旧拒收答案。

回退裁决：
1. 保留当前正常起名专业Skill及其本产品flow/结果处理、网站Naming资源和历史权益；它调用通用GPT/Browser/Outbox，无权新增通用恢复决定。
2. 保持现役provider17/dependency17及唯一generator的精确机械投影。它是公开合同消费，不是把起名专业逻辑塞入基础设施。
3. 不把全部非Skill文件复制为旧版本。旧审计绑定inactive law/version、弱化新AST/receipt检查；同时Website NM02已只发3份材料，旧v16硬编码要求4份。孤立回退会制造合同/质量失配，且不会消除下述既存409。
4. 撤回不必要基础设施改写应另有精确行为回归证据和1+1收益；当前主链没有证实这种AGENT生产回归，故本轮生产修复不改AGENT基础设施。最新要求是在现有基础上评估打通，本方案不再建设全仓回退工单。

## 4. 问题清单与第一直接断裂

| 现场问题 | 当前裁决 | 处理 |
|---|---|---|
| 起名涉及共享基础设施 | 两仓差异成立，但不能据时间邻近推导所有故障由起名造成 | 保住专业边界及现役合同，专项防回归 |
| 付款公开格式/隐藏parser | 前轮已落地修复；旧失败不等当前缺口 | 不重复施工、不追认旧答案 |
| 本运行实例一个工单未执行 | 129次claim失败、0个job.execute已证 | 修第一拒绝点 |
| AI_SOURCE_REJECTION_LINEAGE_INVALID | Website仅认一次前驱，普通零输入attempt再次恢复时误拒合法连续来源 | W1整片鉴权重建 |
| 单任务拒绝拖住整批claim | 原READ COMMITTED事务任一grantJob抛错就整批rollback；链路未因起名改变 | 修真实合法source被误拒；不跳过错误伪成功 |
| N=3被三旧单占满 | accepted未admission仍计业务席位，符合现役法案；不是active promise数 | 先收敛三单，禁止增加N/删除旧单 |
| C单EXECUTING且没有失败首事实 | 已确认Provider submit，原同attempt恢复入口存在，但被整批领取失败挡住 | 原effect零submit读回，不伪造failure |
| AggregateError/25P03/locale等 | 粘贴日志存在，但未取得导致当前确定性409的因果证据；25P03曾令Website进程退出 | 作为真实验证环境门，复现时沿原cause取证，不凭噪声加修复链 |

**第一直接断裂**：Website services/api/src/ai-production/job-claim-authority.ts::verifyPriorRejectedRevisionHandoff（当前144–178行），从当前普通零输入source只查询直接前驱，再要求前驱必须是 possible 的 rejected result handoff。P单前驱也是 zero，它在176行抛409；更早的合法rejection祖先在完整有签名链里，但此分支没有消费。

已用真实P source与原Website表，在 BEGIN READ ONLY 下调用现役 readSignedSourceLineage/verifySourceHandoff：完整21级signed lineage形状/hash/proof通过，verifySourceHandoff随后在378→176精确抛上述409。L完整7级来源通过，当前source验证返回 replacement=true。没有调用claim写入、生成grant或更改数据库。

36小时反证：job-claim-source-lineage.ts、job-claim-repository.ts、job-claim-selection.ts 与95c57基线逐字节一致；authority仅createReplayGrant TypeScript入参类型收窄，运行逻辑未变。P已有22个accepted attempts及该current attempt的日期早于起名提交，C确认提交发生10-06 10:30 UTC。故当前根阻塞是旧恢复边界未覆盖连续zero lineage，起名升级不是此校验的引入提交。起名更改通信扩大了回归暴露面；实际drain/cutover证据尚缺，不能声称起名切换已安全，也不能凭该缺口断言它创造409。

## 5. 为何必须先恢复，以及三单真实分支

唯一恢复Owner是Website.ai-acceptance。已有可能Provider输入先恢复原效果及原结果，避免重复消费；无结果时，原SQLite source seal、Browser完整历史、未决集合、原拒收/风险回执共同决定下一合法动作。恢复优先既防丢已完成结果，也防新grant绕过席位、租约和去重门。fail_closed关闭当前危险动作，不能永久丢弃有效Website demand。

贯穿身份：job_id/source_task_id/request_hash/冻结materials → source_attempt/typed seal及签名issued_attempt → result_revision与同调用effect集合 → 原Browser WAL/Forensics → 当前结果artifact/receipt → Website领域admission → AGENT completed。attempt/session/fence是临时动作权，不能改业务身份或抹历史；current_reason只诊断，不参与资格。

| 分支 | 当前精确身份与证据 | 合法下一步与终点 |
|---|---|---|
| P付款 | job aiprod_cda50d3e-67dc-49a1-af6d-101a885786f7；attempt ecdf9e8c-78ae-4d2e-a104-4b36d2686803；count22；current Provider输入0；4个旧confirmed结果已由原rejection receipt结算；seal sha256:572dc06111376bd8a440a043daa216eee129aabcc010c5bb7d64750a31410a8a | 核21级来源及全部旧effect结算→原job CAS交接→current合法生产→原付款consumer观察/no_payment_change或其合法决定→原admission。禁止把旧四份已拒结果重新上传作有效结果 |
| L本地化 | job aiprod_814a20e4-7f08-4e98-ade7-f83a53cf5354；attempt 70a1a131-df50-4a1d-9f1d-fbaf72ffe3a7；count8；model-selector-open target-local失败；实际Browser点击存在，Provider输入0；seal sha256:dc5ef094185298c285f41a96b06b4e7c9b8d9c38a507c41ff3ade078a96b0354 | 原有限retry门已过；现役合法source→同job安全交接→原Product执行→本地化准确subset结果→原static consumer/admission。不能把页面点击当Provider提交 |
| C本地化 | job aiprod_1d0c387f-388c-4c98-8dcb-cb4bee456449；attempt c4178280-72ba-45b6-9e6b-941deb3189a1；count1；无failure/stage/source候选；原WAL于10-06 10:30:15.168 UTC确认Provider submit；effect sha256:f64582adf675ca773b1c5d11de14b77a220d988781ee1705b72bf37fdbf6103e | 原同attempt regrant/新fence→Product既有readConfirmedSubmit→同effect exact读回/checkpoint→原结果链/admission。答案存在与否须真实读回；不可因本地EXECUTING或first fact缺失重提 |

其它合同内分支也必须闭合：已stage/Outbox先交付；无全历史输入才普通首次输入；当前risk revision零输入失败保留原attempt/grant；possible且未读回先有界只读；耗尽且可信quiescence才Website原精确risk grant；未决DISPATCHED、proof矛盾、broken lineage先阻断本动作并有限再查；真实取消/撤权/absence只沿原Website处置。未新增状态或恢复矩阵。

## 6. 四维映射、现役承载与难度

| GAP/不变量 | 法案与施工图 | 实现与原生质量 | 工单/验收 |
|---|---|---|---|
| 连续零输入仍可安全恢复、全历史不丢 | Website LAW-AI-ACCEPTANCE-002-V31/004-V30/012-V40；AI-ACCEPTANCE-BLUEPRINT §C（88–100行） | job-claim-authority +原signed lineage reader；tests/exam/ai-production-v6-contract.test.ts 已有单次rejection、risk/slot反例，没有普通rejected→zero→zero用例 | W1/W2，R1–R6 |
| 先结果、单effect、旧fence关闭 | AGENT Runtime001V75/004V44/005V42；Website012V40；双仓V6 Blueprint；Website Security015V4/017V6及Startup Blueprint§3/5 | runtime-source-handoff/claim-recovery、Product readConfirmedSubmit、Browser WAL、原Outbox；原WriteEpoch/start.sh；不是新增worker | O1W/O1A/O2/O3P/O3L/O4A，R7–R10 |
| 起名和付款成熟能力保持 | Runtime003V45及provider17、Website001V7/012V40，Naming现役方案§3.1/9/10 | 原40route投影、公开付款接收、Naming专属两阶段分支、原商业ALS | Q1W/Q1A，R11–R13 |
| 唯一Owner及原生裁决 | 两仓母本§21/36/44/58–63/78–79，现役Manifest/registry | Website ai-acceptance primary-own两个claim文件；唯一quality:check | Q2，当前证据不外推READY |

Website job-claim-authority.ts当前457行（500预算剩43），verifySourceHandoff约73行（75预算剩2）；job-claim-source-lineage.ts124行，已有完整查链算法与循环/重复/hash/proof反例门。重建落点是完整authority文件；复用reader，不新建恢复模块，不往73行主函数叠多级循环。用现有private helper承担单一验证，完整lineage一次读取向相关现有校验传递；避免重复查库与第二套链reader。重建须保持文件≤500、函数≤75、参数≤7、return≤8、nest≤5、complexity≤16、await≤10、imports≤28/sources≤24、exports≤24，依Website现役limits.ts/metrics.ts核验，不能把违规搬到包装层。

难度分层：
- 找到首断裂并实现安全校验：中等。已复现、已有全链reader、无需新API/表/协议/AGENT基础设施；仍必须覆盖多级历史、风险与拒收边界。
- 恢复实际三单到admission：中等偏高。P与L路径有现役proof；C必须真实读回原已确认效果，Provider可读性目前未证明。
- 为所有产品重新做发布级证明：较高，因网站共享接收/事务重写范围广，不能拿一个付款恢复代替40route及真实旅程验证。
- 全两仓回到起名前只留SKILL：高风险且不解决根409，会降掉当前合同和安全校验；本轮否决。
不凭工单数量报几小时必成；源码修复可限定，真实外部恢复时长取决于exact readback和当前法案Dynamic Proof。

## 7. 删除反事实与唯一目标链

唯一链保持：原Website demand → 原claim行锁及source校验 → 原AGENT worker/Product → 原Browser/GPT效果/Forensics → 原Outbox → 原Website上传/terminal → 唯一Domain Consumer/admission → 本地完成。

| 结构单元 | 当前必要性/消费者/删除反事实 | 裁决及验证 |
|---|---|---|
| Website source authority | 原grantJob直接依赖，删除会无安全CAS交接或永远409；唯一Owner ai-acceptance | W1整文件delete→ABSENT→同路径全新重建；旧一层假设物理退休 |
| 原signed lineage reader | 已实读P21级；历史settlement与slot/risk消费者需要；删除会失去完整证据和cycle门 | 复用，不重建已有效reader；不增同义reader/接口/表 |
| 原claim整批事务 | 原grant/event/lease/receipt原子性与未知回复读回消费者依赖 | 保留；坏proof仍整批409回滚；修“合法proof误判”，不catch并skip |
| 原AGENT source seal/Outbox/Browser/Forensics | 原writer closure、去重和结果送达需要；删除会丢effect或出现双发 | 全部复用，保留原三表/历史对象，无新持久化 |
| Product Skill、flow和归一 | 真实Prompt、调用顺序与原文输出消费者需要 | 保留Naming正常能力及其他专业主权；Runtime无专业分支 |
| provider/dependency/projection | 当前双方机械材料/route一致性需要；删除会NM02失配 | 保留v17，唯一generator，不手写恢复v16 |
| 旧audit及新恢复manager等 | 旧audit版本不能裁决当前law；manager/第二状态/队列无真实缺口 | 不恢复旧弱断言、不新增辅助恢复系统或第二verdict |
| 此唯一方案 | 当前用户指定主审/第三方审查和施工交接需要 | 已整文件删除后重建；不建v2、报告包或新治理台账 |

重构的1+1：在不降低全历史effect/receipt/fence/risk安全的前提下，补上普通连续zero来源可恢复性；同一基础设施同时守安全与需求活性。若R1–R6任一旧安全分支下降，不能以“能领取”交付。

## 8. 原子工单、入口出口与停止条件

各工单一次只承担一个Owner的可独立验收动作。所有施工重绑两仓HEAD、相关字节、目标Git状态；有未授权改动停止该路径，不stash/reset/覆盖。

**W1｜Website.ai-acceptance｜重建来源鉴权**
- 精确生产路径：/Users/nexgen/Documents/xuanxue-web/services/api/src/ai-production/job-claim-authority.ts，唯一直接消费者job-claim-repository.ts保持接口。现役law/spec不需改义，不改V6/provider版本。
- 入：现役GrantJobInput、原signed job events/failures、current typed source及readback proof；原grant行锁/事务已由repository拥有。
- 先删除完整文件，工具读回缺席，再按当前法案重新写全职责；不能只改176行、复制旧正文、改名或留旧函数fallback。不得删除数据库、事件、receipt、WAL、材料或用户需求。
- 改掉“zero的直接前驱必须possible”假设，仅替代当前 verifyPriorRejectedRevisionHandoff 已命中的普通attempt_handoff/zero、browser_row_count>0、最新rejection非null分支。没有rejection的全历史零Provider输入来源（如L）、零Browser历史来源及当前same-seal已签issued attempt的现役安全分支继续保持，不能给所有zero强加rejection祖先。
- 该分支消费唯一readSignedSourceLineage的issuedAttemptId→source有签名边；从current exact attempt反向逐级验证普通zero中间腿，直至本轮原rejection锚。中间腿必须same job、合法shape/seal/proof、unique issued_attempt、无环且为普通attempt_handoff/zero；不得横跨新risk revision或尚未结算Provider输入。不能在任意远祖找到一条成功rejection就放行。
- 锚必须是当前revision reader所指的exact最新rejection，其source attempt、confirmed effect、raw first fact、rejected_call、失败账本与原rejection event/body/hash全部等值。current source的proof可能为空，不能仅保留verifyHistoricalSettlements(current)就声称历史已验：复用同一已读lineage，逐个验证拒收锚和链上每个携historical rejection/risk proofs的相关source，明确将该source传给原verifyHistoricalRejectedSettlements(input, source, lineage)及verifyHistoricalRiskSettlements(source, lineage)，由原verifyOriginalRejectionReceipt核每个更早effect的原failure、receipt/body/hash。无historical proofs的节点无需空查；去重只复用同一已验证事实，不能遗漏效应或跳过原验证。历史risk/rejection只结算旧效果，不提供本轮动作权；找当前锚的zero中间腿仍不得跨risk/未结算possible。
- source_task_hash需与原冻结task一致；旧fence、stage/Outbox候选、hash、input-quiescence、risk/zero-slot及prior_result_rejection互斥门完整保持。更早原receipt/failure缺失或错hash即拒绝且零grant，不补写或追认。
- 出：合法ordinary multi-zero返回现役replacement/seal，不新写状态；只有原grantJob CAS才签issued attempt/event/claim receipt。未知响应回原receipt/status读回，不能重复授新attempt。
- 反例R1–R6；结构预算见§6。失败停在source proof gate，需求仍存在，修同Owner后接原claim，不改变N或跳过bad source。若源头原事件不存在/矛盾，保持409，不能补写历史或改法案让它通过。

**W2｜Website.ai-acceptance TEST_ONLY｜补连续来源回归**
- 精确路径：/Users/nexgen/Documents/xuanxue-web/tests/exam/ai-production-v6-contract.test.ts。在原领域普通测试中增加真实关系形状的脱敏fixture，不新增第二suite/registry/评分器；本文件既有测试保留，不删除原risk/slot反例来减少分母。
- 入W1候选；出R1–R6行为断言，必须证明旧一层算法在rejected→zero→zero会失败，当前算法允许合法来源；每个不合法变体仍稳定拒绝且原job/lease/event/receipt增量为零。既有测试文件是TEST_ONLY，生产预算不能误作为拆测试的新借口，仍遵守其原生测试约束。
- focused命令仅作领域证明：Node≥24环境下 npm run ai:production:v6:exam；失败先同故障查法案、真实算法与原测试，不改冻结规范或加豁免。

**Q1W｜Website原生质量Owner｜当前通信与成熟能力验证**
- 不修改生产范围。Website沿原 npm run ai:production:v6:exam、npm run naming:test、npm run localization:terminal:test 及原生quality消费的相关商业测试验证；真实40route合同集、48参数类型、34公开格式逐项核对，不能只比v17字串/hash。
- 出R11–R13：前轮付款格式/负观察/no_payment_change；Naming两个正常Product/未知字段/完整反馈/权益；本地化subset；shared receipt/attempt slot/hash；Naming专属A/B和其余原子事务。
- 本轮640内存比较不替代这些既有tests/当前原生quality。发现新实际回归先绑定触发输入、Owner和精确片区，再更新同一方案及审计，不借此批准共享重写。

**Q1A｜AGENT原生质量Owner｜同合同消费者验证**
- 消费Q1W绑定的当前provider语义，与本仓唯一projection及两Naming Product当前六文件逐项核对；沿现有 npm run acceptance:agent-production-runtime 和原生quality已消费的Naming产品验收验证，不新建第二命令。
- 出R11/R13的消费者机械接纳与原恢复门反例；不执行生产工单，不把它宣称为Website验收。失败回具体合同/实现取证并重审，不降provider17或修改共享基础设施凑PASS。

**Q2｜Website质量Owner｜候选级原生验收**
- 出当前唯一quality:check CHANGE结果；必要授权且原生clean commit后才READY；RELEASE还须全部active law required Dynamic Proof与参与仓当前commit。命令为 npm run quality:check -- CHANGE / READY / RELEASE，逐次核Node≥24。
- Website具有无关dirty用户方案及并行Blueprint/入口改动，不能擅自提交全部以制造clean。没有可合法获得的clean candidate，READY停止；不隐藏/移走用户改动。AGENT生产链未修改，本轮方案差异不被当作已取得AGENT READY；参与仓源码、合法clean commit及实际运行制品分开绑定。真实.next READY构建必须先由O1W合法关闭原网站supervisor；不能在活跃.next上先跑READY后才停服务。执行次序为W1/W2/Q1及CHANGE→O1A收束独立AGENT、O1W seal/停止网站→合法clean commit与READY预构建→O1W安装/准入→O1A原入口恢复→O2–O4真实闭合与required Dynamic/RELEASE；未授权停机时留在CHANGE，不绕开构建占用门。
- 任何finding、候选漂移、错证据类型或缺proof失败关闭。独立方案审计只放行方案，不是第二quality verdict；母本§79若在原生阶段触发，另按该阶段现役来源独立检查。

**O1W｜Website.system-security｜本机同语义修复切换**
- 当前环境只绑定本地Mac production，源头是SYSTEM-SECURITY-STARTUP-BLUEPRINT§2/3/5、Security015V4/017V6、现役Manifest；真实入口为本仓pnpm start→start.sh，以及scripts/database/database-write-epoch.ts的seal/status/preflight-ready/open/assert-open。使用现有xuanshu_write_epoch管理身份、原数据库profile、runtime_identity_ref和新鲜ProtectionStatus，不输出/复制秘密，不新建入口或状态。服务器环境未绑定，infra/deploy的服务器切换不列本轮可直接执行动作。
- W1/W2/Q1W/Q1A及CHANGE完成且已有精确停机授权后，由O1A先收束AGENT独立writer/Provider在途效果；Website Owner取得exact备份与原制品身份，用原WriteEpoch seal并status精确核sealed/runtime identity/epoch，之后才停止本仓原start.sh supervisor及其owned服务。等待原退出与在途事务结束，不盲杀foreign进程，不控制AGENT。
- 关闭活跃Web后才按Q2完成合法clean main READY和原.next预构建、核BUILD_ID等于该commit；安装该单一同语义候选，无DDL/迁移。原start.sh在停旧进程前还须核main/HEAD/BUILD_ID，其自身不负责open。由本仓原supervisor启动Core，管理操作在其仍存活、尚未失败清理时只核现役四组诊断：Renderer /live、API /health、Qimen /live及确定性compute诊断、Web /api/ready，再核exact数据库/制品/runtime identity与新鲜ProtectionStatus。不能把/zh-cn=200、业务/ready能力向量、Worker须write_open的/preflight或整个start.sh成功作为开写前置。诊断齐备后用原管理入口preflight-ready并status精确核preflight_ready、显式open并assert-open核write_open/runtime identity；首页/完整业务准入和六Worker探针均在开写后验证，不由普通重启暗开写权。
- start.sh现有/zh-cn探针等待60秒后会失败清理，故管理操作须在原supervisor仍活且诊断齐备的等待窗口完成上述开写，不能先等脚本完整成功；诊断未齐或已失败退出/进入cleanup则保持sealed，按原最内层故障取证并重审，不改脚本超时、绕过探针或提前open凑ready。blocked Worker不会自动重新准入：若开写后仍有首次sealed阶段遗留blocked Worker，由本仓原supervisor受控退出，再复用同一start.sh/同一candidate重新启动并核各自真实preflight，不能伪称已自动激活或另造worker启动器。随后O1A才能恢复独立AGENT原session。保持V6 v44/provider17/wire v1，不触发Naming CHECK migration、重enroll或改变task/material。
- 本次保持合同语义的安全修复不要求有效三张未完成demand先为零，否则会形成“需先修才能排空、需排空才能修”的死锁。必须关闭实际旧写权及未决effect，保留三张demand/accepted历史/对象，以新同语义算法恢复。
- 起名原方案§9的40route全量语义升级drain不能被当前snapshot补证明；此次修复也不能追认前次升级。后续任何新语义升级仍先按原方案收敛全部旧需求。
- 安装/新写前失败且确证零新写，可按exact备份和完整同语义制品恢复；新write_open或外部effect后只能forward repair及权威对账，不把DB/PITR回滚丢掉同期订单。未决DISPATCHED出现时停新mutation，原Owner只读收束，不重发。

**O1A｜AGENT.Runtime｜独立进程收束与恢复**
- 只由AGENT原Owner在精确运行授权下控制本仓原启动器npm run grasseye:start→scripts/startup/launch-grasseye.mjs及其原signal shutdown/service handle；Website入口不得启动、停止、探测或注入AGENT。保持本仓env、Browser身份和原数据目录，不以删除工单/账本作为stop。
- 在O1W seal之前先停止新mutation、读回当前原WAL/Outbox和在途效果，原关闭入口收束旧durable writer；不能以kill进程证明未决effect已结算。Website切换及写准入精确闭合后才从原入口恢复本仓现役代码/合同preflight，绑定实际startup sourceFingerprint/sourceHash/session build身份；AGENT源码不回退、不按Website候选改写。

**O2｜AGENT.Runtime｜调用原能力恢复原效果**
- 使用现役worker、Product和Browser入口，无代码修改、手写grant、SQLite修行、手工新job或第二循环。先读回原候选/receipt，再由原claim产生当前合法权。
- P/L按§5source branch；C先保持同attempt且对其confirmed effect零Provider输入读回。派发恢复后读取原checkpoint/Forensics、结果Outbox和Websiteartifact/terminal事实。
- C答案缺失时不能直接“重试”：只有原有有界exact negative/typed unaddressable与原Browser input-quiescence均成立，才由Website原risk branch持久签指定调用新revision，仍最多一次新输入并保留旧事实。若条件不足停当前危险动作并有限再查，不承诺必得答案。
- Browser获取当前Target/Document由原Owner负责；无Target的空闲ready不是permission故障。启动或连接故障接原owner入口，不侵入Product专业Skill补恢复。

**O3P｜Website.commercial-payment-evidence｜付款领域处置**
- 消费P原Outbox交付的exact对象/envelope/terminal；原consumer锁序order→evidence→runtime及同事务admission保持。合法负观察允许AI完成且付款no_payment_change，禁止为了释放席位改为付款通过；UNKNOWN先读回原write receipt/对象/postcondition。
- 出P领域幂等处置、原job/result admission与真实readback。不会由Runtime代签或解释付款。

**O3L｜Website.localization｜本地化领域处置**
- 消费L/C原exact结果，准确subset接纳及static admission闭合才标领域完成，禁止删pending翻译叶或空结果过关；未知commit先读回原admission与对应locale叶。
- 出L/C各自原job/result admission和真实本地化readback；不让一个locale成功覆盖另一张job。

**O4A｜AGENT.Runtime｜完成回执闭合**
- 仅复用runtime-business-admission.ts::reconcileBusinessAdmission和cloud-reconciliation-client.ts::readProductionDeviceJobStatus：status接口的原admission shape/identity/consumption_hash验真，terminal_payload_hash等于本地staged envelope hash，admission.result_payload_hash等于staged结果hash，current attempt存在，原completeTask SQLite事务才completed。不让Runtime新增读取付款订单或locale领域存储的完成门、不在Runtime重解释领域结果。领域真实readback属于O3P/O3L及真实验收执行者；artifact receipt reconcile/Browser cleanup仍遵现役后果边界，不能把cleanup失败重新变为领域未完成。原job不变、Provider增量合法、N=3下Website业务占用随其原admission自然下降。
- 最后用已有真实pending需求验证正常领取，不新建测试业务或删除旧需求制造恢复成绩。新证据显示生命周期/receiver/kernel另有回归，回同一方案取证、裁决和重审；接纳未闭合则业务未完成。

## 9. 有限验收分母

- R1：无rejection的全历史零Provider输入（含真实target-local点击）、零Browser历史、单拒收→zero、拒收→zero→zero、P等价21级合法链；current zero的历史非零effect全部已精确结算。只认真实signed边，不依据attempt count阈值。
- R2：missing/duplicate issued edge、cycle、自指、bad seal、跨job、task hash错、跳过最近非零腿：原409、零新grant/lease/event/receipt。
- R3：最新rejection锚错、failure/effect/call/first fact/body/hash错、拿旧rejection作本轮资格：拒绝；四个旧精确拒收答案不追认。专门覆盖current zero proofs=[]、锚A携更早E结算proof的A→zero B→zero C→current D：删除或错写E原receipt/failure/body/hash仍必须409且零grant/lease/event/receipt；相关历史risk proof错grant/call/hash也拒绝。不能以只验A最新拒收或只读signed shape代替E结算。
- R4：intervening risk或possible未结算，current risk零输入失败：保留原attempt/grant；grant兄弟调用与风险/rejection互斥原反例都保持。
- R5：stage/Outbox优先交付、旧fence active拒换、未决DISPATCHED拒新输入、slot-conflict calls=[]继承零submit、no-failure same-attempt恢复保持。
- R6：合法多级P与L同批授予，原事务/receipt一致；恶意P仍全批回滚且原差异为零，不能为了L跳过P。回复UNKNOWN原issued attempt/receipt精确读回。
- R7：P/L三单业务身份与材料不变，C确认effect新物理输入增量0直到合法risk branch；Browser点击与Provider输入分别计数。
- R8：仅取得lease、HTTP成功、stage、terminal或Outbox delivered时，business completed增量0；Website Domain Consumer先闭合原领域处置/admission，Runtime只按原status验真与terminal/staged/result hash闭合本地完成；验收执行者另核领域真实readback，不能要求Runtime跨域读库或拿本地completed代替客户完成。
- R9：重启/断连/上传未知/领域commit未知均沿原Owner回原身份；receipt/object先读回、不重复副作用。
- R10：三个旧需求逐一闭合、席位自然释放、正常既有需求继续；没有新增N/新job/人工状态修复/删除旧证据。
- R11：40route/48参数/34公开格式；NM02三材料与Brief反馈；其他39route原语义保持，六个Naming Skill/flow/result文件与当前正常网站能力不降级。
- R12：公开付款枚举/合法负观察/既决证据读回，Naming A提交B失败/重消费/历史权益，其他产品原事务回滚；原图片尺寸/hash/receipt、slot与删除门保持。
- R13：Node≥24、当前唯一quality、完整现役law/mode/assertion/evidence，未读范围/原生失败不掩盖；Runtime health不得误当客户完成。

R1–R6为W1/W2必须交付的核心反例；R7–R10是真实恢复与业务终点；R11–R13保住前轮修复及起名成熟能力。fixture只证明算法，Browser/Provider/DB/对象/授权/恢复必须用现役active law规定真实Dynamic Proof；本轮不执行，不报PASS。

## 10. 审计与当前交付边界

主审三轮分别核：①36小时因果和前轮连续性；②完整lineage/risk/receipt/fence反例与删除反事实；③原子工单、授权、切换/回退、业务终点和来源漂移。找到问题先修同一方案，再核受影响轮；三轮均无法再找出已知有限分母缺口后才发子智能体。

子智能体只能独立读法案、代码、历史及本方案审计，不写代码/方案、不执行生产动作、不并发施工。具体finding由主AI修正后，绑定新方案hash再审；没有独立放行不得把状态改为可施工或结束方案建设。放行范围必须指出当前方案/候选、已查分母和未查真实Dynamic Proof，不填造百分比或无条件生产PASS。

主审记录：第一轮复核云仓时间线、前轮公开格式修复及实际修改范围，修正文件末尾空行，因果结论未外推；第二轮发现草案会给所有zero来源强加rejection锚，已限定为原命中分支，并补无rejection/零Browser历史正例，保住L等成熟零输入恢复；第三轮发现两仓验收与领域/本地完成混在一张多Owner工单，已拆为Q1W/Q1A、O3P/O3L/O4A，并补运行制品与checkout可能不同的重绑门。三轮后又对独立审计finding回读源头并修正，当前已查有限分母没有未闭合设计finding。

独立审计第一轮：audit_recovery与audit_regression对a9e44675811dadbc45ed07955b99c34ad8f7c7e0f0dad6428335d93d93b78df5暂不放行，提出三项具体finding：历史settlement必须校验锚及携proof的历史source，Runtime不得增加领域直接readback门，安全切换须绑定system-security原入口与seal先行。主AI已回读精确helper/receiver/Startup Blueprint§3/5、WriteEpoch/start.sh，按W1/R3、O4A/R8、O1W/O1A/Q2修正；并保护登记并行用户差异，来源扩充为27/28项。初轮拒绝保留，不填造一次审计即放行。

第二轮切换审计还发现start.sh完整成功不能作为sealed阶段开写前置，否则首页探针可能先失败。O1W现已精确区分开写前四组原诊断与开写后业务/Worker验证，保留原60秒窗口、监督进程和失败关闭；主AI没有修改任何启动脚本。审计期间新增Naming入口test用户差异同样保护，按§2/Q2完整工作区重绑，不授本轮改写权。

独立放行记录：audit_recovery与audit_regression均明确放行修正方案4be56836758ba07dd6d02c4196b610276cdf6543f7fe80388be4de7eaf144a23；相关27/28项来源摘要核对一致，已提出blocking findings全部消除。恢复审计覆盖现役恢复法案/来源链/历史settlement/同effect读回/原完成门；回归审计覆盖36小时因果、Naming共享通信/合同、前轮修复连续性、Owner与实际启动切换门。二者都未执行tests、quality、部署、工单或Browser/Provider/Dynamic Proof；没有证明C答案存在、三单恢复、全部40产品旅程或生产PASS。本文件之后只更新了此状态与真实审计记录，最终字节仍须由二者确认；该确认回执在本次会话，不在文件中递归嵌入自身hash。

执行Codex重新绑定§2候选和实时三单证据、确认精确基础设施例外授权后才施工W1/W2。方案可施工只说明设计具备明确闭环，不代表生产修复、READY/RELEASE、三单执行或客户完成。
