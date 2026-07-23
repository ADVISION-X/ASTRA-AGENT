# GrassEye AI Input Gateway 施工图 V2

status: construction-blueprint
version: 2026-07-24
authority: `.github/instructions/agent-rules/modules/module-ai-input-gateway.instructions.md`

## Boundary

```txt
调用方决定：给哪个 provider、提示词是什么、哪些文件获准进入输入包。
Gateway 决定：怎样安全送达、怎样证明送达、怎样取回原始回答。
```

外部请求不接受 transport、selector、coordinate、tabId、文件选择器动作或 fallback 策略。

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
