# AGENT 运行拓扑图—完整实现方案

## 0. 方案状态与唯一结论

状态：**v4 按本工单授权解冻并重新冻结；v2/v3 历史由 Git 保留**。本表只精确替换模型/推理配型相关 G03/G15–G17；冻结只建立代码对照锚点，不证明现役代码已实现或动态工单已通过。

**唯一结论**：不再以“某个 409、某个限流弹窗、某次 Tab 轮询”分别设计补丁，也不以“建立完整拓扑”为名批量改代码。必须按以下顺序推进：

```text
现役事实进入门（来源、candidate、Owner、consumer、readback 均已绑定）
  -> 唯一拓扑表单
  -> 反向核对状态、字段、时钟、成功/失败/截止未取得回执与 readback
  -> 授权人批准该版本
  -> 以确认后的表单为唯一锚点，只读对照生产代码
  -> 形成逐行差异清单
  -> 每个差异独立判断 KEEP / 原位修复 / 删除
  -> 另行授权后才允许精确生产代码迭代
```

拓扑表单对每个原子能力回答且仅回答：

1. 谁是 Owner，什么身份可以进入；
2. 每次只允许观察还是至多一次物理动作；
3. 确认几次、按什么节拍、截止时间由谁给出；
4. 成功写什么权威事实、报给谁、下一决定归谁；
5. 失败、拒绝、等待或截止前未取得回执分别写什么确定事实、报给谁、是否允许重放；
6. 哪个 readback 才能证明业务真正完成。

它是**人可读、只收录已证明事实的静态能力与 handoff 锚点**，不是新运行时合同、Scheduler、Workflow Engine、进度表、恢复状态机或日志台账。表内不存在审批占位、可能、推测或无 deadline 的 `unknown`；文档是否获批冻结只记录在 §16，不进入任何拓扑行。当前 Route Manifest 与现役运行合同全部保持不动；是否需要任何机器投影，必须等表单冻结并完成生产代码差异审查后另行裁决。

---

## 1. 需求、权威终点与明确非目标

### 1.1 需求原文的工程化表达

授权人要的不是另一份事故处理清单，而是有限、可验证的运行分母：先重建 2026-09-06 至 2026-09-21 双仓高频迭代中已经遇到的状态分歧、返回事实、结构新增/删除、方案回退与业务终点误判，再对 Runtime、Product、GPT Child、Browser、Forensics、Website 之间每个受影响的原子责任，提前写清全部已知结果、时序、证据、消费者和恢复回接。以 Tab/Provider 轮询为例，不能只写“继续轮询”，必须回答“最早何时可观察、每轮谁取得 lane、pending 记什么、success/failure 记什么、deadline 到达后报给谁、下一 attempt 谁有权签发”。

本文件从本版起同时承担两种且仅两种职责：

1. **现役运行拓扑母本**：定义当前系统每类状态、原子节点、合法结果和 Owner；
2. **未来问题唯一对照基线**：任何新增问题必须先落到本文件已有节点/边/outcome，只有确证缺口才能扩图，不得另起局部方案自建状态语言。

### 1.2 权威业务终点

拓扑完整不等于 Provider 回答、Browser `CONFIRMED`、AGENT 本地 result、Outbox delivered 或 Website staging。唯一业务终点仍是：

```text
Website Domain Consumer 对同一 job_id + result_payload_hash 幂等入库
  -> 签发 business admission receipt
  -> Website 领域对象持久化 readback
  -> Website public completed（按该业务域现役附加门）
  -> AGENT 机械校验同一 receipt 后 local completed
```

### 1.3 非目标

- 不把 Product Plugin 的 Prompt、模型、Child 顺序、分支和下一步决定权移给 Runtime、Website、Skill 或通用图执行器。
- 不预设用 `AgentRuntimeTopologyManifestV1` 替换现役 Route Manifest；不因表单整理而修改跨仓运行协议。
- 不把“表单已确认”解释为生产代码存在差异，更不把差异审查解释为已获施工授权。
- 不建 per-job step ledger、`step_index`、`resume_point`、第二 checkpoint store、第二 WAL、第二 Outbox、第二 failure history 或第二恢复结论。
- 不把 Runtime Log 当作当前状态，不用日志重放推断业务成功。
- 不发明一个通用“重试 N 次 + 指数退避”。现有每类时钟的 Owner 不同，必须分别投影。
- 不把拓扑图 PASS 当作 CHANGE、READY、RELEASE 或业务完成。
- 不要求 Website 运行时消费本表单；“网站侧得到地图”首先指 Website 责任方与 AGENT 责任方共享同一确认锚点，而不是预先新增网络载荷。

---

## 2. Candidate 绑定与授权边界

### 2.1 仓库绑定

| 仓库 | realpath | branch / HEAD | tracking | 工作树 |
|---|---|---|---|---|
| AGENT | `/Users/nexgen/Documents/AGENT` | `main` / `69b00115f1be6478db26116969a1c5169255760b` | `origin/main` / `12c1c6578927c12d891e2f88db0c5470cd759ca6` | 本地 main 比 tracking 多 2 个提交；唯一未跟踪文件为本拓扑的生产代码对照与差异待修方案；本拓扑、active law、Blueprint 与生产源在本轮写入前 clean |
| Website | `/Users/nexgen/Documents/xuanxue-web` | `main` / `8a71d36402cd6b797be1eed80308e1f0fc967e6b` | `origin/main` / 同 HEAD | 一份无交集的奇门方案未跟踪；active law、Blueprint 与本轮生产目标在写入前 clean |

未跟踪方案的边界是：AGENT 的生产代码对照与差异待修方案是本次已授权施工输入；Website 的奇门方案与本拓扑无交集，必须保留且不得修改、删除或据此扩大施工范围。

### 2.2 本轮授权

授权人已明确授权 `WT-TOPOLOGY-001`、必要 active law、施工图、代码、质检系统与数据库操作，并要求严格按阶段施工：先完成法案/施工图对齐及主 Codex 不低于两轮自审且达到 98%，再进入生产代码；代码完成后主 Codex 再自审不低于两轮，随后才可启动只读子智能体审计。任何阶段授权都不得修改冻结 Skill、建立分支/工作树、兼容桥、第二链路或无真实消费者的治理结构；CI-FULL 只在代码与审计门闭合后由现役冻结 Skill 执行。

### 2.3 施工前必须重绑

未来获授权施工时，Codex 必须重新读取两仓 `AGENTS.md`、branch/HEAD/tracking、完整 dirty state、本方案规范化 hash，以及 § 11 每张工单的 source candidate。任一相关合同、权威、时序常量、Child 合同或消费者漂移，只重算受影响部分；命中施工面的未归属改动必须失败关闭。

---

## 3. 现役四维事实与第一直接断裂

### 3.1 法案与施工图

1. AGENT `LAW-AGENT-PRODUCTION-RUNTIME-001-V66`、`LAW-ARCHITECTURE-BOUNDARY-001-V12` 固定：Runtime/Mediator 不得决定 Product Prompt、模型、Child 顺序、分支或下一步；Website.ai-acceptance 是唯一业务恢复决策 Owner。
2. `LAW-AGENT-PRODUCTION-RUNTIME-003-V38` 和现役 Runtime Blueprint 固定：Runtime 对外只发布由 Mediator 纯路由快照生成的 `product_id + action_id + task/result contract version`。
3. Website `LAW-AI-ACCEPTANCE-002-V27`、`003-V10`、`004-V26`、`012-V34` 与 AI Acceptance Blueprint 固定：Website 不得逐步遥控 AGENT，不接收 Product Flow、Prompt、模型、selector、Target/Document 和恢复位置；Website 只有 `ACTIVE_ATTEMPT | WAIT_NEW_ATTEMPT | CONSUME_CURRENT_RESULT` 三个 next action。
4. GPT Blueprint 固定：一个 Child 只做一个局部决定、零或一次 Browser 动作、直接后置证明；Child 不得决定 Product 下一步。
5. Browser Blueprint 固定：唯一 FIFO/lane、唯一 mutation WAL、至多一次物理输入，pending observation 释放 lane，Provider effect 不得盲目重放。

### 3.2 实现已有的局部地图

- `src/lib/local-runtime/production/contracts.ts` 的 `AgentRouteCapabilityManifest` 只有 40 条 route 和一个 `route_hash`。
- `src/capabilities/gpt/contract.ts` 的 `GPT_CHILD_CAPABILITY_CONTRACTS` 已覆盖 14 个 Child，且已声明 semantic intent、profile、decision set、pre/postcondition、mutation budget、evidence schema 和 replay policy。
- 同文件的 `GptChildCapabilityProof` 已记录 child/version/status/reason、exact call identity、job/attempt/result revision/product step/call/input hash/action ordinal、authority/evidence、candidate cardinality、observation revision、mutation/postcondition/browser fact 与开始结束时间。
- Browser 已有唯一 lane、WAL、Target/Document authority、访问门、动作后读回、Provider observation cadence 和类型化 terminal fact。
- Runtime 已有 session/attestation、claim、durable accept、lease renew、Product 单次路由、唯一 Outbox、Website admission reconciliation 和两表本地权威。
- Website 已有 attempt failure fact、恢复矩阵、三个 next action、staging、Domain Consumer 和 admission receipt。

### 3.3 第一直接断裂

**第一直接断裂不是缺少另一次重试，也不是缺少一个新 manifest，而是缺少一份经双方逐项确认的统一拓扑表单。**

相同一个原子能力的“能发生什么”目前被拆在 Child contract、handler loop、Browser 时钟、WAL、Runtime failure serializer、Website recovery policy、law/Blueprint 和历史方案中。各层都能描述自己的局部事实，但没有一个先于施工建立的共同锚点，用来逐项核对入口、状态、时钟、返回、证据、消费者与业务终点。结果是局部修复可以各自“有道理”，却互相推翻，甚至在同一 `(job_id, attempt_id)` 上产生前后不同的 failure fact，被 Website 稳定 409 拒绝。

本阶段只修复这个“共同参照缺失”：形成并确认表单。Website 运行时是否需要额外字段、现役 manifest 是否真的不足，必须在表单确认后的代码对照阶段用具体差异证明，不能在表单阶段预判。

### 3.4 当前 409 的精确语义

Website `job-failure-history.ts::ensureSameFailure` 对同一 `(job_id, attempt_id)` 只允许一份幂等 failure fact；除同一 `provider_effect_identity_hash` 且两边 mutation outcome 均已为 `dispatched|confirmed` 的单调兼容例外外，新事实与旧事实不等即返回 `AI_PRODUCTION_ATTEMPT_FAILURE_IDEMPOTENCY_CONFLICT` 409。该 409 是 Website 的失败关闭，不是可以简单重试的网络错误。拓扑必须让每个原子节点的 failure projection 唯一，不得依赖 409 后的另一条恢复链掩盖矛盾。

### 3.5 有限回归与前轮连续性

本轮为填表做了有限事实筛查，命中近期连续改造：`430f56d33` 的 transient DOM 确认、`368b3329b` 的 70–90s 全局 Provider observation cadence、`6676540bd` 的 typed Provider wait reason、`cb8341cfd` 的 Provider 限流恢复与 `379dd3431` 的 WAL effect identity。这些是本版事实来源，不构成生产代码差异裁决或施工指令；授权人批准冻结后，仍须按行重新绑定代码对照 candidate。

冻结前最后一次 candidate 重绑发现 AGENT `HEAD` 从 `12c1c657...` 前进到 `69e58c004...`。新增提交只加强 `bazi-chart-interpretation`、`bazi-ai-full-analysis`、`bazi-report-followup` 的结果字段、输入锁定和验收，影响 R01–R03、R15–R20、N09/H10 的结果合同证据；Route 集合、Product Owner、状态、时钟和 handoff 方向均未改变。对应事实行已按新 `HEAD` 复核，未产生拓扑语义变更。

当前两份局部方案对“是否新建/依赖 central preflight”已出现互相相反的方案结论，且其一包含对存量工单的数据库删除建议。这只证明“继续以局部故障方案为施工 authority”已不可靠，不自动证明任何生产根因或授权删除数据。本方案只提取当前实现已验证的不变量，并终止两份局部文档的独立施工权。

### 3.6 十五天回溯分母与证据优先级

回溯窗口固定为 **2026-09-06 00:00:00 至 2026-09-21 当前 candidate**。可复核分母为：

- AGENT `main`：204 个提交；
- Website `main`：96 个提交；
- 双仓现役 active law、Blueprint、spec、实现和原生验收；
- 授权人提供的两份 2026-09-20 至 2026-09-21 生产启动/运行日志；
- 该窗口内保留的方案、事故复盘和 rollout 摘要。

原始日志绑定为 `/Users/nexgen/.codex/attachments/aa3fc70f-7f1b-4879-8c53-b1e52f6afdae/已粘贴的文本.txt` 与 `/Users/nexgen/.codex/attachments/9b5c69f6-cb21-4b59-a536-db3366e6adce/已粘贴的文本.txt`；Git 复核命令使用双仓 `--since=2026-09-06 --until=2026-09-22`。`checkpoint/one-by-one-pre-ntab-20260914` 只作为 N-TAB 前后差异锚点，不是 PASS/READY/RELEASE 或当前生产状态。

“问题全量”在本方案中的精确定义不是把 300 个提交逐条抄进文档，而是：**可访问证据中每一种会改变控制流、物理副作用、持久状态、跨 Owner 返回、业务接纳或质量裁决的不同问题族，必须在 §3.8 有且只有一个落点。** 同一错误在 Browser→Child→Product→Runtime 的因果传播只算一个第一直接故障，不按日志出现次数虚增问题数。

