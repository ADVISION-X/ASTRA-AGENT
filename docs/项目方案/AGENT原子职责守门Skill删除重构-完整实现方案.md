# AGENT原子职责守门Skill删除重构—完整实现方案

状态：已获授权执行 §10 阶段性冻结方案 F1/F2，施工范围为守门 Skill §2 及本方案活动状态；按本次要求完成规范审计、删除重建、施工自检/只读子审查和原生 CI-FULL。质量与推送结论以当前原生候选、唯一质量报告及云仓读回为准，不继承旧 READY。§§1–9 原文保留，仅为前轮已完成记录，旧授权和证据不用于扩大本轮范围。




1. 需求、终点与边界
需求 Owner 为 AGENT.code-purity；真实消费者是进入 AGENT 生产链建设、专业 Skill 边界审查的 Codex。终点是它完整读取唯一重建 Skill 后，能够正确界定本次授权、回到现役来源、保护专业模型与 Child 的局部判断、关闭重复现实动作和错误恢复权限，并把未闭合项交回对应 Owner。这个终点不等于任何 Product 已完成生产。
唯一目标：/Users/nexgen/Documents/AGENT/.agents/skills/agent-flow-boundary-gatekeeper/SKILL.md。
唯一方案：/Users/nexgen/Documents/AGENT/docs/项目方案/AGENT原子职责守门Skill删除重构-完整实现方案.md。
本轮执行已经批准的方案，实施 W0–W2；不重开竞争方案。
AGENT 除明确授权的目标 Skill、本方案精确归属登记及唯一生成 registry 外全部基础设施冻结：Product TypeScript/模型策略/Prompt builder/结果解析、Catalog、Mediator、Runtime、GPT/Child、Browser/WAL、Forensics、存储、日志、UI/API、startup/security、测试与审计、package/配置、法案/Blueprint/spec、Manifest/registry 除上述登记及生成投影外均无写权限。Website 全仓只读。其它十二份 Product Skill 仅是核真依据，不因本方案自动获得修改权限。
冻结先于存在性删除审判；调查发现必要关联修改，也只记录阻断，不能执行或用辅助脚本、Skill 可执行步骤、旁路、动态材料指令或“同一合同”解释绕过。本次精确登记例外已获授权；其它对象仍需分别明确授权才能改变这项边界。

2. 输入与 scoped candidate
AGENT realpath=/Users/nexgen/Documents/AGENT，main，tracking=origin/main，观察时工作树 clean。
Website realpath=/Users/nexgen/Documents/xuanxue-web，main，tracking=origin/main，有付款及结果接收并行改动，全部保留。对带 overlay 的 Website 权威只给当前绑定结论。
AGENT母本 sha256=27a143ecd7016887d056255e106f49caa29d83d06245ff21ea5c0ffd62b98c3a；基础法案=f1970c2416127f8bcdf560d0fd81105895924c4ed2cdd23f6a08ae910998d2f3；功能法案=37fa293fc9fcee920c855936fe9c3887ac5885da09aa8dfb89977f2a37aad752；旧Skill=b450e396dbcd61e1c316cebc2e88d7b1db808713567346b9b5551d2d7b4ebd94。
精确读取相关 AGENTS、母本 §0/4/35 与 §21/23/36–38/46–47/74/77/79；本次 closed-loop-implementation-design 已逐遍完整读取与任务核对，并在压缩后恢复双遍全文。
双仓法案机器记录/引用遍历2轮只证明该观察范围的记录可解析、引用能定位，不宣称510份Website法条全文语义双读，不宣称原生 quality PASS。
绑定文件还包括三份 AGENT V6/GPT/Browser Blueprint、code-purity Blueprint、两仓 task/V6/route provider与dependency（task-result v15、V6 v44、route-capability v4；版本本身不是语义相等证明）、下列真实调用图与相应自有验收。方案自身不进入 source candidate，本方案不保存 CHANGE 候选回执或任务快照；候选比较基准仅在当前对话核对。
最终Website功能法案hash=239f4079835569f8a2cc71810d0062db2f72b736ecc8139f5bdbfcb20bbbc190；其overlay与HEAD的law-record差异仅为commercial-payment-evidence 005/006版本替换，不改变本方案引用的AI-acceptance/AI-boundary法条。Website AA Blueprint=d79dd3fe1cf60edb5c555f8f648f53cf24b0ced547bf2d19b32e35abb703e8eb；task-result源=56610cd409749a37608e5a1598d9e8582dbe445ee57bb0c01d258fc180776c84；route-policies.v1源=dede74af7f97f6730612fa542de7487c74447a669f18edbfcab00ee97daf2cf3；V6 manifest=05563ff1d37a7f9dcd21d20b26989a69090925746e0a0ed53219bd2640a799ca。
网站当前business-result-consumer.ts与domain-dispatch.ts有并行overlay，已回读相应事务/接纳路径。commercial/postgres.ts:withCommercialTransaction/withCommercialClient经AsyncLocalStorage已有client复用，因此调用形式嵌套不等于独立事务。对同client调用事实成立、动态原子性未证明分别表述；不据此拆基础设施。business-result-consumer当前hash=821c5595071054f25709af833afc76724cfd1d06287e96969ce17fd7a439592c，domain-dispatch=61f0f9598d39c62e0f9e35fa0268c0371713d46321cd4eab28eb3aac60ad3971。
执行前重新核对发现 Website AA Blueprint 新增付款截图同事务接纳与 Material Blob Owner 删除职责；完整差异已读，继续复用 v44 主链，不改变本方案的 AGENT 权限或职责。相关法案与上述消费者字节未漂移。
写前或施工前重新核对 HEAD、目标状态和上述相关对象字节；相关漂移重算对应分支，无关并行变化只记录。

