---
document_type: project_scheme
scheme_id: GPT_PAGE_DOM_MINIMUM_FACT_REDUCTION
scheme_name: GPT页面DOM：submit 失败根因（P0）、最少充分事实减法（P1）与真实页面对齐缺陷（P2）
status: 设计阻断（P0 根因已定位为 D2，其修复 WO-P2-2 已按 U4 施工（生产生效需重载扩展）；P1 的 WO-P1-1/P1-3 待授权 U2；P2 的 WO-P2-3 待设计；WO-P1-2/P1-4 不受阻断，WO-P2-1 已落地）
created_at: 2026-09-25
updated_at: 2026-09-26
owner_repo: ADVISION-X/AGENT
owner_domain: gpt
candidate_branch: main
candidate_agent_head: 73dee43c4dd2b3ff35deab434fc69855e3ad5963
production_semantic_baseline: a66c3d2d0b9282d3ff029e5227d3976baa65b15a
scheme_head_before_this_revision: c3d81c1df8d64139a5c9ed889da48119148c8f10
scheme_blob_before_this_revision: f28cc400733dc79271604256244df2a8b3e23833
website_baseline: 01664ae8518eaec49ac0af5d142c758a1a219fd9
implementation_mode: evidence_first_then_subtraction
skill: 闭环实现设计-SKILL + agent-flow-boundary-gatekeeper
audit_verdict: 上一版 PASS_TWO_PASS 不成立；已在本文件内原位修正；P0 根因已由真实页面采集与 WAL 定位（§10.3）；WO-P1-1/P1-3 未取得 U2 前不得施工对应工单
---

# GPT 页面 DOM 更新与工单恢复－完整实现方案

## 0. 本版唯一裁决

本文件仍是本 GAP 的**唯一现役方案**（同路径原位更新，不新建第二份；文件名沿用，标题与内容为 DOM 恢复方案）。

上一版的中心命题——“七寸是 GPT Child 替兄弟/后继/Browser 证明过多事实，先做 profile/model/attachment 减法即可消除重复失败”——**被本机生产日志与 Browser 变异库推翻**（§1、§2）。本版拆成两本互不依赖的账：

| 账 | 内容 | 状态 | 与已发生故障的关系 |
|---|---|---|---|
| **P0** | `submit_exact_gpt_turn_once` 点击已发出，点击后读取“刚提交的用户回合”失败（§10.3；此前“点击前候选被拒”的判断已更正） | 根因已定位为 D2；修复 WO-P2-2 已按 U4 施工 | **是**当前唯一实证的第一直接断裂 |
| **P1** | profile / model / attachment 的复合判据瘦身（依 V18） | 分项：WO-P1-2、WO-P1-4 不触及任何冻结行，不受 U2 阻断；WO-P1-1、WO-P1-3 及文档同步需授权 U2 解冻拓扑图 G03/G07/G08 | **不声称**修复任何已发生的生产循环 |

预算沿用并收紧：新表 0、新字段 0、新持久状态 0、新 Child 0、新 queue/manager/scheduler/recovery owner 0、新 Browser 通用 API 0、新 selector fallback/双读/兼容桥 0、新计数型 inspector 0、Website 生产改动 0、Provider submit 额外次数 0。

## 1. 独立复核：上一版断言 vs 现役事实

