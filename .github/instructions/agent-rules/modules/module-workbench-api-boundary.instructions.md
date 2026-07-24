---
name: "GrassEye Workbench API Boundary"
description: "Governs local Workbench HTTP API ingress, external website connection, authentication, CORS, route admission, external task intake, and outbound callback boundary without creating a second API chain or dispatcher."
applyTo: "src/app/**,src/lib/local-runtime/**,src/plugins/**,scripts/audit/domains/workbench-api-boundary/**,scripts/acceptance/workbench-api-boundary*.acceptance.ts,package.json,.github/instructions/agent-rules/modules/**,docs/法案辅助文件/**"
---

# GrassEye Workbench API Boundary

status: active  
version: 2026-05-28  
capabilityDomain: workbench-api-boundary  
tier: P0  
enforcementMode: machine-blocking  

## 0. Identity

GrassEye Workbench API Boundary is not a new API platform.

It is a single ingress guard in front of the existing Workbench HTTP routes.

The only lawful architecture is:

```txt
HTTP Request
  -> Workbench API Boundary Guard
      -> Existing Workbench Route Handler
          -> GrassEyeWorkbenchHandle
              -> Known Job Flow / Known Query Surface
                  -> Business Flow Script
                      -> Ability Groups
                          -> Evidence and Logs
```

The API Boundary owns:

```txt
authentication
origin / CORS admission
external source admission
route admission
request shape gate
external callback allowlist
audit evidence for ingress decisions
```

The API Boundary does not own:

```txt
job process order
browser actions
DOM actions
AI decisions
business verdict
product decision
invoice upload flow logic
task persistence schema truth
runtime logs transport
evidence store truth
```

## 1. Highest Principle

```txt
API is a gate, not a brain.
Route chooses only a known flow, not a new mission.
External website may request a task, but may not control the Agent.
```

## 2. Existing Chain Binding

The existing Workbench HTTP server remains the only HTTP owner.

Canonical current server files:

```txt
src/app/create-workbench-server.ts
src/app/workbench-http.ts
src/app/workbench-amazon-routes.ts
src/app/workbench-amazon-product-mining-routes.ts
src/app/workbench-facebook-routes.ts
src/app/workbench-deep-research-routes.ts
src/app/workbench-video-download-routes.ts
```

Required new guard file:

```txt
src/app/workbench-api-boundary.ts
```

The guard must be called before any known API route dispatch.

Allowed placement:

```txt
createWorkbenchServer
  -> handleRequest
      -> handleWorkbenchHomeRequest
      -> handleWorkbenchApiBoundary
      -> handleKnownWorkbenchApiRequest
      -> 404
```

Forbidden placement:

```txt
new HTTP server
new API gateway service
new external dispatcher
new route bus
new job router outside existing Workbench server
new capability-facing API
```

## [GRASSEYE-WORKBENCH-API-BOUNDARY-001-V1] Single API Ingress

```apex-law
{
  "lawId": "GRASSEYE-WORKBENCH-API-BOUNDARY-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "workbench-api-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+fs",
  "summary": "All Workbench API requests must pass through one API Boundary Guard before reaching known route handlers; no second HTTP server, gateway, bus, dispatcher, or external API chain may exist.",
  "appliesTo": [
    "src/app/**/*.{ts,tsx,js,jsx,mjs}",
    "src/lib/local-runtime/**/*.{ts,tsx,js,jsx,mjs}",
    "src/plugins/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "forbidden": [
    "Second HTTP API server for external website integration.",
    "External API gateway outside create-workbench-server.ts.",
    "External job dispatcher bypassing GrassEyeWorkbenchHandle.",
    "Route bus or central dispatcher replacing explicit route handlers.",
    "Capability group exposed directly as HTTP API.",
    "Plugin exposing its own HTTP listener.",
    "External website calling ability group functions directly."
  ],
  "clauses": [
    {
      "clauseId": "grasseye-workbench-api-boundary-001-requirement",
      "statement": "All Workbench API requests must pass through one API Boundary Guard before reaching known route handlers; no second HTTP server, gateway, bus, dispatcher, or external API chain may exist.",
      "evidenceMode": "static",
      "ownerDomain": "workbench-api-boundary"
    }
  ]
}
```

### Required

- `src/app/create-workbench-server.ts` must call the API Boundary Guard before route dispatch.
- Existing route handlers remain the only route execution surfaces.
- The guard returns only:
  - `allowed`
  - `blocked`
  - `not_api_request`
- The guard must not execute business logic.

### Forbidden

- API Boundary selecting browser actions.
- API Boundary deciding invoice upload status.
- API Boundary creating task flow order.
- API Boundary calling `src/capabilities/**`.
- API Boundary importing plugin internals other than route allowlist metadata.

