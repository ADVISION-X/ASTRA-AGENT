# GrassEye CI-FULL 大道至简真实修复循环｜视觉故事情节修正版｜Codex 直接执行版

## 0. 文件身份

```yaml
documentId: GRASSEYE-CI-FULL-VISUAL-STORY-REAL-REPAIR-LOOP-FINAL
documentType: codex-execution-prompt
targetExecutor: Codex
executionMode: single-long-running-loop
coreGoal: run-ci-full-read-first-violation-authorize-against-latest-visual-story-law-blueprint-inspector-fix-rerun-until-double-green
baseline: latest-visual-story-active-law-and-blueprint
status: active
```

本提示词用于 GrassEye 当前阶段的 CI-FULL 真实修复循环。

本任务不是重新规划系统。  
本任务不是重写故事情节。  
本任务不是恢复旧地图系统。  
本任务不是为了把红色 CI 临时抹绿。  
本任务不是自动大规模删除代码。  

本任务只有一个主循环：

```txt
运行 CI-FULL
→ 读取当前第一个阻断项
→ 通读对应最新 active 法条
→ 通读对应最新 active 施工图
→ 通读对应 inspector / runner / manifest
→ 判断到底是谁错
→ 按裁决删除 / 删除重写 / 物理切割 / 修复 inspector / 修复 generated source
→ 重新运行 CI-FULL
→ 继续处理下一个第一个阻断项
→ 直到 CI-FULL 连续两次全绿
```

---

## 1. 当前最新视觉故事情节基准

本轮冻结的是 **最新视觉故事情节已经收口后的 active law / active blueprint**。

唯一主链是：

```txt
APP Start Page
→ userRequirementText
→ selectedPlatforms
→ PlatformRegistry
→ Screenshot original + coordinate grid + gridSpec
→ Visual Mission Prompt Builder
→ Visual Mission Judge
→ VisualMissionActionPlan.actions[].actionCode
→ MuscleMemoryCatalog
→ ActionPlanDecoder
→ ActionContextHydrator
→ Scheduler / Orchestration
→ Nerve Bus
→ 14 ability groups / child capabilities
→ Forensics visual mission round record
→ next visual round
```

最新主权关系：

```txt
用户 = 目标提出者
APP = 唯一任务入口
AI = 视觉裁判 + 动作编排者
MuscleMemoryCatalog = 肌肉记忆编号区
Scheduler / Orchestration = 调度主管
14 个 ability group = 员工
child capability = 员工技能
Forensics = 账本
CI-FULL = 尺子
```

---

## 2. CI-FULL 的身份

CI-FULL 是尺子。  
CI-FULL 不是架构师。  
CI-FULL 不是删除器。  
CI-FULL 不是重构机器。  
CI-FULL 不自动决定删代码。  

CI-FULL 只证明当前 active production truth 是否符合：

```txt
1. 最新 active 法案
2. 最新 active 施工图
3. 合法 inspector
4. 当前代码事实
```

禁止把 CI-FULL 当成：

```txt
自动清仓工具
自动删除工具
自动恢复旧架构工具
自动生成兼容层工具
```

---

## 3. 最高铁律

### 3.1 最新视觉故事基准冻结

允许：

```txt
修正格式
修正 OCR / 编码 / 换行 / 标题问题
修正明显生成物漂移
修正 inspector 误读最新法案 / 最新施工图
```

禁止：

```txt
恢复旧地图故事
恢复 map lifecycle
恢复 RoutePlan
恢复 routeLabel
恢复 taskTemplate
恢复 selectedMapId
恢复 activationSnapshotRef
恢复 map.authoring
恢复 universal mandatory PAV
为了过 CI 降低法案
为了过 CI 降低施工图
把 FAIL 改 WARNING
新增 exception
新增 waiver
新增 allowlist
新增 compatibility bridge
新增 fallback
```

### 3.2 旧系统退场清单

以下系统在最新故事中已退场，不能作为 active runtime truth：

