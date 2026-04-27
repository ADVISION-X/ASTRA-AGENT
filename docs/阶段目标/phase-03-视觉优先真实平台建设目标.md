# GrassEye 第三阶段建设目标

## 阶段目标

将 GrassEye 从 fixture/demo 本地闭环升级为真实网页单平台无人值守 Agent MVP。

## 主模式

- Primary: Vision-first Coordinate Mode
- Fallback: Playwright / DOM Semantic Mode

## 硬边界

- 使用本机可见浏览器与用户授权会话
- 不导出 cookie/session/token
- 不做 stealth、anti-detection、proxy pool、account pool、fingerprint spoofing
- 不绕过登录、验证码、风控
- 不自动评论、私信、关注
- 出现登录页、验证码、未知 UI、低置信度目标、窗口漂移时必须 pause/stop/review

## 阶段完成态

- 至少一个真实网页视频平台 adapter 可用
- Workbench 明确显示 Real Platform Mode
- Agent 可无人值守连续观察、截图、判断、有限动作、评论截图、候选生成
- 审计、构建、启动链通过
- 第三阶段验收报告与真实平台实测记录落盘