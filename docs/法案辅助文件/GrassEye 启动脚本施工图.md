# 《GrassEye 启动脚本施工图》

## 基本身份

- 从属权威：
  - .github/instructions/cursor-rules/modules/module-local-app-shell.instructions.md
  - .github/instructions/cursor-rules/modules/module-code-topology.instructions.md
  - .github/instructions/cursor-rules/modules/module-audit-system.instructions.md
- 角色：GrassEye 本地启动脚本的建造级落地映射，不是第二法案
- 原则：疑问以上位法案为准；本图可删减，不改法案成立性
- 版本：1.0

## 范围声明

本施工图只服务 GrassEye 本地启动脚本的职责拆分、依赖检查、服务启动、健康确认和自动打开主页面。

本施工图不服务：
- Agent 业务逻辑
- AI 调用逻辑
- OCR 逻辑
- 平台点击逻辑
- 产品信号逻辑
- 数据库 schema
- 法案修复
- generated artifacts 手工修改
- 运行数据修复

## 一句话原则

启动脚本只做本地启动前准备、启动服务、健康检查和打开主页面；它不是万能修复脚本，也不是业务主链。

## 启动链路矩阵

| 阶段 | 对象 | 作用 | 失败处理 | 不应承担 |
| --- | --- | --- | --- | --- |
| 1 | dependency-check | 检查 Node/npm/package/lockfile/node_modules | 输出原因并停止或安装依赖 | 改业务代码、改法案 |
| 2 | dependency-install | 在安全边界内运行 npm install | install 失败即停止 | 静默 major upgrade |
| 3 | process-control | 启动本地服务 | 启动失败即停止 | 改 server 实现 |
| 4 | health-check | 等待健康接口 | 超时输出错误 | 假装启动成功 |
| 5 | open-main-page | 打开本地主页面 | 打开失败提示手动 URL | 处理业务状态 |
| 6 | startup-summary | 输出启动结果 | 明确下一步 | 隐藏失败 |

## 端口纯洁性要求

- 每次启动前必须先强制清理 canonical localhost 端口监听者。
- 不允许复用旧的健康进程作为“捷径成功”。
- 如果多轮 TERM / KILL 后端口仍未释放，启动必须直接失败并输出剩余 PID。
- 端口清理属于 process-control 边界，不得在 launch 入口内扩散成业务修复逻辑。

## 文件落位矩阵

| 文件 | 职责 |
| --- | --- |
| scripts/startup/launch-grasseye.mjs | 唯一启动入口，编排 helper |
| scripts/startup/lib/dependency-check.mjs | 检查 Node/npm/package/lockfile/node_modules |
| scripts/startup/lib/process-control.mjs | 启动和管理本地服务进程 |
| scripts/startup/lib/health-check.mjs | 轮询本地健康接口 |
| scripts/startup/lib/open-main-page.mjs | 使用系统命令打开本地主页面 |

## 依赖策略矩阵

| 情况 | 处理 |
| --- | --- |
| Node 缺失 | 输出错误并停止 |
| Node 版本低于 package 要求 | 输出错误并停止 |
| npm 缺失 | 输出错误并停止 |
| package-lock 缺失 | 运行 npm install 生成 |
| node_modules 缺失 | 运行 npm install |
| package.json 比 node_modules 新 | 运行 npm install |
| package-lock 与 package 不一致 | 运行 npm install |
| patch/minor 安装修复 | 允许按 lock/package 修复 |
| major upgrade | 不自动执行，提示 operator |
| npm install 失败 | 停止并输出日志 |

## 页面打开策略

| 系统 | 命令 |
| --- | --- |
| macOS | open <url> |
| Windows | start <url> |
| Linux | xdg-open <url> |

第一阶段以 macOS 为主，但脚本可以保留跨平台最小兼容。

## 验收线

| 验收对象 | 建对表现 | 漂移信号 |
| --- | --- | --- |
| 启动入口 | 一条命令启动 | 多个 root 启动脚本 |
| 依赖检查 | 明确检查并输出状态 | 静默失败 |
| 自动安装 | 只按 package/lock 修复 | 自动 major upgrade |
| 服务启动 | 健康接口通过后才打开页面 | 页面先打开但服务未启动 |
| 打开页面 | 自动打开 localhost 主页面 | 要用户手动找地址 |
| 职责边界 | 不碰业务逻辑 | 启动脚本开始修代码/改 schema |
| 失败处理 | 清楚报错 | 假装成功 |

## 冷路径说明

- 启动脚本不是修复脚本。
- 启动脚本不是依赖升级机器人。
- 启动脚本不处理业务数据。
- 启动脚本不改法案。
- 启动脚本不改 generated artifacts。
- 如果需要 major dependency upgrade，应进入单独升级任务，不在启动脚本里静默完成。

## 结束语

本施工图只把 GrassEye 启动脚本的职责边界和落位说清，不新增权威，不替代法案，不改变业务主链。