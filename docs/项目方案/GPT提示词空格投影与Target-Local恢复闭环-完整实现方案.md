# GPT 提示词空格投影与 Target-Local 恢复闭环—完整实现方案

## 0. 方案状态与唯一结论

状态：**可施工；独立方案审计 PASS（完整度 97%、准确度 97%、P0=0、P1=0），尚非 CHANGE/READY/RELEASE 质量 PASS**。

本方案只修复工单 `aiprod_529726a2-7d6b-458c-b1e7-3bdd257a78a0` 已证明的两处连续断裂：

1. Browser 将 ChatGPT `contenteditable` 为排版保留的 `U+00A0` 当成 Product Prompt 的真实字符，导致实际等价的 Prompt 被 exact readback 拒绝。
2. Website 丢弃已经运输的 `effect_scope + browser_outcome`，只按 `mutation_outcome=confirmed` 把 `target_local + REJECTED` 错判为 Provider effect readback，令同一 accepted attempt 循环重领。

历史裁决已经确定：2026-09-02 的原始跨仓合同明确规定 `target_local + REJECTED` 是普通 attempt failure，通用 `mutation_outcome` 不能单独证明 Provider submit；2026-09-11 至 09-15 的法案泛化、测试和 `providerEffectAllowsNewAttempt(mutationOutcome)` 把这条边界压扁，属于现役错误。

唯一正确边界不是“所有 target_local 都自动新 attempt”，而是：

```text
target_local + REJECTED
  -> 本地准备动作已经终结，没有 Provider effect
  -> Website 结束旧 attempt，有限退避后签发新 attempt

provider_effect + DISPATCHED/CONFIRMED
或 provider_effect + REJECTED + mutation_outcome=dispatched/confirmed
  -> Provider effect 已发生或结果未知
  -> 保留同一 accepted attempt，只允许零 submit 读回

target_local + DISPATCHED
或 target_local + CONFIRMED + mutation_outcome=confirmed
或事实缺失/组合矛盾
  -> 不在本次故障的已证明可重试分母内
  -> 失败关闭并保留 attempt，禁止推测和重放
```

本方案不新增状态、表、migration、队列、恢复 Owner、兼容桥、feature flag、第二 WAL、第二文本投影或第二质量 verdict。

## 1. 需求、业务终点与非目标

### 1.1 工单事实

- 业务：Website 固定页面文案本地化，不是文章翻译。
- route：`localization_static_catalog / produce_locale_catalog`。
- locale：`zh-HK`。
- 分母：111 条 `message_items`。
- Product 调用：`files: []`，没有 GPT 附件；文件名括号年月日不在 Provider 输入链上，不是根因。
- 当前 accepted attempt：`26cc3dde-7fc2-4022-9bb4-d28392b177b4`。
- 已观察：22 次 `write_exact_gpt_prompt` 均为 `target_local + REJECTED + confirmed`，Provider physical submit 为 0。

### 1.2 完成终点

1. 同形 Prompt 的七处 DOM `U+00A0` 被 Browser 唯一机械投影还原为批准文本中的 `U+0020`，其它字符、数量、换行和末尾 marker 不变。
2. Website 对 `target_local + REJECTED + confirmed` 结束旧 attempt，不再产生 `PROVIDER_EFFECT_READBACK_PENDING`。
3. Provider effect 已发生或未知的对照组仍保留同一 accepted attempt，physical submit 增量恒为 0。
4. 当前旧 attempt 不根据可能陈旧的首条 failure 强制清除；生产停写窗口重新证明完整 lease/WAL 分母内 physical submit 为 0 后，只重领同一 accepted attempt。这样即使证据遗漏，attempt identity 也不会放大成第二 submit。
5. 当前同一 attempt 在修复后只提交一次 Provider turn；未来首次发生的 `target_local + REJECTED` 则由 release 原子结束并在退避后签发新 attempt。最终由 Website static-catalog consumer 持久接纳 111 条 zh-HK candidate，并读回有效 admission receipt。

### 1.3 非目标

