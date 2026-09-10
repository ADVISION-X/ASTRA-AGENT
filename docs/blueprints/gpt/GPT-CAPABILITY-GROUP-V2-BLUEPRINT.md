# GPT 能力组 V34 施工图

```blueprint-record
{"schemaVersion":1,"blueprintId":"gpt-capability-group-v34","status":"active","owner":"gpt","lawIds":["LAW-GPT-001-V41"],"contractRefs":[],"dependencyEdges":[{"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"capability-governance","repo":"local"}},{"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"forensics-persistence-capability","repo":"local"}},{"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}}],"prohibitedDependencyEdges":[]}
```

## 唯一 Owner 与职责

GPT 只把 Product 已决定的一次页面动作变成一个 typed result。Product 决定 Prompt、模型、附件、步骤和结果组装；Browser 决定 Target、current Document、FIFO、现实副作用和 WAL 持久状态；Forensics 保存一次可读回的结果 artifact；Runtime 运输结果；Website 裁决业务完成。

文本主链固定为：

```text
准备页面和附件 -> write_exact_gpt_prompt -> submit_exact_gpt_turn_once
-> checkpoint_gpt_text_response -> Product 无损组装
```

`submit_exact_gpt_turn_once` 在自己的直接后置一次返回 CONFIRMED、canonical conversation URL、精确 user turn 身份和 Browser effect receipt。`checkpoint_gpt_text_response` 合并旧 wait：每次取得 FIFO 后只在 fresh current Document 裁决 pending 或 ready；ready 时由同一 coherent observation 一次取得紧邻 assistant turn 的 observed DOM + semantic text，写入且读回一份 artifact，直接返回 text、hash 与 ref。pending 只释放 FIFO，不是失败。图片 wait 同样并入 `checkpoint_gpt_generated_image`，该 Child 在 ready 时仍以唯一 Browser compound mutation 取得真实 bytes。

等待只能活在同一存活进程、同一有效 lease/fence 的当前调用栈。释放 FIFO 时不持久化会话或等待位置；再获得 FIFO 后，只用瞬时 canonical URL、marker 和 prompt hash 导航/观察，绝不再提交。进程重启、lease/fence/abort 失效、提交不明或任一 typed 失败都立即结束 attempt，瞬时值丢弃，之后不得再读旧会话。

## 删除边界

以下对象没有独立决定或独立真相，必须物理不存在：`reconcile_gpt_draft`、`reconcile_gpt_turn_submission`、`wait_for_stable_gpt_text`、`wait_for_stable_gpt_image`、双 hash 稳定窗、`readCallFacts`、confirmed-readback、completed-result、独立 submission locator、document transition policy、恢复型 park/reacquire、取消后重跑和任意旧 attempt recovery。不得用改名、Facade、兼容 wrapper、alias、feature flag、dual-read/write、第二 Browser lane、第二 artifact、第二 scheduler 或恢复状态机重新引入它们。

## Browser 边界

GPT 只消费 Browser 签发的实时 current Document 和 typed command terminal。Browser 的 Target lease 对外暴露的 `document` 必须是 live getter；包装它时不得用 spread 把 getter 求值成旧快照。每次现实页面副作用仍先经唯一 FIFO、每 effect 一条 WAL、至多一次 dispatch 和 2500ms 后的 fresh postcondition。纯读结果不新建 WAL、队列或恢复权限。

## 证据、失败与验收

唯一可持久化的 GPT 业务产物是当前 attempt 的结果 artifact；它既是 Product 输入，也是 Runtime result 的证据引用。Browser WAL 只证明物理副作用，不能替代回答 artifact；日志只保存脱敏 ref/hash。任何失败都只产生 typed reason 并结束当前 attempt，不能读取或续跑旧 conversation、DOM、artifact、checkpoint 或 Outbox。

验收必须证明：一次 submit 最多一次物理 dispatch；GPT 已回答时只调用一次结果读取并获得同一 artifact 的 readback；旧 Document 绝不会在 Browser 导航后继续暴露；任意失败不会触发旧 attempt 的重读或重发；最终 `Product result -> Runtime Outbox -> Website admission receipt` 才是完成。
