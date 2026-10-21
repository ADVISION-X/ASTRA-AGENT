# GPT 页面按就绪放行与取得目标最长等待完整实现方案

状态：可施工（用户已授权施工；当前代码建设及验收进行中）。日期：2026-10-21（Asia/Dubai）。需求 Owner：AGENT / local-browser-session。
沿用本文件作为唯一方案，替换已落地的前轮施工正文，保留其仍适用不变量；不新增竞争方案。

## 1. 本轮目标、授权与终点

用户原始要求：“这个位置我的想法是不设置时间门槛，但是设置一个最长比如120秒的的硬兜底……具体你激活闭环SKILL去论证。”设计裁决：取得 GPT 页面按当前真实就绪事实立即放行，不设置必须等待十五秒、二十秒或一百二十秒的最低时长；为一次已出队并准备发出的 Target acquisition 设置最多 120,000ms 的上限。120 秒是有界容错政策，现有十五秒以上目测和三次二十秒失败支持移除过短耦合，但不足以声称 120 秒是实测 P99 或保证所有页面成功。

本轮用户已明确授权按本方案在main建设并执行CI-FULL，目标等级为AGENT READY：本方案、Browser Blueprint、登记的Browser生产片区与原质检消费者可施工；CHANGE通过后提交/首推、完整READY及第二推。Website仅只读核源，本案不改产品、数据库、运行服务或Chrome，不删单、不重启、不执行Provider输入；RELEASE另行授权。

需求直接终点：同一授权 job 的当前 system Target 以现役完整加载/物理身份/current Document 证明取得合法 Browser lease，原 GPT Child 可以继续；未就绪不得输入 Prompt 或提交。业务终点仍为 Product 结果→Runtime durable stage/原 Outbox→Website 领域幂等入库/admission→Runtime completed。页面取得、普通测试、READY 和业务完成分别报告。

## 2. 已证事实、首个断裂与前轮连续性

证据：附件 `/Users/nexgen/.codex/attachments/9192314f-59cc-4be0-b7fa-e9abec007eae/已粘贴的文本.txt`；原日志 `.grasseye-local/runtime-logs/agent/30da4ba1-0743-4f85-9578-3bdc12e793a0-0001.jsonl`，本案固定取证窗口 2026-10-21T17:26:18Z—17:30:39Z。静态事实来自下列现役源码，不把目测加载时间写成测量结论。

| 事实/对象 | 精确位置与结论 |
| --- | --- |
| job `aiprod_39bdd2ba-88ae-4a25-baba-4e5386c6ab42` | fresh-chat 三次分别 20,253.84 / 20,628.81 / 20,201.86ms，均 BROWSER_TARGET_ACQUISITION_TIMEOUT；不是菜单 DOM 缺席错误 |
| 兄弟 job `aiprod_25902401-1b2a-46a4-920b-ddbdcc77dbf9` | 同三轮在前一超时后立即报 BROWSER_BACKPRESSURE；后来 17:29:32.623Z—17:29:39.038Z 约 6.415 秒成功开页，17:30:38.581Z submit Child 成功。后两项不证明业务最终入库 |
| 第一个直接断裂 | `runtime-state.ts#leaseBudget` 给普通 command_ttl_ms≤20,000；`production-browser-lifecycle.ts#acquireBrowserLease` 暴露 commandTtlMs；`browser-target-acquirer.ts#ensureAvailableTarget` 将加载取得 Target 的预算也取该 commandTtlMs。页面生命周期被普通命令期限提前截断 |
| 第二个直接限制 | 同文件 `awaitTargetOperation` 又用普通 BROWSER_COMMAND_DEFAULT_DEADLINE_MS=30,000 截断；`browser-authority-websocket.ts#sendControlFrame` 对所有控制帧统一限制未来 30 秒。只把第一处改成 120 秒不能成立 |
| 已有等待与清理 | `extension-created-target.ts#waitForCreatedTarget/consumeTabUpdateAfterBarrier` 已按 tabs.onUpdated 唤醒并 fresh readTab，status 非 complete 就等待；超时由原 timer 唤醒，创建失败进入精确孤儿清理。不是缺少另一套等待引擎 |
| 截止点接缝 | 原pending没有deadlineAt，Supervisor#onTargetClaim只核pending存在/job后先注册，resolvePending只清timer；定时回调未调度时不能证明严格D。扩展claim经sendTail/加密后又给新30秒frame，原发送前assert不能覆盖异步延迟。要实现§4硬边界，必须在原pending与原认领收发链承接同D |
| 已发取得操作的撤权缺口 | Coordinator出队停止queued abort监控，active Acquirer不监听signal；Runtime控制意图仅abort本地signal，扩展guard只核session/READY/D。加载后可继续尚未发出的导航，Node最后才拒绝lease。直接拉长窗口会放大该缺口，必须纳入W1C，而不是声称Provider submit为零就已覆盖全部动作 |
| 认领失败的活动绑定接缝 | Authority#claimActiveTarget先置activeTarget再await发送；acquisition catch仅为新建候选discard。复用bound Target时，新增异步发送guard若因截止/取消拒绝，会留下未成功认领的activeTarget，后续acquire与普通release均可被拒。须精确退休本次绑定，保留bound registry/Tab，不能仅验证零输入 |
| 不能归因的部分 | 现有日志没有当次关页前 Chrome status、每段真实耗时，不能断言页面加载慢是唯一首因；不能据此改 selector、认定机器负载或扩展冲突。永久不返回的 native 仍未获通用安全取消证明 |

回归信号命中反复超时及同片区近期重构，采用深度、有限实现图。commit `2a8e08d47` 已有队列到期/释放预算分相；`9421b4154` 已有真实 Target handler 背压、请求序号关联与自身暂停退休，当前代码仍在。前轮 A1/A2/R1/S1 的对应实现是保留对象，不重新作为待建缺陷，也不引用旧子审/READY 为本轮放行。新 GAP 是加载取得 Target 的期限来源；先前“首个 Chrome 原因未知”的边界继续成立。

## 3. 权威、影响范围与停止边界

权威：本仓冻结说明书 §4、§22、§24—25、§35—38、§41—44、§46—47；基础法案 LAW-CODE-PURITY-001-V6 / 002-V2 / 003-V3；功能法案 LAW-LOCAL-BROWSER-SESSION-001-V4 / 003-V46 / 004-V57 / 005-V6 / 006-V46，及 LAW-GPT-002-V32、LAW-AGENT-PRODUCTION-RUNTIME-001-V76 的当前权限/恢复边界。原 Owner Manifest、Browser V56 Blueprint 和协议 revision12 为现役来源。

本轮不需要降低 active law、改变 Owner 或修改冻结说明书。Browser Blueprint 第17行原文为“不扩大native期限”，不等于active law把acquisition固定为20秒；未来代码前须补明本案acquisition独立上限、原在途native不得假取消，以及第92行真实handler背压对精确撤回通知的唯一窄分流；release、普通 mutation、1.5秒访问节拍、2.5秒动作读回、40秒静默、70—90秒 Provider observation 保持。法案没有要求所有取得 Target 都只能20秒；不能反过来放大全部普通命令 deadline 来迁就加载。

影响范围交叉来源：①现役 BrowserTargetLeaseWait 封闭 union 与 Coordinator 注册穷尽四种 acquisition 模式；②从公开 acquireJobBoundTargetLease→GPT lifecycle→Runtime lease getter 反查真实调用；③从 protocol schema/generator→加密 transport→Actor→Authority→Chrome event→claim admission 正反查全部期限；④现有事故 span 和原生 inspector/Exam 反查保护对象。四来源无未解释旁路，所有生产 acquisition 均通过同一 Acquirer/Actor；直接 Authority 调用仅为现役验收夹具，不增加生产入口。