3. 现役实现、回归与第一直接断裂
开发 Skill 是 Codex 指令，不是 Product 运行依赖。现有 code-purity Manifest 精确拥有目标，当前无运行时 import；不能新增 dummy import 来制造生产活性。
真实运行图：Website授权业务事实/材料/route → Runtime durable accept → src/mediator/agent-production-route.ts → product-plugin-catalog.ts单次dispatchProductPlugin → 唯一Product静态Flow → GPT public facade → 当前Child局部合同 → Browser typed observation/唯一WAL/物理输入 → GPT读回已完成回答 → Forensics appendArtifact/readArtifact → Product结果 → Runtime同SQLite事务staged result+terminal Outbox intent → Website原领域consumer事务与admission → Runtime核同identity receipt写local completed。恢复授权从Website进入这条链；不是AGENT第二控制环。
Catalog只证明逐Plugin读取同根Skill/NFC文本并放入执行context，不证明实际Prompt消费。BZ05 product-turn.ts:promptFor真实注入正文，runTurn先readConfirmedSubmit再决定是否首次prepare/profile/files/write/submit；SEO seo-turn-prompts.ts不注入Skill，符合Website AI-ACCEPTANCE-BLUEPRINT §G的FROZEN-PUBLIC-KNOWLEDGE-PROVIDER-FORMAT-ONLY-001例外。模型/推理数值由各Product代码拥有；不得统一为当前热门模型。专业要求先按命中Product判定：八字L0/L1→L2与双层表达不能强加给付款截图、翻译、SEO或其它不同合同。
局部认知：gpt/contract.ts显式Child合同；web/gpt-dom-observation.ts:readConfirmedCoherentObservation限定同exact call/Target/Document，真实瞬态才有界fresh observe；open_gpt_attachment_control可DONE零输入或ACT一次；select_gpt_reasoning_from_start_v3已满足时仍按自身冻结合同执行一次确认输入。不能用“已满足一律零动作”覆盖该例外。
回归筛查：目标git提交1e884f2b5实际增加端到端handoff与终点/readback门，当前文件175–195保留。继续保留这项不变量；没有核实该历史提交当时的完整原生验收，不将历史落地称PASS。
旧《生产级子能力稳定性建设规则》《子能力规矩会议记录》里的“内部极强、外部极窄”由现役局部合同/代码支持；其27Child、continuation CAS/Session Controller仅是已过时线索，不成为新Skill来源。现役GPT回答两门禁方案的不重复输入、当前DOM/真实相邻回答定位、已完成artifact读回由当前法案和代码分别复核；不恢复旧页面UUID模型。
没有证据证明旧Skill已经造成某次生产事故。第一直接断裂是旧开发指导本身：226/253赋予Product恢复、227/228设continuation CAS/controller、222/252赋予Runtime泛checkpoint、233定义逐调用取证生命周期，与现役法案明确边界冲突。

4. 四维GAP与修复映射（G1–G7进入W1/W2；G8进入W0；各自绑定下述验收）
G1 授权入口：旧27允许“不加载治理文件”，缺冻结先决门。依据母本§4/35/37/46–47与用户冻结；目标先激活frozen-spec-index、按目标仓定级，退出本Skill不豁免其它治理入口。验收A1/A2。
G2 专业主权：旧表只有Flow边界，缺确定性内容考官禁止。依据LAW-CAPABILITY-GOVERNANCE-002-V4、Website LAW-AI-BOUNDARY-011-V1及BZ05现役Skill专业8项；Blueprint现役Product职责；真实promptFor。目标保护L0/L1与L2区分、完整授权材料/候选、真实原典、支持反证、条件未知、专业/通俗等值；规则在各Product现役Skill，守门Skill不复制业务方法模板/输出Schema，不编代码评分器。验收A3/A4/A5。
G3 Child灵魂：旧227只“零或一次动作”不足。依据LAW-CAPABILITY-GOVERNANCE-001-V18、GPT Blueprint与具体Child合同/handler。目标保留8项显式合同、DONE/ACT/WAIT/FAIL_CLOSED局部瞬时判断、公开仅success/typed failed、coherent facts、直接后置与画像wait边界；第三独立阻断判据默认删除，但正文4条件例外不能丢；DOM字段数不等于门数，canonical bundle只有同Owner同原子产生且整体消费/无相邻重复证明才计一门；冻结submit/response两门禁按自身合同。现役等待时序回LAW-GPT-002-V31：全局普通观察1.5秒、动作后2.5秒、submit后40秒静默、Browser每真实Provider observation一次抽取70–90秒且先释放lane、连续停空20分钟判定并随stop/正文/身份变化归零；Child不能另建timer。数值只作为本候选核真，未来Skill须回当前冻结原文，不复制成独立配置或调度表。验收A6/A7/A8。
G4 恢复/continuation：旧226–228/249–255越权。依据LAW-ARCHITECTURE-BOUNDARY-001-V17、LAW-GPT-001-V64、两仓V6当前合同及Runtime Blueprint。目标Website唯一业务恢复/revision/risk授权；Product仅静态Flow当前授权内的局部分支，不拥有checkpoint planner；continuation仅当前SEO与固定catalog direct-parent授权，不存在store/frontier/CAS/controller；八字父报告只从本轮Website locked事实且fresh。LAW-AGENT-PRODUCTION-RUNTIME-001-V75的领域拒收关闭例外必须完整保留：Website已签completed terminal写回执与该staged payload规范hash相等，同时WAIT_NEW_ATTEMPT、当前attempt/terminal/admission全缺席，Runtime同事务丢该attempt stage并释放席位；随后Website不同attempt/new revision授权以原精确CAS接纳，不要求source seal/evidence。不能扩给Provider first-failure、stopped-empty或未决effect。current_reason只作诊断，不是恢复授权/CAS。lease renew已签剩余预算内5xx/传输暂故障的原lease续租、不同request_id与4xx/回执schema拒绝的立即停止，按该现役条款分别处理，不视为Product恢复或新增attempt。验收A9/A10/A17。
G5 现实输入身份：依据LAW-ARCHITECTURE-BOUNDARY-002-V2、LAW-LOCAL-BROWSER-SESSION-004-V56、LAW-LOCAL-BROWSER-SESSION-006-V45、Browser Blueprint。目标分清job/request、attempt/revision、effect、当前Target/Document、locator与receipt；effect不含attempt/process/fence/Target；parent attempt只用于已完成父job locator选择；未知输入不是零输入；所有未决DISPATCHED须由Browser全历史结算；精确Website风险grant才可新revision指定一次风险输入；保持旧WAL原事实与全局屏障。已知限流唯一内部控制链仍按现役LAW-GPT-002-V31与Runtime001：Runtime注入ProviderRateLimitControlPort，Outbox先持久关无关新claim/未发生submit门，再由GPT唯一关闭Owner执行Product不可见的ack Child；同观察识别后的1秒dispatch例外、2.5秒fresh读回、原CONFIRMED effect保留、targetless notice/receipt、重启不重放ack必须按原文；在途lease/checkpoint/结果交付/admission继续。守门Skill只定位该现役控制反转，不复制实现或造第二控制面。验收A11/A12/A18。
G6 Forensics/交付：旧233逐调用生命周期、258笼统顺序遗漏原子持久门。依据FORENSICS001/002/003现役、Runtime001/005、V6 Blueprint。目标Forensics只已完成raw回答与现役图片最小身份描述同端口写后读回，不增加逐Child账本；Runtime只有现役三表且启动不造升级/修复旁路，完整结果和terminal Outbox intent先同事务落地再做诊断清理；原结果可交付先交付；只有领域事务/admission与该业务明确完成门成立才能相应completed。各域完成顺序回原Owner，不造跨仓事务。验收A13/A14。
G7 来源与数量漂移：旧表是旧模型，历史计划可能引用它为authority。母本§4/23/77、现役Catalog/Manifest/审计约束；目标采用简短责任定位+精确源路径，版本/count从本次现役来源取得，不在Skill复制机器分母/字段Schema或宣告历史引用已全清。验收A15。
G8 合法产物：母本§21，governance-paths.ts:pathRole、各Manifest精确ownedPaths。设计时新方案路径owner=0；实施时只按已获批准的 W0 精确登记闭合；不放到history/temp绕开，不覆盖同Owner其它主题方案。方案登记精确例外独立列明，不扩张运行基础设施。验收A16。

