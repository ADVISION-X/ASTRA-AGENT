# GPT 文本回答扫描与原子读取根治－完整实现方案

状态：**可施工**。2026-10-20已获本方案施工及CI-FULL授权，正在主仓main执行。原设计三轮主审及独立设计审查已完成；建设审查发现的具体遗漏在本文件原位闭合后继续施工。状态不是建设完成、READY或原工单入库证明，实际质量结论只取原生入口。

## 1. 需求、终点与范围

本次目标：根据旧方案连续性与现场证据，修复原子读取及失败归因的真实遗漏。必须保持原 confirmed Provider effect 零重复提交；当前页面已有合法原回答时，取得其完整内容，不让无必要的临时对象清理夺走读取结果；确实失败时，原命令能说明失败发生在什么读取环节、属于执行异常还是数据不合法。

唯一方案沿用本文件。需求 Owner 是 GPT 文本回答能力，物理读取与诊断实现 Owner 是 `local-browser-session`。不重建已完成的命令诊断、轮巡、WAL、业务恢复或结果运输。Website 500、领取新任务、九产品语义、翻译质量、删除旧任务及原集成任务的推送不在本次修复面；不停止服务、不重载扩展、不调用原 Product、不再提交原 Prompt。

业务终点仍是原身份回答经 GPT → Product → Runtime 原结果事务/Outbox → Website 领域接收与 admission receipt，最后本地 completed。Browser 读取成功、网页答案或 fixture 均不能冒充该终点。本轮建设保留该闭环；生产终点须另获实际readback，不能由离线质量结论外推。

## 2. 候选与证据边界

项目 realpath `/Users/nexgen/Documents/AGENT`，只使用本地 `main`；设计源候选 `3dbf7270a105e0d3301d33ea44507d47aa33bd24`，tracking `origin/main` 同值，写前工作树 clean、本文件无他人改动。所有下述 tracked 来源由该 commit 绑定；方案自身不计入 source candidate，其最终 hash 在任务交付中单列。源码、规范、相关消费者或现场事实漂移，只重开受影响裁决，不覆盖用户改动，不建分支、worktree、stash 或副本。

关键来源 SHA-256：

| 来源 | hash（不含 `sha256:` 前缀） |
| --- | --- |
| `.github/instructions/agent-rules/基础法案.md` | `f1970c2416127f8bcdf560d0fd81105895924c4ed2cdd23f6a08ae910998d2f3` |
| `.github/instructions/agent-rules/功能法案.md` | `49253bbe166ce07fd92a3cdb35e8942baa2efa831afb6c5a1c36fcbb355ad3cd` |
| `docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md` | `96717ff2a399c60e7f449e3ff39d7084ba13abcf12d187eebce020a82985d830` |
| `docs/blueprints/runtime-log-spine/RUNTIME-LOG-SPINE-V2-BLUEPRINT.md` | `cda874e0071ed41ab6891ef8cde7265767b223bc543b6276a3e5c6207b26d529` |
| `src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts` | `08b1062cbca3ae30291c2ac014c8016e940f869ac16e647d055d267acf3ec34f` |
| `src/lib/browser/chrome-extension/gpt-rate-limit-dialog.ts` | `66072fbf4de8048dfedc1cea0508af1daa744e05e6dc659e23367e0e28402f4f` |
| `src/lib/browser/transport/browser-authority-diagnostic.ts` | `36ef792e1e03b7e0ad03cf08090bbdb0c331d9ea4616027f4fcf06a5b03cc5f4` |
| `src/lib/browser/protocol/browser-protocol.schema.json` | `5ef2514a01919bafb418b0531b2e6456169e407360de8ec5d285300d25acf286` |
| `src/lib/browser/protocol/browser-errors.json` | `e22463cb9a2ca4abb0af9835a931a52a0c046c6b368b6a568f24855e176adf24` |

事故证据是用户附件 `/Users/nexgen/.codex/attachments/8133368b-6a7b-4931-9ddb-31f550dd927c/已粘贴的文本.txt`、原 JSONL `.grasseye-local/runtime-logs/agent/227b6d09-4c5d-4a81-a74a-ae9ac8f82b9a-0001.jsonl` 与原任务只读记录。任务 `aiprod_0b2740cf-0b2e-4a0e-8223-a8dbfa2a447c`，attempt `7d27c7cf-0bf8-42bb-849b-1a2045e6ef6c`，`localization_static_catalog/produce_locale_catalog`，zh-HK。UTC 19:38:43 原 submit 确认；19:39:55.035 原读命令 `8e267048-f331-404a-a328-f3051c5e2bfb` 开始；19:39:57.480 记录 `BROWSER_COMMAND_DIAGNOSTIC_REGISTERED_COMMAND`，随后 `BROWSER_DOM_READ_INVALID`；19:39:58 租约释放。四层传播不是四次独立事故。只读 SQLite 为 failed，result/staged result 均空；原 submit WAL 保持 CONFIRMED，effect hash `sha256:4ae533ea994afba39e75269bedea8bf961040c64294ee5d5cb852662f747bcfe`。

真实 Chrome 事故页现有原 marker 对应唯一 user、真实相邻 assistant、唯一正文和 JSON code block；stop 为零。JSON 为 `target-language-candidate.v3`、zh-HK、78 项唯一 ID，context hash 与工单一致。assistant message ids 中同一个 UUID 重复两次，现役按空白分割后要求全部相等，能接收这种结构。思考区展开后再收起，身份和正文节点计数不变；已恢复收起。语义文本带 `JSON` 标题，但现役 `src/mediator/product-plugin-contract.ts#parsePluginJsonObject` 已支持此表示，不增清洗器。完整 URL、marker、正文不写入方案或日志；定位继续从原加密 WAL 读取。

