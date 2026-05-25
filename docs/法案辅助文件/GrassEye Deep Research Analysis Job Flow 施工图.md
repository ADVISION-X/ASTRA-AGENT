# GrassEye Deep Research Analysis Job Flow 施工图

version: 2026-05-25
status: blueprint
targetLaw: `GrassEye Deep Research Analysis Job Flow 法案`
capabilityDomain: `deep-research-analysis`

## 唯一流程

```txt
INTAKE
-> DECOMPOSE_SEND
-> DECOMPOSE_CAPTURE
-> DECOMPOSE_RAW_PERSIST
-> DECOMPOSE_PARSE
-> SUB_QUESTIONS_PERSIST

-> ANALYSIS_SEND for each sub-question
-> ANALYSIS_CAPTURE
-> ANALYSIS_RAW_PERSIST
-> ANALYSIS_PARSE_OR_RAW_PRESERVE
-> ANALYSIS_PERSIST

-> FULL_CASE_FILE_BUILD
-> FULL_CASE_FILE_EXPORT_JSON
-> FULL_CASE_FILE_EXPORT_MD

-> FINAL_ADJUDICATION_SEND
-> FINAL_ADJUDICATION_CAPTURE
-> FINAL_ADJUDICATION_RAW_PERSIST
-> FINAL_REPORT_PERSIST

-> HTML_REPORT_SEND
-> HTML_REPORT_CAPTURE
-> HTML_REPORT_RAW_PERSIST
-> HTML_REPORT_PERSIST_AS_BUSINESS_REPORT_HTML

-> EXPORT
-> COMPLETE
```

## 固定产物

```txt
business-report.html
full-case-file.json
full-case-file.md
decision-package.json
final-report.md
evidence-index.json
```

## 硬边界

```txt
不存在 legacy。
不存在 fallback。
不存在 optional deck。
不存在 PPT。
不存在 compact/lite package。
不存在多模式。
```

## Full Case File

`FULL_CASE_FILE` 是最终裁决案卷。所有 AI prompt、所有 AI raw response、parse status、结构化索引、record hashes、provider proof 都必须进入案卷。结构化解析只是索引，不得替代 raw response。

最终裁决 prompt 必须接收 `structuredFinalIndex + fullCaseFile`。HTML report prompt 必须接收 `finalReport + fullCaseFile`。

## HTML 商业报告

HTML prompt 必须要求完整自包含 HTML、inline CSS、no external JS、no external CSS、no external images、no markdown fence、business decision report structure。

系统只检查 HTML 非空、包含 html/body、文件保存成功、hash 保存成功。系统不得重裁决内容。

## 验收

完整验收入口只有：

```bash
npm run ci:full
```
