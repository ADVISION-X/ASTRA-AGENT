---
name: "GrassEye Architecture Boundary"
description: "Governs the single-line vertical expansion architecture: mediator, job flows, ability groups, child abilities, evidence, logs, and audit boundaries."
applyTo: "src/**, scripts/**, .github/instructions/agent-rules/**"
---

# GrassEye Architecture Boundary

status: active
version: 2026-05-21
capabilityDomain: architecture-boundary

## Architecture Constitution

GrassEye is a single-line job-flow automation system.

The only active architecture is:

```txt
User Requirement
  -> Job Mediator
      -> Job Flow Library
          -> Ability Groups
              -> Child Abilities
                  -> Evidence / Runtime Logs / Result Records
```

## Highest Rule

GrassEye may expand only by vertical single-line growth:

```txt
New user demand
  -> one mediator route
  -> one explicit job flow
  -> existing or newly approved ability groups
  -> child abilities
  -> evidence and logs
```

Any new folder, file, route, runtime, service, registry, planner, dispatcher, or helper that does not fit this chain must fail architecture inspection.

## Allowed Architectural Layers

Only the following architectural layers are allowed:

1. `app-shell`
2. `job-mediator`
3. `job-flow`
4. `ability-group`
5. `child-ability`
6. `evidence-store`
7. `runtime-logs`
8. `storage`
9. `startup`
10. `acceptance`
11. `audit-system`
12. `governance-law`

No other active architectural layer may be introduced.

## Allowed Source Roots

Active source code may live only under the following roots:

```txt
src/app/**
src/mediator/**
src/plugins/**
src/capabilities/**
src/lib/**
src/types/**
scripts/startup/**
scripts/acceptance/**
scripts/audit/**
.github/instructions/agent-rules/**
```

Any new active source root outside this allowlist is forbidden unless this law is explicitly updated first.

`src/types/**` 只允许共享 type declaration 与声明式 schema contract；禁止函数、类、控制流、I/O、副作用和业务步骤。

## First Flow Is Not Only Flow

Amazon invoice upload is the first validated job flow. It is not a monopoly on future GrassEye growth.

Lawful expansion means adding a new book of job practice:

```txt
src/plugins/<job-id>/<job-id>.flow.ts
scripts/acceptance/<job-id>-smoke.ts
mediator route for <job-id>
active law coverage
evidence and result contract
```

Forbidden:

- stuffing a new business into the Amazon flow;
- creating a universal flow to avoid writing a new job flow;
- creating a new ability group for job-specific business steps;
- adding a job without mediator route, evidence, acceptance, and audit ownership.

Runtime stage truth for every plugin root lives in `scripts/audit/config/plugin-status.json`.
Every `src/plugins/<job-id>/**` root must appear exactly once in that table with one lifecycle status: `active`, `experimental`, `parked`, or `archived`.
Only `active` plugins may enter default runtime surfaces and CI-FULL acceptance smoke.

## Naming Doctrine

* `src/mediator/**` owns user-demand routing only.
* `src/plugins/<job-id>/**` owns one business job flow.
* `src/capabilities/<ability-group-id>/**` owns one same-kind ability group.
* `src/capabilities/<ability-group-id>/runtime/**` owns child ability implementation.
* `src/lib/**` owns infrastructure only.
* `scripts/audit/**` owns inspection only.
* `scripts/acceptance/**` owns acceptance proof only.
* `scripts/startup/**` owns startup only.

Forbidden names as active architecture:

```txt
orchestration
nerve-bus
universal-agent
general-agent
planner
next-action
action-plan
mission-loop
pure-visual-loop
commander-console
platform-registry-as-truth
muscle-memory-as-truth
bridge
compatibility
legacy
v1-v2-dual
```

Retired names may appear only in deletion notes, migration reports, archive notes, or forbidden-regression tests.

---

# 核心法条

## 1. 单线架构主权

