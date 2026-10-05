# GPT 图片附件首次识别替换｜完整实现方案

状态：**可施工（设计结论）**。当前进入执行授权：先完成法案施工图对齐与主 Codex 两遍审计，再施工。生产修改、原生质量与真实业务完成分别以实际读回为准，方案本身不签 PASS。

## 1. 授权、范围与唯一方案

授权原文：“启动闭环skill，因为图片是第一次识别附件，当前的错误属于初犯，所以按照替换当前识别的模式，请制定方案”。前置约束：“json文件已识别了，它不用迭代吧！”

本任务采用**替换当前错误卡片识别规则**。首次图片适配遗漏与既有 JSON 识别成功并存：保留 JSON 的 BUTTON 识别行为、文件名身份和结果合同，替换“所有附件卡片都必须是 BUTTON”的错误假设。不是替换 JSON 解析器，也不是新增图片备用上传链。完整范围是 4 个 GPT Child 的卡片 selector、1 个 Browser 上传读回 selector，以及这些直接消费者对应的既有检查器与验收。追加授权：付款确认的截图观察 Product 使用“最新”、推理请求值 2；固定文案本地化的“最新 / 3”不变。

唯一方案就是本文件，primary Owner 为 `gpt`；Browser 代码由 `local-browser-session` 拥有，付款 Product 和验收由 `architecture-boundary` 拥有。用户已授权法案、施工图、代码、质检与必要数据库操作；没有本次必要性的结构必须删除或禁止新增。只在现有 main 主仓施工，主 Codex 独占写入，子智能体仅审查。使用冻结 CI-FULL Skill；最新用户授权收束为 AGENT 单仓 CHANGE → clean commit → READY → 推送 main，本轮不执行 RELEASE。各级结论以唯一 quality:check 为准。双仓法案施工图必须先完整遍历，主 Codex 两遍审计全部具体义务闭合（不低于用户 98% 门槛）后才进入代码；重要步骤只读协同审查，完工主 Codex 两遍自检后第三方按本方案逐项复核，完成和准确性均不低于 95%，未放行不得结束建设。

既有《GPT附件入口OR精确迭代-完整实现方案》解决上传菜单入口缺少 chatgpt-context 分区，与本次卡片标签断裂不同，保留现役已获准菜单表达式。《GPT附件集合实证与采集兼容-完整实现方案》针对四份 JSON 的 Provider 名称身份差异，也不是本 GAP；不改写、不新增竞争方案。

## 2. 当前源、法案与设计准入

实施仓：AGENT；施工源：本地 main，tracking origin/main。设计阶段工作树干净；执行阶段开始时已有本方案及其 GPT Manifest / registry 登记差异，属于同一获准工作。其它目标写入前必须重查状态，保护并发用户改动。Git 基准只在本次执行上下文用于比较，不写为任务的固定执行来源。候选身份仅使用原生 Git；不保存第二份文件哈希清单。后续施工必须重读当前 main、目标 Git 状态和现役规范，漂移后重做受影响准入，不能凭本文件历史结论自动 PASS。

按 frozen-spec-index 读取冻结母本 §0、§4、§35，及本次设计、ownership、CHANGE、检查和删除裁决对应 §19–27、§36–38、§41–42、§44、§46–48、§74。闭环实现设计 Skill 完整读取两遍。本 GAP 涉及 GPT / Browser 两个 Owner，且相邻附件区域已有近期迭代，采用**深重建的有限片区**：从 Product approved files 到 4 个 Child、Browser 上传读回和真实 submit 前的机械核对，不泛化至整个生产系统。

现役约束：

| 权威 | 本次落实 |
| --- | --- |
| LAW-GPT-001-V64、LAW-GPT-002-V31 | Product 批准集合唯一；准备在当前 attempt / Document 重建；真正 submit 仍只核批准 prompt + 附件集合及 Browser 动作权限 |
| LAW-CAPABILITY-GOVERNANCE-001-V18 | Child 内部 DOM 合同就地替换，沿原 coherent observation → 一次动作 → fresh 后置读回；不建中央 selector registry / classifier |
| LAW-LOCAL-BROWSER-SESSION-004-V56、006-V45 | Browser 唯一 lane / WAL，当前 Target / Document / fence，机械执行；不取得附件业务语义 Owner |
| LAW-CODE-PURITY-001-V6、002-V2、003-V3 | 有当前消费者，原位复用；不新增空壳、私有跨 Owner import 或仅测试消费的生产模块 |
| LAW-AGENT-PRODUCTION-RUNTIME-004-V43 | staged / terminal 不等于完成；最后以 Website 原 job / revision / result hash 的业务准入回执读回闭环 |

