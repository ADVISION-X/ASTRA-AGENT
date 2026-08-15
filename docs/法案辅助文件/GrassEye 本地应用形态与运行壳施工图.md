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
- Video download skill：受治理的视频下载能力入口；它不是独立 job-flow 主权，也不是第二运行时。

## Deep Research Analysis 交付面

Deep Research Analysis 是独立 job flow。页面只负责展示它的输入、状态和持久化结果，不拥有研究阶段顺序、prompt、parser、最终报告生成或导出算法。

New Research 输入面必须是稳定可输入表单。运行中 job 的状态轮询、历史刷新、报告重绘、Latest/Refresh 读取不得在用户已经打开表单、焦点位于表单内，或 `User Question` / `Analysis Goal` 存在草稿内容时自动收回输入面。只有用户显式点击 Hide New Research、提交 Start 后，或用户主动选择报告且表单没有焦点和草稿时，页面才可以收起输入面。

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

## 对口质检

local-app-shell owner inspector 检查：

- local app shell 法案是否进入 generated registry。
- root page 是否有 workbench shell 标记。
- root page 是否暴露 health / mode 区域。
- root page 是否暴露 job flow list。
- Amazon 输入面是否包含必要字段。
- 页面是否包含 task status / evidence refs / failure reason 展示区域。
- Deep Research New Research 输入面是否在轮询刷新中保留打开状态，并在收起前检查焦点和草稿内容。
- Deep Research completed delivery surface 是否展示 final report、真实 persisted counts、export refs、evidence hashes，且 raw JSON 只作为折叠审计视图。
- 页面是否仍出现 forbidden dashboard / planner / visual runtime 控制面。
- `src/app/**` 是否直接导入 job flow 文件或能力 runtime 私有实现。
- `src/lib/local-runtime/**` 是否只通过 plugin / ability public facade 导入 job 与能力。
