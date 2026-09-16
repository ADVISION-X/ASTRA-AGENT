# GPT 文本回答两门禁冻结－完整实现方案

## 0. 方案身份

- 状态：**可施工**。这只表示设计闭合，不代表代码完成、CHANGE/READY/RELEASE 或生产闭环。
- 需求 Owner：AGENT 仓库的 `gpt` 能力域；`local-browser-session` 只提供同一原子观察中的机械事实。
- 唯一方案路径：`docs/项目方案/GPT文本回答两门禁冻结-完整实现方案.md`。
- 本方案是独立的任务级施工方案，不改写 `十小时连续运行事故分组根治-完整实现方案.md`；后者只作为事故连续性线索，不再承载本次工单或验收。
- 本轮只产出方案文件。法案、施工图、代码、质检、数据库、Browser 生产动作和发布均未施工。

## 1. 需求、权威终点与范围

### 1.1 唯一需求

对 `checkpoint_gpt_text_response` 冻结且只允许两道逻辑门禁：

1. **回答身份安全门**：证明本次读取的是当前 job 已确认提交所对应的那一条紧邻 assistant 回答；
2. **回答结算完成门**：只根据停止按钮与回答正文，裁决继续等待、成功或连续 20 分钟停止且空回答。

任何页面外壳、展示状态、控件数量或历史位置条件均不得成为第三道门禁，也不得被包装进上述两道门后取得隐藏阻断权。

### 1.2 权威业务终点

本次局部成功终点是：`checkpoint_gpt_text_response` 对正确的紧邻 assistant turn 返回完整 `rawDomHtml + semanticText` 及其 hash，Forensics 写入并读回同一 task-owned artifact。

系统最终业务终点保持不变：

```text
exact assistant artifact
  -> Product result
  -> Runtime 唯一 Outbox
  -> Website Domain Consumer admission
  -> 同一 job_id + result_payload_hash 的 admission receipt/readback
```

Provider 页面已回答、GPT Child 成功、artifact 写入、Outbox delivered 均不得冒充 Website 最终入库。

### 1.3 施工范围

仅允许触碰：

- AGENT 侧一条 GPT active law 的最小版本替换；
- GPT 与 Local Browser 两份现役施工图的同候选冻结描述；
- exact assistant 专用读取函数及其现有 decoder；
- `checkpoint_gpt_text_response` 现役结算判定的必要原位固化；
- 现役 GPT/Browser inspector、既有 acceptance 与唯一 governance mutation test；
- 法案版本引用及由现役 generator 生成的唯一 law registry 投影。

### 1.4 明确非目标

- 不改 Website 仓库、跨仓 provider/consumer 合同、数据库、表、字段或迁移；
- 不改变 40 秒静默门、70—90 秒全局 Provider observation 节拍、Browser FIFO/lane、WAL、effect identity、Target 恢复或 result revision；
- 不改变停止按钮存在时继续等待，以及停止按钮消失且空回答连续 20 分钟才失败的规则；
- 不改变 Prompt、附件、模型、Product Flow、Outbox、Website admission 或任务容量 N；
- 不新增 Child、helper 层、队列、timer、store、状态机、兼容桥、feature flag、fallback、第二读取链或第二质量裁决；
- 不使用用户当前 ChatGPT 操作者会话充当 RELEASE 生产证明。

## 2. 输入实证与事实等级

### 2.1 Chrome 真实页面实证（2026-09-17）

用户提供的 canonical conversation URL 只在本文记录 hash：

`sha256:1599c8d9d63f6ab8c65bdc7de0988af133146da256841208061f287477bd7093`

同一次只读 DOM 观察得到：

| 事实 | 真实值 | 裁决 |
|---|---:|---|
| conversation turn 数 | 4 | 页面已有两轮 user/assistant |
| 任务 user turn | `conversation-turn-1`，唯一 | 可作为已确认提交返回身份的定位点 |
| 紧邻 assistant turn | `conversation-turn-2`，唯一 assistant-role | 是本任务回答 |
| 该 assistant 是否页面末位 | 否，后面还有 turn-3/turn-4 | “必须页面最后一条”会误杀真实回答 |
| 该 assistant 正文长度 | 8011 字符 | 已有完整非空回答 |
| `#composer-submit-button` 数量 | 0 | “必须恰好一个 Composer submit”会误杀真实回答 |
| stop button 数量 | 0 | 当前回答已停止生成 |