本地 extension-build manifest 的 exact reader、semantic reader、command runtime 三项 hash 与当前源码一致；这只证明本地构建对应关系，不能单独证明 Chrome 加载身份。原异常的 CDP exceptionDetails 未留存，**无法追认它究竟由页面执行、返回结构、限流 preflight 还是 cleanup 触发**。当前完成后的 DOM 不能还原当时生成过程。不得写成“已证实 DOM 变化”“缓存”“插件冲突”或“电脑负载”。

再次确诊采用 Node v24.20.0 直接调用生产 `executeExactAssistantTurnRead`，仅替换 Chrome leaf response，不修改源码或生产数据：

| 同一真实函数的输入分支 | 当前结果 | 可证明的缺口 |
| --- | --- | --- |
| stable loader + 完整合法 observation | 成功 | 基线可以工作 |
| 页内 `exceptionDetails` | READ_INVALID，cause 缺席 | 页内失败类别被抹平 |
| CDP reject `Cannot find context with specified id` | READ_INVALID，原 cause 仅留 Extension 内存 | 原命令日志不能区分 native 执行失败 |
| CDP result.value 为错误结构 | READ_INVALID | 此分支应继续失败关闭 |
| 已返回完整合法 observation，仅第二次 release 报 `Object not found` | READ_INVALID；回答已经返回 | 读取结果被清理失败覆盖 |

同样直接调用真实 `observeKnownGptRateLimitDialog`：合法 absent fact 正常返回；仅 release 报错则原 fact 无法返回。这是第二个真实消费者的同根耦合，不是对原事故触发源的推定。最近 30 份原 JSONL 中仅发现本次一条 Browser 层 READ_INVALID terminal，不能拿传播层数宣称高频同根事故。

## 3. 旧方案连续性裁决：保留什么，遗漏什么

| 既有方案与落地证据 | 当前裁决及本轮动作 |
| --- | --- |
| 《双仓AI生产现场八项问题闭环修复》历史 `f220fa465` 的 D1，以及 `32493d3d7`、`0f3c11a48` | **实际落地，继续保留。** 原诊断先于 finally REPLY、同连接 request sequence 暂存、同 errorCode 才关联、原 Actor 一次 event、WAL commit/readback 与 ACK 优先。当前事故 event 已证明外层链在运行。旧设计只分 command-shape/admission/target-resolution/registered-command，没有设计读取内部的执行异常、payload 与 cleanup 分离。当前该文件在 `67bba5c7d` 已重绑 Website 派单 GAP，不覆盖它，不重复建设 D1。 |
| 本文件旧扫描方案，实际 reader 与 `31ffac2c5` 后续实现 | **三项已进入当前代码，本轮不重做。** marker 当前已挂载即停、未挂载才按实时几何有界滚动、无 visibilityState 第三门；当前 DOM 多义失败，未扫完不能称旧答案不存在。旧方案的“待原生质检”文字不能当成已完成 READY/生产证明。 |
| 《GPT回答轮次身份漂移阻断》《GPT文本回答两门禁冻结》及现役 GPT002-V32 | 保留 canonical URL + 原 marker + 当前 user/紧邻 assistant + Document/loader/revision 的身份整体，旧 UUID 仅 WAL lineage；stop 存在 pending、stop 消失且正文非空 DONE，停空只走原 20 分钟连续窗口。不得恢复旧 80 步、全页末位、visible、Prompt rehash 或 UI 壳条件。 |
| `31f807e99` 的 `return await scrollForExactUserTurn` 与 Browser 施工图原第43行 | **实际落地并保留其目的。** 物化异步过程必须 join 完，不能提前释放仍使用的对象。本轮退休 remote-object 路径后仍 await 全部物化，不把删除 finally 变成 fire-and-forget。 |
| 《浏览器命令WAL孤儿DISPATCHED自愈》当前 A1/A2/R1/S1 | handler 排空、暂停退休、release 精确关联与 submit receipt 不是本次原子 read 的实现。全部保留，不能重建一套恢复调度解决本次问题。 |

结论：**不是旧诊断修复被全部撤掉；是其粒度停在注册命令外层，同时 exact read 与前置探测仍耦合 remote-object 清理。** 本方案只补这两个已证缺口，不承诺消除全部 Chrome 故障，也不新增 READ_INVALID 盲重试。

## 4. 四维映射与必要规范改动

| 维度 | 当前依据及第一断裂 | 目标与验证 |
| --- | --- | --- |
| 法案 | 母本 §§4/21/35—38/44/47；基础 `LAW-CODE-PURITY-001-V6`；Browser001-V4、002-V6、003-V46、004-V57、005-V6、006-V46；GPT001-V65、002-V32；Runtime Log001-V7、002-V4、003-V6。异常与数据不合法不得混淆，结果不能被诊断清理撤销，敏感原文不能外泄。 | **active law 无需改变。** dedicated exact-assistant-turn.v4 是 Browser006 第三条许可载荷第二项；保持它的原子性和 schema。该条第五项关于通用 V2 packet 的 Runtime.callFunctionOn 不扩张解释为专用 reader 禁用 Runtime.evaluate；通用 V2 本轮原样保留。 |
| 施工图 | Browser V56原第43行要求remote-object await后释放；第99行禁止原parser其余枚举扩张；第86/90行写死协议唯一11、Node11/Extension11。Runtime Log Blueprint §6原第122行只允许旧五种stage。直接改实现会与这些句子不一致。 | W0-B替换上述Browser生命周期句：正常JSON读取不取得Document handle，物化全部join；异常返回的真实RemoteObject按第6节主失败优先收束。只放开下述三个stage并公开其唯一集合；第86/90行将双端版本和旧版拒绝同步为当前协议源revision12，拒所有其它revision。W0-L只将原Log事件允许stage扩至同一Browser closed set。其它CONTROLLED_VALUES仍私有，intent/nativeCauseCode不扩，Log schema、唯一event与failure terminal不变。不得改冻结两门、effect、时钟或业务恢复语义。 |
| 实现 | `materializeExactUserTurn`、`observeExactAssistantTurn`、`observeKnownGptRateLimitDialog` 把脚本、shape、cleanup 混合；`executeExtensionCommandReply` 只携 broad stage。 | 删除旧 remote-object 执行片区，以一条固定脚本 by-value 读取链替代；现有 DIAGNOSTIC 的 commandStage 补足三种读取责任，既有 error catalog 精确增加两个执行类别。 |
| 质检 | exact support 当前断言必须 release 两次；只覆盖原主异常不被 release 抢走，缺少“成功值不应被 release 改判”反例。原 atomic inspector 硬认一次 callFunctionOn。 | 先退休无必要的 API/释放次数断言，保留同包原子性、identity 与零输入保护；增强原验收及原 inspector，不建第二检查器/质量入口。分开验重构纪律、功能合同、生产 readback。 |

