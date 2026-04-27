# GrassEye 法案系统蓝图

> 项目定位：GrassEye 是一个本地视觉 Agent + 种草产品挖掘系统。  
> 它通过浏览器自动执行、视频区域截图、本地视觉 AI 判断、评论区 OCR、数据沉淀与产品机会评分，帮助从 Facebook / TikTok / Instagram / YouTube Shorts 等内容流中挖掘“被用户种草”的产品机会。

---

## 0. 总判断

GrassEye 不应该直接照搬 APEX 那套大规模电商法案系统。

APEX 是一个完整商业前端系统，包含店铺、视频成交页、Shopify、后台、结账、订单、PDP、RTL、性能、缓存、审计等大量能力域。

GrassEye 的第一阶段不是完整电商系统，而是一个“本地自动化选品侦察系统”。

因此 GrassEye 的法案系统应该更小、更硬、更聚焦。

核心原则：

```text
少法案，强边界。
少 owner，强执法。
少页面，强主链。
少数据表，强证据。
```

GrassEye 第一阶段不应该做成“全能营销平台”，也不应该提前做成“选品 SaaS”。  
它应该先成为一个可运行、可验证、可持续迭代的本地产品挖掘机器。

---

## 1. GrassEye 的系统主链

GrassEye 的主链只有一条：

```text
平台信息流
  ↓
浏览器 Agent 执行
  ↓
视频区域截图
  ↓
本地视觉 AI 判断
  ↓
产品/非产品分流
  ↓
产品视频打开评论区
  ↓
评论区 OCR / 文本提取
  ↓
用户痛点与购买意图分析
  ↓
产品机会记录
  ↓
机会评分与复盘
```

任何功能，只要不能服务这条主链，第一阶段都不进入 active 法案。

---

## 2. GrassEye 法案系统结构

建议第一阶段只保留以下 3 个 base 文件 + 10 个模块法案。

```text
.github/instructions/grass-eye-rules/
  ├── GRASSEYE-KERNEL.instructions.md
  ├── grass-eye-index.instructions.md
  ├── AGENTS.md
  └── modules/
      ├── iron-laws.instructions.md
      ├── red-lines-type-safety.instructions.md
      ├── module-codebase-topology.instructions.md
      ├── module-browser-agent.instructions.md
      ├── module-vision-boundary.instructions.md
      ├── module-platform-training.instructions.md
      ├── module-comment-extraction.instructions.md
      ├── module-product-opportunity.instructions.md
      ├── module-storage-evidence.instructions.md
      ├── module-operator-control.instructions.md
      └── module-audit-system.instructions.md
```

> 注意：如果你想进一步极简，`iron-laws`、`red-lines-type-safety`、`module-codebase-topology`、`module-audit-system` 可以保留为基础治理模块；业务模块只保留 6 个：browser-agent、vision-boundary、platform-training、comment-extraction、product-opportunity、storage-evidence。

---

## 3. Base 文件设计

### 3.1 `GRASSEYE-KERNEL.instructions.md`

#### 定位

GrassEye 系统内核，上帝文件。

#### 只管什么

只管：

1. 系统身份
2. 权威顺序
3. 当前 active 主链
4. 核心红线
5. canonical paths
6. 当前阶段边界

#### 不管什么

不写：

- 具体浏览器点击流程
- 具体 OCR 实现
- 具体 AI 模型选择
- 具体数据库字段细节
- 具体 UI 页面设计
- 未来 SaaS 规划
- 未来多平台商业化设想

#### 内核建议内容

```md
# GrassEye System Kernel

## System Identity

- Project: GrassEye
- Domain: Local Visual Agent for Seeded Product Discovery
- Current Phase: Local-first product discovery prototype
- Core Mission: discover product-seeding opportunities from social video feeds through local vision AI, comment extraction, and evidence-backed opportunity scoring.

## Authority

1. User instruction
2. AGENTS.md
3. GRASSEYE-KERNEL
4. grass-eye-index
5. path-matched module laws
6. active phase gate
7. generated audit truth

## Core Business Anchors

- GrassEye owns browser-agent execution.
- GrassEye owns video screenshot capture.
- Local AI owns visual classification result.
- OCR pipeline owns comment text extraction.
- Product Opportunity engine owns scoring and evidence summary.
- Operator owns final product decision.
- GrassEye does not auto-purchase, auto-message users, auto-spam, or bypass platform security.

## Red Lines

- No second agent execution chain.
- No cloud upload of screenshots unless explicitly enabled.
- No credential leakage.
- No hidden autonomous posting, commenting, messaging, or buying.
- No fake AI result.
- No product opportunity without evidence.
- No storing unnecessary personal data.
- No bypassing platform access controls.
- No zombie code or old shell retention.
```

