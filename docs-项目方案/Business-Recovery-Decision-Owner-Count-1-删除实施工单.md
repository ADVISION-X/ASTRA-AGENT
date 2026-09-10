---
artifact_type: project_implementation_work_order
status: WORK_ORDER_BLOCKED
source_scheme: /Users/nexgen/Documents/AGENT/docs-项目方案/Business-Recovery-Decision-Owner-Count-1-删除实施工单.md
source_scheme_sha256: afff58abe3c3150415394a340c7886c43537d71a26193d5c260d5cb52d630219
generated_at: 2026-09-10T03:39:29+04:00
source_requirement_capture_coverage: 100%
hard_boundary_plan_coverage: BLOCKED
hard_boundary_evidence_pass: NOT_RUN
actual_scheme_satisfaction: NOT_RUN
anti_overdesign_violation: 0
---

# Business Recovery Decision Owner Count = 1 删除实施工单

> 结论：本工单已经把禁止复活法条、删除面、保留面、双仓交接和证据排完，但当前状态是 `WORK_ORDER_BLOCKED`，不得施工。第一项施工必须先建立 `TOMBSTONE-RECOVERY-AUTHORITY-001`，并接入现有 active law corpus、唯一 generated registry 和唯一 quality:check；随后才能删除恢复主权。唯一阻断是现役冻结条款 `FROZEN-WEBSITE-RESULT-DEMAND-001` 及 active law amendment 尚未得到授权人明确批准。当前日志系统改动不在本工单范围，也不是本工单阻断原因。

## 1. Executor Contract 与输入绑定

1. 开工前核验方案 hash 和全部 repo baseline；不一致即 `WORK_ORDER_STALE`，不得施工。
2. baseline 一致后按文档顺序和 `depends_on_action_ids` 执行。
3. 不重新设计方案，不跳项，不把内部施工顺序理解为阶段性交付。
4. 不新增工单外 Owner、入口、链路、fallback 或兼容层。
5. 新事实导致 Owner、target、合同、数据迁移或依赖失效时，立即停止并重新生成工单。
6. 执行期间出现命中绑定施工面的工单外变更时停止；本工单产生的预期变更不是漂移。
7. 全部 action、retirement 和必需 evidence 完成后，才计算最终满足度。
8. 施工中发现顺手优化、未来扩展或通用化机会时不得扩项；没有必要性证明的新架构对象立即停止并重新生成工单。

本工单为 BLOCKED 文档。`BLK-001` 关闭并重新生成 `WORK_ORDER_READY` 版本之前，下列动作全部不可执行。

### Repo baselines

<!-- work-order:baselines -->
| Repo | Branch | Commit |
|---|---|---|
| /Users/nexgen/Documents/AGENT | main | 07ea67b77a645af3647e88a086e252c34fb2b5c8 |
| /Users/nexgen/Documents/xuanxue-web | main | a7dea9e981334b6c10bca7e58361e172eba2a674 |

绑定时两个仓库均为 dirty candidate。为避开用户明确排除的日志施工，只绑定恢复裁决施工面：

- AGENT recovery-target overlay SHA-256：`0e4ea3a58925a751c730a0073061a998251369c3043c19d178271116dea21b8b`。
- Website recovery-target overlay SHA-256：`ad8ef0d31500b5f9148b8eedb3879d407bd0769b26c5e7a9e414d332171073de`，包含两个未跟踪的现役 worker-observation 文件。
- 日志蓝图、日志 spec、日志审计、日志测试、app-shell 以及被删除的监控大盘方案全部排除。执行前只对本工单列出的恢复裁决路径重算 overlay hash；排除面变化不得被吸收进本工单。

### 权威闭包

<!-- work-order:authority -->
| Authority | Path | Role |
|---|---|---|
| AUTH-001 | /Users/nexgen/Documents/AGENT/AGENTS.md | AGENT 冻结法案入口与唯一 Owner 约束 |
| AUTH-002 | /Users/nexgen/Documents/AGENT/.github/instructions/agent-rules/基础法案.md | AGENT code purity、唯一 Owner 与僵尸删除约束 |
| AUTH-003 | /Users/nexgen/Documents/AGENT/.github/instructions/agent-rules/功能法案.md | Runtime、GPT、Product 当前恢复 Owner 与冻结消费者义务 |
| AUTH-004 | /Users/nexgen/Documents/AGENT/docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md | AGENT Runtime 当前施工图与 V6 consumer dependency |
| AUTH-005 | /Users/nexgen/Documents/AGENT/docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md | GPT 原子 Child、Browser exact effect 与读回合同 |
| AUTH-006 | /Users/nexgen/Documents/AGENT/docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md | Browser WAL、effect identity、FIFO 与对账 Owner |
| AUTH-007 | /Users/nexgen/Documents/xuanxue-web/AGENTS.md | Website 冻结法案入口与唯一 Owner 约束 |
| AUTH-008 | /Users/nexgen/Documents/xuanxue-web/.github/instructions/agent-rules/功能法案.md | Website ai-acceptance 当前 attempt、退避、claim 与恢复条款 |
| AUTH-009 | /Users/nexgen/Documents/xuanxue-web/docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md | Website durable authority 与当前禁止 Product 步骤遥控边界 |
| AUTH-010 | /Users/nexgen/Documents/xuanxue-web/packages/ai-contracts/src/production-control/xuanxue-ai-production-v6.manifest.json | V6 reason code 与 job next action 闭集合同 |
| AUTH-011 | 本文 Appendix A | 用户给定终态方案，source_scheme_sha256 只覆盖两个 SOURCE_SCHEME 标记之间的 UTF-8 字节 |
| AUTH-012 | /Users/nexgen/Documents/AGENT/scripts/audit/generated/law-registry.generated.json | 唯一生成 registry；只投影 canonical active laws，不是第二 authority |
| AUTH-013 | /Users/nexgen/Documents/AGENT/.github/instructions/agent-rules/功能法案.md#LAW-APP-SHELL-UI-003-V3 | 已有局部禁止 retired、archived、deprecated、hidden、copied variants 的先例 |

检查范围：AGENT Runtime、Product Plugins、GPT、Browser exact-effect、production Outbox；Website ai-acceptance 的 attempt、claim、lease/fence、retry_not_before、worker observation、device-job status、result admission；两仓相应法案、蓝图、provider/dependency spec、manifest、原生审计、exam、acceptance 与 Dynamic Proof。

排除范围：日志系统现役施工及其文件、非 V6 Website 业务队列、产品内容质量规则、Browser 配对与 UI、数据库历史 migration 字节、RELEASE 执行、部署、生产数据改写。

## 2. SOURCE_REQUIREMENT 覆盖矩阵

### 逐段覆盖账

<!-- work-order:coverage -->
| Anchor | Classification | Requirement IDs | Reason |
|---|---|---|---|
| Appendix A S-01 | MAPPED_TO_REQUIREMENT | REQ-001, REQ-002 | 唯一目标指标和 Owner 是规范性终态 |
| Appendix A S-02 | MAPPED_TO_REQUIREMENT | REQ-003, REQ-004 | 第一刀的删除对象和明确不删除对象是硬边界 |
| Appendix A S-03 | MAPPED_TO_REQUIREMENT | REQ-005 | 生产链唯一顺序是规范性 Flow |
| Appendix A S-04 | MAPPED_TO_REQUIREMENT | REQ-006, REQ-007 | 三个零、允许上报事实和禁止决策集合是硬边界 |
| Appendix A S-05 | MAPPED_TO_REQUIREMENT | REQ-008, REQ-009, REQ-010 | WAL、Website policy、lease/fence、Outbox 的保留边界 |
| Appendix A S-06 | MAPPED_TO_REQUIREMENT | REQ-011 | exact effect 先对账、禁止盲重放是失败关闭合同 |
| Appendix A S-07 | MAPPED_TO_REQUIREMENT | REQ-012 | 删除后必须同步收缩重复 QA 恢复裁决面 |
| Appendix A S-08 | MAPPED_TO_REQUIREMENT | REQ-013 | 新 recovery handler 的准入指标是长期防回归要求 |
| Appendix A S-09 | MAPPED_TO_REQUIREMENT | REQ-014 | 用户要求只制定唯一施工工单并按工单实施 |
| Appendix A S-10 | MAPPED_TO_REQUIREMENT | REQ-015 | 日志系统变动明确排除，工单聚焦删除 |
| Appendix A S-11 | MAPPED_TO_REQUIREMENT | REQ-016 | 删除不等于遗忘，判死刑的设计必须持续保持不存在 |
| Appendix A S-12 | MAPPED_TO_REQUIREMENT | REQ-017 | 禁止复活按语义与决策权识别，不能靠改名绕过 |
| Appendix A S-13 | MAPPED_TO_REQUIREMENT | REQ-018 | 只复用唯一 active law corpus、generated registry 和 quality:check |
| Appendix A S-14 | MAPPED_TO_REQUIREMENT | REQ-019, REQ-022 | 解禁必须由用户明确授权且先改法案、后改代码 |
| Appendix A S-15 | MAPPED_TO_REQUIREMENT | REQ-020 | 第一条 Tombstone 的身份、禁止对象、唯一 Owner 与保留对象 |
| Appendix A S-16 | MAPPED_TO_REQUIREMENT | REQ-021, REQ-023 | Tombstone 必须进入现役门禁并由既有治理 Owner 承担 |
| Appendix A 全文背景论证 | NON_NORMATIVE:EXPLANATION | NONE | 关于组合爆炸的因果解释用于说明优先级，不另造要求 |

### 原子要求

