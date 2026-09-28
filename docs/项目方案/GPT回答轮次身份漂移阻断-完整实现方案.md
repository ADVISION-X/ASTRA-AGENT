# GPT 回答轮次身份漂移阻断－完整实现方案

## 0. 状态、Owner 与减法结论

**状态：已获双仓施工授权；法案与施工图完成两遍主审计，代码和质检正在验收。**需求 Owner 是 AGENT 的 GPT 文本回答能力，Browser 是唯一页面事实 Owner；Website 仍是任务恢复和业务接纳 Owner。唯一方案文件就是本文。`GPT文本回答两门禁冻结-完整实现方案.md` 等前轮方案保留为已落地约束及历史线索，本次不另开第二个回答读取链。

本次可证明的主阻断用**替换**解决：已确认提交的 ChatGPT `data-turn-key` 在后续页面观察中改变，故文本回答读取不再把提交时 UUID 当作历史 DOM 的永久主键；改为在原 canonical URL 的当前 Document 内，以 Product 已放进原用户消息的 `turnMarker` 唯一定位 user 单元及其紧邻 assistant。提交时 UUID 仍作为原 WAL 收据保存，不改写旧 WAL。只保留现有唯一 Browser FIFO、当前 Target/Document 鉴权、两门文本结算和原 Outbox→Website 接纳链。不得新增 locator store、fallback、队列、timer、状态机、表、服务或跨仓业务字段。生产源码合计净行数以**下降**为施工目标；删除旧 UUID 专用判据和随之失效的重复校验后再计数，不得为追求数字删除 at-most-once、唯一性或当前页面安全证据。

第三张 en-US 工单八次在 profile-open 前零 Provider 输入失败，现存页面已丢失，不能证明是选择器、页面尚未就绪、Target 错误或扩展政策。它是独立的取证阻断；本文不把它伪装成上述文本读取修复的已解决分支，也不凭 `CAPACITY_ZERO` 推断永久死锁。

## 1. 业务终点与事故证据

终点：同一 `job_id / attempt_id / result_revision / product_step_id / call_id` 的原 `CONFIRMED` Browser WAL effect，经**零新增 Provider submit**读回唯一相邻文本回答；现有 Forensics 写入并读回回答 artifact，Runtime 原 Outbox 交付，Website 对同一结果完成 localization admission、receipt 与领域对象读回。ChatGPT 页面有回答、Browser `CONFIRMED`、AGENT artifact 与 Website 接纳分属不同证据层。

2026-09-28 18:17Z 前一轮只读取证：

| 工单 | 原 WAL 与当前页面 | Website 状态 |
|---|---|---|
| `aiprod_859179a0-b138-43a6-9c00-a930ff519de5`（ko-KR） | `article_synthesis/turn-submit` 的唯一 provider effect `CONFIRMED`、物理输入 1；原 URL 的当前 user turn UUID 为 `067470a0-d3be-45ba-b770-b8f63a12ce6d`，含唯一 `[GRASSEYE:91c9f33e66d8948d79d595d8]`，紧邻 assistant 已有约 23k 字且 stop=0；原 WAL `userTurnId=63e3c95f-38a3-457b-8698-5b0774085d53` 在当前 DOM 不存在 | 当前 attempt `a54e7a46-ae96-4863-842c-521cd613df63` 未 staging、未 admission |
| `aiprod_8f097f0a-e268-4c57-ad71-70b5d0fcc8e8`（ja-JP） | 同类唯一 `CONFIRMED`、物理输入 1；原 URL 的当前 user turn UUID 为 `f10eb82b-9b0d-4a8b-a4b7-d0bc4c06dd0f`，含唯一 `[GRASSEYE:3cd431dd3eb7dfde6a819c9d]`，紧邻 assistant 已有约 23k 字且 stop=0；原 WAL `userTurnId=e767a2af-3fde-49da-b279-a8522bd3dec5` 在当前 DOM 不存在 | 当前 attempt `2d40b174-12f4-4c1c-a384-7d7f8b1864a8` 未 staging、未 admission |
| `aiprod_a8cd43af-92d4-401c-a722-e582a8aaf2b1`（en-US） | 八次 `GPT_EXECUTION_PROFILE_OPEN_QUALIFICATION_INVALID`，`trigger_count=0`，`mutation_outcome=no`；该 job Browser WAL 零行，当前事故 Target 不在 | 当前 attempt `93c8259d-4b10-4129-b1ac-8c878cff2fa2` 当时失败、未 admission；Website 已签过多次新 attempt |

