# GPT 能力组 V47 施工图

```blueprint-record
{"schemaVersion":1,"blueprintId":"gpt-capability-group-v47","status":"active","owner":"gpt","lawIds":["LAW-GPT-001-V50","LAW-GPT-002-V11"],"contractRefs":[],"dependencyEdges":[{"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"capability-governance","repo":"local"}},{"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"forensics-persistence-capability","repo":"local"}},{"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}}],"prohibitedDependencyEdges":[]}
```

## 唯一 Owner 与职责

GPT 只把 Product 已决定的当前 Provider turn 变成 typed result，不拥有跨任务 Provider conversation、continuation identity、predecessor、frontier 或持久状态。Product 决定 Prompt、模型、附件、步骤和结果组装；Website Bazi sender 提供已入库且精确绑定的父报告材料；Browser 决定 Target、current Document、FIFO、现实副作用和唯一 WAL 持久 fact；Forensics 保存回答 artifact；Runtime 运输结果；Website 唯一裁决业务恢复与完成。

文本主链固定为：

```text
BZ05/BZ03/BZ04: fresh prepare/attach/write
  -> submit_exact_gpt_turn_once -> checkpoint_gpt_text_response

BZ03/BZ04 的本轮附件必须包含 Website 已入库、与 consultation root 及 direct predecessor 精确绑定的完整父报告；不得读取或选择历史 Provider conversation。
```

`submit_exact_gpt_turn_once` 在自己的直接后置一次返回 CONFIRMED、canonical conversation URL、精确 user turn 身份和 Browser effect receipt。provider_effect_identity 不含 attempt/process/lease/fence/Target/Document；Browser WAL 已有 CONFIRMED 时该 Child 只读回同一 receipt/URL，绝不再次输入。`checkpoint_gpt_text_response` 正常轮询保留 exact job 与其独占 system Target 的双向唯一绑定，但 pending 立即释放 Browser lease 与唯一物理 lane。GPT Child 只计算下一次 observation 的最早资格时间并立即调用现役 Browser typed 入口，不创建或等待 timer；请求进入唯一 FIFO 后，由 BrowserLaneCoordinator 以 waiter `eligibleAt`、一个全局 `observationNotBefore` 和一个 wake timer 作为唯一计时 Owner。具备资格后只取得并激活精确绑定 Tab、重验实时 current Document、fresh observe 一次；pending 再释放，正常轮询 `Page.navigate=0`。ready 时由同一 coherent observation 一次取得紧邻 assistant turn 的 observed DOM + semantic text，写入且读回一份 artifact。同一 attempt、exact call 的该 artifact 已存在且完整性成立时，必须先按现役 idempotency identity 精确读回并直接返回，Browser 页面 observation 增量为零；仅 artifact 不存在时才允许首次观察并 append，已存在但内容或完整性不成立时 typed fail-close，绝不覆盖。

`FROZEN-GPT-RESPONSE-NO-PROMPT-REHASH-001` 固定：提示词 hash 只属于发送 Child 的发送前内容身份和发送后新 user turn 证明。文本与图片回答读取 Child 不得接收 `expectedPromptHash`，不得从已折叠或重新渲染的历史 user message DOM 提取、规范化、重算或比较 `precedingPromptHash`，也不得把该二次 hash 写入回答或图片 receipt。回答身份只由发送 Child 已确认的 canonical conversation URL、精确 `userTurnId`、其真实紧邻 assistant turn，以及 Browser 当前 Target/Document/revision 共同确定；回答的 `rawDomHash`、`semanticTextHash` 与图片媒体 bytes hash 继续保留。改变或删除本冻结边界，必须由用户在未来任务中明确解冻，并同步替换施工图、实现与唯一质检；普通修复或 CI 授权不构成解冻。