GPT V68 施工图明确允许控件变更时，在原观察、一次动作和后置读回链中替换当前页面已证明的精确合同，并让旧 selector 与其检查同步退出。Browser V56 施工图允许原 typed query 消费该精确规则。现役法案和冻结母本无需修改；两份既有图先对齐本轮卡片边界和真实 CSS 验收，不新增图或复制模型策略。Website 图与法案要求 AI 只观察截图，Website 确定性事务裁决证据接纳；无需 Website 代码、表或历史任务迁移。

保留冻结边界 `FROZEN-GPT-ATTACHMENT-PROVIDER-DUPLICATE-SUFFIX-001`：NFC，精确批准名优先，仅在未命中时按原规则接受一次末尾数字或日期时间尾缀。本方案不解冻、不扩张该语义。附件等待、空集合、两项提交前置条件、confirmed effect 零输入读回全部保持。

原生质检事实：已核对现役 `quality:check` CHANGE 路由、GPT / Browser Manifest 与唯一 registry；本轮设计准入不把历史 READY、拟执行测试或现场只读 DOM 计数认定为修复 PASS。施工后的唯一 verdict 仍由原生 quality:check 给出。

## 3. 事故证据与因果链

原工单 `aiprod_cda50d3e-67dc-49a1-af6d-101a885786f7`，产品 `payment_screenshot_observation`，动作 observe。task_json.material_refs 批准一张 payment_screenshot 图片和一份 result_contract JSON，预期集合为 2。

2026-10-05 在保留的 Chrome 事故页 `https://chatgpt.com/` 只读观察，同一 composer 内：

| 对象 | 当前实际节点 | 旧规则命中 |
| --- | --- | --- |
| payment-screenshot-ae0ab1846ca2(8).png | DIV，role=button，composer-attachment-surface，aria-label 为文件名；图片已加载 | 否 |
| result_contract-d0c27620eb6a(8).json | BUTTON，composer-attachment-surface，aria-label 为文件名 | 是 |

composer=1；旧 `button.composer-attachment-surface[aria-label]` 数量=1；新规则数量=2；新规则派生 pending 数量=0。宽泛 `.composer-attachment-surface` 会把无 aria-label 的装饰 SPAN 也纳入，不能采用。已加载 / naturalWidth 只属于事故诊断，不新增为发送资格。

原事故读回多次 `GPT_ATTACHMENT_SET_MISMATCH`：items=1/1、missing=1、unexpected=0、duplicate=0、uploading=0、pending=0。Browser 已有物理上传 confirmed 事实，不能据 GPT 漏计声称图片没有上传，或清旧 WAL 后再次上传。另一次最新失败出现 LEASE_RENEW_FAILED / GPT_EXECUTION_ABORTED，属于独立故障事实，不把它归因于图片 selector，也不在本方案扩修 lease。

真实 Product 调用链 `src/plugins/payment-screenshot-observation/flow.ts::runFreshTurn`：先 readConfirmedSubmit；无既有提交才 prepare_clean → profile → applyAttachments（8–10）→ write_exact_gpt_prompt（11）→ submit（13）。因此附件集合核对失败会使 prompt-write 永远不被调用。不能通过提前写提示词、取消集合核对或延长等待绕过根因。

有限历史：reconcile selectors 在已核实提交 f306447f 中从 role=group 改为 BUTTON 卡片，后续核实片区未发现已经适配 DIV 图片而再次回退的证据。当前按用户指定的首次图片识别遗漏处理；既有菜单修复次数不是这次图片识别回归的证据。

## 4. 唯一目标规则与完整消费者

在唯一 `form[data-chatgpt-composer]` scope 内，把原 ITEM 表达式整体替换为：

```css
:is(button, div[role='button']).composer-attachment-surface[aria-label]
```

