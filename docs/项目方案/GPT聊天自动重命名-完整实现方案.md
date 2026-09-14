# GPT 聊天自动重命名完整实现方案

## 1. 方案状态与核心裁决

状态：**执行阻断（并发候选不可安全绑定）**。

授权人已经明确批准按本方案修改必要的法案、施工图、代码、质检系统和数据库；真实 Chrome 页面也已经证明当前聊天的重命名入口、编辑态与提交方式。因此原“缺少 authority 与 DOM”设计阻断已经解除。

当前新的第一直接阻断是：AGENT 与 Website 都存在其它活跃工单持有的未提交修改，而且修改命中本方案必须改动的法案、GPT/Browser 施工图、lifecycle、manifest 与生成 registry；Website 现役法案还已先于 registry/施工图升级。继续施工会混入、覆盖或提交别人工单，另建 worktree 又会丢失当前现役 authority overlay。按冻结说明书的 dirty-state、候选绑定与法案先行门禁，当前不得进入代码或 CI-FULL。

用户本轮固定两条不可弱化的需求：

1. 每个已经取得稳定 Provider 结果、即将离开当前 GPT 聊天的会话，标题按“月日 + 项目 + 工单编号”投影；
2. 只新增一个独立 GPT 子能力，由它在一次调用内完成全部重命名交互；重命名成功、失败、超时或结果未知，永远不得阻断业务系统。

核心裁决：

```text
稳定 GPT 结果已读回
→ 唯一 rename_settled_gpt_conversation Child 获得当前聊天和短预算
→ Child 内部完成全部页面交互并精确读回，期间不插入其它 GPT Child
→ 无论 renamed / already_exact / failed / timeout / outcome_unknown
→ 当前 Browser lease 都必须释放
→ Product result、Runtime Outbox、Website admission 与下一工单照旧运行
```

“永不阻塞”优先于“Provider 一定改名成功”。系统能够保证每个合格聊天都有一次有界改名机会，但 Provider 页面不可用、DOM 漂移或预算不足时必须放弃本次改名；不得为了补齐标题建立重试队列、第二调度器或把业务完成扣住。标题只是人工可读投影，不是任务状态、恢复 identity 或业务完成证据。

## 2. 需求 Owner、业务终点与范围

需求 Owner：AGENT GPT capability。Browser 只拥有机械页面 mutation、WAL 与 fresh postcondition；Product、Runtime 和 Website 都不拥有标题语义。

标题成功终点：当前 canonical conversation URL 对应的 ChatGPT 标题，在同一有界 compound mutation 后被 fresh DOM 精确读回为目标 NFC 字符串。

业务成功终点保持不变：只有当前 `job_id + result_payload_hash` 被 Website Domain Consumer 接纳、持久化并签发 business admission receipt，AGENT 才可把任务置为 `completed`。标题成功不能替代该终点，标题失败也不能改变该终点。

本方案范围：

- AGENT 冻结法案与 GPT/Browser 施工图的必要增量；
- 一个 GPT Child：`rename_settled_gpt_conversation`；
- 一个 Browser-owned compound DOM intent 及其现役 WAL/terminal readback；
- GPT Browser lifecycle 的唯一尾部调用点；
- GPT、Browser、Runtime Log 与现有原生质量入口中的必要验收。

明确不在范围：

- 不批量回扫或重命名截图中的历史聊天；
- 不修改 Website task/result wire、数据库或业务完成状态；
- 不移动聊天到 ChatGPT Project，不归档、不删除聊天；
- 不增加重命名 queue、ledger、表、后台 worker、重试器、fallback 或第二 Browser lane；
- 不允许标题参与侧栏猜选、恢复、claim、Provider effect identity 或去重。

## 3. 输入证据与 scoped candidate

### 3.1 当前基线

- 项目根：`/Users/nexgen/Documents/AGENT`；
- branch：`main`；
- HEAD / tracking：`9fde890342b8da12d29dcc79dfb25564e38f4732` / `origin/main`；
- 设计开始时工作树 clean；
- 唯一方案文件：`docs/项目方案/GPT聊天自动重命名-完整实现方案.md`。

写前绑定的关键对象：