该实证证明页面末位与 Composer 数量不是回答身份，也不是回答结算事实。它只用于设计和回归分母，不授权读取、改写或复用该操作者会话执行生产任务。

### 2.2 Git 历史实证

`git blame` 与 `git log -S` 证明提交 `c473d6a90` 同时加入：

- `assistantIndex === turns.length - 1`；
- `composerRaw === 1`；
- `generatingRaw === 0` 作为候选存在前置。

它们不是原始 exact adjacency 身份的一部分。当前未提交 overlay 已删除这三项候选前置，但尚未完成本方案要求的“仅两门”冻结，且 `browserMechanicalFacts(...).visible/ariaHidden/inert` 仍可把已精确定位的回答降为 missing。

### 2.3 权威事实

- `LAW-CAPABILITY-GOVERNANCE-001-V15` 已规定：一个 Child 只有一个业务完成判据，只有防串任务、串 Target/Document 或错误结果接收不可替代时才可再有一个安全判据，第三个阻断判据默认删除。
- `LAW-GPT-001-V55` 已规定：回答读取按 submit 返回的 canonical conversation URL、精确 user turn 及其真实紧邻 assistant turn 裁决，不得用固定 turn 编号或奇偶猜测。
- `LAW-GPT-002-V18` / `FROZEN-EXACT-TARGET-POLL-RESULT-REVISION-001` 已规定：stop button 存在时永不判停；仅 stop 连续消失且回答连续为空满 20 分钟才产生 `GPT_RESPONSE_STOPPED_EMPTY`。
- `LAW-LOCAL-BROWSER-SESSION-006-V34` 已允许 exact assistant 完整 DOM/semantic text 经专用 reply-only 通道返回，并禁止二次 Prompt rehash。
- GPT V56 与 Browser V47 施工图已把 Target/current Document/revision、精确 user turn 和紧邻 assistant 作为回答身份主线。

因此，本次不是发明新安全机制，而是把现役全局“两判据上限”精确落到文本回答 Child，并删除无法证明必要的展示型门禁。

## 3. Scoped candidate 绑定

### 3.1 仓库候选

| 项 | 当前绑定 |
|---|---|
| realpath | `/Users/nexgen/Documents/AGENT` |
| branch | `main` |
| HEAD | `9005918c9072313ebdbbf8178864b6622f12def8` |
| tracking | `origin/main` |
| 方案写入前路径状态 | 不存在，新建唯一文件 |

### 3.2 相关 dirty overlay

下列四项是前一轮同片区的未提交候选，属于用户改动，不得覆盖、恢复或丢弃：

| 路径 | 当前 SHA-256 | 本方案裁决 |
|---|---|---|
| `src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts` | `13895563ca2dff583642b1f57da1ce2532af34144f51066034d7a806a62b998c` | 部分施工：已删末位/Composer/生成态候选门，仍有 visibility eligibility 隐藏门 |
| `scripts/acceptance/local-browser-exact-assistant-turn-support.ts` | `6c677a2997479b9c6b8fa9c4a912e0d753f587b0c35581aa6cfd8c3ca16cb56b` | 部分验收：已覆盖末位与生成态，不足以冻结两门上限 |
| `scripts/audit/domains/local-browser-session/dom-mechanical-facts-inspection.ts` | `354ca045e057611a1379039232196eb355d7329118d5eef34147cdfab65098e3` | 部分 inspector：仍强制 `browserMechanicalFacts`/eligible |
| `tests/governance/quality-contract.test.ts` | `618592434eb3d4da3b060476cc0275a7006d870d4641de3a50819e8aeb0d7766` | 部分变异测试：只防末位与 Composer 回流 |

执行 Codex 必须先逐项复读并采用“在现有 overlay 上继续收敛”的方式施工；hash 漂移时重新计算受影响工单，不得用 HEAD 版本覆盖。

### 3.3 当前 authority hash