W0-B/W0-L只将各Owner现有施工图对齐；不授权修改母本或active law，不触碰冻结两门正文。本轮已获对应片区施工授权，仍须先规范对齐与两遍主审，才进入相应代码。若执行者发现必须改变冻结语义，停止相应施工并回到本方案，不能把普通授权解释为解冻。

## 5. 影响范围、消费者与停止边界

采用深度设计：同一片区反复迭代，涉及共享 preflight、封闭诊断枚举与原生质量保护。发现来源交叉为：① command registry 与 typed intent 枚举找合法入口；② import/符号反向引用找真实调用及旁路；③ 原 WAL、任务记录、JSONL、当前 Chrome 和真实函数 leaf 故障注入对照运行链。三者对 exact read 入口一致；preflight 额外包含普通逻辑访问、内部限流 ack 与 clearance，全部纳入验收，不能只测翻译任务。

以下路径均相对于 AGENT 根；未列为重建的消费者直接保留，不能借本方案改其业务行为。

| 精确对象/符号 | 消费合同及裁决 | 工单/验收 |
| --- | --- | --- |
| `src/capabilities/gpt/children/checkpoint_gpt_text_response/handler.ts` → `web/gpt-dom-observation.ts#readExactAssistantTurn` | 唯一 GPT text reader；只认 dedicated v4、两门与两个既有 pending。保留；新执行错误继续 typed fail，不能转 pending 或自动提交。 | W2，V1—V5 |
| `src/lib/browser/exact-target/browser-dom-read-intent.ts`、`browser-exact-assistant-turn-reply.ts`、`browser-dom-intent.ts`、`browser-target-lease-manager.ts`；`chrome-extension/command-registry.ts`、`dom-intent-runtime.ts` | 公开 typed 请求/专用回复、capability 映射、canonical hashes、permit 单链。身份/schema/载荷不变，直接保留；没有第二 exact reader 入口。 | W1/W2，V1/V4/V6 |
| `chrome-extension/dom-exact-assistant-turn.ts` | 原提问物化、原子相邻回答与 dedicated reply 组装，完整文件重建。 | W2，V1—V5 |
| `chrome-extension/gpt-rate-limit-dialog.ts#observeKnownGptRateLimitDialog` | 普通逻辑访问的 central preflight；同文件 `executeKnownGptRateLimitIntent` 的 ack 前重验及 `readKnownGptRateLimitClearance` 也真实调用它。重建读取函数，增加必填assertCurrent参数；两调用方仅局改传递现有guard，clearance只增加同一guard参数。detector文案/计数/hash、三种状态、ack mutation与clearance组装保留。 | W2，V3/V4/V7 |
| `chrome-extension/extension-target-authority.ts#executeRegisteredCommandCycle`、`#executeRegisteredCommandBody` | ordinary命令、ack/clearance两入口；只在原preflight调用处追加现有assertCurrent回调，保留deadline与readback guard。交互闸门、body分派与失效Target退休不变；新reader不替代外层逐次guard。 | W2，V3/V4/V7 |
| `chrome-extension/debugger-runtime.ts`、`extension-interaction-readiness.ts`、`extension-target-observation.ts`、`exact-target-runtime.ts` | 唯一物理/CDP allowlist 已含 Runtime.evaluate；只读许可、deadline、active tab、Target/loader。保留，不加 permission/method、timer 或 context registry。 | W2，V4/V7 |
| 新 `chrome-extension/dom-fixed-document-read.ts` | 仅 exact reader 与 rate-limit reader 的共同 by-value 执行、同 expected loader 前后守卫、执行错误归类。Browser 内部固定源，不是 caller JS/selector/URL DSL 或公开 facade。两个严格同义消费者证明必要；生产中不留旧 remote 路径 fallback。 | W2，V2—V4 |
| `chrome-extension/extension-command-runtime.ts#executeExtensionCommandReply`、`websocket-command-diagnostic.ts#extensionCommandDiagnostic`、`transport/browser-authority-diagnostic.ts` | 原失败出口的 stage 生产与封闭消费；只由错误携带的合法三种 leaf stage 细化 registered-command。前四种外层拒绝不能被叶子覆盖。 | W1，V6 |
| `transport/browser-authority-websocket.ts`、`browser-authority-frame-payload.ts`；`exact-target/browser-command-actor.ts`、`browser-command-runtime-logging.ts`；`chrome-extension/websocket-actor.ts` | 原 AEAD、request/token/permit、首次诊断、REPLY/receipt/WAL/ACK 与一次事件关联。数据形状不变，保留；通过现有真实链测试证明新值能读回，不另建 pending map 或 logger。 | W1，V6 |
| `protocol/browser-errors.json`、`browser-protocol.schema.json`、`generated/browser-protocol.generated.ts` | 新失败 code 必须进入原目录，否则 REPLY 会被拒。catalog revision10→11，wire revision11→12，生成器唯一产生 generated bytes；精确切换，不支持两版本。 | W1，V6/V8 |
| `scripts/acceptance/local-browser-exact-assistant-turn-support.ts`、`local-browser-dom-runtime-fixture.ts` | exact 与 materialization 夹具；498 行 support 无加法余量。退休 remote-object 专属 fixture/断言，重建同文件，以现有 fixture 为唯一 CDP stub 来源。 | WQ，V1—V5 |
| `scripts/acceptance/local-browser-rate-limit-detector.acceptance-support.ts`、`local-browser-auto-pairing.acceptance.ts` | detector wrapper 与所有注册 command preflight，及 ack/clearance；同步 Runtime.evaluate 固定脚本叶回复，保留真实 detector 求值。原同URL刷新正例经原acquisition或frameNavigated实际发布新claim，再由原lease manager以当前Document签新permit，严格preflight及Node decoder核验；旧permit跨未获权Document必须拒绝。 | WQ，V3/V4/V7 |
| `scripts/acceptance/local-browser-diagnostic-contract-support.ts`、`local-browser-rule-mutants.acceptance.ts`、`scripts/audit/domains/local-browser-session/dom-mechanical-facts-inspection.ts`、`authenticated-channel-inspection.ts`、`opaque-proof-inspection.ts#authenticatedMediaDispatchIsExact` | 真实诊断交付/回执顺序、atomic identity与原规则反例保护；opaque检查逐AST匹配整个CommandCycle，包含旧三参preflight，须同步唯一预期结构的guard参数。增强原对象，不增加平行检查。 | WQ，V4/V6/V7 |

