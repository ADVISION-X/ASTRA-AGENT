---
name: gpt-page-operation-evidence
description: 由 Codex 使用 Chrome 插件，按 Product Plugin 的真实生产资料与完整流程采集 GPT 页面 DOM；生成唯一的产品流程实证报告，并支持按产品、Action、步骤或 Child 定向回看。不得生成业务夹具，不得自动代跑产品，不得绑定 Git HEAD。
---

# GPT 产品页面实证采集

本 Skill 只做一件事：Codex 拿到 Website 已冻结的真实生产资料，逐行跟随 Product Plugin 的现役流程，用 `chrome:control-chrome` 完成页面操作并收回真实 DOM。报告按 `产品 → Action → 产品步骤 → 调用序号 → Child → DOM` 组织；需要按 Child 查询时，现场从产品调用记录计算，不另存反向索引。

唯一链路：

```text
Website 冻结生产任务和资料
  → Product Plugin 提供现役流程与真实 prompt/profile/附件
  → Codex 使用 Chrome 插件原样复刻
  → 每个页面 Child 采 pre DOM / 操作回执 / post DOM
  → 唯一报告
```

## 不可突破的边界

- Product Plugin 是步骤、顺序、分支、模型、推理档位、prompt、附件和 continuation 的唯一 Owner。Skill 只读合同、源码与 trace，不实现第二个 Product runner。
- 页面动作只能由 Codex 通过 `chrome:control-chrome` 执行。禁止增加自动化 Worker、运行时 hook、定时器、后台抓取器或终端 Playwright/CDP。
- `production-source.mjs` 只离线校验任务、材料字节、Product 合同与已落盘 trace；它没有浏览器能力，不能点击、输入、上传、提交或重跑任务。
- `chrome-scene-collector.mjs` 只能由当前 Codex 在 Chrome 插件会话中导入，并按一次明确的 Child 调用执行一次采集；它不是 CLI，没有自主选任务、遍历产品、调度或后台运行入口。
- 禁止合成业务 prompt、合成附件、模拟对话冒充产品覆盖。测试代码可以使用明确标为 test-only 的结构夹具，但测试夹具绝不能进入报告。
- 不新增第二报告、第二矩阵、第二 selector 系统、DOM 数据库、回放平台、队列、服务或质量裁决。
- 报告不绑定 Git HEAD、分支、clean 状态或整个工作区摘要。Git 信息不得参与有效性判断。
- 报告不是生产运行时输入，也不是 `READY`、`RELEASE`、Website 入库或质量结论；这条边界由 Skill 与质检合同负责，不在每份报告重复保存固定布尔值。

## 启动后先选模式

1. `inventory-only`：只盘点产品路由、采集合同、页面 Child 和缺口；不打开 Chrome。
2. `collect-product`：用户明确要求采集或刷新某个产品。最小范围是完整 `productId + actionId`；静态本地化还必须包含一个 locale 的全部 cohort 及 A/B/盲选三轮。
3. `offline-iterate`：故障修复前按产品或具体步骤读取报告并执行 `candidate → admit`；不打开 Chrome。
4. `feedback-update`：代码或合同变化后只做离线重投影、目标测试和唯一 `quality:check`；缺 DOM 就报告精确缺口，不自动采集。

## 强制入口

开始时读取：

- `src/capabilities/gpt/page-operation-matrix.json`
- `docs/项目方案/GPT页面操作子能力实证资料.json`
- 本目录 `references/evidence-schema.md` 与 `references/collection-protocol.md`
- 目标 Product 的 `SKILL.md`、`page-evidence-contract.json` 和合同列出的 `flowOwnerSources`
- 当前 GPT 法案、GPT Blueprint 和 `src/capabilities/gpt/contract.ts`

先盘点。报告会列出生产 Catalog 的全部路由；目前 SEO 与本地化有精确采集合同，其余产品必须明确显示 `PRODUCT_EVIDENCE_CONTRACT_NOT_IMPLEMENTED`，不得从通用 Child 场景推断为已覆盖。

```bash
node --import tsx .agents/skills/gpt-page-operation-evidence/scripts/report-tool.mjs inventory \
  --repo /Users/nexgen/Documents/AGENT \
  --matrix /Users/nexgen/Documents/AGENT/src/capabilities/gpt/page-operation-matrix.json \
  --read-only
```

## 生产资料准入

采集前必须从 `.grasseye-local/production-runtime.sqlite` 选定一个真实 durable task 和一个实际 attempt。不得由 Skill 新造业务资料。用离线校验器生成仓库外 source manifest：

