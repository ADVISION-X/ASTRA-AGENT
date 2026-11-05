# ASTRA-AGENT 迭代完整实现方案

状态：可施工。授权人已明确批准按本方案实施法案、施工图、代码与质检，目标为 CI-FULL 的 READY 链。需求及实施 Owner：ASTRA-AGENT。唯一工作根：`/Users/nexgen/Documents/ASTRA-AGENT`；仅使用本地 main。本方案替代先前以十二份未启用正文作为第一阶段终点的方案。不得再据旧方案建设 `astra-research-project/references`。本轮不建设 AGENT 总蓝图，不修改网站仓库。

## 1. 目标、依据与交付边界

唯一论文业务产品为「论文生产工厂」。S00 归 AGENT 研究产品，是整厂总纲及固定 Flow 的承载；C01、S01—S10 是其独立执行工序。行业、身份、论文类型及起点是同一订单的需求维度，不产生新产品或分支工厂。

网站给出需求及合法业务授权；S00 决定授权范围内的技能顺序、交接、等待、返工和停止。网站不逐个技能派活。S00 不成为第二 Runtime、通用调度器或业务恢复 Owner。网站保留付款、取消、授权、领域接纳及公开交付主权；这些边界不改变 S00 的内部流程归属。

沿用 `payment-screenshot-observation` 付款截图观察插件。最终 `src/plugins` 为十二个论文工厂目录加一个付款辅助目录。付款观察不构成到账认定或开工授权，不改为 C01，不建设支付接口。

授权人另明确要求保留实际生产所需的图片提取。`checkpoint_gpt_generated_image`、本次精确回答的已鉴权原图字节读取、原图 hash/bytes、Forensics 原件封存与读取、image source binding 及其独立验收均列为必须保留对象，不进入旧业务退休分母。S04 必须实际读取资料图片、图表及其来源上下文，S10 必须核图表在实物中的完整性。旧 Product 图片中转上传回调的退役不扩张为提取能力退役；不得因旧 SEO 退出而删除这些成熟图片能力或削弱其证据/权限保护。

业务来源仅为网站现役三份蓝图：

| 来源 | 本次读取身份 SHA-256 | 用途 |
|---|---|---|
| `docs/governance/ASTRA-01-用户与前端价值蓝图.md` | `ffdb50791a1d037c3543091ba3e9dad15937658a57b09e877ad478f299a08155` | 用户、输入、确认、付款、期限及领取 |
| `docs/governance/ASTRA-02-研究生产与资产交付蓝图.md` | `8e3ff24c0b77d76257b8538639e5de489044d02cfc54f08fa713e0428198bf5e` | 研究质量、原件、证据、全文与实物交付 |
| `docs/governance/ASTRA-03-Skill与AGENT运行拓扑蓝图.md` | `cb12719ab3f8c0ca99ddea2044099b404ecb7fca76cb2a2817aa7f4eac210d2d` | RT-006—021、024—040、049—054 的技能、运输及恢复边界 |

源头位置为 `/Users/nexgen/Documents/AI Paper Factory`。三稿已全文遍历；后续不排查或施工网站。授权人最新澄清固定本方案解释：S00 属研究产品；网站批准业务范围，产品内固定 Flow 调用各技能。不把网站当前接口缺项变成建设这些独立工序的前置任务，也不擅自增加网站接口。

工程规范以本仓冻结说明书、基础法案、功能法案、七份现役能力施工图、十三份 Manifest、五份现役 spec 及唯一 registry 为准。业务来源定义目标；法案修订按本仓规范授权先行，不能拿旧代码降低目标。闭环 Skill 已实际完整读取两遍。本方案不是新法案、总蓝图或第二质量结论。

终点分开认定：目录存在不是工序建成；可调用不是 Work 已验证；原生 READY 不是论文交付。完整目标必须达到：独立技能实际执行、S00 实际调用、同版论文及资料包形成、必要业务结果沿原链接纳。本文不以静态正文替代这些目标。

## 2. 当前事实、首断与前轮裁决

本仓 main HEAD 为 `399cb715d548159fd45f33a608a02acd995b3904`，跟踪 `origin/main`。冻结说明书 SHA-256 为 `27a143ecd7016887d056255e106f49caa29d83d06245ff21ea5c0ffd62b98c3a`。源码与法案存在并行 dirty/untracked；HEAD 不代表工作树已干净。开工前逐目标重新读取状态和字节，不能覆盖、移动、恢复或提交归属未明的改动。

| 现役对象及真实消费者 | 当前事实、处理及验收位置 |
|---|---|
| `src/mediator/product-plugin-catalog.ts::{productionPluginCatalog,dispatchProductPlugin}` → Runtime Catalog | 仍注册十三个旧插件、四十三条旧路由；没有论文工厂执行入口。重建登记与分派，保留唯一 Catalog 和原完成端口；见 W3、W6 |
| `src/plugins/astra-research-project/**` | 十二份未启用正文，仅有未来消费者。整根退役；不能改名复制为新执行结构；见 W2 |
| `src/plugins/payment-screenshot-observation/{index.ts,flow.ts,SKILL.md}` → 网站付款观察任务 | 当前真实消费者明确。原位保留成熟观察链，只收窄已经退出提供方的旧复盘路由；见 W3 |
| `src/lib/local-runtime/production/{route-policy.ts,catalog.ts,website-agent-route-policies.v1.json}` 与唯一投影生成器 | 仍消费旧 task/result v24、43 条分母；网站已发布 `astra.website-agent-task-result` v2。新产品登记必须消费其真实提供方，不能自行造动作；见 W3、W6 |
| `prepare_clean_gpt_chat` → 当前 GPT 产品 | 明确准备 Chat，不能冒称支持 Work。保留原 Chat 行为，另在 GPT 现有 Owner 内建设窄 Work 准备能力；见 W4 |
| `SharedExecutionContext`、`executor.ts::dispatchPlugin` | 已有材料、GPT、结果 revision 和单次 complete；缺 Work 限定读取授权及新业务结果要求的产生执行身份。只增必要窄端口，不另造状态；见 W4、W6 |
| `scan-active-plugin-gate.ts`、`scan-plugin-capability-boundaries.ts` | 将所有 plugins 根视作独立产品并禁止跨根引用，会误杀 S00→内部工序。先改现役规范，再定向修检查；不得删除所有隔离保护；见 W1、W7 |

