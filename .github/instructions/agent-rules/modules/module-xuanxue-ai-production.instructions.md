---
description: "玄学网站 AI 生产工厂法案：整单领取、固定产品动作图、持久化生产窗口、断点恢复和整单回传。"
applyTo: "src/plugins/xuanxue-ai-production/**/*.ts,src/lib/local-runtime/workbench-xuanxue-ai-production-support.ts,scripts/startup/xuanxue-ai-production-cloud-enroll.ts,scripts/acceptance/xuanxue-ai-production.acceptance.ts,scripts/audit/domains/xuanxue-ai-production/**/*.{ts,json},docs/法案辅助文件/GrassEye 玄学 AI 生产工厂施工图.md"
---

# GrassEye 玄学 AI 生产工厂法案

status: active
version: 2026-07-28
capabilityDomain: xuanxue-ai-production

## 1. 唯一责任

`xuanxue-ai-production` 是玄学网站 AI 资料生产的唯一 AGENT owner。网站只提交一张
完整生产订单并接收整单结果；网站不得逐步骤遥控 AGENT，也不得发送 next action、
browser command、provider URL 或并发指令。

13 个产品共用网站商业履约主链，其中 5 个确定性产品永不进入 GPT 工厂；只有下列 8 个
AI 产品进入本 owner：

```txt
bazi_ai_full_analysis
bazi_report_followup
qimen_professional_answer
qimen_report_followup
hehun_ai_analysis
hehun_report_followup
naming_bazi_analysis_and_naming
naming_from_existing_bazi_report
```

## 2. 固定动作图

动作图只能由版本化产品 profile 决定，不使用通用 planner，不根据 AI 回答生成下一动作：

```txt
八字完整/追问：基础解读 → 同会话问题分析
奇门专业解答：单阶段分析
奇门追问：单阶段追问
合婚分析：甲方解读 ∥ 乙方解读 → 在乙方会话续聊形成合婚总论
合婚追问：单阶段追问
新命盘起名：八字基础解读 → 八字问题分析 → 新会话起名
已有报告起名：单阶段起名
人工准确度追问：继续父订单原 GPT 会话
付款截图观察：单阶段观察
公开知识文章：完整语料研究 → 同会话文章写作
```

网站必须一次提供该产品全部“静态阶段材料”。AGENT 只按固定 profile 决定依赖、并行、
续聊和下一阶段；前序 AI 原始回答由 AGENT 校验 hash 后生成内部附件，网站不得伪造。

## 3. 持久工厂

- 整单、阶段、状态、输入 hash、原始回答、provider proof 和事件必须写入本地 SQLite。
- `orderId` 与 `sourceTaskId` 都幂等；相同 hash 重放复用，冲突在 GPT 提交前失败。
- 默认生产窗口为 10 张在制整单，1..64 可由本机运维配置；调用方不能控制。
- 等待订单按本地 FIFO 进入窗口；领取云端任务时必须扣除本机 active 数量，禁止越领越多。
- 同一 orderId 在同一进程只能有一个执行 promise；不得 fire-and-forget 或吞掉后台异常。
- 阶段 execution id 永久稳定。重启后 `queued/running/recovery_pending` 重新进入唯一调度器，
  AI Input Gateway 依据同一 execution id 恢复已提交会话，禁止重发提示词。
- 云端允许携带已经证明的 `seeded_stages` 连续前缀；本地必须重验回答 hash、GPT proof
  和固定图顺序，只执行剩余节点，禁止浪费旧链已经完成的合法 AI 分析。
- 人工准确度追问必须携带父 job/stage/raw hash；只允许父订单原设备领取，并在父
  `webChatUrl` 继续会话。父回答同时作为校验后的内部附件，不得覆盖或修改。
- 临时无货进入 `recovery_pending`；登录、验证码、安全屏障或身份歧义进入
  `review_required`；不可变输入冲突进入 `failed`。

## 4. 云端激活

本机主动向网站服务器轮询，不开放入站端口。设备凭据只存 0600 文件或 secret env。
领取、输入下载、heartbeat、checkpoint、结果和失败回传都必须绑定当前 lease token/version。
服务器只返回整单，AGENT 只回传整单结果。

## 5. 禁止

- 禁止 website → Xuanyuan 逐阶段生产协议。
- 禁止通用 planner、AI 决定 workflow、兼容执行器、影子队列或第二结果真相。
- 禁止插件 import provider adapter、DOM/browser 私有实现或另一个插件。
- 禁止把 5 个确定性产品送入 GPT。
- 禁止重复提示词、失败吞没、假结果、无 lease 输入下载或无 hash 的跨阶段回答。
- 禁止人工复盘新开无父身份聊天，禁止把 seeded 回答当成无需 proof 的普通文本。

```apex-law
{
  "lawId": "GRASSEYE-XUANXUE-AI-PRODUCTION-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "xuanxue-ai-production",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance",
  "summary": "The website submits one governed material order and receives one result; the Agent production owner exclusively controls fixed product workflow execution.",
  "required": [
    "Exactly eight AI product ids enter one whole-order protocol.",
    "Only versioned product profiles control dependencies, parallel branches, continuation and final stage.",
    "Business plugins call AI Input Gateway only through its public contract."
  ],
  "forbidden": [
    "website-controlled next action, browser command or per-stage cloud job",
    "generic planner, AI-generated workflow or second execution owner",
    "deterministic products entering GPT transport"
  ],
  "clauses": [
    {
      "clauseId": "grasseye-xuanxue-ai-production-001-requirement",
      "statement": "The website submits one governed material order and receives one result; the Agent production owner exclusively controls fixed product workflow execution.",
      "evidenceMode": "acceptance",
      "ownerDomain": "xuanxue-ai-production"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-XUANXUE-AI-PRODUCTION-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "xuanxue-ai-production",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance",
  "summary": "Every production order and stage is idempotent, SQLite-durable and restart-recoverable under one bounded ten-order production coordinator.",
  "required": [
    "Order, stage, raw response, provider proof and event truth persist in SQLite.",
    "The default production window is ten and cloud claims subtract active local work.",
    "Restart resumes stable execution ids without duplicate prompt submission."
  ],
  "forbidden": [
    "in-memory-only order truth, untracked background promise or swallowed failure",
    "unbounded cloud claiming, duplicate local execution or duplicate prompt submission",
    "terminal loss for temporary provider absence"
  ],
  "clauses": [
    {
      "clauseId": "grasseye-xuanxue-ai-production-002-requirement",
      "statement": "Every production order and stage is idempotent, SQLite-durable and restart-recoverable under one bounded ten-order production coordinator.",
      "evidenceMode": "acceptance",
      "ownerDomain": "xuanxue-ai-production"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-XUANXUE-AI-PRODUCTION-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "xuanxue-ai-production",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance",
  "summary": "The local factory activates through authenticated outbound lease polling and returns exact whole-order checkpoints, results and failures.",
  "required": [
    "Device credentials remain local and permission-restricted.",
    "Input download and every mutation bind the exact lease token and lease version.",
    "The worker claims only available local production capacity."
  ],
  "forbidden": [
    "inbound home port or server callback",
    "unleased input download or result mutation",
    "secret output in logs, routes or evidence"
  ],
  "clauses": [
    {
      "clauseId": "grasseye-xuanxue-ai-production-003-requirement",
      "statement": "The local factory activates through authenticated outbound lease polling and returns exact whole-order checkpoints, results and failures.",
      "evidenceMode": "acceptance",
      "ownerDomain": "xuanxue-ai-production"
    }
  ]
}
```
