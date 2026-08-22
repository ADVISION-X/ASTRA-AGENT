---
name: GrassEye Local App Shell
status: active
version: 2026-08-21.terminal
applyTo: src/app/**,scripts/audit/domains/local-app-shell/**,scripts/acceptance/**

# GrassEye Local App Shell｜终态法案

## Boundary

App Shell 是唯一本地 UI、唯一 HTTP server surface 和唯一 listener。它收集 known job 结构化输入、显示 durable status/evidence refs/runtime diagnostics，并把请求交给 Workbench Handle。它不拥有业务步骤、DOM/Chrome 动作、AI 判断、task truth、evidence truth 或浏览器重连。

## Single Browser Upgrade Surface

App Server 的唯一 Browser transport 责任是，在既有 4173 listener 上接收精确 path /browser-authority/v1 的 WebSocket upgrade，并将已认证 frame transport 注入 Browser Authority owner。App 不能创建第二 listener、page session、extension Port client、polling、SSE、open/inbound/next relay 或浏览器 command route。

workbench-home-page 只能显示 Browser Authority 的 ABSENT/PRESENT、release identity readback、redacted failure reason 和 evidence refs；不能 connect extension、生成 browser command、保存 target/permit、解析 raw frame 或维护 second dashboard truth。

## Input and status discipline

外部/页面输入只能是显式 known job schema。外部 caller 不可携带 selector、coordinate、URL、browserCommand、actionPlan、nextAction、tab/window/title/marker/conversation/concurrency。UI 不能将 localStorage、fixture、logs 或 raw JSON 当业务或 evidence 真相。

## Law

```apex-law
{"lawId":"APEX-LOCAL-APP-SHELL-001-V2","status":"active","tier":"P0","capabilityDomain":"local-app-shell","enforcementMode":"machine-blocking","evidenceMode":"law+blueprint+ast+acceptance+real-chrome","summary":"The existing App Server is the only UI/HTTP surface and owns exactly one /browser-authority/v1 WebSocket upgrade, never a Browser relay or business flow.","required":["one existing listener","exact WebSocket path","Workbench Handle only","display-only Browser status"],"forbidden":["page relay","extension Port client","polling","SSE","second listener","browser command route","business flow in App"],"clauses":[{"clauseId":"apex-local-app-shell-001-v2-single-upgrade","statement":"The replacement WebSocket upgrade and all consumer migration are atomic; old relay files have no active consumer.","evidenceMode":"static","ownerDomain":"local-app-shell"}]}
```

```apex-law
{"lawId":"APEX-LOCAL-APP-SHELL-002-V2","status":"active","tier":"P0","capabilityDomain":"local-app-shell","enforcementMode":"machine-blocking","evidenceMode":"ast+acceptance","summary":"App inputs and displays stay at their owner boundary.","required":["known schema inputs","same-DOM localization","durable result/evidence refs"],"forbidden":["browser control fields","frontend truth","second dashboard","raw evidence secret display"],"clauses":[{"clauseId":"apex-local-app-shell-002-v2-boundary","statement":"App cannot create or reinterpret Browser authority, business state or evidence.","evidenceMode":"static","ownerDomain":"local-app-shell"}]}
```
