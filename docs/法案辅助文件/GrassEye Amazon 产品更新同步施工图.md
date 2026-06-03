# GrassEye Amazon 产品更新同步施工图

本施工图从属 `.github/instructions/agent-rules/modules/module-amazon-product-sync.instructions.md`，只作为实现地图，不能覆盖 active law。

## 单链路

```text
ON-THE-WAY Amazon Manage 或已授权 App 页面
-> /api/plugins/amazon-product-sync/start
-> Workbench API Boundary
-> workbench-amazon-product-sync-routes.ts
-> startAmazonProductSyncTask
-> runAmazonProductSyncFlow
-> BrowserController open/click/textInput/evaluateActiveTab/screenshotRegion
-> Seller Central inventory read-only evidence
-> task status JSON
-> ON-THE-WAY Amazon Manage polls status/latest and updates its own product record
```

网站侧和 App 页面只能发起同一条既有 task 链路。禁止新增 callbackUrl、第二 API server、第二 browser controller、第二 route bus 或插件直接 fetch 网站回调。

请求必须显式带：

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
      "requiredFields": ["mainImage", "asin", "availableInventory"]
    }
  ]
}
```

`requiredFields` 只允许 `mainImage`、`asin`、`availableInventory`。缺什么由网站侧显式声明，Agent 不反向猜网站状态。

## Phase 1

第一阶段只做 Seller Central 库存页只读同步：

1. 接收网站侧或 App 页面请求，校验 `site`、`requestId`、`marketplace`、`items[].sellerSku`、`items[].requiredFields`。
2. 打开对应 marketplace 的 Seller Central 库存管理页，例如 `https://sellercentral.amazon.ae/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all`。
3. 如果出现 login、captcha、2FA、权限页或 Seller Central 页面未就绪，不返回 success，按结构化 status 结束该 item 或 task。
4. 运行搜索框 probe：必须定位库存筛选条内的 Katal 搜索输入，必须证明顶部全局搜索框被排除。
5. 通过 BrowserController 点击库存搜索输入、清空输入、输入 SKU、点击库存搜索按钮。外部请求不得传 selector、坐标、命令或 action plan。
6. 搜索提交后运行结果 DOM probe。成功证据必须来自 URL `searchTerm`、库存结果计数或目标 SKU 行；不能只看输入框 value。
7. 如果页面展示父体/变体组，先执行只读 reveal：定位 `VariationExpander-module__expanderHeader svg` 中心点并点击，直到子 SKU 行进入 DOM。不得点击保存、提交、编辑、价格或库存写入控件。
8. 在结果行中以结构化 label/value 匹配目标 SKU：目标行必须同时存在 `ProductDetails-module__container` 和 `JanusSplitBox-module__row`，且某个 label/value pair 精确等于 `SKU` / 请求 SKU。
9. 从同一目标行读取：
   - `ASIN` -> `asin`
   - `现货（亚马逊物流）` -> `availableInventory`
   - `入库` -> inbound snapshot
   - `不可售` -> unfulfillable snapshot
   - `预留` -> reserved snapshot
   - `售出件数` -> 30-day sales snapshot
10. 读取目标行产品图节点和截图区域。`img[src]` 只能作为 DOM 定位证据；只有 BrowserController `screenshotRegion` 成功后，才能返回 `sellerCentralMainImageEvidenceRef`。
11. 返回 task status JSON，per item 带 `requestedFields`、`missingRequestedFields`、`matched/not_found/ambiguous/blocked` 状态和 bounded row evidence。网站侧通过既有 status/latest 轮询链更新自己的产品记录。

生产代码必须让 `evaluateActiveTab` 只负责读取 DOM、返回字段、候选点位和截图信号。点击、输入、展开和 screenshotRegion 必须走 BrowserController 批准动作。

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
- 搜索按钮区域：`.SearchBox-module__searchButton--5iHxx`，实测 rect `x=582 y=294 width=45 height=32`，内部 `kat-icon[name="search"]`
- 普通 `document.querySelectorAll("input")` 不足以发现该输入框；DOM probe 必须递归读取 open shadowRoot。

## 搜索框排他性规则

实现必须同时满足：

- `topGlobalSearchPresent: true` 只能说明页面存在顶部全局搜索，不能作为 SKU search target。
- `topGlobalSearchExcluded: true` 必须由 DOM probe 证明：目标 Katal input 不在 `form#sc-global-search-form` 内，且不是 `input#sc-search-field`。
- `inventorySearchUsesShadowInput: true` 表示 probe 已观察到 Katal host 的 open shadow input。
- `inventorySearchInputPoint` 和 `inventorySearchButtonPoint` 只能由 Agent 内置 DOM probe 产生，外部请求不能提供。
- `searchVerified: true` 必须来自结果 DOM 或 URL search state：`url_searchTerm_exact`、`inventory_result_count_visible`、`exact_sku_row_visible` 至少一个成立。
- 若只完成输入但结果 DOM 未验证，item 必须返回 `blocked`，reason 为 `inventory_search_result_dom_not_verified`。

## 结果行结构

目标 SKU 实测：`7Y-PMQW-FOAE`

实测可复现搜索状态 URL：

```text
https://sellercentral.amazon.ae/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&searchField=all&searchTerm=7Y-PMQW-FOAE&sort=date_created_desc&status=all
```

结果状态：

- 页面标题：`Manage Your Inventory`
- 结果计数：`1 - 1 共 1`
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
- `requiredFields` 只能是 `mainImage`、`asin`、`availableInventory`。
- AGENT 自己拥有 DOM 解析脚本，不接受外部 selector、browser command、tab id、cookie、action plan 或 expected output override。
- Seller Central login/captcha/2FA/权限问题不得返回 success。
- `matched/not_found/ambiguous/blocked` 必须有 per-item status。
- SKU 搜索入口必须排除 `#sc-global-search-form #sc-search-field`，只允许库存筛选区 Katal 搜索框。
- 搜索提交必须以结果 DOM 命中目标 SKU、结果计数或 URL `searchTerm` 为准，不能以输入框 value 为准。
- 目标行必须用 `SKU` exact label/value 匹配，不能用整行 contains 作为主判定。
- `availableInventory` 必须来自 exact label `现货（亚马逊物流）`。
- mainImage 需求必须触发 BrowserController `screenshotRegion`，不能用公共图片 URL 伪造成 evidence。
- `/status/:taskId` 可轮询 terminal result；第一阶段网站回传使用既有 task status JSON 轮询链，不允许插件直接 fetch 网站 callbackUrl。
- audit 必须阻断旧的全文兜底抽取、SKU contains 主匹配、Seller Central 写入动作和第二链路。
- Chrome 验收报告必须写明 `CHROME_VERIFIED`、入口 URL、实际步骤、观察结果和主图 evidence ref。
