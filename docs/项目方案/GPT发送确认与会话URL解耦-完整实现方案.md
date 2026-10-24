# GPT 发送确认与会话 URL 解耦—完整实现方案

## 1. 结论、授权与唯一边界

本方案只解决一处已证实耦合：**正式会话 URL 尚未生成，被当成发送未完成，导致已经发生的 Provider 输入未取得发送成功回执。**

目标链固定为：

```text
Product 批准提示词和附件
→ submit_exact_gpt_turn_once：发送一次，确认本条用户消息，持久确认发送回执
→ get_submitted_gpt_conversation_url：只读取并绑定这次发送的正式 URL
→ 原 checkpoint：读取原回答
→ 原结果解析、Runtime stage/Outbox、Website 领域接纳
```

两项裁决：

1. 从“发送完成”判据、发送返回值的必需字段及发送恢复凭据的必需条件中移除 URL；保留原提示词、附件、消息身份、真实物理输入与 WAL 校验。
2. 将获取正式 URL 变成独立的只读要求；URL 获取未完成不能撤销已经确认的发送，重新执行这一要求不得再次输入提示词。

**当前状态：可施工。** 2026-10-24 授权人已明确授权按本方案精确修订法案、施工图、代码和质检，在本地 main 执行 CI-FULL 至 READY，完成后受控重启 AGENT。此前两项写权限 GAP 已关闭；主 Codex 已独立完成本轮规范对齐及下述两遍核对，未调用子智能体。方案状态、静态验收、READY、本机运行和 Website 业务交付分别报告，不外推 RELEASE。

需求 Owner 为 AGENT 的 GPT 能力域；Browser 继续唯一拥有物理发送、WAL、页面绑定和 canonical locator。唯一方案为本文件，不修改历史断网恢复方案，不另建报告或台账。

### 1.1 明确排除

- 不修改 Website 的重发授权、attempt/revision、退避、风险 grant、领域拒收或领域入库政策；不修改跨仓 V6 请求/响应字段。
- 不修改八字或其他产品的专业 Skill、提示词、模型、推理档位、材料、结果 Schema 和专业判断。
- 不改变全局 1.5 秒页面访问、2.5 秒动作读回、40 秒提交后静默、70—90 秒 Provider observation、停止按钮及空回答窗口。
- 不新增队列、恢复服务、控制器、数据库表/列、第二 WAL、第二 Outbox、恢复 Owner、通用流程封装或分支开关。
- 不把当前六条历史 REJECTED 记录改成 CONFIRMED，不修改旧回执或旧 sealed source，不以新代码宣布旧工单已经恢复。
- 不改动当前用户已有修改；只在本地 main 设计，施工时同样不建/切分支，不 reset、stash、clean 或借 worktree 绕过边界。

## 2. 当前事实与证据边界

### 2.1 本次故障

工单：`aiprod_074f998f4c46e870dfdfeb12778606d7`；产品：`bazi_chart_interpretation`；动作：`produce`。

Browser 唯一 WAL 的取证快照显示 revision 0—5 共六次实际输入，六条均为 `physical_input_count=1 / mutation_outcome=confirmed / state=REJECTED`，原因为 `BROWSER_POSTCONDITION_FAILED`，native cause 为 `BROWSER_DOM_CANDIDATE_MISSING`，均未保存可恢复定位载荷。这里的 confirmed 是物理 mutation 事实，不等于 Browser terminal CONFIRMED。

以下时刻为 2026-10-24 迪拜时间。失败时刻来自 WAL；正式 URL 首次出现时刻来自同一 Chrome 的访问历史。它们证明了 URL 就绪晚于失败；不能据此证明每轮回答都已完成、内容全部合格或精确模型费用。

| revision | 原发送确认被判失败 | 正式 URL 出现 | 晚于失败 |
| --- | --- | --- | --- |
| 0 | 15:39:30.195 | 15:39:40.972 | 10.777 秒 |
| 1 | 15:47:06.307 | 15:47:07.693 | 1.386 秒 |
| 2 | 15:51:39.190 | 15:51:43.095 | 3.905 秒 |
| 3 | 15:59:48.764 | 15:59:51.502 | 2.738 秒 |
| 4 | 16:41:37.420 | 16:41:38.673 | 1.253 秒 |
| 5 | 17:04:13.915 | 17:04:14.750 | 0.835 秒 |

原日志：`.grasseye-local/runtime-logs/agent/360b20b2-140e-404a-ab9e-081fca0a7c66-0001.jsonl`，第 1299—1303 行及 3279—3283 行分别记录后两次发送命令及失败。原 WAL：`.grasseye-local/browser/browser-mutations.sqlite` 的 `browser_mutations`。不复制或改写这些生产记录。

### 2.2 第一直接断裂与完整受影响链

| 位置 | 当前事实 | 本方案裁决 |
| --- | --- | --- |
| `src/capabilities/gpt/children/submit_exact_gpt_turn_once/handler.ts:50` | 一次 click 的后置窗口为 5000ms；返回值要求 URL | 删除 URL 对发送成功的依赖；保留其他原发送后置，不通过调大 5 秒掩盖耦合 |
| `src/lib/browser/exact-target/browser-observation-receipt.ts:87` | 提示词 hash 与 canonical URL 被放在同一个布尔判据；URL 不合格也返回“元素缺失” | 发送判据只保留本次新用户消息的发送证明；URL 判断移至独立要求，失败归因分开 |
| `src/lib/browser/exact-target/browser-submit-recovery-payload.ts:36`、`browser-mutation-receipt.ts:384` | CONFIRMED submit 凭据强制含 URL | 发送证明可独立验真；定位证明另行绑定，不能伪造 URL |
| `src/lib/browser/chrome-extension/extension-command-runtime.ts:133`、`browser-mutation-store.ts:350` | 只在发送整体确认后保存发送恢复载荷 | 先按真实消息后置持久化发送证明；后写 URL 不改终态回执 |
| `src/capabilities/gpt/production-execution-session.ts:305`、`production-child-tools.ts:102` | capture/readSourceSubmit 同样要求发送值自带 URL | 分别记录发送证明和定位结果；原 CONFIRMED 的 WAL 读取不再因 URL 缺席返回未发送资格 |
| `src/lib/browser/exact-target/browser-mutation-evidence.ts`、`browser-mutation-replay-evidence.ts` | 回答恢复、父会话 continuation 直接从发送载荷取 URL | 统一读取该发送的可信 locator；合法的“已发送但尚无 locator”不是坏密文或无输入 |
| Product 的 submit → checkpoint 交接 | checkpoint 直接读 `submit.value.canonicalConversationUrl` | 插入只读 URL 要求，再把其结果交给原 checkpoint；专业行为不变 |

故障合为一个根因片区，不把六次输入拆成六张修复工单，也不把 Website 合法消费旧证据的结果另立为需要改政策的根因。

### 2.3 来源、候选与调查深度

- AGENT 已定位到 `/Users/nexgen/Documents/AGENT`，本地 main、tracking `origin/main`；HEAD 及差异已在当前任务上下文核对。按母本 §36 不把 Git HEAD 制成任务候选文件；执行前必须现场重绑。
- Website 为 `/Users/nexgen/Documents/xuanxue-web`，本地 main、tracking `origin/main`。双仓法案与施工图先全量遍历目录、现役条款及连接；本方案不改变 Website 的字段或职责，因此 Website 保持只读。
- 母本：`docs/governance/法案系统建设说明书-冻结定稿版.md`；按 §35—38、§41—42、§44、§46—47、§74 约束文档与未来施工边界。
- 本轮开始时原有 dirty 路径：`docs/项目方案/八字栏目技能方案.md`、`src/plugins/bazi-chart-interpretation/SKILL.md`、`src/plugins/zeji-personal-selection/SKILL.md`、`src/plugins/zeji-personal-selection/prompt.ts`、`scripts/acceptance/product-plugins/zeji-personal-selection.acceptance.ts`。不覆盖、不移动、不格式化这些内容。末项是未来验收的直接关联对象，未获在其上继续编辑的明确授权前，相关测试修改不得施工。
- 深度为闭环 Skill 的“深度”，但只沿此共享合同的真实依赖取证：涉及发送/定位持久事实和恢复接口，不能按一行 if 当轻量修复；深度调查不扩大施工面。

