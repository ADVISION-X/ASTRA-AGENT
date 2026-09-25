# GPT 页面采集 SKILL-完整实现方案

## 状态、目标与授权边界

状态：已在同一专用 QA Chrome 会话真实发送 SEO research、article、image 及 zh-HK、zh-TW、en-US、ja-JP、ko-KR 各一次，共八轮。五语复用另一篇历史文章的完整五张真实工单及资料；最终证据仍为 `CAPTURE_PARTIAL`，保留未观测的 Child 调用和字段缺口。本方案及 Skill 扩展正在接受独立只读审计；此状态不是质量 PASS、READY、RELEASE 或生产放行。授权限于本轮真实 Chrome/Provider 采集、固定真实资料包及本 Skill/两份报告的迭代；不修改 GPT/Product/Browser 生产代码、法案、施工图或 Website 任务。

目标：一次专用 QA 会话以 SEO research → article → image 加五语 article translation 共八个真实 Provider turn 采集共享 GPT 页面 DOM，不逐个产品采集。五语固定为 zh-HK → zh-TW → en-US → ja-JP → ko-KR，各自使用其历史真实 Website 工单及四份原始资料包；它们来自另一篇已完成的历史文章，故本次 QA 八轮只证明同一页面会话的连续操作与 DOM，不证明 SEO QA 输出是五语业务源文，也不证明生产 Browser WAL、parent 链、Website admission 或 locale release。操作前冻结全部页面 Child 清单和固定宽字段；每次证据修订只追加唯一 JSON，落盘立即生成独立 DOM 与代码差距报告。完整覆盖只表示本次计划内页面操作的证据齐全，不表示其它 Product 的业务完成、`quality:check`、READY 或 RELEASE。

本方案的施工面限于 `.agents/skills/gpt-page-operation-evidence/**`、唯一 JSON 证据报告、必要的派生差距报告及这两个新文档路径的精确 Manifest 归属；生产子能力、Product Plugin、Browser Authority、Forensics、Runtime、Website 和生产质检入口均不因采集工具增加 hook、trace、字段、存储或副作用。本轮真实采集已由用户明确提出。首次 Website/AGENT/对象存储原字节核验后，固定原 ZIP 和来源摘要进入本 Skill；后续每轮只校验固定包、来源哈希、现役路由及 Product 源码，不重复搜索数据库工单，也不把首次历史核验说成每轮实时核验。

## 候选与输入事实

- 需求 Owner：AGENT 的 GPT 工具资料；项目根 `/Users/nexgen/Documents/AGENT`，`main`，设计基准 HEAD `3823c8f8a181778330eac957aeeea9ab923d7e8c`，tracking `origin/main`。Website 仅作历史真实工单/资料包的只读来源，`/Users/nexgen/Documents/xuanxue-web` 当前 `main`、HEAD `695ddbbe0`；相关来源为 `services/api/src/public-knowledge/execution-service.ts`、`services/api/src/ai-production/{website-agent-task-repository,material-asset-lifecycle}.ts` 的任务创建和材料绑定合同，当前这些路径没有 dirty overlay。施工前重绑两仓这些事实与相关文件内容；方案文件自身只记录文档 hash，不参与源码候选。Website 不进入施工修改范围。
- 已核对的工具来源：`SKILL.md`、`references/page-operation-matrix.json`、`references/evidence-schema.md`、`references/collection-protocol.md`、两个 `references/product-flow-projections/*.json`、`scripts/{production-source,chrome-scene-collector,assemble-live-capture,report-tool,page-input-binding,trace-page-requirements}.mjs`、三个 `*.acceptance.mjs` 和 `docs/项目方案/GPT页面操作子能力实证资料.json`。施工前按 scoped Git 状态和内容 hash 重绑；这是施工前基线；当前 Skill 工具与报告已有本轮授权改动，实际内容以本轮 Git 状态和 digest 为准。
- 权威：`.github/instructions/agent-rules/功能法案.md` 的现役 `LAW-GPT-001-V62`、`LAW-GPT-002-V28` 与 Browser 唯一 Authority 相关条款；`docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md` 的 V66 Owner、页面事实和安全边界；`scripts/audit/domains/gpt/manifest.json` 的工具与证据文件 Owner；`src/capabilities/gpt/{child-types,contract}.ts` 的现役 Child 集合和合同；Website 的原始 `ai_production_jobs` 与 `ai_production_job_materials` 是历史任务和资料身份的来源。Product 是业务步骤/prompt/profile/附件/分支 Owner；Browser 是生产 Target、Document、WAL 和物理动作 Owner；本 Skill 仅拥有离线采集资料与报告。
- 当前 `src/capabilities/gpt/contract.ts` 和 GPT Blueprint 有用户未提交改动。不得覆盖、恢复或搬动；施工前必须以最终被授权的同一候选同时重验两者。施工前矩阵有 14 个条目，彼时 `inventory --read-only` 返回 `PAGE_OPERATION_MATRIX_DRIFT`：缺 `open_gpt_model_selector_v3`、`select_gpt_model_from_start_v3`、`select_gpt_reasoning_from_start_v3`，多出对应旧 `v2`/`ensure_gpt_reasoning_requirement`。该缺口已在本轮修正；发送五语前须再次只读运行 inventory 并以当前合同重核。
- 施工前唯一报告为 `gpt-page-operation-evidence.v7`，40 个产品路由中 38 个 `NOT_CAPTURED`、2 个 `CAPTURE_PARTIAL`，已有 3 个历史 run。报告约 2.3 MB；旧数据是历史事实，不得用新版重算出伪完整。`production-source.mjs` 对现役 artifact-only forensics 得不到逐 Child `actualTrace`；`SKILL.md` 第 73–91 行要求 trace 非空才开 Chrome；`assemble-live-capture.mjs` 第 640 行后的 source 校验同样硬拒绝空 trace。施工前 `report-tool.mjs:1825-1853` 对同一 `sourceSnapshotId` 的 run 使用替换而非追加；本轮已升 v8 追加 SEO 三轮部分版。
- 相关旧方案 `docs/项目方案/GPT附件集合实证与采集兼容-完整实现方案.md` 只处理附件身份和旧生产 attempt 的诚实取证，其“无 trace 不可冒充历史调用”仍有效；其 W3 关于新采集也一律停止的工具路径由本方案替换，不能把此替换理解为允许回填旧 attempt。`docs/项目方案/SEO文章同聊天五语翻译-完整实现方案.md` 的五张独立 Website job、顺序 parent、Browser WAL 与逐语 admission 合同只作现役边界引用；本轮 QA 不操作或裁决这些生产对象。
- 有限回归筛查：同一工具在近期提交中多次从 Child 通用样本转向 Product 真源、从旧记录转向 artifact-only；此前验收的“不得用模拟业务资料、不得把独立 Chrome 会话冒称历史 attempt、不得重放未知 Provider effect、不得建立第二事实源”继续保留。未发现本方案需恢复已退役的 record ledger。施工前 `report-tool.mjs` 2278 行、装配器 933 行，方案必须把新增独立职责移出过大的函数，不在旧分支上叠加第二套平行管线。

