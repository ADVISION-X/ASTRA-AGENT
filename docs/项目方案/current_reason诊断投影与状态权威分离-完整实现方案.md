---
document_type: project_scheme
scheme_id: CURRENT_REASON_DIAGNOSTIC_PROJECTION_AUTHORITY_SEPARATION
scheme_name: current_reason诊断投影与状态权威分离
status: 审计通过-待前置依赖
created_at: 2026-09-25
updated_at: 2026-09-25
owner_repo: ADVISION-X/AGENT
candidate_branch: main
candidate_head: 873c975ffea6d30c139dbda4f1426ac65358c162
website_baseline: 695ddbbe004ba8919794251f81b80058a253035d
depends_on_scheme: docs/项目方案/Target系统地位与强制边界-完整实现方案.md
implementation_mode: design_only
independent_subagent_audit: superseded_by_explicit_user_self_audit
audit_mode: primary_agent_read_only_self_audit
self_audit_verdict: PASS
---

# current_reason诊断投影与状态权威分离-完整实现方案

## 0. 状态、唯一结论与审计门

本方案当前状态：**审计通过-待前置依赖**。

授权人已在后续明确改为“你自己审计”。因此原“必须等待独立子智能体”形式门由本轮最新明确指令替代。本轮由主智能体切换为只读审计角色，对双仓法案、施工图、现役实现与原生质检做独立于施工的反向攻击；审计阶段不修改生产代码、数据库、服务或跨仓合同实现。

本轮自审 verdict：**PASS（P0=0，P1=0）**。该 PASS 只放行方案设计，不授权并行施工。

仍存在一个真实前置依赖：Target 方案与本方案共改 Runtime/source-handoff/quality，必须先完成《Target系统地位与强制边界-完整实现方案》施工与验收，再把本方案重新绑定到新的 HEAD/contract baseline 后施工。两方案禁止并行开工。

本 Skill 仍只做施工前设计。本轮不修改生产法案、Blueprint、TypeScript、SQL、数据库、Browser、服务、V6 合同或原生质检代码。

### 0.1 唯一冻结句

> current_reason 是解释，不是命令；是仪表盘，不是方向盘。

current_reason 只回答：

~~~text
为什么现在停在这里？
最近一个可解释原因是什么？
~~~

current_reason 永远不能回答：

~~~text
当前真实状态是什么？
下一步是否允许？
是否可 stage / terminal？
是否占 business in-flight？
是否已 source handoff？
是否可换 attempt / revision？
是否可 Provider submit？
是否可删除？
是否 completed？
~~~

### 0.2 Demand→Result 红线绝不削弱

本轮必须继承 FROZEN-WEBSITE-RESULT-DEMAND-001：

~~~text
Website 有效 job
+ Website 未持久 cancel / delete / revoke / terminate
+ 尚无 Domain admission / business consumption / object readback
=
同一 job 必须持续拥有现役 worker 可执行或有界再检查的合法下一动作
~~~

任何 current_reason、Target、Browser、FAIL_CLOSED、error code、timeout、lease、fence、session、authority epoch 的变化，都只能限制当前危险动作，不能成为 demand stop。

AGENT 无权自行决定永久停止、replacement job、新 attempt 或 result revision。Website.ai-acceptance 仍是唯一业务恢复与 attempt/revision Owner；Domain Consumer 仍是唯一业务 completed Owner。

### 0.3 本轮不是删除 current_reason 列

本轮删除的是 **current_reason 的流程控制权威**。

必须保留：

- AGENT production_tasks.current_reason 诊断列；
- Website current_reason JSON 诊断投影；
- failed 本地 task 的 current_reason 非空结构完整性；
- completed 投影下 current_reason=null 的形状一致性；
- Operations Snapshot / Runtime Console / Control Room / UI 的只读诊断消费者。

必须删除：

- 用 current_reason 文案、code、prefix、nullability 反向推导授权、恢复、stage、capacity、deletion 或 completed；
- 用 current_reason 充当第二 CAS、第二 fence、第二状态机或 workflow cursor。

---

## 1. 前四轮裁决与闭环 SKILL

### 1.1 前四轮必须继承

1. **Target 正位**
   - Target 只拥有当前 Browser 动作现实位置；
   - canonical conversation URL + exact userTurnId 只拥有会话 locator；
   - provider_effect_identity 只拥有现实 Provider effect 身份。

2. **Target 建设是减法**
   - 删除历史 Target 的恢复身份；
   - 不能建设替代 Target 状态机。

3. **全系统身份越权审判**
   - Target 暴露的是一类通病：局部事实越权回答更高层问题；
   - current_reason 是当前最明确的下一处真实越权。

4. **Website Demand→Result 红线**
   - Website 已发出的有效 job，只要未被 Website 持久终止且未取得领域 admission，AGENT 的自动推进/有限再检查责任不死；
   - 正位只能删错误权威，不能删持续交付责任。

### 1.2 闭环 SKILL 双遍深读

本轮已对用户提供的《闭环实现设计-SKILL》进行不少于两遍完整深读，采用深度设计模式。

硬约束：

- 唯一方案文件，只更新本文件；
- 四维闭合：法案、施工图、现役实现、质检；
- 先找第一直接断裂；
- 优先级：直接复用 > 原位修改 > 删除旧路后替换 > 最后才允许新增；
- 必须执行删除反事实；
- 禁止第二状态机、第二恢复链、第二 queue/store/verdict、fallback、dual-read/write、compatibility bridge；
- 从最终业务 admission/completed 反向验收；
- 多仓只保留各自原生质检，不建跨仓总 verdict；
- 独立第三方审计未放行，不得结束方案建设。

---

## 2. Scoped candidate 与漂移裁决

### 2.1 当前双仓基线

| 仓库 | main HEAD | recursive tree | 文件 | 代码 | Blueprint/项目方案 | 质量相关 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| ADVISION-X/AGENT | 3283092c9aa2c70c7709a2bad4d94ed8764ab31c | 1177 entries，untruncated | 913 | 627 | 44 | 385 |
| ADVISION-X/xuanxue-web | 695ddbbe004ba8919794251f81b80058a253035d | 7411 entries，untruncated | 6389 | 2290 | 55 | 631 |

AGENT 相对上一轮 355800d0 的 3 个 commit 只新增本方案文件，本轮施工面代码、法案、Blueprint 与质量基线没有发生新的实现漂移。

### 2.2 唯一方案路径

~~~text
ADVISION-X/AGENT/docs/项目方案/current_reason诊断投影与状态权威分离-完整实现方案.md
~~~

不得创建 v2、final、时间戳副本或第二审计报告。

### 2.3 四带闭合范围

#### 法案

AGENT：
- LAW-AGENT-PRODUCTION-RUNTIME-001-V71
- LAW-AGENT-PRODUCTION-RUNTIME-005-V40
- LAW-APP-SHELL-UI-001-V3
- FROZEN-WEBSITE-RESULT-DEMAND-001 的 Runtime 落点