已证实来源差异：
- code-purity现役Blueprint第45、68行Product“恢复”及13 primary口径落后上级LAW-ARCHITECTURE-BOUNDARY-001-V17和当前Catalog；按母本§4.2依据上级法案设计Skill，原Blueprint只读，需修源另行授权。
- Website LAW-AI-ACCEPTANCE-012-V40 forbidden数组第12项要求Forensics持久原子proof并逐步可展示precondition/dispatch/postcondition/attempt outcome/ref/hash；AGENT Forensics三条只保存完成回答且禁止逐Child lifecycle。这是证据类型/展示与持久化落点尚未闭合的口径差异；“每步可展示”不能自行推成“每步新增持久账本”，目前没有证明这段文字必然要求第二ledger或证明生产已违反。新Skill必须对受影响动作核实际typed proof/WAL/artifact消费者；仍无法闭合才标明确Owner/contract finding、停止依赖的施工，不新造账本或擅改源。
- SEO现役Product Skill“新attempt必须从research第一步重执行”不能作为覆盖Website精确零提交来源grant的通用恢复法；本方案不修改该Product Skill。需要执行涉及该条款与来源grant的修改时，回读两侧正文并关闭未裁决分支。
以上不阻止编写“识别并停止冲突”的守门指导，不证明这些冻结源已修复。

5. 删除反事实与唯一目标结构
目标片区只有现有SKILL.md整个文件，物理delete → filesystem absent → 同路径recreate；不留.old/backup/转发Skill、不拆references/templates/脚本，不保留旧责任表或兼容基线。
直接复用旧全文不能消除互相矛盾Owner；局部补丁会保留旧默认模型与后置审判，因此选用户指定整片重建。唯一Owner/path和Codex消费入口复用，不建新domain或机制。
新文件仅8段：
①name不变、description准确包含生产链/Skill边界审查，说明开发指令身份；
②总授权与基础设施冻结，先frozen-spec-index再本Skill适用性；
③当前来源/仓库/候选绑定、按命中读取、漂移与冲突停止；
④专业语义与确定性机械真相边界，包括当前Product专项例外，绝不统一Prompt注入/模型/回合；
⑤Child内部强判断外部窄接口，既保护局部认知也限制多独立门/副作用；
⑥恢复、effect/Target/locator、Forensics/交付的Owner定位与已冻结红线；
⑦受影响链原子责任→相邻handoff→业务readback，有限真实分母、存在性删除反事实；
⑧实际差异反查、授权外停止、质量等级与输出边界。
删除①失去唯一发现身份；删②允许Collateral；删③让旧源冒权威；删④允许代码内容考官；删⑤使Child失去局部判断或隐藏流程；删⑥复活旧恢复/输入与取证模型；删⑦回归1e884f2b5已落地闭环门；删⑧把局部审查冒充生产结果。各失败均由下面案例观察，已无需要独立结构承载的剩余职责。
不引用冻结基础设施为“本次保留生产结构”而给全仓新增删除工单；读取它们只核边界，不能因证据不足物理删除。

6. 原子工单与可达终态
W0 当前主AI：唯一方案内容与三轮自审已完成，精确登记及施工已获授权；仅code-purity Manifest增上述精确方案path，唯一现役audit:build生成registry派生物，保存唯一方案。不手改generated、不改生成器、不改变Owner/law/运行链；生成输出出现其它实际变化立即停止核查。
W1（已明确授权施工）：Owner=code-purity；允许写目标单文件；除 W0 精确登记、生成投影及本方案外，其余一律冻结。仅本地main施工，不建/切/推分支，不借worktree绕过。先重新绑定、检查目标clean/无用户overlay、确认相关当前authority与原生约束。以本方案8段生成完整目标内容并在当前对话/内存校验可重建；随后独立物理删除旧文件；立即用现有filesystem readback确认absent；再于同一精确path创建完整新SKILL.md，读回全文/metadata，执行A1–A15及A17–A18语义检查。任何基础设施GAP都停对应需求，不补代码/源文件。
W2 验收：同Owner/同目标路径，只读取actual diff、全文、反向引用与源文本。目标metadata/name/path唯一；完整读取新正文就是当前Codex消费验收，不另建任务/Agent，不宣称其它已运行会话自动重载；旧违规责任定义在重建Skill零残留，诊断性引用旧禁例不能被当活动命令；不声称旧历史文档字面全仓归零，不删除冻结引用方。Codex在可实际确认读取全文的会话演练上述有限案例，证据只记录本方案/回答，不建评分器、测试脚本或第二report。source diff目标只该Skill且授权外hash相同；方案若有登记特例，其exact diff单独说明。
失败/取消/未知：删除前候选漂移或权限不齐停W1；删除后中断保持“目标缺席、未交付”事实，重新绑定授权后从同一重建步骤继续，不能恢复旧违规Skill、借机恢复旧基础设施或将已删除状态称完成。新正文不合格在同目标授权内纠正整片目标，再重做受影响案例，不能发布/加载为合格。
本轮不运行生产动作/重试/部署。将来若明确要求READY/RELEASE，进入独立授权/clean commit阶段，使用AGENT唯一npm run quality:check -- READY/RELEASE；这不是当前W1完成的附加准入，也不能遇失败后自动解冻审计/基础设施。

