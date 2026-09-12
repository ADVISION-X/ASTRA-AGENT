# GPT 能力组 V40 施工图

```blueprint-record
{"schemaVersion":1,"blueprintId":"gpt-capability-group-v40","status":"active","owner":"gpt","lawIds":["LAW-GPT-001-V45","LAW-GPT-002-V4"],"contractRefs":[],"dependencyEdges":[{"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"capability-governance","repo":"local"}},{"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"forensics-persistence-capability","repo":"local"}},{"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}}],"prohibitedDependencyEdges":[]}
```

## 唯一 Owner 与职责

GPT 只把 Product 已决定的当前 Provider turn 变成 typed result，不拥有跨任务 Provider conversation、continuation identity、predecessor、frontier 或持久状态。Product 决定 Prompt、模型、附件、步骤和结果组装；Website Bazi sender 提供已入库且精确绑定的父报告材料；Browser 决定 Target、current Document、FIFO、现实副作用和唯一 WAL 持久 fact；Forensics 保存回答 artifact；Runtime 运输结果；Website 唯一裁决业务恢复与完成。

文本主链固定为：

```text
BZ05/BZ03/BZ04: fresh prepare/attach/write
  -> submit_exact_gpt_turn_once -> checkpoint_gpt_text_response

BZ03/BZ04 的本轮附件必须包含 Website 已入库、与 consultation root 及 direct predecessor 精确绑定的完整父报告；不得读取或选择历史 Provider conversation。
```

`submit_exact_gpt_turn_once` 在自己的直接后置一次返回 CONFIRMED、canonical conversation URL、精确 user turn 身份和 Browser effect receipt。provider_effect_identity 不含 attempt/process/lease/fence/Target/Document；Browser WAL 已有 CONFIRMED 时该 Child 只读回同一 receipt/URL，绝不再次输入。`checkpoint_gpt_text_response` 每次取得 FIFO 后只在 fresh current Document 裁决 pending 或 ready；ready 时由同一 coherent observation 一次取得紧邻 assistant turn 的 observed DOM + semantic text，写入且读回一份 artifact。pending 只释放 FIFO。

`FROZEN-GPT-RESPONSE-NO-PROMPT-REHASH-001` 固定：提示词 hash 只属于发送 Child 的发送前内容身份和发送后新 user turn 证明。文本与图片回答读取 Child 不得接收 `expectedPromptHash`，不得从已折叠或重新渲染的历史 user message DOM 提取、规范化、重算或比较 `precedingPromptHash`，也不得把该二次 hash 写入回答或图片 receipt。回答身份只由发送 Child 已确认的 canonical conversation URL、精确 `userTurnId`、其真实紧邻 assistant turn，以及 Browser 当前 Target/Document/revision 共同确定；回答的 `rawDomHash`、`semanticTextHash` 与图片媒体 bytes hash 继续保留。改变或删除本冻结边界，必须由用户在未来任务中明确解冻，并同步替换施工图、实现与唯一质检；普通修复或 CI 授权不构成解冻。

`FROZEN-GPT-IMAGE-SOURCE-EVENT-WAIT-001` 固定：图片 checkpoint 不得按 fixed sleep 猜测图片已经生成。Browser authenticated-media observation 必须在 canonical conversation URL 与精确 `userTurnId` 之后、下一个 user turn 之前的范围内先直接检查非空 `currentSrc/src`；尚未出现时，只能在同一次调用期 observation 内以一个 `MutationObserver` 监听节点加入及 `src/srcset` 变化，单次最多等待 5000ms，出现即在同一次已登录页面调用中 fetch 原始 bytes 并按内容 hash 去重。单次期满仍无 source 只返回现有 typed pending 并释放 FIFO，总期限只复用现有 `probeBudgetMs`。不得等待 assistant role、预览/分享/下载控件、`img[alt]`、图片完成标志、布局、可见性、宽高或固定 turn 编号；不得新增 wait Child、持久 timer、队列、WAL、状态机或下载链。改变或删除本冻结边界，必须由用户在未来任务中明确解冻，并同步替换 GPT/Browser 施工图、实现与唯一质检；普通修复或 CI 授权不构成解冻。

