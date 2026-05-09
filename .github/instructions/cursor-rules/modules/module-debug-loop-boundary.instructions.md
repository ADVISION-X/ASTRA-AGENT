---
name: "GrassEye Debug Loop Boundary"
description: "Use when governing debug-loop scripts, scenario runners, repair packet generation, log observers, auth/environment preflight, map-authoring debug harnesses, and the boundary that prevents debug-loop from becoming a second Agent, second Orchestration, second ability runtime, second Forensics writer, second map interpreter, or direct browser action executor."
applyTo: "scripts/debug-loop/**, docs/法案辅助文件/GrassEye Debug Loop Boundary 调试程序边界施工图.md, scripts/audit/domains/debug-loop-boundary/**, package.json"
---

# GrassEye Debug Loop Boundary

## 0. Module Identity

Scope: governs debug-loop scripts, scenario definitions, scenario runners, task publishers, log observers, repair packet writers, failure classifiers, auth/environment preflight checks, map-authoring debug harnesses, and audit enforcement that keeps debug-loop as a human-operator substitute rather than a production Agent substitute.

Boundary: debug-loop is local development tooling. It is not one of the 14 active ability groups. It is not a production runtime owner. It is not Orchestration. It is not Nerve Bus. It is not any primitive ability. It is not Forensics Persistence. It is not Map Plugin Package. It is not AI provider execution. It is not a browser automation runtime for mission actions.

Authority: this law defines the red line between "debug-loop as operator harness" and "debug-loop as second Agent." If this law conflicts with older debug-loop scripts or notes, this law wins.

Core doctrine:

```txt
debug-loop = replaces the human operator around the Agent
debug-loop != replaces the production Agent
```

Allowed identity:

```txt
debug-loop may choose a scenario.
debug-loop may construct a human-like task request.
debug-loop may call Commander public contract.
debug-loop may call map-authoring public contract.
debug-loop may read active map binding through governed read model.
debug-loop may start mission through Commander.
debug-loop may observe runtime logs/events/proofs.
debug-loop mission-runtime must publish through Commander AND THEN observe governed mission terminal status through dashboard/runtime events; observer timeout is only a deadlock guard and must not become production mission failure.
debug-loop may classify failure.
debug-loop may write repair packets for Codex.
debug-loop may perform auth/environment preflight under explicit preflight mode.
```

Forbidden identity:

```txt
debug-loop must not execute ability-group actions.
debug-loop must not interpret operational-map steps as a runtime.
debug-loop must not dispatch Nerve Bus messages for mission actions.
debug-loop must not click/type/scroll/capture/analyze the production page during mission runtime.
debug-loop must not write Forensics evidence packets as production proof.
debug-loop must not write active map registry or activation snapshots directly.
debug-loop must not mutate Orchestration mission state.
debug-loop must not bypass Commander, Nerve Bus, Orchestration, PAV, Forensics, or map-plugin lifecycle.
debug-loop must not treat `show-mission-dashboard` observer timeout as mission failure after command acceptance.
```

All active laws below are:

```yaml
status: active
tier: P0
capabilityDomain: debug-loop-boundary
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection
```

Required audit domain:

```txt
scripts/audit/domains/debug-loop-boundary/
├── manifest.json
├── inspector.ts
├── run-inspector.ts
└── owner-inspection-harness.ts
```

---

## Four-Angle Exclusion Model

The debug-loop boundary must be defended from at least four angles:

### Angle 1: Runtime Execution Exclusion

Debug-loop must not become a second ability runtime.

It must not:
- call primitive ability executors directly.
- call browser page action methods for mission runtime.
- execute map steps.
- evaluate branch conditions for production mission progress.
- claim runtime step success.

### Angle 2: Authority / Lifecycle Exclusion

Debug-loop must not become a second Commander, Orchestration, or Map Plugin lifecycle owner.

It must not:
- write active registry.
- create fake activation snapshots.
- bypass validation/approval/activation.
- mutate mission state.
- issue Nerve Bus action envelopes directly.
- approve high-risk user actions.

