---
document_type: project_scheme
scheme_id: CURRENT_REASON_DIAGNOSTIC_PROJECTION_AUTHORITY_SEPARATION
scheme_name: current_reason诊断投影与状态权威分离
status: 设计阻断
created_at: 2026-09-25
updated_at: 2026-09-25
owner_repo: ADVISION-X/AGENT
candidate_branch: main
candidate_head: 355800d0a6a0e1dc3448047a9213b10761b53b1a
website_baseline: 695ddbbe004ba8919794251f81b80058a253035d
depends_on_scheme: docs/项目方案/Target系统地位与强制边界-完整实现方案.md
implementation_mode: design_only
independent_subagent_audit: pending
---

# current_reason诊断投影与状态权威分离-完整实现方案

## 0. 状态、唯一结论与审计门

本方案当前状态为：**设计阻断**。

阻断原因不是方案主链未知，而是授权人明确要求“独立子智能体只做审计、审查、第三方质检，子智能体未放行禁止结束方案建设”。当前执行环境没有可调用的独立子智能体/审计代理接口，因此本方案只能完成主设计与主审计，**不得伪造第三方 PASS，也不得宣称方案建设结束或可施工**。

本方案只做设计，不修改生产法案、Blueprint、TypeScript、SQL、数据库、运行服务、Browser、V6 合同或质检代码。

### 0.1 唯一结论

current_reason 的系统地位必须冻结为：

> **current_reason 只回答“为什么现在停在这里/正在发生什么”，绝不回答“系统现在是什么状态、下一步能不能做、是否可以换 attempt、是否可以 stage、是否占业务席位、是否允许恢复或删除”。**

长期业务责任与恢复权威保持不变：

~~~text
Website 有效 demand
+ 未持久取消 / 删除 / 撤权 / 终止
+ 尚无 Domain admission/business consumption/object readback
=
同一 job 必须持续拥有现役 worker 可执行或有界再检查的下一动作
~~~

任何 current_reason、Browser/Target、error code、FAIL_CLOSED、timeout、lease/fence/session 失效，都只能限制当前危险动作，不能成为 demand stop。

### 0.2 本轮不是“删除 current_reason 字段”

本轮删除的是 **current_reason 的控制权威**，不是删除诊断能力。

current_reason 仍允许：

- 给 Runtime Console、Operations Snapshot、Website 管理面和人工排障显示当前原因；
- 承载 typed reason code 的只读投影；
- 在 completed 时按现役语义归零；
- 参与 schema 的“failed 任务必须有诊断原因”完整性检查；
- 被日志/控制室读取和展示。

current_reason 绝对禁止：

- 作为 source handoff seal/CAS 身份；
- 作为 stage/terminal 写资格；
- 作为 attempt/revision/claim/recovery 资格；
- 作为 business-in-flight 分母的排除条件；
- 作为 provider cooldown resume 资格；
- 作为 Website deletion/control authority 的交叉授权；
- 作为 factory readiness/liveness 的业务门；
- 作为任何第二状态机、workflow cursor、resume token 或持久 fence。

---

## 1. 本轮输入、前四轮裁决与闭环 SKILL

### 1.1 前四轮必须继承的结论

本方案不重新讨论已经冻结的四个结论：

1. **Target 正位**  
   Target 只拥有当前 Browser 动作的现实位置权威；canonical conversation URL + exact userTurnId 负责跨 Target 的会话定位；provider_effect_identity 负责现实 Provider 输入身份。

2. **Target 建设必须是减法**  
   browser_target_claims、expectedTargetRef、old-target recovery identity 等进入删除分母，不能新建替代 Target 状态机。

3. **全系统身份越权审判**  
   Target 暴露的是通病：局部事实越权回答更高层问题。current_reason 是当前最明确的下一处真实错位。

4. **Demand→Result 红线不变**  
   Website 已发出的有效 job，在 Website 未持久终止且 Domain admission 未成立前，AGENT 的自动推进/有限再检查责任不死。正位只能删错误权威，不能删交付责任。

### 1.2 闭环 SKILL 复核

本轮已对用户提供的《闭环实现设计-SKILL》做不少于两遍的独立深读，采用深度设计模式。

硬约束：

- 只设计，不施工；
- 唯一方案文件；
- 四维闭合：法案、施工图、代码、质检；
- 先找第一直接断点；
- Reuse > 原位修改 > 删除旧路 > 最后才允许新增；
- 必须做删除反事实；
- 禁止第二状态机、第二队列、第二恢复 Owner、fallback、dual-read、compatibility bridge；
- 从最终业务终点反向验收；
- 跨仓变更必须定义发布顺序与 rollback；
- 独立审计未放行，不得结束方案建设。

---

## 2. 双仓 candidate 与遍历基线

| 仓库 | main HEAD | recursive tree | 文件 | 代码 | Blueprint/项目方案 | 质量相关 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| ADVISION-X/AGENT | 355800d0a6a0e1dc3448047a9213b10761b53b1a | 1176 entries，untruncated | 912 | 627 | 43 | 385 |
| ADVISION-X/xuanxue-web | 695ddbbe004ba8919794251f81b80058a253035d | 7411 entries，untruncated | 6389 | 2290 | 55 | 631 |

本轮已按四带闭合受影响域：

### 法案系统

AGENT：

- LAW-AGENT-PRODUCTION-RUNTIME-001-V71
- LAW-AGENT-PRODUCTION-RUNTIME-004-V41
- LAW-AGENT-PRODUCTION-RUNTIME-005-V40
- Runtime Log Spine 关于“投影不得变任务权威”的条款

Website：

- LAW-AI-ACCEPTANCE-001-V7
- LAW-AI-ACCEPTANCE-002-V30
- LAW-AI-ACCEPTANCE-004-V29
- FROZEN-WEBSITE-RESULT-DEMAND-001

### 施工图