`FROZEN-GPT-SUBMIT-TWO-PRECONDITIONS-001` 固定真正 submit 前只能确认两件事。第一，当前 Composer 提示词 hash 与 Product 批准值相等，当前附件集合与批准集合相等；批准集合可以为空，Provider 自动追加的最终纯数字括号后缀按冻结附件规则归一。第二，Browser 当前 Target/Document/fence 有效，且唯一 WAL 证明同一 provider effect 尚未发生现实输入。历史聊天、既有 user turn、固定 turn 编号或奇偶、按钮标签以及 Browser 内部可操作性检查均不得成为新增业务前置关卡，也不得在点击前读取历史 turn 来决定发送资格。点击后等待 2500ms，再从 fresh current Document 只取最大有效序号的 user turn，确认其 prompt hash 等于批准值且 Composer 已清空；这是发送后的直接证明，不是第三个前置条件。改变或删除本冻结边界，必须由用户在未来任务中明确解冻，并同步替换施工图、实现与唯一质检；普通修复或 CI 授权不构成解冻。

`FROZEN-GPT-SUBMIT-ACTIONABILITY-WAIT-001` 固定：上述两项前置事实已经成立后，发送按钮暂时 `disabled/aria-disabled` 只表示 Browser 页面尚未就绪，不得由 GPT 立即裁成业务失败。Browser 必须在同一次 submit 原子调用和现有 5000ms 有界期限内等待同一精确按钮恢复可操作，恢复后只点击一次；期满仍不可操作则返回原生 typed no-mutation、`physical_input_count=0`。该等待不读取历史聊天、不新增第三前置条件、Child、timer Owner、队列、WAL、状态或重试链。

`FROZEN-GPT-MODEL-SELECTOR-SEMANTIC-MINIMUM-001` 固定：打开模型选择器只证明精确批准的 `modelDisplayName` 选项已出现。目标选项已经出现时零点击完成；否则只允许点击唯一“选择模型”入口一次，并在现有有界后置读取中等待该目标选项出现。随后选择 Child 只允许点击该唯一精确选项，并由同次 Browser mutation 对保留的被点击节点直接证明 `aria-checked=true`；菜单关闭只以该精确选项不再出现在当前可选集合中证明。popup、simple/advanced panel、`data-active`、`inert`、旧面板形态及其它菜单外壳拓扑不得成为准入或后置条件；失败只报告目标选项缺失、多义、入口不可用、选项未选中或菜单未关闭的原生 typed fact。Browser 对被点击入口和选项的唯一性、可操作性继续属于物理输入内部机械安全，不得被删除，也不得升级为 Product/GPT 的菜单拓扑关卡。

`FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001` 已按本次明确解冻替换并重新冻结：fresh/profile/model/menu/附件/Composer 都是 attempt + current Document 范围内的 target-local 准备，同一 job 的新 attempt 必须重做，批准附件集合可以是空；只有 `submit_exact_gpt_turn_once` 是跨 attempt 的 provider effect。唯一身份固定为 `job_id + result_revision + product_step_id + call_id + child_id + request_hash + payload_hash`，Product Plugin 名称、版本、Skill hash、attempt 与 Browser 私有身份均不得进入。同一 result revision 的 submit request hash 绑定 `result_revision + Child input hash`，仅换 attempt或 AGENT 内部实现不变，更换 Website 已授权的 result revision 才变化。任何 Product 在准备前先查询该精确 submit effect；WAL 已 CONFIRMED 时直接零输入读回，未命中才准备并提交。`REJECTED + mutation_outcome=no + physical_input_count=0` 明确不消耗 effect，只有 Website 新 attempt 可在同一 WAL/effect identity 下重新准备；DISPATCHED 或任何已发生/不明现实输入仍禁止重发。不得把旧 attempt 的附件上传、草稿或页面状态当作新 attempt 的成功事实。