```md
## [APEX-ARCH-001-V1] 单线架构主权

```apex-law
{
  "lawId": "APEX-ARCH-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "architecture-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "GrassEye must expand only through the single-line mediator to job-flow to ability-group architecture, with one canonical mediator route for every active plugin.",
  "appliesTo": [
    "src/**/*.{ts,tsx,js,jsx,mjs}",
    "scripts/**/*.{ts,js,mjs}",
    ".github/instructions/agent-rules/**/*.md"
  ],
  "forbidden": [
    "Second orchestration layer.",
    "Universal agent runtime.",
    "Parallel planner.",
    "NerveBus or central dispatcher resurrection.",
    "New active architecture outside mediator -> flow -> ability group -> child ability."
  ],
  "clauses": [
    {
      "clauseId": "apex-arch-001-requirement",
      "statement": "GrassEye must expand only through the single-line architecture, and every active plugin must have exactly one canonical mediator route before its job flow.",
      "evidenceMode": "static",
      "ownerDomain": "architecture-boundary"
    }
  ]
}
````

### 法条

GrassEye 只允许一条架构主链：

**用户需求 → 中介 → 业务流程 → 能力组 → 子能力 → 证据/日志/结果**

任何新增代码必须能被归属到这条链中的一个位置。

每个 `active` plugin 必须且只能登记一个 `src/mediator/<job-id>-route.ts`；App / Local Runtime 不得绕过它直接调用该 job 的任务入口。

### 禁止

禁止新增：

* 第二编排层
* 通用 Agent Runtime
* 中央 Dispatcher
* NerveBus
* AI next-action planner
* 通用 Mission Loop
* 横跨多个业务的超级流程
* 不属于任何架构层的目录或文件

````

---

## 2. 中介层边界

```md
## [APEX-ARCH-002-V1] 中介层只分发需求

```apex-law
{
  "lawId": "APEX-ARCH-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "architecture-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast",
  "summary": "The mediator may route user demands to job flows but must not execute business steps or browser actions.",
  "appliesTo": [
    "src/mediator/**/*.{ts,tsx}",
    "src/lib/local-runtime/**/*.{ts,tsx}"
  ],
  "forbidden": [
    "Mediator directly calling browser click/fill/upload primitives.",
    "Mediator containing Amazon-specific or Facebook-specific step logic.",
    "Mediator becoming a workflow engine.",
    "Mediator storing business process state."
  ],
  "clauses": [
    {
      "clauseId": "apex-arch-002-requirement",
      "statement": "The mediator may route user demands to job flows but must not execute business steps or browser actions.",
      "evidenceMode": "static",
      "ownerDomain": "architecture-boundary"
    }
  ]
}
````

### 法条

中介层只允许做：

1. 接收用户需求
2. 识别 job type
3. 校验 job input schema
4. 找到对应 job flow
5. 调用 job flow
6. 返回 job result

### 禁止

中介层禁止：

* 直接点击页面
* 直接上传文件
* 直接读 DOM
* 直接判断 Amazon / Facebook 业务步骤
* 保存业务状态
* 通过 re-export / barrel 转运 runtime action surface
* 变成通用工作流引擎
* 变成第二个 orchestration

每个 route export 必须在 `plugin-status.json.mediatorBindings` 精确登记
`routeExport + schemaExport + taskExport`。route 只能用该 schema parse 一次，并把解析结果交给
该 task 一次；禁止额外 call、模块状态、`let/var`、nested helper、class/new 或赋值式状态机。
同一 plugin 被第二个 mediator 文件导入时直接 FAIL。

````

---

## 3. 业务 Flow 垂直扩张

