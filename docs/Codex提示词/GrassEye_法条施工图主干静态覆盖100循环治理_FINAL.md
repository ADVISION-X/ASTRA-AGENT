
# GrassEye 清单驱动连续循环治理：未完成禁止停止版

## 最高死命令

本任务只有两条最高死命令：

```txt
死命令 1：必须按照《法条+施工图要求执法复查清单.md》的顺序，从第一条 requirement 执行到最后一条 requirement；清单未完成，禁止停止，禁止输出最终报告。

死命令 2：必须坚持“法条 + 施工图为主干，inspector 只是枝干，代码服从主干和合法 inspector”；每条 requirement 必须做到静态执法覆盖 100%，并修复对应真实代码问题，才能进入下一条。
````

任何总结、阶段报告、阶段性 NOT_PASS，都不得作为停止理由。

---

## 当前问题复盘

上一轮错误行为：

```txt
清单总数：15066
实际完成：2
然后输出 NOT_PASS 并停止
```

这是错误执行。

正确行为：

```txt
完成第 1 条
→ 自动进入第 2 条
→ 自动进入第 3 条
→ ...
→ 自动进入第 15066 条
→ 全部完成后才允许输出最终报告
```

除非遇到明确 BLOCKED，否则不得停止。

---

## 必须读取的唯一进程清单

先查找并读取：

```txt
法条+施工图要求执法复查清单.md
```

常见路径：

```txt
docs/Codex提示词/法条+施工图要求执法复查清单.md
docs/audit-reports/法条+施工图要求执法复查清单.md
```

找到后输出一次：

```txt
[CHECKLIST-LOADED]
file:
totalRequirements:
firstRequirementId:
lastRequirementId:
```

然后立即从第一条开始循环。

禁止重新生成清单。
禁止改变清单顺序。
禁止自己决定新的执行顺序。

---

## 主循环

对清单中的每一条 requirement，严格执行：

```txt
读取当前 requirement
→ 回读对应法条原文
→ 回读对应施工图段落
→ 读取对应 inspector / negative proof / run-inspector / manifest / package audit 命令
→ 判断 inspector 对该 requirement 是否静态覆盖 100%
→ 如果未覆盖 100%，删除/重写 inspector 对应逻辑
→ 如果缺 negative proof，补 negative proof
→ 运行 npm run audit:build
→ 运行 npm run audit:<owner>
→ 如果 audit 抓到真实代码违规，删除/重写/物理切割代码文件
→ 再次运行 npm run audit:build
→ 再次运行 npm run audit:<owner>
→ 当前 requirement 达到 100%
→ 自动读取下一条 requirement
```

---

## 每条 requirement 的完成标准

当前 requirement 只有同时满足以下条件，才允许进入下一条：

```txt
1. 已读取 requirement。
2. 已回读对应法条原文。
3. 已回读对应施工图段落。
4. 已读取对应 inspector。
5. inspector 静态覆盖该 requirement = 100%。
6. required negative proof 已存在并覆盖。
7. npm run audit:build PASS。
8. npm run audit:<owner> PASS。
9. inspector 抓出的真实代码问题已修复。
10. 未修改法案内容。
11. 未弱化施工图内容。
```

完成后只输出简短标记：

```txt
[REQ-DONE]
requirementId:
completed:
remaining:
```

然后立刻继续下一条，不得停下总结。

---

## 未完成禁止停止

以下情况不得停止：

```txt
完成了几条 requirement
完成了一个 owner 的一部分
完成了 K01 的前几条
audit:kernel PASS
audit:<owner> PASS
发现下一条比较复杂
需要继续处理下一条
想向用户汇报阶段进展
```

这些都不是停止理由。

禁止输出：

```txt
本轮完成了前两条，下一步建议继续
本轮实际完成的是...
下一步最自然的是...
FINAL VERDICT: NOT_PASS
```

只要清单未完成，不能输出最终报告。

---

## 允许停止的唯一情况

只有两种情况可以停止。

### 情况 1：清单全部完成

条件：

```txt
completedRequirements == totalRequirements
```

此时输出最终报告。

### 情况 2：明确 BLOCKED

只有以下 BLOCKED 可以停止：

```txt
BLOCKED_CHECKLIST_MISSING
BLOCKED_SOURCE_LAW_MISSING
BLOCKED_SOURCE_BLUEPRINT_MISSING
BLOCKED_LAW_BLUEPRINT_CONFLICT
BLOCKED_STATIC_REQUIREMENT_UNENFORCEABLE
BLOCKED_CROSS_OWNER_CONFLICT
BLOCKED_USER_DECISION_REQUIRED
```

BLOCKED 必须具体到 requirement：

```txt
[REQ-BLOCKED]
requirementId:
owner:
sourceFile:
sourceLawId:
sourceSection:
sourceText:
whyBlocked:
whyCodexCannotDecide:
recommendedUserDecision:
```

禁止用“任务太长”“后续继续”“建议下一步”作为 BLOCKED。

---

## 法条施工图主干原则

每条 requirement 都必须坚持：

```txt
法条原文 = 第一锚点
施工图细则 = 第二锚点
清单顺序 = 进程锚点
inspector = 被审计对象
代码 = 被修复对象
```

如果 inspector 与法条/施工图冲突：

```txt
默认 inspector 错。
删除/重写 inspector。
```

只有法条和施工图本身冲突，才输出：

```txt
BLOCKED_LAW_BLUEPRINT_CONFLICT
```

---

## 修复规则

### inspector 错或缺

```txt
删除/重写 inspector 对应逻辑。
补 negative proof。
补 run-inspector / manifest / package script。
```

禁止：

```txt
把 FAIL 改 WARNING
删除检查
注释检查
加临时 allowlist
用旧 inspector 逻辑解释法条
```

### 代码错

```txt
删除重写 / 物理切割 / contract 修复 / schema 修复 / proof 修复 / import 边界修复。
```

禁止：

```txt
缝合怪
小补丁糊住
bridge
fallback
compat
第二实现
代码迁就错误 inspector
```

---

## 命令规则

每条 requirement 只跑轻量链：

```bash
npm run audit:build
npm run audit:<owner>
```

本阶段禁止把 CI-FULL 当主线。

不要每条跑：

```bash
npm run ci:full
```

除非用户明确要求。

---

## 进度输出规则

允许输出短进度，但不得停止：

```txt
[REQ-DONE]
requirementId:
completed:
remaining:
nextRequirementId:
```

输出后必须继续执行下一条。

禁止输出阶段性最终报告。

---

## 最终报告只允许在清单完成后输出

只有当：

```txt
completedRequirements == totalRequirements
```

才允许输出：

```txt
[CHECKLIST-STATIC-COVERAGE-DONE]

1. CHECKLIST
- totalRequirements:
- completedRequirements:
- blockedRequirements:

2. COVERAGE
- law/blueprint static coverage:
- negative proof coverage:
- owner audit pass count:

3. INSPECTOR CHANGES
- inspectors rewritten:
- negative proofs added:

4. CODE FIXES
- files deleted:
- files rewritten:
- files split:

5. COMMANDS RUN
- audit:build:
- owner audits:

6. FREEZE CHECK
- law content changed: NO
- blueprint content weakened: NO
- inspector disabled: NO
- negative proof removed: NO
- generated manually edited: NO

7. FINAL VERDICT
- PASS
```

如果没有完成全部清单，禁止输出 FINAL VERDICT。

---

## 一句话执行纪律

```txt
从《法条+施工图要求执法复查清单.md》第一条开始，一条一条做；每条必须法条/施工图为主干，inspector 静态覆盖 100%，代码问题修复，owner audit 通过；清单未完成或未明确 BLOCKED，禁止停止。
```

现在开始执行，不要再阶段性停止。

```
```
