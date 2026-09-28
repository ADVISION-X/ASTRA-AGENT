# 浏览器命令 WAL 孤儿 DISPATCHED 自愈：完整实现方案

> 状态：**设计阻断，本方案的核心候选（W1）已被推翻，不得施工**。见下方"撤回说明"。这是当前生产链的活跃故障（3 个真实生产 job 正卡在这个状态），已用当前真实故障现场核实，非人工模拟；但本文档第7节候选A提出的修复方向与三天前（2026-09-25/26）已经完成并冻结的 [Target系统地位与强制边界-完整实现方案.md](Target系统地位与强制边界-完整实现方案.md) 直接冲突，不能采用。

## 撤回说明（写在候选A被否决之后）

本方案第4节遗漏了一步关键的"现役实现重建"：施工前必须检索是否存在处理同一 GAP 的既有方案，我没有做这一步就直接设计了候选A（"进程重启后把 target_local DISPATCHED 行结算为 FAILED"）。事后检索发现：

1. 这个机制此前确实存在过，名为 `settleRetiredTargetLocal()`，在 `browser-lane-coordinator.ts`/`browser-target-lease.ts` 里实现，被 [浏览器退出恢复与未决命令解锁-完整实现方案.md](浏览器退出恢复与未决命令解锁-完整实现方案.md)（2026-09-17）设计并落地。
2. 它在 3 天前的 commit `c7b557575`（"Remove persistent Target recovery identity and enforce current action authority"）被**物理删除**，删除依据是 [Target系统地位与强制边界-完整实现方案.md](Target系统地位与强制边界-完整实现方案.md)（2026-09-25/26，跨 AGENT+Website 双仓，7个工单，冻结了 `LAW-ARCHITECTURE-BOUNDARY-002-V1`）。该方案把"Target 不拥有任何跨时间身份、不得参与任何恢复/attempt/risk 决策"提升为 P0 级不可动摇原则，并在 WO-A4 明确写死："`target_local` 继续作为 effect_scope 分类，旧未决行**不能凭 Target 消失伪终结**"；在其 §12 结语更是逐字预判了本次故障场景："跨 Extension 重启而原 WAL 仍有无可靠终局的 DISPATCHED...**目标链对此明确失败关闭：只允许原 effect 零输入读回及有界对账，禁止自动新物理输入；只有原 WAL 全部可靠 terminal 才可出具 input-quiescence proof**"。

也就是说：本方案候选A要做的事——"进程重启即视为可以安全结算 target_local 孤儿行"——正是 3 天前被专门论证、专门否决、专门物理删除并写入冻结法案（`LAW-ARCHITECTURE-BOUNDARY-002-V1`）的那件事，不是本方案独立发现的新增出路。这不是一次轻微的法案措辞冲突，是直接复活一个刚刚被判定为架构性错误、已冻结禁止复活的机制。

第7节及后续工单原样保留作为历史记录（说明当时的推理过程和错误），但**不得执行**。真正的结论和后续路径见对话记录：当前技术现实是——这一类孤儿行没有任何自动、合规的解锁路径，唯一路径是人工介入；这是 3 天前经过深度论证后的**主动选择**，不是遗漏。

## 0. 方案状态与授权边界

- 需求 Owner：AGENT 本机浏览器基础设施（`/Users/nexgen/Documents/AGENT`），本方案不涉及 Website 仓。
- 唯一方案路径：本文件。
- 用户明确给出的核心不变量（与[浏览器扩展连接自愈-完整实现方案.md](浏览器扩展连接自愈-完整实现方案.md)共享同一条红线，这次是它在 WAL/mutation 层面的对应版本）："无论如何 AGENT 都必须能自动恢复、交回答卷"——重启后不应该需要人工去数据库里手动处理孤儿行。
- 触发事实：2026-09-28 凌晨，AGENT 进程重启（`producerRunId 25fc207e-...`，启动于 `2026-09-28T00:19:07Z`）后，3 个生产 job（`aiprod_a2b8d76c`/`f2bddc87`/`344023c2`）被正常领取、材料校验通过，但全部卡在 `job.lease-renew` 循环，`prepare_clean_gpt_chat` 的 `gpt.child` span 自 `span.started` 后再无任何后续事件；`GET /api/health` 报告 `productionRuntimeBrowser` 的 `lane=blocked`。
- 本方案不涉及法案正文修订（改动为纯实现代码），未新增、未削弱任何现役 forbidden 条款covered 的保护，见第 5 节。

