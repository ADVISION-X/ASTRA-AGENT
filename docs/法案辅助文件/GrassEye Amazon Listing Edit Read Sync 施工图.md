# GrassEye Amazon Listing Edit Read Sync 施工图

本文档是 `amazon-listing-edit-read-sync` 的施工图草案。

状态：Chrome 实测施工图草案，非 active law。  
实测日期：2026-06-24。  
实测站点：`sellercentral.amazon.ae`。  
实测方式：Chrome 插件接管真实 Chrome 标签页，只读 DOM 读取；只执行库存父体展开、页面导航、TAB 打开，不修改字段、不保存、不提交。

本文档不能高于 active law。后续进入实现前，必须补 active law、audit owner、acceptance、`ci:full` 接入。当前存在 LAW-GAP。

## 目标

`amazon-listing-edit-read-sync` 负责从 Amazon Seller Central 读取卖家后台商品编辑信息：

1. 打开库存管理页。
2. 展开库存页父体变体行。
3. 读取全部可见 ASIN + SKU 关系。
4. 对每个 ASIN/SKU 定位编辑入口。
5. 进入商品编辑页。
6. 读取每个编辑 TAB 的可见 DOM 字段。
7. 对所有 ASIN/SKU 重复执行，产出只读证据包。

禁止写入 Seller Central。禁止保存、提交、改价、改库存、上传图片、删除图片、发送库存、设置补货提醒。

## 单链路

未来实现只能使用单链路：

```text
Workbench API Boundary
-> amazon-listing-edit-read-sync route
-> amazon-listing-edit-read-sync task service
-> amazon-listing-edit-read-sync explicit flow
-> existing BrowserController / DOM read path
-> Seller Central inventory DOM
-> Seller Central edit TAB DOM
-> bounded local evidence package
-> task status JSON
```

禁止：

- 第二 browser controller
- 第二 route bus
- 独立外部爬虫
- 私有 evidence chain
- fallback / shadow / compatibility flow
- 复用 `amazon-product-sync` 作为隐藏 owner

## Step 1: 打开库存管理页面

实测 URL：

```text
https://sellercentral.amazon.ae/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all
```

实测标题：

```text
Manage Your Inventory
```

实测 DOM 计数文本：

```text
1 - 11 共 11
```

库存页必须只作为读取来源，不得使用顶部全局搜索框。库存筛选搜索框的实测 DOM：

```text
kat-input[placeholder="搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN"]
```

该输入框位于库存筛选区，不在：

```text
form#sc-global-search-form
input#sc-search-field
button.sc-search-button
```

实测定位结果：

```json
{
  "hostFound": true,
  "buttonFound": true,
  "topGlobalSearchExcluded": true,
  "hostPoint": { "x": 370, "y": 310, "width": 425, "height": 32 },
  "buttonPoint": { "x": 605, "y": 310, "width": 45, "height": 32 }
}
```

## Step 2: 逐个点击开折叠父体，读取全部 ASIN + SKU

父体变体行实测 DOM 特征：

```text
[class*="VariationExpander-module__expanderHeader"] svg
[class*="VariationExpander-module__expanderHeader"]
```

父体行文本实测示例：

```text
变体 (1) 变体系列: AD-VISION Filtered Shower Head | Stops Hair Loss & Softens Dry Skin | High Pressure Spa Tech Removes Chlorine & Hard Water Impurities | Best Value with Parent ASIN: B0FJ7RDM6H 父 SKU： RB-LVVM-AAF1
```

点击父体展开按钮实测坐标：

```json
{ "x": 120, "y": 965 }
```

点击后同一库存表 DOM 出现子体行，实测读取结果：

```json
{
  "sku": "46-VI8G-HCNS",
  "asin": "B0F2P3JK2H",
  "pairCount": 11
}
```

ASIN/SKU 读取必须来自目标行结构化 label/value，而不是整行 contains。

实测 label/value 容器：

```text
[class*="JanusTable-module__tableContentRow"]
[class*="JanusSplitBox-module__row"]
```

