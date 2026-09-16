# GPT 能力组 V55 施工图

```blueprint-record
{"schemaVersion":1,"blueprintId":"gpt-capability-group-v55","status":"active","owner":"gpt","lawIds":["LAW-GPT-001-V55","LAW-GPT-002-V17"],"contractRefs":[],"dependencyEdges":[{"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"capability-governance","repo":"local"}},{"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"forensics-persistence-capability","repo":"local"}},{"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}}],"prohibitedDependencyEdges":[]}
```

## 唯一 Owner 与职责

GPT 只把 Product 已决定的当前 Provider turn 变成 typed result，不拥有跨任务 Provider conversation、continuation identity、predecessor、frontier 或持久状态。Product 决定 Prompt、模型、附件、步骤和结果组装；Website Bazi sender 提供已入库且精确绑定的父报告材料，Website为文章本地化和固定catalog签发各自封闭的严格direct parent；Browser决定Target、current Document、FIFO、现实副作用和唯一WAL持久fact；Forensics保存回答artifact；Runtime运输结果；Website唯一裁决业务恢复与完成。

文本主链固定为：

```text
BZ05/BZ03/BZ04: fresh prepare/attach/write
  -> submit_exact_gpt_turn_once -> checkpoint_gpt_text_response

BZ03/BZ04 的本轮附件必须包含 Website 已入库、与 consultation root 及 direct predecessor 精确绑定的完整父报告；不得读取或选择历史 Provider conversation。

SEO article localization: Website route relation=provider_continuation
  -> zh-HK parent = 同一文章已领域接纳的 zh-CN produce_article job
  -> zh-TW/en-US/ja-JP/ko-KR parent = 同一文章严格前序 locale job
  -> Runtime 机械验证 parent result ref/hash，并携带父任务最终 accepted attempt
  -> 文章生成与五语翻译统一使用 article_synthesis product step
  -> Browser 从 exact parent job + accepted attempt + article_synthesis 的唯一 CONFIRMED WAL effect 取 canonical URL
  -> 为当前 job 建立独占 Target并精确导航
  -> 当前 translation turn submit/checkpoint

Static catalog localization: Website route relation=provider_continuation
  -> zh-HK 链首无 parent 并 fresh
  -> zh-TW/en-US/ja-JP/ko-KR parent = 同一 source/version/hash、policy、authorization、有序 message-id cohort 与 role 的严格前序 locale task
  -> Browser 只按 exact parent job + 当前 locale-neutral product step + 固定 submit call/Child 取唯一 CONFIRMED canonical URL
  -> 当前 locale turn submit/checkpoint；五个 locale task/result/admission 仍各自独立
```

这条链不把父回答作为翻译源：五次翻译始终消费Website下发的同一份zh-CN canonical article material。GPT只消费Runtime已机械验证的route-authorized parent job与最终accepted attempt，并在当前Product调用给出`article_synthesis` step后整体交给Browser acquisition；不接触父URL、父Target、父userTurnId或父回答。任何父结果绑定缺失或不等、父attempt缺失、WAL缺失/多义/未决都在Provider输入前失败关闭。

`submit_exact_gpt_turn_once` 在自己的直接后置一次返回 CONFIRMED、canonical conversation URL、精确 user turn 身份和 Browser effect receipt。provider_effect_identity 不含 attempt/process/lease/fence/Target/Document；Browser WAL 已有 CONFIRMED 时该 Child 只读回同一 receipt/URL，绝不再次输入。`checkpoint_gpt_text_response` 正常轮询保留 exact job 与其独占 system Target 的双向唯一绑定，但 pending 立即释放 Browser lease 与唯一物理 lane。GPT Child 只计算下一次 observation 的最早资格时间并立即调用现役 Browser typed 入口，不创建或等待 timer；请求进入唯一 FIFO 后，由 BrowserLaneCoordinator 以 waiter `eligibleAt`、一个全局 `observationNotBefore` 和一个 wake timer 作为唯一计时 Owner。具备资格后只取得并激活精确绑定 Tab、重验实时 current Document、fresh observe 一次；pending 再释放，正常轮询 `Page.navigate=0`。ready 时由同一 coherent observation 一次取得紧邻 assistant turn 的 observed DOM + semantic text，写入且读回一份 artifact。同一 attempt、exact call 的该 artifact 已存在且完整性成立时，必须先按现役 idempotency identity 精确读回并直接返回，Browser 页面 observation 增量为零；仅 artifact 不存在时才允许首次观察并 append，已存在但内容或完整性不成立时 typed fail-close，绝不覆盖。

