# AGENT Demand–Result 收敛重构—完整实现方案

状态：**可施工（2026-09-26 闭环重绑）**。本轮只更新既有唯一施工方案，不授权直接修改生产代码/法案/数据库/Browser；施工必须按本文工单顺序逐项取证、修改、原生质检和动态验收。GPT fresh-submit 若真实取证命中需改冻结语义的分支，必须在该工单处停下并取得显式解冻授权；未命中则不触碰冻结法条。

## 1. 用户红线与完成定义

Website 签发的有效 job，只要未取得当前结果的领域 admission receipt，也没有 Website 持久化取消、删除或撤权，**AGENT 的取得并交回结果责任持续存在**。用户最新明确本轮范围：AGENT 关闭或崩溃后，按现役入口重新启动即可；启动后必须从可读的本机 SQLite/Browser WAL/Outbox 自动接回未完成 job，无需再次手工 run。操作系统自动启动 AGENT、Mac 无人登录启动与本机证据永久损毁不属于本轮。Browser/Target/lease 故障、失败 attempt、代码错误、证据暂缺、需人工修复，均不能成为业务终点。故障处置后仍接回同一个 `job_id`、冻结业务输入与 Website demand；不要求用户重新购买、重新提交工单。

真正完成只认 Website Domain Consumer 的同一 job/result hash 领域入库、admission receipt 与对象读回。机械合格结果由 AGENT 交付，Website 决定领域接纳；Website 明确 rejection 才可签新 result revision。取消、删除、撤权、永久停止只能由 Website 持久权威决定，且不得报告为结果交付成功。

四条主不变量：**Demand Liveness**（未完成需求不能静默失联）、**Result Monotonicity**（已机械成立且可持久读回的 exact 结果不被后置故障撤销）、**Provider Dedup by Default**（已知 effect 原位零 submit；物理不可消歧且原结果不可取得时，用户已明确选择交付优先，只准 Website 经持久风险裁决签可能重复的下一次提交）、**Website Single Authority**（attempt/revision/风险重放/业务终止只由 Website 决定）。任何 `fail_closed` 只禁止当前危险动作，不能充当 job 的业务终态。现役绝对 `at-most-once` 法案与该例外冲突，G1 必须先获授权修改，不能在现役代码里偷开后门。

工程上不能假称 Provider 永久不可用时结果已交付。此类故障必须保留 demand 和原身份，自动继续有意义的只读核验与有限退避，并暴露精确故障供原 Owner 修复；修复后自动接回原 job。对原 Target/Provider 历史已经无法定位的提交歧义，自动核验达到法案固定的有限证据门后，Website 以本轮获准的交付优先政策自动签一次有编号、有风险记录的新 attempt；不要求用户逐次手工点击。报警、人工取证、纯函数返回一个动作，均不得算交付。计划的动态验收必须实际达到 Website admission/object readback。

## 2. 当前候选、权威冲突和第一断裂

本轮重绑基线（2026-09-24）：AGENT `/Users/nexgen/Documents/AGENT` `main=ec737045fae9e8f5c41bf6bebc7558f3a2fb2b05`；Website `/Users/nexgen/Documents/xuanxue-web` `main=0af6398fe7a257ae53d84fd7bfd2f46f2764155c`，两仓均与 `origin/main` 相同且启动时无未提交改动。下表记录原始开工时发现的缺口，不冒充当前代码状态。只在两个主仓 `main` 工作树施工，不建分支或 worktree；每个片区修改前重新读取目标路径状态。

| 维度 | 开工基线（法案/拓扑为本轮替换前版本；代码仍待施工） | 必须改变的控制语义 |
|---|---|---|
| Website 法案 | `LAW-AI-ACCEPTANCE-004-V27` 同时规定普通技术故障保留有限 `retry_not_before` 自动下一动作，又要求 target-local DISPATCHED/CONFIRMED、非法/缺失/矛盾事实保留旧 attempt 并失败关闭；`LAW-AI-ACCEPTANCE-002-V28/012-V36` 与领域法还冻结精确恢复矩阵。 | 先明确“失败关闭的是当前 mutation”与“Website demand 持续”的层级；给每个保留 attempt 的失败分支安全、可执行的下一步，不能只保留旧行。 |
| AGENT 法案 | `LAW-AGENT-PRODUCTION-RUNTIME-001-V68` 保留 Website 唯一恢复 Owner、Browser WAL at-most-once、唯一 Outbox、无第二调度/存储；`LAW-CAPABILITY-GOVERNANCE-002-V3` 要求机械合格结果交付 Website。 | 不改这些基础 Owner；把结果交付优先和持续恢复责任投影到 Runtime/GPT/Browser 边界。 |
| 冻结拓扑 | `AGENT运行拓扑图-完整实现方案.md` §8.2 O12/O13/O14 写“保留旧 attempt，fail closed，Provider 0”；§8.1 O16 只覆盖已有 staged/terminal 的消费。 | 顶层改为 Demand→Result→Admission；Oxx 仅解释 RESULT_ABSENT 内当前动作资格，不能是 demand 终点。每个 Oxx 必须有下一次取证/授权/读回接点。 |
| Website 实现 | `job-expired-attempts.ts` 对 fail_closed 写 `retry_not_before=null`；`job-claim-selection.ts::v6RecoveryCandidateAllowed` 只收 same-effect readback 或 cooldown null；`job-claim-observation.ts::v6JobNextAction` 即使返回 ACTIVE_ATTEMPT，也未证明会被领取。`output-artifact-routes.ts::bindResultEnvelope` 在 envelope 上传时已写 Website `staged_result_json`，但过期转换未以该事实为优先门。 | 不能再把“观察上仍 active”冒充“实际可恢复”；claim/过期/观测须同一事实与时间门。Website transport staging 先保全并禁止新 attempt，之后精确核 proof；单凭上传不能判机械 READY。 |
| AGENT 实现 | `runtime-loops.ts::workerIteration` 满 N 只为 provider-readback/cooldown 发 recovery-only claim；`runtime-claim.ts::reconcileClaimAttemptFailure` 对 fail_closed 直接停止。`executor.ts` 在 complete 上传成功后仍可因 settle/release 抛错走失败；本地 stage 晚于 Executor 返回。`runtime-business-admission.ts` 看到 Website `WAIT_NEW_ATTEMPT` 会调用 `store-task-state.ts::releaseAttemptForWebsiteDecision`，直接清本地 staged result 与未发 Outbox。 | 同一 job 要能在满 N 回收；完成结果先 durable stage/交付，清理故障单独诊断；Website/AGENT 结果与 attempt 裁决冲突时保全结果、精确对账，不能清除结果。 |
| 启动恢复 | `LAW-STARTUP-ENTRYPOINT-002-V4` 规定 AGENT 在本地 Mac 的 4173 Shell 启动，不由 Website 或 systemd 管理；`runtime-startup.ts::blockedRuntimeHandle` 只提供 health/snapshot/close；`workbench.ts::initializeOnce` 缓存该非空 handle 并把 Shell init 标 ready，此后不会自动重试 Runtime。 | 本轮只要求 AGENT 按现役入口重新启动后安全进入唯一 workerLoop，保留 SQLite/Browser WAL/Outbox 并自动接回 job；启动时的 blocked handle 不得被当作已恢复业务执行。宿主自动拉起不进入本轮。 本机旧 `production_attempt_handoffs` 的 8 条记录已经获授权单次 cutover 到现役三表结构并逐行核验身份、seal、manifest、first fact 与 accepted 时间；普通 Runtime 启动必须只读校验精确三表，旧形状、缺表或未知形状稳定要求离线迁移，不留启动迁移、补表或兼容入口。 |
| 质检 | Website V6 Exam 现有断言支持 fail_closed 不再领取；AGENT 现有 cleanup 测试只覆盖“主失败后 cleanup 再失败”。两仓唯一 verdict 分别是 `pnpm quality:check`、`npm run quality:check`。 | 删除/反转证明隐藏终态正确的断言；新增端到端活性与结果单调性反例。普通测试不等于生产交付证明。 |

现场三条是不同分支：`7e726…` 的 Browser WAL 证明同一 Provider submit 已 CONFIRMED，但无答案/结果 artifact，本地 failure=null，Website 误投影 unclassified；`a3e9…` 已有 O13 真实失败事实；`e500…` 已有 O14 真实失败事实。三者都未获领域结果，当前不能重发 Provider、重签 attempt 或删除。修复必须是通用主链，不能为三条开特殊后台通道。

2026-09-24 原身份实测新增事实：Website 已对三条同 job 成功 `LEASE_GRANTED`，三条却在 Browser 报 `BROWSER_OLD_TARGET_RECONCILIATION_REQUIRED`。Browser 启动把所有历史 mutation 的数字 `target-tab-*` 补成 `legacy_wal` 未释放 claim，现场尚有数百条、跨数百历史 job；这些只是旧实例候选，不能单凭 `released_at=null` 判定数百个物理 Target 仍存活，更不能把它们一律作为所有 job 的全局互斥门。全局新页面 mutation 门针对真正未结算的 `DISPATCHED` 输入及当前唯一 lane/Extension handler；历史 claim 在归属 job 的旧实例读回、精确释放或 typed quiescence 中局部结算。`7e726…` 的 CONFIRMED effect 仍须零 submit 读回；`a3e9…`、`e500…` 不能被其他历史 job 的纯 legacy claim 永久饿死。若新 Tab 数字 ID 与旧 legacy claim 重合，只能在 Extension 实例身份核验和旧 handler/read barrier 停稳后局部处理，不能按 tabId 猜删或直接抹 WAL。

本轮三份外部分析的共同指控经代码与数据库核对成立：`browser-mutation-store.ts::ingestLegacyTargetRefs` 把历史数字 Target 补录为未释放 claim，`browser-target-acquirer.ts::ensureAvailableTarget` 将外 job 的纯历史 claim 提升为全局物理占用；`runtime-loops.ts::prepareSourceHandoffs` 对非零 Provider 输入直接跳过；`store-task-state.ts::readSourceReadbackExhaustionHash` 只数三次观察和 120 秒，Website `job-claim-authority.ts::verifySourceHandoff` 只认非空总 hash 而不能逐旧 effect 验证真实读回路径。三份报告关于“修 global gate 即可恢复全部工单”的暗示不成立；`7e726…` 的 CONFIRMED Provider 输入还需原 effect 零提交读回与 Website 精确风险授权。Browser 旧 Target 若有真正未结算 DISPATCHED 或旧 handler/CDP action 未可证静止，仍须保留跨 job 全局门；纯 `legacy_wal` 候选与真实物理占用的判定必须由 Browser Owner 出具，不得靠当前数字 tabId 猜删。

另有独立的治理断裂：现役 `LAW-AGENT-PRODUCTION-RUNTIME-005-V38` 声称精确两表和普通启动只读；当前 `store-foundation.ts` 实际使用 `production_attempt_handoffs` 第三表，并有启动补表/迁移分支，acceptance 却以“两表”文字报告三表 PASS。第三表有原 attempt seal/issued attempt/真实读回消费者，不能删除；本机旧 8 行已完成一次获授权 cutover，启动迁移分支已无当前必要性。本轮将该法条原位升至 V39，明确精确三表与普通启动只读，并物理删除补表/旧表迁移代码及相应虚假验收；不新增另一迁移机制。

减法裁决：普通 Browser 启动的 `ingestLegacyTargetRefs()` 已删除；本机历史 723 组 job/Target 均已有原 claim，改为只读覆盖核对，缺口需单次证据化 cutover，不能在每次启动重造未释放 claim。旧的“三次通用失败且过 120 秒即耗尽”函数和对应验收已删除。`production_attempt_handoffs.readback_observations_json` 保留：它是现有第三表内唯一跨进程保存逐 effect、逐实际路径阴性观测的字段，删除会让崩溃后的已做读回失忆，且没有第二持久化消费者可替代。历史 WAL 和 Provider effect 一律保留。

## 3. 新拓扑：业务只看 Demand → Result → Admission

`RESULT_ABSENT → RESULT_READY → RESULT_ADMITTED` 是从现役 Website/AGENT 事实派生的三段投影，不新增运行时业务状态。READY 精确定义为当前 accepted attempt 下结果已按其合同机械核验且本地 stage + terminal intent 同一事务持久，并有当前 Website 授权；旧 attempt 的原始字节或尚未闭合 receipt 只是候选，不得冒充 READY。Website 持久取消、删除、撤权或永久终止才走 `DEMAND_TERMINATED`；失败、attempt、Target、lease、WAL、O11–O14 都不是终点。Website 拒绝当前 result revision 时仍是同一 job，由 Website 签下一 revision。

对每个 `demand_active && !admitted` 的 job，Website 现役 claim/observation/expiry 必须从同一持久快照给出一个可被现役消费者实际执行的动作、Owner、最早资格时间和有界再次检查时间：交付原结果、同 attempt 读回/terminal、有限退避等待新 attempt、已授权新 attempt 执行、原 effect 读回或风险重放。公开 V6 next action 仍可用 `ACTIVE_ATTEMPT / WAIT_NEW_ATTEMPT / CONSUME_CURRENT_RESULT`，但非空码、日志或提醒不能代替 worker 实际领取、执行和 receipt 读回。普通故障不得持久写出永不再领的 `retry_not_before=null`。

**优先顺序只有一个：**先核 Website admission/终止；再核 AGENT 本地 stage/Outbox、Website artifact/terminal、所有未完成结果候选；机械成立则继续交付，不能签新 Provider 输入。确证无可恢复结果后，Website 才处理 attempt 和 Provider effect。机械合同按结果声明且 accepted/执行时有效的 `result_contract_id/version` 验证；新代码、新 Prompt 或拓扑 hash 不能追溯否决旧合法结果。Provider effect 读回证明用于判断是否可以再次输入、核旧失败；若 exact 结果字节/身份/合同/回执已能从持久事实验证，进程内 `ProviderEffectReadbackProofV1` 丢失不能单独阻止交付。

## 4. RESULT_ABSENT：普通失败换 attempt，现实副作用由 Browser 守门

### 4.1 Website 的唯一恢复规则

无机械有效 READY/terminal/admission，且 Website demand 仍 active：普通技术失败或旧 lease 过期后，Website 在原 job 行锁中结束旧 attempt，保存有限 `retry_not_before`。到时必须先在同一 claim 事务核 AGENT 已鉴权的原 task/Outbox/Browser 全历史 `source_evidence[]` 与 Website artifact/terminal；旧结果可恢复则给旧 attempt 交付授权，已证不可恢复才签**同 job/revision**新 attempt/fence。first failure 缺失、非法、矛盾或 O12/O13/O14 分类不再是领取资格。原 failure 以 opaque 原值保留作证据，不伪造 typed fact；Website 的公开 claim、observation、expiry 读取同一资格/时间谓词。Website 不对 Product Flow、Browser DOM 或 Provider step 发逐步命令。新 attempt 是执行授权，不是再次提交 Provider 的授权。

