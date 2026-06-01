# GrassEye Amazon 产品挖掘施工图

version: 2026-05-25
status: frozen-production
governs: `.github/instructions/agent-rules/modules/module-amazon-product-mining.instructions.md`
capabilityDomain: `amazon-product-mining`
targetJobFlowRoot: `src/plugins/amazon-product-mining/**`

> 本施工图是法案的实现地图，不高于 active law。
> 本施工图描述 Amazon 产品挖掘当前唯一生产流程。
> 它只作为实现地图，不高于 active law。
> 任何新增/修改必须继续遵守单链、无兼容、无 fallback、无第二链路。

---

## 0. 生产冻结定位

```txt
当前唯一生产链：
  -> src/plugins/amazon-product-mining/** owner 实现
  -> src/app/workbench-amazon-product-mining-routes.ts
  -> src/app/workbench-home-page.ts / workbench-home-client.ts 最小入口面
  -> scripts/audit/domains/amazon-product-mining/{manifest.json, inspector.ts}
  -> scripts/acceptance/amazon-product-mining-*.acceptance.ts
  -> package.json / ci:full 持续纳入
```

施工图允许的只是图纸；不授权新增第二流程、通用 Agent、universal marketplace crawler、ERP、利润测算系统、采购决策系统、绕过 Amazon 限制、手工修改 generated artifacts。

---

## 1. 唯一流程总图

```txt
INTAKE
-> KEYWORD_AI_SEND
-> KEYWORD_AI_CAPTURE
-> KEYWORD_PARSE
-> KEYWORD_DEDUP
-> KEYWORD_QUEUE_PERSIST

-> KEYWORD_LOOP_START
  -> AMAZON_SEARCH_OPEN
  -> SEARCH_PAGE_STABLE
  -> SEARCH_RESULTS_EXTRACT
  -> SEARCH_RESULTS_PERSIST

  -> PRODUCT_LOOP_START
    -> PRODUCT_DETAIL_OPEN
    -> PRODUCT_DETAIL_STABLE
    -> PRODUCT_DETAIL_EXTRACT
    -> PRODUCT_DETAIL_PERSIST

    -> REVIEW_PAGE_OPEN
    -> REVIEW_PAGE_STABLE
    -> REVIEW_PAGE_PAGINATE
    -> REVIEW_RECORDS_PERSIST
    -> PRODUCT_COMPLETE
  -> PRODUCT_LOOP_END

  -> KEYWORD_COMPLETE
  -> KEYWORD_FULL_PACKAGE_BUILD
  -> KEYWORD_FULL_PACKAGE_INTEGRITY_GATE
  -> KEYWORD_ADVANCED_AI_HANDOFF
  -> KEYWORD_OPPORTUNITY_REVIEW
  -> KEYWORD_REVIEW_PERSIST
  -> APP_HISTORY_UPDATE
-> KEYWORD_LOOP_END

-> TASK_PACKAGE_BUILD
  -> TASK_MASTER_REPORT_BUILD
  -> TASK_HANDOFF_SUMMARY
  -> COMPLETE
```

## 1.0.1 断点续跑与人工控制

```txt
TASK_CONTROL_CHECK
  -> 每个 keyword / product / review / packaging 安全点读取持久化 task.status
  -> paused: 停在当前持久化证据位置，不进入后续步骤
  -> terminated: 停在当前持久化证据位置，不进入 packaging
  -> running states: 继续单一生产 flow

WORKBENCH_STARTUP
  -> 扫描 created / keyword_generating / keyword_ready / mining / packaging
  -> 对每个非终态、非 paused、非 terminated task 自动继续同一 flow
```

冻结细则：

- 断点真相只能来自 SQLite 与已落地 evidence，不得来自前端缓存、zip、手工重包或第二执行链。
- Continue 必须复用同一个 `taskId`，并跳过已完成的 keyword/search/detail/review/keyword review。
- Pause 是人工暂停，系统重启后不自动继续。
- Terminate 是人工终止，系统重启后不自动继续，也不得生成新的 package。
- 同一 `taskId` 任意时刻只能有一个活动执行。
- App surface 必须提供 Pause / Continue / Terminate 三个真实后端控制按钮，不能只改 UI 状态。

## 1.1 浏览器标签生命周期

```txt
MINING_BROWSER_TAB_PREPARE
  -> 打开一个 Amazon 挖掘专用工作标签
  -> 后续 SEARCH / DETAIL / REVIEW / REVIEW_PAGINATION 全部复用当前活动标签
```

冻结细则：

- 挖掘阶段开始时，只允许创建一个专用工作标签。
- search.ts、product-detail.ts、reviews.ts 的页面跳转必须复用当前活动标签。
- 评论翻页必须继续复用当前活动标签，不得按页面持续新开标签。
- 禁止 one-page-one-tab、one-product-one-tab、review-page-one-tab 造成 Chrome 标签膨胀。

## 1.2 Amazon 页面打开节奏

```txt
PRODUCT_DETAIL_OPEN_PACING
  -> 每个产品详情页打开前随机等待 1_000..20_000ms

REVIEW_PAGE_OPEN_PACING
  -> 每个评论页打开前随机等待 1_000..5_000ms
```

冻结细则：

- pacing 是生产默认行为，不是 UI 选项。
- pacing 只能降低连续快速访问触发 Amazon 风控的概率。
- 如果出现验证码、登录墙、地域限制或风险控制，仍必须进入 manual_required / failed，不得绕过。
- 搜索首页仍保存所有可见产品；详情和评论仍只处理 rankPosition <= 30 的产品。

---

## 2. 推荐文件布局

### 2.1 Job Flow owner

