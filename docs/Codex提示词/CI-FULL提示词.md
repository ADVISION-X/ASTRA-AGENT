# GrassEye CI-FULL 物理切割后真实推绿循环 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-CI-FULL-PHYSICAL-CUT-REAL-GREEN-LOOP-FINAL
documentType: codex-execution-prompt
targetExecutor: Codex
executionMode: single-long-running-loop
coreGoal: run-ci-full-authenticate-violation-against-current-law-blueprint-inspector-fix-without-compat-rerun-until-true-green
systemStage: post-physical-cut-visual-mission-mainline
status: active
```

本提示词用于 GrassEye 完成旧路线物理切割后的 CI-FULL 真实推绿循环。

本任务不是重新规划系统。  
本任务不是恢复旧系统。  
本任务不是为了把红色 CI 临时抹绿。  
本任务不是用兼容层、fallback、alias、empty stub 糊住错误。  

本任务只有一个目标：

```txt
在当前新主线下，把 CI-FULL 推到真实全绿。
```

当前唯一允许的主线是：

```txt
UserRequirement
→ PlatformRegistry
→ RoundMissionPacket
→ VisualMissionPromptContract
→ VisualMissionJudge
→ ActionCode
→ MuscleMemoryCatalog
→ GeometryGuard / Capabilities
→ Forensics
```

旧路线权威不得回归：

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
approve-candidate / reject-candidate as production continuation
fragmented AI judge refs
debug-loop / repair-packet active shadow
```

---

## 1. 最高铁律

### 1.1 当前权威顺序

CI-FULL 不是权威源。  
CI-FULL 只负责暴露当前阻断项。

权威顺序：

```txt
当前 active 法案
→ 当前 active 施工图
→ 当前 active 执法脚本 / inspector
→ 当前生产代码
→ CI-FULL 报错
```

CI 报错后，不得立刻乱改。  
必须先判断：

```txt
代码错？
inspector 错？
执法覆盖缺失？
generated / runner 漂移？
active 法案 / 施工图自身冲突，需要用户裁决？
旧系统残影导致 CI 回归？
```

---

### 1.2 法案 / 施工图处理边界

当前阶段分两种情况。

#### 情况 A：用户已经明确授权物理切割治理已经执行完成

则：

```txt
active 法案和 active 施工图应当只承认新主线。
本轮 CI-FULL 推绿不应再改法案内容和施工图内容。
```

允许：

```txt
修正格式
修正明显编码错误
修正断链引用
修正 generated routing 指向已删除文件
```

禁止：

```txt
降低法案
弱化 MUST / FORBIDDEN
新增 exception
新增 waiver
新增 allowlist
为了过 CI 恢复旧路线
为了过 CI 修改新主线原则
```

#### 情况 B：CI 暴露 active 法案 / active 施工图仍然引用旧路线权威

例如仍出现：

```txt
OperationalMap
map-lab
taskTemplateId
activationId
routePlanId
approve-candidate production continuation
productPresenceAiResultRef as standalone judge
```

处理：

```txt
不得恢复旧代码迁就旧法案/施工图。
不得新增兼容层。
输出 LAW-BLUEPRINT-STALE-REFERENCE，等待用户裁决或执行已授权的物理切割法案同步。
```

如果用户此前已经明确授权“物理切割、禁止兼容、禁止回归”，Codex 可按该授权删除旧引用，但必须在报告中标记：

```txt
STALE-LAW-BLUEPRINT-REFERENCE-REMOVED-BY-PHYSICAL-CUT-AUTHORIZATION
```

---

### 1.3 禁止旧系统回归

任何修复都不得重新引入：

```txt
compat alias
legacy wrapper
deprecated stub
empty old store
fallback to retired route
old field adapter
repo internal archive of retired system
hand-edited generated fake pass
```

禁止示例：

```ts
export type OperationalMap = RuntimePlan;
const EMPTY_ORCHESTRATION_MAP_STORE = ...
function legacySelectedMapIdToMissionPlan(...)
```

正确方式：

```txt
删除旧物。
调用方迁移到新主线。
必要时建立全新命名的新结构，但不得引用旧名。
```

---

## 2. 唯一主循环

Codex 必须严格按此循环执行。

```txt
LOOP START

1. 运行 npm run ci:full。
2. 如果 CI-FULL 全绿，进入 Final Global Guard。
3. 如果 CI-FULL 报错，只提取当前第一个阻断项。
4. 定位该阻断项对应 owner。
5. 读取对应 active 法案。
6. 读取对应 active 施工图。
7. 读取对应 inspector / runner / manifest / generated 关系。
8. 判断是谁错：
   A. CODE_FILE_WRONG
   B. INSPECTOR_WRONG
   C. ENFORCEMENT_MISSING
   D. GENERATED_OR_RUNNER_DRIFT
   E. STALE_LAW_BLUEPRINT_REFERENCE
   F. RETIRED_AUTHORITY_RESIDUE
   G. LAW_BLUEPRINT_CONFLICT_NEEDS_USER
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
只看 CI 报错不读法案
只看法案不读施工图
只看施工图不读 inspector
只改代码不鉴权 inspector
只改 inspector 不修真实代码
修一个报错就停止
CI 报错减少就宣称完成
CI-FULL 未全绿就输出最终完成
```

