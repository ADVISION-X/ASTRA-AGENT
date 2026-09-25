---
document_type: project_scheme
scheme_id: GPT_PAGE_DOM_MINIMUM_FACT_REDUCTION
scheme_name: GPT页面DOM最少充分事实与工单恢复减法收敛
status: 可施工
created_at: 2026-09-25
updated_at: 2026-09-26
owner_repo: ADVISION-X/AGENT
owner_domain: gpt
candidate_branch: main
candidate_agent_head: 15f111e4d977f223c1ed2c5fb33c28d1f2582111
website_baseline: 01664ae8518eaec49ac0af5d142c758a1a219fd9
implementation_mode: subtraction_only
skill: 闭环实现设计-SKILL
skill_passes: 2
self_audit_verdict: PASS_TWO_PASS
---

# GPT 页面 DOM 更新与工单恢复－完整实现方案

## 0. 本版唯一裁决

本文件继续作为本 GAP 的**唯一现役施工方案**。不新建“七寸总方案”、不拆成四份错误码方案、不在 Website 再复制第二份方案。

本版冻结一句工程规则：

> **一个 Child 只证明自己这一动作所需的最少充分事实；Browser 只在真正物理动作边界重验 actionability；下一个 Child 自己 fresh 读取自己的事实。提前替后继 Child 证明、重复 Browser actionability、没有真实消费者的第三条件，一律删除。**

本轮只允许做减法：

- 新表 = 0
- 新字段 = 0
- 新持久状态 = 0
- 新 Child = 0
- 新 queue / manager / scheduler / recovery owner = 0
- 新 Browser 通用 API = 0
- 新 selector fallback / dual-read / compatibility bridge = 0
- Website 生产代码修改 = 0
- Provider submit 额外次数 = 0

现役 `LAW-CAPABILITY-GOVERNANCE-001-V18` 已经给出足够法理：每个 Child 只有一个业务完成判据；只有防重复副作用、越权、串任务、Target/Document 漂移或错误结果接收不可替代时，才允许再加一个安全判据；第三个阻断判据或复合布尔包装必须删除。本轮**不新增法案，也不需要为了减法升级 active law**。

---

## 1. 闭环 SKILL 双遍结论

### 1.1 第一遍：正向闭环

已按闭环 SKILL 对当前双仓 `main` 做四维遍历：

| 维度 | AGENT | Website | 本轮裁决 |
|---|---|---|---|
| 法案 | Capability Governance V18、GPT V63/V29、Local Browser V54/V41、Runtime V73 等 | AI Acceptance、SYSTEM 等 | 现役法案已经支持“最少充分事实 + Browser 唯一动作权威”，不建新 law |
| 施工图 | GPT V66、Local Browser V54、Website-Agent V6、相关历史方案 | SYSTEM、AI Acceptance | 真冲突集中在 GPT Blueprint 的页面 Child 语义，不在 Website |
| 代码 | GPT Child observation/handler、Browser coherent observation/mutation、Product flow | claim/readiness/transport | Browser/Website 主链不重构；只删 GPT Child 的重复/越权条件 |
| 质检 | GPT/Browser acceptance、audit、governance mutation tests | V6 Exam/production tests | 原位反转旧断言，不建第二质量系统 |

双仓当前树均未截断：

- `ADVISION-X/AGENT@15f111e4d977f223c1ed2c5fb33c28d1f2582111`：1176 entries / 912 files。
- `ADVISION-X/xuanxue-web@01664ae8518eaec49ac0af5d142c758a1a219fd9`：7411 entries / 6389 files。

### 1.2 第二遍：删除反事实

第二遍不问“还要补什么”，只问“删掉什么仍然正确”。

结论：

