# 浏览器命令 WAL 原终态补交—原 Extension worker 存活范围完整实现方案

更新：2026-10-02（Asia/Dubai）。需求 Owner：AGENT / local-browser-session。
状态：**已取得施工授权，W0 已对齐并完成两轮主 Codex 权威核对；W1/W2/W3 代码与质检迭代已落实，已完成两轮主 Codex 代码自检；独立只读审计发现并闭合接收重放、跨进程终态排序及旧 claim 异步误清三项，按 18 项有限实现义务核查后已放行进入 CHANGE，原生 CI-FULL 尚未取得结果**。前轮设计修正断线 handler/activeTarget 竞争与日志失败扣押 ACK 两个缺口；此前自审不能作为施工依据。当前执行遵守主 Codex 唯一写入、W0 至少两轮主审且禁止子智能体、重要步骤及最终只读子审、冻结 ci-full-governance 的 CHANGE→READY→RELEASE。方案审计不构成质量 PASS、READY 或 RELEASE。

## 1. 目标与范围

授权人要求：在当前基础上，不增加过度复杂度；禁止用 DISPATCHED 充当最终故障；取得精确事实，再精确自动恢复。设计阶段主 AI 三轮复审；本次施工阶段 W0 由主 Codex 至少两轮审计，代码由主 Codex 唯一写入，子智能体只审查且最终未放行不得结束建设。

唯一目标链：**原 Extension 命令取得可信终态 → 同一认证 WebSocket → Supervisor现役装配 → 唯一terminal verifier/Store结算 → 原WAL commit/readback → 尝试原日志 → 原WebSocket ACK → 仅日志健康时原lane pump → 按Website当前授权接回原任务。** 日志失败仍确认已commit事实，但停止后续工作。

DISPATCHED 保留为合法 WAL 过程事实，表示命令越过发送边界、Browser 尚未取得可信终态。禁止直接把它当 failure code、永久 Job 终态或动作失败根因。BROWSER_COMMAND_RECEIPT_MISSING 只证明回执缺失；物理输入是否发生、命令是否终止、机械后置是否通过、业务是否接纳必须分别判断。

自动补交仅覆盖新机制启用后，**原Extension worker实例未终止、原命令槽仍在且能形成可信终态**的断线/AGENT重启。Chrome仍运行但MV3 worker已被终止、休眠后重建或reload，也会丢槽，不要求Chrome同时退出才算丢失。原槽丢失或命令从未到达原执行端时，WAL仍未决、精确报告回执缺失；不承诺所有主进程重启都自愈，不回填部署前事故。文件路径沿用已有唯一方案，标题和验收按此边界收紧。

这是Browser公共mutation回执链的修复，覆盖共用该链的菜单、模型、填写、附件和submit，不是附件上传专用补丁；不改变这些Child的业务步骤、DOM合同或Website授权策略。附件OR是前轮独立修复，本轮只保留其防回归要求。

现役manifest为MV3、minimum Chrome 120，service-worker.ts只装配原Actor；pairing-auto-bootstrap.ts:69-81一分钟alarm只能重新唤醒，不能复活旧JS槽。Chrome官方生命周期文档说明通常30秒无活动可终止worker、终止会丢失全局变量；Chrome116起WebSocket消息、118起active debugger session可延长存活。施工前websocket-actor.ts:384-397在断线时调用releaseActiveTarget(false)，extension-target-authority.ts:202-210在false分支不detach debugger，故不能仅凭8分钟断线认定worker已死亡，也不能保证它存活。本方案不改变detach/alarm/keepalive、不保留Target作为恢复资格、不新增worker身份字段或保活器；只以原槽真实存在为补交前提。[Chrome官方生命周期说明](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)。

授权人补充：“当前这个 DISPATCHED 工单我们会删除记录，不要用代码去挽救它”。本次现场 job 只用于根因取证，由授权人侧处置；排除在自动抢救、迁移和生产恢复验收分母外。本轮不执行删除，也不新增修补旧行、回填历史回执或按 jobId 特判的代码。

不增加第二持久存储、状态机、恢复队列/Owner、调度器、watchdog、定时重试、通用恢复 API、Target/URL registry、业务 resumePoint 或兼容桥。回原 URL 只用于现役 CONFIRMED submit 的可信 locator 读回，不是通用解锁条件。

## 2. 候选、来源与前轮连续性

### 2.1 历史设计绑定与当前施工 Git

施工起点：AGENT /Users/nexgen/Documents/AGENT，main@b26e220dcc0aeb98aded153c53dbcf4b096c9f09，本地 origin/main 同 SHA。Website 历史设计快照是 main@aaf206b834b78ed5082f2783f5c2a218e456229c、当时本地 origin/main@c5201a41f8356f6052652853a0bf47b13fb2ca75；这些仅为历史连续性，不冒充当前候选。

2026-10-02 施工复核：AGENT main HEAD 仍为上述 b26e220；Website main 已由其它八字任务提交推进到 b98d25ab2d4b79ccc8e386465a61fc02480c8439。历史快照到当前 HEAD 的母本、active law 与本方案 job-lifecycle consumer 没有提交差异；SYSTEM/AI Acceptance Blueprint 的差异为八字来源与材料交接，已读回，未改变本方案 V6/attempt/恢复授权边界。相关 consumer 已按当前 HEAD 重读；Website 仍有其它任务 dirty，不纳入本次写入或代提交。未知云仓实时状态不冒称验证。不创建分支或替代候选。

前轮新方案已写入本地同名文件且尚未提交；此前修订前记录的文档SHA-256为14116e2bb391c82cd53d578178c32d223d2275a8768fddfa0c3ad77556766ff7，仅作连续性来源，不是本轮成品hash。本轮写前再次读回，确认含前轮唯一结算/binding/MV3边界与两处待修设计，属于本会话授权方案，不是未知用户改动。HEAD仍保存旧撤回版本，不能用git show HEAD或仅取远端同名文件施工。当前施工只在上述本地 main；READY 必须形成包含本方案及授权差异的 clean 原生 Git commit。不得代提交无关 dirty。AGENT既有model/DOM、附件OR和八字Plugin dirty overlay、Website八字施工dirty overlay均不触碰。

历史设计阶段 source candidate（施工后已失效，不用于当前质量结论）：2201a79e1486b8ead3080c09c465e09ae02e62977f91bfde75ac264c8f5b5688。分母为下列78个AGENT文件，各bytes SHA-256按路径排序成{path,sha256}数组，以UTF-8、ensure_ascii=False、无空白JSON编码后再次SHA-256；方案自身不进入source candidate。前轮69文件指纹仍为fcbf0073c26facfb9be41e2306893b4ec2d35649ce5968faa2869bcbf8cdee25、原52仍为313f463c92aaf5ccdf3ace20a42cdd9fa096c522e9b513a34d01030e2b365cac；此“未漂移”仅指设计修订时的只读快照，代码施工已改变这些 bytes。设计阶段只补9个真实调用依赖：原输入/只读guard、特殊点击、原logger/claim门及Target生命周期验收，不扩大生产责任或功能范围。

