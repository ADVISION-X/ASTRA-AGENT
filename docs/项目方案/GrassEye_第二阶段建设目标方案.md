# GrassEye 第二阶段建设目标方案

## 1. 基本身份

- 文档名称：GrassEye 第二阶段建设目标方案
- 文档类型：阶段目标方案，不是 TODO，不是施工任务清单，不是代码实现说明
- 阶段定位：在第一阶段法案系统完成并通过审核后，定义第二阶段完成后的系统结果、能力边界与验收标准
- 从属权威：
  - `.github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.md`
  - `.github/instructions/cursor-rules/grasseye-index.instructions.md`
  - `.github/instructions/cursor-rules/modules/module-local-app-shell.instructions.md`
  - `.github/instructions/cursor-rules/modules/module-local-ai-runtime.instructions.md`
  - `.github/instructions/cursor-rules/modules/module-agent-runtime.instructions.md`
  - `.github/instructions/cursor-rules/modules/module-platform-action.instructions.md`
  - `.github/instructions/cursor-rules/modules/module-vision-boundary.instructions.md`
  - `.github/instructions/cursor-rules/modules/module-comment-intelligence.instructions.md`
  - `.github/instructions/cursor-rules/modules/module-product-signal.instructions.md`
  - `.github/instructions/cursor-rules/modules/module-local-data.instructions.md`
  - `.github/instructions/cursor-rules/modules/module-operator-control.instructions.md`
  - `.github/instructions/cursor-rules/modules/module-security-privacy.instructions.md`
  - `.github/instructions/cursor-rules/modules/module-code-topology.instructions.md`
  - `.github/instructions/cursor-rules/modules/module-type-safety.instructions.md`
  - `.github/instructions/cursor-rules/modules/module-audit-system.instructions.md`
- 原则：本方案只定义第二阶段完成态，不拆 TODO，不写实现代码，不新增法案主权

---

## 2. 第二阶段一句话目标

第二阶段要把 GrassEye 从“只有法案治理基座”推进到一个可本地运行的最小闭环工作台：

> **在 Mac 本机上，通过 localhost Operator Console + Local Agent Service + 单平台 PlatformAdapter + 本地 AI Gateway + 本地 Evidence Store，跑通一次可暂停、可复核、可追溯、可删除的种草产品发现闭环。**

第二阶段完成后，GrassEye 不再只是制度设计，而是具备一个最小真实工作流：

```txt
本地控制台
→ 本地 Agent 服务
→ 本机浏览器视频页面
→ 视频区域截图
→ 本地 AI 判断
→ 有限平台动作
→ 评论区截图 / OCR
→ 评论理解
→ 产品机会候选记录
→ 操作者复核
```

---

## 3. 第二阶段完成后的系统状态

第二阶段完成后，系统应达到以下状态：

| 系统部分 | 第二阶段完成态 |
|---|---|
| 产品形态 | localhost 本地工作台，可在 Mac 本机运行，不是 SaaS，不是插件主壳，不是 CLI-only |
| 操作者入口 | Operator Console 能显示运行状态、暂停、停止、复核、候选池 |
| Agent 主链 | 完成 observe → classify → act → record 的最小闭环 |
| 平台适配 | 完成一个网页视频平台的 PlatformAdapter，不做多平台扩张 |
| 浏览器控制 | BrowserController 承接 click / scroll / capture 原子能力，UI 和 Core 不直接散落点击逻辑 |
| 本地 AI | Local AI Gateway 承接视觉判断、OCR/评论理解、产品信号候选输出，不自动调用付费或云端 API |
| 数据证据 | Evidence Store 能保存截图引用、OCR 文本、AI 输出、动作日志、产品候选记录，并支持删除 |
| 人工控制 | 高风险、低置信度、不确定结果进入 review / skip，不自动变成采购、上架、广告决策 |
| 安全隐私 | cookie、session、截图、评论、证据留在本地授权环境，不默认公网暴露 |
| 审计基础 | 后续执法脚本有明确 owner 边界与可检查对象，但第二阶段不强制完成全量自动执法 |

