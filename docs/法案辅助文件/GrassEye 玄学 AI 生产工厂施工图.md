# GrassEye 玄学 AI 生产工厂施工图

状态：active V5.1 restart-resume
法案：`APEX-XUANXUE-AI-PRODUCTION-001-V3`
唯一 owner：`xuanxue-ai-production`

## 接入

```txt
xuanxue-web canonical V5 manifest
  -> AGENT outbound Cloud Pull Worker
  -> src/mediator/xuanxue-ai-production-route.ts
  -> src/plugins/xuanxue-ai-production/
  -> public capability facade / Browser exact-target
  -> checkpoint or first-terminal CAS
```

Cloud Worker 只拉取、验 V5 grant、持久化传递并回传；它不拥有业务步骤，也不直连 Browser 或
Plugin private implementation。Plugin 固定 `max_in_flight=1`，先 fsync local identity，再以
serverNow、lease expiry、完整 RTT 与 10 秒安全边际计算相对 deadline budget。每项 checkpoint 和
terminal 都携带 job/attempt/device/leaseVersion/fence/payload hash。

## 删除式迁移

只保留 `xuanxue-ai-production-v5`。V4 decoder/encoder、旧 HMAC/LNA/localhost 外部入口、Cloud
callback、per-job approval、第二 worker/mediator/store/provider/browser transport 物理删除。V4
非终态订单只可在 Cloud 侧先 terminal 或 `review_required`，不得被 V5 reader 消费。local-ui
status/pause/cancel/takeover/resume 继续走唯一 Workbench API，不能变成外部业务入口。

## 执行和恢复

从 Cloud grant 到 Browser command 的每一步都重新验证 canonical manifest hash、required device、
lease version、fence、Workspace、Authority、Target、Document、actionId 与相对 TTL。任何缺失、
漂移、过期、零/多目标、foreign device 或 payload 冲突，Browser action count 必须为零。

Workspace 只由当前连接上的人工配对与 HTTPS 标签认领原子建立，不设 8 小时或其他墙钟过期，
也没有独立 approval API/UI。真实断线或 Workbench/Extension/Chrome 重启后，任务保持同一
`recovery_pending`、job、attempt、checkpoint 与 fence；操作者重新配对认领后，Cloud claim 必须
先恢复 `created_at + job_id` 最早的未完成任务。`BROWSER_EXTENSION_CHANNEL_UNAVAILABLE`、
`BROWSER_LIVENESS_EXPIRED`、`BROWSER_SESSION_WORKSPACE_REQUIRED` 和网络故障不得写业务
`failed`，不得清理恢复现场，也不得改走第二队列。

Browser mutation 使用 `PREPARED -> SEND -> CONFIRMED | FAILED | UNKNOWN`。`UNKNOWN` 不自动
重放；只有 owning Plugin 基于同一页面的正向确认、反向排除、唯一候选和有界停止可作 outcome
resolution，否则 `review_required`。结果使用 first-terminal CAS；同 payload 的同 terminal 可重读，
其它竞争或迟到写入不得覆盖。

## 验收边界

静态 acceptance 必须覆盖 V5 schema/hash、fsync identity、lease/fence/deadline、无墙钟过期的
connection-bound Workspace、浏览器断线 `recovery_pending`、最早未完成任务优先、单 in-flight、
terminal CAS、cancel/handover、UNKNOWN 禁重放、旧路径为零与 secret redaction。静态
PASS 不代表真实 Provider 或 Chrome；没有另行授权的真实 Chrome 前固定
`CHROME_VERIFIED=false / NOT_PRODUCTION_VERIFIED`。
