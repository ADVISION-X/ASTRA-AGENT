---
name: "Amazon Product Mining"
description: "Governs the Amazon product mining job flow: keyword AI feeding with historical deduplication, first-page Amazon search extraction, full visible product detail extraction, accessible review pagination, structured data package, PDF report, and advanced AI handoff."
applyTo: "src/plugins/amazon-product-mining/**,src/app/workbench-amazon-product-mining-routes.ts,scripts/acceptance/amazon-product-mining-*.acceptance.ts,scripts/audit/domains/amazon-product-mining/**,package.json"
---

# Amazon Product Mining

status: active
version: 2026-05-26
capabilityDomain: amazon-product-mining
tier: P0
enforcementMode: machine-blocking

## 0. Production Freeze Status

当前 Amazon 产品挖掘已进入 active job flow governance。

所有法条为 active。

```txt
后续只能按法案变更流程修改。
任何收口修复都必须继续遵守单链、无兼容、无 fallback、无第二链路。
```

generated artifacts 仍然只能由审计生成链产出，不能手工编辑作为源真相。

## 1. Identity

Amazon Product Mining 是 GrassEye 的一个独立业务 Job Flow。

它只执行：

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
  -> KEYWORD_PACKAGE_SLICE_BUILD
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

唯一 owner：`src/plugins/amazon-product-mining/**`。

最高原则：

```txt
Agent 负责挖掘、提取、保存、打包、交接。
Agent 负责关键词级机会筛选研判的 prompt、raw response、结构化 verdict 校验、入库与历史展示。
关键词级研判只判断 keyword product pool 是否值得继续研究。
高级 AI 负责基于完整数据包做最终选品决策。
Agent 不做最终产品价值裁决。
```

App shell 只允许：创建任务 / 查询任务 / 读取结果 / 下载导出 / 读取关键词级研判历史。

## 2. Architecture Binding

Amazon Product Mining 归属 GrassEye 单线纵向架构：

```txt
User Requirement
-> Job Mediator
-> Job Flow Library (this plugin)
-> Ability Groups (dom-automation, ai-input-gateway, forensics-persistence)
-> Child Abilities
-> Evidence / Runtime Logs / Result Records
```

允许复用既有能力组：

- `dom-automation`（搜索页 / 详情页 / 评论页 DOM 提取与等待）
- `ai-input-gateway`（关键词生成投喂与原始响应捕获）
- `forensics-persistence`（截图 / DOM 快照 / failure 记录）
- `runtime-log-spine`（mission / round / stage / capability / artifact 日志）
- `local-browser-session`（真实 Chrome 会话）
- `local-persistence-schema`（SQLite + 文件库）

禁止：

- 新建 amazon-product-mining ability group
- 新建第二 mission loop、第二日志链、第二证据链
- 把 Amazon 业务步骤塞进 `src/app`、`src/lib`、`src/capabilities`、`src/mediator`