---

## 4. 第二阶段建设范围

第二阶段只建设最小真实闭环，不建设完整商业系统。

### 4.1 必须进入第二阶段的能力

| 能力 | 目标 |
|---|---|
| Local Operator Console | 操作者能启动、暂停、停止任务，查看候选记录和证据 |
| Local Agent Service | 本地执行单轮 Agent 主链，不依赖云端任务服务 |
| BrowserController | 统一承接本机浏览器打开、滚动、点击、区域截图等原子动作 |
| 单平台 PlatformAdapter | 只适配一个网页视频平台，验证 adapter 架构成立 |
| Video Region Capture | 能截取视频区域并生成 evidence reference |
| Local AI Gateway | 本地 AI 任务统一入口，返回结构化结果 |
| Vision Classification | 对视频截图判断产品/非产品、置信度、理由、建议动作 |
| Comment Capture / OCR | 对评论区截图并生成 OCR 文本或可清洗文本 |
| Comment Signal | 从评论中提取购买意图、痛点、质疑、需求词 |
| Product Opportunity Candidate | 生成产品机会候选，不生成最终商业决策 |
| Evidence Store | 本地保存证据链，支持追溯、删除、导出边界 |
| Action Log | 每个关键动作有记录，能绑定证据与 AI 结果 |
| Review Gate | 低置信度、高风险、不确定候选进入人工复核 |

### 4.2 不进入第二阶段的能力

| 不进入范围 | 原因 |
|---|---|
| GrassEye.app 正式打包 | 第二阶段只跑通 localhost workbench，桌面封装后置 |
| 多平台同时适配 | 会过早放大 adapter 复杂性 |
| SaaS 云端运行 | 违背本地优先和隐私边界 |
| 远程浏览器托管 | 涉及 session、cookie、截图和平台安全风险 |
| 浏览器插件主壳 | 不作为第二阶段主形态 |
| 账号池 / 代理池 / 指纹伪装 | 违反平台动作和安全隐私边界 |
| 自动评论 / 私信 / 关注 / 批量互动 | 违反研究型 Agent 边界 |
| 自动采购 / 自动上架 / 自动广告投放 | Product Signal 只生成候选，不做最终商业动作 |
| 完整选品商业分析系统 | 第二阶段只做候选闭环，不做全量商业决策系统 |
| 全量执法脚本系统 | 可建立审计入口和报告基础，但不要求完成所有自动执法 |

---

## 5. 第二阶段主链完成态

第二阶段的主链必须短、清楚、可追溯。

| 步骤 | 输入 | 输出 | 验收表现 |
|---|---|---|---|
| 1. Operator 启动任务 | 本地控制台操作 | 创建本地任务记录 | 任务可见、可暂停、可停止 |
| 2. Agent 打开目标平台页面 | 用户授权本机浏览器会话 | 当前视频页面状态 | 不托管远程 session，不绕过登录/风控 |
| 3. 截取视频区域 | 当前视频区域 | Video Evidence | 截图只覆盖相关区域，不截无关敏感区域 |
| 4. 本地视觉判断 | Video Evidence | VisionClassificationResult | 有 classification、confidence、reason、suggestedAction |
| 5. 执行有限动作 | 结构化 AI 结果或 operator 指令 | ActionLog | 动作经过 adapter，且有限速、可审计 |
| 6. 打开并截取评论区 | 产品候选视频 | Comment Evidence | 评论截图绑定视频证据 |
| 7. OCR 与评论理解 | Comment Evidence | CommentSignalResult | 输出购买意图、痛点、质疑、需求词，不做人画像 |
| 8. 产品机会候选生成 | 视频证据 + 评论信号 + AI 中间结果 | ProductOpportunityCandidate | 只是候选，带 evidenceRefs 和风险说明 |
| 9. 人工复核 | 候选记录 | approve / reject / hold / note | 不自动采购、不自动上架、不自动投放 |
| 10. 本地留痕与删除 | 所有证据和记录 | 可追溯本地记录 | 支持查看、删除、导出边界 |

