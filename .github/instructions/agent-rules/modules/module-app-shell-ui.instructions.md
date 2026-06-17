# GrassEye APP-UI 专属法案：Mac-Style Agent Workbench Shell

> 建议路径：`.github/instructions/agent-rules/modules/module-app-shell-ui.instructions.md`  
> status: active  
> tier: P0  
> owner: app-shell-ui  
> purpose: 将当前 Workbench UI 治理为未来可迁移 Mac App 的 Agent 工作台外壳。  
>
> 本法案只治理 UI 架构、页面层级、组件边界、Skill Registry、App Shell、Inspector、Runtime Console。  
> 本法案不定义任何业务技能的内部流程，不参与 Amazon 产品挖掘、AI 研判、采购、利润、供应链等业务判断。

---

## [GRASSEYE-APP-SHELL-UI-001-V1] Mac-Style Agent Workbench Shell

```apex-law
{
  "lawId": "GRASSEYE-APP-SHELL-UI-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "app-shell-ui",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ts-morph+acceptance+visual",
  "summary": "GrassEye Workbench UI must be a unified Mac-style Agent Workbench Shell with Skill Registry, Level 2 Skill Workspace, Level 3 Inspector, and independent Runtime Console; old one-page dashboard production entry is forbidden.",
  "appliesTo": [
    "src/app/**",
    "scripts/audit/domains/app-shell-ui/**",
    "scripts/acceptance/app-shell-*.acceptance.ts",
    "scripts/acceptance/amazon-product-mining-app-shell.acceptance.ts"
  ],
  "forbidden": [
    "Legacy one-page home UI remaining as production entry.",
    "Second App Shell or hidden parallel UI shell.",
    "Skill list hardcoded outside Skill Registry.",
    "Amazon Product Mining details expanded inside an ultra-wide history table instead of Inspector.",
    "Runtime Console replaced by business history table.",
    "UI using localStorage, fixture rows, package scanning, or log parsing as production truth.",
    "UI computing AI verdict or product opportunity score.",
    "UI exposing commerce, supplier-ordering, listing-launch, campaign-launch, inventory, winner-selection, or margin adjudication actions."
  ]
}
```

## [GRASSEYE-APP-SHELL-UI-002-V1] App Shell Localization

```apex-law
{
  "lawId": "GRASSEYE-APP-SHELL-UI-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "app-shell-ui",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "locale-runtime+acceptance+visual",
  "summary": "GrassEye App Shell must provide one in-place Chinese/English localization chain, default to Chinese, expose a fast language switch, and block untranslated static App Shell copy.",
  "appliesTo": [
    "src/app/**",
    "scripts/audit/domains/app-shell-ui/**",
    "scripts/acceptance/app-shell-*.acceptance.ts"
  ],
  "forbidden": [
    "Second localized page tree.",
    "Separate zh/en route implementation.",
    "English default App Shell.",
    "Static App Shell copy without a Chinese translation entry.",
    "Language switch requiring server restart."
  ]
}
```

Required:

- Supported App Shell locales are exactly `zh` and `en`.
- Default App Shell locale is `zh`.
- The shell must expose a visible language switch for Chinese and English.
- Switching language must happen in the same App Shell DOM without creating a second page or second route tree.
- Static visible App Shell copy, placeholders, titles, and aria labels must have Chinese entries in the App Shell localization dictionary.
- Runtime-inserted App Shell text must pass through the same localization runtime or be covered by the same text translation observer.

Forbidden:

- `/zh` and `/en` cloned Workbench pages.
- Duplicated skill workspaces for localization.
- English-only App Shell surfaces.
- LocalStorage as localization truth.
- Treating missing translations as warnings.

## 0. 最高原则

GrassEye 不是网页后台。

GrassEye 是：

```txt
本地 Agent 工作台
+
多技能操作系统
+
未来 Mac App 包装层
+
本地自动启动、自动运行、自动监控、证据查看、AI 交接的统一桌面应用
```

因此 UI 必须按照成熟桌面 App 的结构建设。

禁止继续把所有技能、表单、历史、日志、详情、证据堆在一个一眼到底的页面里。

---

## 1. 二元裁决

系统只能是：

