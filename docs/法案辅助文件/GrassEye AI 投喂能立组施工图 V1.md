# GrassEye AI 投喂能立组施工图 V1

status: active
version: 2026-05-21
capabilityGroupId: `ai-input-gateway`
中文名: AI 投喂能立组 / 外部 AI 输入网关

## 0. 一句话定义

```txt
当前 AI 能立组 = 判断任务 owner，负责“让 AI 判断什么”
AI 投喂能立组 = 传输通道 owner，负责“把材料通过哪个 AI 通道投喂出去，并把结果拿回来”
```

AI 投喂能立组不是当前 `src/capabilities/ai` 的替代品。它是当前 AI 能立组调用外部模型时的底层通道能力。

## 1. 当前仓库现状判断

当前仓库已经有：

```txt
src/capabilities/ai/**
```

但它目前更像 AI 判断能力组，主要服务：

```txt
visual-mission-judge-v1
```

当前也有：

```txt
src/lib/online-ai/**
```

它主要承担 Gemini API 调用能力，但它不是完整的 AI Input Gateway。

当前治理问题：

```txt
Product Video DOM Runtime 存在直接调用 Gemini API / invokeGemini 的路径。
```

治理目标：

```txt
业务插件不得直接调用 AI provider。
业务插件调用 AI 能立组。
AI 能立组调用 AI 投喂能立组。
AI 投喂能立组再调用具体 provider adapter。
```

正确关系：

```txt
product-video-dom-runtime
  -> AI 能立组：PRODUCT_VIDEO_JUDGE_ONCE
       -> AI 投喂能立组：FEED_GEMINI_API_ONCE / FEED_GEMINI_WEB_CHAT_ONCE / FEED_GPT_WEB_CHAT_ONCE
            -> provider adapter
       -> 校验 ProductVideoJudgeOutputSchema
  -> DOM 能立组采集证据
```

## 2. 法案权威

本施工图受以下法案文件管辖：

```txt
.github/instructions/cursor-rules/modules/module-ai-input-gateway.instructions.md
```

任务相关边界还必须同时服从：

```txt
.github/instructions/cursor-rules/modules/module-capability-group-governance.instructions.md
.github/instructions/cursor-rules/modules/module-code-topology.instructions.md
.github/instructions/cursor-rules/modules/module-ai-capability.instructions.md
.github/instructions/cursor-rules/modules/module-security-privacy.instructions.md
.github/instructions/cursor-rules/modules/module-dom-automation.instructions.md
.github/instructions/cursor-rules/modules/module-video-download-capability.instructions.md
```

## 3. 目录规划

新增能力组目录：

```txt
src/capabilities/ai-input-gateway/
  ├─ index.ts
  ├─ schema.ts
  ├─ manifest.ts
  ├─ ability-group.ts
  ├─ runtime/
  │   ├─ feed-gemini-api-once.ts
  │   ├─ feed-gemini-web-chat-once.ts
  │   ├─ feed-gpt-web-chat-once.ts
  │   ├─ ai-feed-proof.ts
  │   ├─ ai-feed-input-package.ts
  │   ├─ ai-feed-output-parser.ts
  │   └─ ai-feed-rate-guard.ts
  ├─ providers/
  │   ├─ gemini-api.adapter.ts
  │   ├─ gemini-web-chat.adapter.ts
  │   └─ gpt-web-chat.adapter.ts
  ├─ contracts/
  │   ├─ ai-feed-input.contract.ts
  │   ├─ ai-feed-result.contract.ts
  │   └─ ai-provider-adapter.contract.ts
  └─ tests/
      ├─ gemini-api.fixture.ts
      ├─ gemini-web-chat.fixture.ts
      └─ gpt-web-chat.fixture.ts
```

治理文档：

```txt
.github/instructions/cursor-rules/modules/module-ai-input-gateway.instructions.md
docs/法案辅助文件/GrassEye AI 投喂能立组施工图 V1.md
```

验收脚本：

```txt
scripts/acceptance/ai-input-gateway-smoke.ts
scripts/acceptance/ai-input-gateway-web-chat-fixture-smoke.ts
```

## 4. Schema 设计

### 4.1 ProviderKind

```ts
export const AiInputGatewayProviderKindSchema = z.enum([
  "gemini-api",
  "gemini-web-chat",
  "gpt-web-chat",
]);
```

### 4.2 Feed Input

```ts
export const AiFeedInputSchema = z.object({
  providerKind: AiInputGatewayProviderKindSchema,
  promptPackageId: z.string().min(1),
  promptContractId: z.string().min(1),
  expectedOutputSchemaRef: z.string().min(1).nullable().default(null),
  textPrompt: z.string().min(1),
  inputRefs: z.array(z.object({
    id: z.string().min(1),
    kind: z.string().min(1),
    summary: z.string().min(1),
    filePath: z.string().min(1).optional(),
    mimeType: z.string().min(1).optional(),
  })).default([]),
  modelName: z.string().min(1).nullable().default(null),
  timeoutMs: z.number().int().positive().default(60000),
  maxInputChars: z.number().int().positive().default(30000),
  maxFileCount: z.number().int().nonnegative().default(3),
  maxFileBytes: z.number().int().positive().default(20_000_000),
  requestedBy: z.enum(["ai-capability", "manual-test", "acceptance-test"]),
  missionId: z.string().min(1).nullable().default(null),
  runId: z.string().min(1).nullable().default(null),
  roundId: z.string().min(1).nullable().default(null),
}).strict();
```

