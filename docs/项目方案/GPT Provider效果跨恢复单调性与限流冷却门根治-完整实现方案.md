# GPT Provider 效果跨恢复单调性与限流冷却门根治—完整实现方案

## 0. 方案状态与唯一结论

状态：**可施工**。本状态只表示设计无未决断口，不代表代码已修改、质量已通过或生产已发布。

本轮是第 3 版重构，授权人明确指令：**不做任何"基于复查结果推断已经成功"的恢复逻辑**（不新增 DOM 复查、不把 `REJECTED` 升级成 `CONFIRMED`、不新建 Browser 侧"中央 preflight"架构——第 2 轮 Codex 重构版提出的这个工单经核实在 `browser-target-lease-manager.ts` 里没有对应现役实现，本轮直接删除，不重新论证）；**已经发生、无法按现役单调事实自然收敛的存量工单，唯一允许的处置是从数据库物理删除该工单记录，不手动/自动恢复**。本方案按这两条约束重新设计，是最短、风险最低的版本。

**根因不变**：AGENT 在三个独立出口把已经发生的 Provider 效果错误降级成 `mutation_outcome=no / browserEffect=null`，导致 Website 唯一失败账本（`(job_id, attempt_id)` 幂等约束）被前后矛盾的事实占位，触发 `AI_PRODUCTION_ATTEMPT_FAILURE_IDEMPOTENCY_CONFLICT`（409）或让 job 陷入永久重试。

**本版与前两版的关键差异**：

| | 第 1/2 版（Claude） | 第 2 轮重构版（Codex） | 本版（第 3 版） |
|---|---|---|---|
| `REJECTED+confirmed` 处理 | 零点击复查，命中则升级为 `CONFIRMED` | 原样失败关闭，仍尝试获取浏览器/走完整原子步骤读回链路 | 原样失败关闭，**不获取浏览器**，`submitEffect` 一返回就地失败关闭 |
| 限流冷却门无效果分支 | 尝试对"确定零提交"额外分类 | 新建 Browser 中央 preflight 承接 observation-only 弹窗 | **删除**——preflight 机制未核实存在，不在本方案内新建；只做"有效果就保留"这一项 |
| 存量卡死工单 | 诊断脚本 + 人工在"恢复/取消"间裁决 | 诊断只读，处置留白 | **直接物理删除**该工单的数据库记录，不诊断"能否恢复"，因为已经不允许恢复 |

## 1. 需求、业务终点与非目标

### 1.1 业务终点

1. 一旦 Browser WAL 证明某次 Provider 提交的物理输入已经发生（`effectScope=provider_effect` 且 `browserOutcome` 为 `DISPATCHED`/`CONFIRMED`/`REJECTED`），AGENT 在该 Attempt 内的任何后续失败出口，上报给 Website 的事实必须**原样携带**这个效果的 `providerEffectIdentityHash`/`effect_scope`/`browser_outcome`/`mutation_outcome`，不得降级为 `no/null`，不得伪造成另一个 `browserOutcome`。
2. Provider 侧物理输入增量在所有恢复/装饰/冷却路径中恒为零——不追加点击，也不通过复查把一个未确认的状态包装成确认。
3. `REJECTED`（不论 `dispatched` 还是 `confirmed`）的唯一合法去向是：原样失败关闭，保留同一 accepted attempt，交给 Website 现役 `sameEffectReadback` 重新排队等待下一次人工/自然干预；**AGENT 不做也不能做"这次是不是真的成功了"的判断**。
4. 对于已经产生且无法用上述单调事实自然收敛的存量工单（即使本方案落地也不会自愈的），唯一处置是从 Website 数据库物理删除该工单记录。

### 1.2 非目标

