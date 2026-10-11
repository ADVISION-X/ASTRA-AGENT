# AGENT 浏览器占用泄漏与排队期限失效专项修复完整实现方案

状态：可施工（方案准入，实际施工另行授权）。日期：2026-10-11（Asia/Dubai）。
唯一方案沿用本路径；需求 Owner 为 local-browser-session，GPT 只负责自己取得的调用期 lease 引用。
本轮交付等级为 CHANGE，写入仅本方案；生产代码、法案、施工图、数据库、进程、Browser 页面均未改变。本方案不取得施工、重启、READY、RELEASE 或生产故障注入授权。

## 1. 目标、终点和范围

专项目标：一张工单在重新取得 Browser 后精确选会话失败，必须沿原错误与收尾链退出；已移交给 Browser 的释放尝试不能再次释放下一张工单的占用；所有仍排队的请求在自己的取消或期限到达时必须有限返回，不能因 lane 正忙而永久悬挂。

成功终点有两层，不能混用：本地修复终点是原执行 Promise 和续租真实收束、其它合格工单仍可推进；业务完成终点仍是 Product result → Runtime 原 stage/Outbox → Website 领域接纳及 admission receipt → 原同身份 completed readback。故障工单继续由 Website 当前授权自动接回，不能靠人工删单、抹掉未知事实或重新发同一 effect。

施工方案只有 G1（GPT lease 引用生命周期）与 B1（Browser queued 请求期限维护）两个原子责任及其直接质检。不改变 Product Flow/Prompt/模型、DOM selector、文本回答两门、图片 source 等待、限流关闭策略、全局 observation 节拍、N、Website 恢复状态/合同/数据库。网站侧只读核合同边界，没有网站施工工单。禁止新 watchdog、lease manager、per-job timer、第四 next action、第二队列、第二恢复链、兼容桥或备用通道。

## 2. 事故证据与第一直接断裂

原始事件文件：.grasseye-local/runtime-logs/agent/696bda18-c97d-4b90-a07a-dacc32d9ecff-0001.jsonl，1823 条。下列时间统一 Dubai UTC+4，producerSeq 是原事件序号：

- 第5张 aiprod_0d568a9f-adc2-436a-a433-43f48e0d06ab / attempt 479410bf-85e1-4e46-bd02-7fce7ac9d65e：19:00:18 已 CONFIRMED submit；随后第一次 pending park 成功。19:05:48.333 的 producerSeq=1034 发出 selectExactGptConversation，command bded3389-c8b3-4cef-95f8-973810a1464e；1042/1043 在19:06:20记录 BROWSER_COMMAND_RECEIPT_MISSING，1044/1047/1049 将同一失败传播至 Child/Plugin/job。同 job/attempt 在19:07:16重授 leaseVersion=2 后再次进入 checkpoint，未收尾。
- 第6张 aiprod_945dc9fe-2874-4f4f-96e5-5df75d9ae6ba / attempt 68ce033c-d8eb-44b9-a0be-a6d44dada584：19:03:09 已提交并进入 checkpoint；第7张 aiprod_a923d4f5-136a-4a73-8e05-9293d983a893 / attempt baacc271-d40e-496c-83e9-1c323cbb6ffb：19:07:52进入 prepare，此后没有现实 Provider 输入。两者等待未收尾。
- 在19:06后没有新的 Browser command，三个执行却持续成功 renew；Website 后续容量为零是三个未结算席位的下游表现。19:16:29 用户看到停滞才关停，不能把用户关停写成故障起因，也无证据将停滞归于网站 READY。
- 这些事件证明停滞与选择失败相关；导致最初选择回执缺失的 Extension/native 底层原因仍未证实。本轮修复的是已重现的故障放大链，不声称根治所有回执缺失。

当前两个直接断裂：

| 责任/源头 | 实际错误 | 必须得到的输出 |
|---|---|---|
| GPT：src/capabilities/gpt/production-browser-lifecycle.ts#waitForProviderObservation（246–283） | acquisition 已成功，selection 抛错后统一 catch 提前清 activeBrowser；Executor finally → Session.settle → lifecycle.settle → parkActive 因空引用而跳过 park | 新 lease 从取得到本次 park 结算始终有唯一可收尾引用；选择错误保留原 typed cause/confirmed effect |
| Browser：src/lib/browser/infrastructure/browser-lane-coordinator.ts#pump/#expireQueuedReleases/#scheduleWake（146–230） | active 时只到期 queued release，忽略 queued acquire 的 remainingMs | 同一 wakeTimer 维护全部 queued 请求期限，拒绝到期项而不触碰当前 active lease/native |

连坐补证：GPT 的 parkActive 仅成功后清引用（353–362）；pending park 失败也保留旧引用。Browser withLifecycle 的 park 无论成功失败都在 finally 释放该次 lane。旧引用随后再次 park，会再次执行全局 finally，从而清掉后来工单的 active。修复必须同时退休“失败后旧引用继续可 park”的路径。

2026-10-11 主 Codex 已在内存中调用上述现役两个类，外部动作=0、文件写入=0，得到：
1. 新 lease 选择失败 → settle 后 acquisitions=2、selections=1、parks=1、lane=busy；两个25ms预算的 queued acquire 在100ms后仍0个结算。
2. 旧 lease park 失败 → B取得新 lease，lane=busy → 旧 lifecycle.settle 再次 park，parks=2、lane错误变idle。

