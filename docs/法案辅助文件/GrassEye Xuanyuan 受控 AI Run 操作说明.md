# GrassEye Xuanyuan 受控 AI Run 操作说明

> 文档身份：`xuanyuan` 技能的唯一操作说明
> 适用范围：xuanxue-web 及其他业务系统调用 AGENT 执行 AI 任务
> 当前原则：业务端只调用 `xuanyuan`；不得直接调用 provider、浏览器控制器或 AI Input Gateway 子能力。

## 1. 唯一调用链

```text
业务系统
  -> POST AGENT /api/xuanyuan/simulate
  -> xuanyuan 任务契约与任务记录
  -> AI Input Gateway
  -> 当前 provider（由 AGENT 决定）
  -> raw output / hash / provider proof / parse status
  -> GET /api/xuanyuan/status?taskId=...
```

`xuanyuan` 是 AGENT 对外暴露的统一 AI 技能。业务系统不得因为想使用 API、Web GPT 或其他模型而改调用路径；provider 切换必须在 AGENT 内部完成，并保持 Xuanyuan 请求/任务状态契约不变。

## 2. 运行前检查

调用方只准备治理后的请求字段：

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

## 3. 发起与查询

```bash
curl -sS -X POST "$XUANYUAN_AGENT_BASE_URL/api/xuanyuan/simulate" \
  -H 'content-type: application/json' \
  -H "x-grasseye-api-key: $XUANYUAN_AGENT_API_KEY" \
  -H "origin: $XUANYUAN_AGENT_ORIGIN" \
  --data-binary @request.json

curl -sS "$XUANYUAN_AGENT_BASE_URL/api/xuanyuan/status?taskId=$TASK_ID" \
  -H "x-grasseye-api-key: $XUANYUAN_AGENT_API_KEY" \
  -H "origin: $XUANYUAN_AGENT_ORIGIN"
```

以响应中的 `taskId` 为唯一查询句柄。终态含义：`succeeded` 表示输出和校验可用；`parse_failed_raw_available` 表示 raw output 可用但解析失败；`review_required` 表示 provider 或安全边界无法证明完成；`failed` 表示失败且无可用 raw output。

## 4. 证据要求

每次任务必须保留：

```text
<GRASSEYE_DATA_DIR>/runtime-data/xuanyuan/tasks/<taskId>.json
```

验收至少检查 `requestSnapshot`、`promptPackageSnapshot`、`providerProof`、`rawOutputRef`、`rawOutputHash`、`parseStatus`、`schemaValidationStatus` 以及 `failureReason`/`reviewRequiredReason`。没有这些字段，不能宣布 AI 完成。

## 5. Provider 边界

当前 AGENT 的 Xuanyuan schema 将 `providerKind` 限制为 `gpt-web-chat`。AI Input Gateway 虽另有 `gemini-api` adapter，但业务端不得直接调用它；如需直连 API，必须在 AGENT 内扩展 Xuanyuan schema、provider 选择和真实 acceptance，并保持任务状态、raw output、proof、哈希和失败语义不变。闭环完成前，不得把 `createAiInputGatewayAbilityGroup` 或任何 provider adapter 当作业务入口。

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

## 7. 禁止事项与验收

- 业务端直接调用 ChatGPT/Gemini 页面、SDK、provider adapter 或 gateway 子能力；
- 用 fixture acceptance 的 PASS 冒充真实 provider 成功；
- 看到 `202/running` 就宣布完成；
- 缺少 output proof、哈希或失败原因仍发布结果；
- provider 失败后手工补写任务 JSON。

```bash
node --import tsx scripts/acceptance/xuanyuan.acceptance.ts
node --import tsx scripts/audit/domains/xuanyuan/inspector.ts
```

前一条只证明任务骨架；后一条检查治理结构。只有真实 provider 任务产生完整 output proof，才可计入业务 AI 生产证据。