证据裁决顺序固定为：现役法案/Blueprint/canonical contract > 当前实现及真实 producer/consumer > 当前同一事件权威持久事实 > 同一事件原始日志 > Git 变更史 > 历史复盘/方案。规范性拓扑不能由错误代码反向改写；代码若与上位 authority 冲突，留待冻结后的代码对照判为 mismatch。历史事实只证明“曾经发生过”，不得冒充当前状态。

### 3.7 八类正交状态平面

过去返工的共同根因是把不同 Owner 的状态都叫成“工单状态”。本拓扑禁止建立一个大一统状态机，改为八类可相互引用但不可互相覆盖的平面；粗粒度平面可以包含多个相邻 Owner，但每个具体 writer/state 必须在 S/N/H 表中继续拆成单 Owner 原子行：

| 平面 | 平面内 canonical writer | 典型状态/事实 | 绝不能被它证明的事 |
|---|---|---|---|
| P1 业务需求 | Website Domain Sender | demand active/revoked、材料和结果合同 | attempt 已合法、Provider 已动作 |
| P2 控制与授权 | Website ai-acceptance | session/attestation、claim、attempt、lease/fence、三个 next action、N/cooldown | Browser 真的输入、领域已入库 |
| P3 Runtime 交付 | AGENT Runtime | durable accept、local task、Outbox intent/delivered、typed terminal transport | Product 语义正确、Website 已接纳 |
| P4 Product Flow | 命中 route 的 Product Plugin | route 私有节点、分支、局部结果组装、settled/usable | Browser 物理效果、最终业务完成 |
| P5 GPT Child | GPT capability | `DONE/ACT/WAIT/FAIL_CLOSED`、Child proof、typed wait reason | Product 下一步、Website retry |
| P6 Browser/Provider effect | Browser Authority + WAL | Target/Document、lane、observation、`REJECTED/DISPATCHED/CONFIRMED`、mutation outcome | 结果可消费、领域入库 |
| P7 领域交付与接纳 | Website ai-acceptance 只写 staging/public；命中业务域的 Domain Consumer 只写领域结果/admission | staged、consumer rejection、domain write、admission receipt、public completed | RELEASE 或基础设施健康 |
| P8 基础设施与质量 | 各 infrastructure Owner / 唯一 quality verdict | process/transport health、CHANGE/READY/RELEASE、candidate drift | 任何业务工单成功 |

硬规则：上游平面只传递本平面的 typed fact，不能替下游下结论。比如 `job.terminal succeeded` 只证明 P3 执行收束，`result.upload succeeded` 只证明交付请求成功，`CAPACITY_ZERO` 只证明当次 P2 claim 无席位；三者都不能写成 P7 业务完成。

### 3.8 十五天问题族全量清单与拓扑落点

状态含义：`CURRENT-OPEN` 为当前实现/现场已经证明仍存在的未闭合面；`CURRENT-GUARDED` 为当前已经证明存在现役门禁的问题族；`HISTORICAL-CLOSED` 为有历史事实且当前已由现役合同取代的问题族。没有当前证据的问题不得进入本表，也不得以 `UNPROVEN` 占位。

| ID | 已遇到的问题族/第一直接故障 | 涉及平面 | 当前裁决 | 本拓扑唯一落点 |
|---|---|---|---|---|
| I01 | 40 routes、原子能力、时序、handoff 与 Product Flow 分散在不同权威中，尚无一份双方确认的统一拓扑表单 | P2–P6 | `CURRENT-OPEN`（共同参照缺失） | §5 唯一拓扑表单母版；不得预判 manifest 缺陷 |
| I02 | session/token/contract/device 绑定漂移，出现 `AI_SESSION_TOKEN_STALE` 或 claim 前能力不兼容 | P2/P3 | `CURRENT-GUARDED` | session/attestation 节点；禁止带病 claim |
| I03 | `NO_ELIGIBLE_JOB`、`CAPACITY_ZERO/BUSINESS_CAPACITY_EXHAUSTED`、demand inactive、failed+demand_active 被混称为“没有任务” | P1/P2 | `CURRENT-OPEN`（表达面） | claim observation 封闭 outcome；逐一记录原因 |
| I04 | Website/Next 生成物损坏或 API/worker 不可用，先导致 heartbeat/renew 500，再表现为 AGENT lease/Browser 中止 | P8→P2/P3 | `CURRENT-GUARDED` | infrastructure failure 必须保持 first cause，不改写成业务失败 |
| I05 | lease renew、stale fence、startup recovery、同 attempt redelivery 与任务 completed/replaced 写冲突 | P2/P3 | `CURRENT-GUARDED` | attempt/lease/fence 和 Outbox handoff |
| I06 | exact Target 物理缺失、detached target、permission-limited tab、Document 漂移 | P6 | `CURRENT-GUARDED` | Target/Document authority 节点；零 Provider 重放 |
| I07 | `BROWSER_COMMAND_RECEIPT_MISSING` 或 command timeout；截至 deadline 未取得能证明物理动作结果的 receipt | P6→P5 | `CURRENT-GUARDED` | 记录 `effect_outcome_not_provable_by_deadline`；保留 WAL/effect fact |
| I08 | DOM candidate missing/ambiguous/not actionable、transient DOM、`BROWSER_POSTCONDITION_FAILED` | P5/P6 | `CURRENT-GUARDED` | 每个 Child 的负向封闭集与 direct postcondition |
| I09 | GPT model/profile/reasoning 候选不唯一或失效，如 `GPT_MODEL_SELECTION_V2_CANDIDATE_INVALID` | P4/P5/P6 | `CURRENT-OPEN`（现场发生） | 对应原子 Child；首个 typed failure 不得被 Runtime 泛化 |
| I10 | 附件尚未物化、exact set 不等、文件名数字后缀、deadline 内节拍漂移 | P4/P5 | `CURRENT-GUARDED` | attachment 2/3/5/7/9/11 秒确认策略 |
| I11 | Provider 首次观察绕过全局节拍、N-TAB 轮转延迟、Tab 已完成但未获 lane、deadline 误判为死等 | P5/P6 | `CURRENT-GUARDED` | 单 FIFO、eligibleAt、唯一 wake timer、70–90 秒节拍、deadline |
| I12 | checkpoint 观察必须是 `bounded-observation`；有效持久 checkpoint 增量页面观察为 0，缺失时只做首次观察，损坏时在 Browser 观察前失败 | P5/P6 | `CURRENT-GUARDED` | `contract.ts` 与 artifact-recovery acceptance 已限定读取面；禁止新增持续 watcher |
| I13 | adjacent assistant 缺失、stop present 但正文空、`RESULT_SETTLED_UNUSABLE` | P4/P5/P6 | `CURRENT-OPEN`（现场发生） | text checkpoint 两道门、stopped-empty 20 分钟、Product usable 判定 |
| I14 | “请求过于频繁”弹窗 `exact_present/mismatch/absent`，确认按钮动作、clearance 与全局 cooldown | P2/P5/P6 | `CURRENT-OPEN` | rate-limit observation→ack→cooldown→clearance 子图 |
| I15 | 现役弹窗 detector 用拼接 `textContent`，可把视觉正确弹窗判成 `unknown_present/BROWSER_GPT_DIALOG_UNRECOGNIZED` | P5/P6 | `CURRENT-OPEN` | 机械可见文本/可操作性 detector；不得用方案 PASS 冒充已实现 |
| I16 | 历史 `CONFIRMED` effect 因 request/payload identity 漂移无法收回，或 `GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH` | P4/P5/P6 | `CURRENT-OPEN`（现场发生） | 任何 prepare 前 exact WAL winner；同 revision effect identity 单调 |
| I17 | Provider effect `DISPATCHED/CONFIRMED` 后重做准备/submit，或未知结果被误当 `mutation=no` | P2/P5/P6 | `CURRENT-GUARDED` | at-most-once effect 与 Website `ACTIVE_ATTEMPT` 零 submit 收敛 |
| I18 | evidence append、Forensics idempotency、artifact/source/geometry/readback 不一致 | P3/P5/P6 | `CURRENT-GUARDED` | proof/artifact authority ref+hash；diagnostic 不升格为恢复状态 |
| I19 | AGENT result/图片已上传或 staged，但 Website Domain Consumer 拒绝，如 `PUBLIC_KNOWLEDGE_CITATION_INVALID` | P3→P7 | `CURRENT-GUARDED` | 同一 staged payload 重消费；禁止 Provider 重跑 |
| I20 | Outbox delivered、HTTP 200、terminal、local completed 被误报为“成功入库” | P3/P7 | `CURRENT-OPEN`（认知/表达面） | admission receipt + domain-object readback 唯一终点 |
| I21 | 同一 `(job_id, attempt_id)` 先后上报不同 failure fact，触发 `AI_PRODUCTION_ATTEMPT_FAILURE_IDEMPOTENCY_CONFLICT` 409 | P3→P2 | `CURRENT-OPEN`（现场发生） | 单一 failure projection；409 是矛盾终局而非可重试网络错 |
| I22 | Website 502 / `AI_PRODUCTION_UPSTREAM_UNAVAILABLE`、cloud transport unavailable 只证明当次 transport 未完成 | P8→P3/P7 | `CURRENT-GUARDED` | transport retry 与业务 retry 分离；只重投同一 intent |
| I23 | localization 无兼容 Worker/capability，或 normal concurrency 10 与 failure threshold 3 被混淆 | P1/P2/P4 | `CURRENT-GUARDED` | admission capability gate 与 Product-specific failure budget 分开 |
| I24 | static localization A/B/selector、多轮与单轮五语曾并存；跨设备 continuation 曾产生重复基线/上下文风险 | P4 | `HISTORICAL-CLOSED`（须持续守门） | Product 静态 Flow projection；旧路径零残留验收 |
| I25 | N-TAB 前向 migration 在 in-flight effect/open session 存在时不可安全执行；orphan 时间字段曾不闭合 | P2/P3/P6/P8 | `CURRENT-GUARDED` | cutover precondition/readback；不得以合并成功冒充迁移完成 |
| I26 | 未先圈定 admission closure 的 work order/任务清理会误删已接纳闭包，或保留空根/第二删除状态 | P1/P7 | `CURRENT-GUARDED` | deletion topology：先圈定 admission closure，再删未完成私有子图 |
| I27 | `quality_reflection` 自动化曾误设为 Skill/Codex 发送或第二 Product/调度链 | P1/P4/P8 | `HISTORICAL-CLOSED`（须持续守门） | Website 排程/授权，Product Flow，Codex/Skill 只读审查 |
| I28 | CHANGE/READY/RELEASE、候选漂移、dirty overlay、静态 PASS、真实生产读回互相替代 | P8 | `CURRENT-GUARDED` | 唯一 quality verdict；层级证据不得越级 |
| I29 | 自然语言 failure code 被机械治理当成新的控制状态，导致状态集合不断膨胀 | P2–P8 | `CURRENT-OPEN` | `control_outcome_set` 与 `diagnostic_code_policy` 分离 |
| I30 | 局部方案各自添加 preflight、cooldown、重试或删除动作，彼此推翻且无统一准入 | 全部 | `CURRENT-OPEN` | §3.11 新问题准入门 + 唯一母本 |
| I31 | 已退休 rename/临时 route/旧 export/旧 contract count 仍被质量或调用方引用，形成幽灵能力 | P2/P4/P5/P8 | `CURRENT-GUARDED` | route/capability existence + 零残留删除验收 |
| I32 | SEO/localization 的 parent conversation、adjacent turn、跨 attempt/跨设备 continuation 绑定错误，回到错误 chat 或重复基线 | P4/P5/P6 | `CURRENT-GUARDED` | Product lineage node + exact conversation/turn identity |
| I33 | 结构校验、自然语言语义、Product usable 判定和 Website domain rejection 混在 Runtime 通用校验层 | P3/P4/P7 | `CURRENT-GUARDED` | Runtime 只机械校验；Product/domain Owner 各自 typed outcome |
| I34 | 生成图已确认但 authenticated source、原 bytes、媒体类型、尺寸/geometry 或 result contract 未完整保持 | P4/P5/P6/P7 | `CURRENT-GUARDED` | image checkpoint→artifact→result→domain handoff 全链 hash/readback |
| I35 | static context/material item 数量、bundle identity、request/input hash 漂移，导致恢复时“同工单不同输入” | P1/P3/P4/P5 | `CURRENT-GUARDED` | materials/bundle/input identity 在节点入口一次冻结并逐边传递 |
| I36 | 同 attempt 的同一 result 在回复不明、Website 已 completed 或 replaced write 场景下无法合法重投，诱发新 attempt/重做 Provider | P2/P3/P7 | `CURRENT-GUARDED` | 唯一 Outbox 同 payload redelivery + Website 幂等 readback；Provider 增量 0 |

### 3.9 2026-09-20 至 2026-09-21 现场因果复原

两份授权人提供的日志必须按“第一 typed failure”而不是末端 HTTP 状态读取：

1. Website 日志出现 40 次 `AI_PRODUCTION_ATTEMPT_FAILURE_IDEMPOTENCY_CONFLICT`。这是日志出现次数，不是 40 个独立根因。
2. AGENT 日志中，工单 `aiprod_ae196681-...` 先在 Product 报 `GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH`，随后 lease-release 才遭 409；工单 `aiprod_e5acfa72-...` 先报 `RESULT_SETTLED_UNUSABLE`，随后 lease-release 才遭 409。**409 是下游事实冲突，不是第一根因。**
3. 同场还出现 `BROWSER_POSTCONDITION_FAILED`、`GPT_MODEL_SELECTION_V2_CANDIDATE_INVALID`、`BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT`、两次 `AI_PRODUCTION_UPSTREAM_UNAVAILABLE`，以及 Provider wait 的 initial/missing/stop 过程事实；它们分别属于 P6、P5、P8，不能压成一个“失败”。
4. 同场 `CAPACITY_ZERO/BUSINESS_CAPACITY_EXHAUSTED` 出现 39 次，`LEASE_GRANTED` 事件出现 38 次。前者是当次 claim 的正常 P2 结果，不是工单失败；两者交错说明 N 个业务席位和单 Browser lane 不能互相代替。
5. `result.upload succeeded`、Product `plugin.execute succeeded`、Runtime `job.terminal succeeded` 与 admission-readback 请求成功在日志中都出现，但单靠这些行仍无法证明具体 Domain Consumer receipt 和领域对象已落库。

