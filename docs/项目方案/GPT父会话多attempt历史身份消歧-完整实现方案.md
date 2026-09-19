# GPT 父会话多 attempt 历史身份消歧—完整实现方案

## 0. 方案状态与唯一结论（第 2 版，推翻第 1 版）

**设计阻断，等待用户对一条具体法条的解冻授权；解冻前不写任何代码。**

第 1 版方案（"追加 attempt_id 过滤维度到 `readUniqueConfirmedConversationUrl` 查询"）已经过独立子智能体对抗性审计，**FAIL**，原因是这条查询被至少 4 处独立、明确、刻意设下的边界锁死："只能按 4 个维度查询"的法条原文（`功能法案.md:732`）、同一法条紧邻的重复限定（`:1018`）、专门点名 `attempt_id` 只能做"本地诊断事实、不得改变 effect identity"的法条（`:1051`）、以及两处**机器强制**的现役 audit 门禁（`scripts/audit/domains/gpt/gpt-provider-contract-inspection.ts`、`scripts/audit/domains/local-browser-session/target-claim-inspection.ts`，两者的 `forbidden` token 列表逐字包含 `"parentAttemptId"` 与 `"job_id=? and attempt_id=? and product_step_id=?"`，`checkId` 直译即"父续接定位器不得含 attempt"）、以及施工图正文的明文一句"**父attempt不参与定位**"（`LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md:43`）。六处独立证据一致指向同一个结论：**"查询侧只能用 4 个维度、不含 attempt_id"是被反复、多层刻意锁定的设计决策，不是遗漏，不能通过任何遣词造句绕过，本方案不会再尝试**。

本版方案改变修复落点：**不碰查询侧（`readUniqueConfirmedConversationUrl` 保持原样、零改动），改为让"父工单在任一时刻至多存在一条 CONFIRMED provider effect"这个查询侧法条本来就已经预设的不变量，在数据源头真正成立**——即父工单的旧 attempt 被 Website 判定作废、新 attempt 被签发时，把旧 attempt 在 `browser_mutations` 里已经 CONFIRMED 的行同步清退，而不是任其永久堆积。这个方向不再触碰第 1 版被锁死的那 6 处边界中的任何一处（详见 §4.2），但会触碰另一条独立的、专门限定"WAL 删除唯一授权是 Website 判定 job 不存在"的法条（`LAW-AGENT-PRODUCTION-RUNTIME-005-V35`，`:268`）。这条法条同样是冻结/唯一授权类条款，**必须由用户以 AGENTS.md 规定的解冻原文明确批准后，本方案才能进入可施工**。本方案不会在未获批准的情况下自行解读"这条也不用解冻"——第 1 版已经因为这种自行解读被审计推翻过一次。

## 1. 需求、终点与范围

### 1.1 触发事实

2026-09-19 15:22–18:51 的运行取证复核发现 5 个独立工单（`aiprod_054f1199-154e-41af-82ab-0b4a574d1635`、`2a03a520-80e1-4a09-a598-5055f4420912`、`3b0c51fa-d16e-405a-b635-044e68ea0dbc`、`b2b7e83c-97f1-47d4-a582-b940124c3629`、`f0675f47-454e-4cee-a10f-c78238a10916`，均为 `localization_article_translation/article_translation`、`target_locale=zh-HK`，provider_continuation 关系）在 `gpt-child` 启动后 11–30ms 内即失败：`failure.code=BROWSER_PARENT_PROVIDER_EFFECT_AMBIGUOUS`。`production_tasks.current_reason=WAIT_NEW_ATTEMPT`，Website 现役退避会自动重试，但每次重试预期仍会确定性再次命中同一根因（不会自愈）。

### 1.2 已验证根因（数据库解密实证，已通过独立审计复现核实）

对这 5 个工单的 `task_json.parent_task_ref` 指向的父工单（原始中文 `article_synthesis` 三段式任务：`corpus_research → article_synthesis → article_image_generation`），用 `.grasseye-local/browser/browser-mutation.key` 对 `.grasseye-local/browser/browser-mutations.sqlite` 中
`job_id=<父job> and product_step_id='article_synthesis' and call_id='turn-submit' and child_capability_id='submit_exact_gpt_turn_once' and effect_scope='provider_effect' and state='CONFIRMED'`
的全部行解密（AES-256-GCM，AAD=`provider:${command_id}`，与 `browser-mutation-payload.ts` 现役解密路径一致），读出真实 `canonicalConversationUrl`：

