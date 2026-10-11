# AGENT 连续运行故障修复完整实现方案

状态：L1/C1/C2/D1 已建设、建设子审放行，待原生质量验证；E1–E5 设计阻断。日期：2026-10-11。唯一文件沿用“浏览器命令WAL孤儿DISPATCHED自愈-完整实现方案.md”，不新增竞争方案。
方案设计阶段只重建本文。2026-10-11 用户明确授权施工后，L1/C1/C2/D1 进入 main 建设；E1–E5 仍设计阻断，不宣称整份故障清单根治。当前生产进程和工单未操作，Website 仅只读。

## 1. 目标、权限与完成终点

需求 Owner 是 AGENT 现役生产链；业务恢复裁决及最终完成 Owner 是 Website.ai-acceptance / 对应领域 Consumer。
目标是合法工单独立推进，机械有效结果先交付、最终入库，清理与旧故障不连坐；真实授权丢失仍停止危险动作，未知或已发生的 Provider effect 不盲目重放。
全轮建设只能在 /Users/nexgen/Documents/AGENT 的 main。Website /Users/nexgen/Documents/xuanxue-web 本聊天只读；网站代码、数据库删除与重新派发由网站 Owner 接力。用户自行删除的旧八字单不进入本轮 AGENT 修复对象。

权限继承只适用于既有明确批准的精确片区。本稿新增续租生命周期及日志投影重构不借旧恢复批准扩大冻结基础设施；执行前按现役 gatekeeper 核精确路径授权。母本与 active law 不在本轮修改。冻结 CI-FULL、闭环 Skill 不得修改。
业务终点只认同一 job 的 Website 领域对象 commit + admission receipt，Runtime exact hash 读回 local completed；HTTP 200、上传成功、terminal SENT、局部验收、子审或 READY 均不能代替该终点。Browser cleanup 是随后独立资源收尾，不撤销 admission。
设计深度为深度：命中同片区近期反复迭代、跨 Owner lease/terminal 时序、唯一 lane 与原恢复方案 R6/T10 重叠。

## 2. 输入证据与当前边界

- 用户日志：/Users/nexgen/.codex/attachments/97396973-ab8a-4873-a136-dab96f44e8b4/已粘贴的文本.txt，1754 行，1746 条 JSON；UTC 00:17:51.516—06:13:27.840。
- 完整原始段：/Users/nexgen/Documents/AGENT/.grasseye-local/runtime-logs/agent/cfb28d33-b077-452a-b0aa-c010b3b4e947-0001.jsonl，22240 条事件。identity 从同 spanId 的 started 取得；terminal 本身没有 typedIdentity，不能按墙钟猜 attempt。
- 原始段中 140 个唯一 job、156 次执行：139 succeeded、17 failed；失败为 13 次取得 Target 超时、3 次 Target invalid、1 次 HTTP 500。16 次 lease-renew 409 单列，不能算成16张失败工单。
- 只读对账快照显示139份结果已完成且有 admission，139个提交 effect 的 WAL 为 CONFIRMED/各一次输入，139个 terminal Outbox 已 SENT。失败的14张中13张后来完成；最后一张在停机期间出现，不能称其永久卡死。这些历史只读事实不是本稿候选的 Dynamic Proof。
- 这一运行段都是 localization_static_catalog/produce_locale_catalog/zh-HK；不能替代九个分析产品 ZIP、14个产品或 N=1..4 的生产验收。
- 旧 run 631567b0-e573-49c6-8129-3a31fa428177 的停止链没有真实 terminal。只可报告开放 span / incomplete，不能从日志戛然而止断言 kill、crash 或补造失败。

## 3. 现役权威、施工图与前轮连续性

只从当前源头读取规则。AGENT 源头为 .github/instructions/agent-rules/基础法案.md、功能法案.md 与唯一 generated registry；母本为 docs/governance/法案系统建设说明书-冻结定稿版.md §0/4/35/36/37/44/47/79。Skill 为 /Users/nexgen/.codex/skills/closed-loop-implementation-design/SKILL.md（本轮完整双遍），以及仓库 .agents/skills/agent-flow-boundary-gatekeeper/SKILL.md。

| 对象 | 当前权威 / 施工图 | 本轮裁决 |
|---|---|---|
| 续租、结果、逐单收尾 | LAW-AGENT-PRODUCTION-RUNTIME-001-V76 forbidden3/5/8；docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md V66 §1及末段 | 改实现断裂；先对齐该 Blueprint 的续租收束时序与清理局部错误边界，不删现役续租重试或 fence |
| FIFO/Target/节拍/当前输入 | LAW-LOCAL-BROWSER-SESSION-003-V46、004-V57、006-V46；docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md V56 | 清理预算按原 Owner 重构；未知故障不放宽 activation、load、Document、permit、WAL 或节拍 |
| 日志独立失败投影 | LAW-RUNTIME-LOG-SPINE-001-V7 forbidden1/8、003-V6；docs/blueprints/runtime-log-spine/RUNTIME-LOG-SPINE-V2-BLUEPRINT.md V3 §2/5 | 只改已有终端投影；不改原始事件、任务状态、因果规则或日志 schema |
| 网站接纳/续租/取消 | Website LAW-AI-ACCEPTANCE-004-V33；docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md §V6控制主链（renew结束后才release） | 网站 terminal 清 lease 与拒 stale renew 正确，不能降级 Website fence |
| 结构与存在 | LAW-CODE-PURITY-001-V6、002-V2、003-V3 | 所有新增生产结构必须经§8删除反事实；不扩 Owner/平台 |
| 原生质量 | 三个现役域 manifest/inspector/acceptance；AGENT package.json 的 quality:check | 只扩真实漏检分支；不建第二 checker/verdict，不以文档审查冒充质量 PASS |