## 四维映射与第一断裂

| 需求 | 法案/施工图边界 | 当前实现与第一断裂 | 质检与读回 |
| --- | --- | --- | --- |
| 固定子能力清单及宽字段 | Child 本地合同唯一 Owner；工具矩阵只投影需求，不是生产 selector | 矩阵仍含 3 个退役名称；运行前清单由实际 trace 缩成已出现 Child | `inventory --read-only` 必须精确等于现役页面 Child；SEO 未触发的 Child/状态保留 `NOT_REACHED` |
| 真正的运行态 DOM | Product 决定流程，Browser 决定生产动作；Codex 只用 Chrome 插件操作自己的专用采集标签页 | 空 `actualTrace` 在 Chrome 前硬停止；历史 attempt 与新采集没有类型区别 | 实际 Browser 前/命令/后回执；同一采集会话读回，失败状态保留 |
| 连续版本 | 只有一份公共 DOM 事实报告，无第二存储真相 | 同 `sourceSnapshotId` run 被替换，旧报告按产品组织 | 新八轮共享样本仅存一处；新版可查，旧版对象及摘要不变；重复提交幂等 |
| 立即代码对照 | 工具只能指出代码差距，不能改 Child 或给生产 verdict | 现有 `candidate/admit` 只查产品报告，不产出逐事实代码差距 | 独立派生报告引用 exact capture 版本和代码文件 digest；逐差距有 DOM 与源码指针 |

第一直接断裂是证据工具把“回看既有生产 attempt”与“新启动一次真实 SEO Chrome 采集”共用 `PRODUCTION_RUNTIME_DURABLE_TASK + actualTrace` 准入。前者确实需要既有 trace；后者的实际调用与 DOM 只能在本次执行时产生。用现役 Product 源码推断**历史**调用仍禁止；以冻结的 SEO Product 流程指导**新的**采集并保存刚发生的调用回执则是新来源，必须显式区分。

## 唯一主链、身份与有限分母

```text
现役 Child 合同 + 单份矩阵 -> 冻结全部页面 Child 清单/字段/需求摘要
  -> 只选 Website 历史真实 SEO produce_article，逐字节核完整资料包并冻结路由/Product 生成规则
  -> research 发送前冻结其 exact 输入；收到真实回答后由 Product 现役 parser 验证
  -> article 发送前按已验证 research 冻结 exact 输入；再验 article 回答
  -> image 发送前按已验证 article 冻结 exact 输入；Codex 在专用 Chrome 标签页真实发送/观察
  -> 只读核五张完整历史翻译工单及每张四件原材料，固定在同一 Skill
  -> 用现役 localization Product 的封闭内存 probe 捕获各语 exact prompt
  -> 同一 QA 会话顺序真实发送 zh-HK、zh-TW、en-US、ja-JP、ko-KR；逐语解析与连续 turn 读回
  -> 每个现场 Child 调用绑定 pre/command/post、Document、scene、输入角色 hash
  -> 装配与校验 -> 唯一证据报告追加同一 QA run 的共享 Child 修订（SEO+五语分段来源）
  -> 同 revision 的 DOM 与当前 Child/Browser 代码逐条对照
  -> 独立派生差距报告 + 回读两个 artifact
```