```txt
Mac-style Agent Workbench Shell
或
不合格网页后台
```

如果 UI 不能承载 20 个技能，FAIL。  
如果 UI 不能支持二级、三级页面，FAIL。  
如果 UI 不能自然迁移到 Mac App / SwiftUI 信息结构，FAIL。  
如果 UI 让人一眼看不懂当前技能、当前任务、当前结果、当前异常，FAIL。

---

## 2. APP-SHELL-001：统一 App Shell

GrassEye 必须拥有统一 App Shell。

App Shell 必须包含：

```txt
Top Command Bar
Left Sidebar
Main Workspace
Right Inspector
Bottom Runtime Console
Status / Activity Surface
```

职责：

```txt
Top Command Bar = 全局标题、运行状态、全局命令、设置入口
Left Sidebar = 技能导航 / Skill Registry / 分组导航
Main Workspace = 当前技能二级页面主工作区
Right Inspector = 当前选中任务、关键词、资料包、证据、异常详情
Bottom Runtime Console = 日志、运行事件、错误、后台状态
```

禁止：

```txt
所有信息只堆在 Main Workspace
把日志混进业务表格
把详情混进历史表格
把技能导航写死在单页按钮堆里
把任务发布区做成全页面中心
```

---

## 3. APP-SHELL-002：20 技能承载

GrassEye UI 必须能承载至少 20 个技能。

所有技能必须通过 Skill Registry 注册：

```txt
skillId
skillName
skillCategory
skillIcon
skillRoute
skillStatus
primaryActions
secondaryPages
allowedSurfaces
forbiddenSurfaces
```

禁止：

```txt
每新增一个技能就手写一堆首页区块
所有技能共享一个巨大 if/else 页面
技能页面不通过 registry 导航
技能页面自行创造第二套 App Shell
```

---

## 4. APP-SHELL-003：二级 / 三级页面

页面层级固定为：

```txt
Level 1: App Shell / 总工作台
Level 2: Skill Workspace / 单个技能工作区
Level 3: Task / Keyword / Evidence / Package Detail
```

复杂技能必须支持二级页面。  
涉及任务、历史、资料包、证据、AI 研判、异常的技能必须支持三级详情页或 Inspector detail surface。

禁止：

```txt
一个技能所有内容一页到底
一个任务所有详情横向塞进表格
一个关键词所有证据塞进一行
一个资料包只给下载链接没有详情入口
```

---

## 5. APP-SHELL-004：Mac App / SwiftUI 同构

当前 Web UI 必须按照未来 Mac App / SwiftUI 可迁移结构设计。

Web UI 的信息架构必须能自然对应：

```txt
NavigationSplitView
Sidebar
ContentView
InspectorPanel
Toolbar
Sheet
Popover
StatusBar
DetailView
TaskDetailView
RuntimeConsole
```

禁止：

```txt
长页面堆叠
无限横向大表
滚动到底找功能
DOM hack 驱动主导航
CSS 堆视觉但没有页面架构
```

---

## 6. APP-SHELL-005：Skill Workspace 标准结构

每个技能二级页面必须按统一结构组织：

```txt
Skill Header
Task Publish / Create Area
Current Run / Runtime State
History / Result Table
Evidence / Package / Output Area
Exception / Manual Required Area
Inspector Detail
```

原则：

```txt
Task Publish Area = 发布任务入口，不得喧宾夺主
History / Result Table = 用户日常判断核心
Inspector Detail = 详情承载区
Runtime State = 当前运行反馈
Exception Area = 失败、人工处理、平台限制
```

---

## 7. APP-SHELL-006：Amazon Product Mining UI 专项

Amazon 产品挖掘页面必须以关键词研判历史为核心。

页面必须包含：

```txt
Amazon Product Mining Header
Task Publish Area
Latest Task Summary
Keyword Opportunity Review History
Keyword Review Filters
Keyword Review Table
Keyword / Task / Package Inspector
Runtime Console
```

禁止：

```txt
只显示 taskId/status/package
不显示 keyword verdict
不支持筛选
没有 Inspector 详情
把所有字段塞成超宽表
出现采购、打样、压货、广告、最终选择按钮
```

---