换代前先处理旧结果候选。Website transport `staged_result_json`、AGENT local stage、旧 Outbox/artifact 任一存在时，仅在**有限核验期**冻结新 attempt：同旧 attempt 的 readback-only/交付授权用于核字节、合同版本、身份、回执。可修复则交付原结果；到期确证候选不可恢复、没有 READY/terminal/admission 时，AGENT Runtime 把各原 Owner 的事实组成 `SourceAttemptEvidenceManifestV1`，经现役鉴权 session 的 V6 claim request 最窄 `source_evidence[]` 传入；Website 在原 job 行锁中核 source attempt/fence、first failure、候选/Outbox ref/hash 与 Browser 集合 hash，写原 job 事件和 claim receipt 后解除冻结并继续新 attempt。manifest 精确列旧 attempt/fence、Website first failure 原值/hash（缺失也明确）、AGENT 本地 first fact 原字节/hash、各 stage/result 候选的合同版本/ref/hash、旧 Outbox payload/receipt ref/hash、Browser 旧历史集合 hash和不可读候选的有界缺失证明。结果字节仍由原 Outbox/artifact Owner 保管，不复制正文到 job 事件。expiry 只设有限再领取资格；source_evidence 出具前，Runtime 原 per-job Owner 必须收束旧 executor/completion 入口，并在原 task 当前投影以原 task 的 current_attempt_id + current_reason + staged_result_json is null 及旧来源 hash 作持久 CAS 封住旧完成端口（本地无持久 fence；Website 在原行锁单独核旧 fence）：上传途中晚到的旧 `context.complete` 即使取得 artifact receipt，也不得在该 CAS 后写 stage/terminal intent；旧身份、first fact、候选/Outbox 原值继续保留。Website **收到并验证 source_evidence 的 claim 事务**才签新 attempt，claim receipt 与 manifest 同事务，并须验证旧 fence 失效及绑定该收束快照的当前 AGENT attestation；到本地应用新 grant 前旧 execution 不能重新 stage。AGENT 读回该 receipt/event 后，才在 `acceptTask/acceptTaskAfterFailureReconciled` 精确 CAS source first fact、候选 hash、issued attempt/fence 并切当前 projection，旧 Outbox/artifact/WAL 字节不删。旧完成端口在封口前已经原子 READY，则 handoff 必须失败并走原结果交付；封口后收到的旧字节只留历史候选。Website 签发后到 AGENT 本地切换的任一点崩溃，都重读同一 issued grant/manifest 幂等继续，不能再次签或无凭证清空 first fact/stage。

Website grant 已持久 accepted、AGENT 尚未本地 durable accept 时崩溃：重启凭 Website 同一 claim receipt 和原 task 身份，Runtime 在 `source_evidence[]` 明确提交本地从未 accept 的 empty source fact，并核原本地 SQLite/Outbox absence、Browser 原 WAL 中该 job mutation absence 与“accept durable 先于 Browser/Product”写前门后首次 durable accept；任何身份不符先停危险动作并继续原 Owner 对账。没有本地 task 时不能靠新建空 WAL 推断无 effect。已存在本地 unfinished task 的恢复按当前 Website issued grant 与旧 manifest 对账。满 N 个业务席位时，原未完成 job 的 claim/reconcile 不能因新工单容量门永久饿死；限流/cooldown、device/session/route/material/control 门仍按原 Owner 生效并给有限再检查时间。

### 4.2 Browser WAL 是 Provider 输入守门，不是 business stop

Browser 原 WAL 在同一原始本机 SQLite 上持续可读是本轮 crash/restart 故障范围。Browser 启动须在可自动建空库的 `new Database` 前，按 Runtime 原 accepted task 检查 WAL 文件存在、schema/integrity/原文件身份和历史执行版本；文件缺失/替换、store 未加载、查询不完整都为 UNKNOWN，不得把 facade `0/null` 当零 effect。本轮不为 Mac 硬盘永久损毁建跨设备灾备。Product 在**任何页面准备/submit 前**通过 Browser 原公开 facade，按 `job/revision/product_step_id/call_id/child` 枚举全部旧 attempt 与风险 revision 的 Provider 行，本轮受控切换保持在途已接纳 job 的 step/call/child 与 ordinal 稳定；若 Product 调用键漂移，GPT 对已签 calls=[] 来源授权或未结清风险授权在页面准备前失败关闭，不得把新键当无历史或自行提交。后续若确需改键，须先在同一 Owner 内证明单一旧→新映射并完成两仓授权与验收，原 job 保持自动再检查资格。

完整原 WAL 中该业务调用的所有历史 row 均为可证命令未离开 Browser 的 PREPARED/FAILED，或 `REJECTED + mutation_outcome=no + physical_input_count=0`，才是**全历史无物理输入**。Website 普通新 attempt 下 Browser 允许当前 Product 的新 request/payload hash 首次 `prepare`/submit，并把旧零输入行原样留下；代码/Prompt 迭代不要求新 hash 等于旧 hash。任何 DISPATCHED、CONFIRMED 或其他 REJECTED，包括 `REJECTED + dispatched + count=0`，都不是无输入：普通新 attempt 必须按原 effect/current Target/locator 零 submit 读回；不能因旧 row 的 attempt 不同而重发。原 `readProviderEffectStepCallFact` 等单值 reader、GPT preflight/`readConfirmedSubmit` 必须精确区分当前授权行与跨 attempt 全历史集合，不可因两行就 AMBIGUOUS、也不可取“最新行”冒充当前事实。

原 Target/Provider 历史已无法取得答案、或 DISPATCHED 物理事实长期不可消歧时，Website 先重授原 accepted attempt 的只读恢复权；Runtime 在释放旧 Target 前逐一调用原 GPT/Browser Owner 对旧 effect、旧 Target/Document 做**真实的零输入有界读回**，把每次 exact 调用键、effect、Target、观察时间、结果或失败码和 Owner proof hash 写进原 `production_attempt_handoffs`。旧 Target 仍可安全重绑时先在旧 Target 读回；若旧实例确已失去安全绑定，已 CONFIRMED 的 WAL 仍可能保有 canonical conversation URL 与 user turn 锚点，必须先经现役 GPT/Browser 在新独占 Target 选择原会话并按原 user turn 零提交读回；只有两条适用路径均失败才可报告旧答案不可取得；旧 DISPATCHED 根本无可信会话锚点时，Browser 出具逐 effect typed unaddressable，明确旧答案可能存在但无法机械归属，待旧输入停稳后由 Website 单独签一次可能重复的风险授权。任一路径读回成功即继续同一结果交付。历史 WAL/Outbox hash 的定时重算、单纯等待、`SOURCE_RESULT_RECONCILIATION_PENDING` 均不能计作读回，也不能生成耗尽证明。 核对哈希实现后，现役 Provider exact call hash 已排除 attempt/fence，续租本身不造成该 hash 不匹配；跨 result revision 的旧 effect 查询仍受当前 revision 过滤。Browser 唯一 Owner 应以旧 WAL 原 revision、原调用集合和可信密封 canonical URL/user turn 只读定位旧行，当前 fence 只授本次只读动作。旧 Target 不可绑和新 Target exact user turn 的负观察要在实际 Extension/DOM 发生点产生 typed proof，Runtime 才能记录，泛化错误码或 timeout 不算耗尽。若 Browser 证明原 Target 已物理缺席或精确身份丢失，先记录旧 Target 不可绑的 typed Owner fact；CONFIRMED WAL 有可信会话锚点时仍须在新 Target 读回，不能把旧 Tab 缺席直接冒充旧答案不可取得。Browser 保全旧 WAL/结果候选。当前 Extension registry 与持久 claim 精确同一的旧 Tab 由 Browser Owner 关闭，并向 Chrome tabs/debugger 读回物理缺席；registry 丢失或旧 v40 只有 target-tab 数字时，禁止按可能复用的 tabId 猜删，须由已鉴权 Extension 等待旧 handler 全部结束、旧 CDP page action/read barrier 全部停稳，核旧 transport epoch 与 fence 已撤销，并把 typed quiescence proof 持久到同一个 Browser SQLite。仅 socket 断线、扩展无 handler、deadline、detach/park、内存 registry 空或 CDP 读屏不足均不算停稳。旧 Target 物理缺席**或**旧输入已确证静止后，同一唯一 lane 才能给**任何**新 Target 物理 mutation，包括同 job 新 attempt 与 sibling job；此前仅旧 Target readback 和受限清算可进。若旧 handler/CDP action 是否静止无法证明，则保持 UNKNOWN 与自动再次核验，不按数字关用户 Tab。旧页面不再可操作不等于终止旧 job；旧 job 接下条 Website 风险裁决。O12 的 target-local 动作不再决定 demand，O13 CONFIRMED 仅证明局部页面动作，O14 坏/缺 first fact 仅作 opaque 证据。

### 4.3 用户已授权的交付优先例外

多 effect 的单一来源 seal 覆盖全部旧可能输入调用，每项仅有 `settled_reusable` 或 `replay_exhausted` 结论：A 的原 checkpoint 写入并读回 Forensics 后，Runtime 在现有 `production_attempt_handoffs.readback_observations_json` 按旧 effect/attempt/revision/调用/artifact 精确身份持久成功事实；B 的两条适用读回路径真实耗尽才持久阴性事实。Website 行锁验 A+B 全集，只为 B 签风险 grant；仅 Website 风险 revision 的原 Product 流程由 GPT 对 A 读旧 WAL 和原 artifact 零输入复用；领域 rejection revision 仍按原领域修正指令执行，对 B 按 Website grant 至多一次输入。`readback_exhaustion_hash` 仅覆盖 B；A 的 source 产物缺失、身份或调用键漂移时失败关闭当前动作并自动对账，不能偷跑 fresh。不得新增表、第二 Worker、第二 Outbox 或兼容链。

只有**原结果不存在或不可恢复、原 Provider effect 可能已输入/已确认但答案无法读回、旧 Target 与可信会话新 Target 两条适用零输入读回路径均真实耗尽（或 Browser 已逐 effect 证明根本无可信会话锚点、现役 exact 路径无法机械归属）、旧 Target 可证物理缺席或原 handler/CDP 输入可证静止**时，Website 可在原 job 行锁中自动作 `delivery_priority_replay`。`quiesced` 只证明旧输入静止，不单独证明旧答案不可取得；仍可安全重绑的旧 Tab 必须先读回。AGENT Runtime 将 Browser 原 WAL 全历史/旧 Target 物理缺席或 typed quiescence fact、GPT 有界读回耗尽 fact、Runtime 结果/候选/Outbox/Website admission 缺席或不可恢复 fact，组成同一 V6 claim request `source_evidence[]` 的 `kind=delivery_priority_replay` typed 子项（exact job/revision/source attempt/fence、原 Owner ref/hash、观测时间、proof hash），经当前 session/attestation 送 Website；Website 在**原 claim 行锁**验各 Owner 身份/哈希/时效，不另开 endpoint；校验 demand active、无 READY/terminal/admission、原旧 fence 失效、限流/cooldown/容量门后，把原 effect 集合 hash、旧候选 manifest ref/hash、单调的新 `result_revision`、允许的稳定业务调用键、source/issued attempt/fence、风险政策版本与 proof hash 写入**现役 job 事件和 claim receipt**，同事务签唯一新 attempt。现役 `CloudExecutionGrantV6` 的 exact per-job grant 增可空判别式 `delivery_priority_replay_grant`，包含新 result revision、稳定业务调用键、source/issued attempt/fence、原 job event/proof/grant hash；普通 grant 此字段为 null，风险 grant 必填，AGENT 只能从这个经原 claim receipt 验证的字段取得执行权限。原 accepted 行与事件/receipt/grant 精确绑定；响应丢失后原 claim/status 读回**同一 issued attempt/revision/grant hash**，不生成下一 revision。这里不新增 `recovery_resolution_json`、恢复表或第二队列。

`source_evidence[].readback_proofs` 与 `replay_calls` 按稳定业务调用键一一对应：每项含 `product_step_id/call_id/child_capability_id/source_effect_set_hash`，并对该集合中每个可能输入的旧 effect 记录原 `logical_mutation_id`、旧 Target/Document ref/hash、旧实例读回的实际失败或不可绑 typed fact、可信会话锚点是否存在，以及适用时新 Target 精确会话零提交读回的实际失败；每次观察含路径、时间、结果或失败码与原 GPT/Browser proof hash。只有某一调用中每个旧 effect 的适用路径均耗尽，该调用才为 `replay_exhausted`；已取得且持久读回原 checkpoint 产物的调用标为 `settled_reusable`；旧实例不可绑且无锚点也只证明无法继续 exact 读回。旧实例仍可绑但 WAL 无锚点时，必须另列 `unaddressable_quiesced`，并与 Browser 原 WAL 锚点缺失事实、旧输入停稳 proof 共同绑定，不能说旧答案不存在。现有 `production_attempt_handoffs.readback_observations_json` 只保存原 Owner 实际成功读回、路径阴性或 typed Target 不可读事实，按旧调用/effect/Target 分组；单纯时间、空 hash、`SOURCE_RESULT_RECONCILIATION_PENDING` 不能满足任何一项。`readback_exhaustion_hash` 是上述 `replay_exhausted` 子集证明的规范化 hash；Website 的原 claim 必须验证项数、唯一键、source effect 集合、逐 effect 路径与结果、时效和总 hash，不接受只传一个非空总 hash。

每张风险 grant 只准指定业务调用键的一次可能重复输入。Browser 原 `browser_mutations` WAL 只加可空 `delivery_priority_replay_grant_hash`，旧 row 保留，当前新 command row 仍用原 command 主键；同 job + result revision + 稳定业务调用键的风险 grant 绑定唯一。Website `CloudExecutionGrantV6.delivery_priority_replay_grant` 的新 revision/source-issued/grant hash 沿 Runtime→GPT `BrowserAtomicStepIdentity`→`BrowserCommandPermit` 及其 MAC payload→Browser command actor→原 WAL `prepare` 完整传递并在 extension admission 验证。第一次 `prepare` 同 WAL 事务把当前 revision/grant hash 与 Product 新 request/payload hash 绑定，代码迭代允许新旧 hash 不同；同一 revision/调用/grant hash 绑定之后只能读回该原 row。若 Browser 崩溃发生在 PREPARED、且原 WAL 重启结算为 FAILED/no/零输入、没有 proof/terminal/recovery payload，Browser 可仅在该唯一 row 内把相同 accepted attempt、revision、业务调用、effect/grant/request/payload 重新绑定到当前 command/fence/Target/Document；不得新增 row。旧 row 当前仍为 DISPATCHED、结果 UNKNOWN、已确认输入或任何身份漂移时，只允许零输入读回；已鉴权终局 `REJECTED/no/零输入` 则按下段保留旧 proof 后判断同 grant 是否可写下一 command。普通 `assertProviderEffectHistory` 只在全历史已证零输入时放行当前新 hash；有任何可能旧输入时，只有验证后的风险 grant 允许新 command。Browser/GPT 所有读回按当前 revision+grant hash 精确选行，Website 决策读全部历史；旧、新 effect 各自保持身份，不互相覆盖。若本次再不可消歧，有限退避、重新证明后 Website 才可给下一 revision；AGENT 不自循环重发。Provider 成本可能重复，诊断中如实记次数；Domain Consumer 对同 job/revision 只接受一个结果。