Website：
- LAW-AI-ACCEPTANCE-001-V7
- LAW-AI-ACCEPTANCE-002-V30
- LAW-AI-ACCEPTANCE-004-V29
- LAW-AI-ACCEPTANCE-012-V39
- FROZEN-WEBSITE-RESULT-DEMAND-001

#### 施工图

- AGENT docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md
- Website docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md
- Website docs/blueprints/SYSTEM-BLUEPRINT.md
- docs/项目方案/Target系统地位与强制边界-完整实现方案.md

#### 现役实现

AGENT：
- store-foundation.ts
- store-authority-validation.ts
- store-source-readback.ts
- store-task-state.ts
- store-authority-reader.ts
- runtime-claim-recovery.ts
- runtime-claim-operations.ts
- runtime-claim-preproduct.ts
- runtime-loops.ts
- provider-rate-limit-control.ts
- transport-protocol.ts
- cloud-reconciliation-client.ts
- worker-observation-client.ts
- operations-snapshot.ts

Website：
- job-claim-repository.ts
- job-claim-result.ts
- job-claim-observation.ts
- job-device-status-repository.ts
- job-lifecycle-core.ts
- job-lifecycle-repository.ts
- job-terminal-repository.ts
- business-result-consumer.ts
- factory-readiness.ts

#### 质检

AGENT：
- scripts/audit/domains/agent-production-runtime/inspector.ts
- scripts/audit/domains/agent-production-runtime/contract-inspection.ts
- Runtime ledger / recovery / business-admission / failure / startup acceptance

Website：
- scripts/audit/domains/ai-acceptance/check.ts
- scripts/audit/domains/ai-acceptance/law-012-v12-inspection.ts
- scripts/audit/domains/ai-acceptance/law-004-v20-observation-inspection.ts
- tests/exam/ai-production-v6-contract.test.ts
- tests/exam/ai-production-v20-observation.test.ts

---

## 3. 最高级权威矩阵

| 问题 | 唯一权威 | current_reason |
| --- | --- | --- |
| Website demand 是否还活着 | Website job + 持久 cancel/delete/revoke/termination + Domain admission | 不参与 |
| 业务下一步是什么 | Website next_action_code | 不参与 |
| 当前 accepted attempt 是谁 | Website attempt_id + accepted_at + grant/receipt | 不参与 |
| 当前谁有写权限 | lease + fence + worker session + grant | 不参与 |
| AGENT 本地 exact attempt 是否 durable accepted | production_tasks.current_attempt_id + task/request identity | 不参与 |
| source handoff 是否 sealed | production_attempt_handoffs exact source row | 不参与 |
| 结果是否 staged | staged_result_json + exact task/result identity | 不参与 |
| terminal intent 是否 durable | production_outbox exact terminal intent | 不参与 |
| Provider effect 是否发生 | Browser WAL + provider_effect_identity | 不参与 |
| 业务是否 completed | Domain admission/business consumption/object readback | 不参与 |
| 最近为什么卡住 | current_reason | 唯一合法用途 |

### 3.1 单向投影原则

合法方向：

~~~text
typed durable facts
+ latest observation
-> current_reason
~~~

永久禁止：

~~~text
current_reason
-X-> typed durable state / eligibility / authorization
~~~

### 3.2 合法诊断 mutation 不得改变行为

对 failed 行：

- current_reason 仍必须非空；
- 允许在合法非空诊断值之间变化；
- 变化不得改变 claim / recovery / source seal / stage / capacity / Provider gate / deletion / completed。

对 completed 行：

- current_reason=null 只是 completed projection 的结构一致性；
- completed 的真正权威必须先来自 Domain admission/business consumption/object readback；
- 禁止 current_reason=null 反向推导 completed。

---

## 4. 第一直接断裂与当前真实错位

### D1：SOURCE_HANDOFF_SEALED 把 current_reason 变成持久 fence

现役 store-source-readback.ts：

~~~text
reason = SOURCE_HANDOFF_SEALED|sealHash
update production_tasks.current_reason
WHERE current_reason IS oldReason
~~~

后续多个消费者又用该 prefix/equality 决定：

- 是否还能写 readback observation；
- source handoff 是否 sealed；
- claim recovery 是否进入 handoff；
- 新 attempt 是否可 accept；
- business-in-flight 是否排除旧 attempt。

但现役数据库已经有 production_attempt_handoffs：

~~~text
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

所以 current_reason 在 source handoff 里属于重复状态权威。

**第一直接断裂：current_reason 文案被当成 source handoff 的真实 fence。**

### D2：EXECUTING 被用作 stage permit

现役 store-task-state.ts：

~~~text
markExecuting()
-> current_reason = EXECUTING

stageResult()
-> 要求 current_reason === EXECUTING
-> UPDATE WHERE current_reason='EXECUTING'
~~~

结果写资格因此被诊断文本控制。

真正必要的安全门应是：

- exact job/task identity；
- exact current_attempt_id；
- task.status=failed；
- staged result identity 与 task 一致；
- 已存在 staged result 时 only exact replay；
- exact current source attempt 没有 typed sealed handoff；
- stage + terminal Outbox 继续原子。

EXECUTING 只允许继续作为诊断显示。

### D3：business-in-flight 与 readback 分母读取 reason prefix

runtime-loops.ts 当前用 SOURCE_HANDOFF_SEALED prefix：

- 排除 businessInFlightJobIds；
- 排除 pendingProviderReadbackJobIds。

容量与 readback eligibility 因而被诊断文案影响。

正确来源：

- production_tasks.current_attempt_id；
- staged_result_json；
- exact production_attempt_handoffs source row；
- Website grant / next_action；
- active Runtime execution。

### D4：cooldown gate 解析 current_reason

runtime-loops.ts 当前：

~~~text
providerCooldownPaused(current_reason)
pendingCooldownResumeJobIds()
~~~

Provider submit gate 的真正权威已经存在：

- ProviderRateLimitControl；
- production_outbox provider_cooldown intent/receipt；
- Website provider cooldown incident/cohort/clearance；
- Website 当前 attestation/claim authority。

诊断 reason 不能开关 Provider submit gate。

### D5：claim consumer 把 LEASE_GRANTED literal 当第二授权

Website job-claim-result.ts 明确生产：

~~~text
current_reason = LEASE_GRANTED
~~~

AGENT transport-protocol.ts 又要求：

~~~text
current_reason: literal LEASE_GRANTED
~~~

但是 canonical V43 manifest/spec/dependency **没有把 current_reason literal 定义成 control contract authority**；真实授权已经由：

~~~text
job_id
request_hash
attempt_id
lease
fence
worker session
grant
control_contract_version
~~~

完整闭合。

因此 current_reason=LEASE_GRANTED 可以继续保持 wire 字节不变，但 AGENT consumer 不应把该 literal 作为第二授权门。