<!-- work-order:requirements -->
| Requirement ID | Type | Hard | Hard Boundary Reason | Source Anchor | Requirement | Disposition | Current Status | Current Fact IDs | Gap IDs | Evidence IDs |
|---|---|---|---|---|---|---|---|---|---|---|
| REQ-001 | OWNER | TRUE | REQUIRED_BY: Appendix A S-01 | Appendix A S-01 | `business_recovery_owner_count` 必须等于 1，唯一 Owner 为 `Website.ai-acceptance`。 | BLOCKED | BLOCKED | FACT-001, FACT-002, FACT-003, FACT-012 | GAP-001 | EVD-001, EVD-002, EVD-009 |
| REQ-002 | MUST_NOT | TRUE | REQUIRED_BY: Appendix A S-01 | Appendix A S-01 | AGENT 内不得再出现第二业务恢复 Owner、第二业务恢复真相或第二重试裁决。 | RETIRE | DUPLICATED | FACT-002, FACT-003, FACT-004, FACT-005 | GAP-002 | EVD-002, EVD-003, EVD-009 |
| REQ-003 | RETIREMENT | TRUE | REQUIRED_BY: Appendix A S-02 | Appendix A S-02 | 物理删除 Runtime、Product、GPT 对失败后是否重跑、何时重跑、是否建下一 attempt、是否换恢复路径、是否重 submit、从哪个业务步骤重新开始的自主裁决。 | RETIRE | DUPLICATED | FACT-003, FACT-004, FACT-005 | GAP-002, GAP-003 | EVD-003, EVD-004, EVD-005 |
| REQ-004 | MUST_NOT | TRUE | REQUIRED_BY: Appendix A S-02 | Appendix A S-02 | 第一刀不得删除日志、Browser WAL、Website retry_not_before 与 attempt authority、lease/fence 或 Outbox。 | RETAIN_NO_WRITE | SATISFIED | FACT-006, FACT-007, FACT-008 | NONE | EVD-006, EVD-007 |
| REQ-005 | FLOW | TRUE | REQUIRED_BY: Appendix A S-03 | Appendix A S-03 | 生产链必须是 Website DECIDE ATTEMPT OR RETRY，随后 Runtime、Product、GPT 只 RUN OR REPORT，Browser 只 EXECUTE OR RECONCILE SAME EFFECT，Outbox 只 DELIVER。 | BUILD | CONFLICT | FACT-001, FACT-003, FACT-005, FACT-006, FACT-008, FACT-009 | GAP-001, GAP-002, GAP-003, GAP-004 | EVD-002, EVD-003, EVD-004, EVD-008 |
| REQ-006 | MUST | TRUE | REQUIRED_BY: Appendix A S-04 | Appendix A S-04 | Runtime、Product、GPT 的 `business_retry_policy` 必须各自为 0。 | RETIRE | DUPLICATED | FACT-003, FACT-004, FACT-005 | GAP-002, GAP-003 | EVD-003, EVD-004, EVD-005 |
| REQ-007 | CONTRACT | TRUE | REQUIRED_BY: Appendix A S-04 | Appendix A S-04 | Runtime、Product、GPT 只能上报 SUCCEEDED、FAILED、EFFECT_DISPATCHED、EFFECT_CONFIRMED、READBACK_FAILED 等 typed facts，不得把错误码、日志、次数、本地 checkpoint 或 Browser 事实变成业务恢复指令。 | BUILD | PARTIAL | FACT-003, FACT-004, FACT-005, FACT-009 | GAP-002, GAP-003, GAP-004 | EVD-003, EVD-004, EVD-005, EVD-008 |
| REQ-008 | STATE_DATA | TRUE | REQUIRED_BY: Appendix A S-05 and AUTH-008 | Appendix A S-05 | Website 必须继续唯一持有 accepted attempt、有限退避、claim 资格、retry_not_before、自动恢复和新 attempt 签发。 | BUILD | PARTIAL | FACT-001, FACT-009, FACT-010 | GAP-004 | EVD-001, EVD-008 |
| REQ-009 | SECURITY | TRUE | REQUIRED_BY: Appendix A S-05 | Appendix A S-05 | lease 与 fence 必须保留，旧 lease、旧 fence、旧 worker 不得污染当前 accepted attempt。 | RETAIN_NO_WRITE | SATISFIED | FACT-007 | NONE | EVD-007 |
| REQ-010 | DELIVERY | TRUE | REQUIRED_BY: Appendix A S-05 | Appendix A S-05 | Outbox 必须保留并降为纯 DELIVER ONLY；它只重投同一幂等 intent 并读回 receipt，不得创建 attempt、选择 Product 步骤或触发 Provider mutation。 | VERIFY | POST_IMPLEMENTATION_EVIDENCE_PENDING | FACT-008 | GAP-005 | EVD-006, EVD-008 |
| REQ-011 | CONTRACT | TRUE | REQUIRED_BY: Appendix A S-06 | Appendix A S-06 | 任何失败先按 exact effect identity 查询 Browser WAL；未发生才允许 Website 决定新 attempt，已发生或可能发生只允许只读对账，禁止盲重放。 | VERIFY | PARTIAL | FACT-006, FACT-004, FACT-005 | GAP-003, GAP-006 | EVD-005, EVD-006, EVD-010 |
| REQ-012 | EVIDENCE | TRUE | REQUIRED_BY: Appendix A S-07 | Appendix A S-07 | QA 必须删掉或改写 Runtime、Product、GPT 自主恢复裁决验收，并用跨仓证据证明唯一 Owner、命令消费、typed report、same-effect 对账和最终 Website 入库。 | BUILD | MISSING | FACT-011 | GAP-007 | EVD-002, EVD-003, EVD-004, EVD-005, EVD-006, EVD-008, EVD-009, EVD-010 |
| REQ-013 | MUST_NOT | TRUE | REQUIRED_BY: Appendix A S-08 | Appendix A S-08 | 新增 recovery handler 时，只允许执行或对账；任何决定下一步的 handler 必须被 AGENT 准入门拒绝。 | BUILD | MISSING | FACT-011 | GAP-007 | EVD-009 |
| REQ-014 | DELIVERY | TRUE | REQUIRED_BY: Appendix A S-09 | Appendix A S-09 | 本轮只生成一份可执行工单，不改生产代码、法案、测试、数据库或外部状态。 | RETAIN_NO_WRITE | SATISFIED | FACT-013 | NONE | EVD-011 |
| REQ-015 | MUST_NOT | TRUE | REQUIRED_BY: Appendix A S-10 | Appendix A S-10 | 不调查、不吸收、不修改当前日志系统施工；日志变化不得扩大本工单。 | RETAIN_NO_WRITE | SATISFIED | FACT-013 | NONE | EVD-011 |
| REQ-016 | MUST | TRUE | REQUIRED_BY: Appendix A S-11 | Appendix A S-11 | 被正式 Tombstone 的设计不是普通历史删除，而是必须跨未来任务持续保持不存在；`DELETED` 不等于 `FORGOTTEN`，`TOMBSTONED` 等于 `MUST REMAIN ABSENT`。 | BUILD | MISSING | FACT-014, FACT-015, FACT-016 | GAP-008 | EVD-012, EVD-013 |
| REQ-017 | MUST_NOT | TRUE | REQUIRED_BY: Appendix A S-12 | Appendix A S-12 | 禁止通过 restore、重写、复制、改名、compatibility、fallback、bridge、shadow、legacy、cherry-pick、历史照抄、第二 Owner、第二状态机或同义决策权复活 Tombstone 设计。 | BUILD | PARTIAL | FACT-015, FACT-017 | GAP-008, GAP-010 | EVD-012, EVD-013, EVD-014 |
| REQ-018 | MUST_NOT | TRUE | REQUIRED_BY: Appendix A S-13 and AUTH-001 | Appendix A S-13 | 不得新增 forbidden-recovery-registry、blacklist registry、deletion registry、history registry 或第二审计流程；Tombstone 必须是 canonical active law，并只进入现有 `law-registry.generated.json` 与现有 quality:check。 | VERIFY | PARTIAL | FACT-014, FACT-018 | GAP-009 | EVD-012, EVD-015 |
| REQ-019 | CONTRACT | TRUE | REQUIRED_BY: Appendix A S-14 | Appendix A S-14 | 修复测试、恢复兼容性、解决回归、按旧逻辑实现或参考历史版本均不构成解禁；合法解禁必须由用户明确授权恢复精确 Tombstone ID 与范围。 | BUILD | MISSING | FACT-016 | GAP-008 | EVD-012, EVD-014 |
| REQ-020 | RETIREMENT | TRUE | REQUIRED_BY: Appendix A S-15 | Appendix A S-15 | 第一条 `TOMBSTONE-RECOVERY-AUTHORITY-001` 必须在任何恢复主权代码删除前生效，永久禁止 Runtime、Product、GPT 取得 Business Recovery Decision Authority，同时明确不禁止 Browser same-effect WAL 和 reconciliation、Website retry authority、Outbox delivery、lease 与 fence。 | BUILD | MISSING | FACT-001, FACT-003, FACT-004, FACT-006, FACT-008 | GAP-008, GAP-009 | EVD-012, EVD-013, EVD-014, EVD-015 |
| REQ-021 | EVIDENCE | TRUE | REQUIRED_BY: Appendix A S-16 | Appendix A S-16 | 现有 quality:check 必须验证 Tombstone 对象本身、语义等价复活、同义 Owner 与决策边，并证明保留对象未被误杀。 | BUILD | MISSING | FACT-015, FACT-017, FACT-018 | GAP-010 | EVD-013, EVD-014, EVD-015 |
| REQ-022 | FLOW | TRUE | REQUIRED_BY: Appendix A S-14 | Appendix A S-14 | 解禁或缩小范围必须先由用户授权，再先修改或解冻对应 active law，最后才允许代码恢复；禁止先恢复代码再补法案。 | BUILD | MISSING | FACT-016 | GAP-008 | EVD-012, EVD-014 |
| REQ-023 | OWNER | TRUE | REQUIRED_BY: Appendix A S-16 and AUTH-001 | Appendix A S-16 | Tombstone canonical truth 归现有 architecture-boundary 与 code-purity 法案 Owner，generated registry 只投影，现有 quality:check 只验收；不得新增 Tombstone Runtime Owner、服务或持久化真相。 | BUILD | MISSING | FACT-014, FACT-018 | GAP-008, GAP-009 | EVD-012, EVD-015 |

## 3. 当前事实与状态

