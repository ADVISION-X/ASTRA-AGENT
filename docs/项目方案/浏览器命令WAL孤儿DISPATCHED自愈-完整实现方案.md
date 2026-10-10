# 十二项恢复故障及九个分析产品接力完整实现方案

更新：2026-10-10，Asia/Dubai。唯一文件沿用原路径。需求 Owner：AGENT；网站恢复授权 Owner：Website.ai-acceptance；Browser 只拥有现实操作和回执事实。

**方案状态：可施工。AGENT施工范围见§11；质量结论仅以当前原生quality:check及其唯一报告为准。** 最新授权将本聊天收口到 AGENT 的 CHANGE、READY；Website 的建设、质检、旧工单删除和原订单重派均交其 Owner。本聊天继续完成十二项恢复修复的 AGENT 责任片区与九个分析 Product 合同18消费者，执行实际代码主审、只读子审和冻结 CI-FULL 的 CHANGE → clean commit → READY。部署门只限制运行版本切换，不要求旧任务先完成才能建设；本轮不执行 RELEASE 或生产切换。

## 1. 终点、授权与不变边界

目标同时成立：旧未决故障不连坐其它具备当前合法资格的工单；故障工单先找回并交付已有结果，确实取不到时由网站接回同一 job 并授权适当的新 attempt/revision，最终经领域 Consumer 入库；全程不依赖人工删单。终点必须读回同一 job 的业务 admission receipt、结果 hash 和业务对象。Provider 回答、HTTP 200、已发 Outbox、READY、取消、删除都不替代该终点。

这12项不建立12套恢复设施。沿现役 Website claim → Runtime durable accept → Product → Child → 单 Browser lane/WAL → stage/Outbox → Website Domain Consumer 主链，逐项删除真实断裂。每个独立决定拆成原子工单；一个工单只归一个 Owner。

此前用户明确授权法案、施工图、代码、质检和数据库施工，并要求清除 Browser 历史强制阻断、接力九个分析 Product。规范阶段已先完成本方案的 AGENT 窄范围 law-amendment、Blueprint/spec 对齐及主执行者两遍审查，再进入代码；最新指令收口为 AGENT 的 CHANGE、READY，Website 后续工作由其 Owner 负责。母本、基础法案、AGENTS 和冻结 CI-FULL/闭环 Skill 不修改；无关共享改动原样保护，不 reset/stash/移动、提交他人文件。

保留：网站独占业务恢复/新 revision 风险授权；同 effect 至多一次；旧 UNKNOWN 不伪造 zero/terminal；完整 WAL 历史验真；原材料/任务不可变快照；原租约、fence、身份/hash；真实当前物理串行；附件 OR 及提交两门；Target 只表达当前物理绑定；1.5秒普通/2.5秒输入后读取、40秒静默、70—90秒全局 Provider 观察节拍、20分钟持续空回答保护；限流 N/时钟/cohort 惩罚；真实日志；成熟 Ctrl+C 停新 claim、在途收束和资源 close。

永久外部依赖故障不能承诺立即成功。方案必须给其原 Owner 有界单轮处理、保留事实、明确下一动作和回接；不能把网络断开、当前 Native API 仍在途、凭证无效、Store 损坏也叫作应删除的历史阻断。

## 2. 设计阶段权威遍历与基线候选

按各仓自己的 docs/governance/法案系统建设说明书-冻结定稿版.md §0/4/35 定级：本轮含唯一方案写入，为 CHANGE；§46/47 要求相关法案、registry、目标文件，用户另要求双遍源头遍历，已执行。两仓母本 SHA-256 均为 27a143ecd7016887d056255e106f49caa29d83d06245ff21ea5c0ffd62b98c3a。

双仓基础法案和功能法案已两遍逐条核对：AGENT 36 个功能 law-record，Website 509 个；第一遍核正文/边界，第二遍反查每条 summary、forbidden 和本次12项关系，截断段均补齐。不把重复命令、历史摘要或无关目录数量冒充深度。closed-loop-implementation-design 本轮取得至少两次完整正文；压缩后恢复完整双遍核对。frozen-spec-index、现役 agent-flow-boundary-gatekeeper 已激活。其缺失的 switch-repo-authority 引用不产生 Website 写权限；方案仅在 AGENT 落盘。

母本 §14/22/24/35—44/46—47/74/79 约束：只有一个 active corpus/registry/Owner/quality verdict；不创建兼容桥；机器合同变化提升 provider version；实际法条变化同 lawKey +1并精确 supersedes；无规范变化不涨 law 版本。每个仓自己的原生入口均为 npm run quality:check，计划验收分 CHANGE、READY、RELEASE，不能互相替代。

源头 SHA-256：
- AGENT 基础：f1970c2416127f8bcdf560d0fd81105895924c4ed2cdd23f6a08ae910998d2f3；功能：401925ea9abfa880875ed3a2b8f1c551471c2659ae5a10411ed62f236b4560b1。
- Website 基础：6ad826fb1980f78f1bfbffca3417fc4636332596b489d181c607e1032bfaa85f；功能：cfe47625aea23fcb0f54c87cc532a2bbdec70050699d6450baee482fce51f426。
- Website 现役004-V32、012-V45、013-V29、Blueprint V51；provider44、Website task-result18（AGENT dependency仍17，属于并行现役版本差异，按§6.6九个专业消费者及机械合同对齐处理）。本轮不改五阶 fresh 优先级、keyset、单层行锁或派单治理，不覆盖另一 Codex 的施工。

候选表及有限 source 路径见文末。hash 按相对路径字典序，将 path+TAB+SHA256(bytes)+LF 拼接后计算；方案文件另验 hash，不进入 source hash。这是设计事实绑定，不是原生质量候选回执。写前、主审后、子审后复核相关事实；无关变动不扩大范围，相关漂移只重核被影响链。Website 已在本轮由 d728762d 移至2c400957，功能法案 bytes 未变；已重新绑定实际工作树、spec 和相关质检，不拿旧 HEAD 覆盖现役 overlay。

## 3. 实证与前轮连续性

原现场命令044eab8b-c456-4fdb-8750-a1dafc8f0052，job aiprod_704b4d2a-7d31-407c-9738-b70eaadb3f1c，attempt8eeb2f4b-261f-4341-aced-211aab4feabb，revision0，target_local/browser.dom.click.v1，停在 DISPATCHED、terminal_at=null。日志只有 started/prepared/dispatched/shutdown started，不能判定 Ctrl+C 或强杀；默认 physical_input_count=0 不证明零输入。

当前代码证实三道全局门：BrowserLaneCoordinator 用 countDispatched 驱动 readState/nextWaiter/scheduleWake；BrowserMutationStore.prepare 在事务里查询任意 DISPATCHED；Runtime 的 WAIT_NEW_ATTEMPT和风险grant恢复再核全集未决为空。原回执生产者丢失时，等待不能自行变成结果。

另一个独立实证：Extension 抛 BROWSER_COMMAND_ADMISSION_SUSPENDED，canonical browser-errors.json 未定义，strict decoder 拒绝；这不是对原事故唯一首因的倒推。Actor 只在 exact commit ACK或 exact 网站删单 release清 mutationSlot；close/drain不会清槽；lastMutationDeliveryKey 又抑制同连接重发，heartbeat只送心跳。

此前三个指定 job 已经用户授权沿网站 exact unfinished purge 删除，本地消费 exact absence 清理。这是止血证据，不能充当自动恢复验收，已删身份永不复用。本轮不重复删单。

本地此前只读盘点：1105条source行，801为SQL NULL，304有body（16旧shape、288当前V44）；均accepted。未完成任务当前source无待发seal，一个failed任务的当前issued祖先是V44 zero/null。该快照不证明所有祖先可读或网站不存在历史来源，不作现在生产状态结论。

相关有限Git筛查命中反复恢复设计。07a8c4bb改善blocked可见性，13a0a249f改善已有结果快取；92bb5a97c重建GPT/Browser；4029f00d8处理回执/DOM契约。实际代码仍保留本轮断裂。保留结果优先、原效应身份/全历史、附件OR、Ctrl+C、日志真实与Website唯一授权；废止历史WAL全集充当当前资格。旧方案仍未施工的“大规模迁移恢复政策、退役整条AI-BOUNDARY-006、新runtime-shutdown模块、Q1—Q4待另一Owner补定义”均从目标删除，不作为已落地不变量恢复。

## 4. 十二项四维闭环

法案精确修改见§5；B=现役local-browser-session/GPT Blueprint，R=现役WEBSITE-AGENT-V6-BLUEPRINT，W=Website AI-ACCEPTANCE-BLUEPRINT。验收证据见§10；下表固定编号不另换G/D分母。

| 问题 | 第一直接断裂、现役路径/符号 | 唯一负责方与工单 | 转换、输出、Consumer/readback；失败和恢复 |
|---|---|---|---|
| 1 旧操作没有可靠回执 | websocket-actor的command handler/flush；browser-authority-websocket.settleMutationReceipt；WAL DISPATCHED不能到terminal | Browser，B1/B2/B3；法Browser006；B | 有真实fact则strict验真→原WAL CAS→commit ACK；无fact则保留旧unknown，撤原执行许可后进入R1→W1，不能等不存在的terminal；旧effect绝不重发。取消只撤许可、不补结果 |
| 2 旧未决拖其它工单 | lane readState/nextWaiter/scheduleWake；Store.prepare全局SQL；Runtime WAIT分支 | Browser B4/B5、Runtime R2；法Browser003/004、Runtime001；B/R | 物理资格只由此刻lane/permit决定；Store只做exact/effect历史去重；Runtime只消费该job当前网站next_action。其它合格job继续。认证/真正当前在途限制对应现实动作，历史unknown仅诊断 |
| 3 恢复等不到旧回执 | runtime-source-handoff terminalWriterQuiescence/prepareOneSourceHandoff；双方严格source校验及lineage | Runtime R1、Website W1；法Runtime001、AI004/012/013；R/W | 先成果交付，再现役有界exact readback；无锚点产原unaddressable、负读回产原exact_negative；source seal保留unknown→网站原行锁签指定新revision风险grant→原Product入口。依赖失效本轮停止该job，下轮原worker重查 |
| 4 错误枚举不一致 | browser-errors.json→generator→browserCommandErrorCode→strict receipt decoder | Browser B1；法Browser006；B | 唯一枚举定义ADMISSION_SUSPENDED，处置拒绝复用既有码；唯一generator投影，strict receiver仍拒未知码/字段；不能靠放宽任意string修复 |
| 5 坏回执占唯一槽 | Actor slot不清、接收端不ACK，断连后再交坏fact | Browser B2；法Browser006；B | 真实fact非法不commit，不伪ACK；受认证的原command/binding读回WAL后签拒收处置，匹配slot且handler已退才清槽；fact缺失走同一dispose通道的null输入。unknown WAL不删；处置失联由原heartbeat重交 |
| 6 合法fact ACK丢失 | lastMutationDeliveryKey缓存同连接投递；heartbeat不flush | Browser B3；法Browser006；B | 删除该抑制键，原heartbeat每轮最多重交当前单fact/处置请求；新frame sequence、原fact hash。WAL同hash重复为幂等，重新ACK；不同hash拒收。不能重发COMMAND/REPLY冒充事实重送 |
| 7 单job远端失败断批 | reconcileUnfinishedExecutionsWithoutReceipt非absence直接throw；prepareSourceHandoffs单job抛错 | Runtime R3；法Runtime001；R | 按job有限快照逐个处理；该job保留typed原因/原退避，continue其它job。只有共享凭证/会话/Store损坏停止共享危险输入；exact absence仍原purge；不吞异常假成功 |
| 8 孤儿目录停worker | startProductionRuntime把inventory.orphan_directory_count>0直接blocked handle | Runtime R4；法Runtime006；R | 删除目录计数的整体启动门；Store/凭证/来源正常则原worker启动，孤儿诊断保留；相关job文件不可信只隔离该读取，不擅删。exact网站absence才允许原清理；真正Store结构坏仍blocked |
| 9 旧限流确认永久门 | ProviderRateLimitControl.submitGate/canRequestClaimAuthority；Website decideProviderCooldownGate及历史receipt重算 | Runtime R5、Website W2；法AI003/004/012、Browser004；R/W/B | 历史clearance如实保存；当前资格取网站服务器时钟/设备惩罚/cohort，当前每次危险输入取原Browser中央preflight。旧ACK不再必需。真正exact_present生成原incident，mismatch拒本次；原notice/receipt同身份续交 |
| 10 交付清理连坐/第一张饥饿 | reconcileCompletedBrowserTargets任一unsent就return，随后pending[0] | Runtime R6；法Runtime001/004；R | 每job先核自己的结果/Outbox，再遍历现有pending快照各一次，单lane串行清理；A暂失败继续B/C，本轮不再追A，下轮原列表重查；只有真实release/absent读回才settleCleanup |
| 11 日志挡已SENT收尾 | reconcilePendingBusinessAdmissions先require startSpan，未到reconcileBusinessAdmission就throw | Runtime R7；法LOG001-V7 forbidden5；R | 已SENT/admitted路径先只读签回执并原Store完成/Cleanup；坏日志保留sink故障，停新claim/未发mutation/新的云写；不造成功span。未SENT原bytes留存，日志恢复后原Outbox续交 |
| 12 故障占满N | lease释放与业务seat混同；前置故障使recoverable入口不可达 | Website W3（复用验收）、Runtime R8（复用/修相关条件）；法AI003/004；W/R | 原recoverableLimit=MAX+1独立于newLimit，N满仍接回原seat的job；完成admission或Website权威终止才释放，不假WAIT/删单/本地leaseclear释放。逐个完成故障job腾出fresh资格，不为旧故障保留空座位 |

