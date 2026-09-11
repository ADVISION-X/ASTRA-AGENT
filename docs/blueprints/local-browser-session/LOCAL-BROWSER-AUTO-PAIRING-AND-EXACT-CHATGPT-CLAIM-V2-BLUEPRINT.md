# Local Browser Authority V29 施工图

```blueprint-record
{"schemaVersion":1,"blueprintId":"local-browser-authority-v29","status":"active","owner":"local-browser-session","lawIds":["LAW-LOCAL-BROWSER-SESSION-001-V4","LAW-LOCAL-BROWSER-SESSION-003-V30","LAW-LOCAL-BROWSER-SESSION-004-V32","LAW-LOCAL-BROWSER-SESSION-006-V23"],"contractRefs":[],"dependencyEdges":[],"prohibitedDependencyEdges":[]}
```

Browser 只拥有现实页面资源：一个 system Target、实时 current Document、一条 FIFO、Provider/控件 mutation 的唯一 WAL，以及页面生命周期动作后的 fresh readback。它不理解 Product 步骤、不保存 GPT 回答、不决定 retry，也不拥有 Website task。

`FROZEN-GPT-RESPONSE-NO-PROMPT-REHASH-001` 的 Browser 部分固定：回答读取只用 canonical conversation URL 和 submit 已确认的精确 `userTurnId` 定位其真实紧邻 assistant turn，并把当前 Target/Document、observation revision、回答内容 hash 或媒体 bytes hash 绑定到一次原子 observation。Browser 不得在回答 checkpoint 再读取、解析或 hash 历史 user prompt，不得返回 `precedingPromptHash`，也不得把 Provider 的折叠、展开、截断或重新渲染状态变成回答准入条件。删除或替代本边界必须由用户明确解冻，并同步替换 GPT/Browser 施工图、实现与唯一质检；普通修复或 CI 授权不构成解冻。

`FROZEN-GPT-SUBMIT-TWO-PRECONDITIONS-001` 的 Browser 部分固定：真正 submit 前除 Product 已批准的“提示词 hash + 精确附件集合”和 Browser 自有的“current Target/Document/fence + 同 effect 尚未现实输入”外，不得再增加任何发送资格。批准附件集合允许为空。历史 user turn、固定 turn 编号或奇偶、按钮标签均不是发送前置条件，点击前不得读取历史 turn 决定发送资格；点击后等待 2500ms，只从 fresh current Document 选取最大有效序号的 user turn，核对批准 prompt hash 与 Composer 已清空。按钮唯一、可见、可交互与 hit-test 仍是 Browser 执行物理点击的内部机械安全，不得上升为 GPT/Product 业务关卡。

`document` 是 Target 当前状态的 live view。导航、刷新或 Target 交接后，所有合法消费者必须读到新的 Document；任何包装层不得用对象展开、缓存或复制把它冻结成旧 Document。

Browser mutation 的唯一规则不变：先写 WAL，再至多 dispatch 一次，最后一次输入后等待 2500ms，从 fresh current Document 做直接后置读回。GPT 只有真正提交属于 provider-effect scope；fresh/profile/model/menu/附件/Composer 等准备属于 target-local scope，身份包含 attempt 与当前 Target/Document generation，旧 attempt 不得阻断新 attempt 重建准备。provider_effect_identity 不含 attempt/process/lease/fence/Target/Document；其 request hash 对 GPT submit 绑定现有 result revision 与 Child input hash，同一 revision 跨 attempt 不变，新 revision 必须变化；同一 effect 跨进程物理 dispatch 总数至多一。WAL 只保存 at-most-once terminal fact，并为 CONFIRMED submit 加密保存同包清洗的 canonical conversation URL；它不决定 Website recovery。`FROZEN-GPT-CONVERSATION-LOCATOR-EFFECT-SEPARATION-001` 的 Browser 机械部分只有一条：conversation_id 只用于 Browser-owned exact conversation selection，绝不等于或授予 provider_effect_identity。该选择是可逆的 Target 生命周期收敛：先 fresh 读取 currentUrl，pathname 已等于 `/c/<conversation_id>` 时零点击，否则只点击左侧聊天栏唯一精确链接一次，经过同一 2500ms 总闸门并丢弃 query/fragment 后 fresh readback；它不写第二 WAL、不取得 provider_effect_identity，也不得 Page.navigate conversation URL、模糊匹配、搜索、滚动、自动展开、重试或 fallback。纯 observation 和结果读取不建立第二 WAL、lane、timer 或队列。

冻结附件身份规则：Product 批准的附件集合允许为空；非空时，Browser Owner 在同一个点击原子动作内读取当前 Composer 附件显示名并保持集合精确相等。唯一允许的 Provider 展示改写，是在一个批准文件名的最后扩展名前（无扩展名则在文件名末尾）追加恰好一个无空格 `(<纯十进制数字>)`；Browser 只在删除该后缀后精确命中批准名时，将它视为同一附件。附件数量、基础名、扩展名、非数字括号和其它改名仍必须精确不变。禁止恢复原始展示名硬比对而误杀重试，禁止 substring、模糊匹配、宽正则、第二附件身份或兼容分支；本不变量必须由现役 Browser inspector 与真实注入函数验收共同失败关闭，删除或替代必须使唯一 `quality:check` 失败。

已确认提交、回答尚未出现时，可释放 FIFO。Website 再次授权同一 accepted attempt 后，Browser 只按同一 provider_effect_identity 从唯一 WAL 读回 exact canonical URL，以 exact sidebar conversation selection 收敛 current Document 后 fresh observation；不得再次写 Prompt、附件或提交。该路径跨进程仍保持 physical submit delta=0，不建立 park object、第二状态、逐任务时钟或第二调度。

任一 typed 失败、进程重启、lease/fence/abort 失效或提交结果不明时，Browser 只返回 terminal/effect fact。`REJECTED + mutation_outcome=no + physical_input_count=0` 不消耗 provider effect，Website 签发新 attempt 后可在唯一 WAL 中保留原审计行并重新准备同一 effect；DISPATCHED、CONFIRMED 或任何已发生/不明现实输入不得重做，只可按 Website 新授权读取同一结果。Browser 不选择 consultation root、不得按当前页面或 latest URL 猜测，也不得 fresh fallback。

验收必须通过真实调用证明：输入命令只走唯一 FIFO，输出 receipt 绑定当前授权与跨 attempt 稳定的 effect identity；CONFIRMED 后进程重启仍零 submit，continuation 丢失或错误时零输入失败关闭。