此反例只在 stub admission 将 eligibleAt 提前以避免等70秒；没有改生产代码、没有证明节拍或真实 Chrome 运行，不是 Dynamic Proof。正式防回归仍须按§7测试现役责任与原70秒门。

### 最新运行日志补证与误伤裁决

用户追加附件：/Users/nexgen/.codex/attachments/6a309bd6-17ec-477f-b8ea-6f9b51f3fba2/已粘贴的文本.txt，完整232行、224个JSON事件，SHA256=0b83a39d45006e521eb0715c7101d237683c3cadf46fae4c10dd738a6d6231d7。其220个agent事件逐eventId/全文与原始f53bf120-3572-4313-8984-ef3be5b2db5f-0001.jsonl相等；另外4个为startup producer事件。主Codex完整解析该原始run截至producerSeq=2473的2473条记录，固定Dubai19:50:19—20:25:41窗口；这段原始JSONL bytes SHA256=b3c8c76ce5e7426a33f4f5650537b6b4460945db7b0ae4a9a7d897a5824009f0，后续增长不计入本次结论。当前方案未施工，该运行不能成为G1/B1修复的Dynamic Proof。

| 新日志事实/固定序号 | 对方案与连坐的裁决 |
|---|---|
| 18个不同job中，15个已分别出现result.upload、job.terminal、job.execute succeeded；这些job最后还出现website.v6-request succeeded | 此窗口没有重现19:06后的整体静默。成功请求日志本身不证明Website已business-admitted/completed，最终仍须§7同身份领域读回；不能据15条成功把原硬卡死反例取消 |
| 原第5/6张0d568a9f、945dc9fe保留原attempt；submit Child在seq39/42启动后用已有事实返回；本run实际Browser命令只有会话选择、checkpoint观察及park，无fill/file-input/submit | 19:54:07（259）/19:56:27（431）已执行成功，零再次Provider输入。必须保留原CONFIRMED/Forensics/WAL读回及Website授权，不为G1/B1清旧事实或重发 |
| a923d4f5：67的BROWSER_DOM_CANDIDATE_MISSING定位open_gpt_model_selector_v3；69/70真实park成功，74失败、77lease release成功；后续新attempt在101入场，613执行成功 | 这是模型菜单Child的失败，不能归到截图JSON答案或attachment selector。原单job失败传播/收尾/新attempt接回能工作；本轮不改该Child，也不得使park成功路径退化 |
| 07df49e1：1884→1912在prepare_clean_gpt_chat发生BROWSER_TARGET_ACQUISITION_TIMEOUT；1914执行失败、1916lease release成功；1925新attempt入场，2238于20:21:46执行成功 | Target获取失败已有有限退出与Website新attempt接回；其间其它job继续上传。保留原Acquirer/pump失败出口、原heartbeat收束、恢复grant，不能加全局阻断或擅自扩大为Target机制重写 |
| eccf3719、b519cc3e、a1f39855：2242/2420/2444也在prepare_clean_gpt_chat报同一Target超时；2244/2422/2446执行失败，2246/2424/2448lease release成功；2257/2453/2454为同job新attempt。截止点eccf在checkpoint，b519在prepare，a1已prepare成功并进入profile | 三者尚无本窗口结果终态，记为已接回、仍处理中；截止时未结算不等于永久卡死或已完成。20:24:35其它job的2415成功及后续新grant证实这些失败没有让全部工单停止 |
| 1918/2248/2427/2450另有Browser infrastructure同码事件，身份只有job-bound-target-acquisition producer | 按五个失败执行计：一次模型菜单缺项、四次prepare Target超时；Child/Plugin/job多层传播不重复计事故。四条infra没有exact job/requestSequence关联，不仅凭相邻时间补造因果；Acquirer本地deadline或Extension diagnostic都能产生该码，原触发原因仍待exact发送/Target/Extension证据 |

本补证支持“保留已工作的失败恢复，专项修复故障放大链”的范围。新run未出现BROWSER_COMMAND_RECEIPT_MISSING、旧park失败或已知限流，不能把它当成G1危险分支的修复证据；G1成立依据仍是当前源码和两个现役类反例。B1 queued expiry应是V6_DEADLINE_BUDGET_EXHAUSTED，四次BROWSER_TARGET_ACQUISITION_TIMEOUT不证明B1是其根因，也不授权延长/取消现役Target native期限。新日志所见成功、有限失败和新attempt接回均成为§7必须保留的防误伤反例；不新增工单、公开合同、状态或第二恢复链。

## 3. 权威、现役实现和前轮连续性

源头入口为本仓 AGENTS.md、冻结说明书§0/4/35/36–38/41–44/46–47/22–25/48/51–54/78–79，以及两份 active law。主 Codex 本轮实际完整遍历《基础法案》《功能法案》各两遍，闭环 Skill 全文两遍；截断处分别补齐。冻结 Skill 不修改。全部39条现役法案仍为分母，不能因专项范围删法或缩减 READY 检查。

| 四维映射 | G1 | B1 |
|---|---|---|
| 法案 | LAW-GPT-001-V65、LAW-GPT-002-V32、LAW-CAPABILITY-GOVERNANCE-001-V19；LAW-AGENT-PRODUCTION-RUNTIME-001-V76的有限下一动作 | LAW-LOCAL-BROWSER-SESSION-003-V46、LAW-LOCAL-BROWSER-SESSION-004-V57、LAW-LOCAL-BROWSER-SESSION-006-V46；同Runtime隔离义务 |
| 施工图 | docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md V69，“需要真实观察”及“Browser边界” | docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md V56，“原release预算”段 |
| 真实 Owner/实现 | GPT 当前 call/facade/confirmed fact 与 activeBrowser；唯一 Session/Executor finally 消费 settle | local-browser-session 原 FIFO、nextWaiter、withLifecycle、唯一 wakeTimer/Acquirer |
| 原生质检 | gpt-provider-contract-inspection.ts 原观察/settlement规则；GPT现役 lifecycle/wait/recovery Exam | target-claim-inspection.ts 原lease/lane规则；browser-lane-fifo.acceptance.ts/support |