每个 Production GPT Child 的既有 ChatGPT 逻辑访问必须先消费 Browser 同一 coherent cycle 返回的 known-rate-limit blocker。Browser 精确识别唯一 `role=dialog`、标题“请求过于频繁”、两段冻结正文和唯一启用且可交互的“明白了”按钮时，原 Child 本次物理输入为零；`ProductionGptChildTools` 不把 blocker 交给 Product Flow，而是先调用 Runtime 注入的唯一 `ProviderRateLimitControlPort`，用现役 Outbox 持久关闭无关新 claim/submit，再执行唯一 Product 不可见的 `acknowledge_known_gpt_rate_limit` 内部 Child。该 Child 在当前logical cycle后优先取得同一lane的下一周期，只对刚取得的同 Target/Document/fact revalidate并点击一次，分类完成到 dispatch 的受控 SLO使用原始`observed_at+1s`截止点；点击后仍等待至少2.5秒做fresh absent readback。若进程恢复时dialog已精确不存在，则以零点击absent receipt闭合；若点击/重验失败，则必须先按同一incident把`not_cleared`送达Website并保持本地submit门关闭，后续仍只按同一WAL identity读回，不重复点击。若同一ack WAL已经是`REJECTED`或`DISPATCHED`等不可复写终态，恢复只能沿同一Browser lane执行普通1.5秒节流的`readKnownGptRateLimitClearance`只读意图；它不进入mutation WAL、不执行物理输入，只有同Target/Document复核为精确absent才生成认证browser fact并沿原incident交付`confirmed_absent`，仍存在、文案mismatch或身份漂移均保持`not_cleared`。原 submit 已发生的 job 继续同 effect checkpoint、Outbox 和 Website admission，未发生 submit 的 job 等 Website 冷却后对同 job的新 attempt授权。旧 `web/children/rate-limit-dialog.ts` 与 Product 可调用确认能力继续物理不存在。

协调 Owner 固定为调用 GPT facade 的 Runtime。Runtime 通过构造注入的唯一窄 `ProviderRateLimitControlPort` 先持久关门；`ProductionGptChildTools` 只回调该端口，不 import Runtime 私有模块。该控制反转仍是现役 `agent-production-runtime -> gpt` 依赖，不形成 `gpt -> agent-production-runtime` 反向 dependency edge或环。

除上述 detection→ack 唯一紧急对外动作外，所有 ChatGPT 普通逻辑访问跨 job、Tab、Product 共用 Browser 一个账号级至少 1.5 秒起始节拍；50ms、25—250ms 和 deadline 尾部不足 1.5 秒的重读物理退出。一次 coherent observation 内的 CDP primitives不拆分计时，更长的2.5秒动作读回、40秒提交静默和Browser每轮一次抽取的70—90秒全局Provider observation间隔继续优先。GPT Child只提交至少70秒的typed资格请求，不保存随机值、第二timer或每Child节拍。

GPT 准备动作对一次 fresh coherent observation 的裁决统一为 `STABLE_DONE|STABLE_ACT|TRANSIENT_DOM|HARD_FAIL`。正常 DONE/ACT 立即继续，零新增等待；只有候选当次缺席、节点 stale、`NO_LAYOUT_BOX` 或无矛盾 partial topology 可判为 `TRANSIENT_DOM`，并通过 Browser 唯一 typed stage 依次等待 1.5 秒、3 秒后各做一次整包 fresh 只读复核。任一复核恢复即继续；任一复核出现多候选、文案/模型/推理强度/Prompt/附件/URL/授权/Target/Document/effect mismatch 即立即失败；第三次仍 transient 才以最后 observation 正式失败。该协议只覆盖 `prepare_clean_gpt_chat`、profile/model/reasoning、attachment control/file input、Composer 准备以及非冻结普通动作的直接 DOM 后置证明；每次复核不点击、不输入、不上传、不导航、不换 Tab，动作已经发生后也绝不重放。submit 的现役 5 秒 actionability、rename 的 10 秒四输入协议、附件 uploading、Provider generating、70—90 秒回答观察、限流确认、Tab/导航/授权/WAL/recovery 均不得叠加该 stage。