发现来源交叉核对：蓝图列责任；Catalog/公开路由列合法入口；真实 import/调用及结果消费者确认可达性；Manifest、registry 与原生 acceptance 确认归属和保护。旧路由数与新技能数不同属于业务模型变化，不能强行相等。

前轮真实落地仅为旧十二正文和先行准入例外；没有新的研究执行链。旧总蓝图两文件已物理删除，当前读回缺席；不得恢复。成熟的原件可读、S06/S08 独立复核、S09 全稿检查、DOCX/ZIP 同版实物、原身份防重及原结果优先交付继续保留。前轮“因旧 Catalog 仍引用而保留全部旧产品”裁决废止：旧链互相引用不能证明论文工厂需要它。

研究产品、能力公共接口、跨仓消费及前轮反复设计同时命中，调查等级为深度。设计只闭合本片区，不扩成网站重建、全仓清理或基础设施重写。

## 3. 固定目录、职责与调用边界

```text
src/plugins/
├── s00-paper-factory/
├── c01-user-dialogue/
├── s01-research-brief/
├── s02-research-plan/
├── s03-material-acquisition/
├── s04-evidence-processing/
├── s05-subtopic-research/
├── s06-evidence-verification/
├── s07-manuscript-authoring/
├── s08-manuscript-review/
├── s09-originality-citation-check/
├── s10-research-package/
└── payment-screenshot-observation/   # 原位沿用
```

S00 固定五个文件：`index.ts` 接单、`flow.ts` 固定跨技能流程、`SKILL.md` 整厂共同专业要求、`result-contract.ts` 外部结果机械组装、`workspace-flow.ts` 工作区准备及维护。后两者分别被 S00 完成端口与已发布 prepare_workspace/maintain_workspace 动作消费；不增加工序编号或框架。

C01 与 S01—S10 每根固定 `index.ts`、`SKILL.md`、`flow.ts`、`result-contract.ts`。index 是实际调用入口；Skill 是本工序唯一专业正文；flow 持有本工序提示词、模型策略、会话准备、材料读取、输入提交、等待和回读；result-contract 只处理本工序实际输入输出及机械交接。提示词、配置先内置本工序，禁止预建空文件、通用工作流或注册器。

Catalog 仅将论文业务动作交给 S00；付款仍交原付款插件。C01、S01—S10 不登记为十一个外部 Product。S00 静态引用各工序 index；工序不得引用兄弟工序、S00、Catalog 或能力私有实现。各工序通过现有公共 GPT/Browser/Runtime 合同执行。不得为实现该结构复制公共能力或建立第二运输链。

跨工序专业产物留在本单 Work 目录，通过真实文件版本引用交接。每个工序 flow 返回自身结果；仅 S00 在一个获准业务任务结束时调用一次原 complete。付款保留自身 complete。不得每个 S 技能各自提交终态，也不得让 S00 持久化 stageIndex、resumePoint、第二任务表或自己的恢复授权。

S00 不代替各 flow。禁止把十一种 Skill 名称套入一个通用 prompt/run 函数后声称独立实现。允许直接复用经裁决严格同义的公共原子能力，不复用旧命理提示词和产品骨架。

## 4. 专业工序及可证质量

| 工序、运行模式 | 必需输入、实际动作与输出；唯一直接消费者 |
|---|---|
| S00 | 需求、当前授权、输入版本、冻结确认及真实材料引用；按固定主线调用、核交接、遇范围外动作返回；消费者为原 Runtime 结果端口 |
| C01 / Chat | 本用户获准对话和业务信息；澄清、解释、售前待登记要求、有限且保密的真实工作说明；消费者为 S00 的沟通结果。不得据聊天改动已开工订单，不擅增外部 dialogue 路由 |
| S01 / Work | 用户原文、用途、对象、临时原件、初稿、保留边界、模板、档位；实际阅读后输出提纲、问题方法、资料可得性、核心前提、交付范围及缺项；消费者为原 prepare_brief 结果。无需正式目录，不先做完整研究 |
| S02 / Work | 冻结确认、已核收工作区及材料；拆为不循环、可取证的问题，明确依赖、方法、每项资料用途/时效/格式、验收及停止条件；消费者为 S00 与 S03 |
| S03 / Work | 当前需求、工作区/R2 获准索引、许可与容量；先复用已核原件，再有限外部获取；每件记录来源、版本、位置、许可、可读性或缺口；消费者为 S04。题录、错误页、链接不当全文 |
| S04 / Work | 原件、来源身份、问题及解析工具；保留原件并核正文、表格、页码、期间、单位、转换和读取覆盖；消费者为 S05。索引不当实际阅读 |
| S05 / Work | 子问题、真实证据、依赖结果与计算工具；区分事实/推断/模拟，保留公式、代码、样本、期间、地域、单位及反证；输出逐题论证、定位、冲突与限制；消费者为 S06 |
| S06 / 独立 Work | 实际分题结论、原始证据、计算、反证及边界；在隔离上下文回读和核算，输出逐项结论、覆盖、限制及有位置的问题；消费者为 S00。不得由作者自评或模型投票替代 |
| S07 / Work | 原要求、冻结提纲、已核分题、原件、计算、反证、跨题冲突及模板；建立全篇论证后写作统稿，输出整篇同版稿及主张来源关系；消费者为 S08。新增事实先回研究，禁止拼贴代统稿 |
| S08 / 独立 Work | 实际全文、用户要求、确认单、证据、计算及分题；核全局一致性、计划自身遗漏、要求覆盖及过度推断；输出同版全文核验与定位问题；消费者为 S00，合格稿交 S09 |
| S09 / Work | 实际全文、本单及获准 R2 资料、取得的公开原文；全稿确定性候选扫描加独立语义/跨语言查核，即使无字面命中仍核语义；AI 回看双方原文，输出位置、依据、处理、范围、遗漏及复检；消费者为 S00/S10。禁止阈值定性、虚构全网重复率或机构报告 |
| S10 / Work | 当前合格稿、适用 S06/S08/S09、原始依据、数据代码、许可及核验记录；生成并实查可编辑 DOCX、可解包 ZIP，核全文/图表/引用及包内实际文件，排除内部提示词、Skill、调度和运行日志；消费者为当前交付动作及用户领取链 |

