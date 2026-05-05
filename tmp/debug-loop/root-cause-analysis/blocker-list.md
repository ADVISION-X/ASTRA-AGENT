# Blocker List

## BLOCKER-1: P0 map package identity regression crashes app shell before health

### 1. 日志证据

```txt
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed ZodError: [
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed "received": "child-capability-package", failureReason="\"received\": \"child-capability-package\","
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed "code": "invalid_literal", failureReason="\"code\": \"invalid_literal\","
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed "expected": "operational-map-package", failureReason="\"expected\": \"operational-map-package\","
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed "path": [
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed "manifest",
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed "packageKind"
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed "message": "Invalid literal value, expected \"operational-map-package\""
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed at readBuiltin (/Users/nexgen/Documents/GrassEye -AI-AGENT/src/map-plugins/builtins/index.ts:8:27)
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed at loadBuiltinMapPackages (/Users/nexgen/Documents/GrassEye -AI-AGENT/src/map-plugins/builtins/index.ts:14:5)
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed at seedBuiltinDevelopmentActivation (/Users/nexgen/Documents/GrassEye -AI-AGENT/src/map-plugins/registry/map-plugin-registry.ts:106:32)
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed at createBuiltinSeededRegistry (/Users/nexgen/Documents/GrassEye -AI-AGENT/src/map-plugins/registry/map-plugin-registry.ts:140:5)
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed at getDevelopmentMapPluginRegistry (/Users/nexgen/Documents/GrassEye -AI-AGENT/src/map-plugins/registry/map-plugin-registry.ts:165:20)
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed at createDefaultOrchestrationMapStore (/Users/nexgen/Documents/GrassEye -AI-AGENT/src/capabilities/orchestration/runtime/orchestration-default-map-store.ts:5:39)
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed at createOrchestrationAbilityGroup (/Users/nexgen/Documents/GrassEye -AI-AGENT/src/capabilities/orchestration/ability-group.ts:95:65)
[GRASSEYE][STARTUP][FAIL] startup_entrypoint bootstrap_failed failed startup bootstrap failed failureReason="Local service exited before health check passed with code 1."
```

traceId: MISSING  
attemptId: MISSING  
missionId: MISSING  
taskTemplateId: MISSING  
selectedMapId: MISSING  
requestedPlatformId: MISSING  
activationSnapshotRef: MISSING  
commandId / envelopeId: MISSING  
stepId: MISSING  
abilityGroupId: MISSING  
childCapabilityId: MISSING  
owner: MISSING  
ownerResponsible: MISSING  
status: failed  
failureReason: `Invalid literal value, expected "operational-map-package"` / `Local service exited before health check passed with code 1.`  
actionableMessage: MISSING

### 2. 实际行为

The app server started, but while initializing the workbench/orchestration runtime it loaded built-in map packages through `MapPackageSchema.parse`. A built-in package carried `manifest.packageKind = "child-capability-package"`, so Zod rejected the package. The process exited before `/api/runtime/health` passed. No commander console, mission runtime, command envelope, Nerve Bus envelope, activation snapshot, map step, capability call, PAV, transition, or forensics runtime events occurred.

Important current-state note: `rg 'child-capability-package' src .debug-loop tmp` returned no current source hit. The user terminal log is therefore the only evidence of that exact bad payload in the current turn; the code path and schema still prove why that payload is fatal, but the log relay does not identify which JSON file held it.

### 3. 法案原本要求

法案文件: `.github/instructions/cursor-rules/modules/module-map-plugin-package.instructions.md`  
lawId: `GRASSEYE-MAP-PLUGIN-001-V2`, `GRASSEYE-MAP-PLUGIN-003-V2`  
主题: 地图插件包声明式主权边界 / Schema 完整性与包治理元数据  
要求: map packages are declarative route data, not child capabilities; manifest requires `packageKind = operational-map-package`.  
禁止项: `map package as child ability`; schema default that turns missing governance fields into active-safe values.  
当前违反点: Runtime observed a map package modeled as a child-capability package.

### 4. 施工图原本要求

施工图文件: `docs/法案辅助文件/GrassEye 地图插件包治理施工图.md`  
章节: `4. Map Package Schema`, `17. Negative Proof Minimum`, `18. READY 标准`  
要求: `packageKind: operational-map-package`; negative proof must fail for `map package modeled as child ability`; READY requires no runtime/child ability behavior.  
当前违反点: The exact forbidden mutation reached startup runtime.

### 5. 根因定位

