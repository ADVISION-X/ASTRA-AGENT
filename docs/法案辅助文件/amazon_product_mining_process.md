# Amazon 产品挖掘流程方案

> 文件用途：本文件只定义 **Amazon 产品挖掘技能** 的流程步骤与每一步注意事项。  
> 文件边界：本文件不写法案、不写施工图、不写数据库设计、不写代码实现、不写选品决策逻辑。  
> 核心原则：Agent 负责挖掘、提取、入库、打包；高级 AI 负责基于数据包做最终产品决策。

---

# 第一部分：人类阅读区

## 0. 流程总目标

Amazon 产品挖掘技能的目标是：

> 在用户选择的 Amazon 市场与站点中，通过 AI 生成关键词，逐个关键词搜索 Amazon 首页产品，提取搜索结果页产品信息，再逐个打开产品详情页，提取完整产品信息和当前可访问的全量评论，最终形成一个完整的数据包，供高级 AI 做产品选择决策。

该技能不负责判断“这个产品一定能赚钱”，也不负责采购、定价、利润核算、库存管理或 ERP 工作。

---

## 1. 用户创建挖掘任务

### 流程说明

用户先创建一个 Amazon 产品挖掘任务，并选择本次要挖掘的市场、站点和方向。

最少需要确认：

1. Amazon 站点，例如 `amazon.ae`、`amazon.sa`、`amazon.com`。
2. 目标市场，例如 UAE、Saudi、USA。
3. 挖掘方向，例如浴室用品、家居改善、水过滤、厨房用品等。
4. 本次希望挖掘的关键词数量。
5. 是否使用历史已挖掘关键词去重。
6. 是否限制语言，例如 English、Arabic、Japanese。
7. 是否只挖掘首页搜索结果。

### 注意事项

1. 站点和市场必须明确，不能让 Agent 自己猜。
2. 本流程默认只挖掘 Amazon 搜索结果首页。
3. 开始任务前必须读取历史已挖掘关键词，避免重复挖掘。
4. 每次任务必须生成唯一任务编号，方便后续追踪。
5. 如果用户没有选择市场或站点，任务不得开始。

---

## 2. 向 AI 请求关键词

### 流程说明

Agent 将用户选择的市场、站点、挖掘方向、历史已挖掘关键词发送给 AI，让 AI 生成一批新的 Amazon 搜索关键词。

发送给 AI 的信息必须包含：

1. 用户选择的 Amazon 站点。
2. 用户选择的目标市场。
3. 用户选择的产品方向。
4. 历史已经挖掘过的关键词。
5. 本次不允许重复生成的关键词。
6. 本次希望生成的新关键词数量。
7. 输出格式要求。

### 注意事项

1. 必须投喂历史已挖掘关键词，避免 AI 重复给出旧关键词。
2. AI 返回内容必须是结构化关键词列表，不能只返回一段自然语言。
3. 如果 AI 返回的关键词为空、重复过多或格式错误，需要重新请求或进入失败流程。
4. AI 只负责提供候选关键词，不负责最终选品判断。
5. 关键词应尽量贴近用户选择的市场与站点，而不是泛泛给全球关键词。

---

## 3. 解析 AI 返回的关键词

### 流程说明

Agent 接收 AI 返回结果后，解析出本次最新关键词。

解析动作包括：

1. 提取关键词文本。
2. 清理空格、重复符号和无效字符。
3. 统一大小写规则。
4. 过滤空关键词。
5. 与历史已挖掘关键词比对。
6. 与本次任务内关键词比对。
7. 去除重复关键词。
8. 保存为本次任务的待挖掘关键词队列。

### 注意事项

1. 去重必须同时覆盖历史关键词和本次任务内关键词。
2. 不能因为 AI 没有给足数量就自行编造关键词。
3. 如果全部关键词都已被挖掘过，应结束任务并输出“无新增关键词”结果。
4. 每个关键词都要记录来源：由哪一次 AI 请求生成。
5. 关键词状态初始应为 `pending`。

---

## 4. 关键词队列开始执行

### 流程说明

Agent 从待挖掘关键词队列中取出第一个关键词，进入 Amazon 搜索流程。

每个关键词按顺序处理：

