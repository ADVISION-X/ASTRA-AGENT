---
name: agent-flow-boundary-gatekeeper
description: 审查或建设 AGENT 生产链、专业 Product Skill 及 AGENT—Website 接口时，核对授权片区、专业语义主权、Child 局部合同、唯一 Owner 和真实交付闭环；非 Skill 基础设施默认冻结。用于设计、边界审查和会提出实现修改的诊断重构，不执行 Product Flow，不替代两仓现役权威或原生质量裁决。
---

# AGENT—Website 原子职责守门

## 1. 唯一职责与适用范围

指导 Codex 在当前授权内建设和审查：专业模型能完成应有的解释，Child 能完成强而窄的局部判断，现实动作和交付由各自唯一 Owner 证明。结果必须能沿真实消费者追到当前需求终点。

本 Skill 是开发指令，不是 Product 运行依赖、流程解释器、法案、机器合同、恢复控制器或质量入口。可以理解现役 Product Flow 来核对边界，不能定义或执行第二份 Flow。

适用于生产链设计、Owner/接口审查、专业 Product Skill 更新，以及会提出生产实现修改的诊断、删除和重构。纯状态、日志、页面观察、普通 UI/文案或实际 Product 执行退出本 Skill；退出只解除本 Skill 流程，不豁免任务本来适用的冻结索引和目标仓治理规则。没有相关项目的闲聊、翻译等不因本 Skill 新增治理步骤。

## 2. 总授权与基础设施冻结先决门

进入冻结说明书适用范围，先实际读取现役 $frozen-spec-index，按其入口回读目标项目母本、确定 READ_ONLY / CHANGE / READY / RELEASE，再形成本 Skill 的判断。本机入口为 /Users/nexgen/.codex/skills/frozen-spec-index/SKILL.md；入口缺失则报告缺口，不借用旧摘要制造规范。

未获非 Skill 对象的精确例外授权时，只在本次明确授权的 Skill 路径内写入。AGENT 非 Skill 基础设施默认冻结：Product TypeScript、Prompt builder、模型策略、结果解析、Catalog/Mediator、Runtime、GPT/Child、Browser/WAL、Forensics、数据库/存储、日志、UI/API、启动/安全、测试/审计、package/配置及法案、Blueprint、spec、Manifest、registry。Skill 目录中的可执行脚本也不能成为迂回修改基础设施的通道。

冻结是授权边界，先于存在性审判和删除。发现基础设施 GAP、认为修改不可分割、原生检查失败、通过若干轮审计或声称“100%确认”，都不扩大权限。未获该对象的明确授权，只报告具体必要性、Owner、允许路径与验证方式，停止对应修改；不补辅助脚本、兼容路径、测试豁免或临时 Owner。

授权人已经明确批准某个基础设施对象或方案登记的精确例外时，继承该范围，不重复请示，也不扩张到相邻对象。修改冻结法条仍须其原文要求的明确解冻及对应规范授权。修改本 Skill 不解冻任何法案或基础设施。

拟修改新的冻结片区前，先用授权人能听懂的话说明：已证实的具体缺口、为何现有能力不能完成；准备删除和重建的精确文件及函数/章节、不可分割的直接关联对象和用户可见变化；预计收益与已证实收益、验证 1+1 的实际 readback；最坏风险、仍未知的事实、失败停止位置及原数据/结果/未决输入事实的保全和回接；哪些冻结语义保持、哪些必须改变，以及验收等级、推送/发布和参与仓边界。没有真实缺口就不动成熟部分。已有明确批准该具体说明的授权则继承执行，不重复请示；扩大到新对象，或相关漂移改变改法、收益、风险时，先说明新增决定并取得对应授权，不发明审批 token、表单或授权时钟。