- AGENTS.md；.github/instructions/agent-rules/{基础法案,功能法案}.md；scripts/audit/generated/law-registry.generated.json；package.json。
- docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md；docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md；docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md。
- src/lib/browser/protocol/{browser-protocol.schema.json,browser-errors.json,generate-browser-protocol.mjs,generated/browser-protocol.generated.ts}；src/lib/browser/transport/{browser-authority-frame-codec.ts,browser-authority-frame-payload.ts,browser-authority-websocket.ts}。
- src/lib/browser/chrome-extension/{manifest.json,service-worker.ts,pairing-auto-bootstrap.ts,websocket-actor.ts,websocket-actor-crypto.ts,extension-command-runtime.ts,extension-target-authority.ts,debugger-runtime.ts,extension-interaction-readiness.ts,dom-intent-runtime.ts,dom-pointer-intent-runtime.ts,dom-mutation-postcondition.ts,extension-file-input-runtime.ts,command-permit-validator.ts,gpt-rate-limit-dialog.ts}。
- src/lib/browser/exact-target/{browser-command-actor.ts,browser-command-postcondition.ts,browser-command-failure.ts,browser-command-runtime-logging.ts,browser-mutation-store.ts,browser-mutation-schema.ts,browser-mutation-types.ts,browser-mutation-row.ts,browser-mutation-evidence.ts,browser-mutation-payload.ts,browser-mutation-receipt.ts,browser-special-mutation-receipt.ts,browser-gpt-rate-limit-preflight.ts,browser-observation-receipt.ts,browser-submit-recovery-payload.ts,browser-outcome-resolver.ts,browser-target-lease-manager.ts,browser-target-lease.ts}。
- src/lib/browser/infrastructure/{browser-lane-coordinator.ts,browser-infrastructure-supervisor.ts,browser-infrastructure-state.ts}；src/lib/runtime-logs/{diagnosis.ts,logger.ts}；src/capabilities/gpt/{production-child-tools.ts,production-child-result.ts,acceptance/gpt-exact-target-browser-fixture.ts}。
- src/lib/local-runtime/production/{terminal-failure.ts,runtime-startup.ts,runtime-claim.ts,runtime-claim-recovery.ts,runtime-loops.ts}；src/lib/local-runtime/workbench.ts；scripts/startup/lib/service-process.mjs。
- scripts/audit/domains/local-browser-session/{manifest.json,browser-mutation-settlement-inspection.ts,mutation-atomicity-inspection.ts,target-claim-inspection.ts}；scripts/audit/domains/code-purity/components/{scan-structural-function-budgets.ts,code-purity-owner-model.ts}；scripts/acceptance/{local-browser-terminal-contract.acceptance.ts,local-browser-terminal-rejection-support.ts,local-runtime-browser-authority.acceptance.ts,runtime-log-spine-failure-matrix.acceptance.ts,local-browser-mutation-store-support.ts,local-browser-mutation-receipt-support.ts,local-browser-provider-effect-recovery.acceptance.ts,local-browser-rule-mutants.acceptance.ts,local-browser-target-lifecycle-support.ts}。

Website只读consumer：services/api/src/ai-production/job-lifecycle-core.ts:25-61、job-lifecycle-repository.ts:94-130,178-210。两文件工作区无dirty；failClosedAttempt保留accepted attempt，但并未给AGENT自签续跑权。本地AI Acceptance Blueprint存在八字材料/PDF dirty，不属于上述恢复consumer变更；不覆盖、提交或当作clean authority。施工前重读这两处及目标main的现役法案/Blueprint；本次不修改Website wire/API/Schema。

### 2.2 事故事实

重启日志producer：dfda9617-fe37-4a7a-8771-0d63ab56f310。前轮只读Browser SQLite见command=e14de8a4-1978-44a3-9f0c-e57cc6d02725，job=aiprod_395fe98b-c31c-4dd4-8e79-597b1236d6b7，attempt=d005eaa3-8653-432c-8ce2-f7bfddae71df，Child=open_gpt_attachment_control，target_local + DISPATCHED，terminal_at=null，无恢复payload；updated_at=2026-10-01T13:33:30.725Z（Dubai17:33:30.725）。本轮不重查或操作该工单，以上不是本轮当前数据库状态证明。

证据来源：用户附件/Users/nexgen/.codex/attachments/56b8183e-a6c2-42c6-b05a-4d7fcb488972/已粘贴的文本.txt，以及前轮只读.grasseye-local/browser/browser-mutations.sqlite。日志13:33:34停止、13:41:51重启只证明AGENT断线间隔，不证明worker已死亡或原终态曾形成。该job不用于后续生产恢复验收，不通过代码挽救。

physical_input_count=0 是未取得终态时的默认值，不是可信零输入证明。这证明未决阻塞真实存在，不能证明本次到底点了什么；以下静态缺口也不能冒称本事故命中了某条。附件 OR selector 的既有 CHANGE 验证不替代本方案实证。

### 2.3 回归与复用裁决

深度：恢复、跨连接合同、WAL 和 Runtime consumer 改造，使用有限深度重建。

本文件旧候选“重启即结算target_local DISPATCHED为FAILED”已撤回，其错误工单已在前轮从工作区文档物理删除；HEAD中的旧文档不是施工依据。浏览器退出恢复与未决命令解锁方案中的settleRetiredTargetLocal曾落地，提交c7b557575已删除；Target系统地位与强制边界方案§1.3/WO-A4与LAW-ARCHITECTURE-BOUNDARY-002-V2禁止复活。

仍适用的不变量：Target不提供跨时恢复资格；UNKNOWN Provider输入不得重发；WAL是唯一mutation truth。GPT稳定会话地址恢复方案的confirmed locator、GPT提示词空格投影与Target-Local恢复闭环方案的scope/outcome分离直接复用。现役resolveDispatchedMutation依赖caller receipt与原Target；反向搜索src只有lease暴露而无生产调用，旧Store.resolve仅被该Actor及验收调用。本次W2物理退休这条部分结算入口及其类型/暴露，原位替换验收，不能把它留作第二成功算法。

## 3. 施工前实现与第一直接断裂

| 位置 | 施工前事实 | 裁决 |
|---|---|---|
| browser-authority-websocket.ts:193-194 | 先 markDispatched，后 socket.send | 保留前置 WAL，不宣称 Extension 已接收/动作发生 |
| websocket-actor.ts:321-330 | 结果返回后再 assertCommandActive，通道失效可丢弃原结果 | 先固定原事实，再判断交付资格 |
| websocket-actor.ts:341-350 | 先 DIAGNOSTIC 后 REPLY，诊断失败可阻断终态 | 终态优先，诊断不覆盖原事实 |
| websocket-actor.ts:373-381 | 断线/会话漂移时静默 return | 明确交付失败；保留原终态至 WAL 确认 |
| browser-command-failure.ts:90-96 | 缺回执保留 DISPATCHED，报 RECEIPT_MISSING | 保留，区分交付失败与动作失败 |
| infrastructure-supervisor.ts:84-98,195,320-325 | Supervisor持有唯一Store；Actor随lease临时装配；transport已有callback装配 | Supervisor装配一个onMutationReceipt入口，重连不依赖原Actor |
| browser-command-actor.ts:358-404 / command-failure.ts:66-87 / mutation-store.ts:381-433 | 正常与错误直接写terminal，旧resolve又有部分写入 | 统一到settleTerminalReceipt，删除旧直接terminal writer及resolve链 |
| manifest.json:2-7 / pairing-auto-bootstrap.ts:69-81 / releaseActiveTarget:202-210 | MV3；一分钟alarm；断线false分支不detach debugger | 原槽存活才补交，时长不证明worker死亡，不新增保活或存储 |
| websocket-actor.ts:384-417 / target-authority.ts:276-334 / interaction-readiness.ts:75-85 | close/onSocketClosed直接释放activeTarget；同assertCurrent同时卡输入及后置只读；ProviderInputState仅started | 立即撤输入权，原handler收尾并固定槽后再释放；started不作输入计数或confirmed证明 |
| 功能法案.md:1216 / runtime-logs/logger.ts:119-120,178-190 / runtime-loops.ts:79,239 | 日志故障禁止新claim/mutation，同时不得停止已SENT确认清理；原logger已保留失败状态 | 已commit仍ACK，按原logger关后续工作，不notify，不用新日志gate布尔 |
| browser-lane-coordinator.ts:156,190-193 | 全局未决阻止 acquisition | 保留安全门，补交不取得页面 lease |
| production-child-tools.ts:164-170 | DISPATCHED submit 在 acquisition 前 UNPROVEN | WAL 真正 confirmed 后才能走既有 readback |
| runtime-claim-recovery.ts:216-225 | 首条 failure 若为 fail_closed，Product 前 SOURCE_HANDOFF_REQUIRED | WAL 解锁不等于业务有权继续 |
| diagnosis.ts / command-runtime-logging.ts | 已有 pending_reconciliation；pendingReceipt 参数未消费 | 复用现役表达，旧开放 span 不补造 terminal；跨 run 的 Browser 原行可信 terminal 按不可倒退事实选择，并由现役 authority resolver 对账，不按随机 UUID 或墙钟推定先后。冲突/未核真保持 DIAGNOSIS_INCOMPLETE |