## [GRASSEYE-AMAZON-PRODUCT-MINING-001-V1] Independent Job Flow Sovereignty

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast+persisted-record",
  "summary": "Amazon Product Mining must live as one explicit business job flow under src/plugins/amazon-product-mining and must not become a universal product-discovery agent, ERP, planner, or marketplace crawler framework.",
  "appliesTo": [
    "src/plugins/amazon-product-mining/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "forbidden": [
    "Amazon mining flow placed under src/capabilities, src/mediator, src/lib, or src/app.",
    "Reusing facebook-product-video-mining as Amazon mining entrypoint.",
    "Universal marketplace crawler abstraction owning Amazon mining state.",
    "ERP, profit calculator, or purchase-decision modules introduced into the plugin owner.",
    "Amazon-specific workflow placed inside any ability group."
  ]
}
```

### 法条

唯一 owner：`src/plugins/amazon-product-mining/**`。

业务流程禁止放入：

- `src/plugins/facebook-product-video-mining/**`
- `src/plugins/deep-research-analysis/**`
- `src/capabilities/**`
- `src/mediator/**`
- `src/lib/local-runtime/**`
- `src/app/**`（仅允许最小 routes 转发）

### 禁止漂移

- ERP 漂移
- 利润测算漂移
- 采购决策漂移
- 选品裁决漂移
- 多平台爬虫漂移
- 通用 Agent 漂移
- AI planner 漂移
- 能力组业务化漂移
- Deep Research 子流程漂移
- Facebook mining 复用错位漂移

## [GRASSEYE-AMAZON-PRODUCT-MINING-002-V1] Single Fixed Flow

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+fs+acceptance",
  "summary": "Amazon Product Mining must have exactly one active production flow: task intake, AI keyword generation with historical deduplication, keyword queue, Amazon first-page search extraction, product detail extraction, full accessible review extraction, persistence, package generation, PDF generation, and handoff to advanced AI.",
  "appliesTo": [
    "src/plugins/amazon-product-mining/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "forbidden": [
    "Legacy or fallback flow alongside the production flow.",
    "Lite / compact / optional package as an alternative final artifact.",
    "Shadow product decision branch in the flow.",
    "AI next-action planner driving the browser.",
    "Multiple execution modes for the same mining demand."
  ]
}
```

### 法条

唯一固定流程见 Section 1。

禁止存在 second chain、shadow flow、fallback flow、compatibility bridge、lite/compact package。

## [GRASSEYE-AMAZON-PRODUCT-MINING-003-V1] Agent Forbidden From Final Product Adjudication

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "prompt+ast+export",
  "summary": "Amazon Product Mining Agent must not output final product selection, product investment decision, purchase decision, or profit conclusion; it only produces evidence packages for advanced AI decision.",
  "appliesTo": [
    "src/plugins/amazon-product-mining/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "forbidden": [
    "Final product selection output produced by Agent code.",
    "Purchase / sampling / listing / inventory / ad-budget recommendation produced by Agent code.",
    "Profit margin conclusion produced by Agent code.",
    "AI prompt asking the model to pick winning products inside this flow."
  ]
}
```

### 法条

Agent 允许输出：关键词记录 / 搜索结果记录 / 产品详情记录 / 评论记录 / 页面证据索引 / 结构化数据包 / PDF 报告 / 异常说明 / 交接状态。

Agent 禁止输出：最终选品结论 / 这个产品一定赚钱 / 是否采购 / 是否打样 / 是否上架 / 利润率结论 / 库存建议 / 广告预算建议。

## [GRASSEYE-AMAZON-PRODUCT-MINING-004-V1] Keyword Generation Must Deduplicate

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "prompt+persisted-record",
  "summary": "AI keyword generation must receive existing mined keywords and the system must deduplicate against historical and current-task keywords before mining begins.",
  "appliesTo": [
    "src/plugins/amazon-product-mining/amazon-product-mining.keyword.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts"
  ],
  "forbidden": [
    "AI keyword request without injecting historical mined keywords.",
    "Executing AI natural-language output directly as mining queue.",
    "Mining the same keyword again without an explicit duplicate marker.",
    "Agent fabricating keywords to fill requested count."
  ]
}
```

### 法条

向 AI 请求关键词时必须投喂：目标 Amazon 站点 / 目标市场 / 产品方向 / 历史已挖掘关键词 / 本次禁止重复关键词 / 本次数量要求 / 结构化输出要求。

返回后必须：解析 → 清洗 → 历史去重 → 本任务去重 → 入队 → 来源记录。

## [GRASSEYE-AMAZON-PRODUCT-MINING-005-V1] Search First Page Full Visible Extraction

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "dom+persisted-record+snapshot",
  "summary": "For each keyword, the system must extract all visible products on the first Amazon search results page and preserve rank, sponsored status, URL, visible commercial fields, and raw page evidence.",
  "appliesTo": [
    "src/plugins/amazon-product-mining/amazon-product-mining.search.ts"
  ],
  "forbidden": [
    "Extracting only a subset of visible first-page products.",
    "Losing rankPosition or isSponsored on result items.",
    "Dropping a product because ASIN is not visible while productUrl exists.",
    "Opening product detail before search results are persisted.",
    "Mining beyond the first search results page in this flow."
  ]
}
```

### 必须提取字段

`keyword, searchUrl, rankPosition, isSponsored, title, productUrl, asinIfAvailable, mainImageUrl, price, originalPriceOrDiscountIfVisible, rating, reviewCount, primeOrFbaFlagIfVisible, couponTextIfVisible, deliveryTextIfVisible, rawVisibleTextSnapshot`

## [GRASSEYE-AMAZON-PRODUCT-MINING-006-V1] Product Detail Full Visible Extraction

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-006-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "dom+snapshot+persisted-record",
  "summary": "For each stored search result item, the system must open the product detail page and extract all currently visible and accessible product information before review extraction.",
  "appliesTo": [
    "src/plugins/amazon-product-mining/amazon-product-mining.product-detail.ts"
  ],
  "forbidden": [
    "Extracting only shallow fields like title/price/rating.",
    "Throwing on missing optional fields; missing fields must be null or empty array.",
    "Missing raw visible text snapshot for the detail page.",
    "Deleting search-result evidence when detail extraction fails."
  ]
}
```

### 必须提取字段

`asin, title, brand, sellerOrStoreIfVisible, currentPrice, originalPriceDiscountCouponIfVisible, mainImage, allVisibleImages, visibleVideoInfo, bulletPoints, aboutThisItem, productDescription, aPlusContentIfVisible, variationOptions, colorSizeStyleOptions, productInformation, technicalDetails, additionalInformation, bestSellersRankIfVisible, categoryPathIfVisible, rating, reviewCount, starDistribution, qaContentIfVisible, frequentlyBoughtTogetherIfVisible, customersAlsoBoughtIfVisible, compareWithSimilarItemsIfVisible, deliveryInformation, returnInformation, allOtherVisibleProductParameters, rawVisibleTextSnapshot`

## [GRASSEYE-AMAZON-PRODUCT-MINING-007-V1] Accessible Review Pagination Full Extraction

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-007-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "dom+pagination+persisted-record",
  "summary": "For each product, the system must paginate and persist all currently accessible reviews under the current environment, account, region, language, and sorting condition; bypassing restrictions is forbidden.",
  "appliesTo": [
    "src/plugins/amazon-product-mining/amazon-product-mining.reviews.ts"
  ],
  "forbidden": [
    "Skipping review pages (no jumping ahead).",
    "Extracting only the first review page.",
    "Persisting only AI summaries in place of raw reviews.",
    "Bypassing captcha, login walls, region restrictions, or platform risk controls.",
    "Deleting product-detail records when review extraction fails."
  ]
}
```

### 全量评论定义

「全量评论」= 当前页面环境 / 当前账号状态 / 当前地区 / 当前语言 / 当前排序条件下可正常访问的全部评论。

### 必须保存字段（每条评论）

`reviewIdIfAvailable, reviewerName, rating, reviewTitle, reviewBody, reviewDate, verifiedPurchase, variant, helpfulCountIfVisible, reviewImagesIfVisible, reviewVideosIfVisible, reviewLanguage, reviewRegionIfVisible, rawReviewTextSnapshot`

## [GRASSEYE-AMAZON-PRODUCT-MINING-MAXIMUM-VISIBLE-EXTRACTION-V1] Maximum Visible Extraction And Honest Field Disclosure

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-MAXIMUM-VISIBLE-EXTRACTION-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "dom+persisted-record+completeness+acceptance",
  "summary": "Every visible and accessible Amazon search/detail/review field that exists on the current page must be maximally extracted, while every missing or blocked field must be disclosed with an honest reason in completeness and exception artifacts.",
  "appliesTo": [
    "src/plugins/amazon-product-mining/amazon-product-mining.search.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.product-detail.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.reviews.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.package.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.package-*.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.master-report*.ts",
    "scripts/audit/domains/amazon-product-mining/**/*.ts",
    "scripts/acceptance/amazon-product-mining-*.acceptance.ts",
    "docs/法案辅助文件/GrassEye Amazon 产品挖掘施工图.md"
  ],
  "forbidden": [
    "Schema fields left as constant null or [] without field-level reason disclosure.",
    "Treating extractor_missing as a valid null outcome.",
    "Returning completed while review pagination stopped because of a hidden default page cap.",
    "Marking page-visible fields as not_present without executing the owner extraction strategies for that field.",
    "Package completeness or master report hiding missing-field reasons behind plain null or empty-array output."
  ]
}
```

### 法条

最大化提取是当前 Amazon 挖掘 owner 的硬约束：

```txt
页面有，就必须抓。
页面没有，必须诚实为空。
抓不到，必须说明为什么。
```

#### 字段主权

- schema 字段不是装饰。
- schema 中存在的字段，必须满足二选一：
  - 真实 DOM 提取成功并落库
  - 真实证明 `not_present | blocked | unsupported_structure | manual_required | failed`
- `extractor_missing` 不是允许结果；它是 P0 失败，必须进入 completeness，并由 audit/acceptance 阻断。

#### 静默空值禁令

禁止：

- 页面有值但代码直接写 `null`
- 页面有值但代码直接写 `[]`
- selector / section / table / list / aria / visible-text 策略未尝试就宣告缺失
- package / master report 仅输出 `null`、`[]` 而不披露原因

#### 评论分页真相

- 评论分页默认必须持续到 `没有 next page`。
- 只有以下情况允许停止：`platform blocked`、`manual_required`、显式 `hardLimit`、显式安全运行上限。
- 停止原因必须进入 `review-pages-index`、`data-completeness-report`、`exception-summary`。
- 因 `hardLimit` 或安全上限停止时，产品或关键词不得伪装成全量 `completed`。

#### 完整度披露

每个产品与关键词必须至少披露：

```txt
missingFields
notPresentFields
blockedFields
unsupportedFields
extractorMissingFields
warnings
dataCompletenessScore
```

Master Report 必须显示字段缺失原因，不能只显示空值。

## [GRASSEYE-AMAZON-PRODUCT-MINING-008-V1] Raw Evidence Sovereignty

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-008-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "snapshot+persisted-record+hash",
  "summary": "Raw visible page text, extracted records, page URLs, timestamps, and evidence indexes are sovereign records; structured summaries and PDF sections must not replace raw evidence.",
  "appliesTo": [
    "src/plugins/amazon-product-mining/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "forbidden": [
    "Structured summary replacing raw page text.",
    "PDF section replacing structured data package.",
    "AI summary replacing raw review records.",
    "Discarding URLs / timestamps / failure reasons."
  ]
}
```

