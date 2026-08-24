# Browser Owner Journal V5 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "local-browser-session-v5-owner-journal",
  "status": "active",
  "owner": "local-browser-session",
  "lawIds": [
    "LAW-LOCAL-BROWSER-SESSION-004-V5"
  ],
  "contractRefs": [],
  "dependencyEdges": [],
  "prohibitedDependencyEdges": []
}
```

唯一 `local-browser-session` Owner 必须先持有排他锁，才读取并验证唯一 append-only proof
journal 的尾部。锁外不得缓存尾部状态；所有 Browser lifecycle 与 command 事件只在锁内持久追加。
shutdown 必须先持久化 revoke，再释放锁。journal 的 event schema、哈希链或尾行不完整一律失败关闭，
不截断、重排、重算、覆盖、分叉或自动修复历史。

当前 V5 journal schema 没有 recovery event，因此本施工图不授权从损坏历史创建新 canonical 链。
完整性失败后只保留 Shell 与只读诊断，Browser、Target、execution 与 claim 持续 blocked；必须先取得
运行数据处理授权以及新的 major law/schema 授权，才可由 `local-browser-session` Owner 只读封存原文件，
绑定原绝对路径、完整 SHA-256、首个失败行、候选、release build、操作者和 reason code，并生成唯一
recovery receipt。没有上述授权和 schema 时，唯一恢复动作是保持原文件不变并维持 blocked。