第一断裂：**原 Extension 命令事实与当前 socket 交付资格耦合，真实终态没有可补交、可确认的保存责任。** 启动期缺少 DISPATCHED UPDATE 不是合法根因，不能据此制造 terminal。

四维绑定：Browser-004-V56的terminal-only/global gate；Browser-003-V45的live Target；Browser-006-V44的窄载荷闭集（W0 从 V43 升版）；Architecture-002-V2的Target冻结；Runtime-Log-003-V6的真实span/WAL后提交，以及Runtime-Log-001-V7的“阻止新动作、继续已SENT确认清理”（功能法案.md:1216）。Browser Blueprint第11/27/33行给出原WAL终态门，V6/GPT Blueprint给出accepted attempt、once-submit与Outbox。代码落点如表。各现役Browser/Runtime/Log acceptance经唯一npm run quality:check裁决，业务终点仍是Website admission与领域readback。

## 4. 唯一目标结构与合同

### 4.1 原执行端保存事实

在现役 ExtensionWebSocketActor 内，用一个**有界、仅内存的未确认 mutation 终态槽**延续原 handler 责任，不建历史 Map、任务队列或持久化。原mutation进入执行前即独占该槽，terminal字段在可信收尾前为null；这是原命令的执行上下文，不是第二业务状态机。全局 mutation 在途上限仍为一；未确认槽不能被第二 mutation 覆盖。

原调用取得结果后，复用现役 receipt decoder生成最小 terminal projection：confirmed/rejected、mutation outcome、physical input count、failure/native cause、机械验证事实、原完成时间。普通异常只有在原 handler 与实际 CDP action/barrier 已收束后才可报告 terminal。输入可能发生时保留 dispatched，不能因计数未回填而填 no。deadline 到期、socket 消失、空 handler Set均不单独证明实际调用收束。

断线顺序冻结为：onSocketClosed/close立即置commandAdmissionSuspended、清session/commandReady/permit authority，拒绝所有新COMMAND、TARGET_ACQUIRE及未来物理输入；外部断线清理复用pendingCommandHandlers/awaitOldCommandHandlers等待原调用真正完成，原handler只等已发CDP、2.5秒barrier与原后置只读；terminal projection固定进入原槽、handler退出后，最后releaseActiveTarget(false)。不得在handler内部等待包含自身的Set；handler完成不等待ACK，避免断线清理与补交互等。retireInvalidCommandTarget等原错误清理只能在 CDP/barrier/只读收尾已结束且 terminal 固定后执行；socket 断线释放必须等原 handler 真正退出，不得提前清 activeTarget；不得加清理队列，清理失败也不改已固定事实。新READY可鉴权及补交，旧handler/drain未结束或原槽未ACK时仍禁止新页面acquisition/mutation；复用原admission字段、pending集合及槽，不新建drain manager/状态机。旧连接清理不得清掉新连接已取得的Target；新acquisition只在旧释放完成后开放，不由READY直接重开。

guard职责在现役文件内分开：原assertCommandActive仍决定每一次未来输入的session/permit/deadline资格；通过原withProviderInputGuard在每个实际PAGE_MUTATION_METHODS发送前同步核验（包括多CDP点击的后半段、fill、file-input），不得因ProviderInputState.started为true就放行后续输入。只读收尾沿原executeRegisteredCommand调用期提供assertMutationReadback：只适用于已开始的同一mutation，保留原Target/Document、Chrome reality、interaction generation与原后置读取界限核验，不依赖旧socket仍存活，不重新admit、激活Tab、导航、选择新Target或扩大deadline。Node旧waiter可以超时，原CDP/barrier仍须收束；超过原读取界限不再读页面，按真实原因收尾。未开始的调用仍受原全资格guard，撤权后拒绝为REJECTED/no仅在可信零输入成立时允许。

dom-intent-runtime、dom-pointer-intent-runtime、dom-mutation-postcondition、extension-file-input-runtime及特殊ack直接调用只在现有输入点用原严格guard、在原后置只读点用上述收尾guard；runtime的最低输入门仍兜底，不能只重命名assertCurrent或统一放宽。ProviderInputState.started只证明低层动作可能开始，不能换算成一次业务输入、不能作CONFIRMED；physicalInputCount来自原命令机械计数/原回调同一语义，保留已知计数，不以started/default补造0或1。当前pointer的onPhysicalInput在mousePressed实际发送前调用，不能独自当可信已输入计数；必须由原低层许可通过后的实际发送/机械结果共同核定，禁止前置回调抛错或发送被guard拒绝却记成已输入。已发输入但后置无法核实时，真实REJECTED+dispatched+已知计数及精确native cause；未能证明输入且可能发生时也用dispatched，不用no。确定原CDP/barrier及动作调用已收束才可固定REJECTED，再退出handler；仍在途继续未决。2.5秒barrier不缩短；原Target真实导航/丢失仍失败关闭，不跨Document求成功。

固定原结果后才检查交付通道。不能用新页面fresh readback改写旧结果。槽不保留Prompt、selector、本地路径、DOM HTML、回答正文、旧Tab或业务resumePoint；原Target只在原handler调用栈内延迟清理，不存入补交槽或新registry、不授跨时输入资格。CONFIRMED submit可保留既有submitRecoveryPayload的唯一URL/userTurnId/hash子集，随后只在原WAL加密落盘；target-local不保存URL。worker终止即失去槽，不新增磁盘保底。

### 4.2 最小传输补交

现役协议新增一个窄控制 frame MUTATION_RECEIPT，仅 Extension→Browser 的 fact 与 Browser→Extension 的 ack。它无 acquisition/DOM/navigation/input 权限，仍走同一现役认证 WebSocket，不新增 Browser capability。