### D6：deletion/control authority 与 current_reason 双证明

cloud-reconciliation-client.ts 当前要求：

~~~text
control_intent = cancel_requested / PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED
AND
current_reason.code = PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED
~~~

这是双权威。

正确规则：

~~~text
control_intent 精确授权删除
-> deletionAuthorized = true

current_reason 只显示删除原因
-> 不参与授权
~~~

current_reason 即使错写，也只能产生诊断 inconsistency，不能取消 Website control intent 的权威。

### D7：factory readiness 解释历史 current_reason sentinel

Website factory-readiness.ts 当前仍有：

~~~text
current_reason.location = automatic-recovery-cutover
AND retry_not_before IS NULL
-> not ready
~~~

该 sentinel 来自历史 0101 cutover。现役 runtime qualification 已由 status/attempt/retry/lease/control/protocol/session 等 typed facts 负责。

因此 active readiness 继续解释历史诊断 sentinel，是历史投影泄漏进现役权威。

历史 migration bytes 永久不改。本轮只删除现役 readiness 对该诊断值的解释。

### D8：worker observation 的 nullability 只能单向验证

AGENT worker-observation-client.ts 当前把：

~~~text
status=completed
+ next_action=CONSUME_CURRENT_RESULT
+ current_reason_code=null
+ business_admission_receipt_hash != null
~~~

组合验证为 completed observation。

该结构可保留，但必须冻结成：

~~~text
业务 completed 权威
-> 要求诊断 projection 形状一致

current_reason_code=null
-X-> 业务 completed
~~~

---

## 5. Identity spine 与有限闭环分母

### 5.1 长期业务身份

~~~text
job_id
+ request_hash
+ Website frozen task
~~~

### 5.2 控制 epoch

~~~text
attempt_id
result_revision
lease
fence
worker session
Browser authority epoch
~~~

这些只回答各自控制代次，不能冒充 job identity。

### 5.3 Runtime durable facts

~~~text
production_tasks:
  current_attempt_id
  staged_result_json
  attempt_failure_json

production_attempt_handoffs:
  source_attempt_id
  issued_attempt_id
  seal_hash
  source_manifest_json
  first_fact_raw
  sealed_at
  accepted_at
  readback_observations_json

production_outbox:
  exact durable intents / receipts
~~~

current_reason 不进入 identity spine。

### 5.4 有限分母

#### 普通执行

~~~text
Website grant
-> AGENT durable accept
-> Product execution
-> exact result
-> stage + terminal Outbox
-> Website terminal
-> Domain Consumer admission
-> business consumption/object readback
-> completed
~~~

current_reason 只随每一步更新显示。

#### source handoff

~~~text
Website WAIT_NEW_ATTEMPT
-> Runtime 收束旧 execution
-> exact current source attempt
-> staged result absent
-> source evidence complete
-> production_attempt_handoffs exact row seal
-> Website 行锁核 source evidence
-> Website issued new attempt
-> AGENT 用 exact typed handoff row + grant 切 current_attempt_id
-> 接回普通执行
~~~

#### cooldown

~~~text
Browser known rate-limit
-> provider_cooldown Outbox intent
-> local submit gate closed
-> Website incident/cohort/clearance
-> exact clearance readback
-> gate reopen
~~~

current_reason 不能打开或关闭该 gate。

#### demand failure / infrastructure failure

~~~text
局部危险动作失败
-> 当前动作 fail-close
-> 保留 typed fact
-> Website demand 仍 active
-> 现役 worker 有界再检查 / 下一授权
-> 接回唯一主链
~~~

不得出现 permanent local terminal。

---

## 6. 跨仓合同裁决

### 6.1 本方案单独施工不要求 V43 升版

已核：

- xuanxue-ai-production-v6.contract.spec.json version=43；
- xuanxue-ai-production-v6.manifest.json control_contract_version=43；
- AGENT dependency version=43；
- 三者都没有把 current_reason literal 声明为 contract authority。

本轮目标：

- Website producer shape 不变；
- Website 继续发 current_reason=LEASE_GRANTED；
- AGENT 停止把 literal 当第二授权；
- device-status shape 不变；
- current_reason 字段不删除、不改名。

因此单独施工时不需要仅因本轮升 control contract version。

### 6.2 施工前必须再过一次 canonical checker

如果施工前任何 provider/consumer canonical checker 证明 current_reason literal 已被当成跨仓授权语义，则本 Work Order 立即回到设计阻断，重新裁决真实合同版本，不允许用宽松 parser 偷穿版本门。

### 6.3 与 Target 方案禁止并行施工

Target 方案会触达 source-handoff / Runtime / quality，并计划改变跨仓 proof。

唯一施工顺序：

~~~text
Target 系统地位与强制边界施工并验收
-> 形成新 baseline
-> 本方案重新绑定 HEAD / contract version
-> current_reason 正位施工
~~~

如果授权人改变顺序，也必须由后施工方案重新绑定前一个完成后的 baseline。

---

## 7. 原子 Work Orders

## WO-G0：AGENT P0 法案正位

Owner：AGENT law-system / agent-production-runtime。

必须替换 LAW-AGENT-PRODUCTION-RUNTIME-001 中：

~~~text
current_attempt_id + current_reason + staged_result_json is null
~~~

作为 source handoff completion-port CAS 的语义。

目标：

~~~text
exact current_attempt_id
+ staged_result_json is null
+ exact production_attempt_handoffs source row sealed
+ source manifest / first fact exact identity
~~~

并冻结：

- current_reason 永远只是诊断投影；
- Runtime 不得以 current_reason code/string/prefix/nullability 决定恢复、CAS、capacity、stage、attempt 切换、Provider submit、deletion、completed；
- Demand→Result 红线不变。

LAW-AGENT-PRODUCTION-RUNTIME-005 的三表结构保持不变，不新增第四表。

施工时由 canonical law parser 计算反向依赖，禁止手工猜版本传播。

## WO-B1：source handoff 去 current_reason 权威

Owner：AGENT ProductionStore。

Affected：
- store-source-readback.ts
- store-task-state.ts
- runtime-claim-recovery.ts
- runtime-claim-operations.ts

目标：

1. recordSourceReadbackObservation：
   - 不再看 SOURCE_HANDOFF_SEALED prefix；
   - 改为读 exact job_id + source_attempt_id handoff row 的 seal_hash/sealed_at。

2. sealSourceHandoff：
   - current_reason 不再参与 CAS identity；
   - exact source row 负责 idempotent seal；
   - 事务核 current task / exact source attempt / staged absent / source task hash / first fact / manifest hash；
   - 同一 exact seal replay 允许；
   - 不同 seal 冲突 fail-close。

3. readSealedSourceHandoff：
   - 只读 typed row；
   - 必须绑定 exact source attempt；
   - 禁止 job-wide “any sealed row”。

