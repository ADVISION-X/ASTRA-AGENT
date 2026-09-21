# GPT Provider 效果跨恢复单调性与限流冷却门根治—完整实现方案

## 0. 方案状态与唯一结论

状态：**可施工**（结构预算已核：`submitEffect` 现 16 行、`readConfirmedSubmit` 现 62 行、`production-atomic-readback.ts` 现 123 行、`production-rate-limit-closure.ts` 现 69 行，本方案每处改动均为几行级别的原位扩展，无一接近现役 75 行/复杂度 16 红线，不需要在工单内预先重构）。本轮只完成方案设计，未施工代码；施工前仍需按 §12 重新核对候选未漂移。

本方案根治的是同一类架构病灶在 AGENT 侧的三个独立触发点：**已经物理发生的 Provider 效果，在跨 lease 恢复、跨故障装饰、限流冷却收口三条路径上都可能被 AGENT 自己"忘记"，向 Website 报出一个抹掉该效果的失败事实**，导致 Website 唯一失败账本（`ai_production_job_failures`，`(job_id, attempt_id)` 唯一约束）被错误事实占位，后续任何真实事实都会撞上 `AI_PRODUCTION_ATTEMPT_FAILURE_IDEMPOTENCY_CONFLICT`（409），形成永久或高损耗的 lease 续租循环。

现役 Website 判据（`FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001`，见 §5）与本次读到的 `attemptFailureAllowsNewAttempt` 实现**已经正确**：`provider_effect + DISPATCHED/CONFIRMED` 与 `provider_effect + REJECTED + dispatched/confirmed` 都会被 Website 保留同一 accepted attempt、只允许零 submit 读回。本方案**不修改 Website、不修改该法条**——唯一 GAP 在 AGENT：三个 Owner 内的具体函数在特定前序状态下，从未把真实的 `effect_scope/browser_outcome/mutation_outcome` 组装出来，而是提前失败关闭或裸抛，丢失了本该受法条保护的效果事实。

三个断裂点：

1. `submitEffect()`（`src/capabilities/gpt/production-child-result.ts:16-26`）——同 Attempt 恢复读回（`readConfirmedSubmit`）遇到 `provider_effect + REJECTED + confirmed + physicalInputCount=1`（点击已物理发生，后置条件未读到）时，无条件 `throw GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH`，不携带任何效果证据。
2. `decorateSettledResultFailure()`（`src/capabilities/gpt/production-browser-lifecycle.ts:192-207`）——只在 `confirmedProviderEffect` 与 `settledResultPayloadHash` 同时存在时才装饰错误；Provider 已确认提交但答案尚未 settle 完时发生的 Target/等待/park/清理/进程退出故障，原始错误未装饰直接上抛。`executor.ts` 的 `settleGptExecution`（`:41-53`）在 `primaryError` 为 `null` 时更是完全跳过装饰链条，直接裸抛 `settle`/park 自身的异常。
3. `closeKnownProviderRateLimit()`（`src/capabilities/gpt/production-rate-limit-closure.ts:68`）——已知限流弹窗 ack 完成后无条件 `throw PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE`，不区分当前 execution 是否已有 `confirmedProviderEffect`；有的话，这条失败一样会把已确认的效果抹成 `no + null`。

本次读到的三处生产实锤（本地 `browser-mutations.sqlite`、Website 本地 Postgres `xuanshu`，均为直接查询，非转述）：

- `aiprod_ae196681-...`（attempt `bd195c0d-...`，当前 lease_version=43，已过期未恢复）：WAL 行 `state=REJECTED, mutation_outcome=confirmed, physical_input_count=1`；Website 首条失败事实是正确的 `BROWSER_POSTCONDITION_FAILED/confirmed`，随后同 attempt 重试命中断裂点 1，产生 `no/null` 与既有事实冲突，进入 409 循环。
- `aiprod_e5acfa72-...`（attempt `1c8177fb-...`，当前 lease_version=45，已过期未恢复）：WAL 行 `state=CONFIRMED, mutation_outcome=confirmed` 于 14:53:49 落地；16 分钟后（15:10:20）Website 唯一记到的失败事实是 `BROWSER_TARGET_INVALID/no`，命中断裂点 2（`settledResultPayloadHash` 当时尚未落地，装饰未生效）。
- `PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE` 历史命中 3 次（2026-09-15，job `aiprod_f2366c41-...`、`aiprod_8eb366b9-...`），全部 `mutation_outcome=no`；两个 job 最终 `status=completed`，但各自烧掉 6 次失败、lease_version 涨到 7～10 才靠换新 attempt_id 脱困——不是断裂点 1/2 那种永久死锁，是同病根的另一种损耗形态，命中断裂点 3。

**设计阶段的一处自我修正**：`docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md` 限流冷却门段落"不终止任何在途 job"，字面上讨论的是冷却门机制本身不得级联终止或取消 job（`cancel_requested`），不是"这次 attempt 不能失败"——job 与 attempt 是两层概念，一次 attempt failure 之后 Website 正常签发新 attempt 不构成"终止 job"。因此断裂点 3 与该施工图字面**没有**直接冲突；真正违反的仍是 `FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001`（已确认效果被抹除）。本方案按此更正后的理解设计，不再引用"与施工图冲突"作为断裂点 3 的裁决依据。

## 1. 需求、业务终点与非目标

### 1.1 业务终点