S01 是研究方向和验收依据的第一落点，不预定结论。各下游同时核用户原要求和当前计划，不能让遗漏沿提纲合法化。三档只使用网站实际提供且已验证的模型配置；不因低档、行业或身份省工序，不硬编码虚构模型能力。

“顶级”落实为以上实际阅读、方法适配、可复算论证、独立核验、全篇统稿、原创引用检查和实物验收。代码只核身份、结构、授权、版本、哈希、许可状态及公布的机械合同；专业结论由具备上下文的模型按 Skill 形成，不新增关键词、长度、分数或模板齐全率考官。

## 5. 固定主线、授权与返工

主线为 S01→确认及付款核准→工作区和原件转存核收→S02→S03→S04→S05→S06→S07→S08→S09→S10→同版 GPT/R2 实物及原清单回传。C01 供获准沟通，不成为所有订单先做一遍问卷的附加门。

S00 以当前已发布产品动作组织确定调用段，不按 Skill 数拆持久任务。当前提供方已有 prepare_brief、prepare_workspace、build_evidence、compose_manuscript、prepare_delivery、archive_delivery、maintain_workspace；分别消费 S01、目录准备、S02—S06、S07—S09、S10 实物准备、S10 归档、原资产维护。付款动作 observe 独立沿用。接口缺项不授权本仓自创动作；C01 本地交接不冒称网站对话入口已经建成。

C01 的当前真实调用点为 S01 返回 needs_input 后的售前缺项说明：S00 将原缺项和获准业务说明交 C01，C01 只把这些事实组织成用户能理解的 missing_items 说明，S00 按原 brief 合同回传。C01 不改实际阅读记录、需求、可行性结论或缺项集合的含义，不追加问卷，也不在正常 feasible 分支强制多一轮。独立聊天入口及售后对话的外部接入由网站自行建设，不作为本仓目录和固定执行链的前置阻塞。

继续、内部补料、返工、受阻为专业业务结果。S00 只在当前授权内继续固定步骤；超出当前授权、重大未解决问题、容量/预算不足、取消或身份失效立即保全已成资产并原链返回，不自签下一业务任务。

| 实际问题 | 固定返工落点 | 返回与恢复 |
|---|---|---|
| 关键原件缺失 | S02 精确需求→S03→S04→S05→S06 | 已成功原件不重取；需要新增授权时返回原业务结果 |
| 解析、单位或计算错误 | S04 修正→S05 重算/研究→S06 | 绑定原件及受影响版本，旧核验不得移用于新版本 |
| 分题论证或反证不足 | S05→S06 | 问题定位明确；不能从核验器直接补造作者结论 |
| 全文遗漏、冲突、越界推断 | S07→S08→S09；涉及证据先回对应 S02—S06 | 同版稿及适用核验重新形成 |
| 借用、引用支持或归属问题 | S07→S08→S09 | 保留双方原文；不只改相似片段绕过全稿复检 |
| 文件损坏、归档未知 | 原同版文件/脚本报告→inspect 或获准 repair_files | 不重做论文；先读原对象、上传及接纳事实 |
| 交付后的新研究要求 | 新单 S01 | 当前单不增量、不自动售后回炉 |

同一订单共用工作目录，不等于共用一段聊天。各 flow 可准备新上下文；S06/S08 必须隔离作者上下文但能读取本单同版原件。禁止借旧 SEO continuation 例外扩大论文会话复用或持久恢复权限。

## 6. 根因片区与删除前保留裁决

以下目录的 `/**` 指全部当前文件及专属导出，不是抽样：

