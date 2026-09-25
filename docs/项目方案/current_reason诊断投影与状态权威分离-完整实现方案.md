---
document_type: project_scheme
scheme_id: CURRENT_REASON_DIAGNOSTIC_PROJECTION_AUTHORITY_SEPARATION
scheme_name: current_reason诊断投影与状态权威分离
status: 可施工
created_at: 2026-09-25
updated_at: 2026-09-25
owner_repo: ADVISION-X/AGENT
candidate_branch: main
candidate_head: 47afed5be0925f6494ff50aff620c37544f40f0c
website_baseline: cb76c9658341f89920af125f6124f3ff40bcad0a
implementation_mode: authorized_current_reason_construction
independent_subagent_audit: required_after_implementation
audit_mode: primary_agent_two_pass_then_independent_read_only
self_audit_verdict: PASS_PHASE1_TWO_PASSES
---

# current_reason诊断投影与状态权威分离-完整实现方案

## 0. 状态、唯一结论与审计门

本方案现役执行结论见第 23 节 R12 及第 24 节 R13 的更正：授权人已明确指定本轮只施工 `current_reason`，Target 暂不处理。双仓法案与施工图已先行对齐并经主 Codex 两遍自检；本轮正在执行代码、质检与独立只读审计。R1-R11 的 Target 前置、只读设计和审计形式记录仅为历史时点，不能覆盖 R12 或充当本轮验收结果。

R11 将 R10-F2 的 consumer wire 泛化撤出施工范围；本轮继续保留 `LEASE_GRANTED` wire 字节与 V44 合同形状，只删除诊断内容的控制权。方案施工、原生质量门及生产交付各自需要独立证据，不能由设计自审代替。

### 0.1 唯一冻结句

> current_reason 是解释，不是命令；是仪表盘，不是方向盘。

这条禁令针对通过现役 claim wire 解析后的持久诊断投影。Website claim envelope 中同名字段仍有 V43 精确 literal 格式；格式不合格可被协议 parser 拒绝，但 literal 本身不签发 grant、lease、fence 或业务下一步。不得把“wire 格式校验”偷换成“诊断内容拥有执行权”，也不得为消除后者而无谓放宽前者。

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

| 仓库 | 云仓 main HEAD | 本轮有关的 candidate 事实 |
| --- | --- | --- |
| ADVISION-X/AGENT | 8666ba40e76b1772c54328bac7e3eaca8cc91b16 | 相对 ae5027d40 只更新本方案，Runtime/法案/Blueprint/quality 源码未漂移 |
| ADVISION-X/xuanxue-web | 695ddbbe004ba8919794251f81b80058a253035d | 与旧方案绑定的云仓 HEAD 相同；Target 本地 overlay 未验收 |

本轮直接读取云仓 `main=8666ba40`；相对 `ae5027d40` 的实际 diff 只有本方案文件。Website 云仓 `main=695ddbbe004ba8919794251f81b80058a253035d`。两仓本地工作区另有 Target 相关未提交 overlay，均不计作云仓已验收代码或本方案的 source candidate。

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

### D5：claim envelope 的 LEASE_GRANTED 是精确 wire grammar，不是业务授权

Website job-claim-result.ts 明确生产：

~~~text
current_reason = LEASE_GRANTED
~~~

AGENT transport-protocol.ts 又要求：

~~~text
current_reason: literal LEASE_GRANTED
~~~

该 literal 是现役 claim envelope 的格式约束。`cloud-client.ts` 在 durable accept 前解析整个 claim；非 literal 是当前协议的 malformed envelope，仍可由 parser 拒绝。它不因此取得业务授权权力；真实授权由：

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

本轮保留 Website producer 与 AGENT `z.literal("LEASE_GRANTED")`，不修改 V43 claim wire。施工要删除的是解析后把本地 `current_reason` 的值用于 source seal、recovery、stage、capacity 等控制的路径。`LEASE_GRANTED` 不能补救无效 grant；合法 wire + 有效 grant 才允许 durable accept。此前“非标准非空 reason 也必须接纳”的要求与保留精确 wire grammar 不相容，R11 按本轮提供的更短方案撤销该要求，并在验收中明确两层边界。

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

### 6.1 本方案不改变 claim wire grammar

已核：

- xuanxue-ai-production-v6.contract.spec.json version=43；
- xuanxue-ai-production-v6.manifest.json control_contract_version=43；
- AGENT dependency version=43；
- Website `services/api/src/ai-production/job-claim-result.ts` 的 `ClaimedWebsiteAgentTaskV1` 与实际 producer 固定 `"LEASE_GRANTED"`；AGENT `transport-protocol.ts` 用 `z.literal("LEASE_GRANTED")` 校验该 wire 字段。现役 provider/consumer 在此一致。

本轮目标：

- Website producer shape 不变；
- Website 继续发 current_reason=LEASE_GRANTED；
- AGENT 保留 claim envelope 的 literal 格式检查，只从 grant/attempt/lease/fence/request/session/version 取得执行授权；
- device-status shape 不变；
- current_reason 字段不删除、不改名。