同一 Attempt 内，一旦 Browser WAL 证明 Provider 效果已经发生（`effectScope=provider_effect` 且 `browserOutcome` 为 `DISPATCHED`/`CONFIRMED`，或 `REJECTED` 但 `mutationOutcome=confirmed` 且 `physicalInputCount=1`），AGENT 在该 Attempt 的任何后续故障路径（同 Attempt 恢复读回、Target/等待/park/清理/进程退出、限流冷却收口）上报给 Website 的失败事实，必须**单调保留**这个效果身份（`providerEffectIdentityHash`）与其 `effect_scope/browser_outcome/mutation_outcome`，不得降级为 `no/null`。Provider 侧物理输入增量在整个恢复过程中恒为零。

### 1.2 非目标

- 不修改 Website 的 `attemptFailureAllowsNewAttempt`/`ensureSameFailure`/`sameEffectReadback`——已核实正确，且受 `FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001` 保护，本方案不触碰。
- 不新增状态机、队列、恢复 Owner、兼容桥、第二 WAL、第二失败账本。
- 不处理 `target_local` 范畴的效果（`open_gpt_model_selector_v2` 等非 `provider_effect` Child）——它们的 `REJECTED` 本来就该结束旧 attempt，现役行为正确。
- 不处理"点击确实完全没有物理发生"（`physicalInputCount=0`）的情况——这类仍然是真正的普通失败，`submitEffect` 必须继续拒绝，不得放宽。
- 不处理已卡死的两个存量 job（`ae196681`、`e5acfa72`）的人工恢复——那是运维动作，不在代码方案范围内；本方案落地后它们会在下一次心跳/续租时按新逻辑上报真实事实，交给 Website 既有判据处理。
- 不解冻任何 FROZEN 法条——`FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001` 已经正确覆盖目标行为，AGENT 只是尚未合规；本方案是让实现追上已生效的法条，不是修改法条本身。

## 2. 输入证据

- 用户提供的两份第三方（Codex）只读诊断报告，经本会话逐条代码级复核（文件、行号、函数体）与生产数据库直接查询验证，细节见 §0 与 §4。
- 本地 `.grasseye-local/browser/browser-mutations.sqlite`（`browser_mutations` 表）与 `.grasseye-local/production-runtime.sqlite`（`production_tasks` 表）：直接 `sqlite3` 查询。
- Website 本地 Postgres（`xuanshu`，unix socket peer 认证，`~/Library/Application Support/Xuanshu/PostgreSQL/profiles/xuanshu-api.json` 描述的连接档案，非远程）：`ai_production_job_failures`、`ai_production_job_runtime` 表直接 `psql` 查询。
- 现役代码：`src/capabilities/gpt/production-child-result.ts`、`production-browser-lifecycle.ts`、`production-child-tools.ts`、`production-call-preparation.ts`、`production-atomic-call.ts`、`production-atomic-readback.ts`、`production-rate-limit-closure.ts`、`children/submit_exact_gpt_turn_once/handler.ts`、`src/lib/local-runtime/production/runtime-claim.ts`、`terminal-failure.ts`、`executor.ts`；Website `services/api/src/ai-production/job-failure-history.ts`、`job-lifecycle-core.ts`、`job-lifecycle-repository.ts`。
- 现役法案：`.github/instructions/agent-rules/功能法案.md` 的 `LAW-GPT-002-V23`（含 `FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001`）。
- 现役施工图：`docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md`、`docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md`。
- 相关既有方案（已核实为不同 GAP，见 §4.5）：`docs/项目方案/GPT提示词空格投影与Target-Local恢复闭环-完整实现方案.md`（2026-09-11～09-15，修的是 Website 侧 `target_local+REJECTED` 误判，已落地且与本方案 GAP 不重叠）。

## 3. Scoped Candidate

- 需求 Owner：AGENT（`/Users/nexgen/Documents/AGENT`），当前分支 `main`，HEAD `1adab1398`。
- 本方案目标文件（写方案时逐一确认与当前 `git status` 无交集，未漂移）：
  - `src/capabilities/gpt/production-child-result.ts`
  - `src/capabilities/gpt/production-browser-lifecycle.ts`
  - `src/capabilities/gpt/production-child-tools.ts`
  - `src/capabilities/gpt/production-atomic-readback.ts`
  - `src/capabilities/gpt/production-rate-limit-closure.ts`
  - `src/lib/local-runtime/production/executor.ts`
  - 对应验收：`src/capabilities/gpt/acceptance/gpt-production-browser-lifecycle.acceptance.ts`、`gpt-production-browser-wait.acceptance-support.ts`、`gpt-production-browser-mismatch.acceptance-support.ts`、`gpt-production-artifact-recovery.acceptance-support.ts`
- **当前工作树存在与本方案无关的并行改动**（另一会话在制品，13 个文件/新方案，均在 `scripts/acceptance/`、`gpt-exact-target-*`、`capability-governance` 审计域与两份新方案文档内，与本方案目标文件无路径交集）：只记录，不阻塞、不合并、不评论其正确性。写入本方案前逐一确认这些路径与上方目标文件列表无重叠。
- Website 仓（`xuanxue-web`）本方案**不修改任何文件**，只读引用其 `job-lifecycle-core.ts`/`job-failure-history.ts` 作为契约事实来源。

## 4. 现役实现重建（深度）

### 4.1 前序状态的唯一来源：Browser WAL 原子步骤读回

`submit_exact_gpt_turn_once` 的每次物理点击都由 `browser-mutation-store.ts` 的 `prepare()`/`markDispatched()`/`markConfirmed()`/`markRejected()` 写入 `browser_mutations` 表，`state` ∈ `{DISPATCHED, CONFIRMED, REJECTED}`。`browser-mutation-receipt.ts` 的 `decodeDispatchedMutationReceipt`（本会话 P1 工单已验证）规定：只要 `mutationCount===1`（CDP 物理点击已派发）且后置条件校验失败，产出 `terminal:"rejected", mutationOutcome:"confirmed", physicalInputCount:1`——这是**所有**基于点击的 intent 通用的标准编码，不是 submit 专属、也不是边界情况。

