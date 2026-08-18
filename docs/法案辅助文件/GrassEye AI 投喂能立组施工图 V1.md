# GrassEye AI Input Gateway 施工图 V2

status: construction-blueprint
version: 2026-08-16.7
authority: `.github/instructions/agent-rules/modules/module-ai-input-gateway.instructions.md`

## Boundary

```txt
调用方决定：给哪个 provider、提示词是什么、哪些文件获准进入输入包，并提供结构化任务身份。
Gateway 决定：怎样安全送达、怎样证明送达、怎样取回原始回答。
```

外部请求不接受 transport、selector、coordinate、tabId、文件选择器动作或 fallback 策略。

## Bounded Parallel Web Chat

GPT Web 的运行时容量是运维拥有的实际资源边界，不是产品常量，也不是调用方参数：

```txt
WEB_CHAT_MAX_IN_FLIGHT
  positive bounded integer
  default = 10
  external caller cannot read or set it per request
```

发送后只要精确 marker 用户轮次已经出现，就先把临时 URL、user turn identity 和附件证明
原子落盘，再继续等待正式 URL。不得把“正式 URL 尚未出现”当成“尚未提交”。即使
`/c/WEB:` 长时间不收敛，失败也必须进入 `recovery_pending` 并保留该已提交轮次。
这里的 `/c/WEB:` 只是一张“已经发送、禁止重发”的临时回执，不是聊天地址。写入回执后，
当前 attempt 必须继续守住同一个仍然存活的 exact target，直接观察地址收敛；不得先把临时
URL 绑定进单标签路由器，不得按它切侧栏、重新取得标签、执行 canonical pathname 校验，
也不得让临时回执覆盖当前 target。只有已经核验为非 WEB 的正式 `/c/...` 才能成为可路由
会话身份。进程恢复时若只有临时回执而没有正式 URL，只能保留 `recovery_pending`，不得用
临时 URL 猜测、创建或导航到一个会话。

新根任务的“空白聊天”不是只看地址栏 `/`。若页面已经同时证明用户轮次 0、助手轮次 0、
编辑器为空、待传附件 0、粘贴文本卡 0、生成状态停止，就不得再多点一次新聊天；否则创建
动作必须唯一命中可见的新聊天控件并重新证明全部条件。任何一项不符都不能开始上传。
ChatGPT 若把已经提交到正式 `/c/...` 会话的 GrassEye 草稿保留在根页编辑器，Gateway 只在
同一个 exact target 一次性证明以下全部事实后清理：当前为根路径、用户轮次与助手轮次均为 0、
没有附件和粘贴文本卡、没有生成、编辑器中恰有一个格式正确的内部 `GRASSEYE_TURN` marker，
并且持久化 execution ledger 将该 marker 唯一映射到另一个已有非 WEB 正式 URL 提交回执的
GPT execution。清理动作本身必须再次核对同一 marker 与上述零状态，再清空并重新证明空白根页。
没有 marker、marker 不合法、映射为 0 或多个、只有临时 `/c/WEB:` 回执、尚未提交、属于当前
新 execution，或任一页面边界不符时，一律不得触碰编辑器；无 marker 内容按用户未知草稿保护。
点击发送按钮也不是“已发送”；必须等新用户轮次同时
包含本次提示词开头和末尾唯一 `GRASSEYE_TURN` 标记、该标记在精确聊天中唯一且属于最新
用户轮次、地址收敛到正式
`/c/...`，并把该 URL 原子登记到本 execution 后，日志才允许写 `prompt_submit success`。
页面全局用户轮次数会随历史消息延迟加载而变化，只能观察，禁止作为提交或重发依据。

正式 URL 是持久化占用资源。没有 continuation 身份的新 execution 若落到其他 execution
已经登记的正式会话，说明 ChatGPT 把新任务回弹到了旧聊天：本次 provider attempt 立即
作废，保留失败证据并由工厂换新 execution 重跑。只有携带精确 `providerContinuationRef`
的后续阶段或付费追问可以复用父正式 URL，而且实际 URL 必须与父 URL 完全一致。

