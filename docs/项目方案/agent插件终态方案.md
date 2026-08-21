# 《AGENT 插件终态方案》——全面冻结终版

> [!IMPORTANT]
> **全面冻结 / FULLY FROZEN**
>
> 本文自 2026-08-21 起作为 AGENT 本机 Chrome 插件建设的唯一终态设计合同全面冻结。后续 active law、施工图、代码、质检和真实 Chrome 验收只能向本文对齐，不得在施工中暗改目标、增加第二链、恢复付费依赖或降低验收门。
>
> 冻结后只有用户明确下达“解除冻结/修改终态方案”指令，才能修改本文。真实施工发现不可实现或证据冲突时，必须停止并报告，不能由实现者自行绕开、兼容或改写本文。
>
> 第二轮审计输入候选 SHA-256 为 `d323827f6874f109c20e7238d2e739c5513fb762b98e1237dbfc928b993bd3bb`：架构审计 `97/100 PASS`；反例审计 `88/100 FAIL` 并提出 3 项 P1。终版已逐项收口反射防护与 AEAD AAD、自哈希固定点、Chrome 更新与 72 小时 soak 递归冲突，并同时收口两份审计的全部 P2。按用户指令不再启动第三轮审计。
>
> 最终冻结文件 SHA-256 只在交付记录中外部计算，不把自身 hash 写入本文，避免制造自哈希固定点。

版本：V1.1-FROZEN

日期：2026-08-21

冻结日期：2026-08-21

状态：`FULLY_FROZEN_DESIGN / LAW_CHANGE_REQUIRED / NOT_PRODUCTION_VERIFIED`

适用范围：用户本人这一台 macOS 电脑上的 GrassEye AGENT、Google Chrome 和本地加载的 MV3 扩展

---

## 文档定位

本文只定义 AGENT 浏览器插件的唯一终态、绝对边界、验收硬标准和反复杂化禁区。

本文不是：

- 当前代码已经完成的声明。
- 当前插件已经生产可用的声明。
- Static Audit、CI-FULL 或真实 Chrome 验收结果。
- 对现役 active law 的暗中替换。
- 允许在旧通道旁边追加新通道的迁移许可。

当前 active browser law、施工图、generated audit truth 和 inspector 仍绑定 CWS 安装及 Workbench 页面转发通道，与本文目标存在正面冲突。因此施工顺序必须是：

```text
本文冻结目标
→ 修改并对齐 active law
→ 修改并对齐施工图
→ 独立审计法案与施工图
→ 物理删除旧链
→ 建设唯一新链
→ 静态质检
→ 真实 Chrome 验收
→ 长期稳定性验收
→ CI-FULL
→ 才能裁决是否生产可用
```

法案和施工图未完成对齐、未通过独立审计前，禁止进入实际代码施工。

---

# 第一部分：目标与运行逻辑路线图

## 1.1 唯一目标

建设一个只供用户本人这一台电脑长期使用的生产级 Chrome 浏览器插件，使玄学网站以及未来其他获准网站能够把明确业务工单交给本机 AGENT，由 AGENT 按固定业务流程控制真实 Chrome 完成获准网页操作。

终态必须同时满足：

1. 只在用户本机使用，不公开发布、不出售、不向其他用户分发。
2. 不依赖 Chrome Web Store 审核、上架、发布状态或自动更新。
3. 不使用 Native Host、Native Messaging、本地原生桥接可执行文件。
4. 不需要 Apple Developer Program、Developer ID Application、签名或公证。
5. 不再产生任何新增付费条件。
6. 使用真实 Chrome 和用户本人正常登录的网站账号。
7. 玄学网站可以把完整业务工单交给本机 AGENT。
8. 未来可以增加 GPT Web 之外的其他网站，但必须逐个增加明确 Job 和固定 Flow。
9. 任何身份、连接、页面、动作或结果不确定时必须失败关闭。
10. 不得依靠临时脚本、人工复制中转、页面常驻转发、备用链路或猜测恢复。

## 1.2 本方案的生产含义

本方案中的“生产级”不等于“公开商店发布”，而是：

```text
固定安装身份
+ 固定运行入口
+ 唯一认证通信通道
+ 固定业务流程
+ 精确标签页和文档身份
+ 持久化任务与动作回执
+ 有界重连和明确失败
+ 无非幂等动作自动重放
+ 真实 Chrome 验收
+ 长期稳定运行证明
```

“Load unpacked”是这台电脑上的最终本地部署方式，不是临时测试模式。零费用、不经过 CWS 的代价是：首次安装和扩展升级时需要用户在 `chrome://extensions` 手工加载或点击 Reload。不得把无法做到的静默安装、静默升级伪装成已经具备的能力。

## 1.3 威胁与信任边界

本方案成立的基础信任边界是：

- 用户本人控制这台 macOS。
- macOS 当前用户账户、Chrome 本地 Profile、AGENT 本地数据目录没有被恶意程序完全接管。
- 用户接受首次人工 Load unpacked 和升级时人工 Reload。
- 用户不把冻结的扩展目录交给其他程序随意修改。

本方案必须防御：

- 普通网页伪造插件或 AGENT 身份。
- 非法 Origin 连接。
- 其他本机进程抢占端口或伪造连接。
- 历史连接和历史消息重放。
- 第二个扩展客户端并发接管。
- 错误插件 ID、版本、协议和构建字节。
- 标签页漂移、跨站导航、文档替换和 DevTools 抢占。
- 断线导致的重复点击、重复上传和重复提交。
- 调用方传入任意 URL、脚本、selector、坐标或 CDP 方法。

如果同一 macOS 用户账户已经被恶意程序完全接管，攻击者可以读取本地密钥或篡改 unpacked 扩展目录。在“零签名、零 CWS、零 Native Host、零额外 OS 隔离”的约束下，不能承诺抵御这种整机失陷。该情形必须明确列为方案外部根信任失效，不得通过继续堆叠应用层框架制造虚假安全感。

## 1.4 唯一终态总路线

```text
玄学网站 / 未来获准网站
  → 本机 AGENT API Boundary
      → 精确 method + path allowlist
      → origin / CORS / API key / request schema 校验
      → 唯一 Job Mediator
          → 对应 Plugin 固定 Business Flow
              → 合法 Ability Group / Browser Authority Broker
                  → 当前 Authenticated Browser Authority
                      → 当前 Execution Fence
                          → 精确 BrowserTargetLease
                              → 精确 BrowserDocumentRef
                                  → BrowserCommandActor
                                      → 同一 App Server 的唯一 WebSocket upgrade path
                                          ← MV3 Service Worker 主动建立认证连接
                                              → 固定 Command Registry
                                                  → chrome.debugger
                                                      → 用户明确授权的真实标签页与真实文档
                                                          → 动作回执 / 业务状态 / Evidence / Logs
                                                              → AGENT
                                                                  → 玄学网站 / 请求网站
```

网站入口的 LNA 与 CORS 只约束真实浏览器，不能认证能够伪造 HTTP header 的本机进程。独立认证根是每个获准 Site Policy 独有的 256-bit CSPRNG API key：AGENT 仅存 owner-only `0600` credential record；获准网站运行时只能在本次受控页面内存中持有，不得编译进公开静态包、发送到远端服务、写入 URL、持久浏览器存储、日志或 Evidence。若某网站不能满足该保存边界，该 Job 保持 `BLOCKED`。

每个请求必须同时绑定 `keyId + requestId + issuedAt + deadline + method + exactPath + bodySha256`，并以 API key 做 HMAC-SHA-256；`requestId` 为一次性 128-bit 随机值，deadline 最长 60 秒，AGENT 对已见 requestId 保留至少 10 分钟 replay cache。key 支持显式轮换和立即撤销；旧 key、重复 requestId、时钟/期限越界、method/path/body hash 任一不符均失败关闭。

## 1.5 唯一通信桥

Native Host 删除后的唯一通信桥是：

```text
MV3 Extension Service Worker
  ──主动连接──>
ws://127.0.0.1:4173/browser-authority/v1
  ──由同一 AGENT App Server 接受──>
Browser Infrastructure Owner
```

连接由扩展主动建立，因为 Chrome 扩展不能充当本机监听服务器。连接完成双向认证后，同一 WebSocket 同时承载：

- AGENT 发给扩展的受治理命令。
- 扩展发给 AGENT 的状态、心跳、动作回执和受限 Evidence 字节。
- AGENT 发给扩展的 caller-approved 上传产物字节。

控制帧与 artifact 帧只在这一条已认证 WebSocket 上按判别字段复用；它们不是第二 endpoint、第二 socket 或第二 transport。

WebSocket 只负责运输，不拥有：

- 业务步骤顺序。
- Job 状态。
- 下一步决策。
- 页面选择策略。
- 业务成功结论。
- Evidence 真相。
- 日志真相。
- 重试和业务恢复策略。

## 1.6 唯一服务器边界

系统继续只有一个 App Server：

```text
src/app/server.ts
  → src/app/create-workbench-server.ts
```

同一服务器拥有：

```text
HTTP：Workbench UI 与已知业务 API
WebSocket Upgrade：唯一 Browser Authority 运输通道
```

不得为插件增加：

- 第二 HTTP Server。
- 第二 WebSocket Server。
- 第二端口发现服务。
- 独立 relay daemon。
- plugin 自己的 listener。
- capability 自己的 listener。

服务只绑定精确 `127.0.0.1:4173`。`4173` 同时是现有 Workbench HTTP 和 Browser Authority WebSocket upgrade 的唯一端口，不新增端口。禁止绑定 `0.0.0.0`、`::`、任意网卡或自动换端口。固定端口被占用时，Browser Authority 必须保持 `ABSENT` 并报告端口冲突，不能自动寻找其他端口。

## 1.7 安装与固定身份路线

首次安装固定流程：