```txt
src/plugins/amazon-product-mining/
  amazon-product-mining.flow.ts                # 流程编排（状态机入口）
  amazon-product-mining.schema.ts              # zod schema 集合
  amazon-product-mining.keyword.ts             # AI 关键词请求与去重
  amazon-product-mining.search.ts              # Amazon 搜索首页提取
  amazon-product-mining.product-detail.ts      # 产品详情完整提取
  amazon-product-mining.reviews.ts             # 评论分页全量提取
  amazon-product-mining.package.ts             # 结构化数据包构建
  amazon-product-mining.pdf.ts                 # PDF 报告生成
  amazon-product-mining.handoff.ts             # 高级 AI handoff record
  amazon-product-mining.storage.ts             # SQLite 写读
  amazon-product-mining.storage-schema.ts      # 表结构定义
  amazon-product-mining.logging.ts             # runtime-log-spine 适配
  amazon-product-mining.result.ts              # 任务最终结果聚合
  index.ts                                     # 公开 facade
```

### 2.2 App surface

```txt
src/app/workbench-amazon-product-mining-routes.ts
```

允许暴露：

```
POST /api/amazon-product-mining/mission       # 创建任务
GET  /api/amazon-product-mining/run?taskId=   # 查询任务
GET  /api/amazon-product-mining/latest        # 读取最新任务
GET  /api/amazon-product-mining/keyword-reviews?taskId=
GET  /api/amazon-product-mining/keyword-review?reviewId=
POST /api/amazon-product-mining/keyword-review/manual-ingest
GET  /api/amazon-product-mining/export?taskId=# 下载导出
POST /api/amazon-product-mining/pause          # 暂停当前 task
POST /api/amazon-product-mining/continue       # 从持久化断点继续 task
POST /api/amazon-product-mining/terminate      # 终止当前 task
```

禁止：直接写业务步骤 / 直接读 DOM / 直接判断产品好坏 / 直接调用能力组私有实现。

### 2.3 Audit owner

```txt
scripts/audit/domains/amazon-product-mining/
  manifest.json
  inspector.ts            # 必须真实使用 context.project（满足 audit-truth 元法案）
```

### 2.4 Acceptance

```txt
scripts/acceptance/amazon-product-mining-flow.acceptance.ts
scripts/acceptance/amazon-product-mining-storage.acceptance.ts
scripts/acceptance/amazon-product-mining-keyword-dedup.acceptance.ts
scripts/acceptance/amazon-product-mining-search-page.acceptance.ts
scripts/acceptance/amazon-product-mining-detail-page.acceptance.ts
scripts/acceptance/amazon-product-mining-review-pagination.acceptance.ts
scripts/acceptance/amazon-product-mining-package.acceptance.ts
```

### 2.5 治理文档

```txt
.github/instructions/agent-rules/modules/module-amazon-product-mining.instructions.md
docs/法案辅助文件/GrassEye Amazon 产品挖掘施工图.md
```

---

## 3. 阶段 1：创建挖掘任务

| 项 | 内容 |
| -- | -- |
| 输入 | `amazonMarketplace, targetMarket, productDirection, requestedKeywordCount, languagePreference, firstPageOnly=true` |
| 动作 | 校验输入 / 创建 taskId / 读取历史已挖掘关键词 / 保存 task scope / 进入 keyword_generating |
| 输出 | `taskId, taskStatus=keyword_generating, existingMinedKeywords` |
| owner | flow.ts + storage.ts |
| 异常处理 | marketplace 缺 → 拒绝创建；targetMarket 缺 → 拒绝创建 |
| 禁止 | 默认值替代用户选择 / 跳过历史关键词读取 / AI 自主决定站点 |

断点续跑约束：

- 新建任务时保存 provider、scope 与初始状态。
- 如果同一 taskId 已存在，必须进入 Continue 语义，不得重新 create task 或重新生成已存在关键词。
- App 必须允许用户在任务运行中暂停、继续、终止。
- 系统重启后自动继续非终态运行状态；`paused` 与 `terminated` 不自动继续。

---

## 4. 阶段 2：AI 生成关键词

| 项 | 内容 |
| -- | -- |
| AI 输入 | marketplace, targetMarket, productDirection, existingMinedKeywords, requestedKeywordCount, doNotRepeatInstruction, structuredOutputSchema |
| AI 输出契约 | `newKeywords[] = { keyword, reason?, expectedCategory? }` |
| 动作 | 通过 ai-input-gateway 发送 / 保存 raw response / 解析 / 失败保存 failure record |
| 状态 | task: keyword_generating |
| owner | keyword.ts + ai-input-gateway facade |
| 禁止 | 自然语言列表直接当队列 / AI 决定浏览器动作 / AI 返回 selector / coordinate / nextAction |

关键词生成 prompt 边界：

- 系统只提供用户原始 `productDirection`、marketplace、targetMarket、language、历史关键词、去重要求和 JSON 格式。
- 系统不得代替用户或 AI 增加尺寸、重量、小件、轻量、紧凑、易运输、价格带、材质、包装、利润或采购假设。
- “中国供应商背景”只能作为 sourcing background，不得自动收窄成小件轻货、低体积或易运输关键词。
- 关键词是否适合进入候选名单，只能在关键词完成后的 full package review 阶段判断。

---

## 5. 阶段 3：关键词解析与去重

| 项 | 内容 |
| -- | -- |
| 动作 | 提取 keyword 文本 / 清理空格无效字符 / 统一大小写比较规则 / 过滤空 / 历史去重 / 本任务去重 / 保存 keyword queue |
| 输出 | `keywordQueue[], keywordStatus=pending` |
| 状态 | task: keyword_ready 或 failed（无新增关键词 → `no_new_keywords` 终态） |
| owner | keyword.ts |
| 禁止 | 为凑数自行编造 / 不记录 AI source run |

