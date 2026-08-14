# GrassEye DOM 自动化生产稳定态施工图

status: active
version: 2026-05-21-v2
对应法案: `.github/instructions/agent-rules/modules/module-dom-automation.instructions.md`
施工目标: 将 DOM Automation 从 MVP 子能力集合推进到生产级稳定态能力组，覆盖市面上大多数网页的识别与操作需求。

---

## 1. 建设定位

DOM Automation 是 GrassEye 的浏览器页面动作能力组。

它负责把“页面结构”变成可操作、可验证、可审计的原子动作：

```txt
read snapshot -> locate element -> scroll (if needed) -> fill / click / upload / select / dismiss-overlay -> wait/verify -> return evidence-backed result
```

它不负责：

- 用户需求接入
- job flow 顺序
- 平台业务判断
- AI 规划
- 浏览器会话生命周期
- 证据存储真相
- 日志系统所有权

生产级目标不是让 DOM “更聪明”，而是让 DOM **更可控、更可证、更不容易越界**。

---

## 2. Owner 边界

DOM owner root:

```txt
src/capabilities/dom-automation/**
```

DOM 可以依赖的外部 owner:

```txt
src/lib/browser/**                  # BrowserController 端口
src/lib/local-runtime/ids.ts         # id 生成
```

DOM 不得依赖:

```txt
src/plugins/**
src/mediator/**
src/app/**
src/capabilities/ai-input-gateway/**
src/capabilities/forensics-persistence/**  # 可返回 evidence ref，但不拥有 persistence truth
src/lib/runtime-logs/**                     # 可被 flow 记录，但 DOM 不建私有日志系统
```

consumer 规则:

```txt
src/plugins/** 只能 import src/capabilities/dom-automation/index.ts
src/mediator/** 禁止 import DOM runtime
src/app/** 禁止 import DOM runtime
```

---

## 3. 目标目录

当前目标目录:

```txt
src/capabilities/dom-automation/
  index.ts
  schema.ts
  contracts/
    dom-action-result.contract.ts
    dom-element-ref.contract.ts
    dom-review-required.contract.ts
    dom-snapshot.contract.ts
  runtime/
    dom-action-result.ts
    dom-evidence.ts
    dom-snapshot.ts
    dom-locator.ts
    dom-fill.ts
    dom-click.ts
    dom-upload.ts
    dom-wait.ts
    dom-verify.ts
    dom-scroll.ts              # 新增: 滚动到元素子能力
    dom-select.ts              # 新增: 下拉选择子能力（原生 + 自定义）
    dom-dismiss-overlay.ts     # 新增: 遮层消除子能力
  tests/
    dom-snapshot.fixture.ts
    dom-locator.fixture.ts
    dom-upload.fixture.ts
```

生产稳定态新增建议:

```txt
src/capabilities/dom-automation/
  runtime/
    dom-locate-result.ts             # 结构化 locate 结果 builder
    dom-frame-scope.ts               # frame/shadow 支持或 review gate
    dom-selector-fingerprint.ts      # selector + semantic fingerprint
  tests/
    dom-automation-smoke.ts          # 断言型子能力 smoke，可搬到 scripts/acceptance

scripts/acceptance/
  dom-automation-smoke.ts

scripts/audit/domains/dom-automation/
  manifest.json
  inspector.ts
```

禁止新增:

```txt
src/capabilities/dom-automation/service.ts
src/capabilities/dom-automation/engine.ts
src/capabilities/dom-automation/planner.ts
src/capabilities/dom-automation/bridge.ts
src/capabilities/dom-automation/legacy.ts
src/lib/dom/**
```

---

## 4. 法定子能力清单

DOM 能力组当前允许 **7 个** active child ability:

| 子能力 | 输入 | 输出 | 生产级关键点 |
|---|---|---|---|
| `read-dom-snapshot-once` | browser + snapshot input | `DomSnapshot` | privacy-safe, clipped, schema-validated, SPA 水合感知 |
| `locate-dom-element-once` | snapshot + target kind + hints | locate result / element ref | semantic scoring, 近邻定位, 组件库模式, CJK 文本 |
| `fill-dom-element-once` | browser + approved text + element ref | `DomActionResult` | writable revalidation, before/after evidence |
| `click-dom-element-once` | browser + expected kind/text + element ref | `DomActionResult` | DOM-first, coordinate as transport only |
| `upload-approved-file-once` | browser + approved file + file input ref | `DomActionResult` | path approval, file input only, no content leak |
| `wait-for-dom-state-once` | browser + expected states | `DomVerificationResult` | polling, timeout truth |

`wait-for-dom-state-once` 的每次底层 snapshot 最长 `1800ms`，并且不得超过调用方给出的总 timeout；底层 Chrome evaluate 不允许以默认 `10000ms` 穿透上层等待窗口。
| `verify-dom-state-once` | snapshot + expected states | `DomVerificationResult` | observed page state, not business fiction |

新增子能力协议（每次新增必须按顺序走）:

```txt
1. 先改 DOM 法案。
2. 再改本施工图。
3. 再改 schema child capability enum。
4. 再实现 runtime。
5. 再补 acceptance smoke。
6. 再补 DOM inspector。
```

---

## 5. 统一结果模型

### 5.1 Action result

```ts
type DomActionResult = {
  ok: boolean;
  status:
    | "success"
    | "failed"
    | "not_found"
    | "ambiguous"
    | "review_required";
  actionId: string;
  message: string;
  beforeEvidenceRef?: string;
  afterEvidenceRef?: string;
  reviewRequiredReason?: string;
};
```

规则:

- `ok: true` 只能和 `status: "success"` 同时出现。
- `review_required` 必须有 `reviewRequiredReason`。
- `not_found` / `ambiguous` 是正常结构化结果，不是普通异常。
- evidence capture 失败不得伪装成功。

### 5.2 Locate result

当前代码直接返回 `DomElementRef` 或 throw。生产稳定态应升级为:

```ts
type DomLocateResult =
  | {
      ok: true;
      status: "success";
      elementRef: DomElementRef;
    }
  | {
      ok: false;
      status: "not_found" | "ambiguous" | "review_required";
      reason: string;
      candidates?: DomLocatorCandidateEvidence[];
    };
```

迁移方式:

```txt
Phase A: 新增 locateDomElementResultOnce，保留 locateDomElementOnce 作为薄兼容 public wrapper。
Phase B: 插件全部迁移到 result API。
Phase C: 删除 throw-based locator wrapper。
```

注意: 这不是 bridge/legacy 双轨；它是同一 owner 内的有界迁移，必须在同一 PR/阶段内收敛。

### 5.3 Verification result

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

生产稳定态要求:

- `login_required` 和 `captcha_or_2fa_required` 优先级最高。
- `file-selected` 不等于业务成功。
- success/failure 同时命中时返回 `ambiguous`。
- `evidenceRef` 应能追到真实 snapshot 或 screenshot；当前 synthetic ref 只能作为过渡库存项。

---

## 6. Snapshot 图纸

目标文件:

```txt
src/capabilities/dom-automation/runtime/dom-snapshot.ts
src/capabilities/dom-automation/schema.ts
```

输入:

```ts
type ReadDomSnapshotInput = {
  includeFrames?: boolean;
  includeHidden?: false;
  maxTextLengthPerNode?: number;
  targetScope?: "active-tab" | "current-frame";
};
```

输出必须包含:

- url
- title
- forms
- inputs
- buttons
- links
- fileInputs
- dialogs
- frames
- textBlocks
- tableRows
- roleRows
- genericClickableElements
- dropdownTriggers           ← 新增: combobox / aria-haspopup 控件
- overlays                  ← 新增: 当前可见遮层列表
- loadingIndicators         ← 新增: skeleton / spinner 状态
- stickyElements            ← 新增: fixed / sticky 定位元素（影响滚动计算）
- detectedStates
- capturedAt

`detectedStates` 必须能表达的状态（新增）:

```txt
cookie-consent-overlay      # Cookie / GDPR 同意横幅
promotional-overlay         # 营销弹窗
modal-dialog                # 通用对话框（purpose 未知时禁止自动消除）
drawer-panel                # 侧边抽屉
loading-skeleton            # 骨架屏 / 加载占位
empty-state                 # 数据空状态
error-state                 # 错误提示状态
rate-limited                # 请求被限流
login_required              # （原有，优先级最高）
captcha_or_2fa_required     # （原有，优先级最高）
```

生产级规则:

- 不输出完整 HTML。
- 不输出 cookie / localStorage / sessionStorage。
- 不输出 password value。
- 不输出 file input value。
- 文本必须裁剪。
- hidden 普通元素默认不进入候选。
- file input 可以记录 hidden 状态，因为真实后台常用隐藏 file input。
- `includeFrames` 只代表 frame metadata；跨域 frame 内容不能假装已读取。

**SPA / 动态内容规则:**

- React / Vue / Angular / Svelte 水合后 DOM 才算可读内容；水合前的占位不能报告为真实元素。
- 懒加载内容未进入 DOM 时不得报告为存在。
- 虚拟滚动容器只报告容器本身和当前可见行数，不伪造屏外行。
- 页面仍在加载时，`detectedStates` 必须含 `loading-skeleton` 或返回明确的可观测状态。

**自定义组件识别规则:**

- Ant Design / Element Plus / Arco Design / Naive UI / Bootstrap / Material UI 中的交互控件必须以语义 role（`combobox`、`tab`、`dialog`、`textbox` 等）记录进快照。
- 自定义下拉触发器（`role=combobox`、`aria-haspopup`、`aria-expanded`）进入 `dropdownTriggers`。
- Tab 面板、Accordion 开关、日期选择器、富文本编辑器、滑块记录到 `genericClickableElements` 并标注 semantic role。
- 作为行操作的表格单元格记录到 `genericClickableElements`。

**遮层感知规则:**

- 活跃遮层记录到 `overlays`，同时在 `detectedStates` 中标注类型。
- 最上层可交互层必须明确；被遮层挡住的子层标注为 obscured。
- GDPR / Cookie 固定横幅不得静默忽略。

**多语言规则:**

- CJK（中文、日文、韩文）文本不得因字符集截断而产生乱码。
- placeholder 和 accessible name 的中文文本必须完整提取。

验收:

```txt
普通表单页能识别 search input / button / file input。
登录页能识别 login_required。
验证码页能识别 captcha_or_2fa_required。
包含 password 的页面不会输出 password value。
React SPA 页面水合后能正确读取动态渲染的 input / button。
含 Cookie 横幅的页面 detectedStates 包含 cookie-consent-overlay。
含 Ant Design Select 的页面 dropdownTriggers 不为空。
骨架屏状态下 detectedStates 包含 loading-skeleton。
含中文 placeholder 的 input 能正确提取 placeholder 文本。
```

---

## 7. Locator 图纸

目标文件:

```txt
src/capabilities/dom-automation/runtime/dom-locator.ts
```

定位优先级:

1. role + accessible name
2. aria-label
3. label relation
4. placeholder
5. visible text（含 CJK 文本子串匹配）
6. exact id / name
7. data-testid / data-automation-id
8. semantic target kind
9. 近邻定位（proximity anchor）
10. selector fallback

新增 target kind:

```txt
dropdown-trigger       # role=combobox / aria-haspopup / aria-expanded 触发器
overlay-dismiss-button # 遮层消除按钮（同意 / 关闭 / 确认类）
tab-button             # role=tab / aria-selected 面板切换
rich-text-editor       # contenteditable / role=textbox aria-multiline
```

生产级规则:

- `search-input` 只能匹配 `input[type=text]`、`input[type=search]`、`textarea` 或明确等价控件。
- `file-input` 允许 hidden file input，但只能用于 upload child ability。
- `row` 必须覆盖 `tr`、`role=row`、短文本 row candidate。
- `clickable` 必须覆盖 button、link、role button、短文本 clickable。
- 大段父容器文本不得压过真实按钮。
- top two candidate 分差过小必须 `ambiguous`。
- selector fallback 不得高置信。
- `frameHint` 命中 frame 但 action 不支持 frame 时必须 `review_required`。

