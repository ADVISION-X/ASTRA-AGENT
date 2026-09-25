---
name: gpt-page-operation-evidence
description: Codex 按冻结的 GPT 页面 Child 清单，在同一 Chrome QA 会话真实执行 SEO 文章三轮与五语翻译五轮，连续追加唯一 JSON 版本并立即生成独立 DOM 与代码差距报告。历史 Product attempt 仅供只读取证。
---

# GPT 页面子能力实证采集

本 Skill 的本次现场入口是同一 `LIVE_SEO_CAPTURE_SESSION` QA 会话。Codex 先用 `assets/公开知识生产资料.zip` 与 `assets/seo-source-snapshot.json` 固定的真实历史 SEO 工单，真实发送 research → article → image；再以 `assets/localization-source-manifest.json` 固定的五张历史文章翻译工单，在原 QA 对话顺序真实发送 zh-HK → zh-TW → en-US → ja-JP → ko-KR。五语源文是另一篇已接纳历史文章；这是跨文章拼接的同页连续 DOM 样本，不是同一篇文章的生产翻译业务链，不证明 Browser WAL、Website admission 或 locale release。预先冻结的 14 个 GPT 页面 Child 清单、固定安全字段和唯一版本报告仍是采集分母。

采集前读 `references/page-operation-matrix.json`、`references/collection-protocol.md`、`references/evidence-schema.md`、当前 GPT 法案、Blueprint、`src/capabilities/gpt/contract.ts`、SEO Product 现役 SKILL/源码，以及唯一报告 `docs/项目方案/GPT页面操作子能力实证资料.json`。先只读运行清单盘点：

```bash
node --import tsx .agents/skills/gpt-page-operation-evidence/scripts/report-tool.mjs inventory \
  --repo /Users/nexgen/Documents/AGENT \
  --matrix /Users/nexgen/Documents/AGENT/.agents/skills/gpt-page-operation-evidence/references/page-operation-matrix.json \
  --read-only
```

清单必须与现役 `requiredTargetKind=chatgpt` 的 Child 精确相等。每个 Child 的 required/optional/derived 状态和 `fixedCaptureFields` 在操作前冻结，未到达的格保持 `NOT_REACHED`；故障、限流状态不能由正常 SEO 流程推成已观察。固定宽字段只允许清洗后的目标 DOM、候选、关联节点、布局、状态事实、哈希输入角色和动作/后置回执；不保存整页、原 prompt、assistant 正文、Cookie、token 或原始会话 URL。

## 两种来源，严格分开

- `HISTORICAL_PRODUCT_ATTEMPT`：原 `production-source.mjs` 只读回看既有 attempt。它必须具有该 attempt 的非空真实 `actualTrace`，否则停止在浏览器之前。旧 run 和 `candidate/admit` 只代表历史 Product 证据，不能拿当前源码补旧 trace。
- `LIVE_SEO_CAPTURE_SESSION`：本次同一 QA 会话的固定页面顺序只含 SEO `produce_article` 三轮及上述五张 `localization_article_translation/article_translation` 历史任务五轮。历史工单只提供真实业务输入；Codex 的 Chrome 操作产生新的页面回执。不得把历史 job/attempt 的 trace、Provider effect、会话 URL 或终态冒充新采集证据。不得认领、重启、恢复或修改历史工单。

固定 SEO 包首次建立时，`loadSeoLiveSource` 已只读核对 Website `ai_production_jobs`、`ai_production_job_materials`、material blob/object 原字节与 AGENT `production_tasks` 和精确材料目录；ZIP 内古籍原文与索引逐书配对，文章目录和主题聚类齐全。后续 `loadPinnedSeoSource` 逐次校验固定 ZIP、来源摘要、现役路由和 Product 源码。