```bash
node .agents/skills/gpt-page-operation-evidence/scripts/production-source.mjs \
  --repo /Users/nexgen/Documents/AGENT \
  --runtime-db /Users/nexgen/Documents/AGENT/.grasseye-local/production-runtime.sqlite \
  --task-root /Users/nexgen/Documents/AGENT/.grasseye-local/plugin-tasks/production-runtime \
  --forensics-root /Users/nexgen/Documents/AGENT/.grasseye-local/forensics \
  --browser-db /Users/nexgen/Documents/AGENT/.grasseye-local/browser/browser-mutations.sqlite \
  --job-id exact_production_job_id \
  --attempt-id exact_attempt_id \
  --output /absolute/outside-repo/production-source.json
```

只有同时满足以下条件才可打开 Chrome：

- `sourceKind=PRODUCTION_RUNTIME_DURABLE_TASK`、`synthetic=false`；
- task 的 `job_id/request_hash/product/action/plugin/version` 相互一致；
- material 目录与 task `material_refs` 文件集合完全相等；
- 每个文件名、role、ordinal、bytes 和 sha256 精确相等；
- 目标 Product 的 `page-evidence-contract.json` 与当前 Plugin 身份一致；
- forensics trace 每一行都属于同一 job/attempt/plugin，Child、ordinal、exact call identity 与完整性哈希一致；
- 每条新生产 forensics 必须带该调用的 `input_hash` 与安全 `page_input_role_hashes`。后者只含 prompt/response、附件显示名集合、模型、推理要求、会话 URL、turn marker 和 assistant turn identity 的哈希或非敏感枚举；不得保存正文；
- 已接受生产 attempt 的 durable forensics 是历史实际调用顺序的唯一真相；当前 Product 合同和源码只说明“今天的流程投影”，不得反向淘汰旧 attempt 的真实 trace；
- Browser receipt 存在时，它的 step/Child/ordinal 必须与同一 exact call 一致，`callId` 只从该真实回执取得；没有回执时写 `null`，不得从手写表补造；
- Browser receipt 的 `request_hash` 与 forensics `input_hash` 必须相等。旧历史记录若只有 Browser request hash，只能标为 `BROWSER_MUTATION_RECEIPT_ONLY`；没有逐角色输入哈希时不得反推 prompt、附件、profile 或 continuation，也不得成为完整采集；
- 当前 attempt 的完成分支必须有当前 task 行的 durable `result_json` 哈希回执；指定历史 attempt 时，绝不能借用当前 task 行的 status/result。历史失败只认 `production_attempt_failures(job_id, attempt_id)` 的精确记录，并与该 attempt 最后一条 failed trace 做时间、Child/evidence（记录声明时）关联；没有该 attempt 自己的 durable terminal 就固定为 `PARTIAL/DURABLE_ATTEMPT_TERMINAL_UNAVAILABLE`；
- source manifest 不含 HEAD、分支或 worktree 绑定。

任一失败都在浏览器前停止：`PRODUCT_INPUT_INCOMPLETE`、`PRODUCT_MATERIAL_BYTE_MISMATCH`、`PRODUCT_FLOW_TRACE_MISMATCH` 或 `PRODUCT_FLOW_CONTRACT_*`。

## Codex + Chrome 的采集方式

进入真实 Chrome 前必须读取 `chrome:control-chrome` Skill。Codex 只操作本轮明确绑定的采集标签页；不得接管系统生产标签页或用户其它标签页。Skill 不自动触发 Product，不注册后台监听。

Codex 必须把 source manifest 的 `actualTrace` 当成该生产 attempt 的逐调用采购清单，并读取 Product 现役源码理解每次调用。合同中的阶段拓扑只生成 `flowProjectionStatus/flowProjectionGaps`，不改写历史清单。`exactCallIdentityHash` 标识同一个逻辑调用；同一逻辑调用发生失败后重试时 hash 可能相同，因此每条实际 forensics 记录另有唯一 `traceEntryId`。同一个 Child 在不同步骤、不同 cohort 或同一逻辑调用的不同尝试中重复出现时，必须分别采集，绝不能共用一份 DOM。

每条调用的页面状态分母由 `actualTrace.resultStatus + mutationOutcome + 已落盘 Browser 观察` 和矩阵共同派生，不能由 mapping 挑选：`confirmed/dispatched` 必须收齐该分支的 pre/post；成功 `no` 只要求 already-satisfied/steady 状态；失败 `no` 且根本未进入 Browser 时状态分母为零，以空 specimen 和 durable failure 明确表示“没有可采 DOM”，不得强造页面证据，也不要求 input↔DOM 匹配。其它调用即使整条未映射，报告也必须保存派生状态清单并逐项报缺口。

