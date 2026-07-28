# GrassEye AI Input Gateway 施工图 V2

status: construction-blueprint
version: 2026-07-27
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

一个 BrowserController 只控制一个物理 ChatGPT 标签页。独立 feed 各自在这个标签页中
创建一个全新聊天；附件、提示词填写、发送、提交证据、完成后点击该聊天行的选项、重命名、
切换聊天、DOM 抓取与清理共享容量为一的短时 browser-mutation lease。提交后先记录正式会话
URL 与提示词 marker 并立即释放发送短锁，服务端生成等待不持锁；回答完成后才允许锁定非
`/c/WEB:` 的正式侧栏行，点击该行自己的选项并完成系统重命名。顶部“对话选项”不得作为
重命名入口。文章进入发布链前必须证明“系统聊天名＋提示词 marker”。

回答生成期间的巡查也不得用浏览器 URL open 直达历史会话。系统必须在同一标签页内查找
正式侧栏行：重命名前按已记录的 canonical pathname 唯一锁定该行，点击后核验 marker；
重命名后按系统聊天名唯一锁定该行，点击后再次核验 marker。两种阶段都属于 DOM 聊天切换，
不是刷新或重新打开页面。

每次短时浏览器操作取得锁后，必须先枚举 provider host 标签：

```txt
精确 1 个 → 聚焦该标签，再执行聊天内动作
0 个       → 只有首次打开允许创建 1 个
多于 1 个 → review_required，禁止选择“第一个”继续
```

首次打开使用 `reuse-host-tab`，禁止把当前 active 的网站、Amazon 或其他普通标签改写成
ChatGPT。聊天轮询、限流恢复、重命名和回答读取都必须先重新聚焦这一个 provider 标签，
不得假设当前前台标签仍是 ChatGPT。

Chrome 的“自动化窗口”和物理鼠标实际点击的“辅助功能窗口”必须是同一个窗口。每次物理
点击、悬停、按键或截图前，先按完整窗口坐标和尺寸做唯一匹配，再对该精确窗口执行
`AXRaise`。只调用 Chrome `activate`、只取辅助功能 `window 1`，或者让前台的登录选择器、
未登录窗口承接已登录窗口的 DOM 坐标，全部禁止。匹配为 0 或大于 1 时 fail closed。

侧栏行即使存在 DOM，只要中心点落在浏览器可视区之外，就不允许点击该坐标。系统必须把
真实滚轮锚定在侧栏，把精确 canonical URL 或系统名称对应的行滚进可视区，重新定位后再
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

完整 `taskIdentity` 进入 input hash。它不是聊天标题输入框，也不允许自由文本标题。

每个 attempt 内部持久化 opaque attempt id、随机 turn marker、submitted prompt hash、
系统聊天名、自动标题观察值、重命名核验时间、临时 URL、正式 URL、user turn identity、
回答 checkpoint、回答 hash、稳定轮次，以及最近 20 条失败账。失败账必须包含发生时间、
attempt id、失败前 phase、分类、是否可恢复和受限长度 reason；后续恢复成功不得抹掉旧失败。
外部请求和
Xuanyuan 公共结果不接受这些运输控制字段。

系统聊天名必须同时服务人类巡查与机器精确定位，唯一格式是：

```txt
内部任务标签｜UTC月-日 时:分Z｜8位执行追踪-4位标记追踪

例如：
SEO资料研究｜07-26 04:40Z｜A9F193A3-489B
八字分析｜07-26 04:41Z｜71C2E90F-3A10
```

内部任务标签只由 Gateway 按 `taskIdentity.labelKey` 精确映射；`generic_ai` 显示 `AI任务`。
标题不得复制提示词、用户姓名、报告正文，也不得接受调用方提供的自由文本。旧的纯
`GRASSEYE-哈希-标记` 机器标题生成区必须删除，不保留兼容命名器或桥接命名器。

回答必须从“包含本 attempt marker 的唯一 user turn”向后绑定 assistant turn；不得读取
页面最后一条 assistant 作为任务结果，也不得要求模型复述 marker。

容量已满时由上游有界生产窗口公平排队，不失败、不增加物理 ChatGPT 标签页。Gateway
只接收已经进入生产窗口的 feed，不感知网站尚未领取的无限订单。运维参数
`WEB_CHAT_PATROL_INTERVAL_MS` 只能取 1 至 60 秒，默认每 5 秒巡查一次；调用方不能修改：

```txt
仍有 admitted 任务等待发送 → 巡查让路
所有待发送任务已逐个记录 → 巡查取得短时浏览器操作锁
→ 在同一标签页按系统聊天名定位并点击
→ 校验 DOM 中恰有一个本任务 marker
→ 只读取该 user turn 后面的 assistant turn
→ 回答完成
→ 原子写入回答正文、hash、byteCount、capture time、provider page URL
→ 状态 response_checkpointed
→ 点击非 WEB 临时态的正式侧栏聊天行
→ 在一个不可穿插的短巡查片区内，只点击该行自己的对话选项、填写名称、回车提交
→ 证明系统聊天名＋marker
```

这里的优先级是固定的：

