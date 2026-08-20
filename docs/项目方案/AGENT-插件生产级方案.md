# AGENT 插件生产级方案

版本：2026-08-18.4（半年后复盘视角最终可落地冻结）  
状态：**final construction plan / 未施工前仍为 BLOCKED**  
适用仓库：

- `ADVISION-X/AGENT@8701ae3025b4fcfc1097f86523f4f2601f648fae`
- `ADVISION-X/xuanxue-web@1d8cf60da2e91b55e23d9a49cd1db4a086cf6dce`

替代关系：本文件原位替代 2026-08-18.3 版《AGENT-插件生产级方案.md》。旧版中关于 exact target、单链、不可变命令、Rust Host、签名产物、真实 Chrome 证明、Authority 类型封口和 ActivationTuple 等正确方向继续保留；本版进一步封死信任边界过度承诺、单机隐性停摆、Native Messaging 方向限额、无界排队、Port 内 rekey、签名旧版本回滚、供应链重建漂移和文件授权 TOCTOU 八类长期坑。

> 日期说明：本轮按“半年后回看”的审计尺度反推设计，但当前可核验云仓 HEAD 仍是上列 2026-08-18 基线；以下结论是对方案本身的反事实复盘，不冒充已经运行半年后的线上统计。

> 绝对保证的信任边界：本文所称“永远禁止”是对**已签名且未吊销的软件字节、完整性读回通过的受管 Browser Worker、未被攻破的 OS/kernel/credential store 与 release signing root**作出的可机器验证不变量。任一根信任无法证明时，系统只能保持 `AUTHORITY_ABSENT` 和 `BLOCKED`；不得声称能在已被完全控制的操作系统或签名根上继续可信运行。

---

# 0. 最终裁决

上一版不是方向错误，而是仍把“连接建立过程”与“业务可使用会话”揉在一起。它能比较好地处理认证失败，却仍允许以下危险语义存在：

```text
BrowserController 已构造
BrowserTargetSession 已可创建
transportReady = false
browserSession = 未认证
业务插件已经持有 Browser 对象
命令调用后再 waitUntilReady
```

这恰恰是本轮必须永久消灭的根因。

本版冻结的最高不变量是：

```text
系统中不存在“未认证的 browserSession”。

认证完成以前：只有 Browser Infrastructure control plane，没有 session。
认证完成以后：一次性铸造 AuthenticatedBrowserAuthority。
任一 hop 断裂：先同步撤销 authority，再做日志、清理、回调和重连。
```

因此，物理连接仍可能处于连接中、认证中、退避中或修复中；但这些状态都不叫 session，也不向业务暴露浏览器命令能力。业务世界只能看到：

```text
AUTHORITY_ABSENT
或
AUTHENTICATED_AUTHORITY_PRESENT
```

不存在第三种情况。

---

# 1. 半年后回看：上一版会后悔的全部设计

## 1.1 当前云仓已经证明的问题

本版不是凭空提高标准，而是直接针对当前调用图：

- `src/lib/local-runtime/workbench-status.ts` 把组件命名为 `browserSession`，在 transport 未认证时输出“Browser session transport is not authenticated”；这说明非法状态已经进入健康 API 和运维语言。
- `src/lib/browser/browser-controller.ts` 用可选 `transportReady?: boolean` 表示可用性，同时同步暴露 `createTargetSession(ownerId)`；调用者可以在认证前取得 TargetSession 对象。
- `src/lib/browser/current-chrome-browser-controller-runtime.ts` 在 Controller 构造后立即开放 `createTargetSession`，只把 `commandRuntime.isReady()` 填入 snapshot。
- `src/lib/browser/exact-target/browser-command-runtime.ts` 在构造函数中 `void transport.start().catch(() => undefined)`，启动失败被吞掉；TargetSession 又在 transport 认证以前创建并缓存。
- `src/lib/local-runtime/workbench-assembly.ts` 先构造 BrowserController，再将其注入 video/AI gateway，形成半成品依赖。
- `src/lib/browser/chrome-extension/service-worker-native-transport.ts` 使用全局 `nativePort/authenticatedNonce/lastAcceptedSequence`；异步 receipt 完成后读取当前全局 Port，存在旧 completion 投递到新 Port 的风险。
- `src/lib/browser/exact-target/browser-native-transport-server.ts` 使用可变 `authenticated` 布尔和 polling `waitUntilReady()`；认证检查与真正 send 之间不是同一个不可变能力。
- `xuanxue-web/scripts/dynamic-proof/collectors/collector-contracts.ts` 当前 BrowserHeartbeat 只有 `browserSessionIdHash/tabIdHash`，没有 authority certificate、activation tuple 或 auth transcript，跨仓无法证明命令确实发生在当前已认证链。

因此，删除一句报错文案、增加重试次数或再补一个 ready check 都不能封口；必须改变对象模型和 composition root。

## 1.2 后悔清单与终态修复

| 编号 | 上一版会后悔的地方 | 为什么会成为长期坑 | 本版终态修复 |
|---|---|---|---|
| R-01 | 把 `NEGOTIATING`、`RECOVERING` 与 `READY` 放进一个名为 Transport Session 的状态机 | 语义上承认“未认证 session”存在，后续 API、UI、日志都会跟着泄漏 | 控制面状态机改名为 `BrowserInfrastructureControlState`；数据面只有 `Absent | AuthenticatedBrowserAuthority` |
| R-02 | `BrowserStateSnapshot.transportReady?: boolean` | 布尔值无法表达身份、世代、撤销和证明，且会制造 TOCTOU | 删除 `transportReady`；命令能力由不可伪造的 `AuthenticatedBrowserAuthorityLease` 表示 |
| R-03 | Controller 构造函数内异步启动 transport，并吞掉 `start()` 失败 | Workbench 可在 socket、Host、扩展尚未认证时完成装配；启动失败变成“等一等再试” | 构造函数纯化；`await BrowserInfrastructureSupervisor.bootstrap()` 明确返回 authority 或 typed failure；禁止 fire-and-forget startup |
| R-04 | Workbench 先构造 BrowserController，再把它注入 AI Gateway、Video、业务插件 | 所有消费者都能持有半成品 Browser 对象 | 只注入无命令能力的 `BrowserAuthorityBroker`；每个 browser job 领取已认证短租约，authority 缺席时不领取任务写租约 |
| R-05 | `waitUntilReady()` 轮询认证布尔值后再发命令 | 检查完成到发包之间可断线，且 100ms polling 不是身份保证 | 事件驱动 `CommandPermit`；permit 与 authority certificate、auth epoch、原始 reply channel 一起冻结，发送前和接收后双重校验 |
| R-06 | Host 在 Native Port 存活时桥接新 Controller | 在同一 Port 上重绑 Controller 会引入双重世代、旧响应归属、challenge 重置和宿主缓存问题 | **删除 Host bridge**；一条 Port、一条 Host 进程、一条 Controller IPC、一个 authority epoch；任一 hop 断裂整链退出并全新认证 |
| R-07 | 运行时通过 capability 交集进入 `READY_COMPATIBLE` | 交集协商容易演变为安全降级和永久 legacy；“兼容 ready”掩盖版本错配 | 删除 `READY_COMPATIBLE`；只允许命中签名 `ActivationTuple` 的精确组合。旧功能通过旧 tuple 完整运行，新能力未激活就明确不可用 |
| R-08 | 假设 Extension、Host、Controller 可作为同一原子 Release Bundle 同步回滚 | CWS 更新由 Chrome 调度，可能延迟到扩展空闲；本地事务无法原子降级已安装扩展 | 拆成 `ArtifactSetIdentity + ActivationTuple + ReleaseProofManifest`；扩展 N+1 同时支持 tuple N/N+1，回滚切换 activation，不依赖本地降级扩展包 |
| R-09 | 一个 `ReleaseIdentity` 同时包含二进制、整仓 commit、法案和审计 hash | 改法案也会迫使重建二进制；无关仓库变化会制造假发布；签名/hash边界混乱 | 软件字节、运行激活、治理证明三层分离；同一 artifact 可被新的 proof manifest 重新证明，但不得重建 |
| R-10 | 只强调“不能无条件 unlink socket”，没有给出 crash 后 stale socket 的安全恢复 | Controller 崩溃后残留 socket 可能把系统永久卡死 | 使用进程生命周期锁文件/OS mutex；先获取排他 owner lock，再验证 stale inode 并清理；锁未获得时绝不碰 socket |
| R-11 | `LocalBrowserSessionState` 混合 profile、登录态和 transport | “Chrome 登录态”“插件认证”“目标页租约”被误认为同一种 session | 拆为 `BrowserProfileState`、`BrowserInfrastructureControlState`、`AuthenticatedBrowserAuthority`、`BrowserTargetLease` 四个 owner |
| R-12 | `targetSessionsByOwner` 缓存长期 Session 对象 | Controller/Host/Port 重启后旧对象容易被误复用 | 删除跨 epoch session cache；target lease 必须绑定 authority epoch + execution fence，新 authority 强制重新 acquire |
| R-13 | Heartbeat 参与 readiness | 活着不等于认证正确，伪心跳或旧心跳可能维持假 ready | Heartbeat 只做 liveness；authority 是否存在只由认证提交和同步撤销决定 |
| R-14 | fixture 在健康检查中可直接视为 ready | 生产构建配置漂移时可能把 fixture 当真实 Chrome | production bundle 物理不包含 fixture authority；测试包与生产包不同签名/profile，跨仓 receipt 拒绝 fixture |
| R-15 | 动态证明只保存 `browserSessionIdHash/tabIdHash` | 不能证明认证链、激活组合、世代和 command fence；还保留了不必要的 Chrome id 关联 | 升级 Browser Proof V2：authority certificate、activation tuple、transcript、target/document opaque refs、sequence 和 execution fence 全部绑定 |
| R-16 | 用户和运维可看到 `browserSession 未认证` 文案 | 把不合法状态正常化，后续所有人都会选择“重试”而非修复模型 | 生产源码、API、日志、UI 禁止该组件名和文案；只能报告 `browserInfrastructure unavailable; no authority issued` |
| R-17 | 默认允许 operator 日常 Chrome profile 成为生产拓扑 | 用户关标签、开 DevTools、切账号、插件权限变化都会成为生产事故 | 生产固定专用 Chrome profile/专用 Browser Worker 运行身份；个人日常 profile 不属于支持矩阵 |
| R-18 | 多平台架构与生产承诺混在一起 | 每个平台 Host 注册、进程身份、凭证存储、签名机制不同，容易用“接口存在”冒充已支持 | 核心保留 platform adapter；只有完成签名安装、真实 Chrome 和故障矩阵的平台才进入生产 Compatibility Matrix |
| R-19 | 99.99% 指标没有严格分母和认证指标 | 可排除大量故障后得出好看的可用率，却看不见认证风暴 | 定义 supported-runtime-window，并单列 authority issuance、认证失败、无证书命令、撤销延迟和 stale side effect 指标 |
| R-20 | 认证只描述为 nonce + release attestation，没有最终证书和单一签发 owner | 三端各自维护 authenticated bool，会出现“各自都以为已认证” | 引入唯一 `BrowserAuthorityIssuer` 和内存态 `BrowserAuthorityCertificateV1`；三端握手完成后由 Controller 原子签发，其他模块不得自报认证 |
| R-21 | 专用 profile 只靠路径/配置声明，没有把当前 Host 进程绑定到批准 Chrome 进程世代 | 同一固定 extension ID 可在另一个 Chrome profile/进程中拥有相同 caller origin，错误实例可能抢连 Host | BrowserProcessSupervisor 记录唯一批准 Chrome process tree；Host attestation 必须绑定 parent Chrome process start token、专用 user-data-dir/profile enrollment receipt，错误进程永不签发 authority |
| R-22 | 只依赖 disconnect 事件撤销 authority，没有认证型 liveness lease | socket/Port 静默半开、事件丢失或进程假活时，旧 authority 可能在内存中停留 | 增加双端 `BrowserAuthorityLivenessLeaseV1`；认证 MAC heartbeat 只能续租、不能签发 authority，租约到期第一同步动作是 revoke |
| R-23 | Browser Proof V2 只容纳一个 authority window | 长任务安全重连后要么无法完成，要么把多个 epoch 拼成一张伪证明 | 改为有序 authority window chain + Browser Action Receipt Merkle root；每次 handover 必须从业务 checkpoint 重新进入，未裁决 `OUTCOME_UNKNOWN` 永久阻断 complete |
| R-24 | CWS 身份闭合但更新账户、Verified CRX 和权限扩张仍可能是软约束 | 发布账户失陷或新增权限触发停用，会直接切断唯一生产链 | Verified CRX Uploads、独立更新签名密钥、最小 publisher 成员、权限集合冻结和 managed policy readback 全部升为生产硬门 |
| R-25 | 把“永远不会发生”写成没有信任边界的口号 | OS/kernel、签名密钥或构建根被攻破时，任何进程内不变量都可被篡改；不声明边界会形成不可验证承诺 | 冻结生产信任边界：只对通过签名、完整性读回、受管 profile/process、未被吊销的 approved runtime 作绝对保证；任一根信任异常直接 authority ABSENT、proof BLOCKED，绝不降级继续运行 |
| R-26 | 把唯一 Browser Worker 当成网站同步必需品 | 单机重启、磁盘损坏或 Chrome 维护会让全部浏览器任务停摆，99.99% 通过排除停机窗口被“算出来” | 网站只持久化 job；生产最少一主一热备 Browser Worker，独立 profile/身份、同一合法单链；数据库 worker lease/fence 保证同一 execution 只有一个 active writer，故障只从封存 checkpoint 接管 |
| R-27 | 只写“消息有上限”，没有冻结 Native Messaging 方向限制、外层 framing 和大对象通道 | Host→Extension 与 Extension→Host 官方上限不同；统一常量会放行 Chrome 必拒绝的包或误杀合法大响应 | canonical protocol 生成方向常量；控制帧双向≤256 KiB，Extension→Host artifact chunk≤4 MiB，Host→Extension永不承载大对象；4-byte native-endian framing、n-1/n/n+1边界和短读短写 fuzz 全部硬测 |
| R-28 | 只有单 Actor，却没有排队预算、公平性和反压合同 | 后续功能增加后，认证链虽正确仍会被无界 queue、过期命令和大 payload 拖死 | `BrowserCommandAdmissionBudgetV1` 冻结队列条数/字节、每 target mutation 串行、观察并发、deadline-in-queue 和公平调度；超限立即 `BROWSER_BACKPRESSURE`，不持有网站 writer lease等待 |
| R-29 | 允许在同一已认证 Port 内两阶段 rekey | 双端切换时序会产生 split-key、旧帧归属和“半更新但仍 present”的复杂状态 | `commandFrameKey` 对一个 `nativePortEpoch` 不可变；禁止在线 rekey。到达最大 authority 年龄时先 drain/checkpoint，再撤销整链、全新握手和签发新 authority window |
| R-30 | current/previous tuple 有签名，却没有单调防回滚和紧急吊销 | 旧但合法签名的脆弱 artifact/tuple 可能被恢复文件或人工回滚重新激活 | 增加 `BrowserReleaseSecurityPolicyV1`：单调 releaseSequence、minimumAcceptedSequence、revoked artifact/tuple 列表和签名 rollback receipt；被吊销版本永不因 previous slot 复活 |
| R-31 | 有 SBOM/provenance，却未阻止“同源码不同构建字节” | 编译器、依赖下载或构建环境漂移会让证明对象与实际发布对象不一致 | 固定 hermetic/pinned toolchain、lockfile、离线依赖镜像、build-once；核心 Host/launcher/extension bundle 由两个独立 builder 复现 hash，一致后才生成 ArtifactSetIdentity |
| R-32 | 文件上传仍可能接受可变 raw path | symlink/hardlink/替换竞态可让已批准路径在命令发送前指向另一文件，且大截图/附件可能无限留存 | 改为一次性 `BrowserFileArtifactGrant`：realpath+dev/inode+size+hash+root+TTL，发送前 readback；artifact stream 0600、限额、hash、原子完成和自动销毁，协议不接受业务传入 raw path |

