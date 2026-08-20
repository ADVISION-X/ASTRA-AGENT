# GrassEye APP-UI 施工图：Mac-Style App Shell 与多级页面架构

> 建议路径：`docs/法案辅助文件/GrassEye App Shell UI 施工图.md`  
> status: frozen-design-candidate  
> owner: app-shell-ui  
> 对应法案：`module-app-shell-ui.instructions.md`  
>
> 本施工图定义 GrassEye 从当前 Web Workbench 升级为未来 Mac Agent App 的页面架构。  
> 本施工图只处理 UI 架构、页面层级、组件边界、路由结构、验收标准，不改变任何业务技能主流程。

---

## 0. 设计目标

GrassEye 最终会承载约 20 个日常工作技能，并被打包成可在其他电脑上使用的本地 App。

因此当前 UI 必须从：

```txt
单页网页后台
```

升级为：

```txt
Mac-style Agent Workbench Shell
```

目标：

```txt
能承载 20 个技能
能分层展示复杂任务
能快速查看历史结果
能打开证据和资料包
能显示运行状态和异常
能未来迁移到 SwiftUI / Mac App
```

---

## 1. 总体信息架构

三层页面模型：

```txt
Level 1: App Shell / 总工作台
Level 2: Skill Workspace / 单个技能工作区
Level 3: Detail Surface / 任务、关键词、资料包、证据、异常详情
```

示例：

```txt
GrassEye Workbench
└── Amazon Product Mining
    ├── Publish Task
    ├── Keyword Opportunity Review History
    ├── Task Runtime
    └── Keyword Review Detail / Package Detail / Evidence Detail
```

---

## 2. App Shell 总布局

桌面主布局：

```txt
┌──────────────────────────────────────────────────────────────┐
│ Top Command Bar                                               │
├───────────────┬─────────────────────────────┬────────────────┤
│ Left Sidebar  │ Main Workspace              │ Right Inspector│
│ Skill Nav     │ Skill Workspace             │ Detail Panel   │
├───────────────┴─────────────────────────────┴────────────────┤
│ Bottom Runtime Console                                        │
└──────────────────────────────────────────────────────────────┘
```

区域职责：

```txt
Top Command Bar:
  App 名称、当前状态、全局设置、运行控制、连接状态

Left Sidebar:
  技能导航、技能分组、运行中标识、异常标识

Main Workspace:
  当前技能二级页面，包括任务发布、历史表、当前任务状态

Right Inspector:
  当前选中的 task / keyword / package / evidence / exception 详情

Bottom Runtime Console:
  运行日志、事件流、错误、manual_required、后台状态
```

---

## 3. SwiftUI 同构映射

```txt
Web App Shell              -> SwiftUI App
Top Command Bar            -> Toolbar / Window Toolbar
Left Sidebar               -> NavigationSplitView Sidebar
Main Workspace             -> Content View
Right Inspector            -> Inspector / Detail Column
Bottom Runtime Console     -> Bottom Panel / Console View
Skill Registry             -> Navigation Model
Skill Workspace            -> Skill Content View
Task Detail                -> Detail View
Modal / Sheet              -> Sheet / Popover
Status Badge               -> Label / Badge View
```

禁止 Web-only 结构：

```txt
长页面堆叠
无限横向大表
DOM 选择器驱动主交互
滚动到底找按钮
状态靠 CSS hack
```

---

## 4. 推荐目录结构

建议逐步拆分当前大页面：

```txt
src/app/
  app-shell/
    app-shell.ts
    app-shell-layout.ts
    app-shell-styles.ts
    skill-registry.ts
    command-bar.ts
    sidebar.ts
    inspector.ts
    runtime-console.ts

  skills/
    amazon-product-mining/
      amazon-product-mining-workspace.ts
      amazon-product-mining-task-publish.ts
      amazon-product-mining-keyword-history.ts
      amazon-product-mining-inspector.ts
      amazon-product-mining-routes.ts

  workbench-home-page.ts
  workbench-home-client.ts
  workbench-home-styles.ts
```

如果当前仓库尚未支持目录拆分，可分阶段迁移，但最终不得继续把所有技能塞进 `workbench-home-page.ts` 单文件。

---

## 5. Skill Registry 设计

新增统一技能注册表：

```ts
type SkillRegistryItem = {
  id: string;
  label: string;
  category: "product-mining" | "research" | "finance" | "content" | "system";
  description: string;
  route: string;
  status: "active" | "disabled" | "planned";
  primarySurface: string;
  historySurface?: string;
  detailSurface?: string;
  allowedActions: string[];
  forbiddenActions: string[];
};
```

示例技能：

```txt
amazon-product-mining
invoice-manager
tax-document-assistant
```