```text
生成冻结扩展候选
→ 生成内嵌 releaseBuildId 并计算外部 ExtensionDirectoryHashV1
→ 检查 manifest V3、固定 key、固定 version、固定权限
→ Chrome 打开 Developer Mode
→ 用户选择 Load unpacked
→ 选择冻结扩展目录
→ 读回 extension ID / version / permissions
→ AGENT 核对固定 ID、版本、releaseBuildId 和外部目录 hash
→ 首次配对
→ 真实 Chrome 冒烟验证
```

扩展必须使用固定 manifest `key` 保持本机开发安装 ID 稳定。`key`是公开身份材料，不是密钥，不能拿它代替配对认证。

扩展目录哈希算法冻结为 `ExtensionDirectoryHashV1`：只接受冻结 allowlist 内的 regular files；按 UTF-8 relative path 字节序排序；每项绑定 `path + mode + byteLength + SHA-256(content)` 后再计算 canonical SHA-256。symlink、socket、device file、未登记文件和 hash exclusion 一律拒绝；mtime 不进入哈希。manifest 的 key、version 和 permissions 仍须单独读回，不能只相信目录哈希。

扩展目录内部只内嵌普通 `releaseBuildId`，它作为普通字节参与 `ExtensionDirectoryHashV1`，绝不把目录 hash 自身写回目录。AGENT 候选目录外部的冻结 release record 绑定 `releaseBuildId → ExtensionDirectoryHashV1`。握手只回报 `releaseBuildId`；AGENT 分别核对“磁盘目录 hash = 外部预期 hash”和“握手 buildId = 外部预期 buildId”，禁止自哈希 placeholder、hash exclusion 或让扩展自报目录 hash。

AGENT 每次启动必须核对：

- 期望的 extension ID。
- 期望的 extension version。
- 期望的 protocol revision。
- 外部 release record 冻结的 `releaseBuildId → ExtensionDirectoryHashV1`。
- 运行扩展握手报告的内嵌 `releaseBuildId`。
- 所需权限和禁止权限。
- Chrome executable identity、channel 和 exact version。

任一不一致只能进入：

```text
REPAIR_REQUIRED
Browser Authority = ABSENT
```

## 1.8 首次配对路线

首次配对必须由用户明确发起：

```text
AGENT 进入 PAIRING_PENDING
→ AGENT 生成 256-bit CSPRNG base64url 配对码
→ 用户把配对码输入扩展设置页
→ AGENT 与扩展各生成 P-256 ECDSA 长期身份密钥
→ 双方交换身份公钥并以配对码对 canonical pairing transcript 做 HMAC-SHA-256
→ 双方验证同一 transcript、同一短指纹和对方 proof
→ AGENT 保存自己的私钥和获准扩展公钥
→ 扩展保存 non-extractable 私钥和获准 AGENT 公钥
→ 配对码立即作废
```

配对要求：

- 配对码 5 分钟过期。
- 配对码只能成功使用一次。
- 最多允许 3 次错误 proof；达到上限立即废弃本次 pairing。
- pairing transcript 使用 RFC 8785 JSON Canonicalization Scheme，至少绑定双方身份公钥、extension ID/version/releaseBuildId、protocol revision、registry hash、profileInstanceId、双 nonce和 pairing generation。
- 身份公钥和临时 ECDH 公钥统一使用 SEC1 uncompressed P-256 65-byte 编码；ECDSA-SHA-256 签名统一使用 IEEE-P1363 64-byte `r || s` 编码，禁止实现自选 DER/raw 变体。
- `agentProof = HMAC-SHA-256(pairingCode, "grasseye-pair-agent-v1" || JCS(transcript))`；`extensionProof = HMAC-SHA-256(pairingCode, "grasseye-pair-extension-v1" || JCS(transcript))`。两个 proof 必须角色分离、不得互换或相等；双方身份公钥相等也必须拒绝。
- `profileInstanceId` 是首次配对时在该 Chrome Profile 内生成并绑定 enrollment 的随机标识；不得从 profile 路径、Google 账号、cookie、token 或浏览器秘密推导。
- AGENT 私钥只能进入 owner-only `0600` credential record；扩展私钥以 non-extractable Web Crypto `CryptoKey` 存入扩展自己的 IndexedDB，不使用 sync storage。
- 配对码、长期密钥和会话密钥不得写日志。
- 禁止把密钥放入 URL、query string、DOM 或 Evidence。
- 扩展卸载重装、固定 ID 变化或密钥漂移时必须重新人工配对。
- 禁止自动信任“来自 127.0.0.1”的任何客户端。
- 禁止算法协商、共享长期明文 secret 或用 Origin/manifest key 代替密码学身份。

## 1.9 每次连接与认证路线

每次连接固定执行：

```text
Service Worker 建立唯一 WebSocket
→ Server 校验 loopback peer、exact path、exact subprotocol、Origin 和首帧期限
→ ExtensionHello
→ AgentChallenge
→ ExtensionConfirmation
→ 双方交换临时 P-256 ECDH 公钥
→ 双方以角色分离域标签和长期 P-256 ECDSA 身份密钥签名完整 canonical transcript
→ 双方验证角色签名并完成角色分离的 key confirmation
→ HKDF-SHA-256 派生两个方向独立的 AES-256-GCM session key
→ 对冻结 registry、permission policy 和 site-policy registry hash 做精确相等 readback
→ AUTH_PROOF_COMMITTED
→ Browser Authority: ABSENT → PRESENT
```

`ExtensionHello`至少绑定：

- extension ID。
- extension version。
- releaseBuildId。
- protocol revision。
- enrollment ID。
- client nonce。
- connection generation。
- Chrome version。
- capability registry hash。
- site-policy registry hash。
- 临时 ECDH 公钥和 direction-specific connection nonce prefix。

完整 connection transcript 使用 RFC 8785 canonical JSON，必须绑定双方身份公钥、双方临时 ECDH 公钥、extension ID/version/releaseBuildId、Chrome identity、protocol/command-registry/site-policy-registry hash、permission policy、双 nonce、connection generation 和 connection epoch。双方临时 ECDH 公钥相等必须拒绝。Agent 签名域为 `grasseye-conn-agent-sign-v1`，Extension 签名域为 `grasseye-conn-extension-sign-v1`，禁止互换。HKDF 的 salt 为 transcript hash，分别以 `grasseye-browser-c2s-v1`、`grasseye-browser-s2c-v1`、`grasseye-browser-confirm-agent-v1` 和 `grasseye-browser-confirm-extension-v1` 派生两个方向 AES key 与两个角色 confirmation key。key confirmation 使用对应角色 key 对 `roleLabel || transcriptHash` 做 HMAC-SHA-256；双方确认完成后才允许 commit authority。

每个会话必须形成全新 `connectionEpoch`、临时 ECDH 密钥、两个方向密钥和两个随机 32-bit nonce prefix。AES-GCM 的 96-bit nonce 固定由 `direction-specific 32-bit prefix + 64-bit sequence` 组成；sequence 永不复用。旧会话不能 rebind 新连接，不能在线续成新身份，不能把旧任务恢复到新 authority。

未认证连接的预算固定为：全局最多 4 个 pending handshake、首帧 3 秒、单连接 pre-auth 总字节 32 KiB。超限或错误连接只关闭自身，不得撤销当前合法 authority；只有第二客户端用已登记身份完成完整认证并产生身份冲突后，才先 revoke 当前 authority 再裁决新连接。

## 1.10 消息合同路线

协议使用严格判别联合，禁止为不适用的帧填空字符串或 sentinel：

```text
PreAuthFrame
= Pairing | ExtensionHello | AgentChallenge | ExtensionConfirmation

AuthenticatedFrameCommon
= protocolRevision + sessionId + connectionEpoch + direction
+ sequence + frameType + deadline + payloadHash + ciphertext + authenticationTag

CommandFrame / ReplyFrame
= AuthenticatedFrameCommon + taskId + executionFenceHash
+ commandId + capabilityId + sitePolicyId + sitePolicyVersion
+ sitePolicyEntryHash + actionId + controlId
+ targetLeaseRef + documentRef + replyToken

HeartbeatFrame / ControlStateFrame / ArtifactFrame
= AuthenticatedFrameCommon + 该 frameType 自己的固定 schema
```

消息规则：

- 双方向分别使用严格递增 sequence。
- 重复、倒退、跳号、跨方向反射、旧 epoch 一律关闭连接。
- frame、queue、in-flight 和 artifact 均有固定上限。
- deadline 包含排队时间。
- 协议只接受明确 schema，未知字段和未知命令失败关闭。
- WebSocket compression 默认关闭，除非经过压缩炸弹负面验收。
- 控制帧不能携带完整大文件、完整截图、完整 HTML 或秘密。
- AES-GCM plaintext 是该 frame 的 payload；AAD 固定为“除 `ciphertext` 与 `authenticationTag` 外全部 frame envelope 字段”的 RFC 8785 canonical JSON。protocol、session/epoch、direction、sequence、frameType、deadline、payloadHash、command、policy、target/document 和 reply token 均必须被 AAD 认证；禁止只认证 payload。

### 1.10.1 同一 WebSocket 内的 Artifact 子协议

Artifact 只在同一条已认证 WebSocket 内运输：

```text
ARTIFACT_OPEN(grantRef, direction, mediaType, totalBytes, contentHash, chunkSize, deadline)
→ ARTIFACT_CHUNK(grantRef, chunkSequence, encryptedBytes)
→ ARTIFACT_COMPLETE(grantRef, totalBytes, contentHash)
→ ARTIFACT_COMMITTED | ARTIFACT_FAILED
```

唯一硬边界：