| # | 上一版断言 | 结论 | 证据 |
|---|---|---|---|
| 1 | 第一直接断裂是 `open_gpt_execution_profile` 的 6 个 query | **不成立** | §2：该 Child 在 Browser 层 16/16 CONFIRMED；submit 才是 12/12 被拒 |
| 2 | AGENT 根失败集中在 profile/model/attachment | **不成立** | 同上；三片成功率 ≥85%，且同一链路上反复成功 |
| 3 | submit 不是七寸，“不动” | **与现场相反** | submit 是唯一 100% 失败点；且它**没有任何 GPT 预读**（`submit_exact_gpt_turn_once/handler.ts:130-148`），“前置事实过多”无法解释它 |
| 4 | Website 0 修改；capacity 不是故障 | 成立 | claim/lease 正常；新一轮出现 `claimed_count=2` |
| 5 | “现役 `postClickMatch` 对 exact model + `aria-checked=true`” | **与现役不符** | 现役 `select_gpt_model_from_start_v3` 用 `postClickObservation` + `clickedCandidateAttribute`（`handler.ts:17-22,44-52`）。`postClickMatch` 与 `postClickAttribute` 都是**点击后按选择器重新查询**（`dom-mutation-postcondition.ts:236-300`），只有 `clickedCandidateAttribute` 读保留节点（`dom-pointer-intent-runtime.ts:336-344`）；把 G16 换成重查原语，对“选中后高级视图收起”的主路径不安全 |
| 6 | “模型菜单必须关闭”是假门（14 条冲突，真实 QA 反证） | **不成立** | (a) 出处只是页面证据 SKILL 的采集比较器对“点击已选中项”这**一个**场景的记录（`.agents/skills/gpt-page-operation-evidence/SKILL.md:131`）；(b) 生产上 model-select 12/13 CONFIRMED，覆盖 `GPT-5.6 Sol` 与 `最新` 两档，含 `最新`（已选中）首次即 CONFIRMED（job `aiprod_2ecfc2ce…`）；(c) `GPT_MODEL_V3_MENU_CLOSE_INVALID` 在本机近 6 天全部运行日志出现 0 次；(d) QA 说的“菜单持续 `data-state=open`”是**弹层**，冻结语义要求的是“**模型列表（高级视图）**关闭”，弹层本就保持 open 以便 G17 直接读滑杆（GPT Blueprint L70） |
| 7 | 动作前 transient 只复用现役 1.5s/3s | 半对 | GPT 层容错只包住 `observe` 读（`gpt-dom-observation.ts:173-241`）；Browser click 准备阶段另有瞬态确认（`dom-pointer-intent-runtime.ts:56-72,277-319`）；但 submit 走 `prepareExactOutgoingClick`，只对 `disabled/aria-disabled` 在 5s 内重试（`:257-275`，即 `FROZEN-GPT-SUBMIT-ACTIONABILITY-WAIT-001`） |
| 8 | active law 语义修改 0；三处旧文义施工时“原位删” | **不成立** | G16 是冻结条文 `FROZEN-GPT-MODEL-SELECTOR-SEMANTIC-MINIMUM-001`（GPT V66 L70、Browser V54 L49，均注明“按明确授权解冻、原位替换并重新冻结”）；拓扑图 v8 是授权人批准并带规范化 SHA-256 的冻结文档（§12，批准 2026-09-24T00:06:42+04:00）；上一版漏了 G07（“composer usable”）与 G08（“unique menu/leaf”）两行 |
| 9 | V18 要求删这些 query/字段 | **转述过宽** | V18 原文限制“三个及以上彼此可独立失败的**阻断判据**”与“包装成单一布尔值”，并明写“DOM 字段、诊断字段和非阻断观察数量不受此数值限制”（`功能法案.md:552`）。现役 profile 开/关复合布尔、model 预读复合 `if` 确属违规；`ariaExpanded` 字段、`previousChecked` 输出不是 V18 义务 |
| 10 | 反膨胀 mutant：重加第三个 sibling query 必须 FAIL | **不采纳** | 现役无计数型 inspector；按 V18 计数 query 本身不是判据；新增即新治理机制且无真实消费者 |
| 11 | 条件式条款（“若无其它消费者则删文件，否则收窄”等） | 已改定 | §4.2 依消费者核查给出确定裁决 |
| 12 | 无前轮连续性裁决 | **缺失，已补** | §4.1 |

## 2. 现场事实（可复现）

### 2.1 来源与口径

- Browser 变异库（权威持久存储）：`.grasseye-local/browser/browser-mutations.sqlite`，表 `browser_mutations`（`child_capability_id, state, reason, native_cause_code, physical_input_count, updated_at`）。
- 运行日志：`.grasseye-local/runtime-logs/agent/*.jsonl`；把 `gpt.child` / `browser.command` 的 `span.terminal` 按 `spanId` 回连 `span.started.typedIdentity`（含 `childCapabilityId / capabilityCallId / actionOrdinal`）。
- 两者均为 gitignored 本机数据，只读使用；查询前先拷贝副本。窗口起点 2026-09-25T12:35Z（`70d41305f` 之后）至 23:12Z。日志按 GPT Child 尝试计、WAL 按已 PREPARED 变异计，数量略有差异、方向一致，**以 WAL 为准**。

### 2.2 各 Child 的 WAL 结果（2026-09-25T12:35Z–23:12Z）

| Child | CONFIRMED | REJECTED |
|---|---|---|
| open_gpt_execution_profile | 16 | 0（另有 1 次 GPT 层点击前 `…OPEN_QUALIFICATION_INVALID`） |
| open_gpt_model_selector_v3 | 14 | 2 |
| select_gpt_model_from_start_v3 | 12 | 1 |
| select_gpt_reasoning_from_start_v3 | 12 | 0 |
| close_gpt_execution_profile | 12 | 0 |
| open_gpt_attachment_control / attach_approved_gpt_files_once | 1 / 1 | 0 |
| write_exact_gpt_prompt | 12 | 0 |
| **submit_exact_gpt_turn_once** | **0** | **12** |

### 2.3 submit 的 12 次拒绝