- 不修 Product Prompt、JSON 缩进或业务材料来掩盖 Browser 错误。
- 不放宽 Prompt hash、跳过 retained-value postcondition或做 `trim`/通用空白折叠。
- 不把 `mutation_outcome=no` 单字段继续当作新-attempt资格；只有完整合法的 `provider_effect + REJECTED + no` 保留既有新-attempt语义。`target_local + DISPATCHED`、`target_local + CONFIRMED`、result revision、stopped-empty或 failure ledger 首条唯一性等未被本事故证明必须改变的语义保持失败关闭。
- 不新增 native cause code；现有主码、WAL fact、hash 和 effect facts 已足够定位与验收。
- 不自动重试生产工单、不重启服务、不直接操作数据库。

## 2. Scoped candidate 绑定

| 仓库 | branch / HEAD / tracking | 目标片区状态 |
|---|---|---|
| `/Users/nexgen/Documents/AGENT` | `main` / `42643572967f5c9f193e54ad16036a45687d566c` / `origin/main` 同 HEAD | 目标 authority、Blueprint、Browser 源码 clean；本方案未跟踪；其它 dirty overlay 不触碰 |
| `/Users/nexgen/Documents/xuanxue-web` | `main` / `941e91a842b4388c96216f39a43927c4a128e949` / `origin/main` 同 HEAD | 目标片区 clean |

关键指纹：

- AGENT active law `a6c6ea847cc98e50fdfe6b7a9511bb4d90c8143be65b00f55d47657a80da6eba`；V6/GPT/Browser Blueprint `c1c250d93076344b3fdde0d5ba911b31782d8aa8344fa9c1d007ea200b05433e` / `be6e23b6b50b2be0cf9dd728dc7530a4b3cb80eaaf91497adb01d9d159fe48be` / `0058f979cb5a8a0d9a76998fc865329c6fdc81cd009b3a8170ea959683b25fbe`；Browser exact/semantic/coherent 三文件 `1ce2c31c9d54e62b08de6fc2dbd9807157b69697895c058ebbf63c4b714a9b41` / `d769a90a80aba8c4ecd9206827a1adb2227ba36a1e3965de494fab8f3dc26dd5` / `07cb8aaefa8342877f9f70fc31b7e5184107ade0b254b3d4783482327743ec84`。
- Website active law `5e85325a56c0a5b107eb69caff404f5fc67d46593661f1484274df8d8cef3055`；SYSTEM/AI Acceptance Blueprint `920490c76151f30ffaeef32bc28ca389256347818d44fdeaef616b24f0a4e6bc` / `a191ad9900839fe2394582498d549293c286269e68e7491ea56c7b893e29f974`；V6 manifest/assertions `37a70ade912868fdfe29e36355c1a81d60d052e185aaa5c802952c7ccc7c1849` / `5eaeb87fc7d0cc13f63f2ad0f84201df727c9646c4604a30b228a1d9c9b1316e`；lifecycle core/repository/expiry `2fad24a013dc8d74ace0ac51752066c5779a1ac548bdbda3a00eb99b92c06297` / `5be94e2af8fc7725e5bb20653d7d074fbe86a942ca34815683d67d5f82376fe5` / `680b294e8dfa38339189d04196e8f727ed3c66b5e9c7dd006b13d37206612180`；claim/cooldown `ef6c0fe6bd06ac0631baa5e0a05162c69731d506c7bd69e23d0ba86c5c530429` / `d860c59764f32146bacea5f3e6ef07c73c70f4856b9185cfaa7e6805bab847ce`。

施工前必须重新读取两仓 `HEAD`、tracking、目标路径状态及完整 hash。相关 candidate 漂移时先重开本方案；不得把旧结论套到新候选。

## 3. 现役链与第一直接断裂

```text
Website static-catalog sender
  -> V6 task/material/grant
  -> AGENT localization-production Product
  -> write_exact_gpt_prompt
  -> Browser Input.insertText(approvedText)
  -> Browser exact editable projection + hash
  -> submit_exact_gpt_turn_once
  -> answer artifact -> Runtime Outbox
  -> Website staging
  -> localization-static-candidate-set-consumer.v1
  -> domain admission receipt -> public completed
```

第一直接断裂在 Browser 唯一 exact editable reader：批准 Prompt 与 DOM 都是 UTF-16 长度 111074、换行 67；DOM 仅在 7 个位置用 `U+00A0` 表示批准 Prompt 的 `U+0020`。当前 reader 原样返回文本节点，导致 retained value/hash 不等。