- AGENT docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md
- Website docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md
- Website docs/blueprints/SYSTEM-BLUEPRINT.md
- docs/项目方案/Target系统地位与强制边界-完整实现方案.md

### 代码

AGENT Runtime：

- store-foundation.ts
- store-source-readback.ts
- store-task-state.ts
- store-authority-validation.ts
- store-authority-reader.ts
- runtime-claim-recovery.ts
- runtime-claim-operations.ts
- runtime-claim.ts
- runtime-claim-preproduct.ts
- runtime-business-admission.ts
- runtime-loops.ts
- provider-rate-limit-control.ts
- cloud-reconciliation-client.ts
- transport-protocol.ts
- operations-snapshot.ts

Website：

- job-claim-observation.ts
- job-claim-repository.ts
- job-claim-result.ts
- job-device-status-repository.ts
- job-lifecycle-core.ts
- job-lifecycle-repository.ts
- business-result-consumer.ts
- job-terminal-repository.ts
- factory-readiness.ts

### 质检

AGENT：

- scripts/audit/domains/agent-production-runtime/inspector.ts
- scripts/audit/domains/agent-production-runtime/contract-inspection.ts
- Runtime startup/recovery/ledger/business-admission/failure/browser acceptances

Website：

- scripts/audit/domains/ai-acceptance/check.ts
- scripts/audit/domains/ai-acceptance/law-012-v12-inspection.ts
- scripts/audit/domains/ai-acceptance/law-004-v20-observation-inspection.ts
- tests/exam/ai-production-v6-contract.test.ts
- tests/exam/ai-production-v20-observation.test.ts

---

## 3. 最高级权威矩阵

### 3.1 current_reason 的唯一合法问题

~~~text
问题：为什么现在停在这里？
答案：current_reason
~~~

它是**投影**，不是**状态**。

### 3.2 真正状态权威

| 问题 | 唯一权威 | current_reason 是否参与 |
| --- | --- | --- |
| Website demand 是否还活着 | Website job + 持久 cancel/delete/revoke/termination + Domain admission | 否 |
| 业务下一步是什么 | Website next_action_code | 否 |
| 当前 accepted attempt 是谁 | Website attempt_id + accepted_at + grant/receipt | 否 |
| 当前写权限是谁 | lease/fence/session/grant | 否 |
| 本地 exact attempt 是否 durable accepted | production_tasks.current_attempt_id + task/request identity | 否 |
| source handoff 是否已封存 | production_attempt_handoffs typed row | 否 |
| 结果是否已经机械 stage | staged_result_json + exact task/result identity | 否 |
| terminal intent 是否已持久 | production_outbox exact terminal intent | 否 |
| 业务是否 completed | Domain admission/business consumption/object readback | 否 |
| Provider effect 是否发生 | Browser WAL / provider_effect_identity | 否 |
| 为什么当前看起来在等 | current_reason | 是，仅诊断 |

### 3.3 绝对规则

> **在 schema 允许的合法诊断值范围内，改变、替换或篡改 current_reason 的具体内容，不得改变任何真实授权、恢复资格、在途业务数、Provider 输入资格、stage 资格、业务 completed 或 deletion 资格。failed 本地任务仍保留 current_reason 非空的诊断完整性约束；本方案不把 null 变成 failed 行的合法诊断值。**

如果改变 current_reason 会改变这些行为，直接判定为结构性错误。

---

## 4. 第一直接断点与当前真实错位

## 4.1 D1：source handoff 用 current_reason 充当持久 fence

当前 AGENT store-source-readback.ts 在 sealSourceHandoff 中构造：

~~~text
SOURCE_HANDOFF_SEALED|<sealHash>
~~~

然后把该字符串 CAS 写进 production_tasks.current_reason。

后续多个消费者再用该字符串判断：

- observation 是否还能写；
- handoff 是否已 sealed；
- source manifest 是否可读取；
- claim recovery 是否处于 handoff；
- 新 attempt 是否可以 accept；
- business-in-flight 是否还计算旧 attempt。

这是本轮第一直接断点。

### 为什么错

生产数据库已经有专门的 typed durable row：

~~~text
production_attempt_handoffs
  job_id
  source_attempt_id
  issued_attempt_id
  seal_hash
  source_manifest_json
  first_fact_raw
  sealed_at
  accepted_at
  readback_observations_json
~~~

删除 current_reason 后，该表仍完整回答“handoff 是否封存、封存哪一份、是否已被新 attempt 接纳”。

因此 current_reason 在这里没有独立不可替代消费者，属于重复状态权威。

---

## 4.2 D2：EXECUTING 被 current_reason 用成 completion-port fence

store-task-state.ts 当前：

~~~text
markExecuting()
  -> current_reason = EXECUTING

stageResult()
  -> 要求 current_reason === EXECUTING
  -> UPDATE WHERE current_reason = EXECUTING
~~~

这把“当前显示正在执行”升级成“结果是否允许 stage”的安全资格。

### 正确安全门

stageResult 真正需要证明的只有：

- exact job/task identity；
- exact current_attempt_id；
- task.status = failed；
- staged result identity 与 task 一致；
- 已存在 staged result 时只能 exact replay；
- 当前 source attempt 未被 typed source-handoff seal 封口；
- stage+terminal intent 仍走现有原子事务。

EXECUTING 文案没有提供额外安全性。

---

## 4.3 D3：current_reason 影响 in-flight 与 cooldown recovery

runtime-loops.ts 当前存在：

- 通过 SOURCE_HANDOFF_SEALED 前缀把任务排除出 businessInFlightJobIds；
- pendingProviderReadbackJobIds 通过该前缀决定是否参与；
- providerCooldownPaused() 解析 PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE 文案；
- pendingCooldownResumeJobIds() 依赖该文案。

### 正确来源

source-handoff/in-flight：

