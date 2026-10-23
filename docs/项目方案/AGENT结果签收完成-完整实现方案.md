# AGENT结果签收完成：法条收敛与完成判断修正

方案状态：可施工。AGENT 已通过 CHANGE 并首推 43fdb641a；READY 因本方案缺少文件 Owner 在入口停止。按原固定合议庭 2:1 裁决，仅由现役 architecture-boundary 登记本方案精确 ownedPath，并由唯一 builder 同步 registry；其职责仅为跨 Owner 施工文档的文件治理，不改变 Runtime 或 Website 的运行主权。原唯一 Owner 检查、Runtime 窄边界、方案路径及唯一性保留，不新增检查器或目录通配主权；修后重走 CHANGE、提交首推、完整 READY 与再次推送。Website 停止后续修改、提交和推送，既有改动保留；尚不宣称 READY 或运行版本已启用。

## 1. 只做两件事

**法条收敛：网站一条，AGENT 一条。** 两条互为接收与响应合同，所有 AI 产品共用，不按八字、翻译、文章或 review 另设完成门。

**修正八字暴露的同一个完成判断。** 网站对完整结果确认接收成功，AGENT 完工；网站确认接收失败，AGENT 沿原链复工；回复未知先查原回执。接收不是 AI 生产成功、质量通过、PDF、付款、发布或领域消费成功。已有报告继续交付原报告，不能因接收失败直接重做 Provider 输入。

本次不重构成熟恢复链：原 job/attempt、WAL、防重复输入、source handoff、风险授权、lease/fence、限流、容量、claim、启动和退出收尾的入口、顺序与恢复资格保持原样。网站自己的业务恢复仍由原 Owner 负责。只修改这些入口共同调用的现有接收对账函数中的完成资格，不能借调用关系扩大成整条恢复链改造。

## 2. 法条缩到这个节点唯一两条

逐条核对现役源后，直接混写完成边界的旧约束有 8 处：AGENT 3、Website 5。收敛的是这些记录中与本节点有关的句子，不是把 8 个完整 law-record 连同其他有效义务全部删除。

| 唯一法条 | 只负责什么 |
|---|---|
| Website `LAW-AI-ACCEPTANCE-012` 原位升版 | 完整结果按原鉴权、身份、对象/envelope/hash 检查被持久接收，原事务提交后签成功回执；失败给出精确原因；同请求幂等读回；下游业务失败不能撤销接收 |
| AGENT `LAW-AGENT-PRODUCTION-RUNTIME-004` 原位升版 | 按原请求核验接收回执：成功完工、失败原链复工、未知先对账；所有 AI 产品同一规则，不等待领域 receipt |

原 Runtime001、Runtime-Log-Spine001、Website AI-Acceptance001/004、Bazi008、Public-Knowledge005 中，删除重复或越界的 AGENT 完工/复工条件，仅引用对应仓的上述唯一法条；本域权限、事实、业务入库及交付义务保留。Localization020 中签收前的原生产恢复与签收后的本域消费分开，不再据后者驱动 AGENT 重生产。不新增 lawKey，不新增第三条接收规则。W1 只同步不可分割的 law 版本引用、Blueprint、spec lawIds、审计 Manifest 与唯一 builder 投影；运行控制合同语义和版本切换随 W2 实现，原检查随 W3 修改，不改母本，不重排无关法条。

规范依据为各仓 `AGENTS.md`、`docs/governance/法案系统建设说明书-冻结定稿版.md` §4、§14、§35—44、§46—47、§72、§74，以及原 Runtime/AI-Acceptance Blueprint。本轮“现在执行第一件”仅授权 W1 对应的 active law 修订；后续“执行这2件”授权 W2/W3。原法条冻结的签收前生产恢复及 Provider 防重不解冻；只修接收成功后的完成边界。依赖引用按原 parser 核无环，不借收敛创造新依赖层。

## 3. 已证实问题与保留边界

原事故证据中，两张八字工单 `aiprod_caf13a695229ce37ca23479bd6a858f3`、`aiprod_9d360ebf81f73d05966b3ac3f4d4aeb1` 已有网站成功 terminal 回执，本地却等待 BUSINESS_ADMISSION。直接断点是 `runtime-claim-operations.ts#sendStagedTerminal` 与 `runtime-business-admission.ts#reconcileBusinessAdmission` 仍以领域 receipt 决定本地完成。本轮最新只读回查，两张现已 completed；不得重开它们或用旧快照声称当前仍失败，历史问题仍用于验证边界。