| 对象 | SHA-256 |
| --- | --- |
| `.github/instructions/agent-rules/功能法案.md` | `0907113555865559c5b9b26fb8bac82ed9c7dc69fb0e5b3e4106e9c39b8d7365` |
| `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md` | `d12ca17cacde10c1aa0de234b7b52ac16e921a7f0c814c483137495fad6d6859` |
| `docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md` | `cdb3bc19cb9e67af5a34af0434fdcfe94a908e57fa5c0d39d157f09a7481795b` |
| `src/capabilities/gpt/contract.ts` | `bcbab4be37585fe31bd9ac47fb33685c3b9327e4e738ca68bf06c6752c93c4f2` |
| `src/capabilities/gpt/production-child-tools.ts` | `93979821dd88d5cf572603dee7072d1ad23e8d98ef656e26afb2683c2819ad11` |
| `src/capabilities/gpt/production-browser-lifecycle.ts` | `9548ee5f200f84b9c5e478ad3fc4157c53e2955ca28adb8c9f9be2f6c372b90e` |
| `src/lib/browser/exact-target/browser-command-actor.ts` | `d86955e10b70482883e5224c5311b499add44e66fe6e331f21f059d62acc577f` |
| `src/lib/browser/exact-target/browser-mutation-receipt.ts` | `fffa247264f0732c38275c21425d3b17bc68ed8a547b005426418efd3b137ae7` |
| `src/lib/browser/chrome-extension/dom-intent-runtime.ts` | `2ef084cee1703b3560657fde9601972050e643411001b4fe86e33511ab82531c` |

施工前必须重新读取 branch、HEAD、tracking、dirty/untracked overlay 和上述对象；相关漂移只重算受影响部分，命中施工面的用户改动无法区分时停止。

### 3.2 已证实事实

- 用户截图证明侧栏存在“本地化生产翻译”“本地化报告翻译”“本地化文章翻译”等重复、难区分标题；它不证明聊天业务已完成，也不提供重命名控件 DOM。
- 本地只读盘点显示现役 Runtime 有 11 个 `completed` task、1 个 `failed` task；当前 `job_id` 形态为 `aiprod_<UUID>`。这些数字只是 2026-09-14 的现场样本，不是验收分母。
- `src/capabilities/gpt/contract.ts:66` 的现役 Child 合同没有聊天重命名能力；`src/capabilities/gpt/handler-registry.ts` 也没有对应 handler。
- `src/capabilities/gpt/production-browser-lifecycle.ts:132` 在 checkpoint 后记录 settled result，`:241-255` 统一释放当前 GPT Browser session，是唯一不改各 Product Flow 的尾部接点。
- `src/lib/browser/exact-target/browser-mutation-schema.ts:32,44` 只接受 `target_local|provider_effect`，并将真实物理输入数限制为 `0..2`；ChatGPT 重命名所需真实输入数尚无页面证据，不能伪报为 1 或 2。
- 现役 GPT/Browser 法案禁止按标题、侧栏顺序或时间猜测恢复聊天；本方案保留该禁止。改名只操作已经由 current lease 与 canonical URL 锁定的当前 system-owned conversation。

### 3.3 2026-09-14 执行重绑定与真实 DOM

- AGENT 当前 `main` HEAD / tracking 为 `0bf4a1468e8d42e447499d920a403c87f58e1379` / `origin/main`；工作树有 37 个 tracked 修改，并命中 GPT/Browser law、两份 blueprint、manifest、generated registry 与 `production-browser-lifecycle.ts`。
- Website 当前 HEAD / tracking 为 `f67c9f56dd13354d51bb195991270f033e7590e8` / `origin/main`；工作树有 11 个 tracked 修改，并命中 functional law、system/ai-acceptance blueprint、运行与质检文件。
- 双仓两份 active law source、全部 manifest、generated registry 与全部 blueprint 已由主 Codex 两遍只读遍历。AGENT 当前 37 条 active law、13 个 manifest domain、7 份 blueprint 引用相互一致；Website 567 条 active law 已遍历，但 `LAW-AI-ACCEPTANCE-004-V24`、`LAW-AI-ACCEPTANCE-012-V26`、`LAW-AI-ACCEPTANCE-013-V8`、`LAW-PUBLIC-KNOWLEDGE-CONTENT-005-V26` 尚未同步到 registry/相关 blueprint，当前权威投影未闭合。
- 在 Codex 新建的 Chrome 取证页中，当前 conversation row 的唯一菜单按钮 accessible name 为 `打开“<title>”的对话选项`；菜单内唯一 `menuitem` 为 `重命名`；编辑态为 `input[aria-label="聊天标题"][name="title-editor"]`；Enter 提交后编辑态退出且同一 canonical URL 的标题可重新读取。
- 非相等标题的真实交互分母为 4 次物理输入：打开菜单、选择重命名、写入目标标题、Enter 提交；`already_exact` 分支为 0 次。取证只提交了原标题，没有改变任何用户聊天名称；非相等标题的真实改名留给实现后的 dynamic.browser/provider proof。
- 当前 Browser schema 的 `physical_input_count=0..2` 无法诚实表达上述单一 compound transaction，必须在现役 Browser WAL 字段上原位扩到精确 `0..4`；不得增加第二计数字段、第二 WAL 或把一个 rename 拆成多个 GPT Child。
- 当前同仓活跃工单“3TAB+URL 工单模式”和“梳理工单删除与完成规则”仍在修改上述 dirty overlay。它们完成并形成可绑定的 clean candidate 前，本方案仅允许维护本文件，不得修改其拥有的法案、施工图、代码、测试、生成物或数据库。

