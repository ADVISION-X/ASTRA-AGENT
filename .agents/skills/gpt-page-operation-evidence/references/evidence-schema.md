# GPT 页面证据 Schema V8

## 唯一报告

`docs/项目方案/GPT页面操作子能力实证资料.json` 的 `schemaVersion` 为 `gpt-page-operation-evidence.v8`。原 `products[].runs[]` 是历史 Product attempt 证据；一次受检 v7→v8 转换保留原产品对象，并在 `legacyV7.reportHash`、`legacyV7.productDigests[]` 与 `legacyV7.runDigests[]` 记录原文件及每条旧 run 摘要。验证器继续使用旧 run 的冻结快照语义逐条重算；现役矩阵变化只使 projection stale，不许可旧 run 被静默改写。

新共享 QA 页面样本只在顶层 `seoCaptureRevisions[]`；字段名为历史兼容，八轮版包含 SEO 三轮与五语五轮，不表示五语源文来自本次 SEO QA 文章：

```json
{
  "schemaVersion": "gpt-page-operation-evidence.v8",
  "legacyV7": { "reportHash": "sha256:...", "productDigests": [], "runDigests": [] },
  "products": [],
  "seoCaptureRevisions": []
}
```

共享 revision 沿用 `gpt-page-seo-capture-revision.v1`，`captureRunId + evidenceRevisionId` 为唯一键。`evidenceRevisionId`/`contentHash` 是排除这两个自哈希字段后的稳定内容摘要；重复键同内容是 no-op，同键异内容拒绝。`supersedesRevisionId + correctionReason` 只能指向同 run 已存的旧版，不能覆盖它。

```json
{
  "schemaVersion": "gpt-page-seo-capture-revision.v1",
  "captureRunId": "seo-capture-unique-id",
  "evidenceRevisionId": "sha256:...",
  "contentHash": "sha256:...",
  "capturedAt": "2026-09-24T00:00:00.000Z",
  "source": {
    "sourceKind": "LIVE_SEO_CAPTURE_SESSION_INPUT",
    "productId": "public_knowledge_article_pipeline",
    "actionId": "produce_article",
    "requestHash": "sha256:...",
    "archiveHash": "sha256:...",
    "archiveBytes": 1,
    "archiveEntries": [],
    "sourceHashes": {}
  },
  "matrixDigest": "sha256:...",
  "planDigest": "sha256:...",
  "flowDigest": "sha256:...",
  "frozenFlow": { "expectedCalls": [{ "stepId": "corpus_research",
    "childCapabilityId": "prepare_clean_gpt_chat" }],
    "terminalStates": { "prepare_clean_gpt_chat": ["fresh-empty-chat"] },
    "stateBranches": { "prepare_clean_gpt_chat": [["fresh-empty-chat"]] },
    "productSourceHashes": { "src/plugins/public-knowledge-article-pipeline/index.ts": "sha256:..." } },
  "frozenPlan": [{
    "childCapabilityId": "prepare_clean_gpt_chat",
    "stateIds": ["fresh-empty-chat"],
    "requiredLiveStates": ["fresh-empty-chat"],
    "liveStateTargets": { "fresh-empty-chat": ["page-root"] },
    "stateAssertions": { "fresh-empty-chat": [] },
    "codeTargetSelectors": { "composer": "GPT_COMPOSER_SELECTOR" },
    "fixedCaptureFields": ["captureRunId", "observedCallId", "childCapabilityId", "stateId"],
    "codePaths": ["src/capabilities/gpt/children/prepare_clean_gpt_chat/selectors.ts"]
  }],
  "calls": [{
    "observedCallId": "sha256:...",
    "stepId": "corpus_research",
    "childCapabilityId": "prepare_clean_gpt_chat",
    "promptHash": "sha256:...",
    "turnMarkerHash": "sha256:...",
    "sceneIds": ["scene-id"]
  }],
  "scenes": [],
  "cells": [{
    "childCapabilityId": "prepare_clean_gpt_chat",
    "stateId": "fresh-empty-chat",
    "status": "OBSERVED",
    "reason": "same-run-scene-bound",
    "observations": [{ "observedCallId": "sha256:...", "sceneId": "scene-id", "specimen": {} }]
  }],
  "stageReceipts": [{
    "observedCallId": "sha256:...",
    "stepId": "corpus_research",
    "sceneId": "scene-id",
    "promptHash": "sha256:...",
    "responseHash": "sha256:...",
    "decision": "proceed"
  }],
  "terminalBranch": "qa-stopped",
  "terminalReceipt": { "stepId": "corpus_research", "observedCallId": "sha256:...",
    "sceneId": "scene-id", "providerEffect": "no", "reasonHash": "sha256:..." },
  "flowGaps": ["missing-call:article_synthesis/..."],
  "captureStatus": "CAPTURE_PARTIAL",
  "supersedesRevisionId": null,
  "correctionReason": null
}
```