4. acceptTaskAfterSourceHandoff：
   - 只核 typed handoff row + Website issued attempt + exact source/issued identity；
   - current_reason 只写诊断，不作切换条件。

## WO-B2：stageResult 去 EXECUTING permit

Owner：AGENT ProductionStore。

Affected：
- store-task-state.ts
- 对应 acceptance/audit

删除：

~~~text
current_reason === EXECUTING
~~~

作为 stage permit。

保留真正安全门：

- exact current_attempt_id；
- status=failed；
- result identity；
- staged conflict protection；
- exact current source attempt 未被 typed handoff seal；
- stage + terminal Outbox 原子事务。

markExecuting 仍可写 current_reason=EXECUTING，纯诊断。

## WO-B3：capacity / readback 分母去 reason prefix

Owner：AGENT Runtime。

Affected：
- runtime-loops.ts
- runtime-claim-recovery.ts
- contract-inspection.ts

删除：

- SOURCE_HANDOFF_SEALED prefix 对 businessInFlightJobIds 的影响；
- prefix 对 pendingProviderReadbackJobIds 的影响。

改用：

- exact current attempt；
- active execution；
- staged result；
- exact handoff row；
- Website next_action / grant。

验收必须证明：相同 typed facts 下只改变 current_reason，businessInFlightCount 完全相等。

## WO-B4：cooldown 去 reason parser

Owner：AGENT Runtime / ProviderRateLimitControl。

删除：

- providerCooldownPaused(reason)；
- pendingCooldownResumeJobIds 的 reason-only 权威分支。

submit gate 只消费：

- ProviderRateLimitControl；
- provider_cooldown Outbox/receipt；
- Website exact incident/cohort/clearance；
- current grant/attestation。

诊断 current_reason 仍可显示 cooldown。

## WO-B5：claim current_reason literal 降级

Owner：AGENT transport consumer。

Affected：
- transport-protocol.ts
- fixtures / contract acceptance

Website producer字节保持：

~~~text
current_reason = LEASE_GRANTED
~~~

AGENT consumer 从：

~~~text
literal LEASE_GRANTED
~~~

降级为：

~~~text
required non-empty diagnostic string
~~~

真正 admission 继续精确验证 grant / attempt / lease / fence / request / session / control_contract_version。

若 canonical checker 证明 literal 是合同授权义务，则停止并回到第 6.2 节。

## WO-B6：Website control intent 与 diagnostic reason 分离

Owner：AGENT cloud reconciliation consumer。

Affected：
- cloud-reconciliation-client.ts
- related acceptance

删除：

~~~text
deletionAuthorized == (current_reason.code == PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED)
~~~

权威只认 control_intent。

current_reason mismatch：
- 可记录诊断不一致；
- 不取得删除授权；
- 不撤销真实 control_intent 授权。

## WO-W1：Website factory readiness 去历史 reason sentinel

Owner：Website ai-acceptance。

Affected：
- factory-readiness.ts
- law-012-v12-inspection.ts
- readiness tests

删除 active predicate：

~~~text
current_reason.location = automatic-recovery-cutover
~~~

readiness 只看现役：

- schema/migration registry；
- finite retry/lease liveness；
- terminal/admission liveness；
- protocol/session contract；
- control plane facts。

历史 migration 0095/0097/0101/0127 字节绝不改。

## WO-D1：Blueprint/法案文义去权威暗示

AGENT WEBSITE-AGENT-V6-BLUEPRINT：
- source handoff completion-port fence 改为 typed handoff row；
- current_reason 只描述诊断；
- Demand liveness 保持不变。

Website SYSTEM / AI-ACCEPTANCE Blueprint：
- claim / recovery / readiness 排障顺序不得暗示 current_reason 是 eligibility；
- 明确 next_action / retry / lease / control / capability / attestation 是权威；
- current_reason 仅解释“为什么”。

## WO-QA：AGENT 原生质检反转

必须新增/反转：

1. 伪造 SOURCE_HANDOFF_SEALED reason：
   - 没有 typed seal 时不得取得 handoff authority。

2. typed seal 已成立但 current_reason 改成其它合法非空值：
   - handoff authority不变；
   - late stage仍被阻止。

3. current_reason 非 EXECUTING：
   - exact current attempt + no typed seal + valid result 仍可 stage。

4. current_reason=EXECUTING：
   - exact typed source seal 已成立时 stage 必须失败。

5. cooldown reason 改写：
   - submit gate不变。

6. business denominator：
   - typed facts相同，仅诊断文本不同，businessInFlightCount相同。

7. Demand redline：
   - Target/Browser/lease/session/current_reason 任一变化后，只要 Website demand 未终止且 admission 未成立，同一 job 仍有合法下一动作；
   - 不生成 replacement job。

8. current_reason 条件表达式审计：
   - 允许纯诊断展示和幂等诊断写；
   - 禁止其参与权威动作分支；
   - 不采用“出现 current_reason if 就全禁”的粗暴静态规则。

## WO-QW：Website 原生质检

1. next action 独立：
   - 在合法诊断结构内改 current_reason.code/owner/location；
   - v6JobNextAction、claim selection、retry_not_before 不变。

2. factory readiness：
   - 改历史 reason location 不改变 readiness；
   - 真正 non-finite retry/lease 或 terminal/admission liveness 断裂仍 not_ready。

3. control intent：
   - current_reason 与 control_intent 故意不一致；
   - control action只认 exact control_intent。

4. completed redline：
   - current_reason 任意合法变化不能把 failed 变 completed；
   - terminal_status=completed 不能冒充业务 completed；
   - 只有 admission/business consumption/object readback 才 completed。

5. worker observation：
   - completed -> current_reason_code=null 可以作为投影完整性；
   - current_reason_code=null 不能反向制造 completed。

---

## 8. 删除审判

### 8.1 必须物理删除的权威用途

| 对象 | 删除理由 |
| --- | --- |
| SOURCE_HANDOFF_SEALED prefix 作为状态门 | typed handoff row 已拥有 seal |
| current_reason equality 作为 source handoff CAS | 重复状态权威 |
| EXECUTING 作为 stage permit | 诊断文案不能授权结果写 |
| reason prefix 作为 late-write fence | exact typed seal 已能机械阻断 |
| reason prefix 参与 businessInFlight | 容量不能由文案决定 |
| providerCooldownPaused(reason) | ProviderRateLimitControl 已有真实 gate |
| cooldown resume 的 reason-only 分支 | Website/Outbox/control facts 已存在 |
| claim consumer 的 LEASE_GRANTED literal 权威 | grant/lease/fence 已完整授权 |
| deletion control 的 reason 双证明 | control_intent 是唯一控制权威 |
| factory readiness 的 historical reason sentinel | migration registry + typed liveness 已覆盖 |
| 保护上述结构的旧 audit/acceptance | 质量系统不能保护字符串状态机 |

