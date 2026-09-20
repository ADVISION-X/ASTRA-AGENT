# GPT 父完成 attempt 精确会话定位—完整实现方案

## 0. 方案状态与唯一结论

状态：**可施工**。本文件是该故障唯一施工方案；它替代此前“查询侧不允许 attempt”“永久清退历史 WAL”“一次性删除存量 WAL”三个错误方向。独立只读复审已 PASS：无 P0/P1/P2，方案级完成度 98%、准确度 98%；该结论不等于 CHANGE、READY、RELEASE 或生产完成。

用户已明确授权本方案所需的双仓 `law-amendment`：施工时只解冻命中的父 locator 语义法条及其依赖版本闭包，原位修订后立即重新冻结。该授权不包含修改任一仓已冻结的《法案系统建设说明书》，也不允许扩大到无关法条。

唯一结论：

> `provider_effect_identity` 继续严格由 `[job_id, result_revision, product_step_id, call_id, child_id, request_hash, payload_hash]` 构成，`attempt_id` 永不进入该身份；但 Website 已签发的 `provider_continuation` 在 AGENT 内部定位已完成父结果的 canonical conversation URL 时，必须由 Runtime 在完成父任务及 `result_payload_ref + result_payload_hash` 校验后，把该父任务冻结的 `current_attempt_id` 作为**只读选择维度**交给 Browser。Browser 只在 `(parent_job_id, parent_completed_attempt_id, parent_product_step_id, fixed call_id, fixed child_id)` 内要求恰好一条合法 CONFIRMED submit WAL 行。

这不是第二 effect identity、第二 continuation identity、恢复 checkpoint、跨仓字段或兼容桥；它只是对现役唯一 Browser WAL 的精确查询约束。

本方案只完成施工前设计，不授权代码、数据库、运行或发布动作。实际施工开始前仍须按第 14 节重新绑定候选和权限。

## 1. 需求、业务终点与非目标

### 1.1 明确需求

修复文章翻译与固定 catalog `provider_continuation` 的父会话定位，使父工单存在多个历史 attempt/result revision 时，当前子任务仍精确续接**已完成父结果**所对应的会话，同时保持现实 Provider submit 跨 attempt 至多一次。

### 1.2 权威业务终点

局部代码终点不是 Browser 返回 URL，也不是 AGENT Product 完成。业务终点依次为：

1. Browser 只读取得已完成父结果的唯一 canonical conversation URL；
2. 当前子任务在自己的独占 system Target 上完成至多一次当前 submit；
3. Product 形成满足现役 result contract 的结果；
4. Runtime 经唯一 Outbox 交付 Website；
5. Website localization Domain Consumer 对同一 `job_id + result_payload_hash` 幂等领域入库并签发 admission receipt；
6. Website public task 与 AGENT local task 分别按现役 receipt 规则完成；
7. 固定 catalog 场景最终还必须读回对应 locale catalog/domain object，五语齐备仍只由 Website 发布边界裁决。

### 1.3 明确非目标

- 不删除、改写、归档或压缩任何历史 Browser WAL 行。
- 不新增数据库表、列、索引、migration 或维护脚本。
- 不新增 Website task/result/V6 字段，不提升跨仓合同版本。
- 不修改 Website 业务代码、schema、migration、sender、consumer 或恢复决策；Website 只同步本次必需的法案、施工图与原生质检投影。
- 不把父 attempt 放入 provider effect identity、request hash、payload hash 或 logical mutation id。
- 不改变 Website 的 attempt/new-result-revision 恢复矩阵。
- 不整包回滚 `379dd3431`；保留该提交中当前 job 的同 effect 跨 attempt 零 submit 恢复。
- 不修改 Product Flow、Prompt、模型、Child 顺序或本地化内容合同。
- 不修改当前用户在 `static-catalog-flow.ts` 与 `localization-production.acceptance.ts` 上的未提交改动。
- 不把附件日期尾缀问题并入本故障；它只在最终固定文案动态证明中作为既有合同回归项。

## 2. scoped candidate 绑定

### 2.1 AGENT（需求 Owner 与唯一方案仓）

- realpath：`/Users/nexgen/Documents/AGENT`
- branch：`main`
- HEAD：`458a492c01ef13851d6437b8cf460621534755ee`
- tracking：`origin/main` @ `42643572967f5c9f193e54ad16036a45687d566c`
- 当前相关 overlay：
  - `M scripts/acceptance/product-plugins/localization-production.acceptance.ts`
  - `M src/plugins/localization-production/static-catalog-flow.ts`
  - 本方案文件本次原位修订
- 保护：前两项视为用户改动；本方案不要求修改它们，施工不得覆盖、恢复、格式化或移动。

### 2.2 Website（provider authority，仅治理语义同步）