<!-- work-order:facts -->
| Fact ID | Baseline | Surface Type | Target | Anchor | Observed Fact | Evidence Ref |
|---|---|---|---|---|---|---|
| FACT-001 | xuanxue-web@a7dea9e981334b6c10bca7e58361e172eba2a674 plus recovery overlay ad8ef0d31500b5f9148b8eedb3879d407bd0769b26c5e7a9e414d332171073de | GOVERNANCE | Website ai-acceptance attempt authority | LAW-AI-ACCEPTANCE-002-V20 and AI Acceptance Blueprint | Website 已持有 accepted attempt、retry_not_before、claim 资格、lease expiry 恢复和有限自动恢复。 | /Users/nexgen/Documents/xuanxue-web/.github/instructions/agent-rules/功能法案.md and /Users/nexgen/Documents/xuanxue-web/docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md |
| FACT-002 | xuanxue-web@a7dea9e981334b6c10bca7e58361e172eba2a674 plus recovery overlay ad8ef0d31500b5f9148b8eedb3879d407bd0769b26c5e7a9e414d332171073de | GOVERNANCE | Website and Product recovery boundary | LAW-AI-ACCEPTANCE-001-V6, 003-V4, 004-V20 | Website 现役条款禁止发送 Product Stage、Prompt、Child 或 recovery step，并把 Product 内部 Flow 和 confirmed-effect skip 留给 Product。 | /Users/nexgen/Documents/xuanxue-web/.github/instructions/agent-rules/功能法案.md |
| FACT-003 | AGENT@07ea67b77a645af3647e88a086e252c34fb2b5c8 plus recovery overlay 0e4ea3a58925a751c730a0073061a998251369c3043c19d178271116dea21b8b | GOVERNANCE | Runtime task-local recovery | LAW-AGENT-PRODUCTION-RUNTIME-001-V47 | Runtime 当前被指定为 task-local 恢复主链 Owner；冻结条款还把后续 Flow 留给 Product。 | /Users/nexgen/Documents/AGENT/.github/instructions/agent-rules/功能法案.md:52 and :57 |
| FACT-004 | AGENT@07ea67b77a645af3647e88a086e252c34fb2b5c8 | GOVERNANCE | GPT and Product boundary | LAW-GPT-001-V38 and Product laws | GPT 已禁止决定业务轮次，但现役法案仍明确由 Product 决定 Child 顺序、重复、跳过和 recovery branch。 | /Users/nexgen/Documents/AGENT/.github/instructions/agent-rules/功能法案.md |
| FACT-005 | AGENT@07ea67b77a645af3647e88a086e252c34fb2b5c8 | CODE | Runtime and Product autonomous recovery decisions | runtime-claim and 18 Product files | Runtime 用 prior local state 计算 continuingAttempt 并进入 recoverAcceptedClaim；18 个 Product 文件用 recoverOnly 或 semantic-retry 自主选择执行、只读对账或再次调用。 | /Users/nexgen/Documents/AGENT/src/lib/local-runtime/production/runtime-claim.ts:209 and :469; `/Users/nexgen/Documents/AGENT/src/plugins` recovery inventory in section 6.1 |
| FACT-006 | AGENT@07ea67b77a645af3647e88a086e252c34fb2b5c8 | CODE | Browser exact-effect authority | browser mutation state and GPT safe facts | Browser 已有 PREPARED、DISPATCHED、CONFIRMED、REJECTED WAL 状态、effect identity 和 read-only outcome resolver；这是物理副作用真相而非业务恢复裁决。 | /Users/nexgen/Documents/AGENT/src/lib/browser/exact-target/browser-command-actor.ts:368 and :401; /Users/nexgen/Documents/AGENT/src/lib/browser/exact-target/browser-outcome-resolver.ts:13 |
| FACT-007 | xuanxue-web@a7dea9e981334b6c10bca7e58361e172eba2a674 and AGENT@07ea67b77a645af3647e88a086e252c34fb2b5c8 | CODE | lease and fence | V6 lifecycle and Runtime claim | Website job lifecycle 与 Runtime claim 已传递 lease_version、fencing_token、attempt_id 并拒绝旧执行污染。 | /Users/nexgen/Documents/xuanxue-web/services/api/src/ai-production/job-lifecycle-core.ts and /Users/nexgen/Documents/AGENT/src/lib/local-runtime/production/runtime-claim.ts |
| FACT-008 | AGENT@07ea67b77a645af3647e88a086e252c34fb2b5c8 | CODE | production Outbox | store-outbox and runtime-loops | Outbox 已按 idempotency_key 保存同一 intent、有限安排 next_delivery_at 并读回 Website receipt；它仍需新增负面验收证明不拥有业务重试权。 | /Users/nexgen/Documents/AGENT/src/lib/local-runtime/production/store-outbox.ts:35 and :391; /Users/nexgen/Documents/AGENT/src/lib/local-runtime/production/runtime-loops.ts:111 |
| FACT-009 | xuanxue-web@a7dea9e981334b6c10bca7e58361e172eba2a674 plus excluded dirty observation overlay | CODE | Website worker observation | job-claim-observation and V6 manifest | Dirty candidate 正在建立 job_next_action_code 只读观察投影，AGENT 生产 Runtime 当前不消费它。该观察施工按 S-10 排除，不能被本工单提升为执行授权、恢复命令或施工依赖。 | /Users/nexgen/Documents/xuanxue-web/services/api/src/ai-production/job-claim-observation.ts:133; /Users/nexgen/Documents/xuanxue-web/packages/ai-contracts/src/production-control/xuanxue-ai-production-v6.manifest.json:57 |
| FACT-010 | xuanxue-web@a7dea9e981334b6c10bca7e58361e172eba2a674 | CODE | Website failure and lease recovery | job-claim-recovery and migration 0097 | Website 数据库已根据 accepted_at、attempt、staged result、checkpoint、lease expiry 与 retry_not_before决定能否继续，不需要新表或第二调度器。 | /Users/nexgen/Documents/xuanxue-web/services/api/src/ai-production/job-claim-recovery.ts and /Users/nexgen/Documents/xuanxue-web/services/api/src/commercial/migrations/0097_ai_production_website_attempt_policy.sql |
| FACT-011 | AGENT@07ea67b77a645af3647e88a086e252c34fb2b5c8 and xuanxue-web@a7dea9e981334b6c10bca7e58361e172eba2a674 | CODE | QA recovery surfaces | Runtime and AI Acceptance manifests | 当前 QA 同时验收 Runtime recovery-contract、recovery-resume、GPT recovery fixture、continuation、browser failure、exact effect，以及 Website claim recovery、attempt policy、runtime disposition 和 post-submit recovery。 | /Users/nexgen/Documents/AGENT/scripts/acceptance/agent-production-runtime-startup.acceptance.ts:32; /Users/nexgen/Documents/AGENT/scripts/audit/domains/agent-production-runtime/manifest.json; /Users/nexgen/Documents/xuanxue-web/scripts/audit/domains/ai-acceptance/manifest.json |
| FACT-012 | user request at 2026-09-10 | MANUAL | Frozen authority change permission | explicit authorization text | 用户已批准目标方案和工单设计，但尚未明确点名解冻 `FROZEN-WEBSITE-RESULT-DEMAND-001` 并授权双仓同步替换；现役冻结条款禁止普通施工绕过。 | 当前会话用户消息 and AUTH-003, AUTH-004 |
| FACT-013 | current work-order generation | GOVERNANCE | Generation scope | one Markdown only | 本轮只新增本工单；没有修改生产代码、法案、测试、数据库或日志施工面。 | git diff limited to /Users/nexgen/Documents/AGENT/docs-项目方案/Business-Recovery-Decision-Owner-Count-1-删除实施工单.md |
| FACT-014 | AGENT@07ea67b77a645af3647e88a086e252c34fb2b5c8 | GOVERNANCE | One corpus, one registry, one verdict | AGENTS.md clauses 6 and 8 | 根治理只允许一份 active law corpus、一份 law registry、一个 quality verdict；active law 变更必须由授权人明确批准。 | /Users/nexgen/Documents/AGENT/AGENTS.md:10 and :12 |
| FACT-015 | AGENT@07ea67b77a645af3647e88a086e252c34fb2b5c8 | GOVERNANCE | Existing anti-resurrection precedent | LAW-APP-SHELL-UI-003-V3 | 现役 App Shell law 已要求 legacy authority 物理不存在，并禁止 retired、archived、deprecated、hidden 与 copied variants；对应 inspector 会扫描改名副本和非治理引用。 | /Users/nexgen/Documents/AGENT/.github/instructions/agent-rules/功能法案.md:431; /Users/nexgen/Documents/AGENT/scripts/audit/domains/app-shell-ui/inspector-retired-authority-absence.ts:44 |
| FACT-016 | AGENT@07ea67b77a645af3647e88a086e252c34fb2b5c8 | GOVERNANCE | General anti-resurrection authorization | AGENTS.md and active laws | 根治理保护未获授权的当前用户改动，也要求 active law 修改获批，但没有一条通用规则规定已被语义 Tombstone 的设计跨未来任务必须保持不存在及其精确解禁顺序。 | /Users/nexgen/Documents/AGENT/AGENTS.md:6 and :12; current canonical active law corpus inspection |
| FACT-017 | AGENT@07ea67b77a645af3647e88a086e252c34fb2b5c8 | CODE | Scattered retired-object inspections | app-shell, GPT, Browser and Runtime inspectors | 多个域已有具体 retired path、token 或 copied variant 检查，但没有针对 Business Recovery Decision Authority 的跨 Runtime、Product、GPT 语义 Tombstone 检查。 | /Users/nexgen/Documents/AGENT/scripts/audit/domains/app-shell-ui/inspector-retired-authority-absence.ts; /Users/nexgen/Documents/AGENT/scripts/audit/domains/gpt/inspector.ts; /Users/nexgen/Documents/AGENT/scripts/audit/domains/local-browser-session/mutation-atomicity-inspection.ts |
| FACT-018 | AGENT@07ea67b77a645af3647e88a086e252c34fb2b5c8 | CODE | Generated governance files | governance-authority and governance paths | 现役治理强制 generated 目录只有 `law-registry.generated.json`，并把它标为 GENERATED_REGISTRY 而非 canonical authority；新增第二 registry 会直接违反根治理。 | /Users/nexgen/Documents/AGENT/scripts/audit/governance-authority.ts:484; /Users/nexgen/Documents/AGENT/scripts/audit/shared/governance-paths.ts:4 |

## 4. GAP 与 DERIVED_CLOSURE

<!-- work-order:gaps -->
| Gap ID | Requirement IDs | Status | Owner | Derived Closure IDs | Action IDs | Blocker |
|---|---|---|---|---|---|---|
| GAP-001 | REQ-001, REQ-005 | BLOCKED | 授权人 then Website.ai-acceptance | DC-001 | ACT-001, ACT-002, ACT-003 | BLK-001 |
| GAP-002 | REQ-002, REQ-003, REQ-005, REQ-006, REQ-007 | DUPLICATED | AGENT.agent-production-runtime | DC-002 | ACT-004, ACT-005 | BLK-001 |
| GAP-003 | REQ-003, REQ-005, REQ-006, REQ-007, REQ-011 | DUPLICATED | AGENT.Product Plugins | DC-003 | ACT-006 | BLK-001 |
| GAP-004 | REQ-005, REQ-007, REQ-008 | PARTIAL | Website.ai-acceptance | DC-004 | ACT-007, ACT-008 | BLK-001 |
| GAP-005 | REQ-010 | POST_IMPLEMENTATION_EVIDENCE_PENDING | AGENT.agent-production-runtime Outbox | DC-005 | ACT-009 | BLK-001 |
| GAP-006 | REQ-011 | PARTIAL | AGENT.Browser | DC-006 | ACT-010 | BLK-001 |
| GAP-007 | REQ-012, REQ-013 | MISSING | 双仓各自唯一 quality:check Owner | DC-007 | ACT-011, ACT-012 | BLK-001 |
| GAP-008 | REQ-016, REQ-017, REQ-019, REQ-020, REQ-022, REQ-023 | MISSING | AGENT.code-purity and architecture-boundary | DC-008 | ACT-003A, ACT-003B | BLK-001 |
| GAP-009 | REQ-018, REQ-020, REQ-023 | PARTIAL | AGENT.governance-authority | DC-009 | ACT-003C | BLK-001 |
| GAP-010 | REQ-017, REQ-021 | MISSING | AGENT.architecture-boundary | DC-010 | ACT-003C, ACT-011 | BLK-001 |