### 8.2 必须保留

- production_tasks.current_reason 列；
- failed row current_reason non-null 结构约束；
- completed projection current_reason=null 结构约束；
- Website current_reason JSON；
- operations/control-room/UI 的只读诊断投影；
- production_attempt_handoffs；
- production_tasks.current_attempt_id / staged_result / attempt_failure；
- Website next_action_code；
- control_intent；
- ProviderRateLimitControl + cooldown Outbox/receipts；
- Domain admission/business consumption/object readback。

### 8.3 禁止新增

禁止新增：

- production_task_phase/status/stage；
- runtime_state 表；
- handoff_state enum；
- current_reason shadow column；
- diagnostic_reason_v2；
- current_reason compatibility reader；
- dual-read/dual-write；
- second source-handoff state machine；
- recovery coordinator/manager；
- new cooldown state；
- current_reason version；
- 仅为本轮正位服务的 migration。

删除 current_reason 控制权后，所有必要权威已经存在。

---

## 9. 分层验收

### 9.1 静态

必须证明：

- 所有 current_reason authority use 清零；
- 只剩 projection / display / diagnostic write / structure validation；
- AGENT inspector 不再要求 SOURCE_HANDOFF_SEALED 字符串 CAS；
- Website readiness 不再解释 historical reason sentinel；
- no new state/store/compatibility。

### 9.2 状态机/属性

必须覆盖双向 mutation：

~~~text
伪 reason != 真 authority
真 authority 不受 reason mutation 影响
~~~

尤其：

- reason 伪 sealed 不得得到 seal；
- 真 sealed + reason 漂移仍保持 seal；
- reason=EXECUTING 不得绕过 typed seal；
- reason!=EXECUTING 不得阻止合法 stage；
- reason 改写不改变 capacity/cooldown/claim。

### 9.3 Dynamic Proof

Case A 普通执行：
- Website exact grant；
- AGENT durable accept；
- 修改 current_reason 为另一合法非空诊断值；
- exact result仍 stage；
- terminal/admission/completed正常；
- Provider input count不变。

Case B source handoff：
- typed exact source seal；
- current_reason 改写；
- Website source evidence/issued attempt仍 exact；
- new attempt durable accept；
- old late completion无法 stage；
- no replacement job。

Case C 伪 sealed：
- 无 typed seal；
- current_reason 写 sealed-like 文案；
- 不改变 handoff/capacity/recovery。

Case D cooldown：
- exact incident；
- current_reason 错值；
- submit gate仍由 Outbox + Website authority 控制；
- clearance后自动恢复；
- demand不丢。

Case E restart：
- Browser/Target/Runtime/session/current_reason 漂移；
- Website same job demand active；
- next_action仍可读；
- worker自动接回；
- Provider effect安全门不弱化。

### 9.4 唯一业务终点

唯一完成证明：

~~~text
same original job
-> exact result
-> Website terminal
-> Domain Consumer admission
-> business consumption receipt
-> domain object/current-row readback
-> status=completed
~~~

current_reason、claim 200、LEASE_GRANTED、Runtime READY、CHANGE PASS、Browser paired 都不是业务闭环。

---

## 10. 停止条件与回退

任一情况出现立即保持/回到设计阻断：

1. 某个 current_reason 权威分支无法由现有 typed fact 替代；
2. 必须新增第四 Runtime 表；
3. 必须新增 task phase/status；
4. 删除 reason gate 后 Provider physical input 可能增加；
5. businessInFlight 同 job 双计数；
6. Website demand 可能因 local state 缺失而永久无下一动作；
7. 需要 current_reason 语义双读兼容；
8. 需要改写历史 migration bytes；
9. Target 方案与本方案在相同 production files 并发施工；
10. canonical contract checker 证明 LEASE_GRANTED literal 是独立授权语义但方案未升版；
11. 独立子智能体出现 P0/P1 finding。

Rollback：

- 只撤本轮代码/法案/Blueprint/quality diff；
- 不改 Browser WAL；
- 不改 Outbox history；
- 不改 Website job/event/attempt；
- 不重建 current_reason 历史；
- 不重放 Provider；
- 不创建 fallback/compatibility。

---

## 11. 主设计反向审计

### R1：Source Handoff

裁决：

- production_attempt_handoffs 足以承载 exact source seal；
- 但所有 sealed 判断必须绑定 job_id + exact current source_attempt_id；
- 不能用 job-wide any sealed row；
- issued_attempt_id / accepted_at 只证明后续 issuance/acceptance，不让历史 source row继续 fence 当前新 attempt。

结果：
- P0=0
- P1 已在 WO-B1/B2 中闭合

### R2：Demand / Provider / Result 红线

Demand：
- Website next_action 仍是唯一恢复动作投影；
- current_reason 降级不能删 Runtime 自动推进/有限再检查责任。

Provider：
- 本方案不修改 provider_effect_identity、Browser WAL replay policy、risk grant；
- current_reason 永远不能开 submit gate。

Result：
- stage改为 exact attempt + typed seal + result identity；
- stage+terminal Outbox 原子性不变；
- admission/completed Owner不变。

结果：
- P0=0
- 红线不退化

### R3：合同攻击

已核 canonical V43 provider spec/manifest/dependency：

- current_reason literal 不属于 manifest authority；
- Website producer字节不变；
- AGENT只降级 consumer解释；
- 单独施工默认不升合同版本。

阻断门：
- 施工前 canonical checker 若给出相反结论，必须重新裁决版本。

### R4：nullability / completed 反向攻击

- failed 本地 task current_reason non-null 继续保留；
- completed current_reason=null 只作投影结构一致性；
- current_reason=null 不能推导 completed；
- admission/completed 不能被非空 current_reason 推翻。

结果：
- P0=0

---

## 12. 审计门与本轮用户覆盖

### 12.1 权限约束

原要求是：子智能体只能审计、审查、第三方质检，禁止参与生产施工。后续授权人明确改为“你自己审计”。

因此本轮最终审计由主智能体执行，但继续保持同一隔离纪律：

- 审计阶段只读生产代码/法案/数据库设计，不施工生产实现；
- 审计只允许修改本唯一方案与迭代记录；
- findings 先于 verdict；
- P0/P1 未闭合不得 PASS；
- 审计 PASS 不能越过 Target 前置依赖直接并行施工。

### 12.2 必审问题

独立审计必须回答：

