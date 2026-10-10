# 单一恢复权威与历史未决故障隔离完整实现方案

更新：2026-10-10，Asia/Dubai。唯一文件沿用本路径，需求 Owner 为 AGENT/local-browser-session；业务恢复唯一 Owner 仍为 Website.ai-acceptance。

**状态：设计阻断。** 本轮完成方案文档 CHANGE，尚未修改法案、施工图、代码、数据库或服务，未运行 CHANGE/READY/RELEASE。阻断的是完整方案施工准入，不是给运行系统增加门。现役V44的Provider输入可证zero分支已有null证明合法交接；非zero分支只有terminal_wal，不能诚实表达“旧输入结果未知，但旧执行已失去再次发出操作的能力”。非zero新证明生产者及网站接纳合同尚未闭合，见§7，不能把它施加到已有合法结果、无关job或可证zero分支。不得把这份方案称为已根治或可施工。

## 1. 需求、终点和边界

本次删除重复裁决、相互矛盾的恢复条款，以及“一个历史未决记录使所有工单停止”的控制路径。恢复原则只在既有 Website AI Acceptance 恢复法条说一次，下游执行它，不再各写一套恢复政策。旧故障必须有原 Owner 的有限下一动作；机械有效结果优先沿原结果链送到网站。

成功终点是同一 job 的领域 admission receipt、对应业务对象和持久化读回。Provider 回答、Browser 回执、HTTP 200、Outbox delivered、健康绿灯和 READY 均不是业务完成。取消、删除、撤权单独如实记账，不能冒充成功。

只在 AGENT/main 施工；Website 由其现有 Codex/Owner 建设，本执行者只读。不改变 Website 固定五阶派单、N、现役任务创建与领域入库主权。不得盲重放可能已发送的 Provider 输入，不得伪造旧命令 terminal/no/零输入，不得恢复旧 lease/fence，不得把未知记录批量删除来制造恢复。保留成熟 Ctrl+C、附件入口 OR、回答两门、精确 URL/turn 定位和保护等待。各冻结边界只修改本轮用户明确要求删除的重复恢复语义；无关冻结不解冻。

预期增量：旧故障不连坐其它合法工作；旧回执丢失也有诚实的恢复接回；法案、合同、实现和原生检查只有一个恢复裁决来源。风险：同一 Provider 调用确证无法取得旧答案后，经 Website 新 revision 精确风险授权可能再次输入；未知旧输入永远不能被宣称未发生。不能保证机器断电、数据库损坏、认证失效或 Provider 永久不可用时立刻成功；这些真实依赖恢复后必须自动接回原链。

## 2. 权威、候选与文件保护

按双仓母本 §§0、4、35、37—39、46—47、14—16、21—25、72、78—85 绑定：母本→基础法案→功能法案→Blueprint/spec→Manifest→唯一 registry→实现→证据。母本 SHA-256 两仓相同，为 27a143ecd7016887d056255e106f49caa29d83d06245ff21ea5c0ffd62b98c3a。母本、冻结 ci-full-governance Skill、AGENTS 不在修改面。

两仓基础及功能 law-record 已实际全文读取两遍，截断处分别补齐；AGENT 功能36条/基础3条，Website 功能509条/基础1条。closed-loop-implementation-design 的当前完整正文已双遍取得并按当前任务反查；frozen-spec-index、agent-flow-boundary-gatekeeper 已读取。守门 Skill 引用的 switch-repo-authority 在现役目录缺失，本轮不声称执行，也不据此进行 Website 写入。

| 仓库 | realpath / branch | HEAD / origin/main（本地缓存，未 fetch） | scoped SHA-256 |
|---|---|---|---|
| AGENT | /Users/nexgen/Documents/AGENT / main | 07a8c4bb273035bf503553de8dbb8b5ab7a65f09 / fba36cf6390ea9d5f98018f3d593eb99a44b3451 | 70cf2fdb8d55a44860b1bbc9dc0d4f50acafa025ba5aaecd18c242ad6c91183d |
| Website | /Users/nexgen/Documents/xuanxue-web / main | d728762d597b630dd70897831d0c195f608a89cf / 2a22a286345d8082c72291d82a200399096de576 | 41b05c183b98e6aed7c1f1fb036ac51c7a8a91965a4201ababc3360af31e4a77 |

各 scoped hash 按下方文件相对路径字典序，对当前 bytes 算 SHA-256，再将 path+TAB+hash+LF 拼接后求 SHA-256；方案自身不入 source candidate，文档 hash 单独回读。AGENT 基础/功能 hash 分别为 f1970c2416127f8bcdf560d0fd81105895924c4ed2cdd23f6a08ae910998d2f3、401925ea9abfa880875ed3a2b8f1c551471c2659ae5a10411ed62f236b4560b1。Website 基础/功能分别为 6ad826fb1980f78f1bfbffca3417fc4636332596b489d181c607e1032bfaa85f、9b1a72f99e60985d955d17d400a9c4d380e90d65aec6f8a023368d09309b5323。

AGENT 有别人未提交的 agent-production-runtime-proof-boundary.acceptance.ts、local-app-shell.acceptance.ts，本轮原样保护。Website 功能法案、registry 和商业/UI 多路径 dirty；当前法案漂移为订单价格快照/促销条款，已定向复核，不影响已核恢复规则。任何未来命中共享写面必须重新核当前 diff，不能覆盖、reset、stash、另建分支或制造干净候选。

