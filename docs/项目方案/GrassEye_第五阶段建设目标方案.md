# GrassEye 第五阶段建设目标方案

status: SUPERSEDED / ARCHIVED REFERENCE.
Superseded by: docs/法案辅助文件/GrassEye 第五阶段高级AI地图生成与WEB本地程序打通施工图.md + docs/项目方案/GrassEye_视觉裁判_故事情节.md
This file must not be used as current delivery authority.

## 1. 阶段定位

第五阶段目标是实现高级 AI 生成地图，并打通 WEB 平台与本地程序 / iPhone Mirroring / macOS local 的统一执行链路。

本文件仅保留历史阶段语义，不代表当前冻结基线：

- 14 个 active ability groups。
- 5 个 foundation laws。
- 历史上曾存在 1 个 retired support governance domain：map-plugin-package（not current）。
- 不新增 owner，不修改 `.github/instructions/cursor-rules/**` 法案文件。

`local-ai-runtime` 仍归 AI，`local-browser-session` 仍归 Open，`local-app-shell` 仍归 Commander Console，`structured-logging` 父 owner 仍归 Forensics，并由 governance 约束。第五阶段不是新增 runtime，而是把既有能力组按证据链打通。

## 2. Retired historical chain

```txt
Human / Operator
→ Commander Console / Map Lab
→ AI map_authoring request
→ AI structured draft output
→ map authoring normalizer
→ map-plugin-package import
→ quarantine / validation / compatibility / Commander governed automation gate
→ active registry
→ Orchestration freeze activation snapshot
→ Nerve Bus dispatch
→ WEB / local program ability groups
→ Page State / Screenshot / AI / PAV / Forensics proof
```

## 3. 明确禁止

- AI 直接激活 active map。
- AI 直接执行动作。
- Map package 调浏览器、调 Nerve Bus、写 executable function。
- 本地程序绕过 Nerve Bus 或绕过 ability group。
- Page State 自己推进 mission。
- 新增 `advanced-ai`、`map-authoring`、`web-runtime`、`local-program`、`web-local-runtime` owner。
- 新增第二套 Agent runtime。

## 4. 高级 AI 生成地图边界

Map Lab 是历史上的 Commander Console / AI / map-plugin-package 组合入口。该口径已退役；当前生产主链不再授予 map-plugin-package support 主权，也不再使用 activation snapshot 作为 mission 主链真相。

当前生产方向以 `generateMapLabDraft()` 为准：`buildMapAuthoringAiRequest()` 构造 AI request，`aiAbilityGroup.execute()` 返回结构化结果，`normalizeMapLabDraft()` 归一化，最后 `registry.importPackage()` 导入。非 success、dry-run captured、validation issues 都不得直接 active。

## 5. WEB 与本地程序打通边界

WEB 执行仍归属 Open、Page State、Screenshot、Visual Target、Geometry Guard、Mouse Click、Mouse Scroll、Text Input、PAV、Forensics 等既有能力组。local browser session 和 local program 只是 Open 能力组下的受治理 profile / handoff，不是独立 owner。

本地程序 / iPhone Mirroring / macOS local 必须走相同 envelope：

```txt
Orchestration
→ Nerve Bus
→ ability group dispatch
→ Page State / Screenshot / action ability
→ PAV
→ Forensics
```

历史方案要求 Page State 回连 map package/version、selected map/version、`activationSnapshotRef`。该口径已退役；当前生产链只允许短链 mission/run/round/step/evidence truth。

## 6. 阶段验收

- AI runtime 失败不能只剩 `runtime_execution_failed`，必须有 `AI_ERROR_DEBUG`、`implementationStatus`、`errorKind`、`runtimeCallId` 或 `diagnosticPayloadRef`。
- AI review_required 不能只剩 `quality_gate_blocked`。必须能区分 schema、confidence、quality policy、output-boundary、parsed business decision 等原因，并保持 `capabilityCallId` 为 Orchestration step invocation id。
- Forensics structured write 验收必须覆盖非 AI owner。Commander、Nerve Bus、Orchestration、Page State、Screenshot、PAV 等 runtime event 不能只停在 `FORENSICS_RECORD_WRITE_REQUESTED`。
- accepted 后不得再出现同一 command/run 的 `COMMAND_REJECTED`；observer timeout 必须降级为 receipt/observer timeout 事件。
- Forensics write requested/written terminal summary 必须携带 `sourceEventId`、`sourceEventType`、`idempotencyKey`、`dedupeDecision` 和 record refs。
- Page State local-runtime dispatch inspector 与生产代码事实一致，generated summary 不得 stale。
- Map Lab 生成地图只进入 import/quarantine/validation/review，不直接 active。
- Facebook/TikTok 业务地图允许在安全 review gate 停止；14 能力组全覆盖由 `builtin.phase-05-full-surface-diagnostic` 使用 local sandbox / dry-run / no-op / review gate 验收。