---

### 3.2 `grass-eye-index.instructions.md`

#### 定位

路由文件，只负责“哪个路径加载哪个模块”。

#### 只管什么

- 法案路径匹配
- 模块触发
- owner 绑定
- 禁止 broad path 乱扫

#### 不管什么

- 不定义业务规则
- 不重复 kernel
- 不写实现细节
- 不写未来规划

#### 建议边界

```md
# GrassEye Routing Index

Role: locate active GrassEye rules for the current repository only.

Use order:

1. Load GRASSEYE-KERNEL first.
2. Match current path against active repository triggers.
3. Load the narrowest current owner only.
4. Do not route absent historical paths.
5. Do not reactivate phase-inactive owners by broad path matching.
```

---

### 3.3 `AGENTS.md`

#### 定位

Codex / Agent 的施工协议。

#### 只管什么

- 每轮任务怎么执行
- 每轮允许改什么
- 每轮禁止改什么
- 输出报告格式
- 验证命令
- 是否涉及新页面
- 新页面先 HTML 后代码

#### 建议保留 APEX 的“单轮闭环”思想

```md
# AGENTS

## Execution Loop

1. ChatGPT gives one bounded prompt.
2. Codex executes only that prompt.
3. Codex outputs a completion report.
4. User sends report back.
5. ChatGPT reviews and gives the next bounded prompt.

No background autonomous expansion.

## Per-Round Required Frame

- 本轮任务名称
- 本轮目标
- 本轮允许改的文件范围
- 本轮禁止改的文件范围
- 本轮必须保留的方向
- 本轮必须删除或收束的方向
- 是否涉及新页面
- 如果涉及，先交 HTML，不准直接写 route
- 本轮验收命令
- 本轮输出报告
```

---

## 4. GrassEye 第一阶段法案清单

| 序号 | 法案文件 | 能力域 | 优先级 | 是否第一阶段 active | 核心作用 |
|---:|---|---|---|---|---|
| 1 | `iron-laws.instructions.md` | coding-discipline | P0 | 是 | 基础代码纪律 |
| 2 | `red-lines-type-safety.instructions.md` | type-safety | P0 | 是 | TS 严格模式、禁止 any |
| 3 | `module-codebase-topology.instructions.md` | codebase-topology | P0 | 是 | 文件落位、owner 边界 |
| 4 | `module-browser-agent.instructions.md` | browser-agent | P0 | 是 | 浏览器 Agent 执行主链 |
| 5 | `module-vision-boundary.instructions.md` | vision-boundary | P0 | 是 | 截图与本地 AI 判断边界 |
| 6 | `module-platform-training.instructions.md` | platform-training | P0 | 是 | 点赞/不感兴趣训练平台推荐 |
| 7 | `module-comment-extraction.instructions.md` | comment-extraction | P0 | 是 | 评论区 OCR 与文本提取 |
| 8 | `module-product-opportunity.instructions.md` | product-opportunity | P0 | 是 | 产品机会识别、评分、证据摘要 |
| 9 | `module-storage-evidence.instructions.md` | storage-evidence | P0 | 是 | 数据存储、证据链、隐私最小化 |
| 10 | `module-operator-control.instructions.md` | operator-control | P0 | 是 | 人类操作员控制、暂停、审查、手动确认 |
| 11 | `module-audit-system.instructions.md` | audit-system | P0 | 是 | 法案与执法系统自身治理 |

---

## 5. 各法案内容范围与边界

---

## 5.1 `iron-laws.instructions.md`

### 定位

基础代码铁律。

### 只管什么

- 禁止 TODO / FIXME / HACK / XXX
- 禁止未完成占位
- 禁止脚本直接批量改业务源码
- 禁止假完成
- 禁止无验证提交
- 单文件单职责
- 不保留旧壳