1. Target 正位已完成，本轮不重开 Target。
2. `current_reason` 控制权已从 source seal/CAS、stage permit、capacity、cooldown、deletion、readiness/completed 主链退出，本轮不重开 `current_reason`。
3. 最新故障的四种主要表面码：
   - `BROWSER_DOM_CANDIDATE_MISSING`
   - `GPT_EXECUTION_PROFILE_OPEN_QUALIFICATION_INVALID`
   - `GPT_MODEL_V3_CANDIDATE_NOT_PROVEN`
   - `BROWSER_POSTCONDITION_FAILED`

   不是四套基础设施问题，而是同一个边界问题的不同投影：**GPT Child 在动作前/后要求了超过自身语义目标的 DOM 事实，把易漂移的页面拓扑抬高成业务活性门。**
4. Browser 已经在真实 mutation 边界拥有候选基数、actionability、Target/Document、WAL、零或一次输入、2.5 秒 fresh postcondition 的唯一机械权威；GPT 再提前复制 disabled/inert/selected-count 等资格，只会制造第二裁决点。
5. GPT 已有唯一 `TRANSIENT_DOM` 只读确认：0 → 1.5 秒 → 3 秒，最多三次同身份 fresh observation。本轮不得再加 timer、retry manager、WAIT 状态或局部恢复链。

---

## 2. 最新运行实证与第一直接断裂

### 2.1 Website 不是本轮根因

补充到 2026-09-25T20:09:20Z 的最新 Website 日志继续显示：

- claim 200；
- heartbeat 200；
- device-status 200；
- lease release 200；
- Website V6 request/receipt terminal succeeded。

没有出现新的 Website 4xx/5xx 根失败。`BUSINESS_CAPACITY_EXHAUSTED` 仍是业务席位满载时的正常 claim 结果，不是工单失败。

因此本方案明确：

> **Website claim、capacity、Demand→Result、attempt/revision、Domain admission 代码零修改。**

### 2.2 AGENT 的根失败高度集中

同一运行窗中，AGENT 的 BLOCKING 根失败主要集中在 Browser/GPT 页面事实链。典型传播均为：

```text
Browser BLOCKING
  -> GPT CONSEQUENTIAL
  -> Product CONSEQUENTIAL
  -> Runtime CONSEQUENTIAL
  -> lease release
  -> Website demand 仍有效
  -> 后续重新 claim
```

正确的是：Website demand 不死、Browser 危险动作 fail closed。

错误的是：**一个局部 DOM 条件过宽时，每次 claim 都重新撞同一条件，形成无业务进展的循环。**

### 2.3 第一直接断裂

第一直接断裂不是“Browser 不会重试”，也不是“Website 不该重领”，而是：

> **GPT Child 把“当前动作真正需要的事实”和“兄弟控件/后继 Child/Browser actionability 的事实”塞进同一个资格布尔式。**

最明确的现役例子：

- `open_gpt_execution_profile` 在点击前同时读取 6 个 query：popup、simple-panel、reasoning-control、enabled-reasoning-control、reasoning-value、trigger；
- 它要求前 5 个全部 `0/0` 才允许点击；
- 点击后又要求 6 个全部 `eligible=1` 才算打开成功；
- 但“打开 profile”真正需要的只有**唯一 trigger 当前是否展开**；模型和推理强度是后继 Child 自己的事实。

这违反了现役“一个 Child 一个语义意图”和 Browser “只返回真实消费者最少充分机械事实”的边界。

---

## 3. 唯一目标链

本轮施工后只允许这一条链：

```text
Website current grant
  -> Product 当前 call
  -> 当前 Child 的最少充分状态判别
  -> Browser 在 mutation 边界重验 exact Target/Document + candidate + actionability
  -> 物理输入 0 或 1 次
  -> 当前 Child 的直接后置事实
  -> 下一个 Child fresh 读取它自己的最少充分事实
  -> frozen submit 两门
  -> result / Outbox
  -> Website Domain admission
  -> completed
```

严禁：

```text
当前 Child
  -> 提前证明下一个 Child 的控件
  -> 提前证明 Browser actionability
  -> 因兄弟控件暂缺判整个业务动作失败
```

动作发生前的 transient DOM 只复用现役 1.5s/3s typed stage；动作已经发生后只能读回原动作后置事实，绝不重放动作。

---

## 4. 七寸合并表：保留什么，删除什么

### 4.1 `prepare_clean_gpt_chat`：本轮不扩面

