# GrassEye Amazon 产品更新同步施工图

本施工图从属 `.github/instructions/agent-rules/modules/module-amazon-product-sync.instructions.md`，只作为实现地图，不能覆盖 active law。

## 单链路

```text
ON-THE-WAY Amazon Manage 或已授权 App 页面
-> 网站侧 SKU 队列选择当前 1 个 SKU
-> ON-THE-WAY 同源 API `/api/apex/amazon-manage/products/sync/start`
-> /api/plugins/amazon-product-sync/start
-> Workbench API Boundary
-> workbench-amazon-product-sync-routes.ts
-> startAmazonProductSyncTask
-> runAmazonProductSyncFlow
-> BrowserController open/evaluateActiveTab/click/screenshotRegion
-> Seller Central inventory read-only evidence
-> AGENT downloads/transfers current row main image bytes to the website-owned image upload API
-> task status JSON
-> ON-THE-WAY 同源 API `/api/apex/amazon-manage/products/sync/status/[taskId]`
-> ON-THE-WAY Amazon Manage polls status/latest and updates its own product record
-> 网站侧队列在当前 SKU 终态后发送下一个 SKU
```

网站侧和 App 页面只能发起同一条既有 task 链路。禁止新增 arbitrary callbackUrl、第二 API server、第二 browser controller、第二 route bus。主图专项例外只能是网站在每个 SKU item 下发的固定 `mainImageUpload.endpoint`，AGENT 只能向该 endpoint 上传真实图片字节。

请求必须显式带，并且 AGENT start request 必须 exactly one SKU item。多 SKU 队列归网站侧所有；网站侧可以循环调用同一个 start/status 链路，但每次 start 只能包含一个 item。

```json
{
  "site": "ontheway-amazon-manage",
  "requestId": "site-owned-request-id",
  "marketplace": "amazon.ae",
  "items": [
    {
      "sourceKeyType": "sku",
      "sourceKey": "site-product-id-or-row-id",
      "sellerSku": "7Y-PMQW-FOAE",
      "requiredFields": ["mainImage", "asin", "availableInventory", "actualInventory"],
      "mainImageUpload": {
        "endpoint": "https://ontheway.example/api/apex/amazon-manage/products/images/sku/7Y-PMQW-FOAE",
        "token": "site-issued-upload-token"
      }
    }
  ]
}
```

禁止形态：

```json
{
  "items": [
    { "sellerSku": "SKU-1" },
    { "sellerSku": "SKU-2" }
  ]
}
```

该形态必须由 schema 拒绝，原因是 AGENT 侧没有 product-sync 批量 ledger；如果让 AGENT 在一个 task 内长循环多个 SKU，网站侧无法逐项写回和推进，会造成按钮长期 `更新中`。

网站侧队列步骤：

1. 点击 `更新产品信息`。
2. 网站侧从当前产品源 rows 建立 SKU 队列。
3. 取队首 SKU，POST `/api/apex/amazon-manage/products/sync/start`，body 只包含该 SKU。
4. 网站侧轮询 `/api/apex/amazon-manage/products/sync/status/[taskId]`。
5. 当前 SKU terminal 后，ON server 将 matched result 写入 `amazon_product_external_snapshot`，页面刷新产品数据。
6. 若状态为 login/captcha/failed，队列停止并展示状态；否则继续下一个 SKU。

`requiredFields` 只允许并且必须同时包含 `mainImage`、`asin`、`availableInventory`、`actualInventory`。这是产品信息更新固定范围，不再按网站侧“缺什么字段”裁剪。Agent 不反向猜网站状态，也不接受 partial requiredFields。只要请求 `mainImage`，item 就必须带 `mainImageUpload`；缺失 endpoint/token 必须在 schema 层拒绝或返回 `not_configured`，不得把截图 ref、Amazon CDN URL、DOM `img[src]` 当作网站主图。

## Phase 1

第一阶段只做 Seller Central 库存页只读同步：