一个 BrowserController 只控制一个物理 ChatGPT exact target。独立 feed 各自在这个 target 中
创建一个全新聊天；附件、提示词填写、发送、提交证据、按 canonical URL 切换聊天、DOM 抓取与
清理共享容量为一的短时 browser-mutation lease。所有普通页面动作携带
同一个 opaque targetRef 与当前 documentRef，通过 CDP 对目标执行，不激活 Chrome、不依赖前台标签。
提交后先记录正式会话 URL 与提示词 marker 并立即释放发送短锁，服务端生成等待不持锁。
文章进入发布链前只证明“canonical URL＋提示词 marker＋回答或图片 hash”。自动聊天标题只是
供应商界面观察值，既不进入身份，也不允许 AGENT 打开标题菜单、填写标题或登记改名尾工。

带 `providerContinuationRef` 的 feed 不是独立根任务：它必须先聚焦并核验
`providerPageUrl` 指向的精确父聊天，并在任何附件上传之前证明父聊天历史已加载出至少一轮
用户消息、一轮助手回答和非空父回答，再在这个聊天中发送。父历史仍为空、仍在加载或仍在
生成时只进入内部恢复，禁止先把附件放进编辑器。父 URL、父任务、父回答 hash 或 marker
任一不符都 fail closed；不得调用“创建全新聊天”路径，也不得用重新上传父附件冒充续接。

回答生成期间的巡查也不得用浏览器 URL open 直达历史会话。系统必须在同一 exact target 内按
已记录的 canonical pathname 锁定正式侧栏路由，点击后核验当前 pathname 和唯一 marker。
ChatGPT 可以把同一个 canonical pathname 渲染成多个可见 `a[href]`；这些只是一个逻辑会话路由的
重复 DOM 表示，不是多个会话身份。系统必须先按完全相同的 pathname 折叠，再按稳定几何顺序选一个
可操作渲染行，点击后仍必须证明地址等于持久化 pathname 且 marker 精确为 1。若 marker 大于 1、
同一 execution 宣称不同 canonical pathname，或物理 exact-url 标签大于 1，才是身份歧义并失败关闭。
这是唯一 DOM 聊天切换路径；禁止按自动标题、文本近似、当前页或未经排序的第一行定位，
也不是刷新或重新打开页面。

聊天搜索必须是一次有头有尾的短事务。进入搜索前、选择附件前、粘贴提示词前，Gateway
只允许识别这一种无业务副作用的残留层：一个可见 dialog 内恰有一个
`搜索聊天 / Search chats` 输入框和一个 `关闭 / Close` 按钮。识别为 0 个时不动作；
任一候选大于 1 或关闭按钮不唯一时 `review_required`。目标未找到、操作中断或搜索成功
退出时，都必须通过这个精确按钮收尾并验证 dialog 已消失，之后才释放浏览器短锁。禁止
用 Escape 清理所有 menu、listbox 或 dialog，也禁止在搜索弹窗后方尝试打开原生附件选择器。

首次新任务 acquire 必须枚举 provider host 标签并得到精确一个内部 target；后续短时浏览器操作只解析
同一个 opaque targetRef，不得按 URL 重选、取第一个 page 或读取 active tab：

```txt
精确 1 个 → mint targetRef/documentRef，再执行聊天内动作
0 个       → 只有首次打开允许创建 1 个
多于 1 个 → review_required，禁止选择“第一个”继续
```

首次打开使用固定根 URL 的 `reuse-exact-url`，禁止按同 host、active、current、front 或 first
标签猜测 ChatGPT。聊天轮询、限流恢复和回答读取都必须先解析这个 exact target，并核验
origin/document generation；不得切换或假设当前前台标签。target 消失时进入 recovery_pending，
禁止 URL-first fallback。