### 派生闭包

<!-- work-order:derived-closures -->
| Closure ID | Requirement IDs | Authority Basis | Current Fact IDs | Reasoning | Required Result | Existing Capability Check | Deletion Test | New Architecture Objects | Necessity Proof |
|---|---|---|---|---|---|---|---|---|---|
| DC-001 | REQ-001, REQ-005 | Appendix A S-01, S-03 and AUTH-001, AUTH-007 | FACT-001, FACT-002, FACT-003, FACT-012 | 目标 Owner 与冻结法案当前分权冲突，必须先由授权人解冻，再同步改写两仓 authority，单仓修改无效。 | 两仓 active law 与 blueprint 都只承认 Website.ai-acceptance 为业务恢复裁决 Owner，AGENT 只执行、上报或对账。 | REUSE: 现役 Website ai-acceptance、claim、grant、attempt policy、retry_not_before 与 device-job status 足以承担唯一 Owner。 | FAILS_REQUIREMENT: 删除该闭包会保留冻结分权，REQ-001 与 REQ-005 无法成立。 | NONE | N/A: 只收权和删权，不新增 Owner、服务、状态或存储。 |
| DC-002 | REQ-002, REQ-003, REQ-005, REQ-006, REQ-007 | Appendix A S-02 to S-04 and AUTH-003, AUTH-004 | FACT-003, FACT-005, FACT-009 | Runtime 可保留 transport、lease/fence 校验、opaque checkpoint 绑定和 typed failure；Website 有效 claim、grant 与 attempt identity 是唯一执行授权。本地状态不得选择另一入口或执行形态。 | 删除 Runtime 本地业务恢复判定；每个有效 current grant 恰好调用一次 Product canonical entry，随后只接收 result 或 typed failure。无有效 grant 时零 Product call。 | REUSE: claim grant、attempt identity、lease/fence、executor、terminal failure 和 Outbox 已存在。 | FAILS_REQUIREMENT: 删除该闭包会让 Runtime 继续拥有 continuingAttempt、recoverAcceptedClaim 或入口选择权，REQ-002、REQ-003、REQ-006 失败。 | NONE | N/A: 复用现役 grant 与单次 Mediator dispatch，不新增恢复命令或执行模式。 |
| DC-003 | REQ-003, REQ-005, REQ-006, REQ-007, REQ-011 | Appendix A S-02, S-04, S-06 and AUTH-005, AUTH-006 | FACT-004, FACT-005, FACT-006 | Product 必须永远从同一 canonical entry 按固定顺序调用固定 Flow，不接收 fresh、reconcile、recovery mode 或同义字段。每个原子物理 effect 是否首次执行或只读对账只由 Browser 按 exact effect WAL 判断。 | 删除 Product recoverOnly、semantic-retry 和恢复入口；固定 Flow 每次从头按声明顺序调用原子 Child，已完成原子事实由现役 checkpoint 和 Browser exact-effect readback机械返回，失败只上报。 | REUSE: Product 固定 Flow、GPT atomic Child、checkpoint readback、Browser WAL 和 exact effect resolver 已存在。 | FAILS_REQUIREMENT: 删除该闭包会保留 Product 第二恢复 Owner，或把 recoverOnly 改名为执行模式，REQ-003、REQ-006 与 REQ-011 失败。 | NONE | N/A: 使用同一 Product 入口和现役原子幂等事实，不新增 workflow state。 |
| DC-004 | REQ-005, REQ-007, REQ-008 | Appendix A S-03 to S-05 and AUTH-008 to AUTH-010 | FACT-001, FACT-009, FACT-010 | Website 已持有 claim、grant、attempt、retry_not_before 与 lease recovery。缺口是去掉 AGENT 自报 retryability 的决定作用，并确保观察投影永不成为第二执行协议。 | Website 只根据 durable row、typed facts、receipt 与时间事实决定是否和何时签发 current grant 或新 attempt；Runtime 仅以通过验证的 grant 开始一次 Product canonical call。 | REUSE: V6 claim and grant contract、device-job status、job-claim-recovery、job-claim-selection 与 retry_not_before。 | FAILS_REQUIREMENT: 删除该闭包会让 Website 继续依赖第二层 disposition，或让观察投影变成第二执行命令，REQ-005、REQ-007、REQ-008 失败。 | NONE | N/A: 不加表、列、队列、恢复 directive 或协调器；复用现役授权合同。 |
| DC-005 | REQ-010 | Appendix A S-05 and AUTH-003 | FACT-008 | Outbox 的网络重投是同一 intent 的交付机制，不是业务恢复；必须保留代码并补负面边界。 | Outbox 只处理原 idempotency_key 的发送、receipt 和有限 delivery schedule，不能产生 Provider call、新 attempt 或 Product Flow 选择。 | REUSE: production_outbox、sendProductionOutboxWrite、receipt hash 与 next_delivery_at。 | FAILS_REQUIREMENT: 删除该闭包会把必要 delivery retry 误删或让 Outbox 偷渡业务重试，REQ-010 失败。 | NONE | N/A: 保留现役 Outbox，不增加 delivery service。 |
| DC-006 | REQ-011 | Appendix A S-06 and AUTH-005, AUTH-006 | FACT-006 | Provider mutation 的物理未知不能被 Website 状态替代，Browser 必须继续唯一结算原 effect；Website 只决定业务资格。 | DISPATCHED 或已发生可能性存在时只读 reconcile，同 effect identity 永不盲重放；明确未发生后 Website 才可签发下一 attempt。 | REUSE: Browser WAL、browser_mutations、effect identity、outcome resolver 与 GPT safe fact。 | FAILS_REQUIREMENT: 删除该闭包会允许双花或重复 submit，REQ-011 失败。 | NONE | N/A: 这是必须保留的现役物理真相，不新增 Browser 层。 |
| DC-007 | REQ-012, REQ-013 | Appendix A S-07, S-08 and AUTH-001, AUTH-002, AUTH-007 | FACT-011 | 仅改代码不能证明 Owner count 为 1；原有恢复测试还可能把旧分权写回。必须同步退休旧肯定断言并加入负面准入。 | 两仓原生质检证明唯一 Owner、无 AGENT recovery decision、保留 exact-effect、Outbox、lease/fence，并以同 job 动态 trace 闭合 Website durable admission。 | REUSE: 两仓现役 manifest、exam、acceptance、Dynamic Proof 与唯一 quality:check。 | FAILS_REQUIREMENT: 删除该闭包会让第二 Owner 可无门禁复活，REQ-012 与 REQ-013 失败。 | NONE | N/A: 修改现役质检，不新增第二 verdict、台账或审计服务。 |
| DC-008 | REQ-016, REQ-017, REQ-019, REQ-020, REQ-022, REQ-023 | Appendix A S-11, S-12, S-14, S-15, S-16 and AUTH-001, AUTH-002, AUTH-013 | FACT-014, FACT-015, FACT-016 | 当前只有局部禁止复活先例，缺少通用 Tombstone 语义、精确解禁门和本次具体 Tombstone。最小闭包是扩充现役 Code Purity 原则，并在 architecture-boundary 建立一条具体 active law。 | Tombstone 作为现役 law 持续存在；禁止对象按 Owner、decision、state 和调用方向识别；只有用户明确授权精确 Tombstone ID 与范围并先修改法案才可解禁。 | REUSE: 现役基础法案、architecture-boundary capabilityDomain、law record schema 与 App Shell 局部先例。 | FAILS_REQUIREMENT: 删除该闭包会让被删恢复主权只留在 Git 历史，REQ-016、REQ-017、REQ-019、REQ-020 与 REQ-022 失败。 | NONE | N/A: 复用现役 law record 和既有 capabilityDomain，不新增 registry、domain、schema 或治理角色。 |
| DC-009 | REQ-018, REQ-020, REQ-023 | Appendix A S-13, S-15, S-16 and AUTH-001, AUTH-012 | FACT-014, FACT-018 | Tombstone 进入唯一 active law corpus 后可由现役 generator 自动进入唯一 registry；不需要任何 blacklist 或 deletion database。 | 唯一 generated registry 收录具体 Tombstone law；现有 quality:check 产生该 law 的唯一 verdict；generated fileset 仍只有一个 registry。 | REUSE: governance-authority generator、law-registry.generated.json、现役 manifest 与 quality contract。 | FAILS_REQUIREMENT: 删除该闭包会出现无现役门禁的文字 Tombstone，或诱发第二 registry，REQ-018、REQ-020 与 REQ-023 失败。 | NONE | N/A: 只扩充现有 law denominator 与 inspector，不创建平行账本。 |
| DC-010 | REQ-017, REQ-021 | Appendix A S-12, S-16 and AUTH-002, AUTH-013 | FACT-015, FACT-017 | 单纯查旧文件名无法阻止同义实现；本次可机械证明的语义是 Runtime、Product、GPT 是否重新取得 retry、new attempt、rerun、resubmit、recovery branch 或 business step restart 的决定权。 | 现役 AST inspector 同时检查禁止的生产调用边、导出、持久字段、Owner symbols 和同义 state-machine 结构；路径和名称变化不能绕过 Owner 级断言。 | REUSE: architecture-boundary inspector、Code Purity AST infrastructure、全仓 target set 与现役 acceptance。 | FAILS_REQUIREMENT: 删除该闭包只剩关键词黑名单，改名后的同义第二 Owner 可通过，REQ-017 与 REQ-021 失败。 | NONE | N/A: 用现役 AST 和 target set，不引入 AI 语义评分器或第二扫描流程。 |

### 七类闭包判断