### 不管什么

- 不管浏览器 Agent 业务逻辑
- 不管 AI 判断标准
- 不管评论区解析规则
- 不管产品机会评分

### 必须存在

- 明确代码纪律
- 明确 forbidden 占位符
- 明确验证要求
- 明确“完成 = 改完 + 验证过”

### 必须不存在

- “以后再补”
- “临时兼容”
- “保留旧逻辑以防万一”
- 无主脚本
- 无主 helper

---

## 5.2 `red-lines-type-safety.instructions.md`

### 定位

TypeScript 类型安全红线。

### 只管什么

- `strict: true`
- 禁止 `any`
- 外部不可信输入必须先 `unknown`
- AI 返回结果必须 schema parse
- OCR 返回结果必须 schema parse
- 浏览器事件结果必须 schema parse

### 不管什么

- 不管 AI 的实际判断是否正确
- 不管产品机会评分公式
- 不管 UI 展示方式

### 必须存在

```text
unknown → schema validation → typed domain object
```

### 必须不存在

```text
AI response as any
OCR result as any
browser result as any
JSON.parse 后直接信任
```

---

## 5.3 `module-codebase-topology.instructions.md`

### 定位

代码拓扑法案。

### 只管什么

- 文件应该放在哪里
- 哪个 domain 拥有什么文件
- shared 层只能放真正跨域能力
- 禁止 `src/lib` 变成垃圾桶
- 禁止 feature 逻辑乱进 shared

### 推荐目录

```text
src/
  app/
    operator/
  features/
    browser-agent/
    vision/
    platform-training/
    comments/
    opportunities/
    evidence/
    operator-control/
  lib/
    browser/
    ocr/
    local-ai/
    storage/
  types/
  config/
scripts/
  audit/
  runtime-evidence/
prisma/
docs/
  law-blueprints/
```

### 不管什么

- 不管具体业务判断
- 不管具体模型
- 不管具体 UI 文案

### 必须不存在

- `src/lib/grassEyeEverything.ts`
- `src/utils/agentHelpers.ts` 这种总仓
- `src/features/common/` 这种假共享
- 一个文件同时管浏览器、AI、OCR、评分、存储

---

## 5.4 `module-browser-agent.instructions.md`

### 定位

浏览器 Agent 主执行链法案。

这是 GrassEye 的第一核心法案。

### 只管什么

- 浏览器打开平台
- 进入视频流
- 定位视频区域
- 截图
- 点击“不感兴趣”
- 点击“点赞”
- 打开评论区
- 滚动评论区
- 把截图交给 vision / OCR
- 执行动作前后的证据记录

### 不管什么

- 不判断图片是不是产品
- 不识别文字
- 不做产品评分
- 不直接写数据库最终机会结论
- 不决定产品是否采购

### 必须存在

```text
BrowserAgentAction
BrowserAgentState
BrowserAgentDecisionInput
BrowserAgentDecisionResult
BrowserAgentExecutionLog
```

### 必须不存在

- Agent 自己用关键词猜产品
- Agent 自己绕过 AI 判断
- Agent 直接决定产品机会分
- 多个浏览器执行主链
- 后台静默乱点
- 无人工暂停机制

### 法案核心句

```text
Browser Agent 只负责“看、截、点、滚、交付证据”，不负责“理解、评分、商业决策”。
```

---

## 5.5 `module-vision-boundary.instructions.md`

### 定位

本地视觉 AI 边界法案。

这是 GrassEye 的第二核心法案。

### 只管什么

- 视频区域截图输入
- 本地视觉模型调用
- 产品 / 非产品分类
- 画面元素识别
- 置信度
- 返回固定结构
- AI 结果证据绑定

### 不管什么

- 不负责浏览器点击
- 不负责 OCR 评论全文提取
- 不负责最终产品机会评分
- 不负责数据库持久化策略

### 必须存在

```ts
type VisionClassification =
  | "PRODUCT_VIDEO"
  | "NON_PRODUCT_VIDEO"
  | "UNCERTAIN";

type VisionResult = {
  classification: VisionClassification;
  confidence: number;
  visibleProductHints: string[];
  sceneSummary: string;
  evidenceImageId: string;
};
```