`FROZEN-GPT-RESPONSE-NO-PROMPT-REHASH-001` 固定：提示词 hash 只属于发送 Child 的发送前内容身份和发送后新 user turn 证明。文本与图片回答读取 Child 不得接收 `expectedPromptHash`，不得从已折叠或重新渲染的历史 user message DOM 提取、规范化、重算或比较 `precedingPromptHash`，也不得把该二次 hash 写入回答或图片 receipt。回答身份只由发送 Child 已确认的 canonical conversation URL、精确 `userTurnId`、其真实紧邻 assistant turn，以及 Browser 当前 Target/Document/revision 共同确定；回答的 `rawDomHash`、`semanticTextHash` 与图片媒体 bytes hash 继续保留。改变或删除本冻结边界，必须由用户在未来任务中明确解冻，并同步替换施工图、实现与唯一质检；普通修复或 CI 授权不构成解冻。

`FROZEN-GPT-IMAGE-SOURCE-EVENT-WAIT-001` 已按本次授权解冻替换并重新冻结：图片 checkpoint 不得按 fixed sleep 猜测图片已经生成。Browser authenticated-media observation 必须在 canonical conversation URL 与精确 `userTurnId` 之后、下一个 user turn 之前的范围内先直接检查非空 `currentSrc/src`；尚未出现时，只能在同一次调用期 observation 内以一个 `MutationObserver` 监听节点加入及 `src/srcset` 变化，单次最多等待 5000ms，出现即在同一次已登录页面调用中 fetch 原始 bytes 并按内容 hash 去重。单次期满仍无 source 只返回现有 typed pending并释放 lease/lane；下一次请求经唯一 FIFO、唯一全局 observation 节拍取得并激活该 job精确绑定 Tab后 fresh observe，正常轮询不得导航，总期限只复用现有 `probeBudgetMs`。不得等待 assistant role、预览/分享/下载控件、`img[alt]`、图片完成标志、布局、可见性、宽高或固定 turn 编号；不得新增 wait Child、per-job timer、队列、WAL、状态机或下载链。未来改变仍须用户明确解冻并同步替换 GPT/Browser 法案、施工图、实现与唯一质检。

`FROZEN-GPT-SUBMIT-TWO-PRECONDITIONS-001` 固定真正 submit 前只能确认两件事。第一，当前 Composer 提示词 hash 与 Product 批准值相等，当前附件集合按 `FROZEN-GPT-ATTACHMENT-PROVIDER-DUPLICATE-SUFFIX-001` 与批准集合相等。第二，Browser 当前 Target/Document/fence 有效，且唯一 WAL 证明同一 provider effect 尚未发生现实输入。历史聊天、既有 user turn、固定 turn 编号或奇偶、按钮标签以及 Browser 内部可操作性检查均不得成为新增业务前置关卡，也不得在点击前读取历史 turn 来决定发送资格。点击后等待 2500ms，再从 fresh current Document 只取最大有效序号的 user turn，确认其 prompt hash 等于批准值且 Composer 已清空；这是发送后的直接证明，不是第三个前置条件。改变或删除本冻结边界，必须由用户在未来任务中明确解冻，并同步替换施工图、实现与唯一质检；普通修复或 CI 授权不构成解冻。

`FROZEN-GPT-ATTACHMENT-PROVIDER-DUPLICATE-SUFFIX-001` 固定：Product 批准附件集合是唯一语义权威并允许为空。非空时，每个 Provider 可见名称先做 NFC，再让精确批准名称优先；只有精确未命中时，才允许删除最后扩展名前、无扩展名则文件名末尾恰好一个无空格 `(<纯十进制数字>)`，且删除后必须精确命中批准名称，才视为同一附件。GPT 的上传后附件对账与 Browser 的最终 submit guard 必须使用这一条语义；附件数量、基础名、扩展名、非数字括号、空格括号和其它改名仍失败关闭。不得出现 substring、模糊匹配、宽正则、第二附件身份、兼容分支或因 Provider 后缀误判而重传。改变、删除、改名、弱化、扩张或绕过本边界，只有用户明确原文“解冻 FROZEN-GPT-ATTACHMENT-PROVIDER-DUPLICATE-SUFFIX-001”并同步替换现役法案、GPT/Browser 施工图、实现与唯一质检后才允许；普通修复、代码迭代、CI 授权、Provider UI 变化或单仓变更均不构成解冻。

