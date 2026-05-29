# GrassEye Amazon Invoice Upload Unified Chain 施工图

版本：2026-05-28  
状态：active  
owner：amazon-invoice-upload  
对应法案：`.github/instructions/agent-rules/modules/module-amazon-invoice-upload.instructions.md`  
实证来源：`docs/法案辅助文件/amazon_invoice_upload_process.md`

## 1. 当前代码现状

当前 Amazon invoice upload 已存在于 App Shell，只有 `Upload / Latest / Evidence` surfaces。当前 schema 只支持 `missionType: "amazon_invoice_upload"`。当前 Workbench route family 为：

```txt
POST /api/plugins/amazon-invoice-upload/start
GET  /api/plugins/amazon-invoice-upload/status/<taskId>
GET  /api/plugins/amazon-invoice-upload/latest
GET  /api/plugins/amazon-invoice-upload/ledger
```

当前没有 tax invoice CSV download schema、download task record、download routes、Download UI surface、Amazon invoice 专项 audit domain。

## 2. 目标统一链路

```txt
Website / App Shell UI
  -> Workbench API Boundary
      -> Existing Amazon invoice upload route family
          -> GrassEyeWorkbenchHandle
              -> src/plugins/amazon-invoice-upload/**
                  -> TAX_INVOICE_CSV_DOWNLOAD
                  -> DOWNLOAD_ARTIFACT_PERSIST
                  -> APPROVED_INVOICE_UPLOAD
                      -> Task Record / Artifact / Evidence / Runtime Logs
                          -> Agent Upload Ledger
                          -> Website polling or callback
```

禁止新增独立 `amazon-tax-invoice-download` 技能。下载是上传的前置阶段，不是第二链路。

## 3. 实证流程来源

实证文件：`docs/法案辅助文件/amazon_invoice_upload_process.md`

实走环境：

```txt
日期: 2026-05-28
站点: sellercentral.amazon.ae
语言: 中文简体
入口: https://sellercentral.amazon.ae/home
目标报告: 亚马逊配送货件 – 税务发票
目标 URL: /reportcentral/AFNShipmentInvoicingReport/1
```

本施工图只授权实证文件中已实走的第一段下载流程。未实走 DOM selector、URL、按钮文案不得写入生产自动化。

## 4. Evidence Map

每个自动化 Seller Central step 必须引用下列 `stepId`。没有 `stepId` 的 DOM 下载代码不得存在。