| 对象 | 裁决、合同/真实消费者、删除反事实 |
|---|---|
| `src/plugins/{bazi-ai-full-analysis,bazi-chart-interpretation,bazi-report-followup,hehun-ai-analysis,hehun-report-followup,naming-commercial,naming-from-existing-bazi-report,qimen-professional-answer,qimen-report-followup,zeji-personal-selection,public-knowledge-article-pipeline,localization-production}/**` | 十二个旧业务目录退役。它们服务命理、旧 SEO 或本地化，不服务新论文需求；旧 Catalog 自引用不能证明保留。随专属注册、Schema、提示词、配置和验收一起退出，不复制改名 |
| `src/plugins/astra-research-project/**` | 旧内容根整根退役，包括十二份未启用正文及系统目录杂项。新正文从三份业务源独立编写，不从该根恢复 |
| `scripts/acceptance/product-plugins/` 中与上述十二旧根同名的 `.acceptance.ts`，及 `public-knowledge-article-pipeline-{fixture-state,output-fixtures,flow.test-runtime}.ts`、`public-knowledge-article-pipeline.test-runtime.ts` | 随旧业务退役；仅保护退出产品的断言不再要求保留旧路由。独立公共能力不变量移由其原有 acceptance 保护，不复制旧产品测试 |
| `src/plugins/payment-screenshot-observation/{index.ts,flow.ts,SKILL.md}` 及 `payment-screenshot-observation.acceptance.ts` | 经论证保留。网站实际 observe 消费者、截图输入及观察结果仍必需；删除会断付款。Chat、观察提示词、附件、回读及原完成链复用。index 中退出提供方的 accuracy_challenge/quality_reflection 路由及对应专属分支作局部删除，不删除或重建付款观察主流程 |
| `src/mediator/product-plugin-contract.ts` | 保留产品中性 task/context/complete、canonical hash 和无损 JSON 提取唯一来源；真实消费者为付款和 S00。删除会破坏同结果回传与机械校验。必要字段和无消费者图片端口分别裁决，不整体机械重建 |
| `src/lib/local-runtime/production/{executor.ts,cloud-client.ts}` | 保留接单、材料身份、原 complete/Outbox 及真实 lease/fence；新工厂与付款同用。只增窄 Work 授权读取和产生身份，生产文件不经此处中转。executor 当前 476 行，不能继续堆叠到超限；Work 授权实现在同域新 `work-access.ts`，非新服务或持久化 |
| GPT 公共调用、现有 Child、Browser/WAL、Forensics、原 Runtime 三表、Outbox、日志、启动及 UI | 经论证保留各自独立合同：调用者仍为付款和论文工序，分别保护现实输入、定位、防重、原结果、运输及诊断。只实施 W4 明确的 Work 增量；不删除其异常保护来清旧业务 |
| `scripts/acceptance/product-plugin-test-runtime.ts`、原 architecture/route/capability/Runtime acceptance 与原唯一 quality | 保留现役机械保护和原调用入口，定向改旧路由假设。删掉会失去越权分派、隔离、重复 complete、错误材料及原结果防重反例。禁止另立论文质量入口 |

除上述旧根和专属验收，本次反查命中的全部外部位置为：`src/mediator/product-plugin-catalog.ts`、`src/lib/local-runtime/production/website-agent-route-policies.v1.json`、`scripts/acceptance/architecture-boundary.acceptance.ts`、`scripts/audit/domains/architecture-boundary/inspector.ts`、`scripts/audit/domains/gpt/gpt-frozen-attempt-inspection.ts`、`scripts/acceptance/runtime-log-spine-v2.acceptance.ts`。前四处旧产品登记/断言随 W2/W3/W6/W7 退出；后两处分别是冻结机械不变量和日志身份样例，保留其防重/脱敏保护，旧业务示例不作现役路由或活性证据，不借退休业务解冻这些保护。当前未发现其他生产代码直接导入旧插件。

仍有现役公开合同义务的通用恢复、图片或源证明处理不因业务目录退出而自动删除；本次不扩删这些公共实现。无消费者 Product 图片上传端口从 `product-plugin-contract.ts` 与 executor 的注入面退出。反向引用已证明 `cloud-client.ts::{uploadGeneratedImage,exactGeneratedImageReceipt,uploadProductionGeneratedImage}` 仅被退役的旧 Product 回调消费，因此这三个专属函数及 GeneratedImageArtifact/GeneratedImageResultReceipt 类型随之删除；原 V6 UploadedResultReceipt、历史完整结果的媒体回执、通用 Outbox 和 GPT/Forensics 原图证据合同保留，不复制新上传器。新增事实若发现本表外真实职责，先补本方案并停止对应删除，不能笼统清全仓。

并行改动保护：当前 `localization-production/{flow.ts,SKILL.md}`、GPT/Browser/Runtime 与两份法案均存在先行改动。目录退役目标不授权覆盖其未归属改动；先核该精确改动是否已由原任务接纳或明确移交。未完成归属核实，只停止冲突对象，不阻止独立目录设计及已授权文件建设。不得暂存、复制或改名挪走这些内容制造 clean。

## 7. 唯一运输、Work 与文件合同

唯一链：网站需求/授权→原 Runtime durable accept→原 Mediator/Catalog→S00→本工序 index/flow→GPT 公共 Child→Browser→Chat/Work→本工序机械结果→S00→原 complete/Outbox→同任务结果回执。文件链为 Work 固定脚本→获准 R2 对象→真实字节读回；不增加 AGENT/网站生产文件搬运。

贯穿身份分别保存其职责：用户、order/project、冻结 input/confirmation、authorization/handoff、job/request、producing attempt/fence、result revision/hash、Work 账号/marker/directory、每项文件 ref/version/hash/bytes 及原回执。Target/Document、URL、内容 hash、付款截图与这些身份不能互代。产生身份从原 Runtime 注入只读值；不得让模型自行编造，不用当前重投 attempt 改写原结果身份。

