# 玄元 API 临时实现方案

文件状态：draft-plan  
适用仓库：AGENT  
目标技能名称：xuanyuan  
适用阶段：真实 API 密钥接入前的网页 GPT 实测阶段  
方案性质：临时实现方案，不是 active 法案，不是施工图主权文件  

## 1. 本方案解决什么问题

本方案只解决一个问题：

```txt
网站侧如何把已经整理好的提示词、资料包和用户问题，安全发送给 AGENT；
AGENT 如何高度模拟未来真实 AI API 的调用、回收、解析和审计；
等测试成熟后，再把网页 GPT 通道切换成真实 API key 通道。
```

核心判断：

```txt
网站侧只管发和收。
AGENT 是未来 AI 端。
xuanyuan 是 AGENT 内部统一 AI 调用入口。
当前先用网页 GPT 实测真实提示词、资料包、返回格式和异常处理。
成熟后再切换真实 API 密钥。
```

## 2. 本方案不解决什么问题

本方案不建设：

```txt
第二套 HTTP 服务
第二套 API 网关
第二套任务调度器
第二套 provider 直连链路
第二套证据链
第二套日志链
网站直连 ChatGPT / OpenAI
网站保存真实 API key
AGENT 绕过 Workbench API Boundary 接收外部请求
业务插件绕过 AI Input Gateway 直接操作 GPT 网页或 provider SDK
```

本方案也不把网页 GPT 实测结果伪装成最终生产 API。

当前阶段的目标是：

```txt
把未来 API 场景提前跑真。
把提示词、资料包、输出 schema、异常处理、证据保存跑成熟。
等这些稳定后，再换真实 API key。
```

## 3. 总边界

### 3.1 网站侧边界

网站侧只负责：

```txt
组装请求
发送请求
查询状态
接收结果
展示结果
保存业务侧 report / task 引用
```

网站侧不得：

```txt
直连 ChatGPT 网页
直连 OpenAI / Gemini / Claude SDK
保存 provider 密钥
控制 AGENT 浏览器动作
传 selector / coordinate / actionPlan
让 AI 决定 AGENT 下一步浏览器操作
绕过 AGENT 自己解析 AI 输出
把未返回成功的 AI 结果当成业务成功
```

### 3.2 AGENT 侧边界

AGENT 侧负责：

```txt
接收网站请求
通过 Workbench API Boundary 做鉴权、CORS、路由准入和危险字段拦截
创建 xuanyuan 任务
固化 Prompt Package 快照
调用 AI Input Gateway
通过 gpt-web-chat 临时模拟未来 API 调用
捕获 raw output
保存 provider proof
解析 expected output schema
返回 task status / result
保留可审计记录
```

AGENT 侧不得：

```txt
绕过 Workbench API Boundary 新开 API 服务
在 xuanyuan 里直接写 provider DOM 操作
让 xuanyuan 直接读取 cookie / token / localStorage / sessionStorage
自动登录 provider 账号
绕过验证码、2FA、风控或额度限制
把 parse_failed 伪装成 succeeded
把 provider 错误吞掉后返回业务成功
```

### 3.3 AI Input Gateway 边界

AI Input Gateway 只负责：

```txt
provider delivery
response retrieval
transport proof
raw output 保存
normalized text
parse status
schema validation status
provider adapter 隔离
rate / timeout / retry guard
```

AI Input Gateway 不负责：

```txt
业务判断
网站业务状态
命理报告最终解释权
浏览器任务下一步动作
资料包该不该被网站展示
业务结果是否可投产
```

## 4. 总链路

目标链路：

```txt
xuanxue-web / external website
  -> POST /api/xuanyuan/simulate
      -> Workbench API Boundary
          -> known xuanyuan route handler
              -> xuanyuan task
                  -> governed Prompt Package
                      -> AI Input Gateway
                          -> gpt-web-chat provider adapter
                              -> raw output + provider proof
                                  -> schema parse / validation
                                      -> xuanyuan task result
                                          -> website poll / receive
```

未来真实 API key 成熟后的链路：

```txt
xuanxue-web / external website
  -> same xuanyuan request contract
      -> Workbench API Boundary
          -> xuanyuan task
              -> governed Prompt Package
                  -> AI Input Gateway
                      -> openai-api provider adapter
                          -> raw output + provider proof
                              -> schema parse / validation
                                  -> same xuanyuan task result
```

关键点：

```txt
网站侧契约不应该因为 provider 从 gpt-web-chat 换成 openai-api 而重写。
变化只应该发生在 AGENT 内部 provider adapter 层。
```

