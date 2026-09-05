# production-runtime 生产级施工图 V22

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "agent-production-runtime-v22",
  "status": "active",
  "owner": "agent-production-runtime",
  "lawIds": [
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V40",
    "LAW-AGENT-PRODUCTION-RUNTIME-002-V2",
    "LAW-AGENT-PRODUCTION-RUNTIME-003-V8",
    "LAW-AGENT-PRODUCTION-RUNTIME-004-V8",
    "LAW-AGENT-PRODUCTION-RUNTIME-005-V8",
    "LAW-AGENT-PRODUCTION-RUNTIME-006-V8",
    "LAW-AGENT-PRODUCTION-RUNTIME-007-V8",
    "LAW-AGENT-PRODUCTION-RUNTIME-008-V9"
  ],
  "contractRefs": [
    "docs/specs/agent-production-runtime/agent-plugin-capability-manifest.provider.spec.json",
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
    {"from":{"domain":"agent-production-runtime","repo":"local"},"lawId":"LAW-AGENT-PRODUCTION-RUNTIME-001-V40","to":{"domain":"app-shell-ui","repo":"local"}},
    {"from":{"domain":"agent-production-runtime","repo":"local"},"lawId":"LAW-AGENT-PRODUCTION-RUNTIME-001-V40","to":{"domain":"local-app-shell","repo":"local"}},
    {"from":{"domain":"agent-production-runtime","repo":"local"},"lawId":"LAW-AGENT-PRODUCTION-RUNTIME-001-V40","to":{"domain":"startup-entrypoint","repo":"local"}}
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
| Runtime 六表、WAL、Outbox、task-local recovery、storage inventory | GPT/Browser/Forensics 的公开 effect/evidence/authority receipt | Product Flow、Prompt、模型、Child 顺序、内容裁决 |
| product-opaque failure、健康与诊断安全投影 | Runtime Log 的单写者接口 | Browser 私有 WAL、Target/Document、Runtime Log 事实正文 |
| 唯一 Runtime inspector、acceptance 与 Runtime-only proof | 相邻能力权威已签发的 typed receipt，不复制证明正文 | 第二 checker、proof、queue、store、receipt、verdict 或兼容链 |

Manifest primary Owner 只表示路径登记、结构检查与变更准入；Product runtime authority 才表示 Prompt、模型、Child 顺序、分支、checkpoint、恢复与结果组装的决策权。`architecture-boundary` 仍只 primary-own Product 源码、与生产 import surface 分离的 Product 验收、薄 Mediator 与精确关联项目文档；唯一 Catalog composition 和 Product-facing execution contract 是现有薄 Mediator/Product 源码边界的组成文件，不新增 Owner 类别或运行权力。只有该 Catalog composition 可以导入 `src/plugins/<plugin-id>/index.ts`，且它只按 `product_id + action_id + contract version` 完成一次路由；每个 Product Plugin 仍是自身唯一 Product runtime authority。Runtime 对以上两种权力均不得越权。

Runtime 对外发布 Agent Plugin Capability Manifest，但不拥有形成该清单的 Product composition。它只从 Mediator 取得冻结、不可变、纯数据的 `plugin_id + plugin_version + skill_hash + checkpoint_schema_version + accepts` 描述，随后在本域校验 Manifest schema/hash 并用于 session、claim、durable identity 与诊断。Runtime 源码不得直接或间接取得 `ProductPlugin` 实例、Product Skill 正文、`parseResult`、`assemblePayload` 或其它 Product 可执行回调；Product Plugin 也不得 import、re-export、dynamic import 或 side-effect import Runtime 私有模块。

Product、GPT、Browser、Forensics、Runtime Log、App Shell、Startup、Website 继续由各自 active law、blueprint、spec 与唯一 Manifest primary Owner 守住文件及接口边界。Runtime 文档只记录上表接口边，不复制其业务流程、DOM、模型策略、Provider 操作或发布裁决。

GPT 页面 selector 的语义冻结只属于 GPT Child，Browser 只机械执行 typed query，Runtime 只消费 Child terminal；本次 source-turn “更多操作”入口实证修正不得进入 Runtime 配置、Manifest 字段、第二 selector registry 或恢复分支，也不得触碰已冻结的 PRO/PLUS 模型与推理兼容语义。

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

Agent Plugin Capability Manifest 是 Runtime 对外发布的 provider surface，不是 Runtime 自身的 dependency edge；它保留在本施工图 contractRefs，Website consumer 必须在 Website 所属施工图声明 ai-acceptance → Runtime 的消费边。AGENT 不伪造远端 consumer dependency，也不把 provider 发布方向误写为本地调用方向。Manifest publisher 只能消费 Mediator 返回的纯数据 Catalog snapshot，不得 import Product 源码或通过 re-export、callback、plugin object 绕回 Product runtime authority。
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

Runtime 自身代码保持 production 目录内的直接模块关系。不得新增 manager、facade、adapter、workflow engine、scheduler、recovery graph、第二 store 或通用 helper 层；拆分只允许把独立且有真实消费者的同一 Runtime 职责移到窄模块。credential、session、grant、fence、业务准入与 durable authorization 在进入 Mediator 前已由 Runtime 闭合；Mediator 只做 Product identity resolution 与完成本次 Owner 归位不可分割的单次 dispatch，不准备 transport、不保存执行状态、不调用 Product parser/assembly，也不建立第二 registry、第二 executor 或通用工作流。Runtime 把现有产品中性 GPT 工具、materials、completion 与 artifact upload 端口作为本次单次 dispatch 的 context 传入；Product 在该调用内取得 typed upload receipt、完成自身解析和组装，再只把 data-only final output 交回 Runtime 运输。任何 Product 专属类型、reason、frontier、Prompt 或 reconstruction 不得进入 startup、credential、schema、inventory 与 Runtime quality。

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

任一步失败都不得继续 session、claim 或 Provider mutation。credential 不存在、父目录权限错误、文件权限错误、符号链接、JSON 损坏、schema 不完整、control manifest 缺失和 origin 非法分别输出稳定 typed code；健康与诊断只显示 code、唯一 responsible domain、影响与恢复动作，不显示 token、credential JSON、路径内容或原生解析正文。

control_manifest_hash 只由授权的现役 Website enrollment 原子签发并写入。Runtime 不从 dependency、代码常量、Website checkout、数据库旧字段或旧 credential 推导、补写、迁移或兼容读取；失败后不启动 fallback、第二 reader 或自动修复。

## 4. 跨仓合同与业务完成

Website ai-acceptance 是唯一 provider。AGENT 三份 spec 的现役身份为：

- Agent Plugin Capability Manifest provider：version 3；authorityArtifact 路径、selector 与 provider spec 只定义 Manifest 的规范字段和 schema。任一 Product Profile/Skill/执行语义变化必须提升对应 `plugin_version` 并重算 canonical catalog hash；只有 Manifest 规范字段或 schema 变化才提升 provider spec version，禁止用旧 Plugin identity/hash 掩盖语义变化；
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

Website 在签发任务前唯一判断业务参数值是否合法。Runtime 先把 product_id/action_id 解析为有界字符串，再按 current route projection 精确解析；Mediator 返回的纯数据 Plugin identity、Runtime 发布的 Capability Manifest 与 Website 冻结的 claim identity 必须精确匹配。除此之外 Runtime 只校验 authenticated session/claim/grant/fence、task wire/schema、request hash、当前 contract/projection/control manifest identity，以及 route/key/material/relation/result-contract 与当前 projection 的机械一致性；不得保存 `bazi_analysis_kind`、locale、localization resource kind、Product package/version 或 Bazi reusable candidate 的业务白名单，不得按 action 名推导 review/continuation，不得维护 `routeProducesGeneratedImage`、手写 Product/Action 支持表或硬编码 primary 数量。Product Plugin 通过 Product-facing execution contract 取得当前 task、materials、当前 Website route policy 与 GPT public facade，只校验完成自身执行所必需的局部 artifact、Skill/checkpoint 与 result 组装前置，不复判 Website 业务资格，也不读取 Runtime 私有 transport、store、lease、Outbox 或 recovery 模块。

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

durable accept 必须先于执行并冻结 job、attempt、plugin/version、authorization、lease/grant/fence。进程重启、lease 更新、Target 变化、build 或错误码不得替换 job 或无事实依据地消耗新 attempt。若相邻能力权威已证明 effect 为 DISPATCHED 或 CONFIRMED，Runtime 只能沿原 task/attempt 与 typed receipt 只读对账，不得盲重放。

Outbox 只有一个。任何网络发送前必须先持久 intent、确定性 idempotency key、payload hash 与当前 task/attempt binding；响应 receipt 必须先持久再推进。timeout、5xx、确定性拒绝和重启只更新同一 intent 的 last_error 与有限 next_delivery_at，不新建 intent、不丢失责任。只有 Website 精确持久化的永久业务撤权事实才能停止新发送，且必须保留原 row、payload/hash、receipt、checkpoint 与相邻能力权威的未决现场。

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
- local-browser-session 已签发无未决 effect 事实。

任一 404、权限不足、事实缺失、hash mismatch、多义或不可读均保留现场。获准删除每个 target 后，必须逐 target 读回目录缺席，并逐项读回数据库、Outbox、receipt、checkpoint、WAL 与其它任务目录保持不变；禁止批量模糊目标、启动时清理、全局清空或不可恢复删除。

## 7. 质量系统与发布边界

agent-production-runtime 只有全仓原生 quality:check 中的一份 Manifest、一套现役 inspector/acceptance、一条 Runtime proof route 和一个最终 verdict。Manifest 的 `ownedPaths` 只登记 Runtime 自身的 Manifest primary ownership；Product、GPT、Browser、Website、Runtime Log、App Shell、Startup 与历史项目方案不得由 Runtime primary-own，只能在确有接口消费时以精确 `observedPaths` 观察。

某一候选只有另获 AGENT 内相邻域原子归位明确授权后才可施工，且文字授权不等于已完成。法案、Inspector、测试、proof 与混合文件必须先在同一未提交 CHANGE 候选中准备完成；所有接收域与 Runtime 的 `ownedPaths` 在此期间保持原值。文件拆分完成后只允许一次原子修改：architecture-boundary 在已拥有的 Mediator/Product 边界内接收 `src/mediator/product-plugin-catalog.ts` 与 `src/mediator/product-plugin-contract.ts`，保留已归位的 `src/mediator/agent-production-route.ts`；agent-production-runtime 同时物理删除旧 Product-facing `plugin.ts` 和全部旧 import 边，而不是删除真实消费者。旧文件内容只按以下唯一映射归位：Product 类型、执行 context、产品中性 checkpoint/fault receipt 与结果校验 primitives 进入 `product-plugin-contract.ts`；12 个 Product 的唯一 composition、Skill 读取/hash、route identity 与单次 dispatch 进入 `product-plugin-catalog.ts`；artifact upload、Outbox、transport receipt 与 envelope 继续留在 Runtime；业务 parser/assembly 继续留在各 Product。现役 provider spec 已绑定的 `catalog.ts#agentPluginCapabilityManifest` 原位删除旧 Product imports、Plugin object、Skill text 与 route registry，只保留 Runtime 自有的 product-opaque Manifest publisher。不得再建立第三个 common/helper/adapter 层。其它相邻域只有在当前候选真实涉及其 Owner 路径时才参与。随后立即重建唯一 registry 并证明 `UNOWNED_PRODUCTION_FILE=0`、`MULTIPLE_PRIMARY_OWNERS=0` 与 Runtime manifest-owner-drift=0。不得先接收、先删除、建立临时第二 Manifest、兼容 re-export 或形成中间 READY/RELEASE 候选。

静态证据必须来自 Manifest Owner、AST、JSON、resolved import、实际 symbol consumer、合同或状态机结果；路径名、字符串包含、文件存在、fixture 数量、历史 report、self-check 或另一个裁决不得产生 PASS。检查器必须拒绝任一 Runtime-owned source 对 `src/plugins/**` 的 direct/re-export/dynamic/side-effect import、任一 Product source 对 Runtime 私有模块的反向 import，以及通过旧 Catalog、alias 或中转模块形成的同义边；不得再为 `src/lib/local-runtime/**` 或旧 Catalog 设置豁免。Runtime acceptance 不运行完整 Product Flow，不启动 GPT/Browser 业务动作，不裁决内容，不要求 39 个 Website job 全量入库。现有 Product/Runtime acceptance 必须用确定性 stub 证明 generated-image 的同一 artifact intent 只上传一次、Product 只在取得真实 typed receipt 后组装并执行 final parse、Runtime 收到的 final output 不含 `assemblePayload`、`parseResult` 或 Plugin object。现有 Architecture/Runtime acceptance 还必须从唯一 architecture Catalog snapshot 机械逐字段投影并证明 provider v3 Manifest 的 schema、当前 Plugin identity/version、accepts、task/result contract version 与 canonical catalog hash 精确一致；Product Profile/Skill/执行语义变化必须提升对应 `plugin_version` 并改变 canonical catalog hash，只有任一 Manifest 规范字段或 schema 变化时才不得沿用 provider v3。`architecture-boundary` 的 Exam 只能从 architecture-owned 唯一 Catalog、Runtime 发布的 Capability Manifest 与 `scripts/acceptance/product-plugins/**` 发现身份、证明一一对应、执行并汇总各 Product 自有测试；中央入口不得手写 Plugin 或 primary product/action 列表，不得保存任一 Product 的 Prompt、Child 顺序、checkpoint、分支、恢复规则或 expected result body，生产 `src/plugins/**` 不得 import 测试代码。

Runtime 唯一 dynamic proof 只声明：

- dynamic.service；
- dynamic.database；
- dynamic.storage；
- dynamic.authorization；
- dynamic.recovery。

Runtime proof 不输出相邻 lawId assertion，不复制相邻能力权威的证明正文。GPT、local-browser-session、runtime-log-spine 与 agent-production-runtime 必须分别由原生 proof 独立启动、只声明自身 lawId、只读取自身持久真相或相邻域正式 typed receipt；不得读取另一 proof 的 assertion，不得要求共享 Website job、Chrome journey 或时间线，也不得建立 journey coordinator、proof bus、共享 scenario、共享 assertion map、适配层或第二 proof。动态路由未全部归位前 Runtime RELEASE 必须失败关闭。

CHANGE、READY、RELEASE 是不同候选阶段。Runtime 的静态或动态 PASS 不等于 Product/GPT/Browser 已生产接纳、Website 已完成业务入库、全系统 READY、RELEASE 或 SYSTEM_PROVEN。

## 8. 可重复验收不变量

每次候选都必须重新证明：

1. 八条 Runtime law、稳定 blueprintId、三份 active contractRef 与 Runtime 唯一 Manifest 的 lawIds 相互一致；Architecture Boundary law 与 Manifest 独立保持其现役一一对应；越界 `ownedPaths` 只在同一候选的一次原子修改中归位，并立即证明无无主、无重叠、无 Runtime manifest-owner-drift。
2. Website task-result v5、V6 v15 与 AGENT dependency 精确一致，consumer contract body 只有三字段。
3. route projection 精确为 39 routes、57 parameter types、30 result contracts、2 reservation routes。
4. base、Bazi primary、review admission receipt 的互斥字段与完整 canonical hash 全部闭合，未闭合时本地 completed 增量为零。
5. credential 失败类别分别得到稳定脱敏 typed code，且 claim/Provider mutation 增量为零。
6. Runtime-owned source 对 Product Plugin 的 direct/re-export/dynamic/side-effect import 为零；Product source 对 Runtime 私有 production module 的 import 为零；唯一 architecture-owned Catalog 与 Runtime Manifest publisher 只以冻结纯数据 snapshot 连接，provider v3 Manifest 的全部规范字段精确一致，当前 Plugin identity/version 与 canonical catalog hash 忠实反映全部 Product Profile/Skill/执行语义，startup、Runtime inspector 不包含 Product frontier、reconstruction、Prompt、Child 顺序或 Product reason 特判。
7. 六表、精确列/主键/唯一索引/外键、WAL、integrity_check、foreign_key_check 和数据不变量可重复读回；普通启动迁移与删除增量为零。
8. authority 数据库缺失、不可读、损坏/查询异常、记录缺失、hash mismatch 分别可观察并失败关闭。
9. storage inventory 在未变数据上重复得到同一目录/字节分母；dry-run 写入、移动与删除增量为零。
10. 任一物理删除都存在本次精确 target 的单独授权、全部前置事实和删除后逐 target absence/preservation readback。
11. durable accept 后的重启恢复保持同一 job、同一权威 attempt、同一 intent，已确认 attach 的 materializer 与 file-input 增量均为零，无重复 Provider/Browser mutation。新上传必须证明 Runtime 原材料与精确 Provider basename 别名为同 inode/hash/bytes，binding release 后别名缺席，且 hardlink 失败没有 copy fallback。
12. Outbox 在网络前持久，同幂等键恢复；未获 Website 精确永久撤权时仍保留有限 next action。
13. 单 task 损坏不污染其它 task，结构不合格或 orphan storage 阻断新 claim。
14. Runtime 生产文件遵守基础法案文件与函数预算，无 type-only Owner 环、Product object/callback 泄漏、Browser 私有 store import 或新增通用包装层。
15. Runtime Manifest 不取得相邻域或历史方案的 Manifest primary ownership；唯一一次原子归位不能产生无主或重叠 Manifest primary Owner；Runtime quality 只有一个 checker、proof route 与 verdict。
16. Runtime proof 只声明本域五种 dynamic mode；GPT、Browser、Runtime Log 的原生 proof 均可独立运行，Runtime 相邻 proof assertion 为零，任何未解耦 route 都阻断 RELEASE。
17. Runtime CHANGE/READY 不替 Website、Product、GPT、Browser 宣称业务完成；最终业务完成仍以 Website admission/storage 为准。
18. 各域现有唯一 inspector、acceptance 与适用 proof 分别覆盖本域 active law 的 summary、全部 forbidden 与全部 evidenceModes；Owner-bound import mutant 必须证明 Runtime→Plugin、Plugin→Runtime private 与旧 Catalog 豁免都会失败关闭，全部被替代路径的生产消费清零，不新增第二 checker、proof 或 verdict。
