# GrassEye 免复制配对与精确 ChatGPT 自动认领施工图

状态：active final-state blueprint
Owner：`local-browser-session`

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "local-browser-auto-pairing-and-exact-chatgpt-claim-v2",
  "status": "active",
  "owner": "local-browser-session",
  "lawIds": [
    "LAW-LOCAL-BROWSER-SESSION-002-V5",
    "LAW-LOCAL-BROWSER-SESSION-003-V8",
    "LAW-LOCAL-BROWSER-SESSION-005-V5"
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
-> 扩展仅按预授权 gpt-web-chat 精确策略确定 ChatGPT Target
-> 扩展提交现有 TARGET_CLAIM
-> 服务端校验并 ACK
-> 建立 connection-bound Session Workspace
```

操作者不复制密码、不点击“认领当前标签页”。启动器只同步固定扩展 artifact 并启动本地 Shell；它不读取、
枚举、打开、附加或认领 Browser Target，也不创建、认领或执行任务。自动认领由固定扩展单独拥有。

## 2. 唯一认领策略

预授权策略固定为现有 `gpt-web-chat` site policy：唯一 Origin 是 `https://chatgpt.com`，零 Target 时唯一
start URL 是 `https://chatgpt.com/`。扩展只读取 Chrome 提供的页面 Target 元数据，不接受调用方 URL、
标题、tabId、顺序、坐标、选择器或任务输入。

- 恰好一个未被其他 debugger 占用且匹配精确 Origin 的页面 Target：认领它。
- 零个合格 Target：后台创建一个固定 start URL，待其达到精确 Origin 后认领。
- 多个合格 Target：失败关闭，不按 active、最近访问、标题或顺序猜选。
- 合格 Target 已被 DevTools 或其他 debugger 占用：失败关闭并报告现有冲突。

不增加设置页、授权台账、extension storage、宽 host permission、新 API、新 WebSocket、新协议消息、
新 journal schema 或第二 registry；不得新增或保留 `tabs`/`activeTab` 权限。法案与精确 site policy 就是
预授权来源。

## 3. 认领与 Workspace 原子边界

扩展只有在现有 WebSocket READY 已安装 permit authority 后才执行一次自动认领。它附加唯一 Target，读取
主 frame，复核主 frame URL 的精确 Origin，然后发送现有加密 `TARGET_CLAIM`。服务端必须再次用同一
`gpt-web-chat` policy 校验 URL，并拒绝在未 revoke 时用不同 `targetRef` 覆盖现有 claim。只有服务端完成
注册、journal 追加并返回现有 ACK 后，扩展和服务端才可报告 Target PRESENT 与 Session Workspace 已建立。

同 Origin 主 frame 导航复用现有 claim 更新 Document lease；跨 Origin、Target 关闭、debugger detach、
socket 断开或 Authority revoke 都走现有 revoke 路径。用户关闭或 debugger detach 后不得在同一认证连接
内无限争抢式重建；重新建立新的 authenticated connection 才能重新执行一次策略。

## 4. 配对、更新与失败关闭

固定扩展 ID、loopback pairing route、P-256 ECDSA/ECDH、HKDF、AES-GCM、内存一次性密钥、
`releaseBuildId` 比对与 `chrome.runtime.reload()` 继续复用现役单链。构建身份不一致时先 reload，不得配对或
认领；后续插件源更新由 `grasseye:start` 同步固定 artifact，扩展自行 reload，通常无需再次手工更新。

Workbench 不存在、LNA 阻止、配对响应非法、握手失败、无/多/冲突 Target、服务端拒绝、ACK 超时、
导航越界或 revoke 都保持 Target/Workspace absent；Shell 与 Authority 诊断事实不得被覆盖。自动认领失败
不伪装成配对失败，也不得触发任务创建、任务认领或任务执行。

## 5. 删除式迁移

物理删除 popup 的手动认领按钮、`GRASSEYE_CLAIM_ACTIVE_TARGET` runtime handler、active-tab 查询认领函数、
`activeTab` permission 及其质检断言。保留现有 pairing、encrypted WebSocket、target registry、claim ACK、
revoke、journal 和 Session Workspace；不存在 manual/auto 兼容桥、feature flag、fallback 或第二 claim path。

## 6. 质检与真实验收

1. 构建与静态质检证明 manifest 无 `activeTab`/storage/宽 host，popup 无手动认领入口，源码无旧 handler。
2. 确定性测试覆盖 READY 前不认领、单目标认领、零目标创建一次、多目标失败、debugger 冲突、精确 Origin
   复核、服务端拒绝、ACK 超时、同 Origin Document 更新、跨 Origin revoke 与连接级单次执行。
3. 服务端测试证明非 `gpt-web-chat` Origin、未 revoke 的不同 `targetRef` 覆盖和未确认 Workspace 全部失败。
4. 真实 Chrome 证明：启动 AGENT 后固定扩展自动配对；无需复制密码或点击 popup；唯一 ChatGPT Target
   自动认领；服务端确认后建立 Session Workspace；随后现有真实命令、receipt 与 revoke 链仍成立。
5. 启动器检查证明 scripts/startup 与 `grasseye:start` 不使用 Chrome Target API、不打开 ChatGPT、不发送
   `TARGET_CLAIM`、不创建或认领任务。

静态、单项 acceptance 与构建通过只证明 CHANGE。只有当前候选的唯一完整 CI、全新独立只读治理审计和
真实 Chrome 均通过，才可报告本次生产候选实测成功；READY、RELEASE 与部署仍分别报告。