```md
## [APEX-ARCH-003-V1] 一个需求一个业务 Flow

```apex-law
{
  "lawId": "APEX-ARCH-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "architecture-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Each active user demand must be implemented as one explicit job flow under src/plugins/<job-id> and reached only through its canonical mediator route.",
  "appliesTo": [
    "src/plugins/**/*.{ts,tsx}"
  ],
  "forbidden": [
    "One flow owning multiple unrelated jobs.",
    "Job flow creating generic orchestration.",
    "Business logic placed inside ability groups.",
    "Flow importing private runtime internals from other jobs.",
    "Flow importing unrelated job flow code.",
    "Flow importing non-facade capability files.",
    "Top-level files directly under src/plugins pretending to be shared job routers."
  ],
  "clauses": [
    {
      "clauseId": "apex-arch-003-requirement",
      "statement": "Each active user demand must have one explicit job flow under src/plugins/<job-id> and one canonical mediator route that owns task intake.",
      "evidenceMode": "static",
      "ownerDomain": "architecture-boundary"
    }
  ]
}
````

---

## 4. 插件阶段闸门

```md
## [APEX-ARCH-011-V1] 插件阶段闸门

```apex-law
{
  "lawId": "APEX-ARCH-011-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "architecture-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast+config",
  "summary": "Every plugin root must have one explicit lifecycle status, and only active plugins may enter default runtime surfaces and ci-full acceptance smoke.",
  "appliesTo": [
    "src/plugins/**/*.{ts,tsx,js,jsx,mjs}",
    "src/app/**/*.{ts,tsx,js,jsx,mjs}",
    "src/mediator/**/*.{ts,tsx,js,jsx,mjs}",
    "src/lib/local-runtime/**/*.{ts,tsx,js,jsx,mjs}",
    "scripts/audit/**/*.{ts,js,mjs,json}",
    "package.json"
  ],
  "forbidden": [
    "Plugin root missing from the plugin status table.",
    "Archived plugin remaining under src/plugins.",
    "Parked plugin referenced by active runtime code.",
    "Experimental plugin entering default runtime surfaces.",
    "Active plugin without ci-full acceptance smoke coverage."
  ],
  "clauses": [
    {
      "clauseId": "apex-arch-011-requirement",
      "statement": "Every plugin root must have one explicit lifecycle status, and only active plugins may enter default runtime surfaces and ci-full acceptance smoke.",
      "evidenceMode": "static",
      "ownerDomain": "architecture-boundary"
    }
  ]
}
````

### 法条

`scripts/audit/config/plugin-status.json` is the only active source of truth for plugin lifecycle stage.

Required:

* Every plugin root under `src/plugins/<job-id>/**` appears exactly once in the plugin status table.
* Every entry declares `status`, `phase`, allowed runtime entrypoints, allowed acceptance tests, and allowed npm scripts.
* Only `active` plugins may appear in default app/runtime surfaces and CI-FULL acceptance smoke.
* `experimental` plugins may be isolated behind explicit non-default entrypoints only.
* `parked` plugins may remain in source only when active runtime and CI-FULL do not reference them.
* `archived` plugins must not remain under `src/plugins/**`.

Forbidden:

* Runtime-exposed plugin with no stage record.
* Plugin stage truth scattered across docs, app shell, and package scripts.
* CI-FULL acceptance smoke covering a plugin that is not `active`.
* Default workbench surfaces exposing `experimental`, `parked`, or `archived` plugins.

````

### 法条

每一个成熟用户需求，只允许以一个独立业务 Flow 形式扩张：

```txt
src/plugins/<job-id>/
  <job-id>.flow.ts
  <job-id>.schema.ts
  <job-id>.result.ts
  <job-id>.hints.ts
  index.ts
```

例如：

```txt
src/plugins/amazon-invoice-upload/**
src/plugins/facebook-product-video-mining/**
```

### Flow 允许

Flow 可以：

* 定义业务步骤顺序
* 调用能力组 public API
* 处理业务状态
* 决定 review_required / failed / success
* 写业务 trace
* 返回业务 result

### Flow 禁止

Flow 禁止：

* 创建通用 planner
* 创建下一步 AI 决策器
* 创建跨 job 的公共编排引擎
* 直接 import 其他 job 的代码
* 通过 re-export / barrel laundering 转运其他 job 代码
* 直接 import `src/capabilities/<group-id>/` 下非 `index.ts` 文件
* 通过 re-export / barrel laundering 转运 non-facade capability 或 private runtime
* 直接复制能力组内部实现
* 把业务逻辑塞进能力组
* 把多个无关需求混在一个 Flow
* 在 `src/plugins/` 根部制造聚合 / 注册 / 路由文件