| 对象/消费者 | 决定、理由与验收映射 |
| --- | --- |
| fresh | 首次建页、已有本 job Target 的 fresh 复位均用同一 acquisition 上限；同一个绝对截止点，不因导航重新计时；F1/F2/F3 |
| bound-observation | 当前本 job live Target 的激活与核验同上；缺席仍原 typed failure，不抢操作者页；F1/F4 |
| confirmed-readback | 当前授权下取得当前 Target；原 Provider 观察资格/locator/effect 不变；正常同 URL 零导航，缺 Target 按原链创建；F1/F4/F6 |
| authorized-continuation | 精确父 job/本地 completed attempt/product step 的唯一 WAL locator、当前 job 独占新 Target、一条精确导航均保留；F1/F4/F6 |
| Runtime/GPT 普通命令与 Website | `remainingMs()` 继续承载当前可用执行预算；commandTtlMs/command_ttl_ms 只保留普通命令消费者。本案不改字段、跨仓版本、业务结果、failure code、attempt、N 或恢复裁决；F5/F6/F8 |
| 其它页面导航 | 已取得 Target 后的普通 typed `selectExactGptConversation`、frame-navigation publication、Target claim ACK 仍原命令/认证期限；它们不是正在创建页面的加载等待，非本案扩时对象；F5 |
| 物理通道与结果交付 | 当前 acquisition 等待仍占唯一 lane/真实 handler；Runtime 续租/heartbeat/结果 Outbox 是原独立异步链，不改其 Owner/契约。结果签收存储无变化，跨 Owner 输出仍原 Browser lease 或原 typed failure；F6/F8 |

按上述身份、返回类型、原错误码和副作用不变的 handoff，在 Website 业务消费边界停止施工扩展；未来实际业务 readback 仍须取得。不能以“网站不改”省略续租、失败回接和最终 admission 验收。九类产品、翻译与其它合法 Product 间接消费同一 facade，不逐产品复制加载政策或更改专业 Skill。

## 4. 唯一目标链与期限语义

唯一主链：当前 Website grant→Runtime durable accept→Product/GPT 原调用→唯一 Coordinator FIFO/原静默门→Browser Acquirer 签本次 acquisition 的截止点→原 AEAD TARGET_ACQUIRE→原 Extension 事件等待 complete/身份核验→原 TARGET_CLAIM admission/lease→原 Child。关闭上限仅终止调用等待，不签业务完成或新 attempt。

1. **唯一数值源**：在现役 `browser-protocol.schema.json.commandAdmission` 增加 `targetAcquisitionMaxWaitMs:120000`，普通 `defaultDeadlineMs:30000` 不改；现役 generator 仅新增导出 `BROWSER_TARGET_ACQUISITION_MAX_WAIT_MS`。配置改变随同唯一 Browser revision12→13，一次切换、拒绝旧协议；不增加frame、数据库、环境变量或用户开关；原acquire/release body不改，仅第9项增加cancel-acquisition这一严格三字段控制分支，未来施工授权须明确包含该分支及原signal的active监听。
2. **起点**：仍 queued 的等待、Provider observation eligibility 与40秒提交静默遵守原预算；真正出队、静默完成、重核当前资格后，在原 Acquirer 即将 dispatch 时建立 D=`Date.now()+min(120000, waiter.remainingMs())`。`remainingMs()<1` 仍原 V6_DEADLINE_BUDGET_EXHAUSTED，零 dispatch。120秒不包含前述排队/静默，不是全 job SLA。
3. **解除错误耦合**：`ensureAvailableTarget` 不再读取 binding.commandTtlMs 决定 acquisition；`awaitTargetOperation` 按 action 选 acquisition 的120秒上限或 release的原30秒上限。普通 Browser COMMAND 仍 `min(普通30秒上限, permit.commandTtlMs)`，生产普通 TTL仍≤20秒；不修改 Runtime/GPT 的 TTL 提供者或公共 wait 合同。
4. **同一绝对截止点**：transport仅当 kind=TARGET_ACQUIRE 且已知原 body.action=acquire 时允许≤120秒未来 deadline；其它控制请求，包括同 frame kind 的 release，仍≤30秒。Actor 解密、严格序号/形状通过后按同一 action 上限重核，非法 deadline 沿原拒绝/认证失败路径，未调用 Chrome。Authority 接受原 D，内部缺省调用也引用同一 acquisition 常量。建页、complete事件、激活、attach、必要导航和 Node claim admission不重置 D、不各送120秒、不刷新为后续租约。原 PendingJobBoundTargetAcquisition 同次保存进程内deadlineAt；其原action判别联合中，acquire同时借用原signal并保存退订回调，release无此监听。Supervisor#onTargetClaim对初始claim在workspace/registry副作用前核pending.action=acquire、job匹配、原signal未abort且now<D，过期沿原失败关闭，不能只靠timer回调。
   acquisition的claimActiveTarget把原D通过原TargetFrameSender→Actor构造器callback→sendTargetFrame→sendEncrypted的可选内部调用上下文传递（仅原D与原assertCurrent回调）；仅该CLAIM路径在sendTail取得执行权及encrypt完成、真实socket.send之前重核原assertCurrent和D，该CLAIM frame.deadline取min(now+原30秒,D)。普通navigation-publication claim的参数缺席仍原30秒，TARGET_REVOKE/清理不携此参数，避免截止后阻塞清理。wire body/claim字段零新增，原session/key/sequence核验保留；没有新pending表或新认领回执。
   同一claimActiveTarget原第三个assertCurrent参数替换为上述可选上下文，原普通navigation调用仍缺席。活动绑定退休放在原acquireJobBoundChatGptTargetCycle失败出口：try前仅保存本次publishedTarget可空引用，在原登记/advance位置填入该引用，再调用原claimActiveTarget；仅bound分支且publishedTarget非空、this.activeTarget仍严格等于该引用时，无新增await地比较/调用原clearActiveTarget，随后原TARGET_REVOKE发送该不可变target的精确job/targetRef/documentRef，沿原默认期限，不带失效guard。禁止先await再泛读current的parkActiveTarget；对象已变化或为空不动其它绑定，bound的registry/物理Tab保持。!bound分支不提前clearActiveTarget，先沿原discard精确detach/removeExactCandidate；原discard出口须等待删除后的fresh readTab与readTargets，二者证明该tab及Chrome id缺席后才算物理收尾。当前原discard只有删除前身份与动作后barrier，不能当作缺席证明，故同一既有方法片区必须删除/缺席后重建：原cycle将本次publishedTarget不可变引用传入原discard；删除前捕获原registry，核其仍为本次publishedTarget且Chrome id匹配。若registry已替换而active仍严格等于本次publishedTarget，仅clear/revoke该旧active；替换的registry/active/物理页不动，原失败聚合。保留原精确revoke/detach/close顺序，收集全部失败；删除/读回不成功时只在原tab与job registry均空且无替换记录时恢复该原record，保留未知，绝不恢复active claim或重放输入。readTab须返回不存在（拒绝）且fresh readTargets成功并无原tab/Chrome id；readTargets失败或页面仍在均BROWSER_TARGET_CLEANUP_FAILED，不能靠异步事件或API成功冒充物理证明。还须覆盖registry登记后、claimActiveTarget首句guard即失败而activeTarget尚为空的边界：在同一cycle catch的discard成功返回后，读取原registry当前同job记录；为null则已退休，为本次publishedTarget同一对象则原targets.remove精确删除，若是其它对象则BROWSER_TARGET_CLEANUP_IDENTITY_MISMATCH，绝不删除替换记录。原active路径的releaseActiveTarget已删除时此步为空操作；没有新Target或第二清理器。这样不依赖异步onRemoved/Detach补删，新建registry确定缺席；实际Tab关闭证明仍由原discard承担，registry删除不冒充物理完成。该逻辑退休不证明native退出。清理成功重抛主失败，revoke/discard失败保留主失败并按原BROWSER_TARGET_CLEANUP_FAILED聚合，不吞错或伪造认领/释放成功。