`FROZEN-GPT-SUBMIT-ACTIONABILITY-WAIT-001` 固定：上述两项前置事实已经成立后，发送按钮暂时 `disabled/aria-disabled` 只表示 Browser 页面尚未就绪，不得由 GPT 立即裁成业务失败。Browser 必须在同一次 submit 原子调用和现有 5000ms 有界期限内等待同一精确按钮恢复可操作，恢复后只点击一次；期满仍不可操作则返回原生 typed no-mutation、`physical_input_count=0`。该等待不读取历史聊天、不新增第三前置条件、Child、timer Owner、队列、WAL、状态或重试链。

`FROZEN-GPT-MODEL-SELECTOR-SEMANTIC-MINIMUM-001` 固定：打开模型选择器只证明精确批准的 `modelDisplayName` 选项已出现。目标选项已经出现时零点击完成；否则只允许点击唯一“选择模型”入口一次，并在现有有界后置读取中等待该目标选项出现。随后选择 Child 只允许点击该唯一精确选项，并由同次 Browser mutation 对保留的被点击节点直接证明 `aria-checked=true`；菜单关闭只以该精确选项不再出现在当前可选集合中证明。popup、simple/advanced panel、`data-active`、`inert`、旧面板形态及其它菜单外壳拓扑不得成为准入或后置条件；失败只报告目标选项缺失、多义、入口不可用、选项未选中或菜单未关闭的原生 typed fact。Browser 对被点击入口和选项的唯一性、可操作性继续属于物理输入内部机械安全，不得被删除，也不得升级为 Product/GPT 的菜单拓扑关卡。

`FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001` 已按本次明确解冻替换并重新冻结：fresh/profile/model/menu/附件/Composer 都是 attempt + current Document 范围内的 target-local 准备，同一 job 的新 attempt 必须重做，批准附件集合可以是空；只有 `submit_exact_gpt_turn_once` 是跨 attempt 的 provider effect。唯一身份固定为 `job_id + result_revision + product_step_id + call_id + child_id + request_hash + payload_hash`，Product Plugin 名称、版本、Skill hash、attempt 与 Browser 私有身份均不得进入。同一 result revision 的 submit request hash 绑定 `result_revision + Child input hash`，仅换 attempt或 AGENT 内部实现不变，更换 Website 已授权的 result revision 才变化。任何 Product 在准备前先查询该精确 submit effect；WAL 已 CONFIRMED 时直接零输入读回；WAL 为同 accepted attempt 的唯一 DISPATCHED 时只取得 `bound-observation` lease，fresh DOM 精确命中同 prompt hash、唯一 user turn、空 Composer 与 canonical conversation URL后，由 submit Child调用现役 Browser resolver把同一行原位结算为 `CONFIRMED + confirmed`并以新 authority hash返回，未命中保持DISPATCHED且返回`PROVIDER_EFFECT_OUTCOME_UNPROVEN`；未命中任何WAL才准备并提交。`REJECTED + mutation_outcome=no + physical_input_count=0` 明确不消耗 effect，只有 Website 新 attempt 可在同一 WAL/effect identity 下重新准备；DISPATCHED 或任何已发生/不明现实输入仍禁止重发。不得把旧 attempt 的附件上传、草稿或页面状态当作新 attempt 的成功事实。

`FROZEN-GPT-ATOMIC-IDENTITY-ROUNDTRIP-001` 固定同一次 Browser 原子调用只能由 GPT production boundary 构造一份不可变 `BrowserAtomicStepIdentity`，并把该同一身份用于 WAL 查询、`runAtomicStep`、Child 成功终态回读与 Child 失败事实回读；跨进程 confirmed submit readback 也只能复用这一 canonical 构造。Child 不得再以原始 `intent.inputHash` 手工拼接第二份 WAL 查询身份，测试 Browser 必须按传入身份精确命中，禁止无视身份返回任意 recovery。否则 Browser 已 CONFIRMED 的现实发送会被 GPT 错判为未发生。改变或删除本冻结边界，必须由用户在未来任务中明确解冻，并同步替换施工图、实现与唯一质检；普通修复或 CI 授权不构成解冻。

跨 lease 的实现细节固定由现役 production Browser call facade 持有上述唯一原子身份：一次 Child 调用开始时登记 identity，pending park 后重新取得物理 lease 时，对新 lease 上的每个 Browser command 重新进入同一 `runAtomicStep(identity)`，Child 终态后清除。物理 lease 自身的临时 `atomicStep` 不得成为跨 lease 身份 Owner；不得为此新增 identity store、恢复对象、队列、兼容 wrapper 或第二调用链。文本与图片等待都必须证明重新取得 lease 后的失败事实仍归属原 Child；只有该 Child 已声明的 typed pending 可继续等待，其它 Browser 失败保持原生阻断。

