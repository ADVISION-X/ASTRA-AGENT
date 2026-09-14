# GPT 已确认副作用断网恢复完整实现方案

## 1. 需求、终点与范围

需求 Owner 为 AGENT 与 Website 的既有生产链。目标不是增加一个“自动重试器”，而是修正一次已经存在的恢复裁决：GPT 物理 submit 已由 Browser WAL 确认为 `CONFIRMED` 后，即使断网导致当前页面变成错误页或 Document 失效，AGENT 也必须把既有 Provider effect 的真实 `mutation_outcome=confirmed` 运输给 Website；Website 保留同一 accepted attempt，网络恢复后只授权零 submit 读回同一 effect。

完整成功终点为：

```text
唯一 Provider submit CONFIRMED
→ 断网/错误 Document 导致回答暂时不可读
→ AGENT 释放当前 lease，但运输 confirmed effect 真相
→ Website 保留同一 attempt 并持久化 PROVIDER_EFFECT_READBACK_PENDING
→ 网络恢复后重新签发同一 accepted attempt
→ AGENT 在任何 Product 准备前读取 Browser WAL
→ URL 相同则零导航，不同则最多一次 canonical URL 精确导航
→ Provider physical submit 增量为 0
→ 读取同一 userTurnId 的结果
→ Website admission receipt 与领域持久化 readback 成功
```

本方案只修改两处既有 Owner 内的错误表达与既有质检：AGENT 的 GPT failure 事实组装、Website V6 failure facts 交叉字段断言，以及它们已有的测试。冻结法案、施工图、协议版本、数据库结构、重试节奏、Browser 命令、Product Prompt、模型档位和业务入库链均不修改。

## 2. 基线与变动保护

- AGENT：`/Users/nexgen/Documents/AGENT`，`main@8a3c4030460c9b944eafb7cb9136eeec01611112`，工作树 clean。
- Website：`/Users/nexgen/Documents/xuanxue-web`，`main@b60753948dd836e5e758e6174da92b14574e6458`，工作树 clean。
- 本文件是该恢复域唯一现役实施方案；不创建第二份断网恢复方案。
- 前一阶段已完成 canonical GPT 会话地址收敛：临时 `/c/WEB:<opaque>` 不得写入 WAL，恢复只使用稳定 `/c/<opaque>`。该能力是本方案的既有输入，不重复建设。
- 若施工前任一仓 HEAD 或 dirty 状态变化，必须重新绑定差异、法案、施工图和事故证据，禁止直接沿用本 candidate。

## 3. 事故事实与第一直接断点

### 3.1 已确认的真实顺序

本次断网事故对应本地化文章工单：

```text
job_id       = aiprod_a69843fb-ae73-4b55-8a51-e13990f6c353
attempt_id   = 77c3d042-9ac5-4cd7-a677-0f8cee22f9fa
target_locale= zh-HK
```

时间线：

1. `02:05:53.868`：AGENT durable accept 成功。
2. `02:05:54.810`：资料下载成功。
3. GPT submit 的 Browser WAL 完成 `PREPARED → DISPATCHED → CONFIRMED`；`02:06:30.630` 已确认唯一物理提交，证据为 `browser-mutation:181450de-1607-42c4-840b-24c253247f30`。
4. `02:07:10` 至 `02:19:42`：同一 Provider 回答按既有 30 秒节奏等待。
5. Website 侧从 `02:11:14` 起出现网络 `ENOTFOUND`；这不是新的 Provider 授权。
6. `02:20:01`：Browser 报 `BROWSER_ORIGIN_REJECTED`。
7. `02:20:12`：回答 checkpoint 报 `BROWSER_DOCUMENT_INVALID`，随后当前 lease 正常释放。

所以第一现实事实不是“没有提交”，而是：

> Provider submit 已确认，断网只破坏了后续读回现场。

### 3.2 数据库中的错误终态