- `AGENT → Extension` 只允许 caller-approved upload artifact；`Extension → AGENT` 只允许 law-approved screenshot/evidence artifact。
- raw/resolved path 永远停留在 AGENT file-grant owner 内；wire 只传 `grantRef` 和加密字节。file-grant owner 必须在 `ARTIFACT_OPEN` 前完成 open/fstat/hash，并始终从同一个已打开文件描述符流出字节；path、inode、size 或 hash 漂移立即 `ARTIFACT_FAILED`。
- 每个 stream 绑定 authority epoch、execution fence、target/document、content hash、AEAD、deadline 和 reply token。
- `artifactMaxBytes = 64 MiB`、`chunkSize = 64 KiB`、同一 connection 同时最多 1 个 artifact stream、最多缓冲 8 个 chunk、stream deadline = 120 秒；边界值必须做 n-1/n/n+1 验收。
- 断流、hash 不一致、乱序、document 漂移、authority 变化或 Service Worker 重启一律 `ARTIFACT_FAILED`，销毁未提交字节，不转 raw path、不调用 native picker、不切换第二通道。
- `upload_approved_artifact` 只能使用 Command Registry 内唯一、固定的 browser-side bytes-to-`File/FileList` 实现；必须先在本次真实 Chrome、真实目标 file input 上证明。证明前所有需要上传的 Job 均为 `BLOCKED / NOT_PRODUCTION_VERIFIED`。

## 1.11 Service Worker 生命周期路线

`minimum_chrome_version` 固定为 `"120"`；低于 Chrome 120 直接阻断，不建设旧版本兼容链。

Service Worker 顶层且只注册一次：

- `chrome.action.onClicked`。
- `runtime.onStartup`。
- `runtime.onInstalled`。
- `alarms.onAlarm`。
- `debugger.onDetach`。
- 必需的 tab/navigation 生命周期 listener。

连接存活策略：

- Extension WebSocket Transport Actor 是唯一 reconnect scheduler；Server Transport Owner 只接受、认证、拒绝或关闭连接，永不主动建立第二连接或启动重连 timer。
- 认证后每不超过 `20,000ms` 交换一次双向认证应用层心跳。
- 心跳只能续租已经存在的 authority，不能创建 authority。
- `35,000ms` 无合法双向活动进入 soft drain；`45,000ms` 无合法双向活动时第一动作必须撤销 authority。
- 每次 Worker 顶层启动、`runtime.onInstalled` 和 `runtime.onStartup` 都必须幂等检查并保证恰好一个 30 秒 reconnect alarm；Chrome 重启后也不得假定 alarm 仍存在。
- `alarms.onAlarm` 在无 socket 时最多发起一次连接；单次连接尝试 deadline 为 5 秒，不启动嵌套 timer、while loop 或并发连接。
- alarm 不拥有重试次数、业务任务、认证状态或命令恢复。
- 基础设施允许在 `AUTHORITY_ABSENT` 时由唯一 alarm 每 30 秒触发一次长期 probe；“禁止无界 reconnect”专指禁止无界频率、并发、队列和业务等待。每个 browser-required Job 有独立固定 admission deadline，超时即 `BLOCKED`。

## 1.12 业务工单运行路线

网站只能提交一张明确、完整、版本化的业务工单：

```text
Website Request
→ API Boundary 校验身份、来源、route 和业务 schema
→ Mediator 识别唯一 jobId
→ Plugin 读取固定 Flow
→ Plugin 检查当前业务状态和 execution fence
→ BrowserAuthorityBroker 提供当前 authority lease
→ 核验用户手势产生且仍有效的 OperatorTargetApproval
→ 取得 exact target/document lease
→ CommandActor 逐个签发固定 capability command
→ Extension Command Registry 执行动作
→ 每一步完成正向确认、反向排除、唯一性和有界停止
→ Plugin 决定下一业务步骤
→ 结果、Evidence 和 Logs 分别写入各自唯一 owner
→ 整单结果返回网站
```

外部网站不得逐步骤遥控 AGENT。它只能请求已存在的 Job，不能决定浏览器动作。

## 1.13 多网站扩展路线

插件不能写死成“GPT 专用插件”，但扩展其他网页的单位必须是明确 Job，而不是任意 URL。

新增网站固定流程：

```text
确认一个具体业务需求
→ 建立唯一 job-id
→ 定义该 Job 的输入 schema 和结果合同
→ 定义 Plugin 固定业务 Flow
→ 定义 Site Policy
→ 复用现有 Ability Group 公共接口
→ 如需新增固定 capability，先完成法案和执法授权
→ 定义正向终态和反向排除项
→ 建立 AST inspector / acceptance / real-Chrome 证明
→ 通过后才进入生产 registry
```

每个 `SitePolicy` 至少固定：

- jobId。
- 允许的 exact origins。
- 必要的路径范围。
- 允许的 capability IDs。
- 请求和响应 schema 版本。
- 页面身份确认方法。
- 允许观察的数据字段与长度上限。
- mutation 类别。
- 是否需要人工最终确认。
- 正向完成条件。
- 非目标 origin、非目标页面身份、相邻错误态、加载态、过期态和重复态。
- 最大观察次数、最大滚动次数和截止时间。
- navigation/document 变化后的失效规则。

全部 active SitePolicy canonical entries 的构建期聚合哈希固定称为 `sitePolicyRegistryHash`。每个 entry 必须有 `sitePolicyId + sitePolicyVersion + sitePolicyEntryHash`，每个允许动作必须在 `SiteActionRegistry` 中以 `actionId + controlId` 固定登记。

Wire 不接受 CSS selector、XPath、任意 locator 字符串、任意 URL、任意 CDP method 或 JavaScript。`actionId/controlId` 只能由 Extension Command Registry 解析为固定实现。新增网站必须同时更新 Agent 与 Extension 的 canonical registry，产生新的 `releaseBuildId + ExtensionDirectoryHashV1 + registry hash + release`；不得通过运行时配置下载脚本、放宽域名、扩展 policy 或开放任意动作。

## 1.14 精确标签页与文档路线

目标标签只能由用户通过顶层 `chrome.action.onClicked` 明确 claim。该用户手势产生一个 `OperatorTargetApproval`：固定 TTL 为 60 秒，绑定唯一 `approvalId + process/profile/tab/document/origin/job/sitePolicy`，不是跨 authority epoch 的 `BrowserTargetLease`；扩展将它作为只读 claim event 回传，Wire 不得存在 claim/select/activate/current/first-tab 命令，也不得创建、延长或刷新 approval。

新 authority 下仅当以下事实全部未变化时，Browser owner 才可基于同一 approval 重新 acquire 新 lease：同一 Chrome process incarnation、同一 profileInstanceId、同一 tab identity、同一 document generation、同一 exact origin、同一 job/site policy，且 approval 未过期。Chrome 重启、tab close、document/navigation 变化、profile 变化、extension reinstall、approval 过期或任一身份无法读回时，必须重新人工 claim；不得通过 URL、标题或相似页面恢复。每次重连产生的新 lease 都使用新 authority epoch，旧 lease 永久失效。

目标身份至少包含：

- `profileInstanceId`（首次配对时在该 Profile 内随机生成并绑定 enrollment，不读取 profile path、Google 账号或浏览器秘密）。
- tab identity。
- window identity。
- exact origin。
- exact document generation。
- navigation epoch。
- authority epoch。
- execution fence。
- claiming owner。

以下任一变化立即使旧 lease 失效：

- 页面 committed navigation。
- document/frame generation 变化。
- tab 关闭。
- target 被替换。
- debugger detach。
- 用户打开该标签页 DevTools 导致 debugger 冲突。
- authority 断开或过期。
- execution fence 失效。
- extension reload、disable 或 upgrade。

不得把任务自动转移到相似标签页、当前标签页、第一个标签页或同域其他标签页。

## 1.15 固定命令路线

扩展内部 Command Registry 只能包含版本化、schema-bound 的固定命令。每项命令至少定义：

- `capabilityId`。
- request/response schema。
- mutation class。
- origin policy。
- 字段和 payload 上限。
- target/document 要求。
- execution fence 要求。
- browser-side postcondition。
- owner-side business postcondition。
- acceptance 和真实页面证据。

允许的 Wire 命令概念必须是受治理的原子能力，例如：

```text
observe_document
locate_known_control
fill_approved_value
click_approved_control
upload_approved_artifact
verify_terminal_state
capture_evidence
```

用户 claim 属于 `chrome.action.onClicked` 产生的本地只读事件，不属于 Command Registry。每条 Wire 命令必须绑定 `sitePolicyId + sitePolicyVersion + sitePolicyEntryHash + actionId + controlId`；命令只能表达“做一个固定动作”，不能表达“完成整个网站工作流”。

## 1.16 Mutation 与断线恢复路线

所有非只读动作在发送前必须持久化：

```text
PREPARED(commandId, executionFenceHash, mutationClass, payloadHash)
→ fsync
→ 发送精确命令
→ 扩展 admission
→ 页面动作
→ 扩展生成当前 connection epoch 内的 bounded in-memory session-authenticated receipt
→ AGENT 验证 commandId / payloadHash / postcondition
→ AGENT fsync TERMINAL_SUCCESS / TERMINAL_FAILURE
→ Plugin 读取 AGENT journal 终态
```

`MutationJournal` 的唯一 durable owner 是 AGENT。扩展不得建立第二 durable mutation journal，也不得让内存 receipt 跨 Worker/connection epoch 复活。只有 AGENT 已经验证并 fsync terminal 后，系统才拥有已知终态。

断线后的唯一分类：

| 断线位置 | 结果 | 后续 |
| --- | --- | --- |
| `PREPARED` 前 | `NOT_SENT` | 可以由业务 owner重新调度 |
| `PREPARED` 后、发送前且有确定证明 | `NOT_SENT` | 可使用相同业务意图重新签发新 commandId |
| 扩展 admission 后、动作前且有确定证明 | `NOT_EXECUTED` | 重新取得新 authority/target 后由业务 owner决定 |
| 页面动作可能发生、AGENT terminal fsync 前（包括扩展已生成 receipt 但 AGENT 未 durable commit） | `OUTCOME_UNKNOWN` | 禁止自动重放，必须真实页面裁决 |
| AGENT 已 fsync terminal、Plugin ACK 前 | 已有终态 | 只读取 AGENT journal 中既有 terminal，禁止重复动作 |