1. 取出一个状态为 `pending` 的关键词。
2. 标记为 `searching`。
3. 打开用户选择的 Amazon 站点。
4. 在 Amazon 搜索框输入该关键词。
5. 进入搜索结果页。
6. 等待页面加载稳定。
7. 记录搜索页面 URL、时间和页面状态。

### 注意事项

1. 必须按关键词队列逐个执行，不能跳着执行。
2. 每个关键词都要有独立搜索记录。
3. 如果页面打不开、加载失败、出现验证码或风控页面，应标记该关键词为异常状态。
4. 遇到异常时不得绕过验证码、登录限制或平台风控。
5. 异常关键词可以进入 `failed` 或 `manual_required` 状态，之后继续下一个关键词。

---

## 5. 提取搜索结果首页产品信息

### 流程说明

进入某个关键词的 Amazon 搜索结果页后，Agent 只提取首页中所有可见产品信息。

需要提取的信息包括：

1. 搜索关键词。
2. 搜索结果页 URL。
3. 产品在当前搜索页中的位置。
4. 是否为广告产品。
5. 产品标题。
6. 产品 URL。
7. ASIN，如果页面可见或可解析。
8. 主图 URL。
9. 价格。
10. 原价或折扣信息，如果页面可见。
11. 评分。
12. 评论数量。
13. Prime / FBA / 配送标识，如果页面可见。
14. 优惠券信息，如果页面可见。
15. 配送文案，如果页面可见。
16. 页面原始可见文本快照。

### 注意事项

1. 必须提取首页所有可见产品，不只提取看起来好的产品。
2. 必须保留搜索位置，因为位置代表该关键词下的曝光结构。
3. 必须区分广告产品和自然产品。
4. 如果同一个 ASIN 在同一关键词下重复出现，只保留一条主记录，同时保留重复出现证据。
5. 如果 ASIN 暂时无法解析，先保存产品 URL 和标题，不得直接丢弃。
6. 搜索结果页提取完成后，关键词状态不能直接完成，还需要继续进入产品详情页挖掘。

---

## 6. 搜索结果页产品入库

### 流程说明

搜索结果首页提取完成后，Agent 将该关键词下的所有产品列表保存到系统中。

入库内容至少包括：

1. 任务编号。
2. 关键词。
3. Amazon 站点。
4. 搜索时间。
5. 搜索页 URL。
6. 产品搜索位置。
7. 产品基础信息。
8. 产品 URL。
9. 原始页面快照或原始可见文本。
10. 当前产品详情挖掘状态。

### 注意事项

1. 搜索结果必须先入库，再进入详情页挖掘。
2. 入库时要设置产品详情状态为 `pending_detail`。
3. 入库过程失败时，不得继续打开详情页。
4. 同一产品可能来自多个关键词，不能简单覆盖旧记录，需要保留“关键词来源关系”。
5. 搜索结果页数据和产品详情页数据要分开保存，避免混在一起。

---

## 7. 打开第一个产品详情页

### 流程说明

搜索结果页产品入库后，Agent 从该关键词保存的第一个产品开始，逐个打开产品详情页。

处理顺序：

1. 找到当前关键词下第一个 `pending_detail` 产品。
2. 打开产品 URL。
3. 等待详情页加载稳定。
4. 判断页面是否为正常产品详情页。
5. 标记产品状态为 `detail_extracting`。
6. 开始提取详情页完整信息。

### 注意事项

1. 必须按搜索结果页顺序处理产品。
2. 每个产品都要独立记录打开时间和详情页 URL。
3. 如果产品页面失效、跳转、缺货或无法访问，要记录异常原因。
4. 如果页面出现验证码、登录限制或风控，不得绕过，应进入异常状态。
5. 一个产品失败后，应继续处理下一个产品，不应导致整个任务中断。

---

## 8. 提取产品详情页完整信息

### 流程说明

进入产品详情页后，Agent 需要提取当前页面能显示的完整产品信息。

需要提取的信息包括：