### 4.3 Feed Result

```ts
export const AiFeedResultSchema = z.object({
  abilityGroupId: z.literal("ai-input-gateway"),
  childCapabilityId: z.enum([
    "feed-gemini-api-once",
    "feed-gemini-web-chat-once",
    "feed-gpt-web-chat-once",
  ]),
  providerKind: AiInputGatewayProviderKindSchema,
  status: z.enum(["success", "failed", "review_required"]),
  normalizedText: z.string().nullable(),
  rawOutputRef: z.string().min(1).nullable(),
  rawOutputHash: z.string().min(1).nullable(),
  parseStatus: z.enum(["json_valid", "json_invalid", "not_requested"]),
  parsedJson: z.unknown().nullable(),
  schemaValidationStatus: z.enum(["valid", "invalid", "not_applicable"]),
  providerProof: z.object({
    providerKind: AiInputGatewayProviderKindSchema,
    modelName: z.string().nullable(),
    inputHash: z.string().min(1),
    outputHash: z.string().min(1).nullable(),
    inputRefs: z.array(z.string()).default([]),
    outputRefs: z.array(z.string()).default([]),
    startedAt: z.string(),
    endedAt: z.string(),
    durationMs: z.number().int().nonnegative(),
    transport: z.enum(["api", "web-chat"]),
    webChatUrl: z.string().nullable().default(null),
    restoredSourcePage: z.boolean().nullable().default(null),
  }),
  failureReason: z.string().nullable().default(null),
  reviewRequiredReason: z.string().nullable().default(null),
}).strict();
```

## 5. Manifest 设计

```ts
export const AI_INPUT_GATEWAY_CATALOG_ENTRIES = [
  {
    actionCode: "FEED_GEMINI_API_ONCE",
    type: "atomic",
    displayName: "Feed Gemini API Once",
    abilityGroupId: "ai-input-gateway",
    childCapabilityId: "feed-gemini-api-once",
    sensitiveOperation: true,
    allowedForAiActionPlan: false,
    allowedForUserRequirement: false,
    failurePolicy: "review_required",
  },
  {
    actionCode: "FEED_GEMINI_WEB_CHAT_ONCE",
    type: "atomic",
    displayName: "Feed Gemini Web Chat Once",
    abilityGroupId: "ai-input-gateway",
    childCapabilityId: "feed-gemini-web-chat-once",
    sensitiveOperation: true,
    allowedForAiActionPlan: false,
    allowedForUserRequirement: false,
    failurePolicy: "review_required",
  },
  {
    actionCode: "FEED_GPT_WEB_CHAT_ONCE",
    type: "atomic",
    displayName: "Feed GPT Web Chat Once",
    abilityGroupId: "ai-input-gateway",
    childCapabilityId: "feed-gpt-web-chat-once",
    sensitiveOperation: true,
    allowedForAiActionPlan: false,
    allowedForUserRequirement: false,
    failurePolicy: "review_required",
  },
] as const;
```

## 6. Gemini API 投喂子能力

子能力：

```txt
FEED_GEMINI_API_ONCE
```

要求：

```txt
必须复用现有 src/lib/online-ai 的 Gemini API 能力
但不得让业务插件直接 import invokeGemini
必须记录 modelName
必须记录 rawOutputRef/rawOutputHash
必须把 Gemini API 错误包装成 failed/review_required
```

禁止：

```txt
不得把 API key 打进日志
不得把完整 prompt 打进普通日志
不得无上限 retry
```

## 7. Gemini Web Chat 投喂子能力

子能力：

```txt
FEED_GEMINI_WEB_CHAT_ONCE
```

行为：

```txt
1. 获取 BrowserTabLease
2. 打开或切换到 Gemini Web Chat 页面
3. 检查是否已登录
4. 如果未登录，review_required
5. 如果出现安全验证，review_required
6. 定位输入框
7. 输入 prompt
8. 如支持文件，上传 approved inputRefs
9. 提交
10. 等待回答稳定
11. 抽取最后一条 AI 回答
12. 保存 raw output
13. 尝试恢复原任务页
14. 返回 AiFeedResult
```

## 8. GPT Web Chat 投喂子能力

子能力：

```txt
FEED_GPT_WEB_CHAT_ONCE
```

重要边界：

```txt
这是 ChatGPT / GPT 网页聊天窗口适配器，不是 OpenAI API。
第一期不需要 OPENAI_API_KEY。
不得伪装成 API。
不得绕过网页限制。
```

行为与 Gemini Web Chat 类似：

```txt
获取 BrowserTabLease
打开 GPT Web Chat 页面
检查登录 / 安全验证
定位输入框
输入 prompt
上传 approved inputRefs
等待回答稳定
提取最后回答
保存 raw output
恢复原任务页
返回 AiFeedResult
```

