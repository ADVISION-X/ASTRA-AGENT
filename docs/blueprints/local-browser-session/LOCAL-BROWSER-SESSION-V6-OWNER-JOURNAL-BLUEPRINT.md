# Browser Owner Journal V6 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "local-browser-session-v6-owner-journal",
  "status": "active",
  "owner": "local-browser-session",
  "lawIds": [
    "LAW-LOCAL-BROWSER-SESSION-004-V8"
  ],
  "contractRefs": [],
  "dependencyEdges": [],
  "prohibitedDependencyEdges": []
}
```

## 正常写入

唯一 `local-browser-session` Owner 必须先持有排他锁，才读取并验证唯一 canonical
`proof-events.ndjson` 的尾部。canonical schema 固定为
`grasseye.browser-proof-journal.v2`；锁外不得读取或缓存尾部。所有 lifecycle 与 command
事件只在锁内持久追加，每行严格递增、绑定上一行哈希并 `fsync`。shutdown 必须先持久化
`AUTHORITY_REVOKED`，再释放 Owner lock。

## 失败关闭

event schema、物理行号、上一行哈希、当前行哈希或完整尾行任一异常，Browser、Target、execution
与 claim 必须持续 blocked。启动流程不得截断、重排、重算、覆盖、分叉续写、自动恢复或建立第二
活动 journal；Shell 只提供诊断和人工恢复命令提示。

## 唯一恢复事务

恢复不是启动的一部分。只有当前人类同时授权运行数据处理和 major law/schema，操作者显式设置
`GRASSEYE_BROWSER_JOURNAL_RECOVERY_AUTHORIZED=1` 并调用 `npm run browser:journal:recover --`
时，才可进入恢复事务：

1. 先取得同一 `owner.lock`；活动 Browser Owner 存在时必须拒绝恢复。
2. 再逐字节读取原 canonical 文件，记录绝对路径、字节数、完整 SHA-256、物理行数、首个失败
   物理行、全部可识别历史 candidate hash 与 release build、操作者、授权引用和 reason code。
3. 原字节只能以哈希命名写入 `browser/archive/`，写后再次逐字节校验并改为只读；archive 永久
   退出活动证明域。
4. 只以原文件哈希、操作者、授权引用和 reason code 派生唯一 `recoveryId`；同一 ID 只能有一份
   `browser/recovery-receipts/*.json`，既有内容不一致必须失败关闭。
5. receipt 内固定完整 V2 `RECOVERY/GENESIS` envelope。临时 canonical 文件必须完整写入并
   `fsync`，确认原 source 未漂移后才可原子替换；目录随后 `fsync`。
6. canonical V2 journal 只允许 sequence 1 出现一次 `RECOVERY/GENESIS`。重试相同事务必须返回
   `ALREADY_RECOVERED`；不同恢复请求、第二 genesis、第二活动 journal 或冲突 archive/receipt
   一律拒绝。

恢复 genesis 不是对旧历史的洗白。旧 journal 及其中所有 lifecycle/command 事件不得参与当前
Dynamic Proof；恢复后的 Browser Authority、Target claim、command completion 和 revoke 必须在 V2
链上重新发生、重新取证。恢复 genesis 不携带、推导或证明当前 candidate/build；当前身份只来自恢复后
新写入的 lifecycle/command 事件。UNKNOWN mutation 永不自动重放。

## 人工命令合同

```text
GRASSEYE_BROWSER_JOURNAL_RECOVERY_AUTHORIZED=1 npm run browser:journal:recover -- \
  --operator <operator-id> \
  --authorization <current-human-authorization-ref> \
  --reason <reason-code>
```

命令只输出不含秘密的 recovery 结果；没有授权、Owner lock 被占用、源文件安全属性不合格、源文件
本来有效、archive/receipt 冲突或提交后复核失败时均非零退出并保持 Browser blocked。

正文闭环：终态对象由 `local-browser-session` Owner 独占；输入是锁内已验证的 canonical journal 和人工
recovery 命令，输出是追加事件或唯一 recovery receipt。状态只持久化到活动 V2 journal、只读 archive 与
receipt，调用方向固定为命令 -> Owner lock -> 原子写入。失败恢复不续写损坏历史，安全边界要求当前授权且
UNKNOWN 不重放；验收必须证明正常追加、损坏失败关闭、幂等恢复和候选身份重新取证。