1. ASIN。
2. 标题。
3. 品牌。
4. 店铺或卖家信息，如果页面可见。
5. 当前售价。
6. 原价、折扣、优惠券，如果页面可见。
7. 主图。
8. 所有可见图片。
9. 视频信息，如果页面可见。
10. 五点描述。
11. About this item。
12. Product Description。
13. A+ 页面内容，如果页面可见。
14. 商品变体信息。
15. 颜色、尺寸、款式等选项。
16. Product information。
17. Technical details。
18. Additional information。
19. Best Sellers Rank，如果页面可见。
20. 类目路径，如果页面可见。
21. 评分。
22. 评论数量。
23. 星级分布。
24. Q&A 内容，如果页面可见。
25. Frequently bought together，如果页面可见。
26. Customers also bought，如果页面可见。
27. Compare with similar items，如果页面可见。
28. 配送信息。
29. 退货信息。
30. 页面所有其他可见的重要产品参数。
31. 原始页面快照或原始可见文本。

### 注意事项

1. “完整信息”指当前详情页中能正常显示和读取的信息。
2. 不同 Amazon 站点和不同商品页面结构可能不同，字段不存在时应记录为空，不应报错中断。
3. 图片、视频、A+、变体、参数表、Q&A 都应尽量提取。
4. 不允许只提取标题、价格、评分这类浅层信息。
5. 原始页面可见文本必须保存，方便后续复查。
6. 产品详情提取完成后，状态进入 `detail_completed`，然后进入评论提取流程。

---

## 9. 进入评论页面

### 流程说明

产品详情页提取完成后，Agent 进入该产品的评论页面，开始提取评论。

处理顺序：

1. 找到产品详情页中的评论入口。
2. 打开全部评论页面。
3. 确认当前 ASIN 与产品对应。
4. 记录评论页面 URL。
5. 标记产品状态为 `review_extracting`。
6. 从评论第一页开始提取。

### 注意事项

1. 评论页面必须与当前产品对应，不能串到其他变体或其他商品。
2. 如果 Amazon 自动切换语言或地区，需要记录页面实际语言和地区。
3. 如果评论入口不存在、评论数为 0 或页面无法访问，应记录原因。
4. 如果评论页面出现限制，不得绕过，应进入异常状态。
5. 评论提取失败不应删除已经完成的产品详情数据。

---

## 10. 全量提取当前可访问评论

### 流程说明

Agent 需要从评论第一页开始，分页提取当前环境下可访问的全部评论。

每条评论至少提取：

1. 评论 ID，如果页面可见或可解析。
2. 评论人名称。
3. 评论星级。
4. 评论标题。
5. 评论正文。
6. 评论日期。
7. 是否 Verified Purchase。
8. 评论对应变体。
9. Helpful 数量，如果页面可见。
10. 评论图片，如果页面可见。
11. 评论视频，如果页面可见。
12. 评论语言。
13. 评论所在地区，如果页面可见。
14. 原始评论文本快照。

分页流程：

1. 提取当前评论页所有评论。
2. 保存当前页评论。
3. 判断是否存在下一页。
4. 如果存在下一页，进入下一页继续提取。
5. 如果不存在下一页，评论提取结束。
6. 标记该产品为 `completed`。

### 注意事项

1. “全量评论”指当前页面环境、当前账号状态、当前地区和当前排序条件下可访问的所有评论。
2. 不得绕过 Amazon 的验证码、登录限制、地域限制或风控限制。
3. 评论分页必须逐页保存，避免中途失败导致全部丢失。
4. 每条评论都要关联 ASIN 和产品记录。
5. 评论原文必须保存，不能只保存 AI 摘要。
6. 如果评论很多，允许分批保存，但不能跳页。
7. 如果中途失败，应记录已完成页数和失败页数，方便断点续跑。

---

## 11. 当前产品入库完成并进入下一条

### 流程说明

当一个产品的详情页和评论都提取完成后，Agent 将该产品标记为完成，并继续处理当前关键词下的下一个产品。

处理顺序：

1. 保存产品详情信息。
2. 保存评论信息。
3. 保存页面快照索引。
4. 标记产品状态为 `completed`。
5. 查找当前关键词下下一个 `pending_detail` 产品。
6. 重复执行产品详情和评论提取流程。
7. 直到当前关键词首页所有产品都处理完成。

### 注意事项

