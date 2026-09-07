# 实证资料结构

## 1. 三层身份

同一份 report 明确分开三种身份：

- **`captureEpoch`**：昂贵、稳定的真实 Chrome 页面快照身份，只能由两个合法重采集触发器改变；
- **`projectionRevision`**：廉价、可重复的当前工程需求投影身份，代码和合同迭代时离线改变；
- **`childCandidateDigest`**：一次准入所消费的目标 Child 集合身份，随当前投影改变。

`report-tool.mjs` 处理 capture JSON 和仓库内唯一 report JSON。capture 保存原始页面事实；report 把同一快照离线投影到当前合同、实现、Product、Blueprint 和矩阵。scene 不绑定 candidate、matrix 或 demand digest。工程变化只使 `projectionRevision` 过期，运行 `refresh` 即可；只有真实消费冲突或人工明确触发才允许产生新 capture。

报告 schema 为 `gpt-page-operation-evidence.v5`，capture schema 为 `gpt-page-operation-capture.v5`，矩阵 schema 为 `gpt-page-operation-matrix.v4`。schema 只在字段格式不兼容时升级，不能把每次代码迭代伪装成 schema 升级。V1/V2/V3/V4 报告固定返回 `REPORT_LEGACY_INVALIDATED`。

## 2. capture JSON 字段形状

下面只展示字段形状，不是可通过校验的完整 capture。实际 `fixtureManifest.inputs`、`authorizedInputs`、`children` 与 `specimens` 必须覆盖矩阵声明的全集。

```json
{
  "schemaVersion": "gpt-page-operation-capture.v5",
  "capturedAt": "2026-09-05T00:00:00.000Z",
  "runId": "20260905-000000",
  "captureEpoch": "sha256:...",
  "recaptureTrigger": {
    "kind": "HUMAN_REQUESTED_RECAPTURE",
    "scope": ["text-main"],
    "requestedAt": "2026-09-05T00:00:00.000Z"
  },
  "browser": {
    "family": "chrome",
    "version": "...",
    "controlSkill": "chrome:control-chrome",
    "dedicatedQaTab": true,
    "qaTabCreatedByRun": true,
    "livePageObserved": true,
    "productionBrowserIdleEvidence": { "kind": "...", "sha256": "..." },
    "qaTabIdentityHash": "sha256:..."
  },
  "environment": {
    "locale": "zh-CN",
    "viewport": { "width": 1440, "height": 1000 },
    "theme": "light",
    "providerBuildMarker": "hash-or-visible-version"
  },
  "fixtureManifest": {
    "schemaVersion": "gpt-page-operation-fixtures.v2",
    "runId": "20260905-000000",
    "syntheticOnly": true,
    "inputs": {
      "synthetic-rich-text-prompt": {
        "kind": "SYNTHETIC_FIXTURE",
        "value": "...",
        "sha256": "sha256:...",
        "length": 3
      }
    }
  },
  "authorizedInputs": {
    "authorized-model-id": {
      "kind": "AUTHORIZED_FACT",
      "sourceKind": "PRODUCT_PROFILE",
      "sha256": "sha256:..."
    }
  },
  "chainInputs": {
    "chain-conversation-identity": {
      "kind": "PRIOR_CHILD_OUTPUT",
      "sourceChildCapabilityId": "reconcile_gpt_turn_submission",
      "evidenceRef": "task-owned-safe-ref",
      "sha256": "sha256:..."
    }
  },
  "children": [
    {
      "childCapabilityId": "write_exact_gpt_prompt",
      "projectionDigest": "sha256:...",
      "inputRefs": ["synthetic-rich-text-prompt"],
      "factBindings": [
        {
          "factId": "target:composer",
          "observationId": "observation-id",
          "pointers": ["core.targets.composer"]
        }
      ],
      "specimens": [
        {
          "stateId": "composer-before",
          "evidenceKind": "LIVE_PAGE",
          "capturedAt": "...",
          "observationId": "observation-id",
          "documentIdentityHash": "sha256:...",
          "targetIdentityHash": "sha256:...",
          "revision": 1,
          "stateFacts": { "composerState": "empty" },
          "stateSignature": "sha256:...",
          "core": {},
          "related": {},
          "peripheral": {}
        }
      ]
    }
  ]
}
```

