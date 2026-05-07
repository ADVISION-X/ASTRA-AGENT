# GrassEye Debug Loop Boundary 调试程序边界施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-DEBUG-LOOP-BOUNDARY-BLUEPRINT-FINAL
documentType: construction-blueprint
owner: debug-loop-boundary
ownerType: local-development-tooling-governance
status: active
lawAuthority: module-debug-loop-boundary.instructions.md
notAbilityGroup: true
notRuntimeOwner: true
notSecondAgent: true
```

本施工图定义 GrassEye 调试程序边界。  
核心原则：

```txt
调试程序 = 代替人工使用 Agent
调试程序 != 第二套 Agent
```

---

## 1. 为什么必须有这个边界

如果 debug-loop 自己执行点击、截图、AI 判断、滚动、输入、写 Forensics，那么调试通过并不代表生产 Agent 通过。

这会产生假绿：

```txt
debug-loop 跑通了
但 Commander / Nerve Bus / Orchestration / Ability Groups / PAV / Forensics 没有真正跑通
```

因此 debug-loop 只能作为 operator harness：

```txt
发任务
看日志
看证据
分类失败
生成 repair packet
```

不能作为 runtime harness：

```txt
执行动作
解释地图
推进任务
写生产证据
操作页面
```

---

## 2. 四方排除法

### 2.1 Runtime Execution 排除

debug-loop 不得成为第二套能力运行时。

禁止：
```txt
直接调用 mouse-click / text-input / screenshot / visual-target / geometry-guard / mouse-scroll / PAV executor
直接执行 operationalMap.steps
直接判断 branch
直接生成 capabilityCallId 作为生产 truth
直接声明 step success
```

允许：
```txt
通过 Commander public contract 启动 mission
读取 runtime events
读取 Forensics read model
生成 repair packet
```

mission-runtime 必须采用：

```txt
publish command AND THEN observe terminal runtime/dashboard status
```

也就是：

```txt
先通过 Commander 发布任务
AND THEN 持续观察 governed runtime events / Commander dashboard
直到 mission terminal status
```

observer timeout 只能防死锁，不能在 command accepted 之后写成 mission failed；`show-mission-dashboard` 读取超时只代表本次观察失败，必须继续用 runtime events/dashboard 下一轮观察。

---

### 2.2 Authority / Lifecycle 排除

debug-loop 不得成为第二个 Commander / Orchestration / Map Plugin lifecycle owner。

禁止：
```txt
直接写 active registry
直接写 activationSnapshotRef
直接写 validationReportRef / humanApprovalRef / activationProofRef
直接 mutate mission state
直接 dispatch Nerve Bus action envelope
绕过 map validation / approval / activation
```

允许：
```txt
调用 map authoring public contract
调用 map validation/activation public contract
读取 active binding
把用户任务通过 Commander 入口发布
```

---

### 2.3 Evidence / Proof 排除

debug-loop 不得成为第二个 Forensics writer。

禁止：
```txt
写 production evidence packet
伪造 proofRef
伪造 aiProofRef
伪造 PAV proof
根据 debug-loop 自己观察声明生产动作成功
把 raw cookie/API key/raw prompt/raw sensitive text 写入 repair packet
```

允许：
```txt
读取 proof refs
复制 artifact refs
写 debug repair packet
写诊断摘要
```

---

### 2.4 Browser / Platform Operation 排除

debug-loop 不得成为直接平台自动化运行时。

禁止 mission-runtime：
```txt
page.click
page.fill
page.type
page.keyboard.press
page.mouse.wheel
page.screenshot
page.evaluate
DOM selector action
Chrome controller action
直接评论/点赞/私信/购买/提交
```

允许例外：
```txt
platform-auth-check / environment-preflight 可使用 browser/controller 检查登录、安全墙、captcha、环境可用性。
```

例外限制：
```txt
preflight 只能输出环境状态。
preflight 不得执行 mission action。
preflight 不得生成 production proof。
```

---

### 2.5 AI / Map Authoring 排除

debug-loop 可以帮助测试 fake 高级 AI 制图链路，但不得成为隐藏 AI runtime 或 map lifecycle bypass。

允许：
```txt
构建 Map Authoring Input Package
生成 map-authoring prompt artifact
保存 input-package / prompt 文件
请求 Codex/manual 生成 draft map
调用 map-plugin public lifecycle
读取 activation binding
```

禁止：
```txt
直接 active draft map
伪造 activationSnapshotRef
绕过 validation
执行 draft map
解释 operational map step
```

---

## 3. 允许的 debug-loop 架构

```txt
Scenario Layer
→ Publisher Layer
→ Observer Layer
→ Failure Classifier
→ Repair Packet Writer
```

### 3.1 Scenario Layer

负责：
```txt
描述用户任务
描述平台
描述运行限制
描述成功/阻塞信号
```

不负责：
```txt
页面操作脚本
能力调用脚本
DOM selector 操作
```

### 3.2 Publisher Layer

负责：
```txt
调用 Commander public contract
发布 human-like command
传递 scenarioId / humanGoal / map binding refs
```

不负责：
```txt
直接调用 Orchestration
直接调用 Nerve Bus
直接调用 ability executor
```

### 3.3 Observer Layer

负责：
```txt
读取 logs
读取 runtime events
读取 Forensics read model
读取 mission status
```

不负责：
```txt
写 production proof
声明动作成功
修改 mission state
```

### 3.4 Failure Classifier

负责：
```txt
AUTH_REQUIRED
CAPTCHA_REQUIRED
SECURITY_CHECK_REQUIRED
MAP_VALIDATION_FAILED
RUNTIME_TIMEOUT
PAV_FAILED
ABILITY_BOUNDARY_VIOLATION
```

不负责：
```txt
修代码
执行动作
改法案
改施工图
```

### 3.5 Repair Packet Writer

负责：
```txt
写诊断包
引用日志/证据 ref
给 Codex 定位 owner/law/blueprint
```

不负责：
```txt
自动 patch
修改 src/**
修改 generated/**
写 production proof
```

---

## 4. 允许和禁止的 import 边界

### 4.1 mission-runtime 允许 import

```txt
Commander public contract
scenario schema
debug-loop artifact writer
log reader
runtime event reader
Forensics read model
map active binding read model
repair packet writer
failure classifier
```

### 4.2 mission-runtime 禁止 import

```txt
src/capabilities/mouse-click/**
src/capabilities/text-input/**
src/capabilities/screenshot/**
src/capabilities/visual-target/**
src/capabilities/geometry-guard/**
src/capabilities/mouse-scroll/**
src/capabilities/post-action-verification/**
src/capabilities/forensics-persistence/**/writer*
src/capabilities/orchestration/**/dispatcher*
src/capabilities/orchestration/**/runtime*
src/capabilities/nerve-bus/**/dispatch*
src/**/browser-controller*
src/**/CurrentChromeBrowserController*
```

### 4.3 preflight 允许 import

```txt
browser/controller for auth/environment check only
```

必须满足：
```txt
scenarioKind = platform-auth-check | environment-preflight
```

---

## 5. Scenario 文件规则

Scenario 是声明式任务，不是执行脚本。

Allowed fields:
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

Forbidden fields:
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

---

## 6. Fake Map Authoring 调试边界

允许：
```txt
debug-loop 构建 Map Authoring Input Package
debug-loop 生成 map-authoring-prompt.md
debug-loop 生成 map-authoring-input-package.json
debug-loop 输出 BLOCKED_CODEX_MAP_GENERATION_REQUIRED
Codex 根据 prompt 生成 draft map
debug-loop 调用 map-plugin public lifecycle
```

禁止：
```txt
debug-loop 直接把 draft map 写 active
debug-loop 手工生成 activationSnapshotRef
debug-loop 跳过 validation
debug-loop 执行 operationalMap
debug-loop 解释 branch
```

---

## 7. Repair Packet 边界

Repair packet 是诊断材料，不是生产事实。

Allowed:
```txt
failureCategory
logRefs
artifactRefs
suspectedOwner
lawRefs
blueprintRefs
reproductionCommand
safe excerpts
redacted summaries
```

Forbidden:
```txt
rawCookie
apiKey
rawSecret
rawPromptBody
rawSensitiveText
executablePatchScript
autoApplyPatch
productionProofRef write
generated audit manual edit
```

---

## 8. 执法建设

必须创建：

```txt
scripts/audit/domains/debug-loop-boundary/manifest.json
scripts/audit/domains/debug-loop-boundary/inspector.ts
scripts/audit/domains/debug-loop-boundary/run-inspector.ts
scripts/audit/domains/debug-loop-boundary/negative-proof-harness.ts
```

必须新增命令：

```bash
npm run audit:debug-loop-boundary
```

---

## 9. Inspector 必须覆盖

```txt
1. debug-loop 不在 14 active ability groups。
2. debug-loop 不作为 production runtime owner。
3. mission-runtime 禁止 import ability executors。
4. mission-runtime 禁止 import Orchestration runtime internals。
5. mission-runtime 禁止 import Nerve Bus dispatch internals。
6. mission-runtime 禁止 browser controller / page action API。
7. browser controller 只能在 platform-auth-check/environment-preflight 使用。
8. scenario JSON 禁止 executable fields。
9. scenario JSON 高风险动作必须有 automated gate policy。
10. debug-loop 禁止写 active registry / activation snapshot。
11. debug-loop 禁止 import Forensics production writers。
12. repair packet 禁止 raw secret/cookie/prompt/sensitive text。
13. fake map authoring 禁止绕过 map lifecycle。
14. mission 只能通过 Commander public contract 启动。
15. negative proof 必须执行。
```

---

## 10. Negative Proof 必须覆盖

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
scenario contains pageEvaluate
scenario contains abilityCall
scenario contains autoPostComment=true
debug-loop imports Forensics writer
debug-loop writes active registry
debug-loop writes activationSnapshotRef
debug-loop writes raw cookie to repair packet
fake authoring marks draft map active
fake authoring skips validation
turn P0 into warning-only
remove negative proof invocation
```

---

## 11. READY 标准

```txt
debug-loop-boundary law installed
debug-loop-boundary blueprint installed
audit:debug-loop-boundary exists
inspector PASS
negative proof PASS
audit:build PASS
debug-loop remains operator harness only
production Agent remains sole runtime executor
```