AGENT source candidate（57路径）：
```text
.github/instructions/agent-rules/基础法案.md
.github/instructions/agent-rules/功能法案.md
AGENTS.md
docs/governance/法案系统建设说明书-冻结定稿版.md
docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md
docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md
docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md
docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json
docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json
scripts/audit/domains/local-browser-session/manifest.json
scripts/audit/domains/agent-production-runtime/manifest.json
scripts/audit/generated/law-registry.generated.json
package.json
src/lib/browser/exact-target/browser-mutation-store.ts
src/lib/browser/exact-target/browser-mutation-schema.ts
src/lib/browser/exact-target/browser-mutation-evidence.ts
src/lib/browser/exact-target/browser-mutation-receipt.ts
src/lib/browser/exact-target/browser-mutation-replay-evidence.ts
src/lib/browser/infrastructure/browser-lane-coordinator.ts
src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts
src/lib/browser/chrome-extension/websocket-actor.ts
src/lib/browser/chrome-extension/extension-target-authority.ts
src/lib/browser/chrome-extension/extension-target-release.ts
src/lib/browser/chrome-extension/extension-heartbeat.ts
src/lib/browser/protocol/browser-protocol.schema.json
src/lib/browser/transport/browser-authority-websocket.ts
src/lib/local-runtime/production/runtime-source-handoff.ts
src/lib/local-runtime/production/runtime-source-readback-proofs.ts
src/lib/local-runtime/production/runtime-claim.ts
src/lib/local-runtime/production/runtime-claim-recovery.ts
src/lib/local-runtime/production/runtime-loops.ts
src/lib/local-runtime/production/runtime-startup.ts
src/lib/local-runtime/production/runtime-storage-inventory.ts
src/lib/local-runtime/production/provider-rate-limit-control.ts
src/lib/local-runtime/production/provider-cooldown-receipt.ts
src/lib/local-runtime/production/runtime-business-admission.ts
src/lib/local-runtime/production/store-source-settlement.ts
src/lib/local-runtime/workbench-browser-authority-support.ts
scripts/audit/domains/local-browser-session/target-claim-inspection.ts
scripts/audit/domains/local-browser-session/browser-mutation-settlement-inspection.ts
scripts/acceptance/local-browser-provider-effect-recovery.acceptance.ts
scripts/acceptance/local-browser-auto-pairing-support.ts
scripts/acceptance/agent-production-runtime-recovery-contract.acceptance.ts
scripts/acceptance/agent-production-runtime-proof-boundary.acceptance.ts
scripts/acceptance/local-app-shell.acceptance.ts
src/lib/local-runtime/production/store-cooldown.ts
src/lib/local-runtime/production/store-outbox.ts
src/lib/local-runtime/production/store.ts
src/lib/local-runtime/production/runtime-state.ts
src/lib/local-runtime/production/runtime-contract.ts
src/lib/browser/chrome-extension/extension-command-runtime.ts
src/lib/browser/chrome-extension/debugger-runtime.ts
src/lib/browser/chrome-extension/exact-target-runtime.ts
src/lib/browser/chrome-extension/command-permit-validator.ts
src/lib/browser/chrome-extension/websocket-actor-crypto.ts
scripts/acceptance/agent-production-runtime-session-rotation-support.ts
scripts/audit/domains/agent-production-runtime/worker-loop-inspection.ts
```

Website source candidate（21路径，只读）：
```text
.github/instructions/agent-rules/基础法案.md
.github/instructions/agent-rules/功能法案.md
AGENTS.md
docs/governance/法案系统建设说明书-冻结定稿版.md
docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md
docs/specs/ai-acceptance/xuanxue-ai-production-v6.contract.spec.json
docs/specs/ai-acceptance/website-agent-task-result.provider.spec.json
scripts/audit/domains/ai-acceptance/manifest.json
scripts/audit/generated/law-registry.generated.json
package.json
packages/ai-contracts/src/production-control/v6-source-readback-proof.ts
services/api/src/ai-production/job-claim-authority.ts
services/api/src/ai-production/job-claim-source-lineage.ts
services/api/src/ai-production/provider-cooldown-repository.ts
services/api/src/ai-production/provider-cooldown-receipt.ts
services/api/src/ai-production/provider-cooldown-claim-policy.ts
services/api/src/ai-production/business-result-consumer.ts
services/api/src/ai-production/job-claim-selection.ts
scripts/audit/domains/ai-boundary/manifest.json
scripts/audit/domains/ai-boundary/check.ts
scripts/audit/domains/ai-acceptance/check.ts
```

## 3. 实证与前轮连续性

第一直接断裂有两个生产拒绝点：browser-lane-coordinator.ts 的 hasUnresolvedMutation/readState/nextWaiter/pump 把全局历史未决数当成当前物理占用；browser-mutation-store.ts:prepare 的事务又以 select 1 ... state='DISPATCHED' limit 1 对所有 job 拒绝。Runtime runtime-claim.ts:reconcilePendingAttemptFailures 在 WAIT_NEW_ATTEMPT 后第三次使用同一全局布尔值。上游要求同 job 自动恢复，下游却要求已丢失的原 terminal 才准恢复；有界循环本身无法消除这个逻辑死锁。

本轮前段只读SQLite mode=ro/query_only取证快照为CONFIRMED=13893、REJECTED=496、DISPATCHED=1。唯一未决command=044eab8b-c456-4fdb-8750-a1dafc8f0052，job=aiprod_704b4d2a-7d31-407c-9738-b70eaadb3f1c，attempt=8eeb2f4b-261f-4341-aced-211aab4feabb，revision=0，scope=target_local，action=browser.dom.click.v1，mutation_outcome=dispatched，physical_input_count=0，terminal_at=null，updated_at=2026-10-09T19:47:11.261Z。未决行默认0不证明未输入，也不证明Provider已submit。对应producer 751ce92e-8367-4b39-b01d-44b8f399a1ea-0001.jsonl最后四条为started/prepared/dispatched/shutdown started，没有可信原terminal。2026-10-10T01:02:05.595303Z复查为CONFIRMED=13868、REJECTED=487、DISPATCHED=0，原command/job WAL行已缺席；本轮没有数据库写入，缺席原因/清理Owner未取证，不能称故障已根治。相关代码与法案scoped hash未变，根因控制条件仍在。现象不能证明历次20余起均同根因，也不能证明这次一定是Ctrl+C还是强制杀进程。

readPhysicalInputState只核effect_scope='provider_effect'的完整行集合，target_local未知不能被改写成Provider已输入，也不能由某行默认count=0推导完整历史zero。本现场分类必须在原行存在且provenanceVerified的同快照下核完整Provider集合；当前行缺席后不能倒推原快照为zero。现役sealSourceHandoff/prepareOneSourceHandoff允许真实browser_input_state=zero、input_quiescence_proof=null、replay_calls=[]且首事实缺失的合法source；因此不能把Q1/Q2扩大成所有target_local故障的前提。

| 前轮 / 当前能力 | 实际边界 | 本轮裁决与防回归 |
|---|---|---|
| 07a8c4bb 的 H1/H2 执行状态修复 | Runtime/Shell 能显示 lane blocked；没有去掉全局历史门 | 保留当前事实投影能力；物理占用语义改变后同步读同一新事实。禁止只改健康为绿 |
| fba36cf 的 Ctrl+C 及附件 OR | 已在当前代码；本事故未决产生早于该收尾修复 | 保留停新claim、等待在途、网站接纳/明确失败接收、实际资源收束和未知退出报告；保留附件批准集合/OR，不归因 DOM 回归 |
| 原attempt无失败事实恢复方案 WO-SH1/SH2 | 尚有无 failure/null 分支及原 source handoff 缺口 | 本文件接管其与本事故有关的恢复 GAP；代码和引用未零残留前不声称旧方案已物理退休 |
| 浏览器退出恢复与未决命令解锁方案 | 用新 fence/新 Target 合成旧 terminal 的做法已被拒绝 | 明确废止该做法；新证明仅说明不能再 dispatch，不补造旧输入或答案事实 |
| 13a0a249f 合格成果快取 | 现役 fast delivery、结果和领域消费主链 | 原 stage+Outbox 优先；禁止恢复逻辑、cleanup 或旧 failure 将其退回 Provider |
| Provider效果/冷却根治、精确URL/Target-local恢复、稳定会话地址方案 | 同 effect 至多一次、原URL读取、来源seal及原惩罚身份有真实消费者 | 保留这些不变量；原 terminal-only 和必须原ACK才能解除历史冷却的重复裁决由本轮源头修订接管 |

