# 产品页面实证 Schema V6

## 1. 生产 source manifest

`production-source.mjs` 输出 `gpt-page-operation-production-source.v1`：

```json
{
  "schemaVersion": "gpt-page-operation-production-source.v1",
  "sourceKind": "PRODUCTION_RUNTIME_DURABLE_TASK",
  "synthetic": false,
  "productId": "public_knowledge_article_pipeline",
  "actionId": "produce_article",
  "sourceSnapshotId": "sha256:...",
  "flowContractDigest": "sha256:...",
  "materials": [{ "role": "ready_corpus_archive", "bytes": 1, "sha256": "sha256:..." }],
  "actualTrace": [{
    "traceEntryId": "sha256:...",
    "productStepId": "corpus_research",
    "actionOrdinal": 1,
    "callId": null,
    "childId": "prepare_clean_gpt_chat",
    "exactCallIdentityHash": "sha256:...",
    "inputBinding": {
      "schemaVersion": "gpt-page-input-binding.v1",
      "source": "FORENSICS_SAFE_PROJECTION",
      "inputHash": "sha256:...",
      "roleHashes": {
        "promptHash": "sha256:...",
        "responseHash": null,
        "attachmentLabelHashes": ["sha256:..."],
        "attachmentSetHash": "sha256:...",
        "modelDisplayNameHash": null,
        "reasoningRequirement": null,
        "conversationUrlHash": null,
        "turnMarkerHash": null,
        "assistantTurnIdHash": null
      }
    },
    "browserReceipts": []
  }],
  "flowStatus": "PARTIAL",
  "flowProjectionStatus": "MATCHED_PREFIX",
  "flowProjectionGaps": ["UNOBSERVED_CURRENT_PRODUCT_STAGE:article_synthesis"],
  "terminalBranch": null,
  "terminalBranchProof": null,
  "flowGaps": ["UNOBSERVED_PRODUCT_STAGE:article_synthesis"]
}
```

`sourceSnapshotId` 只由 task 投影与实际材料字节身份计算。`flowContractDigest` 只由目标产品合同、Product flow sources 和 trace 实际调用的 Child sources 计算。两者都不得包含 Git HEAD、branch、clean 或全仓摘要。

`actualTrace` 是该 accepted attempt 的历史采购清单。`callId` 只有 Browser durable receipt 能提供时才非空，禁止从另一张手写序列表推断。`flowProjectionStatus/flowProjectionGaps` 只比较当前 Product 阶段投影；`HISTORICAL_DRIFT` 不否决已经由 durable task、材料和 forensics 证明的历史事实。

新生产记录的 `inputBinding` 必须来自同一 forensics record 的 `input_hash/page_input_role_hashes`。Browser mutation receipt 的 `request_hash` 只能校验或补充 aggregate `inputHash`，不能替代逐角色哈希。旧记录缺逐角色字段时保留为历史事实，但相应页面调用只能输出 `PAGE_INPUT_BINDING_GAP`，禁止从当前源码或其它调用逆向补造。

指定历史 attempt 时，终态只绑定该 attempt 自己的 durable terminal。历史失败必须读取精确的 `production_attempt_failures(job_id, attempt_id)` 行，并在 `terminalBranchProof.durableFailureReceiptHash` 中绑定该行；当前 task 行即使后来完成也不能替历史 attempt 提供 status/result。历史 attempt 无专属终态时必须是 `PARTIAL`，缺口为 `DURABLE_ATTEMPT_TERMINAL_UNAVAILABLE`。

合法终点必须写 `flowStatus=OBSERVED_COMPLETE_PATH` 和非空 `terminalBranch`。`production-failure` 表示真实故障分支已经走到终点；若该分支的所有实际页面调用 DOM 齐全，采集完整不等于业务成功。尚未到终点时使用 `PARTIAL`、`terminalBranch=null` 和准确 `flowGaps`。

`terminalBranchProof` 对完成分支保存 task result receipt、result payload、result object receipt 与 production outbox authority 的四个安全哈希；SEO `research-declined` 还必须来自 Product 合同声明路径上的明确 durable decision，不能由阶段数推断。失败分支保存 attempt 专属 durable failure receipt + 最后一条 failed trace 的安全关联证明。失败 source 缺该字段时装配器直接拒绝，禁止兼容推断。公共报告只保留 source manifest 的安全投影和可复算 digest，不保留原始 job/attempt、材料名、reason、recordRef 或 commandId。

## 2. Capture V6

`gpt-page-operation-capture.v6` 必须包含完整 `productionSource` 和一个 `productRun`：