<!-- work-order:closure-checklist -->
| Gap ID | Direct | Dependency | Governance | Data | Consumer | Retirement | Evidence |
|---|---|---|---|---|---|---|---|
| GAP-001 | REQUIRED: 把业务恢复 Owner 收归 Website.ai-acceptance | REQUIRED: 两仓同步变更 | REQUIRED: 先解冻再改 active law 与 blueprint | N/A: 不改持久化结构 | REQUIRED: Runtime 只接受 Website current grant 作为执行授权 | REQUIRED: 删除旧分权文字 | REQUIRED: 双仓 authority 静态验收 |
| GAP-002 | REQUIRED: 删除 Runtime 本地恢复裁决 | REQUIRED: 复用 Website claim and grant consumer contract | REQUIRED: Runtime law 改为 run or report | N/A: 保留 checkpoint、attempt、lease、Outbox 数据 | REQUIRED: Product 每个有效 grant 只被 canonical entry 调用一次且不接收执行模式 | REQUIRED: 删除 continuingAttempt 推导、恢复入口和业务 recovery reason | REQUIRED: Runtime exam、fault 与静态负面扫描 |
| GAP-003 | REQUIRED: 删除 Product recoverOnly 与 semantic retry 裁决 | REQUIRED: 依赖 Runtime 对 current grant 的机械验证 | REQUIRED: Product laws 改为单一固定 Flow 入口 | N/A: 不新增 Product 状态 | REQUIRED: GPT 只收固定 Flow 的原子 Child 调用并返回事实 | REQUIRED: 删除旧自主恢复分支、模式字段和肯定测试 | REQUIRED: 全 Product catalog contract test |
| GAP-004 | REQUIRED: 闭合 Website grant 到 Runtime 单次调用 | REQUIRED: provider grant 与 AGENT dependency spec 等值 | REQUIRED: Website law 固定唯一 Owner | REQUIRED: 只从现役 durable row 决定 grant 和 retry_not_before | REQUIRED: Runtime 严格验证 grant、attempt、lease 和 fence | REQUIRED: 退休 AGENT retryability 输入并隔离 worker observation | REQUIRED: provider、consumer、integration 与 fault 证据 |
| GAP-005 | N/A: Outbox 代码保留 | N/A: 现役 Website write endpoint 足够 | REQUIRED: 写明 DELIVER ONLY | N/A: 保留原表 | REQUIRED: Website receipt 是唯一交付闭合 | REQUIRED: 删除任何业务动作触发断言 | REQUIRED: Outbox 负面 fault 证据 |
| GAP-006 | N/A: Browser 主链保留 | N/A: 现役 GPT Browser adapter 足够 | REQUIRED: 明确物理事实与业务裁决分离 | REQUIRED: 保留 WAL 与 effect identity | REQUIRED: Product 只请求 exact effect 只读对账 | N/A: 不退休 WAL、lease 或 resolver | REQUIRED: DISPATCHED unknown 和 CONFIRMED fault 注入 |
| GAP-007 | REQUIRED: 改写现役 QA | REQUIRED: 双仓合同 hash 一致 | REQUIRED: 唯一 quality verdict | REQUIRED: 验证无新恢复持久化 | REQUIRED: 同 job 跨仓 admission trace | REQUIRED: 扫描僵尸 handler、别名和旧断言 | REQUIRED: static、exam、integration、fault、dynamic 全部闭合 |
| GAP-008 | REQUIRED: 扩充 Code Purity 并增加具体 Tombstone active law | REQUIRED: 复用 architecture-boundary manifest | REQUIRED: 明确 Tombstone 与解禁先法案后代码 | N/A: Tombstone 不建数据库 | REQUIRED: 所有未来 Codex 和 quality consumer 只读 active law | REQUIRED: 被否决设计持续保持不存在 | REQUIRED: law denominator、AST 与 golden exam |
| GAP-009 | N/A: 不新增 registry | REQUIRED: 现役 generator 投影新 active law | REQUIRED: 保持一份 corpus、一份 registry、一个 verdict | N/A: generated JSON 不是新真相 | REQUIRED: quality:check 消费唯一 registry | REQUIRED: 禁止 blacklist、deletion、history registry | REQUIRED: generated fileset 与 denominator exam |
| GAP-010 | REQUIRED: 增加 Owner 级反复活检查 | REQUIRED: 复用现役 AST target set | REQUIRED: 由 architecture-boundary 唯一审查 | N/A: 不持久化扫描状态 | REQUIRED: 覆盖 Runtime、Product、GPT 生产消费者 | REQUIRED: 检查改名、复制、桥接与第二状态机同义路径 | REQUIRED: mutation tests 证明改名仍失败 |

## 5. 顺序化施工动作