同一个 command ID + 同一个 payload hash：只有 AGENT 唯一 journal 已有 durable terminal 时才返回既有 terminal；只有 `PREPARED` 或其他非终态时，必须严格按上表分类为 `NOT_SENT / NOT_EXECUTED / OUTCOME_UNKNOWN`，不得伪造结果或重执行。同一个 command ID + 不同 payload hash 是安全攻击或状态损坏，必须撤销 authority。

## 1.17 Authority 撤销路线

以下任一事件发生时，第一同步动作必须是撤销 authority：

- WebSocket close/error。
- 心跳硬过期。
- macOS sleep/wake 时间不连续。
- AGENT 进程退出或重启。
- Chrome 进程退出或重启。
- Service Worker 重启。
- 扩展 reload、disable 或卸载。
- extension ID、version、releaseBuildId、外部目录 hash 或 protocol 漂移。
- 第二个已登记客户端完成完整认证并与当前身份发生冲突；普通未认证连接只关闭自身。
- profile、site policy 或 permission policy 漂移。
- target/document/navigation 变化。
- DevTools 抢占 debugger。
- sequence、MAC、AEAD、deadline 或 frame budget 失败。

撤销顺序固定为：

```text
authority = ABSENT
→ cancel permits
→ invalidate target/document leases
→ classify in-flight mutations
→ persist failure/recovery facts
→ emit redacted diagnostics
→ cleanup
→ bounded reconnect
```

禁止先重连、先清理或先记录日志，再撤销 authority。

## 1.18 启动路线

唯一用户启动命令保持：

```bash
npm run grasseye:start
```

启动层只负责：

```text
检查依赖
→ 探测唯一 App Server
→ 验证源码/候选指纹
→ 启动或热挂载唯一 App Server
→ 打开 Workbench
→ 启动 Browser infrastructure control plane
→ 等待插件主动连接
→ 输出 browserInfrastructure / browserAuthority 状态
```

Workbench 可以在扩展未连接时正常打开，但所有 browser-required Job 必须保持阻断。启动成功不等于 Browser Authority 成功，更不等于业务生产完成。

AGENT 每次启动和每次握手都必须读回 Chrome executable identity、channel 和 exact version。Chrome 自动更新、channel 变化或 executable identity 漂移时，第一动作是 `Browser Authority = ABSENT`，并进入 `CHROME_REVALIDATION_REQUIRED`；旧 Chrome 证据不得证明新 Chrome 候选。

## 1.19 升级与回滚路线

升级固定流程：

```text
停止领取新 browser-required Job
→ drain 当前安全工作
→ 撤销 authority
→ 冻结 Agent + Extension 同一候选
→ 计算 version / protocol / releaseBuildId / ExtensionDirectoryHashV1
→ 整体替换扩展目录
→ 用户在 chrome://extensions 点击 Reload
→ 新扩展重新握手和认证
→ 读取 ID/version/hash/permissions
→ 真实 Chrome 冒烟
→ 恢复领取任务
```

回滚只能整体恢复上一份冻结的 Agent + Extension 候选，再执行人工 Reload 和重新认证。禁止让新 Agent 同时兼容旧扩展，也禁止让旧 Agent同时接受新扩展。

Chrome 更新故障验收必须在最终 72 小时 soak 之前完成，用于证明版本漂移会先撤销 authority 并进入再准入。此后冻结最终 exact Chrome version；任何 exact version、channel 或 executable identity 变化都使本轮 soak 立即 FAIL，必须在新 Chrome 候选上重跑 WebSocket/MV3 lifecycle、debugger attach/detach、exact target、一个 observation journey、一个 mutation fault case、GPT Web、第二真实网站 smoke，并从零重新开始完整 72 小时 soak。不存在 patch delta 免验或旧证据复用。

## 1.20 施工路线图

### 阶段 A：目标冻结

- 冻结本文。
- 明确本机自用、零新增费用、unpacked 最终部署。
- 明确唯一认证 loopback WebSocket。
- 明确未来多网站采用逐 Job 扩展。

### 阶段 B：法案和施工图

- 原位修改 local-browser-session active law。
- 删除 CWS review/install 根信任。
- 删除 Workbench page relay、external Port 和 polling 法定身份。
- 固化 Local Pinned Unpacked Release Identity。
- 固化唯一 WebSocket owner、握手、liveness、revoke 和 recovery。
- 同步修改 Browser 施工图、inspector manifest、acceptance 绑定。
- 两个独立只读子智能体审计；每个都必须 `score >= 95` 且 `P0=0、P1=0` 后才能继续。

### 阶段 C：片区删除

- 物理删除 Native Host 和 Native Messaging 残留。
- 物理删除 `externally_connectable`。
- 物理删除 Workbench 页面 runtime Port relay。
- 物理删除 HTTP 高频轮询和 page-session grant。
- 物理删除 CWS identity/review/install proof owner。
- 物理删除 previous protocol compatibility window。
- 物理删除所有旧 inspector、acceptance 和 generated binding 来源。

### 阶段 D：唯一链建设

- 在现有唯一 App Server 建立精确 WebSocket upgrade path。
- 建立唯一 Server Transport Actor。
- 建立唯一 Extension WebSocket Actor。
- 建立首次配对和每连接双向认证。
- 建立 session/epoch/sequence/deadline/frame budget。
- 建立 heartbeat、alarm 和有界 reconnect。
- 把现有 Browser Authority、target lease、Command Actor接入唯一 transport。
- 重建 unpacked release identity、升级和 readback。

### 阶段 E：业务接入

- 先接入一个观察型真实 Chrome 旅程。
- 再接入一个可逆 mutation 旅程。
- 再接入玄学 GPT Web 固定 Job。
- 再使用第二个不同网站证明多网站治理模型。
- 每个网站分别建立 Site Policy、acceptance 和真实页面证据。

### 阶段 F：质检与投产

- Static Audit。
- Typecheck。
- Acceptance。
- 真实 Chrome 故障矩阵。
- 72 小时强制 soak；24 小时只作为中间预检，不能签发投产状态。
- 独立子智能体终审。
- 最后运行 CI-FULL。
- 所有证据绑定同一候选后才能裁决生产可用。

---

# 第二部分：边界——要与坚决不要

## 2.1 什么是“要”

“要”表示插件和 AGENT 必须建设、必须保留、必须能被实证证明的终态责任。

### 要 1：本机单用户部署

- 只服务用户本人这一台电脑。
- 使用用户本人真实 Chrome。
- 使用本地固定 unpacked 扩展目录。
- 使用固定 manifest key 和稳定 extension ID。
- 使用专用、明确、可读回身份的 Chrome profile。

### 要 2：唯一认证 WebSocket

- 扩展 Service Worker 主动连接本机 AGENT。
- 只连接精确 `ws://127.0.0.1:4173/browser-authority/v1`。
- 只存在一个 WebSocket client Actor。
- 只存在一个 server-side transport owner。
- 只存在一个 reconnect owner。
- 所有浏览器命令和回执走同一已认证 socket。

### 要 3：明确的 Browser Authority

- Browser 数据面只有 `ABSENT` 或 `PRESENT`。
- 未完成身份认证时只能是 `ABSENT`。
- 握手、连接中、退避、修复不是 authority。
- authority 与 connection epoch、扩展身份、协议、releaseBuildId、外部目录 hash、profile 和 policy 绑定。
- 任何不连续先撤销 authority。

### 要 4：精确标签和精确文档

- 用户明确 claim 目标标签页。
- 每个命令绑定 exact target 和 exact document。
- navigation、document change、detach 和 close 立即使 lease 失效。
- 后台操作不得改变非目标前台标签状态。

### 要 5：固定 Job 和固定 Flow

- 一个业务需求对应一个明确 job-id。
- 一个 Plugin 拥有一条固定业务 Flow。
- Mediator 只负责接、验、转、回。
- 网站只提交业务输入，不能提交动作步骤。
- AI 不能决定下一浏览器动作。

### 要 6：多网站可扩展但逐站治理

- GPT Web 是第一个具体网站，不是插件唯一写死目标。
- 新网站通过新增明确 Job、Site Policy 和验收接入。
- 每个网站有独立 origin allowlist 和固定能力集合。
- 每个网站分别完成真实 Chrome 观察和验收。

### 要 7：固定 Command Registry

- 所有命令构建期登记。
- 所有请求和响应 schema 化。
- 所有字段、帧、队列、并发和截止时间有上限。
- 每个命令声明观察或 mutation 类别。
- 每个命令有 browser-side postcondition。
- 业务成功只由 owning Plugin 判断。

### 要 8：断点和重复治理

- 任务、阶段、命令意图和终态回执持久化。
- mutation 发送前 `PREPARED + fsync`。
- 同 commandId 同 hash 去重。
- 不确定动作进入 `OUTCOME_UNKNOWN`。
- 只有业务 owner 通过真实页面确认后才能决定后续。

### 要 9：失败关闭

- 身份不明停止。
- 页面不明停止。
- 候选为零停止。
- 候选超过一个停止。
- 正反证据冲突停止。
- 超过固定次数或截止时间停止。
- 登录、验证码、2FA、风控和 DevTools 冲突进入明确阻断或人工复核。

### 要 10：四本真相分离

- Plugin 持有业务状态真相。
- Forensics Persistence 持有 Evidence 真相。
- Runtime Log Spine 持有诊断日志真相。
- Audit System 持有静态合规真相。
- 四者互不冒充、互不替代。

### 要 11：最小权限和秘密保护

- manifest 只保留真实使用的最小权限。
- 不声明 `nativeMessaging`。
- 不声明 `externally_connectable`。
- 不使用 `<all_urls>`。
- 不读取或记录 cookies、密码、token、localStorage 或 sessionStorage。
- 密钥、完整 HTML、完整页面正文和敏感文件不得进入日志。

### 要 12：可观察、可修复、可升级

