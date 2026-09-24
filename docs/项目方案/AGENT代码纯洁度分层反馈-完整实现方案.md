# AGENT 代码纯洁度分层反馈｜完整实现方案

状态：可施工（仅为设计准入，不是 CHANGE、READY、RELEASE 或生产结论）

需求 Owner：AGENT `code-purity` 及其现役 `quality:check` 主链

方案范围：开发期 FAST 诊断、CHANGE 差异门禁、提交前 FULL 诊断、READY 原生裁决
本文件只授权方案设计；不授权修改法案、冻结说明书、生产代码、提交或发布。

## 1. 需求、终点与边界

当前真实问题是代码纯洁度 finding 到 READY 才集中出现，使大型 Foundation 迭代在提交后反复重构、重提和重跑。终点是：开发者在一段代码完成后能看到便宜的局部 finding；`quality:check CHANGE` 对本次 Git 差异造成的结构违规失败；提交前能在含未跟踪文件的工作树上发现全图问题；READY 对 clean commit 从零重跑完整 Static/Exam 并生成唯一逐法报告。四个时机使用同一现役规则实现，诊断不得取得质量裁决权。

非目标：降低阈值、豁免旧债、把 READY 结果缓存给后续候选、让 FAST 覆盖 Zombie 全图、修改冻结说明书/基础法案/Blueprint、增设第二 `quality:*` 命令或第二报告、为诊断建立持久台账。`npm run typecheck` 保持 TypeScript 类型检查语义；开发者在每段迭代后连续执行它和 FAST，不把全仓分析偷偷塞进 `typecheck`。唯一新增的开发命令是普通诊断脚本 `diagnose:code-purity`，只打印 finding、不作质量裁决。

## 2. 候选与权威绑定

- 仓库：`/Users/nexgen/Documents/AGENT`，`main`，设计读取时 HEAD `812654d05f3e65d2087e9da40ddc90bcdc484323`，本地跟踪引用 `origin/main=ec737045fae9e8f5c41bf6bebc7558f3a2fb2b05`。这不是远端实时状态证明。
- 当前工作树存在其他生产与审计路径的未提交改动；本方案所需的 `code-purity` 目录、`governance.ts`、`governance-git-state.ts`、`quality-runner.ts`、`quality-routes.ts`、`package.json`、现役法案和 Blueprint 在写前均无本地差异。施工不得覆盖或替换其他改动；实施前重新绑定 HEAD、目标文件内容和差异。
- 冻结权威：根 `AGENTS.md`；`.github/instructions/agent-rules/基础法案.md` 的 `LAW-CODE-PURITY-001-V6`、`002-V2`、`003-V3`；`docs/blueprints/code-purity/QUALITY-EVIDENCE-OWNERSHIP-V1-BLUEPRINT.md` 的唯一终态和禁止第二质量链；`docs/governance/法案系统建设说明书-冻结定稿版.md` 第 35、58、62、63、68 节。`scripts/audit/domains/code-purity/manifest.json` 是此 Owner 的路径合同。
- 关键源码指纹：`code-purity-phase-runner.ts` SHA-256 `1bc2d415d193961054c4778d380da8e9f752f9110d8930916096d7a50a216cef`；`code-purity-governed-files.ts` `11e786aff999d1b2a013983972d6334288f3914d17d8a0a3b0d9335c380c9aea`；`governance.ts` `737d40b027473f8dcf6f17c24bc69a2eab88ffc3728249ab141d3a98d48b9e85`。其他相关源码由上述 HEAD 和写前无差异共同绑定；文档自身的 hash 在交付时单列。
- 一份历史 READY 失败报告 `scripts/audit/reports/law-quality.report.json` 绑定旧 commit `3e73d704...`，其 code-purity 001 有 23 条函数、10 条文件、4 条类预算 finding。它仅证明反馈延迟的历史症状，不能作为当前候选的未修 finding 清单或新的质量证据。

## 3. 现役链、第一断裂与前轮连续性