7. 有限验收分母与readback
Owner均为code-purity实施审查；其中涉及运行事实的判断只引用相应现役Owner权威，不执行物理动作。每项成功=新全文明确且案例正确适用，失败=有具体位置的设计finding；cancel=停止；来源不明/conflict=停止对应决定并等待精确来源/授权，恢复只回原绑定/重建位置。没有新增运行终态/状态机。
A1 普通日志任务退出守门Skill仍按适用frozen-index读取，不能“无治理”绕过。
A2 新增/删除非Skill基础设施，即使不可分割或存在性不明，仍阻断等待该对象的明确授权；已有授权按其精确范围继续，不重复请示。
A3 BZ05完整L0/L1/原典候选→L2专业判断；未知保留支持结论与条件，不模板化“无法确定”，不反写事实。
A4 以regex/长度/词表判专业质量并触发failed/retry，禁止；模型同轮自检允许；不能新增Provider轮；只排除启发式内容质量裁决，不把源码/audit用rg/regex发现候选问题也误判为内容考官。
A5 已发布机械schema/身份/hash/授权/effect-once仍失败关闭；公开输出请求不能擅自扩成隐藏内容门；unknown-field按当前对应合同。NFC附件精确名优先、唯一合法Provider重复尾缀、空附件集合、submit Prompt投影与response禁止Prompt rehash等机械例外，各自回当前冻结原文；不以语义自由放宽，也不扩大为模糊匹配。
A6 同包多DOM字段不自动当多门；第三独立阻断门按法案默认删除及正文4条件例外处理，冻结submit/response两门禁不扩大。
A7 合格局部DONE/ACT/有界WAIT/FAIL_CLOSED存在，公开仅success/failed；WAIT不得成为持久位置/中央引擎。
A8 “已满足一律零动作”会错误覆盖reasoning-selector冻结一次确认：应按具体Child mutationBudget/readback裁决。
A9 一般Product不得自签恢复/attempt/revision；已经确认输入先readConfirmedSubmit，禁止重跑prepare/profile/attachments/submit。
A10 Bazi fresh、SEO/catalog授权direct-parent continuation、已签两类零提交来源grant分别回现役正文；不恢复CAS/store/父Tab/父回答；不把所有旧checkpoint绝对禁掉而丢法条例外。
A11 Target缺席/新attempt/lease/fence不产生重发资格；parent attempt仅locator选择；effect字段按现役合同不混身份。
A12 未决DISPATCHED禁止新输入；未知不等无输入；风险grant指定call/newrevision且全历史terminal proof/旧WAL保留；不能用新Target或相同Prompt推资格。
A13 Forensics只完成raw artifact+当前图片描述例外；图片descriptor不带URL不造新表；跨仓lifecycle冲突只记录/停相关施工。
A14 staging/HTTP200/terminal/Outbox不是业务完成；本地staged+terminal intent同事务先于诊断清理；同result重交付优先；Website领域事务receipt/readback才成立相应完成。
A15 所有引用回当前原文：SEO Skill不进Prompt专项例外被保留；专业Skill≠Flow；不保存机器分母/第二Schema；历史Product recovery/CAS不变新authority。
A17 领域已签收后拒收关闭与Provider失败恢复不得混同；复核Runtime001所有前置与source seal例外；lease续租运输例外不创attempt，current_reason不作authoritative predicate。
A18 精确已知限流由Runtime原端口先关门、GPT唯一内部ack、Browser原WAL及Website receipt闭合；不把控制反转当第二业务恢复，未知dialog绝不按已知限流点击、建事故或新增输入；已经CONFIRMED effect不退化。
A16 新方案path单一code-purity ownership及生成registry faithful；本次精确登记已获授权。若其它方案未获登记授权，不绕路。

8. 当前证明边界
主AI三轮审查的具体finding与修正写在此方案中；无新报告。只对上述有限分母说“未再发现新增设计问题”，不能保证所有基础设施100%无问题；没有原生quality、READY、RELEASE或动态生产证明。

主AI第1轮审查已完成：按源引用→真实消费者→工单→验收反查。发现并纠正Browser法条前缀误写；G8被误并入Skill施工，改为方案登记W0；局部WAIT只有抽象边界而遗漏现役时序Owner，补齐当前源位置与计时边界；专业案例明确限定命中Product，禁止把BZ05要求扩为十二Product公共模板。本轮未运行原生quality。

主AI第2轮审查已完成：按拒绝/未知/恢复例外逆向攻击。发现一般source seal口径会遗漏已签收结果的领域拒收关闭特例，补齐其所有前置和不能扩张的分支；补齐lease运输故障续租与已知限流的现役控制反转，防止把合法基础设施协作误当第二恢复链；补齐机械Unicode/附件/response no-rehash例外，并明确源码候选搜索不等于自然语言内容考官。所有修正只落在方案内容，源文件继续冻结。

主AI第3轮审查已完成：从实际消费者终点反向追踪到来源、删除窗口、授权边界与候选。纠正Forensics措辞，把已证明口径差异与尚未证明必然冲突/生产故障分开；修正Blueprint引用为45/68；重新绑定Website付款law overlay及consumer差异，沿postgres AsyncLocalStorage确认已有client复用，排除仅凭嵌套调用形状判第二事务的误报；补充main-only、显式全文消费和未自动重载边界。所有发现已经进入对应源差异/工单/验收。再按A1–A18反查，当前有限设计分母未再发现新增问题；该轮设计审查结束时唯一方案登记权限仍缺，故当时未标可施工。后续授权人明确批准既定方案执行，本次仅解除 W0 精确登记与 W1 目标 Skill 施工阻断；三轮审查本身不解冻其它基础设施。

