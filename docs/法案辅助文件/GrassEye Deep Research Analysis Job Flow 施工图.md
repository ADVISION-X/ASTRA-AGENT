# GrassEye Deep Research Analysis Job Flow 施工图

version: 2026-05-25
status: blueprint
targetLaw: `GrassEye Deep Research Analysis Job Flow 法案`
capabilityDomain: `deep-research-analysis`

施工图只作为实现地图，不高于 active law。

## 唯一流程

```txt
USER QUESTION
   ↓
AI RESEARCH PLAN JSON
   - N subQuestions
   - each subQuestion has its own promptBundle
   - finalAdjudicationPromptBundle
   - htmlReportPromptBundle
   - planIntegrityCheck
   ↓
PERSIST RAW DECOMPOSITION + RESEARCH PLAN
   ↓
FOR EACH SUBQUESTION
   - subQuestion.promptBundle
   - runtime N format shell
   - AI answer body between ANSWER_TEXT_BEGIN / ANSWER_TEXT_END
   - optional retrieval-only index JSON between INDEX_JSON_BEGIN / INDEX_JSON_END
   - send to AI
   - persist rawResponseText
   - persist parsed answerText from the delimited answer body
   - persist parsedJsonIndex / indexNotes only when the retrieval block is valid
   ↓
BUILD FULL CASE FILE
   - all prompts
   - all raw responses
   - structured index
   - parse failures with raw
   ↓
FINAL ADJUDICATION
   - finalAdjudicationPromptBundle
   - structuredIndex
   - fullCaseFile
   - fullCaseFileMarkdown
   - runtime final format shell
   - persist rawFinalAnswerText
   - persist parsedJsonIndex only when available
   ↓
HTML REPORT
   - htmlReportPromptBundle
   - rawFinalAnswerText
   - fullCaseFile
   - fullCaseFileMarkdown
   - runtime HTML format shell
   - persist business-report.html
   ↓
EXPORT
   - full-case-file.json
   - full-case-file.md
   - final-adjudication-raw.md
   - business-report.html
   - evidence-index.json
   - structured-index.json
```

## Format Shell Boundary

系统只拼接格式壳、安全壳、持久化说明和传输约束。格式壳只规定如何保存、追溯、导出、展示，不规定业务结论结构。

允许：

```txt
ResearchPlan JSON contract
delimited N-stage answer body plus optional retrieval-only index JSON
rawFinalAnswerText persistence notice
complete self-contained HTML artifact constraints
forbidden control commands
```

禁止：

```txt
system-owned JSON answer envelope that wraps the whole N-stage answer body
system-owned business conclusions
system-owned confidence
system-owned verdict/ranking fields
system-owned final summary
system-owned report section logic
```

## N-Stage Clean Body Capture

N 阶段必须把长正文与索引分离。

允许的最小结构：

```txt
ANSWER_TEXT_BEGIN
完整正文。这里允许自然段、Markdown、小标题、列表、证据解释。
ANSWER_TEXT_END

INDEX_JSON_BEGIN
{
   "indexNotes": ["短索引，仅用于检索"]
}
INDEX_JSON_END
```

禁止把完整正文塞进 `answerText` JSON 字符串字段。`answerText` 是数据库中的解析结果，不是 runtime 壳要求 AI 返回的 JSON 包裹字段。

## Final Adjudication Raw Sovereignty

Final 阶段主产物是 `rawFinalAnswerText`。

成功条件：

```txt
rawFinalAnswerText is non-empty
```

失败条件：

```txt
rawFinalAnswerText is empty
```

系统不得把 final adjudication 转成固定 summary/confidence schema，不得从第一句话造 summary，不得生成 confidence。AI 如果输出 JSON，只能额外保存为 `parsedJsonIndex`，不能替代 raw。

## PromptBundle Field Consistency

PromptBundle schema、ResearchPlan schema、decomposition prompt、parser 只使用：

```txt
supplementalContent
```

不得存在字段别名。`supplementalContent` 是补充指导，不代表第二路径。

## Full Case File

`FULL_CASE_FILE` 是最终裁决案卷。所有 AI prompt、所有 AI raw response、parse status、结构化索引、record hashes、provider proof 都必须进入案卷。结构化解析只是索引，不得替代 raw response。

最终裁决必须接收：

```txt
structuredIndex
fullCaseFile
fullCaseFileMarkdown
finalAdjudicationPromptBundle
```

HTML report 必须接收：

```txt
rawFinalAnswerText
fullCaseFile
fullCaseFileMarkdown
htmlReportPromptBundle
```

## Export

只允许导出：

```txt
full-case-file.json
full-case-file.md
final-adjudication-raw.md
business-report.html
evidence-index.json
structured-index.json
```

`structured-index.json` 只是导航索引，不是 full case file，也不是最终裁决真相源。

## UI

只允许显示：

```txt
History
Final Adjudication Raw
Primary Business HTML Report
Full Case File
Evidence Index
```

UI 不得展示系统生成的 confidence、系统生成的 summary，或把 fixed FinalReport schema 字段当成权威。

## AST 解析护栏

Deep Research 活跃生产源码与本地 workbench surface 必须保持 TypeScript AST 可解析。

owner inspector 必须扫描：

```txt
src/plugins/deep-research-analysis/**/*.ts
src/app/workbench-deep-research*.ts
src/lib/local-runtime/workbench*.ts
```

发现 parse diagnostics 时必须直接 FAIL。

## 验收

完整验收入口只有：

```bash
npm run ci:full
```