---

## 6. 阶段 4：关键词搜索

| 项 | 内容 |
| -- | -- |
| 循环 | for each pending keyword：mark searching → open marketplace → search → wait stable → capture searchUrl → extract first page |
| owner | search.ts |
| 异常 | 验证码 / 登录墙 / 风控 → keyword.status = manual_required 或 failed；当前关键词失败不阻塞其他关键词 |
| 禁止 | 绕过平台限制 / 跳过 search run 记录 |

---

## 7. 阶段 5：搜索首页产品提取

字段（搜索结果项）：见法案 [005] Section。

| 项 | 内容 |
| -- | -- |
| 提取范围 | 当前关键词搜索首页可见所有产品 |
| owner | search.ts |
| 禁止 | 只提取看起来好的产品 / 丢失 rankPosition / 丢失 isSponsored / ASIN 不可见就丢弃 / 跳过 rawVisibleTextSnapshot |

搜索结果页与详情页范围切分：

- 搜索结果首页仍必须保存所有可见产品，保持完整曝光结构。
- 产品详情页和评论页只处理当前关键词搜索排名前 30 名。
- 排名 31 及之后的搜索结果不得静默删除；必须保留 search result、rankPosition、ASIN/URL、图片和原始可见文本证据。
- 排名 31 及之后不得打开详情页，不得抓评论页，不得在数据包中伪装成详情已挖掘产品。
- top30 限制必须在 flow.ts 生产循环中实现，并由 acceptance + AST audit 固化；不得通过 UI、导出脚本或人工筛包实现。

## 7.1 最大化可见信息提取矩阵

> 这是本施工图下的字段级 owner 契约。
> 结论只有两类：真实提取，或真实说明为何没有提取结果。

| Field | Source Page | Extraction Strategy | Required When Visible | Null Allowed When | Exception Required When | Completeness Flag | Acceptance Fixture |
| -- | -- | -- | -- | -- | -- | -- | -- |
| rankPosition, isSponsored, title, productUrl, asinIfAvailable, mainImageUrl, price, rating, reviewCount | search results card | card-root + anchor + image + rating badge + visible text snapshot | yes | not_present only for asinIfAvailable when URL still exists | blocked, unsupported_structure | fieldPresent/search-visible | amazon-product-mining-search-page.acceptance.ts |
| originalPriceOrDiscountIfVisible, primeOrFbaFlagIfVisible, couponTextIfVisible, deliveryTextIfVisible | search results card | candidateSelectors + nearby commercial badges + card visible text | yes | not_present when badge/line truly absent | blocked, unsupported_structure, extractor_missing | fieldPresent/search-commercial | amazon-product-mining-search-page.acceptance.ts |
| mainImage, allVisibleImages, visibleVideoInfo | product detail hero/gallery | hero image attrs + gallery thumbs + visible media modules | yes | not_present when module absent | blocked, unsupported_structure | fieldPresent/detail-media | amazon-product-mining-detail-page.acceptance.ts |
| bulletPoints, aboutThisItem, productDescription | product detail main content | heading section + bullet list + description block + visible text snapshot | yes | not_present when section absent | blocked, unsupported_structure | fieldPresent/detail-copy | amazon-product-mining-detail-page.acceptance.ts |
| aPlusContentIfVisible, qaContentIfVisible | product detail modules | module heading detection + text blocks + image urls + links | yes | not_present when module absent | blocked, unsupported_structure, manual_required | notPresent/detail-module | amazon-product-mining-package.acceptance.ts |
| variationOptions, colorSizeStyleOptions | product detail variation area | `#twister_feature_div` a-state JSON (`sortedDimValuesForAllDims`) + visible inline twister labels + option labels + swatch text | yes | not_present when no variation/twister module | blocked, unsupported_structure | fieldPresent/detail-variation | amazon-product-mining-detail-page.acceptance.ts |
| productInformation, technicalDetails, additionalInformation, allOtherVisibleProductParameters | product detail tables/lists | section heading + table rows + detail bullets + definition lists | yes | not_present when section absent | blocked, unsupported_structure | fieldPresent/detail-parameters | amazon-product-mining-detail-page.acceptance.ts |
| bestSellersRankIfVisible, categoryPathIfVisible, starDistribution | product detail meta modules | detail bullets + breadcrumb + rating histogram module | yes | not_present when module absent | blocked, unsupported_structure | fieldPresent/detail-meta | amazon-product-mining-package.acceptance.ts |
| frequentlyBoughtTogetherIfVisible, customersAlsoBoughtIfVisible, compareWithSimilarItemsIfVisible | product detail related modules | section heading + visible product cards + compare tables + links | yes | not_present when module absent | blocked, unsupported_structure | fieldPresent/detail-related | amazon-product-mining-package.acceptance.ts |
| deliveryInformation, returnInformation | product detail purchase area | delivery promise block + availability + return policy modules + nearby visible text | yes | not_present when line absent | blocked, unsupported_structure | fieldPresent/detail-fulfillment | amazon-product-mining-package.acceptance.ts |
| reviewIdIfAvailable, reviewerName, rating, reviewTitle, reviewBody, reviewDate, verifiedPurchase, variant, helpfulCountIfVisible, rawReviewTextSnapshot | review page | review-root + review subblocks + visible text snapshot | yes | not_present for optional subfields only | blocked, unsupported_structure | fieldPresent/review-core | amazon-product-mining-review-pagination.acceptance.ts |
| reviewImagesIfVisible, reviewVideosIfVisible | review page media | review media thumbs + modal/link targets + media badges | yes | not_present when review has no media | blocked, unsupported_structure | fieldPresent/review-media | amazon-product-mining-package.acceptance.ts |
| reviewLanguage, reviewRegionIfVisible | review page header/meta | review date/meta text parsing + locale tokens + visible label extraction | yes | not_present when locale token absent | blocked, unsupported_structure | fieldPresent/review-locale | amazon-product-mining-package.acceptance.ts |
| search card image urls, product image urls, A+ image urls, review image urls, review video urls | search/detail/review | every extracted url must be indexed into image-evidence-index | yes | not_present when no media url exists | blocked, unsupported_structure | imageEvidenceIndexed | amazon-product-mining-package.acceptance.ts |

