# GrassEye DOM 自动化生产稳定态施工图

status: active
version: 2026-05-21
对应法案: `.github/instructions/agent-rules/modules/module-dom-automation.instructions.md`
施工目标: 将 DOM Automation 从 MVP 子能力集合推进到生产级稳定态能力组。

---

## 1. 建设定位

DOM Automation 是 GrassEye 的浏览器页面动作能力组。

它负责把“页面结构”变成可操作、可验证、可审计的原子动作：

```txt
read snapshot -> locate element -> fill/click/upload -> wait/verify -> return evidence-backed result
```

它不负责：

- 用户需求接入
- job flow 顺序
- Amazon / Facebook 业务判断
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

DOM 能力组只允许 7 个 child ability:

| 子能力 | 输入 | 输出 | 生产级关键点 |
|---|---|---|---|
| `read-dom-snapshot-once` | browser + snapshot input | `DomSnapshot` | privacy-safe, clipped, schema-validated |
| `locate-dom-element-once` | snapshot + target kind + hints | locate result / element ref | semantic scoring, ambiguity handling |
| `fill-dom-element-once` | browser + approved text + element ref | `DomActionResult` | writable revalidation, before/after evidence |
| `click-dom-element-once` | browser + expected kind/text + element ref | `DomActionResult` | DOM-first, coordinate as transport only |
| `upload-approved-file-once` | browser + approved file + file input ref | `DomActionResult` | path approval, file input only, no content leak |
| `wait-for-dom-state-once` | browser + expected states | `DomVerificationResult` | polling, timeout truth |
| `verify-dom-state-once` | snapshot + expected states | `DomVerificationResult` | observed page state, not business fiction |

新增子能力协议:

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
- detectedStates
- capturedAt

生产级规则:

- 不输出完整 HTML。
- 不输出 cookie / localStorage / sessionStorage。
- 不输出 password value。
- 不输出 file input value。
- 文本必须裁剪。
- hidden 普通元素默认不进入候选。
- file input 可以记录 hidden 状态，因为真实后台常用隐藏 file input。
- `includeFrames` 只代表 frame metadata；跨域 frame 内容不能假装已读取。

验收:

```txt
普通表单页能识别 search input / button / file input。
登录页能识别 login_required。
验证码页能识别 captcha_or_2fa_required。
包含 password 的页面不会输出 password value。
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
5. visible text
6. exact id / name
7. data-testid / data-automation-id
8. semantic target kind
9. selector fallback

生产级规则:

- `search-input` 只能匹配 `input[type=text]`、`input[type=search]`、`textarea` 或明确等价控件。
- `file-input` 允许 hidden file input，但只能用于 upload child ability。
- `row` 必须覆盖 `tr`、`role=row`、短文本 row candidate。
- `clickable` 必须覆盖 button、link、role button、短文本 clickable。
- 大段父容器文本不得压过真实按钮。
- top two candidate 分差过小必须 `ambiguous`。
- selector fallback 不得高置信。
- `frameHint` 命中 frame 但 action 不支持 frame 时必须 `review_required`。

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
  sourceSnapshotRef?: string;
  textFingerprint?: string;
  capturedAt?: string;
};
```

当前 `sourceSnapshotRef`、`textFingerprint`、`capturedAt` 可作为下一阶段 schema 扩展。

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

- click identity 是 DOM element ref，不是坐标。
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

## 12. BrowserController 最小端口

DOM 需要的浏览器端口:

```ts
interface DomCapableBrowserController {
  evaluateActiveTab<T>(input: {
    script: string;
    description: string;
    abortSignal?: AbortSignal;
  }): Promise<T>;

  setFileInputFiles(input: {
    elementRef: { selector: string; targetKind: "file-input" };
    filePath: string;
    description: string;
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;

  clickLocatedDomElement(input: {
    targetLabel: string;
    point: { x: number; y: number };
    abortSignal?: AbortSignal;
  }): Promise<BrowserActionResult>;
}
```

边界:

- BrowserController 只执行受治理脚本和低层浏览器动作。
- DOM 解析、定位、验证不能搬进 BrowserController。
- Business plugin 不能直接调用 file-input private implementation。

---

## 13. Audit 图纸

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
    "APEX-DOM-013-V1"
  ]
}
```

Phase 1 inspector minimum:

- Parse DOM law IDs.
- Check schema child ability enum has exactly seven legal values.
- Check public facade exports exactly the legal child functions.
- Check `src/plugins/**` does not import `dom-automation/runtime`.
- Check DOM runtime does not import `src/plugins`.
- Check `src/mediator/**` does not import DOM runtime.
- Check retired action owner roots do not exist.
- Check `dom-upload.ts` contains approved path equality and file-input target checks.
- Check `dom-click.ts` contains sensitive review gate.

Phase 2 inspector:

- AST check throw-based normal locator failure.
- AST check evidence capture before/after fill/click/upload.
- AST check no full HTML/cookie/storage/password snapshot fields.
- AST check frameRef is not ignored by action paths once frame support is declared.

Phase 3 inspector:

- Import graph owner-boundary enforcement.
- Runtime evidence artifact traceability.
- Acceptance smoke result validation.

---

## 14. Acceptance 图纸

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
1. launch local Playwright page
2. read-dom-snapshot-once
3. locate search input
4. fill approved text
5. locate and click search button
6. locate file input
7. upload approved file
8. wait file-selected
9. click submit
10. wait success-message
11. assert ambiguous duplicate target returns ambiguous
12. assert dangerous click returns review_required
13. assert login/captcha states outrank generic success
```

验收原则:

- DOM smoke 是子能力证明。
- Amazon invoice upload smoke 是 job-flow 证明。
- 两者不能互相替代。

---

## 15. 生产稳定态路线

### Phase 1: 法案与图纸

目标:

- DOM 法案升级为 `APEX-DOM-*`。
- 本施工图落地。
- 能力组上位法回到 GrassEye 体系。

退出标准:

```txt
法案可解析。
施工图与法案 child ability 清单一致。
无网站旧法案内容作为 DOM 主权。
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

### Phase 5: DOM Inspector + Acceptance

目标:

- DOM inspector runner-visible。
- DOM smoke 覆盖全部子能力。

退出标准:

```txt
npm run ci:full 能证明 DOM P0 guard 与 Amazon flow smoke 均执行。
```

---

## 16. 完成定义

DOM Automation 达到生产稳定态时，必须能回答：

```txt
这个动作是谁批准的？
定位依据是什么？
有没有歧义？
操作前后证据在哪里？
失败为什么失败？
是否越过了业务边界？
是否有机器质检阻断 Codex 钻空子？
```

如果任何答案缺失，DOM 只能称为 active，不能称为 production-stable。