## 8. APP-SHELL-007：历史表与 Inspector 分层

任何复杂历史表不得承载全部详情。

历史表只显示核心判断字段：

```txt
Created At
Skill
Task ID
Keyword / Target
Decision / Status
Human Next Step
Confidence / Completeness
Product Count / Evidence Count
Package
AI Review
```

Inspector 显示：

```txt
完整 AI 研判
Evidence refs
Missing evidence
Risk points
Package refs
Master report refs
Exception refs
Raw response refs
Runtime logs
```

禁止：

```txt
横向大表无限滚动
用户必须打开 JSON 才知道发生了什么
用户必须看日志才知道结果
```

---

## 9. APP-SHELL-008：UI 只展示，不裁决

UI 允许：

```txt
显示 AI verdict
显示人类下一步建议标签
打开资料包
打开 AI 研判
筛选历史记录
导出表格
显示异常
```

UI 禁止：

```txt
计算 PASS/WATCH/REJECT
计算产品机会分
做采购判断
做利润判断
做广告预算判断
做最终产品选择
根据 AI verdict 自动进入采购/打样/上架
```

所有 verdict 必须来自后端持久化记录，不得由前端临时计算。

---

## 10. APP-SHELL-009：数据真相源

UI 不得使用假数据作为生产真相源。

禁止：

```txt
localStorage 作为历史真相源
前端硬编码历史记录
fixture 常驻生产页面
从 package 文件临时扫描生成历史表
从日志里解析业务结果
```

允许：

```txt
empty state
loading state
error state
fixture 仅用于 acceptance / test
真实页面只读后端持久化记录
```

---

## 11. APP-SHELL-010：页面状态

每个主要 UI 区域必须具备：

```txt
Empty State
Loading State
Error State
Success State
Manual Required State
Failed State
```

禁止：

```txt
空白页面
失败显示为空
加载失败继续显示旧数据
异常只进日志不进 UI
```

---

## 12. APP-SHELL-011：运行控制边界

未来本地自动启动、本地程序控制、本地 Chrome 控制、任务队列，必须进入统一 Runtime Control Surface。

禁止技能页面自行实现：

```txt
独立启动器
独立 daemon 控制
独立浏览器控制按钮
独立日志系统
独立任务队列
```

所有运行控制必须进入：

```txt
Runtime Control
Runtime Console
Runtime Event Ledger
```

---

## 13. APP-SHELL-012：禁止第二 UI 链路

不得存在第二套 UI 外壳。

禁止：

```txt
Legacy Home UI
New App UI
Admin UI
Strict UI
Debug UI
Skill 自带 Shell
隐藏路由承载同一功能
同一技能存在两套生产页面
```

如果重构，旧 UI 必须删除或物理不可达，不得保留生产入口。

---

## 14. APP-SHELL-013：统一样式系统

必须统一：

```txt
spacing
typography
panel
table
badge
button
inspector
console
empty/error/loading/manual_required state
```

状态色必须使用语义 class：

```txt
status-pass
status-watch
status-reject
status-insufficient
status-failed
status-manual-required
status-running
```

禁止：

```txt
每个技能自己写一套按钮
每个技能自己写一套 badge
每个技能自己写一套 table
到处 inline style
业务组件直接硬编码颜色含义
```

---

## 15. APP-SHELL-014：桌面优先

GrassEye 当前以桌面 / Mac App 为主目标。

要求：

```txt
Desktop-first
Resizable panels
Collapsible sidebar
Collapsible inspector
Scrollable table body
Sticky headers where necessary
```

禁止为了手机端牺牲桌面工作效率。

---

## 16. APP-SHELL-015：可执法 UI

必须建设：

```txt
scripts/audit/domains/app-shell-ui/**
scripts/acceptance/app-shell-ui.acceptance.ts
scripts/acceptance/amazon-product-mining-app-shell.acceptance.ts
```

执法脚本必须：

```txt
ts-morph AST 级
symbol 级
反逃逸级
全面禁止正则
```

禁止：

```txt
正则扫描
grep
raw string scanning 伪装执法
只靠截图人工验收
```

---

## 17. APP-SHELL-016：全局禁止操作

除非未来对应法案明确授权，全局 UI 禁止出现：

