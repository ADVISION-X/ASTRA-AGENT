# 《GrassEye 本地模型选型施工图》

## 基本身份

- 从属权威：
  - .github/instructions/cursor-rules/modules/module-local-ai-runtime.instructions.md
  - .github/instructions/cursor-rules/modules/module-code-topology.instructions.md
  - .github/instructions/cursor-rules/modules/module-audit-system.instructions.md
- 角色：GrassEye 本地模型角色、推荐配置、运行时选择、失败策略的建造级落地映射，不是第二法案
- 原则：疑问以上位法案为准；本图可删减，不改法案成立性
- 版本：1.0

## 范围声明

本施工图只服务 GrassEye 第三阶段本地 AI 模型角色配置、模型运行时、默认推荐组合、失败处理和验收映射。

本施工图不服务：
- 云端 AI 接入
- 付费 API
- 模型安装教程
- 模型 benchmark
- 真实平台 adapter
- 浏览器自动化
- 数据库 schema
- UI 本地化
- 评论翻译

## 一句话原则

GrassEye 第三阶段必须使用受治理的本地模型角色配置：视觉识别、OCR、评论理解、产品信号分别有明确本地执行角色；模型不可用时进入 retry / skip / operator review，不自动转云端，不用 mock 冒充真实 AI。

## 本地模型角色矩阵

| 角色 | 配置 key | 作用 | 推荐本地运行时 | 推荐起步模型/工具 | 失败策略 |
|---|---|---|---|---|---|
| Vision Model | vision | 判断真实视频截图是否产品种草 | Ollama / llama.cpp | Qwen2.5-VL 3B 起步，7B 可选 | retry / operatorReview |
| OCR Engine | ocr | 识别评论截图文字 | PaddleOCR / Apple Vision / local OCR wrapper | PaddleOCR 或 Apple Vision OCR | retry / operatorReview |
| Comment Understanding | commentUnderstanding | 从评论文本提取购买意图、痛点、质疑 | Ollama / llama.cpp | Qwen2.5 3B/7B Instruct 类文本模型 | skip / operatorReview |
| Product Signal | productSignal | 生成产品机会候选、风险和初步评分 | Ollama / llama.cpp | Qwen2.5 3B/7B Instruct 类文本模型 | candidateReview / operatorReview |

## M2 16GB 推荐策略

| 目标 | 建议 |
|---|---|
| 稳定优先 | 视觉模型先用 3B |
| 准确优先 | 机器不卡时再试 7B |
| OCR | 优先使用专业 OCR，不强迫视觉大模型抄字 |
| 评论理解 | 文本模型即可，不必用视觉模型 |
| 产品信号 | 文本模型即可，必须结构化输出 |
| 失败处理 | 不自动云端 fallback |

## 配置文件职责

| 文件 | 职责 |
|---|---|
| config/local-ai.models.json | 当前启用的本地模型角色配置 |
| src/lib/local-ai/model-config.ts | 读取和校验模型配置 |
| src/lib/local-ai/local-ai-gateway.ts | 根据模型角色调用本地执行路径 |
| scripts/audit/domains/local-ai-runtime/inspector.ts | 检查配置完整性和禁止项 |

## 配置字段矩阵

| 字段 | 作用 |
|---|---|
| role | vision / ocr / commentUnderstanding / productSignal |
| provider | local provider 类型，不得为 cloud |
| runtime | ollama / llama.cpp / paddleocr / apple-vision / local-ocr / local-wrapper |
| model | 本地模型名或本地工具名 |
| executionMode | local-only |
| promptVersion | 绑定 prompt registry |
| schemaVersion | 绑定输出 schema |
| failureBehavior | retry / skip / operatorReview / candidateReview |
| requiredForPhase | phase-03 |
| allowMock | 第三阶段验收必须 false |
| allowCloudFallback | 必须 false |

## 不允许配置

| 禁止项 | 原因 |
|---|---|
| provider = cloud | 违背本地 AI 主权 |
| provider = paid-api | 违背本地执行链 |
| allowCloudFallback = true | 违背 silent fallback 红线 |
| allowMock = true 且用于 phase-03 acceptance | 会假装真实 AI |
| missing role | 模型分工不完整 |
| empty model | 无法追溯本地执行 |
| model 写散在业务代码 | 破坏配置主权 |

## 验收线

| 验收对象 | 建对表现 | 漂移信号 |
|---|---|---|
| model config | 四个角色完整 | 缺 vision / ocr / commentUnderstanding / productSignal |
| provider | local-only | cloud / paid-api |
| gateway | 从配置读角色 | 代码里硬编码模型名 |
| audit | 能拦 cloud / mock / 缺角色 | mock-only 也能 PASS |
| phase3 | 真实截图使用本地模型配置 | heuristic 假装 AI |

## 冷路径说明

- 本施工图不要求永久锁死某个模型品牌。
- 当前推荐模型可随本地机器能力调整。
- 如果本地模型未安装，系统应提示 operator 安装或选择 review，不得自动转云端。
- 如果未来要引入云端模型，必须另行立法，不能偷渡到 local-ai-runtime。