```txt
map
map-package
operationalMap
routePlan
routePlanId
routeLabel
taskTemplate
taskTemplateId
selectedMapId
selectedMapVersion
activationId
activationSnapshotRef
mapPackageId
mapPackageVersion
MapAuthoring
MapPlugin
activeMapRegistry
map.authoring prompt
pagePreparation/productPresence/nextItem/commentsEntry 分段视觉 prompt 主链
```

这些词可以出现在：

```txt
Code Purity retired scanner
Retired Vocabulary Table
docs/archive/**
历史迁移报告
反面禁止规则
```

但不得出现在：

```txt
active runtime
active registry
active prompt registry
active APP startup
active scheduler
active AI routing
active generated catalog
active CI layer
```

### 3.3 PAV 最新边界

PAV 不是退场系统。  
PAV 保留为 **optional verification capability**。

禁止：

```txt
把 PAV 删除为不存在
把 PAV 恢复成每个动作后的 universal mandatory gate
让 PAV 替代下一轮 Visual Mission Judge 的语义判断
```

允许：

```txt
高风险 action policy 要求 PAV
特定 click / scroll / text-input 后做机械验证
低风险动作由下一轮 screenshot + Visual Mission Judge 自然验证
```

### 3.4 Page State 最新边界

Page State 不是语义裁判。  
Page State 可以保留为辅助观察能力。

禁止：

```txt
Page State 判断产品语义
Page State 判断 feedReady / pageCorrect 等 AI 语义
Page State 替代 Visual Mission Judge
```

允许：

```txt
辅助记录 raw page hints
辅助异常状态观测
辅助非语义 runtime condition
```

---

## 4. 唯一主循环

Codex 必须严格按这个循环执行。

```txt
LOOP START

1. 运行 npm run ci:full。
2. 如果 CI-FULL 全绿，进入 FINAL DOUBLE GREEN。
3. 如果 CI-FULL 报错，只提取当前第一个阻断项。
4. 判断该阻断项属于哪一类：
   A. retired system residue
   B. active ability group violation
   C. code-purity structural violation
   D. inspector logic violation
   E. generated / runner drift
   F. law / blueprint conflict
5. 读取该阻断项对应的最新 active 法条。
6. 读取该阻断项对应的最新 active 施工图。
7. 读取该阻断项对应的 inspector / runner / manifest / real-code-inspection。
8. 判断是谁错：
   A. CODE_FILE_WRONG
   B. INSPECTOR_WRONG
   C. ENFORCEMENT_MISSING
   D. GENERATED_OR_RUNNER_DRIFT
   E. LAW_BLUEPRINT_CONFLICT_NEEDS_USER
9. 按裁决修复。
10. 重新运行 npm run ci:full。
11. 继续处理新的第一个阻断项。
12. 直到 CI-FULL 连续两次全绿。

LOOP END
```

禁止：

```txt
一次处理一堆问题然后不复验
全局扫荡式删除
只看 CI 报错不读法案
只看法案不读施工图
只看施工图不读 inspector
只改代码不鉴权 inspector
只改 inspector 不修真实代码
修一个报错就停止
报错减少就汇报完成
CI-FULL 未全绿就输出最终完成
```

---

## 5. 每个违规的最小处理格式

每一个 CI-FULL 违规必须输出以下结构。

```txt
[CI-VIOLATION]
失败命令：
失败文件：
失败位置：
失败 owner：
违规类型：
相关法案文件：
相关 lawId：
相关施工图：
相关 inspector：
相关 runner：
相关 manifest：
相关 real-code-inspection：
相关代码文件：
```

然后输出：

```txt
[AUTH-READ]
已通读最新 active 法条：YES/NO
已通读最新 active 施工图：YES/NO
已通读 inspector / runner / manifest：YES/NO
已确认是否 retired system：YES/NO
已确认是否 protected seam：YES/NO
```

然后输出：