已提交 execution 在 AGENT 进程重启后没有内存 target 时，只允许使用
`bind-existing-exact-origin` 按持久化 canonical conversation origin 重新绑定唯一一个已经存在的
同源物理标签页。物理标签是运输身份，不是文章聊天身份；不得要求物理标签当时恰好停在每条
任务自己的 canonical conversation URL：

```txt
同源 1 个   → 原地绑定该 tab，不导航；再按 canonical pathname 点击唯一侧栏行并核验唯一 marker
同源 0 个   → TARGET_NOT_FOUND，保持 recovery_pending，绝不创建标签页
同源多于 1 个 → TARGET_AMBIGUOUS，保持身份歧义，绝不选择 active/current/front/first
```

这个协议只恢复共享 physical targetRef/documentRef，不把当时页面 URL 当成聊天归属，也不允许
导航、刷新、新建标签页或新建聊天。随后以及内存 target 已存在时，历史任务一律只靠 canonical
pathname 对应的唯一侧栏行切换，并以 pathname + marker 复核精确文章聊天。

普通 DOM evaluate/click/fill/scroll/screenshot/file-input 全部通过 exact-target 插件 CDP，不使用
辅助功能窗口、Chrome activate、系统鼠标、系统键盘、剪贴板、原生文件选择器或焦点租约。
provider 生成等待同样不得激活或轮询用户前台窗口。

侧栏行即使存在 DOM，只要中心点落在浏览器可视区之外，就不允许点击该坐标。系统必须在
exact target 内发送 CDP scroll，把精确 canonical URL 对应的行滚进可视区，重新定位后再
点击并核对 marker。这样历史任务被新聊天挤到侧栏下方后仍能在第二天恢复。

```txt
accepted
→ waiting_for_capacity
→ waiting_for_submit_slot
→ submitting
→ submitted_transient
→ conversation_canonicalized
→ waiting_provider
→ response_detected
→ response_stable
→ response_checkpointed
→ recovery_pending（仅在提交后尚未完成发布时）
→ response_captured
→ cleanup_completed
```

每个 feed 必须先提供：

```txt
taskIdentity.labelKey       allowlisted enum
taskIdentity.sourceProject  bounded machine id
taskIdentity.taskKind       bounded machine id
taskIdentity.sourceTaskId   bounded machine id
```

完整 `taskIdentity` 进入 input hash。它只服务内部执行身份，不映射为聊天标题，也不允许自由
文本标题。一个网站订单的多轮消息只通过精确父 canonical URL、父 marker、父回答 hash 与本轮
marker 续接；供应商自动标题无论为空、延迟出现、重复或漂移，都不改变身份和恢复判断。

每个 attempt 内部持久化 opaque attempt id、由不可变 taskIdentity 与 input hash 派生的稳定
logical-turn marker、submitted prompt hash、临时 URL、正式 URL、user turn identity、
容量租约 ID、回答 checkpoint、回答 hash、稳定轮次，以及最近 20 条失败账。取得容量租约后
必须立即写入执行账本；失败账必须包含发生时间、
attempt id、失败前 phase、分类、是否可恢复和受限长度 reason；后续恢复成功不得抹掉旧失败。
恢复时逐条重判全部真实失败：连续多条可恢复故障仍是可恢复。新产生的
`execution is terminal` 错误必须在同一条持久化 reason 中携带最后一条真实根因，恢复链按
真实根因分类，禁止只看终态包装。旧分类器留下但没有根因的终态回声只保留证据，并只获得
一次有界恢复机会；它既不能直接生成新的阻断，也不能成为无限重启的理由。失败条数从来
不是终态依据。
外部请求和调用方公共结果不接受这些运输控制字段。

回答必须从“包含本 attempt marker 的唯一 user turn”向后绑定 assistant turn；不得读取
页面最后一条 assistant 作为任务结果，也不得要求模型复述 marker。

