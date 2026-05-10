# GrassEye Startup Visual Preflight 单图AI启动检查施工图

## 0. 裁决

启动前如果需要判断页面是否正确、是否登录、是否安全墙、是否 Feed/视频页、是否可以继续，只能走：

```txt
Open target
→ Capture one viewport screenshot
→ Prepare visual mission input
→ AI Prompt Contract startup judgment
→ Orchestration consumes governed decision / optional actionCode
```

非 AI 能力组不得在 AI 之前拆出登录面、安全面、Feed 面、视频面等判断步骤。

## 1. 边界

允许非 AI 做：

```txt
结构性 preflight: config / registry / local AI readiness
打开目标
截图
打包截图和 raw runtime refs
生成坐标图与 gridSpecRef
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

启动 AI Prompt Contract 必须输出受治理 decision、reason 与可选动作；AI 可以判断页面和业务语义，但不能发出原始执行指令。

```txt
decision
reason
blockerStatus
screenState
confidence
riskFlags
actions[].actionCode (optional)
actions[].input (optional)
```

这些 `actions[].actionCode` 字段属于 governed planning tokens，不是 execution authority。

允许的启动期动作必须是受治理白名单，例如：

```txt
WAIT_SHORT
REOPEN_ENTRY_PAGE
STOP_REVIEW_REQUIRED
```

Review semantics:
- `review_required` 是受治理停止状态，不是启动链的自动继续路线。
- `STOP_REVIEW_REQUIRED` 是合法 actionCode，用于停止当前启动轮并把人工处理交给 Commander Console。
- human review gate 只属于 Commander Console / 人工再启动层。

禁止：

```txt
retired branch-token field
legacy route-plan field
retired selection field
retired binding field
raw x/y
free-form browser instruction
```

## 3. 启动链要求

生产启动前视觉判断链只能包含：

```txt
open target
capture viewport
prepare visual mission input
AI startup judgment
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
retired chain script
```

## 4. 执法

执法脚本必须 machine-blocking 检查：

```txt
非 AI 文件不得出现 feedReady/pageReady/pageCorrect/urlMatchesFeedPath
启动期不得出现 retired branch-token field/retired selection field/retired binding field 作为调度真相
Workbench / Page State builder 只能输出 raw runtime signal
Visual Target builder 不得出现 heuristic_profile/map_profile_heuristic/operator_manual
生产启动链不得要求 retired package chain readiness
能力组返回 review_required 时，生产自动化必须 fail/block，不得转人审
```
