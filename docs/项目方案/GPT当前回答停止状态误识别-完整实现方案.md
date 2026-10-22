# GPT 当前回答停止状态误识别－完整实现方案

状态：**本地建设完成，待子审及原生质量验收**。2026-10-22 完成三轮设计主审和一名未参与设计的子智能体只读审查，无未解决设计 finding；授权人随后明确批准按本文施工及原生 CHANGE/READY。该状态不代表代码、原生质量或生产已修复。需求 Owner 为 AGENT `gpt`；停止状态的原子事实 producer 为 `local-browser-session`。只使用主仓库本地 `main`，网站仓只读；既有他人 dirty 仍按 §2 保留，不擅自纳入提交。

## 1. 目标、范围与权威终点

修复上轮已实证的单一 GAP：已确认 conversation 的回答已完成，但隐藏首页 Composer 内残留的“停止”按钮进入全 Document 计数，使 `checkpoint_gpt_text_response` 误报 `GPT_PROVIDER_WAIT_STOP_PRESENT`，完整回答无法结算。

本轮只纠正该回答停止状态的取值范围。保留 canonical URL、原 Product marker、当前唯一 user/真实紧邻唯一 assistant、Target/Document/loader/revision 的整体验证；隐藏、折叠、屏外的已定位回答仍可完整读取。真实会话停止按钮存在时仍 pending；没有有效停止按钮且正文非空仍立即 DONE；停止且空正文仍沿原连续 20 分钟窗口。deadline、轮询间隔、FIFO、恢复、WAL、模型、附件、Prompt、Product 结果合同及 Website 均不改。

局部终点：原 `readExactAssistantTurn` 同一次原子观察返回正确 `generatingRaw` 和完整 DOM/semantic text，原 GPT handler 结算，原 Forensics 写入/readback 同一 task-owned artifact。业务终点仍为同一 job/result hash 经 Product → Runtime 原结果事务/Outbox → Website 既有 admission receipt → 本地 completed。页面完成、局部 Exam、CHANGE/READY 均不替代业务 readback。

通道异常及插件共同接入是否影响通道，本轮不裁定、不施工。也不删除或重发故障工单，不引入新的恢复措施。

## 2. 候选、证据与前轮连续性

项目 realpath `/Users/nexgen/Documents/AGENT`，branch `main`，HEAD `61a0e87022c0fdf030655956931196f62cec4f0b`，tracking `origin/main`。以下是设计时的相关源码绑定，不是 CI 候选回执；方案自身不计入源码绑定，交付时单列文档 hash。实际施工重新核 branch/HEAD/tracking、相关原文与 dirty overlay，漂移仅重开受影响裁决。

| 关键来源（仓库相对路径） | 设计时 SHA-256 |
| --- | --- |
| `.github/instructions/agent-rules/功能法案.md` | `f56f8175552789e8da336f2eba79cf92bf95fc169f4a4e24f6b789c6cb1b2ea8` |
| `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md` | `cbc9e920ae7294cc93733b47455ae487afbeb16c648114772c167637481ce8ef` |
| `docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md` | `c0dc2fb97aaef9a99c37b0a47b4307ef3ab94a7d3b3cc880062004bdfda31a09` |
| `src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts` | `7c94888e3fbc965ebebfbe0fb61ab4f1736f9cdd74eb7e5e82f3338561babf37` |
| `src/capabilities/gpt/children/checkpoint_gpt_text_response/handler.ts` | `11e87b7eb8a484c1e511f1883c4dec6c970a2b4af1c675fb34e5d2ef1e58dd13` |
| `scripts/audit/domains/local-browser-session/dom-mechanical-facts-inspection.ts` | `a4170fecdc5bad11fcbf5e39cb70cbfccd51ee0b248ee45646502965e0257857` |
| `scripts/acceptance/local-browser-exact-assistant-turn-support.ts` | `0ba53fc06c57175c75a1ca18ee068636754a5bdc0f3123a7cba69954087b9c75` |