若风险 grant 的原 command 经过 Extension 精确回执结算为 `REJECTED/no/physicalInputCount=0`，不可改写旧 terminal/proof。Website 在同一 accepted attempt 上有限退避重授同 grant；Browser 仅当该 grant 全部既有 row 都证明零输入、无未决、同 effect/grant/request/payload 不变时，才可在原 WAL 为新 command 插入下一行并重新校验 permit/Target。已输入/未知维持同 effect 零输入对账，grant 总现实 Provider 输入仍至多一次。历史已被 Website rejection receipt 结算的旧 effect 仍进入完整 WAL/source effect set hash，但 Runtime 只能凭已签前驱 source handoff 与原 rejection 身份排除当前答案复用及当次读回，Website 以原 event/receipt 核准该排除；其它旧 effect 均需逐 effect 证明。

连续风险 revision 的唯一 `source_evidence[].readback_proofs.effects[]` 对已被精确拒绝的旧 effect 增加 `rejection_settled` 分支，仅携原 effect identity、来源 attempt 与已签前驱 source handoff seal；effect 的 revision 仍只由 Browser 原 WAL 按同一 effect identity 验证，Website 不声称独立还原该 revision；Browser 原历史 hash 与逐调用 effect set hash 不删行。AGENT 从原 `production_attempt_handoffs` 已接纳行、保留的 first_fact_raw 和原 Browser WAL 逐项核 `RESULT_SETTLED_UNUSABLE` 或 `GPT_RESPONSE_STOPPED_EMPTY`，不从较小 revision 猜测。Website 从原 job 的已签 source handoff event、failure ledger、精确 rejection event/receipt 回验该 effect identity 和来源；这类 effect 不进入当前 settled checkpoint 复用，也不要求重复读取已拒绝回答。每个调用的 `settled_reusable` 仅由未拒绝的 checkpoint 决定，`replay_exhausted` 仅由本次仍未结算且确证读回耗尽的 effect 决定；仅含历史已拒绝或此前已获风险授权的 effect 的调用标 `historical_settled`，不获本次新风险 grant，也不复用旧答案。连续同一调用 rejection 时，`source_evidence.rejected_call` 绑定本次完整调用集合 hash、当前唯一被拒 effect 与原 first failure/receipt，该调用的 readback proof 只列更早 effect，不得把整条调用从证明集合排除。此前已获风险授权的旧 effect 用 `risk_authorized` 绑定原已签 `delivery_priority_replay_authorized_v6` 事件、原 source seal、原逐 effect 耗尽证明与指定调用 grant hash；Website 沿已签 attempt ancestry 精确核原 event、grant 与当前 effect identity/前缀集合 hash，原观察超过 24 小时不要求重新读回，也不把旧风险裁决冒充当前 rejection 或再签一次风险 grant。普通领域结果 rejection 若未提供可核 Provider effect identity，不能走这项豁免。

现役 `job-claim-repository.ts::readPriorResultRejection` 仅以 `result_revision_rejected_v1` 事件计数派生 revision。本轮必须让同一原 job 事件流的领域 rejection 与 `delivery_priority_replay` 共同参与单调 revision 派生；每个 revision 仍只产生一份 Website 风险裁决，以完整旧调用集合为来源、仅对耗尽子集逐项签发独立 grant，旧 `prior_result_rejection` 只表示领域拒绝，不能把风险授权伪装成 rejection。`job-claim-repository.ts` 与 `provider-cooldown-repository.ts` 复用同一原 job revision reader，`localization-control-room-repository.ts` 的 latest rejection 仅供历史诊断 UI；当前风险 revision 的展示原因不得被旧 rejection 覆盖。现役 Website `v6-contract.ts` 与 AGENT `transport-protocol.ts` 的 `revision>0` 校验必须允许由 exact `delivery_priority_replay_grant` 支撑；风险 grant 的 revision/仅耗尽调用子集/逐调用旧 effect 集合 hash/每项独立 grant hash 必须与同一 claim event 一致，不另加第二 `revision_origin` 字段。当前 grant 的 revision 来源互斥：领域 rejection 时 `prior_result_rejection` 非 null、风险 grant 为 null；风险 replay 时风险 grant 非 null、`prior_result_rejection=null`。较早 rejection 只保留在 Website 原 job events，不作为当前 Product 修正指令；Product 对风险 revision 从原入口按当前冻结 task/材料执行；已持久取得的旧调用由 GPT 返回原 submit 的 promptHash 与原 checkpoint 产物，故即使新 revision 的 promptHash 改变也不要求重算相等，更不运行该调用的页面准备；只有耗尽调用使用当前新 revision 的 prompt 和 Website 风险 grant。Website claim 与 provider cooldown notice 都必须复用同一原 job revision reader，不能各自只数 rejection event。`reconciliationReceipt` 现役只处理同合同版本的旧 request 幂等回读；跨 v41→v42 时旧 receipt 留历史且不再授动作权。AGENT 新 session 使用当前 v43 request 与当前 attestation 从原 claim 新领旧 accepted attempt，Website 等旧 lease/fence 失效后签当前 fence；旧 `jobs_json` 不回传为 v43 grant，不新增跨版本兼容回读或第二执行链。

## 5. RESULT_READY：结果一旦机械成立就交付

公开知识文章的风险 revision 为三调用真实场景：普通新 attempt 从 Product 第一入口重新执行，不能取得旧半成品；仅原签逐调用风险授权的 `settled_reusable` research/article 精确 effect 可从原 Forensics checkpoint 零提交取回旧答案，image 等 `replay_exhausted` 指定调用再用本轮完整 Prompt 一次受控输入。此窄例外对应 Website 公开知识 004/005 现役修订，旧 conversation/DOM 不复用。

已机械有效并由 AGENT 原 SQLite stage+terminal Outbox 持久化的结果，需在 Browser Authority 缺席或 Provider cooldown 下继续原 claim 交付。claim request 只携本地精确 job/attempt/候选 hash，Website 在原 job 行锁核当前 accepted attempt、结果与 admission 缺席，只签 delivery-only 同 attempt lease/fence，不向其它未有结果工单放宽领取；AGENT 核原本地 staged 结果后只交付或读回原对象，绝不进入 Product/Browser。此为结果单调性与 demand liveness 的同一主链修复，不建第二 Worker/Outbox。

现役 `context.complete()` 先上传 payload/envelope、后做 GPT settle/Browser lease release，Executor 返回后 Runtime 才 stage。现役 `store-ledger.ts` 要求 stage 与同 result hash/全部 artifact receipt 的 terminal Outbox intent 一致；单独提前 stage，重启会触发 `PRODUCTION_LEDGER_INVARIANT_INVALID`。目标顺序是：

```text
Product 按结果声明的机械合同版本产出 exact result
→ 唯一 Outbox 上传原 payload/envelope/必要 image 并取得 exact receipt
→ Runtime 在同一 SQLite transaction 写本地 stage + 当前授权的 terminal intent
→ context.complete 返回
→ Browser/GPT cleanup 仅诊断；唯一 Outbox 继续 terminal
→ Website terminal CAS / Domain Consumer admission
→ admission receipt + domain object readback
```

现役 40 route 的 `context.complete` 在返回前须把结果/receipts 交 Runtime 唯一完成端口；只移动 settle/release 之后的 `completeClaim()` 不够。现役 `cloud-client.ts::terminalProductionTask` 混合构造 terminal body/requestId、`store.enqueue` 和即时 `deliverOutbox`；在唯一完成端口拆出同步构造 terminal intent，调用 `store.stageResultAndEnqueueTerminal(...)` 以同一 SQLite 事务持久 stage 与 intent，网络 `deliverOutbox` 留事务外且 cleanup 前即可恢复。stage+terminal intent 同事务前核 job/attempt/revision/request/result hash、Product 机械合同 id/version、source/execution identity 与全部必要 receipt。pending provider first failure 时，以该 fact 原字节/hash 精确 CAS 写 stage，**当前 first fact 保留**；AGENT 在原 `TerminalCasV6` 的最窄 `terminal_source_first_fact` 字段带本地 first fact 原字节/hash（没有则 null）；Website terminal CAS 核 exact job/attempt/revision/result 与 `terminal_source_first_fact` wire 完整性、AGENT 当前身份/hash、已存 source event 自洽后同事务受理；Website 旧 first row 缺失或与本地 fact 矛盾，只把双方原值/冲突写原 job 事件并诊断，**不得否决已机械合格结果的 terminal/admission**，原 `failure:null` 保持完成语义，不能要求本地 stage 前已经有 Website `result_delivery` 裁决。Browser 临时 readback proof 消失不单独否决可持久验证的机械结果。admission 后 Runtime 凭 Website 同 result receipt/对象读回，先将本地 task/业务席位以精确 CAS 标 completed 并退休 first fact，再尝试释放 Browser job-bound Target；清理失败仅诊断且 Browser lane 的旧 Target 安全门独立生效。Website 原缺 first failure row 时先由本次 terminal CAS 的 `terminal_source_first_fact` 把本地原值/hash 存原 job event，之后才 `completeTask()`，满足 completed authority。cleanup、log、Target 丢失都不得把 stage 翻回 failed；Browser lane 不安全可暂停新的页面 mutation，Outbox/Website 交付继续。

接纳读回的现场回归：Website 领域事务把同一 result 的 artifact 状态从 `staged` 改为 `admitted`，但 `device-status.staged_artifact_receipts` 只投影待暂存件；2026-09-23 22:48/22:50 UTC 的 e500/a3e9 两单已在 Website `completed + business_consumed_at`，AGENT 却因仍有 `staged_result`、暂存附件列表为空而抛 `V6_DEVICE_STAGED_RESULT_AUTHORITY_INVALID`。维持 Website 现有单一领域事务与状态接口；Runtime 先验证同 job/result hash 的 admission receipt，成立时不再要求 staged 附件数量，然后按原 `write_receipts` 修复本地回执并标 completed；无 admission 的待交付结果仍严格要求必要暂存附件。质检必须用「completed + staged_result 保留 + staged_artifact_receipts=[] + 有效 admission」回归，并用相同结果 hash 拒绝伪造接纳。不得借此重跑两单 Provider 或签新 attempt。

原 7e7263a0 工单现场：Website 对同一 accepted attempt 持续签 `ACTIVE_ATTEMPT`，Browser 唯一 WAL 存当前 attempt/revision 的 CONFIRMED `turn-submit` 与可信 canonical 锚点，本地旧 first failure 为 `BROWSER_OLD_TARGET_RECONCILIATION_REQUIRED`；Runtime 仅据历史 `fail_closed` 抛 `PRODUCTION_SOURCE_HANDOFF_REQUIRED`，故自动读回未进入 Product。修复只在远端原 failure 精确对账、同 attempt 重授、Browser typed fact 精确核当前 attempt/revision/原调用/CONFIRMED/可信锚点时，允许经唯一 Product→GPT→Browser 同 effect 零提交读回；这次 execution 在旧 effect 读回成立前不得执行 fresh 准备、其它 Provider submit 或不同调用键。旧 Target 可绑先读旧 Target，不可绑须 Browser 精确 typed fact 与输入停稳后释放，再用 WAL 原 URL 在新 Target 读回；缺事实保持有界自动对账。旧 first fact 不清；同 attempt 后续若产生多条 CONFIRMED effect，Runtime 按完整 WAL 集合逐条核当前 attempt/revision 与原调用，GPT 逐条读回并在同一 URL/userTurn 的 checkpoint 成功后开放下一调用。同一 Product 会话的下一条旧 effect 仍须再次精确选择自己的 WAL URL；已鉴权结算且无活动 claim 的旧 Target 仅允许新 Target 零提交读回，quiesced 不证明答案不可得。Result/Outbox/admission 仍先于失败分类。回归覆盖调用键漂移与 WAL outcome 空值均零页面 mutation/零 submit，其它 `fail_closed` 不因这条例外自动放行。

上传后、stage 前崩溃：用原 Outbox 写入/receipt 和 Website artifact 原 Owner 最窄鉴权 readback，按旧结果合同版本、字节/hash、slot、job/attempt/revision 重建**同一**结果，再在新授予的同 attempt fence 下原子 stage+terminal intent；现役 artifactReplay 只按旧 session/request 重放，新 session 不能盲 POST 旧 request。字节或 receipt 不完整则保全候选并有限读回；确证不可恢复后按 §4.1 先持久旧证据 manifest、Website 签普通新 attempt，Browser 在任何 Product 页面准备前按 §4.2 查全历史：可证零输入则普通执行，可能已输入则先原 effect 读回、确实耗尽才走 §4.3 风险授权。无 Provider 输入的 route 直接走普通执行，坏候选不能无限占槽。旧 verifier 在待交付旧结果仍有消费者时受控保留，不以当前 HEAD/拓扑 hash 否决。

stage 后、terminal/admission 前崩溃（包括 lease 过期与普通 release）：保留原 accepted attempt 的 staged artifact/receipt，先读 Website terminal/admission 和 `device-job status.write_receipts`，对已成立的旧 Outbox request 按 path/kind/payload hash hydrate，不用新 session 重发旧 request；若 terminal 确证缺席，Website 对**同一旧 attempt**重授当前 lease/fence，AGENT 跳过 Product/GPT，以同 result hash/receipt 在原 Outbox 建合法新 terminal intent 并发送。旧 intent 带证据标记被新授权取代，不删旧结果；Website 已 terminal 则仅继续 Domain Consumer/admission。AGENT 看到远端 `WAIT_NEW_ATTEMPT` 与本地已机械 READY 冲突，保留 stage/Outbox，由 Website 原 terminal CAS 对账并裁决唯一 result，禁止现役 `releaseAttemptForWebsiteDecision` 清空。在 Website 签新 accepted attempt 前，AGENT 原 Owner 必须以旧 fence 停止旧执行，在本地同一 task/Outbox 事务精确核不存在旧 READY/terminal intent 并保全候选/source manifest；Website 原 job 行锁复核旧 artifact/terminal/admission 与该 manifest，存在旧 READY 就不签新 attempt。新 accepted 一旦持久，旧 fence 的迟到写仍 409：之后找到的旧 attempt 字节只保留为历史候选/原 effect 读回线索，不能升为当前 READY 或用旧 fence terminal；现役 worker 继续新 attempt，按原 effect 零 submit 读回，必要时走 Website 风险 revision。不得冻结新 fence 等旧 attempt 交付；同 job 只能有一个 admission。

## 6. 单主链施工工单与验收