## [GRASSEYE-WORKBENCH-API-BOUNDARY-002-V1] No Wildcard CORS

```apex-law
{
  "lawId": "GRASSEYE-WORKBENCH-API-BOUNDARY-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "workbench-api-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+fs",
  "summary": "Workbench API must not expose wildcard CORS. Allowed origins must be local workbench origin by default and explicit external website origins only when external API mode is enabled.",
  "appliesTo": [
    "src/app/workbench-http.ts",
    "src/app/workbench-api-boundary.ts",
    "src/app/create-workbench-server.ts"
  ],
  "forbidden": [
    "access-control-allow-origin: *",
    "Reflecting arbitrary Origin header.",
    "Allowing external website origin without explicit allowlist.",
    "Allowing credentials with wildcard origin.",
    "Disabling origin check for external task routes."
  ],
  "clauses": [
    {
      "clauseId": "grasseye-workbench-api-boundary-002-requirement",
      "statement": "Workbench API must not expose wildcard CORS. Allowed origins must be local workbench origin by default and explicit external website origins only when external API mode is enabled.",
      "evidenceMode": "static",
      "ownerDomain": "workbench-api-boundary"
    }
  ]
}
```

### Required

Default allowed origins:

```txt
http://127.0.0.1:<GRASSEYE_PORT>
http://localhost:<GRASSEYE_PORT>
```

External origins are allowed only when all are true:

```txt
GRASSEYE_EXTERNAL_API_ENABLED=true
GRASSEYE_EXTERNAL_ALLOWED_ORIGINS is non-empty
GRASSEYE_EXTERNAL_API_KEY is non-empty
```

Allowed external origin example:

```txt
https://ontheway.example.com
```

### Forbidden

```txt
"*"
"null"
origin reflection without allowlist
temporary open CORS for testing in active code
```

## [GRASSEYE-WORKBENCH-API-BOUNDARY-003-V1] API Authentication

```apex-law
{
  "lawId": "GRASSEYE-WORKBENCH-API-BOUNDARY-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "workbench-api-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+acceptance",
  "summary": "External website API access must require an explicit API key header. Task mutation routes must not be callable by unauthenticated external requests.",
  "appliesTo": [
    "src/app/**/*.{ts,tsx,js,jsx,mjs}",
    "scripts/acceptance/workbench-api-boundary*.acceptance.ts"
  ],
  "forbidden": [
    "External POST route without API key validation.",
    "External task creation without authentication.",
    "External task resume without authentication.",
    "External callback registration without authentication.",
    "Using query string apiKey as authentication.",
    "Logging raw API key."
  ],
  "clauses": [
    {
      "clauseId": "grasseye-workbench-api-boundary-003-requirement",
      "statement": "External website API access must require an explicit API key header. Task mutation routes must not be callable by unauthenticated external requests.",
      "evidenceMode": "acceptance",
      "ownerDomain": "workbench-api-boundary"
    }
  ]
}
```

### Required

External website calls must use:

```txt
X-GrassEye-Agent-Key: <secret>
```

Accepted comparison rule:

```txt
request header value === process.env.GRASSEYE_EXTERNAL_API_KEY
```

The API key must never be:

```txt
logged
persisted in task record
returned to UI
sent to plugin
sent to ability group
included in evidence package
```

### Local UI

Local same-origin UI may call the Workbench API without external API key when:

```txt
host is 127.0.0.1 or localhost
origin is local workbench origin
route is not marked external-only
```

### External website

External website may call only route entries that are explicitly marked:

```txt
externalApiAllowed: true
```

## [GRASSEYE-WORKBENCH-API-BOUNDARY-004-V1] Route Admission Allowlist

```apex-law
{
  "lawId": "GRASSEYE-WORKBENCH-API-BOUNDARY-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "workbench-api-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "API routes must be admitted through a small explicit allowlist. External website access must be disabled by default and enabled per route, per job, and per method.",
  "appliesTo": [
    "src/app/workbench-api-boundary.ts",
    "src/app/workbench-*-routes.ts",
    "scripts/audit/domains/workbench-api-boundary/**"
  ],
  "forbidden": [
    "External access to every /api/** route by default.",
    "Method wildcard route admission.",
    "Path prefix admission without exact method+path rule.",
    "External access to health, mode, settings, AI provider config, or debug routes unless explicitly authorized.",
    "External website calling deep research, product mining, video download, or browser-control routes without dedicated law authorization."
  ],
  "clauses": [
    {
      "clauseId": "grasseye-workbench-api-boundary-004-requirement",
      "statement": "API routes must be admitted through a small explicit allowlist. External website access must be disabled by default and enabled per route, per job, and per method.",
      "evidenceMode": "static",
      "ownerDomain": "workbench-api-boundary"
    }
  ]
}
```

