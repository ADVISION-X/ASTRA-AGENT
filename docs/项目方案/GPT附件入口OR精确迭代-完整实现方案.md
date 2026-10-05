# GPT 附件入口 OR 精确迭代完整实现方案

方案状态：可施工。交付等级：CHANGE；本文件不产生质量 verdict 或生产完成结论。

## 1. 需求、证据和边界

授权人已明确选择 OR 模式，并要求先完成闭环方案、第二步才施工。需求 Owner 为 AGENT `gpt`。目标是在现役附件菜单的一个候选查询内加入经 Chrome 实证的 `chatgpt-context` 结构，使打开菜单的直接后置及上传 activation 消费相同批准字符串。

2026-10-05T00:56:45.300Z，本会话 Chrome 专线在当前 ChatGPT 首页观察到：一个 Composer、一个“添加文件等内容”按钮、一个 active overlay；上传按钮显示“添加照片和文件 / 从计算机上传”，可见且启用。旧 OR 两个分支分别为零，新结构精确匹配一个。没有上传文件或提交 GPT。故障工单 `aiprod_cda50d3e-67dc-49a1-af6d-101a885786f7` 五次打开附件入口均为 `REJECTED / physical_input_count=1 / BROWSER_POSTCONDITION_Q2__BROWSER_DOM_CANDIDATE_MISSING`；这是打开后第三个观察 query 的菜单叶缺失，不是文件内容、授权或 Provider submit 的失败。

第一直接断裂：`open_gpt_attachment_control` 的上传叶 selector 不含新版分组；Browser 已完成入口点击，但 GPT 所需直接后置不能成立。只改此处仍会在 `attach_approved_gpt_files_once` 或 Browser 的 exact-string request validator 处拒绝，故五处合同绑定必须同步。

本轮只修上述 DOM 合同及直接关联验收、施工图事实说明和方案 ownership。保持 scope、文本要求、可操作性、基数、一次输入、文件 grant、Target/Document、FIFO/WAL、2500ms 后置规则、Provider effect 和原恢复 Owner。既有模型“最新 / 请求3”三处差异原样保留。没有新公共接口、状态、存储、恢复链、依赖或 Browser backend。CHANGE 不包含生产重启、扩展 reload、工单重发、真实文件上传、提交、commit/push 或 RELEASE。

## 2. 绑定与写前复核

项目 realpath 为 `/Users/nexgen/Documents/AGENT`；设计时 branch 为 `main`，tracking 为 `origin/main`。HEAD 只作为当前 Git 比较基准，身份在执行上下文保留，不创建第二 candidate artifact。设计时目标路径均干净，唯一已有 overlay 是：

- `src/plugins/localization-production/static-catalog-flow.ts`
- `scripts/acceptance/product-plugins/localization-production.acceptance.ts`
- `docs/项目方案/模型和推理强度自动配型-完整实现方案.md`

相关 source 绑定如下；方案自身不进入 source 绑定，文档 hash 在施工上下文另记。写前重新检查 branch/HEAD/目标状态及这些字节；相关漂移只重算受影响部分，用户改动不可安全分离时停止对应写入。