### 必须保存

AI keyword raw response / keyword parse result / search page raw visible text / search result structured items / product detail raw visible text / product detail structured record / review page raw visible text 或 per-review raw text / review structured records / URLs / timestamps / failure reasons / evidence indexes。

## [GRASSEYE-AMAZON-PRODUCT-MINING-009-V1] Platform Restriction Honest Failure

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-009-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "runtime-log+failure-record",
  "summary": "Login walls, captchas, account risk pages, region restrictions, unavailable pages, and platform blocks must produce failed or manual_required records; bypassing restrictions is forbidden.",
  "appliesTo": [
    "src/plugins/amazon-product-mining/**/*.{ts,tsx,js,jsx,mjs}"
  ],
  "forbidden": [
    "Bypassing captcha, login walls, 2FA, region restrictions, or platform risk controls.",
    "Reading cookie / token / localStorage / sessionStorage.",
    "Fabricating success when extraction is blocked.",
    "Treating partial pass / warning as completed."
  ]
}
```

### 必须诚实记录的情况

`loginRequired, captcha, twoFactorOrAccountSecurity, rateLimited, accountRisk, regionRestricted, productUnavailable, reviewUnavailable, pageStructureUnsupported, paginationStoppedByRestriction`

允许的失败状态：`failed`、`manual_required`、`completed_with_errors`。

## [GRASSEYE-AMAZON-PRODUCT-MINING-010-V1] Fixed Final Artifacts: Data Package + PDF

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-010-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+export+hash",
  "summary": "The final artifacts of Amazon Product Mining are a structured data package, a PDF report, an evidence index, and an exception summary; no alternative final artifact chain may replace them.",
  "appliesTo": [
    "src/plugins/amazon-product-mining/amazon-product-mining.package.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.pdf.ts"
  ],
  "forbidden": [
    "PDF-only delivery without structured data package.",
    "AI summary-only delivery without raw evidence.",
    "Multiple conflicting versions of the data package.",
    "Manually editing generated artifacts as source of truth."
  ]
}
```