## 1.3 保留的正确资产

以下设计继续冻结，不因为本轮复盘而推翻：

- exact target / current document identity；
- opaque `BrowserTargetRef`、`BrowserDocumentRef`；
- raw Chrome id 不越过 Browser owner；
- 一条 MV3 Native Messaging + `chrome.debugger` 生产链；
- 无 active-tab、URL-first、first-page、AppleScript、系统鼠标键盘、剪贴板和 native picker fallback；
- non-idempotent mutation 的 `OUTCOME_UNKNOWN`；
- 一个 canonical protocol schema 和 code generation；
- 高权限扩展端二次执行 capability、origin、payload 和 execution fence 校验；
- 自包含、签名、公证的 Rust Native Host；
- 大对象走 content-addressed artifact stream；
- 真实 Chrome、故障注入、model/property/fuzz、soak 和同 artifact 证明；
- 新功能只能增加受治理 capability，不能建立第二 transport。

---

# 2. 最高法案：未认证 browserSession 永远不可表示

## 2.1 领域不变量

冻结以下逻辑：

```text
exists(AuthenticatedBrowserAuthority)
    ⇔
BrowserAuthorityCertificateV1 已由唯一 BrowserAuthorityIssuer 签发
且 Host attestation 绑定唯一批准 Chrome process/profile enrollment
且 BrowserAuthorityLivenessLeaseV1 仍有效
且 authority 未被撤销
且 authority epoch 等于当前 epoch
且 exact ActivationTuple 仍为 active
```

以及：

```text
unauthenticated_browser_session_count = 0
```

这里的“0”不是监控目标，而是类型和调用图约束：生产模型中根本没有 `UnauthenticatedBrowserSession` 类型、对象、状态或 API。

## 2.2 词义冻结

生产代码中：

- `BrowserProfileEnrollment`：专用 user-data-dir/profile、批准 Chrome process identity、force-install policy 和 extension tree digest 的签名长期绑定；
- `BrowserProfile`：Chrome profile、provider 登录状态和本地持久化身份；
- `BrowserInfrastructure`：安装、进程、连接、认证、修复控制面；
- `AuthenticatedBrowserAuthority`：唯一可执行浏览器命令的数据面能力；
- `BrowserTargetLease`：在某个 authority epoch 中对 exact target/document 的短租约。

禁止继续使用：

```text
LocalBrowserSessionState
BrowserStateSnapshot.transportReady
browserSession health component
Browser session transport is not authenticated
wait for browser session authentication
```

## 2.3 类型级封口

```ts
type BrowserAuthoritySlot =
  | { readonly kind: "ABSENT" }
  | {
      readonly kind: "PRESENT";
      readonly authority: AuthenticatedBrowserAuthority;
    };

interface BrowserInfrastructureSupervisor {
  readonly controlState: BrowserInfrastructureControlState;
  bootstrap(): Promise<BrowserAuthoritySlot>;
  subscribeAuthority(
    listener: (slot: BrowserAuthoritySlot) => void,
  ): Unsubscribe;
  repair(input: RepairRequest): Promise<RepairReceipt>;
  stop(): Promise<void>;
}

interface AuthenticatedBrowserAuthority {
  readonly authorityRef: BrowserAuthorityRef;
  readonly certificate: BrowserAuthorityCertificateV1;
  acquireLease(input: BrowserLeaseRequest): Promise<BrowserAuthorityLease>;
}
```

`BrowserInfrastructureSupervisor`、raw socket、Host channel 和 Extension port 都不提供 `command()`、`createTargetSession()` 或 DOM API。

## 2.4 API 级封口

业务层只能拿到：

```ts
interface BrowserAuthorityLeaseProvider {
  acquireForExecution(
    binding: BrowserExecutionBinding,
  ): Promise<AuthenticatedBrowserAuthorityLease>;
}
```

当 authority 不存在时，函数返回 typed failure：

```text
BROWSER_INFRASTRUCTURE_UNAVAILABLE
```

它不会返回一个 `ok=false` 的 session，也不会返回 `transportReady=false` 的 Controller。

## 2.5 运行时封口

任何断线事件的第一个同步动作固定为：

```text
authorityIssuer.revokeCurrent(cause)
→ atomic slot = ABSENT
→ cancel all command permits
→ invalidate all target/document leases
→ classify in-flight mutation
→ emit diagnostics
→ schedule reconnect
```

日志、业务回调、重连调度和 cleanup 都必须发生在 authority 已经不可取得之后。

## 2.6 源码字面封口

Static Audit 必须在 production source 中阻断：

- 标识符或字段 `transportReady`；
- `authenticated: boolean` 作为 authoritative auth state；
- `UnauthenticatedBrowserSession`；
- `createTargetSession` 暴露在 pre-auth 对象上；
- 生产字符串 `browserSession`；
- 生产字符串 `not authenticated` 与 Browser session 组合；
- 构造函数中的 `void start().catch(...)`；
- fixture 被 production composition root 引用。

迁移 inspector 和 mutant fixture 可以包含这些字样，但必须位于明确的退休路径/反例目录。

---

# 3. 最终架构

## 3.1 唯一生产链

```text
xuanxue durable ai_production_jobs
  → database worker lease / execution fence
      → exactly one elected Browser Worker
          → Browser-dependent Job Scheduler
              → BrowserAuthorityBroker
                  → AuthenticatedBrowserAuthorityLease
                      → ExactTargetRuntime
                          → BrowserCommandActor
                              → AuthenticatedControllerHostChannel
                                  → signed Rust Native Host process
                                      → one Chrome Native Messaging Port
                                          → fixed-id MV3 service worker
                                              → chrome.debugger
                                                  → exact target / exact document
```

控制面独立存在：

```text
browserctl
  → InstallVerifier
  → BrowserProcessSupervisor
  → BrowserInfrastructureSupervisor
  → TransportAuthenticator
  → BrowserAuthorityIssuer
  → Repair/Update/Activation owner
```

控制面可以处于安装检查、连接、认证、退避和修复状态；这些状态不能直接执行任何浏览器动作。

生产可用性在 Browser Worker 层采用**一主一热备**，但不是第二浏览器传输链：

