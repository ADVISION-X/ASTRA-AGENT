# GrassEye Workbench API Boundary 施工图

版本：2026-05-28  
状态：active  
对应法案：`.github/instructions/agent-rules/modules/module-workbench-api-boundary.instructions.md`  
owner：workbench-api-boundary  

## 1. 建设目标

本施工图只解决一个问题：

```txt
ontheway 网站或其他外部系统如何安全请求 GrassEye Agent 执行已知任务。
```

它不建设：

```txt
第二 API 服务
第二任务队列
第二调度器
第二 mission loop
第二证据链
第二日志链
外部网站直连能力组
```

最高原则：

```txt
保持功能完整，但不复杂化。
先加门禁，再进现有路线。
```

## 2. 当前现状

当前 Workbench 已有本地 HTTP server：

```txt
src/app/create-workbench-server.ts
```

当前路由入口包括：

```txt
handleDeepResearchRequest
handleAmazonRequest
handleFacebookRequest
handleAmazonProductMiningRequest
handleVideoDownloadRequest
```

当前 JSON response helper 在：

```txt
src/app/workbench-http.ts
```

当前需要治理的问题：

```txt
CORS 不能继续使用 "*"
外部网站请求不能无鉴权进入任务路由
外部任务不能控制 selector / coordinate / actionPlan
外部 callback 不能任意 URL
API 边界必须进入 CI 执法
```

## 3. 单链架构

目标链路：

```txt
External Website / Local UI
  -> HTTP Request
      -> create-workbench-server.ts
          -> workbench-api-boundary.ts
              -> existing route handler
                  -> GrassEyeWorkbenchHandle
                      -> existing plugin job flow
                          -> existing ability groups
                              -> evidence / runtime logs
```

禁止链路：

```txt
External Website
  -> new API server
      -> new dispatcher
          -> plugin / capability
```

禁止链路：

```txt
External Website
  -> capability group
```

禁止链路：

```txt
External Website
  -> AI planner
      -> browser command
```

## 4. 新增文件

### 4.1 API Boundary Guard

新增：

```txt
src/app/workbench-api-boundary.ts
```

职责：

```txt
判断是否 API 请求
判断 origin 是否允许
判断 route 是否允许
判断是否需要 API key
判断 API key 是否通过
判断 external mode 是否启用
拒绝危险 request shape
输出安全 CORS headers
记录 api_boundary 日志
```

不得：

```txt
启动任务
调用浏览器
调用 DOM
调用 AI
调用能力组
决定业务状态
解析 invoice PDF 内容
```

### 4.2 API Boundary Inspector

新增：

```txt
scripts/audit/domains/workbench-api-boundary/inspector.ts
```

职责：

```txt
AST 检查 create-workbench-server 是否接入 guard
AST 检查 workbench-http 是否不存在 wildcard CORS
AST 检查 route allowlist 是否存在
AST 检查 externalApiAllowed 必须 requiresApiKey
AST 检查 plugin 不创建 HTTP server
AST 检查 capability 不创建 HTTP server
AST 检查 callbackUrl 不被 plugin 直接 fetch
AST 检查 forbidden request keys 被列入 deny list
```

### 4.3 Acceptance

新增：

```txt
scripts/acceptance/workbench-api-boundary.acceptance.ts
```

覆盖：

```txt
local UI request allowed
external mode off -> external request blocked
external mode on + no key -> blocked
external mode on + wrong key -> blocked
external mode on + valid key + allowed route -> allowed
external valid key + non-allowed route -> blocked
external request with selector -> blocked
external request with actionPlan -> blocked
external request with callbackUrl not allowlisted -> blocked
CORS origin not allowlisted -> blocked
```

## 5. 最小实现模型

### 5.1 Route Rule

建议在 `workbench-api-boundary.ts` 内先使用小型常量，不引入复杂配置系统：