**近邻定位规则:**

- 当 target 无法通过文本或 ARIA 信号直接识别时，允许传入 `proximityAnchorText`（锚点文本）。
- 定位器找到锚点后，在空间上最近的匹配 targetKind 元素作为候选。
- 近邻匹配必须降低 confidence，记录使用的锚点文本。
- 近邻 fallback 不得产生高置信错误命中。

**组件库模式规则:**

- 自定义下拉触发器通过以下信号识别（优先级顺序）：
  1. `role=combobox` + `aria-haspopup=listbox`
  2. `aria-expanded` 属性存在
  3. Ant Design: `.ant-select-selector` 内的 input
  4. Element Plus: `.el-select__input`
  5. Arco Design: `.arco-select-view`
  6. Select2: `.select2-selection`
- 以上 3-6 为 secondary fallback，不得单独作为高置信信号。
- 组件库类名只允许参与评分，不允许作为唯一定位依据。

**动态 class 处理规则:**

- styled-components / CSS Modules / Tailwind JIT 产生的哈希类名不得作为主要 identity。
- 稳定信号（accessible name、role、aria-*、data-testid、id、name）优先。
- 只有哈希类名可用时，必须降低 confidence 并标注 `fallbackUsed: true`。

**CJK 文本匹配规则:**

- visible text 匹配支持大小写不敏感 + 全半角等价比较。
- 中文子串精确匹配无歧义时允许作为低置信 signal。
- 不得因字节截断导致中文 label 匹配失败。

生产级 element ref:

```ts
type DomElementRef = {
  elementRef: string;
  selector: string;
  frameRef?: string;
  targetKind: DomTargetKind;
  confidence: number;
  matchedSignals: string[];
  reason: string;
  fallbackUsed: boolean;
  proximityAnchor?: string;       // 近邻定位时记录锚点文本
  componentLibHint?: string;      // 命中的组件库模式名称
  sourceSnapshotRef?: string;
  textFingerprint?: string;
  capturedAt?: string;
};
```

---

## 8. Fill 图纸

目标文件:

```txt
src/capabilities/dom-automation/runtime/dom-fill.ts
```

输入:

```ts
type FillDomElementInput = {
  elementRef: DomElementRef;
  approvedText: string;
  clearBeforeType: boolean;
  inputPurpose: string;
};
```

生产级规则:

- `approvedText` 必须来自 flow-approved payload。
- 空文本默认 review-required，除非未来法案授权清空动作。
- password input 永远 review-required。
- hidden / disabled / readonly 返回 review-required。
- action 前必须 capture evidence。
- action 后必须 capture evidence。
- 成功前必须读取实际 value 验证。
- React/Vue controlled input 必须触发 input/change 事件。
- shadow host 内部 input 必须 host-scoped revalidate。

禁止:

- AI 自己生成业务值。
- 未定位直接输入。
- evidence 失败仍返回 success。

---

## 9. Click 图纸

目标文件:

```txt
src/capabilities/dom-automation/runtime/dom-click.ts
```

生产级规则:

- click identity 是 DOM element ref；重校验和点击在同一次受控 DOM 动作内完成，不再重复生成坐标点击链。
- 坐标只允许作为 BrowserController 的执行传输细节。
- 点击前 revalidate selector 只匹配一个元素。
- 元素必须 visible + enabled。
- `expectedText` 不匹配返回 review-required。
- 危险文本必须 review-required。
- 点击后必须 capture after evidence。

危险文本默认包含:

```txt
delete
refund
cancel
pay now
submit payment
remove
close account
confirm irreversible
```

业务 flow 如需最终提交，必须有自己的业务法案授权或 `requireHumanFinalSubmit=false` 这类显式 payload 许可。

---

## 10. Upload 图纸

目标文件:

```txt
src/capabilities/dom-automation/runtime/dom-upload.ts
src/lib/browser/** file-input port
```

输入:

```ts
type UploadApprovedFileInput = {
  elementRef: DomElementRef;
  approvedFilePath: string;
  approvedTaskFilePath: string;
  allowedExtensions: string[];
  uploadPurpose: string;
};
```

生产级规则:

- `resolve(approvedFilePath) === resolve(approvedTaskFilePath)`。
- 文件必须存在且是普通文件。
- 扩展名必须 allowlist。
- targetKind 必须是 `file-input`。
- 不读取文件正文给 AI。
- 不把文件正文放入 snapshot/log。
- action 前后必须 evidence。
- 上传后只确认“文件已选中”或页面可观测状态；最终业务成功由 flow 判定。

建议增强:

- 文件大小上限。
- PDF 魔数校验。
- symlink 策略明确化。
- MIME 校验作为 P1。

---

## 11. Wait / Verify 图纸

目标文件:

```txt
src/capabilities/dom-automation/runtime/dom-wait.ts
src/capabilities/dom-automation/runtime/dom-verify.ts
```

状态:

```txt
file-selected
success-message
error-message
login-required
captcha-or-2fa-required
```

生产级规则:

- wait 只轮询 DOM observable state。
- timeout 返回 latest observed status。
- 登录/验证码状态优先级最高。
- success/failure 同时命中返回 ambiguous。
- `file-selected` 不能自动升级为 upload success。
- DOM core 不内置 Amazon 成功文案。
- business success hints 在 plugin 层提供。

Amazon 插件建议:

```txt
上传弹窗等待 >= 12s，poll <= 500ms。
上传成功等待 >= 12s，poll <= 500ms。
未确认成功时返回 review_required，不得伪造 upload_success。
```

---

## 12. Scroll 图纸

目标文件:

```txt
src/capabilities/dom-automation/runtime/dom-scroll.ts
```

输入:

```ts
type ScrollToElementInput = {
  elementRef: DomElementRef;          // 必须来自已完成的 locate 结果
  scrollBudget?: {
    maxPixels?: number;               // 默认 8000px
    maxSteps?: number;                // 默认 20 步
  };
  stickyHeaderOffset?: number;        // 固定头部高度（px），用于计算真实可见区
  scrollPurpose: string;              // 供日志和证据引用
};
```

生产级规则:

- `elementRef` 必须来自同一 flow 步骤中已完成的 `locate-dom-element-once` 结果；不接受裸 selector。
- 滚动后必须重新读取元素的 bounding rect，确认元素已进入 viewport 可见区域。
- `stickyHeaderOffset` 不为零时，计算可见区必须扣除该偏移，避免被固定导航栏遮挡。
- 滚动预算用尽仍未到达时，返回 `review_required`，reason: `element-not-reachable-by-scroll`。
- 不触发无限滚动加载（禁止向下滚动超过 `maxPixels` 限制或 `maxSteps` 限制）。
- 必须捕获 before/after 截图作为 evidence。
- 滚动是支撑原语，不得在 dom-scroll.ts 内做任何业务判断。

禁止:

- 接受裸 selector 或坐标作为滚动目标。
- 成功返回时元素仍被固定遮层遮挡（需重新检测 overlay）。
- 利用滚动触发无限加载分页作为业务导航策略。

验收:

```txt
普通长页面：滚动到折叠区 button 后能正确 click。
固定导航栏页面：stickyHeaderOffset 生效，元素不被遮挡。
预算用尽：返回 review_required，不抛普通异常。
```

---

## 13. Select 图纸

目标文件:

```txt
src/capabilities/dom-automation/runtime/dom-select.ts
```

输入:

```ts
type SelectOptionInput = {
  elementRef: DomElementRef;           // targetKind: "select" | "combobox" | "dropdown-trigger"
  approvedOptionText: string;          // 来自 flow payload
  matchMode: "exact" | "contains";
  approvedOptionList?: string[];       // 多选时提供完整选项列表
  selectPurpose: string;
};
```

处理流程:

```txt
1. 读取 targetKind：
   - "select"（原生 <select>）→ 走原生路径
   - "combobox" / "dropdown-trigger" → 走自定义下拉路径

原生路径:
  a. 用 JS 设置 .value（或 selectedIndex）。
  b. dispatch "change" + "input" 事件（React/Vue controlled input 需要）。
  c. 读取当前 .value 或显示文本，与 approvedOptionText 对比。
  d. 不一致 → return failed。

自定义下拉路径:
  a. Click trigger 打开面板（等待 aria-expanded=true 或面板 DOM 出现）。
  b. 等待选项渲染（最多 3s，poll 100ms）；选项懒加载时等待 DOM 更新。
  c. 在面板内 locate approvedOptionText（exact 或 contains）。
  d. 未找到 → return not_found。
  e. 多个模糊匹配 → return ambiguous + candidate 列表。
  f. Click 目标选项。
  g. 等待面板关闭（aria-expanded=false 或面板 DOM 消失，最多 3s）。
  h. 读取 trigger 显示文本或 hidden input value，与 approvedOptionText 比较。
  i. 不匹配 → return failed，reason: "selection-not-reflected".
```

生产级规则:

- 不得用 fill 操作原生 select（fill 无法触发 option 选择）。
- 不得假设选项面板已打开；必须等待 DOM 确认。
- 不得用 keyboard-only 作为唯一策略（部分页面无键盘 ARIA 支持）。
- Ant Design / Element Plus / Arco Design / Select2 等库的类名只作为 secondary fallback，不作为主识别依据。
- 多选模式必须有 `approvedOptionList`；禁止 caller 不传列表就执行多选。
- 必须捕获 before/after evidence。

验收:

```txt
原生 <select>：选中指定 option，.value 读取一致。
Ant Design Select：click 触发打开，选中后 trigger 显示正确文本。
Element Plus Select：同上。
not_found：选项不存在时返回 not_found，不 crash。
ambiguous：两个 contains 匹配时返回 ambiguous。
多选：approvedOptionList 内每项均被选中，超出列表外的不被选中。
```

---

## 14. Dismiss Overlay 图纸

目标文件:

```txt
src/capabilities/dom-automation/runtime/dom-dismiss-overlay.ts
```

输入:

```ts
type DismissOverlayInput = {
  overlayType:
    | "cookie-consent-overlay"
    | "promotional-overlay"
    | "informational-banner"
    | "gdpr-consent"
    | "app-install-prompt";
  approvedDismissalText: string;    // 来自 flow payload，例如 "Accept"、"关闭"、"Got it"
  dismissPurpose: string;
};
```

安全类型白名单（只允许消除以下类型）:

```txt
cookie-consent-overlay
promotional-overlay
informational-banner
gdpr-consent
app-install-prompt
```

处理流程:

```txt
1. 重新读取快照，确认遮层仍然存在且 overlayType 与输入一致。
2. 检查 overlayType 是否在白名单内；不在 → review_required，reason: overlay-type-not-in-safe-dismissal-allowlist。
3. 在遮层内 locate approvedDismissalText 对应的按钮/链接。
4. 未找到 → not_found。
5. 发现按钮文本含危险词（delete、confirm payment、refund 等）→ review_required，reason: dismissal-button-contains-dangerous-text。
6. Click 按钮。
7. 等待遮层 DOM 消失（最多 5s，poll 200ms）。
8. 遮层仍存在 → failed，reason: overlay-still-present。
9. 遮层消失 → 捕获 after evidence，return success。
```

生产级规则:

- 消除前必须重新读快照（不信任旧快照的遮层状态）。
- `modal-dialog` 不在白名单内；目的未知的对话框必须由 flow 决策，不得自动消除。
- 不得使用 Escape 键作为通用消除策略（不适用于所有遮层）。
- approvedDismissalText 来自 flow payload，DOM core 不内置任何固定文案。
- 必须 before/after evidence。

禁止:

- 消除认证弹窗（login / 2FA / OAuth）。
- 消除支付确认对话框。
- 消除删除确认对话框。
- 用坐标盲点击消除遮层。

验收:

```txt
Cookie 横幅：找到"Accept"按钮，点击后横幅消失，返回 success。
营销弹窗：找到"关闭"按钮，点击后弹窗消失，返回 success。
modal-dialog：不在白名单，返回 review_required。
按钮文本含 "confirm payment"：返回 review_required。
横幅点击后未消失：返回 failed，reason: overlay-still-present。
```

---

## 15. BrowserController 最小端口

DOM 需要的浏览器端口:

```ts
interface DomCapableBrowserController {
  evaluateTarget<T>(input: {
    targetRef: BrowserTargetRef;
    documentRef: BrowserDocumentRef;
    script: string;
    description: string;
    abortSignal?: AbortSignal;
  }): Promise<T>;

  setTargetFileInputFiles(input: {
    targetRef: BrowserTargetRef;
    documentRef: BrowserDocumentRef;
    elementRef: { selector: string; targetKind: "file-input" };
    filePath: string;
    description: string;
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;

  clickTarget(input: {
    targetRef: BrowserTargetRef;
    documentRef: BrowserDocumentRef;
    targetLabel: string;
    point: { x: number; y: number };
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;

  scrollTarget(input: {
    targetRef: BrowserTargetRef;
    documentRef: BrowserDocumentRef;
    selector: string;
    stickyHeaderOffset?: number;
    description: string;
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;                   // 新增: scroll 端口
}
```

边界:

- BrowserController 只执行受治理脚本和低层浏览器动作。
- DOM 解析、定位、验证不能搬进 BrowserController。
- Business plugin 不能直接调用 file-input private implementation。
- 每个 `DomSnapshot` 与 `DomElementRef` 同时绑定 opaque `targetRef + documentRef`；导航后旧 ref 必须拒绝。
- select 的面板开/关检测逻辑在 DOM runtime 完成，BrowserController 只负责执行 target-bound click 和 evaluate。
- 普通 DOM click/fill/scroll/screenshot/file-input 不得申请 PhysicalFocusLease，也不得依赖前台标签页。

---

## 16. Audit 图纸

目标目录:

```txt
scripts/audit/domains/dom-automation/
  manifest.json
  inspector.ts
```

manifest:

```json
{
  "capabilityDomain": "dom-automation",
  "ownerInspector": "scripts/audit/domains/dom-automation/inspector.ts",
  "lawIds": [
    "APEX-DOM-001-V1",
    "APEX-DOM-002-V1",
    "APEX-DOM-003-V1",
    "APEX-DOM-004-V1",
    "APEX-DOM-005-V1",
    "APEX-DOM-006-V1",
    "APEX-DOM-007-V1",
    "APEX-DOM-008-V1",
    "APEX-DOM-009-V1",
    "APEX-DOM-010-V1",
    "APEX-DOM-011-V1",
    "APEX-DOM-012-V1",
    "APEX-DOM-013-V1",
    "APEX-DOM-020-V1"
  ]
}
```

Phase 1 inspector minimum:

- Parse DOM law IDs（应包含 13 条 active laws）。
- Check schema child ability enum has exactly **seven** legal values。
- Check public facade exports exactly the legal child functions。
- Check `src/plugins/**` does not import `dom-automation/runtime`。
- Check DOM runtime does not import `src/plugins`。
- Check `src/mediator/**` does not import DOM runtime。
- Check retired action owner roots do not exist。
- Check `dom-upload.ts` contains approved path equality and file-input target checks。
- Check `dom-click.ts` contains sensitive review gate。
- Check every public snapshot/element/action schema carries opaque target/document refs without raw Chrome ids。
- Check evaluateActiveTab/current-page/first-page fallback and ordinary-action FocusLease calls are absent。

Phase 2 inspector:

- AST check throw-based normal locator failure。
- AST check fill/upload 的 before/after evidence；click 使用已完成的定位快照并强制 capture after evidence。
- AST check no full HTML/cookie/storage/password snapshot fields。
- AST check frameRef is not ignored by action paths once frame support is declared。
- AST check snapshot has `overlays` and `dropdownTriggers` output fields。

Phase 3 inspector:

- Import graph owner-boundary enforcement。
- Runtime evidence artifact traceability。
- Acceptance smoke result validation。

---

## 17. Acceptance 图纸

目标:

```txt
scripts/acceptance/dom-automation-smoke.ts
```

Smoke 页面必须覆盖:

- search input
- normal text input
- button
- clickable div
- file input
- success message
- error message
- login-required page
- captcha/2FA page
- ambiguous duplicate buttons
- hidden/disabled elements

Smoke 子流程:

```txt
1.  launch local Playwright page
2.  read-dom-snapshot-once
3.  locate search input
4.  fill approved text
5.  locate and click search button
6.  locate file input
7.  upload approved file
8.  wait file-selected
9.  click submit
10. wait success-message
11. assert ambiguous duplicate target returns ambiguous
12. assert dangerous click returns review_required
13. assert login/captcha states outrank generic success
14. navigate target and assert every old DomElementRef fails with DOCUMENT_STALE
15. keep a non-target foreground tab marker unchanged while all seven actions run on the controlled background target
```

验收原则:

- DOM smoke 是子能力证明，7 个 active 子能力全覆盖。
- Amazon invoice upload smoke 是 job-flow 证明。
- 两者不能互相替代。

---

## 18. 生产稳定态路线

### Phase 1: 法案与图纸

目标:

- DOM 法案升级为 `APEX-DOM-*`（16 条法律，含新增 014/015/016）。
- 本施工图落地（v2，10 个子能力）。
- 能力组上位法回到 GrassEye 体系。

退出标准:

```txt
法案可解析，包含 16 条 APEX-DOM-* 法律。
施工图与法案 child ability 清单一致（均为 10 个）。
无旧法案内容作为 DOM 主权。
```

### Phase 2: 结构化失败

目标:

- `locateDomElementOnce` 不再用 throw 表达 not_found / ambiguous。
- flow consumer 使用结构化 locate result。

退出标准:

```txt
定位失败不会靠 try/catch 补丁流转。
ambiguous 有候选证据。
```

### Phase 3: Evidence 真链

目标:

- verify evidenceRef 指向真实 snapshot/evidence。
- snapshot ref 进入 element ref 或 trace。

退出标准:

```txt
每个 success / failed / review_required 都能追到真实观察或动作证据。
```

### Phase 4: Frame / Shadow 边界

目标:

- frame metadata 与 inspected content 明确区分。
- frameRef action 未支持时 review-required。
- shadow DOM host revalidation 稳定。

退出标准:

```txt
不再出现假 frame 支持。
```

### Phase 5: 退役子能力保持下线

目标:

- 已退役的 `scroll-to-element-once`、`select-option-once`、`dismiss-overlay-once` 不再出现在 active law、schema child ability enum、public facade、runtime 文件、acceptance smoke 与 inspector 断言中。
- 若未来要恢复这些能力，必须先恢复 active law，再恢复施工图、schema、runtime、acceptance 与 inspector。

退出标准:

```txt
active DOM 面不再宣称已退役子能力。
code-purity 不再因退役子能力产生 zombie surface。
```

### Phase 6: DOM Inspector + Acceptance

目标:

- DOM inspector runner-visible，检查项覆盖全部 10 个子能力。
- DOM smoke 覆盖全部 10 个子能力（包含新增三项）。

退出标准:

```txt
npm run ci:full 能证明 DOM P0 guard 与 Amazon flow smoke 均执行。
inspector Phase 1 检查全部通过。
```

---

## 19. 完成定义

DOM Automation 达到生产稳定态时，必须能回答：

```txt
这个动作是谁批准的？
定位依据是什么？（包含近邻锚点或组件库模式命中时）
有没有歧义？
操作前后证据在哪里？
失败为什么失败？
是否越过了业务边界？
遮层是否被安全消除（类型是否在白名单内）？
下拉选值是否在 trigger 上得到了反映？
滚动是否真正把元素带入可见区（含 sticky 偏移计算）？
是否有机器质检阻断 Codex 钻空子？
```

如果任何答案缺失，DOM 只能称为 active，不能称为 production-stable。