```txt
[FAULT-JUDGMENT]
裁决只能是以下之一：

1. CODE_FILE_WRONG
2. INSPECTOR_WRONG
3. ENFORCEMENT_MISSING
4. GENERATED_OR_RUNNER_DRIFT
5. LAW_BLUEPRINT_CONFLICT_NEEDS_USER
```

不得输出模糊裁决：

```txt
可能是
大概是
建议后续
基本可以
暂时接受
先这样
```

---

## 6. 删除权限分级

CI-FULL 不是删除器。  
任何删除必须先裁决。

### 6.1 DELETE_NOW

只有同时满足以下条件，才允许直接删除：

```txt
1. active law / active blueprint 明确宣布该系统 retired。
2. Code Purity / visual-story coherence scanner 报 fatal。
3. 对象仍在 active runtime / active registry / active prompt / active APP startup / active scheduler。
4. 对象没有 protected seam。
5. 对象不属于 14 个 active ability group 当前职责。
6. 对象不是 generated source truth 的唯一来源。
```

典型 DELETE_NOW 候选：

```txt
src/map-plugins/**
scripts/audit/domains/map-plugin-package/**
map.authoring prompt
map.authoring template import
routePlan 生产施工图
taskTemplate 启动链
selectedMapId 启动字段
routeLabel 分支字段
旧分段 prompt active registry
map-layer / map-plugin-package active CI layer
```

处理方式：

```txt
物理删除。
必要时移动到 docs/archive/retired-xxx/。
但 archive 不得继续 active import / active registry / active runner / active law route。
```

---

### 6.2 DELETE_AFTER_AUTH

满足以下情况，必须先通读法案 + 施工图 + inspector：

```txt
1. 文件看起来旧，但可能被新系统复用。
2. 文件属于 ability group 内部。
3. 文件有 runtime import。
4. 文件有 generated catalog 依赖。
5. 文件看起来是旧 prompt，但可能是 schema validator / protected seam。
6. 文件属于 audit inspector 或 generated producer。
```

只有裁决为：

```txt
CODE_FILE_WRONG
```

才允许删除或删除重写。

---

### 6.3 DO_NOT_DELETE

以下对象不得因 CI-FULL 红项直接删除：

```txt
14 个 active ability group 根目录
Commander Console
Orchestration / Scheduler
Nerve Bus
AI capability root
Open
Screenshot
Visual Target
Geometry Guard
Mouse Click
Text Input
Mouse Scroll
Post Action Verification optional ability
Forensics Persistence
Page State auxiliary ability
Code Purity
Type Safety
Security Privacy
Audit System
```

这些 owner 报错时，优先处理：

```txt
物理切割 owner 内部大文件
删除重写 owner 内部违规文件
重写 inspector
补 registry / schema parity
补 child capability strength
补 Forensics record
补 Nerve Bus dispatch
补 type-safety
```

不是删除 owner。

---

## 7. 五种裁决怎么修

### 7.1 CODE_FILE_WRONG

定义：

```txt
代码文件违反了最新 active 法案、最新 active 施工图、以及经过鉴权的合法 inspector。
```

处理：

```txt
删除 / 删除重写 / 物理切割违规代码文件或违规模块。
不得小补丁糊住。
不得新增 bridge。
不得新增 fallback。
不得新增兼容层。
不得新增第二实现。
不得让代码迁就错误 inspector。
```

输出：

```txt
[CODE-FILE-REWRITE]
违规原因：
删除/重写文件：
新文件职责：
为什么不是补丁：
是否属于 retired system：
是否 protected seam：
```

---

### 7.2 INSPECTOR_WRONG

定义：

```txt
质检脚本逻辑错误、越权、误读最新法案、误读最新施工图、或把历史辅助内容当成 active 法案。
```

处理：

```txt
删除对应 inspector 错误逻辑。
按最新 active 法案 + 最新 active 施工图重新写。
```

原则：

