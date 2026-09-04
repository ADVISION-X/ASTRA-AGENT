---
name: agent-flow-boundary-gatekeeper
description: 在 AGENT 生产链设计、Owner/边界审查，以及会提出或实施生产链代码修改的诊断与重构中，按现役 canonical authority 判定唯一 Owner 并阻断第二 Owner。纯运行、纯日志读取、普通页面观察、一般 UI/文案和实际 Product 执行不触发；本 Skill 不定义或执行 Product Flow。
---

# AGENT 架构流程守门

本 Skill 只负责证明“责任是否放在正确位置”，绝不负责告诉生产系统“下一步该做什么”。

本 Skill 不得作为运行时解释器，不得定义或执行任何 Product Flow。为了审查 Owner 边界，可以读取、理解和比较现役 Product Flow。

它没有状态、流程表、registry、quality verdict 或生产身份。

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

## 绑定当前 authority

先读取仓库根 `AGENTS.md` 以及目标路径适用的更具体 `AGENTS.md`。

完整读取：

- `.github/instructions/agent-rules/基础法案.md`

不得把本 Skill、历史记录、generated registry、旧报告或记忆中的数量当成 authority。

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

## 判定唯一 Owner

以下内容只是定位问题的检查维度，不取代刚读取的 canonical source：

- Product 业务顺序、分支、重复、跳过、Prompt、模型策略和结果组装；
- GPT Child/Capability 的单个原子页面意图、前置、至多一次动作、直接后置证明和 typed result；现役法条明确归属 GPT wait 时，其短 probe、动态 backoff、瞬时检查资格与总等待上限也留在该原子能力；
- Browser Authority 的 Target/Document、物理 dispatch 安全、mutation WAL、park/reacquire 与只读对账；
- Browser FIFO 只拥有已具备资格请求的唯一排序，不拥有 Product 优先级、恢复裁决或入队资格；
- Forensics Persistence 的 evidence/artifact identity、append、readback 与完整性事实，不拥有业务恢复解释；
- GPT Session Controller 的 opaque continuation identity、conversation binding 与 lane CAS，不拥有 Product Flow；
- Runtime 的运输、lease/fence、durable accept、attempt、Outbox 和副作用安全；
- Mediator 的严格解析和一次路由；
- Website 的业务任务、公开状态、领域验收、入库、发布与业务回执。

以上只是当前常见 Owner 的定位维度，不是封闭枚举。必须从本次命中的现役法条、Blueprint、实际代码和调用方向中确定唯一 Owner；不得因为本 Skill 没有列出某个 canonical Owner，就把它的责任改派给相邻层。

Product 自己的 `SKILL.md` 可以拥有产品语义和输出要求，但不得与 Product TypeScript 分别维护两套 Child 顺序、状态机、恢复规则或业务 Flow。

## 跨 Owner 修改

跨 Owner 修改只有在确属接口变化时才能继续。必须证明：

- 当前任务不可分割地需要接口变化；
- producer、consumer 和合同 Owner 已定位；
- 接口只传递事实、命令或 typed result，不转移业务 Flow；
- 多 Owner 只读投影只组合各唯一 Owner 已持久化并验证的正交事实，不创建统一恢复状态、历史失败系统或第二持久化真相；
- 事实投影不写入、不调度、不决定 Product 下一步，也不向非 Owner 泄漏 Target、Document、WAL row 等物理私有身份；
- 任一侧没有取得另一侧的决策权；
- 真实现役消费者和验证方式存在。

若需要修改 Website、active law、Blueprint 或其他仓库：

- 当前用户任务已经明确包含该修改授权时，直接继承授权，不得重复请示；
- 当前授权未包含时，停止并请求对应授权；
- 不得为了绕过授权把责任临时放进 AGENT。

## 施工边界

施工前形成简短的范围绑定：

- 本次要改变的责任；
- 唯一 Owner；
- 当前真实消费者；
- 允许修改的直接对象；
- 不得取得该责任的相邻 Owner；
- 现有验证方式。

只修改合法 Owner 和完成当前任务不可分割的直接关联对象。

新增抽象、共享层、接口、状态或持久化前，必须证明当前必要性、真实消费者和验证方式。整理、统一、未来复用或顺手改进不能构成必要性。

## 完成后反查

检查实际差异、import 图、调用方、消费者、导出和持久化结构，寻找：

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
- 无当前真实消费者的新抽象。

这些词只用于发现候选问题。必须根据其真实决策权、状态和调用方向判断，不得仅凭名称判违。

## 输出边界

只向用户报告：

- 目标责任；
- 唯一 Owner；
- canonical 依据；
- 允许修改范围；
- 越界责任及应迁回的位置；
- 已完成或仍需完成的验证。

本 Skill 的结论只是 Owner 边界结论，不是新的 quality PASS、READY、RELEASE 或生产完成结论。