五语首次由 `pin-localization-sources.mjs` 只读核五张 Website/AGENT task、严格 direct parent、根 SEO admitted article、最终 claim grant 的 `result_revision/prior_result_rejection`、每张四份 `private_owner_scoped` 材料的 Website 对象原字节与 AGENT 原字节；公开摘要只存哈希/字节/角色和来源关系。20 份原件、task/route/parent/resultRevision 和按现役 `gptAttachmentProviderDisplayName` 命名的上传副本仅存本机 `assets/private-localization/`，由 `assets/.gitignore` 排除 Git，目录 0700、文件 0600。每次 `loadPinnedLocalizationTurn` 核现役源码、摘要、原件、上传副本；缺件或漂移停在发送前，不每轮重新搜索数据库。不要提交私有目录。

## 真实 Chrome 流程

用户明确要求执行实际采集时，先读 `chrome:control-chrome` Skill，并按其规定在 Node REPL 连接 Chrome、完整读取浏览器文档。只新建或绑定本次专用 QA 标签页，绝不接管生产 system Target 或其它用户标签页。Chrome 的受限执行环境没有 `process`，也禁止 `new Function`；在终端用 Node 24 和现役源码把 `seo-live-turns.mjs` 编译成仓库外静态模块，并运行 `build-chrome-collector.mjs --output /tmp/.../chrome-collector.mjs`，将生产 canonical reader 静态嵌入采集器；然后在浏览器会话内导入这两个模块。终端只准备代码和读取固定来源，Chrome 页面动作只能通过该 Skill 的 Chrome 插件完成，不能改用终端 Playwright/CDP。

1. `loadPinnedSeoSource(...)` 从 Skill 固定资料读取并核验 `publicSource` 摘要、ZIP 原字节、路由、Product 源码和矩阵。`createSeoLiveTurns(source)` 在内存生成 research exact prompt；不得手写或提前预填后续 prompt。使用现役 profile/model/reasoning/附件规则，新对话上传整包，逐 Child 采 pre scene、真实动作回执和全新 post scene。
2. 发送前核 exact prompt bytes/hash、模型、推理和附件的页面哈希。每个 submit 只能物理发送一次；命令返回未知时按同一身份全新 readback，禁止盲发第二次。每条调用的 `observedCallId` 从本次首个真实 scene 的 ID、签名和时间导出，重复 Child 不能共享 scene。
3. 文本回答使用 `chrome-scene-collector.mjs` 的 `collect(sceneId, { exactAssistantPromptHash })`。它对同一个唯一相邻 assistant turn 使用生产 `BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE`，核旧投影字节漂移、prompt/turn/Document/revision/hash，只在当前调用的内存返回 `exactAssistant.semanticText`；scene 落盘仍是 hash-only。漂移、多义、stale 或原文落盘风险立即停在下一次发送前。
4. 把该内存对象和对应 scene 交 `createSeoLiveTurns(source).acceptTextTurn(...)`，由现役 `parsePublicKnowledgeResearch/Article` 解析。research 合法 `decline` 终止为部分覆盖；只有真实 `proceed` 才由现役 `articlePrompt` 生成第二次 exact 输入；文章解析成功后才由现役 `imagePrompt` 生成第三次。图片 scene 须用 `includeMedia:true` 采真实媒体，并将同 turn 的 media hash/assistant turn 身份交 `acceptImageTurn(...)`。不得伪造生产 checkpoint、artifactRef、evidenceRef 或 Website 成功。
5. SEO 图片完成后不结束本轮；继续下面五语，逐轮采集前/动作/后及唯一回复。对实际到达的 Child/状态写观察；未到达写 `NOT_REACHED`，已调用但缺前后回执写 `CAPTURE_GAP`，候选/后置冲突写 `CONFLICT`。旧 SEO 三轮证据已有真实 gap，五语新增不能逆向补造；即使八次均真实发送，本轮仍可为 `CAPTURE_PARTIAL`。

### 五语在同一 QA 对话继续