## 4. 同类阻断普查与保留边界

除第一项现场已证，其余是代码/法案已证的风险路径，未声称全部在现场发生。

| 编号 | 已核路径 / 危害 | 修复落点 | 保留的真实边界 |
|---|---|---|---|
| G1 | lane、WAL prepare、Runtime WAIT 使用全局历史未决数 | B1、B2、R1 | 当前真实执行串行和同 effect 不盲重发 |
| G2 | websocket-actor 的 acquire/command/execute 因 mutationSlot 非空全部拒绝；ACK积压与当前handler占用混同 | B1 | 有效终态交付、commit后ACK、不得覆盖未交付事实 |
| G3 | 一个 job remote read/error 使 reconcilePendingAttemptFailures、unfinished executions整批throw，反复饿死后续job | R1 | 同一job原事实、有限退避和远端当前授权 |
| G4 | startup 孤儿目录计数直接返回静态 blockedRuntimeHandle，没有原worker下一动作 | R2 | 真正 Store损坏、未知schema/来源、认证失败不冒充安全可写 |
| G5 | 原限流ACK/WAL不可得令 confirmed_absent 永远不可达；本地旧notice阻claim | C1 | Website惩罚时钟/N/cohort、当前真实弹窗保护，不拿到期时间当清除证明 |
| G6 | cleanup 全局有任一未交付Outbox便全部return，随后只试pending[0] | R1 | 原result先交付；清理不能争抢当前物理操作或撤销业务接纳 |
| G7 | admission 在开始时 requireRuntimeLogWrite，日志不可写可能先挡住旧结果接纳读回 | R1调用顺序；日志法不改 | 停新claim/新外部mutation；已SENT或已Website staged/admitted的原身份允许只读确认及必要收尾，不把未SENT的旧Outbox当可发送 |

不属于本轮可删除的停工条件：当前仍在运行的物理操作、合法撤权、无法认证的命令、真实账号限流、Store不可写/完整性失败。它们限制对应危险动作，仍允许合法诊断、已提交回执及结果收尾。Website 固定五阶按剩余容量递补：高阶 claimable fresh job 足够时低阶不得领取；高阶不足或当前不可领取时，低阶使用仍空闲的 fresh 名额。本方案不承诺所有 waiting 均消失。N去重占槽也不能靠忽略旧accepted job释放；释放必须来自 Website 原决定。

## 5. 删除“七嘴八舌”的法案

两仓各自只保留一份active law corpus；本次规范差异只落各仓现役功能法案.md中的相应law-record，不是把全部法案缩成两条。Blueprint写执行落位，spec写唯一机器合同，不再复制恢复政策。一份canonical恢复规则不等于一个全局控制器，更不等于一个全局数据库。

唯一恢复政策落在既有 LAW-AI-ACCEPTANCE-001-V7 的后继版本：唯一规范主题是“未撤权任务需求持续到领域接纳”，failed的含义、自动下一动作和completed终点共同关闭这一风险。001现役forbidden:0的Prompt/Skill/模型/内部Flow边界副本删除，直接由既有LAW-AI-ACCEPTANCE-010-V13 forbidden:0/1及LAW-AI-BOUNDARY-003-V8 forbidden:0/2执法，网站不得下发Selector/Browser指令的独立约束继续由现役003-V10 forbidden:1承担，不复制进新001。业务主体/材料授权的专业Owner不变，001只引用已冻结任务身份。004剥离任务生命周期/恢复副本，仅保留fresh grant选择约束；固定五阶原语义、选择实现与验收不变。003保留容量与惩罚事实，不另定任务恢复政策。这样遵守母本14.3，不让派单排序、专业执行边界与恢复继续混在一条法案里。同仓下游用当前active dependsOnLawIds；跨仓下游仅引用provider spec的contractId/version/providerRepo，不跨仓复制法条或维护第二法案索引。

