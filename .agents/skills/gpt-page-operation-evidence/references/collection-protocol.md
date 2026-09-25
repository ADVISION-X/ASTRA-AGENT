# GPT 页面采集协议

## 冻结清单

`page-operation-matrix.json` 必须逐项等于现役 GPT 页面 Child 合同。执行前运行 `report-tool inventory --read-only`，冻结矩阵 digest、14 个 Child、各 Child 的 required/optional/derived 状态、目标与断言，以及统一 `fixedCaptureFields`。每个格都输出 `OBSERVED`、`NOT_REACHED`、`NOT_APPLICABLE`、`CAPTURE_GAP` 或 `CONFLICT` 与原因。正常 SEO 不出现的 `acknowledge_known_gpt_rate_limit` 和所有故障态保持 `NOT_REACHED`。

## 来源准入

历史 Product attempt：`production-source.mjs` 的 `PRODUCTION_RUNTIME_DURABLE_TASK` 必须有 attempt 专属真实 `actualTrace`。没有 trace 时只可回看缺口，不能从当前源码补序列。

新采集：`seo-live-source.mjs` 首次只接受 Website 历史 `public_knowledge_article_pipeline/produce_article`。已在 Website DB 只读事务读取同 job 和精确材料绑定，在 AGENT runtime SQLite 只读打开同 job，再对 Website 私有对象存储和 AGENT 材料目录原字节核等；ZIP 的每本古籍原文/索引、文章目录、主题聚类齐全。首次核验的原包及来源摘要固定保存于本 Skill `assets/`。后续采集用 `loadPinnedSeoSource` 校验固定包字节、来源摘要、现役路由和 Product 源码，不再每轮搜索数据库。任何不等均在 Chrome 前停止；Website 历史 task 只作输入，不认领或恢复，也不得宣称固定包是当轮 Website 实时读回。

## 现场执行

按 `chrome:control-chrome` Skill 连接 Chrome，只使用本轮专用 QA 标签页。Chrome 受限执行环境不能直接加载 `tsx/esm/api` 或运行 `new Function`；终端用 Node 24 把现役 Product turns 编译为仓库外静态模块，并运行 `build-chrome-collector.mjs` 静态嵌入生产 canonical reader，浏览器会话仅导入这两个静态模块，不用终端操纵页面。`source.publicSource` 的稳定摘要由 `seoSourceInputHash` 计算，传入 collector 的 `LIVE_SEO_CAPTURE_SESSION` trigger；scene binding 必须相同。

Codex 在每个 Child 前采 pre scene，页面上逐角色核 exact 输入，执行一次真实 Chrome 动作，取得回执，再采全新 post scene。`observedCallId(captureRunId, stepId, childId, firstScene)` 只能在第一现场 scene 到手后计算。mapping 对每个调用独立记录：

```json
{
  "captureRunId": "seo-capture-unique-id",
  "captureEpoch": "sha256:...",
  "observedCalls": [{
    "observedCallId": "sha256:...",
    "stepId": "corpus_research",
    "childCapabilityId": "prepare_clean_gpt_chat",
    "promptHash": "sha256:...",
    "turnMarkerHash": "sha256:...",
    "states": { "stale-draft-before": "scene-id", "stale-draft-after-clean": "other-scene-id" }
  }],
  "terminalBranch": "qa-stopped",
  "terminalReceipt": { "stepId": "corpus_research", "observedCallId": "sha256:...",
    "sceneId": "scene-id", "providerEffect": "no", "reasonHash": "sha256:..." }
}
```

同一 scene 不得属于两个调用。同一阶段同一 Child 只能有一个实际调用；不同阶段可共用 Child，单个计划格的 `observations[]` 可有多条，每条绑定自身 call/scene。`terminalBranch` 在旧三轮版可为 `image-complete`，八轮版五语全部回执齐时为 `translation-complete`；两版均可为 `research-decline/qa-stopped/qa-failure/unknown-effect`。`translation-complete` 只表示八次 QA Provider turn 到达，不表示 83 次 Child 状态齐全；后 3 类必须有真实现场 `terminalReceipt`。命令效应未知时记录 `providerEffect:unknown`，只读回原身份，不物理重发。