```json
{
  "schemaVersion": "gpt-page-operation-capture.v6",
  "captureEpoch": "sha256:...",
  "productionSource": {},
  "productRun": {
    "productId": "public_knowledge_article_pipeline",
    "actionId": "produce_article",
    "sourceSnapshotId": "sha256:...",
    "flowContractDigest": "sha256:...",
    "terminalBranch": "production-failure",
    "calls": [{
      "productStepId": "corpus_research",
      "actionOrdinal": 13,
      "childId": "submit_exact_gpt_turn_once",
      "exactCallIdentityHash": "sha256:...",
      "pageRequirementSnapshot": {
        "matrixDigest": "sha256:...",
        "childCandidateDigest": "sha256:...",
        "requiredLiveStates": ["pre-submit-ready", "post-submit-user-turn", "confirmed-submit-effect-readback"],
        "requiredInputRoles": ["promptHash", "attachmentSetHash"],
        "liveStateTargets": {
          "pre-submit-ready": ["composer", "submit-control"],
          "post-submit-user-turn": ["user-turn"],
          "confirmed-submit-effect-readback": ["user-turn"]
        },
        "stateAssertions": {
          "pre-submit-ready": [{ "path": "stateFacts.capturePhase", "operator": "equals", "value": "PRE_ACTION" }],
          "post-submit-user-turn": [{ "path": "stateFacts.capturePhase", "operator": "equals", "value": "POST_ACTION" }],
          "confirmed-submit-effect-readback": [{ "path": "stateFacts.capturePhase", "operator": "equals", "value": "ALREADY_SATISFIED" }]
        },
        "childContract": { "contractVersion": 3, "profile": "TARGET_LOCAL_MUTATION", "allowedDocumentTransition": "forbidden" },
        "derivationDigest": "sha256:..."
      },
      "inputBindingProof": {
        "schemaVersion": "gpt-page-input-binding-proof.v1",
        "inputHash": "sha256:...",
        "inputHashBound": true,
        "checks": [{ "role": "promptHash", "expected": "sha256:...", "matchedSceneIds": ["scene-..."], "status": "MATCHED" }],
        "complete": true
      },
      "domEvidence": { "specimens": [] },
      "captureComplete": false,
      "gaps": ["PAGE_EVIDENCE_GAP:..."],
      "derivationEnvelopeHash": "sha256:..."
    }]
  }
}
```

`productRun.calls` 顺序来自实际 trace。每个 page call 的 specimens 只能来自 `productCalls.<traceEntryId>.states`；重复 Child、以及同一 exact call 的失败/重试记录不得共享证据。`exactCallIdentityHash` 继续标识逻辑调用，`traceEntryId` 标识实际 evidence record。

`pageRequirementSnapshot.requiredLiveStates` 不是 mapping 的自由输入，而是采集时矩阵按该 trace 分支派生的精确分母；同一快照还固定这些状态的 targets/assertions、required input roles 和 Child transition contract，并由 `derivationDigest` 封口。mutation `confirmed/dispatched` 取 pre/post；成功 `no` 取 already-satisfied/steady；失败 `no` 且无 Browser 观察取空集合，并以 `domEvidence.specimens=[]` + durable failure 表示页面证据不适用，不要求 input↔DOM 匹配。其它缺 mapping 调用仍必须保存同一分母并报缺口。`transitionReceipt.postconditionPassed` 为必填布尔；值为 `false` 或发现合同禁止的 document transition 时，scene/specimen 仍保留并产生 `PAGE_EVIDENCE_CONFLICT:*`，不得把失败 DOM 删除或改写为 PASS。

同一 Child 若有互斥的成功/失败终态，必须在矩阵同一条目用 `traceResultStatuses.<stateId>` 为全部 required state 声明适用的 `success`/`failed` trace 结果。状态分支只能由 durable trace 的 `resultStatus` 机械选择；采集 mapping、当前页面和报告编辑者都无权改变分母。

Chrome scene 的 `documentIdentityHash` 使用专用 QA tab 身份与清洗后的 canonical route 绑定；同一路由的菜单展开、输入与弹层变化不得伪造 Document 切换，route 切换仍必须产生不同身份。执行配置控件还必须位于包含唯一 composer 的 form 内，不能把对话折叠按钮或侧栏按钮计入候选。白名单 `aria-label` 只有在节点本身具备 button/menuitem 等 UI 语义时才可明文保留。

