文件名建议：

# `GrassEye_Debug_Loop_Controller_建设方案_FINAL.md`

---

# GrassEye Debug Loop Controller 建设方案 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-DEBUG-LOOP-CONTROLLER-BLUEPRINT-FINAL
documentType: construction-blueprint
owner: debug-loop-controller
scope: local-development-tooling
status: active
targetPath: scripts/debug-loop/**
notAbilityGroup: true
notRuntimeCapability: true
notProductionFeature: true
```

本文件是 **GrassEye 调试程序 / Debug Loop Controller** 的完整建设方案。

本方案目标不是修复某一个能力组，而是建设一个通用调试控制器，让 GrassEye 可以进入真实闭环调试：

```txt
启动系统
→ 发布真实任务
→ 运行真实 scenario
→ 全量读取日志
→ 分类问题
→ 生成 Codex repair-packet
→ Codex 按 repair-packet 修复
→ Controller 验证 audit / CI / runtime
→ 决定 PASS / BLOCK / CONTINUE
```

---

## 1. 核心定位

Debug Loop Controller 是本地开发辅助程序，不是第 15 个能力组。

它必须放在：

```txt
scripts/debug-loop/**
```

它不能放进：

```txt
src/capabilities/**
```

它不能成为：

```txt
ability group
runtime owner
business feature
production route
map plugin
Nerve Bus owner
Commander owner
Orchestration owner
```

一句话：

```txt
Debug Loop Controller 负责调试循环；
Codex 负责按 repair-packet 修复；
CI 负责静态验收；
runtime scenario 负责真实运行验收。
```

---

## 2. 为什么必须建设 Debug Loop Controller

仅靠提示词无法稳定完成循环调试，因为 Codex 可能：

```txt
只看最后一段日志
漏掉前面的 first fatal
把鉴权问题误判成代码问题
把外部平台安全页误判成 runtime bug
乱改无关 owner
降低法案换 PASS
关闭 inspector
删除 negative proof
伪造 generated PASS
绕过 Commander / Nerve Bus / Orchestration
把 draft map 直接运行
```

因此必须用本地控制器把每一步固定下来：

```txt
Controller 执行循环
Controller 读取日志
Controller 分类问题
Controller 生成 repair-packet
Codex 只修 repair-packet
Controller 验证修复
Controller 决定下一轮
```

---

## 3. 总体架构

### 3.1 目录结构

Codex 必须创建：

```txt
scripts/debug-loop/
├── run-debug-loop.mjs
├── scenario-runner.mjs
├── task-publisher.mjs
├── map-resolver.mjs
├── auth-detector.mjs
├── log-collector.mjs
├── log-indexer.mjs
├── failure-classifier.mjs
├── owner-router.mjs
├── repair-packet-writer.mjs
├── verifier.mjs
├── decision-engine.mjs
├── git-guard.mjs
├── law-enforcement-reader.mjs
├── command-runner.mjs
├── package-script-resolver.mjs
├── json-utils.mjs
├── path-policy.mjs
└── scenarios/
    ├── local-workbench-smoke.scenario.json
    ├── facebook-auth-check.scenario.json
    ├── tiktok-auth-check.scenario.json
    ├── facebook-product-video-runtime.scenario.json
    └── tiktok-product-video-runtime.scenario.json
```

### 3.2 输出目录

每次运行必须写入：

```txt
.debug-loop/runs/<debugSessionId>/iteration-<iterationNumber>/
```

每轮目录必须包含：

```txt
scenario.json
command.json
stdout.log
stderr.log
runtime.jsonl
audit-build.log
owner-audit.log
ci-full.log
log-index.json
failure-classification.json
repair-packet.json
repair-packet.md
verification-result.json
decision.json
git-state.json
```

如果某个日志源不存在，必须写入空文件并在 `log-index.json` 中标记：

```txt
missingLogSources
```

不得因为日志缺失就默认 PASS。

---

## 4. package.json 命令

Codex 必须在 `package.json` 中新增命令：

```json
{
  "debug:loop": "node scripts/debug-loop/run-debug-loop.mjs",
  "debug:scenario": "node scripts/debug-loop/scenario-runner.mjs",
  "debug:classify": "node scripts/debug-loop/failure-classifier.mjs",
  "debug:verify": "node scripts/debug-loop/verifier.mjs"
}
```

如果已有同名命令，必须保留现有语义，不能破坏；如冲突，输出 `BLOCKED_PACKAGE_SCRIPT_CONFLICT`，不得强行覆盖。

---

## 5. Debug Loop 状态机

`run-debug-loop.mjs` 必须实现以下状态机：

```txt
PRECHECK
→ LOAD_SCENARIO
→ GIT_GUARD_BEFORE
→ MAP_RESOLVE
→ AUTH_PRECHECK
→ PUBLISH_TASK
→ RUN_SCENARIO
→ COLLECT_LOGS
→ INDEX_LOGS
→ CLASSIFY_FAILURE
→ ROUTE_OWNER
→ BUILD_REPAIR_PACKET
→ VERIFY_IF_CONTINUE_MODE
→ DECIDE_NEXT
```

### 5.1 运行模式

必须支持：

```txt
--scenario <scenarioId>
--maxIterations <number>
--continue
--repairMode manual | codex-cli
--owner <ownerId optional>
--runId <existingDebugSessionId optional>
```

默认值：

```txt
maxIterations = 1
repairMode = manual
continue = false
```

第一阶段只要求 `manual` 模式真实可用。

`codex-cli` 模式可以预留接口，但不得 fake pass。

---

## 6. Scenario 通用模型

### 6.1 支持的 scenarioKind

Debug Loop Controller 必须支持以下类型：

```txt
local-workbench
platform-auth-check
mission-runtime
map-authoring
map-validation
map-activation
owner-audit
```

第一阶段必须真实支持：

```txt
local-workbench
platform-auth-check
mission-runtime
owner-audit
```

`map-authoring / map-validation / map-activation` 可先完成结构支持和 BLOCKED 分类，不得伪造 AI 生成地图成功。

---

## 7. Scenario 文件格式

每个 scenario 必须是 JSON 文件。

基础结构：

```json
{
  "scenarioId": "facebook-product-video-runtime",
  "scenarioKind": "mission-runtime",
  "description": "Run Facebook product video discovery mission.",
  "platformId": "facebook-web",
  "requiresAuth": true,
  "entryMode": "commander-public-contract",
  "humanGoal": "Find product-seeding videos in Facebook video feed and create evidence packets.",
  "mapRequirement": {
    "mode": "active-approved-map",
    "taskTemplateId": "product-video-discovery",
    "platformId": "facebook-web",
    "requiredPromptContracts": true,
    "allowAutoAuthoring": false,
    "allowDraftExecution": false
  },
  "expectedChain": [
    "commander-console",
    "nerve-bus",
    "orchestration",
    "open",
    "page-state",
    "screenshot",
    "ai",
    "visual-target",
    "geometry-guard",
    "mouse-scroll",
    "post-action-verification",
    "forensics-persistence"
  ],
  "successSignals": [
    "missionStatus=completed",
    "forensicsEvidencePacketCreated=true"
  ],
  "blockingSignals": [
    "AUTH_REQUIRED",
    "CAPTCHA_REQUIRED",
    "SECURITY_CHECK_REQUIRED",
    "PROFILE_INVALID"
  ],
  "maxRuntimeMs": 180000
}
```

---

## 8. 必须创建的内置 scenarios

### 8.1 local-workbench-smoke

```json
{
  "scenarioId": "local-workbench-smoke",
  "scenarioKind": "local-workbench",
  "description": "Start local GrassEye runtime without external platform dependency.",
  "platformId": "local-workbench",
  "requiresAuth": false,
  "entryMode": "local-startup",
  "mapRequirement": {
    "mode": "none"
  },
  "successSignals": [
    "startupStatus=ready",
    "abilityRegistryLoaded=true"
  ],
  "blockingSignals": [],
  "maxRuntimeMs": 120000
}
```

### 8.2 facebook-auth-check

```json
{
  "scenarioId": "facebook-auth-check",
  "scenarioKind": "platform-auth-check",
  "description": "Open Facebook web using real local Chrome profile and detect authentication state.",
  "platformId": "facebook-web",
  "requiresAuth": true,
  "entryMode": "open-platform-only",
  "mapRequirement": {
    "mode": "none"
  },
  "successSignals": [
    "authStatus=AUTH_OK",
    "pageState=platform_ready"
  ],
  "blockingSignals": [
    "AUTH_REQUIRED",
    "CAPTCHA_REQUIRED",
    "SECURITY_CHECK_REQUIRED",
    "PROFILE_INVALID",
    "SESSION_EXPIRED"
  ],
  "maxRuntimeMs": 120000
}
```

### 8.3 tiktok-auth-check

```json
{
  "scenarioId": "tiktok-auth-check",
  "scenarioKind": "platform-auth-check",
  "description": "Open TikTok web using real local Chrome profile and detect authentication state.",
  "platformId": "tiktok-web",
  "requiresAuth": true,
  "entryMode": "open-platform-only",
  "mapRequirement": {
    "mode": "none"
  },
  "successSignals": [
    "authStatus=AUTH_OK",
    "pageState=platform_ready"
  ],
  "blockingSignals": [
    "AUTH_REQUIRED",
    "CAPTCHA_REQUIRED",
    "SECURITY_CHECK_REQUIRED",
    "PROFILE_INVALID",
    "SESSION_EXPIRED"
  ],
  "maxRuntimeMs": 120000
}
```

### 8.4 facebook-product-video-runtime

```json
{
  "scenarioId": "facebook-product-video-runtime",
  "scenarioKind": "mission-runtime",
  "description": "Run Facebook product video discovery mission through Commander Console public command gate.",
  "platformId": "facebook-web",
  "requiresAuth": true,
  "entryMode": "commander-public-contract",
  "humanGoal": "Find product-seeding videos in Facebook video feed and create evidence packets.",
  "mapRequirement": {
    "mode": "active-approved-map",
    "taskTemplateId": "product-video-discovery",
    "platformId": "facebook-web",
    "requiredPromptContracts": true,
    "allowAutoAuthoring": false,
    "allowDraftExecution": false
  },
  "expectedChain": [
    "commander-console",
    "nerve-bus",
    "orchestration",
    "open",
    "page-state",
    "screenshot",
    "ai",
    "visual-target",
    "geometry-guard",
    "mouse-scroll",
    "post-action-verification",
    "forensics-persistence"
  ],
  "successSignals": [
    "missionStatus=completed",
    "forensicsEvidencePacketCreated=true"
  ],
  "blockingSignals": [
    "AUTH_REQUIRED",
    "CAPTCHA_REQUIRED",
    "SECURITY_CHECK_REQUIRED",
    "PROFILE_INVALID",
    "SESSION_EXPIRED"
  ],
  "maxRuntimeMs": 180000
}
```

### 8.5 tiktok-product-video-runtime

```json
{
  "scenarioId": "tiktok-product-video-runtime",
  "scenarioKind": "mission-runtime",
  "description": "Run TikTok product video discovery mission through Commander Console public command gate.",
  "platformId": "tiktok-web",
  "requiresAuth": true,
  "entryMode": "commander-public-contract",
  "humanGoal": "Find product-seeding videos in TikTok feed and create evidence packets.",
  "mapRequirement": {
    "mode": "active-approved-map",
    "taskTemplateId": "product-video-discovery",
    "platformId": "tiktok-web",
    "requiredPromptContracts": true,
    "allowAutoAuthoring": false,
    "allowDraftExecution": false
  },
  "expectedChain": [
    "commander-console",
    "nerve-bus",
    "orchestration",
    "open",
    "page-state",
    "screenshot",
    "ai",
    "visual-target",
    "geometry-guard",
    "mouse-scroll",
    "post-action-verification",
    "forensics-persistence"
  ],
  "successSignals": [
    "missionStatus=completed",
    "forensicsEvidencePacketCreated=true"
  ],
  "blockingSignals": [
    "AUTH_REQUIRED",
    "CAPTCHA_REQUIRED",
    "SECURITY_CHECK_REQUIRED",
    "PROFILE_INVALID",
    "SESSION_EXPIRED"
  ],
  "maxRuntimeMs": 180000
}
```

---

## 9. Map Resolver 设计

文件：

```txt
scripts/debug-loop/map-resolver.mjs
```

### 9.1 mapRequirement.mode

必须支持：

```txt
none
active-approved-map
generate-draft-map
activate-existing-draft
builtin-seed-map
```

### 9.2 规则

#### none

用于：

```txt
local-workbench
platform-auth-check
owner-audit
```

行为：

```txt
不查地图
不阻塞
```

#### active-approved-map

用于真实 mission-runtime。

必须检查：

```txt
active approved map exists
taskTemplateId matches
platformId matches
activationSnapshotRef exists
promptContractId exists for AI steps
outputSchemaRef exists for AI steps
mapPackageVersion exists
selectedMapVersion exists
capabilityCatalogVersion exists
```

找不到时返回：

```txt
BLOCKED_NO_ACTIVE_MAP
```

缺 prompt 时返回：

```txt
BLOCKED_NO_PROMPT_CONTRACT
```

缺激活快照时返回：

```txt
BLOCKED_MAP_NOT_ACTIVATED
```

不得让 Codex 去修 Orchestration runtime。

#### generate-draft-map

只允许进入 map-authoring，不允许 runtime。

若当前系统没有 map-authoring public contract，返回：

```txt
BLOCKED_MAP_AUTHORING_NOT_IMPLEMENTED
```

不得伪造 draft map 成功。

#### activate-existing-draft

必须检查：

```txt
schema validation
dependency validation
transition closure validation
capability catalog validation
prompt contract validation
platform profile validation
dry-run validation
human approval
```

任一缺失：

```txt
BLOCKED_MAP_VALIDATION_INCOMPLETE
```

#### builtin-seed-map

允许使用内置种子地图，但仍必须走：

```txt
validation
human approval or explicit development approval
activation
activationSnapshotRef generation
```

禁止：

```txt
直接把 builtin map 当 active runtime truth
```

---

## 10. Task Publisher 设计

文件：

```txt
scripts/debug-loop/task-publisher.mjs
```

### 10.1 入口选择

根据 `scenarioKind` 选择入口：

```txt
local-workbench
→ 启动本地程序 / smoke 命令

platform-auth-check
→ 打开平台并检测 page-state/auth

mission-runtime
→ Commander Console public command gate
→ governed mission command
→ Nerve Bus
→ Orchestration

map-authoring
→ governed map authoring public contract

map-validation
→ map validation pipeline

map-activation
→ map activation pipeline
```

### 10.2 严禁行为

Task Publisher 不得：

```txt
直接调用 Orchestration.startMission
直接调用 Orchestration.execute(start-mission)
直接写 mission state
直接选择 latest map
直接写 active registry
直接绕过 Commander Console
直接绕过 Nerve Bus
直接运行 draft map
```

### 10.3 如果 Commander public contract 不存在

必须返回：

```txt
BLOCKED_COMMANDER_ENTRY_MISSING
```

并生成 repair-packet：

```txt
owner = commander-console
requiredFix = expose governed debug-safe command publish path
```

不得绕过 Commander 去调用 Orchestration。

---

## 11. Auth Detector 设计

文件：

```txt
scripts/debug-loop/auth-detector.mjs
```

必须识别：

```txt
login required
not logged in
captcha
security check
checkpoint
two-factor
2fa
account locked
profile invalid
session expired
permission denied
cookie expired
verify you are human
unusual activity
```

分类：

```txt
AUTH_REQUIRED
EXTERNAL_PLATFORM_SECURITY
PROFILE_INVALID
SESSION_EXPIRED
```

命中后：

```txt
不得生成代码修复包
不得让 Codex 修业务代码
不得自动输入账号密码
不得绕过 captcha
不得读 cookies
不得导出 cookies
```

输出：

```txt
BLOCKED_AUTH_REQUIRED
BLOCKED_EXTERNAL_PLATFORM_SECURITY
```

---

## 12. Log Collector 设计

文件：

```txt
scripts/debug-loop/log-collector.mjs
```

必须收集：

```txt
stdout
stderr
runtime jsonl
audit build log
owner audit log
ci full log
runner-summary.json
law-registry.generated.json
enforcement-matrix.generated.json
audit-plan.generated.json
```

如果某日志不存在，必须记录：

```json
{
  "missingLogSources": ["runtime.jsonl"]
}
```

不得把日志缺失当成功。

---

## 13. Log Indexer 设计

文件：

```txt
scripts/debug-loop/log-indexer.mjs
```

必须全量扫描，不得只看最后 200 行。

输出：

```txt
log-index.json
```

结构：

```json
{
  "totalLinesScanned": 0,
  "sourcesScanned": [],
  "missingLogSources": [],
  "firstFatal": null,
  "firstBlocking": null,
  "fatalLines": [],
  "blockingLines": [],
  "authSignals": [],
  "externalPlatformSignals": [],
  "envSignals": [],
  "dependencySignals": [],
  "startupSignals": [],
  "runtimeSignals": [],
  "lawSignals": [],
  "inspectorSignals": [],
  "negativeProofSignals": [],
  "ciSignals": [],
  "mapSignals": [],
  "promptSignals": [],
  "nerveBusSignals": [],
  "forensicsSignals": [],
  "artifactLifecycleSignals": [],
  "codePuritySignals": [],
  "ownerSignals": [],
  "missingChainFields": [],
  "p0Violations": [],
  "successSignals": []
}
```

### 13.1 PASS 不得覆盖 Fatal

如果日志中既有 fatal 又有 PASS：

```txt
fatal 优先
PASS 不得覆盖 fatal
```

除非有明确 recovery proof：

```txt
failure recovered
same failure disappeared after retry
final state success with proof
```

第一阶段不允许复杂 recovery，默认 firstFatal 优先。

---

## 14. Failure Classifier 设计

文件：

```txt
scripts/debug-loop/failure-classifier.mjs
```

必须支持分类：

```txt
PASS
AUTH_REQUIRED
EXTERNAL_PLATFORM_SECURITY
ENV_MISSING
DEPENDENCY_ERROR
STARTUP_ERROR
RUNTIME_ERROR
LAW_SOURCE_ERROR
LAW_CONFLICT
AUDIT_ENFORCEMENT_ERROR
NEGATIVE_PROOF_ERROR
CI_ERROR
MAP_VALIDATION_ERROR
MAP_ACTIVATION_ERROR
MAP_AUTHORING_ERROR
PROMPT_CONTRACT_ERROR
PROMPT_BINDING_ERROR
CAPABILITY_CATALOG_ERROR
NERVE_BUS_ERROR
ABILITY_CONTRACT_ERROR
PROOF_CHAIN_ERROR
OWNER_BOUNDARY_ERROR
FORENSICS_ERROR
ARTIFACT_LIFECYCLE_ERROR
CODE_PURITY_ERROR
BLOCKED_NO_ACTIVE_MAP
BLOCKED_NO_PROMPT_CONTRACT
BLOCKED_MAP_NOT_ACTIVATED
BLOCKED_COMMANDER_ENTRY_MISSING
UNKNOWN
```

### 14.1 优先级

分类优先级必须固定：

```txt
AUTH_REQUIRED / EXTERNAL_PLATFORM_SECURITY
→ ENV_MISSING
→ LAW_CONFLICT
→ LAW_SOURCE_ERROR
→ AUDIT_ENFORCEMENT_ERROR / NEGATIVE_PROOF_ERROR
→ CODE_PURITY_ERROR
→ MAP / PROMPT / CAPABILITY_CATALOG
→ NERVE_BUS
→ OWNER_BOUNDARY
→ PROOF_CHAIN
→ ABILITY_CONTRACT
→ FORENSICS / ARTIFACT_LIFECYCLE
→ RUNTIME_ERROR
→ CI_ERROR
→ UNKNOWN
```

### 14.2 输出结构

必须输出：

```json
{
  "failureCategory": "PROOF_CHAIN_ERROR",
  "owner": "visual-target",
  "severity": "P0",
  "rootCause": "runtimeProof.activationSnapshotRef missing while input has activationSnapshotRef",
  "firstFatal": "VisualTargetRuntimeProof missing activationSnapshotRef",
  "evidenceRefs": [
    ".debug-loop/runs/<id>/iteration-001/runtime.jsonl#L812"
  ],
  "allowedModify": [],
  "forbiddenModify": [],
  "requiredFixType": "SCHEMA_OR_PROOF_FIX",
  "secondaryFindings": []
}
```

---

## 15. Owner Router 设计

文件：

```txt
scripts/debug-loop/owner-router.mjs
```

### 15.1 owner 路由表

必须硬编码：

```txt
commander-console -> src/capabilities/commander-console/**
orchestration -> src/capabilities/orchestration/**
nerve-bus -> src/capabilities/nerve-bus/**
open -> src/capabilities/open/**
page-state -> src/capabilities/page-state/**
screenshot -> src/capabilities/screenshot/**
ai -> src/capabilities/ai/**
visual-target -> src/capabilities/visual-target/**
geometry-guard -> src/capabilities/geometry-guard/**
mouse-click -> src/capabilities/mouse-click/**
mouse-scroll -> src/capabilities/mouse-scroll/**
text-input -> src/capabilities/text-input/**
post-action-verification -> src/capabilities/post-action-verification/**
forensics-persistence -> src/capabilities/forensics-persistence/**
map-plugin-package -> src/map-plugins/**
code-purity -> scripts/audit/domains/code-purity/**
audit-system -> scripts/audit/**
debug-loop-controller -> scripts/debug-loop/**
```

### 15.2 allowedModify

根据 owner 生成 allowedModify。

例如：

```json
{
  "owner": "visual-target",
  "allowedModify": [
    "src/capabilities/visual-target/**",
    "scripts/audit/domains/visual-target-capability/**"
  ]
}
```

### 15.3 forbiddenModify

必须默认禁止：

```txt
.github/instructions/cursor-rules/modules/** unless failureCategory is LAW_SOURCE_ERROR
scripts/audit/generated/** manual edit
src/capabilities/<other-owner>/**
```

---

## 16. Repair Packet Writer 设计

文件：

```txt
scripts/debug-loop/repair-packet-writer.mjs
```

必须生成：

```txt
repair-packet.json
repair-packet.md
```

### 16.1 repair-packet.json

结构：

```json
{
  "debugSessionId": "debug-2026-05-03-001",
  "iteration": 1,
  "scenarioId": "facebook-product-video-runtime",
  "failureCategory": "PROOF_CHAIN_ERROR",
  "owner": "visual-target",
  "severity": "P0",
  "firstFatal": "VisualTargetRuntimeProof missing activationSnapshotRef",
  "evidenceRefs": [],
  "rootCause": "",
  "allowedModify": [],
  "forbiddenModify": [],
  "requiredFix": [],
  "requiredCommands": [],
  "stopRule": ""
}
```

### 16.2 repair-packet.md 必须包含

```txt
Debug Session
Scenario
Failure Category
Owner
Evidence
Root Cause
Allowed Modify
Forbidden Modify
Required Fix
Required Commands
Stop Rule
Forbidden Actions
```

### 16.3 Codex 修复必须只读 repair-packet

Codex 后续修复提示词必须只需要：

```txt
请读取 repair-packet.md 并按其修复。
```

---

## 17. Verifier 设计

文件：

```txt
scripts/debug-loop/verifier.mjs
```

必须运行：

```txt
npm run audit:build
npm run audit:<owner> if exists
npm run ci:full
npm run debug:scenario -- --scenario <scenarioId>
```

### 17.1 owner audit 命令解析

`package-script-resolver.mjs` 必须从 `package.json` 读取 scripts。

如果存在：

```txt
audit:visual-target
audit:geometry-guard
audit:mouse-click
...
```

则必须运行。

如果不存在，但 owner 是能力组或治理域：

```txt
failureCategory = AUDIT_ENFORCEMENT_ERROR
rootCause = owner audit command missing
```

不得跳过。

### 17.2 验证输出

写入：

```txt
verification-result.json
```

结构：

```json
{
  "auditBuild": "PASS|FAIL|SKIPPED",
  "ownerAudit": "PASS|FAIL|MISSING",
  "negativeProof": "PASS|FAIL|UNKNOWN",
  "ciFull": "PASS|FAIL",
  "runtimeScenario": "PASS|FAIL|BLOCKED",
  "runnerSummaryIncludesOwner": true,
  "remainingP0": [],
  "verdict": "PASS|NOT_PASS|BLOCKED"
}
```

---

## 18. Decision Engine 设计

文件：

```txt
scripts/debug-loop/decision-engine.mjs
```

允许输出：

```txt
PASS
CONTINUE
BLOCKED_AUTH_REQUIRED
BLOCKED_EXTERNAL_PLATFORM_SECURITY
BLOCKED_ENV_MISSING
BLOCKED_LAW_CONFLICT
BLOCKED_NO_ACTIVE_MAP
BLOCKED_NO_PROMPT_CONTRACT
BLOCKED_MAP_NOT_ACTIVATED
BLOCKED_COMMANDER_ENTRY_MISSING
REJECT_REPAIR
NO_PROGRESS_AFTER_3_IDENTICAL_FAILURES
```

### 18.1 PASS 条件

必须全部满足：

```txt
scenario PASS
owner audit PASS
negative proof PASS
CI FULL PASS
no auth blocker
no P0 runtime error
runner-summary includes owner inspector when owner exists
```

### 18.2 BLOCK 条件

```txt
AUTH_REQUIRED
EXTERNAL_PLATFORM_SECURITY
ENV_MISSING
LAW_CONFLICT
NO_ACTIVE_MAP
NO_PROMPT_CONTRACT
MAP_NOT_ACTIVATED
COMMANDER_ENTRY_MISSING
NO_PROGRESS_AFTER_3_IDENTICAL_FAILURES
```

### 18.3 CONTINUE 条件

```txt
存在明确 owner
存在 allowedModify
存在 repair-packet
不是鉴权/外部平台/缺地图阻塞
```

---

## 19. Git Guard 设计

文件：

```txt
scripts/debug-loop/git-guard.mjs
```

### 19.1 运行前

必须记录：

```txt
git status --short
git rev-parse HEAD
git diff --name-only
```

写入：

```txt
git-state.json
```

### 19.2 修复后验证

如果 `--continue` 模式，必须读取上一轮 repair-packet，并检查：

```txt
changed files 是否都在 allowedModify 内
是否修改了 forbiddenModify
是否修改 generated 文件伪造 PASS
是否降低法案
是否删除 inspector
是否删除 negative proof
```

违规：

```txt
REJECT_REPAIR
```

### 19.3 generated 文件规则

允许：

```txt
scripts/audit/generated/** 由 npm run audit:build 生成后变化
```

禁止：

```txt
Codex 手动编辑 generated 文件来伪造 PASS
```

第一阶段实现方式：

```txt
如果 generated 文件在 audit:build 前已经变更，标记 suspiciousGeneratedEdit=true。
```

---

## 20. Law Enforcement Reader 设计

文件：

```txt
scripts/debug-loop/law-enforcement-reader.mjs
```

必须读取：

```txt
scripts/audit/generated/law-registry.generated.json
scripts/audit/generated/enforcement-matrix.generated.json
scripts/audit/generated/audit-plan.generated.json
scripts/audit/generated/runner-summary.json
```

必须检查：

```txt
active law exists
active law has matrix entry
P0/P1 has inspector coverage
owner inspector exists in audit-plan
runner-summary includes owner
negative proof executed where required
no warning-only P0
no generated fake PASS
```

如缺失：

```txt
AUDIT_ENFORCEMENT_ERROR
```

---

## 21. Command Runner 设计

文件：

```txt
scripts/debug-loop/command-runner.mjs
```

必须提供统一命令执行函数：

```txt
runCommand(command, args, options)
```

必须记录：

```txt
command
args
cwd
envWhitelist
startTime
endTime
durationMs
exitCode
stdoutPath
stderrPath
timedOut
```

必须支持 timeout。

命令失败不得抛出未捕获异常，必须返回 structured result。

---

## 22. 四方攻击防护

Debug Loop Controller 必须经受以下四方攻击。

---

### 22.1 外部平台攻击

攻击：

```txt
未登录
captcha
security checkpoint
profile invalid
session expired
rate limit
Facebook/TikTok 页面变化
```

必须表现：

```txt
识别 AUTH_REQUIRED / EXTERNAL_PLATFORM_SECURITY
不生成代码修复包
不让 Codex 修业务代码
不绕过平台
不自动输入账号密码
不读 cookie
```

---

### 22.2 Codex 补丁攻击

攻击：

```txt
Codex 修改无关 owner
降低法案
关闭 inspector
删除 negative proof
手改 generated
加入 fallback / compat bridge
扩大 src/lib 垃圾桶
绕过 Commander / Nerve Bus
```

必须表现：

```txt
git diff 检查 allowedModify
forbiddenModify 命中则 REJECT_REPAIR
law 降级则 REJECT_REPAIR
inspector 删除则 REJECT_REPAIR
negative proof 删除则 REJECT_REPAIR
generated fake pass 则 REJECT_REPAIR
```

---

### 22.3 日志污染攻击

攻击：

```txt
日志超长
first fatal 在前面
后面出现 PASS
多 owner 同时报错
stdout/stderr/runtime.jsonl 不一致
缺关键链路字段
```

必须表现：

```txt
全量扫描
firstFatal 优先
PASS 不得覆盖 fatal
记录 evidenceRefs
输出 secondaryFindings
missing chain fields -> PROOF_CHAIN_ERROR
```

---

### 22.4 验收漂移攻击

攻击：

```txt
owner audit 没跑
negative proof 没跑
CI 没跑
debug scenario 没重跑
law 没进 registry
runner-summary 没 owner inspector
```

必须表现：

```txt
任一缺失 NOT_PASS
不能因为 Codex 声称完成而 PASS
```

---

## 23. 必须识别的链路字段缺失

日志或 proof 中缺这些字段时，必须分类为：

```txt
PROOF_CHAIN_ERROR
```

关键字段：

```txt
missionId
runId
sessionId
stepId
mapPackageId
mapPackageVersion
selectedMapId
selectedMapVersion
activationSnapshotRef
capabilityCallId
nerveBusEnvelopeId
abilityGroupId
childCapabilityId
inputRef
outputRef
runtimeProof
```

不同 owner 可有不同必填字段，但 Debug Loop 必须把缺失记录到：

```txt
log-index.json.missingChainFields
```

---

## 24. 不同失败类型的修复路由

### 24.1 AUTH_REQUIRED

```txt
decision = BLOCKED_AUTH_REQUIRED
repair-packet = not generated
message = user must manually login real Chrome profile
```

### 24.2 BLOCKED_NO_ACTIVE_MAP

```txt
decision = BLOCKED_NO_ACTIVE_MAP
repair-packet = optional informational packet
owner = map-plugin-package
requiredNextScenario = map-authoring or map-activation
```

不得修 Orchestration runtime。

### 24.3 LAW_SOURCE_ERROR

```txt
owner = corresponding law domain
allowedModify:
  .github/instructions/cursor-rules/modules/<module>.md
  docs/法案辅助文件/**
  scripts/audit/domains/<owner>/**
```

### 24.4 AUDIT_ENFORCEMENT_ERROR

```txt
owner = audit-system or corresponding owner audit domain
allowedModify:
  scripts/audit/domains/<owner>/**
  package.json audit scripts
```

### 24.5 ABILITY_CONTRACT_ERROR

```txt
owner = corresponding ability
allowedModify:
  src/capabilities/<owner>/**
  scripts/audit/domains/<owner>-capability/**
```

### 24.6 OWNER_BOUNDARY_ERROR

```txt
allowedModify:
  boundary adapter / public contract only
forbidden:
  strengthening wrong owner
  adding bridge to preserve illegal path
```

---

## 25. Codex 修复提示词模板

Debug Loop Controller 生成的 `repair-packet.md` 后，用户给 Codex 的提示词只需要：

```md
请严格按照以下 repair-packet 修复：

<粘贴 repair-packet.md>

要求：
1. 只修改 allowedModify。
2. 禁止修改 forbiddenModify。
3. 禁止降低法案。
4. 禁止关闭 inspector。
5. 禁止删除 negative proof。
6. 禁止手改 generated 伪造 PASS。
7. 修复后运行 repair-packet 中 requiredCommands。
8. requiredCommands 完成后，继续运行：
   npm run debug:loop -- --scenario <scenarioId> --continue
9. 唯一停止条件：debug:loop PASS + CI FULL PASS。
```

---

## 26. Debug Loop Controller 自身验收

Codex 建完本程序后，必须运行：

```bash
npm run debug:loop -- --scenario local-workbench-smoke --maxIterations 1
npm run debug:loop -- --scenario facebook-auth-check --maxIterations 1
npm run debug:loop -- --scenario tiktok-auth-check --maxIterations 1
npm run ci:full
```

### 26.1 可接受结果

如果 Facebook/TikTok 未登录，允许：

```txt
BLOCKED_AUTH_REQUIRED
```

但必须分类正确。

不允许：

```txt
RUNTIME_ERROR
UNKNOWN
PASS
```

除非真实 auth OK。

### 26.2 local-workbench-smoke

必须至少输出：

```txt
debug session path
log-index.json
failure-classification.json
repair-packet.md or PASS decision
decision.json
```

如果本地程序本身启动失败，应分类为：

```txt
STARTUP_ERROR
DEPENDENCY_ERROR
ENV_MISSING
```

不得 UNKNOWN，除非确实无法分类，并且要给 evidenceRefs。

---

## 27. 最终交付格式

Codex 完成后必须输出：

```txt
[DEBUG-LOOP-CONTROLLER-BUILD-RESULT]

1. CREATED FILES
- ...

2. PACKAGE SCRIPTS
- debug:loop:
- debug:scenario:
- debug:classify:
- debug:verify:

3. SCENARIOS CREATED
- local-workbench-smoke:
- facebook-auth-check:
- tiktok-auth-check:
- facebook-product-video-runtime:
- tiktok-product-video-runtime:

4. COMMANDS RUN
- npm run debug:loop -- --scenario local-workbench-smoke --maxIterations 1:
- npm run debug:loop -- --scenario facebook-auth-check --maxIterations 1:
- npm run debug:loop -- --scenario tiktok-auth-check --maxIterations 1:
- npm run ci:full:

5. SAMPLE DEBUG SESSION
- path:
- decision:
- classification:
- repair-packet:

6. 4-SIDE ATTACK PROTECTION
- external platform:
- Codex patch:
- log pollution:
- acceptance drift:

7. REMAINING ISSUES
- NONE or explicit BLOCKED reason

8. FINAL VERDICT
- PASS / NOT_PASS
```

---

## 28. 绝对禁止

Codex 建设 Debug Loop Controller 时禁止：

```txt
新增第 15 个能力组
把 debug-loop 放进 src/capabilities
绕过 Commander
绕过 Nerve Bus
直接调用 Orchestration.startMission
直接写 mission state
直接写 active map registry
运行 draft map
自动输入账号密码
绕过 captcha
读取/导出 cookies
降低法案
关闭 inspector
删除 negative proof
手改 generated 伪造 PASS
把 UNKNOWN 当 PASS
把 AUTH_REQUIRED 当代码问题
把无 active map 当 Orchestration bug
```

---

## 29. 第一阶段建设范围边界

第一阶段必须真实完成：

```txt
debug-loop 基础目录
scenario 读取
command 执行
日志收集
日志索引
鉴权检测
失败分类
owner 路由
repair-packet 生成
verifier 基础命令
decision engine
git guard 基础检查
local-workbench-smoke scenario
facebook-auth-check scenario
tiktok-auth-check scenario
mission-runtime scenario 配置
```

第一阶段可以只做结构支持，不要求完整实现：

```txt
AI 高级生成地图
map-authoring 完整闭环
map-activation 完整闭环
codex-cli 自动修复
```

但必须能够正确返回：

```txt
BLOCKED_MAP_AUTHORING_NOT_IMPLEMENTED
BLOCKED_NO_ACTIVE_MAP
BLOCKED_MAP_NOT_ACTIVATED
```

不得伪造成功。

---

## 30. 第二阶段预留接口

Debug Loop Controller 必须为后续第二个方案预留接口：

```txt
用户需求 + 高级 AI 地图生成
```

预留模块：

```txt
map-resolver.mjs
scenarioKind=map-authoring
scenarioKind=map-validation
scenarioKind=map-activation
```

但第一阶段不得把 AI 生成地图硬塞进 runtime。

正确关系：

```txt
Debug Loop Controller 负责发现“没有 active map”
第二阶段地图生成系统负责生成 draft map
Map Plugin Package validator 负责验证
Commander / human approval 负责批准
Orchestration 只运行 frozen active approved map
```

---

## 31. 最终原则

```txt
一个 Debug Loop Controller。
多个 scenario。
一个 Map Resolver。
一个 Task Publisher。
一个 Failure Classifier。
一个 Repair Packet Writer。
一个 Verifier。
一个 Decision Engine。
```

它必须能够调试：

```txt
本地启动
平台鉴权
Facebook runtime
TikTok runtime
地图缺失
Prompt 缺失
法案缺失
执法缺失
能力组 contract 错误
proof chain 错误
CI 错误
```

它不能替代能力组。
它不能替代 Orchestration。
它不能替代 Commander。
它不能替代 Map Plugin Package。
它只能做一件事：

```txt
把真实运行问题转化成可执行、可验证、不会乱飞的 Codex repair-packet。
```

---

## 32. Codex 最终执行指令

Codex 收到本文件后，必须按以下顺序执行：

```txt
1. READ required files.
2. Create scripts/debug-loop directory and modules.
3. Add package.json scripts.
4. Create scenario JSON files.
5. Implement command runner.
6. Implement log collector.
7. Implement log indexer.
8. Implement auth detector.
9. Implement failure classifier.
10. Implement owner router.
11. Implement repair packet writer.
12. Implement verifier.
13. Implement decision engine.
14. Implement git guard.
15. Implement map resolver.
16. Implement scenario runner.
17. Implement run-debug-loop controller.
18. Run local-workbench-smoke.
19. Run facebook-auth-check.
20. Run tiktok-auth-check.
21. Run ci:full.
22. Output final build result.
```

唯一交付标准：

```txt
debug-loop 能真实生成 debug session
能正确分类至少一种 PASS/BLOCK/FAIL
能生成 repair-packet
能执行 verifier
能防止 auth 问题误修代码
能防止无地图误修 runtime
能防止 Codex 越权修改
CI-FULL PASS
```

---

# END OF FILE
