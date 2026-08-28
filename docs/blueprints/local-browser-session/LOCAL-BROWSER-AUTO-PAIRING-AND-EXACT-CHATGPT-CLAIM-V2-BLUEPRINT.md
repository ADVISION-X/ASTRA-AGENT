# GrassEye 免复制配对与任务绑定 ChatGPT 认领施工图

状态：active final-state blueprint
Owner：`local-browser-session`

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "local-browser-auto-pairing-and-exact-chatgpt-claim-v2",
  "status": "active",
  "owner": "local-browser-session",
  "lawIds": [
    "LAW-LOCAL-BROWSER-SESSION-002-V6",
    "LAW-LOCAL-BROWSER-SESSION-003-V11",
    "LAW-LOCAL-BROWSER-SESSION-005-V6"
  ],
  "contractRefs": [],
  "dependencyEdges": [
    {"contractRef":null,"from":{"domain":"startup-entrypoint","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}},
    {"contractRef":null,"from":{"domain":"workbench-api-boundary","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}}
  ],
  "prohibitedDependencyEdges": []
}
```

## 1. 生产终态

```text
AGENT 启动
-> 固定 unpacked MV3 与当前构建身份一致
-> 扩展从受限 loopback route 领取内存一次性密钥并自动配对
-> Browser Authority READY，Target 保持 absent
-> exact Cloud job 已 durable 接受
-> Browser Authority public facade 发出一次 job-bound Target acquisition
-> 扩展后台创建且只创建一个任务专属 ChatGPT start URL
-> 等待页面完成并复核预授权 gpt-web 精确 Origin
-> 扩展提交该任务专属 Target 的现有 TARGET_CLAIM
-> 服务端校验并 ACK
-> 建立 connection-bound Session Workspace
-> GPT turn settle 且不存在未收束 DISPATCHED 后关闭 Target 并释放 Workspace
```

操作者不复制密码、不点击“认领当前标签页”。启动器只同步固定扩展 artifact 并启动本地 Shell；它不读取、
枚举、打开、附加或认领 Browser Target，也不创建、认领或执行任务。Target acquisition 只能由 exact job
durable 接受后的第一个 Browser 原子动作触发，固定扩展单独拥有物理认领。

Browser Authority 不决定 fresh 或 continuation，只提供每个 turn 唯一的任务专属物理 Target。Product Plugin 决定
会话意图；GPT Child 在已分配 Target 上验证干净根页面或聚焦精确历史 conversation。建 tab 不另立为 GPT DOM
Child，也不允许 Product Plugin 直接接触 Chrome 资源。

## 2. 唯一认领策略

预授权策略固定为现有 `gpt-web` site policy：唯一 Origin 是 `https://chatgpt.com`，唯一 start URL 是
`https://chatgpt.com/`。每个已 durable 接受且进入 GPT turn 的 job-bound acquisition 都后台创建且只创建一个
任务专属 Target；扩展不枚举、不复用、不认领、不关闭，也不操纵任何既存操作者 ChatGPT Target。调用方仍不得
提供 URL、标题、tabId、顺序、坐标、选择器或任务输入来影响物理 Target。

- acquisition 到达：后台创建一个 inactive 固定 start URL；创建零个或多个均失败关闭。
- 新页面加载未完成或主 frame Origin 不精确：不得附加、认领或建立 Workspace。
- 只对本次 acquisition 创建并记录的 tab 执行 debugger attach；冲突时失败关闭，不改认领其它页面。
- GPT turn settle 且 `pendingMutationCount = 0`：关闭任务专属 Target，经现有 revoke 释放 Workspace。
- 存在未收束 DISPATCHED mutation：保留 Target、Document、冻结的正向/负向后置判据与 Workspace 作为唯一补核现场，不关闭、不重建、不重放，只允许只读判据核验。

不增加设置页、授权台账、extension storage、宽 host permission、新 API、新 WebSocket、新 mutation store
或第二 registry；只在现有认证协议增加唯一无业务载荷的 `TARGET_ACQUIRE` 帧，复用现有
`TARGET_CLAIM/ACK`，不得新增或保留 `tabs`/`activeTab` 权限。法案与精确 site policy 就是预授权来源。

## 3. 认领与 Workspace 原子边界

扩展只有在现有 WebSocket READY 已安装 permit authority 且收到 exact job 触发的一次 acquisition 后，才创建并
等待本次任务专属 Target 完成加载。它只附加该 Target，读取主 frame，复核主 frame URL 的精确 Origin，然后发送现有加密 `TARGET_CLAIM`。服务端必须再次用同一
`gpt-web` policy 校验 URL，并拒绝在未 revoke 时用不同 `targetRef` 覆盖现有 claim。只有服务端完成
注册、SQLite/WAL compact claim receipt 持久化并返回现有 ACK 后，扩展和服务端才可报告 Target PRESENT 与 Session Workspace 已建立。

同 Origin 主 frame 导航复用现有 claim 更新 Document lease；跨 Origin、Target 关闭、debugger detach、
socket 断开或 Authority revoke 都走现有 revoke 路径。无未收束 DISPATCHED 的 turn settle 由 runtime 关闭任务专属 Target；
异常 detach 或关闭后不得在同一 turn 争抢式重建，新的 turn 才能重新执行一次创建策略。

## 4. 配对、更新与失败关闭

固定扩展 ID、loopback pairing route、P-256 ECDSA/ECDH、HKDF、AES-GCM、内存一次性密钥、
`releaseBuildId` 比对与 `chrome.runtime.reload()` 继续复用现役单链。构建身份不一致时先 reload，不得配对或
认领；后续插件源更新由 `grasseye:start` 同步固定 artifact，扩展自行 reload，通常无需再次手工更新。

Workbench 不存在、LNA 阻止、配对响应非法、握手失败、创建失败、加载未完成、Origin 错误、debugger 冲突、服务端拒绝、ACK 超时、
导航越界或 revoke 都保持 Target/Workspace absent；Shell 与 Authority 诊断事实不得被覆盖。job-bound 认领失败
不伪装成配对失败，也不得触发任务创建、任务认领或任务执行。

## 5. 删除式迁移

物理删除 popup 的手动认领按钮、`GRASSEYE_CLAIM_ACTIVE_TARGET` runtime handler、active-tab 查询认领函数、
`activeTab` permission 及其质检断言。保留现有 pairing、encrypted WebSocket、target registry、claim ACK、
revoke、compact mutation receipt 和 Session Workspace；同时物理删除 `READY -> claimPreauthorizedChatGptTarget` 自动链与
session-level Target claim gate。唯一时序为 exact job durable 接受 -> 同一加密 WebSocket acquisition ->
任务专属后台 Target 创建并完成加载 -> 现有 TARGET_CLAIM/ACK -> 无未收束 DISPATCHED 的 turn settle 后 close/revoke；
物理删除“查询并复用既存 ChatGPT Target”、单/多候选选择分支及其测试，不存在 manual/auto 兼容桥、feature flag、
fallback 或第二 claim path。

## 6. 质检与真实验收

1. 构建与静态质检证明 manifest 无 `activeTab`/storage/宽 host，popup 无手动认领入口，源码无旧 handler。
2. 确定性测试覆盖 Authority READY 与空闲期间不创建/认领、job-bound acquisition 后忽略既存操作者页面并只创建一个
   inactive Target、加载完成前不 attach、精确 Origin 复核、debugger 冲突、服务端拒绝、ACK 超时、同 Origin
   Document 更新、跨 Origin revoke、无 DISPATCHED settle 后关闭，以及 DISPATCHED 时保留原现场和冻结判据供只读补核。
3. 服务端测试证明非 `gpt-web` Origin、未 revoke 的不同 `targetRef` 覆盖和未确认 Workspace 全部失败。
4. 真实 Chrome 证明：启动 AGENT 后固定扩展自动配对且 Target absent；无需复制密码或点击 popup；exact job
   durable 接受后才创建唯一任务专属 ChatGPT Target，且操作者既存页面完全不受影响；服务端确认后建立 Session
   Workspace；turn settle 后页面关闭、Target absent，随后现有真实命令、receipt 与 revoke 链仍成立。
5. 启动器检查证明 scripts/startup 与 `grasseye:start` 不使用 Chrome Target API、不打开 ChatGPT、不发送
   `TARGET_CLAIM`、不创建或认领任务。

静态、单项 acceptance 与构建通过只证明 CHANGE。只有当前候选的唯一完整 CI、全新独立只读治理审计和
真实 Chrome 均通过，才可报告本次生产候选实测成功；READY、RELEASE 与部署仍分别报告。

正文闭环：终态 Owner 是 `local-browser-session`；输入是当前 release identity、精确 Extension Origin、
exact job 接受事实与任务专属 Chrome Target 元数据，输出是已确认的 connection-bound Workspace receipt。状态只持久进入现有 SQLite/WAL
compact mutation row，调用方向固定为 Extension -> Workbench -> Browser Owner。失败恢复保持 Target/Workspace blocked，
安全边界拒绝调用方 selector、坐标和 tab 身份；验收必须同时证明任务专属 Target、既存页面零影响、无未收束 DISPATCHED
自动释放、DISPATCHED 原现场只读补核和 revoke 后失效；不得出现 `BROWSER_OUTCOME_UNKNOWN`。