1. 顺序固定 `zh-HK → zh-TW → en-US → ja-JP → ko-KR`，五张历史任务和四件套只从 Skill 本机固定源读取。运行前核 `assets/localization-source-manifest.json` 五项顺序、根 article/version/hash、每项 jobIdHash/parentResultHash、四件 bytes/hash、`sourceCodeHashes` 与当前文件；绝不把 SEO QA 新文章结果写作五语源文。
2. 用 `localization-live-turns.mjs` 的 `prepareLocalizationTurn` 在封闭内存 context 运行现役 `executeOwnedFlow`：前置 profile/附件调用只给纯内存 stub，在 `write_exact_gpt_prompt` 截取 exact prompt 后用 sentinel 停止；probe 无 Provider、Chrome 或 Website 副作用，其 stub 不得写成实际 Child 证据。输入须为历史 task、route、resultRevision、现役 Product SKILL 原文和本语四件原字节；`promptHash/markerHash` 在本语发送前冻结。任何代码、source、prompt 漂移停发。
3. 每语单独新建 `createChromeSceneCollector`，`productMarker` 设该语 exact marker；`runId/captureEpoch/qaTabIdentityHash` 及 QA 标签页保持原值。其 `sourceInputHash` 是旧 SEO run 的兼容绑定，不能解释为五语材料身份；五语另在 stage receipt/source segment 绑定本语 job/material/source 哈希。每语不 clean-chat，先核页面仍在 research 首次发送后冻结的同一 canonical URL，再核上轮 user/assistant 仍可读、模型“最新”和推理“极高”。
4. 四件原字节必须使用 `provider-upload/` 下现役显示名的副本上传，待四张卡无上传中/错误状态；ChatGPT 给重名文件自动追加 `(n)` 时按现役附件归一规则核。提示词必须在发送前与撰写器完整 bytes/hash 全等；按钮物理发送只一次。unknown effect 仅按同 prompt/turn 读回，禁止重复发送。
5. 当前语回复必须在同一 Document 的 exact user turn 后唯一相邻，production canonical semantic reader 只向内存返回文本；由 `productResultValidation.parseJsonObject` 与 `parseProductResult` 核 schema、locked identity、payload，再留 hash-only receipt。解析失败或 turn/URL 漂移即停在下一语前。该解析不等于 Website 的 field policy、admission 或 release。

八轮正常路径的生产 Child 流程分母是 SEO 28 次加五语各 11 次，共 83 次。此数是清单，不是现场已证实次数。证据版必须逐 call 记录实际 pre/command/post，缺项保持 gap；只有八条真 stage receipt、同一 canonical URL 和零计划内 gap 才能记 `CAPTURE_COMPLETE`。旧 SEO 三轮版与比较版只追加新版本，不回写、不重判。

`chrome-scene-collector.mjs` 的同一 QA run 参数 `recaptureTrigger={kind:"LIVE_SEO_CAPTURE_SESSION",sourceInputHash:<stable SEO publicSource digest>}`。它只绑定本次 QA run 的既有 scene，五语真实材料身份另由每个 locale source segment/receipt 绑定，不能把此 SEO digest 冒充五语输入。输出 scene、mapping 与八轮 hash-only stage receipts 均放仓库外临时目录；原文只在当前浏览器内存传递。每个实际 call 的 mapping 带本阶段 `promptHash/turnMarkerHash/source segment`；完整链分母为 83 次 Child。中途失败保留已观察 scene 与 0～7 个完整阶段回执，写明 `terminalBranch/terminalReceipt`；未知效应只读回，不重发。

## 装配、连续版本和立即对照

`assemble-live-capture.mjs` 的 `--seo-source` 分支即时重读 Skill 固定资料包，核同一来源公共摘要、同 run scenes、实际 call/state mapping 和 stage receipts；逐 Child/状态用既有 `makeLiveSpecimen` 装配完整固定字段，不从旧 Product trace 推断。`--production-source` 分支仅服务历史 Product attempt。使用 `--pinned-source` 时不连接数据库；需要重建固定资料时才走 `loadSeoLiveSource` 的 Website 实时核验。本次八轮装配同时传入固定五语公开来源摘要；旧三轮修订不传此项。装配命令：