LAW-CODE-PURITY-001-V6、LAW-CODE-PURITY-002-V2、LAW-CODE-PURITY-003-V3、LAW-ARCHITECTURE-BOUNDARY-001-V18、LAW-ARCHITECTURE-BOUNDARY-002-V2及当前日志法案继续约束结构、公开边界、身份和失败证据。

无 active law 修改必要。Browser Blueprint “active期间只按 queued release expiry、无queued release不设wake”与本轮完整期限要求存在下级欠缺，未来施工必须先物理删除重构这个段落为全部 queued 请求期限；GPT Blueprint 同步明确 lease 引用的取得、移交、退休、重新登记与 selection失败收尾。只改这两个准确段落及直接验收，保留现有 machine block 的Owner/law/edge，不改无语义变化的版本/拓扑。Runtime Blueprint V66 §1/5/8仍复用，不扩大成续租或恢复系统再重构。

连续性裁决：

| 前轮/真实落点 | 仍适用不变量与本轮决定 |
|---|---|
| 2026-09-14《N 标签工单独占轮巡模式方案》§20.3 R2；现役 facade 的 runAtomicStep closure/live getter | 原 Child 原子身份跨多次 lease 保持；必须保留 call/facade/identity/confirmed事实，不以清物理lease引用丢掉Child身份。G1文本/图片跨换lease各验收 |
| 2026-09-16《十小时连续运行事故分组根治》§19 R1 | 当时静默机制未证实；原历史 mayCrossUnresolved不再是现役路径，当前nextWaiter无历史WAL门，不能恢复旧门或借历史假说添加watchdog。其唯一FIFO/计时Owner继续保留；本轮用当前两个反例替代对本事故的猜因 |
| 《GPT等待原因可观测性》 | 原五个文本原因/图片等待码与节流仅作观察，不成为deadline/lane/恢复资格；原逻辑不改 |
| 本路径前轮 L1/C1/C2/D1，现役5554299代码 | L1真实stage后stop-and-join/请求全寿命超时；C1 release queued30秒→quiet40秒→dispatch完整30秒；C2 typed局部release隔离、Store/sink/unknown外抛；D1原spanId、有界4096投影去重均保留。B1只补acquire期限，不回退C1 |
| 本路径更早12项恢复/9个ZIP对齐 | Website唯一恢复、旧结果先交付、有限零输入读回、原source/risk授权、同job独立席位、单job隔离、原合同18/45继续；G1/B1不得退回全局DISPATCHED门或重发策略 |

旧E1 Target获取超时、E2交互状态、E3回执缺失底层、E4网站HTTP500、E5健康误归因仍为独立只读证据缺口；当前公开health已作状态投影，本轮不新建健康合同或归因缓存。最初selection回执缺失只有首拒码，没有Extension退出/发送事实，本轮不给它猜修工单。旧八字单物理删除由网站Owner负责，仅网站exact absence进入AGENT既有清理，不在本轮删单或派单。这些历史未知不阻断本次已证明的两项修复，也不能冒充已解决。

## 4. 唯一目标链、身份与合同 handoff

原CONFIRMED submit/WAL事实 → 原pending判定 → park本次lease一次并退休该lease引用 → 保留原call/facade/不可变原子identity，在唯一FIFO按eligibleAt及原remainingMs排队 → acquire成功时立即重新登记新lease引用 → 通过原active.facade.executeDomIntent精确canonical URL选择，使新lease的该命令也进入原Child的runAtomicStep(identity) → 原两门/图片source观察。selection或观察失败仍经原Child分类、原限流关闭Owner及Executor finally调用同一个settle；settle只park本次真正持有的lease一次。没有得到新lease就不park旧lease。

Browser仍由一个物理lane串行；queued expiry只退出等待Promise，不终止任何已派发native、不证明Target已释放、WAL零输入或页面安全。真实native/handler未知仍服从现役transport撤权、Extension排空及每次native guard；认证恢复只能原自动配对后重新入原FIFO。

identity spine：
- 业务与授权：job_id → result_revision → product_step_id/call_id/child_capability_id → attempt_id/lease_version/fence；attempt/fence只为当前授权，不重新定义旧Provider effect。
- 原副作用/locator：唯一 Browser WAL 的provider_effect_identity_hash、submitIdentity原actionOrdinal/inputHash、canonical URL/user turn与source/evidence。
- 当前资源：本次 leaseRef、current Target/Document、当前authority；只存在调用期，不保存跨进程lease状态。
- 完成：原artifact/result hash → 原Outbox immutable body → Website admission receipt/result_payload_hash → 原completed。

