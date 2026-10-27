# GPT 文本回答挂载竞态－完整实现方案

## 1. 目标、状态与硬边界

状态：**执行已获授权**，尚不表示代码已建设、质量通过或生产问题全部解决。授权人随后明确批准按本文施工，并要求 CI-FULL 连续完成 CHANGE、提交首推、完整 READY 及再次推送；只在主仓本地 `main` 施工。工单删建、现役数据库操作、服务启停、扩展重载、部署及 RELEASE 不属于本单必要动作，不执行。

需求及实现 Owner：`local-browser-session`；直接消费者：GPT 的 `checkpoint_gpt_text_response`。唯一目标：在原 canonical URL、原 Product marker、同一当前 Target/Document/loader 下，消除“物化阶段未观察到 user UUID，最终原子读取时该消息刚挂载，却被空身份比较误判为 BROWSER_DOCUMENT_INVALID”的竞态。已经观察到的非空 UUID 在本次读取中真正变化仍拒绝；没有取得合法候选仍走原 pending。

**未来生产施工面只有 `src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts` 的第 6 节指定片区；质检只有第 6 节列出的三个既有文件。** Website、Product Flow/Skill/Prompt、GPT handler、URL 连续交接、Browser FIFO/lane、激活/输入/上传、节拍、WAL、Forensics、Runtime、Outbox、数据库、协议与依赖均不改。不得增加锁、重试、等待、队列、监听器、状态、接口、存储或兼容路径；不得把所有 `BROWSER_DOCUMENT_INVALID` 改成 pending。

方案阶段落盘仅本文、现役 Browser Manifest 对本文的一个 ownedPath，以及原生成器对唯一 registry 的投影。执行阶段仅增加第 6 节限定的一个生产文件和三个既有质检文件；该登记不扩大代码施工面，不新增治理机制。

## 2. 当前事实、候选与前轮连续性

项目 realpath `/Users/nexgen/Documents/AGENT`；设计时 branch=`main`，HEAD 与 tracking `origin/main` 均为 `f2dbc3d4cdca596e8f7042906c7d01adef4d74f8`，写前工作树 clean。未进入 Website 仓库施工。本方案是新发现挂载竞态的唯一方案；相关旧方案没有承载该 GAP，不覆盖或重开其旧工单。

四个未来施工文件的 SHA-256：

| 路径 | 设计基线 SHA-256 |
| --- | --- |
| `src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts` | `35e6185a9280bac9bac71af492b301abd2667b90a3e7f9f50e464836ee6653c2` |
| `scripts/audit/domains/local-browser-session/dom-mechanical-facts-inspection.ts` | `2823ceca3a3668ea2def1fd424daf6fccacd61c4afc683bc603ab8df5e59979c` |
| `scripts/acceptance/local-browser-exact-assistant-turn-support.ts` | `3aa7c736b251f700b29c0ea55e8bd19e8f6c4421487aab5762cdd7ac0a230fd5` |
| `scripts/acceptance/local-browser-rule-mutants.acceptance.ts` | `fcf32ae8e001d0e0891054a5be1ec5068120ef0d7a1d68d233aaed2f63d6fa4c` |

其余受影响权威、调用方、消费者与保留模块由同一 HEAD 绑定；施工前复核这些相关对象的 Git 差异和 hash。相关漂移只重开相应裁决，命中他人改动先保护，不 reset、stash、搬移或覆盖。执行候选包含本文、所登记的 Manifest/registry 及第 6 节代码；READY 只以实际 clean 原生 Git commit 绑定，不另建候选身份或文档 hash 回执。

已证事实：`executeExactAssistantTurnRead` 先 await `materializeExactUserTurn`，其结果允许 `null`；随后却把它转换成 `""`，同时交给页内比较及 `decodeObservation`。消息恰在两个读取之间挂载时，页内把合法 UUID 与 `""` 比较并抛错。即使仅放宽该页内比较，现有 decoder 对 ready 或 adjacent-assistant-missing 的空预期身份仍会拒绝，必须在同一文件闭合交接。