- realpath：`/Users/nexgen/Documents/xuanxue-web`
- branch：`main`
- HEAD：`6a30cda0b6cc9a5168d6193b7d07a66f560f8415`
- tracking：`origin/main` @ `941e91a842b4388c96216f39a43927c4a128e949`
- 当前 overlay：
  - `M docs/项目方案/固定文案本地化闭环修复-完整实现方案.md`
  - `?? apps/web/public/assets/design/home/units/`
- 保护：上述两项视为用户改动，施工不得覆盖、恢复、格式化或移动。Website 仅原位修订命中的法案、AI-Acceptance/System 施工图、Manifest、inspector 与 generated registry；task/result/V6 合同、业务代码和数据库零修改。

### 2.3 现役合同绑定

- Website provider：`ai-acceptance.website-agent-task-result` version 13。
- AGENT consumer：`docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json` version 13。
- Website provider：`ai-acceptance.xuanxue-ai-production-v6` version 37。
- AGENT consumer：`docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json` version 37。
- 本修复不改变上述合同 body 或 version；父完成 attempt 由 AGENT 已持久接受的父任务本地读取，不跨仓运输。

### 2.4 漂移门

施工前重新读取两个仓库的 `AGENTS.md`、上述 HEAD/branch/tracking/overlay、两仓相关 active law、三份 AGENT blueprint、Website AI-Acceptance/System blueprint、两份 consumer dependency及目标符号。以下任一发生即停止并重开受影响设计：

- 本方案命中的法条、Blueprint、目标代码或 audit 已被其它提交改写；
- Website task-result/V6 合同版本变化；
- 用户改动进入本方案目标代码或治理路径且无法安全分离；
- 当前三个故障工单的父完成 attempt 不再各自具有唯一 CONFIRMED `article_synthesis` 行；
- 新事实证明父完成 attempt 会在 `completed` 后被替换。

## 3. 输入证据与历史连续性裁决

### 3.1 当前真实故障

当前三张本地任务均为 `localization_article_translation/article_translation`，失败原因均为 `BROWSER_PARENT_PROVIDER_EFFECT_AMBIGUOUS`：

| 当前工单 | 父工单 | 父 `article_synthesis` 历史 CONFIRMED | 父 `current_attempt_id` 内 CONFIRMED |
|---|---|---:|---:|
| `aiprod_054f1199-154e-41af-82ab-0b4a574d1635` | `aiprod_f74d48b2-9a80-4a23-9281-26aafb2487fc` | 7 | 1 |
| `aiprod_f0675f47-454e-4cee-a10f-c78238a10916` | `aiprod_4e0da619-cb07-4f5f-99d0-8889793703ce` | 8 | 1 |
| `aiprod_b2b7e83c-97f1-47d4-a582-b940124c3629` | `aiprod_cf6dd6fd-aed1-4394-901b-dd80da3647f1` | 2 | 1 |

父任务均为 `completed`。`ProductionTaskStateStore.acceptTask()` 只允许 `failed` 任务换 attempt；completed 父任务不能被再次 accept，因此其 `current_attempt_id` 是稳定的完成结果选择事实。

### 3.2 第一处直接断裂

唯一第一断裂位于 `src/lib/local-runtime/production/executor.ts`：

1. Runtime 已读取 exact parent task；
2. 已要求 parent `status=completed` 且 result 存在；
3. 已把 Website 下发的 `parent_result_ref + parent_result_hash` 与本地完成结果精确比较；
4. 但建立 `GptProductionExecutionInput` 时只发送 `{jobId}`，丢弃同一父记录中的 `current_attempt_id`。

随后 `BrowserMutationStore.readUniqueConfirmedConversationUrl()` 只能按 parent job + step 查询所有历史 result revision，导致不同历史会话 URL 被错误合并成当前父结果候选。失败发生在 Target 创建/导航和当前 Provider submit 之前。

### 3.3 历史提交裁决

- `3716fae0d`（2026-09-15）首次加入 `{jobId, acceptedAttemptId}`，并证明父完成 attempt 可消歧多个已接纳 revision。该选择维度方向正确。
- `379dd3431`（2026-09-17）为修复“当前 job 同一 provider effect 跨 attempt 仍须从 WAL 零 submit读回”而移除父 attempt。该提交对当前 effect recovery 的修复正确；把同一原则扩张到跨 job 父结果 locator 则错误。
- 当前法案、Blueprint 和 audit 随后把该扩张固化成“父attempt不参与定位”，因此此前审计能正确发现“代码方案与现役 authority 冲突”，但不能证明该 authority 对当前真实父结果链是正确的。
- Website `caded01bb3` 已使 `provider_effect+dispatched/confirmed` 保留同 accepted attempt，仅 `target_local+REJECTED` 或 `provider_effect+REJECTED+no` 可产生新 attempt。该修复阻止未来错误增长，但不负责选择已经完成父结果的历史 WAL 行。

### 3.4 竞争方案裁决

