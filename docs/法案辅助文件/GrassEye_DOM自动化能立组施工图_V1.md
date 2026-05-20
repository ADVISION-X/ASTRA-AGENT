# GrassEye DOM 自动化能立组施工图

版本：V1.0  
建议路径：`docs/法案辅助文件/GrassEye DOM 自动化能立组施工图.md`  
对应法案：`module-dom-automation.instructions.md`  
建设目标：补齐 GrassEye 当前 Agent 的 DOM 自动化能力，使 Amazon 发票上传等后台网页任务可以作为插件接入，而不耦合视觉 Agent、不重复造轮子。

---

## 1. 建设定位

### 1.1 当前状态

GrassEye 已具备以下基础能力：

- 当前本地 Chrome 会话复用
- 打开 URL
- 当前页面截图
- 鼠标点击
- 滚动
- 文本输入
- 按键
- 视觉单轮任务
- MuscleMemory catalog
- 结构化日志
- 本地 APP shell

但当前缺少一组通用 DOM 能力：

- 读取 DOM 摘要
- 语义定位元素
- 结构化填表
- DOM 点击
- 文件上传
- DOM 状态验证

因此 Amazon 发票上传不应该新造 Agent，而应该新增 DOM 自动化能立组。

### 1.2 本施工图目标

新增：

```txt
src/capabilities/dom-automation/**
```

并通过能力注册，使其成为 GrassEye 平级能力组。

Amazon 发票上传作为插件使用 DOM 能力，不进入核心能力组。

---

## 2. 总体架构

```txt
用户在网站后台点击“上传发票”
        ↓
网站生成任务 payload
        ↓
GrassEye Local App / Bridge 接收任务
        ↓
Amazon Invoice Upload Plugin 编排流程
        ↓
调用 DOM Automation Capability Group
        ↓
复用 CurrentChromeBrowserController
        ↓
操作当前本地 Chrome 中的 Amazon 页面
        ↓
保存 evidence / log / result
        ↓
回写网站后台订单状态
```

---

## 3. 目录规划

### 3.1 DOM 能力组目录

```txt
src/capabilities/dom-automation/
  ├─ index.ts
  ├─ schema.ts
  ├─ manifest.ts
  ├─ runtime/
  │   ├─ dom-snapshot.ts
  │   ├─ dom-locator.ts
  │   ├─ dom-fill.ts
  │   ├─ dom-click.ts
  │   ├─ dom-upload.ts
  │   ├─ dom-verify.ts
  │   └─ dom-wait.ts
  ├─ contracts/
  │   ├─ dom-snapshot.contract.ts
  │   ├─ dom-element-ref.contract.ts
  │   ├─ dom-action-result.contract.ts
  │   └─ dom-review-required.contract.ts
  └─ tests/
      ├─ dom-snapshot.fixture.ts
      ├─ dom-locator.fixture.ts
      └─ dom-upload.fixture.ts
```

### 3.2 插件目录

```txt
src/plugins/amazon-invoice-upload/
  ├─ index.ts
  ├─ mission.schema.ts
  ├─ amazon-invoice-upload.flow.ts
  ├─ amazon-platform.config.ts
  ├─ amazon-dom-hints.ts
  ├─ amazon-result-detector.ts
  └─ README.md
```

### 3.3 禁止目录

DOM 能力不得写入：

```txt
src/visual-mission/**
src/lib/browser/**   // 除非是必要的 BrowserController 接口扩展
src/plugins/amazon-invoice-upload/dom-private-controller.ts
```

---

## 4. 能力清单

## 4.1 READ_DOM_SNAPSHOT_ONCE

### 输入

```ts
type ReadDomSnapshotInput = {
  includeFrames?: boolean;
  includeHidden?: false;
  maxTextLengthPerNode?: number;
  targetScope?: "active-tab" | "current-frame";
};
```

### 输出

```ts
type DomSnapshot = {
  url: string;
  title: string;
  forms: DomFormSummary[];
  inputs: DomInputSummary[];
  buttons: DomButtonSummary[];
  links: DomLinkSummary[];
  fileInputs: DomFileInputSummary[];
  dialogs: DomDialogSummary[];
  frames: DomFrameSummary[];
  detectedStates: DomDetectedState[];
};
```

### 规则

- 只读
- 不输出完整 HTML
- 不输出 cookie / localStorage / token
- 不输出 password value
- 只保留摘要信息

---

## 4.2 LOCATE_DOM_ELEMENT_ONCE

### 输入

```ts
type LocateDomElementInput = {
  snapshotRef: string;
  targetKind:
    | "search-input"
    | "button"
    | "link"
    | "file-input"
    | "order-row"
    | "upload-invoice-entry"
    | "success-message";
  hints: string[];
  requiredText?: string;
  frameHint?: string;
};
```

