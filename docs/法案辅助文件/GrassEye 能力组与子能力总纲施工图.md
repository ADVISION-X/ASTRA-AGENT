# GrassEye 能力组与子能力总纲施工图

版本：2026-05-27  
状态：active

## 1. 系统身份

GrassEye 当前不是通用智能体。  
GrassEye 当前是岗位型自动化执行系统。

主架构只有一条：

```txt
Business Flow Script
  -> Ability Groups
      -> Child Abilities
          -> Evidence and Logs
```

## 2. Owner 分工

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

## 5. 禁止项

- 通用流程调度器
- 中央总线
- 通用 mission loop
- AI 自主规划多步动作
- AI 输出浏览器命令
- job flow 直连 capability 非 facade 文件
- ability group 互相串 owner
- 流程真相落到 catalog、registry 或 UI 层

## 6. 目录原则

- 业务流程只留在 `src/plugins/<job-id>/**`
- `src/plugins/` 根部不允许游离聚合 / 路由文件
- 通用动作只留在 `src/capabilities/<group-id>/**`
- 基础设施只留在 `src/lib/**`
- 文档只保留现役蓝图，不保留旧宇宙旁支