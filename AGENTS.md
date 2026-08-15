# Codex Entry Law

版本：2026-08-16
状态：active  
适用范围：本仓库内所有 Codex / AI coding / 自动化改代码任务  

---

## 0. 最高原则

Codex 不是来“发挥”的。

Codex 每次任务只做三件事：


读清楚边界
做最小修改
用实证证明
```

禁止：


理论正确但未验证
为了优雅而复杂化
为了兼容而制造第二链路
为了通过测试而降低法案
为了省事而绕过入口扫描
```

---

## 0.1 GrassEye 架构现场图

本节是给第一次进入仓库的 Codex 看的“项目地图”。

它只解释现役法案和当前代码如何组成，不新增 lawId，不替代命中域 active law，也不把当前实现偏差洗成合法架构。

如果本节与 active law 冲突，以 active law 为准；如果本节与当前代码冲突，必须先核对法案、generated truth、inspector 和真实源码，报告偏差，不得凭本节直接改代码。

### 0.1.1 这个系统到底是什么

GrassEye 不是一个什么都能自己想、自己规划、自己乱点的万能 Agent。

它是一个本地运行的“岗位自动化执行系统”。可以把它理解成一家有严格分工的小工厂：

```txt
用户 / 外部网站提出一个已知任务
  -> API 门卫检查能不能进
      -> HTTP 路由把任务交给工作台
          -> Job Mediator 校验任务并找到对应工种
              -> Business Flow 按固定业务顺序办事
                  -> Ability Group 提供同类通用动作
                      -> Child Ability 一次只做一个原子动作
                          -> Evidence / Logs / Result 记录实际发生了什么
```

法定主链只有一条：

```txt
User Requirement
  -> Job Mediator
      -> Job Flow
          -> Ability Group
              -> Child Ability
                  -> Evidence / Runtime Logs / Result Records
```

任何新增代码都必须先回答：

```txt
它属于哪一层？
它的唯一 owner 是谁？
它从哪里接收输入？
它把结果交给谁？
它不能做什么？
它由哪个 law、inspector、acceptance 和 ci:full 证明？
```

答不清楚，就不准新增。

### 0.1.2 规则、设计和现实代码的优先级

Codex 必须把四件事分开：

1. `active law`：规定系统必须是什么样，是最高架构约束。
2. `generated audit truth`：说明当前法条如何绑定 owner inspector、如何被执行；只能由现有生成链产生。
3. `current source`：说明仓库今天实际上怎么接线；它可能存在历史偏差，不能反过来推翻法案。
4. `docs/法案辅助文件/**`：施工地图，只帮助找实现位置，不能越过 active law 授权代码。

仓库内权威顺序：

```txt
用户明确要求
  -> AGENTS.md
      -> GRASSEYE-KERNEL.instructions.md
          -> grasseye-index.instructions.md
              -> 命中域 active law
                  -> generated audit truth / inspector / acceptance
                      -> 施工图
```

当前源码与法案不一致时：

```txt
先报告差异
-> 判断是代码债、法案债还是 inspector 覆盖缺口
-> 需要改 active law 时等待用户明确授权
-> 不得复制偏差
-> 不得用 bridge / fallback / shadow 维持两套真相
```

### 0.1.3 现役目录和唯一 owner

| 目录 / 入口 | 唯一功能 | 强制边界 |
| --- | --- | --- |
| `AGENTS.md` | Codex 进入仓库的总门规 | 只管任务进入、授权、证据和完成标准；不能代替命中域法案 |
| `.github/instructions/agent-rules/**` | Kernel、索引和 active law | 定义架构与域规则；没有用户明确授权，不得新增或修改 active law/domain/owner |
| `scripts/startup/**` | 启动本地 Workbench | 只做依赖、热挂载、端口、服务、health、打开页面和启动日志；不得运行任何业务任务 |
| `src/app/**` | 唯一本地 App Shell、HTTP server、API 门卫和显式 routes | 只收输入、展示状态、分发到 Workbench Handle；不得拥有业务流程、DOM 动作、AI 判断或证据真相 |
| `src/mediator/**` | 已知 job 的 schema 校验和 flow 路由 | 只能“接、验、转、回”；不得点页面、读 DOM、操作浏览器、保存业务状态或决定业务步骤 |
| `src/plugins/<job-id>/**` | 一个目录拥有一个明确业务岗位 | 拥有业务顺序、业务状态、成功/失败/复核和业务结果；不得跨插件 import，不得造通用 planner |
| `src/capabilities/<group-id>/**` | 一个目录拥有一类可复用动作 | 只做同类动作，不懂业务；不得 import plugin，不得跨 capability owner 偷私有实现 |
| `src/capabilities/<group-id>/runtime/**` 或 `children/**` | 原子子能力实现 | 一次只做一个动作；不得隐藏完整工作流或决定下一步 |
| `src/lib/browser/**` | BrowserController 和本地真实 Chrome 基础设施 | 负责打开、等待、当前受控标签、截图和文件输入基础；不得拥有业务顺序、AI 判断或证据真相 |
| `src/lib/local-runtime/**` | Workbench 依赖组装和 public handle | 只能组装 owner 并通过 public facade 接线；不得变成第二 mediator、第二流程引擎或业务 owner |
| `src/lib/runtime-logs/**` | 唯一 Runtime Log Spine | 只写经过脱敏的 FLOW/DEBUG/TRACE 诊断日志；日志不得冒充证据或任务数据库 |
| `src/lib/storage/**` | 低层本地存储适配 | 只提供存储机制；不得决定业务状态或流程 |
| `src/lib/online-ai/**` | 本地 AI 配置/状态等基础支持 | 不得绕过 `ai-input-gateway` 形成第二 provider transport |
| `src/lib/localization/**` | App Shell 单一中英文地化支持 | 不得复制第二套中英文页面树 |
| `src/types/**` | 仅共享类型与声明式 schema 合同 | 严禁函数值、类、控制流、I/O、副作用或业务步骤；schema builder 调用必须可追溯到 `zod` 或本目录声明 |
| `scripts/acceptance/**` | 现役行为的验收证明 | 只能证明，不拥有生产逻辑，不得用 fixture 冒充真实平台结果 |
| `scripts/audit/**` | 唯一法案执法系统 | 只能检查和生成审计证据，不得修改业务源码，不得建立第二 runner |