COMMAND固定携receiptBindingHash（mutation为hash，observation/lifecycle为null）。唯一字段定义为现有browser-observation-receipt.ts中的纯函数browserMutationReceiptBindingProjection(identity: BrowserMutationIdentity)：按[commandId,exactCallIdentityHash,jobId,attemptId,resultRevision,leaseVersion,executionFenceHash,deliveryPriorityReplayGrantHash,productStepId,callId,childCapabilityId,effectScope,actionOrdinal,actionId,positivePostconditionHash,negativePostconditionHash,requestHash,payloadHash]返回固定顺序canonical数组；Browser发送和结算都只调用它，以既有Node SHA-256计算hash。只投影现役WAL不可变身份，不增加第二identity类型/存储/生成器；不含targetRef、documentRef、tabId或target-local logicalMutationId，原request/payload hash仍是原命令完整性事实，不用来选旧页面或授恢复输入。

Extension只保留并原样回传经AEAD认证的commandId/binding，不重拼18个WAL字段，不传输整套WAL身份；protocol只校验hash形状，acceptance通过同一函数构造合法输入并以独立负例验证遗漏/顺序/漂移，四端不得各手写字段列表。Node/Extension共用terminal canonical编码与receiptHash算法，复用各宿主已有SHA-256能力，不另建crypto adapter。新增身份字段时，只在现役身份投影定义与同一验收更新，不能新增映射链或兼容投影。

Extension在已鉴权COMMAND完整commandId/binding身份成立后、动作资格校验前占用原槽；动作资格拒绝也须保存真实REJECTED/no回执。动作仍经原permit/command/Target/current Document校验；无法绑定原command时只typed拒绝，不猜身份/终态。binding只证明原命令归属，不授新输入、不改变provider_effect_identity。

fact body固定为type=fact、commandId、receiptBindingHash、terminalReceipt、receiptHash五字段；ack body为type=ack、commandId、receiptBindingHash、receiptHash四字段。terminalReceipt固定九字段：schemaVersion=grasseye.browser.command-terminal-receipt.v1、terminal（confirmed/rejected）、mutationOutcome（no/confirmed/dispatched）、physicalInputCount（沿用原0..4存储类型）、failureCode、nativeCauseCode、completedAt、resultHash、submitRecoveryPayload。不增流程阶段/恢复状态。wire的0..4只为WAL既有类型闭集，不授动作次数：现役decodeBrowserMutationReceipt的机械计数仅0|1，当前正常mutation、doubleClick/keypress/fill、file-input及限流ack都按原命令收据的逻辑输入计数核验，不按CDP调用数计。唯一verifier按原行actionId/Child与既有命令规则同步限值，当前上述命令携2/3/4均拒绝；不为补交新建计数registry、放宽once-input或改写历史terminal。原resultHash为原raw机械结果（异常为固定errorCode事实）的canonical JSON SHA-256；completedAt只在原可信收尾时生成一次，必须canonical UTC ISO时间，不按跨进程墙钟授输入。confirmed只许no或confirmed；no必须原执行端证明零输入且count=0；confirmed输入数必须符合原动作合同；rejected+dispatched的count仅表示已取得的计数事实，0也不能证明未输入。confirmed的failure/nativeCause为null；rejected必须有精确failureCode；submitRecoveryPayload只在CONFIRMED submit时携现役固定子集，其余为null。合法组合、code闭集、URL/UUID/hash清洗沿用现役decoder。unknown field拒绝，禁止下次页面观察进入projection；payload内原Target/Document hash只验证原机械收据完整性，不用于选页或恢复资格。

receiptHash固定为canonical JSON对象{commandId,receiptBindingHash,terminalReceipt}的SHA-256，不含type或receiptHash自身；原WAL proof_hash写该值。当前认证、序列、AEAD、固定Extension/build身份完整验证。Extension 在原 socket Owner 内保留一个当前会话 lastServerSequence；每个已验证 AEAD 的 READY/COMMAND/TARGET_ACQUIRE/TARGET_CLAIM/ACK/REVOKE 在产生副作用前必须消费严格递增序列，重复或倒退关闭该连接，不能在 ACK 清槽后重投旧 COMMAND。配对握手依原阶段只接纳一次；新密钥会话从 READY 的序列重新初始化，不新增 command 历史表或输入幂等队列。同一原事实跨Node/Extension编码与哈希必须相等；禁止改变当前provider effect、request/payload身份算法来省去核验。

正常 mutation REPLY 携同一 projection/hash，Browser仍用原 command验证 raw机械result并对照projection；补交只交原执行端已经形成的projection，不重执行旧command，不要求旧requestSequence有新Promise，不重新签发旧permit。跨Node/Extension的机械投影必须复用同一纯算法，不能从当前代码重新构造旧Prompt后再判旧事实。现役coherent packet的exactCallIdentityHash由Browser binder加入，不能直接让Extension把未绑定七字段raw packet交给要求八字段的现役decoder：将既有binder的纯数据绑定算法原位移入现有browser-observation-receipt.ts，以原permit生成exact-call hash并验证原packet；两个宿主分别提供已有SHA-256能力，raw REPLY保持原机械结果，projection只使用绑定后的工作副本。不改变packet版本/既有身份算法，不返回Prompt或新增Target恢复身份。

仅两个现役事件触发：原 handler真正结束、当前 READY完成。有槽时在当前连接交付一次；断线保留，下一READY再交同一事实。普通 REPLY成功发送后等待ack，不并发再发一套fact；原reply通道已失效而新READY已发生时，在原handler结束事件直接使用当前通道补交。不增加timer、循环重发或第二reconnect Owner。

Browser先提交原WAL，再ack；Extension只在精确ack后释放槽。重复相同fact对相同terminal/proof只ack，不重写terminal时间、计数或payload。不同hash/结果冲突拒绝，不ack、不覆盖；缺行不重建。重复ack或不属于当前槽的旧ack不改变槽，也不清掉下一命令；属于当前command却hash冲突时精确拒绝。socket.send/Promise resolve/新fence均不充当持久接纳。

同一 READY 与 handler 结束竞争时，用原 Actor 内 lastMutationDeliveryKey 去重，标记只抑制同session重复发送，不作为接纳证据；新session仍须补交直到ack。在原socket Owner的发送函数中保证序列分配、异步加密和实际发送按同一会话顺序执行；ack的验证/清槽必须先于其后同连接COMMAND的mutation入场。原 Owner 的 sendTail/receiveTail 仅序列化加密/解密入场；长 handler detached，避免 TARGET_CLAIM ACK 自等待。断线共享一个 disconnectedDrain Promise，待既有 handler Set 收束后释放，不建恢复调度。只原位收束消息顺序，不加业务队列/调度器或第二socket。协议8的normal REPLY parser必须消费固定projection字段；原mutation异常reply也携同一可信终态projection，不能继续从裸errorCode猜物理输入计数。

协议8普通REPLY固定为requestSequence、permitSequence、replyChannelToken、result或errorCode二选一、mutationReceipt五字段。mutationReceipt为上述完整fact body；observation/lifecycle为null。成功raw result须按原decoder与projection逐项一致；异常errorCode须等于projection.failureCode，输入事实只来自原执行端projection，不由errorCode推断。mutation缺可信projection时整包不能结算WAL，保留未决；不得增加旧四字段reply兼容。该字段是同一事实交付，不是第二收据或第二判定器。

### 4.3 原 WAL 一次结算与唤醒

函数级主链冻结如下，全部属于现役local-browser-session Owner，不新增跨连接Actor、manager或service：

