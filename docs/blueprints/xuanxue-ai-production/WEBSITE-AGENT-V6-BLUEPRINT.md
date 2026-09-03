# production-runtime 生产级施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "agent-production-runtime-v16",
  "status": "active",
  "owner": "agent-production-runtime",
  "lawIds": [
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V32",
    "LAW-AGENT-PRODUCTION-RUNTIME-002-V1",
    "LAW-AGENT-PRODUCTION-RUNTIME-003-V1",
    "LAW-AGENT-PRODUCTION-RUNTIME-004-V1",
    "LAW-AGENT-PRODUCTION-RUNTIME-005-V1",
    "LAW-AGENT-PRODUCTION-RUNTIME-006-V1",
    "LAW-AGENT-PRODUCTION-RUNTIME-007-V1",
    "LAW-AGENT-PRODUCTION-RUNTIME-008-V2"
  ],
  "contractRefs": [
    "docs/specs/agent-production-runtime/agent-plugin-capability-manifest.provider.spec.json",
    "docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json",
    "docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json"
  ],
  "dependencyEdges": [
    {"contractRef":"docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json","from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"ai-acceptance","repo":"ADVISION-X/xuanxue-web"}},
    {"contractRef":"docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json","from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"ai-acceptance","repo":"ADVISION-X/xuanxue-web"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"forensics-persistence-capability","repo":"local"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"gpt","repo":"local"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"runtime-log-spine","repo":"local"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"system-security","repo":"local"}},
    {"contractRef":null,"from":{"domain":"app-shell-ui","repo":"local"},"to":{"domain":"agent-production-runtime","repo":"local"}},
    {"contractRef":null,"from":{"domain":"local-app-shell","repo":"local"},"to":{"domain":"agent-production-runtime","repo":"local"}},
    {"contractRef":null,"from":{"domain":"startup-entrypoint","repo":"local"},"to":{"domain":"agent-production-runtime","repo":"local"}}
  ],
  "prohibitedDependencyEdges": [
    {"from":{"domain":"agent-production-runtime","repo":"local"},"lawId":"LAW-AGENT-PRODUCTION-RUNTIME-001-V32","to":{"domain":"app-shell-ui","repo":"local"}},
    {"from":{"domain":"agent-production-runtime","repo":"local"},"lawId":"LAW-AGENT-PRODUCTION-RUNTIME-001-V32","to":{"domain":"local-app-shell","repo":"local"}},
    {"from":{"domain":"agent-production-runtime","repo":"local"},"lawId":"LAW-AGENT-PRODUCTION-RUNTIME-001-V32","to":{"domain":"startup-entrypoint","repo":"local"}}
  ]
}
```

## 1. 唯一职责与边界

agent-production-runtime 只拥有一条 product-opaque 运输与恢复主链：

```text
Website claim + lease/grant/fence
  -> Runtime durable accept
  -> Mediator 单次路由
  -> 相邻 Product Owner 执行
  -> staged result
  -> Runtime durable Outbox intent
  -> Website domain consumer admission
  -> Runtime 校验 admission receipt
  -> local completed
```

| Runtime 唯一拥有 | 只通过 typed interface 消费 | 明确不拥有 |
|---|---|---|
| credential read、session、claim、durable accept、attempt、lease/fence | Website control intent、claim/grant/fence、business admission receipt | Website 业务准入、任务创建、领域入库、公开状态 |
| Runtime 六表、WAL、Outbox、task-local recovery、storage inventory | GPT/Browser/Forensics 的公开 effect/evidence/authority receipt | Product Flow、Prompt、模型、Child 顺序、内容裁决 |
| product-opaque failure、健康与诊断安全投影 | Runtime Log 的单写者接口 | Browser 私有 WAL、Target/Document、Runtime Log 事实正文 |
| 唯一 Runtime inspector、acceptance 与 Runtime-only proof | 相邻 Owner 已签发的结果，不复制证明正文 | 第二 checker、proof、queue、store、receipt、verdict 或兼容链 |

Product、GPT、Browser、Forensics、Runtime Log、App Shell、Startup、Website 继续由各自 active law、blueprint、spec 与 Manifest 唯一治理。Runtime 文档只记录上表接口边，不复制其业务流程、DOM、模型策略、Provider 操作或发布裁决。

## 2. 真实调用方向与内部结构

调用方向以 caller/dependent 指向 provider：

```text
App Shell / Local App Shell / Startup ----------------> Runtime
Runtime --task-result + V6 contracts------------------> Website ai-acceptance
Runtime ----------------------------------------------> GPT public facade
Runtime ----------------------------------------------> Forensics public port
Runtime ----------------------------------------------> Browser typed effect receipt
Runtime ----------------------------------------------> Runtime Log single writer
```

Agent Plugin Capability Manifest 是 Runtime 对外发布的 provider surface，不是 Runtime 自身的 dependency edge；它保留在本施工图 contractRefs，Website consumer 必须在 Website 所属施工图声明 ai-acceptance → Runtime 的消费边。AGENT 不伪造远端 Owner 的 consumer dependency，也不把 provider 发布方向误写为本地调用方向。
Runtime 不得反向依赖 App Shell、Local App Shell 或 Startup。Browser 私有 store 不进入 Runtime；若 Runtime 需要 Browser 事实，只能消费 Browser Owner 对外公开的 typed authority/receipt。架构基础法案是治理约束，不伪装成运行 dependency edge。

内部唯一分层：

```text
credential + contract preflight
  -> store foundation + read-only storage inventory
  -> cloud session + claim
  -> durable accept + execution binding
  -> mediator handoff
  -> reconciliation + single Outbox
  -> Website receipt verification
  -> local terminal transition
```

代码保持现有 production 目录内的直接模块关系。不得新增 manager、facade、adapter、workflow engine、scheduler、recovery graph、第二 store 或通用 helper 层；拆分只允许把独立且有真实消费者的同一 Runtime 职责移到窄模块。任何 Product 专属类型、reason、frontier、Prompt 或 reconstruction 不得进入 startup、credential、schema、inventory 与 Runtime quality。

## 3. 鉴权与启动硬闸门

唯一启动顺序：

```text
本仓 active dependency schema/version
  -> SQLite WAL + exact schema/index/FK/data invariants
  -> task directory read-only inventory
  -> credential parent + file lstat
  -> owner-only permissions
  -> JSON parse + schema
  -> Website-issued control_manifest_hash presence
  -> production origin
  -> Website session open exact manifest equality
  -> claim eligibility
```

任一步失败都不得继续 session、claim 或 Provider mutation。credential 不存在、父目录权限错误、文件权限错误、符号链接、JSON 损坏、schema 不完整、control manifest 缺失和 origin 非法分别输出稳定 typed code；健康与诊断只显示 code、唯一 responsible Owner、影响与恢复动作，不显示 token、credential JSON、路径内容或原生解析正文。

control_manifest_hash 只由授权的现役 Website enrollment 原子签发并写入。Runtime 不从 dependency、代码常量、Website checkout、数据库旧字段或旧 credential 推导、补写、迁移或兼容读取；失败后不启动 fallback、第二 reader 或自动修复。

## 4. 跨仓合同与业务完成

Website ai-acceptance 是唯一 provider。AGENT 三份 spec 的现役身份为：

- Agent Plugin Capability Manifest provider：version 3；
- Website Agent Task Result consumer dependency：version 5；
- Xuanxue AI Production V6 consumer dependency：version 15。

consumer dependency 的 contract body 只能包含 contractId、version、providerRepo。普通启动只校验本仓最小 dependency，不读取未绑定 Website 工作树；跨仓 participant commit 只属于 RELEASE 证据。

唯一 route projection generator 必须机械得到并逐项校验：

- 39 routes；
- 57 parameter types；
- 30 result contracts；
- 2 条含 reusable_base_reservation_ref/hash 的 reservation route；
- 每条 route 的 parameters、materials、relations、result_contract 与 Website provider 语义完全一致。

未知、缺失、额外、重复、顺序漂移或语义不等一律失败关闭。不得手写 route allowlist、第二支持表、compatibility、alias、fallback、bridge 或 shadow projection。

Website business admission receipt 只有三种互斥结构：

```text
base:
  schema_version + job_id + result_payload_hash
  + consumer_ref + outcome + consumption_hash + consumed_at

Bazi primary:
  base + bazi_domain_admission_receipt_hash
  + delivery_manifest_id + delivery_manifest_hash

review:
  base + review_receipt_hash
```

Bazi 三字段必须全有或全无；Bazi 与 review 不得混合；额外字段不允许。Runtime 使用完整结构重算 canonical consumption hash，只验证 schema、identity、结构与 hash，不解释领域内容。staged result、Provider checkpoint、Outbox delivered、terminal receipt 都不是完成；只有当前 job_id + result_hash 的 Website domain admission receipt 闭合后，本地任务才原子 completed。

## 5. 任务、attempt、Outbox 与恢复

公开任务状态只允许 failed 和 completed。failed 表示尚未完成，current_reason 说明当前权威位置；claim、lease、执行中、等待发送、等待消费和恢复都不是第三状态。

durable accept 必须先于执行并冻结 job、attempt、plugin/version、authorization、lease/grant/fence。进程重启、lease 更新、Target 变化、build 或错误码不得替换 job 或无事实依据地消耗新 attempt。若相邻 Owner 已证明 effect 为 DISPATCHED 或 CONFIRMED，Runtime 只能沿原 task/attempt 与 typed receipt 只读对账，不得盲重放。

Outbox 只有一个。任何网络发送前必须先持久 intent、确定性 idempotency key、payload hash 与当前 task/attempt binding；响应 receipt 必须先持久再推进。timeout、5xx、确定性拒绝和重启只更新同一 intent 的 last_error 与有限 next_delivery_at，不新建 intent、不丢失责任。只有 Website 精确持久化的永久业务撤权事实才能停止新发送，且必须保留原 row、payload/hash、receipt、checkpoint 与相邻 Owner 的未决现场。

同一 task 的损坏只使该 task 失败关闭；无关 task 的只读诊断与安全处理继续。Runtime 不从 Product reason 字符串、frontier、Prompt 或业务类型推断恢复动作。

## 6. SQLite 与 task-owned storage

Runtime 唯一数据库固定为六表：

- production_tasks；
- production_attempt_failures；
- production_continuations；
- production_outbox；
- production_checkpoints；
- production_leases。

首次安装只有在零张 production_* 表时才可建立当前 schema 并设置 WAL。已有任一表后，普通构造与启动只读验证精确表、列、主键、唯一索引、外键、WAL、integrity_check、foreign_key_check 与数据不变量；不得 ALTER、drop/rebuild、回填、执行 legacy migration、恢复旧调度或删除目录。数据库缺失、不可读、损坏、查询异常、记录缺失与 hash mismatch 必须分别保留，不能统一降格为 missing。

普通启动对 Runtime DB、Outbox、continuation、lease 和 task-owned plugin directory 做唯一 read-only inventory。输出稳定的目录总数、owned 数、orphan 数与 orphan bytes；读取失败、结构多义或 orphan 存在时阻断新 claim，但不自动移动、修复或删除，不建立目录台账、隐藏 tombstone、第二索引、第二表、maintenance worker 或删除协议。

物理删除不是普通启动职责。每一次删除都必须另获针对本次精确 target 的明确授权，并在执行前逐项读回：

- exact Website admission 或永久撤权；
- 无活动 lease；
- 无待发 Outbox 责任；
- 无未决 continuation；
- Browser Owner 已签发无未决 effect 事实。

任一 404、权限不足、事实缺失、hash mismatch、多义或不可读均保留现场。获准删除每个 target 后，必须逐 target 读回目录缺席，并逐项读回数据库、Outbox、receipt、checkpoint、WAL 与其它任务目录保持不变；禁止批量模糊目标、启动时清理、全局清空或不可恢复删除。

## 7. 质量系统与发布边界

agent-production-runtime 只有全仓原生 quality:check 中的一份 Manifest、一套现役 inspector/acceptance、一条 Runtime proof route 和一个最终 verdict。Manifest 的 ownedPaths 只登记 Runtime 唯一写主权；Product、GPT、Browser、Website、Runtime Log、App Shell、Startup 与历史项目方案不得由 Runtime primary-own，只能在确有接口消费时以精确 observedPaths 观察。

当前 Runtime Manifest 仍带有历史项目方案、Product/GPT/Browser acceptance 与 src/plugins/** 的旧 primary ownership；这是真实未闭合的跨 Owner 迁移，不得被本施工图文字冒充为已完成。由于本轮授权只覆盖 Runtime 内部，不能把这些路径直接删除成无 Owner，也不能替相邻域指定新 Owner。只有对应相邻 Owner 明确接纳并在同一候选原子移交后才能清除；在此之前 LAW-007 的 Manifest 完成条件与 Runtime RELEASE 必须阻断，但不授权本 Runtime CHANGE 修改相邻业务代码或建立临时第二 Manifest。

静态证据必须来自 AST、JSON、resolved import、实际 symbol consumer、合同或状态机结果；路径名、字符串包含、文件存在、fixture 数量、历史 report、self-check 或另一个裁决不得产生 PASS。Runtime acceptance 不运行 Product Flow，不启动 GPT/Browser 业务动作，不裁决内容，不要求 39 个 Website job 全量入库。

Runtime 唯一 dynamic proof 只声明：

- dynamic.service；
- dynamic.database；
- dynamic.storage；
- dynamic.authorization；
- dynamic.recovery。

proof 不输出相邻 lawId assertion，不复制相邻 Owner 证明正文。现役共享 real-proof 在 GPT、Browser、Runtime Log 各自 Owner 尚未完成动态路由解耦前，允许 Runtime 完成 CHANGE/READY 的静态与 Exam 修复，但 Runtime RELEASE 必须失败关闭；不得通过复制脚本、新建适配层、第二 proof 或改坏相邻 Owner 现役证明绕过。

CHANGE、READY、RELEASE 是不同候选阶段。Runtime 的静态或动态 PASS 不等于 Product/GPT/Browser 已生产接纳、Website 已完成业务入库、全系统 READY、RELEASE 或 SYSTEM_PROVEN。

## 8. 可重复验收不变量

每次候选都必须重新证明：

1. 八条 Runtime law、稳定 blueprintId、三份 active contractRef 与唯一 Manifest 的 lawIds 相互一致；当前越界 ownedPaths 必须作为未闭合跨 Owner 迁移显式阻断 LAW-007 完成与 RELEASE。
2. Website task-result v5、V6 v15 与 AGENT dependency 精确一致，consumer contract body 只有三字段。
3. route projection 精确为 39 routes、57 parameter types、30 result contracts、2 reservation routes。
4. base、Bazi primary、review admission receipt 的互斥字段与完整 canonical hash 全部闭合，未闭合时本地 completed 增量为零。
5. credential 失败类别分别得到稳定脱敏 typed code，且 claim/Provider mutation 增量为零。
6. startup、catalog、Runtime inspector 不包含 Product frontier、reconstruction、Prompt、Child 顺序或 Product reason 特判。
7. 六表、精确列/主键/唯一索引/外键、WAL、integrity_check、foreign_key_check 和数据不变量可重复读回；普通启动迁移与删除增量为零。
8. authority 数据库缺失、不可读、损坏/查询异常、记录缺失、hash mismatch 分别可观察并失败关闭。
9. storage inventory 在未变数据上重复得到同一目录/字节分母；dry-run 写入、移动与删除增量为零。
10. 任一物理删除都存在本次精确 target 的单独授权、全部前置事实和删除后逐 target absence/preservation readback。
11. durable accept 后的重启恢复保持同一 job、同一权威 attempt、同一 intent，无重复 Provider/Browser mutation。
12. Outbox 在网络前持久，同幂等键恢复；未获 Website 精确永久撤权时仍保留有限 next action。
13. 单 task 损坏不污染其它 task，结构不合格或 orphan storage 阻断新 claim。
14. Runtime 生产文件遵守基础法案文件与函数预算，无 type-only 环、Browser 私有 store import 或新增通用包装层。
15. Runtime Manifest 不取得相邻 Owner 或历史方案主权；任何移交先有接收 Owner 授权且原子完成，不能产生无主或重叠 Owner；Runtime quality 只有一个 checker、proof route 与 verdict。
16. Runtime proof 只声明本域五种 dynamic mode；共享 proof 未解耦时 RELEASE 阻断。
17. Runtime CHANGE/READY 不替 Website、Product、GPT、Browser 宣称业务完成；最终业务完成仍以 Website admission/storage 为准。
18. 现有唯一 inspector、acceptance、real-proof assertion map 与 governance test 必须逐一覆盖八条 active law 的 summary、全部 forbidden 和全部 evidenceModes；V31 与 V14 的生产消费清零，不新增第二 checker、proof 或 verdict。