Chrome 事故页已只读实测该表达式的双引号等价写法，精确取得图片与 JSON 两张卡片。施工使用上述单一字面值。这里只枚举当前已证明的两种卡片节点，不保存“旧图片规则 → 新规则”的探测、回退、版本分支或第二路径。BUTTON 仍对应正确 JSON 卡片；DIV 必须 role=button、同一 class 和 aria-label，不能用裸 DIV、后代 IMG、文件扩展名猜卡片或任意 class 子串。

pending 继续为 `${GPT_ATTACHMENT_ITEM_SELECTOR}.cursor-wait`。使用 :is 后 cursor-wait 同时约束两类卡片，不能写成只给逗号后的分支加后缀。spinner 仍读取原 scoped progressbar，不增加图像加载等待。

| 当前消费者 / 生产改动路径 | Owner | 同步替换的必要性 |
| --- | --- | --- |
| src/capabilities/gpt/children/prepare_clean_gpt_chat/selectors.ts → observation.ts 的 attachments 查询 | gpt | 图片残留不能误判为空 composer |
| src/capabilities/gpt/children/attach_approved_gpt_files_once/selectors.ts → attachment-observation.ts | gpt | 上传前外来图片不可漏看；空批次核对仍准确 |
| src/capabilities/gpt/children/reconcile_gpt_attachment_set/selectors.ts → observation.ts | gpt | 混合批准集合读取完整且 pending 覆盖图片 |
| src/capabilities/gpt/children/submit_exact_gpt_turn_once/selectors.ts → handler.ts 的 preClickExactOutgoingTurn | gpt | 真正点击原子周期收到相同附件规则，不在最后发送时再次漏计 |
| src/lib/browser/chrome-extension/extension-file-input-runtime.ts::readComposerAttachmentPhase | local-browser-session | before / after 同包 cards 查询不能与 GPT 分母不同 |

Browser 下游 `dom-coherent-candidate.ts` 已通过 outgoing.attachmentSelector 查询当前 form；`browser-dom-special-intent.ts` 已原样验证/传递有界 selector。二者**复用现有代码，不改函数**，以真实注入函数验收证明传入的新规则生效。卡片常量保留各 Child 的局部所有权，现役 GPT inspector 对齐精确值；不新增共享生产 selector 模块。

## 5. 原子工单与施工次序

### WO-GPT：替换全部 GPT 卡片规则并闭合既有质检

Owner gpt；依赖本方案当前源重新绑定。顺序：

1. 主 Codex 将上述 4 个 selectors.ts 整个删除，确认缺席后按现役局部职责重建；物理退休 BUTTON-only ITEM，reconcile 的 pending 保持由 ITEM 派生。所有已验证菜单入口、JSON 文件名规则、控制流和 public contractVersion 保持。
2. 在 `scripts/audit/domains/gpt/gpt-attachment-contract-inspection.ts` 的现役检查中替换 approved ITEM 值，并补齐 4 个 Child 常量及 Browser readComposerAttachmentPhase 卡片 query 的 AST 核对。Browser 节点必须锁定该函数中的 attachment-cards query，不能全文件搜新字符串即 PASS。缺失、恢复 BUTTON-only、宽化或任一消费者漂移都给原生 finding。
3. 更新 `src/capabilities/gpt/acceptance/gpt-page-fixture-selectors.ts` 的独立 pending 预期；不跨 Owner import GPT Child 私有 selector。
4. 在 `gpt-exact-target-source-support.ts` 的既有内存 AST 工程补齐 prepare_clean / submit selectors 源文件，保持正例无 finding，并按每个直接消费者逐一注入旧规则反例，要求 inspector 失败。同步 `tests/governance/quality-contract.test.ts` 现役附件合同反例，保留菜单 OR 和冻结等待反例。
5. 扩展现役 `gpt-attachment.acceptance.ts` 与相关原有 session / submit 验收，覆盖图片单卡、JSON 单卡、混合双卡、clean / foreign / empty / pending / final guard。相关 submit 测试入口 `gpt-proof-submit.acceptance-support.ts` 必须检查 Child 实际传出的 attachmentSelector 与批准标签集。

输出仍是原 typed coherent facts / Child proof；不能新增 isImage、附件类型 registry、数据库、retry queue、第三发送门禁。完成读回：4 个实际 query 均取得符合新规则的卡片事实，批准集合相等且零 spinner / pending 才由现役 Child DONE。

