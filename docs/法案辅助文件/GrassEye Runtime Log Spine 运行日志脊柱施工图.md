# GrassEye Runtime Log Spine 运行日志脊柱施工图

版本：2026-05-21  
状态：active

## 1. 当前定位

Runtime Log Spine 是当前 job-flow workbench 的结构化运行日志规范。

当前只保留三类可见性：

- `FLOW`
- `DEBUG`
- `TRACE`

## 2. 日志必须描述什么

- 当前步骤
- 状态
- 原因
- 相关 ref
- 持续时间

## 3. 日志不能替代什么

- 不能替代 evidence store
- 不能替代任务状态记录
- 不能替代业务结果真相

## 4. 当前日志 owner

- `amazon-invoice-upload`
- `dom-automation`
- `browser-session`
- `forensics-persistence`
- `ai-input-gateway`
- `local-runtime`
- `startup-entrypoint`

## 5. 当前 redaction 要求

- 不写 cookie
- 不写 token
- 不写密码
- 不写敏感 PDF 内容
- 不把 provider secrets 打进日志

## 6. 禁止项

- 旧 owner matrix 宇宙
- 以日志伪装 evidence
- 用 warning 掩盖 hard failure
- 让日志 schema 继续承载退役主链