2026-10-27 本轮用 Node v24.20.0、现有 `exactAssistantRuntimeFor`/`executeExactAssistantFixture`、`FakeElement` 和 VM，直接求值当前生产 fixed-read 表达式；没有修改源文件、连接用户 Chrome 或访问 Provider。相同 URL 与 loader 的五个确定性时序：稳定缺席返回 exact-user-turn-unavailable；稳定挂载且有回答返回 ready；两次读取之间挂载且 assistant 尚缺、以及两次读取之间挂载且回答已就绪，均在 exact-assistant-observation 误报 BROWSER_DOCUMENT_INVALID；已知 UUID 变成另一个 UUID 也拒绝。每例均为一次 scan、一次最终读取。

原 JSONL `.grasseye-local/runtime-logs/agent/cdfec157-9e78-4ea6-b659-af70ca21d051-0001.jsonl` 的 seq 618/619（11:34:08Z，job `aiprod_92cae0bd-638e-4d4a-9479-823a60536477`）、788/789（11:35:59Z，job `aiprod_055d2132-b4a9-4476-a9bd-497e548851a0`）显示相同读取阶段及错误。日志没有该 if 分支的精度，**不能追认这些现场事件一定由本竞态触发，更不能据此断言输入过程被轮询抢占**。本方案只消除已复现误判，不以“所有 TAB 切换消失”作验收目标。

有限回归筛查命中同片区多轮修改，采用深度但限定受影响图的设计：`86b0873b0` 已引入当前 null→空身份交接，早于最近 URL 修复；`edb63d812` 修改 stop 范围；`f2dbc3d4c` 修复恢复回答后的 URL 连续，未修改本 reader。本轮不把新发现直接归罪于最近提交。前轮裁决如下：

| 已落地对象及原方案 | 必须保留的不变量；本轮关系 |
| --- | --- |
| `GPT回答轮次身份漂移阻断-完整实现方案.md`；当前 marker reader | 原 URL＋原 marker 定位当前唯一 user/紧邻 assistant；提交 UUID 只作原 WAL lineage。不能恢复旧 UUID 永久主键、全历史扫描或 Prompt rehash。旧文档的旧步数以当前法案和实现为准。 |
| `GPT文本回答扫描门禁根治-完整实现方案.md`；`86b0873b0` 的 fixed Document by-value 链 | 有界物化必须 await 完，loader 前后固定，成功不分配/释放 remote object，失败主因及 stage 保留。本轮只修物化结果的身份交接，不重建其生命周期。 |
| `GPT当前回答停止状态误识别-完整实现方案.md`；`edb63d812` | home Composer 不贡献 stop；非 home、缺 placement、隐藏或屏外 stop 仍按现役规则计数；完整回答可读。本轮 stop 表达式及正文提取不变。 |
| `SEO原会话URL连续-完整实现方案.md`；`f2dbc3d4c` | cache/source 零页面操作、下一步接原 URL、原 Child 身份跨 lease 保持。当前 GAP 在回答 DOM 读取，不重开该交接施工。 |

## 3. 法案、施工图、实现与质检对齐

本轮实际完整读取基础法案 3 条、功能法案 36 条，核对唯一 registry 的 39 条/13 域与适用 Manifest；完整回读 Browser V57、GPT V70、质量证据施工图。相关母本按 §§0/4/35 绑定并回读 §§6/21—24/36—38/41—42/44/46—48/74/78—79。闭环 Skill 正文完整读取两遍后形成本文。读取数量不是质量 PASS。

执行前由主 Codex 独立完成两遍规范审计，未分派子智能体：第一遍核四份源头栏目蓝图与两仓适用法案/施工图的义务关系；第二遍反查私有 nullable 交接、公开 v4 合同、唯一 Owner、保留区域与有限验收。Website 按只读范围遍历法案域并取得命中的 AI acceptance/AI boundary 条款及相应施工图，不声称逐字阅读全部无关法条。全部适用规范义务均有现役落点，无需修订法案、施工图或跨仓合同，未留规范阻断再进入代码阶段。AGENT READY 所需全量 active 法案、Manifest、施工图、spec 及原生验收合同另按母本取得；这不扩大本单施工面。