| 修改源头（均为功能法案.md中的精确lawId） | 删除/移出内容 | 独立保留与接管位置 |
|---|---|---|
| Website LAW-AI-ACCEPTANCE-001-V7、LAW-AI-ACCEPTANCE-004-V32 | 删除001 forbidden:0独立边界副本；从004移出重复生命周期/恢复命令，删除terminal全集/未决为空才可风险恢复的不可达条件 | 001独立边界直接使用既有010/AI-BOUNDARY-003及003机械禁令，不追加副本；后继001唯一明确“成果优先、旧执行停止与旧结果未知正交、风险由网站签发、有限下一动作、不连坐”；004仅管fresh grant选择，不改变五阶容量递补 |
| Website LAW-AI-ACCEPTANCE-002-V35、LAW-AI-ACCEPTANCE-012-V45、LAW-AI-ACCEPTANCE-013-V29 | TOMBSTONE/Provider效果及terminal-only恢复政策副本 | 各自保留边界、失败事实/来源合同、恢复授权/回执机械验证；业务决定依赖001 |
| Website LAW-AI-BOUNDARY-006-V10 | 整个active block、Manifest引用及check.ts中只为006存在的outputAssertions分支退役 | 恢复归001；私有执行位置禁令已由现役LAW-AI-BOUNDARY-003-V8 forbidden:2覆盖，跨业务八字continuation由002-V9 forbidden:1及003-V8 forbidden:1覆盖，直接使用这些唯一检查；不新造006继任空壳 |
| Website LAW-PUBLIC-KNOWLEDGE-CONTENT-005-V45 | summary及多处forbidden内抄入的通用Browser终态/风险授权门 | SEO独有run、准备截止、入库、Work Order exact purge保持；引用001，不再定义 Browser放行条件 |
| Website LAW-LOCALIZATION-020-V27 | 旧job恢复中重复的全WAL terminal要求 | source/policy/cohort/冻结材料和current译文激活、控制室只读、ensure唯一性保持 |
| Website LAW-BAZI-007-V6、LAW-HEHUN-011-V6 | accepted AI job通用恢复/新attempt算法 | 保留领域材料、consent、不可变报告身份；合婚尚未创建AI job的前置材料失败是独立职责 |
| Website LAW-COMMERCIAL-FULFILLMENT-DELIVERY-007-V5、LAW-COMMERCIAL-ORDER-MANAGEMENT-008-V3、LAW-COMMERCIAL-ORDER-MANAGEMENT-009-V3 | 同一AI job恢复算法副本 | 保留不二次付款、原订单权益、订单投影、履约intent独立约束；引用001 |
| AGENT LAW-ARCHITECTURE-BOUNDARY-001-V17 | TOMBSTONE中通用恢复条件与算法；架构层发号施令 | 只守Product/Capability/import边界、无第二链，恢复行为消费唯一provider合同 |
| AGENT LAW-GPT-001-V64、LAW-GPT-002-V31 | FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT及poll冻结段混入的Website恢复政策/terminal-only条件 | Child回答、材料、纯读取、Provider调用及轮询机械合同保留；由Browser证明物理事实、Website裁决恢复 |
| AGENT LAW-LOCAL-BROWSER-SESSION-003-V45、LAW-LOCAL-BROWSER-SESSION-004-V56、LAW-LOCAL-BROWSER-SESSION-006-V45 | 历史DISPATCHED阻所有job；全部原terminal才可建立新Target/恢复；Browser自定风险资格与必须旧ACK才能清除事故的规则 | Browser保留当前物理输入许可、唯一lane/WAL、完整事实、effect去重、真实回执和可验证当前dispatch收束 |
| AGENT LAW-AGENT-PRODUCTION-RUNTIME-001-V75、LAW-AGENT-PRODUCTION-RUNTIME-006-V46 | 001内terminal-only与原ACK不可得的全局恢复门；006 forbidden:0以孤儿目录一律阻claim的条款 | 001只运输/验证上游授权与本地事实；006保留盘点、exact absence清算和损坏防护，孤儿事实不替代原worker |
| AGENT LAW-AGENT-PRODUCTION-RUNTIME-003-V45、LAW-AGENT-PRODUCTION-RUNTIME-004-V44、LAW-AGENT-PRODUCTION-RUNTIME-007-V46 | 不修改法条：分别是单一provider/机械投影、admission验真和Manifest/静态证据责任，并没有本次要删的恢复算法 | dependency/spec、实际import与现役检查随合同修订；没有规范变化不递增law版本，也不删独立机械义务 |
| AGENT LAW-RUNTIME-LOG-SPINE-001-V7、LAW-RUNTIME-LOG-SPINE-003-V6 | 不修改法条：001 forbidden:5已经要求已SENT动作继续确认/清理，003只保存真事实与日志完整性 | G7是Runtime调用方先require日志导致的实现问题；在R1修调用次序，不借本次归拢改日志法或放弃脱敏/日志完整性 |

这是修改/删除分母，不是本轮已删法案声明，版本均绑定§2现役正文。实际规范变化的法条单独大版本+1、精确supersedes前版，同一lawKey仅一份active；006直接退役，日志法及其它无规范变化的条目不涨版本。删除同义句覆盖summary和forbidden；只替换标题、改名UNKNOWN、加“参考上游”却保留旧命令均不合格。原registry单次原生重建，Manifest/spec/Blueprint引用同步，不新建治理文件、评分器或冻结目录。

004的现役forbidden采用0起始索引精确归位：0、5的session有效性/原superseded claim对账机械约束归既有005；1、2、3、6保留在004的领取资格/选择主题；4、7、11、12、17的accept/lease/fence/输入输出枚举机械合同归012及其spec；8中的SEO exact purge直接使用现役PUBLIC-KNOWLEDGE-CONTENT-005唯一规定；8的通用故障恢复及9、10、13—16的持续需求/结果优先/恢复决定归001；18的冷却时间、N/cohort及同receipt机械gate归003/012，任务需求不能被冷却终止的决定只在001。移入对象已有同义规定时删004副本而不再追加副本。001需要的原状态机及恢复证据从原004的现役Exam/Dynamic collector归入本次001修订的evidenceModes，沿原入口执法，不新增checker；001的最终裁决覆盖同一未完成需求的存续闭环，不代替独立派单/N/领域专业裁决。

## 6. 唯一目标链与复用裁决

```text
Website原job当前需求/授权
 → Runtime durable任务、先核原stage/Outbox
 → 有成果：原结果身份交付 → Website原Domain Consumer → admission/readback
 → 无成果：Browser完整effect事实分类；可证zero沿原null-proof，非zero新风险分支核dispatch收束
 → Runtime原source seal（封旧完成端口，保留所有历史事实）
 → Website原job行锁/原claim/event/receipt唯一决定
 → 原effect零submit读回，或原授权普通新attempt，或精确新revision风险grant
 → 当前Product第一入口、原Child、唯一Browser lane/WAL
 → 原结果链
```

DISPATCHED 不再是“业务状态/全系统开关”。现有 WAL 的已dispatch但terminal未知字段是原动作取证，不能抹掉、更名成UNKNOWN再继续做全局门、或默认解释为零输入。本轮优先不迁移WAL schema及历史 authority hash；若用户要求连原取证字面值也移除，则需要另行证明离线合同迁移不会破坏已签source/effect hash，不能把删除控制门冒称完成历史schema删除。

| 单元 / 唯一Owner | 真消费者、权威输出 | 删除反事实 / 最短裁决 |
|---|---|---|
| Browser单WAL、receipt validator、CAS/readback | Runtime/Website消费完整effect事实；ACK消费可信终态 | 无法证明同effect至多一次/原事实；保留现有schema、payload加密、hash、decoder，不建新表或复制writer |
| 当前Extension handler集合/原连接generation/permit及lane | Browser执行者消费此刻动作许可 | 删除会有物理并发或旧执行迟到输入；复用当前资源Owner，新增证明只在原链产出，不能从“新会话”猜事实 |
| 单槽终态交付+ACK | 原WAL writer消费真实fact；原worker消费commit ACK | 删除会丢真实终态；保留单槽，区分receipt交付与handler运行；有效fact必须commit，不新增receipt队列 |
| Runtime三表/原worker/session/Source seal | Website原claim消费来源，原Outbox消费immutable结果 | 删除会失去接回/幂等交付；直接复用，不建recovery manager、第二worker/Outbox/store |
| Website001+原claim/event/receipt | AGENT消费当前授权，网站领域消费者消费结果 | 删除会出现自签风险/无人管需求；唯一上游规定恢复，下游规范副本删除 |
| Product、GPT、Forensics独立职责 | Product自有Flow、原Child及exact checkpoint消费者 | 无这些不能产生/归还原答案；原实现直接复用，禁止把旧完整Flow从Git恢复冒充重构 |
| 当前惩罚/冷却事实 | Website设备同行、AGENT原cooldown consumer | 删除会重现真实限流；保留时钟/N/cohort，替换旧ACK不可得导致的永久门 |
| 原Storage inventory | 原Owner检查路径/来源和exact清理授权 | 删除会误删/串任务；目录孤儿仅事实，不在Store完整时停所有job，不建quarantine目录 |
| 原Ctrl+C收尾 | RuntimeHandle.close、Supervisor/HTTP实际close | 删除会再留下残次；先独立出原收尾实现直接调用，保留唯一来源，明确是经论证保留 |
| 原native quality、Owner Exam | 各仓唯一质量入口 | 删除会无执法；更新原断言/反例，禁止保留旧global-block断言迫新代码迁就旧法 |