## 1. 需求、业务终点与语义澄清

目标行为：AGENT 进程重启后，任何一条因为进程终止而永远不可能再收到真实回执的、**本地范围（`target_local`）** 的 `DISPATCHED` 浏览器命令行，必须在启动时被自动结算为一个明确的终态，从而不再无限期阻断全局唯一 Browser lane；**跨 Provider 范围（`provider_effect`）** 的 `DISPATCHED` 行（真实提交给 GPT 的动作）必须继续保持现状阻断，因为它是否已经产生真实副作用无法在本地安全断定，处理权按现役法案属于 Website。

非目标：不新增、不修改"确认回读"（confirmed-readback）机制本身；不改变 `provider_effect` 类孤儿行的任何现有处理路径或授权要求；不处理"浏览器扩展连接是否健康"（那是另一份已完成的方案）；不新增重试、退避或告警机制。

## 2. 候选绑定

| 仓库 | 路径 | 分支 | 观察 HEAD |
| --- | --- | --- | --- |
| AGENT | `/Users/nexgen/Documents/AGENT` | main | `a287ac97da590ac3766f82d8cb7856da6a6c400a`（施工前重新核对；工作树另有 3 组跟本方案无关的既有改动：`docs/项目方案/系统自完善-完整实现方案.md`【他人/其它会话在制品，不碰】、GPT 附件选择器修复 4 个文件【本会话早前已完成待提交】、浏览器扩展连接自愈修复 2 个文件【本会话进行中待提交】，均不纳入本方案 candidate） |

scoped candidate（本方案预期改动）：

- `src/lib/browser/exact-target/browser-mutation-store.ts`（仅构造函数内的启动期 reconciliation 语句块，第 57-59 行紧邻处新增一条同类语句）

依赖读取（不改，仅用于核对行为）：`src/lib/browser/infrastructure/browser-lane-coordinator.ts`（`nextWaiter()`/`hasUnresolvedMutation()`）、`src/lib/browser/exact-target/browser-mutation-evidence.ts`（`countDispatched()`）、`src/lib/browser/exact-target/browser-command-actor.ts`（`resolveDispatchedMutation()`/`completeMutation()`）、`src/lib/browser/exact-target/browser-outcome-resolver.ts`、`src/lib/browser/exact-target/browser-target-lease.ts`/`browser-target-lease-manager.ts`（`resolvePendingMutation`）、`src/lib/browser/exact-target/browser-mutation-schema.ts`。

当前活跃故障现场证据（只读取证，不属于 candidate）：`.grasseye-local/browser/browser-mutations.sqlite` 里唯一一行 `state='DISPATCHED'`：`command_id=b890f828-2fb8-40f5-b968-bc532e099c62`，`job_id=aiprod_f2bddc87-a5ef-4e9a-9882-7b70a3c4ebfd`，`child_capability_id=close_gpt_execution_profile`，`effect_scope='target_local'`，`physical_input_count=0`，`updated_at=2026-09-27T22:36:49.566Z`（早于当前进程启动时间，跨越了至少一次完整重启）。

## 3. 候选漂移与回归连续性

有限回归信号筛查：`git log -p -- src/lib/browser/exact-target/browser-mutation-store.ts` 未见任何历史上处理过 `DISPATCHED` 孤儿行的实现后被删除的痕迹；`resolveDispatchedMutation()`/`resolvePendingMutation()` 这条"确认回读"能力本身是现役的，但全仓检索确认除 acceptance 测试外，生产 `src/capabilities/**` 代码路径中没有任何一处真正调用它（`grep` 命中的唯一非测试文件只有类型转发），即它是一条已实现但当前无生产消费者主动触发的现役能力，不是被本次故障绕开的能力——它本身也无法处理"跨进程重启"这种场景（见第4节），不构成回归，而是从设计之初就没有覆盖"进程重启导致原 Target/会话不可能再被合法重新获取"这一种状态。深度判定：**标准**——改动落在 AGENT 一个 Owner（Browser mutation WAL）内，不新增状态、不新增持久化字段、不新增跨 Owner 合同，但改动的是生产链核心安全闸门（DISPATCHED 阻断）紧邻的启动逻辑，需要对照法案逐条核对不会削弱 `provider_effect` 侧的保护。

## 4. 现役实现重建（第一直接断裂）