生产代码:
- `src/map-plugins/schema/map-plugin-manifest.schema.ts:39-42`: `packageKind` is `z.literal("operational-map-package")`, which correctly rejects the payload.
- `src/map-plugins/builtins/index.ts:6-8`: `readBuiltin` parses JSON with `MapPackageSchema.parse(JSON.parse(content))` and does not attach `fileName` to the error.
- `src/map-plugins/registry/map-plugin-registry.ts:105-140`: development bootstrap loads built-ins and immediately imports/activates approved active packages.
- `src/capabilities/orchestration/runtime/orchestration-default-map-store.ts:4-5`: default Orchestration map store calls `getDevelopmentMapPluginRegistry()`.
- `src/capabilities/orchestration/ability-group.ts:94-95`: ability group construction creates the default map store during workbench initialization.

关键判断:
The schema is correct; the root runtime blocker is that invalid built-in package identity reached app shell construction instead of being stopped by preflight/audit, and the loader threw a context-poor ZodError.

执法代码:
- `scripts/audit/domains/map-plugin-package/negative-proof-harness.ts:56-60`: contains the required mutation `map package modeled as child ability mutation`.
- `scripts/audit/domains/map-plugin-package/inspector.ts:47-58`: current worktree runs `runNegativeProofHarness()` when not nested.
- `HEAD:scripts/audit/domains/map-plugin-package/inspector.ts:47-61`: previous committed implementation returned `createPhase(... "mutated bypass")` instead of running negative proof.
- `scripts/audit/domains/map-plugin-package/required-shape.ts`: parses built-ins via `loadBuiltinPackageRecords`, but audit was not invoked by startup before app server health.

当前是否覆盖:
Current worktree coverage appears improved but is uncommitted. The historical committed inspector had fake PASS coverage for this exact negative proof class.

### 6. 为什么执法脚本没有拦住？

G. inspector 被豁免、跳过、warning-only、generated fake PASS. The previous HEAD implementation returned `mutated bypass` for the negative proof phase.  
C. 法案存在，但 startup preflight did not run the map package inspector/schema gate before service start.  
H. runtime 日志字段不足; the thrown error lacks `fileName`, owner, and actionable refs.

### 7. 应修复层级，但本阶段不修

修生产代码: Add file/context wrapping around built-in parse failures; add startup map package schema/lifecycle preflight before app server launch.  
修施工图: Clarify startup must run a map package preflight gate before health wait.  
修 inspector: Keep real negative proof execution and add anti-escape for fake PASS.  
修 negative proof: Preserve `map package modeled as child ability` mutation and ensure it fails/rolls back/passes.  
修结构化日志: Add fileName/packageId/ownerResponsible/actionableMessage to package parse failures.  
是否需要申请修改法案: NO

## BLOCKER-2: startup readiness passes even though map package runtime is not loadable

### 1. 日志证据

```txt
[GRASSEYE][STARTUP][PASS] bootstrap update_preflight_check passed update preflight passed durationMs=0
[GRASSEYE][AI][PASS] local_ai_runtime ai_capability_readiness_gate passed AI capability readiness gate passed refs=vision=ready:qwen2.5vl:3b,ocr=ready:apple-vision-or-paddleocr,commentUnderstanding=ready:qwen2.5:3b,productSignal=ready:qwen2.5:3b durationMs=235
[GRASSEYE][SERVICE][PASS] app_server app_server ready local app shell process started for http://127.0.0.1:4173 durationMs=1
[GRASSEYE][APP][EVENT] app_shell APP_SHELL_HEALTH_CHECK_STARTED started waiting for health at http://127.0.0.1:4173/api/runtime/health
[GRASSEYE][STARTUP][FAIL] startup_entrypoint bootstrap_failed failed startup bootstrap failed failureReason="Local service exited before health check passed with code 1."
```

traceId: MISSING  
attemptId: MISSING  
missionId: MISSING  
taskTemplateId: MISSING  
selectedMapId: MISSING  
requestedPlatformId: MISSING  
activationSnapshotRef: MISSING  
commandId / envelopeId: MISSING  
stepId: MISSING  
abilityGroupId: MISSING  
childCapabilityId: MISSING  
owner: MISSING  
ownerResponsible: MISSING  
status: failed  
failureReason: `Local service exited before health check passed with code 1.`  
actionableMessage: MISSING

### 2. 实际行为

Dependency and AI readiness gates passed. `update_preflight_check` passed with duration 0 because it only handled controlled dependency update safety. The script then started the app server, and only the server import path discovered that map packages were invalid.

### 3. 法案原本要求

法案文件: `.github/instructions/cursor-rules/modules/module-map-plugin-package.instructions.md`  
lawId: `GRASSEYE-MAP-PLUGIN-002-V2`  
主题: 地图包生命周期门禁  
要求: built-in packages must pass lifecycle gates; development seed auto-activation must generate proof fields and block validation issues.  
禁止项: unvalidated package active; activation by availabilityPolicy only.  
当前违反点: startup readiness treated the runtime as startable before built-in map package schema/lifecycle readiness was proven.

### 4. 施工图原本要求