9. 施工正文复核与当前 readback
既定方案执行授权已继承。目标已经按整文件 delete→filesystem absent→同一路径 recreate 完成；name、path 与 code-purity 唯一身份保持，未增加辅助 Skill、脚本或备份。新正文完整读回，现役 quick_validate 元数据校验通过，全部本仓 Markdown 引用实际存在，精确方案与目标各有且仅有一个 code-purity Owner；唯一 registry 由现役 audit:build 生成，仅增加批准方案路径，projection check 已确认 faithful。
正文反查发现并在唯一重建正文纠正：存在性门需明确覆盖本次继续依赖的旧结构，两层证据任一不闭合仍失败关闭；提交事实通过 GPT 公开 facade 取得 Browser typed fact，不授权 Product 直读私有 WAL。原子责任补明可独立证伪记录及多决定拆分，保持 receipt 证明与唯一真相区分。
按 A1–A18 的有限案例人工演练：A1–A2 对应正文§1–2治理退出与精确授权；A3–A5 对应§4专业事实/解释、同轮模型自检与机械拒绝条件；A6–A8 对应§5实际独立门、局部 WAIT 和一次确认例外；A9–A12 对应§6恢复 Owner、两种零提交来源、direct-parent 与未决输入屏障；A13–A14 对应§6完成 artifact 取证与同事务结果/真实 admission；A15 对应§3–4现役来源及 SEO 例外；A16由实际 Manifest/registry 的唯一 ownership 读回；A17–A18 对应§6领域拒收关闭、lease 运输例外及已知限流窄控制链。对明确允许和明确阻断分支分别应用，未再发现这些已定义案例的新增正文问题。此为本次 Codex 全文消费与边界核对，不是独立机器 verdict 或生产动态证明。
原生 quality:check CHANGE 在全部实际文件最终冻结后执行，其真实结果只在本次最终回答报告，不为回填结果改动已检查候选。其它会话是否取得新正文需分别实读；源头已知差异保持原报告位置，未修冻结源。

## 10. 阶段性冻结：当前唯一活动方案

### 10.1 目标、授权与事实等级

需求 Owner 为 AGENT.code-purity；消费者是以后在本仓分析、方案建设和施工的 Codex。交付终点是：它实际读取守门 Skill 后，能区分已证实规则、已验证实现和未证实生产效果；先向授权人讲清改法、收益和风险，再按精确授权修改唯一片区。本方案不执行业务任务、不决定 Website 的恢复授权。

本次授权执行既定 F1/F2，唯一施工仓库为 /Users/nexgen/Documents/AGENT，本地 main、tracking=origin/main；目标为守门 Skill §2 和本方案活动状态。开始时 Skill clean，本方案只有上一轮已完成设计的未提交差异，授权人现已批准在该方案上继续执行。写前及验收在当前对话重新核对 HEAD、目标 overlay 与相关来源，不保存候选路径集合、任务回执或冻结 hash。按本次要求遍历双仓现役法案和施工图；Website 仅只读核规范及接口，不施工、不代做 READY，保留对方 Codex 并行改动。

上一轮方案设计已完整取得闭环设计 Skill 正文两遍并完成三轮自审。本次明确施工授权继承 §10.5 的具体改法、收益、风险及 F1/F2 范围，并要求冻结 ci-full-governance 连续执行 CHANGE→READY→RELEASE；先按冻结索引回读双仓母本及现役规范，由只读子智能体做规范层深度审计，确认对齐后才删除重建。前轮 W0–W2 授权不复活，本次也不修改任何 active law、Blueprint、运行代码、质检实现或数据库；宽泛类别授权不扩大已有具体方案。

前轮基线事实：当时本地与云仓 main 相等，原生 READY/PASS 的39条法案无 finding，20条仍有 deferred dynamic evidence；只证明当时 clean commit 的 READY。当前施工后候选必须重新形成 clean main commit，依次运行原生 CHANGE、READY；RELEASE 另核当前参与仓、合同与真实动态输入。旧证据不证明本次候选、真实旧工单、浏览器加载或 Website 已拿结果。缺失动态事实继续保留，不计算“系统百分之百可靠”。


当前权威入口只复用现役文件：docs/governance/法案系统建设说明书-冻结定稿版.md，.github/instructions/agent-rules/基础法案.md、.github/instructions/agent-rules/功能法案.md；docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md，docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md，docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md，docs/blueprints/code-purity/QUALITY-EVIDENCE-OWNERSHIP-V1-BLUEPRINT.md；.agents/skills/agent-flow-boundary-gatekeeper/SKILL.md；scripts/audit/domains/code-purity/manifest.json 与 scripts/audit/generated/law-registry.generated.json。原生质量证据仅在 scripts/audit/reports/law-quality.report.json，不复制报告/Schema或保存冻结快照。

### 10.2 现役链、前轮连续性与第一直接缺口

现役开发链是“当前任务授权 → frozen-spec-index → 本仓母本/现役法案 → 同一守门 Skill → 当前片区实际差异 → 原生 quality:check”。唯一 Skill 的 name/path、Manifest 归属与 registry 投影已经存在。它是 Codex 开发指导，没有生产 runtime import，也不能假造 import 证明活性。

守门 Skill §2 已有非 Skill 默认冻结、精确例外、已有授权继承及法条解冻门；§3 已有相关漂移反查；§7 已有授权先于存在性删除；§8 已有有限证明与等级区分。因此复用这些成熟规则，不另建冻结服务、状态表或审批器。施工前的第一直接缺口仅在该开发入口：原 §2 尚未明确规定，在新一轮授权前必须给授权人通俗说明具体改法、收益、风险和关联范围。它不证明当前冻结已经导致或解决某个生产故障。


本轮按受影响图做深度核对，回归信号来自用户连续报告、既有两门冻结方案、守门 Skill 重建以及刚落地的 D01/A01 修复。连续性裁决如下：旧两门方案仅作历史线索，其 exact userTurnId 文本定位口径已经由当前 LAW-GPT-002-V31 的原 marker 定位取代，不能恢复；前次守门整文件重建已完成，其中唯一 Owner 和恢复边界仍有效，原施工授权仅属于已完成的那次范围；D01 的异步对象生命周期与 A01 的 marker/旧回执规则在当前代码和原验收中存在，继续保护，不重新重构。不能据提交信息或 Naming 建设过程直接断言某个事故根因。