只读核过的同构风险：`dom-coherent-observation.ts`、`dom-coherent-candidate.ts`、`dom-mechanical-facts.ts`、`dom-exact-editable-text.ts` 也有 remote-object 生命周期，但**不是专用 exact reader 的调用路径**；它们分别承担通用 V2 packet、真实 node 定位/指针资格或 Composer hash，不共享本次新 helper。保留其当前合同与所有独立消费者；不把本方案说成全 Browser cleanup 故障已根治。调用交叉发现它们参与本次专用回复或新 helper 使用扩出两个批准消费者时，停止并回补边界，不能悄悄扩大重建或放宽其法条。

Product—Runtime—Website边界后的结果字段、身份、revision、准入和副作用不变，故本轮不改下游。原事故的精确下游为`src/plugins/localization-production/static-catalog-flow.ts#executeStaticCatalogFlow/receiveCandidate`的context/locale/items机械接收、`src/mediator/product-plugin-contract.ts#parsePluginJsonObject`、`src/lib/local-runtime/production/runtime-claim-operations.ts#executeAndUpload`、`store-outbox.ts#stageResultAndEnqueueTerminal`的同SQLite事务及原terminal Outbox、`runtime-business-admission.ts#reconcileBusinessAdmission`核远端terminal hash与admission后`completeTask`。本仓`docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json`绑定唯一`ADVISION-X/xuanxue-web`的`ai-acceptance.website-agent-task-result` v21，本方案不改变该合同，不建立另一provider副本。V9按这条原链核完整结果事务、Outbox同identity result hash、Website领域/接纳receipt与local completed；Website不可达则报告业务动态证据缺口，不能因另一个Owner就提前宣称闭环。恢复授权只归Website，Browser没有新增恢复转换或持久化要求。

## 6. 删除审判与唯一目标链

先审质检：原exact support的“成功必须两次release”“必须某个CDP API”断言保护旧资源实现，不证明回答身份或完整性，删除；当前marker/邻接/长页/hidden/loader/零输入正反例保留，否则可接收错会话或重新引入第三门。原atomic inspector改为读取exact reader与新helper两个真实AST，核唯一固定调用、单样本完整字段、前后pinned loader、成功无Document句柄及失败资源主因优先，不能只认文件名。原诊断验收保留，否则迟到诊断可错配、日志异常可扣ACK。`opaque-proof-inspection.ts#authenticatedMediaDispatchIsExact`保留：它由原`inspectAuthenticatedMediaBoundary`消费，独立约束media必须沿当前logical/interaction/body守卫恰好分派一次；删除会放过绕guard或额外native调用，其余token检查不能证明控制流。只在其唯一expected AST同步本次preflight第四参数，不放宽whole-method比较或另建等价解释器；原rule-mutants中核合法guard传递通过、绕guard和第二media调用仍拒绝。直接增强同一次验收，不新增日志报告、runner或样本堆叠。

再审生产：这些固定Document reader不需要跨调用DOM node identity，现Document root handle只为执行全局document脚本而存在，其正常分配/释放及成功后cleanup覆盖分支在W2物理删除。现allowlist中的Runtime.evaluate可以同包by-value采集；**它不保证失败时无RemoteObject**。本地CDP类型`node_modules/playwright-core/types/protocol.d.ts`的ExceptionDetails/evaluateReturnValue明确允许exception及result携objectId，因此第7项单独承接失败资源。直接吞cleanup错误违反禁止catch-and-swallow，另加cleanup logger/队列则增第二链，均不采用。

共同执行逻辑有两个现役严格同义消费者，若各自实现会复制同 loader 和异常解析；因此新建一个 Browser 私有小模块。它不取得业务状态、不选任务、不重试、不存结果。保留 canonical semantic reader `dom-semantic-text.ts` 原件：完整 markdown/JSON projection 只有这一来源，复制或删除都会使专用回复的内容 hash 分裂。保留现有 typed request、reply verifier、WAL、Actor、Outbox 与收据，各自有不可替代的输入授权、内容完整性或持久化职责；不复制它们。