`FROZEN-GPT-CONVERSATION-LOCATOR-EFFECT-SEPARATION-001` 已按本次授权精准解冻替换并重新冻结：canonical conversation URL 是真实恢复现场“去哪里读”的唯一权威，provider_effect_identity 是“是否已经发送”的唯一权威，二者绝不合并或互相授予权限。正常轮询只使用 job 的进程内独占 Target 绑定，pending 释放 lease/lane，下一次经唯一 FIFO激活精确 Tab并 fresh observe一次，不读取 WAL locator、不重选 URL、不导航。只有进程重启、绑定 Target 真正丢失或同等恢复现场，Website 对 DISPATCHED/CONFIRMED effect 重新授权后，才可先从 Browser WAL 精确读回同一 receipt、URL 与 userTurnId，再以 `confirmed-readback` 为该 job取得精确 system Target；当前 URL 已命中时零导航，否则只执行一次 Browser-owned `Page.navigate`，经过 2500ms 总闸门后 fresh readback 必须相等，physical submit 增量为零。侧栏、标题/顺序/时间猜测、搜索、滚动、自动展开、重试与 fallback 均不得参与。

`FROZEN-EXACT-TARGET-POLL-RESULT-REVISION-001` 已按本次授权精准解冻替换并重新冻结：submit 已确认后的正常 Provider 回答轮询保留 job—system Target 独占绑定；40 秒静默后第一次及后续observation都先释放当前lease并立即进入唯一 FIFO，GPT只给出至少70秒的最早资格，BrowserLaneCoordinator作为唯一计时 Owner在每次真实observation终结时只抽取一次70—90秒全局间隔；随机值不按job、Tab、Product或Child生成和保存，全设备相邻真实Provider observation至少70秒且总频率不随N增长，剩余deadline不足70秒时Browser acquisition增量为零。请求具备资格后取得并激活精确绑定 Tab、重验 current Document、fresh observe一次；pending释放 lease/lane并重新排队，正常轮询不得重选 canonical URL或导航。只有进程重启、绑定 Target真正丢失或同等恢复现场，才先查同一 Browser WAL effect，再用 `confirmed-readback` 为该 job取得精确 system Target；绝不先回首页，同 URL零导航，不同 URL最多一次精确 `Page.navigate`后 fresh readback。Browser WAL 的 `logical_mutation_id` 是唯一 `provider_effect_identity_hash`，checkpoint稳定后另以 `semanticTextHash` 或媒体 `sha256` 标识结果；只有 Website可拒绝 settled result并签发新 `result_revision`。普通错误、DISPATCHED/CONFIRMED、进程/attempt/lease/fence/Target/Document变化都不得制造第二 submit。

八字 consultation root 与 direct predecessor 只属于 Website 业务关系。Website 在新任务签发前验证 owner/person/chart/root/predecessor、父授权、父 Delivery Manifest 与已入库父结果，并把完整父报告作为本轮 locked-fact material 下发；缺失、多义或身份不等一律 fail closed。八字仍逐任务fresh。SEO文章与固定catalog本地化的provider_continuation同样只属于Website业务关系；Runtime只用本地completed父结果机械核对Website parent ref/hash并携带最终accepted attempt，GPT不复制或解释父子关系，Browser只按当前授权从父job、该accepted attempt与当前product step的唯一WAL瞬时读取canonical URL，不保存业务continuation。

动态本地化 Product 的现役单次提示词必须把 Website 下发的 locale policy 转成一份穷尽式自检清单：所有可翻译 JSON pointer 均使用目标语言，所有 safety pointer 在完成翻译的同时保留原义与约束，所有 protected pointer 保持逐值不变，并在只输出一个完整 JSON object 前逐项自检。该清单只提高首次 Provider 输出通过唯一 Website 领域 validator 的概率，不在 AGENT 增设语义 validator、第二 GPT 回合、修复提示或兼容结果路径。

## 删除边界