- 12/12：`reason=BROWSER_DOM_CANDIDATE_MISSING`，`native_cause_code=NULL`，`mutation_outcome=dispatched`（点击已发出；`physical_input_count=0` 只是该拒绝路径不更新计数，**不是**“未点击”）；`action_ordinal` 10（无附件路径）×11、13（含附件路径）×1；动作均为 `browser.dom.click.v1`，`effect_scope=provider_effect`。
- 最后一次 CONFIRMED submit：`2026-09-24T00:59:52Z`（旧选择器 `#composer-submit-button[data-testid='send-button']`）。`3016fe43e`（2026-09-25 07:13 +0400）把 submit/write 的选择器整体换成新 DOM 后，**没有一次真实 submit 成功**；首次生产运行为 `2026-09-25T19:51Z`。此前 09-24T01Z–09-25T19Z 无 submit 尝试。
- 同一次执行里，submit 之前的 prepare → profile 开 → 模型入口开 → 模型选择（`GPT-5.6 Sol`）→ 推理 → profile 关 → 写入 Prompt **全部 CONFIRMED**（例：`a768dec0` 于 23:11–23:12Z 完整走完再在 submit 被拒）。
- 时间特征无诊断价值：每个 Browser 变异的 DISPATCHED→终态本身约 4 秒（成功者同）。

### 2.4 profile / model / attachment 三片的真实失败（P1 的全部现场依据）

profile open 点击前 GPT 层 `…OPEN_QUALIFICATION_INVALID` ×1（具体 `topologyCode` 未落盘）；model-open ×2（Browser：`CANDIDATE_MISSING/SELECTOR_ABSENT` 0 输入 ×1；`POSTCONDITION_FAILED` 1 输入 ×1）；model-select ×2（GPT 层 `…CANDIDATE_NOT_PROVEN` ×1，发生在同一 job 的续跑尝试；Browser `DOM_NODE_STALE` ×1）；attachment 0。除 job `614f7414` 的续跑尝试外，上述失败之后同一 job 的下一次尝试都走到了 submit；`614f7414` 该次失败后转入 Runtime source handoff 的独立账（§2.5-3）。三片合计只有 5 次失败，对比 submit 的 12/12。

### 2.5 未证明项（不得当作事实使用）

1. submit 拒绝的 stage / native cause：12/12 为 NULL。同一 `markRejected` 写入路径对 model-open 的同码拒绝写下了 `BROWSER_DOM_SELECTOR_ABSENT`，说明**此路径的拒绝回执本身没带 stage**（`browser-command-actor.ts::completeMutation` → `browser-mutation-store.ts::markRejected` 原样写 `result.nativeCauseCode`）。回执为何缺 stage，本次审计只读代码未能确定。
2. 发送按钮在失败时刻的真实 DOM 状态：本机无该窗口的 exact-call 取证落盘。
3. `PRODUCTION_SOURCE_HANDOFF_REQUIRED` 反复出现在旧 job（`614f7414`、`ba48dcd8`）：属 Runtime source seal 的独立账，本方案不触碰。

## 3. P0：submit 点击后读取用户回合失败（根因见 §10.3）

### 3.1–3.4 已由 §10.3 取代

原“点击前候选缺失”的第一直接断裂、H1–H5 假设集、WO-P0-1 取证与 WO-P0-2 判别表，均建立在把 `physical_input_count=0` 误读为“未点击”之上，已物理删除。P0 唯一动作是 §10.4 的 WO-P2-2。

### 3.5 必须保留的防回归不变量

`FROZEN-GPT-SUBMIT-TWO-PRECONDITIONS-001`（提示词 hash + 精确附件集合两门，不得再增发送资格）；exact outgoing turn 校验；Provider submit 至多一次；Browser current Target/Document/fence 与唯一 WAL；候选缺失零输入 fail-close。

### 3.6 有限分母（submit 分支）

`CONFIRMED` → 精确回答 checkpoint → Runtime Outbox → Website Domain admission → completed；`REJECTED` 且物理输入 0 → typed failed，Runtime 释放租约，Website 原 demand 继续；`DISPATCHED` 未决 → 保留 WAL，只允许同 effect 零 submit 读回，禁止重放。各分支 Owner、readback 沿用现役合同，本方案不改。

## 4. P1：DOM 最少充分事实减法（独立账；WO-P1-1/P1-3 须先获 U2）

### 4.1 前轮连续性裁决

| 前轮 | 真实 GAP / 落地 | 仍适用的不变量 | 本轮决定 |
|---|---|---|---|
| `430f56d33`（2026-09-16）fix(browser): confirm transient GPT DOM failures | 吸收瞬态 DOM 失败：GPT `readConfirmedCoherentObservation`（0/1.5s/3s）与 Browser `readWithTransientDomConfirmation`；拓扑图 v8 的有限事实筛查亦点名该轮 | 动作前后的读用有界 fresh 确认吸收瞬态 | **保留**。P1 只删“复合判据”，不删读与确认阶段；被删预读的 Child 若不再有观察读，瞬态由 Browser click 准备阶段（`dom-pointer-intent-runtime.ts:277-319`）与 `attachFile`（`extension-file-input-runtime.ts:184`）承担 |
| `aa550261c`（2026-09-22）evidence-gated model/reasoning v3 | 引入 `selected-model-count`、`GPT_MODEL_V3_MENU_CLOSE_INVALID`，冻结 G15–G17；旧方案《模型和推理强度自动配型》自述“真实页面及生产业务完成尚未验证” | G16：无论是否已选中都点击一次；核点击节点选中且模型列表关闭；G17 紧接 G16 | **保留** G16 冻结语义与现役后置；仅删 GPT 层预读复合（Browser 已验 disabled/inert/唯一）。“模型列表关闭”的删除**不在本方案**（无生产反证；需 U3） |
| `3016fe43e` / `f306447f1` / `70d41305f`（2026-09-25）DOM 对齐与减检 | 选择器换新 DOM；`70d41305f` 已是一轮减法 | — | 与 P0 直接相关；P1 不重复其已删部分 |