### 输出

```ts
type DomElementRef = {
  elementRef: string;
  selector: string;
  frameRef?: string;
  targetKind: string;
  confidence: number;
  matchedSignals: string[];
  reason: string;
  fallbackUsed: boolean;
};
```

### 定位策略

优先级：

1. role / accessible name
2. aria-label
3. label relation
4. placeholder
5. visible text
6. name / id
7. data-testid / automation id
8. selector candidate
9. CSS fallback

### 真实页面回归细则

以下细则来自 Seller Central 真实页面 DOM 回归，属于施工图级闭环要求，不改变冻结法案：

- `search-input` 候选必须收窄到 `input[type=text]`、`input[type=search]`、`textarea`；`select`、`input[type=file]`、`input[type=submit]`、checkbox 等控件不得被当作可输入搜索框。
- locator 必须对 `id` / `name` 精确命中和 `visibleText` / `ariaLabel` 精确命中加权，避免全局搜索框、局部订单搜索框之间误选。
- `order-row` 必须支持 `tableRows` / `roleRows` / text candidate，不得只从 `button` / `link` / `input` 中定位。
- `upload-invoice-entry` 必须支持 `button`、`input[type=submit]`、`input[type=button]`、`role=button` 与短文本 clickable candidate；大段父容器文本不得压过真实按钮。
- `selectorCandidate` 必须能为 `input[type=submit|button][value]` 生成稳定 selector，DOM click 的 expected text 校验也必须读取 `input.value`。
- `button` targetKind 必须给 `input[type=submit]` 表单按钮明确语义加权，避免 Seller Central 全局搜索 button 压过订单表单 submit input。
- `fileInputs` 摘要必须包含隐藏的 `input[type=file]`，但仍不得输出 file input value 或文件内容；`file-input` locator 允许定位隐藏 file input，真实上传由 `UPLOAD_APPROVED_FILE_ONCE` 的 approved path 与 BrowserController 上传端口治理。
- `dialogs` runtime 输出字段必须与 schema contract 对齐，不得因为摘要字段漂移导致真实弹窗 snapshot parse 失败。
- Amazon 插件 hint 必须覆盖 Seller Central 真实 DOM 暴露的局部订单搜索信号，包括 `myo-search-input`、中文 `搜索`、中文 `订单编号`，不能只保留英文抽象 hint。

---

## 4.3 FILL_DOM_ELEMENT_ONCE

### 输入

```ts
type FillDomElementInput = {
  elementRef: string;
  approvedText: string;
  clearBeforeType: boolean;
  inputPurpose: "order-search" | "invoice-number" | "generic-approved-text";
};
```

### 输出

```ts
type DomActionResult = {
  ok: boolean;
  actionId: string;
  message: string;
  beforeEvidenceRef?: string;
  afterEvidenceRef?: string;
};
```

### 规则

- approvedText 必须来自任务 payload
- 不允许 AI 自己生成业务值
- 不允许输入密码
- 不允许未定位直接输入

---

## 4.4 CLICK_DOM_ELEMENT_ONCE

### 输入

```ts
type ClickDomElementInput = {
  elementRef: string;
  expectedKind: string;
  expectedText?: string;
  waitAfterMs?: number;
};
```

### 规则

- 只能点击 visible + enabled 元素
- 多匹配必须返回 ambiguous
- 点击后必须生成 after evidence
- 危险动作进入 review_required

---

## 4.5 UPLOAD_APPROVED_FILE_ONCE

### 输入

```ts
type UploadApprovedFileInput = {
  elementRef: string;
  approvedFilePath: string;
  allowedExtensions: [".pdf"];
  uploadPurpose: "amazon-invoice-pdf";
};
```

### 规则

- 文件必须存在
- 文件必须是 approved task file
- 文件扩展名必须允许
- 不读取文件正文给 AI
- 不允许任意路径
- 上传前后必须保存 evidence

### 实现建议

优先方式：

```txt
使用 Chrome DevTools Protocol / Playwright file chooser / input[type=file] 设置文件
```

如果当前 Chrome AppleScript 控制器不支持 file input，需要新增一个受治理 BrowserController 子能力：

```txt
browser.setFileInputFiles(elementRef, approvedFilePath)
```

但该能力必须归属 DOM 能力组调用，不让业务插件直接触碰底层浏览器。

---

## 4.6 VERIFY_DOM_STATE_ONCE

### 输入