| 维度 | 当前依据及裁决 |
| --- | --- |
| 法案 | `LAW-CODE-PURITY-001-V6/002-V2/003-V3`；`LAW-ARCHITECTURE-BOUNDARY-001-V18/002-V2`；`LAW-CAPABILITY-GOVERNANCE-001-V19/002-V5`；`LAW-GPT-001-V67/002-V33`；Browser 六条，重点 `004-V59/006-V47`。原子身份、typed pending、真实失真拒绝、effect once、唯一车道均已规定，**不修订法案，不改变冻结语义**。 |
| 施工图 | Browser 的“GPT 提交后置机械定位”段、两门冻结段、pending 及有界物化段；GPT 的“唯一 Owner 与职责”、两门冻结及“证据、失败与验收”。均要求最终当前 Document 的同包身份，不要求把尚未观察到的 UUID 当成有效旧身份。**不修改施工图或 spec**。 |
| 实现 | 第一直接断裂为 reader 将物化 null 转为 `""` 后作为既有身份强比较；页内比较和 decoder 是同一断点的两处投影。只重建该内部身份交接，不改公开输入输出。 |
| 质检 | `exactAssistantTurnReadIsAtomic` 把旧无条件比较字面量钉死为 required token；对应 rule mutant 只证明删掉字面量会被这个检查拒绝。真实 DOM Exam 已有已知身份变化拒绝，却缺 null→合法挂载。删除这项实现钉死及其依赖变异，增强原行为 Exam；其余 Static/Exam 和唯一 `quality:check` 保留。 |

删除旧 token 不是删除已知身份保护：它不能区分“正常出现”与“真实变化”，还会强制错误实现；真实变化由保留的生产比较及原 `exerciseRealIdentityChanges` 直接执行证明。新正向反例与既有反向反例共用原 Exam，无新增检查器或同义变异矩阵。

## 4. 受影响图、消费者与停止边界

按符号反向引用与两个独立入口来源交叉查漏：①现役 Child contract＋穷举 handler registry＋Browser command registry/intent dispatcher；②Product 实际 checkpoint 调用点、原生验收 import/执行链及本轮真实日志。均汇入唯一文本 reader，未发现第二生产实现；测试中的叶响应不算第二生产链。

正向链：Product 原 call/turnMarker → `handler-registry.ts#checkpoint_gpt_text_response` → `checkpointGptTextResponseHandler` → `web/gpt-dom-observation.ts#readExactAssistantTurn` → Browser Actor/permit → `executeRegisteredDomIntent` → 本 reader → `bindExactAssistantTurnReply` → GPT 两门 → `persistGptChildOutcome`/原 Forensics artifact append/readback → Product 机械结果 → Runtime 原 stage/terminal Outbox → 同身份 Website 完整结果成功接收回执 → `reconcileBusinessAdmission`/原事务 local completed。该工单的局部终点是合法观察被原 GPT 正确消费；AGENT 工厂完成仍按 Runtime004-V48，领域采用、发布和用户交付不新增为 AGENT 完成门。

全部 13 个实际 Product 调用入口：`hehun-ai-analysis/flow.ts`、`hehun-report-followup/flow.ts`、`qimen-professional-answer/flow.ts`、`qimen-report-followup/flow.ts`、`public-knowledge-article-pipeline/seo-gpt-calls.ts`、`localization-production/flow.ts`、`zeji-personal-selection/flow.ts`、`naming-commercial/flow.ts`、`naming-from-existing-bazi-report/flow.ts`、`payment-screenshot-observation/flow.ts`、`bazi-ai-full-analysis/product-turn.ts`、`bazi-chart-interpretation/product-turn.ts`、`bazi-report-followup/product-turn.ts`，均在 `src/plugins/` 下，原输入仍为 URL/marker/提交 UUID/预算，原输出合同相同，全部保留，以既有 Product 原生验收防回归，不能只保 SEO 一个消费者。

| 对象与唯一 Owner | 决定、保留必要性与验收落点 |
| --- | --- |
| 本文件 marker helper、materializer、fixed read；Browser | marker helper 证明当前角色/气泡/UUID 与 message ids，物化保证虚拟化长页可读，fixed helper 保证同 loader/guard；删除会丢可达性或页面安全。原位复用，V4—V7。 |
| Actor reply binder、revision hash、GPT decoder/handler；Browser/GPT 各原 Owner | 原 v4 包、身份/hash 验证、两类负观察元数据、stop/正文结算及 artifact 消费不可删除；更简单的修复在 producer 内完成即可，消费端零改，V1—V9。 |
| FIFO/lane、Target、URL selector、1.5/2.5/40 秒门、至少 70 秒资格；Browser | 真实页面串行、防重复动作与原 URL 精确定位均有当前消费者；本次 observation 不获得 mutation/调度权，全部不改，V8。 |
| Product、Forensics、Runtime Outbox/接收回执；各原 Owner | 原 artifact 和结果交付是实际业务消费者；本次不变其字段/身份/状态/事务/失败或恢复授权，沿既有链读回，V9。无新持久化或恢复动作。 |
| 图片读取、准备/输入/上传、Website、独立父 step 缺口 | 不消费本 reader 的 null/UUID 交接，不因本改动获得新输入或新合同，施工排除；只运行已有相邻回归，不顺带修复。 |