- production_attempt_handoffs.seal_hash/sealed_at/accepted_at；
- production_tasks.current_attempt_id/staged_result；
- Website current grant/next_action。

Provider cooldown：

- ProviderRateLimitControl.submitGateOpen；
- production_outbox 中 provider_cooldown intent/receipt；
- Website attestation/heartbeat reason_codes；
- Website exact cohort/control facts。

current_reason 在两条链都不是权威。

---

## 4.4 D4：跨仓 claim 把诊断字面值作为 consumer admission

Website claimedWebsiteAgentTaskFromLease 当前固定投影：

~~~text
current_reason = LEASE_GRANTED
~~~

AGENT ClaimedProductionTaskSchema 当前要求：

~~~text
current_reason: literal LEASE_GRANTED
~~~

Website 的 grant、lease、fence、attempt、request identity 已经完整证明 claim 权威，因此“current_reason 恰好等于 LEASE_GRANTED”不应成为第二 admission 门。

### 本轮最小处理

Website producer **保持字节不变**，继续发送 LEASE_GRANTED 作为诊断投影。

AGENT consumer 把该字段从“权威 literal”降为“required diagnostic string”：

~~~text
current_reason: non-empty string
~~~

真正 admission 继续由 grant/lease/fence/attempt/request 的现役精确核对完成。

这样：

- 不删除 wire 字段；
- 不要求 Website provider 改 shape；
- 不需要仅为本轮升 control contract version；
- 不建立兼容 reader；
- mixed-version 行为不变化，因为 Website 仍发相同字节；
- 只删除 AGENT 对诊断文案的授权解释。

若 Target 方案先落地并把 V43 升为 V44，本方案直接重绑 V44，不再额外升 V45。

---

## 4.5 D5：device-status 删除授权把 current_reason 当第二证明

cloud-reconciliation-client.ts 当前同时检查：

~~~text
control_intent = cancel_requested + exact reason
AND
current_reason.code = PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED
~~~

这是双权威。

### 正确规则

- control_intent 是删除/控制权威；
- current_reason 只是对控制事实的人类/诊断投影。

所以必须满足：

~~~text
control_intent 精确授权删除
-> deletionAuthorized = true

current_reason 写 deleted 但 control_intent 没授权
-> deletionAuthorized = false
~~~

不得要求两者内容相等才承认 Website 控制权。

---

## 4.6 D6：Website factory readiness 仍读取历史诊断 sentinel

Website factory-readiness.ts 当前存在 active runtime 查询：

~~~text
current_reason.location = automatic-recovery-cutover
AND retry_not_before IS NULL
-> factory not ready
~~~

该值来自历史 0101 cutover。

现役 claim/lifecycle 已经：

- 物理退役 RECOVERY_PARKED；
- 用 status/attempt/retry/lease/control_intent 决定运行资格；
- migration registry/hash 证明历史 cutover 已应用。

因此 active factory readiness 继续解释历史 current_reason 是历史诊断向现役权威泄漏。

### 裁决

- 历史 migration 0095/0097/0101/0147 字节永久不改；
- factory readiness 删除该 current_reason predicate；
- readiness 只检查现役 schema、migration registry/hash、真实 retry/lease finite liveness、terminal/admission liveness、protocol/session version；
- 不新增 replacement sentinel。

---

## 5. Identity spine 与有限状态拓扑

## 5.1 长期身份链

~~~text
job_id
+ request_hash
+ Website frozen task
~~~

这是需求与业务执行长期身份。

## 5.2 控制 epoch

~~~text
attempt_id
result_revision
lease
fence
worker session
Browser authority epoch
~~~

它们只回答各自当前控制代次，不能冒充 job identity。

## 5.3 本地 durable facts

~~~text
production_tasks
  current_attempt_id
  staged_result_json
  attempt_failure_json

production_attempt_handoffs
  source_attempt_id
  seal_hash
  sealed_at
  issued_attempt_id
  accepted_at
  source_manifest_json
  first_fact_raw
  readback_observations_json

production_outbox
  exact durable write intents/receipts
~~~

current_reason 不在 identity spine。

## 5.4 current_reason 只作投影

~~~text
typed durable facts
+ latest local/remote observation
-> current_reason diagnostic projection
~~~

反向推导永久禁止：

~~~text
current_reason
-X-> typed durable state / eligibility / authorization
~~~

---

## 6. 唯一目标主链

### 6.1 普通 accepted attempt

~~~text
Website LEASE_GRANTED + exact grant/fence
-> AGENT durable accept exact attempt
-> current_reason 可显示 LEASE_GRANTED
-> Product execution
-> current_reason 可显示 EXECUTING
-> exact result 成立
-> stage + terminal Outbox 同事务
-> current_reason 可显示 BUSINESS_ADMISSION_PENDING
-> Website terminal
-> Domain Consumer admission
-> admission receipt/object readback
-> AGENT local completed
~~~

所有箭头由 typed facts 推动，不由 current_reason 推动。

### 6.2 source handoff

~~~text
Website WAIT_NEW_ATTEMPT / source evidence required
-> Runtime 收束旧 execution
-> 核 current_attempt_id + staged_result absent + first fact/source evidence
-> production_attempt_handoffs 原子 seal
-> current_reason 可显示 SOURCE_HANDOFF_SEALED:<short diagnostic ref>
-> Website 在原 job 行锁核 source evidence
-> Website 签 issued attempt
-> AGENT 以 typed handoff row + Website grant 原子切 current_attempt_id
-> 旧 first fact 依现役规则退休
~~~

关键变化：

> “seal”由 production_attempt_handoffs 持有，current_reason 只是旁观显示。

### 6.3 cooldown

~~~text
Browser exact known rate-limit
-> provider_cooldown Outbox intent
-> ProviderRateLimitControl submit gate closed
-> Website incident/cohort/clearance authority
-> current_reason 可显示 cooldown
-> Website authoritative clearance + exact Outbox facts
-> gate reopen
~~~

