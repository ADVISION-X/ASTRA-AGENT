---
artifact_type: project_implementation_work_order
status: WORK_ORDER_BLOCKED
source_scheme: /Users/nexgen/Documents/AGENT/docs/项目方案/Browser DOM 生产级方案.md
source_scheme_sha256: c0f798391d4115d1a93c1909f7ceb18daa06b814cda4ef139a290e4418e6f903
generated_at: 2026-09-02T04:52:04+04:00
source_requirement_capture_coverage: 100%
hard_boundary_plan_coverage: BLOCKED
hard_boundary_evidence_pass: NOT_RUN
actual_scheme_satisfaction: NOT_RUN
anti_overdesign_violation: 0
---

# Browser DOM 生产级建设实施工单

## 0. 最终审计裁决

当前已绑定的施工主体只是 `local-browser-session` Owner 内部的 Browser DOM 物理底座。现役 GPT、Product、Runtime Log Spine、Forensics、continuation、Website 和 authenticated media 业务合同都是不得被 Browser 改写的边界。源方案确实要求的 GPT Child 交接、Browser Owner 内 media 物理判定复用、跨层 cause 传播和全链验收已作为后续条件动作保留；它们只能在对应权威授权、精确候选重新绑定和新工单生成后执行，不是当前 Browser 候选的默认写入面。

源方案中与现役词汇冲突的 `OUTCOME_UNKNOWN`、新 DOM 错误码和公开策略枚举不能直接实施；其真实目标必须保留，分别映射为现役 `DISPATCHED`、现役 typed cause 和 Browser 私有机械事实。20 个页面 Child、Runtime/Website 因果传播、50 单和 12 产品不是 Browser 内部施工，但仍是源方案的消费者交接、跨 Owner 解除条件和最终验收分母，不得删除。DOM 与 authenticated media 只复用 Browser Owner 内同一物理节点状态，不合并媒体业务。未决 mutation 保持现役 `DISPATCHED` 并只读对账；Browser DOM 不产生 UNKNOWN。

本工单当前的真正阻断有五类：Browser wire 保密法案与现役 GPT 消费合同直接冲突；20 个 GPT 页面 Child 私有合同修改还没有单独授权和候选绑定；active upload menu root 尚未冻结；fork 是一次 mutation 还是两步可恢复协议尚未裁决；Browser 原因传到 Runtime/Website 所需的跨 Owner 改动还没有单独绑定。它们使工单保持 `WORK_ORDER_BLOCKED`，但不允许把对应源要求从分母中删掉。旧版的“守卫必须早于 Provider 所有 listener”动作时序假阻断不是源方案要求，本轮已删除；真实要求是每次逻辑派发前的 Target、Document、候选、几何和 hit-test 守卫。

## 1. Executor Contract 与输入绑定

0. 当前状态为 `WORK_ORDER_BLOCKED`；本工单阻断表中任一阻断未解除前，下列任何 action 均不得开始，也不得挑选“看起来不受影响”的局部项先施工。阻断解除后必须重新生成工单，不得直接执行本版。
1. 开工前核验方案 hash、repo baseline 和本节绑定的当前文件 hash；任一不一致即 `WORK_ORDER_STALE`，不得施工。
2. 当前工作区已有大量用户改动，且本工单目标文件中已有改动。执行者必须先把本工单绑定的精确文件内容纳入隔离候选，不得覆盖、恢复、移动或丢弃用户改动。
3. baseline 一致后按文档顺序和 `Depends On` 执行。
4. 不重新设计 GPT、Product、Runtime、Website 或现役法案；不跳项，不把内部施工顺序理解为阶段性交付。
5. 不新增工单外 Owner、入口、状态、错误码、数据库、队列、registry、日志链、selector 库、fallback、兼容层或第二 DOM Reader。
6. 新事实导致 Owner、target、合同、数据迁移或依赖失效时，立即停止并重新生成工单。
7. 执行期间出现命中绑定施工面的工单外变更时停止；本工单产生的预期变更不是漂移。
8. 全部 action、retirement 和必需 evidence 完成后，才计算最终满足度。
9. 没有必要性证明的新架构对象立即停止；本工单只批准一个 Browser 私有物理状态模块，原因见 `DC-003`。

### Repo baselines

<!-- work-order:baselines -->
| Repo | Branch | Commit |
|---|---|---|
| /Users/nexgen/Documents/AGENT | main | 5204721e8ae41173928885439d6b97eaf165f704 |

### 权威闭包

<!-- work-order:authority -->
| Authority | Path | Role |
|---|---|---|
| AUTH-001 | /Users/nexgen/Documents/AGENT/AGENTS.md | 冻结法案入口、只允许一个 primary Owner 和一个 quality verdict |
| AUTH-002 | /Users/nexgen/Documents/AGENT/.github/instructions/agent-rules/基础法案.md | Owner、边界、证据和禁止第二执行真相的基础约束 |
| AUTH-003 | /Users/nexgen/Documents/AGENT/.github/instructions/agent-rules/功能法案.md#LAW-LOCAL-BROWSER-SESSION-004-V15 | Browser WAL、DOM cause、禁止 UNKNOWN、DISPATCHED 只读对账和日志保密 |
| AUTH-003A | /Users/nexgen/Documents/AGENT/.github/instructions/agent-rules/功能法案.md#LAW-LOCAL-BROWSER-SESSION-001-V4 | 所有 Browser side effect 和 owner-admitted payload 只走一条已鉴权 loopback WebSocket，严禁第二 transport、任何实现字节上限和 payload 截断 |
| AUTH-003B | /Users/nexgen/Documents/AGENT/.github/instructions/agent-rules/功能法案.md#LAW-LOCAL-BROWSER-SESSION-002-V6 | exact Target claim、Document 绑定和命令权限 |
| AUTH-003C | /Users/nexgen/Documents/AGENT/.github/instructions/agent-rules/功能法案.md#LAW-LOCAL-BROWSER-SESSION-003-V19 | 固定 Origin、单生产 Tab、park 和恢复边界 |
| AUTH-003D | /Users/nexgen/Documents/AGENT/.github/instructions/agent-rules/功能法案.md#LAW-LOCAL-BROWSER-SESSION-005-V6 | file grant、批准文件和专用 file-input mutation |
| AUTH-003E | /Users/nexgen/Documents/AGENT/.github/instructions/agent-rules/功能法案.md#LAW-LOCAL-BROWSER-SESSION-006-V11 | 凭证、DOM/HTML、Prompt、用户输入、资源 URL 和可变路径禁入 Browser wire；只有法定 authenticated media bytes 例外 |
| AUTH-004 | /Users/nexgen/Documents/AGENT/.github/instructions/agent-rules/功能法案.md#LAW-GPT-001-V17 | 20 个页面 Child、6 个 continuation Child、GPT 页面语义和 selector Owner |
| AUTH-005 | /Users/nexgen/Documents/AGENT/.github/instructions/agent-rules/功能法案.md#LAW-RUNTIME-LOG-SPINE | 唯一日志 Owner、现役 cause 机制和敏感内容禁入 |
| AUTH-005A | /Users/nexgen/Documents/AGENT/.github/instructions/agent-rules/功能法案.md#LAW-RUNTIME-LOG-SPINE-001 | 唯一 event、span、terminal 语法和 Owner identity |
| AUTH-005B | /Users/nexgen/Documents/AGENT/.github/instructions/agent-rules/功能法案.md#LAW-RUNTIME-LOG-SPINE-002 | 写前脱敏、敏感 Browser 数据禁入和 opaque ref |
| AUTH-005C | /Users/nexgen/Documents/AGENT/.github/instructions/agent-rules/功能法案.md#LAW-RUNTIME-LOG-SPINE-003 | typed failure、原生 cause、causedBy 和禁止外层覆盖 |
| AUTH-006 | /Users/nexgen/Documents/AGENT/docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md | Browser Target、Document、DOM typed cause、WAL 和 FIFO 施工图 |
| AUTH-007 | /Users/nexgen/Documents/AGENT/docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md | GPT 冻结消费者合同、附件 no-layout fresh retry 和页面语义边界 |
| AUTH-008 | /Users/nexgen/Documents/AGENT/docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md | Product、Runtime、Website、调度与业务完成边界 |
| AUTH-009 | 当前任务用户纠正 2026-09-02 | 只建设 Browser DOM 内部；方案不得冲突已完善的非 Browser DOM 法案；明确禁止 UNKNOWN |

检查范围：源方案全文；现役法案和三份相关 Blueprint；`src/lib/browser/**` 的 DOM intent、extension runtime、Target/Document、WAL 和 Browser API；Browser 自有 acceptance；GPT 仅作只读消费者清点。

当前 Browser 内部候选排除：`src/capabilities/gpt/**`、`src/plugins/**`、`src/lib/local-runtime/**`、`src/lib/runtime-logs/**`、Forensics、continuation store、Website 仓库、active law、Blueprint、非 Browser 数据库 schema、调度策略、产品顺序、业务重试和 Website 入库逻辑。ACT-013/016/019 所列的非 Browser 文件及 ACT-012 的 authenticated media 物理判定只能在对应阻断解除、精确路径/hash/用户改动重新绑定并生成新工单后纳入；其他排除面始终禁止。Browser Owner 现役 `browser_mutations` 只允许 ACT-006A 指定的同表保数据前向字段。

### 当前候选内容绑定

| Target | SHA-256 | Admission rule |
|---|---|---|
| docs/项目方案/Browser DOM 生产级方案.md | c0f798391d4115d1a93c1909f7ceb18daa06b814cda4ef139a290e4418e6f903 | 必须相同 |
| src/lib/browser/exact-target/browser-dom-intent.ts | 67c1e176098afd2d3daf2f47ffecabdf46e3784d8d34ed57184cfa4c1c8550ea | 必须相同 |
| src/lib/browser/exact-target/browser-target-lease.ts | b4d7f894d1aa4ec1d495d07fb24e744939dbed18aa83642fe323d8e4ca026ce3 | 必须相同 |
| src/lib/browser/exact-target/browser-target-lease-manager.ts | d95d072427dfde896feb385757464ffdcd5837cf56a7a93670f984a054498b43 | 必须相同，并保留当前用户改动 |
| src/lib/browser/browser-authority-api.ts | 6b9a901f83445ccbab30db758f29b177f2256daabaf0ecaa5150a3a3f2eb5846 | 必须相同 |
| src/lib/browser/chrome-extension/dom-query-runtime.ts | 12d0bd2e4b1d8a14ea5f421b7657cfa37ad3754250677ba6235eebc8af9baa14 | 必须相同，并保留已有 no-layout 改动 |
| src/lib/browser/chrome-extension/dom-intent-runtime.ts | 9cef4da2c0d79008f8f4f417e6378600f2228250f3662993764af8901ee36d3f | 必须相同 |
| src/lib/browser/chrome-extension/extension-target-authority.ts | d24360d6e25c731d09dae979af35615614f10f42cf2f9d357a1b49e61896ba4a | 必须相同，并保留已有 fresh Document 改动 |
| src/lib/browser/exact-target/browser-command-actor.ts | 9f72790263c8310e425d7845c2a53d8d39501ded34884a1e1ca83814482a7fb8 | 必须相同，并保留已有 browserOutcome 读取面 |
| src/lib/browser/exact-target/browser-mutation-store.ts | 6e555eea8ea5f8c59ce6bce5413bf8eb7065dac5f17620492584b7e863ede8d4 | 必须相同；现役 REJECTED reason 存在精确 cause 丢失 |
| src/lib/browser/exact-target/browser-mutation-row.ts | 7402a2870f7710223e0d360a66e463523c9f032ac2c1ce653713869e6c40fb4a | 必须相同；跟随同一 WAL 的前向字段和只读投影 |
| src/lib/browser/chrome-extension/manifest.json | ed1888bfba012deeb521a1766bfdcb46bf90176b143d874abffebf72b7df42a4 | 必须相同；现役无 content script 且不得未授权扩展页面权限 |
| src/lib/browser/chrome-extension/build.mjs | 6126af8525bb62431a40bb72b7d6a5ca435116e2e376c58b2495b70224f6dabc | 必须相同；现役只构建 service worker 和 popup |
| scripts/acceptance/local-browser-dom-intent-support.ts | 19f80ff915554e38702474cf862509f5d5c0f8f71e788b468ecf2508dce177e0 | 必须相同，并保留已有 no-layout 与 malformed-box 验收 |
| src/lib/browser/protocol/browser-errors.json | c20cde372652c13446c5ea5b506d8c3dfe8ebb2d0558bb6d1001813a844664c8 | 必须保持错误分母不变 |
| src/lib/browser/protocol/browser-protocol.schema.json | 461bbca399d393894960b5e263f69e5763da8e86361653b7db5e2c1874a7682f | 必须相同；本工单禁止利用 ARTIFACT_CHUNK 传 DOM/HTML/Prompt/用户输入，也不得新增字节上限 |
| src/lib/browser/protocol/generated/browser-protocol.generated.ts | 853a0846fe039414c78d697c45c23fc3701aff35694f176777890f721251facb | 必须由协议源生成，不得手改 |
| src/lib/browser/chrome-extension/websocket-actor.ts | 55d1b9a93250fc9d56fcbe36f3bd22aafca9276c26cafdbacb1acc3ed88588b1 | 必须相同 |
| src/lib/browser/transport/browser-authority-websocket.ts | 542c8d7ff5865a7152a91b6f74df60a9ac3b63793f2ddcfb64d414faca0787aa | 必须相同 |
| scripts/acceptance/local-browser-auto-pairing.acceptance.ts | 7fcfc4a3732bcb68021816a255d699eee80da5cc5f4eb282b485b4ae3fb5207a | 必须相同，并保留当前用户改动 |
| scripts/acceptance/local-browser-rule-mutants.acceptance.ts | d39c9ec3ef52abef1fe844cc44d017abbaa065f6b9285745d8fa66dea17634ef | 必须相同 |
| scripts/acceptance/local-browser-terminal-contract.acceptance.ts | cab5eaac8474af4f633139ddd53fb47a088130d4fdb158ee003c744f7f634126 | 必须相同，并保留当前用户改动 |

## 2. SOURCE_REQUIREMENT 覆盖矩阵

### 逐段覆盖账

<!-- work-order:coverage -->
| Anchor | Classification | Requirement IDs | Reason |
|---|---|---|---|
| 源方案 §一 | MAPPED_TO_REQUIREMENT | REQ-001, REQ-003, REQ-004, REQ-005 | Browser DOM 先成为可靠物理底座的目标保留，但不得拥有调度或业务语义 |
| 源方案 §二 | MAPPED_TO_REQUIREMENT | REQ-001, REQ-012, REQ-013, REQ-020, REQ-024, REQ-025 | 当前已绑定施工主体只是 Browser 内部；其他 Owner 不被 Browser 改写，但源方案中的消费者交接、因果传播和终局证据全部保留，只能经单独授权重新绑定后执行 |
| 源方案 §三 | MAPPED_TO_REQUIREMENT | REQ-011, REQ-016 | 真实 Chrome 观察是输入证据，不冒充 exact-target 或生产交付 |
| 源方案 §四 4.1 至 4.8 | MAPPED_TO_REQUIREMENT | REQ-003, REQ-004, REQ-005, REQ-008, REQ-014, REQ-015 | connected、rendered、actionable、同页重绘、no-layout、语义隐藏和错误分类均转为 Browser 内部 GAP |
| 源方案 §五 5.1 | MAPPED_TO_REQUIREMENT | REQ-001, REQ-011, REQ-012, REQ-020, REQ-022, REQ-023 | 20 个页面 Child 逐个保留所需 DOM 事实、私有合同、迁移、旧路删除和真 GPT 证据；本轮未授权写 GPT，所以以 BLK-002/003/004 保留目标和解除条件 |
| 源方案 §五 5.2 | MAPPED_TO_REQUIREMENT | REQ-001, REQ-012, REQ-020, REQ-026 | 6 个 continuation Child 无 DOM 职责，但作为完整责任链的排除边界保留；它们必须继续归 continuation Owner，不被 Browser 吸收 |
| 源方案 §六 6.1 至 6.4 | MAPPED_TO_REQUIREMENT | REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-010, REQ-013, REQ-018, REQ-019, REQ-021 | 单条命令身份、Document revision、稳定快照、计数/排除/阶段/派发事实、三类机械目标、file input 和 DOM/media 共享物理判定全部保留；只退休冲突的公开枚举与第二身份，payload 交接进入 BLK-001 |
| 源方案 §六 6.5 至 6.8 | MAPPED_TO_REQUIREMENT | REQ-002, REQ-005, REQ-009, REQ-010, REQ-014, REQ-015, REQ-017, REQ-021, REQ-024 | 新词汇映射为现役 typed cause、DISPATCHED、WAL 和 Browser 私有阶段/原生 cause/派发事实；跨 GPT/Runtime/Website 因果传播目标保留在 BLK-005，不改现役日志法案 |
| 源方案 §七 | MAPPED_TO_REQUIREMENT | REQ-001, REQ-012, REQ-020, REQ-022, REQ-023 | GPT 私有页面规则不进入 Browser Owner，但全部作为 ACT-013 的条件交接工作、ACT-019 旧路删除和 EVD-012/014 真 GPT 证据保留 |
| 源方案 §八 | MAPPED_TO_REQUIREMENT | REQ-001, REQ-003, REQ-004, REQ-005, REQ-006, REQ-011, REQ-012, REQ-020, REQ-021, REQ-022, REQ-023, REQ-024, REQ-025 | 四个切片全部保留：menu/fork 先决定，Browser 物理事实后建设，20 Child 按风险顺序迁移并同步删旧路，最后做分层动态证明与退休审计 |
| 源方案 §九 | MAPPED_TO_REQUIREMENT | REQ-001, REQ-012, REQ-013, REQ-020, REQ-021, REQ-024 | 当前已绑定写入面是 Browser 源码和 Browser 自有验收；GPT Child、authenticated media 物理复用和 Runtime/Website causedBy 传播作为明确条件面保留，必须单独授权、重新绑定后才可施工 |
| 源方案 §十 10.1 | MAPPED_TO_REQUIREMENT | REQ-003, REQ-004, REQ-005, REQ-006, REQ-015, REQ-019 | Browser 物理层规则转为确定性 functional 和 fault 证据；payload 证据必须先解除 BLK-001，不得违反 wire 禁止 |
| 源方案 §十 10.2 | MAPPED_TO_REQUIREMENT | REQ-011, REQ-012, REQ-020, REQ-022, REQ-023, REQ-025 | G01-G18 真 ChatGPT 场景完整保留；它们分别证明 Browser 物理层和 GPT Child 语义层，未授权前不修改 GPT，但不允许只做编译兼容就宣称完成 |
| 源方案 §十 10.3 | MAPPED_TO_REQUIREMENT | REQ-012, REQ-016, REQ-024, REQ-025, REQ-026 | 50 单和 12 产品不是 Browser 内部 PASS 分母，但是源方案生产级终局分母；ACT-018/EVD-016 保留全场景、不打断、容量切片、不重放、原因不覆盖和 Website 入库 |
| 源方案 §十一 | MAPPED_TO_REQUIREMENT | REQ-011, REQ-016, REQ-020, REQ-022, REQ-023, REQ-024, REQ-025, REQ-026 | 完成定义十项均保留：20 Child、6 continuation、fork、menu root、错误分型、cause 全链、旧路删除、四层证据、clean quality 和 RELEASE+Website 入库；任一未成立均不得称生产级 |
| 源方案 §十二 | MAPPED_TO_REQUIREMENT | REQ-001, REQ-011, REQ-016, REQ-020, REQ-025, REQ-026 | 完整责任链保留为 Browser 唯一物理底座 → 20 页面 Child 清晰合同 → 6 续接 Child 原 Owner → Product 按可证结果推进 → Website 耐久入库，不建第二调度器 |
| 源方案原子补全 M001-M130 | MAPPED_TO_REQUIREMENT | REQ-020, REQ-021, REQ-022, REQ-023, REQ-024, REQ-025, REQ-026 | 按同一 301 条分母补回首轮独立审计指出的 130 条遗漏；详见 2.1 原子响应账，BLOCKED 项保留原目标和解除条件 |