原 WAL 在直接提交后曾对原 UUID 给出 `rawCount=1/eligibleCount=1`，所以不能把旧 UUID 说成“当时就没拿到”；变化发生在后续页面呈现。当前页面唯一 marker + 相邻回答证明有可读候选，**尚不证明内容满足 Product 结果合同**。AGENT 停止后当前 Website 状态可能漂移，施工或动态证明前按同一身份重查。

取证来源：AGENT 原 `.grasseye-local/browser/browser-mutations.sqlite` 的同 job `provider_effect` 和加密 recovery payload，只读 Chrome 原 canonical URL 当前 DOM，以及 Website 数据库同身份 `ai_production_job_runtime`、`ai_production_job_failures`、`ai_production_output_artifacts`、`localization_jobs`。WAL/页面/Website 三种事实未互相替代。

## 2. scoped candidate 与前轮连续性

| 仓库 | 基线 | 本次相关片区 |
|---|---|---|
| `/Users/nexgen/Documents/AGENT` | `main` / `7f69c3c92746a8ee8e7690d56defa96fb6b22e16` / `origin/main` 同 SHA；设计前 Git clean | active law `功能法案.md` SHA-256 `59e2eaea0db2e1d22fa5b9a5d31882e6bb139c40071ca8bbf1c66684a38af9d2`；GPT Blueprint `1740e2dccec5a9ca65c399d05885cc50bd7bd7701cb433266626a5ad98918f7a`；Browser Blueprint `c9d0bc799af156df4f304102de6039602032932736b716ff677c25a9271d073f`；Browser exact reader `f5369b215baba68dedff9c353eea2cd94677098bba8b449b19d30b8588e19c40`；GPT checkpoint handler `d2407886e1e0638f1934bcce95d73cdc749a5c8f3a21f4307f1a688a9e875cef` |
| `/Users/nexgen/Documents/xuanxue-web` | `main` / `5b551913719179d86857eb534329008b7d728b61` / `origin/main` 同 SHA；设计前 Git clean | active law `功能法案.md` SHA-256 `186fc6a66b7801ad79f98c6dfdfc73632831eaa4bbccae89096e5376cd4bd8c4`；AI Acceptance Blueprint `dce858b8fd9a08b179827e4f799fc3ddbed47cd9b615aec5f045793850917c8f`；`job-lifecycle-core.ts` `890b87062d3f07b379e2911072d1de4a80d22141de4871639e65ce3d02a534e1` |

施工须以当前文件 SHA-256、branch、HEAD、tracking、dirty overlay 重新绑定；表内未列出的直接修改对象同样须施工前记录完整 hash。本文新增后另记其文档 hash，不纳入源码候选。目标路径原先不存在；无既有同名方案或用户脏文件。

有限回归筛查命中：`b011eeb34` 冻结两门文本合同，`13c45fbc9` 固化 checkpoint 判定，`168179db0` 强化精确轮次，`2d91f893c` 已删除“完成后新增的 selection wrapper”误杀。保留前轮已经落地的两个不变量：**唯一可归属的相邻回答**及**stop/正文的唯一结算门**；本轮只替换经事故证明不稳定的 DOM UUID 定位项。`GPT文本回答两门禁冻结-完整实现方案.md` 是前轮门禁来源，`GPT稳定会话地址恢复-完整实现方案.md` 处理的是 effect/failure 事实，`GPT父会话多attempt历史身份消歧-完整实现方案.md` 处理父 WAL 选择；均不承担当前 DOM UUID 漂移的未完施工。`十小时连续运行事故分组根治-完整实现方案.md` 是连续运行历史线索，不提供当前生产完成证明。

## 3. 四维断点与有限分母

**第一直接断裂**：`src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts:42-62` 以当前 `data-turn-key === 原 WAL userTurnId` 为唯一 user 候选；旧 ID 已从原 URL 当前 DOM 消失，返回 `exact-user-turn-unavailable`，随后 `src/capabilities/gpt/children/checkpoint_gpt_text_response/handler.ts:148-196` 只能等待至预算结束。Website 没收到结果是下游后果；不是因为 WAL `DISPATCHED`、Chrome 扩展全局死亡或 Website 永远不发工单。