| 环节 | 当前事实与真实消费者 | 裁决 |
|---|---|---|
| 源文件选择 | `shared/project.ts:createAuditProject` 按给定 paths 建立 ts-morph Project；`code-purity-governed-files.ts:collectCodePurityGovernedFiles` 再收集该 Project 的全部活动源码。 | 保留 Project/文件模型；为 FAST/CHANGE 选择 targets，不让 `runCodePurityPhases` 原样充当局部检查。 |
| 现役扫描规则 | `scan-structural-budgets.ts` 已接受 `GovernedFile[]`；`scan-owner-boundaries.ts` 按导入边扫描；`scan-zombie-surfaces.ts` 建立入口、模块、可达与符号图。 | 复用同一规则/阈值/Owner 解析。局部只调用有充分上下文的检查；全图保留完整文件集合。 |
| 正式法案适配 | `code-purity/inspector.ts` 调用 `runCodePurityPhases`；后者将扫描 finding 与 native receipt 组合，形成逐 mode 断言；`quality-runner.ts` 使用 sealed snapshot 并汇入唯一报告。 | 只把分析结果与法案断言的编排职责拆开；READY 的 law adapter、证据和报告合同不变。 |
| CHANGE | `governance-git-state.ts:diffPaths` 含 tracked、untracked，rename 拆成 D+A；`governance.ts:relevantChangeChecks` 当前执行 `typecheck`、变更的治理测试、相关 Exam。 | 第一直接断裂在此：生产源码结构 finding 未对当前 diff 执法；`acceptance:code-purity-zombie-deep` 验证扫描器夹具，不检验当前候选的完整静态纯洁度。 |
| READY | `governance.ts:projectChecks` 和 `quality-runner.ts:runFullQuality` 对 clean commit 运行全部 Static/Exam、唯一逐法报告。 | 保留并从零重跑；诊断结果不进入 READY evidence。 |

有限回归信号筛查：用户报告同类 READY finding 反复造成返工；检查了上述目标文件的近期 Git 历史、现有验收脚本、`docs/项目方案` 中同 GAP 的方案搜索，未发现可直接复用的“分层反馈”未完成方案。历史曾有 Code Purity 扫描与治理性能迭代，不能据此声称局部诊断已经落地。前轮仍适用的不变量是唯一 Owner、原生入口、同源规则、sealed candidate、证据 mode 不互代、READY clean commit 全量重跑；它们进入本方案每个相关工单的防回归验收。

## 4. 唯一目标链与分母

```text
一份 code-purity 扫描规则与 Owner/阈值
  ├─ FAST：本段明确 touched files + 必要只读解析上下文 → 局部 raw findings
  ├─ CHANGE：HEAD→工作树的真实 diff（含 untracked、D+A）作 targets；
  │          全仓源码只作 context → 与 targets 有因果关系的 findings → 现有 CHANGE FAIL/PASS
  ├─ FULL：当前工作树稳定快照 → 全仓 raw findings，提交前诊断
  └─ READY：clean commit sealed snapshot → 完整扫描 → 现役 law adapter / Exam
             → 唯一逐 lawId 报告和 verdict
```

唯一身份主线：FAST 为本段显式文件路径及当次工作树内容；CHANGE 为 `HEAD + diffPaths()` 的 status/path/内容分母；FULL 为提交前工作树清单与内容快照；READY 为 clean Git commit。后三者不是可互相替换的候选身份。诊断终点是终端中的原始 finding 或“无 finding”及进程 exit status；正式质量终点只有现有 `quality:check`。所有写入诊断快照都在仓库外临时目录，仓库工作树零写入，失败/漂移丢弃快照后按原命令重试，不写 PASS artifact。

### 4.1 FAST 局部规则边界

FAST 由 Codex 在每段完成后执行 `npm run typecheck`，再执行 `npm run diagnose:code-purity -- FAST <本段文件路径...>`。它仅检查明确 touched 的现存源文件：文件/函数/类/object 结构预算、文件局部的禁用语法与类型逃逸、import/export 形状，以及可从当前文件和被解析直接目标确定的 Owner 导入边。Project 可以为解析而加载依赖上下文；只有 touched files 是 finding targets。空文件集合、越界路径、文件在运行中变化或解析所需 context 不可得均明确失败，不以空结果伪成功。

FAST 不宣称 export 有真实消费者、Zombie file/export、registry liveness、重构后全图可达或全仓 Owner 完成。删除路径和入口/registry 变化会提示需要 FULL；FAST 的“无 finding”不替代它。FAST 只作施工反馈，不生成 law assertion、static receipt、quality report 或 `*_PASS` 字样。

### 4.2 CHANGE 差异与上下文

`targets` 精确来自一次 `diffPaths()`；它决定可阻断本次 CHANGE 的 finding。`context` 可读取全仓 active source、package/Manifest 和依赖图，只供解析与因果定位。文件局部 finding 仅在 `filePath` 属于新增/修改 target 时阻断；D 或 rename 的旧路径没有现存文件，沿现有模块导入与 package 入口边核其直接消费者，只有带具体 D target 证据的引用断裂才能阻断。不能靠把某个历史 finding 的 `filePath` 恰好归入宽泛目录，就认定它属于本次差异；不能把全仓旧债投射成 CHANGE finding。归因不足的全图风险在 FULL/READY 检出，不伪造 CHANGE PASS 对其已覆盖。

