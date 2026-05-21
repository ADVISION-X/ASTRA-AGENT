# GrassEye 能力组与子能力总纲施工图

status: active
version: 2026-05-17

## 最高定义

用户给目标。AI 下命令。系统按原子能力执行。证据和日志证明没有越界。

## 当前唯一能力组

1. commander-console
2. orchestration
3. nerve-bus
4. ai
5. open
6. screenshot
7. geometry-guard
8. mouse-click
9. text-input
10. mouse-scroll
11. forensics-persistence
12. dom-automation
13. video-download
14. ai-input-gateway

业务插件 / 任务流不属于能力组。Amazon 发票上传、Product Video DOM Runtime、Facebook 种草视频等流程只能作为 consumer 调用能力组，不能进入能力组清单，也不能成为某个能力组的子能力。

## 物理边界

- 用户只提供需求、平台、完成条件。
- AI 只看用户需求、当前画面、坐标图、能力登记册，并输出一个 `nextAction`。
- 系统只截图、画坐标图、保存证据、校验输入、调度 AI 选择的一个原子能力。
- 调度只把 AI 选择的能力送到对应能力组，不猜、不造、不追加第二步。
- 能力组只执行自己的 child capability。
- DOM 能力组只执行读、找、填、点、等、验、传等 DOM 原子能力；业务插件决定业务目标、业务字段、业务保存和下一步业务流程。
- AI Input Gateway 只执行外部 AI 投喂、provider adapter 调用、响应读取、输出证明和解析状态；业务判断仍归 AI 能立组。

## 禁止复活

- 不存在 page-state、post-action-verification、visual-target 能力组。
- 不存在多动作序列调度。
- 不存在产品 yes/no 分支。
- 不存在兼容、回退、旧路线、第二实现。