字段级 reason taxonomy：

```txt
not_present
blocked
unsupported_structure
manual_required
failed
extractor_missing
```

冻结规则：

- `extractor_missing` = CI FAIL
- `not_present` 只允许用于页面真实不存在
- `blocked` / `manual_required` 必须进入 exception-summary
- `unsupported_structure` 必须进入 completeness warning
- plain null / [] 不是 reason，不能单独作为结论

---

## 8. 阶段 6：搜索结果入库

| 项 | 内容 |
| -- | -- |
| 动作 | 保存 keyword search run / 保存 search result items / 建立 keyword-product relation / 产品 detail 状态 pending_detail |
| owner | storage.ts |
| 禁止 | 入库未成功就打开详情页 / 同 ASIN 来自多关键词时丢弃多余关系 / 搜索页数据与详情页数据混存 |

---

## 9. 阶段 7：打开产品详情页

| 项 | 内容 |
| -- | -- |
| 循环 | 按 rankPosition 顺序打开每个产品 detail URL |
| owner | product-detail.ts |
| pacing | 打开每个详情页前由 flow.ts 执行 `1_000..20_000ms` 随机等待 |
| 异常 | 失效 / 跳转 / 缺货 / 受限 → product.status = failed 或 manual_required，单产品失败不中断当前关键词 |

---

## 10. 阶段 8：产品详情页完整信息提取

字段：见法案 [006] Section。

| 项 | 内容 |
| -- | -- |
| owner | product-detail.ts |
| 缺字段处理 | null 或空数组，不得抛错 |
| 必存 | rawVisibleTextSnapshot |
| 完成后 | 进入 review_extracting |

详情字段空值治理：

```txt
允许为空，不允许静默为空。
每个空字段都必须能追溯到 not_present / blocked / unsupported_structure / manual_required / failed。
extractor_missing 不是允许结果。
```

---

## 11. 阶段 9：进入评论页

| 项 | 内容 |
| -- | -- |
| 动作 | 定位评论入口 / 打开全部评论页面 / 确认评论页对应当前产品 / 记录 reviewUrl |
| owner | reviews.ts |
| pacing | 打开每个评论页前由 flow.ts 执行 `1_000..5_000ms` 随机等待 |
| 异常 | 评论入口不存在 / 评论页受限 → product.review_status = failed 或 manual_required |
| 禁止 | 绕过限制 / 评论失败时删除详情页数据 |

---

## 12. 阶段 10：当前可访问评论全量分页提取

字段（每条评论）：见法案 [007] Section。

```txt
page = first review page
while page accessible:
  extract all reviews on page
  persist current page reviews
  detect next page
  if next page exists: open next page
  else: stop
```

| 项 | 内容 |
| -- | -- |
| owner | reviews.ts + storage.ts |
| 必存 | 每页保存（避免中途失败全丢） / completedPages / failedPage 标记 |
| 禁止 | 跳页 / 只存 AI 摘要 / 绕过限制 |

分页停止规则：

```txt
默认持续翻页，直到没有 next page。
只有平台限制、显式 hardLimit、显式安全运行上限，才允许提前停止。
任何提前停止都必须记录 stoppedReason。
```

评论结果状态：

```txt
reviews_completed
reviews_completed_with_limit
reviews_manual_required
reviews_failed
reviews_not_present
```

---

## 13. 阶段 11：产品完成与下一条

| 项 | 内容 |
| -- | -- |
| 动作 | 保存详情 / 保存评论 / 保存 evidence index / mark product completed/failed/manual_required / 进入下一个 pending_detail 产品 |
| 复用规则 | 同 ASIN 已完整挖掘过时可复用详情数据，但必须保留当前关键词来源关系；复用前必须确认数据有效 |

---

## 14. 阶段 12：关键词完成、研判与下一关键词

| 项 | 内容 |
| -- | -- |
| 动作 | 统计当前关键词下产品状态 / 标记 completed 或 completed_with_errors / 生成 keyword execution summary / 构建 keyword full evidence package / integrity pass 后上传 package 核心文件给 GPT Web Chat / 接收或等待 structured verdict / 入库 keyword review / 更新 App 历史表 / 进入下一 pending keyword |
| 关键产物 | `keyword-{keywordId}-full-evidence-package/` / `keyword-{keywordId}-opportunity-review-prompt.md` / `keyword-{keywordId}-opportunity-review-response.json` |
| 终态 | 全部关键词完成且所有 keyword review 已进入 completed/manual_required/failed 之一 → task.status = packaging |

### Keyword Full Evidence Package

每个关键词完成后必须先生成关键词级完整资料包：