5. **授权更短时取更短**：当前已签执行预算或既有 probe deadline不足120秒，只能使用其剩余预算。合法续租可以影响出队前的实时 remainingMs，但不能刷新已发请求D；120秒不是绕过当前 lease/fence、abort、session 或授权撤回的许可。当前active acquisition的撤回按下述第9项承接，不能只依赖serveAcquire返回后检查signal。
6. **就绪即继续**：直接复用 ExtensionCreatedTarget 的事件等待。complete不是成功的唯一条件；仍核 exact tab/Chrome target、未discard、必要attached、当前合法 frame/Document/URL与原activation guard。页面已complete且身份成立时立即走原链，保留必要1.5/2.5秒门，不 sleep120秒、不加最低加载时长、不加后台DOM轮询、不把DOMContentLoaded/出现输入框替代完整现役资格。具体控件就绪仍由原 Child 合同负责，不把它并成 acquisition 第三门。反查 `production-call-preparation.ts#acquireProductionBrowserCall` 证实取得Browser先于Child执行；prepare-clean的timeoutMs只由 `observation.ts#timeoutInput` 验输入、handler没有包住acquisition的第二timer，不需要放大其≤60秒输入上限。
7. **独立期限不误并**：TargetClaimAwaiter 的原30秒是页面已合格、进入 claim 发布时启动的认证ACK回路，不是建页加载门；普通已取得Target的导航/命令也不是 acquisition。原30秒timer、accept/fail与普通claim语义保留，不扩大到120秒，验收须证明慢加载阶段不会提前启动这30秒ACK计时。施工审查已证其begin在sendTail前计时，原sender在completion失败后仍可能发送；只在原begin→send callback补一个同步assertPending（核this.completion仍是本次completion），Actor仅对acquisition把它与原D/assertCurrent合入同一内部上下文，两个发送异步边界均核；ACK超时/失败后未发CLAIM增量为零。普通navigation-publication不携该上下文，原ACK期限不变；不新增completion表、取消控制帧或timer。Node原 onTargetClaim接纳时 resolve caller、扩展原ACK退休handler的先后保持，不引入第二完成回执。
8. **失败不假退出**：D 到期仍 BROWSER_TARGET_ACQUISITION_TIMEOUT，沿原精确清理/孤儿管理；session/身份/权限错误仍可在120秒前立即失败。caller退出不等真实 native、cleanup 或handler退出；真实在途未退时新请求仍只能原有限背压，不能删该保护或并行操作。晚诊断/释放回执继续按原job/sequence/session只处理自己。

9. **精确撤回同一次acquisition**：复用现役TARGET_ACQUIRE控制帧，协议13增加唯一action=cancel-acquisition，body严格仅action/jobRefHash/requestSequence；requestSequence指原acquire的服务器序号，safe integer≥1。不是新frame/transport、业务cancel或恢复授权。原Acquirer出队后的active阶段为原signal登记一次abort listener；queued abort仍只原队列Owner。发送前已abort则零acquire；已dispatch后abort只在原pending仍同一对象/authority/job/sequence且now<D时发一次cancel；now>=D不再发通知，交原到期出口。cancel控制帧deadline=min(D,now+普通30秒)，不能延长D。Node不以cancel发送成功解除pending/lane或宣称native停止；真实原handler退出后原DIAGNOSTIC仍引用原acquire序号，以BROWSER_WAIT_ABORTED拒绝原等待；永久native未退仍等原D有限退出并保留未知。原resolve/reject/timeout/撤连接负责清同一active listener。cancel发送失败走原transport失败/typed拒绝，不能吞错、重试或伪造退出。
   Node原dispatch返回requestSequence后的pending补值改为同一对象原位登记，不沿用`{...pending,requestSequence}`替换身份；否则listener的精确对象比较会失效。监听在同步dispatch/序号登记后、无新增await地注册，并立即复核signal.aborted以接住发送期间撤回；一旦撤回仅处理一次，后续终态按原stop回调退订。发送前的signal检查仍保留；release无此监听，零新增取消状态库。
   Extension把原pendingTargetHandlers从Set<Promise>原位替换为唯一Map<requestSequence, record>，record只含原promise、action/jobRefHash、捕获原双向session key引用和cancelled布尔；它仍是唯一真实handler集合，不新增registry/队列。先建立原请求state供guard捕获，再启动原handler Promise，随后用Object.assign给同一state附promise并登记Map；不能展开复制state，否则cancel置位与guard读的会是两份对象。Map登记仍在原handler启动后、无新增await的位置，保留release在加入自身前捕获旧handler快照的顺序。合法cancel在严格decrypt/sequence/shape后、普通背压判据前进入：仅原请求序号、同job、同双key、action=acquire匹配才置cancelled=true；不调用Authority，不增handler，不清槽/WAL，不解除暂停、不关闭兄弟Target、不产生新成功回执。合法迟到/跨job/新会话不匹配cancel只消费当前sequence，状态/输入增量为零，不能撤新请求；畸形/认证错沿原fail-close。release仍原排空，不能被cancel分支撤掉。
   原acquisition assertCurrent新增cancelled检查；它已在每次create/activate/Page.navigate等native前、等待后和claim前执行，并随上项内部上下文在异步claim发送前再核。取消被扩展接纳后，尚未dispatch的后续页面动作/claim增量为零；已发native无法撤销则保留真实结果，退出后仅原exact cleanup的只读身份核验/必要精确关页可继续，不重放输入。Node本地abort到扩展接收通知之间有传输窗口，不能承诺跨进程零延迟取消；Node从abort起不授新lease/Provider输入，未送达时仍受原D/session保护并如实保留未知。原pending.D/signal在claim接收端独立核验，不因通知丢失接纳已撤回请求。
   BROWSER_WAIT_ABORTED复用Coordinator现役code；原extensionRuntimeDiagnostic/browserCommandErrorCode→parseBrowserAuthorityDiagnostic→Acquirer.rejectPending→browserExecutionFailure已分别允许BROWSER_*形状并保留原code、job和原请求序号。此处DIAGNOSTIC不经过COMMAND错误枚举，不为该链新增browser-errors.json条目或错误别名；F6用真实编解码及原拒绝入口证实接回，聚合cleanup失败另保留原因链。

不新增 timer：Node/Extension 各端现有同请求等待 timer 只消费同一个D，是两端等待责任，不是两份120秒政策。原 ACK timer、orphan 有限重查、FIFO wake及heartbeat各自原职责保持，无新等待状态库、缓存、调度器或生命周期器。

## 5. 连坐分析、收益和有限验收分母

预期收益：原20/30秒错误加载截断消失；加载与其必要准备在当前授权内于120秒内完成时可继续；快页面不增加固定等待。已证实收益目前为零，未建设的新行为不能引用旧成功宣称已验证。