本节的阶段性冻结只约束开发修改权限。有限分母中已核实的规范、Static/Exam 与尚缺的动态事实分别报告，不能把几轮审查、旧质量通过或“100%确认”外推为全系统生产已证明；CHANGE、READY、RELEASE 与客户结果仍按现役证据区分。开发冻结不得成为合法 claim、合格成果立即取得、原结果交付及 Website 已签授权恢复的额外运行门；现役 claim eligibility、Provider 保护节拍、lease/fence、回执及 WAL 安全条件继续成立。本 Skill 是开发指令，不能冒充文件系统写拦截器，也不建立第二审批存储、恢复链或质量 verdict。

其他 Product Skill、Website、其他仓库和未获授权的用户改动均不自动进入施工面。沿用本地 main 为唯一施工来源；不建/切/推分支，不用 worktree 绕过范围。读取和修改分别按目标仓权威绑定，跨仓先使用现役 $switch-repo-authority。


## 3. 当前来源、候选与冲突

绑定真实项目根、branch、HEAD、tracking ref、实际目标和 dirty/untracked overlay；读取根与目标路径适用的 AGENTS、母本、当前法案、Manifest、相关 Blueprint/spec、provider/consumer 及真实实现。相关对象漂移只重算受影响结论；无关并行变化保留，不扩大任务。拟写目标有未获授权改动时停止，不覆盖、reset、stash、移动或借副本绕过。

本仓原文入口：

- [冻结说明书](../../../docs/governance/法案系统建设说明书-冻结定稿版.md)：按冻结索引回读当前章节。
- [基础法案](../../../.github/instructions/agent-rules/基础法案.md)与[功能法案](../../../.github/instructions/agent-rules/功能法案.md)：核对 appliesTo、excludes、dependsOnLawIds 和当前正文，按任务等级及命中责任读取。
- [唯一 Owner Manifest](../../../scripts/audit/domains/code-purity/manifest.json)与[唯一 registry](../../../scripts/audit/generated/law-registry.generated.json)：registry 只定位并投影，不能替代原文。
- [Website—AGENT Blueprint](../../../docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md)：生产链运输、结果和恢复边界。
- GPT/Child/Provider 页面涉及 [GPT Blueprint](../../../docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md)；Target、输入、WAL、FIFO、媒体涉及 [Browser Blueprint](../../../docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md)。
- 原生质量职责涉及 [质量证据 Blueprint](../../../docs/blueprints/code-purity/QUALITY-EVIDENCE-OWNERSHIP-V1-BLUEPRINT.md)。下级正文与当前上级法案冲突时，不照抄旧口径，也不能未经授权修源。
- 跨仓合同从 [本仓现役 specs](../../../docs/specs/agent-production-runtime/) 回到实际 authorityArtifact；不能仅比较 contractId/version 或 hash 就宣称语义相等。

任何判定涉及 Website 的责任，先绑定其 workspace 显式路径或现役 providerRepo 映射，读取它自己的 AGENTS、母本、命中法案、AI acceptance Blueprint、provider 与对应 dependency。不得猜个人机器路径或以一仓规则取得另一仓主权。不可读、Owner 或合同冲突分别报告 CROSS_REPO_AUTHORITY_UNBOUND、CANONICAL_OWNER_CONFLICT、CANONICAL_CONTRACT_CONFLICT，停止依赖决定。

同仓按母本权威顺序解释；跨仓接口回唯一 provider 与最小 dependency，不自选一侧覆盖另一侧。历史会议、旧方案、Git 提交和记忆只追溯；代码不能降低法案义务。

当旧方案或已落地修复命中当前责任，查实际落地、仍适用的不变量、偏离位置和当前消费者。保留仍有效的端到端 handoff/readback 门；不恢复旧 continuation CAS/controller 模型。版本、route/Child 数量、Schema 和机器分母从本次来源取得，不在 Skill 保存第二清单或字段真源。

## 4. 专业语义与机械真相