### 4.2 逐项裁决

| 项 | 现役事实 | 裁决 | 依据 / 授权 |
|---|---|---|---|
| `open_gpt_execution_profile` | `profileOpenReady`=6 行 raw/eligible=1 ∧ 强度刻度 ∧ 展开 ∧ id ∧ 弹层标签匹配；`profileOpenable`=5 行 0/0（`observation.ts:125-138`）；点击后同一复合（`:54-59`） | **删复合 → 单事实**：唯一 trigger + `aria-expanded`；后置 `postClickAttribute{aria-expanded,true}`（trigger 点击后仍可见）；保留一次 `readConfirmedCoherentObservation`（仅 trigger 查询） | V18 复合布尔；推理控件由 reasoning Child 自读（`select_gpt_reasoning_from_start_v3/observation.ts:26-32,78-81`）。G03 行含“min=0，整数 0<=now<=max<=5” → **U2** |
| `close_gpt_execution_profile` | `profileClosedReady`=popup 0 ∧ trigger 1 ∧ expanded false ∧ id ∧ composer 1（`observation.ts:51-53`） | **删复合 → 单事实**：trigger `aria-expanded=false`；后置 `postClickMatch{TRIGGER+"[aria-expanded='false']",1}`（`postClickAttribute` 仅支持 `equals:"true"`，`browser-dom-intent.ts:147-151`） | composer 由后继 `write_exact_gpt_prompt` 自读（12/12 CONFIRMED）。G07 行含“composer usable” → **U2** |
| `open_gpt_model_selector_v3` | 2 个查询，DONE=1 事实，ACT=2 事实 | **保持不动** | 合规；`ariaExpanded` 是非阻断字段，V18 不要求删 |
| `select_gpt_model_from_start_v3` | 预读复合 `handler.ts:36-43`（name/count/ariaDisabled/disabled/inert/checked/selectedRawCount）；`previousChecked` 输出（`child-types.ts:100`，无任何生产读者，仅 3 处测试/夹具） | **删**预读复合、`selected-model-count` 查询、`GPT_MODEL_V3_CANDIDATE_NOT_PROVEN`、`previousChecked`；**保留**现役后置（`postClickObservation` 的模型列表 eligible=0 + `clickedCandidateAttribute`）与 `…SELECTED_FACT_INVALID/…MENU_CLOSE_INVALID` | Browser `retainedPointerAction` 已验 disabled/inert/aria-disabled/可见/命中（`dom-coherent-candidate.ts:138-158`），`expectedTextEquals`+`expectedMatches:1` 保证不换模型；点击瞬态由 Browser 准备阶段承担；**不得**改用 `postClickMatch/postClickAttribute` |
| `select_gpt_reasoning_from_start_v3` | 2 查询，参与 `min(requested,max)` 计算 | **保持不动** | 有真实消费者 |
| `open_gpt_attachment_control` | 3 查询；`attachmentControlReady/Openable` 复合（`observation.ts:35-50,106-126`）；`active-menu` 与 `upload-choice` 的 scope 合格性重复 | **删** `active-menu` 与复合 → DONE=`upload-choice` 精确合格 1，否则点击 exact control；后置 `upload-choice` eligible=1 | V18 复合布尔。G08 行“unique menu/leaf” → **U2** |
| `attach_approved_gpt_files_once` | `control-observation.ts` 是 open-control 观察的第二份重复副本（2 查询版），仅本 Child 使用；handler 在 `attachFile` 前重复证明 upload-choice（`handler.ts:46-50`） | **物理删除 `control-observation.ts`** 及 handler 对 `readAttachmentControlState/attachmentControlReady/failAttachmentControl` 的使用；ACT 的 `declaredFacts`（现取自 `control.facts`，`handler.ts:68-73`；`declaredFacts` 必填 `factResultIds/candidateCardinality/authorityRefHashes/observationRevisionHash`，`web/child-handler.ts:151-158`）改由外来附件门 `assertNoForeignComposerAttachments`（现返回 `void`）返回其已有的 attachment-set 观察事实提供 | Browser `attachFile` 已验 activation 选择器/scope/文本与 file input，且对候选缺失有瞬态（`extension-file-input-runtime.ts:184`）；外来附件门必须保留 |
| `prepare_clean_gpt_chat` / `write_exact_gpt_prompt` / `submit_exact_gpt_turn_once` / `checkpoint_*` | — | **不动**（P0 的 submit/write 修复见 §3） | — |