| 对象 | SHA-256 |
|---|---|
| `.github/instructions/agent-rules/基础法案.md` | `f1970c2416127f8bcdf560d0fd81105895924c4ed2cdd23f6a08ae910998d2f3` |
| `.github/instructions/agent-rules/功能法案.md` | `36a68dc054275ff5cc8ddff1f46fa75b60200174473249bd473e901f2d53ac4b` |
| GPT Blueprint V56 | `e6a85e405faceb1e5456ff82e9d2c03033ef4bc6e66ac925c7535d9b3a3fc5eb` |
| Browser Blueprint V47 | `419453cb0c67d422228b8fbdba813dd8f34e29426b44db29f949381ebc456d1e` |
| Runtime Blueprint V53 | `94c2cd1ca162f81346c36c96c982e733671fe19d9cc59fec09ad0bf52f546dfb` |

施工前及法案/施工图完成后必须各重新绑定一次；相关对象漂移即停止代码施工。

## 4. 现役实现重建与第一直接断裂

现役唯一调用链：

```text
checkpoint_gpt_text_response/handler.ts
  -> gpt-dom-observation.ts#readExactAssistantTurn
  -> BrowserDomIntent kind=readExactAssistantTurn
  -> dom-intent-runtime.ts
  -> dom-exact-assistant-turn.ts#executeExactAssistantTurnRead
  -> 同一 Runtime.callFunctionOn 取得 URL、turn 邻接、stop、DOM、semantic text
  -> loader before/after + current authority 校验
  -> GPT Child 结算
  -> task-owned observed-response artifact
```

第一直接断裂位于 `dom-exact-assistant-turn.ts`：

1. exact user turn 与紧邻唯一 assistant 已经确定后，代码再次调用 `browserMechanicalFacts(node, false)`；
2. `visible && !ariaHidden && !inert` 被转换为 `eligibleCount`；
3. `eligibleCount=0` 时完整 `outerHTML` 与 semantic text 被清空；
4. decoder 把它转换为 `BROWSER_DOM_CANDIDATE_MISSING`；
5. GPT Child 无法取得实际已经存在的回答，只能继续轮询。

这是把“可展示/可交互性”错误提升为“回答是否存在”。文本读取不执行指针动作，当前真实消费者只需要精确身份与完整内容；删除该展示门后，Target/current Document/loader/revision、URL、精确 user turn、邻接唯一 assistant 仍完整防止串页、串任务与错误结果接收。

## 5. 冻结后的两道门禁合同

### 5.1 门禁一：回答身份安全门

唯一 Owner：`gpt/checkpoint_gpt_text_response` 定义语义；`local-browser-session` 在一次原子 observation 内机械取得事实。

不可拆的 canonical identity 同时绑定：

- submit 已确认的 canonical conversation URL 与当次清洗后的 `currentUrl` 精确相等；
- submit 已确认的 exact `userTurnId` 在当前 Document 中唯一对应 user-role turn；
- 该 user turn 在 conversation turn 序列中的真实紧邻下一 turn 内恰好一个 assistant-role root；
- observation 始终绑定同一 exact call、Target、current Document、main-frame loader before/after 与 observation revision。

这些字段由同一 Browser 原子 observation 产生、下游整体消费，任一缺失都会造成串页、串任务、错 turn 或 stale Document，因此按 `LAW-CAPABILITY-GOVERNANCE-001-V15` 计为**一个安全判据**，不得拆成多个并行门禁或另建身份。

候选为零时只表示本轮尚未出现回答并重置 stopped-empty 窗口；候选多义、URL/Target/Document/loader/revision 漂移时按现役 typed failure 失败关闭。无论何种情况均不得读取其它 turn、页面末位或历史标题补猜。

### 5.2 门禁二：回答结算完成门

唯一 Owner：`gpt/checkpoint_gpt_text_response`。

它只消费同一门禁一 observation 内的两个结算事实：`generatingRaw` 与 `semanticText`，并形成一个三态决定：