代价/边界：慢页面占用唯一物理lane的时长可能从20秒增加到120秒，兄弟调用会排队；本方案不承诺N=3时三页同时输入，也不保证120秒内一定加载好。永久native未返回仍为原Owner管理的未知，不能靠改上限保证自动恢复。120秒到期后的精确清理若仍在途，下一请求可短暂背压；这与历史handler退出后遗留暂停不同，后者已被前轮修复。延迟网络交付导致claim到达时D已过，仍沿原claim/认证失败关闭，不能保证任何超时都不撤当前authority；本案不建立迟到claim接纳或第二状态协议；只补既有控制通道同请求的撤回事实，不把该事实作为物理退出证明。若用户将目标改成加载期间兄弟零等待，需要先重开涉及真实物理并发的独立设计，不能暗添第二lane或页面池。

| 编号/真实分支 | Owner、输出/回接及可证伪验收 |
| --- | --- |
| F1 快页与慢页 | 原Acquirer/Actor/CreatedTarget：四种模式均验收；独立时间夹具令完整加载及必要身份/导航资格分别在6、25、45、119秒收敛，D前完成即取得原lease，零固定120秒睡眠。25秒击穿旧20秒，45秒击穿旧30秒；至少有一例生产binding.commandTtlMs=20秒而剩余授权>120秒。119秒仅到complete而尚需导航/2.5秒读回时不承诺成功，必须服从同D |
| F2 永不complete/边界 | 使用真实Node Acquirer→真实encrypted frame/Actor→CreatedTarget，mock Chrome叶端点和时钟，不mock被测方法；119,999ms仍无额外早失败，D及D之后不得新输入/成功claim，原超时/精确cleanup。延迟执行Node timeout回调、先交付同job合法claim时，Supervisor在registry/workspace前按pending.D拒收且不ACK成功；扩展sendTail等待及encrypt等待分别跨D时，真实CLAIM send为0，原cleanup可继续。本次已置入activeTarget的claim失败：bound页仅精确退休本次活动绑定，registry/Tab保留；新建页不提前clear，原discard及同catch的精确registry退休完成后确实缺席且物理清理有读回；覆盖刚登记registry、尚未置activeTarget时guard跨D/abort，以及记录已被替换不得误删；覆盖对象已变化不误退、主失败与revoke/discard失败聚合，并验证handler真实退出后下一合法job可取得目标。ACK timer先于120秒D到期而sender仍在sendTail/encrypt时，原completion guard拒绝发送，Node不得接纳；关页API假成功、关闭后readTargets/readTab失败均不伪造缺席并保留原资源registry。已发CLAIM迟交付过期仍原fail-close；native不返回另断言未知，不伪造物理完成 |
| F3 无效身份/早失败 | discarded、目标物理缺席、foreign origin/Document、当前会话/严格序号错误、超120秒/NaN/过期deadline：原code失败关闭，非加载原因不硬等120秒；零Provider submit、零操作者Tab触碰 |
| F4 不重置/不扩权 | continuation精确导航、bound fresh复位、confirmed缺页重建均共享同D；跳转不重新发120秒；同job最多一system Target，跨job zero reuse；当前locator/effect与parent身份分母不减 |
| F5 普通能力隔离 | 普通生产COMMAND仍20秒TTL/30秒协议上限，release queued30秒→静默40秒→dispatch30秒；普通导航/claim ACK保原期限。acquisition>30秒合法，但release/其它控制帧携>30秒拒绝；ACK计时在合格页面发claim后才起，不在开始加载时起 |
| F6 队列/授权/恢复 | 原queued到期/abort有限退出；active时queued不抢占，真实旧native未退仍单handler/单lane；remaining=50秒时总上限50秒，出队前续租可更新remaining、发出后续租不刷新D。控制意图与续租失败触发原signal后，Node不授新lease/Provider输入；原active listener只发一次精确cancel，扩展接收后下一create/activate/navigate/claim发送被原guard拒绝。覆盖撤回在loading、已发native未返回、sendTail等待、加密等待四处，断言无新物理输入；允许原读取/精确关页清理。bound/新建claim失败分别按F2退休/清理，不留未接纳活动占用；真实DIAGNOSTIC编解码及原拒绝入口完整接回BROWSER_WAIT_ABORTED/job/原序号。通知迟到/跨job/同序号新会话、传输失败与native不返回均不伪造退出，不清兄弟槽或WAL；resolve/reject/timeout/断连的active listener均退订。通知未达窗口如实说明，Website现役授权再检查接回，不新建retry |
| F7 前轮不变量 | 重用既有A1/A2/R1/S1验收：请求序号/原会话关联，成功/失败handler退休自身暂停，迟到absent零误删，合法失败fact正常WAL/ACK，Provider effect不重发，历史DISPATCHED不成为全局门，1.5/2.5/40/70—90秒门不减 |
| F8 业务/连坐动态实证 | 未来另获真实操作授权后，选一张确实加载超过旧上限但小于120秒的合法job及同窗口两个兄弟job；关联candidate/当前attempt/日志/授予与续租、真实页面事件、原失败或结果身份，最终查Website适用领域存储与admission、Runtime completed。N仍Website裁决。静态/合成Exam不能替代此项；无自然慢页时明确缺少慢页生产证明，不擅自改生产网络或虚称通过 |

每项均是现役Owner的成功、拒绝、失败、取消或受控未知；没有新增持久化分支。F8尚未执行，不把删除旧工单作为恢复验收，也不重放已有Provider输入。

## 6. 原子施工工单与严格顺序

共享纪律：未来授权后只在当前本地main施工。每个批准的退休方法片区须先物理删除→即时核验旧定义/旧引用缺席→按本方案合同同路径重建；不得把旧片区存到内存/临时文件后加工回写，禁止换名、转发、兼容壳或第二链。独立保留模块直接复用，不因同文件而整删。过程证据在当前任务实际工具记录取得，不新增台账。发现新消费者/漂移/未授权改动，先停受影响动作并回补唯一方案，不能边猜边建。

### W0：Browser Blueprint 先对齐

- 做什么/Owner/路径：local-browser-session，仅 `docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md` 的接入预算、handler接入/退出及单协议切换片区；第17行以§4的独立acquisition上限替换“不扩大native期限”的笼统限制，同时明确禁止假取消已发native、D不刷新及release/普通命令边界；第92行只为精确cancel通知增加无handler/无物理输入的控制分流；认领失败仅退休本次exact活动绑定、保留bound页/原registry，新建候选仍原精确discard。目标协议13，同请求cancel事实与物理退出分别证明。
- 保留/不做：法案全部保持，Blueprint其它Owner/拓扑/回执/WAL及Provider保护原样；不改GPT/Website Blueprint，不手写registry。前轮A1/A2/R1/S1仍由现役实现承担。
- 顺序/验收：代码前主Codex两遍审查本图对active law、当前用户目标及本方案；有具体冲突立即停止代码。无finding只表示设计对齐，不用98%评分代替闭合。
- 失败：未获对应Blueprint精确授权或与现役源头冲突时停本工单，保全原代码/数据；不以改法案迁就设计。

### W1：原Owner取得Target预算与单端防截断