## 3. 现役权威、前轮不变量与授权 GAP

### 3.1 当前权威及必要调整

| 权威 | 保留/调整 |
| --- | --- |
| `LAW-GPT-001-V65`（功能法案 GPT 域） | 当前明确规定 submit 直接返回 CONFIRMED、URL、user turn 和 effect receipt；仅需将 URL 从发送完成输出移到独立定位输出，保留其余义务 |
| `LAW-GPT-002-V32` | 保留两项发送前确认、同 effect 去重、原结果优先、风险 grant、文本回答两门及全部保护节拍；只同步新旧步骤的引用关系，不增删这些门 |
| `LAW-LOCAL-BROWSER-SESSION-004-V58`、`006-V46` | 仅调整 CONFIRMED submit 载荷及独立 locator 的加密绑定/读取许可；保持原 WAL、receipt、fence、隐私边界及唯一 Browser Owner |
| `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md` | 将首次 submit 的 URL 输出责任移给独立定位要求，并写清回接 checkpoint 的顺序 |
| `docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md` | 仅同步发送证明与 locator 分离及其持久化；不改 lane、计时、Target 取得和风险恢复拓扑 |
| `src/capabilities/gpt/child-types.ts`、`contract.ts`、`handler-registry.ts` | 类型为本次局部机器合同真源；发送 contractVersion 从 6 升为 7，输入仍为原 v2；新 URL Child 的 contractVersion 为 1、inputSchema 为 `gpt.get_submitted_gpt_conversation_url.input.v1`；合同版本类型仅补合法字面值 1/7，已有 Child 值不变；不新增独立 spec/registry 来复制字段 |
| 原 GPT、Browser Manifest 与原 registry 生成器 | 新 Child/helper 已在既有目录 Owner 通配范围内；如登记本方案，仅在原 GPT Manifest 的 ownedPaths 加本文件一项；registry 只用原生成器更新受影响投影 |

本轮明确授权关闭上表的局部 law-amendment GAP；不修改母本或四份栏目源头。源头锚点为 Website《合婚栏目冻结边界蓝图》第二十二、三十八条，《八字栏目冻结边界蓝图》第九、三十五、三十六条及附录三第六部分，《奇门遁甲栏目冻结边界蓝图》第九、二十六、三十六条，《起名栏目冻结边界蓝图》第二十七条：按原身份读回、保护已确认成果、不重复生产，并区分内部回答与用户正式 PDF 交付。专业语义、回答两门、两个发送前置和保护节拍不变。

规范替换仅涉及 LAW-GPT-001-V65→V66、LAW-LOCAL-BROWSER-SESSION-004-V58→V59、006-V46→V47 及其 Manifest/registry 引用投影；其余法条义务不变。GPT 与 Browser 施工图只对齐发送证明/URL 定位及交接句，不更新 Website 恢复政策或复制专业 Flow。

### 3.2 前轮连续性裁决

已查阅以下现役/历史线索及目标符号必要 Git 历史：

- `docs/项目方案/GPT稳定会话地址恢复-完整实现方案.md`：实际讨论的是已确认输入在断网后保持原 effect 真相；保留“观察失败不能反写成没有发送、原结果零 submit 恢复”的不变量。本方案不是第二份断网恢复方案。
- `docs/项目方案/GPT提示词空格投影与Target-Local恢复闭环-完整实现方案.md`：保留 target_local 与 provider_effect 区分，禁止仅凭 mutation 字段签新发送；不改变提示词空格投影。
- 现役 GPT Blueprint 的 `FROZEN-GPT-RESPONSE-NO-PROMPT-REHASH-001` 与 `FROZEN-GPT-TEXT-RESPONSE-TWO-GATES-001`：原发送 UUID 是 WAL 身份；文本回答按原 Product marker 与真实相邻 assistant 定位。本方案不恢复回答 Prompt rehash 或固定轮次编号。
- 当前代码与日志已证实本次问题发生在发送直接后置，早于正常回答读取；不能借本次修复重做 checkpoint 或专业接收器。

旧文档中的审计百分比、旧通过声明和旧 candidate 不作为本轮完成证据。前述保留不变量必须进入本方案 §8 验收。

## 4. 唯一目标合同

### 4.1 发送责任

`submit_exact_gpt_turn_once` 仍只有一次可能产生 Provider 输入的动作。输入 `files/promptHash` 及原发送前两项确认不变。成功仍须证明：本次准确用户消息出现、有效消息身份、原提示词显示投影 hash 一致、原直接后置及物理输入计数符合合同。**点击 ack 或物理计数本身不能单独证明发送成功。**

发送成功输出只表达 `status=CONFIRMED / promptHash / mutationSent=true / userTurnId` 与原 effect receipt；不返回必需 URL。其发送恢复证明保存原 exact call、observation、Target/Document 哈希及候选计数，不依赖正式地址。

发送前 actionability 的 5 秒与其余发送后置窗口本轮保持原值；只删除 URL 对这些窗口的成功依赖。不是把所有判断简化成“按钮按过即成功”。

### 4.2 独立 URL 要求

新增一个且仅一个 Child：`get_submitted_gpt_conversation_url`，Owner 为 GPT，画像 `DOM_OBSERVATION`、零页面 mutation、`observation-only`、有界观察，局部可 DONE/WAIT/FAIL_CLOSED，公开仍仅 success/typed failed。

精确输入：`submitCallId / providerEffectIdentityHash / timeoutMs`；productStep/job/attempt 由现役执行 context 提供。原 submit 身份由 Browser 的 WAL 验真，不允许 Product 给任意 URL、Tab、Target 或候选会话。标准调用使用独立 15000ms 观察窗口；这是定位要求的上限，不再用于发送完成。成功值精确为 `canonicalConversationUrl / userTurnId`，定位 hash 走原 proof 的 evidenceHash，不再增加第二份业务结果。窗口耗尽继续使用现有 `GPT_SUBMITTED_CONVERSATION_URL_INVALID` typed failure，但归属独立 URL Child，不再伪装为发送的“元素缺失”。

顺序固定：

1. 先由 Browser 查询原 CONFIRMED effect 和已有 locator；已有且验真通过，直接返回，零页面操作。
2. 无 locator 时，必须仍具有同一 accepted attempt 的当前授权，且 Browser 仍可按现有 registry 认领这次发送原本绑定的 live Target。只走既有 `bound-observation`，禁止 fresh、首页导航、侧栏搜索或按最新页面猜测。
3. 通过现有 FIFO、1.5 秒访问、2.5 秒动作读回和 40 秒提交后静默门后，在当前 Document 做 coherent 只读观察：canonical currentUrl 与本次已确认消息身份整体对应。正式地址检查继续使用现有 URL policy，临时 `local-chatgpt%3A...` 不作为持久 locator。
4. 尚为临时地址时只继续只读观察；15 秒局部窗口从首次实际获准的定位观察开始，不把前面的 FIFO/40 秒保护等待算成地址已经缺失。等待仅复用 Browser 现有有界读回及 1.5 秒机制，不建立 GPT/Product/job/Tab 的第二观察计时器。每次实际命令仍受原单命令和租约预算限制；短预算则如实失败，不扩大全局 20 秒预算。
5. 取得地址后，由 Browser 把 locator 绑定到原已确认 effect，持久化读回成功后返回 `canonicalConversationUrl / userTurnId` 及现有 proof 引用。
6. URL 不合格、身份多义、Target/Document 失真、租约失效或窗口耗尽时返回定位阶段 typed failure；原发送终态、物理输入数和发送证明保持原样。不得在这个 Child 内调用 submit、创建新会话或重跑专业解读。

URL 元数据观察不是 assistant 内容观察，不推进 70—90 秒 Provider observation 保护钟。原回答仍只由原 checkpoint 读取。