新增证明不是新恢复Owner、状态机或持久化；不存在真实生产者时禁止凭空加字段。原startup整文件重构不可分割地需要独立保留收尾，确定使用唯一runtime-shutdown.ts；直接消费者为新RuntimeHandle.close、blocked handle的finishShutdown和原session-rotation验收，没有旧入口转发/兼容，内容是提前裁决保留的成熟独立职责，不能报告“全部重新建设”。其余新增模块、表、队列、registry、API、timer和抽象均不进入方案。

## 7. 合同handoff与设计阻断

Identity spine：job_id + 冻结task/request hash；当前 accepted attempt_id/result_revision；lease/fence/session只授当前动作，不改业务身份。Provider effect仍为 job_id+result_revision+product_step_id+call_id+child_id+request_hash+payload_hash。来源seal、rejection、risk grant、staged payload、artifact、admission各按原canonical hash绑定，不能相互冒充。

| handoff | 当前合同与保留条件 | 目标/阻断 |
|---|---|---|
| Extension→Browser | protocol9，commandId/receiptBindingHash/完整terminalReceipt/receiptHash；unknown keys严格拒绝；完全重复fact只ACK；commit前失败不ACK | G2只分离当前运行与交付，不改可信终态。若新增dispatch收束wire事实，原协议单版本升级，不把它装进mutation terminal |
| Browser→Runtime→Website | V44的Provider输入zero接受null证明；非zero只接受terminal_wal且unresolved hash=hash([])；Browser private WAL/URL不跨仓，Runtime只公开reader | Q1：非zero回执丢失分支必须由Browser原执行Owner提供“旧dispatch不能继续”的真实认证事实，并与完整旧command集合绑定；当前代码没有可直接证明lost-worker分支的完整producer。已有zero路线直接复用，不新增条件 |
| Runtime→Website claim | provider ai-acceptance.xuanxue-ai-production-v6@44；source最多64call，effects最多64，nullable首事实，readback_proofs、source seal与原event，receipt回复未知只读原身份 | Q2：Website原canonical provider需要新版本替换terminal-only语义，AGENT只升级dependency及消费投影；不得V44/V45 union或复制新合同 |
| 原结果/Outbox→Website | task-result@17、原job+attempt+result_hash，同bytes重投；新fence只授发送，旧fence拒绝；领域admission事务唯一完成 | 直接复用，不能让Q1/Q2挡住已存在的合法结果 |
| 限流事实→Website→AGENT | 当前notice.v7与原verified receipt/write_order、targetless事故hash、原cohort | Q3：原ACK不可得时，当前真实absence如何绑定同原incident，须由原Browser及Website合同Owner闭合；当前absent不能冒充旧ACK成功 |

Q1的明确要求仅用于非zero历史输入需新风险授权的分支：先撤旧操作许可、收束原handler/dispatch tail，并证明旧执行路径不能再发出新CDP命令；证明只说明未来dispatch能力，不说明旧命令已经零输入、旧答案不存在或原terminal成立。原worker仍在时必须实际await；worker已丢失时必须取得能证明原执行资格/活动生命周期已终止的Browser权威事实，不能用空集合、socket断线、elapsed time或新nonce替代。在同一job该风险动作前核证明与当前原WAL命令集合一致；迟到真实terminal使集合/hash变化则重新取事实、重新seal，不能假清未决。其它job只验当前真实物理lane/授权和自己的effect事实，不能先要求这条旧job满足Q1。

Q2目标仅替换既有非zero input_quiescence_proof语义，zero/null原正交分类不变；由provider定义exact shape/version、required/null/default、完整集合hash、认证来源与hash vectors，新版本不同时接terminal_wal作为第二资格路径。原连接/许可世代只在Browser内部验真，跨仓body及派生hash不含Target/Document/原浏览器坐标或这些字段的派生身份；不得让新session/Target成为恢复资格，遵守冻结ARCHITECTURE-BOUNDARY-002-V2。browser_input_state的zero只指完整历史可证零Provider输入，possible/unknown原样保留；target_local未知不能消耗Provider effect，非法scope/来源保持unknown。D4的“未知”是已验真possible输入但结果/locator未知，不能把provenance失败的unknown封成合法attempt_handoff或风险输入；后者由原Browser Owner有界重核/修复且不挡合法旧结果。旧Provider无locator出typed unaddressable；可信locator有界exact读回沿原Proof，不扫Tab/标题。网站只有原三种next_action和原风险grant，不能增第四状态。

Q3目标复用同原incident/设备/cohort和唯一receipt链：旧ACK收据真有就原路交付；旧ACK handler实际收束、当前精确页面fresh证实absence及Website原incident同锁核验后才取得当前clearance，不回填旧ACK/终态。只有确实另有非zero危险操作需要风险授权时才核Q1，target_local ACK丢失不能被扩大为Provider输入证明门。惩罚窗口和cohort规则保留，时间到不能单独开门；再次exact_present仍按原事故规则。需要的canonical notice/receipt新版本与字段必须由原Owner确定并冻结，没有该合同禁止删本地gate先上线。

Q1、Q2、Q3均是实质设计GAP，不能由文字“有界”“原链”“事实恢复”代替解决。Website仅法案引用去重不能填Q2/Q3，Agent仅删全局布尔条件不能填Q1。Website固定派单与task-result@17均不应改变。关闭上述GAP前，本文件不能标可施工或声称100%根治。

## 8. 有限分母、终态和回接

每行终态是本次决定的输出；job只有原failed/completed，unknown不新增业务状态。各行均接回§6，工单见§9。