- 做什么：local-browser-session，闭合一个不可拆交付的 acquisition 时间合同。仅以下片区：`src/lib/browser/protocol/browser-protocol.schema.json` 的revision/commandAdmission；原 `generate-browser-protocol.mjs` 的对应投影，生成 `generated/browser-protocol.generated.ts`；`infrastructure/browser-target-acquirer.ts#ensureAvailableTarget/#awaitTargetOperation`；`infrastructure/browser-infrastructure-state.ts#PendingJobBoundTargetAcquisition` 增加deadlineAt；`infrastructure/browser-infrastructure-supervisor.ts#onTargetClaim` 初始claim截止核验；`transport/browser-authority-websocket.ts#sendControlFrame`；`chrome-extension/websocket-actor.ts#acceptTargetAcquire` 的接入deadline核验及构造器callback/#sendTargetFrame/#sendEncrypted的CLAIM截止传递片区；`chrome-extension/extension-target-authority.ts#TargetFrameSender/#acquireJobBoundChatGptTarget/#acquireJobBoundChatGptTargetCycle/#claimActiveTarget` 的截止来源与传递片区。以上路径均以 `src/lib/browser/` 为根。
- 删除/重建：原Acquirer两个方法、transport统一30秒判据、Supervisor只靠pending存在的初始claim判据、Actor接入及claim异步发送判据、Authority缺省/claim截止与claim失败活动绑定出口、原discardJobOwnedTarget及TargetClaimAwaiter#begin片区，按共享纪律删除/缺席核验后重建§4。Authority#acquireJobBoundChatGptTargetCycle原失败出口以本次publishedTarget引用只退休bound exact活动绑定；!bound先沿原discard，不能提前clear；在同一catch补上登记后、活动绑定前guard失败的registry精确退休：discard成功后null无动作、同本次publishedTarget则remove、其它对象拒绝，原close读回保持。claimActiveTarget仅传递可选上下文，不承担泛化cleanup；不新增方法/通用生命周期层，保留普通navigation-publication职责，禁止无条件clear/park或伪造物理关闭。原pending类型增加一个同次deadlineAt、现有callback参数传递、schema/generator为必要局部修改，生成物只由原generator产生；不把整个文件的成熟独立职责冒称重建。
- 保留/不做：Node原pending的身份字段/requestSequence/原timer/resolve/reject职责复用，截止点及active signal监听退休按W1C承接；Actor原会话/背压/drain/暂停退休及Authority物理guard保留，原handler容器及取消判据按W1C原位改造，不新增Actor成员。`ExtensionCreatedTarget`、`DebuggerRuntime`、Coordinator/FIFO、Runtime/GPT lease getter及普通COMMAND send不修改。前两者已有事件等待/安全核验职责；TargetClaimAwaiter仅原begin的sender合同承接同次completion guard，ACK timer/accept/fail保持，Authority#discardJobOwnedTarget按§4补同步物理读回和原registry保全；这些均属原认领/清理输出不可分割的消费者。保留原事件等待与独立ACK职责，因为删除会失去真实加载与确认；不把它们复制为新等待器。
- 顺序/输出：W0完成后先唯一数值源/generator，再同候选原pending/Acquirer→wire→Actor→Authority→CLAIM发送→Supervisor admission，W1C的同请求撤回必须同候选接通；仍使用原frame deadline和原lease/failure输出。原数值/接口在同候选原位替换，禁止一端先运行或dual-read旧协议。
- 验收：F1—F6及F7，不仅测常量；逐项核普通TTL未变、所有acquisition模式和传输上限、deadline不重置、不越当前授权、原handler真实退出。未闭合不得部分发布。
- 失败：原typed错误/未知及cleanup接回，任何新生成/结构错误先停；没有自动回退授权，不恢复退休骨架、不抹WAL/旧结果。

### W1C：只撤回当前acquisition的尚未发出动作

- 当前GAP/Owner/输出：local-browser-session。修§2已证active abort脱节；权威输入为Runtime原signal与原acquire的job/sequence/双key，输出仅同请求禁止后续dispatch的事实及原handler真实失败，不决定attempt、业务取消或完成。
- 精确路径：`browser-target-acquirer.ts#TargetWaiter/#awaitTargetOperation/#resolvePending/#rejectPending`的原pending/active listener；`browser-infrastructure-state.ts#PendingJobBoundTargetAcquisition`的action判别分支；`browser-infrastructure-supervisor.ts#onTargetClaim`的signal拒收；`browser-authority-websocket.ts`新增唯一窄方法requestPreauthorizedTargetAcquisitionCancellation；`websocket-target-operation.ts#TargetOperation/#targetOperationFrom`增加严格cancel分支、同文件局部parseCancellation与机械cancelPendingTargetAcquisition及原handler record类型；`websocket-actor.ts#commandDelivery/#acceptTargetAcquire`、构造器原drain快照、`drainDisconnectedHandlers`及原claim sender上下文；前三个基础设施文件分别位于`src/lib/browser/infrastructure/`、transport文件位于`src/lib/browser/transport/`，后三者位于`src/lib/browser/chrome-extension/`。
- 保留/删除/重建：保留原Target集合单一性、真实Promise及session来源、物理guard/精确cleanup、诊断原序号和失败退休；删除Set-only容器形状与无法识别本次请求的active guard片区，缺席核验后在同路径构建单Map及原guard消费取消事实。所有原`.add`/Promise快照消费改成`.set(sequence,record)`/`Array.from(map.values(),r=>r.promise)`；原size/delete按sequence，不能await record或提前删Map。callback参数与signal类型是必要局部修改；不新增第二索引、flag服务、timer、持久化、Chrome listener、进程重载或公共Product API。
- 工序/接口：按§4.9落地；W1/W1C同方法共享片区合并为一次delete→缺席→一次重建，不能先建半套再打补丁。仅同request取消通知可以在pending非空时进控制分流；原acquire/release背压保持。原cancel字段闭集与单协议13先在原parser/generator来源对齐，Node signal listener、Extension guard/claim发送及本次失败活动绑定退休同候选完成。取消事实不能替代真实handler退出或bound物理关闭证明。
- 结构落点：Actor已有30成员，不加方法；精确Map匹配/置位是现役websocket-target-operation.ts新增的一项窄机械函数，供Actor调用，避免在原接入方法塞入多维匹配越过复杂度16；该文件名称已有operation职责、仅此真实消费者，无新file/controller。transport27→28成员可承载一个发送方法；Acquirer不增加类成员。handler record借用捕获双key引用，不以可变session对象地址作身份，原session发送时会重建对象。
- 验收/拒绝：F2/F6/F7全部覆盖；Node补序号不得换pending对象，撤回恰在同步dispatch内与登记后各一例均仅发送一次，终态退订；原auto-pairing-support的Delivery测试投影及三个原pending快照只同步Map的promise投影，不复制生产匹配规则，不新增import来源（原文件sources已24）。target-lifecycle夹具消费相同Map投影；时间与wire原件驱动取消，不能直接替被测guard返回失败。合法过期/不匹配cancel无新终态；伪造/unknown字段原fail-close；失败或未知不提供重放资格。未闭合即停止W1整候选交付。
- 不做/失败回接：不取消已经发出的Chrome native、不放开其它job并行、不把取消发送当drain/ACK，不给普通COMMAND通用取消。已撤回job沿Runtime原typed failure/Website原下一授权接回，原effect/结果/Outbox保持；无回退授权不得恢复旧容器/混协议。

### W2：原质检保护正确合同