`readAtomicStepOutcome()`（`browser-mutation-store.ts:331`）是读这张表的唯一入口，返回 `state: "dispatched"|"confirmed"|"rejected"` 与完整的 `mutationOutcome/physicalInputCount/providerEffectIdentityHash/terminalPayload` 等字段。GPT 侧一切"前序效果是什么"的判断都必须以这个函数的返回值为准——它是本方案的 **identity spine 锚点**。

### 4.2 断裂点 1：`submitEffect()` 的二选一接受集

`production-child-result.ts:16-26`：

```ts
export const submitEffect = (prior, exactCallIdentityHash, childCapabilityId) => {
  const confirmed = prior.outcome === "CONFIRMED" && prior.mutationOutcome === "confirmed" && prior.terminalAt;
  const dispatched = prior.outcome === "DISPATCHED" && prior.mutationOutcome === "dispatched" && !prior.terminalAt;
  if (prior.effectScope !== "provider_effect" || (!confirmed && !dispatched) || !prior.providerEffectIdentityHash) {
    throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
  }
  return Object.freeze({ exactCallIdentityHash, providerEffectIdentityHash: prior.providerEffectIdentityHash,
    childCapabilityId, effectScope: "provider_effect", browserOutcome: prior.outcome,
    mutationOutcome: prior.mutationOutcome, terminalAt: prior.terminalAt,
    evidenceRef: prior.authorityRef, evidenceHash: prior.authorityHash });
};
```

调用方 `readConfirmedSubmit()`（`production-child-tools.ts:117-176`）在这一行**之外没有 try/catch**：

```ts
const effect = submitEffect(prior, exactCallIdentityHash, call.child);
try {
  ... // 取浏览器、执行 executeOne
} catch (error) {
  throw gptExecutionFailure(failureCode(error, ...), { mutationOutcome: effect.mutationOutcome, ... });
}
```

`prior.outcome === "REJECTED"` 时 `submitEffect` 直接抛出，`effect` 从未被赋值，连后面 catch 块里"至少把 effect 挂上"的兜底装饰都够不到——这是全链路里唯一一处，前序真实是 `provider_effect+REJECTED+confirmed` 却产出完全不带证据的失败的位置。

`GptChildBrowserFact.browserOutcome` 的类型本身**已经**允许 `"REJECTED"`（`contract.ts:38`），说明这不是类型系统的缺口，是这一处函数体的逻辑缺口。

### 4.3 浏览器目标获取模式的隐藏二分支

`readConfirmedSubmit()` 紧接着：

```ts
const active = await (prior.outcome === "CONFIRMED"
  ? browsers.browserForConfirmedReadback(...)
  : browsers.browserForRateLimitRecovery(...));
```

`browserForConfirmedReadback` 映射到 `targetMode: "confirmed-readback"`（`recoverySelectionRequired: true`，会重新 `selectExactGptConversation` 导航到已知 conversation——跨 lease/跨进程恢复时 Target 很可能已丢失，必须重新定位）。`browserForRateLimitRecovery` 映射到 `"bound-observation"`（`recoverySelectionRequired: false`，假设 Target/session 连续未变，不重新定位）。

这个二选一目前把"非 CONFIRMED 的一切"都路由到 `"bound-observation"`。一旦 `submitEffect` 放行 `REJECTED`，这条路由必须同步扩成三态，否则会用错误的"假设 Target 连续"模式去处理一个很可能发生在全新 Target 上的恢复，导致后续 DOM 复查在错误的 conversation 上进行。

### 4.4 恢复执行链路：`executeOne` → 原子步骤读回

`readConfirmedSubmit` 拿到浏览器后调用 `this.executeOne(input, browsers, call, {priorEffectKnown: true, browserAtomicIdentity: atomicIdentity})`。`executeOne`（`production-child-tools.ts:370-434`）经 `production-call-preparation.ts` 的 `runProductionAtomicPhase` 进入 `production-atomic-call.ts` 的 `executeProductionGptAtomicCall`：

```ts
const priorOutcome = browser.readAtomicStepOutcome(atomicIdentity);
if (!priorOutcome) return await browser.runAtomicStep(atomicIdentity, () => gpt.execute(intent, context));
const readback = await readPriorAtomicOutcome({ gpt, intent, context, browser, priorOutcome });
if (readback) return readback;
throw executionFailure("failed", "GPT_ATOMIC_STEP_ALREADY_ATTEMPTED", {
  metadata: { mutationOutcome: priorOutcome.mutationOutcome,
    evidence: { evidenceRef: priorOutcome.authorityRef, evidenceHash: priorOutcome.authorityHash },
    browserEffect: { effectScope: ..., childCapabilityId, browserOutcome: priorOutcome.state.toUpperCase(),
      providerEffectIdentityHash: priorOutcome.providerEffectIdentityHash } },
});
```

这一层**已经**正确处理"已有前序结果、不得重新派发"的通用情况：`priorOutcome` 非空时绝不会二次 `runAtomicStep`（不会二次点击），`GPT_ATOMIC_STEP_ALREADY_ATTEMPTED` 分支的兜底也**已经**正确携带真实 `mutationOutcome`/`browserOutcome`/`providerEffectIdentityHash`——只是当 `readPriorAtomicOutcome` 对当前 `state` 没有匹配的读回策略时才会走到这个兜底。

`readPriorAtomicOutcome()`（`production-atomic-readback.ts`）目前只有四个策略，且只认 `submit_exact_gpt_turn_once` 的 `state==="dispatched"` 与 `state==="confirmed"`：

