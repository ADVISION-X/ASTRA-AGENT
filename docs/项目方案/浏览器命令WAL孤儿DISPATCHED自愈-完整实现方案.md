# AGENT 浏览器重复超时、释放暂停残留与提交回执失配完整实现方案

状态：可施工（仅方案内部设计准入，不代表已获本轮施工授权）。日期：2026-10-12（Asia/Dubai）。需求 Owner：AGENT / local-browser-session。
沿用唯一方案路径，替换前轮施工正文并保留已落地不变量；不建立竞争方案。

## 1. 目标、终点与授权

本轮修复设计覆盖四个已证伪的直接缺陷：A1 旧 Target handler 未退出时重复接入并积压，及失败诊断的请求归属断链；A2 release 失败退出后遗留接入暂停；R1 迟到释放成功回执无请求关联，撤掉整个连接或错完成新释放；S1 exact-outgoing 后置回执两端判据不一致。目标为故障调用有限退出、真实旧操作结束后原链接回、兄弟任务不受遗留暂停或旧回执连坐、原提交事实可合法记账。

本轮交付仅方案文档 CHANGE，只在本地 main 更新本文件。没有法案、Blueprint、代码、数据库、Chrome、扩展或生产写入；不删单、不重启、不提交/推送、不执行 READY/RELEASE。未来施工须另有覆盖§6精确路径的授权，旧授权、前轮子审及旧 READY 不替代本轮授权或验收。

尚未查明事故中每笔 Target 超时的最初 Chrome 原因。真实 native 一直不返回时，仍为 Browser Owner 管理的结果未知：业务等待有限失败，保留原操作/事实，不增加扩展 Target handler；当前真实物理动作仍必须串行。本方案没有自动强杀、同 build 重载、诊断断连或通用取消链，不声称永久 native 卡死已根治。

权威业务终点仍是 Product 结果→Runtime durable result/terminal Outbox→Website 领域事务及 admission readback→Runtime local completed。N=3 是 Website 业务容量；一条 Browser 物理 FIFO/lane不变。三个 Tab、GPT出字、HTTP 200、普通测试或旧质量证据均不是业务完成。

## 2. 当前证据与第一直接断裂

输入附件：/Users/nexgen/.codex/attachments/1891d578-4ec0-464a-a0b3-75c0a4d0e5e7/已粘贴的文本.txt。
原日志：.grasseye-local/runtime-logs/agent/eec017d8-7396-4084-9444-487e5959fa65-0001.jsonl；固定取证截止2026-10-12T17:59:37.676Z。原窗口按唯一失败Child span/event identity去重为12次Target超时、6个job，附件截止更早，不能混用分母或按多层传播计数。这批为localization_static_catalog / zh-HK，不能称为十四种专业产品。

| GAP | 第一直接断裂与应有事实 | 本轮可声称的证据 |
| --- | --- | --- |
| A1 | websocket-actor.ts#acceptTargetAcquire（218–258）不检查现役pendingTargetHandlers，Node caller超时后又发请求，扩展继续把handler塞进原logical queue；应仅拒绝新请求自身，不增加真实旧handler后的Target等待。迟到拒绝还必须归属原会话和原请求，不能连坐后续合法请求 | 真实Actor/Authority/DebuggerRuntime，模拟Chrome tabs.create延迟返回：3个认证请求→pendingTargetHandlers=3、真实create=1；真实退出和原清理后handlers=0、CONNECTED、close=0，下一请求create=2。证明放大链，不证明生产首因。子审补证：真实transport的release wire sequence=9、pending.requestSequence缺席，旧sequence=8诊断错拒新release；真实旧Actor handler失败通过新key发送旧job/sequence=2，原Node Acquirer错拒同job/sequence=2的新acquire |
| A2 | 同方法release成功解除暂停，失败仅删handler/report，留下commandAdmissionSuspended=true；应在真实退出且没有其他当前暂停责任时退休本次暂停 | 真实扩展release入口、原releaseJobBoundTarget，已登记精确bound Target，模拟getTargets拒绝后两个handler集合均空、slot=null、CONNECTED；下一合法acquire仍被ADMISSION_SUSPENDED拒绝。确定代码缺陷，尚无该分支的生产触发证明 |
| R1 | 原releaseOutcome只有job/target/outcome；Authority晚成功仍用当前会话发送，Supervisor无matching pending时throw，同job新release时却可错resolve。应保留真实物理退休，但只有当前原请求能完成等待 | 真实Supervisor→原WebSocket/AEAD/parser三例：无pending旧成功→close=1；兄弟pending→close=1且兄弟被reject；同job新pending→错误resolve=1。原release无caller deadline/session绑定，真实调用图可到这些分支；未把该反例归因给某笔生产job |
| S1 | dom-mutation-postcondition.ts#exactOutgoingTurnVerified检查hash+canonical URL，browser-observation-receipt.ts#exactOutgoingPostconditionVerified只检查hash；首页同包生产者拒绝、接收者要求成功→AUTH_INVALID；应一致判为合法后置失败并保留已知点击 | 真实verifyClickPostcondition→原packet binding→原decoder：首页/两query合格/hash正确稳定复现拒收，canonical包成功。job045ec3a6、command23da3f77于17:16:21.194Z有AUTH_INVALID/dispatched/count=1，但无历史DOM包，不能断言该次就是S1 |

S1另有下级权威冲突：Browser Blueprint第27行豁免exact-outgoing query索引原因；现役LAW-LOCAL-BROWSER-SESSION-004-V57对observation query失配没有该豁免。按冻结说明书§4.2修下级：query失配一律首个Q<i>原因；全部query合格但exact hash/locator不完整才用既有非索引MISSING。不修改active law。

子审定位的两个关联断裂已由主Codex真实代码反例复核：requestPreauthorizedTargetRelease丢掉原sendControlFrame返回序号，Acquirer的可选dispatch返回值因此漏登记release序号；旧Target失败回调直接调用reportRuntimeFailure，在回调时捕获新socket/key，把旧诊断重新加密进新会话。均为A1/A2的原请求归属链，纳入原位重构，不增协议字段、状态或Node第二接收链。两个反例只mock Chrome/native/WebSocket叶端点，未改生产代码。

