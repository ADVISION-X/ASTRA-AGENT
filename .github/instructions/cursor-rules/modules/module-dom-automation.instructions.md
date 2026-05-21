# GrassEye DOM 自动化能立组法案

版本：V1.0  
建议路径：`.github/instructions/cursor-rules/modules/module-dom-automation.instructions.md`  
能力组：`dom-automation`  
状态：active  
定位：补全 GrassEye 当前 Agent 的 DOM 自动化子能力，不耦合视觉 Agent，不内置 Amazon 业务流程。

---

## 0. 身份定义

### 0.1 能立组名称

**GrassEye DOM Automation Capability Group**

中文名：**DOM 自动化能立组**

### 0.2 核心定位

DOM 自动化能立组负责在当前本地 Chrome 会话中，对网页 DOM 进行结构化读取、元素定位、表单输入、按钮点击、文件上传、状态验证等原子操作。

它属于 GrassEye 的底层能力补全，不属于视觉任务，不属于 Amazon 专用插件，不属于业务流程 owner。

一句话：

```txt
DOM 自动化能立组只提供可复用网页结构操作能力；具体业务流程由插件编排，不能写死在能力组内部。
```

### 0.3 Owner 边界冻结

DOM 自动化能立组的唯一 owner root 是：

```txt
src/capabilities/dom-automation/**
```

DOM 质检 owner 只能把该目录视为 DOM 能立组内部。以下目录是业务插件 / 任务流 consumer，不属于 DOM 能立组内部：

```txt
src/plugins/amazon-invoice-upload/**
src/plugins/product-video-dom-runtime/**
```

插件可以调用 DOM public facade，但不得成为 DOM owner root、DOM required owner path、DOM 子能力目录或 DOM registry truth。

### 0.4 与现有视觉 Agent 的关系

DOM 自动化能立组与视觉能力组是平级能力，不是视觉能力的子模块。

视觉能力组负责：

- 截图
- 网格
- 视觉判断
- 坐标点击
- 视觉证据

DOM 自动化能立组负责：

- DOM 摘要读取
- 元素语义定位
- 结构化填表
- DOM 点击
- 文件上传
- DOM 状态验证

禁止把 DOM 自动化能力写入纯视觉 round 内部。  
禁止把 Amazon 上传流程写进视觉 Agent。  
禁止让 DOM 能力依赖视觉判断才能运行。

---

## 1. 总原则

### 1.1 插拔原则

DOM 自动化能力必须作为 GrassEye 的可插拔能力组存在。

允许：

```txt
插件任务 -> 调用 DOM 能力组 -> 调用 BrowserController -> 操作当前 Chrome
```

禁止：

```txt
Amazon 插件 -> 直接操作 Chrome 底层
Amazon 插件 -> 写一套自己的 DOM controller
视觉 Agent -> 内置 Amazon 上传逻辑
DOM 能力组 -> 内置 Amazon 页面流程
```

### 1.2 原子能力原则

DOM 能力必须保持原子化。

每个 atomic ability 只做一件事：

- 读 DOM 摘要
- 定位一个元素
- 填入一个已批准文本
- 点击一个已定位元素
- 上传一个已批准文件
- 验证一个状态

禁止一个 atomic ability 内部完成完整业务流程。  
禁止一个 ability 同时打开页面、搜索订单、上传文件、回写状态。

### 1.3 业务插件原则

具体业务流程必须由插件层编排。

例如 Amazon 发票上传应存在于：

```txt
src/plugins/amazon-invoice-upload/**
```

而不是：

```txt
src/capabilities/dom-automation/**
src/lib/browser/**
src/visual-mission/**
```

DOM 能力组不知道 Amazon 是什么。  
Amazon 插件知道自己要调用哪些 DOM 能力。
Product Video / Facebook 种草视频插件知道自己要采集什么、判断什么、保存到哪里；DOM 能力组只知道读、找、填、点、等、验、传。

### 1.4 当前 Chrome 原则

DOM 自动化默认复用当前本地 Chrome 会话。

允许：