当前真实 Chrome 页面只承认外层
`[data-testid^="conversation-turn-"][data-turn="user|assistant"]` 为消息轮次。先从这些外层节点读取
`data-turn`，再判断内容是否实质存在：`[data-conversation-screenshot-content]` 中存在非空正文，或
轮次内存在非空图片源，二者满足其一才是实质轮次。只有标题、空容器或加载外壳的 provider
占位节点不算 assistant 回答，也不算会话已经前进。旧 `article` 标签和嵌套
`data-message-author-role` 不保留兼容选择器；DOM 再漂移时必须由真实 Chrome 重新取证并失败关闭。

`expectedOutputKind=generated_image` 使用独立终态：不等待文本回答，不写文本 checkpoint。
精确 marker 后紧随的 assistant turn 必须出现唯一完成图片卡片且不存在生成中状态；Gateway
先打开该卡片，再点击图片查看器中的唯一保存动作，并证明恰好出现一个新的可解码图片文件。
恢复执行同样从 marker 和 canonical URL 进入这条卡片→查看器→保存顺序，不重发提示词。
当前真实 Chrome 的图片卡片是带 `role="button"` 的可见 `DIV`，因此捕获器按唯一可见
`HTMLElement[role=button]` 认定交互卡片，禁止强制转换成原生 `HTMLButtonElement`。页面求值
只向扩展返回有界状态、原因和点击坐标，不得返回 Element、DOMRect 或其他页面对象。
当前 zh-CN 图片查看器的保存入口只认唯一可见 `button[aria-label="保存"]`。零个时继续等待，
多个时失败关闭；不得拼接 `title`、按钮正文或兼容旧 `下载/Download` 标签。页面再次漂移时，
必须先用真实 Chrome 重新取证，再按法案→施工图→代码→质检迭代，禁止预埋候选入口。

容量已满时由上游有界生产窗口公平排队，不失败、不增加物理 ChatGPT 标签页。Gateway
只接收已经进入生产窗口的 feed，不感知网站尚未领取的无限订单。运维参数
`WEB_CHAT_PATROL_INTERVAL_MS` 只能取 1 至 60 秒，默认每 5 秒巡查一次；调用方不能修改：

```txt
仍有 admitted 任务等待发送 → 巡查让路
所有待发送任务已逐个记录 → 巡查取得短时浏览器操作锁
→ 在同一标签页按 canonical pathname 唯一定位并点击
→ 校验 DOM 中恰有一个本任务 marker
→ 只读取该 user turn 后面的 assistant turn
→ 回答完成
→ 原子写入回答正文、hash、byteCount、capture time、provider page URL
→ 状态 response_checkpointed
→ 读取并核验执行账本中的 provider lease
→ 在任何附件装饰或清理之前连同 lease 发布生产结果
→ 状态 response_captured
```

这里的优先级是固定的：

```txt
普通限流弹窗的唯一确认动作
→ 已接收但尚未完成附件＋提示词提交的任务
→ 已提交任务的短周期巡查与回答读取
```

这个优先级不能依赖进程内 Set。唯一调度账本为：

```txt
<dataDir>/runtime-data/ai-input-gateway/web-chat-scheduler.sqlite
  scheduler_waiters(execution_id, kind, pid, ticket, created_at)
  scheduler_sequence(next_ticket)
```

提交 waiter 与巡检 waiter 都先取得持久 ticket。只要仍有 admitted submission waiter，
巡检必须让路；submission 集合清空后，只有最小 patrol ticket 可以竞争短锁。进程死亡后
清理对应 PID 的 stale waiter，重启不得留下幽灵阻塞，也不得让后来的巡检插队。

限流确认使用单个进程级 watcher，直接查看当前唯一 ChatGPT 标签页，不绑定某一个任务，
不为 N 个任务创建 N 个 watcher。尚未出现正式自动聊天行、聊天行已出现但点击后尚未完成
切换，或同一情况发生在回答读取前置检查和每轮读取前的聊天定位时，结果都只能是
`waiting_provider` 下的可重试 pending：释放短锁，等待下一轮，不得写成 `review_required`，
也不得占锁等待 30 秒。只有身份重复、marker 不匹配或明确安全阻断才进入终态。