Website 最终收到并持久化了以下互相矛盾的 failure facts：

```text
effect_scope                  = provider_effect
browser_outcome               = CONFIRMED
provider_effect_identity_hash = sha256:acb87...
mutation_outcome              = no
```

`effect_scope=provider_effect + browser_outcome=CONFIRMED + provider_effect_identity_hash` 已证明现实 Provider effect 存在；`mutation_outcome=no` 却声称没有现实 mutation。Website 恢复 Owner 只能依据 `mutation_outcome` 裁决，因此它结束并清空了旧 attempt，按有限退避授权新 attempt，没有进入同 effect 零 submit 读回。

### 3.3 第一直接代码断点

第一直接断点位于 AGENT 的 `throwGptChildFailure`：

```ts
const browserFact = result.proof.browserFact ?? confirmedProviderEffect ?? null;
mutationOutcome: result.proof.committedMutation,
browserEffect: result.failureBrowserEffect ?? confirmedProviderEffect ?? null,
```

回答 checkpoint 本身是观察动作，所以当前 Child 的 `committedMutation` 合法地为 `no`；但调用方同时传入了先前 submit 的 `confirmedProviderEffect`。现实现保留了 confirmed effect 的 identity/evidence，却错误地采用当前观察 Child 的 `no` 作为整个 attempt failure 的 mutation truth。

因此真正缺失的不是恢复功能，而是一次字段优先级：

```text
存在 confirmedProviderEffect
→ terminal failure 的 mutationOutcome 必须来自 confirmedProviderEffect
不存在 confirmedProviderEffect
→ 才使用当前失败 Child 的 committedMutation
```

Website 的第二道缺口位于 V6 写入断言：当前 validator 对所有 effect scope 均接受 `browser_outcome=CONFIRMED + mutation_outcome=no`。这使 AGENT 的矛盾事实没有在跨仓入口失败关闭。

## 4. 法案、施工图与 Owner 鉴权

现役冻结法案和施工图已经完整规定本次行为，无需修改：

- Website `ai-acceptance` 是唯一业务恢复 Owner。
- `mutation_outcome=no`：结束旧 attempt，有限退避后才可签发新 attempt。
- `DISPATCHED/CONFIRMED`：必须保留同一 accepted attempt，只授权同 effect 零 submit 读回。
- AGENT 在 confirmed readback 时必须先于任何 Product 准备查询唯一 Browser WAL。
- 进程重启、Target 丢失或同等恢复现场，可按 WAL canonical URL 使用当前 system Target；URL 不同最多一次 Browser-owned 精确导航。
- Website 不接收 Provider URL、Target、Document、checkpoint 或执行位置；AGENT 不自行取得恢复资格。

责任边界：

| 事实/动作 | 唯一 Owner | 本次职责 |
| --- | --- | --- |
| Browser 物理 submit 与 WAL terminal fact | Browser | 继续提供既有 CONFIRMED 事实，不修改 |
| GPT Child failure 事实组装 | AGENT GPT production support | 不得让后续观察 Child 的 `no` 覆盖既有 confirmed Provider effect |
| 跨仓 failure facts 合法性 | Website V6 contract assertion | 拒绝 provider effect 的 `CONFIRMED + no` 矛盾组合 |
| 新 attempt 或同 effect readback 裁决 | Website ai-acceptance | 继续只按合法 mutation truth 走既有两分支 |
| 同 effect 零 submit 恢复 | AGENT GPT/Browser | 继续复用现有 WAL/canonical URL 路径，不新增恢复器 |
| 最终业务完成 | Website Domain Consumer | admission receipt 与领域 readback，未改变 |

结论：本轮不解冻、不新增、不改写法案或施工图。修改法案反而会把一个实现违约误写成新制度。

## 5. Identity spine 与有限状态拓扑

唯一身份链：