```bash
node --import tsx .agents/skills/gpt-page-operation-evidence/scripts/assemble-live-capture.mjs \
  --repo /Users/nexgen/Documents/AGENT \
  --matrix /Users/nexgen/Documents/AGENT/.agents/skills/gpt-page-operation-evidence/references/page-operation-matrix.json \
  --scenes /absolute/outside-repo/scenes.json \
  --mapping /absolute/outside-repo/seo-scene-map.json \
  --seo-source /absolute/outside-repo/seo-public-source.json \
  --localization-source /Users/nexgen/Documents/AGENT/.agents/skills/gpt-page-operation-evidence/assets/localization-source-manifest.json \
  --pinned-source /Users/nexgen/Documents/AGENT/.agents/skills/gpt-page-operation-evidence/assets \
  --browser-meta /absolute/outside-repo/browser-meta.json \
  --stage-receipts /absolute/outside-repo/seo-stage-receipts.json \
  --output /absolute/outside-repo/seo-revision.json
```

唯一 JSON 报告是 v8。一次受检 v7→v8 转换保留原 `products[].runs[]` 和逐 run 摘要；新的共享 SEO 样本只追加在 `seoCaptureRevisions[]`，不复制到任何 Product 切片、不改变其它路由的 `captureStatus`。同 `captureRunId + evidenceRevisionId` 相同内容重试 no-op，冲突拒绝；补正仅追加 `supersedesRevisionId + correctionReason`，旧版永不改写。追加在唯一文件独占锁内重读、校验、原子写入和 readback；两并发追加不得丢版。

```bash
node --import tsx .agents/skills/gpt-page-operation-evidence/scripts/report-tool.mjs append-seo \
  --repo /Users/nexgen/Documents/AGENT \
  --matrix /Users/nexgen/Documents/AGENT/.agents/skills/gpt-page-operation-evidence/references/page-operation-matrix.json \
  --revision /absolute/outside-repo/seo-revision.json \
  --pinned-source /Users/nexgen/Documents/AGENT/.agents/skills/gpt-page-operation-evidence/assets \
  --report /Users/nexgen/Documents/AGENT/docs/项目方案/GPT页面操作子能力实证资料.json \
  --comparison /Users/nexgen/Documents/AGENT/docs/项目方案/GPT页面DOM与代码差距报告.md
```

同一命令在证据版落盘后立即按该版及实际读取的相关代码文件 digest 生成独立派生差距版，并 readback comparisonId。每个计划字段逐项列 `MATCH/DRIFT/UNOBSERVED/CODE_ONLY/REVIEW_REQUIRED`、scene/call 身份、源码路径/行/hash。多义或无可机械比较合同就标 `REVIEW_REQUIRED`，不能写假一致；报告不复制原 DOM 事实。比较失败时已追加的证据版不回滚，交付状态是未闭合；用同 key 重试只补比较，不重发 Provider。

历史 Product 的 `candidate/admit` 继续只在 `products[].runs[]` 上工作。共享 Child 查询用 `report-tool.mjs seo-cell --capture-run <id> --revision <id> --child <id> [--state <id>]`，并传入上述 `--repo/--matrix/--report`；结果只陈述同一 QA 会话中的共享 Child 页面观察与缺口，并逐 call 标明 SEO 或具体语种及其来源哈希，不推断其它 Product。离线 refresh 不开 Chrome，不增加 SEO capture revision；代码变了可以产生新的比较版，旧比较版不改。

## 验证和边界

运行 `skill-creator` 的 `quick_validate.py`、本目录现有三项 acceptance 及 SEO 版本/对照反例。仓库原生质量入口只有 `npm run quality:check`；静态通过不等于真实 Chrome、Provider 或 Website 业务完成。用户已明确授权本轮 SEO 三次及五语五次真实发送；其它任务的真实发送须另有对应授权。

## 2026-09-25 现场实测记录

