---
document_type: project_scheme
scheme_id: GPT_PAGE_DOM_MINIMUM_FACT_REDUCTION
scheme_name: GPT页面DOM：submit 候选缺失诊断（P0）与最少充分事实减法（P1）
status: 设计阻断（P0 缺现场 DOM 事实并待授权 U1；P1 的 WO-P1-1/P1-3 待授权 U2，WO-P1-2/P1-4 不受 U2 阻断）
created_at: 2026-09-25
updated_at: 2026-09-26
owner_repo: ADVISION-X/AGENT
owner_domain: gpt
candidate_branch: main
candidate_agent_head: 5359d497cb80f20676f4a05bfb30aacc429dda5e
production_semantic_baseline: a66c3d2d0b9282d3ff029e5227d3976baa65b15a
scheme_head_before_this_revision: c3d81c1df8d64139a5c9ed889da48119148c8f10
scheme_blob_before_this_revision: f28cc400733dc79271604256244df2a8b3e23833
website_baseline: 01664ae8518eaec49ac0af5d142c758a1a219fd9
implementation_mode: evidence_first_then_subtraction
skill: 闭环实现设计-SKILL + agent-flow-boundary-gatekeeper
audit_verdict: 上一版 PASS_TWO_PASS 不成立；已在本文件内原位修正；未取得 U1/U2 授权与 P0 现场事实前不得施工
---

# GPT 页面 DOM 更新与工单恢复－完整实现方案

## 0. 本版唯一裁决

本文件仍是本 GAP 的**唯一现役方案**（同路径原位更新，不新建第二份；文件名沿用，标题与内容为 DOM 恢复方案）。

上一版的中心命题——“七寸是 GPT Child 替兄弟/后继/Browser 证明过多事实，先做 profile/model/attachment 减法即可消除重复失败”——**被本机生产日志与 Browser 变异库推翻**（§1、§2）。本版拆成两本互不依赖的账：

| 账 | 内容 | 状态 | 与已发生故障的关系 |
|---|---|---|---|
| **P0** | `submit_exact_gpt_turn_once` 的发送按钮点击在 Browser 候选解析阶段被拒 | 设计阻断：缺现场 DOM 事实，待授权 U1 | **是**当前唯一实证的第一直接断裂 |
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

- 12/12：`reason=BROWSER_DOM_CANDIDATE_MISSING`，`native_cause_code=NULL`，`physical_input_count=0`；`action_ordinal` 10（无附件路径）×11、13（含附件路径）×1；动作均为 `browser.dom.click.v1`，`effect_scope=provider_effect`。
- 最后一次 CONFIRMED submit：`2026-09-24T00:59:52Z`（旧选择器 `#composer-submit-button[data-testid='send-button']`）。`3016fe43e`（2026-09-25 07:13 +0400）把 submit/write 的选择器整体换成新 DOM 后，**没有一次真实 submit 成功**；首次生产运行为 `2026-09-25T19:51Z`。此前 09-24T01Z–09-25T19Z 无 submit 尝试。
- 同一次执行里，submit 之前的 prepare → profile 开 → 模型入口开 → 模型选择（`GPT-5.6 Sol`）→ 推理 → profile 关 → 写入 Prompt **全部 CONFIRMED**（例：`a768dec0` 于 23:11–23:12Z 完整走完再在 submit 被拒）。
- 时间特征无诊断价值：每个 Browser 变异的 DISPATCHED→终态本身约 4 秒（成功者同）。

### 2.4 profile / model / attachment 三片的真实失败（P1 的全部现场依据）

profile open 点击前 GPT 层 `…OPEN_QUALIFICATION_INVALID` ×1（具体 `topologyCode` 未落盘）；model-open ×2（Browser：`CANDIDATE_MISSING/SELECTOR_ABSENT` 0 输入 ×1；`POSTCONDITION_FAILED` 1 输入 ×1）；model-select ×2（GPT 层 `…CANDIDATE_NOT_PROVEN` ×1，发生在同一 job 的续跑尝试；Browser `DOM_NODE_STALE` ×1）；attachment 0。除 job `614f7414` 的续跑尝试外，上述失败之后同一 job 的下一次尝试都走到了 submit；`614f7414` 该次失败后转入 Runtime source handoff 的独立账（§2.5-3）。三片合计只有 5 次失败，对比 submit 的 12/12。