```txt
keyword-{keywordId}-full-evidence-package/
  manifest.json
  00-keyword-master-report/
    keyword-master-report.md
  01-search-results/
    search-results.json
  02-product-details/
    product-details.json
  03-reviews/
    reviews.jsonl
    reviews-summary.json
    review-pages-index.json
  04-images/
    image-evidence-index.json
  05-completeness/
    data-completeness-report.json
    package-integrity-report.json
  06-exceptions/
    exception-summary.json
  07-ai-handoff/
    ai-reading-contract.md
    keyword-opportunity-review-prompt.md
    inline-evidence-navigation.json
```

冻结细则：

- inline evidence slice 只能作为快速目录、摘要、导航，不得作为高级 AI 深度研判唯一资料源。
- keyword opportunity review 必须以 keyword full package 为资料源。
- 文件上传能力可用时，必须上传 keyword full package 的 transport zip；zip 只作为运输壳，目录内 full package 文件仍是唯一证据真相源；`inputRefs` 必须包含真实 `filePath`。
- 文件上传能力不可用时，review.status = `manual_required`，不得自动降级为 inline-only verdict。
- package integrity 不通过时，不允许进入 GPT Web Chat 研判。
- GPT Web Chat 只读取 slice 或未读取 full package 时，verdict 不得作为最终 keyword review。

### Keyword Opportunity Review 固定维度

```txt
Demand Signal
Review Health
Price Ceiling
Competition Openness
Improvement Opportunity
Data Confidence
```

每个维度只允许：

```txt
strong | medium | weak | insufficient
```

### Keyword Opportunity Review 决策规则

```txt
PASS = 该 keyword product pool 保留进入候选名单，等待下一阶段人工验证
WATCH = 有信号但证据不足，继续挖相关关键词或补数据后再决定是否进入候选名单
REJECT = 本次证据下该 keyword product pool 不保留为候选名单
INSUFFICIENT_DATA = 当前资料不足，不能判断
```

硬筛选规则：

```txt
本阶段是人工找产品 / 对比产品 / 核算之前的筛选闸门。
AI 承认的 keyword product pool 才进入人工候选池。

PASS 只能用于：
- demandSignal 至少 medium
- dataConfidence 至少 medium
- reviewHealth / competitionOpenness / improvementOpportunity 中有足够正向证据支持人工继续验证
- 没有足以阻断人工阶段的核心风险

REJECT 必须用于：
- full package 可读且证据足够
- demandSignal weak 或 insufficient，或搜索结果显示需求不可行动
- reviewHealth weak 或 insufficient 且差评/低星/投诉无法形成可改良机会
- priceCeiling weak 或 insufficient，显示价格带不支持后续核算
- competitionOpenness weak 或 insufficient，显示关键词池被强品牌、广告或同质化严重封闭
- improvementOpportunity weak 或 insufficient，无法找到值得人工继续对比的改良切入点

WATCH 只能用于：
- 有局部正向信号，但证据混合
- 更适合挖相关关键词或补数据后再判断

INSUFFICIENT_DATA 只能用于：
- package 不可读
- search / detail / review 核心证据缺失
- dataConfidence insufficient

禁止为了礼貌、保守或避免否定而把应当 REJECT 的 keyword product pool 标成 WATCH。
```

边界：

```txt
PASS 不是最终选品。
PASS 不是采购、打样、压货、投广告、利润结论。
REJECT 不是全网产品终局无价值结论。
关键词评审只决定该关键词是否进入下一阶段人工候选池。
真正选品仍需要人工进行供应商、成本、合规、运营、评论、类目竞争、样品验证等复杂对比。
```

默认 AI provider：

```txt
gpt-web-chat
```

禁止把关键词评审 prompt 写成最终产品裁决 prompt。

### Keyword Evidence Navigation 深度

`keyword-{keywordId}-opportunity-review-input.json` / `inline-evidence-navigation.json` 是 GPT Web Chat 的快速阅读目录，不是深度研判唯一资料源。GPT Web Chat 做关键词候选池筛选时，必须读取 keyword full evidence package 的核心文件。

必须投喂：

```txt
detailEvidence
fieldDisclosureMap
reviewCoverage
reviewSamples.pageIndex
reviewSamples.reviewerName
reviewSamples.reviewDate
reviewSamples.variant
reviewSamples.helpfulCountIfVisible
reviewSamples.reviewImagesIfVisible
reviewSamples.reviewVideosIfVisible
reviewSamples.reviewLanguage
reviewSamples.reviewRegionIfVisible
reviewSamples.rawReviewTextSnapshot
```

`detailEvidence` 必须覆盖：

```txt
brand / sellerOrStoreIfVisible / currentPrice / originalPriceDiscountCouponIfVisible
mainImage / allVisibleImages / visibleVideoInfo
bulletPoints / aboutThisItem / productDescription
aPlusContentIfVisible / aPlusImageUrls
variationOptions / colorSizeStyleOptions
productInformation / technicalDetails / additionalInformation
bestSellersRankIfVisible / categoryPathIfVisible / rating / reviewCount / starDistribution
qaContentIfVisible / frequentlyBoughtTogetherIfVisible / customersAlsoBoughtIfVisible
compareWithSimilarItemsIfVisible / deliveryInformation / returnInformation
allOtherVisibleProductParameters / rawVisibleTextSnapshot
```

字段缺失表达：

```txt
status = extracted | not_present | blocked | unsupported_structure | manual_required | failed | extractor_missing
```

页面没有该字段 = `not_present`。  
抓取器缺字段 = `extractor_missing`，这不是可用证据，必须 FAIL 或降级为人工处理。  
关键词评审 prompt 必须要求 GPT Web Chat 读取 `detailEvidence` / `fieldDisclosureMap`，不能根据裸 `null` 猜测。