- Workbench 明确显示 infrastructure、authority、target、task 和 failure 状态。
- 错误包含结构化 reason 和 recovery requirement。
- 版本不匹配进入 `REPAIR_REQUIRED`。
- 升级是完整候选替换和人工 Reload。
- 回滚是完整候选回滚，不是协议兼容窗口。

## 2.2 什么是“坚决不要”

“不要”表示绝对禁区。任何一项出现，都不是“先保留以后删除”，而是终态不合格。

### 不要 1：任何付费发布依赖

- 不要 Apple Developer Program。
- 不要 Developer ID Application。
- 不要签名、公证或付费证书。
- 不要 CWS 审核作为运行条件。
- 不要 CWS 安装作为生产根信任。
- 不要额外付费云桥接服务。

### 不要 2：Native Host 和原生旁路

- 不要 Native Messaging。
- 不要 `nativeMessaging` permission。
- 不要 `runtime.connectNative`。
- 不要 Native Host manifest。
- 不要 Rust/Swift/Objective-C 本地桥接进程。
- 不要 AppleScript、JXA、系统鼠标键盘或剪贴板控制旁路。

### 不要 3：第二运输链

- 不要 WebSocket 与 HTTP polling 并存。
- 不要 WebSocket 与 SSE 并存。
- 不要页面 Port relay 备用链。
- 不要 Workbench 页面常驻中转。
- 不要独立 CDP/remote-debugging 旁路。
- 不要 Playwright 作为生产备用控制器。
- 不要“主链失败就切换另一链”。

### 不要 4：网页直接遥控插件

- 不要网站直接 `runtime.connect` 插件。
- 不要外部网页成为 transport owner。
- 不要网站发送 selector、coordinate 或 browserCommand。
- 不要网站发送 tabId、windowId、documentId 或 marker。
- 不要网站选择内部 flowStep、capabilityId 或并发。

### 不要 5：万能浏览器控制器

- 不要任意 JavaScript。
- 不要 `eval`、`new Function`。
- 不要 caller-supplied `Runtime.evaluate`。
- 不要 caller-supplied raw CDP method。
- 不要任意 URL 打开器。
- 不要通用 planner、nextAction engine 或 actionPlan。
- 不要 AI 生成工作流、selector 或浏览器命令。

### 不要 6：目标猜测和自动转移

- 不要 current tab fallback。
- 不要 active tab fallback。
- 不要 first tab fallback。
- 不要 URL-first 模糊命中。
- 不要相似页面自动接管。
- 不要 debugger detach 后转移到其他标签。
- 不要导航后继续使用旧 document ref。

### 不要 7：无限循环和隐藏重试

- 不要无界 reconnect。
- 不要毫秒级永久轮询。
- 不要无限观察、滚动、搜索或等待。
- 不要 catch 后吞错继续。
- 不要 fire-and-forget 业务任务。
- 不要无界 queue、cache、receipt 或 artifact stream。

### 不要 8：非幂等自动重放

- 不要断线后自动重复点击。
- 不要自动重复上传。
- 不要自动重复提交。
- 不要因为没有 ACK 就假定没执行。
- 不要用新 executionId 掩盖已经可能发生的动作。
- 不要把 `OUTCOME_UNKNOWN` 写成成功或普通失败。

### 不要 9：两套身份和两套协议

- 不要 CWS identity 与 unpacked identity 并存。
- 不要 current/previous 双协议窗口。
- 不要新旧 extension 同时可用。
- 不要新旧 Agent 互相兼容。
- 不要 runtime capability intersection。
- 不要别名、wrapper 或 adapter 保留旧合同。

### 不要 10：跨 owner 越权

- 不要 App Shell 执行业务流程。
- 不要 API Boundary 决定动作。
- 不要 Mediator 操作浏览器。
- 不要 Browser owner 决定业务成功。
- 不要 capability 隐藏完整工作流。
- 不要 plugin import 其他 plugin 或 capability 私有 runtime。
- 不要审计脚本修改生产源码。

### 不要 11：假证据和假投产

- 不要 typecheck 冒充真实 Chrome。
- 不要 Static Audit 冒充真实网站成功。
- 不要 fixture 冒充真实账号和页面。
- 不要 CI-FULL 冒充外部平台可用。
- 不要日志里的 success 冒充 Evidence。
- 不要旧候选的 PASS 证明新候选。

### 不要 12：秘密和隐私泄露

- 不要日志记录配对码、长期密钥或 session key。
- 不要读取或持久化 cookie、密码、token。
- 不要记录完整 HTML、完整私密页面或大 payload。
- 不要在 wire 传任意本地 raw path。
- 不要把截图、PDF、页面正文变成公共 telemetry。

---

# 第三部分：验收硬标准

## 3.1 验收总则

每项验收必须绑定同一冻结候选：

```text
candidate commit
+ Agent source hash
+ releaseBuildId + ExtensionDirectoryHashV1
+ manifest version/key/permissions
+ protocol revision/hash
+ site-policy registry hash
+ audit-plan hash
+ acceptance inputs
+ Chrome version/profile identity
```

候选任何字节、权限、协议、法案、施工图、inspector 或 acceptance 变化，都使旧 PASS 对新候选失效。必须从最早受影响的门重新验收。

验收状态只有：

```text
PASS
FAIL
NOT_RUN
NOT_PRODUCTION_VERIFIED
```

没有 warning pass、partial pass、soft pass 或“基本可用”。

## 3.2 法案与施工图准入门

### GOV-001：目标一致

- 条件：active law 明确本机单用户、unpacked 最终部署、零 CWS 依赖、零 Native Host。
- 证据：法案原文、law-registry generated entry、独立审计报告。
- 失败：仍要求 CWS review/install 或禁止 unpacked。

### GOV-002：唯一通道一致

- 条件：法案、施工图、manifest、owner inspector 均只承认认证 loopback WebSocket。
- 证据：逐项映射表和 AST inspector receipt。
- 失败：任一处仍承认 page relay、polling、SSE、Native Messaging 或远程 CDP。

### GOV-003：Owner 一致

- 条件：业务 Flow、Browser Authority、API Boundary、Evidence、Logs、Audit 各有唯一 owner。
- 证据：法案 owner 表、施工图目录映射、import boundary inspector。
- 失败：两个模块能决定同一状态或动作。

### GOV-004：独立方案审计

- 条件：两个新的独立只读子智能体对法案、施工图和本文逐条核对；每个审计均须 `score >= 95` 且 `P0=0、P1=0`。
- 证据：绑定候选 hash 的审计报告。
- 失败：审计未绑定候选、发现 blocking gap 或完成率低于门槛。

### GOV-005：代码施工禁入

- 条件：GOV-001～GOV-004 全部 PASS 后才允许改生产代码。
- 证据：施工准入记录。
- 失败：先写代码后补法。

### COST-001：零新增费用

- 条件：构建、安装、运行、升级、回滚和验收所需账户、证书、商店、云服务及第三方服务新增支出均为 0。
- 证据：依赖、账户、服务清单及逐项 `cost=0` 记录。
- 失败：Apple Developer、Developer ID、CWS 注册/审核、付费签名公证、付费 relay、付费更新或新增付费服务成为运行条件。

## 3.3 旧链物理删除门

### DEL-001：Native Host 为零

- 条件：源码、manifest、脚本、构建、产物、启动、验收和文档活动入口均无 Native Host。
- 证据：AST/文件系统 inspector。
- 失败：存在 `nativeMessaging`、`connectNative`、host manifest 或可达原生桥接代码。

### DEL-002：页面 Relay 为零

- 条件：无 `externally_connectable`，无 Workbench page → extension Port relay。
- 证据：manifest readback、AST import/call graph、真实 Chrome negative case。
- 失败：页面仍可直接连接或转发插件命令。

### DEL-003：Polling/SSE 为零

- 条件：浏览器命令和回执不使用 HTTP polling、long polling 或 SSE。
- 证据：AST transport owner scan、运行连接观测。
- 失败：存在第二命令获取或结果回传通道。

### DEL-004：CWS 根信任为零

- 条件：运行时不读取 CWS item、review receipt、installed-from-store 作为 authority 条件。
- 证据：release identity schema、owner inspector、negative mutant。
- 失败：没有商店审核就不能 mint authority。

### DEL-005：旧兼容面为零

- 条件：没有 legacy adapter、alias、wrapper、fallback、current/previous protocol window。
- 证据：Code Purity live graph、import graph、mutant test。
- 失败：旧合同仍然可达，即使默认关闭也算失败。

## 3.4 安装与身份门

### ID-001：固定 Extension ID

- 条件：相同 manifest key 和冻结目录在多次 Reload/Chrome 重启后 ID 不变。
- 证据：至少五次 readback 记录。
- 失败：ID 漂移或运行时接受未知 ID。

### ID-002：Build Hash 一致

- 条件：外部冻结 release record 的 `releaseBuildId → ExtensionDirectoryHashV1` 映射成立；AGENT 实算目录 hash 等于外部预期，握手 `releaseBuildId` 等于外部预期。扩展内部不得包含目录 hash 自身；symlink、未登记文件或 mode/content 漂移均拒绝。
- 证据：外部 release record、canonical file manifest、启动报告和认证 transcript。
- 失败：任何一处不一致仍进入 PRESENT。

### ID-003：版本与协议精确匹配

- 条件：Agent version、extension version、protocol revision和 registry hash 精确匹配。
- 证据：握手 readback。
- 失败：版本不匹配时仍接受命令或自动降级协议。

### ID-004：权限冻结

- 条件：manifest 只有真实使用的最小权限，无 nativeMessaging、externally_connectable、`<all_urls>`。
- 证据：manifest readback 与 Chrome permissions 页面截图/记录。
- 失败：多余权限、通配域或权限静默扩大。

### ID-005：本地目录漂移阻断

- 条件：运行中修改冻结扩展目录后，下一次 readback/握手必须进入 REPAIR_REQUIRED。
- 证据：负面故障注入记录。
- 失败：字节漂移仍维持 authority。

