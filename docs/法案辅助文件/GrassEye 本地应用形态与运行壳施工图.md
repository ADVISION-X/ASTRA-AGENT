# 《GrassEye 本地应用形态与运行壳施工图》

## 基本身份

- 从属权威：
  - .github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.md
  - .github/instructions/cursor-rules/modules/module-local-app-shell.instructions.md
  - .github/instructions/cursor-rules/modules/module-security-privacy.instructions.md
  - .github/instructions/cursor-rules/modules/module-code-topology.instructions.md
  - .github/instructions/cursor-rules/modules/module-operator-control.instructions.md
  - .github/instructions/cursor-rules/modules/module-local-data.instructions.md
- 角色：GrassEye 本地应用形态、运行壳分层、桌面封装路径的建造级落地映射，不是第二法案
- 原则：疑问以上位法案为准；本图可删减，不改法案成立性
- 版本：1.0

## 范围声明

本施工图只服务 GrassEye 第一阶段的产品形态、运行壳分层、本地控制台、本地 Agent、本地浏览器、本地 AI、本地数据与后续桌面包装映射。

本施工图不服务：
- 真实 UI 页面实现
- Electron / Tauri / SwiftUI 代码
- Playwright 实现
- 本地 AI 调用实现
- OCR 实现
- 数据库 schema
- 云端部署
- SaaS 方案
- 浏览器插件方案

## 一句话原则

GrassEye 最终是 macOS 本地桌面工作台；第一阶段先以 localhost operator console + local agent service 跑通主链，后期再封装成 GrassEye.app。

## 产品形态决策矩阵

| 形态 | 第一阶段结论 | 原因 | 风险 |
| --- | --- | --- | --- |
| macOS 本地桌面应用 | 最终目标 | 符合本地 AI、本地浏览器、本地证据库 | 第一阶段直接原生开发成本高 |
| localhost 本地控制台 | 第一阶段实现形态 | 迭代最快，适合 Agent 控制和 review | 需要后续包装为 App |
| SaaS Web App | 不作为第一阶段形态 | 违背本地优先，涉及账号、截图、cookie 风险 | 隐私与平台风险高 |
| 浏览器插件 | 不作为主壳 | 本地 AI、证据库、review 能力受限 | 权限复杂 |
| CLI | 不作为主体验 | 不适合人工 review 和状态控制 | 操作者不可见 |
| SwiftUI 原生 App | 后续可评估 | Mac 体验好 | 第一阶段浏览器自动化和本地 AI 接入慢 |
| Electron | 后续包装候选 | Node / Playwright / 本地服务兼容好 | 体积较大 |
| Tauri | 后续包装候选 | 轻量 | sidecar 与自动化集成复杂 |

## 本地运行壳矩阵

| 层级 | 对象 | 第一阶段形态 | 角色 | 不应承担 |
| --- | --- | --- | --- | --- |
| Operator UI | Local Web Console | localhost | 控制、暂停、停止、review、候选池 | 浏览器自动化、AI 调用、数据真相 |
| Agent Runtime | Local Agent Service | 本地 Node/TS 服务 | observe/classify/act/record 编排 | UI 视觉展示、模型内部推理 |
| Browser Control | BrowserController | 本地浏览器控制层 | click/scroll/capture 原子动作 | 产品判断、评论理解 |
| Platform Adapter | Adapter Layer | 本地适配层 | 平台差异收敛 | Core 主链、AI 判断 |
| Local AI | Local AI Gateway | 本地模型入口 | 模型分工、结构化输出 | 平台动作、数据真相 |
| Local Data | Evidence Store | 本地数据库/文件 | 截图、OCR、AI 结果、动作日志、候选记录 | 云端默认同步、最终商业决策 |
| Desktop Wrapper | Future Mac Shell | 后期包装 | 启动、停止、监督本地组件 | 重写业务主链 |

## 第一阶段最小实现形态

| 顺序 | 建设对象 | 目标 | 验收表现 |
| --- | --- | --- | --- |
| 1 | Local Operator Console | 操作者能看到任务状态和候选记录 | UI 只做控制与 review |
| 2 | Local Agent Service | 本地执行 observe/classify/act/record | 不依赖公网服务 |
| 3 | BrowserController | 本地浏览器动作封装 | UI 不直接点页面 |
| 4 | PlatformAdapter | 单平台适配 | 平台知识不泄漏到 Core |
| 5 | Local AI Gateway | 本地 AI 调用入口 | 不自动走付费/云端 API |
| 6 | Local Evidence Store | 本地证据保存 | 可追溯、可删除、可导出 |
| 7 | Packaging Preparation | 预留 Mac App 包装边界 | 包装层不拥有业务主权 |

## 进程边界矩阵

| 进程 / 服务 | 是否本地 | 是否可公开暴露 | 职责 |
| --- | --- | --- | --- |
| Operator Console | 是 | 否 | 操作者控制台 |
| Agent Service | 是 | 否 | Agent 主循环 |
| Browser Session | 是 | 否 | 用户授权浏览器会话 |
| Local AI Service | 是 | 否 | 本地模型执行 |
| Local Data Store | 是 | 否 | 证据和候选记录 |
| Desktop Wrapper | 是 | 否 | 本地壳与生命周期管理 |

## 后期包装路线矩阵

| 包装方式 | 适合阶段 | 优点 | 风险 | 结论 |
| --- | --- | --- | --- | --- |
| Electron | 第二阶段候选 | 与 Node / Playwright 兼容直接 | 体积大 | 优先评估 |
| Tauri | 第二阶段候选 | 轻量 | sidecar 复杂 | 后评估 |
| SwiftUI | 第三阶段候选 | 原生体验好 | 开发慢、桥接多 | 后置 |
| 纯 Web | 不推荐 | 部署简单 | 违背本地优先 | 不作为主形态 |
| 插件 | 辅助候选 | 页面内能力强 | 主控弱 | 非主壳 |

## 验收线

| 验收对象 | 建对表现 | 漂移信号 |
| --- | --- | --- |
| 产品形态 | 本地 workbench，后期 Mac app | 变成 SaaS 或远程浏览器 |
| Operator UI | 控制和 review | 直接拥有浏览器点击和 AI 调用 |
| Agent Service | 本地编排 | 云端托管主循环 |
| Browser Session | 本机授权会话 | 远程保存 cookie/session |
| Local AI | 本地执行 | 静默调用云端/付费 API |
| Local Data | 本地证据库 | 默认远程存储 |
| Desktop Wrapper | 包装本地链路 | 复制业务逻辑 |

## 冷路径说明

- 第一阶段不要求完成 GrassEye.app 打包。
- 第一阶段不要求 Electron、Tauri、SwiftUI 选型定死。
- 第一阶段只要求运行形态不偏航：localhost console + local agent service。
- 后续如果要做 SaaS、插件、移动端，必须另行立法，不得偷渡进第一阶段。
- 本施工图可删减；若与法案冲突，以上位法案为准。

## 结束语

本施工图只把 GrassEye 的本地应用形态和运行壳分层说清，不新增权威，不替代法案，不提前实现桌面包装。