公共 `sceneManifest` 只保存 `productCalls.<traceEntryId>.states` 实际引用的 scene，以及被这些 scene 的 transition receipt 直接引用的 pre scene。重采时被替换、未映射且不属于 transition 链的 scene 不得进入唯一报告；装配器必须同时拒绝 mapping 或 receipt 指向不存在的 scene。

每个 LIVE specimen 继续保存：core、related、peripheral、stateFacts、Document/revision、pre/command/post chain、source scene identity 和 state signature。UI 白名单以外文字只能是 `HASH_ONLY`。

当 required target 的 raw candidate 存在但资格失败时，`core.targets.<target>` 保存 `observed:false` 和 `diagnosticDom.{normalizedStructure,sanitizedOuterHtml}`；call 同时保存 `PAGE_EVIDENCE_CONFLICT:target-not-unique:*`。这是同一真实 scene 的失败现场，不是第二份报告，也不能满足完整采集。

Capture 的 browser/environment/recapture trigger、scene binding、decision receipt、transition receipt 都是精确白名单对象，任何额外字段都使 capture 无效。公共报告给每个完整 specimen 增加可复算 envelope；报告合并和 validate 都重新检查 scene envelope、specimen envelope，以及 `sourceSceneId` 只能归属一个 `traceEntryId`。

每个 page call 的 `pageRequirementSnapshot` 冻结采集当时的页面状态语义，仅用于历史 slice 自身一致性校验，不拥有 Product 步骤或顺序。`inputBindingProof` 必须由该 call 的生产 `inputBinding` 与其 specimens 中符合 Child/状态来源策略的 Chrome pageFacts 机械重算；所有必需角色 MATCHED 才能 complete。每个 call 另有覆盖 snapshot/proof/DOM/verdict/gaps 的 `derivationEnvelopeHash`。报告 stale 后按快照继续重算并检查公共 production source 精确投影、capture context 白名单和全部 envelope；只跳过当前投影相等检查。

## 3. 唯一报告 V6

Canonical 报告仍是 `docs/项目方案/GPT页面操作子能力实证资料.json`：

```json
{
  "schemaVersion": "gpt-page-operation-evidence.v6",
  "primaryIndex": "products",
  "productionRuntimeConsumer": false,
  "claimsQualityVerdict": false,
  "products": [{
    "productKey": "public_knowledge_article_pipeline/produce_article",
    "contractDigest": "sha256:...",
    "captureStatus": "CAPTURE_PARTIAL",
    "runs": []
  }],
  "childIndex": {}
}
```

`products` 必须覆盖 production Catalog 的全部路由。没有 Product 合同的路由仍存在，但固定缺口为 `PRODUCT_EVIDENCE_CONTRACT_NOT_IMPLEMENTED`。

`childIndex` 必须机械等于 `products[].runs[].calls[]` 的反向投影。校验器发现独立写入或不一致时返回 `REPORT_CHILD_INDEX_NOT_DERIVED`。

`children` 字段只保留当前 Child 的静态 demand，不保存 collection 或 DOM。所有 DOM 只存在于目标 `products[].runs[].calls[].domEvidence`；capture 阶段的 Child 需求校验也只能从 `productCalls.<traceEntryId>` 派生，mapping 不接受独立 `children` 输入。它没有 Child 级 candidate/admit。旧 v5 capture/report 和所有 synthetic fixture 固定失效，不做双读或迁移桥。

定向合并只替换所选 `productKey`，未选产品对象原样保留；已从当前 Catalog 删除的历史对象也保留为 stale，当前 Catalog 新路由才追加为 `NOT_CAPTURED`。普通全报告 `validate` 返回 `projectionCurrent` 与 `staleProducts`，但不会因为未选产品或全局投影变化否决目标切片；`validate --require-complete` 才要求全局当前。产品 `candidate/admit` 始终只对所选 Product 做当前来源核对。

## 4. 产品准入

产品 candidate 绑定：产品路由、目标 Product 合同与源码、step scope、sourceSnapshotId、flowContractDigest、captureEpoch 和实际 evidence brief hash。它不绑定全局 `projectionRevision`、其它产品或 HEAD。

- 无 `--step`：要求至少一个完整合法 Product run，且每个页面调用完整。
- 有 `--step`：要求该步骤实际出现，且该步骤的所有页面调用完整。
- Product flow source 改变：`ADMISSION_PRODUCT_PROJECTION_STALE`。
- 缺调用 DOM：`ADMISSION_PRODUCT_EVIDENCE_INCOMPLETE`。

准入只证明报告事实可供本次代码判断使用，不产生质量结论。