1. 接收网站侧或 App 页面请求，校验 `site`、`requestId`、`marketplace`、`items[].sellerSku`、`items[].requiredFields`；每个 SKU 必须固定请求 `mainImage`、`asin`、`availableInventory`、`actualInventory`。
2. 打开对应 marketplace 的 Seller Central 库存管理页，例如 `https://sellercentral.amazon.ae/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all`。
3. 每个关键动作必须写回同一个 task JSON 的 `reachedStep`：打开库存页、开始 SKU 搜索、完成搜索框 probe、开始写入 shadow input、提交搜索、等待搜索结果 DOM 落地、展开变体、开始 DOM 抽取、完成 DOM 抽取、单 SKU 完成。网站侧 status 轮询必须能观察到运行进度，不能只停在 `flow_started`。
4. `/status/:taskId` 和 `/latest` 读取 queued/running task 时，如果 `updatedAt` 超过 3 秒没有推进，AGENT 必须把同一个 task 固化为 `failed`，reason 为 `amazon_product_sync_running_progress_stale_after_3000ms`，`reachedStep` 为 `flow_progress_stale`。AGENT 重启后旧 running task 不得继续堵住网站按钮。
5. 如果出现 login、captcha、2FA、权限页或 Seller Central 页面未就绪，不返回 success，按结构化 status 结束该 item 或 task。
6. 运行搜索框 probe：必须定位库存筛选条内的 Katal 搜索输入，必须证明顶部全局搜索框被排除。
7. 通过 AGENT 内置 DOM 脚本定位库存筛选区 Katal host 的 open shadow input `input[type='text'], input`，同时写入 host value 与 shadow input value，派发 composed `input` / `change` 事件，然后仍在页面 DOM 上重新定位库存筛选区搜索按钮并派发鼠标事件。外部请求不得传 selector、坐标、命令或 action plan。禁止用坐标 focus + OS textInput 或外部坐标点击作为 SKU 提交方式，因为实测会聚焦/点击但不保证更新并提交 Katal React state。
8. 写入 SKU 后必须随机等待 1000-2000 ms，再对库存筛选区搜索符号派发 `pointerdown` / `mousedown` / `pointerup` / `mouseup` / `click`。随后循环运行结果 DOM probe，直到结果 DOM 出现目标 SKU 行。等待期间必须持续写入可观察进度；不能只看输入框 value、Enter、按钮 click event、URL search state，也不能只看库存结果计数。
9. 如果页面展示父体/变体组，先执行只读 reveal：定位 `VariationExpander-module__expanderHeader svg` 中心点并点击，直到子 SKU 行进入 DOM。不得点击保存、提交、编辑、价格或库存写入控件。
10. 在结果行中以结构化 label/value 匹配目标 SKU：目标行必须同时存在 `ProductDetails-module__container` 和 `JanusSplitBox-module__row`，且某个 label/value pair 精确等于 `SKU` / 请求 SKU。
11. 从同一目标行读取：
   - `ASIN` -> `asin`
   - `现货（亚马逊物流）` -> `availableInventory`
   - `入库` -> inbound snapshot
   - `不可售` -> unfulfillable snapshot
   - `预留` -> reserved snapshot
   - `availableFbaUnits + reservedUnits + unfulfillableUnits` -> `actualInventory`
   - `售出件数` -> 30-day sales snapshot
12. 读取目标行产品图节点和截图区域。`img[src]` 只能作为 DOM 定位和下载源线索；只有 BrowserController `screenshotRegion` 成功后，才能返回 `sellerCentralMainImageEvidenceRef` 作为证据。
13. 如果 item 带 `mainImageUpload`，AGENT 必须把同一目标行的主图下载/转存为真实 image bytes，调用网站固定图片上传 API，收到 `imageUrl` 与 `mediaId` 后在 per item 返回 `mainImageUpload.status = "uploaded"`。下载失败、mime/size 不合规、上传失败或目标行无图时，必须返回结构化 `mainImageUpload` 失败原因。
14. 返回 task status JSON，per item 带 `requestedFields`、`missingRequestedFields`、`mainImageUpload`、`matched/not_found/ambiguous/blocked` 状态和 bounded row evidence。网站侧通过既有 status/latest 轮询链更新自己的产品记录。

生产代码必须让 `evaluateActiveTab` 负责 DOM probe、库存 Katal shadow input 写入、库存搜索按钮 DOM MouseEvent 提交、结果读取、候选点位和截图信号。只读变体展开点击和 screenshotRegion 必须走 BrowserController 批准动作。

## 日志矩阵

Amazon product sync 必须接入 Runtime Log Spine，不允许用私有 JSONL、console 或 task JSON 代替诊断日志。task JSON 只承担网站轮询状态；Runtime Log Spine 承担跨任务追溯。

日志必须有界，禁止日志爆炸：

- 每次 start 写 1 条 `amazon_product_sync.start_received`。
- 每次排队写 1 条 `amazon_product_sync.queued`。
- 每次已有 `persistProgress` 进度推进写 1 条 `amazon_product_sync.progress`，不额外轮询刷日志。
- 每个 terminal item 写 1 条 `amazon_product_sync.item_summary`。
- 每个 task terminal 写 1 条 `amazon_product_sync.flow_finished` 或 `amazon_product_sync.flow_failed`。
- `/status/:taskId` 或 `/latest` 发现 queued/running stale 并固化 failed 前，写 1 条 `amazon_product_sync.stale_running_task_failed`。