- Owner/路径：local-browser-session。仅 `scripts/audit/domains/local-browser-session/target-claim-inspection.ts#inspectAdmission/#inspectAcquisitionWire/#inspectNavigation/#inspectPhysicalReleaseProof` 的旧cap/claim参数/handler容器断言；`scripts/acceptance/browser-lane-fifo-support.ts#runBrowserLaneTargetClaimAcceptance` 调用同文件新加入的独立预算反例函数；`scripts/acceptance/local-browser-target-lifecycle-support.ts#exerciseAuthenticatedTargetIsolation` 调用直接关联的 `local-browser-acquisition-wait-support.ts` 中真实Actor慢加载反例函数（原fixture文件已324行，完整时钟/加密/Chrome矩阵超过500行法定上限，因此拆为一个专用验收support；不新增runner或生产抽象；本域现役Manifest同步登记该唯一新增support的primary ownership）；`scripts/acceptance/local-browser-rule-mutants.acceptance.ts` 的直接反例；`local-browser-auto-pairing-support.ts#Delivery`及现有三个pending handler快照按W1C同步唯一Map的promise投影。原 `browser-lane-fifo.acceptance.ts:50` 的唯一直接Acquirer夹具仅补原AbortController.signal必需实参，不改成optional/fallback；同文件第150行和 `local-browser-auto-pairing.acceptance.ts:28` 已分别调用这两个export，入口runner保持复用，不添加新runner；原workerFixture与releaseWireFixture同样直接复用，后者仅暴露原Supervisor/Issuer并接回原onTargetClaim，不复制admission。Coordinator原waiter已含signal，是另一个且唯一生产直接消费者，不改其调度。
- 删除/修改：先删除强制所有Target操作使用普通30秒cap的断言；在同一inspector内重建对唯一常量、action分流、普通期限保持、原pending.D、claim截止内部参数流及Supervisor注册前核验的AST/contract证据；inspectNavigation原三参数claim调用断言随实际同D上下文传递替换，保留导航/身份/先后义务。inspectPhysicalReleaseProof原`.add(handler)`形状证据改成原release Promise被单Map记录、发送仍位于该被跟踪handler内部的等价证明，保留物理close/readback/revoke关联义务，不删除保护。既有顺序/身份/背压/退出断言保留；测试原位扩展F1—F7。原 `browser-mutation-settlement-inspection.ts` 的2.5秒读回和真实event等待保护保持，不为通过而删。
- 必要性/不做：现有反例只验证短deadline、释放分相和退出，无法区分“acquisition错误继续用20/30秒”“所有命令被放大120秒”“120秒固定睡眠”，所以增强原能力；不新增checker、法条、snapshot、mock生产路径或全Product样本。时间边界用原有受控时钟，禁止验收真的串行sleep120秒。
- 顺序/验收：W1对应片区与W2同一候选完成；真实Node transport/AEAD/Actor/Authority/CreatedTarget与Supervisor admission串联，仅mock Chrome/native和时间叶端点，不能只mockrequestPreauthorizedTargetAcquisition返回成功。119.999/120/超界值来自同一真实边界，四mode来自封闭union；F1—F7分别对照独立预期。mutants至少击穿旧TTL、所有控制帧扩时、固定sleep、导航刷新D、删除原handler保护、删Node认领D核验、仅异步发送前核D七种错误实现，以及漏发cancel、错误job/sequence/key取消当前请求、复制record使guard看不到置位、取消即删在途handler/清槽、发送异步边界漏取消核验、claim失败残留bound活动绑定或误退新绑定；补证仍在同一现役inspector/fixture，原单Map和真实drain分母不减。
- 失败：检查器旧假设与当前law冲突先核原义务，不修生产迁就错误检查；结构超限时在原fixture内合并等价断言/缩减重复，不加逃逸wrapper或豁免。

### W2A：完整 READY 暴露的现役测试消费者失配

- 输入/边界：绑定 `main@c56c8107ccd6ebef0dfc508994acb39f93726f9f` 的原生 READY FAIL、唯一逐法报告和 `/tmp/agent-acquisition-ready-20261021.log`。固定 J1/J2/J3 对以下五个具体对象均裁保留职责、违规成立、修；它们不是已证生产故障。主 Codex 按局部、根因明确、可直接充分验证定轻度；方案调查按标准闭合当前消费者与必要历史，不扩成产品或全仓重构。另一个 Browser Exam 组未完整收束的问题单独接证，不能用本单覆盖。
- Owner/发现/停止边界：`code-purity` 普通治理测试的 `tests/governance/quality-contract.test.ts` 三个精确片区，以及 `local-browser-session` 两个验收夹具与一个不可分割的类型接缝。通过原生失败/AST finding、函数反向引用和 package/quality 路由交叉核验；真实 provider validator 从 active laws 取得 map，正式 Browser inspector 已传双文件，COMMAND send 的身份仍正确。到这些现役生产消费者停止：本单不改校验行为、Owner、法条、Website、schema、WAL、超时政策或 quality 编排。
- 保留/删除/重建：①保留 provider 合成合法/畸形负例与真实 validator，删除当前正样本的手写旧 V47 map 片区，缺席后以现役 `buildRegistry().laws` 的 lawId/domain 唯一投影重建输入，不能从待验 spec 自证。②保留原 transport inspector、send、通用反例执行器及全部独立负例；删除三个有首命中歧义的 COMMAND sequence/递增反例行，缺席后在同数组以唯一 COMMAND 方法上下文重建，证明实际变异。③保留同用例 WAL/schema/startup 段、真实 exact/fixed 两模块和 inspector；删除旧单文件 atomic 测试段，缺席后按两份 SourceFile 验合法基线，并复用现有 `verifyBrowserBoundaryMutants` 与完整 `inspectDomMechanicalFacts` 在当前两文件职责位置施加真反例。必须覆盖 marker/邻接/唯一 assistant、完整语义与 DOM、同步同包、前后 loader pin、by-value、异常清理保主因、无 presentation/Prompt/composer 第三门与两类 pending；退休锚点和无消费的追加死声明不恢复，后者由原生 zombie 保护承接，两类 pending 的既有真实 DOM/decoder 验收继续保留。④删除 acquisition support 的双重断言，缺席后从真实 Actor 读取原 Authority 并以 `instanceof ExtensionTargetAuthority` 核实，原 wire/四模式矩阵原样。⑤删除 diagnostic `producedFailure` 的虚称完整类注入片区，缺席后按真实消费的 `resolve/executeRegisteredCommand` 构建有类型检查的故障输入；`extension-command-runtime.ts#executeExtensionCommandReply` 仅局部将参数类型表述为原类两方法的 `Pick`，必需方法及返回值仍严格检查，没有 optional、fallback、新接口或运行行为修改。四类失败、真实 AEAD/diagnostic/REPLY、WAL→ACK与日志失败保护保持。
- 顺序/验收：法案及施工图已要求现役权威、精确身份、原子读取和禁止类型逃逸，无需为本单改法；本方案补齐后由主 Codex 两遍审查对应义务与落点，再退出设计施工。按上项逐片区删除→立即读盘核缺席→从当前合同重建，保留独立职责不搬移。先定向运行三项治理用例及原 diagnostic/acquisition 验收、typecheck，再主审两遍及只读实际差异复核；随后新候选重新 CHANGE→提交首推→完整 READY→第二推。不得删断言/扩大 excludes、弱化 scanner/validator、把 fixed 参数 optional 化或恢复旧生产结构迁就测试。
- 结构/失败：三个测试片区复用已有文件及执行器，不增 runner/checker/依赖/持久化；两 support 保持文件与函数预算，类型 Pick 不新增生产抽象。原生其它失败仍独立保全、接回对应原庭；本单失败在同方案内继续，不抹原报告、不用旧候选 CHANGE 放行新候选，不自动回退。施工纪律与功能验证分别汇报。

### W2B：原生 Browser Exam 完整调用条件