12是分母，不是已完成生产声明。每条都覆盖成功、拒绝、失败、取消/失联；终端故障事实继续由原Owner保留下一动作，domain admission才是客户完成。其它合格job指当前原法案允许的工作，真实单lane占用不被伪报成并行三lane。

## 5. 只改造成断裂的法条片区

不新建恢复law、law目录、总控制器，不退役整条边界法、不搬迁18项004条款，不改八字/合婚/商业订单专业法。现有不同Owner的正交职责继续分属原法条；修的是明确写死的历史门。下表保留设计基线 ID 与精确修订范围。AGENT 已按同 lawKey 的后继版本对齐；当前有效 ID 以其现役法案和原 builder registry 为准，不将表内旧 ID 当作当前法条。Website 后续规范和建设由其 Owner 负责。

| 源头law-record | 精确片区与目标；保持的义务 |
|---|---|
| Website LAW-AI-ACCEPTANCE-001-V7、004-V32 | 001保留持续需求/最终领域接纳，在原同主题约束中明确单job故障不连坐；004 forbidden10及相关“全原WAL terminal/未决为空”条件替换为原结果优先、exact读回、Website指定revision授权；不动排序/领取字段/session/SEO purge条款 |
| Website LAW-AI-ACCEPTANCE-003-V10、004-V32、012-V45 | 003/004冷却片区取消旧confirmed_absent作为当前claim和下一真实incident永久条件；保留N惩罚序列、server clock、当前cohort、6小时恢复；012原机械source/receipt合同同步§6，不搬入专业Product恢复算法 |
| Website LAW-AI-ACCEPTANCE-013-V29、LAW-AI-BOUNDARY-006-V10 | 仅原attempt恢复/poll/terminal全集资格句同步指定revision grant；保留专业边界、Provider effect禁盲重放、Target排除、所有非本次条款；006不整条退役 |
| Website LAW-PUBLIC-KNOWLEDGE-CONTENT-005-V45 | summary及forbidden7/16中的“原WAL相关command全terminal/未决为空”资格片区替换，保留SEO三轮、run/入库、原raw/插件、prepared截止/取消池和exact unfinished purge冻结字节 |
| Website LAW-LOCALIZATION-020-V27 | forbidden7旧job恢复全terminal资格句替换；保留冻结原材料/source/cohort/policy/current译文激活、控制室只读和ensure唯一 |
| AGENT LAW-AGENT-PRODUCTION-RUNTIME-001-V75 | forbidden5及原恢复资格片区取消历史全集门，forbidden8仅替换旧clearance缺失永久关门句、保留新incident本地durable与Website落账/N惩罚，执行§4的该job next_action；保留durable accept、结果先交付、三表、Website唯一授权、source/result CAS与自动下一动作 |
| AGENT LAW-AGENT-PRODUCTION-RUNTIME-006-V46 | forbidden0中的孤儿目录整体阻claim替换为诊断/该文件读取归属/原worker继续；保留盘点、结构验真和exact absence删除授权 |
| AGENT LAW-ARCHITECTURE-BOUNDARY-001-V17、LAW-GPT-001-V64、LAW-GPT-002-V31 | 仅TOMBSTONE/PROVIDER-EFFECT/EXACT-POLL段的“全部terminal才能继续”句同步；原Product/Child边界、材料、两门、exact URL/turn/readback、纯取证和输出职责全部保留 |
| AGENT LAW-LOCAL-BROWSER-SESSION-003-V45、004-V56 | 原历史DISPATCHED阻任意job、prepare全局门、Target/恢复全集门删除；事实查询/WAL持久化保留。004仅旧限流ACK永久资格同步，不删当前exact_present中央preflight |
| AGENT LAW-LOCAL-BROWSER-SESSION-006-V45 | 原clearSlot只准commitACK/网站删单片区增加§6合法拒收/无fact处置；forbidden2第九许可仅同步旧clearance非当前资格、新incident必须真实落账的窄规则；原fact/ACK精确字段、认证/hash、strict decoder、单WAL、当前物理串行保留 |
| AGENT LAW-AGENT-PRODUCTION-RUNTIME-003-V45 | forbidden1/3及summary已写死17/34，窄替换为Website唯一18/40；保留40 routes/48 parameter types、精确唯一生成、全部material/relation/unknown拒绝及无metadata WebP原几何中性义务。版本、分母不是Product专业规则的新Owner |
| 其它 | LOG001/003、Website AI002及八字/奇门/合婚/起名/商业专业义务不改；依赖引用闭包必须精确继任，不能借引用变更重构主题 |

TOMBSTONE-RECOVERY-AUTHORITY-001、FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001、FROZEN-EXACT-TARGET-POLL-RESULT-REVISION-001要求明确解冻与双仓同步；此前用户对这些恢复片区的反复规范授权及明确废除阻断持续有效，未来同次amendment落实“解冻→窄替换→重冻结”。它们没有要求用户逐字报冻结名，不再人为增加批准流程。EXISTENCE-PROOF、ARCHITECTURE-BOUNDARY-002 Target排除、附件/提交两门、Website exact启动、Workbench ingress、corepurpose和SEO exact purge要求的精确冻结条款全部不触碰。


母本§14.7要求dependsOnLawIds只能指当前active ID，§14/§40要求依赖义务变化按同lawKey+1。当前AGENT九条直接语义修订的传递引用闭包另命中Runtime002-V11、004-V44、005-V42、007-V46、008-V47、Capability001-V18、002-V4、Security001-V14：各只继任实际depends引用并按现役+1/精确supersedes，不复制或放宽原正文。这不是新专业法，也不能以“原正文未改”保留失效ID。Website本次八条直接修订的同一现役depends图没有额外传递命中。规范完成时以同一候选重新计算，所有实际命中的spec lawIds、Blueprint、Manifest、inspector/Exam/Dynamic法ID引用随原Owner同步；无命中不扩大。registry只能原builder生成，不手改。

先原law-record删除被替换句并检索不存在，再写入后继版，不加并存例外绕过旧门。版本按施工时已核现役+1；重建唯一registry，同步现役Manifest/check/Blueprint/spec引用。现役gatekeeper Skill §6的“未决不给新输入/旧冷却先停无关claim”政策副本是直接消费者，源头对齐后在该现有Skill相应片区删除旧副本，引用对应现役law/spec；不把本方案升级为Skill里的第二恢复法。冻结CI-FULL/闭环Skill禁止改。

## 6. 唯一合同与原Owner落点

### 6.1 过去未知与现在许可分开

旧command未来不能继续串发，靠现役permit/session/lease/fence及Runtime原source seal，而不是证明旧操作没发生。原Actor的assertActive绑定socket/session/deadline；Debugger每一个真实DOM/CDP/native输入前必须同步调用该原guard。删除executeRegisteredCommand/acquire入口的默认空guard，所有生产调用显式提供；原当前handler/native promise真实结束前保持当前物理串行。socket撤权使旧handler后续输入被拒，不能把promise超时当终止。

旧worker消失后不再要求它生产“我已经停止”的新证明。新Actor的当前许可只授新命令；旧DISPATCHED过去可能发生/迟到的外部后果，保留unknown并纳入网站新revision的风险授权。新session/Target缺席、getContexts、detach或等待时间不证明旧zero/terminal；方案不新增quiescence kind/证明生产者。当前可观测native仍在途属于真实占用，不能冒称历史垃圾；故障仅影响该当前物理资源，交付、网站读回和其它无需该资源的合法工作继续。

### 6.2 Extension ↔ WAL：protocol9升级唯一protocol10

保留唯一MUTATION_RECEIPT控制通道、现有AES认证/单调frame sequence/单槽/heartbeat；没有新队列、timer、持久化表或Browser权限。protocol规范内容变动由原schema/generator同步revision10和固定build身份，旧9执行端不双接收。

原type=fact与type=ack字段/terminal v1/receiptHash算法不改：fact严格解码、绑定原command identity、同一WAL事务CAS并readback后才ACK。合法同hash重送即幂等readback再ACK。合法未ACK槽不覆盖；同effect不能复用新command id绕过历史。

