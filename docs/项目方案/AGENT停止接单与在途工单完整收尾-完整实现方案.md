---
document_type: project_scheme
scheme_id: AGENT_STOP_ADMISSION_AND_FINISH_ACCEPTED_JOBS
status: 代码建设完成，待原生质检
owner_repo: /Users/nexgen/Documents/AGENT
primary_owner: startup-entrypoint
updated_at: 2026-10-10
candidate_branch: main
---

# AGENT停止接单与在途工单完整收尾－完整实现方案

## 1. 当前授权、收益与边界

授权人已再次批准本仓施工，并明确不动网站派单。本方案替换此前要求网站专用恢复claim的设计；只在本仓main建设。母本、公共Skill、跨仓合同、Product及数据库结构不改；不删除生产工单、不动网站数据库。主Codex施工，子智能体只审实际建设。授权人随后明确要求“dom改动你合并一起提交-ready”：将已建设的《GPT附件入口OR精确迭代-完整实现方案》差异与本方案一起提交并执行READY；两份方案各自保持唯一职责，没有新的联合方案、Owner或运行链。

第一次Ctrl+C立即关掉新claim资格，包括迟到初始化、blocked重试及等待heartbeat的claim。以物理HTTP发送为边界：停止前已经发出的领取请求不能假装取消，其合法响应中的任务纳入原链收尾。停止后禁止新/恢复生产grant；W5唯一例外为已封存旧source经原claim运输，须真实draining、空delivery_candidates及Website零grant回执。

结束对象是每张已领取Agent任务对应的一个独立成果步骤。SEO、审核或翻译一步被网站精确接纳即可；不等待网站未领取的后继步骤，不因某一张成功抛下其它已领取任务。AGENT成功唯一沿现役LAW-AGENT-PRODUCTION-RUNTIME-004的完整接收回执、原结果hash及本地complete读回；网站领域成功仍由原Owner裁决；HTTP200、GPT答案或Promise结束不构成业务成功。

失败与未决分开。真实失败保留原first fact，并从原status GET核对同身份release receipt或attempt failure；不取消需求、不签新attempt。缺admission、失败读回不匹配、Browser原WAL仍DISPATCHED、冷却未结清、session close不明或资源关闭失败都必须保留原记录并非零退出，不能报告完整退出成功。下一次启动沿原worker/claim恢复；原本存在的未决仍可能挡住新输入，不能通过清WAL或unknown改no掩盖。已确认失败且原Browser终态齐全时，不会由停止制造新的全局未决。

在途任务使用现役执行、renew、回读、Outbox、admission及既有有界操作；不对activeAbort发停机abort，不新增总超时/强杀。失败恢复必须重新claim时，停机阶段不能完成恢复，诚实异常收尾；未结清provider_cooldown保留原Website session，不close、不报告成功。异常退出不是业务终结或放弃需求，不清除恢复记录，不强制制造任务失败。

收益：消除主动中断、五秒强杀和迟到初始化；真实成果可以完成交付。风险：正在执行的任务可能耗时，外部故障仍可能产生异常退出和下一轮恢复；网站派单不变意味着不能承诺停机阶段完成需要新grant的恢复。

## 2. 权威与根因

本轮主Codex已全文遍历基础法案、功能法案和七份现役施工图；闭环Skill已完整遍历两遍。冻结索引已激活。母本§0/4/35、22/23、36–39、46/47、58–63、72/79适用；仅修改必要施工图，不新增法案或治理文件。

直属法案：Runtime001-V75持续需求/冷却保护、004-V44领域接纳、005-V42唯一三表、006-V46精确删除、008-V47原生证据；Browser003-V45唯一lane、004-V56未知不重放、006-V45原终态/WAL读回/ACK；Startup001/002-V4只管理本仓进程；LocalApp001-V6独立诊断Shell；RuntimeLog001-V7/003-V6真实封口；CODE-PURITY001-V6/002-V2/003-V3结构预算及存在性证明。冻结语义与字节不改。