唯一目标链为：原合法 COMMAND → 原 Target/交互/节拍/central preflight → 同 pinned Document 的 fixed by-value read → 原 v4 reply → 原两门/结果链。失败沿原 DIAGNOSTIC＋原 REPLY 退出；不存在第二读取、重试、恢复、slot、timer 或存储。

`dom-fixed-document-read.ts` 的闭合合同：

1. 输入仅 Browser 内部固定 script、JSON 参数、原 target、命令开始就确定的 expected main-frame loader、固定 stage 和对应现役 decoder；外部调用方仍只传原 typed intent。每次 send 继续现 Runtime 的 current guard，执行前后显式 assert current；前后 `Page.getFrameTree` 的 loader 都须等于同一个 expected 值，不能使用“后来的当前 loader”自我通过。canonical URL 仍从同一页内样本清洗和绑定，不从 frame URL 拼接。
2. 使用一次 `Runtime.evaluate`，`returnByValue:true`、`awaitPromise:true`、`silent:true`，固定函数以本次 document 为 this 执行。每个物化 step 是一次同步样本，最终 user/adjacent assistant/HTML/semantic/stop 是一个同步采集样本；detector也必须在第一次await前取得全部DOM事实。exact reader私有observation的nativeStage相应改为`runtime-evaluate`并由原decoder精确验真，不向专用v4或preflight回复新增字段；通用V2仍为原callFunctionOn。URL/marker、原子性及所有decode不变量不因替换API变弱。
3. 页内包裹只返回私有临时判别值：恰好两字段`{kind:"value",value}`或`{kind:"failure",code}`。页内机械code闭集只有`BROWSER_DOCUMENT_INVALID`、`BROWSER_ORIGIN_REJECTED`、`BROWSER_DOM_CANDIDATE_AMBIGUOUS`、`BROWSER_DOM_READ_INVALID`，精确透传；未知页内异常及包裹本身的CDP exceptionDetails变为新`BROWSER_DOM_SCRIPT_FAILED`，不是对description作宽正则猜测。错误code和kind未知、缺字段、多字段或错误value形状为READ_INVALID。私有包裹不是新增wire reply/schema/proof：出扩展仍只有原专用回复、preflight fact或原errorCode。禁止传message/description/stack、selector、URL或正文到诊断。
4. `runtime.send` 的未知 native reject 变为新 `BROWSER_DOM_EXECUTION_FAILED`，已是 allowlisted Browser 错误则保持原 code；结果/包裹/业务 decoder 结构不合法才是 `BROWSER_DOM_READ_INVALID`。页内 UUID/角色关系或 URL 身份失真用原 `BROWSER_DOCUMENT_INVALID`，多义用原 `BROWSER_DOM_CANDIDATE_AMBIGUOUS`，缺 user/adjacent 仍返回两个原 typed pending。任何失败均零新增 Provider 输入。
5. 同一调用内Error最小携带封闭code、leaf stage和仅留内存的原cause，通过helper内定义并导出的单一专用Error类型传给真实consumer `executeExtensionCommandReply`，不能另建stage map/store或进度状态。producer只在broad stage已为registered-command且该Error类型成立时读取；合法closed stage为`rate-limit-preflight`、`exact-user-materialization`、`exact-assistant-observation`。类型及stage来自原parser的唯一常量，不能用任意对象property猜测。其它错误保留五种旧stage。stage只定位责任，不授恢复或重发。
6. decode必须在helper同一错误边界内完成，使shape、身份与执行错误都带真实stage；frame/guard已有精确code不覆盖。专用最终回复、preflight shape/hash、原request/reply identity、unknown-field fail-close和null规则保持。成功的正常JSON value路径不得取得Document handle或调用release，故不存在成功后finally清理夺走回答。
7. **失败资源分支不能省略。** 只从本次CDP响应的`result.objectId`、`exceptionDetails.exception.objectId`两个固定位置取真实非空string引用，去重后最多两个，绑定原tab/当前debugger调用，绝不跨Target猜找。exceptionDetails先成立则主失败固定SCRIPT_FAILED；无exceptionDetails却返回objectId而非纯by-value payload则主失败READ_INVALID。先固定带原stage的主失败，再复核同一pinned loader与原guard；任一失效即跳过全部release，资源保持未知。复核通过后，逐个await一次现已allowlisted的Runtime.releaseObject；无objectId零清理，每项仍复核原guard，失效不得向新绑定发送。释放与guard的所有附属失败用同一个主失败的AggregateError cause保留，不catch-and-swallow，不改主code/stage、不造第二terminal；继续尝试仍具原授权的其它引用后退出。释放结果不能证明时记为该失败分支的资源未知，交原Browser会话/Target生命周期处理，不宣称已释放，不加重试、异步后台清理、持久句柄表、timer或第二恢复链。正常JSON成功路径不进入该分支。

8. **同URL刷新与命令pin的交接。** URL相等仍零导航，Document是实时视图；不要求旧permit跨Document成功。直接复用原`acquireJobBoundChatGptTargetCycle`的fresh frame→`advanceDocument`→`TARGET_CLAIM`，或原`Page.frameNavigated`发布链；Node现有claim登记及lease manager的`currentCommandTarget`随后以当前Document签permit。只是调用一个可能复用缓存claim的Node acquisition入口，不等于取得新Document，必须读回实际新claim。旧正例仅修改fixture loader便持旧target发令，遗漏了该交接，不能据其失败放宽pin或Node verifier。原位修正正例，分别覆盖两种现成接管；新permit的preflight fact须经真实Node decoder验真，旧Document拒绝、不同URL获准导航至多一次、零额外Provider输入的保护保留。不增加生产刷新、重试、导航、读回周期或接管机制，不改生产lease、claim、detector及Node verifier。