## 5. 为什么当前先用网页 GPT

当前不急着接真实 API key，原因不是技术上不能接，而是生产前必须先验证：

```txt
用户问题应该如何包装
资料包应该如何组织
提示词边界是否清楚
输出 JSON / 文本格式是否稳定
失败时如何重试
解析失败时如何回传
AI 输出证据如何保存
网站收到什么字段才敢展示
哪些内容必须进入人工复核
```

网页 GPT 的价值是：

```txt
它可以用接近真实大模型的行为，提前压测提示词和资料包设计。
它不要求现在暴露真实 API key。
它能复用 Pick3 已经成熟的网页 GPT 发送、捕获、证明、解析、恢复经验。
```

但必须明确：

```txt
网页 GPT 是临时 provider。
它不是最终 API。
它不能绕过 AI Input Gateway。
它不能让网站直接操作。
```

## 6. xuanyuan 的定位

`xuanyuan` 是 AGENT 内的统一 AI 端入口。

它的角色不是“万能大脑”，而是：

```txt
接收外部系统提交的 AI 请求
固化请求和资料包
选择被允许的 providerKind
调用 AI Input Gateway
保存输入输出证据
把结果按稳定契约返回给调用方
```

它的第一阶段只允许：

```txt
providerKind = gpt-web-chat
```

后续成熟后才允许新增：

```txt
providerKind = openai-api
```

`xuanyuan` 不直接拥有：

```txt
ChatGPT DOM selector
OpenAI SDK 调用细节
业务插件内部逻辑
网站 UI 展示逻辑
玄学报告最终排版
```

这些必须留在各自 owner 中。

## 7. 临时 API 路由建议

第一阶段建议只开放最小路由：

```txt
POST /api/xuanyuan/simulate
GET  /api/xuanyuan/status/:taskId
GET  /api/xuanyuan/latest
GET  /api/xuanyuan/history
```

### 7.1 POST /api/xuanyuan/simulate

用途：

```txt
网站提交一次 AI 请求。
AGENT 创建 xuanyuan 任务。
任务进入网页 GPT 临时投喂链。
```

### 7.2 GET /api/xuanyuan/status/:taskId

用途：

```txt
网站轮询任务状态。
```

### 7.3 GET /api/xuanyuan/latest

用途：

```txt
网站或本地 Workbench 查看最近一次 xuanyuan 任务。
```

### 7.4 GET /api/xuanyuan/history

用途：

```txt
查看历史任务列表。
只返回任务摘要，不返回敏感原始输入。
```

## 8. 请求契约草案

`POST /api/xuanyuan/simulate` 的请求体建议：

```json
{
  "requestId": "xuanxue-web-20260703-000001",
  "sourceProject": "xuanxue-web",
  "scenario": "bazi_daily_mode",
  "providerKind": "gpt-web-chat",
  "promptPackageId": "bazi-daily-pack-20260703-v1",
  "promptContractId": "xuanyuan-bazi-daily-v1",
  "systemPrompt": "你是玄元命理分析助手，只能根据资料包证据回答。",
  "userPrompt": "用户提出的问题。",
  "inputRefs": [
    {
      "kind": "chart_facts",
      "ref": "chart-facts:20260703:abc123"
    },
    {
      "kind": "evidence_pack",
      "ref": "evidence-pack:bazi:qiong-tong-bao-jian:demo001"
    }
  ],
  "payloadJson": {
    "userQuestion": "我的事业什么时候有起色？",
    "chartFacts": {},
    "evidencePack": {}
  },
  "expectedOutputSchemaRef": "schema:xuanyuan.bazi.daily.v1",
  "timeoutMs": 180000,
  "maxInputChars": 120000,
  "maxFileCount": 0,
  "maxFileBytes": 0
}
```

请求必须具备：

```txt
requestId
sourceProject
scenario
providerKind
promptPackageId
promptContractId
inputRefs
timeoutMs
maxInputChars
maxFileCount
maxFileBytes
```

如果需要结构化解析，必须具备：

```txt
expectedOutputSchemaRef
```

## 9. 响应契约草案

任务创建响应：

```json
{
  "ok": true,
  "taskId": "xuanyuan-task-20260703-000001",
  "requestId": "xuanxue-web-20260703-000001",
  "status": "accepted",
  "providerKind": "gpt-web-chat",
  "createdAt": "2026-07-03T00:00:00.000Z"
}
```

任务状态响应：