针对授权人此前提出的“页面弹出操作频繁会不会立即 409”：**不会由弹窗本身直接产生 409。** 当前设计意图是 exact dialog → Browser 零/一次确认 → Runtime 持久 cooldown intent → Website 冻结 cohort/新 submit → clearance；Child 最终报 `PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE`。只有当同一 attempt 此前已经持久化了另一份不兼容 failure fact，而后续弹窗/lease-release 又试图写入新事实，才会触发 409。当前 detector 仍有 `textContent`/`unknown_present` 开放缺口，因此本拓扑必须同时覆盖 `exact_present | mismatch | absent`，不能假设所有弹窗都可被精确识别。

### 3.10 回溯得到的七寸

七寸不是“轮询太快”或“Website 太严格”，而是三件事叠加：

1. **静态可能性没有双方确认的唯一基线**：各 Owner 分别知道自己的 route、Child、时钟和恢复事实，但没有一张共同冻结的表说明某原子节点允许等待、失败、未知还是发生 effect；这不自动等于 Website runtime 必须新增字段；
2. **动态事实没有统一投影**：同一原生故障经过 Child、Product、Runtime、lease-release 时可被重新包装成不同 failure fact；
3. **八个状态平面被语言压扁**：等待、容量不足、物理未知、Product 不可用、交付成功、接纳失败、基础设施故障都被叫作“任务成功/失败”。

因此根治条件不是增加重试，而是：先用冻结拓扑表封闭“能发生什么”，再逐行证明运行时每个平面是否只报告自己的 typed fact、跨 Owner 是否保持单调、最终完成是否只由 P7 readback 裁决。任何实现修复都必须晚于该对照。

### 3.11 未来新增问题的唯一准入门

任何新事故、返回码、页面变化或业务需求，先在本母本执行以下四分法：

1. **已有节点 + 已有 outcome**：这是实现/证据缺陷，只修该 Owner，不扩图；
2. **已有节点 + 缺失 outcome**：先证明真实场景、消费者和验证，再修改该 Owner 合同与本拓扑；不得在外层兜底；
3. **全新责任**：必须通过当前必要性、真实消费者、唯一 Owner、删除反事实、可执行 readback 五项存在性审判，才可新增节点；
4. **只有下游症状**：回挂到最早 typed failure；HTTP 409/5xx、Runtime consequential failure 和重复日志不得各建一个新状态。

首次出现且无法落入现役行的事件，必须记录已经观察到的精确来源、时间、identity、payload/hash 和第一个拒绝点，并停止沿旧拓扑继续动作；该事件从发生时起就是“已观察的新事实”，不是永久 `unknown`。只有把它作为新版本拓扑变更、完成 Owner/consumer/readback 证明并重新冻结后，才能对照或修改生产代码。不得自动 retry、改写旧事实、创建 replacement job、另写一份局部施工 authority。

### 3.12 唯一基线的维护纪律

- I01–I36 是稳定问题族 ID，不因某次修复删除或复用；闭合后只把状态改为 `HISTORICAL-CLOSED`，以便未来同型问题先做回归而非再发明结构。
- 本矩阵不是事故台账，不保存每个 job、时间线或日志副本。具体事件仍留在各 Owner 权威与证据系统；这里只保留不同问题族及其拓扑落点。
- 未来新问题只有通过 §3.11 第 2/3 类裁决才顺延新 ID；第 1/4 类只回挂现有 ID。不得创建第二“问题清单”“拓扑补充方案”与本文件竞争。
- 状态从 `CURRENT-OPEN/CURRENT-GUARDED` 变为 `HISTORICAL-CLOSED`，必须同时具备现役代码/合同、负向验收、原生质量层级和所需真实 readback；方案文字、提交标题或单次日志消失不足以闭合。
- 本文件是施工前对照锚点，不是运行时手工数据源。未来若逐行差异证明机器投影确有必要，必须作为独立差异工单重新通过存在性审判；不得在本阶段默认新增。

---

## 4. 拓扑表单的法定位置与总图

### 4.1 定位：法案之下、施工图之前的冻结运行基线

本表不是普通辅助文案，不是运行时合同，也不是直接修改代码的施工图。它是现役法案和未来施工图之间的**唯一冻结运行基线**：法案规定 Owner、边界和不可违反原则；本表把每个现役原子责任的入口、动作、时钟、结果、证据、handoff 与业务终点逐格定清；差异对照表再证明生产代码是否符合；精确施工图只能处理已经证实的差异。

```text
现役法案 / Blueprint / canonical contract
  -> 已证明事实进入唯一拓扑表单（本轮建设）
  -> 反向审查 + 授权人批准版本
  -> 冻结版本 + 冻结规范化 SHA-256
  -> 只读逐行对照生产代码
  -> 差异清单（MATCH | MISMATCH | NO_EVIDENCE）
  -> 对每个 MISMATCH 另行授权精确施工图
  -> 生产代码修复 + 原生质检 + 业务 readback
```

本轮到“已证明事实表”结束。批准前不得填写“已冻结”，不得正式启动代码对照；冻结后不得用代码、日志、局部方案或 Skill 反向覆盖表单。

### 4.2 当前现役主链只作为填表边界

```text
Website Domain Sender
  -> task + materials + result contract
  -> Website session / attestation
  -> Website claim / accepted attempt / lease / fence
  -> Runtime durable accept
  -> Mediator exact one-time route
  -> Product Plugin（业务 Flow 唯一执行与分支 Owner）
       -> GPT atomic Child
            -> Browser observation
            -> 可选 WAL + <=1 physical mutation + direct readback
            -> GptChildCapabilityProof
       <- Product 决定下一 Child / skip / repeat / result assembly
  -> Runtime one Outbox intent
  -> Website staging
  -> Domain Consumer admission + domain-object readback
  -> Website public completed（按业务域附加门）
  -> Runtime local completed

任一失败或截至 deadline 未取得确定 receipt
  -> 原 Owner typed fact
  -> 相邻 handoff 原样传递
  -> Website ai-acceptance 唯一恢复决定
```

这张总图只限定表单分母，不授权新字段、新投影、新接口或新运行机制。

### 4.3 静态基线、活体事实和施工指令严格分离

| 对象 | 唯一权威 | 本表只记录什么 | 本阶段动作 |
|---|---|---|---|
| Child 的稳定能力边界 | 现役 Child contract/Blueprint | Owner、输入、动作上限、结果字母表、证据与消费者 | `FORM ONLY`；不改合同 |
| Product route 的业务 Flow | 命中 route 的 Product Plugin | 业务责任、可能调用的能力种类和终点；不复制 Prompt/分支实现 | `FORM ONLY`；不发布给 Website runtime |
| 当前 job/attempt/lease/next action | Website ai-acceptance | 状态所属平面、Owner、readback 和合法转换 | 不保存任何活体行 |
| 当前 Browser mutation/effect | Browser WAL | 可能结果、身份绑定、readback 与禁止重放规则 | 不暴露、不复制 WAL row |
| 当前 Child 局部结果 | GPT Child proof / Forensics | 成功、失败、未知如何记录和交给谁 | 不建第二 proof store |
| 历史因果 | Runtime Log Spine | 只标为诊断证据 | 不推导当前状态 |
| 业务完成 | Website Domain Consumer + admission receipt | 唯一终点和 readback | 不以 HTTP/Outbox/staging 代替 |

“Website 侧得到地图”在当前阶段仅表示 Website 与 AGENT 的责任方审阅同一冻结表单，不表示 Website runtime 新增 topology payload、节点游标或 Product Flow 控制权。

### 4.4 Product Flow 的可审阅边界

本表可以列出 Product 的稳定业务责任、入口合同、会调用的原子能力类别、合法终点和交给相邻 Owner 的 typed fact；不得抄录 Prompt、模型值、selector、分支实现表达式、Target/Document、WAL row、当前 step cursor、resume point 或 next child。Product Plugin 仍是其 Flow 的唯一执行、分支、skip/repeat 和结果组装 Owner。

若未来逐行代码对照证明 Website runtime 确实缺少某个必要事实，必须把它作为独立差异，通过真实 consumer、存在性审判、跨仓 authority 和另行授权重新裁决；本表阶段不得预埋 `AgentRuntimeTopologyManifestV1` 或任何替换方案。

---

## 5. 唯一拓扑表单母版

### 5.1 表单集合、稳定 ID 与版本规则

同一文件内只允许以下八类表，不建立第二 registry、JSON、数据库或机器投影：

| 前缀 | 表单 | 用途 |
|---|---|---|
| `Sxx` | 状态字典 | 区分各状态平面的精确语义和禁止互认关系 |
| `Nxx` | 非 GPT 原子节点 | 记录主链上的决定、动作、持久化或 readback |
| `Rxx` | route—Product Owner 绑定 | 穷尽现役 route 分母并定位具体 Product Plugin；不公开 Product 私有 Flow |
| `Gxx` | GPT 原子 Child | 记录单 Child 的零/一次动作、确认、证据和返回 |
| `Txx` | 时钟与确认政策 | 记录初次观察、递增节拍、次数、截止和到期结果 |
| `Hxx` | Owner handoff | 记录 producer、typed fact、identity、consumer 和接受回读 |
| `Oxx` | 结果/故障矩阵 | 记录成功、失败、拒绝、等待、未知、409 与恢复归属 |
| `Ixx` | 已知问题族 | 把十五天内已知问题回挂到上述唯一行 |

ID 一旦进入冻结版本即永久保留语义，禁止改号复用。删除只可标记 `RETIRED` 并在新版本中给出替代行或“无替代”理由；旧冻结版本和旧 hash 保持可追溯。草案可以纠错，但每次提交授权人确认前必须重新计算整份文件的规范化 hash。

**事实进入规则**：拓扑行只能来自 §2 绑定 candidate 上的现役 law/Blueprint/canonical contract、当前实现或同一事件原始证据，并且 Owner、输入、输出、consumer 和 readback 全部可定位。缺一项的内容直接排除在拓扑正文之外，只能作为冻结阻断报告给授权人；不得在表内写审批占位、可能、以后补充或 `UNPROVEN`。授权人批准的是整版事实基线，不是把推测变成事实。

### 5.2 `S` 现役状态字典

| ID | 状态平面 | 权威 Owner | 现役值/事实 | 精确含义 | 禁止互认 |
|---|---|---|---|---|---|
| S01 | P1 业务需求 | Website Domain Sender | `active \| revoked` | 业务需求是否仍获授权 | 不证明 attempt、Provider effect 或完成 |
| S02 | P2 会话 | Website ai-acceptance | `valid \| stale \| rejected` | Runtime session 是否可继续进入控制面 | 不证明可领取具体 job |
| S03 | P2 attestation | Website ai-acceptance | `accepted \| stale \| mismatch` | 当前 Runtime 能力声明是否被接受 | 不证明 Product/Browser 当前可执行 |
| S04 | P2 claim observation | Website ai-acceptance | `granted \| NO_ELIGIBLE_JOB \| CAPACITY_ZERO \| CLAIM_BLOCKED \| DRAINING` | 一次 claim 请求的控制面结果 | 不得统称“无任务”或“失败工单” |
| S05 | P2 accepted attempt | Website ai-acceptance | `active \| ended \| replaced` | 唯一业务尝试身份及其生命周期 | process、lease、target、error 不得创建 attempt |
| S06 | P2 lease/fence | Website ai-acceptance | `valid \| stale \| lost` | 当前 attempt 是否仍有执行预算 | 不证明 Browser mutation 未/已发生 |
| S07 | P3 Runtime task | AGENT Runtime | `accepted \| running \| terminal` | 本地执行和交付生命线 | terminal/Outbox delivered 不等于业务完成 |
| S08 | P4 Product Flow | 命中 route 的 Product Plugin | `active \| result \| typed_failure` | Product 私有 Flow 的业务结果 | 不得暴露为 Website step cursor |
| S09 | P5 Child decision | GPT Child | `DONE \| ACT \| WAIT \| FAIL_CLOSED` | 当前 Child 的局部决定 | 不等于 Website job 状态或 Product 下一步 |
| S10 | P6 Browser observation | Browser Authority | `absent \| exact_present \| mismatch \| pending` | 同一 Document 上的机械观察 | 不直接证明业务成功或恢复决定 |
| S11 | P6 mutation outcome | Browser WAL | `no \| dispatched \| confirmed` | 物理输入是否未发生、已派发或已确认 | deadline 前未取得 terminal 时保留既有 WAL，不得降级为 `no` |
| S12 | P6 Browser terminal | Browser Authority | `REJECTED \| DISPATCHED \| CONFIRMED` | 一次动作请求的机械终态 | 不替代 Child proof/Product result |
| S13 | P5 Child outcome | GPT Child | `success \| failed` | Child 对局部后置条件的证据结论 | 不替代证据持久 readback 或领域 admission |
| S14 | P3 Outbox | Runtime Outbox | `pending \| delivered \| receipt_not_observed_by_deadline` | 同一发送 intent 的 transport 状态 | delivered 不等于 staging/admission |
| S15 | P7 staging | Website ai-acceptance | `staged \| staging_rejected` | 结果是否通过外层机械合同并被暂存 | staged 不得解释领域内容或写 completed |
| S16 | P7 admission | Website Domain Consumer | `absent \| valid \| invalid` | 同一 job/result hash 的领域回执 | HTTP 200、日志或结果上传不可替代 |
| S17 | P7 Website 公开完成 | Website ai-acceptance | `public_completed` | 有效 admission 与业务域附加门闭合后的公开状态 | 不得由 Runtime/Outbox/staging 写入 |
| S18 | P6 cooldown 页面事实 | Browser Authority | `incident \| not_cleared \| confirmed_absent` | exact 限流观察、ack 与页面 clearance 事实 | 不等于 attempt failure、Website cooldown gate 或 claim capacity |
| S19 | P8 质量 | 各仓唯一 quality verdict | `CHANGE \| READY \| RELEASE` 的现役结论 | 代码候选、clean commit、动态生产证明的不同等级 | 不证明单个工单业务完成 |
| S20 | P3 Runtime 本地完成 | agent-production-runtime | `local_completed` | Runtime 机械校验同一 admission receipt 后的本地终态 | 不得先于有效 admission 或冒充 Website public completed |
| S21 | P7 Domain Consumer | 命中业务域的 Website Domain Consumer | `pending \| rejected \| admitted` | staged result 的领域解释和接纳结果 | 不得决定 Product/Browser 恢复 |
| S22 | P2 Website cooldown gate | Website ai-acceptance device authority | `blocked \| clearance_pending \| open` | Website server-time 与最新 incident/clearance receipt 形成的授权门 | 不等于 Browser 页面状态或 attempt failure |
| S23 | P5/P6 completed-answer artifact persistence | forensics-persistence-capability | `append_pending \| persisted \| readback_failed` | 仅已完成 GPT 回答的 task-owned raw artifact 持久化与完整性事实 | 普通 Child proof/failure 不落 Forensics；不解释 Product 恢复或业务完成 |

