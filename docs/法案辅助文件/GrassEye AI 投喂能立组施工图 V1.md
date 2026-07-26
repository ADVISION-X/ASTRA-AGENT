# GrassEye AI Input Gateway 施工图 V2

status: construction-blueprint
version: 2026-07-26
authority: `.github/instructions/agent-rules/modules/module-ai-input-gateway.instructions.md`

## Boundary

```txt
调用方决定：给哪个 provider、提示词是什么、哪些文件获准进入输入包。
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

一个 BrowserController 只控制一个物理 ChatGPT 标签页。独立 feed 各自在这个标签页中
创建一个全新聊天；附件、提示词填写、发送、等待侧栏标题、点击聊天选项、重命名、切换聊天、
DOM 抓取与清理共享容量为一的短时 browser-mutation lease。聊天完成系统重命名并证明
“聊天名＋提示词 marker”后立即释放短锁，服务端生成等待不持锁。

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
→ response_captured
→ cleanup_completed
```

每个 attempt 内部持久化 opaque attempt id、随机 turn marker、submitted prompt hash、
系统聊天名、自动标题观察值、重命名核验时间、临时 URL、正式 URL、user turn identity、
回答 hash 与稳定轮次。外部请求和
Xuanyuan 公共结果不接受这些运输控制字段。

回答必须从“包含本 attempt marker 的唯一 user turn”向后绑定 assistant turn；不得读取
页面最后一条 assistant 作为任务结果，也不得要求模型复述 marker。

容量已满时公平排队，不失败、不增加物理 ChatGPT 标签页。默认每 60 秒巡查一次：

```txt
抢占短时浏览器操作锁
→ 在同一标签页按系统聊天名定位并点击
→ 校验 DOM 中恰有一个本任务 marker
→ 只读取该 user turn 后面的 assistant turn
→ 释放短锁
```

进程重启只能按持久化系统聊天名重新打开聊天并以 marker 复核后继续轮询；身份不唯一时
进入 `review_required`，禁止再次发送提示词。

ChatGPT 普通请求频率限流是最高优先级生存动作，不进入聊天搜索或回答解析：

```txt
DOM 出现“请求过于频繁 / too many requests”等普通限流对话框
→ 秒点唯一“明白了 / OK / Got it”
→ 立即刷新当前会话所在的同一个物理标签页
→ 页面恢复后按系统聊天名＋marker 回到原任务
```

这个动作不得开新标签页、开新聊天、重启任务或重发提示词。每次弹出都重复同一固定序列，
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
response extraction is scoped after the unique marked user turn
full-response web-chat-provider.lock is physically absent
```

真实 Chrome 验收覆盖：

```txt
1 file complete prompt/response flow
10 files complete prompt/response flow
17 files complete prompt/response flow
exact filenames and count
30-second stable gate
formal prompt submitted only after stable
provider response captured with proof
```