第二直接断裂在 Website `providerEffectAllowsNewAttempt`：函数名称声称裁决 Provider effect，输入却只有 `mutation_outcome`。release 与 lease-expiry 两个消费者因此把 `target_local + REJECTED + confirmed` 送入同-effect readback。

相同 attempt 重领 22 次及后续 failure idempotency conflict 是第二断裂造成的后果，不另立恢复系统，也不修改 failure ledger。普通首个 release 在新裁决下原子结束新发生的 target-local rejected attempt。当前历史 attempt 已被旧 `sameEffectReadback` 清空 `lease_expires_at`；首条 immutable failure 不能证明其后所有 lease 都没有 Provider effect，所以禁止据此全局清除 NULL-lease attempt。当前事故只在停写窗口重新读回完整 Browser WAL、Website lease event 分母及 physical submit=0 后，沿现役 claim 重领同一 attempt；若证明不完整就停止，不做数据库修补。

## 4. 双仓权威冲突与解冻范围

### 4.1 正确且保留

- Website `ai-acceptance` 是 accepted attempt、新 attempt 与同 effect readback 的唯一 Owner。
- Browser WAL 只拥有物理 mutation/effect terminal facts，不决定 attempt。
- fresh/profile/model/menu/附件/Composer 是 `target_local`；只有 `submit_exact_gpt_turn_once` 是 `provider_effect`。
- V6 failure wire 已包含 `effect_scope`、`child_capability_id`、`browser_outcome`、`mutation_outcome`，不需要新字段。
- manifest 已写明 `target_local_rejected_policy=normal_attempt_failure` 和 `generic_mutation_outcome_is_not_browser_terminal_outcome=true`。

### 4.2 精确解冻、替换并重新冻结

用户已明确授权本轮解冻法案、迭代完成后继续冻结。只允许修改：

- AGENT `LAW-LOCAL-BROWSER-SESSION-004-V44`：冻结唯一 Composer/user-turn 机械投影的 NBSP→ASCII space 语义，并保持 assistant semantic text 不变。
- AGENT `LAW-GPT-002-V20` 的 `FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001`。
- Website `LAW-AI-ACCEPTANCE-004-V25` 的 mutation-only 恢复条款。
- Website `LAW-AI-ACCEPTANCE-012-V32` 的 attempt-failure 裁决条款。
- Website `LAW-AI-ACCEPTANCE-013-V15` 的同名冻结条款。
- Website `LAW-PUBLIC-KNOWLEDGE-CONTENT-005-V32` 的 mutation-only恢复文字及对 AI-004/012 的直接依赖。
- Website `LAW-COMMERCIAL-FULFILLMENT-DELIVERY-007-V3` 的 mutation-only恢复 summary；该法条直接覆盖 `services/api/**` 且没有反向依赖。

替换语义统一为：`target_local + REJECTED` 是普通 attempt failure；只有真实或未知 Provider effect 必须保留同 accepted attempt。AGENT Browser/GPT 法条升版后，必须同步升级并只更新依赖引用闭包：`LAW-GPT-001-V56`、`LAW-AGENT-PRODUCTION-RUNTIME-006-V38`、以及由它们继续反向依赖的 Runtime 001/003/004/005/007/008；不得顺手改其业务语义。Website 五条命中法条按依赖顺序升版。所有冻结条款完成同候选替换后重新冻结。基础法案、无关功能法条和历史 migration 不改。

版本闭包固定为：

| 仓库 | 现役 -> 目标 | 修改性质 |
|---|---|---|
| AGENT | Browser-004 `V44 -> V45`；GPT-002 `V20 -> V21` | 本次语义替换并重冻 |
| AGENT | GPT-001 `V56 -> V57`；Runtime-006 `V38 -> V39`；Runtime-001 `V64 -> V65`；Runtime-003 `V36 -> V37`；Runtime-004 `V36 -> V37`；Runtime-005 `V34 -> V35`；Runtime-007 `V38 -> V39`；Runtime-008 `V39 -> V40` | 只更新直接/传递依赖引用及法案版本表，不扩大语义 |
| Website | AI-004 `V25 -> V26`；AI-012 `V32 -> V33`；AI-013 `V15 -> V16`；Public-Knowledge-005 `V32 -> V33`；Commercial-Fulfillment-Delivery-007 `V3 -> V4` | 恢复语义替换、直接依赖更新并重冻 |

