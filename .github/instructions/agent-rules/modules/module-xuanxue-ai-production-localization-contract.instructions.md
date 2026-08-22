---
description: GrassEye xuanxue website contract mirror and inbound whole-order validation.
applyTo: src/plugins/xuanxue-ai-production/xuanxue-ai-production-localization-contract.ts,src/plugins/xuanxue-ai-production/xuanxue-ai-production.schema.ts,src/plugins/xuanxue-ai-production/xuanxue-ai-production.profile.ts,src/plugins/xuanxue-ai-production/xuanxue-ai-production-feed.ts,src/plugins/xuanxue-ai-production/xuanxue-ai-production-stage-execution.ts,src/plugins/xuanxue-ai-production/xuanxue-ai-production-result.ts,scripts/acceptance/xuanxue-ai-production*localization*.ts,scripts/audit/domains/xuanxue-ai-production/*localization*.ts,docs/法案辅助文件/GrassEye 玄学 AI 本地化生产对接终态施工图.md
---

# GrassEye 玄学 AI 本地化生产合同终态法案

status: active
version: 2026-08-21.terminal
capabilityDomain: xuanxue-ai-production-localization-contract
canonicalContractOwner: ADVISION-X/xuanxue-web

本法案只镜像网站拥有的本地化语义 manifest，用于总 Plugin 既有 V5 Cloud Pull 整单的 fail-closed 验证；本子域不拥有第二产品真相，也不另建 cloud claim、heartbeat、poll、lease、NACK 或结果通道。

AGENT 必须验证 contract manifest hash、product hash、role、stage、required input kind、provider profile hash 和 inbound whole-order identity；网站和 AGENT hash 不一致即拒绝，不建兼容版本或第二队列。

网站拥有的静态审校 trigger `localization_static_review` 必须按原值进入 V5 whole order；它只是一种 trigger，不是旧五阶段产品。AGENT 只允许两个现役单阶段 product `localization_static_review_candidate` 与 `localization_static_review_selector`，并继续拒绝把 `localization_static_review` 当作 product。

本地化每个 job 仍是固定 Plugin flow 的单阶段产品。任何 provider 真实身份、conversation continuation、checkpoint、human gate 和结果都由 xuanxue plugin 的 durable order owner 管理。Browser/AI 输入只经终态 Browser Authority/AI gateway public contract；外部 job 不能带 selector、tab、conversation、browser command 或下一步。

禁止由本地化合同子域另建 cloud worker、cloud enrollment、outbound heartbeat/polling、cloud staging、cloud failure callback；禁止旧五阶段兼容、推断 role、raw provider request 冒充真实 proof。总 `xuanxue-ai-production` Plugin 的唯一 V5 Cloud Pull、heartbeat、lease 与 result 主链不属于本子域，不能被本条重复实现或阻断。

```apex-law
{"lawId":"GRASSEYE-XUANXUE-LOCALIZATION-CONTRACT-001-V2","status":"active","tier":"P0","capabilityDomain":"xuanxue-ai-production-localization-contract","enforcementMode":"machine-blocking","evidenceMode":"contract+schema+acceptance+business","summary":"AGENT mirrors the website-owned localization manifest only to validate authenticated inbound whole orders; no cloud transport or second product truth remains.","clauses":[{"clauseId":"grasseye-xuanxue-localization-contract-001-v2-inbound-mirror","statement":"Manifest/hash/role/stage drift rejects the whole order before Plugin flow and cannot be repaired by compatibility transport.","evidenceMode":"acceptance","ownerDomain":"xuanxue-ai-production-localization-contract"}]}
```
