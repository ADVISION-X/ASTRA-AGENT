---
description: "GrassEye 玄学 AI 生产工厂中的本地化跨仓合同、单阶段动作图、领取前兼容和证据闭环法案。"
applyTo: "src/plugins/xuanxue-ai-production/xuanxue-ai-production-localization-contract.ts,src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-*.ts,src/plugins/xuanxue-ai-production/xuanxue-ai-production.schema.ts,src/plugins/xuanxue-ai-production/xuanxue-ai-production.profile.ts,src/plugins/xuanxue-ai-production/xuanxue-ai-production-feed.ts,src/plugins/xuanxue-ai-production/xuanxue-ai-production-stage-execution.ts,src/plugins/xuanxue-ai-production/xuanxue-ai-production-result.ts,scripts/acceptance/xuanxue-ai-production*localization*.ts,scripts/audit/domains/xuanxue-ai-production/*localization*.ts,docs/法案辅助文件/GrassEye 玄学 AI 本地化生产对接终态施工图.md"
---

# GrassEye 玄学 AI 本地化生产合同法案

status: active
version: 2026-08-18.1
capabilityDomain: xuanxue-ai-production-localization-contract
canonicalContractOwner: ADVISION-X/xuanxue-web

## 0. 解释优先级

本法案只接管 `xuanxue-ai-production` 中的本地化生产子域。旧 `module-xuanxue-ai-production.instructions.md`、旧施工图、旧 acceptance/fixture 中涉及 `localization_static_review` 五阶段整单的历史语句，自本法案生效起不再是活动合同；非本地化八字、奇门、合婚、起名、公开知识、支付观察、质量复盘等条款不受影响。

活动运行时禁止重新接入：

```txt
localization_static_review
localization_candidate_a
localization_candidate_b
localization_selector_first
localization_selector_swap
localization_consistency
```

```apex-law
{"lawId":"GRASSEYE-XUANXUE-LOCALIZATION-CONTRACT-001-V1","status":"active","tier":"P0","capabilityDomain":"xuanxue-ai-production-localization-contract","enforcementMode":"machine-blocking","evidenceMode":"contract+schema+acceptance","summary":"AGENT consumes the website-owned localization semantic manifest and executes exactly four single-stage localization products; the legacy five-stage localization order is retired."}
```

## 1. 四产品七角色

```txt
localization_report_translation / report_translation / report_translation
localization_article_translation / article_translation / article_translation
localization_static_review_candidate / candidate_a|candidate_b / localization_candidate
localization_static_review_selector / selector_first|selector_swap|consistency / localization_selector
```

格式为：`product / role / stage`。

每张 cloud job 只有一个 stage。`selector_swap` 通过 `conversation_parent` 续接 selector-first，不得把两个角色重新合并成多阶段 local order。

## 2. AGENT 只有镜像验证权

AGENT 文件：

```txt
src/plugins/xuanxue-ai-production/xuanxue-ai-production-localization-contract.ts
```

只镜像 website canonical manifest 的确定性值用于 fail-closed 验证：

```txt
manifest version/hash
four product hashes
role sets
stage ids
required input kinds
provider profile hashes
```

AGENT 不拥有第二份可独立演化的本地化产品真相。两仓任何 hash 不一致必须阻断生产。

```apex-law
{"lawId":"GRASSEYE-XUANXUE-LOCALIZATION-CONTRACT-002-V1","status":"active","tier":"P0","capabilityDomain":"xuanxue-ai-production-localization-contract","enforcementMode":"machine-blocking","evidenceMode":"hash+claim","summary":"AGENT may mirror but never redefine website localization product contracts; manifest or product hash drift is a startup/claim block, not a recoverable provider error."}
```

## 3. Enrollment / Heartbeat 是合同握手

AGENT enrollment 与每次 device heartbeat 发送：

```txt
contract_manifest_hash
supported_product_contracts
agent_build_fingerprint
```

cloud worker 启动后第一件事必须同步 heartbeat。未通过时 `init()` 失败，不进入轮询。

禁止：

```txt
先启动健康
→ claim 新任务
→ AGENT parse 失败
→ 等 lease 过期
→ 每约 90 秒重领
```