Identity spine：job/accepted attempt/result revision → product step/call/Child/request 与原 Provider effect → 原 command/token/permit/requestSequence → live Target/Document/固定 loader → canonical URL/原 marker/当前 user与紧邻 assistant → 原 observation revision/content hash → 原完整结果 hash/receipt。URL 不是输入授权，旧 UUID 不是当前定位门。新增 code、stage 均不进入 effect/hash、业务 grant、任务状态或恢复 CAS。

## 7. 有限分母与功能验收

| 编号 | 实际分支、Owner、输出与 readback | 失败/未知及原链回接 |
| --- | --- | --- |
| V1 | Browser exact：当前 marker 已挂载零滚动，唯一紧邻正文完整返回；stop 存在仍保留正文供 GPT 判 pending；stop 无且非空为 DONE。嵌套 code/JSON 标题、重复同 UUID、hidden、思考折叠不增加条件。 | GPT 两门和 JSON parser 直接保留，验证原 v4 verifier 与原 artifact 内容 hash。stopped-empty 仍只由原 Child 连续窗口裁决。 |
| V2 | Browser materialization：未挂载才滚，正/反方向、实时长页、命中即停、当前 DOM 多 marker、进展不足、截止前3秒和12秒预算；整个异步扫描必须 await 完。 | missing/adjacent typed pending、ambiguous/invalid typed fail；只走下一轮现全局 observation，不导航、展开、搜索、刷新、发 Prompt 或新 timer。 |
| V3 | Browser fixed read：基线、页内未知异常、已知机械异常、native reject、畸形/未知字段、preflight fact/hash不等，核code＋三种真实stage。正常JSON路径的release故障stub永不被调用；CDP exceptionDetails覆盖无句柄、result/exception相同句柄去重、两个不同句柄逐个清理，以及无exception却返回RemoteObject的shape失败；清理失败/取消保主code与stage，附属错误有cause而无第二terminal。 | 错误沿原单次命令终态，不把invalid当pending。preflight异常不能当absent放行，页内执行失败不能改shape invalid。资源清理未知只归原Browser生命周期，不能伪报释放或新建重试。此组合是故障注入分母，不宣称原事故产生过异常句柄。 |
| V4 | Browser identity/取消：loader 开始不符、任一读取前后导航（包括相同 URL）、Target/Document/epoch/permit/deadline失效、用户切Tab、同marker在两次样本间换user、user message-id失真或多assistant。原同URL刷新正例分别经原acquisition及frameNavigated获得新claim，再由真实lease manager签当前Document permit并经Node decoder验preflight，保持零导航；未接管的旧Document拒绝。原inspector及四个真实违规mutant保护user稳定性、user message-id、assistant唯一性及hidden第三门，真实DOM同时覆盖user bubble、共同祖先和正文的隐藏属性仍可读取。 | 原精确拒绝，零新增页面输入；旧 result/effect/slot不改。活资源退休只按现 `retireInvalidCommandTarget` 对同当前绑定执行，不撤兄弟 Target。无新增恢复动作。 |
| V5 | GPT consumer：原两门、现至少70秒全局 observation、pending park/release、40秒提交静默和短 deadline不acquire；完整回答仍进入同一 existing artifact/Product 机械结果链。 | `BROWSER_DOM_SCRIPT_FAILED/EXECUTION_FAILED` 是 typed failure，不 catch-all 重读/重发。Website 未来签的原合法授权才可接回原 effect 零提交读回。 |
| V6 | 原 producer→封闭 parser→同 connection sequence→原五字段 REPLY→Actor event/span 的真实交付：三个 stage、两个新 code、未携 leaf 的旧 stage；首次匹配、错误 code/sequence/source、重复/迟到、诊断发送失败、日志失败。 | 一次原命令 terminal；无匹配 stage 为null。mutation 保留 fact→诊断→finally REPLY→退休，WAL commit/readback与ACK先于日志；不因新增诊断拒掉可信回执。 |
| V7 | preflight 全部消费者：原 registry 中 ordinary dom-intent/observe/screenshot/file-input/authenticated-media/wait/park-target 实际适用周期，以及内部 ack revalidation与clearance。absent/精确弹窗/未知dialog、hash及身份冲突分别按原合同。 | 精确弹窗原输入零次、原内部ack最多一次；未知仍fail-close。1.5秒、2.5秒、紧急ack例外、原WAL和全局lane保持，不增加页面逻辑周期或第二读回。 |
| V8 | 生成协议＋固定构建身份：唯一revision12、目录新code、双端相等，旧revision/构建拒绝而非fallback；原startup artifact同步与release identity验收。 | 无 active native/receipt handler 后才受控切换，不改旧 WAL、result或slot；旧 unknown 仍保持unknown，不能为切换伪造terminal。 |
| V9 | 授权后的真实原 effect readback：从原 WAL取得合法 locator/marker，用同 code候选、当前扩展身份读取；对照原 task revision/material context，取得既有 complete result、Outbox hash、Website同job/attempt领域与admission receipt、本地completed。 | 原 attempt 已failed不能强改为running；由Website当前合法grant决定接回，零重发。网站500或无grant只报告动态证据未闭合，不伪造成功、不人工删单、不修改网站。 |

V1—V8是施工后的离线功能分母，V9是真实结果终点；新实现的验证只认当前候选实际工具原件和唯一原生质量报告。第2节旧代码leaf注入及Chrome事实不能替代新候选验证，也不能替代V9。没有本分支适用的新持久化或 Browser 恢复状态，故不新增 receipt、表、队列或恢复 Owner。

