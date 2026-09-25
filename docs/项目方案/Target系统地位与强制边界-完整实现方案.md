---
document_type: project_scheme
scheme_id: TARGET_ROLE_AND_HARD_BOUNDARY_V1
scheme_name: Target系统地位与强制边界
status: 可施工
created_at: 2026-09-25
updated_at: 2026-09-25
owner_repo: ADVISION-X/AGENT
owner_domain: local-browser-session
candidate_agent_head: 70d41305ffc6864097c92bebce966376fb1e4319
candidate_website_head: 695ddbbe004ba8919794251f81b80058a253035d
current_control_contract_version: 43
target_control_contract_version: 44
skill: 闭环实现设计-SKILL
skill_sha256: a715e615da78884faac275cf523d091bbdb8e0ae381bc84568c32e631538d3c4
---

# Target系统地位与强制边界-完整实现方案

## 0. 最终裁决

本方案冻结一条最高级不变量：

> **Target 只拥有“当前一次 Browser 操作落在哪个现实页面”的权威，不拥有任何跨时间身份。**

Target 可以是当前浏览器动作的物理执行句柄，可以在同一现役 Browser Authority epoch 内被同一 job 的后续轮询复用，但它绝不是业务身份、Provider effect 身份、conversation 身份、恢复 locator、attempt 资格、risk replay 资格或跨进程连续性事实。

全系统长期连续性只分成三条互不替代的权威轴：

| 权威轴 | 唯一回答的问题 | 允许的权威事实 | Target 的地位 |
| --- | --- | --- | --- |
| Provider effect | “这次 Provider 输入发生过没有？” | `provider_effect_identity` + Browser WAL terminal fact | Target 不参与 effect identity，不因 Target 变化获得重发资格 |
| Conversation locator | “已发生的 effect 去哪里读、读哪一轮？” | Browser WAL 中唯一 `canonical conversation URL + exact userTurnId` | Target 不参与 locator，不得靠旧 Tab、标题、侧栏、时间或 targetRef 找聊天 |
| Browser current action | “这一条命令现在落在哪个现实页面？” | current Target + current Document + current authority epoch/fence + command permit | Target 仅在当前 live authority 内有效，用完即不具备跨时权威 |

任何代码、合同、法案、质检把这三条轴混在一起，都判定为结构性错误。

### 0.1 一句工程口径

```text
Target 管“这一次在哪里点、在哪里读”。
URL + userTurnId 管“这个 AI 对话以后去哪里找”。
provider_effect_identity 管“这条 Provider 输入到底发没发过”。
```

### 0.2 本方案明确解开的旧耦合

当前系统已经在现役 GPT 冻结条款中写明 canonical conversation URL 是恢复现场“去哪里读”的唯一权威，历史 `targetRef` 不得成为 acquisition 输入或恢复资格；但现役 Browser、Runtime、V6 source proof 和原生质检仍把旧 Target 作为恢复第一跳、source handoff 门和风险重放证据。

本方案不是给旧 Target 恢复链打补丁，而是**物理删除这条链的业务地位**。

---

## 1. 输入、遍历与候选边界

### 1.1 双仓候选

本设计绑定以下云仓 `main`：

| 仓库 | HEAD | recursive tree | 文件 | 代码文件 | 质量相关 | Blueprint/项目方案 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `ADVISION-X/AGENT` | `70d41305ffc6864097c92bebce966376fb1e4319` | 1175 entries, untruncated | 911 | 627 | 390 | 42 |
| `ADVISION-X/xuanxue-web` | `695ddbbe004ba8919794251f81b80058a253035d` | 7411 entries, untruncated | 6389 | 2290 | 766 | 55 |

本轮已按闭环 SKILL 对四带做闭合核对：

1. 法案系统：AGENT Browser/GPT/Runtime；Website ai-acceptance/AI boundary 及反向依赖。
2. 施工图：GPT、local-browser-session、Website-AGENT V6、Website SYSTEM/AI Acceptance，以及历史相关 Target/恢复方案。
3. 代码：Target registry、acquisition、lease、WAL、Runtime source handoff/readback、Website V6 proof/claim authority。
4. 质检：Browser inspector、GPT acceptance、Runtime recovery contract、Website V6 exam。

### 1.2 唯一方案文件

需求 Owner 是 AGENT `local-browser-session`。本方案是本轮唯一新增现役方案：

`ADVISION-X/AGENT/docs/项目方案/Target系统地位与强制边界-完整实现方案.md`

不在 Website 再复制第二份方案。Website 只修改自己的法案、Blueprint、contract、实现和质检。

### 1.3 与既有方案的关系

本方案只替代既有文档中“旧 Target 作为跨进程恢复锚点、旧 Target 路径作为 readback exhaustion、Target settlement 作为 source handoff/risk replay 前置”的重叠语义，不建立第二恢复状态机。

以下既有正确能力继续保留：

- `GPT稳定会话地址恢复-完整实现方案.md` 中 canonical conversation URL + userTurnId 的稳定 locator 规则。
- `N 标签工单独占轮巡模式方案.md` 中同一现役进程内 job 独占 system Tab、轮询时 park/reacquire、唯一 FIFO/lane。
- Browser WAL 对 Provider effect 至多一次现实输入的唯一副作用真相。
- Website.ai-acceptance 的唯一业务恢复决策权。