- 每个 Worker 各自只有本文规定的一条 Controller→Host→Port→Extension→exact-target 链；
- 两个 Worker 使用独立机器身份、独立 dataDir、独立受管 Chrome profile 和独立 profile enrollment，禁止复制 profile；
- `xuanxue-web` 现有数据库 job/execution/lease/fence 是唯一选主真相，同一 execution 同一时刻只能有一个 Worker 持有 writer fence；
- standby 可以保持本地 Browser authority 健康，但没有 execution fence 时不得触碰该 job/provider conversation；
- active Worker 失联后，旧 writer lease 失效、mutation journal 完成裁决、业务 checkpoint 封存，standby 才能领取新的 execution fence；
- 未裁决 `OUTCOME_UNKNOWN` 不得通过 failover 隐式重放；
- 网站请求只创建/查询持久化 job，不同步依赖某台本地插件存活。

## 3.2 唯一 owner

本文所有 “one Supervisor / one Issuer / one Actor / one Controller” 均以一个 `BrowserWorkerIdentity + dataDir` 为作用域；系统级唯一性由 `xuanxue-web` 数据库 worker lease/execution fence保证同一 execution 只有一个 active writer。不得把两层唯一性混成跨机器共享 Controller，也不得让两个 Worker 对同一 execution 双写。

| 责任 | 唯一 owner |
|---|---|
| 安装与平台注册 | `browserctl` |
| Chrome 专用进程/profile | `BrowserProcessSupervisor` |
| socket/Host/Port 控制状态 | `BrowserInfrastructureSupervisor` |
| 认证 transcript 与 authority 签发 | `BrowserAuthorityIssuer` |
| target/document opaque identity | `BrowserTargetLeaseManager` |
| command 排队、准入、deadline、回包 | `BrowserCommandActor` |
| 扩展命令执行 | MV3 `CommandRegistry` |
| 发布字节身份 | `BrowserArtifactSetIdentity` |
| 可运行精确组合 | `BrowserActivationTuple` |
| 法案/质检/动态证明 verdict | `BrowserReleaseProofManifest` |
| 网站业务 job/execution/lease | `xuanxue-web` 现有 AI production owner |
| Browser Worker 选主与故障接管 | `xuanxue-web` 现有数据库 worker lease/fence owner；Browser 层不得另建选主 |

禁止任何第二 owner、影子状态、兼容桥或恢复旁路。

---

# 4. 控制面状态机与数据面 authority

## 4.1 控制面状态

```ts
type BrowserInfrastructureControlState =
  | { readonly kind: "OFFLINE" }
  | { readonly kind: "VERIFYING_INSTALL"; readonly attempt: number }
  | { readonly kind: "STARTING_CHROME"; readonly processEpoch: bigint }
  | { readonly kind: "BINDING_OWNER"; readonly supervisorEpoch: bigint }
  | { readonly kind: "CONNECTING_HOST"; readonly connectionGeneration: bigint }
  | { readonly kind: "AUTHENTICATING_TRANSPORT"; readonly portEpoch: bigint }
  | { readonly kind: "PROBING_CAPABILITIES"; readonly transcriptHash: string }
  | {
      readonly kind: "AUTHORITY_AVAILABLE";
      readonly authorityRefHash: string;
      readonly activationTupleHash: string;
    }
  | { readonly kind: "DRAINING"; readonly reason: DrainReason }
  | { readonly kind: "BACKOFF"; readonly attempt: number; readonly nextProbeAt: number }
  | { readonly kind: "REPAIR_REQUIRED"; readonly code: BrowserInfrastructureErrorCode }
  | { readonly kind: "STOPPING" };
```

这里的 `AUTHENTICATING_TRANSPORT` 是基础设施握手，不是 browser session。

## 4.2 数据面状态

数据面不使用多状态枚举，只使用 authority slot：

```text
ABSENT
PRESENT(AuthenticatedBrowserAuthority)
```

`PRESENT` 只能由 reducer 的 `AUTH_PROOF_COMMITTED` 事件产生；不能先创建对象再把字段从 false 改成 true。

## 4.3 单串行 Actor

连接事件全部进入一个 mailbox：

```text
socket callback
port callback
heartbeat
challenge response
command completion
timeout
process exit
update request
```

I/O callback 只能提交 event；只有 reducer/actor 可以：

- 变更 control state；
- 签发/撤销 authority；
- 增加 sequence；
- 接受 command；
- 关闭当前 chain；
- 调度 reconnect。

## 4.4 身份围栏

每个 event 最少绑定：

```text
artifactSetHash
activationTupleHash
profileEnrollmentHash
chromeProcessIncarnationHash
supervisorEpoch
controllerIncarnation
connectionGeneration
hostProcessEpoch
nativePortEpoch
authorityEpoch（仅认证后）
sourceChannelToken
```

旧 fence 必须在任何副作用之前丢弃。

---

# 5. 认证协议与 Authority Certificate

## 5.1 认证不是 nonce echo

认证由四段信任共同组成：

1. **Controller ↔ Host 本地进程认证**  
   owner-only IPC + OS peer credential + 进程启动身份 + 二进制签名/hash + install-scoped secret MAC。
2. **Host ↔ 批准 Chrome process/profile 绑定**  
   BrowserProcessSupervisor 先登记唯一 Chrome process incarnation、专用 user-data-dir/profile enrollment；Host attestation 必须证明自身 parent Chrome process start token 属于该批准 process tree。另一个 profile 即使拥有相同 extension ID，也不能获得 authority。
3. **Host ↔ Extension 来源绑定**  
   单一 Native Host manifest、单一固定 `allowed_origins`、Chrome 传入 caller origin 精确匹配、单一 Native Port、active extension tree digest 与 managed policy readback 精确一致。
4. **Controller ↔ Extension 发布绑定**  
   extension ID、manifest version、embedded artifact digest、capability registry hash、activation tuple、双 nonce 和 transcript hash 精确一致。

不自创脆弱密码学；平台密钥保存在 OS credential store，frame MAC 使用成熟标准实现，vendor signature 使用 release signing key。

## 5.2 握手顺序

```text
A. browserctl verify-install
   → 校验 Host 签名/公证/hash
   → 校验 Native Host manifest 路径、权限、allowed_origins
   → 读回 ExtensionSettings.force_installed、extension item identity、权限政策与 active activation tuple
   → 校验专用 user-data-dir/profile enrollment receipt

B. Supervisor 获取唯一 owner lock并绑定 endpoint
   → 生成 controllerIncarnation + controllerNonce

C. MV3 connectNative
   → Chrome启动一个全新 Host进程
   → Host验证 caller origin
   → Host读取自身签名产物身份
   → Host读取parent Chrome process start token并绑定批准process tree/profile enrollment

D. Host连接Controller
   → Controller验证OS peer identity、host process start token、binary hash
   → 双方通过install-scoped key完成IPC key confirmation

E. ExtensionHello
   → extensionId
   → extensionVersion
   → embeddedArtifactDigest
   → nativePortEpoch
   → extensionNonce
   → supportedActivationTupleIds

F. ControllerChallenge
   → controllerNonce
   → exact signed ActivationTuple
   → controllerIncarnation
   → connectionGeneration
   → transcript prefix hash

G. ExtensionConfirmation
   → 精确确认自身ID/version/digest与tuple匹配
   → 绑定双方nonce、port epoch、tuple hash

H. HostAttestation
   → 绑定 caller origin、host process identity、parent Chrome process incarnation、profile enrollment、IPC auth、完整 transcript

I. CapabilityProbe
   → command registry hash
   → permission/origin policy hash
   → debugger availability
   → protocol framing probe

J. AUTH_PROOF_COMMITTED
   → BrowserAuthorityIssuer 原子签发 certificate
   → authority slot 从 ABSENT 切到 PRESENT
   → 首条业务 command sequence = 1
```

任何步骤失败：

```text
authority slot 保持 ABSENT
整条 Host/Port chain关闭
不创建 BrowserTargetLease
不构造 browser-dependent job execution
进入有界退避或REPAIR_REQUIRED
```

## 5.3 Certificate

```ts
interface BrowserAuthorityCertificateV1 {
  readonly schemaVersion: "browser-authority-certificate.v1";
  readonly authorityRef: BrowserAuthorityRef;
  readonly authorityEpoch: bigint;
  readonly artifactSetHash: string;
  readonly activationTupleHash: string;
  readonly profileEnrollmentHash: string;
  readonly chromeProcessIncarnationHash: string;
  readonly controllerIncarnationHash: string;
  readonly connectionGeneration: bigint;
  readonly hostProcessEpoch: bigint;
  readonly nativePortEpoch: bigint;
  readonly extensionId: string;
  readonly extensionVersion: string;
  readonly protocolRevision: number;
  readonly capabilitySetHash: string;
  readonly permissionPolicyHash: string;
  readonly authorityLivenessPolicyHash: string;
  readonly commandAdmissionBudgetHash: string;
  readonly artifactStreamBudgetHash: string;
  readonly releaseSecurityPolicyHash: string;
  readonly authTranscriptHash: string;
  readonly keyEpoch: bigint;
  readonly livenessLeaseEpoch: bigint;
  readonly issuedAtMonotonicNs: bigint;
  readonly issuerMac: string;
}
```

Certificate：

- 只存在内存；
- 不写磁盘，不跨进程重启恢复；
- 不把 nonce、install secret 或原始 Chrome id 写入日志；
- Port、Host、Controller 任一 discontinuity 都立即撤销；
- 最终认证确认同时生成只存在于 Controller/Extension 内存的 `commandFrameKey`；每个 command/response frame 都绑定 authority epoch、sequence、payload hash 和 HMAC，Host 只转发、不持久化；
- `commandFrameKey` 对一个 `nativePortEpoch` 不可变，禁止同 Port 在线 rekey；达到 signed policy 的最大 authority 年龄时停止新 mutation admission、在业务 checkpoint drain、撤销 authority、关闭整链并全新认证，形成新的 authority window。

## 5.4 Authority Liveness Lease

Certificate 证明认证已经完成；`BrowserAuthorityLivenessLeaseV1` 证明这条已认证链此刻仍由双方控制。两者缺一不可：

```ts
interface BrowserAuthorityLivenessLeaseV1 {
  readonly authorityRef: BrowserAuthorityRef;
  readonly authorityEpoch: bigint;
  readonly leaseEpoch: bigint;
  readonly controllerDeadlineMonotonicNs: bigint;
  readonly extensionDeadlineMonotonicNs: bigint;
  readonly lastAuthenticatedHeartbeatSequence: bigint;
}
```

固定规则：

- heartbeat 必须由当前 `commandFrameKey` 认证并绑定 authority epoch、lease epoch 和严格递增 sequence；
- heartbeat 只能续租当前 PRESENT authority，永远不能把 ABSENT 变成 PRESENT；
- Controller 与 Extension 各自维护 monotonic watchdog；任一端到期立即停止接受新 command；
- Controller actor 处理 lease expiry 的第一同步动作是 `authorityIssuer.revokeCurrent()`，然后才记录 timeout、cleanup 和 reconnect；
- 正常续租在旧 lease 有效期内原子替换，不生成未认证中间对象；
- OS sleep/wake、monotonic discontinuity、长 event-loop stall 和静默半开都撤销旧 authority并全新认证；
- heartbeat/lease 数值只来自唯一 machine contract，并由压力、休眠和真实故障矩阵实证，禁止 Controller/Host/Extension 各写一套常量。
- 默认 machine contract 冻结为 `heartbeatIntervalMs=1000`、`softDrainAfterMs=3500`、`hardExpiryMs=5000`、`watchdogTickMaxMs=250`；只有签名 ActivationTuple 可修改，修改必须重跑 core soak；
- `maxAuthorityAgeMs` 默认 8 小时；到期不在线换钥，只在 checkpoint 形成新 authority window。