身份脊柱：`planDigest → captureRunId → stepId（SEO 3 + locale 5）→ sourceJobId/materialDigest → observedCallId → childId → stateId → sceneId/documentIdentity/observationRevision/conversationUrlHash → evidenceRevisionId → codeSnapshotDigest → comparisonId`。`observedCallId` 由本次真实 Chrome 调用/回执产生，不由预排 ordinal 冒充；同名 Child 重复调用不能共享 scene。SEO 与五语各绑定自身历史业务输入，均不是本次 QA 的 Website 业务结果；历史 attempt 继续使用原 `traceEntryId`，不得互填。

冻结清单的分母取当前合同中 `requiredTargetKind=chatgpt` 的所有页面 Child；矩阵必须逐项对应。每个 Child 固定列出 `requiredLiveStates`、可选/故障状态、core/related/peripheral 目标、状态断言、关联代码消费者及字段集。字段集只复用现有采集器的安全字段：采集身份和时间、清洗 URL/Document/revision、候选基数与逐候选接受/拒绝理由、清洗目标 outerHTML/属性、父兄及 label 关系、可见性/布局/禁用、状态事实、输入角色 hash、前/命令/后和直接后置。不得用“宽字段”为理由保存整页 DOM、原始 prompt、正文、Cookie、token 或原始 conversation URL。每格结果只取 `OBSERVED`、`NOT_REACHED`、`NOT_APPLICABLE`、`CAPTURE_GAP`、`CONFLICT`，并附原因；空值不自动等于缺失或成功。当前 14 个页面 Child 中 `acknowledge_known_gpt_rate_limit` 是仅异常触发的内部能力；一次正常 SEO 流程不触发就固定 `NOT_REACHED`。其它未出现状态同理。单次 `CAPTURE_COMPLETE` 只覆盖本次八轮实际可达页面路径，不得以共享样本证明其它产品、错误或限流分支已发生。

真实采集入口有两种严格不混同的来源：

1. `HISTORICAL_ATTEMPT`：保留现役 `production-source.mjs` 的真实 durable task/material/terminal/逐 Child trace 校验。无 trace 则历史页面证据继续 `PARTIAL/NOT_CAPTURED`，不得借新采集补它。
2. `LIVE_SEO_CAPTURE_SESSION`：同一个专用 QA 会话只有 SEO 三轮与 `localization_article_translation/article_translation` 五语五轮两种允许的真实输入。SEO 原始历史工单/ZIP 的核验、现役 prompt/parser、唯一相邻 assistant 与 hash-only scene 规则如上；历史工单均不认领、重启、恢复或回填本次 QA 结果。五语输入只能是上述五张完整历史工单，逐张四材料原字节核验并固定保存，真实 source 切换显式记录。`promptFor` 为私有函数，采集器只能通过现役 `executeOwnedFlow` 的封闭 probe context，在 `write_exact_gpt_prompt` 捕获 prompt 后以 sentinel 终止；probe 不进行 Chrome/Provider 操作，也不生成业务/采集证据。probe context 必须提供真实 task、routePolicy、resultRevision、Product Skill 原文及四材料元数据；若不能证明完全相同的现役 prompt bytes/hash，停止发送。五语回复继续复用同一 canonical reader，并由现役 `productResultValidation.parseJsonObject` 和 `parseProductResult` 解析；此仅是 Product 解析，不能推断 Website admission。任何阶段无真输入、前序 reply 不唯一、解析失败或 Provider effect 未知即停在下一发送前。

Codex 操作前必须读 `chrome:control-chrome` Skill。只连接本次 QA/采集标签页；不接管生产 system Target 或用户其它标签页。物理命令即使返回，也须做全新页面后置读回；unknown effect 先按原身份 readback，不能盲发第二次。公共报告只保存清洗 DOM/hash，原始业务材料留在既有任务来源。`LIVE_SEO_CAPTURE_SESSION` 的真实输入角色 hash 与 DOM 逐角色相等才标 `MATCHED`，且来源明确为本次 SEO 阶段输入冻结；不得伪标 `FORENSICS_SAFE_PROJECTION` 或历史 trace 证明。

终态：清单/输入准入失败为 `BLOCKED_BEFORE_BROWSER`；浏览器现场缺状态为 `CAPTURE_PARTIAL`。真实 `decline` 或失败达到合法终点时如实记录分支、已发生页面事实和未到达格；目标覆盖仍为 `CAPTURE_PARTIAL`。SEO 三轮与五语五轮的八条真实阶段回执均齐全时，终点可记 `terminalBranch=translation-complete`；它只表明八次 QA Provider turn 已到达。还须同一 QA conversation URL、计划内 83 次 Child 的前/命令/后证据均齐全且无 flow gap，才可另记 `CAPTURE_COMPLETE`；仅 SEO image 成功不能完成。此状态仍不是历史文章业务翻译、生产 parent/WAL、Website admission 或其它产品成功。采集与比较任一落盘失败，记录具体缺口并停止，不重放已发生动作；恢复只读回同一 `captureRunId` 的已收 scene/回执，从未完成的纯观察位置接回，新的物理发送必须重新核原 Provider effect。

### 五语现场扩展及边界