设计前已有 12 个他人 dirty 文件，全部保留：浏览器交互拒绝方案、Browser mutation settlement inspector、三项八字 Product 的 SKILL/product-turn/acceptance，以及 chart-interpretation/product-identity。它们不进入施工面。三个实际 consumer 的 dirty `product-turn.ts` 只读绑定为：full-analysis `b6fb88734cdc58cf99ebd17997ab7329671936832c60576e5fc3c9de18f8f6d3`；chart-interpretation `4f759bb6a293196c983c890ca3a44544e184bdb893310c3e8aaf4b320c49fa33`；report-followup `cfe3d5ae1f97663bf8c6387ca3b24fcff60ae541b1946b9c8f36c3f576d32f14`。不得擅自提交、移走、覆盖或纳入本修复。

### 2.1 已取得的运行证据

2026-10-22 15:44:26—15:49:32（Asia/Dubai，UTC+04），用 Chrome 插件只读观察三张真实生产工单；页面附件名和返回的 context bundle hash 与本地同 job 材料核对。该轮未点击、导航、上传、提交或删除页面对象。

| job | 页面事实 | 原运行记录与本地读回 |
| --- | --- | --- |
| `aiprod_d6cd6225-1b0e-42dd-8319-9c7eadad8162` | 19 项 JSON；页面“回答已完成”；当前 Document 无残留停止按钮 | 15:45:16.914 本地 completed；15:45:19.507 `job.execute` succeeded |
| `aiprod_93fbc32c-e50a-4144-9f52-b446d2dc8446` | 18 项可解析 JSON；回答完成；`thread` Composer 无停止按钮，另一个 `home` Composer 有一个；祖先 `display:none !important`，停止按钮无 layout box、尺寸 0×0 | 15:42:07.304 记录 STOP_PRESENT；独立页面采样持续显示回答完成，15:46:53 stopRaw 仍为 1，但 15:48:17 与 15:49:32 已变为 0。15:47:30 此 attempt 因 BROWSER_BACKPRESSURE 失败，随后原链恢复；15:49:32 本地尚无结果，不能将停止按钮消失后的未结算继续归因于本专项 |
| `aiprod_7bafb1ff-55c9-4f57-8a99-c09ec219af72` | 20 项可解析 JSON；回答完成；隐藏 `home` 中一个停止按钮，当前 `thread` 无停止按钮；到 15:49:32 答案长度与 hash 仍一致 | 15:43:41.221 STOP_PRESENT；15:47:30 此 attempt 因 BROWSER_BACKPRESSURE 失败并恢复，15:49:32 本地尚无结果 |

可复查原日志：`.grasseye-local/runtime-logs/agent/4976cf12-3c1f-4dfc-9a92-1c78ae554c6d-0001.jsonl` 的 1812/1847/1890（等待）、1927/1939（首张结算）、1987—2007（通道与 attempt 失败）。工单与原材料保存在原 production-runtime.sqlite / plugin-tasks，不复制原始日志、材料、完整 URL、marker 或回答正文进入本文。DOM 证据是本聊天上轮工具返回；原会话 rollout `rollout-2026-10-20T00-44-52-01a12286-a7f3-7030-bfa5-7a92ccc14e24_01a155e8-f577-74e0-b98e-5ec494211e19.jsonl` 中，11683 为同包 placement/stop，11697 为隐藏祖先，11720 为 job/材料/context hash/项数绑定，11732、11781、11811 为后续采样。两页原观察分别以 context hash 对应 job，不能以 Tab 顺序互换；93fbc 的后期 stopRaw=0 是明确反证。未另造截图文件或生产证据报告。后台记录不证明实际 AI 生成时长，当前完成页也不能倒推最早完成时刻。

### 2.2 前轮连续性裁决