同一通道增加一个处置请求/响应对，仅用于问题5：
- 请求type=dispose，请求exact字段为type、commandId、receiptBindingHash、rejectedFact、rejectedFactHash；rejectedFact为原单槽保留的完整JSON fact，真实fact不存在为null；非null时rejectedFactHash为SHA256(canonical完整rejectedFact)，null时hash也必须null。沿现役frame大小上限，不新增raw持久化；无默认值，禁止unknown field。Actor沿原单槽保留handler返回的原JSON候选再作strict校验，不能先验证抛错把候选丢掉；不另设坏回执槽。只有原handler和native调用退出后才能将该单槽置为待处置，不能在执行中请求释放。
- 响应type=disposed，exact字段为type、commandId、receiptBindingHash、rejectedFactHash、reasonCode。reasonCode只复用唯一错误源中BROWSER_RECONCILIATION_RECEIPT_INVALID、BROWSER_COMMAND_RECEIPT_MISSING、BROWSER_MUTATION_STATE_CONFLICT三个既有规范码，分别表示非法、缺失、与原已commit结果冲突；不是terminal ACK，不设置WAL结果，不给Provider zero证据。
- Node由原Supervisor现役callback接线调用原BrowserMutationStore读取/CAS；transport仍不写WAL，禁止加第二writer。Node必须在当前认证通道解析可绑定的原command/binding；读取原durable WAL精确行并重算binding。bad fact由请求携带的rejectedFact重算canonical rejectedFactHash，并按原WAL identity执行唯一strict terminal校验；不得仅凭hash声称知道坏raw。合法fact尚未commit则仍原CAS→ACK，已commit同hash则原readback→ACK，不能转disposed。null请求表示受认证原Actor在handler退出后没有fact，不证明输入没发生，原WAL仍unknown；不能由Node伪称独立证明旧没有结果。不存在/跨job/binding错/认证错，不签处置，撤相应通道，Actor保留槽事实并在合法重连提交原绑定请求。
- 非法/缺失情况下原DISPATCHED仍原样unknown；冲突保留第一份已经commit的合法terminal。只有原durable行确实存在且Node读回后才响应。不得把坏raw写入Forensics或新失败表；原WAL身份和typed诊断足以证明该拒收，并保留真实sink故障。
- Actor验当前认证frame、三个原slot身份字段/hash完全匹配且handler已退后才清槽。处置丢失由原heartbeat重送同请求，Node原WAL读回签同处置；迟到response不得清新slot。若其间原真实fact到达，先strict CAS；此后处置只按实际row出ACK/CONFLICT，不能伪说未执行。

身份本身坏到不能形成受认证处置请求时，不伪签任何ACK；Actor原捕获permit/slot绑定可形成合法dispose，不依赖坏fact内自报身份。新的command只在当前物理空闲且单槽可接收事实时进入；这是现役单槽可靠交付流控，历史WAL未决不再参与。事实接收/ACK、dispose不占Provider输入lane。

问题6删除lastMutationDeliveryKey，不新增替代缓存。heartbeat最多发送该单槽一次新认证frame；绝不重发现实COMMAND、过期REPLY或伪重跑Provider。

### 6.3 Runtime → Website source：provider44升级唯一45，body不改shape

source identity spine：job_id+source_attempt_id+冻结source_task_hash+first_fact_raw_hash；完整job历史browser_history_hash、call/effect set hash；原seal_hash。Target/Document不进入跨仓恢复授权。所有原required/nullable字段、最多64 calls及每call64 effects、去重、顺序、canonical hash、exact-negative/checkpoint/unaddressable结构不改；不会为旧坏回执或旧producer造新证明。

45同shape的资格规则改变：input_quiescence_proof仍required字段，可为null；zero仍必须null；possible/unknown允许null。非null仍只能是现役真实terminal_wal，严格核原hash、全集及hash([])，它是可消费的历史完整收尾证据；不能将未决hash强写为空。删除“非zero一定要求非null”和所有用此proof/旧unresolved_count当新资格的消费条件。旧强证明本身继续合法，较弱null绝不被解释为zero，恢复风险决定只来自网站指定grant。

AGENT原类型source-readback-contract、validV44SourceHandoff及所有seal/issued/readAccepted/acceptTask事务校验改为唯一provider45语义，原函数若含V44命名在片区重构后仅保留一份非代际别名的canonical校验；不保留V44/V45双reader。Website validSourceEvidenceShapeV6/readSignedSourceLineage/原grant校验同步。body没有version discriminator、字段删增或hash算法变动，已接收V44 exact body+seal按同一45校验仍有效：zero/null和nonzero/真实terminal_wal都是45的严格合法子集。不改签、重hash、backfill历史、不引入archive转换writer。

现存16份pre44 body早已不符合当前44 exact字段，不能借本轮加legacy decoder。切换盘点须沿未完成job的issued祖先实际读回，明确它们是否为当前consumer所需；可达且违反当前canonical/hash时，仅该job保留原SOURCE_HANDOFF_CONFLICT及下一动作，阻止它发危险输入，不能扩大为全局启动/claim门。不得假装历史无效数据已经自动恢复；若要变更该独立历史schema，必须另有实证和独立批准，本方案不扩大12项至历史迁移。

source生产顺序固定：原stage/Outbox成果优先；完整WAL分类；trusted锚点原有限exact读取，缺锚点原unaddressable；已有checkpoint验原artifact；单job当前执行已退出/撤后续许可；原Store同SQL事务stage-vs-seal CAS；签body。旧业务结果未知不要求terminal补齐。网站原job行锁验原snapshot/first fact/call/effect/readback/seal；source valid不等于允许无授权重放，原grant只能签原规定的新attempt或指定revision/call风险。source请求响应丢失沿原request/event/receipt读回；同seal重复幂等，变body拒绝。

只有target_local旧DISPATCHED且经过完整WAL验真、provider_effect历史确证zero时，保留target_local旧unknown而沿原ordinary source；Provider zero不等于所有现实输入zero。WAL来源本身unverified的unknown不能套用unaddressable，仅该job保留来源错误并由原Owner补核，不签风险捷径。

Runtime当前attempt zero须先分三种具体出口，不能把本attempt zero改写possible以讨grant：
1. 已接受risk的原source、grant、settlement及其覆盖的历史Provider effect集合与绑定未变：在原canResumeRiskGrantAfterZeroInputFailure读issued source/原签grant，验当前attempt零输入、同task/attempt/revision/指定call/effect/grant和全历史覆盖，前后完整WAL hash一致、原settlement严格成立；仅删除历史unresolved全集门。沿网站same_accepted_attempt原grant/new fence回接，不产新source、新revision或纯historical_settled来源，不能只凭current zero放行。 这里的完整WAL前后相等指本次裁决的双快照；新当前attempt已验证的零Provider输入准备行可以增加历史行数，不要求它们使旧source的全job快照hash恒定。原授权的旧Provider effect绑定若未变，不能仅因新target-local准备行增加就废弃原risk授权；旧effect绑定变化仍必须进入下一分支。当前attempt已有真实Provider输入或旧grant不覆盖历史均拒此支。
2. 旧terminal迟到等使原sourceEffectSetHash/WAL/anchor绑定变化且历史仍possible/unknown：assertOldEffectGrant保留严格重算等值，旧grant必须拒；同job typed失败→本轮原有界exact读回→当前attempt原seal→Website指定新revision。source-readback-proofs仅对本轮需要重新授权且旧risk绑定失配的effect让当前exact-negative/checkpoint/unaddressable优先，旧risk不能免除本轮读回；有效的旧rejection/checkpoint settlements继续严格消费。先实际读回再拼proof，不封全historical_settled且无可复用checkpoint的非法来源。browser_input_state仍如实表达source attempt，完整job历史由原replay_calls/readback_proofs表达。

原readback_only_calls是恢复执行中的零Provider输入限制：若已签risk的当前attempt为zero、旧source绑定变化而需重新授权，在Runtime原failure reconciliation按完整验真WAL及原issued source指定call筛出未获当前读回证明的trusted effect，传递其精确source attempt/revision/effect/WAL身份给原GPT readConfirmedSubmit入口。该入口只能调用原Browser readSourceConfirmedProviderEffect验真旧CONFIRMED terminal和canonical锚点；禁止将未知terminal改成CONFIRMED。原当前lease/Target/Document控制有限exact checkpoint，原Source Reader每次重验旧WAL身份；只读input不能转为新的submit。原checkpoint/negative观察按真实旧source身份写当前attempt原observation；下一轮原preflight封source，仍先Website指定新revision才可重放。没有trusted可验terminal的effect只走原unaddressable或保留局部来源错误，不添加Child、Writer、外部字段、兼容decoder或第二恢复链。 同call多旧effect保留现役完整分母，每批按原WAL顺序选择一个尚无当前有效证明的精确effect；negative写入后下批推进，合法结果优先交付，不以effect数量当作身份多义。有限checkpoint沿原Forensics按旧source attempt命名空间追加当前唯一checkpoint exact hash的新artifact，保持source45中source_attempt_id与原Source Artifact Reader一致，不覆盖任何旧artifact；执行租约、Target、日志仍属于当前attempt。 未sealed的原source_checkpoint观察，仅当同effect的原source attempt/revision不变且WAL/source effect set绑定变化，才可沿原SourceReader/Forensics重新验真后替换原观察；相同绑定不同proof仍拒绝，旧artifact、WAL与已sealed source逐字节保持。
3. 迟到合法REJECTED/no/physical_input_count=0等使完整job Provider历史真zero：Producer逐原WAL行验来源、状态、真no-input，完整job快照前后相等、replay_calls=[]，当前输入已退出、无可交成果，再原stage-vs-seal CAS封ordinary attempt_handoff/zero/null；Target-local旧unknown不充Provider输入。Website原verifyPriorRejectedRevisionHandoff对已签risk lineage窄验同job/task、父事件issued current attempt、原source seal、指定call集合/call+grant hashes与新zero source/first fact/完整history hash；原租约空后由原job行锁撤旧risk资格、签唯一ordinary新attempt/revision，其delivery_priority_replay_grant必须null。不删prior risk历史、不宽松忽略祖先、不放宽Browser UNNEEDED，不以默认count=0/缺行当真zero。新ordinary source沿现役认证Runtime对完整WAL的封存事实，Website不查询私有WAL、不新增字段/zero证明生产者。

45同shape合同删除delivery_priority_replay的“zero必须payload_slot_conflict非null”条件：zero且历史calls非空必须完整proof，至少一个replay_exhausted才可风险签新revision；全部settled_reusable只准取原checkpoint且零Provider输入，不能给新的输入资格。无payload_slot_conflict须沿readSignedSourceLineage/已签risk证明这些是原risk来源指定调用，完整source_task_hash、call keys和effect覆盖，无额外call，才签calls=[]。缺此已签来源不套任意checkpoint继承，继续原当前attempt零输入成果/读回链。原verifyZeroSubmitAncestor仅消费原payload_slot_conflict非null且全部settled的继承分支，原父grant.calls=[]及proof/hash检查不减，不强套历史未决的新来源。均用一份45 decoder，不加kind/字段/版本reader；旧44合法shape仍为45子集。 同call旧risk_authorized/rejection_settled与新checkpoint可合法共存；settled_reusable iff至少一个真实checkpoint，Store只收集真实checkpoint子集，保留其余已接纳历史血缘，不能要求每个历史effect都有checkpoint。 连续合法零提交来源可在不同seal保留同一checkpoint；原消费者仅对同effect、同kind且完整checkpoint/WAL/anchor内容完全相等的祖先重复事实正常读回，保留每个seal及历史，内容冲突仍拒绝。

旧terminal在source seal、Website grant、new prepare间迟到，原WAL CAS仍只改旧row一次，sealed body/hash不可改签。seal已赢时先原bytes交付取得指定新attempt，再由该当前attempt按上述三支处理新事实；不能重封immutable旧source或等旧seal重新有效。stage先赢则先交成果。