以下既有语义由本方案覆盖：

- `AGENT原attempt无失败事实恢复-完整实现方案.md` 中旧 Target 优先读回、old-target path exhaustion、Target settlement 作为风险门的部分。
- `浏览器退出恢复与未决命令解锁-完整实现方案.md` 中把旧 Target 身份当作跨重启清算锚点的部分。
- 现役 V43 source-readback proof 中 `old_target_* / old_path / browser_target_settled / target_settlement_hash` 的恢复语义。

---

## 2. 名词冻结：先把“Target”到底是什么说死

### 2.1 Target

Target 是 Browser Authority 在**当前现役 authority epoch** 中对一个 system-owned ChatGPT page 建立的实时控制对象。当前实现中它包含：

```text
targetRef
documentRef
tabId
chromeTargetId
navigationEpoch
jobRefHash
loaderId
```

这些字段只证明“此刻 Browser 控制的是哪一个现实页面实例”。

### 2.2 Document

Document 是 Target 当前加载文档的实时身份。导航、重载、main-frame 变化都可以令 Document 更新。任何当前命令必须重新读取 current Document，不能使用导航前快照。

### 2.3 Target lease

Target lease 是某个调用在当前 Browser Authority 下暂时取得 Target/lane 的执行许可。`park` 释放的是调用控制权和唯一物理 lane，不必销毁物理 system Tab。

### 2.4 Conversation locator

Conversation locator 固定为：

```text
canonical conversation URL + exact userTurnId
```

raw URL 只由 AGENT Browser/GPT 本地持有；Website 只可接收必要的不可逆 hash/proof，不接收 Provider URL。

### 2.5 Provider effect identity

`provider_effect_identity` 是 Browser WAL 对同一现实 Provider 输入的唯一稳定副作用身份。它不得包含 attempt、进程、lease、fence、Target、Document。

### 2.6 `target_local` 不是 Target

现有 Browser WAL 的 `effect_scope='target_local'` 是“这条动作只属于页面局部副作用”的**效果分类名称**，不是 Browser Target 实例身份。

本方案不因名称相似而重命名 `target_local`，也不得把它与 `targetRef/tabId` 混为一谈。

---

## 3. Target 的权威生命周期

Target 没有新的持久状态机。下面只是用于验收的**实时投影**，不得落成第二表、第二 ledger 或恢复状态：

```text
ABSENT
  -> LIVE_BOUND       当前 authority epoch 为 job 建立实时 system Target
  -> LEASED           某调用取得 Browser lease/lane
  -> PARKED_LIVE      调用 pending，释放 lease/lane；同 epoch live registry 仍可保留 Target
  -> LEASED           下一轮轮询重新取得当前 live Target

任意节点
  -> ABSENT           Tab 被关闭、Chrome/Extension/AGENT 重启、authority epoch 更换、live registry 丢失
```

### 3.1 关键边界

从 `LIVE_BOUND/PARKED_LIVE` 变成 `ABSENT` 后：

- 不产生业务 failure 资格。
- 不产生新 attempt 资格。
- 不产生 risk replay 资格。
- 不产生 source handoff 资格。
- 不要求寻找、恢复、证明或结算“原 Target”。
- 若 Provider effect 已发生，下一动作只由 effect + canonical URL/userTurnId 决定。

### 3.2 正常轮询

正常回答轮询是 Target 的正当使用场景：

```text
confirmed effect
-> 到达 observation 资格时间
-> 获取当前 job 的 Browser lease
-> 若同 epoch live Target 存在则复用
-> 以 canonical URL 做 exact conversation selection
   * 当前 URL 已相等：Page.navigate = 0
   * 当前 Target 因物理丢失而新建：最多一次 Page.navigate
-> 重验 current Document
-> fresh observe exact userTurnId 的 assistant 结果
-> pending：park，立即释放 lease/lane
```

这条链的权威是 URL。live Target 只是零导航优化。

### 3.3 当前动作

在真正 `fill/click/attach/submit/observe/read media` 前，Target 仍然是强安全门：

```text
current Target
+ current Document
+ authorityEpoch
+ writerFenceHash
+ executionBindingHash
+ command permit/MAC
```

任一漂移都必须在物理输入前失败关闭。

这条强校验不能因为本方案“降低 Target 地位”而削弱。**本方案只取消 Target 的跨时地位，不取消它的当前动作安全地位。**

---

## 4. 强制边界矩阵

### 4.1 Target 允许出现的地方

| Surface | 是否允许 Target/Document | 用途 | 是否有跨时权威 |
| --- | --- | --- | --- |
| Extension live Target registry | 允许 | 当前 system page 实例绑定 | 否，仅当前 authority epoch |
| Browser target lease / command permit | 允许 | 当前命令执行位置、fence、MAC | 否，仅本 lease/command |
| `browser_mutations.target_ref/document_ref` | 允许 | 记录某条历史 Browser 动作当时落在哪个页面，作为动作取证 | **绝对否**，只读 provenance |
| Runtime log 的 opaque/hash identity | 按现役脱敏法案允许 | 诊断当前动作 | 否 |
| 当前 same-epoch polling | 允许 | 复用仍 live 的 system Tab，减少导航 | 否，丢失即可新建 |
| 当前 business-admitted cleanup | 允许 | 关闭当前 live system Target | 否，无 live Target 即视为无需清理 |

