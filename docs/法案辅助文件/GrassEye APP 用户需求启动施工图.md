# GrassEye APP 用户需求启动施工图

本施工图替代 retired package chain / retired template flow / retired deterministic flow planning / retired branch-token field 生产主权。
凡旧施工图与本文件冲突，以本文件为准。

## 文件身份

本施工图定义普通用户的唯一任务入口。

Owner boundary: commander-console-capability
Forbidden startup owners: retired package chain, retired template flow, retired deterministic flow planning, retired branch-token field

## 允许输入

APP 启动页只允许以下字段：
- userRequirementText
- selectedPlatforms
- maxRounds
- maxMinutes
- optional historyEntryId

## 禁止输入

APP 启动页不得暴露：
- legacy template field
- retired selection field
- legacy route-plan field
- activationId
- retired binding field
- retired branch-token field

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

Runtime initial payload must carry:
- selectedPlatforms
- primaryPlatformId
- platformProfiles
- targetUrl
- targetTitle
- userRequirementRef
- userRequirementText
- selectedRuntimeId
- maxRounds
- maxMinutes
- operatorNote

Runtime initial payload must not carry retired map fields.
