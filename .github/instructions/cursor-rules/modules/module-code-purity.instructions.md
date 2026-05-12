---
name: "GrassEye Code Purity Final"
description: "Final law for small-file architecture, owner boundary purity, dead-code removal, retired-surface prevention, and anti-complexity governance."
applyTo: ".github/instructions/cursor-rules/modules/module-code-purity.instructions.md, src/**/*.{ts,tsx,js,jsx,mjs}, scripts/**/*.{ts,tsx,js,jsx,mjs}"
status: "final"
---

# GrassEye Code Purity Final Law

版本: FINAL  
状态: active  
主权: final-code-purity-law  
替换: all previous code-purity, quality-kernel, detailed ability inspector, owner-inspection-harness, generated matrix governance claims that conflict with this file.

---

## 0. Final Doctrine

GrassEye 质检系统不再治理业务细节。

GrassEye Code Purity 只治理一件事：

```txt
让代码永远保持小、清楚、可读、可删、可定位、不可复杂化。
```

它不证明业务逻辑一定正确。  
它不证明 AI 判断一定正确。  
它不证明鼠标点击一定点对。  
它不证明页面语义一定成功。  

这些由：

```txt
小文件
强日志
typecheck
真实运行
AI 快速定位
```

共同完成。

Code Purity 的最终价值是：

```txt
防止系统再次膨胀成垃圾堆；
防止 AI 生成代码时失控扩张；
防止旧系统复活；
防止一个文件变成一个系统；
防止质检系统自己变成第二系统。
```

---

## 1. Scope

本法案治理：

```txt
文件行数
函数行数
函数复杂度
类/对象大小
import/export
owner boundary
dead file
dead import
fake/mock/placeholder
console 散落
type escape
compat bridge
fallback/alias
retired surface
private runtime import
generated 手工修改
```

本法案不治理：

```txt
某个业务动作是否正确
某个平台页面是否正确
AI 是否判断种草视频正确
某个按钮是否应该点击
某个 prompt 是否最优
某个 product lead 是否成立
```

---

## 2. Highest Rules

### LAW-CP-001: Code Purity Is Structure Guardrail Only

status: active  
tier: P0  
enforcementMode: machine-blocking

```txt
Code Purity is a structural guardrail.
It must not become a second runtime, second architecture model, second legal system, or generated report universe.
```

必须：

```txt
每个 inspector 只回答一个清楚阻断问题。
PASS 输出必须短。
FAIL 必须给 file + reason + fix direction。
无违规不得输出大 inventory。
无业务细节判断。
```

禁止：

```txt
用质检系统证明业务细节。
为一行业务逻辑写几十行 AST 检查。
默认生成大报告。
默认生成 matrix universe。
owner-inspection-harness 大系统。
warning-only P0。
fake PASS。
```

---

### LAW-CP-002: Small Files Are The Foundation

status: active  
tier: P0  
enforcementMode: machine-blocking

| 类型 | 目标 | 硬限制 |
|---|---:|---:|
| 普通 production implementation | <= 200 行 | 300 行 |
| runtime / implementation | <= 220 行 | 300 行 |
| app/api handler | <= 180 行 | 250 行 |
| orchestration coordinator | <= 220 行 | 300 行 |
| audit inspector | <= 180 行 | 250 行 |
| schema/type file | <= 300 行 | 500 行 |
| JSON/prompt contract | <= 400 行 | 700 行 |

法条：

```txt
超过硬限制就是治理失败，不是风格问题。
被 touched 的超限文件必须先切割，再新增逻辑。
```

禁止：

```txt
向超限文件继续加逻辑。
用 legacy 作为豁免。
用 shared/utils/manager/workbench 隐藏大文件。
把多个 owner 合进一个大文件。
```

---

### LAW-CP-003: Small Functions Are Mandatory

status: active  
tier: P0  
enforcementMode: machine-blocking

| 指标 | 目标 | 硬限制 |
|---|---:|---:|
| physical lines | <= 25 | 40 |
| effective statements | <= 20 | 35 |
| parameters | <= 3 | 4 |
| return branches | <= 3 | 5 |
| nesting depth | <= 2 | 3 |
| cyclomatic complexity | <= 6 | 8 |
| switch cases | <= 5 | 8 |
| if/else-if chain | <= 3 | 5 |

必须拆分为：

```txt
parse
validate
decide
execute
buildResult
buildProof
emitLog
```

禁止：

```txt
一个函数里同时 parse + validate + execute + persist + log + return。
深层 if/else。
catch 后吞掉错误。
fake success。
return null as success。
```

---

### LAW-CP-004: Owner Boundary Must Stay Clean

status: active  
tier: P0  
enforcementMode: machine-blocking

```txt
一个文件必须属于一个 owner。
跨 owner import 必须少、清楚、通过 public contract。
禁止 import private runtime / children / shared 内部实现。
```