```ts
export type WorkbenchApiRouteRule = {
  method: "GET" | "POST" | "DELETE";
  pathPattern: "exact" | "prefix";
  path: string;
  localUiAllowed: boolean;
  externalApiAllowed: boolean;
  requiresApiKey: boolean;
  jobOwner?: string;
  purpose: string;
};
```

初始 route rules：

```ts
export const WORKBENCH_API_ROUTE_RULES: WorkbenchApiRouteRule[] = [
  {
    method: "POST",
    pathPattern: "exact",
    path: "/api/plugins/amazon-invoice-upload/start",
    localUiAllowed: true,
    externalApiAllowed: true,
    requiresApiKey: true,
    jobOwner: "amazon-invoice-upload",
    purpose: "external_amazon_invoice_upload_task_start",
  },
  {
    method: "GET",
    pathPattern: "prefix",
    path: "/api/plugins/amazon-invoice-upload/status/",
    localUiAllowed: true,
    externalApiAllowed: true,
    requiresApiKey: true,
    jobOwner: "amazon-invoice-upload",
    purpose: "external_amazon_invoice_upload_task_status",
  },
  {
    method: "GET",
    pathPattern: "exact",
    path: "/api/plugins/amazon-invoice-upload/ledger",
    localUiAllowed: true,
    externalApiAllowed: true,
    requiresApiKey: true,
    jobOwner: "amazon-invoice-upload",
    purpose: "external_amazon_invoice_upload_ledger",
  },
  {
    method: "GET",
    pathPattern: "exact",
    path: "/api/plugins/amazon-invoice-upload/latest",
    localUiAllowed: true,
    externalApiAllowed: true,
    requiresApiKey: true,
    jobOwner: "amazon-invoice-upload",
    purpose: "external_amazon_invoice_upload_task_latest",
  },
  {
    method: "POST",
    pathPattern: "exact",
    path: "/api/plugins/amazon-invoice-upload/download/start",
    localUiAllowed: true,
    externalApiAllowed: true,
    requiresApiKey: true,
    jobOwner: "amazon-invoice-upload",
    purpose: "external_amazon_tax_invoice_download_task_start",
  }
];
```

注意：

```txt
这里只允许 amazon-invoice-upload。
其他技能不自动开放给网站。
```

## 6. 外部模式开关

环境变量：

```txt
GRASSEYE_EXTERNAL_API_ENABLED=false
GRASSEYE_EXTERNAL_API_KEY=
GRASSEYE_EXTERNAL_ALLOWED_ORIGINS=
GRASSEYE_EXTERNAL_CALLBACK_ALLOWED_BASE_URLS=
```

默认：

```txt
external api disabled
```

只有显式开启后，外部网站才能请求。

## 7. Origin / CORS 策略

### 7.1 默认本地 origin

允许：

```txt
http://127.0.0.1:4173
http://localhost:4173
```

端口读取：

```txt
GRASSEYE_PORT
```

### 7.2 外部 origin

只来自：

```txt
GRASSEYE_EXTERNAL_ALLOWED_ORIGINS
```

格式：

```txt
https://ontheway.example.com,https://admin.ontheway.example.com
```

### 7.3 禁止

```txt
access-control-allow-origin: *
reflect any origin
allow null origin
allow file:// origin
temporary open cors
```

## 8. API Key 策略

外部请求 header：

```txt
X-GrassEye-Agent-Key: <secret>
```

校验：

```txt
header === process.env.GRASSEYE_EXTERNAL_API_KEY
```

禁止：

```txt
?apiKey=
body.apiKey
cookie api key
localStorage api key
logging api key
returning api key
```

## 9. External Request Shape Gate

### 9.1 允许字段

Amazon invoice upload 外部任务允许：

```txt
sourceSystem
requestId
marketplace
amazonOrderId
invoiceNo
sellerCentralEntryUrl
adminOrderUrl
requireHumanFinalSubmit
invoicePdf
callbackUrl
reportKind
dateRange
format
requireHumanReview
```

### 9.2 禁止字段

任何外部请求不得包含：