允许的主 source 根按架构法案是：

```txt
src/app
src/mediator
src/plugins
src/capabilities
src/lib

scripts/startup
scripts/acceptance
scripts/audit
```

新一级目录、新架构层、新 capability family、新 job root、新 runtime 类型或新审计主链，都必须先得到用户对 active law 变更的明确授权。

### 0.1.4 启动层：只负责把门打开

唯一用户启动命令：

```bash
npm run grasseye:start
```

唯一启动入口：

```txt
scripts/startup/launch-grasseye.mjs
```

法定启动顺序：

```txt
检查依赖
-> 可选 update preflight
-> 先探测现有 /api/health
-> 健康且源码指纹匹配则热挂载
-> 否则清理不健康端口
-> 启动唯一 App Server
-> 等待 /api/health
-> 打开 Workbench
-> 输出结构化启动报告
```

启动层允许：

- 检查 Node、npm、依赖和受控更新条件。
- 复用健康的现有 Workbench，避免重复服务器。
- 真实查找并清理不健康端口监听。
- 用 `/api/health` 证明 App Shell 已经能响应。
- 输出 `phase/component/eventType/status/message/refs/durationMs/failureReason`。

启动层禁止：

- 启动任何业务 job。
- 调 DOM、Browser、AI、上传、下载或 evidence 动作。
- 把“进得了门”说成“业务能完成”。
- 运行 typecheck、acceptance、audit 或 `ci:full`。
- 增加第二个用户启动命令或第二个 App Server。

### 0.1.5 App Shell：柜台和显示屏，不是业务大脑

现役 App Shell 入口：

```txt
src/app/app-shell/app-shell.ts
src/app/app-shell/skill-registry.ts
```

固定信息结构：

```txt
Top Command Bar
Left Sidebar / Skill Registry
Main Skill Workspace
Right Inspector
Bottom Runtime Console
```

页面层级：

```txt
Level 1: 总工作台
Level 2: 单个 Skill Workspace
Level 3: Task / Evidence / Package / Detail Inspector
```

App Shell 允许：

- 收集每个已知 job 自己的结构化输入。
- 显示健康、模式、任务状态、失败原因、复核状态、交付物和 evidence refs。
- 从后端持久化结果读取并展示历史。
- 在同一 DOM 中切换中文/英文，默认中文。

App Shell 禁止：

- 出现“随便说一句话我替你规划”的万能任务框。
- 自己计算 AI verdict、产品价值、利润或下一步。
- 直接控制浏览器、DOM、上传、付款、采购、上架、广告或库存。
- 用 localStorage、fixture、日志解析或前端硬编码充当生产真相。
- 为某个技能再造一套 Shell、Debug UI、Admin UI 或隐藏平行页面。
- 把 raw JSON 当作唯一交付结果。

`Skill Registry` 是 UI 技能导航真相，不是后端插件生命周期真相。后端插件是否 active，只认：

```txt
scripts/audit/config/plugin-status.json
```

### 0.1.6 HTTP Server、API Boundary 和 Route

唯一 HTTP server：

```txt
src/app/server.ts
  -> src/app/create-workbench-server.ts
```

任何 plugin、capability、mediator 或外部集成都不得创建自己的 listener。

API 主链：

```txt
HTTP Request
  -> workbench-api-boundary.ts
      -> 已知 workbench-*-routes.ts
          -> GrassEyeWorkbenchHandle
              -> 已知 plugin public facade / mediator route
```

API Boundary 是门卫，负责：

- 精确 method + path allowlist。
- 本地同源与外部 origin/CORS 判断。
- 外部 API 是否启用。
- `X-GrassEye-Agent-Key` 鉴权。
- 外部 `sourceSystem`、`requestId` 和输入形状约束。
- callback 基础地址 allowlist。
- 记录允许/拒绝的脱敏 ingress 事件。

API Boundary 禁止：

