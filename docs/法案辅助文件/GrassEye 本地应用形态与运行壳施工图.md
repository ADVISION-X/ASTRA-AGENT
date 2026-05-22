# GrassEye 本地应用形态与运行壳施工图

版本：2026-05-22
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

## 当前法门入口

当前页面可暴露：

- Amazon invoice upload：第一成熟 job flow。
- Facebook product video mining：独立 job flow，不得塞进 Amazon 表单。
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

## Facebook 输入面

Facebook product video mining 必须作为单独法门输入面。页面只允许操作者选择：

- 目标种草视频数量
- Start
- Latest

其余 mission 参数由程序自动完成：

- Facebook feed entry 使用治理默认值或已有授权 Facebook 视频 tab。
- provider kind 使用治理默认值。
- modelName 默认为空。
- max rounds、max minutes、评论加载、视频质量、视频大小、rejected trace 使用 schema 默认策略。
- Not Interested 默认关闭，避免本地 Workbench 启动后对操作者 Facebook 推荐流做负反馈污染。
- AI web-chat 判断必须有硬超时；超时后 run 进入复核终态，不能无限显示 running。
- AI web-chat 上传完成等待必须短上限；AI judgment failure 保存候选后必须终止本次 mission 为复核态。
- AI web-chat 上传/提交/读回答前必须重新聚焦 provider workspace tab，防止 Chrome active tab drift。
- 首次没有保存 workspace URL 时必须打开 provider 入口并保存实际 workspace URL，不得复用任意旧 ChatGPT 会话或按标题匹配旧会话。
- 文件上传必须优先使用已定位 provider file input，剪贴板文件粘贴只能作为后备，禁止把本地文件路径打进错误页面或 Chrome 查找栏。
- Start 后页面自动轮询当前 run，展示 saved product count / target count。
- 页面展示 saved `PRODUCT_SEEDING` records，并提供 Export JSON 给高级 AI 选品。

`src/lib/local-runtime/**` 若需要消费 Facebook product video mining，只能通过 `src/plugins/facebook-product-video-mining/index.ts`。

是否产品视频、是否保存线索、是否继续下一轮，仍归对应 job flow 和能力组。

禁止在页面重新暴露：

- Facebook feed URL
- Provider selector
- Model
- Max rounds
- Max minutes
- advanced options / hidden second configuration panel
- 把 rejected、uncertain、review_required 或 failed 候选显示为成功记录
- 导出 cookies、tokens、localStorage、sessionStorage 或完整 HTML

## Video Download 输入面

Video download skill 必须作为独立受治理 job flow 入口展示。页面只允许操作者提供：

- Source page URL
- Capability child id
- Preferred quality
- Max MB
- Download subtitles
- Start

提交通过本地 HTTP API 进入 `src/mediator/**`，再进入 `src/plugins/video-download-artifact/**` job flow，由该 flow 调用 `video-download` public facade。
页面不拥有下载算法、平台探针、业务价值判断、能力组调用或批量编排。

下载结果必须进入右侧账本窗展示真实状态：

- `success`
- `failed`
- `review_required`
- `invalid_input`

失败或复核态必须展示 `failureReason`、`reviewRequiredReason` 或 result reason，
不得把候选缺失、登录墙、DRM、CAPTCHA、私密视频、下载过期、文件无效显示成成功。

`src/lib/local-runtime/**` 若需要消费 Video Download 能力，只能通过
`src/capabilities/video-download/index.ts`。

禁止在页面重新暴露：

- 外部 downloader 站点
- 去水印 API
- CAPTCHA / DRM / 登录绕过开关
- cookie、token、localStorage、sessionStorage 导出
- 批量下载编排面板
- 截图或封面图冒充完整视频 artifact

## 禁止项

- 端点说明页冒充 workbench。
- 营销 hero 页面。
- universal mission dashboard。
- old commander console。
- visual runtime control panel。
- AI next-action planner。
- 页面直接控制 DOM、browser、upload、click、fill、wait、verify。
- 页面决定业务流程下一步。
- 页面伪造 evidence 或 task success。
- `src/lib/local-runtime/**` 直接 import plugin 私有文件或 capability 私有文件。

## 对口质检

local-app-shell owner inspector 检查：

- local app shell 法案是否进入 generated registry。
- root page 是否有 workbench shell 标记。
- root page 是否暴露 health / mode 区域。
- root page 是否暴露 job flow list。
- Amazon 输入面是否包含必要字段。
- Facebook 输入面是否只暴露目标数量、Start、Latest。
- Video Download 输入面是否只暴露 source URL、child capability、quality、max MB、subtitles、Start。
- Video Download route 是否存在 `/api/video-download/start`，且 route 必须经 mediator + job flow 后再调用能力组，页面只展示真实 result 状态。
- 页面是否包含 task status / evidence refs / failure reason 展示区域。
- 页面是否仍出现 forbidden dashboard / planner / visual runtime 控制面。
- `src/app/**` 是否直接导入 job flow 文件或能力 runtime 私有实现。
- `src/lib/local-runtime/**` 是否只通过 plugin / ability public facade 导入 job 与能力。