---

# 6. Workbench 与业务装配

## 6.1 Composition Root 重构

当前同步构造顺序必须退出：

```text
create BrowserController
→ create VideoDownload(browserController)
→ create AIInputGateway(browserController)
→ transport在后台慢慢认证
```

终态：

```text
create base runtime
→ await browser supervisor initial bootstrap attempt
→ create BrowserAuthorityBroker（无命令能力）
→ register browser-dependent mission factories
→ scheduler只在broker能签发authority lease时领取browser job
```

## 6.2 Broker 合同

```ts
interface BrowserAuthorityBroker {
  currentStatus():
    | { readonly kind: "UNAVAILABLE"; readonly reasonCode: string }
    | { readonly kind: "AVAILABLE"; readonly authorityRefHash: string };

  acquireForExecution(
    binding: BrowserExecutionBinding,
  ): Promise<AuthenticatedBrowserAuthorityLease>;
}
```

`UNAVAILABLE` 不包含 session 对象。

## 6.3 Job 领取硬门

Browser-dependent job 的顺序固定为：

```text
read current AGENT job
→ validate execution/lease/fence/model identity
→ acquire authenticated browser authority lease
→ only then claim browser writer lane
→ acquire exact target lease
→ execute commands
```

禁止：

- 先领取长期 job writer lease，再等待插件认证；
- authority 缺席时创建空 TargetSession；
- 认证恢复后继续使用旧 execution/target/document ref；
- 业务插件自己做 reconnect。

## 6.4 非 Browser 业务

基础 Workbench 可以保持运行，但：

- production health 为 degraded/not-ready-for-browser；
- Browser-dependent worker 不领取任务；
- 其他不需要浏览器的能力不被迫持有 Browser 对象；
- 系统不得把“进程还活着”包装成 Browser 可用。

---

# 7. Command Permit、发送与回包

## 7.1 Command Permit

```ts
interface BrowserCommandPermit {
  readonly authorityRef: BrowserAuthorityRef;
  readonly authorityEpoch: bigint;
  readonly certificateHash: string;
  readonly activationTupleHash: string;
  readonly replyChannelToken: ReplyChannelToken;
  readonly capabilityId: BrowserCapabilityId;
  readonly executionBindingHash: string;
  readonly targetLeaseRef: BrowserTargetLeaseRef;
  readonly documentRef: BrowserDocumentRef;
  readonly commandId: string;
  readonly sequence: bigint;
  readonly deadlineMonotonicNs: bigint;
  readonly mutationClass: MutationClass;
  readonly commandFrameMac: string;
}
```

Permit 只能由当前 authority actor 签发一次。

## 7.2 三次校验

每个命令必须在三个点校验：

1. **Admission**：authority 当前、execution/lease/fence 当前、capability 已在 active tuple；
2. **Before send**：authority slot 仍指向同一 ref，reply channel 和 Port token 仍有效；
3. **Completion**：commandId、sequence、authority epoch、原始 reply channel 全部一致。

## 7.3 旧结果绝不发往新 Port

Extension/Controller 的异步 completion 必须捕获原始 `sourcePortToken`：

```text
command accepted on Port A
→ Port A断开
→ Port B建立并认证
→ A的异步结果完成
→ 丢弃/OUTCOME_UNKNOWN
```

禁止读取全局“当前 Port”后回包。

## 7.4 断线结果分类

- 未发送：`BROWSER_INFRASTRUCTURE_UNAVAILABLE`；
- observation 已发送但无回执：结果丢弃，owner 可在新 authority 下从 checkpoint 重新观察；
- idempotent mutation：只有业务 owner 按命令合同决定重发；
- non-idempotent mutation：`OUTCOME_UNKNOWN`，禁止 transport 自动重放；
- response 已通过原 channel 完成：正常封存 receipt。

## 7.5 Mutation Intent Journal

为覆盖 Controller 进程在“准备发送—已发送—收到终态回执”之间崩溃的窗口，所有 mutation 必须写入 Browser owner 的 0600、append-only、bounded intent journal：

```text
PREPARED(commandId, authorityCertificateHash, executionFenceHash, mutationClass, payloadHash)
→ fsync
→ send exact command frame
→ TERMINAL_SUCCESS | TERMINAL_FAILURE | OUTCOME_UNKNOWN
```

规则：

- journal 不保存页面正文、输入文本、文件内容、nonce 或 secret，只保存不可逆 hash 与有界身份；
- observation 不写 durable mutation journal；
- Controller restart 后，任何没有 terminal record 的 mutation 一律保守归类为 `OUTCOME_UNKNOWN`，不得根据“可能未发送”自动重放；
- journal compaction 只能在 terminal receipt 已进入 xuanxue job checkpoint 后进行；
- intent journal 是恢复证据，不是第二业务 verdict owner。

## 7.6 Framing、方向限额与反压

Native Messaging 外层和业务协议必须分开治理：

```text
Chrome Native Messaging outer frame
  = 4-byte unsigned length in native byte order + UTF-8 JSON bytes

Host → Extension control frame hard max = 256 KiB
Extension → Host control frame hard max = 256 KiB
Extension → Host artifact chunk hard max = 4 MiB
Host → Extension artifact payload = forbidden
single artifact total/TTL/concurrency = signed BrowserArtifactStreamBudgetV1
```

上述内部上限低于平台方向上限；Controller、Rust Host 与 Extension 的常量必须由同一 schema/codegen 生成。测试固定覆盖 0、1、n-1、n、n+1、分段 header、短读、短写、超长 UTF-8、长度溢出、截断 JSON、重复 chunk、乱序 chunk 和 hash 不一致。

`BrowserCommandAdmissionBudgetV1` 至少绑定：

```text
maxQueuedCommands
maxQueuedBytes
maxInflightObservations
maxInflightMutationsPerTarget = 1
maxArtifactStreams
maxArtifactBytes
fairnessQuantum
```

固定规则：

- deadline 包含排队时间；入队时已无法在 deadline 前执行则立即拒绝；
- queue/bytes 超限返回 `BROWSER_BACKPRESSURE`，不得无限等待；
- observation 可有界并发，mutation 在同一 target 严格串行；
- job 在取得 Browser authority 之前不领取 writer lease；取得 writer lease 后若 admission 被反压，必须在有界时间释放并由 scheduler 重排；
- payload 大小、artifact 流和日志缓冲全部计入同一受签名预算，禁止模块各设隐藏上限。

---

# 8. Target、Document 与执行围栏

## 8.1 Target Lease

```ts
interface BrowserTargetLease {
  readonly leaseRef: BrowserTargetLeaseRef;
  readonly authorityRef: BrowserAuthorityRef;
  readonly authorityEpoch: bigint;
  readonly ownerId: string;
  readonly agentJobRefHash: string;
  readonly agentExecutionRefHash: string;
  readonly writerLeaseEpoch: bigint;
  readonly writerFenceHash: string;
  readonly targetRef: BrowserTargetRef;
  readonly documentRef: BrowserDocumentRef;
  readonly originPolicyRef: string;
  readonly capabilitySetHash: string;
  readonly lifecycle: "ATTACHED" | "NAVIGATING" | "TAKEN_OVER" | "DETACHED" | "CLOSED";
}
```

## 8.2 失效规则

以下任一事件使 lease 立即失效：

- authority revoke；
- navigation committed/document generation 变化；
- debugger detach；
- target close；
- extension reload/update；
- Host/Controller/Port discontinuity；
- job lease/fence失效；
- operator takeover；
- active activation tuple变化。

新 authority 必须重新 acquire target，绝不恢复旧 opaque ref。

## 8.3 生产禁止跨 epoch cache

删除 `targetSessionsByOwner` 一类跨 epoch 缓存。允许缓存的只有：

- 当前 authority actor 内的有界 target registry；
- 同一 authority epoch 内、同一 owner 的 lease；
- 已完成且不可变的 command receipt。

---

# 9. 重连、恢复与计划维护

## 9.1 删除 Host 持续桥接

终态固定：

```text
Controller IPC断开
→ Host停止接收/发送业务frame
→ Host进程退出
→ Chrome关闭Native Port
→ Extension清空内存态并发起新connectNative
→ Chrome启动新Host
→ 全新握手
→ 全新authority
```

不在旧 Port 上 rebind Controller，不跨 Host 进程继承 nonce/sequence/receipt。

## 9.2 唯一重连 owner

`BrowserInfrastructureSupervisor` 是唯一退避 owner：

```text
250ms
→ 500ms
→ 1s
→ 2s
→ 4s
→ 8s
→ capped 30s + full jitter
→ circuit open
→ periodic doctor probe
```

Extension 的 `onDisconnect` 只上报 Port 关闭并请求一次 reconnect token；`chrome.alarms` 只作为 worker 被回收后的唤醒补偿，不维护认证真相。

## 9.3 计划升级

```text
close new command admission
→ finish bounded observations
→ classify unresolved mutations
→ revoke authority
→ close chain
→ stage local artifacts
→ verify exact activation tuple
→ restart/full auth
→ issue new authority
→ reopen browser job admission
```

## 9.4 非计划故障

系统不会保证外部进程永不退出；它保证：

- 不出现未认证 session；
- 故障期间不接收新 browser mutation；
- 旧 command 不污染新 authority；
- 有界自动重建；
- 无法自动修复时给出唯一 repair code 和 `browserctl doctor/repair` 路径。

---

# 10. 生产 Browser Worker 拓扑

## 10.1 专用 profile

生产固定使用一个明确注册的专用 Chrome profile；同一永久 CWS item 必须通过受管 `ExtensionSettings` 的 `force_installed` 模式安装到该 profile，并由 `browserctl verify` 读回 extension ID、installation mode、update URL 和启用状态。无法强制安装或无法读回政策的环境不得进入 99.99% 生产支持矩阵。

生产 profile：

```text
profileRole = grasseye_browser_worker
profileProvisioning = dedicated_managed_profile
profileRef = immutable opaque ref
profileDirectory = explicit
```

禁止：

- 自动猜 `Default`；
- 读取 `last_used` 后把个人 profile 当生产 profile；
- 在个人日常 Chrome profile 上宣称 99.99%；
- 复制 cookie/password/login 数据；
- 多 Controller 共享同一 profile/dataDir；
- 只凭“扩展已列出”判断安装正确，必须核对 active extension tree digest 与 ArtifactSetIdentity。

## 10.2 BrowserProcessSupervisor

它只负责：

- 确认专用 Chrome 进程/profile 是否存在；
- 在批准的登录会话内启动/重启该进程；
- 记录 process incarnation 和 Chrome version；
- 在更新/崩溃后触发基础设施重建；
- 不执行页面动作，不领取业务 job。

## 10.3 登录态与插件认证分离

- 插件基础设施认证成功 ≠ provider 网站已登录；
- provider 登录检查属于对应业务 owner；
- 登录过期返回 `PROVIDER_LOGIN_REQUIRED`，不撤销 Browser authority，除非发生安全边界变化；
- 任何登录状态都不得写入 authority certificate。