- 固定顺序和来源：zh-HK `aiprod_f2366c41-f082-4111-a287-35c0ab191064` → zh-TW `aiprod_6f5fc276-d9a1-44df-a2cb-c704206b9cc1` → en-US `aiprod_d97f9318-4672-48f7-9331-e397c0675ae0` → ja-JP `aiprod_c35f1eb7-9c5e-42c0-8ad9-3ed4630df3ec` → ko-KR `aiprod_91ada47a-9810-440c-aa7e-d2b6b31c7d82`。五张历史工单均属于 source resource `pk-bazi-91617e7cb3c3bb24a4b1925f`，其源文与前述 SEO QA 新生成文章不同。首次固定时逐张只读核 Website/AGENT job 身份、严格 direct parent/result refs、同一 canonical source、四项 material 的 role/ordinal/name/object/bytes/sha256/owner_scope_hash 和现役 route。不能从本次 QA SEO 回答派生或篡改历史材料。四件套是 `private_owner_scoped`，仅复制到本机 Skill `assets/private-localization/` 并由该目录 `.gitignore` 排除 Git，文件权限限制当前用户；可提交的 Skill 只保存 hash/bytes/role/owner scope 摘要及可校验相对定位，不把私有原文或政策提交仓库。后续用本机固定原件验证；缺件即阻断，不重复数据库发现。
- 五语各用现役 `localization-production/flow.ts` 的 `markerFor`、`promptFor`、`ARTICLE_TRANSLATION_MODEL_PROFILE`、`materialFiles/uploadedFiles` 与 `result-contract.ts` 的 `parseProductResult`，从本语真实 task、历史 resultRevision、Product Skill 文本、route result contract 和四件套派生 exact prompt。封闭 probe 的五个 profile、三个附件 Child stub 只为到达 `write_exact_gpt_prompt` 捕获纯内存 prompt；stub 回执绝不写作采集或业务证据。历史 resultRevision/authorization 只用于复原历史任务输入，不冒称当轮 Website 授权。私有函数若无法经同源码调用并与现役文件 hash 核对，则不得手写近似 prompt 冒充生产 exact。每语提交前核完整 prompt hash、四份上传终态、模型/推理状态；真实回复用同一 canonical semantic reader 与唯一相邻 turn 绑定，再按现役 parser 验证。解析失败或 unknown effect 停在本语，不发送后语。
- 五语每轮流程为 profile 五个 Child、附件 open/attach/reconcile 三个 Child、prompt write/submit/text checkpoint 三个 Child，共 11 次；五语追加 55 次，和 SEO 三轮原 28 次合计 83 次预期调用。此为冻结的流程分母；现场调用缺 pre/command/post 必须记 gap，不凭发送次数宣布 83 次已证实。五语不调用 clean-chat，严格沿用同一 QA 标签页、同一已核的 conversation URL hash，并检查前一轮 user/assistant turn 仍可读及下一轮为新 turn；这只证明 QA 页面连续性。历史 job 自己的生产 parent/WAL/admission 按其 Owner 独立存在，本轮不把 QA 会话签为业务授权。
- 唯一 JSON 的本次 SEO captureRun 仅追加修订，旧三轮证据和 comparison 保留；扩展修订把五语逐轮 source job/material hash、marker/prompt/assistant/解析 hash、scene/call/Document 身份写入同一 revision，不写 raw 内容或原 URL。派生差距报告逐行可反查 `matrixDigest/planDigest`、`evidenceRevisionId`、`observedCallId`、`sceneId`、目标 `nodeIndex/identityHash`、代码文件 digest/行；字段缺同义比较依据时标 `REVIEW_REQUIRED`。

## 合同、版本和报告

- 单份矩阵仍在 `references/page-operation-matrix.json`：改为计划的唯一需求源，先对齐现役 14 个 Child，补入固定安全字段、目标与状态分母；它不得写具体 CSS selector、业务 prompt 或可独立裁决生产的逻辑。清单冻结时在采集 run 中保存需求快照和 digest；矩阵后来变化只使旧版对当前需求 stale，不改历史观察。
- 保留唯一证据路径 `docs/项目方案/GPT页面操作子能力实证资料.json`，演进为 v8：原 `products[].runs[]` 只存历史 v7 Product 证据；新的顶层 `seoCaptureRevisions[]` 只存本次 QA run 的共享 Child 状态/DOM 一份，内含 SEO 与五语分段来源，不复制到 40 个产品切片，不改变其 `captureStatus`。Child/状态查询临时遍历这个数组，返回实际来源和未覆盖格；不能输出“其它产品完成”。一次性受检转换 v7→v8 时，以 v7 原 validator 逐 run 校验，记录每个旧 run 的稳定序列化摘要、原 envelope/hash、身份、状态和数量，原样嵌入 v8 `products`；v8 的 `legacyProductRun` 验证按冻结的 v7 历史快照语义重算同样约束，不用新 SEO 规则改判历史。仓库外转换副本须先通过旧/新摘要逐项相等与故意损坏旧 run、重复身份、半迁移拒绝反例；正式转换失败则旧文件不动。转换后只读 v8，不留双读或第二证据报告。新版本唯一键 `captureRunId + evidenceRevisionId`；相同键/内容重试 no-op，键相同内容不同拒绝；补正只附 `supersedesRevisionId + reason`，不能删除或改写旧版。单文件写入使用该文件的独占写临界区，在锁内重读和验证 base、原子 rename、readback 后释放；两并发追加不得丢版或相互覆盖。`latest` 从该 run 有效追加序列临时推导，不另建索引或长期锁服务。
- 一份独立的派生报告 `docs/项目方案/GPT页面DOM与代码差距报告.md`，按 `comparisonId` 追加章节，只引用 `evidenceRevisionId`、清单 digest、相关代码文件路径/内容 digest、事实 ID、DOM 位置、代码位置、固定预期、实际和具体后果，不复制 DOM 正文。逐格对照表来自矩阵已冻结的状态断言和现役 Child 合同、`selectors.ts`/`observation.ts`/`handler.ts` 与 Browser 机械字段：候选数量、作用域、唯一性、role/name/testId/label/checked/value、visible/actionable、前后状态和直接 postcondition 分别核对；hash-only 只比较同规范 hash，不从 hash 推断结构或文案。仅两侧都有同义且可复算的字段时给 `MATCH/DRIFT`；采集未到达为 `UNOBSERVED`，代码需要而矩阵未列为 `CODE_ONLY`，涉及源码语义、不可机械比较或多义映射为 `REVIEW_REQUIRED` 并写明缺哪项证据，不能猜 PASS。相同证据版和代码摘要重跑去重，代码变化追加 comparison，旧结论不覆盖。差距报告是用户要求的派生交付，不是第二页面真相或生产质量门。施工时只给此必要新路径注册一个 GPT Manifest Owner；新方案文件按项目文档既有 Owner 规则登记，重建唯一 registry，不改 active law/Blueprint。
- 历史 Product run 的 `candidate/admit` 防串包继续按历史来源工作；共享 Child/状态查询必须显式 `captureRunId/evidenceRevisionId`，显示该格所属 step/source 和覆盖/缺口，不能把样本解释成任何 Product 完成。离线 refresh 只重投影，不开 Chrome，不产生新 capture revision；当前代码对照另增 comparison revision。公共 DOM 结果仍不绑定 HEAD/clean 工作区；比较报告只绑定实际读到的相关代码文件 digest，dirty 来源如实记录。