| 既有唯一方案 / 当前落地证据 | 保留、遗漏与本轮关系 |
| --- | --- |
| `GPT文本回答两门禁冻结-完整实现方案.md`；现役 GPT002-V32、原 handler 与隐藏节点真实 DOM Exam | 保留唯一身份门与 stop/正文结算门；隐藏回答仍可读。已核范围未包含“隐藏首页残留 stop 与当前 thread stop 共存”的反例，不把旧方案重新实施一遍。 |
| `GPT回答轮次身份漂移阻断-完整实现方案.md`；当前 marker user/assistant 定位 | 保留 marker 当前定位与原 UUID 的 WAL lineage；不恢复固定 UUID、页面末位或 Prompt rehash。 |
| `GPT文本回答扫描门禁根治-完整实现方案.md`；当前 fixed Document by-value reader | 保留物化 await、loader 前后守卫、无成功后 remote-object cleanup、失败归因。该方案修读取生命周期，不覆盖本次停止控件归属 GAP；本文只承载新 GAP，不覆盖其原工单。 |
| `GPT等待原因可观测性-完整实现方案.md`；当前 wait reason 代码 | 保留五个文本原因及只读投影；错误来自其上游事实，不靠改日志掩盖。 |

有限 Git 核验显示：全页停止按钮计数在 `86b0873b0` 之前的父版本已经存在；该提交只是保留到当前原子 reader，不能断言是最近一次重构新引入。近期同片区多次迭代且有冻结与保护性测试，采用**深度但限定片区**设计，不扩成 Browser 全链重建。

## 3. 先审质检，再定第一断裂

现役检查器 `exactAssistantTurnReadIsAtomic` 的 required token 强制要求旧全页 selector；同时其 presentationGates 禁止对回答身份或返回增加 display/visible/layout 等条件。后者有真实保护：隐藏回答、用户气泡、turn 外层仍须读取，不能删。前者不是法案指定的 selector，而是把一种错误取值范围固定成实现要求，必须物理删除，不能把其完整字符串换成另一个没有独立必要性的字符串钉死规则。

现有 `exerciseRealAtomicBody` 已用真实合成 DOM 覆盖隐藏 user/assistant/turn 和普通 stop，但没有首页/会话双 Composer 的归属反例。增强这一原有 Exam 足以保护新行为，不新增检查器、AST 框架、测试入口、测试文件或第二 verdict；不新增同义变异矩阵。现有“stop 可超过 probe budget”“隐藏回答可读”和身份漂移变异保护全部保留。

第一直接断裂：`dom-exact-assistant-turn.ts#EXACT_ASSISTANT_TURN_FUNCTION` 以整个 Document 的全部 `form[data-chatgpt-composer] button[aria-label='停止']` 为 generatingRaw。Browser reply/hash/Node decoder 都原样传递，GPT handler 按正确的两门规则消费了错误事实。因此只改 Browser 的停止控件取值表达式，不改 handler 决策、超时或正文读取。

## 4. 法案与施工图对齐结论

现役依据：母本 §§4、35—38、44、46—47；基础 `LAW-CODE-PURITY-001-V6`；功能 `LAW-GPT-001-V65`、`LAW-GPT-002-V32`（两门冻结及同一精确回答位点）、`LAW-LOCAL-BROWSER-SESSION-006-V46`；两域现役 Manifest 与唯一 registry。

**本设计不申请、也不执行解冻或修改 active law。** 法案要求同一精确回答位点的 stop 状态，不要求把无关首页 stop 计入；识别控件的归属是第二门的同一事实取值，未新增独立阻断判据。候选 user/assistant 的存在、身份、DOM、semantic text 均不依据 Composer 或展示条件裁决；stop/正文三态、20 分钟重置、deadline 规则原样保留。上一轮“可能必须解冻”的判断经本轮收窄后不作为施工前提。

GPT/Browser 施工图需在现有两门段落各补一句精确取值说明：在 confirmed canonical conversation `/c/...` 的同包 observation 中，显式 `data-composer-placement="home"` 的 Composer 属首页，不贡献当前回答 stop；其余现役 composer stop 仍计数，不要求表单存在/唯一/可见，不增加回答返回门。不得改动冻结条款原文或删除 presentation 禁止项。若审查发现该限定实际必须改变冻结语义，本文转设计阻断，报告具体原文冲突，不能自行解冻。