施工图文件: `docs/法案辅助文件/GrassEye 地图插件包治理施工图.md`  
章节: `18. READY 标准`  
要求: `all built-ins and imported packages pass same lifecycle`; `owner-local inspector PASS`; `negative proof PASS`; `ALL active law enforcement PASS`.  
当前违反点: app server launch was not gated by those package readiness checks.

### 5. 根因定位

生产代码:
- `scripts/startup/launch-grasseye.mjs:78-94`: `runUpdatePreflight` validates only update/dependency safety.
- `scripts/startup/launch-grasseye.mjs:195-205`: `performLaunch` runs dependencies, update preflight, AI readiness, port clear, then starts service; no map package preflight exists.
- `scripts/startup/launch-grasseye.mjs:110-126`: starts `internal:app-server:dev` without preStartScripts.

执法代码:
- `scripts/audit/domains/map-plugin-package/required-shape.ts`: can parse built-ins and produce fatal findings.
- `scripts/audit/domains/map-plugin-package/inspector.ts`: current worktree can run the real negative proof harness.
- No inspected startup-specific audit hook was found that forces map-plugin-package inspector/schema preflight before `startLocalService`.

### 6. 为什么执法脚本没有拦住？

C. 法案存在，但 inspector 未覆盖 startup preflight integration.  
I. 生产代码绕过了 governed public interface by constructing development map registry directly during app startup instead of first requiring a governed readiness verdict.  
H. runtime 日志字段不足 to classify the failing owner at startup.

### 7. 应修复层级，但本阶段不修

修生产代码: Add a map package readiness/preflight phase before app server start.  
修施工图: Explicit startup gate section for map package schema/lifecycle preflight.  
修 inspector: Add coverage that `launch-grasseye.mjs` includes the map package preflight.  
修 negative proof: Mutation removing startup map package preflight should fail.  
修结构化日志: Add `map_package_readiness_check` events.  
是否需要申请修改法案: NO

## BLOCKER-3: stderr relay destroys structured root-cause fields for Zod failures

### 1. 日志证据

```txt
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed { failureReason={
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed "received": "child-capability-package", failureReason="\"received\": \"child-capability-package\","
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed "path": [ failureReason="\"path\": ["
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed "manifest", failureReason="manifest",
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed "packageKind" failureReason="packageKind"
[GRASSEYE][SERVICE][FAIL] internal:app-server:dev stderr failed at readBuiltin (/Users/nexgen/Documents/GrassEye -AI-AGENT/src/map-plugins/builtins/index.ts:8:27)
```

traceId: MISSING  
attemptId: MISSING  
missionId: MISSING  
taskTemplateId: MISSING  
selectedMapId: MISSING  
requestedPlatformId: MISSING  
activationSnapshotRef: MISSING  
commandId / envelopeId: MISSING  
stepId: MISSING  
abilityGroupId: MISSING  
childCapabilityId: MISSING  
owner: MISSING  
ownerResponsible: MISSING  
status: failed  
failureReason: split stderr line  
actionableMessage: MISSING

### 2. 实际行为

The terminal logger emits each stderr line as an independent `SERVICE FAIL`, assigning the raw line to both `message` and `failureReason`. It does not parse Zod errors into a single structured event, preserve package filename, attach owner, or produce an actionable message.

### 3. 法案原本要求

法案文件: `.github/instructions/cursor-rules/modules/module-map-plugin-package.instructions.md` and orchestration/structured-log doctrine  
lawId: `GRASSEYE-MAP-PLUGIN-010-V2` / `GRASSEYE-ORCHESTRATION-CAPABILITY-003-V3`  
主题: Forensics-compatible proof and runtime chain parity  
要求: package/activation proof refs and runtime chain fields must be present enough to diagnose owner and package boundary failures.  
当前违反点: startup failure has no ownerResponsible, fileName, packageId, traceId, or actionableMessage.

### 4. 施工图原本要求

施工图文件: `docs/法案辅助文件/GrassEye 结构化日志与运行证明施工图.md`  
章节: runtime proof/log chain  
要求: logs expose owner, refs, activation snapshot, step/capability ids, and structured failure reason.  
当前违反点: emitted logs are line-oriented stderr, not structured root-cause events.

### 5. 根因定位

生产代码:
- `scripts/startup/lib/terminal-structured-log.mjs:156-172`: `createStderrRelay` emits every stderr line as `SERVICE stderr failed`.
- `src/map-plugins/builtins/index.ts:6-8`: `readBuiltin` throws raw ZodError without file/package context.
- `scripts/startup/lib/health-check.mjs:97-109`: health wait collapses the failure to `Local service exited before health check passed with code 1`.

执法代码:
- No map-plugin-package negative proof currently proves runtime parse errors include `fileName/packageId/ownerResponsible/actionableMessage`.
- Existing negative proof proves rejection, not diagnosability of rejection.