底层读取方式固定：复用原 `BrowserTargetLease.executeDomIntent({kind:"observe", queries:[...]})`，由原 `dom-coherent-observation.ts` 在同一页面调用中读取 `location.href` 并投影为包内 `currentUrl`，同时以发送收据的有效 UUID 查询唯一对应的 user turn，只读取 `turnKey`。URL 与消息身份必须来自同一个 observation revision；不分别拿一次 Tab 元数据和另一次 DOM 后拼成证据。此步骤不重读完整 Prompt、不查询 assistant 内容。`readSubmittedConversationUrl` 是对上述现役能力及同行加密绑定的窄组合，不是新的浏览器控制通道。

业务接入点固定在原 Product 的 submit → checkpoint 交接函数内：原 `submit.value.canonicalConversationUrl` 的取值位置替换为独立 URL Child 的 `value.canonicalConversationUrl`，原 `userTurnId` 必须与该结果绑定一致；原 checkpoint 的输入字段、回答身份/完成算法和结果接收器不变。第一次发送与 `readConfirmedSubmit` 恢复分支共用这个交接，不能只给 fresh 分支加取 URL，也不能让已发送恢复分支重进 prepare/fresh。

### 4.3 发送证明与定位信息的持久化

复用 `browser_mutations.provider_recovery_payload` 原加密槽，不新增 SQL 结构、存储文件或第二写入 Owner。

- 新发送证明的 schemaVersion 固定为 `grasseye.browser.confirmed-submit-proof.v2`；其精确字段为 `schemaVersion / promptHash / userTurnId / exactCallIdentityHash / observationRevisionHash / targetRefHash / documentRefHash / rawCount / eligibleCount`，两个计数均为 1，**没有 URL 字段**。原 `terminalPayload` 在 receipt 落地后不可变，`proof_hash/state/mutation_outcome/physical_input_count/terminal_at` 均不因后取 URL 改写。
- 在同一加密 envelope 内增加一个 `locatorPayload`，其 schemaVersion 固定为 `grasseye.browser.submitted-conversation-locator.v1`；其余精确字段为 `providerEffectIdentityHash / submitExactCallIdentityHash / canonicalConversationUrl / userTurnId / targetRefHash / documentRefHash / observationRevisionHash / observedAt / locatorHash`。`locatorHash` 使用原 `canonicalizeBrowserAuthorityValue` 对除 locatorHash 本身之外的固定字段集合编码并 SHA-256；URL 不进入日志、Website 请求或普通 proof 文本。
- Browser 在唯一原数据库连接上按 command/effect、原发送证明、当前权限及原 ciphertext 做 CAS：当前权限由现役 workspace/Target、同调用 AbortSignal 和剩余命令预算检查；原行按同 accepted attempt/revision/step/call/effect 绑定，不要求旧 lease/fence 等于同 attempt 重授后的新 lease/fence。空槽只写一次；已有相同 locator 幂等返回；不同 locator 或损坏证明失败关闭。原 receipt 的 `terminalPayload` 必须逐字节语义保持；仅替换 envelope 时不得修改 `updated_at`，以保持发送 authorityHash 稳定。
- 已有原格式历史 CONFIRMED 收据里的 canonical URL 仍是该旧发送已证明的只读定位事实。只在原 Browser locator 读取函数中验真投影，不复制、不迁移、不重签旧回执；新发送只生产新证明格式和独立 locator，禁止新旧两路同时写 URL。两者若同时存在而不一致，直接失败。
- `readJobReplayEffects`、父任务 `readUniqueConfirmedConversationUrl`、当前/来源 effect 读回共同消费同一个 Browser locator 读取原语。合法的“新发送证明完整、locator 尚无”返回 absent，而不是坏密文、未发送或未确认；真正坏证明仍失败。
- locator 的 CAS 不改稳定 effect 集合及发送 authority；定位证明允许从 absent 变为 trusted 仅发生在当前 accepted attempt 尚有有效授权、尚未转移来源的阶段。跨新 attempt 对旧 sealed source 只读已有 locator，不补写其 anchor，防止使 sealed source 的 anchor hash 失效。
- WAL job purge 继续随原行删除加密槽，不新增清理链。

`browser-mutation-store.ts` 当前 487 行，原生可执行文件红线为 500 行。新增绑定/读取细节放入 Browser 私有 `browser-submitted-conversation-locator.ts`，由原 store writer 及两个既有 evidence consumer 使用；原 store 只保留必要的窄入口，不把整文件拆成转发壳、不挪无关职责。该文件的必要性是持久 locator 的一次绑定与三处同义读取，不是为未来通用化。

### 4.4 运行衔接和恢复

GPT 的 `captureSubmit` 先接纳 URL 无关的已发送证明；独立的定位结果只为同一个 session/step/effect 补齐定位字段。`confirmedSubmissionFor` 仅在进入 checkpoint 时要求 locator 完整，不能反过来否定 captureSubmit。

在执行 URL 的任何页面观察前，`acquireProductionBrowserCall` 必须把原发送 effect 的事实注入当前 BrowserCall 的既有 failure 运输上下文；此时只有发送证明，不伪造 locator 或 confirmed-readback 页面资格。URL Child 自身的 committedMutation 为 no，不能覆盖这个旧 CONFIRMED provider effect；发生 URL 失败、日志失败、abort 时继续由原 `handleGptChildExecutionError/terminalizeGptChildError` 运输原 effect 的 scope、Browser outcome、mutation outcome、identity、evidence，防止重现历史的“只读失败覆盖原发送事实”。不改 failure wire 或 Website 分支。

`readConfirmedSubmit`、原 atomic readback 和 source submit readback 读取发送证明时不再要求 URL；发现原 CONFIRMED 即返回原发送事实，绝不因缺 URL 返回 null 让 Product 获得 fresh 资格。Product 随后必走 URL 步骤。来源已有可信 locator 时只读原值，不重写来源证明。

`ProductionGptExecutionSession.assertCheckpointReadback` 现有 pendingReadbacks 分支只允许 checkpoint，必须精确放行与 activeReadback 的同 step/effect 绑定的 URL Child；该 Child 不清除 pendingReadbacks、不结算 risk/source call，也不能进入 `source.recoverCheckpoint`。URL 分支先完成自己的缓存/定位处理，随后原 checkpoint 才可消费/清除原恢复条目。其余 readonly/准备调用仍按原门拒绝，不能泛化为“所有读取都放行”。

独立 URL Child 的调用键为 `conversation-url`，沿用原 submit call 的 suffix。取 URL 和原 checkpoint 可使用原 checkpoint 的 actionOrdinal；它们的 child/call identity 不同，当前合同不要求 actionOrdinal 跨 Child 全局单调。保留旧 submit/checkpoint ordinal 与不可变 identity，禁止为插步骤全量重排历史动作号。

有限分支如下，不另造持久业务状态机：

| 已有事实/现场 | 唯一处理与 Owner | 后续输入 |
| --- | --- | --- |
| 尚未真实发送 | 原 submit 合同及 Browser WAL | 只允许原授权的一次发送 |
| 发送 CONFIRMED，原 live 绑定在，URL 未取得 | 独立 URL Child 在 Browser 当前授权下取地址 | Provider 增量 0 |
| 发送 CONFIRMED，locator 已持久，页面丢失 | 原 confirmed-readback 精确导航/读原回答 | Provider 增量 0 |
| 发送后进程重启，扩展仍保有原 live 绑定 | 原 WAL 重建发送事实后，按原绑定取 URL | Provider 增量 0；不走 fresh |
| URL 未保存且进程/扩展原绑定也丢失 | 保留 CONFIRMED 输入事实，沿现有 typed unaddressable/source/Website 精确风险授权合同处理 | 本方案不授新输入；也不承诺无定位信息自动找回 |
| 旧六次 REJECTED 或 DISPATCHED/unknown | 原样保留，沿原合同处理，不升级为 CONFIRMED | 不因本方案自签重发 |
| 身份冲突、损坏或撤权 | 当前只读/绑定动作失败关闭；原输入事实不变 | 0 |
| 结果已取得/stage/Outbox 已成立 | 原结果优先交付，URL 阶段不重跑 Provider | 0 |