```ts
type VerifyDomStateInput = {
  snapshotRef?: string;
  expectedStates: Array<
    | "order-found"
    | "invoice-upload-entry-visible"
    | "file-attached"
    | "upload-success"
    | "login-required"
    | "captcha-or-2fa-required"
  >;
  successHints: string[];
  failureHints: string[];
};
```

### 输出

```ts
type DomVerificationResult = {
  status:
    | "success"
    | "failed"
    | "not_found"
    | "ambiguous"
    | "login_required"
    | "captcha_or_2fa_required"
    | "review_required";
  confidence: number;
  evidenceRef: string;
  reason: string;
};
```

---

## 5. Amazon 发票上传插件设计

### 5.1 插件身份

插件名：

```txt
amazon-invoice-upload
```

定位：

```txt
使用 DOM 自动化能力完成 Amazon Seller Central 发票上传的业务插件。
```

它不是核心能力。  
它不能拥有 BrowserController。  
它不能拥有 DOM locator 底层能力。

### 5.2 输入 payload

```ts
type AmazonInvoiceUploadMissionInput = {
  missionType: "amazon_invoice_upload";
  marketplace: "AE" | "SA" | "JP" | "US" | "UK";
  amazonOrderId: string;
  invoiceNo: string;
  invoicePdfPath: string;
  sellerCentralEntryUrl: string;
  adminOrderUrl?: string;
  requireHumanFinalSubmit?: boolean;
};
```

### 5.3 第一版流程

```txt
1. Open Amazon Seller Central order management entry
2. READ_DOM_SNAPSHOT_ONCE
3. LOCATE_DOM_ELEMENT_ONCE: search input
4. FILL_DOM_ELEMENT_ONCE: amazonOrderId
5. PRESS_APPROVED_KEY_ONCE 或 CLICK_DOM_ELEMENT_ONCE: search
6. READ_DOM_SNAPSHOT_ONCE
7. LOCATE_DOM_ELEMENT_ONCE: order row / order detail link
8. CLICK_DOM_ELEMENT_ONCE
9. READ_DOM_SNAPSHOT_ONCE
10. LOCATE_DOM_ELEMENT_ONCE: upload invoice entry
11. 输出 review_required，让操作者人工确认上传入口
```

第一版验收：

- 能打开 Amazon 页面
- 能搜索订单
- 能进入订单详情
- 能定位上传入口
- 能保存 evidence
- 不自动上传文件

### 5.4 第二版流程

```txt
1-10 同第一版
11. CLICK_DOM_ELEMENT_ONCE: upload invoice entry
12. READ_DOM_SNAPSHOT_ONCE
13. LOCATE_DOM_ELEMENT_ONCE: file input
14. UPLOAD_APPROVED_FILE_ONCE: invoicePdfPath
15. VERIFY_DOM_STATE_ONCE: file attached
16. requireHumanFinalSubmit=true 时 stop review_required
17. requireHumanFinalSubmit=false 时 CLICK_DOM_ELEMENT_ONCE submit
18. VERIFY_DOM_STATE_ONCE upload success
19. SAVE_RECORD_ONCE
20. 回写网站后台状态
```

### 5.5 状态回写

建议状态：

```txt
pending
opened_amazon
login_required
search_input_found
order_search_submitted
order_found
order_detail_opened
upload_entry_found
file_attached
upload_submitted
upload_success
review_required
failed
```

---

## 6. BrowserController 最小扩展

当前 `CurrentChromeBrowserController` 已支持：

- open
- scroll
- click
- textInput
- screenshotRegion
- wait

DOM 能力需要补充：

```ts
interface DomCapableBrowserController {
  evaluateActiveTab<T>(script: string): Promise<T>;
  setFileInputFiles?(elementRef: string, filePath: string): Promise<BrowserActionResult>;
}
```

### 注意

不要直接把大量 DOM 逻辑塞进 BrowserController。

BrowserController 只提供最小桥：

```txt
执行受治理 JS
返回结果
```

DOM 解析、定位、验证应归属：

```txt
src/capabilities/dom-automation/runtime/**
```

### 6.1 CurrentChrome active tab 执行细则

`CurrentChromeBrowserController.evaluateActiveTab` 必须保持与 Google Chrome AppleScript `execute ... javascript` 返回值语义兼容：

- wrapped active-tab script 必须同步返回 `JSON.stringify(result ?? null)`。
- 不得把外层 wrapper 改为 `async` IIFE，避免 AppleScript 收到 Promise/空返回而导致真实 Chrome DOM 读取失效。
- BrowserController 仍只做受治理执行桥，不解析 DOM、不定位元素、不知道 Amazon。

---

## 7. 与 MuscleMemory Catalog 的接入

新增 catalog entries：