- `dispatchedProviderEffectReadback`：`state==="dispatched"` 时，零点击对 `submitted-user-turn`/`empty-composer` 做一次主动 DOM 复查，命中则调 `browser.resolvePendingMutation(...)` 把这条尚在 `DISPATCHED` 的 WAL 行判定为 `TERMINAL_SUCCESS`/`confirmed`，产出 CONFIRMED 结果。
- `confirmedProviderEffectReadback`：`state==="confirmed"` 且 `terminalPayload` 已落地时，直接消费该 payload 收敛，零 DOM 动作。
- 另两个是限流确认专用，与本方案无关。

**没有任何策略处理 `state==="rejected"`。** 这是本方案要新增的唯一读回分支（详见 §6、§9 工单 2）。它的设计必须复用 `dispatchedProviderEffectReadback` 已验证的"零点击主动 DOM 复查"模式，而不是发明新机制——差别只在于：`REJECTED` 行本身已经是终态（`terminal_at` 已写），不能再调 `resolvePendingMutation`（那是给仍处于 `DISPATCHED` 中间态的行用的）；复查命中时只需在内存中构造一个语义等价于"确认"的 `GptChildBrowserFact`（`browserOutcome` 如实保留 `"REJECTED"`，`mutationOutcome` 如实保留 `"confirmed"`，不得伪造成 `"CONFIRMED"`）交给上层继续；复查未命中时，必须携带真实证据失败关闭（走 `GPT_ATOMIC_STEP_ALREADY_ATTEMPTED` 兜底，该兜底已经正确）。

### 4.5 与既有方案的关系核实

`docs/项目方案/GPT提示词空格投影与Target-Local恢复闭环-完整实现方案.md`（2026-09-11～09-15 施工，现役已落地）修复的是 Website 侧 `providerEffectAllowsNewAttempt` 曾经忽略 `effect_scope/browser_outcome` 只看 `mutation_outcome` 的旧缺陷，产出了当前 `attemptFailureAllowsNewAttempt` 的正确实现，并首次把 `FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001` 的四格判定表写入法案。该方案的 GAP（Website 判据）与本方案的 GAP（AGENT 侧三处未合规的失败上报）**不重叠**：前者已核实完全落地且正确（本会话直接读代码确认），本方案不重开、不竞争，只引用其确立的判定表作为本方案 AGENT 侧必须对齐的目标契约。

### 4.6 断裂点 2 完整链路

`decorateSettledResultFailure()`（`production-browser-lifecycle.ts:192-207`）只在 `call.confirmedProviderEffect && call.settledResultPayloadHash` 同时为真时才把任意错误升格为 `RESULT_SETTLED_UNUSABLE`（携带 `mutationOutcome:"confirmed"`、`browserEffect`、`settledResultPayloadHash`）。它由 `production-child-tools.ts:113` 注册为 `decorateFailure`，在 `executor.ts:328`（`catch (error) { primaryError = gptLifecycle.decorateFailure?.(error) ?? error; throw primaryError; }`）调用一次。

两个未覆盖的窗口：

1. **已确认提交、答案未 settle 完**（`confirmedProviderEffect` 有，`settledResultPayloadHash` 还是 `null`）：Target 获取/等待/park/清理/进程退出中的任何故障，`decorateSettledResultFailure` 直接 `return error`（第 196 行 `if (!call?.confirmedProviderEffect || !call.settledResultPayloadHash) return error;`），原始错误未装饰上抛。`e5acfa72` 的 16 分钟窗口精确命中这里。
2. **`settleGptExecution`（`executor.ts:41-53`）自身抛错**：`finally` 块调用 `settleGptExecution(gptLifecycle, primaryError)`；若 `lifecycle.settle`（即 `browsers.settle`，park/清理逻辑）本身失败，且 `primaryError === null`（意味着 try 块本身没报错，是 settle 阶段独立失败），则 `throw settleError` 完全裸抛，不经过任何装饰，也没有 `AggregateError` 包装。这种情形理论上比 `e5acfa72` 的窗口更彻底：整个 GPT 执行本来是成功路径，只是收尾清理失败，效果证据被 100% 丢弃。

### 4.7 断裂点 3 完整链路

`closeKnownProviderRateLimit()`（`production-rate-limit-closure.ts:26-69`）在 `incident.deliver(...)` 完成后，无条件 `throw executionFailure("failed", "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE")`（第 68 行），不带 `metadata`。它由 `executeOne`（`production-child-tools.ts:399-405`）在检测到 `BROWSER_KNOWN_GPT_RATE_LIMIT` 时调用；调用点在 `runProductionAtomicPhase` 之后、`recordConfirmedSubmission` 之前——也就是说，**若本次 `executeOne` 正是 `submit_exact_gpt_turn_once` 本身撞上限流**（点击瞬间弹窗），`browserCall.confirmedProviderEffect` 此时确实还是 `null`（本次提交还没来得及被判定 CONFIRMED），走"普通失败"没问题；但**若限流弹窗出现在 submit 之后的后续步骤**（例如答案生成过程中弹出限流，或者是同一 execution 里稍后的其它 Child 撞上限流），`browserCall.confirmedProviderEffect` 这时已经是本次提交的真实效果，这条无条件 `throw` 就会覆盖掉它。

`runtime-claim.ts` 的 `persistAttemptFailure()` 通过 `serializeTerminalFailureTransport()`（`terminal-failure.ts:68-77`）把任意 `error` 序列化成 Website 失败事实；该函数本身逻辑正确（如实读 `executionFailureMetadata`），问题全部源自上游三处没有把 `metadata` 造出来。

## 5. 四维映射