新根会话建立也采用同一套短轮次原则。每轮最多 30 秒，DOM clean-root 探针间隔不小于
1 秒；`pending`、首页 hydration、composer 暂未出现、0 个或多个 New chat 候选且尚未完成
点击证明，都只返回可恢复状态并释放浏览器短锁。下一轮继续使用同一 execution id、input hash
和 marker。只有实际观察到外国 marker、重复 marker 或 canonical URL 已被其他 fresh execution
占用，才向产品 owner 提交“允许退休本 execution”的正面身份冲突证据；不得用 timeout、
`review_required` 字样、失败条数或控件候选数量反推出终态身份故障。

当前真实 zh-CN Chrome 页面同时存在三个“新聊天”渲染：两个 sidebar test-id 渲染中，窄图标
副本为 `pointer-events:none`，宽侧栏行可命中；历史/项目分组标题还带一个无 test-id 的 trailing
action。唯一合法点击先过滤为：`a[data-testid=create-new-chat-button][data-sidebar-item=true]`、
精确文字 `新聊天|New chat`、解析后的 href 为 provider 根路径、可见、pointer-events 可用，且
中心点 `elementFromPoint(...).closest(...)` 回到自身。过滤后正好 1 个才点击。pointer-events
为 none 的响应式副本确定不是候选；仅有 aria-label 的分组 trailing action 确定不是候选；禁止
从 test-id 多份退回 aria-label。点击后必须再次证明 composer 为空、无附件、无 turn、无生成，
否则仍是 pending，不能把“点击过”当作新会话成功。

Gateway 的主结果等待必须同时监听 provider adapter 和持久 checkpoint；checkpoint 先出现时
立即从其字节和 lease 构建成功结果并返回上层，adapter 的附件装饰与清理在原有短锁/
容量租约下继续。后置动作失败只追加 `post_processing_after_response_publication` 失败证据，
状态保持 `response_captured`，不得让网站继续等待。
这条竞争等待只有一个生命周期：无论 provider 正常返回、provider 抛错还是 checkpoint 先赢，
都必须在 `finally` 中关闭 50ms checkpoint 巡查。禁止一次失败留下一条永久轮询，禁止失败越多
后台巡查越多。
回答完成必须同时通过生成态检查。只要精确 assistant turn 仍缺少完成操作，或实时 DOM 中
当前主对话存在可见的 `thinking / reasoning / loading / shimmer` 进度节点，就仍是
generating。侧栏、导航、编辑器、附件上传区或其他非主对话区域的 page-global
`aria-busy` 不是生成证据，禁止据此让任务永久等待。
“正在核对引用”“正在读取文件”“工具执行摘要”等中间文字不是最终回答，禁止据此提前抓取。

进程重启时，没有回答 checkpoint 才能按持久化正式 URL 非创建式重新绑定既有标签页并以 marker 复核后继续
轮询。已有 checkpoint 时必须在接触浏览器前直接读取本地回答并完成生产发布；附件装饰和清理
只能在发布后有界补做。后置整理失败不得覆盖回答、网站结果或重新进入回答轮询。checkpoint
的输入、附件、hash 或字节身份不一致时进入 `review_required`，禁止再次发送提示词。

标题改写链物理退出：不得存在标题生成器、标题 DOM 脚本、改名执行器、改名恢复状态、改名
worker、改名 Audit 或改名 Acceptance。旧账本中的标题与 `chatTitleRename` 字段只作为未知字段
被 JSON 读取器忽略，不提供迁移器、兼容桥、恢复循环或第二路由；新执行不得再写这些字段。