Product 独占当前专业 Skill 和自身静态执行策略；文件治理 Owner 不取得运行决策权。专业 Skill 描述目标、材料性质、依据、推理义务和解释边界；Product 代码拥有实际 Prompt 组装、精确模型/推理目标、Child 顺序与当前授权内分支。Skill 不保存第二套可执行步骤、checkpoint、状态机或恢复政策。

先核真实消费：Catalog 读取同根 Skill 并注入执行 context，不证明某条 Prompt 实际使用其正文。沿命中 Product 的 Prompt builder 核正文、批准材料与 route 子合同。保留专项例外；公开知识文章的 FROZEN-PUBLIC-KNOWLEDGE-PROVIDER-FORMAT-ONLY-001 明确 Skill 不复制进 Prompt，不能擅自增加统一注入链、统一模型或共享 Product workflow。

专业规则由命中 Product 的现役原文决定，不把一项产品的规则推广给全部产品。八字涉及 L0/L1 冻结事实、原典和 L2 方法解释时，核完整授权材料与全部候选、真实原文与引用、支持和反证、条件/分歧/未知、专业层与通俗层等值；未知是解释边界，不能用笼统“无法确定”代替仍能完成的解释。模型判断不得反写原计算事实，不能以目录/hash/引用声明代替真实阅读。这些专业细节继续由对应 Product Skill 唯一承载。

按现役 capability-governance 的机械合同与模型语义主权法案：

- 禁止代码以关键词、regex、长度/比例、词表、相似度、分数或启发式布尔判断专业正确、忠实、自然、完整或风险强度，再据此 failed、拒上传、重试或要求重生成。不能包装成 schema、安全门、Child eligibility 或 postcondition。
- 模型可按完整上下文在同轮自检并修正；不得暗加 Provider 回合、问卷、第二报告或隐藏质量流程。独立复核只能按现役明确业务授权和合同形成 finding。
- 身份、结构、hash、授权、状态、附件、locale、immutable fields、WAL、effect-once 和真实收据仍按机械合同失败关闭。满足已公布机械结果合同的答案沿原链交付；不新增隐藏 exact fields、嵌套数量或内容门。
- unknown-field、字段表现归一、引用等按当前具体合同；不发明公共 parser 或第二 normalize Owner。输出请求不自动授权接收器扩张 hard gate。
- 源码搜索、AST 和机械字符串比较可以定位事实；只有以自然语言含义作确定性内容裁决才触犯上述边界，不能仅凭出现 regex 就判违。

## 5. Child：内部极强，外部极窄

每个 Child 只有一个可独立验收的原子语义意图，依据自己的当前显式合同核：身份版本、原子意图、唯一权威边界、精确输入、能力画像/等待资格、局部事实/裁决、动作/结算、最小安全证据。核 [现役 Child 合同](../../../src/capabilities/gpt/contract.ts) 与具体 handler，而不是通用默认模板或历史成功。

局部可以判断 DONE、ACT、WAIT、FAIL_CLOSED；只在当前调用内存在，公开仅 success 或 typed failed。不能把 Browser terminal 当第三种 Child 公开终态，不能使局部判断持久为下一步位置、统一恢复状态或业务完成。

页面动作资格与直接后置来自同 exact call、当前 Target/Document 的 coherent observation。不能拼旧节点、不同瞬间或无 revision 的读取；stale/revision 改变则丢包，按自身合同 fresh observe。页面 mutation 至多一次物理输入；其它原子事务按其现役合同。不以“已满足必零动作”覆盖模型/推理选择的冻结一次确认；不以“总要动作”覆盖已有 DONE 的零输入分支。

bounded WAIT 只在该 Child 画像与当前调用内按原文成立，不是第四 Owner、公共 wait engine、持久位置或新 timer。GPT 准备瞬态复核不扩到 submit、Provider generating、限流、WAL 或业务恢复。普通全局节拍、动作后读回、submit 静默、Provider observation 间隔与连续 stopped-empty 窗口及重置条件，均回 GPT/Browser 当前冻结原文；保留 Browser 唯一计时 Owner、pending 释放 lane、短 deadline 不 acquire，不能另建 per-Child/job/Tab 节拍。