### 10.3 哪些可以锁住、锁住到什么程度


冻结约束修改行为，合法 claim、合法读取、结果交付和 Website 已签授权下的恢复继续按现役主链运行。下面是本次有限保护分母及来源定位，不是第二份法案、全仓冻结清单或机器 registry；来源变化后回原 Owner 重新核真。 合格答案立即取得、stage 后当前 grant/fence 合法则原 Outbox 立即首发；缺发送授权、传输故障或回执未知仍按原 Owner 的同身份查询/regrant与有限再检查接回。禁止新增成果后固定等待，不等于删除现役 lease/fence、回执核验或未知结果再检查；Browser 缺席/Provider cooldown 不得阻断已 stage 原结果的 delivery-only 授权和交付。


| 保护片区 | 现役来源、唯一责任与实际验证位置 | 本次可确认及保护边界 |
|---|---|---|
| 文本回答身份与结算两门 | LAW-GPT-002-V31 forbidden[6] 的 FROZEN-GPT-TEXT-RESPONSE-TWO-GATES-001；GPT/Browser 当前施工图；scripts/audit/domains/gpt/gpt-frozen-attempt-inspection.ts::textResponseTwoGateSettlementIsFrozen | 规则、当前实现及原 Static/Exam 证据可确认；保留 canonical URL、原 marker、当前 coherent Document 的真实相邻回答和 stop/非空结算，不能恢复 UI 外壳、Prompt rehash 或第三门。真实 Provider 页面全部适配仍未证明。 |
| D01 读取对象生命周期 | local-browser-session；src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts::materializeExactUserTurn；scripts/acceptance/local-browser-exact-assistant-turn-support.ts::scanRuntimeFor/exerciseExactAssistantMaterialization | 保留 await 滚动读取后才 release、对象只释放一次、原读取错误不被清理错误覆盖，以及命中立即取答。代码与原异步验收可确认；不承诺未来页面布局。 |
| A01 本地化 marker 与已确认回读 | 文件治理 architecture-boundary，业务策略由 localization-production 拥有；src/plugins/localization-production/flow.ts::promptFor/executeIsolatedLocalizationJsonTurn；scripts/acceptance/product-plugins/localization-production.acceptance.ts | 保留新 Prompt 首行原 marker；已 CONFIRMED 先回读、沿原 promptHash，零 fresh/profile/write/submit。原长 Prompt 与旧 hash 不同的验收存在；所有真实本地化工单完成未证明。 |
| Provider 等候边界与合格成果快走 | LAW-GPT-002-V31 forbidden[5/8]；GPT/Browser Blueprint；BrowserLaneCoordinator 唯一计时，现役 GPT inspector 与 Browser 验收 | 保护当前合法读取前的保护节拍，不新增 timer；同次合法 observation 已满足两门就立即取答，已完整落地结果按原 Outbox 快走。不能把“立即”改成绕过 Provider 保护节拍，也不能在合格结果后叠加固定等候。 |
| 同 effect 与恢复授权 | LAW-GPT-001-V64、LAW-GPT-002-V31 forbidden[0–4]、LAW-ARCHITECTURE-BOUNDARY-001-V17 的 TOMBSTONE-RECOVERY-AUTHORITY-001；Browser WAL、GPT facade、Website—AGENT Blueprint；scripts/acceptance/architecture-boundary.acceptance.ts | 保留已可能输入先零 submit 回读、未知不等零输入、Browser 原 WAL 全历史终结证明及 Website 唯一精确风险授权；Agent 不自签新 attempt/revision。规则/原验收可确认，真实重启事故恢复效果未证明。 |
| 不复活旧结构及专业边界 | LAW-CODE-PURITY-003-V3 的 FROZEN-EXISTENCE-PROOF-001；LAW-ARCHITECTURE-BOUNDARY-002-V2 的 TARGET-AUTHORITY-BOUNDARY-001；LAW-AGENT-PRODUCTION-RUNTIME-005-V42 的 TOMBSTONE-RUNTIME-LEGACY-MIGRATION-001；守门 Skill §4–7 与各 Owner 原验收 | 保留存在性证明、Target 仅物理坐标、无启动迁移及唯一运行真相。专业 Skill 更新不能暗改 Runtime、Browser、Prompt builder、parser、合同或质检。未核实生产结构只维持默认禁止写入，不称其成熟、必要或合格，也不越权删除。 |
| 有效结果持久化及原链交付 | LAW-AGENT-PRODUCTION-RUNTIME-001-V75 forbidden[4/5/7]；Website—AGENT Blueprint 的 stage/delivery/admission 与 FROZEN-SAME-ATTEMPT-RESULT-REDELIVERY-001；src/lib/local-runtime/production/executor.ts；scripts/acceptance/agent-production-runtime-ledger.acceptance.ts、scripts/acceptance/agent-production-runtime.acceptance.ts | 保留同 SQLite 事务 stage+terminal intent、原结果优先、cleanup/日志不撤结果、未知回执先同身份对账；未撤权需求继续有原 worker 的有界下一动作。Website 的真实领域接纳/结果完成不由 Agent READY 代证。 |
| 唯一质量与等级 | 母本 §35/44/48–64/78–79/85；QUALITY-EVIDENCE-OWNERSHIP-V1-BLUEPRINT；scripts/audit/governance.ts；现役生成 registry/原生报告 | 唯一 quality:check、各 Owner 原证据及真实分母继续生效；CHANGE、READY、RELEASE 和客户结果各自核真。禁止放宽原检查来凑 PASS，禁止另建冻结 verdict。 |

当前不能确认的内容不纳入“生产已证明”：Provider 页面今后不会变、所有旧工单已恢复、Website 所有消费者闭环、20 条法案的缺失动态证明，以及云仓 main 的服务端保护是否能防止所有直接推送。前次 GitHub API 查询未取得登录鉴权，不能从 SSH 推送成功推断云端保护已启用或未启用；本方案不改云仓策略、不把它作为本地方案完成门。

### 10.4 怎么冻结：唯一目标与减法裁决

已生效的默认冻结继续来自现役守门 Skill §2；现役冻结法条及原 Static/Exam 继续由各 Owner 原检查保护。本方案只设计一个补全动作：在原 Skill 的 §2 内完整删除该节正文、确认缺席，再于同节重建，保留原全部边界，增加“授权前通俗说明”和“阶段证据不等全系统生产证明”的开发义务。name、description、§1、§3–8 原样保留；不改其他 Skill，不把本节保护表复制为永久新清单。