### 4.2 Target 绝对禁止出现的地方

| Surface | 禁止内容 | 原因 |
| --- | --- | --- |
| Provider effect identity | targetRef/documentRef/tabId/chromeTargetId | Target 变化不能产生重发资格 |
| Conversation locator | 旧 Target、tabId、标题、侧栏、时间、URL 猜测 | locator 只认 canonical URL + userTurnId |
| 新 attempt / result revision 决策 | Target 是否存在/释放/缺席 | 业务恢复只属于 Website.ai-acceptance |
| V6 source evidence | `old_target_ref_hash`、`old_document_ref_hash`、`old_path`、`target_ref_hash`、`document_ref_hash` | Website 不应理解 Browser 物理实例 |
| source handoff | `browser_target_settled`、`target_settlement_hash` | handoff 不能由旧页面生命周期决定 |
| replay exhaustion | “旧 Target 路径失败” | readback 分母只由 locator 是否可信及 exact conversation 读回决定 |
| claim/admission/capacity | unreleased Target claims | Target 不能成为业务槽位或 claim 资格 |
| 本地任务身份恢复 | “历史 Target claim 存在” | Browser WAL/Outbox/Website receipt 才是持久执行事实 |
| 跨进程 active registry | `browser_target_claims` | Target 不能被数据库复活成持久活动身份 |
| Parent continuation | 父 Target/父 Tab | 父链只按 exact parent WAL canonical URL 定位 |

### 4.3 权威时限

Target 的“可继续复用”资格必须同时满足：

1. 当前 Browser Authority epoch 未变化。
2. 当前 Extension live registry 仍存在 exact job binding。
3. 当前 Chrome target identity 可实时验证。
4. 当前命令重新取得 lease 并重验 current Document。

缺一项即不再拥有复用资格。系统不得查询持久 DB 来恢复这四项。

---

## 5. 当前真实断裂

### 5.1 第一直接断点：acquisition 仍把历史 Target 当输入

`src/lib/browser/infrastructure/browser-target-acquirer.ts` 当前读取：

```ts
mutations.unreleasedTargetClaims()
  .filter(claim => claim.jobRefHash === waiter.binding.jobRefHash)
```

然后把旧 `targetRef` 作为 `expectedTargetRef` 发给 Extension。

`src/lib/browser/chrome-extension/extension-target-acquisition.ts` 当前因此存在：

```text
expectedTargetRef
BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE
BROWSER_OLD_TARGET_RECONCILIATION_REQUIRED
```

这直接违反现役法案已经声明的“历史 targetRef 不得成为 acquisition 输入或恢复资格”。

### 5.2 第二断点：持久 `browser_target_claims` 已经升级为恢复台账

当前 `browser_target_claims` 不只是诊断：

- `BrowserTargetAcquirer` 用它决定 acquisition。
- Runtime 用 `readUnreleasedTargetClaims()` 决定 source handoff。
- Runtime 用它决定 missing local task 是否存在旧本地 authority。
- completed cleanup 依赖它做释放 readback。
- recovery 验证用它判断 oldTargetEffect 是否 live/settled。
- Browser history 把 target settlement 变成 V6 source evidence。

因此它已经构成第二个持久 Target 身份系统，必须退出。

### 5.3 第三断点：跨仓 V43 把 Target 做成风险恢复合同

Website `v6-source-readback-proof.ts` 当前包含：

```text
old_target_ref_hash
old_document_ref_hash
old_path
target_ref_hash
document_ref_hash
browser_target_settled
target_settlement_hash
```

Website `job-claim-authority.ts` 还机械验证这些字段。

这让 Website 事实上参与解释 Browser 物理实例，违反 Browser 私有边界。

### 5.4 第四断点：质检在保护错误结构

现役质量系统仍有正向断言：

- `target-claim-inspection.ts::acquisitionBindsOldTargetBeforeCreating`
- GPT acceptance 要求第一次先报 `BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE`
- Runtime 结算 old Target 后，第二次 recovery claim 才允许读 canonical conversation
- Website exam 要求 risk replay 同时具备 `old_path + exact_path`

这些不是需要“修得更稳”的保障，而是本轮必须反转的错误规格。

---

## 6. 新的唯一恢复主链

### 6.1 已 CONFIRMED，locator 可信

```text
Website 授权 same-effect readback
-> Browser WAL 精确找到 provider_effect_identity
-> 读出 canonical conversation URL + exact userTurnId
-> 获取当前 system Target
   * 有 live same-epoch Target：直接用
   * 没有：立即创建当前 Target
-> selectExactGptConversation(canonical URL)
   * URL 已相等：零导航
   * URL 不同：一次精确 Page.navigate
-> current Document fresh readback
-> exact userTurnId / adjacent assistant
-> 成功：Provider input delta = 0，继续原结果交付
-> 有界 exact readback 确认不可得：生成 targetless negative proof
```

整个链**没有 old Target 第一路径**。

