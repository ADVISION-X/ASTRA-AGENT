
# GrassEye 代码纯洁度施工图

## 统一身份与冻结边界

- 本文件是 `module-code-purity.instructions.md` 的建设级落地映射，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 14 个 active ability groups、5 个 foundation laws、0 个 support governance domains；若与 Kernel / Index / 法案冻结基线冲突，以 Kernel / Index / 冻结基线为准。
- Code Purity 不是独立运行能力组，而是 `audit-system` 下的强制红线子契约。
- 若本文档与 `.github/instructions/cursor-rules/modules/module-code-purity.instructions.md` 冲突，以 `module-code-purity.instructions.md` 为最高权威。
- 若本文档与旧冻结说明、旧施工图、旧 generated artifact、旧 inspector 阈值冲突，以当前 Code Purity Phase 3.5 最终基线为准。
- 本文件不恢复任何已退役 owner、phase gate、audit plan 或 runner。
- 本文件不允许以“历史遗留”“暂时调试”“后续处理”为理由绕过上帝文件治理。

---

## 当前架构定位

GrassEye 当前代码纯洁度治理属于：

```txt
Static Capability Package Architecture
+
Audit-System Enforced Code Purity Sub-Contract
+
Phase 3.5 God-File Elimination Baseline
````

其职责是：

```txt
防止 active source truth 被上帝文件、上帝类、上帝函数、owner 混装、compat bridge、fake/mock、死代码、逃逸类型与伪执法污染。
```

本施工图的目标不是“代码风格优化”，而是：

```txt
保证 GrassEye 后续地图、提示词、AI、Nerve Bus、能力组调试不会继续堆进不可维护的大文件。
```

---

## Phase 3.5 目标

Phase 3.5 的目标：

1. 阻断新的上帝文件继续产生。
2. 阻断 touched oversized file 继续增长。
3. 阻断上帝类、上帝函数、深层嵌套与复杂函数继续扩散。
4. 阻断 owner boundary 混装。
5. 阻断 `src/lib` dumping。
6. 阻断 compat / bridge / legacy 第二系统。
7. 阻断 fake / mock / placeholder runtime leakage。
8. 阻断 active law 无 inspector、inspector 不进 runner、real-code-inspection 空壳。
9. 输出真实 God File Inventory / Disaster File Inventory / Remediation Queue。
10. 为后续大面积调试前建立可迭代代码基线。

---

## 已废除旧口径

以下旧规则全部废除，不得继续作为 code-purity 通过依据：

```txt
active src 单文件超过 2000 行才阻断
60 class members 才算 god object
8 owner boundaries 才算 owner-mixing
code-purity 不管行数阈值
code-purity 不管函数形状
code-purity 不管复杂度
code-purity 只查 fake/mock/compat/dead code
Phase 3.5 只做红线不做尺寸治理
```

旧口径只能作为历史说明，不得出现在当前 inspector、generated artifact、audit plan、runner summary 的有效阈值中。

---

## 当前 owner

```txt
owner: audit-system
sub-contract: code-purity
active domain: scripts/audit/domains/code-purity/**
```

Code Purity 不拥有业务逻辑，不拥有运行时能力，不拥有 AI prompt，不拥有地图流程。
它只拥有：

```txt
source truth purity enforcement
god-file detection
function-shape detection
class/object detection
owner-boundary detection
import/export purity
forbidden escape detection
fake/mock/dead-code detection
zombie graph cleanup
compat-bridge detection
real-code-inspection
inventory and remediation queue
```

---

## 强制扫描范围

当前 runner 必须覆盖：

```txt
src/**/*.{ts,tsx,js,jsx,mjs}
scripts/**/*.{ts,tsx,js,jsx,mjs}
```

其中：

```txt
src/**      = production source truth
scripts/**  = audit / enforcement source truth
```

法案、施工图、generated artifact 本身也必须被 audit-system 校验是否与 active law 覆盖一致，但行数规则不等同于 production runtime 文件。

---

## 文件尺寸硬阈值

| 文件类型                                           |      目标 |   硬上限 |
| ---------------------------------------------- | ------: | ----: |
| 普通生产实现文件                                       | ≤ 200 行 | 300 行 |
| runtime / implementation 文件                    | ≤ 220 行 | 300 行 |
| app handler / API handler                      | ≤ 180 行 | 250 行 |
| orchestration dispatcher / runtime coordinator | ≤ 220 行 | 300 行 |
| audit inspector 聚合文件                           | ≤ 200 行 | 250 行 |
| audit phase 文件                                 | ≤ 250 行 | 350 行 |
| schema / type 文件                               | ≤ 300 行 | 500 行 |
| JSON map / prompt contract 文件                  | ≤ 400 行 | 700 行 |

generated 文件规则：

* 必须明确标记 generated。
* 不允许人工编辑。
* 不允许混入 runtime logic。
* 不允许作为隐藏 active source truth 的容器。

---

## 函数硬阈值

| 指标                    |   目标 | 硬上限 |
| --------------------- | ---: | --: |
| 单函数物理行数               | ≤ 25 |  40 |
| 单函数有效语句数              | ≤ 20 |  35 |
| 参数数量                  |  ≤ 3 |   4 |
| return 分支数量           |  ≤ 3 |   5 |
| nesting depth         |  ≤ 2 |   3 |
| cyclomatic complexity |  ≤ 6 |   8 |
| switch cases          |  ≤ 5 |   8 |
| if / else-if 链        |  ≤ 3 |   5 |

超过硬上限的函数必须拆分为：

```txt
parser
input gate
policy gate
decision function
executor
result builder
proof builder
error mapper
```

禁止继续往超标函数里追加分支。

---

## class / object 硬阈值

| 指标                     |   目标 | 硬上限 |
| ---------------------- | ---: | --: |
| methods                |  ≤ 8 |  12 |
| fields                 |  ≤ 8 |  12 |
| total members          | ≤ 16 |  24 |
| constructor parameters |  ≤ 4 |   6 |
| public methods         |  ≤ 6 |  10 |

超过硬上限的 class 必须拆分为窄角色组件：

```txt
input-gate
policy-gate
executor
result-builder
proof-builder
read-model
storage-adapter
debug-emitter
composition-root
```

禁止出现一个 class 同时管理：

```txt
mission readiness
runtime logs
AI debug
Forensics
human command
candidate review
Nerve Bus wiring
platform runtime wiring
```

---

## import / export 硬阈值

| 指标                  |   目标 | 硬上限 |
| ------------------- | ---: | --: |
| import declarations | ≤ 10 |  15 |
| import sources      |  ≤ 8 |  12 |
| cross-owner imports |  ≤ 1 |   2 |
| owner boundaries    |  ≤ 2 |   3 |
| exports             |  ≤ 5 |   8 |

绝对禁止：

```txt
export *
require
ungoverned dynamic import
default export unless specifically allowed by owner law
barrel export laundering
```

---

## owner boundary 精细分类

禁止把大目录当成单一 owner：

```txt
src/capabilities ≠ one owner
src/features ≠ one owner
src/lib ≠ one owner
```

必须使用真实能力组 owner 粒度：

```txt
src/capabilities/ai = ai
src/capabilities/orchestration = orchestration
src/capabilities/nerve-bus = nerve-bus
src/capabilities/open = open
src/capabilities/screenshot = screenshot
src/capabilities/visual-target = visual-target
src/capabilities/geometry-guard = geometry-guard
src/capabilities/mouse-click = mouse-click
src/capabilities/text-input = text-input
src/capabilities/mouse-scroll = mouse-scroll
src/capabilities/post-action-verification = post-action-verification
src/capabilities/forensics-persistence = forensics-persistence
src/capabilities/page-state = page-state
src/capabilities/commander-console = commander-console
src/map-plugins = retired package-governance path
src/app = local-app-shell / commander-console boundary
scripts/audit/domains/code-purity = code-purity
scripts/audit/domains/* = separate audit domain owner
```

如果单文件跨越超过 3 个 owner boundary，必须拆分。

---

## Touched File Rule

任何本轮被修改过的生产源文件，如果超过对应硬上限，必须先拆再改。

禁止：

```txt
只是加一点点
legacy 文件以后再拆
先把功能跑通再说
临时 patch 一下
这轮只补一个 if
```

如果 touched file 无法在本轮拆到合规范围，必须输出：

```txt
BLOCKED_BY_GOD_FILE
```

并列入 remediation queue。

---

## Existing Oversized File Rule

现存超标文件不得豁免。

现存超标文件必须：

1. 被 audit 识别。
2. 被写入 God File Inventory。
3. 被写入 Remediation Queue。
4. 不允许继续增长。
5. 如果本轮触碰，必须立即拆分到合规范围。
6. 如果位于当前调试主链，必须优先治理。

---

## Disaster File Rule

满足任一条件即为 disaster file：

```txt
生产实现文件 > 800 行
class total members > 24
owner boundaries > 3
cross-owner imports > 2
touched file above hard limit
mixed runtime roles hiding multiple owners
known blocker for audit / AI-assisted edit / runtime debugging
```

Disaster file 必须：

1. 写入 Disaster File Inventory。
2. 写入 Remediation Queue。
3. 禁止承载新功能。
4. 禁止继续调试主链通过它。
5. 必须独立做 physical split plan。

---

## 单文件角色纯洁度

每个 active source file 只能有一个 primary role。

允许角色：

```txt
schema
contract
input-gate
policy-gate
executor
runner
adapter
result-builder
proof-builder
read-model
writer
validator
inspector
manifest
index
type-only
```

禁止混合：

```txt
schema + runtime
validator + executor
API handler + business workflow + persistence
AI prompt + action execution
map validation + prompt generation + activation
storage writer + decision logic
Orchestration + primitive action
Nerve Bus + business decision
Forensics + business decision
```

---

## 死代码与临时路径清理

必须删除：

```txt
commented-out implementation
dead branch
old deleted owner path
unused compatibility path
fake runtime path
mock/fake/placeholder production path
temporary bypass
legacy bridge
```

TODO / FIXME 只有在同时包含以下信息时允许存在：

```txt
owner
reason
target phase or removal condition
```

禁止：

```txt
FIXME later
TODO clean up
temporary hack
compat until later
legacy bridge
```

---

## 类型逃逸与反逃逸

禁止：

```txt
as any
as unknown as
@ts-ignore
@ts-expect-error unless specifically governed
eslint-disable unless specifically governed
catch and swallow
naked throw escaping public runtime boundary
return null as success
fake success
fallback success
no-op success
```

Inspector 必须使用：

```txt
ts-morph AST
Symbol
TypeChecker
AliasedSymbol
ImportDeclaration
ExportDeclaration
CallExpression
PropertyAccessExpression
ClassDeclaration
FunctionDeclaration
MethodDeclaration
```

禁止用以下方式作为最终判断：

```txt
grep
regex
includes
match
split
text-only scan
```

fs/glob 只允许枚举文件。

---

## 物理切割策略

违规文件只能使用以下方式治理：

```txt
DELETE
DELETE_AND_REWRITE
PHYSICAL_SPLIT
OWNER_LOCAL_EXTRACTION
```

禁止：

```txt
cosmetic rename
wrapper hiding
facade hiding
bridge retaining old path
moving mess into src/lib
keeping old path and new path active
index.ts barrel laundering
```

典型拆分方向：

```txt
handler → request parser / command gate / response builder
runtime → input gate / policy gate / executor / result builder / proof builder
inspector → required-shape / forbidden-shape / boundary-attack / anti-escape / real-code-inspection
workbench → shell / runtime assembly / command reader / debug reader / forensics reader
AI adapter → contract translation / prompt resolution / schema gate / runtime execution / result mapping
```

---

## 当前必须治理的高危文件类型

以下类型不得继续膨胀：

```txt
src/lib/local-runtime/workbench.ts
src/app/*handlers.ts
src/capabilities/*/runtime/*.ts
src/capabilities/*/runtime-adapters/*.ts
src/map-plugins/validation/*.ts
scripts/audit/domains/*/inspector.ts
scripts/audit/domains/code-purity/components/*.ts
```

如果这些文件被 code-purity audit 捕获，必须优先进入 Violation Dossier。

---

## 执法系统要求

当前 inspector 必须真实检查：

1. 文件行数。
2. 函数行数。
3. 函数语句数。
4. 函数参数数量。
5. cyclomatic complexity。
6. nesting depth。
7. class methods。
8. class fields。
9. class total members。
10. constructor 参数。
11. import declarations。
12. import sources。
13. cross-owner imports。
14. owner boundaries。
15. exports。
16. `export *`。
17. `as any`。
18. `as unknown as`。
19. `@ts-ignore`。
20. `@ts-expect-error`。
21. `eslint-disable`。
22. `require`。
23. dynamic import。
24. `console.log` scatter。
25. fake success。
26. fallback success。
27. no-op success。
28. `return null` success。
29. naked throw。
30. catch-and-swallow。
31. schema/runtime mixing。
32. validator/executor mixing。
33. role mixing。
34. bridge / compat / legacy filename leakage。
35. active law without inspector。
36. inspector without runner。
37. real-code-inspection empty shell。

---

## Required Shape Attack

Code-purity 审计必须证明：

```txt
code-purity domain exists
manifest exists
inspector exists
runner executes inspector
CI-FULL code-purity stage command exists
ci:full generates artifacts
generated artifacts include code-purity
active code-purity laws have coverage
P0/P1 rules have real-code-inspection
God File Inventory is produced
Disaster File Inventory is produced
Remediation Queue is produced
```

---

## Forbidden Shape Attack

必须拦截：

```txt
oversized touched file
god file
god class
god function
owner bucket laundering
src/lib dumping
export *
as any
as unknown as
@ts-ignore
eslint-disable
console.log patch
fake success
fallback success
no-op success
bridge file
duplicate active path
warning-only inspector
detached inspector
generated fake PASS
```

---

## Boundary Attack

必须证明：

```txt
file owner matches law owner
helper does not cross owner without port/contract
shared helper has real reuse proof
app handler does not own workflow
runtime does not own schema
validator does not execute runtime
AI does not execute actions
Orchestration does not execute primitive
Forensics does not make business decisions
Nerve Bus does not make business decisions
```

---

## Anti-Escape Attack

必须防止：

```txt
alias laundering
barrel export laundering
wrapper hiding forbidden call
neutral filename hiding mixed owner
generated file hiding active logic
fixture leaking into production
fake PASS
empty real-code-inspection harness
audit disconnected from runner
owner mapping collapsed to broad bucket
```

---

## real-code-inspection

必须真实执行 regression fail → re-inspect → pass。

最低 regression 清单：

```txt
MAX_ACTIVE_SOURCE_FILE_LINES 改回 2000 → FAIL → re-inspect PASS
MAX_CLASS_TOTAL_MEMBERS 改回 60 → FAIL → re-inspect PASS
MAX_OWNER_BOUNDARIES 改回 8 → FAIL → re-inspect PASS
src/capabilities 重新归为一个 owner bucket → FAIL → re-inspect PASS
删除 touched file rule → FAIL → re-inspect PASS
删除 disaster file rule → FAIL → re-inspect PASS
删除 active law enforcement rule → FAIL → re-inspect PASS
添加 301 行 touched production file → FAIL → re-inspect PASS
添加 41 行函数 → FAIL → re-inspect PASS
添加 25 members class → FAIL → re-inspect PASS
添加 cross-owner imports > 2 → FAIL → re-inspect PASS
添加 export * → FAIL → re-inspect PASS
添加 as any → FAIL → re-inspect PASS
添加 as unknown as → FAIL → re-inspect PASS
添加 @ts-ignore → FAIL → re-inspect PASS
添加 eslint-disable → FAIL → re-inspect PASS
添加 fake success → FAIL → re-inspect PASS
添加 no-op success → FAIL → re-inspect PASS
删除 real-code-inspection invocation → FAIL → re-inspect PASS
inspector 改成 warning-only → FAIL → re-inspect PASS
```

禁止理论覆盖。

---

## Inventory 输出要求

每轮 code-purity audit 必须输出：

```txt
God File Inventory
Disaster File Inventory
Owner Mixing Inventory
Oversized Touched File Inventory
Function Over-limit Inventory
Class/Object Over-limit Inventory
Import/Export Over-limit Inventory
Remediation Queue
First Physical Split Plan
```

每条 inventory item 必须包含：

```txt
file
lines
fileType
overLimitBy
functionsOverLimit
classMembers
importCount
crossOwnerImports
ownerBoundaries
roleMixingSignals
severity
recommendedSplit
```

severity 只能是：

```txt
BLOCKING
DISASTER
REMEDIATION
```

---

## Zombie Finding 输出要求

zombie scanner 必须把每个 fatal zombie finding 输出成结构化记录，而不是只塞进 message。

每条 zombie finding 必须包含：

```txt
lawId
file
line
severity
zombieKind
symbolName
lawfulCallerCount
protectedSeam
recommendedAction
```

zombieKind 只能取下列值：

```txt
orphan-file
dead-export
unused-child-capability
unused-prompt-contract
unused-route-plan-step
unused-retired package chain
unused-inspector-component
unused-muscle-memory-action-code
```

protectedSeam 只能用于说明已被明确豁免的守门 seam，不能用来掩盖真实 zombie。

---

## 激活策略

当前固定顺序：

1. 读取冻结法案。
2. 读取本施工图。
3. `npm run ci:full`
4. CI-FULL code-purity stage
5. 如无独立命令，必须补齐。
6. `npm run ci:full`
7. 生成 inventory。
8. 建立 violation dossier。
9. 建立 WHY。
10. 物理删除 / 物理切割 / 删除重写。
11. 强化防复发 inspector。
12. real-code-inspection。
13. 再跑 audit。
14. 循环直到本轮门槛达标或 BLOCKED。

---

## 当前 CI / 命令要求

必须存在：

```txt
npm run ci:full
CI-FULL code-purity stage
npm run ci:full
npm run typecheck -- --pretty false
git diff --check
```

本施工图不要求每轮都 `ci:full`，因为当前可能存在并行 AI 修改。
但 Code Purity Phase 3.5 基线建设轮必须真实运行 `ci:full` 并输出失败清单。

---

## 阻断规则

以下情况必须 BLOCKED：

```txt
法案与施工图发生致命冲突
owner 无法判定
parallel dirty file 无法安全覆盖
需要人工确认是否删除路径
修复会覆盖用户未提交改动
```

以下情况不得 BLOCKED：

```txt
文件太多
违规太多
旧文件太大
工作量大
audit 真实失败
ci 真实失败
```

---

## READY 标准

Code Purity Phase 3.5 READY 只有在以下全部成立时才允许：

1. 法案、施工图、inspector、generated artifact、runner 口径一致。
2. 旧 2000 / 60 / 8 阈值不再作为 active baseline。
3. 300 / 40 / 24 / 3 阈值真实执法。
4. owner boundary 使用真实能力组粒度。
5. `CI-FULL code-purity stage` 存在并可运行。
6. code-purity inspector 接入 runner。
7. audit-system 能发现 active law 无 enforcement。
8. real-code-inspection 真实执行。
9. God File Inventory 输出。
10. Disaster File Inventory 输出。
11. Remediation Queue 输出。
12. First Physical Split Plan 输出。
13. touched oversized file 不允许继续增长。
14. known disaster file 不允许承载新功能。
15. 不降低标准。
16. 不用历史遗留豁免。

---

## 最终原则

```txt
上帝文件不是风格问题，是系统生存问题。
违规不是麻烦，是鉴权入口。
审计失败不是坏事，假通过才是坏事。
旧代码不是豁免理由。
能物理删除就不兼容桥接。
能物理切割就不补丁缝合。
能 owner-local 就不丢进 src/lib。
每一次违规都必须留下 WHY、修复、执法、防复发证据。
```