<!-- work-order:actions -->
| Action ID | Gap ID | Owner | Surface Type | Target | Repo | Path | Symbol | Operation | Depends On | Preconditions | Exact Change | Forbidden Change | Inputs | Outputs | Consumer Handoff | Retirement | Evidence IDs | Failure Stop | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ACT-001 | GAP-001 | 授权人 | MANUAL | frozen recovery authority and active law amendment authorization | NONE | NONE | NONE | VERIFY | NONE | 用户明确理解该变更将先建立 Tombstone，再同步替换 AGENT 与 Website 的冻结恢复分权 | 给出精确授权文本：`解冻 FROZEN-WEBSITE-RESULT-DEMAND-001；批准修改 AGENT 基础法案并建立 TOMBSTONE-RECOVERY-AUTHORITY-001；授权 AGENT 与 xuanxue-web 双仓同步替换。` | 不把普通方案确认、工单确认或日志施工解释为解冻或 active law amendment 授权 | 当前工单、根治理和两仓冻结条款 | 可审计的明确授权消息 | 交给工单设计者重新绑定 candidate 并生成 READY 工单 | N/A: 这是授权门，不删除代码 | EVD-001, EVD-012 | 未出现精确解冻、Tombstone 和双仓授权即保持 BLOCKED | NOT_RUN |
| ACT-002 | GAP-001 | 工单设计者 | MANUAL | regenerated READY work order | NONE | NONE | NONE | VERIFY | ACT-001 | 精确授权存在且两仓 target overlay 已重新核验 | 重新生成唯一 READY 工单，更新 source hash、两个 HEAD、target overlay、facts、actions 和 evidence；本 BLOCKED 工单不得直接施工 | 不沿用已漂移 baseline，不吸收日志变动 | 授权消息与最新双仓只读事实 | WORK_ORDER_READY 或新的单一 blocker | 交给唯一施工执行者 | 退休本 BLOCKED 工单的执行资格，文件可作为历史证据保留 | EVD-001 | 任一 target 漂移或新 authority 冲突即生成 BLOCKED | NOT_RUN |
| ACT-003A | GAP-008 | AGENT.code-purity | GOVERNANCE | General Retirement Tombstone principle | /Users/nexgen/Documents/AGENT | .github/instructions/agent-rules/基础法案.md | LAW-CODE-PURITY-003-V3 supersedes LAW-CODE-PURITY-003-V2 | MODIFY | ACT-002 | READY 工单明确继承 active law amendment 授权 | 以新 V3 完整替换现役 V2 并声明 supersedes；加入 `DELETED is not FORGOTTEN` 与 declared Tombstone 必须持续 absent；规定按设计责任、Owner、state truth 和 decision authority 识别同义复活；规定解禁只接受用户明确 Tombstone ID 与范围 | 不原位改写 V2 身份，不改变 law-record schema，不要求所有普通删除都成为 Tombstone，不建立全局黑名单文件或新 capabilityDomain | Appendix A S-11 to S-14、FACT-014 to FACT-016 | 通用 Tombstone 治理原则 | 具体 Tombstone law 和 architecture-boundary inspector 消费 | 现役 denominator 只保留 V3，V2 不得继续 active | EVD-012, EVD-015 | 未获 active law amendment 授权或现役 Code Purity 语义冲突即停止 | NOT_RUN |
| ACT-003B | GAP-008 | AGENT.architecture-boundary | GOVERNANCE | TOMBSTONE-RECOVERY-AUTHORITY-001 canonical active law | /Users/nexgen/Documents/AGENT | .github/instructions/agent-rules/功能法案.md; scripts/audit/domains/architecture-boundary/manifest.json | LAW-TOMBSTONE-RECOVERY-AUTHORITY-001-V1 with stable base ID TOMBSTONE-RECOVERY-AUTHORITY-001 | CREATE | ACT-003A | 通用 Tombstone 原则已进入 canonical base law | 在现役 architecture-boundary capabilityDomain 建立第一条具体 active law；唯一 canonical lawId 是 `LAW-TOMBSTONE-RECOVERY-AUTHORITY-001-V1`，用户解禁引用稳定基础 ID；禁止 Runtime、Product、GPT 取得 Business Recovery Decision Authority 并列明全部同义包装；明确保留 Website attempt policy、Browser WAL same-effect reconcile、lease/fence、Outbox delivery | 不新增 TOMBSTONE capabilityDomain、schema 字段、别名 law 或第二 registry；不把 Product 固定 Flow 与 Browser 物理对账错误判成业务恢复裁决 | Appendix A S-15、REQ-001 to REQ-013、ACT-003A output | 一条 canonical active Tombstone law 和现役 manifest denominator | 现有 generator、quality:check、Runtime 与 Product 删除动作消费 | 该 law 本身保持 active，不随被删代码一起退役 | EVD-012, EVD-013, EVD-015 | Tombstone 存在第二法定名称、不能覆盖同义 decision authority 或误伤保留对象即停止 | NOT_RUN |
| ACT-003 | GAP-001 | 双仓法案 Owner | GOVERNANCE | Business recovery ownership authority | /Users/nexgen/Documents/AGENT and /Users/nexgen/Documents/xuanxue-web | .github/instructions/agent-rules/功能法案.md; docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md; docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md; docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md; src/plugins/public-knowledge-article-pipeline/SKILL.md | exact predecessor law records and frozen Product clause | MODIFY | ACT-003B | READY 工单、两仓 baseline 与 canonical Tombstone law 均有效 | 同步以新版本 supersede AGENT `LAW-AGENT-PRODUCTION-RUNTIME-001-V47`、`LAW-ARCHITECTURE-BOUNDARY-001-V5`、`LAW-GPT-001-V38` 及 Website `LAW-AI-ACCEPTANCE-001-V6`、`002-V20`、`003-V4`、`004-V20`；更新被冻结的 public-knowledge Product clause。统一规定 Website claim、grant、attempt 与 retry_not_before 是业务恢复授权；Runtime 每个有效 grant 只调用 Product canonical entry 一次；Product 不接收恢复模式；Browser 独占 same-effect 执行或对账；Outbox deliver only | 不原位复用旧 lawId，不单仓修改，不弱化 Browser WAL、lease/fence、attempt authority，不创建 Website 对 Product 的逐步遥控 | Appendix A、现役 laws、Tombstone 与 blueprints | 两仓一致的新 active authority 与 supersedes 链 | provider contract、Runtime 和 Product 只能依该 authority | 旧版本退出 active denominator；删除 Runtime task-local business recovery Owner 和 Product recovery branch Owner 文字 | EVD-002, EVD-012 | 两仓语义、Tombstone、supersedes 或版本不一致立即停止 | NOT_RUN |
| ACT-003C | GAP-009 | AGENT.architecture-boundary | CODE | Existing quality anti-resurrection enforcement | /Users/nexgen/Documents/AGENT | scripts/audit/domains/architecture-boundary/constitutional-boundary-inspector.ts; scripts/audit/domains/architecture-boundary/inspector.ts; scripts/acceptance/architecture-boundary.acceptance.ts; tests/governance/quality-contract.test.ts; scripts/audit/generated/law-registry.generated.json | LAW-TOMBSTONE-RECOVERY-AUTHORITY-001-V1 assertions | MODIFY | ACT-003 | 双仓新 authority 已建立；生产旧代码尚未删除且中间候选明确不得宣称 PASS | 扩充现役 inspector，以 AST 调用边、导出、持久字段、Owner 能力和生产消费者证明被禁决策权不存在；增加改文件名、改 symbol、包装 manager、planner、bridge 和第二 state-machine 的 mutation cases；运行现役 generator 使唯一 registry 收录该 active law。门禁在生产删除完成前允许产生预期 finding，但不得产生阶段性 PASS | 不新增 registry、checker、verdict、语义评分 Agent 或独立审计入口；不靠单一字符串扫描宣称覆盖同义实现 | canonical Tombstone law、新 authority、现役 target set、Product catalog、Runtime and GPT imports | 唯一 quality:check 中的 Tombstone assertions 和 regenerated unique registry | ACT-004、ACT-006 与未来生产变更受同一门禁 | 删除任何临时测试复制品；长期保留 canonical Tombstone law、inspector 与 golden mutation cases | EVD-012, EVD-013, EVD-014, EVD-015 | 任一同义 mutation 未被现役 quality:check 拒绝即 FAIL | NOT_RUN |
| ACT-004 | GAP-002 | AGENT.agent-production-runtime | CODE | Runtime one-grant one-dispatch boundary | /Users/nexgen/Documents/AGENT | docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json; src/lib/local-runtime/production/runtime-claim.ts; src/lib/local-runtime/production/runtime-stale-fence-reconciliation.ts; src/lib/local-runtime/production/cloud-reconciliation-client.ts | executeClaim, recoverAcceptedClaim, readClaimRecoveryStatus | MODIFY | ACT-003C, ACT-007 | AGENT dependency spec 与 Website claim and grant provider contract 等值，current grant 绑定 job、attempt、lease、fence | 删除 continuingAttempt、recoverAcceptedClaim 的业务裁决和所有恢复入口选择；Runtime 只验证 Website current grant，随后经唯一 Mediator 对 Product canonical entry 调用一次。checkpoint 与 stale-fence 代码只做 opaque 绑定、读回和事实上报，不改变入口或调用次数 | 不消费 job_next_action_code 作为执行指令，不从日志、current_reason、错误码、attempt 次数、checkpoint 或 Browser outcome 选择执行形态；不删除本地 durable facts | Website current grant、attempt、lease、fence、opaque checkpoint | 恰好一次 Product canonical entry 调用或零调用的 typed failure | Product 只获得原业务输入与授权 identity，不获得 fresh、reconcile、recovery mode 或步骤字段 | 删除 recoverAcceptedClaim 的裁决职责、continuingAttempt 推导、恢复专用入口和本地业务 recovery reason 分支；保留 transport re-entry | EVD-003, EVD-004, EVD-008 | 缺 current grant、identity、lease 或 fence 任一项即零 Product call | NOT_RUN |
| ACT-005 | GAP-002 | AGENT.agent-production-runtime | CODE | Runtime typed report boundary | /Users/nexgen/Documents/AGENT | src/lib/local-runtime/production/runtime-claim-fault-preservation.ts; src/lib/local-runtime/production/terminal-failure.ts; src/lib/local-runtime/production/executor.ts | serializeAttemptFailure, executeProductionTask | MODIFY | ACT-004 | one-grant one-dispatch boundary 已完成 | 将所有失败出口收敛为 SUCCEEDED、FAILED、EFFECT_DISPATCHED、EFFECT_CONFIRMED、READBACK_FAILED 及现役必要身份字段；删除 retryable、next-step、resume decision 等业务建议；一次调用后只 checkpoint、report 或 enqueue 同一 terminal intent | 不删除 exact effect、artifact、checkpoint、receipt、lease 或 fence 事实，不把 typed report 变成 grant 或 attempt 指令 | Runtime execution result 与 Browser safe facts | Website 可验证的事实报告 | Website.ai-acceptance 独立决定下一次是否签发 grant 或新 attempt | 删除 Runtime 对后续 attempt、时间、路径和入口的建议字段与消费者 | EVD-003, EVD-008 | 发现任何下游仍读取被删业务建议即停止并补 consumer closure | NOT_RUN |
| ACT-006 | GAP-003 | AGENT.Product Plugins | CODE | Product autonomous recovery branches | /Users/nexgen/Documents/AGENT | src/plugins | listed recoverOnly and semantic-retry inventory in section 6.1 | MODIFY | ACT-004, ACT-005 | Runtime 只会依据 Website command 进入 fresh run 或 exact-effect reconcile | 在 18 个库存文件中删除由本地 mutation、evidence、failure 或 attempt 推导的 recoverOnly 与 semantic-retry 决策；fresh run 走固定 Product Flow；reconcile 仅对已有 exact effect 做 read-only facts、readback、checkpoint 组装；任何失败只返回 typed report | 不让 Website 指定 Product Prompt、Child 顺序、Stage 或 step index；不把 Browser WAL 复制到 Product；不重新 submit 已 DISPATCHED 或 CONFIRMED effect | Runtime 授权形态、Product 静态 Flow、GPT atomic Child、Browser facts | Product result 或 typed failure fact | GPT 只执行被 Product 固定 Flow 调用的原子 Child；Browser 唯一结算 effect | 删除 semantic-retry identity、recoverOnly 自主选择和对应旧肯定断言；保留 same-effect readback 实现 | EVD-004, EVD-005, EVD-010 | 任一 Product 仍能在无 Website command 时选择重跑或对账即失败 | NOT_RUN |
| ACT-007 | GAP-004 | Website.ai-acceptance | CODE | V6 job recovery command provider | /Users/nexgen/Documents/xuanxue-web | packages/ai-contracts/src/production-control/xuanxue-ai-production-v6.manifest.json; packages/ai-contracts/src/production-control/v6-worker-observation.ts; services/api/src/ai-production/job-claim-observation.ts; services/api/src/ai-production/job-device-status-repository.ts | V6JobNextActionCode, nextAction, projectAiProductionDeviceJobStatusV6 | MODIFY | ACT-003 | Website law 已成为唯一 business recovery authority | 以现役 job_next_action_code 作为唯一闭集；由 durable job row、accepted_at、attempt_id、lease、retry_not_before、terminal receipt、business admission、control intent 与 exact-effect safe report投影；在 Runtime 每次执行前的 current device-job status 返回同一 canonical command 与 authority_ref | 不增加第二 directive、第二 status、通用 Stage、step index、resume point、Product Prompt 或 Child；不依赖日志文本 | Website durable rows 与现役 receipts | hash-bound current command projection | AGENT cloud-reconciliation-client 严格全字段解析 | 退休 AGENT 自报 disposition 对 Website business retry 的控制力 | EVD-001, EVD-002, EVD-008 | 同一 row 可得到两个动作、未知事实默认继续或 contract 不等值即失败关闭 | NOT_RUN |
| ACT-008 | GAP-004 | Website.ai-acceptance | CODE | Website attempt and retry decision | /Users/nexgen/Documents/xuanxue-web | services/api/src/ai-production/job-claim-recovery.ts; services/api/src/ai-production/job-claim-selection.ts; services/api/src/ai-production/runtime-failure-disposition.ts; services/api/src/ai-production/job-lifecycle-core.ts | recoverExpiredAiProductionJobLeases, claim selection, classifyAiRuntimeFailure | MODIFY | ACT-007 | canonical command projection 可用 | 保留 Website accepted attempt、retry_not_before、claim、lease/fence 和 finite backoff；将 V6 business recovery decision 只建立在 durable state 与 typed facts 上；移除 Runtime、Product、GPT 提供的 recoverable 或 retryability 值对 attempt policy 的决定作用；未确认 effect 时只发布 reconcile command | 不编辑历史 migration 0097，不新增列、表、queue，不把领域 Product 服务变成第二 recovery Owner | current durable state、typed fault、Browser safe effect fact | 唯一 next command、下一 claim 时间或停止事实 | Runtime 只消费，不反向建议 | 删除 V6 inbound runtime disposition 的业务裁决语义；非 V6 业务分类不在此动作中顺手改写 | EVD-001, EVD-008, EVD-010 | 发现非 V6 consumer 与目标符号共用且无法安全分离即停止并重新派生 GAP | NOT_RUN |
| ACT-009 | GAP-005 | AGENT.agent-production-runtime Outbox | CODE | Outbox deliver-only boundary | /Users/nexgen/Documents/AGENT | src/lib/local-runtime/production/store-outbox.ts; src/lib/local-runtime/production/runtime-loops.ts; src/lib/local-runtime/production/runtime-business-admission.ts | retryDelay, flushOutboxWithLog, reconcilePendingBusinessAdmissions | RETAIN | ACT-005, ACT-007 | terminal intent 已由一次执行或现役 staged result产生 | 保留同一 idempotency_key 的有限网络重投、receipt readback 与 business admission 对账；增加静态和 fault 断言，证明 Outbox 不调用 Product、GPT、Browser mutation，不创建 attempt，不改 retry_not_before | 不因字段名含 retry 删除 delivery liveness，不把 delivery schedule 搬到 Product 或 GPT | 同一 Outbox intent 与 Website receipt | delivered receipt 或仍待投递的同一 intent | Website admission receipt 闭合本地完成 | 删除任何触发新业务执行的 Outbox consumer；若不存在则只加防回归证据 | EVD-006, EVD-008 | 同一失败能产生第二 payload identity 或 Provider call 即失败 | NOT_RUN |
| ACT-010 | GAP-006 | AGENT.Browser | CODE | Browser exact-effect WAL and reconcile | /Users/nexgen/Documents/AGENT | src/lib/browser/exact-target; src/lib/browser/infrastructure/browser-lane-coordinator.ts; src/capabilities/gpt/task-exact-effect.ts; src/capabilities/gpt/production-call-facts.ts | BrowserCommandActor, resolveBrowserOutcome, readTaskExactEffect | RETAIN | ACT-006 | Website command 与 current attempt 已验证 | 保留 PREPARED、DISPATCHED、CONFIRMED、REJECTED、effect identity、WAL 和 same-effect readback；明确 Browser 只结算同一物理 effect，不决定新 attempt、等待时间或 Product 路径 | 不清空未知 WAL，不用新 attempt 覆盖旧 DISPATCHED，不把 CONFIRMED 降为未发生 | exact effect identity 与 Provider readback | immutable safe effect fact | Runtime 上报 Website，Website 决定业务动作 | N/A: 物理副作用真相完整保留 | EVD-005, EVD-006, EVD-010 | 无法唯一定位 effect 或 outcome 仍可能已发生时禁止 mutation | NOT_RUN |
| ACT-011 | GAP-007 | AGENT quality:check Owner | CODE | AGENT recovery authority acceptance | /Users/nexgen/Documents/AGENT | scripts/acceptance; scripts/audit/domains/agent-production-runtime; scripts/audit/domains/gpt; scripts/audit/domains/product-plugins | recovery-contract, recovery-resume, gpt recovery fixture, exact-effect and Product acceptance | MODIFY | ACT-004, ACT-005, ACT-006, ACT-009, ACT-010 | AGENT production changes完成且日志施工面未被纳入 diff | 删除断言 Runtime 或 Product 自主选择恢复路径的测试；把仍有价值的 fixture 改为 Website-command 驱动；新增静态扫描禁止 business retry decision API、semantic-retry、无 command 的 recoverOnly；保留 Browser、continuation identity、exact-effect 与 Outbox delivery 证据 | 不删真实物理恢复测试，不新建第二 QA verdict，不修改 runtime-log-spine 域 | AGENT changed candidate | AGENT 原生 quality evidence | Website integration 使用相同 provider contract hash | 退休旧自主恢复肯定断言、僵尸 handler、alias 和未消费字段 | EVD-003, EVD-004, EVD-005, EVD-006, EVD-009, EVD-010 | 任一旧断言只能靠保留第二 Owner 才通过即删除该断言而非恢复旧权力 | NOT_RUN |
| ACT-012 | GAP-007 | Website quality:check Owner | CODE | Website unique recovery owner acceptance | /Users/nexgen/Documents/xuanxue-web | scripts/audit/domains/ai-acceptance; scripts/exam/domains/ai-acceptance; tests/ai-production; tests/exam/ai-production-v6-contract.test.ts | AI Acceptance manifest, V6 contract exam, attempt policy fault matrix | MODIFY | ACT-007, ACT-008, ACT-011 | 双仓 provider and dependency contract hash 等值 | 验证每个未完成 job 恰有一个有限 next action、Website 不接收 AGENT retry decision、accepted attempt 与 retry_not_before 唯一、lease/fence 有效、unknown effect 只对账、staged result 只入库；运行同 job 跨仓 Dynamic Proof 到 Website business admission receipt | 不把 READY 冒充 RELEASE，不用日志、fixture-only 或页面可见成功替代 durable receipt | Website changed candidate 与 AGENT quality evidence | Website 唯一 quality verdict 和跨仓 trace artifact | 完成后才允许计算 actual scheme satisfaction | 退休 runtime disposition 旧肯定断言和重复 recovery policy fixture | EVD-001, EVD-002, EVD-008, EVD-009, EVD-010 | 任一硬边界证据非 PASS 即不宣称 READY 或 RELEASE | NOT_RUN |