前轮 613911bea 实际把清理从全局未SENT门/只选第一张改为各 job 自身 Outbox + pending 快照循环；当前 runtime-loops:229–244 仍有错误名前缀过滤。既有 recovery-contract.acceptance-support:388–403 只用 BROWSER_EXTENSION_CHANNEL_UNAVAILABLE 验首项失败，漏掉真实 V6 deadline。保留其“先业务完成、再清理；逐项一次；失败下轮续查”，扩验真实 Browser 类型而非重新造恢复系统。
6680447d9 为当前代码基线；历史 CHANGE/READY只证明其原候选。本稿不把这些记录复用为新候选 PASS。
前轮十二项恢复及九分析产品接力已由当前源头接管：合同 task-result18/control45、protocol10、唯一槽处置/ACK重交、source seal/指定调用风险授权、满N独立recoverable、orphan只诊断、SENT只读确认及九产品专业流程保持现役，不重新执行旧9→10/44→45/17→18迁移。
原十二项中 R6 的遗漏由 C2 接续；其余没有本轮新违约证据时复用现役代码/原验收。旧 source 祖先非法数据仍只约束所属 job，不加旧 decoder、迁移writer或全局门；原 Website旧工单处置与合同18生产切换证据未被本稿判定完成。
前轮“顽固故障根治与重命名子能力退役-完整实现方案.md”§5.S/§S的瞬时续租容错已由现役renewWithinBudget与原lease-renew-retry-support接管；L1保留同lease剩余预算内5xx/不可达重试、原新request_id及4xx/2xx schema停止，不重复旧修复。现役“日志迭代方案.md”只处理checkpointSequence并明确排除终端噪声，非D1竞争方案；9月16/17日旧lane/Target方案只作相关历史线索，复用当前法案/施工图/代码，不宣称其未核GAP全部退役。
九分析产品 bazi_ai_full_analysis、bazi_chart_interpretation、bazi_report_followup、qimen_professional_answer、qimen_report_followup、hehun_ai_analysis、hehun_report_followup、naming_bazi_analysis_and_naming、naming_from_existing_bazi_report 保留各自 Product Skill/Flow/精确模型/推理强度/父材料及真实ZIP集合；review仍精确消费原两JSON。BZ03/BZ04必要机械解包留原 Product；不复制网站业务 archive Builder，不新增通用解包层。既有9产品及14产品动态分母不减，不从单一 catalog成功推导其已实测。

## 4. 七类问题逐项裁决

| 编号 | 第一断裂/证据强度 | 工单/停止门 |
|---|---|---|
| F1 取得 Target 超时 | 13次均在页面准备、Provider submit之前；ensureAvailableTarget用min(commandTtlMs,remainingMs)，实际上限20秒且含创建/导航/闸门；ExtensionCreatedTarget.waitForCreatedTarget及consumeTabUpdateAfterBarrier要求status complete。已定位超时出口，缺真实故障那一刻的加载/事件/attach/导航事实；长Child时长还包含FIFO等待，不等于Chrome加载80秒 | E1只读取证；禁止先扩大20秒、删load或伪 claim |
| F2 Target invalid | 原始seq10877/10894/10918；c4e32a10、a657b892两个job三attempt，profile-open的wait/inspect失败。实际类隔离复现证明loading及activation-cache不等都折叠到同码，但不证明历史三次属于哪一种 | E2只读取证；禁止覆写tabs.onActivated世代/后台硬点/猜Tab |
| F3 清理与park | 已确诊：release在入FIFO时建立30秒deadline，pump随后必经40秒submit quiet，可在真实dispatch前自耗尽；实际类隔离复现dispatch=0、V6_DEADLINE_BUDGET_EXHAUSTED。该码又被Runtime的BROWSER_过滤外抛，首项后续清理被跳过。另961…的park（原段seq1071→1076）约30秒无REPLY，缺Extension处理/发送事实；已排除TARGET_REVOKE必然拒其pending的猜测 | C1/C2确定重构；E3调查park，不能将park缺回执当同一已确诊原因 |
| F4 完成后仍续租 | 16次AI_LEASE_FENCE_STALE；10次renew started已晚于该job terminal success，6次在途跨过terminal。heartbeatWhileRunning包住整个executor，executeAndUpload回调先stage/send terminal，executor finally尚未结束；网站writeFirstTerminal立即清lease，真实所有权结束而续租未收束 | L1确定重构；不吞409、不改网站CAS、不把Product成功撤回 |
| F5 网站500/传输reset | f7b3c452/4ad84e3d原seq10117，结果上传500；原checkpoint/Outbox保留，同attempt新lease后零Provider输入交付，03:02:19.576领域接纳。另一次claim ECONNRESET后正常接续。没有原始API异常/request对应服务端事件，不能断言SQL序列化或本地代理是原因 | E4 Website Owner只读取证；AGENT沿原Outbox继续，不加即时同lease重投/新attempt |
| F6 旧八字未删除 | aiprod_17f6beeadc1c87804b9ba49b723de59d/current attempt 2f1b035a-0aea-4659-a64c-61876863556c，无该attempt stage/terminal/first fact，网站control=cancel_requested。claim selector要求none；取消请求不等于物理删除。device-status独立读取可用，generic job GET以现役18重验旧17材料返回500，是另一断裂。旧无fact行进入shutdown核验导致RESULT_UNCONFIRMED | B0仅确认Owner/absencereadback；网站用户完成删除。不能擅自恢复已取消需求、释放容量或伪造失败；与E4上传500不合并 |
| F7 诊断漏显/误归因 | sinks.projectionIdentity对无typedIdentity terminal退到traceId，独立span/新attempt同code被去重；原始17执行失败终端只显示15，13个acq失败infra只显首个。readHealth把通用lastErrorCode折成cloudState，会把Browser失败标成云降级；旧lastError不是当前云故障事实 | D1确定重构独立失败投影；E5核健康源头，禁止凭历史码增恢复/容量门 |

## 5. 唯一目标链、身份与合同

唯一链继续是 Website 当前 grant → Runtime durable accept → 原 Product → Browser唯一FIFO/WAL → 原 Forensics结果 → 原 Outbox上传/同事务stage+terminal intent → 收束此job的续租 → 原terminal交付 → Website Consumer/admission → Runtime completed/释放业务席位 → 原worker逐job资源清理。
收束续租只结束当前执行授权的运输续租，不关闭业务需求、不定义新attempt、不撤销stage；失效时保留原Outbox，Website签原恢复授权后接回原交付链。
identity spine保留job_id/request_hash/accepted attempt/lease_version/fence/result_hash/terminal request_id/receipt_hash；Browser另保留同effect的logical_mutation_id/command_id与现役receipt binding。Target/Document仅当前现实坐标，日志span仅诊断身份，两者不进入恢复或业务完成资格。