### 原子要求

<!-- work-order:requirements -->
| Requirement ID | Type | Hard | Hard Boundary Reason | Source Anchor | Requirement | Disposition | Current Status | Current Fact IDs | Gap IDs | Evidence IDs |
|---|---|---|---|---|---|---|---|---|---|---|
| REQ-001 | OWNER | TRUE | REQUIRED_BY: 用户纠正、AUTH-001、AUTH-002、AUTH-003、源方案 §二和§九 | 源方案 §一、§二、§五、§七至§九、§十二 | `local-browser-session` 是 Browser DOM 唯一 Owner；Browser 只拥有物理 Target、Document、节点观察、动作安全和现役 WAL，不拥有 GPT 页面语义、Product Flow、Runtime、Website 或 continuation | BUILD | PARTIAL | FACT-001, FACT-002, FACT-010, FACT-012 | GAP-001 | EVD-001, EVD-010 |
| REQ-002 | MUST_NOT | TRUE | REQUIRED_BY: 用户明确禁止 UNKNOWN、AUTH-003、AUTH-006 | 源方案 §6.2、§6.5、§6.6、§7.4、§10.1 | 不得新增 `OUTCOME_UNKNOWN`、新 dispatchState、新 DOM error code、第二 mutation 状态真相；未决动作保持现役 DISPATCHED 并只读对账 | RETIRE | CONFLICT | FACT-002, FACT-003 | GAP-001 | EVD-001, EVD-004, EVD-005 |
| REQ-003 | MUST | TRUE | REQUIRED_BY: AUTH-003、AUTH-006、源方案 §4.4、§6.1、§6.2 | 源方案 §4.4、§6.1、§6.2、§10.1 | 每条 Browser DOM 命令内部必须绑定现役 Target 和 Document；前后核验主 frame loader、documentRef、scope、全部候选 backend identity、数量、全部返回字段 hash 和所需物理事实；同一节点只改 text、value、aria 或 scope 时也不得拼装混合成功 | BUILD | MISSING | FACT-004, FACT-006 | GAP-002 | EVD-002, EVD-004, EVD-008 |
| REQ-004 | MUST | TRUE | REQUIRED_BY: AUTH-003、AUTH-006、源方案 §4.1 至 §4.3、§6.4 | 源方案 §4.1 至 §4.3、§6.4、§10.1 | Browser 内部必须分别给出真实 connected、rendered、disabled、inert 和 bounds；rendered 只排除无 layout、hidden、祖先或自身 display none、visibility hidden或collapse、有效 opacity zero，不把可见但 inert、aria-hidden 或 viewport 外的节点从机械 observation 删除 | BUILD | PARTIAL | FACT-004, FACT-008 | GAP-003 | EVD-003, EVD-004, EVD-008 |
| REQ-005 | MUST | TRUE | REQUIRED_BY: AUTH-003、AUTH-004、AUTH-006、源方案 §6.4、§6.6 | 源方案 §6.3、§6.4、§6.6、§10.1 | Browser 根据现役 intent kind 内部固定执行动作安全检查；pointer 要求 rendered、enabled、祖先链非 inert、非 aria-hidden、有效 pointer-events、裁剪后 viewport 交集、最终坐标稳定且 hit-test 命中自身或后代；keypress 要求可聚焦；fill 还要求可编辑；不满足时 logical mutation dispatch count 必须为零；从第一个 raw event 起才能发现的 actual-target mismatch 不得伪装为零派发 | BUILD | PARTIAL | FACT-005 | GAP-004 | EVD-003, EVD-005, EVD-008 |
| REQ-006 | CONTRACT | TRUE | REQUIRED_BY: 源方案 §6.2 的封闭返回目标、AUTH-002、生产类型闭包 | 源方案 §6.2、§8.1、§10.1 | Browser 内部为现役每个 BrowserDomIntent 建立封闭的 result map 和双端 runtime validation；普通 observation 不携带 dispatch state、operationStage 或第二 Document identity；不得向 Product Facade 泄漏 Browser 私有对象 | BUILD | MISSING | FACT-007 | GAP-002 | EVD-002, EVD-010 |
| REQ-007 | MUST_NOT | TRUE | REQUIRED_BY: AUTH-004、AUTH-006 的 fresh observation 和 FIFO 边界 | 源方案 §6.3、§7、§10 | 不得新增 Browser 自主重试策略、长轮询状态或第二调度器；现役 caller 提供的有界 wait 只能机械执行且上限保持 5 秒，不决定 GPT retry、Product 顺序或容量释放 | RETIRE | PARTIAL | FACT-005, FACT-012 | GAP-004 | EVD-001, EVD-007, EVD-010 |
| REQ-008 | MUST | TRUE | REQUIRED_BY: AUTH-004、源方案 §4.6、§7.5、§7.6 | 源方案 §4.6、§6.4、§7.5、§7.6、§10.1 | Browser 语义投影必须在同一命令和同一候选身份内排除 hidden、aria-hidden、CSS 隐藏和 inert 子树，保留现役标签语义，不把视觉隐藏内容写入结果 | BUILD | PARTIAL | FACT-004 | GAP-003 | EVD-003, EVD-004 |
| REQ-009 | SECURITY | TRUE | REQUIRED_BY: AUTH-003、AUTH-005、AUTH-006、源方案 §6.8 | 源方案 §4.7、§6.8、§10.3 | Browser 首发事件必须保留 responsibleOwner、operationStage、稳定 code、脱敏 native cause、exact target/document/command hash、派发事实和 causedBy；不新增 logger、跨仓 event id 或动态诊断 bag，不记录 selector、DOM、Provider 正文、URL、Prompt、附件内容或本地路径 | BUILD | PARTIAL | FACT-011 | GAP-009 | EVD-001, EVD-006, EVD-013, EVD-015 |
| REQ-010 | RETIREMENT | TRUE | REQUIRED_BY: AUTH-003、AUTH-006、用户纠正 | 源方案 §6.2 至 §6.8、§8、§9 | 退休与现役法案冲突的公开策略枚举、UNKNOWN 词汇、新错误分母、第二 Owner、fallback 和双轨；保留并建设 Browser 内部等价的 Document revision、operation stage、脱敏 native cause 和 dispatch fact；20 Child、跨层因果与媒体共享物理判定目标不得因本轮未授权而被退休 | RETIRE | CONFLICT | FACT-002, FACT-010, FACT-012 | GAP-001 | EVD-001, EVD-010, EVD-011, EVD-013 |
| REQ-011 | EVIDENCE | TRUE | REQUIRED_BY: 源方案 §三、§八、§十、§十一和生产稳定性目标 | 源方案 §三、§8.3、§10、§11 | 必须完成 Browser 自有静态、类型、功能、fault、压力和真实 Chrome 证据，覆盖同页重绘、导航、no-layout、stale、畸形 payload、隐藏、viewport、遮挡、禁用、回执丢失和长会话资源稳定 | VERIFY | POST_IMPLEMENTATION_EVIDENCE_PENDING | FACT-008, FACT-013 | GAP-006 | EVD-003, EVD-004, EVD-005, EVD-006, EVD-007, EVD-008, EVD-009 |
| REQ-012 | MUST_NOT | TRUE | REQUIRED_BY: 用户纠正、AUTH-004、AUTH-008、源方案 §五和§11 | 源方案 §五、§七、§8.2、§9、§10.2、§10.3、§11 | 20 个页面 Child 不得被 Browser 吸收，但必须作为明确的消费者合同、迁移和真实 GPT 证据目标保留；6 个 continuation Child 继续归现役状态 Owner。fork、附件菜单、rate-limit、50 单、12 产品和 Website 入库不得成为 Browser 内部 PASS，但仍是分层交接与最终完成门 | RETIRE | PARTIAL | FACT-002, FACT-012 | GAP-001 | EVD-001, EVD-010, EVD-011, EVD-012, EVD-016 |
| REQ-013 | MUST | TRUE | REQUIRED_BY: AUTH-003、AUTH-006、源方案 §6.4 | 源方案 §6.4、§9 | DOM query 和 authenticated media 必须在 Browser Owner 内复用同一套 connected、layout、style、inert、disabled、viewport、hit-test 和 Document revision 机械判定；媒体的下载、alt、content hash、bytes receipt 和去重合同仍保持独立，不泛化到普通 DOM | BUILD | PARTIAL | FACT-004, FACT-010 | GAP-009 | EVD-001, EVD-010, EVD-013 |
| REQ-014 | RETIREMENT | TRUE | REQUIRED_BY: AUTH-003 对 BROWSER_TARGET_INVALID 的精确语义 | 源方案 §4.5、§6.5 | 非法 selector payload 必须使用现役 BROWSER_COMMAND_PERMIT_INVALID，不得继续冒充 BROWSER_TARGET_INVALID；不得新增替代 error code | RETIRE | CONFLICT | FACT-009 | GAP-005 | EVD-001, EVD-002, EVD-004 |
| REQ-015 | MUST | TRUE | REQUIRED_BY: AUTH-003、AUTH-004、AUTH-006 | 源方案 §4.5、§6.5、§7.3、§10.1 | no-layout 或 no-box 在 find、scope、text match、read、inspect 和 postcondition 全入口只能成为当轮不可见候选；stale 返回 BROWSER_DOM_NODE_STALE；仅 record、number、coordinate 真畸形返回 BROWSER_DOM_READ_INVALID | BUILD | PARTIAL | FACT-004, FACT-008 | GAP-003 | EVD-003, EVD-004 |
| REQ-016 | DELIVERY | TRUE | REQUIRED_BY: AUTH-001、AUTH-008、源方案 §3.1、§10.3、§11 | 源方案 §3.1、§8.3、§10.3、§11 | Browser 内部证据 PASS 只证明 Browser DOM；READY 不等于 RELEASE，真实 Chrome 不等于 50 单或 Website 入库，全系统业务完成继续由现役链路另行证明 | VERIFY | POST_IMPLEMENTATION_EVIDENCE_PENDING | FACT-013 | GAP-006 | EVD-008, EVD-009 |
| REQ-017 | STATE_DATA | TRUE | REQUIRED_BY: AUTH-003、AUTH-006 的唯一 WAL 和 0 或 1 次逻辑物理 mutation 约束 | 源方案 §6.6、§7.3、§7.4、§10.1 | mutation command 跨 WebSocket 前必须先有 PREPARED，成功发送后立即为 DISPATCHED；扩展动作前机械拒绝以 logicalMutationDispatchCount=0 和现役 cause 收束 REJECTED；第一个 raw input event、Input.insertText 或 DOM.setFileInputFiles 一旦发出即 logicalMutationDispatchCount=1，后续 raw event、回读或 reply 任一点失联均保持 DISPATCHED；只有同步可决定的 fill/file-input 或现役 Owner 的精确只读对账才可提供终态负证，click/hover/doubleClick/keypress 正向未观察到必须保持 DISPATCHED；WAL 必须只在可信 zero/one reply 或合法进度证据到达后持久化 0/1，COMMAND 已发但无 reply 时保持 null + DISPATCHED，并保存 exact cause；0/1/null 只属于 Browser 内部，所有 browser_outcome=REJECTED 的冻结外部投影仍为 mutation_outcome=confirmed，不得修改非 Browser 消费合同 | BUILD | PARTIAL | FACT-003, FACT-005, FACT-017 | GAP-004 | EVD-004, EVD-005, EVD-007, EVD-008 |
| REQ-018 | MUST | TRUE | REQUIRED_BY: AUTH-003、AUTH-004、AUTH-006 和源方案 FILE_INPUT_TARGET 边界 | 源方案 §6.3、§6.4、§7.3、§10.1 | 现役 file-input command 必须在同一 current Document 内原子验证唯一 exact input、type=file、真实 connected 和批准文件集合；零、多、非 file、detached 或 Document 变化均为零 logical mutation dispatch 并使用现役错误语义；setFileInputFiles 成功及精确 FileList 回读只证明选择文件，不证明 Provider ready | BUILD | PARTIAL | FACT-006, FACT-014 | GAP-002 | EVD-003, EVD-004, EVD-005, EVD-008 |
| REQ-019 | MUST_NOT | TRUE | REQUIRED_BY: AUTH-003A 禁止任何实现字节上限和截断；AUTH-003E 禁止 DOM/HTML/Prompt/用户输入进入 Browser wire；用户要求不得冲突其他现役法案 | 源方案 §6.2、§7.5、§10.1 | Browser DOM 建设不得通过 REPLY、ARTIFACT_CHUNK 或任何其他 Browser wire frame 传输 DOM/HTML、semanticText、Prompt 或用户输入；不得增加 4 MiB、32 MiB 或任何实现字节上限，不得截断成功、建第二 transport 或私造 artifact 旁路。但现役 Browser REPLY 和冻结 GPT 消费者正在直接传递 outerHtml、semanticText 和 approvedText，授权范围内无合法 Browser-only 交接设计 | BLOCKED | BLOCKED | FACT-007, FACT-015, FACT-018 | GAP-007 | EVD-001, EVD-010 |
| REQ-020 | CONTRACT | TRUE | REQUIRED_BY: 源方案 §2.1、§5、§7、§8.2、§9、§10.2、§11 | 源方案 M001、M004、M006-M007、M012-M031、M040-M046、M052-M077、M083-M093、M095-M098、M100-M111、M124 | 20 个页面 Child 必须逐个保留私有作用域、前置、派发边界、后置、旧路径删除和真实 GPT 证据；6 个 continuation Child 明确留在状态 Owner。本轮只建设 Browser DOM，所以子合同改动必须经单独授权和精确候选绑定，不得删除目标或暗留双路 | BLOCKED | BLOCKED | FACT-002, FACT-012, FACT-013 | GAP-008 | EVD-011, EVD-012 |
| REQ-021 | CONTRACT | TRUE | REQUIRED_BY: 源方案 §4.7、§6.1、§6.2、§6.4、§6.8、§8.1 | 源方案 M002、M009、M032-M039、M048-M051、M081-M082 | Browser 内部必须补齐 CDP session、Browser build/release、Document revision、scopeEligibleCount、exclusionCounts、operationStage、确定派发事实、脱敏 native cause 和 exact target/document/command hash；DOM 与 authenticated media 复用同一物理节点状态但不合并媒体业务 | BUILD | MISSING | FACT-004, FACT-006, FACT-010, FACT-011, FACT-017 | GAP-009 | EVD-013 |
| REQ-022 | CONTRACT | TRUE | REQUIRED_BY: 源方案 §3.2、§4.8、§6.7、§7.3、§8.0、§10.2、§11 | 源方案 M004、M020、M046-M047、M060、M078、M080、M103、M126 | active upload menu root 必须在当前 Chrome 版本获得稳定、可机器验证且属于 exact composer 的作用域；未冻结前 open_gpt_attachment_control 保持 production blocked，严禁回退到全页文字或 fallback | BLOCKED | BLOCKED | FACT-012, FACT-013 | GAP-010 | EVD-014 |
| REQ-023 | CONTRACT | TRUE | REQUIRED_BY: 源方案 §3.2、§4.8、§7.7、§8.0、§10.2、§11 | 源方案 M005、M010-M011、M031、M074-M080、M092、M096、M111、M125 | fork 必须由现役权威裁决为可证明的一次机器 mutation，或单独授权的两步可恢复协议；每步都有前置、派发事实、后置和安全重新观察。裁决前 fork Child 保持 production blocked，失效选择器退休且不得加 fallback | BLOCKED | BLOCKED | FACT-012, FACT-013, FACT-016 | GAP-011 | EVD-014 |
| REQ-024 | FLOW | TRUE | REQUIRED_BY: 源方案 §4.7、§6.8、§8.4、§9、§10.3、§11 | 源方案 M008、M097、M099、M122、M127 | Browser 首发原因必须在 GPT、Runtime 和 Website 全链保持 responsibleOwner=browser-session 和 causedBy，上层只能增加自己的语义事件，不得覆盖 Browser 原因。跨 Owner 改动只能在另行绑定必要路径和候选后执行 | BLOCKED | BLOCKED | FACT-011, FACT-012, FACT-013 | GAP-012 | EVD-015 |
| REQ-025 | DELIVERY | TRUE | REQUIRED_BY: 源方案 §3.1、§8.3、§10.2、§10.3、§11 | 源方案 M003、M094、M100-M123、M128-M129 | 生产验收必须保留 G01-G18 真实 GPT 矩阵，再以网站真实订单覆盖 12 类产品的 GPT 组合、50 单连续到达、上传中新单不打断、文本/图片/附件/续接交错、park/reacquire/重启、结果未决、各层失败、容量切片释放、不重放、原因不覆盖和 Website 入库；单元、集成、真 Chrome、真订单四层不得互相代替 | VERIFY | POST_IMPLEMENTATION_EVIDENCE_PENDING | FACT-012, FACT-013 | GAP-013 | EVD-012, EVD-016, EVD-017 |
| REQ-026 | FLOW | TRUE | REQUIRED_BY: 源方案 §12、AUTH-001、AUTH-004、AUTH-008 | 源方案 M130 | 最终必须形成单一责任链：Browser 提供可靠的唯一物理底座，20 个页面 Child 通过清晰私有合同消费，6 个续接 Child 留在 continuation Owner，Product 只按可证明的 Child 结果推进，Website 成功入库才是业务完成 | VERIFY | POST_IMPLEMENTATION_EVIDENCE_PENDING | FACT-001, FACT-012, FACT-013 | GAP-013 | EVD-016, EVD-017 |