“URL 获取失败不能重发”约束本次 URL 要求及同一 effect；不暗中废除 Website 已有、针对确实无法恢复来源签发不同 revision 的权限。独立 URL 步骤不再把正常地址生成等待误算成发送失败；真正丢失现场的既有风险处置政策保留。

## 5. 影响范围交叉核验与停止边界

发现来源相互独立：① Product catalog/Child handler registry 枚举合法入口；② 发送符号与 URL 字段的反向引用识别直接 producer/consumer；③ Browser WAL、receipt 和 source evidence 读写链核对持久恢复；④ 本次真实 WAL、日志及 URL 时序验证故障。前三者合并后为 13 个 Product、14 个直接 submit 文件，另有 SEO submit readback helper。不存在用“只改八字”绕开其余共享接口调用方的设计。

所有下列调用方仅允许把 `submit.value.canonicalConversationUrl` 改为独立定位结果，并在 fresh 和 confirmed-readback 共用的交接处插入一次 URL 调用；不抽象共同专业 Flow，不调整专业分支、重试政策或 prompt。

| Product/消费面 | 精确文件 | 处理与验收 |
| --- | --- | --- |
| 八字命盘 | `src/plugins/bazi-chart-interpretation/product-turn.ts` | `checkpointSubmittedTurn` 的唯一前置定位；对应同名 acceptance |
| 八字全盘 | `src/plugins/bazi-ai-full-analysis/product-turn.ts` | 同一机械交接；同名 acceptance |
| 八字追问 | `src/plugins/bazi-report-followup/product-turn.ts` | 同一机械交接；同名 acceptance |
| 合婚 | `src/plugins/hehun-ai-analysis/flow.ts` | 同一机械交接；同名 acceptance |
| 合婚追问 | `src/plugins/hehun-report-followup/flow.ts` | 同一机械交接；同名 acceptance |
| 奇门专业 | `src/plugins/qimen-professional-answer/flow.ts` | 同一机械交接；同名 acceptance |
| 奇门追问 | `src/plugins/qimen-report-followup/flow.ts` | 同一机械交接；同名 acceptance |
| 支付截图 | `src/plugins/payment-screenshot-observation/flow.ts` | 同一机械交接；同名 acceptance |
| 商业起名 | `src/plugins/naming-commercial/flow.ts` | submit 后、checkpoint 前取地址；同名 acceptance |
| 既有八字起名 | `src/plugins/naming-from-existing-bazi-report/flow.ts` | 同一机械交接；同名 acceptance |
| 择吉 | `src/plugins/zeji-personal-selection/flow.ts` | 同一机械交接；原同名 acceptance 有用户改动，施工保护门见 §2.3 |
| 本地化 | `src/plugins/localization-production/flow.ts` | fresh/父会话 continuation/原发送恢复都接同一 URL 步骤；同名 acceptance |
| SEO 文本 | `src/plugins/public-knowledge-article-pipeline/seo-gpt-calls.ts` | 各原 productStep/call suffix 精确取地址；public-knowledge-article-pipeline acceptance |
| SEO 图片 | `src/plugins/public-knowledge-article-pipeline/seo-image-call.ts` | 独立 URL 结果交给原图片 checkpoint；不改图片媒体合同 |
| SEO 原发送读取 helper | `src/plugins/public-knowledge-article-pipeline/seo-submit-readback.ts` | 继续只证明原发送，删去对发送值自带 URL 的依赖；不变成公共流程器 |

对应测试位于 `scripts/acceptance/product-plugins/<Product目录名>.acceptance.ts`；SEO 两种消费者使用该产品同一 acceptance 及现有 fixture。`scripts/acceptance/product-plugin-test-runtime.ts` 只适配这一新调用结果，不用固定返回伪造真实动态证明。

Website 边界停止依据：当前 V6 source proof 使用 `anchor_state=trusted|absent`、effect/WAL/anchor hash，不传 Provider URL；`packages/ai-contracts/src/production-control/v6-source-readback-proof.ts` 的字段和业务含义均不变化。本方案既不向 Website 加入新阶段，也不要求它解析 locator 存储格式。AGENT 原 source proof 继续投影同一 Browser 事实。若施工发现必须新增跨仓字段或改变 recovery policy，立即停止受影响施工并回报范围冲突，不能顺手实施。

## 6. 保留、删除与新增的反事实裁决

| 对象 | 裁决及必要性 | 删除/保留验证 |
| --- | --- | --- |
| 正式 URL 格式与会话归属校验 | 保留；原回答恢复及 continuation 的真实消费者需要准确定位 | URL 缺失/错误时不能错误读另一会话；不以放宽 policy 凑成功 |
| URL 参与发送成功判据及必需发送输出 | 删除；物理发送与地址就绪是两个独立事实 | 临时 URL 下准确新消息可确认，且发送输出不再强制 URL |
| 原发送消息/提示词/附件/WAL 保护 | 保留；否则可能确认错内容或重复输入 | 原保护反例继续失败，物理发送最多一次 |
| 新 URL Child | 必要新增；13 个产品需显式承担独立只读要求，现有 Child registry 没有这一意图 | 独立调用可验收、缺地址不撤发送事实、取地址输入计数 0 |
| 同行加密 locatorPayload | 必要最小持久事实；解决确认发送后 URL 的独立保存和已保存后的重启恢复 | CAS 幂等、原 terminal proof 不变、重启从原 WAL 读回；SQL schema 无新增 |
| Browser 私有 locator helper | 必要；原 store 487/500 行，且 store/evidence/replay 三处消费同一定位事实 | 独立职责、无第二 DB handle/Owner、文件与函数仍过原生结构检查 |
| Website 重发策略改造、第二恢复器、通用 Product Flow | 删除出目标方案；本根因无需它们 | 最终 diff 中不存在这些改变；端到端原 V6 合同保持 |
| 所有历史证明与已取得答案 | 原样保留；不可因新设计改写现实输入事实 | 旧 terminal/receipt 字节与原结果内容不变；仅新发送使用新合同 |

## 7. 原子工单与精确施工顺序

以下为本轮已授权施工范围。每单共同遵守 §1 排除面、§2 用户改动保护和 §8 验收；新增文件仅限明确写出的两个落点，不建立第二方案、存储、服务或治理入口。

### 7.0 删除前保留裁决与片区重建

根因片区为“发送 Child 的直接后置与发送恢复证明”，重建依据是 §4 的两个正交事实，不能从旧 URL 耦合骨架加工后写回。物理退休 `src/capabilities/gpt/children/submit_exact_gpt_turn_once/handler.ts` 和 `src/lib/browser/exact-target/browser-submit-recovery-payload.ts`；两者分别只拥有这一发送意图及证明，缺席核验完成后在同路径从新输入输出合同重建，不保存旧文件副本、不从 Git 还原、不建立兼容 producer。共享文件 `browser-observation-receipt.ts` 仅退休其 `exactOutgoingPostconditionVerified` 函数的旧 URL 耦合判定，先核该旧函数缺席，再根据新消息证明合同建设判定；其 packet/header/revision/query 验证是其它现役 DOM Child 的唯一验证来源，必须原位保留。

新发送证明不含 URL；独立 URL Child 和 Browser 私有 locator 模块按 §4 新建。历史已确认终态只经同一 Browser 证明读取出口验真原字节与原 locator，不保留旧发送 producer、旧控制分支或双写；不能把历史不可变凭据改造成新格式。历史 REJECTED 保持原样。