## 5. 唯一目标语义与合同 handoff

保留 `materializeExactUserTurn(): Promise<string | null>`，保留一次最终同步 DOM 读取及现有命令预算。**null 只表示本次物化尚未观察到 UUID；非空字符串才是已经观察到的身份。** 在原同一函数调用内将这个区别原样交给现有页内函数及 decoder，不转为空字符串，不新建身份对象或第二来源。

最终样本规则：

1. 物化已见 UUID：最终匹配唯一同 marker user 时必须与它相等；不相等仍 BROWSER_DOCUMENT_INVALID。最终 user 仍缺席按原 typed unavailable，不补造成功。
2. 物化为 null：最终样本独立证明原 URL、当前 Document、原 marker 唯一 user 与合法 UUID/message ids；存在 assistant 时继续证明它真实紧邻且唯一，尚缺时按第 3 项 pending。刚挂载的合法 UUID 在这一包内成立，可以返回 ready 或 pending。禁止直接信任任意 returned ID、跳过 UUID 形状/关系/唯一性、使用旧样本的正文或 stop 拼包。
3. 最终 user 仍缺席，或其紧邻 assistant 正文未挂载：仍分别产生原 exact-user-turn-unavailable / adjacent-assistant-missing 包，原 GPT adapter 形成原 typed error 及完整 negative observation。不得用裸 error 早退取代该包，否则会丢失原负观察窗口证据。
4. 多 marker、多 assistant、错邻接、非法 UUID/message ids、错 URL、Target/Document/loader/permit/guard 失真及畸形包仍沿原 code/stage 失败。stop/正文原两门不变。

身份 spine 保持 job/attempt/revision → 原 step/call/Child → CONFIRMED effect＋原 WAL locator/提交 UUID → 当前 Target/Document/loader＋原 marker 的同包当前 user/assistant → observation revision/content hashes → 原 artifact/result/完整结果接收回执。当前 DOM UUID 不反写原 WAL 或提交 UUID，不推导新 attempt、重发或下一步。

公开 request 仍是现有 `readExactAssistantTurn` 的 kind/turnMarker/canonicalConversationUrl，reply 仍是 exact-assistant-turn.v4；字段、枚举、基数、顺序、hash canonicalization、unknown-field 拒收及加密方向不变。nullable 区别只存在 Browser 私有 fixed-script 参数及 decoder 上下文。没有新增数据库事务、lease/fence、receipt、公开字段或跨仓合同；当前安全绑定和 artifact/交付幂等均复用原件。

## 6. 单一原子工单 W1：重建尚未观察到身份的交接

**做什么、改哪里：** Browser Owner 在原一个生产文件内完成第 5 节身份决定，配套增强既有质检。未来只允许下表片区；表外源码即使在同一文件也不得顺带改动。

| 精确对象 | 动作及删除前裁决 |
| --- | --- |
| `dom-exact-assistant-turn.ts#EXACT_ASSISTANT_TURN_FUNCTION` 中仅 `matches[0].id !== spec.observedUserTurnId` 所在完整 if 语句 | 物理删除该比较语句，核验缺席后按“已有非空身份才比较”重建；该常量的其余 marker/邻接/正文/stop/返回字段表达式原位保留。不能删除整个常量或整文件。 |
| 同文件 `assertObservationLocation`、`decodeObservation`、`executeExactAssistantTurnRead` 三个函数 | 作为相连身份片区物理删除、即时核验声明缺席，再从第 5 节输入输出重建。位置校验与 decoder 必须独立校验最终 UUID；只有先前身份确实已知时才要求相等。严格形状、pending 关系、guard、原读取次数与 bindReply 交接完整承接，不改公开签名。 |
| `scripts/audit/domains/local-browser-session/dom-mechanical-facts-inspection.ts#exactAssistantTurnReadIsAtomic` | 只物理退休 required 数组中强制旧无条件身份比较的一项；其它检查原位保留，不换成另一条无必要的实现字面量、不加检查器。已知变化保护由真实行为 Exam 承接。 |
| `scripts/acceptance/local-browser-rule-mutants.acceptance.ts#TERMINAL_RULE_MUTANTS` | 只物理退休与上述旧 token 对应的那一条“删除旧身份比较”变异；其它 mutation/loader/marker/邻接/输入/回执反例完整保留。 |
| `scripts/acceptance/local-browser-exact-assistant-turn-support.ts#exerciseRealIdentityChanges`、`exerciseDecoderAndLoader` | 原位增强既有实际 fixed-script/DOM 及 decoder 用例以覆盖 V1—V7；保留全部旧保护。不新建文件、测试入口、通用夹具或新生产导出；直接复用原 runtime fixture 的 evaluate/response 钩子。 |