| 维度 | 当前权威、Owner 与目标 |
|---|---|
| 法案 | AGENT `.github/instructions/agent-rules/功能法案.md:762-764,810-811` 将正常读取冻结为 URL+exact UUID、两门判定；Website 同文件 `:854` 冻结相同恢复语义。当前法案与可观察页面冲突，**须分别获授权后原位替换并重新冻结**。 |
| 施工图 | AGENT `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md:54-56,82-84`、`docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md:35-39,57-61` 及 Website `docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md:74,152` 同步缩窄为**文本** marker 定位；媒体读取保留原路径。本轮不加入历史 Prompt hash 重算。 |
| 实现 | Product 已把 marker 原样放进用户消息并把 `turnMarker` 交给 checkpoint（`src/plugins/localization-production/flow.ts:84-87,185,235-249`）；checkpoint `:106-114` 却只校验它存在后丢弃。Browser reader、materialization、reply binder 与 GPT decoder 均强制旧 UUID，形成同一断点的多处投影。原 WAL 的 effect/URL/UUID 和 Outbox 可复用。 |
| 质检 | AGENT 唯一 `npm run quality:check -- CHANGE/READY/RELEASE`（以实际 CLI 参数帮助为准）；Website 唯一 `quality:check`。定向 DOM fixture/acceptance 仅证明读回语义；RELEASE 的真实 Browser effect 及 Website 同身份 admission/readback 另证明生产闭环。基础法案对源码文件 500 行、函数 75 行等结构预算继续适用。 |

有限分母只含：①原 effect 已 `CONFIRMED`、当前 DOM ID 不变；②原 effect 已 `CONFIRMED`、当前 DOM ID 变但原 marker 唯一；③ marker 缺失/多义或相邻 assistant 缺失；④ stop 仍在、停止且空、停止且非空；⑤已读回答的 Product/Website 接纳或拒绝；⑥第三张的原零输入 profile-open 事实。①②由 Browser 当前 URL/Document 的**同一 marker 判据**处理，不建立“先 UUID 后 marker”双读取；③仍走现役 pending/有界负观察与 Website 原恢复 Owner，不能自动重发；④沿原两门；⑤沿原 Outbox/Website；⑥保留原 attempt/source-handoff 和下述证据门，当前不得构造修法。

identity spine：Website `job_id + attempt_id + result_revision` → Product `product_step_id + call_id + turnMarker` → Browser 原 `provider_effect_identity + CONFIRMED WAL + canonical URL + submit 时 UUID` → 当前 `Target + Document + 唯一 marker 所在 user 单元 + 真实紧邻 assistant` → GPT artifact hash → Outbox result identity → Website admission receipt/领域对象。旧 UUID 是**提交收据**，不可删除或伪造为当前 DOM ID；页面 locator 与 effect authorization 仍严格分离。

## 4. 唯一目标链、删除审判与工单

**删除审判**：保留原 WAL（at-most-once 消费者）、canonical URL（当前会话导航消费者）、当前 Target/Document/FIFO（页面动作消费者）、Product marker（已经在用户消息与 checkpoint 合同内）、唯一 user/assistant 邻接证明（防串工单）、stop/正文两门（结算消费者）、原 artifact/Outbox/Website admission（业务消费者）；删掉任一项均有对应现实分支失去身份、安全或入库证明。删除文本回答中“旧 DOM UUID 必须永久存在”的选择和对此重复比对；旧提交 UUID仍留 WAL 与提交收据，只不再充当后续页面主键。沿唯一有界物化读取：文本最多 80 步、图片仍最多 48 步，文本把**命中条件**换成同一 marker 的 user 单元；不加第二遍扫描、额外滚动、侧栏搜索或补充持久化。`promptHash` 已在 WAL，却不引入历史正文重算：这会重新引入已冻结且曾有渲染漂移问题的门禁。

### W1：授权后原位替换冻结语义

