# GPT 能力组 V38 施工图

```blueprint-record
{"schemaVersion":1,"blueprintId":"gpt-capability-group-v38","status":"active","owner":"gpt","lawIds":["LAW-GPT-001-V43","LAW-GPT-002-V2"],"contractRefs":[],"dependencyEdges":[{"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"capability-governance","repo":"local"}},{"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"forensics-persistence-capability","repo":"local"}},{"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}}],"prohibitedDependencyEdges":[]}
```

## 唯一 Owner 与职责

GPT 只把 Product 已决定的 Provider turn 变成 typed result，并唯一拥有 Provider continuation identity、predecessor 与 frontier 的解析准入语义。Product 决定 Prompt、模型、附件、步骤和结果组装；Browser 决定 Target、current Document、FIFO、现实副作用和唯一 WAL 持久 fact；Forensics 保存回答 artifact；Runtime 运输结果；Website 唯一裁决业务恢复与完成。

文本主链固定为：

```text
BZ05: fresh prepare/attach/write -> submit_exact_gpt_turn_once
  -> checkpoint_gpt_text_response -> record_gpt_continuation

BZ03/BZ04: acquire_gpt_continuation -> exact sidebar conversation selection/attach/write
  -> submit_exact_gpt_turn_once -> checkpoint_gpt_text_response
  -> record_gpt_continuation
```

`submit_exact_gpt_turn_once` 在自己的直接后置一次返回 CONFIRMED、canonical conversation URL、精确 user turn 身份和 Browser effect receipt。provider_effect_identity 不含 attempt/process/lease/fence/Target/Document；Browser WAL 已有 CONFIRMED 时该 Child 只读回同一 receipt/URL，绝不再次输入。`checkpoint_gpt_text_response` 每次取得 FIFO 后只在 fresh current Document 裁决 pending 或 ready；ready 时由同一 coherent observation 一次取得紧邻 assistant turn 的 observed DOM + semantic text，写入且读回一份 artifact。pending 只释放 FIFO。

`FROZEN-GPT-SUBMIT-TWO-PRECONDITIONS-001` 固定真正 submit 前只能确认两件事。第一，当前 Composer 提示词 hash 与 Product 批准值相等，当前附件集合与批准集合相等；批准集合可以为空，Provider 自动追加的最终纯数字括号后缀按冻结附件规则归一。第二，Browser 当前 Target/Document/fence 有效，且唯一 WAL 证明同一 provider effect 尚未发生现实输入。历史聊天、既有 user turn、固定 turn 编号或奇偶、按钮标签以及 Browser 内部可操作性检查均不得成为新增业务前置关卡，也不得在点击前读取历史 turn 来决定发送资格。点击后等待 2500ms，再从 fresh current Document 只取最大有效序号的 user turn，确认其 prompt hash 等于批准值且 Composer 已清空；这是发送后的直接证明，不是第三个前置条件。改变或删除本冻结边界，必须由用户在未来任务中明确解冻，并同步替换施工图、实现与唯一质检；普通修复或 CI 授权不构成解冻。

`FROZEN-JOB-ATTEMPT-PROVIDER-EFFECT-001` 固定两类事实：fresh/profile/model/menu/附件/Composer 都是 attempt + current Document 范围内的 target-local 准备，同一 job 的新 attempt 必须重做，批准附件集合可以是空；只有 `submit_exact_gpt_turn_once` 是跨 attempt 的 provider effect。同一 result revision 的 submit request hash 绑定 `result_revision + Child input hash`，仅换 attempt 不变，更换 Website 已授权的 result revision 才变化。任何 Product 在准备前先查询该精确 submit effect；WAL 已 CONFIRMED 时直接零输入读回，未命中才准备并提交。`REJECTED + mutation_outcome=no + physical_input_count=0` 明确不消耗 effect，只有 Website 新 attempt 可在同一 WAL/effect identity 下重新准备；DISPATCHED 或任何已发生/不明现实输入仍禁止重发。不得把旧 attempt 的附件上传、草稿或页面状态当作新 attempt 的成功事实。