阻断判据按实际独立决定计算，不能按 DOM 字段数计算：

- 一个由本 Child Owner 产生并被真实下游整体消费的完成判据；只有防重复副作用、越权、串任务/Target/Document、错误结果接收不可替代时才增加一个安全判据。
- 第三个独立判据默认删除；保留必须同时证明当前真实消费者、删除后的可复现错误、现役 readback/测试及更简单方案无法维持同一不变量。冻结 submit/text-response 的两门禁另按其精确合同，不借此例外扩张。
- canonical identity 多字段只有同 Owner 同一原子 observation/transaction 产生、整体消费且不重复相邻 Child 已证明条件才算一门。boolean/helper/hash/状态名不能掩盖独立门。
- 文本回答按原 canonical URL、原 Product marker、当前 Document 的唯一 user 与真实紧邻 assistant 关系定位；stop 存在仍 pending，消失且正文非空才完成，停空按原连续窗口。不能加入 UI 外壳第三门或 response Prompt rehash；图片保持其精确 user-turn 合同。
- NFC 附件精确名优先、唯一合法 Provider 重复尾缀、允许空批准集合及 submit Prompt 展示投影，按当前冻结原文，不做模糊匹配，也不恢复已退役的硬比对。

共享原语必须有至少两个现役严格同义 Product 消费者；单消费者逻辑留在对应 Plugin。公共 facade 只有产品中性的静态类型调用面；不得带 Product Prompt/Flow/result Schema，不导入私有 runtime，不新增 classifier、planner、executor、selector registry、snapshot store、DSL、第二 proof schema 或兼容桥。

## 6. 恢复、现实输入与交付 Owner

下列仅是回原文的职责定位，不是独立控制规则或完整 Owner 清单：

| 边界 | 权威责任与禁止转移 |
| --- | --- |
| Website 业务域 | canonical route、业务输入/材料/授权、领域消费与结果；最终记录必须替换成命中的具体 domain/模块 |
| Website.ai-acceptance | 唯一业务恢复、accepted attempt、result revision、精确风险授权、远端 lease/fence、容量与公开完成；不能指挥 Product 步骤 |
| Runtime | durable accept、当前授权运输、本地必要绑定、唯一 Outbox 与 admission readback；不能签业务恢复或拥有 Product checkpoint planner |
| Catalog/Mediator | 唯一路由并只调用一个 Product；文件治理不等于 Prompt、模型或流程运行权 |
| 命中 Product | 专业 Skill、Prompt、模型策略、自身静态 Flow、一次合法无损归一与结果组装；不能自签恢复/attempt/revision或窥 Browser 私有状态 |
| GPT/具体 Child | 当前 Provider turn 与局部语义合同；不拥有业务下一步、continuation controller或恢复位置 |
| Browser | 当前物理 Target/Document、唯一 FIFO/lane、WAL、permit、现实输入和 canonical locator；不决定业务恢复 |
| Forensics | 已完成回答 raw artifact 的 appendArtifact/readArtifact与完整性；图片可同端口附加绑定原图的现役最小身份描述，不存 URL、图片副本或逐 Child lifecycle/failure账本 |
| Runtime Logs | 诊断与 authority ref/hash，不是状态、恢复或完成真相 |

核相应架构、Runtime、GPT、Browser、Forensics 法案和 Blueprint 的正文、条件及例外：