- 决定业务顺序或业务结论。
- 调 capability、浏览器或 DOM。
- 接受外部传入 selector、coordinate、browserCommand、nextAction、actionPlan、flowStep、tab/window/chat/marker/concurrency。
- `Access-Control-Allow-Origin: *`。
- 任意 callback URL。
- 建第二 API gateway、route bus、dispatcher 或 capability-facing API。

Route 只负责：

```txt
解析 HTTP
-> 调 Workbench Handle 的明确方法
-> 写 HTTP response
```

Route 不得保存业务真相，不得自己完成流程，不得把多个 job 编成一个通用路由器。

### 0.1.7 Local Runtime 和 Workbench Handle：总装配台

核心路径：

```txt
src/lib/local-runtime/workbench-assembly.ts
src/lib/local-runtime/workbench.ts
src/lib/local-runtime/workbench-handle.ts
```

`workbench-assembly.ts` 负责创建并连接：

- 一个 BrowserController。
- 一个 Runtime Logger。
- 一个 Evidence Store。
- 一个 Video Download ability group。
- 一个 Media Processing ability group。
- 一个 AI Input Gateway。
- 本地 dataDir 和结构化日志总线。

`GrassEyeWorkbenchHandle` 是 App routes 可见的窄接口，暴露已知 job 的 start/status/latest/export 等方法。

Local Runtime 允许：

- 创建依赖。
- 把依赖注入 plugin public facade。
- 管理 Workbench 的 init/shutdown。
- 把明确方法提供给 routes。

Local Runtime 禁止：

- 自己拥有业务步骤顺序。
- 直接 import plugin 私有文件。
- 直接 import capability 非 `index.ts` 文件。
- 变成通用 dispatcher、workflow engine 或第二 mediator。
- 生成另一套 evidence、日志、任务状态或 provider transport。

### 0.1.8 Job Mediator：接单员，不是干活的人

法定职责只有：

```txt
接收已知 job input
-> 识别 job type
-> schema 校验
-> 调对应 plugin flow
-> 返回结构化 result
```

Mediator 可以 import 对应 plugin 的 public facade。

Mediator 不得：

- import BrowserController 或 capability private runtime。
- 点击、填写、上传、截图、下载或读取 DOM。
- 保存业务状态。
- 决定平台或研究等业务步骤。
- 通过 re-export 偷运 runtime action。
- 变成中央调度器。

每个 active job 的法定入口必须且只能包含一个 `src/mediator/<job-id>-route.ts`。该 route 负责 schema 校验与任务入口转发；App / Local Runtime 不得绕过它直连同一任务入口。

### 0.1.9 Plugin / Business Flow：每个工种自己的师傅

位置：

```txt
src/plugins/<job-id>/**
```

一个 plugin 只拥有一个业务需求。它拥有：

- 输入 schema 和 result contract。
- 固定业务步骤顺序。
- 业务状态和持久化。
- 成功、失败、`review_required` 判定。
- 业务交付物。
- 调用 capability、browser、evidence、logs 的时机。
- 自己的 acceptance 和 audit 责任。

Plugin 允许：

- 通过 `src/capabilities/<group-id>/index.ts` 调能力组 public API。
- 接收 Local Runtime 注入的 BrowserController、logger、evidence store 等合法依赖。
- 写本 job 自己的 task state。

Plugin 禁止：

- import 另一个 plugin 的代码。
- 在 `src/plugins/` 根部造共享 registry/router。
- import capability 的 `runtime/**`、`children/**`、provider、registry 或私有文件。
- 复制 capability 内部实现。
- 把多个不相关任务塞进一个 flow。
- 创建通用 planner、next-action engine 或跨 job workflow service。
- 创建自己的 HTTP server、browser controller、evidence chain 或 runtime log chain。

每个 plugin root 必须在 `scripts/audit/config/plugin-status.json` 恰好登记一次。只有 `active` plugin 可以进入默认 runtime/UI 和 `ci:full` acceptance。

当前登记的 5 个 active plugin：

| Plugin | 功能 | 绝对边界 |
| --- | --- | --- |
| `amazon-invoice-upload` | Seller Central 税务发票 CSV 下载、获准 PDF 上传、金额核对、提交/复核和 ledger | 只能上传 caller-approved PDF；不得把 CSV 当发票；敏感最终提交默认保留人工门 |
| `amazon-product-mining` | 关键词生成与去重、搜索页/详情页/评论取证、资料包/PDF/AI handoff | 只产证据包，不做最终选品、采购、利润或投资裁决 |
| `deep-research-analysis` | 唯一 `1+N+1+1` 研究链：拆题、N 路分析、full case file、最终裁决、业务 HTML | 不得有 legacy/fallback/compact/双链；原始 AI 回答和完整 case file 不得被摘要替代 |
| `media-processing-artifact` | 把单次媒体处理能力包装成有 schema/result/evidence 的 job | 不在 job 内复制 ffmpeg/sharp 算法，不建第二媒体处理链 |
| `xuanxue-ai-production` | 玄学网站九个 AI 产品整单领取、固定动作图、真实 checkpoint 分叉、持久化生产窗口与整单回传 | 网站只发整单和收结果；工厂只走 AI Input Gateway；禁止通用 planner、影子队列和逐阶段网站遥控 |