原 provider 与 AGENT 路由投影字节一致：task-result v22、15 个产品、15 primary 加 28 review，共 43 路由，都经过同一 Runtime。统一修正此处自然覆盖全部产品，不改各 Product 的生产步骤或专业合同。控制 manifest 与最小 dependency 已同步为 v47，completion_authority 改为 website_result_receiving_receipt_only；task/result、device-status 和 Browser 线协议字段不删除、不改形状。

反查发现：同一接收对账被执行尾部、交付重领、failure readback、worker、启动与 drain 共用；`attemptClosedByWebsite` 又被 acceptTask、容量与恢复资格使用；`markOutboxSent`、hydrate 与 delivered 早返回控制回执历史；`completeTask` 同时更新任务与清理标记。因此不能把“改完成条件”做成删除共用恢复入口、重排事务或清理整份文件。

## 4. 仅三个施工工单

**W1｜法条收敛。** 两仓各自 Owner 只按 §2 修订接收条款并移除重复句子，原位更新必需的 Blueprint、spec lawIds、依赖引用及审计 Manifest/registry；运行控制合同语义/版本切换归 W2。Website 业务 status 的语义保留，不能把它与 AGENT 交付 status 混为一个成功标准。现役 API 返回字段继续保留；不为本案提取合婚回执函数、搬业务校验或改 Browser token。验收是本节点只有两条唯一规则、无残留 admission 完成门、原非本节点义务无删除；授权、版本或依赖冲突未闭合即停。

**W2｜现有接收完成判断。** 唯一判断落点仍是 `src/lib/local-runtime/production/runtime-business-admission.ts#reconcileBusinessAdmission`，不搬文件、不建新恢复模块。优先从原 Outbox 核对当前 job/attempt/result 对应的成功 terminal 回执；本地未确认时沿原设备状态读回同请求 write receipt。原 Outbox Owner 仅补 `readResultReceivingReceipt` 只读端口，核原 request body/attempt/result 与持久 response hash；核验复用原 `parseTerminalReceipt`、请求 expectation 与原 hydrate；匹配成功后调用原 `completeTask`，没有成功事实则回到原失败/未知恢复路径。保留原 404/purge、staged 结果恢复、first fact、source seal、授权与旧事实，不按网站整体业务 failed 判断 AGENT 失败。

正常 sender 在现有交付成功位置调用同一个对账判断，执行尾部、重领、worker、启动、drain 仍按原入口/顺序调用。job/request/attempt、envelope hash、内容 hash 与原请求 session/epoch 必须匹配；重启不能拿新 session 否定原回执。删除该判断不再消费的 AGENT 领域 receipt 解析/hash/三变体检查及其专属质检；Website 原返回字段和其他恢复字段校验保留。不得顺手删除 staged/artifact/control/attempt/write_receipts 等恢复合同。

保留原 `markOutboxSent`、`deliverOutbox`、hydrate、Store 事务结构和 ledger 判定；不在通用发送器中新增任务完成副作用。回执先持久化、任务后完成之间即使崩溃，也由同一原对账入口补完；已 delivered 早返回必须仍能完成对账。已证实 `completeTask` 会把同 job 全部 pending 写标 BUSINESS_ADMITTED，接收即完工后不能提前吞掉 provider_cooldown 通知，因此仅收紧该既有 SQL 的对象范围，保留通知原恢复，不重写事务或标记体系。

Website 只在 `services/api/src/ai-production/business-result-consumer.ts#endRejectedAttempt/rejected` 的“已成功接收后”分支，取消清 terminal/result、orphan 原件并据业务错误重新派 AGENT 生产；保留原错误事件、精确原因、原结果与网站 consumer 的有限重查。它不是对真正接收失败的恢复改造。删除新链不再调用的拒收丢结果 writer `closeAttemptRefusedByWebsite`；暂不删除 `attemptClosedByWebsite`、`domain_refused_result`、`verifySourceHandoff` 等共用/历史恢复资格读取器；必须先证明所有既有消费者和存量状态均不再需要，不能凭本次现场为零就整体删除。