````

---

## 4. 能力组稳定边界

```md
## [APEX-ARCH-004-V1] 能力组只做同类动作

```apex-law
{
  "lawId": "APEX-ARCH-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "architecture-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Ability groups must own same-kind reusable actions and must not contain business-specific workflow logic.",
  "appliesTo": [
    "src/capabilities/**/*.{ts,tsx}"
  ],
  "forbidden": [
    "Amazon-specific workflow inside an ability group.",
    "Facebook-specific workflow inside an ability group.",
    "Ability group importing job flow files.",
    "Ability group importing unrelated capability owner files.",
    "Ability group deciding business success.",
    "Ability group dispatching multiple unrelated action kinds."
  ],
  "clauses": [
    {
      "clauseId": "apex-arch-004-requirement",
      "statement": "Ability groups must own same-kind reusable actions and must not contain business-specific workflow logic.",
      "evidenceMode": "static",
      "ownerDomain": "architecture-boundary"
    }
  ]
}
````

### 法条

能力组只允许表示一类稳定动作。

例如：

```txt
dom-automation
browser-session
ai-choice-judge
evidence-store
runtime-logs
file-storage
download
visual-observation
```

### 能力组允许

能力组可以：

* 暴露 public child abilities
* 定义 schema
* 执行同类动作
* 返回结构化 action result
* 生成动作证据

### 能力组禁止

能力组禁止：

* 判断 Amazon 订单上传成功
* 判断 Facebook 视频是否值得采购
* 写业务流程顺序
* 直接依赖某个 job
* import 其他能力组 owner 的实现代码
* 通过 re-export / barrel laundering 转运 job flow 或 foreign capability owner
* 变成小型 Flow
* 变成通用 Agent

````

---

## 5. 子能力原子性

```md
## [APEX-ARCH-005-V1] 子能力必须原子化

```apex-law
{
  "lawId": "APEX-ARCH-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "architecture-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast",
  "summary": "Each child ability must perform one atomic action and must not contain multi-step business workflow.",
  "appliesTo": [
    "src/capabilities/**/runtime/**/*.{ts,tsx}",
    "src/capabilities/**/children/**/*.{ts,tsx}"
  ],
  "forbidden": [
    "Child ability performing a full business flow.",
    "Child ability calling unrelated ability groups.",
    "Child ability importing unrelated capability owner files.",
    "Child ability making business decisions.",
    "Child ability containing hidden orchestration."
  ],
  "clauses": [
    {
      "clauseId": "apex-arch-005-requirement",
      "statement": "Each child ability must perform one atomic action and must not contain multi-step business workflow.",
      "evidenceMode": "static",
      "ownerDomain": "architecture-boundary"
    }
  ]
}
````

### 法条

子能力只做一个原子动作。

例如：

```txt
read-dom-snapshot-once
locate-dom-element-once
fill-dom-element-once
click-dom-element-once
upload-approved-file-once
wait-for-dom-state-once
verify-dom-state-once
```

### 禁止

子能力禁止：

* 完成整个 Amazon 上传流程
* 完成整个 Facebook 视频挖掘流程
* 自己决定下一步做什么
* 调用多个业务步骤
* import 其他能力组 owner 的代码
* 通过 re-export / barrel laundering 引入其他能力组 owner 的代码

````

---

## 6. 新目录白名单

```md
## [APEX-ARCH-006-V1] 新目录必须属于架构白名单

```apex-law
{
  "lawId": "APEX-ARCH-006-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "architecture-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs",
  "summary": "Active directories must belong to the approved architecture root allowlist; src/types is limited to declarative shared type and schema contracts.",
  "appliesTo": [
    "src/**",
    "scripts/**"
  ],
  "forbidden": [
    "New active top-level source folders outside the architecture allowlist.",
    "Ad-hoc folders for experiments.",
    "Unowned helper folders.",
    "Temporary architecture roots."
  ],
  "clauses": [
    {
      "clauseId": "apex-arch-006-requirement",
      "statement": "Active directories must belong to the approved architecture root allowlist, and src/types must contain only declarative shared type and schema contracts without runtime behavior.",
      "evidenceMode": "static",
      "ownerDomain": "architecture-boundary"
    }
  ]
}
````