| handoff | 合同与接收规则 | 失败/未知、readback 与恢复 Owner |
|---|---|---|
| 提供方→AGENT 路由投影 | 使用当前 `astra.website-agent-task-result` v2 及原 V6 合同；唯一生成器读取已验证 provider 映射的 exact bytes，保留顺序、材料角色、min_count、repeatable、result_contract、unknown-field 规则；不保留旧 v24 fallback | 未知动作/错身份/缺角色拒绝；空附件按 min_count=0 合法。Runtime/原合同处理，S00 不造新动作 |
| Runtime→S00/付款 | 当前 lawful task、材料及窄公共端口，result revision 仍归原 Owner；仅一次 complete | 失败前查原 complete；已有原结果先交付。沿原 Outbox/receipt 闭合 |
| S00→工序 | 固定静态调用、完整 Skill 正文、当前批准输入/版本及本工序工具；叶节点不能 complete 或调兄弟 | 当前调用可停止/失败并保全已成文件；不记持久步骤位置，恢复回原 Runtime 和网站签发 |
| GPT/Browser→Work | 新窄 Work 准备 Child 在原 Owner 内完成 fresh root/Work 模式；Chat 原合同不改。模型和推理按实际 observed profile 回读；材料来自限定本单的 Work 读取授权 | mode/账号/目录不符失败关闭；零/多目录及创建未知保持受阻。原 effect/WAL/read-first，禁止盲建目录或盲重发 |
| 原件→Work | S01 research_input 通过当前已发布 Work-access 取得短期读取权，正式原件按 project/research/delivery context 的指定 asset 授权；原件无需先全量下载进 AGENT。付款附件继续原下载链 | 实际字节、hash、内容可读覆盖分别核；转存未知保留临时副本。只回必要清单，不回研究全文 |
| Work→R2 | S10 目录内固定 `delivery-script.py` 由 S10 flow 实际提供给 Work 工具，读取已获准同版文件及精确读写授权；脚本本地 hash/bytes→条件 PUT→完整 GET 后再核 hash/bytes，生成原始逐件报告 | PUT/GET 失败或未知先查原对象；不无条件重传、不覆盖异版、不泄露 URL/密钥。脚本不签授权、不裁研究质量 |
| S00→业务结果 | 当前提供方严格结果结构；S01 用 astra-research-brief.v1，正式动作用 astra-production-result.v1。身份及 execution 从 Runtime 填，正文由获准 Work 原件读取形成；coverage、issues/unresolved、observed_profile、ref/version/hash/bytes 按原合同 | 原 payload hash/bytes 与包内文件 hash/bytes 分别核；unknown-field 不静默吞。原完成回执不代领域接纳或用户领取 |

不新建公共结果 DSL 或第二 Schema 真源。各 result-contract 使用提供方公布约束及现有机械解析原语；局部技能交接合同只定义真实内部产物，不伪装成第二跨仓协议。读写 URL、授权头、内部提示词及原 Work 完整回答不得进入客户动态或交付包。

## 8. 原子工单与少批次施工

只有一份方向、一次完整工厂建设。下列工单是独立责任和依赖，不是十二次上线。顺序为规范对齐→主 Codex 两遍规范审计→W2—W7 同一目标链建设→建设审计与原生质量。不发布正文先行或空目录中间态。W1 按被修订 law 的唯一 Owner 分成独立规范决定；W4 分为 GPT Work 准备与 Runtime 授权端口两单；W5 按第4节每一工序独立验收后由 S00 单独验收交接；W7 按各原检查器 Owner 分单，最终只取原生一个 verdict。共享的保留、禁止和失败边界统一适用第6、9、10节，不合并成跨 Owner 事务。

### W1　先对齐 AGENT 法案与施工图

Owner 为现有 code-purity、architecture-boundary、agent-production-runtime、capability-governance/GPT，各自在自己的现役文件承担职责，不新设域。

精确规范落点：基础法案 `LAW-CODE-PURITY-002-V2` 的插件互引规则及 `003-V4::FROZEN-EXISTENCE-PROOF-001`；功能法案 `LAW-ARCHITECTURE-BOUNDARY-001-V21`、`LAW-AGENT-PRODUCTION-RUNTIME-003-V54`、`LAW-CAPABILITY-GOVERNANCE-001-V20` 与 GPT Child 清单中直接约束此链的条款；现有 `QUALITY-EVIDENCE-OWNERSHIP-V1-BLUEPRINT.md`、`WEBSITE-AGENT-V6-BLUEPRINT.md`、`GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md` 的相交章节。仅清理相交旧命理范围口径，不改不相交条款。

002 允许同一论文产品 S00→十一内部工序 index 的单向静态调用，仍禁止叶节点互引/反向引入、跨产品调用与私有能力穿透；003 只删除旧十二文本的先行例外。授权人已精确批准“解冻 FROZEN-EXISTENCE-PROOF-001，仅删除旧十二文本准入例外”，其余当前需求、真实消费者、唯一 Owner、删除反事实及执行验证义务重新冻结。不得创造新正文豁免。

LAW-AGENT-PRODUCTION-RUNTIME-003 退役旧 provider 身份和 43 路由分母，以真实提供方和唯一 Catalog 对等核验；不改 durable accept、lease/fence、三表和唯一 Outbox。GPT 补 Work 原子意图及现有消费证据；不能因工序归属同产品便复制公共机制，也不能凭旧“至少两产品”阻止多个实际工序使用同一产品中性原子能力。新窄 Child 的局部合同仍须独立成立。

规范动作分类为局部修订：只替换已经裁决的冲突条款，保留同一 law 内独立冻结义务原文，并建立单一新版本。不得把规范局部修订汇报为整法条删除重构。整法删写会搬走未获解冻的恢复、submit/response 及限流不变量，因此它们不进入删除分母；旧业务代码片区仍严格执行整文件删除→即时缺席→独立重建。关联 Manifest、spec、lawId 引用和现有 inspector 同步，registry 只由现有 builder 派生。不得修改母本、CI-FULL Skill、Target 冻结条款、TOMBSTONE 恢复权或已冻结 submit/text-response 两门禁。

本次规范落地版本为 CODE-PURITY-002-V3/003-V5、ARCHITECTURE-BOUNDARY-001-V22、CAPABILITY-GOVERNANCE-001-V21、AGENT-PRODUCTION-RUNTIME-003-V55。APP-SHELL-UI-001-V4 只纠正非玄学排除口径，保留原 Shell 入口、真实状态及只读边界，不建设新 UI。规范生成器已生成 registry；主 Codex 两遍核对 active law、Manifest、registry 的集合及依赖，39 条无双向缺项，七份施工图和五份 spec 的 law 引用无缺项。此证据仅为规范对齐，不是原生质量通过。

验收：主 Codex 独自两遍逐项对照源头、现役规范、目标调用方向、结果及删除范围；发现仍冲突则代码施工关闭，不能用自评分代核查。不存在修改冻结内容所需精确授权时，只停该项。当前普通任务授权不自动解冻其他条款。

### W2　退休旧业务片区