| 同一位点事实 | 唯一决定 |
|---|---|
| stop button 存在，不论正文是否已经出现 | `pending`，继续等待；不得按 deadline 判停 |
| stop button 消失且正文非空 | `DONE`，立即返回完整回答 |
| stop button 消失且正文为空，连续不足 20 分钟 | `pending` |
| stop button 消失且正文连续为空满 20 分钟，且 identity 未漂移 | `GPT_RESPONSE_STOPPED_EMPTY` |

任一次 stop 再出现、正文非空或身份门失真，连续窗口归零。该窗口继续复用 Child 进程内单调时间与现役 observation，不新增 timer、持久状态或读取频率。

### 5.3 明确禁止成为门禁的事实

以下条件必须从 exact text response 成功/失败判定中物理删除，并由 inspector 阻止回流：

- assistant 必须是页面最后一条；
- 页面必须存在或恰好存在一个 Composer/submit button；
- stop button 必须消失后才允许 Browser 读取候选 DOM；
- assistant 必须有 layout box、visible、非 `aria-hidden`、非 `inert`、在 viewport 或通过 hit-test；
- Prompt 二次读取/rehash、turn 编号加一/奇偶、标题、侧栏顺序、时间或当前页面最后 turn；
- 把 `rawCount`、`eligibleCount`、`nativeCauseCode`、任意 hash/helper/state 名包装成第三个独立阻断判据；
- 任意新的页面拓扑、控件外壳、动画、展开/折叠或渲染形态检查。

协议结构校验、加密传输真实性、Browser authority/fence 与 decoder shape validation 仍按各自 Owner 失败关闭，但它们不得重解释页面回答或升级成第三个回答准入门。

## 6. 必须写入 active law 的冻结条款

代码与测试不能永久阻止未来膨胀，因此法案迭代在本任务中是必要项。最短方案只把 `LAW-GPT-002-V18` 原位版本替换为 `LAW-GPT-002-V19`，不新增 law record，不修改基础法案，也不改变既有 `FROZEN-EXACT-TARGET-POLL-RESULT-REVISION-001` 的语义。

新增冻结条款的规范文本必须表达以下等价语义：

> **FROZEN-GPT-TEXT-RESPONSE-TWO-GATES-001**：`checkpoint_gpt_text_response` 只能且必须保留两个阻断判据。第一是回答身份安全判据：同一原子 observation 绑定 confirmed canonical conversation URL、exact userTurnId、其真实紧邻且唯一的 assistant-role turn、Target/current Document/main-frame loader 与 observation revision；该 canonical identity 不得拆分、复制或另建第二身份。第二是回答结算完成判据：stop button 存在一律 pending；stop button 消失且 semantic text 非空立即 DONE；stop button 消失且 semantic text 为空仅沿现役连续 20 分钟窗口 pending 或产生 `GPT_RESPONSE_STOPPED_EMPTY`，任一次 stop 出现、正文非空或身份失真均归零。页面末位、Composer/submit 数量、layout/visible/viewport/hit-test、hidden/aria-hidden/inert、Prompt rehash、固定 turn 编号/奇偶、标题、侧栏、时间、动画、展开状态及其它 UI 外壳不得成为候选存在、内容返回、DONE、pending 或 failure 的第三门禁；stop 状态不得在 Browser 候选读取阶段清空 DOM/semantic text。不得把多个独立判据包装为 boolean、helper、hash、identity、candidate cardinality 或 eligibility 后规避两门上限。改变、删除、弱化、扩张或绕过本条，只有授权人明确原文“解冻 FROZEN-GPT-TEXT-RESPONSE-TWO-GATES-001”并同步替换现役法案、GPT/Browser 施工图、实现与唯一质检后才允许；普通修复、Provider UI 变化、CI 或单仓代码授权均不构成解冻。

法案版本替换必须同步更新 GPT Manifest、GPT inspector law 常量、相关 acceptance lawId 与唯一 generated registry；历史方案文件中的旧法案引用不追溯改写。

## 7. 四维闭环映射