- 不新增任何"根据观察结果推断成功"的逻辑，不新增 `REJECTED→CONFIRMED` 的路径（内存态或 WAL 态都不行）。
- 不新建 Browser 侧"中央限流 preflight"或任何新的检测/投影机制；`browser-target-lease-manager.ts` 本方案不修改。
- 不修改 `contract.ts`、`production-atomic-readback.ts`、`submit_exact_gpt_turn_once/handler.ts`——REJECTED 分支不再进入原子步骤读回链路，这些文件不需要改。
- 不修改 Website 的 `attemptFailureAllowsNewAttempt`/`ensureSameFailure`/`sameEffectReadback`，不修改现役法案或施工图——已核实现役判据正确、法条已生效覆盖目标行为。
- 不手动或自动"恢复"任何存量工单；对无法自愈的存量工单，只做物理删除，不重放、不改写、不猜测其真实结果。
- 不诱发真实限流、不操作生产浏览器；本方案是纯代码改动 + 一次授权范围明确的数据库删除操作。

## 2. 输入证据与权威

- 现役法案：`.github/instructions/agent-rules/功能法案.md` 的 `LAW-GPT-002-V23` / `FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001`（已核实：`provider_effect+DISPATCHED/CONFIRMED` 及 `REJECTED+dispatched/confirmed` 均要求"保留同一 accepted attempt并零 submit读回"；本方案的"读回"就是 Website 现役 `sameEffectReadback` 排队重试，不要求 AGENT 自己去确认真假）。
- 现役代码（本轮重新逐一读取确认未漂移）：`src/capabilities/gpt/production-child-result.ts`、`production-browser-lifecycle.ts`、`production-child-tools.ts`、`production-child-support.ts`、`production-rate-limit-closure.ts`、`src/lib/local-runtime/production/executor.ts`。
- Website 只读引用：`services/api/src/ai-production/job-lifecycle-core.ts`（`attemptFailureAllowsNewAttempt`）、`job-failure-history.ts`（`ensureSameFailure`）、`job-lifecycle-repository.ts`（`sameEffectReadback`）、`packages/ai-contracts/src/production-control/v6-write-assertions.ts`（`RESULT_SETTLED_UNUSABLE` 契约）。
- 本地 SQLite（`.grasseye-local/browser/browser-mutations.sqlite`、`.grasseye-local/production-runtime.sqlite`）与 Website 本地 Postgres（`xuanshu`，unix socket peer 认证，非远程）：直接查询验证下列生产事实。
- 已核实与本方案不重叠的既有方案：`docs/项目方案/GPT提示词空格投影与Target-Local恢复闭环-完整实现方案.md`（修的是 Website 侧 `target_local+REJECTED` 误判，已落地，本方案不重开）。

生产实锤：

- `aiprod_ae196681-...`（attempt `bd195c0d-...`）：Website 已存首条失败事实是 `BROWSER_POSTCONDITION_FAILED/confirmed/provider_effect_identity_hash=sha256:be6afde4...`——完整、正确。是**之后**每次重试触发的 `submitEffect` 拒绝（产出 `no/null`）与这条正确旧事实打架导致 409，不是旧事实本身坏。
- `aiprod_e5acfa72-...`（attempt `1c8177fb-...`）：WAL 早已 `CONFIRMED`，但 Website 唯一存的失败事实是 `BROWSER_TARGET_INVALID/no/null`——首条事实本身就是坏的，任何后续正确上报都会跟它冲突，代码修复无法让它自愈。
- `PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE` 历史命中 3 次（2026-09-15，两个 job），均 `no/null`；两个 job 最终各烧 6 次失败、lease_version 到 7-10 才换新 attempt 脱困——不是死锁，是同病根的损耗形态。

## 3. Scoped Candidate