```text
job_id
+ result_revision
+ attempt_id
+ exact_call_identity_hash
+ provider_effect_identity_hash
+ Browser WAL logical_mutation_id
+ canonical conversation URL
+ userTurnId
```

事故后的合法状态只有三类：

```text
A. submit 前失败
   mutation_outcome=no
   → Website 结束旧 attempt
   → 需求仍有效时按有限退避签发新 attempt

B. submit 已 DISPATCHED/CONFIRMED，但结果尚未稳定读回
   mutation_outcome=dispatched/confirmed
   → Website 保留同一 accepted attempt
   → 仅授权同 effect readback
   → Provider submit 增量必须为 0

C. 结果已稳定取得并完成 Website admission
   → admission receipt + durable domain readback
   → completed
```

断网不引入第四类状态。它只可能让 A 继续走 fresh attempt，或让 B 暂时失败后再次读回同一 effect。

## 6. 唯一施工链

### Work Order A：AGENT 修正 terminal failure 的 effect truth

Owner：`src/capabilities/gpt/production-child-support.ts`。

在现有 `throwGptChildFailure` 内原位修正字段选择：

```text
confirmedProviderEffect 存在
→ mutationOutcome = confirmedProviderEffect.mutationOutcome
→ browserEffect/evidence/identity 均来自同一 confirmed fact

confirmedProviderEffect 不存在
→ 保持当前失败 Child 的 committedMutation 与本域 evidence
```

不得增加新 helper、状态、异常类型、恢复分支或 transport 字段。现有 terminal serializer 只负责忠实运输，无需修改。

在现有 `gpt-failure-evidence-readback.acceptance-support.ts` 用已经存在的 post-submit checkpoint fixture 增加精确断言：

- `effect_scope === "provider_effect"`；
- `browser_outcome === "CONFIRMED"`；
- `mutation_outcome === "confirmed"`；
- `provider_effect_identity_hash` 保持原值；
- submit 前 failure 仍为 `mutation_outcome=no`。

### Work Order B：Website 拒绝不可能的跨字段组合

Owner：`packages/ai-contracts/src/production-control/v6-write-assertions.ts`。

在现有 `validFailureFacts` 内收紧交叉字段关系：

```text
effect_scope=provider_effect + browser_outcome=CONFIRMED
→ mutation_outcome 只能为 confirmed

effect_scope=target_local + browser_outcome=CONFIRMED
→ 保留现役允许的 target-local 语义
```

这是对冻结 V6 既有语义的失败关闭，不新增 wire 字段、不升级 protocol、不建 v7。若原生治理证明同版本不能收紧不可能状态，则停止施工并交回授权人裁决，禁止私建兼容版本。

在现有 `tests/exam/ai-production-v6-contract.test.ts` 增加负例：普通非 `RESULT_SETTLED_UNUSABLE` 的 `provider_effect + CONFIRMED + mutation_outcome=no` 必须被 `assertLeaseReleaseV6` 拒绝。现有 `RESULT_SETTLED_UNUSABLE` 精确 confirmed 规则继续保持。

### Work Order C：双仓原生静态验收

按依赖顺序执行：

1. AGENT 聚焦 GPT acceptance。
2. Website V6 contract Exam。
3. 两仓各自唯一 `npm run quality:check` 的 CHANGE/READY 流程。
4. 使用原生 clean Git commit 绑定各自 candidate；READY 不冒充 RELEASE。

任一原生检查发现法案投影、合同或 candidate 漂移，必须围绕同一 finding 修复或停止，不得绕过检查器。

### Work Order D：真实断网恢复 Dynamic Proof

真实 Chrome、GPT、Website 和数据库必须完成一次受控证明：

