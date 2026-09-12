# production-runtime 生产级施工图 V36

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "agent-production-runtime-v36",
  "status": "active",
  "owner": "agent-production-runtime",
  "lawIds": [
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V53",
    "LAW-AGENT-PRODUCTION-RUNTIME-002-V6",
    "LAW-AGENT-PRODUCTION-RUNTIME-003-V23",
    "LAW-AGENT-PRODUCTION-RUNTIME-004-V23",
    "LAW-AGENT-PRODUCTION-RUNTIME-005-V23",
    "LAW-AGENT-PRODUCTION-RUNTIME-006-V25",
    "LAW-AGENT-PRODUCTION-RUNTIME-007-V25",
    "LAW-AGENT-PRODUCTION-RUNTIME-008-V26"
  ],
  "contractRefs": [
    "docs/specs/agent-production-runtime/agent-route-capability-manifest.provider.spec.json",
    "docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json",
    "docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json"
  ],
  "dependencyEdges": [
    {"contractRef":"docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json","from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"ai-acceptance","repo":"ADVISION-X/xuanxue-web"}},
    {"contractRef":"docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json","from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"ai-acceptance","repo":"ADVISION-X/xuanxue-web"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"architecture-boundary","repo":"local"}},
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
    {"from":{"domain":"agent-production-runtime","repo":"local"},"lawId":"LAW-AGENT-PRODUCTION-RUNTIME-001-V53","to":{"domain":"app-shell-ui","repo":"local"}},
    {"from":{"domain":"agent-production-runtime","repo":"local"},"lawId":"LAW-AGENT-PRODUCTION-RUNTIME-001-V53","to":{"domain":"local-app-shell","repo":"local"}},
    {"from":{"domain":"agent-production-runtime","repo":"local"},"lawId":"LAW-AGENT-PRODUCTION-RUNTIME-001-V53","to":{"domain":"startup-entrypoint","repo":"local"}}
  ]
}
```

## 1. 唯一职责与边界

agent-production-runtime 只拥有一条 product-opaque 运输与恢复主链：

```text
Website claim + lease/grant/fence
  -> Runtime durable accept
  -> Mediator 单次路由
  -> 命中的 Product Plugin 按自身 Product runtime authority 执行
  -> staged result
  -> Runtime durable Outbox intent
  -> Website domain consumer admission
  -> Runtime 校验 admission receipt
  -> local completed
```

| Runtime 运行职责 | 只通过 typed interface 消费 | 明确不拥有 |
|---|---|---|
| credential read、session、claim、durable accept、attempt、lease/fence | Website control intent、claim/grant/fence、business admission receipt | Website 业务准入、任务创建、领域入库、公开状态 |
| Runtime 当前授权的运输、lease/fence 与 typed failure | Browser effect WAL、GPT 当前 Child 结果 | Product 静态 Flow、Prompt、模型、Child 顺序与结果组装 |
| product-opaque failure、健康与诊断安全投影 | Runtime Log 的单写者接口 | Browser 私有 WAL、Target/Document、Runtime Log 事实正文 |
| 唯一 Runtime inspector、acceptance 与 Runtime-only proof | 相邻能力权威已签发的 typed receipt，不复制证明正文 | 第二 checker、proof、queue、store、receipt、verdict 或兼容链 |

Manifest primary Owner 只表示路径治理。Product runtime authority 只拥有静态 Flow、Prompt、模型、Child 顺序与结果组装，不拥有 Website 恢复决定或 Provider session store。Runtime 只做当前 task/attempt 的 typed 转交；Website Bazi sender 唯一提供已入库且精确绑定的父报告材料，GPT 只执行当前 turn，Browser 唯一拥有 WAL 与 FIFO。

`business_recovery_decision_owner_count = 1`，唯一 Owner 是 `Website.ai-acceptance`。mutation_outcome=no 时 Website 可结束旧 attempt 并有限退避后签发新 attempt；DISPATCHED/CONFIRMED 时保留同一 accepted attempt 并只授权同 effect 跨进程读回，physical submit 增量恒为零；Website 明确拒绝已取得结果后，可签发新 result revision。旧 fence 的迟到写请求全部拒绝。

`TOMBSTONE-RECOVERY-AUTHORITY-001` 继续固定 Website 是未删除需求的唯一业务恢复决策 Owner；八字新业务任务只消费 Website 已入库并精确绑定的父报告材料，且每次从 clean GPT chat 执行；跨任务 Provider conversation、continuation store/frontier/CAS 物理不存在。已确认 Provider effect 跨进程只能读取同一结果且物理 submit 增量恒为零；private base、fork、兼容桥及第二恢复链恒为零。

Runtime 对外只发布 Agent Route Capability Manifest。它从 Mediator 取得冻结、不可变、纯数据的 `product_id + action_id + task_contract_version + result_contract_version` 路由集合，随后在本域校验 Manifest schema/hash并用于当前 session attestation 与 claim 资格。Product Plugin 名称、版本、Skill hash 与 Catalog 实现身份不得进入 Website job、request、accepted attempt、grant、result、artifact、terminal 或 Browser effect；Runtime 源码不得直接或间接取得 `ProductPlugin` 实例、Product Skill 正文、`parseResult`、`assemblePayload` 或其它 Product 可执行回调；Product Plugin 也不得 import、re-export、dynamic import 或 side-effect import Runtime 私有模块。

Product、GPT、Browser、Forensics、Runtime Log、App Shell、Startup、Website 继续由各自 active law、blueprint、spec 与唯一 Manifest primary Owner 守住文件及接口边界。Runtime 文档只记录上表接口边，不复制其业务流程、DOM、模型策略、Provider 操作或发布裁决。

GPT 页面 selector 的语义冻结只属于 GPT Child，Browser 只机械执行 typed query，Runtime 只消费 Child terminal。mutation 前是否自动选中精确 system Tab、激活后的 Target/Document 重验、输入前 activation generation 与 `BROWSER_TARGET_NOT_INTERACTIVE` 结算都只属于 Browser Authority；Runtime 不接收 tabId、不调用激活/窗口聚焦、不读取 Browser 私有状态，也不建立第二 precondition、WAL、恢复或重试。该变更不得进入 Runtime 配置、Manifest 字段或跨仓合同；Website 任务、Outbox、artifact receipt 与 business admission receipt 主链保持不变。

## 2. 真实调用方向与内部结构

调用方向以 caller/dependent 指向 provider：

```text
App Shell / Local App Shell / Startup ----------------> Runtime
Runtime --task-result + V6 contracts------------------> Website ai-acceptance
Runtime ----------------------------------------------> GPT public facade
Runtime ----------------------------------------------> Forensics public port
Runtime ----------------------------------------------> Browser typed effect receipt
Runtime ----------------------------------------------> Runtime Log single writer
Runtime --plain identity + opaque execution-----------> Architecture-owned Mediator
```

Agent Route Capability Manifest 是 Runtime 对外发布的 provider surface，不是 Runtime 自身的 dependency edge；它保留在本施工图 contractRefs，Website consumer 必须在 Website 所属施工图声明 ai-acceptance → Runtime 的消费边。AGENT 不伪造远端 consumer dependency，也不把 provider 发布方向误写为本地调用方向。Manifest publisher 只能消费 Mediator 返回的纯数据 route snapshot，不得 import Product 源码或通过 re-export、callback、plugin object 绕回 Product runtime authority。
Runtime 不得反向依赖 App Shell、Local App Shell 或 Startup。Browser 私有 store 不进入 Runtime；若 Runtime 需要 Browser 事实，只能消费 local-browser-session 对外公开的 typed authority/receipt。架构基础法案是治理约束，不伪装成运行 dependency edge。

附件链只增补这一条已有公开 dependency edge 的生产调用：Runtime 在 Website material 下载、SHA-256 和 bytes 校验完成后，仅把 `{artifactRef, localPath, sha256, bytes}` 作为 task-owned 临时材料绑定到当前 job/attempt/execution，并在同一 binding 上提供只能为该 artifact 建立/清理 Provider 上传别名的 Runtime-owned 窄化 materializer。GPT 仍是 `providerDisplayName` 算法的唯一语义 Owner；Browser 只机械验证其为安全 NFC basename，再调用该 materializer。Runtime 只在原 task-owned 材料目录以 hardlink 建立精确 basename 别名，不改变原 bytes/hash；同名已存在时只在与原材料同 inode、hash、bytes 时幂等复用，hardlink 不可用或任一身份不等均 typed fail-close，禁止 copy fallback。Browser 继续使用现有唯一 resolver 重验 exact basename、realpath、regular-file、hash 和 bytes 后签发 execution-scoped grant；settle/abort 由 Browser release 触发 Runtime 清理别名，过程不新增目录、表、registry、resolver 或 store。Product 只可在当前进程内单次 dispatch 的既有 `LocalProductionMaterial` 中读取本 Product 材料的 task-owned `local_path`，用于 Product 自有解析，不得拥有其生命周期、持久化/记录路径或把路径传入 GPT/Browser；GPT 永不获得 `localPath`，Product 也不得调用 Browser 附件绑定。同 attempt 已有唯一 verified `CONFIRMED` attach 时只读对账，不再 materialize 或上传。进程重启后 Browser 映射为空，由 Runtime 从 Website durable truth 重建；禁止 Browser 私有复制、持久 registry、第二 resolver/store、兼容桥或 dual path。

内部唯一分层：

```text
credential + contract preflight
  -> store foundation + read-only storage inventory
  -> cloud session + claim
  -> durable accept + execution binding
  -> Product identity resolution + mediator single dispatch
  -> Product 经产品中性 Runtime 上传端口取得 typed artifact receipt
  -> Product 自有 parser/assembly 形成 data-only final output
  -> reconciliation + single Outbox
  -> Website receipt verification
  -> local terminal transition
```

同一 worker session 的 heartbeat 换代与 claim 必须由现有 `ProductionWorkerSession` 在一条 session-authority 串行边界内闭合。Runtime 从读取新鲜 attestation、冻结与其同代的 credential/receipt hash，到 Website 返回该 claim 的持久回执之前，不得让另一次 heartbeat 推进 token generation 或 latest attestation；定时 heartbeat 与即时 freshness refresh 必须共用该边界。`activeHeartbeat` 只能合并同一 heartbeat，不能代替 claim 临界区。出现 `ATTESTATION_STALE_OR_MISMATCHED` 必须失败关闭并保留原生 reason，禁止接受 previous attestation、延长 TTL、blind retry、fallback、dual-read 或第二 session controller。

Runtime 自身代码保持 production 目录内的直接模块关系。不得新增 manager、facade、adapter、workflow engine、scheduler、recovery graph、第二 store 或通用 helper 层；拆分只允许把独立且有真实消费者的同一 Runtime 职责移到窄模块。credential、session、grant、fence、业务准入与 durable authorization 在进入 Mediator 前已由 Runtime 闭合；Mediator 只做 Product identity resolution 与完成本次 Owner 归位不可分割的单次 dispatch，不准备 transport、不保存业务恢复状态、不调用 Product parser/assembly，也不建立第二 registry、第二 executor 或通用工作流。Runtime 把现有产品中性 GPT 工具、materials、completion 与 artifact upload 端口作为本次单次 dispatch 的 context 传入；Product 在该调用内取得 typed receipt、完成自身解析和组装，再只把 data-only final output 交回 Runtime。任何 Product 专属类型、reason、Prompt 或 reconstruction 不得进入 startup、credential、schema、inventory 与 Runtime quality；GPT 不保存跨业务任务的 conversation、checkpoint、frontier 或其它 opaque state。

## 3. 鉴权与启动硬闸门

唯一启动顺序：

```text
本仓 active dependency schema/version
  -> SQLite WAL + exact schema/index/FK/data invariants
  -> task directory read-only inventory
  -> credential parent + file lstat
  -> owner-only permissions
  -> JSON parse + schema
  -> production origin
  -> Website session open exact control_contract_version equality
  -> claim eligibility
```

任一步失败都不得继续 session、claim 或 Provider mutation。credential 不存在、父目录权限错误、文件权限错误、符号链接、JSON 损坏、schema 不完整、origin 非法和 control contract version 不相等分别输出稳定 typed code；健康与诊断只显示 code、唯一 responsible domain、影响与恢复动作，不显示 token、credential JSON、路径内容或原生解析正文。

授权 enrollment 只建立或恢复长期 device identity 与 credential，不签发整份 manifest hash，不因合同升级重建 device。Runtime 只从本仓唯一 active consumer dependency 读取 `control_contract_version`，在 session open 时发送；Website 必须与自身当前 provider contract version 精确比较，并在 session、claim grant 与 execution fence 返回同一版本。版本不相等只产生一次 typed 409 并保持 Execution blocked，不允许定时重试、fallback、第二 reader、自动 enrollment 或旧凭据回退。

## 4. 跨仓合同与业务完成

Website ai-acceptance 是唯一 provider。AGENT 三份 spec 的现役身份为：

- Agent Route Capability Manifest provider：version 4；只发布 current session 支持的 `product_id + action_id + task_contract_version + result_contract_version`；Product Profile、Skill、Prompt、Flow、实现名称、版本和 hash 均不得对外发布或参与任务身份；
- Website Agent Task Result consumer dependency：version 7；
- Xuanxue AI Production V6 consumer dependency：version 25。Runtime 只消费 Website 当前授权、有限 `retry_not_before`、三个 next action、typed effect outcome 与 admission receipt；不得自行推导业务恢复。

consumer dependency 的 contract body 只能包含 contractId、version、providerRepo。普通启动只校验本仓最小 dependency，不读取未绑定 Website 工作树；跨仓 participant commit 只属于 RELEASE 证据。

唯一 route projection generator 必须机械得到并逐项校验：

- 40 routes；
- 47 parameter types；
- 31 result contracts；
- 0 条 reservation route；
- 每条 route 的 parameters、materials、relations、result_contract 与 Website provider 语义完全一致。

未知、缺失、额外、重复、顺序漂移或语义不等一律失败关闭。新增的唯一固定 catalog route 是 `localization_static_catalog + produce_locale_catalog`，仍由现有 `localization-production` Product Plugin 私有执行，不新增 Plugin、Runtime、队列、公开 candidate/selector action 或第二恢复链。不得手写 route allowlist、第二支持表、compatibility、alias、fallback、bridge 或 shadow projection。

`FROZEN-PUBLIC-KNOWLEDGE-PROVIDER-FORMAT-ONLY-001` 固定：Public Knowledge 的 Provider 可见输出格式只来自 Website 唯一 canonical `result_contract` 的机械投影，Product 只把当前 research/article 子合同原样写进 exact Prompt。该合同只约束交付结构、字段类型、枚举、引用 identity/marker 关系与 Markdown 语法，不得规定选题结论、分析方法、推理过程、观点立场、证据解释或图片创意；Product Skill 正文不得注入 Provider Prompt，AGENT 不得复制、扩写或另建格式/质量 validator，不得重塑 Provider 输出字段类型或追加第二 reception sidecar。改变或删除本冻结边界，必须由用户在未来任务中明确解冻并同步替换双仓施工图、合同、实现与唯一质检。

Website 在签发任务前唯一判断业务参数值是否合法。Runtime 先把 product_id/action_id 解析为有界字符串，再按 current route projection 与 Route Capability Manifest 精确解析；grant 不再冻结或比较任何 Product Plugin 身份。除此之外 Runtime 只校验 authenticated session/claim/grant/fence、task wire/schema/hash、当前 contract/projection/control contract version，以及 route/key/material/relation/result-contract 与当前 projection 的机械一致性；不得保存 `bazi_analysis_kind`、locale、localization resource kind、Product package/version 或 Bazi reusable candidate 的业务白名单，不得按 action 名推导 review/continuation，不得维护 `routeProducesGeneratedImage`、手写 Product/Action 支持表或硬编码 primary 数量。Product Plugin 通过 Product-facing execution contract 取得当前 task、materials、当前 Website route policy 与 GPT public facade，只校验完成自身执行所必需的局部 artifact、Skill 与 result 组装前置，不复判 Website 业务资格，也不读取 Runtime 私有 transport、store、lease、Outbox 或 recovery 模块。

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

Bazi 三字段必须全有或全无；Bazi 与 review 不得混合；额外字段不允许。Runtime 使用完整结构重算 canonical consumption hash，只验证 schema、identity、结构与 hash，不解释领域内容。staged result、Outbox delivered、terminal receipt 都不是完成；只有当前 job_id + result_hash 的 Website domain admission receipt 闭合后，本地任务才原子 completed。

## 5. 工单、Provider effect 与唯一恢复决策

Website 永久保存同一 `job_id + request_hash + 冻结业务 task`。公开状态只有 `failed` 和 `completed`；未入库且未撤权时 `demand_active=true`。

一次 accepted attempt 只执行 Website 当前授权的精确 effect/result：

```text
Website 签发 attempt + lease + fence
-> Runtime durable accept
-> Product 从第一入口执行
-> Browser 对同一 provider_effect_identity 跨 attempt/进程最多 physical dispatch 一次
-> AGENT 得到完整结果或 typed failure
-> 完整结果只形成一个 payload identity，并经唯一 Outbox 幂等交付
-> Website 领域事务入库并签发 admission receipt，才 completed
```

执行失败后 Runtime 只报告 typed outcome，Website 唯一裁决：明确未发送则有限退避后签发新 attempt；DISPATCHED/CONFIRMED 则保留同一 accepted attempt，换 lease/fence 也只能读回同一 effect；结果已取得但明确拒绝时可签发新 result revision。新 revision 使用新的 request/payload identity，并从 Website 本轮重新下发的完整业务材料在 clean GPT chat 执行。

Browser provider effect identity 不含 Product Plugin 或 `attempt_id`，固定由 `job_id + result_revision + product_step_id + call_id + child_id + request_hash + payload_hash` 组成。AGENT 内部实现、attempt、进程、lease、fence、Target、Document 变化不得制造新 effect；同一 identity 的 physical dispatch 总数至多一。每次 mutation 与 Website 写请求仍校验当前 fence，旧 fence 的迟到写请求全部拒绝。

AGENT 不建立通用 checkpoint、跨任务 Provider session state 或第二恢复状态机。Browser 唯一 WAL 的同一 provider-effect 行只提供 at-most-once 与同-effect confirmed readback 所需加密 locator；Runtime 唯一 Outbox 只幂等交付同一 result。Website 以自身 staging、领域入库与 admission receipt 为准，已完整 staging 的结果继续由 Domain Consumer 入库，不回退 AGENT。

`FROZEN-WORK-ORDER-HARD-DELETE-001` 冻结：管理员删除意味着 Website 业务需求不存在。Website 按 exact Work Order 物理删除其全部数据库行与私有对象，不保留 tombstone、cancel、archive、receipt 或在途 admission；AGENT 对已接受 job 的 Website absence 按 exact job_id 清除本地 task、Outbox、材料、结果、Browser WAL 与 Forensics artifact，停止所有轮询、交付和外部结果复用。已真实发送到外部 Provider 的消息及 Provider 自有日志、备份不在本系统可保证删除范围，但不得再读取、接纳或入库。只有授权人再次明确解冻并同步替换双仓法案、施工图、合同、实现与质检，才可改变本边界。

付款、发布、删除、发货与正式业务记录修改不得放在可废弃 attempt 内；它们只在 Website 最终领域事务中按 `job_id` 幂等执行。禁止 recovery manager、planner、workflow、recovery queue、fallback、compatibility、legacy、bridge、shadow、第二 scheduler/store/state machine。

## 6. SQLite 与 task-owned storage

Runtime 唯一数据库只保留两表：

- production_tasks；
- production_outbox。

`production_tasks` 不保存 Product Plugin 名称、版本、Skill hash、Catalog hash、checkpoint schema 或执行位置；业务请求身份直接来自其 Website task 中的 job_id、product_id、action_id、task/result contract 与 request_hash。Browser WAL 只保存物理 mutation terminal、result_revision 与同一 effect 的加密 canonical conversation URL，且 plugin 字段数为零。Runtime、GPT 与 Browser 均不保存跨任务 consultation identity、source task、checkpoint、frontier 或 Provider conversation；Website 父子关系和已入库父报告只通过本轮业务 task/material 传入。

首次安装只有在零张 production_* 表时才可建立当前两表 schema 并设置 WAL。已有任一表后，普通构造与启动只读验证精确表、列、主键、唯一索引、外键、WAL、integrity_check、foreign_key_check 与数据不变量。`production_leases` 与任何 Website lease/fence 镜像必须物理不存在；Runtime 只消费当前 Website grant/renew，并以进程内单调预算停止过期执行。Runtime 不因本次施工新增表或迁移入口；Browser WAL 只做自身现役 schema 的单向扩展且不保留旧新双读写。数据库缺失、不可读、损坏、查询异常、记录缺失与 hash mismatch 必须分别保留。

普通启动对 Runtime DB、Outbox 和 task-owned plugin directory 做唯一 read-only inventory。输出稳定的目录总数、owned 数、orphan 数与 orphan bytes；读取失败、结构多义或 orphan 存在时阻断新 claim，但不复制 Website lease/fence，不自动移动、修复或删除，不建立目录台账、隐藏 tombstone、第二索引、第二表、maintenance worker 或删除协议。

普通启动不得模糊清理。Runtime 只在自己已经 durable accept 的 exact job 后续被 Website 权威读回为不存在时，取得该 job 的唯一删除授权；必须按 job_id 同步清除本地 task、Outbox、task-owned 目录、Browser WAL 与 Forensics artifact，并逐项证明目标缺席、其它 job 保持不变。不得保留永久撤销状态、删除队列、删除台账、归档或兼容路径。

## 7. 质量系统与发布边界

agent-production-runtime 只有全仓原生 quality:check 中的一份 Manifest、一套现役 inspector/acceptance、一条 Runtime proof route 和一个最终 verdict。Manifest 的 `ownedPaths` 只登记 Runtime 自身的 Manifest primary ownership；Product、GPT、Browser、Website、Runtime Log、App Shell、Startup 与历史项目方案不得由 Runtime primary-own，只能在确有接口消费时以精确 `observedPaths` 观察。

某一候选只有另获 AGENT 内相邻域原子归位明确授权后才可施工，且文字授权不等于已完成。法案、Inspector、测试、proof 与混合文件必须先在同一未提交 CHANGE 候选中准备完成；所有接收域与 Runtime 的 `ownedPaths` 在此期间保持原值。文件拆分完成后只允许一次原子修改：architecture-boundary 在已拥有的 Mediator/Product 边界内接收 `src/mediator/product-plugin-catalog.ts` 与 `src/mediator/product-plugin-contract.ts`，保留已归位的 `src/mediator/agent-production-route.ts`；agent-production-runtime 同时物理删除旧 Product-facing `plugin.ts` 和全部旧 import 边，而不是删除真实消费者。旧文件内容只按以下唯一映射归位：Product 类型、执行 context、产品中性 checkpoint/fault receipt 与结果校验 primitives 进入 `product-plugin-contract.ts`；12 个 Product 的唯一 composition、Skill 读取/hash、route identity 与单次 dispatch 进入 `product-plugin-catalog.ts`；artifact upload、Outbox、transport receipt 与 envelope 继续留在 Runtime；业务 parser/assembly 继续留在各 Product。现役 provider spec 已绑定的 `catalog.ts#agentPluginCapabilityManifest` 原位删除旧 Product imports、Plugin object、Skill text 与 route registry，只保留 Runtime 自有的 product-opaque Manifest publisher。不得再建立第三个 common/helper/adapter 层。其它相邻域只有在当前候选真实涉及其 Owner 路径时才参与。随后立即重建唯一 registry 并证明 `UNOWNED_PRODUCTION_FILE=0`、`MULTIPLE_PRIMARY_OWNERS=0` 与 Runtime manifest-owner-drift=0。不得先接收、先删除、建立临时第二 Manifest、兼容 re-export 或形成中间 READY/RELEASE 候选。

静态证据必须来自 Manifest Owner、AST、JSON、resolved import、实际 symbol consumer、合同或状态机结果；路径名、字符串包含、文件存在、fixture 数量、历史 report、self-check 或另一个裁决不得产生 PASS。检查器必须拒绝任一 Runtime-owned source 对 `src/plugins/**` 的 direct/re-export/dynamic/side-effect import、任一 Product source 对 Runtime 私有模块的反向 import，以及通过旧 Catalog、alias 或中转模块形成的同义边；不得再为 `src/lib/local-runtime/**` 或旧 Catalog 设置豁免。Runtime acceptance 不运行完整 Product Flow，不启动 GPT/Browser 业务动作，不裁决内容，不要求 40 个 Website job 全量入库。现有 Product/Runtime acceptance 必须用确定性 stub 证明 generated-image 的同一 artifact intent 只上传一次、Product 只在取得真实 typed receipt 后组装并执行 final parse、Runtime 收到的 final output 不含 `assemblePayload`、`parseResult` 或 Plugin object。现有 Architecture/Runtime acceptance 还必须从唯一 architecture Catalog snapshot 机械逐字段投影并证明 provider v4 Route Capability Manifest 的 schema、product/action route、task/result contract version 与 canonical route hash 精确一致，并证明跨仓及持久身份中的 Product Plugin 名称、版本与 Skill hash 为零。`architecture-boundary` 的 Exam 只能从 architecture-owned 唯一 Catalog、Runtime 发布的 Route Capability Manifest 与 `scripts/acceptance/product-plugins/**` 发现 route、证明一一对应、执行并汇总各 Product 自有测试；中央入口不得手写 Product Plugin 或 primary product/action 列表，不得保存任一 Product 的 Prompt、Child 顺序、checkpoint、分支、恢复规则或 expected result body，生产 `src/plugins/**` 不得 import 测试代码。

Runtime 唯一 dynamic proof 只声明：

- dynamic.service；
- dynamic.database；
- dynamic.storage；
- dynamic.authorization。

Runtime proof 不输出相邻 lawId assertion，不复制相邻能力权威的证明正文。GPT、local-browser-session、runtime-log-spine 与 agent-production-runtime 必须分别由原生 proof 独立启动、只声明自身 lawId、只读取自身持久真相或相邻域正式 typed receipt；不得读取另一 proof 的 assertion，不得要求共享 Website job、Chrome journey 或时间线，也不得建立 journey coordinator、proof bus、共享 scenario、共享 assertion map、适配层或第二 proof。动态路由未全部归位前 Runtime RELEASE 必须失败关闭。

CHANGE、READY、RELEASE 是不同候选阶段。Runtime 的静态或动态 PASS 不等于 Product/GPT/Browser 已生产接纳、Website 已完成业务入库、全系统 READY、RELEASE 或 SYSTEM_PROVEN。

## 8. 可重复验收不变量

每次候选都必须重新证明：

1. 八条 Runtime law、稳定 blueprintId、三份 active contractRef 与 Runtime 唯一 Manifest 的 lawIds 相互一致；Architecture Boundary law 与 Manifest 独立保持其现役一一对应；越界 `ownedPaths` 只在同一候选的一次原子修改中归位，并立即证明无无主、无重叠、无 Runtime manifest-owner-drift。
2. Website task-result v8、V6 v25 与 AGENT dependency 精确一致；grant 不携带 Provider locator/checkpoint 或 Product Plugin 身份，只绑定当前 task/attempt/lease/fence；八字仅携带 consultation_root_ref 与 direct parent，明确新 result revision 才可携带 hash-bound rejection。
3. route projection 精确为 40 routes、47 parameter types、31 result contracts、0 reservation routes；bazi_private_base_input 与 result_contract.private_base 为零。
4. base、Bazi primary、review admission receipt 的互斥字段与完整 canonical hash 全部闭合，未闭合时本地 completed 增量为零。
5. credential 失败类别分别得到稳定脱敏 typed code，且 claim/Provider mutation 增量为零。
6. Runtime-owned source 对 Product Plugin 的 direct/re-export/dynamic/side-effect import 为零；Product source 对 Runtime 私有 production module 的 import 为零；唯一 architecture-owned Catalog 与 Runtime Manifest publisher 只以冻结纯数据 route snapshot 连接，provider v4 Route Capability Manifest 只含 product/action 与 task/result contract version，跨仓及持久身份的 Product Plugin 名称、版本、Skill hash 字段为零。
7. Runtime 两表、精确列/主键/唯一索引/外键、WAL、integrity_check、foreign_key_check 和数据不变量可重复读回；`production_leases`、`production_gpt_consultations`、旧 `production_continuations` 与任何 GPT continuation store 均不存在；Browser WAL 不含 consultation identity、source task、continuation checkpoint 或 frontier，只保留执行 fence、effect terminal 与同-effect加密 locator；private base、reservation、fork、第二 lane/store 与 Product checkpoint 消费者为零；Runtime 普通启动迁移与删除增量为零。
8. authority 数据库缺失、不可读、损坏/查询异常、记录缺失、hash mismatch 分别可观察并失败关闭。
9. storage inventory 在未变数据上重复得到同一目录/字节分母；dry-run 写入、移动与删除增量为零。
10. Website Work Order 管理员删除必须按 exact identity 无条件物理清除本系统持有的全部关联行与私有对象；AGENT 对已接受 job 的 Website absence 必须清除本地 task/Outbox/material/result/Browser WAL/Forensics，并逐 target 证明缺席和其它 job 保持不变。
11. durable accept 后进程重启必须由 Website 决策：mutation_outcome=no 可新 attempt；新 attempt 必须在现役 Target/current Document 重建 fresh/profile/model/menu/附件/Composer 等 target-local 准备，批准附件集合允许为空。只有 submit 是跨 attempt 稳定的 provider effect；DISPATCHED/CONFIRMED 必须保留同一 effect 且 submit 增量为零，并在任何准备动作前按精确 WAL 事实进入只读结果收敛。submit request hash 绑定现有 result revision 与 Child input hash；仅换 attempt 不变，新 result revision 必须变化。
12. 当前完整结果只按 `job_id + attempt_id + result_hash` 经唯一 Outbox 幂等交付；回复不明先查询 Website staging、领域入库与 admission receipt，不重做 Provider，第二 Outbox 或 delivery flusher 为零。
13. 失败、失联、lease 失效、结果不明和领域拒绝均只产生 typed facts；Website 唯一选择未发送后的新 attempt、同 effect 只读收敛或明确拒绝后的新 result revision。旧 fence 的 renew、artifact、result、terminal、completion 全部被拒绝。
14. 单 task 损坏不污染其它 task，结构不合格或 orphan storage 阻断新 claim。
15. Runtime 生产文件遵守基础法案文件与函数预算，无 type-only Owner 环、Product object/callback 泄漏、Browser 私有 store import 或新增通用包装层。
16. Runtime Manifest 不取得相邻域或历史方案的 Manifest primary ownership；唯一一次原子归位不能产生无主或重叠 Manifest primary Owner；Runtime quality 只有一个 checker、proof route 与 verdict。
17. Runtime proof 只声明本域四种 dynamic mode；GPT、Browser、Runtime Log 的原生 proof 均可独立运行，Runtime 相邻 proof assertion 为零，任何未解耦 route 都阻断 RELEASE。
18. Runtime CHANGE/READY 不替 Website、Product、GPT、Browser 宣称业务完成；最终业务完成仍以 Website admission/storage 为准。
19. 各域现有唯一 inspector、acceptance 与适用 proof 分别覆盖本域 active law 的 summary、全部 forbidden 与全部 evidenceModes；Owner-bound import mutant 必须证明 Runtime→Plugin、Plugin→Runtime private 与旧 Catalog 豁免都会失败关闭，全部被替代路径的生产消费清零，不新增第二 checker、proof 或 verdict。
19. 五个并发真实业务任务必须逐个取得唯一 Browser lane 时间片；每项只保留 `页面动作 -> 一次结果 artifact -> Product result` 的必要事实。无饥饿、Provider submit 无重复，且每个任务最终以 Website 自身的 business admission receipt 与持久化读回作为完成证据。八字另须证明 BZ05/BZ03/BZ04 每个业务任务均 fresh，BZ03/BZ04 精确消费本轮 Website 父报告材料，跨任务 continuation/controller/store/frontier/CAS、fork 与 private base 为零。
