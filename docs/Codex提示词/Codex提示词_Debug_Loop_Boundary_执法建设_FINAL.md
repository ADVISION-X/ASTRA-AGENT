# Codex 提示词：建设 Debug Loop Boundary 法案、施工图与执法系统

## 任务目标

本轮只做一件事：

```txt
建设 Debug Loop Boundary 法案 + 施工图 + 执法脚本，
确保 debug-loop = 代替人工使用 Agent，
确保 debug-loop != 第二套 Agent。
```

---

## 必须先读取

```txt
scripts/debug-loop/**
package.json
.github/instructions/cursor-rules/modules/**
docs/法案辅助文件/**
scripts/audit/domains/**
scripts/audit/generated/**
```

必须重点读取本轮新增/替换文件：

```txt
.github/instructions/cursor-rules/modules/module-debug-loop-boundary.instructions.md
docs/法案辅助文件/GrassEye Debug Loop Boundary 调试程序边界施工图.md
```

---

## 最高原则

```txt
调试程序 = 代替人工使用 Agent
调试程序 != 第二套 Agent
```

debug-loop 只能：

```txt
选择 scenario
构建 human-like command
调用 Commander public contract
调用 map authoring public contract
读取 active map binding
启动 mission
读取 logs/events/Forensics read model
分类失败
写 repair packet
```

debug-loop 禁止：

```txt
直接执行能力组动作
直接操作页面
直接解释 operationalMap
直接推进 Orchestration state
直接 dispatch Nerve Bus
直接写 Forensics proof
直接写 active registry
直接绕过 map validation/activation
```

---

## 施工方式

### Step 1：安装法案和施工图

创建或更新：

```txt
.github/instructions/cursor-rules/modules/module-debug-loop-boundary.instructions.md
docs/法案辅助文件/GrassEye Debug Loop Boundary 调试程序边界施工图.md
```

不得修改其它法案内容来降低要求。

---

### Step 2：创建 audit domain

创建：

```txt
scripts/audit/domains/debug-loop-boundary/manifest.json
scripts/audit/domains/debug-loop-boundary/inspector.ts
scripts/audit/domains/debug-loop-boundary/run-inspector.ts
scripts/audit/domains/debug-loop-boundary/negative-proof-harness.ts
```

新增 package 命令：

```bash
npm run audit:debug-loop-boundary
```

如果 audit registry/matrix/audit-plan 需要生成接入，按现有 audit:build 体系接入，不得手改 generated 伪造 PASS。

---

## Inspector 必须机器拦截

### 1. 身份边界

检查：

```txt
debug-loop 不在 active ability groups
debug-loop 不在 capability registry
debug-loop 不作为 production runtime owner
debug-loop 只作为 local development tooling / audit-only boundary domain
```

### 2. 运行时执行边界

检查 `scripts/debug-loop/**`：

禁止 mission-runtime 直接 import：

```txt
src/capabilities/mouse-click/**
src/capabilities/text-input/**
src/capabilities/screenshot/**
src/capabilities/visual-target/**
src/capabilities/geometry-guard/**
src/capabilities/mouse-scroll/**
src/capabilities/post-action-verification/**
src/capabilities/orchestration/**/dispatcher*
src/capabilities/orchestration/**/runtime*
src/capabilities/nerve-bus/**/dispatch*
```

必须验证 mission 启动通过 Commander public contract。

### 3. Browser / Platform 操作边界

禁止 mission-runtime 中出现：

```txt
page.click
page.fill
page.type
page.keyboard.press
page.mouse.wheel
page.screenshot
page.evaluate
CurrentChromeBrowserController
browserController
direct DOM action
```

允许例外：

```txt
scenarioKind = platform-auth-check
scenarioKind = environment-preflight
```

但例外文件也不得执行 mission action、comment、like、message、purchase、submit。

### 4. 证据 / 状态写入边界

禁止 debug-loop：

```txt
import Forensics production writer
write active registry
write activationSnapshotRef
write validationReportRef/humanApprovalRef/activationProofRef directly
write production evidence packet
write production proof refs
```

允许：

```txt
read logs/read models
write repair packet under debug-loop artifact path
```

### 5. Scenario JSON 边界

遍历 `scripts/debug-loop/scenarios/**/*.json`。

禁止字段：

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

### 6. Fake Map Authoring 边界

检查 debug-loop fake authoring：

允许：

```txt
write map-authoring-prompt.md
write map-authoring-input-package.json
call map-plugin public lifecycle
```

禁止：

```txt
direct active registry write
direct activationSnapshotRef write
skip validation
execute operationalMap
interpret map branch
```

### 7. Repair Packet 边界

检查 repair packet writer/schema：

禁止：

```txt
raw cookie
api key
raw secret
raw prompt body
raw sensitive text
executable patch script
auto apply patch
production proof write
manual generated audit edit
```

---

## Negative Proof 必须实现

必须覆盖以下 fail → rollback → pass：

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

## 修复原则

如果现有 debug-loop 违反边界：

```txt
优先物理切割。
优先删除重写。
禁止补丁缝合。
禁止把 debug-loop 扩展成能力执行层。
```

如果现有 platform-auth-check 直接使用 browser controller：

```txt
允许保留为 preflight。
必须加 scenarioKind / file path / function name 边界。
必须禁止其执行 mission action。
```

如果 mission-runtime 直接使用 browser controller 或 ability executor：

```txt
必须删除重写。
改为通过 Commander public contract 启动 mission。
```

如果 repair packet 写入 raw secret/cookie/prompt：

```txt
必须改为 redacted summary + refs/hashes。
```

---

## 必须运行

```bash
npm run audit:build
npm run audit:debug-loop-boundary
```

如果相关 owner 受影响，运行：

```bash
npm run audit:commander-console
npm run audit:orchestration
npm run audit:nerve-bus
npm run audit:map-plugin-package
npm run audit:forensics-persistence
```

不要求本轮 CI-FULL，除非用户明确要求。

---

## 完成标准

```txt
1. Debug Loop Boundary 法案存在。
2. Debug Loop Boundary 施工图存在。
3. audit:debug-loop-boundary 存在。
4. inspector 覆盖四方排除法。
5. negative proof 全部覆盖。
6. mission-runtime 不直接执行页面/能力动作。
7. preflight 例外被边界限制。
8. scenario JSON 不含 executable fields。
9. repair packet 不含 raw secret/cookie/prompt/sensitive text。
10. fake map authoring 不绕过 map lifecycle。
11. audit:build PASS。
12. audit:debug-loop-boundary PASS。
```

---

## 最终输出格式

```txt
[DEBUG-LOOP-BOUNDARY-GOVERNANCE-RESULT]

1. FILES CREATED
- law:
- blueprint:
- inspector:
- negative proof:
- run-inspector:
- manifest:

2. BOUNDARY CHECKS
- identity:
- runtime execution:
- authority lifecycle:
- evidence proof:
- browser platform:
- AI map authoring:
- scenario:
- repair packet:

3. CODE CHANGES
- files deleted:
- files rewritten:
- files split:
- preflight exceptions:

4. NEGATIVE PROOF
- total:
- passed:

5. COMMANDS
- audit:build:
- audit:debug-loop-boundary:
- related audits:

6. REMAINING ISSUES
- NONE or explicit BLOCKED

7. FINAL VERDICT
- PASS / BLOCKED
```

---

## 一句话纪律

```txt
debug-loop 只能代替人工发任务和看日志；
所有真实页面动作、地图执行、能力调用、PAV、Forensics proof 必须由生产 Agent 完成。
发现 debug-loop 代替生产 Agent，立即删除重写并执法拦截。
```