CHANGE 复用正式 `quality:check -- CHANGE` 内部调用和既有 `changeDenominator` 前后稳定性保护；诊断 finding 失败时走现有失败路径，不产生逐 lawId 报告。普通生产代码、untracked 新文件、M、D、rename D+A、仅 package entry 改动分别有正负样例；无关历史超限文件不阻断本次 CHANGE。若 diff 中没有 Code Purity 所适用的源码/配置目标，跳过局部扫描，仍执行现有 CHANGE 检查。

### 4.3 FULL 工作树全图与 READY

FULL 执行 `npm run diagnose:code-purity -- FULL`，使用同一现役全量扫描集合：结构、Owner、Zombie、模块/符号可达、死分支、真实入口/registry。输入从当前 tracked 与非 ignored untracked 文件建立仓库外快照；`git ls-files` 仍列出已删除的 tracked 路径，必须根据 `diffPaths()` 的 D 排除它们，rename 按 D+A 保留新路径，再加入 untracked，不能对已删除文件执行 `copyTargets`。快照保留当前 package/Manifest 和活动源码；前后核 `HEAD + diff status/path/bytes`，任一漂移使诊断失效并失败关闭。若现役 law/Manifest/registry 投影不一致，直接报诊断不可用，不用旧 registry 推断本次无 finding。不能直接复用 `runFullQuality(READY)`，因为它拒绝 dirty worktree 并有报告/clean commit 合同。FULL 只输出 raw findings；快照、收据或 exit status 不作为 READY 缓存证据。

READY/RELEASE 的 `code-purity/inspector.ts` 仍用完整扫描结果构造现役 `static.*` mode 的 native observation、receipt 和逐 lawId assertions；`quality-runner` 保持当前 clean candidate、sealed snapshot、全部 Exam、报告 writer 和最终 verdict。FULL 无 finding 不承诺 READY 通过其他域、Exam、source/registry 或 candidate drift。

### 4.4 “一致”的准确含义

同一候选内容、同一规则、同一对象与同一违规事实在被多个时机实际覆盖时，`checkId`、阈值、原因和 Owner 判定一致。FAST、CHANGE、FULL、READY 的 finding 集合无需相等；覆盖分母不同是预期行为。发现两时机对同一事实相反时修同一规则/输入上下文，不新增第二阈值表或排除表。

## 5. 原子施工工单

| 工单 | 唯一 Owner、路径与动作 | 输入 → 输出 / consumer readback | 验收与失败停止 |
|---|---|---|---|
| P1：分析与适配分离 | `code-purity`；原位改 `scripts/audit/domains/code-purity/components/code-purity-phase-runner.ts`、`code-purity-governed-files.ts`、`scan-structural-budgets.ts` 和 `scripts/audit/domains/code-purity/inspector.ts`，新增同 Owner 的 `components/code-purity-analysis.ts` 容纳范围选择及 raw finding 汇总。现役扫描规则原函数复用；`static.types` 的 TypeChecker native observation 留在正式证据适配，不强迫 FAST 为建 receipt 跑全量观察。 | `GovernedFile` + 现役 rule implementation → raw findings；现役 inspector 消费完整结果并生成原有法案输出。 | 既有 `acceptance:code-purity-zombie-deep` 案例和 READY Inspector contract 不减弱；相同 fixture 的 code/原因/阈值稳定。任一 evidence mode 失去 native 观察则停止。 |
| P2：开发期诊断 | `code-purity`；新增单个 `scripts/audit/domains/code-purity/diagnose.ts`，在 `package.json` 增加普通脚本 `diagnose:code-purity` 作为其真实 CLI consumer；禁止 `quality:*` 新入口。支持 FAST 的显式 touched paths 和 FULL 的当前工作树快照。 | Codex/开发者显式调用 → 终端 raw findings + exit status；无正式 report。 | 不写工作树、registry、`law-quality.report.json`；无 `PASS/READY` 声称；untracked、漂移、空目标、删除/入口提示、路径越界均有负例。相同候选上 FAST 的实测中位耗时须低于 FULL，且 FAST 不构建 Zombie 全图；否则继续优化局部选择，不凭主观“快”验收。 |
| P3：CHANGE 差异门禁 | `code-purity` 的治理入口 Owner；原位修改 `scripts/audit/governance.ts`，只复用 `governance-git-state.ts:diffPaths` 与 P1 的 `code-purity-analysis.ts`；不引入第二 diff 计算链。 | `HEAD→工作树` diff → 可归因 findings → 现有 CHANGE 失败/继续；普通测试与 Exam 保留。 | M/A/D、untracked、rename D+A 和无关旧债的反例；finding 有具体 path/line/checkId；candidate drift 检出；CHANGE 不写报告或冒充 READY。 |
| P4：FULL 与 READY 收口 | `code-purity`；P2 FULL 复用 P1 的全量扫描；现役 `inspector.ts` 仍消费全量结果，`quality-runner.ts` 不修改。防回归样例放入现有 `tests/governance/code-purity-governance.test.ts`，不扩写已达 1687 行的 `quality-contract.test.ts`。 | dirty 工作树 FULL finding → 修复后原链 `CHANGE → clean commit → READY`；READY 从零读取新 commit。 | 同一候选的 FULL 与 READY 对已覆盖的 code-purity 事实语义一致；READY 不读取诊断产物，报告仍唯一；其它域和 Exam 未被跳过。 |

