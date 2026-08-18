# GrassEye 玄学 AI 本地化生产对接终态施工图

status: active-blueprint
version: 2026-08-18.1
canonical-contract-owner: ADVISION-X/xuanxue-web
executor: ADVISION-X/AGENT

## 1. 目标

AGENT 不再把静态本地化理解为一张 `localization_static_review` 五阶段整单，而是消费网站冻结的四种单阶段产品。网站拥有 semantic manifest；AGENT 只验证、执行和回传。

## 2. 唯一产品图

```txt
candidate_a
  cloud product localization_static_review_candidate
  local stage localization_candidate
  fresh conversation
  GPT-5.6 Sol / xhigh

candidate_b
  cloud product localization_static_review_candidate
  local stage localization_candidate
  independent fresh conversation
  GPT-5.6 Sol / high

selector_first
  cloud product localization_static_review_selector
  local stage localization_selector
  fresh conversation
  GPT-5.6 Sol / high

selector_swap
  cloud product localization_static_review_selector
  local stage localization_selector
  same_conversation(parent exact selector_first)
  GPT-5.6 Sol / high

consistency
  cloud product localization_static_review_selector
  local stage localization_selector
  independent fresh conversation
  GPT-5.6 Sol / high

report_translation
  cloud product localization_report_translation
  local stage report_translation
  fresh conversation
  GPT-5.6 Sol / high

article_translation
  cloud product localization_article_translation
  local stage article_translation
  fresh conversation
  GPT-5.6 Sol / high
```

## 3. 合同镜像

```txt
src/plugins/xuanxue-ai-production/xuanxue-ai-production-localization-contract.ts
```

固定镜像 website manifest/hash。启动或 claim 时任何不同即失败关闭。

Manifest hash：

```txt
sha256:ac26556a1d1e9f72037bd71189823d9bf7c3711e4945a569bccd0f7bd671dc57
```

Product hashes：

```txt
report   sha256:0ee71cf639a4a98356037f7d77495fded3752e0d694124c46f34a8b30d58bdc5
article  sha256:6137a876e538dbc49106d828f1ba6d9d9c4482f2c35f0dec578303385e8d3354
candidate sha256:2bdc7a50507354740e748101dbee52a84aeb530adb1eece38a8b697c7431577a
selector  sha256:9cc85d8b374d98cde912013405d17dc9f90b0487e692842b23afec2eddcb11bd
```

## 4. 启动握手

```txt
read cloud credential
→ verify configured server base
→ POST device heartbeat with manifest/product map/build fingerprint
→ server accepts exact contract
→ only then create polling loop
```

握手失败直接使 Workbench initialization 失败。不得进入后台 poll storm。

## 5. Claim

Server 已在 lease 前做 compatibility filter。AGENT 仍执行独立防线：

```txt
for rawJob of jobs:
  full = safeParse(fullClaim)
  if full.valid:
    accepted.push(full)
  else:
    minimal = safeParse(leaseEnvelope)
    if minimal.valid:
      POST /failure review_required contract NACK
    else:
      structured diagnostic only
```

整批函数最后只返回 accepted jobs。

## 6. Staging

每份输入：

```txt
download under child lease
→ byte length check
→ sha256 check
→ mode 0600 write
→ read-back hash check
→ exact directory membership check
```

生成本地 order 时必须带入 semantic identity；不能把 cloud profile 丢在 staging 边界。

## 7. Selector Parent Replay

`selector_swap` 的 parent replay 不是兼容桥，而是同一聊天恢复证明：

```txt
child lease
→ download parent selector-first frozen input
→ create local parent order with same manifest/product/profile
→ execute/recover parent
→ verify raw output hash equals cloud parent pointer
→ recover exact provider URL + turn marker
→ continue swap
```

若父 hash 漂移，子任务不能发送。

## 8. Feed

本地 feed builder：

```txt
requestedReasoningEffort = order.providerExecutionProfile.reasoning_effort
```

现有 Gateway 负责 Provider UI 的模型/推理选择和 read-back。本地化生产代码不访问插件 DOM。

## 9. Stage 完成门

所有本地化产品统一验证：

```txt
raw response present
raw hash canonical
JSON contract valid when requested
live model identity exact
provider transcript present/hash exact
transcript no forbidden tool event
```

失败进入现有恢复语义；无证据不能写 completed。

## 10. 回传

Order completed result 固定包含：

```txt
orderId/sourceTaskId/productId
inputBundleRef/hash
requestHash
contractManifestHash
productContractHash
localizationRole
finalStageId
stages[] raw bytes/hash/provider proof
```

网站再做 result binding 和 terminal Edition validation。

## 11. Worker Health

Worker 内部维护：

```txt
status
contractManifestHash
activeCount
lastSuccessfulHeartbeatAt
lastErrorCode
lastErrorReason
```

owner 投影给 Workbench health，形成独立 `xuanxueAiProductionWorker` component。

## 12. 已废止活动图

```txt
localization_static_review
localization_candidate_a
localization_candidate_b
localization_selector_first
localization_selector_swap
localization_consistency
```

旧 Git 历史可以保留；活动 schema/profile/claim/staging/feed/result 禁止读取这些身份。

## 13. 生产发布

网站与 AGENT 必须配对发布同一 manifest/product hashes。若只升级一仓，正确行为是：

```txt
startup contract handshake blocked
```

而不是：

```txt
transport v4 accepted
→ lease
→ Zod failed
→ 90 sec expiry
→ re-lease
```

本施工图不包含浏览器插件修复、Native Messaging 或 DOM 选择器建设。