这项重建预期达到的 1+1 是：现有精确授权保护继续存在，加上授权人能够理解并拒绝不值得的迭代；由 F2 的通俗说明、窄授权/越界拒绝及保留原边界的正反案例确认，不预先宣称已经提升。没有 Runtime 输入、存储、调度或通信变化，不能声称吞吐或工单速度已提升。若重建反而删掉当前授权继承、法条解冻或冻结先于删除的边界，则未达到收益门，停止交付。

唯一开发消费链仍是 Codex 实读同一 Skill → 根据当前用户授权决定是否施工 → 实际 diff 和原生质量。Skill 是指令，不是文件系统写拦截器；现役 governance.ts::assertAuthorization 主要检查母本/法案的环境标记，assertHighImpactAuthorization 检查新增高影响 surface，均不能验证真实人类授权，也不能拦住所有普通内部重写。原两门 AST/架构字节冻结等原生测试保护各自不变量，不能冒充全仓强制写锁。拥有直接写/推送权限的执行者仍可能违令；本轮不以假“100%机械锁定”掩盖该限制。

删除反事实：去掉原 Skill 则 Codex 丢当前开发入口；去掉新增说明义务则授权人仍无法据通俗收益/风险作决定，故保留同入口最小补全。新增审批服务、台账/JSON、第二 hash 清单、状态/期限表、数据库、Git hook、云端 workflow、chmod 写锁、统一审批 token 或第二质量门均无当前不可替代消费者，从目标中删除。已有 Manifest/registry 精确拥有本方案和该 Skill，直接复用，不新增登记，不改生成器。用户已要求删除重建的片区才执行该动作；其余成熟生产结构不触碰。不能证明必要的结构按现役存在性条款处理，但冻结或未授权对象仅报告并停止相应删除。

### 10.5 真要迭代时：先解释、再精确授权

每次拟修改新的冻结片区，Codex 先交付一段脱离技术术语也能看懂的说明，必须回答：

1. 现在具体坏在哪里，证据是什么；为何已有能力不能完成；没有真实缺口就不动成熟部分。
2. 准备删掉哪块、重建成什么，用户能看到什么变化；精确到文件及函数/章节，必要测试和文档逐项说明。
3. 收益是什么；把已证实收益和预计收益分开，说明用什么实际 readback 验证 1+1。
4. 风险是什么，最坏会影响哪项成熟能力；当前哪些事实仍未知，失败怎样停、原数据/结果/未决 WAL 怎样保全和回接。
5. 哪些现役冻结语义保持、哪些确实需要改变；完成等级和验收是什么，是否涉及推送、发布或 Website 的独立施工。

授权必须能对应这段具体方案、片区和关联对象。已有明确精确授权且事实未实质漂移时继承执行，不重复索要；扩大到新对象或相关漂移改变改法/收益/风险时，先说明新的决定，再申请新增范围。普通“继续/修复/全权授权”不能被自行解释为全 Agent 永久解冻；当前具体说明已列完整范围且授权人明确批准该说明时，按该范围继承，不要求重复抄路径或填写新审批表。

实现修复若保持冻结法条语义，仅申请对应文件/函数与原测试的精确修改例外，不要求无意义地解冻法案。确需改变冻结法条语义时，按原文要求的精确“解冻 <现役冻结 ID>”及 law-amendment 授权；母本变化另需 source-spec-amendment。法案/施工图对齐先于代码。双仓合同冻结语义必须取得双方所需授权并由各仓 Owner 同步对齐，本仓 Codex 只负责 Agent；无跨仓切换证明则阻断该改变，不发明兼容桥。开发修改权限也不能代替 Website 对业务 attempt/revision/风险输入的运行授权。

本次 F1 的通俗授权说明已经具体化：只把同一开发 Skill §2 改成“修改前讲清具体范围、收益和风险”；收益是你能在动手前判断值不值得，风险是文字写错可能让后续 Codex 停错范围或误以为生产已证实。它不改 agent 的运行代码，不能解决尚未验证的工单事故；原 §2 全部保护及 §3–8 的成熟边界必须保持。本次授权已明确批准这份既定说明，按 F1/F2 执行，不重复索要批准。

窄授权表达示例（本次具体授权已成立，不要求复述）：“我理解上述改法、收益和风险，批准 F1 仅重建 /Users/nexgen/Documents/AGENT/.agents/skills/agent-flow-boundary-gatekeeper/SKILL.md 的 §2，并按 F2 核对及原生 CHANGE 验收；其它片区继续冻结。”这只是便于表达的例句，不是审批 token 或机器授权真源；人类可以用明确同义语言批准。授权只覆盖这一次具体任务，完成、取消或撤回后无下一轮写权限；没有时钟到期自动放行，没有全仓 unlock flag。授权不因单纯时间经过失效；事实仍适用的同一未完任务可继续。

### 10.6 原子工单、有限分母与回接

P0（前轮已完成方案设计）：Owner=code-purity；只重建本方案开篇状态并添加本节。独立删除原开篇活动状态 → 读取确认缺席 → 同位重建，旧 §§1–9 字节不改且仅作前轮记录；本节是新设计，不伪称有旧片区可删。验收为当前目标实际差异、主AI三轮审计、所有引用存在、唯一 Owner 及授权外零修改。失败或取消停止方案编辑，不宣称已冻结新 Skill。

F1（本次已授权）：Owner=code-purity；唯一目标为 /Users/nexgen/Documents/AGENT/.agents/skills/agent-flow-boundary-gatekeeper/SKILL.md 的 §2。先核用户对 §10.5 具体说明的批准、目标 Git 状态、当前母本/法案及正文来源；存在未获授权 overlay 或影响决定的来源冲突则停止。先在当前上下文准备完整新 §2，再物理删除原 §2 全部正文并读回缺席，再在原标题下重建。只增加 §10.4–10.5 规定的两个义务，完整保留原治理入口、默认范围、授权先于删除、精确例外继承、法条解冻、其他仓不扩权及 main-only；不复制保护表、不加入审批流程解释器。删除后中断则保持“§2 缺席、未交付”事实，在同一仍有效授权中重新绑定并重建；不能加载缺节正文或擅自恢复旧生产代码。§1/3–8 与 metadata 的字节相等由 Git 原对象读回，不建立备份文件。