旧链实证：launcher经npm/tsx CLI包装实际App，五秒后强杀进程组；App两种once信号重复关闭；Workbench先清空对象再等关闭、init重置停止意图；Runtime停机abort所有active且忽略allSettled错误；Browser stop没有关闭真实鉴权socket。旧READY不能证明这些控制安全。

现役网站V44依赖不变。session close回复丢失没有可靠重查，本轮不假造回执、不盲重试close、不改网站合同，异常必须可见。

## 3. 唯一新链

1. launcher直接管理`process.execPath --import tsx src/app/server.ts`。spawn立即缓存started/closed Promise，先发布handle再await。每个preflight后检查停止；停止后不spawn、不打开页面。信号只转发一次，重复信号等同一Promise，无进程组、无SIGKILL。只有实际子进程code0且没有signal才成功。
2. App先启动唯一HTTP诊断Shell再init；SIGINT/SIGTERM共享关闭Promise。立即调用Workbench shutdown，最后关闭原HTTP资源；正常成功才code0。
3. Workbench单个进程内stop AbortSignal只表达停接单，绝不传给Product。init不得复活；shutdown等待进行中的init与blocked重试，迟到Runtime也唯一close。资源引用保持至关闭完成。HTTP关闭回调由唯一App提供；Browser和HTTP关闭后才写producer最终停止事件，没有新增Owner。
4. Runtime close同步draining；等待原worker当前iteration（含迟到已发送claim响应），再等原active Promise。原worker继续原reconciliation但不再claim。WorkerSession在原claim的fetch前核drain_state，关闭排队heartbeat后的迟到发送。iteration Promise只用于关闭协调，不持久化、不决定业务。
5. active结束后等原iteration，先用原admission函数核尚待接纳的结果，再等待有限原worker轮次清理已完成及可能在最后轮次接纳的Target；分母为待清理与待admission的job并集，至少一轮。随后停循环与heartbeat，最后核对只读，不得再创建cleanup。核现役Store结果、同身份失败读回、原Browser未决、Outbox与冷却；保留全部异常事实及原故障cause/Owner，不制造第二阻断根。正常无未决且session关闭确认才Runtime成功，数据库实际关闭后返回。
6. Browser stop在原调用链结束后关闭同一WebSocket的active/pending socket并关闭其接入资格；workspace/lane/WAL/owner lock各项均尝试关闭，最后聚合失败。App在唯一HTTP Listener的connection事件登记进程内Socket关闭Promise，包含101后尚未HELLO者，最后停止Listener并关闭、等候全部实际连接。原receipt→WAL commit/readback→ACK不改，unknown原样保留，绝不改终态或清记录。

## 4. 删除范围与复用裁决