### Angle 3: Evidence / Proof Exclusion

Debug-loop must not become a second Forensics writer.

It must not:
- write production evidence packet truth.
- fabricate proof refs.
- claim that action happened.
- store raw secrets/cookies/prompts/sensitive text as proof.
- use its own observations as production proof.

### Angle 4: Browser / Platform Operation Exclusion

Debug-loop must not become direct platform automation.

It must not:
- click/type/scroll/screenshot/analyze production page as part of mission runtime.
- use Playwright/Puppeteer/Chrome controller to perform mission actions.
- use direct DOM/BOM selectors to bypass visual Agent flow.
- perform login bypass, cookie export, or security circumvention.

Allowed exception:
- auth/environment preflight may use browser/controller under explicit `platform-auth-check` or `environment-preflight` mode only.
- preflight may check login/security/readiness state, but must not perform mission actions, map steps, evidence capture, product classification, comments, likes, purchases, or messages.

### Angle 5: AI / Map Authoring Exclusion

Debug-loop may help exercise map-authoring public contracts, but must not become a hidden AI runtime or map lifecycle bypass.

It may:
- build Map Authoring Input Package.
- write map-authoring prompt artifact.
- request Codex/manual draft map generation during fake provider mode.
- call map-plugin validation/activation public contract.

It must not:
- bypass map validation.
- mark draft map active directly.
- forge approval/activation proof.
- execute the draft map itself.
- interpret the map as runtime.

---

## Law GRASSEYE-DEBUG-LOOP-BOUNDARY-001-V1

status: active  
tier: P0  
capabilityDomain: debug-loop-boundary  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: debug-loop is local development tooling and must not be registered as an active ability group, runtime owner, or production capability owner.

### 主题

调试程序身份边界

### 法条

Debug-loop is local development tooling. It replaces the human operator around the Agent, not the Agent.

Required:
- debug-loop must be classified as local development tooling.
- debug-loop must not appear in active ability group list.
- debug-loop must not appear as a production runtime owner.
- debug-loop audit domain may exist only as a governance/audit owner.
- debug-loop may publish tasks through Commander public contract.
- debug-loop may observe logs/events/proofs.
- debug-loop may write repair packets.
- debug-loop may run auth/environment preflight only under explicit preflight mode.

Forbidden:
- debug-loop as ability group.
- debug-loop as child capability.
- debug-loop as Orchestration owner.
- debug-loop as Nerve Bus channel owner.
- debug-loop as Forensics production writer.
- debug-loop as map-plugin lifecycle owner.
- debug-loop as browser action runtime.
- debug-loop as AI provider owner.

Required inspector:
- debug-loop not in active ability groups.
- debug-loop not in capability-group registry.
- debug-loop not in phase gate as runtime owner.
- debug-loop not in generated active law domains except audit-only boundary domain.
- debug-loop package scripts do not publish it as production runtime.

Required real-code-inspection:
- Add debug-loop to active ability group list → FAIL.
- Add debug-loop as child capability → FAIL.
- Add debug-loop as runtime owner in generated artifacts → FAIL.
- Add debug-loop as Forensics writer owner → FAIL.

---

## Law GRASSEYE-DEBUG-LOOP-BOUNDARY-002-V1

status: active  
tier: P0  
capabilityDomain: debug-loop-boundary  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: debug-loop may start missions only through Commander public contract and must not directly dispatch Nerve Bus, Orchestration, or ability actions.

### 主题

任务发布入口边界

### 法条

Debug-loop may start a mission only by acting like a user/operator through Commander public contract.

Allowed:
- call Commander public contract such as `issue-human-command` / `start-mission`.
- pass humanGoal, scenarioId, map binding refs, and run limits.
- observe mission result via logs/read models.

Forbidden:
- direct Orchestration mission-state regression.
- direct Orchestration step execution.
- direct Nerve Bus dispatch for mission actions.
- direct ability executor call.
- direct map step loop execution.
- direct branch condition evaluation for mission progress.
- debug-loop generated `capabilityCallId` as production truth.
- debug-loop claiming step success.