| Producer → consumer | 当前合同与所需语义 | 本轮决定 |
|---|---|---|
| GPT → Browser acquisition | BrowserTargetLeaseWait discriminated union；signal、remainingMs函数、finite eligibleAt；fresh/bound/confirmed-readback，authorized-continuation附exact父job/attempt | 字段/可选never规则、父来源、顺序和identity不变；不发明默认值、公共phase或epoch |
| Browser → GPT | BrowserTargetLease live document getter、park(mode=product-call-settlement)、原typedBrowserExecutionFailure；一次native返回/失败 | park Promise成功/失败继续如实传播；GPT只退休已移交本次park的引用，不伪造physical release证明 |
| GPT → Session → Executor | 原settle(error)；Session finally清submittedByStep；Executor preserve primary cause并结合cleanup failure | 复用唯一消费者；有已stage/completed同身份结果时清理错误不撤销成功，无结果则原失败出口 |
| Runtime → Website → Runtime | control45/task-result18严格合同、原source/claim/grant/fence、原结果admission | no contract delta；不写Provider locator入跨仓body，不改required/null/unknown-field/hash/CAS、三种next action或重放资格 |
| Browser wire/WAL | protocol10、原认证seq、receipt/CAS/ACK/dispose与事实槽 | no wire/schema/WAL delta；回执不明原unknown保留，期限退出不补terminal、不清槽 |

## 5. 有限故障分母和连坐边界

| 分支/入口 | 唯一决定与终态/readback | 原恢复接回与工单 |
|---|---|---|
| 正常pending、旧lease park成功、新lease取得、selection成功 | GPT登记新引用，reobserve；Browser仍busy直到该leasepark；原Child当前身份/回答读回 | 原checkpoint循环；G1/B1，文本和图片正向 |
| stale call与当前调用期owner记录不一致 | GPT在park前用原GPT_BROWSER_SESSION_TRANSITION_UNSETTLED拒绝，物理动作0，不清当前其它引用 | 当前合法call仍走原链；G1负向，不新增公开状态 |
| 剩余observation预算不足70秒，或调用前已deadline | acquisition/park增量0，沿既有deadline退出；有原effect仍CONFIRMED | 原失败→Website同effect授权，不新submit；G1原反例保留 |
| 旧lease park拒绝 | 原typed失败外抛；该次park已移交Browser，GPT引用在finally退休；不得再次park旧lease | 原Executor结算/renew停止/Website重授；G1同时验下一lease仍busy |
| 旧park已结算但acquire失败/取消/排队到期 | 无新lease，无旧lease再park；原错误/fact不丢；queue项/listener移除 | 原执行失败和Websitebounded next action；G1/B1 |
| acquisition成功但selection失败或取消 | 保留新引用给唯一settle；park该lease一次，收尾失败仍传播并退休其引用 | 原CONFIRMED effect零提交恢复；G1 |
| selection产生已知限流 | 原code/proof/confirmed fact不被deadline改写；Child唯一关闭Owner先原Outbox事故落账/ack，再原失败收束 | 原Website当前冷却资格；G1已有rate-limit Exam回归，不新增关闭Owner |
| observation结束/Content缺席/pending、停止空回答、已有Forensics缓存 | 两门/20分钟窗口/图片5秒source/缓存先读保持；缓存命中acquisition0 | 原Child返回、pending再排队或现役精确终态；G1回归，不改判据 |
| active真实lease占用，任意queued acquire或release到期/取消 | Browser原wake只删该queued项，typed失败；active/jobRef/current native均不变，剩余队列重算 | 对应调用有限退出，原Runtime/Website下一动作；B1 |
| idle队列、Provider observation尚不合eligible/global clock | 原FIFO在具资格项间服务；expiry仍可先退出；不以过去eligibleAt在busy时1ms循环 | 原samejob/同effect等待，无第二计时者；B1 |
| release出队、quiet中、dispatch后 | 出队不再用queueDeadline；quiet后复核signal，原Acquirer独立完整30秒deadline | 原cleanup失败保pending，下轮处理；B1保C1/C2 |
| queue满10、预先aborted、到期0、reset/stop/通道不可用 | 原typed拒绝、listener/wake按现役责任收束；不吞Store/sink/provenance/raw异常、不假业务成功 | 原认证恢复/worker重授，不强行reset busy；B1 |
| stage/Outbox存在、或Website已admitted而settle失败 | 原唯一结果交付/readback与completed优先，原清理标记保持 | 原Outbox/cleanup loop；G1/B1负向，不改Runtime |
| 执行真正settled后/真实abort/正常shutdown | 原heartbeat.stop/在途renew结算、原tracker结算、原shutdown等待能有限收束；旧unknown存储不变 | 原startup及Website授权；G1/B1验收，不改shutdown顺序 |

“100%”只指上述真实有限分母每项有Owner、终态、消费者和验收，不作98%/100%主观评分，不承诺所有Provider异常永不发生。最初回执缺失的历史底层触发未知不影响已经证明的错误引用/队列转换裁决。

## 6. 两张原子施工工单

### G1：GPT真实lease引用一次移交和选择失败收尾

Owner：gpt；文件src/capabilities/gpt/production-browser-lifecycle.ts，仅waitForProviderObservation和parkActive两块，直接测试/审计见§7。主Codex写代码；不得改变browserForMode的回合切换、recordConfirmedProviderEffect的先保存事实后恢复选择、Facade identity closure或public ports。

前置：新的专项施工授权明确覆盖上述冻结非Skill片区；两个Blueprint先对齐并主Codex完成两遍权威自检，未对齐不得进入代码。按物理删除两个旧方法完整片区→检查这两个定义及旧catch/成功才清引用逻辑ABSENT→在同Owner重构；保留调用方不增wrapper、alias、新字段或转发文件。