- “Runtime 常驻删除旧 attempt WAL”：删除真实 Provider effect 证据，否决。
- “一次性脚本删除存量 WAL”：以改写证据适配错误查询，否决。
- “新增 parent result revision 跨仓字段”：现役本地父完成 attempt 已足够，新增合同无真实必要性，否决。
- “从 result ref 或 receipt hash 反解 attempt”：未被合同授权且语义脆弱，否决。
- “按 terminal_at/latest 选择 URL”：时间猜测，否决。
- “回退 fresh chat”：改变 Website route relation，形成第二路径，否决。
- “整包 revert 379dd3431”：会破坏同 effect 跨 attempt at-most-once recovery，否决。

## 4. 四维闭环

| 维度 | 当前冲突 | 目标裁决 |
|---|---|---|
| 法案系统 | AGENT `ARCHITECTURE-BOUNDARY-001`、`GPT-001`、`LOCAL-BROWSER-003/006` 与 Website `AI-ACCEPTANCE-002/012`、`LOCALIZATION-019` 都把父 locator 锁成 job(+step)；AGENT `LOCAL-BROWSER-004`正确规定 attempt 不改变 effect identity | 双仓只修订父 locator 语义；Website 仍只签发父 task/result/hash，Runtime 本地验证后提供 completed attempt selector；effect identity 语义不变，但直接依赖版本必须机械闭合 |
| 施工图 | AGENT Browser/GPT/Website-Agent 与 Website AI-Acceptance/System 施工图都投影了旧 locator | 双仓图同时改为“Website仍不传attempt；Runtime验证完成父结果后，携带本地父完成attempt作为只边界内读selector”，明确它不进入effect identity、不跨仓、不持久化第二状态 |
| 现役实现 | Runtime 丢字段；GPT/lease/lane 无运输位；Browser store 跨全部 attempt 查询 | 原位恢复既有 `acceptedAttemptId` 运输和 SQL 过滤；不新增模块、store、schema或 wrapper |
| 质检系统 | 两个 audit 明确禁止 `parentAttemptId`；验收把多 attempt 必然 AMBIGUOUS 当作正确 | 反转为双向守门：父 locator 必须含 selector；effect identity 必须排除 attempt；正负验收覆盖零/一/多/未决/非法分支 |

## 5. identity spine 与不可混同事实

| 事实 | Owner | 精确身份/来源 | attempt 的角色 |
|---|---|---|---|
| Website provider continuation relation | Website localization sender + ai-acceptance | 当前 task 的 `parent_task_ref + parent_result_ref + parent_result_hash` | 不跨仓新增 parent attempt |
| 已完成父结果本地绑定 | agent-production-runtime | 本地 completed parent task + exact result ref/hash | `current_attempt_id` 只标识哪个本地 WAL generation 产出该完成结果 |
| 父 conversation locator | local-browser-session | `parent_job_id + parent_completed_attempt_id + parent_product_step_id + turn-submit + submit_exact_gpt_turn_once` | 只读 SQL selector |
| 当前 submit provider effect identity | local-browser-session WAL | 七字段 canonical tuple | 明确不包含 attempt |
| 当前 accepted attempt 与恢复决定 | Website ai-acceptance | V6 grant/failure matrix | Website 唯一签发、保留、替换；Browser不得决定 |
| 业务完成 | Website localization Domain Consumer | `job_id + result_payload_hash + admission receipt` | 不由 locator、Provider terminal 或 AGENT 自行宣告 |

## 6. 原子责任与边界绑定

### R1：父业务关系与父结果授权

- canonical_owner：Website localization sender / ai-acceptance。
- authority_inputs_and_providers：canonical route、source/locale/policy/auth、direct-parent task/result/hash。
- single_decision_or_action：签发一张带精确父三元组的 `provider_continuation` task。
- typed_output_or_persisted_truth：WebsiteAgentTask v13。
- consumers：AGENT Runtime。
- failure_owner_and_location：Website 在签发前拒绝不合法父关系；Runtime 对运输身份不一致返回 typed binding failure。
- readback_acceptance：当前 task/grant 精确读回。
- forbidden_adjacent_owners：AGENT 不选择父任务，不推导 locale predecessor。
- allowed_change_paths：Website 命中法案、AI-Acceptance/System 施工图及它们的 Manifest/inspector/registry 投影；业务代码、合同和数据库不改。
- existence_proof：现役文章翻译与固定 catalog route 的直接消费者真实存在；删除 relation 后无法续接指定父会话。决定：KEEP。

### R2：父完成结果与本地完成 attempt 绑定