新执行取得容量时同步持久化真实 `providerLeaseId`。历史 checkpoint 若来自尚未保存租约的旧
版本，只能在 execution id、attempt id、input hash、response hash 与 checkpoint 原始字节全部
一致时生成一次 `web-chat-checkpoint-recovery:*` 恢复租约，并先回写本地执行账本、阶段账本和
整单结果，再向云端补交。已有租约不可替换；正文、hash、任务身份或其他 proof 字段均不可借
恢复发生变化。

若上层工厂已经判定某次回答污染或 provider execution 终态，必须丢弃该次回答并创建新
execution id。新执行通过内部执行参数逐字携带被替换的旧 execution id；防重复闸门只有在
旧编号等于当前轮次和输入哈希的唯一账本 owner 时才原子换主。无关执行仍按重复任务拒绝，
已退休执行也不得反向抢回。禁止合法新执行每十秒空转，禁止依靠重启 AGENT 清空内存 owner。

恢复不是一次占锁的无限搜索，而是可跨重启的短轮次恢复。每次按持久化 canonical URL 与 marker 定位精确
ChatGPT 会话都必须有时间上限、释放短锁、记录失败账并回到 `recovery_pending`。会话当前
不可见、侧栏尚未加载或连续多次查询无结果，均不得仅凭次数升级成用户侧终态。玄学生产
工厂若确认父聊天无法恢复，必须从网站下发的父重放包自第一阶段重建父任务，再把追问送入
重建后的父聊天；禁止空白新建追问聊天。只有身份重复/冲突、安全验证或不可变输入损坏等
无法安全自动替用户决定的条件，才进入受约束的人工复核。

提交前 exact target 的脚本评估若因运输或脚本语法失败，必须保留真实错误并进入同 execution 的
`recovery_pending`；可执行脚本验收负责在交付前拦截该缺陷。代码修正并重启后，旧的未提交回执按真实
root reason 重新分类并以原 execution 恢复，不得手工改状态文件，也不得再生成替代 execution。
“精确 provider target 尚未取得”属于同一类提交前运输等待，不是身份终态。若旧账因历史写入缺口只剩
同一个 attempt 的 `web-chat execution is terminal` 回声且没有 root、submission、附件、checkpoint 或
response hash，恢复器只能给它一次同 execution、同 marker 的重新进入机会；以新 attempt id 标记这次
机会。若新 attempt 再次只留下无 root 回声，不得再次重置 attempt，也不得据此生成替代 execution。

附件一旦已经记录为 `attachments_stable`，并且正式聊天 URL 与带 marker 的用户消息均已
持久化，恢复链只允许核对持久化的输入哈希、逐件附件顺序/名称/哈希/字节数、正式聊天 URL
和 marker。调用方的上游临时目录在完成提交后可以立即消失；恢复链不得再次 `stat`、读取或
上传这些一次性源路径，也不得因源路径消失而重复发送提示词。

ChatGPT 普通请求频率限流是最高优先级生存动作，不进入聊天搜索或回答解析：

```txt
DOM 出现“请求过于频繁 / too many requests”等普通限流对话框
→ 秒点唯一“明白了 / OK / Got it”
→ 保持当前会话原地不动，禁止刷新或重载
→ 等候同一页面的实时 DOM 恢复后，按 canonical URL＋marker 继续原任务
```

这个动作不得刷新页面、开新标签页、开新聊天、重启任务或重发提示词。每次弹出都重复同一固定序列，
不设次数上限。明确的额度耗尽或固定恢复时间仍按调用领域的暂停规则处理，不能混同普通弹窗。

## Attachment Child

唯一子能力：

```txt
attach-approved-web-chat-files-once
```

固定路由：

```txt
0 files                         -> skipped
GPT Web Chat + any files        -> exact_target_file_input_batch
```