| 顺序/Owner | 必须施工的现役落点与动作 | 完成证据 |
|---|---|---|
| G1 双仓权威 | 按本轮已获授权原位替换 Website AI Acceptance 004/012/013、Commercial Order Management 008/009、Hehun 011、Localization 019、Public Knowledge 004/005 及 AGENT Runtime/architecture/GPT/Browser/startup 的命中法案、active Blueprint、冻结拓扑；AI Acceptance 001/002/003 只按真实依赖审查，不为本轮文字增版；将 attempt failure 降为证据而非 demand stop；Website 与 AGENT first failure 原值缺失/矛盾只诊断、保留双方证据，不能否决机械合格结果交付，将绝对 Provider once 精准解冻成默认去重 + Website 风险 revision。冻结旧合同版本结果交付、已接纳工单的 product_step_id/call_id 在受控切换中保持不变（当前不提供通用跨代码版本调用键映射）、原 WAL 受控迁移、V6 claim request/receipt 的最窄 `source_evidence[]` 两子型（普通 source handoff 与风险 replay proof）、原 job event manifest 与 `CloudExecutionGrantV6.delivery_priority_replay_grant` per-job 判别式授权（普通 grant 为 null、风险 grant 必填）；另在原 `TerminalCasV6` 增加可空 `terminal_source_first_fact` 证据字段，不能改变既有 `failure:null` 的完成语义。旧/new 两仓不得混版签 grant。 | registry/Blueprint/manifest 同候选，唯一 Owner/Outbox/WAL/quality verdict；未对齐不施工。 |
| W1 Website liveness | `job-expired-attempts.ts/job-lifecycle-core.ts/job-lifecycle-repository.ts::releaseFailedAttempt/job-claim-selection.ts/job-claim-observation.ts/job-claim-repository.ts`：普通 lease release/expiry 必须保留同 accepted attempt 已 stage 的 result/artifact receipt，精确新 fence 可交付原 hash；仅明确领域拒收或旧候选确证不可恢复且同事务签新 attempt 后才 orphan 旧 slot。普通失败/failure 缺失非法时不再写永久 `retry_not_before=null`，同 job 有限退避签新 attempt；stage/terminal/admission 优先，候选有限核验，经已鉴权 V6 claim `source_evidence[]` 取得旧证据并核 source 身份，manifest + 新 claim receipt 同行锁事务。风险 revision 只在同一已鉴权 V6 claim 的 `source_evidence[kind=delivery_priority_replay]` 验证后签，同 event/accepted 行读回，同 job 只一领域结果。已有失败历史但当前 `status=completed`、`terminal_status=completed` 且领域已接纳的 job 必须继续由原 selector 排除，历史 failure event 不得变成重新领取资格。 | 每个未完成 job 的 observation 与实际 claim 一致；grant 成功响应丢失后重启同一 issued attempt/revision/grant hash 可领；三条旧 fail-closed 都不再静默占槽；现场 100 条已完成且有失败历史的 job 在变更前后 claim、attempt、lease、result hash 与领域消费 hash 均不变化。 |
| A1 AGENT 接回 | `runtime-loops.ts/runtime-claim.ts/store-task-state.ts`：满 N 仍给原 job recovery/claim 机会；source handoff 前按原 task current_attempt_id + current_reason + staged_result_json is null 及旧来源 hash，以 per-job 串行与持久 CAS 封旧 completion 入口；Website 单独核旧 fence，晚到上传回执不得生成旧 READY；新 attempt 的 `source_evidence[]` 从原本地/Browser Owner 取 first fact/候选/Outbox/WAL 全集，经当前 session 送 Website；receipt 返回后与 Website event manifest 精确对账、CAS 换 current attempt，删现役无证据清空路径；Product 前先核旧结果和 Browser 全历史，普通失败不再靠 O14 shape 决定领取。Website grant→本地 accept 前崩溃由原 receipt + 原本地 store absence 安全接回。 | old first fact/候选不会因新 attempt 消失；无效授权零输入；崩溃重启不需用户再 Run。 |
| B1 Browser 原 WAL/lane | `browser-mutation-store.ts` 与公共 typed facade：启动前核原 WAL，跨 attempt/revision 全历史分零输入/已输入/未知；零输入容许当前新 hash 首次输入；已输入/未知只原 effect 读回或风险 revision。原表加可空 grant hash、同 revision/调用一次性 CAS；所有单值 reader 与 GPT preflight 精确选行。Browser Owner 在已鉴权 TARGET_CLAIM、给 Extension 发送 ack 之前，将 exact jobRefHash↔targetRef/tabId 记入同一个 Browser SQLite；该事实早于任何允许的命令。启动及每次新 Target mutation 前还须从原 v40 WAL 枚举未结算 targetRef，纳入同一全局门。release 仅在 Extension 当前 registry 与持久 claim 精确同一时按该 tabId 关闭，向 Chrome tabs/debugger 读回物理缺席；registry 丢失、v40 数字 tabId 或 tabId 复用时禁止猜删，改由已鉴权 Extension 等待旧 handler 与 CDP page action/read barrier 全部结束、旧 epoch/fence 失效，并在原 Browser SQLite 持久 typed quiescence proof。仅 socket 断开或空 registry 不算停稳。claim 前创建但未获 ack 的孤儿 Tab 没有命令授权，不算已发生 Provider 输入；Extension 自动回收其精确创建记录，未清理成功则保留诊断与重试。原答案有界读回仍不可得且旧 DISPATCHED 物理输入未决时，由原 Owner 证明旧 Target 物理缺席或旧 handler/CDP 输入静止、旧 fence 失效，再放同 job 新 attempt 或 sibling 的新 Target 页面 mutation；正常已确认轮询 Tab 仍按唯一 FIFO/lane 交错；`settleRetiredMutation` 不得只凭新旧 fence 将 DISPATCHED 结算后直接释放 lane。 | 新旧 Prompt hash、零输入普通 attempt、UNKNOWN 风险 replay、同 revision 风险 grant crash、缺 WAL、迟到 click、旧输入静止前同 job 新 attempt/sibling 新 Target 均零 mutation；旧 Target 物理缺席或 typed quiescence 持久后同 job 或 sibling 可继续并最终 admission；Extension registry 清空/debugger detach 不会被误报为物理缺席，也不按 v40 数字误删用户 Tab。 |
| G2 GPT/permit | `runtime-state.ts::leaseBudget`、`contracts.ts::ProductionExecutionLease`、`executor.ts`、GPT ExecutionInput/`production-child-tools.ts`、Browser atomic identity、`command-permit.ts`/MAC、command actor/extension admission：当前 revision+grant hash 与来源判别从 grant 到 Browser WAL 逐层贯穿并验签，任一层缺失零输入；Product 只在当前 revision 为真实领域 rejection 时消费 `prior_result_rejection`，风险 revision 不伪装成修正指令；普通新 attempt 在所有页面准备前读完整旧 effect，CONFIRMED/DISPATCHED 零 submit 读回；仅从原 `CloudExecutionGrantV6.delivery_priority_replay_grant` 取得的风险授权允许目标调用一次新输入。 | 多 WAL row 不 AMBIGUOUS，不误选旧 confirmed，permit 篡改/重复 revision/调用 grant 零新输入。 |
| H1 现役入口重启 | `launch-grasseye.mjs/workbench.ts/runtime-startup.ts`：AGENT 进程关闭/崩溃后按现役入口重新启动，先只读核原 Runtime SQLite 与 Browser WAL，防 Browser 自动建空库给假零事实；Website 已 grant 未 local accept 的 job 可接回。旧 stage 缺 terminal intent 先按 R2 在完整性门前定向修复；单 job 故障隔离危险 mutation 不拖死其它 job。`blockedRuntimeHandle` 不算 worker ready，活着的 Shell 有限退避串行重试，成功才启动唯一 workerLoop。无 Mac 开机自启范围。 | 关闭/kill 后仅按现役入口重启，同 job 自动领取、读回或交付；credential/session 暂错修复后同一 Shell 自动接回；无双 worker。 |
| R1 结果原子边界 | `executor.ts/context.complete`、`runtime-claim-operations.ts`、`cloud-client.ts::terminalProductionTask`、`store-task-state.ts/store-outbox.ts/store-ledger.ts`、`runtime-business-admission.ts`：上传 receipt 后、cleanup 前，在唯一完成端口同步构造 terminal intent，同 SQLite transaction stage+terminal intent；网络交付留事务外。pending first fact 原样保留至 terminal/admission 后按 Website receipt 退休，原值/hash 经 `TerminalCasV6.terminal_source_first_fact` 在同一 terminal CAS 入原 job 事件。admission 后先本地 completed/释放业务席位，再诊断性释放 Browser Target；Browser lane 安全门独立。按旧 result contract version 核机械事实，不让临时 GPT proof/cleanup 否决。 | complete 回调原子 stage/intent 后、cleanup 前 kill 不触发 ledger invalid；cleanup error 不写主失败且 admission 后业务席位已释放；first fact 从 stage 经 terminal wire 到 Website event 再到本地 completed 全程可读。 |
| R2 上传/terminal/admission 回收 | AGENT 原 Outbox、Website 原 artifact/terminal/Domain Consumer：新 session 受限 readback 原 artifact 与 `write_receipts`，恢复同一结果；terminal 未成立由 Website 同 attempt regrant 并以新 fence 送原 result，已成立只继续 consumer。坏候选有限读回耗尽先按 §4.1 持久 manifest 并签普通新 attempt，Browser 全历史若可能已输入且答案不可得才转 §4.3，旧 READY 必须在新 accepted 签发前由 source handoff/Website 行锁排除；新 accepted 后晚到旧字节仅作历史候选，不得拿旧 fence terminal，继续当前 attempt。 | 旧结果字节/身份/回执完整时，上传、stage、terminal、admission 各崩溃点均以原 hash 完成 Website admission/领域对象读回，Product/GPT 重跑为零；旧候选确证不可恢复时，先持久交接再在同 job 新 attempt 重获结果，只有 Website 风险 grant 可使已可能输入的 Provider effect 再提交，最终仍只一个领域 admission。 |
| Q1 双仓原生质检 | Website V6 Exam、AGENT Runtime/GPT/Browser acceptance 各走本仓唯一 `quality:check`：总性必须连到实际 claim；三条存量失败型、O12/O13/O14 坏/缺 fact、已证零输入新 hash、已输入/UNKNOWN 与 Website 风险 revision、Target 迟到 click 与同 job 新 attempt/sibling 在旧 Target 物理缺席或 typed quiescence 前均零新 Target mutation、v40 数字 tabId 复用不误删、claim ack 丢失自动清理、stage+first fact、跨 session、旧合同版本、满 N/限流、grant/accept 及 result/terminal 每个 crash 窗口，特别覆盖“旧上传中→source handoff 封口→Website 新 grant→旧 complete 晚到”零旧 stage/terminal 且当前 attempt 继续。原 selector 加回归：已有失败 event、但当前已 completed/admitted 的工单在观察、claim、recovery 三处都不产生新 attempt 或 Provider 输入；现场同一批 100 条只读前后对账。完成代码与治理门后按本轮授权读现场并走通用主链。 | 不能以 nextAction 非空/测试 PASS 冒充业务完成；动态验证故障→现役入口重启→同 job 自动执行→Website admission receipt/领域对象；100 条已完成历史失败单始终排除。 |

## 7. 顺序、删除审判与当前阻断

先 G1 法案/Blueprint/拓扑及双仓合同对齐，再冻结 cutover candidate；H1/B1/G2 与 W1/A1 同一受控候选施工，R1/R2 在开放 claim 前就绪，最后 Q1。切换停止旧版写入，但不得要求旧 session 下所有 accepted attempt 先完成：逐 job 在 Website 原行锁保全旧 attempt/session/fence/first fact/候选/Outbox/WAL 来源 manifest，旧 session supersede 后旧 receipt 不再授动作权；新 session 经 v43 同一 claim `source_evidence[]` 对账原 attempt 并取得当前 fence/交付权，不建立双版本兼容写入。claim gate 未开前各仓可回退；一旦新 attempt/revision 已签，旧控制语义不可回退解释它们，须保留同一身份证据并继续修新候选，不建 dual-run。READY/RELEASE 仍各用原生 clean commit、法案要求的 Dynamic Proof；设计、静态质检均不等于 Website 已拿到结果。

**删除/不新增：**O11–O14 和 `fail_closed` 不再拥有业务终止权；不建 O14 普通恢复 `recovery_resolution_json`，不建第二恢复状态机、queue、WAL、Outbox、结果 ledger、管理员 resume API、三条 job 专用捷径。保留 Website job/attempt/claim/event/receipt、AGENT 原 task/Outbox、Product Flow、GPT Child、Browser 原 WAL/lane、Website Domain Consumer。风险 grant 使用现有 result revision 作唯一递增身份，在原 Website claim/event 持久授权，并由原 Browser WAL 守住该 revision/调用的一次输入门；source manifest 的消费者是 Website claim、AGENT 本地换代与事后候选读回；旧 result contract verifier 的消费者是尚未交付的旧合法结果。删这些有消费者的结构会丢授权去重、旧 first fact/候选、或误否决旧结果。旧 Oxx/诊断 ID 若有真实消费者，按冻结 ID 规则逐项标 RETIRED，不用“图短”当删除依据。

**设计与施工边界：**本文件是本轮授权的施工方案。用户已明确批准双仓 active law、Blueprint、冻结拓扑、代码与质检迭代，并授权本轮解冻后重新冻结；必须先完成法案与施工图的两轮主 Codex 自审，再进入生产代码。§4.3 只有在双仓合同、代码与原生质检同一候选收敛后才能执行。三条生产工单没有因文档修改而运行或重试，不能宣称 Website 已拿结果。


## 2026-09-24 合同版本与现场阻断补充

现役 HEAD v42 的已签来源记录可含空 `readback_proofs: []`，但不具备本轮要求的逐 Provider effect 结构化读回证明；`attempt_handoff + possible` 的精确证明字段属于跨仓 wire 合同变化。当前施工目标改为 Website 唯一 provider spec/manifest 与 AGENT 唯一 dependency 同步 v43。上文 v41→v42 仅记录此前切换，不授权在 v42 身份下发送 v43 字段。无需新数据库表、字段或历史 migration 改写；v43 session open 撤销旧 session，原 job/attempt/first fact/Outbox/WAL 仍按原身份保留。

切换顺序：停止 v42 AGENT 外部动作及 claim，部署 Website v43，再部署 AGENT v43 并以同设备新 session 重新读取原 job 状态、写回执和来源证据，取得当前 claim 后继续；两端版本不一致期间明确失败关闭，不重投旧 claim request，也不把 v42 回执当作 v43 授权。恢复验收必须分别覆盖 7e/a923 的旧实例零提交读回与 09b 的 Website 精确 rejection 后新 revision，并读回 Website admission。母本 §43.3 对破坏性变更另要求兼容窗口和消费者迁移期限；用户要求禁止兼容桥、第二链路，本方案采用无双版本重叠切换，不能冒称该停机段本身是兼容窗口，治理裁决须在 RELEASE 前闭合。

本机只读盘点另发现 3 条原 `provider_cooldown` Outbox 均未送达，绑定同一 v42 `session_open_request_id`；其中一条已记 `AI_SESSION_BINDING_MISMATCH`。这三条与原事故 notice/body/receipt 身份不可改写，v43 不能把旧 session 误当成新 session 重放。RELEASE 前必须在旧 Website/AGENT 合同下按原 session 精确读回或结清；若旧 session 已关闭、被取代或原 lease 事实不可恢复，则保持 RELEASE 阻断，先就该事故作受控裁决。RELEASE 前须盘点全部旧版本未结清 lineage，包括未送 intent 与已送 incident/`not_cleared` 却无已送 `confirmed_absent` 的原 session/receipt；现场 3 条只是已证实例。该遗留事实不属于 v43 静态 CHANGE/READY 的生产恢复证据。