### 6.2 locator 不可信或缺失

如果 WAL 对该已可能输入 effect 没有可信 canonical URL/userTurnId：

```text
不得扫描旧 Tab
不得按 targetRef/tabId 尝试恢复
不得按标题/侧栏/时间猜测 conversation
不得把当前首页当成原 conversation
```

Browser 只出具 `unaddressable` typed proof，说明“effect 可能存在，但没有可信 locator”。后续是否允许新 revision/risk input，仍只由 Website.ai-acceptance 决定。

### 6.3 风险新输入的安全门不再叫 Target settlement

本方案不取消“旧现实输入不能与新输入并发”的安全要求，但把安全对象改回真正需要保护的东西：**旧 command authority / writer path**。

新风险 mutation 消费前，Browser 本地必须证明：

```text
旧 writer fence 已失效
+ 旧 command handler 已结束
+ page-read/action barrier 已清空
+ 当前 authority epoch/permit 与旧路径互斥
```

现役可复用原语包括 `authorityEpoch`、`writerFenceHash`、command permit/MAC、`awaitOldCommandHandlers()`、page-read barrier。

不得再把“某个旧 targetRef 是否 physical_absent/quiesced”当作这个安全门。

V44 source evidence 若需要向 Website 表达此事实，只表达 **input quiescence proof/hash**，不携 Target/Document/tabId/chromeTargetId。Website 不解释 Browser 页面实例。

### 6.4 Website 的 targetless readback proof

V44 将 effect proof 收敛为：

```text
effect_identity_hash
source_effect_set_hash
wal_authority_hash
anchor_state = trusted | absent
anchor_proof_hash

readback =
  settled_checkpoint
  | exact_conversation_negative
  | unaddressable

provider_input_delta = 0

input_quiescence_proof =
  required only when old physical input path is not already terminal
```

其中：

- `settled_checkpoint`：原答案已完整读回，可零 submit 复用。
- `exact_conversation_negative`：locator 可信，已在 canonical URL + userTurnId 做真实有界负读回。
- `unaddressable`：WAL 可证没有可信 locator，不能机械定位旧答案。
- `input_quiescence_proof`：证明旧 writer path 已失效，不证明任何旧 Target。

`replay_exhausted` 的分母不再包含“旧 Target 路径”。

---

## 7. 原子 Work Orders

## WO-A1：AGENT 法案与施工图统一 Target 地位

**Owner**：AGENT `local-browser-session`，联动 `gpt`、`agent-production-runtime`。

**目标**：把“Target 只有当前动作权威”提升为 P0 机械不变量，并删除所有 active authority 中“旧 Target 是恢复第一路径/风险门”的表达。

**主要路径**：

- `.github/instructions/agent-rules/功能法案.md`
- `docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md`
- `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md`
- `docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md`
- generated law registry 由原生治理入口重建，禁止手改

**当前已知直接 law replacement**：

- `LAW-LOCAL-BROWSER-SESSION-003-V43 -> V44`
- `LAW-LOCAL-BROWSER-SESSION-004-V53 -> V54`
- `LAW-GPT-001-V62 -> V63`
- `LAW-GPT-002-V28 -> V29`
- `LAW-AGENT-PRODUCTION-RUNTIME-001-V71 -> V72`

施工时必须由 canonical law parser 机械计算所有反向依赖并同步升版，不能只信本文手列清单。

**必须写死的条款**：

1. live Target binding 只在当前 authority epoch 的 registry。
2. targetRef/tabId 不得持久化为 active/recovery registry。
3. post-submit poll/recovery 以 canonical URL + userTurnId 为 locator。
4. `browser_mutations.target_ref/document_ref` 只作 action provenance。
5. risk input 安全门只证明旧 writer path quiescence，不证明旧 Target。
6. current command 仍严格校验 Target/Document/fence。

**完成验收**：active law、Blueprint、generated registry 无语义冲突；历史文档可保留事故原文，但不得再被 active law/spec 引用为现役恢复权威。

---

## WO-W1：Website 法案与 AI Acceptance Blueprint 去 Target 化

**Owner**：`ADVISION-X/xuanxue-web / ai-acceptance`。

**目标**：Website 继续唯一决定业务恢复，但完全退出 Browser 物理 Target 生命周期解释。

**主要路径**：

- `.github/instructions/agent-rules/功能法案.md`
- `docs/blueprints/SYSTEM-BLUEPRINT.md`
- `docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md`
- `docs/specs/ai-acceptance/xuanxue-ai-production-v6.contract.spec.json`

**已知直接语义 replacement**：

- `LAW-AI-ACCEPTANCE-002-V30 -> V31`
- `LAW-AI-ACCEPTANCE-013-V22 -> V23`
- `LAW-AI-BOUNDARY-006-V9 -> V10`
- 任何业务 law 中“旧 Target physical_absent/quiesced 才可风险恢复”的传递引用由 canonical parser 计算后同步替换，不手工漏项。

**新边界**：

Website 只验证：

- effect identity/集合身份；
- WAL authority；
- locator anchor 是否 trusted/absent；
- exact-conversation readback 或 unaddressable proof；
- 必要时 input quiescence proof；
- result/outbox/admission facts。