- 需求 Owner：AGENT（`/Users/nexgen/Documents/AGENT`），`main` 分支，施工前必须重新执行 `git rev-parse HEAD` 与 `git status --short` 核对下列路径未漂移（本文档写作时确认干净）。
- 允许施工路径：
  - `src/capabilities/gpt/production-child-result.ts`
  - `src/capabilities/gpt/production-child-tools.ts`
  - `src/capabilities/gpt/production-browser-lifecycle.ts`
  - `src/capabilities/gpt/production-child-support.ts`
  - `src/capabilities/gpt/production-rate-limit-closure.ts`
  - `src/lib/local-runtime/production/executor.ts`
  - 既有验收：`src/capabilities/gpt/acceptance/gpt-production-browser-mismatch.acceptance-support.ts`、`gpt-production-browser-wait.acceptance-support.ts`、`gpt-production-cause-chain.acceptance.ts`
- 明确不修改：`contract.ts`、`production-atomic-readback.ts`、`production-atomic-call.ts`、`production-call-preparation.ts`、`children/submit_exact_gpt_turn_once/handler.ts`、`src/lib/browser/**`（含 `browser-target-lease-manager.ts`）、任何法案、任何施工图、Website 仓任何文件。
- Website 仓只读引用，不修改任何文件。
- 存量工单删除（工单 4）单独走 §7 的授权与执行流程，不在上面的代码 scoped candidate 内。

## 4. 现役实现重建

### 4.1 断裂点 1：`submitEffect()` 拒绝合法 terminal REJECTED

`production-child-result.ts:16-26` 的 `submitEffect` 只接受 `CONFIRMED+confirmed` 与 `DISPATCHED+dispatched`，对 `REJECTED+dispatched` 和 `REJECTED+confirmed+physicalInputCount=1`（这是 `browser-mutation-receipt.ts` 的 `decodeDispatchedMutationReceipt` 对"点击已物理发生、后置条件未读到"的标准编码，所有点击类 intent 通用）一律 `throw GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH`，不带证据。

调用方 `readConfirmedSubmit()`（`production-child-tools.ts:117-176`）已经确认过一个关键事实：`prior.outcome==="DISPATCHED"` 且 `inputHash` 不匹配时，现役代码本来就在**获取浏览器之前**直接 `throw`（`production-child-tools.ts:154-157`）。这是一个已经存在的"无需碰浏览器即可失败关闭"先例，本方案对 REJECTED 复用同一先例，不是新发明。

`readConfirmedSubmit` 的调用方（`src/plugins/*/flow.ts` 里 `await flow.readConfirmedSubmit(submit); if (!submitResult) { ...从零重新准备并再次点击... }`）证实：**`readConfirmedSubmit` 返回 `null` 会触发一次全新的物理提交**。这是本方案必须让 REJECTED 分支**抛错而不是返回 `null`** 的硬性正确性依据，不是风格选择——返回 `null` 会导致真实的二次点击。

### 4.2 断裂点 2：`decorateSettledResultFailure` 与 `settleGptExecution`

`production-browser-lifecycle.ts:192-207` 只在 `confirmedProviderEffect` 与 `settledResultPayloadHash` 同时存在时装饰错误。已确认提交但答案未 settle 完时的 Target/等待/park/清理/进程退出故障，原样裸抛。`executor.ts:41-53` 的 `settleGptExecution` 在 `primaryError===null` 时更是完全跳过装饰。

Website 契约（`v6-write-assertions.ts:53-57`）对 `RESULT_SETTLED_UNUSABLE` 强制要求非空、合法的 `settled_result_payload_hash`；`ai-production-v6-contract.test.ts:589` 同步拒绝 `null`。因此本方案**不得**在没有 settled hash 时把错误码改成 `RESULT_SETTLED_UNUSABLE`，只能保留原始错误码并附加 `browserEffect`。

### 4.3 断裂点 3：`closeKnownProviderRateLimit`

`production-rate-limit-closure.ts:68` 在 ack 流程结束后无条件 `throw PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE`，不带 metadata，不区分当前 execution 是否已有 `confirmedProviderEffect`。

## 5. 有限闭环分母