GPT Web Chat 输入上限：

```txt
AMAZON_KEYWORD_OPPORTUNITY_REVIEW_MAX_INPUT_CHARS >= 900000
```

原因：关键词级机会评审需要读取前 30 个产品的深度详情、图片索引和完整可访问评论文件。内联导航可以帮助 GPT 定位文件，但不能代替 full package。

### GPT Web Chat source restore 连续性

当 Amazon 产品挖掘的 GPT Web Chat 已经捕获有效输出，但浏览器无法恢复到投喂前 source tab 时：

```txt
promptContractId startsWith amazon-product-mining-
完成响应捕获后关闭 GPT Web Chat provider tab
restoredSourcePage = false
provider proof 保留该事实
flow 继续进入下一 Amazon 挖掘步骤
```

原因：Amazon mining 下一步会打开专用 Amazon 工作标签，source tab 恢复失败不是业务证据失败；GPT provider tab 不关闭会残留为旧 active tab，可能让后续 BrowserController DOM 提取打到过期页面。

禁止扩大适用范围：

```txt
Deep Research / Facebook / invoice upload / other prompt contract 仍 fail closed
不得新增 fallback provider
不得新增第二导出链路
不得隐藏 restoredSourcePage=false
不得保留已完成的 Amazon GPT provider tab 干扰当前 Amazon 工作标签
```

异常：

```txt
AI 不可用 -> review.status = manual_required
AI 输出越权或非结构化 -> review.status = failed
keyword full package integrity failed -> review.status = manual_required
文件上传不可用 -> review.status = manual_required
资料包不完整 -> decision = INSUFFICIENT_DATA 或 review.status = manual_required
```

### REJECT 后证据保留

当 keyword opportunity review 返回：

```txt
status = completed
decision = REJECT
```

只能标记该关键词不进入候选名单，并保留可复核证据链：

```txt
retain search results under keywordId
retain keyword-owned search-result/product links
retain product details and reviews
retain related exception rows
retain keyword full package
retain package integrity proof
retain AI reading contract and handoff prompt
retain minimal keyword record for historical deduplication
retain raw AI response and structured verdict tombstone
```

禁止：

```txt
REJECT 后物理删除完整详情/评论 bulk evidence
REJECT 后删除 keyword record 导致历史去重失效
inline-only 或不完整资料触发不可逆清理
```

后续如需物理空间治理，只能进入独立归档/清理流程，不能由关键词研判阶段自动删除。

---

## 15. 阶段 13：任务级结构化数据包生成

固定产物：见法案 [010] Section。

### 数据包内容

```txt
taskInformation
marketplaceAndMarket
aiKeywordRequestRecords
historicalKeywordDeduplicationNotes
actualMinedKeywordList
keywordSearchSummaries
firstPageProductLists
completeProductDetailRecords
fullAccessibleReviewRecords
pageSnapshotIndexes
failureExceptionManualRequiredRecords
dataCompletenessStatistics
advancedAiReadableIndex
```

### 包内目录结构

固定最终产物名仍受法案 [010] 约束；当前生产实现把 root package 与固定交付物放入 package 根目录，并把可追溯证据按 section 落入分层子目录：

```txt
amazon-product-mining-package-{taskId}/
  amazon-product-mining-package.json
  00-master-report/
    master-report.html
    Amazon-Product-Mining-Master-Evidence-Report.pdf
  01-manifest/
    manifest.json
    task-scope.json
    package-schema.json
    evidence-index.json
    image-evidence-index.json              # mode = url_only
    package-file-hashes.json
    business-boundary-notice.md
  02-keyword-search-evidence/
    keyword-{keywordId}/
      keyword-summary.json
      search-page-results.json
      search-page-results.csv
      search-page-raw-visible-text.txt
  03-product-detail-evidence/
    product-{detailId}/
      product-summary.json
      product-detail.json
      product-detail-raw-visible-text.txt
      product-images-index.json
      product-source-keywords.json
  04-review-evidence/
    product-{detailId}/
      reviews.jsonl
      reviews-summary.json
      review-pages-index.json
  05-ai-handoff/
    handoff-record.json
    ai-reading-contract.md
    ai-handoff-prompt.md
  06-exception-and-completeness/
    exception-summary.json
    manual-required.json
    failed-items.json
    data-completeness-report.json
    package-integrity-report.json
```

冻结细则：

- `amazon-product-mining-package.json` 是高级 AI 可读 manifest，不得退回成只内联 products/reviews 的单大 JSON。
- `evidence-index.json` 必须索引 root package、fixed artifacts、section files、review JSONL、AI handoff 文档。
- `image-evidence-index.json` 只允许 `mode = url_only`，不得伪装成本地图片二进制仓。
- `reviews.jsonl` 必须按产品落地，保证 review 证据可逐产品流式读取。
- `package-file-hashes.json` 必须提供包内文件 hash 清单，支持 handoff 前后校验。
- `data-completeness-report.json` 与 `package-integrity-report.json` 必须诚实披露缺口与缺失产物。
- `handoff-record.json` 只在 package-integrity 通过且 manual_required 为空时进入 `ready`。

| owner | package.ts |
| 必须可追溯 | keyword -> product -> review |
| 禁止 | 给出选品结论 / 跳过失败披露 / PDF 替代结构化数据包 / 用 task package 替代 keyword review 数据库沉淀 |

---

## 16. 阶段 14：任务级 PDF 报告生成

固定产物：`Amazon-Product-Mining-Master-Evidence-Report.pdf`。

配套主报告面：`00-master-report/master-report.html`。

### PDF 内容