F2（本次已授权）：Owner=code-purity；读回完整唯一 Skill，沿 B1–B10 人工审查，核实际差异及授权外字节。真实消费者是当前 Codex 实读后的决定；其他会话须各自实读，不称自动重载。主Codex完成不少于两轮自检后，子智能体只读审查实际 F1 与方案，未放行不交付。唯一机器质量入口按本次 CI-FULL 授权依次执行 npm run quality:check -- CHANGE、clean commit 后 READY、资格成立后的 RELEASE；不新写测试脚本、报告或冻结机制。失败只在获准 §2 内纠正重建并重查受影响案例；冻结基础设施故障报精确 finding 并停关联施工，不自动修它。外部输入或参与仓不可用只阻断相应 RELEASE 调用，不伪造质量结论。

分母只取当前开发授权与原运行边界的十个案例；每个开发决定的 Owner 为 code-purity/Codex，授权输入为当前用户具体任务，输出为当前回答/唯一方案及实际 diff，消费者为授权人或执行 Codex。没有新增持久化状态/Schema；“停止”只停止依赖该决定的修改，不停原业务 demand。

| 案例 | 必须得到的决定、readback 与原链回接 |
|---|---|
| B1 只读诊断或方案 | 按当前等级读取；方案仅写获准唯一方案。不得运行生产重试或改变基础设施。重新请求施工时重新绑定；本次只在既定 F1/F2 范围施工。 |
| B2 Skill 专业建设 | 仅获准具体 Skill；Prompt builder/parser/Runtime 属非 Skill，不能借需求扩大。取得必要对象精确授权后才从原工单接回。 |
| B3 精确实现修复 | 保持冻结语义；通俗说明完整并获具体批准后在该范围施工，所有关联对象有授权；失败保持原事实并修同范围，未覆盖对象停止。 |
| B4 真正改变冻结规范 | 对应原文解冻、law-amendment/母本授权及相关 Owner 对齐不足则设计阻断；补齐后从法案/施工图先行位置接回，不越级进入代码。 |
| B5 仅有旧授权/环境标记/质量通过 | 它们不能证明本轮新范围授权；明确获准的同一未完工单可继承。伪授权拒绝在当前回答说明；从授权人的具体批准接回。 |
| B6 来源漂移、未知或用户 overlay | 不覆盖用户改动；只重算相关决定，未知不能转 PASS/零输入。缺口澄清并重新核权限后接回原片区；无关变化保留。 |
| B7 失败、取消、撤权或删除窗口中断 | 取消/撤权立即停止；删除缺席不是完成。同一未完授权内重绑定后完成同片区重建；撤权后的新修改需新批准。不得盲目重放外部效果。 |
| B8 等待期间已合法读到合格成果 | 两门已满足同次立即取答；已 stage 且发送授权有效即原 Outbox 首发，不等 Browser cleanup/Provider cooldown，不叠加成果后计时。缺 grant 或回执未知只走原同身份查询/regrant和有限再检查，不能盲发或重跑 Provider。真实页面验证不足仍明确。 |
| B9 原结果、未决输入、限流或恢复 | 原结果先交付；未知/未决 WAL 不授输入；原限流控制继续允许在途读回/交付/admission；新风险输入只服从 Website 精确 grant。开发冻结不成为第二恢复门，禁止永久停未撤权 demand。 |
| B10 验收结束或证据缺失 | 当前 Skill 消费与 CHANGE 只报实际已取得结论；动态缺失不称生产完成。本次已要求 CI-FULL/READY及通过后推云仓，使用新 clean main commit 的原生 READY，通过后再推送；RELEASE 和 Website 完成分别由自身证据证明。 |

后续确有运行代码迭代，必须另有具体方案授权；法案/施工图先对齐并由主AI不少于两遍审计后再施工，代码按获准因果片区 delete→absent→唯一重建，先证明 1+1 收益与成熟不变量不退化。重要步骤及最终施工审查按用户规定由子智能体只读审计，不并发写代码，未放行不结束。上一轮仅方案的三轮自审由主AI完成；本次按明确要求先做子智能体规范审计，再做施工后只读审查，不把开发审查叠加成运行读取门禁。

### 10.7 主AI三轮设计审计与交付边界

第1轮：逐项核 authority→真实消费者→修改片区→原生验证。发现活动节的 Blueprint 入口和一处 Runtime 验收用了简称，补为当前完整路径；预期 1+1 收益误用了既成表达，改为 F2 实读正反案例后核真。复核旧 §§1–9 原文相等、方案已有唯一 code-purity Owner、实际差异只有该方案，无新增登记或源文件修改。

第2轮：逐项反查 B1–B10 的成功/拒绝/失败/取消/未知及恢复回接。发现“快走”可能被误读为绕过发送授权或删除未知回执再检查，按 Runtime Blueprint 补明当前 grant/fence、delivery-only 与原同身份查询/regrant 边界；已 stage 结果不被 Browser 缺席/cooldown/cleanup 阻断。核对实现例外与法条解冻、旧授权继承与新范围、Skill 指令与机器写锁、开发撤权与 Website 运行 grant 均分别处理，没有新增 timer/状态/第二恢复链。

第3轮：从授权人能否判断与 Codex 实际全文消费的终点，反查唯一入口、旧记录、删除窗口、权限、证据和原生质量。发现连续性表述把“前次授权”与仍有效的不变量并列，改成旧授权仅属已完成范围，避免把历史授权复活；B8/B9 恢复自然顺序。重新核八个保护片区、B1–B10、精确引用、原文保留、目标唯一 Owner 与零新文件/零授权外修改；当前有限设计分母未再发现新增设计问题。

本次授权消除了原 F1/F2 权限阻断；当前执行沿本节唯一方案，保持 §§1–9 历史原文。前置双仓遍历、规范子审计及主Codex两轮对齐核对发现的问题只在本节和 §2 收束；不以百分比自评或子审查代替原生质量。施工必须展示 §2 全文删除、缺席读取和唯一重建；质量及云仓状态只由当前原生 Git commit、唯一质量报告和真实推送读回证明，不在本方案保存候选身份、并行审计报告或未来 PASS。