### 2.1 首轮独立审计遗漏的 130 条原子响应账

本表使用同一审计分母 `301`，不用“不属于 Browser 内部”删除源要求。`BLOCKED` 代表目标、冲突和解除条件已写入工单，不代表已实现。

| Atom | Source | 保留的源要求 | 工单闭环 | 当前裁决 |
|---|---|---|---|---|
| M001 | §2.1 | 覆盖 20 个页面 Child 和 6 个续接 Child 的全部边界 | REQ-020 → GAP-008 → ACT-013/019 → EVD-011/012 | BLOCKED: BLK-002 |
| M002 | §2.1 | 同时响应 Browser 物理模型、错误、日志、真实 GPT 和选择器差距 | REQ-021/025 → GAP-009/013 → ACT-012/017 → EVD-013/012 | MISSING |
| M003 | §3.1 | 补齐网站订单到 exact target、页面 Child、Website 入库的动态证明 | REQ-025 → GAP-013 → ACT-018 → EVD-016/017 | EVIDENCE_PENDING |
| M004 | §3.2 | 上传叶子只能在可机器验证的 active menu root 中命中 | REQ-022 → GAP-010 → ACT-014 → EVD-014 | BLOCKED: BLK-003 |
| M005 | §3.2 | 正式处理失效 fork 选择器、真实两步 UI 与一次 mutation 合同冲突 | REQ-023 → GAP-011 → ACT-015 → EVD-014 | BLOCKED: BLK-004 |
| M006 | §3.2 | 保留精确 rate-limit 弹窗真实结构证据 | REQ-020/025 → GAP-008/013 → ACT-017 → EVD-012 | BLOCKED: BLK-002 |
| M007 | §3.2 | 保留附件 ready、spinner 和集合收敛的真实上传证明 | REQ-020/025 → GAP-008/013 → ACT-017 → EVD-012 | BLOCKED: BLK-002 |
| M008 | §4.7 | Browser 失败的 responsibleOwner 不得被 gpt 覆盖，causedBy 链必须保留 | REQ-024 → GAP-012 → ACT-016 → EVD-015 | BLOCKED: BLK-005 |
| M009 | §4.7 | 精确区分 Document、query、scope、describe、style、box、attribute、dispatch、postcondition 和 Document 切换阶段 | REQ-009/021 → GAP-009 → ACT-012 → EVD-013 | MISSING |
| M010 | §4.8 | 施工前裁决 fork 一次机器派发还是两步可恢复协议 | REQ-023 → GAP-011 → ACT-015 → EVD-014 | BLOCKED: BLK-004 |
| M011 | §4.8 | 裁决完成前 fork Child 必须 production blocked | REQ-023 → GAP-011 → ACT-015 → EVD-014 | BLOCKED: BLK-004 |
| M012 | Child-01 | prepare_clean_gpt_chat 取得新 Document、唯一 composer、空草稿/附件、零 user turn、无 stop，并抵抗 hydration 残影 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M013 | Child-02 | focus_exact_gpt_conversation 取得 exact URL、新 Document 和稳定 route，不只看 URL | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M014 | Child-03 | verify_gpt_conversation_identity 在同一快照取得 canonical URL、marker user turn、prompt hash、相邻 assistant 和 turn id | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M015 | Child-04 | open_gpt_execution_profile 取得唯一 actionable trigger、popup 结构和 expanded | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M016 | Child-05 | open_gpt_model_selector_v2 验证 profile popup、唯一模型入口和 advanced/simple 面板切换 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M017 | Child-06 | select_exact_gpt_model_v2 验证精确 radio、aria-checked、一次点击前后状态和面板回读 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M018 | Child-07 | ensure_exact_gpt_reasoning_tier 取得 slider min/max/now、目标档位并动作后精确回读 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M019 | Child-08 | close_gpt_execution_profile 验证 popup、expanded、关闭后 popup 消失且 Document 不变 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M020 | Child-09 | open_gpt_attachment_control 取得 composer-local plus、expanded、active menu root 和精确上传叶子 | REQ-022 → GAP-010 → ACT-014 → EVD-014 | BLOCKED: BLK-003 |
| M021 | Child-10 | attach_approved_gpt_files_once 取得 exact composer 唯一 file input、file/multiple、批准集合和派发事实 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M022 | Child-11 | reconcile_gpt_attachment_set 取得 composer-local region、Provider 名称、ready、spinner、数量和集合一致 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M023 | Child-12 | write_exact_gpt_prompt 区分写前为空或已是同一 prompt，写后精确回读 marker 和全文 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M024 | Child-13 | reconcile_gpt_draft 取得 composer hash、marker、唯一 enabled send、附件 ready 集合和无 stop | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M025 | Child-14 | submit_exact_gpt_turn_once 验证 turn 不存在、草稿精确、send actionable、仅派发一次和派发事实 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M026 | Child-15 | reconcile_gpt_turn_submission 取得 canonical URL、marker user turn、prompt hash、唯一 turn id 和 composer 清空 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M027 | Child-16 | wait_for_stable_gpt_text 取得 exact user turn、相邻 text assistant、无 stop、连续稳定 hash 和 rate-limit | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M028 | Child-17 | checkpoint_gpt_text_response 从同一 assistant/快照取得 turn id、raw DOM、semantic text、内容 hash 和来源 prompt hash | REQ-019 → GAP-007 → 权威合同决定 → EVD-010/012 | BLOCKED: BLK-001 |
| M029 | Child-18 | wait_for_stable_gpt_image 取得 exact outer assistant、无 stop、唯一语义图片、认证媒体和稳定 hash | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M030 | Child-19 | checkpoint_gpt_generated_image 取得 outer assistant、来源 prompt hash、认证字节、内容 hash 和转换结果 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M031 | Child-20 | fork Child 取得 source URL、exact user/assistant/hash、唯一动作、子会话 URL 和 identity 回读 | REQ-023 → GAP-011 → ACT-015 → EVD-014 | BLOCKED: BLK-004 |
| M032 | §6.1 | 每个 DOM 命令绑定 CDP session identity | REQ-021 → GAP-009 → ACT-012 → EVD-013 | MISSING |
| M033 | §6.1 | 每个 DOM 命令绑定 Browser release/build identity | REQ-021 → GAP-009 → ACT-012 → EVD-013 | MISSING |
| M034 | §6.2 | 快照包含 Browser 内部确定的 Document revision/epoch 事实 | REQ-021 → GAP-009 → ACT-012 → EVD-013 | MISSING |
| M035 | §6.2 | 快照返回 scopeEligibleCount | REQ-021 → GAP-009 → ACT-012 → EVD-013 | MISSING |
| M036 | §6.2 | 快照按 disconnected、no-layout、style-hidden、inert、disabled、offscreen、occluded 返回 exclusionCounts | REQ-021 → GAP-009 → ACT-012 → EVD-013 | MISSING |
| M037 | §6.2 | 观察失败返回明确 operationStage | REQ-021 → GAP-009 → ACT-012 → EVD-013 | MISSING |
| M038 | §6.2 | 动作观察返回确定派发事实，未决使用现役 DISPATCHED 而非新 UNKNOWN | REQ-017/021 → GAP-004/009 → ACT-006A/012 → EVD-005/013 | PARTIAL |
| M039 | §6.4 | DOM 和 authenticated media 复用同一 Browser 机械节点状态，不合并媒体业务 | REQ-013/021 → GAP-009 → ACT-012 → EVD-013 | MISSING |
| M040 | §6.7 | GPT 私有合同约束 exact composer | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M041 | §6.7 | GPT 私有合同约束 active profile popup | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M042 | §6.7 | GPT 私有合同约束 advanced model panel | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M043 | §6.7 | GPT 私有合同约束 exact user turn | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M044 | §6.7 | GPT 私有合同约束与 user turn 相邻的 exact assistant turn | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M045 | §6.7 | GPT 私有合同约束 exact attachment region | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M046 | §6.7 | GPT 私有合同约束 active upload menu root | REQ-022 → GAP-010 → ACT-014 → EVD-014 | BLOCKED: BLK-003 |
| M047 | §6.7 | 实施前冻结可机器验证的 menu root，找不到就失败 | REQ-022 → GAP-010 → ACT-014 → EVD-014 | BLOCKED: BLK-003 |
| M048 | §6.8 | Browser 首发失败保留 operationStage | REQ-009/021 → GAP-009 → ACT-012 → EVD-013 | MISSING |
| M049 | §6.8 | Browser 首发失败保留脱敏 nativeCauseCode | REQ-009/021 → GAP-009 → ACT-012 → EVD-013 | MISSING |
| M050 | §6.8 | Browser 首发失败保留 exact target/document/command hash | REQ-009/021 → GAP-009 → ACT-012 → EVD-013 | MISSING |
| M051 | §6.8 | Browser 首发失败保留动作是否已派发 | REQ-009/021 → GAP-009 → ACT-012 → EVD-013 | MISSING |
| M052 | §7.1 | 新会话等待 Document 稳定，确认无 user turn、草稿和附件 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M053 | §7.1 | 历史会话允许读取 viewport 外 turn | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M054 | §7.1 | marker、prompt body、assistant 在同一会话根和 Document 收敛 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M055 | §7.1 | turn identity 联合 data-testid/data-turn 和内容 hash，不只靠顺序 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M056 | §7.2 | popup 动画期即使有 box 也不得 actionable | REQ-004/020 → GAP-003/008 → ACT-004/013 → EVD-003/012 | BLOCKED: BLK-002 |
| M057 | §7.2 | simple/advanced panel 一活一死，联合回读 inert、opacity、expanded、radio checked | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M058 | §7.2 | 模型选择只由 GPT 私有合同匹配，Browser 不解释模型名 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M059 | §7.2 | slider aria-hidden 由 GPT 合同解释，Browser 只返回属性和物理状态 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M060 | §7.3 | 上传叶子必须在 active composer 的 menu root 内 | REQ-022 → GAP-010 → ACT-014 → EVD-014 | BLOCKED: BLK-003 |
| M061 | §7.3 | attachment item、ready icon、spinner 必须在 exact attachment region | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M062 | §7.3 | 附件集合按 Provider 回显名称和批准集合精确对照 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M063 | §7.4 | composer 为空、精确相等或含其他内容必须分三态 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M064 | §7.4 | send 不存在、aria-disabled 和可操作必须分开 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M065 | §7.4 | submit 后按 exact user turn、prompt hash、composer 清空和 canonical URL 回读 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M066 | §7.5 | exact user turn 与相邻 assistant 必须属于同一 Document 观察 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M067 | §7.5 | stop 不存在仍需连续稳定内容 hash | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M068 | §7.5 | raw DOM 和 semantic text 来自同一 assistant 与 Document | REQ-019 → GAP-007 → 权威合同决定 → EVD-010/012 | BLOCKED: BLK-001 |
| M069 | §7.5 | rate-limit 不用全页宽泛 dialog，必须冻结真实弹窗私有合同 | REQ-020 → GAP-008 → ACT-013/017 → EVD-012 | BLOCKED: BLK-002 |
| M070 | §7.6 | 图片回答使用 outer assistant turn | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M071 | §7.6 | 图片按连接、完成度、尺寸、语义、认证来源过滤后再按 hash 去重 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M072 | §7.6 | 不得把 3 个 raw img 当成 3 张生成图 | REQ-020/025 → GAP-008/013 → ACT-013/017 → EVD-012 | BLOCKED: BLK-002 |
| M073 | §7.6 | 页面节点稳定和认证字节成功两个后置都成立才 checkpoint | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M074 | §7.7 | 立即退休失效 branch 选择器，不加 fallback | REQ-023 → GAP-011 → ACT-015/019 → EVD-014 | BLOCKED: BLK-004 |
| M075 | §7.7 | 合同裁决前 fork Child 必须 production blocked | REQ-023 → GAP-011 → ACT-015 → EVD-014 | BLOCKED: BLK-004 |
| M076 | §7.7 | 若两步，每步都有前置、dispatch boundary、后置和安全重新观察 | REQ-023 → GAP-011 → ACT-015 → EVD-014 | BLOCKED: BLK-004 |
| M077 | §7.7 | 若一次 mutation，找到现役机器入口并用真 Chrome 证明 | REQ-023 → GAP-011 → ACT-015 → EVD-014 | BLOCKED: BLK-004 |
| M078 | §8.0 | 写生产代码前冻结 active upload menu root | REQ-022 → GAP-010 → ACT-014 → EVD-014 | BLOCKED: BLK-003 |
| M079 | §8.0 | 写代码前裁决 fork 一次还是两步 | REQ-023 → GAP-011 → ACT-015 → EVD-014 | BLOCKED: BLK-004 |
| M080 | §8.0 | menu/fork 决定未完成时对应 Child 保持 blocked，禁止 fallback | REQ-022/023 → GAP-010/011 → ACT-014/015 → EVD-014 | BLOCKED: BLK-003/004 |
| M081 | §8.1 | Browser 内部建立可靠 Document revision/epoch 事实 | REQ-021 → GAP-009 → ACT-012 → EVD-013 | MISSING |
| M082 | §8.1 | Browser 产生保留原始责任和原因的因果日志 | REQ-009/021 → GAP-009 → ACT-012 → EVD-013 | MISSING |
| M083 | §8.2-1 | 先迁移 reconcile_gpt_attachment_set 并删除旧宽泛查询 | REQ-020 → GAP-008 → ACT-013/019 → EVD-011/012 | BLOCKED: BLK-002 |
| M084 | §8.2-2 | 再迁移 open_gpt_attachment_control 并删除旧查询 | REQ-020/022 → GAP-008/010 → ACT-013/014/019 → EVD-011/014 | BLOCKED: BLK-002/003 |
| M085 | §8.2-3 | 迁移 write/reconcile draft 并删除旧查询 | REQ-020 → GAP-008 → ACT-013/019 → EVD-011/012 | BLOCKED: BLK-002 |
| M086 | §8.2-4 | 迁移 submit/reconcile submission 并删除旧查询 | REQ-020 → GAP-008 → ACT-013/019 → EVD-011/012 | BLOCKED: BLK-002 |
| M087 | §8.2-5 | 迁移 conversation identity 并删除旧查询 | REQ-020 → GAP-008 → ACT-013/019 → EVD-011/012 | BLOCKED: BLK-002 |
| M088 | §8.2-6 | 迁移 text checkpoint 并删除旧查询 | REQ-020 → GAP-008 → ACT-013/019 → EVD-011/012 | BLOCKED: BLK-001/002 |
| M089 | §8.2-7 | 迁移 image checkpoint 并删除旧查询 | REQ-020 → GAP-008 → ACT-013/019 → EVD-011/012 | BLOCKED: BLK-002 |
| M090 | §8.2-8 | 迁移 profile/model/reasoning 并删除旧查询 | REQ-020 → GAP-008 → ACT-013/019 → EVD-011/012 | BLOCKED: BLK-002 |
| M091 | §8.2-9 | 迁移 prepare clean/focus 并删除旧查询 | REQ-020 → GAP-008 → ACT-013/019 → EVD-011/012 | BLOCKED: BLK-002 |
| M092 | §8.2-10 | 最后按权威决定迁移 fork | REQ-023 → GAP-011 → ACT-015/019 → EVD-014 | BLOCKED: BLK-004 |
| M093 | §8.2 | 每迁移一个 Child 立即物理删除其旧宽泛查询，不保留双路 | REQ-020 → GAP-008 → ACT-019 → EVD-011 | BLOCKED: BLK-002 |
| M094 | §8.3 | Browser 单元/集成后还必须有真 GPT 和真网站订单，低层不代替高层 | REQ-025 → GAP-013 → ACT-017/018 → EVD-012/016/017 | EVIDENCE_PENDING |
| M095 | §8.4 | 删除全页上传文字扫描 | REQ-020 → GAP-008 → ACT-019 → EVD-011 | BLOCKED: BLK-002/003 |
| M096 | §8.4 | 删除失效 branch-conversation-button 合同 | REQ-023 → GAP-011 → ACT-019 → EVD-014 | BLOCKED: BLK-004 |
| M097 | §8.4 | 删除上层覆盖 Browser responsibleOwner 的错误投影 | REQ-024 → GAP-012 → ACT-016 → EVD-015 | BLOCKED: BLK-005 |
| M098 | §9 | 必要时允许修改 20 个 GPT Child 的私有 contract、selector、handler 和测试 | REQ-020 → GAP-008 → ACT-013 → EVD-011/012 | BLOCKED: BLK-002 |
| M099 | §9 | 保留 causedBy 确有必要时，另行绑定 Runtime/Website 错误投影修改 | REQ-024 → GAP-012 → ACT-016 → EVD-015 | BLOCKED: BLK-005 |
| M100 | G04 | simple/advanced model panel 只能一个 active | REQ-020/025 → GAP-008/013 → ACT-013/017 → EVD-012 | BLOCKED: BLK-002 |
| M101 | G05 | 模型已选时不重复点击 | REQ-020/025 → GAP-008/013 → ACT-013/017 → EVD-012 | BLOCKED: BLK-002 |
| M102 | G06 | 推理档位已正确时不重复 mutation | REQ-020/025 → GAP-008/013 → ACT-013/017 → EVD-012 | BLOCKED: BLK-002 |
| M103 | G07 | 只在 active composer menu root 命中上传叶子 | REQ-022/025 → GAP-010/013 → ACT-014/017 → EVD-012/014 | BLOCKED: BLK-003 |
| M104 | G10 | 附件完成必须 Provider 名称集合精确、spinner 为零、ready 全成立 | REQ-020/025 → GAP-008/013 → ACT-013/017 → EVD-012 | BLOCKED: BLK-002 |
| M105 | G11 | 空草稿时 send 不存在是合法页面状态 | REQ-020/025 → GAP-008/013 → ACT-013/017 → EVD-012 | BLOCKED: BLK-002 |
| M106 | G12 | 完整草稿时 send 必须唯一且 enabled | REQ-020/025 → GAP-008/013 → ACT-013/017 → EVD-012 | BLOCKED: BLK-002 |
| M107 | G14 | stop 消失且内容连续稳定后才 checkpoint | REQ-020/025 → GAP-008/013 → ACT-013/017 → EVD-012 | BLOCKED: BLK-002 |
| M108 | G15 | rate-limit 精确识别、只确认一次、返回结构化结果 | REQ-020/025 → GAP-008/013 → ACT-013/017 → EVD-012 | BLOCKED: BLK-002 |
| M109 | G16 | 同一图片回答 3 个 raw img 最终只产生 1 个语义内容 hash | REQ-020/025 → GAP-008/013 → ACT-013/017 → EVD-012 | BLOCKED: BLK-002 |
| M110 | G17 | 缺少内层 assistant root 时仍按 outer assistant 处理 | REQ-020/025 → GAP-008/013 → ACT-013/017 → EVD-012 | BLOCKED: BLK-002 |
| M111 | G18 | fork 按权威合同完成且不盲目重放 | REQ-023/025 → GAP-011/013 → ACT-015/017 → EVD-012/014 | BLOCKED: BLK-004 |
| M112 | §10.3 | 真订单覆盖 12 类产品中所有 GPT 产品组合 | REQ-025 → GAP-013 → ACT-018 → EVD-016 | EVIDENCE_PENDING |
| M113 | §10.3 | 证明 50 单连续到达 | REQ-025 → GAP-013 → ACT-018 → EVD-016 | EVIDENCE_PENDING |
| M114 | §10.3 | 证明上传附件期间新订单不打断当前任务 | REQ-025 → GAP-013 → ACT-018 → EVD-016 | EVIDENCE_PENDING |
| M115 | §10.3 | 证明文本、图片、附件和续接任务交错 | REQ-025 → GAP-013 → ACT-018 → EVD-016 | EVIDENCE_PENDING |
| M116 | §10.3 | 证明页面重绘、Target park/reacquire、Chrome 和 AGENT 重启 | REQ-025 → GAP-013 → ACT-018 → EVD-016 | EVIDENCE_PENDING |
| M117 | §10.3 | submit/upload/fork 结果未决时使用现役 DISPATCHED 并禁止盲目重放 | REQ-025 → GAP-013 → ACT-018 → EVD-016 | EVIDENCE_PENDING |
| M118 | §10.3 | 证明 Browser 失败、GPT 语义失败、Provider 限流和 Website 承接失败 | REQ-025 → GAP-013 → ACT-018 → EVD-016 | EVIDENCE_PENDING |
| M119 | §10.3 | Child 未终态前正常 DOM 过渡不得释放执行权 | REQ-025 → GAP-013 → ACT-018 → EVD-016 | EVIDENCE_PENDING |
| M120 | §10.3 | 真正失败时只释放故障切片需要释放的容量 | REQ-025 → GAP-013 → ACT-018 → EVD-016 | EVIDENCE_PENDING |
| M121 | §10.3 | 任何已派发动作不得盲目重放 | REQ-017/025 → GAP-004/013 → ACT-006A/018 → EVD-005/016 | EVIDENCE_PENDING |
| M122 | §10.3 | Browser、GPT、Product、Website 原因和状态不得相互覆盖 | REQ-024/025 → GAP-012/013 → ACT-016/018 → EVD-015/016 | BLOCKED: BLK-005 |
| M123 | §10.3 | 原订单身份贯穿恢复，Website 成功入库才算业务完成 | REQ-025/026 → GAP-013 → ACT-018 → EVD-016/017 | EVIDENCE_PENDING |
| M124 | §11 | 20 个页面 Child 全部使用唯一 Browser 物理事实，零第二 Reader | REQ-020 → GAP-008 → ACT-013/019 → EVD-011/012 | BLOCKED: BLK-002 |
| M125 | §11 | fork 合同经现役权威裁决并通过真 Chrome | REQ-023 → GAP-011 → ACT-015 → EVD-014 | BLOCKED: BLK-004 |
| M126 | §11 | active menu root 取得稳定机器作用域 | REQ-022 → GAP-010 → ACT-014 → EVD-014 | BLOCKED: BLK-003 |
| M127 | §11 | Browser 首发原因在 GPT、Runtime、Website 全链不丢失 | REQ-024 → GAP-012 → ACT-016 → EVD-015 | BLOCKED: BLK-005 |
| M128 | §11 | 单元、集成、真 Chrome、真网站订单四层证据全部成立 | REQ-025 → GAP-013 → ACT-017/018 → EVD-012/016/017 | EVIDENCE_PENDING |
| M129 | §11 | RELEASE 动态证明完成且 Website 承接并存储真实结果 | REQ-025/026 → GAP-013 → ACT-018 → EVD-016/017 | EVIDENCE_PENDING |
| M130 | §12 | 完整责任链为 Browser 物理底座 → 20 页面 Child → 6 续接 Owner → Product → Website 入库 | REQ-026 → GAP-013 → ACT-018 → EVD-016/017 | EVIDENCE_PENDING |