## 5. 唯一目标链及合同 handoff

停止状态只使用一条 selector：

```css
form[data-chatgpt-composer]:not([data-composer-placement='home']) button[aria-label='停止']
```

它仅排除已实证、明确属于首页的表单，不正向要求 `thread` 属性存在。无 placement 的现役表单仍由同一条 query 匹配；没有 OR、旧新模式、fallback 或第二次读取。当前会话 stop 即使屏外、hidden/aria-hidden/inert/display:none 仍计数，因此不会把“看不见”当作“已停止”。未知 placement 不被冒然丢弃；不宣称覆盖未来未知 DOM。

```text
Product 现有 checkpoint 输入
 → Browser 唯一 readExactAssistantTurn / fixed current Document
 → 同一次 Runtime.evaluate：原 marker/邻接正文 + 非 home Composer 的停止按钮计数
 → 原 exact-assistant-turn.v4 reply / 原 revision hash / 原加密传输与 decoder
 → 原 checkpoint 两门判定
 → 原 Forensics artifact / Product / Runtime Outbox / admission
```

输入、输出 shape、schemaVersion、字段类型/null/default/unknown-field policy、身份、canonicalization、hash 算法、权限与 effect-once 不变。generatingRaw 仍为非负整数，只修正其所属范围；revision hash 仍包含修正后的该事实与同包正文。无新字段、事件、错误码、数据库转换、事务、receipt、持久化或恢复 Owner。Provider input 增量恒为 0，不能因本修复重发已确认 effect。

## 6. 连坐分析、发现来源与保留裁决

交叉发现来源：① `contract.ts`、`handler-registry.ts` 与 Browser command registry/typed intent 穷举合法入口；② import/符号反向引用找到唯一生产 exact reader 及全部 Product 调用文件；③ 原页面采样、材料 hash、任务记录与日志关联实际分支。三者均回到同一个文本 handler 和同一个 Browser reader。完整/历史 artifact 的零输入 source-reuse 另有原入口，不经过本次 DOM query。

| 对象 / 唯一来源 | 裁决及删除反事实；验证位置 |
| --- | --- |
| Browser `dom-exact-assistant-turn.ts#EXACT_ASSISTANT_TURN_FUNCTION` | **片区删除后重建**仅旧 generatingRaw 全页取值表达式。新链仍在同一原子函数，不新增 helper/导出/查询轮次；否则旧首页残留分支继续误判。V1—V5。 |
| 同文件 marker/邻接、materialize、decode、bindReply；`dom-fixed-document-read.ts`、`dom-semantic-text.ts` | **直接保留**。分别保护精确归属、未挂载物化、完整正文/codec/hash、固定 loader 与生命周期；删除会导致串回答、漏读或不完整结果。V4—V7。 |
| `dom-mechanical-facts-inspection.ts#exactAssistantTurnReadIsAtomic` | **局部删除**旧 selector required token；保留原子性、完整 DOM、身份、loader、presentation 禁止项及其它保护。新语义由原真实 DOM Exam 取得独立证据，不叠加源码字符串钉死规则。V1—V7。 |
| `local-browser-exact-assistant-turn-support.ts#exerciseRealAtomicBody` / 原合成 DOM fixture | **原位增强**§7 反例。其生产函数真实执行可区分全页误数、只认 thread、按可见性误判和硬编码数量；现有假回复/shape 测试接不住 DOM 归属。保留既有场景，不建第二 harness。 |
| `local-browser-rule-mutants.acceptance.ts`、`gpt-proof.acceptance.ts`、GPT frozen inspector | **直接保留**。身份/完整内容/两门/超预算 pending 的反例仍有效；本方案不修改 handler，也不通过改基准使错误返回过关。 |
| `web/gpt-dom-observation.ts#readExactAssistantTurn`；Browser `browser-dom-read-intent.ts`、`browser-exact-assistant-turn-reply.ts`、`browser-dom-intent.ts`、`exact-assistant-turn-revision.ts`；`dom-intent-runtime.ts`、`command-registry.ts` | **直接保留**原 typed handoff、同包/身份/revision 校验和唯一入口；不删除就能承载修正后的同类型事实。V6/V7。 |
| `checkpoint_gpt_text_response/handler.ts`、production lifecycle/child-result、evidence-artifacts、Forensics、Runtime/Website 接纳 | **直接保留**。handler 和 artifact 是真实下游；删 handler 会失结算，删 artifact/Outbox/readback 会失交付。输入 shape 不变且只改一个上游事实，不新增下游规则。V3—V9。 |
| `prepare_clean_gpt_chat/selectors.ts#GPT_GENERATING_STOP_SELECTOR` 及 observation/handler | **不修改**。它在 root URL 准备新聊天，首页 stop 是合法保护，不能复用会话排除式；两者不是同义来源。保留其查询与行为回归。V8。 |
| `checkpoint_gpt_generated_image` / authenticated-media、附件、模型/推理、submit、rate-limit、通道、WAL/FIFO | **不修改**。它们不消费本次 stop 表达式；图片取得的是原媒体 bytes，准备/submit 仍各有合同。shared wait/lifecycle 零修改，因而不变更其输入、身份、副作用及结果。V8。 |
| 新公共 helper、配置/模式、状态/存储、第二 reader/observer/queue、额外日志、compat bridge | **不新增**。现有单表达式和原 Exam 可闭合需求，无当前必要消费者。 |