## 4. 第一直接断裂与四维映射

第一直接断裂不是标题格式错误，而是现役能力分母没有“稳定结果后的非阻断聊天改名”这一原子责任：GPT 没有语义 Child，Browser 没有可一次结算全部重命名步骤的 typed compound intent，lifecycle 也没有 cleanup-only 尾部调用。

| 维度 | 当前事实 | GAP | 目标闭合 |
| --- | --- | --- | --- |
| 法案 | GPT/Browser 冻结了现役 Child、单动作 mutation、恢复不得使用标题 | 未授权 compound cleanup mutation 与非阻断失败语义 | 明确解冻后原位升级 GPT/Browser law；标题永久非权威 |
| 施工图 | settled result 后直接 park；无标题步骤 | 无唯一尾部接点合同 | 在 lifecycle park 前调用一次独立 Child，任何结果都回到原 park 主链 |
| 代码 | 无 Child、handler、typed intent 或 postcondition | 无法安全操作并读回标题 | 一个 Child + 一个 Browser compound intent；不修改 Product Flow |
| 质检 | 现有 GPT/Browser inspector 不认识该动作 | 无法证明不阻塞、无恢复污染、真实 DOM 可用 | 原生 inspector/acceptance + 当前真实 Chrome 动态证明 |

## 5. 唯一标题合同

标题 canonical 格式：

```text
MMDD·<项目短名>·<工单短号>
```

示例：

```text
0914·本地化文章·aiprod_290e5d64
0914·公知文章·aiprod_adfb51c7
```

字段规则：

1. `MMDD`：取该 conversation 最后一个 settled Provider effect 的 Browser terminal time，固定按 `Asia/Dubai` 转换为两位月日；不得取重试时钟、文件 mtime 或 ChatGPT 侧栏日期。
2. `项目短名`：从当前 task 的精确 `product_id` 投影到 Child 内唯一只读显示映射；该映射不参与路由、claim 或业务资格。当前全部 product_id 必须被静态验收一一覆盖。
3. `工单短号`：当前 `job_id=aiprod_<UUID>` 投影为 `aiprod_` 加 UUID 首段八位，例如 `aiprod_290e5d64`。完整 `job_id` 继续只存在于现役 task、Browser identity 与结构化 evidence；标题永远不是唯一身份。
4. 分隔符固定为中点 `·`，整体先做 NFC；不得包含换行、控制字符、首尾空格，最大长度由真实 Provider 页面证明后冻结。
5. 非 `aiprod_<UUID>`、未知 `product_id`、无合法 terminal time 或长度超限时，本 Child 只产生 `GPT_CHAT_RENAME_INPUT_INVALID` cleanup finding 并退出；不得回退为 Prompt 标题、`source_task_id`、hash 猜测或截断碰撞标题。

当前项目短名的目标映射：

| product_id | 项目短名 |
| --- | --- |
| `bazi_ai_full_analysis` | 八字分析 |
| `bazi_chart_interpretation` | 八字解盘 |
| `bazi_report_followup` | 八字追问 |
| `hehun_ai_analysis` | 合婚分析 |
| `hehun_report_followup` | 合婚追问 |
| `localization_article_translation` | 本地化文章 |
| `localization_report_translation` | 本地化报告 |
| `localization_static_catalog` | 本地化文案 |
| `naming_bazi_analysis_and_naming` | 八字取名 |
| `naming_from_existing_bazi_report` | 报告取名 |
| `payment_screenshot_observation` | 支付核验 |
| `public_knowledge_article_pipeline` | 公知文章 |
| `qimen_professional_answer` | 奇门答问 |
| `qimen_report_followup` | 奇门追问 |