## 3. 当前事实与状态

<!-- work-order:facts -->
| Fact ID | Baseline | Surface Type | Target | Anchor | Observed Fact | Evidence Ref |
|---|---|---|---|---|---|---|
| FACT-001 | 5204721e8ae41173928885439d6b97eaf165f704 | GOVERNANCE | local-browser-session Owner | AGENTS.md；功能法案 LAW-LOCAL-BROWSER-SESSION | Browser Authority 已是唯一物理 Target、Document 和 mutation Owner；Browser 不拥有 GPT 页面语义、Product Flow、Runtime 或 Website | AUTH-001, AUTH-003, AUTH-006 |
| FACT-002 | 5204721e8ae41173928885439d6b97eaf165f704 | GOVERNANCE | 源方案冲突条款 | 源方案 251、288 至 311、331 至 343、426 至 469、527 至 560 行 | 源方案自造 UNKNOWN 和新错误码，并把施工扩到 GPT、Runtime、Website、authenticated media 和全系统验收；与用户纠正及现役权威冲突 | 三路独立审计；AUTH-003 至 AUTH-009 |
| FACT-003 | 5204721e8ae41173928885439d6b97eaf165f704 | CODE | src/lib/browser/exact-target/browser-command-actor.ts | BrowserCommandActor mutation outcome 和 browserOutcome | 现役 WAL 已保持 DISPATCHED、CONFIRMED、REJECTED；回执缺失不需要也不允许 OUTCOME_UNKNOWN | 文件 SHA-256 9f72790263c8310e425d7845c2a53d8d39501ded34884a1e1ca83814482a7fb8 |
| FACT-004 | 5204721e8ae41173928885439d6b97eaf165f704 | CODE | src/lib/browser/chrome-extension/dom-query-runtime.ts | queryAll、visibleNodes、inspectNode、semanticNode | visible 主要依赖 box model，connected 固定 true，disabled 只读 HTML disabled，CSS 隐藏和 inert 未完整进入语义投影，单命令只局部比较 outerHTML | 文件 SHA-256 12d0bd2e4b1d8a14ea5f421b7657cfa37ad3754250677ba6235eebc8af9baa14 |
| FACT-005 | 5204721e8ae41173928885439d6b97eaf165f704 | CODE | src/lib/browser/chrome-extension/dom-intent-runtime.ts | click、hover、doubleClick、keypress、fill、find wait | pointer mutation 只取 box center，没有 viewport、hit-test、inert 或 aria-disabled 闭包；identityRevalidated 是常量 true；find 可在扩展内轮询到 30 秒 | 文件 SHA-256 9cef4da2c0d79008f8f4f417e6378600f2228250f3662993764af8901ee36d3f |
| FACT-006 | 5204721e8ae41173928885439d6b97eaf165f704 | CODE | src/lib/browser/chrome-extension/extension-target-authority.ts | executeRegisteredCommand、activeLoaderId、ExtensionExactTargetRegistry | 现役 targetRef、documentRef、navigationEpoch 和 activeLoaderId 已存在，但 DOM 命令执行前后没有统一核验当前 main-frame loader 和 registry Document，也不能识别同一 Document 内候选重绘 | 文件 SHA-256 d24360d6e25c731d09dae979af35615614f10f42cf2f9d357a1b49e61896ba4a |
| FACT-007 | 5204721e8ae41173928885439d6b97eaf165f704 | CODE | src/lib/browser/exact-target/browser-target-lease.ts | executeDomIntent | BrowserDomIntent 是封闭 union，但 executeDomIntent 返回 Promise unknown，扩展发送前和 AGENT 接收后没有同一 result map runtime validation | 文件 SHA-256 b4d7f894d1aa4ec1d495d07fb24e744939dbed18aa83642fe323d8e4ca026ce3 |
| FACT-008 | 5204721e8ae41173928885439d6b97eaf165f704 | CODE | dom-query-runtime.ts；local-browser-dom-intent-support.ts | 当前 dirty candidate | 当前用户改动已把两种已识别 no-layout message 过滤为不可见候选，并把 malformed box 保留为 READ_INVALID，但 text match、scope、read、inspect、postcondition 和动作安全尚未形成完整证据 | 文件 SHA-256 12d0bd2e4b1d8a14ea5f421b7657cfa37ad3754250677ba6235eebc8af9baa14；19f80ff915554e38702474cf862509f5d5c0f8f71e788b468ecf2508dce177e0 |
| FACT-009 | 5204721e8ae41173928885439d6b97eaf165f704 | CODE | src/lib/browser/exact-target/browser-dom-intent.ts | assertSelector | 非法 selector payload 当前错误使用 BROWSER_TARGET_INVALID，污染 exact Target 错误语义 | 文件 SHA-256 67c1e176098afd2d3daf2f47ffecabdf46e3784d8d34ed57184cfa4c1c8550ea |
| FACT-010 | 5204721e8ae41173928885439d6b97eaf165f704 | CODE | src/lib/browser/chrome-extension/authenticated-media-runtime.ts | authenticated media fixed chain | authenticated media 已有独立的会话内 bytes、semantic media 和 content identity 合同；与普通 DOM 查询合并会扩大耦合 | 只读源码审计；AUTH-006 |
| FACT-011 | 5204721e8ae41173928885439d6b97eaf165f704 | CODE | Browser runtime logging；Runtime Log Spine | 现役 Browser span 和敏感字段约束 | 已有唯一 Runtime Log Spine、Browser owner 和 causedBy 机制；本轮无需也不得改日志 schema 或 Website event contract | AUTH-003, AUTH-005 |
| FACT-012 | 5204721e8ae41173928885439d6b97eaf165f704 | CODE | GPT capability group 和 Website-Agent V6 | 20 页面 Child、6 continuation Child、12 Product 和调度 | 20 个页面 Child 消费 Browser，6 个 continuation Child 不消费 DOM；Product 决定 Child 顺序和产品恢复，shared Runtime 只守 transport 与副作用安全，Browser 拥有物理 FIFO，Website 拥有业务任务、重试、承接和完成 | AUTH-004, AUTH-006, AUTH-007, AUTH-008 |
| FACT-013 | 5204721e8ae41173928885439d6b97eaf165f704 | MANUAL | /Users/nexgen/Documents/AGENT 当前工作区 | git status 2026-09-02 | active law、Blueprint、Browser、GPT、Runtime 和 Product 均有用户未提交改动，源方案未跟踪；当前只能生成工单，不能宣称固定候选、READY、RELEASE 或生产通过 | git status --short；本工单候选 hash 绑定表 |
| FACT-014 | 5204721e8ae41173928885439d6b97eaf165f704 | CODE | src/lib/browser/chrome-extension/extension-target-authority.ts | executeFileInput | 现役 file input 固定 selector，但未验证 type=file、真实 connected 和 current Document；零或多候选当前误报 BROWSER_TARGET_INVALID，返回的 identityRevalidated 固定为 true | 文件 SHA-256 d24360d6e25c731d09dae979af35615614f10f42cf2f9d357a1b49e61896ba4a |
| FACT-015 | 5204721e8ae41173928885439d6b97eaf165f704 | GOVERNANCE | LAW-LOCAL-BROWSER-SESSION-001-V4、LAW-LOCAL-BROWSER-SESSION-006-V11、Browser protocol | 功能法案 553 至 585、752 至 775 行；REPLY path | LAW-001 禁止任何实现字节上限和截断；LAW-006 禁止 DOM/HTML/Prompt/用户输入进入 Browser wire。当前 DOM result 仍作为 Browser REPLY payload 返回，将它切成 ARTIFACT_CHUNK 不会变成合法 | AUTH-003A, AUTH-003E；protocol schema SHA-256 461bbca399d393894960b5e263f69e5763da8e86361653b7db5e2c1874a7682f |
| FACT-016 | 5204721e8ae41173928885439d6b97eaf165f704 | CODE | BrowserDomIntent click.postClickUrl | browser-dom-intent.ts、dom-intent-runtime.ts、全仓调用清点 | postClickUrl 只在 Browser contract 和实现存在，现役 GPT 与生产源码无调用；保留它会与所有 DOM 命令前后同一 Document guard 冲突 | rg postClickUrl src scripts；只命中 Browser 定义和实现 |
| FACT-017 | 5204721e8ae41173928885439d6b97eaf165f704 | DATA | src/lib/browser/exact-target/browser-mutation-store.ts | transition、markRejected、historical rows | 现役 store 没有持久化 logical mutation dispatch 0/1 事实，`markRejected` 把所有 REJECTED reason 固定写成 BROWSER_POSTCONDITION_FAILED；历史 REJECTED 不能被猜成零或一次派发 | 文件 SHA-256 6e555eea8ea5f8c59ce6bce5413bf8eb7065dac5f17620492584b7e863ede8d4；只读源码审计 |
| FACT-018 | 5204721e8ae41173928885439d6b97eaf165f704 | CODE | src/capabilities/gpt/web/gpt-dom-observation.ts、composer-submission-children.ts | BrowserTargetLease.executeDomIntent | 冻结 GPT 消费者精确读取 Browser 返回的 outerHtml 和 semanticText，并把 Prompt 作为 approvedText 通过 Browser command 发送；依现役路径会命中 LAW-006 的 wire 禁止，本轮又无权修改 GPT 法案或消费者 | rg outerHtml/semanticText/approvedText/executeDomIntent；AUTH-003E、AUTH-004、AUTH-007 |

## 4. GAP 与 DERIVED_CLOSURE

<!-- work-order:gaps -->
| Gap ID | Requirement IDs | Status | Owner | Derived Closure IDs | Action IDs | Blocker |
|---|---|---|---|---|---|---|
| GAP-001 | REQ-001, REQ-002, REQ-010, REQ-012 | CONFLICT | local-browser-session | DC-001 | ACT-002, ACT-003, ACT-010 | NONE |
| GAP-002 | REQ-003, REQ-006, REQ-018 | MISSING | local-browser-session | DC-002 | ACT-003, ACT-007, ACT-008 | NONE |
| GAP-003 | REQ-004, REQ-008, REQ-015 | PARTIAL | local-browser-session | DC-003 | ACT-004, ACT-005, ACT-008 | NONE |
| GAP-004 | REQ-005, REQ-007, REQ-017 | PARTIAL | local-browser-session | DC-004 | ACT-006, ACT-006A, ACT-008 | NONE |
| GAP-005 | REQ-014 | CONFLICT | local-browser-session | DC-005 | ACT-002, ACT-008 | NONE |
| GAP-006 | REQ-011, REQ-016 | POST_IMPLEMENTATION_EVIDENCE_PENDING | local-browser-session | DC-006 | ACT-001, ACT-008, ACT-009, ACT-010, ACT-011 | NONE |
| GAP-007 | REQ-019 | BLOCKED | NONE | DC-007 | NONE | BLK-001 |
| GAP-008 | REQ-020 | BLOCKED | gpt | DC-008 | ACT-013, ACT-019 | BLK-002 |
| GAP-009 | REQ-009, REQ-013, REQ-021 | MISSING | local-browser-session | DC-009 | ACT-012 | NONE |
| GAP-010 | REQ-022 | BLOCKED | gpt | DC-010 | ACT-014 | BLK-003 |
| GAP-011 | REQ-023 | BLOCKED | gpt | DC-011 | ACT-015 | BLK-004 |
| GAP-012 | REQ-024 | BLOCKED | runtime-log-spine | DC-012 | ACT-016 | BLK-005 |
| GAP-013 | REQ-025, REQ-026 | POST_IMPLEMENTATION_EVIDENCE_PENDING | Website/AGENT existing owners | DC-013 | ACT-017, ACT-018 | NONE |

### 派生闭包

