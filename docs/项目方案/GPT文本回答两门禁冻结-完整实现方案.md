# GPT 文本回答两门禁冻结－完整实现方案

## 1. 本次目标、状态与授权

状态：**可施工**。用户已明确授权本次专项施工、CI-FULL，以及READY后原生启动和正常工单跟进。设计资格与施工进度分开；实际建设、验收与运行结论由本次原始操作和原生报告证明。方案审查不产生质量 PASS、READY 或 RELEASE，不借此前任务授权重跑工单。

需求 Owner 为 AGENT `gpt`，机械观察和回包鉴权由 `local-browser-session` 各守原职责。唯一目标：正确定位的文本回答使用临时 assistant ID 时，不再被 UUID 格式门误拒绝；沿原两门逻辑等待并取得完整回答。删除同一身份校验块中无独立消费者的标题外壳门。禁止增加特殊 ID 白名单、重试、状态、轮询、补救链或 Provider 回合。

本方案复用既有两门冻结方案路径，替换其中已被现役法案承接的旧施工指令和过期版本，不创建竞争方案。四份专业栏目源头蓝图的业务规则、专业材料、Product Skill/Prompt/Flow 不进入本次修改面；本次不改变任何专业结果义务。AGENT 是执行工厂，完成边界只引用 `LAW-AGENT-PRODUCTION-RUNTIME-004-V48` 的完整结果成功接收，不新增 Website 领域采用或发布门。

## 2. 当前证据与第一直接断裂

事故 job：`aiprod_19001ba2-2635-40c1-bf0b-132cf86d567d`；attempt：`5e9a1715-2902-4f65-921e-7cfbc8d2d2eb`。日志为 `.grasseye-local/runtime-logs/agent/46b21faa-6c3e-43b9-800d-1ece5013bc0b-0001.jsonl`，Browser command `18d0f24b-504a-469f-8d2c-982b975c3052`。时间均为 UTC，原日志和本聊天 Chrome 工具回执是事实来源，不另建事故报告。

| 已观察事实 | 证据及边界 |
| --- | --- |
| 原输入已经发生 | 19:29:49.669 原 WAL 为 CONFIRMED、physical input 1；本次不重放。 |
| 原生故障位于最终 assistant 观察 | 日志 22040—22041：19:31:56.640/663，exact-assistant-observation，随后 BROWSER_DOCUMENT_INVALID。原日志没有精确 if 子分支。 |
| Chrome 仍处于正常生成 | 19:32:56.759 与 19:34:27.330 的只读 DOM：同原 URL、marker、user；唯一 user、真实紧邻唯一 assistant、正文节点 1、h4 1；assistant message ID 为 `fallback-turn-4`、各 token 一致，stop 1、正文长度 0。 |
| Provider 自然完成 | 19:37:25.307：同 URL/marker/user，assistant ID 成为正式 UUID，stop 0、正文长度 13219；没有点击、发送、刷新或导航。该事实不证明 Website 已接收。 |
| 独立故障 | 19:31:57.616 的 AI_SESSION_TOKEN_STALE/401 是后续运输故障，排除本次施工，不抹除原错误。 |

第一直接断裂：`src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts#EXACT_ASSISTANT_TURN_FUNCTION` 在读回 stop/正文之前，要求 assistant ID 符合 UUID。上述合法生成现场必然命中该拒绝条件；这证明了当前实现会误杀该现场，不能追认未同步采到 DOM 的每一条历史错误都由同一 if 引起。其后 `assertObservationLocation`、Browser reply verifier、GPT decoder 还重复要求 UUID；只删第一处不能闭合。

另两张 `aiprod_a0ad4936-c464-47a2-8abe-633a627a3cac`、`aiprod_d290739c-75ad-4be1-a2b6-334a09d87f96` 的同阶段错误后，当前页面已有完整正式 ID 回答，仅作同阶段恢复旁证。历史 68 张/73 次是阶段归类，不能当作本子根因的已证数量。本次没有捕获 user UUID 两次采样间变化或缺 h4；h4 退休来自下述必要性审判，不冒充事故触发实证。

完整 Provider URL、marker、回答正文不写本文或普通日志；定位继续由原加密 WAL 和当前受控页面负责。Chrome 只读工具不提供 loader，不能用 URL 相同冒充 loader 动态证明。

## 3. 来源绑定与权威裁决