### 固定最终产物

```txt
amazon-product-mining-package-{taskId}/
  amazon-product-mining-package.json
  00-master-report/Amazon-Product-Mining-Master-Evidence-Report.html
  00-master-report/Amazon-Product-Mining-Master-Evidence-Report.pdf
  01-manifest/evidence-index.json
  06-exception-and-completeness/exception-summary.json
```

固定最终交付名必须与 package root 同步；不得回退成旧的平铺 pdf/json 文件名。

## [GRASSEYE-AMAZON-PRODUCT-MINING-011-V1] Advanced AI Handoff Boundary

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-011-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "export+prompt+handoff-record",
  "summary": "Advanced AI handoff must receive the PDF report, structured data package, raw evidence index, exception summary, and task scope; the handoff must disclose incomplete data and must not invent missing evidence.",
  "appliesTo": [
    "src/plugins/amazon-product-mining/amazon-product-mining.handoff.ts"
  ],
  "forbidden": [
    "Handoff missing PDF / package / evidence index / exception summary.",
    "Handoff inventing evidence not present in the package.",
    "Handoff carrying final product selection produced by Agent."
  ]
}
```

## [GRASSEYE-AMAZON-PRODUCT-MINING-012-V1] Audit + Acceptance + CI-FULL Binding

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-012-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "acceptance+audit-plan+ci-full",
  "summary": "Amazon Product Mining production readiness must be enforced by owner inspector, acceptance tests, generated audit plan, and npm run ci:full; warning-only or partial pass must not be called complete.",
  "appliesTo": [
    "scripts/audit/domains/amazon-product-mining/manifest.json",
    "scripts/audit/domains/amazon-product-mining/inspector.ts",
    "scripts/acceptance/amazon-product-mining-*.acceptance.ts",
    "package.json",
    "scripts/audit/ci-full.ts"
  ],
  "forbidden": [
    "Warning-only enforcement for P0 clauses.",
    "Hand-editing generated registry / matrix / plan as source of truth.",
    "Bypassing codex-entry-gate.",
    "Local-only acceptance that is not wired into ci:full.",
    "Treating partial pass / soft pass as complete."
  ]
}
```