### 必须不存在

- AI 返回自然语言后直接驱动点击
- 无 schema 校验
- 无 confidence
- 无 evidenceImageId
- 云端上传截图作为默认行为
- 视觉模块直接操作浏览器

### 法案核心句

```text
Vision 只给结构化判断，不执行动作，不写最终商业结论。
```

---

## 5.6 `module-platform-training.instructions.md`

### 定位

平台推荐训练法案。

这是 GrassEye 的“信息流驯化”法案。

### 只管什么

- 产品类视频允许点赞
- 非产品类视频允许不感兴趣
- uncertain 结果不执行强动作
- 动作必须有 AI 证据
- 动作必须写日志
- 动作频率必须受控

### 不管什么

- 不管 AI 怎么判断产品
- 不管评论区 OCR
- 不管机会评分
- 不管账号体系

### 必须存在

```text
PRODUCT_VIDEO + confidence >= threshold → like allowed
NON_PRODUCT_VIDEO + confidence >= threshold → not_interested allowed
UNCERTAIN → no strong training action
```

### 必须不存在

- 无证据点赞
- 无证据点不感兴趣
- 对 uncertain 视频强行训练
- 高频异常动作
- 自动评论、自动私信、自动关注
- 伪装真人互动

### 法案核心句

```text
平台训练只允许最小化反馈：like / not interested；禁止扩展成社交自动化。
```

---

## 5.7 `module-comment-extraction.instructions.md`

### 定位

评论区提取法案。

### 只管什么

- 产品视频才打开评论区
- 评论区截图
- OCR 识别
- 评论文本清洗
- 语言识别
- 购买意图短语提取
- 用户痛点提取
- 评论证据与视频证据绑定

### 不管什么

- 不负责产品视频判断
- 不负责点赞/不感兴趣
- 不负责最终商机评分
- 不负责用户身份画像

### 必须存在

```text
CommentCapture
CommentOcrResult
CommentIntentSignal
CommentPainPointSignal
```

### 必须不存在

- 抓取不必要的用户个人资料
- 建立个人用户画像
- 自动回复评论
- 自动私信
- 评论区内容无证据来源
- OCR 结果无原始截图绑定

### 法案核心句

```text
评论区只提取“需求信号”，不沉淀“个人用户画像”。
```

---

## 5.8 `module-product-opportunity.instructions.md`

### 定位

产品机会识别与评分法案。

这是 GrassEye 的第三核心法案。

### 只管什么

- 产品机会记录
- 痛点分类
- 购买意图识别
- 评论热度
- 需求强度
- 供应链可行性字段
- 平台适配字段
- 机会评分
- 证据摘要

### 不管什么

- 不负责自动采购
- 不负责自动上架
- 不负责自动生成 Amazon Listing
- 不负责广告投放
- 不负责 Shopify 商品管理

### 必须存在

```text
Opportunity = VideoEvidence + VisionResult + CommentSignals + ScoreBreakdown
```

### 建议评分维度

```text
visualHookScore
painPointScore
purchaseIntentScore
commentHeatScore
repeatabilityScore
supplyFeasibilityScore
marketFitScore
riskScore
overallOpportunityScore
```

### 必须不存在

- 没有证据的机会记录
- 只凭播放量判断爆品
- 只凭点赞数判断购买意图
- 直接给出采购结论
- 直接同步到电商后台
- 把 GrassEye 做成 PIM / ERP / Amazon 后台

### 法案核心句

```text
GrassEye 只输出“有证据的产品机会”，不替代人的最终选品决策。
```

---

## 5.9 `module-storage-evidence.instructions.md`

### 定位

存储与证据链法案。

### 只管什么

- 截图保存
- AI 结果保存
- OCR 结果保存
- 评论信号保存
- 机会记录保存
- 原始证据与结论绑定
- 隐私最小化
- 数据可删除

### 不管什么

- 不管浏览器动作
- 不管 AI 模型
- 不管评分公式
- 不管 UI 页面

### 推荐最小数据模型

```text
VideoObservation
ImageEvidence
VisionResult
CommentEvidence
CommentSignal
ProductOpportunity
AgentActionLog
OperatorDecision
```