其余对象为片区外不可分割的局部修改，不能统称重建：§7 WO-1 的 Child 类型/唯一登记承接新合同；WO-3 的原 WAL store/payload/types/evidence/replay 保留唯一数据库、终态 CAS、全历史与加密 Owner，只增加同 effect locator 的同行绑定和读取；WO-4 的原会话、准备及 lifecycle 保留唯一执行身份、source grant、失败运输和恢复门，只接入发送/URL 两次交接；WO-5 的全部 Product 保留独立专业 Flow，仅替换发送→checkpoint 的参数来源；WO-6 的原检查器和用例继续保护原身份、消息、附件、输入计数与原结果复用，只退休“发送必有 URL”的错误预期；原 inspector selector/逐法出口、property/mutant 与原 dynamic claim producer 对三个获准 major 的现役 lawId 作同位投影，不改历史产物，不增加质量入口。删除这些共享独立职责会分别造成普通 Child 证明、其它 mutation/WAL、跨进程恢复、专业生产或真实反例失去保护；现有调用点和 §5 消费面就是其当前消费者，故不整文件清空或搬家。

顺序固定：规范对齐→主 Codex 两遍核对且无未闭合必需项→代码目标 Git 状态复核→物理删除上述退休对象→当场检查文件/旧函数缺席→按 §4 重建唯一发送链→新增独立 URL 要求并接原消费者→主 Codex 两遍核对实际建设→只读子审审代码与本方案差异→唯一原生 CI-FULL。重要合同/持久化步骤由只读子审协同核验；第一阶段禁止子智能体，所有生产与质检写入仅主 Codex。中间操作原件保留于本任务工具记录，不另造台账或第二质量报告。

有限自检以每项义务均有明确落点且未闭合项为零实现用户要求的准入阈值，不用无依据的“98%”自评分代替证据。发现实际合同缺口先更新本方案，禁止跳到代码补救。重启沿原 `grasseye:start` 和正常关闭链收束旧 handler/native/事实交付；不强杀在途、不清 WAL、不调用 Provider 重放来证明修复。

下面 WO-1—6 是实施工序分组，**不作为跨 Owner 大工单**。实际原子施工单及边界如下；各单继承所属分组的保留/删除、具体顺序、验收和停止规则，不允许把一个分组整体交给某个 Owner 越域执行：

| 原子单 | 唯一 Owner | 唯一决定/动作及完成输出 |
| --- | --- | --- |
| 1-G | GPT | 修订发送/定位的 Child 语义合同及 GPT Blueprint，输出 §4 的唯一类型与登记 |
| 1-B | Browser | 修订发送证明/定位加密载荷许可及 Browser Blueprint，输出 §4.3 的唯一事实边界 |
| 2-G | GPT | submit handler 不再以 URL 判发送，输出发送 Child 的原消息证明结果 |
| 2-B | Browser | click 后置及 terminal proof 按消息证明结算，输出不可变发送 receipt |
| 3-G | GPT | URL Child 发起一次独立定位要求，输出 §4.2 的定位值/proof |
| 3-B | Browser | 验真同 effect 的 URL 并 CAS 绑定原加密槽，输出持久 locator readback |
| 4-G1 | GPT production execution | 将发送证明接入会话及 failure 上下文，输出不被 URL 失败降级的原 effect 事实 |
| 4-G2 | GPT production execution | 精确放行恢复中的 URL 要求并回接原 checkpoint，输出原 source/readback identity 的合法消费 |
| 5-各 Product | §5 每一行对应的具体 Product | 各自插入同义 URL 交接并更新自己的原测试，输出原业务合同不变的调用序列；SEO 三行合属其一个 Product |

WO-6 只是各单验收与原检查器更新的合并说明：GPT 检查器归 GPT，Browser 检查器归 Browser，产品测试归对应 Product；不另建立能够修改所有 Owner 或形成第二 verdict 的“质检工单”。

### WO-1：修订这段局部合同

- **Owner/对象**：GPT 与 Browser 各自现役法案、两份 Blueprint、`src/capabilities/gpt/child-types.ts`、`contract.ts`、`handler-registry.ts`；Browser 原 typed proof/target lease/API 合同。
- **动作/输出**：按 §4 明确发送与 URL 两项责任；submit contractVersion 递增，新 URL Child 登记到原唯一 registry。Browser 发送 payload 新 schema 与 locatorPayload 的最小字段按 §4.3 定义，不修改外层业务 V6。
- **保留/删除**：保留原预置安全、权限、隐私、effect/receipt/回答两门；删除“submit 直接后置必须含 URL”，发送意图/证明按 §7.0 删除重建，共享合同文件只作必要局部修改。
- **顺序**：先取得 §3.1 精确规范授权，由 1-G/1-B 分别形成唯一当前合同，之后 WO-2/3/4 一起消费；不在同版本暗改语义。旧回执仅读取，不启用旧新两份 active law。
- **验收**：Child 枚举、必需/可空字段、非法输入/未知字段、Owner 和原生成投影严格对应；不增加第二 spec。
- **停止**：需要改变 FROZEN-GPT-TEXT-RESPONSE-TWO-GATES-001、专业结果或跨仓 V6 时停止，不扩本单。

### WO-2：发送直接后置与原 WAL 收据解耦

- **Owner/对象**：GPT submit handler/observation；Browser `browser-observation-receipt.ts`、`browser-submit-recovery-payload.ts`、`browser-mutation-receipt.ts`、`chrome-extension/extension-command-runtime.ts`。
- **动作/输出**：一次 click 的发送判据不再核 URL；对符合消息后置的新发送产生 URL 无关的真实 CONFIRMED 回执，原 store 仍原子结算。
- **保留/删除**：保留两个发送前确认、原消息身份/内容证明、输入数和 direct postcondition；物理删除原 URL 耦合条件及仅服务该条件的错误归因，URL policy 本身留给下一步。
- **顺序/消费者**：遵循 WO-1；先核消息成功再落原 receipt；WO-3 不得先于原 CONFIRMED。旧 REJECTED 不重解释。
- **验收**：临时 URL 下正确消息成功，消息缺失/hash 错误仍拒绝；旧格式真实回执可核读，未知/损坏格式拒绝；同一 effect 不产生第二次 click。
- **停止**：后置未证明消息归属时不得把输入 ack 升为 CONFIRMED；按原 WAL 保留 dispatched/unknown，不补造成功。

### WO-3：独立定位及同行加密持久化

- **Owner/对象**：GPT 新增 `src/capabilities/gpt/children/get_submitted_gpt_conversation_url/handler.ts`；Browser 新增私有 `src/lib/browser/exact-target/browser-submitted-conversation-locator.ts`，并原位衔接 `browser-mutation-store.ts`、`browser-mutation-payload.ts`、`browser-mutation-types.ts`、`browser-mutation-evidence.ts`、`browser-mutation-replay-evidence.ts`。
- **窄端口**：在原 `browser-target-lease.ts`、`browser-target-lease-manager.ts` 增加 `readSubmittedConversationUrl({submitCallId, providerEffectIdentityHash, timeoutMs})`，通过原 `browser-command-actor.ts` 持有的唯一 store 读回/绑定，禁止从 manager 新开数据库连接或增加注入根。该 Actor 是 lease 到 WAL 的现役唯一接缝，局部组合现有 observe/等待命令，返回 §4.2 的值和 proof；`browser-authority-api.ts` 已转导该类型，无需新增门面包装或改写其导出。调用期内部复用现有 observe/currentUrl，**不新增 wire command、CDP 原语或外连权限**。原 `BrowserAtomicStepOutcome` 与 source 读回增加独立可空 `conversationLocator` 投影，供 GPT 恢复与 checkpoint 使用；不可变 `terminalPayload` 原样返回，缺 locator 不撤销发送。原 evidence 出口只投影同一现役 WAL 查询所得的 locator，不建立第二选择器/locator registry。
- **动作/输出**：按 §4.2 读取；按 §4.3 CAS 绑定，返回原发送的准确 URL。读取与绑定只使用原 DB 连接；真实页面输入为零。
- **保留/删除**：保留原 current Target/Document/lease/fence 及 protected waits；删除 evidence 读取中“只要发送证明没有 URL 就是坏证明”的耦合。无新表、列或迁移；无历史 payload 回填。
- **顺序/消费者**：原 receipt 先成立；URL 读取通过后绑定；绑定持久化读回后交 WO-4/5。原父会话 continuation 只消费已完整 locator，不把缺 URL 解释为可 fresh 输入。
- **验收**：迟到地址、幂等复读、错误身份、原槽冲突、密文损坏、撤权、CAS 竞争、旧可信 locator、locator 未保存时原绑定丢失分别按 §4.4 处理。旧 terminal hash/authorityHash/物理计数不变。
- **停止**：已转新 attempt 或 sealed source 的旧 effect 不写 locator；没有原 live 绑定也没有可信 locator 时不扫描旧 Tab，不伪造精确恢复。