### 完整入口

```bash
npm run ci:full
```

Amazon owner 的 package/export 面还必须保留：

```bash
npm run acceptance:amazon-product-mining
npm run audit:amazon-product-mining
npm run amazon-product-mining:package:fixture
```

## [GRASSEYE-AMAZON-PRODUCT-MINING-013-V1] Fixed Master Evidence Package Topology

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-013-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+export+acceptance",
  "summary": "Amazon Product Mining must emit one fixed master evidence package root with the frozen section tree, fixed report names, fixed manifest names, and fixed handoff document bundle.",
  "appliesTo": [
    "src/plugins/amazon-product-mining/amazon-product-mining.package-layout.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.package.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.package-evidence-sections.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.pdf.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.handoff.ts"
  ],
  "forbidden": [
    "Alternative package directory tree for the same task.",
    "Flattening review evidence, handoff docs, or completeness docs back into one loose JSON blob.",
    "Changing fixed report / manifest / handoff artifact names without law change.",
    "PDF or handoff docs stored outside the fixed package root."
  ]
}
```

### 固定目录树

```txt
amazon-product-mining-package-{taskId}/
  amazon-product-mining-package.json
  00-master-report/
  01-manifest/
  02-keyword-search-evidence/
  03-product-detail-evidence/
  04-review-evidence/
  05-ai-handoff/
  06-exception-and-completeness/
