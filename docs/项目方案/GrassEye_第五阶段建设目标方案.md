# GrassEye 第五阶段建设目标方案

## 1. 阶段定位

第五阶段目标是实现高级 AI 生成地图，并打通 WEB 平台与本地程序 / iPhone Mirroring / macOS local 的统一执行链路。

本阶段继续服从冻结基线：

- 14 个 active ability groups。
- 5 个 foundation laws。
- 1 个 support governance domain：map-plugin-package。
- 不新增 owner，不修改 `.github/instructions/cursor-rules/**` 法案文件。

`local-ai-runtime` 仍归 AI，`local-browser-session` 仍归 Open，`local-app-shell` 仍归 Commander Console，`structured-logging` 仍归 Forensics / governance。第五阶段不是新增 runtime，而是把既有能力组按证据链打通。

## 2. 正确主链

```txt
Human / Operator
→ Commander Console / Map Lab
→ AI map_authoring request
→ AI structured draft output
→ map authoring normalizer
→ map-plugin-package import
→ quarantine / validation / compatibility / human approval
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

Map Lab 是 Commander Console / AI / map-plugin-package support domain 的组合入口。AI 只生成结构化 draft map；normalizer 负责把 AI 输出收敛为声明式 package；registry `importPackage()` 负责 quarantine、validation、compatibility proof 和 review-required 结果。激活只能发生在 human approval 之后，由 map-plugin-package 生命周期和 Orchestration activation snapshot 证明。

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

Page State dispatch 必须传播 `runId`、`sessionId`、`stepId`、map package/version、selected map/version、`activationSnapshotRef`、`capabilityCallId`、`nerveBusEnvelopeId`、`inputRef`、`idempotencyKey` 和 `openHandoff.browserSessionRef`，确保 WEB / local 状态判断可回连 active map 和 mission run。

## 6. 阶段验收

- AI runtime 失败不能只剩 `runtime_execution_failed`，必须有 `AI_ERROR_DEBUG`、`implementationStatus`、`errorKind`、`runtimeCallId` 或 `diagnosticPayloadRef`。
- accepted 后不得再出现同一 command/run 的 `COMMAND_REJECTED`；observer timeout 必须降级为 receipt/observer timeout 事件。
- Forensics write requested/written terminal summary 必须携带 `sourceEventId`、`sourceEventType`、`idempotencyKey`、`dedupeDecision` 和 record refs。
- Page State local-runtime dispatch inspector 与生产代码事实一致，generated summary 不得 stale。
- Map Lab 生成地图只进入 import/quarantine/validation/review，不直接 active。
