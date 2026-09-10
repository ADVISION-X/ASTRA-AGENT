---
name: agent-flow-boundary-gatekeeper
description: 审查 AGENT 生产链内部以及 AGENT—Website 跨仓接口的原子职责与唯一 Owner，并以当前需求和系统必要性两层证据裁决结构能否新增或保留；不能证明则禁止新增或在授权片区物理删除。仅用于生产链架构设计、Owner/边界审查，以及会提出或实施生产链代码修改的诊断与重构；不用于纯运行、纯日志、普通页面观察、一般 UI/文案或实际 Product 执行。本 Skill 不定义或执行 Product Flow，也不取代任一仓的法案或 Blueprint。
---

# AGENT—Website 原子职责守门

本 Skill 只负责证明每项生产责任是否原子、唯一并位于正确 Owner，绝不负责告诉生产系统“下一步该做什么”。它同时审查：

- AGENT 内部的 Runtime、Mediator、Product、GPT、Browser、Forensics 等边界；
- Website 内部的业务发起、V6 接受面、领域消费、完成和发布边界；
- 两仓之间的 provider/consumer 合同、attempt、结果与业务回执边界。

本 Skill 不得作为运行时解释器，不得定义或执行任何 Product Flow。为了审查 Owner 边界，可以读取、理解和比较现役 Product Flow。

它不是任何一侧的 canonical authority，没有状态、流程表、registry、quality verdict 或生产身份。

## 适用性检查

仅在以下任务中继续使用本 Skill：

- AGENT 生产链架构设计；
- Owner 或跨层边界审查；
- 将提出生产链代码修改的故障诊断；
- 生产链实现、删除、重构或接口调整。

如果当前任务只是以下事项，立即退出本 Skill 流程，按普通任务处理，不加载治理文件：

- 纯运行或状态查看；
- 纯日志读取和故障现场说明；
- 不提出代码修改的 Browser/DOM 页面观察；
- 一般 UI、文案或非生产工具修改；
- 实际 Product 任务执行。

## 第一性存在性门

“生产级”只表示：用满足现役合同的最少部件、最少状态、最少 Owner 和最短调用链，真实完成当前需求，并对已经证实的故障给出明确失败、正确归属和可验证恢复。它不授权扩大需求、预演假设未来，或为了显得完整而增加机制。

在绑定当前 authority 和候选以后、提出方案或施工以前，对本次获授权变更片区内每个拟新增、修改，或因本次方案而继续依赖的结构单元执行存在性审判。结构单元包括抽象、层级、模块、接口、字段、状态、持久化、队列、缓存、重试/恢复路径、配置、兼容/回退路径和证据机制。未被本次变更及其直接替代关系触及的全仓对象不自动进入删除范围；不得以“删除审判”为由扩大施工授权或覆盖用户改动。

每个结构单元必须同时闭合以下两层证据：

1. **当前需求证据**：绑定用户本次明确要求、当前真实 GAP、没有该单元时具体无法完成的结果、当前真实调用方或消费者，以及可观察的验收方式。还必须说明更简单方案为什么不能完成同一要求。
2. **系统必要性证据**：绑定现役 law、Blueprint、合同或已证实系统不变量，指出唯一 Owner、删除后会在哪条当前调用链或状态真相上发生什么具体错误、哪个真实消费者会受影响，以及用什么 readback、后置条件或测试证明。还必须排除已有 Owner、已有机制或更短路径已经承担同一责任。

两层证据必须分别成立并绑定当前候选。存在本身、代码历史、命名、注释、方案文档、测试仅在该单元存在时通过、行业惯例、“最佳实践”、“更安全”、“更稳定”、“以后可能扩展”、“方便统一”、“生产级”或整洁美观，都不能单独证明该单元不能删除。没有反例、暂未发现问题或口头推测也不构成证据。

对每个单元提出反事实问题：“现在删除它，当前需求和现役系统具体坏在哪里？”优先使用受控删除后的目标验收、真实 consumer/import 图、当前合同和运行 readback；不能安全执行删除试验时，必须明确区分已验证事实与推论，不得把推论写成 PASS。

裁决只有以下动作：

- 两层证据都闭合，且不存在能满足同一要求的更简单完整方案：允许新增或保留；
- 任一层不能闭合：拟新增单元禁止增加，授权片区内因本次变更触及的现有单元必须物理删除；
- 应删除对象超出授权路径、属于未获授权的用户改动或无法安全分离：输出 `EXISTENCE_UNPROVEN`，停止对应施工并请求精确授权，不得保留后宣告通过；
- 更简单方案满足相同当前要求和系统不变量：淘汰复杂方案，并在授权片区内删除它直接替代的旧路径、残留入口和失效消费者。