- canonical_owner：agent-production-runtime。
- authority_inputs_and_providers：Website task 父三元组；本地 `production_tasks` completed parent record。
- single_decision_or_action：机械验证 parent task completed 且 result ref/hash 精确相等，并读取同一行 `current_attempt_id`。
- typed_output_or_persisted_truth：进程内 `providerContinuationParent={jobId,acceptedAttemptId}`。
- consumers：GPT production execution/lifecycle。
- failure_owner_and_location：Runtime；`PRODUCTION_PARENT_RESULT_BINDING_MISSING|INVALID`。
- readback_acceptance：执行输入只在全部校验后创建。
- forbidden_adjacent_owners：Runtime 不读取 Browser WAL，不解释父内容，不签发 attempt。
- allowed_change_paths：`src/lib/local-runtime/production/executor.ts`、对应 Runtime acceptance/audit。
- existence_proof：当前完成父行同时保存唯一稳定 attempt；删除该字段运输会重现已证实 AMBIGUOUS。无更短可靠 selector。决定：KEEP + 原位修正。

### R3：GPT/Browser acquisition 参数机械运输

- canonical_owner：gpt（typed facade/lifecycle）与 local-browser-session（lease/lane）各自拥有相邻 handoff。
- authority_inputs_and_providers：R2 输出。
- single_decision_or_action：不解释地把 jobId/acceptedAttemptId 运输到唯一 Browser acquisition。
- typed_output_or_persisted_truth：`authorized-continuation` waiter；不持久化。
- consumers：BrowserLaneCoordinator。
- failure_owner_and_location：类型/输入非法在 GPT/Browser 边界失败关闭。
- readback_acceptance：lane waiter 同时含两个必填字段，非 continuation mode 物理不含。
- forbidden_adjacent_owners：GPT 不读取 URL/WAL；lane 不决定父关系、attempt 或 Product 下一步。
- allowed_change_paths：`production-child-support.ts`、`production-browser-lifecycle.ts`、`browser-target-lease.ts`、`browser-lane-coordinator.ts`及对应验收。
- existence_proof：现役唯一 acquisition handoff 的真实 Browser consumer直接需要该 selector；无需新接口或 store。决定：KEEP + 最小字段恢复。

### R4：父完成会话 URL 精确读回

- canonical_owner：local-browser-session / BrowserMutationStore。
- authority_inputs_and_providers：R3 waiter；唯一 Browser WAL。
- single_decision_or_action：在父完成 attempt 范围内验证并返回恰好一个 canonical URL。
- typed_output_or_persisted_truth：进程内 canonical conversation URL或现役 typed error。
- consumers：BrowserTargetAcquirer，只用于当前 job 独占 Target 的零/一次精确导航。
- failure_owner_and_location：Browser；`IDENTITY_INVALID|UNSETTLED|MISSING|INVALID|AMBIGUOUS`。
- readback_acceptance：URL 经现役 canonicalizer；导航后 fresh URL精确相等。
- forbidden_adjacent_owners：不得删除 WAL、不得按 latest、不得重放 submit、不得读取父回答/Target/userTurnId。
- allowed_change_paths：`browser-mutation-store.ts`、`browser-lane-coordinator.ts`及对应验收/audit。
- existence_proof：WAL 是唯一 URL owner，完成父 attempt 是当前已存在的最窄可靠选择事实；删除该过滤会重现三张工单故障。决定：KEEP + 原位修正。

### R5：当前 Provider effect at-most-once

- canonical_owner：local-browser-session WAL。
- authority_inputs_and_providers：当前 job七字段 effect tuple和Website当前 grant。
- single_decision_or_action：已有 DISPATCHED/CONFIRMED 时零 submit读回，否则至多一次 dispatch。
- typed_output_or_persisted_truth：现役 mutation row/receipt。
- consumers：GPT Child、Runtime failure/result链。
- failure_owner_and_location：Browser typed fact。
- readback_acceptance：同 logical mutation id、physical input count不增长。
- forbidden_adjacent_owners：父完成 attempt selector不得参与 logical mutation id、request hash或payload hash。
- allowed_change_paths：不修改本责任实现；仅由 audit/acceptance增加反回归断言。
- existence_proof：防止现实重复提交的现役 P0 不变量；删除会造成真实外部副作用重复。决定：KEEP unchanged。

### R6：领域接纳与业务完成

- canonical_owner：Website localization Domain Consumer + ai-acceptance。
- authority_inputs_and_providers：Runtime Outbox提交的当前 result及其hash。
- single_decision_or_action：领域幂等入库、签发 admission receipt、完成公开任务。
- typed_output_or_persisted_truth：domain object + admission receipt + completed readback。
- consumers：Website业务发布/locale catalog读侧与AGENT本地完成逻辑。
- failure_owner_and_location：Website domain/ai-acceptance typed failure。
- readback_acceptance：Website持久对象与receipt，不以HTTP/Provider/Outbox替代。
- forbidden_adjacent_owners：AGENT不得解释领域内容或伪造完成。
- allowed_change_paths：无；只在 RELEASE 动态证明中消费。
- existence_proof：这是用户要求“全链路打通”的唯一业务终点。决定：KEEP。