### 必须不存在

- 无证据结论
- 只存最终分数不存来源
- 存储平台账号密码明文
- 存储不必要个人资料
- 数据删不掉
- 一个大 JSON 存全世界

### 法案核心句

```text
所有商业结论必须能追溯到截图、AI 判断、评论证据与操作日志。
```

---

## 5.10 `module-operator-control.instructions.md`

### 定位

人类操作员控制法案。

GrassEye 是辅助工具，不是无人监管系统。

### 只管什么

- 启动/暂停/停止
- 手动接管
- 风险动作确认
- 机会记录人工复核
- 阈值配置
- 本地模型配置
- 平台账号状态提示

### 不管什么

- 不负责平台登录绕过
- 不负责自动商业决策
- 不负责采购、付款、发货、上架

### 必须存在

```text
pause button
stop button
manual override
operator review status
threshold config
```

### 必须不存在

- 无法暂停的 Agent
- 无法审查的自动动作
- 自动采购
- 自动付款
- 自动上架
- 自动私信用户
- 绕过平台风控

### 法案核心句

```text
GrassEye 可以自动观察和整理证据，但最终商业动作必须由人类操作员确认。
```

---

## 5.11 `module-audit-system.instructions.md`

### 定位

法案与执法系统自身治理。

### 只管什么

- law metadata
- owner mapping
- generated audit truth
- audit runner
- inspector 边界
- law / matrix / runner 一致性
- 禁止 generated 文件手改
- 禁止 owner 漂移
- 禁止脚本伪执法

### 不管什么

- 不管业务功能本身
- 不管 AI 判断标准
- 不管浏览器点击细节

### 必须存在

```text
law home
owner manifest
generated audit matrix
audit runner
one capability domain -> one owner inspector
```

### 必须不存在

- 一个 inspector 代持多个能力域
- blind delegate
- 字符串 includes 冒充 AST
- matrix 显示 active 但 runner 不执行
- law active 但没有 owner
- owner active 但没有 law home

### 法案核心句

```text
审计系统只证明法案是否真实落地，不替业务法案定义业务规则。
```

---

# 6. 第一阶段不应该进入 active 的法案

这些方向不是永远不能做，而是第一阶段不应该立 active 法案。

| 方向 | 当前处理 |
|---|---|
| SaaS 多租户 | 禁止 active，最多 historical reference |
| 团队账号系统 | 禁止 active |
| 云端图片上传 | 禁止默认 active |
| 自动生成 Amazon Listing | 禁止 active |
| 自动采购决策 | 禁止 active |
| 自动联系供应商 | 禁止 active |
| 自动私信用户 | 禁止 active |
| 自动发布评论 | 禁止 active |
| 自动跨平台矩阵运营 | 禁止 active |
| 商品 PIM 系统 | 禁止 active |
| ERP / 库存 / 订单系统 | 禁止 active |
| Shopify / Amazon 后台替代系统 | 禁止 active |
| 完整 BI 大屏 | 禁止 active |
| 内容 CMS | 禁止 active |
| 用户画像系统 | 禁止 active |
| 绕过平台风控 | 永久禁止 |

---

# 7. GrassEye 的法案边界总表

| 能力域 | 管什么 | 不管什么 | 一句话边界 |
|---|---|---|---|
| kernel | 身份、权威、红线 | 实现细节 | 顶层真相，不写业务手册 |
| index | 路由、触发 | 业务规则 | 只负责加载谁 |
| agents | 施工协议 | 业务法案 | Codex 每轮怎么干 |
| iron-laws | 代码纪律 | 业务判断 | 防止脏代码 |
| type-safety | 类型红线 | 评分逻辑 | 外部输入必须变成可信类型 |
| topology | 文件落位 | 业务规则 | 文件归谁管 |
| browser-agent | 看、截、点、滚 | 理解和评分 | Agent 只执行，不思考 |
| vision-boundary | 图片理解 | 点击和评分 | AI 只判断，不动作 |
| platform-training | like / not interested | 社交自动化 | 只做最小推荐训练 |
| comment-extraction | 评论 OCR 和需求信号 | 用户画像 | 只提取需求，不跟踪个人 |
| product-opportunity | 商机评分 | 采购/上架 | 只输出证据化机会 |
| storage-evidence | 数据和证据链 | 业务动作 | 结论必须可追溯 |
| operator-control | 人工控制 | 自动商业动作 | 人必须能暂停和复核 |
| audit-system | 法案执法闭环 | 业务规则 | 证明法案真实执行 |