### 2.5 未证明项（不得当作事实使用）

1. submit 拒绝的 stage / native cause：12/12 为 NULL。同一 `markRejected` 写入路径对 model-open 的同码拒绝写下了 `BROWSER_DOM_SELECTOR_ABSENT`，说明**此路径的拒绝回执本身没带 stage**（`browser-command-actor.ts::completeMutation` → `browser-mutation-store.ts::markRejected` 原样写 `result.nativeCauseCode`）。回执为何缺 stage，本次审计只读代码未能确定。
2. 发送按钮在失败时刻的真实 DOM 状态：本机无该窗口的 exact-call 取证落盘。
3. `PRODUCTION_SOURCE_HANDOFF_REQUIRED` 反复出现在旧 job（`614f7414`、`ba48dcd8`）：属 Runtime source seal 的独立账，本方案不触碰。

## 3. P0：submit 发送按钮点击候选缺失

### 3.1 第一直接断裂

- **Owner / 权威位置**：Browser 变异物理边界（`browser.dom.click.v1`，actionOrdinal 10/13，`provider_effect`）；被点击的选择器由 GPT `submit_exact_gpt_turn_once/selectors.ts::GPT_SEND_SELECTOR` 提供。
- **实际值**：候选解析阶段被拒，reason `BROWSER_DOM_CANDIDATE_MISSING`，stage 为空，物理输入 0。
- **期望值**：恰 1 个合格发送按钮候选（`expectedMatches:1`）。
- **后果**：无 Provider submit → Child failed → Product → Runtime 释放租约 → Website demand 仍存活 → 重新 claim，反复 12 次；Browser fail-close 本身正确，**不得改成宽选择器/猜点**。

### 3.2 已排除

Website claim/capacity/admission；profile/model/attachment（同链路上反复成功）；Browser 零输入 fail-close 语义；submit 的“两项冻结前置”与 exact outgoing turn 校验（在候选解析之后才生效，且被拒时尚未进入）。

### 3.3 有限假设集与唯一判别事实

| 假设（推断，非事实） | 唯一判别事实 | 该事实的现有来源 |
|---|---|---|
| H1 `GPT_SEND_SELECTOR` 与真实页面不符（选择器含 `aria-label='发送'`；此前用 id/testid；`FROZEN-GPT-SUBMIT-TWO-PRECONDITIONS-001` 明文“按钮标签不是发送前置条件”） | 失败时刻 `form[data-chatgpt-composer]` 内所有 button 的 type / aria-label / disabled / 可见性 | 无，需 WO-P0-1 |
| H2 写入目标与编辑器状态不一致（`3016fe43e` 把 composer 选择器由 `#prompt-textarea` 改为 `[data-composer-markdown][role='textbox']`；write 只证明该节点可编辑文本 hash 精确，页面未必认为“有内容”，故发送按钮未渲染） | write 完成后 composer 节点是否仍带空占位 `p[data-empty-paragraph]`；页面按钮是否仍是语音/听写 | 无，需 WO-P0-1 |
| H3 候选存在但机械不合格（scope/候选 `INELIGIBLE`：aria-hidden 祖先/inert/无 layout） | stage 值 | 当前为 NULL |
| H4 按钮 disabled | 回执应为 `BROWSER_DOM_ACTION_NOT_QUALIFIED` + native `…DISABLED`（`FROZEN-GPT-SUBMIT-ACTIONABILITY-WAIT-001`），与观测码不符，**除非**回执映射另有路径 | 同 H3 |
| H5 stage 在此路径未被携带，导致 H1–H4 无法区分（观测缺口） | 找出 stage 缺失点 | 只读代码未定，见 §2.5-1 |

### 3.4 工单

**WO-P0-1 取证（唯一前置，须先获 U1）**