存在性记录只服务本次审查，不得落成新的 registry、台账、持久化状态、质量入口或第二 verdict。

## 绑定当前 authority

先读取仓库根 `AGENTS.md` 以及目标路径适用的更具体 `AGENTS.md`。

对每个进入审查范围的仓库，先绑定：

- 仓库 realpath、当前 branch、`HEAD`、tracking ref 和目标路径 dirty state；
- 现有目标、拟新增路径、真实调用方与消费者；
- 适用的 `AGENTS.md`、canonical law、Blueprint、provider 合同和 consumer dependency。

任一 authority 或候选在审查期间漂移，既有结论立即失效，必须重新绑定。dirty authority 只能得到 candidate-bound 结论，不能被表述为全仓或未来永久结论。

完整读取：

- `.github/instructions/agent-rules/基础法案.md`

不得把本 Skill、历史记录、generated registry、旧报告或记忆中的数量当成 authority。

## 跨仓 authority 强制绑定

只要任务会判定、改变或否定 Website 的责任，必须同时读取 Website 仓库的：

- 根和目标路径适用的 `AGENTS.md`；
- 命中目标的 canonical active law 及其直接依赖；
- 当前 AI acceptance/V6 Blueprint；
- Website provider 合同和 AGENT 侧对应 consumer dependency。

Website 仓库位置只能来自当前 workspace 的显式路径或 canonical contract 的 `providerRepo` 映射；不得猜测相邻目录、个人机器路径或旧 checkout。provider checkout 不可读时直接输出 `CROSS_REPO_AUTHORITY_UNBOUND`。

同理，Website 的法案不能单方面定义 AGENT 内部实现责任，AGENT 的法案也不能单方面定义 Website 内部业务责任。跨仓接口以 provider 合同为准，consumer 只能声明最小依赖；两侧 authority 未同时闭合时输出 `CROSS_REPO_AUTHORITY_UNBOUND`，Owner 声明冲突时输出 `CANONICAL_OWNER_CONFLICT`，contract identity/version/body 冲突时输出 `CANONICAL_CONTRACT_CONFLICT`。不得自行选择一侧覆盖另一侧，也不得用当前代码碰巧兼容来掩盖 authority 冲突。

## 精确读取适用法条

1. 先定位本次现有目标路径、拟新增路径、调用方、消费者和拟改变的责任。

2. 从 canonical active law source 中确定：

   - 哪些 active `law-record` 的 `appliesTo` 命中目标路径；
   - 哪些记录被 `excludes` 排除；
   - 命中法条声明了哪些直接 `dependsOnLawIds`。

3. 只读取：

   - 目标路径实际适用的功能法条；
   - 这些法条的直接依赖法条；
   - 解决当前 Owner 冲突不可分割地需要的相邻法条。

4. generated law registry 只能作为 lawId、source path 和行号的定位器。任何结论都必须回到以下 canonical source 中读取原始 `law-record`：

   - `.github/instructions/agent-rules/基础法案.md`
   - `.github/instructions/agent-rules/功能法案.md`

5. 如果是拟新增路径，或者现有路径没有命中任何功能法条：

   - 不得把零命中解释为不受约束；
   - 沿真实 importer、consumer、合同和预期职责反推唯一 Owner；
   - 读取该 Owner 对应的现役功能法条；
   - 无法证明覆盖或 Owner 时停止施工并报告缺口。

只有以下情况才扩大到完整《功能法案》：

- 修改法案系统或治理 authority；
- Owner 无法通过目标路径和调用图唯一确定；
- 出现跨 capabilityDomain 责任冲突；
- canonical applicability 无法闭合；
- 用户明确要求全量治理审查。

## 按需读取 Blueprint

任何进入本 Skill 的 AGENT 生产链任务都读取：

- `docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md`

任务涉及以下任一 GPT 对象时，读取：

- `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md`

GPT 对象包括：

- Product Plugin 的 GPT 调用或 Child sequence；
- GPT Child、GPT Facade 或 GPT Session；
- GPT Provider 页面 DOM 合同；
- Product、Child 与 Browser 之间的接口。

任务涉及以下任一 Browser Authority 对象时，读取：

- `docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md`

Browser Authority 对象包括：