| 对象 | 设计时 SHA-256 |
|---|---|
| `AGENTS.md` | `861569b40c535f2180511885df05d53ec893e4e746475c16e182a395bbd7e91e` |
| 冻结说明书 | `27a143ecd7016887d056255e106f49caa29d83d06245ff21ea5c0ffd62b98c3a` |
| 基础法案 | `f1970c2416127f8bcdf560d0fd81105895924c4ed2cdd23f6a08ae910998d2f3` |
| 功能法案 | `37fa293fc9fcee920c855936fe9c3887ac5885da09aa8dfb89977f2a37aad752` |
| GPT 施工图 | `a24b8f064532da38fbb9d6e8d7b0ce3ffcc03988b56d30321b713a364b400ba7` |
| Browser 施工图 | `124fec0b9be9fe1220d8b6639c2c7aca30ea05dfb2308ca633953783e2e339f7` |
| Runtime 施工图 | `8c2c5e67cae3283f6b94e17c3d38e92c95034e55be31e8fc3c1e3dcc40037e90` |
| GPT Manifest | `0de6b65ca719caea63a384692689df7357a40997fa5bdbd742eadbd311c8c3c2` |
| open selectors | `4adbb88f40baddee99a8c820eeac486d445bfbeaa767249b66d6772fa5bd6d9f` |
| open handler | `87140ae23b1ec59ca6b1b42be7173144075dd0eba84cd4d0f0511e6ace091c1e` |
| open observation | `87e89b718ab623177defe9a453a13a434c2d3cb50dac0f769af31c08e8c4e8f3` |
| attach selectors | `3d5bad1049fbe1cae1d6b41a2f3458f9cb9d7ceba2274f78192afaf8e56183d5` |
| attach handler | `dbef974f120aca1785cb18531219931b40fb20f1be2b3a9eef444b5e35847258` |
| Extension file-input runtime | `325e5c4886614e2a910c372962a904bdd4560a6a408bae4c9d294a7feb2b07f5` |
| GPT attachment inspector | `a5e3336f70a237d89b4f183a9c79d1ef128c8201a09105f4adb3403c6663d15f` |
| Browser file-input acceptance support | `16c1eea57cacdbc2cfaad6c58737aaa3bbe8e99f3ebda0912296e094b9684cda` |
| GPT page fixture selectors | `c77459ee8a3d96350444776c905bb77d3f796efef51d4b504e8d293274adc3bd` |
| GPT attachment acceptance | `0f19a5aadec91e71b8b339d75c96aa8b498087bcb0b1d671670064f45a1e63a2` |
| GPT exact-target source acceptance support | `5b319dc447b3c5fdc65694abfb44af146e131a818ee07e22099a93398830b070` |
| quality-contract native tests | `14e4ba5df4da6861a485f1fcd3bd385767ac3f5581e6e4ef754b1fa43908ab9d` |
| package.json | `8eeeee3b77151bed4a3a444894424360f1efc21ddf10cb409cd087cecabd5ae4` |

## 3. 四维与前轮连续性

法案：冻结说明书 §4、§35.2、§36—38、§42、§44、§46—47；基础法案 `LAW-CODE-PURITY-001-V6/002-V2/003-V3`；功能法案 `LAW-GPT-001-V64/002-V31` 和 `LAW-LOCAL-BROWSER-SESSION-004-V56/006-V45`。本轮不改法案、Owner 或冻结业务边界。

施工图：GPT V68 末段已批准精确逗号 OR、唯一可操作候选及 Browser 同字符串；Browser V56 保有唯一物理动作与终局链；Runtime V64 的 admission 主链不变。本轮用户的 OR 迭代只同步 GPT 末段“现役两种”这一 DOM 结构事实为当前批准的三种，并明确审计覆盖两个 producer；没有新增规范义务或改变机器 topology、lawIds、contractRefs。

实现：Product 的附件步骤依次调用 open / attach / reconcile，付款截图 `src/plugins/payment-screenshot-observation/flow.ts` 的 `attachment-control-open` / `attachments-attach` / `attachments-reconcile` 是故障真实消费者。open 的 `observation.ts` 与 attach 的 `control-observation.ts` 消费各自 private selector；attach `handler.ts` 把原 approved artifact 集及 activation 交 Browser；`assertFileInputRequest` exact 比较批准串，随后 chooser backend node 绑定和授权 batch 输入；reconcile 再读当前 Composer 的批准卡片集合。保持这些现役消费者与 typed 输出，不新建公用 selector 模块。

有限历史筛查命中回归信号，故按受影响实现图执行深度核对：`cdcc899fe` 曾修正 Browser 只批准单分支、GPT 已使用 OR 的脱节；后续现役代码撤销 acceptance 对 GPT private selector 的跨 Owner runtime import，改用独立 fixture literal 和 inspector AST 相等证明。保留这两个已落地不变量；当前不是它们的回退，而是 Provider 增加 context 拓扑、以及 inspector 尚未检查 open producer。旧《GPT附件集合实证与采集兼容》方案处理 provider 文件名，不是本次菜单 GAP，不生成竞争替代方案。运输/receipt acceptance 中的单分支字符串只作为 opaque transport payload，不运行这个 exact file-input validator，因此不扩大修改。

质检：唯一质量入口为 `npm run quality:check -- CHANGE`；focused GPT attachment、Browser terminal 和既有治理反例属于普通验证，不产生第二 verdict。主要改动文件当前为 129/164/358 行，新增测试拆在已有 acceptance 的一个私有验证函数内；生产函数签名、复杂度和结构不增加，继续服从 500 行文件、75 行函数及现役 await/import 预算。