1. BrowserAuthorityWebSocketOptions增加唯一onMutationReceipt(fact, acknowledge)回调。Supervisor构造时绑定到BrowserInfrastructureSupervisor.settleMutationTerminal(fact, acknowledge)，两类消息共用同一callback；其state.mutationState已在start打开，停止/未就绪时拒绝、不ACK。transport只核当前认证/序列/AEAD和frame shape，禁止自己调用Store或写SQL。
2. 正常acceptReply先按原AwaitingReply核requestSequence/permitSequence/token。send在原waiter中携一个调用期validator，捕获原permit/command/binding，用现有Node宿主browser-command-postcondition.ts中的verifyNormalBrowserMutationReply调用共享纯decoder，核raw result/error与同一terminal projection；原7字段packet先经共享binder再decoder，完成后才进入onMutationReceipt。不增加reply map/队列；该上下文随原waiter释放，绝不跨连接恢复。普通非mutation仍走原reply，不调用结算callback。
3. 重连MUTATION_RECEIPT的fact经当前认证解析后直接进入同一onMutationReceipt，不找旧waiter、不创建lease/旧Actor、不检查旧Target是否仍活着。唯一Store结算函数为BrowserMutationStore.settleTerminalReceipt(fact)，同步调用现有browser-mutation-receipt.ts内的verifyBrowserMutationTerminalFact核原WAL identity投影、receiptHash、字段闭集/合法组合、Child/输入计数与submit locator约束，再在原Store事务内CAS并读回。补交只接纳原执行端已形成的可信投影，不从当前代码重建旧Prompt/动作。
4. Supervisor在同一调用内取得Store已提交且读回一致的fact，仅本次真实CAS成功时尝试WAL terminal事件；Store返回原fact及本次CAS是否新提交的调用期返回值，不持久化该返回标记。日志正常且原runtimeLogger.isWritable()仍为true：调用acknowledge(committedFact)，发送成功后notifyMutationSettled()触发已有private pump，callback返回fact后transport才resolve/reject原waiter。日志写入失败或原logger已不可写：捕获原精确log failure，仍调用acknowledge确认已持久化fact；不notify、不pump、不让原live调用继续业务，ACK发送后抛回原log failure由transport撤权/关闭。原logger.isWritable/getSinkState及runtime-loops.ts:79,239是已有新claim门，不新增logFailed布尔或第二gate；ACK成功不能清除logger失败状态。重复同proof不发第二terminal事件，仍ACK；logger未恢复时同样不notify且撤权。ACK本身失败则保留原槽、原WAL不变、transport关闭，下一READY只补ACK；同时保留原日志根因和交付原因，不用后者覆盖前者。未曾成功提交/读回的fact仍绝不ACK。不调用lane.reset、不清其它waiter、不造旧span。
5. acknowledge是transport提供的单次调用期闭包，只能对该已认证消息的同一socket/session、该command/binding/hash发ACK；不暴露原始socket或页面权限、不持久化、不在旧连接上失败后偷换到新连接。原WebSocket Owner完成加密/序列/send；连接已变或发送失败则抛错进入其现有revoke/close，实际close必须在清理finally中完成，不能再依赖日志成功。正常和补交都遵守WAL commit/readback→尝试日志→ACK；仅日志健康才通知lane。日志故障立即由原logger关未来动作，撤权不得抢在旧fact的ACK尝试前切断通道；当前SENT回执/ACK/只读清理不得被新claim门拒绝，也不授任何新输入。

Actor的completeMutation不再写terminal，只消费已提交fact、绑定业务返回值并按真实结果结束原live span；command-failure删除从裸errorCode或raw result hash推断terminal的两个markRejected分支。当前grant/lease/Target失效可以阻止业务消费，却不能撤销已发生机械事实。terminal事件只有上述Supervisor一次提交路径写入，避免Actor和补交各记一遍。

Store.markConfirmed、markRejected、旧resolve及Actor.resolveDispatchedMutation、lease.resolvePendingMutation和browser-outcome-resolver.ts的旧类型/实现，在W2同工单物理删除；所有相关fixture迁移到完整fact经唯一settleTerminalReceipt构造原事实，保留各原正反断言，GPT fake lease也删除旧resolvePendingMutation字段。mutation-settlement及mutation-atomicity inspector不再要求Actor直接mark或旧resolver文件，改为追同一个Supervisor/Store入口并验证原WAL/无caller proof/无Target恢复；不能只删除旧requireText而失去保护。PREPARED/markDispatched/markFailedBeforeDispatch/markReceiptMissing仍由现役原路径负责。pendingMutationCount等当前lease消费者按原WAL读回已终态命令，不把补交前缓存的command列表继续当未决真相；不新增第二台账。

原行仍DISPATCHED时，唯一settleTerminalReceipt只允许一次事务转CONFIRMED/REJECTED，完整写真实输入事实、原completedAt为terminal_at、proof、failure/native cause，以及confirmed submit加密locator，并读回一致才返回。既有state已terminal且相同proof/字段时仅返回同一fact供ACK，不重写时间/计数/payload；不同proof、缺行或矛盾拒绝、不重建。不得只改state/proof而漏输入/locator。

WAL提交或读回失败，不ACK、不notify、不释放Extension槽，callback抛出原精确失败，transport复用现有revoke/close断开本连接；下一次既有auto-pairing READY触发重交。ACK发送失败也断开当前连接：WAL已提交保持不可变，下一READY相同fact只ACK。日志失败单独处理：已commit仍尝试ACK清槽，禁止notify与后续输入/claim，再撤权关闭；ACK也失败才留槽等下一READY，logger仍失败时补ACK也不pump。认证receipt控制消息与原清理继续，不把日志健康变成旧fact持久签收门。不允许保持同一READY已交付标记却永远无ACK；不新增timer/重试计数/循环/第二reconnect Owner。身份或记录冲突仍不ACK/覆盖，不得借重连变成成功；由原Owner精确报告阻断。

WAL机械结算与业务permit有效性分开：当前业务授权失效不抹除原命令已发生的真实事实，却必须禁止继续旧业务操作。正常REPLY与补交竞态通过同一CAS与相同proof收敛；已结算同事实不能再次transition或抛伪STATE_CONFLICT。

原send失败的catch与补交也可能竞争：markReceiptMissing只能更新仍DISPATCHED的同一行；补交先结算时，catch必须读回原terminal并保留，不再次写missing或产生伪STATE_CONFLICT。原RPC确实失败可以按原调用交付错误封口，不能据此改已结算机械事实；已经reject的旧Promise不会因补交复活，恢复走当前合法claim。此规则同样覆盖先标missing、后真实terminal到达的顺序。

ACK发送成功且原logger健康后，原lane重读唯一WAL并pump；日志失败时ACK只清槽，绝不notify/pump，原transport撤权。Extension按同一消息顺序先验证ACK/清槽再接后续COMMAND，且旧handler释放未完成时仍拒绝新动作。ACK发送失败不主动pump，原transport及时撤权；新READY重交只在原logger健康、既有业务与动作许可有效时通知。补交控制消息不能等页面acquire；全局prepare事务门仍拒绝任何未决新输入。正常等待者只在原期限/当前grant有效时继续，过期者停止；不能以ACK代替已有授权或解除日志故障。

### 4.4 接回业务的实际边界

原live Child可在执行授权有效时继续下一步；真实rejected沿现役typed失败。主进程重启或lease/fence变化只恢复WAL，不补造旧Promise/旧span成功。

恢复claim仍走 Website fresh readback→durable accept→Runtime恢复门→原Product。CONFIRMED Provider effect只读原URL/轮次，不重跑准备或submit；旧target-local confirmed不作为新Target准备凭据，现役Child重新判断当前状态。