SEO prompt 顺序由现役 `researchPrompt`、`articlePrompt`、`imagePrompt` 产生；后两者只能在同 run 前序真实 assistant turn 被生产 canonical semantic reader 精确读出、hash/turn/document/revision 与同包 scene 相等、并通过现役 `parsePublicKnowledgeResearch/Article` 后生成。原 prompt 和原 assistant 文本仅存当前 Node REPL 内存。研究合法 `decline` 就停；图片必须是真实页面 media 后置。其后五语固定为 zh-HK → zh-TW → en-US → ja-JP → ko-KR，每语从 Skill 固定的历史真实 task/route/resultRevision/四件原字节，通过现役 Product 封闭 probe 捕获 exact prompt，在同一 QA URL 真实上传、发送一次，并由现役解析器接受唯一相邻回复。五语历史源文章与 SEO QA 新文章不同；生成图片的业务组包/Website 消费及五语历史工单认领均不属于 QA 会话。

## 装配与结果

`assemble-live-capture.mjs --seo-source --localization-source <Skill public manifest> --pinned-source <Skill assets>` 在八轮版必须即时重读固定原包及来源摘要，不能仅凭传入的公共 JSON。旧三轮修订仍按其冻结的 28 次调用校验；八轮版分母为 SEO 28 次加五语各 11 次共 83 次。少一次或少终态即 `CAPTURE_PARTIAL`，即使八次真实 Provider turn 都完成也不能写假齐全。八轮失败可留 0～7 个完整阶段回执及现场失败/未知回执。未到达格不造 DOM。collector 保留候选清洗 DOM 和拒绝理由；raw body、Cookie、token、原会话 URL 禁止进入文件。

新 revision v2 在每个 Child 后立即保存并回读 scene/mapping，在每轮回复后用 `--require-stage <本轮 stepId>` 装配并累计检查此前全部阶段。中间正常等待下轮时 mapping 写 `terminalBranch=stage-paused`、空 terminal receipt；只写仓库外临时证据版。`stageGaps`（缺目标、缺命令证据、缺回执）或 `stageConflicts`（已证实命令后置失败）非空仍使资格门失败。当前用户明确授权继续完成 83 项真实现场覆盖，故资格失败不阻断后续可安全执行的 QA 轮次；真实 Provider 效应未知、会话身份失联或重复发送风险仍须停止。覆盖按每个计划调用自己的 `observedCallId` 与适用状态计算；全局 cell 的 `CONFLICT` 只表达已拍到的 DOM/断言差距，不能抹掉其它调用的真实观察，也不能充作缺 scene。缺目标的 row 不得使同格其它有效 row 消失。历史 v1 证据继续按 v1 原规则验证。部分版只记录中断事实，不是完成目标。

v2 SEO CLI 缺 `--require-stage` 直接拒绝。若在某轮真实中断，先保留门禁失败所写临时 scene/revision，再以真实终态和现场 terminalReceipt 装配可追加的部分版；禁止发布 `stage-paused` 或借省略门禁拿到 exit 0。

`report-tool.mjs append-seo --pinned-source <Skill assets>` 也即时重读固定原包及来源摘要，在唯一 JSON 锁内重读、校验、追加和 readback。相同版本重试 no-op，补正追加，不删除旧版；随后立刻按刚落盘版本对照实际代码，向独立 Markdown 追加 comparison revision。差距报告只记录状态、身份、指针和代码 digest，不重复保存 DOM。比较失败时原证据保留并报告未闭合；重试比较不得重发 Provider。

自动比较后由 Codex 逐个复核本版全部实际调用，再在同一 Markdown 追加人工判定。复核每项必须能回到 call/签名 scene/目标或后置/源码行；同一物理动作只计一次差异。把“当前工作区代码直接冲突”“冻结矩阵与现场不符”“发送输入偏差”“采集证据缺口”分开写，只以当前仓库工作区实字节及文件摘要作为代码基线；历史 HEAD 不进入当前差异计数。采样内找不到节点不能推出全 Document 为零；已签名的目标节点与代码选择器正面不匹配可以判定该节点上的差异。人工判定未覆盖全部实际调用或未解决机器表中的确定性反例时，本轮差距交付未完成。

历史 `candidate/admit` 只验证 Product 原运行记录。同页八轮共享 Child 的状态不授予其它 Product 覆盖、Website 入库、生产质量、READY 或 RELEASE。