### 法条

`src/` 下面只允许这些一级目录：

```txt
src/app
src/mediator
src/plugins
src/capabilities
src/lib
src/types
```

`scripts/` 下面只允许：

```txt
scripts/startup
scripts/acceptance
scripts/audit
```

`src/types` 允许 type/interface/declaration 以及由 `zod` 或本目录既有 schema 继续声明的共享合同；禁止函数 declaration 或函数值、类/enum、控制流、非 `zod` 外部运行时 import、I/O、`new/await`、赋值/更新副作用或任何业务步骤。禁令必须深入变量 initializer，不能只检查顶层 Statement。

其他新增目录一律 FAIL。

### 禁止

禁止新增：

```txt
src/orchestration
src/agents
src/agent
src/planner
src/runner
src/mission
src/workflows
src/controllers
src/services
src/core
src/engine
src/legacy
src/bridge
src/adapters
```

除非先修改本架构法案，并通过质检。

````

---

## 7. 禁止“无归属共享层”

```md
## [APEX-ARCH-007-V1] 共享层不得成为垃圾桶

```apex-law
{
  "lawId": "APEX-ARCH-007-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "architecture-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Shared infrastructure under src/lib must remain infrastructure-only and must not absorb business flow or ability logic.",
  "appliesTo": [
    "src/lib/**/*.{ts,tsx}"
  ],
  "forbidden": [
    "Business job flow inside src/lib.",
    "Ability group implementation inside src/lib.",
    "Generic service layer hiding business workflow.",
    "Shared helper created before two real call sites exist."
  ],
  "clauses": [
    {
      "clauseId": "apex-arch-007-requirement",
      "statement": "Shared infrastructure under src/lib must remain infrastructure-only and must not absorb business flow or ability logic.",
      "evidenceMode": "static",
      "ownerDomain": "architecture-boundary"
    }
  ]
}
````

### 法条

`src/lib/**` 只能放基础设施：

* browser controller
* storage
* runtime logs
* local runtime support
* ids
* settings
* low-level adapters

### 禁止

`src/lib/**` 禁止出现：

* Amazon 上传业务步骤
* Facebook 挖掘业务步骤
* 通用 agent engine
* workflow service
* business service
* 临时 helpers 垃圾桶

````

---

## 8. 新需求接入协议

```md
## [APEX-ARCH-008-V1] 新需求必须通过 Job Intake 接入

```apex-law
{
  "lawId": "APEX-ARCH-008-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "architecture-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Every active user demand must enter through one canonical job schema mediator route, explicit flow, and acceptance proof.",
  "appliesTo": [
    "src/mediator/**/*.{ts,tsx}",
    "src/plugins/**/*.{ts,tsx}",
    "scripts/acceptance/**/*.{ts,js,mjs}"
  ],
  "forbidden": [
    "New demand without job schema.",
    "New demand without mediator route.",
    "New demand without explicit flow.",
    "New demand without acceptance smoke.",
    "New demand hidden inside existing unrelated flow."
  ],
  "clauses": [
    {
      "clauseId": "apex-arch-008-requirement",
      "statement": "Every active plugin must enter through exactly one canonical mediator route that parses its job schema, calls its explicit flow, and has acceptance proof.",
      "evidenceMode": "static",
      "ownerDomain": "architecture-boundary"
    }
  ]
}
````

### 法条

每一个新增成熟需求必须同时具备：

```txt
1. job schema
2. mediator route
3. explicit job flow
4. result type
5. acceptance smoke
6. architecture owner
```

