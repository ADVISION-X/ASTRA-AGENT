# GrassEye 第二阶段 TODO 计划

## 1. 基本身份

- 文档名称：GrassEye 第二阶段 TODO 计划
- 文档类型：第二阶段执行清单 / 闭环治理清单
- 从属方案：`GrassEye 第二阶段建设目标方案`
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
- 原则：本 TODO 只服务第二阶段最小真实闭环，不扩张到第三阶段能力

---

## 2. 第二阶段唯一完成定义

第二阶段完成的唯一标准：

> GrassEye 能在 Mac 本机以 localhost workbench 的形态，使用本地浏览器、本地 AI、本地证据库和人工复核，完成一个网页视频平台上的种草产品发现最小闭环。

闭环链路必须成立：

```txt
Local Operator Console
→ Local Agent Service
→ BrowserController
→ Single PlatformAdapter
→ Video Region Evidence
→ Local AI Gateway
→ VisionClassificationResult
→ Governed Platform Action
→ Comment Evidence / OCR
→ CommentSignalResult
→ ProductOpportunityCandidate
→ Operator Review
→ Local Evidence Store
```

---

## 3. 第二阶段硬边界

### 3.1 必须坚持

| 边界 | 要求 |
|---|---|
| 本地形态 | localhost operator console + local agent service |
| 本地浏览器 | 使用用户授权的本机浏览器会话，不远程托管 cookie/session |
| 本地 AI | 通过 Local AI Gateway 承接，不自动 fallback 到付费或云端 API |
| 单平台 | 第二阶段只完成一个平台 adapter，不做多平台扩张 |
| 人工控制 | pause / stop / review / candidate disposition 必须可见 |
| 证据链 | 截图、OCR、AI 输出、动作日志、候选记录必须可追溯 |
| 数据本地 | evidence store 本地优先，可删除，可导出边界清楚 |
| 安全隐私 | 不默认公网暴露本地服务、截图、cookie、session、证据库 |

### 3.2 禁止进入

| 禁止项 | 原因 |
|---|---|
| SaaS 主形态 | 违背 local-app-shell |
| 远程浏览器服务 | 违背 security-privacy |
| 浏览器插件主壳 | 不是第二阶段主体验 |
| CLI-only 主体验 | 操作者不可见，不满足 operator-control |
| Electron / Tauri / SwiftUI 正式打包 | 第三阶段包装能力 |
| 多平台 adapter | 第二阶段只验证一个 adapter |
| 账号池 / 代理池 / 指纹伪装 | 平台滥用风险 |
| 自动评论 / 私信 / 关注 / 批量互动 | 违背 platform-action |
| 自动采购 / 上架 / 广告投放 | Product Signal 只生成候选 |
| 静默云端 AI fallback | 违背 local-ai-runtime |

---

## 4. TODO 总览

| 编号 | 模块 | 目标 | 完成条件 |
|---|---|---|---|
| T00 | 治理基线 | 确认法案与施工图为只读权威 | 无法案缺失、无方向冲突 |
| T01 | 项目基础 | 建立本地工作台运行基础 | 能启动 local console 与 local service |
| T02 | 类型合同 | 建立核心 domain contracts | 类型严格、无 any、schema 验证存在 |
| T03 | 本地数据 | 建立 Evidence Store | 证据、动作、候选可追溯可删除 |
| T04 | 本地 AI | 建立 Local AI Gateway 与 Prompt Registry | 本地 AI 任务结构化，无云端 fallback |
| T05 | 浏览器控制 | 建立 BrowserController | click/scroll/capture 原子能力集中 |
| T06 | 平台适配 | 建立单平台 PlatformAdapter | 平台知识不泄漏到 Core |
| T07 | Agent 主链 | 建立 observe/classify/act/record loop | 单轮闭环可暂停、可停止、可记录 |
| T08 | 评论链路 | 建立 comment capture / OCR / signal | 评论证据绑定视频证据 |
| T09 | 产品候选 | 建立 ProductOpportunityCandidate | 只生成候选，不做商业决策 |
| T10 | 控制台 | 建立 Operator Console | 状态、pause、stop、review、候选池可见 |
| T11 | 安全隐私 | 建立本地边界与禁止外泄检查 | 不公网暴露、不保存敏感凭据 |
| T12 | 验证体系 | 建立测试、审计、验收报告 | 所有 TODO 可证据化通过 |
| T13 | 最终收口 | 清除漂移与未完成项 | TODO 100% DONE，最终报告完整 |