为覆盖 v43 投产后 AGENT 正常关闭或长时间崩溃的同类死结，在现役 session/cooldown Owner 内补同身份恢复：未结清的冷却事故包括已送达 incident 但尚无 `confirmed_absent` clearance；该状态下正常 shutdown 保留原 session。重启同 build/contract 只对尚未 closed/superseded、无更高 epoch 的 exact `open_request_id` 刷新短期 token，旧 token/attestation 立即失效，AGENT 承接原 `attestation_seq` 做新 heartbeat；Website 在 device 行锁内复核请求实际鉴权的 token generation，拒绝轮换后才入锁的旧进程 heartbeat/close；close 只认当前 generation，不能由旧进程迟到请求关掉已续用 session。heartbeat 远端提交但响应丢失时，AGENT 用同 open ID 重同步原 session/seq/token，再自动续发；验收须覆盖该时间窗。Website 非终结 lease release/expired-lease sweep 仅清 token/expiry 撤销动作权，保留原 session/epoch/fence 供原 cooldown intent 迟到交付及已接受 cohort 精确比对；来源交接只在 lease token/expiry 已清且历史 fence 无动作权时覆写该绑定。Runtime 每轮必须先按唯一 Outbox 插入顺序送完已有 incident/clearance 并核原回执，再做 Browser 恢复形成下一条 clearance，最后才领新任务；旧 `not_cleared` 发送失败不得越过它交付新 `confirmed_absent`；已确认 absent 的 clearance 若仅网络交付失败，保留原 `confirmed_absent` intent，不能在 catch 中追加 `not_cleared`。旧 Browser/Provider/结果 mutation 仍必须取得当前 lease，不能凭过期 fence 继续。closed、superseded 或跨 build/contract 旧 notice 仍须在切换前结清，不建第二事故链或兼容桥。验收覆盖正常 shutdown、已送 incident 仍 `not_cleared`、未发 notice 的超过 180 秒崩溃、lease expiry sweep、重启 fresh heartbeat、旧 clearance 发送失败后 Browser 本可形成新 clearance 的两轮顺序、原 notice 回执与后续同 job claim，证明 Provider 新输入增量为零直到 Website clearance。

## 2026-09-24 图片 checkpoint 与调用键发布边界

独立审计找到文章配图反例：Provider 图片提交已 CONFIRMED、原始媒体字节已进入 Forensics 时，旧实现没有 image settled checkpoint 记录，也只允许复用文本 checkpoint，导致全 settled 的文章无法取得 Website 的 `calls=[]` grant。先将 Forensics 001/002/003 精确升版：仍用唯一现役 appendArtifact/readArtifact，只为已完成图片回答把原始媒体 artifact 与一份内部最小身份描述 artifact 绑定；描述只含 assistant turn、媒体语义、Browser authority、原图 ref/hash 与 URL/user turn/marker 的 hash，不保存 URL、图片副本、恢复状态或第二账本。GPT 成功后两份均精确读回才记录 image settled checkpoint；Product 仍只见原图 ref。新 attempt 必须从原 WAL 核 URL/user turn，再核描述和原图并零提交返回旧媒体。原图写成而描述未写的崩溃窗口只允许同 effect Browser 零提交读回补全，不可伪造 settled。历史旧 image 无描述且旧 Browser 不可读的生产库存必须在 RELEASE 前按原身份盘点、走现役有界取证与 Website 风险授权，不得把原图字节单独当作完整身份。

当前零提交复用按精确 `product_step_id + call_id + child` 索引旧 effect。受控 v43 切换期间，已接纳未完成 job 对应的 Product 调用键必须保持稳定；更改 Prompt 或结果组装可以沿原键收敛，调用键改名或拆并不在本候选已证覆盖范围内；当前 GPT 对零提交来源 grant 或尚未结清的风险 grant 中未匹配的新调用，在 Product 页面准备前失败关闭，旧调用 checkpoint 结清后才允许继续真正的新调用。未来若要改变调用键，必须先证明原 effect 的单一映射及历史 job 自动恢复，不得把本方案未实现的“跨代码版本 step/call 映射”计为 PASS。

## 2026-09-24 现场追加：旧 rejection 后新 attempt 的 Target 故障

04:14 的 7e726…/a923… 已由 Website 同 job、同原 attempt 接纳并写入 zh-TW `localization_static_current`，Browser 各只有一条 CONFIRMED submit；这证明旧实例丢失可恢复，不替代本轮候选的 READY。09b68… 的原 revision 结果已被 Website 拒收、原 source handoff 签出新 revision；新 attempt 仅发生 target-local REJECTED/no，未有 Provider 输入，却被 `prepareSourceHandoffs` 的 job-wide `readJobPhysicalInputState` 错认成当前 possible，导致 `SOURCE_HANDOFF_RECONCILIATION_PENDING`。

本轮只读核本地现役 SQLite：09b 的已接纳祖先 `2d717…→a267…` 是旧 `attempt_handoff+possible`、唯一 replay call、零 readback proof、first failure `RESULT_SETTLED_UNUSABLE`，原 seal 有效但没有本轮新增的 `rejected_call` 字段。不得改写旧 seal。v43 新 claim 始终严格要求完整字段；读取这份旧祖先时，仅从原 first failure effect/ref/hash、Browser WAL 对应调用与前缀集合 hash、Website 原 handoff event/issued attempt、failure ledger 与精确 rejection receipt 全部一致，才只读解释为该唯一旧调用已拒。其它缺字段/多调用/身份不一致保持失败关闭并有限自动对账，旧 session 与旧 claim 无动作权。

施工裁决：Browser 原 Owner 公开当前 attempt 的零/可能/未知输入事实，Runtime 仍核全历史及当前旧 Target/Outbox；若当前 attempt 零输入而旧 revision 有输入，必须核旧输入所属的 Website rejection 与签出当前 attempt 的原 source handoff/event。Website 在原 job 行锁核同一签发事件和当前 attempt，才按同 revision 换 attempt。旧结果可恢复时仍优先交付。历史 effect 观察使用形成时稳定的前缀 hash，当前逐调用证明使用全体 effect 集合 hash；`runtime-claim` 的旧 Target 同 attempt 只读例外仅挑当前 attempt/revision 的 CONFIRMED effect，旧 revision 由原 Website rejection/来源交接覆盖，不得因跨 revision 重复调用键拒绝合法读回。无额外表、队列、兼容桥或恢复状态；两仓原生 CHANGE、主 Codex 两轮自检、独立只读审计、READY 重新验收。按用户裁决停在 RELEASE 前，母本 §43.3 保持原文。

独立只读审计补充：风险 revision 的 `delivery_priority_replay_grant` 绑定其 issued attempt，不可因为当前 target-local/no 就复制到新 attempt。当前 attempt Provider 输入确证为零时，Website 原 `ACTIVE_ATTEMPT` 同 attempt 重授保留原 grant；Browser 结算旧 Target，Runtime 在新 fence/Target 重做 target-local 准备，仍仅允许原指定调用一次风险输入。当前 revision Provider 已输入时只能原 effect 零提交读回；此前风险 source seal 的每个历史 effect 必须在旧 Target 恢复路径中逐项核对。无需新事件、版本、表或第二恢复链。

## 2026-09-26｜R15：当前八问题统一闭环施工裁决

### R15.0 候选、SKILL 与唯一方案身份

本轮不是新建第五份恢复方案，而是原位升级本文件。原因是八个问题最终都落在同一条现役主链：

~~~text
Website 有效 demand
→ Website claim / attempt authority
→ AGENT Runtime / source handoff
→ Product / GPT / Browser
→ exact result
→ Runtime Outbox / terminal
→ Website business admission
→ Domain current truth / object readback
~~~

固定文案方案、GPT DOM 方案、current_reason 方案、Target 方案继续作为各自 Owner 的前轮不变量与精确子工单依据；它们不得再建立第二恢复 Owner、第二状态机或第二总 verdict。

当前重新绑定的云仓基线：

- AGENT main = 4b2e863f717264522be98b00bf47bbd1397580fb；recursive tree truncated=false，1182 entries / 918 files。
- Website main = 642f631dcfa406d0e1d577e36cdd4c1c3a8f20d8；recursive tree truncated=false，7412 entries / 6390 files。
- Website 的 Demand liveness W1/W2/W3 已完成现役加固；AGENT workerLoop A1 已收窄为 control-flow negative guard。三项不再作为当前缺口重复施工。
- 本轮已对闭环 SKILL 完整深读两遍。采用深度设计模式：先业务终点、再第一直接断裂、再 Owner、消费者、删除反事实、有限分母、原生质检和真实业务读回。

本轮预算：

~~~text
新数据库表 = 0
新持久字段 = 0
新业务状态 = 0
新 queue = 0
新 manager / coordinator = 0
新 recovery Owner = 0
第二 WAL / Outbox / ledger = 0
dual-read / dual-write / compatibility bridge = 0
replacement job 作为技术恢复 = 0
Website 业务 next_action 新枚举 = 0
Provider 额外 submit 资格 = 0
~~~

允许新增的只有纯诊断代码或现有错误码语义收窄；不能新增任何会改变业务资格的持久真相。

### R15.1 八项问题重新裁决

| # | 当前裁决 | 第一直接断裂 | 唯一 Owner | 本轮动作 |
|---|---|---|---|---|
| 1 | P0 已实证 | localization_static_catalog 已写 completed/business_consumed，但唯一 current catalog 未写，ensure 随即命中 LOCALIZATION_STATIC_COMPLETED_TASK_STILL_PENDING | Website Localization + Website business consumer | W-L10，修成同事务真原子闭环 |
| 2 | P0 已实证 | Website 对 fail_closed accepted attempt 在没有 source evidence 时仍重授 lease；AGENT reconcileClaimAttemptFailure 只能立即抛 PRODUCTION_SOURCE_HANDOFF_REQUIRED | Website ai-acceptance + AGENT Runtime | W-SH10，删除无意义 lease 循环 |
| 3 | P0 可观测性缺口 | runtime-source-handoff 多个不同 proof 缺口全部 return null，最终只剩一个总错误 | AGENT Runtime | A-SH11，仅增加 ephemeral typed diagnostic projection，不增加状态 |
| 4 | P0 结构性风险 | device-status 404 同时表达“真实不存在”和“当前设备不可见”，AGENT 却把它直接当 purge 权威 | Website ai-acceptance / AGENT Runtime | W-A2/A-A2，拆开语义并只保留 exact absence 可 purge |
| 5 | P1 假门 | WorkerObservation 把 WAIT_NEW_ATTEMPT + next_action_at=null 判非法，而 Website null 表示当前无时间阻断 | AGENT Runtime observation | A-O1，纯删除 |
| 6 | P1 未闭合生产路径 | 历史 fresh submit 曾 12/12 candidate missing；当前 Browser 已具 stage typed cause，但当前 selector / write 页面事实尚未以新生产证据完成裁决 | GPT + Browser | G-P0，诊断优先、有限判别后单点修改；禁止猜修 |
| 7 | 非独立故障 | BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT 在 bound-observation 上本来就应 fail-close；同一 job 后续已取得 business admission | Browser | T-NOOP，不改生产语义，只做“不升级成 demand stop”回归 |
| 8 | P2 防复活缺口 | current_reason 已从控制链去权威，但其 diagnostic-only 语义尚未有 Target 同等级的窄 pin | AGENT Runtime quality | A-C1，只 pin 现有一句语义 + 现有 AST denominator，不改法案正文 |

最终业务终点统一为：

~~~text
同一有效 job
+ exact Product result
+ Runtime 原 Outbox / terminal
+ Website business admission receipt
+ Domain current truth / object readback
= completed
~~~

任何 source-handoff、Target、current_reason、Browser failure、观察错误或 cleanup 都不能替代这一终点。

---

### R15.2 W-L10：修复 fixed localization “completed 但仍 pending”

#### 第一直接断裂

现役 business-result-consumer 的 static 分支在同一事务中先调用 finalizeConsumptionWithClient，把 ai_production_job_runtime 写成：

~~~text
status = completed
business_consumed_at != null
business_consumption_hash != null
~~~

随后才调用 writeStaticCatalogAdmission。

writeStaticCatalogAdmission 对两类 current snapshot 漂移目前直接 return：

1. 当前 source_version / source_sha256 / policy_version 与冻结 input 不一致；
2. 当前 expression / terminology / format policy hash 与冻结 context 不一致。

因为 return 不是异常，事务会提交“business consumed”，但 localization_static_current 没有对应 current entry。下一轮 staticPendingIds 仍返回原 pending 集合，existingTask 又读到同 task 已 completed + consumed，于是精确抛出 LOCALIZATION_STATIC_COMPLETED_TASK_STILL_PENDING。

这就是本轮现场新故障的完整代码闭环。不是 AGENT 生成失败，也不是 claim/capacity 问题。

#### 唯一修改

文件：
- services/api/src/localization/localization-static-catalog-consumer.ts
- tests/localization/static-catalog-transaction-boundary.test.ts
- 现役 localization 原生动态/静态验收文件

只改一件事：

~~~text
writeStaticCatalogAdmission 的两处 silent return
→ 同一个 typed failure：
LOCALIZATION_STATIC_CURRENT_SNAPSHOT_CHANGED
~~~

不调整 finalizeConsumptionWithClient 与 writeStaticCatalogAdmission 的顺序，不新增“pending current write”状态，不新增补偿事务。

理由：两者已经在同一个 PostgreSQL 事务。后一步抛错即可让前面的 completed/business_consumed 更新原子 rollback。外层现役 recordConsumptionFailure 会继续让同一 job 保持未消费，写有限 retry_not_before，再由同一 consumer 自动检查。这样没有第二事务、第二队列、第二完成模型。

#### 删除反事实

- 删除 silent return：正确。它当前唯一效果是让 completed 与 current truth 分叉。
- 删除 current source/policy guard：错误。会把旧冻结结果激活成当前译文。
- 把 current catalog 写移到事务外：错误。会制造真正的双写窗口。
- 新增 current_write_pending 字段/状态：错误。现有事务已经能表达原子成功/失败。
- 直接把 LOCALIZATION_STATIC_COMPLETED_TASK_STILL_PENDING 改成忽略：错误。只隐藏已完成与业务真相分叉。

#### 验收

必须动态证明三组：

1. 正常 current snapshot：
   result consumer 同事务写 current entry + business_consumption_hash + status=completed，随后 staticPendingIds 不再包含已通过 ID。
2. 在 prepare 后、commit 前制造 source identity 漂移：
   transaction rollback；job 仍 status=failed、business_consumed_at=null；current catalog 不变；有限 retry 存在。
3. 制造 policy hash 漂移：
   同 2；绝不出现 completed + pending。

现有 static-catalog-transaction-boundary 必须继续证明 finalize 与 current write 在同一事务，且新增反例必须让 silent return 复活时 FAIL。

---

### R15.3 W-SH10：删除 fail_closed accepted attempt 的无意义 lease 循环

#### 第一直接断裂

现场两张旧 job 每次能被 Website LEASE_GRANTED，但 AGENT 在约 0.3 秒内以 PRODUCTION_SOURCE_HANDOFF_REQUIRED 结束。

代码对应关系是精确的：

- Website failClosedAttempt 保留原 accepted attempt，只清 lease、写有限 retry；
- Website selectV6ClaimableJobs 目前只验证 attempt_id / accepted_at 成对，没有用 failure disposition 判断这个 accepted attempt 是否真的能再次执行；
- Website 因此在 source_evidence 尚未形成时仍把 fail_closed accepted row 重授同 attempt；
- AGENT reconcileClaimAttemptFailure 对同一 remote ACTIVE_ATTEMPT 重新 classify；
- disposition=fail_closed 时唯一合法行为就是抛 PRODUCTION_SOURCE_HANDOFF_REQUIRED。