| 文件/片区 | 动作 | 必须保留的独立职责及真实消费者 |
| --- | --- | --- |
| service-process.mjs | 整文件删除→缺失→新建实际Node生命周期 | 唯一launcher消费；旧npm/preStart、迟装exit监听、五秒强杀全部消失 |
| launch-grasseye.mjs的startService、退出控制、performLaunch、main | 删除这些函数→缺失→新建 | 合同/依赖/端口/artifact/健康/开页独立函数保留，唯一launcher调用且Startup法案要求 |
| startup-main-support.mjs的registerSignalHandlers | 删除→缺失→新建 | parseFlags由launcher真实消费update/no-open，保留 |
| src/app/server.ts | 整文件删除→缺失→新建 | 原HTTP factory直接复用，唯一Listener；去掉冗余同名wrapper，保留诊断合同 |
| workbench.ts的init/initializeOnce/retryBlockedRuntime/shutdown | 删除→缺失→新建 | 现役handle/status/API映射、blocked调度保留；唯一App消费；资源及初始化需同一close |
| workbench-handle.ts | 局部合同修改 | 仅App传HTTP资源关闭回调，没有新外部接口 |
| runtime-startup.ts的finishShutdown/shutdownRuntime/createRuntimeHandle | 删除→缺失→新建 | 原Store预检、credential、session open、blocked诊断及Executor构成保留，真实startup/健康消费者不可删除；stopSignal及状态绑定为局部修改 |
| runtime-startup.ts的closeBlockedStore/blockedRuntimeHandle关闭 | 局部修改 | 现役blocked重试需要关闭旧库再接续，不得取消；只有现役stopSignal表达停机或独立调用者关闭时核待处理分母并非零，不联网、不改记录 |
| runtime-loops.ts、runtime-state.ts | 局部修改 | 原worker与bounded catch、reconciliation、合法claim/late grant原链保留；iteration仅worker写、shutdown读 |
| worker-session.ts的request | 删除→缺失→新建 | 原鉴权、heartbeat/open/close/序列保留；request唯一HTTP出口必须在发送前关claim |
| Browser supervisor的stop | 删除→缺失→新建 | 原receipt/WAL/ACK/broker/lane由真实任务消费，保持唯一来源 |
| browser-authority-websocket.ts | 局部增加close及关闭后拒绝接入 | 仅supervisor关闭原socket；复用唯一连接清理，不调用故障revoke，不复制terminal协议 |
| 原Startup/Runtime acceptance的旧停机验收 | 删除旧断言后更新 | 原生quality既有入口真实消费，不新增verdict/报告 |
| runtime-startup.ts的inspectDrainedTasks | 删除整个核验函数→AST缺席→重建 | 缺本地行的领取分母、同身份失败读回、未决资源分别核验；原status/失败匹配模块直接复用，不改成功定义。失败状态已匹配仍必须先核原release receipt，重复同request_id回执保留原冲突，不得短路成普通失败 |
| worker-loop-inspection.ts的workerLoopStopViolations | 删除整个控制验证函数→AST缺席→重建 | 同一Runtime inspector消费，保留原abort-only循环、异常后有界等待及全部退出反例；私有停止动作识别不产生第二checker |
| 原Runtime fixtures及session-rotation-support | 局部测试修改 | 两个现役验收消费者使用完整typed Runtime夹具和真实Store/session/Executor/rate-control；未参与场景的Browser调用必须throw，禁止用类型逃逸假装完整对象。现役shutdown验收统一执行active/迟到claim、最终admission和失败场景，startup原producer仍只调用一次 |

没有复用旧shutdown。保留模块直接使用原文件，禁止复制、改名、Git/临时文件恢复、兼容桥。整文件与函数片区分别实证缺失后建设；汇报如实区分重建、保留、局部修改。

## 5. 有限验收与两遍主审

R01 Agent/main边界；R02冻结母本/法案/Skill；R03新/恢复生产claim物理发送立即停止、W5已封存source运输只接零grant；R04已发送claim合法响应收尾；R05activeAbort不被停机中断；R06逐张成果完整接收回执（网站领域完成另裁）；R07失败同身份读回；R08unknown/冷却/Outbox/session不明非零且记录保留；R09冷却原session不close；R10实际子进程/缓存exit/无强杀；R11重复信号同Promise；R12迟到init/retry收敛；R13HTTP/socket/数据库/锁关闭与最终producer事件；R14独立诊断Shell；R15没有第二恢复/存储/合同/Owner；R16删除缺失建设实证；R17结构预算与既有测试不退；R18建设后主审两遍、子审实际diff与方案/skill/法案，未放行不结束。

施工前第一遍沿授权→法案→Owner→输入输出→状态→真实消费者核上述分母；第二遍从正常、失败、unknown、冷却、迟到claim/init/重复信号反向核冻结要求与下一次启动。具体缺口清零才进入代码，不以自称98%替代事实。建设后再次两遍主审，随后子审代码差异；不让子智能体反复只审方案。

原入口增加验证：实际子进程延迟超过旧五秒仍无强杀、快速exit缓存、active等待期间不得先关库/session/Browser、unknown不变且异常、同身份失败、排队claim停止后HTTP发送为零、初始化期间停止、重复close一次资源操作。静态验收不等于生产Dynamic Proof。