---

## 5. 详细 TODO

### T00 治理基线确认

- [x] T00-01 读取并确认 Kernel、Index、所有 module laws、现有施工图与第二阶段建设目标方案。
- [x] T00-02 建立本轮执行边界说明：第二阶段只做 localhost workbench + 单平台闭环。
- [x] T00-03 确认不得修改法案主权文件，除非发现实现无法遵守现有法案且必须先停下报告。
- [x] T00-04 确认禁止 SaaS、远程浏览器、插件主壳、CLI-only、多平台扩张、云端 AI fallback。
- [x] T00-05 输出一次执行前基线表：当前已有文件、缺失模块、预期交付物。

**完成标准**：Codex 明确本轮只按第二阶段 TODO 执行，且不会把第三阶段能力偷渡进本轮。

---

### T01 本地工作台项目基础

- [x] T01-01 检查当前项目结构与 package 配置，判断是否已有前端 / 服务端基础。
- [x] T01-02 在不违背 code-topology 的前提下建立 localhost operator console 的最小入口。
- [x] T01-03 建立 local agent service 的最小入口。
- [x] T01-04 建立 local runtime health check，能显示 console、agent、local AI、data store、browser controller 的状态。
- [x] T01-05 建立本地启动命令或脚本，能在 Mac 本机启动第二阶段工作台。
- [x] T01-06 明确 console 和 service 仅绑定本地环境，不默认公网暴露。

**完成标准**：本机能够启动本地控制台和本地 Agent 服务；操作者不需要 CLI-only 才能看到主状态。

---

### T02 核心类型合同与 Schema

- [x] T02-01 建立 `TaskRun` / `AgentRound` / `RuntimeStatus` 类型。
- [x] T02-02 建立 `ImageEvidence` / `CommentEvidence` / `EvidenceRef` 类型。
- [x] T02-03 建立 `VisionClassificationResult` 类型与 schema。
- [x] T02-04 建立 `OcrTextResult` / `CommentSignalResult` 类型与 schema。
- [x] T02-05 建立 `ProductOpportunityCandidate` 类型与 schema。
- [x] T02-06 建立 `PlatformActionRequest` / `PlatformActionResult` / `ActionLog` 类型与 schema。
- [x] T02-07 建立 `LocalAiTaskRequest` / `LocalAiTaskResult` 类型与 schema，必须包含 taskType、modelRole、promptVersion、schemaVersion、evidenceRef、confidence。
- [x] T02-08 全项目保持 TypeScript strict、无 `any`、无 `as any`、无隐藏 any。

**完成标准**：所有跨域数据都先有类型和 schema，AI 输出、OCR 输出、平台动作输出不能以 loose object 进入下游。

---

### T03 Local Evidence Store

- [x] T03-01 建立本地 evidence store 的最小持久化方式。
- [x] T03-02 支持保存 video screenshot reference，不要求保存无关全屏截图。
- [x] T03-03 支持保存 comment screenshot reference。
- [x] T03-04 支持保存 OCR text、AI result、ActionLog、ProductOpportunityCandidate。
- [x] T03-05 支持 evidenceRefs 追溯：候选 → AI 输出 → OCR / screenshot → action log。
- [x] T03-06 支持删除候选及其绑定证据。
- [x] T03-07 支持最小导出边界：导出候选摘要与证据引用，不导出 cookie/session/token。
- [x] T03-08 明确本地存储目录或本地数据库位置，不默认云端存储。