| 维度 | 当前状态 | 与本方案的关系 |
|---|---|---|
| 法案 | `LAW-GPT-002-V23` 的 `FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001`：`provider_effect` 效果只有 `mutation_outcome=no` 才可结束旧 attempt，`DISPATCHED/CONFIRMED` 及 `REJECTED+dispatched/confirmed` 必须保留同一 accepted attempt 并零 submit 读回 | **已生效、已正确、不修改**。本方案是让 AGENT 实现合规，不是修改该条款的规范内容，**不需要解冻** |
| 施工图 | `WEBSITE-AGENT-V6-BLUEPRINT.md` 限流冷却门段落"不终止任何在途 job" | 字面讨论冷却门机制不得级联取消 job，与"当前 attempt 因限流失败走正常退避"不是同一件事，**不冲突、不需要修改**；`GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md` 目前没有任何段落描述 `REJECTED+confirmed` 的零提交读回路径——**需要新增一段机械描述**（只记录新分支的存在和触发条件，不改变任何判据文字） |
| 现役实现 | 三处断裂点见 §4.2/4.6/4.7；`GPT_ATOMIC_STEP_ALREADY_ATTEMPTED` 兜底与 `dispatchedProviderEffectReadback` 读回模式**已经正确**，可直接复用 | 本方案的全部代码改动 |
| 质检系统 | `acceptance:gpt`（`gpt-production-browser-lifecycle.acceptance.ts` 等）现役覆盖 `DISPATCHED`/`CONFIRMED` 前序恢复与限流 ack 流程；**没有**任何用例覆盖 `REJECTED+confirmed` 恢复、Target/settle 故障后效果证据保留、限流冷却门在已有效果时的证据保留 | §9 每个工单新增对应验收 |

## 6. Identity Spine 与有限闭环分母

**Identity spine**：`exactCallIdentityHash`（`browserExactCallIdentityHash({jobId, attemptId, writerFenceHash, resultRevision, productStepId, callId, childCapabilityId, inputHash, actionOrdinal})`）绑定到 `browser_mutations` 表的唯一行；该行的 `logical_mutation_id`（对外投影为 `providerEffectIdentityHash`）是同一次物理提交的 Provider 效果身份，跨 lease 续租、跨进程重启不变——这是本方案所有恢复判断和 Website 侧幂等比对共用的唯一锚点。

**有限闭环分母**（`submit_exact_gpt_turn_once` 的前序 WAL 终态 × 恢复路径，仅限 `effectScope==="provider_effect"`）：

| 前序状态 | 现役处理 | 终态 |
|---|---|---|
| 无前序记录（`readAtomicStepOutcome` 返回 `null`） | `runAtomicStep` 正常派发一次点击 | 现役不变 |
| `DISPATCHED + dispatched`（已提交未终态） | `dispatchedProviderEffectReadback`：零点击主动复查，命中 `resolvePendingMutation→confirmed`；未命中 `PROVIDER_EFFECT_OUTCOME_UNPROVEN` 失败关闭保留 attempt | 现役已闭合，不改 |
| `CONFIRMED + confirmed`（终态，`terminalPayload` 已落地） | `confirmedProviderEffectReadback`：直接消费 payload 收敛，零 DOM 动作 | 现役已闭合，不改 |
| **`REJECTED + confirmed + physicalInputCount=1`**（终态，物理输入已发生，后置条件未读到） | **无策略，`submitEffect` 提前无证据拒绝** | **本方案唯一新增分支**：零点击主动复查；命中→构造 `browserOutcome:"REJECTED", mutationOutcome:"confirmed"` 的等价确认结果继续推进；未命中→携带真实证据（`GPT_ATOMIC_STEP_ALREADY_ATTEMPTED` 既有兜底）失败关闭保留 attempt，零额外物理输入 |
| `REJECTED + no + physicalInputCount=0`（真正未发生） | `submitEffect` 拒绝 | **必须继续拒绝**，不在本方案放宽范围内——这类前序 WAL 层面本就允许 `prepare()` 重放，走正常首次提交路径 |
| 字段缺失/矛盾组合 | `submitEffect` 拒绝 | 现役不变 |

跨故障场景（同一 `atomicIdentity` 已有 `CONFIRMED`/`DISPATCHED`/`REJECTED+confirmed` 效果，但发生在 Target 获取/等待/park/settle/进程退出/限流冷却收口任一环节的独立故障）的分母：

| 故障发生点 | 现役 | 目标 |
|---|---|---|
| `decorateSettledResultFailure` 调用点，`settledResultPayloadHash` 已有 | 正确装饰为 `RESULT_SETTLED_UNUSABLE` | 不改 |
| 同上，`settledResultPayloadHash` 未有 | 未装饰裸抛 | **新增**：只要 `confirmedProviderEffect` 存在就装饰，不再要求 `settledResultPayloadHash` 同时存在 |
| `settleGptExecution`，`primaryError===null` 时 settle 自身失败 | 裸抛 `settleError` | **新增**：若 `lifecycle` 持有 `confirmedProviderEffect`（需要从 `browsers`/`gptExecution` 侧暴露只读访问），同样装饰后再抛 |
| 限流冷却收口，`confirmedProviderEffect` 为空 | 普通失败（`no/null`） | 不改——这是正确行为 |
| 限流冷却收口，`confirmedProviderEffect` 非空 | 无条件裸抛，抹掉效果 | **新增**：复用同一装饰机制携带效果证据 |

## 7. 合同 Handoff

**AGENT → Website（`appendAiProductionFailure`/`releaseAiProductionLeaseV6`）**：payload 字段 `mutation_outcome/effect_scope/child_capability_id/browser_outcome/provider_effect_identity_hash` 五元组的语义边界由 `FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001` 唯一定义，Website 端 `attemptFailureAllowsNewAttempt`/`ensureSameFailure` 已按此实现且正确。本方案的全部改动都发生在 AGENT 如何**构造**这五元组上，不改变字段的类型、取值范围或 Website 端的解释规则——是同一 canonical contract 下的实现补齐，不是合同变更，不需要跨仓协调、不需要双仓法案同步。