Required inspector:
- scripts/debug-loop/** import graph bans direct Orchestration runtime internals.
- scripts/debug-loop/** import graph bans direct Nerve Bus dispatch internals.
- scripts/debug-loop/** import graph bans direct ability executor imports.
- task publisher uses Commander public entry only.
- no map-step interpreter in debug-loop.

Required real-code-inspection:
- debug-loop imports Orchestration dispatcher → FAIL.
- debug-loop imports Nerve Bus dispatcher → FAIL.
- debug-loop directly calls mouse-click/text-input/screenshot executors → FAIL.
- debug-loop iterates `operationalMap.steps` and executes step actions → FAIL.
- debug-loop writes mission state directly → FAIL.

---

## Law GRASSEYE-DEBUG-LOOP-BOUNDARY-003-V1

status: active  
tier: P0  
capabilityDomain: debug-loop-boundary  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: debug-loop must not execute direct browser/page/platform operations during mission runtime.

### 主题

真实页面操作边界

### 法条

All real mission page operations must be performed by production Agent ability groups through Commander → Nerve Bus → Orchestration → Ability Groups → PAV → Forensics.

Debug-loop must not directly operate production pages during mission runtime.

Forbidden in mission-runtime mode:
- direct browser/page click.
- direct keyboard/type/fill/press.
- direct mouse scroll/wheel.
- direct screenshot capture as production evidence.
- direct DOM/BOM selector action.
- direct Playwright/Puppeteer page action.
- direct Chrome controller page action.
- direct product-video classification.
- direct comment typing or posting.
- direct like/message/purchase/submit actions.

Allowed exception:
- `platform-auth-check` / `environment-preflight` may use browser/controller to check login/security/environment readiness.
- preflight must not perform mission actions or production evidence capture.
- preflight outputs are environment status, not production proof.

Required inspector:
- mission-runtime debug-loop files cannot import browser controllers.
- mission-runtime debug-loop files cannot call page.click/page.fill/page.type/page.keyboard/page.mouse/page.screenshot/page.evaluate for mission action.
- direct action APIs allowed only in preflight files with explicit allowlisted scenario kind.
- debug-loop scenario definitions must mark mode: platform-auth-check/environment-preflight for controller use.

Required real-code-inspection:
- mission-runtime file imports CurrentChromeBrowserController → FAIL.
- mission-runtime file calls page.click → FAIL.
- mission-runtime file calls page.screenshot → FAIL.
- mission-runtime file calls page.evaluate to inspect DOM for action → FAIL.
- platform-auth-check performs click/type/comment action → FAIL.

---

## Law GRASSEYE-DEBUG-LOOP-BOUNDARY-004-V1

status: active  
tier: P0  
capabilityDomain: debug-loop-boundary  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: debug-loop must not write production Forensics proof, evidence packets, activation snapshots, or active registry truth.

### 主题

证据与状态写入边界

### 法条

Debug-loop may collect and copy logs as repair evidence, but must not write production proof truth.

Allowed:
- read runtime logs.
- read Forensics read models.
- copy artifact refs into repair packet.
- write debug-loop repair packet.
- write debug-loop analysis summary.

Forbidden:
- write production evidence packet.
- write production Forensics ledger truth.
- write production proof refs.
- forge capabilityCallId proof.
- forge aiProofRef.
- forge PAV proof.
- write activationSnapshotRef.
- write active map registry.
- write validationReportRef/humanApprovalRef/activationProofRef directly.
- mark action success based on debug-loop observation.
- store raw cookies, API keys, raw prompt bodies, raw sensitive text, raw clipboard content.

Required inspector:
- debug-loop does not import Forensics writers.
- debug-loop does not write active registry paths.
- debug-loop does not write activation snapshot paths.
- debug-loop writes only under debug-loop artifact/repair directories.
- no raw secret/cookie/prompt/sensitive text in repair packet.

Required real-code-inspection:
- debug-loop imports Forensics writer → FAIL.
- debug-loop writes evidencePacketRef as production proof → FAIL.
- debug-loop writes active registry → FAIL.
- debug-loop writes activationSnapshotRef → FAIL.
- debug-loop stores raw cookie/API key in repair packet → FAIL.

---

## Law GRASSEYE-DEBUG-LOOP-BOUNDARY-005-V1

status: active  
tier: P0  
capabilityDomain: debug-loop-boundary  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: debug-loop map-authoring harness may create input/prompt artifacts but must not bypass map-plugin lifecycle or execute generated maps.

### 主题

地图生成调试边界

### 法条

Debug-loop may exercise map-authoring public contracts, including fake provider mode, but cannot become a map lifecycle bypass or map runtime.

Allowed:
- build Map Authoring Input Package through governed public API.
- write map-authoring prompt artifact.
- write map-authoring input package artifact.
- ask Codex/manual process to generate draft map from prompt artifact in fake provider mode.
- call map-plugin import/quarantine/validation/approval/activation public contract.
- read activation binding through active registry read model.

Forbidden:
- direct write active registry.
- direct write validationReportRef/humanApprovalRef/activationProofRef.
- direct active status regression.
- execute draft map.
- interpret operationalMap steps as runtime.
- bypass validation.
- forge activationSnapshotRef.
- treat example map as active.
- mark map validation passed without validator output.

Required inspector:
- fake authoring mode writes artifacts only.
- generated map must enter map-plugin lifecycle.
- activation must use public contract.
- debug-loop does not execute operational map.
- debug-loop does not mutate map status directly.

Required real-code-inspection:
- fake authoring directly writes active registry → FAIL.
- fake authoring marks draft map active → FAIL.
- fake authoring executes operationalMap steps → FAIL.
- fake authoring forges activationSnapshotRef → FAIL.
- fake authoring skips validation → FAIL.

---

## Law GRASSEYE-DEBUG-LOOP-BOUNDARY-006-V1

status: active  
tier: P0  
capabilityDomain: debug-loop-boundary  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: debug-loop scenario files describe user/operator intent and success/failure signals; they must not contain executable ability logic or direct platform automation logic.

### 主题

Scenario 数据边界

### 法条

Scenario files are declarative operator tasks. They are not map packages, not runtime code, not browser scripts, and not ability executors.

Allowed scenario fields:
```txt
scenarioId
scenarioKind
description
humanGoal
platformId
entryMode
mapRequirement
authPreflight
successSignals
blockingSignals
maxRuntimeMs
repairPolicy
expectedArtifacts
```

Forbidden scenario fields:
```txt
clickSelector
typeText
scrollScript
screenshotSelector
pageEvaluate
domQuery
browserAction
abilityCall
capabilityExecutor
nerveBusDispatch
orchestrationStep
forensicsWrite
activationWrite
rawCookie
apiKey
rawSecret
autoPostComment
autoLike
autoMessage
autoPurchase
```

Required:
- scenario may express desired task outcome, not how to execute page operations.
- scenario may require production Agent to produce artifacts, not produce artifacts itself.
- high-risk desired actions must require automated policy gates in scenario policy.

Required inspector:
- JSON traversal of scenario files.
- forbidden executable fields blocked.
- scenarioKind controls allowed preflight fields.
- high-risk action scenario must include automated gate requirement.

Required real-code-inspection:
- scenario contains clickSelector → FAIL.
- scenario contains pageEvaluate → FAIL.
- scenario contains abilityCall → FAIL.
- scenario contains forensicsWrite → FAIL.
- scenario contains autoPostComment=true → FAIL.

---

## Law GRASSEYE-DEBUG-LOOP-BOUNDARY-007-V1

status: active  
tier: P0  
capabilityDomain: debug-loop-boundary  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: debug-loop repair packets are diagnostic artifacts and must not become code, proof, policy, or runtime truth.

### 主题

Repair Packet 诊断边界

### 法条

Repair packets are diagnostic artifacts for Codex. They are not production proof, not policy, not law, not runtime state, and not code execution.

Allowed:
- include failure category.
- include log refs.
- include artifact refs.
- include suspected owner.
- include law/blueprint refs.
- include reproduction command.
- include safe excerpts/redacted summaries.
- include suggested files to inspect.

Forbidden:
- include raw secrets/cookies/API keys.
- include raw sensitive user text when policy forbids.
- include raw prompt body when proof should use prompt refs/hashes.
- include executable patch script.
- auto-apply code changes.
- directly modify production source.
- mark issue resolved.
- write generated audit artifacts manually.
- write production proof refs.

Required inspector:
- repair packet writer only writes under debug-loop repair artifact path.
- repair packet schema forbids raw secret/prompt/sensitive fields.
- repair packet cannot execute code or apply patch.
- repair packet cannot write production source.

Required real-code-inspection:
- repair packet contains raw cookie → FAIL.
- repair packet contains API key → FAIL.
- repair packet includes executable patch script → FAIL.
- repair packet writer modifies src/** → FAIL.
- repair packet writer modifies scripts/audit/generated/** manually → FAIL.

---

## Law GRASSEYE-DEBUG-LOOP-BOUNDARY-008-V1

status: active  
tier: P0  
capabilityDomain: debug-loop-boundary  
enforcementMode: machine-blocking  
evidenceMode: law+blueprint+real-code-inspection

summary: debug-loop boundary must be machine-enforced by owner-local inspector, real-code-inspection, and package scripts.

### 主题

Debug Loop Boundary 执法闭环

### 法条

The debug-loop boundary must be enforced by an owner-local audit domain.

Required files:
```txt
scripts/audit/domains/debug-loop-boundary/manifest.json
scripts/audit/domains/debug-loop-boundary/inspector.ts
scripts/audit/domains/debug-loop-boundary/run-inspector.ts
scripts/audit/domains/debug-loop-boundary/owner-inspection-harness.ts
```

Required CI-FULL/internal command:
```txt
node --import tsx scripts/audit/domains/debug-loop-boundary/run-inspector.ts
```

Required inspector coverage:
1. debug-loop is not an active ability group.
2. debug-loop is not a production runtime owner.
3. debug-loop mission-runtime cannot import ability executors.
4. debug-loop mission-runtime cannot import Orchestration runtime internals.
5. debug-loop mission-runtime cannot import Nerve Bus dispatch internals.
6. debug-loop mission-runtime cannot import browser controller or page action APIs.
7. direct page action APIs are limited to platform-auth-check/environment-preflight.
8. scenario JSON files contain no executable browser/action fields.
9. debug-loop cannot write active registry or activation snapshots.
10. debug-loop cannot import Forensics production writers.
11. repair packets contain no raw secrets/cookies/prompts/sensitive text.
12. fake map authoring cannot bypass map lifecycle.
13. debug-loop can start missions only through Commander public contract.
14. all real-code-inspections execute.
15. P0 findings are machine-blocking, not warning-only.

Forbidden enforcement shortcuts:
- grep-only final judgment.
- regex-only final judgment.
- warning-only P0.
- detached inspector.
- empty real-code-inspection.
- generated fake PASS.
- manual-only proof.

Required real-code-inspection:
```txt
add debug-loop as ability group
debug-loop imports mouse-click executor
debug-loop imports text-input executor
debug-loop imports screenshot executor
debug-loop imports Orchestration dispatcher
debug-loop imports Nerve Bus dispatcher
mission-runtime imports browser controller
mission-runtime calls page.click
mission-runtime calls page.screenshot
scenario contains clickSelector
scenario contains autoPostComment=true
debug-loop imports Forensics writer
debug-loop writes active registry
debug-loop writes activationSnapshotRef
debug-loop writes raw cookie to repair packet
fake authoring marks draft map active
fake authoring skips validation
turn P0 into warning-only
remove real-code-inspection invocation
```

Final readiness:
```txt
debug-loop-boundary law installed
debug-loop-boundary blueprint installed
CI-FULL debug-loop-boundary owner step exists
inspector PASS
real-code-inspection PASS
ci:full PASS
debug-loop remains operator harness only
production Agent remains sole runtime executor
```