施工时必须由 canonical law parser 重新计算反向依赖集合并与上表精确相等；多一条或少一条均停止，不凭本文手工猜测继续。

### 4.3 施工图与合同

- AGENT V6、GPT、Browser 三份现役 Blueprint 对齐精确恢复边界及 editing-host space 投影。
- Website SYSTEM 与 AI Acceptance Blueprint 删除 mutation-only 表述，写入同一裁决表。
- V6 manifest/spec 将笼统 `dispatched_or_confirmed_policy` 改成 scope/outcome-aware 文义，保留原字段集合。
- 这是 provider 合同语义变更，按现役规则升级 control contract version；Website provider 位于 `docs/specs/ai-acceptance/xuanxue-ai-production-v6.contract.spec.json`，AGENT 最小 consumer dependency 位于 `docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json`。两者按各自 canonical source 原位升版；generated registry 只由各仓现役治理生成入口重建，不手改 generated 产物。
- 不新增 schema、数据库列或 migration。

## 5. 唯一目标实现

### Work Order A — Browser 唯一 Prompt 投影

Owner：`local-browser-session`。

1. 在 `dom-exact-editable-text.ts` 的文本节点投影中只把 `U+00A0` 转成 `U+0020`。
2. `readExactEditableText`、coherent observation 与 exact editable hash 继续共享同一 injected source。
3. 在 `dom-semantic-text.ts` 的 `browserCanonicalGptUserPromptText` 对 user Prompt 做同样映射。
4. 修改 `dom-coherent-observation.ts`，让长 Prompt 和短 Prompt 两个互斥结构都调用同一个 user-only serializer；assistant 继续调用通用 `canonicalSemanticText`，不得受映射影响。
5. Tab、LF、CR、U+202F、全角空格、前后空格和重复空格数量原样保留。禁止 `trim`、`\s` 折叠、NFKC 或 Product/GPT fallback。

批准 Prompt 本身若真实包含 NBSP，expected hash 仍按 NBSP 原文计算；Browser 投影为 ASCII space 后必须 mismatch，不能把未声明语义静默放宽。

### Work Order B — Website 精确 attempt 裁决

Owner：Website `ai-acceptance`。

1. 物理删除 `providerEffectAllowsNewAttempt(mutationOutcome)`，不留 alias。
2. 在同一 core 原位建立一个只供 release 与 expiry 复用的 typed predicate，输入完整 `effect_scope + browser_outcome + mutation_outcome`。
3. 只有两类结束旧 attempt：`effect_scope=provider_effect && browser_outcome=REJECTED && mutation_outcome=no`；`effect_scope=target_local && browser_outcome=REJECTED` 且 mutation outcome 为合同允许值。字段缺失不能仅凭 `mutation_outcome=no` 获得新-attempt资格；第二类是本次新增的精确修正。
4. 其它组合保留 accepted attempt并失败关闭/等待现役收敛；Provider effect 的 occurred/unknown 继续零 submit readback。
5. release 将完整 failure 交给 predicate；本事故 shape 必须走 `releaseFailedAttempt`。
6. `job-expired-attempts.ts` 继续只处理真实过期 lease，不扩大到 `lease_expires_at IS NULL`。它读取首条 failure 的完整三字段以及 `failure.lease_version`；只有 failure lease version 与当前 runtime lease version 精确相等时，才允许 predicate 决定结束旧 attempt。版本不等、字段缺失或矛盾一律保留同 attempt并走 readback，禁止让陈旧首条 failure 授权第二 submit。
7. Provider cooldown cohort 的 `effect_recovery/unsent_resume/unclassified` 是现役 receipt/control-room 的真实消费者，必须在 `provider-cooldown-repository.ts` 原位按同一矩阵分类：可新 attempt=`unsent_resume`；真实/未知 provider effect=`effect_recovery`；其它=`unclassified`。三类继续互斥且合计 pending，不新增 helper、字段或 read model。
8. V6 validator 增加现有事实一致性：`provider_effect + CONFIRMED` 不得接受 `mutation_outcome=no`；合法 `target_local + CONFIRMED + no` 零动作满足态保持允许。

### Work Order C — 权威与质检原子对齐

顺序不可交换：

