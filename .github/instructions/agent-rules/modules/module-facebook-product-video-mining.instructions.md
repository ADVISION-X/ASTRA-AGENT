---
name: "Facebook Product Video Mining"
description: "Governs the Facebook product video mining job flow, minimal app-shell surface, acceptance ownership, and audit owner binding."
applyTo: "src/plugins/facebook-product-video-mining/**,src/plugins/local-workbench-plugin-tasks.ts,src/lib/local-runtime/workbench*.ts,src/app/create-workbench-server.ts,src/app/server.ts,src/app/workbench-home-page.ts,src/app/workbench-home-client.ts,scripts/acceptance/facebook-product-video-mining*.ts,scripts/acceptance/facebook-live-dom-probe.ts,scripts/audit/domains/facebook-product-video-mining/**,package.json"
---

# Facebook Product Video Mining

status: active
version: 2026-05-21
capabilityDomain: facebook-product-video-mining

## 0. Identity

Facebook product video mining is one explicit plugin-owned business job flow.

The lawful chain is:

```txt
mission input
-> facebook-product-video-mining.flow.ts
-> DOM probe / comments / video download / AI bounded choice / reject-or-save
-> SQLite result records + promoted video artifact
-> next video or terminal status
```

App shell and local runtime may expose only start, status, latest, and mode metadata.
They must not decide business order.

The operator-facing Facebook workbench surface is intentionally minimal:

```txt
target product count -> Start
```

Feed entry, provider kind, model name, max rounds, max minutes, comment scan limits,
quality preference, video byte limit, and rejected-trace behavior are program
defaults owned by the Facebook mission schema and flow. They may be accepted by
the API for automation and tests, but they must not return as visible app-shell
configuration fields.

## [APEX-FACEBOOK-MINING-001-V1] Flow Ownership And Loop Truth

```apex-law
{
  "lawId": "APEX-FACEBOOK-MINING-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "facebook-product-video-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Facebook product video mining must remain one explicit plugin-owned flow that performs truthful probe, comment loading, video download, bounded AI judgment, reject-or-save, and persistence per round.",
  "appliesTo": [
    "src/plugins/facebook-product-video-mining/**/*.{ts,tsx,js,jsx,mjs}",
    "scripts/acceptance/facebook-live-dom-probe.ts"
  ],
  "forbidden": [
    "Business loop logic outside src/plugins/facebook-product-video-mining.",
    "Skipping download, AI judgment, or persistence while claiming saved products.",
    "Mock, fixture, or placeholder success for real-platform mining.",
    "Parallel second flow for the same Facebook mining demand."
  ]
}
```

### 法条

每轮必须围绕当前真实 Facebook 视频执行：

1. probe 当前视频与关键动作位点
2. 尽可能加载评论
3. 下载当前视频
4. 用 bounded choice AI 判断是否是种草视频
5. 非种草执行 not interested 或明确拒绝
6. 种草则保存视频与结构化记录
7. 入库后进入下一条或产生终态

### 禁止

- 把业务顺序塞进 `src/app`、`src/lib`、`src/capabilities`
- 只存 AI 文本、不存视频与候选记录却声称完成
- 用 demo/fake 数据伪装真实 Facebook 执行

## [APEX-FACEBOOK-MINING-002-V1] App Shell Surface And Acceptance Ownership

```apex-law
{
  "lawId": "APEX-FACEBOOK-MINING-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "facebook-product-video-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Facebook product video mining must expose lawful start/status/latest routes through the local workbench and must keep acceptance and audit ownership wired into CI-FULL.",
  "appliesTo": [
    "src/plugins/local-workbench-plugin-tasks.ts",
    "src/lib/local-runtime/workbench*.ts",
    "src/app/create-workbench-server.ts",
    "src/app/server.ts",
    "src/app/workbench-home-page.ts",
    "src/app/workbench-home-client.ts",
    "scripts/acceptance/facebook-product-video-mining*.ts",
    "scripts/audit/domains/facebook-product-video-mining/**/*.{ts,json}",
    "package.json"
  ],
  "forbidden": [
    "App shell owning Facebook step order.",
    "Missing mission start, run status, or latest status surface.",
    "CI-FULL omitting Facebook mining acceptance after the domain is active.",
    "Manifest pointing to a non-existent owner inspector."
  ]
}
```

### 法条

Facebook domain 成熟后必须同时具备：

- local workbench public start/status/latest surface
- repo-local live probe script under scripts/acceptance
- acceptance 脚本
- audit manifest + owner inspector
- CI-FULL 中的 acceptance 执行

### 禁止

- HTTP surface 直接下发业务步骤
- 没有 owner inspector 的假接入
- 只在 package script 声明而不进入 CI-FULL

## [APEX-FACEBOOK-MINING-003-V1] Minimal Operator Input And Automatic Mission Defaults

```apex-law
{
  "lawId": "APEX-FACEBOOK-MINING-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "facebook-product-video-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "The Facebook mining app-shell surface must ask the operator only for target product count and must derive all other mission parameters from governed defaults.",
  "appliesTo": [
    "src/app/workbench-home-page.ts",
    "src/app/workbench-home-client.ts",
    "src/plugins/facebook-product-video-mining/facebook-product-video-mining.schema.ts",
    "scripts/acceptance/facebook-product-video-mining*.ts",
    "scripts/audit/domains/facebook-product-video-mining/**/*.{ts,json}"
  ],
  "forbidden": [
    "Visible Facebook feed URL input in the workbench.",
    "Visible Facebook provider selector in the workbench.",
    "Visible Facebook model, max rounds, or max minutes fields in the workbench.",
    "Client-side Facebook mission payload requiring feedEntryUrl, providerKind, modelName, maxRounds, or maxMinutes.",
    "Facebook mission schema requiring operator-supplied parameters beyond targetProductCount."
  ]
}
```