项目 realpath `/Users/nexgen/Documents/AGENT`；本地 `main`、tracking `origin/main`，设计来源为实际原生提交 `f0e33c628d92576e2da5c90394c77f9958962e65`。写前工作树 clean，本方案原路径无用户改动。方案自身不作为 source candidate；其最新 SHA-256 在实际交付时读取，不能自嵌 hash。没有第二仓施工、未生成新 candidate identity。

本轮已完整遍历两份 active 法案和七份现役施工图。39 条 active law、13 份 Manifest、registry 的 lawId 集一致；registry 增加的 source/contractRefs 是投影信息，逐项原 law-record 字段一致。七份 Blueprint 的 lawIds 均指向现役版本。以上是来源核对，不是原生质量裁决。

| 四维 | 当前依据、裁决与落点 |
| --- | --- |
| 法案 | `LAW-GPT-001-V68`、`LAW-GPT-002-V33` 的 FROZEN-GPT-TEXT-RESPONSE-TWO-GATES-001；Capability Governance001-V20、Architecture002-V2、Browser003-V49/004-V59/006-V48；Code Purity001-V6/002-V2/003-V3；Forensics001/002-V7、003-V6；Runtime004-V48。只允许原子回答身份和 stop/正文结算，未规定 assistant ID 必须为 UUID。无需改法或解冻，禁止改写两门冻结原文。 |
| 施工图 | GPT V71“唯一 Owner 与职责/两门冻结/证据失败验收”；Browser V58“GPT 提交后置机械定位/两门/pending”；Runtime V69 §§1/4/5 的工厂接收边界；质量证据、日志、启动、Workbench 四图各守原链。目标纠正下级格式假设，不改变七图或 spec。 |
| 实现 | W1—W3：三个生产文件四处 UUID 检查；h4 壳条件同属页内身份校验块。当前字段已是 string，下游完成 artifact 只要求非空字符串及内容 hash。原 handler 已能完成等待与结算，直接复用。 |
| 质检 | 先审现有检查：DOM Exam 把单个 `invalid-assistant` 字符串当非法身份，decoder Exam 再次如此；这只固化错误格式，必须退休其“非 UUID 必失败”断言，改验缺失/错误类型。现役 inspector/治理 mutants 未要求这四条 UUID 或 h4 字面量，无需改检查器。用原 DOM、Actor、GPT、artifact 用例分别覆盖真实边界，不新建测试框架或 verdict。 |

母本按 §§0/4/35 定为方案 CHANGE；相关 §§21—24/35—38/41—44/46—55/74/77—79 适用。闭环 Skill 已实际完整读取两遍；子审前另完整读取 subagent-review。执行前主 Codex 再以现役原文完成不少于两遍法案/施工图自检；存在规范冲突时禁止进入代码，不能用“98%”自评分跨过缺口。

未来七个施工文件的基线如下，施工前连同上述权威、原 handler、hash/revision、公开类型、注册、消费者和质检入口重核实际 scoped diff。无关漂移保留；相关漂移只重算受影响决定，不覆盖他人改动。

| 路径 | 行数；SHA-256 |
| --- | --- |
| `src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts` | 240；`0fbf377e462fb5a61c870e002b50a4c2f28b8af04a4fadde1400f04aabc75028` |
| `src/lib/browser/exact-target/browser-exact-assistant-turn-reply.ts` | 81；`021a27ef81a88e625ba33f42235f8734f9c6263803e29619990213110356fee8` |
| `src/capabilities/gpt/web/gpt-dom-observation.ts` | 362；`7b996bc4598c41d487aa0ecab5f22b98999f5c740c81b1ca208083aea30ac541` |
| `scripts/acceptance/local-browser-exact-assistant-turn-support.ts` | 383；`78b980ff2ac7da708c3b3950c2ed0099292817845c08fbc9790548a4fd8232f1` |
| `scripts/acceptance/local-browser-terminal-rejection-support.ts` | 451；`d8bdb504ac5b8118a48d92f9696f735b46a0cd90b516d90375ccf2236db41cfe` |
| `src/capabilities/gpt/acceptance/gpt-proof.acceptance.ts` | 164；`cdeefab3370f252762e2e86933dedaeef4c607f493f6e8a0480fe1beb2b43a24` |
| `src/capabilities/gpt/acceptance/gpt-production-artifact-recovery.acceptance-support.ts` | 419；`6be3222672e8ab79482630ad8d80c25381e40983688a13e7660f7e00774071da` |