---

# 8. GrassEye 第一阶段最小闭环

第一阶段不要贪大，只做这个闭环：

```text
打开平台视频流
  ↓
截图
  ↓
本地视觉模型判断
  ↓
产品视频点赞 / 非产品视频不感兴趣
  ↓
产品视频打开评论区
  ↓
OCR 提取评论
  ↓
AI 总结痛点和购买意图
  ↓
保存机会记录
  ↓
人类复核
```

这就是 MVP。

第一阶段成功标准不是“功能多”，而是：

```text
能稳定跑
能正确截
能本地识别
能提取评论
能保存证据
能输出机会
能人工复核
能随时暂停
```

---

# 9. GrassEye 法案命名建议

建议使用独立编号，不沿用 APEX。

```text
GE-KERNEL-001-V1
GE-IRON-001-V1
GE-TS-001-V1
GE-TOPO-001-V1
GE-AGENT-001-V1
GE-VISION-001-V1
GE-TRAINING-001-V1
GE-COMMENT-001-V1
GE-OPPORTUNITY-001-V1
GE-EVIDENCE-001-V1
GE-OPERATOR-001-V1
GE-AUDIT-001-V1
```

命名规则：

```text
GE-能力域-序号-版本
```

禁止：

```text
APEX-xxx
GRASS-EYE-EVERYTHING
PRODUCT-DISCOVERY-ALL
AGENT-SUPER-SYSTEM
```

原因：GrassEye 是新系统，必须有自己的法案身份，不能借 APEX 旧链路回潮。

---

# 10. 施工图应该怎么做

GrassEye 可以有施工图，但施工图不是第二法案。

建议只建 3 份施工图：

```text
docs/law-blueprints/
  ├── browser-agent-main-chain-blueprint.md
  ├── vision-comment-evidence-blueprint.md
  └── product-opportunity-scoring-blueprint.md
```

## 10.1 `browser-agent-main-chain-blueprint.md`

只写：

- 浏览器动作矩阵
- 动作前置条件
- 动作后置证据
- 禁止动作
- pause / stop / manual override

不写：

- AI 模型细节
- 产品评分
- 数据库字段全集

## 10.2 `vision-comment-evidence-blueprint.md`

只写：

- 截图输入
- 本地 AI 输出 schema
- OCR 输出 schema
- 评论信号 schema
- evidenceId 绑定关系

不写：

- 浏览器点击策略
- 产品评分公式
- UI 页面

## 10.3 `product-opportunity-scoring-blueprint.md`

只写：

- 评分字段
- 每个分数字段来源
- 必须绑定哪些证据
- 哪些分数不能单独决定结论

不写：

- 自动采购
- 自动上架
- 广告投放
- ERP 逻辑

---

# 11. 推荐第一轮 Codex 提示词

下面这段可以直接给 Codex：