本轮完整READY发现：shutdown断言异步返回后记录到`await assertion`，不属于真实assert调用位置；核验及循环检查分别超过16圈复杂度，两个测试强制把不完整对象转成Runtime，导入源超24。先完成三层鉴权再修：原事实核验按当前消费者分清职责；启动输入直接引用现役RuntimeState字段类型，消除重复类型导入；原测试夹具补齐真实对象，未用Browser能力失败关闭；active/最终admission测试合入现有shutdown验收职责，物理删除startup中的重复正文，原场景和断言分母不减。待关闭Promise用实际结果/异常观察，最后在真实assert调用位置断言，不改公共trace、预算或质量规则。该修改属于同一收尾候选修复，不扩张网站、合同、数据库或治理主链。

## 6. 原生质量与交付

冻结ci-full-governance执行唯一`npm run quality:check CHANGE`；通过后clean原生main commit，再`npm run quality:check READY`并读取唯一报告。本轮追加交付目标为READY；不将其升级为RELEASE。失败冻结现场，主Codex三层鉴权后修；修后回CHANGE。只在母本§79真实触发时执行其独立审查；用户建设审查独立在此前完成。

READY通过后推送云仓。真实浏览器/网站Dynamic Proof缺输入或外部事实阻断时报告精确缺口，不能把READY、推送或正常启动称为生产闭环。

施工前主审记录（主Codex，未启动子智能体）：第一遍逐项核R01–R18与完整法案/七图、真实生产者消费者；发现排队claim不能只靠loop检查，已在设计中补物理fetch前关门。第二遍反向核正常、失败、unknown、冷却、迟到init/claim、重复信号；确认异常退出与业务终结分离、冷却原session保留、无新网站合同/恢复链。当前设计分母18项无未闭合设计缺口；建设和动态验收尚未完成，不将设计审查外推为代码成功。

建设自检补充裁决：接单检查使用现役同步runtimeState投影，物理fetch前不得await后继续使用旧状态。关闭需要进程内临时jobId集合作为验收分母：停止时取active/未完成Store行，原已发送claim的迟到合法响应补入；唯一消费者是原shutdown的status核对。否则领取后未落库的失败会从active消失，空Store被误认成功。此集合不持久化、不授动作权、不保存结果、不承担恢复、不构成第二事实来源；缺本地任务只有网站精确absence才算清理成功，否则保留异常。strict TypeScript所需service-process.d.mts仅投影原JS生命周期供现役验收使用，没有新运行时接口。以上补充已由主Codex分别沿实际发送边界、无本地行/精确absence反向复核，未修改冻结规范。

第二遍建设自检发现，active完成后若原worker正在等待，下次cleanup尚未执行就停循环，会把正常任务误报为清理未完成。裁决：原worker每轮结束通知原shutdown；shutdown等待有限次原循环收尾（最多当前待清理Target数量，至少一轮），随后停止循环并核事实。只调用原worker、原cleanup、原等待节拍，未新增timer/worker/重试链；通知是进程内关闭协调，不是业务成功证据。方案和Runtime施工图先对齐该修正，再修改代码。

两遍建设主审记录：第一遍沿信号→实际进程→init→物理claim→active→admission→资源关闭逐项核R01–R18，已关闭异步旧快照、无本地行误成功、缺最后cleanup轮次三项。第二遍反向核重复信号、迟到init/claim、真实失败、unknown、冷却、close响应不明及下一次启动；仅原物理claim停止检查发出的PRODUCTION_CLAIM_STOPPED属于预期未发送，不算异常任务，其它失败不得豁免。冻结法案与母本hash仍与施工前一致；没有网站/DB结构/Skill差异，无兼容桥或第二实现。真实删除/重建片区与局部修改按第4节分别验收，局部测试不外推READY。下一步由子智能体仅审实际建设与本方案、闭环Skill及完整现役法案差异。

资源审查补充：WebSocket正常close不能经故障revoke回调制造Browser阻断根。共享原连接/reply清理为唯一私有实现，正常stop直接清理并关闭实际socket；真正鉴权失败/失联仍在同一清理后调用原onRevoked。两者没有新的协议、重放或恢复入口；现役Browser teardown消费者证明该局部调整必须存在。