全部直接 Product 入口（均只读保留，沿原 registry 路由，不改 Prompt、Flow、结果解析或专业 SKILL）：

| 文件（`src/plugins/` 下） | 调用合同 / 验收映射 |
| --- | --- |
| `bazi-ai-full-analysis/product-turn.ts` | 同一 text-checkpoint 合同；V6/V9；有他人 dirty，禁止写 |
| `bazi-chart-interpretation/product-turn.ts` | 同上；V6/V9；有他人 dirty，禁止写 |
| `bazi-report-followup/product-turn.ts` | 同上；V6/V9；有他人 dirty，禁止写 |
| `hehun-ai-analysis/flow.ts`、`hehun-report-followup/flow.ts` | 同一 text-checkpoint 合同；V6/V9 |
| `qimen-professional-answer/flow.ts`、`qimen-report-followup/flow.ts` | 同上；V6/V9 |
| `naming-commercial/flow.ts`、`naming-from-existing-bazi-report/flow.ts` | 同上；V6/V9 |
| `public-knowledge-article-pipeline/seo-gpt-calls.ts` | 同上；文章多轮/locale 原关系不变；V6/V9 |
| `localization-production/flow.ts` | 同上；注册 index 的 report/article 翻译及各 accuracy_challenge/quality_reflection，static-catalog-flow 调回同一文本执行函数；七条现役 action route 不漏；V6/V9 |
| `payment-screenshot-observation/flow.ts`、`zeji-personal-selection/flow.ts` | 同上；虽非本轮事故产品，也是现役真实 consumer；只核共享合同，不建设或改变其业务资格；V6/V9 |

上述为 13 个直接调用文件；注册枚举补出 localization 共享调用下的七条 action route，无未解释的入口差异。源复用路径 `production-call-preparation.ts`、`production-execution-source-reuse.ts`、`production-execution-session.ts` 只归还现有 artifact，不执行 stop query，保持原 hash/零 submit。业务终点调查停在不变的既有 Product result/Runtime admission handoff：本修复没有新结果字段或跨仓授权，故 Website 不成为施工仓，也不把网页完成当成 Website 接纳证明。

## 7. 有限分母与分别验收

本次分母只包含当前已实证 DOM 结构、原合同实际分支及防回归对象；无未来布局猜测。V1—V5 放入原 Browser 真 DOM Exam，同一次原子采样同时断言 DOM/semantic text、原身份与 generatingRaw；V3 再由既有 GPT proof 验证原结算消费。V6 保留 Browser 身份/loader 与 GPT reply 校验的原验收，V7 由原 GPT proof/stopped-empty 验收承担，不在 Browser 重做 GPT 的计时测试。