## 6. 退休与证据

### 6.1 Product 删除库存

ACT-006 必须覆盖下列当前命中自主恢复判定的 18 个文件；执行时若同一受支持 Product catalog 出现新的命中，属于 target 漂移，停止并重新生成工单。

1. `src/plugins/bazi-ai-full-analysis/flow.ts`
2. `src/plugins/bazi-ai-full-analysis/private-base-reservation.ts`
3. `src/plugins/bazi-ai-full-analysis/product-turn.ts`
4. `src/plugins/bazi-chart-interpretation/flow.ts`
5. `src/plugins/bazi-chart-interpretation/private-base-reservation.ts`
6. `src/plugins/bazi-chart-interpretation/product-turn.ts`
7. `src/plugins/bazi-report-followup/parent-continuation.ts`
8. `src/plugins/bazi-report-followup/product-turn.ts`
9. `src/plugins/hehun-ai-analysis/flow.ts`
10. `src/plugins/hehun-report-followup/flow.ts`
11. `src/plugins/localization-production/flow.ts`
12. `src/plugins/naming-bazi-analysis-and-naming/flow.ts`
13. `src/plugins/naming-from-existing-bazi-report/flow.ts`
14. `src/plugins/payment-screenshot-observation/flow.ts`
15. `src/plugins/public-knowledge-article-pipeline/index.ts`
16. `src/plugins/public-knowledge-article-pipeline/seo-gpt-calls.ts`
17. `src/plugins/qimen-professional-answer/flow.ts`
18. `src/plugins/qimen-report-followup/flow.ts`

这里删除的是“谁决定执行还是恢复”的权力，不是删除 `readCallFacts`、checkpoint、continuation identity 或 Browser same-effect readback。

<!-- work-order:evidence -->
| Evidence ID | Requirement IDs | Type | Proves | Does Not Prove | Executor | Procedure | Expected Result | Artifact | Failure Result | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| EVD-001 | REQ-001, REQ-008 | EXAM | Website 是唯一 attempt、retry_not_before、claim 与 next command Owner | 不证明 AGENT 已删除第二 Owner | Website quality:check executor | 运行 ai-acceptance contract exam 与 attempt policy fault matrix，覆盖 fresh、accepted、backoff、active lease、staged result、revoked、completed | 每个 durable state 恰好一个闭集 next action，无 AGENT retry input | Website 原生 exam 输出和 candidate-bound evidence | 任一状态多动作、无动作或依赖 AGENT 建议即 FAIL | NOT_RUN |
| EVD-002 | REQ-001, REQ-002, REQ-005, REQ-012 | STATIC | 两仓 law、blueprint、manifest 只声明一个 business recovery Owner | 不证明生产运行 | 双仓 quality:check executor | 运行两仓 law registry 与 boundary inspection，并扫描 Runtime、Product、GPT 不得声明 retry、next attempt、recovery branch Owner | owner count 精确为 1，Owner 为 Website.ai-acceptance | 两仓原生静态质检输出 | 第二 Owner、第二真相或 authority hash 不一致即 FAIL | NOT_RUN |
| EVD-003 | REQ-002, REQ-003, REQ-005, REQ-006, REQ-007, REQ-012 | FAULT | Runtime 只按 Website command 单次 run、report、reconcile 或 wait | 不证明 Product catalog 全覆盖 | AGENT quality:check executor | 对缺 command、未知 command、旧 fence、local failed、checkpoint present、attempt count high、日志含 retry marker 注入故障 | 无 command 时零 Product call；有效 command 恰好一种动作；所有失败只上报 typed fact | AGENT Runtime fault evidence | 任一本地事实改变业务动作即 FAIL | NOT_RUN |
| EVD-004 | REQ-003, REQ-005, REQ-006, REQ-007, REQ-012 | EXAM | 全 Product catalog 不再自主 retry 或选择 recovery branch | 不证明 Browser 物理对账正确 | AGENT quality:check executor | 对 18 文件及 Product registry 跑 contract tests，fresh 与 reconcile 均由注入的权威 command 触发；扫描 semantic-retry 与本地 recoverOnly 决策 | 无自主重跑、重 submit、换路径或下一 step；固定 Flow 仍工作 | AGENT Product 原生 acceptance 输出 | 任一 Product 在无 command 时发起恢复动作即 FAIL | NOT_RUN |
| EVD-005 | REQ-003, REQ-006, REQ-007, REQ-011, REQ-012 | FAULT | GPT 只返回 facts，CONFIRMED、DISPATCHED 与 READBACK_FAILED 不产生业务 retry decision | 不证明 Website 已签发正确新 attempt | AGENT GPT quality executor | 运行 confirmed submit、post-submit readback、browser failure、continuation 与 task exact-effect fault suites | GPT 输出保持原子事实；无 next action、retry delay、new attempt 或 Product step | GPT 原生 fault artifacts | GPT 输出或 handler 决定业务下一步即 FAIL | NOT_RUN |
| EVD-006 | REQ-004, REQ-010, REQ-011, REQ-012 | FAULT | Browser WAL 与 Outbox delivery 在网络和进程故障下保持同 effect、同 intent 幂等 | 不证明 Website 业务选择正确 | AGENT Browser and Runtime quality executor | 注入 DISPATCH 后崩溃、CONFIRMED 后读回失败、Outbox timeout、receipt 丢失后读回 | Provider mutation 不重复；Outbox payload identity 不变；只读对账闭合原 effect | Browser WAL and Outbox fault artifacts | 第二 Provider effect 或第二 payload identity 即 FAIL | NOT_RUN |
| EVD-007 | REQ-004, REQ-009 | STATIC | lease、fence、retry_not_before、attempt authority 与历史 migration 未被删除或弱化 | 不证明生产 DB 已迁移或服务已发布 | 双仓 quality:check executor | 对 diff 做 symbol、schema 与 immutable migration 检查，运行 stale lease and fence exams | 旧 fence 被拒绝，现役字段和 migration 字节保持 | 两仓 static and exam outputs | 字段、约束或 migration 被改弱即 FAIL | NOT_RUN |
| EVD-008 | REQ-005, REQ-007, REQ-008, REQ-010, REQ-012 | INTEGRATION | Website command 到 Runtime、Product report、Outbox、Website admission 是唯一闭环 | 不证明真实 Provider side effect | 双仓 integration executor | 用同一 job 覆盖 fresh run、accepted reconcile、staged consume、backoff wait、revoked stop，核对 command authority_ref、attempt、lease、receipt | 每个场景只有 Website 决策；AGENT 只执行或报告；completed 只由 admission receipt 成立 | 双仓 candidate-bound integration artifact | 任一层自造下一动作或 completed 无 receipt 即 FAIL | NOT_RUN |
| EVD-009 | REQ-001, REQ-002, REQ-012, REQ-013 | STATIC | 准入门拒绝未来 AGENT business recovery handler 和僵尸旧路径 | 不证明动态副作用 | 双仓 audit executor | AST 检查调用关系与导出，禁止 AGENT 创建 attempt、写 retry_not_before、计算 retry delay、选择 Product recovery branch；检查旧 symbol 无生产 consumer | business_recovery_owner_count 等于 1，旧 handler、alias、字段无残留 | 原生 audit output | 正则误判、未解析调用或残留 consumer 即 FAIL | NOT_RUN |
| EVD-010 | REQ-011, REQ-012 | DYNAMIC | 真实链路在 effect unknown 时先 Browser 对账，在明确未发生后才接受 Website 新 attempt | 不证明 RELEASE 已执行 | 授权生产证据执行者 | 以单一真实 job 触发 Provider submit 后读回故障，记录 Website command、Browser WAL、safe readback、Outbox receipt 和 Website business admission | 旧 effect 不重放；已发生则只读读回并交付，未发生才由 Website 签发新 attempt | 两仓 active law 指定的 Dynamic Proof 路径 | 缺真实 Provider、WAL、receipt 或 durable admission 任一证据即 FAIL | NOT_RUN |
| EVD-011 | REQ-014, REQ-015 | MANUAL_PROOF | 本轮只有唯一 Markdown 工单写入且日志施工未被修改 | 不证明后续施工完成 | 工单设计者 | 检查本轮 diff 和 validator 输出 | 仅出现本工单；所有 action 和 evidence 仍为 NOT_RUN | 当前 git diff 与 validator JSON | 出现代码、法案、测试、数据库或日志文件写入即 FAIL | NOT_RUN |
| EVD-012 | REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-022, REQ-023 | STATIC | 通用 Tombstone 原则与具体 recovery authority Tombstone 均属于唯一 active law corpus，Owner、解禁门和保留范围明确 | 不证明同义代码已被机械拦截 | AGENT quality:check executor | 解析 canonical base and functional law records、architecture-boundary manifest 和 generated registry，核对 law denominator、display identity、forbidden clauses、unban order 与唯一 Owner | `TOMBSTONE-RECOVERY-AUTHORITY-001` 由一个 canonical active law承载，registry 只有一个生成投影，解禁必须先法案后代码 | AGENT native governance evidence | 缺 clause、双重 canonical truth、第二 registry 或 code-first 解禁即 FAIL | NOT_RUN |
| EVD-013 | REQ-016, REQ-017, REQ-020, REQ-021 | EXAM | 删除、复制、改名和包装后的恢复主权都被禁止复活，同时 Browser、Website policy、Outbox、lease/fence 不被误杀 | 不证明真实生产链已运行 | AGENT architecture-boundary executor | 对现役 acceptance 注入 recovery manager、retry planner、workflow wrapper、renamed class、copied function、bridge、second state machine 以及四类合法保留对象 | 所有同义 business recovery Owner mutation 均 FAIL；所有合法保留对象 PASS | architecture-boundary golden exam output | 任一禁例通过或合法保留对象失败即 FAIL | NOT_RUN |
| EVD-014 | REQ-017, REQ-019, REQ-020, REQ-021, REQ-022 | FAULT | 未来任务常见理由和改名手法不能绕过 Tombstone，且无精确用户解禁时代码恢复失败关闭 | 不证明用户已经授权解禁 | governance mutation test executor | 构造仅含修复测试、兼容、回归、旧逻辑、历史参考等理由的 change，以及不同 symbol 和文件名的同义决策实现；不改 law 时运行唯一 quality:check | 所有 change 被同一 Tombstone finding 阻断；只有先有精确授权并修改 active law 后才可进入代码施工 | governance mutation artifacts | 任一普通理由被当成恢复授权即 FAIL | NOT_RUN |
| EVD-015 | REQ-018, REQ-020, REQ-021, REQ-023 | STATIC | 没有新增第二 registry、checker、verdict、domain、schema 或 persistence；现有 generator 和 quality:check 完整消费 Tombstone | 不证明业务恢复代码已删除 | AGENT governance executor | 检查 generated fileset、capabilityDomain manifests、law registry source、quality result denominator、文件新增和 import graph | generated fileset 仍只有 `law-registry.generated.json`；Tombstone 属于 architecture-boundary；唯一 quality verdict 含对应 law result | governance authority and quality-contract output | 出现第二账本、第二入口、孤儿 law 或缺失 assertion 即 FAIL | NOT_RUN |