| 分支 | Owner/权威输入→输出 | consumer/readback；失败/恢复 |
|---|---|---|
| D1 原worker活着且有terminal | Browser authenticated fact→CAS commit/ACK | 原WAL真实终态读回；重复只ACK，不重发输入；B1/B2 |
| D2 原worker丢失、target_local未知 | Browser保旧WAL、核完整Provider历史分类；Website current grant | Provider可证zero直接复用现役null-proof source交接并从第一入口重建准备，不伪造旧click结果；非zero按D3/D4。证据缺失有限对账，其它无关job不连坐；B1/R1 |
| D3 Provider可能已输入、有locator | Browser原effect/URL→零submit exact读回 | 原Forensics/结果链；缺页按现役URL重建当前Target，不盲发；B2/R1 |
| D4 已验真Provider possible，但结果/locator未知 | Browser typed unaddressable+Q1；Runtime seal | Website原job持久签指定新revision风险grant后一次输入；无grant仅当前危险动作不执行；provenance unknown不伪handoff；Q1/Q2未闭合为设计阻断；B2/R1 |
| D5 原结果可持久读回 | Runtime原stage/Outbox→同bytes交付 | WebsiteConsumer/admission/业务对象；日志正常时原hash幂等查询/重投。日志坏时仅只读确认已SENT/已Website staged/admitted身份及必要清理；未SENT保持durable，原logger恢复后发送，不撤销/重跑Provider；R1 |
| D6 ACK丢失、Store已commit | 原worker同fact→原writer幂等ACK | 原行/原hash不改；原heartbeat/重连交付机制须有界再交，不建第二timer；B1 |
| D7 terminal冲突/伪造 | Browser拒绝，不ACK不伪结算 | 原typed原因与WAL保留；原handler停止后按Q1/Q2由Website决定，不能全局永久停车；B1/B2 |
| D8 一个job远端读取失败 | Runtime该job原typed原因+原退避 | 同iteration继续其它eligible job，下一现役iteration对该job再核；R1 |
| D9 source seal与结果迟到竞争 | Runtime原SQLite事务互斥→Website行锁fence校验 | 先有stage则继续结果；先seal则旧completion拒绝；未知提交只读回相同seal；R1 |
| D10 真限流active | Browser exact_present→原incident，Website原惩罚/cohort | 冷却中原effect读回/交付/renew继续；禁止新危险submit，按C1同incident核当前clearance |
| D11 旧ACK不可得/冷却到期 | 原ACK handler收束及fresh当前absence→Q3原receipt | 时间alone不放行，当前clearance与旧ACK分开；Q3未闭合不伪成功，不向target_local ACK强加Q1；C1 |
| D12 孤儿目录、权威Store完整 | inventory只读+原job对应来源核验 | 原worker继续合法工作；原Owner exact授权才删目录，读取unknown不当absence；R2 |
| D13 Store完整性/认证真实失败 | 原Owner拒绝危险写入，保diagnosis | 外部依赖修复后原startup接回；不忽略坏Store继续new effects；R2 |
| D14 已admitted但cleanup失败 | Runtime本job清理pending事实 | 不撤销completed，不挡其它结果；原lane可用后继续原exact清理、轮换pending；R1 |
| D15 Ctrl+C/永久撤权 | Runtime立即draining；Website原终止Owner | 在途步骤网站接受或明确失败接收+release后收束实际服务；未知保留异常退出；exactabsence才按原job清理；B1/R1/R2 |

D4及D2的非zero风险分支不能承诺在Q1没有生产者时自动放行；D2可证zero直接复用原合同。同一job结果无效不能无条件当业务成功；领域拒收仍用原rejection身份签合法后继。永久取消/删除后Provider自有内容不能宣称本系统可物理清除。

## 9. 原子工单与删除建设纪律

法案/施工图先行：主Codex至少两遍审对齐，不能以98%自评分代替具体finding清零。主Codex写代码，子智能体只审查实际建设，不并发编码。各工单分开Owner/仓库/权威输出，不能跨仓mega工单。

L-W、L-A是顺序施工批次名称，不是跨Owner原子工单，更不是新队列/台账。精确规范写面为各仓功能法案.md的§5指定block、该域现役Manifest/inspector及已列Blueprint/spec；其它block/用户overlay不碰。下表每行是一个独立验收动作，全部放在本唯一方案中，不新建工单文件。

| 工单 / 仓库 / 唯一Owner | 唯一输出与精确范围 | 依赖、完成与失败恢复 |
|---|---|---|
| W-P / Website / ai-acceptance | 001成为持续需求/恢复唯一政策；按§5迁移004的既有独立义务，删除002/012/013的政策副本；只改本域指定block/Manifest/原check | 输入现役corpus及§5；依赖各原Owner现有边界。源头唯一、无悬空依赖，五阶/N/task-result不变；失败停本域未部署diff |
| W-S / Website / ai-acceptance | Q2新source证明canonical shape/向量/原producer-consumer机械合同 | 依赖Q1真实Browser producer裁决；source seal、zero/null、拒收变异及旧seal单版本承接必须闭合，缺项设计阻断，不改已签旧body |
| W-C / Website / ai-acceptance | Q3同incident当前clearance唯一notice/receipt合同与向量 | 原incident/设备/cohort读回为输入；当前absence不伪原ACK，惩罚不变；旧notice承接不闭合则不切换，不另签事故 |
| W-B / Website / ai-boundary | 整条006退役、删除本域Manifest引用/原check独占分支 | 依赖W-P；002/003继续直接执法且所有006引用零残留；无独立接管证据则不删 |
| W-SEO / Website / public-knowledge-content | 005-V44中通用恢复副本删除，SEO独立约束保留 | 依赖W-P；原run/入库/purge验收不变，恢复只引用001；失败保原完成闭包 |
| W-L / Website / localization | 020-V27中通用恢复副本删除 | 依赖W-P；冻结source/policy/cohort及current译文消费者完整，失败不激活坏译文 |
| W-BZ / Website / bazi | 007-V6中通用AI job恢复副本删除 | 依赖W-P；原主体/材料/报告消费者不变，失败不改报告身份 |
| W-H / Website / hehun | 011-V6中已accepted AI job恢复副本删除 | 依赖W-P；前置材料失败、consent与报告仍由本域裁决，失败不伪建AI job |
| W-F / Website / commercial-fulfillment-delivery | 007-V5中通用恢复副本删除 | 依赖W-P；原权益/履约intent和不二次付款验收不变，失败不造新订单 |
| W-O / Website / commercial-order-management | 008/009-V3中恢复算法移除，订单事实投影保留 | 依赖W-P；订单只读原任务事实/领域接纳，失败不自建恢复状态 |
| A-A / AGENT / architecture-boundary | 001-V17政策副本删除，仅保既有架构边界 | 输入W-P及新provider引用；002-V2冻结字节不变；失败不进入代码 |
| A-G / AGENT / gpt | 001/002指定冻结段内恢复政策副本删除，GPT Blueprint落位同步 | 依赖W-P/W-S；两门/附件OR/精确轮询/节拍等原Child合同不变；失败不重写专业Flow |
| A-B / AGENT / local-browser-session | 003/004/006的历史全局门与原ACK永久门规范删除；Browser Blueprint明确只产物理事实 | 依赖W-S/W-C及Q1；现役机械证明/唯一lane/WAL保留，风险只消费provider；失败不假结算旧行 |
| A-R / AGENT / agent-production-runtime | 001/006规范副本/孤儿全局门删除；唯一dependency与Runtime Blueprint同步消费新provider | 依赖W-S/W-C及A-B；001只运输/事实，003/004/007和日志独立法不误改；失败不运行新版代码 |

