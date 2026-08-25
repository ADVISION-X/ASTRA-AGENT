# GrassEye 免复制配对与自动重载施工图

状态：active final-state blueprint  
Owner：`local-browser-session`

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "local-browser-auto-pairing-and-reload-v1",
  "status": "active",
  "owner": "local-browser-session",
  "lawIds": [
    "LAW-LOCAL-BROWSER-SESSION-002-V5",
    "LAW-LOCAL-BROWSER-SESSION-003-V7",
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

## 1. 用户终态

操作者不再复制或粘贴一次性密钥。`npm run grasseye:start` 完成后，已经加载的固定 unpacked MV3
自动读取当前构建身份和一次性密钥，完成原有 P-256 ECDSA/ECDH、HKDF、AES-GCM 握手。操作者只保留
一个安全动作：在扩展 popup 点击“认领当前 HTTPS 标签页”。自动连接不得认领标签页、打开 GPT 页面、
创建或执行任务。

本版本上线时，旧扩展尚无自动重载代码，因此仍需最后一次在 `chrome://extensions` 重新加载固定目录。
从这次重新加载以后，后续插件源代码更新由启动闭环自动同步，无需再次手工点“更新”。

## 2. 唯一链路

```text
grasseye:start
-> preflight 比对固定 artifact、release record、bundle inputs、manifest、pairing page、protocol 与 site policy
-> 仅在缺失或 stale 时由当前 governed sources 重建 .grasseye-local/browser-build/extension
-> 启动唯一 127.0.0.1:4173 Shell
-> 固定扩展由 service-worker、Chrome startup、Workbench tab 或一分钟 alarm 唤醒
-> GET /api/browser-authority/pairing
-> 比较 AGENT releaseBuildId 与扩展内嵌 releaseBuildId
-> 不一致：chrome.runtime.reload()，重新从固定目录加载；不得配对
-> 一致：领取当前 256-bit 内存一次性密钥并复用唯一 ExtensionWebSocketActor.pair()
-> Browser Authority PRESENT
-> 操作者点击认领当前 HTTPS Target
-> connection-bound Session Workspace 建立
```

不保留手工密钥输入、manual/auto 双协议、永久 token、extension storage、CWS、Native Messaging、
page relay、第二 WebSocket 或旧 artifact fallback。

## 3. API 与秘密边界

固定扩展 ID 为 `emkmbecadncngofidjgocmifhbonifgm`，唯一允许来源为
`chrome-extension://emkmbecadncngofidjgocmifhbonifgm`。扩展请求必须携带非秘密身份头
`X-GrassEye-Tool-Extension-Id`；Origin 缺失时也必须精确匹配该头。网页 Origin、其他扩展、`null`、
`file://`、无身份本机请求全部 403。固定扩展只能 GET pairing route，不能访问 health、任务、控制面
或其他 API；WebSocket upgrade 同时要求 loopback remote address 与固定扩展 Origin。

pairing 响应只包含 `authority`、当前 `releaseBuildId`，以及 Authority absent 时的当前一次性密钥。
响应固定 `no-store`、`no-cache`、`no-referrer`、`nosniff` 和精确 CORS，不记录 secret。密钥只在
Workbench 与扩展握手内存中存在；认证、断开、轮换或 reload 后立即失效。

## 4. 更新与失败关闭

启动器只在 preflight 证明 artifact 缺失或与当前源不一致时运行固定 build；它不运行 CI、audit、
typecheck、acceptance、真实 Chrome 或 Browser job。重建后必须再次通过 artifact preflight，否则启动
失败关闭。启动器不直接控制 Chrome 或调用 reload；扩展只有在受限 bootstrap 读到不同的合法
`releaseBuildId` 时自行 reload。

Workbench 不存在、LNA 被 Chrome 阻止、pairing 响应非法、构建身份不匹配后的 reload 失败、握手失败、
socket 断开或 Target 失效，都保持 Browser execution/claim blocked；Shell 诊断面继续可用。自动配对
不得把 Authority/Target/任务状态伪造为 READY。

## 5. 质检矩阵

1. 同一时刻多次唤醒只产生一个 pairing fetch/pair。
2. Workbench 页面、Chrome startup、固定 alarm 可唤醒；其他标签页和其他 alarm 不可唤醒。
3. releaseBuildId 不一致只调用一次 `runtime.reload()`，不得交出 secret 或建立 socket。
4. 当前 build 身份一致才可配对；Authority present 不创建第二 socket。
5. 固定扩展身份头可读取 pairing；网页、错误扩展、null/file、缺头及固定扩展访问其他 API 均失败。
6. WebSocket 非 loopback 或非固定扩展 Origin 拒绝 upgrade。
7. manifest 只新增 `alarms`，不得新增 storage、nativeMessaging、externally_connectable 或宽 host。
8. pairing popup 不再含 password/input/copy 文案，只提供自动连接状态和人工 Target claim。
9. startup 当前 artifact 不重建；stale artifact 恰好重建一次并复检；失败构建不得启动服务。
10. 真实 Chrome 证明自动配对跨 Workbench/Chrome 重启，且 Target 在人工点击前始终 absent。

静态检查、单项 acceptance 和构建通过只证明 CHANGE 层。未运行当前候选真实 Chrome、独立审计与唯一
CI-FULL 时，不得声称完整 READY、RELEASE 或生产浏览器闭环已经完成。