```

package root 是唯一最终资料包根。不得为高级 AI 再造第二套 lite / compact / flattened 目录。

## [GRASSEYE-AMAZON-PRODUCT-MINING-014-V1] Completeness Integrity And Handoff Readiness Gate

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-014-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+handoff-record+acceptance",
  "summary": "The package must disclose image evidence in url_only mode, persist per-product reviews.jsonl, emit completeness and integrity reports, and only mark handoff ready when manual-required reasons are empty and package integrity passes.",
  "appliesTo": [
    "src/plugins/amazon-product-mining/amazon-product-mining.package.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.package-evidence-sections.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.handoff.ts"
  ],
  "forbidden": [
    "image-evidence-index pretending to be downloaded binary proof instead of url_only evidence.",
    "Mixing all review rows into one task-wide file that loses per-product traceability.",
    "handoffStatus=ready while manualRequiredReasons is non-empty.",
    "handoffStatus=ready while packageIntegrityStatus is failed.",
    "Hiding missing artifacts, missing fields, or partial review coverage."
  ]
}
```

### 冻结细则

- `01-manifest/image-evidence-index.json` 只允许 `mode = url_only`
- `04-review-evidence/product-{detailId}/reviews.jsonl` 必须逐产品落地
- `06-exception-and-completeness/data-completeness-report.json` 必须披露缺字段、评论限制、失败与人工接管
- `06-exception-and-completeness/package-integrity-report.json` 必须先于 handoff readiness 生效
- `05-ai-handoff/handoff-record.json` 只有在 `manualRequiredReasons=[]` 且 `packageIntegrityStatus=pass` 时才允许 `ready`

## [GRASSEYE-AMAZON-PRODUCT-MINING-015-V1] Zip Delivery Wrapper Sovereignty

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-015-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+export+acceptance",
  "summary": "Amazon Product Mining export must be able to emit amazon-product-mining-package-{taskId}.zip as a transport wrapper over the fixed package root; the zip is delivery packaging, not a second source-of-truth chain.",
  "appliesTo": [
    "src/plugins/amazon-product-mining/amazon-product-mining.package-zip.ts",
    "src/plugins/amazon-product-mining/index.ts",
    "scripts/acceptance/amazon-product-mining-package-zip.acceptance.ts",
    "scripts/acceptance/amazon-product-mining-package-fixture.ts",
    "package.json"
  ],
  "forbidden": [
    "Zip-only delivery without the package root remaining on disk as source truth.",
    "Flattened zip payload that omits amazon-product-mining-package-{taskId}/ as the archive root.",
    "Manual repack workflow outside the owner export surface.",
    "A second export chain with different files than the fixed package root."
  ]
}
```

### 法条

`amazon-product-mining-package-{taskId}.zip` 只是同一 package root 的运输壳。

它必须：

- 由 owner-local export/package command 生成
- 保留 package root 目录名为 archive 根
- 打包同一固定资料包，而不是另一套简化产物
- 可被 acceptance 与 audit surface 发现

## [GRASSEYE-AMAZON-PRODUCT-MINING-016-V1] Keyword Opportunity Review Boundary

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-016-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "flow+prompt+persisted-record",
  "summary": "Keyword opportunity review is a keywordId-scoped screening stage that judges whether a keyword product pool deserves more human research; it is not final product adjudication, procurement, profit, or launch guidance.",
  "appliesTo": [
    "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review-support.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.schema.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.storage.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.storage-schema.ts"
  ],
  "forbidden": [
    "Keyword review deciding final product selection.",
    "Keyword review outputting procurement, sampling, place-order, inventory, launch-listing, or ad-budget advice.",
    "Automatically entering procurement, sampling, listing, or launch stages from keyword verdict.",
    "Treating one keyword review as task-global product adjudication."
  ]
}
```

### 法条

- 研判单位是 `keywordId`，不是单个产品最终裁决。
- 一个 task 可包含多个 keyword，每个 keyword 必须独立生成一条 keyword opportunity review 记录。
- 研判输入必须来自该 keyword 对应的 search results、linked product details、linked reviews、image refs、completeness、exceptions。
- 外部高级 AI 不可用时，review 只能进入 `manual_required` 或 `failed`，不得伪装完成。

