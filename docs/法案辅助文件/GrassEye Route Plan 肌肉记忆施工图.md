# GrassEye Route Plan 肌肉记忆施工图

## 1. 红线

Route Plan 是调度肌肉记忆的唯一来源。

- 地图只能声明入口步骤、AI 步骤、Prompt Contract 引用和 `routePlanId`。
- 生产自动化地图必须使用 `routePlanBoundMap`，只保留入口脊柱和 AI 交付，不拥有 routeLabel 动作链。
- `genericDiagnosticMap` 只能服务隔离诊断，不得绑定 Route Plan，不得进入生产自动化主链。
- 地图禁止复制 Route Plan 已经接管的步骤、transition、routeLabel 或动作链。
- Prompt Contract 决定 AI 输出 `decision + routeLabel + reason + confidence + nonExecutableSummary`。
- `nonExecutableSummary` 只能记账，不能调度；禁止 `nextIntent`、`suggestedNextAction`、`actionIntent`、`action_intent` 进入 AI 输出。
- Orchestration 只能机械匹配 `routeLabel`，不能理解、推断或硬编码 `product_yes/product_no` 的下一步。
- 自动化地图严禁人工审查动作，严禁 `review_required` 终态。
- Route Plan 不负责启动前页面语义检查；启动前页面/视觉/业务判断只能来自单图 AI Prompt Contract。
- Route Plan 消费 AI 的 `routeLabel` 和 AI target candidate refs，但不得解释页面语义，也不得要求 Page State/PAV 在 AI 前判断登录、安全墙、Feed 或视频页。

## 2. 单一来源

产品发现默认肌肉记忆定义在：

`src/map-plugins/route-plans/product-discovery-route-plan.constants.ts`

`src/map-plugins/route-plans/product-discovery-route-plan.v1.ts`

这两个文件共同定义：

- 用户二元选项清单。
- 默认正向 routeLabel。
- 默认负向 routeLabel。
- routeLabel 到步骤链的匹配表。
- 每个步骤要调用的能力组和子能力。

地图包只能引用：

`"routePlanId": "product-discovery-route-plan.v1"`

## 3. 执法要求

执法必须失败以下情况：

- 地图缺少必须的 `routePlanId`。
- 地图重新写入 Route Plan 已经拥有的步骤。
- Route Plan 缺少 `routeLabel -> step chain`。
- Prompt 或运行时硬编码 routeLabel，而不是引用 Route Plan 常量。
- Orchestration 根据 `decision` 推断动作。
- 自动化路线进入人工审查。
- Route Plan 或地图在 first AI step 前插入 `observe-login-surface`、`observe-safety-surface`、`observe-feed-surface`、PAV 语义验证或 URL/DOM 页面判断。

## 4. 当前产品发现默认路线

`product_yes` 默认输出：

`read-comments-and-save-evidence`

匹配链路：

`observe-comments-button -> normalize-comments-target -> click-comments-button -> verify-comments-open -> capture-comments-panel -> analyze-comment-intent -> persist-seeding-candidate-record -> observe-next-video-region -> normalize-next-video-region -> scroll-next-video -> capture-video-viewport`

`product_no` 默认输出：

`skip-current-video`

匹配链路：

`observe-next-video-region -> normalize-next-video-region -> scroll-next-video -> capture-video-viewport`