## 原子施工工单

| 顺序 | Owner 与落点 | 直接动作、完成门槛和失败停止 |
| --- | --- | --- |
| W0 候选与清单 | GPT 工具：矩阵、`SKILL.md`、`references/collection-protocol.md` | 确定获授权的 law/Blueprint/Child 候选，修正 3 个旧 Child 名和关联 targets/assertions；`inventory --read-only` 精确匹配合同，冻结固定字段与状态。若用户 dirty 合同/Blueprint 继续漂移，停止施工，不改用户源码。 |
| W1 双来源准入 | GPT 工具：`production-source.mjs`、现役 SEO/翻译来源校验、`evidence-schema.md`；Website 只读现有 job/material reader | 历史 attempt 保留 trace gate。SEO 原 ZIP 已固定并校验；五语首次只读核五张 Website/AGENT 历史 job 及各四份材料与 Website blob/object 原字节，核五语内部严格父链及同一 canonical source；私有原件仅固定本机 Skill 的 Git 忽略目录，可提交来源摘要。不能把五语历史源文冒称本次 SEO QA 输出。SEO research/article/image 的后续 prompt 只从本次真实前序结果生成；翻译 exact prompt 通过现役 Product 封闭 probe 捕获，parse 通过现役合同；原始业务文本仅留内存/固定原包，不进公共报告。任一歧义或漂移停在发送前。 |
| W2 现场采集与装配 | GPT 工具：`chrome-scene-collector.mjs`、`assemble-live-capture.mjs`、现有输入绑定 | 八轮在同一 QA 会话，逐轮 pre/动作/post，exact prompt、附件四件、相邻 user/assistant、Document/revision 与 URL hash 读回；五语不 clean-chat。复用 canonical reader，原文仅内存；翻译文本走现役 JSON/Product parser。每个计划格映射为观察、未到达或缺口；重复 Child 的现场 scene 不共享。未知 effect 只读回，不重发；不建第二选择器/恢复链。 |
| W3 唯一报告升级 | GPT 工具：`report-tool.mjs`、唯一 JSON、schema 文档 | 现有 v8 历史 `products` 原对象保留，`seoCaptureRevisions[]` 的同一 captureRun 只追加新版，不覆盖旧三轮 revision。新版 source 身份明确分段列 SEO 及五语历史 job/material hash 和异文章关系；冻结流程扩为 83 调用、八条 stage receipt，仍使用同一全 Child/固定字段矩阵。旧三轮版继续按当时冻结 flow 验证，不追溯重判成完整。独占锁追加/幂等/冲突/readback 沿用现役单报告入口。 |
| W4 即时对照 | GPT 工具：同一报告工具入口、派生 Markdown | 每次新版落盘立即对照精确相关 Child/Browser 代码。章头含冻结 matrix/plan digest，逐行含 call/scene/目标 nodeIndex 与 identityHash、源码文件 digest/行、固定预期/实际/后果；非完整 Document 或 hash-only 无法证明的选择器语义归 `REVIEW_REQUIRED`。生成后 readback comparisonId；失败保留证据版但本轮交付未闭合。 |
| W5 文档与 Owner | GPT/项目文档 Owner：`SKILL.md`、协议、Schema、精确 Manifest 路径 | 删除“空 trace 一律不得新采”“产品切片替换”“不得有任何第二报告”的旧工具规则，只保留禁止第二**证据事实**；更新两个必要文件的 Manifest 归属并重建唯一 registry。不得改生产 Owner/quality verdict。 |