### 5.3 `N/G` 原子节点必填列

每一行必须同时填写以下字段，任何“同上”“正常处理”“适当重试”“视情况”均视为未闭合：

| 字段 | 必须回答的问题 |
|---|---|
| 表单 ID / 名称 | 这是哪个稳定原子责任 |
| 状态平面 | 它只能改变哪个平面的事实 |
| 唯一 Owner | 谁唯一拥有决定、动作或写入 |
| 权威入口与 identity | 哪些 job/request/attempt/effect/result 身份和前置事实允许进入 |
| 单一决定/动作 | 该行唯一可验收的责任是什么 |
| 副作用上限 | 只观察、`0..1` 或精确一次；作用域是什么 |
| 确认政策 | 引用哪个 `Txx`；初次、递增、次数、deadline 分别是什么 |
| 合法结果 | 成功、等待、拒绝、失败、截止未取得回执的封闭集合 |
| 成功记录与报告 | 哪个权威记录什么、先给哪个 consumer、如何 readback |
| 失败/截止未取得回执的记录与报告 | first typed failure、effect fact、proof/ref/hash 保留什么，交给谁 |
| 下一决定 Owner | 只写 Owner，不把下一具体步骤搬入公共层 |
| 业务完成关系 | 本行能证明什么、绝不能证明什么 |
| 现役证据 | law/Blueprint/contract/code/log 中的当前来源；没有来源的行不得进入表 |

### 5.4 `H` handoff 必填列

| 字段 | 必须回答的问题 |
|---|---|
| producer | 哪个 `Nxx/Gxx` 产生事实 |
| authoritative output | typed fact、持久真相或 receipt 是什么 |
| identity/contract binding | job/request/attempt/effect/result/hash/version 如何连续 |
| consumer | 哪个相邻 Owner 是真实消费者 |
| acceptance/readback | consumer 用什么独立回读证明接受 |
| rejection/failure/deadline-no-receipt | 三种非成功结果分别是什么确定事实，写在哪里 |
| recovery Owner/re-entry | 谁决定恢复，以什么事实接回哪条现役主链 |
| duplicate/omission prevention | 如何防止漏交、重复写、重放现实动作 |
| current evidence | 当前 authority/实现依据；不能证明时删除该行并阻断冻结 |

### 5.5 `T/O` 时钟与结果必填列

每个时钟必须记录时钟 Owner、初次观察、完整节拍或公式、最多次数/截止来源、每轮 pending 记录、成功终止、到期终止、物理动作上限及报告对象。每个结果必须区分 success、waiting、rejected、failed、`receipt/effect_not_provable_by_deadline` 和 identity conflict；后者是“到达 deadline 且缺少指定证明”的确定事实，不是模糊 `unknown`。不允许用一个 `error` 吞并。

### 5.6 冻结门

表单只有同时满足以下条件，才能由授权人确认并改为 `FROZEN`：

1. `S/N/R/G/T/H/O/I` 每一行均有稳定 ID，所有必填列非空；
2. I01–I36 每个已证明问题族至少回挂一个原子节点、一个 handoff 或一个结果行，且第一直接故障没有被下游报错覆盖；
3. 每项责任恰有一个 Owner，每条 handoff 的 producer/consumer/readback 可独立证伪；
4. 所有等待都有时钟 Owner、明确节拍和截止；所有现实动作都有 `0..1` 上限及“截止未取得指定证明”的确定处理规则；
5. 任一局部成功均未冒充领域 admission、Website public completed 或 RELEASE；
6. 反向审查未发现第二状态机、第二恢复结论、第二存储真相或 Product Flow 越权；
7. 授权人明确批准该版本；文档记录批准人、批准时间和规范化 SHA-256。

冻结后禁止原地静默改写。任何变化必须先建立“拓扑变更提案”，说明现有行为何错误/缺失、受影响 ID、Owner、consumer、代码范围和兼容影响；经审查及授权人批准后发布新版本、新 hash，再允许代码对照或施工。生产事故也不得先改代码后补表。

### 5.7 冻结后唯一代码对照产物（不属于拓扑事实表）

冻结拓扑不得再写入对照结果。代码对照与差异待修只允许写入以下唯一施工前方案：

`docs/项目方案/AGENT运行拓扑图-生产代码对照与差异待修-完整实现方案.md`

该文件必须引用本表版本和冻结 hash；只读对照生产代码，不运行会改变状态的测试、Browser、Provider、数据库或恢复动作。每个冻结 ID 恰有一个 `MATCH | MISMATCH | NO_EVIDENCE`，但只有 `MISMATCH/NO_EVIDENCE` 进入待修工单；MATCH 明细不得膨胀成第二拓扑副本。

---

## 6. `T` 现役时钟与确认政策

以下数值来自当前 candidate 上的现役合同与实现：GPT Child contract、`gpt-dom-observation.ts`、`production-browser-lifecycle.ts`、Browser extension、Runtime production transport/lease loop，以及 Website V6 provider。它们在本表中作为现役事实；冻结后代码对照只判断其它生产路径是否一致，不能把不一致反向降格为审批占位。

| ID | 时钟/确认政策 | 现役精确值 | 时钟 Owner | pending/成功记录 | 失败/到期记录与去向 |
|---|---|---:|---|---|---|
| T01 | ChatGPT 逻辑页访问门 | 相邻访问开始至少 1,500ms | Browser | pending 不改业务状态；成功绑定 coherent observation identity | Browser typed failure，返当前 Child |
| T02 | transient DOM 确认 | 初读 + 1,500ms + 3,000ms，同 Document | Browser | 两阶段 pending 只保留机械观察；成功取最新非 transient 值 | 第二阶段仍 transient 即 fail closed |
| T03 | 动作后 fresh readback | 最后一次物理输入后至少 2,500ms，首次裁决必须来自 fresh packet | Browser/WAL | `CONFIRMED` 或精确 `REJECTED` terminal | 保留 `DISPATCHED/REJECTED` 和 mutation outcome，禁止盲重放 |
| T04 | 已知限流弹窗 ack dispatch | exact dialog `observedAt` 后不晚于 1,000ms 进入唯一点击；随后 T03 | Browser/WAL | exact absent clearance 或 zero-action absent | 超时/仍 present 写 `not_cleared`，submit gate 保持关闭 |
| T05 | Browser command deadline | 默认 30,000ms；Runtime permit 受 lease 预算压到至多 20,000ms | Browser/Runtime | command pending 不重复派发；成功写 terminal receipt | typed timeout，不自动再发 |
| T06 | submit 后静默门 | 40,000ms | Browser lane | 到期后才可服务后续 lane | 继续等待 Provider，不创建第二状态 |
| T07 | Provider 回答/图片观察 | 每次请求先至少 70,000ms；全局相邻真实观察 70,000–90,000ms | GPT 给 deadline；Browser lane 给节拍 | pending 只 park/reobserve；成功为 exact adjacent turn 或 authenticated media proof | deadline 为 `GPT_RESPONSE_TIMEOUT` / `GPT_IMAGE_TIMEOUT` |
| T08 | stopped-empty 确认 | exact assistant 已停止且持续空内容 20 分钟 | GPT | 期间仍为 WAIT；成功写 `ProviderStoppedEmptyProof` | `GPT_RESPONSE_STOPPED_EMPTY`，交 Website 裁决 result revision |
| T09 | attachment settlement | 2s、3s、5s、7s、9s、11s，之后固定 11s，截止于 Product `timeoutMs` | GPT Child | pending 记录同一 expected set；成功写 exact approved set proof | mismatch 立即 fail；pending 到 deadline 为 upload timeout |
| T10 | exact-turn 虚拟列表物化 | 最多 48 步、每步 400ms、总预算至多 12s，command deadline 前保留 3s | Browser | 成功为 exact user turn 可观察 | unavailable/pending，不扩大 selector |
| T11 | authenticated image source 事件等待 | 单次 command 内至多 5,000ms | Browser | 成功为同次 authenticated bytes | typed pending，回到 T07 |
| T12 | worker 空闲迭代 | 可领取时 1,000ms；Website `next_claim_after_ms` 优先；本地异常 1s 翻倍至 30s | Runtime/Website receipt | claim receipt + Runtime span | typed runtime error；不创建 attempt |
| T13 | session heartbeat | 20,000ms | Runtime | attestation receipt | 无 fresh attestation 则 claim blocked |
| T14 | V6 session/attestation/claim control request | 30,000ms | Runtime `ProductionWorkerSession` transport | typed receipt | `CLOUD_TRANSPORT_UNAVAILABLE` / HTTP typed failure |
| T15 | lease renew | 每 20,000ms；仅 5xx/不可达按 5,000ms 重试，必须剩余至少 8,000ms | Runtime | renew receipt | 4xx/schema invalid 立即失败；预算耗尽 abort 当前执行 |
| T16 | Website lease 预算 | 当前签发 90,000ms，`renew_after_ms=20,000` | Website | lease/renew receipt | 失去 fresh lease/fence 后停止 mutation |
| T17 | Browser Authority liveness | heartbeat 20,000ms；missed tolerance 2,700,000ms | Browser transport | authenticated authority state | 超窗口 revoke，Runtime claim blocked |
| T18 | Website attempt 退避 | 只由 `retry_not_before` / accepted attempt count 现役政策决定 | Website | job runtime/current reason | AGENT 不计算、不复制 |

### 6.1 `N` 现役运行主链非 GPT 原子节点

N01–N28 只收录当前 law/Blueprint 与现役实现共同可定位的单一 Owner 责任。Runtime、Browser、Forensics 删除责任分别由 `runtime-business-admission.ts`、Browser Authority `purgeBrowserJob` 和 Forensics `deleteArtifactsForMission` 证明；它们不是一项宽泛“系统删除”。

