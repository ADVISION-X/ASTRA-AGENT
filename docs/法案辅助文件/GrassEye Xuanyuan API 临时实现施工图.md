# GrassEye Xuanyuan API 临时实现施工图

version: 2026-07-27
status: construction-blueprint
targetLaw: `.github/instructions/agent-rules/modules/module-xuanyuan.instructions.md`
capabilityDomain: `xuanyuan`
targetPlugin: `src/plugins/xuanyuan`

施工图只作为实现地图，不高于 active law。

## Xuanyuan Boundary

`xuanyuan` 是 AGENT 端统一 AI API 模拟入口。

边界：

```txt
网站侧只发和收。
AGENT 才是 AI 端。
Workbench API Boundary 是外部入口门禁。
AI Input Gateway 是 provider 传输边界。
xuanyuan 只拥有任务契约、提示词包快照、任务存储和 AI Gateway 调用。
```

禁止：

```txt
第二 HTTP server
第二 API gateway
网站直连 provider
网站保存 provider API key
xuanyuan 直接操作 GPT DOM
xuanyuan 直接 import OpenAI/Gemini/ChatGPT SDK
provider 失败后返回 succeeded
```

## API Flow

目标链路：

```txt
External Website / xuanxue-web
  -> Workbench API Boundary
      -> POST /api/xuanyuan/simulate
          -> workbench-xuanyuan-routes
              -> GrassEyeWorkbenchHandle.enqueueXuanyuanTask
                  -> src/plugins/xuanyuan
                      -> governed AiFeedInput
                          -> AI Input Gateway
                              -> gpt-web-chat provider adapter
                                  -> raw output + provider proof
                                      -> xuanyuan task record
```

Xuanyuan enqueue 只负责校验并持久化 `queued` 任务，然后返回 202。唯一持久化队列 owner
以 lease/heartbeat 领取任务，并发数量服从 AI Input Gateway 的实际容量；没有第二执行器，
也没有进程内 `void Promise` 作为任务真相。

`sourceProject + requestId` 是幂等身份：完全相同的规范化请求重放只返回原 taskId；同一身份
携带不同请求内容直接失败，不会创建第二聊天。任务创建时同时持久化 `taskName` 与
`taskLabelKey`，taskName 只由 allowlisted label 加 taskId 的短追踪组成。

```txt
accepted
→ queued
→ waiting_for_gateway_capacity
→ waiting_for_provider_submit
→ waiting_for_provider_response
→ response_checkpointed
→ recovery_pending（提交后中断）
→ response_captured

terminal: review_required | failed | cancelled
```

重启扫描 queued、running 与 recovery_pending。尚未提交的任务可以继续领取；已经提交的任务只允许携带
内部 gateway execution id 恢复持久化系统聊天名与 turn marker，在同一个物理 ChatGPT
标签页中点击对应聊天、核对 marker 并继续轮询，不得重新调用发送阶段。Gateway 已持久化
回答 checkpoint 时，Xuanyuan 只等待其完成改名与证据投影，不再消费一次 AI 分析。

续聊仍走同一条链，不新增 route、server、provider adapter 或工作流：

```txt
external continuationTaskId + continuationResponseHash
  -> Xuanyuan loads prior persisted response_captured task
  -> verifies same sourceProject/provider and exact raw-output hash
  -> resolves prior providerPageUrl internally
  -> AI Input Gateway reopens and proves that exact conversation
  -> sends the next governed prompt package
  -> stores a new Xuanyuan task/result linked to the prior task
```

外部网站永远不得传 `providerPageUrl`、tab id、selector 或浏览器指令。每个 Xuanyuan 请求仍是一次独立、可审计的 provider feed；续聊只表示 transport 复用上一任务的精确会话，不拥有业务轮次编排。

### Standard Web Chat attachment delegation

`inputRefs` 中带 `filePath` 的文件必须保持请求顺序，并整体交给 AI Input Gateway 标准子能力：

```txt
Xuanyuan inputRefs
  -> AI Input Gateway public contract
      -> attach-approved-web-chat-files-once
          -> aggregate attachmentUploadProof
              -> prompt submit
```

Xuanyuan 不知道、也不能指定 ordered clipboard 或 native picker。它只记录聚合证据。子能力失败或 `review_required` 时不得进入提示词发送。

查询链路：

```txt
GET /api/xuanyuan/status?taskId=...
GET /api/xuanyuan/latest
GET /api/xuanyuan/history
```