`scripts/audit/config/plugin-status.json` 中的每个 `active` plugin 必须登记唯一 `mediatorRoute`，固定为 `src/mediator/<job-id>-route.ts`，并用 `mediatorBindings` 精确登记每个 `routeExport + schemaExport + taskExport`。route exports 与 bindings 必须全集相等；每个 route 只能调用一次自己的 schema parse 和一次自己的 task，并把解析结果真实传入 task。额外 mediator 文件、额外 action/state call、模块状态、App 或 Local Runtime 对同一 task 的直连一律 FAIL。

App / Local Runtime 中以 `start / resume / retry / recover / continue / run / enqueue / generate / create / execute` 开头的生命周期方法，只要调用同样属于该生命周期集合的 plugin public export，就属于 job task intake；即使该 export 未写入 `mediatorBindings`，Inspector 也必须通过 AST symbol 反向发现并 FAIL。不得用“未登记所以不扫描”把第二个任务入口洗成普通 helper。

例如新增 Facebook 种草视频挖掘：

```txt
src/plugins/facebook-product-video-mining/
  facebook-product-video-mining.schema.ts
  facebook-product-video-mining.flow.ts
  facebook-product-video-mining.result.ts
  facebook-product-video-mining.hints.ts
  index.ts

scripts/acceptance/facebook-product-video-mining-smoke.ts
```

### 禁止

禁止把新需求直接塞进：

```txt
src/lib
src/capabilities
src/app
src/mediator
现有 amazon flow
```

````

---

## 9. AI 边界

```md
## [APEX-ARCH-009-V1] AI 不得恢复 Planner 身份

```apex-law
{
  "lawId": "APEX-ARCH-009-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "architecture-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast",
  "summary": "AI may only serve bounded choice judging and must not become a workflow planner or next-action controller.",
  "appliesTo": [
    "src/capabilities/ai-input-gateway/**/*.{ts,tsx}",
    "src/plugins/**/*.{ts,tsx}",
    "src/mediator/**/*.{ts,tsx}"
  ],
  "forbidden": [
    "AI outputting nextAction.",
    "AI outputting actionPlan.",
    "AI outputting browser command.",
    "AI outputting selector or coordinate.",
    "AI deciding final sensitive actions.",
    "AI generating workflow steps at runtime."
  ],
  "clauses": [
    {
      "clauseId": "apex-arch-009-requirement",
      "statement": "AI may only serve bounded choice judging and must not become a workflow planner or next-action controller.",
      "evidenceMode": "static",
      "ownerDomain": "architecture-boundary"
    }
  ]
}
````

### 法条

AI 只允许返回：

```txt
selectedOptionId
confidence
reason
```

AI 禁止返回：

```txt
nextAction
actionPlan
browserCommand
selector
coordinate
filePath
workflow
multiStepPlan
```

Flow 可以问 AI 一个有限选择题，但最终动作由 Flow 根据固定规则决定。

````

---

## 10. 架构变更必须先改法案

```md
## [APEX-ARCH-010-V1] 架构变更先改法案

```apex-law
{
  "lawId": "APEX-ARCH-010-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "architecture-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "hybrid",
  "summary": "Any new architecture layer, source root, job category, or ability group family must update architecture law before code is accepted; src/types is already approved only for declarative shared contracts.",
  "appliesTo": [
    "src/**",
    "scripts/**",
    ".github/instructions/agent-rules/**"
  ],
  "forbidden": [
    "Code-first architecture change.",
    "Unapproved new root folder.",
    "Unapproved new layer.",
    "Silent architectural expansion."
  ],
  "clauses": [
    {
      "clauseId": "apex-arch-010-requirement",
      "statement": "Any new architecture layer, source root, job category, or ability group family must update architecture law before code is accepted, while src/types remains restricted to declarative shared contracts.",
      "evidenceMode": "static",
      "ownerDomain": "architecture-boundary"
    }
  ]
}
````

### 法条

任何新增以下内容，必须先改架构法案：

* 新一级目录
* 新架构层
* 新能力组类型
* 新 job root
* 新 runtime 类型
* 新质检主链
* 新中介机制

