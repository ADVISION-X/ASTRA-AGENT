---
document_type: project_scheme
scheme_id: TARGET_ROLE_AND_HARD_BOUNDARY_V1
scheme_name: Target系统地位与强制边界
status: 施工中-生产切换阻断
created_at: 2026-09-25
updated_at: 2026-09-26
owner_repo: ADVISION-X/AGENT
owner_domain: local-browser-session
candidate_agent_head: 355800d0a6a0e1dc3448047a9213b10761b53b1a
candidate_website_head: 695ddbbe004ba8919794251f81b80058a253035d
current_control_contract_version: 43
target_control_contract_version: 44
skill: 闭环实现设计-SKILL
skill_sha256: 1d70caf4647c1c187514b27baeda1b8dd91d598888a3961afb585a3245b4b123
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

本次就地审计在 AGENT `main@355800d0a6a0e1dc3448047a9213b10761b53b1a` 上读取唯一方案；该提交相对下表 AGENT 源码基线只新增本方案，未改变受影响的生产源码、法案或 Blueprint。Website 候选仍为下表 SHA。当前本地另有 `gpt-page-operation-evidence` 片区未提交改动，不在本方案施工面，不得覆盖。

原方案的受影响源码事实绑定如下；施工前必须重新绑定两仓相关路径及远端提交内容，不能用本表替代当时的 scoped candidate 检查：

| 仓库 | 原源码基线 HEAD | recursive tree | 文件 | 代码文件 | 质量相关 | Blueprint/项目方案 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `ADVISION-X/AGENT` | `70d41305ffc6864097c92bebce966376fb1e4319` | 1175 entries, untruncated | 911 | 627 | 390 | 42 |
| `ADVISION-X/xuanxue-web` | `695ddbbe004ba8919794251f81b80058a253035d` | 7411 entries, untruncated | 6389 | 2290 | 766 | 55 |

原方案按闭环 SKILL 对四带做过核对；本次复审发现 §6、WO-A1/A4/A7 的合同与消费者分母未闭合，修订及复审结果以 §12 为准：

1. 法案系统：AGENT Browser/GPT/Runtime；Website ai-acceptance/AI boundary 及反向依赖。
2. 施工图：GPT、local-browser-session、Website-AGENT V6、Website SYSTEM/AI Acceptance，以及历史相关 Target/恢复方案。
3. 代码：Target registry、acquisition、lease、WAL、Runtime source handoff/readback、Website V6 proof/claim authority。
4. 质检：Browser inspector、GPT acceptance、Runtime recovery contract、Website V6 exam。

### 1.2 唯一方案文件

需求 Owner 是 AGENT `local-browser-session`。本方案是本轮唯一新增现役方案：

`ADVISION-X/AGENT/docs/项目方案/Target系统地位与强制边界-完整实现方案.md`

不在 Website 再复制第二份方案。Website 只修改自己的法案、Blueprint、contract、实现和质检。

### 1.3 与既有方案的关系

本方案只替代既有文档中“旧 Target 作为跨进程恢复锚点、旧 Target 路径作为 readback exhaustion、Target settlement 作为 source handoff/risk replay 前置”的重叠语义，不建立第二恢复状态机。既有 `rejection_settled`、`risk_authorized`、`historical_settled` 及 `delivery_priority_replay` 的历史结算和来源关系不是旧 Target 语义，必须保留并改用 targetless 身份核验。

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
- Browser lane 的 `readState()/mayCrossUnresolved()/settleRetiredMutation()` 用 `allDispatchedTargetsSettled()` 决定未决 mutation 能否跨过唯一 lane。
- Browser WAL 启动前置的 `assertHistoricalTargetClaimCoverage()` 要求历史 mutation 有 claim 覆盖。
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
- Browser lane 与 WAL startup 对旧 claim settled/coverage 的正向断言
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

本轮只保留可由唯一 Browser WAL 机械证明的安全门：同一 job 的旧 `browser_mutations` 无任何 `DISPATCHED`，所有相关 command 已有可信 terminal；旧 writer fence 与当前 permit 仍按现役动作门验证。Browser 计算仅含 command/effect 身份、状态、输入数、终态且不含 Target/Document/request/payload/grant hash 的 `browser_history_hash`、同样 targetless 的完整 source-effect-set hash 与 `hashCanonicalJson([])` 未决集合，封成 `terminal_wal` input-quiescence proof。Website 精确核本次来源集合与 seal，Browser 发新物理 mutation 前重新读取 WAL 并验证当前 Target、Document、authority epoch/fence/permit。历史 `target_ref/document_ref` 只保留动作取证。

审查发现现役 WAL 不保存原认证 session/Extension actor incarnation，而 `websocket-actor.ts` 的异步帧入口可能在旧帧尚未登记 handler 时看到空集合。要证明跨会话的旧 `DISPATCHED` 已停稳，必须新增 actor 身份、逐帧接收顺序与回执绑定；仅 `awaitOldCommandHandlers()`、新 epoch、断线、新 actor 的空集合或旧 Tab 缺席都不足以证明。本轮按减法边界**删除拟议 `live_barrier` 分支**，不新增另一套 writer registry、证据表、协议帧或恢复器。任何旧 `DISPATCHED` 保持结果未知，Browser lane 阻断新物理输入；现役 DISPATCHED submit 尚无可信 canonical URL/userTurnId，故不得在新 Target 取得“同 effect exact readback”资格；取消 lane 对 `confirmed-readback` 字符串的泛化放行，所有新 acquisition 等原命令可信 terminal，旧 writer 的现役内存回执可原位结算。取得可靠原命令 terminal 前不自动重提，也不从新页面同文案观察伪造终态。`target_local` 亦不得仅凭换 fence、换 Tab 或换进程伪结算。

该安全门证明旧 writer 已终结，不证明旧答案不存在；URL 仍只负责定位原聊天，能否发送仍由 Provider effect/WAL 与 Website grant 决定。

### 6.4 Website 的 targetless readback proof

V44 保留现役 `replay_calls` 全集、逐调用 `readback_proofs`、来源 seal、`rejected_call`、`readback_exhaustion_hash` 与两类 handoff。只替换每个 effect 中依赖旧 Target 的路径证明；不能把完整 effect 历史压成三值 readback：