施工顺序 W0→W1→W2→W3→W4→W5；已发生三次 SEO 发送不重跑，五语新增发送前先完成 W1、同一方案审计与 Skill 扩展。W3 正式追加前在独占临界区重读唯一报告。SEO 后续 prompt 由真前序结果生成；五语 prompt 由历史自身 task/material 和现役 Product 生成，不能把异文章 QA SEO 结果当五语源文。任一输入不精确即停在该阶段，保留已发生 DOM。

## 删除审判与验收

保留的结构及不能删除的理由：矩阵是用户要求的预先冻结清单和状态分母；唯一 JSON 是版本连续与历史回看的消费者；Chrome scene collector/装配器是把真实 DOM 绑定到调用与输入的现有 Owner；派生 Markdown 是用户明确要求的独立代码差距交付，删除会使“采完立即对照”无可审阅结果。新 SEO 来源类型是防止现场采集冒称历史 attempt 的必要身份，不建立第二 Product runner；窄版本合并职责只在旧 `report-tool` 已过大且现有替换行为必须退出时存在。删除或不新增：生产 trace hook、第二矩阵/selector、DOM DB、后台采集 Worker、自动任务触发、重试/恢复服务、全仓代码快照、第二质量 verdict、历史桥和模拟材料。这些均无本次必要消费者，且会越过 Product/Browser Owner。

正向验收：对当前 Child 合同矩阵精确盘点；全部计划字段有固定 schema 和隐私白名单；无 trace 的历史 attempt 继续不能进入 Chrome；本次现场仅接受 SEO `produce_article` 三轮及固定五张 `localization_article_translation/article_translation` 历史任务。SEO 后续输入由同一 QA 会话真回复生成；五语分别由历史真实 task/四材料/route/resultRevision 和现役 Product probe 生成 exact prompt，并在同一 QA URL 顺序发送，每轮四附件、相邻 turn、现役 JSON/Product 解析可反查；五张历史任务彼此严格父链、同一源文，私有原件不进 Git。所有八轮不伪造 checkpoint；同 DOM 两 serializer 字节/hash 不等时下一次发送为零并记 `SEMANTIC_TEXT_PROJECTION_DRIFT`；合法 decline/失败分支诚实止步。一次正常流程未出现的内部限流 Child 和故障状态仍为 `NOT_REACHED`，其它 39 个产品路由不得因 SEO 样本变成已采；重复 Child 证据不串包，unknown submit 不二次发送。版本验收覆盖 v7 旧 run 逐项验证与保留、v8 追加、重复 no-op、并发两写不丢版、冲突拒绝、损坏/半迁移拒绝、补正留旧版及 readback。比较验收覆盖可机械比较的一致/冲突、未观察、代码无页面证据、语义多义需复核、代码变化后新比较版及旧版不变；每个差距可反查同一 revision 的 scene/field 和源码文件 digest/行。

反向验收：从派生差距报告逐项反查代码、唯一八轮 DOM 证据版、scene/nodeIndex/identityHash、现场 call、冻结清单和真实材料身份；从五语逐项反查历史 job 的 direct parent、同源 article/version/hash、四份材料原字节及本机 Skill 固定件；验证 research 首次发送后冻结 canonical URL，后续 article/image/五语及各 post-submit 读回全等（research pre 允许根页），同时明确标注跨文章拼接，只是同页连续 DOM 样本，不构成单篇业务链或生产 continuation/admission；Child 样本查询只证明该场景真实观察，从 Product/Website 业务终点反查时明确标为“采集工具无 admission 权”，不得把 QA 会话的 Provider 回复写成生产结果或其它产品完成。失败后只读回已有事实，不重放副作用。原生检查只用skill-creator 的 `quick_validate.py`、三项现有 acceptance 加必要的版本/对照反例；仓库质量边界用唯一 `npm run quality:check`，其通过也不证明真实 Provider/Website 完成。本轮真实 Chrome 检验必须逐动作读回，按已达状态诚实记载，结束前接受独立只读审计。已有 SEO 三轮证据缺 64 个 flow gap；五语新增不能回填历史动作的 pre/command/post。本轮可以达成八次真实发送和五语同页连续实测，但除非无副作用的真实读回能补齐全部缺口，否则报告必须保持 `CAPTURE_PARTIAL`，不得声称 83/83 Child 调用已实证。

进入施工前，执行 Codex 必须重新检查本方案状态、独立审计结果、当前 Git/dirty scope、法案/Blueprint/矩阵/Child/产品源的内容身份、Manifest Owner、真实 Chrome 及 Provider 操作授权。相关漂移只重算受影响方案部分；未获授权的生产代码、法案或施工图变更一律停止。独立审计放行只证明方案可施工，不授予代码修改或真实发送权限。

## 2026-09-25 现场结果与后续判定

本次 SEO 三轮和五语五轮均在获授权的同一 Chrome QA 对话真实发送一次；五语各四份历史原字节材料上传完成、exact prompt hash 与现役 Product probe 相等、唯一相邻回复通过现役 Product 解析。ChatGPT 会虚拟化旧 turn，故连续性验收采用下一轮 pre scene 对上一轮 user/assistant/marker 的唯一相邻绑定、上一轮为最后可见 user，以及同 URL 与发送后场景时间序；不要求最终 ko-KR 页同时保留八轮。历史翻译文章与本次 SEO QA 文章不同，生产 Website/Browser 业务终态未由 QA 会话认领。