| ID | 原子责任 / 状态平面 | 唯一 Owner | 权威入口、动作与确认 | 成功记录、消费者与 readback | 失败/截止未取得回执的记录、报告与回接 |
|---|---|---|---|---|---|
| N01 | 业务 task 创建授权 / P1 | R01–R40 各行声明的 Website Domain Sender | 同一业务事务冻结 subject、task/material/result contract 与 request hash | Website task；ai-acceptance/V6 按同一 request 读取 | 不创建 job 或 typed reason 回该 Rxx Sender |
| N02 | session open / P2 | Website ai-acceptance（Runtime 请求） | exact control contract；T14 | session credential；Runtime readback | typed 4xx/409/schema/transport；session/claim=0 |
| N03 | runtime attestation / P2 | Website ai-acceptance（Runtime 提交） | 现役 capability/identity；T13 | attestation receipt；claim consumer | stale/mismatch=`CLAIM_BLOCKED`；不签 grant |
| N04 | claim/grant/attempt / P2 | Website ai-acceptance | capacity、demand、retry_not_before；T12/T18 | grant + accepted attempt + lease + fence + result revision；Runtime readback | S04 封闭 outcome；Runtime 按 receipt 等待 |
| N05 | Runtime durable accept / P3 | agent-production-runtime | exact grant/attempt/lease/fence/contract；剩余预算满足现役门 | 本地 task-attempt binding；Mediator readback | accept 前门丢失则零业务副作用 release |
| N06 | materials 下载/readback / P3 | agent-production-runtime | 逐对象机械校验 hash/bytes/media/authorization | task-owned material receipt；Product 消费 | typed transport/material failure；Runtime→Website |
| N07 | Browser Target claim / P6 | local-browser-session | N05 后经唯一 FIFO/lane；T05/T17 | target claim receipt；GPT Child | unavailable/ambiguous/unresolved WAL；不猜 Tab |
| N08 | Mediator 单次路由 / P4 边界 | architecture-boundary | `product_id + action_id + contract version` 精确命中一次 | 恰好一个 Product invocation | unsupported/duplicate/mismatch；Runtime→Website |
| N09 | Product 业务 Flow / P4 | 命中 route 的具体 Product Plugin | 只在当前 attempt/lease/abort 预算内决定 Child/skip/repeat/result | Product result 或一次 Child 调用；Product 自己读回 | first typed Product/Child failure；Runtime→Website；不公开 cursor |
| N10 | Browser observation / P6 | local-browser-session | T01/T02；同包 current Document/revision；零动作 | coherent typed fact；GPT Child | stale/missing/ambiguous/pending；当前 Child 决定 WAIT/FAIL |
| N11 | Browser mutation/WAL / P6 | local-browser-session | pre-dispatch WAL；`0..1` input；T03/T05 | S11/S12 + WAL readback；GPT Child | unresolved `DISPATCHED` 保留原 identity，禁止重放 |
| N12 | completed-answer raw artifact 持久 / P5/P6 | forensics-persistence-capability | 仅成功的文本/图片答案 checkpoint 按 exact task/attempt/call identity append、readback、hash；普通 Child terminal/failure 写入增量为 0 | raw artifact ref/hash；当前 Product 调用链 | 写入或 readback 不闭合则该答案 checkpoint 不得成功；不得新增逐 Child ledger |
| N13 | Runtime lease renew 与执行预算 / P3 | agent-production-runtime | T15；只请求并消费同一 attempt 的 Website renew receipt | fresh receipt 绑定当前 execution；继续执行 | 4xx/schema invalid/预算耗尽 abort；不创建 attempt |
| N14 | result Outbox / P3 | agent-production-runtime 的唯一 Outbox | 同 `job + attempt + result hash` 一份幂等 intent | transport receipt；Website staging readback | deadline 未观察到 receipt 时查询同一 intent；不重做 Product/Provider |
| N15 | attempt failure fact 投影与运输 / P3 | agent-production-runtime | 同 `(job_id, attempt_id)` 对外复用同一 first typed fact/identity | typed payload/hash；Website ai-acceptance readback | deadline 未取得 transport receipt 时只查同一请求；409 停止写入并读回原 fact |
| N16 | cooldown 页面 incident/ack/clearance fact / P6 | local-browser-session | exact dialog 观察；T04/T03；`0..1` ack | S18 + WAL/observation identity；Runtime 消费 | mismatch/not_cleared/pending 保持 submit 关闭；不写 attempt failure |
| N17 | Domain admission / P7 | R01–R40 各行声明的 Website Domain Consumer | 同 job/result hash 重消费 staged result | admission receipt + domain-object readback | pending/consumer rejection 保持未完成且不重跑 Provider |
| N18 | Website public completed / P7 | Website ai-acceptance | 仅 N17 valid receipt + 业务域附加门 | S17；Website job readback | receipt/附加门不闭合即保持未完成 |
| N19 | Website admin deletion/permanent revocation / P1/P2 | Website 唯一授权 Owner | 先按有效 admission closure 与确认计数重算，再持久删除/撤销事实 | exact Website absence/revocation readback | 漂移稳定 409、删除增量 0 |
| N20 | Website attempt failure 持久与恢复决定 / P2 | Website ai-acceptance | 接收 N15；同 attempt 幂等比较并写唯一 failure fact | 原 fact + `ACTIVE_ATTEMPT \| WAIT_NEW_ATTEMPT \| CONSUME_CURRENT_RESULT` readback | 矛盾稳定 409；不让 Runtime 改写或代决策 |
| N21 | Runtime local completed / P3 | agent-production-runtime | 机械校验当前 job/result hash 的 N17 admission receipt | S20 本地 task readback | receipt/hash 不等即保持未完成 |
| N22 | Website result staging / P7 | Website ai-acceptance | 接收 N14；只校验外层机械合同与同一 result identity | S15 staged readback；Domain Consumer 消费 | staging rejection typed fact；不解释领域内容 |
| N23 | cooldown Outbox 运输 / P3 | agent-production-runtime 的唯一 Outbox | N16 incident 必须先于 ack/clearance 有持久 intent；复用同一 Outbox | Website receipt readback | receipt 未到保持本地 submit gate；不另建表/worker |
| N24 | Website cooldown gate / P2 | Website ai-acceptance 的 device authority | 接收 N23；以 Website server time 与最新 incident/clearance receipt 裁决 | S22 + claim/submit 授权 readback | `not_cleared` 永不开门；pending 保持 blocked |
| N25 | Website lease renew/fence 签发 / P2 | Website ai-acceptance | T16；验证当前 attempt/fence 后签发 renew receipt | lease/renew receipt；N13 消费 | stale/invalid/ended 拒绝；不改变 Browser WAL |
| N26 | Runtime exact job purge / P3 | agent-production-runtime | 仅消费 N19 exact absence/revocation；删除 exact job 的 task/Outbox/material/result | Runtime 自有对象缺席 readback | 任一删除失败即 typed failure；其它 job 不变 |
| N27 | Browser exact job purge / P6 | local-browser-session | 仅消费 N19 exact absence/revocation；按现役门删除 exact job Target/WAL 私有对象 | Browser 自有对象缺席 readback | unresolved effect 或删除失败即 fail closed；其它 job 不变 |
| N28 | Forensics exact job purge / P5/P6 | forensics-persistence-capability | 仅消费 N19 exact absence/revocation；删除 exact job task-owned artifacts | artifact 缺席 readback | 删除失败 typed report；其它 job evidence 不变 |

### 6.2 `R` 现役 route—Product Owner 绑定

R01–R40 来自 AGENT 当前 `website-agent-route-policies.v1.json` 的完整 route 分母，并已逐行绑定 Website 当前 sender 与 consumer 文件；机械集合比较为 40/40，无多余或缺失 route。表内只公开相邻 Owner，不公开 Product 私有 Flow。

本表机械来自当前 `src/mediator/product-plugin-catalog.ts` 与 Website route policy 的 40 条分母。它只证明 N08 应把 route 精确交给哪个 Product Plugin；不复制 Product Prompt、Child 顺序或内部 Flow。task/result contract version 的当前 catalog projection 均为 1，冻结后仍须逐行对照双方 canonical contract。