若已持久首条 DISPATCHED-associated attempt failure，且现役分类仍fail_closed：保留immutable first fact，精确报 PRODUCTION_SOURCE_HANDOFF_REQUIRED，接回现役source handoff/Website grant；没有现役合法授权不运行Product、不改first fact、不自签新attempt。本分支不得被描述为“补回WAL即可自动恢复业务”。本方案不新增该业务策略或Website合同。

## 5. 有限分母与终态

identity spine：原commandId/binding→原WAL业务调用/effect→Website job/accepted attempt/revision→原Outbox/admission；Target只属于当前动作。

| 分支 | Owner、输出与readback | 恢复 |
|---|---|---|
| PREPARED未发送即重启 | 原WAL现役FAILED/no | 原许可链 |
| 原handler/CDP/barrier尚未收束 | Extension在途事实，WAL未决 | 等真实结束，不用超时伪终态 |
| 真实零输入拒绝 | 原REJECTED/no/native cause | 现役Runtime/Website失败链 |
| 成功但REPLY未到 | 原槽→WAL完整CONFIRMED | 原live调用或合法恢复claim |
| 输入发生、后置失败 | REJECTED+真实输入/原因 | 现役失败策略，submit不重发 |
| handler可信终止、输入仍可能发生 | REJECTED+dispatched；计数不作零输入证明 | Provider只零submit对账，局部动作走现役失败策略 |
| WAL提交失败或读回不等 | Store抛精确错误、无ACK/notify、槽保留；transport关闭本连接 | 原auto-pairing下一READY补交，无新timer |
| WAL已提交、ack发送失败/连接中断 | terminal immutable、槽保留、当前transport撤权 | 下一READY相同proof只ack；发送成功且logger健康才通知原lane |
| WAL已提交、现役日志写入失败 | 原日志门立即禁止新claim/input；仍ACK已commit fact清槽；不notify，随后transport撤权/关闭 | ACK也失败才保留槽，下一READY只ACK；logger故障仍阻断pump，不伪造旧日志/span |
| 身份/hash/结果冲突或缺行 | 精确RECONCILIATION_IDENTITY_MISMATCH/STATE_CONFLICT/RECORD_MISSING | 不ack/覆盖/重建，不输入 |
| Chrome未退出但worker重启/reload、无槽或命令未收到 | RECEIPT_MISSING+原command身份；WAL仍未决 | 原Owner阻断，不声称未执行，不从时长/新页面伪结算 |
| WAL解锁、旧首条业务failure阻断 | Runtime SOURCE_HANDOFF_REQUIRED、Website授权readback | 原source handoff门，不自签续跑 |
| Website撤权、已完成或租约过期 | 旧机械事实仍可结算，业务动作不允许 | 现役Website权威/已有结果优先交付 |

最终业务验证取有合法当前grant且现役consumer允许的可恢复分支，终点为Website admission与领域对象durable readback；其余分支须精确阻断，不以“所有DISPATCHED都必须继续”制造成功。

## 6. 原子工单

### W0：法案载荷许可与施工图先对齐

Owner：local-browser-session。授权人已明确授权本次必要法案修改，Browser-006 已由 V43 升为 V44，许可本次 terminal projection/ACK。只加入原worker实例仍有原可信terminal时经当前认证连接补交、Supervisor装配唯一verifier/Store结算、commit后ACK、零新输入权；Browser-004-V56若需升版，只明确同一settleTerminalReceipt与terminal事实，不放宽global gate。Architecture-002-V2、GPT/Website attempt/risk边界不改。

精确同步现役Browser Blueprint；registry由原parser/generator计算版本依赖闭包，不手改，不沿用旧方案版本表。完成门：law/Blueprint/protocol/test对窄合同一致。本次授权及两轮主 Codex 权威核对已完成，不以历史 W0 阻断代替当前事实；若需改Target冻结、Website业务合同或恢复策略，重开设计，不扩大本工单。

### W1：原Extension保存终态、诊断不阻断回执

Owner：local-browser-session Extension。允许chrome-extension的websocket-actor、extension-command-runtime、extension-target-authority、extension-interaction-readiness、debugger-runtime、dom-intent-runtime、dom-pointer-intent-runtime、dom-mutation-postcondition、extension-file-input-runtime及gpt-rate-limit-dialog中原输入/后置guard的直接同步，配合既有纯receipt decoder；command-permit-validator只读核真，不放宽MAC/当前authority许可。manifest/service-worker/pairing-auto-bootstrap仅作生命周期核真与验收绑定，本轮不加storage权限、不改一分钟alarm、不引入session storage/磁盘或保活策略。

顺序：断线立即撤所有未来输入/新admission→原handler仅收束已发CDP/2.5秒barrier与有界后置只读→固定唯一terminal projection入槽→原handler退出→release activeTarget→原READY补交/保留至ACK。handler固定后可在已READY的新连接交付，释放不等待ACK；新READY不得在旧handler/释放未结束时启动新Target。close、onSocketClosed与错误cleanup统一遵守此顺序；同handler不能await自身，断线guard不能因为新session而重新有效。diagnostic不能覆盖事实；输入资格不放宽、后置guard仍守原Document/现实/读取界限。无法证明后置则REJECTED+dispatched+已知计数，不伪造no或CONFIRMED。worker真正终止/reload则槽消失，本工单只能报告缺原事实；保留debugger不授予旧Target恢复资格。

Actor当前457行，executeCommand约67行，先把受影响命令执行/terminal职责移入已有extension-command-runtime；Actor只保留socket/槽，不增加class/service。dom-pointer-intent-runtime当前474行：用已有callback参数位置承载调用期输入/只读两种guard，不再追加第8参数，不新增转发wrapper；删除统一guard的重复收尾断言，原位复用dom-mutation-postcondition的现有读取函数承载只读核验。原生红线为文件500行、函数75行/7参数/8return/10await/5层嵌套/圈复杂度16；由现役code-purity检查，不新增预算。共享纯投影不得把Node-only crypto/import带进Extension bundle；各宿主复用已有SHA-256能力。完成门：立即撤输入权、低层CDP逐次禁止新增输入，原handler完成及projection固定前不释放activeTarget；真实Target丢失/超界产生精确拒绝；诊断失败不阻断；未收束无terminal；第二mutation不能覆盖。失败时保留槽/WAL，不构造成功或no。

### W2：同一控制通道、完整原WAL结算与lane唤醒

Owner：local-browser-session Browser/transport。允许protocol/browser-protocol.schema.json及原generator/generated；transport的frame-codec/frame-payload/websocket；exact-target的command-actor/command-postcondition/mutation-receipt/special-mutation-receipt/observation-receipt/submit-recovery-payload/outcome-resolver/mutation-store及直接类型；infrastructure-supervisor/lane-coordinator；本方案列明的mutation-settlement/mutation-atomicity/target-claim inspector、三个Store fixture/acceptance、local-browser-mutation-receipt-support及GPT fake lease的直接同步调整。WebCrypto接线只在原websocket-actor-crypto内必要调整，不建crypto adapter或第二hash算法。

施工顺序冻结：纯binding投影/terminal verifier与原Store.settleTerminalReceipt→Supervisor.settleMutationTerminal及onMutationReceipt装配→transport两入口共用callback/ACK闭包→lane.notifyMutationSettled→Actor/failure消费已结算fact、退休旧direct writer/resolve链→同步protocol7→8及相关验收。无旧reader/union/兼容flag；补交零页面权限，不放宽acquisition/prepare gate。启动/停机边界仅核state.started及原Store可用，不恢复旧Actor。