## 4. 受影响实现、消费者与前轮连续性

交叉查漏有三类不同来源：①`src/capabilities/gpt/contract.ts` 的 Child 合同、穷举 `handler-registry.ts` 与 Browser `command-registry.ts`/`dom-intent-runtime.ts` 的分派；②assistantTurnId 符号/类型、Product 实际调用和 artifact/storage 反向消费；③原 WAL、日志与 Chrome 同现场观察。注册入口和实际调用均汇入唯一文本 reader，source/cache 则沿完成 artifact 回读；两类差异是现役合法路径，不能误添第二 reader。

唯一 live 链：Product 原输入 → checkpoint handler → `readExactAssistantTurn` → Browser command Actor/permit → Extension 固定 Document 读取 → Extension decode/bindReply → Actor `bindExactAssistantTurnReply` → GPT decoder → 原 stop/正文结算 → `production-child-result.ts#persistGptChildOutcome` 与 `evidence-artifacts.ts` → 原 Product result → Runtime 原 stage/terminal Outbox → Website 同身份完整结果成功接收回执 → `runtime-business-admission.ts#reconcileBusinessAdmission`/Store local completed。Provider 生成和 Browser pending 不创建持久回答；只有原成功路径封存 artifact。

全部 13 个 Product 调用点均位于 `src/plugins/`：`hehun-ai-analysis/flow.ts`、`hehun-report-followup/flow.ts`、`qimen-professional-answer/flow.ts`、`qimen-report-followup/flow.ts`、`public-knowledge-article-pipeline/seo-gpt-calls.ts`、`localization-production/flow.ts`、`zeji-personal-selection/flow.ts`、`naming-commercial/flow.ts`、`naming-from-existing-bazi-report/flow.ts`、`payment-screenshot-observation/flow.ts`、`bazi-ai-full-analysis/product-turn.ts`、`bazi-chart-interpretation/product-turn.ts`、`bazi-report-followup/product-turn.ts`。输入和 Child 输出字段不变；使用 assistantTurnId 的成员只消费字符串及 artifact 绑定，其余消费正文/原 artifact，不要求 UUID。全部保留，通过原 `acceptance:architecture-boundary` 发现并运行各 Product 原验收，不手写新的测试分母。

| 精确对象组、唯一 Owner | 处理决定及停止依据；验收 |
| --- | --- |
| Browser `dom-exact-assistant-turn.ts` 的 marker/materializer/最终读取、`dom-fixed-document-read.ts` | marker 唯一、user UUID/message ids、nullable 挂载保护、真实角色/邻接/正文唯一、URL/loader/guard、完整读取必须保留；删除会串读或丢失长页可达性。只改 W1 片区；V1/V4/V5。 |
| Browser `browser-exact-assistant-turn-reply.ts`、`exact-assistant-turn-revision.ts`、`browser-dom-intent.ts` | W2 只简化 ID 格式；原字段数、V4、exact call/Target/Document、canonical revision/content hash 不可删除，否则伪包可被接收。类型和 hash 算法不变；V2/V5。 |
| GPT `gpt-dom-observation.ts`、`checkpoint_gpt_text_response/handler.ts` | W3 只改前者的 assistant 字符串准入；后者原位复用。handler 已有 stop-present 等待、非空 DONE、20 分钟与身份重置，新增分支无必要；V3/V6。 |
| GPT `evidence-artifacts.ts#observedResponseArtifact/readPersistedGptTextResponse`、`production-call-preparation.ts#recoverPersistedCheckpoint`、`production-execution-source-reuse.ts`、`production-execution-session.ts`、`production-child-tools.ts` | 直接复用。当前文本 artifact 只要求非空 ID，cache/source 均消费同原 reader。ID 不参与 effect、attempt、lease 或 Website wire；停止在不变的结果/receipt 合同，不扩修 Runtime/Website；V7/V8。 |
| Browser `authenticated-media-runtime.ts`、`browser-target-lease-manager.ts#authenticatedMediaShapeValid/readAuthenticatedMedia` | 搜索也命中 assistant UUID，但属于独立图片/精确 user-turn 合同，不消费文本 reply；不删、不放宽。V8 复用原媒体回归。 |
| FIFO/lane/WAL、URL 选择与 continuation、Product、Forensics、Runtime/Outbox/日志、Website | 身份、权限、状态、幂等、副作用和输出字节规则不变。保留各自原权威；新字符串已在既有 string 类型和非空 artifact 合同内，无新增跨仓字段或 writer。原未知/拒收/接收未确认按原 Owner 回接；V7/V8/V9。 |