---

## 3. 每个违规的最小处理格式

每个阻断项必须输出：

```txt
[CI-VIOLATION]
失败命令：
失败文件：
失败位置：
失败 owner：
相关 active 法案文件：
相关 lawId：
相关 active 施工图：
相关 inspector：
相关 runner/manifest/generated：
相关代码文件：
是否涉及旧路线权威：YES/NO
```

然后输出：

```txt
[AUTH-READ]
已通读 active 法条：YES/NO
已通读 active 施工图：YES/NO
已通读 inspector/runner/manifest：YES/NO
已检查是否旧路线残影：YES/NO
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
7. LAW_BLUEPRINT_CONFLICT_NEEDS_USER
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

## 4. 七种裁决怎么修

### 4.1 CODE_FILE_WRONG

定义：

```txt
生产代码违反 active 法案、active 施工图、且 inspector 经鉴权是合法的。
```

处理：

```txt
删除违规代码 / 物理切割违规模块 / 用新主线重写。
不得小补丁糊住。
不得新增 bridge。
不得新增 fallback。
不得新增兼容层。
不得新增第二实现。
不得恢复旧路线字段。
```

输出：

```txt
[CODE-FILE-REWRITE]
违规原因：
删除/重写文件：
新文件职责：
为什么不是补丁：
是否引入旧路线：NO
```

---

### 4.2 INSPECTOR_WRONG

定义：

```txt
inspector 逻辑错误、越权、误读 active 法案、误读 active 施工图，或仍按旧路线执法。
```

处理：

```txt
删除并重写该 inspector。
重写后必须以 active 法案和 active 施工图为准。
如果 inspector 自身含旧路线明文 token，应改为碎片拼接或抽象 forbidden authority 检测。
```

禁止：

```txt
把 FAIL 改 WARNING
注释掉检查
跳过检查
新增 exception
新增 allowlist
为了 inspector 误报恢复旧代码
```

输出：

```txt
[INSPECTOR-REWRITE]
错误逻辑：
对应 active 法条：
对应 active 施工图：
删除重写文件：
新 inspector 覆盖点：
是否明文污染旧词搜索：NO
```

---

### 4.3 ENFORCEMENT_MISSING

定义：

```txt
active 法案 / active 施工图有明确要求，但 inspector 未覆盖。
```

处理：

```txt
补齐 inspector。
补齐 real-code-inspection。
补齐 manifest / runner 入口。
必须能 fail。
```

特别要求：

```txt
如果缺的是旧路线回归阻断，必须新增 fatal 执法。
不得只写文档。
```

输出：

```txt
[ENFORCEMENT-ADD]
缺失要求：
新增 inspector：
新增 real-code-inspection：
新增 forbidden regression gate：
```

---

### 4.4 GENERATED_OR_RUNNER_DRIFT

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

### 4.5 STALE_LAW_BLUEPRINT_REFERENCE

定义：

```txt
active 法案或 active 施工图仍引用已退役旧路线，但用户已明确要求物理切割。
```

处理：

```txt
如果用户授权已覆盖物理切割，则删除旧引用并同步新主线。
如果授权不清晰，停止并请求用户裁决。
```

禁止：

```txt
恢复旧代码迁就 stale 法案/施工图。
```

输出：

```txt
[STALE-LAW-BLUEPRINT-REFERENCE]
旧引用：
所在法案/施工图：
新主线替代：
是否已有用户物理切割授权：
处理动作：
```

---

### 4.6 RETIRED_AUTHORITY_RESIDUE

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
调用方迁移到新主线。
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

### 4.7 LAW_BLUEPRINT_CONFLICT_NEEDS_USER

定义：

```txt
active 法案与 active 施工图真实冲突，且用户未授权 Codex 裁决。
```

处理：

```txt
停止当前项。
不得继续猜。
不得修改法案内容。
不得修改施工图内容。
输出最小用户裁决选项。
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

## 5. 新主线代码重写标准

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
11. 不绕过 RoundMissionPacket。
12. 不绕过 VisualMissionPromptContract。
13. 不绕过 MuscleMemoryCatalog。
14. 不绕过 GeometryGuard。
15. 不绕过 Forensics proof。
```

注意：

```txt
旧提示词中的“不绕过 map lifecycle / PAV”已废止。
不得再把 map lifecycle 或 PAV 当作必须主线。
```

当前主线是：

```txt
RoundMissionPacket + VisualMissionJudge + ActionCode + MuscleMemoryCatalog + GeometryGuard + Forensics
```

---

## 6. Inspector 重写标准

重写 inspector 必须满足：

```txt
1. 小文件。
2. 单 owner。
3. 单职责。
4. 不明文污染退役关键词搜索。
5. 使用 AST / symbol / import graph / schema / JSON traversal。
6. grep/regex/includes 只能辅助，不能作为唯一依据。
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