### 法条

Facebook 种草视频入口必须保持一键任务形态：

```txt
选择目标种草视频数量
-> Start
-> 程序自动使用当前治理默认值执行
```

程序默认值必须由 schema / flow 维护，不能由页面表单暴露给操作者调参。
当前默认策略至少包含：

- 默认 Facebook feed entry。
- 默认 AI provider。
- 默认 modelName 为空。
- 默认最大轮数。
- 默认最大分钟数。
- 默认评论加载、视频质量、视频大小与 rejected trace 设置。

### 禁止

- 页面展示 `feedEntryUrl` 输入框。
- 页面展示 `providerKind` selector。
- 页面展示 `modelName`、`maxRounds`、`maxMinutes` 参数框。
- client payload 重新携带这些页面参数。
- 为了满足页面调参新增第二套配置面板、advanced panel、fallback 参数链或 shadow mission input。

## [APEX-FACEBOOK-MINING-004-V1] Platform Safety Defaults And Bounded AI Judgment

```apex-law
{
  "lawId": "APEX-FACEBOOK-MINING-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "facebook-product-video-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Facebook mining must not default to mutating the operator's recommendation profile and must convert AI web-chat stalls into bounded review-required evidence instead of leaving runs indefinitely running.",
  "appliesTo": [
    "src/plugins/facebook-product-video-mining/facebook-product-video-mining.schema.ts",
    "src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts",
    "src/capabilities/ai-input-gateway/providers/web-chat-open.ts",
    "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts",
    "src/capabilities/ai-input-gateway/providers/web-chat-upload.ts",
    "src/capabilities/ai-input-gateway/providers/web-chat-workspace.ts",
    "scripts/acceptance/facebook-product-video-mining*.ts",
    "scripts/audit/domains/facebook-product-video-mining/**/*.{ts,json}"
  ],
  "forbidden": [
    "Default notInterestedEnabled=true for operator-facing Facebook mining.",
    "AI web-chat judgment without a hard timeout.",
    "AI web-chat timeout that leaves the run in running with no candidate evidence.",
    "Provider composer wait that ignores the task abort signal.",
    "Typing a governed file path unless a provider file input is located.",
    "Continuing web-chat upload, submit, or answer extraction after the active Chrome tab drifts away from the provider workspace."
  ]
}
```

### 法条

Facebook mining 的默认行为必须保护操作者当前 Facebook 账号与推荐流：

- `notInterestedEnabled` 默认必须为 `false`；只有显式自动化输入才能开启负反馈动作。
- AI 判断必须有硬超时，并在超时后返回 `review_required` / `UNCERTAIN` 判断。
- AI 超时必须走正常 judgment failure 路径，保存候选 evidence 并让 mission 终止复核。
- web-chat provider 页面等待必须接收并传递 abort signal。
- 每次 upload / submit / answer extraction 前必须重新聚焦 provider workspace tab。
- 文件上传只能在定位到 provider file input 后进入 file-input selection；不得在未确认 native file chooser 打开时输入本地文件路径。

### 禁止

- 默认点击 Not Interested、Hide、See less 等会污染推荐流的动作。
- web-chat provider 卡住后让 run 长期保持 `running`。
- 用后台未落库的下载 artifact 冒充任务进展。
- Chrome active tab drift 后继续向错误 tab 输入 prompt 或文件路径。

## [APEX-FACEBOOK-MINING-005-V1] Successful Records And Selection Export

```apex-law
{
  "lawId": "APEX-FACEBOOK-MINING-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "facebook-product-video-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "The Facebook mining workbench must expose saved product-seeding records for the active run and must provide a structured export for downstream senior-AI product selection.",
  "appliesTo": [
    "src/plugins/facebook-product-video-mining/**/*.{ts,tsx,js,jsx,mjs}",
    "src/app/workbench-home-page.ts",
    "src/app/workbench-home-client.ts",
    "src/app/workbench-facebook-routes.ts",
    "src/lib/local-runtime/workbench*.ts",
    "scripts/acceptance/facebook-product-video-mining*.ts",
    "scripts/audit/domains/facebook-product-video-mining/**/*.{ts,json}"
  ],
  "forbidden": [
    "Workbench showing only run status while hiding saved PRODUCT_SEEDING records.",
    "Exporting rejected, uncertain, failed, or review-required candidates as successful products.",
    "Export payloads that omit source URL, product signals, AI reason, confidence, or artifact references.",
    "Export logic outside the Facebook mining owner surface."
  ]
}
```

### 法条

当 operator 输入 `targetProductCount=50` 并点击 Start 后：

- 系统必须按 flow 循环直到 `savedProductCount >= 50`、轮数/时间上限、失败或复核终态。
- 页面必须可读取当前 run 的 saved `PRODUCT_SEEDING` records。
- 页面必须显示 saved count / target count。
- 页面必须提供结构化导出资料，用于后续高级 AI 选品。
- 导出只能包含 status 为 `saved` 且 `aiSelectedOptionId=PRODUCT_SEEDING` 的候选。

### 禁止

- 把 rejected / uncertain / review_required 候选混入成功导出。
- 页面伪造 50 完成。
- 导出浏览器 session、cookie、localStorage、sessionStorage 或完整 HTML。