Owner 为 architecture-boundary 的现役插件片区。删除第6节明确旧根及其专属测试、Catalog 导入和旧插件导出；保留付款与经提前裁决的产品中性原件。先核全部旧根真实引用、并行改动归属和在途 drain；不得删除现有 WAL、Outbox、原结果或业务数据。

新旧公开路由切换前，停止向旧产品新增 claim，原在途任务、未知输入及待交付结果按原链读回/交付至可确认终态；租约到期不等于已停止。不能证明安全退役则停止切换。不开兼容桥、不保留旧业务入口，不让新目录接旧产品身份。

删除后立即 readback 每个旧路径及注册缺席，再独立建设 W3/W5。纪律验收核操作记录、即时缺席、最终导入及公开路由；功能验收确认付款与原结果继续可用。未获授权的回退为无；失败保留原证据并停止，不从 Git/临时文件恢复旧骨架。

### W3　唯一产品登记及付款保留

Owner：现有 Catalog/Mediator。重建 `src/mediator/product-plugin-catalog.ts` 的旧十三插件分派；局部修改 `product-plugin-contract.ts`、`agent-production-route.ts` 及 `src/lib/local-runtime/production/catalog.ts` 的必要中性合同/投影，保留现有授权与单次 complete 机制。

Catalog 对外只登记 S00 研究产品与原付款插件；内部十一工序由 S00 直接引用，不靠 Catalog 假注册活性。共同总纲由 Catalog 原入口加载；每个工序入口在本目录读取自己的唯一 Skill 并用于真实 prompt。无公共 Skill registry、统一专业 prompt 或额外配置层。

付款主 flow、Skill、附件、Chat 画像、观察及回读原位沿用；只删退出当前 provider 的复盘入口及无消费者专属分支。验收同时覆盖 observe 的原成功/拒绝合同、付款非到账边界、S00 只能接当前研究动作、未知动作拒绝、叶工序不可外派、重复 complete 拒绝。重建 Catalog 与付款局部修改必须分别汇报。

### W4　在原能力内适配 Work

Owner：GPT 的公共 Child、Runtime 的限定授权端口，二者不互相取得产品专业职责。

GPT 落点：`src/capabilities/gpt/{child-types.ts,contract.ts,handler-registry.ts,ability-group.ts,production-ports.ts}`、现有 public facade 的显式类型成员及新 `children/prepare_clean_gpt_work/{handler.ts,selectors.ts}`。新 Child 只准备一次当前 Work 会话，不管理研究目录、跨技能流程或恢复。基于当前页面同次 observation 验证选择器，复用 Browser 原子动作和等待，不改 Chat Child、submit、response 或 WAL 规则。原 Chat 入口与全部实际消费者回归。

Runtime 落点：`src/lib/local-runtime/production/{executor.ts,cloud-client.ts,work-access.ts}` 及 `SharedExecutionContext`。work-access 只通过现有已发布 materials Work-access 端点获取指定本单 asset 短期读取/写入授权，使用现有 session/fence/abort 和脱敏；不增加服务、env、表或持久 token。原件按直接 Work 读取处理，控制 JSON 与付款图片继续原材料链。产品只见受限端口和产生身份，不见 raw lease/session 或私有 Browser 对象。

验收区分真实 Work 模式准备、账号/本单目录与真实材料可读；另覆盖零附件、错资产、过期授权、取消、Work 未开通/容量不足、重复准备和未知提交。能力不足返回明确失败，不偷偷使用 Chat、模型 API、最新目录或模拟文件作为降级。动态证据在实现后按原能力证明位置取得，不要求待建能力预先成功。

### W5　十二工序及 S00 固定执行链

Owner：论文研究产品。按第3节独立新建十二目录的核心文件；每个工序直接落实第4节本行的专业方法、材料、模型/模式、实际执行、局部返回及失败边界。S00 显式编写第5节有界顺序；不新建通用执行器、状态库、按行业复制模块或无消费者正文。

叶 flow 使用 GPT 公共 Child 实际准备、配置、提交、等待、回读；本工序 result-contract 机械解析真实产物。S00 实际引用所有需要的工序入口，验证合格交接；C01 仅在获准沟通调用中使用，不伪造已接通的网站聊天入口。S06/S08 的上下文隔离、S09 无字面命中仍查语义、S10 两项实物均列为必须验证的错误保护。

工作区准备与维护属于 S00 产品已有动作，不另造 S11。新建目录前核指定账号和原 marker；结果未知先精确查询原目录，零或多匹配保持受阻。实际转存逐件核同版原件、完整内容及可读性。维护只按 purpose 及既有授权实施，不因聊天自动删件或重研。

S10 的固定直传脚本只有实际 flow 消费后才进入生产；不建无人调用的示例。先验同版 DOCX/ZIP 及许可、保密，再取得精确授权、执行条件上传和全字节读回。脚本失败报告实际逐件状态，不把模型总结或打印成功当收据。

验收从一个原始需求沿实际调用追到相应阶段结果、实际版本与消费者；反向核所有十二职责均可达、没有兄弟工序转发或旧命理 prompt。五个 S00 文件加十一组四文件，共四十九个核心文件，另有 S10 固定直传脚本。不能以文件存在、SKILL 长度或关键词计数替代实际执行。

结构预算沿现役 LAW-CODE-PURITY-001-V6：每文件至多500物理行，每函数至多75行、7参数、8 return、5层嵌套、16复杂度、10 await；import 至多28声明/24来源。S00 以各业务动作的具名局部函数明确分段，不把完整工厂塞进单个长函数，也不借拆分构造通用 workflow。已有 executor 的476行由独立 Work 授权模块承载真实新增责任，原文件只作窄注入。

### W6　接入当前提供方并回传原结果

Owner：现有 agent-production-runtime。重建 `scripts/generate/sync-website-agent-route-policy-projection.ts`、`src/lib/local-runtime/production/route-policy.ts` 的旧业务合同消费；唯一生成器更新 `website-agent-route-policies.v1.json`。不复制提供方路由真源，不改网站源文件。