| 编号 | 当前输入 / 身份 | 预期与 consumer/readback；失败/恢复 |
| --- | --- | --- |
| V1 | 已确认 `/c/...`，唯一原 marker/邻接回答非空；隐藏 home 残留 stop，thread 无 stop | generatingRaw=0，完整回答返回，原 handler DONE；用最小合成正文复现两类 Composer 共存，不复制原敏感正文或增加无意义消息样本。 |
| V2 | V1 加入 thread 的真实 stop；分别覆盖 home 有/无 stop、thread 处于 hidden/屏外 | 只计非 home stop，仍 pending；不能因 visibility/geometry 判断已停止。无需新持久化/恢复动作。 |
| V3 | 非 home 表单缺 placement 属性且有真实 stop；随后该 stop 删除、正文保持非空 | 原单 query 分别给 1→0；原 GPT handler pending→DONE。不能只认 thread 属性、硬编码 0 或借超时提前完成。 |
| V4 | user/assistant/turn 分别 hidden、aria-hidden、inert、display:none 或屏外；无有效 stop | 完整 DOM、deterministic semantic text、内容 hash 不变且可结算。不得增加 visible/表单数量门。沿原 artifact 保存/readback。 |
| V5 | 无 Composer 或不存在 home；原回答已定位且非空 | 仍可 DONE，不新增 composer 存在/唯一 gate；home 无 stop 不改变当前回答身份。 |
| V6 | marker 缺失/多义、相邻 assistant 缺失/多义、URL/Target/Document/loader/revision 或内容 hash 失真 | 原 typed pending/fail-close，绝不因 stop=0 接错答案；原 Owner 原链恢复、零 submit，不新增恢复动作。13 个直接文件的输入都继续命中同一 typed registry。 |
| V7 | 有效 stop 持续存在且 probe budget 已过；停止后正文持续为空；再出现 stop/正文或身份漂移 | 保留现役超预算 pending、连续 20 分钟 stopped-empty 及归零保护；原 GPT/Website 恢复入口不改，不伪造终态。 |
| V8 | root fresh-chat 的首页真实 stop；图片/附件/submit/限流/旧完成 artifact source-reuse | root 仍能识别首页生成；图片与准备路径原 acceptance 不变；读取同 effect 及 source-reuse 的 Provider 输入均为 0。源码与 import 反查排除误改共享 selector/lifecycle。 |
| V9 | 原 lane 轮到当前 job 后完成一次可信采样，返回原身份回答 | 不再因 home stop 增加一轮 STOP_PRESENT；同一 effect artifact → 原 Product → 原 Outbox →同一 job/result hash admission/readback。若 Website 或通道拒绝/未知，只如实保留原状态，停止该动态证明，不把它算作本专项已根治或转入修复。 |

V1—V5 区分四种明确错误实现：原全页计数、只认带 thread 属性的表单、按可见性忽略真实非 home stop、把回答 hidden 当作不可读。复用原 runPage/withSyntheticDom，不引入新生产抽象或成倍样本。原 GPT 原子身份、STOP_PRESENT 超预算和 stopped-empty 的现有保护与 V6—V8 联跑，不能只跑新增成功样本。

功能静态/Exam 与生产 readback 分开：本轮上次动态证据只证明旧缺口；待修行为尚未运行，不能预报通过。后续切换由授权执行者使用 AGENT 现役 Browser 取得 3 个自然生产同身份样本，记录实际采样/结算/artifact/admission 时间与日志关联；不同时接入额外调试插件，不人为提交、停生成或重发。该运行证据缺席不伪称根治；原生 READY 仍只按其自身等级报告。

施工纪律另验：只在下列 W1 指定表达式及检查器 token 执行删除→即时缺席核验→唯一新表达式，保留对象须在删除前裁决；不得保存旧片区、改字符串后删文件写回、复制、包装或桥接。缺席检查仅限 exact reader 与该 inspector 的旧全页计数，不能把 fresh-chat 的合法全页查询误判残留。最终 diff 或 READY 不能替代这段真实过程证据。