| 前序 / 事件 | Owner 决定 | 权威输出 | Website 终态 |
|---|---|---|---|
| 无 prior effect | 正常主链 | 允许准备并至多一次 submit | 按真实结果裁决 |
| `DISPATCHED+dispatched` | 现役 `dispatchedProviderEffectReadback`（**本方案不改**） | fresh DOM 证明则原位 CONFIRMED，不能则原样失败关闭 | 同 accepted attempt零 submit读回 |
| `CONFIRMED+confirmed` | 现役 `confirmedProviderEffectReadback`（**本方案不改**） | 直接消费已落地 payload | 成功入库或同 effect readback |
| `REJECTED+dispatched` 或 `REJECTED+confirmed+physicalInputCount=1` | `submitEffect` 原样返回 fact，`readConfirmedSubmit` **不获取浏览器**、就地失败关闭 | typed failure 携带原 `providerEffectIdentityHash`/`browserOutcome:"REJECTED"`/`mutationOutcome` | 保留同一 accepted attempt，Website `sameEffectReadback` 排队重试；永不自动判定成功 |
| `REJECTED+no+physicalInputCount=0`（真未发生） | `submitEffect` 拒绝（不变） | `GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH` | 走正常首次提交路径，不受本方案影响 |
| confirmed effect 存在、settled hash 未有，Target/park/settle故障 | `decorateSettledResultFailure`/`settleGptExecution` 装饰 | 原始错误码 + `mutationOutcome:"confirmed"` + `browserEffect`，`settled_result_payload_hash:null` | 同 effect readback |
| confirmed effect 存在，限流冷却收口 | `closeKnownProviderRateLimit` 装饰 | `PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE` + `browserEffect` | 同 effect readback |
| confirmed effect 不存在，限流冷却收口 | 现役行为不变 | 普通失败（`no/null`） | 字段缺失分支，Website 保留 attempt（现役行为，本方案不优化） |
| Website 历史失败行已被 `no/null` 污染、无法自愈 | 授权人（数据库操作） | 物理删除该工单 | 工单从系统消失，不重放、不猜测 |

## 6. 唯一目标链与删除审判

**目标链**：Browser WAL 真实 fact → `submitEffect` 原样返回（REJECTED 不升级、不获取浏览器）→ `readConfirmedSubmit`/`decorateSettledResultFailure`/`closeKnownProviderRateLimit` 三个出口各自原位补一次"有 effect 就装饰"→ Runtime 序列化一次 → Website 唯一账本消费。存量无法自愈的工单直接物理删除，不接入任何恢复链。

删除审判：

| 单元 | 必要性 | 删除后果 | 裁决 |
|---|---|---|---|
| `submitEffect` 接受 REJECTED 两种组合 | `readConfirmedSubmit` 需要原样 fact 才能装饰 | 继续无证据拒绝，409 循环持续 | **ADD**，原位扩展 |
| `readConfirmedSubmit` REJECTED 分支就地失败关闭（不获取浏览器） | 避免二次点击、避免多余的浏览器获取失败模式 | 若走现役浏览器获取路径，多一层不必要的失败面 | **ADD**，原位分支，复用已有的"获取浏览器前失败关闭"先例 |
| `decorateSettledResultFailure` 放宽守卫 | 唯一让"confirmed 未 settle"窗口保留证据的位置 | 该窗口持续裸抛 | **原位修改** |
| `settleGptExecution` 补齐 `primaryError===null` 分支 | settle 自身失败时唯一的证据保留位置 | 100% 丢证据 | **原位修改**，需给 `ProductGptExecution`/`GptExecutionLifecycle` 各加一个只读字段 |
| `closeKnownProviderRateLimit` 有效果分支装饰 | 唯一让限流收口保留已有效果的位置 | 断裂点 3 持续复现 | **原位修改** |
| Browser 中央 preflight（第 2 轮提出） | 现役 `browser-target-lease-manager.ts` 无对应实现，本方案未核实其必要性 | 不影响本方案任何验收 | **删除，不重建** |
| REJECTED 零点击复查/内存升级 CONFIRMED（第 1/2 版提出） | 违反授权人本轮明确指令 | 无 | **删除，不重建** |
| 存量工单诊断脚本 + 人工在恢复/取消间裁决（第 2 版提出） | 已不允许"恢复"这个选项 | 无 | **删除**，改为直接删除数据库记录 |

