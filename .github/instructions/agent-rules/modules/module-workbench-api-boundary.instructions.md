---
name: GrassEye Workbench API Boundary
status: active
version: 2026-08-21.terminal
applyTo: src/app/workbench-api-boundary.ts,src/app/workbench-site-*.ts,src/lib/local-runtime/workbench-api-boundary-log.ts,scripts/audit/domains/workbench-api-boundary/**,scripts/acceptance/**

# GrassEye Workbench API Boundary｜终态法案

## Identity and boundary

唯一 API ingress 是 workbench-api-boundary -> explicit known route -> Workbench Handle -> mediator -> owning plugin。Boundary 只负责 method/path allowlist、Origin/LNA/CORS、逐站 request identity、raw body hash、redacted ingress receipt；不决定业务步骤、不调用 Browser/DOM/capability private runtime、不保存 task truth。

本地 UI 与每个获准外部网站使用不同身份合同。外部站点只能提交已知完整 job 的业务 schema，不能提交 selector、coordinate、URL、browserCommand、nextAction、actionPlan、flowStep、tab/window/title/marker/conversation/concurrency、file path 或 provider transport。

## Per-site HMAC

每个 site credential 是独立 256-bit secret，并有 keyId、active/rotating/revoked 生命周期。认证 transcript 必须精确绑定 keyId、requestId、issuedAt、deadline、HTTP method、exact path、bodySha256；raw body 必须在 parse 前 hash。HMAC 不通过、requestId 已在不少于 10 分钟 replay cache、deadline 超过 60 秒或已过期、key revoked、wrong Origin/LNA/CORS/route 任一成立时，拒绝且无业务副作用。

rotation 必须并列在同一 site owner 内有界完成；revocation 立即生效。Origin/CORS/LNA 只证明浏览器边界，不能替代 HMAC。callback 仅允许 law-owned exact base path，不能是 caller arbitrary URL。

玄学 AI production 不登记 external site policy、external route 或 HMAC credential：它只经 AGENT 的主动 Cloud Pull 取得 grant。`/api/xuanxue-ai-production/*` 保留为 local-ui status/pause/cancel/takeover/resume surface，不是外部业务 ingress。Amazon 等其余已授权 external owner 继续使用本节 HMAC，不得因玄学 cutover 被削弱。

## Law

```apex-law
{"lawId":"APEX-WORKBENCH-API-BOUNDARY-001-V3","status":"active","tier":"P0","capabilityDomain":"workbench-api-boundary","enforcementMode":"machine-blocking","evidenceMode":"law+blueprint+ast+exam+real-chrome","summary":"Every remaining authorized external website ingress is a known business route authenticated by a per-site HMAC; xuanxue AI production is outbound Cloud Pull and has no external ingress policy.","required":["raw body hash before parse","keyId/requestId/issuedAt/deadline/method/path/body hash transcript","10 minute replay protection","60 second maximum deadline","rotation and immediate revocation","redacted receipt","xuanxue routes local-ui only"],"forbidden":["xuanxue external HMAC/LNA/localhost business ingress","single global external key","wildcard CORS","arbitrary callback","Browser control fields","inbound browser relay","API gateway duplicate"],"clauses":[{"clauseId":"apex-workbench-api-boundary-001-v3-external-hmac-excludes-xuanxue","statement":"Invalid external ingress fails closed before mediator admission, and xuanxue AI production has no external ingress route or credential.","evidenceMode":"acceptance","ownerDomain":"workbench-api-boundary"}]}
```