**完成标准**：每条产品候选都能回看证据来源，也能被删除；任何结论不能脱离 evidenceRef 存在。

补丁收口补充：已增加 demo store reset 能力与受控导出摘要，`Reset Demo Data / Clear Local Store` 已纳入第二阶段数据本地边界。

---

### T04 Local AI Gateway 与 Prompt Registry

- [x] T04-01 建立 Local AI Gateway 入口，所有 AI 任务必须从这里进入。
- [x] T04-02 建立 Prompt Registry，prompt 必须按 taskType / promptVersion / schemaVersion 管理。
- [x] T04-03 建立 vision product classification prompt contract。
- [x] T04-04 建立 OCR cleanup / comment intent analysis prompt contract。
- [x] T04-05 建立 product signal summary prompt contract。
- [x] T04-06 Gateway 输出必须结构化并经过 schema validation。
- [x] T04-07 本地 AI 不可用时，结果必须进入 retry / skip / operator review，不得 silent cloud fallback。
- [x] T04-08 禁止在 feature 文件、UI 文件、platform adapter 中散落 prompt 字符串或直接模型调用。
- [x] T04-09 测试中可以使用明确标记的 local fixture provider 验证 contract，但不能把 fixture 当生产 AI 真相。

**完成标准**：所有 AI 输出都带 taskType、modelRole、promptVersion、schemaVersion、evidenceRef、confidence；没有任何 paid/cloud API 自动 fallback。

---

### T05 BrowserController

- [x] T05-01 建立 BrowserController 边界，承接 open / scroll / click / screenshotRegion / wait / close 等原子能力。
- [x] T05-02 BrowserController 不承担产品判断、评论理解、候选评分、operator approval。
- [x] T05-03 截图能力必须支持 region capture，避免默认全屏敏感截图。
- [x] T05-04 浏览器会话必须是本机授权环境，不导出 cookie/session/token。
- [x] T05-05 动作失败必须返回结构化错误，不得静默成功。
- [x] T05-06 每个关键浏览器动作能被 ActionLog 记录。

**完成标准**：UI 和 Agent Core 不直接操作裸浏览器 API；所有浏览器动作经过 BrowserController。

---

### T06 单平台 PlatformAdapter

- [x] T06-01 明确第二阶段首个平台 adapter，只做一个平台。
- [x] T06-02 建立 PlatformAdapter 接口：openFeed / observeCurrentVideo / captureVideoRegion / clickNotInterested / likeOrSaveCandidate / openComments / captureCommentRegion / continueNext。
- [x] T06-03 建立一个具体平台 adapter，实现第二阶段最小动作。
- [x] T06-04 平台 selector、DOM 知识、坐标 fallback 只能存在 adapter 内部。
- [x] T06-05 Core 不得直接依赖 Facebook / TikTok / YouTube / Instagram 的 DOM shape。
- [x] T06-06 adapter 的每个动作必须返回 typed result，并能写入 ActionLog。
- [x] T06-07 坐标点击只能是 adapter-internal fallback，不能成为跨域公开动作。
- [x] T06-08 不实现自动评论、私信、关注、批量点赞、账号切换、验证码绕过、风控绕过。

**完成标准**：一个平台 adapter 能承接视频区截图、有限动作、评论区打开与截图；平台差异不污染 Core。

---

### T07 Agent Runtime 主循环

- [x] T07-01 建立 TaskRun 创建与状态流转。
- [x] T07-02 建立单轮 `observe → classify → act → record` 执行链。
- [x] T07-03 每轮必须可暂停、可停止、可记录。
- [x] T07-04 classification 不存在时不得执行平台动作。
- [x] T07-05 低置信度进入 skip / operator review。
- [x] T07-06 高风险动作进入 operator review。
- [x] T07-07 每轮有最大步数、停止条件或人工接管点，不允许无限循环。
- [x] T07-08 Agent 不得自行扩展到额外平台、账号、页面、任务目标。

**完成标准**：Agent 能完整执行一轮，并留下可追溯记录；暂停、停止、失败、review 状态都可见。