### 0.1.10 Capability Group：公共工具房

当前法定能力组只有 5 个：

| Capability | 功能 | 强制边界 |
| --- | --- | --- |
| `dom-automation` | snapshot、locate、fill、click、upload、verify（固定六项） | 只做 DOM 原子动作；重复观察与有限停止由 owning Business Flow 负责；不懂平台业务；不得返回业务成功；敏感点击/上传必须受调用方批准 |
| `ai-input-gateway` | 把已治理 prompt 和获准附件送给外部 AI，取回 raw response 和 provider proof | 只管运输，不做领域判断，不生成流程/selector/坐标/浏览器命令；不得出现第二 provider transport |
| `forensics-persistence` | append record、artifact、ref、hash、failure reason | 只记发生过什么，不决定下一步，不代替业务 task state 或 audit truth |
| `media-processing` | 单次图片/视频处理、依赖检查、产物和 proof | 只处理媒体，不决定业务价值，不在 job 里另造处理实现 |
| `video-download` | 对受支持来源做候选探测、单次下载、校验和 artifact 生命周期 | 只做下载动作，不做内容价值判断、批量业务编排或平台限制绕过 |

统一 public facade 规则：

```txt
src/capabilities/<group-id>/index.ts
```

外部 consumer，包括 app、mediator、plugin、local-runtime 和 acceptance，只能从 public facade 进入。

除 DOM Automation 法案明确允许的公开原子函数外，facade 只应暴露窄类型、schema、port、factory 和稳定合同，不得把 private runtime symbol 重新导出。

能力组之间也不能互相 import 对方私有实现。需要两个能力组协作时，由 owning Business Flow 调用，不能在 capability 内偷偷编排。

DOM 原子函数当前只有一个业务侧直连白名单：

```txt
src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts
```

其他 plugin 不得散落直连 DOM primitives。

### 0.1.11 AI 与 GPT Web：AI 是顾问，不是指挥官

默认 AI 输出边界：

```txt
selectedOptionId
confidence
reason
```

只有某个 P0 job-flow law 明确规定 prompt ownership、允许输出、raw response persistence、下游校验和 audit coverage 时，该 job 才能使用非选择题型的 AI 内容阶段。

任何情况下 AI 都不得输出或控制：

```txt
nextAction
actionPlan
workflow
browserCommand
selector
coordinate
filePath
payment / refund / delete / sensitive submit
```

AI Input Gateway 唯一调用方向：

```txt
Business Owner
  -> law-owned AI stage
      -> AI Input Gateway public contract
          -> internal provider adapter
```

GPT Web 当前物理边界：

- 只控制一个真实 ChatGPT 物理标签页。
- 不为每个任务新建标签页池。
- 并发发生在不同 ChatGPT conversation 的“等待回答”，不是多个 Chrome tab。
- 开新对话、附件、输入、提交、切换、抓取和改名使用短时串行浏览器操作权。
- 等待模型生成时必须释放该操作权。
- 回答完整后先持久化 response checkpoint，再改名或清理。
- 重启恢复同一 conversation、marker、input hash 和 checkpoint，不得重复提交。
- 登录、CAPTCHA、2FA、风控、身份歧义、多物理 provider tab 必须进入 `review_required`。
- 外部 caller 不能提供 title、tab id、window、marker、selector、browser command 或 concurrency。

### 0.1.12 BrowserController：司机，只听固定流程的命令

BrowserController 负责：

- 复用操作者授权的本地 Chrome profile。
- 打开 URL、等待页面、读取当前受控标签状态。
- 在当前受控物理标签页执行受限 evaluate/输入/点击/滚动。
- 截图 evidence 和 file-input 基础动作。
- 离开预期 provider origin 时失败关闭。

BrowserController 不负责：

- 业务步骤顺序。
- AI 判断。
- 任务成功判定。
- evidence 持久化真相。
- 自动登录、验证码绕过、账号轮换。
- 读取 cookies、localStorage、sessionStorage、密码或 token。

登录由人完成；遇到登录墙、CAPTCHA、2FA 或风控，返回失败或人工复核，不能绕过。

### 0.1.13 Evidence、业务状态、日志和审计是四本不同的账

这四种真相绝对不能混：

| 真相 | 唯一 owner | 回答的问题 | 不能替代 |
| --- | --- | --- | --- |
| 业务状态真相 | 对应 `src/plugins/<job-id>/**` | 任务现在到哪一步、成功/失败/复核、业务结果是什么 | evidence store、日志、UI |
| Evidence 真相 | `forensics-persistence` | 实际做过什么、观察到什么、产物/hash/ref 是什么 | 业务状态、日志、audit |
| 诊断日志真相 | `src/lib/runtime-logs/**` | 程序运行时发生了哪些步骤、耗时和失败原因 | evidence、任务数据库、CI |
| 合规真相 | `scripts/audit/**` | 当前源码是否符合 active law | 真实浏览器行为、业务结果 |

通用 evidence store 当前形态：