### WO-4：GPT 执行会话的直接交接

- **Owner/对象**：`src/capabilities/gpt/production-execution-session.ts`、`production-child-tools.ts`、`production-ports.ts`、`production-call-preparation.ts`、`production-browser-lifecycle.ts`、`production-atomic-readback.ts`、`production-atomic-call.ts`、`production-child-result.ts`、`production-execution-source-reuse.ts`。
- **动作/输出**：发送恢复与 URL 恢复分别验真；发送 capture 不要求 URL，定位 capture 绑定原 effect；URL Child 先尝试原 WAL 缓存，缺失时仅复用 bound-observation。已验真的缓存通过原 execution context 可空 `submittedConversationLocator` 投影给同一 Child，使历史 locator 已存在但页面丢失时仍能零页面返回；原 atomic-call/preparation 仅转导该字段，不新增恢复器。旧 source reusable 也从原 Browser 出口读取 locator，原 source checkpoint 不接管 URL Child。checkpoint 仍要求完整原 locator。按 §4.4 精确调整 pendingReadbacks 的 URL 只读放行和 source checkpoint 分派；在 URL 观察前挂接原 CONFIRMED effect 的 failure 运输，不因“本次观察输入零”覆盖原发送事实。
- **保留/删除**：保留 readConfirmedSubmit、原 source/readbackOnly/settled reusable、原 artifact/result 优先和唯一 effect 身份；只删除发送恢复阶段对 URL 的提前要求。禁止 null/fresh 降级、隐式代 Product 执行新步骤。
- **顺序/消费者**：WO-2/3 的证明闭合后接入；Product 在 WO-5 显式调用 URL Child；既有 checkpoint 本身的身份/完成算法不变。
- **验收**：已发送无 URL 的同 attempt 重领/重启，不执行 fresh/profile/附件/write/submit；已有 locator 的原结果读取没有新增页面输入；来源 grant 及专业结果行为不变。
- **停止**：若必须修改 Runtime 的 claim/source seal 算法、Website 风险策略或 checkpoint 两门才可继续，报告该精确缺口并阻断对应施工，不自动扩大。

### WO-5：直接 Product 消费者机械衔接

- **Owner/对象**：§5 表列出的 15 个文件，由各自 Product Owner 原位负责。只有表中 14 个直接 submit 文件和 SEO helper 进入此单。
- **动作/输出**：原发送成功或原发送零输入读回后，执行一次 URL 要求；原 checkpoint 的 URL 参数取独立结果，其余参数及结果内容不变。fresh/恢复统一在原交接函数接入，禁止各增加一套业务流程。
- **保留/删除**：保留各 Product prompt/model/material/result/review/continuation 全部业务行为；删除读取发送输出 URL 的旧引用。无新的共享 Product workflow 或重复专业策略。
- **顺序/验收**：WO-4 后；13 个产品逐一做 fresh 与确认发送读回两个机械分支；SEO 另覆盖文本/图片及 suffix，localization 覆盖现有 strict-parent；测试分母不得抽样替代。
- **停止**：目标路径出现无法区分的用户改动时停止该路径，不复制出第二 flow/测试；本轮已授权在择吉 acceptance 的必要相交断言上继续编辑，必须保全既存独立修改，不绕过该测试。

### WO-6：原有质检的精确更新

- **Owner/对象**：原 `src/capabilities/gpt/acceptance/gpt-proof-submit.acceptance-support.ts`、`gpt-production-browser-recovery.acceptance-support.ts`、`gpt-production-artifact-recovery.acceptance-support.ts`；原 `scripts/acceptance/local-browser-mutation-receipt-support.ts`、`local-browser-mutation-store-support.ts`、`local-browser-provider-effect-recovery.acceptance.ts`；§5 的 13 份产品 acceptance 和原共享 test runtime；Browser 原 terminal/coherent-click/DOM mutation 及 GPT 原 exact-target/proof/wait/mismatch fixture 是同一合同的直接反例消费者，按原入口同步替换旧 URL 耦合预期，不新增测试文件或入口。
- **动作/输出**：增强已有发送/恢复 fixture，加入 §8 能区分错误实现的分支；不新增平行测试运行器或通过报告。
- **检查器**：只在原 GPT `gpt-contract-inspection.ts`、`gpt-provider-contract-inspection.ts` 与 Browser `dom-mechanical-facts-inspection.ts`、`opaque-proof-inspection.ts` 中调整命中本合同的断言；opaque 检查从原 evidence/replay 的 URL 验证位置转到同一现役 locator reader，并保留原 URL 合法性与终态列不可变反例。原两个 `inspector.ts` 及 Browser `interaction-readiness-inspection.ts`、`mutation-atomicity-inspection.ts` 只同位投影三个 active lawId；`target-claim-inspection.ts` 实际不必修改。未消费此变更的规则保留，不弱化原保护来容纳错误实现。registry/extension artifact 只由原生成器构建，不手改派生物。
- **保留/删除**：保留原有效反例；移除“发送成功必有 URL”的旧断言，替换成发送证明与定位证明分别验真的断言。原断网、原答案复用、两门禁、隐私/effect-once 反例继续保留。
- **顺序/验收**：WO-2—5 后先运行相交普通测试，主 Codex 两遍自检及实际建设子审后，按冻结 CI-FULL 执行 CHANGE→提交首推→完整 READY→第二推；原生命令为 `npm run quality:check -- CHANGE` 与 `npm run quality:check -- READY`。不执行 RELEASE。
- **停止**：发现新 consumer、结构超限或其它失败时只重开受影响条目，不修改不相干检查器、测试豁免或整个治理内核。

### WO-6 续单：首次 READY 的已证直接消费者

原生首次 READY 退出 1；原日志和 39 条逐法原报告已保全。原固定庭第三案及 4A—4C 分题裁决，不改变现役法案、蓝图、质量入口或分母。第三案为轻度：`tests/governance/quality-contract.test.ts` 的五个正向/current-law 绑定逐处从 GPT65、Browser004V58、006V46 投影到现役66、59、47，旧绑定退出后立即查缺席；原事实、clauses、baseline与全部反例保留，不改 validator/registry，不泛化接受版本。该对象只作局部机械修改，不称算法重建。

4A 的中央固定恢复数组本体裁删，不保留存在资格；合法恢复验收职责继续履行。共享 `scripts/acceptance/product-plugin-test-runtime.ts` 删除该数组断言并立即核缺席，只保留原身份、原确认读取次数及零再次 submit，返回已经取得的实际 run。§5 中除 SEO 外的十二个 Product 各自拥有的 `scripts/acceptance/product-plugins/<Product>.acceptance.ts` 在全部十七个现存 await 调用点及原循环样本上断言自己的 URL→checkpoint 完整顺序；不建中央期望表、配置字段或新运行器。主Codex分别修改共享中性接口与各 Product 自有断言，不能把它们交同一个 Owner 越域；原 Product 生产 Flow 不动。

4B/4C 按中度核接缝，复用 J2 独立只读技术分析，披露既有上下文，不作新盲审或方案审批。4B 唯一修改单元为 `scripts/audit/domains/capability-governance/mechanical-content-inspection.ts` 的 callee 名称提取：退休把复合调用及回调正文当名字的旧分支，核缺席后仅沿 CallExpression 的 callee 取底层调用名；保留 identifier/property、原 heuristic、AST/TYPE/dependency检查，不改正确 locator、不加白名单或通用解释器。在原 `capability-governance.acceptance.ts` 补机械 transaction（含 result_revision/rows.length）不报 AST/TYPE、真实 judge 工厂仍报两模式的有限对照，原反例完整保留。此为 domain 检查器的错误对象修正，不改变治理主链。