```txt
封面
任务信息
市场与站点
关键词列表
关键词搜索结果摘要
产品总览表
每个产品详情
评论摘要
全量评论附录或评论索引
异常与失败记录
原始证据索引
```

当前生产实现要求：

- HTML master report 与 PDF 必须引用同一套 package manifest / completeness / integrity / exception 数据。
- HTML 用于高级 AI 与人工快速通读；PDF 是固定最终产物，不得替代 package manifest。

| owner | pdf.ts |
| 优先 | 使用仓库已有 PDF 能力；不允许为 PDF 引入复杂重依赖 |
| 退化 | 无法生成 PDF 时必须 task.status=failed/manual_required，不得伪装成功 |
| 禁止 | 丢失 keyword / ASIN / URL / timestamp |

---

## 17. 阶段 15：任务级交接摘要

```txt
handoff record:
  reportRef
  masterReportHtmlRef
  packageJsonRef
  manifestRef
  taskScopeRef
  evidenceIndexRef
  imageEvidenceIndexRef
  exceptionSummaryRef
  manualRequiredRef
  failedItemsRef
  dataCompletenessReportRef
  packageIntegrityReportRef
  aiReadingContractRef
  aiHandoffPromptRef
  businessBoundaryNoticeRef
  taskScope
  dataCompletenessStatistics
  handoffStatus
```

| owner | handoff.ts |
| 禁止 | Agent 在 handoff 中输出最终选品建议 / 编造缺失证据 |
| 完成 | task.status = package_completed 且 handoffStatus = ready |

---

## 18. App 历史表面

### 18.1 APP_UI_KEYWORD_REVIEW_HISTORY

Amazon product mining 页面必须固定为：

```txt
Amazon Product Mining
  -> Task Publish Area
  -> Latest Task Summary
  -> Keyword Opportunity Review History
```

任务发布区已经存在，
本轮只能保留并轻量优化说明、布局、默认值和提交反馈。

历史表是本轮核心价值区，
只展示关键词级 AI 研判，不做最终选品、采购、利润、库存或广告动作。

### 18.2 历史表字段

历史表最少必须显示：

```txt
Created At
Task ID
Marketplace
Target Market
Keyword
Decision
Human Next Step
Demand Signal
Review Health
Price Ceiling
Competition Openness
Improvement Opportunity
Data Confidence
Product Count
Review Count
Package Integrity
Data Completeness
Status
Package
AI Review
Reason / Evidence Summary
```

若当前后端没有某项字段，必须显示 `missing` / `not_available`，不得伪造。

### 18.3 筛选与排序

最低 P0 筛选：

```txt
Decision filter
Keyword search
Marketplace filter
```

允许扩展：

```txt
Task ID filter
Target market text filter
Human next step filter
Data confidence filter
Package integrity filter
```

必须支持排序：

```txt
Created At desc                # 默认
Decision priority             # PASS -> WATCH -> INSUFFICIENT_DATA -> REJECT
Data Confidence
Review Count
Product Count
```

### 18.4 详情展开

每行必须支持 expandable row 或等价展开面。

展开后至少显示：

```txt
AI Review Summary
Evidence Refs
Missing Evidence
Risk Points
Package Ref
AI Raw Response Ref
Master Evidence Report Ref
Data Completeness Report Ref
Package Integrity Report Ref
Exception Summary Ref
```

禁止只显示 verdict，不显示理由或证据入口。

### 18.5 允许与禁止按钮

允许：

```txt
Open Package
Open AI Review
Open Evidence Index
Refresh
```

禁止：

```txt
Buy
Purchase
Sample Now
Launch Listing
Run Ads
Final Pick
Procurement
Inventory
Profit
```

### 18.6 状态与真相源

必须提供：

```txt
No keyword opportunity reviews yet.
Run an Amazon product mining task and complete AI keyword review to populate this table.

Loading reviews...
Failed to load keyword reviews: {reason}
Retry
```

真相源规则：

```txt
优先读取 amazon_mining_keyword_opportunity_reviews
App 不得使用 localStorage 作为历史表真相源
App 不得常驻 fixture / demo rows
App 不得扫描 raw package 生成 verdict
App 不得在前端计算 PASS / WATCH / REJECT / INSUFFICIENT_DATA
```

### 18.7 Route / Read Model 契约

App 允许读取：

```txt
GET /api/amazon-product-mining/keyword-reviews?taskId=
GET /api/amazon-product-mining/keyword-review?reviewId=
POST /api/amazon-product-mining/keyword-review/manual-ingest
```

owner read model 必须从持久化记录组装：

```txt
task scope
marketplace / targetMarket
keyword review verdict
product count
review count
task-level report refs
```

### 18.8 App UI Flow

```txt
APP_LOAD
-> LOAD_LATEST_TASK
-> LOAD_KEYWORD_REVIEW_HISTORY
-> IF_LATEST_RUNNING_START_STATUS_POLL
-> RENDER_FILTERS
-> RENDER_HISTORY_TABLE
-> USER_FILTERS_DECISION_OR_KEYWORD
-> USER_PAUSES_CONTINUES_OR_TERMINATES_TASK
-> USER_OPENS_PACKAGE_OR_AI_REVIEW
```

禁止出现：

```txt
USER_BUYS
USER_SAMPLES
USER_LAUNCHES_LISTING
USER_RUNS_ADS
USER_SELECTS_WINNER
```

---

## 19. 状态机汇总

### task status

`created → keyword_generating → keyword_ready → mining → packaging → package_completed`

`failed` / `manual_required` 可在任何阶段进入。

### keyword status

`pending → searching → search_completed → completed`

`completed_with_errors` / `failed` / `manual_required` 终态分支。

