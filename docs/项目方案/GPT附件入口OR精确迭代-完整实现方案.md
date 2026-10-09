# GPT 附件入口 OR 精确迭代完整实现方案

方案状态：已建设，待联合质检。交付等级：READY。用户已明确批准“按 OR 方案施工”，授权第6节两个工单及直接关联审计、验收和 GPT 施工图；随后明确要求“dom改动你合并一起提交-ready”，现与AGENT停止接单收尾差异组成同一个main提交，按原生CHANGE→READY执行并在READY通过后推送。原先第4、7节的“不提交/不进入READY”是本次追加授权之前的边界，现由此明确授权替换；没有授权生产文件上传、GPT submit、扩展reload或工单重发，不改变任何冻结法案语义。

## 1. 当前需求与第一直接断裂

用户要求实证当前附件上传 DOM 并迭代对应子能力，追加要求论证 OR 或替代模式，避免页面回到旧结构后再次失效。需求 Owner 为 AGENT `gpt`，唯一参与仓库为 `/Users/nexgen/Documents/AGENT`。

2026-10-10 01:19:58（Asia/Dubai；UTC 2026-10-09T21:19:58.963Z），在用户 Chrome 当前 ChatGPT 首页，通过同一次只读 DOM 求值取得：composer=1、active overlay=1、现役“附加文件”input=1。上传按钮位于 `chatgpt-primary` 分组，显示“添加照片和文件／从计算机上传”，BUTTON、connected、visible、enabled，布局 741×36。

原三分支查询 raw=1，唯一命中的是 `chatgpt-context` 下“在项目中工作／在项目中开始聊天”，文本不含“上传”；上传文案候选=0。追加 `chatgpt-primary` 后 raw=2，其中上传文案候选恰好1，另一项仍被原 TEXT_MISMATCH 排除。该现场证明的是菜单拓扑及选择器遗漏，不是附件卡片、文件内容或 Provider submit 的故障。

第一直接断裂位于 `open_gpt_attachment_control/observation.ts` 的 `upload-choice`：当前 selector 未覆盖 primary，导致 `attachmentControlReady` 不成立；菜单已开时会走 HARD_FAIL，点击打开菜单时同包直接后置不能成立。`attach_approved_gpt_files_once/control-observation.ts` 也消费同一旧表达式。只改 GPT 时，Browser `assertFileInputRequest` 还会因 selector 字符串不等返回 `BROWSER_FILE_GRANT_INVALID`，因此三端同步不可分割。

本轮仅打开并关闭菜单，没有触发文件选择器、上传文件、写提示词或提交 GPT。仓库外临时现场证据：`/tmp/agent-attachment-dom/dom-observation.json`、`/tmp/agent-attachment-dom/upload-menu.png`，不进入 Runtime/WAL/日志，也不作为生产 Child proof。浏览器策略拒绝本地 file URL，因此未执行隔离 HTML 的浏览器矩阵；不能把其文件存在视为验收完成。

## 2. OR 与替代的裁决

选择 OR：原三种已实证布局保持字节不变，追加一个严格的 primary 分支，组成唯一 CSS union。它是同一个 bounded query，不是依次尝试四个入口，不新增运行分支、点击重试、fallback、Owner 或兼容 dispatcher。

选择替代会删除原三种入口表达式；Provider 回退至任何旧布局时，即使真实上传按钮存在也无法被现役查询选中。当前只实证了本账号此刻的页面，未取得旧布局全局退役、其它账号一致迁移或不会回滚的证据；不存在删除旧分支的事实依据。

保留 OR 的安全性来自原合同：唯一合格 menu scope、文本包含“上传”、唯一 eligible candidate、完整机械可操作性、same-call/current Target/Document、至多一次输入及直接后置。两个不同上传项同时合格时失败关闭，不能选择第一项。同一按钮由多个 CSS 分支命中时由 union 去重。当前 context 已变成非上传项，原 TEXT_MISMATCH 足以排除，不需要删除 context 或放宽 ready predicate。

这能覆盖已知四种布局之间的来回切换；未知新布局仍须失败关闭并重新实证，不承诺覆盖任意未来 DOM。替代只在旧结构已证实退出且继续保留会产生可复现错误时重新裁决，本轮不成立。

## 3. 当前权威、实现与前轮连续性