读取规则：

1. 枚举可见库存行。
2. 对每行读取所有 `[class*="JanusSplitBox-module__row"]`。
3. 每个 split row 读取两个可见 panel：
   - panel 0 = label
   - panel 1 = value
4. 只在同一行中同时出现 `SKU` 和 `ASIN` 时，记录为 child listing。
5. 父体行只记录 parent hint，不当作 child listing。

当前页面实测到的可见字段包括：

```text
ASIN
SKU
销售额
售出件数
页面浏览量
销售排名
现货（亚马逊物流）
可售
入库
不可售
预留
总费用
亚马逊物流费用
```

实测可见 ASIN/SKU 示例：

```json
[
  { "sku": "GG-65PF-KA2I", "asin": "B0F2P3JK2H" },
  { "sku": "IT-1HIR-V2SQ", "asin": "B0H5CTF1HF" },
  { "sku": "DL-UG6I-2OWL", "asin": "B0FTVDCZ3K" },
  { "sku": "V8-1GMX-SJFA", "asin": "B0FKBLFDVZ" },
  { "sku": "H4-6PJQ-GMRW", "asin": "B0F9VYH2T1" },
  { "sku": "7Y-PMQW-FOAE", "asin": "B0DB6K6WJ5" }
]
```

## Step 3: 执行 ASIN/SKU 搜索

本轮 Chrome 实测结论：搜索控件可定位，但人类 UI 输入 + 坐标点击搜索按钮未能证明结果 DOM 收敛。

实测动作：

1. 点击库存筛选输入框。
2. `ControlOrMeta+A`
3. 输入 `7Y-PMQW-FOAE`
4. 点击库存筛选搜索按钮。
5. DOM 读取输入框值和库存表结果。

实测结果：

```json
{
  "inputValue": "7Y-PMQW-FOAE",
  "countText": "1 - 11 共 11",
  "matched": [
    {
      "sku": "7Y-PMQW-FOAE",
      "asin": "B0DB6K6WJ5"
    }
  ]
}
```

判定：

- `inputValue === requestedSku` 只证明输入框写入。
- `matched` 出现在未收敛的全表 DOM 中，不能证明搜索成功。
- `1 - 11 共 11` 说明结果没有被当前 UI 路径过滤到单 SKU。

禁止把以下信号当作搜索成功：

- 输入框 value
- 搜索按钮 click 事件
- 当前 URL
- 结果计数文本
- 全表中 contains 到目标 SKU

搜索成功的唯一可接受证据：

```text
搜索提交后，结果 DOM 收敛，并且目标行结构化 label/value 中存在：
SKU == requestedSku
或 ASIN == requestedAsin
```

本步骤仍有待补实测：

- 生产 BrowserController DOM 事件路径是否能让 Seller Central 搜索结果收敛。
- ASIN 作为搜索词是否能稳定收敛。

## Step 4: 点击搜索结果 ASIN 的编辑产品信息，进入编辑页面

从库存行可见 SKU 链接进入 SKU Central 的路径已实测：

```text
https://sellercentral.amazon.ae/skucentral?mSku=7Y-PMQW-FOAE&condition=New&ref_=myp_skuc
```

SKU Central DOM 实测字段：

```text
SKU：7Y-PMQW-FOAE
ASIN：B0DB6K6WJ5
FNSKU：X0023A7G4B
```

SKU Central 上实测存在按钮：

```json
{
  "tag": "kat-button",
  "text": "编辑商品信息",
  "type": "button",
  "variant": "tertiary"
}
```

该按钮 shadow DOM 内部实测：

```text
kat-button[label="编辑商品信息"]
  shadowRoot
    button[type="button"]
      text = 编辑商品信息
```

本轮未成立的路径：

- 点击 `kat-button` 外层坐标后没有跳转。
- 点击 shadow 内部 button 对应坐标后没有跳转。

因此当前施工图不得声称“SKU Central 编辑按钮点击路径已实测通过”。