所以这不是“source-handoff 太严格”，而是 Website 在 proof 尚未形成时发了一张 AGENT 不可能消费的执行 lease。

#### 唯一修改

Website services/api/src/ai-production/job-claim-selection.ts：

复用唯一 classifier job-lifecycle-core.ts::classifyAttemptFailure，不建第二矩阵。

v6RecoveryCandidateAllowed 增加一个现有请求事实：本次 source_evidence 是否包含 exact job。

规则固定为：

~~~text
fresh job pair 合法 → 现役逻辑
staged_result_json != null → 允许 delivery
accepted attempt + attempt_failure == null → 允许原 attempt 对账
accepted attempt + same_attempt_provider_readback → 允许原 effect readback
accepted attempt + fail_closed + exact source_evidence absent → 不授 lease
accepted attempt + fail_closed + exact source_evidence present → 允许进入 grantJob，由现役 verifySourceHandoff 决定 replacement
其它现役 disposition 保持当前语义，不借本工单重写风险 grant / result revision
~~~

只针对已经实证的 fail_closed 死循环，不扩大到没有现场证据的其它分类。

AGENT workerIteration 已在 claim 前调用 prepareSourceHandoffs，所以被 Website 暂不重授并不会停止本机来源证明形成；proof 成立后，同一轮 claim request 自然带 exact source_evidence，Website 才签安全 replacement。

#### 删除反事实

- 删除 fail_closed 安全 proof：错误。
- 让 AGENT 收到 lease 后“硬着头皮 Product”：错误，会绕 source seal。
- 新增 SOURCE_HANDOFF 状态：错误，现有 attempt_failure + typed seal + source_evidence 已足够。
- 给 fail_closed 加 attempt 数熔断：违法 FROZEN-WEBSITE-RESULT-DEMAND-001。
- 创建 replacement job：错误，必须同 job。

#### 验收

- accepted fail_closed + 无 source evidence：Website claim 不返回该 job 的执行 lease。
- 同 job 其它可执行/新 job 不被它占死。
- AGENT 本地 source proof 后形成 exact seal；下一 claim 带 source evidence；Website 在原 job 行锁验证并签 replacement attempt。
- 新 attempt 获得当前 Target/Document，最终走真实 Product → result → admission。
- attempt count 只继续影响 finite backoff，不形成 stop。

---

### R15.4 A-SH11：把 source-handoff silent null 变成一个诊断字段，而不是新状态机

runtime-source-handoff.ts 的所有安全门保留。问题是它们现在都投影成 null，现场无法知道是哪一项未闭合。

本轮仅把现有函数内部返回值重构成 ephemeral result：

~~~text
ready: SourceEvidence
或
blocked: 单一 SourceHandoffBlockReason
~~~

SourceHandoffBlockReason 不是持久 schema，不出跨仓合同，不进 DB enum。只存在函数调用期。

有限原因集合必须一一对应现有 gates，不得凭想象增加：

- OUTBOX_CANDIDATE_PRESENT
- INHERITED_PAYLOAD_CONFLICT_PENDING
- HISTORICAL_INPUT_UNSETTLED
- REJECTED_EFFECT_MISMATCH
- HISTORY_READBACK_UNAVAILABLE
- CHECKPOINT_ARTIFACT_UNAVAILABLE
- WAL_HISTORY_UNVERIFIED
- INPUT_NOT_QUIESCENT
- READBACK_PROOFS_INCOMPLETE
- HANDOFF_PROOF_INELIGIBLE
- REJECTED_RESULT_FIRST_FACT_MISSING

prepareSourceHandoffs 只把一个诊断值投影到现有 current_reason：

~~~text
SOURCE_HANDOFF_PENDING|<reason>
~~~

或者 Runtime Log 的现有诊断字段。不得新增列、事件类型或 Website 资格字段。

current_reason 仍不能参与任何 if / SQL WHERE / CAS；seal 是否形成只由原 typed proof 决定。

当 seal 成功后，诊断自然被后续 LEASE_GRANTED / EXECUTING 等现役诊断覆盖，不新增 clear API。

500 行红线：runtime-source-handoff.ts 当前约 283 行，可原位承载；不得把诊断实现推到接近 500 行的 dom-coherent-candidate.ts / dom-pointer-intent-runtime.ts。

验收必须把每个现役 null gate 逐一做 mutant，证明：
- proof 不足时绝不 seal；
- 诊断 reason 精确；
- 只改 reason 不改变 seal、claim、capacity、stage 或 Provider submit；
- proof 补齐后无需手工 Run，同一 job 自动形成 seal。

---

### R15.5 W-A2 / A-A2：只有 exact Website absence 才允许 purge

#### 当前错误

device-status SQL 把 device visibility 放进 WHERE。查不到 row 时统一抛 AI_V6_DEVICE_JOB_NOT_FOUND，语义为“job 不存在 OR 当前 device/session 不可见”。

AGENT websiteJobAbsent 又把该码与 AI_V6_JOB_NOT_FOUND、AI_PRODUCTION_JOB_NOT_FOUND 并列为物理清算权威。

因此一个仍真实存在的 Website job，只要设备可见性变化，就存在被 AGENT 当成永久不存在并 purge Browser/Forensics/local task/store 的风险。

#### Website 最小修复：不新增错误码

文件：services/api/src/ai-production/job-device-status-repository.ts

把 exact job existence 与 device visibility 在同一个 SQL read 中分开：

1. 按 job_id + V6 protocol 读 exact job，不再用 visibility 条件把 row 直接过滤掉；
2. 在 SELECT 中计算一个仅调用期使用的 visible_to_device boolean；
3. row 真不存在：抛现有 AI_V6_JOB_NOT_FOUND；
4. row 存在但 visible_to_device=false：继续使用现有 AI_V6_DEVICE_JOB_NOT_FOUND，但语义收窄为“job exists but is not visible to this device session”；
5. visible=true：正常投影 device status。

不新增 DB 字段，不新增跨仓 wire 字段，不新建查询 endpoint。

#### AGENT 最小修复

runtime-business-admission.ts::websiteJobAbsent 删除：

~~~text
AI_V6_DEVICE_JOB_NOT_FOUND
~~~

永久清算只认现役 exact absence code：

- AI_V6_JOB_NOT_FOUND
- AI_PRODUCTION_JOB_NOT_FOUND（仅它的原 service exact job lookup 来源）

滚动顺序必须先部署 AGENT 的“少删”语义，再部署 Website 的 exact/not-visible 分离。中间窗口最多遗留本地垃圾，绝不能误删有效 demand。

#### 验收

- job 存在但 wrong device/session：device-status 返回 DEVICE_JOB_NOT_FOUND；AGENT 不 abort、不 release、不 purge，本地 evidence 全保留。
- exact job 已由 Website 授权删除：device-status 返回 AI_V6_JOB_NOT_FOUND；AGENT 先 release current live Target，再 purge Browser job、Forensics、task dir、Runtime row，并读回全零。
- transport 5xx、无效 JSON、session 错误：永不 purge。
- business admitted job 的正常 cleanup 不进入 websiteJobAbsent。

修后在现役 ai-acceptance / agent-production-runtime acceptance 中冻结一句机械事实：只有 exact Website absence 才能授权 local purge；不新建第二法案。

---

### R15.6 A-O1：物理删除 Worker Observation 的 null 假门

文件：src/lib/local-runtime/production/worker-observation-client.ts

直接删除：

~~~text
WAIT_NEW_ATTEMPT && next_action_at === null
→ V6_OBSERVED_JOB_TTL_INVALID
~~~

同时反转 agent-route-contract.acceptance 中对应必须 throw 的断言。

理由：

- Website worker observation 合同允许 next_action_at 为 string 或 null；
- claim SQL 已以 retry_not_before is null or <= now() 表示当前没有时间阻断；
- Operations Snapshot 只读观察不能凭 null 再创造第四套 eligibility 语义。

不新增默认时间，不把 null 改成 9999 年时间，不在 AGENT 推导 Website 下一动作。

验收：
- WAIT_NEW_ATTEMPT + null 可解析；
- 有非法 timestamp 仍失败；
- observation 的变化不能直接触发 Product/Provider 输入；
- Website claim 仍是唯一执行授权。

---

### R15.7 G-P0：fresh GPT submit 用现有 stage 证据闭环，禁止猜 selector

当前生产代码已经具备 Browser candidate-missing stage 的 typed native cause；历史 12/12 submit failure 发生时 WAL native cause 为空，不能再用旧窗口猜今天页面。

因此本轮不直接改 GPT_SEND_SELECTOR。

#### G-P0-1：当前代码动态证明

用现役 fresh chat 路径至少覆盖：
- 无附件；
- 有附件；
- 已选中目标模型的路径。

必须读 Browser WAL 的 exact submit mutation：

~~~text
CONFIRMED
或
REJECTED + BROWSER_DOM_CANDIDATE_MISSING + 非空 stage + physical_input_count=0
~~~

若当前三类均 CONFIRMED，本历史问题关闭，不改 selector。

若再次 MISSING，当前 stage 已经成为唯一判别入口：

- BROWSER_DOM_SCOPE_ABSENT / SCOPE_INELIGIBLE：修当前 page/context prep；
- BROWSER_DOM_SELECTOR_ABSENT：只读采集 write 完成、未点击时 form 内 button 机械事实；
- BROWSER_DOM_CANDIDATE_INELIGIBLE：只修 Browser 指出的机械资格事实；
- disabled/aria-disabled：继续由现役 FROZEN-GPT-SUBMIT-ACTIONABILITY-WAIT-001 的 5 秒 bounded wait 负责，不扩 retry。

#### G-P0-2：只有 SELECTOR_ABSENT 才允许换 selector

若实证 selector 不符：
- 只在 submit_exact_gpt_turn_once/selectors.ts 原位替换一个 GPT_SEND_SELECTOR；
- 必须是现场证明的唯一稳定 locator；
- 删除旧 selector，不叠 fallback、不建 selector registry、不 dual-read；
- 优先 locale-independent structural/testid fact；
- 不把按钮标签升级成业务前置。

如果现场表明写入目标导致“页面仍认为 composer 为空”，则只修 write_exact_gpt_prompt 的唯一写入目标/后置，不碰 submit。

现役 FROZEN-GPT-SUBMIT-TWO-PRECONDITIONS-001、exact attachments、exact prompt、WAL once、Provider effect identity 全部保留。

结构红线：
- dom-coherent-candidate.ts 当前约 487 行；
- dom-pointer-intent-runtime.ts 当前约 475 行；
- browser-mutation-receipt.ts 当前约 434 行。
除非现役 stage 传播出现真实缺口，否则本工单不向前两文件新增实现。若必须修改，要求净行数不增，先原位收敛重复代码。

---

### R15.8 T-NOOP：Target physically absent 不再作为问题施工

新日志中 business result 已成功，而后出现 BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT，随后 Website admission readback 仍成功。

这与已冻结 TARGET-AUTHORITY-BOUNDARY-001 一致：

- bound-observation 的当前 Target 不存在必须 fail-close；
- 不得因此创建替代 Tab；
- Target 缺席不能决定 attempt、revision、永久停止或 completed。

所以本轮生产修改 = 0。

只补或复用回归证明：

~~~text
已有 READY / Website admission
+ cleanup 或 bound observation 报 Target physically absent
→ completed/admission 不回退
→ Provider submit 增量 0
→ 不生成新 attempt / revision
~~~

不得为了“日志看起来 BLOCKING”去弱化 Browser fail-close。

---

### R15.9 A-C1：current_reason diagnostic-only 做窄冻结，不冻结整条 Runtime law

现役 LAW-AGENT-PRODUCTION-RUNTIME-001-V73 已含精确句：

~~~text
current_reason 仅是可变诊断投影，不得参与授权、CAS、恢复、容量、stage、Provider submit、删除或完成决定
~~~

现役 contract-inspection 已有 current-reason-diagnostic-only AST denominator 和 mutants。

本轮不修改法案正文，也不对包含大量 source-handoff 语义的整个长 forbidden clause 做 whole-clause hash，因为那会把正常恢复迭代一起冻死。

只在 agent-production-runtime 现役 quality 中增加“语义片段 pin”：

- active owner law family 必须为 LAW-AGENT-PRODUCTION-RUNTIME-001-V*；
- capabilityDomain 必须 agent-production-runtime；
- 上述精确句必须只出现一次；
- 对精确句字节做 SHA-256 pin：
  de816be2d6c039a7eb033d23e53bf77638d176d98a5d1a197b6aeecda6f9c31e
- relocation / 删除 / 将“不得”弱化 / 复制第二份均 mutant FAIL；
- 继续保留现有 AST 规则：current_reason 不得进入 authority branch、SQL gate 或非诊断 resolver consumer。

这冻结的是权力，不是 current_reason 字段，也不冻结整份 Runtime law。

---

### R15.10 法案与施工图变更裁决

本轮原则是“已有法条足够时不升版”。

#### 不需要修改正文的现役权威

- Website FROZEN-WEBSITE-RESULT-DEMAND-001：已经覆盖未完成 demand 不得被技术事实终止。
- Website unfinished_delivery_liveness 7-key + 3 next action：保持。
- AGENT TARGET-AUTHORITY-BOUNDARY-001：保持。
- AGENT Runtime current_reason diagnostic-only 原句：保持，只加质检 pin。
- GPT submit two-preconditions：保持。
- Website Localization 现役 Blueprint 已要求合格字段与 business_consumption_hash 同事务写入唯一当前表：W-L10 是实现回归，不需要新法案。

#### 只允许同步文义的地方

本唯一总方案 R15 是施工入口。对应已有子方案只记录“由 R15 接管当前事故”的前向指针时，不得复制实现步骤；若无需文义修改则不动。

禁止为本轮创建：
- source-handoff law v2；
- purge law v2；
- localization completion manager；
- recovery matrix v2。

---

### R15.11 有限状态与失败分支

本轮不新增业务状态。仍只有现役事实投影：

~~~text
Demand active
  ├─ exact result/current admission 已有 → 继续交付/读回
  ├─ accepted attempt 可安全原位读回 → same attempt
  ├─ source handoff proof 未齐 → 本地有限检查，不授无意义 execution lease
  ├─ source handoff seal 已齐 → Website 原 job 签 replacement attempt
  ├─ current Product execution → Result
  └─ Website 明确持久终止 → demand 结束
~~~

Localization 的事务状态也不新增：

~~~text
current snapshot 一致
→ current table + business consumed 同事务 commit

current snapshot 不一致
→ 整事务 rollback
→ 原 job 仍未消费
→ finite retry / Owner 修复
~~~

Purge：

~~~text
exact Website absence
→ local purge

job exists but device invisible
→ 保留 local facts，零 purge
~~~

没有“可能有第四种状态”。

---

### R15.12 原子施工工单与顺序

必须按下面顺序，不并发写同一恢复主链：

#### WO-0：候选重绑
- 再读两仓 HEAD、dirty、law registry、相关 Blueprint；
- 若本节列出的目标文件发生并行语义漂移，先更新本节，不猜施工。

#### WO-1：Website localization 原子完成
- W-L10；
- 先跑 localization 定向 test + DB transaction regression；
- 证明 false completed 清零。

#### WO-2：source-handoff liveness
- Website W-SH10 先删除无 proof 的 fail_closed lease；
- AGENT A-SH11 再加纯诊断；
- 先用 fixture 证明“无 seal 零 lease，有 seal 才 replacement”。
- 不在本工单碰 Browser/GPT selector。