V44 `first_fact_raw_hash` 也必须只哈原 first failure 的 attempt、code、effect scope、Child、Browser outcome、mutation outcome、provider effect identity 与 settled result hash；不哈含旧 Target 的原 `evidence_hash`、DOM observation revision 或完整 raw JSON。AGENT 本地仍对原 first fact 原值与 Browser WAL raw authority 精确核验，Website 从原 failure ledger 复算该 targetless 投影并核原 rejection receipt。V43 已签 `first_fact_raw_hash` 保持原版本验签，不复制到 V44。

V44 跨仓 effect 运输 targetless `effect_identity_hash`、`source_effect_set_hash`、`wal_authority_hash`、`anchor_state` 与 `anchor_proof_hash`。`wal_authority_hash` 在 V44 改为 Browser 从原 WAL 的 command/effect 身份、状态、物理输入数与 terminal 形成的无 Target 投影；不携 request/payload/grant hash；`anchor_proof_hash` 只绑定已在本地验真的 canonical conversation URL、exact userTurnId、prompt/call 身份或可信锚点缺席，不哈完整 recovery payload。原始 Browser WAL authority、完整 recovery payload 与其 Target/Document 只供本地完整性验证和历史动作取证。V43 已签事件仍按原版本验签；跨 V43→V44 不比较两个版本的 source-effect-set/WAL/anchor/history hash，先按原 seal 与本地 WAL 验真，再逐稳定 effect/call/checkpoint 语义核对。不得为此新增持久字段或第二链。

```text
effect_identity_hash
source_effect_set_hash
wal_authority_hash  # V44 targetless projection
anchor_state = trusted | absent
anchor_proof_hash  # V44 targetless projection

readback =
  settled_checkpoint
  | exact_conversation_negative
  | unaddressable
  | rejection_settled
  | risk_authorized

provider_input_delta = 0

input_quiescence_proof =
  { kind: "terminal_wal", browser_history_hash, source_effect_set_hash,
    unresolved_command_set_hash: hashCanonicalJson([]), proof_hash }

call disposition = settled_reusable | replay_exhausted | historical_settled
```

其中：

- `settled_checkpoint`：原答案已完整读回，可零 submit 复用。
- `exact_conversation_negative`：locator 可信，已在 canonical URL + userTurnId 做真实有界负读回。V44 的 `proof_hash` 由 Browser typed negative 的 targetless effect/source-set/WAL projection/anchor projection、canonical conversation hash、user-turn hash、pending cause、first/last observed_at、observation_count 与 `provider_input_delta=0` 重封，不直接透传含 current Target/Document 的 DOM observation revision hash；原 observation revision 只留 Browser 取证。Website 核该 targetless canonical body 与本次 source seal。
- `unaddressable`：WAL 可证没有可信 locator，不能机械定位旧答案。V44 `proof_hash` 只绑定 targetless effect/source-set/WAL projection、`anchor_state=absent`、targetless anchor projection、形成时间与 `provider_input_delta=0`；不得拼旧 Target 缺席或 settlement。
- `input_quiescence_proof`：仅在同一 Browser WAL 的全部相关旧 command 已 terminal、未决集合为空时出具 `terminal_wal`；`proof_hash` 对除自身外的 canonical body 计算并在 source seal 中读回。Website 精确核字段、全集 hash 与有效 grant；Browser 新 mutation 前重验 WAL/current permit。旧 `DISPATCHED` 不得用新 session、旧 Target 缺席或空 handler 集伪造此证明。
- `rejection_settled`：仅在 Website 原 rejection receipt 与 effect、原 attempt、来源 seal 精确绑定时结算历史 effect。
- `risk_authorized`：仅在 Website 原签发的 source event、seal、指定调用及 grant hash 精确绑定时结算历史 effect。
- `historical_settled`：只由后两类历史结算组成的调用仍保留在完整调用集合中，不取得本次重提或答案复用资格。

`settled_reusable` 仍要求原 WAL 与 Forensics checkpoint、artifact hash 持久读回；`replay_exhausted` 只允许可信 locator 的真实有界 exact-negative，或无可信 locator 且明确保留“旧答案可能存在”的 typed unaddressable，并另有原 WAL 全部相关旧 command terminal 的证明才可进入 Website 风险裁决。Website 行锁只对 `replay_exhausted` 子集签指定调用风险 grant，`readback_exhaustion_hash` 也只绑定该子集；其它历史 effect 仍在全集和 source seal 中。`replay_exhausted` 的分母不再包含“旧 Target 路径”，但不能删除 rejection/risk lineage 验证。

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

**当前已知直接 law replacement（2026-09-25 双仓 active block 逐条反查后）**：

- `LAW-LOCAL-BROWSER-SESSION-003-V43 -> V44`
- `LAW-LOCAL-BROWSER-SESSION-004-V53 -> V54`
- `LAW-LOCAL-BROWSER-SESSION-006-V40 -> V41`（直接写有 Target claim 历史与 canonical URL 两类授权，不是上述法条的反向依赖）
- `LAW-GPT-001-V62 -> V63`
- `LAW-GPT-002-V28 -> V29`
- `LAW-AGENT-PRODUCTION-RUNTIME-001-V71 -> V72`
- `LAW-ARCHITECTURE-BOUNDARY-001-V16 -> V17`（其 tombstone 正文仍以旧 Target 缺席作为风险授权门）

施工时必须按目标路径 applicability、直接语义引用和 canonical law parser 反向依赖三路核全并同步升版，不能只信本文手列清单。`FROZEN-GPT-CONVERSATION-LOCATOR-EFFECT-SEPARATION-001`、Browser 未决 mutation/旧输入静止条款及 Website 的 `FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001`、`FROZEN-EXACT-TARGET-POLL-RESULT-REVISION-001` 都在本次实质修改分母。授权人已于本轮明确授权两仓法案、施工图、代码、质检及数据库操作；冻结条款只按这条 URL/Target/effect 边界作精确替换，不能借机放宽其它约束。

**必须写死的条款**：