WebSocket当前497行、CommandActor461行、Store463行：Node normal raw verifier放原command-postcondition，窄payload解析放原frame-payload，不堆在transport；Actor删除旧completeMutation里的直接写入和约21行resolve；Store删除markConfirmed/markRejected/resolve约54行后承载唯一事务入口，不保留转发兼容壳。Supervisor345行承载原装配回调，lane仅加窄通知，不新增状态字段。现有observation-receipt99行承载唯一binding投影、共享wire type、纯packet binder及原机械packet验证；mutation-receipt433行先移共享packet验证再承载terminal projection/verifyBrowserMutationTerminalFact。Extension命令收尾复用extension-command-runtime48行。相关legacy fixture及现役inspector同步改为完整fact/唯一入口验证，不删除保护性语义来通过预算。

纯decoder的实际依赖必须在同工单收口：当前mutation-receipt运行时import special-mutation-receipt，后者含node:crypto，不能只凭前者无Node import就称可共享。将special内knownRateLimitBlockerReceiptValid、unrecognizedGptDialogReceiptValid及机械receipt predicate原位移入observation-receipt，复用原browser-gpt-rate-limit-preflight的shape/固定数组定义；Node预检/哈希宿主仍在原special/command-postcondition。decodeBrowserMutationReceipt统一增加第三个必填参数preflightObservationHash（宿主从原fact固定数组实际算出的hash；非该special receipt为null），纯predicate核shape和声明observationHash与该实际hash相等，不能从输入直接抄声明值。Node使用原createHash、Extension用原websocket-actor-crypto中的WebCrypto能力在收尾前算该固定hash，再调用同一纯decoder；不新增adapter，不改变限流事故identity/hash算法。不保留旧二参数兼容或转发export；直接调用方、Node预检和receipt-support正反验收同步更新。共享decoder闭包不再运行时import special/command-postcondition/其它Node宿主，纯type import可保留；打包与负例验证必须证明Node依赖零且伪hash仍拒绝。

完成门：两条入口实际调用同一Supervisor/Store函数；无原Actor/Target仍可接纳原fact；normal raw/projection冲突在提交前拒绝；完整原子写计数/原因/locator/terminal；重复fact只ACK；写入或ACK失败关闭当前连接、下一READY重交；已commit日志失败仍ACK、不notify/不pump、随后撤权，logger恢复前重复ACK也不开放新动作/claim。src及相关验收中的旧resolvePendingMutation/resolveDispatchedMutation/BrowserOutcomeResolutionReceipt/Store旧terminal methods物理零残留。身份或记录冲突停止、不ACK、不改历史；读取pendingMutationCount不得受已结算缓存阻塞。

### W3：精确诊断及consumer防回归

Owner：runtime-log-spine表达事实；Runtime/Website保留业务门。允许command-failure、command-runtime-logging、runtime-logs/diagnosis及对应现役Browser/Runtime/Log acceptance/inspector；不改Website生产源码、first-fact存储或业务状态机。

DISPATCHED仅过程事件；missing receipt报告原command/现役authorityRef/hash/原因，不冒充动作失败。旧开放span仍INTERRUPTED/PRODUCER_STALE/DIAGNOSIS_INCOMPLETE，旧封口span不写第二terminal；新进程只记录真实WAL结算事件。pendingReceipt参数若不参与合法现役表达，删除参数与调用，不新增重复布尔状态。

完成门：区分回执缺失、真实命令拒绝、业务source handoff阻断；不补造span；WAL解锁不绕过firstFact/grant；可恢复对照组到达原Product/Outbox，阻断组零新输入。

顺序：W0→W1/W2同一CHANGE同步→W3及全部相关验收。主 Codex 唯一施工，子智能体只读审查。

## 7. 验收、部署与回退

优先复用现役local-browser-terminal-rejection-support、local-runtime-browser-authority、local-browser-mutation-receipt-support、local-browser-mutation-store-support、local-browser-target-lifecycle-support、browser-lane-fifo、agent-production-runtime及runtime-log-spine-failure-matrix acceptance；既有Browser inspector补窄合同/零旁路，不建runner/manifest/verdict。runtime-logs/logger与runtime-loops仅核既有失败状态/claim门，不新增logger或修改日志法案来适配旧错误方案。

必须故障注入：

1. PREPARED停机与markDispatched后send失败分开；后者不伪报零输入。
2. 动作成功后、活性检查或REPLY前断线：原projection保留，重连零动作补交。断线发生于CDP未返回、刚返回但2.5秒未满、barrier刚满/后置读取未完三个位置，均先撤新输入/admission，handler结束及projection固定前activeTarget不得被close/onSocketClosed/错误cleanup清除。
3. rejected/native cause保留；DIAGNOSTIC抛错不阻断terminal。
4. 原CDP/barrier未结束不terminal/放行；真正结束后才补交；原输入已开始却抛错不得生成no。断线发生于mousePressed后mouseReleased前、fill清空后insertText前、file chooser打开后setFileInputFiles前，未发出的后半段也必须禁止；原只读后置若能完整核实才confirmed，不能核实则REJECTED+dispatched+已知逻辑计数/原原因；started不冒充计数。撤权发生于输入前的可信零输入组才REJECTED/no。
5. Browser重启但原worker实例/原槽存活：经新READY→原transport callback→Supervisor→唯一Store结算，无原lease Actor/Promise/Target也成功接纳；重复fact无第二WAL事件。
6. Chrome继续运行但MV3 worker真正停止/重建或扩展reload：原槽确实丢失，仍DISPATCHED/RECEIPT_MISSING，全局新输入零；不以fake timer模拟worker死亡，不把alarm唤醒当恢复旧事实。
7. WAL提交前crash、提交后ack前crash；重复fact/ack不重写时间、计数、payload；原send catch与补交两种先后次序都不产生伪STATE_CONFLICT，不改回missing，不复活旧Promise。
8. binding/scope/hash/计数/null组合/unknown field/result冲突拒绝，原行不变；每类原command/Child独立验证0/1合法组合与2/3/4伪计数拒绝，正常REPLY和补交均拒绝，不把wire存储上限当动作许可。
9. submit确认补交同步写locator/计数；恢复只readback，submit累计≤1，不只测菜单。
10. 未ack槽不被第二mutation覆盖；READY/handler同时触发只交一次；异步加密不会乱序发送；ack与下一COMMAND入场顺序确定；重复旧ack不清新槽。原handler未退出或旧Target释放未完成时，新READY/TARGET_ACQUIRE/COMMAND不能创建、激活或输入；允许receipt控制消息。断线清理不等待ACK、不await handler自身，重复close/onSocketClosed不得清除新Target或重复放行。
11. WAL解锁但首条failure仍fail_closed：SOURCE_HANDOFF_REQUIRED、零Product；合法恢复对照组进入原主链。
12. 附件OR、候选唯一性、once-input、1.5秒访问门和2.5秒fresh门不回退。
13. DISPATCHED不进入failure code，不补造旧spanterminal；Browser终态不等于Website completed。
14. Node/Extension纯binder、decoder与projection对原七字段raw packet生成相同proof；实际Extension打包验证无Node-only传递依赖；special preflight的宿主实际hash不等于声明hash必须拒绝，不得改成只核shape。完整normal/error REPLY parser同步，非mutation receipt为null，mutation无可信projection不得结算。
15. 原permit/动作资格拒绝发生于输入前：已绑定原command也必须形成REJECTED/no回执；完整身份无法绑定时不伪造。binding仅来自唯一现役identity投影；ordinal/action/grant及18字段每项漂移、顺序漂移均拒绝，Target/Document变化不变成恢复资格，Extension不重拼字段。
16. normal成功/异常REPLY与reconnect fact穿过同一个onMutationReceipt、Supervisor.settleMutationTerminal、Store.settleTerminalReceipt；对同一fact两路proof和所有落盘字段一致，恶意raw/projection不等在写入前失败。transport直写SQL、Actor/failure自行terminal、旧resolve旁路的mutant都必须拒绝。
17. Store提交失败/读回失败：无ACK/notify，关闭当前连接、槽保留，下一READY重交。提交后log-spine写入失败单列：同一已认证连接仍ACK已commit fact、Extension清槽，无notify/pump、新COMMAND或claim，随后撤权/close；ACK也失败则槽保留，下一READY相同proof只ACK且logger仍failed时仍不notify。重复fact不重写已提交时间/计数/payload，不伪造terminal日志；logger不可写不得把旧fact确认挡在认证/控制帧入口，ACK成功也不清原logger失败状态。ACK/close故障与原日志根因均保留；实际close不依赖再次写日志。日志健康对照组ACK后原lane继续，pendingMutationCount无幽灵未决。
18. 生命周期实证分两组：原worker/槽持续存在的断线补交，以及Chrome仍开着但worker已真实终止的缺事实阻断；原debugger active与detach条件分别记录，不把8分钟或30秒阈值当worker生死证明。真实Chrome实证另需动态授权；静态/mock验收不得冒充真实MV3生命周期证明。