| handoff | 不变合同与权威事实 | 本轮落点 |
|---|---|---|
| Website ↔ Runtime | ai-acceptance.xuanxue-ai-production-v6 version45；required/nullable、next_action三枚举、source canonical hash/祖先、lease/fence、request幂等键及strict unknown策略原样；task-result18与九ZIP角色/顺序/hash原样 | L1仅改AGENT私有调用时序，不加跨仓字段/重签source |
| Runtime续租 ↔ terminal callback | 当前内部heartbeatWhileRunning仅一个生产调用者executeAndUpload；现役stageResultAndEnqueueTerminal原子持久化，sendStagedTerminal仍原Outbox入口 | 删除“传入已启动整executor Promise作为续租唯一寿命”的片区，重建同Owner内执行回调，提供一次可重复调用的stop-and-join续租动作；不是新公共服务 |
| Runtime ↔ Browser release | releaseJobBoundTarget(jobId,既有business-admitted/wait-new-attempt/website-admin-deletion,signal)，仅这三种权威；wire protocol10 release三字段、auth/sequence/receipt不变 | C1只调内部dispatch预算起点；C2只消费Browser公开typedBrowserExecutionFailure |
| Logger ↔ sinks | 现役RuntimeLogEventV2/spec V3字段、hash/redaction、kind、impact/causedByEventId不变；终态已有spanId；raw全量先持久 | D1用原span辨认新独立失败，不加typedIdentity到terminal、不加Map/存储/schema |
| 未知故障诊断 | DIAGNOSTIC键/值是browser-authority-diagnostic严格闭集，commandStage仅五枚举，nativeCause仅两个Chrome码 | E1–E3不擅自加phase/status/URL/DOM字段。若现役只读现场无法取得必要事实，则保持GAP；扩展wire需另行精确规范授权及完整cutover设计，本稿不预建它 |

## 6. 有限分母与接回原链

| 输入分支 | 唯一Owner与动作 | 输出/readback、失败与恢复回接 |
|---|---|---|
| Product运行/上传前、未stage | Runtime原续租20秒周期与remaining lease预算；5xx/不可达原预算重试，4xx/schema拒绝原typed失败 | 当前lease/fence；真实失效先abort危险执行，再原failure/source交Website，不继续外部输入 |
| 同identity stage+terminal intent成立、无renew在途 | Runtime同步关新renew，再调用原terminal交付 | stage与Outbox原行不变，terminal receipt→admission；日志/transport失败留原结果，原Outbox/Website regrant回接 |
| stage成立、有renew在途 | Runtime先关新renew，等待此renew完整预算重试及receipt验证/control处理真实结束，再发terminal | 不abort HTTP后假装server已停；在途拒绝/预算耗尽不并发terminal，保留原Outbox交Website原资格恢复 |
| completion callback/执行异常或停止与renew交错 | 同一个Runtime Owner以幂等stop-and-join闭合；未stage则原错误出口；有stage则核sameidentity | 没有回调等待整个executor/自身的循环等待；不制造正常terminal掩盖真实开放span，stage-vs-seal CAS保留 |
| cleanup已入FIFO且未dispatch | Browser原FIFO保留queued release原30秒有限期限；出队即退休该排队期限，完整等原quiet；队列容量仍10 | 排队到期/原signal撤销均真实typed失败且保留pending，不是释放成功。原wakeTimer只拒绝到期queued项，不改变在途lane；出队后原30秒dispatch预算独立开始 |
| cleanup dispatch成功/失败 | Browser原pending Target acquire/release与原timeout/认证回执Owner | 仅真实同job release回执后Runtime settle；deadline/背压/缺Authority等已知局部typed失败留标记且本轮续B/C |
| cleanup raw/共享故障 | Runtime只隔离公开Browser类型及§7 C2边界；Store读写/未知raw异常不吞 | 原worker记录真实失败/有界下轮；不settle假成功，不把共享损坏冒充单job失败 |
| 结果已SENT/admitted、日志坏 | 原Runtime继续只读admission/同hashcompleted确认，禁止新claim/mutation/未发云写 | 已交付确认闭合；原sink恢复后继续原Outbox/worker，不造成功日志或第二发送器 |
| 新独立failed span/同event再次投影/重复成功 | 原日志投影Owner，D1 | 新独立失败可见；同key仍驻留于当前进程4096项投影窗口时同event不重显，驱逐后可重显；同成功不刷屏、TRACE不变、CONSEQUENTIAL不冒充BLOCKING |
| 未知acq/invalid/park/500/健康原因 | 原Browser、Website或Runtime Owner按E工单精确读证；不改变行为 | 证据齐才能将对应E改成根因重构工单；不能取得则该分支设计阻断、保留原worker合法恢复，不阻兄弟job |
| Website已取消但未缺席/精确缺席 | Website唯一决定需求与物理删除；Runtime不能将cancel_requested当absence | 未缺席保留原事实，不重放；exact absence才原purgeDeletedJob→Browser同job释放/WAL清除→task/Outbox/材料/Forensics逐对象缺席，兄弟不变 |

## 7. 原子工单与顺序

共有前置：执行者重新绑定candidate/精确冻结授权；先只改直接命中的现役Blueprint实现说明（不创设新禁令、不修改active law），主Codex两遍核对无finding，才进入代码。各工单删除下列原片区与其失效断言，检索ABSENT后再写一条链；不能直接覆盖、增or白名单或复制改名留旧路径。失败停该工单危险写，保留durable事实；修复后只从原Owner接回。无关函数、成熟节拍、专业流程不删除。

### L1：续租在terminal之前收束