封存历史readback proof不能因serverNow滚动24小时永久过期：provider45在原assertSourceReadbackProofsV6删除serverNow-86_400_000下限，保留canonical ISO、first_observed_at≤observed_at、未来≤serverNow+30秒和原proof/body/seal/hash/身份。它证明封存时历史读回，不代替此刻session/lease/fence/permit；网站仍当前认证、旧租约撤权后签grant。断联>24h原seal原bytes重交/读原event receipt，不能刷新timestamp/hash、重seal或造第二来源链；已接受祖先用同一严格decoder。

已有结果可重消费优先，不增加Provider输入。网站Consumer拒绝而原结果仍可合法消费时只重消费原结果；确需新Provider结果时仍由原领域rejection合同或风险grant明确授权，Runtime不自判。原payload-slot conflict且全部settled时保留calls=[]的zero-submit授权。

### 6.4 冷却：provider45语义；notice/receipt.v7字段和历史hash不改

历史receipt的claim_gate_open仅是网站签发时投影，不能由新政策重新演算后认定旧签回执损坏。双方继续strict exact字段、类型、request/payload/incident/device/dialog/observation、counts等式和canonical receipt_hash；Website verifiedProviderCooldownReceipt删除“用当前decide重算历史claim_gate_open必须相等”片区。原receipt bytes不改、不签第二版本；当前eligibility由原claim/attestation/heartbeat响应的server clock/reason_codes裁决，不把旧bool当当前权威。

当前decide逻辑唯一：pristine按原规则；真实device状态/receipt缺失或不一致仍故障；serverNow未过cooldown_until则原冷却；过期但当前cohort未闭合仍原受限恢复/清算；过期且cohort闭合可领取fresh，不要求历史clearance为confirmed_absent。clearance pending_unknown/not_cleared如实保留，不伪造absence，不抹N惩罚；容量恢复仍N=1、cohort闭合、6小时稳定和原baseline。

Runtime区分新事故事实和旧清理确认，不能整体删除undelivered后凭事故前grant+fresh absent继续：
- 新phase=incident仍先原Outbox durable enqueue并停本次及受当前事故影响的危险Provider输入；原exact request/payload/incident/device/dialog/observation receipt经strict验证持久，或原幂等请求同identity Website落账readback，才证明Website已按该事故降N/设cooldown。丢ACK只续交原bytes/readback，不本地冒收。尚未落账允许session/heartbeat、结果交付、零输入读回和请求当前claim判定，但事故前grant或较新serverNow单独不能恢复危险输入。
- 事故已Website落账后，过期/cohort及当前网站authority决定资格；响应属于当前device/session、时序不早于该incident持久回执，当前N/cooldown已收敛。原clearance pending_unknown/not_cleared/ACK丢失如实保留，不永久堵claim/submit；每次危险输入仍Browser中央preflight，exact_present生成真实新incident，mismatch拒。fresh absent只表达当前页面，不补历史absence。
- 原reconcilePendingIntents/pendingProviderCooldownRequestIds按既有有限列表逐incident处理，未带clearance的初始incident也可原bytes续交；同incident保持incident→clearance顺序。旧已落账事故clearance失败留原Outbox/typed原因，继续本轮其它incident、当前authority查询和其它合法job；新incident未落账仍限制受其影响危险输入。共享凭证/Store真故障按原Owner处理，不空catch、不建队列/timer/账本。 原catch只允许已记录的单incident typed故障进入firstFailure/下一项；401/403或raw共享故障立即外抛，不发送后续incident，不允许更早503遮蔽鉴权失败。原worker先确认已SENT结果；sink不可写时本轮停止后续尚未发出的恢复云写/claim，仍走原finally清理，不造成功span。 同链GPT旧incident循环亦消费现有Runtime-owned ProviderRateLimitControlPort新增的assertIncidentFailureIsolated(error)；Runtime唯一判HTTP/凭证和Outbox故障范围，GPT不导入私有classifier、不自制HTTP清单。只能证明归属的transport/receipt/incident局部故障可保留firstFailure；Store结构/未知typed故障仍外抛。
- Website原assertPreviousIncidentCleared及applyProviderCooldownNoticeState调用删除“上次confirmed_absent才可下一事故”门；复用原device锁、本次known dialog/observation/identity校验、服务器活动cooldown窗口409、同incident幂等/N只扣一次、原cohort冻结/合并。旧ACK缺失但当前资格允许后再遇真实事故，应正常记新incident、递增level/降N，不能覆盖活动事故或重复惩罚。Website AI003/004及对应BP后续事故片区同步。

### 6.5 结果与业务终点

原stage+terminal intent同事务，sealed旧completion不能再写，stage先赢先交付，seal先赢拒旧迟到完成，first fact raw不可变，current_reason不参与CAS/N/恢复资格。SENT或网站已签收/admitted的原结果读取与本地确认不因日志sink坏而停止；未SENT新云写、new claim/new mutation仍守现役日志法。hydrate缺artifacts保留原typed诊断，不新增“本地artifact待确认”状态/投影/恢复承诺，不挡已admitted→complete和N清理，也不宣称本地artifact完整。

九产品未来沿当前唯一18 route格式生产；历史17结果只沿它原冻结身份及原Owner合法readback，不凭新版更改旧body/hash。18接纳能力不能保证所有17未完成任务可重驱，具体限制见§6.7。不得再写“只是dependency机械对齐、Product代码不必改”或“source修订自然不挡一切旧结果”。

### 6.6 九产品接力：现役资料、原消费者与精确重构

Website《八字排盘零事故封口-完整实现方案》§32.13是本次交接输入，§32的Website carrier建设仍由其原Owner负责；本文件是AGENT恢复及消费者接力的唯一施工设计，不建立第二ZIP方案。经授权联系《打通国际支付全链路》，其确认18尚在源码建设、没有安装/重启，AGENT仍17；另有原九SKILL正在该聊天修改，本执行者只读保护其overlay，先接线并核残留而不覆盖对方Skill。

权威保持Website当前唯一task-result18：40 routes、48 parameter types、40 result contracts；task/result envelope仍1，Capability4不变，V6恢复另由§6.3规划44→45。原34格式保留，加六个Qimen/Hehun/Naming现役canonical格式；result_schema_version不因ZIP或descriptor升版，review和报告翻译原材料不改。材料是事实，不下发Skill/Prompt/模型Profile；九primary/followup全部may_issue_instruction=false。

| 单独验收的Product/route | 当前18原序材料与资料定位 | Product内删除片区、唯一格式来源和必须保留 |
|---|---|---|
| Z-BZ05 bazi_chart_interpretation/produce | ordinal0 ready_corpus_archive 八字古籍资料.zip；1 bazi_formal_input 八字命盘资料.zip。私有根八字命盘资料；01身份/02候选政策/03命盘字段/04PDF语义页；07交付约束 | product-turn.runTurn旧0=formal/1=result_contract门、Prompt旧附件指令删除后重构；route.result_contract原Bazi v4格式一次投影；保留完整L0/L1、全部候选/occurrence、BZ02 Manifest与逐原典，自主L2双层伴读，不改已合法Product Profile |
| Z-BZ03 bazi_ai_full_analysis/produce | 0八字古籍ready_corpus_archive；1八字命盘bazi_formal_input。05问题/获准经历、06父报告来源身份与正文；按实际目录遍历获准经历原页 | flow原JSON.parse整体及旧两role门替换为ZIP父身份/完整正文机械验真；product-turn.promptFor消除旧result_contract附件要求，保留现役route内初次问答v1格式。consultation_root及Website direct-parent不变，fresh chat不是续聊 |
| Z-BZ04 bazi_report_followup/followup | 0八字古籍ready_corpus_archive；1八字命盘bazi_input_bundle。01冻结新问题、02命盘、06父报告 | flow.hasFollowupIdentity/readParentReport旧role和JSON整体解析删除重构；原followup父三元组/parameters/hash仍精确，Prompt由route Followup v1格式一次投影；不从项目latest猜父 |
| Z-QM03 qimen_professional_answer/produce | 0ready_corpus_archive 奇门古籍资料.zip；1qimen_business_input 奇门问事资料.zip。01身份约束/02全部候选/03原问题/04逐候选规则矩阵/05语义清单/07交付约束 | 自有flow.promptFor删除result_contract附件指令，投影当前canonical QM03 v8；完整question/候选/anchor/READY receipt分母、原安全约束、单答案和原Profile保留，不偷选候选/重排局 |
| Z-QM04 qimen_report_followup/followup | 0奇门古籍ready_corpus_archive；1奇门问事qimen_followup_input，增加06完整父报告 | 自有flow.promptFor同次替换为canonical QM04 v2和实际archive导航；direct parent/new question锁不减，fresh/单submit/readConfirmedSubmit不变 |
| Z-HH02 hehun_ai_analysis/produce | 0八字古籍ready_corpus_archive；1hehun_input_bundle 合婚资料.zip。01案卷/双授权；02甲/03乙命盘；04各一份共两份BZ05；05问题/依据/case_manifest；06来源映射 | 自有flow.promptFor旧附件格式引用删除，直接投影canonical HH02 v4与原来源导航；角色隔离、双授权、双方完整证据、双层正文/隐私/禁评分保留；不建两个job或改步骤数 |
| Z-HH03 hehun_report_followup/followup | 0八字古籍ready_corpus_archive；1hehun_followup_input 合婚追问资料.zip。含原root材料/08根报告/09全部祖先QA/10新问题与父身份 | 自有flow.promptFor替换为canonical HH03 v2；精确root/所有祖先/当前新问题的原值、source和privacy规则保留，不能只读最近QA或复用旧执行位置 |
| Z-NM01 naming_bazi_analysis_and_naming/produce | 0八字古籍ready_corpus_archive；1bazi_input_bundle 起名联合资料.zip；没有独立naming_business_input附件。01八字/02命盘/03逐人物上下文及已有报告/04完整Brief反馈/05需求Manifest/06PDFManifest | 自有flow.promptFor旧三材料/result_contract附件假设删除，投影canonical combined v1（Bazi naming-basis v1 + Naming v2）；主体alias原证据与独立人物授权、同轮一次联合submit、两份结果分别Domain接纳/PDF必须保留 |
| Z-NM02 naming_from_existing_bazi_report/produce | 唯一ordinal0 naming_context_package 起名资料.zip，无古籍空包/独立Brief/result_contract。01完整人物及已有报告；04需求原文/反馈；05需求Manifest | 自有flow.promptFor旧分开材料指令删除，投影canonical Naming v2；精确复用已授权已交付Bazi版本/hash/Manifest，完整原文/HARD要求/反馈，不能另做BZ05或设固定名字数量 |

所有ZIP media_type=application/zip；ready_corpus_archive是shared_static/classical_source_data/owner_scope_hash=null，私有包是private_owner_scoped/locked_fact/精确owner_scope_hash；引用role、ordinal、bytes/hash、trust/storage/scope仍由原material Reader核当前唯一projection。不是接受任意ZIP或忽略额外/缺失材料。Website四个现役archive Builder（bazi/qimen/hehun/naming-provider-archive）负责原typed事实→确定性ZIP→逆向深等/真实字节及物理集合验真；AGENT不复制这四个Builder或业务codec。