- Target、Document、claim、park、reacquire 或任务专属页面生命周期；
- 物理 mutation、WAL、effect identity、dispatch 后置对账或恢复查询；
- Browser FIFO、已具备资格请求的顺序、normal/recovery 共用入口或旁路；
- Browser permit/MAC、Extension validator、pluginVersion 或已鉴权页面媒体 bytes。

同一任务同时涉及 GPT 页面语义与 Browser 物理边界时，两份 Blueprint 都读取。纯 Runtime transport、非 GPT/Browser 能力或 Website-only 边界不自动加载它们；出现跨域冲突时再扩大读取。

`docs/history/**`、迭代会议记录和旧 Blueprint 不得成为现役施工依据。

## 原子职责判定合同

每一项被审查的责任都必须写成一条可独立证伪的原子记录，并同时闭合：

1. 一个 canonical Owner；
2. authority inputs 及其 provider；
3. 一个可独立验收的决定、动作或原子事务；
4. 一个 authoritative output/persisted-truth boundary；同一原子事务的绑定 receipt 是该真相的证明，不是第二真相；
5. 全部当前真实 consumers；
6. 失败由谁产生、写在哪里；
7. consumer 用什么 readback 或后置条件验收；
8. 哪些相邻 Owner 明确不得取得该责任。

若一句职责同时含有多个可独立发生的决定、writer、状态真相、恢复裁决或完成标准，必须继续拆分。一个输出包含多个绑定字段，或同一原子真相具有多个 consumers，不构成拆分理由，但必须逐项列全。不得以“Website”“AGENT”“Runtime”或“系统”这类宽泛主体结束判定。

一个 Product 业务要求可以包含多个有序 Child，但只要其唯一决定仍是“如何完成这一项成熟业务要求”、唯一结果仍由同一 Product Plugin 组装，它就是一项原子业务责任；不得因为内部多步骤就把 Product Flow 拆到 Runtime、GPT 或 Browser。

## Website 侧原子职责基线

以下基线只用于检查定位，最终仍须以本次绑定的 Website canonical source 和实际合同为准。

| 原子责任 | 唯一 Owner | 拥有 | 明确不拥有 |
| --- | --- | --- | --- |
| canonical route/business contract | 命中业务域的 Website Canonical Route Provider | 定义 route、参数类型、材料 role/基数/relation 和 result schema | task 实例值、Product Flow、领域入库 |
| 业务任务实例与授权 | 命中业务域的 Website Domain Sender | 按 canonical route 校验并冻结 subject、参数值、业务授权和 contract identity；请求创建或撤销 | 定义第二份 route/result contract、Product Flow、Browser 动作、领域验收 |
| V6 控制面与未完成公开状态 | `ai-acceptance` | provider contract、设备/会话/attestation、claim eligibility 与顺序、grant、远端 lease/renew/fence、control、`failed + current_reason` 与容量 | Product 步骤、Browser 页面动作、领域内容解释、无回执完成 |
| accepted attempt | `ai-acceptance` | 签发、计数、保留、终止或替换 attempt；`retry_not_before`、是否创建新 attempt、自动下一动作和永久撤销 | AGENT 本地步骤、物理页面重放 |
| 业务材料实例与授权 | 命中业务域的 Website Domain Sender | 按 canonical route 冻结实际材料引用、关系、hash、授权和业务完整性 | 定义第二份材料合同、V6 传输实现、AGENT 本地路径、Browser 页面步骤 |
| 材料对象绑定与传输合同 | `ai-acceptance` | 把获授权材料对象稳定绑定到 `job_id + request_hash + business task` 并提供 V6 传输合同 | 用 attempt 改写业务材料身份、重解释材料、决定 Product Flow、指定 AGENT 本地路径 |
| 完成 staging | `ai-acceptance` | 仅检查外层机械合同并暂存；任务保持 `status=failed`，`current_reason.code=AWAITING_BUSINESS_ADMISSION` | 解释内层业务内容、签发领域回执、宣告业务完成、创建第三状态 |
| 领域验收与入库 | 命中业务域的 Website Domain Consumer | 对一份 staged result 做 `job_id + result_payload_hash` 幂等解释、领域存储并签发 admission receipt | Product/Browser 恢复、第二套规范化、第二任务状态 |
| AI job 公开完成转换 | `ai-acceptance` | 只在有效 domain admission receipt 与该业务域规定的附加完成门均闭合后写入 `completed` | 解释领域内容；用 Runtime terminal、Outbox、上传成功或 staging 代替领域回执 |
| 业务结果完成、发布或履约 | 命中业务域的 Website Domain Owner | 仅消费已领域验收的数据，并按本业务域 canonical 顺序完成 Manifest、业务结果、发布或履约 | 反向决定 accepted attempt、V6 调度、Product Flow 或伪造 admission receipt |