改变/清空 current_reason 不得打开或关闭 submit gate。

---

## 7. 原子 Work Orders

## WO-G0：精准解冻并替换 AGENT Runtime P0 法案

Owner：AGENT law-system / agent-production-runtime。

### 必改语义

LAW-AGENT-PRODUCTION-RUNTIME-001 当前写入：

~~~text
current_attempt_id + current_reason + staged_result_json is null
作为持久 CAS 封住旧 completion 入口
~~~

目标替换为：

~~~text
current_attempt_id
+ staged_result_json is null
+ production_attempt_handoffs 对 exact source attempt 的 typed seal
+ source manifest / first fact exact hash
~~~

并新增硬条款：

- current_reason 永远是诊断投影；
- Runtime 不得以 current_reason code/string/prefix 决定恢复、CAS、business capacity、stage、attempt 切换、provider submit、删除或完成；
- 任何当前危险动作失败只限制动作，FROZEN-WEBSITE-RESULT-DEMAND-001 不变。

LAW-AGENT-PRODUCTION-RUNTIME-005 保持“三表”结构，不新增第四表；只明确 production_attempt_handoffs 是 handoff seal 的唯一 typed durable carrier，不是第二业务恢复 Owner。

### 法案依赖

施工时必须使用 canonical law parser 重新计算反向依赖。不得手工猜版本传播。

本设计不提前写死最终 law version number。

---

## WO-B1：source handoff 去 current_reason 权威

Owner：AGENT ProductionStore。

Affected：

- store-source-readback.ts
- store-task-state.ts
- runtime-claim-recovery.ts
- runtime-claim-operations.ts

### B1.1 recordSourceReadbackObservation

把：

~~~text
current_reason starts SOURCE_HANDOFF_SEALED
~~~

改成：

~~~text
production_attempt_handoffs exact source row already has seal_hash/sealed_at
~~~

sealed 后 observation 写入失败关闭。

伪造 current_reason=SOURCE_HANDOFF_SEALED 不得阻断未 seal row。

### B1.2 sealSourceHandoff

删除：

- 用 SOURCE_HANDOFF_SEALED|sealHash 做 CAS identity；
- “current_reason 必须仍等于旧值”作为封口条件。

原子事务必须核：

- current task exists；
- status=failed；
- exact source attempt；
- staged_result absent；
- source task hash；
- first fact raw/hash；
- handoff row 尚未 sealed 或 exact idempotent same seal；
- source manifest hash = seal hash。

然后原位写：

- seal_hash；
- source_manifest_json；
- first_fact_raw；
- sealed_at。

current_reason 可以在同事务或事务后更新为诊断值，但诊断写失败/漂移不能改变 seal 真相。

### B1.3 readSealedSourceHandoff

只读 typed handoff row：

- seal_hash non-null；
- source_manifest_json non-null；
- sealed_at non-null；
- manifest/hash/job/source attempt/task identity exact。

完全忽略 current_reason。

### B1.4 acceptTaskAfterSourceHandoff

删除 current_reason equality/WHERE。

改由：

- exact archived handoff row；
- seal；
- source_attempt_id；
- issued_attempt_id；
- accepted_at；
- first_fact；
- current task request hash；
- staged_result absent；
- Website issued attempt

完成同事务切换。

---

## WO-B2：stage/completion port 去 current_reason fence

Owner：AGENT ProductionStore。

### B2.1 markExecuting

markExecuting 只更新诊断 current_reason，不产生 stage 权限。

### B2.2 stageResult

删除：

~~~text
current_reason === EXECUTING
WHERE current_reason='EXECUTING'
~~~

改用：

- exact current_attempt_id；
- status=failed；
- exact task/result identity；
- staged result exact replay/no conflict；
- source attempt 没有 sealed handoff；
- 必要 artifact/result facts；
- stage+terminal intent 现役原子事务。

### B2.3 first fact

recordAttemptFailure / rebindAttemptFailureReleaseDescriptor 不再用 current_reason prefix 阻止 sealed source 的迟到 mutation。

由 exact typed handoff seal 拒绝 sealed source attempt 的迟到 first-fact 改写。

### B2.4 setCurrentReason API

将 ProductionStore 公共语义从 setCurrentReason 收敛为：

~~~text
setDiagnosticReason(jobId, reason)
~~~

数据库列仍叫 current_reason，不增加列、不迁移 schema。

禁止任何调用方依据 setDiagnosticReason 的成功与否推导状态转换。

---

## WO-B3：Runtime loop 去字符串状态机

Owner：AGENT agent-production-runtime。

### B3.1 businessInFlight

删除 SOURCE_HANDOFF_SEALED 前缀判断。

业务在途集合由：

- active execution；
- local failed + current_attempt_id；
- staged result/admission pending；
- typed source handoff 是否已经 Website issued/accepted

共同机械决定。

精确原则：

- 只在 production_tasks.current_attempt_id 精确等于某条 production_attempt_handoffs.source_attempt_id 且该行 seal_hash/sealed_at 已成立时，才把这个 exact 旧 source attempt 视为已封口；不能因为同 job 存在任意历史 sealed row 就排除当前新 attempt；
- 新 issued attempt durable accept 后，新 attempt 占同一 job 一个业务席位；
- 同一 job 永远去重；
- current_reason 变化不改变分母。

### B3.2 pendingProviderReadback

删除 sealed-prefix判断，使用 typed source handoff row 判断 source attempt 是否封口。

### B3.3 cooldown

物理删除：

- providerCooldownPaused(reason)
- 仅依赖 current_reason 的 pendingCooldownResumeJobIds

如果 hasAcceptedAttemptRecovery 已覆盖 exact failed current_attempt_id，则复用它；Provider submit 是否可开只消费 ProviderRateLimitControl。

若施工时发现独立真实消费者无法由现有 accepted-attempt recovery 覆盖，必须回到设计阻断，不得新增 cooldown 状态字段。