- Owner：两仓各自法案 Owner；范围限架构边界、GPT/Browser/Website 命中法条、版本引用、施工图、对应唯一 registry/inspector 投影。授权人已明确同意本方案并授权双仓法案、施工图、代码、质检与数据库修改；本轮精准替换 `TARGET-AUTHORITY-BOUNDARY-001` 中旧 UUID 定位句、`FROZEN-GPT-CONVERSATION-LOCATOR-EFFECT-SEPARATION-001`、`FROZEN-GPT-TEXT-RESPONSE-TWO-GATES-001`、`FROZEN-EXACT-TARGET-POLL-RESULT-REVISION-001` 及两份施工图 `FROZEN-GPT-RESPONSE-NO-PROMPT-REHASH-001` 中旧 UUID 定位句，立即重新冻结。架构边界的原逐字节考试必须同步改为新法条，不得假报原 SHA 仍成立。
- 目标：只把**文本回答**的稳定定位定义为原 URL + 原 Product marker + 当前唯一 user/assistant 邻接；提交 UUID 与图片读取、WAL/effect/风险授权、stop/正文规则不变。Website 不接收 marker/URL/DOM，也不增加业务字段。两仓原位替换后立即重新冻结，不保留新旧双语义或兼容期。验收：两仓法案、施工图、唯一 inspector/registry 版本一致；旧 `URL+UUID 必须读文本` 的活动断言零残留，图片原断言仍成立。

### W2：AGENT 原 Browser 文本读取链原位替换

- Owner：AGENT Browser；范围 `src/lib/browser/exact-target/browser-dom-intent.ts`、`browser-dom-read-intent.ts`、`browser-exact-assistant-turn-reply.ts`、`exact-assistant-turn-revision.ts`、`src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts` 及直接调用方。`checkpoint` 已有 `turnMarker`，仅原位传给现有 `readExactAssistantTurn`。文本读取的唯一 user 候选必须处于 WAL 原 canonical URL 的**当前** Document，具唯一 user role/bubble、唯一原 marker、唯一真实相邻 assistant；观察的当前 UUID 只作为当前页面事实，不能谎报为原提交 UUID。reply/revision/decoder 机械绑定原 request marker 与当前 observed user UUID；若既有 v3 语义不能安全承载，原位升为 v4 并同提交原子替换全部消费者，**不保留 v3 兼容分支**。
- 删除旧 UUID 选择与相应重复校验，物化函数只复用原有界遍历。2026-09-28 当前 ko/ja 真实页面的会话容器 `flex-direction:column-reverse`，底部 `scrollTop=0`、顶部约为负 5.3 万/负 5.0 万；每步 0.8 屏时 48 步达不到顶部，而且把 0 当顶部会虚报完整扫描。文本上限改为 80 步，依据当前容器方向计算顶部，未走完仍返回 typed unavailable；图片的 48 步边界保持。必须在同一次有界遍历中覆盖完整可访问的 user 轮次并证明 marker **全程恰好一次**；若页面虚拟化使遍历无法覆盖全部轮次或命中后无法在同一当前 Document 重新物化相邻 assistant，返回现役 typed unavailable，不把“当前可见的一条”冒充全会话唯一。marker 为 0/多于 1、role/邻接不唯一、URL/Document/loader 变化均失败关闭，不用页面末位、标题、时间、旧 tab、Prompt rehash 或 marker 命中后的第二身份门。Provider submit、Browser WAL、media reader、Product Prompt 与 Website runtime 不改。完成门：两个事故 URL 的相同身份回归分别归还正确 assistant，物理 submit 增量 0；当前 UUID 不漂移也走同一 marker 路径；多 marker/错 role/错 URL/错 Document 返回 typed negative/invalid，不产生 artifact。

### W3：AGENT 原 GPT 消费与现有验收

- Owner：AGENT GPT；范围 `src/capabilities/gpt/children/checkpoint_gpt_text_response/handler.ts`、`src/capabilities/gpt/web/gpt-dom-observation.ts` 与既有 Browser/GPT acceptance fixture。只运输既有 `turnMarker`，核新单一 reply 身份，再沿原 stop/正文逻辑结算。不得把原提交 UUID 与当前 observed UUID 不同解释为重发资格。`src/plugins/localization-production/flow.ts` 的 marker 生成及 Prompt 零修改，Forensics/Outbox 零修改。
- 定向验收：原 UUID 与当前 UUID 相等/不等均唯一读回；重载、Target 丢失后的 URL 精确导航、已确认 effect 恢复全部零 submit；marker 缺失/多义、相邻回答缺失、stop 存在、连续 20 分钟停止且空回答沿原事实与恢复链；原已完成 artifact 幂等读取。统计 `src` 改动行数和净行数，净增加即回到本文逐项说明不可删除的真实消费者后才可继续，不能新增包装层冲抵。原生质量入口决定 CHANGE/READY/RELEASE，测试不冒充 Website admission。