L-W顺序为W-P→各域独立删除与W-S/W-C合同建设→同一次规范amendment的引用/registry闭合；L-A在Website唯一canonical已冻结后执行。W-S和W-C是同一V6 provider的不同字段责任，统一冻结一个新版本，不能各发布竞争spec或union。每仓由其既有唯一builder在本批全部引用闭合后重建registry；中间规范diff不产生质量PASS，不启动生产。共同验收是§5单一源头及各行独立消费者均闭合；单行失败只停止该行和其下游，不撤其它作者overlay。这里没有跨仓总verdict，也不代跑Website READY。

B1：local-browser-session，唯一动作是当前执行能力及原回执交付收束。整文件删除重建 websocket-actor.ts、browser-lane-coordinator.ts；若Q1需要协议事实，protocol schema/生成投影、transport及Supervisor只处理该明确合同，不能额外改Target authority业务。保留pairing/crypto/TargetAuthority/heartbeat/receipt verifier为直接唯一来源。删除前用独立职责清单核所有公开入口，随后物理删除两文件→确认路径及旧实现缺席→从当前输入输出合同重新实现认证、单lane、当前handler串行和单槽交付；禁止读旧文件改字符串后删写回。有效fact必须原writer commit后ACK，不能overwrite；原fact暂缺或错不能推定旧no。Q1未证分支不能假发收束证明。验收D1/D2/D6/D7/D15及G2：旧job未知不挡其它合法job；当前真handler仍串行；ACK丢失恢复、终态存活与lost-worker区分；未终止handler不能发证明。失败保留原WAL/真实fact，不盲回放。

B2：local-browser-session，唯一持久决定是按当前合法授权创建一个effect command。整文件删除重建 browser-mutation-store.ts，保留schema、row/authority hash、receipt/payload/既有evidence模块直接使用；新的Store仍唯一writer，不能恢复旧Store骨架。删除全局历史select gate，prepare只能机械验当前permit/Q1适用事实、完整同effect历史、同grant输入总次数；不同job旧事实不是拒绝条件。同effect已可能输入仍禁止普通重发，新风险revision只核Website精确grant；原零输入rebind/REJECTED no回执原事实保留。evidence.ts只修改公开事实职责，不能再向lane提供历史→全局stop authority。验收D1—D4/D7/D9：默认count0不转zero、未知不结算、错误effect/grant拒绝、唯一WAL/原terminal immutable，跨job当前合法输入可达。同grant任何已可能输入仍不能再dispatch。失败不改旧行。

R1：agent-production-runtime，唯一动作是每job原worker reconciliation→网站下一动作/旧结果交付。整文件删除重建 runtime-claim.ts、runtime-source-handoff.ts、runtime-loops.ts；保留runtime-business-admission、来源readback/proof、Store三表、原session/transport/Outbox/Forensics为唯一独立来源，不复制领域或Product逻辑。先成果，再各job来源；移除WAIT全局unknown门、first-null遗漏和整批head-of-line throw，错误落该job并有限回查，已存在worker不用新队列。source seal仍原事务封旧completion，Q1只经公开Browser reader，Q2新合同唯一decoder。cleanup按本job状态判断，不读其它job未送Outbox作全局门；每现役iteration最多一次物理清理并在原pending集合轮换，失败不恒选第一项，不新增timer/queue。日志不可写时停止新claim/新外部mutation，只读确认已SENT/已Website staged或admitted身份并必要清理；未SENT结果durable待交付，logger恢复后沿原链发相同bytes，不新artifact/terminal POST、不撤stage或重跑Provider、不伪日志成功。验收D3—D9/D14/D15及G1/G3/G6/G7，真实Store+函数fixture与原native入口执行；旧结果存在时Product调用0，SENT边界与恢复后同hash发送均验证；单job故障其余job仍进原循环。未完成任务不得退出容量分母，Website原WAIT才释槽。

R2：agent-production-runtime，唯一动作是startup将真实可运行Store接回原worker。先将经论证保留的shutdownRuntime、inspectTaskFailureAtShutdown、inspectDrainedTasks、finishShutdown移入唯一runtime-shutdown.ts，原RuntimeState输入、drainPass与Promise输出不变；新RuntimeHandle.close/blocked close直接调用，session-rotation-support的shutdownRuntime import直接改到新唯一来源，runtime-startup旧定义/旧export缺席、无转发，此项如实报“经论证保留”。随后整文件删除runtime-startup.ts→缺席→按初始化/完整性/credential/session/原handle合同重新建设。inventory孤儿不是全局永久停车依据；不要自动删除未知目录。实际Store坏/凭据缺失保持真实拒绝并给原Owner修复位置。验收D12/D13/D15：孤儿仅事实、合法任务继续；损坏不得写；Ctrl+C立即停新claim、在途及接纳/失败收尾、未决不报完整成功、实际连接/进程close证明均保留。不得把blockedRuntimeHandle改成假ready或加自动迁移。

C1：agent-production-runtime（Browser提供物理事实），唯一动作是原cooldown同incident原Outbox/receipt收敛。整文件删除重建provider-rate-limit-control.ts；复用store-cooldown/provider-cooldown-receipt/session、中央限流观察与原ACK Child，不另建探测Child/selector/timer。先完成Q3，再按新单版本notice接纳当前clearance；非zero风险输入才另核Q1。未送旧notice保持原顺序/身份，错误不阻旧业务成果，不能靠时间、本地bool或未知原ACK永久决定需求。Website惩罚/N/cohort继续唯一Owner。验收D10/D11：原ACK存在、ACK丢失、worker丢失、当前absence、mismatch/仍present、notice回复未知、旧cohort完成与合法撤权，逐原incident读回；无真实clearance不open、旧unknown不伪造。失败保留原notice/body/receipt，不另签incident绕过。