### product status

`pending_detail → detail_extracting → detail_completed → review_extracting → completed`

`completed_with_errors` / `failed` / `manual_required` 终态分支。

### review extraction result

`reviews_completed | reviews_completed_with_limit | reviews_manual_required | reviews_failed | reviews_not_present`

### handoff status

`not_started → ready`

`failed` 终态分支。

### keyword review status

`completed | manual_required | failed`

### keyword review decision

`PASS | WATCH | REJECT | INSUFFICIENT_DATA`

---

## 20. 失败策略

### 非终止失败（continue）

- 单个关键词失败
- 单个产品详情失败
- 单个产品评论页失败
- 部分评论页失败
- ASIN 不可解析但 URL 可保存
- 字段缺失
- 页面结构部分变化

处理：记录失败原因 → 保存已有证据 → 继续下一项 → 最终 `completed_with_errors`。

字段失败裁决：

```txt
页面有但未提取 = FAIL
页面无该字段 = not_present
页面受限 = manual_required / blocked
结构变化无法可靠识别 = unsupported_structure
schema 有字段但无 extractor = extractor_missing = FAIL
```

### 终止 / 待人工处理

- marketplace 未选择
- targetMarket 未选择
- Amazon 登录墙
- captcha
- 2FA / account security
- account risk
- rate limit
- 任务没有任何有效关键词
- 数据包生成失败
- PDF 生成失败
- keyword review 非结构化或越权
- 外部高级 AI 不可用

处理：`failed` 或 `manual_required`，不得伪装完成，不得绕过限制。

---

## 21. 质检规划

### Owner inspector 必查

```txt
1. 法案文件存在且 status active（draft → active 切换完成）
2. 本施工图存在
3. src/plugins/amazon-product-mining/** 存在
4. flow / schema / keyword / search / product-detail / reviews / package / pdf / handoff / storage / logging / result / index 存在或有合并说明
5. app surface 不包含业务步骤（AST 检查：不调用能力组私有实现 / 不直接 DOM）
6. ability group 不包含 Amazon-specific workflow（AST 检查：src/capabilities/** 不引用 amazon-product-mining 业务符号）
7. 不存在 amazon-product-mining ability group
8. AI 返回不含 nextAction / actionPlan / selector / coordinate / browserCommand（AST 检查 prompt 与 response schema）
9. 搜索结果入库先于详情页（flow.ts state machine assert）
10. 详情页提取先于评论提取（flow.ts state machine assert）
11. 评论分页逐页保存（reviews.ts 调用 storage.persistReviewPage 在 paginate loop 内）
12. PDF 不替代结构化数据包（package.ts 必须产出 JSON）
13. 固定最终产物 (package.json / report.pdf / evidence-index.json / exception-summary.json) 存在路径声明
14. failed / manual_required / completed_with_errors 状态存在
15. exception summary 在 package.ts 中被构建
16. keyword review 表、schema、prompt、manual-ingest route、app history table 存在并受控
17. keyword review decision 与 humanNextStep enum 固定且无越权值
18. keyword 完成后先 review 再进入下一 keyword
16. 不读取 cookie / token / localStorage / sessionStorage（AST 字符串扫描 + property access 扫描）
17. 不存在 fallback / shadow / bridge / legacy / compatibility 字样（AST identifier 扫描）
18. Agent 不输出 final product selection / purchase decision / profit conclusion（AST result type 字段扫描）
19. inspector 自身真实使用 context.project（满足 audit-truth 元法案）
```

### Acceptance 必查

```txt
最小任务输入可创建 task
没有 marketplace 时失败
没有 targetMarket 时失败
AI keyword raw response 被保存
历史关键词去重生效
本任务关键词去重生效
重复关键词不会进入挖掘队列
搜索首页提取所有 fixture 可见产品
搜索结果先入库再详情页
详情页字段缺失不崩溃
评论分页不跳页
评论逐页保存
评论受限记录 manual_required / failed
同 ASIN 多关键词关系保留
数据包包含 keyword -> product -> review 追溯
PDF 生成后不替代结构化数据
handoff 记录包含完整性统计
Agent 不输出最终选品结论
```

### 完整入口

```bash
npm run ci:full
```

`ci-full.ts` 必须持续包含 `acceptance:amazon-product-mining`，否则法案 [012] 不算落地。

---

## 21. 当前生产实现锚点

```txt
flow.ts：唯一任务状态机与顺序主链
keyword.ts：AI 关键词生成与去重
search.ts：Amazon 搜索首页全量可见提取
product-detail.ts：详情页完整可见信息提取
reviews.ts：评论分页与逐页保存
package.ts / pdf.ts / handoff.ts：最终交付物与高级 AI 交接
workbench-amazon-product-mining-routes.ts：最小 API surface
workbench-home-page.ts / workbench-home-client.ts：首页入口、状态、latest、export
inspector.ts：治理与边界执法
amazon-product-mining-*.acceptance.ts：业务与 UI 验收
```

任何变更都必须重新通过 typecheck、Amazon acceptance、Amazon audit 与 ci:full。

---

## 22. 最终完成标准

```txt
法案 active（不再 draft）
施工图与法案一致
插件根目录存在且 owner 清晰
唯一 flow 可审计
关键词去重可验收
搜索首页全量可见提取可验收
详情页完整信息提取可验收
评论分页提取可验收
结构化数据包可生成
PDF 可生成
高级 AI handoff 可记录
异常路径可记录
owner inspector 可运行
acceptance 可运行
npm run ci:full PASS
```

任何 warning / partial pass / soft pass / 手工跳过 / 手工修改 generated artifact，都不能算完成。