`FROZEN-GPT-IMAGE-SOURCE-EVENT-WAIT-001` 已按本次授权解冻替换并重新冻结：图片 checkpoint 不得按 fixed sleep 猜测图片已经生成。Browser authenticated-media observation 必须在 canonical conversation URL 与精确 `userTurnId` 之后、下一个 user turn 之前的范围内先直接检查非空 `currentSrc/src`；尚未出现时，只能在同一次调用期 observation 内以一个 `MutationObserver` 监听节点加入及 `src/srcset` 变化，单次最多等待 5000ms，出现即在同一次已登录页面调用中 fetch 原始 bytes 并按内容 hash 去重。单次期满仍无 source 只返回现有 typed pending并释放 lease/lane；下一次请求经唯一 FIFO、唯一全局 observation 节拍取得并激活该 job精确绑定 Tab后 fresh observe，正常轮询不得导航，总期限只复用现有 `probeBudgetMs`。不得等待 assistant role、预览/分享/下载控件、`img[alt]`、图片完成标志、布局、可见性、宽高或固定 turn 编号；不得新增 wait Child、per-job timer、队列、WAL、状态机或下载链。未来改变仍须用户明确解冻并同步替换 GPT/Browser 法案、施工图、实现与唯一质检。

`FROZEN-GPT-SUBMIT-TWO-PRECONDITIONS-001` 固定真正 submit 前只能确认两件事。第一，当前 Composer 提示词 hash 与 Product 批准值相等，当前附件集合按 `FROZEN-GPT-ATTACHMENT-PROVIDER-DUPLICATE-SUFFIX-001` 与批准集合相等。第二，Browser 当前 Target/Document/fence 有效，且唯一 WAL 证明同一 provider effect 尚未发生现实输入。历史聊天、既有 user turn、固定 turn 编号或奇偶、按钮标签以及 Browser 内部可操作性检查均不得成为新增业务前置关卡，也不得在点击前读取历史 turn 来决定发送资格。点击后等待 2500ms，再从 fresh current Document 只取最大有效序号的 user turn，确认其 prompt hash 等于批准值且 Composer 已清空；这是发送后的直接证明，不是第三个前置条件。改变或删除本冻结边界，必须由用户在未来任务中明确解冻，并同步替换施工图、实现与唯一质检；普通修复或 CI 授权不构成解冻。

`FROZEN-GPT-ATTACHMENT-PROVIDER-DUPLICATE-SUFFIX-001` 固定：Product 批准附件集合是唯一语义权威并允许为空。非空时，每个 Provider 可见名称先做 NFC，再让精确批准名称优先；只有精确未命中时，才允许删除最后扩展名前、无扩展名则文件名末尾恰好一个无空格 `(<纯十进制数字>)`，且删除后必须精确命中批准名称，才视为同一附件。GPT 的上传后附件对账与 Browser 的最终 submit guard 必须使用这一条语义；附件数量、基础名、扩展名、非数字括号、空格括号和其它改名仍失败关闭。不得出现 substring、模糊匹配、宽正则、第二附件身份、兼容分支或因 Provider 后缀误判而重传。改变、删除、改名、弱化、扩张或绕过本边界，只有用户明确原文“解冻 FROZEN-GPT-ATTACHMENT-PROVIDER-DUPLICATE-SUFFIX-001”并同步替换现役法案、GPT/Browser 施工图、实现与唯一质检后才允许；普通修复、代码迭代、CI 授权、Provider UI 变化或单仓变更均不构成解冻。

`FROZEN-GPT-SUBMIT-ACTIONABILITY-WAIT-001` 固定：上述两项前置事实已经成立后，发送按钮暂时 `disabled/aria-disabled` 只表示 Browser 页面尚未就绪，不得由 GPT 立即裁成业务失败。Browser 必须在同一次 submit 原子调用和现有 5000ms 有界期限内等待同一精确按钮恢复可操作，恢复后只点击一次；期满仍不可操作则返回原生 typed no-mutation、`physical_input_count=0`。该等待不读取历史聊天、不新增第三前置条件、Child、timer Owner、队列、WAL、状态或重试链。