```txt
当前 code-purity 已经要求质检脚本小而清楚。
如果 inspector 逻辑错，不要补丁修补。
直接删除对应错误段落或重写对应 inspector 文件。
```

禁止：

```txt
为了消除误报去改代码
为了保留旧 inspector 加例外
把 FAIL 改 WARNING
跳过检查
注释掉检查
```

输出：

```txt
[INSPECTOR-REWRITE]
错误逻辑：
对应法条：
对应施工图：
删除/重写文件：
新 inspector 覆盖点：
```

---

### 7.3 ENFORCEMENT_MISSING

定义：

```txt
最新法案 / 最新施工图有明确要求，但 inspector 没覆盖，导致 CI 没拦或拦得不完整。
```

处理：

```txt
补齐 inspector。
补齐 real-code-inspection。
补齐 owner inspector 入口。
必要时补 manifest。
```

要求：

```txt
该要求必须能 fail。
必须有真实代码级检查。
不得只做字符串存在检查。
grep / regex / includes 只能辅助，不能作为最终判断。
```

输出：

```txt
[ENFORCEMENT-ADD]
缺失要求：
新增 inspector 检查：
新增 real-code-inspection：
```

---

### 7.4 GENERATED_OR_RUNNER_DRIFT

定义：

```txt
法案、manifest、matrix、audit-plan、ci-full-summary、generated artifacts、runner source 之间漂移。
```

处理：

```txt
修 source law / manifest / generator / runner source。
重新运行 ci:full。
不得手工改 generated 伪造 PASS。
```

输出：

```txt
[GENERATED-DRIFT-FIX]
漂移位置：
真实源头：
修复文件：
重新生成命令：
```

---

### 7.5 LAW_BLUEPRINT_CONFLICT_NEEDS_USER

定义：

```txt
最新 active 法案与最新 active 施工图内容真实冲突，或法案本身缺授权，Codex 无权裁决。
```

处理：

```txt
停止当前项。
不得继续猜。
不得修改法案内容。
不得修改施工图内容。
输出给用户裁决。
```

输出：

```txt
[LAW-BLUEPRINT-CONFLICT-NEEDS-USER]
冲突法条：
冲突施工图段落：
CI 报错：
为什么 Codex 无权自行改：
最小用户裁决选项：
```

---

## 8. Retired System 专门鉴权规则

如果 CI-FULL 报的是 retired system，例如：

```txt
map
mapPackage
routePlan
routeLabel
taskTemplate
selectedMapId
activationSnapshotRef
map.authoring
```

必须按以下规则处理：

```txt
1. 如果出现在 active runtime / active registry / active prompt / active APP startup / active scheduler：
   → CODE_FILE_WRONG
   → 删除 / 删除重写

2. 如果出现在 code-purity retired scanner：
   → KEEP
   → 因为 scanner 需要识别旧词

3. 如果出现在 docs/archive：
   → KEEP
   → 但 archive 不得被 active law / active runtime / active CI owner 当成生产真相

4. 如果出现在法案反面禁止段落：
   → KEEP 或改成 Retired Vocabulary Table
   → 不按 active runtime 违规处理

5. 如果出现在 generated stale summary：
   → GENERATED_OR_RUNNER_DRIFT
   → 重新运行生成，不手改 generated

6. 如果出现在 active prompt registry：
   → CODE_FILE_WRONG
   → 删除 registry entry，删除 runtime import，删除旧 prompt active loading
```

---

## 9. 当前 CI-FULL 方向

### 9.1 保留

保留 CI-FULL 当前两层结构：

```txt
foundation-layer
ability-group-layer
```

保留 foundation-layer：

```txt
audit-build
code-purity
typecheck
capability-group-governance
type-safety
security-privacy
audit-system
```

保留 ability-group-layer：

```txt
commander-console
orchestration
nerve-bus
ai
open
screenshot
visual-target
geometry-guard
mouse-click
text-input
mouse-scroll
post-action-verification
forensics-persistence
page-state
```