`Website Canonical Route Provider`、`Website Domain Sender/Consumer/Owner` 只是定位角色，不是可直接写进最终记录的 Owner 名。最终记录必须用命中 law/Blueprint 和真实路径把它替换为具体 Website capabilityDomain/模块；无法替换即为 `OWNER_BOUNDARY_UNPROVEN`。

## AGENT 侧原子职责基线

| 原子责任 | 唯一 Owner | 拥有 | 明确不拥有 |
| --- | --- | --- | --- |
| 架构边界 | `architecture-boundary` | 文件归属、Catalog/Manifest/Mediator/acceptance 的结构关系 | 运行时业务决定、任务状态、恢复动作 |
| V6 consumer 接入 | `agent-production-runtime` | 请求并验证 Website session/claim/grant/lease/fence，消费 Website 已签发的 attempt identity，durable accept 后形成本地绑定 | 签发 attempt、业务授权、Browser 物理 permit |
| 本地生命线 | `agent-production-runtime` | 现役持久化表、同一 accepted attempt 的 product-opaque re-entry、heartbeat/renew、opaque checkpoint receipt 的运输/持久绑定/机械读回、release、下载材料与当前 job/attempt/execution 的本地绑定、材料库存与 receipt 机械校验 | 改写 Website 业务材料身份、Product 业务 checkpoint 语义或下一步、新 attempt 策略、Browser WAL、领域验收 |
| 结果 Outbox | `agent-production-runtime` 的唯一 Outbox 子边界 | 一份发送 intent、idempotency key、投递及 transport receipt readback | Website 重试政策、Browser 物理重放、领域 admission receipt、第二业务完成状态 |
| AGENT 本地完成 | `agent-production-runtime` | 完整机械校验当前 `job_id + result_payload_hash` 的 Website domain admission receipt 后，原子写本地 task `completed` | 解释领域内容、签发 admission receipt、以 staging/Outbox/Provider terminal 代替回执 |
| 一次路由 | `architecture-boundary` 拥有的 Mediator | durable accept 后按 product/action/contract 精确解析 Catalog，并且只调用一个 Product Plugin 一次 | transport、任务状态、恢复、业务步骤、Browser 动作、第二 registry |
| 成熟业务要求 | 命中 route 的具体 Product Plugin | Product Flow、Prompt、模型策略、Child 顺序/分支/重复/跳过、业务 checkpoint、依据公开 typed facts 的 Product recovery、业务 artifact/base receive、一次无损 normalize 和结果组装 | Website 业务授权/公开状态/领域验收；Browser 私有状态 |
| 单个 GPT 原子能力 | `gpt` 的具体 Child/Capability | 页面语义 Child：一个局部决定、零或一次 Browser 动作、直接后置证明；continuation transaction Child：一次 opaque continuation transaction/CAS 与一致 readback；返回 success 或 typed failed | Child 排序、fresh/continuation 业务选择、Product recovery、业务终态、Target 选择 |
| continuation 会话并发 | `gpt` 内部 Session Controller 子边界 | opaque continuation identity、origin/current binding 和独立 CAS | 独立 capability/Manifest Owner、Product Flow、Product recovery |
| Browser Target | `local-browser-session` | durable accept 后创建、绑定或精确重领唯一 system Target/Document/workspace，并签发 target claim receipt | 从既存页面猜选、fresh/continuation 业务选择、Website business claim |
| Browser Observation | `local-browser-session` | typed query、current document 和 coherent mechanical observation packet | 页面业务语义、快照业务真相、Product 决策 |
| Browser Mutation/WAL | `local-browser-session` | effect identity、pre-dispatch fence、零或一次 dispatch、同次固定 after-read gate、机械后置条件、Browser terminal 与 mutation outcome | attempt、Product 下一步、GPT 页面语义、业务完成 |
| Browser FIFO | `local-browser-session` 内部子边界 | 已具备资格请求的唯一排序；normal release；未决 `DISPATCHED` 的 recovery isolate 保持同一 lane | 独立 canonical Owner、Product priority、入队资格、新 attempt、恢复分支 |
| exact-call 取证 | `forensics-persistence-capability` | exact-call evidence 生命周期、受控证据引用、append/readback/完整性事实 | Runtime 材料、Product 结果、Website 业务对象、permit、排序、恢复解释 |
| 诊断日志 | `runtime-log-spine` | 追加诊断事实 | 任务状态、恢复决定、业务完成、任何 canonical truth |