同一工单确有多个隔离 conversation 时，允许它们显示同一标题：该标题表达“同一日期、项目、工单”，不承担 conversation 唯一性。精确区分仍只使用 canonical conversation URL 与 Browser identity；不得偷偷增加 step/call/attempt 作为第四段。

## 6. 单一子能力合同与有限分母

唯一新增 Child：`rename_settled_gpt_conversation`。

输入：

```text
canonicalConversationUrl
targetTitle
timeoutMs
```

前置：

- current system Target/Document 仍由同一 Browser lease 持有；
- current URL 精确等于 `canonicalConversationUrl`；
- 当前 conversation 已有 confirmed submit 且 settled result payload hash；
- 没有未结算业务 mutation；
- cleanup 预算不超过施工后冻结的短上限。

Child 内部完整且不可穿插的状态分母：

```text
ALREADY_EXACT
  → fresh title readback exact
  → DONE，physical_input_count=0

CURRENT_CHAT_READY
  → 打开当前聊天唯一 menu
  → 选择唯一 Rename
  → 写入 exact targetTitle
  → 提交保存
  → 2500ms 总闸门后 fresh title readback exact
  → RENAMED，physical_input_count=4

INVALID / MISSING / AMBIGUOUS / STALE / TIMEOUT / TRANSPORT_UNKNOWN
  → typed cleanup terminal
  → 不重试、不导航、不选侧栏、不修改业务结果
  → 回到 lifecycle park
```

一个 Child 可以包含 Browser 为完成同一标题 transaction 所需的多个物理输入，但 Product 和 GPT public facade 只能看见一次 Child 调用、一个 terminal proof 和一个 final readback。Browser 仍逐字节执行机械 DOM 规则，GPT Child 独占标题语义、候选基数和状态判断。

Browser 只新增一个现有 `dom-intent` union 的 typed 分支，例如 `renameExactGptConversation`；不得再新增 command bus、通用脚本执行、selector/坐标 caller control 或第二 Browser API。该 intent 必须一次返回：current URL、旧标题 hash、目标标题 hash、实际物理输入数、final title hash、terminal outcome 和 typed native cause。

## 7. 永不阻塞合同

“永不阻塞”必须由代码和质检同时落实：

1. 唯一调用点在 `ProductionGptBrowserLifecycle` 对 settled conversation 的 park 前；各 Product 不添加 rename 调用或 action ordinal，不改变 Child 顺序。
2. Rename Child 不进入 `ProductGptTools` 公共接口，不成为 Product output、evidence_refs、result parser 或 `context.complete` 的前置。
3. lifecycle 捕获 rename 的全部 terminal：成功只记 observation；失败使用现有 Runtime Log 的 `impact=CLEANUP`，不得重新抛给 Product/Runtime。
4. rename 失败不得进入 `decorateSettledResultFailure`，不得生成 `RESULT_SETTLED_UNUSABLE`，不得触发新 attempt、result revision、Provider submit、Outbox 或 Website write。
5. dedicated compound intent 在 transport 结果未知时，允许仅对该 exact target-local rename row 以 `REJECTED + mutation_outcome=dispatched + GPT_CHAT_RENAME_OUTCOME_UNKNOWN` 结算，并立即把 pending mutation count 归零；该例外不得扩张到 submit、附件、Prompt、模型或任何业务 mutation。
6. 无论 Child 是否成功，`park({mode:"product-call-settlement"})` 都必须执行；park 自身失败仍按现役 Browser infrastructure 规则处理，不能被 rename finding 覆盖。
7. Rename 只在已经持有的业务 Browser lease 尾部运行，不另行 acquire、不排入下一工单之前的独立队列。它会短暂占用当前 lease，这是完成真实页面 mutation 不可删除的物理成本；通过固定短预算和无重试保证不会形成无界阻塞。
8. 若执行剩余预算不足，直接记 `GPT_CHAT_RENAME_BUDGET_SKIPPED` 并 park。不得延长 Website lease 或截留 N1 业务席位。