### Required route rule shape

```ts
type WorkbenchApiRouteRule = {
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

### Initial external allowed route set

At first implementation, only Amazon invoice upload task intake may be external-enabled:

```txt
POST /api/plugins/amazon-invoice-upload/start
GET  /api/plugins/amazon-invoice-upload/status/<taskId>
GET  /api/plugins/amazon-invoice-upload/latest
GET  /api/plugins/amazon-invoice-upload/ledger
POST /api/plugins/amazon-invoice-upload/download/start
GET  /api/plugins/amazon-invoice-upload/download/status/<taskId>
GET  /api/plugins/amazon-invoice-upload/download/latest
GET  /api/plugins/amazon-invoice-upload/download/artifact/<taskId>
```

Alternative legacy routes may remain local-only unless explicitly moved into the allowlist:

```txt
POST /api/amazon-invoice-upload/mission
POST /api/amazon-invoice-upload/task
POST /api/amazon-invoice-upload/task/resume
GET  /api/amazon-invoice-upload/task
GET  /api/amazon-invoice-upload/latest
```

External access to these is forbidden unless the route rule says:

```txt
externalApiAllowed: true
requiresApiKey: true
```

## [GRASSEYE-WORKBENCH-API-BOUNDARY-005-V1] External Request Shape

```apex-law
{
  "lawId": "GRASSEYE-WORKBENCH-API-BOUNDARY-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "workbench-api-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "schema+acceptance",
  "summary": "External website requests may provide only approved job input fields. They must not provide selectors, coordinates, browser commands, next actions, action plans, or capability protocol keys.",
  "appliesTo": [
    "src/app/workbench-api-boundary.ts",
    "src/app/workbench-multipart.ts",
    "src/plugins/**/*.{ts,tsx,js,jsx,mjs}",
    "scripts/acceptance/workbench-api-boundary*.acceptance.ts"
  ],
  "forbidden": [
    "External request contains selector.",
    "External request contains coordinate.",
    "External request contains browserCommand.",
    "External request contains nextAction.",
    "External request contains actionPlan.",
    "External request contains abilityGroupId.",
    "External request contains childCapabilityId.",
    "External request contains capabilityCallId.",
    "External request chooses internal flow step.",
    "External request contains documentId.",
    "External request contains downloadUrl.",
    "External request overrides evidence ref."
  ],
  "clauses": [
    {
      "clauseId": "grasseye-workbench-api-boundary-005-requirement",
      "statement": "External website requests may provide only approved job input fields. They must not provide selectors, coordinates, browser commands, next actions, action plans, or capability protocol keys.",
      "evidenceMode": "acceptance",
      "ownerDomain": "workbench-api-boundary"
    }
  ]
}
```

### Allowed external Amazon invoice upload fields

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

### Required defaults

```txt
requireHumanFinalSubmit defaults to true for external website tasks.
callbackUrl is optional and must pass callback allowlist if present.
```

### Forbidden defaults

```txt
External request must not default to automatic final submit.
External request must not bypass human review gate for sensitive submit actions.
```

## [GRASSEYE-WORKBENCH-API-BOUNDARY-006-V1] External Callback Boundary

```apex-law
{
  "lawId": "GRASSEYE-WORKBENCH-API-BOUNDARY-006-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "workbench-api-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+fs+acceptance",
  "summary": "If GrassEye sends task results back to an external website, the callback must use an explicit outbound allowlist and must not allow arbitrary URL fetch from plugin or flow code.",
  "appliesTo": [
    "src/app/workbench-api-boundary.ts",
    "src/lib/local-runtime/**",
    "src/plugins/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "forbidden": [
    "Plugin fetches arbitrary callbackUrl directly.",
    "Flow script posts result to unvalidated URL.",
    "External request controls callback domain without allowlist.",
    "Callback includes secrets, raw cookies, browser session data, or API key.",
    "Callback retries implemented as second task queue."
  ],
  "clauses": [
    {
      "clauseId": "grasseye-workbench-api-boundary-006-requirement",
      "statement": "If GrassEye sends task results back to an external website, the callback must use an explicit outbound allowlist and must not allow arbitrary URL fetch from plugin or flow code.",
      "evidenceMode": "acceptance",
      "ownerDomain": "workbench-api-boundary"
    }
  ]
}
```

### Required

Callback URL must satisfy:

```txt
callbackUrl starts with one of GRASSEYE_EXTERNAL_CALLBACK_ALLOWED_BASE_URLS
```

Allowed callback payload may contain only:

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

Forbidden callback payload:

```txt
API key
Seller Central cookies
browser profile path
raw DOM snapshot
raw screenshot bytes
local file path outside artifact refs
AI raw response unless that job law explicitly allows it
```

## [GRASSEYE-WORKBENCH-API-BOUNDARY-007-V1] Ingress Evidence

```apex-law
{
  "lawId": "GRASSEYE-WORKBENCH-API-BOUNDARY-007-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "workbench-api-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "persisted-record+runtime-log",
  "summary": "External API ingress decisions must be observable. The system must record accepted and rejected external task requests without leaking secrets.",
  "appliesTo": [
    "src/app/workbench-api-boundary.ts",
    "src/lib/runtime-logs/**",
    "src/plugins/amazon-invoice-upload/**"
  ],
  "forbidden": [
    "Silent external request rejection.",
    "Accepted external task without sourceSystem.",
    "Accepted external task without requestId.",
    "Logging raw API key.",
    "Logging invoice PDF bytes.",
    "Treating CORS failure as task failure."
  ],
  "clauses": [
    {
      "clauseId": "grasseye-workbench-api-boundary-007-requirement",
      "statement": "External API ingress decisions must be observable. The system must record accepted and rejected external task requests without leaking secrets.",
      "evidenceMode": "acceptance",
      "ownerDomain": "workbench-api-boundary"
    }
  ]
}
```

### Required log fields

```txt
eventType: api_boundary
decision: allowed | blocked
reason
method
path
originCategory: local-ui | external-website | unknown
sourceSystem
requestId
jobOwner
routePurpose
authenticated: boolean
```

### Redaction

Must redact:

```txt
X-GrassEye-Agent-Key
Authorization
Cookie
Set-Cookie
invoicePdf binary content
local browser profile directory
```

## [GRASSEYE-WORKBENCH-API-BOUNDARY-008-V1] Audit Coverage

```apex-law
{
  "lawId": "GRASSEYE-WORKBENCH-API-BOUNDARY-008-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "workbench-api-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "hybrid",
  "summary": "Workbench API Boundary must have AST-level audit and acceptance coverage before external website integration may be called production-ready.",
  "appliesTo": [
    "scripts/audit/domains/workbench-api-boundary/**",
    "scripts/acceptance/workbench-api-boundary*.acceptance.ts",
    "package.json",
    "scripts/audit/generated/**"
  ],
  "forbidden": [
    "External API production readiness without API boundary audit.",
    "Wildcard CORS PASS.",
    "Unauthenticated external POST PASS.",
    "Route allowlist not runner-visible.",
    "Manual generated artifact truth.",
    "Warning-only P0 API boundary finding."
  ],
  "clauses": [
    {
      "clauseId": "grasseye-workbench-api-boundary-008-requirement",
      "statement": "Workbench API Boundary must have AST-level audit and acceptance coverage before external website integration may be called production-ready.",
      "evidenceMode": "static",
      "ownerDomain": "workbench-api-boundary"
    }
  ]
}
```

### Minimum inspector checks

The inspector must fail when:

```txt
access-control-allow-origin is "*"
create-workbench-server.ts does not call workbench-api-boundary guard before known route dispatch
externalApiAllowed route has requiresApiKey false
externalApiAllowed route uses method wildcard
external route path uses broad /api/** prefix
plugin or capability creates an HTTP server
plugin fetches arbitrary callbackUrl
API key appears in logs or response construction
forbidden external request keys are accepted
```

### Required scripts

```json
{
  "audit:workbench-api-boundary": "node --import tsx scripts/audit/domains/workbench-api-boundary/inspector.ts",
  "acceptance:workbench-api-boundary": "node --import tsx scripts/acceptance/workbench-api-boundary.acceptance.ts"
}
```

### CI requirement

`ci:full` must include:

```txt
audit:workbench-api-boundary
acceptance:workbench-api-boundary
```

## 3. Production Readiness Gate

External API integration may be called production-ready only when all are true:

```txt
API Boundary Guard exists
Wildcard CORS removed
External API disabled by default
API key required for external task mutation
Route allowlist exists
Only authorized job routes are external-enabled
External request forbidden keys are blocked
External callback allowlist exists before callback support is enabled
Ingress logs redact secrets
Audit inspector is runner-visible
Acceptance tests prove blocked and allowed cases
CI-FULL PASS includes this domain
```

If any item is missing, the correct status is:

```txt
API boundary exists but external website integration is not production-stable.
```

## 4. Final Principle

```txt
The website may request.
The API Boundary may admit.
The route may forward.
The job flow may execute.
The ability group may act.
Evidence and logs must prove.

If API starts deciding the mission, it has become a second Agent and must fail.
```
