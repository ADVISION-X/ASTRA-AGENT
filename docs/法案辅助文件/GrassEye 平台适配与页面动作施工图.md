# 《GrassEye 平台适配与页面动作施工图》

## 基本身份

- 从属权威：
  - .github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.md
  - .github/instructions/cursor-rules/modules/module-platform-action.instructions.md
  - .github/instructions/cursor-rules/modules/module-code-topology.instructions.md
  - .github/instructions/cursor-rules/modules/module-type-safety.instructions.md
- 角色：平台适配与页面动作的建造级落地映射，不是第二法案
- 原则：疑问以上位法案为准；本图可删减，不改法案成立性
- 版本：1.0

## 范围声明

本施工图只服务 GrassEye 第一阶段的平台适配结构、浏览器动作边界、页面动作落位与验收映射。

本施工图不服务：
- 真实业务代码实现
- 平台 selector 细节
- 反风控绕过
- 账号增长
- OCR 逻辑
- AI 模型调用
- 产品评分规则
- 数据库 schema

## 一句话原则

GrassEye Core 平台中立，平台差异收敛到 PlatformAdapter，底层浏览器能力收敛到 BrowserController。

## 主链映射矩阵

| 层级 | 对象 | owner | 角色 | 输入 | 输出 | 不应承担 |
| --- | --- | --- | --- | --- | --- | --- |
| Core | AgentRuntime | agent-runtime | 单轮 observe/classify/act/record 编排 | 结构化结果、operator 指令 | 下一步动作请求 | 平台 selector、裸坐标、平台页面知识 |
| Adapter | PlatformAdapter | platform-action | 平台页面动作适配 | 抽象动作请求 | 平台动作结果 | AI 判断、产品评分、评论语义 |
| Browser | BrowserController | platform-action / src/lib/browser | 浏览器底层能力封装 | click/scroll/capture 请求 | 原子浏览器动作结果 | 业务决策、平台策略 |
| Vision | VisionClassifier | vision-boundary | 图像判断 | 视频区域截图 | 分类、置信度、建议动作 | 直接点击页面 |
| Evidence | ActionLog / EvidenceRecord | local-data | 证据与动作留痕 | 动作结果、截图引用 | 可追溯记录 | 商业最终结论 |

## 平台接入矩阵

| 平台 | 第一阶段状态 | 接入方式 | 允许对象 | 不应进入 |
| --- | --- | --- | --- | --- |
| Facebook Web | 候选首平台 | 单 adapter | 视频区、评论区、有限动作 | 账号池、批量互动、私信 |
| TikTok Web | 后续候选 | 单 adapter | 视频区、评论区、有限动作 | 风控绕过、批量互动 |
| YouTube Shorts Web | 后续候选 | 单 adapter | 视频区、评论区、有限动作 | 抓取私有内容 |
| Instagram Reels Web | 后续候选 | 单 adapter | 视频区、评论区、有限动作 | 登录绕过、私信采集 |

第一阶段施工建议为：只选择一个平台跑通主链。

## 页面动作策略矩阵

| 动作 | 优先策略 | 备用策略 | 证据要求 | 风险边界 |
| --- | --- | --- | --- | --- |
| scroll | adapter 封装滚动 | 无 | action log | 不得无限滚动 |
| open video | adapter 封装入口 | 坐标备用 | 当前页面证据 | 不得跨平台乱跳 |
| screenshot video area | region capture | 无 | image evidence | 不截无关敏感区域 |
| click not interested | DOM/可访问性语义优先 | 坐标备用 | classification + action log | 不得批量滥用 |
| like/save candidate | DOM/可访问性语义优先 | 坐标备用 | product classification + action log | 不得变成刷互动 |
| open comments | DOM/可访问性语义优先 | 坐标备用 | product classification + action log | 不得采集私信 |
| screenshot comments | region capture | 分段 capture | comment evidence | 不保存无关个人信息 |

## DOM 与坐标点击边界矩阵

| 点击方式 | 适用场景 | 优点 | 风险 | 落位 |
| --- | --- | --- | --- | --- |
| DOM / accessibility click | 元素可定位时 | 稳定、可审计 | selector 漂移 | PlatformAdapter 内部 |
| Coordinate click | DOM 不稳定或短视频按钮难定位时 | 不依赖文案 | 误点风险 | Adapter 内部 fallback |
| Raw click from Core | 不适用 | 无 | 混权、误点、不可审计 | 不应出现 |

## 第一阶段最小建设顺序

| 顺序 | 建设对象 | 目标 | 验收表现 |
| --- | --- | --- | --- |
| 1 | BrowserController 抽象 | 统一 click/scroll/capture | Core 不直接调用浏览器原语 |
| 2 | 单平台 PlatformAdapter | 跑通一个网页视频平台 | adapter 承接全部平台动作 |
| 3 | Video region capture | 获得视频区域证据 | 截图可绑定记录 |
| 4 | Comment region capture | 获得评论证据 | 评论截图可绑定视频记录 |
| 5 | Action log | 动作留痕 | 每次动作有记录 |
| 6 | Adapter output contract | 类型化结果 | runtime 不消费 loose object |

## 验收线

| 验收对象 | 建对表现 | 漂移信号 |
| --- | --- | --- |
| Core | 不含平台 selector、裸坐标、平台 URL 细节 | Core 直接引用 Facebook/TikTok DOM |
| PlatformAdapter | 持有平台页面知识 | 平台知识散落到 agent-runtime |
| BrowserController | 只做底层浏览器动作 | 开始判断产品、评论、商机 |
| ActionLog | 每个关键动作可回看 | 动作发生但无记录 |
| 坐标点击 | 只作为 adapter fallback | 被导出给多个 domain 调用 |
| 多平台 | 通过新增 adapter 扩展 | 为每个平台复制一套 Core |

## 冷路径说明

- 多平台支持属于后续扩展，不是第一阶段必须完成项。
- 第一阶段建议只接一个平台跑通主链。
- 施工图可以删除或缩减，不影响法案成立。
- 若施工图与法案冲突，以上位法案为准。

## 结束语

本施工图只把平台适配和页面动作的落地结构说清，不新增权威，不替代法案，不提前实现平台接入。