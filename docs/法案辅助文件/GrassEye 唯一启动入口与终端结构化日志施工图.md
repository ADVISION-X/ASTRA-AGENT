# GrassEye 唯一启动入口与终端结构化日志施工图

版本：2026-05-21  
状态：active

## 1. 当前唯一启动命令

```txt
npm run grasseye:start
```

唯一入口脚本：

```txt
scripts/startup/launch-grasseye.mjs
```

## 2. 当前启动职责

- 检查依赖状态
- 做最小 update preflight
- 清理端口
- 启动本地 app server
- 健康探测本地 workbench
- 自动打开本地页面
- 输出结构化启动日志

## 3. 当前启动顺序

```txt
dependency check
-> update preflight
-> registry / readiness gate
-> port clear
-> app server start
-> local page health probe
-> open browser page
```

## 4. 启动不拥有的东西

- 业务流程真相
- DOM 动作真相
- evidence 真相
- AI 业务判断

## 5. 终端日志字段

- `phase`
- `component`
- `eventType`
- `status`
- `message`
- `refs`
- `durationMs`
- `failureReason`

## 6. 当前原则

- 启动只拉起最小 Amazon workbench
- 启动失败必须给出明确 failureReason
- 启动日志是 display channel，不是 record store