重构决定：
1. pending park前核当前activeBrowser记录的call就是active；不等以原GPT_BROWSER_SESSION_TRANSITION_UNSETTLED零物理动作拒绝。保留该记录，调用原active.facade.park一次，等待该原Promise成功/失败；finally仅退休同一owner记录，不删除active call内的confirmed fact、facade或atomicIdentity。park失败原样抛出，不能再次由settle重试旧lease。
2. 旧lease引用退休后才进入原acquire。仅acquisition的try/catch处理“没有取得lease”的情况；实际observation deadline到达且原错误是V6_DEADLINE_BUDGET_EXHAUSTED、原signal未abort时才沿原deadline返回。执行lease期限早于observation期限、真实abort、channel/identity/known-rate-limit错误原样抛；不凭Date.now过期覆盖任意错误。
3. acquisition成功后，先替换active.browser并恢复同一activeBrowser记录，再通过原active.facade.executeDomIntent执行selection；物理退休旧active.browser.executeDomIntent直呼。selection不进入“acquire失败清引用”的catch。当前call/facade与原Child identity贯穿不变，每个新lease的selection也必须按同一productStepId/callId/childCapabilityId/inputHash/actionOrdinal进入runAtomicStep；这兑现GPT Blueprint原第84行及Browser Blueprint原第69行，不新建身份或WAL。
4. parkActive取得当前记录后向Browser移交本次lease的一次park，finally仅清同一记录，即使park失败也不能将该引用留给第二次settle。原Browser失败、主异常/cleanup AggregateError与已stage保护由原消费者处理；引用退休不写WAL/no、不产生Target已释放凭证。
5. 单次execution原串行调用责任不变；合法API消费者的重复settle必须零第二次park。失败后B持有lease时，A再次settle不得改变B的lane/active hash/dispatch。禁止加全局epoch/token/state-machine，现有调用期记录足以闭合。

完成门：§5/G1所有分支native Exam成立；引用在持有新lease期间不丢、无新lease不park旧lease、每个移交的lease最多一次park；原source/effect/identity/hash不变。失败则停止该片区交付，不增加重试或降低guard，恢复接回仍原Executor/Website。

结构余量：当前文件428行、imports7、class members15；wait38行/复杂度10/6参/3await，parkActive11行/复杂度3。主Codex已在内存AST按上述两阶段控制流测得目标复杂度13，非已建设证据。目标留同文件，两个方法各≤75行/复杂度16/await10/返回8/深度5；不往69行的browserForMode加分支、不拆出新管理层。以原生预算裁决，若目标预计越界应在同片区用更短两阶段控制流重写，禁止先堆再豁免。

### B1：唯一FIFO内全部queued请求有限期限

Owner：local-browser-session；文件src/lib/browser/infrastructure/browser-lane-coordinator.ts。完整删除expireQueuedReleases、pump、scheduleWake三块→核旧三个定义及release-only expiry过滤ABSENT→重构这些现有职责。允许原expiry私有方法更名为expireQueuedWaiters；它直接替代旧职责，不是兼容壳，旧名引用归零。acquire/release公共接口、nextWaiter/serveAcquire/withLifecycle/reset、TargetAcquirer与当前wire保持原语义。

1. busy pump用现有waiterExpiryCode检查queue内两种waiter；到期/已abort只从queue移除并原typed reject，原finish清abort listener。不检查或拒绝已出队inflight项，不变active/jobRef，不dispatch、不reset。
2. 原唯一scheduleWake对所有queued项计算其deadline；busy仅选最早expiry，不取eligibleAt/global observation clock，避免past eligibility的1ms循环。idle继续取min(expiry,原eligibility)，Provider observation仍取max(eligibleAt,observationNotBefore)。
3. acquire期限只消费原remainingMs函数，不能在入队冻结一份副本；lease renew合法延长时既有timer到时重读尚未expired则重算，早timer不得假超时。release queued期限仍原queueDeadlineAt，出队后退休；两相不混。
4. enqueue调用原pump、expiry/abort/出队/park/reset后重算原wake；队列为空清wake。唯一timer不得跟随每waiter增加，也不能因一个waiter退出清空其余。
5. quiet和真实command dispatch仍原串行事实；40秒quiet后的release获得原30秒dispatch，signal撤销则不dispatch。仅排队期限有有限出口不能声称native取消、真实lane空闲或cleanup完成。

完成门：§5/B1所有分支及C1/C2回归成立；busy下acquire真正按期typed退出，B/C仍active安全；queue/listener/wake清理无残留。失败保原pending与typed异常、停该片区交付，不能以忽略expiry、取消active或重做Provider掩盖。
结构余量：文件233行/imports9/class members28（上限30）；旧expiry9行/复杂度4，pump24行/复杂度10，wake18行/复杂度9。只替换三个方法，不新增class成员、抽象或依赖；全部原生代码预算守住。

依赖顺序：Blueprint两遍主审 → G1与其局部防回归 → B1与其局部防回归 → 同候选联合反查。B1可独立证明队列有限性，不能代替G1释放持有引用；G1不能代替B1在认证缺席/其它真实占用时的有限退出。

## 7. 质检落点、反例和最终业务验收

