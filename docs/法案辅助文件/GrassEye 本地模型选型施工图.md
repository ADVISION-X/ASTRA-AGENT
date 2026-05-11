# GrassEye 本地模型选型施工图 FINAL

## 文件身份

- owner: ai-capability
- authority: .github/instructions/cursor-rules/modules/module-ai-capability.instructions.md
- subAuthority: .github/instructions/cursor-rules/modules/module-local-ai-runtime.instructions.md
- status: active
- purpose: 说明当前阶段唯一有效的本地模型路径与配置原则

## 一句话原则

当前阶段不做多 provider 选型，只保留一个受治理本地模型路径供 visual-mission-judge-once 使用。

## 当前有效口径

- active child capability: visual-mission-judge-once
- active task type: visual_mission_judgment
- active prompt contract: visual-mission-judge-v1
- active model path: local model call
- config source: config/local-ai.models.json

## 模型选择原则

当前阶段只要求：
- 模型必须来自本地配置
- provider 必须是 local
- executionMode 必须是 local-only
- allowCloudFallback 必须是 false
- paid/future provider 不进入生产主链

推荐方向：
- 视觉判断使用当前本地视觉模型配置
- 文字和 OCR 角色不作为 AI child 真相公开暴露
- 若本地模型不可用，返回 failed 或 review_required，不做 fallback

## 不再承认的旧结构

以下结构不再是当前阶段真相：
- visual-observation / ocr-extraction / text-reasoning 作为公开 child
- provider roster
- provider registry
- paid provider policy gate
- future provider gate
- role control panel 作为 AI 主链

## 验收信号

建对表现：
- 配置只服务单一本地模型主线
- 无 cloud / paid / future fallback
- 运行失败直接显式返回失败原因

漂移信号：
- 新增 provider allowlist 生产链
- 新增 paid/future provider 生产 child
- 通过兼容桥或别名偷偷保留旧 provider 体系
- 用多模型路由替代单一受治理本地调用

## Local AI 模型输入图片安全边界

Local AI runtime 在模型调用前负责图片安全归一化处理。  
Screenshot 取证产物保持原始真相不变，归一化仅在内存中进行，不写入磁盘。

### 当前限制常量

- **`MAX_VISION_IMAGE_LONG_EDGE_PX = 1120`**（定义于 `src/lib/local-ai/model-safe-image.ts`）
- `MAX_VISION_IMAGE_BYTES = 1_000_000`（源文件字节安全门，保留不变）

### 规格来源（qwen2.5vl:3b patch 预算）

- 视觉 patch 大小：224×224 px
- 安全长边：5 patch × 224 = **1120 px**
- 双图 prompt：5×5 patches × 2 张 = 50 patches（3B 上下文窗口安全）
- 超过 1120 px（如 2446 px）：11×11 × 2 = 242 patches → `GGML_ASSERT` 崩溃

### 责任边界

- ✅ `src/lib/local-ai/model-safe-image.ts`：负责检测尺寸、按需 resize、返回 `ModelSafeImageInput`
- ✅ `src/lib/local-ai/call-local-model.ts`：调用 `prepareModelSafeImage`，将元数据写入 `AI_REQUEST_DEBUG` 日志
- ✅ `src/lib/local-ai/ollama-client.ts`：接收已归一化的 `imageBase64s`，不再持有文件读取责任
- ❌ `src/capabilities/screenshot/**`：不得修改。Screenshot 只输出原始证据
- ❌ `src/capabilities/forensics-persistence/**`：不得修改。取证链不参与图片归一化
- ❌ `src/capabilities/geometry-guard/**`：不得修改。几何安全守卫不参与图片归一化

## Ollama API 端点规格

### 强制规定（防止 chat-template token 泄漏）

- **必须使用 `/api/chat`**，禁止使用 `/api/generate`。
- qwen2.5vl:3b 是 Chat-Instruct 调优模型。使用 `/api/generate` 时，模型输出 `<|im_start|>` 等 chat-template token（而非 JSON 内容），导致 `json_parse_failed` → `review_required`。
- `/api/chat` 使用正确的消息角色结构（`role: "user"` + `images`），模型能正确定位 assistant turn 开始输出 JSON。

### 接口对比

| 项目 | `/api/generate`（❌ 禁止） | `/api/chat`（✅ 唯一合法） |
|---|---|---|
| 输入格式 | `{ model, prompt, images, stream }` | `{ model, messages:[{role,content,images}], stream }` |
| 响应字段 | `{ response: string }` | `{ message: { role, content } }` |
| 模型输出质量 | chat token 泄漏 → 垃圾输出 | 正常 JSON 输出 |

### 执法约束

- `invokeOllama` 必须调用 `/api/chat` URL。
- `invokeOllama` 禁止出现 `/api/generate` 字符串。
- 执法脚本 CHECK-12 / CHECK-13 负责 AST 级强制执行。

### 归一化失败行为

失败即抛出 `MODEL_IMAGE_NORMALIZATION_FAILED:` 前缀错误，不做静默降级，不允许发送超尺寸图片。