不存在调用方选择，不存在同一次尝试内换路。文件附件只允许已加载 Chrome 插件在精确受控标签页中
命中唯一文档 file input；Gemini Web Chat 当前不得借用 GPT 传输，也不得建立第二附件链。
附件子能力只允许作为所属真实 feed 的最终 composer 提交前步骤运行；它形成的同一份
`attachments_stable` proof 必须直接供该 feed 的提交决定消费，因此每个获准文件对 provider
composer 恰好上传一次。独立 provider-input-preflight 调用方或 HTTP route、临时预检聊天、
预检 capacity waiter、base64 文件信封、请求体/单文件 byte ceiling、上传后清空再重传和第二
attachment action graph 必须物理不存在。

## Staging Flow

```txt
governed inputRefs
  -> re-read source bytes
  -> verify source sha256 and byteCount
  -> create unique uploadAttemptId directory
  -> copy exact approved set with unique ordered display names
  -> re-read staged bytes
  -> verify exact directory membership
  -> calculate stagingManifestHash
```

目录：

```txt
<dataDir>/runtime-data/ai-input-gateway/upload-attempts/<uploadAttemptId>/
```

终态后删除该次目录。

## Exact Target File Input Transport

唯一插件传输固定执行：

```txt
绑定已治理的 Chrome 标签页 target
-> 核对页面 URL 与调用方持久化的 expectedPageUrl 完全相同
-> 在该 target 内核对唯一、已连接、可用、支持 multiple 的 #upload-files 文档输入框
-> 插件通过 browser.setFileInputFiles 逐件写入已校验暂存文件
-> 每件写入后证明从零开始的精确累计附件数量与精确暂存显示名
-> 全部附件连续稳定后才形成 attachments_stable
```

任一步失败即结束本次子能力，不重传、不换路。不得打开原生文件窗口，不得使用剪贴板，
不得抢占电脑焦点，不得调用 macOS Accessibility 或键盘路径，也不得保留上述旧路径的包装器、
回退、迁移解码器或兼容桥。

本地只核验来源字节、哈希、暂存集合和真实附件结果。不得用文件字节上限、TOKEN 估算、
TOKEN 预算、提高阈值或拆分文件阻断获准真实文件；真实 provider 窗口是否接受该文件，
只能由本次真实 Chrome 运行结果证明。

## DOM Inclusion And Exclusion

ChatGPT 加号包含：

```txt
data-testid=composer-plus-btn
或精确 aria-label：Add files / Upload files / 添加文件 / 上传文件
```

排除：

```txt
send / voice / microphone / camera
发送 / 语音 / 麦克风 / 相机
```

本地文件菜单只接受精确可见文本：

```txt
Add photos & files
Upload from computer
添加照片和文件
从电脑上传
```

排除云盘、SharePoint、相机和拍照入口。候选不是唯一值即 `review_required`。

## Success Gate

附件成功不是“选择窗口关了”，而是：

```txt
exact attachment count
+ exact staged display names
+ composer scope
+ 30 continuous seconds stable
= attachments_stable
```

`attachments_stable` 后，主 Web Chat 流程才可进入提示词、发送和回答读取。

## Proof

一次尝试只形成一份聚合证据：

```txt
childCapabilityId
uploadAttemptId
transportKind
expectedFileCount
detectedFileCount
stagingManifestHash
ordered file identities
startedAt / endedAt
status
failureReason / reviewRequiredReason
```

GPT 会话另以同一份 `providerProof` 记录且只记录一种拓扑：

```txt
fresh
  → 新聊天动作 + 提交前 user=0/assistant=0 + 无父 + first marker + child URL
same_conversation
  → 精确父 URL/raw hash/prior marker + actual URL + new marker
forked_from_checkpoint
  → 精确父 URL/checkpoint marker/response hash
  → provider branch action evidence ref/hash
  → 不同 child URL + inherited-history fingerprint + child first marker
```

分叉动作只扩展现有 GPT Web adapter。找不到唯一 branch 控件、父 marker/响应 hash 不符、
子 URL 等于父 URL、子初始历史不含精确 checkpoint 或 provider 不支持分叉时一律失败关闭；
不得改走空白聊天、附件 base、摘要重放或第二 provider。