当前施工使用 Node24 执行定向 acceptance/typecheck 与 Extension build；这些仅为局部验证。最终按冻结 ci-full-governance 连续执行唯一 quality:check 的 CHANGE→READY→RELEASE，实际阻断如实报告。READY/RELEASE另按原生clean commit、active law Dynamic Proof与授权执行，不引用主AI自审作为质量证明。

协议切换前停新claim，原handler/CDP/barrier收束、WAL无未决DISPATCHED、所有槽ack清空。不能靠重启丢槽满足排空。当前事故记录由授权人侧删除处置，部署前只读核验该处置和剩余分母，不由本次代码抢救、回填或清理。若仍有其它协议7存量未决，部署保持阻断。本机制只保障启用后确实进入槽的命令；生产实证使用另行获授权的新测试job，不复用当前删除工单。

同一停写窗口更新AGENT与固定Extension产物，双方revision/build一致才恢复claim，不留7/8兼容。失败保持停写；回退只含本次授权commit/产物，保留WAL。若已存在协议8未确认槽，先按8结算原事实，不能先回退/reload销毁唯一内存证据；若worker已终止事实丢失则保持阻断，不能为了部署回填terminal或扩大到第二存储。

## 8. 删除反事实与设计阶段三轮复审（历史，不替代施工审计）

| 结构 | 删除后的真实失败/消费者 | 裁决 |
|---|---|---|
| 原Actor内单内存槽 | 断线真实结果消失，Browser无法取得原terminal | 必要，有界无磁盘 |
| 单fact/ack控制frame | 新进程无旧reply waiter，无法结算/确认 | 必要，复用认证通道，零页面权限 |
| Supervisor原装配回调+Store唯一settleTerminalReceipt | 重连没有旧Actor，或normal/reconnect产生两套成功算法 | 必要，复用原Owner，无新服务；旧writer/resolve同工单删除 |
| 唯一binding纯投影 | 多端手写字段漂移，错误匹配原命令 | 必要，只投影现役identity；Extension只回传，无第二身份 |
| 原handler收尾后才释放Target | 先释放会杀后置事实；放宽统一guard又会产生失效输入 | 必要，复用pending集合/started与低层输入门，只分开输入和只读职责，不保存旧Target |
| 交付失败关闭当前连接 | 同READY交过却无ACK，纯槽永远占用 | 必要，复用原revoke/auto-pairing；日志失败先ACK已commit事实再close，无第二retry Owner |
| 原logger失败门与旧fact ACK分开 | 扣押已SENT确认或日志故障继续新动作 | 必要，复用isWritable/getSinkState，ACK不授业务续跑，无新状态 |
| 新manager/队列/timer/registry | 原handler结束/READY已提供触发 | 删除 |
| session storage/磁盘receipt journal/第二WAL/新增保活 | 为跨worker实例恢复扩大存储或运行面 | 本轮排除，原worker丢失明确阻断，不偷增覆盖 |
| 旧Target/fence失效即结算 | 没有原可信terminal，复活已撤回机制 | 禁止，旧工单已删除 |
| 新页面推断历史成功、回URL重发 | DOM不证明历史命令，可能重复提交 | 禁止 |
| 覆盖first failure强行续跑 | 破坏immutable fact与Website授权 | 禁止，保留source handoff门 |

### 第一轮：装配Owner与唯一结算入口复审

本轮主AI沿onSocketClosed/close→releaseActiveTarget→interaction activeTarget→原CDP/postcondition反查，确认前轮只写了原则却漏掉真实释放顺序。§4.1/W1与验收2、4、10冻结先撤新输入、原handler有界只读收尾、固定槽、再释放；每个低层输入仍核原session/permit/deadline。复用pendingCommandHandlers/awaitOldCommandHandlers/ProviderInputState.started，禁止自身等待、等待ACK才释放或新READY先取得Target。机械计数不由started/default推断，真实Document丢失不强凑confirmed；零输入、一次输入、barrier不变量不变。

### 第二轮：身份投影、ACK及失败竞态复审

本轮主AI按LAW-RUNTIME-LOG-SPINE-001-V7:1216核对原logger.isWritable/getSinkState与Runtime claim门，确认前轮“commit后日志失败不ACK”是法案冲突，已在§4.3/分母/W2/验收17物理替换。WAL提交/读回失败不ACK；日志失败仍ACK已commit fact、清槽但不notify/claim/input，随后撤权；ACK也失败才下一READY补ACK，logger仍failed不pump。重复fact不重写WAL或补造日志；close不依赖日志成功。binding投影、唯一settlement、原Store CAS保持，没有新日志gate状态、Owner或第二成功算法。

### 第三轮：MV3边界、业务终点与删除反事实复审

本轮主AI复核MV3原worker/槽存活边界、唯一投影/原WAL/normal与reconnect同入口、Website immutable firstFact和合法grant、confirmed locator零submit读回。前轮69源码指纹未漂移，仅补9个输入guard/日志门/生命周期真实依赖形成78文件；W1在已有文件参数位置分开guard，W2不增加日志状态或计数registry，当时 W0 未授权仍阻断（本次已取得授权）。Website本地main与origin/main分别绑定，相关consumer无提交差异，未知云审计commit不冒称验证；工作区八字Blueprint overlay不触碰。验收1—18分别覆盖两个新故障及原不变量，主AI未在本次有限反查再发现需新增结构的设计缺口；此自审不构成原生质量或生产PASS，当时仍须 W0 授权和独立施工验证；当前授权已取得，施工验证尚未完成。

施工Codex重读本文件、AGENTS、上述authority/Blueprint/协议与dirty状态，复核candidate及W0授权。任一可恢复分支缺原writer事实、consumer/readback或现役验收落点，必须失败关闭并重开设计。