```txt
selector
selectors
coordinate
coordinates
x
y
browserCommand
nextAction
actionPlan
flowStep
abilityGroupId
childCapabilityId
capabilityCallId
evidenceRefOverride
cookie
sellerCentralCookie
browserProfileDirectory
documentId
downloadUrl
```

### 9.3 默认人工提交

外部请求默认：

```txt
requireHumanFinalSubmit = true
```

原因：

```txt
外部网站可以请求 Agent 准备并上传文件，但敏感 final submit 不能默认自动执行。
```

如果未来要允许自动 final submit，必须进入单独 P0 job-flow law，不得在 API Boundary 偷开。

## 10. Callback 策略

### 10.1 初始阶段

第一阶段可以不做主动 callback。

推荐先做：

```txt
网站创建任务
网站轮询 status/latest
Agent 返回状态
```

这样简单、好治理。

### 10.2 第二阶段

如果需要 Agent 主动回传网站，必须走 callback allowlist。

允许：

```txt
callbackUrl startsWith GRASSEYE_EXTERNAL_CALLBACK_ALLOWED_BASE_URLS
```

禁止：

```txt
plugin 直接 fetch callbackUrl
flow 直接 fetch arbitrary URL
callbackUrl 任意域名
callback 带 API key
callback 带 cookie
callback 带本地文件路径
```

### 10.3 Callback Payload

允许 payload：

```txt
sourceSystem
requestId
taskId
status
reason
reachedStep
amazonOrderId
invoiceNo
evidenceRef
domTraceRef
reviewRequired
updatedAt
```

## 11. API Boundary Return Model

Guard 输出：

```ts
type WorkbenchApiBoundaryDecision =
  | {
      kind: "not_api_request";
    }
  | {
      kind: "allowed";
      corsHeaders: Record<string, string>;
      routeRule: WorkbenchApiRouteRule;
      originCategory: "local-ui" | "external-website";
    }
  | {
      kind: "blocked";
      statusCode: 403 | 404 | 405;
      error: string;
      reason: string;
      corsHeaders: Record<string, string>;
    };
```

禁止输出：

```txt
business status
upload_success
submit_failed
AI verdict
next step
browser command
```

## 12. Server 接入点

在 `src/app/create-workbench-server.ts` 中，目标顺序：

```txt
OPTIONS
  -> API Boundary preflight

GET / or /index.html
  -> render home

/api/**
  -> API Boundary Guard
      -> allowed
          -> handleKnownWorkbenchApiRequest
      -> blocked
          -> writeJson blocked response

unknown
  -> 404
```

伪代码：

```ts
const boundaryDecision = handleWorkbenchApiBoundary({
  request,
  response,
  url,
  baseUrl,
});

if (boundaryDecision.kind === "blocked") {
  writeJson(response, boundaryDecision.statusCode, {
    error: boundaryDecision.error,
    reason: boundaryDecision.reason,
  }, boundaryDecision.corsHeaders);
  return;
}

if (boundaryDecision.kind === "allowed") {
  if (await handleKnownWorkbenchApiRequest({ request, response, workbench, url })) {
    return;
  }
}
```

注意：

```txt
writeJson 需要支持传入动态 corsHeaders。
```

## 13. workbench-http.ts 改造

当前 `workbench-http.ts` 不应持有固定 wildcard CORS。

目标：

```ts
export const writeJson = (
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): void => {
  response.writeHead(statusCode, {
    ...headers,
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
};
```

CORS headers 由 API Boundary 提供。

禁止：

```txt
workbench-http.ts 自己写死 access-control-allow-origin
```

## 14. 审计规则

新增 inspector 至少检查：

```txt
1. workbench-http.ts 不存在 access-control-allow-origin "*"
2. create-workbench-server.ts import handleWorkbenchApiBoundary
3. create-workbench-server.ts 在 handleKnownWorkbenchApiRequest 前调用 guard
4. workbench-api-boundary.ts 存在 WORKBENCH_API_ROUTE_RULES
5. externalApiAllowed true 的 route 必须 requiresApiKey true
6. external route 不允许 pathPattern = prefix 且 path = "/api/"
7. external route 不允许 path = "/api/**"
8. forbidden external request keys 存在 deny list
9. src/plugins/** 不允许 createServer
10. src/capabilities/** 不允许 createServer
11. callbackUrl 不允许在 plugin 里直接 fetch
12. API key header 不允许写入 runtime log payload
```