## 8. 原子施工工单与顺序

共同前置：仅在用户另行授权本文施工后进入；重新读取本仓相关法案、Blueprint、目标文件与 Git 状态，保护全部他人 overlay；不建分支/worktree，不改母本和冻结 Skill。每单失败立即停止受影响施工，保留已发生 Provider 事实；无重发、清 WAL 或自动回退授权。

### W0-G：GPT 侧事实定义与唯一方案归属

- Owner `gpt`；局部修改 GPT Blueprint 的原两门段落，按 §4 精确说明 stop 归属；不变更 frozen 文本、lawId、handler、Product 或 Website。
- 在 `scripts/audit/domains/gpt/manifest.json` 增加本文这一精确 ownedPath；它是本方案的唯一文档 Owner，不能新增 domain、通配兜底或第二登记。沿现役生成器 `npm run audit:build` 更新唯一 registry，不手改 generated。无规范义务变更，不升法条版本。
- 保留原 law 引用、两门语义及所有现役 ownedPaths。删除/重建：无，只有必要的原位文档说明及唯一投影。验收为规范语义、唯一归属、来源与生成 bytes 一致；不能把文档说明变成运行条件。

### W0-B：Browser 侧同包事实说明

- Owner `local-browser-session`；只局改现役 Browser Blueprint 的对应段落，写明 §5 一条查询的范围，保留同包原子性和所有 presentation 禁止项。
- 不改 Generic V2、wire/intent/schema、API、错误、effect、Document lifecycle 或停止/恢复合同。删除/重建：无。W0-G/W0-B 由主 Codex 做两遍规范自审，对齐后才进入代码；发现冻结冲突则停止并回到本文，禁止直接改法案消除冲突。

### W1：原 stop 事实片区删除后重建

- Owner `local-browser-session`；生产范围只有 `dom-exact-assistant-turn.ts#EXACT_ASSISTANT_TURN_FUNCTION` 的 generatingRaw 表达式；关联质检范围只有 `dom-mechanical-facts-inspection.ts#exactAssistantTurnReadIsAtomic` 的旧 selector required token。
- 删除旧全 Document stop 取值及该 token，**立即核验这两个精确旧对象缺席**，再在原 generatingRaw 位置按 §5 重建唯一查询。检查器 token 退役后不新增另一条字符串硬锁，用 W2 的真实 DOM Exam 证明取值行为。
- 同文件独立 marker/邻接、完整正文、物化、decode/hash、fixed reader、所有 presentation 保护提前裁决保留并直接复用，不整文件删除或机械加工旧骨架写回。不增加 helper/import/导出、二次 query、公开字段、计时或状态。保留原 handler、fresh-chat selector 和通道全部代码。
- 验收：V1—V8 及 §7 施工纪律；production 文件 240 行、inspector 448 行，表达式替换与 token 删除不增加结构复杂度。任何新增职责或边界无法落入本单即停单回补方案，不能偷扩文件。

### W2：用现有真 DOM Exam 补齐缺失分支

- Owner `local-browser-session`；原位增强 `scripts/acceptance/local-browser-exact-assistant-turn-support.ts` 的原 atomic-body 测试，复用 `local-browser-dom-function-fixture.ts`、`local-browser-dom-runtime-fixture.ts` 与生产 `executeExactAssistantTurnRead`；后二者直接保留，不需要修改。
- 保留 hidden user/assistant/turn、代码块、loader、物化及失败归因既有用例；添加 V1—V5 的最少差异样本。现有 support 281 行，当前 atomic-body 函数有余量；如加入后接近 75 行，在同文件用一个有独立反例职责的测试函数承载 stop 归属矩阵，不拆新文件、不加生产 helper。不复制同义断言，不新增 source 字符串检查或独立变异框架。
- 删除/重建：无；该单为局部增强，不能统称重建。验收运行原 Local Browser terminal/property/mutant 与 GPT proof，覆盖 V1—V8、13 个 consumer 的原 typed handoff；任何失败先核是否本候选引入，不顺手修通道/八字/Website。