DISPATCHED 行的完整生命周期，逐层核对如下：

1. **产生**：`BrowserCommandActor.execute()`（`browser-command-actor.ts:298-319`）对 mutation 类命令先 `prepare()`（写 `PREPARED`），实际通过 `this.port.send()` 把帧发给扩展后，在 `onDispatched` 回调里调用 `mutations.markDispatched(commandId)`（`transition({from:"PREPARED",to:"DISPATCHED",...})`，第313行）——此时 `physical_input_count` 恒为 0（`transition()` 的默认值，只有后续 `markConfirmed`/`markRejected`/`resolve()` 才会写入真实计数）。
2. **正常结算**：`completeMutation()`（第358-406行）在收到扩展的 REPLY 帧、`assertMatchingReply()` 通过后，依据结果调用 `markConfirmed`/`markRejected`，把行从 `DISPATCHED` 转为终态。这条路径要求：同一个 `this.port.send()` 调用（同一次 `await`）拿到匹配的 REPLY——即同一进程生命周期、同一 WebSocket 会话内完成。
3. **异常结算（同会话内）**：`failExecution()`/`BrowserCommandTerminalReplyError` 路径处理"扩展明确回了 errorCode"的情况，仍在同一会话内。
4. **确认回读结算（跨次观察，但要求同一 Target）**：`resolveDispatchedMutation()`（第440-459行）允许调用方提供一份 `BrowserOutcomeResolutionReceipt`（`browser-outcome-resolver.ts`），但 `assertBrowserReconciliationEvidence()` 强制要求 `uniqueTargetRef` 与该行原始 `target_ref` 一致，且证据必须来自对**同一个 Target** 的一次新鲜观察。而 `LAW-LOCAL-BROWSER-SESSION-003-V44` 明文规定"原 Browser SQLite 只保留 browser_mutations 中 target_ref/document_ref 的历史动作取证，不得建立持久 Target claim/registry、恢复 locator 或旧 Tab 身份，不得凭旧数字 tabId 猜删操作者 Tab"——即 AGENT 进程重启后，旧 `target_ref` 不能、也不允许被重新拿来做任何观察或恢复的依据。这条能力因此在架构上**无法用于**"进程重启后结算旧 DISPATCHED 行"这个场景，不是没被调用，是天生用不上。
5. **崩溃重启的现役处理（仅覆盖 PREPARED）**：`BrowserMutationStore` 构造函数（第57-59行）在每次打开数据库时执行 `update browser_mutations set state='FAILED',reason='BROWSER_COMMAND_NOT_DISPATCHED' where state='PREPARED'`——这精确对应 `LAW-LOCAL-BROWSER-SESSION-004-V55` 里"风险 grant 的 PREPARED 行在 Browser 崩溃重启后已由原 WAL 证明为 FAILED + mutation_outcome=no + physical_input_count=0、从未推进 DISPATCHED"这一条已经被法案认可的既有安全结算。**但法案原文这条许可只覆盖 PREPARED，没有对 DISPATCHED 给出等价许可**，构造函数里也确实没有任何一行处理 `DISPATCHED`。
6. **阻断消费方**：`BrowserLaneCoordinator.nextWaiter()`（`browser-lane-coordinator.ts:179-206`）里 `mutationBlocked = this.hasUnresolvedMutation()`（`countDispatched()` 不区分 `effect_scope`，全表计数），一旦为真，跳过所有 `kind==='acquire'` 的等待者——这是 `LAW-LOCAL-BROWSER-SESSION-004-V55` 明文要求的安全机制（"任一旧 DISPATCHED...均阻断所有 job 的新物理输入"），本身正确，不是断裂点。

**第一直接断裂**：第5点——`BrowserMutationStore` 的启动期 reconciliation 只结算 `PREPARED`，遗漏了 `DISPATCHED`。一旦一条命令在上一次进程生命周期里恰好卡在"帧已经发出、REPLY 还没收到"这个窗口（例如上一次进程被重启/杀死的那一刻），它就永久停留在 `DISPATCHED`：负责接收其 REPLY 的那个 `AwaitingReply`/session 随进程一起消失，新会话的 `command_id`/`sequence`/`authorityEpoch` 体系与它无关，第2/3条路径永远不会再触发；第4条路径因为法案禁止复用旧 `target_ref` 而在架构上用不上。三条正常结算路径同时失效，只剩第6点的阻断永久生效——这就是当前3个生产 job 全部卡死在 `lane=blocked` 的精确成因。