4C 分属原 GPT/Browser Owner，各自在原文件内承接原输出：`gpt-provider-contract-inspection.ts` 将完整发送/URL检查从 `inspectProviderWaitContract` 分出，主方法保留 submitPath 供退休步骤检查；`opaque-proof-inspection.ts` 将四个 encrypted-recovery 来源完整取得为 typed bundle，四源及主方法其它来源全部读取并保留各缺席 finding 后才判退出；`gpt-exact-target-browser-fixture.ts` 只退休新增内嵌 proof 分支并立即核缺席，同文件构造完整 CONFIRMED submit outcome，保留成熟 fakeBrowser/settle 的其余职责，保持计数→终态/proof→origin/outcome→失败运输顺序；`production-child-tools.ts` 退休超限 `readSubmittedLocator` 并核缺席，重建为原 step/call/effect资格与locator投影、原source/current事实读取和exact/authority验真两个完整职责。其它必要检查及模拟均提前裁留，不整文件删除或搬家；无新文件、公共端口、Owner、存储或生产行为，不能称全部片区都重新建设。

本续单主审先从五级义务及真实消费者正查，再从各失败、source/current和缺席反查：规范无须变更，所有对象均有直接消费者及当前验证落点，不能删除必要保护。写前再核 main/目标 Git 状态；所有写入仅主 Codex。施工后正向与反向自检各一遍，原算法核所有受影响函数预算，由只读子审只审实际修后差异；随后从原生 CHANGE、提交首推、完整 READY、第二推重走。保留首次 FAIL，不以单项或审计替代质量结果；任一新实质 finding 交原庭，禁止扩改无关系统。

## 8. 有限验收分母与完成证据

WO-6 补充的已证直接消费者为 `scripts/acceptance/agent-production-runtime-startup.acceptance.ts` 的迟清理 GPT 夹具（原约277—286行，Owner：agent-production-runtime）。原生 CHANGE r3 在 `PRODUCT_PROVIDER_EFFECT_IDENTITY_MISSING` 提前失败，尚未到 complete callback；旧夹具还把 URL 放入发送值，且对 URL Child 无差别返回 checkpoint。三名固定法官对同一原件均裁定保留迟清理验收、修其具体夹具，生产 effect 保护无违规，不放宽或处分生产 guard。该对象是本次共享合同的真实测试消费者，不是新增业务目标。

此单保留真实 Executor、Store、原 artifact release/settle/log fault 注入、六种 staged/completed/post-product/log-failure/foreign-attempt/foreign-payload 模式，以及结果优先、异身份拒绝、恰好一次释放、完成后 settle、唯一终态与因果断言；删除它们会失去真实 dispatch/finally 出口保护，Product 自有调用序列测试不能替代。仅物理删除该过时 `createExecution` mock，立即核旧 mock 缺席，再从现役发送事实/effect receipt/URL Child/checkpoint 合同重建该同位置夹具；不复制旧 mock 或恢复旧发送 URL producer。新 mock 的发送值不含 URL，具备原 effect 身份；只在独立 URL Child 返回同 effect/user 的 locator，随后仍由原 checkpoint 输出进入原 complete callback，额外核两步调用身份。其余运行时用例不动，无新文件/入口/Provider 操作。

修复分级为轻度：首断和同合同第二缺口均已由代码及原生栈定位，只涉及这一测试 Owner 的局部 mock，无生产、法案、施工图或持久状态行为变化；按当前已两遍完整回读的闭环 Skill 原位补单后施工。写前核 Git 状态，删除/缺席原件保留于本任务工具记录。相交 Runtime 原验收必须实际到达并通过原六模式，随后从 CHANGE 重走；不能用局部结果放行当前已失败的 r3。另有五个生产函数结构预算题仍按独立司法命题处理，本单不据此修改它们。

第二单为本轮四文件内五函数的结构超限：locator reader/事务回调为18/18，Actor URL读取27，submit handler24，Session.execute23，现役上限16。三名原法官分别裁保留规则及必要职责、逐函数修；不提高阈值、设豁免或处分无关函数。主 Codex 分级中度：根因清楚，但 Browser/GPT 两 Owner 的顺序、事务与恢复保护须独立技术核对。复用 J2 的只读技术分析已实际读取四文件，披露既有司法上下文，不作为全新盲审或方案批准。

此单仅重建四文件内的受影响片区：locator 文件保留统一公开 reader/bind，将现代载荷完整解码、同包证据生成定位值分为各有真实返回值的局部职责；事务选行、解密、构造调用、幂等/冲突、双权限核验、原密文 CAS/readback仍在同事务。Actor 主方法保留缓存优先、无缓存的原attempt/revision/Target核验及原有界循环，同文件仅分出入口/原CONFIRMED事实取得职责；若这已满足16预算，不额外抽观察循环。submit handler保留fresh一次click与原effect资格，将完整消息proof解码作为同文件局部职责，fresh hash比较保留在主流程。Session主分派保留原顺序，仅分出实际结果状态结算（submit/risk记录、locator capture、checkpoint成功后的pending清理）；满足预算即不再拆准备步骤。每一局部函数由原入口直接消费，返回事实或完成原状态职责，不抽单一布尔条件掩盖预算。无新文件、Owner、端口、时钟、存储或质检规则；只在相同文件中完成职责分离。

施工先物理删除这次新增的locator文件及submit handler文件、Actor现URL方法和Session.execute方法，立即核缺席；原共享方法/导入及独立保护保留，再依上述职责重建。终态验真仍先于absent/历史/现代locator分派；证据构造必须在原事务内；缓存仍先于live绑定；deadline仍从首个实际包开始；readback零输入，只有fresh比approved hash；source checkpoint仍原短路且URL不走它；URL不清pending，原checkpoint记录成功后才清。主Codex先正向逐保护再反向按故障/恢复自检各一遍，复核实际函数预算及已有Browser/GPT用例，由只读子审审实际差异后回原生CHANGE，不形成另一质量verdict。Runtime夹具单已通过原验收；该结果不替代本单验证、CHANGE或READY。

| 用例 | 明确预期 | 观察/readback |
| --- | --- | --- |
| URL 立即可用 | 发送后独立取地址，原回答正常接纳 | send=1、URL Child=只读、原工单结果 |
| 准确消息已出现，URL 晚于 5/15 秒出现 | 发送已 CONFIRMED，不重新发送；URL 在独立阶段取得 | 原 WAL 输入计数恒 1、独立定位记录、原回答 |
| 利用本次六条时序构造确定性延迟 fixture | 正确实现不因 URL 晚到拒绝发送；错误地保留 URL 耦合应失败 | 原 Browser/GPT fixture，不发六次真实昂贵解读 |
| 点击后消息未出现或内容不符 | 不伪报发送成功，不因移除 URL 而放宽消息保护 | 原失败 receipt、input 事实如实 |
| URL 在独立窗口内始终临时/非法 | 定位失败，原发送 CONFIRMED 不撤销；该 Child 不发送/导航 | 原 terminal proof/authorityHash 不变 |
| URL 只读失败、abort 或日志故障 | 本次 no-input 与原 CONFIRMED 发送事实分开；failure wire 保留原 effect | 原 V6 failure facts 对照，无新 Website 字段 |
| pendingReadbacks / source reuse 中插入 URL 步骤 | 仅同 step/effect 允许；URL 不冒充 checkpoint、不提前清恢复条目 | 原会话门及 source fixture；无 fresh 输入 |
| locator 写入前崩溃，原 live 绑定仍在 | 原发送只读恢复，再取 URL；不运行 fresh 准备 | 同 effect、Provider 增量 0 |
| locator 写入后崩溃/Tab 丢失 | 原 WAL 恢复定位，原 checkpoint 最多一次精确导航 | 原 URL、原 effect、结果内容 hash；Provider 增量 0 |
| 发送后 URL 未保存且原绑定完全丢失 | 保留真实已发送事实，只走原 unaddressable/Website 权限边界 | 不声明已找回；本方案不产生 submit |
| locator CAS 重复/冲突/跨身份 | 相同幂等；不同或坏证明拒绝，不修改原发送 | SQLite 原行及 envelope 读回 |
| late receipt / source seal / 撤权竞争 | locator 不改 immutable receipt；无当前权限不绑定；不改旧 sealed anchor | 原哈希、旧 source seal 与物理计数 |
| 已有旧格式 CONFIRMED / 本次旧 REJECTED | 前者只读有效旧 locator；后者不升级、不回填 | 原回执与历史记录保持 |
| 13 个 Product 全消费面 | 只增加同义 URL 衔接；prompt/model/result/业务分支不变 | 每产品原 acceptance；全调用点反向引用零遗漏 |
| 文本/图片/continuation 对照 | 沿原 locator 读原答案、媒体或父会话，原两门及严格父关系不变 | 原 acceptance 与 endpoint receipt |

