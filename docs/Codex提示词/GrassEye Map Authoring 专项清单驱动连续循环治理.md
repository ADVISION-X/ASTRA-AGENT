
# GrassEye Map Authoring 专项清单驱动连续循环治理：未完成禁止停止版

## 任务范围

本任务只专项治理以下 4 个文件：

```txt
1. .github/instructions/cursor-rules/modules/module-map-plugin-package.instructions.md

2. docs/法案辅助文件/GrassEye 地图插件包治理施工图.md

3. docs/法案辅助文件/GrassEye Map Prompt Contract Governance 施工图.md

4. docs/法案辅助文件/GrassEye Map Authoring Input Package 施工图.md
````

本任务只治理 owner：

```txt
map-plugin-package
```

如必须触碰 AI / Commander / Orchestration / Forensics，只允许修边界 contract / adapter / schema / audit reference，不得扩展对方业务逻辑。

---

## 最高死命令

本任务只有两条最高死命令：

```txt
死命令 1：
必须按照本文内置【专项执行清单】顺序，从 MAP-LAW-001 执行到 MAP-BP-INPUT-017。
清单未完成，禁止停止，禁止输出最终报告。

死命令 2：
必须坚持“法条 + 施工图为主干，inspector 只是枝干，代码服从主干和合法 inspector”。
每个清单项必须做到静态执法覆盖 100%，并修复对应真实代码问题，才能进入下一项。
```

任何总结、阶段报告、阶段性 NOT_PASS，都不得作为停止理由。

---

## 本任务不是

```txt
不是重新设计 map-plugin-package。
不是改法案内容。
不是改施工图内容。
不是 CI-FULL 主线任务。
不是动态调试任务。
不是端到端运行任务。
```

本任务是：

```txt
专项法条 + 施工图静态执法覆盖 100% 普查与修复。
```

---

## 冻结规则

### 法案冻结

```txt
法案内容冻结。
允许修格式 / 文件编码 / 明显 OCR 错误。
禁止降低法案。
禁止删除法条。
禁止弱化 MUST / FORBIDDEN。
禁止把 FAIL 改 WARNING。
禁止新增 exception / waiver / allowlist。
```

### 施工图冻结

```txt
施工图内容冻结。
允许修格式 / 文件编码 / 明显 OCR 错误。
禁止弱化施工图要求。
禁止删除施工图要求。
禁止把 required 改 optional。
```

如果法案与施工图真实冲突：

```txt
输出 BLOCKED_LAW_BLUEPRINT_CONFLICT。
不得自行修改法案或施工图内容。
```

---

## 主干原则

每个清单项都必须坚持：

```txt
法条原文 = 第一锚点
施工图细则 = 第二锚点
本内置清单顺序 = 进程锚点
inspector = 被审计对象
代码 = 被修复对象
```

如果 inspector 与法条/施工图冲突：

```txt
默认 inspector 错。
删除/重写 inspector。
```

只有法条和施工图本身冲突，才允许 BLOCKED。

---

## 专项执行清单

必须严格按以下顺序执行。

---

# A. 法案清单：module-map-plugin-package.instructions.md

## MAP-LAW-001

```txt
lawId: GRASSEYE-MAP-PLUGIN-001-V2
summary: map packages are declarative route data consumed by Orchestration, not runtime code, child abilities, or new owners.
```

## MAP-LAW-002

```txt
lawId: GRASSEYE-MAP-PLUGIN-002-V2
summary: map packages must pass import, quarantine, validation, human approval, activation, active registry, and re-inspect lifecycle before runtime consumption.
```

## MAP-LAW-003

```txt
lawId: GRASSEYE-MAP-PLUGIN-003-V2
summary: map package schema must contain complete governance metadata and must not depend on runtime truth as package authority.
```

## MAP-LAW-004

```txt
lawId: GRASSEYE-MAP-PLUGIN-004-V2
summary: map packages must never carry executable payloads, runtime code, prompt text, shell scripts, dynamic imports, handlers, or direct ability control.
```

## MAP-LAW-005

```txt
lawId: GRASSEYE-MAP-PLUGIN-005-V2
summary: map packages may reference prompt contracts but must not own prompt content or create prompt double-truth.
```

## MAP-LAW-006

```txt
lawId: GRASSEYE-MAP-PLUGIN-006-V2
summary: AI-generated map packages must be authored against governed catalogs and remain draft/quarantine until all gates and human approval pass.
```

## MAP-LAW-007

```txt
lawId: GRASSEYE-MAP-PLUGIN-007-V2
summary: capability catalog is a generated read model used for authoring and validation; it must not become runtime truth or a second ability registry.
```

## MAP-LAW-008

```txt
lawId: GRASSEYE-MAP-PLUGIN-008-V2
summary: branch condition DSL must be schema-declared, closed, non-executable, and able to reference declared outputSchemaRef fields.
```

## MAP-LAW-009

```txt
lawId: GRASSEYE-MAP-PLUGIN-009-V2
summary: ordinary and developer map surfaces must stay separate, and Commander must not activate or mutate maps without governed validation/approval path.
```

## MAP-LAW-010

```txt
lawId: GRASSEYE-MAP-PLUGIN-010-V2
summary: map activation, validation, approval, prompt binding, and authoring must produce Forensics-compatible proof records.
```

## MAP-LAW-011

```txt
lawId: GRASSEYE-MAP-PLUGIN-011-V2
summary: user-facing map explanation must translate route data into understandable task flow without exposing runtime internals in ordinary mode.
```

## MAP-LAW-012

```txt
lawId: GRASSEYE-MAP-PLUGIN-012-V2
summary: map-plugin-package enforcement must close through owner-local AST/schema/reference inspector, runner, and real-code-inspection.
```

## MAP-LAW-013

```txt
lawId: GRASSEYE-MAP-PLUGIN-013-V2
summary: advanced AI map generation must receive a complete Map Authoring Input Package; missing catalogs or policies must block generation.
```

## MAP-LAW-014

```txt
lawId: GRASSEYE-MAP-PLUGIN-014-V2
summary: capability catalog must be detailed enough for advanced AI to generate maps without inventing abilities.
```

## MAP-LAW-015

```txt
lawId: GRASSEYE-MAP-PLUGIN-015-V2
summary: prompt contract and output schema catalogs must define every AI step and branchable field used by maps.
```

## MAP-LAW-016

```txt
lawId: GRASSEYE-MAP-PLUGIN-016-V2
summary: safety, human approval, evidence, PAV, Forensics, privacy, secret, rate-limit, and platform policies must be first-class inputs to map authoring.
```

## MAP-LAW-017

```txt
lawId: GRASSEYE-MAP-PLUGIN-017-V2
summary: map-plugin-package enforcement must prove Map Authoring Input Package completeness, generated-map safety, and lifecycle boundaries in addition to existing map package governance.
```

---

# B. 施工图清单 1：GrassEye 地图插件包治理施工图.md

## MAP-BP-GOV-000

```txt
section: 0. 文件身份
```

## MAP-BP-GOV-001

```txt
section: 1. 核心定位
```

## MAP-BP-GOV-002

```txt
section: 2. 系统协作链路
```

## MAP-BP-GOV-003

```txt
section: 3. 标准目录结构
```

## MAP-BP-GOV-004

```txt
section: 4. Map Package Schema
```

## MAP-BP-GOV-005

```txt
section: 5. Operational Map Step Model
```

## MAP-BP-GOV-006

```txt
section: 6. Prompt Binding
```

## MAP-BP-GOV-007

```txt
section: 7. Branch Condition DSL
```

## MAP-BP-GOV-008

```txt
section: 8. AI-Generated Map Authoring
```

## MAP-BP-GOV-009

```txt
section: 9. Map Authoring Prompt Builder
```

## MAP-BP-GOV-010

```txt
section: 10. Lifecycle
```

## MAP-BP-GOV-011

```txt
section: 11. Ordinary / Developer Feed
```

## MAP-BP-GOV-012

```txt
section: 12. User-facing Map Explanation View
```

## MAP-BP-GOV-013

```txt
section: 13. Capability Catalog
```

## MAP-BP-GOV-014

```txt
section: 14. Security Validator
```

## MAP-BP-GOV-015

```txt
section: 15. Forensics-compatible Proof
```

## MAP-BP-GOV-016

```txt
section: 16. Enforcement
```

## MAP-BP-GOV-017

```txt
section: 17. real-code-inspection Minimum
```

## MAP-BP-GOV-018

```txt
section: 18. READY 标准
```

## MAP-BP-GOV-A

```txt
section: A. 为什么需要输入包
```

## MAP-BP-GOV-B

```txt
section: B. Map Authoring Input Package 标准结构
```

## MAP-BP-GOV-C

```txt
section: C. Capability Catalog 细则
```

## MAP-BP-GOV-D

```txt
section: D. Prompt Contract Catalog 与 Output Schema Catalog
```

## MAP-BP-GOV-E

```txt
section: E. Safety / Human Approval Policy
```

## MAP-BP-GOV-F

```txt
section: F. Evidence / PAV / Forensics Policy
```

## MAP-BP-GOV-G

```txt
section: G. Platform Profile
```

## MAP-BP-GOV-H

```txt
section: H. Authoring Prompt Builder 约束
```

## MAP-BP-GOV-I

```txt
section: I. AI 生成地图输出要求
```

## MAP-BP-GOV-J

```txt
section: J. User-facing Explanation
```

## MAP-BP-GOV-K

```txt
section: K. READY 增补标准
```

---

# C. 施工图清单 2：GrassEye Map Prompt Contract Governance 施工图.md

## MAP-BP-PROMPT-000

```txt
section: 0. 文件身份
```

## MAP-BP-PROMPT-001

```txt
section: 1. 核心边界
```

## MAP-BP-PROMPT-002

```txt
section: 2. Prompt Contract Catalog Entry
```

## MAP-BP-PROMPT-003

```txt
section: 3. Map Authoring Prompt Contract
```

## MAP-BP-PROMPT-004

```txt
section: 4. MapAuthoringAiOutputSchema
```

## MAP-BP-PROMPT-005

```txt
section: 5. Output Schema Catalog
```

## MAP-BP-PROMPT-006

```txt
section: 6. Prompt Binding
```

## MAP-BP-PROMPT-007

```txt
section: 7. Forensics Proof
```

## MAP-BP-PROMPT-008

```txt
section: 8. real-code-inspection
```

## MAP-BP-PROMPT-009

```txt
section: 9. READY 标准
```

## MAP-BP-PROMPT-A

```txt
section: A. map-authoring-from-user-requirement-v1 Required Inputs
```

## MAP-BP-PROMPT-B

```txt
section: B. Prompt Text Requirements
```

## MAP-BP-PROMPT-C

```txt
section: C. MapAuthoringAiOutputSchema Required Fields
```

## MAP-BP-PROMPT-D

```txt
section: D. Output Schema Catalog Binding
```

## MAP-BP-PROMPT-E

```txt
section: E. Forensics Proof Requirements
```

## MAP-BP-PROMPT-F

```txt
section: F. real-code-inspection Additions
```

---

# D. 施工图清单 3：GrassEye Map Authoring Input Package 施工图.md

## MAP-BP-INPUT-000

```txt
section: 0. 文件身份
```

## MAP-BP-INPUT-001

```txt
section: 1. 目标
```

## MAP-BP-INPUT-002

```txt
section: 2. Required Package Shape
```

## MAP-BP-INPUT-003

```txt
section: 3. User Requirement
```

## MAP-BP-INPUT-004

```txt
section: 4. Capability Catalog
```

## MAP-BP-INPUT-005

```txt
section: 5. Prompt Contract Catalog
```

## MAP-BP-INPUT-006

```txt
section: 6. Output Schema Catalog
```

## MAP-BP-INPUT-007

```txt
section: 7. Map Package Schema
```

## MAP-BP-INPUT-008

```txt
section: 8. Map Authoring Output Schema
```

## MAP-BP-INPUT-009

```txt
section: 9. Safety / Human Approval Policy
```

## MAP-BP-INPUT-010

```txt
section: 10. Evidence / PAV / Forensics Policy
```

## MAP-BP-INPUT-011

```txt
section: 11. Platform Profile
```

## MAP-BP-INPUT-012

```txt
section: 12. Example Maps
```

## MAP-BP-INPUT-013

```txt
section: 13. Authoring Prompt Use
```

## MAP-BP-INPUT-014

```txt
section: 14. Missing Input Handling
```

## MAP-BP-INPUT-015

```txt
section: 15. User-facing Explanation Requirements
```

## MAP-BP-INPUT-016

```txt
section: 16. Inspector Requirements
```

## MAP-BP-INPUT-017

```txt
section: 17. READY 标准
```

---

## 每个清单项的固定循环

对上面每一个清单项，严格执行：

```txt
读取当前清单项
→ 回读对应法条原文或施工图段落
→ 从原文拆出所有静态可执法 requirement
→ 读取 scripts/audit/domains/map-plugin-package/**
→ 判断 inspector 对这些 requirement 是否 100% 静态覆盖
→ 未覆盖则删除/重写 inspector 对应逻辑
→ 缺 real-code-inspection 则补 real-code-inspection
→ 运行 npm run audit:build
→ 运行 npm run audit:map-plugin-package
→ 如果 audit 抓到真实代码违规，则删除/重写/物理切割代码文件
→ 再次运行 npm run audit:build
→ 再次运行 npm run audit:map-plugin-package
→ 当前清单项 100% 完成
→ 自动进入下一清单项
```

---

## 每个清单项完成标准

当前清单项只有同时满足以下条件，才允许进入下一项：

```txt
1. 已读取清单项。
2. 已回读对应法条原文或施工图段落。
3. 已从原文拆出静态可执法 requirement。
4. 已读取 map-plugin-package inspector。
5. inspector 静态覆盖该清单项 = 100%。
6. required real-code-inspection 已存在并覆盖。
7. npm run audit:build PASS。
8. npm run audit:map-plugin-package PASS。
9. inspector 抓出的真实代码问题已修复。
10. 未修改法案内容。
11. 未弱化施工图内容。
```

完成后只输出：

```txt
[REQ-DONE]
requirementId:
completed:
remaining:
nextRequirementId:
```

然后立刻继续下一项，不得停下总结。

---

## 未完成禁止停止

以下情况不得停止：

```txt
完成了几条 requirement
完成了一个 law
完成了一个施工图 section
audit:map-plugin-package PASS
发现下一条比较复杂
想向用户汇报阶段进展
```

这些都不是停止理由。

禁止输出：

```txt
本轮完成了前几条，下一步建议继续
本轮实际完成的是...
下一步最自然的是...
FINAL VERDICT: NOT_PASS
```

只要专项清单未完成，不能输出最终报告。

---

## 允许停止的唯一情况

只有两种情况可以停止。

### 情况 1：专项清单全部完成

条件：

```txt
completedRequirements == totalRequirements
```

本专项清单总数：

```txt
17 条法案清单
+ 30 条地图施工图清单
+ 16 条 Prompt Contract 施工图清单
+ 18 条 Input Package 施工图清单
= 81 条
```

即：

```txt
totalRequirements = 81
```

### 情况 2：明确 BLOCKED

只有以下 BLOCKED 可以停止：

```txt
BLOCKED_SOURCE_LAW_MISSING
BLOCKED_SOURCE_BLUEPRINT_MISSING
BLOCKED_LAW_BLUEPRINT_CONFLICT
BLOCKED_STATIC_REQUIREMENT_UNENFORCEABLE
BLOCKED_CROSS_OWNER_CONFLICT
BLOCKED_USER_DECISION_REQUIRED
```

BLOCKED 必须具体到当前清单项：

```txt
[REQ-BLOCKED]
requirementId:
owner: map-plugin-package
sourceFile:
sourceLawId:
sourceSection:
sourceText:
whyBlocked:
whyCodexCannotDecide:
recommendedUserDecision:
```

禁止用：

```txt
任务太长
后续继续
建议下一步
```

作为 BLOCKED。

---

## 修复规则

### inspector 错或缺

```txt
删除/重写 inspector 对应逻辑。
补 real-code-inspection。
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

每条清单项只跑轻量链：

```bash
npm run audit:build
npm run audit:map-plugin-package
```

本阶段禁止把 CI-FULL 当主线。

不要每条跑：

```bash
npm run ci:full
```

除非用户明确要求。

---

## 最终报告只允许在 81 条全部完成后输出

只有当：

```txt
completedRequirements == 81
```

才允许输出：

```txt
[MAP-PLUGIN-PACKAGE-SPECIAL-COVERAGE-DONE]

1. CHECKLIST
- totalRequirements: 81
- completedRequirements:
- blockedRequirements:

2. COVERAGE
- law static coverage:
- blueprint static coverage:
- real-code-inspection coverage:
- map-plugin-package audit:

3. INSPECTOR CHANGES
- inspectors rewritten:
- real-code-inspections added:
- manifests/run-inspectors/package scripts changed:

4. CODE FIXES
- files deleted:
- files rewritten:
- files split:
- schema fixes:
- proof fixes:
- boundary fixes:

5. COMMANDS RUN
- audit:build:
- audit:map-plugin-package:

6. FREEZE CHECK
- law content changed: NO
- blueprint content weakened: NO
- inspector disabled: NO
- real-code-inspection removed: NO
- generated manually edited: NO

7. FINAL VERDICT
- PASS
```

如果没有完成 81 条，禁止输出 FINAL VERDICT。

---

## 一句话执行纪律

```txt
本专项只按本文 81 条清单顺序走。
每一条都必须：读源头，审 inspector，补静态覆盖 100%，修真实代码，audit:map-plugin-package 通过，再进入下一条。
81 条未全部完成或未明确 BLOCKED，禁止停止。
```

现在开始执行，不要阶段性停止。

```
```
