# GrassEye Deep Research Analysis Job Flow 施工图

version: 2026-05-25
status: blueprint
targetLaw: `GrassEye Deep Research Analysis Job Flow 法案`
capabilityDomain: `deep-research-analysis`

## 唯一流程

```txt
USER QUESTION
   ↓
AI RESEARCH PLAN
   - N subQuestions
   - each subQuestion has its own promptBundle
   - finalAdjudicationPromptBundle
   - htmlReportPromptBundle
   ↓
PERSIST RAW DECOMPOSITION + RESEARCH PLAN
   ↓
FOR EACH SUBQUESTION
   - render runtime shell
   - inject that subQuestion.promptBundle
   - inject user question + subQuestion context
   - send to AI
   - persist raw prompt + raw response
   ↓
BUILD FULL CASE FILE
   - all prompts
   - all raw responses
   - structured index
   - parse failures with raw
   ↓
FINAL ADJUDICATION
   - runtime shell
   - AI-generated finalAdjudicationPromptBundle
   - structuredIndex
   - fullCaseFile
   - fullCaseFile markdown
   ↓
HTML REPORT
   - runtime HTML shell
   - AI-generated htmlReportPromptBundle
   - finalReport
   - fullCaseFile
   - fullCaseFile markdown
   ↓
EXPORT
   - full-case-file.json
   - full-case-file.md
   - structured-index.json
   - final-report.md
   - business-report.html
   - evidence-index.json
```

## PromptBundle 主权链路

```txt
用户问题
  -> AI 拆解 ResearchPlan
  -> 为每个 subQuestion 生成独立 promptBundle
  -> N 阶段仅使用对应 subQuestion.promptBundle
  -> Final 阶段仅使用 finalAdjudicationPromptBundle
  -> HTML 阶段仅使用 htmlReportPromptBundle
```

系统不写业务提示词。

系统只渲染 AI 生成的 promptBundle + runtime shell。

## Runtime Shell Only 边界

```txt
允许：
- raw response will be persisted
- return requested format when possible
- preserve analytical content even if formatting imperfect
- do not output system operation instructions
- forbidden control fields
- do not invent unavailable evidence
- html self-contained constraints

禁止：
- 固定业务 sub-question prompt
- 固定业务 final adjudication prompt
- 固定业务 HTML report prompt
- 固定 business fields / ranked conclusions / final verdict schema
- 领域模板、内容取舍标准、证据权重判断规则
```

## Full Case File

`FULL_CASE_FILE` 是最终裁决案卷。所有 AI prompt、所有 AI raw response、parse status、结构化索引、record hashes、provider proof 都必须进入案卷。结构化解析只是索引，不得替代 raw response。

最终裁决必须接收 `structuredIndex + fullCaseFile + fullCaseFileMarkdown + finalAdjudicationPromptBundle`。
HTML report 必须接收 `finalReport + fullCaseFile + fullCaseFileMarkdown + htmlReportPromptBundle`。

`structured-index.json` 只是导航索引，不是 full case file，也不是最终裁决真相源。

## Physical Delete Inventory

```txt
已物理删除或禁止保留：
- decision-package / final-package 旧语义
- research-plan.json 导出
- prompt-bundles.json 导出
- PPT / deck / local generator / AI PPT artifact
- positive/falsification old flow
- compatibility / fallback / optional / compact / lite 双路径实现
```

## Export

```txt
只允许导出：
- full-case-file.json
- full-case-file.md
- structured-index.json
- final-report.md
- business-report.html
- evidence-index.json
```

## AST 解析护栏

```txt
Deep Research 活跃生产源码与本地 workbench surface 必须保持 TypeScript AST 可解析。

owner inspector 必须扫描：
- src/plugins/deep-research-analysis/**/*.ts
- src/app/workbench-deep-research*.ts
- src/lib/local-runtime/workbench*.ts

发现 parse diagnostics 时必须直接 FAIL。
执法输出允许一条精简调试日志：files=<count> diagnostics=<count>。
禁止依赖运行时启动失败才暴露这类问题。
```

## UI

```txt
只允许显示：
- History
- Final Decision / Final Report
- Primary Business HTML Report
- Full Case File
- Process Trace / Evidence Index

只允许动作：
- Open HTML Report
- Download HTML Report
- Open Full Case File
- Download full-case-file.md
- Download full-case-file.json
```

## 验收

完整验收入口只有：

```bash
npm run ci:full
```