- 操作当前操作者面前的 Chrome
- 在当前 Chrome 中打开新 tab
- 读取当前 active tab 的 DOM
- 在当前 tab 内执行受治理的 DOM 操作

禁止：

- 默认启动 headless 浏览器
- 默认打开远程浏览器
- 默认创建第二套浏览器自动化环境
- 绕过现有 `CurrentChromeBrowserController`

### 1.5 非视觉优先原则

DOM 自动化任务默认使用 DOM 结构判断，不使用视觉作为主裁。

允许视觉作为：

- 失败时的人工接管证据
- 页面异常时的辅助截图
- DOM 定位失败后的 review evidence

禁止视觉作为：

- DOM 页面正常可读时的主定位方式
- 搜索框、按钮、文件输入的第一定位方式
- Amazon 发票上传流程的默认主引擎

---

## 2. 法条

## [GRASSEYE-DOM-001-V1] DOM 能立组主权

```apex-law
{
  "lawId": "GRASSEYE-DOM-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "DOM automation must be a standalone pluggable capability group and must not be coupled to visual missions or business plugins."
}
```

### 法条

DOM 自动化必须作为独立能立组存在。

它只负责 DOM 层通用能力，不拥有任何业务流程。DOM owner root 必须收敛在 `src/capabilities/dom-automation/**`。

### Required

- 必须存在独立能力组目录：`src/capabilities/dom-automation/**`
- 必须存在独立 manifest / registry 接入
- 必须通过 GrassEye 现有 ability registry 暴露 atomic abilities
- 必须复用现有 BrowserController / CurrentChromeBrowserController
- 必须与视觉能力组平级
- DOM owner manifest 的 `ownedRoots` 只能包含 DOM 能力组根，不得包含业务插件根

### Forbidden

- DOM 能力写入 `visual-mission/**`
- DOM 能力写入 Amazon 插件内部作为私有实现
- Amazon 业务逻辑写入 DOM 能力组
- 新建第二套 browser controller
- 新建第二套 Agent runtime
- 把 `src/plugins/**` 业务插件列入 DOM owner roots 或 DOM required owner paths

---

## [GRASSEYE-DOM-002-V1] DOM Snapshot 只读摘要

```apex-law
{
  "lawId": "GRASSEYE-DOM-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "DOM snapshot must produce a governed structural summary, not leak full page secrets or raw browser storage."
}
```

### 法条

DOM 读取能力只能输出结构化摘要，不能默认输出完整 HTML、cookie、localStorage、token、隐藏字段密文或密码字段值。

### Required

DOM Snapshot 允许输出：

- 当前 URL
- 页面标题
- visible inputs 摘要
- visible buttons 摘要
- forms 摘要
- file input 摘要
- aria-label / role / placeholder / visible text
- selector candidates
- iframe / dialog / modal 摘要
- 是否存在登录、验证码、权限阻断提示

### Forbidden

DOM Snapshot 禁止输出：

- cookie
- localStorage / sessionStorage
- access token
- password value
- hidden input value
- 完整 HTML 原文
- 任意未裁剪的大段页面文本
- 未经过滤的用户隐私字段

---

## [GRASSEYE-DOM-003-V1] 元素定位必须语义优先

```apex-law
{
  "lawId": "GRASSEYE-DOM-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "DOM element location must be semantic-first and selector-stable, not brittle hardcoded CSS-only targeting."
}
```

### 法条

元素定位必须优先使用语义稳定信息，而不是脆弱 CSS 路径。

### 定位优先级

1. role / accessible name
2. aria-label / aria-labelledby
3. label-for 关系
4. placeholder
5. button visible text
6. input name / id
7. data-testid / data-automation-id
8. form association
9. selector candidate
10. CSS fallback

### Required

每次定位结果必须包含：

- `elementRef`
- `targetKind`
- `selector`
- `confidence`
- `reason`
- `matchedSignals`
- `fallbackUsed`

### Forbidden

- 只返回 `div:nth-child(4) > span > button`
- 只靠坐标定位
- 只靠视觉文字判断
- 未给置信度
- 未说明匹配理由
- 跨 iframe 未声明 frameRef

---

## [GRASSEYE-DOM-004-V1] DOM 输入必须使用批准文本