- job/request、accepted attempt、result revision、Provider effect、当前 Target/Document、locator、内容 hash 与 receipt 不能互代。Provider effect 不含 attempt/process/lease/fence/Target/Document；Target 仅是当前物理坐标，URL 只指去哪读，不授 submit。
- Product 先核已确认提交事实再决定首次准备；同 effect 已可能输入先经 GPT 公开 facade 取得 Browser 原 Owner 的 typed fact，核原 WAL/权威后置，不能重跑 fresh/profile/files/write/submit。未知不等于零输入；全部相关旧 command 的 terminal/input-quiescence 由 Browser 原 Owner 证明，未决 DISPATCHED 不给新输入。
- 原答案有界不可得时，只有 Website 已持久签的精确新 revision/指定调用风险 grant 才能有一次受控可能重复输入，旧 WAL 事实保留。新 Target、相同 Prompt、旧页面缺席或新 attempt 不推导风险资格。
- 跨任务 continuation 只在当前授权 SEO 文章、固定 catalog 的严格 direct-parent 关系内成立。Runtime机械核父 result ref/hash与本地 completed父任务，只取其 current attempt用于 Browser locator选择；父 attempt不进入 effect identity，不读父回答/复用父Tab，不建 continuation store/frontier/CAS/controller。八字父报告只能来自本轮 Website 已入库 locked-fact材料且任务 fresh。
- “禁止旧checkpoint”不能覆盖现役两种精确零提交来源：风险来源中 settled_reusable 的指定调用；原 Outbox精确409、完整结果缺席、Website原对象/receipt及全部settled checkpoint共同证明后签 calls=[]来源 grant。只按已签 seal与精确调用复用原完成回答，旧 staged payload/执行位置不成为新 Product输入。
- Runtime 旧 stage与terminal intent先成立则原结果优先交付，旧来源封口不能夺取它；seal先成立则旧完成端口封住。current_reason只是诊断，不作授权、CAS、恢复、容量或完成条件。
- 领域拒收关闭的例外回 Runtime原文：Website已签 completed terminal写回执且response hash等于该stage规范hash，现役status为WAIT_NEW_ATTEMPT且当前attempt/terminal/admission缺席，Runtime同事务丢该attempt stage并释放席位；随后Website不同attempt/new revision grant以精确CAS接纳，不要求source seal/evidence。不能扩到Provider first failure、stopped-empty或未决effect。
- lease续租的运输暂故障仅在已签剩余预算内按原lease、新request_id规则处理；4xx/回执schema拒绝立即停。它不授权新attempt、Product恢复或第二retry worker。
- 已知限流只走 Runtime注入的窄控制端口→原Outbox先关无关新claim/未发生submit→GPT唯一内部ack→Browser原WAL与Website原receipt。保留原文唯一紧急时间例外、fresh后置、targetless事故事实及重启不重放ack；未知dialog不按已知限流处理；原CONFIRMED effect不能降级，在途lease、零submit读回、交付与admission继续。控制反转不成为第二业务恢复链。
- 完整 mechanically valid result与terminal Outbox intent先在 Runtime同一SQLite事务落地，再做Browser/GPT诊断清理。清理或日志失败不能撤结果；同identity可合法重消费时先交付原结果，不重跑Provider。
- Website领域consumer幂等领域事务/receipt与ai-acceptance接纳按该域当前同client规则闭合；核实际transaction context，不凭嵌套调用外观判断第二事务。领域transient与result revision拒收分别沿原Owner处理；Runtime核同结果admission receipt后写local completed。业务Manifest/发布/履约及公开完成先后回具体域，不造跨仓事务或第二完成Owner。
- Runtime只用当前法案规定的持久真相和原Outbox，普通启动不补schema/迁移或造新store；capacity/健康/worker存活、HTTP200、staging、terminal、Outbox送达均不能替代业务readback。

“每步可展示proof”与“每步必须持久ledger”分开核真：追 typed fact、原 WAL、完成artifact及实际消费者。Forensics存储与Website证据措辞不闭合时报告精确来源与受影响决定，不能自行发明账本或据措辞差异断言生产故障。

## 7. 受影响闭环与存在性删除

从当前变化依赖的最后一个权威输入沿真实consumer追到需求终点；从终点反查入口。开发Skill终点是Codex实际读取正文并正确应用边界，不伪造运行import证明活性。生产链方案至少核到领域幂等存储/admission，业务附加终点按具体Owner；不得扩大到无关Product或以静态图证明生产完成。

