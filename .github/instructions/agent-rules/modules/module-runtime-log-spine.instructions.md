---
name: GrassEye Runtime Log Spine
status: active
version: 2026-08-21.terminal
applyTo: src/lib/runtime-logs/**,scripts/audit/domains/runtime-log-spine/**,scripts/acceptance/**

# GrassEye Runtime Log Spine 终态法案

## 唯一日志真相

Runtime Log Spine 只记录脱敏的 FLOW、DEBUG、TRACE 诊断；它不替代 plugin task state、forensics evidence、audit truth、Browser journal 或 release record。每个 flow stage 必须有 started/terminal 配对、trace/run/task identity、owner、duration、failure class、evidence/artifact ref 和 recovery trail。

## Terminal event coverage

Browser authority 必须记录 pairing outcome、socket/auth epoch、release/profile/Chrome readback hash、liveness revoke、target/document lease invalidation、command admission/completion、artifact completion、PREPARED/terminal/OUTCOME_UNKNOWN 和 repair-forward。Extension 的 authenticated frame failure、unhandled rejection、worker error、peer close 与 TCP error 必须经同一 WebSocket 上行到 Workbench，并在启动终端形成 `BROWSER_EXTENSION_FAILURE` 或相应撤销事件，携带脱敏 source、frame kind/sequence、encoded byte length、close/error code 和 reason；不得只留在 `chrome://extensions`。普通 runtime diagnostic 只记录、不撤销 Browser Authority；只有认证完整性失败才先记录再撤销。API 必须记录 redacted site ingress/auth/replay/rotation/revocation；plugin 必须记录 durable business stage 和 human gate。

禁止记录 pairing code、private key、shared secret、signature material、token、cookie、raw body、provider secret、raw sensitive attachment、artifact bytes、raw path 或 full prompt/payload。

## Law

```apex-law
{"lawId":"APEX-RUNTIME-LOG-SPINE-001-V2","status":"active","tier":"P0","capabilityDomain":"runtime-log-spine","enforcementMode":"machine-blocking","evidenceMode":"law+blueprint+ast+acceptance","summary":"One redacted log spine records terminal Browser/API/recovery diagnostics without becoming business, evidence or audit truth.","required":["FLOW/DEBUG/TRACE","started/terminal pairs","new authority/ingress/recovery event registry","authenticated extension failures reach the Workbench terminal","failure classes","redaction proof"],"forbidden":["second logger","extension error visible only in chrome extensions","secret/raw payload/path persistence","log-as-evidence","silent branch","unpaired terminal"],"clauses":[{"clauseId":"apex-runtime-log-001-v2-terminal-observability","statement":"Every terminal authority, extension, ingress and recovery event is attributable and redacted in the Workbench terminal.","evidenceMode":"static","ownerDomain":"runtime-log-spine"}]}
```
