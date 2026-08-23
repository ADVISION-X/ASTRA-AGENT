# GrassEye 逐插件本地干预终态施工图

status: active
version: 2026-08-21.terminal

## 唯一主链

Local Workbench -> explicit plugin route -> named Workbench Handle method -> plugin public facade -> plugin-owned task store expectedRevision CAS -> plugin-owned safe point acknowledgement。

pause/cancel/takeover/resume 是整任务请求。Route/App/Mediator/Local Runtime 不保存状态、不决定下一步、不访问 Browser 私有实现。Plugin 先持久化请求事件，再按 `taskId + expectedRevision` 做 CAS；stale revision 必须零写入失败。成功 ACK 后不得开始下一条 Browser、AI 或下载命令。外部副作用结果不明进入 `review_required`，禁止自动重放。

Plugin 自有状态只复用各自 task store，不建立中央干预表：

```txt
interventionRevision
interventionState
pendingIntervention { requestId, action, reason, requestedAt, expectedRevision }
checkpoint
```

状态只允许 `running | pause_requested | paused | cancel_requested | cancelled | takeover_requested | taken_over | review_required`；不得保留旧枚举、别名或兼容 reader。

## Owner 与安全点

| Plugin owner | 唯一持久化 owner | 必须命中的安全点 | 不确定结果 |
| --- | --- | --- | --- |
| `amazon-invoice-upload` | invoice task/ledger store | item 前后、file attach 前、submit 前、result/ledger 后 | 已提交无可信结果即 `review_required`，不重传 |
| `amazon-product-mining` | mining task store | keyword、search、detail、reviews、AI submit/raw checkpoint、package commit | AI 结果不明即 `review_required`，不重提 |
| `xuanxue-ai-production` | xuanxue SQLite/WAL order store | Cloud order fsync、stage feed、response checkpoint、join、terminal CAS 前 | mutation `UNKNOWN` 只由该 Plugin 有界裁决；无法确认即 `review_required` |

## Browser 规则

BrowserTargetRef/BrowserDocumentRef 只属于当前 Browser Authority epoch，不能持久化 raw tab/window/debuggee。pause/cancel/takeover、navigation、detach、revoke 后旧 ref 失效；resume 必须从 owning plugin checkpoint 经 Browser public facade 重新验证当前 Session Workspace，并为每条命令动态取得唯一 Authority/Target/Document，不存在逐 job 或 operator-claimed Target/Document approval。没有 active-tab/URL-first/first-page fallback、OS 输入、系统 picker 或第二控制链。

`xuanxue-ai-production` 的唯一业务入口是：

```txt
outbound Cloud Worker
-> V5 grant/manifest/fence/deadline verification
-> unique Mediator route
-> xuanxue-ai-production Plugin durable local order
```

干预只作用于已经由 Cloud Worker fsync 后交给 Plugin 的本地订单。Cloud Worker 继续只拥有出站 claim/heartbeat/download/checkpoint/first-terminal-CAS transport，不接受人工 action 或 stage mutation，不直连 Browser/capability/private Plugin 文件。不存在 inbound whole-order、HMAC/LNA/localhost business route、Cloud callback、第二 worker、第二 ledger 或第二结果通道。

## 响应预算与恢复

- queue/dequeue 边界 1 秒内停止新命令；一般 DOM/item/round 边界 3 秒；xuanxue 新 stage 边界 2 秒。
- 已提交 provider/download/upload 只等待 owner 既有 timeout/checkpoint；等待期间不得触发新的页面动作。
- timeout 不是继续运行授权；owner 必须留下 failure reason、checkpoint 与 evidence refs。
- takeover ACK 先撤销当前 Target/Document；resume 从同一 Plugin checkpoint 经 Browser public facade 重新取得当前 Workspace/Authority/Target/Document，旧 ref 永久不可复活。

Workbench 只暴露逐 Plugin 具名方法：

```txt
read<Task>InterventionStatus(taskId)
pause<Task>({ taskId, expectedRevision, reason, requestId })
cancel<Task>({ taskId, expectedRevision, reason, requestId })
takeover<Task>({ taskId, expectedRevision, reason, requestId })
resume<Task>({ taskId, expectedRevision, reason, requestId })
```

外部输入不得含 `stageId/selector/coordinate/browserCommand/nextAction/actionPlan/rawTabId/windowId`。UI 只投影 Plugin 返回的 revision、state、checkpoint、pending request 和 failure reason。

## 验收

每个 active plugin deterministic acceptance 覆盖 safe point、CAS、stale zero write、external side effect non-replay、owner boundary 与禁字段。real Chrome/provider acceptance 单列证明真实 target、暂停预算和恢复；静态/fixture 不替代。