---

## 6. 第二阶段模块完成目标

### 6.1 Local App Shell

| 完成目标 | 验收标准 |
|---|---|
| 本地控制台可作为主入口 | 操作者不用 CLI 才能看到主状态 |
| 本地 Agent 服务可由控制台驱动 | 控制台能启动、暂停、停止任务 |
| 所有运行组件默认本地 | 不依赖公网服务完成主链 |
| 不做正式桌面封装 | 不创建 Electron / Tauri / SwiftUI 业务壳 |

### 6.2 Agent Runtime

| 完成目标 | 验收标准 |
|---|---|
| 单轮闭环成立 | observe、classify、act、record 四步可追踪 |
| 有 stop / pause / review gate | 操作者能中断任务，低置信度能进入 review |
| 无无限循环 | 任务有轮次、上限或人工接管点 |
| 不自行扩平台 | Agent 不从一个平台自动扩到多个平台 |

### 6.3 Platform Action / Platform Adapter

| 完成目标 | 验收标准 |
|---|---|
| 一个平台 adapter 跑通 | 单平台可打开视频、截图、有限动作、打开评论 |
| Core 不直接点页面 | Core 不包含平台 selector、裸坐标、平台 DOM 细节 |
| 动作有限 | 只允许 scroll / open video / screenshot / not interested / like-save candidate / open comments / return-continue |
| 动作可审计 | 每个关键动作都有 ActionLog |

### 6.4 Local AI Runtime

| 完成目标 | 验收标准 |
|---|---|
| Local AI Gateway 成立 | Vision、OCR/Comment、Product Signal 通过统一本地 AI 边界 |
| 无 silent cloud fallback | 本地失败进入 retry / skip / review，不自动调用付费 API |
| Prompt Registry 成立 | prompt 有 taskType、promptVersion、schemaVersion |
| 输出结构化 | AI 输出先 schema validation，再进入动作或记录 |

### 6.5 Vision / Comment / Product Signal

| 完成目标 | 验收标准 |
|---|---|
| Vision 只做图像判断 | 不直接给最终商业结论 |
| Comment 只做证据型评论理解 | 不采集不必要身份信息，不做人画像 |
| Product Signal 只做候选机会 | 不自动生成采购、上架、广告决策 |
| 所有结论绑定证据 | 每条候选可回看 video evidence、comment evidence、AI result |

### 6.6 Local Data

| 完成目标 | 验收标准 |
|---|---|
| 本地证据库成立 | 能保存截图引用、OCR、AI 输出、动作日志、候选记录 |
| 数据可追溯 | 候选记录能追溯到证据来源 |
| 数据可删除 | 可以删除候选及其绑定证据 |
| 不默认远程存储 | 不依赖云端数据库完成主链 |

### 6.7 Operator Control

| 完成目标 | 验收标准 |
|---|---|
| 操作者拥有最终控制权 | 候选必须人工复核才进入下一步 |
| 高风险动作不自动执行 | 低置信度、异常、敏感情况进入 review 或 skip |
| 控制台显示状态 | 操作者能看到运行中、暂停、失败、等待复核等状态 |

---

## 7. 第二阶段验收标准

第二阶段通过，不以“写了多少文件”为标准，而以“主链是否真实闭合”为标准。

| 验收项 | 通过标准 | 不通过表现 |
|---|---|---|
| 本地运行 | 本机能启动控制台和 Agent 服务 | 必须依赖云端主服务才能跑 |
| 单平台闭环 | 一个网页视频平台完整跑通主链 | 只有分散 demo，没有闭环 |
| 本地 AI | AI 任务由本地 Gateway 承接 | 失败后静默调用云端 / 付费 API |
| 平台动作 | 动作经过 adapter 且有日志 | Core 里散落 selector 或裸坐标 |
| 证据链 | 候选能回看截图、OCR、AI 结果、动作日志 | 结论无法追溯来源 |
| 人工复核 | 候选进入 review，不能自动商业决策 | AI 结果直接变成采购/上架/广告 |
| 数据本地 | evidence store 本地优先，可删可查 | 默认云端存储或不可删除 |
| 安全隐私 | 不暴露 cookie/session/截图/证据到公网 | 远程浏览器托管或公网暴露本地服务 |
| 范围克制 | 只做单平台、最小工作台 | 同时做多平台、插件、SaaS、桌面打包 |
| 法案一致 | 实现不违背 law / blueprint | 代码绕过 owner 边界 |