| 父工单 | CONFIRMED 行数（＝历史 attempt 数） | 互不相同的会话 URL 数 |
|---|---|---|
| `aiprod_f74d48b2-9a80-4a23-9281-26aafb2487fc` | 7 | 7 |
| `aiprod_b97776d7-bb05-4fd7-b111-a861aca18e9f` | 9 | 9 |
| `aiprod_0b4e387c-d004-4638-b64b-de1b70e5a5a6` | 3 | 3 |
| `aiprod_cf6dd6fd-aed1-4394-901b-dd80da3647f1` | 2 | 2 |
| `aiprod_4e0da619-cb07-4f5f-99d0-8889793703ce` | 8 | 8 |

`production_tasks` 核实：5 个父工单均 `status='completed'`，`current_attempt_id` 精确等于（5/5）时间上最后一条 CONFIRMED 行的 `attempt_id`——即 Website 的 admission 结果与 AGENT 本地状态是一致的：只有**最后一个** attempt 是真正被接纳的，其余 2–8 个更早的 attempt 都已经是"被作废、又开了新 attempt"的历史遗迹，只是它们各自当年成功提交时写下的 CONFIRMED 行从未被清理，一直留在 WAL 里，让查询侧此后永远读到多个候选。

父工单 `created_at`→`updated_at` 跨度最长超过 30 小时，说明这些旧 attempt 不是"同一次执行内的重试"，而是**跨越很长时间、多次被重新签发的独立 attempt**，每次都要重新走完整个三步 Provider 流程。

### 1.3 完成终点

1. 父工单进入"旧 attempt 被作废、新 attempt 被签发"这一 AGENT 本地已确定能观测到的状态转换时，旧 attempt 在 `browser_mutations` 中已 CONFIRMED 的 provider_effect 行被同步清退（不清退 target_local 行、不清退其它 job、不清退当前 attempt 的行）。
2. 清退后，`readUniqueConfirmedConversationUrl` 保持代码不变，在任一时刻对同一 `(job_id, product_step_id)` 至多只能查到一条 CONFIRMED 行，`urls.size` 恒为 0 或 1，`BROWSER_PARENT_PROVIDER_EFFECT_AMBIGUOUS` 不再可能被触发（数学上不可能，不是概率降低）。
3. 已经产生的 5 个父工单的历史多 attempt 数据，作为独立的一次性回填动作按同一机制清退（旧 attempt 均已确认作废，清退没有时序风险）。

### 1.4 非目标

- 不改变 `readUniqueConfirmedConversationUrl` 的查询代码、签名或语义——第 1 版已被否决的方向，不再重提。
- 不修复"父工单为什么会被反复判定需要开新 attempt"这条上游因果链本身；已确认 Website 仓存在独立进行中的相关工作（§5），本方案不重复建设。
- 不新建第二 WAL、第二 store、continuation checkpoint 或恢复队列。
- 不删除或清退 `target_local` 行、不清退当前 attempt 或其它 job 的任何行。
- 不跨仓：Website 契约、法案、施工图零修改。

## 2. Scoped candidate

| 仓库 | branch/HEAD | tracking | dirty |
|---|---|---|---|
| `/Users/nexgen/Documents/AGENT` | `main` / `42643572967f5c9f193e54ad16036a45687d566c` | `origin/main` 同 HEAD | 存在与本方案目标路径重叠的良性漂移：`src/capabilities/gpt/acceptance/gpt-production-browser-lifecycle.acceptance.ts` 的 lawId 版本号更新（`V20→V21`），经核实与本方案功能无关；其余非目标路径的已跟踪文件修改照旧存在 |
| `/Users/nexgen/Documents/xuanxue-web` | `main` / `941e91a842b4388c96216f39a43927c4a128e949` | `origin/main` 同 HEAD | 存在未提交的进行中改动（`job-lifecycle-core.ts` 等，见 §5），与本方案范围不重叠 |

施工前必须重新执行：
```
git status --porcelain=v1 -uno | grep -E "browser-mutation-store|store-task-state|store-foundation|runtime-business-admission"
```
当前（写本版方案时）核对为空。

## 3. 现役实现重建（深度）

### 3.1 涉及的现役结构