施工协审补证：原 worker-session.ts#request 的 `init.signal ?? AbortSignal.timeout(30_000)` 被 renewProductionLease 传入的普通 Product signal 覆盖，leaseBudget 只有数值期限，正常 shutdown 又先等待 active；因此原 fetch 无有限出口，会使新 join 永久等待。按同一 Runtime Owner 删除 request 的旧信号二选一接线，在原唯一 request 内组合调用方 abort 与已有 CLOUD_REQUEST_TIMEOUT_MS=30秒，覆盖 response body 解析完成；超时是 CLOUD_TRANSPORT_UNAVAILABLE/结果未知，不证明服务端终止，绝不能据此发送完成 terminal，仍保留 stage/Outbox 并走 Website 原重授/readback。成功、失败、body 解析及 abort 都清原调用期计时器与监听，不新增 timeout Owner/公开字段或重试链。原续租重试等待另退出 runtime-state.wait 的残留 listener 接线，复用同文件有界等待责任并在正常 timeout/abort 清 listener，不改变全局 wait 或 5秒预算。测试必须控制真实 session.request 的 fetch/body 悬挂及调用方 abort，证明有限失败、无假 terminal、重试仍受原lease预算约束；已停止续租的 timer/listener 归零。worker-session.ts 已在本方案原 scoped candidate；该 request 原32行有重构余量。删除无消费者 ExecutionTracker.isSettled/settled，不保留旧寿命死字段。主Codex两遍核权限/Owner/未知语义与请求全寿命后才施工。

Owner：AGENT agent-production-runtime。目标只消除terminal/renew竞态，不缩短未stage的合法续租、不改Website fence或Product恢复。
片区：src/lib/local-runtime/production/runtime-execution-heartbeat.ts 的 heartbeatWhileRunning/trackExecution协作；runtime-claim-operations.ts 的 executeAndUpload当前唯一调用及结果callback；对应Blueprint §1。
动作：删除旧Promise寿命接线→ABSENT；原heartbeat启动一次executor回调，回调在同identity durable stage后、sendStagedTerminal之前调用stop-and-join。同步关闭后续renew准入，用同Owner一个调用期完成通知唤醒等待；物理替换heartbeat里原runtime-state.wait(20_000,signal)的接线，调用期仅持有原一个20秒timer，stop/abort/executor settled/正常超时均统一clearTimeout并移除临时abort监听，不用裸Promise.race留下旧timer，不改全局wait、不建第二timer，正常stop不得为唤醒等待而abort Product controller；await已经开始的一次renew完整逻辑，包括原retry budget、receipt/control/fence验证。停止通知不可等待整个executor；renew失败不能等待正等其结果的callback，须先传播该renew结果，再由原外层收束executor，避免自等待。原tracker继续区分已settled-before-abort与真实边界失败；stop幂等。
原生质量补正：删除 executor tracker 的拒绝旁路观察及 `.catch(() => undefined)`；原 tracker 唯一 Promise 明确承载 fulfilled 的原值或 rejected 的 unknown 原异常，原唯一 settleTrackedExecution 消费后返回原值或抛出同一异常，保留 settled-before-abort 与 Runtime boundary 转换。它是当前调用内结算值，不新增持久状态、公开合同或第二结果 Owner。必须用真实 executor 在 renew 在途期间提前拒绝的反例核异常身份、零 unhandled rejection、原 timer/listener 清理；不以空 catch、改名或 checker 豁免消除原生 finding。
失效/过期/4xx或schema拒绝不吞：停止危险动作，未送terminal留原Outbox；已stage不因cleanup撤销。stop-and-join结算真实renew后核原Product signal；control receipt触发abort或其它真实abort时以原Runtime boundary failure退出当前首次发送，保留stage/Outbox，下一动作仍由Website原授权决定。实际send前仍由原session/fence断言决定写资格。测试必须组合真实heartbeat和executeAndUpload，不能用fixture独有的abort guard制造零发送；实际control receipt后terminal physical request=0。无callback/失败/正常停机出口都真实收束renew，不能遗留20秒轮次或第二续租Owner。
验收：原 lease-renew-retry-support 与 recovery-contract.acceptance-support调用真实生产实现（原fixture的heartbeatWhileRunning参数接线一并退休/重建；不得保留旧execution/new回调双shape），控制同一renew请求先占住，再使stage成立；terminal必须等其结算。覆盖terminal前已无renew、renew在途成功/5xx重试/4xx/非JSON与schema拒绝、callback前后abort、executor finally长清理、同步callback、stage与seal竞争、sink失败。stop-and-join完成后续租轮询的挂起timer/临时监听器均为0；成功terminal之后renew physical fetch增量=0；Website admission精确读回，原结果hash不变；失败不伪成功、不重做Provider。
结构：executeAndUpload现74行/复杂度16，无直接加行余量；同工单先将现有“上传→构建terminal→stage”真实独立责任移入同文件私有函数，只有原callback消费，不新增层/文件/重新包executor。heartbeat现51行，停止/join与一次renew验证在同文件按真实责任组织，所有原生预算仍守住。验收按真实职责归位：已有 failure-transport.acceptance-support 承接原首次 terminal 的真实源码/SQLite/Outbox 反例，recovery-contract 原入口直接消费，不留旧重复 fixture；lease-renew 原文件分别验证真实 HTTP request 有限出口与 heartbeat 收束。只复用现役文件，不新增测试平台或转发链。

### C1：release的dispatch预算不被FIFO/40秒静默提前吃掉