```txt
Buy
Purchase
Sample Now
Procure
Place Order
Launch Listing
Run Ads
Create Shipment
Allocate Inventory
Final Pick
Select Winner
Profit Decision
Auto Sell
Auto Purchase
```

挖掘类技能尤其禁止这些按钮。

---

## 18. APP-SHELL-017：Skill Registry

所有技能必须通过 Skill Registry 描述。

Skill Registry 至少包含：

```txt
id
label
category
description
route
status
primarySurface
historySurface
detailSurface
allowedActions
forbiddenActions
```

禁止：

```txt
技能列表写死在多个文件
按钮和路由各维护一份
App sidebar 与 route 不一致
Skill 页面未注册却可访问
```

---

## 19. APP-SHELL-018：复杂对象详情承载

复杂对象必须有详情承载面：

```txt
task
keyword review
product evidence
package
exception
runtime event
AI handoff
```

每个复杂对象至少支持一种：

```txt
Right Inspector detail
或
Level-3 detail page
```

禁止只能通过下载 JSON 或看日志查看详情。

---

## 20. APP-SHELL-019：最终验收

全部满足才 PASS：

```txt
统一 App Shell 存在
Left Sidebar 存在
Main Workspace 存在
Right Inspector 存在
Bottom Runtime Console 存在
Skill Registry 存在
二级 Skill Workspace 存在
三级 Detail / Inspector 机制存在
Amazon Product Mining 不再一页到底
任务发布区不喧宾夺主
关键词研判历史表为核心区域
详情进入 Inspector
UI 不做业务裁决
UI 不使用假数据
UI 不使用 localStorage 作为真相源

---

## [GRASSEYE-APP-SHELL-UI-PHYSICAL-CLEANUP-001-V1] Legacy APP User-Demand Authority Physical Absence

```apex-law
{
  "lawId": "GRASSEYE-APP-SHELL-UI-PHYSICAL-CLEANUP-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "app-shell-ui",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast+acceptance+chrome",
  "summary": "After App Shell becomes the production UI entry, the orphan legacy APP user-demand startup blueprint must be physically absent. Retired, archived, deprecated, or copied variants of that legacy authority are forbidden.",
  "appliesTo": [
    ".github/instructions/agent-rules/modules/module-app-shell-ui.instructions.md",
    "docs/法案辅助文件/GrassEye App Shell UI 施工图.md",
    "docs/法案辅助文件/**/*.md",
    "src/app/**/*.{ts,tsx,js,jsx,mjs}",
    "scripts/audit/domains/app-shell-ui/**",
    "scripts/acceptance/app-shell-*.acceptance.ts",
    "scripts/acceptance/amazon-product-mining-app-shell.acceptance.ts",
    "package.json"
  ],
  "forbidden": [
    "Legacy APP user-demand startup blueprint exists after App Shell production entry.",
    "Retired, archived, deprecated, hidden, or copied variants of the legacy APP user-demand startup blueprint remain in the repository.",
    "App source, package scripts, migration docs, or non-governance docs still reference the deleted legacy APP user-demand startup blueprint."
  ]
}
```

当 `src/app/workbench-home-page.ts` 的生产入口已经固定为 `renderAppShell()` 后，
以下旧主权文件必须物理缺席：

```txt
docs/法案辅助文件/GrassEye APP 用户需求启动施工图.md
```

禁止：

```txt
retired 保留
archive 保留
deprecated 保留
legacy 改名保留
.bak / .old / 历史副本保留
MIGRATION / package / source 持续引用旧路径
```
UI 不出现采购/打样/压货/广告/最终选择按钮
旧 UI 无生产入口
Inspector 覆盖
Acceptance 覆盖
ci:full PASS
```

任意一项不满足，FAIL。

---

## 21. 最终提醒

```txt
GrassEye 不是网页后台。
GrassEye 是未来 Mac Agent App。

UI 不是皮肤。
UI 是 Agent 操作系统的外壳。

一页到底，失败。
技能堆叠，失败。
表格塞爆，失败。
没有 Inspector，失败。
不能承载 20 个技能，失败。
不能迁移到 Mac App 信息结构，失败。
```