“命中 route 的具体 Product Plugin”也必须在最终记录中替换为精确 Plugin identity、路径和适用 Product authority；只知道它属于 Product 层仍不足以施工。

以上不是封闭枚举。必须从本次命中的现役法条、Blueprint、实际代码和调用方向确定唯一 Owner；不得因为表中没有某个 canonical Owner，就把责任改派给相邻层。

Product 自己的 `SKILL.md` 可以拥有产品语义和输出要求，但不得与 Product TypeScript 分别维护两套 Child 顺序、状态机、恢复规则或业务 Flow。

## 同名责任的强制区分

- **claim**：Website business job claim 只属于 Website V6；Browser target claim 只证明本地页面资源归属。两者不得互认。
- **fence**：Website 签发 execution fence；Runtime 只验证、绑定并执行机械约束；Browser WAL 单独拥有物理 pre-dispatch fence。任何一层不得因此取得另外两层的决策权。
- **attempt**：Website 签发、计数、终止或替换 accepted attempt；Runtime durable bind；Product、GPT、Browser、Forensics 只能携带和校验该 identity。process、lease、target、build、error 或 deadline 都不得自行创造新 attempt。
- **contract/Manifest**：Website 是 task/result/route/V6 provider；AGENT consumer 只声明最小 dependency。AGENT capability Manifest 是 Runtime provider，但解析所用 Catalog 仍是 Architecture Boundary 拥有的纯数据。Manifest ownership 不等于 Product runtime ownership。

恢复必须按事实所在层原子化：

- `ai-acceptance`：永久撤销、`retry_not_before`、是否签发新的 accepted attempt；
- `agent-production-runtime`：同一 accepted attempt 的 product-opaque re-entry、lease/fence、opaque checkpoint receipt 的运输/持久绑定/机械读回和 Outbox；
- 命中 route 的具体 Product Plugin：只根据公开 typed facts 决定下一个 Child、skip/repeat 或 Product recovery；
- `local-browser-session`：只根据 WAL 决定首次物理 `PREPARED`、只读 reconcile 或禁止重放；
- `gpt` 的具体 Child：只做本 Child 的局部 probe/reconcile，返回 success 或 typed failed；
- `forensics-persistence-capability`：只提供证据事实，不解释业务恢复。

结果主链必须保持单向：Product result → Runtime Outbox → Website staging → Domain Consumer admission receipt。取得 receipt 后，Website 业务域按自己的 canonical 附加门完成业务结果/Manifest/发布/履约，Website `ai-acceptance` 再按该域规定的完成门写 public `completed`；Runtime 只机械校验同一 receipt 后写 AGENT local `completed`。任何前一阶段的成功都不能替代后一阶段的 Owner 结论；各业务域附加门的先后不得由本 Skill 猜测，Website public completion 与 AGENT local completion 也不得合并成第二套跨仓状态。

## 跨 Owner 修改

跨 Owner 修改只有在确属接口变化时才能继续。必须证明：

- 当前任务不可分割地需要接口变化；
- producer、consumer、合同 Owner 及双方当前候选身份已定位；
- 接口只传递事实、命令或 typed result，不转移业务 Flow；
- 多 Owner 只读投影只组合各唯一 Owner 已持久化并验证的正交事实，不创建统一恢复状态、历史失败系统或第二持久化真相；
- 事实投影不写入、不调度、不决定 Product 下一步，也不向非 Owner 泄漏 Target、Document、WAL row 等物理私有身份；
- 任一侧没有取得另一侧的决策权；
- 真实现役消费者和验证方式存在。

若需要修改 Website、active law、Blueprint 或其他仓库：

- 当前用户任务已经明确包含该修改授权时，直接继承授权，不得重复请示；
- 当前授权未包含时，停止并请求对应授权；
- 不得为了绕过授权把责任临时放进 AGENT。

修改本 Skill 本身不会修改或取代任何一侧的 authority，也不能授权生产代码、Website、active law 或 Blueprint 变更。

## 施工边界

施工前为每项责任形成以下范围绑定，不得合并省略：