```json
{
  "ok": true,
  "taskId": "xuanyuan-task-20260703-000001",
  "requestId": "xuanxue-web-20260703-000001",
  "providerKind": "gpt-web-chat",
  "status": "succeeded",
  "rawOutputRef": "data/xuanyuan/tasks/.../raw-output.txt",
  "rawOutputHash": "sha256:...",
  "normalizedText": "AI 返回的规范化文本。",
  "parseStatus": "parsed",
  "schemaValidationStatus": "valid",
  "parsedJson": {},
  "providerProof": {
    "startedAt": "2026-07-03T00:00:00.000Z",
    "endedAt": "2026-07-03T00:01:20.000Z",
    "durationMs": 80000,
    "providerPageUrl": "https://chatgpt.com/...",
    "proofRefs": []
  },
  "failureReason": null,
  "reviewRequiredReason": null,
  "updatedAt": "2026-07-03T00:01:20.000Z"
}
```

## 10. 状态机

建议第一阶段状态：

```txt
accepted
running
provider_submitted
provider_answer_captured
parsed
succeeded
parse_failed_raw_available
review_required
paused_rate_limited
failed
```

状态含义：

```txt
accepted：请求已通过边界并创建任务。
running：任务正在执行。
provider_submitted：提示词已经提交给网页 GPT。
provider_answer_captured：已经捕获 provider 原始回答。
parsed：结构化解析通过。
succeeded：任务成功完成，可供网站消费。
parse_failed_raw_available：原文已拿到，但结构化解析失败。
review_required：登录、验证码、风控、额度、页面异常或证据不足，需要人工处理。
paused_rate_limited：provider 明确限额，需要等待后恢复同一任务。
failed：任务失败，不能当作可展示结果。
```

网站侧只应该把以下状态作为可正式展示：

```txt
succeeded
```

以下状态只能展示为“处理中 / 待复核 / 失败”：

```txt
accepted
running
provider_submitted
provider_answer_captured
parse_failed_raw_available
review_required
paused_rate_limited
failed
```

## 11. 存储与证据

每次 xuanyuan 任务至少保存：

```txt
task meta
request snapshot
prompt package snapshot
input hash
providerKind
raw output ref
raw output hash
normalized text
parse status
schema validation status
parsed json
provider proof
failure reason
review required reason
createdAt / updatedAt
```

保存目的：

```txt
以后能复盘同一个提示词为什么失败。
以后能比较网页 GPT 与真实 API 的差异。
以后能证明网站收到的结果来自哪一次 AI 调用。
以后能知道是提示词问题、资料包问题、provider 问题，还是解析器问题。
```

禁止：

```txt
只保存最终文本，不保存 raw output。
只保存 console log，不保存 provider proof。
只保存 parsedJson，不保存 rawOutputHash。
parse 失败后删除原文。
provider 失败后返回 succeeded。
```

## 12. 与 Pick3 成熟链路的关系

可以复用 Pick3 已经成熟的经验：

```txt
网页 GPT 工作区 tab 复用
提示词提交
回答捕获
raw output 持久化
provider proof
parse status
rate limit / quota 处理
任务状态轮询
历史记录
失败原因显式化
```

不能复用 Pick3 的业务内容：

```txt
彩票源
L80 图像
sealed prediction
reveal scoring
front / back / lower / upper 标签
Pick3 playbook
中奖率评估
下注相关推理
```

也就是说：

```txt
复用“怎么把东西交给网页 GPT 并拿回证据”。
不复用“Pick3 在判断什么”。
```

## 13. 与 xuanxue-web 的关系

xuanxue-web 侧只需要理解一个事实：

```txt
AGENT 是 AI 端。
网站不是 AI provider 端。
```

xuanxue-web 发送：

```txt
用户问题
确定性命盘事实
资料包引用或资料包内容
提示词包 id
输出 schema ref
requestId
sourceProject
scenario
```

xuanxue-web 接收：

```txt
taskId
status
normalizedText
parsedJson
rawOutputRef
rawOutputHash
parseStatus
schemaValidationStatus
reviewRequiredReason
failureReason
```

xuanxue-web 不接触：

```txt
ChatGPT 网页
provider cookie
provider token
真实 API key
provider DOM selector
AGENT 浏览器 profile
AGENT 内部恢复动作
```

## 14. 日常模式的适配原则

当前只做日常模式。

日常模式含义：

```txt
用户提出一个常规问题。
网站先按业务规则准备必要资料包。
网站把用户问题 + 资料包 + 输出要求交给 AGENT。
AGENT 调用 xuanyuan。
AI 根据资料包生成回答。
网站展示成功结果。
```

日常模式不做：