Owner：AGENT local-browser-session。片区：src/lib/browser/infrastructure/browser-lane-coordinator.ts 的 ReleaseLaneWaiter、releaseJobBoundTarget、waiterExpiryCode、pump/scheduleWake有关release分支；browser-target-acquirer.ts 原awaitTargetOperation复用不另造timeout；对应Browser Blueprint资源释放说明。
删除release共享remainingMs把排队、quiet、dispatch混成同一deadline的片区→ABSENT；重构三相：①仍在FIFO中的release保留现役入队30秒有限期限；②nextWaiter取出后即退休该排队期限，原40秒quiet完整等待，不用旧期限否决；③quiet完成且再次核signal后，原Acquirer.awaitTargetOperation建立其原计时器时取得完整30秒dispatch预算。AcquireLaneWaiter仍用原调用方remainingMs/命令budget。
原唯一wakeTimer原位承载仍queued release的到期唤醒；现役release enqueue只调用pump而pump在active时早退，故入队接线必须同时维护原expiry wake，不能只改scheduleWake正文。enqueue、队列变化、timer回调后按现役Owner重算。lane active期间只按queued release最早expiry调度，不能再取已过去的eligibleAt造成1ms忙循环；到期仅移出对应queued waiter并typed reject，再安排其余到期点，不dispatch、不改active/activeJobRefHash、不取消当前native。idle时复用原FIFO eligibility/pump，reset清原timer与listeners。没有queued release的active lane不创建wake；不建新timer、per-waiter timeout、队列或release lane。
输出是原exact job release回执；超时仍失败，不置cleanup settled。acquire的20秒命令budget、同effect去重、1.5/2.5/40/70—90秒各门不减。shutdownRuntime实际先await iteration/drain再abort；不假称该abort可预先解除等待。本工单以queued项原30秒有限出口使cleanup调用可结束，原shutdown检查仍如实报告资源未收尾；不改Product controller或关闭顺序。出队quiet后原signal已abort则不dispatch。真实native未结束仍由原串行事实控制，不能用取消queued Promise证明物理空闲。
验收：在原browser-lane-fifo.acceptance.ts/support及 business-admission.acceptance-support调用真实Coordinator/Acquirer；立即出队并已等待40秒quiet后dispatch仍有完整30秒，原队列期限过去不影响已出队项；锁住真实active lease使release仍queued，30秒仅该项typed失败且iteration可结束，原active/jobRef/当前native不变；到期再排下一项且无1ms忙循环；queue=10背压、queued abort、gate后abort、同job同authority、dispatch后30秒无回执仍失败；reset/settled无遗留wake/listener；acquire deadline原样；兄弟Target/操作者Tab不碰。已admitted结果/席位先闭合，清理后标记读回；不得通过忽略所有expiry实现。
依赖：精确Blueprint和冻结片区授权先成立；C2消费其真实queued V6 deadline与dispatch Browser timeout类型，验收两者合成，不改protocol10或固定扩展权限。

### C2：逐job清理隔离使用公开类型，Store异常外抛

Owner：AGENT agent-production-runtime。片区：src/lib/local-runtime/production/runtime-loops.ts 的 reconcileCompletedBrowserTargets；原 worker-loop-inspection.ts、recovery-contract.acceptance-support.ts清理分支与直接验收。
删除BROWSER_字符串前缀裁决及包含settleBrowserCleanup的宽try→ABSENT；只对release调用捕获公开browser-authority-api.typedBrowserExecutionFailure。对真实typed Browser局部失败记录现有诊断并continue，不因V6码失名而中断后续。Runtime abort不再推进后续危险资源动作；sink/共享Store/provenance损坏、未知raw仍外抛，不能利用Browser包装把共享损坏变成可吞局部错误。局部闭集仅为公开Browser类型的 V6_DEADLINE_BUDGET_EXHAUSTED、BROWSER_TARGET_ACQUISITION_TIMEOUT、BROWSER_EXTENSION_CHANNEL_UNAVAILABLE、BROWSER_BACKPRESSURE、BROWSER_TARGET_INVALID、BROWSER_TARGET_CLEANUP_FAILED。来源分别为原Coordinator预算/queue、Acquirer timeout、认证通道与Extension release当前job检查；不用Runtime错误前缀猜邻域结论，不给业务重放资格。原signal已abort立即退出该快照，不settle后续。RUNTIME_LOG_SINK_WRITE_FAILED/RUNTIME_LOG_CAPACITY_BLOCKED、BROWSER_REPAIR_REQUIRED、BROWSER_MUTATION_STATE_UNAVAILABLE、provenance/schema/认证矛盾及其余未命中项一律外抛；不列不存在的错误码。
成功release之后、catch范围外才调用原settleBrowserCleanup；从原pending快照每job一次，只看该job自身未SENT，不创建轮转/重试表。当前reason不参与完成或恢复。
验收：真实公开BrowserExecutionFailure的V6_DEADLINE_BUDGET_EXHAUSTED、BROWSER_TARGET_ACQUISITION_TIMEOUT、BROWSER_EXTENSION_CHANNEL_UNAVAILABLE、BACKPRESSURE首项失败仍尝试其后全部合格项；失败项下轮续查；raw Error、Store settle失败及共享typed错误必须外抛，且Store故障不能被归类Browser。未SENT兄弟不挡其余清理；fake release不settle。保留原R6/T10、N/Outbox/admission所有反例。
该六码集合仅为当前release边界的局部失败隔离，不是第二Browser错误registry或业务恢复资格；Browser扩展新的真实release错误时回本唯一方案核分类，unknown默认外抛。既有BROWSER_ fixture改为真实公开Browser错误构造，不能为让旧fixture通过而保留字符串兼容分支。

### D1：默认终端显示每个独立失败，不增加日志真相

Owner：AGENT runtime-log-spine。片区：src/lib/runtime-logs/sinks.ts 的 projectionIdentity/失败key构造及原runtime-log-spine-v2.acceptance.ts投影断言；对应日志Blueprint §5。
删除无typedIdentity失败terminal只按traceId合并的身份片区→ABSENT；仅对BLOCKING failed span.terminal用已经存在的spanId辨认独立原子调用，同key仍驻留当前进程4096项投影窗口时重复同一原span/event去重；驱逐或进程重启后可重显，不承诺无限去重。spanId只证明独立原子失败调用的显示身份，不能据此裁决底层根因数量；诊断下钻仍按现役Owner/code/operation/authority/evidence归并。error事件与其它impact仍复用现役身份/根因去重，不把每次heartbeat重复错误按eventId强行变成新根。普通成功/event保持当前低噪声key与4096项上限/驱逐；TRACE、visibility、causedByEventId及CONSEQUENTIAL/CLEANUP不变。不增加terminal字段、关联缓存、计数持久化或新schema。
验收：同job不同attempt/command的两个真实started→failed terminal即使同code都显示；同key仍驻留时同失败event重传只显一次，超过4096项驱逐后重交可再次显示，不增加持久去重，TRACE全显；成功heartbeat/空claim同状态不刷屏；含既有上游cause的TRACE consequential继续隐藏且不伪根；raw JSONL事件数/hash链完整不变，redaction反例仍拒。真实事件引用可由原inspect只读下钻，不靠用户先猜jobId。
结构：shouldProjectRuntimeEvent现复杂度16，失败身份判定留现有projectionIdentity或替换原key计算，不向主判定加新控制分支；不用复制既有stateProjection/errorProjection。