## 10.4 Profile Enrollment 与 Chrome process attestation

`browserctl enroll-profile` 是唯一 enrollment 入口，一次完成：

```text
创建/核对专用user-data-dir与唯一profile
→ 由BrowserProcessSupervisor启动并记录Chrome process start token/process tree
→ 读回ExtensionSettings.force_installed、extension ID、update URL和权限policy
→ 读回active extension tree digest
→ operator确认一次性enrollment challenge
→ 签发BrowserProfileEnrollmentV1
→ 0600封存enrollment receipt hash并进入ArtifactSet/ProofManifest
```

固定规则：

- enrollment 绑定 profileRef、user-data-dir、Chrome channel、批准 process tree、extension ID/tree digest、managed policy hash 和 Controller install identity；
- enrollment 不是 Session/authority，不赋予任何命令能力；
- Host 每次启动都必须把 parent Chrome process start token 写入 attestation，Controller 只接受属于当前 BrowserProcessSupervisor 批准 process tree 的 Host；
- 同一 CWS item 在其他 profile/Chrome process 中启动 Native Host，因 process/profile enrollment 不匹配而保持 authority ABSENT；
- profile 路径、policy、extension tree、Chrome process incarnation 任一漂移都撤销当前 authority并要求重新 verify/enroll；
- 无 force-install、无法读回 policy 或无法证明 Chrome parent process 的环境只允许 development，不得产生生产 proof。

---

# 11. 发布身份三层分离

## 11.1 BrowserArtifactSetIdentity

只描述软件字节和签名：

```ts
interface BrowserArtifactSetIdentityV1 {
  readonly schemaVersion: "browser-artifact-set.v1";
  readonly artifactSetHash: string; // canonical bytes excludes signatures field
  readonly controllerBundleHash: string;
  readonly nativeHostBinaryHash: string;
  readonly nativeHostSignatureIdentity: string;
  readonly nativeHostNotarizationRef: string;
  readonly extensionSourceZipHash: string;
  readonly extensionVerifiedCrxHash: string; // production不可为null
  readonly extensionInstalledTreeDigestRule: string;
  readonly protocolSchemaHash: string;
  readonly commandRegistryHash: string;
  readonly permissionPolicyHash: string;
  readonly originPolicyHash: string;
  readonly buildToolchainIdentity: string;
  readonly sbomHash: string;
  readonly provenanceHash: string;
  readonly vendorSignature: string;
}
```

不包含整仓法案 verdict，也不因纯文档变更而重建二进制。

## 11.2 BrowserActivationTuple

只描述精确可运行组合：

```ts
interface BrowserActivationTupleV1 {
  readonly schemaVersion: "browser-activation-tuple.v1";
  readonly tupleId: string;
  readonly controllerArtifactHash: string;
  readonly hostArtifactHash: string;
  readonly extensionId: string;
  readonly extensionVersion: string;
  readonly extensionArtifactDigest: string;
  readonly protocolRevision: number;
  readonly capabilitySetHash: string;
  readonly permissionPolicyHash: string;
  readonly profilePolicyHash: string;
  readonly authorityLivenessPolicyHash: string;
  readonly commandAdmissionBudgetHash: string;
  readonly artifactStreamBudgetHash: string;
  readonly releaseSecurityPolicyHash: string;
  readonly maxAuthorityAgeMs: number;
  readonly chromeChannel: "stable" | "extended_stable";
  readonly chromeVersionRange: string;
  readonly platformAdapterId: string;
  readonly architecture: string;
  readonly validFromRelease: string;
  readonly validUntilRelease: string;
  readonly vendorSignature: string;
}
```

Runtime 不做自由交集协商，只选择一个三端都内置并验证的 exact tuple。

## 11.3 BrowserReleaseProofManifest

绑定治理和证据：

```ts
interface BrowserReleaseProofManifestV1 {
  readonly schemaVersion: "browser-release-proof.v1";
  readonly agentCandidateCommit: string;
  readonly browserSourceTreeHash: string;
  readonly artifactSetHash: string;
  readonly activationTupleHash: string;
  readonly releaseSecurityPolicyHash: string;
  readonly profileEnrollmentPolicyHash: string;
  readonly workerMembershipPolicyHash: string;
  readonly lawRegistryHash: string;
  readonly blueprintHash: string;
  readonly auditPlanHash: string;
  readonly deterministicAcceptanceHash: string;
  readonly packagedChromeProofHash: string;
  readonly soakEvidenceHash: string;
  readonly xuanxueCrossRepoContractHash: string;
  readonly verdict: "BLOCKED" | "PRODUCTION_APPROVED";
  readonly signedAt: string;
  readonly approverSignature: string;
}
```

同一 artifact 可以在治理文件深化后由新的 proof manifest 重审；不得重新打包成相同版本不同字节。

## 11.4 BrowserReleaseSecurityPolicy

```ts
interface BrowserReleaseSecurityPolicyV1 {
  readonly schemaVersion: "browser-release-security-policy.v1";
  readonly releaseSequence: bigint;
  readonly minimumAcceptedReleaseSequence: bigint;
  readonly revokedArtifactSetHashes: readonly string[];
  readonly revokedActivationTupleIds: readonly string[];
  readonly currentTupleId: string;
  readonly previousTupleId: string | null;
  readonly previousValidUntil: string | null;
  readonly vendorSignature: string;
}
```

- `releaseSequence` 单调递增，并在 OS credential store 的 install identity 中保存最小已接受值；
- `active.json`、`previous.json` 或备份文件不能把系统降到 `minimumAcceptedReleaseSequence` 以下；
- emergency revocation 优先于 previous slot，任何被吊销 artifact/tuple 永不签发 authority；
- rollback 必须生成签名 `BrowserRollbackReceiptV1`，绑定原因、from/to sequence、operator/release identity 和 proof；
- 安全撤销不等待 CWS 完成降级：先本地撤销 authority/tuple，再由发布系统处理商店包。

---

# 12. CWS 更新、激活与回滚

## 12.1 不再假设同步更新

Chrome Web Store package 分发和安装是外部异步过程。终态采用双 tuple 窗口：

```text
Extension N+1 package supports signed tuple N and tuple N+1
Host/Controller N+1 support signed tuple N and tuple N+1
同一时刻只有一个 active tuple
```

## 12.2 更新顺序无关

### Extension 先到

```text
Extension N+1 + Host/Controller N
→ exact tuple N仍成立
→ authority按tuple N签发
→ N+1能力不可见
```

### Local artifacts 先到

```text
Extension N + Host/Controller N+1 staged
→ active tuple仍为N
→ 不切换Host manifest/active slot
```

### 三端齐备

```text
browserctl verify tuple N+1
→ drain
→ atomic activation pointer N→N+1
→ full handshake
→ issue authority under tuple N+1
```

## 12.3 回滚

```text
revoke authority
→ activation pointer N+1→N
→ select previous signed local slot
→ full handshake using tuple N
→ issue fresh authority
```

本地回滚不要求把已安装 Extension N+1 降回 N；N+1 package 必须在有限窗口内继续完整支持 tuple N。CWS 的商店回滚可以作为分发事故工具，但不承担本地原子事务真相。

## 12.4 窗口边界

生产 CWS 治理同时固定：

- Verified CRX Uploads 必须启用；`extensionVerifiedCrxHash` 在 production ArtifactSet 中不得为 `null`；
- 更新签名私钥保存在独立硬件或受控 keystore，不进入源码仓、普通 CI secret 或 Google Account；
- publisher 账户启用强认证和最小成员权限；
- CWS package、Rust Host、launcher 和 Controller bundle 只能来自 hermetic build-once pipeline；核心产物需两个独立 builder 复现相同 hash，禁止 proof 完成后重建；
- Extension permission/host permission 集合默认冻结；任何扩权必须先更新 managed policy、完成 policy readback 和同 artifact 真实 Chrome proof，禁止把权限确认或扩展停用留到生产更新时处理；
- 不把仅对大规模用户开放的 partial rollout 当作安全前提；本项目依赖 deferred publish、独立 canary runtime、双 tuple窗口和 activation rollback；
- 只允许 current + previous 一个已签名 tuple 窗口；
- previous tuple 有明确 `validUntilRelease`；
- 不建立永久兼容层；
- major protocol变化必须先发布能同时理解旧/新tuple的单链 transitional dual-tuple package；该能力只存在一个发布窗口，不新增第二transport；
- transitional dual-tuple能力的存在、截止和删除都由Static Audit执法。

---

# 13. 安装、唯一 owner 与 stale socket 恢复

## 13.1 browserctl 唯一入口

```text
browserctl install
browserctl verify
browserctl doctor
browserctl repair
browserctl activate
browserctl rollback
browserctl uninstall
```

业务 startup 不安装、不修改 manifest、不下载扩展、不编译 Host。

## 13.2 原子本地槽

```text
releases/
  <artifactSetHash-A>/
  <artifactSetHash-B>/
active.json              # signed, atomic rename
previous.json            # signed, bounded rollback slot
install-receipt.json     # signed readback
```

Native Host manifest 指向稳定、签名、最小 launcher；launcher只读取并验证 `active.json` 后 exec 精确 Host binary，不含网络、业务和兼容逻辑。

## 13.3 唯一进程 owner

Unix/macOS：

```text
open owner.lock
→ acquire nonblocking fcntl/flock for process lifetime
→ if lock fails: BROWSER_CONTROLLER_ALREADY_OWNED
→ if lock succeeds: verify any existing socket is stale
→ compare inode/path ownership/permissions
→ remove only verified stale endpoint
→ bind new socket
→ record process start token + inode in memory diagnostics
```

Windows 使用命名 mutex + named pipe ACL 的等价 adapter。

这同时满足：

- 活 owner 的 socket 永不被 unlink；
- crash 后 stale socket 可自动安全恢复；
- 重复 Controller fail closed；
- socket 文件不是认证凭证。

## 13.4 平台路径 resolver

Native Host manifest 安装位置由 `PlatformRegistrationAdapter` 根据：

```text
browser product
channel
major version
user/system scope
OS
```

解析并读回验证。不得硬编码“Chrome 与 Chrome for Testing 永远共用目录”。

---

# 14. Extension 与 Native Host 终态

## 14.1 MV3 Worker

Worker：

- 顶层同步注册所有 event listener；
- 一个 `NativePortActor` 拥有当前 Port；
- 每个 callback 捕获不可变 Port token；
- 不把 auth state 放进可恢复 storage；
- Port 断开后所有全局内存作废；
- 新 Port 必须全新认证；
- 只执行 command registry 中的命令；
- 不执行远程代码、`eval`、`new Function` 或任意 expression；
- 不保存业务状态、cookie、token、网页正文和证据真相。

## 14.2 Command Registry

未来功能扩展只能提交：

```text
capability id
versioned request/response schema
mutation class
origin/scheme policy
payload/field limits
target/document requirement
execution fence requirement
browser-side postcondition
owner-side business postcondition
acceptance + real-page evidence
```

通用 DOM 能力采用受限、声明式 DOM Intent contract，不允许借“通用 evaluate”绕回任意脚本。

## 14.3 Rust Host

Host：

