# GrassEye Amazon 产品挖掘施工图

version: 2026-05-25
status: frozen-phase-1
governs: `.github/instructions/agent-rules/modules/module-amazon-product-mining.instructions.md`
capabilityDomain: `amazon-product-mining`
targetJobFlowRoot: `src/plugins/amazon-product-mining/**`

> 本施工图是法案的实现地图，不高于 active law。
> Phase 1：仅冻结法案 + 施工图。Phase 2：完成插件代码 / app surface / audit domain / acceptance / ci:full 接入，并把法案块翻 `active`。

---

## 0. 阶段定位

```txt
Phase 1（本轮已完成）
  -> module-amazon-product-mining.instructions.md （draft 法案块）
  -> 本施工图

Phase 2（后续会话）
  -> src/plugins/amazon-product-mining/** owner 实现
  -> src/app/workbench-amazon-product-mining-routes.ts
  -> scripts/audit/domains/amazon-product-mining/{manifest.json, inspector.ts}
  -> scripts/acceptance/amazon-product-mining-*.acceptance.ts
  -> package.json + ci-full.ts 白名单接入
  -> 法案 draft -> active
  -> ci:full PASS
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
-> KEYWORD_LOOP_END

-> DATA_PACKAGE_BUILD
-> PDF_REPORT_BUILD
-> ADVANCED_AI_HANDOFF
-> COMPLETE
```

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
GET  /api/amazon-product-mining/run?runId=    # 查询任务
GET  /api/amazon-product-mining/latest        # 读取最新任务
GET  /api/amazon-product-mining/export?runId= # 下载导出
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

---

## 11. 阶段 9：进入评论页

| 项 | 内容 |
| -- | -- |
| 动作 | 定位评论入口 / 打开全部评论页面 / 确认评论页对应当前产品 / 记录 reviewUrl |
| owner | reviews.ts |
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

---

## 13. 阶段 11：产品完成与下一条

| 项 | 内容 |
| -- | -- |
| 动作 | 保存详情 / 保存评论 / 保存 evidence index / mark product completed/failed/manual_required / 进入下一个 pending_detail 产品 |
| 复用规则 | 同 ASIN 已完整挖掘过时可复用详情数据，但必须保留当前关键词来源关系；复用前必须确认数据有效 |

---

## 14. 阶段 12：关键词完成与下一关键词

| 项 | 内容 |
| -- | -- |
| 动作 | 统计当前关键词下产品状态 / 标记 completed 或 completed_with_errors / 生成 keyword execution summary / 进入下一 pending keyword |
| 终态 | 全部关键词完成 → task.status = packaging |

---

## 15. 阶段 13：结构化数据包生成

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

| owner | package.ts |
| 必须可追溯 | keyword -> product -> review |
| 禁止 | 给出选品结论 / 跳过失败披露 / PDF 替代结构化数据包 |

---

## 16. 阶段 14：PDF 报告生成

固定产物：`amazon-product-mining-report.pdf`。

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

| owner | pdf.ts |
| 优先 | 使用仓库已有 PDF 能力；不允许为 PDF 引入复杂重依赖 |
| 退化 | 无法生成 PDF 时必须 task.status=failed/manual_required，不得伪装成功 |
| 禁止 | 丢失 keyword / ASIN / URL / timestamp |

---

## 17. 阶段 15：交接高级 AI

```txt
handoff record:
  pdfReportRef
  structuredPackageRef
  evidenceIndexRef
  exceptionSummaryRef
  taskScope
  dataCompletenessStatistics
  handoffStatus
```

| owner | handoff.ts |
| 禁止 | Agent 在 handoff 中输出最终选品建议 / 编造缺失证据 |
| 完成 | task.status = package_completed |

---

## 18. 状态机汇总

### task status

`created → keyword_generating → keyword_ready → mining → packaging → package_completed`

`failed` / `manual_required` 可在任何阶段进入。

### keyword status

`pending → searching → search_completed → completed`

`completed_with_errors` / `failed` / `manual_required` 终态分支。

### product status

`pending_detail → detail_extracting → detail_completed → review_extracting → completed`

`failed` / `manual_required` 终态分支。

### handoff status

`not_started → ready → handoff_completed`

`failed` 终态分支。

---

## 19. 失败策略

### 非终止失败（continue）

- 单个关键词失败
- 单个产品详情失败
- 单个产品评论页失败
- 部分评论页失败
- ASIN 不可解析但 URL 可保存
- 字段缺失
- 页面结构部分变化

处理：记录失败原因 → 保存已有证据 → 继续下一项 → 最终 `completed_with_errors`。

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

处理：`failed` 或 `manual_required`，不得伪装完成，不得绕过限制。

---

## 20. 质检规划

### Owner inspector 必查（Phase 2 实现）

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
16. 不读取 cookie / token / localStorage / sessionStorage（AST 字符串扫描 + property access 扫描）
17. 不存在 fallback / shadow / bridge / legacy / compatibility 字样（AST identifier 扫描）
18. Agent 不输出 final product selection / purchase decision / profit conclusion（AST result type 字段扫描）
19. inspector 自身真实使用 context.project（满足 audit-truth 元法案）
```

### Acceptance 必查（Phase 2 实现）

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

`ci-full.ts` 白名单必须在 Phase 2 追加 `acceptance:amazon-product-mining`，否则法案 [012] 不算落地。

---

## 21. 分阶段施工顺序（Phase 2）

```txt
Phase 2-1：插件 schema + storage-schema + result type（最小骨架，typecheck PASS）
Phase 2-2：flow.ts 状态机 + logging adapter（不真跑浏览器，先做状态图）
Phase 2-3：keyword.ts （fixture-based + ai-input-gateway 投喂契约）
Phase 2-4：search.ts （fixture HTML + DOM-automation 提取器）
Phase 2-5：product-detail.ts （fixture HTML + 多字段容错）
Phase 2-6：reviews.ts （fixture HTML + 分页 + 受限模拟）
Phase 2-7：package.ts + pdf.ts （JSON 真实生成；PDF 最小可下载）
Phase 2-8：handoff.ts + result.ts （task 终态聚合）
Phase 2-9：app routes + index.ts public facade
Phase 2-10：audit manifest + inspector（context.project AST 检查）
Phase 2-11：7 个 acceptance 脚本 + package scripts
Phase 2-12：ci-full.ts 白名单接入 + 法案 draft → active + ci:full PASS
```

每个 Phase 2-N 完成必须独立 typecheck + 局部 acceptance 通过；最后一步必须 ci:full PASS。

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