1. 按 4.2 解冻、替换、升版、更新直接依赖并重新冻结双仓 active law。
2. 同候选更新五份 Blueprint。
3. 更新 Website V6 manifest/provider spec/control contract version及 AGENT 最小 dependency version，再运行各仓现役治理生成入口更新 generated registry。
4. 法案、施工图和合同闭合后才实施 A、B。
5. 删除 tests/inspector 中只按 `mutation_outcome` 锁死错误行为的断言，改为精确状态矩阵；不新建测试框架或第二 verdict。

## 6. 原子责任、handoff 与身份

| 原子责任 | 唯一 Owner | 权威输出与消费者 | 禁止相邻 Owner取得 |
|---|---|---|---|
| Prompt 业务正文 | localization-production Product | approved text/hash -> GPT Child | Browser/Website 不改正文 |
| contenteditable 机械投影 | local-browser-session | exact text/hash -> GPT Child | GPT/Product 不建第二 normalization |
| Browser terminal/effect fact | local-browser-session WAL | scope/outcome/mutation/evidence -> Runtime/V6 | Browser 不决定 attempt |
| attempt 恢复裁决 | Website ai-acceptance | old attempt ended 或 same-attempt readback -> claim | AGENT/Product/GPT 不自行重试 |
| 领域接纳 | Website localization static-catalog consumer | admission receipt + 111 candidates | transport/Provider terminal 不冒充完成 |

```text
job_id + request_hash
-> accepted attempt + lease/fence
-> exact call/Child + Browser WAL fact
-> provider_effect_identity（仅 submit）
-> result_payload_hash
-> localization admission receipt + consumption_hash
```

拒绝、失败和未知均沿现役 V6 failure transport 返回；没有新 handoff、store 或恢复入口。

## 7. 验收分母

### 7.1 AGENT

1. `<p>{</p><p>\u00a0\u00a0"items"...</p>` 投影为两个 U+0020，hash 等于批准文本。
2. 本事故同形七个 NBSP 位置在 direct fill、coherent `exactEditableTextHash` 与 submit 后 `exactGptUserPromptHash` 三处一致。
3. 长 Prompt collapsible 节点与短 Prompt `.whitespace-pre-wrap` 叶都经过同一 user-only serializer；assistant response 对同形 NBSP 保持现役通用 semantic bytes。
4. 超过 111074 UTF-16 字符且带末尾 marker 的 synthetic Prompt 不截断。
5. 真 NBSP expected text、U+202F、Tab、LF 或其它字符差异仍失败。
6. Inspector 证明 fill 与 coherent observation仍共享一份 source，user Prompt 映射不污染 assistant semantic text。

### 7.2 Website

1. `target_local + REJECTED + no/dispatched/confirmed` 均结束旧 attempt；删除 scope 或 browser outcome 参与后测试必须失败。
2. `target_local + DISPATCHED + dispatched`、`target_local + CONFIRMED + confirmed/no` 均保留 accepted attempt并失败关闭。
3. `provider_effect + DISPATCHED/CONFIRMED` 及 `provider_effect + REJECTED + dispatched/confirmed` 保持同一 attempt，submit 增量为 0；`provider_effect + REJECTED + no` 仍结束旧 attempt。
4. Browser facts 全空、字段缺失、非法或矛盾组合均失败关闭，不能仅凭 `mutation_outcome=no` 结束 attempt。
5. release 与 expiry 对同一 facts 得到相同裁决；expiry 确实读取首条 failure 的三个字段。
6. `provider_effect + CONFIRMED + no` 在跨仓入口被拒绝；合法 target-local 零动作确认不受影响。
7. 新发生的 target-local rejected failure 只在旧 attempt 被 release 清空后生成新 UUID；旧 fence 迟到请求继续拒绝。
8. expiry 只有在 `failure.lease_version === runtime.lease_version` 时才可按完整 facts 结束 attempt；不等时保持相同 attempt，负例必须覆盖“早期 target-local failure 后又 regrant并发生 Provider effect”。
9. 当前 `lease_expires_at IS NULL` 的历史 attempt 不被任何新清理逻辑触碰；经完整零-submit实证后，cooldown 门允许时由现役 claim 重领同一 UUID。
10. cooldown cohort 将本事故计入 `unsent_resume`，真实/未知 provider effect 计入 `effect_recovery`，未裁决的 target-local 状态计入 `unclassified`；三类互斥且守恒。