```text
production-runtime Owner（AGENT 本地 production_tasks 状态机）
  store-task-state.ts:56-80  acceptClaim() 内部：
    已存在的"job 从 failed 状态被重新签发新 attempt"分支（:72-79）：
      this.database.prepare(`update production_tasks
        set current_attempt_id=?, current_reason='LEASE_GRANTED',
          staged_result_json=null, attempt_failure_json=null, updated_at=?
        where job_id=? and status='failed'`).run(attemptId, now(), task.job_id);
    -- 这一步已经是 AGENT 本地对"旧 attempt 被新 attempt 取代"的唯一、确定性观测点：
       attemptId（新）与 existing.current_attempt_id（旧）在同一事务内均可得

local-browser-session Owner（Browser mutation WAL）
  browser-mutation-store.ts:270-276  purgeJob(jobId) —— 现役已有的整 job 删除能力
    delete from browser_mutations where job_id=?
    -- 现役唯一调用方：runtime-business-admission.ts:44-51 purgeDeletedJob()
    -- 现役唯一触发条件：Website 判定该 job_id 在其权威系统中不存在（websiteJobAbsent）
```

**第一直接断裂（延续 §1.2）**：`acceptClaim()` 在同一事务里已经同时持有"旧 attempt_id"（`existing.current_attempt_id`）和"新 attempt_id"（参数 `attemptId`），这正是"旧 attempt 被取代"这一事实第一次、也是唯一一次在 AGENT 本地被确定性观测到的时刻，但当前代码只更新 `production_tasks` 自己这张表，完全不通知 `local-browser-session` Owner 去清退旧 attempt 在 WAL 里已经写下的 provider_effect CONFIRMED 行。

**第二直接断裂**：`purgeJob(jobId)` 现役只支持整 job 粒度删除，且唯一合法触发条件被 `LAW-AGENT-PRODUCTION-RUNTIME-005-V35`（`:268`）限定为"Website job absence"；本方案需要的是**更窄**的粒度（只清退一个 job 内被取代的旧 attempt 的 provider_effect 行，job 本身继续存在、继续跑新 attempt），且触发条件是"attempt 被取代"而不是"job 不存在"——现役完全没有这个能力，也没有被这条法条授权。

### 3.2 GAP 判定：直接复用 vs 新增

- **直接复用**：`purgeJob` 已经证明"local-browser-session Owner 允许接受 production-runtime Owner 发起的、以 job_id 为身份的删除请求"这个跨 Owner 通道是现役、已验收的模式；新增的 `retireSupersededAttempt(jobId, supersededAttemptId)` 只是同一通道下更窄粒度的姊妹方法，不新增 Owner、不新增跨 Owner 通道种类。
- **不构成表结构新增**：只是新增一条 `delete from browser_mutations where job_id=? and attempt_id=? and effect_scope='provider_effect' and state='CONFIRMED'` 语句（复用现有列，不新增列、不新增索引）。
- **真正的新增**：法条授权范围本身——现役 `:268` 只认"job absence"一种删除触发条件，本方案需要新增"attempt superseded"这第二种触发条件。这是本方案唯一需要新增的东西，且必须走解冻，不得回避。

## 4. 四维映射

| 维度 | 现状 |
|---|---|
| 法案系统 | `LAW-AGENT-PRODUCTION-RUNTIME-005-V35`（`:268`，"Website job absence 是该本地 job 的唯一删除授权"）需要扩展删除触发条件；`LAW-AGENT-PRODUCTION-RUNTIME-006`（`purgeJob`/`purgeBrowserJob` 现役实现所在法）需要同步扩展方法集 |
| 施工图 | 需要核对 `docs/blueprints/local-browser-session/**` 与 `docs/blueprints/xuanxue-ai-production/**` 中是否有对 `purgeJob`/WAL 删除范围的镜像描述（见 §7 工单 0） |
| 现役实现 | `store-task-state.ts:56-80`（触发点）、`browser-mutation-store.ts:270-276`（现役 purgeJob 实现，姊妹方法落点）、`runtime-business-admission.ts`（现役唯一跨 Owner 调用范式参照） |
| 质检系统 | 需要新增/核对是否存在类似 §0 提到的 forbidden-token 审计门禁专门锁定 `purgeJob`/WAL 删除范围（见 §7 工单 0，第 1 版已经在这类门禁上吃过亏，本版必须先查清楚再设计，不能重蹈覆辙） |

### 4.2 与第 1 版 6 处边界的关系核对（防止"换个说法绕过审计"）