`FROZEN-GPT-MODEL-SELECTOR-SEMANTIC-MINIMUM-001` 固定：打开模型选择器只证明精确批准的 `modelDisplayName` 选项已出现。目标选项已经出现时零点击完成；否则只允许点击唯一“选择模型”入口一次，并在现有有界后置读取中等待该目标选项出现。随后选择 Child 只允许点击该唯一精确选项，并由同次 Browser mutation 对保留的被点击节点直接证明 `aria-checked=true`；菜单关闭只以该精确选项不再出现在当前可选集合中证明。popup、simple/advanced panel、`data-active`、`inert`、旧面板形态及其它菜单外壳拓扑不得成为准入或后置条件；失败只报告目标选项缺失、多义、入口不可用、选项未选中或菜单未关闭的原生 typed fact。Browser 对被点击入口和选项的唯一性、可操作性继续属于物理输入内部机械安全，不得被删除，也不得升级为 Product/GPT 的菜单拓扑关卡。

`FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001` 已按本次明确解冻替换并重新冻结：fresh/profile/model/menu/附件/Composer 都是 attempt + current Document 范围内的 target-local 准备，同一 job 的新 attempt 必须重做，批准附件集合可以是空；只有 `submit_exact_gpt_turn_once` 是跨 attempt 的 provider effect。唯一身份固定为 `job_id + result_revision + product_step_id + call_id + child_id + request_hash + payload_hash`，Product Plugin 名称、版本、Skill hash、attempt 与 Browser 私有身份均不得进入。同一 result revision 的 submit request hash 绑定 `result_revision + Child input hash`，仅换 attempt或 AGENT 内部实现不变，更换 Website 已授权的 result revision 才变化。任何 Product 在准备前先查询该精确 submit effect；WAL 已 CONFIRMED 时直接零输入读回，未命中才准备并提交。`REJECTED + mutation_outcome=no + physical_input_count=0` 明确不消耗 effect，只有 Website 新 attempt 可在同一 WAL/effect identity 下重新准备；DISPATCHED 或任何已发生/不明现实输入仍禁止重发。不得把旧 attempt 的附件上传、草稿或页面状态当作新 attempt 的成功事实。

`FROZEN-GPT-ATOMIC-IDENTITY-ROUNDTRIP-001` 固定同一次 Browser 原子调用只能由 GPT production boundary 构造一份不可变 `BrowserAtomicStepIdentity`，并把该同一身份用于 WAL 查询、`runAtomicStep`、Child 成功终态回读与 Child 失败事实回读；跨进程 confirmed submit readback 也只能复用这一 canonical 构造。Child 不得再以原始 `intent.inputHash` 手工拼接第二份 WAL 查询身份，测试 Browser 必须按传入身份精确命中，禁止无视身份返回任意 recovery。否则 Browser 已 CONFIRMED 的现实发送会被 GPT 错判为未发生。改变或删除本冻结边界，必须由用户在未来任务中明确解冻，并同步替换施工图、实现与唯一质检；普通修复或 CI 授权不构成解冻。

`FROZEN-GPT-CONVERSATION-LOCATOR-EFFECT-SEPARATION-001` 已按本次授权精准解冻替换并重新冻结：canonical conversation URL 是真实恢复现场“去哪里读”的唯一权威，provider_effect_identity 是“是否已经发送”的唯一权威，二者绝不合并或互相授予权限。正常轮询只使用 job 的进程内独占 Target 绑定，pending 释放 lease/lane，下一次经唯一 FIFO激活精确 Tab并 fresh observe一次，不读取 WAL locator、不重选 URL、不导航。只有进程重启、绑定 Target 真正丢失或同等恢复现场，Website 对 DISPATCHED/CONFIRMED effect 重新授权后，才可先从 Browser WAL 精确读回同一 receipt、URL 与 userTurnId，再以 `confirmed-readback` 为该 job取得精确 system Target；当前 URL 已命中时零导航，否则只执行一次 Browser-owned `Page.navigate`，经过 2500ms 总闸门后 fresh readback 必须相等，physical submit 增量为零。侧栏、标题/顺序/时间猜测、搜索、滚动、自动展开、重试与 fallback 均不得参与。