有限回归筛查命中同片区多轮修改，采用深度调查、窄施工。`git blame` 显示 UUID 条件可追溯至 `3016fe43e`，h4 块由 `86b0873b0` 承接；不能归罪于上一轮 marker 修复。相关旧方案及实际落地裁决：

- 本文前轮的两门冻结已被 GPT002-V33、现役两份图和 handler 承接，保留非末位、Composer 数量不拦截、hidden/inert 不清正文、禁止 Prompt rehash；不重做旧版本法案升级或旧 V3 reply。
- 《GPT文本回答扫描门禁根治》对应 `86b0873b0`：保留 fixed Document by-value、loader 前后守卫、await 物化、真实 stage/cause 和异常资源收束；它未解决生成中的临时 ID，不重建其执行骨架。
- 《GPT文本回答挂载竞态》对应 `c6fd13a1c`：保留 null→合法 user 挂载可读、已观察非空 user 在同一调用内变更仍拒绝；不把本次 assistant 字符串减法扩成删除 user 保护。
- 《GPT当前回答停止状态误识别》对应 `edb63d812`：保留排除 home Composer、当前 stop 的原选择规则；不改 stop 范围或节拍。
- 《GPT回答轮次身份漂移阻断》与当前固定 Product：保留原来源 attempt marker、提交 UUID 仅 WAL lineage、confirmed/source 零输入读回；旧事故不用恢复兼容代码强救，不在本单删建工单。

这些不变量进入 V4—V8；现役旧方案并非本临时 assistant ID GAP 的未完成竞争施工单。只有本文承载本次 W1—W3。

## 5. 删除反事实、目标合同与有限分母

先裁质检，再裁生产。现役测试对“非 UUID 必失败”的期望会强制错误实现，不能由其它格式测试证明其必要；退休这类期望，用原用例检验空/非字符串和真实身份冲突。DOM、Actor、GPT 三层用例分别执行不同的拒绝边界，互不替代；artifact 恢复用例负责证明新合法输出不会丢失恢复能力，不能用 DOM 成功替代。现有 inspector、治理反例、夹具、运行器复用，无新增 checker、样本矩阵或入口。

| 单元 | 删除后的具体后果／更短替代与裁决 |
| --- | --- |
| 四处 assistant UUID 格式 | 删除不会丢失 marker、角色、邻接、唯一性、权限或 hash 保护；能让真实生成现场回到原等待。**删除 UUID 假设**，只承接既有 string 非空合同。 |
| 页内 h4 数量 | 真实 assistant 已由同一 user unit 序列的 `:assistant` 角色与邻接唯一性证明；h4 只为展示，没有独立真实消费者。**删除，不以别的标签检查替换**。 |
| assistant ID 非空、同一消息 ids token 全相等 | artifact 和连续空窗口消费当前 ID；缺失会丢 lineage/混合 token 会掩盖当前消息身份矛盾。**保留**，不新增格式、前缀或跨样本稳定性要求。 |
| 真实 marker/user/邻接、正文唯一、current Target/Document/loader/permit、完整内容/回包 hash | 各有串读、错页、歧义、伪包或内容损坏反例；其它 Owner 不能补证已错误读取的事实。**按原唯一模块保留**，不复制实现。 |
| 原 stop/正文结算、artifact、effect-once、Outbox 接收链 | 分别防半成品成功、丢成果、重复输入和假完成，有原消费者。**原位复用**。 |
| 临时 ID allowlist、按 stop 特判放宽 UUID、等 UUID 变稳定、DocumentInvalid catch→pending、新日志/状态/监听器 | 现有身份与结算链足够，删除它们没有当前需求损失。**禁止建设**，也不新增用于本修复的辅助治理文件或 Agent。审查者只用于本次用户指定独立审查。 |

目标是按现役合同重新推导身份校验片区，而非复制旧块换正则：同包证明原 URL/marker/当前唯一 user、真实紧邻唯一 assistant/正文，读取其**原样非空 opaque ID**并保持同一消息 token 一致；ID 是页面事实，不是 UUID 类型、授权主键或结果完成信号。保留原严格形状、时间、hash、pendingCause 与 counts 关系。body 缺席依旧原 pending；body 已挂载时返回完整 body/stop，即使正文空或 ID 临时。