1. live Target binding 只在当前 authority epoch 的 registry。
2. targetRef/tabId 不得持久化为 active/recovery registry。
3. post-submit poll/recovery 以 canonical URL + userTurnId 为 locator。
4. `browser_mutations.target_ref/document_ref` 只作 action provenance。
5. risk input 安全门只证明旧 writer path quiescence，不证明旧 Target。
6. current command 仍严格校验 Target/Document/fence。
7. 正常轮询每轮使用同一已确认 effect 的 canonical URL 做 exact selection；当前调用可沿已验证的内存值使用，跨进程只能从原 Browser WAL 读取。同 URL 零导航。此项明确替换现役“正常轮询不得读取 locator”的限制，同时保留唯一 FIFO、70—90 秒全局节拍、短 deadline 不 acquisition、pending park/release 以及 Provider 零重提。

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
- `LAW-AI-ACCEPTANCE-004-V29 -> V30`
- `LAW-AI-ACCEPTANCE-012-V39 -> V40`
- `LAW-AI-ACCEPTANCE-013-V22 -> V23`
- `LAW-AI-BOUNDARY-006-V9 -> V10`
- `LAW-PUBLIC-KNOWLEDGE-CONTENT-005-V39 -> V40`（同样以旧 Target 缺席作为风险输入前提）
- 任何业务 law 中“旧 Target physical_absent/quiesced 才可风险恢复”的传递引用由 canonical parser 计算后同步替换，不手工漏项。

**新边界**：

Website 只验证：

- effect identity/集合身份；
- WAL authority；
- locator anchor 是否 trusted/absent；
- exact-conversation readback 或 unaddressable proof；
- 必要时 input quiescence proof；
- result/outbox/admission facts。

现役 `rejection_settled/risk_authorized/historical_settled`、完整 `replay_calls`、`rejected_call` 和仅对 `replay_exhausted` 子集签 grant 的行锁判定必须逐项保留；仅删除 Target/Document 路径字段。旧 V43 已签事件的 PostgreSQL `jsonb event_json` 对象保持不变，按其旧字段对象重算 canonical seal 与原身份；数据库不保存原始 JSON 字节，不能承诺原字节相等，也不能用 V44 targetless hash 回算或改写历史 seal。

Website 不验证旧 targetRef、documentRef、tabId、Chrome Target、Target settlement。复审发现 `provider_cooldown` 把旧 Target/Document hash 持久写入 Outbox、跨仓 notice/receipt，并用于重启后的 ack 与 Website clearance 资格；其 `observation_hash` 亦包含旧 Target/Document，进而进入持久 `incident_request_id`。原豁免裁决撤销：本轮必须从持久 incident、跨仓 notice/receipt 和 incident identity 删除显式及派生 Target 身份。Browser 当前 coherent observation 和同一当前 lease 内 ack 仍以 current Target/Document/permit 精确校验；重启后不可从旧 Outbox 恢复旧 Target 或重放旧 ack。Website 同 incident clearance 只核 targetless incident request、原 job/attempt/revision、固定 dialog fact、targetless observation evidence、ack WAL/clearance receipt 与 session/device，不用旧 Target/Document 或其派生 hash。此替换须同步 cooldown notice/receipt 合同版本和双仓现役法案、施工图、验收；存量未交付 v6 cooldown intent 或 Website v6 cooldown receipt 若存在则切换阻断，禁止 dual-read 兼容桥。

**冷却 clean cut 的精确分母**：原 `observationHash` 是 Browser 当前动作证明，包含 Target/Document，只留在当次 Browser/GPT 内部；跨仓 `observation_hash` 改为对 `exact_present` preflight 的 schema/state、冻结文案 hash、exact-call hash、observed_at、六个候选计数计算的 targetless canonical hash。`incident_request_id` 由 job/attempt/revision + 该 targetless hash 决定。`notice.v7/receipt.v7` 删除 `target_ref_hash/document_ref_hash`，Website clearance 重算 deterministic incident id 与 phase/request 后缀、按原 incident receipt 的 canonical payload hash 绑定原 session/job/attempt/revision/dialog/targetless observation，并按 acknowledged_at 重算 targetless ack/未清除 hash；AGENT 本地先核原 ack WAL 的 exact job/attempt/revision/incident、CONFIRMED terminal、输入数，再投影 clearance，Website 不虚称能独立读取 Browser WAL；无需也不得用旧页面证明。原 Browser 当前动作的 ack 仍消费包含 current Target/Document 的原 preflight hash；重启后原 ack 的 1 秒期限已逝，不能重新点击。若原 ack WAL 已有可信 `CONFIRMED` terminal，才可零输入读回原 terminal 完成同 incident；其余跨进程或旧页面已失的事故交付 `not_cleared` 并维持关闭。新 Target 的 fresh absent 只证明新页面当前没有弹窗，不能证明原事故的 ack、原页面或账户级限制已清除，不能单独签 `confirmed_absent`。`not_cleared→confirmed_absent` 只能由原 Browser WAL 按 job/attempt/revision/incident call 精确读得的可信 ack terminal 支持；读回只输出 terminal time，不输出旧 Target、Document 或其 authority hash。无该事实则失败关闭，禁止以旧 Target 或新页面缺席补资格。切换前必须逐条结清旧 v6 本地 Outbox/Website cooldown lineage，Website 已持久 v6 cooldown receipt 是否仍为 latest 亦须核实；有不能无损归属的行就阻断 cutover，绝不读旧 Target hash 作兼容恢复。

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

**替换为**：§6.4 的逐 effect targetless readback/历史结算 union 与必要的 `input_quiescence_proof`。本次已授权删除全部 31 个未完成 V43 job，因此新 V44 来源只可能拥有 V44 祖先；`settled_reusable | replay_exhausted | historical_settled`、原 rejection receipt、risk grant lineage、calls=[] 可复用来源和 `readback_exhaustion_hash` 只按 V44 合同严格核验。已完成 job 的 V43 事件保留原值，不再为活动恢复建立旧版本解析或跨版本比较路径。

**合同版本**：`control_contract_version 43 -> 44`。

**禁止**：新 claim/source 写入的兼容 parser、V43/V44 dual-read、default 填充、alias、shadow field，以及为已完成历史保留活动恢复用的 V43 只读 parser。

**本次减法切换裁决**：授权人选择永久清除 Website 当前 31 个未完成 job 及 AGENT 对应本地数据；569 个已完成 job 与其历史事件原样保留。清除后 V44 claim 的活动祖先集合必须全为 V44，不能为已完成历史引入 V43 解析器。旧 `jsonb event_json` 原值仍为只读历史取证，但不参与新 claim、source handoff 或业务恢复；如有未完成 V43 job 残留，切换失败关闭，不能用兼容读取放行。

---

## WO-A2：AGENT V44 consumer 与 source-readback proof 去 Target 化

**Owner**：`agent-production-runtime`。

**主要路径**：