- 自包含二进制；
- 只做 framing、大小限制、caller origin验证、Controller IPC认证、转发和 bounded diagnostics；
- stdout 仅用于 Native Messaging frame，诊断只写 stderr/受治理日志；
- 不保存 target、command receipt、业务队列、evidence、secret 明文；
- Controller IPC断开立即退出，不桥接新 Controller；
- crash/fuzz corpus进入永久回归。

---

# 15. 安全与隐私

## 15.1 权限

Extension 只保留：

- `nativeMessaging`；
- `debugger`；
- command registry 实际需要的最小 tabs/host permissions；
- 若确需 alarm，仅用于 reconnect wake-up。

禁止 cookies、password、webRequest body、任意远程代码、通配 `allowed_origins`、无边界 host permissions。

## 15.2 高权限端二次准入

Extension 不信任 Controller 输入，独立验证：

- authority certificate hash/epoch；
- activation tuple；
- command sequence；
- capability id；
- mutation class；
- target/document identity；
- origin/scheme；
- selector/文本/file path字段长度；
- deadline；
- execution fence；
- artifact stream grant。

文件输入不得接受业务层 raw path，唯一合同为：

```ts
interface BrowserFileArtifactGrantV1 {
  readonly grantRef: string;
  readonly authorityEpoch: bigint;
  readonly executionFenceHash: string;
  readonly approvedRootHash: string;
  readonly canonicalRealpathHash: string;
  readonly deviceIdHash: string;
  readonly inodeHash: string;
  readonly byteLength: number;
  readonly contentHash: string;
  readonly expiresAtMonotonicNs: bigint;
}
```

Controller 在签发和发送前两次 `open/fstat/hash` 读回，拒绝 symlink、目录穿越、root 外路径、inode/size/hash 漂移和过期 grant；Extension 只接收已经解析的受控 file grant 命令。截图和附件 artifact 使用 0600 临时目录、总量/并发/TTL 配额、内容寻址 hash、原子完成标记和确定性销毁。

## 15.3 本地密钥

- install-scoped key 由 `browserctl` 创建并写入 OS credential store；
- Host/Controller使用最小权限读取；
- 不写配置文件、manifest、日志和 evidence；
- repair 可原子旋转；
- key 丢失或无法读取时不降级，authority 保持 absent并进入 `INSTALL_IDENTITY_REPAIR_REQUIRED`。

## 15.4 macOS 产物

生产 Host、launcher 和 installer package 必须：

- Developer ID签名；
- hardened runtime；
- notarization；
- stapled ticket/readback；
- 签名身份、二进制 hash 和公证证据进入 ArtifactSetIdentity。

---

# 16. 健康、错误和可观测性

## 16.1 健康组件改名

```ts
type BrowserInfrastructureHealth =
  | { kind: "AVAILABLE"; authorityRefHash: string; activationTupleHash: string }
  | { kind: "UNAVAILABLE"; reasonCode: BrowserInfrastructureErrorCode; retrying: boolean }
  | { kind: "REPAIR_REQUIRED"; reasonCode: BrowserInfrastructureErrorCode };
```

API/component 名固定为：

```text
browserInfrastructure
browserAuthority
```

禁止 `browserSession`。

## 16.2 错误码

```text
BROWSER_INFRASTRUCTURE_UNAVAILABLE
BROWSER_INSTALL_INVALID
BROWSER_CONTROLLER_ALREADY_OWNED
BROWSER_HOST_IDENTITY_INVALID
BROWSER_CALLER_ORIGIN_INVALID
BROWSER_EXTENSION_ID_MISMATCH
BROWSER_EXTENSION_ARTIFACT_MISMATCH
BROWSER_ACTIVATION_TUPLE_MISMATCH
BROWSER_AUTH_TRANSCRIPT_INVALID
BROWSER_CAPABILITY_PROBE_FAILED
BROWSER_PROFILE_ENROLLMENT_INVALID
BROWSER_CHROME_PROCESS_IDENTITY_INVALID
BROWSER_MANAGED_POLICY_INVALID
BROWSER_AUTHORITY_LIVENESS_EXPIRED
BROWSER_WORKER_FENCE_STALE
BROWSER_DUAL_ACTIVE_DETECTED
BROWSER_BACKPRESSURE
BROWSER_FILE_ARTIFACT_GRANT_INVALID
BROWSER_RELEASE_ROLLBACK_BLOCKED
BROWSER_ARTIFACT_REVOKED
BROWSER_AUTHORITY_REVOKED
BROWSER_COMMAND_PERMIT_STALE
BROWSER_TARGET_LEASE_STALE
BROWSER_DOCUMENT_STALE
BROWSER_DEVTOOLS_CONFLICT
BROWSER_OUTCOME_UNKNOWN
BROWSER_REPAIR_REQUIRED
```

认证失败只能作为 infrastructure failure；不得生成“未认证 session”错误对象。

## 16.3 指标

| 指标 | 硬目标 |
|---|---|
| 未认证 Browser authority 被签发 | 0，结构上不可表示 |
| 无有效 certificate 的 command 被发送 | 0 |
| authority revoke 后新 command admission | 0 |
| stale generation 产生副作用 | 0 |
| 旧 completion 回到新 Port | 0 |
| non-idempotent 自动重放 | 0 |
| auth failure 被错误报告为 session state | 0 |
| wrong profile/process 获得 authority | 0 |
| force-install/policy readback失败仍获得authority | 0 |
| liveness hard expiry 后命令准入 | 0 |
| authority absence窗口内 browser action | 0 |
| 被吊销/低于minimum sequence的tuple被激活 | 0 |
| queue/stream超过签名预算 | 0 |
| supported-runtime-window authority availability | ≥ 99.99% |
| 环境齐备后的 authority issuance p99 | ≤ 5 秒 |
| recoverable chain 重建 p99 | ≤ 10 秒 |
| revoke 进入 ABSENT p99 | ≤ 10 毫秒（同 actor 内先于回调） |
| 无界 queue/cache/stream | 0 |

`supported-runtime-window` 必须绑定：至少一台批准 Browser Worker 在线、批准 Chrome channel、force-install 与 Host 完整性读回通过、OS/credential store 未失陷。除此之外还必须单列网站端到端 `browser_job_queue_availability` 和 `browser_job_recovery_time`，机器维护/故障不得从总服务指标中消失；一主一热备的切换、writer lease/fence 和 checkpoint handover 都进入分母。

## 16.4 日志

允许记录：

```text
control stage
authorityRefHash
artifactSetHash
activationTupleHash
profileEnrollmentHash
chromeProcessIncarnationHash
livenessLeaseEpochHash
controllerIncarnationHash
connectionGeneration
hostProcessEpoch
nativePortEpoch
commandId/sequence
bounded reason code
```

禁止记录 nonce、install secret、cookie、token、raw tab/window/target/loader id、页面正文和文件内容。

---

# 17. xuanxue-web 跨仓合同

## 17.1 不新增第二 receipt

继续使用唯一 `AgentRuntimeReceipt` owner，但 browser proof 升级为有序 authority window chain：

```ts
interface AgentBrowserAuthorityWindowProofV2 {
  readonly window_index: number;
  readonly worker_identity_hash: string;
  readonly worker_lease_epoch_hash: string;
  readonly worker_execution_fence_hash: string;
  readonly authority_ref_hash: string;
  readonly authority_certificate_hash: string;
  readonly profile_enrollment_hash: string;
  readonly chrome_process_incarnation_hash: string;
  readonly artifact_set_hash: string;
  readonly activation_tuple_hash: string;
  readonly release_security_policy_hash: string;
  readonly auth_transcript_hash: string;
  readonly liveness_lease_chain_hash: string;
  readonly controller_incarnation_hash: string;
  readonly connection_generation_hash: string;
  readonly native_port_epoch_hash: string;
  readonly capability_set_hash: string;
  readonly execution_fence_hash: string;
  readonly first_command_sequence: string;
  readonly last_command_sequence: string;
  readonly action_receipt_subtree_hash: string;
  readonly closed_reason: "COMPLETED" | "CHECKPOINT_HANDOVER" | "FAILED" | "OUTCOME_UNKNOWN";
}

interface AgentBrowserAuthorityProofV2 {
  readonly schema_version: "xuanxue-agent-browser-authority-proof-v2";
  readonly browser_required: true;
  readonly windows: readonly AgentBrowserAuthorityWindowProofV2[];
  readonly elected_worker_chain_hash: string;
  readonly handover_receipt_chain_hash: string;
  readonly browser_action_receipt_root_hash: string;
  readonly no_action_during_authority_absence: true;
  readonly unresolved_outcome_unknown_count: 0;
}
```

规则：

- 短任务通常只有一个 window；长任务在安全恢复后可以形成多个有序 window；
- 每个 window 必须位于单一 authority epoch 内，certificate 与 liveness lease 连续有效，sequence 单调，target/document generation 明确；
- authority revoke 后，业务只能从已经封存的业务 checkpoint 取得新的 execution fence、authority lease 和 target/document refs，再进入下一个 window；
- 两个 window 之间不得有任何浏览器动作；
- non-idempotent `OUTCOME_UNKNOWN` 若未由业务 owner 通过真实 postcondition 生成独立 `OutcomeResolutionReceipt`，最终 receipt 永远不得 `complete`；
- `AgentRuntimeReceiptV2` 对 browser-required job 必须内嵌该 proof；非 browser job 明确 `browser_required=false`。

## 17.2 Browser Heartbeat V2

删除：

```text
browserSessionIdHash
tabIdHash
activeTab 作为身份依据
```

改为：

```text
workerIdentityHash
workerExecutionFenceHash
authorityCertificateHash
authorityEpochHash
activationTupleHash
releaseSecurityPolicyHash
targetRefHash
documentRefHash
commandSequence
executionFenceHash
foregroundIsolationMarkerHash
rootDomHash
visibleTextHash
monotonicMs
```

Collector 必须验证：

- 第一条 observation 已有 authority certificate；
- 同一 action window 使用同一 authority/target/document generation；
- sequence 单调；
- 单个 authority window 封存前其 certificate 与 liveness lease 连续有效；
- authority 撤销后当前 heartbeat window 立即结束，在新 window 的认证证明和 checkpoint handover receipt 出现前不得继续；
- 若存在未裁决 `OUTCOME_UNKNOWN`，对应 job 只能 failed/blocked；只有 owner 形成真实 `OutcomeResolutionReceipt` 后才可能在新 window 继续并最终 complete。

## 17.3 网站职责边界

`xuanxue-web` 继续拥有：

- job、execution、lease、fence、conversation、model identity；
- 业务成功和发布 verdict；
- Dynamic Proof 最终消费。

AGENT Browser 只证明浏览器基础设施身份和低层动作，不证明报告、上传、翻译或页面业务成功。

---

# 18. 法案与质检

## 18.1 法案收束

原位升级现有 Local Browser 法案：

- `APEX-LOCAL-BROWSER-001-V2`：exact target/document 与 authority-bound target lease；
- `APEX-LOCAL-BROWSER-002-V2`：单链认证、authority mint/revoke、未认证 session 不可表示；
- `APEX-LOCAL-BROWSER-003-V2`：唯一插件页面动作链、无焦点/OS fallback；
- `APEX-LOCAL-BROWSER-004-V2`：受治理 command registry、无 arbitrary evaluate；
- `APEX-LOCAL-BROWSER-005-V1`：ArtifactSet/ActivationTuple/ProofManifest、安装、更新与回滚；
- `APEX-LOCAL-BROWSER-006-V1`：跨仓 execution fence 与 authority proof。

