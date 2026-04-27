# 《GrassEye 文件路径与阶段目录施工图》

## 基本身份

- 从属权威：
  - .github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.md
  - .github/instructions/cursor-rules/modules/module-code-topology.instructions.md
  - .github/instructions/cursor-rules/modules/module-audit-system.instructions.md
- 角色：GrassEye 文件路径、阶段目录、文档归属和运行数据排除的建造级落地映射，不是第二法案
- 原则：疑问以上位法案为准；本图可删减，不改法案成立性
- 版本：1.0

## 范围声明

本施工图只服务 GrassEye 的仓库路径、阶段文件归属、文档类型分层、运行数据排除和长期迭代目录秩序。

本施工图不服务：
- 业务代码实现
- UI 页面实现
- 本地 AI 调用实现
- 浏览器自动化实现
- 数据库 schema
- 阶段任务优先级判断
- TODO 具体内容裁决

## 一句话原则

GrassEye 未来多阶段迭代必须文件路径清楚：法案归法案，施工图归施工图，阶段目标归阶段目标，TODO 归 TODO，提示词归提示词，验收报告归验收报告，运行数据不得进入仓库真相。

## 仓库根目录矩阵

| 路径 | 角色 | 可以放什么 | 不应放什么 |
| --- | --- | --- | --- |
| .github/instructions/cursor-rules/ | 法案系统 | Kernel、Index、module laws | TODO、施工图、业务方案 |
| docs/法案辅助文件/ | 施工图 | 从属施工图、建造级矩阵 | active law、TODO、验收报告 |
| docs/阶段目标/ | 阶段目标 | phase-xx 建设目标方案 | TODO、提示词、代码说明 |
| docs/TODO/ | 执行清单 | phase-xx TODO 计划 | 法案、施工图、验收报告 |
| docs/Codex提示词/ | 执行提示词 | phase-xx Codex loop prompt | 法案、施工图、运行日志 |
| docs/验收报告/ | 验收与完成报告 | phase-xx acceptance / completion report | TODO、施工图 |
| docs/归档/ | 历史材料 | inactive / superseded phase files | 当前 active 文件 |
| src/ | 应用代码 | route、features、lib、types | 文档、TODO、prompt |
| scripts/audit/ | 审计脚本 | owner inspector、audit tools | 业务脚本、运行数据 |
| local app data outside repo | 运行数据 | screenshots、OCR、evidence DB、cache | source truth |

## 阶段文件命名矩阵

| 文件类型 | 路径 | 命名建议 |
| --- | --- | --- |
| 阶段目标 | docs/阶段目标/ | phase-02-本地工作台最小闭环建设目标.md |
| 阶段 TODO | docs/TODO/ | phase-02-TODO.md |
| Codex 循环提示词 | docs/Codex提示词/ | phase-02-codex-loop.md |
| 验收报告 | docs/验收报告/ | phase-02-acceptance-report.md |
| 阶段完成报告 | docs/验收报告/ | phase-02-completion-report.md |
| 施工图 | docs/法案辅助文件/ | GrassEye <主题>施工图.md |
| 归档文件 | docs/归档/ | phase-xx-<原文件名>-archived.md |

## 文档权威矩阵

| 文档类型 | 是否主裁 | 作用 |
| --- | --- | --- |
| Kernel | 是 | 顶层系统身份与红线 |
| Index | 是，但只路由 | 定位模块 |
| module law | 是 | 单能力域主裁 |
| 施工图 | 否 | 建造映射 |
| 阶段目标 | 否 | 定义阶段完成态 |
| TODO | 否 | 执行清单 |
| Codex 提示词 | 否 | 执行入口 |
| 验收报告 | 否 | 记录完成证据 |
| 归档文件 | 否 | 历史参考 |

## 运行数据排除矩阵

| 数据 | 是否进入 repo | 推荐归属 |
| --- | --- | --- |
| 视频截图 | 否 | 本地 app data |
| 评论截图 | 否 | 本地 app data |
| OCR 原文 | 否 | 本地 evidence store |
| AI raw output | 否 | 本地 evidence store |
| 浏览器 cookie/session | 否 | 浏览器本地环境 |
| 本地模型 cache | 否 | 模型工具自己的本地目录 |
| evidence database | 否 | 本地 app data |
| 测试文件 / 测试 fixture | 否，不作为质量门禁来源 | 不进入仓库；质量由 scripts/audit 执法系统、typecheck、build 与本机实测维持 |

## 多阶段增长边界

| 阶段增长对象 | 应该怎么处理 | 漂移信号 |
| --- | --- | --- |
| 新阶段目标 | 放入 docs/阶段目标/ | 根目录出现新方案 |
| 新 TODO | 放入 docs/TODO/ | 多个 TODO 散落 |
| 新 Codex prompt | 放入 docs/Codex提示词/ | prompt 混在聊天记录或根目录 |
| 新施工图 | 放入 docs/法案辅助文件/ | 施工图写进 law home |
| 新验收报告 | 放入 docs/验收报告/ | 报告混在 TODO 或方案目录 |
| 旧阶段材料 | 移入 docs/归档/ 或明确 inactive | 旧文件继续被误读为 active |

## 验收线

| 验收对象 | 建对表现 | 漂移信号 |
| --- | --- | --- |
| law home | 只放法案 | 出现 TODO、方案、施工图 |
| docs | 按类型分目录 | 所有文件堆一个 docs |
| 阶段文件 | phase 编号清楚 | 无编号、无归属 |
| TODO | 只做执行清单 | 和阶段目标混写 |
| Codex prompt | 单独归档 | 散落在根目录 |
| 运行数据 | 不进 repo | 截图、OCR、DB 被提交 |
| 归档 | inactive 清楚 | 旧方案继续当现役 |

## 冷路径说明

- 本图不决定阶段优先级。
- 本图不决定 TODO 内容。
- 本图不新增法案。
- 本图只负责文件路径秩序。
- 若本图与法案冲突，以上位法案为准。

## 结束语

本施工图只把 GrassEye 长期多阶段迭代的文件路径秩序说清，不新增权威，不替代法案，不提前实现任何业务能力。