原九Skill中已经成熟的“先00资料目录和身份/约束/交付导航、按record_pages读全页、逐书原文.md与索引.json、不打印大库/不截前N/不只看代表候选、单JSON正文交付、Website PDF”保留。Prompt写明本Product目标、本轮精确问题所在路径或明确无额外用户问题、材料只提供事实，当前route.result_contract是唯一输出请求；07交付约束只是它的只读格式/locked-identity/denominator定位快照，无指令主权。八字三flow已投影route格式，要消除相冲突的旧附件句；其它六flow新增该现役字段的直接投影，不手写第二schema。review分支继续原accuracy/quality指令和精确subject绑定，仅原序subject_result + review_context两份JSON locked_fact材料、may_issue_instruction=false；输出格式仍唯一route.result_contract，不增加result_contract第三附件，不能沿primary ZIP角色处理。九产品均不增加模型轮数、Child、checkpoint、Provider submit、共用Product执行器或中央Prompt模板。

本轮新增ZIP库只为BZ03/BZ04原父报告机械门的真实消费者：AGENT当前无生产ZIP库；用Website已使用的fflate 0.8.2精确直接依赖，在原package.json/package-lock.json登记。两个Product分别在原flow内读已核hash/bytes、task-owned local_path，不落解压目录、不持久新decoded副本、不互导flow；不得自制ZIP parser或扩成公共archive服务。读取实际“八字命盘资料/06_父报告/来源身份.json”和“正文/身份.json”及其record_pages/必要嵌套正文，按原ordinal/count连续重组完整父terminal body（不是旧交接稿中已不存在的06_父报告.json）。以fatal UTF8/JSON及唯一原目录entry、完整count/range/缺页/重复/错序/越界/路径穿越拒绝处理；父ref/hash与原task/parameters精确比对，父正文必为object，错误沿原PRODUCT_PARENT_REPORT_MATERIAL_INVALID，零Provider输入。只读取本机械门必需的分支，不重建整套Bazi业务解码器。其余七Product直接由route/static资料导航和原task.parameters组织Prompt，不为它们新增无必需机械Consumer的Node解包器；模型读取全包，实际完整阅读义务由Skill和模型/独立质量流程承担，测试不能冒称证明模型已读全书。

九个现役result-contract.ts的业务schema/字段/锁定规则没有因ZIP改变。已比对当前Website canonical top fields，原Bazi/Qimen/Hehun机械parser与Naming允许原扩展字段的原值保留，不新增自然语言评分/关键词/字数门，不把Naming未知字段丢弃或改为拒收。Provider格式/身份合格结果原样走现役stage/Outbox/Domain Consumer；网站保留其原canonical/PDF/Manifest/商业终点裁决。没有业务规范变化的纯parser不重构。

输入ZIP不能修复已生成JSON文件卡片而没有semanticText正文的结果回收断裂。本方案在现役冻结两门内要求九Product直接返回一个完整JSON对象正文，不下载文件、不接受ZIP结果、sandbox链接或“已完成文件”作合格checkpoint；原exact checkpoint/readback先行，不能盲重发。如果需求改为回收既有文件bytes，将实质改变FROZEN-GPT-TEXT-RESPONSE-TWO-GATES-001，当前没有该精确解冻授权，仍设计阻断，不能借本次ZIP输入或恢复授权偷偷新增下载器/Child。原风险授权可在本方案§6.3合法条件成立后签新revision；存在文件不证明旧操作zero，也不能以新正文追认旧hash。

### 6.7 网站侧旧工单清理与生产切换交接

用户于2026-10-10明确：旧工单删除并让网站重新派发；随后明确这项操作由网站侧负责，要求本聊天立即建设既定恢复与消费者方案。本聊天不修改付费工单删除入口、不删除数据库旧job、不为旧17补兼容读者、不等待旧Provider答案。十二项未来故障仍沿同一job自动恢复；行政删除后的新任务创建权仍唯一属于Website，不建立第二恢复链。

九类分析产品现有一个未完成旧BZ05：aiprod_17f6beeadc1c87804b9ba49b723de59d，source_task bazi-analysis:67559940c8a74f6d5fdf82dd33b851ea，原order_def0368c-798d-49f4-9df0-630cedef8fff、fulfillment_6d97251314eb12a3c514125a70db57a7，权益active、processor_payment_succeeded，金额5500 minor units，无商业Delivery/报告/结果link。旧冻结两JSON不能原位改为18两ZIP；网站侧保留原付款/权益、主体、同源BZ02 PDF及已交付成果，由原商业Owner清理旧未完成执行子图并派发不同任务身份。原Runtime仅消费Website exact absence并执行现役同job清理，不自行创建replacement job。其它1770张未完成任务不自动归入九产品删除范围。

Website现役Blueprint§A/九产品边界的全部40route清算、旧durable writer零在途、exact backup、匹配双仓及新session epoch仍是生产切换门；它不阻止本轮法案、施工图、代码、质检及CHANGE/READY建设。网站侧提供旧业务处置及何时开放新单的原Owner证据；没有部署门证据只停止切换，不停止本轮建设。本聊天不新增删单接口、删除队列或相关付费重派代码。


## 7. 删除审判与结构承载

对受影响图的实际结构按“必要性/GAP/直接Consumer/唯一Owner/删除反事实/更短复用/旧路零残留”裁决：

| 单元 | 当前必要性、真实Consumer/Owner；删除的具体后果 | 最短裁决与旧路删除 |
|---|---|---|
| 原单WAL/receipt CAS/完整history | Runtime/Website需要effect事实和hash；Browser Owner。删除会允许同effect盲发、丢unknown | 保留schema/原writer，删全局DISPATCHED资格SQL；无新表 |
| 原Actor单槽/handler/guard/heartbeat | 原Node消费合法fact与绑定处置，实际Debugger消费当前guard；Browser Owner。删除会覆盖未ACK结果/旧handler续发 | 保留可靠单槽，重构处置/重交片区；删lastDeliveryKey与坏fact永久门 |
| type dispose/disposed | Node拒收坏fact无法commit，Actor需合法释放；真实Consumer双方原通道。删除即问题5永久占槽 | 不存在可复用的合法negative ACK，原commitACK不能冒用；在原协议增加此必要分支，protocol9旧分支同次替换，无第二接口 |
| 原source seal/readback/Website claim/event/receipt | Website原grant和Runtimeaccept消费，源头身份分别由原Owner输出；删除会无风险授权或双完成 | 保留原结构，删terminal全集资格条件；无新proof/恢复状态机 |
| 原三表/worker/Outbox/current N/recoverable selector | Product/Consumer/原worker直接用，分别Runtime/Website Owner。删除会丢durability/幂等/seat | 原位片区重构；不加WAIT释放接口、名额表、第二worker或队列 |
| 原inventory/日志/清理/关闭 | 文件读取、业务receipt、Target释放和现有shutdown直接消费；各原Owner | 保留事实和真实close，删全局门/错误顺序/pending[0]；不新增runtime-shutdown模块 |
| 原九Product Prompt/ZIP父机械门/唯一route生成器 | GPT和原Product父身份是直接Consumer，分别各Product/Runtime原Owner；删父门会串任务，留旧JSON门则新包进不了执行 | 仅两个既有父门使用必要fflate；九Prompt各自投影原格式，七Product不新增无消费者解包层，纯parser/原Skill专业正文保留 |
| 新恢复总法/迁移18条/整条006退役/统一图/台账 | 没有本轮不可替代Consumer；12项用原Owner足够 | 从方案物理删除相关安排；不改领域专业法、不新增治理文件 |

当前实数：Actor364行、Debugger366行、Supervisor385行、runtime-startup369行、runtime-loops349行、source-handoff282行、Store mutation490行、Website receipt186行、source proof288行、claim selection304行。均先删除被替换片区再重构，不向500行边界文件堆叠新层。源码AGENT预算500行/函数75行/参数7/返回8/嵌套5/复杂度16/await10及import声明28/source24/exports24必须由原检查核实；Website按它自己的原生预算，不借AGENT数字硬套。

Store490行接近红线，B5删原全局SQL片区后减少行数；B2复用public readCommand和原verifyBrowserMutationTerminalFact，由Supervisor现有Owner内处理拒收，不向Store增堆新的处置writer/框架。预计Actor/Supervisor只在原文件重构单槽和回调，写后仍必须≤500行，各函数预算同上。slot处置复用Actor/Node已有单槽、WAL、传输，不新建receipt manager；函数放原Owner文件并有原heartbeat/handler/receiver直接调用。新guard只替换现有默认空函数，不加生命周期服务。cleanup用现有pending列表，不加轮转台账；逐job失败用原typed failure、current_reason及现有下一轮，不加重试队列。原startup关闭函数保持原位，避免为只删inventory门扩成全文件重建。拟改函数碰结构红线时在同一Owner/工单内删除重复判断，必要的同文件直接调用函数拆为真实独立责任；不得增加无消费者包装层。

## 8. 原子工单、片区与依赖

统一施工纪律：先保存本次相关合法事实及用户overlay边界；只删除下表明确片区/旧关联断言，实际检索旧条件或符号ABSENT；再重建一条现役链。成熟未触碰函数不删。不得只加or/例外继续保留历史主门，不通过换名UNKNOWN、复制旧函数、兼容壳/双实现混过ABSENT。每工单完成必须有对应§4分支的输出/读回及§10正反例；失败保留原事实、停该工单危险写，修复后从原Owner接回。

前置A-B、A-R、A-W、A-G只承担各Owner自身法案/Blueprint/spec/原audit引用对齐决定，分别由Browser、Runtime、Website、现有gatekeeper维护Owner执行；不能把双仓所有法条一次mega-work-order。每条实际law revision独立验收registry忠实投影；全部相关权威对齐且主审两遍无finding后才开始B/R/W代码工单。