## Plugin File Plan

```txt
src/plugins/xuanyuan/
  index.ts
  xuanyuan.schema.ts
  xuanyuan.flow.ts
  xuanyuan.store.ts
  xuanyuan.task.ts
  xuanyuan.queue.ts
  xuanyuan-queue-owner.ts
  xuanyuan-task-identity.ts
```

`xuanyuan.flow.ts` 可以 import AI Input Gateway public contract only:

```txt
src/capabilities/ai-input-gateway/index.ts
```

不得 import:

```txt
src/capabilities/ai-input-gateway/providers/**
src/lib/browser/**
src/capabilities/dom-automation/**
OpenAI / Gemini / ChatGPT provider SDK
```

## Route Plan

```txt
src/app/workbench-xuanyuan-routes.ts
src/app/create-workbench-server.ts
src/app/workbench-api-boundary.ts
src/lib/local-runtime/workbench-handle.ts
src/lib/local-runtime/workbench.ts
```

Route surface:

```txt
POST /api/xuanyuan/simulate
GET /api/xuanyuan/status
GET /api/xuanyuan/latest
GET /api/xuanyuan/history
```

External routes must be:

```txt
externalApiAllowed: true
requiresApiKey: true
jobOwner: "xuanyuan"
```

## Request Contract

Minimal request:

```txt
requestId
sourceProject
scenario
providerKind = gpt-web-chat
promptPackageId
promptContractId
textPrompt
inputRefs
expectedOutputSchemaRef
continuationTaskId? + continuationResponseHash?
timeoutMs
maxInputChars
maxFileCount
maxFileBytes
```

`systemPrompt`, `userPrompt`, and `payloadJson` may be accepted only to build the governed `textPrompt` snapshot.

`continuationTaskId` 与 `continuationResponseHash` 必须同时存在或同时缺失。存在时，Xuanyuan 只能从自己的任务存储读取并核对上一任务，不得接受网站提交的 provider URL。缺失时保持现有 fresh conversation 行为。

## Result Contract

Task result must expose:

```txt
taskId
taskName
taskLabelKey
requestId
sourceProject
scenario
providerKind
status
rawOutputRef
rawOutputHash
rawResponseText
providerProof
transportWarnings
progress
recovery
continuationTaskId
conversationProof
failureReason
reviewRequiredReason
createdAt
updatedAt
```

The only successful transport terminal is:

```txt
response_captured
```

Provider failures before a complete response is captured remain:

```txt
review_required
failed
```

已经提交或已经 checkpoint 的 provider work 遇到浏览器、改名、进程或临时环境失败时必须是：

```txt
recovery_pending
```

并保留 attemptCount、lastFailureReason、recoverable 与 recoveryDirective。

## QA Plan

Acceptance must prove:

```txt
xuanyuan can run with a fixture AiInputGateway and persist an exact `response_captured` task
invalid JSON is still returned byte-for-byte as `response_captured` because parsing belongs to the caller
source restore and provider-tab close failures after capture remain warnings and never erase or downgrade the response
fresh request starts a new conversation while valid continuation reuses the exact prior provider conversation
missing, mismatched, cross-project, cross-provider or non-captured continuation fails before provider submission
external request schema rejects provider URL, tab id, selector and browser continuation details
route handler exposes simulate/status/latest/history
API Boundary admits xuanyuan routes only with external API key requirement
package scripts include acceptance:xuanyuan and audit:xuanyuan
Xuanyuan delegates files through the standard attachment child and persists aggregate terminal proof
HTTP 202 is backed by persisted accepted work before response
ten independent tasks can reach provider waiting concurrently when capacity permits
capacity overflow remains queued
restart resumes exact submitted attempts without duplicate provider submission
12 concurrent named tasks retain exact task/result binding
same sourceProject plus requestId replay returns the original task
post-submit failure persists recovery_pending and the next coordinator resumes the same task id
response-checkpointed work finishes without another provider analysis
no fire-and-forget task execution remains
```

Audit must prove:

```txt
law / blueprint / manifest / inspector / acceptance exist
plugin files exist
route and Workbench handle are wired
API Boundary route allowlist contains xuanyuan routes
no provider adapter, browser, DOM automation, or provider SDK import in xuanyuan plugin
no fake success markers in xuanyuan plugin
Xuanyuan contains no provider transport selection and depends only on the AI Input Gateway public contract
```
