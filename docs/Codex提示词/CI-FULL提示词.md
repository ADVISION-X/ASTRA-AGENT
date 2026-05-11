# GrassEye CI-FULL 简单能力机器真实推绿循环 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-CI-FULL-SIMPLE-ABILITY-MACHINE-REAL-GREEN-LOOP-FINAL
documentType: codex-execution-prompt
targetExecutor: Codex
executionMode: single-long-running-loop
coreGoal: run-ci-full-fix-current-blocker-under-simple-ability-machine-law-rerun-until-true-green
systemStage: simple-ability-machine-mainline
status: active
```

本提示词用于 GrassEye 当前“简单能力机器”阶段的 CI-FULL 真实推绿循环。

本任务不是重新规划系统。  
本任务不是恢复旧地图系统。  
本任务不是恢复套餐动作系统。  
本任务不是恢复 PAV 宇宙。  
本任务不是恢复审计矩阵宇宙。  
本任务不是为了把红色 CI 临时抹绿。  

本任务只有一个目标：

```txt
在“用户提供需求、系统提供能力、AI 指挥系统完成需求”的新主线下，把 CI-FULL 推到真实全绿。
```

---

## 1. 当前最高主线

GrassEye 当前最高定义：

```txt
用户提供需求；
系统提供能力；
AI 根据用户需求 + 当前画面 + 能力登记册，组合能力；
系统校验、注入、调度、执行、留证。
```

当前唯一允许的简单公式：

```txt
userRequirement + selectedPlatforms
→ PlatformRegistry + MuscleMemoryCatalog
→ current screenshot / evidence bundle
→ AI judgment + registry-backed atomic capability composition
→ System validation / ref injection / geometry guard / dispatch
→ owning capability-group public contract
→ atomic child capability execution
→ Forensics evidence
```

其中：

```txt
MuscleMemoryCatalog = 能力登记册
Capability Group = 能力提供部门
Child Capability = 不可再拆的真实原子动作
AI = 能力组合者
System = 校验 / 注入 / 调度 / 执行 / 留证
QA = 简单护栏
```

---

## 2. 当前最高禁止

以下内容不得作为当前主线、不得被 CI 恢复、不得被 inspector 保护为正向系统：

```txt
map system
map-lab
map-authoring
map-plugin-package
OperationalMap
execute-map-step
selectedMapId
preferredMapId
mapPackageId
activationSnapshotRef
taskTemplateId
activationId
routePlanId
routeLabel
map prompt governance
map binding drift

workflow catalog
package catalog
business-flow catalog
semantic-shortcut catalog
YES_SEEDING_VIDEO_FLOW as final ability
NO_SEEDING_VIDEO_FLOW as final ability
SAVE_PRODUCT_AND_LIKE as final ability
LIKE_CURRENT_VIDEO as final child capability
OPEN_COMMENTS as final child capability
NEXT_VIDEO as final child capability

mandatory PAV lifecycle
PAV as universal gate
PAV as second semantic judge
fragmented AI judge refs
productPresenceAiResultRef as standalone judge
pagePreparationAiResultRef
commentCleanupAiResultRef
nextItemVerification*
visualTargetResultRef
aiTargetCandidateRef
targetCandidateRef