每个页面调用至少采购：

- 身份：product、action、step、actionOrdinal、Child、exact call hash、traceEntryId、sourceSnapshotId、flowContractDigest、captureEpoch；
- pre：Document/revision、候选基数、每个候选接受/拒绝理由、目标节点清洗后的 outerHTML/属性/可见性/尺寸、必要父兄/label/menu/dialog、页面状态；
- action：Browser typed command、准确目标、mutation outcome、terminal receipt；纯观察必须明确 `NOT_APPLICABLE`；
- post：全新 observation、直接后置条件、DOM 差异、错误/生成/上传状态和产物引用哈希。
- target qualification 失败：候选不得冒充成功 target，但只要真实 scene 里存在候选，就必须在同一 call 的 specimen 中以 `observed:false + diagnosticDom` 保留其清洗 DOM 和拒绝原因；不得因为 hidden/inert/ambiguous 而删掉故障现场。
- input binding：从该 `traceEntryId` 的生产证据读取 `input_hash` 和逐角色期望哈希；从 Chrome DOM 机械读取 exact composer/user prompt、附件 aria-label 集合、模型文字、推理 scale/current、canonical conversation、assistant semantic response 与 turn identity 的实际哈希；逐角色相等后才写 `MATCHED`。prompt 证据必须服从 Child/状态：写入与 draft reconcile 只认对应 composer 状态，submit 与 submission reconcile 只认目标 post-submit user turn，continuation 只认同一 prompt/response/marker/assistant tuple；页面其它旧 turn 或其它状态的同文哈希不得替代。

短 user prompt 没有 `collapsible-user-message-content` 时，只允许在同一个唯一 user turn 内取唯一 `.whitespace-pre-wrap` 叶节点；多 turn、多候选或跨页面全文搜索一律失败关闭。历史 trace 缺逐角色哈希时，即使 Codex 能从 Product 资料重建同一调用并核对 exact call hash，也只能用于安全操作，不能反向把公共报告的 input binding 写成 `MATCHED`。

原始 prompt、报告正文、文章内容、会话 ID、Cookie、token 和隐私材料不得进入公共报告。业务 turn/composer/普通容器即使文字恰好等于“高”“复制”等 UI 词也必须 hash-only；UI 明文白名单只有同时命中明确的 button/menuitem/slider 等 UI 语义才可放行。会话 URL 必须变成 `/c/sha256:<digest>`。

`exactCallIdentityHash` 只证明生产调用身份，不能单独证明当前 Chrome 页面就是该输入。每个实际调用还必须有 `gpt-page-input-binding-proof.v1`：`inputHashBound=true`，并且该 Child 需要的 prompt、附件集合、model、reasoning、conversation、response/turn 等 checks 全部为 `MATCHED`。任一期望哈希缺失或 DOM 不相等都固定产生 `PAGE_INPUT_BINDING_GAP:<role>`，该调用不得 `captureComplete=true`。本地化 candidate-a、candidate-b、selector 的 profile 以各自 `traceEntryId` 为准，禁止拿“插件支持过的所有 profile 变体”冒充本次实际选择。

scene mapping 必须使用：

```text
productCalls.<traceEntryId>.states.<requiredLiveState> = <sceneId>
```

这保证重复 Child、以及 exact call hash 相同的失败/重试记录，仍能分别反查到准确产品步骤和 DOM。缺少映射时写：

```text
PAGE_EVIDENCE_GAP:<productStepId>/<ordinal>/<childId>:product-call-scene-map-missing
```

不得借用另一个步骤、产品或旧 synthetic scene 填满。

## SEO 精确流程

`public_knowledge_article_pipeline/produce_article` 的真实输入至少包含 Website task envelope 和唯一 `ready_corpus_archive`；ZIP 的内部语料、索引、语义目录、主题集群及结果合同由 Product 现役校验负责，Skill 不另造精简包。

Codex 按 Product trace 复刻：