### WO-BROWSER：替换上传读回的机械卡片规则

Owner local-browser-session；依赖与 WO-GPT **同一候选**采用上述规则，二者不得分开宣称修复完成。

1. 删除 `extension-file-input-runtime.ts::readComposerAttachmentPhase` 原函数片区，确认缺席后重建同一机械观察函数，使用批准卡片规则。before/after、composerUploadObserved、文件 chooser、菜单 activation、路径 grant、时序、物理输入计数、WAL 均沿现役实现。
2. 扩展现役 `scripts/acceptance/local-browser-file-input-support.ts`，令 before / after 卡片事实来自真实 DOM 对实际收到 selector 的查询；混合 batch 应只有一次 setFileInputFiles，完整卡片读回为 2，未批准或重复卡片不能成功。沿用原上传中进度条件，不把“已出现 2 张卡片”新增成 Browser 唯一上传确认条件。
3. 在现役 `scripts/acceptance/local-browser-dom-candidate-support.ts` 中，对捕获的**真实 outgoing 点击资格函数**执行图片 DIV + JSON BUTTON 混合 DOM 用例，校验新规则、精确 prompt hash 和批准名集合；缺图片、外来图片、重复标签必须在物理 submit 前拒绝。继续原名称尾缀正反例，不修改匹配算法。
4. 复用现有 Browser terminal acceptance 调用路径；必要的通用 DOM 测试能力只复用现役 function fixture/support，不新增生产测试通道。

输出仍是原 Browser confirmed / rejected typed fact，GPT 才裁决批准集合。完成读回：before 非空图片不能漏过，after 正确含两类卡片；outgoing 同一点击原子周期用相同规则。不得在 Browser 再建附件语义 Owner。

### WO-PAYMENT：付款观察 Profile 唯一替换

Owner architecture-boundary。只在 `src/plugins/payment-screenshot-observation/flow.ts` 原 MODEL_PROFILE 片区删除并重建配置：`startModelDisplayName: "最新"`、`requestedReasoningValue: 2`；profileRef 同步表达新策略。付款 observe、accuracy_challenge、quality_reflection 继续共用唯一 Product Profile，不新增动作特判或 Website 副本。模型及 reasoning 的实际 Child 调用必须携同一新 Profile/hash；GPT 现役模型标签精确匹配和推理滑块 min/max 裁剪保持。

原付款 Product acceptance 按全部 action 验证新建调用模型/推理输入为“最新 / 2”，新旧 hash 不混用；原 confirmed-submit recovery 验证零 fresh、零模型设置、零附件、零 prompt-write、零新增 submit。历史效果及其原 Prompt/hash 只读保留，不重签旧 WAL，不清工单或结果。只观察截图，不提供收款确认或权益裁决，不改 JSON/result contract，不需要数据库修改。

### 测试实现的实证要求

当前多份 fixture 按 queryId 直接返回固定计数，现役 FakeElement.querySelectorAll 也是预设查询表，均不足以发现 selector 漏识别。新增关键正反例必须让**实际消费者发出的 selector 在有真实 tag / role / class / aria-label 的 DOM 上求值**，随后经原 coherent facts 或真实注入函数形成结果。仅把 mock 的 rawCount / eligibleCount 改为 2 禁止当作本 GAP 验收。

具体复用仓库已安装的 Playwright 1.59.1 系列依赖与已存在的 Chromium 缓存可执行文件。在上述既有 GPT / Browser Native Exam 验收文件中建立隔离、无持久 profile 的本地合成 HTML 页面，以原请求的 scope / selector 查询构造事实；Browser outgoing 用原捕获函数在该页面真实执行。该页面不得连接 chatgpt.com 或 Website，也不读取用户 Chrome profile；测试结束关闭页面与测试 browser。不下载或新增依赖，不用自制 CSS 解析器替代真实 querySelectorAll，不进入 Static Audit 或冒充生产 Dynamic Proof。继续复用现役函数捕获与 Child harness；不建立新的共享生产模块。

## 6. 唯一链、handoff 与身份脊柱

目标唯一链：