- 目标：得到 submit 被拒时刻的 (a) 候选解析 stage/native cause；(b) composer form 内 button 与 composer 节点的机械事实。
- 允许方式（U1 由授权人二选一或组合）：
  - **A 诊断修复**：找出 submit 拒绝回执缺 stage 的位置，仅使用现有 typed 字段（`nativeCauseCode`、`candidateMissingStage`、WAL 现有列 `native_cause_code`），**不新增列/事件/状态**；再用三类真实 job 重跑一次，只读 WAL。可能触及 `src/lib/browser/chrome-extension/{dom-coherent-candidate.ts(486 行), dom-pointer-intent-runtime.ts(474), dom-coherent-candidate-readback.ts}`、`src/lib/browser/exact-target/{browser-mutation-receipt.ts, browser-command-actor.ts}`；**500 行红线**（`基础法案.md:36`）要求这些文件净行数不增，或同一工单内先削减。
  - **B 只读现场采集**：用 `.agents/skills/gpt-page-operation-evidence`（Claude in Chrome）在与失败一致的页面状态（write 完成后、**不点发送**）采集 composer 区 DOM；不产生 Provider effect。
- 完成判据：下一次真实拒绝的 WAL 行 stage 非空，或 B 给出 H1–H4 的唯一判别。
- 非目标：不放宽 selector、不加 fallback、不新增 retry/恢复状态。

**WO-P0-2 按判别结果修（WO-P0-1 之后，由下表唯一裁决）**

| 判别结果 | 唯一 Owner | 唯一动作 | 授权门 |
|---|---|---|---|
| H1 选择器不符 | GPT `submit_exact_gpt_turn_once/selectors.ts` | 依页面实证确定**唯一**稳定选择器并原位替换 `GPT_SEND_SELECTOR`，不叠第二选择器 | 若须以标签定位，触及 `FROZEN-GPT-SUBMIT-TWO-PRECONDITIONS-001`，需授权 |
| H2 写入目标/编辑器状态不符 | GPT `write_exact_gpt_prompt` 选择器与后置 | 修正写入目标及其后置证明 | 无冻结冲突（G11：retained editable hash） |
| H3 候选存在但不合格 | 依 stage 定：页面准备（GPT/Product）或 Browser 机械事实（现役 `mechanicallyEligible`） | 只按 stage 指向的单一原因修 | 视 stage |
| 瞬态（同一 Child fresh 观察后恢复） | 同一 Child | 仅**零 mutation** 的失败可回到现役 bounded re-observation；物理动作已发生则只读回不重放。submit 现役只允许 disabled 类等待，扩到 candidate-missing 需授权 | 是 |

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
| **U1** | 采用 WO-P0-1 的 A（诊断修复，含一次真实重跑）、B（只读现场采集）或两者 | P0 全部 |
| **U2** | 解冻拓扑图 G03/G07/G08 与对应 Blueprint 句（G16 冻结句不改） | 仅 WO-P1-1、WO-P1-3 |
| U3 | （暂不申请） | 删“模型列表关闭” |

**候选绑定（W0）**：AGENT `main@5359d497c`（= origin/main）；`src/capabilities/gpt/children/**` 与 `src/lib/browser/**` 相对 `a66c3d2d0` **无差异**，两者之间仅 `gpt-proof.acceptance.ts`、新增 `gpt-rate-limit-closure.acceptance-support.ts`、`runtime-loops.ts`、若干验收支持文件与 `gpt-provider-contract-inspection.ts:78` 一个 token。Website `01664ae85`（干净）。Runtime/Website 侧无改动。施工前只重算 §4.4 所列路径及其直接 authority/质检依赖。

现役法案：`LAW-CAPABILITY-GOVERNANCE-001-V18`、`LAW-GPT-001-V63`、`LAW-GPT-002-V29`、`LAW-LOCAL-BROWSER-SESSION-004-V54`、`…-006-V41`（均已核对为现役，版本一致）。

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

顺序：两条账互不依赖。P0：U1 → WO-P0-1 → WO-P0-2。P1：WO-P1-2、WO-P1-4 可直接施工；U2 → WO-P1-1、WO-P1-3。各账均：AGENT 原生 `quality:check -- CHANGE` → clean commit → `READY` → §6 动态验收。P1 不得先于或代替 P0 宣称业务闭环。Website 不施工。

出现以下任一情况立即判方案被污染并停止：

- 在 P0 现场事实取得前“猜修” submit（放宽 selector、fallback、加 retry、扩大 submit 等待）；
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
- 状态：**设计阻断**——P0 待 U1 与现场事实；P1 中 WO-P1-2/P1-4 不受阻断，WO-P1-1/P1-3 待 U2。