`fixtureManifest.inputs` 必须与全部 `synthetic-*` 输入精确相等；`authorizedInputs` 必须与全部 `authorized-*` 输入精确相等；`chainInputs` 必须与全部 `chain-*` 输入精确相等，并绑定前驱 Child 的安全 evidence ref/hash。每个 Child 的 `projectionDigest` 和 `inputRefs` 必须与当前离线投影精确相等。Provider 生成的回复是 `LIVE_PAGE`，不得伪装成 fixture。

## 3. 三圈强制字段

每个 specimen 的 `core`、`related`、`peripheral` 都必须是非空对象。

每个 `LIVE_PAGE` specimen 还必须有唯一 `observationId`、`documentIdentityHash`、`targetIdentityHash` 和 `revision`。每个 `DERIVED_FIXTURE` 必须有 `derivedFromObservationId`、恰好一个变更项的 `mutation.changes` 和明确的 `expectedFailureCode`；来源必须指向同一 Child 的真实 observation。

### 核心圈 `core`

记录目标自身足以重建判定逻辑的事实：

- 归一化结构与经过清洗的 `outerHTML` 片段；
- 安全属性：`id`、`class`、`data-testid`、`role`、`aria-*`、`disabled`、`hidden`、`inert`、`type`、`tabindex`、`contenteditable`；
- `connected`、布局框、视口内状态；
- `display`、`visibility`、`opacity`、`pointer-events`；
- 动作目标的命中测试与可操作资格；
- 目标作用域、候选数量、选中理由、拒绝候选及理由。

机器字段固定为：`normalizedStructure`、`sanitizedOuterHtml`、`attributes`、`computedStyle`、`connected`、`layout`、`scope`、`candidates`、`targets`、`textProjection`、`actionQualification`。`targets` 必须逐项覆盖矩阵的 `liveStateTargets[stateId]`；每个 target 必须由该状态自己的唯一 scene 产生，并包含 selector 相关清洗 attributes、`observed: true`、有效 `identityHash`、非负 `nodeIndex`、`sourceSceneId` 与 `sourceSceneSignature`。候选数必须由现场枚举，不能固定写 1。

文本只允许三种表达：

```json
{ "kind": "SYNTHETIC_FIXTURE", "value": "...", "sha256": "...", "length": 12 }
{ "kind": "ALLOWLISTED_UI", "value": "Send", "sha256": "...", "length": 4 }
{ "kind": "HASH_ONLY", "sha256": "...", "length": 42 }
```

真实用户内容只能使用 `HASH_ONLY`；最好不要采集任何既有用户内容。

### 相关圈 `related`

记录为什么目标在这个上下文中成立：

- 到语义容器的祖先链、直接兄弟节点；
- 关联 trigger、panel、menu、turn、attachment card、media node；
- 动作前后归一化 DOM diff；
- 事件顺序、实际状态改变、正反 postcondition；
- Child 合同、实现文件、私有 query 规格和 Browser typed-command/WAL 安全投影的引用；
- 同一会话/同一动作的关联键，只能使用哈希化标识。

机器字段固定为：`ancestors`、`siblings`、`linkedNodes`、`beforeAfterDiff`、`contractReference`、`sourceReferences`、`postconditions`、`browserCommand`、`walProjection`、`transitionChain`。祖先、兄弟、关联节点三组不得全部为空。`transitionChain` 固定绑定前置 observation、typed command、terminal receipt、后置 observation 与直接 postcondition；纯观察 Child 的 command/receipt 必须显式为 `NOT_APPLICABLE`。

### 外围圈 `peripheral`

记录足以解释变体和失败边界的现场：

- 页面种类与清洗后的 URL identity，例如 `/c/sha256:<digest>`；
- locale、viewport、theme、Chrome 版本、provider build marker；
- 账号 UI 变体、模型 UI 变体、reasoning 档位规模；
- overlay、dialog、hydration、generation、rate-limit 等页面状态；
- 采集时合同版本和采集 run ID。