### 9.2 禁止恢复

CI-FULL 不得恢复：

```txt
map-layer
map-plugin-package
route-plan-layer
task-template-layer
map-authoring-layer
```

如果 generated summary 仍出现这些层：

```txt
这属于 GENERATED_OR_RUNNER_DRIFT。
不代表 CI-FULL 源计划还应保留它们。
```

### 9.3 必须强化

CI-FULL 应强化以下检查：

```txt
1. retired prompt registry scan
2. prompt catalog version scan
3. no src/map-plugins import in AI registry
4. visual-story coherence scan
5. muscle-memory catalog check
6. child capability strength inventory
7. actionCode -> child capability binding check
8. CLICK_CELL -> Geometry Guard check
9. Forensics visual mission round record check
```

---

## 10. 当前重点 P0 处理对象

优先检查并处理：

```txt
src/capabilities/ai/prompt-contracts/registry.ts
```

禁止 active registry 注册：

```txt
map.authoring.v1.prompt-contract.json
vision.pagePreparation.v1.prompt-contract.json
vision.nextItemAdvanced.v1.prompt-contract.json
vision.productPresence.v1.prompt-contract.json
vision.nextItemTargetCandidate.v1.prompt-contract.json
vision.commentsEntryTargetCandidate.v1.prompt-contract.json
```

禁止 active registry import：

```txt
src/map-plugins/**
MAP_AUTHORING_SYSTEM_PROMPT_TEMPLATE
MAP_AUTHORING_USER_PROMPT_TEMPLATE
```

禁止 catalog version：

```txt
map-prompt-contract-catalog.v1
```

应改为：

```txt
ai-prompt-contract-catalog.v1
```

或：

```txt
visual-mission-prompt-contract-catalog.v1
```

---

## 11. Code Purity / Visual Story Coherence 必须覆盖

必须确保 inspector 能阻断：

```txt
registry.ts 注册 retired promptContractId
registry.ts import src/map-plugins/**
PROMPT_CONTRACT_CATALOG_VERSION 包含 map
active prompt builtins 包含：
  - vision.pagePreparation
  - vision.productPresence
  - vision.nextItemAdvanced
  - vision.nextItemTargetCandidate
  - vision.commentsEntryTargetCandidate
  - map.authoring
ci-full-summary 出现 map-layer / map-plugin-package
active docs/法案辅助文件 出现 Map Prompt / Map Authoring / Route Plan 生产施工图
AI 输出 routeLabel
AI 输出 routePlanId
AI 输出 selectedMapId
AI 输出 raw x/y
AI 输出 abilityGroupId / childCapabilityId
```

---

## 12. 代码文件重写标准

重写代码必须满足：

```txt
1. 文件小。
2. 函数小。
3. 职责单一。
4. owner 边界清楚。
5. 不新增 bridge / fallback / compat。
6. 不新增第二实现。
7. 不新增 mock/fake/demo 到 production path。
8. 不使用 any / ts-ignore / eslint-disable。
9. 不绕过 Nerve Bus。
10. 不绕过 Orchestration / Scheduler。
11. 不恢复 map lifecycle。
12. 不恢复 RoutePlan / routeLabel / selectedMapId / taskTemplateId。
13. 不把 PAV 恢复成 universal mandatory gate。
14. PAV 只能作为 policy-driven optional verification capability。
15. CLICK_CELL 必须经 Geometry Guard。
16. Mouse Click 不得解析 gridCell。
17. AI 不得输出 raw x/y。
18. AI 不得输出 abilityGroupId / childCapabilityId。
19. AI 只能输出 governed actionCode。
20. ActionCode 必须来自 MuscleMemoryCatalog。
```

---

## 13. Inspector 重写标准

重写 inspector 必须满足：

