# GrassEye Xuanyuan 受控 AI Run 操作说明

> 文档身份：`xuanyuan` 技能的唯一操作说明
> 适用范围：xuanxue-web 及其他业务系统调用 AGENT 执行 AI 任务
> 当前原则：服务器只写云端验收任务；本地 AGENT 主动领取并交给 `xuanyuan`。不得让服务器回拨本机，也不得直接调用 provider、浏览器控制器或 AI Input Gateway 子能力。

## 0. 启动 AGENT

在执行任何受控 run 前，先启动 AGENT：

```bash
cd "/Users/nexgen/Documents/AGENT"
GRASSEYE_LOG_MODE=DEBUG \
GRASSEYE_STRUCTURED_LOG_STDOUT=1 \
GRASSEYE_STRUCTURED_LOG_LEVEL=debug \
npm run grasseye:start
```

测试 Web GPT 时必须使用已登录的 GUI Chrome，并在 Chrome 中开启：`显示 → 开发者 → 允许 Apple 事件中的 JavaScript`。本流程不要求、也不应配置生产 provider API key。

首次连接服务器前，只执行一次设备登记：

```bash
cd "/Users/nexgen/Documents/AGENT"
XUANYUAN_CLOUD_BASE_URL="https://你的服务器域名" \
XUANYUAN_CLOUD_DEVICE_NAME="本地验收-Mac" \
XUANYUAN_CLOUD_ENROLLMENT_TOKEN="服务器签发的短期登记口令" \
XUANYUAN_CLOUD_MAX_IN_FLIGHT=10 \
npm run xuanyuan:cloud:enroll
```

登记成功后，长期设备凭据只保存在权限为 `0600` 的本地文件中。正常启动只需设置
`XUANYUAN_CLOUD_BASE_URL`，不再使用登记口令。

## 1. 唯一调用链

```text
网站服务器
  -> 持久化 ai_acceptance_jobs、输入对象和 request_hash
  <- 本地 AGENT 使用设备凭据主动 heartbeat / claim
  -> xuanyuan 持久任务与唯一队列
  -> AI Input Gateway
  -> GPT Web
  -> 原始回答 / hash / provider proof / checkpoint
  -> 本地 AGENT 回传服务器并等待确认
  -> 服务器管理后台人工反问、记录问题和晋级证据
```

`xuanyuan` 是 AGENT 对外暴露的统一 AI 技能。业务系统不得因为想使用 API、Web GPT 或其他模型而改调用路径；provider 切换必须在 AGENT 内部完成，并保持 Xuanyuan 请求/任务状态契约不变。

本机 `/api/xuanyuan/*` 只保留为 AGENT 自检和隔离诊断入口，不是网站服务器的生产连接方式。

## 2. 运行前检查

云端任务生产者只准备治理后的请求字段。云端协议会将这些字段锁定为
`job_id + source_task_id + request_hash + attempt`，再由本地转换成 Xuanyuan 请求：

```json
{
  "requestId": "stable-request-id",
  "sourceProject": "xuanxue-web",
  "scenario": "bazi-book-reviewer-a",
  "providerKind": "gpt-web-chat",
  "promptPackageId": "book-reviewer-a-v1",
  "promptContractId": "book-reviewer-a-v1",
  "expectedOutputSchemaRef": "schema:book-review.v1",
  "textPrompt": "...治理后的完整提示词...",
  "inputRefs": [{
    "id": "book-batch-001",
    "kind": "evidence-pack",
    "summary": "已锁定的书籍批次证据包",
    "filePath": "/approved/path/batch-001.json",
    "mimeType": "application/json"
  }],
  "timeoutMs": 180000,
  "maxInputChars": 120000,
  "maxFileCount": 1,
  "maxFileBytes": 200000000
}
```

必须保证 request、prompt package、prompt contract 和输入快照可复算；真实 provider key 只存在 AGENT provider 层。

## 3. 云端激活本地 AGENT

服务器不需要知道本机 IP，也不需要家庭宽带开放端口。本地 AGENT 周期性主动请求：