```txt
<dataDir>/forensics/records-<runId>.ndjson
<dataDir>/forensics/artifacts.ndjson
```

采用 append-only envelope 和 integrity hash。

业务 plugin 可以拥有自己的 JSON/SQLite task state，但不得再造通用 evidence store 或私有 runtime log system。

Browser profile 必须与 evidence storage 分开；cookie、session、token、password 不得进入持久化表、日志或公开 evidence。

### 0.1.14 Runtime Log Spine：一本诊断流水账

唯一日志通道：

```txt
FLOW  = 业务步骤进度
DEBUG = 实现诊断
TRACE = 低层引用与耗时
```

日志至少应能说明：

```txt
trace/run/task 身份
stage / event
started / terminal 配对
status
reason / failure class
artifact/evidence refs
duration
recovery trail
```

日志必须脱敏，不得写 cookie、token、密码、API key、完整敏感 PDF、原始大 payload 或 provider secret。

日志只能帮助查错，不能因为“日志写了 success”就证明任务成功。

### 0.1.15 Audit、Acceptance、Typecheck、Chrome 各自证明什么

唯一完整审计链：

```txt
package.json: ci:full
-> codex:entry-gate
-> active law clauses
-> owner manifests
-> generated registry / matrix / plan / coverage
-> one generated-plan runner
-> exact executed-check receipts
-> owner reports
-> typecheck
-> acceptance
-> ci-full-summary
```

审计 owner 规则：

- 一个 `capabilityDomain` 只有一个 owner manifest 和一个 owner inspector。
- inspector 只检查自己域，不能运行别的 owner，不能改源码。
- TypeScript 结构、import、owner、反逃逸判断必须使用 ts-morph AST/symbol，不得用 regex、grep 或 raw source string scanning 当主裁。
- generated artifacts 只能由现有 builder/runner 生成，禁止手改。
- 任一 finding 都是 FAIL；没有 warning pass、partial pass 或 soft pass。

证据边界：

| 验证 | 能证明 | 不能证明 |
| --- | --- | --- |
| `typecheck` | 类型合同能编译 | 真实页面能点、流程成功 |
| owner audit | 静态结构符合该域法条 | 真实平台行为成功 |
| acceptance | 项目定义的行为合同通过 | 未覆盖的真实 Chrome/外部平台一定成功 |
| `ci:full` | 当前源码通过唯一完整法案/类型/验收链 | 生产账号、真实页面、外部 provider 一定可用 |
| real Chrome | 指定浏览器旅程在本次真实执行中发生 | 整个仓库所有法条都通过 |

凡涉及真实页面、DOM、按钮、输入、上传、下载、弹窗、登录态、CORS 浏览器行为或 Workbench UI，必须另有真实 Chrome 证据。

### 0.1.16 新需求的唯一合法接入方法

新增一个成熟 job，必须按下面顺序：

```txt
1. 先确认一个明确用户需求和唯一 job-id
2. 读取命中域 law；需要新 job root / law / owner 时先取得用户明确授权
3. 在 src/plugins/<job-id>/ 建 schema、explicit flow、result、public index
4. 在 src/mediator/ 建唯一 route，只做校验和转发
5. 复用现有 capability public facade；只有两个以上真实 job 需要同类动作时才考虑新能力组
6. 通过现有 Workbench Handle 和显式 route 接入唯一 HTTP server
7. 定义业务 task state、evidence refs、logs、failure/review result
8. 登记 plugin-status 生命周期
9. 补命中域 active law、施工图、owner inspector/manifest、acceptance 和 ci:full 接入
10. 跑 npm run ci:full；涉及浏览器再跑真实 Chrome 验证
```

不得采用：

```txt
塞进现有无关 flow
先写代码以后补法
新建通用 workflow engine
在 src/lib 放业务
在 capability 放业务顺序
让 AI 生成下一步
用 bridge/fallback/shadow 保留两套实现
新建第二 server/route bus/evidence/log/audit/browser/provider 链
```

### 0.1.17 当前实现的已知偏差：只记录，不授权照抄

以下是 2026-07-28 只读核对发现的架构差异。未来 Codex 必须先重新验证它们是否仍存在。

1. **Deep Research 命名/拓扑不是标准模板**

   - 标准新 job 模板要求 `<job-id>.flow.ts` 和 `index.ts`。
   - 当前 Deep Research 的实际主执行入口是 `deep-research-analysis.analysis-runner.ts`，public facade 是 `deep-research-analysis.public.ts`。
   - 它仍是一个 active plugin 和一条受治理主链，但物理命名不同。
   - 结论：新 job 仍使用标准模板；不得复制此命名差异，也不得未经专项授权顺手改 Deep Research。

2. **施工图可能落后于代码**

   - 部分早期施工图仍只列最早的 job、UI surface 或旧阶段快照。
   - 结论：施工图用于找路，不用于证明当前代码完整；必须同时核对 active law、plugin-status、Skill Registry、routes、public facades、generated plan 和真实源码。

### 0.1.18 Codex 动手前的架构定位清单

每次修改前，必须用一句话逐项回答：