- `docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json`
- `src/lib/local-runtime/production/source-readback-contract.ts`
- `src/lib/local-runtime/production/runtime-source-readback-proofs.ts`
- `src/lib/local-runtime/production/store-source-settlement.ts`
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
8. `source-readback-contract.ts`、`runtime-source-readback-proofs.ts`、`store-source-settlement.ts` 对 `rejection_settled`、`risk_authorized`、`historical_settled` 保留逐 effect/call lineage；后者当前以 `effect.old_path !== null` 生成历史 risk 结算，必须改由 V44 targetless `replay_exhausted` 的精确 effect 集合驱动。删除旧 Target hash 对复用 checkpoint 与历史 risk 的比较，改用 targetless effect identity/source-effect-set/WAL/anchor projection、原 artifact/receipt/grant/seal 精确绑定。已签 V43 `source_manifest_json` 按原 seal 原版本只读解释，不能套 V44 shape；`store-source-readback.ts` 当前可返回旧 sealed manifest，`runtime-source-handoff.ts` 会直接重发：cutover 前必须逐份读回并清零未发/未接收的 V43 sealed handoff，无法证明清零即停止切换，不得送到 V44 新 claim 入口；`runtime-source-readback-proofs.ts` 当前直接返回 `reused.effect` 且 `store-source-settlement.ts` 保存整份旧 effect，必须在原 V43 seal 核真后只抽稳定 effect/checkpoint 语义字段，按 V44 无 Target 的公式重新形成新 proof，不得复制 V43 old Target/path 字段或改写原 manifest；`delivery_priority_replay` 的 calls=[] 仍须逐旧调用 settled checkpoint，不能借 targetless 变成零证据授权。

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

**物理删除（A3+A4+A7 必须作为一个可编译、可验收的片区提交，不以单独 A3 声称完成）**：

```text
expectedTargetRef
BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE
“旧 claim -> expected target -> Extension rebind”协议
```

**新 acquisition 语义**：

- `fresh`：只看当前 live registry 和当前授权；无 live Target 就创建当前 system Target。
- `confirmed-readback`：有当前 live same-job Target 就复用，没有就立即创建当前 Target；Extension registry 中的 bound 必须在当前 Chrome tab/target identity 与 load 状态精确校验后才算 live。`reacquireParkedTarget()` 发现 Tab 已关闭时应失效该项 registry 并在同一 acquisition 创建当前 Target，而非先向上报旧 Target 错误；不先报 old-target failure。
- `authorized-continuation`：始终为当前 job 取得当前独占 Target，再按唯一父 WAL canonical URL 导航。
- `bound-observation`：若保留，只允许同一 authority epoch 的 target-local 临时 UI 观察，不得成为 Provider conversation 恢复模式；不能从数据库恢复 binding。

**Provider 回答轮询**：每次取得 lease 后以已确认 effect 的 canonical URL 执行 exact selection。当前 URL 相等时 `Page.navigate=0`，但仍须比对 fresh main-frame loader 与 registry 所持 Document，并经现役 `publishMainFrameNavigation/advanceDocument` 同步更新 current Document，不能把旧 documentRef 当 fresh 事实；Target 丢失时同一调用直接建立新 Target 并一次导航，不产生中间恢复状态。

---

## WO-A4：物理退役 `browser_target_claims`

**Owner**：`local-browser-session`。

**目标**：彻底消灭持久 Target registry 的结构可能性。

**主要路径**：