1. 新工单完成唯一 GPT submit，记录 WAL `CONFIRMED`、effect hash、canonical URL 和 userTurnId。
2. 在 Provider wait 期间制造真实断网或等价错误 Document。
3. AGENT failure transport 必须为 `provider_effect + CONFIRMED + mutation_outcome=confirmed`。
4. Website 数据库必须保留原 `attempt_id`，current reason 为 `PROVIDER_EFFECT_READBACK_PENDING`；不得清空 accepted attempt，不得授权新 effect。
5. 网络恢复后 Website 重新签发同一 accepted attempt。
6. AGENT 在任何 fresh/profile/model/附件/Composer 动作前读取精确 WAL。
7. URL 相同零导航；URL 不同最多一次导航到同一 canonical URL。
8. Browser/Provider physical submit 增量为 0，读取同一 userTurnId 的稳定回答。
9. 同一结果完成 Outbox、Website admission receipt、领域持久化 readback。
10. 另做一个 submit 前资料下载 503 对照：必须保持 `mutation_outcome=no`，允许 Website 以后签发 fresh attempt，Provider 动作增量为 0。

只有第 9 项完成才证明业务闭环；静态测试、WAL CONFIRMED、恢复授权或 HTTP 200 均不是入库完成。

## 7. 删除审判与不过度设计边界

必须保留：

- Browser WAL：它是现实副作用是否发生的唯一机械真相；删除后无法证明能否重发。
- `confirmedProviderEffect`：它把后续读回失败绑定到先前已确认 submit；删除会重现本次误判。
- Website 的 `sameEffectReadback`：它是冻结法案指定的唯一跨进程零 submit 恢复消费者。
- Website V6 写入断言：它是阻止矛盾事实污染恢复裁决的跨仓边界。
- canonical URL 与 userTurnId：它们是零提交读回同一现实 effect 的必要定位事实。

必须拒绝或删除任何施工中出现的下列结构：

- 网络监听器、在线状态台账、连接守护进程；
- AGENT 自主 retry manager、第二退避器、第二队列或第二恢复状态机；
- checkpoint 覆盖、旧 attempt 洗白、Prompt 重发、页面搜索或聊天猜测；
- Website 下发 Provider URL/Target/Document；
- dual-read/write、fallback、兼容桥、新数据库字段或迁移；
- 为本事故修改模型档位、Prompt、附件流程或业务入库逻辑；
- 为历史测试工单改写 failure evidence。

这些结构均没有独立消费者；现有 WAL、Website recovery decision 和 canonical readback 已覆盖全部必要状态。本次生产代码应只替换错误表达，代码总量持平或净减少。

## 8. 为什么刚刚没有自动恢复

精确答案是：

> 自动恢复链存在，而且同一时段另一个“资料下载 503、尚未 submit”的 zh-TW 工单已经自动重领并在网络恢复后下载成功。失败的只是“Provider submit 已确认、随后断网”的分支。AGENT 把后续 checkpoint 的局部 `no` 错当成整个 attempt 的 mutation truth；Website 据此合法但错误地结束旧 attempt，所以没有机会签发同 effect 零 submit恢复。

这不是增加更多自恢复能力可以解决的问题。增加重试会在错误事实下放大重复 Provider 成本。最小完整修复是让既有恢复链拿到正确事实，并让 Website 拒绝未来同类矛盾事实。

## 9. 停止、历史数据与回退

- 当前 zh-HK 事故 attempt 已被 Website 按错误但已持久化的 `mutation_outcome=no` 结束，不能靠新代码原地复活；其原 failure evidence 不覆盖、不改写。
- 本轮只设计，不授权清理或改写数据库。测试工单若需删除，应另行按精确 job_id 授权执行。
- 若 Dynamic Proof 出现 Provider 第二次 physical submit、attempt_id 变化、canonical identity 不一致或 Website admission 缺失，立即停止，不得称为恢复成功。
- 回退只撤销本方案直接产生的双仓代码与质检差异，不触碰运行日志、Browser WAL、数据库事故记录或无关提交。
- 若 AGENT 修正后 Website 仍不能保留同 accepted attempt，先检查运输事实和原生 V6 admission；禁止新增旁路恢复。