## 7. 原子工单

### 工单 1：`submitEffect` 接受 REJECTED，`readConfirmedSubmit` 就地失败关闭

- Owner：`src/capabilities/gpt`。
- 范围：`production-child-result.ts:16-26`；`production-child-tools.ts` 的 `readConfirmedSubmit`（`:117-176`）。
- 动作：
  1. `submitEffect` 新增两个合法 terminal 形状：`outcome==="REJECTED" && mutationOutcome==="dispatched" && terminalAt存在 && providerEffectIdentityHash存在`；`outcome==="REJECTED" && mutationOutcome==="confirmed" && physicalInputCount===1 && terminalAt存在 && providerEffectIdentityHash存在`。两种都原样返回 `browserOutcome:"REJECTED"`，不做任何升级。
  2. `readConfirmedSubmit` 的 `try` 块内、现役 `if (prior.outcome === "DISPATCHED" && existing.inputHash !== currentAtomicIdentity.inputHash) { throw ...; }` 检查**紧邻处**新增一行：`if (prior.outcome === "REJECTED") { throw executionFailure("failed", "GPT_PROVIDER_EFFECT_REJECTED_TERMINAL"); }`——放在 `try` 块最前面，在任何 `browserFor*` 获取之前，逻辑位置与现役 `DISPATCHED` 早退检查完全对称，不新增控制流模式。这个 `throw` 会被 `try` 块外层现役的 `catch (error) { throw gptExecutionFailure(failureCode(error, ...), {mutationOutcome: effect.mutationOutcome, evidence:{...}, browserEffect: effect, cause: error}); }`（本方案不改这个 catch）自动接住并用 `effect`（工单 1 第 1 点产出）装饰——`failureCode(error, ...)` 会从新抛出的 typed error 里正确取出 `GPT_PROVIDER_EFFECT_REJECTED_TERMINAL`，不落到 fallback 码。全程不获取浏览器、不进入 `executeOne`。新码 `GPT_PROVIDER_EFFECT_REJECTED_TERMINAL` 不复用 `GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH`（那个码语义是"身份不匹配"，不是"效果已知但后置条件被拒绝"）。
  3. `REJECTED+no`、`physicalInputCount` 非 1（对 confirmed 分支）、字段缺失/矛盾，继续走现役 `GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH` 失败关闭。
- 完成门槛：同一 effect 的 `readConfirmedSubmit` 调用永不产生第二次物理点击；REJECTED 分支不出现任何 `browserFor*`/`executeOne` 调用；抛出的 failure 携带原 `providerEffectIdentityHash`/`browserOutcome:"REJECTED"`/`mutationOutcome`。
- 验收方向：
  1. 构造 `REJECTED+confirmed+physicalInputCount=1` → 断言抛出 `GPT_PROVIDER_EFFECT_REJECTED_TERMINAL`，`browserEffect.browserOutcome==="REJECTED"`，零 `browserFor*`/`executeOne`/CDP 调用。
  2. 构造 `REJECTED+dispatched` → 同上。
  3. 构造 `REJECTED+confirmed+physicalInputCount=0` → 断言仍是现役 `GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH`（证明未过度放宽）。
  4. 对照组：删除工单 1 的新分支后，用例 1/2 必须重新失败。

### 工单 2：confirmed effect 对所有后续失败单调（settle/park 窗口）