`FROZEN-GPT-ATOMIC-IDENTITY-ROUNDTRIP-001` 固定同一次 Browser 原子调用只能由 GPT production boundary 构造一份不可变 `BrowserAtomicStepIdentity`，并把该同一身份用于 WAL 查询、`runAtomicStep`、Child 成功终态回读与 Child 失败事实回读；跨进程 confirmed submit readback 也只能复用这一 canonical 构造。Child 不得再以原始 `intent.inputHash` 手工拼接第二份 WAL 查询身份，测试 Browser 必须按传入身份精确命中，禁止无视身份返回任意 recovery。否则 Browser 已 CONFIRMED 的现实发送会被 GPT 错判为未发生。改变或删除本冻结边界，必须由用户在未来任务中明确解冻，并同步替换施工图、实现与唯一质检；普通修复或 CI 授权不构成解冻。

`FROZEN-GPT-CONVERSATION-LOCATOR-EFFECT-SEPARATION-001` 固定：conversation_id 只定位现有页面 conversation，provider_effect_identity 只证明 Provider submit 现实副作用至多一次，二者绝不合并或互相授予权限。Website 对 DISPATCHED/CONFIRMED effect 重新授权时，跨进程只允许从 Browser WAL 精确读回同一 URL/receipt，由 Browser 从 URL 解析 opaque conversation_id：当前 pathname 已精确命中则零点击，否则只在现有页面左侧聊天栏对唯一精确 `/c/<conversation_id>` 链接点击一次，丢弃 query/fragment 后 fresh readback 必须相等，再 wait/observe/read artifact，physical submit 增量为零；零项、多项、不可交互或读回不等直接 typed fail-close，不准 Page.navigate conversation URL、按标题/顺序/时间猜测、搜索、滚动、自动展开、重试或 URL fallback，也不新增 recovery Child 或状态机。其它失败由 Website 决定是否签发新 attempt/result revision。该冻结边界只有用户在未来任务中明确解冻，并同步替换法案、施工图、实现与唯一质检后才可改变；普通施工或 CI 授权不是解冻。

八字 consultation root 与 direct predecessor 只属于 Website 业务关系。Website 在新任务签发前验证 owner/person/chart/root/predecessor、父授权、父 Delivery Manifest 与已入库父结果，并把完整父报告作为本轮 locked-fact material 下发；缺失、多义或身份不等一律 fail closed。GPT、Browser、Runtime 不复制该父子关系，也不保存或查询跨任务 Provider continuation。

## 删除边界

以下对象必须物理不存在：private base、reusable/derived reservation、semantic read grant、fork、child conversation、跨任务 continuation API、GPT Session Controller、continuation identity/store/row/frontier/CAS、独立 submission locator、document transition policy、恢复型 park、取消后自发重跑和通用旧 attempt recovery。只保留 submit Child 内对同一 provider effect 的 confirmed receipt readback；不得用兼容 wrapper、alias、feature flag、dual-read/write、第二 lane/store/scheduler 或状态机扩张。

## Browser 边界

GPT 只消费 Browser 签发的实时 current Document 和 typed command terminal。Browser 的 Target lease 对外暴露的 `document` 必须是 live getter；包装它时不得用 spread 把 getter 求值成旧快照。Provider/控件 mutation 仍先经唯一 FIFO、每 provider effect 一条权威 WAL、跨 attempt/进程至多一次 physical dispatch 和 2500ms 后的 fresh postcondition；Browser-owned exact conversation selection 只做可逆页面生命周期收敛，当前命中零点击，否则唯一精确点击后同样经过 2500ms 与 fresh currentUrl readback，但不取得 Provider effect 或第二 WAL。纯读结果不新建 WAL、队列或第二恢复权限。

## 证据、失败与验收

可持久化的必要事实只有回答 artifact，以及 Browser WAL 同一 provider-effect 行中的 confirmed effect 与加密 locator。两者分别证明回答内容和同一物理副作用/页面 locator；GPT 不保存跨任务会话状态，Browser 不保存 Website direct predecessor，日志只保存脱敏 ref/hash，Website 不接收 Provider locator。

验收必须证明：同一 effect 最多一次物理 dispatch；CONFIRMED 后重启只读回；BZ05/BZ03/BZ04 每个业务任务都 fresh/submit/checkpoint 各一次；BZ03/BZ04 本轮材料携带 Website 已验真的完整父报告；跨任务 continuation API/controller/store/frontier/CAS、private base/reservation/fork/第二 lane 为零；最终 `Product result -> Runtime Outbox -> Website admission receipt` 才是完成。