```txt
普通限流弹窗的唯一确认动作
→ 已接收但尚未完成附件＋提示词提交的任务
→ 已提交任务的短周期巡查、回答读取与完成后重命名
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

回答完成后的重命名不是几个可相互穿插的散乱动作，而是一笔原子事务：

```txt
取得短时独占巡查锁
→ 按 canonical pathname 打开目标聊天并核对 marker
→ 悬停并点击该聊天行自己的选项
→ 点击重命名
→ 写入人类可读系统名称并回车
→ 以系统名称＋marker 复核
→ 释放短锁
```

这笔事务执行期间，其他任务不得切换同一标签页。菜单、标题输入框、真实点击提交或新名称
回显暂时没有准备好时，必须释放短锁并在下一次巡查重做整笔事务；已经读取完成的回答继续
从 checkpoint 复用，状态进入 `recovery_pending`，不得因此进入终态或再次请求 AI。
若进程恰好断在标题输入框已打开、但回车尚未提交的片段，恢复链必须识别该输入框并原地
补完，不得因为侧栏链接临时被输入框替换而永久等待。整笔重命名重试受任务 timeout 约束，
禁止无限占用容量。
只有出现多个目标、marker 重复/不匹配、名称身份冲突
或任务总超时耗尽，才允许终止。

回答完成必须同时通过生成态检查。只要精确 assistant turn 仍缺少完成操作，或实时 DOM 中
存在可见的 `thinking / reasoning / loading / shimmer` 进度节点，就仍是 generating。
“正在核对引用”“正在读取文件”“工具执行摘要”等中间文字不是最终回答，禁止据此提前重命名。

进程重启只能按持久化正式 URL / 系统聊天名重新打开聊天并以 marker 复核。没有回答
checkpoint 时继续轮询；已有 checkpoint 时直接读取本地回答并只补做改名、证据投影和发布。
身份不唯一时进入 `review_required`，禁止再次发送提示词。

附件一旦已经记录为 `attachments_stable`，并且正式聊天 URL 与带 marker 的用户消息均已
持久化，恢复链只允许核对持久化的输入哈希、逐件附件顺序/名称/哈希/字节数、正式聊天 URL
和 marker。调用方的上游临时目录在完成提交后可以立即消失；恢复链不得再次 `stat`、读取或
上传这些一次性源路径，也不得因源路径消失而重复发送提示词。

ChatGPT 普通请求频率限流是最高优先级生存动作，不进入聊天搜索或回答解析：

```txt
DOM 出现“请求过于频繁 / too many requests”等普通限流对话框
→ 秒点唯一“明白了 / OK / Got it”
→ 保持当前会话原地不动，禁止刷新或重载
→ 等候同一页面的实时 DOM 恢复后，按系统聊天名＋marker 继续原任务
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
GPT Web Chat + 1 file           -> ordered_clipboard
GPT Web Chat + 2 or more files  -> native_picker_batch
Gemini Web Chat + any files     -> ordered_clipboard
```

不存在调用方选择，不存在同一次尝试内换路。

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

## Ordered Clipboard Transport

每个文件只执行一次：

```txt
focus composer
-> copy one staged file object
-> activate Chrome
-> refocus composer
-> paste
-> prove exact cumulative count and names
```

任一步失败即结束本次子能力，不重贴、不换路。

## Native Picker Batch Transport

Gateway 的 ChatGPT 页面适配器只负责：

```txt
唯一可见的附件加号
-> 唯一本地文件菜单项
-> 原生文件选择窗口出现
```

通用 Browser primitive 只负责：

```txt
确认唯一原生 sheet
-> Command+Shift+G
-> 输入已验证暂存目录
-> 证明全部期望文件可见
-> 聚焦文件列表
-> Command+A
-> 证明唯一且可用的 Open/打开按钮
-> AXPress
-> 证明 sheet 关闭
```

它不出现 ChatGPT、Gemini、SEO、八字、奇门或业务任务词。

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

逐文件信息用于成员身份证明，不得把原生批量选择伪装成逐文件进度。

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
  web-chat-ordered-clipboard-attachment.ts
  web-chat-native-picker-attachment.ts

src/lib/browser/
  current-chrome-native-multi-file-picker.ts

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
0 / 1 / 2 / 17 fixed routing
public request rejects transport details
source and staging hash identity
unique ordered display names
exact directory membership
aggregate terminal proof
no same-attempt fallback
staging cleanup
old implementation absent
ten independent feeds can occupy ten in-flight slots
capacity overflow waits and later enters without failure
attachment and prompt mutation remains globally serialized
provider generation overlaps after each submit
transient URL converges to canonical URL under the same tab and marked user turn
restart recovery never duplicates a submitted prompt
completed answer is atomically checkpointed before rename and survives rename/process failure
recovery rehydrates checkpoint bytes and skips provider analysis
response extraction is scoped after the unique marked user turn
full-response web-chat-provider.lock is physically absent
structured task identity is mandatory, input-hash-bound and never acts as free-text title
system chat titles expose the task identity allowlisted label, UTC minute and short opaque trace
system chat titles never copy prompt text, user names, report content or legacy machine-only format
physical actions raise the exact accessibility window matched to the DOM automation window
offscreen exact sidebar rows are physically scrolled into view before clicking
restart recovery completes a title editor left open by process interruption
completed-chat rename retries are bounded by task timeout
failed executions preserve a bounded phase and reason ledger
```

真实 Chrome 验收覆盖：

```txt
10 independent GPT feeds share one physical tab without task crossover
one durable submitted turn survives process interruption without duplicate submission
one checkpointed answer survives interruption during rename and completes the exact system title
1 file complete prompt/response flow
10 files complete prompt/response flow
17 files complete prompt/response flow
exact filenames and count
30-second stable gate
formal prompt submitted only after stable
provider response captured with proof
```
