# 固定扩展 Pairing Bootstrap API 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "extension-pairing-bootstrap-v1",
  "status": "active",
  "owner": "workbench-api-boundary",
  "lawIds": [
    "LAW-WORKBENCH-API-BOUNDARY-001-V6"
  ],
  "contractRefs": [],
  "dependencyEdges": [
    {"contractRef":null,"from":{"domain":"workbench-api-boundary","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}}
  ],
  "prohibitedDependencyEdges": []
}
```

固定扩展 ID `emkmbecadncngofidjgocmifhbonifgm` 只允许 GET
`/api/browser-authority/pairing`。请求必须来自精确 Extension Origin 或携带精确非秘密身份头；网页、其他
扩展、`null`、`file://` 与无身份本机请求失败关闭。响应只给当前 `releaseBuildId`、Authority 状态和
absent 时的内存一次性密钥，并固定 no-store/no-cache/no-referrer/nosniff。WebSocket upgrade 同时要求
loopback remote address 与固定 Extension Origin。