**GPT Child 内部（`GptExecutionContext`）**：`readPriorAtomicOutcome` 新增的 `rejectedProviderEffectReadback` 策略会给 `submit_exact_gpt_turn_once` 的 handler 传入一个新的 context 字段（沿用 `dispatchedProviderEffectReadback`/`confirmedProviderEffectReadback` 已有的"以 context 字段传入前序效果、handler 内部分支决定是否零点击复用"模式，不新增独立通道）。handler 侧需要新增一个与 `context.dispatchedProviderEffectReadback` 结构一致的分支，消费方式相同（零点击 DOM 复查 + `resolvePendingMutation` 等价确认），只是不再调用 `resolvePendingMutation`（该行已终态，改为直接构造内存态 `browserFact`）。

## 8. 删除审判

| 单元 | 当前必要性 | 真实消费者 | 删除后果 | 裁决 |
|---|---|---|---|---|
| `submitEffect()` 新增的 `REJECTED+confirmed` 分支 | 唯一能让同 Attempt 恢复读回不再提前无证据拒绝 | `readConfirmedSubmit` | 删除后 `ae196681` 类 409 循环持续复现 | **ADD**，原位扩展现有函数，不新建函数 |
| `readConfirmedSubmit` 浏览器模式三态路由 | `REJECTED` 前序需要与 `CONFIRMED` 相同的"可能换了 Target，需要 reselect conversation"处理 | 同上 | 不改会导致新 Target 上做零点击复查却停留在错误的 conversation | **ADD**，原位改三元表达式，不新增函数 |
| `readPriorAtomicOutcome` 新增 `rejectedProviderEffectReadback` 分支 | `REJECTED+confirmed` 是当前唯一没有读回策略的合法终态 | `executeProductionGptAtomicCall` | 不加则永远落到 `GPT_ATOMIC_STEP_ALREADY_ATTEMPTED` 兜底，job 永远拿不到真实答案，只能不断失败关闭直到人工介入 | **ADD**，复用 `dispatchedProviderEffectReadback` 已验证的零点击复查模式，不发明新机制 |
| `submit_exact_gpt_turn_once/handler.ts` 新增消费分支 | 上一条新增的 context 字段需要有唯一消费者 | Child 本身 | 不加则新增的 readback 策略永远返回 `null`（context 字段没人处理），退化成没做 | **ADD**，紧邻现役 `dispatched` 分支 |
| `decorateSettledResultFailure` 放宽装饰条件 | 唯一让"已确认但未 settle"窗口的故障保留证据的位置 | `executor.ts` 的 catch 块 | 不改则 `e5acfa72` 类窗口持续裸抛 | **原位修改**，删除 `settledResultPayloadHash` 存在性要求，不新建第二装饰函数 |
| `settleGptExecution` 新增装饰调用 | `primaryError===null` 分支目前完全绕过装饰 | `executor.ts` | 不改则 settle 自身失败时 100% 丢证据 | **原位修改**；需要新增一个只读访问器把 `confirmedProviderEffect` 暴露给 `executor.ts`（`ProductGptExecution`/`GptExecutionLifecycle` 接口各加一个字段），不新建存储 |
| `closeKnownProviderRateLimit` 条件化 throw | 唯一让限流收口在已有效果时保留证据的位置 | `executeOne` 的限流分支 | 不改则断裂点 3 持续复现（历史已发生 3 次） | **原位修改**，判断 `confirmedProviderEffect` 是否存在，复用同一装饰路径，不新建函数 |
| 新增验收用例（§9 各工单） | 当前完全没有覆盖这四条路径 | `acceptance:gpt` | 不加则回归时无法检测同类退化 | **ADD**，全部并入现役文件，不新建独立验收脚本 |

删除后重新反查：分母表（§6）的 `REJECTED+confirmed` 行、跨故障故障点表的四行、限流冷却门条件分支——每一行删掉任一工单都会导致业务终点（§1.1 单调保留效果）在对应场景失败，没有可以进一步删除的结构。没有新增抽象、接口、状态或持久化，全部是既有函数体的原位补全。

## 9. 原子工单

### 工单 1：`submitEffect` 接受 `REJECTED+confirmed` 并三态路由浏览器模式

- Owner：`src/capabilities/gpt`（AGENT）。
- 范围：`production-child-result.ts:16-26`（`submitEffect`），`production-child-tools.ts` 的 `readConfirmedSubmit` 浏览器模式选择三元表达式。
- 前置：无（首个工单）。
- 动作：
  1. `submitEffect` 增加第三个合法形状：`prior.outcome==="REJECTED" && prior.mutationOutcome==="confirmed" && prior.physicalInputCount===1 && prior.providerEffectIdentityHash`（字段名以 `BrowserExactCallMutationFact` 实际命名为准）。命中时返回的 `GptChildBrowserFact.browserOutcome` 如实为 `"REJECTED"`，不得伪装成 `"CONFIRMED"`。
  2. `readConfirmedSubmit` 的浏览器模式选择改为：`prior.outcome==="CONFIRMED" || prior.outcome==="REJECTED" ? browserForConfirmedReadback(...) : browserForRateLimitRecovery(...)`。
- 完成门槛：`submitEffect` 对 `REJECTED+no+physicalInputCount=0` 仍然拒绝；对 `REJECTED+confirmed+physicalInputCount=1` 返回正确 `GptChildBrowserFact`；浏览器模式对新分支路由到 `"confirmed-readback"`。
- 验收方向：单测/集成用例构造 `prior = {outcome:"REJECTED", mutationOutcome:"confirmed", physicalInputCount:1, ...}`，断言 `submitEffect` 不抛出且返回值字段完整；构造 `physicalInputCount:0` 的同一 outcome，断言仍然 `GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH`。

