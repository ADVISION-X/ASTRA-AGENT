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
   - structured indexes
   - parse failures with raw
   ↓
FINAL ADJUDICATION
   - runtime shell
   - AI-generated finalAdjudicationPromptBundle
   - fullCaseFile markdown
   - structured index only as navigation
   ↓
HTML REPORT
   - runtime HTML shell
   - AI-generated htmlReportPromptBundle
   - finalReport
   - fullCaseFile markdown
   ↓
EXPORT
   - full-case-file.json
   - full-case-file.md
   - final-report.md
   - business-report.html
```

## 固定产物

```txt
business-report.html
full-case-file.json
full-case-file.md
research-plan.json
prompt-bundles.json
decision-package.json
final-report.md
evidence-index.json
```

## 硬边界

```txt
不存在 legacy。
不存在 fallback。
不存在 PPT。
不存在 deck。
不存在 local generator。
不存在 AI PPT artifact。
不存在 positive/falsification legacy path。
不存在 optional/compact/lite package。
不存在多模式或第二主链。
```

## Full Case File

`FULL_CASE_FILE` 是最终裁决案卷。所有 AI prompt、所有 AI raw response、parse status、结构化索引、record hashes、provider proof 都必须进入案卷。结构化解析只是索引，不得替代 raw response。

最终裁决必须接收 `finalAdjudicationPromptBundle + fullCaseFileMarkdown + structuredIndex`。
HTML report 必须接收 `htmlReportPromptBundle + finalReport + fullCaseFileMarkdown`。

## Prompt 主权

系统外壳不等于业务提示词。

系统外壳只管：

```txt
安全边界
格式边界
发送
捕获
保存
全量案卷
导出
```

业务提示词只来自第一轮 AI 生成的 `promptBundle`。

runtime shell 可以强制：

```txt
raw preservation
preferred format
forbidden control fields
safety / no unsupported evidence
HTML artifact technical constraints
```

禁止保留：

```txt
fixed sub-question business prompt
fixed final adjudication business prompt
fixed HTML business report structure
default business prompt fallback
```

## HTML 商业报告

HTML shell 只能要求完整自包含 HTML、inline CSS、no external JS、no external CSS、no external images、no markdown fence。

系统只检查 HTML 非空、包含 html/body、文件保存成功、hash 保存成功。系统不得重裁决内容。

## 验收

完整验收入口只有：

```bash
npm run ci:full
```