| 维度 | 当前事实 | 目标动作 | 验收 |
|---|---|---|---|
| 法案 | 全局已有两判据上限，文本回答未有专门冻结条款 | `LAW-GPT-002-V19` 新增两门冻结；原 V18 其余语义逐字继承 | active corpus 只有 V19；V18 不再 active；registry 由 generator 唯一生成 |
| GPT 施工图 | V56 已写 identity 与 stopped-empty，但未明确排除 visibility 等隐藏门 | 升为 V57，写入两门合同和禁止清单 | blueprint record lawIds 指向 V19；冻结名与法案一致 |
| Browser 施工图 | V47 允许紧邻回答读取，但仍可能把展示 eligibility 当准入 | 升为 V48，只把同包机械事实用于两门，不再拥有第三门 | Browser 段落与 GPT 同候选一致，不新增 Browser law/Owner |
| 现役实现 | 当前 dirty patch 已删 3 个错误条件，仍有 mechanical eligibility | 原位删除 exact response 专用路径的 visibility eligibility；保留 identity 与 settlement | 完整 DOM/text 在末位=false、Composer=0、stop=1、layoutless/hidden 场景仍可被身份门观察；只有结算门决定是否 DONE |
| 质检 | 现有测试仅禁止末位与 Composer 回流，inspector 仍要求 mechanical facts | 扩展现役 inspector 与 mutation tests，形成两门 allowlist | 任一第三门变异必须使唯一 quality 失败；不建第二 checker/verdict |

Runtime V53 与 Website 合同均不变，因为本次没有改变 typed result schema、artifact、failure code、Outbox 或 admission receipt。

## 8. 原子职责与边界绑定

### RSP-01：回答身份安全门

```yaml
responsibility: 精确定位本次 confirmed submit 的紧邻 assistant 回答
canonical_owner: gpt/checkpoint_gpt_text_response semantic contract; local-browser-session mechanical observation
authority_inputs_and_providers:
  - Browser WAL confirmed readback 提供 canonical conversation URL 与 exact userTurnId
  - Browser Authority 提供 exact Target/current Document/main-frame loader
single_decision_or_action: 同一原子 observation 判定 canonical response identity 是否唯一成立
typed_output_or_persisted_truth: BrowserExactAssistantTurnReplyV3 及 observationRevisionHash
consumers:
  - checkpoint_gpt_text_response
  - task-owned observed-response artifact writer
failure_owner_and_location: Browser typed missing/ambiguous/document invalid; GPT result decoder invalid
readback_acceptance: URL/userTurn/assistantTurn/Target/Document/revision 与 rawDomHash/semanticTextHash 同包闭合
forbidden_adjacent_owners:
  - Product 不解释 DOM
  - Runtime/Website 不选择 Provider turn
  - Browser 不决定 DONE 或 Product next step
allowed_change_paths:
  - src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts
  - scripts/acceptance/local-browser-exact-assistant-turn-support.ts
  - scripts/audit/domains/local-browser-session/dom-mechanical-facts-inspection.ts
  - tests/governance/quality-contract.test.ts
```

### RSP-02：回答结算完成门

```yaml
responsibility: 对已通过身份门的回答裁决 pending/DONE/GPT_RESPONSE_STOPPED_EMPTY
canonical_owner: gpt/checkpoint_gpt_text_response
authority_inputs_and_providers:
  - 同一 Browser observation 的 generatingRaw
  - 同一 Browser observation 的 semanticText
single_decision_or_action: 执行停止按钮/正文三态与连续20分钟窗口
typed_output_or_persisted_truth: Child success 或 GPT_RESPONSE_STOPPED_EMPTY typed failure
consumers:
  - Product Plugin 当前 GPT call
  - Forensics artifact path on success
  - Runtime typed failure transport on stopped-empty
failure_owner_and_location: GPT Child handler
readback_acceptance: success 绑定完整内容 hash；stopped-empty 绑定现役独立 observation proof
forbidden_adjacent_owners:
  - Browser 只返回机械事实，不决定结算
  - Runtime 不按 deadline 或日志决定结算
  - Website 只消费 typed fact，不解释页面
allowed_change_paths:
  - src/capabilities/gpt/children/checkpoint_gpt_text_response/handler.ts
  - scripts/audit/domains/gpt/gpt-provider-contract-inspection.ts
  - scripts/audit/domains/gpt/gpt-frozen-attempt-inspection.ts
  - src/capabilities/gpt/acceptance/gpt-stopped-empty.acceptance-support.ts
  - tests/governance/quality-contract.test.ts
```