Website 不验证旧 targetRef、documentRef、tabId、Chrome Target、Target settlement。

---

## WO-W2：V6 control contract V43 -> V44

**Owner**：Website `ai-acceptance`。

**目标**：从跨仓 source-readback proof 物理删除 Target 身份。

**主要路径**：

- `packages/ai-contracts/src/production-control/v6-source-readback-proof.ts`
- `packages/ai-contracts/src/production-control/xuanxue-ai-production-v6.manifest.json`
- `services/api/src/ai-production/job-claim-authority.ts`
- `docs/specs/ai-acceptance/xuanxue-ai-production-v6.contract.spec.json`
- `tests/exam/ai-production-v6-contract.test.ts`

**物理删除字段/结构**：

```text
old_target_ref_hash
old_document_ref_hash
old_path
target_ref_hash
document_ref_hash
browser_target_settled
target_settlement_hash
instance_unavailable 作为 readback path
```

**替换为**：targetless `readback` union 与必要的 `input_quiescence_proof`。

**合同版本**：`control_contract_version 43 -> 44`。

**禁止**：兼容 parser、V43/V44 dual-read、default 填充、alias、shadow field。

**历史边界**：completed 历史事件保持原字节，不迁移；切换前必须证明没有 active unfinished job 的下一恢复动作依赖 V43 Target-shaped source handoff。存在则先在 V43 下完成/收敛，不能靠 V44 兼容读取。

---

## WO-A2：AGENT V44 consumer 与 source-readback proof 去 Target 化

**Owner**：`agent-production-runtime`。

**主要路径**：

- `docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json`
- `src/lib/local-runtime/production/source-readback-contract.ts`
- `src/lib/local-runtime/production/runtime-source-readback-proofs.ts`
- `src/lib/local-runtime/production/runtime-claim-source-readback-failure.ts`
- `src/lib/local-runtime/production/runtime-source-handoff.ts`
- `src/lib/local-runtime/production/runtime-claim-recovery.ts`
- `src/lib/local-runtime/production/executor-source-checkpoint.ts`
- `src/lib/local-runtime/workbench-browser-authority-support.ts`

**动作**：

1. dependency spec `43 -> 44`。
2. 删除 `old_instance_unavailable` observation。
3. 删除 `path:'old_target'` 和基于 target hash 判断 readback path 的分支。
4. proof builder 只对 locator/effect/WAL/input-quiescence 建证据。
5. source handoff 不再调用 `releaseSourceTarget()` 以获取业务资格。
6. source handoff 不再输出 `browser_target_settled/target_settlement_hash`。
7. `replay_exhausted` 只由 targetless finite proof denominator 形成。

**停止条件**：若任一消费者仍需要 old Target hash 才能决定 attempt/revision/replay，说明边界未闭合，不得进入下一 Work Order。

---

## WO-A3：Browser acquisition 删除旧 Target 第一跳

**Owner**：`local-browser-session`。

**主要路径**：

- `src/lib/browser/infrastructure/browser-target-acquirer.ts`
- `src/lib/browser/infrastructure/browser-infrastructure-state.ts`
- `src/lib/browser/transport/browser-authority-websocket.ts`
- `src/lib/browser/chrome-extension/websocket-target-operation.ts`
- `src/lib/browser/chrome-extension/websocket-actor.ts`
- `src/lib/browser/chrome-extension/extension-target-acquisition.ts`
- `src/lib/browser/chrome-extension/extension-target-authority.ts`

**物理删除**：

```text
expectedTargetRef
BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE
“旧 claim -> expected target -> Extension rebind”协议
```

**新 acquisition 语义**：

- `fresh`：只看当前 live registry 和当前授权；无 live Target 就创建当前 system Target。
- `confirmed-readback`：有当前 live same-job Target 就复用，没有就立即创建当前 Target；不先报 old-target failure。
- `authorized-continuation`：始终为当前 job 取得当前独占 Target，再按唯一父 WAL canonical URL 导航。
- `bound-observation`：若保留，只允许同一 authority epoch 的 target-local 临时 UI 观察，不得成为 Provider conversation 恢复模式；不能从数据库恢复 binding。

**Provider 回答轮询**：每次取得 lease 后以已确认 effect 的 canonical URL 执行 exact selection。当前 URL 相等时 `Page.navigate=0`，因此 live Target 复用仍高效；Target 丢失时同一调用直接建立新 Target 并一次导航，不产生中间恢复状态。

---

## WO-A4：物理退役 `browser_target_claims`

**Owner**：`local-browser-session`。

**目标**：彻底消灭持久 Target registry 的结构可能性。

**主要路径**：

- `src/lib/browser/exact-target/browser-mutation-schema.ts`
- `src/lib/browser/exact-target/browser-mutation-store.ts`
- `src/lib/browser/exact-target/browser-mutation-evidence.ts`
- `src/lib/browser/infrastructure/browser-infrastructure-evidence.ts`
- Runtime 所有 `readUnreleasedTargetClaims()` 消费者
- 对应 audit/acceptance

**最终 Browser SQLite 只保留**：

- `browser_mutations`
- 其现役 indexes

`browser_mutations.target_ref/document_ref` 保留，因为它们是历史动作 provenance，不是 registry。