### B3.4 reconcileUnfinishedExecutionsWithoutReceipt

可以继续写诊断 current_reason，但：

- 是否进入 source handoff 只读 Website next_action_code；
- 是否已 seal 只读 typed handoff row；
- current_reason 只影响显示，不影响分支。

---

## WO-B4：Claim 与 Device Status 去诊断授权

Owner：AGENT transport/runtime。

### B4.1 ClaimedProductionTaskSchema

Website producer 继续原样发送：

~~~text
status=failed
current_reason=LEASE_GRANTED
~~~

AGENT consumer 把 current_reason 从 literal authority 降成 required non-empty diagnostic string。

不得删除字段，不改变 Website wire shape，不升 contract version。

真正 claim admission 继续严格核：

- job/source/request identity；
- device；
- attempt；
- lease token/version/expiry；
- execution fence；
- session/control contract；
- result revision/risk grant identity。

### B4.2 deletion/control

cloud-reconciliation-client 删除：

~~~text
control intent deletion
必须等于
current_reason code deletion
~~~

唯一删除权威是 exact ControlIntent。

current_reason 只保留在返回对象供 diagnostics。

---

## WO-W1：Website active runtime 禁止 current_reason 决策

Owner：Website ai-acceptance。

### 保持不动

- job-claim-observation.ts 的 v6JobNextAction：当前已经不依赖 current_reason；
- claim selection：当前 eligibility 不依赖 current_reason；
- device-status：继续投影 current_reason；
- UI/control room：继续展示/排序/说明 reason；
- historical migrations：永久不改字节。

### 必改

factory-readiness.ts 删除 active current_reason.location=automatic-recovery-cutover liveness predicate。

现役 readiness 只使用：

- current schema shape；
- migration registry/hash；
- retry/lease finite liveness；
- terminal/admission liveness；
- control protocol；
- worker session contract version。

### 历史 migration 例外

0095/0097/0101/0147 中的 current_reason 条件属于已经冻结的历史迁移事实，不改、不 normalize、不建立 active compatibility reader。

---

## WO-D1：双仓 Blueprint 同义冻结

AGENT WEBSITE-AGENT-V6-BLUEPRINT：

把 source-handoff completion-port fence 从：

~~~text
current_attempt_id + current_reason + staged_result_json
~~~

替换为 typed production_attempt_handoffs seal。

Website AI-ACCEPTANCE-BLUEPRINT 同步只描述 AGENT typed handoff proof，不再把 current_reason 列为 source completion fence。

SYSTEM-BLUEPRINT：

- 保留 current_reason 作为诊断入口；
- 将“长期未 claim -> failed.current_reason -> eligibility”类排障文案改为：先读 next_action/retry/lease/control/capability/attestation/claim exclusion，current_reason 只解释最近原因；
- 补一句“current_reason 不进入 claim eligibility 谓词，不能代替 next_action/control/admission”；
- 保持四个运行真相及 Domain Consumer completed 边界不变。

---

## WO-QA：AGENT 原生质检反转

Owner：AGENT native quality。

### 删除/反转旧保护

inspector.ts 不再要求：

- acceptTaskAfterSourceHandoff 中出现 current_reason equality；
- SOURCE_HANDOFF_SEALED 字符串作为 transition gate。

contract-inspection.ts 不再要求 current_reason='LEASE_GRANTED' 作为 attempt rotation 权威。

### 新增核心 property

#### Q-A1：伪造 reason 不得伪造 seal

未 seal job：

~~~text
current_reason = SOURCE_HANDOFF_SEALED|fake
~~~

结果：

- readSealedSourceHandoff = null；
- 仍可合法收集 source facts；
- 不改变 business in-flight；
- 不获得新 attempt 资格。

#### Q-A2：篡改 reason 不得破坏真实 seal

真实 typed handoff 已 sealed 后，把 current_reason 改为任意合法非空诊断值：

- readSealedSourceHandoff 仍返回同一 manifest；
- Website source evidence 仍同一 hash；
- issued attempt 仍可 exact accept。

#### Q-A3：EXECUTING 文案不是 stage permit

exact current attempt + no sealed handoff：

- current_reason 改成任意非 EXECUTING 文本；
- exact valid result 仍可原子 stage。

反例：

- current_reason=EXECUTING；
- typed handoff 已 sealed；
- stage 必须失败关闭。

#### Q-A4：cooldown reason 不是 submit gate

改变 current_reason 不得改变：

- ProviderRateLimitControl.assertProviderSubmitAllowed；
- hasUndeliveredProviderCooldown；
- Website clearance authority。

#### Q-A5：business denominator

相同 job/attempt/staged/handoff facts，只改变 current_reason：

~~~text
businessInFlightCount 必须完全相等
~~~

#### Q-A6：Demand 红线

Target/Browser/lease/session/current_reason 任一变化后，只要 Website demand 未终止且 admission 未成立：

- worker 仍能请求/等待合法 next action；
- 不出现 permanent local terminal；
- 不生成 replacement job。

---

## WO-QW：Website 原生质检

Owner：Website native quality。

### Q-W1：next action 与 current_reason 独立

对同一 runtime row，只在合法诊断结构内改变 current_reason.code/owner/location：

~~~text
v6JobNextAction 必须不变
claim selection 必须不变
retry_not_before 必须不变
~~~

### Q-W2：factory readiness

同一现役 schema/retry/lease/protocol/session事实：

- 改历史 current_reason.location 不得改变 factory readiness；
- 真正 retry/lease 非有限、terminal/admission liveness 断裂仍必须 not_ready。

### Q-W3：control intent

device-status 当前 reason 与 control intent 故意不一致：

- Website 投影可以显示 reason；
- AGENT 的控制动作只以 exact control intent 为准。

### Q-W4：completed redline

current_reason 任意变化都不能：

