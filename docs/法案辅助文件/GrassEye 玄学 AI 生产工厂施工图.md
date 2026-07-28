# GrassEye 玄学 AI 生产工厂施工图 V1

status: construction-blueprint
version: 2026-07-28
authority: `.github/instructions/agent-rules/modules/module-xuanxue-ai-production.instructions.md`

## Boundary

```txt
玄学网站：冻结资料包 + 一张整单 ─────────────┐
                                             ↓
AGENT outbound worker → lease → 本地 SQLite 工厂账本
                                             ↓
                             固定产品 profile 动作图
                                             ↓
                              AI Input Gateway 公共合同
                                             ↓
                              GPT Web 原始回答与证据
                                             ↓
AGENT：整单结果 + checkpoint/failure ───────→ 玄学网站
```

网站不发送“下一步”；AGENT 不计算命盘、不创作领域 prompt、不判断商业履约。

## Product Profiles

| 产品 | 固定图 | 最终阶段 |
| --- | --- | --- |
| 八字完整分析 / 八字追问 | `base_interpretation → question_analysis` | `question_analysis` |
| 奇门专业解答 | `analysis` | `analysis` |
| 奇门追问 | `followup` | `followup` |
| 合婚分析 | `party_a ∥ party_b → final_compatibility` | `final_compatibility` |
| 合婚追问 | `followup` | `followup` |
| 新命盘起名 | `base → question → naming_author` | `naming_author` |
| 已有报告起名 | `naming_author` | `naming_author` |
| 人工准确度追问 | 父 job/stage/hash → 原会话 continuation | `manual_accuracy_challenge` |
| 付款截图观察 | `payment_screenshot_observation` | 同名阶段 |
| 公开知识文章 | `corpus_research → article_synthesis` 同会话 | `article_synthesis` |

Profile 对材料阶段实行精确集合和精确顺序校验。多一个、少一个或顺序错误都在 GPT 前失败。

## Production Window

```txt
云端待领取
→ 本机 availableCapacity = min(生产窗口-active, 设备容量-active)
→ FIFO waiting
→ active（默认最多 10 张整单）
→ completed / recovery_pending / review_required / failed
```

同一订单在一个进程只有一份 tracked promise。合婚的甲乙分支可并发；下一波只有依赖全部
完成后才启动。Gateway 自己继续执行单标签页 N=1 短操作锁和最多 10 个 provider feed。

## Durable Ledger

```txt
<dataDir>/plugin-tasks/xuanxue-ai-production/xuanxue_ai_production.sqlite
  production_orders
  production_stages
  production_events
```

每阶段永久使用：

```txt
xuanxue-ai-production:<orderId>:<stageId>
```

因此进程中断后恢复的是原会话，不是“再分析一遍”。前序回答写入内部 generated-inputs 前
必须重算 sha256，与上一阶段 rawOutputHash 完全一致。

云端 `seeded_stages` 只允许固定图的连续前缀。本地把原始回答和 provider proof 直接写成
completed 阶段，再从首个未完成节点继续。人工 challenge 不是普通根节点：它必须能在本地
读到父订单、父阶段、相同 raw hash 和精确 `webChatUrl`，否则进入人工处理而不是新开聊天。

## Outbound Cloud Protocol

```txt
device heartbeat
→ claim(limit = remaining local capacity)
→ lease-bound material download
→ local order create/reuse
→ factory_running checkpoint
→ stage graph execution
→ one whole-order result or bounded failure
```

协议固定 `xuanxue-ai-production-v1`。所有 job mutation 携带 lease token/version 和幂等键。

## File Plan

```txt
src/plugins/xuanxue-ai-production/
  xuanxue-ai-production.schema.ts
  xuanxue-ai-production.profile.ts
  xuanxue-ai-production.store.ts
  xuanxue-ai-production.flow.ts
  xuanxue-ai-production.scheduler.ts
  xuanxue-ai-production-cloud-contract.ts
  xuanxue-ai-production-cloud-client.ts
  xuanxue-ai-production-cloud-credential.ts
  xuanxue-ai-production-cloud-enrollment.ts
  xuanxue-ai-production-cloud-staging.ts
  xuanxue-ai-production-cloud-worker.ts
```

## Acceptance

- 证明八个产品的精确 stage graph。
- 证明合婚甲乙同时启动，最终阶段在乙方会话续聊且带两份前序原始回答。
- 证明 10 张在制整单时第 11 张等待，释放后才进入。
- 证明 order/source task 幂等冲突在投喂前失败。
- 关闭并重开 SQLite 后，queued/running/recovery_pending 按相同 execution id 恢复。
- 证明合法 seeded 前缀不再提交，非法前缀/hash/proof 在 GPT 前失败。
- 证明人工 challenge 继续父订单同一 GPT URL，并由父设备独占领取。
- 证明付款观察和 SEO 两轮也只有一张整单，SEO 第二轮继续研究会话。
- 审计云端领取只使用剩余容量，旧 Xuanyuan 云端执行片区不存在。