consumer 不放宽接收集合，本方案不因此改变 claim wire 或单独升版。`current_reason` 从 claim envelope 投影为本地诊断后不得成为状态、资格或下一步的输入。Target 将改动 V43/V44 相关合同，本方案施工前仍须绑定其验收后的 provider/consumer 版本。

### 6.2 施工前必须再过一次 canonical checker

Target 验收后，按同一候选逐项核对 Website claim producer 类型和真实输出、AGENT claim parser、双仓 canonical spec/manifest/dependency 与合同版本。若 Target 改变了 wire grammar，重新裁决本方案；若仍是精确 literal，则保持原 provider/consumer 格式，原生验收分别证明“literal + 无效 grant 必须拒绝”和“有效 grant + literal 可接纳”。不得用 wire literal 代替 grant 验证，也不得把本地 reason 的内容用于生产控制。

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

唯一施工落点：生产入口只保留 `stageResultAndEnqueueTerminal()`。把 `store-task-state.ts` 的 public `stageResult()` 收窄为 protected `stageResultInTerminalTransaction()`，仅供现有 `store-outbox.ts` 的外层 SQLite transaction 调用；原生 audit 校验它只有这一个调用点。其 exact typed seal 判断与 stage 写必须位于该事务内，不允许独立提交 stage。直接调用 `store.stageResult()` 的 acceptance 不得继续以无 terminal intent 的假 stage 代表合法生产状态；分别改为经原子入口建立带精确 terminal intent/receipt 的状态，或把刻意不一致的旧数据隔离成只供拒绝测试使用的 fixture，并断言不能完成。不得为测试保留 public 绕行入口。

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

## WO-B5：保留 claim wire literal，只撤销其越权解释

Owner：AGENT transport consumer。

Affected：
- claim contract acceptance / Runtime authority audit；`transport-protocol.ts` 无本轮修改。

Website producer字节保持：

~~~text
current_reason = LEASE_GRANTED
~~~

AGENT consumer 保留：

~~~text
literal LEASE_GRANTED
~~~

该 literal 只验证现役 claim envelope 格式，不能在 grant / attempt / lease / fence / request / session / control_contract_version 任何一项无效时赋予授权。`websiteAgentTaskFromClaim()` 投影业务 task 后，Runtime/Store/Executor 不得再用 claim 或本地 `current_reason` 的值决定 source seal、恢复、stage、capacity、Provider submit 或业务完成。用原生 contract acceptance 和调用图证明这条边界，不新增泛化 parser、诊断 mismatch 类型或跨仓版本。

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

9. `stageResult()` 入口收敛：生产调用图只能从 `stageResultAndEnqueueTerminal()` 进入同一事务；现有 browser-failure、ledger、business-admission、startup-preflight acceptance 的直接 `store.stageResult()` 调用必须逐个迁移或明确改为不一致数据的拒绝 fixture。验收要同时断言 stage 与 terminal intent 同时成立或同时缺席，seal-first/stage-first 无双赢。

10. `production-task:` authority resolver 仍只在 Runtime Log diagnosis、Operations Snapshot 和只读 CLI 内消费。复用原生 runtime-log/production audit 的依赖检查和诊断结果 readback，不新增第二 resolver/allowlist 文件；改变诊断 reason 后 authority hash mismatch 不能改变 claim、capacity、source seal、Provider submit、stage 或 completed。

11. claim wire 与授权分离：Website 精确 `LEASE_GRANTED` + 有效 grant 可接纳；同一 literal + 无效 grant/attempt/lease/fence/request/session/version 必须拒绝；非 literal 仍按现役 wire schema 拒绝，不作为本方案的业务授权反例。accepted 后只改本地合法诊断文本，source seal、capacity、recovery、stage、Provider input 不变。

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
| claim literal 推导业务授权的解释 | wire 格式校验保留；执行授权只来自 grant/lease/fence 等 typed facts |
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
10. Target 后的新合同改变 claim wire grammar，而本方案未重新绑定 provider/consumer 类型和版本；
11. 本轮授权自审或后续复审出现未闭合 P0/P1 finding。

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
11. LEASE_GRANTED wire literal 是否只校验协议格式、没有被下游当作 grant/lease/fence 的替身？
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

> 本轮已按授权由主智能体完成只读自审并放行设计；Target 前置依赖未完成前禁止进入 production 施工。


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
历史独立子智能体形式门 = 已被授权人后续“你自己审计”明确替代
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
本轮授权自审 verdict = PASS
方案状态 = 审计通过-待前置依赖
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

### R7-F7：当时的 consumer widening 裁决（R11 已撤销）

R7 曾建议放宽 AGENT literal parser。R11 核现役 Website provider wire 类型后，删除该施工动作；最终以第 6 节、WO-B5 和 R11 的“保留精确 wire grammar、取消下游控制权”裁决为准。

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

## 17. R7 时点自审 verdict（已被第 21 节取代）

Finding closure：

~~~text
P0 = 0
P1 = 1，已在第16节 A1 修正并成为施工硬门
P2 = 1，仅诊断 authority hash 新鲜度，非流程权威
未闭合 P0 = 0
未闭合 P1 = 0
~~~

### Verdict