同步本仓 `docs/specs/agent-production-runtime/{website-agent-task-result.dependency.spec.json,agent-route-capability-manifest.provider.spec.json}` 的真实 provider/repo/contract；已对齐的 `astra.production-control-v6` v1 依赖及运输机制直接复用。处理 min_count=0、材料顺序、角色、scope、未知字段与当前结果 Schema；删除旧 43 分母及旧仓 fallback。现有 `contract-inspection.ts`、`authority-inspection.ts` 和 `agent-route-contract.acceptance.ts` 同步唯一来源。

只回必要决定、问题、版本、实际 coverage、产物引用及原交付清单；动态另按公布结果合同清理并有限表达，不广播提示词、完整 Work 回答或文件正文。AGENT 不私加动态字段或建设网站展示。无合适公开内容不造进度，必要异常仍回原链。

验收：新八条当前公开路由与 Catalog 双向一致；S01 空附件及材料覆盖、正式 producing identity、父结果/同版关联、同结果重投、迟到旧结果、取消、Outbox 回执丢失均遵原合同。网站接纳仅作为外部业务终点 readback，网站缺项交其 Owner，不在本仓填假成功或追加网站施工。

### W7　修正原生质检分母及完整收口

Owner：原有 architecture-boundary、code-purity、GPT 与 agent-production-runtime 检查器。修改精确对象：`scripts/audit/domains/architecture-boundary/components/{scan-active-plugin-gate.ts,scan-plugin-capability-boundaries.ts}`、`scripts/acceptance/{architecture-boundary.acceptance.ts,product-plugin-test-runtime.ts,agent-route-contract.acceptance.ts}` 及现有 GPT/Runtime acceptance 的受影响用例。

先审检查必要性：保留真正阻止跨产品偷调、叶节点互调、私有能力穿透、无人消费插件、错路由/材料、重复副作用和伪证据的保护。删除“目录数必须等于外部产品数”及旧产品专属断言。检查器从实际静态 import 和生产调用识别 S00→叶入口，不靠白名单、注册空对象或新影子 Catalog 放行。

新增 `scripts/acceptance/product-plugins/s00-paper-factory.acceptance.ts`，在既有原生 architecture acceptance 中显式调用；依第9节有限分支区分正确链与明确错误实现，付款现有 acceptance 原位增强。GPT 新 Child 用现有类型/输入分母/真实页面证明框架，保留原 Child 全部消费者。仅目录存在和 mock 顺序证明不了 Work 或论文质量，按证据层分别报告。

施工后主 Codex 两遍对实际代码与本方案逐项审计；再用未参与建设的只读子智能体审查实际建设和漏项，而非只重读方案。子智能体未放行不得报建设完成。其后执行本仓唯一 `npm run quality:check -- CHANGE`，按冻结 CI-FULL 完成 clean 提交、首次 main 推送、完整 `npm run quality:check -- READY`、适用 §79 及第二次推送。实际参数以原生入口为准，不改造入口或创建 wrapper。

并行改动或无权处理的删除阻止 clean 时如实停止提交/READY，不夹带、不 stash、不另建分支/worktree。已有 `gpt-stopped-empty.acceptance-support.ts` 删除的授权及生产归属必须独立核清，不能用全局删除许可抹平。CI 出现案件按冻结 Skill 的原三法官合同处理；本次设计审查不是三法官庭或 §79 审查。不执行 RELEASE、部署、资金操作或业务数据库迁移。

## 9. 有限验收分母及证据取得时点

本轮必要局部穿透单元：GPT 原回合五次重试至 Runtime source settlement 的编译合同。范围限当前 typecheck 实际命中的 production-child-tools、production-execution-session、production-call-preparation、production-browser-lifecycle、browser-mutation-evidence、runtime-source-handoff、store-source-settlement 及对应 acceptance；依据为原冻结五次重试、同 effect 防重、原 source/receipt 合同。由一名只读子智能体激活穿透 Skill 和字段合同，沿类型生产者→真实消费者→原保护断言定位差异，主 Codex 核原件后建设。当前仅授权材料和源码静态局部复核，不启动 Browser/服务或制造业务任务，不落穿透报告/日志；动态效果未审，不得据静态编译结论宣布生产吻合。使用原 typecheck 输出作为本次观察，出现超出该有限图的对象先返回缺口；单次取证预算十五分钟，查明差异及精确消费者即可返回，不创建第二方案或修复代码。

本轮 CI-FULL 已对 `npm run acceptance:gpt` 的两项失败取得 J1/J2/J3 同题三票：均保留必要保护并裁修。A 的首断为 `gpt-frozen-attempt-inspection.ts::textResponseTwoGateSettlementIsFrozen` 以已退出的二十分钟整模块模板否决现役 V35 实现，直接消费者为 `gpt-exact-target-source-support.ts`，同源等待投影与 `gpt-provider-contract-inspection.ts` 也须按当前合同核对；A 定为中度，由原 J1 仅作独立技术取证。删除旧模板、旧窗口反例及已退役 SEO 专属消费要求，在原 GPT Owner 中建立有限 AST 正反证明，保留 DONE 控制祖先、stop/body、原 marker、raw/semantic 原样、wait/abort/timeout及新空结束出口。不新建通用解释器、源码白名单或生产模板副本；原 atomic identity、readback 和独立冻结检查直接保留，不进入删除分母。

B 的首断为 `gpt-production-artifact-recovery.acceptance-support.ts::sourceAuthority` 缺少现役必需的 `readJobBrowserHistoryEvidence`，经强转进入真实 companion reader 才抛 TypeError；B 定为轻度。局部修改测试夹具，按指定 job、原根 effect、attempt/revision、WAL 和原 URL/user 身份提供可信历史，明确本场景没有附属 retry；保留原件、图片、零 acquisition/页面/submit、完整 companion 和逐 effect settlement 验收。真实 Browser reader 与生产 companion 核验经论证直接保留，不增加缺方法默认空历史、optional 或 fallback。相关 lawId 证据引用按 active 版本机械同步。