## [GRASSEYE-AMAZON-PRODUCT-MINING-017-V1] Keyword Opportunity Verdict Schema

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-017-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "schema+storage+response-validation",
  "summary": "Keyword opportunity review must persist one structured verdict contract with fixed decision enums, fixed dimension enums, fixed human next-step enums, and raw AI proof.",
  "appliesTo": [
    "src/plugins/amazon-product-mining/amazon-product-mining.schema.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.storage-schema.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.storage.ts",
    "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review.ts",
    "src/app/workbench-amazon-product-mining-routes.ts"
  ],
  "forbidden": [
    "Decision enum outside PASS / WATCH / REJECT / INSUFFICIENT_DATA.",
    "humanNextStep outside enter_next_validation / mine_related_keywords / reject / rerun_or_collect_more_data.",
    "Natural-language-only review without structured verdict persistence.",
    "Review existing only in PDF or handoff docs without database persistence."
  ]
}
```

### 法条

关键词研判结构化 verdict 必须固定为：

```txt
decision = PASS | WATCH | REJECT | INSUFFICIENT_DATA
demandSignal = strong | medium | weak | insufficient
reviewHealth = strong | medium | weak | insufficient
priceCeiling = strong | medium | weak | insufficient
competitionOpenness = strong | medium | weak | insufficient
improvementOpportunity = strong | medium | weak | insufficient
dataConfidence = strong | medium | weak | insufficient
humanNextStep = enter_next_validation | mine_related_keywords | reject | rerun_or_collect_more_data
```

每条 review 记录至少必须持有：

```txt
reviewId
taskId
keywordId
keyword
status
decision
demandSignal
reviewHealth
priceCeiling
competitionOpenness
improvementOpportunity
dataConfidence
evidenceRefs
missingEvidence
riskPoints
humanNextStep
aiPromptText
aiRawResponse
aiResponseRef
packageRef
keywordPackageSliceRef
failureReason
createdAt
updatedAt
```

## [GRASSEYE-AMAZON-PRODUCT-MINING-018-V1] Keyword Review History App Surface

```apex-law
{
  "lawId": "GRASSEYE-AMAZON-PRODUCT-MINING-018-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "amazon-product-mining",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "app-surface+route+acceptance",
  "summary": "The workbench must expose a keyword opportunity review history surface with task-scoped reading, decision filtering, package ref opening, AI review ref opening, and manual ingest entry for structured verdicts.",
  "appliesTo": [
    "src/app/workbench-home-page.ts",
    "src/app/workbench-home-client.ts",
    "src/app/workbench-amazon-product-mining-routes.ts",
    "src/lib/local-runtime/workbench.ts",
    "src/lib/local-runtime/workbench-handle.ts",
    "src/plugins/amazon-product-mining/index.ts"
  ],
  "forbidden": [
    "App showing only taskId/status/package ref without keyword verdict history.",
    "App exposing procurement, sampling, place-order, run-ads, or final-selection buttons for keyword review.",
    "App surfacing only natural-language review text without structured verdict fields.",
    "Route-level auto-progression into downstream business stages based on verdict."
  ]
}
```

### 法条

App 必须提供：

```txt
Keyword Opportunity Review History
按 task 读取 keyword review
按 decision 过滤 PASS / WATCH / REJECT / INSUFFICIENT_DATA
打开 package ref
打开 AI review ref
POST /api/amazon-product-mining/keyword-review/manual-ingest
```

## 4. State Contracts

### task status

`created | keyword_generating | keyword_ready | mining | packaging | package_completed | failed | manual_required`

### keyword status

`pending | searching | search_completed | completed | completed_with_errors | failed | manual_required`

### product status

`pending_detail | detail_extracting | detail_completed | review_extracting | completed | failed | manual_required`

### handoff status

`not_started | ready | handoff_completed | failed`

### keyword review status

`completed | manual_required | failed`

### keyword review decision

`PASS | WATCH | REJECT | INSUFFICIENT_DATA`

### keyword review humanNextStep

`enter_next_validation | mine_related_keywords | reject | rerun_or_collect_more_data`

## 5. Allowed / Forbidden Summary

### 允许

- 用户选择 Amazon 站点和市场
- AI 基于历史关键词生成新关键词
- Agent 解析和去重关键词
- Agent 搜索 Amazon 首页
- Agent 提取首页所有可见产品
- Agent 打开产品详情页
- Agent 提取当前可见完整产品信息
- Agent 分页提取当前可访问评论
- Agent 为每个 keyword 构建 evidence slice、生成研判 prompt、保存 raw response、校验 structured verdict、入库 keyword review
- Agent 保存原始证据和结构化记录
- Agent 生成任务级结构化数据包和 PDF
- Agent 生成任务级 handoff summary

### 禁止

- Agent 做最终选品裁决
- Agent 做利润测算 / 采购建议 / 库存管理
- Agent 在 keyword review 中输出采购 / 打样 / 压货 / 广告 / 最终选品结论
- Agent 绕过 Amazon 平台限制
- Agent 用 AI 生成浏览器下一步动作
- Agent 读取 cookie / token / localStorage / sessionStorage
- Agent 把 Amazon 业务流程放入能力组
- Agent 建立第二套日志或证据系统
- Agent 生成没有原始证据支撑的数据包

## 6. Relationship To Existing Systems

### 与 Deep Research Analysis 的关系

Amazon 产品挖掘学习 Deep Research 的原则：单一流程、全量原始记录、结构化索引不可替代 raw evidence、最终报告基于完整案卷、禁止 legacy / fallback / lite package。但 Amazon 产品挖掘不是 Deep Research 的子流程。

### 与 Facebook Product Video Mining 的关系

Amazon 产品挖掘学习 Facebook mining 的原则：独立插件 owner、固定 round / flow 顺序、失败诚实记录、导出成功候选和证据、AI 不决定浏览器下一步动作、不绕过平台限制。但 Amazon 产品挖掘不是 Facebook mining 的复用版，不能共享其业务 flow。

### 与能力组的关系

Amazon 产品挖掘只能调用能力组 public facade。Job Flow 决定流程顺序；Ability Group 执行同类动作；Child Ability 执行原子动作；Evidence / Logs 证明发生过什么；Storage 保存业务记录。

## 7. Production Freeze Enforcement

当前生产冻结面必须持续满足以下条件：

```txt
1. src/plugins/amazon-product-mining/
     amazon-product-mining.flow.ts
     amazon-product-mining.schema.ts
     amazon-product-mining.keyword.ts
     amazon-product-mining.search.ts
     amazon-product-mining.product-detail.ts
     amazon-product-mining.reviews.ts
    amazon-product-mining.keyword-review.ts
    amazon-product-mining.keyword-review-support.ts
     amazon-product-mining.package.ts
     amazon-product-mining.pdf.ts
     amazon-product-mining.handoff.ts
     amazon-product-mining.storage.ts
     amazon-product-mining.storage-schema.ts
     amazon-product-mining.logging.ts
     amazon-product-mining.result.ts
     index.ts