**保留什么：** 同生产文件 imports/types、UUID、MARKER_USER_SOURCE、MATERIALIZE_STEP_FUNCTION、record、decodeScan、observationShapeValid、pause、materializeExactUserTurn、sha256、bindReply 全部原位保留。它们分别提供唯一 marker/URL 规则、物化、形状校验、现有预算及完整回包 hash，删除会破坏 V4—V8，不能为凑重构删成熟职责。固定 helper、reply binder、GPT handler、语义 reader、Browser 生命周期和 Product/Runtime 整链同样直接复用。

**怎样施工：** 取得本方案执行授权后，先重绑上述候选与目标 Git 状态；核实相关法案/施工图仍对齐。本轮没有规范修订工单，不从实施中反改规范。先保留前置判据和测试，再在同一未加载施工候选内物理删除表内旧生产片区；下一次独立工具调用用 AST 核三函数声明缺席、检查原脚本比较语句缺席，记录保留对象仍原位存在。该即时证据取得后才能重建。不得复制旧片区到临时文件/内存加工后写回、覆盖写假装删除、移动/改名恢复骨架、加 wrapper/兼容桥。质量侧废项直接退休，新行为只增强原用例。半成品不进入服务。

**怎样验收：** 按第 7 节分别验施工纪律和功能质量；保留符号及页内非比较部分前后 AST/表达式核对，确认作用域之外不变。当前文件分别为 240/447/323/236 行；三重建函数为 6/19/13 行，原检查函数 51 行，两个测试函数 16/19 行，有原结构预算承载本变更。重建后仍满足文件≤500、函数≤75 等现役 Code Purity 红线，不为本单拆新文件。

**不做什么、失败怎么办：** 第 1 节非目标全部排除；无整文件重建、旧链保留或迁移。需要表外文件、改变冻结语义、发现新消费者、真实身份保护变弱、测试失败或相关 candidate 漂移时，停止受影响施工、在本文回补事实与裁决；不以删断言或扩大 pending 掩盖失败。不清理工单/WAL/现役数据，不重发已确认 effect，不自动启动第二恢复链。没有获得回退授权，不自行恢复指定基线；获准回退须单列实际回退对象，不计作重建。

## 7. 有限验收分母、1+1 与交付