直接允许修改的质检仅：
- GPT现役src/capabilities/gpt/acceptance/gpt-production-browser-wait.acceptance-support.ts、gpt-production-browser-recovery.acceptance-support.ts，原gpt-production-browser-lifecycle.acceptance.ts入口复用。
- Browser现役scripts/acceptance/browser-lane-fifo.acceptance.ts与browser-lane-fifo-support.ts，复用真实Coordinator/Acquirer。
- scripts/audit/domains/gpt/gpt-provider-contract-inspection.ts原inspectGptProviderProbeOwnerContract，补AST控制流证明“acquire失败catch不包含selection、登记新lease早于facade selection、禁止此处直呼active.browser selection、park成功失败皆退休同一引用”；scripts/audit/domains/local-browser-session/target-claim-inspection.ts原inspectProductReleaseIsolation，核queue两种expiry/唯一wake及active不被queued expiry改写。
不新增checker、测试registry、专用quality入口或放行分数；旧AST规则同步表达现役方法，不只搜索token/方法名宣称安全。反例在原普通测试入口执行，不能删测试或缩小law/evidence分母。

G1普通Exam：真实Lifecycle调用公开Browser端口stub控制三阶段（park/acquire/select），禁止selection永远成功的单一fixture作为充分证据。原wait fixture的executeDomIntent须实际captureCommandIdentity，验证文本/图片每次选择、成功或失败的命令均带同一checkpoint identity和新lease编号；旧只记录观察/park的数组断言按真实新增选择序列重建，不能删身份断言。覆盖正常换lease与live getter；选择报BROWSER_COMMAND_RECEIPT_MISSING、known-rate-limit、abort、超过deadline后仍保原错误；old park失败后重复settle零第二park，B当前lease/hash保持；acquire reject/到期/abort无新lease则park计数不变；newlease的park失败仍typed失败且引用退休；recordConfirmedProviderEffect恢复选择失败同样有一次收尾；缓存命中与短预算零acquisition。验证原CONFIRMED/evidence/原promptHash及Provider input delta=0。

B1普通Exam：真实Coordinator锁住A lease；fresh/bound-observation/confirmed-readback/authorized-continuation与queued release分别受signal/期限约束。一个项到期不影响A active/hash/native，其它queued仍可在A park后服务；多个项异时到期；remainingMs延长、预先abort、到期0、queue10背压；park/abort/reset后原timer/listener正确收束；busy没有eligible忙循环；idleeligible/原随机唯一clock/跨job公平与live getter不变。原release queued30→quiet40→dispatch30及signal/timeout/跨job cleanup全部保留。

最新日志防误伤验收继续落在以上原Exam：Browser真实Coordinator配原Acquirer时，出队后的Target操作超时/Extension同码拒绝必须沿原BROWSER_TARGET_ACQUISITION_TIMEOUT拒绝当前项、清本次pump占用，下一合法项仍可取得lease；此时原native deadline、待Target认证与pending exact匹配规则均保持。与之对照，仍queued项到期必须发原V6_DEADLINE_BUDGET_EXHAUSTED、Target dispatch增量0且不清其它active；不能混为同一种超时。GPT原prepare/模型菜单失败仍由原finally收尾，不新增这些Child修复；原confirmed读回继续零fill/file-input/submit。Runtime原失败→停止本attempt renew/lease release→Website新grant→同job新attempt执行的公开消费者验收保持独立；已有upload/terminal成功仍待原admission/completed读回，不把请求succeeded当最终完成。

联合反查通过各Owner原普通Exam与一次设计用内存反例重放交叉核对；不建立共享生产journey或Dynamic proof bus。Runtime只验其公开typed结果消费者：执行失败真正结算后原heartbeat不再续租，在途renew先结算；已有stage/Outbox/admission不被cleanup撤销。原Runtime Exam保持独立，不将完整Product/GPT/Browser流程塞入Runtime质检。

实际建设后的唯一质量入口：npm run quality:check -- CHANGE；按冻结ci-full-governance执行 CHANGE通过→授权clean commit→推送→READY通过→再次推送。冻结Skill不修改，原生失败按其要求处理；RELEASE需另有用户明确要求，方案和READY均不启动生产RELEASE。当前方案阶段不运行代码修复测试或READY，不伪报这些未来验收已通过。

生产成效验收只在另获操作授权后执行：
- 由各Owner现役Dynamic Proof独立取得本域law证据，不能共享job/journey/assertion-map代替各自证明，也不在生产对真实订单破坏性注入错误。
- 对本事故故障job按Website当前grant接回；已有结果优先交付，否则原confirmed/source零提交读回，确证不可得再由Website原风险授权。A的失败不是永久demand终点；B/C在合法资格/认证恢复后各抵达自己领域入库。
- 真实日志核每job执行有限终态/renew收束，Browser不再无现实动作却漏占lane；Website领域对象、admission receipt、result_payload_hash和原Runtime completed逐身份读回。原N=1..4、14产品及9个ZIP既有验证义务不减。
- 缺少原答案、授权、认证或领域接纳证据时如实记具体pending/typed失败及原下一动作；不能以打开3个Tab、HTTP200、局部Exam或旧READY判成业务完成。

## 8. 删除反事实、切换与失败停止