```txt
1. 小文件。
2. 单 owner。
3. 单职责。
4. 不超过 code-purity 限制。
5. 使用 ts-morph / AST / symbol / import graph / schema / JSON traversal。
6. grep / regex / includes 只能辅助，不能作为最终判断。
7. 必须检查 required shape。
8. 必须检查 forbidden shape。
9. 必须检查 owner boundary。
10. 必须检查 anti-escape。
11. 必须能 fail。
12. 必须有 real-code-inspection。
```

禁止：

```txt
warning-only
info-only
no-op pass
fake pass
空 real-code-inspection
只检查文件存在
只检查字符串存在
```

---

## 14. 每轮修复后的复验

每修完一个违规，必须运行：

```bash
npm run ci:full
```

如果 ci:full 仍失败：

```txt
读取新的第一个阻断项。
继续循环。
```

如果同一个阻断项仍失败：

```txt
继续当前项，不得跳过。
```

---

## 15. 最终双绿确认

当 `npm run ci:full` 第一次全绿后，必须再执行一次：

```bash
npm run ci:full
```

第二次也全绿，才允许最终输出。

不得额外扩大为大规模 GLOBAL-RECHECK。  
不得引入新的重型检查目标。  
本提示词只以 CI-FULL 双次全绿为最终出口。

---

## 16. 最终报告格式

只有 CI-FULL 连续两次全绿，才输出：

```txt
[FINAL-CI-FULL-VISUAL-STORY-REPORT]

1. VERDICT
CI-FULL TRUE GREEN

2. LOOP COUNT
总循环次数：
处理违规数量：

3. EACH VIOLATION
- 违规：
- 违规类型：
- 裁决：
- 通读法条：
- 通读施工图：
- 通读 inspector / runner / manifest：
- 修复动作：
- 是否删除重写：
- 是否 retired system：
- 是否 protected seam：
- 复验结果：

4. FILES MODIFIED
- inspector files:
- real-code-inspection files:
- code files:
- generated files by ci:full only:
- law files:
- blueprint files:

5. FREEZE CHECK
- 是否恢复 map：NO
- 是否恢复 RoutePlan：NO
- 是否恢复 routeLabel：NO
- 是否恢复 taskTemplate：NO
- 是否恢复 selectedMapId：NO
- 是否恢复 activationSnapshotRef：NO
- 是否恢复 universal mandatory PAV：NO
- 是否降低法案：NO
- 是否降低施工图：NO
- 是否关闭 inspector：NO
- 是否删除 real-code-inspection：NO
- 是否手改 generated：NO
- 是否新增 bridge/fallback/compat：NO

6. FINAL COMMANDS
- npm run ci:full first green:
- npm run ci:full second green:

7. FINAL SENTENCE
CI-FULL 已真实全绿；最新视觉故事情节未被破坏；旧地图/RoutePlan/routeLabel 主权未被恢复；代码、质检脚本与生成物已按最新法案和施工图完成真实修复。
```

---

## 17. 禁止最终报告条件

以下任一存在，不得输出最终报告：

```txt
CI-FULL 未全绿
只绿了一次，没有第二次确认
恢复 map
恢复 RoutePlan
恢复 routeLabel
恢复 taskTemplate
恢复 selectedMapId
恢复 activationSnapshotRef
恢复 map.authoring
恢复 universal mandatory PAV
法案被降级
施工图被降级
inspector 被关闭
real-code-inspection 被删除
generated 被手工改
通过 warning/info/no-op 当 PASS
新增 bridge/fallback/compat
代码迁就错误 inspector
```

---

## 18. 一句话启动纪律

```txt
现在开始：
运行 npm run ci:full。
读取第一个违规。
通读对应最新法条。
通读对应最新施工图。
通读对应 inspector / runner / manifest。
判断谁错。
错的是 inspector 就删除重写 inspector。
错的是代码文件就删除重写代码文件。
错的是 generated/runner 漂移就修真实 source 后重新生成。
如果是法案/施工图冲突就停止并输出用户裁决请求。
修完重新跑 npm run ci:full。
循环直到 CI-FULL 连续两次全绿。
```

# END