- Owner：`src/capabilities/gpt`（`production-browser-lifecycle.ts`）+ Runtime（`executor.ts`）+ `production-child-support.ts`。
- 范围：`production-browser-lifecycle.ts:192-207`；`executor.ts:41-53` 及调用点 `:328-331`；`production-child-support.ts` 的 `ProductGptExecution` 与 `executor.ts` 的 `GptExecutionLifecycle` 各新增一个只读字段暴露 `confirmedProviderEffect`。
- 动作：
  1. `decorateSettledResultFailure` 守卫从"`confirmedProviderEffect` 与 `settledResultPayloadHash` 都要有"改成只判 `confirmedProviderEffect`。**不得**在 `settledResultPayloadHash` 缺失时使用 `RESULT_SETTLED_UNUSABLE`（Website 契约硬性拒绝）；保留原始错误码，只挂 `mutationOutcome:"confirmed"`/`evidence`/`browserEffect`，`settled_result_payload_hash` 维持 `null`。
  2. `settleGptExecution` 在 `primaryError===null` 且 settle 自身失败、且 `confirmedProviderEffect` 非空时，套用同一装饰后再抛。
- 完成门槛：`confirmedProviderEffect` 存在、`settledResultPayloadHash` 为空的故障不再裸抛，且错误码保持原始值；`settleGptExecution` 的 `primaryError===null` 分支同样携带证据。
- 验收方向：
  1. `confirmedProviderEffect` 已设置、`settledResultPayloadHash` 为空，触发 Target/park 故障 → 断言错误保持原始码、携带 `browserEffect`、序列化后 `settled_result_payload_hash` 为 `null`。
  2. `primaryError` 全程为 `null` 但 settle 本身抛错、此前已有 `confirmedProviderEffect` → 断言错误携带证据。
  3. 对照组：两者都为空时行为不变。
  4. Website 契约回归：断言 `code !== "RESULT_SETTLED_UNUSABLE"` 时序列化结果的 `settled_result_payload_hash` 恒为 `null`（只读引用 `v6-write-assertions.ts`，不修改）。

### 工单 3：限流冷却门保留已有效果

- Owner：`src/capabilities/gpt`（`production-rate-limit-closure.ts`）。
- 范围：`production-rate-limit-closure.ts:68`；调用点 `production-child-tools.ts` 的 `executeOne` 限流分支（`:399-405`）。
- 动作：`closeKnownProviderRateLimit` 增加入参 `confirmedProviderEffect: GptChildBrowserFact | null`；`incident.deliver(...)` 完成后，若非空，`throw` 前套用工单 2 同一套装饰（保留 `PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE` 原始码，只挂 `browserEffect`）；为空时现役行为不变——不新建任何"零提交诚实分类"或"中央 preflight"，这部分已被本轮明确排除（见 §0/§6）。
- 完成门槛：限流弹窗出现在已确认提交之后时，冷却失败携带真实效果证据；出现在之前时行为完全不变。
- 验收方向：
  1. `confirmedProviderEffect` 已设置时触发限流关闭 → 断言失败携带效果证据，码仍为 `PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE`。
  2. `confirmedProviderEffect` 为空时触发限流关闭 → 断言失败与现役行为逐字节一致（无 `browserEffect`）。

### 工单 4：存量无法自愈工单的物理删除（需授权人当次确认，属于数据库删除操作）