## 3.5 配对与连接安全门

### AUTH-001：首次配对

- 条件：未配对扩展只能进入 PAIRING_PENDING，不能产生 authority。
- 证据：真实 Chrome 首次安装流程。
- 失败：只凭 Origin、ID 或 loopback 即自动信任。

### AUTH-002：配对码生命周期

- 条件：配对码为 256-bit CSPRNG base64url、5 分钟、单次使用、最多 3 次错误 proof；Wire 只发送带 `agent/extension` 不同固定域标签的 canonical transcript HMAC，不发送配对码本身。两个 proof 互换、相等或双方身份公钥相等必须拒绝。
- 证据：过期、重用、错误码、proof 反射/互换、相同身份公钥负例。
- 失败：配对码可重复使用或永久有效。

### AUTH-003：双向挑战

- 条件：双方以不同角色域标签和长期 P-256 ECDSA 身份密钥签名同一 RFC 8785 transcript，使用固定 SEC1/P1363 编码，交换不相等的临时 P-256 ECDH 公钥，通过 HKDF-SHA-256 派生方向分离的 AES-256-GCM key 与角色分离 confirmation key，并完成 key confirmation。每个认证帧的全部 envelope 字段进入 RFC 8785 AAD。
- 证据：握手 transcript、角色签名反射、编码变体、错 key/transcript/ECDH、相同临时公钥、key confirmation、AAD header 篡改负例。
- 失败：只有 server 验证 client 或只有 client 验证 server。

### AUTH-004：精确来源

- 条件：只接受 loopback peer、固定 path、subprotocol 和精确 extension Origin。
- 证据：错误 peer/path/protocol/Origin 全部拒绝。
- 失败：接受 localhost 模糊匹配、任意端口或任意扩展 Origin。

### AUTH-005：单 active client

- 条件：同一时间只能有一个已认证扩展连接。
- 证据：第二客户端并发连接负例。
- 失败：双 active authority 或新连接无撤销接管旧连接。

### AUTH-006：消息反重放

- 条件：旧 epoch、重复 sequence、倒序、跳号、跨方向反射、AES-GCM tag 失败和 nonce prefix/sequence 重用全部拒绝。
- 证据：协议攻击 acceptance。
- 失败：任一旧消息产生状态或页面副作用。

## 3.6 WebSocket 与生命周期门

### WS-001：真实 MV3 连接

- 条件：当前目标 Chrome Stable（最低 Chrome 120）的 MV3 Service Worker 能连接 `ws://127.0.0.1:4173/browser-authority/v1`，且与现有 HTTP 共用唯一 App Server listener。
- 证据：真实 Chrome 网络/运行日志和认证完成记录。
- 失败：只靠文档推测或模拟 WebSocket。

### WS-002：唯一连接

- 条件：运行时始终只有一个 socket、一个 client Actor、一个 server owner。
- 证据：运行指标和 72 小时 soak。
- 失败：重复 socket、重复 listener 或并行重连 owner。

### WS-003：心跳续租

- 条件：不超过 20 秒的认证心跳能保持 worker/authority；35 秒无合法双向活动进入 soft drain；45 秒硬过期先 revoke；错误心跳不能 mint authority。
- 证据：强制 worker inactive 和心跳故障注入。
- 失败：无心跳仍无限保持 PRESENT，或 heartbeat 自己创建 authority。

### WS-004：有界重连

- 条件：每次 Worker 启动均幂等保证恰好一个 30 秒 reconnect alarm；每个 alarm 最多一次 5 秒连接尝试；无嵌套 timer、忙循环、并发 socket 或业务层重连。基础设施可长期 probe，但 browser-required Job 必须在自己的固定 admission deadline 失败关闭。
- 证据：AGENT 关闭期间的时间序列日志。
- 失败：毫秒级永久请求、多个 timer 或业务模块自行重连。

### WS-005：端口冲突失败关闭

- 条件：其他进程占用固定端口时启动明确失败，Browser Authority 保持 ABSENT。
- 证据：EADDRINUSE 故障注入。
- 失败：自动换端口、杀死未知进程或连接其他服务。

### WS-006：睡眠唤醒

- 条件：macOS 睡眠/唤醒后旧 authority、target、document 和 in-flight permit 全部失效，再建立新 epoch。
- 证据：至少十次 sleep/wake 记录。
- 失败：唤醒后继续使用旧 lease 或重复 mutation。

## 3.7 精确目标与浏览器动作门

### TAB-001：用户明确 claim

- 条件：只有顶层 `chrome.action.onClicked` 用户手势产生固定 60 秒 `OperatorTargetApproval`；它绑定 approvalId/process/profile/tab/document/origin/job/policy，Wire 不存在创建、续期、刷新、claim/select/activate 命令。新 authority 只在全部身份未变且 TTL 未过期时基于它 acquire 新 lease；其他情况必须重新人工 claim。
- 证据：真实 Chrome claim/readback、60 秒边界、同身份重连正例，以及远程续期、Chrome 重启、导航、tab close、profile/approval 漂移负例。
- 失败：自动使用 current/active/first tab，以 URL/标题恢复，或把旧 target lease 跨 epoch 复活。

### TAB-002：相邻假目标排除

- 条件：同时打开多个相同域名和相似页面时，只命中一个精确目标；其他全部被排除。
- 证据：多标签负例。
- 失败：候选为零或多个时仍继续。

### TAB-003：导航失效

- 条件：页面 committed navigation 后旧 document lease不能执行命令。
- 证据：导航中断测试。
- 失败：旧命令作用于新页面。

### TAB-004：Detach 失效

- 条件：tab close、debugger detach 和 DevTools 抢占都先撤销当前 target能力。
- 证据：真实 Chrome 冲突测试。
- 失败：自动转移到其他 tab 或隐藏重试 attach。

### TAB-005：前台隔离

- 条件：后台执行不切换、关闭或污染用户未授权的前台标签。
- 证据：真实 Chrome 前台状态前后对比。
- 失败：非目标标签发生可见变化。

## 3.8 命令治理门

### CMD-001：固定 Registry

- 条件：Wire 只能调用构建期登记的 `capabilityId + sitePolicyId/version/entryHash + actionId + controlId`；握手 `sitePolicyRegistryHash` 必须与全部 active canonical entries 精确一致。
- 证据：registry schema 与未知 command 负例。
- 失败：动态注册、下载命令或任意 method dispatcher。

### CMD-002：无任意脚本

- 条件：生产链无 caller-supplied JS、eval、new Function、任意 Runtime.evaluate。
- 证据：AST/symbol inspector 和 mutant。
- 失败：任意字符串最终进入执行上下文。

### CMD-003：三次 admission

- 条件：Admission、Before Send、Completion 三处均核对 authority、execution、target/document、deadline 和 reply channel。
- 证据：状态机 acceptance。
- 失败：只在入队时检查一次。

### CMD-004：有界预算

- 条件：frame、queue、bytes、in-flight observation、mutation 和 artifact 都有固定上限；artifact 固定为 64 MiB 总量、64 KiB chunk、1 个 stream、8 个 buffered chunk 和 120 秒 deadline。
- 证据：n-1/n/n+1 边界测试。
- 失败：无界 Map、Array、cache、stream 或等待队列。

### CMD-005：原回执通道

- 条件：异步 completion 只能回原 connection epoch 和 reply token。
- 证据：旧完成消息到新连接负例。
- 失败：读取“当前 socket”发送历史 completion。

### CMD-006：单通道 Artifact

- 条件：caller-approved upload 与 law-approved screenshot/evidence 仅通过同一认证 WebSocket 的固定 Artifact 判别帧传输；raw path 留在 AGENT file-grant owner；hash、顺序、deadline、document 和 authority 全部匹配后才 commit。
- 证据：n-1/n/n+1、断流、乱序、错 hash、Worker 重启、document 漂移和真实 file input 上传验收。
- 失败：第二 socket/endpoint、raw path 上 Wire、native picker、未真实证明的 bytes-to-File/FileList 或 artifact 断流后继续动作。

## 3.9 多网站治理门

### SITE-001：至少两个真实网站

- 条件：GPT Web 和第二个不同网站分别通过各自固定 Job Flow。
- 证据：两份独立真实 Chrome journey evidence。
- 失败：只证明通用点击能力或只证明 GPT。

### SITE-002：逐 Job Site Policy

- 条件：每个网站有明确 origin、capability、状态、预算和验收映射。
- 证据：法案/施工图/registry/acceptance 映射。
- 失败：一个通用配置文件允许任意网站。

### SITE-003：跨站拒绝

- 条件：Job A 的命令不能在 Site B 执行。
- 证据：cross-job/cross-origin negative acceptance。
- 失败：改 URL 或 origin 就能复用命令。

### SITE-004：外部请求形状

- 条件：网站和内部 Wire 都不能传 selector、XPath、任意 locator、任意 URL、raw CDP method、JavaScript、browserCommand 或 nextAction；网站只传业务字段，Wire 只传 registry ID。
- 证据：API Boundary attack acceptance。
- 失败：任何外部字段可以控制内部浏览器行为。

### SITE-005：Local Network Access 真实入口

- 条件：使用当前 Chrome Stable 和真实 HTTPS 请求网站，用户明确授予 Local Network Access 后，只有 exact origin 能调用 `127.0.0.1:4173` 的固定 AGENT route。LNA/CORS 只作为浏览器边界；独立认证根是逐站 256-bit API key 和绑定 keyId/requestId/issuedAt/deadline/method/path/bodyHash 的 HMAC。
- 证据：真实权限 UI、CORS/preflight、实际网络请求、服务端 ingress receipt；覆盖拒绝权限、raw 本机客户端伪造 Origin、错误 preflight、无/撤销/轮换 key、重复 requestId、过期 deadline 和 body hash 篡改。
- 失败：网站无法触发/取得 LNA 后仍宣称可用，或依赖 enterprise policy、实验 flag、浏览器降级和备用 relay 绕过。

