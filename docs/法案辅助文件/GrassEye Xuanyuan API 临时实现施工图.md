# GrassEye Xuanyuan API 临时实现施工图

version: 2026-07-03
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
              -> GrassEyeWorkbenchHandle.startXuanyuanTask
                  -> src/plugins/xuanyuan
                      -> governed AiFeedInput
                          -> AI Input Gateway
                              -> gpt-web-chat provider adapter
                                  -> raw output + provider proof
                                      -> xuanyuan task record
```

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
timeoutMs
maxInputChars
maxFileCount
maxFileBytes
```

`systemPrompt`, `userPrompt`, and `payloadJson` may be accepted only to build the governed `textPrompt` snapshot.

## Result Contract

Task result must expose:

```txt
taskId
requestId
sourceProject
scenario
providerKind
status
rawOutputRef
rawOutputHash
normalizedText
parseStatus
schemaValidationStatus
parsedJson
providerProof
failureReason
reviewRequiredReason
createdAt
updatedAt
```

Terminal success is only:

```txt
succeeded
```

Parsing or provider failures must remain:

```txt
parse_failed_raw_available
review_required
failed
```

## QA Plan

Acceptance must prove:

```txt
xuanyuan can run with a fixture AiInputGateway and persist a succeeded task
parse failure does not become succeeded
route handler exposes simulate/status/latest/history
API Boundary admits xuanyuan routes only with external API key requirement
package scripts include acceptance:xuanyuan and audit:xuanyuan
```

Audit must prove:

```txt
law / blueprint / manifest / inspector / acceptance exist
plugin files exist
route and Workbench handle are wired
API Boundary route allowlist contains xuanyuan routes
no provider adapter, browser, DOM automation, or provider SDK import in xuanyuan plugin
no fake success markers in xuanyuan plugin
```