Product approved artifacts → prepare_clean 当前 composer → GPT open 原菜单 → GPT attach once → Browser 原文件 grant / WAL / 一次 batch / 2.5 秒 fresh 上传读回 → GPT reconcile 完整卡片与零 pending → 原 prompt-write → GPT submit handoff → Browser 同一原子点击前 prompt hash + 完整附件集合 + 动作权限 → 原 CONFIRMED effect → 原回答 / Product result parse → Runtime staged outbox → Website 原业务准入回执 → Runtime 原 completed readback。

Handoff 保持现有类型：

| 交接 | 输入/事实 | 消费与拒绝 |
| --- | --- | --- |
| Product → GPT | artifactRef、displayName、sha256、bytes 与原 job / step / call | Product 唯一批准；名称或 bytes 不符沿原失败关闭 |
| GPT → Browser upload | approvedArtifacts / 原 grant，菜单 activation | Browser 唯一路径与物理动作 Owner；零或一次输入事实不能伪造 |
| Browser observation → GPT | 同包 composer/cards/progress/pending，Target/Document/revision | GPT 读取当前集合；身份漂移或多义拒绝，差异沿原 deadline 处理 |
| GPT → Browser submit | 原 promptHash、expectedAttachmentLabels、单一卡片规则 | 真实点击前整包核对，失败零 submit；既有 confirmed effect 先零输入读回 |
| Runtime → Website → Runtime | 同 job、attempt、result revision、result hash、权威 admission receipt | 最终业务 Owner 完成准入且原回执持久读回，才能说原工单完成 |

attachment identity 仍是 Product 的原 artifact / job 绑定及现役 Provider 展示名；submit effect 不加入 attempt、Target、Document 或测试标识；准备动作维持 target-local 身份。新 DOM 类型不是新业务身份，不另建 image lane 或持久 attachment state。

## 7. 有限分支及完成边界

| 场景 | 现役链目标 / 验收 |
| --- | --- |
| JSON 单卡 BUTTON | 原名称与结果合同无变化，集合 1，原流程成功 |
| 图片单卡 DIV role=button | 集合 1；不用 IMG / naturalWidth 作为资格 |
| 批准图片 + JSON | 两卡完整，原集合核对 DONE，才进入 prompt-write；submit 前再次同包相等 |
| 空批准集合 / 空 composer | 原零附件只读分支成功，上传次数 0 |
| composer 已有未批准图片 | clean 不误判干净；外来附件 gate 阻止物理上传 |
| 无 aria-label 的装饰 SPAN、缺 role 的 DIV、form 外卡片 | 不进入批准卡片集合；混合事故页仅真实 2 卡 |
| 匹配规则的隐藏/不可资格卡片或多 composer | 维持现役 raw / eligible 与唯一性拒绝，不额外放宽可见性 |
| 缺失、外来、同名重复或非法改名 | 原精确集合 / 唯一身份失败；不得以集合 Set 去重后冒称通过 |
| 已批准精确带括号名及合法 Provider 单尾缀 | 精确名优先，原 suffix 规则正反例继续成立 |
| 图片或 JSON cursor-wait；progressbar 尚存 | 任一卡片 pending 不可 DONE；沿原 Product deadline，不能多上传或刷新 |
| 暂未出现完整集合 / 等待到期 | 原等待协议；到期按真实差异或 pending 报告既有 typed failure |
| Target / Document / fence 漂移 | 零新增危险输入，原 typed failure；不从事故页或历史 tabId 借身份 |
| 原 submit 已 confirmed 或结果未知 | confirmed 先同 effect 零输入读回；未知按原 WAL authority，不手动重发 |
| lease renewal 单独失败 | 如实报告 Runtime 边界故障；不能用此方案宣称 lease 已修复 |
| 出现尚未取证的新卡片结构 | 重新读现场、规范与有限片区并重做准入；不能现场追加宽泛 fallback |

两个 Owner 的工单全部完成且所有直接消费者一致，才算代码层修复。原工单复验还须完整 prompt / submit / result / Website admission 证据；只数到两卡或 Browser uploaded confirmed 都不足以报告工单完成。

## 8. 删除反事实与结构预算