- 输入/裁决：同一 `c56c8107` 的 CHANGE 已完整完成七文件组；READY 原捕获在300秒结束，三份golden receipt晚到，补充同命令/同300000ms工程观察 `/tmp/agent-terminal-call-observation-20261021.json` 为300023ms、status=null、SIGTERM。J1要求恢复调用匹配，J2/J3多数裁当前仅为调用条件问题、未证具体结构违规；三人均保留正确分母检查。J2提出未定位耗时不能单纯加时的反证，已由独立只读技术调查核实：rule-mutants约67秒AST、auto-pairing约226秒真实1.5/2.5秒门，加其它必要文件累计超过300秒；新增119/120秒矩阵使用受控时钟，无真实120秒sleep。主Codex据此保留原串行与全部用例，仅恢复这一个组的有限预算，不裁收集器/生产代码有错。
- 唯一Owner/路径/动作：code-purity，`scripts/audit/shared/quality-runner.ts#executeProofCommand` 的原 `timeoutMs` 计算局部修改：仅 `kind=exam && script=acceptance:local-browser-terminal` 为600000ms，其余Exam300000ms、Dynamic7200000ms保持。相同变量继续同时进入原 `executeCaptured.timeout` 与 `GOVERNANCE_PROOF_TIMEOUT_MS`，不增加环境变量、配置表、wrapper、runner或proof路径。600秒是本轮有界工程余量，不冒称P99，不要求生产页面等待600秒，也不改变本案acquisition120秒。
- 保留/删除/不做：保留原collector、串行七文件、所有真实安全门、失败传播、完整stdout/stderr、candidate/run/receipt绑定和五个required组合（002/golden、003/golden、004/golden、004/property、005/golden）。无删除或重建对象：这是已有调用配置的局部修正，不冒称片区重建；不改法案、Manifest、registry、测试分母或分母校验器，不拼接晚receipt，不改并发或子进程生命周期。
- 顺序/验收/失败：本方案及法案/施工图对应关系先经主Codex两遍核对，再局部修改；属于现役预算恢复，无新结构留删问题。主审及只读技术复核该一个变量的真实消费者，随后同候选CHANGE→提交首推→完整READY，须真实完整退出0并由原binder接收五组合，失败继续保全接回。本次触及quality调用主链，待当前候选产生可读READY原生报告后按母本§79及冻结CI-FULL另取全新独立只读身份十项核销，之后第二推；不得用前三法官或普通代码审查抵扣。该配置不增加CPU并发或工作量；运行只开一轮原生质量，实际观察内存与负载，不人为七分钟截断。无自动回退、无需生产业务/数据库/Browser操作。

### W3：实际建设审查、同候选切换与业务验收

- Owner/范围：主Codex负责当前main差异与原生质检；子智能体仅只读审查实际建设对本方案/法案/闭环Skill的差异，不并发写代码。无新代码、表、服务或治理对象。
- 顺序：主Codex代码两遍自检→重要接缝及最终实际建设子审明确放行→冻结 `$ci-full-governance` 的原生 CHANGE→获授权clean commit/首推→完整READY/再次推送。唯一质量入口 `npm run quality:check`；本轮已进入获授权施工；这些步骤必须分别取得原生证据。RELEASE另有明确要求才执行。
- 切换：复用现役browser build/release identity/startup同步机制；新Node与同build Extension唯一protocol13同时生效、旧12退出。先停新claim，已有结果/receipt交付继续，等真实handler/native退出才停旧worker；历史未知WAL保留，不以清零冒充drain。没有运行启停授权不做切换；native不返回则报告未知阻断，不强杀/重载/取消。
- 验收：先F1—F7与原生质量，再按另获真实取证授权完成F8。实际启用后读回build/protocol/Browser authority、相同job/attempt/结果hash与最终admission，不能以静态产物或两个Tab在动替代。每仓只自己的质量裁决，本案不修改Website也不运行其READY。
- 失败/汇报：不覆盖其它Codex已有dirty改动；不得reset/stash/分支制造clean候选。代码失败、原生quality失败、物理未知、缺动态证据分别报告。回退若另获授权只可整体同候选Node/Extension，WAL/原数据/既有结果保留，不混新旧协议。最终逐对象列真正重建、经论证保留、局部修改、删除退役、失败回退、尚未完成；功能质量不能代替删除→缺席→新建的过程证据。

## 7. 结构承载与删除反事实

原生红线：文件≤500行，函数≤75行/7参数/8返回/5嵌套/16复杂度/10await；imports≤28/sources≤24/exports≤24；类成员保持现役预算。当前AST：Acquirer95行/6sources/6成员，两个方法14/33行；transport297行/10sources/27成员，sendControlFrame14行；Actor401行/15sources/30成员，接入49行/6await/6returns，原生metrics圈复杂度12/嵌套1；Authority258行/21sources/28成员，入口7行。不得再给Actor加成员；只用一个按action分流的局部maximum值、一个上界if和一个cancel分流，匹配置位交原operation模块的窄机械函数；接入方法复杂度预算12→15，原全局接收已拒过期/非法时间，不在此重复判断。transport原复杂度7、Acquirer等待方法6，action分流仍有余量；import扩展原generated import，不新增source或拆分Owner。Supervisor408行、30成员，原onTargetClaim15行：用一个pending局部值合并原两处初始claim拒绝，再在原注册前核action/job/D，不新增成员；state仅30行，原pending补同次D及acquire分支的原signal/退订回调。claim截止与取消guard仅在现有方法增加可选调用上下文参数，构造器callback转交，Actor/Authority成员数不变；sendEncrypted在原队列和加密边界直接校验，不另建sender/guard类。 Authority原acquireJobBoundChatGptTargetCycle为23行/复杂度8/嵌套3；原失败出口增加本次publishedTarget引用及bound精确退休、!bound在原discard成功后核null/本次对象/替换对象并精确退休registry，预计复杂度≤12、嵌套≤4，不加成员；原discard保持精确清理链并补同步fresh物理缺席证明及替换对象保护，禁止提前泛清active或依赖异步事件补删。

现有fixture：lane-support378行/17sources，target-lifecycle324行/11sources，target-claim inspector295行；优先扩展各自既有entry与共享fixture，新增有区分力分支优先留在原文件；真实acquisition矩阵按W2用一个本域专用support承接以遵守500行和单函数预算，单函数按独立反例拆分≤75行，不复制一套actor。auto-pairing-support已有24sources，Delivery只用Map<number,{promise:Promise<void>}>测试所需最小投影，取消匹配逻辑只调用原生产parser/机械函数，不能复制为测试真相；原Promise快照改投影不增import来源。rule-mutants207行，内存反例复用原runner；共享 governance 仅按 W2A 修复三个已裁现役测试消费者，并按 W2B 局部恢复 Browser Exam 的有限调用预算；不改检查器职责、分母、串行编排或裁决。实施前重新测量，漂移影响可承载性即回本方案调整，不边堆边切。

