# Local Browser Authority V26 施工图

```blueprint-record
{"schemaVersion":1,"blueprintId":"local-browser-authority-v26","status":"active","owner":"local-browser-session","lawIds":["LAW-LOCAL-BROWSER-SESSION-001-V4","LAW-LOCAL-BROWSER-SESSION-003-V29","LAW-LOCAL-BROWSER-SESSION-004-V31","LAW-LOCAL-BROWSER-SESSION-006-V22"],"contractRefs":[],"dependencyEdges":[],"prohibitedDependencyEdges":[]}
```

Browser 只拥有现实页面资源：一个 system Target、实时 current Document、一条 FIFO、Provider/控件 mutation 的唯一 WAL，以及页面生命周期动作后的 fresh readback。它不理解 Product 步骤、不保存 GPT 回答、不决定 retry，也不拥有 Website task。

`document` 是 Target 当前状态的 live view。导航、刷新或 Target 交接后，所有合法消费者必须读到新的 Document；任何包装层不得用对象展开、缓存或复制把它冻结成旧 Document。

Provider/控件 mutation 的唯一规则不变：先写 WAL，再至多 dispatch 一次，最后一次输入后等待 2500ms，从 fresh current Document 做直接后置读回。provider_effect_identity 不含 attempt/process/lease/fence/Target/Document；同一 effect 跨进程物理 dispatch 总数至多一。WAL 只保存 at-most-once terminal fact，并为 CONFIRMED submit 加密保存同包清洗的 canonical conversation URL；它不决定 Website recovery。Browser-owned exact conversation selection 是可逆的 Target 生命周期收敛：先 fresh 读取 currentUrl，pathname 已等于 `/c/<conversation_id>` 时零点击，否则只点击左侧聊天栏唯一精确链接一次，经过同一 2500ms 总闸门并丢弃 query/fragment 后 fresh readback；它不写第二 WAL、不取得 provider_effect_identity，也不得 Page.navigate conversation URL、模糊匹配、搜索、滚动、自动展开、重试或 fallback。纯 observation 和结果读取不建立第二 WAL、lane、timer 或队列。

冻结附件身份规则：Product 批准的附件集合允许为空；非空时，Browser Owner 在同一个点击原子动作内读取当前 Composer 附件显示名并保持集合精确相等。唯一允许的 Provider 展示改写，是在一个批准文件名的最后扩展名前（无扩展名则在文件名末尾）追加恰好一个无空格 `(<纯十进制数字>)`；Browser 只在删除该后缀后精确命中批准名时，将它视为同一附件。附件数量、基础名、扩展名、非数字括号和其它改名仍必须精确不变。禁止恢复原始展示名硬比对而误杀重试，禁止 substring、模糊匹配、宽正则、第二附件身份或兼容分支；本不变量必须由现役 Browser inspector 与真实注入函数验收共同失败关闭，删除或替代必须使唯一 `quality:check` 失败。

已确认提交、回答尚未出现时，可释放 FIFO。Website 再次授权同一 accepted attempt 后，Browser 只按同一 provider_effect_identity 从唯一 WAL 读回 exact canonical URL，以 exact sidebar conversation selection 收敛 current Document 后 fresh observation；不得再次写 Prompt、附件或提交。该路径跨进程仍保持 physical submit delta=0，不建立 park object、第二状态、逐任务时钟或第二调度。

任一 typed 失败、进程重启、lease/fence/abort 失效或提交结果不明时，Browser 只返回 terminal/effect fact。mutation_outcome=no 时可由 Website 决定新 attempt；DISPATCHED/CONFIRMED 时不得重做，只可按 Website 新授权读取同一结果。Browser 不选择 consultation root、不得按当前页面或 latest URL 猜测，也不得 fresh fallback。

验收必须通过真实调用证明：输入命令只走唯一 FIFO，输出 receipt 绑定当前授权与跨 attempt 稳定的 effect identity；CONFIRMED 后进程重启仍零 submit，continuation 丢失或错误时零输入失败关闭。