相邻 handoff：

| producer → consumer | 现役合同及接收证据 |
| --- | --- |
| 固定 DOM → Extension decoder/bindReply（W1） | 私有 Observation 原十字段，rawCount=0/1、多义拒绝；字符串、整数、observedAt、两类 pending 及空内容关系不变；无新 null/default/enum。原 user 身份校验不变，assistant 仅非空/一致；原 URL 与 guard。 |
| Extension → Browser Actor（W2） | `BrowserExactAssistantTurnReplyV4`，positive13/negative14 原字段、原 canonical revision/hash；Actor 按原 permit 绑定 exactCallIdentityHash。unknown/缺失字段、坏 hash/时间、错 Target/Document/URL 仍拒绝。 |
| Browser → GPT decoder/handler（W3） | 原 V4+exactCallIdentityHash，原 user UUID/URL、内容 hash 和 generatingRaw 保留；不新增 pending 类型或把正观察伪装负观察。ID 临时并不改变 stop 结算。 |
| DONE → artifact/cache/source → Product/Runtime | 原 `agent-observed-response-artifact.v1` 六字段与 hash、原 append/readback、原 effect/call/artifact 身份，非空 string 已兼容。没有字段/Schema/wire/事务/lease/fence/receipt 的新增或迁移。 |

Identity spine：job/accepted attempt/result revision → 原 step/call/Child/provider effect/WAL locator → 当前 Target/Document/loader + 原 URL/marker/当前 user/紧邻 assistant → 原 revision/content hashes → 完成 artifact/result hash → 原完整结果成功接收回执/local completed。临时 ID 变 UUID 仅使原 stopped-empty identity hash 自然变化，按原规则归零；不回写 WAL、不制造新输入资格。

| 有限分支 | Owner、决定、终态/readback、回接 |
| --- | --- |
| 有合法回答、stop>0，正文空或非空 | Browser 原包 → GPT 原 stop-present pending；不封存成功 artifact，释放 lane 后原 FIFO 等待；V1/V3。 |
| stop=0、正文非空，ID 为任意合法非空字符串 | GPT 原 DONE → Forensics 原 artifact → Product/Runtime 接收链；V1—V3/V7/V9。 |
| stop=0、正文空 | GPT 原窗口 pending；连续20分钟且身份不变才原 stopped-empty typed failure；stop/内容/身份变化归零，原 Website 恢复权不变；V6。 |
| user/正文尚缺 | 原两类 negative observation → GPT 原 pending/预算和真实 negative-window 终态；无新恢复或持久化；V4。 |
| 多 marker/assistant/body、错邻接、缺ID/混合ID、user矛盾、错页/loader/权限、伪包 | 原 Browser/GPT typed fail-close、保留原 stage/cause，原 Runtime 运输/Website 授权回接；禁止重发同 effect；V4/V5。 |
| 取消、命令到期、lease失效、回执未知、原结果可复用 | 原 guard/typed failure/Outbox/source 处理，已发生或未知输入不重放；同结果合法时只重交原结果。无本次新恢复动作；V5/V7/V8。 |

## 6. 三张原子工单与施工纪律

工单串行 W1→W2→W3，随后整链验收。三者合为同一未加载候选：中间态不能进入运行服务。共同前置为专项施工授权、相关来源重绑定、法案/施工图两遍主审无冲突、原用户改动受保护。七个文件之外无施工权限；本方案外的法案、图、Manifest、registry、协议、依赖、Product、Runtime、Website 和数据库改动为零。

**共同删除/保留纪律：** 片区只包含下述精确校验语句或表达式，不删整个混合函数、常量或文件。先从第5节合同明确新责任；物理删除该旧片区 → 下一次独立工具调用核对旧语句/表达式缺席且独立保留部分仍原位 → 再在同一路径建设唯一新校验。不是“读取旧块→改字符串→删文件→写回”，不得保存旧片区副本/内存模板、Git 恢复骨架、搬移、改名、包装或兼容桥。纯退休对象不重建；经裁决保留对象从未删除，不重新复制。过程证据留在实际工具记录，不另建台账。

### W1：Browser 当前观察身份

