---
description: "GrassEye Xuanyuan generic local GPT acceptance law. Website production orders belong exclusively to xuanxue-ai-production."
applyTo: "src/plugins/xuanyuan/**/*.ts,src/app/workbench-xuanyuan-routes.ts,scripts/audit/domains/xuanyuan/**/*.ts,scripts/acceptance/xuanyuan.acceptance.ts,docs/法案辅助文件/GrassEye Xuanyuan 受控本地执行施工图.md"
---

# GrassEye Xuanyuan 受控本地执行法案

status: active
version: 2026-07-28
capabilityDomain: xuanyuan

## Boundary

Xuanyuan 只拥有“一份已治理提示词包对应一次 GPT Web 投喂”的通用本地验收任务。
它保留本地 Workbench 的排队、查询、续聊和原始回答证据能力，但不再领取玄学网站云端
生产订单，不编排八字、奇门、合婚、起名的多步骤动作图。

玄学网站的整单领取、固定产品流程、生产窗口、阶段依赖、跨阶段原始回答交接和整单回传，
唯一归属 `xuanxue-ai-production`。旧 `xuanyuan-cloud-*` 区域必须保持删除。

## Required

- Job id 固定为 `xuanyuan`，入口固定为四条受鉴权 Workbench route。
- 每个请求对应一次 AI Input Gateway feed；提示词、输入文件、限制和任务身份必须先持久化。
- 续聊只接受上一 Xuanyuan task id 和精确回答 hash，由 Xuanyuan 内部解析 provider 会话。
- 同一 `sourceProject + requestId` 完全相同的重试返回原任务；冲突内容在投喂前失败。
- 原始回答、hash、provider proof、失败账和恢复动作必须持久化。
- 临时没有 GPT 标签页、浏览器断线、限流或网络问题保留同一任务为 `recovery_pending`；
  已提交任务按精确 execution id 恢复，禁止重复发送。

## Forbidden

- 不得存在 `xuanyuan-cloud-client/contract/credential/enrollment/staging/worker`。
- 不得接收玄学网站生产流量或产品动作图。
- 不得 import provider adapter、DOM、browser 私有实现或 provider SDK。
- 不得接受 provider URL、tab id、selector、坐标、浏览器命令或调用方并发参数。
- 不得解析、修复或判断领域内容，不得产生假成功。

```apex-law
{
  "lawId": "GRASSEYE-XUANYUAN-001-V3",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "xuanyuan",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+acceptance+audit",
  "summary": "Xuanyuan owns only durable generic one-feed local GPT acceptance tasks; xuanxue-ai-production exclusively owns website production orders and multi-stage graphs.",
  "required": [
    "Xuanyuan persists one governed request and one gateway result under an idempotent local task identity.",
    "Exact submitted work survives restart without duplicate prompt submission.",
    "The former Xuanyuan cloud production region remains physically deleted."
  ],
  "forbidden": [
    "website production claims or xuanxue product workflow graphs inside Xuanyuan",
    "provider adapter, browser private implementation or provider SDK inside Xuanyuan",
    "fake success, duplicate restart submission or caller transport controls"
  ],
  "clauses": [
    {
      "clauseId": "grasseye-xuanyuan-001-v3-requirement",
      "statement": "Xuanyuan owns only durable generic one-feed local GPT acceptance tasks; xuanxue-ai-production exclusively owns website production orders and multi-stage graphs.",
      "evidenceMode": "acceptance",
      "ownerDomain": "xuanyuan"
    }
  ]
}
```