没有法案更新，代码直接 FAIL。

````

---

# 对应 inspector 应该怎么执法

这个法案必须配一个 owner inspector，建议路径：

```txt
scripts/audit/domains/architecture-boundary/
  manifest.json
  inspector.ts
````

`manifest.json`：

```json
{
  "capabilityDomain": "architecture-boundary",
  "ownerInspector": "scripts/audit/domains/architecture-boundary/inspector.ts",
  "lawIds": [
    "APEX-ARCH-001-V1",
    "APEX-ARCH-002-V1",
    "APEX-ARCH-003-V1",
    "APEX-ARCH-004-V1",
    "APEX-ARCH-005-V1",
    "APEX-ARCH-006-V1",
    "APEX-ARCH-007-V1",
    "APEX-ARCH-008-V1",
    "APEX-ARCH-009-V1",
    "APEX-ARCH-010-V1"
  ]
}
```

Inspector 最少检查这些：

```txt
1. src 一级目录是否只包含 app / mediator / plugins / capabilities / lib / types，且 types 不含 runtime 行为
2. scripts 一级目录是否只包含 startup / acceptance / audit
3. 是否出现 forbidden root：orchestration / nerve-bus / planner / engine / agent / workflows
4. 每个 active plugin 是否有唯一 canonical mediator route、schema parse、plugin flow call，且 App / Local Runtime 无直连绕过
5. src/capabilities/<ability-id> 是否没有 import src/plugins
6. src/mediator 是否没有直接 import browser primitive / DOM runtime private file
7. src/lib 是否没有出现 Amazon/Facebook 业务关键词
8. 是否出现 nextAction / actionPlan / universal-agent 等 forbidden vocabulary
9. 新 job 是否有 acceptance smoke
10. package.json 是否没有暴露 retired script
```

---

# 最关键的机器阻断规则

你要让质检系统抓这几个硬点：

## A. 目录白名单

```txt
src 下面新增一级目录，不在白名单，直接 FAIL。
```

这条最有杀伤力。

## B. Flow 必须垂直落位

```txt
新增业务需求，只能进入 src/plugins/<job-id>。
不能进 src/lib。
不能进 src/capabilities。
不能进 src/app。
```

## C. 能力组反向依赖禁止

```txt
src/capabilities/** 禁止 import src/plugins/**
```

否则能力组就会被业务污染。

## D. 中介不能执行动作

```txt
src/mediator/** 禁止 import:
- browser primitive
- dom runtime private file
- upload runtime
- click runtime
```

中介只能 route。

## E. lib 不能业务化

```txt
src/lib/** 出现 amazon / facebook / invoice / product-video 这类业务词，要么白名单，要么 FAIL。
```

## F. 禁止第二大脑关键词

```txt
orchestration
nerve-bus
planner
universal-agent
nextAction
actionPlan
mission-loop
commander-console
```

只允许出现在：

```txt
migration notes
deleted notes
forbidden regression checks
archive
```

---

# 你这个系统最终应该变成这样

```txt
src/
  app/                  # 很薄，只是 UI/API 壳
  mediator/             # 很薄，只做需求分发
  plugins/              # 业务需求库，未来主要增长区
    amazon-invoice-upload/
    facebook-product-video-mining/
    ...
  capabilities/         # 稳定能力组，缓慢增长
    dom-automation/
    ai-input-gateway/
    forensics-persistence/
    ...
  lib/                  # 基础设施，不放业务

scripts/
  startup/
  acceptance/
  audit/
```

未来几十个需求来了，主要增长的是：

```txt
src/plugins/<job-id>/**
scripts/acceptance/<job-id>-smoke.ts
```

能力组只在确实出现“多个 job 都需要同类动作”时才增加或增强。

---

# 最后一句定性

你这个架构法案的核心不是“规定怎么写代码”，而是：

```txt
任何代码出生时，必须先证明自己属于哪一层。
证明不了，就不准出生。
```

这就是你要的极简 Agent 架构控制法案。