唯一 v8 JSON 的新增 `evidenceRevisionId=sha256:754ae2ee3e00edabdf4ef9046edd379c0fa293431ee8950cd88d1aab043b384f` 已保留两条旧 SEO 版本，立即派生 `comparisonId=sha256:d5f854a93d8577ce3c17ec7870254200baf8cd546f20ce20ce1eae32502ef883`。八条阶段回执成立；83 次计划 Child 调用有 35 次独立 scene 映射，131 条 flow gap，状态为 `CAPTURE_PARTIAL`。这证明真实流程与 Skill 的缺口表达可以工作，不是 83/83 DOM 状态齐全。当前比较版把 DOM 状态缺口、计划调用缺口与代码逐字段差异独立列出；采样内 selector 候选为零而 full Document 基数未知时只能 `REVIEW_REQUIRED`。旧 scene 的 collector 范围版本为带来源说明的事后标注，v13 之后的采样范围与未读旧回复 `null` 则签入 scene 的 pageFacts；不得把旧空 response hash 解释成真实空回复。

## 2026-09-25 实战复采修正（优先于上文旧轮次推进规则）

旧八轮真实执行并未达到用户要求的清单采集：83 次计划调用只映射 35 次，131 条旧 v1 flow gap 包含缺调用、缺状态、全局 cell 冲突及目标缺失。旧版和原始 scene 保留，不伪造补录，也不将 Provider 八轮完成写成采集完成。旧报告恢复为唯一 v8 JSON 的连续三版；当前代码下的独立比较版重新生成，旧事实不覆盖。

新执行仍只走一次 SEO 三轮加五语五轮，同一专用 Chrome QA 会话、相同固定真实包、相同 14 Child/固定字段清单。每轮必须在下一次物理发送前采齐该轮计划调用的适用 pre/command/post scene、实际 stage receipt，并调用装配器 `--require-stage <本轮 stepId>` 累计核前缀。中间正常暂停的临时装配用 v2 `terminalBranch=stage-paused`、空 terminalReceipt，仅保存在仓库外，唯一报告 append 拒绝此分支。命令写出临时证据后返回 `stageGaps` 和 `stageConflicts`；有缺调用、缺状态 scene、目标没拍到、缺命令证据、缺 receipt 或已签名行动后置失败，即停在当前轮。异常状态未触发就标未到达，不制造 Provider/Child 动作。逐阶段放行不代替最终 83 次调用和八回执的完整验收。

新 revision 使用 v2 逐调用覆盖：同格在另一调用发生的 `CONFLICT` 不能抹掉本调用已签名 scene；一个缺目标 row 不能丢弃别的有效 row。validator 对每条 v2 observation 用原签名 scene 重算目标选择，并核命令前后 scene、动作身份和时间，拒绝只改 specimen 伪造覆盖。冲突本身保留为 DOM 与现役代码/断言的实际差距，已证实行动后置失败另列 action conflict；两者由独立 Markdown 报告呈现，不能混算成漏采。只有无逐调用 `flowGaps`、无 action conflict、八个真实回执及同一 QA URL 才为 `CAPTURE_COMPLETE`。任何中断只可诚实追加 `CAPTURE_PARTIAL`，不能作为本任务完成。审计只读检查新规则、场景绑定、漏采门和版本不覆盖；未放行不结束方案建设。范围限本 Skill、这份方案、唯一 JSON 和其独立报告，不碰生产代码、法案或 Website。

唯一 JSON（约 293 MB）与派生 Markdown 按用户裁决仅在本机保存并被 `.gitignore` 精确排除，不跟踪、不推送。后续同机任务沿同一绝对路径先 readback 现有 v8/旧修订；缺文件或版本链不完整即停在追加前，不用新空报告替代。此本机范围限制应在交付中明确，不宣称跨 checkout 自动可用。v2 SEO CLI 还强制 `--require-stage`；省略参数在读取现场文件之前失败。

## v2 现场验收结果与现役阻断

设计/工具经两名独立只读审查者放行后，新专用 Chrome QA run `seo-live-c5421990-fcff-42a7-bf54-9fe8179b2084` 从 research 起按清单采真实 DOM；本轮在任何 Provider 发送前停止。页面“最新”模型已选中，但点击后菜单仍打开，违反现役 `select_gpt_model_from_start_v3` 的关闭后置；空白新聊天也缺 `prepare_clean_gpt_chat` 所需的唯一附件区目标。全八轮证据版有 84 个 flow gap；正式 research 前缀门禁报告 14 个 stageGaps 与一次模型选择动作的后置失败（两个状态观察形成两条 action conflict），拒绝推进 article/image/五语。第 4 个本机 JSON 证据版 `sha256:862fb91fc05db62bc0f11a703c5ae9372e5ed3442add65c9d5442bc93bed16cf` 与即时独立比较版 `sha256:6b1d6c05bf458cf457c4c55b6473d53763dea55f4d51f5e031702dd579ae5cc6` 已读回；`CAPTURE_PARTIAL`，0/8 stage receipt，不能宣称 SEO+五语闭环或 83/83。若要继续达到原目标，必须先在单一现役 Child/矩阵 Owner 下处理这些真实 UI 不匹配并重审本方案；本次授权未包含生产代码、法案或合同修改，不做旁路或伪造后置。