W2 不改生产恢复规则、Browser/FIFO/Target/WAL、Provider submit、N/限流/cohort、清理协议或物理资源占用口径。完成后资源仍可能在原收尾，busy 不能推翻任务已完工。两仓其他领域/PDF/付款/发布的实现不在本次施工范围，八字 Manifest 字段故障不混入此单。出现必须越界才能闭合的事实，停止并只补这份方案，不能直接升级为恢复层重构。

**W3｜原质检减法与回归。** 复用原 `scripts/acceptance/agent-production-runtime*.ts`、`agent-route-contract.acceptance.ts` 和 `scripts/audit/domains/agent-production-runtime/`，仅删除“必须 base/Bazi/review admission 才能完工”的检查/夹具，改原场景验证接收节点；保留其中的重启、重领、坏回执、防重复、清理、404、兄弟隔离、旧历史与 source 保护。Website 只改原 ai-acceptance inspector/Exam 中与本节点相反的完成/重派断言，领域业务 commit 的验收不删。不新建测试框架、检查器、43 套夹具或第二质量入口。每项成熟恢复基线先在原代码取得有效结果，修后同场景再验证，不能删失败用例换通过。

## 5. 风险验收与施工门

风险判断：先前扩大的方案触及公共协议、通用 Store 事务、Browser 和历史重授资格，存在破坏成熟恢复的实际风险，不准据旧方案施工。此次撤回这些非必要改造，仅保留 W1—W3。范围缩小不等于已经验证零回归，以下原路径必须同时守住：

| 场景 | 必须取得的结果 |
|---|---|
| AI 尚无完整结果、已有 confirmed/possible effect | 原授权/source/WAL 恢复继续可达；不新增 Provider 输入资格 |
| 已有报告、网站接收失败 | 原结果/Outbox 可重领续交，不能死循环在本地错误标记，也不能重做报告 |
| 网站已收、ACK 丢失或写回执后进程崩溃 | 原请求读回并补完本地完成，重复应用幂等，不依赖领域 admission |
| 错身份、旧 attempt、坏 hash、权限/失效 fence | 不误完成、不绕授权、不把不可见 404 当权威删除 |
| 重开、drain、清理失败、待发送限流通知 | 原收尾均可达；任务完成不吞控制事实、不阻塞兄弟恢复 |
| 已接收后的网站业务失败 | AGENT 仍完工，网站处理原结果；不能撤回接收、丢结果后重派生产 |

本轮只读快照中，Website 历史领域拒收待重授候选为 0；AGENT 旧拒收形态为 0，读取的 2431 张任务快照中 ACK 已确认但本地仍 failed 为 0。快照随后已变化，不能作为删除历史恢复读取器的永久证明，更不能作为“不会回归”的证据。原两单现在完成，只作为既有成果保护对象，不重开、不手改状态、不重新生产以证明修复。

各仓使用自己的原生 CHANGE 入口：AGENT `npm run quality:check -- CHANGE`，Website `pnpm quality:check -- CHANGE`；同一命令环境先设置并验证 Node >=24。普通回归与 CHANGE 只报告实际覆盖，不启动服务、派单或调用 Provider；不拿传输、局部测试或方案冒充 READY/RELEASE。原恢复基线、修后回归及原生检查未闭合，不能报告成熟恢复未受破坏。

仅本地 main，保留用户既有改动；目标文件已有用户改动须先取得续编授权。未来启用匹配控制版本仍走原入口和原授权，保全 WAL、Outbox、结果及未决事实，不搭兼容桥，不回滚生产数据库。跨仓直接回读两仓自己的现役权威，不补建辅助 Skill；运行启用仍须原切换授权。

减法硬门保持：生产、质检、法条、Blueprint/spec、Manifest、生成物和本方案全部计算本任务增量，新增行减删除行必须 <= -1；不能把用户原改动算作本任务删减，不能删无关内容或压缩排版凑数。AGENT 以施工前原件核算本任务增量，生产净减 137 行；连同质检、规范、生成物与本方案的最终净值在 CHANGE 收口时核验。此次 CI 的类型归属误报仅在原 inspector 绑定公开 TerminalReceipt 与原私有 schema/Zod 符号，并保留原基线及错 schema、错 import、any/unknown 反例；不改生产 schema 的可见性或全局封存模型。最终逐对象报告局部修改、删除退役、保留与未完成，不把本次局部判断修正称整片区重建。
