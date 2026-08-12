# GrassEye 能力组与子能力总纲施工图

版本：2026-05-27  
状态：active

## 1. 系统身份

GrassEye 当前不是通用智能体。  
GrassEye 当前是岗位型自动化执行系统。

主架构只有一条：

```txt
User Requirement
  -> Job Mediator
      -> Business Flow Script
        -> Ability Groups
      -> Child Abilities
          -> Evidence and Logs
```

## 2. Owner 分工

### 2.0 Job Mediator

- 每个 active plugin 唯一入口固定为 `src/mediator/<job-id>-route.ts`
- 只做 schema parse、调用本 plugin 的明确任务入口、返回结构化结果
- App / Local Runtime 不得绕过 mediator 直连同一任务入口
- 不保存业务状态，不执行 Browser / DOM / capability 动作，不形成通用 dispatcher

### 2.1 Flow Script

- 拥有流程顺序
- 拥有业务分支
- 拥有 review_required 决策
- 直接调用浏览器、DOM、AI choice、evidence、runtime logs
- 调用能力组时只允许通过 `src/capabilities/<group-id>/index.ts`

### 2.2 Ability Group

- 只做同类型稳定动作
- 不懂业务
- 不决定流程
- 不拥有岗位真相
- public facade 是唯一外部入口
- 不得 import 其他 ability-group owner 的实现

### 2.3 Child Ability

- 只完成一个明确原子动作
- 属于且仅属于一个 ability group
- 不得 import 其他 ability-group owner 的代码

## 3. 当前现役能力组

- DOM Automation：snapshot、locate、fill、click、upload、wait、verify
- AI Input Gateway / Choice Judge：有限选项问题投递、provider proof、schema 校验
- Evidence Store / Forensics Persistence：step trace、artifact ref、失败原因、结果记录
- Video Download：媒体候选路由、下载、校验、artifact 生命周期
- Media Processing：图片/视频单次处理、产物生成、proof 输出、每次使用前最新依赖确认

## 3.1 当前基础设施 owner

- Browser：本地 Chrome 会话、open、wait、screenshot evidence、file input foundation
- Runtime Logs：FLOW / DEBUG / TRACE 结构化日志

Browser 与 Runtime Logs 是 `src/lib/**` 基础设施 owner，不是能力组，不得在 active 施工图、报告或 allowlist 中冒充 capability root。

## 4. 当前第一主线

第一主线只有：

```txt
Amazon invoice upload
```

样板 flow：

```txt
src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts
```

## 4.1 Active plugin mediator 闭合

`scripts/audit/config/plugin-status.json` 是 active plugin 清单；每项必须登记唯一 `mediatorRoute`，且物理路径必须精确等于 `src/mediator/<job-id>-route.ts`。每个 route export 还必须由 `mediatorBindings` 精确绑定自己的 `schemaExport` 与 `taskExport`。Inspector 通过 symbol-backed AST 证明 exports 全集相等、schema parse 结果真实进入 task、没有额外 call/state/helper、没有第二 mediator 文件，并证明 App / Local Runtime 没有绕过 route 直连该入口。对于 start/resume/retry/recover/continue/run/enqueue/generate/create/execute 生命周期方法，Inspector 还会从 Local Runtime wrapper 与 plugin export 的真实 symbol 反向发现未登记入口，避免 `mediatorBindings` 自己漏项后静默跳过。

## 5. 禁止项

- 通用流程调度器
- 中央总线
- 通用 mission loop
- AI 自主规划多步动作
- AI 输出浏览器命令
- job flow 直连 capability 非 facade 文件
- ability group 互相串 owner
- 流程真相落到 catalog、registry 或 UI 层
- active plugin 缺 mediator、多个 mediator、foreign-plugin mediator 或任务入口直连绕过

## 6. 目录原则

- 业务流程只留在 `src/plugins/<job-id>/**`
- `src/plugins/` 根部不允许游离聚合 / 路由文件
- 通用动作只留在 `src/capabilities/<group-id>/**`
- 基础设施只留在 `src/lib/**`
- 共享 type 与声明式 schema contract 只留在 `src/types/**`；这里只允许追溯到 `zod` 或本目录 schema 的声明调用，函数值、类/enum、控制流、非 zod 运行时 import、I/O、new/await、赋值/更新副作用和业务步骤必须在变量 initializer 深度直接 FAIL
- 文档只保留现役蓝图，不保留旧宇宙旁支
