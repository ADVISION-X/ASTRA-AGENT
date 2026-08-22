---
name: GrassEye Index
status: active
version: 2026-08-21.terminal
---

# GrassEye Index

## Active Execution Routes

```text
HTTP -> workbench-api-boundary -> explicit known route
-> Workbench Handle -> mediator/<job-id>-route
-> plugin/<job-id> public facade -> fixed flow
-> capability index.ts or BrowserAuthorityBroker
```

Browser authority 仅走：

```text
BrowserAuthorityBroker -> exact lease -> /browser-authority/v1 WebSocket
-> fixed unpacked MV3 -> fixed command registry -> exact Chrome target/document
```

已知业务入口是 `amazon-invoice-upload`、`amazon-product-mining`、`media-processing-artifact`、`xuanxue-ai-production`。新 job、root、owner、capability family 或 active law 需要明确用户授权和完整法案/blueprint/inspector/acceptance/CI 接入。

## Active Support Routes

- `scripts/startup/launch-grasseye.mjs`：唯一用户启动入口。
- `src/app/create-workbench-server.ts`：唯一 HTTP listener 和 exact WebSocket upgrade owner。
- `src/lib/local-runtime/*`：依赖装配和窄 Workbench Handle。
- `src/lib/browser/*`：唯一 Browser Authority chain。
- `src/lib/runtime-logs/*`：唯一 Runtime Log Spine。
- `src/capabilities/*/index.ts`：唯一 capability public facades。
- `scripts/audit/build-audit-artifacts.ts -> core/run-generated-plan.ts -> ci-full.ts`：唯一完整审计链。

## Retired Routes / Terms

以下术语、文件责任和引用均不得进入 active source、law、blueprint、manifest、package script、acceptance、inspector 或 generated truth：

```text
Chrome Web Store / CWS release identity or review
externally_connectable
runtime.onConnectExternal
ExtensionExternalPortActor
WorkbenchExtensionChannel
page-session grant
browser-extension-channel open/inbound/next relay
Native Messaging / connectNative / native host
CWS_PAGE_CHANNEL
current + previous protocol compatibility
xuanxue external HMAC/LNA/localhost business ingress
```

发现任一残留，不得新增兼容路径；列全真实 consumers，在所属 owner 工作单中物理替换或删除，并从最早受影响验证门重跑。