硬限制：

```txt
cross-owner imports <= 2
owner boundaries <= 3
import declarations <= 15
import sources <= 12
exports <= 8
```

禁止：

```txt
import 其他能力组 runtime/**
import 其他能力组 children/**
import 其他能力组 shared/**
用 index.ts barrel 隐藏 owner mixing。
把 domain-private helper 移进 src/lib 假装干净。
```

---

### LAW-CP-005: Retired Surface Must Never Return

status: active  
tier: P0  
enforcementMode: machine-blocking

旧系统主权词不得在 active source truth 中以正向形态出现。

阻断词包括但不限于：

```txt
RuntimePlan
runtimePlanId
mapId
routePlanId
branchToken
bindingPackageId
bindingSnapshotRef
selectedBindingId
postActionVerification
mandatoryPAV
page-state-capability
pageReady
pageCorrect
feedReady
prompt-registry
providerRouter
cloudFallback
open-facebook
open-tiktok
open-local-program
prepare-ai-input
prepare-visual-mission-input
observe-like-button
observe-comments-button
finalize-evidence-packet
write-product-lead-record
candidateDisposition
approve-candidate
reject-candidate
```

允许出现的唯一场景：

```txt
negative check
retired note
forbidden regression guard
migration report
```

禁止：

```txt
作为 schema field。
作为 enum value。
作为 childCapabilityId。
作为 actionCode。
作为 file path。
作为 runtime method。
作为 positive test fixture。
```

---

### LAW-CP-006: No Dead Files, Dead Imports, Or Fake Paths

status: active  
tier: P0  
enforcementMode: machine-blocking

必须阻断：

```txt
dead file
dead import
unused export
commented-out implementation
fake/mock/placeholder runtime
TODO success
no-op success
fallback success
compat bridge
alias preserving old route
manual generated edit
```

允许 TODO 的唯一格式：

```txt
TODO(owner=<owner>, removeBy=<phase|condition>, reason=<short reason>)
```

禁止：

```txt
TODO later
temporary
fix later
mock as runtime
placeholder result
```

---

### LAW-CP-007: No Escape Hatches

status: active  
tier: P0  
enforcementMode: machine-blocking

禁止：

```txt
as any
as unknown as
@ts-ignore
unreviewed @ts-expect-error
eslint-disable
require
unmanaged dynamic import
export *
default export unless explicitly allowed by owner law
console.log / console.error / console.warn / console.debug outside Runtime Log terminal sink or CLI entrypoint
```

---

### LAW-CP-008: Refactor Means Physical Simplification

status: active  
tier: P0  
enforcementMode: machine-blocking

```txt
重构必须减少文件大小、owner mixing、复杂度和 active path。
```

必须优先：

```txt
physical delete
physical split
single-owner file
public contract
small adapter
```

禁止：

```txt
compat bridge
fallback route
old path + new path both active
rename without simplification
shared dumping
wrapper hiding same complexity
```

---

### LAW-CP-009: Code Purity Inspector Must Stay Small

status: active  
tier: P0  
enforcementMode: machine-blocking

```txt
scripts/audit/domains/code-purity <= 12 files
each inspector file <= 250 lines
no owner-inspection-harness
no generated matrix universe
no default inventory on PASS
```

Code Purity inspector 只允许输出：

```txt
PASS: short summary
FAIL:
  file
  rule
  reason
  fixDirection
```

禁止：

```txt
长篇报告
默认扫描报告
描述性长报告
第二架构图
第二 runtime model
```

---

## 3. Required Enforcement

CI-FULL 必须执行 Code Purity。

Code Purity 必须检查：

```txt
file lines
function lines
function complexity
class/object size
import/export limits
cross-owner import
private runtime import
dead file
dead import
unused export
console scatter
type escape
fake/mock/placeholder
compat/fallback/alias
retired surface
manual generated edits
```

不得检查：

```txt
业务动作是否正确
AI 判断是否正确
页面语义是否正确
某个细节字段是否符合某个能力组的旧 inspector
```

---

## 4. PASS Definition

只有全部满足才 PASS：

```txt
1. 没有超限 active source file。
2. 没有超限 touched file。
3. 没有超限 function/class/object。
4. 没有越权 private runtime import。
5. 没有 dead file / dead import。
6. 没有 fake/mock/placeholder runtime path。
7. 没有 console scatter。
8. 没有 type escape。
9. 没有 compat bridge / fallback / alias。
10. 没有 retired surface 正向回归。
11. Code Purity inspector 自身没有膨胀。
12. PASS 输出短。
13. FAIL 输出可修。
```

---

## 5. Final Sentence

```txt
GrassEye Code Purity 不负责证明业务正确；
它只负责让代码永远小、清楚、干净、可定位、不可复杂化。
```