示例仅展示形状，真实 revision 必须完整覆盖冻结的全部 14 个 Child、每个 required/optional/derived 状态和矩阵全部固定字段。`cells[]` 对每个 Child/state 恰有一格；重复调用放入该格不同的 `observations[]`，不得复用 scene。未观察格的 `observations` 必须为空。`OBSERVED/CONFLICT` 必须绑定同 run 的真实 scene/Document/revision/签名和 specimen；`NOT_REACHED/NOT_APPLICABLE/CAPTURE_GAP` 不填伪 DOM。scene 内只保留安全节点、清洗 URL 和 hash-only 业务文本。

旧三轮 revision 的 `stageReceipts` 顺序仅为 research → article → image，冻结分母 28 次 Child；旧版继续按自己的 `frozenFlow` 验证。八轮版在其后严格追加 `article_translation:zh-HK` → `zh-TW` → `en-US` → `ja-JP` → `ko-KR`，冻结分母为 SEO 28 次加五语各 11 次，共 83 次。每语 QA step 身份包含 locale；现役 Product 内部仍用 `productStepId=article_synthesis`，不得合并五语 call。`localizationSource` 只允许固定公开 manifest 的安全 hash-only 投影：五项 job/source/parent/resultRevision 哈希与四件材料的固定 role/ordinal/安全显示名/bytes/hash，禁止原始 task、对象 ref、材料正文和附加键。每语 receipt 绑定自己的 sourceJobIdHash、materialDigest、prompt/marker、唯一 user/assistant turn、Document/revision、解析 hash 和同一 QA URL；`translation-complete` 只表示八条真实阶段回执齐全，不自动授予 `CAPTURE_COMPLETE`。

八轮失败可保留 0～7 个完整阶段回执和现场 `terminalReceipt`。research `decline` 是合法单阶段终点，但仍为部分覆盖。`frozenFlow.stateBranches` 区分适用状态与互斥分支，未走的分支为 `NOT_APPLICABLE`；历史 v1 中缺少适用前/后状态或任何 `CAPTURE_GAP/CONFLICT` 都不能标 `CAPTURE_COMPLETE`。即使八次真实发送完成，83 次计划 Child 有缺项仍须为 `CAPTURE_PARTIAL`。同一 revision 的 `scenes[]` 可带 `observationScope`：`collectorProfile` 区分旧宽采、长会话 current-turn 缩采与 v13 `null` 未读旧回复；旧 profile 是不在原 scene 签名内的事后标注，v13 `pageFacts.captureScope` 则进入 scene 签名。节点采样和当前挂载 turn ID 均不是 full Document 证明，旧空 response hash 不能推断真实空回复。此状态只代表跨文章 QA 同页页面取证，不代表 Website 接收结果、Browser WAL 或五语历史工单完成。

新 `gpt-page-seo-capture-revision.v2` 的 `flowGaps` 逐计划调用检查 `selectedSeoBranch` 的每个适用状态和终态是否有该调用的签名 scene 与 specimen，另核实际 stage receipt；全局 cell 状态不代替逐调用覆盖。`CONFLICT` 保留在 cell 和差距报告中，表示拍到了不符的 DOM；它本身不是未采集。`CAPTURE_GAP` 可含其它调用的有效 observation，缺失行仍由逐调用 gap 精确指出。v1 历史修订保持原校验语义。完成状态必须八轮 receipt、同一 QA URL、83 次计划调用各自覆盖且 `flowGaps=[]`；每轮发送前的 `--require-stage` 累计放行当前前缀，不代替最终完成判定。

v2 中间阶段装配可使用 `terminalBranch=stage-paused`、`terminalReceipt=null`，必须已有至少一个真实 stage receipt 且尚未完成八阶段；只允许保存在仓库外临时文件，唯一 JSON 的 append 入口拒绝此分支。`--require-stage` 从 research 起累计检查至指定阶段，输出 `stageGaps`（证据缺失）和 `stageConflicts`（已签名命令后置失败）；任一非空均禁止下一轮物理发送。完成版还必须 `seoActionConflicts=[]`。差距 Markdown 将 `CAPTURE_GAP` 与 `CONFLICT` 分列，不能在漏采表混算已拍到的冲突。

## 历史格式

`gpt-page-operation-production-source.v1` 和 `gpt-page-operation-capture.v6` 仅用于历史 Product attempt。它们需要该 attempt 的真实非空 `actualTrace`、逐角色 `gpt-page-input-binding-proof.v1` 及原 Product 终态回执。artifact-only source 的 `actualTrace=[]` 不能被新 SEO 入口填充。历史 `products[].runs[]` 的 `candidate/admit` 不消费 `seoCaptureRevisions[]`。

## 派生代码差距版

`docs/项目方案/GPT页面DOM与代码差距报告.md` 是独立可审阅的派生报告，逐次追加 `comparisonId`、`captureRunId/evidenceRevisionId`、`codeDigest`，并逐计划字段记录 Child/state、实际 call/scene、源码路径/行/hash、`MATCH/DRIFT/UNOBSERVED/CODE_ONLY/REVIEW_REQUIRED`。不复制 DOM 事实；旧比较版保留。比较失败不删除已落盘证据版。