### 工单 2：`readPriorAtomicOutcome` 新增 `REJECTED+confirmed` 零点击读回策略

- Owner：`src/capabilities/gpt`。
- 范围：`production-atomic-readback.ts`（新增 `rejectedProviderEffectReadback`，并入 `readPriorAtomicOutcome` 的 `??` 链）；`children/submit_exact_gpt_turn_once/handler.ts`（新增消费分支）。
- 前置：工单 1（浏览器模式与 `submitEffect` 必须先放行，否则永远到不了这一层）。
- 动作：
  1. `rejectedProviderEffectReadback`：条件 `intent.childCapabilityId==="submit_exact_gpt_turn_once" && priorOutcome.state==="rejected" && priorOutcome.mutationOutcome==="confirmed" && priorOutcome.physicalInputCount===1 && priorOutcome.providerEffectIdentityHash`。命中时以 `input.context` 加一个新字段（例如 `rejectedProviderEffectReadback: priorOutcome`）调用 `gpt.execute`。
  2. handler 侧新增分支，逻辑与现役 `context.dispatchedProviderEffectReadback` 分支一致（零点击对 `submitted-user-turn`/`empty-composer` 观察、promptHash 比对、`canonicalConversationOrNull` 校验），**不调用** `resolvePendingMutation`（该 WAL 行已终态）；复查命中时直接用 `requireConfirmedBrowserFact`-同构的方式在内存里构造 `browserFact`（`browserOutcome:"REJECTED"`，`mutationOutcome:"confirmed"`，其余字段取自 `priorOutcome`），产出 `status:"CONFIRMED"` 结果；复查未命中（`promptHash` 不等或 `canonicalConversationUrl` 无效）时 `throw executionFailure("failed", "PROVIDER_EFFECT_OUTCOME_UNPROVEN")`，交回上层——此时会自然落到 `executeProductionGptAtomicCall` 现役的 `GPT_ATOMIC_STEP_ALREADY_ATTEMPTED` 兜底（已正确携带证据），不需要新增额外失败路径。
- 完成门槛：`REJECTED+confirmed` 复查命中时零点击、零导航、零 WAL 写入即可收敛为 CONFIRMED；未命中时失败关闭携带真实 `provider_effect+REJECTED+confirmed` 证据，Provider 输入增量恒为零。
- 验收方向（对应报告要求的"目前完全没有验收覆盖"的场景）：
  1. 构造 `priorOutcome.state==="rejected"` 且复查命中 → 断言产出 CONFIRMED 结果，零 `click`/`Input.dispatch*` 调用。
  2. 同上但复查未命中 → 断言失败码携带 `mutationOutcome:"confirmed"`、真实 `providerEffectIdentityHash`，且零物理输入调用。
  3. 对照组：删除工单 2 的分支后，用例 1 必须重新失败（证明验收确实依赖该分支，不是巧合通过）。

### 工单 3：`decorateSettledResultFailure` 放宽装饰条件，`settleGptExecution` 补齐裸抛分支

- Owner：`src/capabilities/gpt`（`production-browser-lifecycle.ts`）+ AGENT Runtime（`src/lib/local-runtime/production/executor.ts`）。
- 范围：`production-browser-lifecycle.ts:192-207`；`executor.ts:41-53`（`settleGptExecution`）及其调用点 `:328-331`；`GptExecutionLifecycle`/`ProductGptExecution` 相关接口新增一个只读效果访问器。
- 前置：无（与工单 1/2 独立，可并行）。
- 动作：
  1. `decorateSettledResultFailure` 的守卫条件从 `!call?.confirmedProviderEffect || !call.settledResultPayloadHash` 改为只判 `!call?.confirmedProviderEffect`；`settledResultPayloadHash` 缺失时，`RESULT_SETTLED_UNUSABLE` 的 `metadata.settledResultPayloadHash` 字段按 `call.settledResultPayloadHash ?? null` 填入（不再强制要求非空）。需要同步确认 Website 端消费该字段时对 `null` 的容忍度（只读检查，不修改 Website；若 Website 端已经把它当可选字段处理则无需协调）。
  2. `production-child-tools.ts` 的 `ProductGptExecution`（`createExecution` 返回值）新增一个只读字段，暴露当前 `activeBrowser?.call?.confirmedProviderEffect`（不暴露整个 `ProductionGptBrowserCall`，只暴露这一个已经是公开类型的字段）。
  3. `executor.ts` 的 `GptExecutionLifecycle` 类型新增对应字段；`settleGptExecution` 在 `primaryError === null` 分支，`settleError` 抛出前，若该字段非空，套用与 `decorateFailure` 相同的装饰逻辑（可直接复用 `gptExecution.decorateSettledResultFailure`，因为它此时仍在闭包作用域内可访问，不需要新函数）。
- 完成门槛：`confirmedProviderEffect` 存在、`settledResultPayloadHash` 为空时的故障不再裸抛；`settleGptExecution` 在 `primaryError===null` 且 `confirmedProviderEffect` 存在时的 settle 自身失败也携带证据。
- 验收方向：
  1. 构造 `confirmedProviderEffect` 已设置、`settledResultPayloadHash` 为 `null`，触发 Target/park 故障 → 断言最终错误为 `RESULT_SETTLED_UNUSABLE` 且携带正确 `browserEffect`。
  2. 构造正常执行成功（`primaryError` 全程为 `null`）但 `settle` 本身抛错、且此前已有 `confirmedProviderEffect` → 断言最终错误携带证据，不再是裸的 `settleError`。
  3. 对照组：`settledResultPayloadHash` 与 `confirmedProviderEffect` 都为空时，故障保持原样普通失败（证明没有过度放宽）。

