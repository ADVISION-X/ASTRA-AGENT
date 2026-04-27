# 《GrassEye 本地化施工图》

## 基本身份

- 从属权威：
  - .github/instructions/cursor-rules/modules/module-localization.instructions.md
  - .github/instructions/cursor-rules/modules/module-code-topology.instructions.md
  - .github/instructions/cursor-rules/modules/module-audit-system.instructions.md
- 角色：GrassEye 本地工作台中英文手动切换与 UI 文案治理的建造级落地映射，不是第二法案
- 原则：疑问以上位法案为准；本图可删减，不改法案成立性
- 版本：1.0

## 范围声明

本施工图只服务 operator-facing UI 的 English / 中文 手动切换、文案 key、字典完整性、页面消费方式和审计验收。

本施工图不服务：
- AI 翻译
- 评论翻译
- OCR 翻译
- 产品数据翻译
- 平台内容翻译
- 云端翻译 API
- 多语言 CMS
- 浏览器自动化

## 一句话原则

GrassEye 页面文案通过本地字典治理，操作者可以手动在 English / 中文 之间切换；数据内容不被强制翻译，UI 文案不散落硬编码。

## 语言策略矩阵

| 对象 | 策略 |
| --- | --- |
| 默认语言 | English |
| 可选语言 | English / 中文 |
| 切换方式 | 页面手动切换 |
| 持久方式 | query 参数或本地 cookie / localStorage |
| 云端翻译 | 不使用 |
| AI 运行时翻译 | 不使用 |
| 数据内容 | 保持原文 |
| UI 文案 | 使用 dictionary key |

## 文件落位矩阵

| 文件 | 职责 |
| --- | --- |
| src/lib/localization/dictionaries.ts | en / zh 字典 |
| src/lib/localization/locale.ts | locale 解析、合法性校验、fallback |
| src/lib/localization/render-text.ts | 文案读取 helper |
| src/features/operator-control/console-view.ts | 消费本地化 helper 渲染 UI |
| scripts/audit/domains/localization/manifest.json | localization owner manifest |
| scripts/audit/domains/localization/inspector.ts | localization owner inspector |

## 文案 key 矩阵

| 类型 | key 示例 |
| --- | --- |
| 页面标题 | `app.title` |
| 副标题 | `app.subtitle` |
| 语言切换 | `language.english`, `language.chinese` |
| 状态区 | `runtime.status`, `runtime.agentStatus` |
| 控制按钮 | `actions.start`, `actions.pause`, `actions.stop`, `actions.runDemo` |
| 候选池 | `candidate.pool`, `candidate.score`, `candidate.risk` |
| 证据区 | `evidence.preview`, `evidence.localOnlyPath` |
| 日志区 | `logs.actionLogs` |
| Debug 区 | `debug.title`, `debug.description` |
| 空状态 | `empty.noCandidates`, `empty.noEvidence` |
| 错误区 | `error.title`, `error.noActiveErrors` |

## 不翻译矩阵

| 对象 | 是否翻译 | 原因 |
| --- | --- | --- |
| candidate category | 否，除非后续有数据翻译法案 | 这是数据值 |
| evidence summary | 否 | AI / OCR / 平台证据 |
| comment text | 否 | 用户评论原文 |
| file path | 否 | 本地证据路径 |
| task id / round id | 否 | 系统 ID |
| timestamp | 否 | 数据字段 |
| prompt output | 否 | AI 输出 |

## 验收线

| 验收对象 | 建对表现 | 漂移信号 |
| --- | --- | --- |
| 语言切换 | 页面可手动切换 en / zh | 只能英文或只能中文 |
| 字典 | 每个 key 都有 en / zh | 缺少某种语言 |
| UI 文案 | 使用 key 渲染 | server HTML 到处硬编码 |
| 数据内容 | 保持原文 | 强行翻译 evidence / comment |
| 审计 | 能发现缺 key / 硬编码 | localization owner 只空 PASS |

## 冷路径说明

- 本阶段不做阿拉伯语、日语等更多语言。
- 本阶段不做 AI 翻译。
- 本阶段不做评论翻译。
- 本阶段不做产品数据翻译。
- 后续如果扩展更多语言，必须先扩展 localization dictionary contract。