所有事件必须 `modeVisibility` 包含 `FLOW`，`owner` 使用既有 `local-runtime`，并在 `refs.module` 标明 `amazon-product-sync`。

`amazon_product_sync.progress` 必须带：

- `site`
- `marketplace`
- `reachedStep`
- `previousStep`
- `itemCount`
- `reason`
- `authGate`
- `detectedState`
- `diagnosticStage`
- `pageTitle`
- `pageUrlPath`

`reason` 禁止默认为 `none`。无异常的普通推进只能使用有界语义值，例如 `progress_continues`、`inventory_filter_probe_ready`、`inventory_dom_extract_finished`；login、captcha、2FA、review 或页面未就绪时必须写真实 blocking reason。

`authGate` 是防复发强制字段，只允许表达当前页面鉴权门状态：`none`、`login_required`、`captcha_or_2fa_required`、`review_required`。`detectedState` 必须来自 Seller Central DOM/page probe 的结构化页面状态。`diagnosticStage` 必须指向产生诊断的阶段。`pageTitle` 与 `pageUrlPath` 只用于定位页面状态，禁止写完整敏感 query 或 cookie/token；无法取得时写 `unknown`，不得省略字段。

`amazon_product_sync.item_summary` 必须带：

- `sellerSku`
- `itemStatus`
- `requestedFields`
- `missingRequestedFields`
- `availableFbaUnits`
- `actualInventoryUnits`
- `rowEvidenceRef`
- `mainImageEvidenceRef`
- `mainImageUploadStatus`
- `mainImageUploadMediaId`

当 item 不是 `matched` 时，`amazon_product_sync.item_summary` 还必须带：

- `authGate`
- `detectedState`
- `diagnosticStage`
- `pageTitle`
- `pageUrlPath`

当 item 不是 `matched` 时，`amazon_product_sync.item_summary` 必须进入 review/failed 语义，并在 payload 带：

- `failureClass`
- `stageName`
- `retryable`
- `terminal`
- `recoveryPolicy`

login、captcha、2FA、review 或权限页面导致的 blocked/review item，payload.failureClass 必须归类为 `ACCOUNT_SECURITY_BLOCKER`，不得落到普通 `DOM_PROBE_FAILURE`。DOM 未命中、搜索结果未验证、库存行未找到等非鉴权问题才允许使用 DOM 类 failureClass。

`amazon_product_sync.stale_running_task_failed` 必须带 stale reason，并在 payload 带 `failureClass`、`stageName`、`retryable`、`terminal`、`recoveryPolicy`。`/status/:taskId` 和 `/latest` 必须把 RuntimeLogger 传入 stale 固化路径，禁止只改 task JSON 而无运行日志。

inspector 必须用 AST 检查上述矩阵与生产代码一致。防复发验证必须故意破坏一次生产代码日志事件或字段，观察 `npm run audit:amazon-product-sync` 失败，再恢复并观察通过。

inspector 必须检查 `amazon_product_sync.progress` 和 review `amazon_product_sync.item_summary` 的鉴权/页面诊断字段，必须禁止 `progress.reason ?? "none"` 这类不可分析默认值。该检查只能使用 ts-morph AST，不得用 grep、正则或全文字符串扫描作为执法依据。

## 实测 DOM 结构

2026-06-03 使用 Chrome 插件实测 `sellercentral.amazon.ae/myinventory/inventory`。本次纠偏点：顶部导航栏搜索框属于排除项，库存筛选条内的第二个搜索框才是产品 SKU 搜索入口。

### 排除项

禁止作为 amazon-product-sync SKU 搜索入口：

- `form#sc-global-search-form`
- `input#sc-search-field.search-input[name="query"][placeholder="搜索"]`
- `button.sc-search-button[aria-label="搜索"]`
- 实测位置约为 viewport `x=654 y=7 width=360 height=35`
- 这是 Seller Central 顶部全局搜索。误用后不会稳定过滤库存表目标 SKU，属于错误方向。

### 正确项

库存筛选搜索入口：