- **做什么/输出：** Owner `local-browser-session`；让合法临时 ID 的原观察包到达现役消费者。输入为原 exact intent/current Document，输出仍原 V4。
- **删除什么/重建什么：** `dom-exact-assistant-turn.ts#EXACT_ASSISTANT_TURN_FUNCTION` 中完整的 `if (assistant && (...h4...UUID...ids.some...))` 语句删除后，仅按第5节非空 ID 与同消息 token 一致性重建；h4 与 UUID 永久退休。`assertObservationLocation` 中最后一条 rawCount=1 的 assistant UUID if 删除后，只承接非空字符串事实；当前 URL/user 部分原位保留。不删除整个函数冒充重构。
- **保留什么/为何：** 同文件所有 imports/types、UUID 常量的 user 用途、MARKER_USER_SOURCE、materializer、nullable user 交接、record/shape/decode、stop/语义 reader、hash/bindReply/execute 均直接复用；它们提供唯一定位、可达性和安全数据包，消费者为原 Actor/GPT，删去将破坏 V4/V5。
- **质检局部修改：** 仅 `local-browser-exact-assistant-turn-support.ts#exerciseRealAtomicBody/exerciseRealIdentityChanges/exerciseDecoderAndLoader`：退休“单个非UUID字符串必失败”两类断言，改验空ID仍为DOCUMENT_INVALID、非字符串仍为DOM_READ_INVALID，保留混合ID和非法 user 拒绝。AtomicBody 的原首样本/hidden回归保留；末尾原两组独立setContent/runPage合并为同一用例内的输入表和一次setContent/读取循环，原非末位+stop及JSON语义断言分别承接，加入临时ID空正文生成→正式ID完成、无h4、临时ID停止非空场景。IdentityChanges 仅在原html/code表内替换非法格式行并加入同assistant内两个正文节点的歧义输入，不新增await语句；DecoderAndLoader也只改原patch表。复用原 page/fixture，不加生产导出、函数或文件。
- **顺序/验收/失败：** 按共同删除纪律，producer 与 decoder 同候选闭合；V1/V4/V5，W2 验证真正接收。表外片区不动；真实身份保护受损即停，保留原 WAL/结果，不以删负向断言求通过。

### W2：Browser 回包真实性

- **做什么/输出：** Owner `local-browser-session`；`browser-exact-assistant-turn-reply.ts#exactAssistantTurnIdentityValid` 继续证明原 permit 下原样可信观察，允许原非空字符串合同。
- **删除/重建：** 仅删除数组里 `negative || <UUID regex>(assistantTurnId)` 的完整校验项，独立核缺席后按“negative 保持原语义，positive ID 非空”重建。该项之外的 shape/version/URL/user/Target/Document/hash 与 `exactAssistantTurnValueValid`、`bindExactAssistantTurnReply` 全部保留；删去会接受伪造包，V2/V5 证明必要。
- **质检局部修改：** `local-browser-terminal-rejection-support.ts#exactAssistantFixture/exerciseExactAssistantActorBinding` 复用原合法包与 canonical revision 构造，原既有正向场景覆盖正式/非UUID两种 ID；只增加必要形状变异：空/非字符串 ID 拒绝。原错URL、篡改内容/revision 与负观察反例保留。不删 Actor 的鉴权、不添检查器。
- **顺序/验收/失败：** W1 后进行；实际 Actor 接收新合法 ID 并绑定原 exact call，旧篡改包仍按原 AUTH_TRANSCRIPT_INVALID，V2/V5。不能靠绕过 binder 或伪造 hash 证明成功。失败停止同候选交付，无兼容放行、无生产 mutation。

### W3：GPT 接收与原等待/成果回接

- **做什么/输出：** Owner `gpt`；`gpt-dom-observation.ts#exactAssistantIdentityValid` 接收 Browser 证明的原 string 页面事实，交给原 handler，输出原完成 artifact。
- **删除/重建：** 仅删除 assistantTurnId UUID 的完整 `&&` 表达式片区，独立核缺席后按既有 string 非空合同重建；schema/user UUID/URL/内容哈希和负观察分支原位保留。handler、空窗口、原 artifact/cache/source/所有 Product 代码直接复用，不移除它们的原有安全门，不改错误码或协议版本。
- **质检局部修改：** `gpt-proof.acceptance.ts` 的既有 exact-response 场景使用非UUID完成ID并保留wrong-URL反例；既有stop-beyond-budget场景在同一次handler运行中采用“临时ID+stop1+空正文→临时ID+stop1+非空partial→正式ID+stop0+完整正文”三阶段，保留原预算到期后仍等待、非空partial仍不能DONE的反例，核原等待原因、读数和零新增输入。不以空正文场景替换原非空生成中保护。`gpt-production-artifact-recovery.acceptance-support.ts` 只将原文本 saved fixture 的 ID 改为非UUID非空字符串，复用原持久读回、source重用、cache零页面动作与完整性反例，不改图片 fixture、恢复结构或样本规模。
- **顺序/验收/失败：** W2 后进行，V3/V6/V7；停止临时ID+非空也须DONE，禁止等UUID才完成。Artifact读回失败或合法结果不能交付就停并查原Owner，不能开新Provider输入、改401或删事故单。