语义目标是“fresh Chat-mode root + 只清理孤立 stale draft”。

当前 root URL、composer、prior turns、attachments、generating、Chat/Work 互斥都直接参与“fresh”定义。本轮日志没有证明这些事实是主要七寸，贸然删除会把“减法”变成猜测。

**裁决：本轮不重构此 Child。**  
只要求质检防止未来继续叠加第 8、第 9 个条件。其返回 payload 是否还能进一步删字段，留到本轮 P0 收敛后的独立 consumer 删除审判，不与本施工混做。

### 4.2 `open_gpt_execution_profile`：6 个 query → 1 个状态事实

**保留：**
- 唯一 `GPT_PROFILE_TRIGGER_SELECTOR`
- `aria-expanded`

**删除：**
- popup pre-read
- simple-panel pre-read
- reasoning-control pre-read
- enabled-reasoning-control pre-read
- reasoning slider min/max/now pre-read
- popup owner/trigger id 作为“能不能打开”的额外门
- 点击后“六个兄弟事实必须一起成立”的复合 postcondition

裁决：

```text
trigger unique + aria-expanded=true  -> DONE
trigger unique + aria-expanded=false -> ACT
其它                              -> typed fail / existing transient confirmation
```

点击时 Browser 自己重验候选/actionability。点击后的直接后置只证明**同一 trigger 已展开**，不替模型/推理 Child 做准备。

优先复用现役 `postClickMatch`，用当前 trigger 的 `[aria-expanded='true']` 作为唯一直接后置；不新增 postcondition 类型。

### 4.3 `close_gpt_execution_profile`：3 个 query → 1 个状态事实

现役 close 同时要求 popup、trigger、composer。

真正语义只有“profile 已关闭”。

**保留：**
- 唯一 trigger
- `aria-expanded`

**删除：**
- composer 可用性
- popup owner 关系
- popup 独立基数作为第二完成判据

裁决：

```text
trigger collapsed -> DONE
trigger expanded  -> ACT
```

点击后只证明 trigger collapsed。Composer 是否可用由真正使用 Composer 的后继 Child 自己 fresh 证明。

### 4.4 `open_gpt_model_selector_v3`：只保留状态判别所需两事实

这个 Child 必须区分：

```text
指定模型选项已出现 -> DONE
指定模型尚未出现 + 唯一模型入口存在 -> ACT
```

因此两类候选是必要的，不能硬砍成一个。

**删除：**
- `openable-entry` 上当前无消费者的 `ariaExpanded` 字段读取；
- 任何为了后继模型选择/推理预取的字段。

点击后只证明指定 Product 模型选项出现；不证明选中、不证明推理控件。

### 4.5 `select_gpt_model_from_start_v3`：删除整个重复资格层

现役代码在 Browser 真正点击前，GPT 自己先读取：

- `ariaChecked`
- `ariaDisabled`
- `disabled`
- `inert`
- 全局 `selected-model-count`

然后 Browser mutation 又会再次机械重验 exact candidate 与 actionability。

这是同一个事实被两层重复裁决。

**本轮删除：**
- `readModelChoiceState()` 的 actionability 资格读取；
- `selected-model-count`；
- “先前 checked 必须是什么”的前置门；
- `previousChecked` 输出字段及只为它存在的测试/fixture；
- model observation 文件中因此失去消费者的投影代码；
- “模型菜单必须关闭”这一额外 postcondition。

**保留：**
- Product 已冻结的 exact model name；
- Browser click 的 exact selector + exact text + unique candidate；
- Browser 对真实候选的 actionability 重验；
- 点击的**同一 candidate `aria-checked=true`** 直接后置。

理由有两层：

1. 现役 Capability law 已要求删除第三阻断判据，Browser 是 actionability 唯一机械 Owner。
2. 当前仓库的真实 QA 采集已经明确记录：初态“最新”模型已选中；真实点击后 `aria-checked=true` 仍成立，但模型菜单持续 `data-state=open`。现役“选中且菜单关闭”因此被真实页面反证，且累计出现 14 条模型后置冲突。**菜单关闭不是“模型已选中”的必要事实。**