## 7. 完成公式、阻断与执行前复核

<!-- work-order:blockers -->
| Blocker ID | Requirement IDs | Description | Resolution Required |
|---|---|---|---|
| BLK-001 | REQ-001, REQ-005, REQ-016, REQ-020, REQ-022 | `FROZEN-WEBSITE-RESULT-DEMAND-001` 当前禁止普通需求改变 Runtime task-local 恢复义务和 Product 后续 Flow Owner；根治理同时要求 active law amendment 获得授权人明确批准。当前尚缺精确的解冻、Tombstone 法案修改和双仓同步替换授权。日志施工与此 blocker 无关。 | 授权人发送：`解冻 FROZEN-WEBSITE-RESULT-DEMAND-001；批准修改 AGENT 基础法案并建立 TOMBSTONE-RECOVERY-AUTHORITY-001；授权 AGENT 与 xuanxue-web 双仓同步替换。` 随后重新只读绑定两仓 candidate 并生成 WORK_ORDER_READY 工单。 |

```text
方案落地
= admission 时 WORK_ORDER_READY 且 baseline 未漂移
AND 全部 action 与 retirement PASS
AND 硬边界 evidence PASS = 100%
AND actual scheme satisfaction >= 98%
AND anti-overdesign violation = 0
AND 无未处置 requirement
```

生成时结论上限：`NOT_IMPLEMENTED / NOT_TESTED / NOT_DEPLOYED / NOT_RELEASED`。

## Appendix A. 内嵌 SOURCE_SCHEME

以下两个标记之间是本工单绑定的完整规范性 source scheme。frontmatter 的 `source_scheme_sha256` 只计算开始标记之后、结束标记之前的 UTF-8 字节，不计算标记本身。

<!-- SOURCE_SCHEME_BEGIN -->
S-01
Business Recovery Decision Owner Count 从事实上多个层参与恢复判断压到 1，唯一 Owner 是 Website.ai-acceptance。

S-02
第一刀不是删日志、WAL、lease 或 Outbox，而是删除 AGENT Runtime、Product、GPT 对失败之后下一步怎么办的自主决策权。

S-03
生产链固定为：Website DECIDE ATTEMPT OR RETRY；AGENT Runtime RUN OR REPORT；Product RUN OR REPORT；GPT RUN OR REPORT；Browser EXECUTE OR RECONCILE SAME EFFECT；Outbox DELIVER ONLY。

S-04
Runtime business_retry_policy、Product business_retry_policy、GPT business_retry_policy 全部等于 0。它们可以知道并上报 SUCCEEDED、FAILED、EFFECT_DISPATCHED、EFFECT_CONFIRMED、READBACK_FAILED，但不能决定是否重新执行、何时重新执行、是否创建下一 attempt、是否换恢复路径、是否重新 submit、从哪个业务步骤重新开始；这些业务恢复问题全部交回 Website。

S-05
Browser WAL 和 effect identity 必须保留；Website retry_not_before 与 attempt authority 必须保留；lease 与 fence 必须保留；Outbox 必须保留但降为纯 DELIVER ONLY。

S-06
失败后必须先按 exact effect 向 Browser 查询副作用是否发生。明确未发生时，Website 才可以决定下一 attempt；已经发生或可能发生时，只允许只读对账，禁止盲重放。Browser 只保留同一物理 effect 的防重与对账。

S-07
当前 Website、Runtime、Product、GPT、Browser 各自存在恢复验收面，造成组合爆炸。删除 Runtime、Product、GPT 的恢复决策后，QA 必须收缩并证明每层没有越过唯一 Owner。

S-08
统一使用 business_recovery_owner_count 作为架构指标：current 大于 1，target 等于 1，owner 为 Website.ai-acceptance。以后新增 recovery handler 必须先判断它是执行或对账，还是决定下一步；后者拒绝进入 AGENT。

S-09
启动施工工单设计 SKILL，制定唯一工单，后续按照工单实现；本轮只派生工单，不执行施工。

S-10
当前系统变动是日志系统，与本工单无关；不要花精力调查或吸收日志变动，聚焦这次转型的删除工单。

S-11
删除不等于永久禁止恢复。被项目正式判死刑的设计不能只从 active law、manifest、registry 和代码中消失后留给 Git 历史；必须建立 Retirement Tombstone 或禁止复活法条，使 `DELETED` 不等于 `FORGOTTEN`，并使 `TOMBSTONED` 等于 `MUST REMAIN ABSENT`。

S-12
恢复必须按被否决的设计思想和决策权定义，而不是只按旧文件名定义。禁止 git restore、重新编写、复制旧代码、改文件名、改 class 或 function 名、增加 compatibility、fallback、bridge、shadow path、legacy path、第二 Owner、第二 state machine、从旧 commit cherry-pick 或按历史文档照抄等任何同义复活方式。

S-13
不得建立 `forbidden-recovery-registry.json`、blacklist registry、deletion registry、history registry 或第二审计流程。Tombstone 必须进入唯一 active law corpus，经现有 generator 进入唯一 `scripts/audit/generated/law-registry.generated.json`，并由现有唯一 quality:check 验收。

S-14
修复测试、恢复兼容性、让系统工作、解决回归、按旧逻辑实现或参考历史版本都不等于恢复授权。合法解禁必须由用户明确授权恢复精确 `TOMBSTONE-XXX` 及范围；顺序必须是用户明确授权、先修改或解冻对应法条、撤销或缩小 Tombstone、最后才允许恢复代码。禁止先恢复代码再补法案。

S-15
第一条必须是 `TOMBSTONE-RECOVERY-AUTHORITY-001`，并且在第一刀删除开始前生效。它永久禁止 AGENT Runtime、Product Plugin、GPT Capability 拥有 Business Recovery Decision Authority，包括业务 retry、new attempt、是否重新执行业务、何时执行、换恢复路径、重新 submit 和从哪个业务步骤开始。禁止通过 recovery manager、retry planner、workflow engine、fallback、compatibility、legacy path、第二 state machine 或任何同义实现重新取得该权力。唯一业务恢复 Owner 是 Website.ai-acceptance。

S-16
该 Tombstone 不禁止 Browser same-effect WAL 与 reconciliation、Website retry authority、Outbox delivery、lease 或 fence。它保护的不是某个文件不得回来，而是被否决的设计思想不得以任何名字回来；应复用 AGENT 现役 `LAW-APP-SHELL-UI-003-V3` 的局部物理不存在先例，并提升为可由现有法案系统长期执行的项目规则。
<!-- SOURCE_SCHEME_END -->