## 4. 唯一目标链、身份与有限分母

批准 upload query（以下三条通过 `, ` 组成一个字符串）：

```css
[data-mention-list-scroll-area] > div:first-child > button[data-list-navigation-item='true']:first-child,
[data-mention-list-scroll-area] > div[data-mention-section-id='chatgpt-actions'] > div[data-mention-section-items='true'] > button[data-list-navigation-item='true']:first-child,
[data-mention-list-scroll-area] > div[data-mention-section-id='chatgpt-context'] > div[data-mention-section-items='true'] > button[data-list-navigation-item='true']:first-child
```

Query 始终限定 `[data-composer-overlay-floating-ui='true']` 且要求文本含 `上传`。CSS OR 对同一节点去重；多个不同的合格上传叶必须失败，不能选第一个。不会改为多次查询或尝试性点击。

唯一链：当前 Product 批准材料 → GPT open 的 coherent 菜单后置 → GPT attach 的同合同 qualified control → Browser approved grant + 当前 Target/Document/permit + exact activation → 一次原 chooser/backend node 的批准 batch 输入 → 当前 Composer 上传活动或批准卡片直接后置 → 原 reconcile 批准卡片集合 → 原 Product submit/checkpoint/result → 原 Runtime Outbox 与 admission receipt 验真。后半段不因 selector 变化产生任何新字段、资格、状态或业务裁决，本轮不据它宣称业务完成。

Identity spine 继续是当前 job / accepted attempt / result revision / product step / call / Child / request 与 payload hash，以及 Browser current Target/Document/fence 和原 WAL identity。菜单拓扑不是身份，也不授予 replay；approvedArtifacts 的 ref、providerDisplayName、sha256、bytes 与 Browser 的原 file grant 对应关系不变，Child contractVersion 3 与 Browser 协议 9 不变。

有限分母：

| 分支 | Owner、输出与 consumer readback |
|---|---|
| 合格菜单已开 | GPT open DONE，零新物理输入；attach 独立读取当前 qualified control |
| 菜单关闭、入口唯一合格 | GPT open ACT；Browser 一次点击及满2500ms同包后置，GPT验证菜单叶唯一 |
| 三种已批准布局各自存在 | 同一 union 命中一个叶；scope/text/资格仍由原 coherent 机制过滤 |
| 同节点被两个 OR 分支命中 | CSS union 去重，只是一个候选；不扩张动作次数 |
| 缺失、多菜单、多叶、禁用/隐藏、不符文本或 Document 漂移 | 原 GPT/Browser typed failure；不新增输入或猜选，原 WAL 事实保留 |
| 空文件集 | GPT attach 只读，零 upload；现役 Product 分支不变 |
| 非空批准集 | Browser exact request、grant、chooser node 与 current identity 校验，至多一次批准 batch；GPT 消费 CONFIRMED/confirmed/physicalInputCount=1 |
| Browser 后置拒绝、chooser失败、未知已输入 | 原 typed terminal/WAL；本轮代码不重放、不伪造 success；旧工单继续原来源事实对账 |
| 卡片结算与业务结果 | 原 reconcile 精确集合及 pending消失；结果交付仍须 Runtime 取得有效 admission receipt，本轮测试或DOM计数不能代替它 |

## 5. 原子工单与施工顺序

WO-01（GPT Owner）：先同步 `open_gpt_attachment_control/selectors.ts` 和 `attach_approved_gpt_files_once/selectors.ts`；保持两个旧分支字节，追加上面 context 分支。修改 `scripts/audit/domains/gpt/gpt-attachment-contract-inspection.ts` 的批准串并把现有 exact 常量检查扩展到两个 producer，open 不要求其没有的 attachment-item 常量；保留原 stale-selector、直接后置、文件边界及 reconciliation 检查。GPT acceptance 的独立 fixture 和两 Child 调用验收必须证明同一 scope/text/union。扩展既有 `tests/governance/quality-contract.test.ts` 原生 GPT inspector 反例：分别删 open、attach、Browser 任一端 context 分支，必须得到自身 `gpt/chrome-proven-attachment-dom` finding；不建立第二 checker。同步 GPT 施工图上述一句事实，以及 GPT Manifest 对本唯一方案路径的 ownership。