### 4.3 授权门

- **U2**：授权人明确批准解冻并改写拓扑图 v8 的 G03、G07、G08 三行（重新冻结为 v9 并记录新规范化 SHA-256），以及 GPT V66 / Browser V54 Blueprint 中对应 G03/G07/G08 的句子。G16 冻结句**不改**。Registry 重建仅作机械结果，不改 law 义务；active law 义务改动目标为 0。仅 WO-P1-1（G03、G07）与 WO-P1-3（G08）需要；WO-P1-2 保留 G16 冻结语义，WO-P1-4 不触及 G09 行，均不需要。
- **U3**（不在本方案，暂不申请）：解冻 `FROZEN-GPT-MODEL-SELECTOR-SEMANTIC-MINIMUM-001` 以删“模型列表关闭”。前提：出现真实生产 `BROWSER_POSTCONDITION_FAILED`/`MENU_CLOSE_INVALID` 反证，且 Browser 能在无载体 query 下读保留节点。
- 历史方案《模型和推理强度自动配型》不得被本方案 supersede，直至 U3。

### 4.4 工单与允许路径

每张工单**同一变更内**同步自己的 inspector 字面 token 与验收夹具（inspector 现以字符串 token 钉死现役实现形状），不留给后续工单。

| 工单 | 授权 | 允许修改 | 物理删除 / 同步 |
|---|---|---|---|
| WO-P1-2 model select | 无需 U2 | `src/capabilities/gpt/children/select_gpt_model_from_start_v3/{handler,observation,selectors}.ts`、`src/capabilities/gpt/child-types.ts`；夹具 `scripts/acceptance/product-plugin-test-runtime.ts:141`、`scripts/acceptance/product-plugins/public-knowledge-article-pipeline.test-runtime.ts:50`、`src/capabilities/gpt/acceptance/gpt-exact-target-model.acceptance-support.ts`；inspector token `scripts/audit/domains/gpt/{inspector.ts:272-275, gpt-contract-inspection.ts:279-281}` 中的 `readModelChoiceState` | `readModelChoiceState`、`selected-model-count`、`previousChecked`、`…CANDIDATE_NOT_PROVEN` 及只为它们存在的夹具；`clickedCandidateAttribute`、`selectedReadbackValid`、`modelChoiceQuery`、`expectedEligibleCount` 相关 token 与代码**保留** |
| WO-P1-4 attach | 无需 U2 | `…/attach_approved_gpt_files_once/{handler,attachment-observation}.ts`；`src/capabilities/gpt/acceptance/gpt-attachment.acceptance.ts`（净行数 ≤0） | 物理删除 `control-observation.ts`，同步删 `scripts/audit/domains/gpt/gpt-inspection-child-paths.ts:48`、`gpt-attachment-contract-inspection.ts:18` 的路径引用 |
| WO-P1-1 profile 开/关 | U2（G03、G07） | `…/{open,close}_gpt_execution_profile/{handler,observation,selectors}.ts`；inspector token `gpt-contract-inspection.ts:297-306`、`inspector.ts:304-315` 中的 `profileOpenReady/profileOpenable/profileTopologyQueries/profileDisposition`；`src/capabilities/gpt/acceptance/{gpt-exact-target.acceptance.ts, gpt-exact-target-profile-fixture.ts}`；拓扑图 G03/G07 行与两份 Blueprint 对应句 | 两目录内因此失去消费者的 popup/simple-panel/reasoning-* 选择器与投影；`select_gpt_reasoning_from_start_v3/` 自有副本不动 |
| WO-P1-3 attachment open | U2（G08） | `…/open_gpt_attachment_control/{handler,observation,selectors}.ts`；同上验收；拓扑图 G08 行 | `active-menu` 查询、`GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR` 中不再被引用者与复合判据 |

Child id、Product action ordinal、Website wire、Provider effect identity 不变；**不递增** Child `contractVersion`（`inspectChildContractVersions` 只校验版本号与 inputSchema 后缀，本改动不触及）。

结构承载（`基础法案.md:36`：文件 ≤500 物理行，函数 ≤75 行）：`gpt-attachment.acceptance.ts` 499、`gpt-contract-inspection.ts` 484、`inspector.ts` 479 均贴近红线，**这些文件的净行数必须 ≤0**；P1 全为减法，不预设拆分。

### 4.5 质检：只反转现有断言

- 必须存在的反例：选择器缺失/多义/不可操作 → Browser 零输入失败；外来附件卡片 → GPT 层零上传失败；`attachFile` activation/file-input 不成立 → 零上传；model 点击后 `clickedCandidateAttribute` 缺失或错值 → 失败（现役）。
- 不写：固定“六个 profile query 必齐”“active-menu 必存在”的夹具；不新增计数型 inspector。

## 5. 授权与候选绑定