`FROZEN-GPT-CONVERSATION-LOCATOR-EFFECT-SEPARATION-001` 固定：conversation_id 只定位现有页面 conversation，provider_effect_identity 只证明 Provider submit 现实副作用至多一次，二者绝不合并或互相授予权限。Website 对 DISPATCHED/CONFIRMED effect 重新授权时，跨进程只允许从 Browser WAL 精确读回同一 URL/receipt，由 Browser 从 URL 解析 opaque conversation_id：当前 pathname 已精确命中则零点击，否则只在现有页面左侧聊天栏对唯一精确 `/c/<conversation_id>` 链接点击一次，丢弃 query/fragment 后 fresh readback 必须相等，再 wait/observe/read artifact，physical submit 增量为零；零项、多项、不可交互或读回不等直接 typed fail-close，不准 Page.navigate conversation URL、按标题/顺序/时间猜测、搜索、滚动、自动展开、重试或 URL fallback，也不新增 recovery Child 或状态机。其它失败由 Website 决定是否签发新 attempt/result revision。该冻结边界只有用户在未来任务中明确解冻，并同步替换法案、施工图、实现与唯一质检后才可改变；普通施工或 CI 授权不是解冻。

八字 consultation identity 精确为 `owner_ref + subject_ref + chart_version + chart_hash + consultation_root_ref`。BZ05 的 root 等于自身 Website task identity，只 fresh 一次；BZ03/BZ04 只可从唯一 Browser WAL 取得同根、Website 声明的 direct predecessor 与上一轮 source task 全等且已经完成的唯一 continuation checkpoint。唯一 Browser FIFO 持有当前 Product session；回答 checkpoint 完成后，AGENT 才把 locator、identity、source task 与 checkpoint 一次写入原 provider-effect 行。缺失、多义、错误 owner/person/chart/root/predecessor 一律 fail closed，不得按 latest/timestamp 猜测，不得 fresh fallback，也不得保存半完成 frontier或在 Browser 复制 Website 的父子关系。

## 删除边界

以下对象必须物理不存在：private base、reusable/derived reservation、semantic read grant、fork、child conversation、独立 submission locator、document transition policy、恢复型 park、取消后自发重跑和通用旧 attempt recovery。只保留 `acquire_gpt_continuation`、`record_gpt_continuation` 两个原子语义，以及 submit Child 内对同 provider effect 的 confirmed receipt readback；其持久事实复用 Browser WAL 同一 effect 行，串行性复用唯一 Browser FIFO，不得用兼容 wrapper、alias、feature flag、dual-read/write、第二 lane/store/scheduler 或状态机扩张。

## Browser 边界

GPT 只消费 Browser 签发的实时 current Document 和 typed command terminal。Browser 的 Target lease 对外暴露的 `document` 必须是 live getter；包装它时不得用 spread 把 getter 求值成旧快照。Provider/控件 mutation 仍先经唯一 FIFO、每 provider effect 一条权威 WAL、跨 attempt/进程至多一次 physical dispatch 和 2500ms 后的 fresh postcondition；Browser-owned exact conversation selection 只做可逆页面生命周期收敛，当前命中零点击，否则唯一精确点击后同样经过 2500ms 与 fresh currentUrl readback，但不取得 Provider effect 或第二 WAL。纯读结果不新建 WAL、队列或第二恢复权限。

## 证据、失败与验收

可持久化的必要事实只有回答 artifact 与 Browser WAL 同一 provider-effect 行中的 confirmed effect、加密 locator、consultation identity hash、source task hash 和完成 checkpoint hash。前者证明回答内容，后者证明物理副作用与八字会话位置；GPT 不新增数据库或 lane 台账，Browser 不保存 Website direct predecessor，日志只保存脱敏 ref/hash，Website 不接收 Provider locator。

验收必须证明：同一 effect 最多一次物理 dispatch；CONFIRMED 后重启只读回；BZ05 fresh/persist 各一次，BZ03/BZ04 acquire/submit/advance 各一次，同根未完成 turn 阻止后继，concurrent followup 只沿精确 predecessor 串行，private base/reservation/fork/第二 lane/fresh fallback 为零；最终 `Product result -> Runtime Outbox -> Website admission receipt` 才是完成。