#### WO-3：exact absence / purge
- 先 AGENT 删除 DEVICE_JOB_NOT_FOUND 的 purge 权；
- 再 Website 把 exact absence 与 device invisibility 用现有两个 code 分开；
- 最后跑 destructive-cleanup fixture。
- 顺序不可反转。

#### WO-4：observation 假门
- 删除 WAIT_NEW_ATTEMPT + null guard；
- 反转原 acceptance。
- 不修改 Website next-action contract。

#### WO-5：current_reason 窄冻结
- 只改现役 quality/acceptance；
- 生产代码 0；
- 不改 Runtime law 文本。

#### WO-6：GPT fresh-submit 动态闭环
- 先跑现役 fresh submit；
- 只有当前 failure 才进入 G-P0-2 的唯一分支。
- 禁止先猜 selector。

#### WO-7：整链动态验收
至少跑以下场景：
1. localization result 正常 admission → current catalog 非 pending；
2. localization current snapshot 漂移 → 不允许 false completed；
3. fail_closed old job 无 seal → 零执行 lease；seal 后同 job 自动 replacement → result → admission；
4. device invisible → 零 purge；
5. exact Website deleted → exact purge；
6. WAIT_NEW_ATTEMPT + null observation 可读；
7. fresh GPT submit 至少一条真实 CONFIRMED；
8. business admitted 后 Target absent/cleanup failure 不回退 completed；
9. 仅修改 current_reason 诊断文本，claim/source seal/capacity/stage/purge/completed 全不变。

最终必须读回 Website Domain admission / current object，不得用测试 PASS、HTTP 200 或 AGENT job.execute succeeded 代替。

---

### R15.13 质检路由

AGENT：
- agent-production-runtime：source handoff、purge、observation、current_reason；
- local-browser-session：只有 G-P0 当前证据证明 Browser stage 传播仍缺口时才进入；
- gpt：fresh submit / selector 或 write exact 修复；
- architecture-boundary：Target freeze 不得回退；
- 原生 npm run quality:check CHANGE → READY。

Website：
- localization：W-L10；
- ai-acceptance：W-SH10、exact absence、liveness freeze；
- tests/exam/ai-production-v6-contract.test.ts 保持 anti-demand-stop denominator；
- 原生 pnpm quality:check CHANGE → READY。

不得创建跨仓总 quality verdict。

当前 GitHub commit status / workflow run 不能替代本地原生 quality evidence；施工时必须保存实际命令结果。

---

### R15.14 删除清单

本轮施工必须实际减少以下错误权力：

1. localization-static-catalog-consumer 的两处 silent return；
2. Website 对 fail_closed accepted attempt 在 source evidence 缺席时的 execution lease 资格；
3. AGENT websiteJobAbsent 对 AI_V6_DEVICE_JOB_NOT_FOUND 的 purge 权；
4. WorkerObservation 的 WAIT_NEW_ATTEMPT + null 假门；
5. 任何试图让 source-handoff block reason 参与业务判断的代码；
6. current_reason 重新成为控制分支的未来空间，由 pin + AST mutant 封死。

明确不删：

- source handoff WAL/history/readback/quiescence/checkpoint proof；
- current_reason 字段与诊断写；
- Target/current Document/fence/permit；
- Browser candidate missing zero-input fail-close；
- exact prompt / attachment / submit two-preconditions；
- Provider effect WAL；
- Website business admission；
- 历史 migration / reject-only old-field literals。

---

### R15.15 施工停止条件

出现任一项立即停止，不准用“加一层兼容”继续：

- 为 localization false completed 新增第二事务补偿队列；
- 为 source-handoff 新增状态列、manager 或人工 resume API；
- 为两张旧 job 写 job-id 特判；
- 让 Website fail_closed 继续发 AGENT 无法消费的 lease；
- device invisibility 仍能走 purge；
- 用 next_action_at 默认远未来时间掩盖 null；
- GPT 当前现场证据未取得就直接换 selector；
- 给 GPT_SEND_SELECTOR 叠第二 selector/fallback；
- 放宽 Target/Brower/WAL 安全门以追求通过；
- current_reason 进入任何业务 branch；
- 任何改动造成 replacement job 代替原有效 demand；
- 任何“失败次数 / wall clock”成为 permanent stop。

### R15.16 最终裁决

本轮八项问题不是八个恢复系统。

真正需要施工的是六处现役边界：

~~~text
Website Localization transaction truth
Website fail_closed claim eligibility
AGENT source-handoff diagnostic projection
Website exact absence ↔ AGENT purge authority
AGENT observation false gate
GPT fresh submit 当前事实
~~~

另外两项只需要治理收口：

~~~text
Target physically absent：保持现役 fail-close，不升级为 demand stop
current_reason：保持诊断字段，只把 diagnostic-only 权力边界窄冻结
~~~

完成 R15 后，系统必须满足：

> Website 只要 demand 还在，任何局部失败都只能决定“现在这一步不能做”；它不能让 job 消失、假完成、无意义反复领同一不可执行 lease，或要求用户重新 Run。最终只有真实 Result → Website business admission → Domain current truth 才结束义务。

## 2026-09-26｜八项未闭合问题统一收敛增量（闭环实现设计 SKILL 两遍复核）

### 8A. 本轮候选、唯一方案与边界

本轮重新绑定的云仓基线：

- AGENT main=`4b2e863f717264522be98b00bf47bbd1397580fb`，recursive tree `truncated=false`，1182 entries / 918 files。
- Website main=`642f631dcfa406d0e1d577e36cdd4c1c3a8f20d8`，recursive tree `truncated=false`，7412 entries / 6390 files。
- 已重新遍历两仓现役法案、Blueprint/项目方案、生产代码、audit/acceptance/exam 四带，并重读 Website 根目录《玄学网站迭代分析记录.md》。
- 已对上传的《闭环实现设计-SKILL》做两遍完整复核。本轮遵循：同一 GAP 只保留一个施工方案、第一直接断裂优先、一个原子责任一个 Owner、删除反事实优先、禁止第二状态机/第二队列/第二恢复链/dual-read/dual-write/fallback。
- **唯一方案继续使用本文件。** Website《固定文案本地化闭环修复-完整实现方案.md》、AGENT《current_reason诊断投影与状态权威分离-完整实现方案.md》、AGENT《GPT新聊天强制聊天模式-完整实现方案.md》、AGENT《Target系统地位与强制边界-完整实现方案.md》只作为各自 Owner 的既有不变量和子工单依据，不复制第二套 Demand 恢复主链。

本轮用户红线保持不变：Website 已签有效 JOB，只要没有 Website 持久取消、删除或撤权，且尚未取得当前结果的领域 admission receipt，AGENT 的结果义务持续存在。任何 Browser/GPT/Runtime/source-handoff/Target/current_reason/lease/session/capacity/cooldown/error 只可关闭当前危险动作，不得成为 demand stop。

### 8B. 当前事实：不是全链挂死，而是四个生产断裂 + 四个边界/诊断缺口

现场已经证明 Website 启动、PostgreSQL、session/heartbeat/claim/renew、Result upload、terminal 和 Domain consume 主链可工作；至少 `aiprod_8ef8…` 与 `aiprod_6c139…` 已实际走到 Website result-consume。因此不得再把“AGENT 整体无法生产”作为总根因。

当前有限分母固定为八项：

| ID | 现役问题 | 第一直接断裂 | Owner |
|---|---|---|---|
| P0-L10 | `LOCALIZATION_STATIC_COMPLETED_TASK_STILL_PENDING` | 固定文案消费事务先写 `status=completed/business_consumed`，随后 `writeStaticCatalogAdmission()` 遇 current source/policy 漂移却静默 `return`，事务仍提交，导致 JOB 已完成但 `localization_static_current` 未激活 | Website Localization + Website business-result consumer |
| P0-SH1 | 两张旧 JOB 反复 `LEASE_GRANTED -> PRODUCTION_SOURCE_HANDOFF_REQUIRED` | Website 对保留的 fail-closed accepted attempt 仍可发 ACTIVE 同 attempt lease；AGENT 对同一 failure 明确拒绝执行并要求 source handoff，形成“Website 重授、AGENT 拒绝”的循环 | Website.ai-acceptance + AGENT Runtime |
| P0-SH2 | source handoff 只报总错误 | `runtime-source-handoff.ts` 多个独立 predicate 全部以 `return null` 合并，worker 无法知道缺的是 Outbox、WAL、quiescence、readback、artifact 还是 proof | AGENT Runtime |
| P0-A2 | device-not-visible 可被当成 exact absence purge | `AI_V6_DEVICE_JOB_NOT_FOUND` 同时表示 absent 或本 device/session 不可见；AGENT 却把它直接映射为 `websiteJobAbsent=true` 并可不可逆 purge | Website.ai-acceptance + AGENT Runtime |
| P1-O1 | `WAIT_NEW_ATTEMPT + next_action_at=null` 被 AGENT observation 判非法 | Website contract/claim 允许 null 代表当前立即 eligible，AGENT observation 又加了一道 TTL 假门 | AGENT Runtime observation |
| P0-GPT | fresh submit 历史 12/12 `BROWSER_DOM_CANDIDATE_MISSING` | Browser 物理候选解析在发送按钮点击前失败，physical input=0；当前缺 stage/native cause 和失败时真实 composer/button 事实，无法在 H1/H2/H3 中唯一裁决 | GPT selector / Browser typed DOM evidence |
| P2-BR | 业务结果已成功后 Target loss 仍显示 BLOCKING | Extension 异步 Target-loss 原始物理事实默认经 Runtime log 映射为 BLOCKING；它没有业务 completed/admission 权力，却在诊断面看成根阻断 | Runtime Log / diagnosis；Browser 只保留原始事实 |
| P2-CR | `current_reason` 已去权威但防复活强度未达 Target | 现役 law + AST inspector + mutant 已正确，但 canonical diagnostic-only clause 未做 owner/status/domain + byte pin | AGENT agent-production-runtime quality |

### 8C. 唯一目标链与身份脊柱

唯一允许的主链仍是：

```text
Website demand_active
  -> Website exact claim / existing-attempt readback / source-handoff replacement
  -> AGENT durable accept
  -> GPT / Browser physical execution or exact zero-submit readback
  -> AGENT exact result stage + terminal intent + Outbox
  -> Website terminal
  -> Website Domain Consumer
  -> business admission receipt + domain/current-object readback
  -> completed
```

本轮不引入新的业务状态。现役三种 next action 仍是唯一集合：

```text
ACTIVE_ATTEMPT
WAIT_NEW_ATTEMPT
CONSUME_CURRENT_RESULT
```

跨仓永久身份仍只使用现役事实：`job_id + request_hash + Website frozen task`；Provider 输入去重只认 Provider effect identity / Browser WAL；对话恢复只认 canonical conversation URL + exact userTurnId；Target/Document 只负责当前物理动作。不得把 current_reason、Target、日志严重度、新诊断码、attempt count、source-handoff blocker 变成第二身份或恢复裁决。

### 8D. 原子施工工单

#### WO-L10｜固定文案 completed-but-pending 原子事务闭合

**Owner**：Website Localization + Website business-result consumer。

**施工面**：
- `services/api/src/localization/localization-static-catalog-consumer.ts`
- 必要时仅收敛 `services/api/src/ai-production/business-result-consumer.ts` 的调用顺序/异常传播，不新增第二 consumer。
- `tests/localization/static-catalog-transaction-boundary.test.ts`
- localization 现役 PostgreSQL/production topology 验收与 `scripts/audit/domains/localization/production-topology-inspection.ts`。

**唯一修改语义**：

`writeStaticCatalogAdmission()` 对“当前 source/version/policy 已不等于冻结结果输入”的两处静默 `return` 不再允许成功返回。改为稳定 typed failure，使同一 `withCommercialTransaction` 整体 rollback。这样 `finalizeConsumptionWithClient()` 已执行的 `status=completed/business_consumed` 也被回滚，JOB 保持 `failed + terminal completed + result payload`，由现役 Website consumer 5 秒有限重试；若 current source/policy 恢复为冻结身份，同一个 exact result 直接重新消费并写 `localization_static_current`，不重跑 AGENT、不建 replacement job。

**不得做**：
- 不把旧 source/policy 结果激活到当前 catalog。
- 不新增 `pending_current_write` 状态/字段。
- 不让 ensure 用 completed JOB 旁路再建同 identity。
- 不把静默 return 改成“完成但另起补偿任务”。

**验收**：
1. 注入 source identity drift：消费事务失败后 runtime 仍非 completed，`business_consumed_at/business_consumption_hash` 不成立，current table 字节不变。
2. 恢复 exact current identity 后，对同一 result hash 再消费，current row 与 business consumption 在同一事务闭合。
3. 现有 `LOCALIZATION_STATIC_COMPLETED_TASK_STILL_PENDING` 状态机反例必须变为不可达。
4. source/policy 真前进时仍遵守 `LAW-LOCALIZATION-020`：旧冻结结果只记账，不激活；新需求由新 chain/task identity 推进。

#### WO-SH1｜Website next-action 与 source-handoff 资格统一

**Owner**：Website.ai-acceptance。

**施工面**：
- `services/api/src/ai-production/job-claim-selection.ts`
- `job-claim-observation.ts`
- `job-expired-attempts.ts` / `job-lifecycle-repository.ts` 仅在共享 classifier 消费需要时调整。
- V6 Exam/quality，不加新 next-action code。

**核心裁决**：

Website observation 与 claim 必须消费**同一个现役 `classifyAttemptFailure`**，不能再只以 `attempt_id/accepted_at` 是否非空把所有 accepted attempt 都当可执行 ACTIVE。

有限分类：

1. accepted attempt 无 first failure，属于 crash/restart 普通续租：`ACTIVE_ATTEMPT`。
2. `same_attempt_provider_readback`：`ACTIVE_ATTEMPT`，只允许原 effect 零 submit 读回。
3. staged result / AGENT delivery candidate：`CONSUME_CURRENT_RESULT` / delivery-only 原链。
4. `new_attempt_allowed` 或 `fail_closed`，但本次 claim **没有 exact source_evidence**：`WAIT_NEW_ATTEMPT`，Website 不再签一个 AGENT 必然拒绝的同 accepted attempt lease。
5. 同一 job 带 exact `source_evidence` 且 `verifySourceHandoff()` 成立：允许现役 claim 事务替换旧 accepted attempt，仍是同 job/revision 或 Website 已签 revision，不引入第四状态。

**删除目标**：删除“只要 accepted_at/attempt_id 非空就足以 ACTIVE regrant”的隐含资格。保留 accepted attempt、first failure、有限 backoff 事实本身。

**验收**：
- 当前两张 source-handoff 老 JOB 在未出 seal 前 observation 与 claim 都稳定是 WAIT，不再 `LEASE_GRANTED -> 260ms PRODUCTION_SOURCE_HANDOFF_REQUIRED` 空转。
- seal 一旦出现，同一 job 下一次 claim 必须能取得 replacement attempt。
- 同 attempt Provider readback 仍 ACTIVE。
- 无 failure 的 crash/restart accepted attempt 仍 ACTIVE。
- completed/admitted + historical failure 绝不重领。