## 5. 四维闭环映射

| 维度 | 现状 |
| --- | --- |
| 法案系统 | `LAW-LOCAL-BROWSER-SESSION-004-V55`（P0，`appliesTo` 覆盖 `src/lib/browser/**`）forbidden 条款逐条核对：（a）"风险 grant 的 PREPARED 行在 Browser 崩溃重启后...才可重新绑定"一条，字面只讨论 PREPARED，是 `physical_input_count=0` 且"从未推进 DISPATCHED"的行；本方案要处理的行**已经**推进到了 DISPATCHED，不落入这条许可的字面范围，因此本方案新增的结算**不能**援引这条许可，必须独立论证（见下）。（b）"不得发生：任一 unresolved DISPATCHED 被其它 job 或新 Target 页面 mutation 越过...原 WAL 相关旧 command 全部真实 terminal 且未决集合为空,Browser 才能...出具 target-independent input-quiescence 证明"——本方案新增的启动期结算**就是**在为 `target_local` 行产生这个"真实 terminal"事实，且只在**确定不存在任何可能收到该行 REPLY 的现役会话**（即整个进程重启，见第4节第2/3点分析）时才做，不违反"不得越过"，而是补上法案要求的"取得真实 terminal 读回"这一步在 `target_local` 场景下的唯一可行实现（`provider_effect` 场景另有 Website 授权路径，见下）。（c）"不得发生：把 fixed sleep、elapsed time...当作成功条件"——本方案不依赖时间流逝判断，依据的是"进程重启=原会话物理不存在"这一离散事实，不是等待时长。（d）`LAW-LOCAL-BROWSER-SESSION-003-V44` 的"不得凭旧数字 tabId 猜删操作者 Tab"/"不得建立持久 Target claim/registry"——本方案不读取、不使用、不恢复任何旧 `target_ref`/`document_ref`，只是把行本身的状态字段从 DISPATCHED 改写为 FAILED，不触碰 Target 生命周期。（e）`provider_effect` 类：法案要求"只有 Website 持久签发...才可给新 effect 至多一次输入""已被 Website 精确结算的旧 Provider effect 从 Browser 原 WAL 全历史...中消失"是被禁止的——本方案**明确排除** `provider_effect` 行，不对其做任何启动期改写，保留现状（继续阻断，等待 Website 授权路径），完全不触碰这部分法案约束的对象。 |
| 施工图 | 未找到专门覆盖 Browser mutation WAL 生命周期的施工图文件；`browser-mutation-store.ts` 自身即是当前唯一实现依据，其构造函数内已有的 PREPARED 处理即是"崩溃恢复"这一职责当前在施工图层面的唯一落点，本方案是在同一职责、同一函数内补齐遗漏的 DISPATCHED 分支，不新增职责。 |
| 现役实现 | 见第 4 节，第一直接断裂精确定位到 `browser-mutation-store.ts` 构造函数缺少对 `DISPATCHED` 且 `effect_scope='target_local'` 行的启动期结算；`provider_effect` 行的现状（继续阻断）予以保留，不属于本次 GAP。 |
| 质检系统 | AGENT 唯一质检入口 `npm run quality:check`；`browser-mutation-store.ts` 命中 `local-browser-session` capabilityDomain 的既有 acceptance 套件（含 `local-browser-terminal-contract.acceptance.ts`、`local-browser-rule-mutants.acceptance.ts`、`local-runtime-browser-authority.acceptance.ts` 等），CHANGE 级会原生跑这些套件；本方案新增行为需要新增对应动态验收（见工单完成门槛），不能只靠既有套件顺带覆盖。 |

## 6. 故障与合同闭环

第一直接断裂：`BrowserMutationStore` 构造函数的启动期 reconciliation 语句只覆盖 `state='PREPARED'`，遗漏 `state='DISPATCHED' and effect_scope='target_local'` 这一类"进程重启后已经不可能再被正常结算"的行。

合同 handoff：`BrowserMutationStore` 构造（唯一 Owner，进程启动时机）→ `browser_mutations` 表的 `state`/`reason`/`terminal_at` 字段（持久化事实）→ `BrowserLaneCoordinator.hasUnresolvedMutation()`（消费方，决定是否放行新 `acquire` 等待者）。这条 handoff 的契约本身没有问题（lane coordinator 如实读取 state 字段）；缺口在 producer 侧没有对 `DISPATCHED` 场景产生它应该产生的终态事实。