因此本方案不承诺“所有 Provider 标题最终都成功改名”；它承诺“所有满足前置且预算足够的 settled conversation 都尝试一次，任何结果都不改变主链”。若未来要求最终全量成功，必须另行授权一个可持久重试的外部整理业务；那是不同需求，不能偷偷塞入本方案。

## 8. 原子施工工单

### WO-01：取得 authority 与真实页面证据

Owner：授权人 + GPT page-evidence Owner。

- authority 已由授权人明确批准：允许修改必要法案、施工图、代码、质检系统和数据库；法案系统只做本能力不可删除的语义增量。
- 已在 agent-owned Chrome 取证页采集 rename 的 row/menu/edit/submit 后 DOM、可访问名称、candidate cardinality 和真实物理输入数；没有修改用户聊天标题。
- 不读取或操作操作者私有 Tab，不批量改历史标题，不把样本 selector 直接当稳定合同。

完成门：authority 原文已批准；真实 DOM 支持一个无歧义 compound intent；实际输入数为 4，必须由 Browser 原位扩展现役计数上限并在实现后完成非相等标题的动态终验。WO-01 已完成设计取证，施工仍受 3.3 的并发候选阻断。

### WO-02：原位升级冻结 authority

Owner：GPT governance + local-browser-session governance。

允许修改：

- `.github/instructions/agent-rules/功能法案.md`；
- `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md`；
- `docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md`；
- 对应现有 GPT/Browser inspector 与 manifest lawId 投影。

必须冻结：一个 Child、一个 compound intent、标题非权威、CLEANUP failure、短预算、无重试、无第二队列、pending rename 可终局释放、业务完成不受影响。不得改变 Website V6 blueprint、task/result contract 或 admission receipt。

### WO-03：Browser compound intent 与现役 WAL 结算

Owner：local-browser-session。

核心施工面：

- `src/lib/browser/exact-target/browser-dom-intent.ts`；
- `src/lib/browser/exact-target/browser-command-actor.ts`；
- `src/lib/browser/exact-target/browser-mutation-receipt.ts`；
- `src/lib/browser/exact-target/browser-mutation-types.ts`；
- `src/lib/browser/exact-target/browser-mutation-schema.ts`；
- `src/lib/browser/chrome-extension/dom-intent-runtime.ts` 及仅由真实 DOM 证明必需的同域文件；
- 现有 local-browser acceptance/inspector。

WO-01 已证明真实输入数为 4：原位把同一 `physical_input_count` 列上限从 `0..2` 扩大到精确 `0..4`，并提供现有 Browser WAL 的单向事务迁移、全行 readback 与旧 schema 物理退出；不得新增计数列、rename 表、第二 WAL 或双读。

### WO-04：唯一 GPT Child

Owner：GPT capability。

允许新增/修改：

- `src/capabilities/gpt/children/rename_settled_gpt_conversation/**`；
- `src/capabilities/gpt/child-types.ts`；
- `src/capabilities/gpt/contract.ts`；
- `src/capabilities/gpt/handler-registry.ts`；
- 现有 GPT inspector/acceptance。

Child 目录内部可以有 selector、observation、handler 和 title projection 文件，但这些只是同一 Child 的私有实现，不是额外子能力。它必须产生唯一 terminal proof；不得复用或调用 prepare/menu/write/keypress 等其它 GPT Child。

### WO-05：唯一 lifecycle 接点

Owner：GPT production lifecycle。

允许修改：

- `src/capabilities/gpt/production-child-support.ts`：只补充生成标题所需的 `productId`；
- `src/capabilities/gpt/production-child-tools.ts`：构造内部 cleanup 调用，不向 Product 暴露；
- `src/capabilities/gpt/production-browser-lifecycle.ts`：在每个 settled session park 前调用一次并吞掉 cleanup finding；
- `src/lib/local-runtime/production/executor.ts`：只把 task 的 `product_id` 交给现有 GPT execution construction。

不得修改任何 `src/plugins/**/flow.ts`。这条负约束证明 rename 没有与 Product Child 流程交叉，也避免 14 个 Product 各自复制一遍调用。

### WO-06：原生质量与真实验收

Owner：各现役质量域；只使用仓库唯一 `quality:check` verdict。

顺序：

1. GPT contract/handler/denominator acceptance；
2. Browser compound mutation、WAL terminal、输入计数、unknown outcome release acceptance；
3. Runtime Log `CLEANUP` 投影与不覆盖 park failure 的 acceptance；
4. architecture/code-purity negative scan，证明 Product Flow、Website contract、第二 queue/store 均零变化；
5. `npm run quality:check -- CHANGE`；
6. clean commit 后按 active law 执行 READY；
7. 获得真实 Chrome 授权后执行 dynamic.browser/provider proof。