| 现役对象 | 删除后真实损失 | 裁决 |
| --- | --- | --- |
| BUTTON-only ITEM 识别谓词及绑定旧预期 | 不损失正确 JSON 行为；保留它会持续遗漏 DIV 图片 | 在全部 5 个生产位置及直接验收同步物理替换；不得保留旧回退路径 |
| 4 个 Child 的局部 selector 与 coherent observation | 删除会分别丢失 clean / foreign / settle / final-submit 实际检查 | 保持原 Owner 和观察链；旧 selector 文件删除缺席后唯一重建 |
| Browser readComposerAttachmentPhase | 删除会失去输入前后机械上传实证 | 旧函数片区删除缺席后唯一重建，不改变上传时序 |
| 附件名称冻结匹配、pending/spinner 和 exactOutgoing | 删除会放行错材料或未完成上传 | 全部保留；这不是 JSON 迭代 |
| 新 selector helper / variant registry / image retry / Image Owner | 没有本任务不可替代的消费者和职责 | 不新增 |

此处为局部 DOM 合同替换，授权范围不需要删除整份仍含正常菜单、JSON 和动作协议的文件。旧错误谓词须消失，不以覆盖旧文件后留下死代码充数；检查器的旧 approved ITEM 真值同步退场。

已核实关键现役生产文件：extension-file-input-runtime 350 行；GPT attachment inspector 167 行；4 个 selectors 文件 5–13 行。复用现役检查函数和循环，函数 ≤75 行、生产文件 ≤500 行及其它纯洁性预算全部以施工后 native check 为准。仅因超预算才按已有职责拆分；禁止 wrapper / 空壳 / 第二检查器。测试若需拆分仍须有真实现役验收消费者与明确 Owner，不凭“以后复用”新增模块。

## 9. 施工验证与上线后的事故闭环

顺序门：重新绑定当前源并检查目标状态 → 两个 Owner 的差异及实证验收闭合 → 原生 CHANGE → 当前授权的干净 main commit 原生 READY → 推送 main。本轮不执行 RELEASE / Dynamic Proof。可施工仅说明设计无未闭合结构阻断，不提前授予这些阶段。

未来施工命令须在精确 shell 环境确认 Node v24.20.0，再使用现役入口：

```sh
export PATH=/Users/nexgen/.nvm/versions/node/v24.20.0/bin:$PATH
node --version
npm run acceptance:gpt
npm run acceptance:local-browser-terminal
node --import tsx --test tests/governance/quality-contract.test.ts
npm run quality:check -- CHANGE
```

聚焦验收是诊断/实证，不是第二 quality verdict；原生 CHANGE 会按 actual diff 选择相关验收，已经通过的检查不无故重复。登记或生成投影变动先用 `npm run audit:build` 和 `npm run audit:projection:check`；不手改 generated registry。

需要运行切换时，先按现役 Runtime / Browser Owner 的 terminal、停写及 input-quiescence 规则核对旧动作，再使用现役构建及同候选配对机制，读回实际加载的 Browser release identity 与 Agent 代码身份。禁止直接 reload 活动扩展、删除原工单/WAL、复制一个新任务或手点事故页来制造成功。

原工单继续执行只能消费 Website 当前有效 grant / attempt / revision；本方案不预签新输入资格。旧上传事实保留，submit 未决则遵守原 WAL 门，不从“提示词还空”推导零 Provider 输入。最终读回：同一原工单两份批准材料的完整集合 → prompt-written → 原 submit effect / receipt → 合格 result_hash → Website admission 的同身份持久回执 → Runtime completed。Website 失败或 grant 缺失时保留原 typed 边界，不能把 AGENT 单侧成功改写为业务完成。

运行事故现场继续保留至验收所需证据读回；不关闭操作者页。回退只处置本任务自己的代码与构建，重新绑定候选并复核当前动作身份；旧 BUTTON-only 不能在回退后被宣称图片修复成功。并发用户改动、未知 WAL、证据缺失或源漂移均失败关闭，不 reset / stash / 清库求绿。

## 10. 本轮交付与准入结论

当前根因、5 个直接生产消费者、两个唯一 Owner、既有测试不足及可复用支撑、保留冻结边界、删除反事实、有限分支、上下游 readback 均已确定。结论：**可施工，按当前附件识别规则替换方式实施**。

执行阶段覆盖 WO-GPT、WO-BROWSER、WO-PAYMENT。任何具体发现必须关闭后才推进；历史设计结论不代替当前自检、子智能体放行或原生质量。生产切换与原事故业务完成必须取得当前真实身份读回，不能从静态验收外推。