旧 active 版本在同一候选中退出，禁止双活。

## 18.2 P0 条款

`APEX-LOCAL-BROWSER-002-V2` 必须逐字包含：

```text
Within each Browser Worker, a Browser session or Browser command authority does not exist before authentication proof is atomically committed.
The production type system, composition root, health API and runtime logs shall not represent an unauthenticated browserSession.
Any hop discontinuity revokes the current authority before callbacks, cleanup, diagnostics or reconnect side effects.
An authenticated heartbeat may renew only an already-present authority; it can never create one, and hard liveness expiry revokes before any timeout side effect.
The same extension ID running outside the approved managed profile and Chrome process incarnation shall never receive authority.
For one browser-required execution, at most one Browser Worker may hold the current writer fence; failover begins only from a sealed checkpoint and a new fence.
```

## 18.3 Audit checkIds

```text
browser-auth/no-unauth-session-type
browser-auth/no-transport-ready-boolean
browser-auth/no-preauth-command-surface
browser-auth/no-fire-and-forget-startup
browser-auth/authority-mint-only-after-proof
browser-auth/revoke-before-side-effects
browser-auth/no-host-controller-rebind
browser-auth/original-reply-channel
browser-auth/exact-activation-tuple
browser-auth/authority-liveness-lease
browser-auth/no-command-after-liveness-expiry
browser-auth/heartbeat-cannot-mint-authority
browser-auth/production-fixture-zero
browser-profile/dedicated-production-profile
browser-profile/process-enrollment-attestation
browser-profile/force-install-policy-readback
browser-release/artifact-activation-proof-separation
browser-release/verified-crx-hard-gate
browser-release/anti-rollback-and-revocation
browser-release/reproducible-build-identity
browser-install/safe-stale-socket-recovery
browser-cross-repo/authority-proof-v2
browser-cross-repo/ordered-authority-window-chain
browser-command/bounded-admission-budget
browser-file/artifact-grant-no-raw-path
browser-old-path/retired-zero
```

不得再把多个 P0 法条全部绑定到一个宽泛 `owner-assertion-set`。

## 18.4 Static Audit 能证明什么

- 类型/接口不存在未认证 session；
- composition root 不向业务注入 raw Controller；
- startup 被 await；
- authority 只有一个签发点和一个撤销点；
- disconnect reducer ordering；
- 无 Host bridge；
- exact tuple，不做运行时 capability intersection；
- fixture 不进入 production graph；
- release 三层 schema、security policy 和路径唯一；
- profile enrollment、批准 Chrome process 与 force-install policy readback 均在 authority mint 调用图上；
- heartbeat 只能续租、不能 mint authority，hard expiry 路径先 revoke；
- command queue/artifact stream 有唯一签名预算且 raw path 不进入 production protocol；
- xuanxue browser proof 是有序 authority window chain，窗口间动作静态不可达；
- Verified CRX、anti-rollback/revocation 和 reproducible build proof 是发布硬门；
- 旧文件/符号不可达且物理退出。

Static Audit 不能冒充真实 Chrome、OS更新、CWS分发和长时间稳定性。

---

# 19. 验收、反例与故障矩阵

## 19.1 编译期负面证明

必须有 negative type tests，证明以下代码不能编译：

```ts
supervisor.command(...)
supervisor.createTargetSession(...)
const session: UnauthenticatedBrowserSession = ...
lease.commandAfterAuthorityRevoked(...)
productionFixtureAuthority(...)
```

## 19.2 Reducer property

随机 event 序列至少证明：

```text
authority_present → auth_proof_committed
auth_failed → authority_absent
command_sent → current_certificate_valid
disconnect → authority_absent_before_any_side_effect
old_fence_event → no state mutation
old_completion → never posts to current port
new_authority → old target/document refs invalid
no exact activation tuple → authority_absent
non_idempotent unresolved → OUTCOME_UNKNOWN and no replay
heartbeat while ABSENT → remains ABSENT
liveness hard expiry → revoke before timeout/log/reconnect
wrong profile/process with same extension ID → authority_absent
missing force-install policy readback → authority_absent
queue/artifact budget exceeded → reject without hidden buffering
revoked or rollback-below-min tuple → authority_absent
window handover → no action until new certificate + checkpoint fence
```

## 19.3 必须杀死的 mutants

1. 恢复 `transportReady`；
2. pre-auth `createTargetSession`；
3. constructor 内吞 startup error；
4. disconnect 后先 log 再 revoke；
5. 旧 completion 使用 global current Port；
6. Host断线后重绑新 Controller；
7. capability runtime intersection；
8. fixture production ready；
9. heartbeat 直接置 authority ready；
10. wrong extension ID仍签发 certificate；
11. activation tuple signature被跳过；
12. stale socket无owner lock直接unlink；
13. target lease跨authority恢复；
14. xuanxue receipt缺certificate hash仍PASS；
15. health输出 `browserSession not authenticated`；
16. heartbeat 从 ABSENT 直接创建 authority；
17. liveness hard expiry 后仍接收 command；
18. 同 extension ID 的错误 profile/process 仍通过 attestation；
19. `force_installed`/policy readback缺失仍签发 authority；
20. Browser Proof 多 window 缺 checkpoint handover仍PASS；
21. action发生在两个authority window之间仍PASS；
22. `extensionVerifiedCrxHash=null` 仍获生产 verdict；
23. 被吊销tuple或低于minimum releaseSequence仍可activate；
24. queue/stream越界后隐藏排队而非BROWSER_BACKPRESSURE；
25. raw path/symlink漂移仍被set-file-input接受；
26. proof完成后重建同版本不同hash仍可发布。

## 19.4 真实 Chrome 矩阵

同一 packaged artifact 必须通过：

- 无扩展、扩展禁用、Host缺失、manifest错误；
- wrong caller origin、wrong ID/version/hash、wrong tuple、重复 challenge；
- 旧 Port迟到 message/disconnect/completion；
- Controller crash、Host crash、service worker restart；
- Chrome restart、OS sleep/wake、网络短断；
- 专用 profile登录态存在/过期；
- 同一CWS item在错误profile/错误Chrome process启动Host；
- force-install policy删除、update URL漂移、extension tree digest漂移；
- Host freeze/Port静默半开、heartbeat丢失、event-loop stall、sleep/wake hard expiry；
- 一主一热备Worker故障接管、writer fence失效、checkpoint handover、窗口间零动作；
- DevTools conflict；
- Chrome Stable版本变化；
- Chrome for Testing channel-specific Host路径；
- Extension N/Host N、Extension N+1/Host N、Extension N/Host N+1 staged、三端 N+1 activation、rollback tuple N；
- exact target后台操作，前台 marker完全不变；
- navigation/document stale；
- target close/takeover/resume；
- CJK/繁体/日韩/RTL/emoji/contenteditable；
- shadow DOM/iframe/file input/large screenshot stream；
- raw path拒绝、symlink/inode替换、artifact总量/TTL/乱序chunk；
- queue/bytes反压、deadline在队列中过期、公平调度；
- revoked tuple、低于minimum releaseSequence、签名rollback receipt；
- stale execution fence；
- 24h/168h soak；
- 资源、debugger attachment、文件句柄、receipt、artifact泄漏为零。

## 19.5 Soak 规则

- transport reducer/auth/Host/Port actor/owner lock、profile/process attestation、liveness lease、HA handover变化：168小时；
- command capability、DOM intent、非核心 packaging 变化：至少24小时；
- 仅法案/说明变化且 artifact 字节不变：不重建 artifact，但必须生成新 ProofManifest并重跑对应静态/契约证明；
- 任一 soak 期间发生 auth storm、stale side effect、旧 reply/new Port、自动 mutation replay，计时归零。

---

# 20. 代码终态落位

## 20.1 AGENT

```text
src/lib/browser/profile/
  browser-profile-config.ts
  browser-profile-state.ts
  dedicated-profile-policy.ts
  browser-profile-enrollment.ts
  browser-profile-enrollment-receipt.ts
  browser-profile-process-attestation.ts
  managed-policy-readback.ts

src/lib/browser/infrastructure/
  browser-infrastructure-supervisor.ts
  browser-control-state.ts
  browser-process-supervisor.ts
  browser-owner-lock.ts
  browser-authority-broker.ts
  browser-authority-issuer.ts
  browser-authority-certificate.ts
  browser-authority-liveness-lease.ts
  browser-worker-membership.ts
  browser-worker-handover.ts
  browser-retry-policy.ts
  browser-repair.ts

src/lib/browser/transport/
  raw-controller-host-channel.ts
  authenticated-controller-host-channel.ts
  transport-event.ts
  transport-reducer.ts
  transport-actor.ts
  transport-authenticator.ts
  transport-transcript.ts
  command-permit.ts
  reply-channel-token.ts
  authenticated-heartbeat.ts
  browser-command-admission-budget.ts
  browser-native-framing.ts

src/lib/browser/exact-target/
  browser-target-ref.ts
  browser-document-ref.ts
  browser-target-lease.ts
  browser-target-lease-manager.ts
  browser-command-actor.ts
  browser-mutation-intent-journal.ts
  browser-dom-intent.ts
  browser-file-artifact-grant.ts
  browser-artifact-stream.ts

src/lib/browser/protocol/
  browser-protocol.schema.json
  browser-authority-certificate.schema.json
  browser-authority-liveness-lease.schema.json
  browser-profile-enrollment.schema.json
  browser-file-artifact-grant.schema.json
  browser-capabilities.json
  browser-errors.json
  generated/**

src/lib/browser/release/
  browser-artifact-set.schema.json
  browser-activation-tuple.schema.json
  browser-release-proof.schema.json
  browser-release-security-policy.schema.json
  browser-rollback-receipt.schema.json
  active-activation.json
  build-artifacts.mjs
  verify-artifacts.mjs

src/lib/browser/chrome-extension/src/
  service-worker.ts
  native-port-actor.ts
  auth-transcript.ts
  command-registry.ts
  command-permit-validator.ts
  debugger-runtime.ts
  exact-target-runtime.ts
  dom-intent-runtime.ts
  artifact-stream.ts
  authenticated-heartbeat.ts

src/lib/browser/native-messaging-host/
  Cargo.toml
  crates/host/**
  crates/launcher/**
  crates/browserctl/**
  crates/platform-macos/**
  manifests/**

src/lib/local-runtime/
  workbench-assembly.ts
  workbench-browser-authority-support.ts
  workbench-status.ts

.github/workflows/
  browser-required-ci.yml
  browser-packaged-artifact.yml
  browser-release-proof.yml
  browser-branch-protection-readback.yml
```

## 20.2 必须替换/退休

```text
src/types/local-browser-session.ts
src/lib/browser/local-browser-session.ts
BrowserStateSnapshot.transportReady
BrowserController.createTargetSession
BrowserTargetSession长期对象
browser-native-transport-server.ts当前authenticated bool/polling模型
service-worker-native-transport.ts当前global Port/authenticatedNonce模型
Native Host .mjs生产实现
Host Controller rebind/bridge
READY_COMPATIBLE
runtime capability intersection
production fixture ready分支
任意 evaluate contract
```