## 7. 删除反事实

**候选 A（采用）：在 `BrowserMutationStore` 构造函数内，紧邻现有 PREPARED 语句之后，新增一条只结算 `state='DISPATCHED' and effect_scope='target_local'` 的等价 UPDATE，写入新的、与 `BROWSER_COMMAND_NOT_DISPATCHED` 语义不同的独立 reason（`BROWSER_COMMAND_SESSION_LOST`），`state` 改为 `'FAILED'`，`mutation_outcome` 保持它转入 DISPATCHED 时就已经是的 `'dispatched'`（不改写为 `'no'`，因为帧确实已经发出，不能谎称"从未派发"）,`terminal_at` 写入当前时间。**
1. 当前需求必需？是——这是唯一能让"进程重启后无法再被正常结算的 `target_local` DISPATCHED 行"重新获得终态、从而解除全局 lane 永久阻断的位置；不这样做，红线（"无论如何必须自动恢复"）在这一类故障下永远无法满足。
2. 真实 GAP？见第 4/6 节：三条正常结算路径（同会话 REPLY、同会话错误回执、确认回读）在跨进程重启场景下全部架构性失效，只剩启动期 reconciliation 能补位，而它现在遗漏了这一类行。
3. 真实消费者？`BrowserLaneCoordinator.hasUnresolvedMutation()`（直接读取这次改动产生的新终态）；间接消费者是所有等待 `acquire` 的生产 job。
4. 唯一 Owner？`browser-mutation-store.ts`，不新增 Owner，原地在已有的启动期 reconciliation 逻辑旁新增一条同类语句。
5. 不加的后果？维持现状：任何一条 `target_local` DISPATCHED 行只要在进程终止的一瞬间存在，就永久阻断全部生产 job，任意次数重启都无法自愈——即当前正在复现的故障，红线不满足。
6. 更短方案？不存在——`resolveDispatchedMutation()`（确认回读）架构上用不了（第4节第4点）；不可能新增一条允许复用旧 `target_ref` 的路径（直接违反 `LAW-LOCAL-BROWSER-SESSION-003-V44`）；只能在"我们确定原会话不可能再回信"这一刻（也就是新进程启动、重新打开这份 WAL 的这一刻）做一次性、无需 Target 参与的本地状态改写，这已经是最短路径，且与现有 PREPARED 处理同构、同一次 reconciliation。
7. 替代关系？不替代任何现役机制；`resolveDispatchedMutation()`/确认回读能力原样保留，供未来真正"同会话内、同 Target 上"的场景使用，本方案不改它一行代码。

**候选 B（已考虑、判定不采用）：对 `provider_effect` 类 DISPATCHED 行也做同样的启动期自动结算。**
1. 当前需求必需？否——当前活跃故障里唯一卡住的行是 `effect_scope='target_local'`；且法案对 `provider_effect` 类孤儿行有单独的、更严格的处理要求（"只有 Website 持久签发绑定旧 effect 集合...才允许新 effect 一次可能重复输入"），本地静默改写会直接违反这条约束——`provider_effect` 代表"可能已经真的提交给 GPT"，双发有真实业务后果，不能由 AGENT 单方面在本地假定"反正进程重启了就当它没发生"。
2. 真实 GAP？没有——这是法案刻意设计的更保守路径，不是遗漏。
判定：**不采用**，本方案明确将 `effect_scope` 过滤条件写死为 `'target_local'`，物理排除 `provider_effect` 行，不给未来误用留下"顺手把范围扩大"的空间。

**候选 C（已考虑、判定不采用）：新增一个独立的、可配置的"孤儿命令清理"服务/定时任务，定期扫描并结算陈旧 DISPATCHED 行。**
1. 当前需求必需？否——候选 A 已经用现有的"进程启动时机"（唯一确定"原会话已死"的时刻）完成结算，不需要一个额外运行时组件去猜测"多久算陈旧"。
2. 真实 GAP？没有，是候选 A 的过度设计版本，且新增独立服务/定时器与 `LAW-LOCAL-BROWSER-SESSION-002-V6`（"不得发生：second keepalive transport"）等条款讨论的"新增独立后台机制"风险同构（另一份方案已经因为同样理由否决了服务器侧新增定时器，见[浏览器扩展连接自愈-完整实现方案.md](浏览器扩展连接自愈-完整实现方案.md)修订记录）。
判定：**不采用**，避免新增运行时机制。

