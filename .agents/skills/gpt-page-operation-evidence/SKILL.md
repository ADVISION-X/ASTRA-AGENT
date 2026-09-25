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

新 run 创建每轮 collector 时传 `authorizedModelDisplayName=source.publicSource.executionProfile.startModelDisplayName`，让完整 Document 的模型候选计数绑定本次授权模型。SEO research 的附件预期名只能从固定 task 的 material ref 用现役 `gptAttachmentProviderDisplayName` 生成；五语各从 `prepareLocalizationTurn(...).uploaded[].providerDisplayName` 生成。附件落卡、上传终态和**每轮发送前** scene 的 `collect(...,{expectedAttachmentNames})` 内存参数传本轮预期名；article/image 发送前传空数组 `[]`，核零附件。采集器按现役附件归一规则只落 hash/count，不落原名。不得拿当前页面已有文件名反填成预期集合。模型选择的 `transitionReceipt.clickedCandidateAttributeReadback` 只能从本次 Chrome 真实点击命令的候选属性读回填入；若 Chrome 接口不给此读回，留状态缺口，不能手填 `verified:true`。每次点击仍只物理执行一次。

非空附件上传前，用 pin loader 返回的 `upload_path`（SEO 用已校验 ZIP 路径）组成**同一个不可变上传命令参数对象**，先按原字节复核每件 SHA-256/bytes 与固定来源，再把该对象的文件路径数组原样交给本次 Chrome chooser。上传 post scene 的 `transitionReceipt.uploadedArtifactProof` 仅从这一实际命令参数对象投影为 `{source:"SIGNED_COMMAND_ARGUMENTS",items:[{providerDisplayNameHash,sha256,bytes}]}`，按 `providerDisplayNameHash` 排序；公共 scene 不保存本机路径。不得从上传后卡片名称逆推文件字节，也不得拿另一份路径列表填回执。命令参数无法回读或不能证明与本次 chooser 调用相同则不填该 proof，非空 attach 保留资格缺口。

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

本次起使用 revision v2 的逐调用覆盖规则。每完成一个 Child，就原子保存并回读本调用 scene/mapping；每轮拿到真实回复后、进入下一轮发送前，以 `--require-stage <当前 stepId>` 累计检查从 research 到当前轮的全部计划 Child、目标身份、合法命令前后回执及适用状态。缺调用、缺本调用的状态 scene、目标未拍到、命令证据缺失、缺 stage receipt 或已签名命令后置失败时，资格门仍返回失败并如实保留 gap/action conflict。用户本轮明确要求继续走完八轮现场覆盖，因此该资格失败不停止后续可安全执行的 QA 观察；不能改写事实、重发效应未知的提示词，亦不能宣称 `CAPTURE_COMPLETE`。真实页面/Provider 无法继续、会话身份未知或重复发送风险才停止。正常路径的异常分支未触发时如实标 `NOT_REACHED/NOT_APPLICABLE`，不得为凑齐 83 次伪造调用。旧 v1 修订维持原算法和内容，不重算。`CAPTURE_PARTIAL` 不是本任务的完成验收。

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
  --require-stage corpus_research \
  --output /absolute/outside-repo/seo-revision.json
