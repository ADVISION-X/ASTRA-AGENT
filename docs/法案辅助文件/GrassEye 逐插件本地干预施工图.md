# GrassEye 逐插件本地干预施工图

版本：2026-08-14
状态：active construction map
权威边界：本文件只解释 active law 的落位；不创建中央干预 owner，不替代各插件 task store。

## 1. 唯一主链

```txt
Local Workbench
  -> explicit plugin route
    -> GrassEyeWorkbenchHandle named method
      -> plugin public facade
        -> plugin-owned task store expectedRevision CAS
          -> plugin-owned safe point acknowledgement
```

`pause / cancel / takeover / resume` 都是整任务请求。Route、App、Mediator、Local Runtime 不保存状态、不决定下一步、不访问 Browser 私有实现。每个插件先持久化请求事件，再以 `taskId + expectedRevision` 做 CAS；stale revision 必须零写入失败。成功 ACK 后，不得开始下一条 Browser、AI 或下载命令。已经提交的外部副作用只等待既有 checkpoint/timeout，结果不明进入 `review_required`，禁止自动重放。

持久化共性字段只是一致语义，不是共享中央表：

```txt
interventionRevision
interventionState
pendingIntervention { requestId, action, reason, requestedAt, expectedRevision }
checkpoint
```

允许状态由各 owner 收窄，但不得保留旧兼容枚举：

```txt
running | pause_requested | paused | cancel_requested | cancelled
| takeover_requested | taken_over | review_required
```

## 2. Owner 矩阵

| Plugin owner | Active law | 持久化 owner | 必须命中的安全点 | 不确定结果 |
| --- | --- | --- | --- | --- |
| amazon-invoice-upload | GRASSEYE-AMAZON-INVOICE-UPLOAD-015-V1 | invoice task/ledger store | item 前后、file attach 前、submit 前、result/ledger 后 | 已提交但无结果即 `review_required`，不重传 |
| amazon-product-mining | GRASSEYE-AMAZON-PRODUCT-MINING-027-V1 | mining SQLite/store | keyword、search、detail、reviews、AI submit/raw checkpoint、package commit | AI 结果不明即 `review_required`，不重提 |
| xuanxue-ai-production | GRASSEYE-XUANXUE-AI-PRODUCTION-004-V1 | xuanxue SQLite order store | dequeue、stage feed、response checkpoint、join、hash commit、cloud publish | 只允许本地整单入口；cloud 无人工命令 |

## 3. 响应预算

- queue/dequeue 边界：1 秒内停止新命令。
- 一般 DOM/item/round 边界：3 秒内停止新命令。
- xuanxue 新 stage：2 秒内停止。
- image transfer：允许当前传输最多 10 秒到 owning checkpoint，之后不得开始下一项。
- 已提交 provider/download/upload：只等该 owner 现有 timeout 与 checkpoint；等待期间不得触发页面动作。

预算超时不是继续运行授权。Owner 必须写 `review_required` 或相应终态，并把 failure reason、最后 checkpoint 和 evidence refs 留在自己的账内。

## 4. 精确 Tab 与恢复

- `BrowserTargetRef` 和 `BrowserDocumentRef` 只存在当前进程；禁止持久化 raw `tabId/windowId/debuggee`。
- pause/cancel 后旧 document generation 失效。
- takeover ACK 必须先向扩展发送精确 `release_target`，解除该 Tab 的 `chrome.debugger` 附着但不关闭用户标签页，然后销毁旧 target/document refs。
- takeover/resume 必须从 owner checkpoint 重新 acquire 精确 target，核验 origin、业务身份和已持久化 hash，再继续；旧 refs 永久不可复活。
- Product Mining、xuanxue-ai-production 接管 provider Tab 时，AI Input Gateway 必须登记精确 owner key，并阻塞全部新 Web AI 操作；只有同一 owner 的显式 resume 才解除阻塞。
- 不得恢复 active-tab、front-window、URL-first、first-page、same-path 或 host-tab fallback。
- DOM/Browser 动作只走插件精确 target；系统文件选择器、OS 鼠标、OS 键盘和焦点租约均不存在。

## 5. Workbench 接线

每个 active plugin 只暴露具名方法：

```txt
read<Task>InterventionStatus(taskId)
pause<Task>({ taskId, expectedRevision, reason, requestId })
cancel<Task>({ taskId, expectedRevision, reason, requestId })
takeover<Task>({ taskId, expectedRevision, reason, requestId })
resume<Task>({ taskId, expectedRevision, reason, requestId })
```

HTTP route 必须逐 plugin、逐 method allowlist。外部输入不得含 `stageId / selector / coordinate / browserCommand / nextAction / actionPlan / rawTabId / windowId`。UI 只展示 owner 返回的 revision、state、checkpoint、pending request 和 failure reason。

`xuanxue-ai-production` 固定使用本地 Workbench 整单入口。Cloud worker 只继续现役 claim/heartbeat/checkpoint/result/failure 出站协议，任何 cloud payload 出现人工干预 action 或 stage mutation 都是 machine-blocking finding。

## 6. 质检与删除完成标准

每个插件至少有确定性 acceptance，覆盖：

1. 安全点 pause；
2. 下一命令前 cancel；
3. checkpoint 后 takeover；
4. 同 task/order resume；
5. stale revision 零写入；
6. 外部副作用不重复；
7. owner 边界与禁止字段。

静态 inspector 必须证明 named facade、owner store 字段、安全点调用、route/handle 纯转发和禁用旧枚举/第二入口。真实 Chrome/provider acceptance 另证目标绑定、零普通焦点、实际暂停预算和恢复身份；静态 Audit、typecheck 或 fixture 不得冒充这部分证据。