## 9. 有限状态分母与唯一主链

| 状态 | 身份门 | 结算事实 | 输出/回接 |
|---|---|---|---|
| I0 | authority、Target/Document/loader/revision 无效 | 不评估 | typed fail-close，原链停止，不猜测 |
| I1 | exact adjacent assistant 为零 | 不评估 | pending；stopped-empty 窗口归零；下一轮仍经唯一 FIFO |
| I2 | exact adjacent assistant 多义或 URL/身份不等 | 不评估 | typed fail-close，不读取其它 turn |
| S1 | 通过 | stop 存在 | pending，释放 lease/lane后按现役节拍回接 |
| S2 | 通过 | stop 消失、正文非空 | DONE -> artifact -> Product result |
| S3 | 通过 | stop 消失、正文空且不足20分钟 | pending，同一窗口继续 |
| S4 | 通过 | stop 消失、正文连续空满20分钟 | `GPT_RESPONSE_STOPPED_EMPTY` -> Runtime typed transport -> Website 现役恢复裁决 |

分母内不存在第三种页面准入状态。`probeBudgetMs`、全局节拍、Browser transport 与 Website admission 是相邻 Owner 的既有边界，不得被包装成回答门禁。

## 10. 删除反事实与存在性审判

| 单元 | 当前需求/消费者 | 删除试验 | 裁决 |
|---|---|---|---|
| 回答身份安全门 | 防串页、串 job、串 turn、stale Document；GPT/Forensics消费 | 删除会允许把其它 conversation/turn 写入本任务 artifact | **KEEP** |
| 回答结算完成门 | 防未完成回答或永久空回答进入 Product；Product/Runtime消费 | 删除会提前收半成品，或永远等待空回答 | **KEEP** |
| assistant 页面末位 | 无真实消费者 | Chrome 实证中有效 turn-2 后已有 turn-3/4，删除后闭环正常 | **DELETE** |
| Composer/submit 数量 | 无回答读取消费者 | Chrome 实证数量为0但回答完整，删除后闭环正常 | **DELETE** |
| stop 作为候选存在门 | 结算门已完整消费 stop | 删除候选门后仍由结算门阻止提前 DONE | **DELETE from identity; KEEP only inside settlement** |
| visibility/layout/aria-hidden/inert eligibility | 文本读取无指针动作消费者 | 删除后 exact identity、完整内容、hash、Document/revision仍闭合 | **DELETE** |
| `eligibleCount`/`nativeCauseCode` 在专用 exact reply 内部的阻断用途 | 只服务待删除 visibility gate | 删除后外部 `BrowserExactAssistantTurnReplyV3` 无 schema 变化 | **DELETE** |
| Prompt rehash/历史 turn/标题/侧栏猜测 | 现役冻结已禁止 | 删除后 submit 返回身份已足够 | **DELETE / KEEP ABSENT** |
| 新 helper/状态/registry/第二 proof | 无消费者 | 两个现役 Owner 原位即可完成 | **DO NOT ADD** |

删除后仍只有两项不可删除结构，满足用户“不能证明不能被删除就删除”以及现役能力治理法案。

## 11. 原子工单与施工顺序

法案与施工图未对齐前禁止进入代码。工单必须串行：

### TG-01：重新绑定 candidate

- 复读 §3 的 HEAD、tracking、四个 dirty hash 与 authority hash；
- 检查本方案文件是否有未授权改动；
- 输出 scoped diff，不扫描或清理无关工作树。

完成门槛：相关 candidate 无未解释漂移；当前四项 overlay 被明确采用而非覆盖。

### TG-02：法案与施工图先行冻结

- `LAW-GPT-002-V18 -> LAW-GPT-002-V19`，只新增 §6 两门冻结并原样继承其余语义；
- 更新 `scripts/audit/domains/gpt/manifest.json`、GPT inspector 常量、相关 acceptance lawId；
- GPT Blueprint `V56 -> V57`，写入两门合同、禁止清单与验收；
- Browser Blueprint `V47 -> V48`，写入“机械观察只服务两门、展示事实无阻断权”；
- 使用现役法案生成器重建 `scripts/audit/generated/law-registry.generated.json`，禁止手工编辑投影；
- Runtime Blueprint、Website 仓库与跨仓合同改动数必须为零。