```

每轮把 `--require-stage` 改为该轮 stepId。正常中间暂停时 mapping 设 `terminalBranch=stage-paused`、`terminalReceipt=null`，只用于仓库外临时装配，不作为完成版追加；真正异常停机改用现场真实终态。命令先写出可回看的证据版，再输出前缀 `stageGaps` 和 `stageConflicts`；任一非空仍以失败退出，作为资格结论保存，当前获授权的八轮现场采集继续按上一段执行。只有八轮各自资格门均通过，才允许追加完成版并立即生成独立 DOM 与代码比较；否则只可追加诚实部分版及对应独立比较版。

v2 SEO CLI 的 `--require-stage` 为必填；省略时在读取现场文件之前失败。中断后的真实部分版可从失败门已写出的仓库外文件走追加入口，须将 mapping 终态改为真实 `qa-stopped/qa-failure/unknown-effect` 与现场 receipt 后重新装配，不能把 `stage-paused` 发到唯一报告。

唯一 JSON 报告是 v8。一次受检 v7→v8 转换保留原 `products[].runs[]` 和逐 run 摘要；新的共享 SEO 样本只追加在 `seoCaptureRevisions[]`，不复制到任何 Product 切片、不改变其它路由的 `captureStatus`。同 `captureRunId + evidenceRevisionId` 相同内容重试 no-op，冲突拒绝；补正仅追加 `supersedesRevisionId + correctionReason`，旧版永不改写。追加在唯一文件独占锁内重读、校验、原子写入和 readback；两并发追加不得丢版。

用户指定该约 293 MB 的唯一 JSON 和派生 Markdown 仅保存在本机，路径在 `.gitignore` 精确排除，不进 Git 或推送。后续同机运行必须先在下述绝对路径读取并验证已有 v8 与旧版本；文件缺失或版本链不完整时停在追加前，不能新建空报告或以其它文件代替历史事实。

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

机器比较只是候选表，不能作为最终差异结论。Codex 必须对本版每个实际调用逐一核 `observedCallId → pre/command/post scene → signed target/transition → 冻结状态断言 → 对应 Child/Browser 代码路径与行`，在同一派生报告追加人工复核章节，列出全部调用的结论与依据；每个调用须列出全部已映射 scene，代码锚点要覆盖本次判断所涉及的 selector、动作与后置行，不能只给文件名或无关声明行。pre scene 的 decision/dispatch 与整次调用的 transitionChain 要分别写，不能把后续命令回执说成 pre scene 已执行。没有观察或没有同义代码锚点就逐项写 `EVIDENCE_GAP/REVIEW_REQUIRED`，不得从 8 次发送成功推成 83 个 Child 均匹配，也不得从采样里没有节点推断全 Document 没有节点。已签名命令失败且与代码强制后置直接冲突时须列 `DRIFT`，同一次点击在多个状态格出现只算一次。附件卡、上传进度、发送前附件集合须用真实目标节点和实际代码 selector/作用域逐项复核；输入偏差独立列出并说明其是否被代码拦截。**本任务只对照当前仓库工作区代码实字节**，报告绑定实际读取的相关文件摘要；HEAD 历史内容不得混入当前差异结论，也不要求云仓或发布身份。机器表与人工结论矛盾时，以可复算的逐调用证据纠正并追加新章节，旧章保留并标明不再作为结论。人工复核没有覆盖全部实际调用、差异没有 scene/代码锚点，或把未证实项当 `MATCH`，则差异报告验收失败；不得声称“100% 无差异”。

推理 Child 的逐调用代码对照要从真实 pre `aria-valuenow` 与授权 `requestedReasoningValue`、滑杆 `aria-valuemax` 算生产 `delta`：`delta=0` 应比较 slider click，非零应比较 ArrowLeft/Right 与绝对次数。页面真实执行了其它动作时，保留该命令 scene 的采集资格，并在独立差异报告按现役 handler 行标 `DRIFT`；命令类型或参数没有真实回执时标 `EVIDENCE_GAP`，不可写 `MATCH`。

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
- 当前页面对一次性粘贴约 10 KB 的文章提示词会自动生成 `粘贴的文本.txt` 附件，导致撰写器为空；必须先移除自动附件。首段可 `fill`，余文分段 `type`，每段读回并核对精确正文；本轮实测 `Shift+Enter` 产生双换行，不可用作精确输入。直接逐字键入含 `**` 的前段会触发编辑器 Markdown 自动格式化、丢失星号；每次发送前必须核最终 exact hash 与附件集合，失败绝不发送。
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

## 2026-09-25 v2 实战停机记录

- 新专用 Chrome QA run `seo-live-c5421990-fcff-42a7-bf54-9fe8179b2084` 在 research 发送前逐 Child 采 scene，真实资料包与来源摘要已本机校验，真实 SEO prompt hash 已由现役生成；**没有物理发送任何 SEO 或五语提示词**，stage receipt 为 0。此次不能作为 SEO+五语实测完成。
- 页面初态“最新”模型已选中（`aria-checked=true`）。实际点击已选中项后，选中状态仍为真，但模型菜单持续 `data-state=open`；现役 `select_gpt_model_from_start_v3` 要求选择后菜单关闭，故如实记录 `postconditionPassed=false`。第一次短时 scene 误标为成功，已从待装配 scene 集中隔离到仓库外 `invalid-scenes.json`，没有进入唯一报告；真实失败 scene 单独签名保留。
- research 前四个 Child 已记录；本版全八轮 flowGaps 共 84 条（79 个未映射调用、5 个已映射状态缺真实目标/命令）。正式 `--require-stage corpus_research` 只核 research 前缀，输出 14 条 stageGaps（含当轮缺 stage receipt）和同一次模型选择动作在两个状态观察形成的两条 action conflict。`prepare_clean_gpt_chat` 的 `attachment-region` 在空白新聊天没有唯一目标；执行配置触发器和已选模型项也有目标资格冲突，均保留真实 diagnostic 和独立差距，不补造成功。门禁以 `SEO_STAGE_NOT_READY` 退出，未推进 article/image/五语。
- 本机唯一 JSON 已追加第 4 个不可覆盖版本 `sha256:862fb91fc05db62bc0f11a703c5ae9372e5ed3442add65c9d5442bc93bed16cf`，即时独立比较版为 `sha256:6b1d6c05bf458cf457c4c55b6473d53763dea55f4d51f5e031702dd579ae5cc6`，`report-tool validate` 读回 valid=true、complete=false。现役 Child/矩阵与当前页的目标/后置不符时，不得为了凑 83/83 改写现场事实或跳过门禁；需另行在授权范围内使合同与真实 UI 对齐，再从新的完整 QA 会话复采。

报告不绑定 HEAD、branch 或 clean 工作区。所有旧 Product 运行记录、生产代码、Website 代码、法案和 Blueprint 均保持其原 Owner；本 Skill 不增加生产 hook、第二 Product runner、DOM DB、后台 Worker、重试服务或第二质量裁决。

## 2026-09-25 v3 实战进行中记录

- 专用 QA run `seo-live-da7f37c8-38b6-412f-a1c8-bfc398a975c2` 已在同一 Chrome 会话真实发送 SEO research 一次；Provider 初次显示“消息流中的错误”，只对原用户轮次点击一次“重试”，没有重发提示词。回复随后完成，现役研究解析器接纳 `proceed`，回执已逐步写入仓库外 `stage-receipts.json`。每完成一个 Child 立即保存并回读 `scenes.json` 与 `scene-map.json`，不能把观察留到轮次末尾堆积。
- research 阶段 12 个 Child 均有独立映射和现场场景；即时装配仍报告 19 条阶段缺口与 2 条模型动作后置冲突。已选中的“最新”选项点击后菜单保持打开，真实后置为失败。当前任务授权继续采集八轮的实际结果；这些冲突必须保留，不能改成成功或据此宣称 `CAPTURE_COMPLETE`。
- 文章提示词约 11.5 KB，一次 `fill` 后编辑器为空并自动产生“粘贴的文本”附件。分段 `fill` 首段、`type` 续段（包括真实换行）可以逐段得到精确 `innerText`；`Shift+Enter` 会在此编辑器形成双换行，不适合作为精确输入。首次失败留下的自动附件未在发送前清除，已随文章轮次发送；这是本 run 的真实输入偏差，必须在回执与差距报告披露，不能当作符合资料包清单的文章轮次。后续长提示词在发送前必须同时核对 exact prompt 和附件集合。
- 每次换到新的 Provider 轮次，采集器必须用该轮的 exact marker 重建，但继续使用同一 run、QA 标签页、epoch 和 `scenes.json`；沿用上一轮 marker 会令本轮 `exactAssistant` 报 `EXACT_ASSISTANT_TURN_AMBIGUOUS`，即使页面已有唯一可见回复。本次文章检查点改用文章 marker 后才取得唯一绑定。前序按旧 marker 采得的 scene 不得事后改签或冒充本轮语义投影。

## 2026-09-25 v3 八轮实战终态与下次采集注意事项

- 同一 QA run 已真实完成 SEO 三轮及 zh-HK、zh-TW、en-US、ja-JP、ko-KR 五轮。83/83 个计划 Child 均有独立调用映射和逐调用保存/回读；8 张 stage receipt 均来自对应真实回复与现役解析，同一 canonical URL 哈希。唯一 JSON 已追加第 5 个版本 `sha256:b9988c93afa4b65a08786582f71eebe2ae286d9e976ac092a967f36bb0bb55ae`，独立差距版 `sha256:62d9508ddbd5744b376231c8a77cd68183551749c2c34c0a752db6bfddf32e08`。`report-tool validate` 为 `valid=true, complete=false`；最终资格仍为 `CAPTURE_PARTIAL`，136 条均为固定分支状态未满足，另有 14 条已观察模型选择后置冲突。83/83 是现场调用覆盖，不是固定 DOM 状态或生产业务验收通过。
- 五语上传中实际为一个 `form[data-chatgpt-composer]` 内 0 个 `button.composer-attachment-surface[aria-label]`、4 个 `[role=progressbar]`，完成后为 4 个具名按钮、0 个 progressbar。当前工作区四个卡片消费者使用 `button.composer-attachment-surface[aria-label]`，reconcile 的上传中目标使用 `[role='progressbar']`，且已删除“进度条不得多于卡片”不变量；这些是当前仓库代码事实，不等于 Child 实际运行通过。旧 `[role='group'][aria-label]` 属于历史 HEAD 基线，不得列为当前工作区差异。该代码修复不属于本 Skill 的采集修改权限。
- ja-JP 及 ko-KR 回复生成中曾出现 Chrome DOM 读取超时；只在原 QA 标签页只读回查，停止按钮消失且语义正文稳定后才采终态，未重发提示词。长会话的上一轮 user/assistant 可能仍可见，旧轮正文不重复投影；下一语发送前核最后可见上一轮 marker 与相邻回复、同 URL。
- 第 5 版原始 revision 约 327 MB、旧本机 JSON 约 317 MB；整份 pretty JSON 序列化触发 Node `Invalid string length`。报告工具的原子写入改为紧凑 JSON，合并后约 324 MB，readback 校验通过且旧四版内容仍保留。后续追加前先测单个 JSON 字符串大小；若总量达到 Node 单字符串上限，必须先修原唯一报告工具的读取/写入能力，不得另建第二证据报告或丢旧版。当前本机文件不进入 Git。
- 第 6 版 `sha256:93d6b50f006de36e92bef4464cf0bbbb77da3e12a884eac8b8b712d67a2b339f` 以 `supersedesRevisionId` 指向第 5 版，只在文章阶段回执追加签名 `a-submit-pre` 所证实的输入偏差：预期 0 件附件、实际 1 件，标签仅存哈希。独立比较版 `sha256:61952af8684c5948789f93b1feff3647bb8b0ff22450739df1b7c5dffcef8e46` 明列这一偏差；第 5 版与旧比较版不覆盖。最新仍为 83/83 调用、8 回执、136 条分支状态缺口、14 条模型后置冲突、`CAPTURE_PARTIAL`，原生读回 `valid=true, complete=false`。验证器从签名发送前 scene 独立判断额外附件，不能靠删掉回执注记变成 `CAPTURE_COMPLETE`。本机唯一 JSON 现为 498,456,139 字节，接近 Node 单字符串上限；下一次追加前先修原工具的大文件读写能力，禁止另建报告或丢弃旧版。
- 对第 6 版 136 个 `missing-branch-state` 的逐项复核已追加到唯一差距报告：54 个有对应 scene 但状态观察行未生成，71 个状态行的旧目标未命中，6 个兼有目标与命令问题，5 个只有命令回执问题。**83/83 只代表调用与 scene 映射，不得说成 83 项状态都采集完整。**旧投影器用明文条件查已哈希的属性，附件目标还沿用旧 UI；旧证据与旧投影规则保持原样，不允许改动旧版证据后重算为成功。采集器已在固定范围增加当前附件浮层与 composer 内隐藏文件输入，并保留清洗/哈希规则；新增 `CURRENT_TURN_TARGETED_FILE_INPUT_V5`／`gpt-page-collector-scope.v2` 版本绑定及仅对 v2 生效的当前目标解析，旧 v1 仍走旧解析。冻结状态矩阵尚未修订，不能把新解析等同于补采完成。附件菜单/上传入口/文件输入和缺失的命令回执只能用新的真实 Chrome 现场证据判定。当前代码对照以差距报告最后更正章节为准。原 `pipeline.acceptance` 的 image-only fixture 少报 `imageDescendants=1`，曾令断言假阴性；已补该测试事实并通过，不可把旧失败当成真实页面 image Child 失败。
- 唯一 JSON 下一版的体积障碍已按原报告工具处理：顶层数组逐项原子写入、按单版切片读回与验证，避免整份 JSON 经过 Node 单字符串。读器只接收本工具写出的紧凑 canonical 格式，`seoCaptureRevisions` 必须是末尾顶层字段；不要手动格式化或重排。用原文件的临时副本追加测试第 7 版，测试文件达 672,446,828 字节，七版读回、旧六版顺序及新版本身份均通过；临时文件已删除，**真实唯一 JSON 仍为原第 6 版 498,456,139 字节**。这项本机工具验收不等于 Chrome 补采或第 7 版真实证据完成。

## 2026-09-25 当前会话审计与工具状态

- 这是同一个长期采集任务；此前确实通过 Chrome 插件连接过 QA 页面。当前可调用工具列表没有 `chrome:control-chrome`，本机 Skill 目录也未找到该入口；插件目录查询未提供可替代的同名控制能力。原因尚未证实，不能归咎于用户设置。当前没有新增现场 scene、83 次调用或第 7 版；不得把静态脚本验收写成新采集。
- 审计发现旧矩阵目标及当前校验可把「有 scene」误记成「生产 Child 状态已满足」。本次在固定 83 调用边界内补了模型全 Document 候选与点击属性读回、推理滑杆和 profile 拓扑、附件菜单与文件输入作用域、附件集合与上传终态、精确提示词和发送前零/四件集合、清洁会话原始计数、提交按钮与空撰写器、文本回复稳态、调用先后顺序等资格门。凡真实 Chrome 返回缺命令、候选属性、原始计数或同义 postcondition，必须留下 `unqualified-branch-state` / `CAPTURE_PARTIAL`，不得手填通过。
- 非空附件 Child 必须有同调用真实 `attachFile` / `filechooser.setFiles` 上传回执，卡片读回晚于命令且同一 Document/标签页；仅有卡片名称不能证明文件原字节已经交给 chooser。五语 `provider-upload` 副本和 SEO ZIP 已由本机 pin loader 按 SHA-256/bytes 校验；下一次 Chrome 操作仍须使用 loader 返回的精确本机路径，并在逐调用人工差异审查中记录命令实参来源。若 Chrome 接口无法给出足以绑定实参的回执，报告必须把「上传实参字节与固定资料包一致」列为未机械证明，不能声称来源 100% 闭合。
- 新 collector 必须重新生成静态 bundle；旧 QA run 的 scene 没有这些新增的 full Document 事实，不得用旧 scene 反填或改签。唯一 JSON 旧六版照原样保留，下一版只在真实 Chrome 现场采集与逐阶段验收后追加。
- 长提示词折叠时，旧的“找最近用户轮次”正文投影可漏读或错配。新文本 checkpoint 只从生产同义的同一 `[data-turn-key]` 内 user 单元的紧邻 assistant 单元取当前 marker 的正文，核 user/assistant UUID、message ids、role、selection 所属；缺任一项就停在下一轮发送前。提交后的最新 user turn 另按 fallback ordinal、气泡和 prompt 内容结构核验；不得用旧 turn 的相同 marker 代替最新轮次。根页 URL 必须精确 `https://chatgpt.com/`，发送后只接收无 query/hash 的 canonical `/c/<id>`。