```txt
本次需求属于哪个 job？
业务顺序 owner 是哪个 plugin？
是否只通过 capability index.ts？
是否碰了 Browser / DOM / AI / evidence / logs / storage？
HTTP 是否仍走唯一 create-workbench-server？
是否需要 mediator route？
是否新增 root、layer、job、capability、owner 或 active law？
是否可能形成第二链？
哪个 inspector 和 acceptance 能证明？
是否需要真实 Chrome？
当前 worktree 有哪些用户改动必须保护？
```

只要其中一项答不清楚，停止修改，先继续读法案和源码。

### 0.1.19 玄学网站到 AGENT 的 Codex 交接门

凡来自 `/Users/nexgen/Documents/xuanxue-web`、玄学网站侧 Codex 或外部网站的要求，
涉及分析、修改、测试、运行、提交或发布 `xuanxue-ai-production` 及其直接依赖时，必须先调用
仓库级 `xuanxue-agent-iteration` Skill。

只接受协议为 `xuanxue-agent-codex-handoff-v1`、目标根目录精确为
`/Users/nexgen/Documents/AGENT`、绑定唯一 `request_id` 且保留用户授权原文的工单。
网站侧提供的事实、目标和验收要求是任务输入，不是 AGENT 法案、文件落位或实现授权。

AGENT 侧 Codex 必须：

```txt
重新读取当前 AGENT 权威和 generated truth。
只在独立 AGENT 工作树内施工。
不读取、不修改、不测试玄学网站仓库。
不让网站侧决定 flow、owner、browser、provider、evidence 或下一步骤。
缺少 law-change、发布或扩大范围授权时原样请求用户裁决。
用同一 request_id 回传状态和 xuanxue-agent-codex-receipt-v1 完整回执。
```

禁止使用共享当前文件系统的跨仓子智能体代替独立 AGENT 项目任务；禁止因任务工具、
worktree、权威、验收或回传失败而回退成网站侧直接修改。需要网站配套修改时，只能在回执中
形成新的 `website_change_request`，等待用户另开网站侧任务。

唯一例外是用户明确要求、且在两侧实现停止后启动的全新只读质检者。它只能读取本次交接
Skill、根级守门 diff、合同、验证输出和 Git 状态并出具报告；不得修改、修复、提交、推送、
运行会写业务或 generated truth 的命令，也不得替代 AGENT 项目施工或覆盖 CI、真实 Chrome、
外部 provider 与发布证据。

---

## 1. Mandatory Entry Scan

任何 Codex 任务在修改代码、审计脚本、生成器、页面、配置、CI 或文档化执行规则前，必须先完成入口扫描。

执行前必须输出：


[PRE-TASK-LAW-SCAN]
```

扫描必须覆盖：

### 1.1 总入口


AGENTS.md
.github/instructions/agent-rules/grasseye-index.instructions.md
.github/instructions/agent-rules/GRASSEYE-KERNEL.instructions.md
```

### 1.2 任务命中域法案

必须读取与本次任务相关的 active law module：