本轮同步最小修正 GPT Blueprint V66 及现役拓扑说明中 “G16 必须模型列表关闭” 的旧文义，改为“唯一 exact candidate 被本次 click 读回 `aria-checked=true` 即完成；后继 G17 自己读取自己的控件”。

如果未来动态验收证明 G17 在菜单保持 open 时根本无法读取其必要控件，才以该真实页面事实重新设计；**本方案禁止预先新增 close-model-menu Child/动作/状态来猜修。**

### 4.6 `select_gpt_reasoning_from_start_v3`：保留 2 类必要事实

这个 Child 必须计算：

```text
resolved = min(Product requestedReasoningValue, current max)
delta = resolved - current
```

所以：
- 当前唯一可操作 reasoning control
- slider `min/max/now`

都有真实消费者。

**裁决：保留，不为了追求数字好看强删。**

禁止新增第三种 UI 语义、Pro 标签、模型后缀或 fallback。

### 4.7 `open_gpt_attachment_control`：3 个 query → 1 个判别 + Browser action

现役读取：
- attachment-control
- active-menu
- upload-choice

真正的 Child 状态只需：

```text
exact upload-choice 已出现 -> DONE
否则                    -> 尝试点击 exact attachment-control
```

**删除：**
- `active-menu` 独立 query；
- 点击前对 attachment-control actionability 的 GPT 重复资格；
- 点击后重新要求 control + active-menu + choice 三者同时成立。

**保留：**
- exact upload-choice 是否存在的单一状态判别；
- Browser click exact attachment-control；
- 点击后 exact upload-choice 出现的直接 postcondition。

Browser 点击本身负责 control 的真实候选/actionability。

### 4.8 `attach_approved_gpt_files_once`：保留集合安全，删除 control 预读

**必须保留：**
- `assertNoForeignComposerAttachments()`：它回答“已有卡片是否超出批准集合”，这是错误文件输入的必要安全门；
- Browser `attachFile` 的 signed approved artifact 集合；
- Browser 对 activation choice + file input 的真实重验。

**删除：**
- `readAttachmentControlState()`；
- GPT 在 `attachFile` 前再次证明 control/choice ready 的第二资格层；
- 只为该 pre-read 存在的 control-observation 消费路径（若无其它消费者则物理删除文件，否则收窄）。

`browser.attachFile` 已经拥有 exact activation selector/scope/text 与 file-input 资格，因此它是唯一动作边界。

### 4.9 `write_exact_gpt_prompt` / submit / answer checkpoint

这些路径不是当前七寸的重复控制面：

- `write_exact_gpt_prompt` 只需要 exact composer + hash，保留；
- `submit_exact_gpt_turn_once` 的冻结两项前置、Browser WAL、exact outgoing prompt/attachment 不动；
- `checkpoint_gpt_text_response` 两门不动；
- Provider effect/readback/risk grant 不动。

不得借“减法”删除真正防重复输入、串任务或错误结果接收的事实。

---

## 5. 文档与合同施工

### W0 — 候选重绑

施工前重新确认：

```text
AGENT main = 15f111e4d977f223c1ed2c5fb33c28d1f2582111
Website main = 01664ae8518eaec49ac0af5d142c758a1a219fd9
```

若用户之后推送了新代码，只重算本方案列出的目标路径 diff；不得因普通漂移自动扩展施工范围。

### W1 — 法案

**active law 生产语义修改数 = 0。**

现役：
- `LAW-CAPABILITY-GOVERNANCE-001-V18`
- `LAW-GPT-001-V63`
- `LAW-GPT-002-V29`
- `LAW-LOCAL-BROWSER-SESSION-004-V54`
- `LAW-LOCAL-BROWSER-SESSION-006-V41`

已经足够支持本方案。不得为了“显得完整”无谓升 law version。

如果原生治理工具因为 Blueprint/contract 文义变化只要求机械依赖指针更新，按工具最小结果执行；禁止顺手重写 law 义务。