`FROZEN-EXACT-TARGET-POLL-RESULT-REVISION-001` 已按本次授权精准解冻替换并重新冻结：submit 已确认后的正常 Provider 回答轮询保留 job—system Target 独占绑定；40 秒静默后 observation 请求立即进入唯一 FIFO，BrowserLaneCoordinator是唯一计时 Owner并保证全设备相邻真实 Provider observation 至少 60 秒、总频率不随 N 增长。请求具备资格后取得并激活精确绑定 Tab、重验 current Document、fresh observe一次；pending释放 lease/lane并重新排队，正常轮询不得重选 canonical URL或导航。只有进程重启、绑定 Target真正丢失或同等恢复现场，才先查同一 Browser WAL effect，再用 `confirmed-readback` 为该 job取得精确 system Target；绝不先回首页，同 URL零导航，不同 URL最多一次精确 `Page.navigate`后 fresh readback。Browser WAL 的 `logical_mutation_id` 是唯一 `provider_effect_identity_hash`，checkpoint稳定后另以 `semanticTextHash` 或媒体 `sha256` 标识结果；只有 Website可拒绝 settled result并签发新 `result_revision`。普通错误、DISPATCHED/CONFIRMED、进程/attempt/lease/fence/Target/Document变化都不得制造第二 submit。

八字 consultation root 与 direct predecessor 只属于 Website 业务关系。Website 在新任务签发前验证 owner/person/chart/root/predecessor、父授权、父 Delivery Manifest 与已入库父结果，并把完整父报告作为本轮 locked-fact material 下发；缺失、多义或身份不等一律 fail closed。GPT、Browser、Runtime 不复制该父子关系，也不保存或查询跨任务 Provider continuation。

## 删除边界

以下对象必须物理不存在：private base、reusable/derived reservation、semantic read grant、fork、child conversation、跨任务 continuation API、GPT Session Controller、continuation identity/store/row/frontier/CAS、独立 submission locator、document transition policy、恢复型 park、取消后自发重跑和通用旧 attempt recovery。只保留 submit Child 内对同一 provider effect 的 confirmed receipt readback；不得用兼容 wrapper、alias、feature flag、dual-read/write、第二 lane/store/scheduler 或状态机扩张。

## Browser 边界

GPT 只消费 Browser 签发的实时 current Document 和 typed command terminal。Browser 的 Target lease 对外暴露的 `document` 必须是 live getter；包装它时不得用 spread 把 getter 求值成旧快照。Provider/控件 mutation 仍先经唯一 FIFO、每 provider effect 一条权威 WAL、跨 attempt/进程至多一次 physical dispatch 和 2500ms 后的 fresh postcondition；Browser-owned canonical URL 导航只做可逆页面生命周期收敛，当前命中零导航，否则唯一一次精确 Page.navigate 后同样经过 2500ms 与 fresh currentUrl readback，但不取得 Provider effect 或第二 WAL。纯读结果不新建 WAL、队列或第二恢复权限。

## 证据、失败与验收

可持久化的必要事实只有回答 artifact，以及 Browser WAL 同一 provider-effect 行中的 confirmed effect 与加密 locator。两者分别证明回答内容和同一物理副作用/页面 locator；GPT 不保存跨任务会话状态，Browser 不保存 Website direct predecessor，日志只保存脱敏 ref/hash，Website 不接收 Provider locator。

验收必须证明：同一 effect 最多一次物理 dispatch；CONFIRMED 后重启只读回；BZ05/BZ03/BZ04 每个业务任务都 fresh/submit/checkpoint 各一次；BZ03/BZ04 本轮材料携带 Website 已验真的完整父报告；跨任务 continuation API/controller/store/frontier/CAS、private base/reservation/fork/第二 lane 为零；最终 `Product result -> Runtime Outbox -> Website admission receipt` 才是完成。
