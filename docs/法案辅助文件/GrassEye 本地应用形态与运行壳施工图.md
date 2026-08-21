# GrassEye 本地应用形态与运行壳施工图

版本：2026-08-21.1
状态：active

## 本地形态

GrassEye 当前是本地 HTTP workbench。它不是 SaaS，不是营销站，不是旧总司令
dashboard，也不是通用自然语言任务机。

页面身份是山门后的任务牌：

```txt
health / mode
-> job flow list
-> structured job input
-> task status and evidence refs
-> local structured activity view
```

## 首屏结构

首屏使用四个稳定区域：

- 顶部状态条：本地 workbench 名称、health、mode。
- 左侧法门列表：每个条目只代表一个已授权 job flow。
- 中央输入面：当前 job flow 的结构化输入。
- 右侧账本窗：当前 task / run 状态、reason、failureReason、evidence refs。

底部可以显示本地活动列表，但只能作为 display channel，不能替代 Runtime Log Spine 或 evidence store。

完成态结果展示是首屏主交付面的一部分。Job 已完成时，中央区域不得只显示输入表单、空统计或 raw JSON；必须把持久化的最终交付、记录计数、导出文件和证据引用放在 raw 调试信息之前。

## 当前法门入口

当前页面可暴露：

- Amazon invoice upload：第一成熟 job flow。
- Video download skill：受治理的视频下载能力入口；它不是独立 job-flow 主权，也不是第二运行时。

## Amazon 输入面

Amazon invoice upload 必须收集：

- marketplace
- sellerCentralEntryUrl
- amazonOrderId
- invoiceNo
- invoicePdf
- requireHumanFinalSubmit

可选：

- adminOrderUrl

提交通过本地 HTTP API 进入 workbench handle，再进入 Amazon job flow。页面不拥有流程顺序。
`src/lib/local-runtime/**` 若需要消费 Amazon 能力，只能通过 `src/plugins/amazon-invoice-upload/index.ts`。

## 禁止项

- 端点说明页冒充 workbench。
- 营销 hero 页面。
- universal mission dashboard。
- old commander console。
- visual runtime control panel。
- AI next-action planner。
- 页面直接控制 DOM、browser、upload、click、fill 或 one-shot verify。
- 页面决定业务流程下一步。
- 页面伪造 evidence 或 task success。
- `src/lib/local-runtime/**` 直接 import plugin 私有文件或 capability 私有文件。

## Workbench Extension 页面通道

这不是第二页面，也不是浏览器控制台。根 Workbench 页面可以无 UI 控件地建立一个固定 CWS MV3 external Port，用于承载 Browser owner 已签发的 schema-bound 帧：

```txt
root Workbench page
  -> fixed chrome.runtime.connect(extension ID, channel name)
      -> fixed same-origin Browser-channel route
          -> Workbench Handle explicit channel facade
              -> Browser owner
```

页面只转发 opaque frame 和显示 `available` / `unavailable` 状态。不得创建 selector、target、command、permit、业务步骤或任务结论；不得使用 `chrome.debugger`、`connectNative`、Native Messaging、WebSocket 旁路或第二 Port。断开、grant 过期、扩展未安装或 sender 校验失败一律显示 unavailable，绝不尝试备用链。

## 对口质检

local-app-shell owner inspector 检查：

- local app shell 法案是否进入 generated registry。
- root page 是否有 workbench shell 标记。
- root page 是否暴露 health / mode 区域。
- root page 是否暴露 job flow list。
- Amazon 输入面是否包含必要字段。
- 页面是否包含 task status / evidence refs / failure reason 展示区域。
- 页面是否仍出现 forbidden dashboard / planner / visual runtime 控制面。
- `src/app/**` 是否直接导入 job flow 文件或能力 runtime 私有实现。
- `src/lib/local-runtime/**` 是否只通过 plugin / ability public facade 导入 job 与能力。
- Browser page channel 是否只有 root Workbench page 一个入口，且没有可见浏览器控制面。
- page adapter 是否只使用固定 external Port 与固定 same-origin route，并且没有 command/permit/selector/target 生成能力。