## 7. 唯一目标链与有限分母

```text
Website task v13: parent task/ref/hash
  -> Runtime读取本地completed parent并精确比较ref/hash
  -> Runtime读取同一parent row.current_attempt_id
  -> GPT typed input机械运输{jobId, acceptedAttemptId}
  -> Browser authorized-continuation waiter
  -> Browser WAL精确查询parent job+completed attempt+step+fixed call/child
     -> current parent attempt有DISPATCHED: UNSETTLED，停止
     -> CONFIRMED=0: MISSING，停止
     -> CONFIRMED>1: AMBIGUOUS，停止
     -> payload/URL非法: INVALID，停止
     -> CONFIRMED=1且URL合法: 当前job独占Target零/一次导航
  -> 当前job effect仍按七字段身份至多一次submit
  -> Product result -> Runtime Outbox -> Website staging
  -> localization Domain Consumer入库并签发admission receipt
  -> Website/AGENT各自按现役规则完成
```

历史其它 attempt 的 CONFIRMED/DISPATCHED 行仍保留为不可变证据，但不是当前已完成父结果的 locator candidate，因此不得阻断当前 continuation。

## 8. 法案与施工图原子替换

### 工单 1：双仓修订最小语义法条并重新冻结

只解冻下列直接写死旧 locator 的规范主题，修改后立即重新冻结。

AGENT 语义替换：

1. `LAW-ARCHITECTURE-BOUNDARY-001-V11 -> V12`：Website 仍是唯一恢复 Owner；provider continuation 由 Website 父 task/result/hash 授权，AGENT Runtime 只在完成父结果校验后绑定本地 completed attempt selector；父 selector 不改变当前 effect identity。
2. `LAW-LOCAL-BROWSER-SESSION-003-V38 -> V39`：authorized-continuation 只消费 exact parent job、Runtime 已验证的 parent completed attempt 与 exact step；Browser 不得自选 latest attempt 或取得业务恢复权，同 attempt 内零/多/未决/非法均失败关闭。
3. `LAW-LOCAL-BROWSER-SESSION-006-V35 -> V36`：关闭 typed Browser 载荷与 URL locator 语义为 parent job + parent completed attempt + step + fixed call/Child；attempt 仅是本地读 selector，不进 wire 业务身份或 WAL effect identity。
4. `LAW-GPT-001-V57 -> V58`：GPT 只机械运输 `{jobId,acceptedAttemptId}`，不读父 URL/回答/WAL；父 locator 与当前 Provider effect identity 正交。

Website 语义替换：

1. `LAW-AI-ACCEPTANCE-002-V26 -> V27`：Website 仍只签发 direct parent task/result/hash，不传 Provider URL 或 attempt；允许 AGENT 在已验证的 completed parent 上以本地 attempt 精确定位父 WAL。
2. `LAW-AI-ACCEPTANCE-012-V33 -> V34`：保持 V6 的七字段 Provider effect identity 不变，只把文章/固定 catalog 的 AGENT 私有父 locator 改为 parent job + locally verified completed attempt + exact step。
3. `LAW-LOCALIZATION-019-V9 -> V10`：保持 fixed catalog cohort、locale 次序与 direct parent 规则不变，只同步 AGENT 私有 locator 的 completed-attempt selector。

### 工单 2：闭合两仓现役法条依赖版本

依据两仓冻结说明书，`dependsOnLawIds`变化必须提升 major。下列只做依赖引用的机械闭合，不扩张其 summary/forbidden 语义。

AGENT 机械闭包：

- `LAW-CAPABILITY-GOVERNANCE-001-V15 -> V16`。
- `LAW-CAPABILITY-GOVERNANCE-002-V1 -> V2`。
- `LAW-SYSTEM-SECURITY-001-V11 -> V12`。
- `LAW-LOCAL-BROWSER-SESSION-004-V45 -> V46`：仅把依赖改为 `LOCAL-BROWSER-006-V36`；“attempt 永不改变 Provider effect identity”的语义必须原样保留。
- `LAW-GPT-002-V22 -> V23`。
- `LAW-AGENT-PRODUCTION-RUNTIME-001-V65 -> V66`。
- `LAW-AGENT-PRODUCTION-RUNTIME-002-V8 -> V9`。
- `LAW-AGENT-PRODUCTION-RUNTIME-003-V37 -> V38`。
- `LAW-AGENT-PRODUCTION-RUNTIME-004-V37 -> V38`。
- `LAW-AGENT-PRODUCTION-RUNTIME-005-V35 -> V36`。
- `LAW-AGENT-PRODUCTION-RUNTIME-006-V39 -> V40`。
- `LAW-AGENT-PRODUCTION-RUNTIME-007-V39 -> V40`。
- `LAW-AGENT-PRODUCTION-RUNTIME-008-V40 -> V41`。

