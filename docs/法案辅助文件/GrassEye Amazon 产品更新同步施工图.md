# GrassEye Amazon 产品更新同步施工图

本施工图从属 `.github/instructions/agent-rules/modules/module-amazon-product-sync.instructions.md`，不能覆盖 active law。

## 单链路

```text
ON-THE-WAY Amazon Manage
-> /api/plugins/amazon-product-sync/start
-> Workbench API Boundary
-> workbench-amazon-product-sync-routes.ts
-> startAmazonProductSyncTask
-> runAmazonProductSyncFlow
-> BrowserController
-> task status JSON
```

## Phase 1

只读读取当前 Seller Central 库存页。允许读取 SKU、ASIN、标题快照、主图证据 ref、库存数、状态和 30 天销量快照。

如果页面先展示父体/变体组，flow 必须先执行只读展开动作，再读取子 SKU 行。展开动作只能用于 reveal DOM，不得触发保存、提交、编辑或库存写入。

禁止任何 Seller Central 写入动作。标题和主图只是 evidence，不是 Listing truth。

## 实测 DOM 结构

2026-06-03 使用 Chrome 插件读取 `sellercentral.amazon.ae/myinventory/inventory`：

- 父体/变体行容器：`JanusTable-module__tableContentRow`。
- 父体展开标题：`VariationExpander-module__expanderTitle`，文本形态为 `变体 (15)`。
- 真实可点击展开层：`VariationExpander-module__expanderHeader svg`。点击外层 header/div 在实测中不稳定，不得作为生产动作。
- 展开前第一组子 SKU 不在 DOM；展开后页面文本长度从约 `3425` 增加到约 `9686`，子 SKU 行出现。
- 子 SKU 行产品详情容器：`ProductDetails-module__container`。
- SKU/ASIN、库存、绩效字段结构：`JanusSplitBox-module__row` 下两个 `JanusSplitBox-module__panel`，左侧 panel 是 label，右侧 panel 是 value。
- 库存字段必须按 exact label/value 读取：`现货（亚马逊物流）`、`入库`、`不可售`、`预留`。
- 30 天销量快照必须按 exact label/value 读取：`售出件数`。

生产代码必须先用 DOM probe 定位 `svg` 中心点，再调用 BrowserController 只读 click。`evaluateActiveTab` 只负责读取 DOM 和返回点位/字段证据，不得在 evaluate 脚本内模拟 click 事件。

生产抽取必须以 `ProductDetails-module__container` + `JanusSplitBox` label/value 为主链路。禁止用整行全文 `split/match/findAfter` 或 SKU 文本包含打分来替代结构化字段读取。

## 验收

- route 只接受安全 JSON。
- AGENT 自己拥有 DOM 解析脚本。
- login/captcha/2FA 不得返回 success。
- matched/not_found/ambiguous 都有 per-item status。
- `/status/:taskId` 可轮询 terminal result。
- audit 必须阻断旧的全文兜底抽取和 SKU contains 匹配。