<!-- work-order:derived-closures -->
| Closure ID | Requirement IDs | Authority Basis | Current Fact IDs | Reasoning | Required Result | Existing Capability Check | Deletion Test | New Architecture Objects | Necessity Proof |
|---|---|---|---|---|---|---|---|---|---|
| DC-001 | REQ-001, REQ-002, REQ-010, REQ-012 | AUTH-001 至 AUTH-009 | FACT-001, FACT-002, FACT-003, FACT-010, FACT-012, FACT-016 | 源方案的 UNKNOWN 词汇、新错误分母、第二 Owner 和无消费者 postClickUrl 不能实施；但 Document revision、operation stage、20 Child、跨层原因和媒体共享物理判定的真实目标必须转入对应 GAP，不得一并退休 | 只退休冲突词汇、第二真相、fallback 和无消费者表面；保留的真实目标分别由 GAP-008至GAP-013 闭合 | REUSE: 现役 Browser Owner、WAL、typed cause、GPT、Runtime 和 Website 边界已存在 | FAILS_REQUIREMENT: 不退休冲突词汇会创建第二真相；把真实目标同时删除又会造成源方案缺失 | NONE | N/A: 转换到现役合同，不创建兼容层或第二法案 |
| DC-002 | REQ-003, REQ-006, REQ-018 | AUTH-002、AUTH-003、AUTH-004、AUTH-006 | FACT-004, FACT-006, FACT-007, FACT-014 | Document epoch 只能识别导航，不能识别同一 Document 内 React 替换；unknown 返回面和现役 file input 也不能证明字段闭包 | 单条命令前后校验现役 Document 和候选 identity，结果由现役 intent 对应封闭 result map 双端验证；file input 使用同一 Document guard 和真实 input identity | REUSE: 现役 targetRef、documentRef、navigationEpoch、activeLoaderId、BrowserDomIntent union 和 file-input command | FAILS_REQUIREMENT: 只检查 URL、一次 nodeId 或固定 selector 会把同页重绘、detached input 或非 file 节点拼装成成功 | NONE | N/A: 在现有 Browser contract 和 authority 中补强，不新增 registry 或持久身份 |
| DC-003 | REQ-004, REQ-008, REQ-015 | AUTH-003、AUTH-004、AUTH-006 | FACT-004, FACT-008 | query 和 mutation 都需要同一机械物理事实；继续把逻辑塞进两个已达 367 行和 326 行的文件会重复判定并逼近 500 行法案上限 | 一个 Browser 私有模块返回固定物理事实，query 和 mutation 只消费它；不导出给 GPT 或 Product，不进入媒体实现 | INSUFFICIENT: 现有 boxCenter、staticFieldReaders 和 semantic tree 无法同时证明 computed style、inert、viewport、hit-test 和真实 connected | FAILS_REQUIREMENT: 删除该模块会迫使 query 与 mutation复制物理判定或继续依赖 box-only visible | module:src/lib/browser/chrome-extension/dom-node-physical-state.ts | REQUIRED_BY: REQ-004、REQ-005、REQ-008、REQ-015 有两个真实 Browser 消费者，且现有文件行数约束禁止继续堆叠 |
| DC-004 | REQ-005, REQ-007, REQ-017 | AUTH-003、AUTH-004、AUTH-006 | FACT-003, FACT-005, FACT-012, FACT-017 | 只凭 box center 会误点，现役 WAL 又丢失 dispatch count 和 exact REJECTED cause。源方案要求的是每次 logical mutation 派发前在同一 command 内完成 exact Target、Document、唯一候选、物理状态、稳定坐标和 hit-test，不是伪造早于 Provider 所有 listener 的 content-script 前提 | 在 logical mutation 派发前完成实时守卫；守卫失败时为0，首 raw event 已发后为1并按现役 DISPATCHED 只读对账；同一 WAL 前向增加 nullable 0/1 和 exact reason，无可信 reply 保持 null + DISPATCHED，历史不猜测，外部投影不变 | INSUFFICIENT: 现役 box-center 动作和 WAL row 尚未具有完整派发前守卫与0/1/null事实 | FAILS_REQUIREMENT: 没有派发前守卫会将不可操作节点发出；没有 WAL 事实会猜错已派发状态 | NONE | N/A: 复用现役 command、CDP、WAL 和 typed cause，不新建 listener、scheduler或第二 store |
| DC-005 | REQ-014 | AUTH-003、AUTH-006 | FACT-009 | BROWSER_TARGET_INVALID 只能表示 exact Target 失效，不能代表 caller selector 格式错误 | assertSelector 使用现役 BROWSER_COMMAND_PERMIT_INVALID，Target 错误语义不再被污染 | REUSE: BROWSER_COMMAND_PERMIT_INVALID 已是现役 permit 错误码 | FAILS_REQUIREMENT: 保留旧映射会继续让错误恢复和日志责任判错 | NONE | N/A: 单点改用现役错误码，不建新词典 |
| DC-006 | REQ-011, REQ-016 | AUTH-001、AUTH-003、AUTH-006、AUTH-008 | FACT-008, FACT-013 | 静态通过不能证明重绘、误点、回执丢失、长会话或真实 Chrome；Browser PASS 也不能代替业务入库 | Browser 自有全部证据 PASS，原生 quality verdict 和发布证据分别闭合，并明确证据上限 | REUSE: 现役 Browser acceptance、真实 Chrome proof 和唯一 quality verdict | FAILS_REQUIREMENT: 删除 fault、soak 或真实 Chrome 证据会让 box-only 漏洞和同页竞态继续进入生产 | NONE | N/A: 只扩充现役 Browser 证据，不创建第二质量系统或第二报告账本 |
| DC-007 | REQ-019 | AUTH-003A、AUTH-003E、AUTH-004、AUTH-006、AUTH-007、AUTH-009 | FACT-007, FACT-015, FACT-018 | 现役 Browser law 对 wire 的保密禁止与冻结 GPT 消费者的 raw DOM/semantic/prompt 合同直接不兼容；分块仍是 wire，并且任何 4 MiB/32 MiB 限制本身又违反 LAW-001 | 需要权威方先给出一个同时满足 Browser wire 禁止与真实 GPT 消费者的唯一合法交接合同；在此之前 Browser DOM 方案不得携带这些字段、不得建新 transport 或 artifact 旁路、不得设字节上限 | INSUFFICIENT: 现役 REPLY 违反 wire 禁止；ARTIFACT_CHUNK 不改变内容性质；本轮边界禁止修改 GPT 法案或消费者 | FAILS_REQUIREMENT: 任意移除安全禁止、继续传明文、截断、加上限或建旁路都会冲突现役法案或破坏消费者 | NONE | N/A: 权威/消费合同未决，本工单不得假定新架构对象 |
| DC-008 | REQ-020 | AUTH-004、AUTH-007、源方案§5、§7、§8.2 | FACT-012, FACT-013 | 20 个页面 Child 是 Browser 的真消费者，但它们的私有语义不得塞入 Browser Owner；本轮又未授权对 GPT 生产代码建立候选 | 另行绑定 GPT 候选后，按源方案风险顺序逐 Child 迁移私有作用域和后置，每个迁移同步删除旧宽泛查询 | INSUFFICIENT: 现役 Child 仍存在宽泛作用域和非原子观察，且当前候选未绑定 | FAILS_REQUIREMENT: 不迁移 Child 将使 Browser 新物理事实无法被真业务消费；不删旧路径会形成双 Reader | NONE | N/A: 只修改已有 Child 私有合同与测试，不新建中间层 |
| DC-009 | REQ-009, REQ-013, REQ-021 | AUTH-003、AUTH-005、AUTH-006、源方案§6 | FACT-004, FACT-006, FACT-010, FACT-011, FACT-017 | Browser 已有 Target、Document、WAL 和 Runtime Log Spine，但命令身份、快照计数、阶段、原生 cause 和共享物理判定不完整 | 在 Browser Owner 内补齐私有命令/快照事实和首发原因，DOM 与媒体复用同一物理节点状态，媒体业务合同不变 | REUSE: 现役 Target registry、Document identity、Browser WAL、Runtime Log Spine 和 authenticated media Browser 路径 | FAILS_REQUIREMENT: 不补齐会继续丢失阶段、原生 cause、排除数和同一节点的一致物理判定 | NONE | N/A: 只扩充现役 Browser 私有事实，不新建 Owner、service 或 logger |
| DC-010 | REQ-022 | AUTH-004、AUTH-007、源方案§6.7、§8.0 | FACT-012, FACT-013 | 真实页面没有已冻结的 aria-controls/testid 关系，全局文字唯一不能证明属于 active composer | 在当前 Chrome 版本找到并冻结可机器验证的 composer→menu root→upload leaf 关系；找不到就保持 Child blocked | INSUFFICIENT: 现役全局 span+文字收敛不具有 composer 所属证据 | FAILS_REQUIREMENT: 没有稳定 menu root 会让上传动作跨 composer 命中 | NONE | N/A: 这是 GPT 私有合同决定，不建 Browser 全局文字库 |
| DC-011 | REQ-023 | AUTH-004、AUTH-007、源方案§4.8、§7.7 | FACT-012, FACT-013, FACT-016 | 现役 fork 选择器命中零，真实 UI 为两步，与当前一次 mutation 合同不一致 | 权威只能裁决一次可证机器入口或两步可恢复协议其一；随后删除失效合同并用真 Chrome 证明 | INSUFFICIENT: 现役选择器和一次 mutation 合同无法完成真实 UI | FAILS_REQUIREMENT: 没有裁决就施工会形成 Browser 组合动作、fallback 或盲目重放 | NONE | N/A: 裁决只修正现役 Child 合同，不新建编排 Owner |
| DC-012 | REQ-024 | AUTH-002、AUTH-005、源方案§6.8 | FACT-011, FACT-012, FACT-013 | Browser 内部原因属于 local-browser-session，但跨 GPT、Runtime、Website 的投影需要各自 Owner 的精确候选，本轮未绑定 | 另行绑定最小跨 Owner 候选，只传递现役脱敏 event identity 和 causedBy，删除覆盖 responsibleOwner 的投影 | REUSE: Runtime Log Spine 已有 owner、event、span 和 causedBy 机制 | FAILS_REQUIREMENT: 不传播 causedBy 会让网站只看到上层笼统失败；扩张 schema 又会形成第二日志合同 | NONE | N/A: 复用唯一 Runtime Log Spine，不新建 event bus 或投影层 |
| DC-013 | REQ-025, REQ-026 | AUTH-001、AUTH-004、AUTH-008、源方案§10至§12 | FACT-012, FACT-013 | Browser 证据只能证明物理底座，生产级结论还需真 GPT、真订单、恢复、原因传播和 Website 耐久入库 | 顺序完成 Browser、G01-G18、50单/12产品全链、唯一 quality verdict 和 RELEASE，以 Website 耐久回读为业务完成 | REUSE: 现役 Browser/GPT/Product/Runtime/Website 责任链和项目唯一质量入口 | FAILS_REQUIREMENT: 删除任一证据层会将底层 PASS 冒充业务完成 | NONE | N/A: 只执行现役责任链的验收，不创建第二调度或质量系统 |

### 七类闭包判断

<!-- work-order:closure-checklist -->
| Gap ID | Direct | Dependency | Governance | Data | Consumer | Retirement | Evidence |
|---|---|---|---|---|---|---|---|
| GAP-001 | REQUIRED: 删除新状态、新错误词典和跨 Owner 施工 | REQUIRED: 复用现役 Browser WAL、GPT、Runtime、Website 和媒体合同 | REQUIRED: 用户纠正及 active law 优先于冲突方案条款 | N/A: 不新增或迁移数据 | REQUIRED: GPT 只作冻结消费者回归 | REQUIRED: 禁止公开策略、第二 identity、跨层事件和媒体合并 | REQUIRED: 静态边界和消费者回归 |
| GAP-002 | REQUIRED: 单命令 Document、候选原子性、typed result 和 exact file input | REQUIRED: 复用现役 Target registry、loader 和 file-input command | REQUIRED: 不建立第二 Document Owner 或第二上传路径 | N/A: 临时 fingerprint 不持久化 | REQUIRED: 保持现役 executeDomIntent 和 attachFile 调用兼容 | REQUIRED: unknown 返回、常量 identityRevalidated 和 file input 的 Target 错误误用退出 | REQUIRED: 类型、同页重绘、导航和 file input fault |
| GAP-003 | REQUIRED: 完整物理事实和语义投影 | REQUIRED: query 与 mutation 复用 Browser 私有模块 | REQUIRED: 不导出策略给 GPT | N/A: 无持久状态 | REQUIRED: read 在 viewport 外仍可用，mutation 单独收紧 | REQUIRED: box-only visible、connected true 和 HTML-only disabled 退出 | REQUIRED: functional、fault、真实 Chrome |
| GAP-004 | REQUIRED: 按 intent kind 的派发前守卫和 0 或 1 逻辑 mutation 闭包 | REQUIRED: 复用现役 Target、Document、CDP、WAL 和 ACT-004 物理事实 | REQUIRED: Browser 不拥有 retry、调度或第二状态 | REQUIRED: 同一 WAL 前向增加 nullable logical dispatch count 与 exact reason；初始与无 reply 保持 null，只有可信 reply/进度证据写0/1；历史 REJECTED/DISPATCHED 保持 null；REJECTED 外部投影仍为 confirmed | REQUIRED: GPT 调用形态不变 | REQUIRED: 只凭 box center、常量 logical count 和 30 秒上限退出 | REQUIRED: 功能、fault 和真 Chrome 直接证明不可操作目标在 logical mutation 前被拒绝 |
| GAP-005 | REQUIRED: selector 错误码归正 | N/A: 无外部依赖 | REQUIRED: 保持冻结错误分母 | N/A: 无数据变更 | REQUIRED: 现役调用方收到 permit invalid | REQUIRED: 错用 Target invalid 退出 | REQUIRED: exact unit 和 fault evidence |
| GAP-006 | REQUIRED: Browser 证据闭合 | REQUIRED: GAP-004 实现完成且 GAP-007 合同冲突先解除 | REQUIRED: 只使用唯一 quality verdict | N/A: 证据使用现役 artifact 和 receipt | REQUIRED: 一个现役真实 GPT 消费者只做兼容证明 | REQUIRED: 禁止以 fixture 或页面肉眼替代动态证据 | REQUIRED: static、integration、fault、soak、真实环境和 release 上限 |
| GAP-007 | REQUIRED: BLOCKED: 当前 Browser wire 禁止与消费者合同不兼容 | REQUIRED: BLOCKED: 等待权威方给出唯一合法交接合同 | REQUIRED: 不修改现役法案、不建第二 transport/artifact store/错误词典 | N/A: 未批准新持久化或缓存 | REQUIRED: BLOCKED: 冻结 GPT 消费者当前需要 outerHtml/semanticText/approvedText | REQUIRED: 禁止 ARTIFACT_CHUNK DOM 方案、4 MiB/32 MiB 上限、截断和旁路 | REQUIRED: BLOCKED: 合同未决前不得运行 DOM payload 验收 |
| GAP-008 | REQUIRED: 20 个页面 Child 私有合同逐个迁移 | REQUIRED: BLOCKED: 先单独授权并绑定 GPT 候选 | REQUIRED: Browser 不吸收 GPT 语义，continuation Owner 不变 | N/A: 不改 continuation 持久状态 | REQUIRED: 每个 Child 有精确作用域、派发和后置 | REQUIRED: 每迁移一个就删除旧宽泛查询 | REQUIRED: 私有合同静态审计和 G01-G18 真 GPT |
| GAP-009 | REQUIRED: 命令身份、快照计数、阶段、派发事实、原生 cause 和共享物理状态 | REQUIRED: 复用 Target、Document、WAL、Runtime Log Spine 和 media Browser 路径 | REQUIRED: 不导出第二 Owner、新错误分母或日志系统 | REQUIRED: 只前向增加 Browser 内部必要事实，历史不猜测 | REQUIRED: DOM 和 media 只共享机械节点状态 | REQUIRED: 删除重复物理可见判定，保留媒体业务特有合同 | REQUIRED: functional、fault、log redaction 和真 Chrome |
| GAP-010 | REQUIRED: BLOCKED: 冻结 active composer 所属 menu root | REQUIRED: 当前 Chrome 真实结构实证 | REQUIRED: 只改 GPT 私有合同，不建 Browser 文字规则库 | N/A: 无持久数据 | REQUIRED: open attachment Child 保持 blocked 直到决定完成 | REQUIRED: 删除全页上传文字扫描和 fallback | REQUIRED: 真 Chrome 作用域正反证据 |
| GAP-011 | REQUIRED: BLOCKED: 裁决 fork 一步或两步合同 | REQUIRED: 现役权威决定和真 Chrome 机器入口证明 | REQUIRED: Browser 不编排 GPT 两步语义 | N/A: 不新建 fork 状态库 | REQUIRED: fork Child 在裁决前 production blocked | REQUIRED: 失效 selector 物理删除，零 fallback | REQUIRED: 每步派发/后置/重新观察和不重放真 Chrome |
| GAP-012 | REQUIRED: BLOCKED: Browser 原因跨 GPT/Runtime/Website 不丢失 | REQUIRED: 另行绑定最小跨 Owner 候选 | REQUIRED: 只复用 Runtime Log Spine causedBy，不建第二 event 真相 | N/A: 无新数据库 | REQUIRED: 上层只增自身语义失败，不覆盖 Browser Owner | REQUIRED: 删除 responsibleOwner 覆盖投影 | REQUIRED: 四层 fault 与全链 causedBy 读回 |
| GAP-013 | REQUIRED: G01-G18、50单/12产品、恢复、不打断、不重放、Website 入库 | REQUIRED: GAP-007至12全部闭合后按责任链执行 | REQUIRED: 只使用项目唯一 quality verdict，READY 不等于 RELEASE | REQUIRED: 保留原订单身份并以 Website 耐久回读为准 | REQUIRED: Browser→Child→Product→Runtime→Website 分层交接 | REQUIRED: 不建第二调度、补偿或证据旁路 | REQUIRED: 单元、集成、真 Chrome、真订单、RELEASE 全部成立 |