## 3.10 Mutation、断线与幂等门

### MUT-001：PREPARED 持久化

- 条件：每个 mutation 发送前已经写入并 fsync 精确 commandId 和 payloadHash。
- 证据：进程强杀故障注入和 journal readback。
- 失败：动作可能发生但本地没有意图记录。

### MUT-002：动作后断线未知态

- 条件：页面动作可能发生后至 AGENT fsync terminal 前的任何断线，包括扩展已生成内存 receipt 但 AGENT 未 durable commit，结果必须为 `OUTCOME_UNKNOWN`。
- 证据：精确断点故障注入。
- 失败：自动写 success、failed 或重新发送。

### MUT-003：回执后去重

- 条件：AGENT 已 fsync terminal、Plugin ACK 前断线，恢复只读取 AGENT 唯一 journal 中既有 terminal。
- 证据：重复 commandId 测试。
- 失败：页面动作被执行两次。

### MUT-004：不同 hash 冲突

- 条件：相同 commandId + 不同 payloadHash 立即撤销 authority并报告安全错误。
- 证据：协议攻击负例。
- 失败：覆盖旧记录或执行新 payload。

### MUT-005：业务裁决唯一

- 条件：`OUTCOME_UNKNOWN` 只能由 owning Plugin通过真实页面正向/反向确认解决。
- 证据：业务恢复 acceptance。
- 失败：transport、UI 或日志自行裁决业务成功。

## 3.11 重启恢复门

必须逐项实测：

### RST-001

- 场景：AGENT 存活，完整退出并重启 Chrome。
- 通过：生成新 connection/authority epoch；旧命令和 target全部失效；不重复 mutation。

### RST-002

- 场景：Chrome 存活，kill/restart AGENT。
- 通过：扩展有界重连；AGENT 恢复业务账本；未决 mutation正确分类。

### RST-003

- 场景：两者均停止，先启动 AGENT 再启动 Chrome。
- 通过：单连接完成认证，无第二 Actor。

### RST-004

- 场景：两者均停止，先启动 Chrome 再启动 AGENT。
- 通过：扩展在 `AUTHORITY_ABSENT` 下由唯一 30 秒 alarm 每次做一次有界 probe；AGENT 上线后只有一个连接完成认证，期间无业务 Job 无界等待。

### RST-005

- 场景：强制终止 Service Worker。
- 通过：由 startup/alarm 恢复连接；不恢复旧 authority 和旧任务。

### RST-006

- 场景：扩展 Reload、disable/enable。
- 通过：旧 epoch 立即作废；重新认证后才可领取新命令。

### RST-007

- 场景：扩展卸载重装。
- 通过：必须重新人工配对；旧密钥不能自动恢复信任。

### RST-008

- 场景：manifest key 改变。
- 通过：新 ID 被拒绝并进入 REPAIR_REQUIRED，不自动接受。

## 3.12 安全与隐私负面门

必须全部拒绝且无页面副作用：

- 伪造 Origin。
- 伪造 Host/path/subprotocol。
- 错 Agent identity key。
- 错 extension identity key。
- 错 extension ID/version/releaseBuildId/外部目录 hash。
- 旧 session 帧重放。
- sequence 重复、倒退、跳号。
- 超大 frame 和队列淹没。
- 第二并发客户端。
- 错 job、capability、origin、target、document 或过期 permit。
- 本地普通网页尝试直连扩展。
- 本地普通网页尝试调用 Browser WebSocket。
- API key、配对码和 session key 日志泄露检查。
- cookie、password、token、localStorage、sessionStorage 读取检查。
- raw file path 和 symlink/root escape 攻击。
- pre-auth pending-handshake 淹没、首帧超时和 32 KiB 预算越界；非法连接只能关闭自身，不得撤销合法 authority。
- Artifact 乱序、重复 chunk、错 hash、超过 64 MiB、超过 120 秒、document/authority 漂移和 Worker 中断。
- Wire 注入 selector、XPath、locator、任意 URL、raw CDP method 和 JavaScript。
- pairing/connection proof 角色反射、身份/临时公钥相等、SEC1/P1363 编码变体和 AES-GCM AAD 头字段篡改。
- 扩展目录自哈希、伪造 releaseBuildId、外部 release record/hash 不匹配。
- raw 本机客户端伪造 Origin、API key 轮换/撤销、requestId 重放、deadline 和 method/path/bodyHash 篡改。

## 3.13 真实网站完成门

每个真实网站旅程必须记录：

```text
实际 Chrome 版本
实际 profile identity ref
实际 extension ID/version/releaseBuildId/ExtensionDirectoryHashV1
实际目标 URL/origin
动作前页面状态
目标控件身份和可交互状态
light DOM / author shadow DOM / UA shadow 边界
动作后页面变化
正向终态事实
反向排除事实
唯一目标证明
最大观察次数/截止时间
task/execution/authority/target/document refs
动作回执和 Evidence refs
最终业务状态
```

缺少真实 Chrome 证据只能写：

```text
CHROME_VERIFIED: false
NOT_PRODUCTION_VERIFIED
```

## 3.14 长期稳定性门

Browser transport/auth/profile 核心候选投产必须完成连续 72 小时 soak；24 小时只允许作为中间预检，不得签发 `PRODUCTION_APPROVED_FOR_THIS_MAC`。

进入最终 soak 前必须先完成一次真实 Chrome 更新/身份漂移故障验收并冻结更新后的 exact Chrome candidate。最终 72 小时窗口内不得跨 Chrome 候选；若自动更新发生，本轮立即 FAIL，在新 exact version 完成 REL-005 后从第 0 小时重开。

Soak 必须覆盖：

- 空闲连接。
- 持续观察命令。
- 有界 mutation 命令。
- 至少 50 次 Service Worker 终止/恢复。
- 多次 Chrome 完整重启。
- 多次 AGENT 完整重启。
- macOS 睡眠/唤醒。
- 网络切换。
- GPT Web 和第二网站依次运行。

Soak 零容忍指标：

```text
重复页面 mutation = 0
authority ABSENT 时页面动作 = 0
旧 epoch reply 进入新连接 = 0
双 active socket = 0
重复 listener = 0
无界 queue/cache/stream = 0
stale target/document side effect = 0
非幂等自动重放 = 0
秘密泄露 = 0
未分类异常退出 = 0
```

资源指标固定每 60 秒采样；第 1 小时为 warm-up。硬门为：

- AGENT 进程最后 12 小时 RSS p95 不得高于最初 12 小时 RSS p95 超过 64 MiB。
- 文件描述符最大值不得超过 warm-up 结束基线 `+8`，且每轮故障恢复后回到该预算内。
- active socket 始终为 `0 或 1`；认证后为 1；重复 listener 和重复 reconnect owner 为 0。
- receipt/journal 记录数必须等于唯一 admitted command 与固定状态转换的可解释计数，不得出现孤儿、重复或无界内存副本。
- AGENT 离线期间连接尝试不得超过“每 30 秒一次 alarm + 每次离线区间 1 次启动边界尝试”；禁止额外 timer 重试。
- 所有失败都有固定 reason；任一采样越界即 FAIL，不使用“无明显趋势”“基本稳定”或人工目测裁决。

## 3.15 升级与回滚门

### REL-001：完整升级

- 条件：drain、revoke、替换目录、人工 Reload、重新认证、readback、冒烟完整执行。
- 证据：升级 receipt。
- 失败：运行中热替换或保留旧 authority。

### REL-002：版本错配

- 条件：Agent/Extension/Protocol 任一错配都保持 REPAIR_REQUIRED。
- 证据：错版本负例。
- 失败：自动兼容或降级。

### REL-003：整体回滚

- 条件：恢复上一份完整候选，人工 Reload 后产生全新身份窗口。
- 证据：回滚 receipt。
- 失败：仅回滚一端或复活旧连接。

### REL-004：失败升级不污染旧账

- 条件：升级失败不修改已持久化业务结果，不把未决动作写成成功。
- 证据：升级中断故障注入。
- 失败：通过清库、重建任务或兼容读取掩盖失败。

### REL-005：Chrome 更新再准入

- 条件：每次启动和握手读回 Chrome executable identity、channel 和 exact version；任何漂移先进入 `CHROME_REVALIDATION_REQUIRED` 和 `Authority = ABSENT`。任何 exact-version 漂移都须在新 Chrome 候选重跑 MV3/WebSocket lifecycle、debugger attach/detach、exact target、一个 observation、一个 mutation fault、GPT Web 和第二网站 smoke，并从零重跑完整 72 小时 soak。
- 证据：Chrome 更新前后候选身份和再准入 receipts。
- 失败：Chrome 已变化仍复用旧证据或维持 PRESENT。

## 3.16 质检与最终投产门

最终候选必须按顺序通过：

```text
1. 法案/施工图独立审计
2. Static owner audit
3. Code Purity / second-chain / zombie audit
4. Typecheck
5. 协议、状态机、负面安全 acceptance
6. 真实 Chrome 单链验证
7. GPT Web 真实 Job 验收
8. 第二真实网站 Job 验收
9. 重启、断线、未知态故障矩阵
10. 72 小时强制 soak
11. 独立子智能体最终候选审查
12. CI-FULL
```

只有以上全部绑定同一候选并 PASS，才允许最终状态：

```text
PRODUCTION_APPROVED_FOR_THIS_MAC
```

它只表示这台电脑本地生产可用，不表示公开分发、商店审核或其他电脑可用。

---

# 第四部分：反复杂死亡螺旋禁区

## 4.1 什么是复杂死亡螺旋

复杂死亡螺旋是指：一个真实问题没有被原位解决，却不断增加新模式、新开关、新桥、新 fallback、新状态和新测试替身，导致系统表面功能越来越多，唯一真相越来越少，最后没有人能证明实际运行的是哪条链。

典型过程：

