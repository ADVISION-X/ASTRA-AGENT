---
name: GrassEye Startup Entrypoint
status: active
version: 2026-08-22.clean-restart
applyTo: scripts/startup/**,scripts/audit/domains/startup-entrypoint/**,scripts/acceptance/startup-*.ts

# GrassEye Startup Entrypoint｜终态法案

## Boundary

唯一用户启动命令是 npm run grasseye:start，唯一入口是 scripts/startup/launch-grasseye.mjs。该命令在 Node 进程创建时以 `--env-file-if-exists=.env.local` 读取唯一本地运行配置，使 App Server 可在已登记设备上启动法定 owner；不得打印、复制或展示其中的 secret/token。入口只做依赖、配置注入、端口、App health、固定 unpacked artifact identity preflight、页面打开和结构化启动报告；不得执行 job、浏览器 command、AI、上传、下载、evidence 或 CI。

## Unpacked Browser preflight

preflight 必须从目录外 release record 读回固定 extension directory、stable ID、manifest version/permissions、releaseBuildId、ExtensionDirectoryHashV1、protocol hash、Chrome executable/channel/version 和 approved profile identity。任一缺失/漂移输出 REPAIR_REQUIRED 且 Browser Authority=ABSENT。启动不创建 pairing、不 Load/Reload、不连接 socket、不启动 Browser flow。

禁止 CWS_PAGE_CHANNEL、CWS review/identity、Native Host、page relay、previous protocol 或第二启动入口。

## Clean restart boundary

每次启动都必须先把唯一 App Server 端口恢复为无监听者状态，不得热挂载现有进程。清理前必须同时确认 listener 的 UID、启动时间、cwd 与命令身份属于本仓库现役 App Server；全部候选通过后才允许发送 TERM，TERM 后仍存活时必须重新确认同一进程身份才允许在有界等待后发送 KILL。任一 listener 身份不明、属于另一仓库、PID 被复用或清理后端口仍非空时，启动失败关闭且不得发送信号给该进程。

## Law

```apex-law
{"lawId":"APEX-STARTUP-001-V3","status":"active","tier":"P0","capabilityDomain":"startup-entrypoint","enforcementMode":"machine-blocking","evidenceMode":"law+blueprint+ast+acceptance","summary":"The single startup entry establishes a clean repository-owned port before every launch, loads optional local configuration, verifies exact unpacked artifact identity, and never starts a Browser job.","required":["single command and entry","clean restart before every launch","listener UID start-time cwd and command ownership proof","identity recheck before TERM or KILL","bounded termination and empty-port postcondition","optional .env.local injection without secret output","health-before-open","fixed artifact readback","structured failure report"],"forbidden":["healthy-process hot mount","port-number-only termination","foreign or ambiguous listener signal","cross-repository process termination","PID-reuse signal","job execution","secret logging","second environment loader","CWS/page relay/native host","pairing/socket action","CI/audit/typecheck"],"clauses":[{"clauseId":"apex-startup-001-v3-clean-restart","statement":"Before every launch the sole startup command may terminate only listeners whose UID, start time, cwd and command prove the current repository-owned App Server identity; foreign, ambiguous or changed identities fail closed, and startup continues only after the port is empty.","evidenceMode":"static","ownerDomain":"startup-entrypoint"}]}
```