**物理删除**：

```text
browser_target_claims table
browser_target_claims_job index
browser_target_claims_ref index
recordTargetClaim()
unreleasedTargetClaims()
unreleasedTargetRefs()
targetSettlements
targetSettlementHash
targetSettled
```

**release 语义重写**：

`releaseJobBoundTarget(jobRefHash)` 只查当前 Extension live registry：

- exact current live Target 存在：等待 current old command handlers/page-read barrier，验证当前真实 Chrome identity 后关闭。
- 不存在：返回 `absent` 成功，不扫描历史 tabId，不读取持久 targetRef。

**一次性生产 cutover**：

本轮不在运行时代码保留旧 schema compatibility。正式施工发布采用离线 clean cut：

1. 停止 AGENT 新 Browser 命令和新 claim。
2. 备份原 Browser SQLite，备份只用于整版 rollback，不参与运行时读取。
3. 核 `browser_mutations` integrity/WAL truth 完整。
4. 在单事务中 drop 两个 target claim indexes 与 `browser_target_claims`。
5. 用新 schema reader readback：数据库对象只剩 `browser_mutations` + 现役 indexes，所有 mutation row/hash 数量不变。
6. 启动 V44 AGENT。

不提交永久 legacy migration reader。若需回退，必须同时回退代码到 V43 并恢复 cutover 前整库备份，禁止单独回退一侧。

---

## WO-A5：Runtime 删除 Target 对业务恢复的控制力

**Owner**：`agent-production-runtime`。

**主要路径**：

- `runtime-loops.ts`
- `runtime-claim-recovery.ts`
- `runtime-claim-preproduct.ts`
- `runtime-source-handoff.ts`
- `workbench-browser-authority-support.ts`

**必须替换**：

1. `reconcileCompletedBrowserTargets`：business completed 后只 best-effort 清理**当前 live Target**；无 live Target 即 cleanup complete，绝不能因为历史 claim 缺失/未释放阻断 completed。
2. `recoverMissingLocalTask`：只以 Browser WAL、Outbox、Website staged receipt/result 判断本地历史，不把 Target claim 当 durable authority。
3. source handoff：不释放历史 Target 作为 seal 前置。
4. old effect validity：只核 effect/WAL/locator/quiescence，不核 live/settled old Target。
5. Runtime 不再暴露 `readUnreleasedTargetClaims()`。

**不变**：未决 Browser mutation WAL 仍可阻止不安全的新物理输入。要删除的是“Target claim gate”，不是“Provider effect/WAL gate”。

---

## WO-A6：GPT post-submit observation 统一 URL 定位

**Owner**：`gpt`。

**主要路径**：

- `src/capabilities/gpt/production-browser-lifecycle.ts`
- `src/capabilities/gpt/production-child-support.ts`
- 对应 GPT acceptance

**动作**：

- confirmed submit 后保存的 `canonicalConversationUrl + userTurnId` 继续作为轮询输入。
- `waitForProviderObservation()` 每轮 park 后重新取得 Browser lease，再执行 `selectExactGptConversation(canonical URL)`。
- live Target 仍在且 URL 相同：selection 是零导航。
- live Target 丢失：Browser 直接创建当前 Target，selection 至多一次导航。
- 不把 Target loss 升级成 Runtime source-recovery 事件。
- Provider physical submit 增量必须始终为 0。

**结果**：正常轮询和跨重启读回共享同一 locator 语义，只差当前 Target 是否恰好还能复用，不再存在两套恢复链。

---

## WO-A7：Target-independent input quiescence

**Owner**：`local-browser-session`。

**目标**：保留现实输入并发安全，但把证明对象从“旧页面”改成“旧 writer path”。

**复用现役原语**：

- `authorityEpoch`
- `writerFenceHash`
- execution binding
- command permit/MAC
- `awaitOldCommandHandlers()`
- page-read/action barrier
- Browser WAL terminal state

**不得新增**：第二 writer registry、第二 fence 表、quiescence daemon、Target settlement 表。

**V44 targetless proof** 只需证明旧输入路径已经 terminal 或 writer 已退役。Browser 最终执行新 mutation 时仍要本地重新验证；Website 的 grant 不是绕过 Browser 当前安全门的许可证。

---

## WO-QA：AGENT 质检反转

**Owner**：AGENT native quality。

### 必须删除/反转的旧正例

- `target-claim-inspection.ts::acquisitionBindsOldTargetBeforeCreating`
- 对 `expectedTargetRef` 的正向检查
- `BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE` 的恢复正例
- “Runtime 先 settle old Target，下一 recovery claim 才可读 conversation”断言
- target-claim schema/currentObjects 质量要求
- source readback `old_path` 必填断言

### 新静态禁令

active code/contract/quality 中必须满足：

```text
expectedTargetRef = 0
BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE = 0
browser_target_claims = 0
readUnreleasedTargetClaims = 0
old_target_ref_hash = 0  // V44 source evidence/runtime proof
old_document_ref_hash = 0
old_path = 0
browser_target_settled = 0
target_settlement_hash = 0
```

注意：`browser_mutations.target_ref/document_ref` 不在删除分母，它们是 local action provenance。

### 新动态正例