| 编号 | 需授权人裁决 | 阻断 |
|---|---|---|
| **U2** | 解冻拓扑图 G03/G07/G08 与对应 Blueprint 句（G16 冻结句不改） | 仅 WO-P1-1、WO-P1-3 |
| U3 | （暂不申请） | 删“模型列表关闭” |
| **U4** | **已获授权人批准（2026-09-26）**：删除四处条文里的“无元素子节点”限定——`LAW-LOCAL-BROWSER-SESSION-004-V55`（`功能法案.md:1087/1097`）与 `-006-V41`（`:1165/1166`）；分别升 `-004-V55`、`-006-V42` 并 supersedes 前版；改法案需 `GRASSEYE_LAW_AMENDMENT_AUTHORIZED=1` | WO-P2-2 |
| U5 | （待 WO-P2-3 设计后再申请，可能不需要） | WO-P2-3 |

**候选绑定（W0）**：AGENT `main@5359d497c`（= origin/main）；`src/capabilities/gpt/children/**` 与 `src/lib/browser/**` 相对 `a66c3d2d0` **无差异**，两者之间仅 `gpt-proof.acceptance.ts`、新增 `gpt-rate-limit-closure.acceptance-support.ts`、`runtime-loops.ts`、若干验收支持文件与 `gpt-provider-contract-inspection.ts:78` 一个 token。Website `01664ae85`（干净）。Runtime/Website 侧无改动。施工前只重算 §4.4 所列路径及其直接 authority/质检依赖。

现役法案：`LAW-CAPABILITY-GOVERNANCE-001-V18`、`LAW-GPT-001-V63`、`LAW-GPT-002-V29`、`LAW-LOCAL-BROWSER-SESSION-004-V55`、`…-006-V42`（均已核对为现役，版本一致）。

## 6. 动态验收（P0 优先）

代码施工与 AGENT 原生 `quality:check -- CHANGE/READY` 通过后，用三类真实 job 各至少一次（保留原 `job_id`，不建 replacement）：两个 `localization_static_catalog`、一个 `localization_article_translation`。

1. P0：WAL 读到 `submit_exact_gpt_turn_once` 至少一次 `CONFIRMED`，且 Provider submit 次数不超过合同。
2. P1：profile/model/attachment 在同链路上不因被删事实产生 BLOCKING；真正的 selector 缺失/多义/actionability 仍零输入 typed fail-close；model select 每次至多一次物理 click。
3. 终点读回，不得停在 Child success / plugin success / claim 200：

```text
same job_id + result + Runtime Outbox settled + Website result admission
+ Domain consumer receipt + business consumption/object readback + status=completed
```

## 7. 删除反事实

| 对象 | 删除后是否破坏正确性 | 裁决 |
|---|---|---|
| Target/current Document/WAL、Browser actionability、候选缺失零输入 fail-close | 会 | 保留且只一份 |
| GPT 1.5s/3s 与 Browser click 准备阶段瞬态确认 | 会降低瞬态容忍 | 保留 |
| profile 的 popup/simple-panel/reasoning 复合判据 | 不会（后继自读） | 删（U2 后） |
| profile close 的 composer/popup 条件 | 不会（write 自读） | 删（U2 后） |
| model 预读复合、`selected-model-count`、`previousChecked` | 不会（Browser 已验；无读者） | 删 |
| model 后置“模型列表关闭”+ `clickedCandidateAttribute` | **会**（G16 冻结；G17 交接；`postClickMatch/Attribute` 重查不安全） | **保留** |
| `active-menu` 查询、attach 前 control 预读及 `control-observation.ts` | 不会（`upload-choice` 已含 scope 合格性；`attachFile` 自验） | 删（`active-menu` 需 U2） |
| 外来附件集合门、submit 两门、exact prompt/附件、WAL once | 会 | 保留 |
| 计数型反膨胀 inspector | 不会（V18 不以 query 数量为判据） | 不新增 |

## 8. 施工顺序与停止条件

顺序：账互不依赖。P0：WO-P2-2（U4 已批准）。P1：WO-P1-2、WO-P1-4 可直接施工；U2 → WO-P1-1、WO-P1-3。各账均：AGENT 原生 `quality:check -- CHANGE` → clean commit → `READY` → §6 动态验收。P1 不得先于或代替 P0 宣称业务闭环。Website 不施工。

出现以下任一情况立即判方案被污染并停止：

- 为 P0 猜修 submit（放宽 selector、fallback、加 retry、扩大 submit 等待）——P0 的唯一动作是 WO-P2-2；
- 未经 U2 修改拓扑图/Blueprint，或未经 U3 触碰 G16 冻结句；
- 把 P1 表述为修复 submit 循环；
- model select 改用 `postClickMatch/postClickAttribute`；
- 新增表、字段、持久 enum/state、Child、Browser 通用接口、retry/recovery manager、selector fallback/第二 selector registry、计数型 inspector；
- 为解决候选缺失修改 Website claim/capacity；把 `BUSINESS_CAPACITY_EXHAUSTED` 当故障；把 `current_reason` 拉回控制链；顺手改 Runtime source handoff（独立账）。