- Owner：授权人 + AGENT（执行只读诊断与授权后的删除动作）。
- 范围：Website `xuanshu` 数据库（本地 Postgres，unix socket peer 认证）的 `ai_production_jobs`/`ai_production_job_runtime`/`ai_production_job_failures`/`ai_production_job_materials`/`ai_production_output_artifacts`/`ai_production_job_events` 等与目标 `job_id` 相关的行；不涉及 AGENT 代码改动。
- 前置：工单 1-3 落地后，先只读复核一遍当前所有 `failed` 且已过期未恢复的 V6 job，确认哪些在新代码下**仍然**无法自愈（即 Website 已存首条失败事实缺 `provider_effect_identity_hash` 或与 WAL 不一致，参照 §2 生产实锤对 `e5acfa72` 的判定方法）；哪些能自愈（如 `ae196681`）不列入删除范围，交给现役重试自然收敛。
- 动作：
  1. 对判定"无法自愈"的每个 `job_id`，先输出一份只读清单（job_id、当前状态、卡死原因、首条失败事实摘要），交授权人逐条或批量确认。
  2. 获得确认后，按外键依赖顺序删除该 `job_id` 在上述表中的全部行（子表先删，`ai_production_jobs` 最后删，或使用现役 `ON DELETE CASCADE` 若已覆盖——施工时需先读 schema 确认级联范围，不得假设）。
  3. 删除前必须对目标行做一次快照导出（例如 `pg_dump` 或简单 `select` 落盘到本地文件），保留证据以备事后追溯，不属于"恢复机制"，只是删除前的审计留痕。
  4. 该操作是不可逆的生产数据库删除，执行前必须由授权人在当次会话内明确确认要删除的具体 `job_id` 列表，不得批量无差别删除超出确认范围的行。
- 完成门槛：确认范围内的 `job_id` 从数据库中完全消失，不再出现在任何查询、监控或重试队列里；快照文件已留存。
- 验收方向：删除后重新查询这些 `job_id`，确认返回零行；确认其它未列入删除范围的 job 不受影响（行数、内容不变）。

## 8. 施工顺序与停止条件

顺序：工单 1 → 工单 2（可与 1 并行）→ 工单 3（依赖工单 2 的装饰逻辑）→ 工单 4（独立，随时可先做只读诊断，删除动作需等授权）。

停止条件：

- 任何时候施工需要把 `REJECTED` 判定为成功、需要复查 DOM、需要新建 Browser 检测/投影机制——立即停止，这是本轮被明确禁止的方向。
- 工单 2 绝不允许 `settledResultPayloadHash` 缺失时使用 `RESULT_SETTLED_UNUSABLE`。
- 工单 4 的删除动作没有获得授权人对具体 `job_id` 列表的当次明确确认——不得执行。
- 相关 scoped candidate、Website 契约文件漂移——先重新核对再继续。
- 质检失败只围绕同一原生失败修复，不扩大改动面。

## 9. 分层验收

1. **静态**：§7 各工单验收并入 `acceptance:gpt`，通过 AGENT `npm run quality:check -- CHANGE` 与 `READY`。
2. **发布**：`RELEASE` 通过。
3. **动态**（只读观测，不诱发真实限流）：新产生的 `REJECTED` 终态事件上报后，Website 侧对应失败事实携带非空 `provider_effect_identity_hash`；同 job 后续重试不再新增 409（仅限"首条事实本身正确"的 job，如 `ae196681` 类）。
4. **业务终点**：`ae196681` 类在下一次自然重试后不再 409；`e5acfa72` 类若仍判定无法自愈，进入工单 4 删除流程；删除完成后对应 `job_id` 不再出现在任何 Website 查询中。

## 10. 施工重绑定要求

1. 先读 AGENT 根目录 `AGENTS.md`，只在 `main` 上施工，不开分支，不修改 Website 仓任何文件。
2. 施工前重新核对 §3 scoped candidate 未漂移。
3. 按 §8 顺序执行；工单 4 的删除动作严格按 §7 工单 4 的授权流程，不得跳过确认步骤。
4. 只用原生 `npm run quality:check`；本方案不修改法案或施工图，不需要 `GRASSEYE_LAW_AMENDMENT_AUTHORIZED`；不删除生产代码文件（只删数据库行，且在工单 4 独立授权），若原生质检仍触发任一授权门，停止并交回用户判断。
5. 本方案末尾追加"施工记录"，不另建报告。