1. 是否仍有 active runtime 根据 current_reason 内容改变 mutation/claim/recovery/capacity/stage/deletion/completed？
2. production_attempt_handoffs 是否足以替代 SOURCE_HANDOFF_SEALED 字符串 fence？
3. stageResult 去 EXECUTING gate 后，exact attempt + exact typed source seal 是否足够？
4. cooldown 去 reason parser 后，满 N accepted attempt 是否仍自动 regrant？
5. demand liveness 是否在 current_reason 漂移下仍成立？
6. Website current_reason 是否只剩 projection，factory readiness/claim/control 是否不再解释它？
7. 是否偷偷新增第二状态、第二恢复链、compatibility？
8. 与 Target 方案是否有未定义并行施工面？
9. quality 是否同时验证“伪 reason 不伪 authority”和“真 authority 不受 reason 篡改”？
10. completed 是否仍只来自 Domain admission/business consumption/object readback？
11. LEASE_GRANTED literal 降级是否真的不构成跨仓 contract semantic change？
12. current_reason nullability 是否只作结构一致性而不反向授权？

### 12.3 当前审计状态

~~~text
主设计：已更新
闭环 SKILL：已深读 >= 2 遍
双仓四带：已重绑并复核
主设计反向审计：R1-R6 完成
最终只读自审：R7 完成
P0：0
P1：0
self_audit_verdict：PASS
方案状态：审计通过-待前置依赖
立即并行施工：禁止
前置条件：Target方案施工+验收+本方案重新绑定baseline
~~~text

---

# 最终冻结句

> current_reason 是解释，不是命令；是仪表盘，不是方向盘。

> Website demand 不死，AGENT 的交付责任不死。任何诊断文本都没有资格把工单判死。

> 真实状态必须来自 typed durable facts；在合法诊断结构内改变 current_reason 的具体内容，系统授权与业务行为必须保持不变。

> 独立子智能体未放行前，本方案保持设计阻断，方案建设不结束。


---

## 13. 主设计只读审计 R5：全 consumer 扫描（非独立子智能体）

本轮重新扫描 AGENT / Website 现役 current_reason 使用面，重点判断“读取/比较 current_reason”到底是诊断用途还是权威用途。

### R5-F1：Control Room / UI 的诊断分支允许保留

Website Localization Control Room 当前存在类似：

~~~text
current_reason.code
-> ai_reason_code
-> 选择展示最近一次 rejection field failures
~~~

只要该分支仅决定：
- reason_code 展示；
- 诊断字段展开；
- 控制室说明；
- 人工排障上下文；

且绝不改变：
- claim eligibility；
- retry_not_before；
- next_action；
- source handoff；
- Provider submit gate；
- result stage/terminal；
- deletion authorization；
- business completed；

则属于合法诊断消费者，不进入删除分母。

因此本方案的静态质检必须检查“current_reason 是否参与权威动作分支”，不能粗暴禁止所有 if / equality / startsWith。

### R5-F2：Runtime reconcile 的重复诊断写允许幂等判断

runtime-loops.ts 中类似：

~~~text
if current_reason != SOURCE_HANDOFF_RECONCILIATION_PENDING
  -> setCurrentReason(...)
~~~

若其唯一效果是避免重复写同一诊断文本，不改变下一动作、claim、capacity、handoff 或 mutation，则允许保留或以等价诊断幂等实现。

但 SOURCE_HANDOFF_SEALED prefix 对 business-in-flight / source-readback / attempt切换的影响必须删除。

### R5-F3：production-source evidence 对 reason 的历史对照属于审计，不是 Runtime authority

gpt-page-operation-evidence 的 production-source 脚本可把 current_reason 与 trace failure 做 hash/关系比较，用于诊断证据报告。

这类离线/只读证据消费者可以保留，前提是：
- 不写生产状态；
- 不决定 claim/recovery；
- 不签 Provider 权限；
- 不冒充业务 completed。

### R5 总结

~~~text
新增 P0 = 0
新增 P1 = 0
P2 = 1：必须区分“诊断条件”与“权威条件”，禁止一刀切静态规则
独立子智能体 = 未执行
~~~

---

## 14. 主设计只读审计 R6：Demand / Provider / Completed 红线攻击（非独立子智能体）

### R6-A：Demand liveness

从 Website AI Acceptance 当前 next-action 投影反查：

~~~text
terminal_status != null 或 status=completed
-> CONSUME_CURRENT_RESULT

attempt_id + accepted_at
-> ACTIVE_ATTEMPT

否则
-> WAIT_NEW_ATTEMPT
~~~

该决定不依赖 current_reason。

因此 current_reason 降级后，Website 仍有独立 next_action 权威。

必须保持：
- Runtime 自动请求/等待 Website 下一动作；
- fail-close 只限制当前危险动作；
- Website demand 未终止时不得形成 permanent local terminal；
- 不创建 replacement job。

### R6-B：Provider at-most-once / controlled risk

本方案不得改变：
- provider_effect_identity；
- Browser WAL；
- delivery_priority_replay_grant；
- current grant / fence；
- Target 方案冻结的 effect / locator / current-action 三轴。

删除 cooldown reason parser 后，Provider submit gate 只能更少依赖诊断文本，不能新增输入资格。

验收硬门：

~~~text
仅改变 current_reason
-> Provider physical input delta 必须恒为 0
~~~

### R6-C：Result monotonicity

已 staged / terminal 的机械结果不得被 current_reason 改写、清空或历史 failure 撤销。

真正完成仍只认：

~~~text
Domain Consumer admission
+ business consumption
+ object/current-row readback
-> status=completed
~~~

AGENT completed -> current_reason=null 及 Website completed projection -> reason null 只是形状一致性。

### R6-D：历史 migration 与 current_reason

历史 migration 中存在：
- RECOVERY_PARKED；
- automatic-recovery-cutover；
- ATTEMPT_CUTOVER_RETIRED；
- PRIVACY_SUBJECT_CLOSED 等旧诊断值。

本轮：
- 不改历史 migration bytes；
- 不回写历史 reason；
- 不新增 compatibility；
- 只删除现役 Runtime / readiness 对历史 reason 的权威解释。

### R6 总结

~~~text
新增 P0 = 0
新增 P1 = 0
Demand redline = 保持
Provider safety = 保持
Result monotonicity = 保持
独立子智能体 = 未执行
第三方 verdict = PENDING
方案状态 = 设计阻断
~~~

---

## 15. 当前最终审计状态

~~~text
闭环 SKILL 深读：>= 2 遍，完成
双仓 recursive tree：完成
法案系统：完成
施工图：完成
现役实现：完成
原生质检：完成
主设计审计 R1-R6：完成
最终只读自审 R7：完成
P0：0
P1：0
self_audit_verdict：PASS
方案状态：审计通过-待前置依赖
立即施工：否
前置依赖：Target方案先施工并验收，然后本方案重新绑定baseline
~~~

本方案的**设计审计已经放行**。但 Target 方案与本方案存在真实施工重叠，因此在 Target 新 baseline 形成前，本方案不得进入生产施工。


---

## 16. 最终只读自审 R7：授权边界、活性与暗权威攻击

本轮根据授权人“你自己审计”的最新指令执行最终只读审计。审计不修改生产代码，只允许修订本方案。

### R7-F1：Runtime Log 的 task snapshot hash 可包含 current_reason，但只属于诊断证据