1. 同进程正常 poll：同 live Target 可复用，`Page.navigate=0`，pending 每轮 park/release lane。
2. poll 前物理 Tab 被关：下一 poll 直接创建当前 Target，精确导航 canonical URL 一次，零 submit，成功读原 userTurn。
3. Chrome/Extension/AGENT 重启：无 Target claim 恢复，仍按 WAL URL/userTurn 完成同 effect readback。
4. 新 Tab 数字 ID 与历史 row 相同：完全不影响恢复或 ownership。
5. completed cleanup 时 live Target 已不存在：业务 completed 不回退、不等待历史清算。
6. current Target/Document/fence 漂移：当前 mutation 仍在输入前失败关闭。
7. trusted locator exact-negative：V44 proof 无任何 Target 字段。
8. absent locator：产生 `unaddressable`，不扫描页面、不猜 conversation。
9. Website 风险授权后旧 writer path 未 quiescent：Browser 新物理 input 仍为 0。
10. quiescence 满足且 Website precise grant 有效：指定新 effect 至多一次。
11. `target_local` effect_scope 仍保持原效果分类，不受 Target instance 退役影响。

---

## WO-QW：Website V44 contract exam

**Owner**：Website native quality。

必须证明：

- ClaimRequest/SourceAttemptHandoff V44 不接受任何 Target/Document identity 字段。
- trusted locator 的 `replay_exhausted` 只接受真实 exact-conversation negative proof。
- absent locator 只接受 typed unaddressable proof。
- provider_input_delta 必须为 0。
- effect/source-set/WAL/anchor identity 缺失、篡改、多义全部 409 fail-close。
- Website 不接收 raw canonical URL，只核 hash/proof。
- input quiescence proof 若适用必须绑定 exact source effect set，不能作为通用“开门票”。
- V43 AGENT session 与 V44 Website、V44 AGENT 与 V43 Website 都必须 session/claim fail-close。

---

## WO-X：跨仓 clean cut 与生产闭环实证

**Owner 顺序**：Website ai-acceptance -> AGENT Runtime/Browser -> Website Domain Consumer。

### 切换前门

1. 两仓候选重新绑定 HEAD、tracking、dirty，任何 scoped dirty 无法归属立即停止。
2. 双仓 active laws/Blueprint/contract 均已 V44 对齐。
3. 不存在 active unfinished job 的下一恢复动作依赖 V43 Target-shaped source evidence。
4. Browser lane 无现役 command in flight，AGENT 停止新 claim。
5. Browser SQLite exact backup 完成，仅用于整体 rollback。

### 切换顺序

```text
停新 claim / drain 当前 command
-> Website 部署 V44 provider contract
-> Browser SQLite 离线 drop browser_target_claims
-> AGENT 部署 V44 consumer + Targetless Browser/Runtime
-> session open 以 version=44 精确握手
-> native quality
-> dynamic Browser/Provider recovery proof
-> Website result/admission/object readback
```

中间任何混版都由现役 control contract version mismatch 自动 fail-close，不建兼容桥。

### 真正完成

不以以下事实称成功：

- CHANGE PASS
- Browser paired
- Target claimed
- claim 200
- lease granted
- URL 导航成功
- exact assistant readback 成功

唯一业务闭环仍是：

```text
same original job
-> Provider effect 0 或精确一次合法输入
-> exact result durable stage
-> Website terminal
-> Domain Consumer admission receipt
-> domain object readback
-> completed
```

---

## 8. 删除审判

### 8.1 必须物理删除

| 对象 | 删除理由 |
| --- | --- |
| `browser_target_claims` 表及 indexes | 使 Target 成为跨进程持久身份，是本轮根因结构 |
| `expectedTargetRef` 全链 | 把历史 Target 直接送入 acquisition |
| `BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE` | “旧 Target 恢复”这一错误概念的 typed 入口 |
| old-target source observation | 把页面生命周期变成业务恢复证据 |
| `old_target_ref_hash/old_document_ref_hash` | Target 跨 Owner 泄漏 |
| `old_path` | 错误地把 readback 分母拆成旧 Target + conversation 两条 |
| `browser_target_settled/target_settlement_hash` | Target cleanup 被升级为 source handoff/risk replay 资格 |
| `readUnreleasedTargetClaims()` Runtime surface | 持久 Target claim 控制业务恢复 |
| 保护上述结构的 audit/acceptance | 质量系统必须保护新边界，不得保护旧复杂度 |

### 8.2 必须保留

| 对象 | 保留理由 |
| --- | --- |
| in-memory `ExtensionExactTargetRegistry` | 当前现实页面 ownership 的唯一 live registry |
| Target/Document in current lease/permit | 当前动作防串页、防越权必需 |
| `browser_mutations.target_ref/document_ref` | 历史动作 provenance，不是恢复 locator |
| Provider effect WAL | 防重复现实输入的唯一机械真相 |
| canonical conversation URL + userTurnId | 唯一恢复 locator |
| Website recovery authority | attempt/revision/risk replay 的唯一业务 Owner |
| Browser FIFO/lane | 当前现实页面串行安全 |
| writer fence/authority epoch/command barrier | 风险新输入前的真正并发安全门 |

### 8.3 删除反事实

对每个候选做反事实：