### W3：原生质量与授权后的同身份运行验收

- Owner `gpt` 负责交付核对，所有原质量裁决仍由本仓唯一 `quality:check`；不增检查文件或 verdict，代码写入/删除/重建均为无。主 Codex 两遍建设自检后，仅按已授权审查要求交只读子审，审建设差异与本文，不并发写代码。
- 使用 Node ≥24，先核版本；施工范围与差异证据闭合后，以冻结 `$ci-full-governance` 执行原生 CHANGE、明确获准的提交/首推、完整 READY 和规定推送。方案授权不自动授予这些运行/提交动作；不得把他人 dirty 纳入或移走来凑 clean commit。完整候选边界无法取得则保留 CHANGE 实际结论并报告 READY 未执行。按原生入口本来资源治理运行一套流程，不同时启动两套完整质量或额外浏览器观测。
- Browser 源码变更须按原受控构建与 releaseBuildId 识别部署；wire/schema 没变，不升协议版本、不改单槽/鉴权/ACK。切换前按原停止链暂停新领取、排空真实 handler/可信回执并保全 WAL/Outbox，再用原启动链构建、核 Node/Extension artifact identity 一致后运行；未获服务切换授权只完成静态/原生质量，不热替换在途扩展。
- 动态按 V9 取得同一 effect 原结果的自然样本，Provider submit 增量不得由验收人工制造；旧 artifact/revision 及 Website 接纳全部保持。没有动态授权或通道/Website 受阻，则准确报告待验收，不扩大修复面或伪称失败全消失。

## 9. 停止、回退、主审与最终汇报

以下情况停止依赖施工：相关来源漂移、碰到他人修改、发现新 stop 归属类型会实质改变本设计、必须改冻结条款/公开合同/handler/时钟才可实现、原质检/业务 readback 与设计冲突、无法排空旧执行或核加载身份。只回补本文受影响部分；不新增竞争方案。回退授权为无，失败保持事实并报告，不执行 Git reset/restore/stash 或回滚 Provider/Website 已发生事实。

设计主审按三次不同目标进行：①现役 authority/旧方案连续性与两门边界；②producer→reply→handler→artifact 及全部 consumer/旁路；③从 V1—V9 反攻当前遗漏、删除反事实、施工纪律与可取得的 readback。独立设计审查只读，按已明确的专项审查要求执行；未放行不得把设计说成可施工。审查意见与整改只并入本文及当前任务，不建第二审计台账。

最终执行汇报逐项区分：真正重建（W1 stop 表达式）、经论证保留（身份/隐藏正文/handler/存储等）、局部修改（Blueprint/原 Exam/Manifest）、删除退役（旧全页取值与不必要 token）、失败回退（若无写无）、尚未完成（原生等级及生产 readback）。必须分别报告重构过程证据与功能质量；没有完整过程证据写“无法核实重构纪律”，真实违规写“未满足重构要求”，不得用整体完成措辞掩盖。

施工记录（2026-10-22，本地 main）：W0 两施工图的原冻结段落逐字保留，主 Codex 完成两遍规范自审；唯一生成器返回 REGISTRY_BUILT。W1 先物理删除旧 generatingRaw 表达式及检查器旧 token，再以两处限定断言即时核实缺席，随后原位重建唯一非 home 查询；无旧片区备份或兼容路径。W2 在原真实 DOM Exam 内增强停止归属、隐藏及屏外反例，专项调用退出码 0；主 Codex 两遍建设自检核对实际 diff、原 handler、13 个调用文件与 root 合法 stop，并核 12 项原 dirty 字节未变。三名隔离只读法官同题一致裁定旧 token 清退、原停止事实职责保留裁修；原 DOM 反证已回填 §2.1。该记录不宣称子审、CHANGE、READY 或生产 readback 已通过。
