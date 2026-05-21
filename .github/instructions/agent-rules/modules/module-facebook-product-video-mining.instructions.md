---
name: "Facebook Product Video Mining"
description: "Governs the Facebook product video mining job flow, app-shell surface, acceptance ownership, and audit owner binding."
applyTo: "src/plugins/facebook-product-video-mining/**,src/plugins/local-workbench-plugin-tasks.ts,src/lib/local-runtime/workbench*.ts,src/app/create-workbench-server.ts,src/app/server.ts,scripts/acceptance/facebook-product-video-mining*.ts,scripts/acceptance/facebook-live-dom-probe.ts,scripts/audit/domains/facebook-product-video-mining/**,package.json"
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