Left Sidebar 必须从 Skill Registry 渲染。

---

## 6. 一级页面：App Shell

一级页面只负责：

```txt
加载 Skill Registry
渲染 App Shell
管理当前选中 skillId
管理全局运行状态
管理 Inspector selection
管理 Runtime Console events
```

一级页面不得：

```txt
直接写 Amazon 产品挖掘业务逻辑
直接计算 AI verdict
直接处理资料包
直接解析评论
直接控制某个技能内部状态机
```

---

## 7. 二级页面：Skill Workspace 标准

每个技能工作区统一结构：

```txt
Skill Header
Task Publish Area
Current Run Summary
Primary History / Result Table
Evidence / Output Shortcuts
Exception Summary
```

Amazon Product Mining Workspace：

```txt
Amazon Product Mining
├── Header
├── Publish Task
├── Latest Run Summary
├── Keyword Opportunity Review History
└── Empty / Loading / Error / Manual Required States
```

---

## 8. 三级页面 / Inspector 标准

复杂对象：

```txt
Task Detail
Keyword Review Detail
Package Detail
Evidence Detail
Exception Detail
Runtime Event Detail
```

## 8.5 App Shell 本地化

本地化采用一条 App Shell 主链：

```txt
src/app/app-shell/localization.ts
  -> supportedAppShellLocales = ["zh", "en"]
  -> defaultAppShellLocale = "zh"
  -> appShellZhCopy
  -> renderLocaleToggle()
  -> renderAppShellLocalizationClient()
  -> same DOM language switch
```

要求：

```txt
默认中文
支持 English
命令栏可快速切换中文 / English
不新增 /zh 或 /en 页面树
不复制 Skill Workspace
不使用 localStorage 作为语言真相
静态 visible text / placeholder / aria-label / title 必须有中文字典项
动态插入的 App Shell 文本必须被同一 localization runtime 翻译
```

参考实现来源：

```txt
/Users/nexgen/Documents/ON-THE-WAY/src/lib/admin-localization/admin-locale-runtime.ts
/Users/nexgen/Documents/ON-THE-WAY/src/features/amazon-manage/admin-copy/amzmgr-admin-locale-context.tsx
```

GrassEye 是本地无 React workbench，因此不复制 React context；只复用其原则：

```txt
canonical supported locales
default locale
cookie/search-param resolver
owner-local copy source
same-surface href/runtime shaping
```

Inspector 通用结构：

```txt
Title
Status
Summary
Evidence refs
Raw refs
Package refs
Exception refs
Actions
Timeline
```

Amazon Product Mining 的 Keyword Review Inspector：

```txt
Keyword
Decision
Human Next Step
Demand Signal
Review Health
Price Ceiling
Competition Openness
Improvement Opportunity
Data Confidence
AI Reason
Evidence refs
Missing evidence
Risk points
Package link
Master Report link
AI raw response link
```

---

## 9. Amazon Product Mining 页面施工图

### 9.1 页面结构

```txt
Amazon Product Mining Workspace
├── Skill Header
├── Publish Task Card
├── Latest Task Summary Card
├── Keyword Opportunity Review History
│   ├── Filters
│   ├── Table
│   └── Pagination / Summary
└── Inspector Detail
```

### 9.2 Publish Task Card

字段：

```txt
Marketplace
Target Market
Product Direction
Requested Keyword Count
Provider Kind
Language Preference
```

按钮：

```txt
Start Mining
Refresh Latest
```

禁止：

```txt
Buy
Sample
Purchase
Launch Listing
Run Ads
Final Pick
```

### 9.3 Latest Task Summary

显示：

```txt
Task ID
Status
Marketplace
Target Market
Keyword Count
Package Ref
Master Report Ref
Created At
Updated At
Manual Required Count
Failed Count
```

### 9.4 Keyword Opportunity Review History

核心字段：

```txt
Created At
Keyword
Decision
Human Next Step
Demand Signal
Review Health
Price Ceiling
Competition Openness
Improvement Opportunity
Data Confidence
Product Count
Review Count
Package Integrity
Data Completeness
Status
```

操作：

```txt
Open Package
Open Master Report
Open AI Review
Open Evidence
Select Row -> Inspector
```

### 9.5 Filters

P0 筛选：

```txt
Decision
Keyword search
Marketplace
```

P1 筛选：

```txt
Human Next Step
Data Confidence
Target Market
Package Integrity
Date Range
```

默认排序：

```txt
Created At desc
```

Decision priority：

```txt
PASS
WATCH
INSUFFICIENT_DATA
REJECT
```

---

## 10. UI 视觉原则

目标风格：

