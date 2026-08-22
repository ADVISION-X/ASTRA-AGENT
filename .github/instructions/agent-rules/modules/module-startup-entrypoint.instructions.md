---
name: GrassEye Startup Entrypoint
status: active
version: 2026-08-21.terminal
applyTo: scripts/startup/**,scripts/audit/domains/startup-entrypoint/**,scripts/acceptance/startup-*.ts

# GrassEye Startup Entrypoint｜终态法案

## Boundary

唯一用户启动命令是 npm run grasseye:start，唯一入口是 scripts/startup/launch-grasseye.mjs。该命令在 Node 进程创建时以 `--env-file-if-exists=.env.local` 读取唯一本地运行配置，使 App Server 可在已登记设备上启动法定 owner；不得打印、复制或展示其中的 secret/token。入口只做依赖、配置注入、端口、App health、固定 unpacked artifact identity preflight、页面打开和结构化启动报告；不得执行 job、浏览器 command、AI、上传、下载、evidence 或 CI。

## Unpacked Browser preflight

preflight 必须从目录外 release record 读回固定 extension directory、stable ID、manifest version/permissions、releaseBuildId、ExtensionDirectoryHashV1、protocol hash、Chrome executable/channel/version 和 approved profile identity。任一缺失/漂移输出 REPAIR_REQUIRED 且 Browser Authority=ABSENT。启动不创建 pairing、不 Load/Reload、不连接 socket、不启动 Browser flow。

禁止 CWS_PAGE_CHANNEL、CWS review/identity、Native Host、page relay、previous protocol 或第二启动入口。

## Law

```apex-law
{"lawId":"APEX-STARTUP-001-V2","status":"active","tier":"P0","capabilityDomain":"startup-entrypoint","enforcementMode":"machine-blocking","evidenceMode":"law+blueprint+ast+acceptance","summary":"The single startup entry loads the optional local runtime configuration, establishes local readiness and exact unpacked artifact identity, and never starts a Browser job.","required":["single command and entry","optional .env.local injection without secret output","health-before-open","fixed artifact readback","structured failure report"],"forbidden":["job execution","secret logging","second environment loader","CWS/page relay/native host","pairing/socket action","CI/audit/typecheck"],"clauses":[{"clauseId":"apex-startup-001-v2-unpacked-readback","statement":"The sole command injects an optional .env.local into the one startup process; identity mismatch leaves Browser Authority ABSENT and produces an exact repair reason.","evidenceMode":"static","ownerDomain":"startup-entrypoint"}]}
```