完成门槛：法案、两份施工图、Manifest/inspector lawId 与 registry 在同一候选一致；主 Codex 自检无第三门语义后才可进入 TG-03。

### TG-03：物理删除 Browser 隐藏门

在现有 dirty `dom-exact-assistant-turn.ts` 上继续收敛：

- 保留 URL、exact user turn、真实紧邻唯一 assistant、Target/Document/loader/revision；
- stop count 与完整 DOM/semantic text 在同一次调用中并列观察，stop 不再清空候选内容；
- 从专用 exact assistant 路径删除 `browserMechanicalFacts`、`eligibleCount`、`nativeCauseCode` 及只为它们存在的 decode/fixture 分支；
- 外部 `BrowserExactAssistantTurnReplyV3`、hash、wire 方向与 schemaVersion 保持不变；
- 不建立通用候选 helper、兼容 reply 或 V3/V4 双读。

完成门槛：exact assistant 专用生产路径只实现身份门，不含任何展示/交互资格判断。

### TG-04：固化 GPT 结算门

- 保持 handler 现役三态与 20 分钟窗口；
- 仅在确有必要时原位整理条件，使 DONE 只可能来自 `generatingRaw===0 && semanticText.trim().length>0`；
- candidate missing 归零窗口，stop 存在或正文非空均归零；
- 不改 timeout、轮询节拍、失败码、proof schema 或 Product call。

若现役 handler 已完全满足本工单，只提交复用证据，代码改动必须为零。

### TG-05：唯一质检冻结两门上限

原位修改现役质检，不新增 checker：

- Browser inspector 对 exact response 使用 AST/结构 allowlist，只允许身份安全门的 canonical fields；
- GPT inspector 精确约束结算三态，禁止把 stop、正文以外页面事实加入 DONE/pending/stopped-empty；
- acceptance 覆盖：有效回答非页面末位、Composer=0、Composer>1、stop=1、hidden/inert/layoutless、正文非空；这些场景 Browser 均返回同一回答内容，只有 GPT 结算门决定 pending/DONE；
- 反例覆盖：错 URL、user turn 缺失、多 assistant、loader/Document 漂移仍失败关闭；
- mutation tests 必须分别向源码重新注入末位、Composer、visibility、layout、ariaHidden、inert、Prompt rehash 和任意第三 blocking predicate，并证明唯一 inspector 失败；
- 保留现有 stop-empty 正反与单调 20 分钟测试。

完成门槛：任何第三门回流均不能通过 `npm run quality:check`；测试本身须由 mutation 证明不是空断言。

### TG-06：分层验收

施工期使用现役入口，不创建第二 verdict：

```bash
npm run typecheck
npm run acceptance:gpt
npm run acceptance:local-browser-terminal
npm run acceptance:capability-governance
node --import tsx --test tests/governance/quality-contract.test.ts
npm run quality:check CHANGE
```

READY/RELEASE 仅在用户另行要求时按仓库原生流程执行。动态证明必须使用 system-owned production Tab：先证明一个已有后续 turn 且 Composer 不存在的有效回答仍可落 artifact，再证明 stop 存在的长回答不会提前 DONE，最后以 Website admission receipt 与领域对象 readback 收口。用户提供的操作者会话只保留为设计实证，不参与生产验收。

## 12. 质检验收矩阵

| 用例 | 身份门 | 结算门 | 期望 |
|---|---|---|---|
| 紧邻唯一回答，后有新 turn，Composer=0，stop=0，正文非空 | 通过 | DONE | 成功返回同一 turn |
| 紧邻唯一回答，Composer>1 | 通过 | 由 stop/text 决定 | Composer 不影响结果 |
| 紧邻回答 hidden/inert/layoutless，stop=0，正文非空 | 通过 | DONE | 完整内容仍返回 |
| 紧邻回答已有正文但 stop=1 | 通过 | pending | 不提前入库 |
| stop=0、正文空 19m59s | 通过 | pending | 不重发 |
| stop=0、正文连续空 20m，至少两次 observation | 通过 | stopped-empty | 唯一 typed failure |
| stop 空窗口中再次出现 | 通过 | 窗口归零 | pending |
| user turn 后无 assistant | 未通过（missing） | 不评估 | pending，窗口归零 |
| user turn 后 assistant 多义 | 未通过 | 不评估 | fail-close |
| URL/Target/Document/loader/revision 漂移 | 未通过 | 不评估 | fail-close |