当前可实测成立的是：已有编辑页 URL 能读取编辑 TAB DOM。示例：

```text
https://sellercentral.amazon.ae/abis/listing/edit/product_details?sku=SD-1S7L-8RJI&asin=B0DB6HVQVW&productType=SHOWERHEAD&marketplaceID=A2VIGQ35RCS4UG&isVariationParent=false&ref_=myp_1x1#product_details
```

以及已打开 offer URL：

```text
https://sellercentral.amazon.ae/abis/listing/edit/offer?ref_=obo_el_skuc_ac&productType=SHOWERHEAD&sku=7Y-PMQW-FOAE&asin=B0DB6K6WJ5#offer
```

后续补实测必须解决：

1. `编辑商品信息` 的真实触发事件或路由来源。
2. 从 SKU Central 或库存行进入 `/abis/listing/edit/...` 的稳定可重复路径。
3. 禁止直接根据猜测拼 URL，除非实测证明该 URL 来源于 Seller Central DOM 或已打开 tab 的真实 href。

## Step 5: 读取每个 TAB 的 DOM

编辑页实测 TAB：

```text
产品详情
图片
变种
报价
安全与合规
```

TAB href 实测形态：

```text
/abis/listing/edit/product_details?...#product_details
/abis/listing/edit/images?...#images
/abis/listing/edit/variations?...#variations
/abis/listing/edit/offer?...#offer
/abis/listing/edit/safety_and_compliance?...#safety_and_compliance
```

Seller Central 编辑页是 SPA/慢导航混合页面。实测进入 `images` 时，常规导航等待可能超时，但等待后 DOM 可读。因此不能把 `load` / `domcontentloaded` 事件当作页面真实完成信号。必须以目标 TAB DOM 内容作为完成证据。

### 产品详情 TAB

实测 URL：

```text
/abis/listing/edit/product_details?sku=SD-1S7L-8RJI&asin=B0DB6HVQVW&productType=SHOWERHEAD&marketplaceID=A2VIGQ35RCS4UG&isVariationParent=false&ref_=myp_1x1#product_details
```

实测可见控件数：

```text
32
```

实测按钮：

```text
编辑
取消
正在验证
```

实测字段示例：

```json
[
  {
    "name": "externally_assigned_product_identifier-0-value",
    "value": "B0DB6HVQVW",
    "labelContext": "06977073670321 | 06977073670321 | 06977073670321 gtin"
  },
  {
    "name": "externally_assigned_product_identifier-0-type",
    "value": "asin",
    "tag": "kat-dropdown"
  },
  {
    "name": "model_number-0-value",
    "value": "NEXGEN-shower",
    "labelContext": "型号 NEXGEN-shower"
  },
  {
    "name": "manufacturer-0-value",
    "value": "AD VISION",
    "labelContext": "制造商 AD VISION"
  },
  {
    "name": "generic_keyword-0-value",
    "value": "ad vision;shower head;shower filter;gold shower head;high pressure shower head;filter shower head hair loss;sgs certified shower filter;chlorine filter shower head;hard water shower head;3 mode shower head;pause switch shower head;golden shower fixture;luxury bathroom shower;رأس الدش الذهبي;فلتر دش ذهبي;purifying shower head;soft shower head;water saving shower head;handheld shower head;vitamin c shower filter elements"
  },
  {
    "name": "color-0-value",
    "value": "All-in-One Upgrade Kit - White",
    "labelContext": "颜色 All-in-One Upgrade Kit - White"
  }
]
```

读取规则：

- `kat-input` 值要读取元素 value 或 open shadow input value。
- `kat-dropdown` 值要读取元素 value。
- 中文字段名不能只靠 placeholder；必须从控件父级文本或 `name` 推导。
- `保存并完成` / `正在验证` 只能作为风险信号，不得点击。

### 图片 TAB

实测 URL：