| 第 1 版被否决的边界 | 本版是否触碰 | 论证 |
|---|---|---|
| `:732`／`:1018`"authorized-continuation 只能按 4 维度查询" | 否 | `readUniqueConfirmedConversationUrl` 代码零改动，查询维度不变 |
| `:1051`"attempt_id 只作本地诊断事实，不得改变 effect identity" | 否 | 本方案不把 attempt_id 传入任何"定位 effect"的查询或判断逻辑；attempt_id 只用于"清退哪些行"这个删除范围界定，删除动作发生在查询之前、与查询逻辑无交互 |
| 两处 forbidden-token audit 门禁（`parentAttemptId`、`attempt_id=?...product_step_id=?`） | 否 | 本方案不修改 `browser-mutation-store.ts` 里 `readUniqueConfirmedConversationUrl` 的源码文本，不会触发这两处按源码文本扫描的 forbidden token |
| 施工图"父attempt不参与定位" | 否 | 本方案不改变"定位"这个动作本身，只改变定位之前 WAL 里存在哪些行 |

**独立审计员在第 2 轮必须重新核实以上每一格，不得采信本表的自我判断。**

## 5. 上游因果定性（不在本方案闭环范围，第 1 版已记录，本版保留但降级确定性）

父工单三步 GPT 提交全部真实成功之后仍被整体作废、开全新 attempt 重做，是 §1.2 数据的源头。已核实 Website 仓 `services/api/src/ai-production/job-lifecycle-core.ts`（`attemptFailureAllowsNewAttempt`）与 `job-expired-attempts.ts` 存在未提交的进行中改动（`git blame` 全部标注 `Not Committed Yet`）。**独立审计指出：这个函数当前逻辑（`REJECTED` 类失败才允许新 attempt）并不直接解释"三步全部 CONFIRMED 后仍被作废"这一现象**，两者的关联性未被完全证实，本节表述降级为"疑似关联、待核实"，不作为本方案裁决依据。本方案的闭环（§1.3）不依赖这条上游因果是否已被修复、修复到什么程度——无论上游因果解决与否，只要旧 attempt 被判定作废这个状态转换本身在 AGENT 本地可观测（`current_attempt_id` 变化），本方案的清退机制就能生效。

## 6. Identity spine 与有限分母

```text
父 job_id
  -> production_tasks.current_attempt_id 从 OLD 变为 NEW（AGENT 本地已有的、Website 驱动的确定性事实）
  -> 触发 retireSupersededAttempt(jobId, OLD)
  -> browser_mutations: delete where job_id=? and attempt_id=OLD and effect_scope='provider_effect' and state='CONFIRMED'
  -> 该 (job_id, product_step_id) 组合此后至多剩一条 CONFIRMED 行（属于 NEW 或此后的 attempt）
  -> readUniqueConfirmedConversationUrl 零改动，天然恒定返回 0 或 1 个 URL
```

| 分支 | Owner | 终态 |
|---|---|---|
| 旧 attempt 没有任何 CONFIRMED provider_effect 行（本来就没走到那一步） | local-browser-session | 删除 0 行，无副作用 |
| 旧 attempt 有 CONFIRMED provider_effect 行 | local-browser-session | 精确删除该 attempt 的这些行，其余不动 |
| 旧 attempt 有 DISPATCHED（未终态）provider_effect 行 | local-browser-session | **不在本方案清退范围**——DISPATCHED 是否应一并清退，属于 §3.3（第 1 版遗留、本版未重新论证）的独立问题，本方案不合并处理，留待清楚论证后再决定，避免在同一工单里引入未经充分推演的第二个改动 |
| job 本身被 Website 判定不存在 | local-browser-session | 现役 `purgeJob` 全量删除路径不变，与本方案新增的窄粒度删除互不冲突（一个删一整个 job，一个只删一个 job 内的一个旧 attempt） |

## 7. 原子工单

### 工单 0（前置，先做，不涉及代码）— 核实是否存在类似第 1 版遇到的机器门禁

- **目标**：在设计定稿为"可施工"之前，穷尽搜索是否有现役 audit 脚本已经把"`purgeJob` 只能由 `purgeDeletedJob` 调用"或"WAL 删除只能整 job"这类限制做成了 forbidden-token 或调用方白名单检查。
- **动作**：`grep -rn "purgeJob\|purgeBrowserJob\|websiteJobAbsent" scripts/audit/ tests/governance/`，逐个读懂每一处命中的检查逻辑，而不是只看是否命中。
- **完成门槛**：书面列出"是/否存在此类门禁"及其具体内容，写入本方案 §4 表格的"质检系统"行，供独立审计核实。

### 工单 1（前置，等待授权，不得提前写代码）— 解冻