机器字段固定为：`pageKind`、`sanitizedUrlIdentity`、`locale`、`viewport`、`theme`、`chromeVersion`、`providerBuildMarker`、`uiVariant`、`pageState`、`runId`。

## 4. 稳定快照、需求投影与强制消费

每个页面 Child 的报告记录一个当前 `evidenceDemand`：完整合同事实、矩阵目标/状态/输入、动作证据链要求，以及实现、Product 消费者、现役 GPT 法案和 Blueprint 的逐文件内容 hash 与去注释归一化语义 hash。它是廉价离线投影，不是 capture 身份。`projectionDigest` 表示当前 Child 投影；`childCandidateDigest` 表示准入候选；二者都不会被生产代码读取，也不会使 `captureEpoch` 自动失效。

完整 capture 的 `factBindings` 必须覆盖需求事实全集。页面目标、live 状态和动作链只能使用 `LIVE_OBSERVATION`，必须指向本 Child 的真实 observation 与实际字段路径；合同、Product 授权、authority 等非页面事实可在离线刷新时使用 `CURRENT_PROJECTION`，并绑定当前 `projectionDigest` 与期望值 hash。派生状态必须能回溯到同 Child 的 live observation。报告不能用一个全局 `offlineIterationReady` 替代逐 Child 准入。

`validate --repo` 会重新生成当前需求投影并核对报告；`candidate --child` 为准确 Child 集合生成唯一 `CHILDSET` candidate。`admit` 的 `--candidate` 必填且只能等于该值，脏工作树不能用 clean HEAD 冒充。`admit --child` 只强制目标 Child，`--child all` 才要求 22/22。对有明确缺口的单个 Child，`candidate` 和 `admit` 可共同使用 `--facts` 消费已经观察并绑定的具体事实；未列范围、未知事实和未观察事实都失败关闭。`refresh` 不接收 capture，只从唯一报告的稳定快照离线重投影全部页面 Child；缺少页面事实时返回 `PAGE_EVIDENCE_GAP`，不得自动进入浏览器。

## 5. 重采集触发记录

capture 必须含下列二者之一：

- `HUMAN_REQUESTED_RECAPTURE`：包含非空 `scope` 与 `requestedAt`；
- `PAGE_EVIDENCE_CONFLICT_CONFIRMED`：包含非空 `affectedSceneIds`，以及同一事件的 `codeEvidenceHash`、`logEvidenceHash`、`pageReadbackHash`。

缺失或使用其它 kind 时固定返回 `RECAPTURE_FORBIDDEN`。provider build marker 只保留在外围圈作为风险信号，不能单独授权采集。

## 6. 证据种类

- `LIVE_PAGE`：在本次专用真实 Chrome QA 标签页上直接观察。
- `DERIVED_FIXTURE`：基于已清洗的 LIVE_PAGE 样本生成的确定性测试变体。

矩阵中的 `requiredLiveStates` 必须由不同 `sourceSceneId` 的 `LIVE_PAGE` 覆盖；内容签名排除 stateId、sceneId、时间戳和自报 command 等元数据，同一 DOM 不能靠改状态名伪装成不同现场。矩阵状态断言必须与实际字段一致。三个 terminal error 是 required live，绝不能由 `DERIVED_FIXTURE` 顶替。

## 7. 完整度状态

- `NOT_CAPTURED`：只有静态盘点。
- `CAPTURE_PARTIAL`：有 capture，但分母、状态或三圈不完整。
- `CAPTURE_COMPLETE`：所有硬性采集条件完整；仍须 `admit` 才表示目标 Child 可被当前候选消费。

报告固定包含 `claimsQualityVerdict: false`。任何完整度状态都不是 AGENT 原生 quality verdict。

## 8. 禁止内容

- 原始 `/c/<conversation-id>`；
- Cookie、localStorage、sessionStorage、密码、Authorization header、access/refresh token；
- 用户既有提示词、回复、附件名或媒体内容；
- 生产 Browser 标签页的 DOM 快照；
- 可被生产代码读取的 selector registry、第二快照库或兼容 fallback。