| 单元/真实消费者 | 删除会造成的具体失败/较短方案裁决 | 物理退休对象 |
|---|---|---|
| GPT现有call/facade与调用期activeBrowser，checkpoint/settle直接消费 | 删call会丢原effect/Child身份；删持有记录使selection失败不能park。最短是两个原方法的引用生命周期重构，selection复用原facade，无新manager/phase字段 | selection失败提前清引用catch；park失败后旧引用可再次park；pending reacquire后绕facade直呼selection |
| Browser原queue/active/唯一wake，acquire/release消费 | 删queue会并发现实动作；删wake使busy queued acquire无出口。最短复用waiterExpiryCode和原timer；不能另建watchdog | expireQueuedReleases旧名/过滤；busy只计算release expiry旧分支 |
| 原Acquirer及native guard/transport撤权 | 删除会将Promise期限误作物理安全，可能放出仍在途native；没有更短合法替代 | 不删除、不修改；park未知不伪成功 |
| 原WAL/Forensics/stage/Outbox/Websitegrant | 删除会丢答案、抹未知或重发Provider；各Owner正交真相被真实consumer使用 | 不合并；无新表/receipt/恢复状态 |
| 原heartbeat/tracker/cleanup/日志投影 | 删除合法运行续租或既有效结果收尾；引用/期限修正后原链即可真实收束，无需再造机制 | 保留L1/C1/C2/D1成熟实现；旧日志status不作资格 |
| 两个既有Blueprint/两个既有inspector/领域Exam | 删除会留下错结构或漏掉这两个真实故障分支；已有入口足够 | 原错误段落/规则在同候选同步替换，无第二verdict |
| 新epoch/token、每waiter timer、capacity-release API、状态表/health缓存、兼容链 | 全部删除仍可沿既有Owner闭合本分母，不能证明必要 | 不设计、不预留、不建设 |

每次施工只物理删除上列批准的精确片区，保留不涉及GAP的成熟结构和消费者；主Codex现场核ABSENT，再同路径重构。审计更新只因真实finding发生，不增加全仓大重写。没有“代码更少就算提升”的退化验收：正向两个反例修复和成熟防回归必须同候选同时成立。

本轮无协议/合同/数据库/扩展变更，只有AGENT单仓代码build切换，无双仓不兼容窗口。将来切换必须另获重启/部署授权，原Runtime先停新claim并核真实在途/结果交付；卡死旧进程的内存引用不能被源码更新热修，未真正退出不宣称drained。不发明强杀/接管接口，不按端口猜杀进程，不用历史DISPATCHED=0作切换门，不操作用户Tab或人工删单。无法通过原启动/停止入口证明确切旧Owner已退出时，停止运行切换并返回具体进程事实及操作授权缺口。

回退点是同一已核AGENT完整build；回退只回代码，不撤已写WAL/Forensics/Outbox/receipt/source，不复活旧fence。退回会重新暴露本次缺陷时保持停止新输入，再修正此唯一链；不能启用备用通道、重试旧park或新flag绕过。代码改动/审计/质量期间相关source漂移只重核受影响片区，用户overlay不可覆盖、stash、移走或顺手提交。

## 9. 主审、子审与执行者重绑定

方案主审必须三轮、按真实finding修订后再复核：第一轮authority/Owner/合同/冻结边界；第二轮本分母失败时序及跨job连坐攻击；第三轮前轮连续性、删除反事实、结构预算、四维验收与source candidate。三轮完成后才启动子智能体，子智能体只读比较本方案与当前源头、法案及双遍完整Skill；不是代码写手，不执行Browser或生产动作。子审未明确放行不能把状态改为可施工。

执行Codex须先重绑定§10的当前源头，重读冻结索引与本项目现役权威，确认新的专项授权精确覆盖G1/B1及两个Blueprint/质检；本轮方案授权不构成非Skill基础设施施工授权。完成Blueprint法案对齐和两遍主审后才进入代码；代码建设后主Codex至少两遍自检，再由审计子智能体实际比建设与本方案的差异，全部放行才进入原生CI-FULL。设计子审签字不能代替代码子审、quality verdict或业务readback。

主Codex方案三轮自审已完成：
1. 权威/四维审计：核39条active law、全部显式lawId引用、两个Manifest唯一Owner、公开合同45/18/10无delta及专项授权。将法案表缩写替换为完整lawId；纠正前稿旧CI链，RELEASE不随READY自动执行。无需修法，两个Blueprint欠缺必须在施工前修正。
2. 连坐/失败反向攻击：以现役两个类重现selection漏释放和旧park重试清掉新lease两个反例；将park失败后的引用退休、无新lease不park旧lease、selection错误不能被墙钟覆盖和known-rate-limit保持列为必须验收；补stale call拒绝及remainingMs合法延长反例。没有强制取消active、历史WAL门或重复Provider输入路径。
3. 连续性/删除/结构审计：原Child跨lease identity、C1三相release预算、L1/C2/D1与Website唯一恢复保留；当前方法预算及目标AST复杂度13可承载，删除所有新增manager/timer/状态表/备用链。复核每项分母均落到G1/B1及原消费者，source候选无漂移，产物仅本唯一方案。文档尾空行已去除，待子审实际复核。
以上是设计审查，不是原生quality PASS或已修复生产。

两位独立审计子智能体实际全文双遍读取闭环Skill，比较本方案与现役源码、法案/Blueprint后均明确放行，无未解决finding。法案/误伤专审提出F-LAW-1：pending reacquire的selection原直呼绕过facade，原fixture又未捕捉selection身份。主Codex据GPT Blueprint原第84行、Browser Blueprint原第69行核证并修正§4/G1/§7/删除表，两位子审均读回复核放行。直接兼容核验：selection仍为lifecycle与既有browser.dom.click.v1，BrowserCommandActor的mutation闭集不含selection；通过原facade携checkpoint observation-only identity不产生新WAL、receiptBindingHash或提交资格，原permit/Extension接收兼容，无需wire改动。两人同时核G1旧park失败后一次引用退休、B1 queued期限不改active/native及原三相预算；闭环质检独立重算两仓原scoped hash相等。最后Website无关商业订单证据模式漂移按§10重绑定，法案专审再次独立核新hash及AI恢复/合同/Provider不变，明确前次放行保持。主Codex最后核重绑定source一致、AGENT仅此文档dirty、diff check无错误。此放行不授权施工、不代替代码子审、原生quality或生产readback。