1. `corpus_research`：新对话 → profile/model/reasoning → 完整 ZIP 上传与精确集合核对 → 真实研究 prompt → draft → 单次 submit → submission readback → stable text → checkpoint → continuation。
2. 只有 Product durable result 对象的 `research.decision=decline` 才能合法终止在研究分支；必须从 `result_json` 回执指向的 production outbox `result_payload` 读回，并逐项核对 object ref、bytes、sha256 与 receipt；不得根据只出现一个阶段、调用数量或当前流程投影猜测 decline。
3. `article_synthesis`：获取同一 continuation → 身份/profile 核对 → 真实文章 prompt → draft/submit/readback/stable text/checkpoint → 推进 continuation。
4. `article_image_generation`：同一 continuation → profile → 真实图片 prompt → draft/submit/readback/stable image/checkpoint → 读取图片产物 → Product 组包。

不得用新模拟对话替换 continuation，不得跳过失败步骤，不得为补齐报告强造文章或图片分支。

任一阶段真实失败时，产品流程合法终止为 `terminalBranch=production-failure`。若截至失败点的每个实际页面调用 DOM 都已采全，该 run 可标记 `CAPTURE_COMPLETE`；含义仅是故障现场完整，绝不等于 SEO 生产成功。

## 本地化精确流程

报告/文章本地化及 challenge/reflection：使用 Website task 声明的完整材料集合，新对话，准确 profile/model/reasoning，全部附件精确核对，真实 Product prompt，draft/submit/readback/stable text/checkpoint，最后由 Product 结果合同解析。

`localization_static_catalog/produce_locale_catalog`：唯一 `static_catalog_input` 文件决定 target locale、全部 `context_bundles` 和准确 cohort 数。每个 cohort 必须依次完整采集：

1. `candidate-a` 独立新对话；
2. `candidate-b` 独立新对话，使用同一冻结输入；
3. `selector` 独立新对话，消费冻结的 A/B 映射；
4. 完成解析、消息数核对，再进入下一个 cohort。

最小合法定向范围是一个 locale 的全部 cohort。少一个 cohort 或少 A/B/selector 任一轮，产品切片只能是 `CAPTURE_PARTIAL`。

## 装配与唯一报告

装配器只把 Codex 已经通过 Chrome 收回的 scene 与真实 source manifest 对齐，不执行页面动作。默认采集范围必须由 `actualTrace` 中真实出现的页面 Child 去重得到，不能拿全局 Child 分母代替；可选 `--child` 只能收窄到这个真实集合，未采调用仍如实形成缺口。失败 source 缺少 attempt 专属 `terminalBranchProof` 时直接拒绝；装配器不得补造或从当前 task 状态推断。`chrome-scene-collector.mjs` 不是终端命令；只能由 Codex 已连接的 Chrome 插件会话逐调用使用：

Browser 命令返回不等于页面动作成功。transition receipt 必须带布尔 `postconditionPassed`；`false`、禁止的 document transition、或状态断言不成立时，装配器保留 post scene 的真实 DOM 并写 `PAGE_EVIDENCE_CONFLICT:*`，该调用和产品均不得完整。只有 receipt 结构、时间顺序、pre/action 关联或采集身份本身无效时才拒绝整包。当前输入步骤失败时必须停在 submit 之前，后续调用只报未采，禁止为补报告继续提交。

```bash
node .agents/skills/gpt-page-operation-evidence/scripts/assemble-live-capture.mjs \
  --inventory /absolute/outside-repo/inventory.json \
  --matrix /Users/nexgen/Documents/AGENT/src/capabilities/gpt/page-operation-matrix.json \
  --scenes /absolute/outside-repo/scenes.json \
  --mapping /absolute/outside-repo/product-scene-map.json \
  --production-source /absolute/outside-repo/production-source.json \
  --browser-meta /absolute/outside-repo/browser-meta.json \
  --output /absolute/outside-repo/capture.json
```

按产品原子替换唯一报告中的一个切片：

```bash
node --import tsx .agents/skills/gpt-page-operation-evidence/scripts/report-tool.mjs merge \
  --repo /Users/nexgen/Documents/AGENT \
  --matrix /Users/nexgen/Documents/AGENT/src/capabilities/gpt/page-operation-matrix.json \
  --capture /absolute/outside-repo/capture.json \
  --base-report /Users/nexgen/Documents/AGENT/docs/项目方案/GPT页面操作子能力实证资料.json \
  --product exact_product_id \
  --action exact_action_id \
  --output /Users/nexgen/Documents/AGENT/docs/项目方案/GPT页面操作子能力实证资料.json
```

只替换同一产品/Action/sourceSnapshot 的 run；其它产品切片原样保留。即使某旧产品路由已从当前 Catalog 删除，其历史切片也原对象保留并单独显示 stale，不能在目标产品更新时顺带丢失；当前 Catalog 新增路由才追加 `NOT_CAPTURED`。Child 反查只能临时遍历 `products[].runs[].calls[]`，不得写入报告。