```text
主链失败
→ 不删除错误责任片区
→ 增加 fallback
→ fallback 又失败
→ 增加兼容 adapter
→ adapter 需要第二状态机
→ 第二状态机需要第二日志和第二恢复器
→ 测试只能覆盖模拟路径
→ 真实 Chrome 继续失败
→ 再增加第三种模式
```

本文禁止这条路线。

## 4.2 单一性预算

终态只能有：

```text
1 个用户启动命令
1 个 App Server
1 个 Browser WebSocket endpoint
1 个 server transport owner
1 个 extension transport actor
1 个 reconnect owner
1 个 BrowserAuthorityIssuer
1 个 BrowserAuthorityBroker
1 个 exact-target owner
1 个 Command Registry
1 个 mutation journal owner
1 个业务状态 owner / Job
1 个 Evidence truth
1 个 Runtime Log Spine
1 个 Audit runner
1 个当前协议版本
1 个当前安装身份
```

任何方案需要把上述数字从 1 变成 2，默认判定为死亡螺旋起点，必须停止施工。

## 4.3 禁止以“兼容”为理由保留旧链

以下说法一律不能成为保留旧代码的理由：

- “先留着，以防 WebSocket 不稳定。”
- “老版本可能还会用。”
- “测试里还有引用，先包一层。”
- “等新链稳定后再删除。”
- “只在环境变量打开时才走旧链。”
- “这个 fallback 平时不会触发。”
- “留一个调试入口更方便。”
- “为了未来自动升级先保留 CWS identity。”

正确动作是：先用真实证据确定唯一目标，再整片删除旧 owner和旧链，然后在唯一链上修复。

## 4.4 禁止无需求抽象

禁止为了“未来可能”增加：

- 通用 transport framework。
- transport provider registry。
- 任意协议 adapter。
- 多浏览器抽象层。
- 通用网页 planner。
- 动态 workflow DSL。
- 任意 command dispatcher。
- 动态 capability marketplace。
- 通用重试平台。
- 第二套事件总线。
- 第二套状态数据库。
- 第二套 telemetry 系统。

未来新增网站时，只新增该网站真实 Job 所需要的明确合同。没有两个以上已经验证的真实复用者，不得抽象新的共享层。

## 4.5 禁止配置化逃逸

配置不能把禁区变成“可选模式”。禁止出现：

```text
TRANSPORT=websocket|polling|native
ALLOW_LEGACY_CHANNEL=true
FALLBACK_TO_CDP=true
ALLOW_ANY_ORIGIN=true
USE_CURRENT_TAB=true
AUTO_REPLAY_MUTATION=true
RELAX_PROTOCOL_VERSION=true
ACCEPT_PREVIOUS_EXTENSION=true
SKIP_AUTH_FOR_LOCALHOST=true
```

生产配置只能调整有边界的运行参数，例如日志级别或经法案允许的业务并发，不能选择架构真相。

## 4.6 禁止状态爆炸

Browser 数据面只允许：

```text
ABSENT
PRESENT
```

连接中、配对中、认证中、退避中和修复中属于 infrastructure control state，不得包装成“半 READY”“基本可用”“兼容 READY”。

业务状态由 Plugin 定义，transport 不得创造第二套业务状态。日志 event 也不得反向驱动业务状态。

## 4.7 禁止恢复权扩散

只有对应 owner 可以恢复自己的状态：

- Transport owner：只重建连接和认证。
- Browser owner：只重建 authority和 target/document lease。
- Plugin owner：只恢复业务任务和决定未知态处理。
- Cloud job owner：只恢复网站 lease/fence。

禁止：

- UI 发起隐藏重试。
- API Boundary重跑任务。
- Mediator恢复业务状态。
- Service Worker自动重放业务命令。
- Transport 根据错误文本重新提交网页动作。
- Audit脚本修改生产代码或账本。

## 4.8 禁止测试推动降级

测试失败时不得：

- 放宽身份校验。
- 增加 fallback。
- 接受更多 origin。
- 延长到无界 timeout。
- 把 fail-closed 改成 warning。
- 用 fixture 替换真实 Chrome 门。
- 删除真实负例只保留 happy path。
- 手改 generated artifacts。
- 把未覆盖真实页面写成“不需要验证”。

正确动作是修复唯一 owner，或者承认当前候选 FAIL。

## 4.9 禁止文档膨胀代替执法

本文写了“禁止”不等于系统已经禁止。每个生产禁区最终必须落到至少一种机器证明：

- AST/symbol inspector。
- 文件系统零存在检查。
- schema 负例。
- 状态机 property/model test。
- mutation/fault injection。
- 真实 Chrome negative journey。
- soak 零容忍指标。

无法机器执法的关键禁区必须明确标为人工真实验收项，不能继续增加解释性文字掩盖缺口。

## 4.10 片区删除与重构规则

当责任片区与终态冲突时，施工方式固定为：

```text
确认唯一新 owner
→ 冻结迁移范围
→ 删除旧 owner、入口、类型、脚本、配置、测试和文档绑定
→ 验证旧链物理不可达
→ 在原责任位置建设唯一终态
→ 重新生成 generated truth
→ 运行攻击性验收
```

禁止：

- 在旧函数外包 wrapper。
- 通过 alias 保持旧调用。
- 新旧实现双写。
- 双读后择优。
- “迁移期”永久存在。
- 老测试调用旧入口、新测试调用新入口。

## 4.11 每次新增设计的五问门

任何新增文件、类型、状态、服务、配置或抽象前，必须回答：

1. 它解决哪个已经真实观察到的问题？
2. 它的唯一 owner 是谁？
3. 为什么现有 owner 不能在原位承担？
4. 它是否会产生第二入口、第二状态或第二恢复权？
5. 哪个机器验收能够在它越权时立即 FAIL？

其中任一项答不清楚，结论只能是：

```text
DO_NOT_ADD
```

## 4.12 删除优先决策表

| 现场问题 | 首选动作 | 禁止动作 |
| --- | --- | --- |
| 旧链与目标冲突 | 片区删除旧链 | 新链旁边保留旧链 |
| 连接不稳定 | 修唯一 Transport Actor | 增加 polling fallback |
| Service Worker 休眠 | 修 heartbeat/alarm/reconnect | 增加常驻页面 relay |
| 标签选择错误 | 修 exact target/document lease | 使用 current/first tab |
| 动作结果不明 | `OUTCOME_UNKNOWN` + 真实确认 | 自动重放 |
| 新网站需要接入 | 新增明确 Job/Site Policy | 开放任意 URL/脚本 |
| 版本不匹配 | REPAIR_REQUIRED | 双协议兼容 |
| 测试覆盖不足 | 增加真实负例和证据 | 降低法案或写说明 |
| CWS 不可用 | 使用固定 unpacked identity | 恢复 CWS 根信任 |
| 本机端口被占用 | 明确阻断并报告 | 自动换端口或杀未知进程 |

## 4.13 复杂度红线

出现以下任一项，必须停止当前施工并触发架构审查：

- 新增第二 server/listener。
- 新增第二 Browser transport。
- 新增第二连接/重连 owner。
- 新增第二 command registry。
- 新增任意脚本执行入口。
- 新增旧协议兼容层。
- 新增第二业务状态真相。
- 新增第二 Evidence 或日志链。
- 新增没有明确 Job 使用者的能力组。
- 新增超过一个真实问题所需的抽象框架。
- 需要解释“通常走主链，特殊情况走另一链”。
- 需要用环境变量决定哪套架构生效。
- 无法说明失败后哪一个 owner 有权恢复。

## 4.14 最终反复杂裁决

终态是否简单，只看以下事实：

```text
网站只提交工单
Plugin 只按固定 Flow 决定步骤
Browser owner 只签发当前 Authority 和精确目标
扩展只通过一条认证 WebSocket 接收固定命令
Command Registry 只执行原子动作
失败立即撤销并分类
不确定动作绝不重放
新网站逐 Job 接入
旧链物理不存在
证据绑定同一候选
```

只要这十项有一项不能被实证证明，就不得用“架构基本完成”“插件已经 READY”或“后续再清理”结束项目。

---

## 官方技术依据

- Chrome MV3 WebSocket：<https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets>
- Extension Service Worker 生命周期：<https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle>
- Chrome Alarms API：<https://developer.chrome.com/docs/extensions/reference/api/alarms>
- Chrome Manifest key 与稳定开发 ID：<https://developer.chrome.com/docs/extensions/reference/manifest/key>
- Chrome Extension 权限声明：<https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions>
- Chrome Extension 跨域网络请求：<https://developer.chrome.com/docs/extensions/develop/concepts/network-requests>
- Chrome debugger API：<https://developer.chrome.com/docs/extensions/reference/api/debugger>
- Chrome 本地加载扩展：<https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world>
- Chrome 扩展替代安装限制：<https://developer.chrome.com/docs/extensions/how-to/distribute/install-extensions>
- Chrome remote debugging 变更：<https://developer.chrome.com/blog/remote-debugging-port>
- Chrome Local Network Access：<https://developer.chrome.com/blog/local-network-access>

---

## 最终定案

```text
固定 unpacked MV3 扩展
+ 稳定 extension ID
+ 同一 AGENT App Server
+ 唯一认证 loopback WebSocket
+ ABSENT/PRESENT Browser Authority
+ exact target/document lease
+ 固定 Job/Flow/Site Policy/Command Registry
+ 持久 mutation journal 和 OUTCOME_UNKNOWN
+ 真实 Chrome、故障矩阵和长期 soak
```

以下全部必须物理为零：

```text
Native Host
Native Messaging
Apple 付费签名/公证链
CWS 审核和安装依赖
Workbench 页面 Relay
externally_connectable
HTTP polling / SSE 浏览器通道
外部 CDP / remote-debugging 旁路
任意脚本和任意 URL 控制
fallback / bridge / shadow / 第二链
```

在法案、施工图、代码、质检、真实 Chrome 和长期稳定性证据全部与本文对齐以前，唯一诚实状态是：

```text
NOT_PRODUCTION_VERIFIED
```