R1是对子审成功分支追查的必要补全，不能靠上述失败诊断修正关闭。三字段成功回执不足以区分同job旧business释放和新admin释放；发送前deadline检查挡不住已发出的迟交付；挪用client frame sequence会破坏现役AEAD单调序号。因此仅此成功控制回执新增必填原requestSequence，唯一Browser协议10→11；不是新增恢复状态、历史请求账本或第二通道。LAW006的三字段限定仍原样约束TARGET_ACQUIRE请求；响应原数值序号不携敏感内容，LAW001/005的单协议/同端切换保持。

6f16c621于17:35:57.062Z的reasoning后置失败有count=1/confirmed/MISSING，但无失败DOM包，不改selector或延长等待。较早run的canceled_by_user没有操作者身份，不证明扩展冲突；126/123秒外层耗时不证明电脑负载首因。后来正常取得回答的ADJACENT_ASSISTANT_MISSING属于现役pending，不另立修复单。

官方接口核验：[tabs.create](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-create)与[debugger.sendCommand](https://developer.chrome.com/docs/extensions/reference/api/debugger#method-sendCommand)参数未声明通用AbortSignal。只能推断未发现直接可用的通用取消接口，不能据此授权强制重启或断言所有平台行为。

## 3. 四维对齐及前轮连续性

主Codex本轮已完整读取AGENT两份active law各两遍、闭环Skill全文两遍，截断段补齐；frozen-spec-index与本仓母本适用全文章节已核。39条active law仍为原生分母，以下专项映射不缩减分母。回归筛查命中反复迭代，使用深度：真实AEAD入口→handler/native→claim/revoke/diagnostic→Node pending→GPT失败→Runtime/Website恢复边界，并反查receipt producer→strict verifier→WAL/ACK。仅查此图和必要Git历史。

| 维度 | 现役权威、落点与裁决 |
| --- | --- |
| 法案 | LAW-CODE-PURITY-001-V6、LAW-CODE-PURITY-002-V2、LAW-CODE-PURITY-003-V3；LAW-CAPABILITY-GOVERNANCE-001-V19；LAW-ARCHITECTURE-BOUNDARY-001-V18、LAW-ARCHITECTURE-BOUNDARY-002-V2；LAW-AGENT-PRODUCTION-RUNTIME-001-V76、LAW-AGENT-PRODUCTION-RUNTIME-005-V43；LAW-GPT-001-V65、LAW-GPT-002-V32；LAW-LOCAL-BROWSER-SESSION-001-V4、LAW-LOCAL-BROWSER-SESSION-002-V6、LAW-LOCAL-BROWSER-SESSION-003-V46、LAW-LOCAL-BROWSER-SESSION-004-V57、LAW-LOCAL-BROWSER-SESSION-005-V6、LAW-LOCAL-BROWSER-SESSION-006-V46；LAW-RUNTIME-LOG-SPINE-001-V7、LAW-RUNTIME-LOG-SPINE-002-V4、LAW-RUNTIME-LOG-SPINE-003-V6。当前native串行、唯一Owner/WAL/FIFO、effect禁重放、Website唯一恢复、closed wire、日志仅诊断保持，无active law修改 |
| Blueprint | Browser V56接入/退出、exact豁免及第86/90行单协议/释放回执片区需先重构；GPT V69所消费submit同包locator/失败事实对齐。Runtime WEBSITE-AGENT-V6、Log V3、质量evidence ownership直接复用；不新增第三submit门 |
| 实现 | 原ExtensionWebSocketActor拥有接入/handler暂停责任，原Authority/DebuggerRuntime拥有物理动作/guard；原Acquirer/Coordinator拥有caller/FIFO。现役browser-observation-receipt.ts承载后置机械决定，实际严格同义消费者为扩展verifyClickPostcondition与Node observationPostconditionEvidenceValid |
| 质检 | package.json唯一quality:check；Browser原target-claim/dom-mechanical inspector与acceptance、原mutation/WAL verifier。不新增checker、verdict或存储 |

前轮commit 2a8e08d47的G1/B1已在现役HEAD落地，保持，不重做：
- GPT waitForProviderObservation/parkActive的新lease引用、旧park一次移交且失败退休、reacquire/selection经原facade重入同atomic identity；文本/图片、限流first cause与零提交读回不变。
- Coordinator全部queued acquire/release到期/abort有限退出；原动态remainingMs、唯一wake timer、队列上限10、公平性。queued到期不取消active/native；release仍排队30秒→静默40秒→dispatch30秒。
- 前轮L1请求全寿命/stage stop-and-join、C2逐job cleanup隔离、日志原span/4096有界去重和durable-fact后ACK继续。
- 前轮E1初始Target超时未确诊，扩展接入未改；Node-only反例未覆盖真实扩展积压及release失败暂停。本轮补已证实分支，不宣称此前全部回退。
- 普通Q<i>机制保留，exact-outgoing下级旧豁免按当前上级义务删除。旧方案子审只对应当时G1/B1，不作本轮放行。

反向调用补核：dom-pointer-intent-runtime.ts#prepareClick在exact-outgoing存在时先进入prepareExactOutgoingClick，不进入ordinary observationPointerAction的zero-action路径；页内coherent candidate的预点击计数判定用于原子候选准备，与点击后/Node回执验证的时间和输出不同，保留而不合并。W3不删预提交prompt/附件门，也不把普通零动作路径扩大为submit确认。

## 4. 唯一主链与合同handoff

A1/A2只重建现役接入/退出责任；R1只补原释放成功的请求关联；S1只在同一coherent packet上决定后置事实。业务恢复、新attempt/revision/risk仍由Website.ai-acceptance签发，不加AGENT恢复循环。

| handoff | 合同与唯一决定 |
| --- | --- |
| Node→Extension | 当前Browser protocol10；目标唯一11由原schema→原generator生成，当前AEAD连接/递增sequence、同absolute deadline。acquire exact action/targetMode/jobRefHash，authorized-continuation才有parentConversationUrl；release exact action/jobRefHash/releaseAuthority三字段不变。unknown fields拒收；无取消/重启/进度载荷 |
| 普通Target拒绝→Node | 复用DIAGNOSTIC：extension-runtime、job-bound-target-acquisition、failedFrameSequence、jobRefHash、既有code。目标实现：原transport的acquire/release均返回原frame sequence，Acquirer在同一同步dispatch中登记原requestSequence，只有匹配当前pending的job/sequence才消费有请求引用的诊断；旧Actor handler只有捕获socket/双向key仍属当前会话才报告旧请求诊断。背压BROWSER_BACKPRESSURE、其他原接入拒绝BROWSER_COMMAND_ADMISSION_SUSPENDED；合法拒绝不抛入onMessage的REVOKE/close，畸形/认证错仍fail-close。当前release尚未满足此目标，不把应建合同写成现役事实 |
| 释放成功→Node | revision11仅TARGET_REVOKE.releaseOutcome分支闭集targetRef/jobRefHash/releaseOutcome/requestSequence，原requestSequence safe integer≥1；普通revoke仍targetRef/documentRef/jobRefHash三字段，禁止加序号。Actor在原tracked handler内消费Authority真实物理结果，按捕获原会话发送原请求序号；Node只有pending.action=release且job/sequence同时相等才resolve。迟到released非null只调用原broker精确targetRef+job退休，迟到absent/null无精确旧claim身份必须零claim动作；两者不完成新pending、不purge、不清槽/WAL、不撤连接。非法shape/cipher/sequence原fail-close |
| 后置回执→Node | 原dom-observation.v2的同包currentUrl/queries/observedAt/target-document hashes/revision hash；扩展与Node共用一个机械决定。Node原header/binding/hash strict、canonical bytes、unknown-field闭集保持；其当前header未核清洗URL，W3复用并迁移原sanitizeCurrentUrl至receipt Owner供原Extension decoder与后置决定共用。包合法性保持原opaque segment规则；CONFIRMED locator另用原canonical规则，不混成一个门 |
| terminal→WAL/ACK | 原command/exact-call/receiptBindingHash及immutable WAL identity；合法失败也strict verifier→terminal CAS/readback→ACK。旧count/unknown不造零输入；无完整submit证明不造CONFIRMED locator。坏/null只原dispose/disposed |
| GPT→Runtime→Website | 原Child/effect/source/attempt/lease/fence；Target或新attempt不授重发effect。task-result18/control45无字段或版本delta；旧已输入/未知只同effect有限零提交读回，必要风险输入仅Website新grant |
| 业务终点 | 本事故staticCatalog由原business-result-consumer#staticCatalog在同事务finalizeConsumptionWithClient+writeStaticCatalogAdmission/writeStaticCurrentLocale，以精确result_payload_hash/business_consumption_hash及适用current entries核权威存储；Runtime reconcileBusinessAdmission读回后才local completed |

caller超时只结束等待；Node readState=idle表示本地lane调用占用，不是Chrome native退出证明，不得据此并行输入。扩展现役handler/drain与原DebuggerRuntime guard继续承担当前物理安全；接入fence不读取历史DISPATCHED，也不增加状态真相。

## 5. 有限分母和连坐验收

| 分支 | Owner、终态/readback、恢复接回与验收 |
| --- | --- |
| 无旧handler/drain，合法acquire | 原Actor接一个handler→原Authority claim/ACK→Node lease→原GPT/Runtime；A1正向 |
| 旧Target handler或drain未退，新acquire/release | Actor在鉴权/shape/sequence后仅返回新请求精确背压；handler/Authority调用数不增长，旧slot/claim/drain不变、close=0。Node有限失败，Website下一动作；A1 |
| acquire native迟到返回/拒绝、加载超时、claim ACK失败 | 原deadline/session guard阻止不合格输入，原exact cleanup/orphan管理继续，真实handler退出才退休；同会话late diagnostic按job/sequence不拒兄弟或同job的新pending；原失败/配对/FIFO接回；A1 |
| 同会话旧release诊断迟到，新release已dispatch | transport返回原sequence→Acquirer登记原字段；同job但旧sequence不等则忽略旧诊断，新pending保持至自己的真实终态/期限。当前帧的失败照常有限退出；A1序号反例 |
| native一直不返回 | Browser保留唯一真实handler/未知事实，Target backlog不增长；caller与queued waiter有限退出。真正退出后原清理/FIFO接回；无自动强杀出口，不计永久native恢复成效；A1 |
| release成功 | 原物理释放/缺席证明→releaseOutcome→Node resolve；Actor退休本次暂停、原flush其他合法fact；A2 |
| caller已timeout，原release随后真成功并迟交付 | R1原请求序号不匹配：非null仅按原targetRef+job精确退休旧claim；null不得按同job无参清新claim；兄弟/同job新pending均保留，close=0、resolve=0、WAL/槽不由迟到包清除。原Website下一轮当前授权release重新取得自己的物理缺席证明才收尾 |
| 原release真成功时已换会话 | 原physical registry退休和仅admin精确清原同job槽保持；Actor旧handler不发成功控制包到新key，原completion/drain退休，不误删新Target；新会话由原当前授权release fresh证明缺席，不伪造旧控制成功。immutable terminal补交仍允许当前认证连接；R1 |
| release拒绝/清理失败已真正返回 | 原失败diagnostic、不补releaseOutcome、不清slot/WAL；自己退出且无其他当前责任后退休本次暂停，新job可进入原门，Website原链处理失败job；A2 |
| 旧回调与换连接、drain、新handler重叠 | 仅删自己handler，不解新责任暂停，不清新槽、不误删其他Target；旧socket或任一捕获方向key不同即不发旧请求diagnostic，包含同job/同numeric sequence的新会话碰撞。原drain/新handler完成接回；A2竞争反例 |
| website-admin-deletion | 原exact absence→Runtime abort→lane→加入自身前快照排空→同job park/物理缺席证明→仅同job清槽→revoke→WAL/Runtime purge。真实旧Target忙只背压、失败保槽/WAL；原授权下一轮接回；A1/A2防误伤 |
| packet shape/identity/hash/cause伪造，或未清洗/非法URL | 原verifier AUTH_INVALID，真实已知/未知输入保持，原fact/dispose及Website恢复；URL有效性先按原清洗规则，不解释opaque segment内部格式；S1负向 |
| 任一query计数失配 | 首个mismatch index与closed C，exact也使用Q<i>；Node同包重算一致才接受失败terminal，后续query/hash/URL不覆盖首因；S1 |
| 全query合格、exact hash不等或clean URL缺canonical locator | 首页以及按原清洗规则合法但未满足原canonical locator的opaque路径，均postcondition=false/MISSING；合法后置失败而非AUTH错误、不补locator、不再点击。原decoder真实计数/结果分类保持，Website按原effect恢复；S1 |
| 全query合格、exact hash相等、canonical URL | 同一判定true；完整原submitRecoveryPayload/Child合同成立才CONFIRMED；原结果交付与业务readback；S1正向 |
| abort/lease/fence失效、已知限流、unknown dialog、Outbox已有完整结果 | 原guard关闭当前危险动作，原完整结果优先交付、effect有限零输入读回、Website必要grant。旧事故不成兄弟永久门；原G1/B1/Runtime验收保持 |

有限闭环含Owner管理的未知；无遗漏不等于未知首因已查明。四个GAP代码反例、生产实际归因、业务完成分别验证。原acquire的claim ACK失败/配对fail-close继续按原身份链处理，不把释放结果的被动退休扩大为任意Target claim拒错豁免。

## 6. 原子工单与顺序

未来精确授权后先W0并完成主Codex两轮权威/Blueprint审查，无finding才W1/W2/W3/W4。W1/W2/W4在同一候选共同关闭Target整条因果链，不单端交付。主Codex唯一写手，子智能体只审。每批准片区实际delete→确认旧定义/判据ABSENT→同路径唯一rebuild；禁止覆盖写、别名、兼容壳、第二链路。

### W0：Blueprint对齐（代码前门）

允许仅Browser的LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md中Target接入/handler暂停退出、第27行后置判据、第86/90行单协议切换/释放请求回执；GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md中submit消费同包失败/真实计数/locator语义。路径见§10。

物理删除对应旧片区后重构：query mismatch不豁免exact；真实旧handler/drain忙只局部拒绝新Target请求；acquire/release原请求序号完整交付；旧handler不得向新会话发送旧请求失败或成功控制；release失败退出退休自身暂停；清理失败不证明释放。单Browser协议11的releaseOutcome必填原requestSequence，只匹配原请求才完成等待，迟到null不清新claim。后置包先复用原URL清洗规则判合法，再独立判断canonical locator；不缩窄opaque segment。原两项submit条件、四targetMode、限流、Owner、Website45/18不改。无需修active law、冻结说明书、registry/Manifest。两个Blueprint对齐且两轮主审无finding才进代码，不用98%自评分冒充条款闭合。

### W1：Target接入有限拒绝

Owner：local-browser-session / 原Actor及其Node transport/Acquirer消费者。src/lib/browser/chrome-extension/websocket-actor.ts#acceptTargetAcquire接入片区依赖W0，与W2同完整方法delete/ABSENT后一次重建；不可分割地纳入src/lib/browser/transport/browser-authority-websocket.ts#requestPreauthorizedTargetRelease和src/lib/browser/infrastructure/browser-target-acquirer.ts#awaitTargetOperation。后两者原定义delete/ABSENT后重建：release直接return原sendControlFrame的number；dispatch返回合同由number|void收敛为number，同步返回后必登记既有requestSequence。acquire原返回、absolute deadline、原字段/超时/resolve/reject及全连接撤权语义保持；不新建state或接收Owner。

顺序：鉴权/decrypt→当前socket/key重验→严格sequence消费→strict targetOperationFrom→读现役pendingTargetHandlers/disconnectedDrain；真实未退出责任存在则精确BROWSER_BACKPRESSURE diagnostic并return。acquire/release均不构造第二Target handler、不调用Authority、不变旧slot/claim/WAL。普通acquire的原暂停/slot/pendingCommandHandlers拒绝也原code diagnostic/return，不进入全连接撤权。非法帧仍原认证fail-close，不能降级背压。

release保留合法排空pendingCommandHandlers的责任和加入自身前快照、捕获旧drain防自等待；不是把合法release的旧command drain删掉。不得增加本地retry。完成片区由W2承担。

验收：真实Node Acquirer/Coordinator/transport与真实Actor/Authority、仅mock Chrome/native/WebSocket端点；3job请求在旧native延迟/非返回时Target handler=1、nativecreate=1；两个后来请求各有限失败、close=0、旧slot/claim/WAL不变；旧操作真退出/原cleanup后下一合法请求进入。覆盖late diagnostic跨job/sequence，以及同job的旧release序号不拒新release；当前匹配的失败正常退出，acquire/release实际wire sequence必须等于各自pending字段。signal、release排空、claim/fact ACK及heartbeat不断。失败保持真实操作/事实，不reset计数、改N/延时或重载遮盖。

### W2：Target handler退出退休自身暂停

Owner同W1；仅同方法完成片区。物理删除release success-only解除、failed-only-delete及acquire重复退出分支，与W1同候选重建一个方法内完成closure，不增加类成员、状态或生命周期器。

只对已settled原handler删自身：socket/捕获双向session key仍同一、commandReady、pendingTargetHandlers/pendingCommandHandlers为空、disconnectedDrain=null才退休本次commandAdmissionSuspended。它退休接入暂停，不宣称所有Chrome native退出；原native barrier与逐次input guard继续约束。老回调不解新连接/其他handler/drain责任。

成功业务输出不改、原flush继续。失败如实保留code/slot/registry；发送原job/failedFrameSequence diagnostic前必须重验捕获socket和双向key仍同会话且ready，旧回调不调用会捕获新会话的reportRuntimeFailure。同会话原诊断发送与原flush补交其他合法fact继续；换会话只退休自身handler，原单槽经当前会话原heartbeat/flush补交原fact。原sendEncrypted内部捕获会话的后续await重验保持；无新epoch字段或诊断缓存。发送失败原transport路径，不吞错、不撤已记账事实、不等待自身/ACK。解除暂停不授风险输入。

验收：实际release getTargets拒绝、remove/absence失败、失败保槽、新旧socket/key、drain/新handler竞争、同一handler一次退休。真实Actor旧acquire/release失败→新key原transport decoder→原Acquirer，构造同job且numeric sequence相等；旧回调不发送到新会话，新pending不被错拒，同会话当前失败仍正确记账。无其他责任时下一正常acquire可进入；真实native未退仍零额外输入；失败不能清同job槽/WAL或伪报释放/完成。失败job沿原Runtime/Website当前授权接回。

### W3：同包后置事实一个机械决定

Owner：local-browser-session / browser-observation-receipt.ts。仅该文件coherentRowResult/exactOutgoingPostconditionVerified/observationPostconditionEvidenceValid及dom-mutation-postcondition.ts的exactOutgoingTurnVerified/waitForObservation；直接关联dom-coherent-observation.ts的sanitizeCurrentUrl/固定segment上限及其decodeObservationCall调用/import。将原清洗函数和原上限原位迁移至receipt Owner，Extension decoder直接复用，旧定义ABSENT；serialized页内location.href采集剥离query/fragment属于另一输入边界，保持现役行为，不误并或误删。

物理删除重复exact规则与exact覆盖首因分支，ABSENT后重建。现役receipt文件承载一个局部机械决定，两个现役严格同义消费者直接使用。输入原postClickObservation、可选preClickExactOutgoingTurn、同一个raw/bound coherent packet；Node header/binding/hash原strict校验继续，扩展不调用未bind header校验；无Node-only依赖或新跨域validator。

唯一顺序：
1. 已有shape/identity/hash不合法仍拒绝；同一原sanitizeCurrentUrl必须返回与包currentUrl逐字相等，protocol=https、固定origin、无credentials/query/fragment、pathname仅`/`或`/c/<opaque segment>`（非空且≤原256上限），缺失/非法整包拒收。原清洗函数抛BROWSER_DOM_READ_INVALID时，Node evidence verifier须映射为invalid，由原接收边界产生AUTH_INVALID，不能裸抛绕过该边界；Extension decoder保原DOM_READ_INVALID。不得解释opaque内部格式；此处不使用canonical locator regex，不能把非法包算合法pending。
2. query按合同顺序，首个eligible失配产生原closed Q<i>__C；exact无豁免，0..19和原原因集合不扩张。
3. query全合格，未要求exact则原ordinary成功；要求exact时首query原match prompt hash相等且同包currentUrl经原requireCanonicalGptConversationUrl等于自身才成功。
4. query全合格、包合法但hash/locator不成立为false/MISSING，含合法首页或未满足canonical规则的合法opaque路径；非法/未清洗URL已在第1步整包拒收。合法后置失败不AUTH、不推零输入、不再点submit。
5. Node比较postconditionVerified/nativeCause与同一决定；原clicked、mutationCount、identityRevalidated、binding、revision hash、submitRecoveryPayload其他严格校验继续。

普通1.5秒、动作2.5秒、submit静默40秒、Provider70–90秒、两段瞬态确认、单匹配后置/known limit不改，不新增Child第三门。已输入缺locator走原effect/Website有限恢复，不补点击或第二GPT回合。

验收：真实producer→bind→decoder→原fact/WAL/CAS/ACK链，用独立外部期望表，不由新函数生成期望。覆盖首页/canonical/合法opaque路径/hash不等、query0/后续首错及多错优先级、multi-match。非法URL分为只篡改URL破坏原revision/hash、以及用正确重新绑定hash但携http/foreign origin/credentials/query/fragment/非法pathname的整包，两类均拒，并断言Node准确AUTH_INVALID、Extension decoder原DOM_READ_INVALID；合法首页/opaque只缺locator则合法后置失败。伪cause/hash/header、普通20个index与closed原因拒伪造保留，失败原strict fail-close，不宽正则/旧规则fallback，不把未知补零。

### W4：原释放成功按原请求收口

Owner仍local-browser-session。仅原extension-target-release.ts#releaseJobBoundTarget/ReleaseContext、extension-target-authority.ts#releaseJobBoundChatGptTarget、Actor同一acceptTargetAcquire的release执行/发送片区、browser-authority-frame-payload.ts#BrowserAuthorityTargetRevoke/#parseBrowserAuthorityTargetRevoke、browser-infrastructure-supervisor.ts#onTargetRevoke；以及原browser-protocol.schema.json的revision=11与原generator生成browser-protocol.generated.ts。上述旧定义/回调发送分支delete→ABSENT→同路径重构，生成物只能原generate-browser-protocol.mjs生成，不手写；errors.json版号是错误目录自身，原样保持。

物理helper在原三条真实终点返回typed targetRef/jobRefHash/releaseOutcome：两个absent仍null，一次released仍精确bound targetRef；原readTargets/removeTab/readTab/readTargets、registry身份重验、失败throw/restore保持。删除context.sendRevoke的输出副作用，由原Authority await该结果→原onReleased（仅获admin且精确槽身份才清）→返回原typed结果。Actor的原tracked Promise<void>覆盖整个native/physical proof、onReleased、同捕获socket+双向key下sendEncrypted(TARGET_REVOKE,{...真实结果,requestSequence:frame.sequence})；不以Promise<result>强转或提前settled wrapper藏真实在途。换会话不发送旧成功，但原已证明退休不还原、不伪失败事实。

parser对release分支严格四字段和safe integer≥1，缺序号/旧三字段/未知字段拒收；普通documentRef revoke仍原三字段。Supervisor匹配pending.action/job/requestSequence后走原精确claim退休、fence校验和resolve；不匹配时只有非null结果可调用原broker.revokeOperatorTargetClaim({targetRef,jobRefHash})，原broker已只匹配才退；迟到absent不得调用无参revoke，任何迟到结果不得清槽/WAL或解决新pending。无需新pending字段、历史请求账本、receipt缓存或恢复Owner；pending先建立再同步dispatch，原requestSequence仍可选作初始化，不给缺序号的回执匹配资格。没有历史账本就不声称能识别所有格式合法但不匹配的正整数是伪造还是迟到，只限定其动作/结算权为零或原精确claim退休。原WebSocket认证、deadline、monotonic client sequence和全局非法帧fail-close不放宽。

验收在真实Actor/Authority/physical helper→原encrypted frame/strict parser→真实Supervisor/Acquirer完成：①当前匹配成功；②caller超时后用新鲜回执deadline迟交付，无pending/兄弟pending/同job新pending均close=0且不resolve；③旧business释放对新admin释放不能授purge或清槽；④新同job不同Target+late absent零claim动作，late released只退休精确旧claim；⑤换key旧成功不发，新会话原fresh release可证明absence接回；⑥失败保槽/registry、管理员原精确清槽先于自己成功回执、跨job/操作者Tab零触碰；⑦缺/零/负/小数/非安全整数/未知字段/不等nonce/坏cipher及旧protocol10全部原fail-close。物理结果不能由timeout/连接断开编造。

## 7. 结构预算、质检与分层完成

原生AST现值：Actor393行/15imports/15sources/类成员30，已到上限；acceptTargetAcquire41行/2params/2returns/1await/nest1/complexity11。禁止加Actor成员或helper成员，W1/W2用原方法/局部closure，类仍30；每函数≤75行/7params/8returns/10await/nest5/complexity16，文件≤500、imports≤28/sources≤24。

dom-mutation-postcondition303行/9imports/8sources/10exports，waitForObservation55行/6params/3await/nest3/complexity9，删除12行重复exact helper再承载。receipt302行/6imports/6sources/15exports，coherentRowResult21行/complexity14、exact13行/complexity8、verifier21行/complexity12；不把新判定堆进complexity14函数，原Owner删除重构局部决定，每函数同红线、exports≤24，不新建文件。

新增关联片区实测：transport297行/10imports/10sources/27类成员，release4行/3params/complexity2；Acquirer95行/6imports/6sources/6成员，awaitTargetOperation33行/4params/complexity6。仅原返回/dispatch登记链重构，不增成员。dom-coherent-observation485行/7imports/7sources，原sanitizeCurrentUrl13行/complexity14/nest1迁出后缩减；receipt新增原函数/常量导出仍≤24，清洗/判定各函数独立守原预算。

R1原值：Supervisor407行/23imports/23sources/类成员30，onTargetRevoke24行/complexity9/nest3；禁止新增成员，原方法内匹配/被动精确退休即可。Authority257行/21imports/21sources/28成员，release9行/complexity1；physical helper35行/3sources，release25行/complexity11；frame-payload93行/8sources/13exports，parseTargetRevoke14行/complexity10/nest2。typed物理结果直接复用原合同类型投影，不另建spec；只原位返回/消费，原结构红线不减。

未来直接质检修改仅原路径：
- scripts/acceptance/local-browser-target-lifecycle-support.ts（230行）/local-browser-auto-pairing.acceptance.ts：真实认证Actor接入/退出及原Node consumer反例，只mock叶端点，不mock被测方法。原local-browser-auto-pairing-support.ts（371行、24sources已满）复用并导出原workerFixture给上述consumer，不再添import来源；原withdrawalRaces/authorizedWithdrawal消费新背压及typed结果，保原admin精确排空/清槽/失败保槽分母，不用假Authority方法替代根因验收。新反例落target-lifecycle-support守500行/24sources/函数预算。原agent-production-runtime-business-admission.acceptance-support.ts（481行）只同步现役release叶stub返回序号，保留管理员删除全量断言。
- 原browser-lane-fifo-support.ts（314行、9sources）的releaseThroughWire/delayedRevocation/intentionalClose同步物理返回结果和releaseOutcome四字段；原release dispatch fixture已return1，保持。生命周期closeRotatedTargets/continuation/closed-tab recovery保留跨job轮转/精确Tab不误删；当前回执匹配正例及合法迟到的零动作负例替换原throw断言，shape伪造/失败restore/readback/absence不减。
- local-browser-dom-coherent-click-support.ts（178行）/local-browser-mutation-receipt-support.ts（111行）/local-browser-terminal-contract.acceptance.ts：S1真实producer/consumer与原WAL-ACK，独立期望。
- scripts/audit/domains/local-browser-session/target-claim-inspection.ts#inspectAcquisitionWire/#inspectWire/#inspectRelease/#inspectPhysicalReleaseProof：删除旧字符串/发送节点判定形态，原位证明fence顺序/本次handler退休/原socket-key诊断及成功归属、acquire/release原sequence登记与释放成功四字段/parser/匹配消费。原三条真实物理输出从context.sendRevoke节点改核真实typed返回→Authority onReleased→Actor tracked发送，保两条null absent/一次exact released、失败throw/restore、fresh物理readback先后；不可因改返回形式让断言空转。
- 同现役dom-mechanical-facts-inspection.ts#inspectPostconditionEvidence/#inspectCoherentRuntime：证明两后置消费者同判定、Extension decoder从原receipt Owner import/call原清洗函数及其原卫生门/上限；页内producer物理丢弃query/fragment断言保留，不只删迁走token或降分母。原rule-mutants覆盖漏gate、盲清暂停、并行native、丢release序号、旧session诊断/成功、新admin错resolve、迟到null清新claim、URL伪造、只查函数名的反例，原旧sendRevoke token按唯一新物理返回链重建。必要新增反例仅落原local-browser-rule-mutants.acceptance.ts。

保留原G1/B1/FIFO、logical priority/native barrier、跨job Target轮转、管理员exact释放、自等待/断线drain、ACK丢失重投/dispose、日志失败仍ACK、索引20×原因、限流、文本/图片marker读取。原检查器/law/evidence分母不能删减，原质量Owner/入口不扩张。

当前只有设计反例，不宣称修复代码Exam已通过。建设后主Codex两轮实际diff自检→实际建设与方案/法案/Skill差异子审放行→唯一quality:check CHANGE；经授权clean commit/推送→READY/再次推送，按冻结ci-full-governance，不改Skill、不并行多套质量链。RELEASE/Dynamic Proof另需明确要求，方案子审不替建设子审。

生产成效另获运行取证授权后：故障job和两个兄弟job各查Website admission/适用领域存储/Runtime completed；原结果先交、原effect有界零提交读回、必要Website风险grant顺序保持。永久native未知继续记未知，不能把背压换码当业务成功；无首因证明不能宣布全部Target超时根治。

## 8. 删除反事实与切换

| 单元、Owner/真实消费者 | 必需GAP、删除具体失败、更短裁决及旧路退出 |
| --- | --- |
| 原Actor handler集合/暂停；Node请求与drain消费接入/失败事实 | A1/A2删除会积压或遗留暂停。复用原集合/flag，删无真实责任的暂停；W1/W2旧方法/两套退休分支delete→ABSENT→rebuild，不加状态 |
| 原DebuggerRuntime logical cycle/native guard/barrier；Authority消费物理许可 | 删除会在真实在途动作后读/输入，原反例可证。直接复用，不加watchdog/reset计数 |
| 原Node pending/Coordinator FIFO；GPT和claim/revoke消费lease/typed失败 | 删除丢身份/期限/公平性。原transport与Acquirer序号登记断链按W1原定义delete→ABSENT→rebuild，扩展接入关闭A1积压；不加物理租约真相/第二队列或历史DISPATCHED门 |
| 原receipt Owner的一次机械决定/原URL清洗；扩展/Node消费者 | 删任一消费无法产生/验证事实，留两份决定重现S1。复用原Owner比新模块更短，W3退休producer重复helper及consumer hash-only语义，原sanitize函数迁入同Owner、旧定义退出，不增第二清洗规则 |
| 原physical release结果/Actor发送/strict parser/原Supervisor消费者 | 删除实际物理结果或关联不能合法证明释放；保三字段旧response会错resolve新admin或撤兄弟连接。仅加原requestSequence比重用deadline或新增历史账本更短；W4旧发送/解析/匹配片区delete→ABSENT→唯一重建，单协议11，零第二状态/存储 |
| 原WAL/slot/ACK/dispose及Website恢复；各原Owner输出effect/receipt/grant | 删除会丢未知并重放；直接复用，背压或解除暂停不能清旧事实，零新store/retry/恢复Owner |
| 原Blueprint/inspector/acceptance；施工者/唯一quality消费 | 本轮冲突与反例需改对应片区，删验收失去四个GAP及成熟不变量证明；更新原对象，零新治理文件/registry/Manifest/checker/verdict |

未通过必要性/安全证明的native进度协议、诊断缓存、新枚举/状态库、自动断连/重载/强杀、第二恢复队列、延时放大、全Product重做均从目标方案删除。

切换只AGENT Node+唯一Extension固定artifact，目标唯一wire11（旧10物理退出），Website45/18/DB不变，无双仓施工。原schema→原generator派生唯一protocol revision/hash，原candidate生成唯一releaseBuildId；实际启用另获原启动/停止授权，先停新claim、继续结果/receipt交付、证明旧真实handler/native退出，再旧worker退出/Node与同build Extension一起启用，无fallback或兼容桥。原startup policyHashes/build releaseRecord/hash消费者直接复用，不扩写生成机制。历史未知WAL不要求清零；native未退不能虚报drained，不自行强杀。回退仅完整已核Node/Extension候选，不撤事实/复活fence或混新旧模块；不接纳旧10或单端旧response。

## 9. 三轮主审、子审与执行者重绑定

本轮三轮主审和两位子审已完成；可施工仅是设计准入，未来执行授权及实际建设验收仍按§1/§6/§7。三轮主审分别核：①authority/Owner/授权与下级冲突；②有限分支/失败时序/跨job连坐；③前轮连续性、删除反事实、结构预算、可取得验收与candidate drift。三轮无finding才启动子审，子智能体只读对比当前方案、源头、法案和完整双遍闭环Skill；未明确放行不得结束方案建设。

主审第1轮已核active39条及全部显式lawId、下级exact豁免冲突、原Owner/wire10/45/18、冻结非Skill施工授权门。修正法案缩写为完整identity，补入直接rule-mutants/submit consumer及反向pointer/coherent准备调用的candidate范围；没有法案弱化或施工越权。

主审第2轮按§5逐分支反向攻击：真实native未退不假释放；晚诊断跨job/sequence不误拒；release失败保槽/registry、旧回调不解除新drain；管理员快照在自身加入前；S1首query原因不被hash/URL覆盖、合法失败保真实计数/原ACK、非法包不放宽；已CONFIRMED同effect零重发。分母各有原Owner/终态/回接，不新增永久native自动恢复声明。

初稿主审第3轮核前轮G1/B1已落地符号与防回归验收、预点击/点击后判定的不同职责、Actor30成员红线与各函数预算、同包唯一决定的两个消费者、原Static/Exam落点/删除反事实、业务终点及未来授权/切换门；初稿绑定为47+7文件。该轮结论不是后续补全候选的放行。

子审发现的release序号丢失、旧session失败诊断、迟到释放成功的连坐，主Codex已用真实原类/认证解码反例逐项复核，分别纳入W1/W2/W4；原URL清洗与canonical locator职责混用的风险纳入W3，不缩窄合法opaque包。原物理typed返回→Authority→Actor完整tracked发送、成功四字段/唯一11、现役fixture/inspector的直接消费及原分母均纳入本方案，不留口头补丁。

补全稿主审第1轮重新匹配冻结说明书§24/25/37/38/81–83/B.3，核19个显式现役lawId、LAW006请求三字段与响应序号的不同责任、单协议/同候选、原类型主权及URL合法性，未发现需修改active law或冻结规范。第2轮反向核W1–W4的失败与成功会话归属、真实handler退休、同job/跨job/新管理员请求、迟到null零claim动作、非法包准确原因、永久native未知及原effect/Website接回，未发现新增连坐或虚假物理完成。第3轮全文核原检查器/fixtures/质量分母、Actor与Supervisor各30成员预算、原sanitize唯一迁移、物理删除/ABSENT验收及前轮连续性；独立重算55+7文件hash与§10相等，两仓scope均无overlay、19个lawId均在现役源头、三份Skill hash未变，本方案独占AGENT差异且diff check无错误。补全稿三轮主审完成。

本轮子审audit_plan_law_target_20261012与audit_plan_closure_target_20261012均全文读回同一补全稿，独立核55+7绑定并明确“方案放行”，无未闭合finding；共同审查稿SHA256=5d3b98a9cd209a274897a411e75395d6be5bae334f728883604748d33c88b6cf。放行后本段及状态只记录审计结果，不改变目标合同或施工动作。子审只做只读审查；结论仅设计准入，不替代代码建设、CHANGE、READY或生产证明。

未来执行Codex重新核§10 HEAD/overlay/hash及现役Skill，确认专项授权；W0两轮主审无finding才代码，各批准片区实际delete→ABSENT→唯一rebuild，重要步骤子审只审；代码后两轮主检及实际建设子审放行才CI-FULL。不把本轮设计授权/审查升格为施工或READY/生产完成。

## 10. Scoped source candidate

算法：路径按UTF-8 bytes排序，连接path+NUL+内容SHA256hex+LF，再SHA256；本方案自身排除，文档hash交付另报。AGENT初始全工作区clean；Website有他人无关overlay，以下只读scope clean，原样保留，不纳入AGENT提交。相关漂移只重核受影响片区。

AGENT realpath=/Users/nexgen/Documents/AGENT；main；HEAD=bd04fb6a903e4514472d81e629334738c80dd14b；tracking=origin/main；55文件source hash=5ccacc27b5caf69b9a6711b2326d47fb4bd85b2843686971ced6d3fdaffc3e8a。

```text
AGENTS.md
.github/instructions/agent-rules/基础法案.md
.github/instructions/agent-rules/功能法案.md
docs/governance/法案系统建设说明书-冻结定稿版.md
docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md
docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md
docs/blueprints/runtime-log-spine/RUNTIME-LOG-SPINE-V2-BLUEPRINT.md
docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md
docs/blueprints/code-purity/QUALITY-EVIDENCE-OWNERSHIP-V1-BLUEPRINT.md
src/lib/browser/chrome-extension/websocket-actor.ts
src/lib/browser/chrome-extension/extension-target-authority.ts
src/lib/browser/chrome-extension/extension-target-acquisition.ts
src/lib/browser/chrome-extension/extension-target-release.ts
src/lib/browser/chrome-extension/extension-created-target.ts
src/lib/browser/chrome-extension/debugger-runtime.ts
src/lib/browser/chrome-extension/dom-mutation-postcondition.ts
src/lib/browser/chrome-extension/dom-pointer-intent-runtime.ts
src/lib/browser/chrome-extension/dom-coherent-candidate.ts
src/lib/browser/chrome-extension/dom-coherent-candidate-readback.ts
src/lib/browser/chrome-extension/dom-coherent-observation.ts
src/lib/browser/chrome-extension/extension-command-runtime.ts
src/lib/browser/chrome-extension/websocket-actor-diagnostics.ts
src/lib/browser/chrome-extension/websocket-target-claim-awaiter.ts
src/lib/browser/exact-target/browser-observation-receipt.ts
src/lib/browser/exact-target/browser-mutation-receipt.ts
src/lib/browser/exact-target/browser-interaction-native-cause.ts
src/lib/browser/exact-target/browser-site-policy-registry.ts
src/lib/browser/infrastructure/browser-target-acquirer.ts
src/lib/browser/infrastructure/browser-infrastructure-state.ts
src/lib/browser/infrastructure/browser-authority-broker.ts
src/lib/browser/infrastructure/browser-lane-coordinator.ts
src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts
src/lib/browser/transport/browser-authority-websocket.ts
src/lib/browser/transport/browser-authority-frame-payload.ts
src/lib/browser/transport/browser-authority-diagnostic.ts
src/lib/browser/protocol/browser-protocol.schema.json
src/lib/browser/protocol/generate-browser-protocol.mjs
src/lib/browser/protocol/generated/browser-protocol.generated.ts
src/lib/local-runtime/production/runtime-business-admission.ts
src/capabilities/gpt/production-browser-lifecycle.ts
src/capabilities/gpt/children/submit_exact_gpt_turn_once/handler.ts
scripts/acceptance/local-browser-target-lifecycle-support.ts
scripts/acceptance/local-browser-auto-pairing.acceptance.ts
scripts/acceptance/local-browser-auto-pairing-support.ts
scripts/acceptance/agent-production-runtime-business-admission.acceptance-support.ts
scripts/acceptance/local-browser-dom-coherent-click-support.ts
scripts/acceptance/local-browser-mutation-receipt-support.ts
scripts/acceptance/local-browser-terminal-contract.acceptance.ts
scripts/acceptance/local-browser-rule-mutants.acceptance.ts
scripts/acceptance/browser-lane-fifo-support.ts
scripts/audit/domains/local-browser-session/manifest.json
scripts/audit/domains/local-browser-session/target-claim-inspection.ts
scripts/audit/domains/local-browser-session/dom-mechanical-facts-inspection.ts
scripts/audit/domains/code-purity/components/structural-metrics.ts
package.json
```

Website仅只读合同/终点边界：realpath=/Users/nexgen/Documents/xuanxue-web；main；HEAD=8b34a80db29e6f65a92ecbb47d676be41491fa58；tracking=origin/main；7文件source hash=0a1aca5f4e547ea5660b026e4385b6181e5f3eb7c83a45eac2370c28da705453。网站侧其他工作形成新commit，7文件bytes未变，重新绑定HEAD；零Website规范/实现/质量写入，不宣称Website READY。

```text
docs/specs/ai-acceptance/website-agent-task-result.provider.spec.json
docs/specs/ai-acceptance/xuanxue-ai-production-v6.contract.spec.json
services/api/src/ai-production/job-terminal-repository.ts
services/api/src/ai-production/business-result-consumer.ts
services/api/src/ai-production/business-result-domain-dispatch.ts
services/api/src/localization/localization-static-catalog-consumer.ts
services/api/src/localization/localization-static-current.ts
```

设计指令来源：/Users/nexgen/.codex/skills/closed-loop-implementation-design/SKILL.md SHA256=db5ce193cdc32b1c3b0fbd25f8961a354572966dd9a7c01658d0fd5b79e3b1b2；/Users/nexgen/.codex/skills/frozen-spec-index/SKILL.md SHA256=1ad041234e0a514ab2bca3ad11d4abc787985ff2952fc442aff3477fc12c6694；/Users/nexgen/Documents/AGENT/.agents/skills/agent-flow-boundary-gatekeeper/SKILL.md SHA256=baa2458a5f1ec2fc22308afbc3cebf88461db0547411f99145b481d90a317a68。输入附件SHA256=9f03f54c29b42666a110b07e9ebd7b65b2f1068ebfbb8a98a4375861f476fbbb。