## 13. 端到端闭环

```yaml
end_to_end_closure:
  demand_source: 用户要求基于真实Chrome实证把文本回答准入冻结为两门且禁止未来膨胀
  authoritative_business_terminal: Website Domain Consumer 对同一 job_id + result_payload_hash 的 admission receipt 与领域对象readback
  identity_spine:
    - job_id + result_revision + confirmed provider effect
    - canonical conversation URL + exact userTurnId
    - adjacent assistantTurnId + Target/current Document + observationRevisionHash
    - rawDomHash + semanticTextHash + task-owned artifact ref/hash
    - result_payload_hash + Website admission receipt
  affected_chain:
    - RSP-01 回答身份安全门
    - RSP-02 回答结算完成门
    - 现役 Forensics artifact
    - 现役 Product/Runtime/Website 主链（只读依赖，无接口变化）
  handoffs:
    - producer: submit_exact_gpt_turn_once confirmed receipt
      consumer: RSP-01
      readback: canonical URL + exact userTurnId + current Browser authority
    - producer: RSP-01 exact assistant observation
      consumer: RSP-02
      readback: same revision-bound stop/content facts
    - producer: RSP-02 DONE
      consumer: Forensics artifact writer and Product
      readback: rawDomHash + semanticTextHash artifact integrity
    - producer: Product result
      consumer: Runtime Outbox -> Website Domain Consumer
      readback: admission receipt + domain object exact result hash
  rejection_failure_or_unknown:
    - identity missing/ambiguous/drift remains typed and never guesses another turn
    - generating remains pending
    - stopped-empty remains the only empty-answer terminal
    - external result unknown follows existing receipt/readback before replay
  uncovered_handoffs: []
```

## 14. 停止、回退与禁止事项

- 任一相关 authority、blueprint、四项 dirty overlay 或方案文件漂移：停止并重新绑定；
- 若施工中声称必须增加第三门，必须先给出当前真实消费者、删除后的可复现错误、现役 readback 和“两门不能完成”的证明；在用户明确解冻前仍禁止施工；
- 若删除 visibility eligibility 导致外部 reply schema 必须变化，先证明真实消费者和兼容性；禁止 V3/V4 dual-read、alias 或桥；
- 任一 Browser 实际页面动作、生产任务重跑、Website 写入、数据库变更、READY/RELEASE 均需对应阶段授权；
- 回退单位是同一 clean commit；不使用 feature flag、fallback、兼容 wrapper 或保留旧路径；
- 删除专用 exact path 字段时，同步删除只为其存在的类型、decoder、fixture、断言和 inspector token，零 zombie；
- 绝不修改、清理或回退本方案范围外的用户工作树。

## 15. 执行 Codex 重绑定清单

执行前必须重新读取并绑定：

1. 根 `AGENTS.md`；
2. `LAW-CAPABILITY-GOVERNANCE-001-V15`、`LAW-GPT-001-V55`、当前 active `LAW-GPT-002`、`LAW-LOCAL-BROWSER-SESSION-003/004/006` 原文；
3. GPT、Local Browser、Runtime 三份现役施工图；
4. §3 的 branch/HEAD/tracking、dirty paths 与 hash；
5. `dom-exact-assistant-turn.ts -> gpt-dom-observation.ts -> checkpoint handler -> artifact` 当前调用链；
6. GPT/Browser Manifest、inspector、acceptance 与唯一 `quality:check` 入口；
7. 本方案自身最新 hash。

只有 TG-01 与 TG-02 完成、法案/施工图自检无第三门、相关 dirty overlay 已安全吸收后，才允许进入代码施工。