以下对象必须物理不存在：private base、reusable/derived reservation、semantic read grant、fork、child conversation、GPT Session Controller、continuation identity/store/row/frontier/CAS、独立 submission locator、document transition policy、恢复型 park、取消后自发重跑和通用旧 attempt recovery。只保留submit Child内对同一provider effect的confirmed receipt readback，以及Browser按Website provider_continuation从exact parent job、最终accepted attempt与当前product step唯一CONFIRMED WAL effect读取canonical URL的产品中性Target acquisition；不得用兼容wrapper、alias、feature flag、dual-read/write、第二lane/store/scheduler或状态机扩张。

## Browser 边界

GPT 只消费 Browser 签发的实时 current Document 和 typed command terminal。Browser 的 Target lease 对外暴露的 `document` 必须是 live getter；包装它时不得用 spread 把 getter 求值成旧快照。Provider/控件 mutation 仍先经唯一 FIFO、每 provider effect 一条权威 WAL、跨 attempt/进程至多一次 physical dispatch 和 2500ms 后的 fresh postcondition；Browser-owned canonical URL 导航只做可逆页面生命周期收敛，当前命中零导航，否则唯一一次精确 Page.navigate 后同样经过 2500ms 与 fresh currentUrl readback，但不取得 Provider effect 或第二 WAL。纯读结果不新建 WAL、队列或第二恢复权限。

## Settled conversation 标题清理

`rename_settled_gpt_conversation` 是唯一内部 cleanup Child。它只在 active call 已同时绑定 confirmed Provider effect 与 settled result hash后，于该 conversation 因 session 切换或 Product 终结而进入原 lifecycle park 前由 lifecycle 原子取走一次；取走后即使预算跳过、Child/park/后续 Product 失败或 finally 重入也不得再次尝试。Product GPT facade 明确排除该 Child，任何 `src/plugins/**` flow 调用数必须为零。Child 从当前 task 的 `jobId + productId` 与 confirmed effect `terminalAt` 唯一投影 `MMDD·项目短名·aiprod_<UUID首段八位>`，其中日期按 `Asia/Dubai`，14 个现役 product_id 必须穷尽且无 fallback。

Child 只向 Browser 发出一个封闭四字段 `renameExactGptConversation` typed intent，由 Browser 在同一 current lease、同一 WAL command 与不可穿插原子调用内机械执行零或四个物理输入并 fresh readback。预算固定为10秒；菜单、菜单项、fill、Enter四个逻辑访问各自在开始前复用账号级至少1.5秒门，最后输入后再满足2.5秒读回门。deadline/channel 状态在每个下一物理输入前重验；deadline 后的 terminal grace 必须返回已发生的 1..4 累计 receipt，socket 真正失联的 missing reply 才以 unknown 0 终结。extension socket-close 已释放 current target时，原 park 仍执行一次本地 lane 收口但不得让必然的 liveness error 覆盖 Product 结果。标题是非权威显示索引，禁止参与 Target/conversation 选择、提交、恢复、重试、result revision、Product result、Outbox 或 Website admission。任何 invalid、missing、ambiguous、stale、timeout、transport unknown、预算不足、proof/log failure 都只以 `impact=CLEANUP` 终结；不得增加历史回扫、持久重试、queue、table、worker、ledger、fallback、兼容桥或第二 Browser lane。

## 证据、失败与验收

可持久化的必要事实只有回答 artifact，以及 Browser WAL 同一 provider-effect 行中的 confirmed effect 与加密 locator。两者分别证明回答内容和同一物理副作用/页面 locator；GPT 不保存跨任务会话状态，Browser 不保存 Website direct predecessor，日志只保存脱敏 ref/hash，Website 不接收 Provider locator。

验收必须证明：同一 effect 最多一次物理 dispatch；CONFIRMED 后重启只读回；BZ05/BZ03/BZ04 每个业务任务都 fresh/submit/checkpoint 各一次；BZ03/BZ04 本轮材料携带 Website 已验真的完整父报告；同一SEO文章的zh-CN生成与五个翻译job按严格direct parent、父结果ref/hash、最终accepted attempt与`article_synthesis`全部进入同一canonical conversation URL；同一固定catalog cohort-role的五个locale task也按严格direct parent进入同一URL，只有zh-HK链首fresh。两类任务都保持每job独占Target并各自submit/checkpoint，交换parent、attempt或product step必须在Provider submit前失败且输入增量为零；continuation API/controller/store/frontier/CAS、private base/reservation/fork/第二lane为零；最终`Product result -> Runtime Outbox -> Website admission receipt`才是完成。