- 把 failed 变 completed；
- 把 terminal_status=completed 冒充 business completed；
- 绕过 Domain admission/business consumption/object readback。

---

## 8. 跨仓合同裁决

### 8.1 本轮默认不升 control contract

理由：

- Website producer 的 claim payload 字节不变；
- current_reason 字段不删除、不改名、不改 shape；
- Website 继续发送 LEASE_GRANTED；
- AGENT 只是停止把该字面值当第二授权；
- device-status 字段 shape 不变；
- Website next_action/control/admission 已是现役权威。

因此，本轮单独施工不需要 V43→V44/V45。

### 8.2 与 Target 方案的顺序

Target 方案当前设计目标会触及同一批 source-handoff/Runtime 文件，并计划 V43→V44。

因此禁止并行施工。

唯一推荐顺序：

~~~text
Target 系统地位与强制边界
-> 完成独立验收并形成新 baseline
-> 本方案重新绑定最新 HEAD / contract version
-> current_reason 正位
~~~

如果 Target 方案已经把合同升到 V44，本方案沿 V44 改内部权威，不额外升 V45。

若施工顺序反转，则 Target 方案必须重新绑定本方案完成后的 baseline，不能复用旧 diff。

---

## 9. 删除审判

### 9.1 必须物理删除的“权威用途”

| 删除对象 | 理由 |
| --- | --- |
| SOURCE_HANDOFF_SEALED 前缀判断作为状态门 | typed handoff row 已经拥有 seal |
| current_reason equality 作为 acceptTaskAfterSourceHandoff CAS | 重复状态权威 |
| current_reason=EXECUTING 作为 stageResult permit | 诊断文本不应授权结果写 |
| current_reason prefix 作为 first-fact late-write fence | typed handoff seal 可机械阻断 |
| current_reason prefix 参与 businessInFlight | 容量不能由文案决定 |
| providerCooldownPaused(reason) | ProviderRateLimitControl 已有真实 gate |
| pendingCooldownResumeJobIds 的 reason-only 分支 | accepted-attempt recovery 已有分母 |
| claim consumer 的 current_reason literal LEASE_GRANTED 权威 | grant/lease/fence 已完整授权 |
| deletion control 对 current_reason 的双证明 | ControlIntent 已是唯一控制权威 |
| Website factory readiness 的 historical current_reason sentinel | migration registry + 现役 liveness 已覆盖 |
| 保护上述结构的旧 audit/acceptance | 质量系统不能保护字符串状态机 |

### 9.2 必须保留

| 保留对象 | 理由 |
| --- | --- |
| production_tasks.current_reason 列 | 诊断投影仍有真实 UI/排障消费者 |
| failed row current_reason non-null schema invariant | 诊断完整性，不解释具体状态 |
| Website current_reason JSON | 管理面与用户解释所需 |
| operations snapshot/review/control-room current_reason | 只读观察 |
| production_attempt_handoffs | 已有 typed handoff事实，不新建表 |
| current_attempt_id / staged_result / attempt_failure | 本地 durable事实 |
| Website next_action_code | 唯一业务恢复动作投影 |
| control_intent | Website 控制/删除权威 |
| ProviderRateLimitControl + cooldown Outbox/receipts | cooldown真实控制权威 |
| Domain admission receipt | completed唯一业务门 |

### 9.3 禁止新增

本轮禁止新增：

- production_task_phase/status/stage 列；
- runtime_state 表；
- handoff_state enum；
- current_reason shadow column；
- diagnostic_reason_v2；
- current_reason compatibility reader；
- dual-read/dual-write；
- second source handoff state machine；
- new recovery coordinator/manager；
- new cooldown state；
- current_reason version；
- migration 只为“正位”服务。

删除 current_reason 控制权后，所有必要权威都已经存在。

---

## 10. 停止条件

出现任一情况立即回到设计阻断：

1. 某个 current_reason 控制分支无法被现有 typed fact 替代；
2. 必须新增第四 Runtime 表才能保证 source handoff；
3. 必须新增 task phase/status 列才能 stage result；
4. 改 current_reason 后 Provider physical input count 可能增加；
5. businessInFlight 因删除 reason gate 导致同 job 双计数；
6. Website demand 可能因为 local state 缺失而永久失去下一动作；
7. 需要兼容旧/新 current_reason 语义双读；
8. 需要重新解释历史 migration bytes；
9. Target 方案尚未施工却出现同文件并行施工 candidate；
10. 独立子智能体审计出现 P0/P1 finding。

---

## 11. Dynamic Proof / RELEASE 验收

真正验收不看“current_reason 显示正确”，而看**current_reason 已经无法控制系统**。

### Case 1：普通执行

- Website exact job/grant；
- AGENT durable accept；
- 人工/fixture 改 current_reason；
- Product 结果仍按 exact attempt 原子 stage；
- terminal/admission/completed 正常；
- Provider 输入次数不变。

### Case 2：source handoff

- exact old attempt typed handoff seal；
- current_reason 清空/改写；
- Website source evidence/issued attempt 仍 exact；
- 新 attempt durable accept；
- old late completion 无法 stage；
- 无 replacement job。

### Case 3：伪造 sealed reason

- 未 sealed handoff row；
- current_reason 写伪 sealed 文案；
- 系统不得获得 handoff authority；
- 不改变 capacity/recovery。

### Case 4：cooldown

- exact cooldown incident；
- current_reason 故意错值；
- submit gate 仍由 Outbox + Website authority 控制；
- clearance 后自动恢复；
- cohort job demand 不丢。

### Case 5：Browser/Target/Runtime restart

- local reason 丢失或变化；
- Website same job demand active；
- next_action 仍可读；
- worker 自动接回；
- 原 effect 安全门保持；
- 最终 admission/completed。

### Case 6：业务终点

唯一 PASS：