READY 不等于 RELEASE，标题改名成功也不等于业务入库。

## 9. 分层验收

静态/Exam 必须证明：

- Child ID、handler、input/output/contract 一一对应且仅新增一个；
- `src/plugins/**` 对 rename Child 的调用数为 0；
- lifecycle 唯一调用数为 1；
- title builder 对当前全部 product_id 有且只有一个项目短名；
- invalid title 不回退、不截断、不改变任务；
- rename error 的 Runtime impact 恒为 `CLEANUP`；
- rename path 到 `RESULT_SETTLED_UNUSABLE`、Website write、Outbox、retry/result revision 的可达边数为 0；
- 每个 terminal 分支最后都执行原 park；
- 标题读取从不参与 canonical conversation 选择、恢复或 submit qualification；
- rename queue/table/worker/second lane 数为 0。

真实 Chrome 动态证明至少覆盖：

1. 初始标题非目标值：一次 Child 调用完成全部交互并 exact readback；
2. 标题已精确相等：零物理输入；
3. menu missing、candidate ambiguous、DOM stale、输入框不可写、保存未生效、transport 断开和预算不足：各自产生 typed cleanup terminal，下一工单仍可领取并执行；
4. rename 进行时不得穿插其它 GPT Child；
5. 同一 job 的 Provider submit 数、result hash、Outbox 和 Website admission 与关闭 rename 时完全一致；
6. 真实 Website admission/readback 成功，证明主链未被标题动作污染；
7. 任一失败样本后 Browser pending mutation 为 0、lease 已 park、下一 fresh chat 不继承 rename 菜单/编辑态。

## 10. 删除反事实

必须保留：

| 单元 | 当前必要性、消费者与删除失败 |
| --- | --- |
| 一个 rename Child | 用户要求一个独立原子能力；lifecycle 是唯一消费者。删除后没有标题语义 Owner |
| 一个 compound DOM intent | 单 Child 必须完成多步真实 UI transaction；Browser 是唯一机械消费者。删除后只能拆成多个交叉 Child 或绕过 Browser authority |
| lifecycle 尾部接点 | 覆盖所有 Product/所有 session 且不改 Product Flow。删除后只能逐 Product 复制或漏改 |
| title display mapping | 把 canonical product_id 投影为可读项目名，Child 是唯一消费者。删除后不能满足“项目”可读要求 |
| 现役 WAL terminal/readback | 证明物理动作和最终标题，Browser/质量系统消费。删除后 outcome unknown 会冒充成功 |
| CLEANUP impact | Runtime Log 与生命周期用它证明不阻断。删除后 rename failure 会被默认分类为 BLOCKING |

已删除或禁止：Product 逐一调用、四个 menu/edit/save Child、rename retry queue、rename 表、后台 worker、标题 recovery、ChatGPT Project 归档、历史批量回扫、Website 字段、第二 quality verdict、兼容桥和 feature flag。它们都不是当前非阻断一次性整理的必要结构。

## 11. 停止、回退与执行重绑定

- 当前 AGENT/Website 并发 dirty overlay 未由各自工单完成并形成可绑定的 clean candidate 前停止施工；不得把其它工单差异混入本方案 commit，也不得从旧 HEAD 另建第二 authority 分支。
- 若真实 DOM 无法在一个有界 compound intent 内精确读回标题，返回授权人；不得拆成多个 GPT Child 绕过用户的单 Child 决定。
- 若无法证明 rename 的未知结果可在不污染业务 mutation 的前提下释放 pending row，则停止；不得以吞异常假装永不阻塞。
- 若唯一实现必须建立独立 retry queue/store 才能保证最终全量成功，按本方案优先保留“永不阻塞”并放弃最终保证；需求变更需另行设计。
- 回退只移除本方案施工产生的 law/blueprint/code/test/projection 差异；不覆盖 Browser WAL、业务 task、Provider 聊天或用户无关改动。
- 执行 Codex 开工前必须重新绑定 HEAD、dirty overlay、active law/registry、两份 blueprint、Child denominator、Browser WAL schema、原生 `quality:check` 和真实页面证据；任一相关漂移先重开受影响设计。