### W2 — GPT Blueprint / 拓扑文义

原位修改：
- `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md`
- 仅当仍作为当前施工导航被原生质检消费时，同步现役 `AGENT运行拓扑图` 对 G03/G15/G16/G17 的描述。

必须删除：
- G16 “模型列表关闭”；
- G03 把 reasoning topology 当作 open-profile 完成事实的文义；
- 其它“当前 Child 替后继 Child 证明 ready”的描述。

不得新增新 Blueprint。

### W3 — Child 合同

原位收窄 `src/capabilities/gpt/contract.ts` 的相关 Child：

- `open_gpt_execution_profile`
- `close_gpt_execution_profile`
- `open_gpt_model_selector_v3`
- `select_gpt_model_from_start_v3`
- `open_gpt_attachment_control`
- `attach_approved_gpt_files_once`（若合同文字含重复 pre-read）

只修改真实语义；Child id、Product action ordinal、Website wire、Provider effect identity 不变。

Child contractVersion 只在现役本地合同规则明确要求时递增；**不得把“字段减少”扩成跨仓 V44 升版。**

### W4 — 生产代码删除

按 §4 精确施工。原则：

```text
删 query
删字段
删复合布尔
删无消费者 projection
删重复 pre-read
删错误 postcondition
```

而不是：

```text
加 manager
加 retry
加 fallback
加 enum
加第二 observation API
加新的 recovery state
```

---

## 6. 质检：只反转现有门，不建新系统

### 6.1 必须更新的既有质检

原位修改现有：
- GPT exact-target/profile/model/attachment acceptance；
- Browser DOM mutation/receipt acceptance；
- GPT inspector / Browser inspector；
- `tests/governance/quality-contract.test.ts` 现役 mutation tests。

### 6.2 必须存在的反例

1. **Profile open**
   - trigger collapsed 且 reasoning/popup 兄弟事实缺席或变化，不得阻止一次合法 open；
   - trigger 多义/不可操作仍由 Browser 零输入拒绝。
2. **Profile close**
   - composer 缺席/不可操作不得改变“trigger 已 collapsed”的 close DONE；
   - trigger 多义仍失败。
3. **Model**
   - exact Product model 唯一且 Browser 可点击时，无需先读 disabled/inert/selected-count；
   - 当前模型已选中也必须按冻结语义点击一次；
   - 点击后 `aria-checked=true` 且菜单仍 open，Child **必须成功**；
   - 错模型、候选多义、Browser actionability 不成立必须零输入失败。
4. **Attachment control**
   - upload-choice 已存在直接 DONE；
   - active-menu 这个第三 query 不得再出现；
   - control 不可操作时 Browser 零输入失败。
5. **Attach**
   - 外来卡片仍在 GPT 层零上传失败；
   - 无外来卡片时不得先跑 control pre-read，直接进入 Browser `attachFile`；
   - Browser activation/file-input 不成立仍零上传失败。
6. **反膨胀 mutation**
   - 给 profile/model/attachment Child 人为重新加回被删除的第三 sibling query 或 duplicate actionability pre-read，现役 inspector/governance test 必须 FAIL。

### 6.3 不得写的测试

禁止用 fixture 固定“菜单必关闭”“六个 profile query 必齐”“active-menu 必存在”来倒逼生产代码恢复旧复杂度。

---

## 7. 动态验收

代码施工、AGENT 原生 CHANGE/READY 通过后，再做动态业务证明。

### 7.1 三个当前代表 job

至少覆盖本轮重复失败的：
- 两个 `localization_static_catalog` job；
- 一个 `localization_article_translation` job。

要求保留原 `job_id`，不得建 replacement job。

### 7.2 Browser/GPT 门

- 删除后的 profile/model/attachment 旧 sibling facts 不再产生 BLOCKING；
- genuine selector missing/ambiguous/actionability 仍 typed fail-close；
- 任一 Browser command physical input 不超过合同允许次数；
- model select 每次最多一次物理 click；
- Provider submit 不因本轮修复增加；
- `BROWSER_POSTCONDITION_FAILED` 若再次出现，必须来自当前 Child **直接后置**，不能来自已删除的后继事实。