每项责任写成可独立证伪的记录并闭合：具体唯一Owner、权威输入/provider、一个决定/动作/事务、权威输出、全部真实消费者、失败Owner/位置、接收readback、禁止取得它的相邻Owner。记录含多个独立决定、writer、状态真相、恢复裁决或完成标准时继续拆分；同原子事务的绑定 receipt 是证明，不是第二真相，多字段或多消费者不自动构成拆分。不要停在“Website/AGENT/系统”泛称；一个成熟Product可有有序Child，不因多步骤把静态Flow拆给其它层。

每条相邻handoff核producer/consumer方向、canonical合同identity/version、字段与类型/基数/关系/顺序、null/default/unknown-field、编码/归一/hash、各自identity、状态/幂等/事务/lease/fence、receipt、失败/拒绝/未知、恢复授权和原链回接。语义按canonical compatibility完整满足，不是无条件字节等；exact bytes/identity/hash仅在合同明确要求时成立。

有限分母只取当前需求、合同、代码与已证实结果：成功、拒绝、失败、取消、Owner管理的未知/人工阻断均须有终态/readback/恢复回接。不发明统一恢复图、第二状态机或未来故障。缺关键authority就停止依赖动作，仍完成不依赖它的已授权工作。

先确认可写范围，再对本次新增、修改、替代或继续依赖的结构执行删除反事实：当前需求/GAP、真实消费者、唯一Owner/输出、删后哪条真实分支具体坏、更短现有方案、可执行验证、被替代旧路和零残留。分开核需求层必要性与系统层存在性：当前需求为什么必须完成该责任；当前系统为什么仍须由此唯一结构承担。依次裁决复用→现Owner内修改→删除旧路后替换；新增必须证明前三者不满足。整理、未来复用、行业习惯、命名、测试自证或未发现问题不够。

两层任一证据不足，新结构禁止新增；本次触及或继续依赖的现有结构，在授权允许且可安全分离时物理删除，否则报告 EXISTENCE_UNPROVEN 并停止对应施工，不能保留后宣告合格。更简单方案直接替代的旧路及其独占入口、导出、配置、残留消费者须在授权内同时物理退休。超出授权、冻结基础设施或用户改动的对象只能报告 EXISTENCE_UNPROVEN并停对应删除。明确要求整片删除重构时实际delete→缺席readback→同一路径唯一重建，不能覆盖写、改名、壳或迁移桥代替。

## 8. 实际差异、验收与输出

施工前核目标状态与现役结构约束；施工后核完整实际diff、唯一身份/path、真实消费、受影响handoff、来源/引用、旧语义残留及授权外对象。新文件不代表所有会话自动重载；实际取得完整正文才可声称本次已读取。

输出当前需求、授权/冻结边界、scoped候选、现役实现与前轮不变量、第一直接断裂及Owner/位置/后果、具体责任和handoff/readback、存在性裁决、实际改动、验证与未闭合项。记录只在当前回答或获授权的唯一方案，不能新建registry、台账、评分器、第二report或质量入口。

Owner不明报 OWNER_BOUNDARY_UNPROVEN；handoff/终点不闭合报 END_TO_END_CLOSURE_UNPROVEN。这些只是具体finding，不是第二verdict。计数、目录遍历、日志或几轮审查不替代当前证据；“100%”至多指已定义有限分母无未闭合分支，不能保证未知基础设施永远正确。

按实际等级使用本仓唯一 quality:check，必要普通验证只证明所观察内容。CHANGE不等READY；READY不等RELEASE；发现失败关闭，不能修冻结基础设施来凑PASS。不存在source范围授权或无法保护用户改动时停止对应动作，取消即停止。方案设计需要现役 $closed-loop-implementation-design 时按其双遍阅读与唯一产物要求执行；既定合格方案未漂移则复用，不建立竞争方案。