approve-candidate / reject-candidate as production continuation
candidate-api-handlers as production continuation
debug-loop / repair-packet / adhoc active shadows
generated matrix universe
report universe
default inventory universe
```

---

## 3. 权威顺序

CI-FULL 不是权威源。  
CI-FULL 只负责暴露当前阻断项。

当前权威顺序：

```txt
用户当前明确立场
→ GrassEye 简单能力机器总纲施工图
→ Muscle Memory Catalog 能力登记册施工图
→ Child Capability Strength 子能力强度施工图
→ 当前 active 法案
→ 当前 active inspector / runner / manifest
→ 当前生产代码
→ CI-FULL 报错
```

如果 active 法案、active 施工图、inspector 与“简单能力机器”主线冲突：

```txt
不得恢复旧代码迁就旧法案。
不得新增兼容层迁就旧 inspector。
不得把旧系统打补丁救活。
应把冲突项判定为 STALE_LAW_BLUEPRINT_REFERENCE 或 INSPECTOR_WRONG。
```

---

## 4. 本轮允许修改范围

允许修改：

```txt
src/**
scripts/audit/**
.github/instructions/cursor-rules/**
docs/法案辅助文件/**
package.json / npm scripts（仅限修正真实 CI 路由）
generated artifacts（只能通过生成命令重建）
```

但必须遵守：

```txt
不新增兼容层。
不新增第二实现。
不恢复旧系统。
不手改 generated 伪造 PASS。
不新建大而全质检宇宙。
```

---

## 5. 唯一主循环

Codex 必须严格按此循环执行。

```txt
LOOP START

1. 运行 npm run ci:full。
2. 如果 CI-FULL 全绿，进入 Simple Mainline Guard。
3. 如果 CI-FULL 报错，只提取当前第一个阻断项。
4. 定位该阻断项对应 owner。
5. 读取对应当前最高施工图。
6. 读取对应 active 法案。
7. 读取对应 inspector / runner / manifest / generated 关系。
8. 判断是谁错：
   A. CODE_FILE_WRONG
   B. INSPECTOR_WRONG
   C. ENFORCEMENT_MISSING
   D. GENERATED_OR_RUNNER_DRIFT
   E. STALE_LAW_BLUEPRINT_REFERENCE
   F. RETIRED_AUTHORITY_RESIDUE
   G. QA_OVERGROWTH_VIOLATION
   H. LAW_BLUEPRINT_CONFLICT_NEEDS_USER
9. 按裁决修复。
10. 运行 npm run ci:full。
11. 如果同一阻断项仍失败，继续处理同一项。
12. 如果出现新第一个阻断项，回到第 4 步。
13. 直到 CI-FULL 全绿。

LOOP END
```

禁止：

```txt
一次处理一堆问题然后不复验
只看 CI 报错不读施工图
只看法案不读 inspector
只改代码不鉴权 inspector
只改 inspector 不修真实代码
修一个报错就停止
CI 报错减少就宣称完成
CI-FULL 未全绿就输出最终完成
```

---

## 6. 每个违规的最小处理格式

每个阻断项必须输出：

```txt
[CI-VIOLATION]
失败命令：
失败文件：
失败位置：
失败 owner：
相关最高施工图：
相关 active 法案文件：
相关 lawId：
相关 inspector：
相关 runner/manifest/generated：
相关代码文件：
是否涉及旧路线权威：YES/NO
是否涉及套餐/流程/PAV/质检宇宙：YES/NO
```

然后输出：

```txt
[AUTH-READ]
已通读最高施工图：YES/NO
已通读 active 法条：YES/NO
已通读 inspector/runner/manifest：YES/NO
已检查是否偏离简单能力机器：YES/NO
```

然后输出：

```txt
[FAULT-JUDGMENT]
裁决只能是以下之一：

1. CODE_FILE_WRONG
2. INSPECTOR_WRONG
3. ENFORCEMENT_MISSING
4. GENERATED_OR_RUNNER_DRIFT
5. STALE_LAW_BLUEPRINT_REFERENCE
6. RETIRED_AUTHORITY_RESIDUE
7. QA_OVERGROWTH_VIOLATION
8. LAW_BLUEPRINT_CONFLICT_NEEDS_USER
```

不得输出：

```txt
可能是
大概是
暂时接受
后续再看
应该没事
```

---

## 7. 八种裁决怎么修

---

### 7.1 CODE_FILE_WRONG

定义：

```txt
生产代码违反简单能力机器主线、最高施工图、active 法案，且 inspector 经鉴权是合法的。
```

处理：

```txt
删除违规代码 / 物理切割违规模块 / 用简单能力机器主线重写。
不得小补丁糊住。
不得新增 bridge。
不得新增 fallback。
不得新增兼容层。
不得新增第二实现。
不得恢复旧路线字段。
```

修复方向：

```txt
用户需求入口更简单。
能力登记册更清楚。
子能力更原子。
AI 更自由组合能力。
系统只校验、注入、调度、留证。
生产文件更少、更小、更单一。
```

输出：

```txt
[CODE-FILE-REWRITE]
违规原因：
删除/重写文件：
新文件职责：
为什么不是补丁：
是否引入旧路线：NO
是否增加复杂系统：NO
```

---

### 7.2 INSPECTOR_WRONG

定义：

```txt
inspector 逻辑错误、越权、误读最高施工图、误读 active 法案，或仍按旧路线/PAV/套餐/矩阵宇宙执法。
```

处理：

```txt
删除并重写该 inspector。
重写后必须只回答一个清楚的 blocking question。
PASS 输出短。
FAIL 输出 file + lawId + reason + fix direction。
不得默认输出大 inventory。
不得保存旧系统叙事。
```

禁止：

```txt
把 FAIL 改 WARNING
注释掉检查
跳过检查
新增 exception
新增 allowlist
为了 inspector 误报恢复旧代码
新增大而全 report
新增 generated matrix universe
```

输出：

```txt
[INSPECTOR-REWRITE]
错误逻辑：
对应最高施工图：
对应 active 法条：
删除重写文件：
新 inspector 只回答的问题：
PASS 输出是否短：YES
FAIL 输出是否可修：YES
是否明文污染旧词搜索：NO
```

---

### 7.3 ENFORCEMENT_MISSING

定义：

```txt
最高施工图 / active 法案有明确要求，但 inspector 未覆盖。
```

处理：

```txt
补齐最小 inspector。
补齐 real-code-inspection。
补齐 manifest / runner 入口。
必须能 fail。
必须小。
```

特别要求：

```txt
如果缺的是“简单能力机器不被旧系统污染”，只允许新增一个小型 no-regression gate。
不得新增十几个扫描器。
不得新增默认大报告。
```

输出：

```txt
[ENFORCEMENT-ADD]
缺失要求：
新增 inspector：
新增 real-code-inspection：
新增 forbidden regression gate：
为什么是最小实现：
```

---

### 7.4 GENERATED_OR_RUNNER_DRIFT

定义：

```txt
source truth、manifest、runner、generated artifacts 之间漂移。
```

处理：

```txt
修 source / manifest / generator / runner。
重新生成。
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

### 7.5 STALE_LAW_BLUEPRINT_REFERENCE

定义：

```txt
active 法案或 active 施工图仍引用已退役路线、套餐、PAV、map、质检宇宙，并与用户当前最高立场冲突。
```

处理：

```txt
按简单能力机器主线删除旧引用并同步新口径。
不得恢复旧代码迁就 stale 法案/施工图。
不得新增兼容层。
```

输出：

```txt
[STALE-LAW-BLUEPRINT-REFERENCE]
旧引用：
所在法案/施工图：
新主线替代：
处理动作：
```

---

### 7.6 RETIRED_AUTHORITY_RESIDUE

定义：

```txt
代码、文档、generated、UI、API、runtime、test、CI 中残留旧路线权威。
```

包括但不限于：

```txt
map-lab
map-authoring
map-plugin-package
OperationalMap
execute-map-step
selectedMapId
preferredMapId
mapPackageId
activationSnapshotRef
taskTemplateId
activationId
routePlanId
routeLabel
show-operational-map-progress
approve-candidate / reject-candidate production continuation
fragmented AI judge refs
debug-loop / repair-packet active shadows
```

处理：

```txt
物理删除。
不得归档到 repo 内。
不得兼容。
不得 deprecated。
不得 empty stub。
不得 alias。
调用方迁移到简单能力机器主线。
```

输出：

```txt
[RETIRED-AUTHORITY-PHYSICAL-CUT]
残留对象：
残留位置：
删除文件：
迁移到的新主线：
搜索验收：
```

---

### 7.7 QA_OVERGROWTH_VIOLATION

定义：

```txt
质检系统自身变成第二系统、第二架构模型、generated 矩阵宇宙、report universe、default inventory universe。
```

典型表现：

```txt
inspector 默认输出大 inventory
PASS 时生成大报告
一个 inspector 检查十几个无关问题
generated artifact 被当成架构真相
code purity 保存旧 map/PAV/package 叙事
CI-FULL 维护旧系统历史
```

处理：

```txt
删除大报告。
删除默认 inventory。
拆掉或删除大而全 inspector。
保留一问一答的 blocking guardrail。
generated artifacts 只做 support evidence。
```

输出：

```txt
[QA-OVERGROWTH-CUT]
膨胀对象：
为什么是第二系统：
删除/重写文件：
保留的最小护栏：
```

---

### 7.8 LAW_BLUEPRINT_CONFLICT_NEEDS_USER

定义：

```txt
最高施工图、active 法案、用户当前立场之间出现真实冲突，且 Codex 无法根据当前授权裁决。
```

处理：

```txt
停止当前项。
不得继续猜。
不得修改冲突内容。
输出最小用户裁决选项。
```

输出：

```txt
[LAW-BLUEPRINT-CONFLICT-NEEDS-USER]
冲突施工图：
冲突法条：
CI 报错：
为什么 Codex 无权自行改：
最小用户裁决选项：
```

---

## 8. 新主线代码重写标准

重写代码必须满足：

```txt
1. 小文件。
2. 小函数。
3. 单职责。
4. owner 边界清楚。
5. 不新增 bridge/fallback/compat。
6. 不新增第二实现。
7. 不新增 mock/fake/demo 到 production path。
8. 不使用 any / ts-ignore / eslint-disable。
9. 不绕过 Nerve Bus。
10. 不绕过 Orchestration。
11. 不绕过 MuscleMemoryCatalog。
12. 不绕过 GeometryGuard。
13. 不绕过 Forensics proof。
14. 不把 semantic action / workflow / package 重新升级为主线。
15. 不把 PAV 重新升级为全局 gate。
```

注意：

```txt
RoundMissionPacket 可以作为 task-needed continuity support。
它不是所有任务的强制默认。
ActionCode 可以作为 transitional transport alias。
它不是最终能力定义。
VisualMissionPromptContract 是 AI support contract。
它不是执行主权。
```

当前主线是：

```txt
UserRequirement + PlatformRegistry + MuscleMemoryCatalog + current evidence
→ AI composes registered atomic child capabilities
→ System validates / injects / dispatches / records evidence
```

---

## 9. Inspector 重写标准

重写 inspector 必须满足：

```txt
1. 小文件。
2. 单 owner。
3. 单职责。
4. 一个 inspector 只回答一个 blocking question。
5. PASS 输出短。
6. FAIL 输出 file + lawId + reason + fix direction。
7. 不默认输出大 inventory。
8. 不创造 generated matrix universe。
9. 不保存旧系统叙事。
10. 使用 AST / symbol / import graph / schema / JSON traversal。
11. grep/regex/includes 只能辅助，不能作为唯一依据。
12. 必须能 fail。
13. 必须有 real-code-inspection。
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
报告很多但不能阻断
```

---

## 10. Simple Mainline Guard

当 `npm run ci:full` 第一次全绿后，不得立刻最终报告。  
必须执行简单主线守门搜索。

### 10.1 旧路线权威搜索

运行：

```bash
rg -n "map-lab|MapLab|map-authoring|MapAuthoring|map-plugin-package|MapPlugin|OperationalMap|OperationalMapId|execute-map-step|selectedMapId|preferredMapId|mapPackageId|activationSnapshotRef|taskTemplateId|activationId|routePlanId|routeLabel" src docs .github scripts
```

期望：

```txt
无 active 正向命中
```

### 10.2 旧套餐 / 语义动作主权搜索

运行：

```bash
rg -n "YES_SEEDING_VIDEO_FLOW|NO_SEEDING_VIDEO_FLOW|SAVE_PRODUCT_AND_LIKE|LIKE_CURRENT_VIDEO|OPEN_COMMENTS|NEXT_VIDEO|workflow catalog|package catalog|business-flow catalog|semantic-shortcut catalog" src docs .github scripts
```

允许命中：

```txt
反例
历史过渡
待治理差异
```

禁止命中：

```txt
最终子能力定义
AI manual final truth
系统调度主权
```

### 10.3 旧 PAV / 碎片 AI 裁判搜索

运行：

```bash
rg -n "PAV lifecycle|mandatory PAV|pagePreparationAiResultRef|productPresenceAiResultRef|commentCleanupAiResultRef|nextItemVerification|visualTargetResultRef|aiTargetCandidateRef|targetCandidateRef|nextItemTargetCandidateRef" src docs .github scripts
```

期望：

```txt
无 active 正向命中
```

### 10.4 旧人审继续路径搜索

运行：

```bash
rg -n "approve-candidate|reject-candidate|candidate-api-handlers|review-decision|candidate disposition|candidate review" src docs .github scripts
```

期望：

```txt
无 production continuation 正向命中
```

### 10.5 质检宇宙搜索

运行：

```bash
rg -n "generated matrix universe|report universe|default inventory universe|Zombie Graph Cleanup|Map Prompt Contract Governance|Prompt contract and map binding drift|Visual Story Coherence" .github docs scripts/audit
```

期望：

```txt
无 active 正向命中
```

### 10.6 核心主线确认

运行：

```bash
rg -n "简单能力机器|能力登记册|atomic child capability|AI.*composes registered|simple guardrail|second runtime|second architecture" .github docs scripts/audit
```

必须命中核心法案 / 施工图 / 质检口径。

---

## 11. 最终双绿确认

Simple Mainline Guard 通过后，必须再运行：

```bash
npm run ci:full
```

只有：

```txt
CI-FULL 第一次全绿
+ Simple Mainline Guard 全部通过
+ CI-FULL 第二次全绿
```

才允许最终报告。

---

## 12. 最终报告格式

只有全部通过，才输出：

```txt
[FINAL-CI-FULL-SIMPLE-ABILITY-MACHINE-REPORT]

1. VERDICT
CI-FULL TRUE GREEN UNDER SIMPLE ABILITY MACHINE MAINLINE

2. LOOP COUNT
总循环次数：
处理违规数量：

3. EACH VIOLATION
- 违规：
- 裁决：
- 通读最高施工图：
- 通读 active 法条：
- 通读 inspector/runner：
- 是否涉及旧路线残影：
- 是否涉及套餐/PAV/质检宇宙：
- 修复动作：
- 是否删除重写：
- 复验结果：

4. FILES MODIFIED
- source files:
- inspector files:
- real-code-inspection files:
- law files:
- blueprint files:
- generated files:
- deleted files:

5. SIMPLE SYSTEM CHECK
- 用户需求入口是否保持：
- MuscleMemoryCatalog 是否保持能力登记册：
- AI 是否只组合登记原子能力：
- System 是否只校验/注入/调度/留证：
- Capability Group 是否仍是能力提供部门：
- Child Capability 是否仍是原子动作：
- QA 是否仍是简单护栏：

6. NO-GO CHECK
- 是否新增 compat/alias：NO
- 是否新增 empty stub：NO
- 是否新增 deprecated wrapper：NO
- 是否 repo 内归档旧系统：NO
- 是否恢复旧路线字段：NO
- 是否恢复套餐主权：NO
- 是否恢复 mandatory PAV：NO
- 是否恢复 QA universe：NO
- 是否手改 generated：NO

7. SIMPLE MAINLINE GUARD
- 旧路线权威搜索：
- 旧套餐/语义动作主权搜索：
- 旧 PAV/碎片 AI 搜索：
- 旧人审继续路径搜索：
- 质检宇宙搜索：
- 核心主线确认：

8. FINAL COMMANDS
- npm run ci:full first green:
- Simple Mainline Guard:
- npm run ci:full second green:

9. FINAL SENTENCE
CI-FULL 已在“用户提供需求、系统提供能力、AI 组合能力、系统执行留证”的简单能力机器主线下真实全绿；旧路线、套餐、PAV、质检宇宙未回归。
```

---

## 13. 禁止最终报告条件

以下任一存在，不得输出最终报告：

```txt
CI-FULL 未全绿
只绿一次，没有第二次确认
Simple Mainline Guard 未跑
Simple Mainline Guard 有 active 正向旧主权命中
新增 compat / fallback / alias
新增 empty old store
新增 deprecated wrapper
repo 内归档旧系统
恢复旧路线字段
恢复套餐动作主权
恢复 mandatory PAV
恢复 generated matrix universe
恢复 default inventory universe
碎片 AI 裁判 refs 仍在
旧人审候选继续路径仍在
generated 手工伪造
inspector 被关闭
real-code-inspection 被删除
warning/info/no-op 当 PASS
```

---

## 14. 一句话启动纪律

```txt
现在开始：
运行 npm run ci:full。
读取第一个阻断项。
通读最高施工图。
通读 active 法条。
通读 inspector/runner/manifest。
判断谁错。
如果是旧路线残影，物理切割。
如果是套餐/PAV/质检宇宙回归，物理切割。
如果是代码错，按简单能力机器删除重写。
如果是 inspector 错，按一问一答简单护栏删除重写。
如果是 generated 漂移，修 source 后重新生成。
每修一项重新跑 npm run ci:full。
CI-FULL 首次全绿后跑 Simple Mainline Guard。
Simple Mainline Guard 通过后再跑 npm run ci:full。
连续确认后输出最终报告。
```

# END