```yaml
responsibility:
canonical_owner:
authority_inputs_and_providers:
single_decision_or_action:
typed_output_or_persisted_truth:
consumers:
failure_owner_and_location:
readback_acceptance:
forbidden_adjacent_owners:
canonical_refs_and_candidate_identity:
allowed_change_paths:
existence_proof:
  unit:
  current_requirement_gap_and_acceptance:
  system_invariant_owner_and_failure:
  current_consumers_and_readback:
  deletion_trial:
  simpler_complete_alternative:
  decision: KEEP | ADD | DELETE
```

任一职责边界字段不能由当前证据闭合，输出 `OWNER_BOUNDARY_UNPROVEN` 并停止对应施工。任一存在性字段不能由当前证据闭合，输出 `EXISTENCE_UNPROVEN`，按第一性存在性门禁止新增、执行授权内删除或停止越界删除。

只修改合法 Owner 和完成当前任务不可分割的直接关联对象。

## 完成后删除式反查

先对实际差异、本次方案继续依赖的现有单元和被直接替代的旧路径重跑存在性审判，证明每个新增与保留单元的两层证据仍然成立；未证明单元不得留在候选中。删除一个单元时同步清除只为它存在的入口、导出、配置、状态、持久化、测试夹具和消费者，不得留下换名包装、空壳或兼容路径。然后检查实际差异、import 图、调用方、消费者、导出和持久化结构，寻找：

- 一个宽泛 Owner 同时拥有业务输入、transport、执行、领域验收或发布中的多项独立决定；
- Website Domain Sender 持有 Product Flow、Prompt、Child 顺序或 Browser 页面动作；
- Website staging 解释内层业务内容，或没有 Domain Consumer receipt 就写 `completed`；
- Runtime 签发 accepted attempt、决定 Website 业务重试/新 attempt、取得 Browser 物理 permit，或用 terminal/Outbox 替代领域验收；
- Product 决定 Website 业务授权/公开完成状态，或读取 Target、Document、WAL row 等 Browser 私有状态；
- GPT Child、Browser、Forensics 或 GPT Session Controller 决定 Product 下一步或业务恢复；
- shared Product Flow；
- 通用 executor、planner、graph、workflow、bus 或 DSL；
- 中央 Scheduler、Traffic Arbiter、Product priority/weight、recovery queue/bypass 或第二 Browser lane；
- Provider wait table/ticket、持久化 nextCheckAt、统一 call/recovery state 或第二恢复状态机；
- stage、nextStep、stepIndex、resumePoint、flowVersion、reconcileOnly；
- Runtime 或 Mediator 决定下一个 Child；
- Browser 根据业务状态推进 Product 步骤；
- Child 理解 Product 终态；
- `readCallFacts` 或同类事实 Facade 写状态、安排动作、返回统一 state/phase/nextStep、历史 per-call failure，或泄漏 Target/Document/WAL row；
- Forensics Persistence 或 GPT Session Controller 解释 Product 恢复分支，或出现第二 evidence writer/table/manifest、第二 continuation store/controller；
- Product Skill 与 Product TypeScript 各自维护 Flow；
- 第二任务状态、第二 mutation store、第二恢复结论或第二业务 verdict；
- Browser FIFO 取得 Product priority、入队资格、新 attempt 或恢复裁决；
- 事实投影、Facade 或日志取得写状态、调度、恢复或完成权；
- 无当前真实消费者，或仅由同一待删除链自我引用的结构。

这些词只用于发现候选问题。必须根据其真实决策权、状态和调用方向判断，不得仅凭名称判违。

## 输出边界

只向用户报告：

- 本次明确需求、当前 GAP、授权片区和明确非目标；
- 双方仓库的候选与 authority 是否闭合；
- 每项原子责任的完整范围绑定记录；
- 每个新增、保留或删除单元的两层存在性证据、删除试验和唯一动作；
- 唯一 Owner 及 canonical 依据；
- 越界责任、当前错误位置与唯一应迁回位置；
- 允许修改路径；
- 每个 consumer 的 readback 和已完成验证；
- 任何未闭合项及 `CROSS_REPO_AUTHORITY_UNBOUND`、`CANONICAL_OWNER_CONFLICT`、`CANONICAL_CONTRACT_CONFLICT`、`OWNER_BOUNDARY_UNPROVEN`、`EXISTENCE_UNPROVEN` 或 candidate drift。

本 Skill 的结论只是 Owner 边界结论，不是新的 quality PASS、READY、RELEASE 或生产完成结论。