```md
# GrassEye 法案系统第一轮基线创建

## 本轮任务名称

Create GrassEye law-system baseline.

## 本轮目标

为 GrassEye 创建最小可持续迭代的法案系统基线，只建立 law home、kernel、index、AGENTS、基础治理模块和核心业务模块的空壳与边界文本，不写业务代码，不创建页面，不创建数据库，不实现浏览器自动化。

## 治理哲学

大道至简。
只认四个词：单一、直接、真实、可删除。

一个文件只做一件事。
一个法案只管一个能力域。
一个脚本只守一个 owner。
一个问题只有一个主裁来源。

禁止第二链、平行实现、旧壳保留、未来规划冒充当前方向、施工图越权成第二法案。

## 本轮允许创建的文件范围

.github/instructions/grass-eye-rules/GRASSEYE-KERNEL.instructions.md
.github/instructions/grass-eye-rules/grass-eye-index.instructions.md
.github/instructions/grass-eye-rules/AGENTS.md
.github/instructions/grass-eye-rules/modules/iron-laws.instructions.md
.github/instructions/grass-eye-rules/modules/red-lines-type-safety.instructions.md
.github/instructions/grass-eye-rules/modules/module-codebase-topology.instructions.md
.github/instructions/grass-eye-rules/modules/module-browser-agent.instructions.md
.github/instructions/grass-eye-rules/modules/module-vision-boundary.instructions.md
.github/instructions/grass-eye-rules/modules/module-platform-training.instructions.md
.github/instructions/grass-eye-rules/modules/module-comment-extraction.instructions.md
.github/instructions/grass-eye-rules/modules/module-product-opportunity.instructions.md
.github/instructions/grass-eye-rules/modules/module-storage-evidence.instructions.md
.github/instructions/grass-eye-rules/modules/module-operator-control.instructions.md
.github/instructions/grass-eye-rules/modules/module-audit-system.instructions.md

## 本轮禁止修改的文件范围

- src/**
- prisma/**
- package.json
- scripts/**
- existing APEX law files
- generated audit artifacts
- any runtime business code

## 本轮必须保留的方向

GrassEye 当前只做本地视觉 Agent 种草产品挖掘系统。

主链为：

平台信息流
→ 浏览器 Agent
→ 视频区域截图
→ 本地视觉 AI 判断
→ 产品/非产品分流
→ 产品视频打开评论区
→ OCR / 评论文本提取
→ 用户痛点与购买意图分析
→ 产品机会记录
→ 人工复核

## 本轮必须删除或收束的方向

禁止在法案中激活以下方向：

- SaaS 多租户
- 云端图片上传默认链路
- 自动采购
- 自动上架
- 自动私信
- 自动评论
- 自动供应商联系
- Amazon / Shopify 后台替代系统
- PIM / ERP / CRM
- 完整 BI 大屏
- 用户画像系统
- 绕过平台风控

## 法案写作要求

每个法案文件必须包含：

1. Scope
2. Boundary
3. Excludes
4. Authority
5. Active laws
6. Required direction
7. Forbidden direction
8. Module boundary statement

每个法案必须短、硬、单一。
禁止写成长篇散文。
禁止把施工图、实现手册、未来规划写进法案。
禁止一个法案同时管多个能力域。

## Law ID 规则

使用 GE 前缀：

GE-KERNEL-001-V1
GE-IRON-001-V1
GE-TS-001-V1
GE-TOPO-001-V1
GE-AGENT-001-V1
GE-VISION-001-V1
GE-TRAINING-001-V1
GE-COMMENT-001-V1
GE-OPPORTUNITY-001-V1
GE-EVIDENCE-001-V1
GE-OPERATOR-001-V1
GE-AUDIT-001-V1

禁止沿用 APEX lawId。
禁止创建泛化 lawId。
禁止创建未列出的 capabilityDomain。

## 验收标准

- 所有文件存在
- 每个模块只声明一个 capabilityDomain
- kernel 不写实现细节
- index 不写业务规则
- AGENTS 只写施工协议
- 业务模块不互相越权
- 不创建任何业务代码
- 不创建任何页面
- 不创建任何数据库模型
- 不修改 existing APEX law files

## 本轮输出报告格式

# 本轮完成报告

## 1. 本轮目标
## 2. 创建文件清单
## 3. 修改文件清单
## 4. 删除文件清单
## 5. 未修改但发现的问题
## 6. 法案影响
## 7. 执法影响
## 8. 页面影响
## 9. DB 影响
## 10. 验证命令结果
## 11. 是否达到本轮验收标准
## 12. 下一轮输入建议
```

---

# 12. 最终结论

GrassEye 的法案系统，不应该从“完整平台”开始，而应该从“单主链 Agent”开始。

第一阶段只立这些法：

```text
一个内核
一个路由
一个施工协议
四个基础治理模块
六个业务核心模块
一个审计模块
```

它的核心不是“大而全”，而是：

```text
Agent 能看
AI 能判
评论能取
证据能存
机会能评
人能复核
系统能停
法案能执
```

只要这条链跑通，GrassEye 就有了真正的生命。

后面的多平台、多模型、多账号、多趋势分析、多市场适配，都可以在这条主链上干净地长出来。

但第一阶段，绝不能让它长成第二个总仓系统。