A/B 为 W7 的质检局部修改，分别与生产片区重建汇报。施工先物理移除明确退休的旧模板/专属反例符号并读回缺席，再在同一保留文件内独立实现现役证明；不删除同文件中经裁决保留的 atomic/projection/readback 职责。夹具不声称整文件重建。验收为当前正确实现和明确错误实现可区分、原件/图片 source 恢复零输入，以及原 `acceptance:gpt` 全链；失败保留原始结果，接回同一方案。无生产回退、改法或动态效果声明。

工厂交接另核 declared critical/unresolved 与 continue 的一致性、S06/S08 引用的同版稿与独立上下文，以及原提交恢复不再申请新材料链接。S10 固定脚本覆盖条件上传、已有对象、未知、拒绝、全字节读回、越界路径和损坏容器；本地夹具只证明机械合同，实际 Work 文件与 R2 状态仍需动态读回。

每项均覆盖其真实消费者；相同机械合同可以共享一次证据，不以默认入口抽样替代完整成员。以下是当前需求的验收分母，不是新状态机或第二质量门。

| 分母 | 必需命题及 readback | 工单 |
|---|---|---|
| 合法/未知研究动作、付款 observe | Catalog 与当前 provider 双向集合相等，未知动作不执行，付款原观察仍可运行 | W3/W6/W7 |
| 十二工序及专业正文 | S00 固定调用真实入口；每根专业内容进入自己的 prompt；叶节点不 complete/调兄弟；原件与全文实际可读 | W5/W7 |
| 售前零/有附件、资料不可读/缺关键条件 | 无正式目录亦能 S01；实际覆盖及缺项回传，不因空附件机械拒绝，不擅放付款 | W4/W5/W6 |
| 已付款目录、原件转存成功/部分/未知/重通知 | 同账号 marker 唯一绑定；逐件同版/实际读取；未知不重复创建、不删未核材料 | W4/W5 |
| S02—S09 正常及第5节各返工 | 原要求可追到证据和全文；核验隔离；重大未解决问题不前进；返工版本重新复核；无用户中途补料 | W5 |
| 档位、模式及容量 | 三档使用真实配置和 observed profile；Work 不足、预算到限有实际受阻结果，不用 Chat/API 降级 | W4/W5/W6 |
| 同版 DOCX/ZIP 及许可、保密 | 实际打开、渲染核读、解包核件；研究证据可复查，内部车间信息不进入客户包 | W5 |
| 条件上传成功、拒绝、未知、回读不符 | 原对象 exact key/hash/bytes；完整 GET 比对、逐件原报告；未知先 readback，不重生成论文 | W5/W6 |
| 取消、失效、旧结果迟到及副作用未知 | 保留原身份/WAL/资产；阻止新输入和自动发布；原结果优先交付，恢复只消费原 Owner 合法授权 | W2/W4/W6 |
| Outbox/回执丢失、重复 complete、结果重投 | 同原结果/hash 收据读回，producing identity 不变；清理失败不撤已成结果 | W3/W6 |
| 维护 inspect/repair_files/delete_expired/delete_closed | 绑定原同版稿和明确 purpose；期内修同版不重置期限；到期/终止清理有真实缺席读回；hold/未知不擅删 | W5/W6 |
| 旧业务及无必要重复结构 | 第6节旧根、专属测试、导入、路由、配置零残留；付款及公共异常保护仍在 | W2/W7 |

设计阶段取得依据、当前首断和目标合同。施工时取得删除后的即时缺席、实际新调用和机械测试。Work/文件/归档动态证据在实现后按同单同版取得；外部实证只在已获授权的环境执行，不因方案而任意操作客户订单。研究质量由真实样稿及证据复核证明，不以静态命中数、READY 或模型自称合格替代。

正常完成业务终点仍为对应必要结果被业务域接纳，DOCX/ZIP 在 Work 与 R2 同版存在，并由网站确认用户可领取及准确期限。AGENT 实现或 READY 尚未取得这些事实时分别报告未验证；不得为了不碰网站而冒称全链业务完成。

## 10. 重构纪律、停止与交付

每项写入前确认授权、当前 Git 状态、相关规范和实际引用。每项保留在删除前按第6节明确合同、真实消费者、唯一来源及删除反事实。新结构还须证明当前消费者和现有更短方案不能承接；不能证明的新增不建，已存在且可安全删除的退休。

重建对象严格执行物理删除→立即读回缺席→从本方案合同独立建设。禁止旧文件局部加工后删除写回，禁止内存/临时文件/Git 历史/复制改名恢复旧骨架，禁止兼容桥。经裁决保留的独立公共模块直接使用唯一原件；付款局部修改如实分类，不能称整片重建。

发现漏列职责、真实消费者、未知副作用、冻结授权缺口或相关来源漂移时，只停受影响动作，先回补本方案并按原权限接续。无已授权自动回退；禁止 reset/clean/stash 或恢复旧产品绕过问题。原任务结果、未决输入、原文件和回执不因施工失败被清除。

方案须经主 Codex 三轮审计后，再由未参与建设的子智能体独立审查源头、法案及本方案；不以百分比自评或历史子审代替本轮放行。代码准入另经 W1 两遍主审；代码完成另经 W7 两遍主审和实际建设子审。不得互相抵扣。

最终按精确对象分别报告：真正重建、经论证保留、局部修改、删除退役、失败回退、尚未完成。施工纪律与功能质量分别验收。违规时明确“未满足重构要求”；过程证据不足时明确“无法核实重构纪律”。原生检查、提交推送、Work 实证与实际业务交付分别据实报告，不把下层证据当上层完成。