| 工单 | 仓库/唯一Owner、精确片区 | 独立输出/验收、依赖和失败回接 |
|---|---|---|
| B1 枚举 | AGENT Browser：browser/protocol/browser-errors.json、generate-browser-protocol.mjs的唯一投影、generated文件；websocket-actor-crypto.browserCommandErrorCode与terminal decoder有关枚举 | real producer code闭合strict consumer；未知码仍拒；先A-B，不改附件selector/Child |
| B2 槽处置 | AGENT Browser：chrome-extension/websocket-actor.ts原slot/close/handler/fact处理；transport/browser-authority-websocket.ts原receipt receiver；protocol schema、transport/browser-authority-frame-payload.ts原控制消息decoder及browser-observation-receipt.ts原fact定义；infrastructure/browser-infrastructure-supervisor.ts原回调接线→原WAL绑定readback | §6.2请求响应精确、handler在途不清、bad/null释放、wrong identity不清、WALunknown不变；先B1/协议10规范，重连按原heartbeat回接 |
| B3 重交 | AGENT Browser：Actor flushMutationReceipt、lastMutationDeliveryKey和原heartbeat回调 | 移除同连接抑制；合法重复同hash重新ACK，丢ACK恢复；先B2合同/原CAS；不新增timer |
| B4 lane | AGENT Browser：infrastructure/browser-lane-coordinator.ts readState/nextWaiter/scheduleWake的历史门 | FIFO/单lane/cadence不变，Aunknown不挡B；先A-B。真正当前action仍串行，不编新无输入证明 |
| B6 当前许可 | AGENT Browser：chrome-extension/debugger-runtime.ts send/create/activate原guard消费；extension-target-authority.ts executeRegisteredCommand/acquire原默认空guard片区及其直接生产调用 | 每次native输入必须原有效guard，旧permit撤权后后续native拒；关闭/删除精确Target的既有清理授权不冒充Provider permit。先A-B；当前native未结束保持真实串行 |
| B5 prepare | AGENT Browser：exact-target/browser-mutation-store.ts prepare事务的全局DISPATCHED查询及只有它的错误断言 | 不同合法effect可prepare；同effect/exact/logical mutation历史仍拒；先A-B/B4，schema/历史hash不改 |
| R1 source生产 | AGENT Runtime：production/runtime-source-handoff.ts terminalWriterQuiescence/prepareOneSourceHandoff及preflight历史门；source-readback-contract.ts和runtime-source-readback-proofs.ts原effect事实拼接 | §6.3同shape45生产，unchanged原risk同attempt回接、迟到仍possible、迟到全history zero、>24h原seal重交均有确定输出；先A-R和W1规范，交原R9 seal；旧receipt丢失不等待terminal |
| R9 source封存 | AGENT Runtime：production/store-source-settlement.ts唯一shape/历史settlement读回、store-source-readback.ts原seal/issued/readAccepted校验 | 单一45 validator、原body/hash祖先验真、stage-vs-seal原事务竞争；先R1/规范W1；seal原行读回，失败不改签或迁移数据 |
| R10 接受新grant | AGENT Runtime：production/store-task-state.ts sourceHandoffManifestValid/acceptTaskAfterSourceHandoff原SQLite接纳事务；runtime-claim-operations.ts requireSourceGrantSeal/acceptClaim/reusableCallsFor原消费 | 已封source与Websitegrant绑定后才切current attempt，readback原accepted身份；先R9/W1，原durable accept/旧completion封口不减 |
| R2 next_action | AGENT Runtime：production/runtime-claim.ts及runtime-claim-recovery.ts canResumeRiskGrantAfterZeroInputFailure/WAIT分支；runtime-claim-operations.ts原grant seal验证/接纳 | 按网站该job current动作，旧WAL门ABSENT；sameeffect无grant仍拒。先R1/W1；Websitegrant拒绝只停本job并原readback |
| R3 单job隔离 | AGENT Runtime：runtime-loops.ts reconcileUnfinishedExecutionsWithoutReceipt、runtime-source-handoff.ts prepareSourceHandoffs及同一批次failure对账入口 | A remote失败本轮B/C仍运行；该job typed失败有原下一轮；共享凭证/Store坏不装正常。先R1/R2相关类型，error不得被catch空吞 | 完整单job处理均在原隔离范围：首次GET、next_action、Target release、后续结果admission读回；不能仅包第一GET。
| R4 startup | AGENT Runtime：runtime-startup.ts inventory门；runtime-storage-inventory.ts原root盘点与task树读取，maintenance原完整dry-run消费者 | orphan保持诊断，正常Store启动原worker；task树递归原typed失败由原inventory Owner携exact jobId交接，startup仅该局部型记录原诊断并继续；root/Store/未知raw失败仍关闭。maintenance完整盘点失败不输出假完整DTO、不把未知bytes填0；损坏Store/无凭证、exact absence删除反例不减。先A-R，关闭代码原位复用 |
| W1 source授权 | Website ai-acceptance：packages/ai-contracts/src/production-control/v6-source-readback-proof.ts及v6-contract.ts/v6-write-assertions.ts原source/grant断言；services/api/src/ai-production/job-claim-source-lineage.ts、job-claim-authority.ts及原同identity事件/receipt事务 | §6.3唯一45解码、删历史proof滚动24h下限、risk转真zero的prior lineage窄验→原job行锁→指定calls/calls=[]或真zero普通null grant→receipt读回。先A-W/A-R，风险只由Website签；原body历史不转换 | 真全历史zero的risk→ordinary新attempt及regrant沿原签发Owner输出revision0/null rejection/null risk grant；只在latest risk精确同source attempt且原祖先窄验通过时归零，原签发event记录同grant result_revision供regrant真实消费。成熟current零输入+historical rejection仍原非零revision/prior_result_rejection，全部历史计数保持。必须验证旧21层拒收继承及新普通授权实际producer→AGENT decoder→Browser，不得只验lineage。
| W2 当前冷却 | Website ai-acceptance：provider-cooldown-receipt.ts decide/verified/readGate、provider-cooldown-claim-policy.ts原decision消费；原repository写receipt及assertPreviousIncidentCleared/applyProviderCooldownNoticeState片区 | §6.4历史receipt不重演当前政策、current device/server/cohort资格唯一；旧clearance ACK不可得仍可合法恢复及记下一真实incident；新incident落账/活动窗口/单次N处罚仍成立。先A-W，原v7字节不改 |
| R5 冷却消费 | AGENT Runtime：production/provider-rate-limit-control.ts constructor/assertProviderSubmitAllowed/canRequestClaimAuthority/observeWebsiteAuthority；runtime-loops原notice处理顺序、store-cooldown/provider-cooldown-receipt原签回执消费 | 删旧clearance永久gate、保留新incident Website exact落账因果门；原pending列表逐incident有限续交/typed失败隔离，初始incident不依赖clearance存在才续交；当前authority+中央preflight；先W2，不用事故前grant绕N |
| R6 cleanup | AGENT Runtime：runtime-loops.reconcileCompletedBrowserTargets | 每job自己的Outbox资格；原pending快照逐个一次，A失败B/C读回完成，真实release才settle；先B2/B4/R2，原单lane |
| R7 SENT收尾 | AGENT Runtime：runtime-loops.reconcilePendingBusinessAdmissions及其原日志顺序；runtime-business-admission原readback/complete消费 | 已SENT/admitted日志坏仍确认；新云写/newclaim/mutation仍拒；先A-R/R6；原日志fail不伪span，待恢复原Outbox续交 | 独立session heartbeat亦停新turn；原WorkerSession以必填sink许可在queued认证后、physical fetch前核尚未发出的云mutation，open/heartbeat/claim/Outbox均守同门。GET读回及已发送回复继续，原session close为已有会话清理沿原精确close路径保留，不加通用绕过参数。未发heartbeat因sink拒绝不得清空原credential、触发resync或冒改sequence。
| W3 N验收 | Website ai-acceptance：job-claim-repository.selectAndGrantClaimJobs、job-claim-selection.selectV6ClaimableJobs、job-lifecycle原seat投影 | **复用现役不重写**：recoverableLimit与newLimit独立、满N原seat接回、admission后fresh。若验收显示这些原符号确有违约才回设计，禁止先造release API；先W1/W2 |
| R8 N接回 | AGENT Runtime：runtime-loops workerIteration/claimReusesExistingBusinessSlot/businessInFlightJobIds/launchClaimJobs现役路径 | 复用已存在的recoveryOnlyClaim；只删R2/R3/R5导致不可达条件。现役网站heartbeat的claim_eligible不以N满为false，cooldown仅给reason，不需新增attestation字段。N满failed也请求原recovery authority，samejob不计两座/不越N；先R1—R3/R5/R10/W3 |
| Z-R 唯一18投影 | AGENT Runtime：原dependency、唯一route generator/route-policy及contract-inspection；原agent-route-contract.acceptance和Manifest引用 | 17/34旧判断ABSENT→18/40精确匹配；40/48、旧34+新六全等；generated JSON由原generator生成，禁止手写/双表。先A-R窄Runtime003及依赖闭包；不改中性下载/hash/上传算法 |
| Z-BZ05/BZ03/BZ04/Z-QM03/QM04/Z-HH02/HH03/Z-NM01/NM02 | 各Product唯一Owner，§6.6九行分别一工单；原九SKILL overlay只读核对，必要残留先与其Owner对接；实际flow/product-turn与BZ05/BZ03 product-identity已列source | 每Product旧附件/JSON-only片区删→ABSENT→唯一18 Prompt/父门；七无需解包的不建读者；必要fflate package/lock由原dependency Owner单独登记。现役Profile/调用数量/readConfirmedSubmit/review不减；Z-R和法案/BP双主审先行 |
| Z-Q 每Product验收 | AGENT scripts/acceptance/product-plugins九个同名suite分别归对应Product；architecture原边界Owner核注册/QA，Runtime原suite核机械合同 | 原fixture只会JSON.stringify：在现有product-plugin-test-runtime的材料输入增加通用Uint8Array支持， bytes/hash从实际bytes算，不嵌业务包/步骤/格式。九suite各自构造真ZIP/保留review JSON，不新增中央Product格式/执行器。先对应Z工单 |
| Q-B/Q-R/Q-W | 各原Owner的现有Exam、Static、Dynamic collector/Manifest，精确路径见§10 | 随对应工单删除旧global-block期待并重建对照；唯一原生质量入口，不加总恢复checker/verdict |

路径以§2 realpath为根，表中browser=src/lib/browser，production=src/lib/local-runtime/production。原法案/schema/generator不可分割的现有投影同步才可修改，不根据目录相似扩大写面。source accept存储、Browser receipt事务、Website risk签发三个原子责任分别原Owner，不跨Owner代写；九个Product接收/Prompt改动必要性只来自§6.6的实际断裂；Website专业规则与纯parser保持。

## 9. 双仓无桥切换与回退

设计可施工不自动批准执行切换。未来执行Codex重绑权限/dirty/HEAD/active版本后，按上述先法案/Blueprint两遍主审，再原子工单，再主审至少两遍及只读子审实际代码，不以方案旧放行代替建设审计。随后使用冻结ci-full-governance执行用户届时授权的原生质量等级。

部署窗口内只停新claim和新的现实输入，旧结果/receipt/网站readback允许完成；原成熟drain收束当前handler/native/send tail，不以历史DISPATCHED=0作窗口门。版本9现役合法slot先通过原fact通道（必要时原重连flush）全部commit/readback，才能停止其worker；ACK丢失但原WAL同hash已commit也属于已交付事实，不要求再产生旧ACK证明输入没发生。坏fact已由原strict拒收，原WAL command/binding保留unknown；无fact也unknown。收束后停止原9worker，更换固定同build Extension10和Node10，旧内存不转成新持久化、不桥接旧frame，不假称9能发送dispose。新版同生命周期出现的坏/null slot才走§6.2 dispose。升级终止旧worker不代表旧结果zero；不能借reload抹去未commit合法fact。任何无法完成合法fact交付或真实handler收束的情况停止部署，不删除工单/SQLite或默默丢有效事实。

task-result18的切换须另先满足§6.7原全部40route业务排空门；旧unknown允许作为历史诊断保留不代表旧job已经admitted。该门约束生产部署，不阻断当前获授权的法案、施工图、代码及质检建设；旧任务由网站侧按§6.7负责。冻结provider45 canonical合同和两仓引用；先两仓各自规范/类型生成及测试完成（不同时运行不兼容binaries），再先Website唯一45 provider，再AGENT唯一45 consumer/Node协议10与同build Extension10。无桥窗口不允许旧Runtime请求新授予、新Node接旧9执行；只读网站已入库成果不靠新Browser。打开权限前核版本/build/currentsession/N及source/currentreceipt向量一致，执行一个同身份canary的stage→domain admission→业务对象readback，不能只测health。

shape44→45是同字段严格语义扩展，44已有合法body是45合法子集；历史v7 receipt只验原不可变hash/identity，不重算新policy。WAL schema/oldpayload、签过source/effect/grant/result/admission hash均不迁移。若active未完成祖先违反当前canonical、合法slot无法drain或相关candidate有无法归属的overlay，停止切换、报告具体job/事实；不添加兼容reader或假证明。