1. 一个产品完成后才能进入下一个产品。
2. 一个产品失败后应记录失败原因，并继续下一个产品。
3. 不能因为单个产品失败而终止整个关键词。
4. 同一 ASIN 如果已经被其他关键词完整挖掘过，可以复用产品详情数据，但必须新增当前关键词来源关系。
5. 复用时需要确认详情数据是否仍然有效，必要时允许刷新。

---

## 12. 当前关键词完成并进入下一个关键词

### 流程说明

当当前关键词下的搜索结果首页产品全部处理完后，Agent 标记该关键词为完成，并进入下一个关键词。

处理顺序：

1. 检查当前关键词下所有产品状态。
2. 统计成功、失败、待人工处理的产品数量。
3. 标记关键词状态为 `completed` 或 `completed_with_errors`。
4. 进入下一个 `pending` 关键词。
5. 重复搜索、提取、入库、详情页、评论页流程。
6. 直到所有关键词处理完成。

### 注意事项

1. 关键词完成状态必须基于其下产品处理结果。
2. 如果部分产品失败，关键词不能简单标记为完全成功。
3. 每个关键词必须保留执行摘要。
4. 所有关键词完成后，任务进入数据包生成阶段。
5. 如果所有关键词均失败，应输出失败数据包，而不是静默结束。

---

## 13. 生成完整数据包

### 流程说明

所有关键词完成后，Agent 生成一个完整的 Amazon 产品挖掘数据包。

数据包应包含：

1. 任务基本信息。
2. 用户选择的市场与站点。
3. 本次 AI 请求关键词记录。
4. 历史关键词去重说明。
5. 本次实际挖掘关键词列表。
6. 每个关键词的搜索结果摘要。
7. 每个关键词首页产品列表。
8. 每个产品的完整详情信息。
9. 每个产品的全量评论数据。
10. 每个产品的页面快照索引。
11. 失败、异常、待人工处理记录。
12. 数据完整性统计。
13. 可供高级 AI 决策读取的索引结构。

### 注意事项

1. 数据包只提供证据，不输出最终选品结论。
2. 数据包必须能追溯每个产品来自哪个关键词。
3. 数据包必须能追溯每条评论属于哪个产品。
4. 数据包必须明确哪些数据成功、哪些失败、哪些受页面限制。
5. 数据包必须保留原始证据索引，方便后续复查。
6. 数据包生成后，任务状态才可以进入 `package_completed`。

---

## 14. 生成 PDF 文件

### 流程说明

完整数据包生成后，Agent 将核心内容整理为 PDF 文件，供高级 AI 上传、阅读和决策。

PDF 应包含：

1. 封面。
2. 任务信息。
3. 市场与站点信息。
4. 关键词列表。
5. 关键词搜索结果摘要。
6. 产品总览表。
7. 每个产品的详情页信息。
8. 评论数据摘要。
9. 全量评论附录或评论索引。
10. 异常与失败记录。
11. 原始证据索引。

### 注意事项

1. PDF 面向高级 AI 决策，不面向普通营销展示。
2. PDF 应以信息完整、结构清晰、可追溯为优先。
3. 如果评论数量过大，可以在 PDF 中放评论摘要和索引，同时保留完整评论数据文件。
4. PDF 不能丢失关键词、ASIN、URL、抓取时间等核心追溯字段。
5. PDF 生成完成后，应与原始结构化数据包一起保存。

---

## 15. 上传给高级 AI 决策

### 流程说明

PDF 和结构化数据包生成完成后，Agent 将其作为输入材料交给高级 AI。

高级 AI 的输入应包括：

1. PDF 报告。
2. 结构化数据包。
3. 原始证据索引。
4. 失败与异常说明。
5. 本次任务范围说明。

### 注意事项

1. 高级 AI 只基于数据包做决策，不应凭空补充不存在的数据。
2. Agent 不在本流程中输出最终选品建议。
3. 如果数据包不完整，高级 AI 必须能看到不完整原因。
4. 上传完成后，Amazon 产品挖掘流程结束。
5. 后续选品评分、打样建议、产品矩阵判断属于下一阶段流程，不属于本文件范围。

---

# 第二部分：AI 机器阅读区

