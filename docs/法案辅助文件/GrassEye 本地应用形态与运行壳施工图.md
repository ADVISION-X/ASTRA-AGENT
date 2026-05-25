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

完成态结果展示是首屏主交付面的一部分。Job 已完成时，中央区域不得只显示输入表单、空统计或 raw JSON；必须把持久化的最终交付、记录计数、导出文件和证据引用放在 raw 调试信息之前。

## 当前法门入口

当前页面可暴露：

- Amazon invoice upload：第一成熟 job flow。
- Facebook product video mining：独立 job flow，不得塞进 Amazon 表单。
- Video download skill：受治理的视频下载能力入口；它不是独立 job-flow 主权，也不是第二运行时。

## Deep Research Analysis 交付面

Deep Research Analysis 是独立 job flow。页面只负责展示它的输入、状态和持久化结果，不拥有研究阶段顺序、prompt、parser、最终报告生成或导出算法。

完成态必须显示：

- job status / phase / jobId。
- final report 主结论、置信度、证据缺口、反转条件和 limitations。
- persisted subQuestions / positive answers / falsification answers / exports 计数。
- `final-report.md`、`structured-final-package.json`、`evidence-index.json` 的 export refs、file hash、file path。
- timeline evidence：interactionId、phase、promptHash、rawResponseHash、parsedRecordIds、domRef。

禁止：

- completed 后主区域仍然显示 0 sub questions / 0 answers / 0 exports，而 records 或 exports 已经存在。
- 把 raw result JSON 作为唯一可见交付物。
- 把 final report 藏在 raw JSON 或右侧账本里。
- 隐藏 export artifact refs。
- 页面重新实现 Deep Research prompt、parser、conflict matrix 或导出逻辑。

当最终裁决和 full case file 已存在但 `business-report.html` 缺失时，页面可以展示“重新生成 HTML Report”动作。该动作只能调用本地 workbench API 进入 Deep Research public facade，由 Deep Research 主权代码重新执行同一条主链的 HTML report 段；页面不得自己生成、修补、保存或改写 HTML。

Raw JSON 只能作为折叠审计视图存在，用于排障，不得替代最终报告、export refs 或 evidence refs。

Deep Research 文字报告不得呈现为临时调试页。完成态阅读器必须具备：

- 明确的最终结论视觉焦点。
- 适合长中文段落的 `line-height`、段落间距和阅读宽度。
- 自适应网格，避免把长内容压进 4 个瘦列。
- Prompt、Raw AI Response、Parsed JSON 等审计材料默认折叠到 evidence/details。
- 历史记录、导航、metadata、正文之间有清晰层级，不得让 debug 信息压过报告本体。

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

Telegram Web 接入形态：

- Video Download 面板内部必须用平台顶部导航选择平台，不得把所有平台压进一个普通 capability 下拉框。
- 页面可以在 child capability 下拉中暴露 `download-telegram-web-video-once`。
- 页面必须提示操作者先在本地 Chrome 打开并授权目标 Telegram Web 页面。
- 页面可以提供“读取已打开 Telegram Web 标签页 URL”的按钮；该按钮只读取 URL/title 用于填表，不读取 cookie、storage、消息正文或群组内容。
- 页面不得自动批量列出群组所有视频；允许后续建设“探测当前授权页面的单视频候选/缓存覆盖状态”，但探测结果只能作为 review / start 前提示，不能冒充下载成功。
- Telegram Web 下载仍必须提交一个明确 `sourcePageUrl`，进入 mediator + `video-download-artifact` job flow，由 video-download child 在授权 Chrome 标签页中执行 Service Worker / CacheStorage 探针。
- APP 只展示 `success` / `review_required` / `failed` / `invalid_input`、artifactRef、filePath、sha256、failureReason，不展示群组名称、消息正文、账号身份或 raw progressive URL。

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
- 自动抓取整个 Telegram 群组视频列表
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
- Video Download 输入面是否只暴露 source URL、child capability、quality、max MB、subtitles、Start，以及 Telegram Web 授权页边界提示。
- Video Download route 是否存在 `/api/video-download/start`，且 route 必须经 mediator + job flow 后再调用能力组，页面只展示真实 result 状态。
- 页面是否包含 task status / evidence refs / failure reason 展示区域。
- Deep Research completed delivery surface 是否展示 final report、真实 persisted counts、export refs、evidence hashes，且 raw JSON 只作为折叠审计视图。
- 页面是否仍出现 forbidden dashboard / planner / visual runtime 控制面。
- `src/app/**` 是否直接导入 job flow 文件或能力 runtime 私有实现。
- `src/lib/local-runtime/**` 是否只通过 plugin / ability public facade 导入 job 与能力。