回退点：
- 新45未签任何grant/receipt/source前：所有现实输入仍冻结，两仓及同build扩展可整体回到已验证前版，保留durable事实；不能先单仓开放旧权限。
- 一旦45新source非zero/null、新政策receipt或新版dispose已存在：禁止降回旧语义重新执行/重hash。先冻结新危险输入，保留原Outbox/Websitereadback，用当前45链修复前进；只有证明旧版对全部待消费事实仍合法且整组回退后不会重放，才允许整体二进制回退。没有此证明的回退点就是安全停止，不能伪承诺可随时downgrade。
- 取消施工：保留已完成阶段与未知事实，不启动新attempt；仅授权的规范/代码差异按原候选回退，用户overlay不动，运行数据不以Git回滚处理。

## 10. 验收：每一项单独过，最终一起跑

当前审查对象是 AGENT 实际建设与现役原生验收代码，逐项核对下列设计要求。局部测试和子审不能替代原生 CHANGE、READY；生产 Dynamic Proof 尚未执行，不据此宣称自动恢复或业务入库已实测完成。Website 验收映射保留供其 Owner 接力，不作为本轮 AGENT 执行范围。

现役AGENT Static：scripts/audit/domains/local-browser-session/browser-mutation-settlement-inspection.ts、target-claim-inspection.ts；agent-production-runtime/worker-loop-inspection.ts及各原Manifest/check。Exam复用scripts/acceptance/browser-lane-fifo.acceptance.ts、local-browser-provider-effect-recovery.acceptance.ts、local-browser-mutation-receipt-support.ts、agent-production-runtime-recovery-contract.acceptance.ts及其support、agent-production-runtime-proof-boundary.acceptance.ts、local-app-shell.acceptance.ts、runtime-log-spine-failure-matrix.acceptance.ts。Website复用scripts/audit/domains/ai-acceptance/check.ts/manifest、原observation/012检查，tests/exam/ai-production-v6-contract.test.ts、ai-production-v20-observation.test.ts；同时核AI-boundary原check/Manifest，禁止删除整条006检查。所有新增case进入现有Owner suite，不新建十二个checker。

| 验收编号 | 必须可复放的正向证据 | 必须拒绝的反例/成熟防回归 |
|---|---|---|
| T1 | 有fact→commit→ACK；producer已丢仅oldunknown→有界readback→新risk revision→domain入库 | 没原fact不补terminal；同旧effect重发拒；prepared未发与dispatched未知区别 |
| T2 | A历史unknown，B/C合法操作及读回继续，FIFO/一lane/节拍成立 | 正在native输入仍不物理并发；复制旧门到health/prepare/WAIT或换名UNKNOWN应失败 |
| T3 | 原proof→riskgrant；unchanged accepted risk+currentzero→sameattempt/grant、不产source；迟到仍possible→本轮读回/newsource/newrevision；迟到全history真zero→ordinary source/newattempt/null replay grant；封存>24h原bytes可交付 | 三支分别读source/grant/accept/prepare及domain终点；null≠zero；缺行/未验WAL/旧fence/未来或倒序time拒；无replay_exhausted/checkpoint的纯historical_settled source拒；stage先赢只交成果，seal先赢迟到stage拒；immutable seal/hash不刷新；原zero-submit祖先完整验真不减 |
| T4 | 对每个实际producer异常码构造真实decoder路径，枚举/generator/producer/consumer完全闭合 | 任意string/unknown field/错hash仍拒，不能catch默认合法码掩盖未定义producer |
| T5 | badcode/badshape及factnull、disconnect/reconnect、disposed丢失分别释放同槽；原WALunknown/hash保留；B可执行 | handler/native活、跨command/binding/rawhash、迟到response不清新槽；badfact不能冒commitACK |
| T6 | 同连接丢第一次ACK，heartbeat同fact新frame→同WAL行幂等→ACK→清槽→下一job | 非单调sequence、不同facthash、重发COMMAND/REPLY拒；不创建第二timer/队列 |
| T7 | 三job快照A读失败，B/C本轮完成合法阶段，A留typed原因下一轮再查；source单项失败同样 | exact absence与普通网络错区分；共享credential/store坏停相应危险动作，不吞错报告成功 |
| T8 | 合法Store/凭证+孤儿目录→worker有真实下一动作；该目录保留，可由网站exactabsence清算 | 损坏DB/符号链接/无凭证不发危险输入；没有网站absence不删目录/共享blob |
| T9 | old clearance已落账而ACK丢失→clock过期/cohort闭合/current authority回接；旧clearance续交失败仍查authority/其它job；初始incident可续交；下次真实exact_present落账并level递增/降N | 新incident未Website落账时事故前grant+fresh absent/较新serverNow也不输入；ACK丢exact续交/readback才收敛；活动cooldown409、同incident只惩罚一次、错identity拒；原N/cohort/6小时/v7hash不改 |
| T10 | Aunsent只限制A；Acleanup失败本轮B/C可释放；下一轮仍接A | 未admitted/自己的Outbox未确认不得settle；exacttarget/absence错身份拒，单lane不并行 |
| T11 | sink坏而原result已SENT/网站admitted→读回→complete→清理；sink恢复未SENT续原bytes | sink坏仍禁止新claim/new mutation/未发云写；无admission不假complete、不造成功span |
| T12 | N=3三个failed，fresh=0仍原recoverable接回samejob；逐个入库释放资格，再领取fresh；cohort恢复同样 | leaseclear不假seat释放、同job不占两座、不得超N、不靠删单/新释放API；现役五阶/keyset仍通过 |

九Product Z验收每条独立：真实ZIP bytes/hash/media/trust/scope/原序材料，BZ03/BZ04正确父ref/hash/完整正文与缺页/篡改/重复拒绝；九Prompt包含唯一current route JSON、正确问题/无额外问题和实际导航，无旧result_contract附件要求；同effect确认恢复零physicalSubmitDispatches，初次只1次；review两action仍仅subject_result + review_context两JSON原序材料/原route输出、额外第三材料拒绝；Naming Provider扩展字段原样保留；NM01两报告分别入库/PDF，NM02已授权原解读不重做，HH03覆盖所有祖先。原九suite各自有完整原页/首尾/跨页的夹具及反例；机械测试只证明格式/导航/字节，不把fixture页数或模型自称已读当语义阅读证明。现役14产品矩阵与真实Domain/商业终点仍是最终Dynamic分母。

集成Dynamic Proof用**新建且经授权的真实任务身份**，不能复活此前已删三个job。在旧未知事实可保留的同一生产链中注入上述故障、逐项T1—T12证据，再同批混合执行：A遇旧未知/坏回执、B已有可交成果、C正常任务，N=3，现役一lane，确认B/C完成且A自动接回并领域入库。进一步运行网站要求的14产品矩阵，每产品核冻结输入→Product→原结果→对应Domain持久化/admission，不能用其中一个产品通过覆盖14个。生产操作需独立执行授权，本轮不运行。

每仓原生CHANGE针对实际差异；READY需要clean commit、全部active Static/Exam及完整原生报告；RELEASE执行各active法声明Dynamic Proof及必要provider participant/version核验。报告仍逐law/evidenceMode一个分母；T1—T12是本任务验收映射，不替代全仓法案分母，不生第二总PASS。

## 11. 本轮建设与审查边界

授权人已要求执行既定十二项恢复修复及九Product合同18消费者接力。旧付费工单删除与原订单重派由网站聊天负责，不新增本方案的删单入口；§6.7排空及唯一版本窗口是部署条件，不能把未完成旧任务重新提升为代码建设门。此前设计审查发现的两项review材料和旧出口Consumer绑定问题已经回本方案纠正。旧候选审查只证明当时方案，不替代当前实际建设审查。

建设先完成双仓法案/施工图对齐，由主Codex至少两轮审查后才进入实际代码；该阶段禁止子智能体。代码和原有质检按§8逐Owner物理删除片区、核验ABSENT后重构；成熟Owner、原合法历史bytes和原生唯一质量入口保持，禁止桥、第二链路或新增总恢复设施。重要实现步骤由只读子智能体协同审查，写入均由主Codex完成。

建设后主Codex至少两轮核对实际代码与§6—10、现役法案及闭环Skill，再由只读子智能体审查同一实际建设候选：十二项与九Product是否全部完成、是否吻合闭环Skill、是否吻合法案。未解决finding不得以旧方案审查放行。最后用冻结ci-full-governance执行原生质量流程，等级结论以各仓唯一quality:check及其当前原生候选为准。

## 12. 历史设计候选绑定（不作为当前质量候选）

| 仓库 | realpath/branch | HEAD / origin/main缓存（未fetch） | scoped SHA256 / 数量 |
|---|---|---|---|
| AGENT | /Users/nexgen/Documents/AGENT / main | 787577e055c9d40899114543b1d7d69d9ebd544f / de810406719e769d3adbe81e89177ab38a569025 | 526cce1bc35c24a94d3c0603828ed896bc56e76525304db2337ef382d85deba1 / 132 |
| Website | /Users/nexgen/Documents/xuanxue-web / main | 2c400957204bbdc1784ee132421dc4d0eb142936 / 2a22a286345d8082c72291d82a200399096de576 | ba9a9d90a84b1d0c158f60c9817826731d525792b11c44ae09e08bb6caa05646 / 54 |

设计阶段的两份共享 overlay 中，WEBSITE-AGENT-V6-BLUEPRINT.md 已纳入本轮直接关联的规范对齐，九个 SKILL 已纳入消费者建设；AI生产派单金字塔优先级排序-完整实现方案.md 的他人改动继续原样保护。用户要求删除分支后，旧 recovery-plan-design 工作树及分支已删除；main 合并787577e05只记录已被后继承接的旧分支。唯一方案及建设保留在 main，不从备份恢复旧门。上表仅记录历史设计基线；当前 CHANGE 使用 HEAD 到工作树实际差异，READY 绑定届时 clean 原生 commit 和唯一原生报告。

Website scoped candidate补齐五个直接决定§6.7旧合法出口及18拒收边界的现役Consumer：ai-production/business-result-domain-dispatch.ts、job-device-status-repository.ts、website-agent-result-reader.ts、website-agent-result-payload-contract.ts，以及commercial/hehun-followup-fulfillment.ts；它们是只读事实绑定，不新增施工对象或兼容机制。Website18 archive/route/原QA由另一聊天在建；本稿绑定其当前实际bytes，不把另一轮CHANGE视作本稿可施工或部署证明。相关source发生实际漂移则重核受影响片区、重新绑定再子审；不能用旧hash或对方未完成候选强宣PASS。文中任务数据库快照另有明确UTC时点，不进入Git candidate，不等部署证据。

AGENT source candidate（仓库相对路径）：