| 单元 | 必须存在的当前原因、真实消费者、最短决定与退休对象 |
| --- | --- |
| 唯一acquisition上限/原generator投影 | 普通命令与加载耗时语义不同；Acquirer/transport/Actor/Authority真实消费。删掉独立上限会恢复20/30秒截断，或必须放大所有命令；选择在原schema增加一个字段/原投影，退休acquisition对普通TTL/cap的依赖 |
| 原事件等待/就绪identity/guard/清理 | 负责真实complete与exact当前目标；原Authority消费。删掉会对loading/串页动作、遗留本job物理资源；直接复用，零新等待层，不删后复制 |
| 原FIFO/pending/handler/session/seq/ACK | 分别承担当前物理串行、请求归属和可信确认；删掉重现积压/晚回执连坐。保留原职责；pending补同次D/原signal并退订active监听，handler原位单Map绑定当前取消事实；不用第二store。无D会迟到认领，无精确取消链会在撤回后继续未来导航。cancel只复用同通道/原请求，无handler已退出证明；120秒或cancel均不能清槽/假退出，A1/A2/R1安全不变量仍须验收 |
| 原命令20/30秒与Provider保护 | 原COMMAND/release/claim ACK及GPT真实消费者各自需要有界授权与节拍；不能用总扩时替代。保留，新增政策只用于acquire |
| 原inspector/fixture/mutants | 原质量入口消费当前law及反例；删掉失去期限隔离/串行保护，旧cap断言又保护错误耦合。原位替换该断言，保留全部有效保护，不新建第二checker/verdict |
| 新等待引擎、DOM轮询、最低加载时间、页面池、第二lane、自动强杀、第二恢复队列、UI参数、数据迁移 | 本案没有不可替代的消费者/必要性，全部从目标方案排除；当前不存在则不创建，不把排除写成已物理删除生产对象 |

## 8. 当前候选、审计与执行者重绑定

AGENT realpath=/Users/nexgen/Documents/AGENT；branch=main；HEAD=86b0873b0b3638e1ebef1ca2058f7c977bc8b907；tracking=origin/main。本文件原为clean，原正文SHA256=7ff3963f43cff71616f6793a01f55e6ee1b00661f386d88f512d4708ba9ea162。已有他人overlay含功能法案/Website Blueprint/route specs、catalog/mediator/route质检与Zeji材料，以及既有派单优先级方案；全部保留，不纳本次文档编辑或未来提交授权。开工时Browser生产/质检目标均clean；下述56源hash仅是设计/开工基线，不是当前已施工候选的质量证据。

Scoped source由下列现役文件原字节绑定；本方案自身排除，文档hash另行读回。算法：路径按UTF-8 bytes排序，连接path+NUL+内容SHA256hex+LF，再SHA256。未来执行先重核HEAD、相关overlay、同一scope hash；相关变化只重算受影响结论，发现未授权用户改动就停相应施工。Skill正文按当前实读，不以旧已读摘要代替；闭环Skill全文本轮已分段完整取得两遍。

56文件source SHA256=773ebfbe72b7b4c2629534c8b212686189d33ba5764b3803d40c7cb1132f34bd。

```text
AGENTS.md
.github/instructions/agent-rules/基础法案.md
.github/instructions/agent-rules/功能法案.md
docs/governance/法案系统建设说明书-冻结定稿版.md
docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md
docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md
docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md
scripts/audit/domains/local-browser-session/manifest.json
scripts/audit/domains/code-purity/manifest.json
package.json
src/lib/local-runtime/production/runtime-state.ts
src/lib/local-runtime/production/runtime-execution-heartbeat.ts
src/lib/local-runtime/production/executor.ts
src/capabilities/gpt/production-browser-lifecycle.ts
src/lib/browser/exact-target/browser-target-lease.ts
src/lib/browser/infrastructure/browser-lane-coordinator.ts
src/lib/browser/infrastructure/browser-target-acquirer.ts
src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts
src/lib/browser/transport/browser-authority-websocket.ts
src/lib/browser/transport/browser-authority-frame-codec.ts
src/lib/browser/chrome-extension/websocket-actor.ts
src/lib/browser/chrome-extension/websocket-target-operation.ts
src/lib/browser/chrome-extension/websocket-target-claim-awaiter.ts
src/lib/browser/chrome-extension/extension-target-authority.ts
src/lib/browser/chrome-extension/extension-target-acquisition.ts
src/lib/browser/chrome-extension/extension-created-target.ts
src/lib/browser/chrome-extension/extension-target-release.ts
src/lib/browser/chrome-extension/extension-interaction-readiness.ts
src/lib/browser/chrome-extension/debugger-runtime.ts
src/lib/browser/chrome-extension/chatgpt-page-access-gate.ts
src/lib/browser/protocol/browser-protocol.schema.json
src/lib/browser/protocol/generate-browser-protocol.mjs
src/lib/browser/protocol/generated/browser-protocol.generated.ts
scripts/audit/domains/local-browser-session/target-claim-inspection.ts
scripts/audit/domains/local-browser-session/browser-mutation-settlement-inspection.ts
scripts/acceptance/browser-lane-fifo-support.ts
scripts/acceptance/browser-lane-fifo.acceptance.ts
scripts/acceptance/local-browser-target-lifecycle-support.ts
scripts/acceptance/local-browser-auto-pairing-support.ts
scripts/acceptance/local-browser-auto-pairing.acceptance.ts
scripts/acceptance/local-browser-terminal-contract.acceptance.ts
scripts/acceptance/local-browser-rule-mutants.acceptance.ts
scripts/acceptance/browser-extension-build.acceptance.ts
scripts/acceptance/browser-extension-release-identity.acceptance.ts
src/capabilities/gpt/production-call-preparation.ts
src/capabilities/gpt/production-child-tools.ts
src/capabilities/gpt/children/prepare_clean_gpt_chat/observation.ts
src/capabilities/gpt/children/prepare_clean_gpt_chat/handler.ts
src/lib/browser/infrastructure/browser-infrastructure-state.ts
scripts/acceptance/agent-production-runtime-business-admission.acceptance-support.ts
src/lib/browser/chrome-extension/websocket-actor-crypto.ts
src/lib/browser/chrome-extension/websocket-actor-diagnostics.ts
src/lib/browser/transport/browser-authority-diagnostic.ts
src/lib/browser/browser-failure.ts
src/lib/browser/protocol/browser-errors.json
src/lib/browser/chrome-extension/exact-target-runtime.ts
```

本轮主Codex已完成三轮方案自审；实际只读子审发现的截止认领、active撤权、bound活动绑定退休、新建registry确定退休及质检消费者遗漏，均已回补到本轮唯一正文。技术审查者曾接触早期主审自评，其意见只作为技术复核，不冒称盲审；另一全新独立审查者在不含该自评的材料上独立取证，并对后续受影响修订逐次复核。两者最终均对施工正文SHA256=6afa35b8e697d3e2888ab0815ca233fc6dc7c3f3186dc1036b56c0895a3664dd明确放行，56源文件绑定未变；本次收尾仅更新状态和本审查记录，不改变§1—7施工合同。旧候选的放行不适用。上述为施工前设计阶段记录：当时只完成方案设计，没有实现测试、原生CHANGE/READY或生产业务证明；设计准入、施工授权、唯一原生质量裁决与业务终点分别取得，不使用百分比评分或第二质量PASS。


当前施工进度（2026-10-21）：已在main完成W0/W1/W1C/W2实际建设，保留原事件等待、普通命令及release/ACK期限、唯一FIFO/lane/WAL/Outbox。主Codex在代码前完成法案/施工图两遍自审，删除原方法片区后立即用磁盘AST读回缺席再重构；重要接缝子审发现的ACK计时早于sender出队与关闭无同步缺席证明两处已证缺陷已在原begin/discard出口闭合。专用support只由原auto-pairing验收入口调用且已在本域Manifest登记；实际Node Acquirer/AEAD/Actor/Authority/CreatedTarget/Supervisor链受控时钟矩阵、typecheck与FIFO验收已exit0，mutants及原生质量必须以当前候选最终原件为准。该进度不是READY或生产成功，未启动/停止运行系统、未接触用户Chrome、未删除工单、未动Website业务代码，F8自然生产验收尚未执行。原方案设计放行不充当本轮代码放行；最终主审、独立代码审查、CHANGE、clean提交/首推、READY及再次推送均由当前施工链各自记录。