### E1/E2/E3/E4/E5：根因证据工单，当前不改故障行为

| 工单/唯一Owner | 精确源头及必须取得的事实 | 完成或阻断readback |
|---|---|---|
| E1 Browser取得Target | extension-created-target.waitForCreatedTarget/consumeTabUpdateAfterBarrier、BrowserTargetAcquirer.awaitTargetOperation；同authority epoch/jobRefHash/request sequence的创建、navigation、attach与status complete通知和到达超时的原生事实 | 分开“创建未完成、导航加载未完成、通知没到/消费错过、attach/permit失效”；只读现场无法恢复历史则标不可补取，不推断。新的同类实例取得真实事实后才写精确替代工单 |
| E2 Browser交互就绪 | extension-interaction-readiness.ensureInteractionReady/captureTabActivation；失败当刻readTab与同window onActivated世代、exact Target/Document/loader事实 | 区分真实用户切走/加载/销毁与事件缓存不等；真实不就绪继续原拒绝，只有已证自身竞态才设计同Owner重构，不能以隔离反例当生产根因 |
| E3 Browser park | extension-target-authority及extension-command-runtime的park、原Actor DIAGNOSTIC→finally REPLY、Node AwaitingReply；同command/sequence是否进入handler、preflight、退出、send以及认证接收 | 未执行/执行中/已发回复丢失各保留真实unknown；不增ACK终态、不提前释放lane。无原Extension事件则历史原因不可补取，现有park deadline/保护不改 |
| E4 Website原HTTP异常 | 网站 ai-acceptance 原 artifact/result上传API及原Runtime Log服务端事件；请求identity/boundary、HTTP状态、allowlisted原生异常/数据库SQLSTATE；同时核同attempt恢复的原artifact/envelope/terminal/admission | Website Owner给精确首拒位置才设计网站修复；本聊天只保留已恢复交付事实。原stdout是FIFO不得抢读，旧PG日志不能当事故证据，不能扩大DB权限或造日志表 |
| E5 Runtime健康误归因 | runtime-loops.readHealth、runtime-state.lastErrorCode全写者、现役WorkerSession公开合同与operations-snapshot consumer | 必须核唯一当前Cloud事实生产者/消费者，不能用general lastError反推云状态。没有现役typed当前事实则是合同GAP；新接口/字段必须单独存在证明与精确授权，本稿不先建健康状态机 |

E工单只取既有原始事件/权威读回及已获授权的当前只读现场，不启动新Provider输入、不重启、不打开/激活生产Tab、不改服务端日志配置。历史证据无法补取是明确终态；不能无限等待或为了“100%”补造。若要为新实例增加控制诊断，先在本唯一文件设计精确payload/枚举/strict接收/隐私/Owner/固定build原子切换与回退，再获规范授权；当前没有这项待施工代码或预留字段。

### B0：旧八字单的边界与删除回接核验

Owner：Website ai-acceptance物理删除，AGENT Runtime只消费exact absence。本聊天不写网站/不删单/不派新单。
读取旧job身份/control/terminal/admission分清“取消请求”与“已物理缺席”；只有网站权威absence才按现役runtime-business-admission.purgeDeletedJob及Browser website-admin-deletion链执行既有清算。cancel_requested或genericGET500均不得充当absence。
验收由原Owner核每个对象精确缺席、其他job原样、无猜删历史Tab；没缺席保持原事实，不能将本稿完成等同旧单删除成功。旧attempt无first fact不得伪造以通过shutdown；用户删除后按原主链读回的事实才能移除此异常分母。

## 8. 删除反事实与结构预算

| 单元 / 唯一Owner /真实consumer | 删除会发生的当前失败 | 最短裁决/退休验收 |
|---|---|---|
| 原Runtime heartbeat / executeAndUpload | 未stage运行失去合法lease；terminal与renew在途未收束继续16次409分支 | 保留唯一Owner，删除旧整Promise寿命；一次调用期stop通知及inflight join由原结果callback直接消费，原20秒timer/临时listener随该调用真实收束。可删独立manager/新timer/持久phase，故不建 |
| 原Browser FIFO/Acquirer计时器 / release consumer | 页面动作并发或release没有真实回执界限 | 保留原队列/唯一wakeTimer和原Acquirer dispatch timer；删混用的remainingMs，queued30秒只管队列、出队quiet不扣dispatch30秒，不增加第二release通道 |
| 原Runtime pendingCleanup快照 /原worker | 无法合法收束已完成job现实资源；跨项失败会饥饿 | 保留原列表/标记及下轮；删前缀裁决，catch仅release；不建重试queue/rotation ledger |
| 原日志投影Map / stdout reader | 同独立失败消失或重复成功刷屏 | 复用有界Map、原span identity；删错误合并；新增correlator/存储/schema均可删，故不建 |
| 原stage/Outbox、Browser WAL、Forensics、source seal /各公开typed消费者 | 已有效结果丢失、可能重复输入或网站无法合法授权 | 保留各正交事实唯一Owner/hash/CAS；不合并成总恢复表，不增legacy decoder |
| E类新诊断字段/服务/表 | 当前根因尚未证实，删除这些假设结构不破坏已知L1/C1/C2/D1 | 本稿全部删除，不预建；证据不够保持设计阻断 |
| 健康新状态缓存/取消裁决/容量释放API/空闲Tab池 | 删除仍可沿现役授权/Outbox/Website absence完成合法分支 | 不建设；N是Website容量，不等于必须时刻开3个Tab |