## 8. 原子施工单、纪律与顺序

共用前置：执行 Codex先重新读适用双仓权威及源头边界；本次不修改 Website但不得用 AGENT法案取得Website主权。只在本地主仓 main，逐一核目标 Git状态，保留无关改动。W0 对齐后，主Codex独立完成两遍规范自审，消除具体冲突后才进入代码；不以百分比分数代替它。各单分开报告真正重建/保留/局改/删除，不得混称全部重构。

### W0-B：Browser 施工图实现约束对齐

- 做什么/Owner/对象：`local-browser-session`，只改第4节指明的现有Browser Blueprint第43/86/90/99行所在生命周期、原命令诊断与revision绑定句。输入为第2节法案、当前候选及第6节目标；输出为退休正常Document handle、异常RemoteObject主因优先清理、允许唯一closed leaf stage、双端及旧版本拒绝与协议源同revision的同一现役施工图。
- 保留/不做：全部 active law、GPT/V6图、专业产品、WAL、两门、时钟、诊断五字段/原sequence关联均保留；不解冻、不生成新spec或施工图。
- 删除/重建/局改：删去被目标替代的实现限制，在上述原段局部修订；无生产文件删除、无第二图。施工图不是重新实现的源码骨架。
- 顺序/验收：先对照母本与Browser/GPT/Log现役法条两遍自审，逐句确认通用V2和专用v4未混淆、三个枚举外没有扩张；再交 WQ/W1/W2。失败停止于规范，不进入代码，不能由子智能体代做主审。

### W0-L：原日志事件stage范围对齐

- 做什么/Owner/对象：`runtime-log-spine`，仅局改`docs/blueprints/runtime-log-spine/RUNTIME-LOG-SPINE-V2-BLUEPRINT.md` §6原第122行的旧五stage限定，接收W0-B的同一closed stage集合。输出仍是原event code与browser-command typedIdentity。
- 保留/不做：唯一logger、原schema、单failure terminal、脱敏、WAL/ACK优先、command-handler去重原样保留。不改任何Log生产文件、spec、registry、协议、恢复或持久化字段。
- 删除/重建/局改：删除“仅旧五值”的实现限定，原位引用W1的唯一closed set及三个新值；无新图、文件删除或生产重建。
- 顺序/验收/失败：和W0-B共同先于代码，由主Codex两遍规范自审核同一stage与原事件边界；V6原日志readback消费该现役范围。任一图仍限定旧值则停在源头，不进W1/W2；没有自动回退或另写日志通道。

### WQ：原质检合同承接

- 做什么/Owner/对象：Browser质检Owner，使用第5节精确列出的9个现有acceptance/fixture/inspector路径，保护V1—V8。需求是能区分现已复现的错误实现，不能仅测试新字段存在。
- 保留/不做：原真实注入函数求值、长页几何、身份/两门保护、原 AEAD/receipt/ACK与规则反例；不新增检查器、runner、日志Schema或固定样本指标。
- 删除/重建/局改：先将无业务证明力的release次数/API断言列为删除；完整删除498行`local-browser-exact-assistant-turn-support.ts`，即时读回路径缺席，再从V1/V2/V4/V5合同独立重建同路径；直接使用预先裁决保留的`local-browser-dom-function-fixture.ts`原件和局改后的唯一`local-browser-dom-runtime-fixture.ts`。不恢复旧materializing CDP stub，原物化状态只作为同fixture输入。其它八个明确路径局改，opaque检查只同步第6节已裁决的预期调用，其它media精确结构保留。
- 怎样施工/承载：W0后先完成质检存在性裁决及新错误反例，再与W1/W2同步形成一个候选，不向运行服务加载半成品。原 exact support不能增量堆至500行以上；减少专属stub与API断言后同路径重建，每函数≤75行、10await及其余第9节红线，不靠空行压缩或再拆转发文件。
- 怎样验收/失败：原生Browser相关Exam真实调用生产helper/reader，旧错误实现在反例下失败、新实现成功；inspection mutant必须拒绝去掉任一身份guard/原子采集或重新加入release覆盖。纪律用删除后即时命令输出、重建来源与最终import核验；没有过程证据须报告无法核实，功能失败停同候选，不移除保护凑通过。

### W1：原命令封闭失败合同

- 做什么/Owner/对象：Browser，局改 `protocol/browser-errors.json`、`browser-protocol.schema.json`、`transport/browser-authority-diagnostic.ts`、`chrome-extension/extension-command-runtime.ts`；完整删除后重建29行 `websocket-command-diagnostic.ts`。只增加第6节两个code、三个stage，输出仍为原DIAGNOSTIC和原五字段REPLY。
- 保留/不做：parser其余字段、intent/nativeCause枚举、原AEAD/closed shape、sender finally、slot、sequence/token/permit匹配、WAL与ACK、当前Actor/logger原件直接复用；不把原始Chrome文本跨线，不修改恢复Owner或任务状态。
- 删除/重建/局改：删除producer旧重复stage type，缺席后按当前wire合同重建同路径。stage的唯一常量及类型由现parser模块提供，producer和私有read helper直接消费，不公开CONTROLLED_VALUES object bag。原诊断通道不删除；没有第二event/store。JSON及接收引用是局改；generated仅运行唯一生成器，不手改。
- 顺序/验收：W0/WQ裁决后先统一closed set和目录，再依第6节读取typed leaf failure，仅registered-command可细化。V6经真实producer/Node接收/Actor日志确认原因与stage保留且无错配，V8重生成并验同一源；mutation preflight失败必须有原零输入回执、可信fact正常结算。设计不允许新诊断构造二次抛错阻断原REPLY。
- 失败处理：任何新code未登记、enum来源重复、回执/ACK次序漂移都停同候选。无自动回退、旧协议并存或raw字符串兼容；仍使用原槽交付旧终态。