### 7.3 最终业务门

不能停在 Child success / plugin success / claim 200。

最终必须读回：

```text
same job_id
+ result
+ Runtime Outbox settled
+ Website result admission
+ Domain consumer receipt
+ business consumption/object readback
+ status=completed
```

Website 代码保持原样，只作为最终业务终点的权威读回。

---

## 8. 删除反事实总表

| 对象 | 删除后是否破坏正确性 | 裁决 |
|---|---|---|
| Target/current Document/WAL | 会，破坏物理身份与副作用安全 | 保留 |
| Browser mutation actionability | 会，可能点错/输错 | 保留且只保留一份 |
| 1.5s/3s transient confirmation | 会降低当前 DOM 瞬态容忍，且已有唯一实现 | 保留 |
| profile 的 reasoning/popup sibling preconditions | 不会；后继 Child 自己读 | 删除 |
| profile close 的 composer 条件 | 不会；不是 close 语义 | 删除 |
| model pre-read disabled/inert/selected-count | 不会；Browser 点击边界已重验 | 删除 |
| model menu-close postcondition | 不会；真实页面已证明选中可成立而菜单保持 open | 删除 |
| reasoning slider min/max/now | 会，无法计算目标值 | 保留 |
| attachment active-menu query | 不会；exact upload-choice 已回答 ready | 删除 |
| attach 前 control/choice pre-read | 不会；Browser attachFile 已重验 activation/file-input | 删除 |
| foreign attachment set check | 会，可能上传到污染 composer | 保留 |
| submit 两门 / exact prompt+attachments / WAL once | 会产生重复输入或错误提交 | 保留 |

---

## 9. 施工顺序

严格串行：

1. 重绑最新 AGENT/Website HEAD。
2. 先改 GPT Blueprint / 现役拓扑文义，把“谁拥有哪个事实”说对。
3. 收窄 `contract.ts`。
4. 施工 profile open/close。
5. 施工 model open/select。
6. 施工 attachment open/attach。
7. 物理删除失去消费者的 observation/projection/输出字段。
8. 原位反转 acceptance / inspector / governance mutation tests。
9. 跑 AGENT 原生 `quality:check -- CHANGE`。
10. clean candidate 后跑 READY。
11. 最后用当前三类真实 job 做动态闭环，读到 Website Domain admission/completed。

Website 本轮**不施工**。

---

## 10. 停止条件

出现以下任一情况，立即判方案被加法污染：

- 新增表、字段、persistent enum/state；
- 新增 Child；
- 新增 Browser 通用接口；
- 新增 retry/recovery manager；
- 新增 selector fallback / 第二 selector registry；
- 为解决 DOM 候选缺失修改 Website claim/capacity；
- 为“菜单保持 open”新增一个未经真实页面证明必要的 close-menu 动作；
- 为一个 Child 重新引入第三个阻断事实；
- 把 `BUSINESS_CAPACITY_EXHAUSTED` 当作故障修；
- 把 `current_reason` 再拉回控制链。

---

## 11. 本版验收裁决

### 设计闭合

- 法案：**PASS**，现役 law 已支持本轮减法，active law 改动目标为 0。
- 施工图：**需施工时原位删旧文义**，不新增 Blueprint。
- 代码：**精确删除范围已锁定**，不新增基础设施。
- 质检：**只反转现有断言并增加反膨胀 mutant**，不新增质量系统。
- Website：**0 生产改动**。
- 新持久结构：**0**。

### 本轮真正的“七寸”

> 不是 `BROWSER_DOM_CANDIDATE_MISSING` 这个错误码本身，而是 **GPT Child 把兄弟/后继/Browser 自己的机械事实捆进当前动作的资格与完成条件**。

把这些事实拆回各自唯一 Owner 后：

```text
当前 Child 只看自己的事实
Browser 只管当前动作能不能安全做
下一个 Child 自己 fresh 看自己的事实
Website 只管业务需求与最终 admission
```

这是本方案唯一允许的方向。