原生预算：文件≤500物理行，函数≤75行/7参数/8返回/5嵌套/复杂度16/await10，imports≤28声明/24来源、exports≤24；只使用现役code-purity检查，不造指标。
施工前设计基线：heartbeat154行（函数51/复杂度11）；claim-operations351行（executeAndUpload74/16）；runtime-loops384行（cleanup15/5）；Coordinator214行（release21/2、pump23/8）；sinks149行（projectionIdentity8/3、shouldProject18/16）。
L1与D1在代码前已安排同文件真实职责重构；不得先加到红线后靠新wrapper/文件改名补刀。C2必要局部错误判定由原Runtime消费公开typed口，不能依赖Browser私有WAL或Forensics正文。

## 9. 施工、cutover、停止与质量等级

1. 依§10划定已闭合的L1/C1/C2/D1与仍阻断的E1–E5；重新核源头权限/candidate。前四项可独立施工，E类继续只读取证。主Codex负责写，子智能体仅审计。
2. 精确Blueprint对齐并主审两遍无finding后，按L1、C1、C2、D1各自delete→ABSENT→重构→正反验收。E未完成不得顺手改页面等待/guard/park/网站API。
3. 本稿已确定工单不改变Website45/18、protocol10或日志V3形状；只有AGENT单仓发布，无双版本decoder/数据库迁移。代码切换前原Runtime停止新claim、原已发送claim与在途任务真实收尾、结果先送/admission读回；原handler/native退出，真实未决仍原WAL，不要求历史DISPATCHED=0，不把停止超时当drained。
4. 在无真实执行端兼容桥前提下，用原部署入口切换一个固定AGENT build及其需要同步的扩展artifact；不接旧build执行权，不自动导航操作者页。切换失败停止新claim，回退同一已核整套build；不回退已提交stage/WAL/receipt、不伪造旧fence，不重发Provider；Website当前grant重新读回后才沿原worker。
5. 建设后主审至少两遍、子审只比建设代码与本方案/现役法案/Skill差异；不得用方案子审代替代码子审。原生 npm run quality:check -- CHANGE、形成获授权的clean候选后 npm run quality:check -- READY，严格通过冻结 /Users/nexgen/.codex/skills/ci-full-governance/SKILL.md执行；设计阶段不运行READY，当前施工已获授权，不将子审签字当第二verdict。
6. 当前用户已调用冻结CI-FULL，按原CHANGE→READY→RELEASE连续链核资格；缺少全部active law真实Dynamic输入时如实阻断RELEASE，不伪造证据或重新询问正常阶段授权。真实验证必须抵达Website admission；原14产品/九ZIP及N=1..4既有分母保持。针对本次改动增验terminal之后renew=0、真实quiet后的release完整预算、A局部清理失败B/C不饥饿、独立失败默认可见；生产source/完整结果未知仍原风险授权流程，不能用synthetic/native Exam替Dynamic Proof。
7. 跨仓根因如需网站改动只能由Website Owner在本方案分别给出精确工单/自身原生quality。未提供部署/权限/切换事实即停止该跨仓cutover，不建立跨仓总PASS。

## 10. 当前准入门与审计

G1已在主审闭合：C2只隔离原release边界的六个公开typed码，Store/sink/provenance/unknown外抛；原字符串fixture不得成为兼容要求。
阻断G2：F1/F2/park及上传500底层历史事实缺失，E1–E4未输出可证明根因；只允许原恢复，不允许猜修。E5当前Cloud事实合同未闭合。
G3施工准入：2026-10-11 用户已明确授权按本方案在 main 修改法案、施工图、代码和质检。主Codex读回双仓对口权威，先更新三份AGENT Blueprint并主审两遍，L1/C1/C2/D1 权限与规范对齐已闭合；E1–E5 不借此取得猜修资格。
这些门不阻塞原系统继续运行合法任务，也不能被“98%/100%自评分”、旧READY或子审无finding绕过。
主审三轮完成，均针对本稿与当前实现，不使用百分比打分：
- 第一轮 authority/源码对照：补齐六个局部release码及共享/unknown外抛，删掉未在源头找到的猜测错误名；复核Website terminal清lease是正确行为，不能改其CAS。
- 第二轮反向时序/取消攻击：明确stop通知不等待整个executor，renew结果先结算后收束callback；补queued/quiet后abort、inflight renew拒绝、stage-vs-seal及真实native未结束不可假drain。
- 第三轮前轮回归/结构/验收：保留R6/T10和原九ZIP/14产品分母；补真实typed Browser fixture与旧heartbeat调用shape的接续验收；失败投影仅用BLOCKING terminal原spanId，不把error的eventId当新根；修正文档尾空行与candidate清单。
独立子审首轮提出三项文档finding，主Codex已据真实源码修正：L1补原20秒timer/临时监听器收束；C1保留queued30秒有限出口并限定active期间唯一wake只清queued项；D1限定4096项驻留窗口去重，原span不裁决根因数。两名子审已实际读回复核并放行文档，未解决文档finding为0；一名对照法案/施工图/实际代码，一名对照完整双遍Skill/实际代码。两人独立见证delete后的ABSENT及同路径新稿，主Codex再次核修正片区的权威、时序和前轮反例。设计子审结论不解除G2；G3施工准入已按本节用户授权及Blueprint双审闭合，不替代代码子审或原生quality。

建设审查（2026-10-11）：主Codex先完成三份Blueprint与法案对照两遍，再按各片区delete→ABSENT→重构；实际建设完成后进行两轮主审。L1专审、Browser/日志专审及全建设闭环审查该轮均只读放行；随后原生READY识别L1拒绝旁路吞错，按本节L1限定删除重构并重新子审及原生质量验证，先前审签与质量结果不能覆盖新候选。子审补出的queued abort验收已在真实Coordinator中完成：取消仍queued的首项后监听清零，唯一wake重算，active/hash/dispatch保持；原FIFO验收退出码0。局部Runtime、恢复合同、Browser FIFO、日志验收及typecheck已通过，不代替原生CHANGE/READY或生产证明。代码没有新增Owner、公开合同、持久结构、兼容桥或第二质量入口。当前尚未操作生产进程、Website或旧工单；原生质量结果以当前clean commit及唯一报告为准，不写入第二裁决。