- 外层组合控件：`kat-input-group`，实测 rect `x=27 y=294 width=600 height=32`
- 搜索范围下拉：`kat-dropdown.SearchBox-module__searchDropdown--y7jts`，实测 value 为 `ALL`，显示文本为 `所有`
- 输入 host：`kat-input.SearchBox-module__searchInput--T3Fdk[type="text"][placeholder="搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN"]`
- 真实输入节点在 open shadow DOM：`kat-input.SearchBox-module__searchInput--T3Fdk` -> `shadowRoot` -> `input#katal-id-4[type="text"]`
- 搜索按钮区域：`.SearchBox-module__searchButton--5iHxx`，实测 rect `x=582 y=294 width=45 height=32`，内部 `kat-icon[name="search"]`；提交必须在页面 DOM 上重新定位该搜索按钮区域并派发 `MouseEvent` 的 `pointerdown` / `mousedown` / `pointerup` / `mouseup` / `click`，不能点顶部搜索，也不能用不存在的原生 `button.click()` 当成功证据。
- 普通 `document.querySelectorAll("input")` 不足以发现该输入框；DOM probe 必须递归读取 open shadowRoot。

## 搜索框排他性规则

实现必须同时满足：

- `topGlobalSearchPresent: true` 只能说明页面存在顶部全局搜索，不能作为 SKU search target。
- `topGlobalSearchExcluded: true` 必须由 DOM probe 证明：目标 Katal input 不在 `form#sc-global-search-form` 内，且不是 `input#sc-search-field`。
- `inventorySearchUsesShadowInput: true` 表示 probe 已观察到 Katal host 的 open shadow input。
- `inventorySearchInputPoint` 和 `inventorySearchButtonPoint` 只能由 Agent 内置 DOM probe 产生，外部请求不能提供。
- 提交 SKU 时必须直接写入 `kat-input[placeholder="搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN"]` 的 open `shadowRoot` 内部 `input[type='text'], input`，并先在 Katal host 上安装 configurable own `value` getter，让 React `onInput` 事件 retarget 到 host 时读取到 requested SKU，再对 host 与 shadow input 派发 composed `input` / `change` 事件。
- 写入 SKU 后必须随机等待 1000-2000 ms，再对产品搜索框右侧搜索符号 `.SearchBox-module__searchButton--*` 派发 DOM MouseEvents；不得用 URL 刷新 / URL 拼 `searchTerm` 替代点击。
- `inputValue === sellerSku` 只能证明提交动作写入成功，不能作为搜索成功；Enter、搜索按钮 click event、URL search state、结果数量也不能作为搜索成功。确认搜索必须继续轮询结果 DOM，直到精确 SKU 行落地。
- `searchVerified: true` 必须来自结果 DOM：`exact_sku_row_visible` 成立；只有 URL 上有 `searchTerm` 但库存表格 / 精确 SKU 行未加载，必须继续等待或失败，不得读取。
- 若只完成输入但结果 DOM 未验证，item 必须返回 `blocked`，reason 为 `inventory_search_result_dom_not_verified`。

2026-06-03 Chrome 插件复测结论：顶部搜索框属于排除项；正确入口是库存筛选区第二搜索框。生产流程固定为写入 Katal shadow input、随机等待 1000-2000 ms、点击库存筛选区搜索符号、轮询结果 DOM。URL 刷新 / 拼 `searchTerm` 属于错误方向，禁止作为提交搜索方式。

2026-06-04 Chrome 插件复测结论：`7Y-PMQW-FOAE` 在库存页可见输入框被写入后，直接外部点击搜索按钮仍未触发结果 DOM 变化；Seller Central chunk `196.b9a6d89b.chunk.js` 中搜索组件使用 `onSearchInput => setState(e.target.value)`，按钮提交该 React state。Katal shadow input 的 composed 事件会 retarget 到 `kat-input` host，若 host `value` 仍为空，按钮提交空值。生产提交动作必须先安装 host own `value` getter，再派发 input/change，并在页面 DOM 上重新定位库存筛选搜索按钮派发 MouseEvents；实测该路径使页面自行进入 `searchTerm=7Y-PMQW-FOAE` 且结果 DOM 出现精确 SKU 行。Chrome 插件坐标点击和 DOM-CUA node id 点击均不能作为该按钮的生产提交路径，前者未触发搜索，后者实测误点到筛选控件。

## 结果行结构

目标 SKU 实测：`7Y-PMQW-FOAE`

结果状态：

- 页面标题：`Manage Your Inventory`
- 结果计数：`1 - 1 共 1`，只能作为辅助观察，不能单独作为 `searchVerified` 证据。
- 行容器：`JanusTable-module__tableContentRow--MGDsi`
- 产品详情容器：`ProductDetails-module__container--bVY-u`
- 目标行 rect：`x=18 y=444 width=1568 height=194`
- listing status 可见文本开头：`在售 2026年2月26日 01:14`

目标行 label/value pairs：