2. src/app/workbench-amazon-product-mining-routes.ts （最小 surface）
  3. src/app/workbench-home-page.ts 与 src/app/workbench-home-client.ts 提供 job card / panel / start / latest / export / keyword review history
3. scripts/audit/domains/amazon-product-mining/{manifest.json, inspector.ts}
  4. scripts/acceptance/amazon-product-mining-{flow,storage,keyword-dedup,search-page,detail-page,review-pagination,package,app-ui,keyword-opportunity-review,keyword-review-boundary,keyword-review-app-ui}.acceptance.ts
  5. package.json 暴露 acceptance:amazon-product-mining 与 audit:amazon-product-mining
  6. taskId 是 Amazon 产品挖掘唯一任务标识，不允许 runId 兼容别名
  7. inspector 必须真使用 context.project，不得仅靠正则/字符串匹配
  8. ci:full 持续 PASS
```

## 8. Absolute Bans

```txt
禁止手工编辑 scripts/audit/generated/* 作为源真相
禁止新增 fallback / shadow / bridge / legacy 流程
禁止 AI 返回 nextAction / actionPlan / selector / coordinate / browserCommand
禁止读取 cookie / token / localStorage / sessionStorage
禁止绕过 Amazon 登录 / 验证码 / 风控 / 地域限制
禁止 PDF 替代结构化数据包
禁止 warning-only 当 P0 通过
禁止把 partial pass 当完成
```
