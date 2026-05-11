# GrassEye Code Purity Final Blueprint

版本: FINAL  
状态: active  
对应法案: `.github/instructions/cursor-rules/modules/module-code-purity.instructions.md`  
施工主旨: 用最少质检守住最大价值。

---

## 1. 最终定位

Code Purity 是 GrassEye 的第一基础质检。

它不是业务质检。  
它不是能力组细节裁判。  
它不是 AST 规则宇宙。  
它不是第二架构系统。  

它只做：

```txt
防止系统变大
防止系统变脏
防止系统越权
防止系统复旧
```

一句话：

```txt
代码纯洁度 = 小文件 + 清边界 + 无死代码 + 无旧系统回归。
```

---

## 2. 为什么这是 AI 开发的核心

AI 最擅长生成代码，也最容易制造膨胀。

如果不治理代码形态，AI 会持续生成：

```txt
大文件
大函数
大 manager
大 runtime
大 inspector
兼容桥
fallback
alias
临时补丁
重复系统
```

Code Purity 的目标不是证明每行逻辑正确。  
目标是让每一处逻辑都小到可以快速看懂、快速删除、快速定位。

---

## 3. 最终质检模型

最终 CI 只保留三类治理：

```txt
1. Code Purity
2. Runtime Log Spine
3. Retired Surface / Boundary Guard
```

其中 Retired Surface / Boundary Guard 归 Code Purity 管。

不再保留：

```txt
每个能力组几十条细节 inspector
每个 child 一套 AST 检查
每个字段一套防复发规则
owner-inspection-harness 大系统
generated matrix universe
默认 inventory 报告
```

---

## 4. 代码纯洁度检查项目

### 4.1 文件大小

检查：

```txt
production implementation <= 300 lines
runtime/implementation <= 300 lines
app/api handler <= 250 lines
orchestration coordinator <= 300 lines
audit inspector <= 250 lines
schema/type <= 500 lines
JSON/prompt contract <= 700 lines
```

失败：

```txt
FAIL fileTooLarge
```

修复：

```txt
按 owner / role / responsibility 物理切割。
```

---

### 4.2 函数复杂度

检查：

```txt
function lines <= 40
effective statements <= 35
parameters <= 4
return branches <= 5
nesting depth <= 3
cyclomatic complexity <= 8
```

失败：

```txt
FAIL functionTooComplex
```

修复：

```txt
拆成 parse / validate / decide / execute / buildResult / buildProof / emitLog。
```

---

### 4.3 类/对象膨胀

检查：

```txt
methods <= 12
fields <= 12
total members <= 24
constructor parameters <= 6
public methods <= 10
```

失败：

```txt
FAIL godObject
```

修复：

```txt
拆 collaborator，不用 manager/service/workbench 掩盖。
```

---

### 4.4 Import / Export

检查：

```txt
import declarations <= 15
import sources <= 12
cross-owner imports <= 2
owner boundaries <= 3
exports <= 8
```

硬禁：

```txt
export *
require
unmanaged dynamic import
default export unless owner law allows
```

失败：

```txt
FAIL importExportPurity
```

---

### 4.5 Owner Boundary

禁止：

```txt
import other owner runtime/**
import other owner children/**
import other owner shared/**
```

允许：

```txt
public contract
public index
declared port
composition root
```

失败：

```txt
FAIL ownerBoundaryViolation
```

---

### 4.6 Dead File / Dead Import

检查：

```txt
unused file
unused import
unused export
commented-out implementation
duplicate unused path
```

失败：

```txt
FAIL deadSource
```

修复：

```txt
删除，不归档在 active source。
```

---

### 4.7 Escape Hatch

禁止：

```txt
as any
as unknown as
@ts-ignore
unreviewed @ts-expect-error
eslint-disable
fake success
no-op success
return null as success
catch and swallow
```

失败：

```txt
FAIL escapeHatch
```

---

### 4.8 Console Scatter

禁止：

```txt
console.log
console.error
console.warn
console.debug
```

允许：

```txt
src/lib/runtime-logs/sinks.ts
CLI entrypoint
```

失败：

```txt
FAIL consoleScatter
```

修复：

```txt
接入 Runtime Log Spine。
```

---

### 4.9 Retired Surface

阻断旧系统主权词正向回归。

检查：

```txt
RuntimePlan
mapId
routePlanId
branchToken
bindingPackageId
postActionVerification
page-state-capability
prompt-registry
providerRouter
open-facebook
prepare-ai-input
observe-like-button
finalize-evidence-packet
write-product-lead-record
candidateDisposition
```

失败：

```txt
FAIL retiredSurfaceRegression
```

修复：

```txt
物理删除旧路径，不能 alias，不能 bridge。
```

---

## 5. Inspector 结构

推荐路径：

```txt
scripts/audit/domains/code-purity/
  config.ts
  inspector.ts
  run-inspector.ts
```

如果为了清晰可增加少量 helper，但整体必须：

```txt
<= 12 files
每个文件 <= 250 lines
无 owner-inspection-harness
无 generated matrix universe
```

---

## 6. Inspector 输出

PASS：

```txt
[CODE-PURITY][PASS] files=<n> findings=0
```

FAIL：

```txt
[CODE-PURITY][FAIL]
file:
rule:
reason:
fixDirection:
```

禁止：

```txt
PASS 输出大 inventory
默认生成报告
描述性长报告
```

---

## 7. 验收命令

### 文件数

```bash
git ls-files 'scripts/audit/domains/code-purity/**/*.{ts,tsx,js,jsx,json}' | wc -l
```

目标：

```txt
<= 12
```

### 超大文件

```bash
npm run audit:code-purity
```

必须检查：

```txt
src/**
scripts/**
```

### 禁止 console scatter

```bash
rg -n "console\.log|console\.error|console\.warn|console\.debug" src
```

只允许：

```txt
src/lib/runtime-logs/sinks.ts
CLI entrypoint
```

### 禁止 retired surface

```bash
rg -n "RuntimePlan|mapId|routePlanId|branchToken|bindingPackageId|postActionVerification|page-state-capability|prompt-registry|providerRouter|open-facebook|prepare-ai-input|observe-like-button|finalize-evidence-packet|write-product-lead-record|candidateDisposition" src scripts
```

只允许 negative guard / retired note。

### 禁止 private runtime import

```bash
rg -n "capabilities/.*/runtime|capabilities/.*/children|capabilities/.*/shared" src
```

允许 owner 内部相对路径，不允许跨 owner。

---

## 8. CI 接入

CI-FULL 中 Code Purity 必须作为基础步骤。

推荐：

```txt
typecheck
code-purity
runtime-log-spine
```

Code Purity FAIL 直接终止 CI-FULL。

---

## 9. 删除清单

必须删除或不再恢复：

```txt
owner-inspection-harness
generated matrix universe
ability detail inspector universe
child-by-child AST law
field-by-field business inspector
default inventory output
large report output
```

---

## 10. Final Acceptance

PASS 的唯一含义：

```txt
代码小；
边界清；
没有死代码；
没有旧系统复活；
没有调试散落；
没有兼容桥。
```

不代表：

```txt
业务一定对；
AI 判断一定对；
平台动作一定成功。
```

这些由 Runtime Log Spine + 真实运行定位。

---

## 11. Final Sentence

```txt
代码纯洁度质检不求证明世界正确；
只求代码永远小到能够快速理解、快速定位、快速删除。
```