现役 Runtime Log 可记录：

~~~text
authorityRef = production-task:<jobId>
authorityHash = hashCanonical(StoredProductionTask)
~~~

StoredProductionTask 包含 current_reason，因此诊断快照 hash 会随 reason 变化。

该行为**允许保留**，原因是现役唯一消费者是 Runtime Log/Operations Snapshot 的历史证据核验，不参与 claim、recovery、Provider submit、source handoff、capacity、stage、deletion 或 completed。

冻结边界：

~~~text
current_reason 可以进入“这个诊断快照当时长什么样”的 hash
current_reason 不得进入“系统现在允许做什么”的 authorization hash / eligibility
~~~

质量系统必须证明 production-task authority resolver 只被日志/诊断链消费，未来若被生产控制链读取即判 P0 越权。

### R7-F2：business-in-flight 的精确替代公式必须写死

现役 reason 逻辑：

~~~text
failed + current_attempt_id != null
+ current_reason NOT SOURCE_HANDOFF_SEALED
-> count business in flight
~~~

目标不能简单删除 prefix 后把所有 failed/current attempt 都计入，也不能新增 business state。

唯一替代：

~~~text
count(job) =
  active execution
  OR (
    local task is failed
    AND current_attempt_id exists
    AND exact readSealedSourceHandoff(job_id, current_attempt_id) == null
  )
~~~

其中 readSealedSourceHandoff 必须先按 WO-B1 去除 current_reason 依赖，只认 exact current source row 的 seal_hash/sealed_at/manifest identity。

新 issued attempt 被 accept 后 current_attempt_id 已切换，历史 source seal 不再匹配当前 attempt，因此自然重新计入 business-in-flight。

### R7-F3：pendingProviderReadback 使用同一个 exact typed seal

现役：

~~~text
attempt_failure != null
AND current_reason NOT SOURCE_HANDOFF_SEALED
AND provider readback condition
~~~

替代为：

~~~text
attempt_failure != null
AND readSealedSourceHandoff(job_id,current_attempt_id) == null
AND provider readback condition
~~~

禁止复制第二套 SQL / prefix / enum。

### R7-F4：cooldown reason-only job set 无需替代，应直接删除

现役 pendingCooldownResumeJobIds 通过 current_reason=PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE 找任务。

审计确认 workerIteration 已有：

~~~text
hasAcceptedAttemptRecovery =
  any failed local task with current_attempt_id and not state.active
~~~

它已覆盖 cooldown 后需要 same-attempt regrant 的本地 accepted task；Provider gate 本身又由 ProviderRateLimitControl + provider_cooldown Outbox + Website authority 控制。

因此：

- 删除 providerCooldownPaused(reason)；
- 删除 pendingCooldownResumeJobIds；
- **不要新建 typed cooldown job index / table / status**；
- recovery eligibility 继续复用 hasAcceptedAttemptRecovery；
- submit gate 继续由现役 ProviderRateLimitControl 控制。

必须用满 N + cooldown clearance 后 same-attempt regrant 动态验收证明无活性回退。

### R7-F5：stage 去 EXECUTING 后的真实防迟到写安全门

EXECUTING 不可继续做 permit，但删除后必须保留已有两层真实安全：

1. Runtime per-job active execution：
   - launchClaimJobs 拒绝同 job 并发 active；
   - state.active 直到 executeClaim finally 才释放。

2. source handoff seal：
   - prepareSourceHandoffs 明确跳过 state.active.has(jobId)；
   - 只有旧 execution 已退出后才可为 exact current source attempt seal；
   - stageResult 必须拒绝 exact current source attempt 已 sealed 的 task。

所以合法 stage 安全链冻结为：

~~~text
same active/authorized attempt execution
+ exact current_attempt_id
+ valid result identity
+ no conflicting staged result
+ exact current source attempt NOT sealed
-> atomic stage + terminal Outbox
~~~

不得新增 execution phase/status/fence 表。

### R7-F6：所有 SOURCE_HANDOFF_SEALED prefix 写保护都要改成 typed seal

除读取分支外，以下写保护也属于旧权威，必须纳入 WO-B1/B2：

- markExecuting() 的 NOT LIKE SOURCE_HANDOFF_SEALED；
- setCurrentReason() 的 NOT LIKE SOURCE_HANDOFF_SEALED；
- recordAttemptFailure() 的 NOT LIKE SOURCE_HANDOFF_SEALED；
- acceptTaskAfterSourceHandoff() 的 current_reason equality CAS。

正确替代均为 exact current source attempt typed seal。纯诊断写可以按 typed事实选择“不覆盖更重要诊断”，但不得反过来用诊断文本证明 seal。

### R7-F7：LEASE_GRANTED consumer widening 的版本裁决

现役 canonical V43 spec/manifest/dependency 没有把 current_reason literal列为 control authority；Website provider继续发送完全相同字节。

AGENT 将 literal parser 降为 non-empty diagnostic string 属于 consumer 接收集合放宽，不改变 provider wire bytes、grant identity或control manifest。

本方案维持“不因这一项单独升版”，但施工前必须运行 canonical cross-repo checker。若治理 checker 将该 parser 语义认定为 contract semantic diff，则：
- 停止施工；
- 按真实 checker结果升版；
- 禁止靠宽松 parser 绕过版本门。

### R7 verdict

~~~text
审计覆盖：法案 / Blueprint / Runtime / Website / Quality / Demand / Provider / Result / hidden hash
发现 P0：0
发现 P1：4（R7-F2/F4/F5/F6，均已在本次方案中闭合）
发现 P2：2（R7-F1/F7，均已加机械边界）
未闭合 P0/P1：0
self_audit_verdict：PASS
~~~

### 放行边界

**放行的是设计，不是并行施工。**

下一步顺序保持：

~~~text
Target方案重新绑定当前HEAD
-> Target施工
-> Target原生质量 + 动态验收
-> current_reason方案重新绑定新HEAD / 新contract version
-> 再检查R7全部谓词仍成立
-> current_reason施工
~~~

若 Target 施工改变 production_attempt_handoffs 的 seal 语义、source evidence contract 或 Runtime capacity 分母，本方案自动回到审计阻断，必须重新审计，不得机械套用本次 PASS。


---

## 16. 用户授权自审后的最终审计

授权人已明确改为“你自己审计”。因此本节由主智能体切换为只读审计者角色执行，不施工生产代码，只攻击方案是否可执行、是否伤害红线、是否遗漏隐式权威。

### A1：P1 finding，source-handoff seal 与 result stage 必须机械互斥

审计发现：现役 current_reason CAS 不只是文案耦合，它事实上还承担了并发互斥作用。

现状：

~~~text
sealSourceHandoff
  -> current_reason = SOURCE_HANDOFF_SEALED|...

stageResult
  -> only if current_reason = EXECUTING
~~~