### W2：唯一 pinned Document by-value 读取

- 做什么/Owner/对象：Browser，完整删除`dom-exact-assistant-turn.ts`；删除`gpt-rate-limit-dialog.ts#observeKnownGptRateLimitDialog`原函数片区；即时核路径/符号缺席后，依据第6节合同重建，新增唯一`dom-fixed-document-read.ts`供这两处消费。仅局改同文件ack/clearance的guard参数传递和`extension-target-authority.ts#executeRegisteredCommandCycle`的preflight调用；不得用no-op回调填参数。输出保持专用v4与preflight v2原shape/hash。
- 保留/不做：第3节全部仍适用不变量与 `dom-semantic-text.ts` 原件直接使用；rate-limit文件中detector、exactCall hash、ack、clearance、envelope独立职责预先裁决留在原文件，不搬家、不复制。Browser typed intent/permit、guard、WAL、队列与计时器均不修改；没有额外DOM入口或读取重试。
- 删除对象：exact文件中的旧Document root node/resolve/remote object/release/primaryFailure骨架及专用读的错误混并；preflight函数相同资源链；专属调用随删除退役。调用缺席检查限定这两个片区，不误删真实node动作仍需的其他reader；新helper仅第6节第7项失败时可能返回的RemoteObject承担一次性必要清理，不恢复成功路径的旧finally骨架。
- 新链/承载：以固定源码调用期by-value和 pinned loader守卫重新推导marker物化与最终原子回答，保持全部已验收两门输入。marker每次采样先查、零命中才按实时容器滚；全扫描await join，最终样本重新核marker/邻接，不能拼两次DOM；typeddecoder放helper同一错误边界。private stage不持久化；新helper与两现文件都守第9节红线。
- 怎样施工：先写合同推导和独立新实现结构于当前任务，再真实delete→即时缺席readback→从该合同新建。禁止“读旧源码后修改字符串、delete再写回”，禁止临时/内存副本、Git恢复旧骨架、改名/壳/兼容fallback。旧代码只用于前期理解，不是重建模板。既有模块复用仅限上述删除前明确保留对象。
- 怎样验收：V1—V7覆盖两个consumer与全部实际preflight入口；断言两个consumer不再调用DOM.resolveNode或自行release，正常by-value成功不受release stub影响；新helper失败分支按V3精确收束响应中的引用，主因不被清理覆盖；pinned loader改变即拒绝，旧known错误不被通用code覆盖。功能证据与物理删除过程分别保留在原任务工具记录，无新台账。失败停受影响片区，保原WAL/结果；未经授权不恢复基线，不将回退冒充重建。

施工顺序：W0-B/W0-L＋主规范两审 → WQ存在性/反例裁决 → W1、W2和WQ在同一离线候选顺序完成（仅主Codex写）→ 主Codex两遍实际建设自审 → 按现 `$subagent-review` 独立只读审查实际建设与方案差异，未放行不交付 → 原生CHANGE。若授权同时要求完整CI-FULL，再按冻结 `$ci-full-governance` 走提交首推、clean commit完整READY与再次推送；不自行启动RELEASE。重要接口审查可插在W1合同闭合后，子智能体只审查，不能并发写代码。

## 9. 原生质量、切换与最终汇报

结构来源为基础Code Purity001-V6：文件500物理行，函数75行/7参数/8返回/5嵌套/16复杂度/10await，import declaration28/source24、命名export24。当前 exact文件430行，主export53行9await；rate-limit286行，observe44行5await；command runtime139行、原reply函数54行；inspector436行，exact support498行。W2删除句柄骨架并由两个真实consumer共用短helper，先消减再建设；不得把可预见预算问题留给质检后补拆。嵌套函数的await不得用外层总计误报，最终按原AST规则核。

唯一质量入口仍是 `npm run quality:check -- CHANGE|READY|RELEASE`；普通验证选用package现役Browser/GPT相关验收，只证明实际执行范围。设计阶段不跑生产Dynamic Proof、不编造PASS。方案只有文档差异时核Git范围、引用和内容，不为方案触发高负载READY。

未来加载新代码前，读回仍在途command/handler/单槽：先停止新claim，按原停止链等待真实handler退出，可信terminal先走原commit/ACK；无法排空则停止切换，不清槽、不把unknown伪成no。原CLI启动构建当前governed artifact，双端唯一revision12＋releaseBuildId一致、旧worker真实退出和新鉴权成立后才接新动作；不单端热替换，不保留revision11fallback，不新增迁移表。既有WAL无需迁移；已confirmed的旧effect保持原读回资格。半成品候选不进入服务。失败继续保全原事实，若要回退须取得对明确基线的授权，不能借Git恢复伪称重建。

V9只在授权真实运行取证后执行：精确原task/attempt/revision、effect与当前已加载build身份贯穿页面→artifact→完整结果事务→Outbox→Website receipt→local completed。若没有现役Website grant或网站不可达，如实记录哪一段尚缺；本方案不授权网站施工、强改attempt或重新提交。修复后的业务成功必须另外取得这份readback。

最终必须逐项报告：真正重建（W2 exact文件与读取片区、W1诊断producer、WQ exact验收）、经论证保留的原模块与前轮不变量、局部修改的施工图/协议/消费者/其它验收、物理删除的旧句柄骨架与专属断言、失败回退或尚未完成。纪律违规写“未满足重构要求”；缺即时删除过程写“无法核实重构纪律”。即使READY通过，也不能以质量结果替代该事实核验。