### 7.3 质量与生产 readback

两仓分别使用自己的唯一 `quality:check`；CHANGE 不冒充 READY/RELEASE。CI-FULL 按用户指定的冻结 `$ci-full-governance` 执行，只在主仓当前 checkout 施工，不创建分支或 worktree。

合同版本严格相等，不允许 Website 新版与 AGENT 旧版之间等待业务收敛。发布必须先停止旧 AGENT 新 claim/submit并收束 live lease，部署 Website 新合同后立即部署同版本 AGENT；两次部署之间 session/claim/Provider mutation 必须为零。保持停写时，重新枚举当前 job 的全部 Website lease grant/regrant 与 Browser WAL，证明截至当前最高 lease version 的每次执行均终结于 target-local rejected、没有 `provider_effect_identity`、没有 physical submit，且 runtime 仍精确绑定既有 attempt；任一分母缺口即停止。cooldown 现役门允许后的 claim 只重领同一 attempt UUID；读回新 fence且 submit 仍为 0 后才恢复执行。修复后的 Prompt fill 一次确认、该 attempt 的 Provider submit 总数恰为 1，随后沿唯一 artifact/Outbox/staging/consumer 主链取得 admission receipt。最终读回 `status=completed`、`business_consumed_at`、consumer ref、result/consumption hash和 111 条 zh-HK candidate。

## 8. 删除反事实

| 单元 | 删除反事实 | 裁决 |
|---|---|---|
| Browser 两处 Prompt space 投影与 coherent user 调用路由 | 删除后 fill、短/长 user observation 或 submit 后 hash仍误拒 | KEEP，原位修改 |
| Website 完整 facts predicate | 删除后 release/expiry继续误判 | KEEP，替换旧 helper |
| law/Blueprint/contract 对齐 | 删除后冻结权威继续要求错误行为 | KEEP，精确替换并重冻 |
| failure ledger 或 NULL-lease全局 reconciliation | 首条 failure 不能证明后续 effect；未来由 release闭合，当前保持同 attempt最安全 | DELETE FROM PLAN |
| 新 native cause | 现有 typed facts足以修复和验收 | DELETE FROM PLAN |
| cooldown cohort 分类 | 现役 receipt/control-room 直接消费且当前会失真 | KEEP，原位复用同一矩阵 |
| 新表/列/migration/bridge | 现有 failure fields 与结构充分 | FORBID |
| Product Prompt/fallback | 只隐藏触发器并制造第二 Owner | FORBID |

最终生产代码改动面只有 Browser 三个投影/调用文件、Website lifecycle core/release、expiry freshness guard、cooldown cohort SQL、V6 assertion与直接 tests/inspector。治理改动只限 4.2、4.3 的语义法条和版本依赖闭包；其它用户 dirty overlay 不触碰。

## 9. 停止、回退与执行重绑定

- 相关 HEAD、authority、Blueprint、contract 或目标源码漂移：停止并重开受影响设计。
- 法案/Blueprint 未同候选对齐并重冻：禁止改代码。
- 若必须改变 `target_local + DISPATCHED + dispatched`、`target_local + CONFIRMED + confirmed`、failure ledger或数据库结构才能闭环：停止并重开方案，不现场扩项。
- Provider effect 对照组出现新 attempt 或第二 submit：立即停止。
- 当前历史 attempt 的 Website lease event/Browser WAL/physical-submit 分母不完整，或重领时 attempt UUID 改变：停止 Provider 执行，不手改库。
- 回退只用各仓原生 release 回退点；不得保留 feature flag、dual path 或兼容桥。

施工 Codex 必须重新读取两仓 `AGENTS.md`、基础法案、4.2 法条及直接依赖、五份 Blueprint、V6 provider/consumer contract、目标源码和原生质检约束；复核 HEAD、tracking、dirty state与完整 hash。先完成法案/施工图两遍主 Codex审计，再进入代码。重要代码步骤使用子智能体只读审计，禁止子智能体并发写代码。最终由主 Codex完成不少于两遍自检，再由独立子智能体对照本方案审计；只有原生质量链能够给出 CHANGE/READY/RELEASE 结论。