因此删除 current_reason authority 后，不能只做“先读 handoff row 再 stage”的非原子替换。

强制修正：

1. sealSourceHandoff 的全部 precondition 必须在其 SQLite transaction 内重新读取：
   - exact current task；
   - exact source attempt；
   - staged_result_json is null；
   - first fact；
   - exact handoff row；
   - manifest hash / seal identity。

2. stageResultAndEnqueueTerminal 已经是 SQLite transaction，必须在同一 transaction 内：
   - 核 exact current attempt；
   - 查询 exact production_attempt_handoffs(job_id,current_attempt_id)；
   - 若该 row 已有 seal_hash + sealed_at，立即 fail-close；
   - 只有未 sealed 才允许 stage result + terminal Outbox。

3. 两条 transaction 依赖同一 Runtime SQLite 写串行化形成互斥：
   - stage 先提交 -> seal 看到 staged_result，禁止 seal；
   - seal 先提交 -> stage 看到 typed seal，禁止 late stage；
   - 不存在第三种“双成立”状态。

4. stageResult 不得继续作为可被生产路径绕过事务边界的独立 authority surface。
   推荐收敛：
   - 生产路径只允许 stageResultAndEnqueueTerminal；
   - stageResult 改为 private/protected transaction primitive，或保证任何直接调用自己建立同样 atomic transaction；
   - acceptance 不得用绕过 terminal transaction 的 public helper 证明生产安全。

5. 新增 property/race acceptance：
   - stage-first -> seal fail；
   - seal-first -> stage fail；
   - exact replay 幂等；
   - current_reason 任意合法非空变化均不改变上述结果。

该 finding 已被方案吸收，不需要新增表、列、fence 或状态机。

### A2：task authority hash 包含 current_reason，只能保留为诊断 snapshot

现役 Runtime Log 的 production-task authority hash 使用整个 StoredProductionTask，因此包含 current_reason。

审计确认：
- resolver 只被 Runtime Log diagnosis、Operations Snapshot 与 CLI inspection 消费；
- 未进入 claim、recovery、Provider submit、stage、deletion、completed；
- current_reason 变化导致旧日志 authority hash 与当前 mutable task 不同，只能解释为历史 snapshot 已不等于当前 task。

因此：
- 允许保留，不属于流程 authority；
- 任何未来代码不得把该 mismatch 升级为业务恢复或停止资格；
- 本轮不重构日志 authority schema，避免扩大施工面。

级别：P2，非阻断。

### A3：Provider cooldown 替代分母验证

删除 providerCooldownPaused(current_reason) / pendingCooldownResumeJobIds 不会让 accepted cooldown job 丢失恢复资格，因为：

- accepted 且未 active 的本地 task 已进入 hasAcceptedAttemptRecovery；
- recovery-only claim 不依赖 cooldown reason；
- claim request 是否允许由 ProviderRateLimitControl.canRequestClaimAuthority + durable Outbox 决定；
- Provider submit 是否允许由 assertProviderSubmitAllowed + Website authority 决定；
- Website gate 继续只放 cohort 内合法恢复，不由 current_reason 决定。

不需要新增 cooldown job set/store。

结论：PASS。

### A4：factory-readiness historical sentinel 删除审计

历史 0101 migration 曾以 automatic-recovery-cutover + retry_not_before non-null 作为 migration postcondition。

现役 claim selection 和 next-action 已不读取该 reason：
- retry / lease / control / attempt / accepted_at 决定可领取性；
- retry_not_before=null 在现役模型中表示没有时间门，不是永久停工；
- 历史 migration bytes 与 registry/hash 仍保留；
- active factory readiness 不应继续把旧诊断 label 当现役状态 authority。

因此删除 active readiness 对该 sentinel 的解释是正确的。

硬门：
- 保留 non-finite retry/lease、protocol/session、terminal/admission liveness 的 typed 检查；
- 禁止把 sentinel 删除解释成删除 liveness 检查。

结论：PASS。

### A5：Demand→Result 红线

PASS。

~~~text
局部动作失败
-> fail-close 当前危险动作
-> typed durable fact
-> Website demand 仍 active
-> Website next_action / bounded recheck
-> same job 继续
-> result
-> admission
-> completed
~~~

禁止：
- current_reason 决定 permanent stop；
- replacement job；
- current_reason 产生 new attempt/revision；
- current_reason 撤销机械有效结果。

### A6：Provider safety

PASS。

本方案不修改：
- provider_effect_identity；
- Browser WAL at-most-once；
- Website risk revision grant；
- lease/fence/permit；
- Target 方案冻结的 effect / locator / current-action 三轴。

只改变 current_reason 时，Provider physical input delta 必须为 0。

### A7：completed / result monotonicity

PASS。

- current_reason=null 只能是 completed projection shape；
- terminal_status=completed 仍不是业务 completed；
- staged result 不因 reason 改写而消失；
- 只有 Domain admission/business consumption/object readback 可结束 demand。

### A8：合同

PASS，带施工前 checker 门。

V43 canonical spec/manifest/dependency 未把 current_reason=LEASE_GRANTED literal 定义为 control authority。

本轮：
- Website producer bytes 不变；
- wire field 不删除；
- AGENT consumer只降级诊断 literal 的授权解释；
- grant/attempt/lease/fence/request/session/version 仍严格核。

因此默认不升 control contract version。

### A9：删除反事实

PASS。

删掉 current_reason 的流程控制权后：
- handoff -> production_attempt_handoffs；
- stage -> exact attempt + typed seal + result identity；
- cooldown -> ProviderRateLimitControl + Outbox + Website；
- next action -> Website；
- completed -> Domain admission。

没有出现必须新增的新 authority。

---

## 17. 最终自审 verdict

Finding closure：

~~~text
P0 = 0
P1 = 1，已在第16节 A1 修正并成为施工硬门
P2 = 1，仅诊断 authority hash 新鲜度，非流程权威
未闭合 P0 = 0
未闭合 P1 = 0
~~~

### Verdict

PASS / 可施工。

授权人已明确允许本轮由主智能体自行审计，因此此前等待独立子智能体的形式阻断由本次明确授权替代。

放行只表示：
- 本方案设计可进入施工；
- 不表示生产代码已经修改；
- 不表示 Target 方案已经完成；
- 不允许两方案并行施工。

施工顺序仍冻结：

~~~text
先完成 Target 系统地位与强制边界施工/验收
-> 重新绑定 AGENT/Website 最新 HEAD 与合同版本
-> 再施工 current_reason 正位
~~~

最终冻结：

> current_reason 是解释，不是命令；是仪表盘，不是方向盘。

> source-handoff seal 与 result stage 的互斥必须由同一 Runtime SQLite 的 typed facts + transaction 保证，不得再借诊断文案充当 fence。

> Website demand 不死，AGENT 的交付责任不死。任何诊断文本都没有资格把工单判死。