结构预算：三个生产文件均低于500行，修改为删除/简化表达式，无新函数/依赖。W1测试383、W2测试451、W3测试164/419行。按现役collectOwnFunctionDescendants规则，W1 AtomicBody为28行/9 await，IdentityChanges为52行/10 await，DecoderAndLoader为43行/5 await；分别按上段合并末尾两组await对为一组（目标7 await）、只扩原html表（仍10）、只改patch表（仍5）承载，不追加独立await或helper。W2 fixture为28行/0 await、绑定函数58行/4 await：复用同一fixture增加可选ID参数，在原正向执行点枚举正式/opaque两项、在同一函数内用一个空/非字符串patch循环校验拒绝，复用原Actor/hash构造，最多5个自身await；不得复制整段Actor场景。W3两个原场景仅增加一次已有fixture回调的返回阶段，saved fixture只换文本ID，不新增await或函数。所有改动保持函数≤75行/10 await、文件≤500及其余现役结构红线；这已给出承载落点，施工须在本单核实实际AST，不能等READY失败后临时拆层。所有修改由主 Codex 实施，子智能体只能只读审查。

## 7. 功能、施工纪律与动态验收

| 验收 | 必须区分的正确/错误实现及观察位置 |
| --- | --- |
| V1 真实 DOM 语义 | 原隔离 synthetic DOM 运行生产 fixed script：唯一当前 marker/user/assistant/body、临时ID、stop1、空正文能原样返回；下一原观察变正式ID/stop0/完整正文。另临时ID停止且非空立即可读，无h4同样可读。缺ID/混合ID仍拒绝。不接受只改mock返回包代替页内执行。 |
| V2 Actor handoff | 原 Actor 真实 binder 接收正式/非UUID的合法原V4包；exactCallIdentityHash、revision、URL/Target/Document核验保持。仅改producer而未改binder的实现必须被此用例拒绝。 |
| V3 GPT 结算 | 原handler在同一次调用消费“临时ID空正文stop1→临时ID非空partial且stop1→正式ID完整回答stop0”三阶段；保留原短budget到期/observation gate返回deadline后仍等待的行为，分别断言前两阶段不提前DONE、最终完整时DONE、原stop-present等待原因和读取次数。只看非空而无视stop的错误实现必须失败；非UUID完整答案也能DONE。仅放宽Browser未改GPTdecoder的错误实现必须失败；不新增真实等待秒数或重复场景矩阵。 |
| V4 身份与挂载回归 | 原user nullable挂载、已知user变更拒绝、多marker、多assistant、错邻接、非法user、两个原pending、隐藏/屏外/非末位/Composer场景、长页方向和预算直接复用原行为Exam；多body分支补入W1既有identity用例，不能把decoder的rawCount=2伪包冒充页内多body定位保护。 |
| V5 真失真与取消 | 原loader四个位点漂移、guard/permit/command取消/到期、错URL、畸形/额外字段、坏类型、内容hash/revision/Target/Document篡改与原stage/cause保留。不能把真实DocumentInvalid吞成pending。 |
| V6 原空窗口 | 原stop-present、停止非空、连续不足/满20分钟及stop/内容/identity变化归零验收保持；ID临时转正式沿原identity变化处理。不加timer或缩短窗口。 |
| V7 完成artifact和恢复 | 既有持久文本fixture使用opaque ID，原读取及source/cache成功，原artifact ref/hash等值，零多余acquisition/页面读取/submit；损坏artifact仍失败。原 live 缺artifact 及 source 授权反例保持。 |
| V8 成熟消费者 | 原Browser媒体、FIFO、WAL、confirmed/source零输入、GPT lifecycle/cache/source、全部13个Product原验收继续通过；URL连续、原marker和模型/附件/输入职责不变。 |
| V9 正常运行 | 用户追加授权“ready后，启动AGENT，再跟进3-5张工单”。本次完整READY及第二推完成后，经原生启动/切换入口使候选实际加载，只读跟进3—5张正常固定catalog现役任务，逐单绑定实际加载构建、job/attempt/revision/call、原CONFIRMED effect、相同canonical URL/marker、临时ID+stop到完成、artifact/result hash、完整结果成功接收回执和local completed。未观察到临时ID则仅报告正常回归通过，专项动态复现尚缺；不制造真实故障或额外派单凑证据。领域采用供Website判断，不作工厂完成门。 |