```apex-law
{
  "lawId": "GRASSEYE-DOM-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "DOM text input must only type approved task-provided text and must not let AI invent business values."
}
```

### 法条

DOM 输入能力只能输入任务 payload 中已经批准的文本。

例如：

- Amazon order id
- invoice number
- tracking number
- marketplace code
- search keyword

### Required

输入动作必须包含：

- `elementRef`
- `approvedTextRef` 或 `approvedText`
- `inputPurpose`
- `clearBeforeType`
- `verificationPolicy`

### Forbidden

- AI 自己生成订单号
- AI 自己生成发票号
- AI 自己输入密码
- 输入未列入任务 payload 的文本
- 把 clipboard / paste 当默认实现
- 在未定位元素时直接输入

---

## [GRASSEYE-DOM-005-V1] DOM 点击必须基于已定位元素

```apex-law
{
  "lawId": "GRASSEYE-DOM-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "DOM click must target a located DOM element, not arbitrary visual coordinates, unless the DOM path fails and review mode is entered."
}
```

### 法条

DOM 点击必须点击已定位元素。

### Required

点击动作必须包含：

- `elementRef`
- `expectedRole`
- `expectedText` 可选
- `preClickSnapshotRef`
- `postClickVerification`

### Forbidden

- 未定位元素直接点击
- 使用视觉坐标冒充 DOM 点击
- 点击 hidden / disabled 元素
- 点击多个匹配结果但不 disambiguate
- 关键动作无前后证据

---

## [GRASSEYE-DOM-006-V1] 文件上传必须使用批准文件

```apex-law
{
  "lawId": "GRASSEYE-DOM-006-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "File upload must only use approved task-provided files and must verify file type, existence, and upload target."
}
```

### 法条

文件上传能力只能上传任务中已批准的本地文件。

### Required

文件上传前必须验证：

- 文件存在
- 文件路径来自任务 payload 或本地批准清单
- 文件类型符合允许列表
- Amazon 发票上传第一阶段只允许 PDF
- 目标元素是 file input 或合法上传入口
- 上传前后必须保存 evidence

### Forbidden

- AI 自己选择文件
- 上传任意路径文件
- 上传非批准扩展名
- 上传目录
- 读取文件内容作为 AI 输入
- 把文件上传逻辑写死在 Amazon 插件之外

---

## [GRASSEYE-DOM-007-V1] DOM 状态验证必须证据化

```apex-law
{
  "lawId": "GRASSEYE-DOM-007-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "DOM state verification must produce evidence-backed success, failure, or review-required results."
}
```

### 法条

DOM 状态验证不能只靠“没有报错”。必须输出证据化结果。

### Required

验证结果必须归类为：

- `success`
- `failed`
- `not_found`
- `ambiguous`
- `login_required`
- `captcha_or_2fa_required`
- `review_required`

### Forbidden

- 上传后直接默认成功
- 页面没变也判成功
- 找不到元素却继续下一步
- 出现登录 / 验证码 / 权限错误仍继续自动动作
- 不截图、不记录 DOM 摘要

---

## [GRASSEYE-DOM-008-V1] 业务插件不得污染 DOM 能立组

```apex-law
{
  "lawId": "GRASSEYE-DOM-008-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Business plugins must call DOM abilities but must not add platform-specific branching into the DOM capability group."
}
```

### 法条

Amazon 发票上传、ZATCA 上传、FTA 下载、银行后台下载等都必须作为插件存在。

DOM 能立组只能提供通用能力。DOM 质检可以检查插件是否只通过 DOM public facade 调用能力，但这种检查属于 consumer boundary check，不等于插件归属 DOM owner。

### Required

插件允许：

- 声明平台入口
- 声明页面目标
- 声明字段 hint
- 声明成功状态
- 编排能力调用顺序

插件禁止：

- 修改 BrowserController
- 私有实现 DOM Snapshot
- 私有实现文件上传
- 私有实现元素定位器
- 把 Amazon 选择器写入通用 DOM 能力组
- 作为 DOM 子能力、DOM owner root、DOM registry truth 或 DOM required owner path