## 4. Claim 解码隔离

Claim 客户端逐个任务处理：

```txt
raw job
→ minimal lease envelope
→ full contract schema
→ accepted
   or exact lease NACK(review_required)
   or unaddressable structured diagnostic
```

任何单任务 Zod 错误不得传播成整个 poll 的 `POLL_RETRY`。

NACK 复用原 failure endpoint，不建立第二控制通道。

```apex-law
{"lawId":"GRASSEYE-XUANXUE-LOCALIZATION-CONTRACT-003-V1","status":"active","tier":"P0","capabilityDomain":"xuanxue-ai-production-localization-contract","enforcementMode":"machine-blocking","evidenceMode":"claim+failure","summary":"Malformed leased localization jobs are isolated and NACKed per lease; one poison job cannot abort the batch or enter an expiry/re-lease loop."}
```

## 5. 本地 durable order 必须保留 semantic identity

Cloud staging 转本地 SQLite order 时必须保留：

```txt
contractManifestHash
productContractHash
localizationRole
providerExecutionProfile
```

parent replay 也必须保留同样字段。`createOrder` 前 profile 会再次检查 exact product/stage/role/input kinds/provider profile。

## 6. Selector Swap

`selector_first`：fresh conversation。

`selector_swap`：独立 cloud job，但必须携带：

```txt
conversation_parent.relation = same_conversation
conversation_parent.stage_id = localization_selector
parent product = localization_static_review_selector
parent role = selector_first
parent manifest/product hash == child
```

Claim 必须同时包含 `continuation_parent_replay`。本地父账本缺失时，先重建 selector-first；重建回答 hash 不等于原父 hash 时禁止继续 swap。

## 7. Provider 真实身份

冻结 profile：

```txt
provider=gpt-web-chat
transport=web-chat
model_family=gpt-5.6
model_label=GPT-5.6 Sol
candidate_a=xhigh
all other localization roles=high
```

`buildXuanxueAiFeedInput` 必须从 order 的 `providerExecutionProfile.reasoning_effort` 设置 `requestedReasoningEffort`。Gateway 现有真实 UI 选择/read-back 才产生 `modelIdentityProof`。

本地化 stage 完成必须同时满足：

```txt
modelIdentityProof.proofStatus=verified
family/display/reasoning == frozen profile
providerTranscriptJsonl present
providerTranscriptHash == transcript bytes
no forbidden tool/command/browser/function event
```

请求 profile 不是证明。

## 8. Result

AGENT result 必须原样回传：

```txt
contractManifestHash
productContractHash
localizationRole
```

网站拒绝任何与 leased job 不等的结果。AGENT 不得在结果阶段推导、修补或改变 role/hash。

## 9. Health

Worker 状态：

```txt
ready
contract_blocked
transient_degraded
stopped
```

Workbench `/api/health` 将其作为独立 `xuanxueAiProductionWorker` component 投影。

`contract_blocked` 的唯一正常治理动作是成对部署匹配的 `xuanxue-web + AGENT` 合同版本；普通 poll 重试不能解决语义不兼容。

## 10. 禁止

- 禁止旧五阶段本地化 product/profile/schema 回流活动代码。
- 禁止根据 `source_task_id`、文件名或 stage 名猜 role。
- 禁止 AGENT 修改网站 product contract hash。
- 禁止 model request metadata 冒充 live proof。
- 禁止 selector swap 新开 blank chat 或只上传父输出模拟续聊。
- 禁止一个 Zod parse failure 终止整个 claim batch。
- 禁止为 contract mismatch 建兼容桥、第二队列或第二结果真相。
- 禁止把浏览器插件实现细节写入本法案。

```apex-law
{"lawId":"GRASSEYE-XUANXUE-LOCALIZATION-CONTRACT-004-V1","status":"active","tier":"P0","capabilityDomain":"xuanxue-ai-production-localization-contract","enforcementMode":"machine-blocking","evidenceMode":"static+dynamic-provider","summary":"Localization contract failures are fail-closed identities; runtime compatibility bridges and inferred roles are forbidden."}
```