最新日志补证已完成三轮主核：第一轮逐eventId/完整对象与原始固定窗口、job/attempt/lease/Child身份核对；第二轮核零Provider输入、原失败收尾/新grant接回与其它job继续完成，并区分Target操作超时和queued expiry；第三轮核G1/B1施工面、成熟验收及两仓scoped source均未改变，实际差异只有本方案。随后法案/连坐专审与闭环/连续性专审各自完整解析附件与固定原始窗口，独立重算日志及source hash、读回§2/§7/§10，均明确补证放行，无未解决finding，前次方案准入保持。仅补充证据与原Exam防误伤要求，没有生产修复或动态通过结论。

## 10. Scoped source candidate

方案文件自身不进入source hash。各仓路径按UTF-8 bytes排序，连接每个path + NUL + 文件内容SHA256十六进制 + LF，再SHA256。文档hash最终交付另报，不递归写入自己。本轮初次写前两仓overlay均空，保持main；AGENT后续仅本方案dirty。子审后写前复核发现Website他人overlay：商业订单LAW-COMMERCIAL-ORDER-MANAGEMENT-008-V5→V6仅升级证据模式、版本与supersedes，summary/forbidden不变，另有SYSTEM-BLUEPRINT、商业订单checker及独立方案改动。主Codex重核本范围内只有功能法案文件bytes改变，LAW-AI-ACCEPTANCE-002-V37/004-V33、45/18合同与Provider实现均不变；按该文件新bytes重绑定以下Website scoped hash，所有他人overlay原样保留，不扩大施工或网站质检。

/Users/nexgen/Documents/AGENT：branch=main，HEAD=5554299631b2820b58a9ce18b6365474ed90756d，tracking=refs/remotes/origin/main（5554299631b2820b58a9ce18b6365474ed90756d）；42文件scoped hash=93c69dadd29fb99cf5b5065f12f711811bbe825a5e683606466abf6662c5425d。

```text
.agents/skills/agent-flow-boundary-gatekeeper/SKILL.md
.github/instructions/agent-rules/功能法案.md
.github/instructions/agent-rules/基础法案.md
AGENTS.md
docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md
docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md
docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md
docs/governance/法案系统建设说明书-冻结定稿版.md
docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json
docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json
docs/项目方案/GPT等待原因可观测性-完整实现方案.md
docs/项目方案/N 标签工单独占轮巡模式方案.md
docs/项目方案/十小时连续运行事故分组根治-完整实现方案.md
package.json
scripts/acceptance/browser-lane-fifo-support.ts
scripts/acceptance/browser-lane-fifo.acceptance.ts
scripts/audit/domains/code-purity/components/structural-metrics.ts
scripts/audit/domains/gpt/gpt-provider-contract-inspection.ts
scripts/audit/domains/gpt/manifest.json
scripts/audit/domains/local-browser-session/manifest.json
scripts/audit/domains/local-browser-session/target-claim-inspection.ts
scripts/audit/generated/law-registry.generated.json
src/capabilities/gpt/acceptance/gpt-production-browser-lifecycle.acceptance.ts
src/capabilities/gpt/acceptance/gpt-production-browser-recovery.acceptance-support.ts
src/capabilities/gpt/acceptance/gpt-production-browser-wait.acceptance-support.ts
src/capabilities/gpt/production-browser-lifecycle.ts
src/capabilities/gpt/production-child-tools.ts
src/capabilities/gpt/production-execution-session.ts
src/lib/browser/browser-authority-api.ts
src/lib/browser/browser-failure.ts
src/lib/browser/exact-target/browser-command-actor.ts
src/lib/browser/exact-target/browser-target-lease-manager.ts
src/lib/browser/exact-target/browser-target-lease.ts
src/lib/browser/infrastructure/browser-authority-broker.ts
src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts
src/lib/browser/infrastructure/browser-lane-coordinator.ts
src/lib/browser/infrastructure/browser-target-acquirer.ts
src/lib/local-runtime/production/executor.ts
src/lib/local-runtime/production/runtime-business-admission.ts
src/lib/local-runtime/production/runtime-execution-heartbeat.ts
src/lib/local-runtime/production/runtime-loops.ts
src/lib/local-runtime/production/runtime-startup.ts
```

/Users/nexgen/Documents/xuanxue-web（只读参与，零施工）：branch=main，HEAD=60ae5569da4ed1957232c909b19f4e7b406bcfed，tracking=refs/remotes/origin/main（60ae5569da4ed1957232c909b19f4e7b406bcfed）；8文件scoped hash=b3076611511873656e0688f5cb8b660a06da34f9d0b983878a09c6b619924961。

```text
.github/instructions/agent-rules/功能法案.md
AGENTS.md
docs/governance/法案系统建设说明书-冻结定稿版.md
docs/specs/ai-acceptance/website-agent-task-result.provider.spec.json
docs/specs/ai-acceptance/xuanxue-ai-production-v6.contract.spec.json
packages/ai-contracts/src/agent-task/website-agent-task-result.ts
packages/ai-contracts/src/production-control/xuanxue-ai-production-v6.manifest.json
services/api/src/ai-production/job-terminal-repository.ts
```