| ID | `product_id + action_id` | AGENT Product Plugin Owner / 路径 | Website Domain Sender / 路径 | Website Domain Consumer / 路径 |
|---|---|---|---|---|
| R01 | `bazi_chart_interpretation + produce` | `bazi-chart-interpretation` / `src/plugins/bazi-chart-interpretation/**` | `bazi` / `services/api/src/bazi-agent-dispatch.ts` | `bazi-result-consumer.v1` / `services/api/src/bazi-agent-result-consumer.ts` + `bazi-business-completion.ts` |
| R02 | `bazi_ai_full_analysis + produce` | `bazi-ai-full-analysis` / `src/plugins/bazi-ai-full-analysis/**` | `bazi` / `services/api/src/bazi-agent-dispatch.ts` | `bazi-result-consumer.v1` / `services/api/src/bazi-agent-result-consumer.ts` + `bazi-business-completion.ts` |
| R03 | `bazi_report_followup + followup` | `bazi-report-followup` / `src/plugins/bazi-report-followup/**` | `bazi` / `services/api/src/bazi-agent-dispatch.ts` | `bazi-result-consumer.v1` / `services/api/src/bazi-agent-result-consumer.ts` + `bazi-business-completion.ts` |
| R04 | `qimen_professional_answer + produce` | `qimen-professional-answer` / `src/plugins/qimen-professional-answer/**` | `qimen` / `services/api/src/qimen/qimen-agent-task-dispatcher.ts` | `qimen-result-consumer.v1` / `services/api/src/qimen/qimen-agent-result-consumer.ts` |
| R05 | `qimen_report_followup + followup` | `qimen-report-followup` / `src/plugins/qimen-report-followup/**` | `qimen-commercial` / `services/api/src/commercial/qimen-followup-fulfillment.ts` | `qimen-followup-result-consumer.v1` / `services/api/src/commercial/qimen-followup-agent-result-consumer.ts` |
| R06 | `hehun_ai_analysis + produce` | `hehun-ai-analysis` / `src/plugins/hehun-ai-analysis/**` | `hehun` / `services/api/src/hehun/hehun-agent-task-dispatcher.ts` | `hehun-result-consumer.v1` / `services/api/src/hehun/hehun-agent-result-consumer.ts` |
| R07 | `hehun_report_followup + followup` | `hehun-report-followup` / `src/plugins/hehun-report-followup/**` | `hehun-commercial` / `services/api/src/commercial/hehun-followup-fulfillment.ts` | `hehun-followup-result-consumer.v1` / `services/api/src/commercial/hehun-followup-agent-result-consumer.ts` |
| R08 | `naming_bazi_analysis_and_naming + produce` | `naming-bazi-analysis-and-naming` / `src/plugins/naming-bazi-analysis-and-naming/**` | `naming` / `services/api/src/naming/naming-task-service.ts` | `bazi-result-consumer.v1` / `services/api/src/bazi-agent-result-consumer.ts` |
| R09 | `naming_from_existing_bazi_report + produce` | `naming-from-existing-bazi-report` / `src/plugins/naming-from-existing-bazi-report/**` | `naming` / `services/api/src/naming/naming-task-service.ts` | `naming-result-consumer.v1` / `services/api/src/naming/naming-agent-result-consumer.ts` |
| R10 | `public_knowledge_article_pipeline + produce_article` | `public-knowledge-article-pipeline` / `src/plugins/public-knowledge-article-pipeline/**` | `public-knowledge-content` / `services/api/src/public-knowledge/execution-service.ts` | `public-knowledge-result-consumer.v1` / `services/api/src/public-knowledge/agent-result-consumer.ts` |
| R11 | `localization_report_translation + report_translation` | `localization-production` / `src/plugins/localization-production/**` | `localization` / `services/api/src/localization/localization-composition-root.ts` | `localization-result-consumer.v1` / `services/api/src/localization/localization-completion-worker.ts` |
| R12 | `localization_article_translation + article_translation` | `localization-production` / `src/plugins/localization-production/**` | `localization` / `services/api/src/localization/localization-composition-root.ts` | `localization-result-consumer.v1` / `services/api/src/localization/localization-completion-worker.ts` |
| R13 | `localization_static_catalog + produce_locale_catalog` | `localization-production` / `src/plugins/localization-production/**` | `localization` / `services/api/src/localization/localization-static-catalog-command.ts` | `localization-static-candidate-set-consumer.v1` / `services/api/src/localization/localization-static-catalog-consumer.ts` |
| R14 | `payment_screenshot_observation + observe` | `payment-screenshot-observation` / `src/plugins/payment-screenshot-observation/**` | `commercial-payment` / `services/api/src/commercial/payment-evidence-agent.ts` | `payment-evidence-result-consumer.v1` / `services/api/src/commercial/payment-evidence-agent.ts` |
| R15 | `bazi_chart_interpretation + accuracy_challenge` | `bazi-chart-interpretation` / `src/plugins/bazi-chart-interpretation/**` | `ai-acceptance review` / `services/api/src/ai-production/review-challenge-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R16 | `bazi_chart_interpretation + quality_reflection` | `bazi-chart-interpretation` / `src/plugins/bazi-chart-interpretation/**` | `ai-acceptance review` / `services/api/src/ai-production/quality-reflection-schedule-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R17 | `bazi_ai_full_analysis + accuracy_challenge` | `bazi-ai-full-analysis` / `src/plugins/bazi-ai-full-analysis/**` | `ai-acceptance review` / `services/api/src/ai-production/review-challenge-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R18 | `bazi_ai_full_analysis + quality_reflection` | `bazi-ai-full-analysis` / `src/plugins/bazi-ai-full-analysis/**` | `ai-acceptance review` / `services/api/src/ai-production/quality-reflection-schedule-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R19 | `bazi_report_followup + accuracy_challenge` | `bazi-report-followup` / `src/plugins/bazi-report-followup/**` | `ai-acceptance review` / `services/api/src/ai-production/review-challenge-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R20 | `bazi_report_followup + quality_reflection` | `bazi-report-followup` / `src/plugins/bazi-report-followup/**` | `ai-acceptance review` / `services/api/src/ai-production/quality-reflection-schedule-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R21 | `qimen_professional_answer + accuracy_challenge` | `qimen-professional-answer` / `src/plugins/qimen-professional-answer/**` | `ai-acceptance review` / `services/api/src/ai-production/review-challenge-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R22 | `qimen_professional_answer + quality_reflection` | `qimen-professional-answer` / `src/plugins/qimen-professional-answer/**` | `ai-acceptance review` / `services/api/src/ai-production/quality-reflection-schedule-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R23 | `qimen_report_followup + accuracy_challenge` | `qimen-report-followup` / `src/plugins/qimen-report-followup/**` | `ai-acceptance review` / `services/api/src/ai-production/review-challenge-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R24 | `qimen_report_followup + quality_reflection` | `qimen-report-followup` / `src/plugins/qimen-report-followup/**` | `ai-acceptance review` / `services/api/src/ai-production/quality-reflection-schedule-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R25 | `hehun_ai_analysis + accuracy_challenge` | `hehun-ai-analysis` / `src/plugins/hehun-ai-analysis/**` | `ai-acceptance review` / `services/api/src/ai-production/review-challenge-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R26 | `hehun_ai_analysis + quality_reflection` | `hehun-ai-analysis` / `src/plugins/hehun-ai-analysis/**` | `ai-acceptance review` / `services/api/src/ai-production/quality-reflection-schedule-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R27 | `hehun_report_followup + accuracy_challenge` | `hehun-report-followup` / `src/plugins/hehun-report-followup/**` | `ai-acceptance review` / `services/api/src/ai-production/review-challenge-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R28 | `hehun_report_followup + quality_reflection` | `hehun-report-followup` / `src/plugins/hehun-report-followup/**` | `ai-acceptance review` / `services/api/src/ai-production/quality-reflection-schedule-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R29 | `naming_bazi_analysis_and_naming + accuracy_challenge` | `naming-bazi-analysis-and-naming` / `src/plugins/naming-bazi-analysis-and-naming/**` | `ai-acceptance review` / `services/api/src/ai-production/review-challenge-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R30 | `naming_bazi_analysis_and_naming + quality_reflection` | `naming-bazi-analysis-and-naming` / `src/plugins/naming-bazi-analysis-and-naming/**` | `ai-acceptance review` / `services/api/src/ai-production/quality-reflection-schedule-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R31 | `naming_from_existing_bazi_report + accuracy_challenge` | `naming-from-existing-bazi-report` / `src/plugins/naming-from-existing-bazi-report/**` | `ai-acceptance review` / `services/api/src/ai-production/review-challenge-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R32 | `naming_from_existing_bazi_report + quality_reflection` | `naming-from-existing-bazi-report` / `src/plugins/naming-from-existing-bazi-report/**` | `ai-acceptance review` / `services/api/src/ai-production/quality-reflection-schedule-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R33 | `public_knowledge_article_pipeline + accuracy_challenge` | `public-knowledge-article-pipeline` / `src/plugins/public-knowledge-article-pipeline/**` | `ai-acceptance review` / `services/api/src/ai-production/review-challenge-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R34 | `public_knowledge_article_pipeline + quality_reflection` | `public-knowledge-article-pipeline` / `src/plugins/public-knowledge-article-pipeline/**` | `ai-acceptance review` / `services/api/src/ai-production/quality-reflection-schedule-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R35 | `localization_report_translation + accuracy_challenge` | `localization-production` / `src/plugins/localization-production/**` | `ai-acceptance review` / `services/api/src/ai-production/review-challenge-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R36 | `localization_report_translation + quality_reflection` | `localization-production` / `src/plugins/localization-production/**` | `ai-acceptance review` / `services/api/src/ai-production/quality-reflection-schedule-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R37 | `localization_article_translation + accuracy_challenge` | `localization-production` / `src/plugins/localization-production/**` | `ai-acceptance review` / `services/api/src/ai-production/review-challenge-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R38 | `localization_article_translation + quality_reflection` | `localization-production` / `src/plugins/localization-production/**` | `ai-acceptance review` / `services/api/src/ai-production/quality-reflection-schedule-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R39 | `payment_screenshot_observation + accuracy_challenge` | `payment-screenshot-observation` / `src/plugins/payment-screenshot-observation/**` | `ai-acceptance review` / `services/api/src/ai-production/review-challenge-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |
| R40 | `payment_screenshot_observation + quality_reflection` | `payment-screenshot-observation` / `src/plugins/payment-screenshot-observation/**` | `ai-acceptance review` / `services/api/src/ai-production/quality-reflection-schedule-repository.ts` | `ai-review-result-consumer.v1` / `services/api/src/ai-production/quality-reflection-finding-repository.ts` |

---

## 7. `G` 现役 GPT 原子 Child

G01–G14 记录 v2 的原子职责；G04–G06 自 v3 退休且保留历史原义。v4 沿用 G15–G17 唯一现役 ID，不新增 Child；其它 G ID 不变。

| ID | 原子 Child / 状态平面 | 单一责任与动作上限 | 确认政策 | 成功记录、消费者与 readback | 失败/截止未取得证明的记录、报告与回接 |
|---|---|---|---|---|---|
| G01 | `acknowledge_known_gpt_rate_limit` / P5-P6 | exact 弹窗 ack，精确 1 次 input | T02+T04+T03 | Child proof + ack WAL + clearance；N16 | incident、`not_cleared`、proof/effect 原样保留；Runtime→Website |
| G02 | `prepare_clean_gpt_chat` / P5-P6 | 证明 fresh Chat root/清理孤立 draft，`0..1` | T01+T02+T03 | Child proof；Product readback | typed failed proof/effect；Runtime→Website |
| G03 | `open_gpt_execution_profile` / P5-P6 | 打开 profile，`0..1`；允许 slider max=5 | T01+T02+T03；min=0，整数 0<=now<=max<=5 | Child proof；Product | typed failed proof/effect；Runtime→Website |
| G04 | RETIRED：`open_gpt_model_selector_v2` / P5-P6 | v2 使 Product exact 模型选项可用，`0..1` | v2 T01+T02+T03 | v2 Child proof；由 G15 接替，不再作为新工单执行锚点 | v2 typed failed proof/effect 仍按历史原义解读 |
| G05 | RETIRED：`select_exact_gpt_model_v2` / P5-P6 | v2 选择 Product exact 模型，精确 1 次 | v2 T03；`aria-checked=true` + selector 退出 | v2 Child proof；由 G16 接替，不再作为新工单执行锚点 | v2 typed failed proof/effect 仍按历史原义解读 |
| G06 | RETIRED：`ensure_gpt_reasoning_requirement` / P5-P6 | v2 满足 Product 冻结 reasoning，`0..1` | v2 T02+T03 | v2 Child proof；由 G17 接替，不再作为新工单执行锚点 | v2 typed failed proof/effect 仍按历史原义解读 |
| G07 | `close_gpt_execution_profile` / P5-P6 | 关闭 profile，`0..1` | T03；popup absent + trigger collapsed + composer usable | Child proof；Product | typed failed proof/effect；Runtime→Website |
| G08 | `open_gpt_attachment_control` / P5-P6 | 打开附件菜单，`0..1` | T02+T03；unique menu/leaf | Child proof；Product | typed failed proof/effect；Runtime→Website |
| G09 | `attach_approved_gpt_files_once` / P5-P6 | 一批选择全部批准文件，`0..1` | T02+T03+T09 | Child proof + target-local WAL；Product | proof/effect 原样保留；Runtime→Website |
| G10 | `reconcile_gpt_attachment_set` / P5 | 证明全部且仅有批准附件，0 动作 | T09 | exact set Child proof；Product | mismatch 立即 failed；deadline upload timeout |
| G11 | `write_exact_gpt_prompt` / P5-P6 | 写入 exact Prompt，`0..1` | T02+T03；retained editable hash | Child proof + target-local WAL；Product | proof/effect 原样保留；Runtime→Website |
| G12 | `submit_exact_gpt_turn_once` / P5-P6 | 一次 Provider effect，精确 1 次 submit | exact outgoing identity + WAL + T03+T06 | Child proof + provider-effect WAL；Product | S11/S12 与 effect identity 原样保留；Runtime→Website |
| G13 | `checkpoint_gpt_text_response` / P5-P6 | 读取 exact adjacent assistant text，0 动作 | T07+T08+Product deadline | raw DOM + semantic task artifact + proof；Product | timeout/stopped-empty/typed DOM failure proof；Runtime→Website |
| G14 | `checkpoint_gpt_generated_image` / P5-P6 | 读取 exact adjacent image bytes，0 动作 | T07+T11+Product deadline | authenticated bytes artifact + proof；Product | timeout/source/identity failure proof；Runtime→Website |
| G15 | v4 模型子菜单开启 / P5-P6 | 唯一“选择模型”入口 `0..1` 点击；真实呈现则零输入 | T01+T02+T03；2500ms 后 fresh 证明子菜单与指定模型选项真实呈现，不以 opacity-hidden 展开入口为唯一后置 | Browser fresh fact→GPT→Product | 未呈现/多义/未决保留 WAL 并 typed failure，不盲点；Runtime→Website |
| G16 | v4 精确模型选择 / P5-P6 | Product 指定模型唯一且可操作；不论此前是否选中都点击一次，无后缀替代 | T01+T02+T03；核点击节点选中且模型列表关闭 | 精确模型及 Browser WAL 机械终态交 Product | 缺失/禁用/多义/漂移/未决失败；绝不换模型；Runtime→Website |
| G17 | v4 数值推理选择 / P5-P6 | 紧接 G16，读唯一可用“能力”控件及滑块 min/max/now；目标 min(Product 要求 0..5, 当前 max)，相等时点击滑块柄一次，否则一次有界 keypress | T01+T02+T03；min=0 且 0<=now<=max<=5，Browser 动作确认及 fresh 读回唯一滑块 now=目标 | 数值仅调用期交 Product，不入 Website 持久任务 | 无效/多义/读回不等/未决 typed failure，Runtime→Website |

`DONE/ACT/WAIT/FAIL_CLOSED` 是 Child 内部局部决定字母表，不是 Website job 状态。`WAIT` 只能在同一 Child 的既有 deadline 内 park/reobserve，不能创建新 attempt、新 timer Owner 或新恢复分支。

---

## 8. `O` 现役结果、截止无回执、恢复与 409 矩阵

### 8.1 原子结果共同规则

| ID | 场景 | 必须保留的权威事实 | 首个消费者 / 下一决定 Owner | 绝不能证明 |
|---|---|---|---|---|
| O01 | Child 局部成功 | Child proof；有 mutation 时绑定 WAL ref/hash | Product / Product | 业务完成、Website admission |
| O02 | Child 局部失败 | first typed failure + proof + 已存在的 effect fact | Product→Runtime / Website ai-acceptance 只决定 attempt 恢复 | cleanup 或 lease error 不得覆盖第一故障 |
| O03 | Browser effect 截至 deadline 无法证明 terminal | 原 WAL identity、`DISPATCHED` 与 deadline/no-receipt fact | GPT Child→Product→Runtime；Browser 只做同 effect reconcile | 不得降级为 `mutation=no`，不得重放 |
| O04 | Provider effect 已 confirmed | effect identity + exact postcondition/readback | Product；需要恢复时 Website 保留同 attempt | 不得重新 prepare/submit |
| O05 | Runtime transport receipt 截至 deadline 未观察到 | 同一 Outbox intent/idempotency key + deadline/no-receipt fact | Runtime Outbox | 不得重做 Product/Provider |
| O06 | Website staging 成功 | staged payload identity/hash | Domain Consumer | 不得写 public/local completed |
| O07 | Domain admission 成功 | admission receipt + domain-object readback | Website ai-acceptance，随后 Runtime | 不等于 RELEASE |
| O08 | 同 attempt failure identity 冲突 | Website 已持久原 fact + 新 payload/hash 的矛盾证据 | Website ai-acceptance | 不得当 5xx 重试或创建 replacement job |

现役不变量：外层只能保留 first typed failure 并附加 `caused_by` 诊断链，不能把它重命名成通用 Product/Runtime failure。是否需要 Runtime 新增某种 canonical failure 持久化，属于冻结后代码对照才能裁决的实现问题；本表只固定“同一 attempt 对外事实必须单调且不可矛盾”的边界，不预选实现。

### 8.2 Website 现役恢复矩阵

| ID | AGENT 精确事实 | Website 唯一决定 | 物理 Provider 动作 |
|---|---|---|---:|
| O09 | `target_local + REJECTED + no\|dispatched\|confirmed` | 结束旧 attempt；按现役 `retry_not_before` 决定是否签新 attempt | 旧 attempt 为 0 |
| O10 | `provider_effect + mutation_outcome=no` | 结束旧 attempt；有限退避后可签新 attempt | 仅新授权可首次 submit |
| O11 | `provider_effect + dispatched\|confirmed` | 保留同 accepted attempt，仅 `ACTIVE_ATTEMPT` 同 effect 读回 | submit 增量=0 |
| O12 | `target_local + DISPATCHED` | 保留旧 attempt，fail closed | 0 |
| O13 | `target_local + CONFIRMED + confirmed` | 保留旧 attempt，fail closed | 0 |
| O14 | 缺字段、非法、矛盾或 stale lease | 保留旧 attempt，fail closed | 0 |
| O15 | 已有 result 且 Website 明确 `RESULT_REVISION_REJECTED` | 新 result revision / 新 effect identity | 仅新身份可 submit |
| O16 | staged/terminal 存在但无 admission receipt | `CONSUME_CURRENT_RESULT` | 0；只继续 Domain Consumer |

上述恢复决定只能由 Website 现役 authority 拥有。本表只记录已存在的恢复语义，不执行恢复、不创建 per-step ledger，也不授权 AGENT 根据表单签发新 attempt。

### 8.3 操作频繁弹窗与 409 分支

| ID | Browser 观察/既有事实 | 动作上限 | 必须记录和报告 | 后续 Owner 与行为 | 是否直接 409 |
|---|---|---:|---|---|---:|
| O17 | `absent` | 0 | clearance observation（仅 cooldown clearance probe） | N16 等待 Website server-time 门或正常执行 | 否 |
| O18 | `exact_present` | 先持久 incident；ack `0..1` | dialog fact、observation identity/hash、ack WAL、`confirmed_absent\|not_cleared` | submit gate 关闭；Website device authority 决定 cohort/cooldown | 否 |
| O19 | `mismatch`：可见但文本/结构/按钮不唯一 | 0 | `BROWSER_GPT_DIALOG_UNRECOGNIZED` + 已观察机械事实 | fail closed；不猜按钮、不改写成普通限流 | 否 |
| O20 | ack 后仍 present 或 ack 失败 | 0 次追加点击 | `not_cleared` + 原 incident/effect fact | cooldown 保持，等待明确 clearance | 否 |
| O21 | 同 attempt 已有另一 failure fact | 0 | 原 fact 与新 payload/hash 矛盾 | Website 稳定拒绝；Runtime 停止写入并读回原 fact | 是 |

现役结论：操作频繁弹窗本身不会立即制造 409。只有同一 `(job_id, attempt_id)` 已持久一份 failure fact，随后又写入不兼容事实时才触发 409。cooldown incident、attempt failure、claim capacity 与 existing effect closure 分属不同状态平面，禁止互相覆盖。

### 8.4 `H` 现役 Owner handoff 索引

| ID | producer → consumer | authoritative output / identity | consumer acceptance/readback | 非成功结果与 recovery Owner |
|---|---|---|---|---|
| H01 | Domain Sender → ai-acceptance | task/material/result contract + request hash | Website job 精确绑定同 request | 拒绝则不创建 job；Domain Sender 修正/撤销 |
| H02 | Runtime → ai-acceptance | session request + control/device identity | Website exact-parse 并持久签发或拒绝 | 4xx/409/schema/transport；Website session Owner |
| H03 | Runtime → ai-acceptance | attestation identity/contract | Website receipt；claim 仅消费 fresh receipt | stale/mismatch；Website 阻断 claim |
| H04 | ai-acceptance → Runtime | job + accepted attempt + lease + fence + revision | Runtime N05 durable binding | S04/invalid grant；Website 决定是否再签发 |
| H05 | Runtime → Product | exact route + task/materials + attempt binding | Product invocation 精确一次 | unsupported/mismatch；Runtime 上报 Website |
| H06 | Product → GPT Child | Product 私有调用输入 + call identity/deadline | Child 验证 authority inputs | typed rejection/failure；Product 决定下一业务动作 |
| H07 | GPT Child → Browser | typed observation/mutation request + effect identity | Browser receipt/WAL/direct readback | rejected/dispatched/deadline-no-receipt；Browser 只 reconcile 同 effect |
| H08 | Browser → GPT Child | coherent observation 或 S11/S12 terminal | Child direct postcondition | stale/ambiguous/pending；Child WAIT/FAIL |
| H09 | 成功的 GPT 答案 checkpoint → Forensics | completed-answer raw artifact append intent + exact task/attempt/call identity | Forensics append/readback/hash | 写入/readback 失败；该答案 checkpoint 不能成功；普通 Child/failure 不进入 Forensics |
| H10 | Product → Runtime | result 或 first typed failure + evidence refs | Runtime exact result/failure binding | contract mismatch；Runtime 不解释 Product 语义 |
| H11 | Runtime Outbox → Website staging | one intent + job/attempt/result hash | transport receipt + staging readback | deadline 未取得 receipt 时查同一 intent；Runtime Outbox 恢复 |
| H12 | Website staging → Domain Consumer | staged payload + job/result hash | 领域对象 + admission receipt | consumer rejection/pending；Domain Consumer Owner |
| H13 | Domain Consumer → ai-acceptance | admission receipt + domain readback | Website 验证 receipt 与附加完成门 | invalid/absent 保持未完成 |
| H14 | ai-acceptance → Runtime | public completion/admission receipt identity | Runtime 机械校验后 local completed | hash/receipt 不等保持未完成 |
| H15 | Runtime failure → ai-acceptance | 同 attempt 单调 failure fact | Website 原 fact/next action readback | 409 读回原 fact；Website recovery Owner |
| H16 | Browser → Runtime cooldown Outbox | N16 incident/ack/clearance fact + effect identity | N23 intent/readback；incident 必须先于 ack/clearance 交付 | pending/not_cleared 保持本地 submit gate |
| H17 | ai-acceptance → Runtime | session credential/receipt | Runtime 验证并绑定有效 session | stale/rejected/deadline-no-receipt；session/claim=0 |
| H18 | Forensics → 当前 Product 调用链 | completed-answer raw artifact ref/hash | 当前调用链读回 artifact 完整性并消费 | 缺失/不等；该答案 checkpoint 保持失败 |
| H19 | Runtime cooldown Outbox → Website device authority | incident/ack/clearance intent + idempotency identity | N24 receipt + server-time/cohort gate readback | deadline 未取得 receipt 时查同一 intent；不另建队列 |
| H20 | Website lease authority → Runtime | renew receipt + current attempt/fence/expiry | N13 验证并更新进程内预算 | stale/invalid/ended；Runtime abort |
| H21 | Website deletion/revocation → Runtime | exact job absence/revocation fact | N26 Runtime-owned absence readback | 失败报告 Website；其它 job 不动 |
| H22 | Website deletion/revocation → Browser | exact job absence/revocation fact | N27 Browser-owned absence readback | unresolved effect/失败则停；其它 job 不动 |
| H23 | Website deletion/revocation → Forensics | exact job absence/revocation fact | N28 artifact absence readback | 删除失败 typed report；其它 job 不动 |
| H24 | ai-acceptance → Runtime | attestation receipt + freshness/identity | Runtime 读回并仅以 fresh receipt 进入 N04 claim | stale/mismatch；claim=0 |

H01–H24 只描述相邻 Owner 的事实交付，不执行步骤、不安排 timer、不保存活体状态。找不到真实 producer、consumer 或独立 readback 的关系不得进入本索引，并直接阻断整版冻结，不能用推测补齐。

---

## 9. `I` 问题族到冻结表单的唯一交叉索引

本索引把每个已经证明的问题族回挂到唯一事实行；第三列是现役强制约束，不是待回答问题，也不证明全部生产代码已经匹配。

| 问题族 | 主要拓扑行 | 现役强制约束 |
|---|---|---|
| I01 | §5 全表、H01–H24 | 本文件是双方唯一人工冻结基线，不是新 runtime contract |
| I02 | S02–S06、N02–N05、H02–H04 | session/attestation/grant/attempt identity 逐边连续且不可互相替代 |
| I03 | S01、S04、N01/N04、T12/T18 | claim 的每个结果保持原码，不得压成“无任务” |
| I04 | S06/S19、N13/N25、T13–T16、H20 | infrastructure first cause 不得改写成业务失败 |
| I05 | S05–S07、N05/N13/N20/N25、H04/H15/H20 | stale fence、redelivery、completed/replaced 分属各自唯一 Owner |
| I06 | N07/N10/N11、H07/H08 | Target/Document 缺失或漂移时 Provider 物理重放增量为 0 |
| I07 | S11/S12、N11、O03、H07/H08 | deadline 未取得 receipt 时保留原 WAL，不得写成 `mutation=no` |
| I08 | T01–T03、N10/N11、G02–G11 | DOM missing/ambiguous/transient/postcondition 具有封闭 typed result |
| I09 | G03、G07、G15–G17、O02、H10 | model/profile/reasoning first failure 原样传递；G04–G06 只保留 v2 历史语义，不进入新执行链 |
| I10 | T09、G09/G10 | exact attachment set、节拍和 deadline 同一绑定 |
| I11 | T01/T07、G13/G14、N07/N10 | 首次观察、全局 lane、eligibleAt 与 deadline 使用同一现役政策 |
| I12 | G13/G14、T07、H08 | checkpoint 使用 bounded observation；不得新增持续 DOM watcher |
| I13 | T07/T08、G13、O02 | adjacent turn、stopped-empty 与 Product usable 分层裁决 |
| I14 | S10/S18/S22、T03/T04、G01、N16/N23/N24、O17–O20、H16/H19 | 弹窗观察、ack、clearance、cooldown 完整分层且不自行制造 attempt failure |
| I15 | S10、G01、O17–O20 | visible text/actionability 必须区分 absent、exact_present 与 mismatch |
| I16 | S11/S12、G12、O03/O04/O11、H07/H08 | prepare 前先读回同一 confirmed effect identity |
| I17 | G12、O03/O04/O11、H07/H08 | dispatched/confirmed 后 submit 增量为 0 |
| I18 | S23、N12、H09/H18 | 只有已完成答案 raw artifact 的 append、readback 与 hash 属于 Forensics；普通 Child proof 留在当前执行内存，Browser 机械终态由 Browser WAL 持久，Runtime 故障由现役 current reason/runtime log 记录，三者不得合并成第二 ledger |
| I19 | S15/S16/S21、N14/N17/N22、O06/O16、H11/H12 | staged 被拒后只重消费同一 payload，不重跑 Provider |
| I20 | S14–S17/S20/S21、N14/N17/N18/N21/N22、O05–O07、H11–H14 | transport、staging、public/local completed 均不得冒充领域入库 |
| I21 | N15/N20、O02/O08/O21、H15 | 同 attempt failure 单调；409 后停止重写并读回原 fact |
| I22 | T14、N14、O05、H11 | transport redelivery 只重投同一 intent |
| I23 | S03/S04、N03/N04/N08 | capability admission、业务容量和 Product failure budget 分开 |
| I24 | N09、R11–R13/R35–R38、H05/H06 | localization 只有命中 route 的具体 Product Plugin 拥有业务 Flow |
| I25 | S05–S07/S11、N05/N11/N13/N25 | in-flight effect/session 存在时禁止不安全切换 |
| I26 | N17–N19/N21/N26–N28、H12–H14/H21–H23 | 先读回 admission closure，再删除未完成私有子图 |
| I27 | N01/N09、S19 | Website 排程、Product Flow 与 Codex/Skill 审查互不取得对方决策权 |
| I28 | S19、N18、O07 | CHANGE、READY、RELEASE 与业务 readback 严格分级 |
| I29 | S01–S23、O01–O21 | diagnostic code 不得升格为 control state |
| I30 | §3.11、§5.6、§13 | 局部方案必须先过拓扑版本变更门 |
| I31 | N08/N09、R01–R40、G01–G17 | retired route/export/contract 只能在代码对照后裁决并验收零残留；G04–G06 对应旧执行语义须物理退出 |
| I32 | N09、G12–G14、H05–H09 | conversation/turn/attempt lineage 逐边精确绑定 |
| I33 | N05/N09/N17、H05/H10/H12 | Runtime 机械校验、Product usable、Domain rejection 分权 |
| I34 | G14、N12/N14/N17、H09–H12 | image bytes、media、geometry 与 result hash 端到端连续 |
| I35 | N01/N06/N09、H01/H05/H06 | materials、bundle、request/input hash 在入口一次冻结并逐边传递 |
| I36 | N14/N18/N21/N22、O05/O16、H11–H14 | deadline 未取得 reply、completed 或 replaced 时只重投同一 payload，Provider 增量为 0 |

---

## 10. Skill 固化边界（当前不施工）

### 10.1 不新建第二 Skill，也不在本轮修改现有 Skill

未来如获单独授权，只复用项目已有 `.agents/skills/agent-flow-boundary-gatekeeper/SKILL.md`，不新建 `agent-runtime-topology`，也不把 AGENT 专属表格复制进通用 `closed-loop-implementation-design`。本轮 Skill 只用于审查本方案，没有获得修改授权。

### 10.2 冻结后 Skill 只引用基线，不复制数据

未来 Skill 可被授权固化以下方法：

1. 生产链方案或修复前读取本文件的当前 `FROZEN` 版本、批准记录和冻结 hash；
2. 把问题回挂到一个状态平面、一个 `Ixx` 及受影响的 `N/G/T/H/O` 行；
3. 表单未冻结、hash 不等或问题无法分类时停止代码施工；
4. 需要新节点/outcome/时钟/Owner 时，先提出拓扑变更，批准并重新冻结后再对照代码；
5. 禁止在 Skill 中硬编码 Child 列表、秒数、Product Flow 或 Website 恢复矩阵。

Skill 是施工纪律守门人，不是运行权威、第二拓扑副本或修改拓扑的授权人。Website 侧“得到地图”是共同审阅冻结基线；是否未来需要机器合同，必须由冻结后的真实差异另行证明。

---

## 11. 存在性审判与删除反事实

| 结构单元 | 当前真实需求/消费者 | 删除后的具体失败 | 更短完整方案 | 当前动作 |
|---|---|---|---|---|
| 本文件中的唯一拓扑表单 | 授权人、AGENT/Website 责任方、未来施工 Codex | 继续没有统一锚点，局部方案可各自发明状态和修复 | 同一母本内建设，无第二文档 | `KEEP/BUILD` |
| `S/N/R/G/T/H/O/I` 稳定 ID | 冻结审查、代码差异对照、未来拓扑变更 | 无法定位同一责任、比较版本或约束工单范围 | 文档内 ID 已是最短机制 | `KEEP` |
| 冻结版本 + 规范化 hash + 批准记录 | 授权人和未来施工 Codex | 无法证明对照的是哪版表，可能静默改表后施工 | 复用同一文件，不建 registry | `KEEP` |
| 唯一代码对照与差异待修方案 | 未来只读审计与精确施工授权 | 表单期望与实际代码差异继续靠印象判断 | 独立引用冻结 hash，不修改冻结母表 | `KEEP, SEPARATE FROM FROZEN BASELINE` |
| 现役 Route Manifest / session/grant 合同 | 现役 Runtime/Website consumer | 本轮无权删除，删除会破坏现役链 | 保持不动；是否不足待冻结后证明 | `NO TOUCH` |
| 现有 Child proof / Browser WAL / Runtime Outbox / Website failure/admission | 各自现役 consumer | 删除会丢失局部证据、at-most-once、交付幂等或业务终点 | 本表只引用，不复制 | `NO TOUCH` |
| `AgentRuntimeTopologyManifestV1` 或其他机器拓扑投影 | 当前没有已证明的 runtime consumer/GAP | 删除该设想不影响表单建设与代码对照 | 先用冻结表单定位真实差异 | `DELETE FROM CURRENT DESIGN` |
| Product Flow runtime publication 给 Website | 当前任务只要求共同基线，没有授权或必要 consumer | 删除该设想不影响双方审阅 | 人工冻结表单先行 | `DELETE FROM CURRENT DESIGN` |
| Website topology coverage runtime validation | 当前未证明 session/claim 需要 | 删除该设想不影响现役恢复矩阵 | 冻结后按具体 mismatch 再审判 | `DELETE FROM CURRENT DESIGN` |
| 新 per-step DB/ledger、workflow、scheduler、timer、恢复队列 | 无真实消费者且会建立第二状态/Owner | 删除后各现役 Owner 仍负责自己的状态和时钟 | 复用现役权威 | `DELETE FROM DESIGN` |
| 新独立 topology Skill | 现有边界 Skill 可在未来只引用本表 | 删除无生产失败 | 不新建 Skill | `DELETE FROM DESIGN` |
| Product cursor、per-step ledger、next-child command | Website 无合法 consumer | 删除不影响 Product 自主执行和领域接纳 | Product 继续私有 Flow | `DELETE FROM DESIGN` |

---

## 12. 三阶段原子工单与严格顺序

本节 TF-0 至 TF-4 的“已完成/已冻结”仅记录 v2 历史；v3 当前状态只由 §16 记录，未重新冻结前不得把下述历史状态用作代码准入。

### 第一阶段：拓扑表单建设与冻结

#### TF-0：证据和候选绑定

- **状态**：已完成当前草案所需的有限绑定；不等于全仓代码审计。
- **输入**：现役法案/Blueprint/合同的既知边界、十五天问题族、两份现场日志、当前已识别的实现事实。
- **输出**：§2–§3 的 candidate、状态平面、问题族和第一直接断裂。
- **禁止**：不因历史方案或日志直接裁决生产代码修改。

#### TF-1：状态、节点和时钟表

- **状态**：已完成；正文只保留当前 authority/contract/实现可证明的事实，行内审批状态已删除。
- **输出**：S01–S23、N01–N28、R01–R40、G01–G17（其中 G04–G06 退休）、T01–T18。
- **完成门**：每行的 Owner、入口、动作上限、确认政策、成功/失败/截止无回执、consumer 和业务完成边界无空白、无“同上”、无审批占位字段。

#### TF-2：handoff、结果矩阵和问题回挂

- **状态**：已完成；所有问题约束已改为陈述事实，不再以问题句或 `UNPROVEN` 占位。
- **输出**：O01–O21、H01–H24、I01–I36 交叉索引。
- **完成门**：每条 handoff 的 identity、readback、非成功结果和 recovery Owner 可独立证伪；每个 Ixx 有唯一检查落点。

#### TF-3：冻结前反向攻击

- **状态**：第二轮已执行；当前表内反向链已闭合，尚未取得授权人版本批准。
- **顺序**：从 N18 Website public completed 与 N21 Runtime local completed 反向到 N01；检查遗漏 handoff、重复 writer、错误 Owner、状态互认、无限等待、现实动作重放和未覆盖问题族。
- **已修正**：把 Runtime Outbox/Website staging、Runtime failure/Website recovery、Browser incident/Website cooldown、Website public completed/Runtime local completed、Website deletion/AGENT purge 拆成单 Owner 节点与相邻 handoff；R01–R40 已与当前 AGENT catalog/Website route policy 机械对齐，并逐行绑定 Website 具体 Domain Sender/Consumer；I12 已收窄为当前 contract/acceptance 能证明的 bounded-observation 事实，删除“页面压力导致崩溃”的未证明因果。
- **输出**：只在本文件保留已证明事实；不得形成第二审计报告。
- **失败规则**：以后发现任一行缺真实 Owner、consumer、readback 或现役依据，直接从拟冻结版本中排除并阻断整版批准，不能给该行挂审批占位继续存在。

#### TF-4：授权人确认并冻结

- **状态**：已执行；授权人于本会话明确要求以冻结拓扑为锚点开始生产代码对照。
- **动作**：记录表单版本、批准人、批准时间和冻结规范化 SHA-256；冻结后本文件不再承载对照结果。
- **输出**：`FROZEN` 基线。冻结只是后续对照锚点，不是 CHANGE/READY/RELEASE。

### 第二阶段：冻结后只读生产代码对照

#### CA-0：逐行绑定实现

- **前置**：TF-4 已完成，冻结 hash 精确一致；授权人已明确要求开始只读代码对照。
- **动作**：按 S/N/R/G/T/H/O/I 行读取当前 law/Blueprint/contract/code/test/consumer；结果写入 §5.7 指定的唯一差异待修方案。
- **禁止**：不改代码、不格式化、不运行 Browser/Provider/数据库/恢复、不把静态测试当生产 readback。
- **输出**：每行只有 `MATCH | MISMATCH | NO_EVIDENCE`，并绑定精确路径/符号和影响。

#### CA-1：差异裁决

- **前置**：CA-0 分母完整。
- **动作**：每个 `MISMATCH` 独立判断 `KEEP（表单需走变更流程）| 原位修复 | 删除`；每个 `NO_EVIDENCE` 保持阻断，不猜测。
- **输出**：窄范围差异清单，不产生批量代码工单，不预设 Manifest、Schema、法案或跨仓变更。

### 第三阶段：另行授权后的精确修复

#### RW-0：一差异一工单

- **前置**：冻结表单、完整代码对照和授权人对具体差异的施工授权。
- **动作**：每张工单只处理一个可独立验收的 mismatch 及其不可分割直接关联对象；明确 Owner、允许路径、旧路径删除、原生质检和业务 readback。
- **禁止**：不得用一个“拓扑建设”工单批量修改双仓；不得顺手重构或建立兼容桥。

#### RW-1：施工、质检和真实闭环

- **前置**：重新绑定两仓 HEAD/tracking/dirty state/authority/冻结 hash。
- **动作**：按已授权工单原位精确修复；每仓只用其唯一原生质检；需要生产验证时另取动态授权。
- **终点**：对应 mismatch 有代码/合同 readback；业务类差异最终抵达 Domain Consumer admission 和领域对象 readback。

### 当前工单和 Skill 的处理

- 当前存量生产工单不因拓扑表建设被删除、重试、claim、恢复或冻结；日志只作为历史证据。若用户之后要求处理具体工单，必须先按现役权威只读归位，再单独授权动作。
- Skill 修改不属于 TF 阶段。只有冻结完成且另行授权后，才可按 §10 更新现有项目 Skill；不新建 Skill，不复制表内数据。

---

## 13. 分阶段验收

### 13.1 现役事实表建设验收（本轮）

本节 1–8 是 v2 冻结时的历史检查记录，不是 v3 的 quality PASS。v3 变更候选须在本工单完成两轮主 Codex 自审、新 hash 和重新冻结后才可引用本节作为当前检查记录。

1. 只有一份母本文件，没有第二表、第二报告或机器副本。
2. S01–S23、N01–N28、R01–R40、G01–G17（G04–G06 退休）、T01–T18、H01–H24、O01–O21、I01–I36 均有稳定 ID。
3. 每个原子节点均回答 Owner、入口 identity、单一动作、副作用上限、确认政策、合法结果、成功/失败/截止无回执记录、consumer、下一决定 Owner 和业务终点关系。
4. 每个等待均有时钟 Owner、初次观察、节拍/递增、deadline、pending 记录和到期报告；不存在“持续轮询”“适当重试”。
5. 每条 handoff 均列 producer、output、identity、consumer、readback、非成功结果、恢复 Owner 和防重/防漏原则。
6. I01–I36 均有交叉索引；409、限流、Provider effect、staging/admission 和质量层级没有压成一个状态。
7. 所有机器 Manifest 替换、跨仓新 payload、Product Flow runtime publication 和批量施工已从当前设计移除。
8. v2 拓扑行内不存在审批占位、可能、推测或 `UNPROVEN`；v2 当时状态为 `FROZEN`，但不代表 v3 候选已冻结，也不得冒充质量 PASS、代码可施工、READY 或 RELEASE。

### 13.2 冻结验收（授权人确认时）

1. 表内只含证据已绑定的事实；授权人明确批准整版状态语义、Owner、时钟、结果和 handoff。
2. 从 N18/N21 反向到 N01 的端到端审查无未解释断裂；一旦产生 `OWNER_BOUNDARY_UNPROVEN` 或 `END_TO_END_CLOSURE_UNPROVEN` finding，该事实行必须退出拟冻结版本并阻断冻结。
3. 文档写入冻结版本、批准人、批准时间与规范化 SHA-256；hash 计算规则唯一。
4. 冻结后任何改动必须发布新版本和新 hash，旧版本语义不得静默改写。

### 13.3 代码对照验收（冻结后、另行授权）

1. 每个冻结 ID 均绑定当前精确 law/Blueprint/contract/code/test/consumer，不能只按文件名判断。
2. 每行恰有一个 `MATCH | MISMATCH | NO_EVIDENCE`，并有可复核证据；`NO_EVIDENCE` 不得算通过。
3. 对照过程生产代码差异为零，Browser/Provider/数据库/工单副作用为零。
4. 只有被证明的 `MISMATCH` 才能进入精确修复候选；不得从表单直接推导批量重构。

### 13.4 未来修复验收（不属于本轮）

每个获授权 mismatch 使用对应仓唯一原生 `quality:check`，并按风险分别证明 CHANGE、READY、RELEASE。Provider/HTTP/Outbox/staging/局部测试成功均不能替代 Domain Consumer admission receipt 和领域对象 readback；只有业务类修复真实抵达该终点，才能声称业务闭环。

---

## 14. 停止门、变更控制与未来 Codex 纪律

### 14.1 任一命中即停止当前阶段

- 表单尚未由授权人明确确认，却开始正式代码差异裁决或生产施工；
- 用当前代码反向修改表单以掩盖 mismatch，而未走拓扑变更流程；
- 一个节点有两个 Owner，或同一事实出现两个 writer/恢复结论；
- 等待没有时钟 Owner、完整节拍或 deadline；deadline 未取得现实动作 receipt 却准备重放；
- handoff 缺 producer、consumer、identity、独立 readback 或 recovery Owner；
- 任何工单跨越多个无关拓扑 ID，或以“统一拓扑”为名批量修改双仓；
- 准备新增 Manifest、Schema、DB、ledger、workflow、scheduler、queue、compatibility reader、runtime projection 或第二 Skill，却没有冻结后具体 mismatch 与真实 consumer 证明；
- Website/task/grant 试图保存 Product cursor、选择 edge 或下发 next child；
- 施工面命中无法安全区分的用户 dirty overlay；
- 无 admission receipt 和领域对象 readback却宣称业务完成。

### 14.2 冻结基线的变更控制

冻结后只能通过以下顺序改变：

```text
发现事实缺口或法案变化
  -> 指定受影响的 S/N/R/G/T/H/O/I ID
  -> 提交拓扑变更提案和证据
  -> Owner/consumer/兼容/代码影响审查
  -> 授权人批准
  -> 新版本 + 新规范化 hash
  -> 重新冻结
  -> 再进行生产代码对照
```

禁止直接覆盖旧冻结语义、复用已退休 ID、先改生产代码后补表、用紧急事故绕过确认、或让 Skill/测试/Manifest 自动修改基线。草案阶段可在同一文件纠错；冻结后每次变化都是新版本，不是原地静默编辑。

### 14.3 未来代码对照或施工的强制重绑

1. 先验证本文件是当前获批 `FROZEN` 版本且规范化 hash 一致；
2. 读取双仓当前 `AGENTS.md`、适用 active law/Blueprint、provider/consumer contract；
3. 核对 branch/HEAD/tracking/dirty overlay 和受影响 source candidate；
4. 只处理授权指定的拓扑 ID，保护所有无关用户改动；
5. 先 CA-0/CA-1，只读形成差异；再等待具体 RW 授权；
6. 差异涉及 law、Blueprint、Website、Skill、生产工单或动态验证时分别取得对应授权，不得从“建设拓扑表”继承。

---

## 15. 冻结时的后续授权边界

| 编号 | 当前边界 | 唯一解除条件 |
|---|---|---|
| B1 | `WT-TOPOLOGY-001` 已授权并由本版闭合；法案/施工图优先门仍生效 | 两轮主 Codex 自审达到 98% 且无阻断 finding 后才进入代码 |
| B2 | 必要法案、Blueprint、Website、数据库、代码与质检已授权，但只能按既定工单和阶段执行 | 每一阶段前重绑 candidate/dirty set；禁止兼容桥、第二链路和范围扩张 |
| B3 | 项目 Skill 修改未授权 | 另行授权后只允许现有 Skill 引用冻结基线 |
| B4 | 当前存量工单的活体权威读回和恢复未授权 | 如需处理具体工单，另行授权只读归位及后续精确动作 |

授权人已批准建立并冻结 v2/v3，本工单授权精确模型与数值截断成为 v4；不修改冻结 Skill，按本轮最新要求由主 Codex 两轮自审，不启动子智能体。v4 新 hash 重新冻结后为代码对照锚点，历史仅由 Git 保留。

---

## 16. 文档身份与冻结记录

- 唯一路径：`docs/项目方案/AGENT运行拓扑图-完整实现方案.md`
- 表单版本：`agent-runtime-topology-form.v4`（本工单重新冻结）
- supersedes：`agent-runtime-topology-form.v3`（历史由 Git 保留）
- 状态：`FROZEN / 两轮主 Codex 文档与实现可行性自审已闭合 / 只作为代码对照锚点`
- 批准人：`授权人（本会话）`
- 批准时间：`2026-09-22T07:01:49+04:00`
- 冻结 hash 规范：UTF-8 原文仅删除以 `- v4 冻结规范化 SHA-256：` 和 `- 当前文档规范化 SHA-256：` 开头的两行后执行 SHA-256；v2/v3 历史 hash 行保留。
- v2 历史冻结规范化 SHA-256：`74d8b9d3ef88f7290bb7309447064f9da1568b3e9f5dba4bff64d46b23ff6283`
- v3 历史冻结规范化 SHA-256：`d94d4051b586554b3f7fcde92976db193dd3220a766fd6461f571ce25fcc094f`
- v4 冻结规范化 SHA-256：`fe29741381ecb628232817cfd4679b0f66edc2694d0ed6d145208b0d27d9ab62`
- 当前文档规范化 SHA-256：`fe29741381ecb628232817cfd4679b0f66edc2694d0ed6d145208b0d27d9ab62`
- 本文件在 v4 重新冻结后才是施工前唯一现役拓扑事实基线，不是 runtime state、运行时合同、quality verdict、CHANGE、READY、RELEASE 或生产完成证据。任何对照和待修内容只能写入 §5.7 指定文件。