- `src/lib/browser/exact-target/browser-mutation-schema.ts`
- `src/lib/browser/exact-target/browser-mutation-store.ts`
- `src/lib/browser/exact-target/browser-mutation-evidence.ts`
- `src/lib/browser/exact-target/browser-mutation-replay-evidence.ts`
- `src/lib/browser/infrastructure/browser-lane-coordinator.ts`
- `src/lib/browser/infrastructure/browser-infrastructure-evidence.ts`
- `src/lib/browser/chrome-extension/extension-target-release.ts`
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
allDispatchedTargetsSettled()
assertHistoricalTargetClaimCoverage()
BROWSER_LEGACY_TARGET_CLAIM_CUTOVER_REQUIRED
```

**未决 mutation 的原位替代**：删除 `allDispatchedTargetsSettled()`、`mayCrossUnresolved()` 与 `settleRetiredTargetLocal()` 的旧 Target 路径。唯一 Browser lane 对任何 `DISPATCHED` 阻断新物理输入，不因 job/Target/fence 变化开口；旧 `DISPATCHED` 无可信 URL/userTurn locator 时不得凭 mode 字符串取得新 lane lease；全局未决时所有新 acquisition 均阻断，包括其它已 CONFIRMED effect 的 `confirmed-readback` acquisition。原 writer 已在途命令的可信回执可原位结算，原 WAL 的受限只读查询不需新 acquisition；只有全局无 `DISPATCHED` 且该 CONFIRMED effect 的 WAL 有可信 locator 时，`confirmed-readback` 才能取得当前 Target 并零输入精确定位。状态只能由原 WAL 可靠 terminal 更新。`target_local` 继续作为 effect_scope 分类，旧未决行不能凭 Target 消失伪终结。`readState()` 不得以旧 claim 缺席报告 idle；`blocked` 不得被解释为可新建只读 acquisition 或新物理输入的资格。

**启动前置替换**：`BrowserMutationStore` 构造器及 `browser-mutation-settlement-inspection.ts` 删除 `assertHistoricalTargetClaimCoverage()` 与 claim 覆盖正例；仍先只读验证 `browser_mutations` 精确 schema、indexes、integrity/WAL 和 Runtime task provenance，且保留 `PREPARED` 崩溃恢复顺序。`DISPATCHED` 在重启后保持未知并阻断新物理输入，不因历史 claim 表已删而降级、拒绝整个有效 WAL 或伪造终态。只在现役 Browser WAL 的读取边界解析历史 mutation provenance；不得按旧 targetRef/tabId 重新绑定或关闭页面。

**release 语义重写**：

`releaseJobBoundTarget(jobRefHash)` 只查当前 Extension live registry；同步收敛 `websocket-target-operation.ts`、`browser-authority-websocket.ts`、`browser-authority-frame-payload.ts`、`browser-infrastructure-state.ts` 和 supervisor pending correlation，只传 `jobRefHash`，`TARGET_REVOKE` 只确认当前 live cleanup，不再调用 `markTargetReleased()`：

- exact current live Target 存在：仅在原 WAL 相关 command 全部 terminal 且当前 lease/permit 重验通过后，验证当前真实 Chrome identity 并关闭。
- 不存在：返回 `absent` 成功，不扫描历史 tabId，不读取持久 targetRef。

**一次性生产 cutover**：

本轮不在运行时代码保留旧 schema compatibility。正式施工发布采用离线 clean cut：

1. 停止 AGENT 新 Browser 命令和新 claim，排空当前 command；关闭 Browser SQLite writer 后才进入离线 DDL。
2. 对 WAL mode 数据库做一致性整库备份并连同现役加密 key/版本身份封存，读回 `integrity_check`、行数与 Browser mutation authority hash；不得只复制可能尚未 checkpoint 的主 `.sqlite` 文件。备份只用于整版 rollback，不参与运行时读取。
3. 在 Website 已按本方案授权永久删除 31 个未完成 job、AGENT 停写且精确确认这些 job 已不存在后，只对该已撤销集合离线清除本地 task、handoff、Outbox、材料、结果、Forensics 与 Browser WAL 行；原 `DISPATCHED` 保持未知取证，不写入虚假 terminal。随后核 `browser_mutations` integrity/WAL truth 完整，剩余任一未决旧 writer 即停止切换。
4. 在单事务中 drop 两个 target claim indexes 与 `browser_target_claims`。
5. 用新 schema reader readback：数据库对象只剩 `browser_mutations` + 现役 indexes，所有 mutation row/identity/authority hash、各状态数量不变；旧 Target claim 及其 indexes 为零。
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
- `checkpoint_gpt_generated_image` 的同一轮询入口及 Browser authenticated-media observation
- 对应 GPT acceptance

**动作**：

- confirmed submit 后保存的 `canonicalConversationUrl + userTurnId` 继续作为轮询输入。
- 文本回答与生成媒体的每轮 pending park 后都重新取得 Browser lease，再执行 `selectExactGptConversation(canonical URL)`；媒体 source 仍须位于 exact userTurnId 和下一个 user turn 之间。
- live Target 仍在且 URL 相同：selection 是零导航。
- live Target 丢失：Browser 直接创建当前 Target，selection 至多一次导航。
- 不把 Target loss 升级成 Runtime source-recovery 事件。
- Provider physical submit 增量必须始终为 0。

**结果**：正常轮询和跨重启读回共享同一 locator 语义，只差当前 Target 是否恰好还能复用，不再存在两套恢复链。

---

## WO-A7：Target-independent input quiescence

**Owner**：`local-browser-session`。

**目标**：只从唯一 Browser WAL 证明旧 writer 已 terminal。`jobHistoryEvidence()` 保留完整旧 command/effect 集合与 WAL authority hash，并计算所有 `DISPATCHED` command ID 的 canonical 集合 hash；为空时由 Browser Owner 对 `terminal_wal` body 封 `proof_hash`。Runtime 只运输 typed proof，Website 只核 exact targetless source set/WAL/anchor projection、版本与原签名 lineage，不接收原始 WAL authority hash；原始 WAL hash 只留 Browser 内部取证。Browser 新物理 mutation 前重读未决 WAL 并按现役 permit、Target/Document 门再验。若有任何未决 `DISPATCHED`，返回 typed unknown，Browser lane 维持 blocked，不发新输入。

**审计裁决**：原拟议 `live_barrier` 所需的旧 actor incarnation 与旧 WAL/session 配对证据不存在；仅复用 handler Set 会漏异步解密中的已接收帧。为守住净删除和机械安全，本轮将该分支从合同、生产代码、质检和方案中物理删除。未来若确有独立授权与可验证必要性，须重新走法案、施工图和完整审计，不能在本轮暗加第二 writer registry、协议或恢复链。

---

## WO-QA：AGENT 质检反转

**Owner**：AGENT native quality。

### 必须删除/反转的旧正例

- `target-claim-inspection.ts::acquisitionBindsOldTargetBeforeCreating`
- `browser-lane-fifo-support.ts` 与 `browser-lane-fifo.acceptance.ts` 中旧 claim seed、`expectedTargetRef` 及 `allDispatchedTargetsSettled()` 正例
- `gpt-frozen-attempt-inspection.ts` 中 acquisition 必带 `expectedTargetRef` 的正例
- `agent-production-runtime-recovery-contract.acceptance.ts` 中 old Target hash 作为 source proof 必填的正例
- 对 `expectedTargetRef` 的正向检查
- `BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE` 的恢复正例
- “Runtime 先 settle old Target，下一 recovery claim 才可读 conversation”断言
- target-claim schema/currentObjects 质量要求
- `allDispatchedTargetsSettled()` 及 `assertHistoricalTargetClaimCoverage()` 的旧正例；Browser lane 必须改验 WAL 未决集合为空及原 command terminal 事实
- source readback `old_path` 必填断言

### 新静态禁令

active code/contract/quality 中必须满足：

```text
expectedTargetRef = 0
BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE = 0
browser_target_claims = 0
readUnreleasedTargetClaims = 0
allDispatchedTargetsSettled = 0
assertHistoricalTargetClaimCoverage = 0
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
10. 原 WAL 全部 terminal 且 Website precise grant 有效：指定新 effect 至多一次。
11. `target_local` effect_scope 仍保持原效果分类，不受 Target instance 退役影响。
12. 旧 `DISPATCHED` 跨进程保留未知：重启后空 live registry、新 epoch 数字相同、socket 断线均不能放行新物理输入；原 WAL 未可靠 terminal 则持续 blocked。
13. 删表后既有 Browser WAL 行的 identity/authority hash、状态数量、启动先验和原 Runtime task provenance 不变；`readState/mayCrossUnresolved/settleRetiredMutation` 不再查询 Target claim，未知旧 writer 不得越过唯一 lane。
14. 原 Website rejection receipt 与已签 risk grant 各有一条历史 effect 时，V44 保留 `historical_settled`、完整 `replay_calls` 和原 seal/事件 lineage；只给另一个真实 `replay_exhausted` 调用发风险 grant。没有 `replay_exhausted` 且不满足精确 payload-slot 409 + 全调用 checkpoint 的 calls=[] 分支时拒绝风险 grant，绝不把历史结算重提。
15. `delivery_priority_replay` 旧 payload 槽 409、全部调用 settled checkpoint 时，仍可按现役合同签 calls=[] 零输入来源 grant；缺任一原 checkpoint/Outbox/Website cloud receipt 则拒绝。旧 V43 已签 `jsonb event_json` 对象不变，V44 只以旧字段对象与原 canonical seal 核历史 lineage。

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
- `rejection_settled/risk_authorized/historical_settled` 及旧 V43 事件的原版本 lineage 必须保留；`readback_exhaustion_hash` 与风险 grant 仅覆盖本轮 `replay_exhausted` 子集，calls=[] 可复用来源仍须全部 checkpoint/slot/receipt 成立。
- V43 AGENT session 与 V44 Website、V44 AGENT 与 V43 Website 都必须 session/claim fail-close。