## 7. Final Global Guard

当 `npm run ci:full` 第一次全绿后，不得立刻最终报告。  
必须执行全局回归搜索。

### 7.1 旧路线权威搜索

运行：

```bash
rg -n "map-lab|MapLab|map-authoring|MapAuthoring|map-plugin-package|MapPlugin|OperationalMap|OperationalMapId|execute-map-step|selectedMapId|preferredMapId|mapPackageId|activationSnapshotRef" src docs .github scripts
```

期望：

```txt
无命中
```

### 7.2 旧模板/激活/路线搜索

运行：

```bash
rg -n "taskTemplateId|activationId|routePlanId|routeLabel|selectedMapSource|preferredMapId|selectedMapId" src docs .github scripts
```

期望：

```txt
无命中
```

### 7.3 旧人审候选继续路径搜索

运行：

```bash
rg -n "approve-candidate|reject-candidate|candidate-api-handlers|review-decision|candidate disposition|candidate review" src docs .github scripts
```

期望：

```txt
无命中
```

### 7.4 旧碎片 AI 裁判搜索

运行：

```bash
rg -n "pagePreparationAiResultRef|productPresenceAiResultRef|commentCleanupAiResultRef|nextItemVerification|visualTargetResultRef|aiTargetCandidateRef|targetCandidateRef|nextItemTargetCandidateRef" src docs .github scripts
```

期望：

```txt
无命中
```

### 7.5 历史/debug 产物搜索

运行：

```bash
rg -n "debug-loop|repair-packet|adhoc" src docs .github scripts
```

期望：

```txt
无命中
```

如果任何搜索命中 active path：

```txt
不得最终报告。
按 RETIRED_AUTHORITY_RESIDUE 处理。
```

如果只命中执法脚本自身：

```txt
检查是否明文污染。
若明文污染，改为 token fragments。
```

---

## 8. 最终双绿确认

Final Global Guard 通过后，必须再运行：

```bash
npm run ci:full
```

只有：

```txt
CI-FULL 第一次全绿
+ Final Global Guard 全部通过
+ CI-FULL 第二次全绿
```

才允许最终报告。

---

## 9. 最终报告格式

只有全部通过，才输出：

```txt
[FINAL-CI-FULL-PHYSICAL-CUT-REPORT]

1. VERDICT
CI-FULL TRUE GREEN UNDER NEW VISUAL MISSION MAINLINE

2. LOOP COUNT
总循环次数：
处理违规数量：

3. EACH VIOLATION
- 违规：
- 裁决：
- 通读 active 法条：
- 通读 active 施工图：
- 通读 inspector/runner：
- 是否涉及旧路线残影：
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

5. PHYSICAL CUT CHECK
- 是否新增 compat/alias：NO
- 是否新增 empty stub：NO
- 是否新增 deprecated wrapper：NO
- 是否 repo 内归档旧系统：NO
- 是否恢复旧路线字段：NO
- 是否手改 generated：NO

6. FINAL GLOBAL GUARD
- 旧路线权威搜索：
- 旧模板/激活/路线搜索：
- 旧人审候选继续路径搜索：
- 旧碎片 AI 裁判搜索：
- 历史/debug 产物搜索：

7. FINAL COMMANDS
- npm run ci:full first green:
- final global guard:
- npm run ci:full second green:

8. FINAL SENTENCE
CI-FULL 已在新 Visual Mission 主线下真实全绿；旧路线权威已物理切割；无兼容层、无回归口、无 generated 残影。
```

---

## 10. 禁止最终报告条件

以下任一存在，不得输出最终报告：

```txt
CI-FULL 未全绿
只绿一次，没有第二次确认
Final Global Guard 未跑
Final Global Guard 有 active 命中
新增 compat / fallback / alias
新增 empty old store
新增 deprecated wrapper
repo 内归档旧系统
恢复旧路线字段
旧人审候选继续路径仍在
碎片 AI 裁判 refs 仍在
generated 手工伪造
inspector 被关闭
real-code-inspection 被删除
warning/info/no-op 当 PASS
```

---

## 11. 一句话启动纪律

```txt
现在开始：
运行 npm run ci:full。
读取第一个阻断项。
通读 active 法条。
通读 active 施工图。
通读 inspector/runner/manifest。
判断谁错。
如果是旧路线残影，物理切割。
如果是代码错，按新主线删除重写。
如果是 inspector 错，按新主线删除重写。
如果是 generated 漂移，修 source 后重新生成。
每修一项重新跑 npm run ci:full。
CI-FULL 首次全绿后跑 Final Global Guard。
Final Global Guard 通过后再跑 npm run ci:full。
连续确认后输出最终报告。
```

# END