## 9. 本版验收裁决

- 法案：V18 义务已按原文收窄；active law 义务改动 0。
- 施工图/拓扑：WO-P1-1/P1-3 **需 U2**；G16 冻结句不改。
- 代码：P0 缺现场事实；P1 精确删除范围已锁定。
- 质检：只反转现有断言，不新增质量系统。
- Website：0 生产改动。新持久结构：0。
- 状态：**设计阻断**——P0 根因已定位为 D2、修复 WO-P2-2 已施工（生产生效需重载 Chrome 扩展并由真实 job 读回）；P1 中 WO-P1-2/P1-4 不受阻断，WO-P1-1/P1-3 待 U2；P2 中 WO-P2-1 已落地，WO-P2-3 待设计。

## 10. P2：真实页面采集实证的 DOM 对齐缺陷（2026-09-26，独立账）

### 10.1 证据与口径

授权人明确要求用真实页面采集定位子能力信息错误。采集在本机内置浏览器新开标签页完成：SEO 研究→文章→图片→ZH-HK 翻译共 4 次真实发送（发送前均先用生产 `COHERENT_CANDIDATE_FUNCTION` 通过 exact outgoing 校验）。页面函数为生产同一份源码逐字展开，读取项直接取各 Child `selectors.ts` 导出常量；Child 源码摘要 `sha256:8fce503740ac…`。采集产物只在本机（`.claude/skills/gpt-page-capture/runs/0926-real/`，gitignored），本方案只引用其中已用页面 DOM 逐条核对过的因果。数字口径：WAL 最近 13 次 submit REJECTED 中 12 次属 `static-catalog:*` 步骤、1 次 `article_synthesis`。

### 10.2 缺陷与裁决

| # | 现场事实（真实 DOM） | 现役位置 | 授权 |
|---|---|---|---|
| D1 图片来源不可发现 | 生成图片位于 `button[data-testid=generated-image-preview]`→`div[data-testid=generated-image-gallery]`→`div[data-chatgpt-search-message-ids=<助手 UUID>]`，与用户单元同处一个 `[data-turn-key]` 容器；该回合内 `[data-chatgpt-selection-message-id]` 为 0。生产页面表达式返回 `BROWSER_AUTHENTICATED_MEDIA_IMAGE_SOURCE_ABSENT`，永远等不到图片（页面上图片 1672×941 可见） | `src/lib/browser/chrome-extension/authenticated-media-runtime.ts:36-38` | 无（冻结条款 `FROZEN-GPT-IMAGE-SOURCE-EVENT-WAIT-001` 未规定助手 id 来源） |
| D2 含行内代码的提示词，提交后读取用户回合失败 | 提示词含反引号时，用户气泡内无 `collapsible-user-message-content`，唯一 `.whitespace-pre-wrap` 含 22 个 `<code>` 子元素；用生产同一序列化（`<code>`→反引号）还原后哈希与生产提示词哈希**逐字相等**。`exactGptUserPromptText` 只认无元素子节点叶子，得 0 候选，抛 `BROWSER_DOM_CANDIDATE_MISSING`。前 3 段提示词无反引号，同一读取成功；本地化 SKILL 提示词含反引号 | `dom-coherent-observation.ts:81-86`；法条 `LAW-LOCAL-BROWSER-SESSION-004-V55`（`功能法案.md:1087/1097`）与 `-006-V41`（`:1165/1166`）四处“无元素子节点”文义，检查器 token `dom-mechanical-facts-inspection.ts:193` | U4（已批准） |
| D3 发送按钮出视口 | 新会话根页 + 4 个附件 + 4578 字提示词：composer form 高 560，发送按钮底边超出视口 52px，生产候选函数返回 `BROWSER_DOM_ACTION_OUTSIDE_VIEWPORT`；主容器滚动后通过。生产提交路径无“滚动到可见”步骤。前 3 段（≤1 附件）按钮在视口内，通过 | `dom-coherent-candidate.ts`（viewport 判据）、`dom-pointer-intent-runtime.ts`（无滚动） | 待设计：滚动属改变页面的物理动作，需过 Browser Authority 总闸门；先出方案再判 U5 |

### 10.3 P0 根因（三个独立可复核的事实）

