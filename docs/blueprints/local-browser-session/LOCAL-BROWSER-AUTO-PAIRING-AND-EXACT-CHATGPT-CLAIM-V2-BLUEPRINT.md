# Local Browser Authority V34 施工图

```blueprint-record
{"schemaVersion":1,"blueprintId":"local-browser-authority-v34","status":"active","owner":"local-browser-session","lawIds":["LAW-LOCAL-BROWSER-SESSION-001-V4","LAW-LOCAL-BROWSER-SESSION-003-V34","LAW-LOCAL-BROWSER-SESSION-004-V36","LAW-LOCAL-BROWSER-SESSION-006-V27"],"contractRefs":[],"dependencyEdges":[],"prohibitedDependencyEdges":[]}
```

Browser 只拥有现实页面资源：一个 system Target、实时 current Document、一条 FIFO、Provider/控件 mutation 的唯一 WAL，以及页面生命周期动作后的 fresh readback。它不理解 Product 步骤、不保存 GPT 回答、不决定 retry，也不拥有 Website task。

首次业务需要 Browser 时，固定扩展只创建一个 `active:true` 的 visible、system-owned ChatGPT production Tab；物理 Tab 丢失时只补建一个并同样 `active:true`。该动作只把 system Tab 选为所在 Chrome 窗口的当前 Tab，不调用 `windows.update({focused:true})` 或 `Page.bringToFront`，不认领、关闭或改写任何操作者 Tab。后续任务复用该唯一 Tab；纯观察不得循环抢回，Provider 物理输入前仍由现役唯一交互就绪闸门精确选中并重验 system Tab。后台隐藏执行不再是生产承诺，不得以硬点、盲重试、备用通道或第二 Tab 重新引入。

`FROZEN-GPT-RESPONSE-NO-PROMPT-REHASH-001` 的 Browser 部分固定：回答读取只用 canonical conversation URL 和 submit 已确认的精确 `userTurnId` 定位其真实紧邻 assistant turn，并把当前 Target/Document、observation revision、回答内容 hash 或媒体 bytes hash 绑定到一次原子 observation。Browser 不得在回答 checkpoint 再读取、解析或 hash 历史 user prompt，不得返回 `precedingPromptHash`，也不得把 Provider 的折叠、展开、截断或重新渲染状态变成回答准入条件。删除或替代本边界必须由用户明确解冻，并同步替换 GPT/Browser 施工图、实现与唯一质检；普通修复或 CI 授权不构成解冻。

`FROZEN-GPT-IMAGE-SOURCE-EVENT-WAIT-001` 的 Browser 部分已按本次授权解冻替换并重新冻结：authenticated-media 读取先在 canonical conversation URL 与精确 `userTurnId` 之后、下一个 user turn 之前的范围内直接检查非空 `currentSrc/src`；尚未出现时，只能在同一次加密 command 的调用期 observation 内安装一个 `MutationObserver`，仅监听节点加入及 `src/srcset` 变化，单次最多等待 5000ms，source 出现即在同一次已登录页面调用中 fetch 原始 bytes 并按内容 hash 去重。单次期满仍无 source 返回现有 typed pending；正常轮询继续持有同一 FIFO lease/Target/Document，等待 30 秒后 fresh observe，不得 park、重领或导航。调用期 observer 与 timeout 必须结算即销毁，总期限只由 GPT Child 现有 `probeBudgetMs` 决定，不得形成第二 timer Owner、持久状态或调度器。

`FROZEN-GPT-SUBMIT-TWO-PRECONDITIONS-001` 的 Browser 部分固定：真正 submit 前除 Product 已批准的“提示词 hash + 精确附件集合”和 Browser 自有的“current Target/Document/fence + 同 effect 尚未现实输入”外，不得再增加任何发送资格。批准附件集合允许为空。历史 user turn、固定 turn 编号或奇偶、按钮标签均不是发送前置条件，点击前不得读取历史 turn 决定发送资格；点击后等待 2500ms，只从 fresh current Document 选取最大有效序号的 user turn，核对批准 prompt hash 与 Composer 已清空。按钮唯一、可见、可交互与 hit-test 仍是 Browser 执行物理点击的内部机械安全，不得上升为 GPT/Product 业务关卡。

`FROZEN-GPT-SUBMIT-ACTIONABILITY-WAIT-001` 的 Browser 部分固定：精确待发送内容和 WAL/current Document 已通过后，精确发送按钮暂时 `disabled/aria-disabled` 时，在同一原子 command 的现有 5000ms 有界期限内重复 fresh mechanical qualification，恢复后至多输入一次；期限耗尽仍返回原生 disabled typed receipt、mutation=no、physical input=0。不得建立第三业务前置条件、持久 timer、第二 WAL、队列或重试器。

`FROZEN-GPT-MODEL-SELECTOR-SEMANTIC-MINIMUM-001` 的 Browser 部分固定：模型选择准备只机械观察精确批准模型选项，或点击唯一“选择模型”入口后等待该选项出现；随后只点击该唯一选项，并在同次 mutation 中直接读取保留的被点击节点 `aria-checked=true`，再确认该精确选项退出当前可选集合。Browser/GPT 不检查 popup、simple/advanced panel、旧面板形态、`data-active`、`inert` 或其它 UI 外壳拓扑。入口与选项自身的唯一性、可操作性以及被点击选项自身的 `aria-checked` 是 Browser 物理动作和直接后置证明，不属于被禁止的外壳拓扑，也不得扩展成新的菜单结构考试。