~~~text
same original job
-> exact result
-> Website terminal
-> Domain Consumer admission
-> business consumption receipt
-> domain object/current-row readback
-> status=completed
~~~

current_reason、claim 200、LEASE_GRANTED、Runtime READY、CHANGE PASS 均不是业务闭环。

---

## 12. Rollback

本轮目标不修改数据库 schema，不新增 migration，不改 wire shape，因此 rollback 只撤销本轮代码/法案/Blueprint/quality diff。

回滚绝不：

- 改写 Browser WAL；
- 改写 Outbox 历史；
- 改写 Website job/attempt/event；
- 重建 current_reason 历史；
- 重放 Provider；
- 创建 compatibility layer。

如果施工后发现 typed handoff 不能覆盖某个真实消费者，回滚 candidate 并重新设计，不在生产中恢复字符串状态机作为 fallback。

---

## 13. 独立审计门

### 13.1 子智能体权限

授权人已明确：

- 子智能体只能做审计、审查、第三方质检；
- 禁止子智能体并发写代码；
- 子智能体不得修改方案正文、法案、代码、数据库或仓库；
- 子智能体只返回 findings/verdict；
- 子智能体未放行，方案建设不得结束。

### 13.2 必须交给独立审计者的问题

独立审计必须至少回答：

1. 是否仍有 active runtime 根据 current_reason 内容改变 mutation/claim/recovery/capacity/stage/deletion/completed？
2. production_attempt_handoffs 是否确实足以替代 SOURCE_HANDOFF_SEALED 字符串 fence？
3. stageResult 去 EXECUTING gate 后，是否仍有 exact attempt + source seal 的机械 fence？
4. cooldown 去 reason 解析后，满 N accepted attempt 是否仍能自动 regrant？
5. demand liveness 是否在任何 current_reason 漂移下仍成立？
6. Website current_reason 是否只剩 projection，而 factory readiness/claim/control 不再解释它？
7. 本方案是否偷偷新增第二状态/第二恢复链/compatibility？
8. 与 Target 方案是否存在未定义的重叠施工顺序？
9. quality 是否包含“伪 reason 不得伪 authority”和“真实 authority 不受 reason 篡改”的双向 mutation test？
10. 最终 completed 是否仍只来自 Domain admission/business consumption/object readback？

### 13.3 当前审计状态

~~~text
主设计：完成
主设计自审：待本文件落仓后执行
独立子智能体审计：未执行
独立子智能体 verdict：PENDING
方案状态：设计阻断
可施工：否
方案建设结束：否
~~~

当前环境没有可调用的独立子智能体执行接口。因此必须保持 PENDING，禁止伪造第三方 PASS。

---

## 14. 主设计删除反事实

### 删除 current_reason 列会怎样？

会损失现役 UI/诊断消费者，因此不删除列。

### 删除 current_reason 的流程控制权会怎样？

真正 source handoff 仍由 production_attempt_handoffs 完整承载；stage 仍由 current attempt + source seal + result identity 承载；cooldown 仍由 ProviderRateLimitControl/Outbox/Website authority 承载；Website recovery 仍由 next_action 承载。

因此流程控制权应删除。

### 删除 production_attempt_handoffs 会怎样？

会失去 source seal/issued attempt/accepted settlement/readback observations 的唯一 typed durable carrier，不可删除。

### 删除 Website next_action 会怎样？

会失去唯一恢复动作投影，不可删除。

### 删除 current_reason exact 文案断言会怎样？

只降低诊断文本耦合，不降低安全边界。应删除/反转。

---

# 最终冻结句

> **current_reason 是解释，不是命令；是仪表盘，不是方向盘。**

> **Website demand 不死，AGENT 的交付责任不死。任何诊断文本都没有资格把工单判死。**

> **真实状态必须来自 typed durable facts；在合法诊断结构内改变 current_reason 的具体内容，系统授权与业务行为必须保持不变。**


---

## 15. 主设计反向审计 R1（非独立子智能体）

本节是主设计者自己的反向审计，**不等于第三方审计，不构成独立子智能体放行**。

### R1-F1：原文把 current_reason=null 也视为可任意变化，违反本地 schema

**级别：P1，已修正。**

现役 production_tasks schema 明确要求：

- failed -> result_json is null 且 current_reason is not null；
- completed -> result_json 非空、staged_result_json null、current_reason null。

因此“清空 current_reason 不改变行为”不是合法 mutation 样本。新规则改为：

> 在合法诊断结构/非空值范围内改变 current_reason 内容，不得改变授权与业务行为；nullability 仍服从现役 task schema。

本轮不删除 current_reason 列，也不修改这一诊断完整性约束。

### R1-F2：typed sealed 判断必须绑定 exact current source attempt

**级别：P1，已修正。**

production_attempt_handoffs 是 append/history 表，同一 job 可存在历史 source attempt seal。任何新 helper 如果只判断“此 job 是否有 sealed row”，会把新 issued attempt 错当旧 source attempt。

唯一合法谓词必须精确绑定：

~~~text
production_tasks.current_attempt_id
==
production_attempt_handoffs.source_attempt_id

AND seal_hash is not null
AND sealed_at is not null
~~~

issued_attempt_id/accepted_at 用于证明 handoff 的后续 issuance/acceptance，不得把历史 source row继续当当前 attempt fence。

所有 stage、first-fact、business-in-flight、readback observation 的 sealed 判定必须复用同一个 typed reader，不复制 SQL 变体。

### R1-F3：Claim current_reason 降级不能偷偷形成跨仓合同漂移

**级别：P1，设计门已补。**

Website 当前仍生产 current_reason=LEASE_GRANTED，AGENT 当前 consumer 用 literal 校验。

本方案默认：

- Website producer bytes 不变；
- AGENT consumer 从 literal 改为 non-empty diagnostic string；
- grant/lease/fence 继续严格核；
- 不升 control contract。

施工前质量系统必须机械证明：