## 9. 和 Product Video Judge 的对接方式

当前 product-video 业务不得直接调用 Gemini API。

正确结构：

```txt
src/capabilities/ai/
  └─ product-video-judge-once
        -> build product-video-judge-v1 prompt
        -> choose providerKind
        -> call ai-input-gateway
        -> validate ProductVideoJudgeOutputSchema
        -> return judge result

src/plugins/product-video-dom-runtime/
  └─ calls product-video-judge-once
```

第一期可以先做中间过渡：

```txt
product-video-dom-runtime 仍保留旧路径作为 fallback
但新路径必须存在并通过 acceptance 测试
后续再删旧 invokeGemini 直连
```

## 10. Provider 选择策略

第一期配置：

```ts
type AiProviderPreference = {
  productVideoJudge: "gemini-api" | "gemini-web-chat" | "gpt-web-chat";
  visualMissionJudge: "gemini-api";
};
```

建议默认：

```txt
visualMissionJudge -> gemini-api
productVideoJudge -> gemini-api
```

网页版 provider 先作为可选实验通道：

```txt
productVideoJudge -> gemini-web-chat
productVideoJudge -> gpt-web-chat
```

原因：

```txt
Web Chat 投喂会占用浏览器 tab，必须先通过 TabOwnership 验收，否则会导致种草视频浏览页漂移。
```

## 11. Browser Tab Lease 施工要求

新增或复用：

```txt
src/lib/browser/browser-tab-lease.ts
```

最小字段：

```ts
type BrowserTabLease = {
  leaseId: string;
  owner: "ai-input-gateway" | "product-video-dom-runtime" | string;
  sourceUrl: string | null;
  acquiredAt: string;
};
```

Web Chat adapter 必须：

```txt
acquire lease
record sourceUrl
perform feed
restore sourceUrl or return review_required
release lease
```

第一期如果无法实现真正 tab handle，也必须做到：

```txt
记录 sourceUrl
投喂完成后 browser.open({ url: sourceUrl })
等待 source 页面恢复
恢复失败 -> review_required
```

## 12. 验收脚本

新增：

```txt
scripts/acceptance/ai-input-gateway-smoke.ts
scripts/acceptance/ai-input-gateway-web-chat-fixture-smoke.ts
```

`package.json` scripts：

```json
{
  "scripts": {
    "acceptance:ai-input-gateway-smoke": "node --import tsx scripts/acceptance/ai-input-gateway-smoke.ts",
    "acceptance:ai-input-gateway-web-chat-fixture-smoke": "node --import tsx scripts/acceptance/ai-input-gateway-web-chat-fixture-smoke.ts"
  }
}
```

必测：

```txt
1. FEED_GEMINI_API_ONCE 可调用 mock 或真实配置
2. FEED_GEMINI_WEB_CHAT_ONCE 可在 fixture 页面完成：
   - 定位输入框
   - 输入 prompt
   - 等待模拟回答
   - 提取回答
   - 返回 AiFeedResult
3. FEED_GPT_WEB_CHAT_ONCE 可在 fixture 页面完成同样流程
4. 业务插件不得直接 import src/lib/online-ai
5. Web Chat adapter 不读取 cookie/localStorage/sessionStorage
6. rawOutputRef/rawOutputHash 存在
7. parseStatus 正确
```

## 13. 必跑命令

```bash
npm run typecheck
npm run build
npm run audit:dom-automation
npm run acceptance:dom-automation-smoke
npm run acceptance:ai-input-gateway-smoke
npm run acceptance:ai-input-gateway-web-chat-fixture-smoke
```

如果项目有：

```bash
npm run ci:full
```

也必须跑。

## 14. 阶段完成定义

第一期完成后，系统应达到：

```txt
1. 有独立 ai-input-gateway 能立组。
2. 有 3 个第一期子能力：
   - FEED_GEMINI_API_ONCE
   - FEED_GEMINI_WEB_CHAT_ONCE
   - FEED_GPT_WEB_CHAT_ONCE
3. 当前 AI 能立组可以通过 AI Input Gateway 调 provider。
4. Product Video Judge 不再需要直接 invokeGemini。
5. Web Chat 投喂具备安全边界：
   - 不自动登录
   - 不绕过验证
   - 不读 token/cookie/storage
   - 有 tab ownership
   - 有 proof
6. 所有投喂结果都有统一 AiFeedResult。
```

## 15. 禁止伪完成

以下不算完成：

```txt
只写文档，没有 src/capabilities/ai-input-gateway
只把 invokeGemini 换个名字，没有 provider adapter 边界
业务插件仍然直接调用 invokeGemini
Gemini Web Chat adapter 没有 fixture smoke
GPT Web Chat adapter 没有 fixture smoke
Web Chat 投喂后不能恢复原任务页
没有 rawOutputRef/rawOutputHash
没有 parseStatus/schemaValidationStatus
把 AI 投喂能立组写成产品视频判断能立组
```

## 16. 最终边界

```txt
AI 能立组负责判断。
AI 投喂能立组负责投递。
Provider Adapter 负责具体通道。
业务插件只负责编排。
```