Website 机械闭包：

- `LAW-AI-ACCEPTANCE-013-V16 -> V17`。
- `LAW-PUBLIC-KNOWLEDGE-CONTENT-005-V33 -> V34`。
- `LAW-LOCALIZATION-012-V11 -> V12`。
- `LAW-LOCALIZATION-013-V14 -> V15`。
- `LAW-LOCALIZATION-020-V18 -> V19`。

每个新 major 原子删除旧 active block，`supersedesLawId` 精确指向前一 major；不得同时保留新旧 active 版本。施工当时必须从两仓 generated registry 重算反向依赖闭包；任一新依赖者即视为候选漂移，禁止照抄本清单。闭包完成后全部相关法条继续处于 active 冻结状态。

### 工单 3：同步双仓治理投影与施工图

- AGENT 更新 architecture-boundary、capability-governance、system-security、agent-production-runtime、gpt、local-browser-session 的 Manifest、现役 inspector/session-output/断言和 lawId 分母。
- AGENT 原位修订：
  - `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md`
  - `docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md`
  - `docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md`
- Website 更新 ai-acceptance、localization、public-knowledge-content 的 Manifest、现役 inspector/断言和 lawId 分母，原位修订：
  - `docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md`
  - `docs/blueprints/SYSTEM-BLUEPRINT.md`
- 两仓 machine block 只更新现役 lawIds/blueprintId；正文只改真实父 locator 数据流、Owner、失败分支和验收，不复制法案全文。
- 在每个仓分别运行其唯一 `npm run audit:build` 重建 `law-registry.generated.json`，不得手改 registry；再运行其原生 `npm run audit:projection:check`。

两仓法案、Manifest、Blueprint、registry 和治理检查必须在同一 CHANGE 候选中同时一致；任一仓未对齐都禁止进入代码工单。

## 9. 代码施工工单

### 工单 4：Runtime恢复父完成 attempt事实

路径：

- `src/lib/local-runtime/production/executor.ts`
- `scripts/acceptance/agent-production-runtime-startup.acceptance.ts`

动作：

1. 保留现役parent completed/result ref/hash校验顺序。
2. 仅在校验成功后构造：

   ```ts
   providerContinuationParent: {
     jobId: parent.task.job_id,
     acceptedAttemptId: parent.current_attempt_id,
   }
   ```

3. acceptance必须证明：缺父、未完成父、ref/hash不等均不产生GPT execution；合法父精确携带其completed attempt；父任务完成后换attempt仍被Store拒绝。

非目标：Runtime不查询Browser WAL，不增加数据库字段，不验证URL。

### 工单 5：GPT与Browser acquisition机械运输

路径：

- `src/capabilities/gpt/production-child-support.ts`
- `src/capabilities/gpt/production-browser-lifecycle.ts`
- `src/lib/browser/exact-target/browser-target-lease.ts`
- `src/lib/browser/infrastructure/browser-lane-coordinator.ts`
- `scripts/acceptance/browser-lane-fifo.acceptance.ts`

动作：

1. 恢复`providerContinuationParent: {jobId,acceptedAttemptId}`。
2. `authorized-continuation` wait union同时强制`parentJobId`与`parentAttemptId`；其它mode两个字段均不得出现。
3. lane waiter只机械保存到本次进程内请求，禁止落库、日志输出原值或形成registry。
4. self-parent继续`BROWSER_PARENT_JOB_SELF_REFERENCE`失败关闭。
5. lane仍是唯一物理FIFO；N个job可拥有N个独占Tab，但页面动作不并行。

### 工单 6：Browser WAL精确查询

路径：

- `src/lib/browser/exact-target/browser-mutation-store.ts`
- `scripts/acceptance/local-browser-provider-effect-recovery.acceptance.ts`

目标签名：

```ts
readUniqueConfirmedConversationUrl(
  parentJobId: string,
  parentAttemptId: string,
  parentProductStepId: string,
): string
```

查询范围固定为：

```sql
job_id=?
and attempt_id=?
and product_step_id=?
and call_id='turn-submit'
and child_capability_id='submit_exact_gpt_turn_once'
and effect_scope='provider_effect'
```

裁决顺序：

1. 三个输入均非空、无NUL，否则`BROWSER_PARENT_IDENTITY_INVALID`。
2. exact scope存在DISPATCHED即`BROWSER_PARENT_PROVIDER_EFFECT_UNSETTLED`。
3. exact scope CONFIRMED行数为0即`MISSING`。
4. 行数大于1即`AMBIGUOUS`；不得用`Set(URL).size===1`把两条现实effect折叠成一条。
5. 恰好一行时解密payload并走现役canonical URL validator；任一缺失/非法即`INVALID`。
6. 只返回该URL，不修改任何WAL行。

禁止加入latest/order-by-time选择、fallback attempt、URL去重放行或清理调用。