---

## [GRASSEYE-DOM-009-V1] 人工接管边界

```apex-law
{
  "lawId": "GRASSEYE-DOM-009-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "DOM automation must stop into review-required mode when login, captcha, ambiguity, or sensitive confirmation is encountered."
}
```

### 法条

DOM 自动化遇到登录、验证码、二次验证、页面歧义、危险提交、无法确认上传状态时必须进入人工接管。

### Required

必须进入人工接管的场景：

- 未登录
- 2FA
- CAPTCHA
- 多个订单匹配
- 多个上传入口匹配
- 文件 input 不存在
- 上传成功状态无法确认
- 页面语言/站点不匹配
- 出现付款、退款、删除、取消订单等敏感动作

### Forbidden

- 绕过登录
- 绕过验证码
- 自动输入密码
- 自动确认无法回滚的危险动作
- 在不确定页面状态下继续操作

---

## [GRASSEYE-DOM-010-V1] 证据与日志归属

```apex-law
{
  "lawId": "GRASSEYE-DOM-010-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "dom-automation",
  "enforcementMode": "auto",
  "evidenceMode": "hybrid",
  "summary": "Every DOM automation step must produce structured logs and evidence refs without leaking sensitive page data."
}
```

### 法条

DOM 自动化每一步都必须产生结构化日志与 evidence ref。

### Required

每步记录：

- stepId
- abilityId
- targetUrl host
- targetKind
- locator summary
- action result
- evidence ref
- timestamp
- reviewRequiredReason 可选

### Forbidden

- 日志记录 cookie/token/password
- 日志记录完整 HTML
- 日志记录 PDF 全文
- 只输出 console.log
- 失败不记录原因
- 成功不记录证据

---

## 3. 推荐新增 Atomic Abilities

### 3.1 DOM 读取

```txt
READ_DOM_SNAPSHOT_ONCE
```

### 3.2 DOM 定位

```txt
LOCATE_DOM_ELEMENT_ONCE
```

### 3.3 DOM 输入

```txt
FILL_DOM_ELEMENT_ONCE
```

### 3.4 DOM 点击

```txt
CLICK_DOM_ELEMENT_ONCE
```

### 3.5 文件上传

```txt
UPLOAD_APPROVED_FILE_ONCE
```

### 3.6 状态验证

```txt
VERIFY_DOM_STATE_ONCE
```

### 3.7 DOM 等待

```txt
WAIT_FOR_DOM_STATE_ONCE
```

---

## 4. Amazon 发票上传插件边界

Amazon 发票上传不是 DOM 能力组的一部分。

建议插件路径：

```txt
src/plugins/amazon-invoice-upload/**
```

插件只允许调用：

- open platform entry
- read DOM snapshot
- locate DOM element
- fill DOM element
- click DOM element
- upload approved file
- verify DOM state
- save evidence
- stop review required

插件不得自建底层能力。

---

## 5. 验收线

### 5.1 结构验收

- 存在 `src/capabilities/dom-automation/**`
- 存在 DOM 能力 schema
- 存在 DOM ability catalog entries
- 存在 DOM executor / dispatcher 接入
- Amazon 插件不在 DOM 能力组目录内

### 5.2 行为验收

- 可读取当前页面 DOM 摘要
- 可定位普通搜索框
- 可输入 approvedText
- 可点击已定位按钮
- 可识别登录/验证码状态
- 可进入 review_required
- 可保存 evidence

### 5.3 禁止验收

- 无视觉耦合
- 无 Amazon 硬编码进入核心 DOM 能力组
- 无第二套 BrowserController
- 无任意文件上传
- 无密码自动输入
- 无完整 HTML 日志泄露

---

## 6. 关闭语

DOM 自动化能立组的使命不是完成 Amazon 上传，而是补齐 GrassEye 对普通网页后台的结构化操作能力。

Amazon 发票上传只是第一个插件场景。

最终目标：

```txt
GrassEye = 当前 Chrome 操作总 Agent
视觉能力 = 看得见
DOM 能力 = 读得懂
输入点击能力 = 做得到
插件任务 = 业务可插拔
```