文件名可作为薄迁移入口短暂存在，但最终 candidate 中旧符号和旧调用图必须为零。

## 20.3 xuanxue-web

```text
scripts/dynamic-proof/collectors/collector-contracts.ts
packages/quality-contracts/**
scripts/audit/domains/dynamic-proof/**
tests/dynamic-proof/**
AgentRuntimeReceipt schema/validator
BrowserHeartbeat schema/validator
AgentBrowserAuthorityWindowProofV2 schema/validator
BrowserWorker lease/fence/handover receipt binding
AGENT provider job/execution/lease fence binding

.github/workflows/
  agent-contract-required-ci.yml
  cross-repo-browser-proof.yml
  branch-protection-readback.yml
```

不创建第二 AGENT channel、第二 receipt owner 或第二 Dynamic Proof verdict。

---

# 21. 一次性原子施工事务

本方案是一个完整人物，不允许把连接、认证、安装、质检或跨仓证明拆成可独立宣称 production-ready 的阶段。施工可以按依赖顺序执行，但最终候选必须一次闭合：

1. 冻结两仓 candidate、工作树、browser subtree hash 与现行法案/施工图 hash；
2. 原位更新总法案、细分法案、Kernel/index、施工图和 owner manifest；
3. 建立 Profile/Infrastructure/Authority/TargetLease 四层语义，并写入明确 production trust boundary；
4. 删除 `transportReady`、未认证 session 文案和 pre-auth command surface；
5. 重构 async composition root 与 Authority Broker，使网站 job 先持久化、Browser worker 只按数据库 execution lease/fence领取；
6. 建立一主一热备 Worker membership、独立 profile enrollment 和 checkpoint handover，不允许双 active；
7. 建立唯一 reducer、authority issuer、同步 revoke ordering；
8. 建立完整认证 transcript、certificate、不可在线rekey的per-Port `commandFrameKey`、CommandPermit和reply channel token；
9. 建立 profile/process attestation、force-install/policy/tree-digest readback；
10. 建立认证型 liveness lease、硬到期先 revoke 和8小时全链更新窗口；
11. 删除 Host bridge，改为一 hop 断裂整链重建；
12. 建立安全 owner lock 和 stale socket恢复；
13. 重写 MV3 Port Actor、command registry、方向 framing与有界 admission budget；
14. 建立 file artifact grant、content-addressed stream、raw path zero；
15. 以签名 Rust Host/launcher/browserctl替换生产 .mjs；
16. 建立 ArtifactSet/ActivationTuple/ProofManifest 与 ReleaseSecurityPolicy/anti-rollback/revocation；
17. 建立 CWS异步更新的双 tuple有限窗口、Verified CRX硬门和activation rollback；
18. 建立 hermetic build-once、双builder reproducible hash、SBOM和provenance；
19. 迁移所有 Browser consumers到authority lease，并将所有mutation纳入intent journal；
20. 升级 xuanxue Browser Proof V2为有序authority window chain和唯一AgentRuntimeReceipt；
21. 删除旧路径、fixture production branch、runtime intersection、arbitrary evaluate和raw path protocol；
22. 建立AST/symbol inspector、negative type tests、model/property/fuzz和26类mutants；
23. 构建同一packaged artifact并完成签名、公证、Installed tree/policy readback；
24. 执行真实Chrome故障/更新/profile/liveness/HA/反压/文件矩阵和24h/168h soak；
25. 独立只读复核；
26. 配置两仓GitHub branch protection、required CI、release tag/signature与配置readback；
27. 生成同一candidate的BrowserReleaseProofManifest、BrowserReleaseSecurityPolicy和跨仓receipt root；
28. 全部PASS后才解除 `BLOCKED/development-only`。

中间 candidate 不得进入生产，不得保留旧链作为 fallback，不得通过“先上线观察”补证。

---

# 22. 最终生产封口门槛

## 22.1 绝对认证门

- [ ] production type graph 中不存在未认证 Browser session类型。
- [ ] production source 中不存在 `transportReady`。
- [ ] production health/component/log 中不存在 `browserSession`。
- [ ] pre-auth对象不存在浏览器命令方法。
- [ ] authority 只有一个签发点。
- [ ] authority revoke发生在所有disconnect副作用之前。
- [ ] auth failure 永远保持 authority absent。
- [ ] command无certificate不可发送。
- [ ] current authority变化后旧permit/target/document全部失败。
- [ ] profile enrollment、批准Chrome process、force-install/policy/tree digest任一不匹配时authority永远ABSENT。
- [ ] heartbeat只能续租PRESENT authority，不能从ABSENT签发；hard expiry先revoke。
- [ ] `commandFrameKey` 一个Port epoch内不可变，不存在在线rekey半状态。
- [ ] 被吊销/低于minimum releaseSequence的tuple不能签发authority。

任何一项不满足，最终 verdict 必须 BLOCKED。

## 22.2 架构门

- [ ] 每个Browser Worker/dataDir恰有一个BrowserInfrastructureSupervisor。
- [ ] 每个Browser Worker恰有一个BrowserAuthorityIssuer。
- [ ] 每个Browser Worker恰有一个Transport Actor/Reducer。
- [ ] 每个Browser Worker/dataDir恰有一个Controller IPC owner。
- [ ] 每个Native Port恰有一个Host process并绑定该Worker的Controller。
- [ ] 每个Extension Worker恰有一个connectNative owner。
- [ ] 每个Browser Worker同一时刻恰有一个exact active ActivationTuple。
- [ ] no Host bridge/rebind。
- [ ] no second Browser transport/fallback。
- [ ] raw Chrome ids零越界。
- [ ] 每个Worker一条合法链；系统级一主一热备由数据库lease/fence选主，绝无双active。
- [ ] queue/bytes/artifact stream只有一份签名admission budget。
- [ ] raw file path零进入production protocol。

## 22.3 发布门

- [ ] permanent CWS item/extension ID闭合。
- [ ] Verified CRX Uploads必须启用，production `extensionVerifiedCrxHash`非null并读回闭合；不具备该能力则继续BLOCKED。
- [ ] Host/launcher/installer签名、公证、readback通过。
- [ ] ArtifactSetIdentity字节与安装读回一致。
- [ ] exact ActivationTuple签名和三端内置一致。
- [ ] rollback不依赖Extension降级。
- [ ] Chrome/Chrome for Testing注册路径按当前channel规则实证。
- [ ] previous tuple窗口有限且有删除门。
- [ ] ReleaseSecurityPolicy的minimum sequence、revocation list和签名rollback receipt通过。
- [ ] hermetic build-once与双builder核心产物hash一致。
- [ ] publisher最小权限/强认证、permission freeze和managed policy readback通过。

## 22.4 质检门

- [ ] 所有 auth mutants被杀死。
- [ ] property/model不变量全部PASS。
- [ ] Rust framing/socket/auth fuzz PASS。
- [ ] packaged stable/CfT acceptance PASS。
- [ ] 真实 operator dedicated profile/process enrollment与错误profile拒绝证明PASS。
- [ ] force-install/policy/tree digest drift mutants与真实Chrome证明PASS。
- [ ] liveness silent-half-open/sleep-wake/actor-stall证明PASS。
- [ ] 一主一热备handover、窗口间零动作和OUTCOME_UNKNOWN阻断证明PASS。
- [ ] Native Messaging方向边界、短读短写、反压和artifact grant fuzz PASS。
- [ ] 168h core soak或对应24h release soak PASS。
- [ ] GitHub required checks与branch protection实际开启。
- [ ] AGENT和xuanxue receipt对同一 artifact/tuple/candidate闭合。

## 22.5 运行门

- [ ] `unauthenticated_browser_authority_issued_total = 0`。
- [ ] `command_without_valid_authority_total = 0`。
- [ ] `stale_event_side_effect_total = 0`。
- [ ] `old_completion_to_new_port_total = 0`。
- [ ] `non_idempotent_auto_replay_total = 0`。
- [ ] `wrong_profile_process_authority_issued_total = 0`。
- [ ] `command_after_liveness_expiry_total = 0`。
- [ ] `browser_action_during_authority_absence_total = 0`。
- [ ] `dual_active_browser_worker_total = 0`。
- [ ] `revoked_or_rollback_blocked_tuple_activated_total = 0`。
- [ ] `browser_admission_budget_violation_total = 0`。
- [ ] 故障注入下 job不误报complete。
- [ ] repair/rollback runbook真实演练。

---

# 23. 最终运行方式（通俗版）

网站请求先写入数据库任务队列，不直接等待某台本地插件。生产至少有一主一热备两个独立 Browser Worker；数据库 execution lease/fence 只允许一个 Worker 为某个任务写入，备用机不会并行操作同一页面。

每台 Worker 启动时，系统先检查专用 Chrome profile、批准的 Chrome process tree、force-install policy、插件安装树、Host、版本、签名、反回滚策略和身份。检查和握手期间，系统里没有所谓 browserSession，业务也拿不到任何浏览器按钮。

只有当 Controller、签名 Host、固定 ID 插件、精确版本组合和 capability probe 全部核对无误后，系统才像发放一把一次性钥匙一样签发 `AuthenticatedBrowserAuthority`。业务任务拿到的是这把有世代、有证书、有执行围栏的钥匙，不是一个“可能还没连好”的 BrowserController。

连接中任意一环断开、liveness租约到期、profile/process/policy漂移时，系统第一件事是把钥匙作废。旧任务、旧标签页引用、旧回包和旧命令全部不能进入下一条连接。然后系统关闭整条旧链，重新启动Host、重新连接插件、重新认证，最后发一把全新的钥匙。期间业务任务不执行浏览器写动作；活动Worker无法恢复时，备用Worker只能从封存checkpoint和新execution fence接管，未裁决mutation绝不重放。系统始终不会拿到一个未认证session。

插件升级时，新扩展包先兼容上一份已签名激活组合；等 Host、Controller和扩展都到齐后，再切换激活组合。回滚只是切回上一份组合，不指望 Chrome 立刻把扩展降级，因此不会被 CWS 异步更新节奏卡死。

以后新增功能，只增加受治理 capability、schema、policy、admission budget和验收。认证地基、Authority、Host、Port、exact target、profile enrollment、文件grant、安装和发布模型不再推倒重来。

---

# 24. 最终结论

本版对“一劳永逸”的定义最终冻结为：

> 在本文冻结的生产信任边界内，外部进程、Chrome、MV3 worker、Native Host乃至整台Browser Worker仍可能重启；但系统永远不会把未认证连接包装成browserSession，永远不会让业务持有半成品浏览器能力，永远不会把旧连接结果投递到新连接，永远不会让错误profile、过期liveness、被吊销tuple或失效execution fence继续动作，也永远不会靠第二transport或自动重放掩盖故障。任何可用Browser能力都必须由当前认证证书、有效liveness lease、批准profile/process、精确激活元组和执行围栏共同铸造。

这套方案施工完成并通过全部封口门后，`browserSession 未认证` 不再是“降低概率”的问题，而是一个在生产类型、对象模型、API、日志和动态证明中都不可表示的非法状态。