`document` 是 Target 当前状态的 live view。导航、刷新或 Target 交接后，所有合法消费者必须读到新的 Document；任何包装层不得用对象展开、缓存或复制把它冻结成旧 Document。

Browser mutation 的唯一规则不变：先写 WAL，再至多 dispatch 一次，最后一次输入后等待 2500ms，从 fresh current Document 做直接后置读回。GPT 只有真正提交属于 provider-effect scope；fresh/profile/model/menu/附件/Composer 等准备属于 target-local scope，身份包含 attempt 与当前 Target/Document generation，旧 attempt 不得阻断新 attempt 重建准备。provider_effect_identity 精确为 `job_id + result_revision + product_step_id + call_id + child_id + request_hash + payload_hash`，不含 Product Plugin 名称/版本/Skill hash、attempt/process/lease/fence/Target/Document；同一 effect 跨进程物理 dispatch 总数至多一。WAL 为 CONFIRMED submit 加密保存同包清洗的 canonical conversation URL 与精确 userTurnId；URL 只负责“去哪里读”，effect identity 只负责“是否已经发送”。confirmed readback 先查询 WAL，再取得当前唯一 system Target；当前 URL 命中时零导航，否则只执行一次 Browser-owned `Page.navigate` 到该 URL，2500ms 后 fresh readback 必须相等。历史 targetRef、侧栏点击、标题/顺序/时间猜测、搜索、滚动、自动展开、重试与 fallback 均不参与。该导航不写第二 WAL、不取得 provider effect identity。纯 observation 和结果读取不建立第二 WAL、lane、timer 或队列。

冻结附件身份规则：Product 批准的附件集合允许为空；非空时，Browser Owner 在同一个点击原子动作内读取当前 Composer 附件显示名并保持集合精确相等。唯一允许的 Provider 展示改写，是在一个批准文件名的最后扩展名前（无扩展名则在文件名末尾）追加恰好一个无空格 `(<纯十进制数字>)`；Browser 只在删除该后缀后精确命中批准名时，将它视为同一附件。附件数量、基础名、扩展名、非数字括号和其它改名仍必须精确不变。禁止恢复原始展示名硬比对而误杀重试，禁止 substring、模糊匹配、宽正则、第二附件身份或兼容分支；本不变量必须由现役 Browser inspector 与真实注入函数验收共同失败关闭，删除或替代必须使唯一 `quality:check` 失败。

已确认提交、回答尚未出现时，正常轮询必须继续持有 FIFO、同一 lease/Target/Document，等待 30 秒后只做 fresh observation。只有进程重启、Target 真正丢失或同等恢复现场，Website 再次授权同一 accepted attempt 后，Browser 才按同一 provider_effect_identity 从唯一 WAL 读回 canonical URL 与 userTurnId，以 `confirmed-readback` 取得当前唯一 system Target，再按该 URL 零次或一次精确导航后 fresh observation；不得跨业务任务使用该 URL，不得再次写 Prompt、附件或提交。该恢复路径 physical submit delta=0，不建立 park object、第二状态、逐任务时钟或第二调度。

`FROZEN-EXACT-TARGET-POLL-RESULT-REVISION-001` 的 Browser 部分已按本次授权解冻替换并重新冻结：正常 Provider 回答轮询只持有同一 FIFO lease、system Target 与实时 current Document，40 秒静默门后首次读取，pending 后每 30 秒 fresh observe；不得 park、释放 FIFO、重新 acquire、读取 canonical locator 或执行 Page.navigate。只有进程重启、Target 真正丢失或同等恢复现场，才从同一 WAL effect 取得 canonical URL 与 userTurnId，再以 `confirmed-readback` 取得当前唯一 system Target；不得执行固定 GPT start URL/首页导航，不比较旧新 targetRef，不扫描旧标签，同 URL 零导航，不同 URL 最多一次精确 Browser-owned `Page.navigate`，2500ms 后 fresh readback 不等即 typed fail-close。Browser WAL 的 `logical_mutation_id` 仍是唯一公开 `provider_effect_identity_hash`，不得复制列、台账或第二 store。

任一 typed 失败、进程重启、lease/fence/abort 失效或提交结果不明时，Browser 只返回 terminal/effect fact。`REJECTED + mutation_outcome=no + physical_input_count=0` 不消耗 provider effect，Website 签发新 attempt 后可在唯一 WAL 中保留原审计行并重新准备同一 effect；DISPATCHED、CONFIRMED 或任何已发生/不明现实输入不得重做，只可按 Website 新授权读取同一结果。Browser 不选择 consultation root，不保存或恢复跨任务 Provider conversation，也不得按当前页面或 latest URL 猜测。

验收必须通过真实调用证明：输入命令只走唯一 FIFO，输出 receipt 绑定当前授权与跨 attempt 稳定的 effect identity；CONFIRMED 后进程重启仍零 submit，Browser WAL 中跨任务 consultation identity、source task、checkpoint 与 frontier 均为零。