```text
/abis/listing/edit/images?sku=SD-1S7L-8RJI&asin=B0DB6HVQVW&productType=SHOWERHEAD&marketplaceID=A2VIGQ35RCS4UG&isVariationParent=false&ref_=myp_1x1#images
```

实测可见图片数：

```text
10
```

实测页面文本：

```text
已上传 9 张图片，共 10 张图片。最多允许 10 张图片。
```

实测图片 DOM：

```json
[
  { "srcHost": "m.media-amazon.com", "width": 200, "height": 183 },
  { "srcHost": "m.media-amazon.com", "width": 200, "height": 183 },
  { "srcHost": "m.media-amazon.com", "width": 200, "height": 183 }
]
```

实测按钮：

```text
将图片左移
将图片右移
上传以替换图片
删除图片
```

禁止点击：

- 上传以替换图片
- 删除图片
- 将图片左移
- 将图片右移

图片 TAB 只允许读取图片数量、图片 src host、可见位置、主图区域文本。

### 变种 TAB

实测 URL：

```text
/abis/listing/edit/variations?sku=SD-1S7L-8RJI&asin=B0DB6HVQVW&productType=SHOWERHEAD&marketplaceID=A2VIGQ35RCS4UG&isVariationParent=false&ref_=myp_1x1#variations
```

实测页面文本：

```text
本产品是SKU的变体：
选择变体类型：
```

实测可见控件数：

```text
4
```

本 TAB 当前只实测到变体状态文本和通用属性过滤控件，没有实测到可读 child variation table。不得声称可从该 TAB 导出完整变体矩阵。

### 报价 TAB

同一 `SD-1S7L-8RJI` 商品的 direct offer URL 本轮只读到页脚和语言选择，未读到报价字段，不能作为成功样本。

另一个已打开 offer TAB 实测成功：

```text
/abis/listing/edit/offer?ref_=obo_el_skuc_ac&productType=SHOWERHEAD&sku=7Y-PMQW-FOAE&asin=B0DB6K6WJ5#offer
```

实测可见控件数：

```text
37
```

实测字段示例：

```json
[
  {
    "name": "contribution_sku-0-value",
    "value": "7Y-PMQW-FOAE",
    "disabled": true
  },
  {
    "name": "purchasable_offer-0-our_price-0-schedule-0-value_with_tax",
    "value": "129.00"
  },
  {
    "name": "purchasable_offer-0-discounted_price-0-schedule-0-value_with_tax",
    "value": "59.50"
  },
  {
    "name": "condition_type-0-value",
    "value": "new_new",
    "disabled": true
  },
  {
    "name": "list_price-0-value_with_tax",
    "value": "159.00"
  },
  {
    "name": "merchant_shipping_group-0-value",
    "value": "legacy-template-id"
  },
  {
    "name": "max_order_quantity-0-value",
    "value": "10"
  }
]
```

报价 TAB 必须按 SKU 逐个实测读取；不能因为某个 SKU 的 offer TAB 成功，就默认所有 SKU 的 offer TAB 成功。

### 安全与合规 TAB

实测 URL：

```text
/abis/listing/edit/safety_and_compliance?sku=SD-1S7L-8RJI&asin=B0DB6HVQVW&productType=SHOWERHEAD&marketplaceID=A2VIGQ35RCS4UG&isVariationParent=false&ref_=myp_1x1#safety_and_compliance
```

实测可见控件数：

```text
30
```

实测字段示例：

```json
[
  {
    "name": "country_of_origin-0-value",
    "value": "CN",
    "labelContext": "原产国/原产地"
  },
  {
    "name": "warranty_description-0-value",
    "value": "",
    "labelContext": "保修说明"
  },
  {
    "name": "supplier_declared_dg_hz_regulation-0-value",
    "value": "unknown",
    "labelContext": "危险商品规管 unknown"
  },
  {
    "name": "eu_spare_part_availability_duration-0-value",
    "value": "",
    "labelContext": "欧盟备件可用性持续时间"
  },
  {
    "name": "eu_spare_part_availability_duration-0-unit",
    "value": "",
    "labelContext": "欧盟备件可用性持续时间单位"
  }
]
```