## 11. Scoped candidate与重绑定

以下为方案设计交付时的scoped源头记录，不能充当当前建设或READY候选；当前建设只以原生clean Git commit绑定。realpath与分支已核；source candidate不含本方案文件。算法：将下列各仓路径UTF-8字典序排序，连接每个“path + NUL + 文件内容sha256十六进制 + LF”，再SHA256。不含无关overlay，不创建candidate台账。
AGENT：main，HEAD/upstream refs/remotes/origin/main均6680447d9debbd9b4d3addc674bbe9e8b65682d3；55文件hash c38c23c4515603dc56c4a51eb5bc871c68cf57ff1f5378f85f18bb4a3a38cad2，写前clean。
Website：main，HEAD 9aa608a1b5bb7d24f0f87f1b750119e37f72664b；upstream refs/remotes/origin/main=e1720b35e701f3e3e9a5fa071f32ad4c2b57e32f；16文件hash 0433cdc58f24cee7a08b0e1e1eeac56026b06c1a23423caf82f2335ca4e17058。无相关source overlay；无关“固定文案本地化闭环修复-完整实现方案.md”“八字排盘零事故封口-完整实现方案.md”改动原样保留。Website此前c5dd439基线已漂移，本稿按新HEAD重核相关法案/合同/terminal/claim事实，不借旧candidate施工。
闭环Skill完整正文与冻结索引不进入生产source candidate，只作本轮设计要求；本方案doc hash在最终交付另报，不递归写入自己。写前/主审后/子审后重算，相关bytes漂移只重核受影响工单；主仓他人overlay不覆盖/移走/提交，未分清时停止其片区。执行者在新的clean commit与原生quality结果上重新绑定，不拿本hash代替READY candidate。

AGENT scoped路径（相对上面的唯一根）：
```text
AGENTS.md
.agents/skills/agent-flow-boundary-gatekeeper/SKILL.md
.github/instructions/agent-rules/基础法案.md
.github/instructions/agent-rules/功能法案.md
docs/governance/法案系统建设说明书-冻结定稿版.md
docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md
docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md
docs/blueprints/runtime-log-spine/RUNTIME-LOG-SPINE-V2-BLUEPRINT.md
docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json
docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json
docs/specs/runtime-log-spine/runtime-log-event-v2.spec.json
scripts/audit/generated/law-registry.generated.json
scripts/audit/domains/agent-production-runtime/manifest.json
scripts/audit/domains/local-browser-session/manifest.json
scripts/audit/domains/runtime-log-spine/manifest.json
scripts/audit/domains/agent-production-runtime/worker-loop-inspection.ts
scripts/audit/domains/agent-production-runtime/authority-inspection.ts
scripts/audit/domains/local-browser-session/target-claim-inspection.ts
scripts/audit/domains/runtime-log-spine/inspector.ts
scripts/audit/domains/code-purity/components/structural-metrics.ts
package.json
src/lib/local-runtime/production/runtime-execution-heartbeat.ts
src/lib/local-runtime/production/runtime-claim-operations.ts
src/lib/local-runtime/production/runtime-loops.ts
src/lib/local-runtime/production/runtime-business-admission.ts
src/lib/local-runtime/production/runtime-startup.ts
src/lib/local-runtime/production/runtime-state.ts
src/lib/local-runtime/production/worker-session.ts
src/lib/local-runtime/production/transport-failure.ts
src/lib/local-runtime/production/executor.ts
src/lib/browser/browser-authority-api.ts
src/lib/browser/browser-failure.ts
src/lib/browser/infrastructure/browser-lane-coordinator.ts
src/lib/browser/infrastructure/browser-target-acquirer.ts
src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts
src/lib/browser/exact-target/browser-command-postcondition.ts
src/lib/browser/chrome-extension/extension-created-target.ts
src/lib/browser/chrome-extension/extension-interaction-readiness.ts
src/lib/browser/chrome-extension/extension-target-authority.ts
src/lib/browser/chrome-extension/extension-command-runtime.ts
src/lib/browser/transport/browser-authority-diagnostic.ts
src/lib/browser/protocol/browser-protocol.schema.json
src/lib/runtime-logs/sinks.ts
src/lib/runtime-logs/runtime-event-contract.ts
scripts/acceptance/agent-production-runtime-lease-renew-retry-support.ts
scripts/acceptance/agent-production-runtime-recovery-contract.acceptance-support.ts
scripts/acceptance/agent-production-runtime-business-admission.acceptance-support.ts
scripts/acceptance/browser-lane-fifo.acceptance.ts
scripts/acceptance/browser-lane-fifo-support.ts
scripts/acceptance/runtime-log-spine-v2.acceptance.ts
src/lib/browser/protocol/browser-errors.json
src/lib/browser/chrome-extension/extension-target-release.ts
src/lib/browser/chrome-extension/websocket-actor.ts
src/lib/browser/infrastructure/browser-runtime-log-emitter.ts
src/lib/runtime-logs/runtime-identity-contract.ts
```

Website scoped路径（相对上面的唯一根，只读）：
```text
AGENTS.md
.github/instructions/agent-rules/基础法案.md
.github/instructions/agent-rules/功能法案.md
docs/governance/法案系统建设说明书-冻结定稿版.md
docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md
docs/specs/ai-acceptance/xuanxue-ai-production-v6.contract.spec.json
docs/specs/ai-acceptance/website-agent-task-result.provider.spec.json
packages/ai-contracts/src/production-control/xuanxue-ai-production-v6.manifest.json
services/api/src/ai-production/job-terminal-repository.ts
services/api/src/ai-production/job-lifecycle-core.ts
services/api/src/ai-production/job-claim-repository.ts
services/api/src/ai-production/job-claim-selection.ts
services/api/src/ai-production/job-device-status-repository.ts
package.json
services/api/src/ai-production/website-agent-task-repository.ts
packages/ai-contracts/src/agent-task/website-agent-route-policy.ts
```