```txt
Mac-style
desktop-first
clean panels
clear hierarchy
high information density but not crowded
```

原则：

```txt
任务发布区小而清晰
历史表是主角
详情进入 Inspector
日志进入 Runtime Console
异常必须显式
筛选器靠近历史表
操作按钮不干扰判断
```

禁止：

```txt
大面积表单占据主页面
一张大宽表塞所有字段
日志堆在业务表下面
所有东西同一视觉层级
按钮太多导致人不知道点哪里
```

---

## 11. 样式系统

统一组件语义：

```txt
app-shell
command-bar
sidebar
workspace
inspector
runtime-console
panel
card
history-table
filter-bar
status-badge
decision-badge
detail-section
empty-state
loading-state
error-state
manual-required-state
```

状态 badge：

```txt
status-pass
status-watch
status-reject
status-insufficient
status-running
status-completed
status-completed-with-errors
status-manual-required
status-failed
```

禁止在组件里直接写颜色含义。  
必须通过语义 class 交给样式系统。

---

## 12. 路由 / Surface 设计

最低路由：

```txt
/workbench
/workbench/skills/:skillId
/workbench/skills/amazon-product-mining
/workbench/skills/amazon-product-mining/tasks/:taskId
/workbench/skills/amazon-product-mining/keyword-reviews/:reviewId
```

如果当前项目暂不使用真实 URL 路由，也必须在内部 state model 中模拟：

```txt
selectedSkillId
selectedTaskId
selectedReviewId
selectedInspectorType
selectedInspectorId
```

不得把所有状态隐藏在 DOM 展开/收起里。

---

## 13. 数据读取原则

UI 数据来源：

```txt
后端持久化 records
runtime handle
structured route response
```

禁止：

```txt
localStorage 作为生产真相源
前端硬编码历史数据
生产页面读取 fixture
前端解析 package 文件临时构造历史表
前端解析日志生成业务结论
```

---

## 14. Empty / Loading / Error / Manual Required

每个主区域都必须有状态：

```txt
empty
loading
error
ready
manual_required
failed
```

示例：

```txt
Keyword Opportunity Review History
- empty: No keyword reviews yet.
- loading: Loading keyword reviews...
- error: Failed to load keyword reviews.
- manual_required: AI review requires manual ingestion.
```

---

## 15. Runtime Console

Bottom Runtime Console 显示：

```txt
runtime events
task started
task completed
keyword completed
manual_required
package generated
AI handoff prepared
error events
```

Console 不得替代业务表格。  
业务结果必须进入 History / Inspector。

---

## 16. App Shell 与业务边界

UI 允许：

```txt
请求创建任务
请求刷新状态
读取历史记录
打开资料包
复制 ID
导出表格
```

UI 禁止：

```txt
前端生成 verdict
前端修复数据
前端跳过状态
前端改 package integrity
前端把 failed 改 completed
```

---

## 17. 迁移方案

### Phase 1：建立 App Shell 骨架

```txt
新增 Skill Registry
拆出 Command Bar / Sidebar / Workspace / Inspector / Runtime Console
保留现有业务功能
不改变后端
```

### Phase 2：Amazon Product Mining 二级页面重排

```txt
任务发布卡片缩小
历史表成为主区域
详情进入 Inspector
移除超宽一页到底布局
```

### Phase 3：三级详情

```txt
Task Detail
Keyword Review Detail
Package Detail
Evidence Detail
Exception Detail
```

### Phase 4：多技能接入

```txt
Invoice / Tax / Finance Skills
```

### Phase 5：Mac App 包装准备

```txt
稳定 Shell 数据契约
稳定 Skill Registry
稳定 Runtime Control Surface
准备 SwiftUI 同构迁移
```

---

## 18. 执法系统建设

新增或强化：

```txt
scripts/audit/domains/app-shell-ui/inspector.ts
scripts/audit/domains/app-shell-ui/inspector-skill-registry.ts
scripts/audit/domains/app-shell-ui/inspector-layout.ts
scripts/audit/domains/app-shell-ui/inspector-forbidden-actions.ts
```

检查项：

```txt
App Shell 存在
Sidebar 存在
Main Workspace 存在
Inspector 存在
Runtime Console 存在
Skill Registry 存在
Amazon Product Mining 作为 skill 注册
Keyword History 为主区域
详情进入 Inspector
禁止采购/打样/压货/广告/最终选择按钮
禁止 localStorage 真相源
禁止前端计算 AI verdict
```

质检脚本必须：

```txt
ts-morph AST 级
symbol 级
反逃逸级
无正则
```

---

## 19. Acceptance 建设

新增：