QA：各原Owner更新原inspector和Exam，不新建总checker。target-claim-inspection、mutation-settlement、opaque-proof与原Browser/Runtime恢复验收中terminal-only/global-block断言必须随对应新法退休，替为当前真实占用/同effect不重发/不同job不连坐反例；worker-loop-inspection的delivery-before-cleanup当前强制全局pendingBusinessAdmissions().some(hasUnsentOutbox)前置，也须改为本job结果交付/当前lane的生产AST证据，保留单worker有界循环与一次cleanup落位断言。源头放行前禁止只删测试制造通过。新proof、cooldown由各仓canonical向量和拒收变异验证。现有dirty两个验收文件先保留并与作者diff区分；不能覆盖它们，也不能新增竞争测试入口绕过。

承载：当前文件行数Store490、evidence404、lane219、actor364、loops349、source-handoff282、startup369、claim307、cooldown208。原生红线文件≤500、函数≤75、参数≤7、return≤8、嵌套≤5、复杂度≤16、await≤10，不以本方案自定预算替代。Store通过删除全局和重复政策逻辑缩短，不能堆入新恢复planner；上述整文件重建须按必要机械职责设计短函数，在写入前核原生结构算法，不把可预见拆分拖到READY失败后。Q1 wire producer落位与预算未闭合之前B1不施工。

全部工单共有失败门：当前相关candidate漂移只重算命中部分；授权/合同/真实消费者不闭合则不写生产代码。完成后主Codex至少两遍审实际代码与本文件差异，再启动只读子审；同时验旧链消失、新合同、真实保留/重建/局部改动分类、无旧骨架恢复/兼容桥。子审未放行不能结束建设。READY不能替代删除纪律验收。

## 10. 无兼容桥的切换与回退

1. L-W明确源头修订及Q1/Q2/Q3原Owner合同，L-A对齐；冻结new provider版本、wire版本及精确向量，不能在active中并列旧新资格。
2. 停新claim/新危险输入，沿成熟Ctrl+C等待已发操作、原Outbox和领域接纳；原facts未知诚实保留，不能要求所有历史terminal才允许进行受控离线建设。确实仍在执行的handler和现实服务必须真实收束，不能“timeout后当停止”。
3. 按exact job/attempt/incident盘点旧sealed source与cooldown待交付；已持久旧body不能改成新版本body或自签hash。先由原Owner收完可达旧回执。没有合法单版本承接旧待交付身份的canonical合同，cutover保持关闭；不得批量删账或写V44/V45双读桥。
4. Website Owner完成自己的原生CHANGE及独立候选；AGENT重建并完成本仓CHANGE/clean main READY。停机窗口内Website新canonical先部署，AGENT匹配版本和固定扩展匹配artifact随后切换；所有阶段旧runtime不得发请求，协议/contract不匹配明确失败，不能自动回退旧路径。
5. 同一身份读回新当前授权、旧effect未知仍在、当前dispatch收束、原result/receipt，才启动原入口。Website派单选择代码和tier映射不改，不能用站外新claim/recovery API接回。

切换前失败只撤本工单diff并保留共享改动/原存储。切换后已有新source/revision/receipt事实时，不能直接回旧provider或旧AGENT单端代码；停止新输入、保留结果交付，沿原Owner修复同一canonical版本。无新事实且两端均停时，才可恢复同一完整已验证旧版本组合；仍承认旧global故障未解决。旧数据/schema不改，不能从Git恢复旧根因片区冒充重构或删云工单换绿灯。

## 11. 分层验收和当前完成边界

Static：源头规范唯一、Owner/引用/版本/方向正确，旧全局历史gate不可达、无新增第二链，结构与冻结边界保留。必须跨summary/forbidden、Blueprint/spec、实现、inspector/Exam反查；简单rg命中数不能独立证明删除。

Exam：D1—D15及每工单正向和拒收反例，调用实际生产函数、真实SQLite fixture和原canonical向量；故意恢复global gate、伪Q1、把unknown归zero、错grant、旧fence、跨job清除和stage回退Provider均使对应原入口失败。所有仍适用成熟回归保留；旧全局禁令断言依法退休，不是削弱安全分母。

Dynamic：另有实际执行授权后，对当前现场同job读取Browser事实、Website当前授权、Product调用、原Outbox、Domain Consumer/admission与业务对象hash；再观察一个无关合法job不被历史未知阻断。限流用同incident真实clearance与原cohort读回；Ctrl+C以实际process/socket/DB close与网站中间步骤接收或明确失败接收证明。没有这些不能称DYNAMIC PROVEN或客户已完成。

各仓只用自己的唯一quality:check。Agent后续施工按冻结ci-full-governance Skill实际执行native CHANGE、clean main READY；若授权范围包含RELEASE，必须满足全部active law Dynamic Proof和当前候选，不自动以READY冒充发布。用户此前推云仓要求仅在届时READY真实通过后执行，本轮方案文档不commit/push。Website本执行者只提供准确依赖，不代跑其READY。法案系统修订是否触发母本79独立治理审查按届时实际native事实判定，不能用本次普通子审替代。

## 12. 方案审计与执行重绑定

本轮主Codex按三个不同分母审计：源头唯一/授权/下游独立职责；现役实现/前轮连续性/所有handoff与有限分支；删除反事实/切换/失败恢复/证据等级。发现问题须修正文档，再由只读子智能体对当前文档、真实law/spec/代码及闭环Skill核差异。子审放行只是准确的方案审查，不是native质量、可施工、建设完成或生产成功。

主审三轮已实际完成并修正：第一轮将唯一恢复源改为001，004移出重复职责，006明确整条退役，日志及Runtime独立机械法条不误改；第二轮核真实调用/Provider范围，复用zero/null既有分支，补入原cleanup检查的全局门及57/21路径candidate；第三轮反向核D1—D15、成熟保留、物理删除、无桥切换与证据等级，消除向zero/target_local ACK强加Q1的方案内部重复门。只读子审另指出并已修正四项：corpus与law-record混称、001独立边界漏裁、多Owner批次冒充原子工单、日志故障下SENT/未SENT边界不清。子审实际核源头/代码/spec/Manifest及只读SQLite，文稿审查与可施工分开；最终复核绑定当时文档SHA，不把旧版本审查结论移给漂移版本。当前Q1非zero producer、Q2/Q3 canonical新合同及旧待交付单版本承接仍是实际设计阻断，不算已解决。

执行者必须在动代码前重新绑定main HEAD、上述路径hash、dirty overlay和真实Owner。Q1完整producer、Q2单一canonical新合同、Q3原incident新clearance、旧待交付单版本承接以及跨仓必要Skill/主权门全部闭合后，重做受影响主审/子审，本文件才可由设计阻断转可施工。不能另建v2/final方案或旧骨架恢复；独立Ctrl+C保留、原模块复用、真正全文件重建和局部消费修改分别汇报。
