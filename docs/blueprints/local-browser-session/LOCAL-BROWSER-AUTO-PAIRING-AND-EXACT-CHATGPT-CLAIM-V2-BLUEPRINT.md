# Local Browser Authority V24 施工图

```blueprint-record
{"schemaVersion":1,"blueprintId":"local-browser-authority-v24","status":"active","owner":"local-browser-session","lawIds":["LAW-LOCAL-BROWSER-SESSION-001-V4","LAW-LOCAL-BROWSER-SESSION-003-V28","LAW-LOCAL-BROWSER-SESSION-004-V30","LAW-LOCAL-BROWSER-SESSION-006-V21"],"contractRefs":[],"dependencyEdges":[],"prohibitedDependencyEdges":[]}
```

Browser 只拥有现实页面资源：一个 system Target、实时 current Document、一条 FIFO、每次现实副作用的一条 WAL，以及同一次动作后的 fresh readback。它不理解 Product 步骤、不保存 GPT 回答、不决定 retry，也不拥有 Website task。

`document` 是 Target 当前状态的 live view。导航、刷新或 Target 交接后，所有合法消费者必须读到新的 Document；任何包装层不得用对象展开、缓存或复制把它冻结成旧 Document。

现实副作用的唯一规则不变：先写 WAL，再至多 dispatch 一次，最后一次输入后等待 2500ms，从 fresh current Document 做直接后置读回。WAL 只防同一 attempt 的物理重复；它不授权 recovery 或重放。纯 observation 和结果读取不建立第二 WAL、lane、timer 或队列。

已确认提交、回答尚未出现的当前 attempt，可在同一存活进程与同一有效 lease/fence 内释放 FIFO，下次取得同一唯一 FIFO 后，用调用栈瞬时携带的 canonical URL 完成至多一次 exact navigation 和一次 fresh observation。该让路不落库、不建立 park object、不读写 WAL、不发送 Provider 输入，不是旧 attempt recovery。导航仍服从 2500ms 后 fresh Document 读回；如确需跨会话 30 秒 Provider 间隔，只能是 FIFO Owner 内一个进程级 not-before 数值，不建立逐任务时钟或第二调度。

任一 typed 失败、进程重启、lease/fence/abort 失效或提交结果不明时，Browser 返回 terminal fact，当前 attempt 结束并丢弃瞬时 URL/marker/hash。新 attempt 只能由 Website 新 fence 从干净页面重新开始。Browser 不保留旧 Target、Document、URL 或页面现场供之后继续。

验收必须通过真实调用证明：输入命令只走唯一 FIFO，输出 receipt 绑定当前 attempt，失败后没有恢复或重复副作用。