| stepId | stepName | sellerCentralPage | actualUrlPattern | humanObservedAction | visibleTextEvidence | locatorCandidates | expectedResult | failureSignals | manualRequiredSignals | downloadArtifactExpectation | chromeVerified | evidenceSourceFile |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AID-01 | open_seller_central_home | Seller Central home | `https://sellercentral.amazon.ae/home` | 打开 Seller Central 管理后台 | `亚马逊`, `搜索`, `NEXGEN 阿拉伯联合酋长国` | `a[aria-label="Amazon"][href="/home"]`, `input[name="query"][placeholder="搜索"]` | home loaded and menu/search visible | login wall, not Seller Central | login, 2FA, captcha, risk verification | none | true | `docs/法案辅助文件/amazon_invoice_upload_process.md` |
| AID-02 | open_global_menu | Seller Central home | `sellercentral.amazon.ae/*` | 点击左上菜单按钮 | `目录`, `库存`, `订单`, `报告` | top-left visible `div[role="button"]`; text anchor `目录` after click | global menu opens | menu not visible | login, captcha, risk verification | none | true | same |
| AID-03 | choose_reports | Global menu | `sellercentral.amazon.ae/*` | 点击或悬停 `报告` | `报告`, `业务报告`, `配送` | visible text `报告` | reports submenu visible | only inventory submenu visible | login, captcha, risk verification | none | true | same |
| AID-04 | open_fulfillment_reports | Reports submenu | `/reportcentral/ref=xx_fbareports_dnav_xx` or `/reportcentral/WelcomePage` | 点击 `配送` | `配送`, `亚马逊配送报告` | `a[aria-label="配送"][href="/reportcentral/ref=xx_fbareports_dnav_xx"]` | fulfillment reports page opens | wrong menu category | login, captcha, risk verification | none | true | same |
| AID-05 | open_afn_shipment_invoicing_report | Fulfillment reports | `/reportcentral/AFNShipmentInvoicingReport/1` | 点击 `亚马逊配送货件 – 税务发票` | `亚马逊配送货件 – 税务发票`, `有关已配送的亚马逊物流买家订单的全面详情` | `a[href="/reportcentral/AFNShipmentInvoicingReport/1"]` plus visible text | target report page opens | target report absent | login, captcha, risk verification | none | true | same |
| AID-06 | choose_event_date_last_30_days | Tax invoice report page | `/reportcentral/AFNShipmentInvoicingReport/1` | 选择事件日期最近 30 天 | `事件日期`, `最近 30 天` | `kat-dropdown[label="事件日期"]`, `kat-option[value="30"]`, `div[title="最近 30 天"]` | dropdown value becomes `30` | value remains `0` | login, captcha, risk verification | none | true | same |
| AID-07 | request_csv_download | Tax invoice report page | `/reportcentral/AFNShipmentInvoicingReport/1` | 点击请求下载 CSV | `请求下载 .csv 文件` | `button[type="button"][value="CSV"]` | first row appears with `.csv` and `进行中` | no current row | login, captcha, risk verification | none | true | same |
| AID-08 | wait_report_download_ready | Tax invoice report page | `/reportcentral/AFNShipmentInvoicingReport/1` | 周期检查第一行状态 | `进行中`, `下载` | first `kat-table-row`, `kat-button[label="下载"]` | first row status becomes `下载` | still in progress after timeout | login, captcha, risk verification | none | true | same |
| AID-09 | refresh_if_needed | Tax invoice report page | `/reportcentral/AFNShipmentInvoicingReport/1` | 180 秒兜底刷新确认 | `下载`, `.csv` | first `kat-table-row`; browser reload by opening current URL | latest row still downloadable | latest row missing | login, captcha, risk verification | none | true | same |
| AID-10 | click_latest_report_download | Tax invoice report page | `/reportcentral/AFNShipmentInvoicingReport/1` | 点击第一行下载 | `下载` | first data row `kat-button[label="下载"][type="button"]` | browser downloads file | click fails or wrong row | login, captcha, risk verification | new local file expected | true | same |
| AID-11 | verify_local_download_artifact | Local Downloads | local filesystem | 检查 Downloads 最新文件 | filename may not end `.csv`; endpoint contentType is CSV | `~/Downloads` mtime/size delta | new file persisted as safe artifact metadata | no new file, zero size | none | artifactRef, artifactName, mimeType, fileSize, sha256, createdAt | true | same |

## 5. Mission Schema 变化

保留：

```txt
missionType: "amazon_invoice_upload"
```

新增：

```txt
missionType: "amazon_tax_invoice_download"
mode: "download_only"
marketplace: "AE" | "SA" | "JP" | "US" | "UK"
sellerCentralEntryUrl: url
reportKind: "afn_shipment_invoicing_tax_invoice"
dateRange: "last_30_days"
format: "csv"
sourceSystem?: string
requestId?: string
callbackUrl?: string
requireHumanReview?: boolean
```

禁止外部输入 `selector`、`documentId`、`downloadUrl`、`flowStep`、`browserCommand`、`cookie`。

## 6. Task Record 变化

新增 download task record：

```txt
taskId
taskKind: "tax_invoice_download"
mission
status
reason
reachedStep
downloadArtifactRef
downloadedFileName
downloadedFileSize
downloadedFileSha256
downloadedAt
evidenceRef
domTraceRef
reviewRequired
sourceSystem
requestId
callbackStatus
createdAt
updatedAt
```

状态：

```txt
received
downloading
download_requested
waiting_report_ready
download_ready
artifact_persisted
completed
manual_required
failed
```