功能验收先验证 W1/W2/W3，再合跑既有 `npm run acceptance:local-browser-terminal`、`npm run acceptance:gpt`、`npm run acceptance:architecture-boundary`，最后使用唯一 `npm run quality:check -- CHANGE`；每次在实际执行环境核 Node≥24。普通用例不冒充质量裁决，不为重复证明添加重跑矩阵。用户另行要求 CI-FULL/READY 时实际加载冻结 ci-full-governance，依其 CHANGE→提交首推→完整READY→再次推送执行；单次只处理一个根因族，不能借质量失败扩修基础设施。RELEASE不自动授权。

部署/加载无跨仓迁移：公开字段、协议及持久结构不变；仅依用户追加授权在READY后执行原生启动/必要切换。切换须沿原正常停止/停止新claim/在途handler排空、原结果先交付、旧worker退出、固定artifact构建与preflight、新进程/扩展同构建鉴权链。不能单端热换、清WAL/Outbox/槽、伪造unknown终态或为切换删除任务；排不空即停止切换并保全原事实。该有限运行观察不等于RELEASE，不自行启动完整发布流程。

施工纪律另验：七个目标文件仅发生本单裁决动作；精确旧校验片区真实删除、有独立即时缺席结果、随后按合同新建；保留模块始终原位、旧UUID/h4准入及错误断言无残留、无副本/桥/旧骨架恢复。缺过程证据报告“无法核实重构纪律”，已证违规报告“未满足重构要求”；最终diff、功能通过或READY不能替代中间证据。

1+1验收是：已证临时ID现场可沿原等待完成，合法非UUID停止回答可交付；V4—V8成熟安全不变量同时保持；新增Provider输入、每轮额外DOM采样、独立判据、timer、持久字段、恢复链和跨仓改动均为零。正常pending后按原节拍再次观察不计作新增读取机制。新非空判断是既有UUID检查中存在性部分的保留，不是叠加新门。仅净删行数或通过率提高不足以证明提升。

## 8. 停止、审查与交付

发现新增必要消费者/旁路、authority冲突、相关candidate漂移、目标有用户改动、需改冻结语义/图片合同/表外文件，先停止相应动作，在本文回补事实、分母和授权，不缩小分母求通过。不自动回退；确有另获授权的指定基线回退，须单列对象与触发原因，保留已经发生的输入/结果/未知事实，不计作重建。

主Codex按三轮分别审：①权威与蓝图、Owner/权限和不解冻边界；②全部入口/消费者、四处UUID、handoff及工厂接收终点；③质检必要性、删除反事实、前轮连续性、具体片区/过程证据和全部验收。发现先在本文解决，确认无未闭合设计项后，完整读取subagent-review并启动全新只读审查者。审查者核本方案与现役法案/闭环Skill的有限分母是否完整，不写代码、不操作生产、不删建工单；发现修正后由原审查者复核。未放行不得标“可施工”或结束方案建设。

执行Codex须重新绑定本轮授权、当前根AGENTS/Skill/母本/适用法案及图/Manifest/registry/真实代码与测试、本文最新hash和实际Git状态；既定方案无相关漂移才可执行。最终按精确对象分别报告真正重建的校验片区、经论证保留的模块、局部修改的既有测试、删除退役的门禁/错误断言、失败回退及尚未完成的动态证据。不得把本单称为全系统故障已清零；当前方案和未来代码建设审计必须分开。

本轮主Codex三轮方案审计完成；独立只读审查者 `/root/text_gate_plan_review` 已放行。其两项发现——保全非空partial且stop存在的handler反例、W1接近await红线的明确承载——均已在W3/V3及W1/结构预算中修正，并由原审查者复核关闭。没有未解决设计阻断；上述放行不表示未来建设或生产验收已完成。