```txt
scripts/acceptance/app-shell-ui.acceptance.ts
scripts/acceptance/app-shell-skill-registry.acceptance.ts
scripts/acceptance/amazon-product-mining-app-shell.acceptance.ts
```

验收：

```txt
1. App Shell 渲染五大区域。
2. Sidebar 从 Skill Registry 渲染技能。
3. Amazon Product Mining 能作为二级 Workspace 打开。
4. Publish Task Area 存在但不是页面唯一核心。
5. Keyword History 存在。
6. Row selection 打开 Inspector。
7. Empty/loading/error/manual_required state 存在。
8. 禁止按钮不存在。
9. localStorage 不作为生产真相源。
10. 前端不计算 verdict。
11. 详情不塞进超宽表。
12. Runtime Console 独立存在。
```

---

## 20. CI 要求

必须走：

```bash
npm run ci:full
```

Fail-fast：

```txt
只看 firstFailure
鉴权：偏离法案？偏离施工图？
修根因 + 辅助根因
再次 ci:full
直到全绿
```

不得只跑局部 UI 测试后宣布完成。

---

## 21. 最终验收标准

全部满足才 PASS：

```txt
App Shell 五区存在
Skill Registry 存在
二级 Skill Workspace 存在
三级 Detail / Inspector 存在
Amazon Product Mining 页面重排
任务发布区不喧宾夺主
Keyword History 是主区域
右侧 Inspector 显示详情
Bottom Runtime Console 独立
UI 不承载业务裁决
无采购/打样/压货/广告/最终选择按钮
无 localStorage 真相源
无硬编码假数据
无第二 UI 链路
旧 Home UI 无生产入口
Inspector 覆盖
Acceptance 覆盖
ci:full PASS
```

---

## 23. Legacy APP User-Demand Authority Physical Absence

当前生产 UI 主权只属于：

- `module-app-shell-ui.instructions.md`
- `GrassEye App Shell UI 施工图.md`

当首页生产入口已经是 `workbench-home-page.ts -> renderAppShell()` 时，
旧 APP user-demand authority 文件必须物理缺席：

- `docs/法案辅助文件/GrassEye APP 用户需求启动施工图.md`

禁止：

- `retired` / `archive` / `legacy` / `deprecated` 形式保留旧 authority 文件
- 通过改名、隐藏目录、`.bak`、`.old` 等形式保留旧 authority 副本
- 在迁移表、包脚本、非治理文档或生产源码中继续引用该旧路径

本段只治理已经脱离 active owner 的旧 APP user-demand authority；
它不覆写其他 active owner 的 blueprint 绑定。

---

## 22. 最终输出报告格式

完成后输出：

```txt
[APP-SHELL-UI-GOVERNANCE-REPORT]
```

必须包含：

```txt
1. 是否完成：YES / NO
2. 是否新增第二 UI 链路：YES / NO
3. 是否保留旧 Home UI 生产入口：YES / NO
4. App Shell 是否存在：YES / NO
5. Sidebar 是否存在：YES / NO
6. Main Workspace 是否存在：YES / NO
7. Inspector 是否存在：YES / NO
8. Runtime Console 是否存在：YES / NO
9. Skill Registry 是否存在：YES / NO
10. 是否支持二级 Skill Workspace：YES / NO
11. 是否支持三级 Detail / Inspector：YES / NO
12. Amazon Product Mining 是否重排：YES / NO
13. Keyword History 是否成为主区域：YES / NO
14. 是否存在采购/打样/压货/广告/最终选择按钮：YES / NO
15. 是否存在 localStorage 真相源：YES / NO
16. 是否存在前端计算 verdict：YES / NO
17. Inspector 是否覆盖：YES / NO
18. Acceptance 是否覆盖：YES / NO
19. 质检脚本是否 ts-morph AST/symbol/反逃逸：YES / NO
20. 质检脚本是否无正则：YES / NO
21. ci:full 结果
22. 修改文件清单
23. 新增文件清单
24. 删除文件清单
25. 仍存在问题
```

失败时只输出 firstFailure：

```txt
[APP-SHELL-UI-GOVERNANCE-REPORT:FAILED]
firstFailure.phase
firstFailure.file
rootCause
auxiliaryRootCause
violatedLawId
violatedBlueprintSection
minimalFix
```

---

## 23. 最终提醒

```txt
现在不是美化网页。
现在是给未来 Mac Agent App 打地基。

能承载 20 个技能，才合格。
能二级、三级页面展开，才合格。
能 SwiftUI 同构迁移，才合格。
能让人一眼知道任务、结果、异常、证据，才合格。

一页到底，失败。
堆表单，失败。
超宽表塞详情，失败。
没有 Inspector，失败。
没有 Skill Registry，失败。
```