1. Website provider contract/spec 并未把“consumer 必须以 LEASE_GRANTED 字面值取得授权”定义成独立合同义务；
2. Website V43/V44 producer 输出字节不变；
3. 旧 consumer/new Website 与新 consumer/旧 Website 的 wire shape 不变；
4. current_reason 变化只会改变诊断，不改变 grant identity。

若任一 canonical contract checker 把该 literal 视为跨仓授权语义，则本 Work Order 立即回到设计阻断，按真实 provider/consumer contract 变更重新裁决版本，禁止靠宽松 parser 偷穿版本门。

### R1-F4：current_reason 允许做“诊断写幂等”，禁止做业务状态门

**级别：P2，已澄清。**

允许：

~~~text
if current_reason already equals same diagnostic value
  -> skip duplicate diagnostic UPDATE
~~~

前提是该分支只减少重复诊断写，不能改变：

- claim/recovery；
- source seal；
- capacity；
- Provider gate；
- stage/terminal；
- deletion；
- completed。

因此静态质检不能简单禁止所有 current_reason 条件表达式，而要禁止它参与**权威动作分支**。诊断展示和诊断写幂等属于允许面。

### R1-F5：与 Target 方案共改文件，必须串行 rebase

**级别：P1，已在第 8.2 节冻结。**

两方案均触达 source-handoff/Runtime/quality。不能由两个实现主体并发施工。

独立子智能体最终审计必须再次确认：

- Target 方案施工后的新 baseline 没有改变 production_attempt_handoffs seal 语义；
- 若改变，本文 B1/B2 必须重新绑定，不得直接套旧方案。

### R1 总结

~~~text
P0 = 0
P1 = 4（均已在方案正文修正/加门）
P2 = 1（已澄清）
独立子智能体 = 未执行
最终放行 = PENDING
~~~

因此方案仍保持：**设计阻断**。


---

## 16. 主设计反向审计 R2：Demand / Provider / Result 三红线攻击（非独立子智能体）

本轮从三个不可退让终点反向攻击：

1. Website demand 未终止时，同一 job 是否仍有自动下一动作；
2. current_reason 降级后，Provider physical input 是否仍被 WAL/grant/gate 严格限制；
3. 已机械成立的 staged/terminal/result 是否可能被诊断字段撤销。

结论：没有发现 P0，但发现 3 个需要写死的边界。

### R2-F1：completed 时 current_reason=null 只能是结构一致性，不是完成权威

**级别：P1，已补边界。**

AGENT store-authority-validation 和 worker-observation-client 目前会核：

~~~text
completed -> current_reason is null
~~~

该校验可以保留，但语义必须冻结为：

> Website status=completed + valid business admission receipt 才证明业务完成；current_reason=null 只是 completed projection 的形状一致性。

因此允许：

- completed projection 要求 current_reason=null；
- failed local task 要求 current_reason non-null。

禁止：

- 因 current_reason=null 推导 completed；
- 因 current_reason 非 null 推翻已经存在的 admission/completed 权威；
- 将 nullability 当作 Domain admission 替代品。

质量测试必须分别证明“权威 -> nullability”成立，而“nullability -> 权威”不成立。

### R2-F2：SYSTEM Blueprint 的故障定位文案必须去权威暗示

**级别：P1，已补 Work Order。**

SYSTEM-BLUEPRINT 当前症状导航存在类似：

~~~text
AI job 长期未被 claim
-> failed.current_reason
-> Capability eligibility
-> attestation
-> claim admission
~~~

作为排障顺序可以理解，但容易被未来实现误读成“先由 current_reason 决定 eligibility”。

WO-D1 增补：

~~~text
长期未 claim
-> 先读 Website next_action / retry / lease / control / capability / attestation / claim exclusion
-> current_reason 只解释最近原因
~~~

必须在 Blueprint 明确写：

> current_reason 可帮助人定位“为什么”，但不进入 claim eligibility 谓词。

### R2-F3：typed source seal 必须复用一个 exact reader，不得复制 SQL 形成新漂移

**级别：P1，已补实现纪律。**

多个消费者都需要判断“当前 source attempt 是否 sealed”。禁止每个文件各写一份 SQL。

优先复用/收敛现有 readSealedSourceHandoff(jobId, attemptId)：

- Runtime 分支使用 public typed reader；
- Store 内事务写 fence 若需要低层谓词，只允许一个 private exact-row predicate；
- predicate 必须绑定 job_id + current source attempt；
- 禁止 job-wide any sealed row；
- 禁止返回新的流程 enum/status。

该 reader 只回答“exact source handoff fact 是否成立”，不决定 Website next action。

### R2 红线结果

#### Demand Liveness

PASS（主设计自审）：

- current_reason 被降级后，Website next_action 仍是唯一恢复动作投影；
- accepted-attempt recovery 仍由 current_attempt_id / Website grant 驱动；
- sourceEvidence 仍可触发 recovery-only claim；
- Provider cooldown 不依赖 current_reason 也仍由 ProviderRateLimitControl + Website authority 闭合；
- 无 permanent local terminal。

#### Provider at-most-once / controlled risk

PASS（主设计自审）：

- 本方案不修改 provider_effect_identity；
- 不修改 Browser WAL replay policy；
- 不修改 delivery_priority_replay_grant；
- 不允许 current_reason 开 submit gate；
- 删除 cooldown reason parser 反而减少错误授权源。

#### Result Monotonicity

PASS（主设计自审）：

- stage 权威改为 exact attempt + typed seal + result identity；
- stage+terminal Outbox 原子事务保留；
- admission/completed 权威不变；
- current_reason 不再能撤销有效结果。

### R2 总结

~~~text
P0 = 0
P1 = 3（均已补进方案边界）
独立子智能体 = 未执行
第三方 verdict = PENDING
方案状态 = 设计阻断
~~~

主设计两轮审计均不能替代授权人要求的独立子智能体质检。