依冻结母本 §4、§19、§21—23、§35—38、§41—42、§44、§46—48、§74；基础法案 LAW-CODE-PURITY-001-V6／002-V2／003-V3；功能法案 LAW-GPT-001-V64／002-V31、LAW-LOCAL-BROWSER-SESSION-004-V56／006-V45。registry 当前定位这些 active law，实际义务仍从两份法案读取。GPT 施工图 V69 附件段（第113行）记录三种 OR、三端同串与独立 fixture；Browser 施工图 V56 保持唯一物理输入、lane/WAL 和 fresh readback。Child contractVersion=3、Browser 协议9均无需改变。

生产链：Product 批准文件 → GPT open coherent 菜单直接后置 → GPT attach coherent control 与批准 artifact 集 → Browser 原 file grant／exact activation／chooser backend node → 一次 batch → 原上传后置 → GPT reconcile。付款截图 `src/plugins/payment-screenshot-observation/flow.ts` 和固定 catalog `src/plugins/localization-production/static-catalog-flow.ts` 均使用现役附件链；它们的 Prompt、模型、专业 Skill 与结果解析不进入施工面。后续 submit、原结果与 Runtime admission 主链继续原样消费，本轮终点仅是菜单合同与批准上传 handoff 的正确识别，不宣称 Website 业务完成。

有限历史筛查命中此前相关迭代：`cdcc899fe` 处理 GPT OR 与 Browser 单分支不同步；`b1f6655ec` 已落地第三个 context 分支、三端 AST 检查和独立 fixture；`148426e49` 处理 JSON BUTTON／图片 DIV 卡片共同识别。当前代码仍保留这些不变量；本轮新偏离仅是 Provider 新增 primary 分组。既有《GPT附件集合实证与采集兼容》《GPT图片附件首次识别替换》分别处理文件名和卡片，不重复建设，也不修改其语义。

两个 Child 的 `attachmentControlReady` 已允许 raw>=1、eligible=1，且其它拒绝原因只能是 TEXT_MISMATCH，所以当前 raw=2 的新版结构可直接复用原逻辑。现役 inspector 已覆盖两个 producer 和 Browser guard；in-memory source acceptance 已包含 open selectors，无需再改其文件清单或另建 checker。

## 4. 写前绑定与保护

realpath 为 `/Users/nexgen/Documents/AGENT`，本地 `main`，tracking `origin/main`。当前 Git HEAD 只在执行上下文作为比较基准，不写入本文件，不建立第二 candidate artifact。本轮设计前下列目标均干净；初始已有用户 overlay 为 `docs/项目方案/AGENT停止接单与在途工单完整收尾-完整实现方案.md`（untracked），保持不动、不提交。设计期间另一会话继续修改停止链的 Browser／Runtime／Startup 文件和施工图，均不属于本轮改动；当前目标菜单文件仍干净，新增停止链描述不改变本轮菜单合同。原生检查出现全仓候选漂移时不复用该轮 verdict。

| 相关来源 | 设计时 SHA-256 |
|---|---|
| `AGENTS.md` | `861569b40c535f2180511885df05d53ec893e4e746475c16e182a395bbd7e91e` |
| `docs/governance/法案系统建设说明书-冻结定稿版.md` | `27a143ecd7016887d056255e106f49caa29d83d06245ff21ea5c0ffd62b98c3a` |
| `.github/instructions/agent-rules/基础法案.md` | `f1970c2416127f8bcdf560d0fd81105895924c4ed2cdd23f6a08ae910998d2f3` |
| `.github/instructions/agent-rules/功能法案.md` | `401925ea9abfa880875ed3a2b8f1c551471c2659ae5a10411ed62f236b4560b1` |
| `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md` | `813f820f3c0f7195d6d18e68d561ba1490dc22d93f4580ac89b89a3e93244feb` |
| `src/capabilities/gpt/children/open_gpt_attachment_control/selectors.ts` | `38faaced6651941c11ca160b7c8a2e282fc5db9e4610c6f67e69ee077696c70c` |
| `src/capabilities/gpt/children/attach_approved_gpt_files_once/selectors.ts` | `071a252e14bb8719234f182dfa23ac8ba9299ea76fbae3cb7a1280348191f7bf` |
| `src/lib/browser/chrome-extension/extension-file-input-runtime.ts` | `5dbbda1d50aa3babc814853fb3294e06692b49d40532fd3d157abbb248681c74` |
| `scripts/audit/domains/gpt/gpt-attachment-contract-inspection.ts` | `a5ab5629a52cafb517285af47eed9fe8ce70b7a0a5fe026e66578a9b6303ce84` |
| `src/capabilities/gpt/acceptance/gpt-page-fixture-selectors.ts` | `57d9e05b5744688fbd70daff3618e50f6c84d96ffb7f7f3e66c035d2d240cec4` |
| `src/capabilities/gpt/acceptance/gpt-attachment.acceptance.ts` | `f954c0d8b168e0bd5e5adf9ef7c1191e68cbf85fe5de1e7738bac837e214e3ea` |
| `scripts/acceptance/local-browser-file-input-support.ts` | `cb27776971a608e77f8b8b67552df1455cf51892f5a25ab4f6cbb393820f6472` |
| `tests/governance/quality-contract.test.ts` | `3ae179339aaa6ff94e5019cddcfc70e0e66fc608d677b18deb2755cea4049197` |