## 15. 验收测试

新增：

```txt
scripts/acceptance/workbench-api-boundary.acceptance.ts
```

测试场景：

```txt
PASS: local same-origin GET /api/health allowed
PASS: local same-origin plugin start allowed
PASS: external mode disabled blocks external POST
PASS: external allowed origin but missing key blocks
PASS: external allowed origin but wrong key blocks
PASS: external allowed origin and correct key allows allowed route
PASS: external correct key cannot access non-external route
PASS: wildcard origin is never returned
PASS: request containing selector is blocked
PASS: request containing actionPlan is blocked
PASS: request containing abilityGroupId is blocked
PASS: callbackUrl outside allowlist is blocked
```

## 16. Package Scripts

新增：

```json
{
  "audit:workbench-api-boundary": "node --import tsx scripts/audit/domains/workbench-api-boundary/inspector.ts",
  "acceptance:workbench-api-boundary": "node --import tsx scripts/acceptance/workbench-api-boundary.acceptance.ts"
}
```

`ci:full` 必须纳入：

```txt
audit:workbench-api-boundary
acceptance:workbench-api-boundary
```

## 17. 第一阶段施工顺序

### Step 1：立法

新增：

```txt
.github/instructions/agent-rules/modules/module-workbench-api-boundary.instructions.md
docs/法案辅助文件/GrassEye Workbench API Boundary 施工图.md
```

### Step 2：最小 Guard

新增：

```txt
src/app/workbench-api-boundary.ts
```

只实现：

```txt
origin allowlist
external mode switch
api key check
route allowlist
forbidden key block
cors header builder
```

暂不实现主动 callback。

### Step 3：改造 workbench-http

移除固定 CORS。

让 `writeJson` 接收 headers。

### Step 4：接入 create-workbench-server

在 route dispatch 前调用 guard。

### Step 5：审计

新增 inspector。

### Step 6：验收

新增 acceptance。

### Step 7：进入 ci:full

所有 API Boundary 失败必须 binary FAIL。

## 18. 第二阶段：ontheway 对接

第一阶段通过后，ontheway 网站只允许做：

```txt
创建 Amazon invoice upload task
查询 task status
查询 latest task
```

不允许：

```txt
调用能力组
指定浏览器动作
指定 DOM selector
指定下一步
自动 final submit
直接读本机文件
直接读日志
直接读 evidence 原始文件
```

## 19. 未来扩展规则

未来如要开放其他 job：

```txt
amazon-tax-invoice-download
amazon-fee-invoice-download
vat-document-sync
```

必须逐个增加：

```txt
job flow law
route rule
schema
acceptance
audit ownership
externalApiAllowed true
callback payload contract
```

禁止：

```txt
把 /api/plugins/* 全部开放
把 /api/** 全部开放
把 externalApiAllowed 默认设 true
```

## 20. 最终判断标准

合格状态：

```txt
API 边界是一扇门。
门后面仍然是现有路线。
外部网站只能递交任务。
Agent 仍然按既有 job flow 执行。
能力组仍然只做原子动作。
证据和日志仍然证明事实。
```

不合格状态：

```txt
API 成为第二个调度中心。
API 可以选择动作。
外部网站可以控制浏览器。
外部网站可以控制 DOM selector。
外部网站可以绕过 human submit gate。
外部网站可以调用任意 /api/**。
```

## 21. Final Principle

```txt
No second chain.
No open CORS.
No unauthenticated external task.
No external browser control.
No external capability call.
No silent ingress.
No secret leakage.

Simple gate first.
Known route second.
Existing flow third.
Evidence always.
```