```txt
READ_DOM_SNAPSHOT_ONCE
LOCATE_DOM_ELEMENT_ONCE
FILL_DOM_ELEMENT_ONCE
CLICK_DOM_ELEMENT_ONCE
UPLOAD_APPROVED_FILE_ONCE
VERIFY_DOM_STATE_ONCE
WAIT_FOR_DOM_STATE_ONCE
```

### AI action plan 可见性建议

| Ability | allowedForAiActionPlan |
|---|---:|
| READ_DOM_SNAPSHOT_ONCE | false |
| LOCATE_DOM_ELEMENT_ONCE | false |
| FILL_DOM_ELEMENT_ONCE | true |
| CLICK_DOM_ELEMENT_ONCE | true |
| UPLOAD_APPROVED_FILE_ONCE | false |
| VERIFY_DOM_STATE_ONCE | false |
| WAIT_FOR_DOM_STATE_ONCE | true |

解释：

- 读取、定位、验证由系统编排更稳。
- 填写、点击、等待可由 action plan 调用。
- 文件上传属于敏感操作，第一版不暴露给 AI action plan，由插件明确调用。

---

## 8. 运行日志设计

每一步输出：

```ts
type DomAutomationLogEvent = {
  eventType: "dom_automation_step";
  missionId: string;
  stepId: string;
  abilityId: string;
  targetHost: string;
  targetKind: string;
  result: "ok" | "failed" | "review_required";
  evidenceRef?: string;
  reason?: string;
  createdAt: string;
};
```

禁止日志字段：

```txt
cookie
token
password
localStorage
sessionStorage
fullHtml
pdfContent
```

---

## 9. 施工阶段

### Phase 1：DOM 只读与定位

目标：

- READ_DOM_SNAPSHOT_ONCE
- LOCATE_DOM_ELEMENT_ONCE
- 基本 selector confidence
- 登录/验证码状态识别

验收：

```txt
能在普通网页中识别 search input / button / file input
```

---

### Phase 2：DOM 输入与点击

目标：

- FILL_DOM_ELEMENT_ONCE
- CLICK_DOM_ELEMENT_ONCE
- WAIT_FOR_DOM_STATE_ONCE

验收：

```txt
能在测试页面中填入订单号并点击搜索
```

---

### Phase 3：Amazon 插件第一版

目标：

```txt
打开 Amazon -> 搜索订单 -> 进入订单 -> 定位上传入口 -> review_required
```

验收：

```txt
人工可见运行，全程日志与截图证据完整
```

---

### Phase 4：文件上传能力

目标：

- UPLOAD_APPROVED_FILE_ONCE
- 文件存在性验证
- PDF 扩展名验证
- 上传前后证据

验收：

```txt
能在测试 file input 页面上传指定 PDF
```

---

### Phase 5：Amazon 插件第二版

目标：

```txt
搜索订单 -> 上传 PDF -> 验证成功 -> 回写状态
```

验收：

```txt
至少 3 个真实订单上传场景稳定通过
遇到登录/验证码/页面歧义必须 review_required
```

---

## 10. 验收命令建议

新增：

```json
{
  "scripts": {
    "audit:dom-automation": "node --import tsx scripts/audit/domains/dom-automation/run-inspector.ts",
    "acceptance:dom-automation-smoke": "node --import tsx scripts/acceptance/dom-automation-smoke.ts",
    "acceptance:amazon-invoice-upload-smoke": "node --import tsx scripts/acceptance/amazon-invoice-upload-smoke.ts"
  }
}
```

注意：

完整质检入口仍以当前项目的 CI-FULL 为准。  
不要恢复第二完整质检入口。

---

## 11. 风险边界

### 11.1 不处理事项

DOM 自动化能立组不负责：

- Amazon 账号管理
- 发票内容生成
- VAT 规则
- 订单真实性判断
- Seller Central 登录
- 反验证码
- 官方 API
- 业务合规裁决

### 11.2 必须暂停事项

出现以下情况进入人工接管：

- 未登录
- 二次验证
- CAPTCHA
- 页面无法识别
- 多个订单匹配
- 多个上传入口匹配
- 文件上传失败
- 成功状态无法确认
- 页面出现危险操作按钮

---

## 12. 关闭定义

DOM 自动化能立组建设完成后，GrassEye 的能力体系变为：

```txt
视觉能力：看见页面
DOM 能力：读懂页面
动作能力：操作页面
插件能力：完成业务
证据能力：保存证明
```

Amazon 发票上传只是第一个插件。

最终目标不是写一个 Amazon 脚本，而是让 GrassEye 拥有可复用、可治理、可插拔的后台网页自动化能力。