- 需要用户对 `LAW-AGENT-PRODUCTION-RUNTIME-005-V35`（`:268`）给出解冻原文，扩展其"删除唯一授权"范围，新增"AGENT 本地已确定观测到某 job 的 attempt 被 Website 驱动的新 attempt 取代时，允许清退该被取代 attempt 在 Browser WAL 中的 provider_effect CONFIRMED 行"这一条，且明确排除本方案未涵盖的场景（DISPATCHED 行、target_local 行、跨 job）。
- 解冻语句需按 AGENTS.md 要求以用户原文给出，不得由 Claude 代拟后请用户确认了事。

### 工单 2（解冻后）— `local-browser-session` 侧新增窄粒度删除方法

- `browser-mutation-store.ts` 新增 `retireSupersededAttempt(jobId: string, supersededAttemptId: string): number`（返回删除行数，便于验收断言），仅删除 `job_id=? and attempt_id=? and effect_scope='provider_effect' and state='CONFIRMED'`。
- 校验 `jobId`/`supersededAttemptId` 与现役 `purgeJob` 相同的 `[\0]` 注入防护。

### 工单 3（解冻后）— `production-runtime` 侧接线

- `store-task-state.ts:72-79`（`existing.status === "failed"` 分支）在同一事务提交后，调用 `retireSupersededAttempt(task.job_id, existing.current_attempt_id)`（跨 Owner 调用，参照现役 `purgeDeletedJob` 的调用范式，不新增第三方 Owner）。
- 需要确认 `local-browser-session` 的 store 实例在 `production-runtime` 侧的既有依赖注入路径（核实 `purgeDeletedJob` 是怎么拿到 `state.browserAuthority` 的，复用同一路径，不新增新的跨 Owner 引用方式）。

### 工单 4（解冻后）— 历史数据一次性回填

- 对 §1.2 列出的 5 个父工单，逐一核实其 `current_attempt_id`（已完成，见 §1.2 表格），对每个父工单调用 `retireSupersededAttempt` 清退所有非 `current_attempt_id` 的历史 CONFIRMED 行。
- 回填前后各做一次 §1.2 式的解密核对，确认清退后每个父工单恰好剩 1 条 CONFIRMED 行、且其 URL 与清退前"最新一条"完全一致（证明没有误删当前有效数据）。

### 工单 5（解冻后）— 验收

- 单元级：新增测试证明 `retireSupersededAttempt` 只删除指定 attempt 的 provider_effect CONFIRMED 行，不动同 job 其它 attempt、不动 target_local 行、不动其它 job。
- 集成级：模拟"job 从 failed 被重新签发新 attempt"的完整 `acceptClaim` 流程，断言旧 attempt 的 WAL 行被清退，`readUniqueConfirmedConversationUrl`（未改动的现役代码）此后对该 job+step 只返回新 attempt 的 URL。

## 8. 删除审判

| 单元 | 必要性 | 裁决 |
|---|---|---|
| `retireSupersededAttempt` 窄粒度删除方法 | 消除 §1.2 已验证的确定性故障根源，且是唯一不触碰第 1 版 6 处已锁死边界的路径 | KEEP，需解冻 §7 工单 1 |
| 历史 5 个父工单一次性回填 | 不做的话，即便向前修复，这 5 个工单仍会持续 AMBIGUOUS，因为它们已经是 completed 状态、不会再有新 attempt 触发向前修复逻辑 | KEEP |
| 对 DISPATCHED 状态一并清退 | 未经充分论证的场景，§3.3（第 1 版遗留）未在本版重新验证 | 本版不做，留作后续独立评估，不塞进本方案凑"更完整" |
| 修改 `readUniqueConfirmedConversationUrl` 查询逻辑 | 已被独立审计否决 | FORBID，不得在本方案任何工单里以任何形式复活 |
| Website 契约新增字段 | 无必要——本方案完全不依赖 Website 传递任何新信息 | DELETE FROM 方案 |

## 9. 停止规则

- §7 工单 1 解冻未获得：不得开始工单 2 及以后。
- §7 工单 0 发现存在专门锁定 `purgeJob`/删除范围的机器门禁：停止，退回重新评估（不得复用第 1 版"绕过字符串匹配"的失败教训）。
- 独立审计第 2 轮若推翻 §4.2 任一格论证：停止，退回重新设计。

## 10. 执行重绑定要求

施工前重新读取 AGENTS.md、本方案引用的精确法条（`:268` 及其完整 `LAW-AGENT-PRODUCTION-RUNTIME-005-V35` 全文，不得只看摘录）、§2 HEAD/dirty 状态；确认解冻已获得且原文与本方案 §7 工单 1 的范围描述一致（不得解冻了一条更宽或更窄的表述就直接开工）。