## Step 6: 重复执行直到所有 ASIN/SKU 完成

重复流程必须以持久化任务状态为准：

```text
inventory_opened
parent_variations_expanded
asin_sku_inventory_read
sku_central_opened
edit_entry_discovered
edit_page_opened
product_details_dom_read
images_dom_read
variations_dom_read
offer_dom_read
safety_and_compliance_dom_read
asin_sku_completed
```

每个 ASIN/SKU 输出一条 bounded result：

```json
{
  "sellerSku": "7Y-PMQW-FOAE",
  "asin": "B0DB6K6WJ5",
  "productType": "SHOWERHEAD",
  "marketplace": "amazon.ae",
  "inventoryEvidenceRef": "opaque-local-ref",
  "skuCentralEvidenceRef": "opaque-local-ref",
  "editTabs": {
    "product_details": { "status": "read", "fieldCount": 32 },
    "images": { "status": "read", "imageCount": 10 },
    "variations": { "status": "read", "fieldCount": 4 },
    "offer": { "status": "read", "fieldCount": 37 },
    "safety_and_compliance": { "status": "read", "fieldCount": 30 }
  },
  "unverifiedSteps": [
    "inventory_search_submit",
    "sku_central_edit_button_navigation"
  ]
}
```

每个失败或未成立步骤必须显式记录，不得补默认值：

```text
search_result_dom_not_verified
edit_button_navigation_not_verified
tab_dom_not_loaded
login_required
captcha_or_2fa_required
review_required
```

## 证据与隐私

允许保存：

- SKU
- ASIN
- FNSKU
- productType
- marketplace
- 可见 label/value 字段
- 可见图片 host 和 opaque evidence ref
- tab URL path 和安全 query 参数
- DOM 读取时间

禁止保存：

- cookies
- localStorage / sessionStorage
- password / OTP / token
- 完整 HTML
- 未裁剪全页文本 dump
- 任意 Seller Central 写入响应

## 当前已实测成立

- 打开库存管理页。
- 读取库存页可见 ASIN/SKU label-value。
- 点击父体 expander 后读取子体 SKU/ASIN。
- 读取 SKU Central 页 SKU/ASIN/FNSKU。
- 发现 SKU Central `编辑商品信息` button 及 shadow 内部 button。
- 读取已有编辑页五个 tab href。
- 读取 `产品详情` TAB DOM。
- 读取 `图片` TAB DOM。
- 读取 `变种` TAB DOM 的当前可见状态。
- 读取一个真实 `报价` TAB DOM。
- 读取 `安全与合规` TAB DOM。

## 当前未实测成立，禁止当作生产事实

- 库存筛选搜索提交后结果 DOM 收敛。
- ASIN 搜索词收敛。
- 点击 SKU Central `编辑商品信息` 后跳转到编辑页。
- 对所有 SKU 的 offer TAB 均可读。
- 读取隐藏/折叠/懒加载的全部编辑字段。
- 跨分页读取库存页所有商品。

## 后续实现前必须补的法案与质检

实现前必须新增：

- active law：`module-amazon-listing-edit-read-sync.instructions.md`
- 施工图绑定：本文档
- plugin owner：`src/plugins/amazon-listing-edit-read-sync/**`
- Workbench route：`/api/plugins/amazon-listing-edit-read-sync/**`
- audit domain：`scripts/audit/domains/amazon-listing-edit-read-sync/{manifest.json,inspector.ts}`
- acceptance：覆盖库存父体展开、ASIN/SKU 读取、编辑 TAB DOM fixtures、禁止保存/提交/上传/删除
- `ci:full` 接入

Inspector 必须阻断：

- Seller Central write action
- save / submit / delete / upload / send inventory / replenish reminder click
- raw HTML evidence
- cookie/storage/password读取
- 外部 selector/action/browser command 输入
- second browser controller / second route bus / fallback flow
- 把本 flow 塞进 `amazon-product-sync`