R7 时点记录为 PASS / 可施工；该句不是当前施工准入，当前结论以第 21 节为准。

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


---

## 18. 最终自审补充 R8：sealed source attempt 单调关闭（P1 已闭合）

### R8-F1：generic same-attempt regrant 不得复活 sealed source attempt

审计发现一个此前没有写成独立硬门的 P1：

现役 generic \`acceptTask()\` 在 \`existing.current_attempt_id === attemptId\` 时会直接写 \`LEASE_REGRANTED\` 并继续；而 source-handoff 的“旧 completion port 已关闭”目前主要依赖 \`SOURCE_HANDOFF_SEALED|...\` 文案被后续路径识别。

当 current_reason 被降级后，**typed source seal 必须成为单调关闭事实**：

~~~text
exact production_attempt_handoffs(job_id, current_attempt_id)
AND seal_hash != null
AND sealed_at != null
=
该 source attempt 的 Product completion port 永久关闭
~~~

因此：

1. \`acceptTask()\` 处理 same-attempt regrant 前，必须在同一 store authority 内查询 exact current source attempt 的 typed seal。
2. 若 exact current source attempt 已 sealed：
   - generic \`acceptTask()\` 必须 fail-close；
   - 不得写 \`LEASE_REGRANTED\`；
   - 不得进入 Product；
   - Provider physical input delta=0；
   - 只能等待 Website 对该 source seal 的精确 next action / issued attempt。
3. \`durableAcceptClaim\` 选择 \`acceptTaskAfterSourceHandoff\` 的条件必须改成：
   - incoming grant 带 \`source_handoff_seal_hash\`；
   - local exact typed seal 存在且 hash 精确相等；
   - issued attempt / source attempt 关系精确成立；
   - 绝不能再以 current_reason equality 选择分支。
4. 若 local exact source seal 已成立，但 incoming grant：
   - 缺少 source_handoff_seal_hash；
   - hash 不匹配；
   - 仍签 source old attempt；
   则判 source-handoff authority mismatch，停止本次执行并重新对账 Website，不得 fallback 到 generic accept。

### R8-F2：first-failure / release-descriptor 写入也必须与 seal 原子互斥

现役 \`recordAttemptFailure()\` 用：

~~~text
current_reason NOT LIKE SOURCE_HANDOFF_SEALED
~~~

防止 seal 后写入 first fact。

仅把它改成“写前读 typed seal”仍不够，因为 seal 与 failure write 可能竞态。

强制规则：

- \`recordAttemptFailure()\` 必须在一个 SQLite transaction 内同时：
  - 读 exact current task / attempt；
  - 读 exact source handoff row；
  - 若 seal_hash + sealed_at 已成立则拒绝；
  - 校验 first-fact immutable；
  - 写 attempt_failure_json + diagnostic current_reason。
- \`rebindAttemptFailureReleaseDescriptor()\` 同样必须在 transaction 内拒绝 exact sealed source attempt。
- \`acceptTaskAfterFailureReconciled()\` 作为 same-attempt regrant surface，也必须拒绝 exact sealed source attempt。
- seal-first 与 failure-first 的 race 必须由同一个 SQLite writer serialization 得到唯一 winner：
  - failure-first 提交后，seal 捕获该 exact first fact/hash；
  - seal-first 提交后，late failure/rebind 一律拒绝；
  - 不允许 seal manifest 生成后 first fact 再漂移。

### R8-F3：纯诊断写不需要成为 fence

\`markExecuting()\`、\`setCurrentReason()\` 可以基于 typed seal 选择不覆盖“handoff sealed”这类更有价值的诊断文案，但这只是 UI/诊断优先级。

无论它们是否写成功：
- typed seal 不变；
- completion port 不变；
- claim/recovery/capacity/stage 不变。

禁止再次用“没被覆盖的 sealed 文案”反向证明 seal。

### R8-F4：新增机械验收

必须增加以下原生 acceptance/property：

1. **sealed + stale same-attempt regrant**
   - generic accept 被拒；
   - Product 未进入；
   - Provider input delta=0。

2. **sealed + missing/mismatched source seal grant**
   - durable accept fail-close；
   - 不 fallback 到 generic accept。

3. **sealed + exact issued new attempt**
   - 只允许 \`acceptTaskAfterSourceHandoff\`；
   - current_attempt_id 原子切到 issued attempt；
   - source row 写 accepted_at；
   - 之后新 attempt 的 ordinary same-attempt regrant 正常。

4. **seal vs first-failure race**
   - failure-first：seal 使用该 exact first fact；
   - seal-first：late failure/rebind 被拒；
   - 无第三种双写成功状态。

5. **seal vs stage race**
   - 保持第16节 A1：stage-first 或 seal-first 只能一个成为 winner。

### R8 verdict

~~~text
新增 P0 = 0
新增 P1 = 2
  - R8-F1 generic regrant revival
  - R8-F2 first-failure/rebind race
两项均已纳入施工硬门
未闭合 P0/P1 = 0
最终 self_audit_verdict = PASS
~~~

这两项不要求新增表、字段、状态机或恢复 Owner，只把已经存在的 exact \`production_attempt_handoffs\` typed seal 提升为旧 source attempt completion-port 的唯一单调关闭事实。

---

## 19. R8 时点放行状态（已被第 21 节取代）

本轮用户已明确授权由主智能体自行审计。R1-R8 全部完成后：

~~~text
P0 未闭合 = 0
P1 未闭合 = 0
设计审计 = PASS
方案状态 = 审计通过-待前置依赖
立即施工 = 否
条件施工 = 是
~~~

“待前置依赖”只指：

~~~text
先完成 Target 系统地位与强制边界施工 + 原生质检 + 动态验收
-> 本方案重新绑定新的 AGENT/Website HEAD 与 control contract
-> 复核 typed source seal / source evidence / capacity 分母没有被 Target 施工改变
-> 然后进入 current_reason 施工
~~~

如果 Target 施工改变上述任一前提，本方案自动回到审计阻断，重新执行 R1-R8。

最终冻结：

> current_reason 只负责解释；所有流程资格都由 typed durable facts 决定。

> source-handoff typed seal 一旦成立，旧 source attempt 的 completion port 单调关闭，任何 generic regrant、late stage、late first-failure 或 release-descriptor rebind 都不得把它复活。

> Website demand 不死，AGENT 的交付责任不死；source attempt 被关闭不等于 job demand 被关闭，Website 必须继续给同一 job 合法下一动作。


---

## 20. R9 时点自审补充：暗权威与 claim diagnostic literal

本轮继续按授权人的“你自己审计”执行只读攻击，不修改生产代码。

### R9-F1：production-task authority hash 含 current_reason，允许但必须永久限制在诊断域

现役：

~~~text
authorityRef = production-task:<jobId>
authorityHash = hashCanonical(StoredProductionTask)
~~~

StoredProductionTask 包含 current_reason，因此 reason 改变会让旧 snapshot hash 与当前 task row 不同。

已核当前消费者：
- scripts/runtime-logs/inspect.ts 的 Runtime Log diagnosis authorityResolver；
- operations-snapshot.ts 的诊断完整性；
- Runtime span terminal 的诊断 evidence；
- acceptance 对诊断 authority 的 readback。

未发现该 authority hash 被用于：
- claim admission；
- next_action；
- source handoff；
- Provider submit；
- business capacity；
- result stage/terminal；
- deletion control；
- business completed。

裁决：

~~~text
允许：
current_reason -> historical diagnostic snapshot hash

禁止：
production-task snapshot hash -> execution eligibility / authorization
~~~

原生 audit 必须新增“production-task authority resolver consumer allowlist”或等价 AST/dependency 约束。未来任何 production control path 导入该 resolver，直接判 P0。

### R9-F2：当时的 literal widening 建议（R11 已撤销）

R9 把“非标准非空 reason 也接纳”误设为取消业务授权所必需。R11 将 wire 格式合法性与 grant 授权分开：Website 和 AGENT 保持精确 `LEASE_GRANTED` claim envelope；合法 wire 不能救活无效 grant；解析后的本地诊断不得参与任何生产控制。最终施工与验收以第 6 节、WO-B5 和 R11 为准。

### R9-F3：source seal / stage / first-failure 三方竞态已形成完整单调关闭模型

综合 A1 与 R8：

~~~text
source attempt OPEN
  |
  +-- stage + terminal transaction wins
  |     -> result path wins
  |     -> seal must fail
  |
  +-- typed source seal transaction wins
        -> source attempt completion port permanently CLOSED
        -> generic same-attempt regrant must fail
        -> late stage must fail
        -> late first-failure must fail
        -> release-descriptor rebind must fail
        -> only exact issued new attempt may reopen job execution
~~~

注意：

> source attempt CLOSED != Website demand CLOSED。

旧 source attempt 被单调关闭后，FROZEN-WEBSITE-RESULT-DEMAND-001 仍要求同一 job 由 Website 给出合法下一动作。

### R9-F4：不新增任何替代状态

R9 未发现必须增加：
- 新表；
- task phase；
- handoff enum；
- persistent fence；
- diagnostic version；
- compatibility reader；
- recovery manager。

现有 production_attempt_handoffs + production_tasks + production_outbox 足够闭合。

### R9 verdict

~~~text
新增 P0 = 0
新增 P1 = 0
新增 P2 = 1
  - production-task authority hash 必须永久限制在诊断 consumer
未闭合 P0/P1 = 0
最终 self_audit_verdict = PASS
方案状态 = 审计通过-待前置依赖
~~~

最终施工顺序不变：

~~~text
Target方案施工 + 原生质检 + 动态验收
-> current_reason方案重新绑定最新双仓 HEAD / contract
-> 重跑 R1-R9 关键谓词
-> current_reason施工
~~~

若 Target 方案改变 exact source seal、source evidence、Runtime capacity 或 V43/V44 contract，当前 PASS 自动失效，重新审计。
---

## 21. R10：云仓候选反向审计与现役停止门

本轮从 AGENT 云仓 main ae5027d40df3aae588df4b7ec8e63e7727d58526 取得同一方案，核 blob caad2d925047a30687d81c43fd77fc336319a823；Website 云仓 main 695ddbbe004ba8919794251f81b80058a253035d。AGENT 相对 3283092c9 的差异仅为本方案。两仓本地 checkout 的 Target 相关未提交改动未纳入云仓 candidate，不视为 Target 已施工或验收。以下结论只绑定这两个云仓候选。

### R10-F1：公开 stageResult 仍可制造无 terminal intent 的结果槽（P1，方案内已收敛）

现役 store-task-state.ts 的 stageResult() 是 public；生产仅由 store-outbox.ts 的 stageResultAndEnqueueTerminal() 在事务内调用，但 browser-failure、ledger、business-admission、startup-preflight acceptance 多处直接调用 public 方法。第 16 节 A1 已识别风险，却留下“private/protected 或直接调用自建 transaction”二选一，违反唯一施工落点。WO-B2 现固定为 protected primitive，唯一调用点是原子 stage+terminal 事务；WO-QA 第 9 项逐个处理旧 acceptance。验证以调用图、同事务 stage/terminal readback、seal-first/stage-first race 为准。禁止为了旧测试保留生产 public 入口。

### R10-F2：当时把 consumer widening 纳入目标的 P1（R11 已撤销）

R10 正确发现 Website provider 与 AGENT consumer 的 wire 字段都是精确 `LEASE_GRANTED`，却继续把“接纳非标准非空诊断值”当成必须实现的目标，因而制造了版本待决问题。R11 选择保留双方现役 literal，不执行该泛化，故 R10-F2 不再是现役 P1。Target 完工后的新合同仍须重新绑定，但不能把尚未出现的 wire 变化冒充当前设计 finding。

### R10-F3：production-task hash 仍只作诊断（P2，保留 R9 的边界）

store-foundation.ts 用整个 StoredProductionTask 计算 hash，故诊断 reason 变化可使旧 Runtime Log snapshot 与当前行不符。当前 resolveProductionAuthority / resolveStoredProductionAuthority 的调用只落在 Runtime Log diagnosis、Operations Snapshot、只读 CLI 与对应验收；生产 claim、source seal、stage、Provider submit 没有消费该 resolver。WO-QA 第 10 项复用原生依赖检查与 reason mutation readback；不为该风险新增状态、resolver 或独立 allowlist 文件。未来若生产控制调用图出现消费者，必须判 P0，不能继续援引本次只读观察。

### R10-F4：权威修改与前置施工仍需分别获准

AGENT LAW-AGENT-PRODUCTION-RUNTIME-001-V71 和 V6 Blueprint 仍明写 current_attempt_id + current_reason + staged_result_json is null 作旧 completion port CAS。本方案 WO-G0/WO-D1 需要改变这些现役权威，但本次用户只授权方案下载、审计与原位迭代；本轮不修改法案或 Blueprint。进入代码施工前必须由授权人分别明确批准对应权威修改，并先完成 Target 方案的现役原生质检与动态验收；不能用本方案自审替代任何一项。重新绑定时检查 Target 是否改变 typed seal、source proof、capacity 分母和 V43/V44 合同，重跑 R1-R10 受影响谓词。

### R10 当时结论（R11 已取代）

~~~text
P0 未闭合：0
P1 本轮发现：2
P1 方案内已收敛：1（R10-F1）
P1 未闭合：1（R10-F2，等 Target 后的同候选合同裁决）
P2 边界：1（R10-F3）
方案状态：设计阻断
生产施工：禁止
唯一方案路径：本文件
~~~

以上数字仅记录 R10 时点；R10-F2 已由 R11 的范围收缩消除。当前数字和施工门见第 22 节。状态变更仍只是设计施工门，不是 CHANGE、READY、RELEASE 或生产闭环证明。
---

## 22. R11：补审用户提交的两仓分析，撤销 wire 泛化

本轮输入是一份关于 Target、current_reason、completion/receipt 与其他高危词族的交叉分析。它是待核线索；本节以 AGENT 云仓 main 8666ba40e76b1772c54328bac7e3eaca8cc91b16、Website 云仓 main 695ddbbe004ba8919794251f81b80058a253035d 的现役代码和合同裁决。两仓本地 Target overlay 不进入已验收 candidate。

### R11-A：Target 仍是唯一前置

Target 方案 frontmatter 仍为 可施工、candidate_agent_head=70d41305ffc6864097c92bebce966376fb1e4319、目标 V44。AGENT 从该候选到本轮云仓 main 的 tracked diff 只命中 Target 方案和本方案两份文档，没有生产代码或权威源变更。这支持对 Target 做 scoped rebind 后继续原方案，但不等于 Target 已施工，也不能预先替其原生质检、动态验收或未来合同读回给 PASS。两方案仍禁止并行施工。

### R11-B：诊断暗权威与错误质检是真实第一断裂

store-source-readback.ts、store-task-state.ts、runtime-claim-recovery.ts、runtime-loops.ts 仍从 SOURCE_HANDOFF_SEALED/EXECUTING/cooldown reason 读出 seal、stage、recovery 或 capacity 决定。agent-production-runtime/inspector.ts 还明确要求 acceptTaskAfterSourceHandoff 包含 SOURCE_HANDOFF_SEALED 文本判断，recovery acceptance 也依赖旧行为。正确 typed handoff row 已存在。本方案 WO-B1/B2/B3/B4、WO-QA 必须同时物理删除越权分支和反转保护它们的质检；不能增加状态、表、恢复器或兼容入口。

### R11-C：LEASE_GRANTED 字节不动，权力边界写清

Website job-claim-result.ts 的 ClaimedWebsiteAgentTaskV1.current_reason 与 producer 固定为 LEASE_GRANTED；AGENT transport-protocol.ts 的 z.literal(LEASE_GRANTED) 是现役 claim envelope 格式门。cloud-client.ts 在 durable accept 前解析该 envelope；非 literal 会被拒绝，必须诚实表述为协议拒绝，不能声称“字符串完全没有任何门禁作用”。但这个格式门不签发 execution grant，也不能替代 attempt、lease、fence、request、session、contract version 的逐项验证。websiteAgentTaskFromClaim 只投影业务 task；后续本地 current_reason 必须是可变诊断而非控制输入。

因此撤销 R7/R9 的 consumer widening 和 R10-F2 的非标准非空 reason 接纳目标；Website producer、AGENT parser 与 V43 wire 均不因本方案修改。验收改为：literal + 有效 typed grant 可接纳；literal + 任一无效授权事实必拒绝；非 literal 维持现役协议拒绝；durable accept 后只改变本地合法诊断值，不改变 seal、recovery、capacity、stage 或 Provider input。这个选择与前轮“非 literal 但 grant 有效也必须接纳”口径不同，本轮按已核双仓 wire 类型与更短完整方案明确替代前轮要求，不把两种互斥验收同时留给施工者。

### R11-D：stage/seal 的事务互斥与 public 入口

R10-F1 保留并已由 WO-B2、WO-QA 收敛：public stageResult 必须变为 stageResultAndEnqueueTerminal 同事务内的唯一 protected primitive；旧 acceptance 的直接调用逐个迁移或限定为故意损坏数据的拒绝 fixture。stage-first 与 seal-first 各只有一个胜者；sealed source attempt 的 late stage、first-failure、release-descriptor rebind 和 generic same-attempt regrant 均失败。旧 attempt 关闭不终止 Website demand。

### R11-E：completion 与 receipt 是后续防回归边界，不加进本轮重构

Website job-terminal-repository.ts 的 first terminal 明写 status=failed、terminal_status=completed，并追加 business_result_ready；business-result-consumer.ts 只在 terminal_status=completed 且 status=failed 的候选上运行，核领域结果后才写 status=completed 与 business_consumption_hash；job-device-status-repository.ts 要求 completed 与 business admission receipt 同时成立。故本次受影响的完成主链没有发现把 staged result、first terminal 或普通 receipt 单独升级为业务 completed 的断裂。receipt 的各类用途继续由各自 Owner 持有；本方案只在第 9.4 节保留最终业务 readback 和反例验收，不新增 completion manager、receipt hierarchy、状态或表。若未来另行冻结词义，应作为独立获授权范围，不借本方案扩张施工。

### R11-F：其他词族不凭名称开工

checkpoint、artifact、Browser WAL、Outbox、attempt、revision、lease/fence/session/epoch、Browser lane、parent attempt 和 first failure 的权威边界，以本方案受影响的真实调用图和现役法案为限复核；本轮未取得它们各自存在独立越权断裂的证据。不为“统一治理”新增项目、台账、状态机或通用质量入口。若未来具体生产消费者把其中某事实提升为上层决定，按该消费者与权威 readback 单独立案。

### R11 现役结论

~~~text
P0 未闭合：0
P1 未闭合：0
R10-F1：已在同一方案固定唯一事务入口
R10-F2：因撤销 consumer wire 泛化而不再构成 finding
设计自审：PASS，仅绑定当前双仓云仓候选
方案状态：设计阻断，Target 前置、candidate 重绑定与权威修改授权未完成
生产施工：禁止
~~~

顺序仍为 Target scoped rebind -> Target 原生质检与动态验收 -> 本方案重新绑定双仓 HEAD/合同及相关 R1-R11 谓词 -> 按现役授权分别处理法案/Blueprint -> current_reason 施工。若另获授权做 completion/receipt 词义冻结，应排在本方案之后，只保护第 R11-E 所核的现役完成链。任何新的生产代码、合同、法案、Blueprint 或 quality 漂移都须重新核对受影响结论；本节不是 READY、RELEASE 或生产结果证明。

---

## 23. R12：本次执行优先级、V44 重绑定与减法预算

授权人本次明确要求先执行 `current_reason`，Target 暂停。此命令取代前文所有“Target 先完成才施工”的顺序句；Target 尚未完成动态验收，本方案也不声称它已完成。两仓只在现有 main 上施工，不创建分支。基线是 AGENT `47afed5be0925f6494ff50aff620c37544f40f0c` 与 Website `cb76c9658341f89920af125f6124f3ff40bcad0a`；两仓现役跨仓合同均为 V44。R1-R11 的 V43/旧候选叙述仅为历史审计记录，不能用于当前施工或 PASS。

### R12-A：权威两遍复核与先决门

第一遍沿需求→AGENT Runtime 法案→两仓 V6/AI Acceptance 施工图→V44 provider/consumer→typed handoff/Outbox/readback 正向核对；第二遍从生产消费者、质检 inspector 与结果终点反向查找 `current_reason` 的控制条件。结构遍历覆盖两仓 active law corpus 和全部现役 Blueprint，语义审读集中于命中的法条及直接依赖，不把文件计数冒充逐条理解。发现 AGENT Runtime 法案、AGENT V6 施工图、Website AI Acceptance 施工图的旧 `current_attempt_id + current_reason + staged_result_json is null` 与本方案 typed seal 冲突，故先改这三处权威；AGENT Runtime 法案依第 72 节升版并同步其六条直接/传递依赖、Manifest、registry 与原生检查。Website 现役法条仅要求 reason 投影和 typed grant，未发现必须新增法条；冻结说明书不修改。

法案、施工图与 V44 合同对齐且主 Codex 两遍自检覆盖受影响真实调用图、无未闭合 P0/P1 后，才允许进入生产代码。当前诊断字段仍保存，Website claim `LEASE_GRANTED` wire literal 原字节不改；本轮不改变 provider contract version。source seal 只由精确 job/source attempt 的现有 `production_attempt_handoffs` typed sealed row 与同事务 `production_tasks` 条件决定，stage 与 seal 必须在原 SQLite 事务双向互斥，旧 attempt 永久关闭而 Website demand 仍活。

### R12-B：物理删除与代码量核算

本轮预期删除以下旧生产控制：source reason prefix/equality CAS、`EXECUTING` stage permit、reason-based capacity/recovery/cooldown、readiness 历史 sentinel、删除控制的 reason 双证明，以及只为这些分支存在的错误质检。不得新增 Runtime 表、phase/status、handoff enum、recovery manager、兼容读取、dual-write、cooldown 状态或 migration。既有 typed seal、Outbox、ProviderRateLimitControl、Website `next_action`/`control_intent` 是直接消费者与替代权威。

代码量预算按本候选受影响生产文件的旧分支逐块估算：AGENT source/store/claim/loops/deletion 六组旧判断及 helper 可删约 70–130 行；typed seal/stage 事务互斥和精确 reader 预计补 35–75 行；Website readiness 预计删 4–8 行。因此**生产控制代码预期净减少约 20–100 行**，区间不是交付承诺。实际以两仓 `git diff --numstat` 分别统计生产、法案/施工图、质检新增/删除，并报告净值；质检反例可增加，全仓净行数不能冒充架构减法。若生产控制代码净增，必须逐项说明不可删除的真实消费者；若为一个诊断字段新增数百行生产基础设施或第二状态链，停止并重审。

### R12-C：施工、审计与验收顺序

法案/施工图对齐→主 Codex 两遍自检≥98%→主 Codex 独立逐片删除并重构生产代码与原生质检，期间两名只读前哨仅定位/审查→主 Codex 对实际 diff 两遍自检→独立只读审计者按本方案工单及反例覆盖≥95%、准确度≥95% 并放行→才使用冻结 `ci-full-governance` 依各仓唯一原生 `quality:check` 执行 CHANGE、READY、RELEASE。任何上一步未闭合不得追下一步。业务完成仍只认同一 Website job 的结果、领域 admission、consumer receipt 与对象读回；任何质量级别不代替此证明。

### R12-D：第一阶段主 Codex 双遍自检记录

第一遍正向覆盖：两仓 main/dirty 绑定、active law 依赖闭包、AGENT/Website 适用 Blueprint、V44 provider/consumer、source seal/stage/Outbox 的 Owner 与业务终点；AGENT `audit:build` 和 `audit:projection:check` 均通过，Website projection 检查通过。第二遍反向覆盖：六组 reason 控制消费者、错误 inspector/acceptance、Website readiness、claim literal 保留、历史 migration 不改、stage/seal 双向竞争及同一 job demand 不死；两仓 `git diff --check` 通过，旧 source reason CAS 权威文本零残留。有限核查分母 18 项已核 18 项（100%，高于 98% 门），未闭合 P0/P1 为 0。此处仅为施工前设计/权威自检，不是代码实现、CHANGE、READY 或动态业务 PASS。

### R12-E：实际差异审计与行数纠偏

本节代替 R12-B 的施工前粗估。当前 main 工作树以 `git diff --numstat` 按物理行统计：AGENT 生产文件新增 124、删除 112，净 **+12**；Website 生产文件新增 0、删除 4，净 **−4**；两仓生产合计新增 124、删除 116，净 **+8 行**。原预计“生产净减 20–100 行”没有实现，不能以架构减法冒充 LOC 净减。新增的 typed seal/`sealed_at` 一致性、事务内首失败和 regrant 保护、合法 continuingReplay 的 issued source 校验、stage/terminal 唯一入口均有现役消费者和反例；同时物理删除 reason prefix/equality CAS、reason cooldown 恢复 helper、重复的 provider readback 领取分支；容量排除由 reason prefix 改为 exact typed seal（第 24 节 R13 更正）。新增 Runtime 表、状态、恢复 Owner、兼容路径均为 0。若后续还能在不削弱上述反例的条件下删掉代码，应继续删，不能为追求数字移除必需的 typed 不变量。

当前质检代码 AGENT 新增 404、删除 140，净 +264；Website 新增 121、删除 3，净 +118。主要是七条法案升版引用投影、旧 stage 直调迁移、双向竞态、resolver 防回归门与 reason 篡改反例。AGENT 权威文档及合同元数据新增 61、删除 59；Website 施工图新增 5、删除 3。跨仓合同版本保持 V44，Website 历史 migration 原字节不动。全仓 LOC 增长不能冒充“减法”，本轮可验证的减法是旧字符串控制消费者归零与生产状态结构新增为零。

生产代码正向自检：seal、stage、first-failure、rebind、same-attempt regrant 都在现有 SQLite 事务内按 exact source attempt typed row 竞争；已封口 source attempt 释放本地席位、Website issued new attempt 被接纳后重新占用一个席位（第 24 节 R13 更正），已签发 replay attempt 的同 attempt grant 读回原 issued typed seal，`LEASE_GRANTED` wire 不变。反向自检：所有生产 `current_reason` 读取已逐处划分为诊断展示、结构完整性或协议格式，未见恢复、stage、capacity、删除、Provider submit、completed 控制消费者；历史 migration、固定文案控制室的纯展示过滤保留。两名只读前哨及后续独立只读审计者报告的半封口、缺 typed seal fallback、续租误拒和质检覆盖问题均已修复并加反例。AGENT Runtime acceptance、两仓 typecheck、Website 定向生产测试、隔离 PostgreSQL readiness 非 skipped 动态反例与两仓 registry projection 检查已通过；这些定向检查不等于 READY 或动态业务完成。

### R12-F：代码阶段主 Codex 双遍自检

第一遍沿 Website V44 grant → AGENT exact source/issued seal → SQLite stage+terminal → Outbox → Website admission 的正向调用图审查实际 diff。发现带 source hash 却无本地 typed seal 可落入普通 accept，以及已签发 replay attempt 同 attempt 重授会被错误拒绝，分别修复并覆盖缺本地行、伪造 reason、合法 continuingReplay 三种反例；确认本地已持久 stage+terminal 的旧结果可由其独立 typed 权威优先交付，不进入 Provider。第二遍从 AGENT、Website 全部 `current_reason` 读者和原生 inspector 反向查控制条件、SQL 谓词、resolver 消费、capacity、readiness、completed、Provider submit 与质检正反例；修复原字符串扫描门，使用 AST 与现有原生质检入口，补隔离 PostgreSQL 实测。两遍共核对 WO-G0、WO-B1–B6、WO-W1、WO-D1、WO-QA、WO-QW 全部 11 组及其直接调用点（11/11，覆盖 100%）；当前主 Codex 自检未闭合 P0=0、P1=0。该结论仍须独立只读审计正式放行，之后才能进入 CI-FULL。

## 24. R13：READY 收口记录与容量口径更正

本节只更正 R12-E 与事实不符的表述并记录收口事实，不扩大 R12 的施工范围。

1. **容量口径更正**：R12-E 曾把已封口 source attempt 的容量排除称为“错误”并改为同 job 复用席位，该做法不成立。Website `v6NewGrantCapacity` 以设备 N 减去 Runtime 上报的在途数裁决新 grant；若已封口 attempt 仍占席位，N=1（或席位被已封口 job 占满）时同一 job 永远取不到 Website 签发的新 attempt。Runtime 基线验收与 R7-F2 均要求封口释放席位。现役实现按 R7-F2 落地：`businessInFlightJobIds` 只以 exact typed seal（`readSealedSourceHandoff(job, current_attempt)` 非空）排除 failed job，不读 `current_reason`；`claimReusesExistingBusinessSlot` 恢复为仅同 attempt 复用；`agent-production-runtime-recovery-contract` 验收断言封口后在途数减一、新 attempt 接纳后加一。
2. **收口范围**：READY 收口另含 Target 提交遗留的 code-purity 预算拆分与 Browser/GPT 检查器对齐，均为行为保持的重构，未新增状态、Owner 或第二链路。R12-E 的行数只覆盖施工提交；收口增量以 `git diff --numstat 15f111e4d..HEAD` 为准，其中生产代码净增主要来自预算拆分，不是新增业务能力。
3. **审计门变更**：授权人于 2026-09-26 取消独立只读审计放行门，改为 READY 通过后直接推送。此前三名只读审计者的意见未构成放行：质检覆盖审计（完成度 48.1%、准确度 79.4%）指出 `inspectCurrentReasonAuthority` 只检查 if/三元条件与 SQL where，不覆盖箭头函数体、return 表达式和未纳入扫描的文件；claim wire 的“literal + 无效 grant 必须拒绝”、reason 变化后 claim/recovery 资格不变、Website PostgreSQL 行为 Exam 被环境变量跳过、worker observation nullability 两个方向、Dynamic Case A–E 均缺反例或证据。这些缺口不因审计门取消而消失，留作质检加固项；本轮 READY 不是它们的证明，也不是 RELEASE。