```yaml
document_type: "amazon_product_mining_process"
document_scope: "process_only"
language: "zh-CN"
skill_name: "Amazon 产品挖掘"
skill_id: "amazon_product_mining"

boundaries:
  includes:
    - "keyword_generation_request"
    - "keyword_parsing"
    - "amazon_search_page_mining"
    - "search_result_storage"
    - "product_detail_page_mining"
    - "full_accessible_review_mining"
    - "data_package_generation"
    - "pdf_generation"
    - "handoff_to_advanced_ai"
  excludes:
    - "final_product_decision"
    - "profit_calculation"
    - "purchase_decision"
    - "pricing_strategy"
    - "inventory_management"
    - "erp_functions"
    - "law_design"
    - "implementation_blueprint"
    - "code_design"

core_principle:
  agent_role: "mine_extract_store_package"
  advanced_ai_role: "decide_based_on_evidence_package"
  no_decision_without_evidence: true
  no_bypass_platform_restrictions: true

flow:
  - step_id: "S01"
    name: "create_mining_task"
    actor: "user_agent"
    input_required:
      - "amazon_marketplace"
      - "target_country_or_market"
      - "product_direction"
      - "keyword_count"
      - "use_existing_keyword_deduplication"
    output:
      - "task_id"
      - "task_scope"
      - "task_status: created"
    cautions:
      - "marketplace_must_be_explicit"
      - "target_market_must_be_explicit"
      - "do_not_start_without_marketplace"
      - "load_existing_mined_keywords_before_keyword_generation"

  - step_id: "S02"
    name: "request_keywords_from_ai"
    actor: "agent_to_ai"
    input_required:
      - "amazon_marketplace"
      - "target_market"
      - "product_direction"
      - "existing_mined_keywords"
      - "requested_new_keyword_count"
      - "structured_output_requirement"
    output:
      - "ai_keyword_response"
    cautions:
      - "must_include_existing_mined_keywords"
      - "must_request_non_duplicate_keywords"
      - "ai_response_must_be_structured"
      - "ai_only_generates_keywords_not_product_decisions"

  - step_id: "S03"
    name: "parse_and_deduplicate_keywords"
    actor: "agent"
    actions:
      - "extract_keyword_text"
      - "normalize_keyword"
      - "remove_empty_keywords"
      - "deduplicate_against_history"
      - "deduplicate_within_current_task"
      - "create_keyword_queue"
    output:
      - "keyword_queue"
      - "keyword_status: pending"
    cautions:
      - "do_not_fabricate_keywords"
      - "if_no_new_keywords_then_finish_with_empty_result"
      - "record_ai_source_for_each_keyword"

  - step_id: "S04"
    name: "process_keyword_queue"
    actor: "agent"
    loop: "for_each_pending_keyword"
    actions:
      - "mark_keyword_searching"
      - "open_selected_amazon_marketplace"
      - "search_keyword"
      - "wait_until_search_page_stable"
      - "record_search_url_and_time"
    output:
      - "keyword_search_run"
    cautions:
      - "process_keywords_in_queue_order"
      - "one_search_record_per_keyword"
      - "if_captcha_or_restriction_then_mark_manual_required_or_failed"
      - "do_not_bypass_captcha_login_or_risk_controls"

  - step_id: "S05"
    name: "extract_search_result_first_page"
    actor: "agent"
    page_scope: "first_page_only"
    extract_fields:
      - "keyword"
      - "search_url"
      - "rank_position"
      - "is_sponsored"
      - "title"
      - "product_url"
      - "asin_if_available"
      - "main_image_url"
      - "price"
      - "original_price_or_discount_if_visible"
      - "rating"
      - "review_count"
      - "prime_or_fba_flag_if_visible"
      - "coupon_text_if_visible"
      - "delivery_text_if_visible"
      - "raw_visible_text_snapshot"
    output:
      - "search_result_items"
    cautions:
      - "extract_all_visible_products_on_first_page"
      - "preserve_rank_position"
      - "distinguish_sponsored_and_organic"
      - "do_not_drop_item_when_asin_missing_if_url_exists"

  - step_id: "S06"
    name: "store_search_result_items"
    actor: "agent"
    actions:
      - "save_keyword_search_run"
      - "save_each_search_result_item"
      - "create_keyword_product_relation"
      - "set_product_detail_status_pending_detail"
    output:
      - "stored_search_results"
    cautions:
      - "store_search_results_before_opening_detail_pages"
      - "do_not_continue_to_detail_if_storage_fails"
      - "same_asin_from_multiple_keywords_must_preserve_each_keyword_relation"
      - "search_result_data_and_detail_data_must_remain_separate"

  - step_id: "S07"
    name: "open_product_detail_page"
    actor: "agent"
    loop: "for_each_search_result_item_in_rank_order"
    actions:
      - "select_first_or_next_pending_detail_product"
      - "open_product_url"
      - "wait_until_detail_page_stable"
      - "validate_product_detail_page"
      - "mark_product_detail_extracting"
    output:
      - "product_detail_page_context"
    cautions:
      - "process_products_in_search_rank_order"
      - "record_open_time_and_final_url"
      - "if_unavailable_redirected_or_restricted_then_record_failure"
      - "continue_next_product_after_failure"

  - step_id: "S08"
    name: "extract_product_detail_full_visible_information"
    actor: "agent"
    extract_fields:
      - "asin"
      - "title"
      - "brand"
      - "seller_or_store_if_visible"
      - "current_price"
      - "original_price_discount_coupon_if_visible"
      - "main_image"
      - "all_visible_images"
      - "visible_video_info"
      - "bullet_points"
      - "about_this_item"
      - "product_description"
      - "a_plus_content_if_visible"
      - "variation_options"
      - "color_size_style_options"
      - "product_information"
      - "technical_details"
      - "additional_information"
      - "best_sellers_rank_if_visible"
      - "category_path_if_visible"
      - "rating"
      - "review_count"
      - "star_distribution"
      - "qa_content_if_visible"
      - "frequently_bought_together_if_visible"
      - "customers_also_bought_if_visible"
      - "compare_with_similar_items_if_visible"
      - "delivery_information"
      - "return_information"
      - "all_other_visible_product_parameters"
      - "raw_visible_text_snapshot"
    output:
      - "product_detail_record"
      - "product_detail_status: detail_completed"
    cautions:
      - "complete_means_all_currently_visible_and_accessible_information"
      - "missing_fields_should_be_null_not_crash"
      - "do_not_only_extract_shallow_fields"
      - "raw_visible_text_must_be_preserved"

  - step_id: "S09"
    name: "open_review_page"
    actor: "agent"
    actions:
      - "locate_review_entry"
      - "open_all_reviews_page"
      - "validate_review_page_matches_product"
      - "record_review_url"
      - "mark_product_review_extracting"
    output:
      - "review_page_context"
    cautions:
      - "review_page_must_match_current_product_or_asin"
      - "record_actual_language_and_region"
      - "if_reviews_unavailable_then_record_reason"
      - "review_failure_must_not_delete_detail_data"

  - step_id: "S10"
    name: "extract_all_currently_accessible_reviews"
    actor: "agent"
    loop: "paginate_until_no_next_page_or_restriction"
    extract_fields_per_review:
      - "review_id_if_available"
      - "reviewer_name"
      - "rating"
      - "review_title"
      - "review_body"
      - "review_date"
      - "verified_purchase"
      - "variant"
      - "helpful_count_if_visible"
      - "review_images_if_visible"
      - "review_videos_if_visible"
      - "review_language"
      - "review_region_if_visible"
      - "raw_review_text_snapshot"
    actions:
      - "extract_current_page_reviews"
      - "save_current_page_reviews"
      - "detect_next_page"
      - "open_next_page_if_available"
      - "stop_when_no_next_page"
    output:
      - "review_records"
      - "review_extraction_status"
    cautions:
      - "full_reviews_means_all_reviews_accessible_under_current_page_environment_account_region_and_sorting"
      - "do_not_bypass_captcha_login_region_or_risk_controls"
      - "save_page_by_page"
      - "do_not_skip_pages"
      - "record_completed_pages_and_failed_pages_for_resume"

  - step_id: "S11"
    name: "complete_current_product_and_continue"
    actor: "agent"
    actions:
      - "save_product_detail"
      - "save_reviews"
      - "save_snapshot_index"
      - "mark_product_completed_or_failed"
      - "select_next_product"
    loop_condition: "until_all_products_under_current_keyword_processed"
    output:
      - "product_status_summary"
    cautions:
      - "one_product_should_complete_or_fail_before_next_product"
      - "single_product_failure_must_not_stop_keyword"
      - "reuse_existing_detail_data_for_same_asin_only_when_valid"
      - "preserve_current_keyword_source_relation_even_when_reusing_product_data"

  - step_id: "S12"
    name: "complete_current_keyword_and_continue"
    actor: "agent"
    actions:
      - "check_all_products_under_keyword"
      - "count_completed_failed_manual_required"
      - "mark_keyword_completed_or_completed_with_errors"
      - "select_next_pending_keyword"
    loop_condition: "until_all_keywords_processed"
    output:
      - "keyword_execution_summary"
    cautions:
      - "keyword_completion_must_reflect_product_results"
      - "partial_failure_should_be_completed_with_errors"
      - "every_keyword_must_have_execution_summary"

  - step_id: "S13"
    name: "generate_complete_data_package"
    actor: "agent"
    package_contents:
      - "task_information"
      - "marketplace_and_market"
      - "ai_keyword_request_records"
      - "historical_keyword_deduplication_notes"
      - "actual_mined_keyword_list"
      - "keyword_search_summaries"
      - "first_page_product_lists"
      - "complete_product_detail_records"
      - "full_accessible_review_records"
      - "page_snapshot_indexes"
      - "failure_exception_manual_required_records"
      - "data_completeness_statistics"
      - "advanced_ai_readable_index"
    output:
      - "amazon_product_mining_data_package"
    cautions:
      - "data_package_provides_evidence_not_final_product_decision"
      - "must_trace_product_to_keyword"
      - "must_trace_review_to_product"
      - "must_disclose_failed_or_restricted_data"
      - "must_preserve_raw_evidence_index"

  - step_id: "S14"
    name: "generate_pdf_report"
    actor: "agent"
    pdf_contents:
      - "cover"
      - "task_information"
      - "marketplace_and_site_information"
      - "keyword_list"
      - "keyword_search_result_summaries"
      - "product_overview_table"
      - "product_detail_sections"
      - "review_data_summary"
      - "full_review_appendix_or_review_index"
      - "exceptions_and_failures"
      - "raw_evidence_index"
    output:
      - "pdf_report"
    cautions:
      - "pdf_is_for_advanced_ai_decision_not_marketing"
      - "clarity_traceability_and_completeness_first"
      - "if_reviews_too_large_pdf_may_include_summary_and_index_but_full_review_data_must_remain_in_structured_package"
      - "do_not_drop_keyword_asin_url_or_extraction_time"

  - step_id: "S15"
    name: "handoff_to_advanced_ai"
    actor: "agent_to_advanced_ai"
    inputs:
      - "pdf_report"
      - "structured_data_package"
      - "raw_evidence_index"
      - "exception_and_failure_summary"
      - "task_scope"
    output:
      - "handoff_completed"
      - "task_status: package_completed"
    cautions:
      - "advanced_ai_must_decide_only_based_on_provided_data_package"
      - "agent_must_not_output_final_product_selection_in_this_process"
      - "incomplete_data_must_be_visible_to_advanced_ai"
      - "after_handoff_this_process_ends"

status_values:
  keyword_status:
    - "pending"
    - "searching"
    - "search_completed"
    - "completed"
    - "completed_with_errors"
    - "failed"
    - "manual_required"
  product_status:
    - "pending_detail"
    - "detail_extracting"
    - "detail_completed"
    - "review_extracting"
    - "completed"
    - "failed"
    - "manual_required"
  task_status:
    - "created"
    - "keyword_generating"
    - "keyword_ready"
    - "mining"
    - "packaging"
    - "package_completed"
    - "failed"
    - "manual_required"

end_condition:
  success:
    - "all_keywords_processed"
    - "data_package_generated"
    - "pdf_generated"
    - "handoff_completed"
  partial_success:
    - "some_keywords_or_products_failed"
    - "package_generated_with_exception_summary"
  failure:
    - "no_marketplace"
    - "no_valid_keywords"
    - "all_keywords_failed"
    - "package_generation_failed"
```