## 7. Artifact Storage 变化

下载文件留在本机 Downloads 或既有安全任务目录；对外只返回 metadata，不返回 raw CSV 内容或本地绝对路径。

允许返回：

```txt
taskId
status
reason
reachedStep
artifactRef
artifactName
mimeType
fileSize
sha256
createdAt
```

## 8. Route 变化

新增到现有 `src/app/workbench-amazon-routes.ts`：

```txt
GET  /api/plugins/amazon-invoice-upload/ledger
POST /api/plugins/amazon-invoice-upload/download/start
GET  /api/plugins/amazon-invoice-upload/download/status/<taskId>
GET  /api/plugins/amazon-invoice-upload/download/latest
GET  /api/plugins/amazon-invoice-upload/download/artifact/<taskId>
```

禁止 `/api/plugins/amazon-tax-invoice-download/**`。

## 9. API Boundary Allowlist 变化

新增 external route rule 必须：

```txt
externalApiAllowed: true
requiresApiKey: true
jobOwner: "amazon-invoice-upload"
```

不得新增 broad prefix `/api/` 或 `/api/plugins/amazon-invoice-upload/`。

## 10. App Shell UI Download Surface 变化

Amazon invoice workspace 目标：

```txt
Download / Upload / Latest / Evidence
```

Download surface 第一阶段字段：

```txt
Marketplace
Seller Central Entry URL
Date Range = Last 30 Days
Report Type = 亚马逊配送货件 – 税务发票
Format = CSV
Callback URL optional
Require Human Review
Start Download
Latest Download
Open Artifact
status / reason / reachedStep
```

UI 禁止字段：`selector`、`flowStep`、`actionPlan`、`documentId`、`cookie`、`browserProfileDirectory`。

## 11. Website API Integration: Amazon Tax Invoice Download

### Start

```http
POST /api/plugins/amazon-invoice-upload/download/start
Origin: https://<allowed-website-origin>
X-GrassEye-Agent-Key: <secret>
Content-Type: application/json
```

```json
{
  "missionType": "amazon_tax_invoice_download",
  "marketplace": "AE",
  "sellerCentralEntryUrl": "https://sellercentral.amazon.ae/home",
  "reportKind": "afn_shipment_invoicing_tax_invoice",
  "dateRange": "last_30_days",
  "format": "csv",
  "sourceSystem": "ontheway",
  "requestId": "website-generated-id",
  "requireHumanReview": true
}
```

### Status

```http
GET /api/plugins/amazon-invoice-upload/download/status/<taskId>
```

### Latest

```http
GET /api/plugins/amazon-invoice-upload/download/latest?requestId=... 或 marketplace=AE
```

### Artifact

```http
GET /api/plugins/amazon-invoice-upload/download/artifact/<taskId>
```

Artifact response must not include raw CSV content, documentId, cookies, or local absolute path.

### Upload Ledger

```http
GET /api/plugins/amazon-invoice-upload/ledger
Origin: https://<allowed-website-origin>
X-GrassEye-Agent-Key: <secret>
```

Ledger response is the website-side upload status truth source. It is populated only when the existing `saveTaskRecord` path writes an Amazon invoice upload task record. It must not be written by website export actions, PDF download actions, or any second upload chain.

Allowed ledger fields:

```txt
taskId
amazonOrderId
invoiceNo
status
reason
reachedStep
evidenceRef
domTraceRef
reviewRequired
createdAt
updatedAt
```

Forbidden ledger response fields:

```txt
invoicePdfPath
raw PDF bytes
local absolute path
cookie / sellerCentralCookie
browserProfileDirectory
selector / browserCommand / flowStep
documentId / downloadUrl
```

Website integration rule:

```txt
Before start/latest/status upload API handoff, website reads full Agent upload ledger and syncs website DB from that ledger. Exporting unuploaded invoices does not change upload status.
```

APP visibility rule:

