# production-runtime 生产级施工图 V53

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "agent-production-runtime-v53",
  "status": "active",
  "owner": "agent-production-runtime",
  "lawIds": [
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V63",
    "LAW-AGENT-PRODUCTION-RUNTIME-002-V8",
    "LAW-AGENT-PRODUCTION-RUNTIME-003-V34",
    "LAW-AGENT-PRODUCTION-RUNTIME-004-V34",
    "LAW-AGENT-PRODUCTION-RUNTIME-005-V33",
    "LAW-AGENT-PRODUCTION-RUNTIME-006-V36",
    "LAW-AGENT-PRODUCTION-RUNTIME-007-V36",
    "LAW-AGENT-PRODUCTION-RUNTIME-008-V37"
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
    {"from":{"domain":"agent-production-runtime","repo":"local"},"lawId":"LAW-AGENT-PRODUCTION-RUNTIME-001-V63","to":{"domain":"app-shell-ui","repo":"local"}},
    {"from":{"domain":"agent-production-runtime","repo":"local"},"lawId":"LAW-AGENT-PRODUCTION-RUNTIME-001-V63","to":{"domain":"local-app-shell","repo":"local"}},
    {"from":{"domain":"agent-production-runtime","repo":"local"},"lawId":"LAW-AGENT-PRODUCTION-RUNTIME-001-V63","to":{"domain":"startup-entrypoint","repo":"local"}}
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
  -> 释放当前 job 的一个本地在途席位；其余已授权 job 不受影响
```

| Runtime 运行职责 | 只通过 typed interface 消费 | 明确不拥有 |
|---|---|---|
| credential read、session、claim、durable accept、attempt、lease/fence | Website control intent、claim/grant/fence、business admission receipt | Website 业务准入、任务创建、领域入库、公开状态 |
| Runtime 当前授权的运输、lease/fence 与 typed failure | Browser effect WAL、GPT 当前 Child 结果 | Product 静态 Flow、Prompt、模型、Child 顺序与结果组装 |
| product-opaque failure、健康与诊断安全投影 | Runtime Log 的单写者接口 | Browser 私有 WAL、Target/Document、Runtime Log 事实正文 |
| 唯一 Runtime inspector、acceptance 与 Runtime-only proof | 相邻能力权威已签发的 typed receipt，不复制证明正文 | 第二 checker、proof、queue、store、receipt、verdict 或兼容链 |

Manifest primary Owner 只表示路径治理。Product runtime authority 只拥有静态 Flow、Prompt、模型、Child 顺序与结果组装，不拥有 Website 恢复决定或 Provider session store。Runtime 只做当前 task/attempt 的 typed 转交；Website Bazi sender 唯一提供已入库且精确绑定的父报告材料，GPT 只执行当前 turn，Browser 唯一拥有 WAL 与 FIFO。

`business_recovery_decision_owner_count = 1`，唯一 Owner 是 `Website.ai-acceptance`。mutation_outcome=no 时 Website 可结束旧 attempt 并有限退避后签发新 attempt；DISPATCHED/CONFIRMED 时保留同一 accepted attempt 并只授权同 effect 跨进程读回，physical submit 增量恒为零；Website 明确拒绝已取得结果后，可签发新 result revision。旧 fence 的迟到写请求全部拒绝。

Browser 精确识别已知ChatGPT限流弹窗时，Runtime必须在ack前经现役`production_outbox`持久化唯一`provider_cooldown` intent并同步关闭无关新claim与尚未发生的Provider submit；ack确认absent后按incident→clearance顺序向Website交付，ack失败、崩溃或未清除时也必须按同一顺序交付incident与幂等`not_cleared`，不得让Website失去事故事实。该门不复用shutdown abort，不终止任何在途job，并继续允许heartbeat/renew、同effect零submit读回、结果Outbox、Website领域consumer、admission receipt与持久化读回。进程重启只从同一Outbox/Website receipt重建门，不保存当前N或Website权威cohort，不新增表、worker、scheduler或第二Outbox。Website receipt到达前本地门不得按本地计时自行打开；送达后也只有最新clearance已是`confirmed_absent`，且不早于最新provider receipt `server_now`并不含`PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE`的Website claim receipt可以重新开放submit；`not_cleared`永久不能自行开门。

`TOMBSTONE-RECOVERY-AUTHORITY-001` 继续固定 Website 是未删除需求的唯一业务恢复决策 Owner；八字新业务任务只消费 Website 已入库并精确绑定的父报告材料，且每次从 clean GPT chat 执行。同一SEO文章的五个翻译task由Website按严格locale顺序签发provider_continuation direct parent，zh-HK直连已接纳zh-CN生成task，后四个直连已接纳前序翻译task。固定catalog保持五个独立locale task/result/admission，但每个cohort-role只有无parent三元组的zh-HK链首fresh，后四项由Website在直接前序领域接纳事务内签发provider_continuation。Runtime对已携带parent三元组的provider_continuation只机械读取exact parent job的本地completed任务，要求其`result_payload_ref + result_payload_hash`与Website parent triple精确相等，并把该父任务最终`current_attempt_id`作为调用期typed locator交给GPT；缺失、未完成或不等都在Browser输入前失败关闭。无parent三元组的合法zh-HK固定catalog根任务保持fresh。Runtime不读取Provider URL、不选择父任务、不判断业务父资格，也不新增父关系或continuation持久化。已确认Provider effect跨进程只能读取同一结果且物理submit增量恒为零；continuation store/frontier/CAS、private base、fork、兼容桥及第二恢复链恒为零。

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

Website 已持久决定 `WAIT_NEW_ATTEMPT` 后，Runtime 先释放该 job 的 Browser Target 与本地 attempt，再经构造注入的唯一窄宿主回调请求 App Shell 检查 Chrome 窗口可见性：窗口数大于零必须零动作；窗口数为零才复用现役 workbench URL 打开一个 Chrome 窗口。该回调不聚焦既有窗口、不新建额外 Tab、不导航 Provider、不读取 Browser WAL、不重放任务；失败只记录 `BROWSER_HOST_UNAVAILABLE`，不得恢复旧 attempt 或形成第二生命周期、manager、queue、timer、重试器和兼容路径。Runtime 源码不 import Startup 实现，依赖方向仍由 App Shell 注入 Runtime。

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
- Website Agent Task Result consumer dependency：version 12；文章翻译primary route以provider_continuation携带Website已验证的direct-parent triple；固定catalog的zh-HK链首无parent，后四项携同cohort-role直接前序，Provider URL仍不跨仓；固定catalog逐locale接纳，五locale齐备只在Website仓库发布边界验证；v11不保留兼容读取。
- Xuanxue AI Production V6 consumer dependency：version 34。Website 的 `ai_production_devices.max_in_flight` 是当前 N 的唯一持久 Owner，并在同一设备行唯一持有限流惩罚与cohort事实；Runtime 不保存或配置当前 N/权威cohort。心跳只报告去重后的本地 `agent_attested_in_flight`，claim 请求只按合同安全上限、本地 in-flight和 executor可用量提出，Website在设备事实行锁内收紧最终 grant。当前 active execution与已有 staged result但尚无 Website admission receipt的同一 job合并占用一个席位，Browser action capacity始终为 1。Runtime只消费 Website当前授权、有限 `retry_not_before`、三个 next action、包含 `provider_effect_identity_hash`的 typed effect outcome、provider_cooldown receipt与 admission receipt；不得自行推导容量或业务恢复。

consumer dependency 的 contract body 只能包含 contractId、version、providerRepo。普通启动只校验本仓最小 dependency，不读取未绑定 Website 工作树；跨仓 participant commit 只属于 RELEASE 证据。

唯一 route projection generator 必须机械得到并逐项校验：

- 40 routes；
- 46 parameter types；
- 33 result contracts；
- 0 条 reservation route；
- 每条 route 的 parameters、materials、relations、result_contract 与 Website provider 语义完全一致。

未知、缺失、额外、重复、顺序漂移或语义不等一律失败关闭。新增的唯一固定 catalog route 是 `localization_static_catalog + produce_locale_catalog`，仍由现有 `localization-production` Product Plugin 私有执行，不新增 Plugin、Runtime、队列、公开 candidate/selector action 或第二恢复链。不得手写 route allowlist、第二支持表、compatibility、alias、fallback、bridge 或 shadow projection。

`FROZEN-PUBLIC-KNOWLEDGE-PROVIDER-FORMAT-ONLY-001` 固定：Public Knowledge 的 Provider 可见输出格式只来自 Website 唯一 canonical `result_contract` 的机械投影，Product 只把当前 research/article 子合同原样写进 exact Prompt。research 顶层只要求 `schema_version,decision,topic_manifest,research_markdown,citations,research_claim_units` 六字段，article 顶层只要求 `schema_version,title,editor_note,article_markdown,safety_notes` 五字段；Provider 多余字段由 Website 唯一 parser 丢弃，不得拒收。该合同只约束交付结构、字段类型、枚举、引用 identity/marker 关系与 Markdown 语法，不得规定选题结论、分析方法、推理过程、观点立场、证据解释或图片创意；Product Skill 正文不得注入 Provider Prompt，AGENT 不得复制、扩写或另建格式/质量 validator，不得重塑 Provider 输出字段类型或追加第二 reception sidecar。改变或删除本冻结边界，必须由用户在未来任务中明确解冻并同步替换双仓施工图、合同、实现与唯一质检。

Website 在签发任务前唯一判断业务参数值是否合法。Runtime 先把 product_id/action_id 解析为有界字符串，再按 current route projection 与 Route Capability Manifest 精确解析；grant 不再冻结或比较任何 Product Plugin 身份。除此之外 Runtime 只校验 authenticated session/claim/grant/fence、task wire/schema/hash、当前 contract/projection/control contract version，以及 route/key/material/relation/result-contract 与当前 projection 的机械一致性；不得保存 `bazi_analysis_kind`、locale、localization resource kind、Product package/version 或 Bazi reusable candidate 的业务白名单，不得按 action 名推导 review/continuation，不得维护 `routeProducesGeneratedImage`、手写 Product/Action 支持表或硬编码 primary 数量。Product Plugin 通过 Product-facing execution contract 取得当前 task、materials、当前 Website route policy 与 GPT public facade，只校验完成自身执行所必需的局部 artifact、Skill 与 result 组装前置，不复判 Website 业务资格，也不读取 Runtime 私有 transport、store、lease、Outbox 或 recovery 模块。

本地化 task 不再跨仓携带 `resource_kind`；`localization_report_translation + report_translation` 与 `localization_article_translation + article_translation` 已是唯一业务类型身份。Website 内部领域 `resource_kind` 继续由 Website 自己消费，不投影给 AGENT，也不建立 alias、映射或兼容字段。

动态本地化 primary route 的 Provider payload 只使用 `terminal-localization-model-output.v2` 一份输出 schema，并只包含 `schema_version + source_resource_id + source_version + source_sha256 + target_locale + localized_structured_payload`。route 的 `product_id + action_id` 已由 task/result envelope 唯一携带，payload 禁止重复 `action_id`；Website `result_contract` 只以 `contract_version=3 + output_schema_version=terminal-localization-model-output.v2` 公开该格式，Product 原样写入 Prompt，AGENT 只机械核公开 schema 与 locked source/locale，Website staging 不复制本地化领域裁决，最终语义校验与 admission receipt 仍只属于 Website localization Domain Consumer。不保留 v1/v2 双读、fallback、compatibility、alias 或第二 parser。

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

`FROZEN-EXACT-TARGET-POLL-RESULT-REVISION-001` 已按本次授权精准解冻替换并重新冻结：Runtime只有在 Browser Authority为 PRESENT时才提出不超过合同安全上限、本地可用 executor与去重在途余量的有界 claim，Website才按当前设备 N签发新 grant。每个获 grant且需要 GPT的 job由 Browser懒建一个独占 system Target；submit后正常轮询保留绑定，第一次及后续observation前都释放唯一Browser lease/lane并立即进入唯一FIFO；GPT Child只计算至少70秒的最早资格，剩余deadline不足70秒时不重新acquisition，BrowserLaneCoordinator作为唯一计时Owner在每次真实observation终结时只抽取一次70—90秒全局间隔；随机值不按job、Tab、Product或Child生成和保存，真实相邻Provider observation至少70秒且总频率不随N增长。具备资格后只激活该 job精确绑定 Tab、重验 current Document并 fresh observe一次，正常轮询 Page.navigate=0。停止按钮存在时Runtime只运输pending；只有同一位点停止按钮连续消失且回答连续为空满20分钟时才运输 `GPT_RESPONSE_STOPPED_EMPTY` 及其Provider observation fact，任一次停止按钮出现、回答非空或身份失真均归零。只有进程重启、绑定 Target真正丢失或同等恢复现场，才先查同一 WAL effect，再以 `confirmed-readback`为该 job取得精确 system Target；不得回 GPT首页，只按 WAL canonical URL零次或最多一次精确导航并 fresh readback。唯一 Browser WAL的 `logical_mutation_id`仍直接作为公开 `provider_effect_identity_hash`，Runtime只运输 typed fact且不得读取 Browser私有 SQLite。Website只沿一条现役拒绝链处理两类事实：稳定不可用结果绑定独立settled result hash；停思考空回答绑定独立Provider observation fact hash。每个hash-bound事实只写一个rejection receipt并签发一个新revision，其他现实输入只能在同一accepted attempt零submit收敛。不得增加第二 WAL、queue、store、Owner、状态机、兼容桥或 fallback。

lease release 只使用一个由 `job_id + attempt_id + lease_version + payload_hash` 确定性生成的 `request_id`；不得再复制 `idempotency_key`。同一 attempt 的同 effect readback 失败只允许 Website 记录首条失败事实，后续 release 只验证相同 `provider_effect_identity_hash` 并释放当前 lease，不以新的墙钟时间制造第二失败身份。

AGENT 不建立通用 checkpoint、跨任务 Provider session state 或第二恢复状态机。Browser 唯一 WAL 的同一 provider-effect 行只提供 at-most-once 与同-effect confirmed readback 所需加密 locator；Runtime 唯一 Outbox 只幂等交付同一 result。Website 以自身 staging、领域入库与 admission receipt 为准，已完整 staging 的结果继续由 Domain Consumer 入库，不回退 AGENT。

`FROZEN-WORK-ORDER-UNFINISHED-PURGE-001` 已按本次明确授权精确解冻、替换并重新冻结：管理员清除只撤销 exact Work Order 中没有有效 Website 领域 admission receipt 的未完成 job。唯一删除请求只携确认时的 `completed_count + unfinished_count`；Website 在现役锁序内、任何写入或对象删除前按 receipt 四元组重算，任一漂移稳定返回 409 且删除增量为零。计数一致时，Website 先暂停 Work Order，保留全部完成闭包并物理删除未完成 job/run 及其独占记录和私有对象；有效完成量为零时同事务物理删除空 Work Order 根，有效完成量大于零时只保留 paused Work Order 根与完成闭包。明确回复的回执必须匹配确认计数；回复不明时，只能由匹配确认计数的 exact Website 终态读回自行闭合，禁止因回执丢失而重发。AGENT 对自身已接受 job 的 Website absence 仍只按 exact job_id 清除本地 task、Outbox、材料、结果、Browser WAL 与 Forensics artifact，停止该 job 的轮询、交付和外部结果复用，不得影响其它 job。已真实发送到 Provider 的消息及 Provider 自有日志、备份不在本系统可保证删除范围。未来改变仍须授权人明确解冻并同步替换双仓法案、施工图、合同、实现与唯一质检；AGENT 现役法案无需修改，因为其 exact Website-absence 清算职责保持不变。

付款、发布、删除、发货与正式业务记录修改不得放在可废弃 attempt 内；它们只在 Website 最终领域事务中按 `job_id` 幂等执行。禁止 recovery manager、planner、workflow、recovery queue、fallback、compatibility、legacy、bridge、shadow、第二 scheduler/store/state machine。

stopped-empty 的 lease-release typed fact 必须同时绑定 confirmed submit 的顶层 `evidence_ref/evidence_hash`、完整 Child proof 的独立 `child_proof_ref/child_proof_hash`，以及首次/终态 observation 时间、连续单调毫秒、observation 次数、位点 identity hash 与终态 observation revision hash；Website 在任一字段缺失、连续值少于 1,200,000ms、次数少于 2 或 Child 不是 `submit_exact_gpt_turn_once` 时失败关闭，不签发新 revision。终态 observation revision hash 只来自 stopped-empty proof，不得覆盖或冒充 submit evidence。

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
2. Website task-result v12、V6 v34 与 AGENT dependency 精确一致；grant 不携带 Provider locator/checkpoint 或 Product Plugin 身份，只绑定当前 task/attempt/lease/fence；attempt failure 必须同时运输 Browser 已持有的 `provider_effect_identity_hash + submit receipt/evidence` 与 stopped-empty 独立 observation proof。`provider_cooldown`只运输固定事故/ack hash与Website receipt，不运输DOM/URL/N。`RESULT_SETTLED_UNUSABLE + CONFIRMED + confirmed + effect hash + evidence + settled result hash` 只允许 Website 拒绝该结果并签发新 result revision；`GPT_RESPONSE_STOPPED_EMPTY` 只使用独立 observation proof 的终态 revision hash形成新拒绝事实，不覆盖提交回执。其它 DISPATCHED/CONFIRMED 只允许同 accepted attempt 零提交读回。八字仅携带 consultation_root_ref 与 direct parent；文章翻译五个locale都携带Website签发的provider_continuation direct parent且链首指向zh-CN生成任务；固定catalog仅zh-HK链首无parent，后四项携同cohort-role直接前序；明确新result revision才可携带hash-bound rejection。
3. route projection 精确为 40 routes、46 parameter types、33 result contracts、0 reservation routes；bazi_private_base_input 与 result_contract.private_base 为零。
4. base、Bazi primary、review admission receipt 的互斥字段与完整 canonical hash 全部闭合，未闭合时本地 completed 增量为零。
5. credential 失败类别分别得到稳定脱敏 typed code，且 claim/Provider mutation 增量为零。
6. Runtime-owned source 对 Product Plugin 的 direct/re-export/dynamic/side-effect import 为零；Product source 对 Runtime 私有 production module 的 import 为零；唯一 architecture-owned Catalog 与 Runtime Manifest publisher 只以冻结纯数据 route snapshot 连接，provider v4 Route Capability Manifest 只含 product/action 与 task/result contract version，跨仓及持久身份的 Product Plugin 名称、版本、Skill hash 字段为零。
7. Runtime 两表、精确列/主键/唯一索引/外键、WAL、integrity_check、foreign_key_check 和数据不变量可重复读回；`production_leases`、`production_gpt_consultations`、旧 `production_continuations` 与任何 GPT continuation store 均不存在；Browser WAL 不含 consultation identity、source task、continuation checkpoint 或 frontier，只保留执行 fence、effect terminal 与同-effect加密 locator；private base、reservation、fork、第二 lane/store 与 Product checkpoint 消费者为零；Runtime 普通启动迁移与删除增量为零。
8. authority 数据库缺失、不可读、损坏/查询异常、记录缺失、hash mismatch 分别可观察并失败关闭。
9. storage inventory 在未变数据上重复得到同一目录/字节分母；dry-run 写入、移动与删除增量为零。
10. Website Work Order 管理员清除必须先保护领域 admission receipt 精确闭合的完成成果，物理清除全部未完成子图；完成量为零时 Work Order 根同事务缺席，完成量大于零时只保留 paused Work Order 与完成闭包。AGENT 对已接受 job 的 Website absence 必须清除本地 task/Outbox/material/result/Browser WAL/Forensics，并逐 target 证明缺席和其它 job 保持不变。
11. durable accept 后进程重启必须由 Website 决策：mutation_outcome=no 可新 attempt；新 attempt 必须在现役 Target/current Document 重建 fresh/profile/model/menu/附件/Composer 等 target-local 准备，批准附件集合允许为空。只有 submit 是跨 attempt 稳定的 provider effect；DISPATCHED/CONFIRMED 必须保留同一 effect 且 submit 增量为零，并在任何准备动作前按精确 WAL 事实进入只读结果收敛。submit request hash 绑定现有 result revision 与 Child input hash；仅换 attempt 不变，新 result revision 必须变化。
12. 当前完整结果只按 `job_id + attempt_id + result_hash` 经唯一 Outbox 幂等交付；回复不明先查询 Website staging、领域入库与 admission receipt，不重做 Provider，第二 Outbox 或 delivery flusher 为零。
13. 失败、失联、lease 失效、结果不明和领域拒绝均只产生 typed facts；Website 唯一选择未发送后的新 attempt、同 effect 只读收敛或明确拒绝后的新 result revision。旧 fence 的 renew、artifact、result、terminal、completion 全部被拒绝。
14. 单 task 损坏不污染其它 task，结构不合格或 orphan storage 阻断新 claim。
15. Runtime 生产文件遵守基础法案文件与函数预算，无 type-only Owner 环、Product object/callback 泄漏、Browser 私有 store import 或新增通用包装层。
16. Runtime Manifest 不取得相邻域或历史方案的 Manifest primary ownership；唯一一次原子归位不能产生无主或重叠 Manifest primary Owner；Runtime quality 只有一个 checker、proof route 与 verdict。
17. Runtime proof 只声明本域四种 dynamic mode；GPT、Browser、Runtime Log 的原生 proof 均可独立运行，Runtime 相邻 proof assertion 为零，任何未解耦 route 都阻断 RELEASE。
18. Runtime CHANGE/READY 不替 Website、Product、GPT、Browser 宣称业务完成；最终业务完成仍以 Website admission/storage 为准。
19. 各域现有唯一 inspector、acceptance 与适用 proof 分别覆盖本域 active law 的 summary、全部 forbidden 与全部 evidenceModes；Owner-bound import mutant 必须证明 Runtime→Plugin、Plugin→Runtime private 与旧 Catalog 豁免都会失败关闭，全部被替代路径的生产消费清零，不新增第二 checker、proof 或 verdict。
20. N=1..4下去重业务在途数不得超过 Website当前设备配置；每个 active execution或 admission pending job各占一个席位，只有 Website admission receipt已读回，或 Website已持久决定 WAIT_NEW_ATTEMPT、永久撤权或删除后才释放该 job执行闭环；ACTIVE_ATTEMPT regrant不新增席位，CONSUME_CURRENT_RESULT继续占原席位，缩容不终止既有执行。任意时刻 Browser物理 lane与 active claim至多一个；每轮抽样计划值位于70—90秒，真实相邻Provider observation至少70秒且总频率不随N增长。八字另须证明 BZ05/BZ03/BZ04每个业务任务均 fresh且精确消费本轮Website父报告材料；同一SEO文章六个task按direct parent共享一个canonical conversation URL；固定catalog每个cohort-role的五个locale task也按direct parent共享一个URL，只有zh-HK链首fresh，且五个task/result/admission仍独立。交换parent或product step须在Provider输入前失败。continuation controller/store/frontier/CAS、fork与private base为零。