---

### T08 评论截图、OCR 与评论信号

- [x] T08-01 产品候选视频触发 openComments。
- [x] T08-02 captureCommentRegion 生成 CommentEvidence。
- [x] T08-03 OCR 结果进入 OcrTextResult，标注 confidence / uncertainText。
- [x] T08-04 OCR 文本清洗后才能进入 CommentSignal。
- [x] T08-05 CommentSignal 输出购买意图、痛点、质疑、需求词。
- [x] T08-06 评论分析不得保存不必要个人身份信息。
- [x] T08-07 不得根据评论建立个人画像或追踪个人。
- [x] T08-08 OCR 失败或低置信度时进入 review，不得编造评论。

**完成标准**：评论证据能绑定视频证据，评论信号能绑定 OCR 证据，不存在编造评论或个人画像。

---

### T09 产品机会候选

- [x] T09-01 基于 video evidence、vision result、comment evidence、comment signal 生成 ProductOpportunityCandidate。
- [x] T09-02 候选记录必须包含 category、useCase、sellingPoints、painPoints、purchaseIntent、risk、evidenceRefs。
- [x] T09-03 候选评分必须可解释，不把 views 当 sales，不把 likes 当 purchase intent，不把单视频当趋势。
- [x] T09-04 风险与质疑必须和正向需求一起保存。
- [x] T09-05 Product Signal 只输出 candidate，不输出采购、上架、广告投放决定。
- [x] T09-06 候选默认进入 review pool。

**完成标准**：系统能生成可复核的产品机会候选；候选不是最终商业结论。

---

### T10 Operator Console

- [x] T10-01 控制台显示 local runtime health。
- [x] T10-02 控制台支持 start / pause / stop。
- [x] T10-03 控制台显示当前 TaskRun、AgentRound、ActionLog。
- [x] T10-04 控制台显示候选池。
- [x] T10-05 控制台能打开候选详情，查看 video evidence、comment evidence、AI result、action logs。
- [x] T10-06 控制台支持候选 approve / reject / hold / note。
- [x] T10-07 控制台支持删除候选及绑定证据。
- [x] T10-08 UI 不直接调用浏览器 automation、AI model、数据库真相；必须走对应边界。

**完成标准**：操作者能通过本地控制台完成状态查看、任务控制、证据复核、候选处置。

补丁收口补充：根页面必须明确显示 `Data Mode: Fixture Demo / Local Store`、`Platform: fixture-platform-web`、`Real Platform: Not connected`，并提供 `Reset Demo Data / Clear Local Store`。

---

### T11 安全隐私与本地边界

- [x] T11-01 确保 local console / agent service 默认不公网暴露。
- [x] T11-02 日志不得打印 cookie、session、token、password、authorization header。
- [x] T11-03 本地截图不得默认保存全屏敏感区域。
- [x] T11-04 不读取浏览器密码，不导出 cookie/session/token。
- [x] T11-05 不采集私信、非公开页面、账号隐私数据。
- [x] T11-06 不绕过登录、验证码、风控、反自动化机制。
- [x] T11-07 任何外部 API 调用必须被审计；默认不得出现 paid/cloud AI 调用。
- [x] T11-08 数据删除必须真实删除本地 evidence linkage，而不是只隐藏 UI。

**完成标准**：安全隐私边界可检查；没有敏感凭据外泄、远程托管、本地服务公网暴露。

---

### T12 验证体系与交付报告

- [x] T12-01 建立类型检查命令并通过。
- [x] T12-02 建立 lint 或等价静态检查并通过。
- [x] T12-03 建立单元测试覆盖核心 schema、local AI gateway、evidence store、agent runtime、adapter contract。
- [x] T12-04 建立最小本地运行验证：console + service 可启动。
- [x] T12-05 建立主链演示验证：至少通过受控本地 fixture 页面或人工授权页面完成一轮闭环。
- [x] T12-06 验证没有 SaaS、remote browser、cloud AI fallback、插件主壳、多平台扩张。
- [x] T12-07 输出第二阶段验收报告，对照建设目标方案逐项说明 PASS / FAIL。
- [x] T12-08 FAIL 项必须修复后重新验证，不得保留为“下一阶段”。