### 6. 为什么执法脚本没有拦住？

H. runtime 日志字段不足，无法让 inspector 或人定位.  
C. 法案存在，但 inspector 未覆盖 diagnosability of startup schema failures.  
D. Existing checks focus on schema/AST/package shape, not symbol-level logging contract from loader to startup relay.

### 7. 应修复层级，但本阶段不修

修生产代码: Wrap map package parse errors with package filename and owner.  
修施工图: Add startup parse-failure logging contract.  
修 inspector: Require structured package parse failure shape.  
修 negative proof: Inject bad packageKind and assert failure log has file/package/actionable fields.  
修结构化日志: Add `traceId`, `ownerResponsible=map-plugin-package`, `packageFile`, `packageKind`, `expectedPackageKind`, `actionableMessage`.  
是否需要申请修改法案: NO

## BLOCKER-4: latest debug bundle is stale/unrelated and cannot explain current startup blocker

### 1. 日志证据

```txt
.debug-loop/runs/debug-2026-05-03T20-30-49-789Z/iteration-001/stdout.log
{
  "status": "PASS",
  "scenarioId": "facebook-auth-check",
  "successSignals": [
    "authStatus=AUTH_OK",
    "pageState=platform_ready"
  ],
  "blockingSignals": [],
  "runtimeEvents": [],
  "rootCause": null,
  "command": {
    "command": "/opt/homebrew/Cellar/node/24.4.1/bin/node",
    "exitCode": 0,
    "timedOut": false,
    "failureReason": null
  }
}

.debug-loop/runs/debug-2026-05-03T20-30-49-789Z/iteration-001/failure-classification.json
{
  "failureCategory": "CI_ERROR",
  "owner": "nerve-bus",
  "severity": "P0",
  "rootCause": "src/capabilities/nerve-bus/runtime/transport-success-result.ts(12,3): error TS1131: Property or signature expected."
}
```

traceId: MISSING  
attemptId: MISSING  
missionId: MISSING  
taskTemplateId: MISSING  
selectedMapId: MISSING  
requestedPlatformId: MISSING  
activationSnapshotRef: MISSING  
commandId / envelopeId: MISSING  
stepId: MISSING  
abilityGroupId: MISSING  
childCapabilityId: MISSING  
owner: `nerve-bus` in stale bundle, not current failure owner  
ownerResponsible: MISSING for current failure  
status: stale PASS / stale CI_ERROR  
failureReason: stale TypeScript parse error  
actionableMessage: MISSING

### 2. 实际行为

The latest debug-loop bundle does not contain the current `grasseye:start` startup failure. It reports an older `facebook-auth-check` pass and an older CI failure classified to `nerve-bus`. Therefore current startup root cause cannot be mined from recent debug-loop files; it must be mined from the terminal log and source.

### 3. 法案原本要求

法案文件: `.github/instructions/cursor-rules/modules/module-debug-loop-boundary.instructions.md`  
lawId: debug-loop boundary law set  
主题: debug-loop boundary and repair packet truth  
要求: debug-loop must preserve scenario/runtime evidence without interpreting operational map runtime; repair packets must point to current evidence.  
当前违反点: Latest debug bundle is not correlated with the current startup run, so it cannot serve as forensics proof for this blocker.

### 4. 施工图原本要求

施工图文件: `docs/法案辅助文件/GrassEye Debug Loop Boundary 调试程序边界施工图.md`  
章节: evidence/ref boundary  
要求: debug-loop outputs must preserve current command/runtime evidence and repair packet refs.  
当前违反点: No current startup debug bundle exists under the searched paths.

### 5. 根因定位

生产/工具链代码:
- Debug-loop files under `.debug-loop/runs/debug-2026-05-03T20-30-49-789Z/iteration-001/` are from 2026-05-03, not 2026-05-05 startup.
- `scripts/startup/launch-grasseye.mjs` does not write a debug-loop bundle for startup failures; it only relays terminal structured logs.

执法代码:
- No inspected audit rule requires `grasseye:start` failures to emit a debug bundle under `tmp/.debug-loop/runtime/forensics` with startup trace refs.

### 6. 为什么执法脚本没有拦住？

H. runtime 日志字段不足，无法让 inspector 或人定位.  
C. 法案存在，但 inspector 未覆盖 startup debug bundle correlation.  
J. Other: debug-loop and startup logging are separate paths; current failure is outside the latest debug-loop run.

### 7. 应修复层级，但本阶段不修

修生产代码: Persist startup failure bundles with runId/attemptId/log refs.  
修施工图: Clarify startup failure bundle requirements.  
修 inspector: Require startup failure bundle presence/correlation.  
修 negative proof: Simulate startup failure and require a current bundle.  
修结构化日志: Add startup `runId` and bundle path.  
是否需要申请修改法案: NO