### 工单 4：限流冷却门条件化证据保留

- Owner：`src/capabilities/gpt`（`production-rate-limit-closure.ts`）。
- 范围：`production-rate-limit-closure.ts:68`；调用点 `production-child-tools.ts` 的 `executeOne` 限流分支（`:399-405`）。
- 前置：工单 3（复用同一套"是否已有 `confirmedProviderEffect`"判断与装饰机制）。
- 动作：`closeKnownProviderRateLimit` 增加一个入参（当前 `browserCall`，用于读 `confirmedProviderEffect`），`incident.deliver(...)` 成功后，若 `confirmedProviderEffect` 存在，`throw` 前套用同一装饰（复用工单 3 暴露的访问器/装饰函数，不新建）；不存在时保持现役行为不变。
- 完成门槛：限流弹窗出现在已确认提交之后时，冷却失败携带真实效果证据；出现在提交之前时行为不变（仍是普通失败，Website 正常退避新 attempt）。
- 验收方向：
  1. 构造 `browserCall.confirmedProviderEffect` 已设置时触发限流关闭 → 断言失败携带效果证据。
  2. 构造 `confirmedProviderEffect` 为空时触发限流关闭 → 断言失败仍是现役的普通 `PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE`（无 `browserEffect`），证明未过度改变现役行为。

### 工单 5：施工图补记

- Owner：AGENT 文档。
- 范围：`docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md`。
- 前置：工单 1-4 代码落地并通过验收（施工图记录现役实现，不能先于实现写）。
- 动作：在现役 submit 身份/恢复段落紧邻处新增一段机械描述："同 Attempt 恢复读回遇 `provider_effect+REJECTED+confirmed+physicalInputCount=1` 时，零点击主动复查同一 `submitted-user-turn`/`empty-composer` 断言，命中收敛为确认结果，未命中携带该效果证据失败关闭保留 attempt；不得二次物理提交。" 不改变任何判据文字，只记录已经存在（本方案落地后）的实现路径，与 `FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001` 的四格判定表保持一致。
- 完成门槛：施工图文字与代码行为一一对应，原生质检的施工图-代码一致性检查（若该域启用）通过。

## 10. 分层验收

1. **静态**：§9 每个工单的新增/修改用例并入 `acceptance:gpt`，通过 AGENT `npm run quality:check -- CHANGE` 与 `READY`。
2. **发布**：`RELEASE` 通过。
3. **动态**（RELEASE 后，只读读取 Browser WAL 与 Website `ai_production_job_failures`/`ai_production_job_runtime`）：
   - 任一新产生的 `provider_effect+REJECTED+confirmed` 事件之后，同 job 的下一条 Website 失败事实必须携带非空 `provider_effect_identity_hash` 且 `mutation_outcome ∈ {dispatched, confirmed}`，不得再出现 `no+null` 组合。
   - 同一 job 在效果确认后的连续 lease 续租/重试中，`ai_production_job_failures` 不再新增 `AI_PRODUCTION_ATTEMPT_FAILURE_IDEMPOTENCY_CONFLICT`（409）计数（需要 Website 侧只读观测，不新增埋点，直接查现役表）。
   - 限流冷却命中且此前已有确认效果时，对应失败事实的 `mutation_outcome`/`provider_effect_identity_hash` 与冷却前一致。
4. **业务终点**：本方案落地后，`ae196681`/`e5acfa72` 这两个存量 job 在下一次自然心跳/续租时，AGENT 上报的失败事实（如果仍未能 settle）必须变为携带真实证据的 `provider_effect+REJECTED/CONFIRMED+confirmed`，不再产生新的 409；它们的最终业务完成（或人工介入）不在本方案范围内。

## 11. 停止规则

- 工单 3 需要给 `ProductGptExecution`/`GptExecutionLifecycle` 新增字段；若走查发现这两个接口已被当前工作树内并行的其它改动触碰（施工前必须重新 `git status`/`git diff` 复核 §3 列出的目标文件），先重算受影响部分，不强行合并。
- 若 Website 端对 `settled_result_payload_hash: null` 的 `RESULT_SETTLED_UNUSABLE` 消费存在未预期的强校验（工单 3 完成门槛里标注的"只读检查"发现问题），停止工单 3 的该子项，改为只装饰 `mutation_outcome`/`browserEffect`，`settledResultPayloadHash` 维持现役"不装饰"处理，并在方案里记录这一收窄。
- 质检失败时只围绕同一原生失败修复，不扩大改动面。

## 12. 施工 Claude 重绑定要求

1. 先读 AGENT 根目录 `AGENTS.md`，只在 `main` 上施工，不开分支，不修改 Website 仓任何文件。
2. 施工前重新执行 §3 的 `git status`/目标文件交集检查，确认与当前工作树的并行改动仍无交集；如有交集，先停止并重新评估。
3. 严格按 §9 顺序：工单 1 → 工单 2 → 工单 3（可与 1/2 并行）→ 工单 4 → 工单 5（必须最后）。
4. 只用原生 `npm run quality:check`；每次提交前先跑 `CHANGE`。本方案不涉及法案条文修改，不需要 `GRASSEYE_LAW_AMENDMENT_AUTHORIZED`；不涉及删除生产文件（全部是原位函数体修改），预期不需要 `GRASSEYE_PRODUCTION_DELETE_AUTHORIZED`；若实际触发任一授权门，停止并交回用户判断，不自行设置。
5. 本方案末尾追加"施工记录"，不另建报告。