#### WO-SH2｜Source handoff 从 silent-null 改为 typed local blocker，并接现役 readback-only

**Owner**：AGENT Runtime；Browser/GPT 只通过现役公开 typed port 提供事实。

**施工面**：
- `src/lib/local-runtime/production/runtime-source-handoff.ts`
- `runtime-claim-recovery.ts`
- 必要时 `runtime-claim.ts`
- 现役 `runtime-source-readback-proofs.ts`、`runtime-claim-source-readback-failure.ts`
- Runtime recovery acceptance。

**实现方式**：

不改 V44 wire，不加 DB 列。将内部 preflight/prepare 的 `null` 收敛成进程内 sealed union，例如：

```text
READY
OUTBOX_RESULT_PRESENT
WAL_HISTORY_UNVERIFIED
UNRESOLVED_BROWSER_COMMANDS
HISTORICAL_EFFECT_READBACK_REQUIRED
READBACK_PROOF_INCOMPLETE
CHECKPOINT_ARTIFACT_UNAVAILABLE
PAYLOAD_CONFLICT_PROOF_INCOMPLETE
FIRST_FACT_MISSING
```

名称可按现役命名规范调整，但**它们只是 Runtime 内部诊断投影**，不是 Website 恢复状态、不是 current_reason authority、不是跨仓字段。

每个 blocker 只有一个消费：
- Outbox/result present：回现役结果交付，不做 handoff。
- WAL 未验证/未决 command：Browser Owner 有界再检查，不输入 Provider。
- trusted historical effect 需要答案读回：复用已经贯穿 Runtime → GPT 的 `readbackOnlyCalls`；只允许 exact `readConfirmedSubmit + checkpoint`，input delta 恒为 0。
- checkpoint artifact 不可读：原 Forensics/artifact Owner 重验。
- proof 完整：沿现役 `sealSourceHandoff -> source_evidence[]` 发 Website。
- 任一 blocker 只写 Runtime log/current_reason 镜像解释，不得决定永久 stop。

**关键减法**：当前 `reconcileClaimAttemptFailure()` 中 `fail_closed -> throw PRODUCTION_SOURCE_HANDOFF_REQUIRED` 不再承担“让 Website 反复重新发同 attempt 才有机会恢复”的职责。新行为由 WO-SH1 阻止错误 lease；AGENT 在 worker loop 无 lease 阶段先把 source proof/readback 工作推进到 seal。

**验收**：
- 为每个 blocker 建一个 mutant/fixture，必须投影唯一 blocker。
- blocker 改变后下一轮自动推进，不需用户 run。
- readback-only 路径任何情况下 Provider physical input delta=0。
- seal 前后崩溃继续读现有 `production_attempt_handoffs`，不新增第四表。
- 两张现场 JOB 最终必须在同 job_id 下从 WAIT → exact seal → replacement claim → result → Website admission，不能只验“错误码更清楚”。

#### WO-A2｜exact Website absence 才能触发本地 purge

**Owner 分界**：
- Website.ai-acceptance 负责“这个 JOB 是否真的不存在”的事实。
- AGENT Runtime 只消费 exact absence，不自行推断。

**Website 施工**：
在现有 device-status endpoint 内把两种事实拆开，不新建 endpoint/字段/表：
- exact job row 不存在：返回现役 canonical exact-not-found code（优先复用 `AI_V6_JOB_NOT_FOUND`）。
- job 存在，但本 device/session 不可见/不匹配：返回独立 typed code，如 `AI_V6_DEVICE_JOB_NOT_VISIBLE`；它不是永久终止事实。

查询必须在同一 DB snapshot 中证明“absent”与“存在但不可见”，不能先按 device 过滤后把 0 行直接解释成全局 absent。

**AGENT 施工**：
- 从 `websiteJobAbsent()` 删除 `AI_V6_DEVICE_JOB_NOT_FOUND`。
- 只有 Website exact absence code 可进入 `purgeDeletedJob()`。
- device-not-visible、session mismatch 等只停止当前危险动作并有限对账；本地 Browser/WAL/Forensics/task/store 全保留。

**验收**：
- DB 中 job 存在但换 device/session：本地 purge 调用计数=0。
- DB 中 exact job 物理缺席：仍按原 purge 顺序清理并读回。
- mutant 把 not-visible 重新塞进 purge predicate 必须 FAIL。
- `unfinished_delivery_liveness.permanent_stop_authority` 与此机械一致。

#### WO-O1｜删除 Worker Observation 的 null TTL 假门

**Owner**：AGENT Runtime observation。

**施工**：
物理删除 `WorkerObservationV6Schema` 中：

```ts
WAIT_NEW_ATTEMPT && next_action_at === null -> V6_OBSERVED_JOB_TTL_INVALID
```

及只为该错误存在的 acceptance。

不加替代字段。Website 继续以 `retry_not_before=null` 表示当前可立即再次检查/领取；WO-SH1 决定该 job 当前是否有实际 claim 资格。

**验收**：
- `WAIT_NEW_ATTEMPT + null` parse PASS。
- 非法 next-action/status/admission 组合仍 FAIL。
- 该观察接口仍完全只读，不取得业务裁决权。

#### WO-GPT-P0｜复用现有 GPT 方案，不复制第二方案

唯一施工依据继续是：

`docs/项目方案/GPT新聊天强制聊天模式-完整实现方案.md §3 / WO-P0-1、WO-P0-2`

本总方案只绑定它的完成条件：

1. 先修现有 Browser typed diagnostic，让下一次 `BROWSER_DOM_CANDIDATE_MISSING` 能读出 `candidateMissingStage/nativeCauseCode`，或用只读现场 DOM 取得唯一判别；禁止新增 WAL 列/恢复状态。
2. 只按唯一证据修一个 Owner：
   - selector 不符：原位替换唯一 `GPT_SEND_SELECTOR`，不叠 fallback；
   - composer 写入目标不符：修唯一写入 selector/postcondition；
   - mechanical eligibility：只改 stage 指向的 Browser/GPT Owner；
   - 瞬态：只有 physical input=0 才能用同 Child 现役 bounded re-observation。
3. 若真实证据要求修改 frozen GPT 文义，施工在该点停止，取得显式解冻后原位修改并重新冻结；不得绕法案加第二 selector。
4. 验收必须是真实 fresh job：exact outgoing turn 只提交一次，Provider effect WAL CONFIRMED，随后 result/admission；不能只以 selector test PASS 结案。

#### WO-BR1｜Target loss 事实与业务阻断严重度分离

**Owner**：Runtime Log / diagnosis。Browser Authority 不改物理安全语义。

现场已经证明 `job.execute succeeded` 后，Extension 因 `CHROME_DEBUGGER_TARGET_CLOSED` 报 `BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT`，随后 Website admission readback 仍成功。物理 Target loss 是真事实，但不是这张已产出结果的 demand blocker。

**施工原则**：
- 保留 Extension `ExtensionTargetLoss` 的 exact physical-loss fact、Target invalidation 和 revoke。
- 不让 Browser 读取 Website business state，不把业务知识塞进 Browser。
- 在现役 Runtime Log diagnosis/aggregation 层，若同一 job 已有 local staged/terminal result 或 Website admission，而该 Target loss 没有未决 Provider mutation，则把它投影成 `CLEANUP` / `CONSEQUENTIAL`，不得成为第一 BLOCKING 根因。
- 若 Target loss 发生在结果前且当前动作依赖该 Target，仍保持 BLOCKING。不能把所有 Target loss 一刀降级。

**验收**：
- 复现“result 已 stage/terminal → Target closed → admission success”：主业务 outcome 不变，Target loss 仅 cleanup/consequential。
- “submit 前 Target closed”：仍 BLOCKING、input delta=0。
- 原 Target frozen authority、current Target/Document/fence/permit 均不修改。

#### WO-CR1｜current_reason diagnostic-only 防复活 byte pin

**Owner**：AGENT agent-production-runtime quality。

生产代码变化=0，法案正文变化=0。

直接复用现役 `LAW-AGENT-PRODUCTION-RUNTIME-001` 中 canonical clause：

`current_reason 仅是可变诊断投影，不得参与授权、CAS、恢复、容量、stage、Provider submit、删除或完成决定`

在现役 agent-production-runtime audit/acceptance 中增加：
- 唯一 carrier。
- Owner law family=`LAW-AGENT-PRODUCTION-RUNTIME-001-V*`。
- `status=active`。
- `capabilityDomain=agent-production-runtime`。
- 当前完整 clause SHA-256 byte pin。
- relocation / weakening / duplicate mutant。

继续保留现役 `current-reason-diagnostic-only` AST consumer denominator。**不删除 current_reason 字段**，Operations/Console/UI 仍可只读解释。

### 8E. 删除反事实与新增预算

本轮 production 新增预算：

```text
新表 = 0
新持久字段 = 0
新 Website next-action = 0
新 queue = 0
新 manager/scheduler = 0
新 recovery Owner = 0
新 WAL / Outbox = 0
replacement job = 0
fallback selector = 0
dual-read / dual-write = 0
```

允许新增的唯一“结构”是 **Runtime 进程内 typed blocker union**，它有两个真实消费者：日志诊断和现役 worker 对 readback/seal 的推进。删除它会重新退化为 silent-null + generic handoff 循环，因此通过删除反事实；它不得持久化、不得跨仓、不得获得业务裁决权。

本轮明确删除：
- localization current identity/policy 的 silent-success `return`。
- Website “accepted attempt 非空即足以 ACTIVE regrant”的泛化资格。
- AGENT `websiteJobAbsent` 中 ambiguous device-not-found → purge。
- Worker Observation `WAIT_NEW_ATTEMPT + null` 假门。
- 仅保护上述错误语义的 acceptance。

明确保留：
- Website 原 job / attempt / event / claim receipt。
- AGENT 原 task / Outbox / `production_attempt_handoffs`。
- Browser WAL、Provider effect identity、current Target/Document/fence/permit。
- source readback observations/proofs、input-quiescence、checkpoint artifact proof。
- `current_reason` 字段本身，只冻结其无控制权。
- localization `localization_static_current` 唯一当前表。
- 历史 migration、Target reject-only old-field literals，不做 grep 式清零。

### 8F. 跨仓施工顺序

为避免兼容桥，使用现役合同下的前向安全顺序：

1. **WO-L10**：Website localization 原子闭合。它与 AGENT 无 wire 变化，可独立完成。
2. **WO-SH1 Website 侧**：先让 observation/claim 不再给 fail-closed 无 source_evidence 的旧 attempt 发错误 ACTIVE lease。旧 AGENT 面对 WAIT 是安全的。
3. **WO-SH2 AGENT 侧**：再把 silent-null 转 typed blocker，并复用 readbackOnlyCalls / seal。V44 wire 不变。
4. **WO-A2 Website 侧**：先把 exact absent 与 not-visible code 分开。旧 AGENT 对新 not-visible code不会把它识别成 absence，默认保守不 purge。
5. **WO-A2 AGENT 侧 + WO-O1**：收窄 purge predicate并删 observation 假门。
6. **WO-GPT-P0**：在 source-handoff 不再空转后做真实 fresh submit 取证与唯一修复，避免新 GPT 失败又被泛化 handoff 遮蔽。
7. **WO-BR1 + WO-CR1**：最后收敛诊断严重度和 anti-resurrection pin，不影响前面生产语义。
8. **WO-Q**：两仓原生 quality + 动态生产闭环。

若任一前序工单未通过原生 quality 或动态反例，禁止进入后序依赖工单；不以“先全部写完再一起调”替代闭环。

### 8G. 原生质检与动态闭环

**Website 原生门**：
- `pnpm quality:check CHANGE`
- ai-production V6 Exam。
- localization static contract/transaction/PostgreSQL 动态验收。
- exact-absence device-status state-machine/mutants。

**AGENT 原生门**：
- `npm run quality:check CHANGE`
- agent-production-runtime recovery/business-admission acceptance。
- GPT acceptance。
- local-browser terminal/target acceptance。
- runtime-log/diagnosis acceptance。
- current_reason quality mutants。

CHANGE/READY PASS 不是业务完成。最终动态闭环至少逐项证明：

1. **Localization atomicity**：人为制造 current source/policy 漂移时，同一事务不得留下 completed-without-current-row；恢复 exact identity 后同一 result 直接消费成功。
2. **两张旧 source-handoff JOB**：原 `aiprod_2ecfc2ce…` / `aiprod_2e48943f…` 不再获得必败同 attempt lease；必须自动形成 typed blocker、完成需要的 exact readback/seal、同 job 获 replacement attempt，最终 result + Website admission。不得换 job_id。
3. **Provider effect 安全**：已有 possible/confirmed effect 的任何 readback 阶段 Provider physical input delta=0；只有 Website 已签现役 risk grant 的精确 call 可输入一次。
4. **Exact absence**：job 对当前 device 不可见时，本地 Browser/WAL/Forensics/task 零 purge；只有 Website exact row absence 才清。
5. **Observation**：`WAIT_NEW_ATTEMPT + next_action_at=null` 读回合法，且 observation 与实际 claim 资格一致。
6. **GPT fresh submit**：真实 fresh job 只一次 submit，WAL CONFIRMED，结果进入 Website admission；若仍失败，必须已有非空 typed stage/native cause，不再是匿名 candidate missing。
7. **Target cleanup**：结果已成立后 Target 物理关闭不得成为 business BLOCKING 根；admission 继续完成。结果前物理 Target loss 仍 fail-close。
8. **current_reason**：注入控制分支/SQL gate/移动 frozen clause 任一 mutant 必须 FAIL。
9. **历史完成集**：已 completed/admitted 且存在历史 failure 的工单，在变更前后 job/result/admission hash 不变，不产生新 claim/Provider input。

### 8H. 停止与回退边界

- 未改变 wire schema，本轮无双版本兼容桥。
- Website WO-SH1 部署后若 AGENT 尚未升级，只会减少错误同-attempt lease，不会放宽 Provider 输入。
- Website exact-absence code split 部署后，旧 AGENT 对新 not-visible code默认不 purge，安全偏保守。
- 任一 source proof 身份不等、WAL 未 verified、Browser command 未 quiesced、artifact 不可读时，只停止当前危险动作并有限再检查；不得清证据“解锁”。
- localization 事务失败只 rollback，不删除 exact result，不造补偿 job。
- GPT 取证若指向 frozen semantic change，停在授权门；绝不加 fallback 先绕过去。
- 生产动态验收未达到 Website business admission/object readback，不得宣布 RELEASE。

### 8I. 本轮方案裁决

这八项不需要八套恢复系统。它们只需要把四个越权/断裂点正位：

1. Website Domain Consumer 不能先宣布 completed 再静默放弃 current-row 写入。
2. Website 不得给 AGENT 一个按同一事实必然拒绝的 ACTIVE lease；source handoff 应在无 lease阶段先形成真实证据。
3. device visibility 不是 job absence。
4. Browser/GPT/diagnostic 局部事实不得冒充 Website demand/completion authority。

其余四项都是在这条主链上做减法或提高可观测性：删 observation 假门、复用 GPT P0 现役方案、把 Target-loss 日志严重度与业务权力分离、把 current_reason 无权威做防复活 pin。

**施工完成的唯一终点仍是：同一 Website JOB 的真实 Product result -> Website terminal -> Domain admission receipt/current object readback -> completed。**

