# AGENT 启动时 Browser Artifact 同步施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "startup-browser-artifact-sync-v1",
  "status": "active",
  "owner": "startup-entrypoint",
  "lawIds": [
    "LAW-STARTUP-ENTRYPOINT-002-V4"
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

正文闭环：终态 Owner 是 `startup-entrypoint`；输入为现役 extension sources 与固定 artifact，输出为通过
preflight 的同一 artifact identity。状态只落在唯一 build 目录，调用方向固定为 `grasseye:start` ->
preflight -> 必要时 build -> 再 preflight。失败恢复仅允许同链重建并保持启动失败，安全边界禁止配对、
Target claim 与审计副作用；验收必须证明一致时不写入、漂移时重建、复检失败时 blocked。