依赖顺序：P1 → P2 与 P3 → P4。先保护现役 Inspector 的完整行为，再新增诊断；P2/P3 不并行改同一文件。施工前核实主要文件的现役结构预算：`phase-runner.ts` 已组合多类扫描，不把新 mode 判断继续堆入原函数；`governance.ts` 的 `relevantChangeChecks` 已承担多项检查，新增逻辑只调用一个职责明确的 Owner 函数。方案没有生产状态、持久化、队列、跨仓合同或新 Owner。

## 6. 删除反事实与防竞争路径

| 结构单元 | 当前需求、消费者与删除反事实 | 裁决 |
|---|---|---|
| 现有扫描函数和阈值 | FAST/CHANGE/FULL/READY 都需要同一规则；删除会让已现役 READY 失去纯洁度发现能力。 | 保留并原位复用。 |
| 范围选择与 raw finding 汇总 | 同一全量 Inspector 不能同时满足便宜局部诊断和完整图扫描；没有选择职责会再次全仓扫描或复制规则。 | 在现有 Owner 内抽出最少共享调用，禁止第二扫描实现。 |
| 内部诊断入口 | 开发者在未提交工作树上需要可执行 FAST/FULL；现有 READY 入口拒绝 dirty 且生成正式报告。删除后无可用开发期消费者。 | 允许一个诊断入口，仅输出 findings；不设另一 quality verdict。 |
| READY law adapter | 唯一 quality core 消费 `static.*` assertion 与 native refs；删除后 READY 无正式法案证据。 | 保留；从 raw 扫描结果建立现役证据。 |
| 新缓存、差异 finding 台账、第二阈值、第二 report、跨模式 PASS | 当前没有真实消费者或必要状态；删除不影响任何上述终点。 | 禁止新增；若施工中出现必须物理删除。 |

## 7. 分层验收、停止与施工重绑定

1. **规则同源**：同一 fixture 在局部、CHANGE（命中时）、FULL 和 READY 的同一事实具有同一个 `checkId`、阈值、原因；特意构造 FAST 无法识别的 zombie export，确认只有 FULL/READY 报出，避免假全覆盖。
2. **CHANGE target/context**：先放一个与 diff 无关的历史超限文件，改另一个合法文件，CHANGE 不因此失败；改该超限文件、加 untracked 超限文件或删除被引用文件，CHANGE 精确失败。rename 按 D+A 归因；未能确定因果的全图问题不被错误归给 diff。
3. **候选与零副作用**：诊断前后 `git status` 和目标文件 hash 不变；运行中改文件导致候选漂移失败；临时快照包含 untracked 而不包含已删除源；快照不进报告或 registry。
4. **正式链**：必要的 focused 验收与原生 `npm run quality:check -- CHANGE` 验证差异门禁；施工任务获得 clean commit 授权后才执行 `npm run quality:check -- READY`。READY 全部 active Static/Exam 和唯一报告保留；不以 FAST/FULL/CHANGE 结果顶替。当前方案设计阶段不运行这些会产生证据或可能改动工作树的命令。
5. **速度收益**：在同一机器、可比代码量上记录 FAST、FULL 与 READY 的实际墙钟时间，验收 FAST 比 FULL 明显短，且后续迭代由 READY 首次发现的结构预算 finding 数下降；不许用提前失败的次数或估算的“80%”当成功证明。

施工 Codex 在动代码前必须重查本文件对应 scoped candidate、目标路径 Git 状态、active law/Blueprint/Manifest 和结构余量；任何相关 authority 或 Owner 漂移先重算受影响方案。遇到未获授权的用户改动、需要更改冻结说明书/基础法案、找不到唯一 Owner、模式证据失真或诊断取第二 verdict 时，停止该片区并报告第一断裂。后续修复留在原 Owner、原候选身份和原 quality 主链；不得靠放宽法案、复制扫描器或追加豁免继续。