写入前必须重新核本地 main、HEAD、目标 Git 状态及以上来源。相关 source 漂移只重算受影响部分；目标用户改动或授权不能安全区分时停止对应写入。方案 hash 独立在执行上下文计算，不成为生产真相。

## 5. 唯一目标合同与 handoff

四条 selector 以原 `, ` 连接为一个精确字符串；新分支如下：

```css
[data-mention-list-scroll-area] > div[data-mention-section-id='chatgpt-primary'] > div[data-mention-section-items='true'] > button[data-list-navigation-item='true']:first-child
```

GPT open `upload-choice.selector`、GPT attach `upload-choice.selector` 和 `activation.selector`、Browser `assertFileInputRequest` 的批准 literal 必须精确相同。scope 继续 `[data-composer-overlay-floating-ui='true']`，textContains／expectedText 继续“上传”，文件 input 继续 `form[data-chatgpt-composer] input[type='file'][aria-label='附加文件']`。不新增字段，不改 optional/null/default、artifact ref/providerDisplayName/sha256/bytes、grant、schema、hash 或 error policy。

Identity spine 仍为原 job／attempt／result revision／step／call／Child／request/payload hash，当前 Target/Document/fence 与原 WAL identity。拓扑切换不授予重放；旧已输入、未决 WAL 和旧结果仍按原 Owner 收敛。

| 有限分支 | 唯一 Owner、输出与 readback |
|---|---|
| 已开且上传项唯一 | GPT open DONE，零新点击；attach 重新读取自己的 coherent control |
| 菜单关闭且 trigger 合格 | 原 open 一次点击、Browser 2500ms 后同包后置，GPT 核唯一合格上传项 |
| 旧三布局或新 primary 各自存在 | 单 query 取得唯一合格项，原 Child typed success |
| 新 primary 与 context 非上传项共存 | raw=2、eligible=1、另一项 TEXT_MISMATCH；open／attach 都可读回 |
| 两个合格上传项、多 scope、隐藏/禁用、错文字、错误层级、身份漂移 | 原 typed fail closed、零新的文件输入；不试另一个节点 |
| 空批准集合 | attach 原只读分支，零 upload |
| 非空批准集合 | 原 Browser exact guard／grant／chooser／once batch；原 typed terminal，GPT 核 physicalInputCount=1 |
| 结果未知、失败或取消 | 保留原 WAL／事实；现役 Owner 处理，代码迭代不清工单、不重发 |
| 上传后卡片 | 原 reconcile 名称、基数、spinner/pending 与 Product deadline，不新增发送资格 |

## 6. 原子工单、允许路径与顺序

用户已在本方案完成并可复查后，明确回复“批准按 OR 方案施工”；以下非 Skill 对象已经取得 `agent-flow-boundary-gatekeeper` §2 所需的精确例外授权，不再重复请示。

WO-01（GPT，菜单识别合同）：原位更新两个 selectors 文件的批准 literal 与“三种”注释；原三分支字节保留，追加 primary。同步现役 inspector 的 expectedSelectors 和独立 fixture literal。允许路径：

