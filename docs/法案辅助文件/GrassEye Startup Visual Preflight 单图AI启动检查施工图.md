# GrassEye Startup Visual Preflight 单图AI启动检查施工图

## 0. 裁决

启动前如果需要判断页面是否正确、是否登录、是否安全墙、是否 Feed/视频页、是否可以继续，只能走：

```txt
Open target
→ Capture one viewport screenshot
→ Prepare AI input
→ AI Prompt Contract startup judgment
→ Orchestration mechanically consumes routeLabel
```

非 AI 能力组不得在 AI 之前拆出登录面、安全面、Feed 面、视频面等判断步骤。

## 1. 边界

允许非 AI 做：

```txt
结构性 preflight: map/binding/config/local AI readiness
打开目标
截图
打包截图和 raw runtime refs
运输 envelope
schema/坐标/证据完整性校验
```

禁止非 AI 做：

```txt
feedReady / pageReady / pageCorrect
login/captcha/safety/feed/video/comment surface 判断
URL 推导页面正确性
DOM 推导页面语义
截图 hash/diff 推导视频语义
Visual Target 自造 heuristic target
PAV 判断页面语义
```

## 2. AI 输出

启动 AI Prompt Contract 必须输出二元 routeLabel 和非执行摘要。AI 可以判断页面和业务语义，但不能发出点击、滚动、输入、打开、Nerve Bus dispatch 或 Forensics 写入命令。

```txt
routeLabel
pageUnderstanding
blockerStatus
videoUnderstanding
targetCandidates
confidence
nonExecutableSummary
```

`routeLabel` 是唯一可被调度机械匹配的字段；其他字段只用于证据、日志和后续能力输入。

## 3. 地图要求

生产 `routePlanBoundMap` 的 AI 前入口脊柱只能包含：

```txt
open target
capture viewport
prepare AI input
AI startup/product judgment
```

禁止：

```txt
observe-login-surface
observe-safety-surface
observe-feed-surface
detect-login-state
detect-safety-page
detect-feed-ready
verify-page-opened 语义验证
request-human-review
review_required route
```

## 4. 执法

执法脚本必须 machine-blocking 检查：

```txt
非 AI 文件不得出现 feedReady/pageReady/pageCorrect/urlMatchesFeedPath
Workbench Page State builder 只能输出 raw_runtime_signal
Visual Target builder 不得出现 heuristic_profile/map_profile_heuristic/operator_manual
生产内置地图 first AI step 前不得出现 page-state/PAV 语义检查
能力组返回 review_required 时，生产自动化路由必须 fail/block，不得转人审
```