```txt
一次性吞全部古籍
专家重型模式
无边界全文投喂
AI 自己绕过资料包索引抓资料
跨多个 provider 自动投票
```

如果未来要做专家模式，必须另立方案和边界，不在当前 xuanyuan 日常模式里藕断丝连。

## 15. 真实 API key 切换原则

切换真实 API key 时，不应该改变网站侧契约。

允许变化：

```txt
providerKind 从 gpt-web-chat 增加 openai-api
AI Input Gateway 新增 openai-api adapter
providerProof 增加 model、request id、token / cost 信息
rate guard 从网页节流切换为 API quota / cost guard
```

不允许变化：

```txt
网站直接持有 API key
网站直连 OpenAI
网站绕过 AGENT
xuanyuan 绕过 AI Input Gateway
provider adapter 直接写进业务插件
真实 API 失败后伪装成成功
```

目标是：

```txt
上层契约稳定。
下层 provider 可替换。
证据和审计不断链。
```

## 16. 禁止事项清单

第一阶段明确禁止：

```txt
新建第二个 HTTP server。
新建第二套外部 API gateway。
网站直连 provider。
网站保存真实 API key。
用 query string 传 API key。
日志打印 API key。
请求体携带 cookie / token / password。
请求体携带 selector / coordinate / browserCommand / actionPlan。
xuanyuan 直接操作 GPT DOM。
xuanyuan 直接 import provider SDK。
业务插件直接调用 GPT 网页或 OpenAI SDK。
网页 GPT 登录、验证码、2FA、风控自动绕过。
parse_failed 返回 succeeded。
raw output 丢失。
provider proof 丢失。
不保存 inputHash。
不保存 promptPackageId。
未通过 Workbench API Boundary 的外部请求进入任务。
```

## 17. 实施阶段建议

### Phase 0：方案确认

产物：

```txt
docs/玄元API临时实现方案.md
```

验收：

```txt
边界清楚。
流程清楚。
网站侧与 AGENT 侧职责清楚。
网页 GPT 与未来 API key 的切换点清楚。
```

### Phase 1：现状映射

目标：

```txt
只读梳理 Pick3 当前 gpt-web-chat 能力。
只读梳理 AI Input Gateway 当前 public contract。
只读梳理 Workbench API Boundary 当前 route allowlist 模式。
```

不得：

```txt
复制 Pick3 业务代码。
提前新增真实 API key。
提前开放外部路由。
```

### Phase 2：xuanyuan 最小任务骨架

目标：

```txt
建立 xuanyuan 任务 owner。
建立最小 request / status / result contract。
建立本地任务存储。
建立 prompt package snapshot。
```

验收：

```txt
没有 provider 调用时，也能创建任务、查询任务、看到失败原因。
```

### Phase 3：接入 gpt-web-chat 临时 provider

目标：

```txt
xuanyuan 通过 AI Input Gateway 调用 gpt-web-chat。
保存 raw output。
保存 provider proof。
保存 parse status。
```

验收：

```txt
真实 Chrome / 网页 GPT 跑通一条测试链。
失败时能看到明确 failureReason 或 reviewRequiredReason。
```

### Phase 4：网站联调

目标：

```txt
xuanxue-web 只发请求、轮询状态、展示结果。
```

验收：

```txt
网站不接触 provider。
网站不保存 key。
网站不控制 AGENT 浏览器。
网站只依赖 xuanyuan 返回契约。
```

### Phase 5：真实 API key 切换预案

目标：

```txt
新增 openai-api provider adapter。
保持 xuanyuan 上层契约不变。
同一 prompt package 同时可用于 gpt-web-chat 和 openai-api 对照测试。
```

验收：

```txt
同一请求契约下，providerKind 可切换。
证据和 parse status 不断链。
```

## 18. 第一轮验收标准

第一轮只判断方案和最小链路是否成立，不判断玄学业务最终质量。

必须能回答：

```txt
网站发什么？
AGENT 收什么？
AGENT 怎么把请求变成 Prompt Package？
AGENT 怎么送给网页 GPT？
AGENT 怎么保存原文？
AGENT 怎么解析输出？
网站怎么知道成功、失败、待复核？
以后换真实 API key 时改哪里？
哪些事情绝对不能做？
```

如果以上问题回答不清楚，不进入实现。

## 19. 一句话总结

```txt
玄元 API 当前不是急着接真实密钥，而是先把“网站发包 -> AGENT 投喂 -> AI 返回 -> 证据保存 -> 结构化回传”这条链跑熟。
网站只管发和收，AGENT 才是 AI 端；以后换真实 API key，只换 provider 适配层，不推翻上层契约。
```