- .agents/skills/agent-flow-boundary-gatekeeper/SKILL.md
- .github/instructions/agent-rules/功能法案.md
- .github/instructions/agent-rules/基础法案.md
- AGENTS.md
- docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md
- docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md
- docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md
- docs/governance/法案系统建设说明书-冻结定稿版.md
- docs/specs/agent-production-runtime/agent-route-capability-manifest.provider.spec.json
- docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json
- docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json
- package-lock.json
- package.json
- scripts/acceptance/agent-production-runtime-proof-boundary.acceptance.ts
- scripts/acceptance/agent-production-runtime-recovery-boundary.acceptance-support.ts
- scripts/acceptance/agent-production-runtime-recovery-contract.acceptance.ts
- scripts/acceptance/agent-production-runtime-session-rotation-support.ts
- scripts/acceptance/agent-route-contract.acceptance.ts
- scripts/acceptance/browser-lane-fifo.acceptance.ts
- scripts/acceptance/local-app-shell.acceptance.ts
- scripts/acceptance/local-browser-auto-pairing-support.ts
- scripts/acceptance/local-browser-mutation-receipt-support.ts
- scripts/acceptance/local-browser-provider-effect-recovery.acceptance.ts
- scripts/acceptance/product-plugin-test-runtime.ts
- scripts/acceptance/product-plugins/bazi-ai-full-analysis.acceptance.ts
- scripts/acceptance/product-plugins/bazi-chart-interpretation.acceptance.ts
- scripts/acceptance/product-plugins/bazi-report-followup.acceptance.ts
- scripts/acceptance/product-plugins/hehun-ai-analysis.acceptance.ts
- scripts/acceptance/product-plugins/hehun-report-followup.acceptance.ts
- scripts/acceptance/product-plugins/naming-bazi-analysis-and-naming.acceptance.ts
- scripts/acceptance/product-plugins/naming-from-existing-bazi-report.acceptance.ts
- scripts/acceptance/product-plugins/qimen-professional-answer.acceptance.ts
- scripts/acceptance/product-plugins/qimen-report-followup.acceptance.ts
- scripts/acceptance/runtime-log-spine-failure-matrix.acceptance.ts
- scripts/audit/domains/agent-production-runtime/authority-inspection.ts
- scripts/audit/domains/agent-production-runtime/contract-inspection.ts
- scripts/audit/domains/agent-production-runtime/manifest.json
- scripts/audit/domains/agent-production-runtime/session-output.ts
- scripts/audit/domains/agent-production-runtime/worker-loop-inspection.ts
- scripts/audit/domains/architecture-boundary/components/scan-plugin-capability-boundaries.ts
- scripts/audit/domains/architecture-boundary/components/scan-product-acceptance-boundaries.ts
- scripts/audit/domains/code-purity/components/scan-structural-budgets.ts
- scripts/audit/domains/local-browser-session/browser-mutation-settlement-inspection.ts
- scripts/audit/domains/local-browser-session/manifest.json
- scripts/audit/domains/local-browser-session/target-claim-inspection.ts
- scripts/audit/generated/law-registry.generated.json
- scripts/generate/sync-website-agent-route-policy-projection.ts
- scripts/startup/lib/production-contract-preflight.ts
- src/lib/browser/chrome-extension/command-permit-validator.ts
- src/lib/browser/chrome-extension/debugger-runtime.ts
- src/lib/browser/chrome-extension/exact-target-runtime.ts
- src/lib/browser/chrome-extension/extension-command-runtime.ts
- src/lib/browser/chrome-extension/extension-heartbeat.ts
- src/lib/browser/chrome-extension/extension-runtime-types.ts
- src/lib/browser/chrome-extension/extension-target-authority.ts
- src/lib/browser/chrome-extension/extension-target-release.ts
- src/lib/browser/chrome-extension/gpt-rate-limit-dialog.ts
- src/lib/browser/chrome-extension/websocket-actor-crypto.ts
- src/lib/browser/chrome-extension/websocket-actor.ts
- src/lib/browser/exact-target/browser-gpt-rate-limit-preflight.ts
- src/lib/browser/exact-target/browser-mutation-evidence.ts
- src/lib/browser/exact-target/browser-mutation-receipt.ts
- src/lib/browser/exact-target/browser-mutation-replay-evidence.ts
- src/lib/browser/exact-target/browser-mutation-schema.ts
- src/lib/browser/exact-target/browser-mutation-store.ts
- src/lib/browser/exact-target/browser-observation-receipt.ts
- src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts
- src/lib/browser/infrastructure/browser-lane-coordinator.ts
- src/lib/browser/protocol/browser-errors.json
- src/lib/browser/protocol/browser-protocol.schema.json
- src/lib/browser/protocol/generate-browser-protocol.mjs
- src/lib/browser/protocol/generated/browser-protocol.generated.ts
- src/lib/browser/transport/browser-authority-frame-payload.ts
- src/lib/browser/transport/browser-authority-websocket.ts
- src/lib/local-runtime/production/contracts.ts
- src/lib/local-runtime/production/provider-cooldown-receipt.ts
- src/lib/local-runtime/production/provider-rate-limit-control.ts
- src/lib/local-runtime/production/route-policy.ts
- src/lib/local-runtime/production/runtime-business-admission.ts
- src/lib/local-runtime/production/runtime-claim-operations.ts
- src/lib/local-runtime/production/runtime-claim-recovery.ts
- src/lib/local-runtime/production/runtime-claim.ts
- src/lib/local-runtime/production/runtime-contract.ts
- src/lib/local-runtime/production/runtime-logging.ts
- src/lib/local-runtime/production/runtime-loops.ts
- src/lib/local-runtime/production/runtime-source-handoff.ts
- src/lib/local-runtime/production/runtime-source-readback-proofs.ts
- src/lib/local-runtime/production/runtime-startup.ts
- src/lib/local-runtime/production/runtime-state.ts
- src/lib/local-runtime/production/runtime-storage-inventory.ts
- src/lib/local-runtime/production/source-readback-contract.ts
- src/lib/local-runtime/production/store-cooldown.ts
- src/lib/local-runtime/production/store-foundation.ts
- src/lib/local-runtime/production/store-outbox.ts
- src/lib/local-runtime/production/store-source-readback.ts
- src/lib/local-runtime/production/store-source-settlement.ts
- src/lib/local-runtime/production/store-task-state.ts
- src/lib/local-runtime/production/store.ts
- src/lib/local-runtime/production/website-agent-route-policies.v1.json
- src/lib/local-runtime/workbench-browser-authority-support.ts
- src/plugins/bazi-ai-full-analysis/SKILL.md
- src/plugins/bazi-ai-full-analysis/flow.ts
- src/plugins/bazi-ai-full-analysis/product-identity.ts
- src/plugins/bazi-ai-full-analysis/product-turn.ts
- src/plugins/bazi-ai-full-analysis/result-contract.ts
- src/plugins/bazi-chart-interpretation/SKILL.md
- src/plugins/bazi-chart-interpretation/flow.ts
- src/plugins/bazi-chart-interpretation/product-identity.ts
- src/plugins/bazi-chart-interpretation/product-turn.ts
- src/plugins/bazi-chart-interpretation/result-contract.ts
- src/plugins/bazi-report-followup/SKILL.md
- src/plugins/bazi-report-followup/flow.ts
- src/plugins/bazi-report-followup/product-turn.ts
- src/plugins/bazi-report-followup/result-contract.ts
- src/plugins/hehun-ai-analysis/SKILL.md
- src/plugins/hehun-ai-analysis/flow.ts
- src/plugins/hehun-ai-analysis/result-contract.ts
- src/plugins/hehun-report-followup/SKILL.md
- src/plugins/hehun-report-followup/flow.ts
- src/plugins/hehun-report-followup/result-contract.ts
- src/plugins/naming-bazi-analysis-and-naming/SKILL.md
- src/plugins/naming-bazi-analysis-and-naming/flow.ts
- src/plugins/naming-bazi-analysis-and-naming/result-contract.ts
- src/plugins/naming-from-existing-bazi-report/SKILL.md
- src/plugins/naming-from-existing-bazi-report/flow.ts
- src/plugins/naming-from-existing-bazi-report/result-contract.ts
- src/plugins/qimen-professional-answer/SKILL.md
- src/plugins/qimen-professional-answer/flow.ts
- src/plugins/qimen-professional-answer/result-contract.ts
- src/plugins/qimen-report-followup/SKILL.md
- src/plugins/qimen-report-followup/flow.ts
- src/plugins/qimen-report-followup/result-contract.ts

Website source candidate（仓库相对路径）：

- .github/instructions/agent-rules/功能法案.md
- .github/instructions/agent-rules/基础法案.md
- AGENTS.md
- docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md
- docs/governance/法案系统建设说明书-冻结定稿版.md
- docs/specs/ai-acceptance/website-agent-task-result.provider.spec.json
- docs/specs/ai-acceptance/xuanxue-ai-production-v6.contract.spec.json
- docs/项目方案/八字排盘零事故封口-完整实现方案.md
- package.json
- packages/ai-contracts/src/agent-task/website-agent-route-policies.v1.json
- packages/ai-contracts/src/agent-task/website-agent-route-policy.ts
- packages/ai-contracts/src/agent-task/website-agent-task-result.ts
- packages/ai-contracts/src/domains/bazi/output-contracts.ts
- packages/ai-contracts/src/domains/hehun/terminal-output-contracts.ts
- packages/ai-contracts/src/domains/naming/terminal-output-contracts.ts
- packages/ai-contracts/src/domains/qimen/terminal-output-contracts.ts
- packages/ai-contracts/src/production-control/v6-contract.ts
- packages/ai-contracts/src/production-control/v6-source-readback-proof.ts
- packages/ai-contracts/src/production-control/v6-write-assertions.ts
- scripts/audit/domains/ai-acceptance/check.ts
- scripts/audit/domains/ai-acceptance/manifest.json
- scripts/audit/domains/ai-acceptance/route-result-contract-inspection.ts
- scripts/audit/domains/ai-boundary/check.ts
- scripts/audit/domains/ai-boundary/manifest.json
- scripts/audit/generated/law-registry.generated.json
- services/api/src/ai-production/business-result-consumer.ts
- services/api/src/ai-production/business-result-domain-dispatch.ts
- services/api/src/ai-production/job-claim-authority.ts
- services/api/src/ai-production/job-claim-observation.ts
- services/api/src/ai-production/job-claim-repository.ts
- services/api/src/ai-production/job-claim-selection.ts
- services/api/src/ai-production/job-claim-source-lineage.ts
- services/api/src/ai-production/job-device-status-repository.ts
- services/api/src/ai-production/job-lifecycle-repository.ts
- services/api/src/ai-production/provider-cooldown-claim-policy.ts
- services/api/src/ai-production/provider-cooldown-receipt.ts
- services/api/src/ai-production/provider-cooldown-repository.ts
- services/api/src/ai-production/website-agent-result-payload-contract.ts
- services/api/src/ai-production/website-agent-result-reader.ts
- services/api/src/ai-production/website-agent-task-repository.ts
- services/api/src/ai-production/worker-session-repository.ts
- services/api/src/bazi-agent-result-consumer.ts
- services/api/src/bazi-business-completion.ts
- services/api/src/bazi-provider-archives.ts
- services/api/src/commercial/hehun-followup-agent-result-consumer.ts
- services/api/src/commercial/hehun-followup-fulfillment.ts
- services/api/src/hehun/hehun-agent-result-consumer.ts
- services/api/src/hehun/hehun-provider-archives.ts
- services/api/src/naming/naming-agent-result-consumer.ts
- services/api/src/naming/naming-provider-archive.ts
- services/api/src/qimen/qimen-agent-result-consumer.ts
- services/api/src/qimen/qimen-provider-archives.ts
- tests/exam/ai-production-v20-observation.test.ts
- tests/exam/ai-production-v6-contract.test.ts