**完成标准**：验证报告证明第二阶段主链真实闭合；不是只写代码、不跑验证。

补丁收口补充：验证体系必须额外覆盖 demo/store 隔离、non-product 视频不进入 candidates、demo 结果确定性、reset 后 root page 清空脏候选。

---

### T13 最终收口

- [x] T13-01 搜索并清除未完成占位：TODO、FIXME、HACK、XXX、临时假通过。
- [x] T13-02 搜索并确认无 `any` / `as any` / hidden any escape。
- [x] T13-03 搜索并确认无云端 AI fallback、API key、paid AI SDK 偷渡。
- [x] T13-04 搜索并确认无 proxy pool、account pool、fingerprint spoofing、captcha bypass。
- [x] T13-05 搜索并确认无 Electron / Tauri / SwiftUI 业务壳提前建设。
- [x] T13-06 确认 TODO 清单全部勾选完成。
- [x] T13-07 输出最终完成报告：修改文件、删除文件、验证命令、验收矩阵、风险清零情况。
- [x] T13-08 最终报告必须声明：第二阶段 TODO 100% 完成，否则不得结束。

**完成标准**：所有 TODO 项均为 DONE，所有验证通过，第二阶段目标达成。

---

## 5.1 第二阶段补丁收口

- [x] P2-01 非产品 fixture 视频 `video_non_product_001` 不得生成 product opportunity candidate。
- [x] P2-02 根页面必须显示当前数据模式：`Fixture Demo` 或 `Local Store`。
- [x] P2-03 根页面必须显示 `Platform: fixture-platform-web` 与 `Real Platform: Not connected`。
- [x] P2-04 控制台必须提供 `Reset Demo Data` 与 `Clear Local Store`。
- [x] P2-05 `Run Demo` 必须从干净 demo store 启动，不得复用脏历史候选池。
- [x] P2-06 自动化验证必须覆盖 demo 隔离、reset 清空、non-product candidate exclusion 与 root page 可见性。

**完成标准**：第二阶段补丁不进入第三阶段，但必须把数据干净性、demo/真实数据隔离与 reset 能力固化到代码、测试、审计和报告中。

---

## 6. 最终验收矩阵

| 验收对象 | 必须通过 | 证据 |
|---|---|---|
| Local Workbench | Console + Agent Service 本地可启动 | 启动命令与结果 |
| Single Platform Loop | 单平台完成最小闭环 | 主链演示记录 |
| Local AI | Gateway + Prompt Registry + Schema Validation | 测试与输出样例 |
| No Cloud Fallback | 本地失败不转云端 | 搜索结果与失败路径测试 |
| Evidence Store | 候选可追溯可删除 | 本地记录与删除验证 |
| Operator Review | 候选可 approve/reject/hold/note | 控制台验证 |
| Platform Boundary | Core 无 selector / 坐标 / 平台 DOM | 搜索与代码审查 |
| Security Privacy | 无 cookie/session/token 外泄 | 搜索与日志检查 |
| Scope Control | 无 SaaS / 插件主壳 / 多平台 / 桌面打包 | 文件与依赖检查 |
| Type Safety | strict、无 any、schema 明确 | 类型检查与搜索 |

---

## 7. 退出条件

Codex 只能在以下条件全部满足后结束：

1. 本 TODO 文档中所有 checkbox 全部完成。
2. 第二阶段建设目标方案中的验收标准全部 PASS。
3. 本地工作台主链真实闭合。
4. 没有第三阶段能力偷渡。
5. 没有无法案依据的实现。
6. 没有假 PASS、假完成、假数据真相。
7. 最终完成报告完整输出。

如果任何一项未完成，Codex 必须继续修复、验证、更新 TODO，不能结束任务。