- `src/capabilities/gpt/children/open_gpt_attachment_control/selectors.ts`
- `src/capabilities/gpt/children/attach_approved_gpt_files_once/selectors.ts`
- `scripts/audit/domains/gpt/gpt-attachment-contract-inspection.ts`
- `src/capabilities/gpt/acceptance/gpt-page-fixture-selectors.ts`
- `src/capabilities/gpt/acceptance/gpt-attachment.acceptance.ts`
- `tests/governance/quality-contract.test.ts`
- `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md`（只把附件段三种布局事实同步为四种；machine block 与冻结规则不变）

在原 `verifyMenu` 的已开分支增加现场 raw=2、eligible=1、TEXT_MISMATCH 反例过滤的成功验收，物理点击=0；在原 `verifyBatch` 保留单候选正例并加入相同 mixed control facts，每种批准上传 batch 仍恰好一次。原治理三端删分支反例覆盖全部四条分支，原 context 反例继续保留；分别从 open、attach、Browser literal 删除任一批准分支必须得到该路径的 `gpt/chrome-proven-attachment-dom` finding。保留原所有基数、隐藏/漂移、空集合与卡片验收。

WO-02（Browser，依赖 WO-01 的同串合同）：只更新 `src/lib/browser/chrome-extension/extension-file-input-runtime.ts::assertFileInputRequest` 的一个批准 literal；同步 `scripts/acceptance/local-browser-file-input-support.ts` 的独立 activation fixture 与 `exerciseActivationContract`。新增拒绝原三分支完整串、单独 primary 串的反例，均在 file input 前失败；原两分支、单独 context、宽泛按钮、错误 scope/text 拒绝继续保留。完整四分支通过真实 validator/execute 验收时一次 chooser click、一次批准 batch、原 backend node 绑定与两次 observation 不变。

两工单同步完成后才运行本仓原生 CHANGE 质检，禁止半边生产装载。生产文件均仅常量迭代：Extension 350行、inspector 191行；现有 GPT acceptance 144行、Browser support 413行，新增断言留在原预算内函数，不新增文件/共享层。法案、registry、Manifest、contract.ts、handler／observation、Browser lane/WAL、Runtime、其它 Product 均不改。

## 7. 删除反事实、验收与停止

原三分支仍有历史已实证 Provider 布局这一真实输入消费者；删去后旧布局回归会在菜单 handoff 漏掉上传项。两个 Child 私有 literal 各有真实 observation/activation 消费，Browser literal 是既有 typed request 消费方安全边界，删除任何端都会丢合同或放行未批准动作。原 inspector 与独立 fixture 防止三端漂移、跨 Owner 私有 import 和旧布局回归。复用这些结构即可完成需求，不新增 selector registry、共享 helper、兼容 bridge、第二上传链、状态、存储、timer、依赖或恢复机制。旧三分支字符串作为整串不再是可接受 Browser request；其结构仍合法保留在唯一四分支 query 中。

分层验收：先核 exact string 三端和两个独立 fixture 相等，再运行现役 GPT attachment acceptance、Browser terminal acceptance 和治理三端反例；保留旧结构分支未删除的断言，以及新版 mixed candidate 的 Child 正例与 duplicate eligible 的零输入反例。旧菜单回滚覆盖依赖原三分支仍在批准 union，不把旧现场或合成 packet 说成当前生产动态证明。随后执行唯一 `npm run quality:check -- CHANGE`，人工核完整实际 diff 与用户 overlay；任何 finding 不宣称通过。

当前真实 DOM 已证明原表达式漏掉 primary；没有真实文件上传、Child／WAL 生产收据或 Website admission 结果。未来真实上传实证必须另行明确批准具体测试文件和 ChatGPT 目标；扩展 reload／AGENT 重启先排空原 handler、未决 WAL 与未ACK槽，配套装载并读回原 Child → 原一次 batch/WAL → 同集合 reconcile。此生产切换与上传、GPT submit、工单重发、commit/push、READY／RELEASE均不在当前 CHANGE 范围。

失败停止：source/文档漂移、用户目标改动、例外授权缺失、三端不等或原生检查失败时停止对应施工/装载。未知输入仅读原 WAL，不重试。未装载时只撤销本轮新增 primary 与直接关联断言，不动原三分支和其它用户改动；已装载时沿原配套 drain/切换要求处理，不允许只退回一端。收益预期是关闭本次 primary 菜单识别缺口并保留已知旧布局；已实证收益仅为当前 DOM 查询从0个上传文案候选变为1个，尚未证明真实上传成功。
