# 固定扩展 Pairing Bootstrap API 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "extension-pairing-bootstrap-v1",
  "status": "active",
  "owner": "workbench-api-boundary",
  "lawIds": [
    "LAW-WORKBENCH-API-BOUNDARY-001-V7"
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

正文闭环：终态 Owner 是 `workbench-api-boundary`；输入为固定 Extension Origin 或精确身份头，输出为
no-store pairing response。一次性密钥只保存在内存状态，调用方向固定为 Extension -> pairing route ->
Browser Authority。失败恢复要求重新发起同一受限请求且不建立 fallback，安全边界拒绝网页、其他扩展和
非 loopback WebSocket；验收必须证明唯一允许来源成功、全部相邻来源 FAIL、响应不可缓存且不泄漏 secret。