子审建设缺口裁决：最终admission必须在有限原worker清理轮次之前，停循环后的核验只读；接纳可能产生的待清理job也纳入有限轮次数，防止最后接纳漏清。Browser各资源关闭独立尝试、同一stop Promise防重复，任何异常仍非零；正常关闭后不再发pairing secret或接受HELLO。App的TCP集合只归唯一HTTP Owner用于实际资源收束，不持久化、不具业务权威，不增协议/Listener；必须等实际close事件才封producer。关闭日志使用原terminalSpanFailure保留cause/CONSEQUENTIAL及原Owner；已确认任务失败保留原first-fact code与原Store authority。以上只对齐既有施工图和验收，不改冻结法案。补验收最后接纳→原cleanup、资源首项异常仍释放其余资源、未HELLO连接真实关闭及原日志因果保留。

最后反向审查裁决：执行初始化blocked不能豁免停机未决核验。原closeBlockedStore按现役stopSignal区分真实停止与原blocked实例换代，真实停止只读核未完成任务/Outbox/cleanup/冷却/Browser未决，仍尝试关库并非零，绝不为核验联网；普通换代只关闭旧资源，让现役重试接续。迟到assembly和blocked换代关闭后的停机窗口继续进入原startProductionRuntime，携已abort的stopSignal，仅组成原Store/blocked handle、在原session门前止步，不启动新worker/session/claim；原Browser stop关WAL前也只读核DISPATCHED，覆盖无Runtime实例的未决。预期未发送PRODUCTION_CLAIM_STOPPED只正常封原准入周期span，不写未取得的Website claimDiagnostics、失败根、回执或grant；真实Website回执诊断保持。补空blocked正常退出、旧pending blocked异常且记录不变、普通blocked换代不妨碍恢复、迟到assembly早停不漏旧库、Browser DISPATCHED异常但原值保留，以及排队claim物理零发送且日志无假根。
同一初始化片区的失败出口：原blocked retry在停机到来后的真实初始化异常必须传给既有shutdown等待者，不能吞为diagnostic状态后报成功；平时重试诊断不变。空库携已abort stopSignal在原session门前正常封启动span，不产生本地早停BLOCKING假根，真实preflight/credential/session故障保持原失败合同。

建设最终主审两遍（子审具体finding修复后）：第一遍顺向复核物理claim、迟到grant/init/retry、逐张原结果与admission、最后原cleanup、冷却/session、原WAL和实际TCP/锁/数据库；第二遍反向核所有异常出口与下一次启动，确认预期未发送停止无假根、blocked普通换代仍可恢复、异常记录不被终结或删除。原生现役局部验收已实际覆盖最终两张admission仅在原worker接纳并逐张cleanup、首项关闭throw仍收束其余资源、101未HELLO实际close、原cause/Owner保留、blocked/迟到init与retry异常、原DISPATCHED重开不变，以及真实失败匹配/不匹配、冷却session不close、session-close unknown非零。类型、Runtime、Browser、Startup及Shell局部检查通过；这是建设证据，不是CHANGE/READY/RELEASE结果。冻结法案/母本/Skill未修改，网站和生产数据库未操作；按授权人的追加要求，现将已建设的GPT附件DOM差异合并到同一个main提交及READY候选；主Codex已分别核实际差异及联合消费者，子智能体补审实际DOM建设及与收尾链的交互。Browser身份检查只同步关闭后拒收的精确AST并增加拒收失效反例，原transport/permit序号的全部反例不删不放宽；该检查与测试属于局部修改，未重建生产transport身份逻辑。

2026-11-02授权承接：本方案停接单的source运输例外及取消join/缺席发现只由Website唯一《全系统工单安全删除与自动接续-完整实现方案》W5建设；不重新开放普通恢复grant，不更改普通Ctrl+C不abort在途Product及原有资源收尾。旧admission完成表述以现役Runtime004为准。
