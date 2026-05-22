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

是否产品视频、是否保存线索、是否继续下一轮，仍归对应 job flow 和能力组。

禁止在页面重新暴露：

- Facebook feed URL
- Provider selector
- Model
- Max rounds
- Max minutes
- advanced options / hidden second configuration panel

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

## 对口质检

local-app-shell owner inspector 检查：

- local app shell 法案是否进入 generated registry。
- root page 是否有 workbench shell 标记。
- root page 是否暴露 health / mode 区域。
- root page 是否暴露 job flow list。
- Amazon 输入面是否包含必要字段。
- Facebook 输入面是否只暴露目标数量、Start、Latest。
- 页面是否包含 task status / evidence refs / failure reason 展示区域。
- 页面是否仍出现 forbidden dashboard / planner / visual runtime 控制面。
- `src/app/**` 是否直接导入 job flow 文件或能力 runtime 私有实现。