1. **WAL**：12 次 submit 拒绝均为 `mutation_outcome=dispatched`（点击已发出）、`reason=BROWSER_DOM_CANDIDATE_MISSING`、`native_cause_code` 为空。空是因为该错误由点击后 `submitted-user-turn` 观察内抛出（`dom-coherent-observation.ts:84`，无阶段），不经带阶段的候选解析器。对照：模型入口的点击前拒绝行是 `mutation_outcome=no` 且阶段非空。
2. **提示词**：静态目录提示词 = 本地化 SKILL 全文 + 指令 + ContextBundle；失败任务 `aiprod_8ef8d7a4…` 用生产函数生成为 85258 字，含 44 个反引号。
3. **真实 DOM**：含反引号的提示词发送后，用户回合气泡内唯一 `.whitespace-pre-wrap` 含 `<code>` 子元素（第 4 段为 22 个），`exactGptUserPromptText` 得 0 候选并抛该错误；同一读取在无反引号的 3 个真实回合成功。85K 字长度本身不是原因（探针：发送按钮存在且在视口内，未被转附件）；Sol 档位亦不是。

后果：每次“失败”实际已把消息发到 ChatGPT（Provider effect 已发生），随后重试又发——账户里存在按重试次数重复的真实会话。修复 D2 后这些重试才会停止。

### 10.4 工单

**WO-P2-1 图片来源身份（D1；无需授权；可直接施工）**

- 唯一 Owner：`local-browser-session` 的 authenticated-media observation；唯一消费者 `checkpoint_gpt_generated_image/handler.ts:56` 的 `media.assistantTurnId`（进入 `checkpoint` 值，Product `seo-image-call` 沿用）。
- 唯一动作：助手回合 id 改由图片最近祖先 `[data-chatgpt-search-message-ids]` 提供，且必须是单个 UUID；不再要求 `[data-chatgpt-selection-message-id]`。范围（exact `userTurnId` 起至下一个 user turn 止）、跳过用户单元内图片、5000ms 单次 observer、按 `currentSrc/src` 与内容 hash 去重、体积/类型校验一律不动。
- 允许路径：`src/lib/browser/chrome-extension/authenticated-media-runtime.ts`；`scripts/acceptance/local-browser-authenticated-media-support.ts`。
- 验收：夹具加真实结构（图片与用户单元同处一个 turn 容器、无 selection-message-id、最近祖先带 message-ids）→ 成功且 `assistantTurnId` 等于该祖先 id；反例（祖先无 message-ids）→ `IMAGE_SOURCE_ABSENT`；既有失败反例保持。旧夹具中对 `selection-message-id` 的建模**物理删除**，零残留（`grep selection-message-id` 只允许出现在 `dom-exact-assistant-turn.ts` 及其夹具，文本回答链）。真实读回（已取得）：对本次第 3 段真实会话只读执行改后表达式，得到助手 UUID、`image/png`、2866004 字节、内容唯一。
- 删除反事实：不要 UUID 校验则 `assistantTurnId` 可为空，`checkpoint` 值缺身份；保留。
- 非目标：不改文本回答读取（`dom-exact-assistant-turn.ts` 已对真实 DOM 有效）、不新增 fallback/第二发现路径。

**WO-P2-2 用户回合正文选择（D2；U4 已批准）**：唯一动作是**删除** `exactGptUserPromptText` 短 Prompt 分支里“必须无元素子节点”的过滤条件——短 Prompt 取“气泡内恰好一个 `.whitespace-pre-wrap` 节点”，零个 typed missing、多个 typed ambiguous 不变；序列化器已含 `<code>`→反引号，NBSP 投影不变；不新增任何机制。
- 允许路径：`src/lib/browser/chrome-extension/dom-coherent-observation.ts`；法条四处文义（004、006 两条，升 V55/V42）及其在 `scripts/audit/domains/local-browser-session/{manifest.json,inspector.ts,mutation-atomicity-inspection.ts,interaction-readiness-inspection.ts,dom-mechanical-facts-inspection.ts}`、`scripts/acceptance/{local-browser.real-proof.ts,local-browser-provider-effect-recovery.acceptance.ts,local-browser-property-model.acceptance.ts,local-browser-dom-function-support.ts}` 与施工图头部 `lawIds` 的版本字面量、生成的 law registry；无关法条不动。
- 验收：新增一条夹具——唯一 `.whitespace-pre-wrap` 含行内 `<code>` 子元素→哈希等于还原反引号后的 Prompt；既有“多个叶子→AMBIGUOUS”“零→MISSING”保持。检查器删去已不存在的 token `child.nodeType !== 1`。
- 删除反事实：该过滤条件唯一效果是拒绝含行内代码的真实回合（4 个真实回合，含 3 个无反引号回合，均恰好 1 个该节点；无反例）；删除后多节点仍 fail-close，故删除。
- 真实读回：对第 4 段会话只读得到与生产提示词哈希相等的值。
- 生产生效前提：浏览器扩展源码已变，须重建本地产物（原生 `ensureCurrentBrowserRuntimeArtifact`）并在 Chrome 重载未打包扩展。

**WO-P2-3 发送按钮出视口（D3；待设计）**：候选方向只有两类——Product/GPT 层控制 composer 不被撑出视口，或 Browser 在动作前做一次受总闸门约束的滚动。二者都要先证明生产窗口尺寸下确实出视口（需要生产窗口尺寸），再裁决 Owner 与授权；它与 P0 无关，本版不动代码。