逐文件信息用于成员身份证明，不得把原生批量选择伪装成逐文件进度。

## Choice And Security Boundary

`GRASSEYE-AI-CHOICE-001-V1` 与 `GRASSEYE-SECURITY-PRIVACY-AI-001-V1` 归 `ai-input-gateway` 唯一 owner。默认 AI 输出只允许受控选择结果；Gateway 只运输 caller-approved refs，不得选择任意文件、输出 browser control 或控制付款、退款、删除、敏感提交。不得增加第二 provider transport 或 business-decision bridge。

## File Plan

```txt
src/capabilities/ai-input-gateway/children/
  attach-approved-web-chat-files-once.ts

src/capabilities/ai-input-gateway/runtime/
  web-chat-scheduler-ledger.ts
  web-chat-concurrency-lease.ts
  web-chat-system-title.ts
  web-chat-response-checkpoint.ts
  web-chat-single-tab-routing.ts
  web-chat-named-conversation-search.ts

src/capabilities/ai-input-gateway/providers/
  web-chat-attachment-transport.ts
  web-chat-exact-target-file-input-attachment.ts

scripts/acceptance/
  ai-input-gateway-attachment.acceptance.ts

scripts/audit/domains/ai-input-gateway/
  manifest.json
  inspector.ts
```

旧 `providers/web-chat-upload.ts` 与旧 ordered-upload acceptance 必须不存在。

## Acceptance

自动验收覆盖：

```txt
0 / 1 / 2 / 17 fixed exact-target routing
public request rejects transport details
source and staging hash identity
unique ordered display names
exact directory membership
aggregate terminal proof
no same-attempt fallback
no clipboard, native picker, focus lease or OS accessibility upload path
no local byte or token admission gate
no local prompt character, byte or token admission gate and no maxInputChars field
no detached provider-input-preflight route, caller, base64 envelope, capacity waiter or upload-clear-reupload graph
no request-body or per-file byte ceiling for governed provider inputs
staging cleanup
old implementation absent
ten independent feeds can occupy ten in-flight slots
capacity overflow waits and later enters without failure
attachment and prompt mutation remains globally serialized
provider generation overlaps after each submit
transient URL converges to canonical URL under the same tab and marked user turn
restart recovery never duplicates a submitted prompt
completed answer is atomically checkpointed and published before browser post-processing
valid checkpoint recovery requires zero live provider-tab or provider-adapter access
post-checkpoint cleanup failure cannot downgrade the production result
recovery rehydrates checkpoint bytes and skips provider analysis
response extraction is scoped after the unique marked user turn
generated-image extraction requires one exact marked user turn, its immediately following assistant turn, one logical image source and one newly downloaded original
full-response web-chat-provider.lock is physically absent
structured task identity is mandatory, input-hash-bound and never acts as a provider chat title
canonical URL plus exact turn marker is the only pre-response provider identity
provider automatic titles are neither queried nor mutated
chat-title generators, DOM mutation, debt, workers, audits and acceptances are physically absent
physical actions raise the exact accessibility window matched to the DOM automation window
offscreen exact sidebar rows are physically scrolled into view before clicking
restart recovery uses canonical URL plus exact marker and never opens a title editor
failed executions preserve a bounded phase and reason ledger
fresh-chat readiness proves zero turns, empty composer, zero attachments and no generation
continuation readiness proves the exact parent URL and fully hydrated prior user and assistant history
checkpoint-fork readiness proves the exact parent marker and following assistant response hash before the provider branch action
fork success proves one distinct child URL, exact inherited checkpoint history fingerprint, action evidence hash and child first marker
unsupported or ambiguous fork fails closed without fresh-chat fallback
submit success proves one exact latest logical-turn marker and durable canonical URL
page-global user-turn count is observational only and never authorizes resubmission
the marked turn and ordered attachment proof persist before post-submit inspection
fresh executions reject a canonical conversation already owned by another execution
explicit continuations alone may reuse their exact parent canonical conversation
```