```json
[
  ["ASIN", "B0DB6K6WJ5"],
  ["SKU", "7Y-PMQW-FOAE"],
  ["销售额", "AED9,532"],
  ["售出件数", "172"],
  ["页面浏览量", "2,110"],
  ["销售排名", "24"],
  ["现货（亚马逊物流）", "76"],
  ["入库", "0"],
  ["不可售", "1"],
  ["预留", "0"],
  ["总费用", "AED18.43"],
  ["亚马逊物流费用", "AED9.50"]
]
```

本 SKU 的第一阶段返回字段应映射为：

- `asin`: `B0DB6K6WJ5`
- `availableInventory`: `76`
- `actualInventory`: `77`
- `inboundUnits`: `0`
- `unfulfillableUnits`: `1`
- `reservedUnits`: `0`
- `sales30Days`: `172`

主图 DOM：

- 节点位于目标行 `ProductDetails-module__container` 内
- `img[alt="商品图片"]`
- `srcHost`: `m.media-amazon.com`
- 实测 `srcSample`: `https://m.media-amazon.com/images/I/51MeLAOhFvL._SS65_.jpg`
- 图片 rect：`x=299 y=449 width=60 height=60`
- Chrome 插件已对主图区域执行截图裁剪，裁剪区域：`x=295 y=445 width=68 height=68`

父体/变体结构仍需支持：

- 父体/变体行容器：`JanusTable-module__tableContentRow`
- 父体展开标题：`VariationExpander-module__expanderTitle`，文本形态如 `变体 (15)`
- 真实可点击展开层：`VariationExpander-module__expanderHeader svg`
- 展开动作只能 reveal DOM，不能作为编辑动作。

生产抽取必须以 `ProductDetails-module__container` + `JanusSplitBox-module__row` + `JanusSplitBox-module__panel` 的 exact label/value 为主链路。禁止用整行全文 `split/match/findAfter` 或 SKU 文本包含打分来替代结构化字段读取。

## 验收

- route 只接受安全 JSON。
- 请求必须包含站点、requestId、marketplace、SKU、requiredFields。
- AGENT start request 必须 exactly one SKU item；网站侧负责 SKU queue，禁止把多个 SKU 合成一个 AGENT task。
- `requiredFields` 必须同时包含 `mainImage`、`asin`、`availableInventory`、`actualInventory`；禁止只请求库存或只请求缺口字段。
- AGENT 自己拥有 DOM 解析脚本，不接受外部 selector、browser command、tab id、cookie、action plan 或 expected output override。
- Seller Central login/captcha/2FA/权限问题不得返回 success。
- `matched/not_found/ambiguous/blocked` 必须有 per-item status。
- SKU 搜索入口必须排除 `#sc-global-search-form #sc-search-field`，只允许库存筛选区 Katal 搜索框。
- SKU 提交必须写入库存 Katal open shadow input、安装 host own value getter、派发 composed input/change 事件，并以 DOM MouseEvents 提交库存筛选搜索按钮；禁止退回坐标 focus + OS textInput 或外部坐标点击作为提交主链路。
- 搜索提交必须以结果 DOM 命中目标 SKU 为准，不能以输入框 value、URL search state 或结果计数为准。
- 目标行必须用 `SKU` exact label/value 匹配，不能用整行 contains 作为主判定。
- `availableInventory` 必须来自 exact label `现货（亚马逊物流）`。
- `actualInventory` 必须来自同一目标行的 `availableFbaUnits + reservedUnits + unfulfillableUnits`；任一来源缺失则返回 `null`，来源为 `0` 时必须写入数字 `0`。
- mainImage 需求必须触发 BrowserController `screenshotRegion`，不能用公共图片 URL 伪造成 evidence。
- AGENT 必须复用 Seller Central host tab，禁止把网站当前 active tab 当作 Seller Central 执行页。
- background task 必须有可观察运行进度和终态；浏览器打开、点击、DOM 读取挂起时必须落到 `failed`，不能永久停在 `running` / `flow_started`。
- status/latest 必须把 3 秒未推进的 queued/running task 固化为 failed，避免 AGENT 重启或浏览器卡死后网站按钮永久 `更新中`。
- `/status/:taskId` 可轮询 terminal result；第一阶段网站回传使用既有 task status JSON 轮询链，不允许插件直接 fetch 网站 callbackUrl。
- audit 必须阻断旧的全文兜底抽取、SKU contains 主匹配、Seller Central 写入动作和第二链路。
- Chrome 验收报告必须写明 `CHROME_VERIFIED`、入口 URL、实际步骤、观察结果和主图 evidence ref。