## 5. 顺序化施工动作

<!-- work-order:actions -->
| Action ID | Gap ID | Owner | Surface Type | Target | Repo | Path | Symbol | Operation | Depends On | Preconditions | Exact Change | Forbidden Change | Inputs | Outputs | Consumer Handoff | Retirement | Evidence IDs | Failure Stop | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ACT-001 | GAP-006 | local-browser-session | MANUAL | bound dirty candidate admission | NONE | NONE | NONE | VERIFY | NONE | HEAD、方案 hash 和候选内容绑定表全部一致；用户改动可在隔离候选中完整保留 | 记录 exact diff、目标文件 hash、owner 和允许修改面；确认除本工单列出的 Browser 文件与 Browser 自有测试外零写入 | 禁止 reset、checkout、restore、覆盖、移动用户改动；禁止把 dirty candidate 称为 clean READY | baseline、git status、候选 hash 表 | 可施工的隔离候选身份 | N/A: admission 只绑定施工输入 | N/A: 不改变生产路径 | EVD-009 | 任一 hash 漂移、无法分离用户改动或目标面出现工单外修改即停止并重新生成工单 | NOT_RUN |
| ACT-002 | GAP-005 | local-browser-session | CODE | Browser DOM intent contract | /Users/nexgen/Documents/AGENT | src/lib/browser/exact-target/browser-dom-intent.ts | BrowserDomIntent、assertBrowserDomIntent、BrowserDomResultMap | MODIFY | ACT-001 | 文件 hash 为 67c1e176098afd2d3daf2f47ffecabdf46e3784d8d34ed57184cfa4c1c8550ea；全仓 postClickUrl 生产消费者为零 | 将非法 selector 映射为 BROWSER_COMMAND_PERMIT_INVALID；为保留的 intent kind 定义封闭结果类型和严格 runtime parser；把 find waitFor 上限从 30 秒收紧到 5 秒；物理删除无消费者 postClickUrl 及其 runtime、actor 和测试分支 | 禁止新增 UNKNOWN、新错误码、公开 policy、documentEpochHash、dispatchState、operationStage、自由 object bag、caller script、selector fallback 或修改 GPT consumer | 现役 BrowserDomIntent union、冻结错误分母、FACT-016 | Browser 私有 typed intent/result 合同 | 现役 GPT 调用语法保持不变，只获得更窄的返回类型 | 退休错用 BROWSER_TARGET_INVALID、30 秒 Browser wait、unknown 结果和无消费者导航点击表面 | EVD-001, EVD-002, EVD-010 | 任一现役 GPT 调用需要源码修改、postClickUrl 存在真实生产消费者、错误分母变化或 Product Facade 泄漏 Browser 类型即停止 | NOT_RUN |
| ACT-003 | GAP-002 | local-browser-session | CODE | Browser lease typed handoff | /Users/nexgen/Documents/AGENT | src/lib/browser/exact-target/browser-target-lease.ts；src/lib/browser/exact-target/browser-target-lease-manager.ts；src/lib/browser/browser-authority-api.ts | executeDomIntent | MODIFY | ACT-002 | ACT-002 parser 已闭合全部现役 intent kind；三个目标文件仍与 ACT-001 候选一致 | executeDomIntent 使用 intent 到 result 的泛型映射；扩展 reply 在 Browser Owner 内接收后必须经同一 parser 验证再返回；browser-authority-api 只导出必要的 intent/result 类型 | 禁止修改 GPT、Product、Runtime、Website；禁止把 Target、Document、WAL row、dispatch state 或诊断 bag塞入 observation result | ACT-002 typed contract、现役 lease manager command path | 双端验证的 Browser DOM result handoff | GPT 继续通过现役 BrowserTargetLease 消费 | 退休 Promise unknown 和调用方对 open result bag 的依赖 | EVD-002, EVD-010 | 任何 result kind 无 parser、接收端可绕过 parser、或要求改动非 Browser 生产源码即停止 | NOT_RUN |
| ACT-004 | GAP-003 | local-browser-session | CODE | Browser private physical node state | /Users/nexgen/Documents/AGENT | src/lib/browser/chrome-extension/dom-node-physical-state.ts | readDomNodePhysicalState、assertStableNodeFingerprint | CREATE | ACT-001 | DC-003 必要性成立；无同名现役模块；固定脚本不接受 caller expression | 用固定且不可由 caller 拼接的 CDP 函数读取 connected、祖先链 hidden、aria-hidden、inert、display、visibility、有效 opacity、pointer-events、disabled、aria-disabled、editable、rect、clip、viewport、DPR、transform、中心 hit-test、backend identity 和 Browser 内部 Document revision，并分别返回 rendered、semantic-hidden 和 pre-dispatch actionable 事实 | 禁止持久化、registry、长时 observer、轮询 worker、selector、Provider text、跨层 document identity、caller-controlled Runtime.evaluate、synthetic element.click 或第二 DOM Reader | exact nodeId、现役 target tab、固定函数 | Browser 私有机械事实和瞬时 fingerprint | 供 ACT-005、ACT-006 和 ACT-012 中的 authenticated media 物理判定复用；媒体业务字段不进入本模块 | ACT-005/012 完成后删除重复 box-only 和媒体可见判定 | EVD-001, EVD-003, EVD-004, EVD-006, EVD-013 | 固定函数需要 caller script、产生敏感输出或形成长期状态即停止 | NOT_RUN |
| ACT-005 | GAP-003 | local-browser-session | CODE | DOM query and semantic projection | /Users/nexgen/Documents/AGENT | src/lib/browser/chrome-extension/dom-query-runtime.ts | queryAll、queryVisibleTextMatches、inspectNode、semantic projection、boxCenter | MODIFY | ACT-002, ACT-004 | 文件 hash 为 12d0bd2e4b1d8a14ea5f421b7657cfa37ad3754250677ba6235eebc8af9baa14；保留当前 no-layout 过滤 | 所有 find、scope、text match、read、inspect 和 postcondition 查询使用同一 rendered 定义；inert 与 aria-hidden 不改变 mechanical rendered，但 semantic projection 排除它们；connected、disabled 和 inert 返回真实事实；viewport 外 rendered 节点仍可读；一次 typed observation 对 exact scope、全候选 backend identity、顺序、数量和全部返回字段生成前后 transient revision digest，任一 text、value、aria、scope、field 或候选变化返回现役 NODE_STALE | 禁止把 no-layout 变成 READ_INVALID，禁止把 inert 混成 not rendered，禁止新增 NOT_RENDERED 或 DOCUMENT_CHANGED，禁止记录 selector 或 DOM，禁止修改 authenticated media，禁止另留 box-only fallback | ACT-004 physical state、ACT-002 result contract、现役 canonical error codes | 原子、全字段可复核、无第二错误词典的 query result | ACT-006 mutation 复用同一物理事实；GPT 调用不变 | 物理删除 connected true、HTML-only disabled、box-only visible、单读字段成功和隐藏内容投影旧判定 | EVD-003, EVD-004, EVD-006, EVD-008 | 任一入口仍走旧 visible 判定、多候选不属同一 revision、同节点内容漂移能成功或 no-layout 映射改变即停止 | NOT_RUN |
| ACT-006 | GAP-004 | local-browser-session | CODE | DOM mutation safety | /Users/nexgen/Documents/AGENT | src/lib/browser/chrome-extension/dom-intent-runtime.ts | executeFindIntent、executeClickIntent、executeHoverIntent、executeDoubleClickIntent、executeKeypressIntent、executeValueIntent | MODIFY | ACT-004, ACT-005 | ACT-004 的物理事实与 ACT-005 的 Document/候选原子性已闭合；现役文件与候选绑定一致 | 将 expectedMatches 固定为1；每次 logical mutation 紧邻派发前重新核验 exact Target、Document、唯一候选、connected、rendered、enabled、inert、aria-hidden、viewport、裁剪、稳定坐标和 hit-test，失败时 count=0 且零 logical mutation；第一 raw event 已发后为 count=1 且未决保持 DISPATCHED；find wait 上限5秒 | 禁止新 content script/listener 前提、公开 ACTIONABLE 策略、自动滚动、坐标猜测、fixed sleep、synthetic click、第二 logical mutation、Browser 自主 retry、调度或容量决策 | ACT-004、ACT-005、现役 CDP command 和 Target/Document registry | 派发前守门且 logical mutation dispatch 为0或1的 typed result | ACT-006A 机械映射到现役 WAL；GPT contract 不变 | 退休只凭 box center 派发、常量 identityRevalidated、常量 mutationCount 和30秒扩展内等待 | EVD-003, EVD-004, EVD-005, EVD-007, EVD-008 | 任一派发前守卫可被绕过、partial raw sequence 被当成0、需要改 GPT contract 或触发重放即停止 | NOT_RUN |
| ACT-006A | GAP-004 | local-browser-session | DATA | Browser mutation WAL and transport boundary | /Users/nexgen/Documents/AGENT | src/lib/browser/exact-target/browser-command-actor.ts；src/lib/browser/exact-target/browser-mutation-store.ts；src/lib/browser/exact-target/browser-mutation-row.ts；src/lib/browser/transport/browser-authority-websocket.ts；src/lib/browser/exact-target/browser-target-lease-manager.ts | ensureCurrentSchema、prepareMutation、markRejected、port.send、postconditionPair、mutationReceipt | MODIFY | ACT-003, ACT-006 | browser-command-actor.ts 和 browser-mutation-store.ts 与绑定 hash 相同；ACT-006 typed logical 0 或 1 result 已闭合 | 在同一 browser_mutations 表做保数据的前向增量迁移，增加 nullable logical_mutation_dispatch_count（仅0/1/null）并让 reason 保留 exact existing cause：PREPARED 和 COMMAND 已发送时初始为null，dispatch前 FAILED 可凭 host 事实写0；只有扩展可信 zero/one reply 或合法进度证据到达后才写0/1，首 raw event 后扩展崩溃且无 reply 必须保持 null + DISPATCHED；历史 REJECTED/DISPATCHED 保持null，历史 CONFIRMED 可机械回填1；0/1/null 只供 Browser 内部审计，不进入冻结跨层 projection；所有 REJECTED 继续按现役合同对外 mutation_outcome=confirmed，DISPATCHED 为dispatched，CONFIRMED 为confirmed | 禁止重建非空表、丢失历史数据、在无可信 reply/进度证据时将 null 猜成0或1、OUTCOME_UNKNOWN、第二 WAL、原因覆盖、刷新 terminalAt 或重放 | ACT-003 result parser、ACT-006 result、现役 BrowserMutationStore、WebSocket dispatch hook和本工单映射表 | 不改变外部消费者合同的0/1/null Browser 内部事实与现役唯一 WAL 闭包 | 现役 Product 和 Runtime 只消费既有 Browser terminal projection | 退休 actor 强制 mutationCount=1、REJECTED reason 覆盖、无回执假0和历史状态猜测 | EVD-001, EVD-004, EVD-005, EVD-007, EVD-008 | 非空库不能前向迁移、任一历史 row/hash 漂移、外部投影变化、无回执被写0/1、第二 logical send 或 exact cause 丢失即停止 | NOT_RUN |
| ACT-007 | GAP-002 | local-browser-session | CODE | exact Target、Document and file input guard | /Users/nexgen/Documents/AGENT | src/lib/browser/chrome-extension/extension-target-authority.ts；src/lib/browser/exact-target/browser-command-actor.ts | executeRegisteredCommand、activeLoaderId、targets.resolve、executeFileInput、mutationReceipt | MODIFY | ACT-003, ACT-005, ACT-006, ACT-006A | extension-target-authority.ts 文件 hash 为 d24360d6e25c731d09dae979af35615614f10f42cf2f9d357a1b49e61896ba4a；保留当前 resetToStart fresh loader 验证 | 每个保留的 DOM intent 执行前后 resolve 同一 targetRef/documentRef 并核验 main-frame loader；首个 raw event 前变化为 count=0/REJECTED/BROWSER_DOCUMENT_INVALID，首个 raw event 后变化为 count=1/DISPATCHED/BROWSER_DOCUMENT_INVALID；只有 reply envelope 的 Target/Document/hash 自相矛盾才使用 BROWSER_AUTH_TRANSCRIPT_INVALID。file input 在同一 guard 内核验唯一 exact input、type=file、真实 connected、批准 grant和路径集合；零、多、非 file、detached、grant invalid 分别返回映射表指定 cause、logical count 0和冻结 proof；setFileInputFiles 发出即 count 1，随后精确回读 FileList，正向为批准集合完全一致，负向为原 FileList 完全未变，两者均未知时保持 DISPATCHED；扩展结果加入 actor 的 file-input 专用 parser | 禁止第二 Document registry、持久 snapshot、跨层 documentEpochHash、URL 猜测、自动换 Target、第二上传路径、修改 authenticated-media、把 raw 文件事件数当 logical count或把 file selection 当 Provider ready | 现役 ExtensionExactTargetRegistry、activeLoaderId、ACT-003 typed result、ACT-004 physical state、本工单映射表 | 单条 DOM 和 file-input 命令的现役 Document、logical count 和正负 proof guard | DOM runtime 和 file-input 获得同一命令边界；上层 API 不变 | 退休未验证 Document 的 DOM 结果、file input 的 Target 错误误用、常量 identityRevalidated和常量 mutationCount | EVD-002, EVD-003, EVD-004, EVD-005, EVD-008 | loader 无法精确读取、非 file 或 detached input发生 logical mutation、候选数错误被报成 Target invalid、FileList 无双向 proof、Document 漂移阶段映射错误或 DISPATCHED 对账被允许换 Document 即停止 | NOT_RUN |
| ACT-008 | GAP-006 | local-browser-session | CODE | Browser DOM acceptance matrix | /Users/nexgen/Documents/AGENT | scripts/acceptance/local-browser-dom-intent-support.ts；scripts/acceptance/local-browser-auto-pairing.acceptance.ts；scripts/acceptance/local-browser-rule-mutants.acceptance.ts；scripts/acceptance/local-browser-terminal-contract.acceptance.ts | Browser DOM functional、fault、mutant and WAL cases | MODIFY | ACT-002, ACT-003, ACT-004, ACT-005, ACT-006, ACT-006A, ACT-007 | 生产代码动作全部完成；现有 no-layout 和 malformed-box 用例保留 | 增加 rendered 与 inert 分离、祖先 opacity和aria-hidden、clip、zoom、DPR、transform、移动坐标、actual-target guard、same-node text或value或aria变化、全候选 revision、正负 postcondition 四组合、每个 raw event 断点、file input 零多非 file detached和成功 FileList，以及现有 connected、disabled、no-layout、stale、navigation、scope、read、inspect、typed result、非法 selector、零重放和错误分母不变用例 | 禁止修改 GPT fixture 让其掩盖 Browser failure，禁止删除既有用例，禁止把 fixture PASS 当真实 Chrome 或 production PASS | ACT-002 至 ACT-007 outputs | Browser 自有确定性回归矩阵 | GPT 只由现役 compile 和一个真实消费者回归验证 | 退休 box-only、混淆 rendered和inert、常量 identity、常量 logical count、file input Target 错误和新增状态 mutant | EVD-001, EVD-002, EVD-003, EVD-004, EVD-005, EVD-006, EVD-010 | 任一矩阵分支没有直接断言、需要非 Browser 生产修改、错误 target effect未被 guard阻止或错误码分母变化即停止 | NOT_RUN |
| ACT-009 | GAP-006 | local-browser-session | REAL_ENVIRONMENT | Browser DOM stress and soak | NONE | NONE | fixed Browser DOM stress protocol | VERIFY | ACT-008 | deterministic acceptance 全部 PASS；隔离 Chrome profile 和 exact system Target 已获授权 | 在 10 个 eligible waiter 压力下执行 Browser DOM 探针；长历史 DOM、20 候选、1000 次同 Document 内容和几何重绘、每个 raw event 断点、导航、timeout、reply loss、64 协议序列和60分钟 soak；断言零错误目标 effect、每 exact call 最多一个 logical mutation、零悬挂 command，in-flight map、timer、CDP handle、临时 fingerprint、action guard和heap在每轮回到基线范围，合法 append-only WAL 不计为泄漏 | 禁止清理或压缩合法 WAL 来通过压力、触碰操作者 Tab、增加 Browser scheduler、刷新 deadline、把未到 nextCheckAt 的任务入队、输出敏感 DOM或以平均值掩盖单次错误 effect | exact system Target、Browser 自有压力 fixture、现役 FIFO和WAL | Browser 资源、payload和竞态证据 | N/A: 只证明 Browser 内部，不证明 Product 或 Website 完成 | N/A: 验证既有单链，无第二路径 | EVD-004, EVD-005, EVD-006, EVD-007 | 任一错误目标 effect、重复 logical mutation、悬挂、临时资源不回落、合法 WAL 被删、DISPATCHED 重放、FIFO 饥饿或敏感日志即 FAIL | NOT_RUN |
| ACT-010 | GAP-001 | local-browser-session | MANUAL | Browser slice boundary and forbidden-surface audit | NONE | NONE | import graph、git diff、error/state vocabulary | VERIFY | ACT-008 | ACT-001 绑定候选仍有效；当前 Browser slice 全部生产改动可列举 | 审计当前 Browser slice diff 只命中批准 Browser 文件和 Browser 自有测试；证明 GPT、Product、Runtime、Website、laws、Blueprint 零修改；证明无 UNKNOWN、新 DOM code、公开策略、第二 identity/reader、bridge 或 fallback；现役 GPT consumers typecheck。ACT-012/013/016/019 后续必须在各自单独候选审计里重复相同边界检查 | 禁止为通过回归修改未绑定消费者、法案、生成投影或质量裁决 | git diff、rg、TypeScript compile、import graph、protocol manifest | Browser slice 边界零越界和冻结消费者兼容证据 | 20 页面 Child 后续只能在 ACT-013 单独授权后改动；6 continuation 不进入 DOM | 当前 slice 冲突词汇、无消费表面和未授权跨 Owner 改动为零 | EVD-001, EVD-009, EVD-010 | 命中任一未授权 surface、发现第二状态或需要未绑定消费者改动即 FAIL | NOT_RUN |
| ACT-011 | GAP-006 | local-browser-session | REAL_ENVIRONMENT | exact real Chrome Browser DOM proof and native quality verdict | NONE | NONE | current project native quality and release evidence | VERIFY | ACT-009, ACT-010, ACT-012 | BLK-001 及它与 Browser 真实页面证据有关的合同已解除并重新生成可执行工单；clean candidate 已绑定；Browser 自有静态、功能、fault、stress 全部 PASS；真实 Chrome exact system Target 可用 | 在真实 GPT 页面只验证 Browser 物理层：ready SVG 短暂无 layout 后 fresh query 成功；same-node text或aria hydration 不拼包；祖先透明、aria-hidden、inert、遮挡、移动动画、scroll、zoom、DPR、transform和clip 均不产生错误目标 effect；合法按钮只有一个 logical mutation；真实隐藏 file input 成功时 setFileInputFiles 增量为1且FileList精确，零多非file和detached为0；导航、partial raw event和reply loss保持现役状态；随后运行项目唯一原生 quality入口和RELEASE动态证明 | 禁止用肉眼、截图、假 Browser、第一步回答、局部测试或 Website 入库替代 Browser 证据；禁止把 raw event 数冒充 logical mutation、把 file selection 冒充 Provider ready、或把 Browser PASS 宣称为 50 单、12 产品或全系统完成 | clean candidate、真实 Chrome、现役 exact Target、唯一 quality verdict | Browser DOM 生产级证据包及其明确证明上限 | 系统级验收可读取 Browser 证据，但仍由各现役 Owner 完成自己的分母 | N/A: 终局证据不创建新生产路径 | EVD-008, EVD-009, EVD-013 | 任一真实场景未到 Browser 层、发生错误目标 effect、原生 quality非零、RELEASE未运行或证据越级即 FAIL | NOT_RUN |
| ACT-012 | GAP-009 | local-browser-session | CODE | Browser command snapshot, cause and shared physical state | /Users/nexgen/Documents/AGENT | src/lib/browser/chrome-extension/dom-node-physical-state.ts；src/lib/browser/chrome-extension/dom-query-runtime.ts；src/lib/browser/chrome-extension/authenticated-media-runtime.ts；src/lib/browser/chrome-extension/extension-target-authority.ts；src/lib/browser/exact-target/browser-command-actor.ts | BrowserCommandContext、BrowserObservationSnapshot、readDomNodePhysicalState、browser failure span | MODIFY | ACT-004, ACT-005, ACT-006A, ACT-007 | 精确候选已重新绑定；媒体路径仍属于 local-browser-session；Runtime Log Spine schema 不变 | 在每条命令内部绑定 CDP session、Browser build/release、Target、Document revision；快照返回 scopeCandidate/EligibleCount、candidate/eligibleCount、分类 exclusionCounts、operationStage、0/1/null派发事实和所需节点事实；Browser 首发 fault 使用现役 Runtime Log Spine 保留 owner、stage、stable code、脱敏 native cause、target/document/command hash、dispatch fact 和 causedBy；authenticated media 改为复用 ACT-004 机械节点状态，保留媒体完成度、语义、认证来源、bytes 和 hash 特有规则 | 禁止公开第二 Document identity、新错误码、UNKNOWN、敏感日志、第二 logger、媒体业务泛化、DOM 进 wire 或新持久快照 | ACT-004至07 outputs、Browser build identity、Runtime Log Spine API、authenticated media 现役规则 | 完整 Browser 私有命令快照、首发 cause 和唯一物理节点状态 | GPT 只在授权后消费必要机械事实；Runtime/Website 传播由 ACT-016 单独绑定 | 删除 DOM/media 重复物理判定和上层 owner 覆盖前的 Browser 原因丢失 | EVD-006, EVD-008, EVD-013, EVD-015 | 任一身份或阶段无法稳定获得、记录敏感内容、媒体业务被并入普通 DOM、或需修改非 Browser 法案即停止 | NOT_RUN |
| ACT-013 | GAP-008 | gpt | CODE | 20 GPT page Child private contracts and handlers | /Users/nexgen/Documents/AGENT | src/capabilities/gpt/web/**；对应 GPT acceptance | 源方案§5.1的20个页面Child | MODIFY | ACT-011, ACT-014, ACT-015 | BLK-002 已通过单独授权、精确路径/hash 和新工单解除；BLK-001/003/004 与对应 Child 有关的合同已解除；Browser EVD-001至013 通过 | 按源方案§5.1和§7逐 Child 建立 exact composer/popup/panel/turn/attachment/menu 作用域、同 Document 快照、语义前置、唯一派发、后置回读和现役有界等待；按§8.2风险顺序迁移；6 continuation Child 零修改 | 禁止 Browser 解释 GPT 业务文字、双 Reader、fallback、自主重试、调度或把 DOM 正常过渡当终态 | Browser typed snapshot、源方案 Child 清单、menu/fork 决定 | 20 个页面 Child 的单路私有合同 | Product 仍只消费 Child 结构化结果；continuation 仍归原 Owner | 与 ACT-019 同一 Child 原子提交删除旧宽泛查询 | EVD-011, EVD-012 | 未获精确授权、任一 Child 需要第二 Browser Reader、合同无真页面证据或旧路未删即停止 | NOT_RUN |
| ACT-014 | GAP-010 | gpt | REAL_ENVIRONMENT | active upload menu root contract decision | NONE | NONE | exact composer→active menu root→upload leaf | VERIFY | ACT-001 | 当前 Chrome/GPT 版本和 exact system Target 已绑定；只读观察获得授权 | 在真实 GPT 页面建立可重复机械验证的 exact composer、plus trigger、expanded、active menu root 和唯一 upload leaf 关系，记录正向与另一 composer/menu 负向；找不到就保持 BLOCKED | 禁止全页文字、中文唯一、图像猜测、fallback、修法或 Browser 业务 selector 库 | 真实 Chrome、页面结构、现役 GPT 私有合同 | 权威可接受的 menu root 决定或明确 FAIL | ACT-013 只消费决定，Browser 不导出 GPT 语义 | 决定后 ACT-019 删除全页上传文字扫描 | EVD-014 | 无法证明 menu 属于 exact composer、只有文字碰撞唯一或页面版本未绑定即保持 BLOCKED | NOT_RUN |
| ACT-015 | GAP-011 | gpt | MANUAL | fork contract authority decision and proof plan | NONE | NONE | fork_exact_gpt_conversation_at_checkpoint | VERIFY | ACT-001 | 现役 fork 合同、真 UI 两步结构和候选 Chrome 版本已绑定 | 提交唯一裁决：若找到一次可证机器入口，保留一次 mutation；否则只能经单独法案/GPT 合同授权改为两步可恢复协议，每步有前置、派发事实、后置和中断后重新观察；随后设计真 Chrome 正反证明 | 禁止 Browser 封装 GPT 两步组合动作、fallback、盲目重放、两份合同并存或无权修法 | 现役合同、真实 UI 证据、权威决定 | 唯一 fork 合同决定与真 Chrome 证明方案 | ACT-013 只按决定实现 | ACT-019 删除 branch-conversation-button 失效合同 | EVD-014 | 权威未决定、无真 Chrome 可证路径或任一方案需要 fallback 即保持 BLOCKED | NOT_RUN |
| ACT-016 | GAP-012 | runtime-log-spine | CODE | Browser causedBy propagation through GPT, Runtime and Website | /Users/nexgen/Documents/AGENT | 仅限另行绑定的 GPT/Runtime/Website 现役错误投影文件 | existing RuntimeLogEventV2 cause projection | MODIFY | ACT-012, ACT-013 | BLK-005 已通过精确 repo/path/hash、Owner 同意和新工单解除；Runtime Log Spine schema 零改动 | 只将 Browser 首发 event identity 作为现役 causedBy 原样传播；GPT 语义失败、Product 状态和 Website 承接事件保留自身 Owner，不覆盖 Browser owner/stage/code/dispatch fact；删除现有 owner 覆盖投影 | 禁止新 event schema、第二 logger/bus、Browser 敏感载荷、动态诊断 bag、跨 Owner 终态改写或未绑定文件修改 | ACT-012 Browser event、现役 Runtime Log Spine causedBy | Browser→GPT→Runtime→Website 不丢失原因链 | Website 可以增加承接失败，但仍可回溯 Browser 首发事件 | 删除上层覆盖 Browser responsibleOwner 的投影 | EVD-015 | 候选路径未单独绑定、必须改 Runtime schema、causedBy 断链或 owner 被覆盖即停止 | NOT_RUN |
| ACT-017 | GAP-013 | gpt | REAL_ENVIRONMENT | G01-G18 real GPT acceptance | NONE | NONE | source scheme G01-G18 matrix | VERIFY | ACT-013, ACT-014, ACT-015, ACT-016 | Browser 、20 Child、menu、fork 和 cause 相关实现已闭合；隔离真 Chrome profile 和 exact system Target 已授权 | 逐项执行 G01-G18，覆盖 hydration、屏外 turn、popup 动画、panel 互斥、模型/推理幂等、menu root、file input、附件上传/完成、草稿/send、submit 不重放、文本稳定、rate-limit、图片去重/outer assistant 和 fork | 禁止修 fixture 迁就实现、以截图/肉眼冒充 Browser 证据、跳过未出现场景、把 Provider ready 与 file selection 合并或把一项 PASS 冒充 18 项 | 真实 GPT、绑定 Chrome 版本、现役扩展、G01-G18 预期 | 18/18 场景逐项原生 receipt | Product 只接收现役 Child 结构化结果 | 证据同时证明旧宽泛路径和 fallback 未被调用 | EVD-012, EVD-014, EVD-015 | 任一 G 场景缺少、证据未到达对应 Owner 层、发生重复派发或原因覆盖即 FAIL | NOT_RUN |
| ACT-018 | GAP-013 | Website/AGENT existing owners | REAL_ENVIRONMENT | 50-order 12-product full-chain acceptance and release | NONE | NONE | Website order→Product→Browser→GPT Child→Runtime→Website durable readback | VERIFY | ACT-017 | G01-G18 PASS；全链候选、真订单数据、12 产品分类、唯一 quality verdict 和 RELEASE 动态证明均已授权绑定 | 使用真网站订单执行 50 单连续到达和 12 类产品中全部 GPT 组合；覆盖上传中新单不打断、文本/图片/附件/续接交错、重绘、park/reacquire、Chrome/AGENT 重启、submit/upload/fork 未决、Browser/GPT/Provider/Website 失败；证明 Child 未终态不释放执行权、只释放故障切片容量、已派发不重放、四层原因不覆盖、原订单身份不变；最后运行唯一 quality verdict、RELEASE 并从 Website 耐久 Owner 回读入库结果 | 禁止模拟订单替代真订单、低层 PASS 代替高层、固定重试次数冒充完成、换 task identity、盲目重放、全局暂停容量或新调度器 | 真订单、12产品矩阵、现役五层 Owner、唯一 quality/release 入口 | 真订单全链 receipt、RELEASE receipt 和 Website 耐久回读 | Website 是业务完成的唯一耐久 Owner；AGENT 负责恢复与真实失败 | N/A: 运行现役唯一责任链，不建替代路径 | EVD-016, EVD-017 | 任一场景缺失、当前 Child 被正常 DOM 过渡打断、已派发重放、因果覆盖、身份改变、quality/release 非 PASS 或 Website 未入库即 FAIL | NOT_RUN |
| ACT-019 | GAP-008 | gpt | CODE | retire every migrated Child old broad path | /Users/nexgen/Documents/AGENT | 与 ACT-013 每个 Child 相同的精确绑定文件和测试 | old broad query、global upload scan、branch-conversation-button、fallback | DELETE | ACT-013 | 当前 Child 新私有合同与真 GPT 证据已 PASS；删除目标与候选 hash 一致 | 每个 Child 迁移在同一原子候选中删除旧宽泛查询、全页上传文字扫描、失效 branch 合同及所有 fallback/双读分支；删除后必须还能通过该 Child 的真 GPT 验收 | 禁止 alias、wrapper、feature flag、shadow、兼容路径、第二 selector 或为保留旧测试而留死代码 | ACT-013 新合同、精确删除目标、对应真 GPT receipt | 每 Child 单一活跃路径 | Product 仍消费同一 Child 输出 | 旧宽泛路径物理不存在 | EVD-011, EVD-012, EVD-014 | 新合同未 PASS、删除影响工单外用户改动、旧符号仍可达或需要兼容桥即停止 | NOT_RUN |

### 5.1 Logical mutation 与 raw event 固定分母

`logicalMutationDispatchCount` 只表示一个 Browser command 的逻辑 mutation 是否已经开始，它不等于底层 CDP raw event 数。可信 reply/进度证据中的已知值只能是 0 或 1；Browser WAL 持久化字段域为 `null | 0 | 1`，无可信 reply/进度证据时必须为 null。第一个 raw event 或专用 DOM mutation 调用已被可信证据证明发出后写 1，后续任何异常不得改回 0，也不得启动第二个 logical mutation。

| Intent | Logical dispatch 起点 | 固定 raw sequence | 正向后置 | 冻结负向后置 |
|---|---|---|---|---|
| click | 第一个 mousePressed 发出 | mousePressed 后 mouseReleased，各一次 | intent 声明的 exact attribute 或 exact match 唯一成立 | NONE: 立即未观察到正向可能只是 React 延迟，必须保持 DISPATCHED；只有现役 Owner 的精确只读对账可后续提供终态负证 |
| hover | mouseMoved 发出 | mouseMoved 一次 | exact aria-expanded 后置唯一成立 | NONE: 正向未观察到保持 DISPATCHED；仅现役 Owner 精确只读对账可收束 |
| doubleClick | 第一个 mousePressed 发出 | clickCount 1 和 2 各一组 pressed、released | exact postDoubleClickMatch 唯一成立 | NONE: 正向未观察到保持 DISPATCHED；仅现役 Owner 精确只读对账可收束 |
| keypress | 第一个 rawKeyDown 发出 | 每个 repeat 一组 rawKeyDown、keyUp，repeat 为 1 至 4 | exact postKeypressMatch 唯一成立 | NONE: 正向未观察到保持 DISPATCHED；仅现役 Owner 精确只读对账可收束 |
| fill | clear 分支的第一个 rawKeyDown，或不 clear 时的 Input.insertText 发出 | clear 的有限 key sequence 后最多一次 Input.insertText | exact retained value 等于 approvedText | exact pre-value 完整保持且 approvedText 未出现 |
| file-input | DOM.setFileInputFiles 发出 | 一次 DOM.setFileInputFiles | exact FileList 数量和批准文件名集合完全一致 | exact pre-FileList 完整保持且批准集合未出现 |

`postClickUrl` 因无生产消费者并与统一 Document guard 冲突，在 `ACT-002` 物理退休，不属于施工后的 intent 分母。

### 5.2 Zero-dispatch cause、proof 与 WAL 映射

下表只使用现役错误码，不新增错误词典。每个 zero-dispatch reply 必须同时携带 `logicalMutationDispatchCount=0`、下表 code、同 Target/Document 的 fresh negative proof hash 和 `positivePostconditionVerified=false`；Actor、WAL reason、Browser terminal span 和 causedBy 必须保存同一 code。

| Fresh mechanical fact | Existing code | Logical count | WAL terminal | 对外 failure |
|---|---|---|---|---|
| exact candidate 为零 | BROWSER_DOM_CANDIDATE_MISSING | 0 | REJECTED | BROWSER_DOM_CANDIDATE_MISSING |
| exact candidate 多于一 | BROWSER_DOM_CANDIDATE_AMBIGUOUS | 0 | REJECTED | BROWSER_DOM_CANDIDATE_AMBIGUOUS |
| backend node stale 或 detached | BROWSER_DOM_NODE_STALE | 0 | REJECTED | BROWSER_DOM_NODE_STALE |
| 首个 raw event 前 current documentRef 或 loader 漂移 | BROWSER_DOCUMENT_INVALID | 0 | REJECTED | BROWSER_DOCUMENT_INVALID |
| rendered 但 disabled、aria-disabled、inert、aria-hidden、不可聚焦、不可编辑、viewport 外、裁剪为空、pointer-events none 或派发前 hit-test 遮挡 | BROWSER_CAPABILITY_REJECTED | 0 | REJECTED | BROWSER_CAPABILITY_REJECTED |
| file grant、批准集合或路径身份非法 | BROWSER_FILE_GRANT_INVALID | 0 | REJECTED | BROWSER_FILE_GRANT_INVALID |
| file input 候选不是 type=file | BROWSER_CAPABILITY_REJECTED | 0 | REJECTED | BROWSER_CAPABILITY_REJECTED |

### 5.3 One-dispatch 正负后置与未知收束

| Reply after logical count 1 | WAL state | Failure code | Replay rule |
|---|---|---|---|
| positive=true 且 negative=false，proof hash 完整 | CONFIRMED | NONE | 禁止再次执行 |
| fill/file-input 的 positive=false 且同步 exact negative=true，或现役 Owner 只读对账给出精确终态负证 | REJECTED | 精确现役 cause | 禁止再次执行 |
| positive=false 且 negative=false，或 reply、proof、后置读取缺失 | DISPATCHED | BROWSER_COMMAND_RECEIPT_MISSING | 只读对账，禁止再次执行 |
| 首个 raw event 后真实 documentRef/loader 漂移 | DISPATCHED | BROWSER_DOCUMENT_INVALID | 保留原 Target/Document 现场，只读对账，禁止再次执行 |
| 第一 raw event 后 actual-target mismatch，且无法证明 Provider effect 被预先拦截 | DISPATCHED | BROWSER_CAPABILITY_REJECTED | 不得改记为 count=0；只读对账，禁止重放 |
| positive=true 且 negative=true，或 reply envelope 的 logical count、hash、Target、Document 自相矛盾 | DISPATCHED | BROWSER_AUTH_TRANSCRIPT_INVALID | 回执不可信，只读对账，禁止再次执行 |
| 任一 partial raw sequence、disconnect、扩展重启或 deadline 到期 | DISPATCHED | BROWSER_COMMAND_RECEIPT_MISSING | 保留原 Target、Document 和冻结后置，只读对账 |

`logical_mutation_dispatch_count` 是 Browser WAL 内部事实，不改变任何冻结非 Browser 合同：现役对外投影仍为 `DISPATCHED -> mutation_outcome=dispatched`、`CONFIRMED -> confirmed`、`REJECTED -> confirmed`。COMMAND 刚通过 WebSocket 发出时该内部事实仍为 `null`；只有可信的 zero/one reply 或合法进度证据才能写成 0/1，首 raw event 后扩展崩溃且无 reply 必须保持 `null + DISPATCHED`。

## 6. 退休与证据

<!-- work-order:evidence -->
| Evidence ID | Requirement IDs | Type | Proves | Does Not Prove | Executor | Procedure | Expected Result | Artifact | Failure Result | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| EVD-001 | REQ-001, REQ-002, REQ-007, REQ-009, REQ-010, REQ-012, REQ-013, REQ-014, REQ-019 | STATIC | 修改面、Owner、错误和状态词典、禁止耦合、日志/wire 保密全部闭合 | DOM runtime、真实 Chrome、业务完成 | 独立审计 Agent | 检查 git diff、imports、exports、protocol error list、WAL state union、全仓禁止词和禁止路径 | 只有批准 Browser 文件和 Browser 自有测试变化；无新状态、error、Owner、reader、日志、DOM/Prompt wire payload 或跨层合同 | 现役 quality evidence 目录中的 Browser boundary observation | 任一越界或第二真相即 FAIL | NOT_RUN |
| EVD-002 | REQ-003, REQ-006, REQ-014 | EXAM | 每个 intent/result 类型闭包、双端 parser、selector permit code、Document guard | 浏览器页面动态稳定 | Codex executor | 运行 TypeScript typecheck、result mutant、malformed reply、Document mismatch 和 caller compile matrix | 全部保留 intent 有唯一 result parser；postClickUrl 已退出；malformed reply fail-close；非法 selector 为 permit invalid | 现役 Browser acceptance receipt | unknown、open bag、错误码污染、漏 parser即 FAIL | NOT_RUN |
| EVD-003 | REQ-004, REQ-005, REQ-008, REQ-011, REQ-015, REQ-018 | INTEGRATION | rendered 与 inert 分离、connected、disabled、semantic hidden、派发前 actual-target actionability、file input 和 no-layout 全入口行为 | 真实 Provider ready 和长时资源稳定 | Codex executor | 执行 ACT-008 functional matrix | 所有矩阵直接断言通过，派发前不可操作 DOM 或非法 input 的 logical count 为零；真实 guard 证明错误 target logical mutation 为零 | 现役 Browser integration receipt | 任一入口仍用 box-only、隐藏内容泄漏、派发前 guard 漏拦或非法 input 产生逻辑动作即 FAIL | NOT_RUN |
| EVD-004 | REQ-002, REQ-003, REQ-008, REQ-011, REQ-014, REQ-015, REQ-017, REQ-018 | FAULT | 同页全字段重绘、导航、stale、no-layout、畸形 payload、file input、partial raw event和回执丢失的精确分类 | 正常路径吞吐、Website 接收 | Codex executor | 注入同 node text或value或aria变化、候选集合变化、loader变化、no-layout、stale、malformed box、file input detach、每个 raw event和reply loss | 分别得到现役 NODE_STALE、DOCUMENT_INVALID、不可见候选、READ_INVALID、零次REJECTED或一次后DISPATCHED只读现场；零UNKNOWN | 现役 Browser fault receipt | 错误合并、混合结果、重放或新增 code 即 FAIL | NOT_RUN |
| EVD-005 | REQ-002, REQ-005, REQ-011, REQ-017, REQ-018 | FAULT | 屏外、遮挡、disabled、aria-disabled、inert、aria-hidden、actual-target mismatch、非法 file input 和正负 postcondition 形成 0 或 1 logical mutation 及现役 WAL | GPT 是否决定 retry、Provider ready、业务是否完成 | Codex executor | 按 5.1 至 5.3 对每种机械拒绝、每个 raw event 断点、Document 漂移阶段和正负组合记录 raw events、logical count、proof、exact cause 和 WAL；进程重启后从同一 SQLite 只读回读新旧 rows | 动作前拒绝 count=0 并保留 exact cause；首 raw event 后 count=1；无 reply 及历史 REJECTED/DISPATCHED dispatch count 为 null 且不猜测；所有 REJECTED 对外仍为 mutation_outcome=confirmed；click/hover/doubleClick/keypress 负面未决保持 DISPATCHED；错误 target effect 为零 | 现役 Browser mutation receipt | 任一重复logical mutation、错误target effect、cause覆盖、无 reply 或历史 dispatch count 被猜测、REJECTED 外部投影变化或非法终态即 FAIL | NOT_RUN |
| EVD-006 | REQ-009, REQ-011 | STATIC | 固定 CDP 函数无 caller 注入，日志无 selector、DOM、正文、URL、Prompt、附件或路径 | 页面语义准确性 | 独立审计 Agent | 执行源码 taint 检查、日志 redaction mutant 和真实 failure 日志抽查 | 仅稳定 allowlisted code、Owner 和 opaque ref 可见 | 现役 Runtime Log Spine security receipt | 任一敏感内容、第二 logger 或动态脚本注入即 FAIL | NOT_RUN |
| EVD-007 | REQ-007, REQ-011, REQ-017 | DYNAMIC | 有界 wait、10 waiter、1000次内容和几何重绘、64协议序列及60分钟soak下无饥饿、重复logical mutation、临时资源泄漏或合法WAL丢失 | 真实 GPT 页面语义或 Website 入库 | Codex executor | 执行 ACT-009 fixed stress protocol | 错误target effect为零；每 command 的持久化 logical count 为0/1/null；null 仅限无可信 reply/进度证据且保持 DISPATCHED，禁止猜测；in-flight map、timer、guard、fingerprint和heap回落；每logical mutation保留恰好一条法定WAL | 现役 Browser dynamic proof receipt | 任一临时资源泄漏、长占FIFO、重复logical mutation、合法WAL被清理、deadline刷新或误点即 FAIL | NOT_RUN |
| EVD-008 | REQ-003, REQ-004, REQ-005, REQ-011, REQ-016, REQ-017, REQ-018 | REAL_ENVIRONMENT | 真实 Chrome exact Target 上 Browser 物理层可抵抗全字段 hydration、透明和移动祖先、actual-target mismatch、no-layout、file input和reply loss | 50单、12产品、完整GPT Child、Provider ready、Product恢复或Website入库 | 授权执行者 | 执行 ACT-011 的真实 Chrome Browser DOM 场景并保存原生 receipt | 每场景达到Browser层直接证据，logical count、raw sequence、actual target、WAL和现役错误精确 | 现役 real-browser receipt | 假Browser、截图、页面肉眼、payload不完整或未达到Browser层即 FAIL | NOT_RUN |
| EVD-009 | REQ-011, REQ-016 | MANUAL_PROOF | exact candidate、唯一 quality verdict、READY 和 RELEASE 证据层级诚实 | 未运行的全系统生产交付 | release adjudicator | 核验 clean commit、方案 hash、baseline、全部 action/evidence、原生 quality exit code和 release receipt | 全部证据 PASS 且无越级结论；否则保持未发布 | 现役 release adjudication artifact | dirty、漂移、非零 exit 或缺 release proof 即 FAIL | NOT_RUN |
| EVD-010 | REQ-001, REQ-006, REQ-007, REQ-010, REQ-012, REQ-013, REQ-019 | STATIC | 现役 GPT consumer 编译兼容与 wire/consumer 冲突，6 continuation、Runtime、Website、媒体和 Product 零改动 | 这些 Owner 自身生产完成 | 独立审计 Agent | 清点 BrowserDomIntent 调用、运行 consumer typecheck、核验禁止路径 git diff 为零 | 现役调用无需源码修改；冻结边界零写入 | 现役 boundary regression receipt | 任一冻结消费者必须修改或出现 Browser 策略泄漏即 FAIL | NOT_RUN |
| EVD-011 | REQ-010, REQ-012, REQ-020 | STATIC | 20 个页面 Child 都有唯一私有合同、精确作用域、同 Document 快照、派发/后置，旧宽泛查询和 fallback 已物理删除，6 continuation Child 零改动 | 真实 GPT 动态、Provider 成功或 Website 入库 | 独立审计 Agent | 逐个清点源方案§5.1的20个 Child 与§5.2的6个 Child；审计 imports、selector/handler 路径、旧符号、fallback、修改面和对应测试 | 20/20 页面 Child 每个只有一条活跃消费路径；6/6 continuation 仍归原 Owner；全页上传扫描、失效 branch 合同和上层 owner 覆盖已从授权候选退休 | 现役 GPT boundary audit receipt | 任一 Child 缺失、有第二 Reader/旧路、continuation 被 Browser 吸收或修改越界即 FAIL | NOT_RUN |
| EVD-012 | REQ-012, REQ-020, REQ-025 | REAL_ENVIRONMENT | G01-G18 真实 GPT 页面矩阵逐项证明 20 个页面 Child 的作用域、幂等、派发、稳定、去重、rate-limit、menu 和 fork 合同 | 50 单、12 产品、Product 容量、Website 入库或 RELEASE | 授权执行者 | 按 ACT-017 在绑定真 Chrome/GPT 版本执行 G01-G18，每项保存 Browser 物理 receipt、Child 语义 receipt 和不重放事实 | G01-G18 全部 PASS；任一项缺证不允许用其他项替代 | 现役 real-GPT acceptance receipt | 任一场景未出现/未到达目标 Owner层、发生重复 mutation、错作用域或旧路命中即 FAIL | NOT_RUN |
| EVD-013 | REQ-009, REQ-010, REQ-013, REQ-021 | INTEGRATION | Browser 命令绑定 CDP session/build/Target/Document revision，快照包含计数、排除、阶段、派发和节点事实，DOM/media 共享物理判定，Browser 原因完整且脱敏 | GPT 语义合同、跨 Owner 传播或全链完成 | Codex executor | 运行命令身份/快照 parser、同 Document 重绘、分类 exclusionCounts、各 operationStage fault、0/1/null 派发、DOM/media 同节点对照和日志脱敏矩阵 | 所有字段来自同一 command；同节点物理结果一致；媒体特有规则不泄漏到 DOM；日志只有 allowlisted 事实 | 现役 Browser integration/fault receipt | 字段混合不同 Document、排除数不可复算、阶段/cause 丢失、媒体业务被合并或敏感日志即 FAIL | NOT_RUN |
| EVD-014 | REQ-022, REQ-023 | REAL_ENVIRONMENT | active menu root 有 exact composer 归属的机器正反证；fork 有唯一权威合同和真 Chrome 派发/回读证据 | 其他 GPT Child、50 单或 Website 入库 | 权威决定者与授权执行者 | 核验 ACT-014 的 composer→menu root→leaf 关系；核验 ACT-015 只有一份 fork 裁决，再按裁决运行一步或两步的全部中断点和不重放证明 | menu 只在 exact composer 命中；fork 合同唯一，真 Chrome PASS，失效选择器与 fallback 不存在 | 现役 GPT contract decision 与 real-Chrome receipt | 决定不唯一、只靠全局文字、fork 可重放或旧路仍存在即 FAIL | NOT_RUN |
| EVD-015 | REQ-009, REQ-024 | FAULT | Browser 首发 owner、stage、code、native cause、target/document/command hash、dispatch fact 和 causedBy 在 GPT、Runtime、Website 传播中不丢失、不被覆盖 | 业务恢复成功、Website 入库或 Browser 无错 | 独立 fault 审计 Agent | 分别注入 Browser query/scope/style/box/attribute/dispatch/postcondition/Document-change fault，追踪 Browser→GPT→Runtime→Website 的现役 event/causedBy，并检查脱敏 | 每个上层事件可回溯同一 Browser 首发事件；上层只增自身语义；responsibleOwner 和原因不变；无敏感内容 | 现役 Runtime Log Spine fault receipt | causedBy 中断、owner/code 覆盖、阶段/派发事实丢失、新 logger/schema 或敏感数据即 FAIL | NOT_RUN |
| EVD-016 | REQ-012, REQ-025, REQ-026 | REAL_ENVIRONMENT | 12 产品全 GPT 组合、50单连续到达、上传中新单不打断、混合任务、重绘/park/重启、未决动作、四层 fault、容量切片、不重放、因果不覆盖和原任务身份恢复 | 未运行的 RELEASE 或未回读的 Website 耐久结果 | 授权全链执行者 | 按 ACT-018 使用真网站订单执行全场景，从各唯一 Owner 读取 task/Child/Browser/Product/Runtime/Website 状态和回执 | 当前 Child 未终态不释放执行权；仅故障切片容量释放；已派发零盲重放；四层不覆盖；原订单身份不变 | 现役 full-chain dynamic receipt | 任一场景/产品缺失、上传任务被新单打断、盲重放、过度释放容量、因果覆盖或 task identity 改变即 FAIL | NOT_RUN |
| EVD-017 | REQ-025, REQ-026 | MANUAL_PROOF | 单元、集成、真 Chrome、真订单四层全 PASS，clean candidate 通过唯一 quality verdict 和 RELEASE，Website 耐久 Owner 已承接并存储真实结果 | 未被 Website 耐久回读确认的 Provider 动作 | release adjudicator | 核验 EVD-001至016、clean commit、唯一 quality verdict exit code、RELEASE 动态 receipt，再从 Website 唯一耐久 Owner 回读原订单结果 | 全部证据 PASS 且 Website 可按原订单身份读到已存储结果；否则不得宣称 Browser DOM 生产级 | 现役 release adjudication 与 Website durable readback artifact | 任一证据层缺失、dirty/漂移、quality/release 非 PASS、Website 未入库或换任务身份即 FAIL | NOT_RUN |

## 7. 完成公式、阻断与执行前复核

<!-- work-order:blockers -->
| Blocker ID | Requirement IDs | Description | Resolution Required |
|---|---|---|---|
| BLK-001 | REQ-019 | `LAW-LOCAL-BROWSER-SESSION-006-V11` 禁止 DOM/HTML/Prompt/用户输入进入 Browser wire，`LAW-LOCAL-BROWSER-SESSION-001-V4` 又禁止任何实现字节上限和截断；当前 Browser REPLY 与冻结 GPT 消费者却直接交换 outerHtml、semanticText 和 approvedText。ARTIFACT_CHUNK 仍是 Browser wire，4 MiB/32 MiB 又是明令禁止的上限，不能作为解法 | 权威方必须先给出一个同时满足现役 Browser wire 法案与真实 GPT 消费者的唯一合法交接合同；本工单不授权修法、修改 GPT 生产源码、第二 transport、artifact 旁路、上限、截断或 UNKNOWN。决定后必须重新生成工单 |
| BLK-002 | REQ-020 | 源方案要求逐个修改20个 GPT 页面 Child 的私有 contract、selector、handler 和测试，但用户本轮明确边界是建设 Browser DOM 自身，当前工单也未对 GPT 生产文件建立精确候选绑定 | 由授权人单独批准 GPT Child 交接施工，绑定精确路径、符号、hash、用户改动和新 baseline，然后重新生成工单；未授权前保留全20个目标与验收，不修改 GPT，不把目标从分母中删除 |
| BLK-003 | REQ-022 | 真实 GPT 页面的附件控件尚未暴露已冻结的 aria-controls/testid 等 composer→active menu root 机器关系，现役全页 span+中文文字唯一不能证明上传叶子属于 active composer | 在绑定的当前 Chrome/GPT 版本上完成 ACT-014，由 GPT 合同权威冻结唯一可机器验证的 menu root；找不到就保持 Child production blocked，禁止全页文字、fallback 或 Browser 语义规则库 |
| BLK-004 | REQ-023 | 现役 fork 选择器已失效，真实 UI 是两步，而现役 Child 合同是一次 physical mutation；未经权威裁决不能由 Browser 偷偷组合或加 fallback | 现役 GPT/法案权威必须裁决唯一方案：证明可一次派发的机器入口，或单独授权两步可恢复协议；裁决、候选绑定和真 Chrome 证据完成前 fork Child 保持 production blocked |
| BLK-005 | REQ-024 | Browser 内部可以产生完整首发 cause，但要证明它在 GPT、Runtime、Website 全链不丢失，需要检查并可能修正各 Owner 的现役错误投影；这些非 Browser 路径尚未精确绑定 | 单独绑定必需的 GPT/Runtime/Website 精确文件、符号、hash、Owner 和当前用户改动，证明只复用现役 Runtime Log Spine causedBy 而不改 schema，再生成新工单；未绑定前不得修改跨 Owner 投影 |

```text
当前施工许可 = FALSE
CAUSE = BLK-001 至 BLK-005 任一未解除
解除后不得直接执行本工单
REQUIRED = 依权威决定重新审计、绑定 candidate 并生成 WORK_ORDER_READY
后续方案落地 = 新工单全部 action/retirement/evidence PASS
AND 硬边界 evidence PASS = 100%
AND actual scheme satisfaction >= 98%
AND anti-overdesign violation = 0
AND 无未处置 requirement
```

Browser DOM 内部完成的证明上限：唯一物理 Owner、单条命令原子性、机械 rendered 和 actionable、现役错误与 WAL、零误 dispatch、边界零耦合、真实 Chrome 物理证据。

Browser DOM 内部 PASS 不能单独证明 20 个页面 Child、50 个订单、12 类产品、智慧调度全链、Provider 业务成功、Runtime 恢复、Website 承接入库或系统 RELEASE；但它们不得被从方案最终完成分母中删除。它们必须按 EVD-011至017 由各现役 Owner 分层证明，最后以 Website 按原订单身份成功承接并存储结果作为业务完成。

生成时结论上限：`NOT_IMPLEMENTED / NOT_TESTED / NOT_DEPLOYED / NOT_RELEASED`。