源码减法复核（当前候选，对原基线 `7f69c3c`）：`git diff --numstat 7f69c3c -- src` 为新增 177、删除 92，净增 85 行；其中 `src/.../acceptance` 定向回归净增 18，生产源码净增 67。主要增量为原 Browser exact reader 净增 56：同一现有读取函数必须跨虚拟化滚动完整证明 marker 唯一、识别现场 `column-reverse` 的负顶部并恢复命中位置；不完整或未知滚动根必须返回 unavailable，否则会把局部唯一误作全会话唯一。其余生产净增 11 用于 marker 的请求/修订绑定、正向 canonical URL 校验、GPT 原字段传递与现役代码纯度门槛内的重复校验合并。已删除旧 UUID 定位及其重复判定；没有新增文件、Owner、状态、存储、兼容路径或第二读取链。此增量有当前 ko/ja 现场和原 Browser/GPT 消费者，不能为追求净行数而删掉完整性或错误会话的失败关闭；测试文件的删减不抵扣生产源码。

### W0：第三张零输入失败的证据门（无代码施工）

- Owner：AGENT Browser/GPT 取证，Website 只提供 attempt/failure 读回。当前已知 `openGptExecutionProfile/observation.ts:133-149` 因 trigger=0 判 `TRANSIENT_DOM`，同一 Target/Document 三次观察后 `handler.ts:51-59` 失败；八次无 WAL provider effect。下一次经授权的运行只读取**该 job 当次 Target** 的 URL、主 frame/Document、trigger 的 raw/eligible cardinality、当前页面实际 model 控件及同 attempt failure/WAL；不得为了取证启动 Website、向 Provider 输入、删除工单或触发重复任务。当前事故 Target 已消失，历史日志不能判定它具体停在哪个页面，所以本工单目前没有代码删改范围。得到同一时刻的页面事实后再在本文原位裁决是删错资格条件、修现有 acquisition，还是保持原判定；不得先加 selector OR、无限重试或第二 Target 恢复器。

## 5. 跨仓顺序、停止与回退

1. 施工前重新绑定两仓相关 Git/authority/目标文件与 Website 当前同身份业务状态；凡用户 dirty overlay 命中目标路径，保留并停止覆盖。授权已取得；先完成双仓全部现役法案及施工图至少一遍诚实遍历、主 Codex 两遍审计，然后原位更新 W1。凡改变规范义务的 lawId 按冻结说明书第 72 节升 major；必要的依赖版本、Manifest、现役 spec、Inspector 和唯一 registry 同步对齐。法案与施工图完成两遍主 Codex 自检且核对清单覆盖至少 98% 后，才进入 W2/W3 生产代码。
2. AGENT 的 W2/W3 与两仓 W1 在**停止旧执行**的同一切换窗口落地、各用自己的原生 `quality:check`。Website 只更新本次权威语义，不变更 task/result/V6 wire、Schema、业务代码或发布步骤；因此无跨仓业务协议双版本窗口，也不建迁移桥。
3. 未获 W1 授权、旧 AGENT 仍执行中、质量失败、旧 WAL/URL/marker 多义、当前 Website 已接纳同身份结果，均停止进一步动作并先读回；不能清 WAL、删 job 或凭页面答案手工伪造 admission。回退只回退**尚未执行生产新语义的代码/文档候选**，不得回滚原 provider effect 或已接纳业务对象；一旦新语义已执行，先用原 WAL/Outbox/Website 同身份读回裁决再选恢复点。
4. RELEASE 动态证明才允许对真实 job 验证 Browser 原 effect 输入计数仍为 1、回答 artifact/result hash 与 Website admission receipt/领域对象一致；ko、ja 两张必须分别核实，en-US 仍按 W0 的独立证据门结案。没有 Website 接纳不得报告“工单完成”。

**当前剩余阻断**：en-US 的事故页面缺席，不能指定删改点或宣称第三张已修复。文本回答代码施工以 W1 法案与 Blueprint 对齐和两遍主 Codex 自检为前置；RELEASE 须依冻结 CI-FULL SKILL 完成原生质量与动态证明，未有真实 Website 接纳前不宣称工单完成。