```txt
Amazon Invoice Upload 的 App Shell Ledger 页面必须同时展示：
1. 单张上传台账：GET /api/plugins/amazon-invoice-upload/ledger 返回的 records。
2. 批量编排台账：GET /api/plugins/amazon-invoice-upload/batch/history 返回的 batches。
SQLite upload ledger 真实存在但 APP 不读取，视为台账不可见缺陷。
```

External upload compatibility rule:

```txt
API Boundary 只拦截 selector / browserCommand / documentId / cookie 等 DOM 控制或敏感逃逸字段。
历史网站 payload 中的 requireHumanFinalSubmit / stopOnManualRequired / sourceSystem / requestId 不得作为 forbidden_external_request_key 在 Boundary 层拦截；upload route 必须先清洗这些非单张上传 schema 字段，再进入既有 startAmazonInvoiceUploadTask 单张上传链路。执行层、schema、service 仍不得保留人工最终提交字段。
```

## 12. Status / Latest / Artifact / Ledger 查询

Status returns the persisted download task record. Latest may filter by requestId or marketplace. Artifact returns safe metadata for known task only and rejects unknown task. Ledger returns safe upload status records for website DB sync and never returns local PDF paths.

## 13. Callback 二阶段策略

第一阶段优先网站轮询。若未来做 callback，必须先通过 API Boundary callback allowlist，plugin 不得任意 fetch `callbackUrl`。

## 14. Inspector / Acceptance 建设

新增唯一 audit domain：

```txt
scripts/audit/domains/amazon-invoice-upload/inspector.ts
```

Acceptance：

```txt
scripts/acceptance/amazon-invoice-upload-download.acceptance.ts
scripts/acceptance/workbench-api-boundary.acceptance.ts
scripts/acceptance/app-shell-ui.acceptance.ts
```

Inspector 必须使用 ts-morph AST 结构检查，不使用 grep / RegExp / raw source scanning 作为执法依据。

Inspector 还必须阻断：

```txt
缺少 amazon-invoice-upload-ledger.ts
saveTaskRecord 未写入 upload ledger
ledger route 未通过 Workbench API Boundary 显式 exact allowlist
ledger route 非 externalApiAllowed true / requiresApiKey true / jobOwner amazon-invoice-upload
ledger response 暴露 invoicePdfPath、本地路径、cookie、selector、browserCommand、documentId、downloadUrl
```

Acceptance 至少覆盖 Workbench API Boundary 外部 GET ledger 成功返回 records。

## 15. Chrome 验证步骤

1. 启动 Workbench。
2. 打开 App Shell。
3. 进入 Amazon invoice upload skill。
4. 看见 Download surface。
5. 输入 `https://sellercentral.amazon.ae/home`。
6. Start Download。
7. Chrome 打开 Seller Central。
8. 打开菜单。
9. 点击 `报告`。
10. 点击 `配送`。
11. 打开 `亚马逊配送货件 – 税务发票`。
12. 选择 `最近 30 天`。
13. 点击 `请求下载 .csv 文件`。
14. 周期检查第一行状态。
15. 第一行出现 `下载` 后点击。
16. 本地 Downloads 出现新文件。
17. task status 显示 `completed` 或 `artifact_persisted`。
18. latest 可读取。
19. artifact endpoint 返回安全 metadata。
20. Upload surface 仍可启动旧上传任务。

## 16. 禁止第二链路清单

禁止：

```txt
src/plugins/amazon-tax-invoice-download/**
src/plugins/amazon-invoice-download/**
scripts/audit/domains/amazon-tax-invoice-download/**
第二 HTTP server
第二 route bus
第二 mission loop
第二 browser controller
第二 evidence store
第二 runtime log chain
```

## 17. Approved Invoice Upload Stability Guard

问题追溯：

```txt
WHY HAPPEN:
法案已定义 amazon-invoice-upload 单 owner、DOM 边界、audit+acceptance+ci-full 覆盖。
缺口不属于可修改 active law；法案文件冻结。
缺口属于后半段上传施工图细节缺失 + amazon-invoice-upload owner inspector 未覆盖刷新/重试稳定性。
```

