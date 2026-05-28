# Codex Entry Law

版本：2026-05-28  
状态：active  
适用范围：本仓库内所有 Codex / AI coding / 自动化改代码任务  

---

## 0. 最高原则

Codex 不是来“发挥”的。

Codex 每次任务只做三件事：


读清楚边界
做最小修改
用实证证明
```

禁止：


理论正确但未验证
为了优雅而复杂化
为了兼容而制造第二链路
为了通过测试而降低法案
为了省事而绕过入口扫描
```

---

## 1. Mandatory Entry Scan

任何 Codex 任务在修改代码、审计脚本、生成器、页面、配置、CI 或文档化执行规则前，必须先完成入口扫描。

执行前必须输出：


[PRE-TASK-LAW-SCAN]
```

扫描必须覆盖：

### 1.1 总入口


AGENTS.md
.github/instructions/agent-rules/grasseye-index.instructions.md
.github/instructions/agent-rules/GRASSEYE-KERNEL.instructions.md
```

### 1.2 任务命中域法案

必须读取与本次任务相关的 active law module：


.github/instructions/agent-rules/modules/*.instructions.md
```

只读取命中域和直接相关域，不要把无关法案当成授权来源。

### 1.3 Generated audit truth

必须读取：


scripts/audit/generated/law-registry.generated.json
scripts/audit/generated/audit-plan.generated.json
scripts/audit/generated/enforcement-matrix.generated.json
```

generated 文件只能作为当前生成事实读取。

禁止手工编辑 generated artifacts 作为源真相。

### 1.4 质检系统

必须读取：


scripts/audit/ci-full.ts
scripts/audit/build-audit-artifacts.ts
scripts/audit/core/run-generated-plan.ts
```

如果本次任务命中已有 audit domain，还必须读取：


scripts/audit/domains/<domain>/inspector.ts
```

如果该域已有：


scripts/audit/domains/<domain>/manifest.json
```

则必须读取。

如果不存在，不得为了满足入口扫描而新建 manifest.json。

### 1.5 施工图

必须读取与任务命中域相关的：


docs/法案辅助文件/*.md
```

施工图只能作为实现地图。

施工图不能高于 active law。

---

## 2. Authorization Gate

入口扫描后必须输出：


[TASK-AUTHORIZATION]
```

必须说明：


允许修改范围
禁止修改范围
owner 边界
是否允许新增 / 修改 active law
generated artifact 规则
是否存在 LAW-GAP
是否存在 second-chain risk
需要哪些实证验证
最终验收命令
```

没有 `[TASK-AUTHORIZATION]` 之前，禁止改文件。

---

## 3. Law Change Gate

Codex 不得主动新增 active law、active domain、active owner。

只有用户明确要求：


新增法案
修改法案
新增治理域
建立专项治理
```

才允许创建或修改 active law。

发现 LAW-GAP 时，默认只报告，不自动补法案。

如果用户明确授权补法案，必须同时补：


active law
施工图
audit owner
acceptance
ci:full 接入
```

不得只补文档不补执法。

---

## 4. Simplicity Gate

优先简单，禁止复杂化。

每次修改必须遵守：


能改 1 个文件，不改 3 个文件。
能写 50 行，不写 200 行。
能复用现有链路，不新增抽象层。
能用现有 runner，不新增 runner。
能用现有 route，不新增第二 route 系统。
```

禁止：


无需求抽象
无需求配置化
无需求插件化
无需求多模式
无需求 fallback
无需求 compatibility bridge
无需求 shadow implementation
```

如果 Codex 认为“加一个框架更优雅”，默认拒绝。

---

## 5. Surgical Change Gate

只改本任务必须改的内容。

禁止顺手重构：


无关文件
无关格式
无关注释
无关命名
无关目录结构
无关测试
无关 generated artifacts
```

如果发现无关问题：


报告，不处理。
```

如果本次修改制造了 unused import / unused variable / orphan helper：


必须清理自己制造的垃圾。
```

禁止清理历史遗留问题，除非用户明确要求。

---

## 6. Evidence-First Coding Gate

Codex 不得写“理论正确但未实证”的代码。

所有完成声明必须基于证据。

### 6.1 浏览器 / DOM / UI / 平台行为

凡涉及以下内容，必须通过真实 Chrome 或项目已批准的真实浏览器路径验证：


页面打开
DOM 定位
按钮点击
输入框填写
文件上传
下载
弹窗
登录态
Seller Central 页面行为
Amazon 页面行为
ontheway 页面行为
Workbench UI 行为
CORS 浏览器行为
前端 fetch 行为
```

禁止只凭：


类型检查通过
静态推测
模拟 DOM
自己想象页面结构
理论上应该能点
```

验收报告必须写明：


CHROME_VERIFIED: true / false
Chrome 验证入口
Chrome 验证步骤
实际观察结果
截图 / 日志 / evidence ref，如已有
```

如果当前环境无法真实 Chrome 验证，必须写：


CHROME_VERIFIED: false
NOT_PRODUCTION_VERIFIED
原因：
缺少什么：
下一步如何验证：
```

不得把未 Chrome 验证的浏览器行为报告为完成。

### 6.2 非浏览器逻辑

纯函数、schema、AST inspector、CI runner、文件生成、类型系统等非浏览器逻辑，可以用以下证据证明：


typecheck
unit / acceptance
audit inspector
fixture attack
ci:full
```

但不得把非浏览器测试伪装成 Chrome 验证。

### 6.3 实证优先顺序

优先级：


真实 Chrome 实测
项目 acceptance 实测
AST inspector 实测
typecheck
人工解释
```

人工解释永远不能单独作为完成证明。

---

## 7. Audit Script Gate

质检脚本必须优先使用 ts-morph。

凡涉及：


法案扫描
owner 边界扫描
import 边界扫描
能力组边界扫描
API 边界扫描
反逃逸检查
generated truth 检查
```

必须是：


AST 级
symbol 级
反逃逸级
```

禁止把以下方式作为执法依据：


grep
raw string scanning
RegExp
/.../
new RegExp()
sourceFile.getFullText() 后搜索
fs.readFileSync 后搜索代码文本
shell grep
```

允许使用：


ts-morph Project
SourceFile
ImportDeclaration
ExportDeclaration
CallExpression
ObjectLiteralExpression
PropertyAssignment
Identifier
StringLiteral
Symbol
Declaration
getModuleSpecifierSourceFile()
getDefinitions()
getDeclarations()
```

普通业务代码如确需正则处理用户文本，必须局部、可解释，且不得作为法案执法依据。

---

## 8. Command Gate

最终完成判定只能使用：

```bash
npm run ci:full
```

`ci:full` 必须先运行：

```bash
npm run codex:entry-gate
```

阶段性验证允许使用 task-scoped scripts：

```bash
npm run typecheck
npm run audit:<domain>
npm run acceptance:<domain>
```

但局部 PASS 不能替代：

```bash
npm run ci:full
```

任务最终报告如果没有 `ci:full PASS`，不得写完成。

---

## 9. Chrome Verification Gate

涉及浏览器行为的任务，最终报告必须包含：


[CHROME-VERIFICATION]
```

格式：


[CHROME-VERIFICATION]
required: true / false
status: PASS / FAIL / NOT_RUN
browser: real Chrome / approved project browser path / not applicable
entry_url:
steps:
observed:
evidence:
remaining_risk:
```

如果 `required: true` 但 `status != PASS`，最终结论必须是：


NOT PRODUCTION VERIFIED
```

不得写：


done
complete
production-ready
fully verified
```

---

## 10. No Second Chain Gate

绝对禁止新增第二链路。

禁止：


bridge
fallback
shadow
parallel implementation
second runner
second audit truth
second API server
second route bus
second dispatcher
second mission loop
second evidence chain
second runtime log chain
second browser controller
second capability-facing API
```

如果任务确实需要新链路，必须先停下，输出：


SECOND_CHAIN_RISK
```

等待用户明确授权。

---

## 11. Generated Artifact Gate

禁止手工编辑 generated artifacts 作为源真相。

包括但不限于：


scripts/audit/generated/law-registry.generated.json
scripts/audit/generated/audit-plan.generated.json
scripts/audit/generated/enforcement-matrix.generated.json
scripts/audit/generated/static-clause-coverage.generated.json
scripts/audit/generated/*report.generated.json
```

generated artifacts 只能由既有生成链产生。

如果 generated artifact 不对，修源文件或生成器，不手改结果。

---

## 12. LAW-GAP Handling

如果发现 active law 不足以授权本次任务：


不要硬写代码。
不要私自补法案。
不要用施工图越权。
```

必须输出：


LAW-GAP
缺口：
影响：
最小补法：
是否需要用户授权：
```

只有用户明确授权后，才可进入 Law Change Gate。

---

## 13. Completion Report

每个任务完成时必须输出：


[TASK-COMPLETION]
```

格式：


[TASK-COMPLETION]
status: PASS / FAIL / NOT_PRODUCTION_VERIFIED

changed_files:
- ...

what_changed:
- ...

what_not_changed:
- ...

law_boundary:
- ...

second_chain_check:
PASS / FAIL

generated_artifact_rule:
PASS / FAIL

verification:
- npm run typecheck: PASS / FAIL / NOT_RUN
- npm run audit:<domain>: PASS / FAIL / NOT_RUN
- npm run acceptance:<domain>: PASS / FAIL / NOT_RUN
- npm run ci:full: PASS / FAIL / NOT_RUN

chrome_verification:
required: true / false
status: PASS / FAIL / NOT_RUN
evidence:

remaining_risks:
- ...

final_decision:
PASS / FAIL / NOT_PRODUCTION_VERIFIED
```

规则：


ci:full 未 PASS，final_decision 不能是 PASS。
需要 Chrome 验证但未通过，final_decision 不能是 PASS。
存在 LAW-GAP，final_decision 不能是 PASS。
存在 second-chain risk，final_decision 不能是 PASS。
```

---

## 14. Absolute Bans

禁止：


绕过法案直接按记忆施工
把施工图当作高于 active law 的授权来源
手工编辑 generated artifacts 作为源真相
新增 bridge / fallback / shadow / 第二实现
新增平行质检链
warning / partial pass / soft pass 当完成
理论正确但未实证就报告完成
未真实 Chrome 验证就声称浏览器行为可用
为了满足入口扫描而新建不存在的治理机制
为了通过测试降低法案
为了优雅复杂化
```

---

## 15. Final Rule


简单。
直接。
小步。
实证。
不造第二链路。
不写理论正确的废代码。
```
