# AGENT 启动时 Browser Artifact 同步施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "startup-browser-artifact-sync-v1",
  "status": "active",
  "owner": "startup-entrypoint",
  "lawIds": [
    "LAW-STARTUP-ENTRYPOINT-002-V3"
  ],
  "contractRefs": [],
  "dependencyEdges": [
    {"contractRef":null,"from":{"domain":"startup-entrypoint","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}}
  ],
  "prohibitedDependencyEdges": []
}
```

`grasseye:start` 在服务启动前对固定 unpacked artifact 做只读 preflight。只有 artifact 缺失或与当前
governed extension sources、manifest、pairing page、protocol、site policy 不一致时，才调用唯一
`src/lib/browser/chrome-extension/build.mjs` 重建 `.grasseye-local/browser-build/extension`，随后必须再次
通过 preflight。启动器不运行 CI、audit、typecheck、acceptance、真实 Chrome，不配对、不认领 Target，
也不直接调用 Extension reload。