浏览器、环境、recapture trigger、scene binding、decision receipt、transition receipt 与公共 production source 全部使用精确字段白名单；多一个调试字段、明文 prompt/body/content 也拒绝。合并器会重新计算每个 specimen 和每个 product call 的完整 envelope，并重新建立 `sourceSceneId → traceEntryId` 唯一归属；同一 scene 被两个实际调用复用时，即使装配阶段曾通过，也不得进入报告。

报告中的历史产品即使已经从当前 Catalog 删除、Product 源码或页面矩阵已经变化，也必须继续执行自身一致性校验：每个 call 固定采集当时的 states/targets/assertions/required input roles/Child transition contract，并用该快照重算 production source/trace/input binding、capture context、scene/specimen/call envelope、scene 唯一归属和 captureComplete。今天的矩阵只决定 projection stale，不能用新规则淘汰历史，也不能借 stale 绕过篡改检查。

## 故障回看与准入

SEO 或本地化故障优先按产品步骤取证：

```bash
node --import tsx .agents/skills/gpt-page-operation-evidence/scripts/report-tool.mjs candidate \
  --repo /Users/nexgen/Documents/AGENT \
  --matrix /Users/nexgen/Documents/AGENT/src/capabilities/gpt/page-operation-matrix.json \
  --report /Users/nexgen/Documents/AGENT/docs/项目方案/GPT页面操作子能力实证资料.json \
  --product public_knowledge_article_pipeline \
  --action produce_article \
  --step corpus_research
```

把返回的 `PRODUCT:<digest>` 原样传给 `admit`。全产品准入省略 `--step`；它要求完整合法分支和全部页面调用完整。步骤准入只要求该步骤已出现且每个页面调用有完整 DOM，不能拿一个通用 Child 样本顶替。

共享 Child 只能从 `products[].runs[].calls[]` 临时反查受影响的产品调用；`candidate/admit` 强制要求 `--product + --action`，不存在 Child 级第二套准入结论。

## 更新与失效规则

- `sourceSnapshotId` 只绑定 task 参数与实际材料字节。
- `flowContractDigest` 只绑定目标 Product 合同/源码和该 trace 实际调用的 Child 源码。
- `captureEpoch` 只绑定本次人工 Chrome 采集。
- 产品 candidate 只绑定该产品合同、该产品 run 和可复核 DOM；全局 `projectionRevision`、其它产品、HEAD 与 generatedAt 都不参与。
- HEAD、branch、clean、全仓 digest、generatedAt 不参与有效性。
- 无关文件或 HEAD 变化：报告继续有效。
- 某 Product 流程变化：历史 run 与其派生的 captureStatus/gaps 不改写；`validate`/admission 只把该产品列为 projection stale，先离线 refresh 或按新生产 attempt 重采。
- 新需求能从旧 DOM 得出：只重投影，不开 Chrome。
- 旧 DOM 缺字段：记录具体产品步骤的 `PAGE_EVIDENCE_GAP`；只有用户明确要求，Codex 才用 Chrome 定向重采该完整产品 Action。

旧 v5 合成报告一次性失效；不得保留双读、转换桥或把旧 synthetic scene 搬入 v6。新的 canonical 报告从 `inventory --output` 生成诚实的 `NOT_CAPTURED` 基线。

离线 refresh 同样强制产品范围：`refresh --product <productId> --action <actionId>`。它只重算该产品投影并原样保留其它产品；不接收 `--child`，也不打开 Chrome。

## 自验

修改本 Skill、合同、矩阵、采集器或报告工具后运行：

```bash
python3 /Users/nexgen/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  /Users/nexgen/Documents/AGENT/.agents/skills/gpt-page-operation-evidence
node --import tsx .agents/skills/gpt-page-operation-evidence/scripts/report-tool.mjs inventory \
  --repo /Users/nexgen/Documents/AGENT \
  --matrix /Users/nexgen/Documents/AGENT/src/capabilities/gpt/page-operation-matrix.json \
  --read-only
node .agents/skills/gpt-page-operation-evidence/scripts/production-source.acceptance.mjs
node .agents/skills/gpt-page-operation-evidence/scripts/report-tool.acceptance.mjs
node .agents/skills/gpt-page-operation-evidence/scripts/pipeline.acceptance.mjs
```

最后运行目标仓唯一 `quality:check -- CHANGE`。这些检查都不打开 Chrome；真实采集只由用户明确要求后，Codex 使用 Chrome 插件执行。