后半段上传必须固定以下生产行为：

1. 打开订单详情 URL 后，必须对同一订单详情 URL 执行一次刷新。
2. 刷新后必须等待随机 3-6 秒，再进入上传入口定位和点击。
3. 上传关键步骤失败时必须最多额外递归重试 2 次。
4. 重试必须只复用既有 `amazon-invoice-upload` flow、既有 BrowserController、既有 Runtime Log Spine、既有 DOM public facade。
5. 登录、2FA、验证码、人工最终提交、最终上传验证等敏感终态不得被重试伪造成成功。
6. 每次刷新和每次重试必须通过 `recordAmazonDomStepTrace` 留下结构化调试证据，日志只记录 step / reason / 状态摘要，不记录 PDF 内容、cookie、documentId 或 CSV 内容。
7. AGENT 发票上传执行链禁止默认或主动停在人工最终提交；`requireHumanFinalSubmit` 不再属于上传执行契约，UI/client/schema/service 均不得发送或保留该字段。外部旧 payload 若携带该字段，只能在 upload route 清洗后进入既有单张上传链路，生产执行必须继续自动点击 Seller Central 弹窗底部最终 `上传` / `Upload`。
8. Seller Central 中文与英文界面都必须有精确文案覆盖：中文弹窗 `请上传您的发票或贷记单`、底部按钮 `上传`；英文弹窗 `Please upload your invoice or credit note`、底部按钮 `Upload`；成功/已上传证据必须覆盖 `感谢您上传文件` / `Thank you for uploading the document`、`客户可以直接从自己的账户下载文件` / `The customer will be able to download it directly from their account`、`管理发票` / `Manage invoice`、`由卖家生成` / `Seller generated`。

生产落点：

```txt
src/plugins/amazon-invoice-upload/amazon-invoice-upload-order-detail.ts
src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts
```

防复发落点：

```txt
scripts/audit/domains/amazon-invoice-upload/inspector.ts
```

Inspector 必须用 ts-morph AST 检查：

```txt
ORDER_DETAIL_REFRESH_WAIT_MIN_MS = 3_000
ORDER_DETAIL_REFRESH_WAIT_MAX_MS = 6_000
openApprovedOrderDetail -> refreshApprovedOrderDetailOnce
randomOrderDetailRefreshWaitMs -> Math.random()
UPLOAD_STEP_RETRY_LIMIT = 2
runUploadStepWithRetries 递归调用自身
open order detail / open upload invoice entry / upload approved invoice 均接入 runUploadStepWithRetries
敏感终态 gate 不进入无限重试
不得存在 `file attached before final submit` 人审终止分支
schema / UI / client / service 均不得保留 `requireHumanFinalSubmit` 或 `stopOnManualRequired`
API Boundary 不得把 `requireHumanFinalSubmit` / `stopOnManualRequired` 当作 forbidden_external_request_key；upload route 必须清洗 legacy 非 schema 字段
APP Ledger 页面必须读取 `/api/plugins/amazon-invoice-upload/ledger` 并展示 upload records
Batch / Upload UI 不得暴露 `Safe Review Mode` 或 `require human final submit`
```

验收要求：

```txt
1. 故意破坏生产代码中的刷新或重试守卫。
2. 运行 npm run audit:amazon-invoice-upload。
3. 必须观测到 FAIL。
4. 恢复生产代码。
5. npm run audit:amazon-invoice-upload / npm run typecheck / npm run ci:full 必须通过。
```

## 18. Batch Upload Orchestration Ledger

问题追溯：

```txt
WHY HAPPEN:
单张上传能力已经存在，但批量使用方式没有稳定编排层、没有多文件入口、没有长期 batch ledger。
该缺口属于 amazon-invoice-upload 施工图细节和防复发验收缺失，不属于 active law 缺失；法案文件冻结。
```

批量上传必须固定为：