动态验收仅在后续明确获准的测试/生产操作范围内执行：使用一张可核对原身份的合法工单，关联发送 WAL、locator、Forensics 原回答、Runtime stage/Outbox、Website admission receipt 和领域持久结果。可用已有成功回答/既有授权继续读取时，优先复用，不为凑证据重复付费生成。现场不能安全制造 URL 延迟时，fixture 只证明延迟分支，真实运行只报告实际观测，不冒充延迟生产证明。

功能质量与施工纪律分别核验：前者验证上表和原业务终点；后者核 §7.0 的删除→即时缺席→新建原件、删除前保留裁决、最终 diff 与全消费者引用，保全用户改动，确认无旧 URL 耦合、旧 producer、第二链/存储/Owner。历史凭据验真不能产生旧发送或兼容执行路径。READY 仅证明其等级，真实运行及实际工单交付另按同身份日志/持久事实报告。

## 9. 两轮反向检查与施工门

本轮执行前的两遍规范自检均由主 Codex 完成。第一遍从源头向实现合同核对：四份指定栏目源头正文/附录完整读取；两仓现役法案逐条主旨/作用域遍历，AGENT 全部禁令及 Website 直接相关接收、恢复、专业分权条款回读；七份 AGENT 与四份 Website 施工图的职责、主链、连接及相关正文遍历，未把无关规则扩为施工对象。对齐范围实为三个法条 major、两个原 Manifest、GPT/Browser 两份施工图及唯一生成 registry；原生 builder 返回 REGISTRY_BUILT。新增发送证明/定位字段、唯一 Owner、历史终态不变、原回答门与节拍、13 产品消费面和 Website 无字段变化均有 §4—8 落点。

第二遍由业务终点反查：核原 effect 的准确消息→独立 locator→原 checkpoint/artifact→原 stage/Outbox→Website 原接收及 PDF 交付边界；复核缺 URL 不授 fresh、URL 失败运输原 CONFIRMED、pendingReadbacks/source 分派、旧 sealed anchor 不补写、locator CAS 不改发送 authority、历史 REJECTED 不升级、删除前保留及过程证据顺序。当前规范差异仅替换三个 active major，各旧 block 已退出，未增加 law 或 evidenceMode；其余依赖仅投影新 lawId，义务不变。原生 projection 返回 PROJECTION_CURRENT。上述有限必需项未发现未闭合规范 GAP；这是代码准入核对，不是代码建设、质量或生产通过声明，也不以自评百分比替代证据。

本轮实际建设的两遍主 Codex 自检已执行。第一遍从消息/附件原前置出发，核新发送证明无 URL、WAL 唯一终态及 locator 同槽 CAS，逐个核新 Child 登记、类型、执行 context、atomic identity、现有 failure 运输与 14 处 Product 交接；确认不改专业 Prompt/模型/结果、回答两门、Website 接收或 SQL schema。第二遍按 §8 从 checkpoint/artifact、source/pendingReadbacks 及 locator absent 反推发送资格，核旧 CONFIRMED 零输入读回、原 proof/updated_at/authority 不变、同 attempt 新 fence、signal 穿过 quiet 后检查、跨 attempt 不补写、历史 REJECTED 不升级；只读分段子审两项发现均已修复并复核。两遍均核 Git diff 与原删除/缺席工具原件，没有把自查或分段子审作原生质量结论。当前 GPT 与 13 产品工程回归已通过；Browser 完整七入口同候选回归退出 0。实际建设子审未留新增代码阻断项；删除/即时缺席中间原件由主 Codex 回核本任务工具记录，未让子审冒称亲见过程。真实工单和生产结果尚未验证，CI-FULL 尚未执行。

本次 CI 迭代追加两遍主 Codex 实际代码自检：先逐字段及执行顺序核 terminal→locator decoder→事务内证据构造→同槽CAS、fresh/readback消息证明、Actor缓存/原绑定/有界循环及Session结算；再从checkpoint、source/pending、坏locator/权限/冲突和迟清理六模式反向核原输入、结果与唯一终态保护。实测四文件全部函数最高复杂度15/16/14/16，未改规则或用布尔壳掩盖。J1限定审计实际修后五文件及直接消费者，未发现可操作finding，不作为新盲审或三票履行审批；删除/即时缺席过程仍由主工具原件负责。Runtime夹具原验收退出0（结构修复前），结构修复后typecheck、GPT及完整Browser七入口均退出0；普通结果不能替代全局质量。原生CHANGE r3真实失败和原输出保留，两案已据原固定庭裁决落实，下一步从CHANGE重新开始，尚无clean提交/推送/READY或重启；上段初次建设时“CI-FULL尚未执行”为当时状态，由本段更新。

第一轮从发送端正向检查，已补入三处遗漏：① URL 失败必须运输原 CONFIRMED effect，不能被本次观察的 no-input 覆盖；② pendingReadbacks 精确允许 URL Child，且不把它分派给 source checkpoint；③ 新发送证明与 locator 的 schema/字段固定，原 receipt、发送 authorityHash 和 source seal 不因后补定位而改写。目标仍是发送独立落地、URL 零输入、checkpoint 接完整定位、Website 原业务链接纳。

第二轮从末端反查并逐项对照闭环 Skill，已进一步收窄：① 将工序分组拆成唯一 Owner 的原子施工单，避免跨域大工单；② `browser-authority-api.ts` 已有类型转导，删除对该文件不必要的包装/改写建议；③ 明确现役 V6 的 Child identity 是 string 且 locator 只投影为已有 hash/anchor 字段，Website 无新增字段或策略；④ 13 个 Product/14 个直接 submit 文件与一个 SEO helper 全部列入必要机械衔接，原专业行为不变；⑤ 未保存 URL 且完全丢失绑定时保留原输入事实，明确不承诺凭空恢复。两轮均未运行生产或把 fixture 当生产证据。新发现只更新本文件；不得生成 v2/final 副本或隐藏追加基础设施。

施工前必须重新读取目标权威、原生 Git 状态和相关符号，核本方案仍与真实实现一致；相关漂移只重算该条，不扰动并行工作。原 law-amendment 和相交测试写权限已由本轮授权关闭；规范对齐与 §7.0 两遍主审仍是代码施工前置。不得通过新测试文件、跳过或覆盖用户改动制造合格。CI 的实际差异/clean commit 若仍受并行未提交工作影响，如实保留原生阻断，不 stash、reset、建分支或擅自提交无关工作。

失败收尾只停止受影响动作并保留原 WAL/答案/receipt/source/Outbox；本方案不需要人工改库、删除工单或重放 Provider，也不授权回滚用户工作。需要新责任、字段或外部操作时先更新本方案的具体缺口与边界，不自行扩张。受控本机重启已明确授权，必须在已验证代码与对应扩展产物可用后执行并读取真实健康事实。

最终汇报须分别列出：经论证保留、局部修改、删除退役、真正重建、失败回退、尚未完成；不得用 READY/局部测试替代真实业务完成。重启、CI-FULL、提交推送和实际工单结果分别如实汇报。