## 8. 唯一目标链与原子工单

**W1（唯一工单，`src/lib/browser/exact-target/browser-mutation-store.ts`）：** 在构造函数内、紧邻现有 `where state='PREPARED'` 语句之后，新增一条 SQL：

```sql
update browser_mutations
set state='FAILED', reason='BROWSER_COMMAND_SESSION_LOST', terminal_at=coalesce(terminal_at, ?), updated_at=?
where state='DISPATCHED' and effect_scope='target_local'
```

（`terminal_at`/`updated_at` 用同一个新生成的时间戳；不改写 `mutation_outcome`、`physical_input_count`、`proof_hash` 等已有字段——它们如实保留"帧确实发出过、但无法证明后续物理输入情况"这一原始事实，不伪造成"从未发生"。）不新增字段、不新增方法、不新增 Owner、不改变构造函数签名。

完成门槛：
- `npm run typecheck` 通过；
- 新增动态验收（同一 acceptance 文件 `scripts/acceptance/local-runtime-browser-authority.acceptance.ts`，复用其已有的临时目录+`BrowserMutationStore`直接构造模式）：（a）构造一个 `target_local` 效力域、`state='DISPATCHED'` 的行，重新以同一 `dataDir` 打开一次新的 `BrowserMutationStore` 实例（模拟重启），断言该行被改写为 `FAILED`/`reason='BROWSER_COMMAND_SESSION_LOST'`；（b）构造一个 `provider_effect` 效力域、`state='DISPATCHED'` 的行，同样重新打开，断言该行**保持** `DISPATCHED` 不变（防回归：确认候选 B 没有被意外引入）；
- `npm run quality:check CHANGE` 原生通过。

**跨文件顺序：** 单文件单工单，无跨文件/跨仓顺序问题。

**回退点：** 删除新增的 SQL 语句块及对应的两条新增断言，构造函数与验收文件均还原为原样。

## 9. 验收

- 正向验收：对当前真实故障现场（`.grasseye-local/browser/browser-mutations.sqlite` 里那一行 `close_gpt_execution_profile`/`DISPATCHED`），施工后重启 AGENT，确认该行被自动改写为 `FAILED`/`BROWSER_COMMAND_SESSION_LOST`，`GET /api/health` 的 `productionRuntimeBrowser` 不再报告 `lane=blocked`，3 个卡住的生产 job 能够重新进入 `prepare_clean_gpt_chat` 并产生新的 `browser_mutations` 行（即真正开始执行浏览器操作，不代表它们一定成功完成手上的业务，只代表 lane 阻断本身已解除）。
- 防回归验收：W1 完成门槛里的两条新增断言（target_local 结算、provider_effect 保持阻断）；确认既有 PREPARED→FAILED 那条语句未被改动、既有行为不变。
- 最终业务 readback：本方案不改变任何生产任务的业务逻辑或结果判定，其价值体现为"AGENT 重启后不再需要人工介入数据库即可解除因孤儿 DISPATCHED 行导致的全局 lane 死锁"——由后续实际生产运行观察验证；3 个当前卡住的 job 后续能否真正跑完 SEO 文章生产流程，取决于它们各自的业务逻辑，不在本方案验收范围内。

## 10. 施工准入自检

- 需求→GAP→工单→验收：已映射（第6-9节）。
- 深度：标准（单 Owner 内，不新增状态机/持久化字段/跨仓 handoff，第3节）。
- 回归信号：未命中（第3节）。
- 删除反事实：候选 A/B/C 逐一裁决完毕（第7节），候选 B/C 明确不采用并写明理由。
- 有限分母：DISPATCHED 行只有 `effect_scope ∈ {target_local, provider_effect}` 两种，`target_local` 在跨进程重启场景下施工后收敛到 `FAILED` 终态；`provider_effect` 维持现状阻断（其终态收敛路径是法案定义的 Website 授权流程，不在本方案分母内，是明确排除项，不是遗漏）。
- 四维冲突：已裁决（第5节），核心是确认新增结算精确落在 `LAW-LOCAL-BROWSER-SESSION-004-V55` 对 PREPARED 已认可的同类安全结算的延伸，且物理排除 `provider_effect`，未削弱其保护。
- 质检：AGENT 唯一原生入口，新增两条动态断言直接验证本次改动，未新增第二质检。