```txt
Batch Upload = orchestration only
Single Upload = existing startAmazonInvoiceUploadTask / runAmazonInvoiceUpload
```

禁止：

```txt
新增第二 Amazon 发票技能
复制 Seller Central DOM 上传步骤
并发上传
外部输入 selector / browserCommand / flowStep / cookie / documentId
只保存内存结果而不保存本地 ledger
```

第一版文件规则：

```txt
文件名必须是 403-7307700-7597913.pdf
amazonOrderId = basename without .pdf
invoiceNo = amazonOrderId
同一 batch 重复 orderId 阻断
单文件最大 10MB
不得设置任意 batch 张数上限；本地一次选择 2000 / 100000 张都必须进入可见队列。
```

大批量本地来源执行规则：

```txt
App Shell Batch Upload 不得把所有选中的 PDF bytes 一次性塞进一个 multipart 请求。
本地一次选择的 FileList 必须被视为 local file queue：逐张按文件名解析 amazonOrderId / invoiceNo，逐张调用既有 POST /api/plugins/amazon-invoice-upload/start 单张上传入口。
这不是第二链路；它等价于网站过去逐张发 API，只是 PDF 来源从网站传输变为用户本地选择。
```

生产落点：

```txt
src/plugins/amazon-invoice-upload/amazon-invoice-upload-batch-service.ts
src/plugins/amazon-invoice-upload/amazon-invoice-upload-batch-storage.ts
src/plugins/amazon-invoice-upload/amazon-invoice-upload-batch.types.ts
src/app/workbench-amazon-routes.ts
src/app/workbench-api-boundary.ts
src/app/workbench-multipart.ts
src/app/app-shell/app-shell-layout.ts
src/app/workbench-home-amazon-invoice-client.ts
src/lib/local-runtime/workbench-amazon-invoice-handle.ts
```

Batch route 必须保持在现有 owner 路径内：

```txt
POST /api/plugins/amazon-invoice-upload/batch/start
GET  /api/plugins/amazon-invoice-upload/batch/status/<batchId>
GET  /api/plugins/amazon-invoice-upload/batch/latest
GET  /api/plugins/amazon-invoice-upload/batch/history
```

Batch route 是本地 App Shell 来源入口，不是网站侧新增上传协议。外部网站继续使用单张：

```txt
POST /api/plugins/amazon-invoice-upload/start
```

Batch UI 不得暴露 `Seller Central Entry URL`。批量本地来源层必须对每个 item 用 marketplace + `amazonOrderId` 派生和网站单张 API 一致的订单详情入口：

```txt
https://sellercentral.amazon.<market>/orders-v3/order/<amazonOrderId>
```

禁止把 batch 单张任务接到 Seller Central `/home` 作为上传入口；首页只适用于下载报告入口，不是订单发票上传入口。

Batch Upload 不得暴露、隐藏发送、默认启用人审最终提交模式。批量上传必须纯自动执行到 Seller Central 最终提交和上传结果验证；登录失效、验证码、2FA 等全局鉴权问题必须进入 `blocked_auth` 并停止，普通单张 DOM/平台失败必须记录为该 item `failed`，默认继续后续 item，除非用户显式开启 `stopOnFailed`。

ledger storage:

```txt
<dataDir>/plugin-tasks/amazon-invoice-upload/batch/<batchId>/batch.json
<dataDir>/plugin-tasks/amazon-invoice-upload/batch/<batchId>/files/<orderId>.pdf
```

防复发落点：

```txt
scripts/acceptance/amazon-invoice-upload-batch.acceptance.ts
scripts/acceptance/app-shell-ui.acceptance.ts
scripts/acceptance/workbench-api-boundary.acceptance.ts
scripts/audit/domains/amazon-invoice-upload/inspector.ts
```

验收要求：

```txt
npm run acceptance:amazon-invoice-upload-batch
npm run acceptance:app-shell-ui
npm run acceptance:workbench-api-boundary
npm run audit:amazon-invoice-upload
npm run ci:full
```