- 已核实历史 SEO job `aiprod_61ef0b6f-86fd-47a6-be38-869d02921757` 的 Website DB、material blob/object、AGENT task 与本地 ZIP 原字节全等。固定包为 2,500,640 字节，SHA-256 为 `1fb581c0c09fe7ff83e94b98a4c5a49fc6f0c7dff216651caea137feece5772a`；这是一轮首次核验，不代表未来每轮数据库实时读回。
- 当前 Chrome 页的撰写器为 `[data-composer-markdown][contenteditable="true"]`，旧 `#prompt-textarea` 不存在；采集器已扩充观察范围，生产 Child 选择器是否命中须在差距报告明确判定。
- 模型菜单实际显示“最新”已选、强度“极高，第 4 项，共 4 项”；滑块 DOM 为 `aria-valuenow=3`、`aria-valuemax=3`。现役 Product 请求值 4，由 Child 代码钳制到最大值 3；不能把显示序数 4 误判为 DOM 数值 4。
- Chrome 插件的只读脚本接口不执行字符串回调；浏览器会话也禁止 `new Function`。必须运行 `build-chrome-collector.mjs` 静态嵌入生产 canonical reader，再导入生成的仓库外模块。已取得新模型菜单 scene，撰写器计数为 1。
- 下一次开跑前先确认本次任务实际暴露 `chrome:control-chrome` Skill、Chrome 插件和可连接的 Node REPL。2026-09-25 后续核对时，可用 Skill 列表未列出 `chrome:control-chrome`；这只说明当时入口未暴露，不推断插件已卸载。若仍缺失，停在真实页面动作之前，不能用别的浏览器工具冒充本流程。
- 首次附件上传在 `fileChooser.setFiles` 返回 `Not allowed`；用户开启 Chrome 插件的“Allow access to file URLs”后，原 ZIP 的字节同一副本已成功上传。页面把重名附件显示为 `公开知识生产资料-68b55e7c0290(1).zip`；只按现役后缀归一规则核对文件、字节哈希和上传终态，不要求 UI 显示无后缀原名。
- research 提示词经撰写器 exact hash 核对后只发送一次；相邻 assistant 的生产语义读取与旧投影无漂移，绑定同一 prompt/turn/document，现役研究解析返回 `proceed`。文章提示词由该真实研究结果生成。
- 当前页面对一次性粘贴约 10 KB 的文章提示词会自动生成 `粘贴的文本.txt` 附件，导致撰写器为空；必须先移除自动附件。已验证先 `fill` 前 5,000 字节，再以 `cua.type` 分段键入余文、按真实换行使用 `Shift+Enter`，最终撰写器哈希与现役完整文章 prompt 全等。直接逐字键入含 `**` 的前段会触发编辑器 Markdown 自动格式化、丢失星号；每次发送前必须以最终 exact hash 为准，失败绝不发送。
- 当前 ChatGPT 对话轮次使用 `[data-chatgpt-search-unit-key]`，旧 `conversation-turn-*` 与 `data-message-author-role` 不存在；collector 只用页面实际单元建立 prompt 与相邻 assistant 绑定，并仅向内存返回语义正文。采集 scene 继续只保存哈希与清洗 DOM；生产选择器原样留在差距报告对照。
- 图片回复另走 `[data-content-search-turn-key]` 容器，未生成普通 assistant unit；只在图片 `img[alt]` 完整、自然尺寸大于零、与此前用户 prompt 同 turn 相邻时绑定。实测图片为 1672×941；图片生成中一次全树 `Runtime.evaluate` 超过 Chrome 2.52 秒上限，未形成 scene，之后缩小非目标重复子树采样并在完成态重新读回。超时不能写成已观察的生成中格。
- 同页长会话中，对全部历史 assistant 重跑 canonical semantic reader 会超出 Chrome 单次 `Runtime.evaluate` 时限。采集器现在只解析本轮 marker 绑定的 assistant 正文，旧轮只保留 user/assistant turn ID 与哈希用于连续性核验；老轮的空 responseHash 不能解释为老回复为空。模型生成时可能出现同 prompt 的空 assistant 容器；`exactAssistant` 只接纳唯一非空回复，必须等“停止”按钮消失后采终态。
- Chrome 附件上传须先等待可见“添加照片和文件”按钮触发 `filechooser`，然后给 chooser 传 `provider-upload/` 的本机绝对路径；隐藏 `input[type=file]` 不能靠强制点击。四张卡必须无 progressbar。文件重名时 ChatGPT 可能在现役显示名后增加 `(n)`，核对需使用现役归一规则。禁止输出整页 `domSnapshot` 或原文提示词/回复到工具日志；只读取过滤后的短状态行和哈希。
- 本轮三次发送均各一次，三阶段独立回执有效；已把 15 个实际映射调用、25 个被使用的 scene 装配并追加到唯一 v8 JSON，`evidenceRevisionId=sha256:e50b7b100a751f5029a7922149dad7ff48c6da8a52287146db5c6d6070d696e1`。固定流程有 28 次必经 Child 调用，当前证据为 `CAPTURE_PARTIAL`、64 个 flow gap；不能宣称清单覆盖完成或任何 Product/Website 业务成功。未到达的限流/错误格保持 `NOT_REACHED`，已调用但前后回执或旧状态断言缺失的格如实记 `CAPTURE_GAP/CONFLICT`。
- 差距报告首次比较版误把 `composer-before` 尚未输入阶段 prompt 判为 `DRIFT`。比较器已纠正为只在 after/submit/checkpoint 阶段判断 prompt 出现，并在同一证据版下追加新的 comparison revision；旧比较版保留但不可作为当前结论。现役代码的 composer selector 已使用 `form[data-chatgpt-composer] [data-composer-markdown][role='textbox']`；固定矩阵仍有 `#prompt-textarea` 的旧状态断言，需作为本轮矩阵/DOM 冲突公开记录，不能把它概括为现役代码 selector 错误。
- 五语逐项真实上传四份现役显示名资料、核附件终态和 exact prompt hash 后，各只发送一次；每项都在同一 canonical conversation URL hash 下得到唯一相邻 assistant 回复，并由现役 Product 解析通过。五张工单的历史 parent/source/material 事实已固定在公开 hash-only manifest 与本机私有原件中。本次只是另一篇历史文章接到 SEO QA 会话后的跨文章页面连续样本，不是 Website 的同篇业务 parent 链。
- 长会话中 ChatGPT 会虚拟化较早的轮次。最终 ko-KR 页已不能同时读到全部八个 user turn，不能要求“终页八轮齐现”作为连续性门；应在每一下一阶段的最早 pre scene，核上一阶段唯一 user prompt/marker、相邻 assistant turn/marker 以及它是最后可见 user，另核 URL 与发送后场景顺序。页面对旧 assistant 的语义正文不重复读取；旧 `responseHash` 空串在 v11/v12 是未投影哨兵，不能当真实空回复，v13 改用 `null` 并把采样范围写入签名 pageFacts。八轮证据版对各旧 scene 另写保守的采样范围事后注记；它不是原 scene 签名内事实，不能升级为全 Document 证明。
- 旧 SEO checkpoint 在纠正读回 scene 后曾被错误算成新 `observedCallId`。八轮追加版以原物理调用的首 scene 为 identity origin，回查旧证据版相同 step/Child/prompt/marker、scene 签名与时间；纠正后的读回只增加观察，不增加 Provider 调用。代码比较器对旧 user-turn selector 在清洗采样内找不到候选时只能 `REVIEW_REQUIRED`，因为没有 full Document 基数；不能由采样 0 宣称真实生产 selector 0。
- 八轮新版本 `evidenceRevisionId=sha256:754ae2ee3e00edabdf4ef9046edd379c0fa293431ee8950cd88d1aab043b384f`、即时比较版 `comparisonId=sha256:d5f854a93d8577ce3c17ec7870254200baf8cd546f20ce20ce1eae32502ef883`，旧版原样保留。八条阶段回执均有真实回复/图片与解析；83 次计划 Child 中仅 35 次有独立场景映射，131 条 flow gap，整体必须继续标 `CAPTURE_PARTIAL`。比较报告分别列 DOM 状态缺口和计划调用缺口；`0 DRIFT` 不等于无差距。

报告不绑定 HEAD、branch 或 clean 工作区。所有旧 Product 运行记录、生产代码、Website 代码、法案和 Blueprint 均保持其原 Owner；本 Skill 不增加生产 hook、第二 Product runner、DOM DB、后台 Worker、重试服务或第二质量裁决。