### 工单 7：反转错误audit并锁住双向边界

路径：

- `scripts/audit/domains/gpt/gpt-provider-contract-inspection.ts`
- `scripts/audit/domains/local-browser-session/target-claim-inspection.ts`
- 受law major变更直接命中的现役inspector/manifest/session-output。

检查必须同时证明：

1. Runtime/GPT/Browser authorized-continuation链要求`acceptedAttemptId|parentAttemptId`。
2. Store SQL同时含job/attempt/step/fixed call/fixed child/effect scope。
3. `provider_effect_identity` tuple、logical mutation id、request hash与payload hash仍不含attempt。
4. 没有第二URL store、continuation store、cleanup脚本、fallback或latest选择。
5. 旧forbidden token检查被物理删除，不保留反向兼容分支。

### 工单 8：结构预算失败关闭

以下现役文件已贴近 500 行红线，本修复必须做原位删除+替换，文件净行数不得增加：

- `src/lib/browser/exact-target/browser-mutation-store.ts`：当前 494 行，删除旧跨 attempt 查询与 `Set(URL)` 折叠后原位写入 exact-attempt 查询。
- `scripts/audit/domains/local-browser-session/target-claim-inspection.ts`：当前 494 行，物理替换旧 forbidden-token 断言，不叠加第二检查器。
- `scripts/acceptance/agent-production-runtime-startup.acceptance.ts`：当前 499 行，利用现有 parent binding 用例替换断言，不新建并行 fixture。

若候选仍超红线，必须停止并先按现役 Owner 做原子职责切分；不得新增 wrapper、bridge、第二 resolver 或纯为搬行而成立的无语义文件。

## 10. 验收矩阵

### 10.1 静态/确定性验收

| 场景 | 预期 |
|---|---|
| 同一父job有多个历史attempt和不同URL；completed attempt恰好一条CONFIRMED | 返回completed attempt URL |
| 旧attempt存在DISPATCHED，completed attempt唯一CONFIRMED | 旧DISPATCHED不阻断 |
| completed attempt存在DISPATCHED | `UNSETTLED` |
| completed attempt无CONFIRMED | `MISSING` |
| completed attempt两条CONFIRMED，URL不同 | `AMBIGUOUS` |
| completed attempt两条CONFIRMED，URL相同 | 仍`AMBIGUOUS` |
| payload缺失、解密失败或URL非法 | `INVALID` |
| parent attempt错误或交换 | `MISSING`，不得回退其它attempt |
| parent job=self | self-reference failure |
| 当前job同effect已在旧attempt CONFIRMED | 保持现役跨attempt零submit读回 |
| current result revision变化 | 仍按七字段形成新effect，不受父selector影响 |
| 非provider_continuation route | 不产生parent selector，fresh路径不变 |

### 10.2 数据不变性验收

使用只读SQL在测试前后证明：

- `browser_mutations`总行数不因locator查询变化；
- 三个父工单各自全部历史行、command_id、attempt_id、result_revision、state、terminal payload保持不变；
- 无`delete/update`由本修复新增；
- schema、index、migration集合不变。

### 10.3 当前事故回归

以测试夹具复现当前`7/8/2`历史attempt形状，但不把生产jobId写入业务代码。三个子任务都应在Target创建前精确解析各自父完成URL，不再产生`BROWSER_PARENT_PROVIDER_EFFECT_AMBIGUOUS`。

### 10.4 生产动态证明（RELEASE）

实际生产动作只在用户施工/发布授权和`ci-full-governance` RELEASE阶段执行：

1. 对当前三张文章翻译任务沿Website现役同job恢复机制取得合法grant；不得手动改任务状态或创建replacement job。
2. 三张任务可各自建立一个system-owned job-bound Tab；Browser唯一物理lane仍串行。
3. 每张任务的父URL来自其completed parent attempt；旧attempt行数和内容前后不变。
4. 当前任务每个submit effect physical input count至多1；无第二submit。
5. 三份翻译结果分别取得Website领域admission receipt与locale edition/domain object持久读回。
6. 三个业务席位闭合后，固定文案工单被领取；四个带`(20260920-014044)`或`(20260920-014045)`尾缀的JSON按既有附件名合同识别。
7. 固定catalog五locale按现役严格序列执行并逐locale领域接纳；最终读回Website locale catalog齐备事实。

任何Provider/HTTP/Outbox成功但缺Website领域readback，均不得宣称全链路完成。

## 11. 原生质量顺序