| 验收 | 输入/时序与预期；观测位置 |
| --- | --- |
| V1 挂载竞态－尚无回答 | 第一 scan 真实返回 null，第二页内执行前挂载唯一原 marker user，assistant 尚缺；返回 adjacent-assistant-missing，保留合法当前 UUID、原负观察元数据及 pending，不能 DOCUMENT_INVALID。用原 evaluate 钩子在两次实际脚本调用之间挂载，不仅伪造 decoded reply。 |
| V2 挂载竞态－回答已就绪 | 同一时序同时挂载完整合法 user/assistant，分别 stop=0 与 stop>0；完整 DOM/semantic text 返回，前者经原 handler 可 DONE，后者仍 pending，不能多一次 scan、额外等待或 Provider 输入。 |
| V3 已知身份真实变化 | 第一 scan 为合法 A，最终变为合法 B且 marker 相同；继续 BROWSER_DOCUMENT_INVALID/exact-assistant-observation。保留原真实 DOM identity-change 用例，不能把 guard 删除或恒真改法认作修复。 |
| V4 缺席与物化 | null→仍缺 user 返回 exact-user-turn-unavailable；已知→同一 user、assistant 缺失返回原 pending；原正/反向长页>80步、真实顶部、无进展、12秒与 deadline前3秒预算不变，不增加读取/滚动策略。 |
| V5 唯一性与错误关系 | null 后出现多个 marker、非法 user UUID/message ids、多个或非紧邻 assistant，分别按原 ambiguous/invalid 拒绝；原 stable ready、隐藏/屏外回答、完整 JSON/富文本和正确邻接继续通过。 |
| V6 页面安全 | null 后挂载同时发生错 URL、loader 漂移或原 assertCurrent 失效，仍按原 code/stage 拒绝；原前后 pinned loader、异常资源收束和主因优先用例继续通过。 |
| V7 解码真实性 | null 上下文中，缺/额外字段、ready或adjacent-assistant-missing包的非法user UUID、ready包的非法assistant UUID、原有rawCount/pending/正文矛盾与坏observedAt继续拒绝；已知A的包却携B也拒绝。exact-user-turn-unavailable仍允许原空ID，不给pending的assistant ID新增准入门。合法ready及两类pending不改v4字段/hash，Node binder与GPT adapter原样接收。 |
| V8 原成熟不变量 | 运行既有 Browser terminal/物化/回执/限流/媒体/FIFO 及 GPT proof/lifecycle/cache-source 验收，原 Product 验收覆盖第4节全部消费者。输入/上传占用不可被到期轮询抢占、原 URL 连续、原 CONFIRMED 零新 submit、stop/空正文20分钟窗口及 reset 保持；不重做调度代码。 |
| V9 真实运行与完成边界 | 未来正常加载该候选并经授权运行时，只读核对 SEO 文章与固定文案本地化各一条现役正常任务，关联 job/attempt/revision/call、加载 build、原 effect、合法回答 artifact、完整结果成功接收回执与 local completed；结果拒收或未知仍由原 Owner/原链处理。无额外派单、真实故障注入、删除或重发。没有该运行证据就报告尚未验证生产稳定，普通成功样本也不冒充已观察全部竞态。 |

V1—V2 的时序分别区分本次正确实现与当前已复现错误；V3/V5—V7 防止“无条件忽略身份”混过；其它分支优先复用现有用例，不复制等价矩阵。所有 pending 保持原 Child deadline/负观察窗口和唯一 FIFO 回接，拒绝/取消沿原 guard、typed failure 及精确授权处理；没有新恢复动作或持久状态。错误读回、格式拒绝及接收未知不能变成重新 Provider 输入资格。

**1+1 的必要证据：** 新增能力仅为两种已证挂载时序不再误杀；成熟能力由 V3—V8 保持，最终读取仍是一包、既有原子周期，新增 Provider 物理输入、额外 DOM 观察、等待机制、持久结构及第二链路均为零。不以“通过率提高”、次数堆积或净增行数冒充收益；任一原安全保护回退就不满足本单目标。

施工纪律单独核实：删除前保留裁决、独立即时缺席工具结果、随后重建顺序、旧空身份强比较和无必要 token/变异零残留、保留对象未被搬走/复制、无兼容桥。功能验收通过不能补造这些过程证据；缺证据写“无法核实重构纪律”，已证违规写“未满足重构要求”。

原生验证只复用现役 Node≥24 环境与 `npm run acceptance:local-browser-terminal`、`npm run acceptance:gpt`、`npm run acceptance:architecture-boundary` 和唯一 `npm run quality:check -- CHANGE`。本轮方案阶段不执行上述生产建设验收，不写 PASS。用户另行要求 READY/CI-FULL 时按冻结 `$ci-full-governance` 执行，不改该 Skill；READY不替代V9，RELEASE不自动授权。新代码加载只沿原正常停止/在途handler排空/原事实交付及固定artifact更新链，不能热替换在途动作、清槽或把unknown改成no；不能排空就停止切换、保留现场。

执行 Codex 最终按实际对象分别报告：真正重建的身份片区、经论证原位保留的成熟职责、局部增强的既有测试、删除退役的检查 token/对应变异、实际失败回退、未完成的功能或生产证据。不得把一处竞态修复扩称为所有 TAB 抢占已经解决。方案主自检分别反查四维权威、边界与删除纪律、有限验收及前轮不变量；不以自评分替代项目质量结论。