---

## 8. 第二阶段不合格漂移信号

出现以下情况，说明第二阶段已经偏航，应立即停止并回到法案审查：

| 漂移信号 | 说明 |
|---|---|
| 写成 SaaS 平台 | 违背本地优先与本地应用形态 |
| 远程托管浏览器或 cookie | 违背 security-privacy 与 local-app-shell |
| 先做 Electron / Tauri 包装 | 包装层早于主链闭合，容易制造第二架构 |
| 同时适配多个平台 | 过早扩大复杂性，破坏单平台验证原则 |
| UI 直接调用 Playwright / AI / 数据库 | UI 混权，破坏 local shell 分层 |
| Core 直接写 selector / 坐标点击 | 绕过 PlatformAdapter |
| 本地 AI 失败后自动调用云端 | 违背 local-ai-runtime |
| Product Signal 输出最终采购建议 | 超出候选机会边界 |
| 评论分析保存个人画像 | 违背 comment-intelligence 与 privacy |
| 数据无法删除或无法追溯 | 违背 local-data |

---

## 9. 第二阶段交付物形态

第二阶段完成后，应存在以下交付物类型：

| 类型 | 说明 |
|---|---|
| 本地运行入口 | 可启动 local operator console 与 local agent service |
| 单平台 adapter | 一个网页视频平台的受控适配器 |
| 本地 AI Gateway | 本地 AI 任务入口与 schema 输出边界 |
| Prompt Registry | 任务化、版本化、schema-bound 的 prompt 合同 |
| Evidence Store | 本地证据与候选记录存储 |
| Operator Console | 状态、控制、review、候选池展示 |
| Action Log | 平台动作、AI 判断、证据记录可追溯 |
| 验收报告 | 对照第二阶段验收标准逐项说明通过 / 未通过 |

注意：这些是交付物类型，不是 TODO 拆分。下一步 TODO 文档需要基于本方案继续拆解。

---

## 10. 第二阶段与第三阶段的边界

第二阶段完成的是：

```txt
localhost 本地工作台 + 单平台种草产品发现闭环
```

第三阶段才考虑：

| 第三阶段候选方向 | 说明 |
|---|---|
| GrassEye.app 打包 | Electron / Tauri / SwiftUI 等包装路线评估 |
| 多平台扩展 | 增加第二、第三个平台 adapter |
| 更强产品分析 | 趋势对比、跨视频聚合、类目机会榜 |
| 更强审计自动化 | 将法案 owner 接入更多自动 inspector |
| 更强数据管理 | 搜索、筛选、导出、备份策略 |
| 更强模型优化 | 本地模型性能、提示词迭代、OCR 准确率提升 |

第三阶段能力不得提前偷渡进第二阶段。

---

## 11. 第二阶段最终定义

第二阶段不是“做完整产品”。

第二阶段也不是“做所有平台”。

第二阶段的完成定义只有一个：

> **GrassEye 能在 Mac 本机以 localhost workbench 的形态，使用本地浏览器、本地 AI、本地证据库和人工复核，完成一个网页视频平台上的种草产品发现最小闭环。**

如果做到这一点，第二阶段通过。

如果没有做到这一点，即使写了很多页面、很多模型、很多 adapter，也不算通过。

---

## 12. 下一步文档

本方案通过后，下一份文档才是：

```txt
GrassEye 第二阶段 TODO 拆解清单
```

TODO 文档必须从本方案倒推，不得脱离本方案扩张。