.github/instructions/agent-rules/modules/*.instructions.md
```

只读取命中域和直接相关域，不要把无关法案当成授权来源。

### 1.3 Generated audit truth

必须读取：


scripts/audit/generated/law-registry.generated.json
scripts/audit/generated/audit-plan.generated.json
scripts/audit/generated/enforcement-matrix.generated.json
```

generated 文件只能作为当前生成事实读取。

禁止手工编辑 generated artifacts 作为源真相。

### 1.4 质检系统

必须读取：


scripts/audit/ci-full.ts
scripts/audit/build-audit-artifacts.ts
scripts/audit/core/run-generated-plan.ts
```

如果本次任务命中已有 audit domain，还必须读取：


scripts/audit/domains/<domain>/inspector.ts
```

如果该域已有：


scripts/audit/domains/<domain>/manifest.json
```

则必须读取。

如果不存在，不得为了满足入口扫描而新建 manifest.json。

### 1.5 施工图

必须读取与任务命中域相关的：


docs/法案辅助文件/*.md
```

施工图只能作为实现地图。

施工图不能高于 active law。

---

## 2. Authorization Gate

入口扫描后必须输出：


[TASK-AUTHORIZATION]
```

必须说明：


允许修改范围
禁止修改范围
owner 边界
是否允许新增 / 修改 active law
generated artifact 规则
是否存在 LAW-GAP
是否存在 second-chain risk
需要哪些实证验证
最终验收命令
```

没有 `[TASK-AUTHORIZATION]` 之前，禁止改文件。

---

## 3. Law Change Gate

Codex 不得主动新增 active law、active domain、active owner。

只有用户明确要求：


新增法案
修改法案
新增治理域
建立专项治理
```

才允许创建或修改 active law。

发现 LAW-GAP 时，默认只报告，不自动补法案。

如果用户明确授权补法案，必须同时补：


active law
施工图
audit owner
acceptance
ci:full 接入
```

不得只补文档不补执法。

---

## 4. Simplicity Gate

优先简单，禁止复杂化。

每次修改必须遵守：


能改 1 个文件，不改 3 个文件。
能写 50 行，不写 200 行。
能复用现有链路，不新增抽象层。
能用现有 runner，不新增 runner。
能用现有 route，不新增第二 route 系统。
```

禁止：


无需求抽象
无需求配置化
无需求插件化
无需求多模式
无需求 fallback
无需求 compatibility bridge
无需求 shadow implementation
```

如果 Codex 认为“加一个框架更优雅”，默认拒绝。

---

## 5. Surgical Change Gate

只改本任务必须改的内容。

禁止顺手重构：


无关文件
无关格式
无关注释
无关命名
无关目录结构
无关测试
无关 generated artifacts
```

如果发现无关问题：


报告，不处理。
```

如果本次修改制造了 unused import / unused variable / orphan helper：


必须清理自己制造的垃圾。
```

禁止清理历史遗留问题，除非用户明确要求。

---

## 6. Evidence-First Coding Gate

Codex 不得写“理论正确但未实证”的代码。

所有完成声明必须基于证据。

### 6.0 生产确认边界：确认是，同时确认不是

任何生产步骤在继续下一步前，必须形成同一个 owner 拥有的终态确认边界：

```txt
正向确认：目标身份和目标状态全部成立
反向排除：已知相邻假目标、错误态、加载态、过期态、重复态全部不成立
唯一性：候选恰好为一个
有界性：固定次数或固定截止时间内结束
终态：confirmed / failed / review_required
```

只证明“看起来像”不算确认。只命中一句成功文案、不排除同页失败文案，不算确认。
候选为零、候选大于一、正反证据冲突或到界仍不明确时，必须失败关闭；禁止继续滚动、
继续搜索、继续重试或改走第二链。

生产固化顺序固定为：

```txt
1. Codex 先通过获准真实路径亲自走通，并记录正向证据与反向排除项
2. 生产代码按同一页面结构、同一动作顺序和同一终态跑通
3. active law、施工图、owner inspector 与 acceptance 固化该正反边界和有界停止
```

这条规则只增加判断边界，不授权增加业务内容、业务步骤、兼容模式、fallback、bridge、
shadow implementation 或通用确认框架。

### 6.1 浏览器 / DOM / UI / 平台行为

#### 6.1.1 真实页面先验施工准入

凡修改 BrowserController、Chrome 插件、DOM Automation，或任何依赖真实网页控件、
弹窗、Shadow DOM、文件输入、按钮和页面状态顺序的生产代码，Codex 必须在写代码前亲自
使用仓库批准的 Chrome 插件或真实浏览器路径进入本次故障现场。

施工前必须逐状态读取并记录：

```txt
实际页面 URL 和受控标签身份
动作前页面状态
真实 light DOM / author shadow DOM / browser-owned UA shadow 边界
真正接收动作的控件身份、可见性、disabled 状态和几何命中结果
动作后的弹窗、输入、按钮和终态变化
生产日志中与该状态转换对应的 trace / task / failure reason
```

生产代码只允许实现已经在本次真实页面中观察到的结构和顺序。尚未走到、尚未读取或
尚未证明的后续页面状态必须保留为 `UNKNOWN` / `NOT_PRODUCTION_VERIFIED`，不得按浏览器
常识、组件文档、历史 selector、模拟 DOM、截图猜测或“理论上应该成立”写入生产代码。

真实运行再次失败时，必须先回到该次失败页面和结构日志重新取证，再决定是否删除并重构
责任片区；禁止在没有新增真实证据的情况下连续追加第二个猜测性修改、兼容桥、fallback、
shadow path 或第二链路。

施工完成后，Codex 必须用同一获准真实 Chrome 路径亲自重跑修改后的最终候选。施工前取证
证明“代码依据从哪里来”，施工后实测证明“这份候选实际能工作”；两者缺一不可。涉及付款、
退款、删除、发布或其他敏感最终动作时，仍必须服从 owning flow 的人工门和用户授权。

凡涉及以下内容，必须通过真实 Chrome 或项目已批准的真实浏览器路径验证：


页面打开
DOM 定位
按钮点击
输入框填写
文件上传
下载
弹窗
登录态
Seller Central 页面行为
Amazon 页面行为
ontheway 页面行为
Workbench UI 行为
CORS 浏览器行为
前端 fetch 行为
```

禁止只凭：


类型检查通过
静态推测
模拟 DOM
自己想象页面结构
理论上应该能点
```

验收报告必须写明：


CHROME_VERIFIED: true / false
Chrome 验证入口
Chrome 验证步骤
实际观察结果
截图 / 日志 / evidence ref，如已有
```

如果当前环境无法真实 Chrome 验证，必须写：


CHROME_VERIFIED: false
NOT_PRODUCTION_VERIFIED
原因：
缺少什么：
下一步如何验证：
```

不得把未 Chrome 验证的浏览器行为报告为完成。

### 6.2 非浏览器逻辑

纯函数、schema、AST inspector、CI runner、文件生成、类型系统等非浏览器逻辑，可以用以下证据证明：


typecheck
unit / acceptance
audit inspector
fixture attack
ci:full
```

但不得把非浏览器测试伪装成 Chrome 验证。

### 6.3 实证优先顺序

优先级：


真实 Chrome 实测
项目 acceptance 实测
AST inspector 实测
typecheck
人工解释
```

人工解释永远不能单独作为完成证明。

---

## 7. Audit Script Gate

质检脚本必须优先使用 ts-morph。

凡涉及：


法案扫描
owner 边界扫描
import 边界扫描
能力组边界扫描
API 边界扫描
反逃逸检查
generated truth 检查
```

必须是：


AST 级
symbol 级
反逃逸级
```

禁止把以下方式作为执法依据：


grep
raw string scanning
RegExp
/.../
new RegExp()
sourceFile.getFullText() 后搜索
fs.readFileSync 后搜索代码文本
shell grep
```

允许使用：


ts-morph Project
SourceFile
ImportDeclaration
ExportDeclaration
CallExpression
ObjectLiteralExpression
PropertyAssignment
Identifier
StringLiteral
Symbol
Declaration
getModuleSpecifierSourceFile()
getDefinitions()
getDeclarations()
```

普通业务代码如确需正则处理用户文本，必须局部、可解释，且不得作为法案执法依据。

---

## 8. Command Gate

最终完成判定只能使用：

```bash
npm run ci:full
```

`ci:full` 必须先运行：

```bash
npm run codex:entry-gate
```

阶段性验证允许使用 task-scoped scripts：

```bash
npm run typecheck
npm run audit:<domain>
npm run acceptance:<domain>
```

但局部 PASS 不能替代：

```bash
npm run ci:full
```

任务最终报告如果没有 `ci:full PASS`，不得写完成。

---

## 9. Chrome Verification Gate

涉及浏览器行为的任务，最终报告必须包含：


[CHROME-VERIFICATION]
```

格式：


[CHROME-VERIFICATION]
required: true / false
status: PASS / FAIL / NOT_RUN
browser: real Chrome / approved project browser path / not applicable
entry_url:
steps:
observed:
evidence:
remaining_risk:
```

如果 `required: true` 但 `status != PASS`，最终结论必须是：


NOT PRODUCTION VERIFIED
```

不得写：


done
complete
production-ready
fully verified
```

---

## 10. No Second Chain Gate

绝对禁止新增第二链路。

禁止：


bridge
fallback
shadow
parallel implementation
second runner
second audit truth
second API server
second route bus
second dispatcher
second mission loop
second evidence chain
second runtime log chain
second browser controller
second capability-facing API
```

如果任务确实需要新链路，必须先停下，输出：


SECOND_CHAIN_RISK
```

等待用户明确授权。

---

## 11. Generated Artifact Gate

禁止手工编辑 generated artifacts 作为源真相。

包括但不限于：


scripts/audit/generated/law-registry.generated.json
scripts/audit/generated/audit-plan.generated.json
scripts/audit/generated/enforcement-matrix.generated.json
scripts/audit/generated/static-clause-coverage.generated.json
scripts/audit/generated/*report.generated.json
```

generated artifacts 只能由既有生成链产生。

如果 generated artifact 不对，修源文件或生成器，不手改结果。

---

## 12. LAW-GAP Handling

如果发现 active law 不足以授权本次任务：


不要硬写代码。
不要私自补法案。
不要用施工图越权。
```

必须输出：


LAW-GAP
缺口：
影响：
最小补法：
是否需要用户授权：
```

只有用户明确授权后，才可进入 Law Change Gate。

---

## 13. Completion Report

每个任务完成时必须输出：


[TASK-COMPLETION]
```

格式：


[TASK-COMPLETION]
status: PASS / FAIL / NOT_PRODUCTION_VERIFIED

changed_files:
- ...

what_changed:
- ...

what_not_changed:
- ...

law_boundary:
- ...

second_chain_check:
PASS / FAIL

generated_artifact_rule:
PASS / FAIL

verification:
- npm run typecheck: PASS / FAIL / NOT_RUN
- npm run audit:<domain>: PASS / FAIL / NOT_RUN
- npm run acceptance:<domain>: PASS / FAIL / NOT_RUN
- npm run ci:full: PASS / FAIL / NOT_RUN

chrome_verification:
required: true / false
status: PASS / FAIL / NOT_RUN
evidence:

remaining_risks:
- ...

final_decision:
PASS / FAIL / NOT_PRODUCTION_VERIFIED
```

规则：


ci:full 未 PASS，final_decision 不能是 PASS。
需要 Chrome 验证但未通过，final_decision 不能是 PASS。
存在 LAW-GAP，final_decision 不能是 PASS。
存在 second-chain risk，final_decision 不能是 PASS。
```

---

## 14. Absolute Bans

禁止：


绕过法案直接按记忆施工
把施工图当作高于 active law 的授权来源
手工编辑 generated artifacts 作为源真相
新增 bridge / fallback / shadow / 第二实现
新增平行质检链
warning / partial pass / soft pass 当完成
理论正确但未实证就报告完成
未真实 Chrome 验证就声称浏览器行为可用
为了满足入口扫描而新建不存在的治理机制
为了通过测试降低法案
为了优雅复杂化
```

---

## 15. Final Rule


简单。
直接。
小步。
实证。
不造第二链路。
不写理论正确的废代码。
```