- 删除 `browser_target_claims` 后，实时 ownership 仍由 live registry 完成；历史副作用仍由 Browser WAL 完成；恢复 locator 仍由 URL/userTurnId 完成；因此无独立不可替代消费者。
- 删除 old-target path 后，CONFIRMED effect 的可读性仍由 exact canonical conversation readback 完整判定；无 locator 时由 unaddressable 完整表达；因此无需两条路径。
- 删除 Target settlement V6 字段后，业务恢复仍由 effect/readback/outbox/admission 事实闭合；新物理 input 的并发安全由 Browser current writer path 本地强制；因此 Website 不需要 Target 生命周期。

结论：这些结构满足物理删除条件，不得以“以后也许有用”保留。

---

## 9. 强制验收表

| 编号 | 不变量 | 必须证明 | 失败即 |
| --- | --- | --- | --- |
| TGT-001 | Target 只在当前 authority epoch 有效 | restart 后无任何 DB Target rebind | BLOCK |
| TGT-002 | Target 不进入 Provider effect identity | 换 Target/Document effect hash 不变 | BLOCK |
| TGT-003 | URL 是唯一 conversation locator | Target 丢失后 URL readback 直接成功 | BLOCK |
| TGT-004 | 正常 poll 可复用 live Target | URL 相同 Page.navigate=0 | BLOCK |
| TGT-005 | poll 不依赖 live Target | 关闭 Tab 后下一 poll 新建 Target 并一次导航 | BLOCK |
| TGT-006 | Target 不进入 V44 source evidence | Website schema/serialized request 无 Target/Document 字段 | BLOCK |
| TGT-007 | Target cleanup 不控制业务完成 | completed + no live Target 仍直接 cleanup settled | BLOCK |
| TGT-008 | WAL 仍防重复 Provider input | same effect physical submit <=1，除 Website 精确 risk grant | BLOCK |
| TGT-009 | 当前动作仍强校验 Target/Document/fence | 漂移时 physical input delta=0 | BLOCK |
| TGT-010 | 无 locator 不猜聊天 | 无 URL/userTurn -> typed unaddressable，零 scan/navigation guess | BLOCK |
| TGT-011 | 风险新输入门是 writer quiescence | old writer 未停稳时新 input=0 | BLOCK |
| TGT-012 | `target_local` 与 Target instance 分离 | effect_scope 行为保持原合同 | BLOCK |
| TGT-013 | 无第二恢复器 | 无新 queue/store/manager/state machine | BLOCK |
| TGT-014 | 最终业务闭环 | same job admission + object readback + completed | BLOCK |

---

## 10. 施工顺序与依赖图

```text
A1 AGENT laws/Blueprint ───────┐
                              ├─> W2 Website V44 provider contract
W1 Website laws/Blueprint ────┘              │
                                             ├─> A2 AGENT V44 consumer/source proof
                                             │
                                             ├─> A3 Browser acquisition contraction
                                             │       │
                                             │       ├─> A4 target claims retirement
                                             │       └─> A6 URL-based polling
                                             │
                                             ├─> A5 Runtime targetless recovery
                                             └─> A7 writer-path quiescence

A2+A3+A4+A5+A6+A7
  -> QA AGENT
W2 -> QW Website
QA + QW -> X coordinated clean cut -> production business closure
```

任何 Work Order 不得越权顺手修其它 Product、Prompt、DOM、模型、业务 consumer 或历史数据问题。

---

## 11. 停止与回退

### 11.1 施工停止条件

出现任一项立即停止：

- 发现新的现役消费者必须依赖旧 targetRef 才能完成不可替代职责。
- v44 targetless proof 无法表达现有合法 risk replay 分支。
- 删除 target claim 后会丢失 Provider effect/WAL 事实。
- Browser current action 无法在不依赖持久 Target claim 的情况下证明 Target/Document/fence。
- active production 存在不能在 V43 收敛的未完成 Target-shaped source handoff。
- 需要建立 dual-read、legacy bridge、第二状态机才能切换。

### 11.2 回退

V44 生产切换失败时只允许整版回退：

```text
stop claims
-> 回退 Website 到 V43
-> 回退 AGENT 到 V43
-> 恢复 cutover 前 Browser SQLite 整库备份
-> version=43 session 精确握手
```

禁止：

- V44 Website + V43 AGENT 混跑；
- 只恢复 `browser_target_claims` 表而不恢复整库；
- 运行时兼容 V43/V44 两套 source proof；
- 为回退新增 alias/default/fallback。

---

## 12. 方案状态

**状态：可施工。**

“可施工”只表示本轮闭环设计中的 Owner、法案、Blueprint、代码断点、合同 cutover、质量证据、删除边界和回退条件已经闭合，不表示任何生产代码、法案、数据库或服务已经被本轮修改。

施工前必须重新读取两仓 branch/HEAD/tracking/dirty，并以当时真实 candidate 重新跑 canonical law dependency、contract version 和 scoped change 检查。

本方案最终只保留一条 Target 原则：

> **Target 是当前动作的现实坐标，不是系统记忆。系统记住 Provider effect，系统记住 canonical conversation URL + userTurnId，但绝不记住“原来的 Target”来决定未来。**