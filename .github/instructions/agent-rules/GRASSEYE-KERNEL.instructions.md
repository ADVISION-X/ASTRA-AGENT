---
name: GrassEye Kernel
status: active
version: 2026-08-21.terminal
---

# GrassEye Kernel

## System Identity

GrassEye 是本机单用户、岗位固定的自动化执行系统，不是通用 planner。法定主链只有：

```text
Known job -> mediator -> owning plugin fixed flow -> capability public facade
-> Browser Authority / evidence / runtime log -> durable business result
```

任何层都不得替代另一层：业务状态属于 plugin，事实 evidence 属于 forensics-persistence，诊断属于 Runtime Log Spine，法案合规属于 audit。

## Highest Formula

```text
User explicit authorization
-> AGENTS.md
-> this Kernel
-> Index
-> active domain law
-> generated audit truth
-> blueprint
-> current source
```

当前 source 不能授权旧链。法案与施工图未对齐时，禁止进入相关生产代码；generated truth 只能由 builder 生成，不能手改。

## Browser Terminal Boundary

Browser side effect 只允许以下单链：

```text
owning plugin fixed flow
-> BrowserAuthorityBroker
-> exact authority + target/document lease
-> ws://127.0.0.1:4173/browser-authority/v1
-> fixed-directory unpacked MV3 Extension
-> fixed command registry
-> exact Chrome target/document
```

- Authority 数据面只有 `ABSENT` 或 `PRESENT`。
- Extension actor 是唯一 reconnect owner；App Server 只接受同一 listener 的 exact WebSocket upgrade。
- pairing 使用 256-bit secret；session 使用 P-256 ECDSA/ECDH、RFC8785 JCS、HKDF 与方向性 AES-GCM；每帧带 epoch、strict sequence、AAD 和 deadline。
- target/document/permit 必须三次检查；固定 registry 禁止 arbitrary JavaScript、raw CDP、URL、selector、coordinate 和 caller 物理资源。
- mutation 先 durable `PREPARED`+fsync；失联未决只能 `OUTCOME_UNKNOWN`，只有 owning plugin 能用真实正反终态裁决。
- artifact 与控制帧共用同一 socket，wire 不传 raw file path。

生产中绝对禁止：CWS identity/review、`externally_connectable`、page external Port relay、Native Messaging、Native Host、polling、SSE、previous-protocol window、第二 listener、第二 transport、fallback、bridge、dual write、shadow implementation。

## Real Browser Construction Admission

涉及浏览器、DOM、上传、下载、弹窗、LNA、MV3 生命周期或真实网站时：

1. 先记录当前受控标签、URL、DOM/author-shadow/UA-shadow 边界、控件、disabled/geometry、前后状态和日志。
2. 只实现本次真实观察过的结构与顺序。
3. 未观察状态必须 `UNKNOWN / NOT_PRODUCTION_VERIFIED`。
4. 修改后用同一路径重新真实验证；失败必须先取新证据，禁止连续猜测性补丁。

静态审计、Exam、real Chrome、business result、CI-FULL、release 是不同证据层，互不替代。

## Authority Split

- App：HTTP ingress、显示与唯一 WebSocket upgrade，不拥有业务步骤、浏览器动作或 evidence 真相。
- mediator：known job schema 校验和固定 plugin 转发。
- plugin：业务顺序、任务状态、成功/失败/review、business outcome。
- capability：公共原子动作，不懂业务。
- Browser Authority：pairing、transport、target/document、command、journal；不做业务裁决。
- API Boundary：逐站 HMAC admission；不接浏览器控制字段。
- startup：依赖、端口、health、artifact identity readback；不执行 job。
- audit：唯一 generated-plan 执法；不改生产代码。

## AI Boundary

AI 只按被法条授权的输入/输出合同工作，不能输出或控制 nextAction、workflow、browserCommand、selector、coordinate、filePath、付款、删除或敏感提交。

## Hard Bans

- 不增层、不增 server、不增 route bus、不增 audit runner、不增 evidence/log/provider transport。
- 不把日志、计划、fixture 或 CI 说成真实浏览器/生产事实。
- 不让页面、网站或外部 caller 控制 tab/window/title/marker/conversation/concurrency。
- 不用 bridge、alias、wrapper、fallback 或 dual run 维持被退休责任片区。
- 不把 `CI_FULL_PASS` 外推为外部服务、浏览器、部署或发布成功。