1. 法案与施工图CHANGE：先运行受影响治理测试、`npm run audit:build`与`npm run audit:projection:check`。
2. authority自检两遍：逐项核对law major/supersedes/dependency、Manifest分母、blueprint machine block、registry和现役inspector条款覆盖；未闭合禁止代码施工。
3. 代码CHANGE：运行受影响typecheck、Runtime/GPT/Browser acceptance与audit。
4. 主Codex两遍删除式自检：实际diff、调用方、consumer、错误分支、无第二链、WAL零删除、用户overlay零触碰。
5. 用户授权的独立只读审查者只审计，不写代码；发现finding则回主链修复并重新验收。
6. 按冻结`ci-full-governance`使用唯一入口：

   ```text
   npm run quality:check -- CHANGE
   npm run quality:check -- READY
   npm run quality:check -- RELEASE
   ```

   CI-FULL 按冻结 Skill 对两仓使用各自唯一入口闭合同一候选。READY/RELEASE必须使用clean Git commit；当前dirty overlay未处理前不得冒充READY。不得开分支、不得新建worktree、不得用局部命令冒充唯一quality verdict。

## 12. 删除审判

| 单元 | 当前必要性/消费者 | 删除反事实 | 裁决 |
|---|---|---|---|
| Runtime读取父`current_attempt_id` | Browser locator需要知道已完成结果属于哪次attempt | 删除即重现跨历史revision多义 | KEEP |
| `acceptedAttemptId`进程内字段 | GPT/Browser唯一handoff消费 | 删除后Store无法精确筛选 | KEEP |
| Browser SQL attempt过滤 | 唯一WAL读回 | 删除即当前三工单100%失败 | KEEP |
| Provider effect七字段身份 | Browser at-most-once与当前effect recovery | 加attempt会产生第二现实submit资格 | KEEP unchanged |
| 历史WAL行 | 现实副作用与审计事实 | 删除会损失已发生事实、掩盖上游历史 | KEEP immutable |
| Website新字段/合同版本 | 无消费者必要性 | 删除仍可完整闭环 | DELETE FROM PLAN |
| 数据清退脚本/常驻清退能力 | 无合法当前需求 | 删除仍可完整闭环且保留证据 | DELETE FROM PLAN |
| 第二locator/store/registry | 无消费者必要性 | 删除仍可完整闭环 | DELETE FROM PLAN |
| compatibility/feature flag/dual-read | 原位原子替换即可 | 删除仍可完整闭环 | DELETE FROM PLAN |
| Product Flow改动 | locator是基础设施断裂 | 删除仍可完整闭环并保护用户overlay | DELETE FROM PLAN |

## 13. 停止、失败与回退

- 用户已授权本方案列明的law-amendment；若施工时目标法条或依赖闭包漂移到授权范围外，停止并重新确认，不自动扩大。
- provider/consumer contract版本漂移：`CANONICAL_CONTRACT_CONFLICT`，停止并重开受影响设计。
- 用户overlay与目标路径重叠且无法安全分离：`CANDIDATE_DRIFT`，停止。
- Runtime不能从completed parent稳定读取attempt，或completed任务可被换attempt：`END_TO_END_CLOSURE_UNPROVEN`，停止，不退回清库方案。
- exact completed attempt内本身多条CONFIRMED：保持`AMBIGUOUS`，不得自动删除或latest选择；由Browser typed failure回Website现役恢复/人工处置边界。
- 修改后当前effect recovery任何验收退化：回退本次候选差异，不回退`379dd3431`整提交。
- RELEASE外部条件不可用：CHANGE/READY如实结束，RELEASE返回证据缺失，不伪造完成。

回退是Git原生回退本次原子候选；不保留feature flag、dual-read、旧新locator并存或兼容wrapper。

## 14. 执行 Codex 重绑定清单

实际施工前必须：

1. 完整读取 AGENT 与 Website 根 `AGENTS.md`、两仓冻结说明书、命中 active law 及全部反向依赖、三份 AGENT blueprint、Website AI-Acceptance/System blueprint 与两份跨仓 contract/dependency。
2. 重新记录两仓realpath/branch/HEAD/tracking/dirty state；保护本方案列出的用户overlay。
3. 重新执行只读SQL证明三个父任务仍completed、其`current_attempt_id`在`article_synthesis`范围各唯一一条CONFIRMED；不得写库。
4. 搜索全部`providerContinuationParent`、`readUniqueConfirmedConversationUrl`、`parentAttemptId`、相关错误码、audit lawId引用和所有调用方，确认施工面没有漂移。
5. 从两仓 generated registry 重算反向法案依赖闭包，与第 8 节逐项比较；有增减即停止并重绑候选。
6. 先完成工单 1—3 并由主 Codex 自检两遍；两仓法案、施工图、Manifest、registry 与 audit 未原子一致前禁止进入工单 4。
7. 按工单 4—8 顺序施工；不得修改本方案非目标路径。
8. 完成分层验收、主 Codex 两遍自检、独立只读审计，再进入唯一 CI-FULL 链。

本方案的“可施工”只表示设计分母、Owner、handoff、失败分支和验收已经闭合，不表示代码已修改、CHANGE已通过、READY、RELEASE或生产全链路已经完成。