---

## WO-X：跨仓 clean cut 与生产闭环实证

**Owner 顺序**：Website ai-acceptance -> AGENT Runtime/Browser -> Website Domain Consumer。

### 切换前门

1. 两仓候选重新绑定 HEAD、tracking、dirty，任何 scoped dirty 无法归属立即停止。
2. 双仓 active laws/Blueprint/contract 均已 V44 对齐。
3. Website 授权的 31 个未完成 job 及其关联来源已精确删除，569 个已完成 job 保持不变；AGENT 对这些 Website 缺席的 job 完成离线清除，本地旧 sealed handoff 不得回流。
4. Browser lane 无现役 command in flight，AGENT 停止新 claim；清除已撤销 job 后剩余 WAL 若仍有 `DISPATCHED`，停止切换并维持未知阻断。
5. Browser SQLite WAL 一致性整库备份和加密 key 身份读回完成，仅用于整体 rollback。

### 切换顺序

```text
停新 claim / drain 当前 command
-> Website 部署 V44 provider contract
-> Browser SQLite 离线 drop browser_target_claims
-> AGENT 部署 V44 consumer + Targetless Browser/Runtime
-> session open 以 version=44 精确握手
-> 两仓先前各自的 native CHANGE/READY 证据与本次部署身份核对
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

## WO-F：Target 权威边界冻结

**Owner**：AGENT architecture-boundary（冻结条款、全库反复活扫描、mutant）。被保护的 Target 权威本身仍只属 local-browser-session，不迁移。

**授权与范围**：授权人 2026-09-26 指令“论证成立则立即冻结”。冻结对象是 Target 的**宪法地位与禁止式不变量**，不是 Browser 子系统、不是任何文件的字节，也不改变 WO-X/CI-FULL/RELEASE 仍未完成的事实。Website 侧无改动（见下“裁决”）。

### 对外部 GPT 审计意见的裁决（按现役事实复核）

| 论点 | 现役事实 | 裁决 |
| --- | --- | --- |
| Target 不是恢复身份/attempt/result revision/风险资格 | 003-V44 forbidden#3/#16/#17、Runtime V73 forbidden#2 已成文；代码 `preflightTargetAcquisition` 不含 `expectedTargetRef` | 成立；已成文，**未**字节冻结 |
| Target 不是 source handoff 依据 | V73 forbidden#6；`runtime-source-handoff.ts::assertV44SealedHandoff` 拒绝 5 个旧字段；Website `v6-source-readback-proof.ts` 精确键校验 + exam 注入 `old_target_ref_hash` | 成立；AGENT 侧仅 `old_path` 有拒绝测试 |
| Target 不是容量/冷却/完成依据 | V73 forbidden#8、Website AI-ACC-012 forbidden#19 | 成立；已成文 |
| 缺席语义：bound-observation 失败关闭且不建 Tab；其余 mode 建当前 Target | `extension-target-acquisition.ts`、`extension-target-authority.ts`；`local-browser-target-lifecycle-support.ts` 已有 closed-tab 动态正例 | 成立；**已有动态正例，无需新增行为码** |
| 归零 token 分母 | 本方案 WO-QA 已列 11 项。现状：`expectedTargetRef`、`browser_target_claims` 仅在点名文件做 includes；`BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE`、`readUnreleasedTargetClaims`、`assertHistoricalTargetClaimCoverage` 无任何守卫；5 个 V44 旧字段在 `src/` 唯一合法出现处是 `assertV44SealedHandoff` 的 `Object.hasOwn` 拒绝字面量 | 成立；这是真缺口。**“归零”必须定义为：除该拒绝字面量外 `src/` 零出现**，朴素 grep-零会误杀现役拒绝校验 |
| 三层冻结：法案 / 施工图 / 核心代码 | 现役唯一字节冻结机制是 `LAW-ARCHITECTURE-BOUNDARY-001-V17` forbidden#10 Tombstone + `architecture-boundary.acceptance.ts` sha256；同域已有全库 ts-morph 扫描与 mutant 先例 | 法案层、代码层成立并复用该机制；**施工图层不做 hash 冻结**（无真实消费者，Tombstone 先例亦不 hash 施工图，施工图从属法案）；代码层按“语义冻结”，不做文件字节冻结、不建保护文件清单 |
| 提交 `c4a9ea66…` 与《玄学网站迭代分析记录.md》 | 两仓本地均不存在该提交/文件 | 无法核实；不作为任何冻结依据 |

### 冻结三件套（复用现役 Tombstone 机制，零新机制）

1. **法**：在 `功能法案.md` 的 architecture-boundary 域新增独立法条 `LAW-ARCHITECTURE-BOUNDARY-002-V1`（`supersedesLawId: null`，`dependsOnLawIds: []`），唯一一条 forbidden：`TARGET-AUTHORITY-BOUNDARY-001`。不修改任何现役法条，因而不触发既有法条升版与依赖级联；不写版本号进条款正文。`architecture-boundary` manifest 追加该 lawId。
2. **扫描**：新增 `scripts/audit/domains/architecture-boundary/components/scan-target-authority-boundary.ts`，导出 `inspectTargetAuthorityBoundary`，在 `architecture-boundary/inspector.ts` 与 `inspectBusinessRecoveryAuthorityBoundaries` 并列接线，并为新法条追加独立 `lawResults`；`architecture-boundary-shared.ts` 的 `resolveArchitectureLawIds` 仅追加 `targetAuthorityLawId` 一个解析字段。语义：
   - 分母 = `src/` 下全部 active 源文件；11 个 WO-QA 归零 token（`expectedTargetRef`、`BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE`、`browser_target_claims`、`readUnreleasedTargetClaims`、`allDispatchedTargetsSettled`、`assertHistoricalTargetClaimCoverage`、`old_target_ref_hash`、`old_document_ref_hash`、`old_path`、`browser_target_settled`、`target_settlement_hash`）任一出现即 `architecture/target-retired-authority-resurrected`。
   - 唯一例外：后 5 个 V44 旧字段只允许在 `src/lib/local-runtime/production/runtime-source-handoff.ts` 的 `assertV44SealedHandoff` 内作为 `Object.hasOwn(_, "<token>")` 的字符串字面量出现；且这 5 个字面量必须**全部存在**，缺失即 `architecture/target-v44-reject-missing`（防止有人把拒绝校验静默删掉）。
3. **mutant 与字节钉**：扩展 `scripts/acceptance/architecture-boundary.acceptance.ts`：紧随 Tombstone 钉增加新条款 sha256 钉；对真实树断言零 finding；再注入 6 个 mutant，均必须命中——新文件含 `expectedTargetRef`；字符串含 `browser_target_claims`；字符串含 `BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE`；他处对象字面量含 `old_target_ref_hash`；他处 `Object.hasOwn(x,"old_path")`；从真实 `runtime-source-handoff.ts` 删去 `target_settlement_hash` 拒绝项。并为新法条发 `exam.golden` 观察。

### 施工落点

WO-F 于 2026-09-26 落地：`功能法案.md`（新增 `LAW-ARCHITECTURE-BOUNDARY-002-V1`）、`scripts/audit/generated/law-registry.generated.json`（`audit:build` 重建）、`scan-target-authority-boundary.ts`、`architecture-boundary/inspector.ts`、`architecture-boundary-shared.ts`、`architecture-boundary/manifest.json`、`architecture-boundary.acceptance.ts`。本节不记录质量等级，等级只以各仓原生 `quality:check` 报告与其绑定的 Git commit 为准。

### 明确不做（删除审判结果）

- Blueprint 逐字 hash 冻结：无真实消费者，且会制造与法案并行的第二冻结真相。
- 核心代码文件 hash/保护文件清单：会把合法重构（如 Target-loss consumer 抽取）误判为宪法变更；代码层锁由全库分母承担。
- 对 Runtime/Mediator 的“`target_ref` 词汇归零”：`src/mediator/product-plugin-contract.ts` 的 review issue 字段 `target_ref` 与 Target 无关，词汇扫描不可行；该职责继续由 V73 forbidden#6 与 `inspectRuntimeBrowserPrivateImports` 承担。
- Website 改动：V44 校验为精确键集合，exam 已含旧字段注入负例，无缺口。
- 新增行为代码：缺席语义已有动态正例。

### 验收

- 真实树：新扫描零 finding，`assertV44SealedHandoff` 5 个拒绝字面量全在。
- 6 个 mutant 全部命中对应 checkId；原 Tombstone 钉与既有 mutant 不受影响。
- `npm run audit:build`、`npm run audit:projection:check`、`npm run typecheck` 通过；`quality:check`（CHANGE）在 `GRASSEYE_LAW_AMENDMENT_AUTHORIZED=1` 下命中的 architecture-boundary 考试通过。以上均不等于 READY/RELEASE。
- 解冻仪式：改动 `TARGET-AUTHORITY-BOUNDARY-001` 字节须授权人明确解冻；本条款被改则 sha256 钉失败。

### 停止

- 真实树扫描出现 `assertV44SealedHandoff` 以外的旧 token，说明存在未记录的旧 Target 消费者：停止冻结，先定位归属，不放宽例外。
- 新法条无法满足静态/考试证据覆盖：不得靠放宽 evidenceModes 通过。

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
| Browser WAL terminal + current writer fence/authority epoch/permit | 风险新输入前的并发安全门 |

### 8.3 删除反事实

对每个候选做反事实：

- 现役 `browser_target_claims` **确有** acquisition、Runtime source handoff、Browser lane 未决放行、WAL startup 覆盖检查、cleanup 和 V43 source proof 消费者，不能直接删表。只有 A3/A4/A5/A7 与 W2/A2 同候选替换这些消费者并验明零残留后，实时 ownership 由 live registry、历史副作用及未决集与 writer terminal 由 Browser WAL、恢复 locator 由 URL/userTurnId 分别承担；此时才失去独立必要性。
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
| TGT-006 | Target 不进入 V44 source evidence | Website schema/serialized request 无 Target/Document 显式字段；V44 WAL authority、anchor proof、source-effect-set hash 均为 targetless projection，旧原始哈希不跨仓 | BLOCK |
| TGT-007 | Target cleanup 不控制业务完成 | completed + no live Target 仍直接 cleanup settled | BLOCK |
| TGT-008 | WAL 仍防重复 Provider input | same effect physical submit <=1，除 Website 精确 risk grant | BLOCK |
| TGT-009 | 当前动作仍强校验 Target/Document/fence | 漂移时 physical input delta=0 | BLOCK |
| TGT-010 | 无 locator 不猜聊天 | 无 URL/userTurn -> typed unaddressable，零 scan/navigation guess | BLOCK |
| TGT-011 | 风险新输入门是原 WAL terminal-only input-quiescence | 任一旧 DISPATCHED 未决时所有 job 新 input=0 | BLOCK |
| TGT-012 | `target_local` 与 Target instance 分离 | effect_scope 行为保持原合同 | BLOCK |
| TGT-013 | 无第二恢复器 | 无新 queue/store/manager/state machine | BLOCK |
| TGT-014 | 最终业务闭环 | same job admission + object readback + completed | BLOCK |
| TGT-015 | V43 活动祖先清零 | 精确删除 31 个未完成 job 后，V44 新 claim 不读取已完成 job 的旧事件、不解析 V43 proof | BLOCK |
| TGT-016 | 本地 V43 sealed handoff 不回流 | Website exact absence 后连同该 job 本地数据物理删除；V44 新 claim 拒绝 V43 shape | BLOCK |
| TGT-017 | 同 URL 重载仍更新 Document | Page.navigate=0 且 loader 漂移时同步推进 current Document，旧 documentRef 不用于观察 | BLOCK |

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
                                             │       ├─> A6 URL-based polling
                                             │       └─> A7 writer-path quiescence
                                             │               └─> A4 target claims retirement + lane/startup replacement
                                             │
                                             └─> A5 Runtime targetless recovery

A2+A3+A4+A5+A6+A7
  -> QA AGENT
W2 -> QW Website
QA + QW -> X coordinated clean cut -> production business closure
QA -> F Target 权威边界冻结（仅 AGENT，先于后续 Browser DOM / source-handoff 施工）
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

### 12.1 授权的一次性未完成需求清除（V44 前置）

授权人已选择永久放弃 Website 当前 31 个未完成 job，并清除 AGENT 对应本地数据；完成的 569 个 job、6 个同单已收录文章 run、原事件及其历史取证保持原值。该选择只覆盖本次精确集合，不建立通用“失败即删除”业务规则。Website 先停止/围栏现役 worker 与新 claim，以事务锁定并重核 31 个 job、有效 admission、租约、cooldown cohort、下游引用及材料共享；公开知识 Work Order 先暂停，保留 6 个完成闭包。只按授权集合删除未完成 root 与独占子图；4 个私有材料 blob 中 2 个被其它 job 共享，必须保留，另 2 个仅在对象删除与独占性精确读回成立时清除。Website root 和全部关联行缺席、569 个完成 root 与 6 个 admission 保持不变，才算 Website 删除完成。失败不得部分宣称成功，也不得将已发 Provider 输入宣称为未发。

AGENT 在 Website exact absence 已读回、所有本地 writer 已停止后，按精确 job_id 清除其中 3 个本地 failed task 及其 24 个 handoff、关联 Outbox/材料/结果/Forensics/WAL。两条原 `target_local DISPATCHED` 仅随已撤销整个 job 身份删除，不修改其原状态、不给任何仍存在 job 新输入资格；清除前后其它 job 与剩余 WAL authority 保持不变。最后再离线 drop `browser_target_claims` 和两个索引；V44 新进程只从当前 live registry 取得 Target。此步骤是业务需求的授权撤销，不是旧 Target 的恢复或结算。

**状态：施工中。双仓法案、施工图、V44 合同、代码与局部质检已迭代；本机 SQLite 切换已有只读读回，Website 旧 job 精确集合仍待独立读回，CI-FULL 与最终业务闭环尚未通过。**

主 Codex 在并入审计发现后重新完成两遍独立自检：先从双仓 active law、5 份相关 Blueprint、V44 provider/dependency、Browser WAL/Runtime source 到 Website admission 正向核主链；再从 17 条强制验收、历史 V43 source/zero-submit 祖先、Tab 关闭与同 URL 重载、Browser lane/startup/release、所有旧字段消费者逆向追到唯一 Work Order。两仓 active law corpus 全量机器遍历（AGENT 3+35 条，Website 1+567 条）和施工图全集遍历（AGENT 7、Website 3）后，对命中法条及其直接依赖、5 份相关施工图正文逐项人工核对。有限机械自检分母为 54 项，54/54 通过：13 条升版法案的正文/唯一 registry、10 份施工图中旧身份残留、两侧 V44 spec 版本、12 项新发现的关键消费者/方案落点、17 条验收入口。连同两遍主 Codex 语义核查，本轮阶段一自检达到要求的 98% 门槛。该比例不代表任何代码覆盖率或生产 PASS。两仓原生 `audit:build`、`audit:projection:check` 与 `git diff --check` 均通过；该阶段当时未对生产代码作保留修改。

发现的 V43/V44 逐字 proof 比较、`jsonb` 事件对象、未接收 V43 sealed handoff、Tab 关闭同轮重建、同 URL loader 漂移、旧 lane/Target release 消费者及异步帧屏障竞态均已就地并入 WO-W2/A2/A3/A4/A7、切换门和 TGT-015..017。A7 随后经只读审查收敛为 WAL terminal-only；原阶段一比例仅对应当时版本，不冒充当前候选自检。阶段一代码门现在只取本方案当前候选，之后若命中相关漂移须重新自检，不能沿用本段结论。

当前候选的法案/施工图已再次双向核对，双仓原生 `audit:build` 与 `audit:projection:check` 通过。AGENT 生产代码及质检移除了持久 Target 身份链；Website V44 新请求只接受 targetless 来源。两侧为 V43 活动恢复新写的解析器已删除，已完成历史不进入新 claim。受影响的双仓 typecheck、Website V44 Exam、AGENT GPT/Runtime 与 Browser 局部 acceptance 已通过；这些结果均不等于 READY、RELEASE 或生产闭环。主 Codex 已从三条权威轴正向、17 条验收反向自检两遍，子智能体最终只读审查和完整 CI-FULL 仍待闭合。

获授权的 Website 原 31 个未完成 job 已按精确旧身份物理删除，公开知识同单 6 个已收录 run 与 Work Order 保留且 Work Order paused；569 个完成 job 保持原值。Website 自动 ensure 随后创建了 30 个**新**本地化 job ID；其 `accepted_attempt_count=0`、`attempt_id=null`，无旧 source/risk 事件，不是旧身份复活，也不需要 V43 恢复 parser。本次删旧不撤销持续存在的本地化业务需求。AGENT 对旧集合对应的 3 个本地 failed task、24 个 handoff、132 条 Browser WAL 行、786 条 `browser_target_claims` 及两个索引已离线物理删除，569 个完成 task 与剩余 WAL 不变，SQLite `quick_check=ok`。原两条 `target_local DISPATCHED` 随整项已撤销 job 删除，没有伪造 terminal；剩余 Browser WAL 没有 `DISPATCHED`。因此切换门以旧身份缺席、当前无 V43 活动祖先和剩余 WAL 未决为准，不以 `failed` 总数必须为零为准。

跨 Extension 重启而原 WAL 仍有无可靠终局的 `DISPATCHED`，当前代码无法从新 actor 空 pending Set 证明旧 CDP 动作已终结。目标链对此明确失败关闭：只允许原 effect 零输入读回及有界对账，禁止自动新物理输入；只有原 WAL 全部可靠 terminal 才可出具 input-quiescence proof。V43 已签 `source_manifest_json` 由原 event JSON 与 seal 按原版本只读核 lineage，V44 新 source/new claim 严格按新合同；不保留 V43 写入或 Target 身份兼容链。

进入最终 CI-FULL 前仍须重新读取两仓 branch/HEAD/tracking/dirty，并以实际候选重跑 canonical law dependency、contract version 和 scoped change 检查。

本方案最终只保留一条 Target 原则：

> **Target 是当前动作的现实坐标，不是系统记忆。系统记住 Provider effect，系统记住 canonical conversation URL + userTurnId，但绝不记住“原来的 Target”来决定未来。**