```txt
POST /internal/ai-acceptance/devices/heartbeat
POST /internal/ai-acceptance/jobs/claim
POST /internal/ai-acceptance/jobs/{jobId}/checkpoints
POST /internal/ai-acceptance/jobs/{jobId}/result
POST /internal/ai-acceptance/jobs/{jobId}/failure
```

云端 `job_id` 是网站侧唯一句柄，本地 `taskId` 是 GPT Web 执行句柄；二者必须保留映射。
`completed` 只表示回答已保存并通过哈希回读，不表示内容已经人工确认准确。

## 4. 证据要求

每次任务必须同时保留：

```text
<GRASSEYE_DATA_DIR>/runtime-data/xuanyuan/tasks/<taskId>.json
云端 ai_acceptance_jobs / ai_acceptance_job_events
私有对象存储中的输入快照与原始回答
```

验收至少检查 `requestSnapshot`、`promptPackageSnapshot`、`providerProof`、`rawOutputRef`、`rawOutputHash`、`parseStatus`、`schemaValidationStatus` 以及 `failureReason`/`reviewRequiredReason`。没有这些字段，不能宣布 AI 完成。

## 5. Provider 边界

当前本地 AGENT 的 Xuanyuan schema 将 `providerKind` 限制为 `gpt-web-chat`。生产 Provider API
属于网站服务端的独立执行通道，只有人工验收证据晋级后才可启用；不得在 AGENT 内形成
GPT Web 与生产 API 双写，也不得把 GPT Web 当作生产 API 的失败回退。

## 6. 本次受控 smoke run

执行日期：2026-07-11

```text
requestId: controlled-xuanyuan-smoke-20260711
taskId: xuanyuan_c61e3d0e-8b33-4d5a-8a61-c63413abc1bc
providerKind: gpt-web-chat
result: review_required
evidence: .grasseye-local/runtime-data/xuanyuan/tasks/xuanyuan_c61e3d0e-8b33-4d5a-8a61-c63413abc1bc.json
```

反馈原因为 Chrome 未开启“允许 Apple 事件中的 JavaScript”。本次没有 `rawOutputRef` 或 `rawOutputHash`，不能判定成功；调用链已真实进入 `xuanyuan -> feed-gpt-web-chat-once`。

随后在隔离数据目录、真实 GUI Chrome 用户配置下重跑，验证了修复后的完整链路：

```text
requestId: controlled-xuanyuan-smoke-20260711-07
taskId: xuanyuan_6855b0e6-0368-4af7-8367-ac38fae3ff6a
status: succeeded
normalizedText: {"ok":true,"scope":"controlled-xuanyuan-smoke"}
providerProof.webChatUrl: https://chatgpt.com/c/6a5227a4-69ec-83ed-9b42-8b0881715da7
rawOutputHash: 2cff0d7b6e53a088c24df2c443c2ee25442a705cbffd196db2071ce4a2946961
rawOutputRef: /tmp/grasseye-xuanyuan-smoke/runtime-data/ai-input-gateway/feed-gpt-web-chat-once-28394fc8-8c32-4099-8d6e-4d522c1db516.txt
```

这证明无需 provider API key，`xuanyuan` 可以自动完成 Web GPT 投喂、回答捕获、原始输出落盘和哈希留证。隔离数据目录只用于受控 smoke，不代表书籍生产批次已经通过。

## 7. 禁止事项与验收

- 业务端直接调用 ChatGPT/Gemini 页面、SDK、provider adapter 或 gateway 子能力；
- 用 fixture acceptance 的 PASS 冒充真实 provider 成功；
- 看到 `202/running` 就宣布完成；
- 缺少 output proof、哈希或失败原因仍发布结果；
- provider 失败后手工补写任务 JSON。

```bash
npm run acceptance:xuanyuan
npm run audit:xuanyuan
```

前一条包含本地任务、附件与双任务云端并发归属验收；后一条检查治理结构。自动验收不能替代
真实 GPT Web 回答、人工反问和案例接受证据。