WO-02（Browser Owner，依赖WO-01合同确定）：原位更新 `src/lib/browser/chrome-extension/extension-file-input-runtime.ts::assertFileInputRequest` 的一个批准 literal；不动其任何其它 predicate。同步 `scripts/acceptance/local-browser-file-input-support.ts` 独立批准 fixture；在原真实 executeExtensionFileInput 验收入口加入旧两分支串、单独 context 分支、宽泛按钮 selector、错误 scope/text 的拒绝反例，均零文件输入。保持批准完整串成功时一次 chooser click、一次 batch command、两次 coherent观察与精确backendNode绑定。两工单全完成才执行质检或允许后续生产装载，禁止半边装载。

施工前只完成本方案写入；然后退出闭环设计 Skill，重核用户授权、main/HEAD、目标 dirty state 和 source 绑定，再施工。允许修改范围精确为以上两工单路径及本方案，不碰 handler、恢复、数据库或其它 Product。局部 apply_patch 是现役 Owner 原位常量迭代，不是 whole-file根治重建任务。

## 6. 删除反事实、验收与停止

施工中直接验收关联对象补查（先补本方案再改代码）：完整 `acceptance:gpt` 表明 `src/capabilities/gpt/acceptance/gpt-exact-target-source-support.ts::assertAttachmentInspectorCounterexamples` 的 in-memory Project 未加载 open 的 `selectors.ts`。这是新增审计分母必须同步的现役夹具输入，不是生产断裂或新的规则。WO-01 允许在其现有 `files` 列表加入该现役文件，使 positive baseline 包含两个 producer；原缺失 finding、reconciliation counterexample及全部原验收断言保留。该路径补查时 Git 干净，source hash 绑定见上表，函数仍在原75行预算内；不新建文件或测试框架。

两个 Child private selector 分别有真实当前 observation/activation consumer，删除任一使对应动作不可表达；Browser exact guard 有物理输入消费者，删除会允许未批准激活；现役 inspector 缺 open 检查将漏掉本次已证实的 producer 漂移；独立 fixture 防止跨 Owner private import；唯一方案及其已有 Manifest 登记由本次明确设计要求和原生 ownership 需要。复用上述结构最短；不增加共享抽象、helper production层、动态 selector库、兼容 dispatcher、候选台账或 fallback。旧两拓扑保留在同一 query，而不是两条运行链；未证实其已退出，不能凭一个新版现场删除。

分层验收顺序：

1. 使用已有 Playwright 依赖和本地测试 Chromium，在隔离的静态 HTML document 核对三种精确布局均命中1、重复分支命中同节点时仍1、两个不同批准叶时2、非批准分组和错误层级命中0；这只是确定性 selector 回归，不访问生产网站，不引入持久测试浏览器依赖。
2. 现役 GPT attachment acceptance：观察 query 和批量 activation 均为同一批准串；保留已开零点击、唯一入口一次点击、缺失/重复/隐藏/漂移零输入、批准材料集合及 deadline 防回归。
3. Browser terminal acceptance：原真实 validator/execute 链接受批准串，拒绝 caller-authored activation；保留 chooser/interceptioncleanup、前后Document、授权集合及拒绝/未知语义。
4. 执行原生 `quality:check -- CHANGE`，包括既有项目检查与新增原生 inspector 反例；任何 finding 不冒充 PASS。
5. 人工核对实际 diff、三个已有模型改动未受影响、law/registry/协议/恢复代码零变更。质量输出只使用原生位置；构建产物只由现役生成器生成。

真实生产闭环是后续在排空原 handler、未决WAL与未ACK槽后，同窗口装载配套 AGENT/Extension，再由当前 Website grant 合法进入原工单，读回原 Child/WAL → reconcile → Product结果及相同身份的 admission receipt。当前授权不覆盖生产切换或风险重发，因此这些证据在 CHANGE 交付中明确未取得，不用静态 fixture或首页DOM冒充。

失败停止：source漂移、用户目标改动、literal任一端不等、原生质检失败均停止装载；围绕同一事实修正本次施工面。未知物理结果只读取原 WAL，不重试动作。尚未装载的本次差异可只撤销自己增加的分支与直接关联检查；不使用 reset/stash、覆盖其它改动，也不改原事故数据。若未来已装载，则必须先停止新输入并排空原命令，再在同窗口退回配套版本，不能单独退回一端。
