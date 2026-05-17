# GrassEye APP 用户需求启动施工图

## 文件身份

本施工图定义普通用户的唯一任务入口。

Owner boundary: commander-console

## 允许输入

APP 启动页只允许以下字段：
- userRequirementText
- selectedPlatforms
- maxRounds
- maxMinutes
- optional historyEntryId

## 禁止输入

APP 启动页不得暴露：
- 能力组内部字段
- 调度字段
- 浏览器命令
- 坐标字段
- 多动作计划字段
- 证据写入 payload

## 启动 payload

```json
{
  "userRequirementText": "寻找适合种草的蓝牙耳机视频",
  "selectedPlatforms": ["facebook-web"],
  "maxRounds": 20,
  "maxMinutes": 30,
  "historyEntryId": "history_123"
}
```

## 运行时初始载荷

Runtime initial payload may carry:
- selectedPlatforms
- primaryPlatformId
- platformProfiles
- targetUrl
- targetTitle
- userRequirementRef
- userRequirementText
- maxRounds
- maxMinutes
- operatorNote

Runtime initial payload must not carry execution plans. AI chooses one registered atomic action per visual round.