## v3 实战修正：逐调用落盘与全链现场覆盖

用户随后明确要求在同一真实 QA 会话拿回 83 个计划调用的现场结果，并在每个调用后立即更新、回读。此授权替换上节“出现合同缺口即停止下一轮采集”的推进规则；不替换 `CAPTURE_COMPLETE` 的严格判定。每个 Child 的 scene 与 mapping 一完成即原子保存、回读调用数和场景数；每个 Provider 轮次回复由现役解析器接受后立即保存 stage receipt，并运行 `--require-stage` 输出本轮累计缺口与冲突。`SEO_STAGE_NOT_READY` 是资格判定失败，继续现场覆盖时保留其事实，绝不改为放行或假成功；只有真实页面/Provider 无法继续、身份未知或重复发送风险时停下。唯一 JSON 仍只追加带真实终态的不可覆盖版本，进行中 `stage-paused` 仅留仓库外，避免每个 Child 复制约 293 MB 的旧报告。

v3 run `seo-live-da7f37c8-38b6-412f-a1c8-bfc398a975c2` 已得到真实 research `proceed` 回执及 12/12 独立 Child 映射；即时对照为 19 条阶段缺口、2 条模型后置冲突。Provider 初次“消息流中的错误”后只对原用户轮次重试一次，没有新提示词发送。文章约 11.5 KB 提示词一次填充产生自动“粘贴的文本”附件；分段输入虽核准正文精确，首次失败附件随文章消息发送，须作为该轮输入偏差保留，不能认定资料包清单符合。后续每次发送同时核 exact prompt 与附件集合，全部旧失败 scene 留原样。方案范围仍限本 Skill、这份方案、唯一本机 JSON 和独立差距报告；子智能体只读审计，未通过不结束方案建设。

### v3 最终现场核验与附件修复边界

上述 run 后续完成 SEO 三轮和五语五轮真实 QA 操作：83/83 个计划 Child 各有独立 scene 映射，8/8 张真实阶段回执由现役解析接受，同一 canonical URL 哈希。第 5 个唯一 JSON 版本为 `sha256:b9988c93afa4b65a08786582f71eebe2ae286d9e976ac092a967f36bb0bb55ae`，即时独立比较版为 `sha256:62d9508ddbd5744b376231c8a77cd68183551749c2c34c0a752db6bfddf32e08`；读回 `valid=true, complete=false`。136 条 `missing-branch-state` 与 14 条模型选择后置冲突必须保留，整体为 `CAPTURE_PARTIAL`。83/83 不表示矩阵全部状态或 Product/Website 终态已合格。

“附件完成、提示词前”的实战 DOM：上传中同一 composer 有 4 个 `role=progressbar`、0 个具名卡按钮；完成后恰有 4 个 `button.composer-attachment-surface[aria-label]`、0 个 progressbar、0 个旧 `[role='group'][aria-label]`。修复生产 Child 时，四个卡片消费者应统一读具名按钮并按现役重名后缀规则一一核文件集合；reconcile 单独读 composer 内的 progressbar，允许 4 个进度条与 0 张卡并存的等待态，取消 spinner 数小于等于卡片数的不实断言；只有进度/待处理/可见错误均为零且四卡精确匹配才交给提示词 Child。当前工作区四个卡片选择器的未提交改动不构成生产运行验证，spinner 仍挂在按钮后代，不能宣称修复完成。下一紧邻风险是 `write_exact_gpt_prompt` 对长文章整段 `fill` 会自动制造额外粘贴附件，发送前必须重新核提示词完整哈希与附件集合；本轮文章已带该额外附件发送，事实保留。此段是只读修复方案，不授权修改生产 Child、Browser Owner 或法案。

唯一 JSON 首次追加 v3 时因整份 pretty 序列化超过 Node 单字符串上限报 `Invalid string length`；Skill 原报告工具改用紧凑 JSON 原子写入，合并后约 324 MB，旧四版保留且 readback 通过。后续容量达到相同上限时先修原工具的单文件读写，不能拆出第二证据台账。所有本机资料按原 `.gitignore` 精确排除，不推送。

文章输入偏差随后以第 6 个不可覆盖补正版 `sha256:93d6b50f006de36e92bef4464cf0bbbb77da3e12a884eac8b8b712d67a2b339f` 追加，`supersedesRevisionId` 指向第 5 版 `b998...`。文章 stage receipt 现直接绑定签名 `a-submit-pre`：计划 0 件附件、页面实际 1 件且标签为 hash-only；同一次 submit 的后续 scene 证实发送。独立比较版 `sha256:61952af8684c5948789f93b1feff3647bb8b0ff22450739df1b7c5dffcef8e46` 单列输入偏差与场景指针，旧比较章保留。最新仍为 83/83 调用、8/8 回执、136 条固定状态缺口和 14 条模型后置冲突，`CAPTURE_PARTIAL`；原生读回 `valid=true, complete=false`。校验器从签名发送前场景直接拒绝“额外附件却标 COMPLETE”，即使回执注记被省略也不能绕过。唯一 JSON 现为 498,456,139 字节，接近 Node 单字符串上限；下次追加前必须先修原唯一报告工具的容量，不能增设第二证据存储或删除旧版。
